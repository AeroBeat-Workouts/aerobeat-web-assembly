// @ts-check
import test from "node:test";
import { createUnitMovementStore, legacyUnitMovement, streamUnitFile } from "./movement-store-unit-fixture.js";
import assert from "node:assert/strict";
import { createAeroBodyGridService } from "@aerobeat/web-input";
import { createAeroGameplaySessionCoordinator, defaultFlowColliderSettings } from "@aerobeat/web-gameplay";
import { createResolvedEquipmentPose } from "@aerobeat/web-contracts";
import { sha256Hex } from "@aerobeat/web-hash";
import { buildAbJudgementCapture } from "../src/ab-judgement-capture.js";
import { createPlayMovementRecorder, recordedEquipmentPair } from "../src/play-movement-recording.js";
import { parsePlayMovementCapture, parsePlayMovementFile } from "../src/play-movement-replay.js";
import { prepareRecordedTest, createRecordedTestPlayback } from "../src/recorded-test-source.js";
import { defaultAeroGameSetupSnapshot, getGameSetupSnapshot } from "../src/game-setup-coordinator.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";
import { canonicalEquipmentConfigIdentityInput } from "../src/equipment-config.js";
import { createFrameSplineEquipmentProjector, reprojectSplineEquipmentPose } from "../src/spline-equipment-projection.js";

