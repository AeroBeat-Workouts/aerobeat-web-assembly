// Rendering kit for the attract-flow prototype: neutral tokens, an orthographic
// world-space layout in "design pixels", and three materials (rounded panel SDF,
// textured quad for canvas-drawn text, and the styled camera feed).
//
// Layout is written against a 1600x1000 design frame, origin top-left. The
// orthographic camera fits that frame into any window, so 1 design px is one
// screen px at 1600x1000 and scales uniformly elsewhere.

import * as pc from '../../style-comps/_shared/playcanvas.min.mjs';

export { pc };

// Neutral palette (see DESIGN.md). Hex for canvas text, linear-ish floats for shaders.
export const C = {
  basalt: '#22272D',   // background
  slate: '#343B44',    // quiet panels
  ridge: '#4A535E',    // panel strokes, tracks
  fog: '#B8C1CB',      // secondary text
  paper: '#F3F5F7',    // primary text, primary action fill
  signal: '#6CC3D5',   // progress, left wrist, "live"
  ember: '#F2B36B',    // right wrist, warnings
};

export const FONT_FAMILY = 'Atkinson Hyperlegible Next';
const FONT_STACK = `"${FONT_FAMILY}", "Noto Sans", "Segoe UI", system-ui, sans-serif`;
export const font = (weight, size) => `${weight} ${size}px ${FONT_STACK}`;

export const rgba = (hex, a = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};
const pre = ([r, g, b, a]) => new Float32Array([r * a, g * a, b * a, a]);

export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

const VS = `
attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
varying vec2 vUv;
void main(void) {
  vUv = vertex_texCoord0;
  gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
}`;

const SDF = `
float sdRR(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }
`;

// Rounded panel: soft shadow, fill, inner stroke, and an outer arming ring whose
// lit arc runs clockwise from 12 o'clock to uProgress. All colours premultiplied.
const PANEL_FS = `
uniform vec2 uSize;
uniform float uPad;
uniform float uRadius;
uniform vec4 uFill;
uniform vec4 uStroke;
uniform float uStrokeW;
uniform float uShadow;
uniform float uProgress;
uniform vec4 uRing;
uniform vec4 uRingTrack;
uniform float uAlpha;
varying vec2 vUv;
${SDF}
void main(void) {
  vec2 full = uSize + 2.0 * uPad;
  vec2 p = (vUv - 0.5) * full;
  float d = sdRR(p, uSize * 0.5, uRadius);
  float aa = max(fwidth(d), 0.6);
  vec4 col = vec4(0.0);
  float sh = uShadow * 0.45 * (1.0 - smoothstep(-6.0, 26.0, d - 6.0));
  col = over(vec4(0.0, 0.0, 0.0, sh), col);
  float fillA = clamp(0.5 - d / aa, 0.0, 1.0);
  col = over(uFill * fillA, col);
  float sA = clamp(0.5 - (abs(d + uStrokeW * 0.5) - uStrokeW * 0.5) / aa, 0.0, 1.0) * step(0.01, uStrokeW);
  col = over(uStroke * sA, col);
  float band = clamp(0.5 - (abs(d - 13.0) - 5.0) / aa, 0.0, 1.0);
  if (uProgress > 0.0 && band > 0.0) {
    float frac = fract(atan(p.x, p.y) / 6.2831853 + 1.0);
    float lit = clamp((uProgress - frac) * 400.0, 0.0, 1.0);
    col = over(mix(uRingTrack, uRing, lit) * band, col);
  }
  gl_FragColor = col * uAlpha;
}`;

const TEX_FS = `
uniform sampler2D uTex;
uniform vec4 uTint;
varying vec2 vUv;
void main(void) { gl_FragColor = texture2D(uTex, vUv) * uTint; }`;

