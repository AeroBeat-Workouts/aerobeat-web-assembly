// AeroBeat attract / loading flow prototype.
//
// Phase 1  first paint: one big "Turn on camera" target, two poke-able toys, real loading
//          progress for the body tracker drawn in the scene. The click requests the camera,
//          unlocks audio (soft chime) and requests fullscreen.
// Phase 2  camera on, body tracker still loading: mirrored, styled camera feed with a warm-up
//          prompt (only if loading takes longer than about a second).
// Phase 3  body tracker ready: full-screen mirror, wrist markers on the athlete's real wrists,
//          one practice two-wrist target. Selecting it ends the prototype ("next: calibration").
//
// Everything visible is a PlayCanvas world-space object. See README.md and DESIGN.md.

import { pc, C, FONT_FAMILY, font, createKit, clamp01, lerp, easeOut, easeInOut, rgba } from './kit.mjs';
import { createHands } from '../../style-comps/_shared/hands.mjs';
import { createPoseHands, WRIST_DIAMETER } from './pose-hands.mjs';
import { createPoseLoader, describeProgress } from './pose-loader.mjs';
import * as cam from './camera.mjs';
import { detectXR, enterVRStub } from './xr.mjs';

const params = new URLSearchParams(location.search);
const HERE = import.meta.url;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WARMUP_DELAY_MS = 1000;   // skip the warm-up message when tracking is ready within ~1 s
const NOBODY_AFTER_MS = 4000;   // "can't see you" after this long with no body, once tracking is ready
const FEED_GRACE_MS = 2000;     // cameras start dark while exposure settles; ignore black/frozen before this

const A = (window.__attract = {
  phase: 'boot', problem: null, notice: null, timings: {}, pose: null, camera: null, cameras: [],
  audio: 'locked', fullscreen: 'not requested', xr: 'unknown', permission: 'unknown',
  wrists: [null, null], bodySeenAt: null, health: null, simulatedWrists: null, selected: [],
});
const mark = (name) => {
  if (A.timings[name] === undefined) {
    A.timings[name] = Math.round(performance.now());
    performance.mark(`af-${name}`);
  }
};

