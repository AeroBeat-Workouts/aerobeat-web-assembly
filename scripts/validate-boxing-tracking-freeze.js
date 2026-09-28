// @ts-check
// Bead 7aew: feed real calibrated input through both production collider rulesets.
import assert from "node:assert/strict";
import { createAeroBodyGridService } from "@aerobeat/web-input";
import { createAeroGameplaySessionCoordinator } from "@aerobeat/web-gameplay";
import { gameplayEquipmentRecords } from "../src/gameplay-equipment-records.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

const names = ["nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist"];
const identity = { schema: "aerobeat/equipment_config_identity", version: 1, algorithm: "sha256", value: "b".repeat(64) };
const hash = { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "a".repeat(64) };
const profileIdentity = { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "default", profileVersion: "1", contentHash: "a".repeat(64), class: "between_run_ruleset", regenerationRequired: false };
const flowQuaternionTargets = { left: { orientation: { x: 0, y: 0, z: 0, w: 1 } }, right: { orientation: { x: 0, y: 0, z: 0, w: 1 } } };
const boxingStateOrientations = { left: { x: 0, y: 0, z: 0, w: 1 }, right: { x: 0, y: 0, z: 0, w: 1 } };
const tPose = {
  nose: { x: .5, y: .3 }, left_shoulder: { x: .6, y: .4 }, right_shoulder: { x: .4, y: .4 },
  left_elbow: { x: .7, y: .4 }, right_elbow: { x: .3, y: .4 }, left_wrist: { x: .8, y: .4 }, right_wrist: { x: .2, y: .4 }
};
const released = { ...tPose, left_elbow: { x: .61, y: .52 }, right_elbow: { x: .39, y: .52 }, left_wrist: { x: .56, y: .55 }, right_wrist: { x: .44, y: .55 } };
function pose(at, points = released, confidence = 1) {
  return { sourceId: "camera", timestampMs: at, mirrored: true, landmarks: names.map((name) => ({ name, ...points[name], confidence: name === "right_wrist" ? confidence : 1 })) };
}
function clock(ms, playing) { return { contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, playing }; }

for (const [mode, rulesetId] of [["flow", "flow_colliders_v1"], ["boxing", "boxing_collider_v1"]]) {
  const input = createAeroBodyGridService({ calibrationIdPrefix: `7aew-${mode}` });
  const coordinator = createAeroGameplaySessionCoordinator({ sessionId: `7aew-${mode}`, countdownStepMs: 1 });
  const selectedVariant = { variantId: "variant", chartId: "chart", mode, rulesetId, recipeId: mode === "flow" ? null : "row_family_balanced_height_v1", modifierIds: [], ranked: false, mapHash: hash, scoreIdentityHash: hash, provenance: { baseVariantId: "variant" } };
  coordinator.configureContent({ packageId: "song", selectedVariant, resolvedEvents: [], profileIdentity });
  for (let at = 0; at <= 2250; at += 250) input.processPoseSample(pose(at, tPose));
  for (let at = 2500; at <= 6250; at += 250) input.processPoseSample(pose(at));
  assert.equal(input.getSnapshot().calibration.readiness, "countdown", `${mode}: calibrated readiness`);
  coordinator.advance({ timestampMs: 6250, clock: clock(0, false), input: input.getSnapshot() });
  assert.equal(coordinator.requestStart(6250).accepted, true);
  for (const at of [6251, 6252, 6253]) coordinator.advance({ timestampMs: at, clock: clock(0, false), input: input.getSnapshot() });
  assert.equal(coordinator.getSnapshot().session.state, "playing", `${mode}: started`);
  input.setMidGameRecalibrationEnabled(false);
  // A fresh measured wrist precedes the low-confidence frame, whose 800 ms
  // measured gap trips the freeze immediately; subsequent no-frame ticks hold it.
  input.processPoseSample(pose(6400));
  const heldAnchors = input.getSnapshot().anchors;
  const calibrationId = input.getSnapshot().calibration.calibrationId;

  for (const at of [6450, 7200, 7450, 7700, 7950]) {
    const current = at === 6450 ? input.getSnapshot() : at === 7200 ? input.processPoseSample(pose(at, released, .2)) : input.advanceTime(at);
    const before = coordinator.getSnapshot().session;
    const songMs = at - 6250;
    const equipmentPoses = gameplayEquipmentRecords(false, { ...before, timestampMs: at }, current, mode, boxingStateOrientations, flowQuaternionTargets, equipmentConfigDefaults, identity);
    if (current.tracking.anchorsFrozen) assert.equal(equipmentPoses.length, 2, `${mode}: frozen equipment remains visible at ${at}`);
    coordinator.advance({ timestampMs: at, clock: clock(songMs, true), input: current, equipmentPoses });
    assert.equal(coordinator.getSnapshot().session.state, "playing", `${mode}: never tracking-pauses at ${at}`);
    assert.equal(coordinator.getSnapshot().session.timelinePositionMs, songMs, `${mode}: gameplay follows audio at ${at}`);
    if (at >= 7200) {
      assert.equal(current.tracking.anchorsFrozen, true, `${mode}: tracking freeze`);
      assert.equal(current.latestEvidence?.provenance, "frozen", `${mode}: frozen evidence`);
      assert.deepEqual(current.anchors, heldAnchors, `${mode}: markers retain their last positions`);
      assert.equal(current.calibration.calibrationId, calibrationId, `${mode}: calibration retained`);
    }
  }
  const recovered = input.processPoseSample(pose(8250));
  const poses = gameplayEquipmentRecords(false, { ...coordinator.getSnapshot().session, timestampMs: 8250 }, recovered, mode, boxingStateOrientations, flowQuaternionTargets, equipmentConfigDefaults, identity);
  coordinator.advance({ timestampMs: 8250, clock: clock(2000, true), input: recovered, equipmentPoses: poses });
  assert.equal(recovered.tracking.anchorsFrozen, false, `${mode}: recovers on first good frame`);
  assert.equal(coordinator.getSnapshot().session.state, "playing", `${mode}: never requires restart`);
  assert.equal(coordinator.getSnapshot().session.timelinePositionMs, 2000, `${mode}: no timeline jump on recovery`);
  input.destroy(); coordinator.destroy();
}
console.log("Boxing and Flow calibrated tracking freeze: markers held, session playing, audio-authoritative timeline continuous.");
