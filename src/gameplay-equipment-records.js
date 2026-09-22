// @ts-check

import { saberDirectionFromWristHistory } from "@aerobeat/web-gameplay";
import { validateEquipmentConfig } from "./equipment-config.js";
import { equipmentConfigDefaults } from "./equipment-config-defaults.js";
import { SABER_ZONE_ANCHORS, zoneDirection } from "./saber-zone-direction.js";

/**
 * 0.0.61 L-F4 (chgy/hk5q/vths): build gameplay equipment records from the live
 * input snapshot.
 *
 * Equipment (Flow saber beam / Boxing glove) REPLACES the legacy wrist + nose
 * markers as the visible + detection surface (GATE 1: sabers/gloves are the
 * hit volumes; all wrist markers and the nose marker are hidden). This module
 * mirrors the `gameplayCursorRecords` gates EXACTLY so equipment visibility
 * tracks the same tracking-freeze / suppression truth:
 *
 *   - suppressed (→ `[]`) when: the menu is open, the session state is not
 *     `countdown`/`playing` (or `paused_manual` for `visual_test` only),
 *     `tracking.gameplayPaused`, `tracking.freshCalibrationRequired`, or
 *     `input.countdownFrozen`. 0.0.63 C2: the `visual_test` purpose no longer
 *     suppresses equipment — Test mode shows live markers + equipped models
 *     (I-4). 0.0.66 admits paused authoring without admitting paused Play or
 *     weakening any tracking, calibration, countdown, or anchor gate;
 *   - the per-anchor gate (`valid === true`, finite `x`/`y`,
 *     `confidence >= 0.5`) applies per wrist role;
 *   - a mid-run tracking freeze (`tracking.anchorsFrozen === true`) bypasses
 *     the `allRequiredAnchorsVisible` / `retainedGeometryDimmed` suppression
 *     and still emits the retained last-good wrists, with `dimmed` set only
 *     for the roles named in `tracking.degradedAnchors`; without a freeze the
 *     `dimmed` key is absent.
 *
 * One record is emitted per visible wrist role (`left_wrist` / `right_wrist`;
 * the nose has no head model and is never emitted):
 *
 *   `{ role, x, y, mode, scale, rotationZDeg, dimmed?, direction? }`
 *
 * where `x`/`y` are finite body-grid anchor positions (they may exceed 0..1
 * while a confident wrist is outside the calibrated grid; the renderer bounds
 * presentation and gameplay rejects off-grid scoring), `mode` is the active equipment mode
 * (`"flow"` | `"boxing"`), passed by the caller from the active session's
 * ruleset, and `scale` / `rotationZDeg` are the per-hand BASE transform for
 * the active mode resolved from the validated equipment config
 * (`config[mode].perHand[role]`, left_wrist→left / right_wrist→right). The
 * 0.0.63 C2 base transform rides EVERY equipment record so Test mode can show
 * the equipped models scaled/rotated; cursor records carry no transform.
 * 0.0.63 C3 (2m10): for boxing, `rotationZDeg` = base + the eased per-hand
 * STATE rotation passed in `boxingStateRotations` (straight/uppercut/hook/
 * guard beat state, see `./glove-rotation-states.js`); absent or null → base
 * only (state rotation 0).
 * 0.0.63 C4 (6ax2): for flow, `direction` is the per-hand EASED ZONE
 * direction passed in `flowZoneDirections` (grid-zone map blended + eased by
 * `./saber-zone-direction.js`, with the motion-derived direction as the
 * neutral/fallback vector); absent or null → the existing motion-only
 * re-derivation below (ALL existing callers/oracles keep passing unchanged).
 *
 * VISUAL == HIT invariant (the F2-class "what you see is what hits" rule):
 * for `mode === "flow"`, `direction` is a JUDGE-space unit vector re-derived
 * HERE by calling the SAME pure `saberDirectionFromWristHistory` the gameplay
 * coordinator uses to orient the saber hit capsule — on the coordinator's OWN
 * per-wrist PRE-push wrist-history (exposed on the coordinator snapshot's
 * `saberWristHistory` field) and the SAME `session.timestampMs` that history
 * was judged with, with the same default fallback and 100 ms window. Because
 * the visible beam and the hit capsule are oriented by one shared function on
 * one shared history, the visible beam IS the hit volume by construction —
 * there is no second, independently-driftable copy of the direction logic.
 * For `mode === "boxing"`, `direction` is absent: the glove is an
 * axis-aligned volume whose orientation is fixed by the shared equipment
 * contract, not by wrist motion.
 *
 * @param {boolean} menuOpen
 * @param {unknown} session
 * @param {unknown} input
 * @param {"flow" | "boxing"} mode
 * @param {Readonly<{ left_wrist: ReadonlyArray<Readonly<{t: number, x: number, y: number}>> | null, right_wrist: ReadonlyArray<Readonly<{t: number, x: number, y: number}>> | null }> | null} [saberWristHistory]
 * @param {Readonly<{left: number, right: number}> | null} [boxingStateRotations]
 * @param {Readonly<{
 *   left: Readonly<{x: number, y: number, position?: Readonly<{x: number, y: number}>}>,
 *   right: Readonly<{x: number, y: number, position?: Readonly<{x: number, y: number}>}>
 * } | null} [flowZoneDirections]
 * @param {unknown} [equipmentConfig]
 * @returns {ReadonlyArray<Readonly<{ role: "left_wrist" | "right_wrist", x: number, y: number, mode: "flow" | "boxing", scale: number, rotationZDeg: number, dimmed?: boolean, direction?: Readonly<{x: number, y: number}> }>>}
 */
