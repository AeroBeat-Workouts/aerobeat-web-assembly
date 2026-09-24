// @ts-check

import {
  createResolvedEquipmentPose,
  equipmentEulerDegreesToQuaternion,
  gloveObbGeometry,
  multiplyEquipmentQuaternions,
  saberCapsuleGeometry
} from "@aerobeat/web-contracts";
import { validateEquipmentConfig } from "./equipment-config.js";
import { equipmentConfigDefaults } from "./equipment-config-defaults.js";

const IDENTITY_QUATERNION = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

/**
 * Resolve the only per-frame equipment pose records. Their anchors remain in
 * judge WU and the exact frozen objects are shared by gameplay and renderer.
 *
 * @param {boolean} menuOpen
 * @param {unknown} session
 * @param {unknown} input
 * @param {"flow" | "boxing"} mode
 * @param {Readonly<{ left_wrist: ReadonlyArray<Readonly<{t: number, x: number, y: number}>> | null, right_wrist: ReadonlyArray<Readonly<{t: number, x: number, y: number}>> | null }> | null} [saberWristHistory]
 * @param {Readonly<{left: Readonly<{x:number,y:number,z:number,w:number}>, right: Readonly<{x:number,y:number,z:number,w:number}>}> | null} [boxingStateOrientations]
 * @param {Readonly<{left: Readonly<{orientation:Readonly<{x:number,y:number,z:number,w:number}>}>,right: Readonly<{orientation:Readonly<{x:number,y:number,z:number,w:number}>}>}> | null} [flowZoneTargets]
 * @param {unknown} [equipmentConfig]
 * @param {unknown} [configIdentity]
 */
export function gameplayEquipmentRecords(menuOpen, session, input, mode, saberWristHistory = null, boxingStateOrientations = null, flowZoneTargets = null, equipmentConfig = equipmentConfigDefaults, configIdentity = null) {
  if ((mode !== "flow" && mode !== "boxing") || configIdentity === null) return Object.freeze([]);
  const state = String(session?.state ?? "");
  const pausedVisualTest = state === "paused_manual" && session?.purpose === "visual_test";
  if (menuOpen || (!pausedVisualTest && state !== "countdown" && state !== "playing")) return Object.freeze([]);
  const tracking = input?.tracking;
  if (!tracking || tracking.gameplayPaused === true || tracking.freshCalibrationRequired === true || input?.countdownFrozen === true) return Object.freeze([]);
  const anchorsFrozen = tracking.anchorsFrozen === true;
  if (!anchorsFrozen && (tracking.allRequiredAnchorsVisible !== true || input?.retainedGeometryDimmed === true)) return Object.freeze([]);
  const config = validateEquipmentConfig(equipmentConfig);
  const degraded = new Set(Array.isArray(tracking.degradedAnchors) ? tracking.degradedAnchors : []);
  const measuredAnchors = Array.isArray(input?.latestEvidence?.anchors) ? input.latestEvidence.anchors : input?.anchors;
  const byRole = new Map((Array.isArray(measuredAnchors) ? measuredAnchors : []).map((anchor) => [anchor?.anchor, anchor]));
  const nowMs = Number(session?.timestampMs);
  return Object.freeze(["left_wrist", "right_wrist"].flatMap((role) => {
    const anchor = byRole.get(role);
    if (anchor?.valid !== true || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !Number.isFinite(anchor.confidence) || anchor.confidence < 0.5) return [];
    const hand = role === "left_wrist" ? "left" : "right";
    const base = config[mode].perHand[hand];
    let orientation;
    if (mode === "flow") {
      const target = flowZoneTargets?.[hand]?.orientation;
      if (!target || ![target.x,target.y,target.z,target.w].every(Number.isFinite)) return [];
      orientation = multiplyEquipmentQuaternions(equipmentEulerDegreesToQuaternion(base.rotationEulerDeg), target);
    } else {
      const animated = boxingStateOrientations?.[hand] ?? IDENTITY_QUATERNION;
      orientation = multiplyEquipmentQuaternions(equipmentEulerDegreesToQuaternion(base.rotationEulerDeg), animated);
    }
    const pose = createResolvedEquipmentPose({
      role,
      mode,
      anchor: { x: Number(anchor.x) * 4 - 0.5, y: 2.5 - Number(anchor.y) * 3, z: 0 },
      scale: base.scale,
      orientation,
      geometryIdentity: mode === "flow" ? saberCapsuleGeometry.identity : gloveObbGeometry.identity,
      configIdentity
    });
    // Dimming is presentation-only and cannot alter the shared hit-bearing pose.
    if (anchorsFrozen && degraded.has(role)) return [pose];
    return [pose];
  }));
}
