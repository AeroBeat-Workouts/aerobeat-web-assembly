// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { createPlayMovementRecorder, recordedEquipmentPair } from "../src/play-movement-recording.js";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { buildAbJudgementCapture } from "../src/ab-judgement-capture.js";

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

// Execute the owning lifecycle and display-loop methods, not a parallel capture
// implementation. Device/render services are fixtures; this is source-only proof.
const assemblySource = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const lifecycleSource = assemblySource.slice(assemblySource.indexOf("  beginPlayMovementRecording(graph) {"), assemblySource.indexOf("  stopFrameLoop() {"));
function lifecycleFixture(initialState = "calibrating") {
  let now = 0, input = frame().input, raw = frame().rawPose, model = { calibrationId: "initial" }, modelReads = 0;
  let session = { state: initialState, purpose: "play", timestampMs: 0 }, safety = { ready: false };
  const listeners = new Set(), advances = [];
  input = { ...input, calibration: { state: "calibrating", readiness: "not_ready" }, calibrationChecklist: { measuredAt: raw.timestampMs } };
  const surface = { sourceAspectRatio: 1.5, intrinsicWidth: 640, intrinsicHeight: 480, mirrored: true };
  const graph = {
    video: { describeSurface: () => surface },
    cv: { getLatestPoseFrame: () => raw, getStatus: () => ({ running: true }) },
    input: {
      getSnapshot: () => input,
      getCalibrationModel: () => { modelReads++; return model; },
      subscribe: listener => { listeners.add(listener); listener(input); return () => listeners.delete(listener); },
      processPoseSample: () => { for (const listener of listeners) listener(input); },
      advanceTime: () => { for (const listener of listeners) listener(input); },
      setMidGameRecalibrationEnabled: () => {}
    },
    content: { getSnapshot: () => ({}) },
    audio: { getClockSnapshot: () => ({ contextTimeSeconds: now / 1000, positionSeconds: 0, playing: false }), getStatus: () => ({ state: "paused" }) },
    gameplay: {
      getSnapshot: () => ({ session, safety }),
      advance: value => { advances.push({ ...value, state: session.state }); safety = { ready: input.calibration.readiness === "ready" }; session = { ...session, timestampMs: value.timestampMs }; },
      requestStart: () => { if (safety.ready) session = { ...session, state: "countdown" }; }
    }
  };
  const Owner = runInNewContext(`(class { ${lifecycleSource} })`, {
    createPlayMovementRecorder, buildAbJudgementCapture,
    appMetadata: { packageVersion: "test", buildStamp: "test" },
    getGameSetupSnapshot: () => ({}), performance: { now: () => now },
    audioClockAlignedWithGameplay: () => true,
    createFrameSplineEquipmentProjector: () => null,
    cameraPerformanceFormat: () => ({}), currentDpr: () => 1
  });
  const owner = new Owner();
  Object.assign(owner, {
    graph, sessionGeneration: 1, playMovementRecordingSessionGeneration: -1, playMovementRecorder: null,
    desiredGameSetup: { kneeStrikesEnabled: false }, activeSessionSetup: { timingWindowMs: 180 },
    activeGameplayConfiguration: { chart: { id: "unchanged" } }, equipmentConfig: { scale: 1 }, equipmentConfigIdentity: identity,
    kneePadRotationTuning: {}, lastCameraIdentity: "camera", lastKnownShoulderPivot: {}, lastValidEquipmentPoses: [],
    latestPoseTimestampMs: -1, lastFreshPoseAtMs: -Infinity, lastInputAdvanceAtMs: -Infinity, lastContentSyncAtMs: 0,
    freshPoseConsumptionCount: 0, inputAdvanceCount: 0, displayFrameCount: 0,
    sessionStartRequested: true, privatePerformance: { record: () => {} }, container: { devicePixelRatio: 1 },
    videoElement: () => ({}), rendererFrame: () => ({ nowMs: now }), resolveEquipmentPoses: () => [],
    equipmentModeForSession: () => null, leaseSnapshotForGameplay: () => ({}),
    handleError: error => { throw error; }
  });
  for (const name of ["syncKneeCalibrationRequirement", "updateCameraIdentity", "syncAudioForGameplay", "syncContentPlayback", "observeEnvironmentLoad", "syncCameraPresentation", "renderGameplay", "syncDebugCameraControlState", "renderVisualTestTransport", "syncAbDownloadButton", "renderRuntimePresentation", "reconcileTerminalServices"]) owner[name] = () => {};
  return {
    owner, graph, advances, listeners,
    get modelReads() { return modelReads; },
    get input() { return input; }, get raw() { return raw; }, get model() { return model; },
    setState: state => { session = { ...session, state }; },
    sample(calibrated = false) {
      now += 7;
      input = { ...input, calibration: { state: calibrated ? "calibrated" : "calibrating", readiness: calibrated ? "ready" : "not_ready", calibrationId: calibrated ? "cal-1" : null }, calibrationChecklist: { measuredAt: now } };
      raw = { ...raw, timestampMs: now };
      model = { calibrationId: input.calibration.calibrationId, bounds: { left: .123, right: .987 }, timestampMs: now };
    },
    display() { owner.runDisplayFrame(graph); },
    emit() { for (const listener of listeners) listener(input); }
  };
}

