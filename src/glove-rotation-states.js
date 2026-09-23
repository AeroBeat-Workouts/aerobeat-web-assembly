// @ts-check
import { easeValue } from "./easing.js";
import { equipmentEulerDegreesToQuaternion, slerpEquipmentQuaternionShortest } from "@aerobeat/web-contracts";

const IDENTITY_QUATERNION = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });
// Re-export for backwards compatibility (C3 oracle imports easeValue from here).
export { easeValue };
// AeroBeat 0.0.63, bead 2m10 (child C3 of bead 376l; plan
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md, L-C design,
// D3 confirmed): BOXING GLOVE ROTATION STATES. The per-hand state selection
// plus config-driven easing feeds the animated quaternion composed into each
// canonical resolved boxing pose.
//
// Equipment records carry only their final contracts-owned orientation, while
// the config foundation defines boxing.glove with XYZ states, ease, and
// upcomingBeatWindowMs. This module owns ONLY the selection plus easing
// decision; it is plain data with no DOM/renderer/session imports so it stays
// unit-testable.
//
// SIGNED-OFF SEMANTICS (do not deviate):
//   1. Rotation states: straight / uppercut / hookL / hookR / guard.
//   2. PRIMARY selector is the upcoming beat: the NEXT boxing note for THIS
//      hand within upcomingBeatWindowMs ahead on the content timeline picks
//      the state by action type. Straight maps to straight, uppercut maps to
//      uppercut, hook maps to hookL for the left hand or hookR for the right
//      hand, and guard maps to guard. Camera-plane "up" is ambiguous because a
//      straight punch reads as up in camera space but is a toward-camera
//      motion in real space, so the upcoming beat is the PRIMARY selector.
//   3. FALLBACK is when no upcoming beat is in the window: the hand's recent
//      real motion from the exposed per-wrist history picks the state via a
//      simple deterministic threshold rule (see selectGloveState).
//   4. TRANSITION: the current rotation eases toward the target state angle
//      over ease.durationMs with the configured ease.type. All four standard
//      curves are implemented (linear, easeIn t^2, easeOut 1-(1-t)^2,
//      easeInOut 3t^2-2t^3). The curves live in the SHARED `./easing.js`
//      module (0.0.63 C4 extracted easeValue there); this module re-exports it
//      so the C3 oracle's import keeps working. State persists across frames
//      and resets when the session generation or mode changes.
//   5. Final record value = per-hand BASE rotation (C2) + eased state rotation.

/**
 * A normalized motion vector for ONE wrist, in the renderer's JUDGE space
 * (the SAME space `saberDirectionFromWristHistory` uses: +y = camera-plane
 * up, +x = right). Normalized to unit length (or zero when the displacement is
 * below the dead zone / the window has no motion).
 *
 * @typedef {Object} GloveMotionVector
 * @property {number} x - Normalized horizontal displacement (−1..1).
 * @property {number} y - Normalized vertical displacement (−1..1).
 */

/**
 * One boxing target's action, in the same space the renderer's projected
 * `targets` use (`kind` "punch"/"guard", `hand` left/right/both, `family`
 * straight/hook/uppercut/guard, `beatCenterMs` on the content timeline).
 *
 * @typedef {Object} GloveUpcomingAction
 * @property {"punch" | "guard"} kind - Target kind.
 * @property {"left" | "right" | "both"} hand - Target hand.
 * @property {"straight" | "hook" | "uppercut" | "guard"} family - Action family.
 * @property {number} beatCenterMs - Center timestamp on the content timeline.
 */

/**
 * Fixed 150 ms lookback window for the motion-fallback displacement
 * (`nowMs − GLOVE_MOTION_WINDOW_MS .. nowMs`), normalized by the window so the
 * result is a unit-ish velocity direction.
 */
export const GLOVE_MOTION_WINDOW_MS = 150;

