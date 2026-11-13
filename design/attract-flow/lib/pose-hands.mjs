// Two independent wrists driving the same selection rule as ../style-comps/_shared/hands.mjs.
//
// hands.mjs (shared, unchanged) simulates both wrists from one mouse pointer: two discs a
// fixed WRIST_SPREAD apart. Real pose tracking gives two wrists that move independently,
// and hands.mjs has no input for that yet (its header says real tracking "will replace
// setPointer() later"). This module is that missing input, kept separate so the shared
// file stays untouched. It reads target rectangles from the hands instance
// (hands.targetsOnScreen()) and applies the identical rule with the same constants:
//   - a wrist is on a target when its WRIST_DIAMETER disc overlaps the target rectangle;
//   - one wrist hovers; both wrists on the same target arm it; it selects after HOLD_MS;
//   - after selecting, both wrists must leave before that target can fire again.
// Suggested follow-up: fold this into hands.mjs as hands.setWrists(left, right).

import { HOLD_MS, WRIST_DIAMETER } from '../../style-comps/_shared/hands.mjs';

export { HOLD_MS, WRIST_DIAMETER };

function overlapArea(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}
function discRect(p) {
  const r = WRIST_DIAMETER / 2;
  return { left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r };
}

/**
 * @param {{ targetsOnScreen: () => Record<string, {left:number,top:number,right:number,bottom:number}> }} hands
 */
export function createPoseHands(hands) {
  const handlers = new Map(); // name -> { onHover, onArm, onSelect }
  const hovered = new Set();
  let arming = null; // { name, startedAt }
  let consumed = null;

  function hits(wrist, rects) {
    if (!wrist) return [];
    const disc = discRect(wrist);
    const out = [];
    for (const [name, rect] of Object.entries(rects)) {
      if (!handlers.has(name)) continue;
      const area = overlapArea(disc, rect);
      if (area > 0) out.push({ name, area });
    }
    return out;
  }
  const best = (list) => list.reduce((top, h) => (!top || h.area > top.area ? h : top), null)?.name ?? null;
  function agreement(a, b) {
    const other = new Map(b.map((h) => [h.name, h.area]));
    let top = null, share = 0;
    for (const h of a) {
      const o = other.get(h.name);
      if (o === undefined) continue;
      const s = Math.min(h.area, o);
      if (s > share) { share = s; top = h.name; }
    }
    return top;
  }
  function setHover(name, on) {
    if (on === hovered.has(name)) return;
    if (on) hovered.add(name); else hovered.delete(name);
    handlers.get(name)?.onHover?.(on);
  }
  function cancelArming() {
    if (!arming) return;
    handlers.get(arming.name)?.onArm?.(0);
    arming = null;
  }

  /** wrists: [left, right] in canvas CSS px, or null for a wrist that is not visible. */
  function update(wrists, now = performance.now()) {
    const rects = hands.targetsOnScreen();
    const [l, r] = wrists;
    const lh = hits(l, rects), rh = hits(r, rects);
    const hl = best(lh), hr = best(rh);
    const agree = l && r ? agreement(lh, rh) : null;
    for (const name of handlers.keys()) setHover(name, name === hl || name === hr || name === agree);
    if (consumed) {
      if (agree !== consumed) consumed = null;
      else { cancelArming(); return; }
    }
    if (!agree) { cancelArming(); return; }
    if (!arming || arming.name !== agree) { cancelArming(); arming = { name: agree, startedAt: now }; }
    const progress = Math.min(1, (now - arming.startedAt) / HOLD_MS);
    handlers.get(agree)?.onArm?.(progress);
    if (progress >= 1) {
      consumed = agree;
      arming = null;
      handlers.get(agree)?.onArm?.(0);
      handlers.get(agree)?.onSelect?.();
    }
  }

  function clear() {
    for (const name of [...hovered]) setHover(name, false);
    cancelArming();
  }

  return {
    register(name, h) { handlers.set(name, h); },
    update,
    clear,
  };
}
