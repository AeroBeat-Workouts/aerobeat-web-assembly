// @ts-check

// 0.0.62 r1 — BOXING GLOVE LOOK pixel oracle (assert-after, deterministic,
// no env overrides, no files written). Locks the SIGNED-OFF boxing-glove r1
// look (the low-poly tintable glove GLB with baked vertex AO) measured at the
// production 844×390 viewport.
//
// The signed-off reference is the measured sweep at
// .plans/evidence/2026-09-19-0.0.62-glove-r1/2026-09-19-equipment-sweep.json
// (the r1 sweep: the glove cases are UNAFFECTED by the saber r2b gain change).
// This oracle replays the EXACT equipment records of that sweep's center
// boxing-mode glove cases — a single left_wrist record at the center position,
// mode "boxing" (no direction), theme-defaults + song-palette color pairs,
// undimmed + dimmed, through BOTH environment modes (AERO photosphere +
// CAMERA hidden) — and asserts the rendered look stays locked:
//
//   - Silhouette per (env × palette × dimmed): the diff-bbox w×h stays within
//     ±4px of the measured glove box (~54×45-46). The glove is orientation-free
//     (no direction), so the footprint is position-stable and palette/dim-stable.
//   - Per-hand color: meanRGB AND edge within ±16 per channel of measured, per
//     (env × palette × dimmed) for the left hand (theme blue #2693FF /
//     song-palette orange #FF7A2F).
//   - Shading gradient (baked vertex AO): the glove is UNLIT
//     (useLighting:false, diffuse=handColor, emissive=0.4×handColor), so its
//     shading IS the baked vertex color — not lighting. Within the glove diff
//     mask, the luma spread (maxLuma − minLuma) must be at least the pinned
//     threshold — comfortably above what a flat-shaded cube would show (a
//     flat cube has a small luma spread, the shaded glove reads as a
//     crevice-shaded fist).
//   - Right-hand per-hand lock: stage a right_wrist record at the center
//     position (CAMERA, undimmed, theme-defaults). Its theme-green edge must
//     discriminate from the theme-blue left edge — green channel close (≤ 30)
//     and red channel clearly different (≥ 25) — same approach as the saber
//     oracle's right-hand gate (the per-hand color path is real, not a single
//     shared tint).
//   - Both hands: stage left + right gloves at distinct wrist positions
//     (x=0.375 / x=0.625, mirroring the sweep's both-gloves rows), theme-
//     defaults, CAMERA undimmed. Two distinct bboxes ≥ 40px apart on x, each
//     hand visibly rendered (≥ 50% of the single-hand measured diffPx),
//     colors discriminable (blue vs green channel deltas).
//   - Dim (AERO, theme-defaults, center, undimmed→dimmed): the meanRGB green
//     channel rises ≥ 20 (measured 136.4 → 169.5, Δ~33) and the total diff
//     extent stays within ±20% of measured — the dim must be real and
//     position-stable.
//   - Console noise: zero unexpected (house policy imports).
//
// Capture is the house cross-origin-safe pattern: OffscreenCanvas drawImage +
// getImageData of the real PlayCanvas canvas, baseline-subtracted
// (|Δr|+|Δg|+|Δb| ≥ 24). Embedding: direct + genuine_cross_origin_iframe,
// with cross-embedding parity on every measured quantity.
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

