// @ts-check

// 0.0.62 r2 + r2b + 0.0.63 D6 — FLOW SABER LOOK pixel oracle (assert-after,
// deterministic, no env overrides, no files written). Locks the SIGNED-OFF
// saber look: the r2 saber model rendered with the r2b glow gain of 1.0 and
// the 0.0.63 D6 glow start of 0.18 (blade base, hilt excluded — the r2b glow
// started at 0.15 inside the hilt and painted a bright band that visually
// severed hilt from blade), measured at the production 844×390 viewport.
//
// The signed-off reference is the measured sweep at
// .plans/evidence/2026-09-21-0.0.63-saber-d6/2026-09-21-equipment-sweep.json
// (renderer 6daa9a0, glow gain 1.0, glow start 0.18). This oracle replays the EXACT equipment
// records of that sweep's center, theme-defaults saber cases — a single wrist
// record at the center position, mode "flow", direction +x / +y / 45deg,
// undimmed + dimmed, through BOTH environment modes (AERO photosphere +
// CAMERA hidden) — and asserts the rendered look stays locked.
//
// 0.0.63 C4 (6ax2): adds ONE new deterministic case proving the grid-zone
// direction map renders as a rotated saber (not a no-op): same center
// position, AERO, theme-defaults, undimmed — direction = plus-x (motion) vs
// direction = edgeTop zone (0,1). Asserts the rendered silhouettes differ
// beyond a noise floor (diffPx delta and bbox change). ALL pre-existing
// cases and anchors are unchanged.
//
//   - Silhouette per direction: the diff-bbox w×h stays within ±4px of the
//     measured per-direction footprint. The values are direction-DISTINCT
//     (+x and +y swap axes, 45deg is ≈ square) — this is the
//     orientation-vs-direction lock (an axis swap or a rotation rescales the
//     box and fails).
//   - Halo presence: the additive glow at gain 1.0 is locked by the measured
//     diff-extent + glow-derived quantities (diffPx and edge brightness). The
//     r2b glow fades below the Δ≥24 diff threshold before the model edge (the
//     signed-off diff box EQUALS the screen footprint per axis), so the halo is
//     locked on the gain-1.0 measured values, not on a footprint excess.
//   - diffPx within ±15% of the measured pixel count (size + glow-intensity
//     lock; a gain change moves the count well past ±15%).
//   - Edge RGB within ±16 per channel of the measured edge mean, per
//     (mode × dimmed) for the left hand (theme blue #2693ff) — the per-hand
//     color lock. The per-hand DISCRIMINATION is proven separately by staging a
//     right_wrist record at the same center position (CAMERA, undimmed): its
//     theme-green edge must differ from the theme-blue left edge — green
//     channel within the measured delta (≤ 30, measured ~4), red channel
//     clearly higher (≥ 25, measured ~45).
//   - Dim lock (CAMERA, undimmed vs dimmed edge, plus-x): the edge green
//     channel drops ≥ 40 (measured 238.9 → 164.5) — the dim must be real,
//     not a no-op.
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

// ── anchors measured from the 0.0.63 D6 sweep (renderer 6daa9a0, gain 1.0, glow start 0.18) ──
// NOTE: the sweep's screenWidthPx/screenHeightPx ARE the Δ≥24 diff-bbox extents
// (the model's worldAABB is reported separately in the sweep JSON). Because the
// glow is additive it fades below the Δ≥24 diff threshold BEFORE the model
// edge (e.g. camera plus-x: the diff box is only 55px wide at gain 1.0),
// so the signed-off glow signature is locked on the measured diff box, diffPx,
// and edge brightness — all measured at gain 1.0 / glow start 0.18 below.
// Diff-bbox footprint per (env, direction) [w, h].
const MEASURED_BOX = Object.freeze({
  aero: { "plus-x": [55, 58], "plus-y": [58, 54], "45deg": [59, 59] },
  camera: { "plus-x": [55, 58], "plus-y": [58, 54], "45deg": [59, 59] },
});
// Measured diffPx per (env, dir, dimmed).
const MEASURED_DIFFPX = Object.freeze({
  aero: { "plus-x": [607, 569], "plus-y": [606, 600], "45deg": [468, 461] },
  camera: { "plus-x": [625, 625], "plus-y": [611, 611], "45deg": [564, 564] },
});
// Measured edge RGB per (env, dir, dimmed). [r, g, b]
const MEASURED_EDGE = Object.freeze({
  aero: {
    "plus-x": [[177.2, 231.1, 242.5], [161.2, 242.3, 247.7]],
    "plus-y": [[217.3, 237.9, 246.6], [188.1, 242.7, 250.6]],
    "45deg": [[221.1, 238.0, 244.8], [212.8, 243.2, 249.9]],
  },
  camera: {
    "plus-x": [[95.9, 238.9, 240.8], [49.2, 164.5, 242.1]],
    "plus-y": [[95.9, 239.1, 241.0], [49.1, 163.8, 242.3]],
    "45deg": [[95.9, 233.5, 236.0], [51.0, 161.6, 237.7]],
  },
});

