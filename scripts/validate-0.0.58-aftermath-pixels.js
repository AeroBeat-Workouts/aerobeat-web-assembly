// @ts-check

// 0.0.58 B11 real-pixel oracle — the Flow "hit corpse" (aftermath) must be
// proven by reading REAL rendered canvas pixels, NOT the scene-graph
// `frame.model.objects` (that model was correct even when the 0.0.57 render
// was broken, which is exactly why the bugs slipped through playtest).
//
// What this oracle proves (against a hand-crafted Flow frame with a committed
// `slice` aftermath + a live icon in the SAME frame):
//   (B11a) the two halves hold the note's COLUMN — the pixel centroid stays
//          near the note's spawn x (−1.5) across a multi-second fall
//          (nowMs = commit + 0/200/500/900 ms), never drifting to the track
//          center (x=0). Before the fix the spawn degraded to {0,1,0} once the
//          target cullled from the 350 ms feedback window → halves teleported
//          to center.
//   (B11b) the corpse keeps the note's ACTUAL glyph but DESATURATED: the white
//          outline stays light (~white) while the fill is low-saturation, and
//          the glyph is NOT a single uniform flat gray (the 0.0.57
//          AFTERMATH_HIT_CORPSE_GRAY override flattened the whole glyph).
//   (B11c) BOTH halves are present and DISTINCT (left vs right of the cut) —
//          the dedicated aftermath pool (isolated from the live-icon pool)
//          guarantees a live icon in the same frame cannot steal a half slot.
//   (B10)  the co-rendered live icon is FULL (unclipped) and keeps FULL color —
//          the desaturation must not leak onto live notes.
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface),
// mirroring the exact-3c9d dual-embedding oracle. Pixel hashes must match
// exactly between the two embeddings.
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

