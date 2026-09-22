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
//   - Center zone = NEUTRAL: `center.rotationDeg === null` keeps the
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
//                      (center rotationDeg null → û(fallbackDir))
//   Output:            normalize(v); if |v| < 1e-6 → fallbackDir (degenerate
//                      cancel, e.g. fully opposite zone weights).

import { easeValue } from "./easing.js";

/**
 * A unit direction vector in judge space (+x right, +y up).
 *
 * @typedef {Object} DirectionVector
 * @property {number} x - Horizontal component (−1..1).
 * @property {number} y - Vertical component (−1..1).
 */

/**
 * Flow saber zone key. `center` is the neutral zone (rotationDeg may be null).
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
 *   - `zones.<key>.rotationDeg` null (the center default) → the center vector
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
 *   edgeTop: Readonly<{rotationDeg: number}>,
 *   edgeBottom: Readonly<{rotationDeg: number}>,
 *   edgeLeft: Readonly<{rotationDeg: number}>,
 *   edgeRight: Readonly<{rotationDeg: number}>,
 *   center: Readonly<{rotationDeg: number | null}>
 * }>} zones - Per-zone configured in-plane angles (from `flow.saber.zones`).
 * @param {number} blendRadius - Distance-blend radius in grid units (from `flow.saber.blendRadius`).
 * @returns {Readonly<{x: number, y: number}>} - Unit direction vector (or `fallbackDir` normalized for the neutral/degenerate cases).
 * @throws {TypeError} On non-finite x/y/blendRadius or a non-finite edge rotationDeg.
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
    const rotationDeg = Number(zones[key].rotationDeg);
    if (!Number.isFinite(rotationDeg)) throw new TypeError(`zoneDirection: ${key}.rotationDeg must be a finite number`);
    if (w[key] <= 0) continue;
    const u = zoneAngleToVector(rotationDeg);
    vx += w[key] * u.x;
    vy += w[key] * u.y;
  }

  const centerRotationDeg = zones.center.rotationDeg;
  const centerVec = centerRotationDeg === null ? fallback : zoneAngleToVector(centerRotationDeg);
  vx += w.center * centerVec.x;
  vy += w.center * centerVec.y;

  const mag = Math.hypot(vx, vy);
  if (mag < DEGENERATE_EPSILON) return fallback; // degenerate cancel → neutral
  return Object.freeze({ x: vx / mag, y: vy / mag });
}

/**
 * Per-hand flow saber direction tracker — the C4 stateful vector easing,
 * mirroring the C3 glove-rotation tracker structure (per-hand entries,
 * mid-ease retarget from the current value, snap on durationMs <= 0,
 * `reset()` on session generation change).
 *
 * Easing model (documented choice): the CURRENT eased direction vector is
 * SLEPt toward the target via SHORTEST-ARC ANGLE INTERPOLATION. Each tick:
 *   1. If the target (or ease config) changed, retarget: start a fresh ease
 *      FROM THE CURRENT EASED VECTOR at `nowMs` (no snap).
 *   2. Normalize the stored current vector (it may be a mid-retarget blend
 *      and is therefore not exactly unit).
 *   3. Δ = shortest signed angle from current to target (−180..180).
 *   4. eased = current rotated by Δ · easeValue(clamped progress, ease).
 *   5. If progress >= 1, snap exactly onto the target.
 *
 * Shortest-arc rotation is mathematically equivalent to slerp on the 2-D
 * unit circle and — unlike naive component lerp + normalize — stays stable
 * when the vectors are near-parallel (no cancellation in the denominator; a
 * 179 deg turn never takes the 181 deg long way) and never produces a
 * zero-length intermediate. First tick for a hand starts at the target
 * (the field is the authoritative source; there is no prior frame to ease
 * from), matching the C3 tracker's fresh-hand behavior.
 *
 * @returns {{
 *   tick: (hand: "left" | "right", target: Readonly<{x: number, y: number}>, nowMs: number, ease: "linear" | "easeIn" | "easeOut" | "easeInOut", durationMs: number) => Readonly<{x: number, y: number}>,
 *   reset: () => void
 * }}
 */
