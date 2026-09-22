// @ts-check

/**
 * 0.0.60 W4-C2b (F4): build gameplay cursor records from the live input snapshot.
 *
 * Records carry normalized body-grid anchor positions for the hand/nose
 * markers the renderer draws: { role, x, y, confidence }.
 *
 * While a calibrated mid-run tracking freeze is active
 * (tracking.anchorsFrozen === true), the retained last-good anchors are still
 * emitted — with a per-record `dimmed` flag — so the renderer can dim only the
 * specifically lost markers (those named in tracking.degradedAnchors) and
 * restore full brightness when they return. The freeze bypasses the
 * retained-geometry and all-anchors-visible suppressions that would otherwise
 * hide the markers during tracking loss; every other suppression (menu open,
 * non-countdown/playing state, gameplay pause, fresh calibration required,
 * countdown frozen) still applies. 0.0.63 C2: the `visual_test` purpose no
 * longer suppresses cursors — Test mode shows live markers (I-4).
 *
 * @param {boolean} menuOpen
 * @param {unknown} session
 * @param {unknown} input
 * @returns {ReadonlyArray<Readonly<{ role: string, x: number, y: number, confidence: number, dimmed?: boolean }>>}
 */
export function gameplayCursorRecords(menuOpen, session, input) {
  if (menuOpen || !["countdown", "playing"].includes(String(session?.state ?? ""))) return Object.freeze([]);
  const tracking = input?.tracking;
  if (!tracking || tracking.gameplayPaused === true || tracking.freshCalibrationRequired === true || input?.countdownFrozen === true) return Object.freeze([]);
  const anchorsFrozen = tracking.anchorsFrozen === true;
  // 0.0.60 F4: a mid-run freeze keeps the frozen markers visible (dimmed per
  // degraded anchor); without a freeze, markers stay hidden until every
  // required anchor is visible and retained geometry is not dimmed.
  if (!anchorsFrozen && (tracking.allRequiredAnchorsVisible !== true || input?.retainedGeometryDimmed === true)) return Object.freeze([]);
  const degraded = new Set(Array.isArray(tracking.degradedAnchors) ? tracking.degradedAnchors : []);
  const roles = ["nose", "left_wrist", "right_wrist"];
  const byRole = new Map((Array.isArray(input?.anchors) ? input.anchors : []).map((anchor) => [anchor?.anchor, anchor]));
  return Object.freeze(roles.flatMap((role) => {
    const anchor = byRole.get(role);
    if (anchor?.valid !== true || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !Number.isFinite(anchor.confidence) || anchor.confidence < 0.5) return [];
    const record = { role, x: anchor.x, y: anchor.y, confidence: anchor.confidence };
    if (anchorsFrozen) record.dimmed = degraded.has(role);
    return [Object.freeze(record)];
  }));
}
