// Shared two-wrist selection for world-space PlayCanvas comps.
//
// Every style comp uses this module unchanged, so comps differ only in look.
// It ports the rule proven in design/hand-ui/assets/app.js to world space:
//   - each wrist is a disc; a wrist is "on" a target when its disc overlaps the
//     target's projected screen rectangle at all;
//   - either wrist alone hovers;
//   - both wrists overlapping the same target arm it, and it selects after HOLD_MS;
//   - after selecting, both wrists must leave before that target can fire again.
//
// Targets are 3D entities. Their screen rectangle is recomputed every frame from
// the world bounds of their render components, so animated or bobbing targets work.
//
// This module draws nothing. Each comp renders its own wrist markers and target
// feedback in its own style, using the state passed to its callbacks.
//
// Input here is simulated from the mouse: the pointer is the midpoint between two
// wrists WRIST_SPREAD apart. Real pose tracking will replace setPointer() later.

import * as pc from './playcanvas.min.mjs';

export const HOLD_MS = 520;
export const WRIST_SPREAD = 48;
export const WRIST_DIAMETER = 56;

function overlapArea(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function discRect(x, y) {
  const r = WRIST_DIAMETER / 2;
  return { left: x - r, right: x + r, top: y - r, bottom: y + r };
}

/**
 * @param {pc.AppBase} app
 * @param {pc.Entity} cameraEntity entity with a camera component
 */
export function createHands(app, cameraEntity) {
  const canvas = app.graphicsDevice.canvas;
  const targets = [];
  const state = {
    enabled: true,
    pointer: null,            // {x, y} in canvas CSS pixels, or null when off-canvas
    wrists: [null, null],     // [{x, y}, {x, y}] or nulls
    hover: [null, null],      // target per wrist
    arming: null,             // { target, startedAt }
    consumed: null,
  };
  const listeners = new Set();

  const corner = new pc.Vec3();
  const screen = new pc.Vec3();

  function screenRect(target) {
    const aabb = new pc.BoundingBox();
    let first = true;
    const renders = target.entity.findComponents('render');
    for (const render of renders) {
      if (!render.enabled || !render.entity.enabled) continue;
      for (const mi of render.meshInstances) {
        if (first) { aabb.copy(mi.aabb); first = false; } else aabb.add(mi.aabb);
      }
    }
    if (first) return null;
    const min = aabb.getMin();
    const max = aabb.getMax();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let i = 0; i < 8; i += 1) {
      corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
      cameraEntity.camera.worldToScreen(corner, screen);
      if (screen.z < 0) return null; // behind the camera
      left = Math.min(left, screen.x); right = Math.max(right, screen.x);
      top = Math.min(top, screen.y); bottom = Math.max(bottom, screen.y);
    }
    // Optional inset so a target's hit area can be tighter than its visual bounds
    // (for example a bubble with a large glow halo).
    const inset = target.inset ?? 0;
    return { left: left + inset, top: top + inset, right: right - inset, bottom: bottom - inset };
  }

  function overlapped(wrist, rects) {
    const disc = discRect(wrist.x, wrist.y);
    const hits = [];
    for (const [target, rect] of rects) {
      const area = overlapArea(disc, rect);
      if (area > 0) hits.push({ target, area });
    }
    return hits;
  }

  function best(hits) {
    let top = null, area = 0;
    for (const hit of hits) if (hit.area > area) { area = hit.area; top = hit.target; }
    return top;
  }

  function agreement(leftHits, rightHits) {
    const rightArea = new Map(rightHits.map(({ target, area }) => [target, area]));
    let top = null, share = 0;
    for (const { target, area } of leftHits) {
      const other = rightArea.get(target);
      if (other === undefined) continue;
      const s = Math.min(area, other);
      if (s > share) { share = s; top = target; }
    }
    return top;
  }

  function setHover(target, value) {
    if (target.hovered === value) return;
    target.hovered = value;
    target.onHover?.(value);
  }

  function update() {
    const now = performance.now();
    const rects = [];
    for (const target of targets) {
      if (target.disabled) continue;
      const rect = screenRect(target);
      if (rect) rects.push([target, rect]);
    }
    state.rects = rects;

    if (!state.enabled || !state.pointer) {
      state.wrists = [null, null];
      for (const t of targets) setHover(t, false);
      cancelArming();
      emit();
      return;
    }
    const { x, y } = state.pointer;
    const left = { x: x - WRIST_SPREAD / 2, y };
    const right = { x: x + WRIST_SPREAD / 2, y };
    state.wrists = [left, right];

    const leftHits = overlapped(left, rects);
    const rightHits = overlapped(right, rects);
    state.hover = [best(leftHits), best(rightHits)];
    const agree = agreement(leftHits, rightHits);

    for (const t of targets) setHover(t, t === state.hover[0] || t === state.hover[1] || t === agree);

    if (state.consumed) {
      if (agree !== state.consumed) state.consumed = null;
      else { cancelArming(); emit(); return; }
    }
    if (!agree) { cancelArming(); emit(); return; }
    if (!state.arming || state.arming.target !== agree) {
      cancelArming();
      state.arming = { target: agree, startedAt: now };
    }
    const progress = Math.min(1, (now - state.arming.startedAt) / HOLD_MS);
    agree.onArm?.(progress);
    if (progress >= 1) {
      const fired = agree;
      state.consumed = fired;
      state.arming = null;
      fired.onArm?.(0);
      fired.onSelect?.();
    }
    emit();
  }

  function cancelArming() {
    if (!state.arming) return;
    state.arming.target.onArm?.(0);
    state.arming = null;
  }

  function emit() {
    for (const fn of listeners) fn(state);
  }

  function pointerFromEvent(event) {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  canvas.addEventListener('pointermove', (e) => { state.pointer = pointerFromEvent(e); }, { passive: true });
  canvas.addEventListener('pointerleave', () => { state.pointer = null; });
  // Mouse and touch stay a parallel path: a real click selects the target under it.
  canvas.addEventListener('click', (e) => {
    const p = pointerFromEvent(e);
    const hit = best(overlapped(p, state.rects ?? []));
    hit?.onSelect?.();
  });

  app.on('update', update);

  const api = {
    /**
     * Register a world-space target.
     * @param {string} name stable name, used by the capture script ("hero" is required)
     * @param {pc.Entity} entity root entity; all render components under it form the hit area
     * @param {{onHover?:(on:boolean)=>void, onArm?:(progress:number)=>void, onSelect?:()=>void, inset?:number}} handlers
     */
    register(name, entity, handlers = {}) {
      const target = { name, entity, hovered: false, ...handlers };
      targets.push(target);
      return target;
    },
    /** Subscribe to state each frame: { wrists, hover, arming, rects }. Use it to draw wrist markers. */
    onState(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setEnabled(value) { state.enabled = value; },
    /** Drive the simulated wrists programmatically (used by the capture script). */
    setPointer(x, y) { state.pointer = x === null ? null : { x, y }; },
    /** Screen rectangles of every registered target, keyed by name. */
    targetsOnScreen() {
      return Object.fromEntries((state.rects ?? []).map(([t, r]) => [t.name, r]));
    },
    get targets() { return targets; },
  };
  window.__hands = api;
  return api;
}
