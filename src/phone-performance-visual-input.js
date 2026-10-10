// @ts-check
// Diagnostic-only private measured-pose -> Flow visual projection. Never serialize
// this module's frame() result: it contains calibrated equipment and nose geometry.
import { createEquipmentConfigIdentity } from "@aerobeat/web-contracts";
import { sha256Hex } from "@aerobeat/web-hash";
import { createAeroBodyGridService } from "@aerobeat/web-input";
import { canonicalEquipmentConfigIdentityInput } from "./equipment-config.js";
import { equipmentConfigDefaults } from "./equipment-config-defaults.js";
import { gameplayEquipmentRecords } from "./gameplay-equipment-records.js";
import { squareRadialSaberTarget } from "./saber-zone-direction.js";

const EMPTY = Object.freeze([]);
const PLAY_SESSION = Object.freeze({ purpose: "play", state: "playing" });
const MAX_COUNT = 1_000_000_000;
const increment = (count) => Math.min(MAX_COUNT, count + 1);
const validPoint = (anchor) => anchor?.valid === true && Number.isFinite(anchor.x) && Number.isFinite(anchor.y);

/**
 * One private visual-input owner per diagnostic CV window. processPose receives
 * only real Worker output in production; the validator drives an explicitly
 * synthetic measured fixture. Neither raw frames nor calibration snapshots
 * appear in snapshot() or in a serializable public diagnostic report.
 */
