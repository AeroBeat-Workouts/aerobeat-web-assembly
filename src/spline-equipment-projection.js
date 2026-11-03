// @ts-check
import { createResolvedEquipmentPose, equipmentEulerDegreesToQuaternion, multiplyEquipmentQuaternions } from "@aerobeat/web-contracts";
import { squareRadialSaberTarget } from "./saber-zone-direction.js";

/**
 * Reapply the production position-dependent equipment projection at a reconstructed
 * judge-plane anchor. Boxing rotation is action-driven rather than a position field;
 * its already-resolved animated orientation remains the interpolation authority.
 * @param {ReturnType<typeof createResolvedEquipmentPose>} pose
 * @param {ReturnType<import("./equipment-config.js").validateEquipmentConfig>} config
 * @param {{left: {x:number,y:number}|null,right:{x:number,y:number}|null}} pivots Normalized input-grid shoulders, or screen centre for Test.
 */
export function reprojectSplineEquipmentPose(pose, config, pivots) {
  if (pose.mode !== "flow") return pose;
  return createResolvedEquipmentPose({ ...pose, orientation: flowSplineOrientation(pose, config, pivots) });
}

/**
 * Cache this pre-pose-normalization value, not a prior pose's orientation:
 * normalizing the prior output again can introduce a one-ULP drift.
 * @param {ReturnType<typeof createResolvedEquipmentPose>} pose
 * @param {ReturnType<import("./equipment-config.js").validateEquipmentConfig>} config
 * @param {{left: {x:number,y:number}|null,right:{x:number,y:number}|null}} pivots
 */
function flowSplineOrientation(pose, config, pivots) {
  const hand = pose.role === "left_wrist" ? "left" : "right";
  const center = pivots[hand] ?? { x: .5, y: .5 };
  const base = equipmentEulerDegreesToQuaternion(config.flow.perHand[hand].rotationEulerDeg);
  const target = squareRadialSaberTarget((pose.anchor.x + .5) / 4, (pose.anchor.y + .5) / 3,
    config.flow.saber.zones, config.flow.saber.blendRadius, { x: center.x, y: 1 - center.y }, base);
  return multiplyEquipmentQuaternions(base, target.orientation);
}

/**
 * Reuse only the position-field orientation during one synchronous scoring
 * advance. Callers must discard this projector afterward. Z, scale, input
 * rotation and identity remain owned by each individual validated pose.
 * @param {ReturnType<import("./equipment-config.js").validateEquipmentConfig>} config
 * @param {{left: {x:number,y:number}|null,right:{x:number,y:number}|null}} pivots
 */
export function createFrameSplineEquipmentProjector(config, pivots) {
  const centers = {
    left: pivots.left === null ? null : { ...pivots.left },
    right: pivots.right === null ? null : { ...pivots.right }
  };
  /** @type {Map<number, Map<number, ReturnType<typeof createResolvedEquipmentPose>["orientation"]>>} */
  const left = new Map();
  /** @type {typeof left} */
  const right = new Map();
  /** @param {ReturnType<typeof createResolvedEquipmentPose>} pose */
  return (pose) => {
    if (pose.mode !== "flow") return pose;
    const cache = pose.role === "left_wrist" ? left : right;
    let row = cache.get(pose.anchor.x);
    if (!row) { row = new Map(); cache.set(pose.anchor.x, row); }
    let orientation = row.get(pose.anchor.y);
    if (!orientation) {
      orientation = flowSplineOrientation(pose, config, centers);
      row.set(pose.anchor.y, orientation);
    }
    return createResolvedEquipmentPose({ ...pose, orientation });
  };
}
