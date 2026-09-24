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
const IDENTITY_QUATERNION = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });
const ZERO_WEIGHTS = Object.freeze({ edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0 });
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
 * Smooth edge influence for a finite point. The square radius is zero at exact
 * center and one at/on/outside the square; position itself remains caller-owned.
 */
export function squareRadialNeutralInfluence(x, y) {
  const px = Math.max(0, Math.min(1, finite(x, "squareRadialNeutralInfluence: x")));
  const py = Math.max(0, Math.min(1, finite(y, "squareRadialNeutralInfluence: y")));
  const radius = Math.max(0, Math.min(1, 2 * Math.max(Math.abs(px - 0.5), Math.abs(py - 0.5))));
  return Object.freeze({ radius, influence: smoothstep01(radius) });
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
 * Resolve the complete spatial target quaternion. The perimeter target composes
 * heading * local XYZ first; smooth square-radius influence then slerps from the
 * identity spatial adjustment at center to that target at/on/outside the edge.
 */
export function squareRadialSaberTarget(x, y, zones, blendRadius) {
  if (zones === null || typeof zones !== "object") throw new TypeError("squareRadialSaberTarget: zones must be an object");
  const radial = squareRadialNeutralInfluence(x, y);
  const field = squareRadialEdgeWeights(x, y, blendRadius);
  if (field === null) return Object.freeze({
    boundary: null,
    weights: ZERO_WEIGHTS,
    primary: null,
    adjacent: null,
    adjacentWeight: 0,
    radius: radial.radius,
    influence: radial.influence,
    perimeterOrientation: IDENTITY_QUATERNION,
    orientation: IDENTITY_QUATERNION
  });
  const primary = edgeQuaternion(zones[field.primary], field.primary);
  const perimeterOrientation = field.adjacent === null || field.adjacentWeight === 0
    ? primary
    : slerpEquipmentQuaternionShortest(primary, edgeQuaternion(zones[field.adjacent], field.adjacent), field.adjacentWeight);
  return Object.freeze({
    ...field,
    radius: radial.radius,
    influence: radial.influence,
    perimeterOrientation,
    orientation: slerpEquipmentQuaternionShortest(IDENTITY_QUATERNION, perimeterOrientation, radial.influence)
  });
}

/** Stateful fixed-endpoint temporal easing over the stateless spatial field. */
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
      const target = spatial.orientation;
      let entry = hands.get(hand);
      const clampedDuration = Math.max(0, durationMs);
      if (entry === undefined) {
        entry = { start: target, target, startMs: nowMs, ease, durationMs: clampedDuration };
      } else if (!quaternionEqual(target, entry.target) || ease !== entry.ease || clampedDuration !== entry.durationMs) {
        entry = { start: evaluate(entry, nowMs), target, startMs: nowMs, ease, durationMs: clampedDuration };
      }
      hands.set(hand, entry);
      return Object.freeze({
        orientation: evaluate(entry, nowMs),
        targetOrientation: target,
        boundary: spatial.boundary,
        weights: spatial.weights,
        radius: spatial.radius,
        influence: spatial.influence
      });
    },
    reset() { hands.clear(); }
  });
}