/**
 * Dead zone on the normalized displacement (units of body-grid per millisecond):
 * if the window displacement divided by the window length is below this value,
 * the motion is treated as "low" (dead zone) and the fallback reads guard.
 * The values are in normalized body-grid units (0..1 over the whole frame),
 * so a visible sweep (e.g. 0.5 of the grid in 120 ms ≈ 0.004/ms) is well above
 * the dead zone, while sensor jitter (≲ 0.05 grid per window) stays below it.
 *
 * @type {number}
 */
export const GLOVE_MOTION_DEAD_ZONE = 0.0005;

/**
 * Dominance threshold (normalized) for the uppercut/hook fallback split: the
 * dominant axis must exceed BOTH this and the dead zone, AND exceed
 * `GLOVE_HOOK_DOMINANCE_RATIO` times the other axis.
 *
 * @type {number}
 */
export const GLOVE_AXIS_DOMINANCE = 0.3;

/**
 * The dominant axis must be at least this multiple of the other axis for the
 * uppercut/hook split (guards against a 45° diagonal reading as both).
 *
 * @type {number}
 */
export const GLOVE_HOOK_DOMINANCE_RATIO = 1.2;

/**
 * Select the glove rotation state for one hand.
 *
 * PRIMARY selector — `upcomingAction` (non-null): the action type picks the
 * state, with the hook side following the hand of the beat:
 *   - guard        → "guard"
 *   - straight     → "straight"
 *   - uppercut     → "uppercut"
 *   - hook         → "hookL" (left hand) / "hookR" (right hand)
 *
 * FALLBACK — `upcomingAction === null`: the recent real `motionVector` picks
 * the state with a simple, deterministic, threshold-based rule (documented in
 * the JSDoc of `gloveStateFromMotion` below):
 *   - dead zone / null        → "guard" (low motion, hand near guard)
 *   - dominant upward         → "uppercut"
 *   - dominant horizontal     → "hookL" (left) / "hookR" (right)
 *   - dominant straight-ish   → "straight"
 *
 * @param {"left" | "right"} hand - The hand being selected for.
 * @param {GloveMotionVector | null} motionVector - Normalized recent motion
 *   (unit-ish velocity) for the hand, or null when no usable motion window.
 * @param {GloveUpcomingAction | null} upcomingAction - The next boxing note for
 *   THIS hand within the upcoming window, or null when none is in the window.
 * @returns {"straight" | "uppercut" | "hookL" | "hookR" | "guard"} - The state key.
 */
export function selectGloveState(hand, motionVector, upcomingAction) {
  if (hand !== "left" && hand !== "right") throw new TypeError("Glove hand must be 'left' or 'right'");
  if (upcomingAction !== null) {
    const family = String(upcomingAction.family);
    if (family === "guard") return "guard";
    if (family === "straight") return "straight";
    if (family === "uppercut") return "uppercut";
    if (family === "hook") return hand === "left" ? "hookL" : "hookR";
    // Unknown family: degrade to the motion fallback (deterministic + safe).
  }
  return gloveStateFromMotion(hand, motionVector);
}

/**
 * Select the earliest projected Boxing action for each hand from the exact
 * target array carried by the frame that will be rendered. Punches apply to
 * their authored hand; guards apply to their authored hand or both hands.
 * Only targets inside the inclusive `[nowMs, nowMs + windowMs]` interval are
 * eligible. Input order is irrelevant except for equal-time ties, which retain
 * the first projected target as before.
 *
 * @param {ReadonlyArray<unknown>} targets - Projected targets from one renderer frame.
 * @param {number} nowMs - That frame's content-timeline position.
 * @param {number} windowMs - Configured upcoming-beat window.
 * @returns {{left: GloveUpcomingAction | null, right: GloveUpcomingAction | null}}
 */
