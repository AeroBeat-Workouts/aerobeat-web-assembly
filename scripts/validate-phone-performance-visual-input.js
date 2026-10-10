// @ts-check
// Synthetic deterministic measured-pose fixture only; NOT a physical camera test.
import assert from "node:assert/strict";
import { sha256Hex } from "@aerobeat/web-hash";
import { equipmentEulerDegreesToQuaternion, multiplyEquipmentQuaternions } from "@aerobeat/web-contracts";
import { canonicalEquipmentConfigIdentityInput } from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";
import { squareRadialSaberTarget } from "../src/saber-zone-direction.js";
import { createPhoneTrackingVisuals } from "../src/phone-performance-visual-input.js";

const names = ["nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist"];
const tPose = { nose: [.5,.3], left_shoulder: [.6,.4], right_shoulder: [.4,.4], left_elbow: [.7,.4], right_elbow: [.3,.4], left_wrist: [.8,.4], right_wrist: [.2,.4] };
const released = { ...tPose, left_elbow: [.61,.52], right_elbow: [.39,.52], left_wrist: [.56,.55], right_wrist: [.44,.55] };
const context = { sourceAspectRatio: 16/9, sourceChangeId: "camera-epoch-a" };
function pose(timestampMs, points = released, sourceId = "camera-a", mirrored = true, confidence = {}) {
  return { sourceId, timestampMs, mirrored, landmarks: names.map((name) => ({ name, x: points[name][0], y: points[name][1], confidence: confidence[name] ?? .95 })) };
}
function noPrivateReportData(value) {
  assert.deepEqual(Object.keys(value).sort(), ["calibrationReady", "measuredFrameCount", "visiblePoseFrameCount"]);
  assert.equal(typeof value.calibrationReady, "boolean");
  for (const key of ["measuredFrameCount", "visiblePoseFrameCount"]) assert.ok(Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 1_000_000_000);
  assert.doesNotMatch(JSON.stringify(value), /landmarks|anchors|calibrationId|sourceId|equipment|confidence|\"x\"|\"y\"/);
}
const visuals = await createPhoneTrackingVisuals();
assert.deepEqual(Object.keys(visuals).sort(), ["destroy", "frame", "processPose", "snapshot"]);
assert.equal(visuals.frame(0).equipment.length, 0, "no silent synthetic calibration or wrists");
assert.equal(visuals.snapshot().calibrationReady, false);
visuals.processPose(pose(0, tPose), context);
visuals.processPose(pose(250, tPose), context);
assert.equal(visuals.frame(250).equipment.length, 0, "short T-pose does not calibrate");
for (let at = 500; at <= 2250; at += 250) visuals.processPose(pose(at, tPose), context);
assert.equal(visuals.snapshot().calibrationReady, true, "real body-grid two-second held T-pose commits");
const hold = visuals.frame(2250);
assert.equal(hold.equipment.length, 2, "calibrated measured wrists render using the play gate");
const expectedHash = await sha256Hex(canonicalEquipmentConfigIdentityInput(equipmentConfigDefaults));
for (const equipment of hold.equipment) {
  assert.equal(equipment.mode, "flow");
  assert.equal(equipment.configIdentity.value, expectedHash, "canonical v4 SHA-256 identity");
}
assert.equal(hold.cursors.length, 1, "calibrated in-bounds nose is staged");
visuals.processPose(pose(2500, released), context);
const tracked = visuals.frame(2500);
assert.equal(tracked.trackingReady, true);
assert.equal(tracked.equipment.length, 2);
const left = tracked.equipment.find((item) => item.role === "left_wrist");
assert.ok(left);
assert.ok(Number.isFinite(left.anchor.x) && Number.isFinite(left.anchor.y), "real calibrated anchor geometry");
// Counterfactual: the shoulder-centered Flow field must differ from an
// otherwise identical screen-centered projection at a deliberately offset wrist.
const offset = { ...released, left_wrist: [.75,.55] };
visuals.processPose(pose(2550, offset), context);
const shifted = visuals.frame(2550).equipment.find((item) => item.role === "left_wrist");
assert.ok(shifted);
const wristX = (0.8 - .75) / .6;
const wristY = .55 / .8;
const shoulderX = (0.8 - .6) / .6;
const field = equipmentConfigDefaults.flow.saber;
const shoulderTarget = squareRadialSaberTarget(wristX, 1 - wristY, field.zones, field.blendRadius, { x: shoulderX, y: .5 });
const screenTarget = squareRadialSaberTarget(wristX, 1 - wristY, field.zones, field.blendRadius);
assert.notDeepEqual(shoulderTarget.orientation, screenTarget.orientation, "fixture discriminates shoulder from screen pivot");
const expectedOrientation = multiplyEquipmentQuaternions(equipmentEulerDegreesToQuaternion(equipmentConfigDefaults.flow.perHand.left.rotationEulerDeg), shoulderTarget.orientation);
for (const key of ["x", "y", "z", "w"]) assert.ok(Math.abs(shifted.orientation[key] - expectedOrientation[key]) < 1e-9, `left saber shoulder orientation ${key}`);
assert.equal(shifted.configIdentity.value, expectedHash);
const second = visuals.frame(2520);
assert.equal(second.equipment.length, 2, "display cadence renders held measured frame without inventing another pose");
assert.equal(visuals.snapshot().measuredFrameCount, 12);
assert.ok(visuals.snapshot().visiblePoseFrameCount >= 2);
noPrivateReportData(visuals.snapshot());

const lost = { ...released, nose: [.1,.3] };
visuals.processPose(pose(2600, lost, "camera-a", true, { left_wrist: .2 }), context);
assert.equal(visuals.frame(2600).equipment.length, 2, "provisional real tracking loss holds last measured equipment");
for (const at of [2850, 3100, 3350]) visuals.processPose(pose(at, lost, "camera-a", true, { left_wrist: .2 }), context);
const frozen = visuals.frame(3350);
assert.equal(frozen.equipment.length, 2, "hysteresis freezes real calibrated evidence");
assert.equal(frozen.cursors.length, 1, "held nose remains from the last valid measured frame");
visuals.processPose(pose(3450, released), context);
assert.equal(visuals.frame(3450).equipment.length, 2, "good frame releases freeze without synthetic wrist");
visuals.frame(4600);
assert.equal(visuals.frame(4600).equipment.length, 2, "no-frame advance preserves real frozen pose");
const beforeEpoch = visuals.snapshot().measuredFrameCount;
visuals.processPose(pose(4700, released), { ...context, sourceChangeId: "camera-epoch-b" });
const epoch = visuals.frame(4700);
assert.equal(epoch.calibrationReady, false, "camera epoch invalidates T-pose");
assert.equal(epoch.equipment.length, 0);
assert.equal(epoch.cursors.length, 0);
assert.equal(visuals.snapshot().measuredFrameCount, beforeEpoch + 1);
for (let at = 4950; at <= 7200; at += 250) visuals.processPose(pose(at, tPose), { ...context, sourceChangeId: "camera-epoch-b" });
assert.equal(visuals.frame(7200).equipment.length, 2, "new epoch requires real fresh T-pose");
visuals.processPose(pose(7300, released, "camera-b"), { ...context, sourceChangeId: "camera-epoch-b" });
assert.equal(visuals.frame(7300).equipment.length, 0, "pose source identity also invalidates calibration");
visuals.destroy();
assert.equal(visuals.snapshot().calibrationReady, false);
assert.deepEqual(visuals.frame(7400).equipment, []);
visuals.processPose(pose(7450), context);
assert.equal(visuals.snapshot().measuredFrameCount, beforeEpoch + 12);
noPrivateReportData(visuals.snapshot());
console.log("Synthetic fixture: authentic T-pose, canonical v4 Flow/nose, measured/frozen loss and camera/pose epoch invalidation passed; physical phone calibration remains unverified.");