export function gameplayEquipmentRecords(menuOpen, session, input, mode, saberWristHistory = null, boxingStateRotations = null, flowZoneDirections = null, equipmentConfig = equipmentConfigDefaults) {
  if (mode !== "flow" && mode !== "boxing") return Object.freeze([]);
  const state = String(session?.state ?? "");
  const pausedVisualTest = state === "paused_manual" && session?.purpose === "visual_test";
  if (menuOpen || (!pausedVisualTest && state !== "countdown" && state !== "playing")) return Object.freeze([]);
  // 0.0.63 C2: resolve the active mode's validated config once; per-hand base
  // transform comes from config[mode].perHand.<left|right>.
  const perHand = validateEquipmentConfig(equipmentConfig)[mode].perHand;
  const handKey = (role) => (role === "left_wrist" ? "left" : "right");
  // 0.0.63 C3 (2m10): optional per-hand STATE rotations (boxing glove beat
  // states). When present and the record's hand has a finite value, the record's
  // rotationZDeg = C2 BASE rotation + eased STATE rotation (signed-off C3 sum).
  // Absent/null or non-finite → base rotation only (state rotation 0), so all
  // existing callers/oracles keep working unchanged.
  const stateRotations =
    boxingStateRotations !== null && typeof boxingStateRotations === "object" ? boxingStateRotations : null;
  const stateRotationFor = (hand) => {
    if (stateRotations === null) return 0;
    const value = Number(stateRotations[hand]);
    return Number.isFinite(value) ? value : 0;
  };
  const tracking = input?.tracking;
  if (!tracking || tracking.gameplayPaused === true || tracking.freshCalibrationRequired === true || input?.countdownFrozen === true) return Object.freeze([]);
  const anchorsFrozen = tracking.anchorsFrozen === true;
  // 0.0.61 L-F4: a mid-run freeze keeps the frozen wrists visible (dimmed per
  // degraded anchor); without a freeze, equipment stays hidden until every
  // required anchor is visible and retained geometry is not dimmed.
  if (!anchorsFrozen && (tracking.allRequiredAnchorsVisible !== true || input?.retainedGeometryDimmed === true)) return Object.freeze([]);
  const degraded = new Set(Array.isArray(tracking.degradedAnchors) ? tracking.degradedAnchors : []);
  const byRole = new Map((Array.isArray(input?.anchors) ? input.anchors : []).map((anchor) => [anchor?.anchor, anchor]));
  const nowMs = Number(session?.timestampMs);
  return Object.freeze(["left_wrist", "right_wrist"].flatMap((role) => {
    const anchor = byRole.get(role);
    if (anchor?.valid !== true || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !Number.isFinite(anchor.confidence) || anchor.confidence < 0.5) return [];
    const base = perHand[handKey(role)];
    const state = mode === "boxing" ? stateRotationFor(handKey(role)) : 0;
    const record = { role, x: anchor.x, y: anchor.y, mode, scale: base.scale, rotationZDeg: base.rotationZDeg + state };
    if (anchorsFrozen) record.dimmed = degraded.has(role);
    if (mode === "flow") {
      if (flowZoneDirections !== null) {
        // 0.0.63 C4 (6ax2): the caller computed the eased grid-zone direction
        // for this hand (with the motion-derived direction folded in as the
        // neutral-center vector) — use it, no re-derivation.
        record.direction = Object.freeze({ x: Number(flowZoneDirections[handKey(role)].x), y: Number(flowZoneDirections[handKey(role)].y) });
      } else {
        // The coordinator's OWN pre-push wrist-history for this wrist (the exact
        // arrays the saber capsule was oriented from). A missing/empty history
        // degrades to the shared fallback direction, the same degenerate-safe
        // result the hit capsule uses.
        const history = (saberWristHistory !== null && typeof saberWristHistory === "object" && Array.isArray(saberWristHistory[role])) ? saberWristHistory[role] : Object.freeze([]);
        record.direction = saberDirectionFromWristHistory(history, nowMs);
      }
    }
    return [Object.freeze(record)];
  }));
}