const clock = (ms, playing = true) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, playing, durationSeconds: 3 });
const lease = { schema: "aerobeat/media_lease_snapshot", version: 1, ownerInstanceId: "recorded-test", generation: 1, state: "owned", resources: ["audio"] };
async function fixture(kind = "late") {
  const modelInput = createAeroBodyGridService({ calibrationIdPrefix: "original-calibration" });
  const rawPoints = { nose: [.5, .3], left_shoulder: [.6, .4], right_shoulder: [.4, .4], left_elbow: [.7, .4], right_elbow: [.3, .4], left_wrist: [.8, .4], right_wrist: [.2, .4] };
  for (let t = 0; t <= 2000; t += 250) modelInput.processPoseSample({ sourceId: "original-camera", timestampMs: t, mirrored: true, landmarks: Object.entries(rawPoints).map(([name, [x, y]]) => ({ name, x, y, confidence: .95 })) });
  const model = modelInput.getCalibrationModel(), hash = "a".repeat(64);
  const equipmentIdentity = { schema: "aerobeat/equipment_config_identity", version: 1, algorithm: "sha256", value: await sha256Hex(canonicalEquipmentConfigIdentityInput(equipmentConfigDefaults)) };
  const selectedVariant = { variantId: "fixture-flow", chartId: "fixture-chart", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: true, localOnly: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { kind: "imported" } };
  const resolvedEvents = [{ schema: "aerobeat/resolved_content_event", version: 3, eventId: "fixture-note", centerTimestampMs: 1000, sourceEventIds: ["source"], variantId: selectedVariant.variantId, chartId: selectedVariant.chartId, type: "note", hand: "left", placement: 5, ...(kind === "reverse" ? { direction: "up" } : {}) }];
  const configuration = { packageId: "fixture-song", selectedVariant, resolvedEvents, flowColliderSettings: defaultFlowColliderSettings };
  const content = { ...configuration, state: "ready", song: { songName: "Numeric Test fixture" } };
  const binding = { gameplay: configuration, setup: defaultAeroGameSetupSnapshot, presentationSetup: defaultAeroGameSetupSnapshot, equipment: equipmentConfigDefaults, equipmentIdentity, kneePadRotations: { lowered: { x: 0, y: 0, z: 0 }, raised: { x: 0, y: 0, z: 0 } } };
  const pivots = { left: { x: .25, y: .5 }, right: { x: .75, y: .5 } };
  const play = createAeroGameplaySessionCoordinator({ countdownStepMs: 1, reprojectEquipmentPose: value => reprojectSplineEquipmentPose(value, equipmentConfigDefaults, pivots) });
  play.configureContent(configuration);
  const initialInput = { schema: "aerobeat/body_grid_service_snapshot", version: 1, timestampMs: 0, anchors: [], entries: [], sourceIdentity: "original-camera-source", calibration: { calibrationId: model.calibrationId, readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: null, straightQualifications: [] };
  play.advance({ timestampMs: 0, clock: clock(0, false), input: initialInput }); play.requestStart(0);
  for (const t of [1, 2, 3]) play.advance({ timestampMs: t, clock: clock(0, false) });
  const unitStore = createUnitMovementStore();
  const recorder = createPlayMovementRecorder({ store: unitStore.store, metadata: { capture: buildAbJudgementCapture({ gameplay: { session: { purpose: "play", state: "calibrating" } }, content, capturedAtMs: 0 }), configuration, equipment: equipmentConfigDefaults, equipmentIdentity, initialCalibrationModel: model } });
  for (let song = 900; song <= 2100; song += 50) {
    const wall = 10000 + song, x = kind === "none" || song < 1250 ? 3.5 : 1, y = kind === "reverse" ? 1.15 - Math.min(400, song - 900) / 1000 : 1;
    const anchor = (name, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: model.calibrationId, measurementTimestampMs: wall, valid: true, confidence: .95, rawX: .5, rawY: .5, x: (sx + .5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
    const anchors = [anchor("nose", 2, 2), anchor("left_shoulder", .5, 1), anchor("right_shoulder", 2.5, 1), anchor("left_elbow", .5, 1), anchor("right_elbow", 2.5, 1), anchor("left_wrist", x, y), anchor("right_wrist", 3.5, 1)];
    const evidence = { schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: model.calibrationId, measuredSourceFrameId: `original-frame-${song}`, measurementTimestampMs: wall, provenance: "measured", activeBoxingActions: [], anchors, entries: [] };
    const input = { ...initialInput, timestampMs: wall, anchors, latestEvidence: evidence, calibratedShoulderWorldY: 1 };
    const poses = ["left_wrist", "right_wrist"].map(role => { const a = anchors.find(value => value.anchor === role); return reprojectSplineEquipmentPose(createResolvedEquipmentPose({ role, mode: "flow", anchor: { x: a.x * 4 - .5, y: 2.5 - a.y * 3, z: 0 }, scale: 2, orientation: { x: 0, y: 0, z: 0, w: 1 }, geometryIdentity: "aerobeat/saber_capsule_v1", configIdentity: equipmentIdentity }), equipmentConfigDefaults, pivots); });
    const frame = { timestampMs: wall, clock: clock(song), input, equipmentPoses: poses };
    // Also record observations with no scoring advance. These markers must not
    // be dropped or converted into additional coordinator measurements.
    const rawPose = { sourceId: "original-camera", timestampMs: wall, mirrored: true, landmarks: Object.entries(rawPoints).map(([name, [x, y]]) => ({ name, x, y, confidence: .95 })) };
    const observation = { ...frame, rawPose, modelKey: [model.calibrationId], getCalibrationModel: () => model, configurationKey: ["run"], getConfiguration: () => binding, sessionState: "playing", renderTimelineMs: song };
    recorder.observe({ ...observation, timestampMs: wall - .25 });
    play.advance(frame);
    recorder.record(observation);
  }
  recorder.finish("completed");
  const expected = play.getJudgements();
  const capture = parsePlayMovementCapture(JSON.stringify(buildAbJudgementCapture({ gameplay: { session: { purpose: "play", state: "completed" }, judgements: expected }, content, movement: legacyUnitMovement(recorder, unitStore), capturedAtMs: 0 })));
  modelInput.destroy(); play.destroy();
  return { capture, content, expected };
}
test("Clear aborts post-import preparation before scanning further disk rows", async () => {
  const { capture, content } = await fixture();
  const controller = new AbortController(), reads = [];
  const disk = { ...capture,
    getCounts: () => Object.fromEntries(Object.entries(capture.movement).filter(([, value]) => Array.isArray(value)).map(([name, value]) => [name, value.length])),
    async readRows(table, start, count) {
      reads.push(table);
      if (table === "ticks") controller.abort(new DOMException("Cleared", "AbortError"));
      return capture.movement[table].slice(start, start + count);
    }
  };
  await assert.rejects(prepareRecordedTest(disk, content, { signal: controller.signal }), { name: "AbortError" });
  assert.deepEqual(reads, ["configurations", "ticks"], "no endpoint scan or additional rows after Clear");
});

function playback(prepared) {
  let projector, current;
  const gameplay = createAeroGameplaySessionCoordinator({ instanceId: "recorded-test", reprojectEquipmentPose: value => projector ? projector(value) : value });
  const source = createRecordedTestPlayback(prepared, { gameplay, durationSeconds: 3, leaseSnapshot: () => lease, onFrame: value => { current = value; projector = createFrameSplineEquipmentProjector(value.binding.equipment, value.pivots); } });
  return { source, gameplay, frame: () => current };
}
const scoring = value => ({ eventId: value.eventId, result: value.result, tier: value.tier, timingOffsetMs: value.timingOffsetMs, diagnostics: value.diagnostics, committedTimelinePositionMs: value.committedTimelinePositionMs });

test("recorded live visuals and Boxing heights stay separate from locked colliders and global preferences", async () => {
  const { capture, content } = await fixture(), preferences = getGameSetupSnapshot();
  const changed = JSON.parse(JSON.stringify(capture));
  for (const configuration of changed.movement.configurations) {
    configuration.presentationSetup = { ...configuration.presentationSetup, noseMarkerVisible: false, noteScalePercent: 150, boxingHeightOffsets: { ...configuration.presentationSetup.boxingHeightOffsets, hook: .5 }, flowColliderVolume: { ...configuration.presentationSetup.flowColliderVolume, colliderScale: 2 } };
  }
  const prepared = await prepareRecordedTest(parsePlayMovementCapture(JSON.stringify(changed)), content), binding = prepared.bindings[0];
  assert.equal(binding.setup.noseMarkerVisible, true); assert.equal(binding.setup.noteScalePercent, 100); assert.equal(binding.setup.boxingHeightOffsets.hook, 0);
  assert.equal(binding.renderSetup.noseMarkerVisible, false); assert.equal(binding.renderSetup.noteScalePercent, 150); assert.equal(binding.renderSetup.boxingHeightOffsets.hook, .5);
  assert.equal(binding.presentationSetup.flowColliderVolume.colliderScale, 2);
  assert.equal(binding.renderSetup.flowColliderVolume.colliderScale, binding.setup.flowColliderVolume.colliderScale, "next-run collider changes must not enter the recorded run");
  let projector;
  const heights = [], native = createAeroGameplaySessionCoordinator({ instanceId: "recorded-test", reprojectEquipmentPose: value => projector ? projector(value) : value });
  const gameplay = Object.freeze({ ...native, setBoxingHeightTuning(value) { heights.push(value.offsets.hook); return native.setBoxingHeightTuning(value); } });
  const source = createRecordedTestPlayback(prepared, { gameplay, durationSeconds: 3, leaseSnapshot: () => lease, onFrame: frame => { projector = createFrameSplineEquipmentProjector(frame.binding.equipment, frame.pivots); } });
  source.start(50000); while (!source.getSnapshot().complete) await source.advance(100000, 32);
  assert.ok(heights.length > 0 && heights.every(value => value === .5), "real coordinator must receive the captured live height offset");
  assert.deepEqual(getGameSetupSnapshot(), preferences, "loading live overlays must not persist Play preferences");
  native.destroy();
});

test("real coordinator prefix playback matches recorded Play, preserves every tick/observation and locks local settings", async () => {
  const { capture, content, expected } = await fixture(), preferences = getGameSetupSnapshot();
  const prepared = await prepareRecordedTest(capture, content), { source, gameplay, frame } = playback(prepared);
  source.start(50000);
  let iterations = 0;
  while (!source.getSnapshot().complete) { const before = source.getSnapshot(); await source.advance(100000, 3); const after = source.getSnapshot(); assert.ok(after.index - before.index + after.observationIndex - before.observationIndex <= 3); assert.ok(++iterations < 100); }
  assert.deepEqual(gameplay.getJudgements().map(scoring), expected.map(scoring));
  assert.equal(gameplay.getSnapshot().session.purpose, "visual_test"); assert.equal(gameplay.getSnapshot().session.ranked, false);
  assert.equal(source.getSnapshot().index, capture.movement.ticks.length);
  assert.equal(source.getSnapshot().observationIndex, capture.movement.observations.length);
  assert.deepEqual(frame().equipmentPoses, recordedEquipmentPair(capture.movement, capture.movement.ticks[frame().index][5]), "original full equipment endpoints remain bit-exact");
  assert.equal(expected[0].result, "hit");
  assert.ok(expected[0].timingOffsetMs > 180, "fixture exercises recorded Play late eligibility");
  assert.ok(frame().input.sourceIdentity.startsWith("recorded-test:"));
  assert.notEqual(frame().input.calibration.calibrationId, capture.movement.models[0].calibrationId);
  assert.equal(frame().input.latestEvidence.calibrationId, frame().input.calibration.calibrationId);
  assert.equal(frame().input.latestEvidence.measurementTimestampMs, frame().timestampMs);
  assert.deepEqual(getGameSetupSnapshot(), preferences, "recorded settings never overwrite Play preferences");
  assert.deepEqual(prepared.bindings[0].equipment, equipmentConfigDefaults);
  assert.notEqual(frame().pivots.left.x, .5, "real shoulders, not pointer Test neutral pivot");
});

test("wall pacing drains all due samples, user pause is observational, seek rebuilds the real prefix", async () => {
  const { capture, content } = await fixture(); const { source, gameplay } = playback(await prepareRecordedTest(capture, content));
  source.start(100); await source.advance(100.25, 32);
  const early = source.getSnapshot().index;
  source.pause(100.25); await source.advance(100000, 32); assert.equal(source.getSnapshot().index, early);
  source.resume(200); await source.advance(220, 32); assert.equal(source.getSnapshot().index, early, "no invented samples across capture gap");
  while (!source.getSnapshot().complete) await source.advance(100000, 5);
  const expected = gameplay.getJudgements().map(scoring);
  source.seek(1500, 100001); while (source.getSnapshot().rebuilding) await source.advance(100002, 4);
  assert.equal(source.getSnapshot().playing, false);
  assert.equal(gameplay.getSnapshot().session.timelinePositionMs, 1500);
  source.resume(100010); while (!source.getSnapshot().complete) await source.advance(200000, 4);
  assert.deepEqual(gameplay.getJudgements().map(scoring), expected);
});

test("wrong-way and no-contact recordings stay negative through the same scorer", async () => {
  for (const kind of ["none", "reverse"]) {
    const { capture, content, expected } = await fixture(kind), { source, gameplay } = playback(await prepareRecordedTest(capture, content));
    source.start(0); while (!source.getSnapshot().complete) await source.advance(100000, 32);
    assert.deepEqual(gameplay.getJudgements().map(scoring), expected.map(scoring));
    assert.equal(gameplay.getJudgements()[0].result, "miss");
  }
});

test("frozen evidence keeps original held-frame equality and timestamps in a fresh Test namespace", async () => {
  const { capture, content } = await fixture(), value = JSON.parse(JSON.stringify(capture));
  const firstRef = value.movement.ticks[0][4], secondRef = value.movement.ticks[1][4];
  const held = JSON.parse(JSON.stringify(value.movement.inputs[firstRef]));
  held.timestampMs = value.movement.inputs[secondRef].timestampMs;
  held.tracking.anchorsFrozen = true;
  held.latestEvidence.provenance = "frozen"; held.latestEvidence.frozenTickId = 1;
  value.movement.inputs[secondRef] = held;
  const { source } = playback(await prepareRecordedTest(parsePlayMovementCapture(JSON.stringify(value)), content));
  source.start(0); await source.advance(.25, 32);
  const measured = source.getSnapshot().frame.input.latestEvidence;
  await source.advance(50.25, 32);
  const frozen = source.getSnapshot().frame.input.latestEvidence;
  assert.equal(frozen.provenance, "frozen"); assert.equal(frozen.frozenTickId, 1);
  assert.equal(frozen.measurementTimestampMs, measured.measurementTimestampMs);
  assert.equal(frozen.measuredSourceFrameId, measured.measuredSourceFrameId);
  assert.equal(frozen.calibrationId, measured.calibrationId);
  assert.ok(frozen.measuredSourceFrameId.startsWith("recorded-test:"));
});

test("external interruption recovers by bounded prefix reconstruction rather than relaxing continuity", async () => {
  const { capture, content } = await fixture(), { source, gameplay } = playback(await prepareRecordedTest(capture, content));
  source.start(0); await source.advance(400, 32);
  const count = source.getSnapshot().index;
  gameplay.pause(gameplay.getSnapshot().session.timestampMs, "media_lease_transferred");
  source.rebuild(count, 1000);
  while (source.getSnapshot().rebuilding) await source.advance(1001, 2);
  assert.equal(source.getSnapshot().playing, true);
  while (!source.getSnapshot().complete) await source.advance(100000, 8);
  assert.deepEqual(gameplay.getJudgements().map(scoring), capture.judgements.map(scoring));
});

test("matching selected content and validated equipment identity are mandatory", async () => {
  const { capture, content } = await fixture();
  await assert.rejects(prepareRecordedTest(capture, { ...content, packageId: "another-song" }), /matching downloaded song/);
  await assert.rejects(prepareRecordedTest(capture, { ...content, selectedVariant: { ...content.selectedVariant, chartId: "another-chart" } }), /chartId/);
  const changed = JSON.parse(JSON.stringify(capture)); changed.movement.configurations[0].equipment.flow.perHand.left.scale = 3;
  await assert.rejects(prepareRecordedTest(changed, content), /do not match their identity/);
  const unmatched = JSON.parse(JSON.stringify(capture)); unmatched.movement.ticks[0][8] = -1;
  await assert.rejects(prepareRecordedTest(unmatched, content), /endpoints do not match/);
  const events = JSON.parse(JSON.stringify(capture)); events.movement.configurations[0].gameplay.resolvedEvents = [{ eventId: "untrusted-file-event" }];
  const prepared = await prepareRecordedTest(events, content);
  assert.equal(prepared.bindings[0].configuration.resolvedEvents[0], content.resolvedEvents[0], "file events never replace matching content events");
});

test("disk facade uses the same coordinator, prefixes, endpoints and32-event batches as legacy", async () => {
  const { capture, content, expected } = await fixture(), { file } = await streamUnitFile(capture), unit = createUnitMovementStore();
  const imported = await parsePlayMovementFile(file, { createStore: () => unit.store });
  let maximumRead = 0;
  const facade = { ...imported, async readRows(table, start, count) { maximumRead = Math.max(maximumRead, count); return imported.readRows(table, start, count); } };
  const { source, gameplay, frame } = playback(await prepareRecordedTest(facade, content));
  source.start(1000);
  while (!source.getSnapshot().complete) { const before = source.getSnapshot(); await source.advance(100000, 1000); const after = source.getSnapshot(); assert.ok(after.index - before.index + after.observationIndex - before.observationIndex <= 32); }
  assert.deepEqual(gameplay.getJudgements().map(scoring), expected.map(scoring));
  assert.deepEqual(frame().equipmentPoses, recordedEquipmentPair(capture.movement, capture.movement.ticks[frame().index][5]));
  source.seek(1500, 100001); while (source.getSnapshot().rebuilding) await source.advance(100002);
  assert.equal(gameplay.getSnapshot().session.timelinePositionMs, 1500);
  source.resume(100010); while (!source.getSnapshot().complete) await source.advance(200000);
  assert.deepEqual(gameplay.getJudgements().map(scoring), expected.map(scoring));
  assert.ok(maximumRead <= 32); source.dispose(); await imported.dispose(); gameplay.destroy();
});

test("seek and dispose invalidate pending row reads; storage errors surface", async () => {
  const { capture, content } = await fixture();
  for (const command of ["seek", "dispose", "error"]) {
    const prepared = await prepareRecordedTest(capture, content);
    const realRows = prepared.rows; let release, requested;
    const waiting = new Promise(resolve => { requested = resolve; });
    const rows = { ...realRows, async get(table, index) { await new Promise(resolve => { release = resolve; requested(); }); if (command === "error") throw new Error("unit read failure"); return realRows.get(table, index); } };
    const { source, gameplay } = playback({ ...prepared, rows }); source.start(100);
    const advancing = source.advance(100000); await waiting;
    if (command === "seek") source.seek(1500, 200); else if (command === "dispose") source.dispose();
    const timestamp = gameplay.getSnapshot().session.timestampMs;
    // Only the first blocked read is relevant: stale advances check generation
    // before requesting any further rows after it settles.
    release();
    if (command === "error") await assert.rejects(advancing, /unit read failure/);
    else { await advancing; assert.equal(source.getSnapshot().index, 0); assert.equal(source.getSnapshot().frame, null); assert.equal(gameplay.getSnapshot().session.timestampMs, timestamp); }
    gameplay.destroy();
  }
});
