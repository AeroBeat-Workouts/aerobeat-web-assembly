// @ts-check

// FLOW SABER LOOK: real imported equipment GLB pixels, 844×390 viewport.
// Replays the historical r2/D6 sweep's center, theme-defaulted undimmed wrist
// poses (+X, +Y, 45°) in Aero and Camera environments. Measures visible
// silhouette/edge RGB against empty equipment, verifies the authored edgeTop
// direction actually rotates the saber, and independently compares blue left
// versus green right GLB frames at identical positions. Their same-pixel
// foreground red/blue contrast rejects a shared tint even with the pinned
// native shadow receiver changing the old diff bbox and edge averages.
// No dimmed pose or exact 2026-09 bbox/edge anchor is asserted by this gate;
// the historical sweep lives under .plans/evidence/2026-09-21-0.0.63-saber-d6/.
// Both direct and genuine cross-origin iframe embeddings sample real PlayCanvas
// pixels using OffscreenCanvas drawImage/getImageData, require visible geometry,
// cross-embedding parity, and reject unexpected console noise.
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

// Direction-swap and direct/iframe parity remain tied to active GLB pixels,
// not to the obsolete 2026-09 model-only silhouette before native shadows.
const BOX_TOL_PX = 4;
const EMBEDDING_DIFFPX_TOL_FRAC = 0.05;
const EDGE_TOL_PER_CHANNEL = 16;
const MIN_DIFF_PX = 50;

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
        const BOX_TOL_PX=4,MIN_DIFF_PX=50,DIFF_T=24;

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

        let leftBladeFrame=null,rightBladeFrame=null;
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
          if(tag==="camera/plus-x/undimmed")leftBladeFrame=Uint8ClampedArray.from(pixels);
          if(tag==="camera/right/plus-x/undimmed")rightBladeFrame=Uint8ClampedArray.from(pixels);
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
        let roleContrast=null;
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
          // Same pose/viewport, distinct hand roles: subtract the two REAL GLB
          // frames directly. Native floor shadows dilute the old single-pixel
          // edge mean; direct foreground RGB differences isolate the true tint.
          if (envMode === "camera") {
            const cap = captureOne("camera/right/plus-x/undimmed", [pose("right_wrist",{x:1,y:0})], baseline);
            const leftUndim = cases.find((c) => c.env === "camera" && c.dir === "plus-x" && c.dim === "undimmed" && c.hand === "left");
            if(!leftUndim||!leftBladeFrame||!rightBladeFrame||leftBladeFrame.length!==rightBladeFrame.length)throw new Error("both real saber frames must be captured before hand-role comparison");
            const gDelta=Math.abs(cap.edge[1]-leftUndim.edge[1]);
            if(gDelta>30)throw new Error(`right-hand edge green differs from left by ${gDelta.toFixed(1)}>30`);
            if(Math.abs(cap.w-leftUndim.box[0])>2||Math.abs(cap.h-leftUndim.box[1])>2||Math.abs(cap.diffPx-leftUndim.diffPx)>100)throw new Error("per-hand comparison requires the same visible saber silhouette");
            let changed=0,upper=0,foreground=0,redSum=0,blueSum=0;
            for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
              const i=(y*canvas.width+x)*4,dr=rightBladeFrame[i]-leftBladeFrame[i],dg=rightBladeFrame[i+1]-leftBladeFrame[i+1],db=rightBladeFrame[i+2]-leftBladeFrame[i+2];
              if(Math.abs(dr)+Math.abs(dg)+Math.abs(db)<24)continue;
              changed++;if(y<240)upper++;redSum+=dr;blueSum+=db;
              const leftDelta=Math.abs(leftBladeFrame[i]-baseline[i])+Math.abs(leftBladeFrame[i+1]-baseline[i+1])+Math.abs(leftBladeFrame[i+2]-baseline[i+2]);
              const rightDelta=Math.abs(rightBladeFrame[i]-baseline[i])+Math.abs(rightBladeFrame[i+1]-baseline[i+1])+Math.abs(rightBladeFrame[i+2]-baseline[i+2]);
              if(leftDelta>=24&&rightDelta>=24&&y<240)foreground++;
            }
            roleContrast={changed,upper,foreground,meanRedDelta:changed?redSum/changed:0,meanBlueDelta:changed?blueSum/changed:0};
            if(changed<150||upper<150||foreground<120||roleContrast.meanRedDelta<25||roleContrast.meanBlueDelta> -25)throw new Error(`right-hand green versus left-hand blue real saber pixels indistinct: ${JSON.stringify(roleContrast)}`);
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
        return { cases, roleContrast };
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
    parity(c.diffPx, o.diffPx, `case ${i} diffPx`, Math.ceil(c.diffPx * EMBEDDING_DIFFPX_TOL_FRAC));
    for (let ch = 0; ch < 3; ch += 1) parity(c.edge[ch], o.edge[ch], `case ${i} edge ${"rgb"[ch]}`, EDGE_TOL_PER_CHANNEL);
  });
  assert.ok(direct.roleContrast&&iframe.roleContrast,"both embeddings must produce per-hand real saber color evidence");
  for(const k of ["changed","upper","foreground"])parity(direct.roleContrast[k],iframe.roleContrast[k],`per-hand ${k} pixels`,20);
  for(const k of ["meanRedDelta","meanBlueDelta"])parity(direct.roleContrast[k],iframe.roleContrast[k],`per-hand ${k}`,5);
  const summary = matrix.map((m) => ({ embedding: m.embedding, cases: m.cases, roleContrast: m.roleContrast }));
  console.log(`ORACLE 0.0.62-saber-look-pixels PASS: embeddings=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
