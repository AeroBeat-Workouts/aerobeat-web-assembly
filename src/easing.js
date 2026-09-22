// @ts-check
// AeroBeat 0.0.63, bead 6ax2 (child C4 of bead 376l; plan
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-success.md, L-C design,
// D4 confirmed): SHARED EASING. The four standard ease curves, extracted
// (unmoved, byte-identical behavior) from `./glove-rotation-states.js` (C3)
// so the flow saber zone-direction tracker (C4, `./saber-zone-direction.js`)
// and the boxing glove rotation tracker (C3) share one implementation.
//
// Pure module: no DOM/renderer/session imports; plain math only.

/**
 * Ease a normalized progress value `t` (clamped to 0..1) with the configured
 * ease `type`. All four standard curves:
 *   - "linear":    t
 *   - "easeIn":    t²
 *   - "easeOut":   1 − (1−t)²
 *   - "easeInOut": 3t² − 2t³  (smoothstep; t=0 → 0, t=0.5 → 0.5, t=1 → 1)
 *
 * @param {number} t - Normalized progress (any real; clamped to 0..1).
 * @param {"linear" | "easeIn" | "easeOut" | "easeInOut"} type - The ease type.
 * @returns {number} - Eased progress in 0..1.
 * @throws {TypeError} When `t` is not finite or `type` is not an allowed ease type.
 */
export function easeValue(t, type) {
  if (!Number.isFinite(t)) throw new TypeError("easeValue: t must be a finite number");
  const c = Math.max(0, Math.min(1, t));
  switch (type) {
    case "linear": return c;
    case "easeIn": return c * c;
    case "easeOut": return 1 - (1 - c) * (1 - c);
    case "easeInOut": return c * c * (3 - 2 * c);
    default: throw new TypeError(`easeValue: unknown ease type "${type}"`);
  }
}
