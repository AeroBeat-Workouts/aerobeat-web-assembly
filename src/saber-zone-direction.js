// @ts-check
// Pure square-radial Flow saber target field. Position remains caller-owned and
// unbounded; only the orientation sample is clamped to the normalized square.

import { easeValue } from "./easing.js";
import {
  equipmentEulerDegreesToQuaternion,
  multiplyEquipmentQuaternions,
  slerpEquipmentQuaternionShortest
} from "@aerobeat/web-contracts";

export const SABER_EDGE_KEYS = Object.freeze(["edgeTop", "edgeBottom", "edgeLeft", "edgeRight"]);
export const SABER_ZONE_ANCHORS = Object.freeze({
  edgeTop: Object.freeze({ x: 0.5, y: 1 }),
  edgeBottom: Object.freeze({ x: 0.5, y: 0 }),
  edgeLeft: Object.freeze({ x: 0, y: 0.5 }),
  edgeRight: Object.freeze({ x: 1, y: 0.5 })
});

const ZERO_EULER = Object.freeze({ x: 0, y: 0, z: 0 });
const CENTER_EPSILON = 1e-15;

function finite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  return value;
}

function smoothstep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function quaternionEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.z === b.z && a.w === b.w;
}

function edgeQuaternion(zone, key) {
  if (zone === null || typeof zone !== "object") throw new TypeError(`squareRadialSaberTarget: ${key} must be an object`);
  const headingDeg = finite(zone.headingDeg, `squareRadialSaberTarget: ${key}.headingDeg`);
  const local = zone.localRotationEulerDeg ?? ZERO_EULER;
  return multiplyEquipmentQuaternions(
    equipmentEulerDegreesToQuaternion({ x: 0, y: 0, z: headingDeg }),
    equipmentEulerDegreesToQuaternion(local)
  );
}

/** Convert an in-plane angle to a unit vector. */
export function zoneAngleToVector(deg) {
  const rad = finite(deg, "zoneAngleToVector: deg") * Math.PI / 180;
  return Object.freeze({ x: Math.cos(rad), y: Math.sin(rad) });
}

/**
 * Project a finite non-center point radially onto the normalized square.
 * The input is clamped only for orientation; callers retain the truthful point.
 * Exact center returns null because radial direction is undefined.
 */
export function projectSquareRadialOrientation(x, y) {
  const px = Math.max(0, Math.min(1, finite(x, "projectSquareRadialOrientation: x")));
  const py = Math.max(0, Math.min(1, finite(y, "projectSquareRadialOrientation: y")));
  const dx = px - 0.5, dy = py - 0.5;
  const extent = Math.max(Math.abs(dx), Math.abs(dy));
  if (extent <= CENTER_EPSILON) return null;
  return Object.freeze({ x: 0.5 + dx / (2 * extent), y: 0.5 + dy / (2 * extent) });
}

/**
 * Perimeter weights for the primary edge and its adjacent corner edge. A
 * blendRadius-wide C1 band on each side of a corner joins both full targets;
 * the corner itself is exactly 50/50. Exact center returns null.
 */
export function squareRadialEdgeWeights(x, y, blendRadius) {
  const radius = finite(blendRadius, "squareRadialEdgeWeights: blendRadius");
  if (radius <= 0 || radius > 0.5) throw new RangeError("squareRadialEdgeWeights: blendRadius must be in (0, 0.5]");
  const boundary = projectSquareRadialOrientation(x, y);
  if (boundary === null) return null;

  let primary, adjacent = null, cornerDistance = 0.5;
  if (Math.abs(boundary.x - 0.5) >= Math.abs(boundary.y - 0.5)) {
    primary = boundary.x < 0.5 ? "edgeLeft" : "edgeRight";
    if (boundary.y !== 0.5) {
      adjacent = boundary.y < 0.5 ? "edgeBottom" : "edgeTop";
      cornerDistance = 0.5 - Math.abs(boundary.y - 0.5);
    }
  } else {
    primary = boundary.y < 0.5 ? "edgeBottom" : "edgeTop";
    if (boundary.x !== 0.5) {
      adjacent = boundary.x < 0.5 ? "edgeLeft" : "edgeRight";
      cornerDistance = 0.5 - Math.abs(boundary.x - 0.5);
    }
  }

  const adjacentWeight = adjacent === null || cornerDistance >= radius
    ? 0
    : 0.5 * (1 - smoothstep01(cornerDistance / radius));
  const weights = { edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0 };
  weights[primary] = 1 - adjacentWeight;
  if (adjacent !== null) weights[adjacent] = adjacentWeight;
  return Object.freeze({
    boundary,
    weights: Object.freeze(weights),
    primary,
    adjacent,
    adjacentWeight
  });
}

/**
 * Resolve the complete spatial target quaternion (heading * local XYZ). This is
 * deliberately null only at exact center; stateful center retention belongs to
 * createSquareRadialSaberTargetTracker().
 */
export function squareRadialSaberTarget(x, y, zones, blendRadius) {
  if (zones === null || typeof zones !== "object") throw new TypeError("squareRadialSaberTarget: zones must be an object");
  const field = squareRadialEdgeWeights(x, y, blendRadius);
  if (field === null) return null;
  const primary = edgeQuaternion(zones[field.primary], field.primary);
  const orientation = field.adjacent === null || field.adjacentWeight === 0
    ? primary
    : slerpEquipmentQuaternionShortest(primary, edgeQuaternion(zones[field.adjacent], field.adjacent), field.adjacentWeight);
  return Object.freeze({ ...field, orientation });
}

