// @ts-check

import { createResolvedEquipmentPose, gloveObbGeometry, saberCapsuleGeometry } from "@aerobeat/web-contracts";

const TRACKING = Object.freeze({
  gameplayPaused: false,
  freshCalibrationRequired: false,
  allRequiredAnchorsVisible: true,
  anchorsFrozen: false,
  degradedAnchors: Object.freeze([])
});

const DEFAULT_POSITIONS = Object.freeze({
  left: Object.freeze({ x: 0, y: 0.5 }),
  right: Object.freeze({ x: 1, y: 0.5 })
});

export const testEquipmentMouseHands = Object.freeze(["off", "left", "right"]);

/**
 * Build renderer-only deterministic Test wrist evidence. Only the selected
 * wrist may use the latest finite pointer point; the other stays anchored.
 *
 * @param {unknown} selectedHand
 * @param {unknown} pointerPosition
 */
export function testEquipmentInput(selectedHand = "off", pointerPosition = null) {
  const hand = testEquipmentMouseHands.includes(String(selectedHand)) ? String(selectedHand) : "off";
  const finitePointer = pointerPosition && typeof pointerPosition === "object" && Number.isFinite(pointerPosition.x) && Number.isFinite(pointerPosition.y)
    ? Object.freeze({ x: Number(pointerPosition.x), y: Number(pointerPosition.y) })
    : null;
  const anchor = (/** @type {"left"|"right"} */ side) => {
    const point = hand === side && finitePointer ? finitePointer : DEFAULT_POSITIONS[side];
    return Object.freeze({ anchor: `${side}_wrist`, valid: true, x: point.x, y: point.y, confidence: 1 });
  };
  return Object.freeze({
    tracking: TRACKING,
    countdownFrozen: false,
    retainedGeometryDimmed: false,
    anchors: Object.freeze([anchor("left"), anchor("right")])
  });
}

/** Build strict measured evidence from the same two visible Test wrists. */
export function visualTestProductionInput(selectedHand, pointerPosition, identity) {
  if (!identity || !Number.isSafeInteger(identity.frameSequence) || identity.frameSequence < 1 || !Number.isFinite(identity.timestampMs) || identity.timestampMs < 0 || typeof identity.sourceIdentity !== "string" || typeof identity.calibrationId !== "string") throw new TypeError("visual_test_evidence_identity_invalid");
  const preview = testEquipmentInput(selectedHand, pointerPosition);
  const anchors = Object.freeze(preview.anchors.map((entry) => {
    const onGrid = entry.x >= 0 && entry.x <= 1 && entry.y >= 0 && entry.y <= 1;
    const column = onGrid ? Math.min(3, Math.floor(entry.x * 4)) : null;
    const row = onGrid ? Math.min(2, Math.floor(entry.y * 3)) : null;
    const subColumn = onGrid ? Math.min(7, Math.floor(entry.x * 8)) : null;
    const subRow = onGrid ? Math.min(5, Math.floor(entry.y * 6)) : null;
    return Object.freeze({ schema:"aerobeat/body_grid_anchor_snapshot", version:1, anchor:entry.anchor, calibrationId:identity.calibrationId, measurementTimestampMs:identity.timestampMs, valid:true, confidence:1, rawX:entry.x, rawY:entry.y, x:entry.x, y:entry.y, cell:onGrid ? row*4+column : null, subcell:onGrid ? subRow*8+subColumn : null });
  }));
  const evidence = Object.freeze({ schema:"aerobeat/gameplay_evidence_snapshot", version:1, calibrationId:identity.calibrationId, measuredSourceFrameId:`${identity.sourceIdentity}:frame:${identity.frameSequence}`, measurementTimestampMs:identity.timestampMs, provenance:"measured", activeBoxingActions:Object.freeze([]), anchors, entries:Object.freeze([]) });
  return Object.freeze({
    sourceIdentity: identity.sourceIdentity,
    calibration: Object.freeze({ calibrationId:identity.calibrationId, readiness:"countdown" }),
    tracking: Object.freeze({ gameplayPaused:false, freshCalibrationRequired:false }),
    countdownFrozen:false,
    latestEvidence:evidence,
    straightQualifications:Object.freeze([])
  });
}

/** Resolve exact standalone gameplay-test poses from one strict input frame. */
export function standaloneTestEquipmentPoses(mode, input, configIdentity) {
  const anchors = input?.latestEvidence?.anchors ?? [];
  return Object.freeze(["left_wrist","right_wrist"].map((role) => {
    const anchor = anchors.find((entry) => entry?.anchor === role);
    return createResolvedEquipmentPose({ role, mode, anchor:{x:Number(anchor.x)*4-.5,y:2.5-Number(anchor.y)*3,z:0}, scale:mode === "flow" ? 2 : .75, orientation:{x:0,y:0,z:0,w:1}, geometryIdentity:mode === "flow" ? saberCapsuleGeometry.identity : gloveObbGeometry.identity, configIdentity });
  }));
}