export function boxingUpcomingActions(targets, nowMs, windowMs) {
  const out = { left: null, right: null };
  for (const target of Array.isArray(targets) ? targets : []) {
    const kind = String(target?.kind);
    const family = String(target?.family);
    const hand = String(target?.hand);
    const centerMs = Number(target?.beatCenterMs);
    if (!Number.isFinite(centerMs)) continue;
    if (centerMs < nowMs || centerMs > nowMs + windowMs) continue;
    let appliesTo = null;
    if (kind === "punch" && ["straight", "hook", "uppercut"].includes(family) && ["left", "right"].includes(hand)) appliesTo = [hand];
    else if (kind === "guard" && (hand === "both" || hand === "left" || hand === "right")) appliesTo = hand === "both" ? ["left", "right"] : [hand];
    else continue;
    for (const selectedHand of appliesTo) {
      if (out[selectedHand] === null || centerMs < out[selectedHand].beatCenterMs) {
        out[selectedHand] = Object.freeze({ kind, hand, family, beatCenterMs: centerMs });
      }
    }
  }
  return out;
}

/**
 * Motion-fallback state selection — the single deterministic rule, documented:
 *
 *   1. No vector, or |v| < `GLOVE_MOTION_DEAD_ZONE` (low motion) → "guard".
 *   2. Upward-dominant: `v.y > GLOVE_AXIS_DOMINANCE` AND
 *      `v.y >= GLOVE_HOOK_DOMINANCE_RATIO * |v.x|`  → "uppercut".
 *   3. Horizontal-dominant: `|v.x| > GLOVE_AXIS_DOMINANCE` AND
 *      `|v.x| >= GLOVE_HOOK_DOMINANCE_RATIO * |v.y|`
 *      → "hookL" (left hand) / "hookR" (right hand).
 *   4. Otherwise (fast, straight-ish, or diagonal motion) → "straight".
 *
 * The dead zone (1) and the upward branch (2) are checked BEFORE the
 * horizontal branch so a fast upward+forward diagonal (a straight punch reads
 * as "up" in camera space) resolves to uppercut only when it is clearly
 * up-dominant, and a clearly horizontal sweep resolves to a hook.
 *
 * @param {"left" | "right"} hand - The hand.
 * @param {GloveMotionVector | null} motionVector - Normalized motion vector.
 * @returns {"straight" | "uppercut" | "hookL" | "hookR" | "guard"} - The state key.
 */
function gloveStateFromMotion(hand, motionVector) {
  if (motionVector === null) return "guard";
  const vx = Number.isFinite(motionVector.x) ? motionVector.x : 0;
  const vy = Number.isFinite(motionVector.y) ? motionVector.y : 0;
  const mag = Math.hypot(vx, vy);
  if (mag < GLOVE_MOTION_DEAD_ZONE) return "guard"; // (1) dead zone / low motion
  const ax = Math.abs(vx), ay = Math.abs(vy);
  // (2) upward-dominant → uppercut
  if (vy > GLOVE_AXIS_DOMINANCE && ay >= GLOVE_HOOK_DOMINANCE_RATIO * ax) return "uppercut";
  // (3) horizontal-dominant → hook (side by hand)
  if (ax > GLOVE_AXIS_DOMINANCE && ax >= GLOVE_HOOK_DOMINANCE_RATIO * ay) return hand === "left" ? "hookL" : "hookR";
  // (4) otherwise → straight (fast / straight-ish / diagonal)
  return "straight";
}

/**
 * Compute a normalized motion vector for one wrist from its exposed
 * pre-push wrist-history (`saberWristHistory[role]`, entries `{t,x,y}` in
 * judge space, +y up / +x right). Uses the displacement between the EARLIEST
 * and LATEST samples inside the fixed `GLOVE_MOTION_WINDOW_MS` lookback
 * window ending at `nowMs`, normalized by the window length so the result is a
 * unit-ish velocity direction. Returns null (→ guard fallback) when the window
 * holds no usable span or the displacement is below the dead zone.
 *
 * @param {ReadonlyArray<Readonly<{t: number, x: number, y: number}>> | null | undefined} history -
 *   The coordinator's own pre-push wrist-history for the wrist.
 * @param {number} nowMs - The session `timestampMs` the history was judged with.
 * @param {number} [windowMs] - Lookback window in ms (default `GLOVE_MOTION_WINDOW_MS`).
 * @returns {GloveMotionVector | null} - Unit-length {x,y} direction, or null when the
 *   usable span is empty / sub-dead-zone.
 */
