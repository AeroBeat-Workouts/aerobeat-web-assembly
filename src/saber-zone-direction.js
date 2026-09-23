// @ts-check
// AeroBeat 0.0.63, bead 6ax2 (child C4 of bead 376l; plan
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md, L-C design,
// D4 confirmed): FLOW SABER DIRECTION FROM GRID ZONES.
//
// The zone map REPLACES the motion-derived direction as the saber's in-plane
// orientation source: the athlete's (clamped, normalized 0..1) wrist position
// on the grid selects a blend of up to 5 zone orientation vectors, and the
// resulting target direction is eased per hand by a stateful tracker (same
// easing machinery as the C3 boxing glove tracker, shared `./easing.js`).
//
// SIGNED-OFF SEMANTICS (do not deviate):
//   - Grid zones = the 4 edges + center.
//   - Center zone = NEUTRAL: `center.headingDeg === null` keeps the
//     motion-derived direction (the `fallbackDir` passed in).
//   - Angle convention: in-plane degrees, 90 = blade up, 270 = down,
//     180 = left, 0 = right.
//   - A DISTANCE-BLEND between zones makes crossing a boundary feel like a
//     swing, not a step: no hard discontinuities anywhere in the field.
//   - All zone angles, the ease type, the ease duration, and the blend radius
//     come from the config foundation (`equipmentConfigDefaults.flow.saber`).
//
// PURE MODULE: no DOM/renderer/session imports; plain data + math only.
//
// BLEND FORMULA (as implemented):
//   Positions are clamped to [0,1] first. Zone anchors:
//     edgeTop (0.5,1.0), edgeBottom (0.5,0.0), edgeLeft (0.0,0.5),
//     edgeRight (1.0,0.5), center (0.5,0.5).
//   Per edge zone k:   w_k = 1 − smoothstep(0, blendRadius, d_k)
//                      (w = 1 at its anchor, w = 0 at blendRadius, C¹-smooth)
//   Center weight:     w_c = 1 − clamp(Σ_k w_k, 0, 1)   (so Σ all w = 1)
//   Result vector:     v = Σ_k w_k·û(angle_k) + w_c·û(angle_c-or-fallback)
//                      (center headingDeg null → û(fallbackDir))
//   Output:            normalize(v); if |v| < 1e-6 → fallbackDir (degenerate
//                      cancel, e.g. fully opposite zone weights).

import { easeValue } from "./easing.js";
import { quaternionFromEulerDeg, slerpQuaternionShortest } from "./equipment-quaternion.js";

/**
 * A unit direction vector in judge space (+x right, +y up).
 *
 * @typedef {Object} DirectionVector
 * @property {number} x - Horizontal component (−1..1).
 * @property {number} y - Vertical component (−1..1).
 */

/**
 * Flow saber zone key. `center` is the neutral zone (headingDeg may be null).
 *
 * @typedef {"edgeTop" | "edgeBottom" | "edgeLeft" | "edgeRight" | "center"} SaberZoneKey
 */

/**
 * The five zone anchors in normalized grid coordinates (x, y), y-up. The four
 * edge anchors sit at the middle of each grid edge; the center anchor is the
 * grid center.
 *
 * @type {Readonly<Record<SaberZoneKey, Readonly<{x: number, y: number}>>>}
 */
export const SABER_ZONE_ANCHORS = Object.freeze({
  edgeTop: Object.freeze({ x: 0.5, y: 1.0 }),
  edgeBottom: Object.freeze({ x: 0.5, y: 0.0 }),
  edgeLeft: Object.freeze({ x: 0.0, y: 0.5 }),
  edgeRight: Object.freeze({ x: 1.0, y: 0.5 }),
  center: Object.freeze({ x: 0.5, y: 0.5 }),
});

/** The four EDGE zone keys (center is handled separately as the neutral zone). */
const EDGE_KEYS = Object.freeze(["edgeTop", "edgeBottom", "edgeLeft", "edgeRight"]);

/**
 * Internal (non-public) per-zone weight evaluation — exported ONLY so the
 * pure-field oracle can verify the exact symmetric-cancel degenerate case,
 * which the public `zoneDirection` guards against. Weights are computed
 * EXACTLY as `zoneDirection` computes them (same clamping, same anchors,
 * same smoothstep / hard-zone rule).
 *
 * @param {number} x - Normalized grid x (clamped internally).
 * @param {number} y - Normalized grid y (clamped internally).
 * @param {number} blendRadius - Blend radius in grid units.
 * @returns {Readonly<Record<SaberZoneKey, number>>} - The five raw weights.
 */
