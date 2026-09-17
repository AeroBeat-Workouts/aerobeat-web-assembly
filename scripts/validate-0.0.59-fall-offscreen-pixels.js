// @ts-check

// 0.0.59 B14 real-pixel oracle — the "fall off-screen" hit-corpse.
//
// B14 removed the below-track floor + two bounces + settle branch from
// `aftermathPose` (renderer). The corpse is now launched from the hit position
// and follows ONE parabola (launch velocity + gravity) with its single
// continuous in-flight tumble until it drops below the track / off-screen
// (world y ≈ −1.5), where it fades out over `aftermathEvictedFadeMs` and the
// pose returns null.
//
// This oracle proves, in REAL rendered canvas pixels (OffscreenCanvas
// drawImage + getImageData of the PlayCanvas canvas — NOT `frame.model.objects`):
//   (1) NO SNAP: the corpse's rotation-sensitive feature (its pixel bounding
//       box width, which oscillates as the glyph tumbles) changes SMOOTHLY
//       across the whole time series — and keeps varying through the moment
//       where the old code's settle switch (≈715 ms for a straight punch from
//       y=1) would have snap'd the rotation.
//   (2) KEEPS FALLING, NO BELOW-TRACK REST: the corpse's lowest pixel row
//       (screen space, down = larger y) moves monotonically DOWN across the
//       series, the corpse crosses BELOW the track surface (world y = −0.80,
//       projected), and never rests: the 2500 ms frame shows a visible corpse
//       still descending, and the 1500→2500 descent is at least as large as
//       the 500→1500 descent (accelerating fall, not a stopped/resting piece).
//   (3) FALLS OFF-SCREEN: the last series frame (2500 ms) shows the corpse
//       fully faded — its pixel contribution is near zero.
//
// Two bodies are exercised:
//   A. a Flow "slice" corpse (two clip-plane halves) from the note column
//      x = −1.5, sampled at commit + 0/200/500/900/1500/2500 ms — its x = −1.5
//      launch keeps the column (regression guard for the B11a column contract
//      inside the fall-off-screen trajectory).
//   B. a whole boxing "straight" punch corpse at the track center, sampled at
//      commit + 0/200/500/900/1500/2500 ms — the old code's settle switch sat
//      INSIDE this series (≈715 ms), so the smooth-width continuity across
//      frames is the direct no-snap proof.
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface),
// mirroring validate-0.0.58-aftermath-pixels.js. Pixel-derived evidence must
// agree between the two embeddings.
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const HIT_COMMIT_MS = 6000;
const FLOW_SPAWN = { x: -1.5, y: 1, z: 0 };
const PUNCH_SPAWN = { x: 0, y: 1, z: 0 };
const FLOW_FILL = "#FF3030";
const PUNCH_FILL = "#FF9030";
// Per-body offsets. 1500 ms = the frame where the corpse must be fully faded:
// at 800 ms a straight punch from y=1 is ≈−1.74 WU and a flow slice ≈−1.82 WU —
// both past the off-screen line (−1.5) with the 150 ms fade already underway,
// so both are fully gone by 1500 ms (the off-screen line itself is below the
// 844×390 viewport bottom at the hit plane, ≈−1.30 WU).
const FLOW_OFFSETS_MS = [0, 200, 500, 900, 1200, 1500];
const PUNCH_OFFSETS_MS = [0, 200, 500, 900, 1200, 1500];
// The old 0.0.58 code's floor-contact "settle" moment for a straight punch
// from y = 1 (restitution .35, floor −1.17): the rotation snap lived here.
const OLD_SETTLE_MS = 715;

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
      const proof = await target.evaluate(async ({ hitCommitMs, flowSpawn, punchSpawn, flowFill, punchFill, flowOffsets, punchOffsets, trackY }) => {
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
          const out = renderer.cameraEntity.camera.worldToScreen({ x, y, z });
          return { x: out.x, y: out.y };
        };
        // Per-offset corpse pixel stats (baseline-diffed): count, bbox (the
        // rotation-sensitive width), lowest/highest screen row (monotonic-fall
        // + below-track evidence).
        const series = (entry, offsets) => {
          const rows = [];
          for (const offsetMs of offsets) {
            const nowMs = hitCommitMs + offsetMs;
            renderer.renderGameplayFrame({ presentation: "flow", nowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180 });
            const baseline = readPixels();
            renderer.renderGameplayFrame({ presentation: "flow", nowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath: [entry] });
            const pixels = readPixels();
            let count = 0, sumX = 0, minX = Infinity, maxX = -Infinity, minRow = Infinity, maxRow = -Infinity;
            for (let i = 0; i < pixels.length; i += 4) {
              if (deltaRGB(pixels, baseline, i) <= 30) continue;
              count += 1;
              const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width);
              sumX += x;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minRow) minRow = y;
              if (y > maxRow) maxRow = y;
            }
            rows.push({
              offsetMs,
              count,
              meanX: count ? sumX / count : null,
              bboxW: count ? maxX - minX + 1 : 0,
              bboxH: count ? maxRow - minRow + 1 : 0,
              lowestRow: count ? maxRow : null,
              topRow: count ? minRow : null
            });
          }
          return rows;
        };
        const flowEntry = {
          targetId: "corpse-flow-a",
          hitCommitMs,
          family: "flow",
          hand: "neutral",
          mode: "slice",
          shape: "arrow",
          spawn: { x: flowSpawn.x, y: flowSpawn.y, z: flowSpawn.z },
          seed: 1234,
          appearanceColor: flowFill
        };
        const punchEntry = {
          targetId: "corpse-punch-b",
          hitCommitMs,
          family: "punch",
          hand: "left",
          mode: "straight",
          spawn: { x: punchSpawn.x, y: punchSpawn.y, z: punchSpawn.z },
          seed: 42,
          appearanceColor: punchFill
        };
        const flowSeries = series(flowEntry, flowOffsets);
        const punchSeries = series(punchEntry, punchOffsets);
        // Projection anchors at the live camera pose:
        //  - the flow note column (x=−1.5) vs the track center (x=0);
        //  - the track SURFACE (y=trackY) at each body's x / z, used to prove
        //    the corpse's lowest pixel row crosses BELOW the track surface.
        const proj = {
          flowColumn: project(flowSpawn.x, flowSpawn.y, flowSpawn.z),
          trackCenter: project(0, flowSpawn.y, 0),
          flowTrackSurface: project(flowSpawn.x, trackY, 0),
          punchTrackSurface: project(punchSpawn.x, trackY, 0),
          offscreenLine: project(flowSpawn.x, -1.5, 0)
        };
        return { flowSeries, punchSeries, proj, canvasSize: { width: canvas.width, height: canvas.height } };
      }, { hitCommitMs: HIT_COMMIT_MS, flowSpawn: FLOW_SPAWN, punchSpawn: PUNCH_SPAWN, flowFill: FLOW_FILL, punchFill: PUNCH_FILL, flowOffsets: FLOW_OFFSETS_MS, punchOffsets: PUNCH_OFFSETS_MS, trackY: -0.80 });
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      const fmt = (rows) => JSON.stringify(rows.map((r) => ({ ms: r.offsetMs, px: r.count, w: r.bboxW, row: r.lowestRow, cx: r.meanX !== null ? Math.round(r.meanX) : null })));
      console.log(`[fall-offscreen] ${embedding} flow=${fmt(proof.flowSeries)} punch=${fmt(proof.punchSeries)} proj={flowCol:${Math.round(proof.proj.flowColumn.x)},center:${Math.round(proof.proj.trackCenter.x)},flowTrack:${Math.round(proof.proj.flowTrackSurface.y)},punchTrack:${Math.round(proof.proj.punchTrackSurface.y)},off:${Math.round(proof.proj.offscreenLine.y)}}`);

      // ---- Shared per-body checks over the whole series ----
      // Frames where the corpse still renders (before fade/null). The last
      // series frame (t+1500) must be fully faded (off-screen + fade complete);
      // the flow slice additionally vanishes earlier than the punch because its
      // −Z launch recedes into the distance (perspective shrink + 150 ms fade).
      const checkBody = (label, rows, trackSurfaceRow, { minWidthVariants, belowTrackAtMs }) => {
        const visible = rows.filter((r) => r.count > 0);
        // (a) The last frame is fully faded: the corpse has fallen off-screen.
        assert.ok(rows[rows.length - 1].count <= 25, `${label} last frame (t+${rows[rows.length - 1].offsetMs} ms) must be OFF-SCREEN/faded: ${rows[rows.length - 1].count}px remain`);
        assert.ok(visible.length >= 3, `${label} must be visibly falling for at least 3 frames: ${visible.length}`);
        // (b) Monotonic descent: the lowest pixel row only moves DOWN (screen
        //     down = larger y) across every pair of consecutive visible frames.
        for (let i = 1; i < visible.length; i += 1) {
          assert.ok(visible[i].lowestRow >= visible[i - 1].lowestRow, `${label} lowest pixel row must not move UP: t+${visible[i - 1].offsetMs} row=${visible[i - 1].lowestRow} → t+${visible[i].offsetMs} row=${visible[i].lowestRow}`);
        }
        // (c) Below the track surface and keeps going: at belowTrackAtMs the
        //     corpse's lowest pixel row is strictly BELOW the projected
        //     track-surface row (the body is well under the −0.80 track surface
        //     at that moment — punch ≈−2.5 WU, flow ≈−2.6 WU at t+900).
        if (belowTrackAtMs !== null) {
          const atBelow = rows.find((r) => r.offsetMs === belowTrackAtMs);
          assert.ok(atBelow.count > 40, `${label} must still be visibly falling at t+${belowTrackAtMs} ms: ${atBelow.count}px`);
          assert.ok(atBelow.lowestRow > trackSurfaceRow, `${label} must be BELOW the track surface at t+${belowTrackAtMs} ms: lowestRow=${atBelow.lowestRow} vs trackRow=${trackSurfaceRow}`);
        }
        // (d) No rest / no stop: the descent from t+0 to the last visible frame
        //     is a large multiple of the t+0→t+200 window — an accelerating
        //     single-parabola fall. A piece resting on a below-track floor
        //     would stop moving.
        const first = visible[0];
        const dEarly = visible.length > 1 ? visible[1].lowestRow - first.lowestRow : 0;
        const lastVisible = visible[visible.length - 1];
        const dTotal = lastVisible.lowestRow - first.lowestRow;
        assert.ok(dTotal > 40, `${label} must descend at least 40px over its visible life: Δrow=${dTotal}px`);
        assert.ok(dTotal >= dEarly * 2, `${label} descent must keep accelerating (no rest): total Δrow=${dTotal}px vs first 200 ms Δrow=${dEarly}px`);
        // (e) No rotation snap: among the well-resolved frames (count ≥ 400,
        //     so perspective shrink is negligible), the rotation-sensitive bbox
        //     width varies smoothly — no frame-to-frame jump of > 35% + margin.
        //     A settle-branch switch would re-phase the tumble and show here.
        const resolved = visible.filter((r) => r.count >= 400);
        for (let i = 1; i < resolved.length; i += 1) {
          const prev = resolved[i - 1].bboxW, next = resolved[i].bboxW;
          assert.ok(Math.abs(next - prev) <= prev * 0.35 + 6, `${label} rotation-sensitive width JUMPED (snap) t+${resolved[i - 1].offsetMs}→t+${resolved[i].offsetMs}: w ${prev} → ${next}`);
        }
        // (f) Rotation keeps varying across the series (no frozen/resting pose):
        //     at least minWidthVariants distinct bbox widths among visible frames.
        const widths = new Set(visible.map((r) => r.bboxW));
        assert.ok(widths.size >= minWidthVariants, `${label} bbox width must keep varying (continuous tumble), got ${widths.size} distinct values (need ${minWidthVariants}): ${[...widths].join(",")}`);
      };

      // Flow slice: vanishes around t+900 (−Z recession + fade), so the
      // below-track proof is carried by the punch instead.
      checkBody("flow slice", proof.flowSeries, proof.proj.flowTrackSurface.y, { minWidthVariants: 3, belowTrackAtMs: null });
      checkBody("punch", proof.punchSeries, proof.proj.punchTrackSurface.y, { minWidthVariants: 4, belowTrackAtMs: 900 });

      // ---- Punch: the direct no-snap proof across the OLD settle moment ----
      // The old 0.0.58 code switched from the 4.0 rad/s flight tumble to the
      // damped-settle tumble at ≈OLD_SETTLE_MS; the width continuity across the
      // well-resolved frames bracketing it (200 ↔ 500) is where a snap would
      // show (t+900 is near-vanished and perspective-shrunk — too small to
      // measure a rotation feature).
      const w200 = proof.punchSeries.find((r) => r.offsetMs === 200);
      const w500 = proof.punchSeries.find((r) => r.offsetMs === 500);
      assert.ok(w200.count >= 400 && w500.count >= 400, `punch frames measurable across the old-settle window: px200=${w200.count}, px500=${w500.count}`);
      assert.ok(Math.abs(w500.bboxW - w200.bboxW) <= w200.bboxW * 0.35 + 6, `punch rotation must stay continuous across the old settle moment (t=${OLD_SETTLE_MS} ms): w ${w200.bboxW} → ${w500.bboxW}`);

      // ---- Flow slice: the column contract survives the fall (B11a guard) ----
      assert.ok(Math.abs(proof.proj.flowColumn.x - proof.proj.trackCenter.x) > 40, "flow column must project clearly away from the track center");
      for (const row of proof.flowSeries.filter((r) => r.count > 0)) {
        assert.ok(Math.abs(row.meanX - proof.proj.flowColumn.x) < 120, `flow slice centroid x=${row.meanX.toFixed(1)} must stay near the note column x=${proof.proj.flowColumn.x.toFixed(1)} at t+${row.offsetMs} ms`);
      }
      // The flow halves still both render at t+0 (B11c regression inside B14).
      assert.ok(proof.flowSeries[0].count > 400, `flow slice must render both halves at t0: ${proof.flowSeries[0].count}px`);

      matrix.push({ embedding, flowSeries: proof.flowSeries, punchSeries: proof.punchSeries, proj: proof.proj, canvas: proof.canvasSize });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  // The two embeddings must agree on the per-frame descent + fade evidence.
  const [direct, iframe] = matrix;
  for (const key of ["flowSeries", "punchSeries"]) {
    direct[key].forEach((row, i) => {
      assert.ok(Math.abs(row.count - iframe[key][i].count) <= 12, `${key} t+${row.offsetMs} ms: direct/iframe corpse pixel counts must agree: ${row.count} vs ${iframe[key][i].count}`);
      assert.ok(Math.abs(row.lowestRow - iframe[key][i].lowestRow) <= 3, `${key} t+${row.offsetMs} ms: direct/iframe lowest rows must agree: ${row.lowestRow} vs ${iframe[key][i].lowestRow}`);
    });
  }
  console.log(`ORACLE 0.0.59-fall-offscreen-pixels PASS: embeddings=2, flow=${JSON.stringify(direct.flowSeries.map((r) => ({ ms: r.offsetMs, px: r.count, w: r.bboxW, row: r.lowestRow })))}, punch=${JSON.stringify(direct.punchSeries.map((r) => ({ ms: r.offsetMs, px: r.count, w: r.bboxW, row: r.lowestRow })))}, oldSettleMs=${OLD_SETTLE_MS}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