export function gloveMotionVector(history, nowMs, windowMs = GLOVE_MOTION_WINDOW_MS) {
  if (!Array.isArray(history)) return null;
  const windowStart = nowMs - windowMs;
  let first = null;
  let last = null;
  for (const sample of history) {
    if (sample === null || typeof sample !== "object") continue;
    const t = Number(sample.t), x = Number(sample.x), y = Number(sample.y);
    if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (t < windowStart || t > nowMs) continue;
    if (first === null || t < first.t) first = { t, x, y };
    if (last === null || t >= last.t) last = { t, x, y };
  }
  if (first === null || last === null || last.t <= first.t) return null;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const mag = Math.hypot(dx, dy);
  // Dead zone is applied to the DISPLACEMENT magnitude (normalized units / window),
  // NOT the unit direction — normalizing first would collapse every non-zero
  // motion to length 1 and silently kill the dead-zone gate.
  if (mag / windowMs < GLOVE_MOTION_DEAD_ZONE) return null;
  return Object.freeze({ x: dx / mag, y: dy / mag });
}

// NOTE (0.0.63 C4): `easeValue` moved to the shared `./easing.js` module and
// is re-exported above, so `import { easeValue } from "./glove-rotation-states.js"`
// keeps working unchanged.

/**
 * Per-hand fixed-endpoint quaternion transition tracker. Each retarget first
 * evaluates the old transition at the retarget instant, then captures that pose
 * as the immutable start of a shortest-path slerp to the new Euler target.
 * Dense and sparse ticks therefore resolve identically for the same timestamps.
 */
export function createGloveRotationTracker() {
  /** @type {Map<"left" | "right", {start: Readonly<{x:number,y:number,z:number,w:number}>, target: Readonly<{x:number,y:number,z:number,w:number}>, targetKey:string, startMs:number, ease:"linear"|"easeIn"|"easeOut"|"easeInOut", durationMs:number}>} */
  const hands = new Map();
  const evaluate = (entry, nowMs) => {
    const t = entry.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs - entry.startMs) / entry.durationMs));
    return slerpEquipmentQuaternionShortest(entry.start, entry.target, easeValue(t, entry.ease));
  };
  return Object.freeze({
    /** @returns {Readonly<{x:number,y:number,z:number,w:number}>} */
    tick(hand, targetEulerDeg, nowMs, ease, durationMs) {
      if (hand !== "left" && hand !== "right") throw new TypeError("Glove hand must be 'left' or 'right'");
      if (!Number.isFinite(nowMs) || !Number.isFinite(durationMs)) throw new TypeError("Glove rotation tracker: nowMs/durationMs must be finite");
      const target = equipmentEulerDegreesToQuaternion(targetEulerDeg);
      const targetKey = `${target.x},${target.y},${target.z},${target.w}`;
      let entry = hands.get(hand);
      if (entry === undefined) {
        entry = { start: IDENTITY_QUATERNION, target, targetKey, startMs: nowMs, ease, durationMs: Math.max(0, durationMs) };
        hands.set(hand, entry);
      } else if (targetKey !== entry.targetKey || ease !== entry.ease || Math.max(0, durationMs) !== entry.durationMs) {
        const current = evaluate(entry, nowMs);
        entry = { start: current, target, targetKey, startMs: nowMs, ease, durationMs: Math.max(0, durationMs) };
        hands.set(hand, entry);
      }
      return evaluate(entry, nowMs);
    },
    reset() { hands.clear(); },
  });
}