export function _zoneWeights(x, y, blendRadius) {
  const px = Math.max(0, Math.min(1, x));
  const py = Math.max(0, Math.min(1, y));
  const radius = Math.max(0, blendRadius);
  const out = Object.create(null);
  let edgeSum = 0;
  for (const key of EDGE_KEYS) {
    const anchor = SABER_ZONE_ANCHORS[key];
    const d = Math.hypot(px - anchor.x, py - anchor.y);
    const w = radius <= 0 ? (d <= 1e-12 ? 1 : 0) : 1 - smoothstep(0, radius, d);
    out[key] = w;
    edgeSum += w;
  }
  out.center = Math.max(0, Math.min(1, 1 - edgeSum));
  return Object.freeze(out);
}

/** Below this result magnitude the blended vector is a degenerate cancel. */
const DEGENERATE_EPSILON = 1e-6;

/**
 * Convert in-plane degrees to a judge-space unit vector. 90 deg = up (+y),
 * 0 deg = right (+x), 180 deg = left, 270 deg = down; angles are taken mod 360.
 *
 * @param {number} deg - In-plane orientation angle (degrees).
 * @returns {Readonly<{x: number, y: number}>} - Unit vector.
 * @throws {TypeError} When `deg` is not finite.
 */
export function zoneAngleToVector(deg) {
  if (typeof deg !== "number" || !Number.isFinite(deg)) throw new TypeError("zoneAngleToVector: deg must be a finite number");
  const rad = (deg % 360) * Math.PI / 180;
  return Object.freeze({ x: Math.cos(rad), y: Math.sin(rad) });
}

/**
 * C¹-smoothstep: 0 below `edge0`, 1 above `edge1`, 3u²−2u³ between, with zero
 * first derivative at both edges (used so zone weights blend without kinks).
 *
 * @param {number} edge0 - Lower edge (input value).
 * @param {number} edge1 - Upper edge (input value).
 * @param {number} x - Input.
 * @returns {number} - Smoothed 0..1 weight.
 */
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * @param {DirectionVector | null | undefined} v - Candidate vector.
 * @returns {{x: number, y: number}} - Unit vector, or the +y fallback direction when degenerate.
 */
function safeUnitVector(v) {
  if (v === null || typeof v !== "object") return Object.freeze({ x: 0, y: 1 });
  const x = Number(v.x), y = Number(v.y);
  const m = Math.hypot(x, y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || m < Number.EPSILON) return Object.freeze({ x: 0, y: 1 });
  return Object.freeze({ x: x / m, y: y / m });
}

/**
 * CONTINUOUS zone-direction vector field: the in-plane orientation target for
 * a flow saber at grid position (x, y), as a distance-blend over the 4 edge
 * zones + the neutral center zone (see module header for the full formula).
 *
 *   - Each edge weight = 1 − smoothstep(0, blendRadius, distance-to-anchor):
 *     1 exactly at the anchor, 0 from blendRadius outward, C¹-smooth.
 *   - Center weight = 1 − clamp(Σ edge weights, 0, 1) so the five weights sum
 *     to 1 and the field is a convex combination (hence continuous; the only
 *     non-smooth point, where several weights meet, lands on the center
 *     anchor).
 *   - `zones.<key>.headingDeg` null (the center default) → the center vector
 *     IS the motion-derived `fallbackDir` (NEUTRAL: keep motion direction).
 *   - Degenerate cancel (|result| < 1e-6) → `fallbackDir`.
 *
 * Positions are clamped to [0,1] first, so out-of-range positions behave as
 * the nearest edge/center anchor. `blendRadius <= 0` disables the blend
 * (hard zones): the nearest anchor wins outright.
 *
 * @param {number} x - Normalized grid x (0..1 before clamping; +x = right).
 * @param {number} y - Normalized grid y (0..1 before clamping; +y = up).
 * @param {Readonly<{x: number, y: number}>} fallbackDir - Motion-derived direction used for the neutral center zone and the degenerate-cancel fallback.
 * @param {Readonly<{
 *   edgeTop: Readonly<{headingDeg: number}>,
 *   edgeBottom: Readonly<{headingDeg: number}>,
 *   edgeLeft: Readonly<{headingDeg: number}>,
 *   edgeRight: Readonly<{headingDeg: number}>,
 *   center: Readonly<{headingDeg: number | null}>
 * }>} zones - Per-zone configured in-plane angles (from `flow.saber.zones`).
 * @param {number} blendRadius - Distance-blend radius in grid units (from `flow.saber.blendRadius`).
 * @returns {Readonly<{x: number, y: number}>} - Unit direction vector (or `fallbackDir` normalized for the neutral/degenerate cases).
 * @throws {TypeError} On non-finite x/y/blendRadius or a non-finite edge headingDeg.
 */