// Camera feed: cover-fit, mirrored, softened into the palette (lifted, slate-tinted
// shadows, partial desaturation), rounded corners, adjustable dim.
const FEED_FS = `
uniform sampler2D uVideo;
uniform vec2 uSize;
uniform float uRadius;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;
uniform float uDim;
uniform float uSat;
uniform float uAlpha;
uniform vec3 uShadowTint;
uniform vec3 uLightTint;
varying vec2 vUv;
${SDF}
void main(void) {
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdRR(p, uSize * 0.5, uRadius);
  float a = clamp(0.5 - d / max(fwidth(d), 0.6), 0.0, 1.0) * uAlpha;
  vec2 uv = vUv * uUvScale + uUvOffset;
  uv.x = 1.0 - uv.x;
  vec3 c = texture2D(uVideo, clamp(uv, 0.0, 1.0)).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);
  c = mix(uShadowTint, uLightTint, c);
  float vig = 1.0 - 0.35 * smoothstep(0.35, 0.75, length(vUv - 0.5));
  c *= uDim * vig;
  gl_FragColor = vec4(c * a, a);
}`;

export function createKit(app) {
  const device = app.graphicsDevice;
  const worldLayer = app.scene.layers.getLayerByName('World');
  worldLayer.transparentSortMode = pc.SORTMODE_MANUAL;

  function shaderMat(name, fs, { blend = true, depthTest = true } = {}) {
    const m = new pc.ShaderMaterial({
      uniqueName: `af-${name}`, vertexGLSL: VS, fragmentGLSL: fs,
      attributes: { vertex_position: pc.SEMANTIC_POSITION, vertex_texCoord0: pc.SEMANTIC_TEXCOORD0 },
    });
    m.cull = pc.CULLFACE_NONE;
    if (blend) { m.blendType = pc.BLEND_PREMULTIPLIED; m.depthWrite = false; }
    m.depthTest = depthTest;
    m.update();
    return m;
  }
  const MAT_PANEL = shaderMat('panel', PANEL_FS);
  const MAT_TEX = shaderMat('tex', TEX_FS);
  const MAT_TEX_OPAQUE = shaderMat('tex-opaque', TEX_FS, { blend: false });
  const MAT_FEED = shaderMat('feed', FEED_FS);

  const quadMesh = new pc.Mesh(device);
  quadMesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
  quadMesh.setUvs(0, [0, 1, 1, 1, 1, 0, 0, 0]);
  quadMesh.setIndices([0, 1, 2, 0, 2, 3]);
  quadMesh.update(pc.PRIMITIVE_TRIANGLES);

  const S = 2; // canvas supersampling for text and icons

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h));
    return c;
  }
  function canvasTexture(cv, mipmaps = true) {
    const t = new pc.Texture(device, {
      width: cv.width, height: cv.height, format: pc.PIXELFORMAT_RGBA8, mipmaps,
      minFilter: mipmaps ? pc.FILTER_LINEAR_MIPMAP_LINEAR : pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE, premultiplyAlpha: true,
    });
    t.setSource(cv);
    return t;
  }

  // ------------------------------------------------------------- layout space
  const view = { orthoHeight: 5 };
  const wx = (x) => (x - 800) / 100;
  const wy = (y) => (500 - y) / 100;

  function node(parent, name = 'node') {
    const e = new pc.Entity(name);
    parent.addChild(e);
    return e;
  }
  // Everything is blended, so draw order is set explicitly from z (then creation order)
  // instead of PlayCanvas's distance sort, which is unreliable for a flat ortho layout.
  let seq = 0;
  function place(e, x, y, z) {
    e.setLocalPosition(wx(x), wy(y), z);
    if (e.mi) e.mi.drawOrder = Math.round(z * 1000) * 10000 + e.seq;
    return e;
  }

  function meshEntity(parent, mat, name) {
    const e = new pc.Entity(name);
    const mi = new pc.MeshInstance(quadMesh, mat);
    e.addComponent('render', { meshInstances: [mi], castShadows: false, receiveShadows: false });
    parent.addChild(e);
    e.mi = mi;
    e.seq = (seq += 1);
    return e;
  }

  const CLEAR_TEX = canvasTexture(makeCanvas(2, 2), false);
  // Invisible rectangle used as a selection hit area (registered with hands.mjs), so the
  // hit area is exactly the button and not the panel's shadow/ring padding.
  function hitbox(parent, { x, y, w, h, z = 1.05, name = 'hit' }) {
    const e = meshEntity(parent, MAT_TEX, name);
    e.mi.setParameter('uTex', CLEAR_TEX);
    e.mi.setParameter('uTint', pre([0, 0, 0, 0]));
    e.setLocalScale(w / 100, h / 100, 1);
    place(e, x, y, z);
    return e;
  }

  // Rounded panel. x,y = centre in design px (relative to parent when parent is a group
  // positioned with place()). Returns a handle with setters.
  function panel(parent, { w, h, r = 28, fill = C.slate, fillA = 1, stroke = null, strokeA = 1, strokeW = 0,
    shadow = 0, x = 800, y = 500, z = 1, name = 'panel', ring = C.signal } = {}) {
    const pad = 32;
    const e = meshEntity(parent, MAT_PANEL, name);
    const mi = e.mi;
    const api = {
      entity: e,
      set({ fill: f, fillA: fa, stroke: s, strokeA: sa, strokeW: sw, progress, ring: rc, w: nw, h: nh, r: nr, shadow: sh } = {}) {
        if (f !== undefined || fa !== undefined) { api._fill = f ?? api._fill; api._fillA = fa ?? api._fillA; mi.setParameter('uFill', pre(rgba(api._fill, api._fillA))); }
        if (s !== undefined || sa !== undefined) { api._stroke = s ?? api._stroke; api._strokeA = sa ?? api._strokeA; mi.setParameter('uStroke', pre(rgba(api._stroke ?? '#000000', api._stroke ? api._strokeA : 0))); }
        if (sw !== undefined) mi.setParameter('uStrokeW', sw);
        if (progress !== undefined) mi.setParameter('uProgress', progress);
        if (rc !== undefined) mi.setParameter('uRing', pre(rgba(rc)));
        if (sh !== undefined) mi.setParameter('uShadow', sh);
        if (nw !== undefined || nh !== undefined || nr !== undefined) {
          api.w = nw ?? api.w; api.h = nh ?? api.h; api.r = nr ?? api.r;
          mi.setParameter('uSize', [api.w, api.h]);
          mi.setParameter('uRadius', Math.min(api.r, api.w / 2, api.h / 2));
          e.setLocalScale((api.w + 2 * pad) / 100, (api.h + 2 * pad) / 100, 1);
        }
        return api;
      },
      w, h, r, _fill: fill, _fillA: fillA, _stroke: stroke, _strokeA: strokeA,
    };
    api.opacity = (a) => { mi.setParameter('uAlpha', a); return api; };
    api.opacity(1);
    mi.setParameter('uPad', pad);
    mi.setParameter('uRingTrack', pre(rgba(C.ridge, 0.6)));
    api.set({ fill, fillA, stroke, strokeA, strokeW, progress: 0, ring, w, h, r, shadow });
    place(e, x, y, z);
    return api;
  }

  const drawns = [];
  // Canvas-drawn content on a quad (text, icons). draw(g, wPx, hPx) draws in design px.
  function drawn(parent, { w, h, x = 800, y = 500, z = 1.1, name = 'drawn', draw, opaque = false }) {
    const e = meshEntity(parent, opaque ? MAT_TEX_OPAQUE : MAT_TEX, name);
    const api = {
      entity: e, w, h, cv: null, tex: null,
      redraw(nextDraw = draw, nw = api.w, nh = api.h) {
        draw = nextDraw;
        const resized = !api.cv || nw !== api.w || nh !== api.h;
        api.w = nw; api.h = nh;
        if (resized) {
          api.cv = makeCanvas(nw * S, nh * S);
          api.tex?.destroy();
          api.tex = canvasTexture(api.cv);
          e.mi.setParameter('uTex', api.tex);
          e.setLocalScale(nw / 100, nh / 100, 1);
        }
        const g = api.cv.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, api.cv.width, api.cv.height);
        g.setTransform(S, 0, 0, S, 0, 0);
        draw(g, nw, nh);
        api.tex.setSource(api.cv);
        return api;
      },
      tint(hexOrRgba, a = 1) { e.mi.setParameter('uTint', pre(Array.isArray(hexOrRgba) ? hexOrRgba : rgba(hexOrRgba, a))); },
      opacity(a) { api.tint([1, 1, 1, a]); return api; },
    };
    api.refresh = () => api.redraw();
    drawns.push(api);
    api.tint([1, 1, 1, 1]);
    api.redraw(draw, w, h);
    place(e, x, y, z);
    return api;
  }

  // Single or multi-line text block. Lines wrap to maxW. Returns a drawn() handle with setText().
  function wrapLines(g, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let cur = '';
      for (const word of para.split(' ')) {
        const t = cur ? `${cur} ${word}` : word;
        if (!cur || g.measureText(t).width <= maxW) cur = t; else { out.push(cur); cur = word; }
      }
      out.push(cur);
    }
    return out;
  }
  const measureCv = makeCanvas(4, 4).getContext('2d');

  function text(parent, { text: str, size = 32, weight = 400, color = C.paper, maxW = 1200, align = 'center',
    lineHeight = 1.25, x = 800, y = 500, z = 1.1, name = 'text' }) {
    let current = { str, color, size, weight };
    function layout() {
      measureCv.font = font(current.weight, current.size);
      const lines = wrapLines(measureCv, current.str, maxW);
      const widest = Math.max(1, ...lines.map((l) => measureCv.measureText(l).width));
      const lh = current.size * lineHeight;
      return { lines, w: Math.ceil(widest + 8), h: Math.ceil(lh * lines.length + current.size * 0.35), lh };
    }
    function drawFn(lay) {
      return (g, w) => {
        g.font = font(current.weight, current.size);
        g.fillStyle = current.color;
        g.textBaseline = 'alphabetic';
        g.textAlign = align;
        const ax = align === 'center' ? w / 2 : align === 'right' ? w - 4 : 4;
        lay.lines.forEach((l, i) => g.fillText(l, ax, lay.lh * i + current.size * 1.0));
      };
    }
    const lay = layout();
    const api = drawn(parent, { w: lay.w, h: lay.h, x, y, z, name, draw: drawFn(lay) });
    api.anchorX = x;
    api.align = align;
    function reposition() {
      // Keep left/right aligned blocks anchored at their x edge.
      const p = api.entity.getLocalPosition();
      const cx = align === 'left' ? api.anchorX + api.w / 2 : align === 'right' ? api.anchorX - api.w / 2 : api.anchorX;
      api.entity.setLocalPosition(wx(cx), p.y, p.z);
    }
    reposition();
    api.setText = (next, opts = {}) => {
      const changed = next !== current.str || Object.entries(opts).some(([k, v]) => current[k] !== v);
      if (!changed) return api;
      current = { ...current, str: next, ...opts };
      const l = layout();
      api.redraw(drawFn(l), l.w, l.h);
      reposition();
      return api;
    };
    api.get = () => current.str;
    api.refresh = () => { const l = layout(); api.redraw(drawFn(l), l.w, l.h); reposition(); };
    return api;
  }

  // Camera feed quad (material per feed so uniforms are independent).
  function feed(parent, { w, h, r = 28, x = 800, y = 500, z = 0.5, name = 'feed' }) {
    const e = meshEntity(parent, MAT_FEED, name);
    const mi = e.mi;
    const api = {
      entity: e, w, h, r, x, y, video: null, tex: null,
      setVideo(video) {
        api.video = video;
        api.tex?.destroy();
        api.tex = new pc.Texture(device, {
          format: pc.PIXELFORMAT_RGBA8, mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
          addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        });
        api.tex.setSource(video);
        mi.setParameter('uVideo', api.tex);
        api.layout();
      },
      upload() { if (api.tex && api.video?.readyState >= 2) api.tex.upload(); },
      // Cover-fit transform from quad UV to video UV (before mirroring).
      cover() {
        const vw = api.video?.videoWidth || 16, vh = api.video?.videoHeight || 9;
        const s = Math.max(api.w / vw, api.h / vh);
        const dw = vw * s, dh = vh * s;
        return { scaleU: api.w / dw, scaleV: api.h / dh, offU: (dw - api.w) / 2 / dw, offV: (dh - api.h) / 2 / dh };
      },
      layout() {
        const c = api.cover();
        mi.setParameter('uSize', [api.w, api.h]);
        mi.setParameter('uRadius', Math.min(api.r, api.w / 2, api.h / 2));
        mi.setParameter('uUvScale', [c.scaleU, c.scaleV]);
        mi.setParameter('uUvOffset', [c.offU, c.offV]);
        e.setLocalScale(api.w / 100, api.h / 100, 1);
        place(e, api.x, api.y, e.getLocalPosition().z);
      },
      opacity(a) { mi.setParameter('uAlpha', a); return api; },
      set({ w: nw, h: nh, r: nr, x: nx, y: ny, dim, sat, alpha } = {}) {
        if (nw !== undefined) api.w = nw; if (nh !== undefined) api.h = nh; if (nr !== undefined) api.r = nr;
        if (nx !== undefined) api.x = nx; if (ny !== undefined) api.y = ny;
        if (dim !== undefined) mi.setParameter('uDim', dim);
        if (sat !== undefined) mi.setParameter('uSat', sat);
        if (alpha !== undefined) mi.setParameter('uAlpha', alpha);
        api.layout();
        return api;
      },
      // Normalised landmark (x,y in [0,1] of the unmirrored camera image) -> design px.
      landmarkToDesign(lx, ly) {
        const c = api.cover();
        const qu = ((1 - lx) - c.offU) / c.scaleU; // mirror, then invert cover transform
        const qv = (ly - c.offV) / c.scaleV;
        return { x: api.x - api.w / 2 + qu * api.w, y: api.y - api.h / 2 + qv * api.h };
      },
    };
    mi.setParameter('uShadowTint', rgba('#262C33').slice(0, 3));
    mi.setParameter('uLightTint', rgba('#F4F1EC').slice(0, 3));
    place(e, x, y, z);
    api.set({ dim: 1, sat: 0.7, alpha: 1 });
    return api;
  }

  // Screen (canvas CSS px) <-> design px.
  function designToScreen(x, y) {
    const cv = device.canvas;
    const s = cv.clientHeight / (view.orthoHeight * 200);
    return { x: cv.clientWidth / 2 + (x - 800) * s, y: cv.clientHeight / 2 + (y - 500) * s };
  }
  function screenToDesign(x, y) {
    const cv = device.canvas;
    const s = cv.clientHeight / (view.orthoHeight * 200);
    return { x: 800 + (x - cv.clientWidth / 2) / s, y: 500 + (y - cv.clientHeight / 2) / s };
  }
  // Visible area in design px (wider or taller than 1600x1000 depending on window aspect).
  function visibleDesign() {
    const cv = device.canvas;
    const h = view.orthoHeight * 200;
    const w = h * (cv.clientWidth / Math.max(1, cv.clientHeight));
    return { w, h, left: 800 - w / 2, top: 500 - h / 2 };
  }

  const refreshTexts = () => { for (const d of drawns) d.refresh(); };
  return { device, view, node, place, panel, hitbox, drawn, text, feed, refreshTexts, makeCanvas, canvasTexture, designToScreen, screenToDesign, visibleDesign, wx, wy, S };
}
