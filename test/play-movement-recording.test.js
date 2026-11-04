// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { createPlayMovementRecorder, recordedEquipmentPair } from "../src/play-movement-recording.js";

const identity = { schema: "aerobeat/equipment_config_identity", version: 1, algorithm: "sha256", value: "a".repeat(64) };
const poses = () => ["left_wrist", "right_wrist"].map((role, i) => ({ role, mode: "flow", geometryIdentity: "aerobeat/saber_capsule_v1", configIdentity: identity, anchor: { x: i + .5, y: .75, z: 0 }, scale: 2, orientation: { x: 0, y: 0, z: 0, w: 1 } }));
function frame() {
  return { timestampMs: 100, clock: { contextTimeSeconds: .1, positionSeconds: 6, playing: true }, renderTimelineMs: 6000, sessionState: "playing", input: { sourceIdentity: "camera", calibration: { calibrationId: "cal", state: "calibrated" }, anchors: [{ anchor: "nose", x: .25, y: .2 }], latestEvidence: { measuredSourceFrameId: "measured-1", measurementTimestampMs: 99, provenance: "measured" } }, rawPose: { sourceId: "camera", timestampMs: 99, mirrored: true, landmarks: [{ name: "nose", x: .7, y: .2, confidence: .98, visibility: .9 }] }, equipmentPoses: poses(), modelKey: ["cal"], configurationKey: ["configuration"], getCalibrationModel: () => ({ schema: "aerobeat/calibration_model", bounds: { left: .1, right: .9, top: .1, bottom: .8 }, normalizedNoseBaseline: { x: .5, y: .2 } }), getConfiguration: () => ({ setup: { timingWindowMs: 180 }, equipmentIdentity: identity }) };
}

test("captures consumed input before scoring and records only actual advances", () => {
  const recorder = createPlayMovementRecorder({ metadata: { purpose: "play" } }), f = frame();
  let models = 0, configurations = 0;
  f.getCalibrationModel = () => { models++; return { calibrationId: "cal", normalizedNoseBaseline: { x: .5, y: .2 } }; };
  f.getConfiguration = () => { configurations++; return { value: 1 }; };
  assert.equal(recorder.observe(f), true);
  assert.equal(recorder.snapshot().ticks.length, 0, "audio transitions need not advance gameplay");
  assert.equal(recorder.record(f), true);
  assert.equal(recorder.record({ ...f, rawPose: null, timestampMs: 110, equipmentPoses: poses(), resultState: "completed" }), true);
  recorder.finish("stopped"); // Later teardown must not rewrite a completed capture.
  const data = recorder.snapshot();
  assert.equal(data.finalSessionState, "completed");
  assert.equal(data.complete, true); assert.equal(data.ticks.length, 2);
  assert.equal(data.rawPoses.length, 1); assert.equal(data.inputs.length, 1);
  assert.equal(data.observations.length, 1); assert.equal(data.equipment.length, 1);
  assert.equal(models, 1); assert.equal(configurations, 1);
  assert.deepEqual(data.ticks.map(row => row[6]), [0, 0], "held ticks reference the last measurement, not fabricated fresh frames");
  assert.deepEqual(recordedEquipmentPair(data, 0), f.equipmentPoses);
  assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
});

test("records calibration/config changes, frozen observations and both equipment endpoints", () => {
  const recorder = createPlayMovementRecorder(), a = frame(); recorder.record(a);
  const b = { ...a, timestampMs: 200, rawPose: null, modelKey: ["cal-2"], configurationKey: ["new"], input: { ...a.input, calibration: { calibrationId: "cal-2" }, latestEvidence: { ...a.input.latestEvidence, provenance: "frozen", frozenTickId: 1 } }, equipmentPoses: poses() };
  b.equipmentPoses[1].orientation.z = .6; b.equipmentPoses[1].orientation.w = .8;
  recorder.record(b);
  const data = recorder.snapshot();
  assert.equal(data.models.length, 2); assert.equal(data.configurations.length, 2); assert.equal(data.inputs.length, 2);
  assert.equal(data.rawPoses.length, 1); assert.equal(data.equipment.length, 2);
  assert.equal(data.inputs[1].latestEvidence.provenance, "frozen");
  assert.deepEqual(recordedEquipmentPair(data, 1), b.equipmentPoses);
  assert.equal(recordedEquipmentPair(data, -1), null);
});

test("copies numeric data immediately and exposes immutable stable snapshots", () => {
  const recorder = createPlayMovementRecorder(), f = frame(); recorder.record(f);
  const before = recorder.snapshot();
  f.input.anchors[0].x = 999; f.rawPose.landmarks[0].x = 999; f.equipmentPoses[0].anchor.x = 999;
  assert.equal(before.inputs[0].anchors[0].x, .25); assert.equal(before.rawPoses[0].landmarks[0].x, .7);
  assert.equal(recordedEquipmentPair(before, 0)[0].anchor.x, .5);
  assert.throws(() => { before.ticks.push([]); }, TypeError);
  assert.throws(() => { before.models[0].bounds.left = 100; }, TypeError);
  recorder.record({ ...frame(), timestampMs: 210 });
  assert.equal(before.ticks.length, 1, "later capture cannot mutate a downloaded view");
});

test("tick/byte limits stop observation explicitly without dropping earlier data", () => {
  const recorder = createPlayMovementRecorder({ maxTicks: 2 }), f = frame();
  assert.equal(recorder.record(f), true); assert.equal(recorder.record({ ...f, timestampMs: 110 }), true);
  assert.doesNotThrow(() => recorder.record({ ...f, timestampMs: 120 })); recorder.finish("completed");
  const data = recorder.snapshot(); assert.equal(data.status, "truncated"); assert.equal(data.reason, "recording_limit");
  assert.equal(data.complete, false); assert.equal(data.finalSessionState, "completed"); assert.equal(data.ticks.length, 2);
  const small = createPlayMovementRecorder({ maxBytes: 2100, metadata: { large: "x".repeat(1000) } });
  assert.equal(small.snapshot().status, "truncated"); assert(small.getStatus().estimatedBytes <= 2100);
});

test("capture failures are explicit and never escape into gameplay", () => {
  const recorder = createPlayMovementRecorder(), f = frame();
  f.getCalibrationModel = () => { throw new Error("observer read failed"); };
  assert.doesNotThrow(() => recorder.record(f));
  assert.equal(recorder.snapshot().status, "capture_error"); assert.equal(recorder.snapshot().complete, false);
  const raw = createPlayMovementRecorder(), bad = frame(); bad.rawPose.landmarks[0].x = NaN;
  assert.doesNotThrow(() => raw.observe(bad)); assert.equal(raw.snapshot().status, "capture_error");
});