export function start(canvas) {
  // ------------------------------------------------------------------ app + camera
  const app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true, alpha: false, powerPreference: 'high-performance' } });
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  const kit = createKit(app);

  const camera = new pc.Entity('camera');
  camera.addComponent('camera', {
    clearColor: new pc.Color(...rgba(C.basalt)), projection: pc.PROJECTION_ORTHOGRAPHIC,
    // Scene z runs 0..10. hands.mjs treats a projected z < 0 as "behind the camera"; with an
    // orthographic camera that z is linear in depth, so the layout must sit in the far half
    // of the clip range (distances 50..60 of 1..70).
    orthoHeight: 5, nearClip: 1, farClip: 70,
  });
  camera.camera.toneMapping = pc.TONEMAP_LINEAR;
  camera.camera.gammaCorrection = pc.GAMMA_NONE;
  camera.setPosition(0, 0, 60);
  app.root.addChild(camera);

  // Fit the 1600x1000 design frame into any window (letterbox on the long axis).
  function fit() {
    app.resizeCanvas();
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    kit.view.orthoHeight = 5 * Math.max(1, 1.6 / aspect);
    camera.camera.orthoHeight = kit.view.orthoHeight;
    if (phase3Feed) layoutFeedFull(1);
  }
  window.addEventListener('resize', () => fit());

  const hands = createHands(app, camera); // shared rule; mouse/touch click path
  hands.setEnabled(false);                // no hold-to-select from the mouse; clicks select directly
  const poseHands = createPoseHands(hands);

  const root = kit.node(app.root, 'root');

  // ------------------------------------------------------------------ audio
  let audio = null;
  function unlockAudio() {
    if (!audio) {
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
    }
    audio?.resume?.().then(() => { A.audio = audio.state; });
    A.audio = audio?.state ?? 'unavailable';
  }
  function tone(freq, at, dur, gain = 0.08, type = 'sine') {
    if (!audio) return;
    const t = audio.currentTime + at;
    const o = audio.createOscillator(); const g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const chime = () => { tone(659.25, 0, 0.9, 0.07); tone(987.77, 0.11, 1.1, 0.05); A.chimePlayedAt = Math.round(performance.now()); };
  const tick = (f = 520) => tone(f, 0, 0.18, 0.04, 'triangle');
  const confirmSound = () => { tone(523.25, 0, 0.5, 0.06); tone(659.25, 0.08, 0.5, 0.05); tone(783.99, 0.16, 0.8, 0.05); };

  // ------------------------------------------------------------------ groups (fade in/out)
  const groups = [];
  function group(name, visible = false) {
    const e = kit.node(root, name);
    const g = {
      name, e, items: [], targets: [], alpha: visible ? 1 : 0, goal: visible ? 1 : 0,
      show(on = true) { g.goal = on ? 1 : 0; if (on) e.enabled = true; syncTargets(g); return g; },
      add(item, base = 1) { item.base = base; g.items.push(item); item.opacity?.(g.alpha * base); return item; },
    };
    e.enabled = visible;
    groups.push(g);
    return g;
  }
  function syncTargets(g) { for (const t of g.targets) t.disabled = g.goal === 0 || t.hiddenLocal; }
  function updateGroups(dt) {
    for (const g of groups) {
      const before = g.alpha;
      const k = REDUCED ? 1 : Math.min(1, dt * 9);
      g.alpha += (g.goal - g.alpha) * k;
      if (Math.abs(g.goal - g.alpha) < 0.01) g.alpha = g.goal;
      if (g.alpha === 0 && g.goal === 0) g.e.enabled = false;
      if (g.alpha !== before) for (const it of g.items) it.opacity?.(g.alpha * it.base);
    }
  }

  // ------------------------------------------------------------------ icons
  const icon = {
    camera(g, cx, cy, s, col) {
      g.save(); g.translate(cx, cy); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.09;
      g.beginPath(); g.roundRect(-s * 0.5, -s * 0.3, s * 0.68, s * 0.6, s * 0.12); g.fill();
      g.beginPath(); g.moveTo(s * 0.22, -s * 0.06); g.lineTo(s * 0.5, -s * 0.24); g.lineTo(s * 0.5, s * 0.24); g.lineTo(s * 0.22, s * 0.06); g.closePath(); g.fill();
      g.restore();
    },
    headset(g, cx, cy, s, col) {
      g.save(); g.translate(cx, cy); g.fillStyle = col;
      g.beginPath(); g.roundRect(-s * 0.5, -s * 0.26, s, s * 0.52, s * 0.2); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.ellipse(0, s * 0.3, s * 0.13, s * 0.14, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    },
    swap(g, cx, cy, s, col) {
      g.save(); g.translate(cx, cy); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s * 0.11; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, s * 0.36, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.beginPath(); g.arc(0, 0, s * 0.36, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
      const head = (a, dir) => { const x = Math.cos(a) * s * 0.36, y = Math.sin(a) * s * 0.36; g.beginPath(); g.moveTo(x + dir * s * 0.16, y - s * 0.02); g.lineTo(x, y + dir * s * 0.16); g.lineTo(x - dir * s * 0.12, y - dir * s * 0.06); g.closePath(); g.fill(); };
      head(Math.PI * 1.9, 1); head(Math.PI * 0.9, -1);
      g.restore();
    },
    check(g, cx, cy, s, col) {
      g.save(); g.translate(cx, cy); g.strokeStyle = col; g.lineWidth = s * 0.14; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-s * 0.32, 0); g.lineTo(-s * 0.08, s * 0.24); g.lineTo(s * 0.36, -s * 0.26); g.stroke();
      g.restore();
    },
    tpose(g, cx, cy, s, col) {
      g.save(); g.translate(cx, cy); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s * 0.07; g.lineCap = 'round';
      g.beginPath(); g.arc(0, -s * 0.36, s * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-s * 0.48, -s * 0.18); g.lineTo(s * 0.48, -s * 0.18); g.stroke();
      g.beginPath(); g.moveTo(0, -s * 0.22); g.lineTo(0, s * 0.12); g.lineTo(-s * 0.16, s * 0.48); g.moveTo(0, s * 0.12); g.lineTo(s * 0.16, s * 0.48); g.stroke();
      g.fillStyle = C.signal; g.beginPath(); g.arc(-s * 0.48, -s * 0.18, s * 0.07, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.ember; g.beginPath(); g.arc(s * 0.48, -s * 0.18, s * 0.07, 0, Math.PI * 2); g.fill();
      g.restore();
    },
  };

  // ------------------------------------------------------------------ button
  // A rounded panel + label (+ optional icon) + exact hit area, registered with both the
  // shared hands (click path) and pose hands (wrists).
  const buttons = new Map();
  let modal = null; // group that currently owns input (camera chooser)
  function button(g, name, { x, y, w, h, label, iconName = null, kind = 'secondary', size = 36, onSelect, z = 2 }) {
    const b = { name, group: g, z, x, y, w, h, label, iconName, kind, size, onSelect, hovered: false, mouseHover: false, poseHover: false, arm: 0, lift: 0, flash: 0 };
    const node = kit.node(g.e, `btn-${name}`);
    b.node = node;
    b.panel = g.add(kit.panel(node, { w, h, r: Math.min(36, h / 2), x, y, z, shadow: kind === 'primary' ? 1 : 0.6,
      fill: kind === 'primary' ? C.paper : C.slate, stroke: kind === 'primary' ? null : C.ridge, strokeW: kind === 'primary' ? 0 : 2 }));
    const draw = (gc, W, H) => {
      const col = b.kind === 'primary' ? C.basalt : C.paper;
      gc.font = font(700, b.size);
      const tw = gc.measureText(b.label).width;
      const is = b.iconName ? b.size * 1.15 : 0;
      const gap = b.iconName ? b.size * 0.45 : 0;
      const x0 = (W - (tw + is + gap)) / 2;
      if (b.iconName) icon[b.iconName](gc, x0 + is / 2, H / 2, is, col);
      gc.fillStyle = col; gc.textBaseline = 'middle'; gc.textAlign = 'left';
      gc.fillText(b.label, x0 + is + gap, H / 2 + b.size * 0.04);
    };
    b.face = g.add(kit.drawn(node, { w, h, x, y, z: z + 0.1, draw }));
    b.hit = kit.hitbox(node, { x, y, w, h, z: z + 0.05, name: `hit-${name}` });
    const fire = () => { if (!b.target.disabled && !(modal && modal !== b.group)) { A.selected.push(name); b.flash = 1; b.onSelect?.(); } };
    b.target = hands.register(name, b.hit, { onSelect: fire });
    g.targets.push(b.target);
    poseHands.register(name, { onHover: (on) => { b.poseHover = on; }, onArm: (p) => { b.arm = p; }, onSelect: fire });
    b.setLabel = (label, iconName = b.iconName) => { if (label === b.label && iconName === b.iconName) return; b.label = label; b.iconName = iconName; b.face.redraw(); };
    b.setKind = (kind) => {
      if (kind === b.kind) return; b.kind = kind;
      b.panel.set({ fill: kind === 'primary' ? C.paper : C.slate, stroke: kind === 'primary' ? null : C.ridge, strokeW: kind === 'primary' ? 0 : 2, shadow: kind === 'primary' ? 1 : 0.6 });
      b.face.redraw();
    };
    b.setVisible = (on) => { b.target.hiddenLocal = !on; node.enabled = on; syncTargets(g); };
    b.moveTo = (nx, ny) => { b.x = nx; b.y = ny; kit.place(b.panel.entity, nx, ny, b.z); kit.place(b.face.entity, nx, ny, b.z + 0.1); kit.place(b.hit, nx, ny, b.z + 0.05); };
    buttons.set(name, b);
    return b;
  }
  function updateButtons(dt) {
    A.arm = {};
    for (const b of buttons.values()) {
      if (b.arm > 0) A.arm[b.name] = +b.arm.toFixed(2);
      b.hovered = (b.mouseHover || b.poseHover) && !b.target.disabled && !(modal && modal !== b.group);
      b.lift += ((b.hovered ? 1 : 0) - b.lift) * Math.min(1, dt * 14);
      b.flash = Math.max(0, b.flash - dt * 2.2);
      const s = 1 + 0.025 * b.lift - 0.03 * Math.sin(Math.PI * clamp01(1 - b.flash));
      b.node.setLocalScale(1, 1, 1);
      b.panel.entity.setLocalScale((b.w + 64) / 100 * s, (b.h + 64) / 100 * s, 1);
      b.face.entity.setLocalScale(b.w / 100 * s, b.h / 100 * s, 1);
      const strokeCol = b.kind === 'primary' ? C.signal : C.paper;
      b.panel.set({ progress: b.arm, stroke: b.hovered ? strokeCol : (b.kind === 'primary' ? null : C.ridge), strokeW: b.hovered ? 4 : (b.kind === 'primary' ? 0 : 2) });
    }
  }

  // Mouse/touch hover. The shared hands module selects on click; hover feedback for the
  // pointer is computed here from the same target rectangles.
  let pointer = null; // design px
  function hitTestScreen(sx, sy) {
    const rects = hands.targetsOnScreen();
    for (const [name, r] of Object.entries(rects)) if (sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom) return name;
    return null;
  }
  function onPointer(e) {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    pointer = kit.screenToDesign(sx, sy);
    pointer.down = e.type === 'pointerdown' || (e.buttons & 1) === 1;
    const over = hitTestScreen(sx, sy);
    for (const b of buttons.values()) b.mouseHover = b.name === over;
    canvas.style.cursor = over ? 'pointer' : 'default';
    if (e.type === 'pointerdown') { unlockAudio(); toys.poke(pointer); }
  }
  canvas.addEventListener('pointermove', onPointer, { passive: true });
  canvas.addEventListener('pointerdown', onPointer, { passive: true });
  canvas.addEventListener('pointerleave', () => { pointer = null; for (const b of buttons.values()) b.mouseHover = false; });
  canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { pointer = null; for (const b of buttons.values()) b.mouseHover = false; } });

  // ------------------------------------------------------------------ persistent chrome
  const chrome = group('chrome', true);
  chrome.add(kit.text(chrome.e, { text: 'AeroBeat', size: 34, weight: 700, color: C.paper, align: 'left', x: 64, y: 62, z: 3 }));

  // ------------------------------------------------------------------ phase 1
  const p1 = group('phase1', true);
  const p1Head = p1.add(kit.text(p1.e, { text: 'Play with your whole body', size: 68, weight: 700, x: 800, y: 228 }));
  const p1Body = p1.add(kit.text(p1.e, { text: 'AeroBeat follows your moves through your webcam.\nThe picture stays on this device.', size: 34, color: C.fog, x: 800, y: 336, lineHeight: 1.35 }));
  const startBtn = button(p1, 'start', { x: 800, y: 530, w: 640, h: 156, label: 'Turn on camera', iconName: 'camera', kind: 'primary', size: 54, onSelect: onStart });
  const p1Hint = p1.add(kit.text(p1.e, { text: 'Then stand 2 to 3 metres back', size: 34, color: C.fog, x: 800, y: 658 }));
  const vrBtn = button(p1, 'vr', { x: 1400, y: 62, w: 280, h: 84, label: 'Play in VR', iconName: 'headset', size: 32, onSelect: () => { enterVRStub(); A.vrStub = Math.round(performance.now()); showToast('VR would start here (prototype stub)'); } });
  vrBtn.setVisible(false);

  // Toys: a beat pad that pulses and rings, and a cluster of dots that scatter from the pointer.
  const toys = (() => {
    const t = kit.node(p1.e, 'toys');
    const pad = { x: 240, y: 530, s: 0, v: 0, inside: false };
    pad.panel = p1.add(kit.panel(t, { w: 168, h: 168, r: 44, x: pad.x, y: pad.y, z: 1.5, fill: C.slate, stroke: C.ridge, strokeW: 3, shadow: 0.5 }));
    pad.face = p1.add(kit.drawn(t, { w: 168, h: 168, x: pad.x, y: pad.y, z: 1.6, draw: (g, W, H) => {
      g.strokeStyle = C.signal; g.lineWidth = 6;
      g.beginPath(); g.arc(W / 2, H / 2, 34, 0, Math.PI * 2); g.stroke();
      g.fillStyle = C.signal; g.beginPath(); g.arc(W / 2, H / 2, 12, 0, Math.PI * 2); g.fill();
    } }));
    const rings = [];
    for (let i = 0; i < 4; i += 1) {
      const r = { p: 1, panel: kit.panel(t, { w: 168, h: 168, r: 44, x: pad.x, y: pad.y, z: 1.4, fill: C.signal, fillA: 0, stroke: C.signal, strokeW: 4 }) };
      r.panel.opacity(0); rings.push(r);
    }
    const dots = [];
    const DOT_COLS = [C.fog, C.signal, C.fog, C.ember, C.fog, C.fog, C.signal];
    const center = { x: 1360, y: 530 };
    const layout = [[0, 0], [-64, -56], [64, -56], [-64, 56], [64, 56], [0, -112], [0, 112]];
    layout.forEach(([dx, dy], i) => {
      const d = { rx: center.x + dx, ry: center.y + dy, x: center.x + dx, y: center.y + dy, vx: 0, vy: 0 };
      d.q = p1.add(kit.drawn(t, { w: 52, h: 52, x: d.x, y: d.y, z: 1.6, draw: (g, W, H) => { g.fillStyle = DOT_COLS[i]; g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 3, 0, Math.PI * 2); g.fill(); } }));
      dots.push(d);
    });
    function ring() {
      const r = rings.find((x) => x.p >= 1) ?? rings[0];
      r.p = 0;
    }
    function poke(p) {
      if (!p1.e.enabled || p1.goal === 0) return;
      if (Math.abs(p.x - pad.x) < 90 && Math.abs(p.y - pad.y) < 90) { pad.v -= 9; ring(); tick(440); A.toyPokes = (A.toyPokes ?? 0) + 1; }
      for (const d of dots) {
        const dx = d.x - p.x, dy = d.y - p.y, dist = Math.hypot(dx, dy);
        if (dist < 200) { const f = (200 - dist) * 0.25; d.vx += (dx / (dist || 1)) * f * 6; d.vy += (dy / (dist || 1)) * f * 6; }
      }
      if (Math.hypot(p.x - center.x, p.y - center.y) < 170) { tick(660); A.toyPokes = (A.toyPokes ?? 0) + 1; }
    }
    function update(dt) {
      // Pad: pulse when the pointer enters it, spring back.
      const inside = !!pointer && Math.abs(pointer.x - pad.x) < 84 && Math.abs(pointer.y - pad.y) < 84;
      if (inside && !pad.inside) { pad.v -= 5; ring(); tick(392); }
      pad.inside = inside;
      pad.v += (-pad.s * 180 - pad.v * 14) * dt;
      pad.s += pad.v * dt;
      const sc = 1 + pad.s * 0.12;
      pad.panel.entity.setLocalScale((168 + 64) / 100 * sc, (168 + 64) / 100 * sc, 1);
      pad.face.entity.setLocalScale(1.68 * sc, 1.68 * sc, 1);
      pad.panel.set({ stroke: inside ? C.signal : C.ridge });
      for (const r of rings) {
        if (r.p >= 1) continue;
        r.p = Math.min(1, r.p + dt * 1.4);
        const k = 1 + easeOut(r.p) * 0.9;
        r.panel.set({ w: 168 * k, h: 168 * k, r: 44 * k });
        r.panel.opacity((1 - r.p) * 0.8 * p1.alpha);
      }
      // Dots: repel from the pointer, spring back to rest.
      for (const d of dots) {
        if (pointer) {
          const dx = d.x - pointer.x, dy = d.y - pointer.y, dist = Math.hypot(dx, dy);
          if (dist < 150 && dist > 0.01) { const f = (150 - dist) * 40; d.vx += dx / dist * f * dt; d.vy += dy / dist * f * dt; }
        }
        d.vx += ((d.rx - d.x) * 60 - d.vx * 7) * dt;
        d.vy += ((d.ry - d.y) * 60 - d.vy * 7) * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        kit.place(d.q.entity, d.x, d.y, 1.6);
      }
    }
    return { poke, update };
  })();

  // Loading progress: label + bar. The bar shows real bytes and real start-up steps.
  const progress = (() => {
    const g = group('progress', true);
    const W = 760;
    const label = g.add(kit.text(g.e, { text: 'Getting the body tracker ready', size: 34, color: C.fog, x: 800, y: 864 }));
    const track = g.add(kit.panel(g.e, { w: W, h: 20, r: 10, x: 800, y: 920, z: 1, fill: C.ridge, fillA: 0.8 }));
    const fill = g.add(kit.panel(g.e, { w: 20, h: 20, r: 10, x: 800 - W / 2 + 10, y: 920, z: 1.1, fill: C.signal }));
    let shown = 0, target = 0, y = 864;
    return {
      g,
      set(snapshot) {
        const d = describeProgress(snapshot);
        target = d.value;
        label.setText(d.label, { color: snapshot.stage === 'failed' ? C.ember : C.fog });
      },
      moveTo(ny) { y = ny; },
      update(dt) {
        // Ease toward the real value; never ahead of it.
        // Once the tracker is ready, finish the bar promptly instead of creeping (never a parked 96%).
        const minStep = target >= 1 ? dt * 0.8 : 0.002;
        shown = Math.min(target, shown + Math.max(minStep, (target - shown) * Math.min(1, dt * 8)));
        if (target < shown) shown = target;
        const w = Math.max(20, W * shown);
        fill.set({ w });
        kit.place(fill.entity, 800 - W / 2 + w / 2, y + 52, 1.1);
        kit.place(track.entity, 800, y + 52, 1);
        label.entity.setLocalPosition(kit.wx(800), kit.wy(y), 1.1);
        A.progressShown = shown;
      },
    };
  })();

  // ------------------------------------------------------------------ problem panel (shared by all phases)
  // headline + explanation + up to two actions. Ember accents: something to fix, not an alarm.
  const problem = (() => {
    const g = group('problem');
    const node = g.e;
    const card = g.add(kit.panel(node, { w: 1100, h: 340, r: 36, x: 800, y: 530, z: 4, fill: C.slate, stroke: C.ember, strokeW: 3, shadow: 1 }));
    const head = g.add(kit.text(node, { text: ' ', size: 48, weight: 700, color: C.paper, x: 800, y: 420, z: 4.2, maxW: 1000 }));
    const body = g.add(kit.text(node, { text: ' ', size: 36, color: C.fog, x: 800, y: 500, z: 4.2, maxW: 1020, lineHeight: 1.35 }));
    const btnA = button(g, 'problem-a', { x: 800, y: 640, w: 420, h: 104, label: 'Try again', kind: 'primary', size: 38, z: 4.3 });
    const btnB = button(g, 'problem-b', { x: 1060, y: 640, w: 360, h: 104, label: 'Reload page', size: 36, z: 4.3 });
    let current = null;
    function show(spec) {
      // spec: { key, title, body, actions: [{label, icon, onSelect}], y }
      current = spec;
      A.notice = spec.key;
      const cy = spec.y ?? 530;
      head.setText(spec.title);
      body.setText(spec.body);
      const hasBtns = spec.actions?.length > 0;
      const h = 64 + head.h + 18 + body.h + (hasBtns ? 140 : 24);
      card.set({ h, w: 1160 });
      kit.place(card.entity, 800, cy, 4);
      const top = cy - h / 2 + 52;
      kit.place(head.entity, 800, top + head.h / 2, 4.2);
      kit.place(body.entity, 800, top + head.h + 14 + body.h / 2, 4.2);
      const by = cy + h / 2 - 84;
      const acts = spec.actions ?? [];
      [btnA, btnB].forEach((b, i) => {
        const a = acts[i];
        b.setVisible(!!a);
        if (!a) return;
        b.setLabel(a.label, a.icon ?? null);
        b.setKind(i === 0 ? 'primary' : 'secondary');
        b.onSelect = a.onSelect;
      });
      if (acts.length === 2) { btnA.moveTo(800 - 230, by); btnB.moveTo(800 + 230, by); } else { btnA.moveTo(800, by); }
      g.show(true);
    }
    function hide(key) { if (!current || (key && current.key !== key)) return; current = null; A.notice = null; A.problem = null; g.show(false); }
    return { show, hide, get key() { return current?.key ?? null; }, g };
  })();

  // Small transient message (VR stub, camera switched).
  const toast = (() => {
    const g = group('toast');
    const card = g.add(kit.panel(g.e, { w: 700, h: 76, r: 38, x: 800, y: 952, z: 6, fill: C.slate, stroke: C.ridge, strokeW: 2, shadow: 1 }));
    const t = g.add(kit.text(g.e, { text: ' ', size: 30, color: C.paper, x: 800, y: 952, z: 6.1 }));
    let until = 0;
    return {
      show(msg, ms = 2600) { t.setText(msg); card.set({ w: t.w + 90 }); g.show(true); until = performance.now() + ms; },
      update(now) { if (g.goal && now > until) g.show(false); },
    };
  })();
  function showToast(msg, ms) { toast.show(msg, ms); }

  // ------------------------------------------------------------------ phase 2 / 3: the mirror
  const p2 = group('phase2');
  const MIRROR = { x: 800, y: 420, w: 960, h: 540, r: 32 };
  const mirrorFrame = p2.add(kit.panel(p2.e, { w: MIRROR.w + 16, h: MIRROR.h + 16, r: MIRROR.r + 8, x: MIRROR.x, y: MIRROR.y, z: 0.4, fill: C.slate, shadow: 1 }));
  const mirrorWait = p2.add(kit.text(p2.e, { text: 'Starting your camera', size: 34, color: C.fog, x: MIRROR.x, y: MIRROR.y, z: 0.45 }));
  const feedLayer = group('feed');
  const feed = feedLayer.add(kit.feed(feedLayer.e, { ...MIRROR, z: 0.5 }));
  const warmup = p2.add(kit.text(p2.e, { text: 'While we get ready: roll your shoulders, reach up high', size: 44, weight: 700, color: C.paper, x: 800, y: 760, maxW: 1400 }));
  warmup.opacity(0);
  const switchBtn = button(chrome, 'switch', { x: 1380, y: 62, w: 340, h: 84, label: 'Switch camera', iconName: 'swap', size: 32, onSelect: () => openChooser(), z: 5 });
  switchBtn.setVisible(false);

  // Phase 3: practice target + guidance + wrist markers.
  const p3 = group('phase3');
  // Overhead, so it never covers the athlete's face and "raise" means raise.
  const PRACTICE = { x: 800, y: 160, w: 600, h: 200 };
  const practice = (() => {
    const b = button(p3, 'practice', { ...PRACTICE, label: 'Raise both hands here', size: 46, z: 3 });
    b.panel.set({ fill: C.slate, fillA: 0.88, stroke: C.paper, strokeA: 0.5, strokeW: 3, shadow: 1 });
    b.wristOn = [false, false];
    b.msg = 'Raise both hands here';
    b.face.redraw((g, W, H) => {
      g.font = font(700, 46); g.fillStyle = b.done ? C.basalt : C.paper; g.textAlign = 'center'; g.textBaseline = 'middle';
      // Text in the lower half: raised wrists arrive from above and would cover it.
      g.fillText(b.done ? 'Nice!' : b.msg, W / 2, H / 2 + 38);
      // Two dots in the wrist colours: each fills when that wrist is on the box, so the
      // athlete can see which hand is still missing.
      [[C.signal, -60], [C.ember, 60]].forEach(([col, dx], i) => {
        g.lineWidth = 6; g.strokeStyle = b.done ? C.basalt : col; g.fillStyle = b.done ? C.basalt : col;
        g.beginPath(); g.arc(W / 2 + dx, H / 2 - 40, 20, 0, Math.PI * 2);
        if (b.wristOn[i] || b.done) g.fill(); else g.stroke();
      });
    });
    return b;
  })();

  const wristLayer = group('wrists');
  const wristMarks = [C.signal, C.ember].map((col, i) => {
    const q = wristLayer.add(kit.drawn(wristLayer.e, { w: 96, h: 96, x: -200, y: -200, z: 8, name: `wrist-${i}`, draw: (g, W, H) => {
      const r = WRIST_DIAMETER / 2;
      g.fillStyle = 'rgba(20,24,28,0.55)'; g.beginPath(); g.arc(W / 2, H / 2, r + 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(W / 2, H / 2, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 4; g.beginPath(); g.arc(W / 2, H / 2, r - 2, 0, Math.PI * 2); g.stroke();
    } }));
    return { q, vis: 0, x: 800, y: 500 };
  });

  // Done: the end of this prototype.
  const done = group('done');
  done.add(kit.panel(done.e, { w: 1000, h: 470, r: 40, x: 800, y: 480, z: 7, fill: C.slate, fillA: 0.95, stroke: C.signal, strokeW: 3, shadow: 1 }));
  done.add(kit.drawn(done.e, { w: 180, h: 180, x: 800, y: 345, z: 7.1, draw: (g, W, H) => icon.tpose(g, W / 2, H / 2, 160, C.paper) }));
  done.add(kit.text(done.e, { text: 'Next: calibration (T-pose)', size: 60, weight: 700, x: 800, y: 492, z: 7.1 }));
  done.add(kit.text(done.e, { text: "That's how you choose things. Now stand where you'll play\nand hold your arms out to the sides, like a T.", size: 34, color: C.fog, x: 800, y: 600, z: 7.1, lineHeight: 1.4, maxW: 900 }));

  // Camera chooser (modal).
  const chooser = (() => {
    const g = group('chooser');
    g.add(kit.panel(g.e, { w: 4000, h: 3000, r: 0, x: 800, y: 500, z: 9, fill: C.basalt, fillA: 0.78 }));
    const card = g.add(kit.panel(g.e, { w: 900, h: 600, r: 40, x: 800, y: 500, z: 9.1, fill: C.slate, stroke: C.ridge, strokeW: 2, shadow: 1 }));
    const title = g.add(kit.text(g.e, { text: 'Choose a camera', size: 52, weight: 700, x: 800, y: 300, z: 9.2 }));
    const note = g.add(kit.text(g.e, { text: ' ', size: 30, color: C.fog, x: 800, y: 360, z: 9.2, maxW: 780 }));
    const rows = [];
    for (let i = 0; i < 4; i += 1) {
      const r = button(g, `cam-${i}`, { x: 800, y: 440 + i * 116, w: 760, h: 96, label: '-', size: 32, z: 9.3 });
      rows.push(r);
    }
    const close = button(g, 'chooser-close', { x: 800, y: 760, w: 300, h: 96, label: 'Close', size: 34, onSelect: () => closeChooser(), z: 9.3 });
    function open(list, currentId) {
      const n = Math.min(4, list.length);
      const h = 220 + n * 116 + 140;
      const top = 500 - h / 2;
      card.set({ h });
      kit.place(title.entity, 800, top + 74, 9.2);
      note.setText(list.length <= 1 ? 'Only one camera is connected. Plug in another to switch.' : 'Pick the camera that can see your whole upper body.');
      kit.place(note.entity, 800, top + 132, 9.2);
      rows.forEach((r, i) => {
        const cam0 = list[i];
        r.setVisible(!!cam0);
        if (!cam0) return;
        const short = cam0.label.length > 38 ? `${cam0.label.slice(0, 36)}…` : cam0.label;
        r.setLabel(short, cam0.id === currentId ? 'check' : null);
        r.setKind(cam0.id === currentId ? 'primary' : 'secondary');
        r.moveTo(800, top + 220 + i * 116);
        r.onSelect = () => chooseCamera(cam0.id);
      });
      modal = g;
      close.moveTo(800, top + h - 82);
      g.show(true);
    }
    return { open, close: () => { g.show(false); modal = null; }, g };
  })();

  // ------------------------------------------------------------------ flow state
  let phase = 'phase1';
  function setPhase(next) {
    if (phase === next) return;
    phase = next; A.phase = next; mark(next);
    console.info(`[attract] phase -> ${next} at ${Math.round(performance.now())} ms`);
  }
  A.phase = 'phase1';

  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.autoplay = true;
  video.setAttribute('playsinline', '');
  Object.assign(video.style, { position: 'fixed', width: '2px', height: '2px', opacity: '0', pointerEvents: 'none', left: '0', top: '0' });
  document.body.appendChild(video);
  let stream = null;
  let feedStartedAt = 0;
  let newFrame = false;
  const health = cam.createFeedHealth(video);
  const onVideoFrame = () => { newFrame = true; video.requestVideoFrameCallback?.(onVideoFrame); };

  let poseReadyAt = 0;
  let landmarker = null;
  let phase2At = 0;
  let phase3Feed = false;
  let practiceDone = false;

  // ------------------------------------------------------------------ pose loading
  let loader = null;
  function startPoseLoading() {
    progress.g.show(true);
    loader = createPoseLoader({ fresh: params.has('fresh'), onProgress: (p) => { A.pose = p; progress.set(p); if (p.stage === 'download' && p.loaded > 0) mark('poseFirstByte'); } });
    mark('poseStart');
    loader.load().then((lm) => {
      landmarker = lm; poseReadyAt = performance.now(); mark('poseReady');
      setTimeout(() => progress.g.show(false), 1400);
      console.info(`[attract] pose ready at ${A.timings.poseReady} ms (stages ${JSON.stringify(loader.snapshot().timings)}, cache hits ${loader.snapshot().fromCache}/4)`);
    }).catch(() => {
      // Shown in-scene; phase 1 keeps working (the camera can still be turned on).
      if (phase !== 'phase1') showPoseFailed();
    });
  }
  function showPoseFailed() {
    problem.show({ key: 'pose-failed', title: "The body tracker didn't load", body: 'Check your internet connection, then try again.', y: 800,
      actions: [{ label: 'Try again', onSelect: () => { problem.hide(); startPoseLoading(); } }] });
  }

  // ------------------------------------------------------------------ phase 1 actions
  async function onStart() {
    // This runs inside the click/tap handler: the one real user gesture of the session.
    mark('startClick');
    unlockAudio();
    chime();
    if (A.xr === 'headset') { enterVRStub(); A.vrStub = Math.round(performance.now()); showToast('VR would start here (prototype stub)'); return; }
    requestFullscreen();
    await turnOnCamera();
  }
  function requestFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) { A.fullscreen = el.requestFullscreen ? 'already' : 'unsupported'; return; }
    A.fullscreen = 'requested';
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => { A.fullscreen = 'granted'; }).catch((e) => { A.fullscreen = `rejected: ${e?.name ?? e}`; });
  }

  async function turnOnCamera(deviceId) {
    const pre = cam.preflight();
    if (pre) { showCameraProblem(pre); return false; }
    startBtn.setLabel('Waiting for your browser…', 'camera');
    try {
      const opened = await cam.openCamera(deviceId);
      await attachStream(opened);
      problem.hide();
      cam.rememberCamera(opened.deviceId);
      A.permission = 'granted';
      mark('cameraOn');
      refreshCameraList();
      enterPhase2();
      return true;
    } catch (error) {
      console.warn('[attract] camera failed', error?.name, error?.message);
      A.cameraError = `${error?.name}: ${error?.message}`;
      let kind = cam.classify(error);
      startBtn.setLabel(startLabel(), 'camera');
      if (kind === cam.CAMERA_PROBLEMS.denied) {
        const state = await cam.permissionState();
        A.permission = state;
        // 'prompt' = the athlete dismissed the browser's question (asking again works);
        // 'granted' = the site is allowed but the operating system blocks the browser
        // (macOS/Windows privacy settings); 'denied' or unknown = blocked for this site.
        showCameraProblem(state === 'prompt' ? 'dismissed' : state === 'granted' ? 'osBlocked' : 'denied');
      } else showCameraProblem(kind, error);
      return false;
    }
  }
  async function attachStream({ stream: s, deviceId, label }) {
    cam.stopStream(stream);
    stream = s;
    A.camera = { deviceId, label };
    video.srcObject = s;
    await video.play().catch(() => {});
    if (video.readyState < 2) await new Promise((ok) => video.addEventListener('loadeddata', ok, { once: true }));
    feed.setVideo(video);
    video.requestVideoFrameCallback?.(onVideoFrame);
    feedStartedAt = performance.now();
    health.reset();
    A.bodySeenAt = null;
    s.getVideoTracks()[0]?.addEventListener('ended', () => {
      showFeedProblem('ended');
    });
  }
  async function refreshCameraList() {
    try { A.cameras = await cam.listCameras(); } catch { A.cameras = []; }
  }

  const PROBLEM_COPY = {
    denied: { title: 'The camera is blocked for this site', body: 'In the address bar, click the camera or lock icon and set Camera to Allow. Trying again here will not work until you do.',
      actions: () => [{ label: 'Reload page', onSelect: () => location.reload() }] },
    dismissed: { title: 'AeroBeat needs your camera to play', body: 'Your browser asked, and the camera was not allowed. Choose Allow when it asks again.',
      actions: () => [{ label: 'Ask again', icon: 'camera', onSelect: () => { requestFullscreen(); turnOnCamera(); } }] },
    osBlocked: { title: "Your computer is blocking the camera", body: 'This site is allowed, but your system privacy settings stop the browser from using the camera. Allow your browser under Camera in your system settings, then try again.',
      actions: () => [{ label: 'Try again', icon: 'camera', onSelect: () => turnOnCamera() }] },
    notFound: { title: 'No camera found', body: 'Plug in a webcam or check that it is switched on, then try again.',
      actions: () => [{ label: 'Try again', icon: 'camera', onSelect: () => turnOnCamera() }] },
    busy: { title: 'Another app is using your camera', body: 'Close Zoom, Teams, OBS or any other tab that is using the camera, then try again.',
      actions: () => [{ label: 'Try again', icon: 'camera', onSelect: () => turnOnCamera() }] },
    insecure: { title: 'The camera needs a secure page', body: 'Browsers only allow the camera on https:// pages. Open AeroBeat from its secure address.', actions: () => [] },
    unsupported: { title: "This browser can't use a camera", body: 'Open AeroBeat in a current version of Chrome, Edge, Firefox or Safari.', actions: () => [] },
    unknown: { title: "The camera didn't start", body: 'Try again. If it keeps happening, restart the browser.',
      actions: () => [{ label: 'Try again', icon: 'camera', onSelect: () => turnOnCamera() }] },
  };
  function showCameraProblem(kind, error) {
    A.problem = kind;
    const copy = PROBLEM_COPY[kind] ?? PROBLEM_COPY.unknown;
    const body = kind === 'unknown' && error?.name ? `${copy.body} (${error.name})` : copy.body;
    startBtn.setVisible(false);
    p1.show(false);
    problem.show({ key: `camera-${kind}`, title: copy.title, body, actions: copy.actions(), y: 480 });
    if (kind === 'denied') watchPermission();
  }
  let permissionWatched = false;
  async function watchPermission() {
    if (permissionWatched) return;
    try {
      const status = await navigator.permissions.query({ name: 'camera' });
      permissionWatched = true;
      status.addEventListener('change', () => {
        A.permission = status.state;
        if (status.state === 'granted' && phase === 'phase1') turnOnCamera();
      });
    } catch { /* not supported: the reload button is the way out */ }
  }

  // ------------------------------------------------------------------ phase transitions
  function enterPhase2() {
    A.problem = null;
    p1.show(false);
    startBtn.setVisible(false);
    p2.show(true);
    feedLayer.show(true);
    switchBtn.setVisible(true);
    phase2At = performance.now();
    setPhase('phase2');
    if (loader?.snapshot().stage === 'failed') showPoseFailed();
  }
  function enterPhase3() {
    setPhase('phase3');
    p2.show(false);
    progress.g.show(false);
    p3.show(true);
    wristLayer.show(true);
    phase3Feed = true;
    phase3At = performance.now();
  }
  let phase3At = 0;
  function layoutFeedFull(t) {
    const vis = kit.visibleDesign();
    const k = easeInOut(t);
    feed.set({ x: 800, y: lerp(MIRROR.y, 500, k), w: lerp(MIRROR.w, vis.w, k), h: lerp(MIRROR.h, vis.h, k), r: lerp(MIRROR.r, 0, k), dim: lerp(1, practiceDone ? 0.4 : 0.72, k) });
  }

  // ------------------------------------------------------------------ camera chooser
  async function openChooser() {
    await refreshCameraList();
    chooser.open(A.cameras, A.camera?.deviceId);
    A.chooserOpen = true;
  }
  function closeChooser() { chooser.close(); A.chooserOpen = false; }
  let switching = false;
  async function chooseCamera(id) {
    closeChooser();
    if (id === A.camera?.deviceId) return;
    const previous = A.camera?.deviceId;
    switching = true;
    try {
      cam.stopStream(stream);
      const opened = await cam.openCamera(id);
      await attachStream(opened);
      cam.rememberCamera(opened.deviceId);
      problem.hide();
      showToast(`Using ${opened.label}`);
    } catch (error) {
      const kind = cam.classify(error);
      showToast(kind === 'busy' ? 'That camera is in use by another app' : "That camera didn't start", 3200);
      if (previous) { try { await attachStream(await cam.openCamera(previous)); } catch { showFeedProblem('ended'); } }
    } finally { switching = false; }
  }

  // ------------------------------------------------------------------ feed problems ("can't see you")
  let feedProblemSince = 0, feedOkSince = 0;
  const FEED_COPY = {
    black: 'Your camera picture is black. Check that the lens is uncovered and any privacy shutter is open.',
    frozen: 'Your camera picture has stopped moving. Another app may have taken over the camera.',
    nobody: 'Step back until your head, shoulders and hands are in the picture, or try another camera.',
    ended: 'The camera was disconnected.',
  };
  function showFeedProblem(kind) {
    A.problem = kind;
    problem.show({ key: `feed-${kind}`, title: "Can't see you. Try another camera?", body: FEED_COPY[kind], y: phase === 'phase3' ? 600 : MIRROR.y,
      actions: [{ label: 'Switch camera', icon: 'swap', onSelect: () => openChooser() }] });
  }
  function checkFeed(now) {
    if (phase !== 'phase2' && phase !== 'phase3') return;
    if (switching || (problem.key && problem.key.startsWith('camera-'))) return;
    const h = health.sample(now);
    A.health = { mean: +h.mean.toFixed(1), spread: +h.spread.toFixed(1), delta: +h.delta.toFixed(2), black: h.black, frozen: h.frozen };
    const live = now - feedStartedAt;
    let kind = null;
    if (live > FEED_GRACE_MS && h.black) kind = 'black';
    else if (live > FEED_GRACE_MS && h.frozen) kind = 'frozen';
    else if (landmarker && now - Math.max(feedStartedAt, poseReadyAt) > NOBODY_AFTER_MS && now - (A.bodySeenAt ?? 0) > NOBODY_AFTER_MS) kind = 'nobody';
    if (practiceDone) kind = null;
    if (kind) {
      feedOkSince = 0;
      if (!feedProblemSince) feedProblemSince = now;
      if (problem.key !== `feed-${kind}` && problem.key !== 'pose-failed') showFeedProblem(kind);
    } else {
      feedProblemSince = 0;
      if (!feedOkSince) feedOkSince = now;
      if (problem.key?.startsWith('feed-') && now - feedOkSince > 600) { problem.hide(); A.problem = null; }
    }
  }

  // ------------------------------------------------------------------ pose tracking
  let lastDetectTs = 0;
  let lastVideoTime = -1;
  const smooth = [null, null];
  function detect(now) {
    if (!('requestVideoFrameCallback' in video) && video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; newFrame = true; }
    if (!landmarker || !newFrame || video.readyState < 2) return;
    if (now - lastDetectTs < 30) return;
    newFrame = false;
    const ts = Math.max(now, lastDetectTs + 1);
    lastDetectTs = ts;
    let result;
    try { result = landmarker.detectForVideo(video, ts); } catch (e) { console.warn('[attract] detect failed', e); return; }
    A.detectMs = Math.round(performance.now() - now);
    const lm = result?.landmarks?.[0];
    A.lastDetectAt = Math.round(now);
    if (!lm) { smooth[0] = smooth[1] = null; A.rawWrists = null; return; }
    A.bodySeenAt = now; mark('firstBody');
    const d = (i) => (lm[i] ? feed.landmarkToDesign(lm[i].x, lm[i].y) : null);
    A.rawPose = { nose: d(0), ls: d(11), rs: d(12), lw: d(15), rw: d(16) };
    // 15 = athlete's left wrist, 16 = right. The feed is mirrored, so the left wrist is on screen left.
    const raw = [lm[15], lm[16]].map((p) => (p && (p.visibility ?? 1) > 0.4 && p.x > -0.05 && p.x < 1.05 && p.y > -0.05 && p.y < 1.05 ? feed.landmarkToDesign(p.x, p.y) : null));
    A.rawWrists = raw;
    raw.forEach((p, i) => {
      if (!p) { smooth[i] = null; return; }
      smooth[i] = smooth[i] ? { x: lerp(smooth[i].x, p.x, 0.6), y: lerp(smooth[i].y, p.y, 0.6) } : p;
    });
  }

  function updateWrists(dt, now) {
    const wrists = A.simulatedWrists ?? (phase3Feed ? smooth : [null, null]);
    A.wrists = wrists.map((w) => (w ? { x: Math.round(w.x), y: Math.round(w.y) } : null));
    wristMarks.forEach((m, i) => {
      const w = wrists[i];
      m.vis += ((w ? 1 : 0) - m.vis) * Math.min(1, dt * 12);
      if (w) { m.x = w.x; m.y = w.y; }
      m.q.opacity(m.vis * wristLayer.alpha);
      kit.place(m.q.entity, m.x, m.y, 8);
    });
    if (phase !== 'phase3' || practiceDone) { poseHands.clear(); return; }
    const screen = wrists.map((w) => (w ? kit.designToScreen(w.x, w.y) : null));
    poseHands.update(screen, now);
    // Per-wrist feedback inside the practice target (teaching: which hand is still missing).
    const r = hands.targetsOnScreen().practice;
    const on = screen.map((s) => !!(s && r && s.x + WRIST_DIAMETER / 2 > r.left && s.x - WRIST_DIAMETER / 2 < r.right && s.y + WRIST_DIAMETER / 2 > r.top && s.y - WRIST_DIAMETER / 2 < r.bottom));
    let msg;
    if (on[0] && on[1]) msg = 'Hold it there';
    else if (on[0] || on[1]) msg = 'Now your other hand';
    else msg = 'Raise both hands here';
    if (on[0] !== practice.wristOn[0] || on[1] !== practice.wristOn[1] || msg !== practice.msg) { practice.wristOn = on; practice.msg = msg; practice.face.redraw(); }
  }

  practice.onSelect = () => {
    if (practiceDone) return;
    practiceDone = true;
    practice.done = true;
    practice.face.redraw();
    practice.panel.set({ fill: C.signal, fillA: 1 });
    confirmSound();
    mark('practiceSelected');
    setTimeout(() => {
      p3.show(false);
      problem.hide();
      done.show(true);
      wristLayer.show(false);
      switchBtn.setVisible(false);
      setPhase('done');
    }, 700);
  };

  // ------------------------------------------------------------------ main loop
  let feedAnim = 0;
  let lastCheck = 0;
  let firstFrame = true;
  app.on('update', (dt) => {
    const now = performance.now();
    dt = Math.min(dt, 0.05);
    updateGroups(dt);
    updateButtons(dt);
    if (phase === 'phase1') toys.update(dt);
    progress.update(dt);
    toast.update(now);
    if (stream) feed.upload();
    detect(now);
    if (now - lastCheck > 250) { lastCheck = now; checkFeed(now); }

    if (phase === 'phase2') {
      const t = now - phase2At;
      mirrorWait.opacity(video.readyState >= 2 ? 0 : p2.alpha);
      const showWarm = !landmarker && t > WARMUP_DELAY_MS && !problem.key;
      warmup.base = problem.key ? 0 : lerp(warmup.base, showWarm ? 1 : 0, Math.min(1, dt * 6));
      warmup.opacity(warmup.base * p2.alpha);
      if (showWarm) A.warmupShown = true;
      if (landmarker && video.readyState >= 2) enterPhase3();
    }
    if (phase3Feed) {
      feedAnim = REDUCED ? 1 : Math.min(1, feedAnim + dt / 0.7);
      layoutFeedFull(feedAnim);
    }
    updateWrists(dt, now);
  });
  app.on('frameend', () => {
    if (!firstFrame) return;
    firstFrame = false;
    mark('firstFrame');
    // Start the heavy download right after the first frame is on screen, so it does
    // not compete with first paint.
    requestAnimationFrame(() => startPoseLoading());
  });

  // ------------------------------------------------------------------ boot
  function startLabel() {
    if (A.xr === 'headset') return 'Enter VR';
    return A.permission === 'granted' ? 'Start' : 'Turn on camera';
  }
  fit();
  app.start();

  const fontFace = new FontFace(FONT_FAMILY, `url(${new URL('../fonts/AtkinsonHyperlegibleNext-var-latin.woff2', HERE).href})`, { weight: '200 800' });
  fontFace.load().then((f) => { document.fonts.add(f); kit.refreshTexts(); mark('fontReady'); }).catch((e) => console.warn('[attract] font failed', e));

  cam.permissionState().then((state) => {
    A.permission = state;
    startBtn.setLabel(startLabel(), A.xr === 'headset' ? 'headset' : 'camera');
    if (state === 'granted' && A.xr !== 'headset') p1Hint.setText('Your camera is already allowed');
  });
  detectXR().then((mode) => {
    A.xr = mode;
    if (mode === 'headset') { startBtn.setLabel('Enter VR', 'headset'); p1Body.setText('AeroBeat runs in your headset.\nNo webcam needed.'); p1Hint.setText('Clear some space around you'); }
    if (mode === 'desktop') vrBtn.setVisible(true);
  });
  const pre = cam.preflight();
  if (pre) showCameraProblem(pre);

  A.targets = () => hands.targetsOnScreen();
  A.designToScreen = (x, y) => kit.designToScreen(x, y);
  A.simulateWrists = (list) => { A.simulatedWrists = list; };
  A.openChooser = openChooser;
}
