// @ts-check
// T1/B1.1: real measured low-confidence + no-frame loss, not a pose bridge.
import assert from "node:assert/strict";
import { createAeroBodyGridService } from "@aerobeat/web-input";
import { createAeroGameplaySessionCoordinator } from "@aerobeat/web-gameplay";
import { gameplayEquipmentRecords } from "../src/gameplay-equipment-records.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

const names = ["nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist"];
const identity = { schema: "aerobeat/equipment_config_identity", version: 1, algorithm: "sha256", value: "b".repeat(64) };
const hash = { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "a".repeat(64) };
const profileIdentity = { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "default", profileVersion: "1", contentHash: "a".repeat(64), class: "between_run_ruleset", regenerationRequired: false };
const flowTargets = { left: { orientation: { x: 0, y: 0, z: 0, w: 1 } }, right: { orientation: { x: 0, y: 0, z: 0, w: 1 } } };
const boxingOrientations = { left: { x: 0, y: 0, z: 0, w: 1 }, right: { x: 0, y: 0, z: 0, w: 1 } };
const tPose = { nose: { x: .5, y: .3 }, left_shoulder: { x: .6, y: .4 }, right_shoulder: { x: .4, y: .4 }, left_elbow: { x: .7, y: .4 }, right_elbow: { x: .3, y: .4 }, left_wrist: { x: .8, y: .4 }, right_wrist: { x: .2, y: .4 } };
const released = { ...tPose, left_elbow: { x: .61, y: .52 }, right_elbow: { x: .39, y: .52 }, left_wrist: { x: .56, y: .55 }, right_wrist: { x: .44, y: .55 } };
function pose(at, confidence = 1, points = released) {
  return { sourceId: "camera", timestampMs: at, mirrored: true, landmarks: names.map((name) => ({ name, ...points[name], confidence: name === "right_wrist" ? confidence : 1 })) };
}
function clock(songMs, playing) { return { contextTimeSeconds: songMs / 1000, positionSeconds: songMs / 1000, playing }; }

for (const [mode, rulesetId] of [["flow", "flow_colliders_v1"], ["boxing", "boxing_collider_v1"]]) {
  const input = createAeroBodyGridService({ calibrationIdPrefix: `t1-${mode}` });
  const coordinator = createAeroGameplaySessionCoordinator({ sessionId: `t1-${mode}`, countdownStepMs: 1 });
  const selectedVariant = { variantId: "variant", chartId: "chart", mode, rulesetId, recipeId: mode === "flow" ? null : "row_family_balanced_height_v1", modifierIds: [], ranked: false, mapHash: hash, scoreIdentityHash: hash, provenance: { baseVariantId: "variant" } };
  coordinator.configureContent({ packageId: "song", selectedVariant, resolvedEvents: [], profileIdentity });
  for (let at = 0; at <= 2250; at += 250) input.processPoseSample(pose(at, 1, tPose));
  for (let at = 2500; at <= 6250; at += 250) input.processPoseSample(pose(at));
  assert.equal(input.getSnapshot().calibration.readiness, "countdown", `${mode}: initial calibration`);
  coordinator.advance({ timestampMs: 6250, clock: clock(0, false), input: input.getSnapshot() });
  assert.equal(coordinator.requestStart(6250).accepted, true);
  for (const at of [6251, 6252, 6253]) coordinator.advance({ timestampMs: at, clock: clock(0, false), input: input.getSnapshot() });
  assert.equal(coordinator.getSnapshot().session.state, "playing", `${mode}: started`);
  input.setMidGameRecalibrationEnabled(false);
  const held = input.processPoseSample(pose(6400));
  const heldAnchors = held.anchors;
  const calibrationId = held.calibration.calibrationId;
  let previousSongMs = -1;
  let sawRealLossLatch = false;
  const step = (at, snapshot, label) => {
    const songMs = at - 6250;
    const session = coordinator.getSnapshot().session;
    const equipmentPoses = gameplayEquipmentRecords(false, { ...session, timestampMs: at }, snapshot, mode, boxingOrientations, flowTargets, equipmentConfigDefaults, identity);
    assert.equal(equipmentPoses.length, 2, `${mode} ${label}: held equipment stays visible`);
    coordinator.advance({ timestampMs: at, clock: clock(songMs, true), input: snapshot, equipmentPoses });
    const result = coordinator.getSnapshot().session;
    assert.equal(result.state, "playing", `${mode} ${label}: never pauses`);
    assert.equal(result.timelinePositionMs, songMs, `${mode} ${label}: follows audio clock without seeking`);
    assert.ok(result.timelinePositionMs > previousSongMs, `${mode} ${label}: beats continue`);
    previousSongMs = songMs;
  };
  step(6400, held, "last good frame");
  // Real measured failure *before* hysteresis is the seam the old e2e skipped.
  for (const at of [6500, 6750, 7000, 7250]) {
    const snapshot = input.processPoseSample(pose(at, .2));
    assert.equal(snapshot.calibration.calibrationId, calibrationId, `${mode}: calibration retained`);
    assert.equal(snapshot.calibration.bounds === null, false, `${mode}: bounds retained`);
    assert.equal(snapshot.tracking.gameplayPaused, false, `${mode}: input never pauses`);
    assert.equal(snapshot.tracking.freshCalibrationRequired, false, `${mode}: no recalibration`);
    assert.equal(snapshot.tracking.anchorsFrozen, at === 7250, `${mode}: loss latch only after hysteresis`);
    assert.equal(snapshot.latestEvidence?.provenance, "frozen", `${mode}: held evidence is live`);
    assert.deepEqual(snapshot.anchors, heldAnchors, `${mode}: markers held`);
    sawRealLossLatch ||= snapshot.tracking.anchorsFrozen;
    step(at, snapshot, `low-confidence frame ${at}`);
  }
  assert.equal(sawRealLossLatch, true, `${mode}: actual loss gate latched`);
  for (const at of [7500, 7750]) {
    const snapshot = input.advanceTime(at);
    assert.equal(snapshot.tracking.anchorsFrozen, true, `${mode}: no-frame loss stays frozen`);
    assert.equal(snapshot.latestEvidence?.provenance, "frozen", `${mode}: no-frame evidence held`);
    step(at, snapshot, `no-frame tick ${at}`);
  }
  const recovered = input.processPoseSample(pose(8000));
  assert.equal(recovered.tracking.anchorsFrozen, false, `${mode}: first passing frame restores tracking`);
  step(8000, recovered, "recovery");
  assert.equal(coordinator.getSnapshot().session.timelinePositionMs - previousSongMs, 0, `${mode}: no post-recovery jump`);
  input.destroy(); coordinator.destroy();
}
console.log("T1 real Flow/Boxing tracking loss: pre-latch hold, hysteresis latch, no-frame freeze, live beat timeline and no recovery seek passed.");