export async function createPhoneTrackingVisuals() {
  const value = await sha256Hex(canonicalEquipmentConfigIdentityInput(equipmentConfigDefaults));
  const identity = createEquipmentConfigIdentity({ schema: "aerobeat/equipment_config_identity", version: 1, algorithm: "sha256", value });
  const input = createAeroBodyGridService();
  let destroyed = false;
  let measuredFrameCount = 0;
  let visiblePoseFrameCount = 0;
  let lastPoseTimestampMs = -Infinity;
  let lastAdvanceAtMs = -Infinity;
  let lastSourceChangeId = null;
  let lastSourceAspectRatio = null;
  let lastPoseSourceId = null;
  let lastPoseMirrored = null;
  let lastShoulderCalibrationId = null;
  let lastShoulderPivot = { left: null, right: null };

  function processPose(pose, { sourceAspectRatio, sourceChangeId } = {}) {
    if (destroyed || !pose || !Number.isFinite(pose.timestampMs) || pose.timestampMs <= lastPoseTimestampMs) return;
    if (typeof sourceChangeId !== "string" || !sourceChangeId || !Number.isFinite(sourceAspectRatio) || sourceAspectRatio <= 0) {
      input.resetCalibration("media_source_unknown");
      return;
    }
    // Source epochs invalidate even before a usable new measured frame: do not
    // show held wrists from the previous camera while the replacement starts.
    if (lastSourceChangeId !== null && (sourceChangeId !== lastSourceChangeId || sourceAspectRatio !== lastSourceAspectRatio || pose.sourceId !== lastPoseSourceId || pose.mirrored !== lastPoseMirrored)) {
      input.resetCalibration("media_source_changed");
      lastShoulderCalibrationId = null;
      lastShoulderPivot = { left: null, right: null };
    }
    lastSourceChangeId = sourceChangeId;
    lastSourceAspectRatio = sourceAspectRatio;
    lastPoseSourceId = pose.sourceId;
    lastPoseMirrored = pose.mirrored;
    // Forward the unmodified measured Worker frame; never fabricate wrists.
    const before = input.getSnapshot();
    const next = input.processPoseSample(pose, { sourceAspectRatio, sourceChangeId });
    if (next === before) return;
    // Prevent an earlier display tick from advancing past a newly received
    // measured sample that arrived after a long inference gap.
    lastAdvanceAtMs = pose.timestampMs;
    lastPoseTimestampMs = pose.timestampMs;
    measuredFrameCount = increment(measuredFrameCount);
  }

  function frame(nowMs) {
    if (destroyed) return Object.freeze({ equipment: EMPTY, cursors: EMPTY, calibrationReady: false, trackingReady: false });
    if (!Number.isFinite(nowMs) || nowMs < 0) return Object.freeze({ equipment: EMPTY, cursors: EMPTY, calibrationReady: false, trackingReady: false });
    if (nowMs >= lastPoseTimestampMs && nowMs - lastPoseTimestampMs >= 100 && nowMs - lastAdvanceAtMs >= 1000 / 15) {
      lastAdvanceAtMs = nowMs;
      input.advanceTime(nowMs);
    }
    const poseInput = input.getSnapshot();
    const calibrationReady = poseInput.calibration.calibrationId !== null && poseInput.tracking.freshCalibrationRequired !== true && poseInput.calibration.readiness === "countdown";
    const trackingReady = calibrationReady && poseInput.tracking.gameplayPaused !== true && (poseInput.tracking.allRequiredAnchorsVisible === true || poseInput.tracking.anchorsFrozen === true || poseInput.latestEvidence?.provenance === "frozen") && poseInput.retainedGeometryDimmed !== true;
    if (!trackingReady) return Object.freeze({ equipment: EMPTY, cursors: EMPTY, calibrationReady, trackingReady });

    const anchors = poseInput.anchors;
    const calibrationId = poseInput.calibration.calibrationId;
    if (lastShoulderCalibrationId !== calibrationId) {
      lastShoulderCalibrationId = calibrationId;
      lastShoulderPivot = { left: null, right: null };
    }
    const flow = equipmentConfigDefaults.flow.saber;
    const targets = {};
    for (const hand of ["left", "right"]) {
      const wrist = anchors.find((entry) => entry?.anchor === `${hand}_wrist` && validPoint(entry));
      const shoulder = anchors.find((entry) => entry?.anchor === `${hand}_shoulder` && validPoint(entry));
      const position = wrist ? { x: Number(wrist.x), y: Number(wrist.y) } : { x: hand === "left" ? 0 : 1, y: .5 };
      if (shoulder) lastShoulderPivot[hand] = { x: Number(shoulder.x), y: Number(shoulder.y) };
      const center = lastShoulderPivot[hand] ?? { x: .5, y: .5 };
      const target = squareRadialSaberTarget(position.x, 1 - position.y, flow.zones, flow.blendRadius, { x: center.x, y: 1 - center.y });
      targets[hand] = Object.freeze({ orientation: target.orientation, position: Object.freeze(position) });
    }
    const equipment = gameplayEquipmentRecords(false, { ...PLAY_SESSION, timestampMs: nowMs }, poseInput, "flow", null, targets, equipmentConfigDefaults, identity);
    const nose = anchors.find((anchor) => anchor?.anchor === "nose");
    const validNose = validPoint(nose) && nose.x >= 0 && nose.x <= 1 && nose.y >= 0 && nose.y <= 1 && Number.isFinite(nose.confidence) && nose.confidence >= .5;
    const cursors = validNose ? Object.freeze([Object.freeze({ role: "nose", x: nose.x, y: nose.y, confidence: nose.confidence })]) : EMPTY;
    if (equipment.length > 0) visiblePoseFrameCount = increment(visiblePoseFrameCount);
    return Object.freeze({ equipment, cursors, calibrationReady, trackingReady });
  }

  function snapshot() {
    const current = destroyed ? null : input.getSnapshot();
    return Object.freeze({
      calibrationReady: Boolean(current && current.calibration.calibrationId !== null && current.tracking.freshCalibrationRequired !== true && current.calibration.readiness === "countdown"),
      measuredFrameCount,
      visiblePoseFrameCount
    });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    input.destroy();
    lastShoulderPivot = { left: null, right: null };
  }
  return Object.freeze({ processPose, frame, snapshot, destroy });
}