test("initial calibration waiting allocates no run budget; first countdown snapshots exact current data", () => {
  const f = lifecycleFixture(); f.owner.beginPlayMovementRecording(f.graph);
  for (let i = 0; i < 41902; i++) { f.sample(); f.display(); }
  assert.equal(f.advances.length, 41902, "waiting still advances gameplay normally");
  assert.equal(f.owner.playMovementRecorder, null, "no metadata, input, raw pose or tick allocation during initial waiting");
  assert.equal(f.modelReads, 0);
  f.sample(true); f.display();
  const data = f.owner.playMovementRecorder.snapshot();
  assert.equal(f.graph.gameplay.getSnapshot().session.state, "countdown");
  assert.equal(data.ticks.length, 0, "requestStart is not an advance; earlier calibrating advance is outside capture");
  assert.deepEqual(data.inputs, [f.input]);
  assert.deepEqual(data.rawPoses, [f.raw]);
  assert.deepEqual(data.models, [f.model]);
  assert.deepEqual(data.metadata.initialCalibrationModel, f.model);
  assert.deepEqual(data.configurations[0].setup, f.owner.activeSessionSetup);
  assert.deepEqual(data.configurations[0].gameplay, f.owner.activeGameplayConfiguration);
  assert.deepEqual(data.configurations[0].presentationSetup, f.owner.desiredGameSetup);
  assert.deepEqual(data.configurations[0].equipment, f.owner.equipmentConfig);
  assert.equal(data.configurations[0].camera.intrinsicWidth, 640);
  const boundaryAdvanceCount = f.advances.length;
  for (const state of ["countdown", "playing", "paused_manual", "paused_tracking", "calibrating", "countdown", "playing"]) {
    f.setState(state); f.sample(state !== "calibrating");
    f.emit(); // Input observed even when media alignment skips a gameplay advance.
    f.display();
  }
  const after = f.owner.playMovementRecorder.snapshot();
  const retained = f.advances.slice(boundaryAdvanceCount);
  assert.equal(after.ticks.length, retained.length);
  assert.deepEqual(after.ticks.map(row => row[0]), retained.map(value => value.timestampMs));
  assert.deepEqual(after.ticks.map(row => after.states[row[10]]), retained.map(value => value.state));
  assert.equal(after.inputs.length, 8); assert.equal(after.rawPoses.length, 8);
  assert(after.models.some(value => value.calibrationId === null), "later recalibration is retained, not filtered");
  f.setState("completed"); f.display();
  assert.equal(f.owner.playMovementRecorder.snapshot().complete, true);
  assert.equal(f.listeners.size, 0);
});

test("ready start, stop, reset and restart preserve generation-scoped recording ownership", () => {
  const f = lifecycleFixture("countdown"); f.sample(true);
  f.owner.beginPlayMovementRecording(f.graph);
  const first = f.owner.playMovementRecorder;
  assert.equal(first.snapshot().inputs.length, 1, "already-ready Play captures immediately without waiting for another pose");
  f.display(); assert.equal(first.snapshot().ticks.length, 1);
  f.owner.endPlayMovementRecording("stopped");
  f.sample(true); f.emit(); f.display();
  assert.equal(first.snapshot().status, "stopped"); assert.equal(first.snapshot().ticks.length, 1);
  f.owner.sessionGeneration++; f.setState("calibrating");
  f.owner.beginPlayMovementRecording(f.graph);
  assert.equal(f.owner.playMovementRecorder, null); assert.equal(f.listeners.size, 1);
  f.owner.endPlayMovementRecording("stopped");
  f.setState("countdown"); f.sample(true); f.display();
  assert.equal(f.owner.playMovementRecorder, null, "stopping an armed wait must disarm lazy capture");
  f.owner.beginPlayMovementRecording(f.graph);
  const restarted = f.owner.playMovementRecorder;
  assert.notEqual(restarted, first); assert.equal(restarted.snapshot().ticks.length, 0);
  f.owner.sessionGeneration++; // Reset invalidates old callbacks and ticks.
  f.sample(true); f.emit(); f.display();
  assert.equal(restarted.snapshot().inputs.length, 1); assert.equal(restarted.snapshot().ticks.length, 0);
  f.owner.endPlayMovementRecording("stopped");
  assert.equal(f.listeners.size, 0);
});