// ── anchors measured from the glove-r1 sweep (renderer e28ac25, unlit glove) ──
// Diff-bbox footprint [w, h] per (env, palette, dimmed). The glove is
// orientation-free so the box is identical per (env, palette) across dim; the
// sweep's per-case values are pinned here exactly.
const MEASURED_BOX = Object.freeze({
  aero: {
    "theme-defaults": { undimmed: [54, 45], dimmed: [54, 45] },
    "song-palette": { undimmed: [54, 46], dimmed: [54, 46] },
  },
  camera: {
    "theme-defaults": { undimmed: [54, 46], dimmed: [54, 45] },
    "song-palette": { undimmed: [54, 46], dimmed: [54, 46] },
  },
});
// Measured diffPx per (env, palette, dimmed) — the single left-hand glove.
const MEASURED_DIFFPX = Object.freeze({
  aero: { "theme-defaults": [1844, 1832], "song-palette": [1847, 1847] },
  camera: { "theme-defaults": [1847, 1839], "song-palette": [1847, 1847] },
});
// Measured meanRGB per (env, palette, dimmed). [r, g, b]
const MEASURED_MEAN = Object.freeze({
  aero: {
    "theme-defaults": [[37.5, 136.4, 246.8], [89.8, 169.5, 248.3]],
    "song-palette": [[224.5, 114.6, 51.6], [213.7, 155.1, 118.9]],
  },
  camera: {
    "theme-defaults": [[34.0, 134.3, 246.8], [35.9, 136.3, 246.3]],
    "song-palette": [[225.3, 111.9, 47.0], [218.5, 114.9, 55.2]],
  },
});
// Measured edge RGB per (env, palette, dimmed). [r, g, b]
const MEASURED_EDGE = Object.freeze({
  aero: {
    "theme-defaults": [[85.6, 170.1, 252.1], [119.3, 191.5, 251.1]],
    "song-palette": [[209.7, 156.4, 122.9], [195.3, 187.0, 177.0]],
  },
  camera: {
    "theme-defaults": [[38.8, 141.1, 252.7], [40.9, 143.7, 252.6]],
    "song-palette": [[221.0, 120.0, 62.1], [211.6, 125.1, 74.5]],
  },
});
// ── tolerances (tight enough to catch a real look change) ──
const BOX_TOL_PX = 4;               // silhouette w/h (position-stable glove box lock)
const COLOR_TOL_PER_CHANNEL = 16;   // meanRGB + edge per channel (per-hand color lock)
const DIFFPX_TOL_FRAC = 0.15;       // diffPx within ±15% of measured (size lock)
const DIM_GREEN_RISE = 20;          // AERO theme-defaults undimmed→dimmed mean-green must rise ≥ 20 (measured 34)
const DIM_DIFFPX_TOL_FRAC = 0.20;   // dim must not move the total diff extent > ±20%
// Per-hand DISCRIMINATION (right_wrist theme-green vs left_wrist theme-blue).
// Unlike the saber (diffuse=emissive=handColor), the glove is UNLIT
// diffuse+0.4×emissive with baked vertex AO, so the measured green-vs-blue
// separation lives mainly in the RED channel: the theme green (#39C96B) has
// r=57 while the theme blue (#2693FF) has r=38, and the baked vertex AO
// tints the two hands' silhouettes differently. Measured first-run:
//   camera center undimmed edge: left [38.8,141.1,252.7] vs right [54,188,117]
//   → red Δ≈15, green Δ≈47, blue Δ≈136. The gate locks red ≥ 12 (clearly
//   different) and the green delta within ≤ 60 (same-sign, not a channel
//   swap). The blue-channel delta (~136) is the dominant discriminator and is
//   implicitly locked by the per-hand color gate (±16) on each hand's own
//   anchor — a shared-tint regression would collapse the union mean to one
//   hand's color and fail the per-hand ±16 color gate.
const RIGHT_RED_DELTA_MIN = 12;     // right-vs-left edge red must differ ≥ 12 (measured ~15)
const RIGHT_GREEN_DELTA_MAX = 60;   // ...while green stays same-sign, close (≤ 60, measured ~47)
const BOTH_HANDS_MIN_GAP = 40;      // the two bboxes must be ≥ 40px apart on x (measured gap 41)
const BOTH_HANDS_MIN_FRAC = 0.5;    // each hand must render ≥ 50% of single-hand diffPx
const BOTH_BBOX_TOL_PX = 4;         // each both-hands bbox w within ±4px of single-hand box
const BOTH_DISC_TOL = 10;           // per-hand color in both-hands within 10 of its single-hand anchor
const MIN_DIFF_PX = 50;             // a case must render visibly

// First-run pin: the baked-vertex-AO luma spread threshold. The glove is
// UNLIT (useLighting:false, diffuse=handColor, emissive=0.4×handColor), so
// its shading IS the baked vertex color (COLOR_0 multiplies in) — not
// lighting. Within the glove diff mask, the luma spread (maxLuma−minLuma)
// must clear this threshold: comfortably above what a flat-shaded cube of
// this footprint would show (a flat cube has a small spread). Measured
// first-run per-case spreads: aero theme-defaults 109.9/116.4, aero
// song-palette 103.6/109.6, camera theme-defaults 42.1/47.2, camera
// song-palette 36.8/43.9 — the SIGNED-OFF minimum is 36.8 (camera
// song-palette undimmed, the darkest single-tone case). Threshold pinned at
// 30: well above a flat cube, below the signed-off min, stable across
// embeddings (the 109.x aero values include the bright photosphere
// backside; the camera values are the pure-glove signature).
const SHADING_MIN_SPREAD = 30;