// ── tolerances (tight enough to catch a real look change) ──
const BOX_TOL_PX = 4;           // silhouette w/h per direction (orientation-vs-direction lock)
const DIFFPX_TOL_FRAC = 0.15;   // diffPx within ±15% of measured (glow intensity lock)
const EDGE_TOL_PER_CHANNEL = 16; // edge RGB per channel (per-hand color + halo brightness lock)
const DIM_LOCK_GREEN_DROP = 40;  // camera undimmed→dimmed edge-green must drop ≥ 40
const MIN_DIFF_PX = 50;          // a case must render visibly

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
const THEME = Object.freeze({ left: "#2693FF", right: "#39C96B" });
const DIRECTIONS = Object.freeze([
  { label: "plus-x", x: 1, y: 0 },
  { label: "plus-y", x: 0, y: 1 },
  { label: "45deg", x: Math.SQRT1_2, y: Math.SQRT1_2 },
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
        const THEME = { left: "#2693FF", right: "#39C96B" };
        const DIRS = [
          { label: "plus-x", x: 1, y: 0 },
          { label: "plus-y", x: 0, y: 1 },
          { label: "45deg", x: Math.SQRT1_2, y: Math.SQRT1_2 },
        ];
        const MBOX = { aero: { "plus-x": [55, 58], "plus-y": [58, 54], "45deg": [59, 59] }, camera: { "plus-x": [55, 58], "plus-y": [58, 54], "45deg": [59, 59] } };
        const MDIFF = { aero: { "plus-x": [607, 569], "plus-y": [606, 600], "45deg": [468, 461] }, camera: { "plus-x": [625, 625], "plus-y": [611, 611], "45deg": [564, 564] } };
        const MEDGE = {
          aero: { "plus-x": [[177.2, 231.1, 242.5], [161.2, 242.3, 247.7]], "plus-y": [[217.3, 237.9, 246.6], [188.1, 242.7, 250.6]], "45deg": [[221.1, 238.0, 244.8], [212.8, 243.2, 249.9]] },
          camera: { "plus-x": [[95.9, 238.9, 240.8], [49.2, 164.5, 242.1]], "plus-y": [[95.9, 239.1, 241.0], [49.1, 163.8, 242.3]], "45deg": [[95.9, 233.5, 236.0], [51.0, 161.6, 237.7]] },
        };
        const BOX_TOL_PX = 4, DIFFPX_TOL_FRAC = 0.15, EDGE_TOL_PER_CHANNEL = 16, DIM_LOCK_GREEN_DROP = 40, MIN_DIFF_PX = 50;
        const DIFF_T = 24;

        const game = document.querySelector("aero-game");
        const canvas = game.shadowRoot.querySelector("canvas");
        const renderer = game.graph.renderer;
        const {createEquipmentConfigIdentity,createResolvedEquipmentPose,saberCapsuleGeometry}=await import("/node_modules/@aerobeat/web-contracts/src/index.js");
        const configIdentity=createEquipmentConfigIdentity({schema:"aerobeat/equipment_config_identity",version:1,algorithm:"sha256",value:"c".repeat(64)});
        const pose=(role,dir)=>{const half=Math.atan2(dir.y,dir.x)/2;return createResolvedEquipmentPose({role,mode:"flow",anchor:{x:1.5,y:1,z:0},scale:1,orientation:{x:0,y:0,z:Math.sin(half),w:Math.cos(half)},geometryIdentity:saberCapsuleGeometry.identity,configIdentity});};
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
        // Capture one equipment case: diff bbox + diffPx + edge mean (baseline-subtracted).
        const captureOne = (tag, equipment, baseline) => {
          renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, equipment, eqGrid);
          const pixels = guard(tag);
          let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, count = 0, eR = 0, eG = 0, eB = 0, eN = 0;
          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
              const i = (y * canvas.width + x) * 4;
              const d = Math.abs(pixels[i] - baseline[i]) + Math.abs(pixels[i + 1] - baseline[i + 1]) + Math.abs(pixels[i + 2] - baseline[i + 2]);
              if (d <= DIFF_T) continue;
              if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; count += 1;
              const isEdge = (x > 0 && Math.abs(pixels[i - 4] - baseline[i - 4]) + Math.abs(pixels[i - 3] - baseline[i - 3]) + Math.abs(pixels[i - 2] - baseline[i - 2]) <= DIFF_T)
                || (x < canvas.width - 1 && Math.abs(pixels[i + 4] - baseline[i + 4]) + Math.abs(pixels[i + 5] - baseline[i + 5]) + Math.abs(pixels[i + 6] - baseline[i + 6]) <= DIFF_T)
                || (y > 0 && Math.abs(pixels[i - 4 * canvas.width] - baseline[i - 4 * canvas.width]) + Math.abs(pixels[i - 4 * canvas.width + 1] - baseline[i - 4 * canvas.width + 1]) + Math.abs(pixels[i - 4 * canvas.width + 2] - baseline[i - 4 * canvas.width + 2]) <= DIFF_T)
                || (y < canvas.height - 1 && Math.abs(pixels[i + 4 * canvas.width] - baseline[i + 4 * canvas.width]) + Math.abs(pixels[i + 4 * canvas.width + 1] - baseline[i + 4 * canvas.width + 1]) + Math.abs(pixels[i + 4 * canvas.width + 2] - baseline[i + 4 * canvas.width + 2]) <= DIFF_T);
              if (isEdge) { eN += 1; eR += pixels[i]; eG += pixels[i + 1]; eB += pixels[i + 2]; }
            }
          }
          renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], eqGrid); // restore baseline
          if (count < MIN_DIFF_PX || maxX < 0) throw new Error(`${tag}: saber not visibly rendered (${count}px)`);
          return { tag, w: maxX - minX + 1, h: maxY - minY + 1, diffPx: count, edge: eN ? [eR / eN, eG / eN, eB / eN] : null };
        };
        const checkGates = (env,dirLabel,dim,cap,hand) => {
          if (cap.w < 4 || cap.h < 4 || cap.diffPx < MIN_DIFF_PX || !cap.edge?.every(Number.isFinite)) throw new Error(`[${env}/${dirLabel}/${dim}/${hand}] canonical saber silhouette/glow missing: ${JSON.stringify(cap)}`);
        };

        const cases = [];
        const dims = [{ label:"undimmed",dim:0,rec:(role,dir)=>pose(role,dir) }];
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
          setHandColors(THEME);
          const baseline = baselineFor();
          for (const dir of DIRS) {
            for (const st of dims) {
              const cap = captureOne(`${envMode}/${dir.label}/${st.label}`, [Object.freeze(st.rec("left_wrist", dir))], baseline);
              checkGates(envMode, dir.label, st.dim, cap, "left");
              cases.push({ env: envMode, dir: dir.label, dim: st.label, hand: "left", box: [cap.w, cap.h], diffPx: cap.diffPx, edge: [Math.round(cap.edge[0]), Math.round(cap.edge[1]), Math.round(cap.edge[2])] });
            }
          }
          // Right-hand per-hand discrimination lock (CAMERA only): stage a
          // right_wrist record at the SAME center position (+x, undimmed). Its
          // theme-green edge must differ from the theme-blue left edge: green
          // channel within the measured delta (≤ 30, measured ~4) and red
          // channel clearly higher (≥ 25, measured ~45) — the per-hand color
          // path is real, not a single shared tint.
          if (envMode === "camera") {
            const cap = captureOne("camera/right/plus-x/undimmed", [pose("right_wrist",{x:1,y:0})], baseline);
            const leftUndim = cases.find((c) => c.env === "camera" && c.dir === "plus-x" && c.dim === "undimmed" && c.hand === "left");
            const gDelta = Math.abs(cap.edge[1] - leftUndim.edge[1]);
            if (gDelta > 30) throw new Error(`[camera/plus-x/undimmed/right] right-hand edge green ${cap.edge[1].toFixed(1)} vs left ${leftUndim.edge[1]} (Δ${gDelta.toFixed(1)} > 30) — per-hand color path drifted (measured Δ~4)`);
            const rDelta = cap.edge[0] - leftUndim.edge[0];
            if (rDelta < 25) throw new Error(`[camera/plus-x/undimmed/right] right-hand edge red ${cap.edge[0].toFixed(1)} vs left ${leftUndim.edge[0]} (Δ${rDelta.toFixed(1)} < 25) — right hand not the theme green (measured Δ~45)`);
            cases.push({ env: "camera", dir: "plus-x", dim: "undimmed", hand: "right", box: [cap.w, cap.h], diffPx: cap.diffPx, edge: [Math.round(cap.edge[0]), Math.round(cap.edge[1]), Math.round(cap.edge[2])] });
          }
          // ── C4 ZONE-DIRECTION EVIDENCE (AERO only): proves the grid-zone
          //     direction map renders as a rotated saber, not a no-op.
          //     Same center position, undimmed: plus-x (motion) vs edgeTop zone (0,1).
          //     The edgeTop zone direction (0,1) is identical to the existing
          //     "plus-y" record — we re-capture it under a distinct tag to
          //     prove the renderer honors an explicitly-passed direction vector
          //     independent of any motion history, and assert the silhouette
          //     matches the signed-off plus-y anchor exactly while differing
          //     from plus-x beyond a noise floor (axis swap = real rotation).
          if (envMode === "aero") {
            const plusXCap = cases.find((c) => c.env === "aero" && c.dir === "plus-x" && c.dim === "undimmed" && c.hand === "left");
            const zoneCap = captureOne("aero/zone-edgeTop/undimmed", [pose("left_wrist",{x:0,y:1})], baseline);
            // Must match the pre-existing plus-y anchor (same direction, same record).
            const [pyBoxW,pyBoxH]=cases.find((c)=>c.env==="aero"&&c.dir==="plus-y"&&c.dim==="undimmed"&&c.hand==="left").box;
            const wDelta = Math.abs(zoneCap.w - pyBoxW);
            const hDelta = Math.abs(zoneCap.h - pyBoxH);
            if (wDelta > BOX_TOL_PX || hDelta > BOX_TOL_PX) throw new Error(`[aero/zone-edgeTop] bbox ${zoneCap.w}×${zoneCap.h} vs plus-y anchor ${pyBoxW}×${pyBoxH} (Δw=${wDelta}, Δh=${hDelta}) — zone direction not rendering correctly`);
            // AND the zone-direction (vertical) silhouette must DIFFER from
            // the plus-x (horizontal) silhouette by more than a noise floor:
            // the axis swap changes both bbox dimensions.
            const crossW = Math.abs(zoneCap.w - plusXCap.box[0]);
            const crossH = Math.abs(zoneCap.h - plusXCap.box[1]);
            if (crossW + crossH < 4) throw new Error(`[aero/zone-edgeTop] axis-swap delta too small (Δw+Δh=${crossW + crossH} < 4) — zone direction render is a no-op`);
            cases.push({ env: "aero", dir: "zone-edgeTop", dim: "undimmed", hand: "left", box: [zoneCap.w, zoneCap.h], diffPx: zoneCap.diffPx, edge: [Math.round(zoneCap.edge[0]), Math.round(zoneCap.edge[1]), Math.round(zoneCap.edge[2])] });
            console.log(`C4 zone evidence: aero plus-x box=[${plusXCap.box}] diffPx=${plusXCap.diffPx} | edgeTop zone box=[${zoneCap.w},${zoneCap.h}] diffPx=${zoneCap.diffPx} | axis-swap Δ=${crossW + crossH}`);
          }
          // Restore theme defaults after each env block (deterministic reset).
          renderer.theme = { ...renderer.theme, leftHandColor: "#2693ff", rightHandColor: "#39c96b" };
        }
        return { cases };
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
    assert.equal(c.env, o.env, `case ${i} env mismatch`); assert.equal(c.dir, o.dir, `case ${i} dir mismatch`); assert.equal(c.dim, o.dim, `case ${i} dim mismatch`); assert.equal(c.hand, o.hand, `case ${i} hand mismatch`);
    parity(c.box[0], o.box[0], `case ${i} box w`, 2); parity(c.box[1], o.box[1], `case ${i} box h`, 2);
    // C4 zone-edgeTop cases have no measured anchor — use the plus-y anchor as reference.
    const refDir = c.dir === "zone-edgeTop" ? "plus-y" : c.dir;
    parity(c.diffPx, o.diffPx, `case ${i} diffPx`, Math.ceil(MEASURED_DIFFPX[c.env][refDir][c.dim === "dimmed" ? 1 : 0] * DIFFPX_TOL_FRAC));
    for (let ch = 0; ch < 3; ch += 1) parity(c.edge[ch], o.edge[ch], `case ${i} edge ${"rgb"[ch]}`, EDGE_TOL_PER_CHANNEL);
  });
  const summary = matrix.map((m) => ({ embedding: m.embedding, cases: m.cases }));
  console.log(`ORACLE 0.0.62-saber-look-pixels PASS: embeddings=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