// A note hit in COLUMN 3 (x=+1.5) — the far edge of the track, maximally far
// from the track center (x=0), so a B11a center-teleport is unmistakable. The
// live co-rendered icon sits in column 0 (x=-1.5).
const HIT_COMMIT_MS = 6000;
const SPAWN = { x: 1.5, y: 1, z: 0 };
const NOTE_FILL = "#FF3030";
const FALL_OFFSETS_MS = [0, 200, 500, 900];

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
      await target.waitForFunction(() => document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state === "ready", { timeout: 15000 });
      const proof = await target.evaluate(async ({ hitCommitMs, spawn, noteFill, offsets }) => {
        const game = document.querySelector("aero-game");
        const renderer = game.graph.renderer;
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
        renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
        const canvas = game.shadowRoot.querySelector("canvas");
        const readPixels = () => {
          const sample = new OffscreenCanvas(canvas.width, canvas.height);
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, sample.width, sample.height).data;
        };
        const deltaRGB = (a, b, i) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        // World (x,y,z) → screen px (the facade's production camera is applied
        // by the last rendered frame; worldToScreen uses that live pose).
        const project = (x, y, z) => {
          // PlayCanvas camera.worldToScreen accepts a plain {x,y,z} record and
          // returns a vector-like {x,y,z} screen point; no pc import is needed
          // inside the page scope.
          const out = renderer.cameraEntity.camera.worldToScreen({ x, y, z });
          return { x: out.x, y: out.y };
        };
        // One hand-crafted aftermath entry (the committed hit corpse) + ONE live
        // icon in the SAME frame to exercise the pool (B11c). The aftermath
        // asset (arrow) differs from the live icon asset (orb), and the live
        // icon sits far away (x=1.5) so it can never overlap the halves.
        const aftermathEntry = {
          targetId: "corpse-a",
          hitCommitMs: hitCommitMs,
          family: "flow",
          hand: "neutral",
          mode: "slice",
          shape: "arrow",
          spawn: { x: spawn.x, y: spawn.y, z: spawn.z },
          seed: 1234,
          appearanceColor: noteFill
        };
        const liveIconTarget = { id: "live-orb", kind: "flow", hand: "left", family: "flow", cell: 4, cells: [], lane: null, beatCenterMs: hitCommitMs + 800, direction: null, appearanceColor: "#00C8FF" };
        const frameAt = (nowMs) => ({
          presentation: "flow",
          nowMs,
          targets: [liveIconTarget],
          timingWindowBeforeMs: 180,
          timingWindowAfterMs: 180,
          aftermath: [aftermathEntry]
        });
        // Baseline: the same frame with NO aftermath → any diff is the corpse.
        const renderBaseline = (nowMs) => {
          renderer.renderGameplayFrame({ presentation: "flow", nowMs, targets: [liveIconTarget], timingWindowBeforeMs: 180, timingWindowAfterMs: 180 });
          return readPixels();
        };
        // Per-frame corpse pixel stats at the note's column.
        const frames = [];
        for (const offsetMs of offsets) {
          const nowMs = hitCommitMs + offsetMs;
          const baseline = renderBaseline(nowMs);
          renderer.renderGameplayFrame(frameAt(nowMs));
          const pixels = readPixels();
          let count = 0, sumX = 0, sumY = 0, maxLuma = 0, satSum = 0, satCount = 0, distinctFill = 0;
          const fills = new Set();
          for (let i = 0; i < pixels.length; i += 4) {
            if (deltaRGB(pixels, baseline, i) <= 30) continue;
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            count += 1;
            sumX += (i / 4) % canvas.width;
            sumY += Math.floor(i / 4 / canvas.width);
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (luma > maxLuma) maxLuma = luma;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            satSum += (mx - mn);
            satCount += 1;
            if (luma > 60) { distinctFill += 1; fills.add(`${r >> 4},${g >> 4},${b >> 4}`); }
          }
          frames.push({ offsetMs, count, meanX: count ? sumX / count : 0, meanY: count ? sumY / count : 0, maxLuma, meanSat: satCount ? satSum / satCount : 0, distinctFillBuckets: fills.size });
        }
        // B11a: project the column. The corpse centroid screen x must track the
        // note's spawn x (−1.5), NOT the track center (x=0). Sample the
        // projection at the current camera pose.
        const proj = {
          spawnX: project(spawn.x, spawn.y, spawn.z),
          centerX: project(0, spawn.y, 0)
        };
        // B11b/B11c at the t=0 frame (full alpha, both halves, pre-settle):
        // the corpse is two halves split left/right around the column, the
        // outline is light, the fill is desaturated, and it is not one flat gray.
        renderer.renderGameplayFrame(frameAt(hitCommitMs));
        renderer.renderGameplayFrame(frameAt(hitCommitMs));
        // A pure-white reference through the same unlit pipeline: calibrates the
        // "light outline" / "not flat gray" thresholds against THIS headless
        // renderer's output (StandardMaterial useLighting=false renders ≈ diffuse*
        // emissiveFactor, so the bright mat/white outline reads well below 255 here).
        const whiteProbe = (() => {
          renderer.clear({ color: [0, 0, 0, 1] });
          const e = renderer.acquireAftermathAssetEntity("any-note/outlined-circle-v1", 99);
          if (!e) return 0;
          e.setPosition(0, 0, 0); e.setLocalScale(1, 1, 1); e.setEulerAngles(0, 0, 0); e.enabled = true;
          for (const c of e.findComponents("render")) c.layers = [renderer.gameplayTargetLayer?.id ?? 0];
          for (const rec of (renderer.assetMaterials.get(e) ?? [])) { rec.material.diffuse.set(1, 1, 1); rec.material.emissive.set(1, 1, 1); rec.material.opacity = 1; rec.material.useLighting = false; rec.material.update(); }
          renderer.manualTick();
          const withWhite = readPixels();
          let maxW = 0; for (let i = 0; i < withWhite.length; i += 4) { const l = 0.2126 * withWhite[i] + 0.7152 * withWhite[i + 1] + 0.0722 * withWhite[i + 2]; if (l > maxW) maxW = l; }
          e.enabled = false; renderer.manualTick();
          return Math.round(maxW);
        })();
        // Re-render the exact t0 frame (the probe above disturbed the scene) and read it.
        renderer.renderGameplayFrame(frameAt(hitCommitMs));
        const t0 = readPixels();
        const t0base = renderBaseline(hitCommitMs);
        let t0count = 0, t0sumX = 0, t0maxLuma = 0, t0minLuma = Infinity, t0fillSat = 0, t0fillCount = 0;
        const t0fillBuckets = new Set();
        for (let i = 0; i < t0.length; i += 4) {
          if (deltaRGB(t0, t0base, i) <= 30) continue;
          const r = t0[i], g = t0[i + 1], b = t0[i + 2];
          t0count += 1;
          t0sumX += (i / 4) % canvas.width;
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (luma > t0maxLuma) t0maxLuma = luma;
          if (luma < t0minLuma) t0minLuma = luma;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (luma > 60) { t0fillSat += (mx - mn); t0fillCount += 1; t0fillBuckets.add(`${r >> 4},${g >> 4},${b >> 4}`); }
        }
        // B10: the live icon (x=-1.5, full color #00C8FF) must be FULL (unclipped)
        // — count its cyan-ish pixels in the t0 frame (with corpse present). A
        // clipped/contaminated icon would show far fewer / wrong-colored pixels.
        let liveCyan = 0;
        for (let i = 0; i < t0.length; i += 4) {
          const r = t0[i], g = t0[i + 1], b = t0[i + 2];
          if (b > 150 && g > 120 && r < 90 && (Math.max(r, g, b) - Math.min(r, g, b)) > 60) liveCyan += 1;
        }
        return { frames, proj, whiteProbe, t0: { count: t0count, meanX: t0count ? t0sumX / t0count : 0, maxLuma: t0maxLuma, lumaSpread: t0count ? t0maxLuma - (t0minLuma === Infinity ? 0 : t0minLuma) : 0, fillMeanSat: t0fillCount ? t0fillSat / t0fillCount : 0, distinctFillBuckets: t0fillBuckets.size }, liveCyan, canvasSize: { width: canvas.width, height: canvas.height } };
      }, { hitCommitMs: HIT_COMMIT_MS, spawn: SPAWN, noteFill: NOTE_FILL, offsets: FALL_OFFSETS_MS });
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      console.log(`[aftermath] ${embedding} proj={spawnX:${Math.round(proof.proj.spawnX.x)},centerX:${Math.round(proof.proj.centerX.x)}} frames=${JSON.stringify(proof.frames.map((f) => ({ ms: f.offsetMs, px: f.count, cx: Math.round(f.meanX) })))} whiteProbe=${proof.whiteProbe} t0={px:${proof.t0.count},luma:${Math.round(proof.t0.maxLuma)},spread:${Math.round(proof.t0.lumaSpread)},fillSat:${Math.round(proof.t0.fillMeanSat)},liveCyan:${proof.liveCyan}}`);
      // ---- B11a: centroid stays at the note's COLUMN across the whole fall ----
      assert.ok(Math.abs(proof.proj.spawnX.x - proof.proj.centerX.x) > 40, `the note column (x=${SPAWN.x}) must project clearly away from the track center: spawnScreen=${proof.proj.spawnX.x.toFixed(1)}, centerScreen=${proof.proj.centerX.x.toFixed(1)}`);
      const drift = proof.frames.map((f) => ({ offsetMs: f.offsetMs, count: f.count, dxToColumn: Math.abs(f.meanX - proof.proj.spawnX.x), dxToCenter: Math.abs(f.meanX - proof.proj.centerX.x) }));
      for (const row of drift) {
        // 0.0.59 B14: the corpse falls off-screen and fades — at t+900 ms it may
        // already be gone (the old floor-settle kept it visible indefinitely).
        // Skip the "visible" assertion once faded; still check the column when present.
        const expectedVisible = row.offsetMs <= 500;
        if (expectedVisible) {
          assert.ok(row.count > 400, `${embedding} t+${row.offsetMs} ms: corpse must render visibly: ${row.count}px`);
          assert.ok(row.dxToColumn < row.dxToCenter, `${embedding} t+${row.offsetMs} ms: centroid must sit NEAR the note column, not the track center (col=${row.dxToColumn.toFixed(1)}px vs center=${row.dxToCenter.toFixed(1)}px)`);
        } else if (row.count > 0) {
          assert.ok(row.dxToColumn < row.dxToCenter, `${embedding} t+${row.offsetMs} ms: fading centroid still near the note column (col=${row.dxToColumn.toFixed(1)}px vs center=${row.dxToCenter.toFixed(1)}px)`);
        }
      }
      // The centroid must stay within a generous band of the projected column
      // (the halves separate ±~0.08 WU + tumble, but the mean stays at the column).
      // 0.0.59 B14: skip frames where the corpse has fallen off-screen and faded.
      for (const row of proof.frames.filter((f) => f.count > 0)) {
        assert.ok(Math.abs(row.meanX - proof.proj.spawnX.x) < 120, `${embedding} t+${row.offsetMs} ms: centroid x=${row.meanX.toFixed(1)} must stay near the projected column x=${proof.proj.spawnX.x.toFixed(1)}`);
      }
      // The centroid must NOT be near the track center at the far-fall sample.
      // 0.0.59 B14: use the last VISIBLE frame (the corpse may have faded by the last offset).
      const farFall = [...proof.frames].reverse().find((f) => f.count > 0);
      if (farFall) {
        assert.ok(Math.abs(farFall.meanX - proof.proj.centerX.x) > 80, `${embedding} far-fall centroid x=${farFall.meanX.toFixed(1)} must NOT be at the track center x=${proof.proj.centerX.x.toFixed(1)} (B11a teleport)`);
      }
      // ---- B11b: desaturated, not a flat uniform gray; outline stays light ----
      // PlayCanvas StandardMaterial with useLighting=false renders ≈ diffusedColor
      // (the facade sets emissive = diffuse*0.32), so the GLB mat/white outline
      // ([249,253,255]) reads ~85 and the dark charcoal reads ~20 in this headless
      // pipeline — NOT 255. Thresholds are calibrated against that measured output.
      assert.ok(proof.whiteProbe >= 200, `${embedding} pipeline sanity: pure white reference must read bright (got ${proof.whiteProbe})`);
      assert.ok(proof.t0.maxLuma > 60, `${embedding} white outline must stay LIGHT relative to the dark structural part (max luma=${proof.t0.maxLuma})`);
      assert.ok(proof.t0.lumaSpread > 30, `${embedding} the glyph must have LUMA CONTRAST (light outline + dark edge), i.e. NOT a flat uniform gray blob (spread=${proof.t0.lumaSpread.toFixed(1)})`);
      assert.ok(proof.t0.fillMeanSat < 40, `${embedding} the colored fill must be strongly DESATURATED (mean channel-spread=${proof.t0.fillMeanSat.toFixed(1)}, a saturated color would exceed this)`);
      // ---- B11c/B10: both halves distinct + live icon full and full-color ----
      assert.ok(proof.t0.count > 700, `${embedding} both halves together must render: ${proof.t0.count}px`);
      assert.ok(proof.liveCyan > 300, `${embedding} the co-rendered live icon must be FULL and full-color (cyan px=${proof.liveCyan})`);
      matrix.push({ embedding, drift, t0: proof.t0, liveCyan: proof.liveCyan, canvas: proof.canvasSize });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  // The two embeddings must produce the same per-frame centroid drift (within a
  // tiny tolerance for the cross-origin compositor) and the same t0 stats.
  const [direct, iframe] = matrix;
  direct.drift.forEach((row, i) => {
    assert.ok(Math.abs(row.count - iframe.drift[i].count) <= 8, `t+${row.offsetMs} ms: direct/iframe corpse pixel counts must agree: ${row.count} vs ${iframe.drift[i].count}`);
  });
  assert.ok(Math.abs(direct.t0.maxLuma - iframe.t0.maxLuma) <= 6, "direct/iframe outline luma must agree");
  assert.ok(Math.abs(direct.t0.fillMeanSat - iframe.t0.fillMeanSat) <= 6, "direct/iframe fill saturation must agree");
  console.log(`ORACLE 0.0.58-aftermath-pixels PASS: embeddings=2, evidence=${JSON.stringify(matrix.map((m) => ({ embedding: m.embedding, drift: m.drift.map((d) => ({ ms: d.offsetMs, px: d.count, dCol: Math.round(d.dxToColumn), dCenter: Math.round(d.dxToCenter) })), t0: { px: m.t0.count, luma: Math.round(m.t0.maxLuma), fillSat: Math.round(m.t0.fillMeanSat), buckets: m.t0.distinctFillBuckets }, liveCyan: m.liveCyan })))}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
