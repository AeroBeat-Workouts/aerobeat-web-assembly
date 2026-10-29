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
  const hand = pose.role === "left_wrist" ? "left" : "right";
  const center = pivots[hand] ?? { x: .5, y: .5 };
  const base = equipmentEulerDegreesToQuaternion(config.flow.perHand[hand].rotationEulerDeg);
  const target = squareRadialSaberTarget((pose.anchor.x + .5) / 4, (pose.anchor.y + .5) / 3,
    config.flow.saber.zones, config.flow.saber.blendRadius, { x: center.x, y: 1 - center.y }, base);
  return createResolvedEquipmentPose({ ...pose, orientation: multiplyEquipmentQuaternions(base, target.orientation) });
}
