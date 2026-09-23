// @ts-check

const TRACKING = Object.freeze({
  gameplayPaused: false,
  freshCalibrationRequired: false,
  allRequiredAnchorsVisible: true,
  anchorsFrozen: false,
  degradedAnchors: Object.freeze([])
});

const DEFAULT_POSITIONS = Object.freeze({
  left: Object.freeze({ x: 0, y: 0.5 }),
  right: Object.freeze({ x: 1, y: 0.5 })
});

export const testEquipmentMouseHands = Object.freeze(["off", "left", "right"]);

/** @param {number} value */
function clampUnit(value) { return Math.min(1, Math.max(0, value)); }

/**
 * Normalize one client-space point against the canvas CSS box. Backing-store
 * pixels and DPR are deliberately irrelevant to the body-grid input contract.
 *
 * @param {unknown} clientX
 * @param {unknown} clientY
 * @param {unknown} bounds
 * @returns {Readonly<{x:number,y:number}> | null}
 */
export function normalizedTestEquipmentPointer(clientX, clientY, bounds) {
  if (typeof clientX !== "number" || !Number.isFinite(clientX) || typeof clientY !== "number" || !Number.isFinite(clientY) || !bounds || typeof bounds !== "object") return null;
  const left = Number(bounds.left), top = Number(bounds.top), width = Number(bounds.width), height = Number(bounds.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return Object.freeze({ x: clampUnit((clientX - left) / width), y: clampUnit((clientY - top) / height) });
}

/**
 * Build renderer-only deterministic Test wrist evidence. Only the selected
 * wrist may use the latest finite pointer point; the other stays anchored.
 *
 * @param {unknown} selectedHand
 * @param {unknown} pointerPosition
 */
export function testEquipmentInput(selectedHand = "off", pointerPosition = null) {
  const hand = testEquipmentMouseHands.includes(String(selectedHand)) ? String(selectedHand) : "off";
  const finitePointer = pointerPosition && typeof pointerPosition === "object" && Number.isFinite(pointerPosition.x) && Number.isFinite(pointerPosition.y)
    ? Object.freeze({ x: clampUnit(Number(pointerPosition.x)), y: clampUnit(Number(pointerPosition.y)) })
    : null;
  const anchor = (/** @type {"left"|"right"} */ side) => {
    const point = hand === side && finitePointer ? finitePointer : DEFAULT_POSITIONS[side];
    return Object.freeze({ anchor: `${side}_wrist`, valid: true, x: point.x, y: point.y, confidence: 1 });
  };
  return Object.freeze({
    tracking: TRACKING,
    countdownFrozen: false,
    retainedGeometryDimmed: false,
    anchors: Object.freeze([anchor("left"), anchor("right")])
  });
}