export function createSaberDirectionTracker() {
  /** @type {Map<"left" | "right", {x: number, y: number, targetX: number, targetY: number, startMs: number, ease: "linear" | "easeIn" | "easeOut" | "easeInOut", durationMs: number}>} */
  const hands = new Map();
  return Object.freeze({
    /**
     * Ease one hand's direction toward `target` and return the current
     * eased unit vector. A changed target/ease/duration starts a fresh ease
     * from the current eased vector at `nowMs`; durationMs <= 0 snaps.
     *
     * @param {"left" | "right"} hand - The hand.
     * @param {Readonly<{x: number, y: number}>} target - The zone-field direction target for this frame.
     * @param {number} nowMs - The current session timeline position (ms).
     * @param {"linear" | "easeIn" | "easeOut" | "easeInOut"} ease - The configured ease type.
     * @param {number} durationMs - The configured ease duration (ms; <= 0 snaps).
     * @returns {Readonly<{x: number, y: number}>} - The hand's current eased unit direction.
     */
    tick(hand, target, nowMs, ease, durationMs) {
      if (hand !== "left" && hand !== "right") throw new TypeError("Saber direction tracker: hand must be 'left' or 'right'");
      const tx = Number(target?.x), ty = Number(target?.y);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) throw new TypeError("Saber direction tracker: target must be a finite {x,y} vector");
      if (!Number.isFinite(nowMs) || !Number.isFinite(durationMs)) throw new TypeError("Saber direction tracker: nowMs/durationMs must be finite");
      let entry = hands.get(hand);
      if (entry === undefined) {
        // First tick: the zone field is the authoritative source, so start
        // directly AT the target (mirrors the C3 fresh-hand convention).
        entry = { x: tx, y: ty, targetX: tx, targetY: ty, startMs: nowMs, ease, durationMs: Math.max(0, durationMs) };
        hands.set(hand, entry);
        return Object.freeze({ x: tx, y: ty });
      }
      const tMag = Math.hypot(tx, ty);
      if (tMag < Number.EPSILON) throw new TypeError("Saber direction tracker: target must be non-zero");
      const ntx = tx / tMag, nty = ty / tMag;
      if (ntx !== entry.targetX || nty !== entry.targetY || ease !== entry.ease || durationMs !== entry.durationMs) {
        // Retarget (or config change): fresh ease from the CURRENT eased
        // vector at the current time (no snap) — C3 semantics.
        entry = { x: entry.x, y: entry.y, targetX: ntx, targetY: nty, startMs: nowMs, ease, durationMs: Math.max(0, durationMs) };
        hands.set(hand, entry);
      }
      const cm = Math.hypot(entry.x, entry.y);
      if (cm < Number.EPSILON) {
        // Defensive: current vanished (should be unreachable) → start from target.
        entry.x = entry.targetX; entry.y = entry.targetY;
      } else {
        const cx = entry.x / cm, cy = entry.y / cm;
        const theta = Math.atan2(cy, cx);
        const phi = Math.atan2(entry.targetY, entry.targetX);
        // Shortest signed arc from current to target: wrap into (−180, 180].
        let delta = phi - theta;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta <= -Math.PI) delta += 2 * Math.PI;
        const t = entry.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs - entry.startMs) / entry.durationMs));
        const eased = delta * easeValue(t, entry.ease);
        const angle = theta + eased;
        entry.x = Math.cos(angle);
        entry.y = Math.sin(angle);
        if (t >= 1) { entry.x = entry.targetX; entry.y = entry.targetY; }
      }
      return Object.freeze({ x: entry.x, y: entry.y });
    },
    /** Clear every hand's state (call on session generation change). */
    reset() { hands.clear(); },
  });
}
