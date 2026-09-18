// @ts-check

import { saberDirectionFromWristHistory } from "@aerobeat/web-gameplay";

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
 *   - suppressed (→ `[]`) when: the menu is open, the session purpose is
 *     `visual_test`, the session state is not `countdown`/`playing`,
 *     `tracking.gameplayPaused`, `tracking.freshCalibrationRequired`, or
 *     `input.countdownFrozen`;
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
 *   `{ role, x, y, mode, dimmed?, direction? }`
 *
 * where `x`/`y` are the normalized body-grid anchor positions (0..1) the
 * renderer stages on, and `mode` is the active equipment mode
 * (`"flow"` | `"boxing"`), passed by the caller from the active session's
 * ruleset.
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
 * @returns {ReadonlyArray<Readonly<{ role: "left_wrist" | "right_wrist", x: number, y: number, mode: "flow" | "boxing", dimmed?: boolean, direction?: Readonly<{x: number, y: number}> }>>}
 */
export function gameplayEquipmentRecords(menuOpen, session, input, mode, saberWristHistory = null) {
  if (mode !== "flow" && mode !== "boxing") return Object.freeze([]);
  if (menuOpen || session?.purpose === "visual_test" || !["countdown", "playing"].includes(String(session?.state ?? ""))) return Object.freeze([]);
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
    const record = { role, x: anchor.x, y: anchor.y, mode };
    if (anchorsFrozen) record.dimmed = degraded.has(role);
    if (mode === "flow") {
      // The coordinator's OWN pre-push wrist-history for this wrist (the exact
      // arrays the saber capsule was oriented from). A missing/empty history
      // degrades to the shared fallback direction, the same degenerate-safe
      // result the hit capsule uses.
      const history = (saberWristHistory !== null && typeof saberWristHistory === "object" && Array.isArray(saberWristHistory[role])) ? saberWristHistory[role] : Object.freeze([]);
      record.direction = saberDirectionFromWristHistory(history, nowMs);
    }
    return [Object.freeze(record)];
  }));
}