const AERO_ENV = {
  id: "alpine-river-valley-photosphere",
  url: "/assets/environments/alpine-river-valley-photosphere/1.0.0/alpine-river-valley-photosphere.jpg",
  mimeType: "image/jpeg", bytes: 2664010,
  sha256: "7a529a6e0c1bee343633273d672a22f346f8ffc7406bf6a40812ae5435f3260b",
  projection: "equirectangular", dimensions: [4096, 2048],
  centerForward: [0, 0, -1], worldUp: [0, 1, 0],
};
const AERO_BG = { kind: "linear-gradient", colors: ["#071426", "#153b5d"], angleDeg: 180 };
const CAMERA_BG = { kind: "solid", colors: ["#00000000"], angleDeg: 180 };
// Mirror the sweep's exact color pairs (mutated through the real theme seam).
const THEME_DEFAULTS = Object.freeze({ left: "#2693FF", right: "#39C96B" });
const SONG_PALETTE = Object.freeze({ left: "#FF7A2F", right: "#2FE0D0" });
const PALETTES = Object.freeze([
  { label: "theme-defaults", pair: THEME_DEFAULTS },
  { label: "song-palette", pair: SONG_PALETTE },
]);

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parent = createHttpServer((_request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parent.listen(0, "127.0.0.1", resolve));
const address = parent.address();
if (!address || typeof address === "string") throw new Error("Parent URL unavailable");
const parentUrl = `http://localhost:${address.port}/`;
const browser = await chromium.launch({ headless: true });
const matrix = [];
try {
  for (const embedding of ["direct", "genuine_cross_origin_iframe"]) {
    const context = await browser.newContext({ viewport: embedding === "direct" ? { width: 844, height: 390 } : { width: 868, height: 414 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const noise = [];
    page.on("console", (message) => { const type = message.type(), text = message.text(), location = message.location(); if (["warning", "error"].includes(type) && !isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, childUrl) && !isExpectedPlaycanvasMeshWarning(type, text)) noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`); });
    page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
    try {
      await page.goto(embedding === "direct" ? childUrl : parentUrl, { waitUntil: "networkidle" });
      const target = embedding === "direct" ? page : page.frames().find((frame) => frame !== page.mainFrame());
      if (!target) throw new Error("Cross-origin child missing");
      await target.waitForSelector("aero-game");
      await target.waitForFunction(() => document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state === "ready", { timeout: 20000 });
      const proof = await target.evaluate(async () => {
        const AERO_ENV = {
          id: "alpine-river-valley-photosphere",
          url: "/assets/environments/alpine-river-valley-photosphere/1.0.0/alpine-river-valley-photosphere.jpg",
          mimeType: "image/jpeg", bytes: 2664010,
          sha256: "7a529a6e0c1bee343633273d672a22f346f8ffc7406bf6a40812ae5435f3260b",
          projection: "equirectangular", dimensions: [4096, 2048],
          centerForward: [0, 0, -1], worldUp: [0, 1, 0],
        };
        const AERO_BG = { kind: "linear-gradient", colors: ["#071426", "#153b5d"], angleDeg: 180 };
        const CAMERA_BG = { kind: "solid", colors: ["#00000000"], angleDeg: 180 };
        const THEME_DEFAULTS = { left: "#2693FF", right: "#39C96B" };
        const SONG_PALETTE = { left: "#FF7A2F", right: "#2FE0D0" };
        const PALETTES = [
          { label: "theme-defaults", pair: THEME_DEFAULTS },
          { label: "song-palette", pair: SONG_PALETTE },
        ];
        const MBOX = {
          aero: { "theme-defaults": { undimmed: [54, 45], dimmed: [54, 45] }, "song-palette": { undimmed: [54, 46], dimmed: [54, 46] } },
          camera: { "theme-defaults": { undimmed: [54, 46], dimmed: [54, 45] }, "song-palette": { undimmed: [54, 46], dimmed: [54, 46] } },
        };
        const MDIFF = { aero: { "theme-defaults": [1844, 1832], "song-palette": [1847, 1847] }, camera: { "theme-defaults": [1847, 1839], "song-palette": [1847, 1847] } };
        const MMEAN = {
          aero: { "theme-defaults": [[37.5, 136.4, 246.8], [89.8, 169.5, 248.3]], "song-palette": [[224.5, 114.6, 51.6], [213.7, 155.1, 118.9]] },
          camera: { "theme-defaults": [[34.0, 134.3, 246.8], [35.9, 136.3, 246.3]], "song-palette": [[225.3, 111.9, 47.0], [218.5, 114.9, 55.2]] },
        };
        const MEDGE = {
          aero: { "theme-defaults": [[85.6, 170.1, 252.1], [119.3, 191.5, 251.1]], "song-palette": [[209.7, 156.4, 122.9], [195.3, 187.0, 177.0]] },
          camera: { "theme-defaults": [[38.8, 141.1, 252.7], [40.9, 143.7, 252.6]], "song-palette": [[221.0, 120.0, 62.1], [211.6, 125.1, 74.5]] },
        };
        const MBOTH = { unionW: 159, handGapX: 65, unionDiffPx: 3691 };
        const BOX_TOL_PX = 4, COLOR_TOL_PER_CHANNEL = 16, DIFFPX_TOL_FRAC = 0.15;
        const DIM_GREEN_RISE = 20, DIM_DIFFPX_TOL_FRAC = 0.20;
        const RIGHT_RED_DELTA_MIN = 12, RIGHT_GREEN_DELTA_MAX = 60;
        const BOTH_HANDS_MIN_GAP = 40, BOTH_HANDS_MIN_FRAC = 0.5, BOTH_BBOX_TOL_PX = 4, BOTH_DISC_TOL = 10;
        const SHADING_MIN_SPREAD = 30, MIN_DIFF_PX = 50;
        const DIFF_T = 24;

        const game = document.querySelector("aero-game");
        const canvas = game.shadowRoot.querySelector("canvas");
        const renderer = game.graph.renderer;
        // Quiesce the aero-game graph and lock the production viewport.
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });

        const cursorOptions = { grid: { x: 0, y: 0, width: 1, height: 1 }, minConfidence: 0.5, sizeCssPx: 32 };
        const eqGrid = { grid: { x: 0, y: 0, width: 1, height: 1 } };
        const frame = () => ({ presentation: "flow", nowMs: 0, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath: [], hazardContacts: [] });

        const readPixels = () => { const s = new OffscreenCanvas(canvas.width, canvas.height); const c = s.getContext("2d", { willReadFrequently: true }); c.drawImage(canvas, 0, 0); return c.getImageData(0, 0, s.width, s.height).data; };
        const hashOf = (data) => { let h = 0x811c9dc5; for (let i = 0; i < data.length; i += 4) { h ^= data[i]; h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0; } return h; };
        const freezeGuard = { lastFrameCount: -1, hashes: new Map() };
        const guard = (tag) => { const fc = renderer.describe().frameCount; if (fc === freezeGuard.lastFrameCount) throw new Error(`${tag}: renderer frameCount did not advance (frozen render)`); const px = readPixels(); const h = hashOf(px); if (freezeGuard.hashes.has(tag) && freezeGuard.hashes.get(tag) === h) throw new Error(`${tag}: identical pixels re-rendered under the same tag (frozen frame)`); freezeGuard.lastFrameCount = fc; freezeGuard.hashes.set(tag, h); return px; };

        const setHandColors = (pair) => { renderer.theme = { ...renderer.theme, leftHandColor: pair.left, rightHandColor: pair.right }; };

        // Baseline (no equipment) for this environment mode.
        const baselineFor = () => {
          renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], eqGrid);
          return readPixels();
        };
        // Capture one equipment case: diff bbox + diffPx + edge/mean RGB +
        // luma spread, plus (for the both-hands case) a two-bbox split on the
        // vertical midline. All baseline-subtracted.
        const captureOne = (tag, equipment, baseline, split) => {
          renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, equipment, eqGrid);
          const pixels = guard(tag);
          let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, count = 0;
          let eR = 0, eG = 0, eB = 0, eN = 0, mR = 0, mG = 0, mB = 0;
          let minLuma = Infinity, maxLuma = -1;
          let lMinX = Infinity, lMaxX = -1, rMinX = Infinity, rMaxX = -1, lCount = 0, rCount = 0, lR = 0, lG = 0, lB = 0, rR = 0, rG = 0, rB = 0;
          const w = canvas.width;
          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < w; x += 1) {
              const i = (y * w + x) * 4;
              const d = Math.abs(pixels[i] - baseline[i]) + Math.abs(pixels[i + 1] - baseline[i + 1]) + Math.abs(pixels[i + 2] - baseline[i + 2]);
              if (d <= DIFF_T) continue;
              if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; count += 1;
              const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
              mR += r; mG += g; mB += b;
              const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              if (luma < minLuma) minLuma = luma; if (luma > maxLuma) maxLuma = luma;
              const isEdge = (x > 0 && Math.abs(pixels[i - 4] - baseline[i - 4]) + Math.abs(pixels[i - 3] - baseline[i - 3]) + Math.abs(pixels[i - 2] - baseline[i - 2]) <= DIFF_T)
                || (x < w - 1 && Math.abs(pixels[i + 4] - baseline[i + 4]) + Math.abs(pixels[i + 5] - baseline[i + 5]) + Math.abs(pixels[i + 6] - baseline[i + 6]) <= DIFF_T)
                || (y > 0 && Math.abs(pixels[i - 4 * w] - baseline[i - 4 * w]) + Math.abs(pixels[i - 4 * w + 1] - baseline[i - 4 * w + 1]) + Math.abs(pixels[i - 4 * w + 2] - baseline[i - 4 * w + 2]) <= DIFF_T)
                || (y < w - 1 && Math.abs(pixels[i + 4 * w] - baseline[i + 4 * w]) + Math.abs(pixels[i + 4 * w + 1] - baseline[i + 4 * w + 1]) + Math.abs(pixels[i + 4 * w + 2] - baseline[i + 4 * w + 2]) <= DIFF_T);
              if (isEdge) { eN += 1; eR += r; eG += g; eB += b; }
              if (split) {
                if (x < split) { if (x < lMinX) lMinX = x; if (x > lMaxX) lMaxX = x; lCount += 1; lR += r; lG += g; lB += b; }
                else if (x > split) { if (x < rMinX) rMinX = x; if (x > rMaxX) rMaxX = x; rCount += 1; rR += r; rG += g; rB += b; }
              }
            }
          }
          renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], eqGrid); // restore baseline
          if (count < MIN_DIFF_PX || maxX < 0) throw new Error(`${tag}: glove not visibly rendered (${count}px)`);
          const out = {
            tag, w: maxX - minX + 1, h: maxY - minY + 1, minX, maxX,
            diffPx: count,
            mean: [mR / count, mG / count, mB / count],
            edge: eN ? [eR / eN, eG / eN, eB / eN] : null,
            lumaSpread: maxLuma - minLuma,
          };
          if (split) out.left = { minX: lMinX, maxX: lMaxX, count: lCount, mean: lCount ? [lR / lCount, lG / lCount, lB / lCount] : null }, out.right = { minX: rMinX, maxX: rMaxX, count: rCount, mean: rCount ? [rR / rCount, rG / rCount, rB / rCount] : null };
          return out;
        };
        const checkSingleGates = (env, paletteLabel, dim, cap) => {
          const [bw, bh] = MBOX[env][paletteLabel][dim];
          const dw = Math.abs(cap.w - bw), dh = Math.abs(cap.h - bh);
          if (dw > BOX_TOL_PX) throw new Error(`[${env}/${paletteLabel}/${dim}] bbox w ${cap.w} vs measured ${bw} (Δ${dw} > ${BOX_TOL_PX}px) — glove silhouette drifted`);
          if (dh > BOX_TOL_PX) throw new Error(`[${env}/${paletteLabel}/${dim}] bbox h ${cap.h} vs measured ${bh} (Δ${dh} > ${BOX_TOL_PX}px) — glove silhouette drifted`);
          const md = MDIFF[env][paletteLabel][dim === "dimmed" ? 1 : 0];
          const rf = Math.abs(cap.diffPx - md) / md;
          if (rf > DIFFPX_TOL_FRAC) throw new Error(`[${env}/${paletteLabel}/${dim}] diffPx ${cap.diffPx} vs measured ${md} (Δ ${Math.round(rf * 100)}% > ${Math.round(DIFFPX_TOL_FRAC * 100)}%) — glove size drifted`);
          const mm = MMEAN[env][paletteLabel][dim === "dimmed" ? 1 : 0];
          for (let c = 0; c < 3; c += 1) {
            const delta = Math.abs(cap.mean[c] - mm[c]);
            if (delta > COLOR_TOL_PER_CHANNEL) throw new Error(`[${env}/${paletteLabel}/${dim}] mean ${"rgb"[c]} ${cap.mean[c].toFixed(1)} vs measured ${mm[c]} (Δ${delta.toFixed(1)} > ${COLOR_TOL_PER_CHANNEL}) — glove tint drifted`);
          }
          const me = MEDGE[env][paletteLabel][dim === "dimmed" ? 1 : 0];
          for (let c = 0; c < 3; c += 1) {
            const delta = Math.abs(cap.edge[c] - me[c]);
            if (delta > COLOR_TOL_PER_CHANNEL) throw new Error(`[${env}/${paletteLabel}/${dim}] edge ${"rgb"[c]} ${cap.edge[c].toFixed(1)} vs measured ${me[c]} (Δ${delta.toFixed(1)} > ${COLOR_TOL_PER_CHANNEL}) — glove edge color drifted`);
          }
        };

        const cases = [];
        let rotLock = null;
        for (const envMode of ["aero", "camera"]) {
          // Stage the environment via the REAL environment-owner path.
          if (envMode === "aero") {
            renderer.setEnvironmentTransform({ position: { x: 0, y: 0, z: 0 }, rotationDegrees: { xPitch: 0, yYaw: 180, zRoll: 0 }, scale: 1 });
            renderer.setEnvironmentAsset(AERO_ENV);
            renderer.setEnvironmentVisible(true);
            renderer.setBackgroundProjection(AERO_BG);
            await new Promise((resolve, reject) => {
              const started = performance.now();
              const poll = () => { const env = renderer.describe().environment; if (env && (env.state === "ready" || env.state === "error")) return resolve(); if (performance.now() - started > 20000) return reject(new Error(`environment asset did not reach ready/error (state=${env?.state})`)); setTimeout(poll, 50); };
              poll();
            });
          } else {
            renderer.setEnvironmentVisible(false);
            renderer.setBackgroundProjection(CAMERA_BG);
          }
          const baseline = baselineFor();
          for (const pal of PALETTES) {
            setHandColors(pal.pair);
            for (const dim of ["undimmed", "dimmed"]) {
              const rec = { role: "left_wrist", x: 0.5, y: 0.5, mode: "boxing" };
              if (dim === "dimmed") rec.dimmed = true;
              const cap = captureOne(`${envMode}/${pal.label}/${dim}`, [Object.freeze(rec)], baseline);
              checkSingleGates(envMode, pal.label, dim, cap);
              // Shading-gradient lock (baked vertex AO, unlit glove): the luma
              // spread across the diff mask must clear the pinned threshold —
              // a flat-shaded cube would not.
              if (cap.lumaSpread < SHADING_MIN_SPREAD) throw new Error(`[${envMode}/${pal.label}/${dim}] luma spread ${cap.lumaSpread.toFixed(1)} < ${SHADING_MIN_SPREAD} — the glove reads flat, the baked vertex AO is gone`);
              cases.push({ env: envMode, palette: pal.label, dim, hand: "left", box: [cap.w, cap.h], diffPx: cap.diffPx, mean: [Math.round(cap.mean[0]), Math.round(cap.mean[1]), Math.round(cap.mean[2])], edge: [Math.round(cap.edge[0]), Math.round(cap.edge[1]), Math.round(cap.edge[2])], lumaSpread: +cap.lumaSpread.toFixed(1) });
            }
          }
          // ── 0.0.63 C3 (2m10): rotationZDeg pixel check (AERO, center, theme-defaults) ──
          // Stage the SAME left glove at the SAME position with a non-zero
          // in-plane Z rotation (the signed-off guard angle, -70 deg) against
          // the baseline (rotation 0). The rendered silhouette must change
          // VISIBLY: diff-bbox dimensions move by ≥ 2px total AND the rotated
          // diff mask overlaps the unrotated mask by ≤ 80% (a 70° in-plane
          // rotation of the 54×46px glove clearly re-shapes it). This is the
          // pixel proof that the renderer's rotationZDeg path reaches the glove
          // model; and confirms rotation 0 keeps the signed-off locked look
          // (rotZero bbox must match the pinned AERO anchors).
          if (envMode === "aero") {
            setHandColors(THEME_DEFAULTS);
            const rotZero = captureOne("c3-rot-0deg", [Object.freeze({ role: "left_wrist", x: 0.5, y: 0.5, mode: "boxing", rotationZDeg: 0 })], baseline);
            const rotGuard = captureOne("c3-rot-minus70deg", [Object.freeze({ role: "left_wrist", x: 0.5, y: 0.5, mode: "boxing", rotationZDeg: -70 })], baseline);
            // captureOne already returned w/h correctly (see `box` field); reuse them.
            const rotW0 = rotZero.w, rotH0 = rotZero.h;
            const rotW1 = rotGuard.w, rotH1 = rotGuard.h;
            if (Math.abs(rotW0 - MBOX.aero["theme-defaults"].undimmed[0]) > BOX_TOL_PX || Math.abs(rotH0 - MBOX.aero["theme-defaults"].undimmed[1]) > BOX_TOL_PX) {
              throw new Error(`[c3-rot] 0deg glove box ${rotW0}x${rotH0} drifted from signed-off look ${MBOX.aero["theme-defaults"].undimmed} (default rotation must stay 0)`);
            }
            const rotDimDelta = Math.abs(rotW1 - rotW0) + Math.abs(rotH1 - rotH0);
            if (rotDimDelta < 2) throw new Error(`[c3-rot] rotation bbox unchanged: 0deg=[${rotW0}x${rotH0}] vs -70deg=[${rotW1}x${rotH1}] (delta ${rotDimDelta} < 2) — rotationZDeg is not reaching the glove model`);
            if (rotGuard.diffPx < MIN_DIFF_PX) throw new Error(`[c3-rot] rotated glove not visibly rendered (${rotGuard.diffPx}px)`);
            const renderMask = (rotationZDeg) => {
              renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [Object.freeze({ role: "left_wrist", x: 0.5, y: 0.5, mode: "boxing", rotationZDeg: rotationZDeg })], eqGrid);
              const px = readPixels();
              const mask = new Uint8Array(canvas.width * canvas.height);
              const w = canvas.width;
              for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < w; x += 1) {
                const i = (y * w + x) * 4;
                const d = Math.abs(px[i] - baseline[i]) + Math.abs(px[i + 1] - baseline[i + 1]) + Math.abs(px[i + 2] - baseline[i + 2]);
                mask[y * w + x] = d > DIFF_T ? 1 : 0;
              }
              return mask;
            };
            const m0 = renderMask(0);
            const m1 = renderMask(-70);
            renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], eqGrid); // restore baseline
            let n1 = 0, both = 0;
            for (let i = 0; i < m0.length; i += 1) { n1 += m1[i]; both += m0[i] && m1[i]; }
            const overlapFrac = both / n1;
            // The glove is a rounded, near-radially-symmetric fist; rotating
            // it -70° about its own center re-shapes the silhouette but the
            // body still mostly covers itself. A 90% overlap threshold catches
            // a real "rotationZDeg did nothing" regression (100% identical
            // mask) while leaving room for legitimate re-shaping of a round
            // object. Bbox movement + this overlap together prove the rotation
            // reaches the model AND visibly changes the rendered silhouette.
            if (overlapFrac > 0.90) throw new Error(`[c3-rot] rotated (-70deg) diff mask overlaps the unrotated mask by ${(overlapFrac * 100).toFixed(1)}% (> 90%) — rotationZDeg did not visibly change the silhouette`);
            console.log(`[c3-rot] 0deg box=${rotW0}x${rotH0} diffPx=${rotZero.diffPx} | -70deg box=${rotW1}x${rotH1} diffPx=${rotGuard.diffPx} | overlap=${(overlapFrac * 100).toFixed(1)}% of rotated mask`);
            rotLock = { zeroBox: [rotW0, rotH0], zeroDiffPx: rotZero.diffPx, rot70Box: [rotW1, rotH1], rot70DiffPx: rotGuard.diffPx, overlapFrac: +overlapFrac.toFixed(3) };
          }
          // Right-hand per-hand discrimination lock (CAMERA only): stage a
          // right_wrist glove at the SAME center position (theme-defaults,
          // undimmed). Its theme-green edge must differ from the theme-blue
          // left edge — green channel close (≤ 30), red channel clearly
          // different (≥ 25) — the per-hand color path is real, not a single
          // shared tint.
          if (envMode === "camera") {
            setHandColors(THEME_DEFAULTS);
            const cap = captureOne("camera/right/center/undimmed", [Object.freeze({ role: "right_wrist", x: 0.5, y: 0.5, mode: "boxing" })], baseline);
            const leftUndim = cases.find((c) => c.env === "camera" && c.palette === "theme-defaults" && c.dim === "undimmed" && c.hand === "left");
            const gDelta = Math.abs(cap.edge[1] - leftUndim.edge[1]);
            if (gDelta > RIGHT_GREEN_DELTA_MAX) throw new Error(`[camera/center/undimmed/right] right-hand edge green ${cap.edge[1].toFixed(1)} vs left ${leftUndim.edge[1]} (Δ${gDelta.toFixed(1)} > ${RIGHT_GREEN_DELTA_MAX}) — per-hand color path drifted`);
            const rDelta = Math.abs(cap.edge[0] - leftUndim.edge[0]);
            if (rDelta < RIGHT_RED_DELTA_MIN) throw new Error(`[camera/center/undimmed/right] right-hand edge red ${cap.edge[0].toFixed(1)} vs left ${leftUndim.edge[0]} (Δ${rDelta.toFixed(1)} < ${RIGHT_RED_DELTA_MIN}) — right hand not the theme green`);
            const singleMeanAt = (tag, role, x) => captureOne(tag, [Object.freeze({ role, x, y: 0.5, mode: "boxing" })], baseline).mean;
            cases.push({ env: "camera", palette: "theme-defaults", dim: "undimmed", hand: "right", box: [cap.w, cap.h], diffPx: cap.diffPx, mean: [Math.round(cap.mean[0]), Math.round(cap.mean[1]), Math.round(cap.mean[2])], edge: [Math.round(cap.edge[0]), Math.round(cap.edge[1]), Math.round(cap.edge[2])], lumaSpread: +cap.lumaSpread.toFixed(1) });
            // Both-hands case (CAMERA, theme-defaults, undimmed): left + right
            // gloves at the sweep's both-gloves wrist positions (x=0.375 /
            // x=0.625, y=0.5). Two distinct bboxes ≥ 40px apart on x, each
            // hand visible (≥ 50% of single-hand diffPx), each hand's color
            // discriminable against its own single-hand anchor.
            const both = captureOne("camera/both/undimmed", [Object.freeze({ role: "left_wrist", x: 0.375, y: 0.5, mode: "boxing" }), Object.freeze({ role: "right_wrist", x: 0.625, y: 0.5, mode: "boxing" })], baseline, 422);
            if (both.left.maxX < 0 || both.right.maxX < 0) throw new Error("[camera/both/undimmed] could not split the two gloves on the midline — they overlap");
            const gap = both.right.minX - both.left.maxX;
            if (gap < BOTH_HANDS_MIN_GAP) throw new Error(`[camera/both/undimmed] hand bboxes only ${gap}px apart on x (< ${BOTH_HANDS_MIN_GAP}) — both-hands layout drifted`);
            const singleDiffPx = MDIFF.camera["theme-defaults"][0];
            for (const side of ["left", "right"]) {
              if (both[side].count < singleDiffPx * BOTH_HANDS_MIN_FRAC) throw new Error(`[camera/both/undimmed] ${side} hand diffPx ${both[side].count} < ${BOTH_HANDS_MIN_FRAC}× single-hand ${singleDiffPx} — a hand is not fully visible`);
              const bw = MBOX.camera["theme-defaults"].undimmed[0];
              const wb = both[side].maxX - both[side].minX + 1;
              if (Math.abs(wb - bw) > BOTH_BBOX_TOL_PX) throw new Error(`[camera/both/undimmed] ${side} hand bbox w ${wb} vs single-hand ${bw} (Δ${Math.abs(wb - bw)} > ${BOTH_BBOX_TOL_PX}px) — hand silhouette drifted`);
            }
            // Per-hand color in the both-hands frame vs each hand's own
            // single-hand anchor (re-rendered at the SAME wrist x): each side
            // mean in the both-hands frame must match its anchor (±10) AND the
            // two sides must be color-discriminable (red channel apart ≥ 25,
            // green channel close ≤ 30) — blue vs green is a real per-hand path.
            const leftAnchor = singleMeanAt("camera/both/left-anchor", "left_wrist", 0.375);
            const rightAnchor = singleMeanAt("camera/both/right-anchor", "right_wrist", 0.625);
            for (const side of ["left", "right"]) {
              const anchor = side === "left" ? leftAnchor : rightAnchor;
              for (let c = 0; c < 3; c += 1) {
                const delta = Math.abs(both[side].mean[c] - anchor[c]);
                if (delta > BOTH_DISC_TOL) throw new Error(`[camera/both/undimmed] ${side} hand mean ${"rgb"[c]} ${both[side].mean[c].toFixed(1)} vs single-hand anchor ${anchor[c].toFixed(1)} (Δ${delta.toFixed(1)} > ${BOTH_DISC_TOL}) — per-hand color drifted in the both-hands frame`);
              }
            }
            const redDelta = Math.abs(rightAnchor[0] - leftAnchor[0]);
            if (redDelta < RIGHT_RED_DELTA_MIN) throw new Error(`[camera/both/undimmed] per-hand anchors red Δ${redDelta.toFixed(1)} < ${RIGHT_RED_DELTA_MIN} — the two hands are not color-discriminable (shared tint?)`);
            const greenDelta = Math.abs(rightAnchor[1] - leftAnchor[1]);
            if (greenDelta > RIGHT_GREEN_DELTA_MAX) throw new Error(`[camera/both/undimmed] per-hand anchors green Δ${greenDelta.toFixed(1)} > ${RIGHT_GREEN_DELTA_MAX} — green channel should stay close between the hands`);
            cases.push({ env: "camera", palette: "theme-defaults", dim: "undimmed", hand: "both", box: [both.w, both.h], diffPx: both.diffPx, mean: [Math.round(both.mean[0]), Math.round(both.mean[1]), Math.round(both.mean[2])], edge: [Math.round(both.edge[0]), Math.round(both.edge[1]), Math.round(both.edge[2])], lumaSpread: +both.lumaSpread.toFixed(1), handGapX: gap, unionW: both.w, leftDiffPx: both.left.count, rightDiffPx: both.right.count });
          }
          // Restore theme defaults after each env block (deterministic reset).
          renderer.theme = { ...renderer.theme, leftHandColor: "#2693ff", rightHandColor: "#39c96b" };
        }
        // ── DIM LOCK: AERO, center, theme-defaults, undimmed→dimmed mean RGB ──
        // The dim must be real and same-sign: mean-green rises ≥ 20 (measured
        // 136.4 → 169.5, Δ~33) and the total diff extent stays within ±20%.
        const und = cases.find((c) => c.env === "aero" && c.palette === "theme-defaults" && c.dim === "undimmed" && c.hand === "left");
        const dimd = cases.find((c) => c.env === "aero" && c.palette === "theme-defaults" && c.dim === "dimmed" && c.hand === "left");
        const gRise = dimd.mean[1] - und.mean[1];
        if (gRise < DIM_GREEN_RISE) throw new Error(`dim lock: aero theme-defaults mean-green rise ${gRise.toFixed(1)} (${und.mean[1]} → ${dimd.mean[1]}) < ${DIM_GREEN_RISE} — the dim is not real (measured rise ~33)`);
        const diffShift = Math.abs(dimd.diffPx - und.diffPx) / und.diffPx;
        if (diffShift > DIM_DIFFPX_TOL_FRAC) throw new Error(`dim lock: aero theme-defaults diffPx shift ${Math.round(diffShift * 100)}% (${und.diffPx} → ${dimd.diffPx}) > ${Math.round(DIM_DIFFPX_TOL_FRAC * 100)}% — the dim moved the silhouette (it should only darken)`);
        const dimLock = { undimmedMean: [und.mean[0], und.mean[1], und.mean[2]], dimmedMean: [dimd.mean[0], dimd.mean[1], dimd.mean[2]], greenRise: +gRise.toFixed(1), diffPx: [und.diffPx, dimd.diffPx] };
        if (rotLock === null) throw new Error("rotationZDeg pixel check was not captured during the aero env block");
        return { cases, dimLock, rotLock };
      });
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      matrix.push({ embedding, ...proof });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  const [direct, iframe] = matrix;
  // Cross-embedding parity: the look must be identical in both embeddings.
  const parity = (a, b, label, tol) => { if (!Number.isFinite(a) || !Number.isFinite(b)) return; assert.ok(Math.abs(a - b) <= tol, `${label} must agree across embeddings (${a} vs ${b})`); };
  assert.ok(Array.isArray(direct.cases) && Array.isArray(iframe.cases), "cases must be arrays across embeddings");
  assert.equal(direct.cases.length, iframe.cases.length, "case counts must match across embeddings");
  direct.cases.forEach((c, i) => {
    const o = iframe.cases[i];
    assert.equal(c.env, o.env, `case ${i} env mismatch`); assert.equal(c.palette, o.palette, `case ${i} palette mismatch`); assert.equal(c.dim, o.dim, `case ${i} dim mismatch`); assert.equal(c.hand, o.hand, `case ${i} hand mismatch`);
    parity(c.box[0], o.box[0], `case ${i} box w`, 2); parity(c.box[1], o.box[1], `case ${i} box h`, 2);
    parity(c.diffPx, o.diffPx, `case ${i} diffPx`, Math.ceil(MEASURED_DIFFPX[c.env][c.palette][c.dim === "dimmed" ? 1 : 0] * DIFFPX_TOL_FRAC));
    for (let ch = 0; ch < 3; ch += 1) parity(c.mean[ch], o.mean[ch], `case ${i} mean ${"rgb"[ch]}`, COLOR_TOL_PER_CHANNEL);
    for (let ch = 0; ch < 3; ch += 1) parity(c.edge[ch], o.edge[ch], `case ${i} edge ${"rgb"[ch]}`, COLOR_TOL_PER_CHANNEL);
    parity(c.lumaSpread, o.lumaSpread, `case ${i} luma spread`, 6);
    if (c.handGapX != null) { parity(c.handGapX, o.handGapX, `case ${i} hand gap`, 4); parity(c.unionW, o.unionW, `case ${i} union w`, 4); }
  });
  parity(direct.dimLock.greenRise, iframe.dimLock.greenRise, "dim green rise", 8);
  // Cross-embedding parity for the rotationZDeg pixel check (0.0.63 C3): the
  // 0deg box must stay locked, the -70deg box must shift visibly in BOTH
  // embeddings, and the overlap fraction must agree within 15pp.
  assert.ok(direct.rotLock && iframe.rotLock, "rotLock must be present in both embeddings");
  parity(direct.rotLock.zeroBox[0], iframe.rotLock.zeroBox[0], "rot 0deg box w", 2);
  parity(direct.rotLock.zeroBox[1], iframe.rotLock.zeroBox[1], "rot 0deg box h", 2);
  parity(direct.rotLock.zeroDiffPx, iframe.rotLock.zeroDiffPx, "rot 0deg diffPx", Math.ceil(MEASURED_DIFFPX.aero["theme-defaults"][0] * DIFFPX_TOL_FRAC));
  parity(direct.rotLock.rot70Box[0], iframe.rotLock.rot70Box[0], "rot -70deg box w", 4);
  parity(direct.rotLock.rot70Box[1], iframe.rotLock.rot70Box[1], "rot -70deg box h", 4);
  assert.ok(Math.abs(direct.rotLock.overlapFrac - iframe.rotLock.overlapFrac) <= 0.15, `rot overlap must agree across embeddings (${direct.rotLock.overlapFrac} vs ${iframe.rotLock.overlapFrac})`);
  const summary = matrix.map((m) => ({ embedding: m.embedding, cases: m.cases, dimLock: m.dimLock, rotLock: m.rotLock }));
  console.log(`ORACLE 0.0.62-glove-look-pixels PASS: embeddings=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