/**
 * Compatibility heading-vector resolver for the current assembly integration.
 * v3 callers should use squareRadialSaberTarget so local XYZ is blended as part
 * of each complete edge target. At the singular center this stateless adapter
 * returns its normalized fallback; the tracker below owns v3 retention.
 */
export function zoneDirection(x, y, fallbackDir, zones, blendRadius) {
  const fx = Number(fallbackDir?.x), fy = Number(fallbackDir?.y), magnitude = Math.hypot(fx, fy);
  const fallback = Number.isFinite(fx) && Number.isFinite(fy) && magnitude > Number.EPSILON
    ? Object.freeze({ x: fx / magnitude, y: fy / magnitude })
    : Object.freeze({ x: 1, y: 0 });
  const headingZones = {};
  for (const key of SABER_EDGE_KEYS) headingZones[key] = Object.freeze({ headingDeg: zones?.[key]?.headingDeg, localRotationEulerDeg: ZERO_EULER });
  const target = squareRadialSaberTarget(x, y, headingZones, blendRadius);
  if (target === null) return fallback;
  const q = target.orientation;
  return Object.freeze({ x: 1 - 2 * q.z * q.z, y: 2 * q.w * q.z });
}

/**
 * Stateful complete-target resolver. Exact center retains the last non-center
 * spatial target; without history left bootstraps from edgeLeft and right from
 * edgeRight. Temporal easing always uses fixed quaternion endpoints.
 */
export function createSquareRadialSaberTargetTracker() {
  const hands = new Map();
  const evaluate = (entry, nowMs) => {
    const progress = entry.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs - entry.startMs) / entry.durationMs));
    return slerpEquipmentQuaternionShortest(entry.start, entry.target, easeValue(progress, entry.ease));
  };
  return Object.freeze({
    tick(hand, x, y, zones, blendRadius, nowMs, ease, durationMs) {
      if (hand !== "left" && hand !== "right") throw new TypeError("Square-radial saber tracker: hand must be 'left' or 'right'");
      finite(nowMs, "Square-radial saber tracker: nowMs");
      finite(durationMs, "Square-radial saber tracker: durationMs");
      const spatial = squareRadialSaberTarget(x, y, zones, blendRadius);
      let entry = hands.get(hand);
      let stableTarget = spatial?.orientation ?? entry?.stableTarget;
      let bootstrapped = false;
      if (stableTarget === undefined) {
        const key = hand === "left" ? "edgeLeft" : "edgeRight";
        stableTarget = edgeQuaternion(zones[key], key);
        bootstrapped = true;
      }
      const clampedDuration = Math.max(0, durationMs);
      if (entry === undefined) {
        entry = { start: stableTarget, target: stableTarget, stableTarget, startMs: nowMs, ease, durationMs: clampedDuration };
      } else if (!quaternionEqual(stableTarget, entry.target) || ease !== entry.ease || clampedDuration !== entry.durationMs) {
        entry = { start: evaluate(entry, nowMs), target: stableTarget, stableTarget, startMs: nowMs, ease, durationMs: clampedDuration };
      } else if (spatial !== null && !quaternionEqual(spatial.orientation, entry.stableTarget)) {
        entry = { ...entry, stableTarget: spatial.orientation };
      }
      hands.set(hand, entry);
      return Object.freeze({
        orientation: evaluate(entry, nowMs),
        targetOrientation: stableTarget,
        boundary: spatial?.boundary ?? null,
        weights: spatial?.weights ?? null,
        retainedCenter: spatial === null && !bootstrapped,
        bootstrapped
      });
    },
    reset() { hands.clear(); }
  });
}

/** Existing vector tracker retained for current integration until it consumes full targets. */
export function createSaberDirectionTracker() {
  const hands = new Map();
  const evaluate = (entry, nowMs) => {
    const t = entry.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs - entry.startMs) / entry.durationMs));
    return slerpEquipmentQuaternionShortest(entry.start, entry.target, easeValue(t, entry.ease));
  };
  const vector = (quaternion) => Object.freeze({ x: 1 - 2 * quaternion.z * quaternion.z, y: 2 * quaternion.w * quaternion.z });
  return Object.freeze({
    tick(hand, target, nowMs, ease, durationMs) {
      if (hand !== "left" && hand !== "right") throw new TypeError("Saber direction tracker: hand must be 'left' or 'right'");
      const tx = Number(target?.x), ty = Number(target?.y), magnitude = Math.hypot(tx, ty);
      if (!Number.isFinite(tx) || !Number.isFinite(ty) || magnitude < Number.EPSILON) throw new TypeError("Saber direction tracker: target must be a finite non-zero {x,y} vector");
      finite(nowMs, "Saber direction tracker: nowMs"); finite(durationMs, "Saber direction tracker: durationMs");
      const targetX = tx / magnitude, targetY = ty / magnitude;
      const targetQuaternion = equipmentEulerDegreesToQuaternion({ x: 0, y: 0, z: Math.atan2(targetY, targetX) * 180 / Math.PI });
      let entry = hands.get(hand);
      if (entry === undefined) entry = { start: targetQuaternion, target: targetQuaternion, targetX, targetY, startMs: nowMs, ease, durationMs: Math.max(0, durationMs) };
      else if (targetX !== entry.targetX || targetY !== entry.targetY || ease !== entry.ease || Math.max(0, durationMs) !== entry.durationMs) entry = { start: evaluate(entry, nowMs), target: targetQuaternion, targetX, targetY, startMs: nowMs, ease, durationMs: Math.max(0, durationMs) };
      hands.set(hand, entry);
      return vector(evaluate(entry, nowMs));
    },
    reset() { hands.clear(); }
  });
}