export function zoneDirection(x, y, fallbackDir, zones, blendRadius) {
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError("zoneDirection: x/y must be finite numbers");
  if (typeof blendRadius !== "number" || !Number.isFinite(blendRadius)) throw new TypeError("zoneDirection: blendRadius must be a finite number");
  const fallback = safeUnitVector(fallbackDir);
  const px = Math.max(0, Math.min(1, x));
  const py = Math.max(0, Math.min(1, y));
  const w = _zoneWeights(px, py, blendRadius);
  /** @type {{x: number, y: number}} */
  let vx = 0, vy = 0;
  for (const key of EDGE_KEYS) {
    const headingDeg = Number(zones[key].headingDeg);
    if (!Number.isFinite(headingDeg)) throw new TypeError(`zoneDirection: ${key}.headingDeg must be a finite number`);
    if (w[key] <= 0) continue;
    const u = zoneAngleToVector(headingDeg);
    vx += w[key] * u.x;
    vy += w[key] * u.y;
  }

  const centerRotationDeg = zones.center.headingDeg;
  const centerVec = centerRotationDeg === null ? fallback : zoneAngleToVector(centerRotationDeg);
  vx += w.center * centerVec.x;
  vy += w.center * centerVec.y;

  const mag = Math.hypot(vx, vy);
  if (mag < DEGENERATE_EPSILON) return fallback; // degenerate cancel → neutral
  return Object.freeze({ x: vx / mag, y: vy / mag });
}

/**
 * Per-hand fixed-endpoint shortest-path quaternion slerp for Flow headings.
 * Retargeting evaluates the old transition at that exact timestamp and captures
 * a new immutable start, so frame cadence cannot compound interpolation.
 */
export function createSaberDirectionTracker() {
  /** @type {Map<"left" | "right", {start:Readonly<{x:number,y:number,z:number,w:number}>,target:Readonly<{x:number,y:number,z:number,w:number}>,targetX:number,targetY:number,startMs:number,ease:"linear"|"easeIn"|"easeOut"|"easeInOut",durationMs:number}>} */
  const hands = new Map();
  const evaluate = (entry, nowMs) => {
    const t = entry.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs - entry.startMs) / entry.durationMs));
    return slerpQuaternionShortest(entry.start, entry.target, easeValue(t, entry.ease));
  };
  const vector = (quaternion) => Object.freeze({ x: 1 - 2 * quaternion.z * quaternion.z, y: 2 * quaternion.w * quaternion.z });
  return Object.freeze({
    tick(hand, target, nowMs, ease, durationMs) {
      if (hand !== "left" && hand !== "right") throw new TypeError("Saber direction tracker: hand must be 'left' or 'right'");
      const tx = Number(target?.x), ty = Number(target?.y), magnitude = Math.hypot(tx, ty);
      if (!Number.isFinite(tx) || !Number.isFinite(ty) || magnitude < Number.EPSILON) throw new TypeError("Saber direction tracker: target must be a finite non-zero {x,y} vector");
      if (!Number.isFinite(nowMs) || !Number.isFinite(durationMs)) throw new TypeError("Saber direction tracker: nowMs/durationMs must be finite");
      const targetX = tx / magnitude, targetY = ty / magnitude;
      const targetQuaternion = quaternionFromEulerDeg({ x: 0, y: 0, z: Math.atan2(targetY, targetX) * 180 / Math.PI });
      let entry = hands.get(hand);
      if (entry === undefined) {
        entry = { start: targetQuaternion, target: targetQuaternion, targetX, targetY, startMs: nowMs, ease, durationMs: Math.max(0, durationMs) };
        hands.set(hand, entry);
      } else if (targetX !== entry.targetX || targetY !== entry.targetY || ease !== entry.ease || Math.max(0, durationMs) !== entry.durationMs) {
        const current = evaluate(entry, nowMs);
        entry = { start: current, target: targetQuaternion, targetX, targetY, startMs: nowMs, ease, durationMs: Math.max(0, durationMs) };
        hands.set(hand, entry);
      }
      return vector(evaluate(entry, nowMs));
    },
    reset() { hands.clear(); },
  });
}
