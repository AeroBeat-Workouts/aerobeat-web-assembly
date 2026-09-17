// @ts-check

// 0.0.59 B13 real-pixel oracle — the Flow "hit corpse" fill must be a DESATURATED
// TINT of the note's hand palette color (the SAME song-palette system boxing uses),
// proven by reading REAL rendered canvas pixels, NOT the scene-graph model.
//
// The 0.0.58 bug: the flow aftermath entry carried hand "neutral", so when the
// corpse had NO appearanceColor (the Test-mode case — the aftermath is built from
// renderEventIndex.orderedEntries, not the palette-carrying render events), the
// renderer resolved role "neutral" → receptorColor (#D9F5FF, near-white) and
// desaturating it read as flat gray. Boxing punches resolve their aftermath hand
// to left/right, so their corpses were correctly tinted (leftHandColor #2693FF /
// rightHandColor #39C96B). After the fix, the flow entry carries the NOTE'S HAND
// (authoredBeat.hand) and the renderer derives the flow/punch role from it, so the
// no-appearanceColor corpse desaturates to the hand's palette color family.
//
// What this oracle proves (against the production assembly surface: Vite + genuine
// cross-origin iframe + OffscreenCanvas drawImage/getImageData of the PlayCanvas
// canvas), one frame at commit + 40 ms (full alpha, both halves up, pre-fade):
//   (A) flow slice corpse WITHOUT appearanceColor (hand "left") — the t0 fill is a
//       muted BLUE-GRAY (blue channel > red channel, mid luma, low saturation),
//       clearly NOT the near-white receptorColor that used to read flat.
//   (B) flow slice corpse WITH appearanceColor "#2693FF" (same hand) — ALSO muted
//       blue (appearanceColor path takes precedence; already worked pre-fix).
//   (C) boxing punch corpse WITHOUT appearanceColor (hand "left", same spawn/seed)
//       — the SAME muted blue as (A), proving flow now matches boxing through the
//       same role-from-hand system.
//   (D) parity across embeddings: direct and genuine cross-origin iframe agree on
//       per-case fill stats within tight tolerances.
//
// Pre-fix this oracle FAILS on case (A): the fill reads near-white
// (R≈G≈B, b−r ≈ −14, luma ~147) instead of blue-tinted mid-luma.
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const SPAWN = { x: 0, y: 1, z: 0 };
const SAMPLE_OFFSET_MS = 40; // full alpha, both halves up, tumble negligible
const LEFT_FILL_TOKEN = "#2693FF"; // default leftHandColor (AeroBeat defaults)

// Pin the renderer to a SPECIFIC commit before loading (B13 verification protocol): without
// this, the live source tree of ../aerobeat-web-renderer wins over the git-pinned copy in
// node_modules, so "pre-fix" evidence would silently run against whatever HEAD is checked out.
const PIN_DIRNAME = process.env.AEROBEAT_PIN_DIRNAME; // optional absolute path override (some sandboxes mis-resolve script-relative URLs)
const pinRendererCommit = process.env.AEROBEAT_PIN_RENDERER ?? "";
if (pinRendererCommit) {
  const { spawnSync } = await import("node:child_process");
  const { dirname, resolve } = await import("node:path");
  const scriptsDir = PIN_DIRNAME ? PIN_DIRNAME : dirname(new URL(import.meta.url).pathname);
  const rendererRepo = new URL("../aerobeat-web-renderer/", `file://${scriptsDir}/`).pathname;
  if (!existsSync(rendererRepo)) throw new Error(`renderer pin target missing: ${rendererRepo}`);
  const checkout = spawnSync("/usr/bin/git", ["checkout", "-q", pinRendererCommit], { cwd: rendererRepo, encoding: "utf8" });
  if (checkout.status !== 0) throw new Error(`renderer pin checkout failed for ${rendererRepo}: ${checkout.stderr ?? checkout.stdout ?? `exit ${checkout.status}`}`);
  console.log(`[b13-corpse-color] pinned ${rendererRepo} → ${pinRendererCommit}`);
}
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
      const proof = await target.evaluate(async ({ spawn, sampleOffsetMs }) => {
        const game = document.querySelector("aero-game");
        const renderer = game.graph.renderer;
        // TEMP DIAGNOSTIC (removed before commit): prove which scene-model code is live in this page.
        const modelEntries = performance.getEntriesByType("resource").filter((r) => r.name.includes("gameplay-scene-model")).map((r) => r.name);
        let liveSrc = "unresolved";
        try {
          // The renderer is already loaded as a module in the page; import the same specifier the entry graph used.
          const smModule = await import("/node_modules/@aerobeat/web-renderer/src/gameplay-scene-model.js");
          const fnSrc = smModule.aftermathObjects.toString();
          liveSrc = fnSrc.includes('entry.hand==="left"') ? "HAS-FIX" : "NO-FIX";
        } catch (e) { liveSrc = `import-failed:${String(e).slice(0, 80)}`; }
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
        // One hand-crafted aftermath entry per case. Same spawn/seed across cases so
        // the ONLY variables are family/hand/appearanceColor. Shape orb (no arrow
        // edge asymmetry), mode single for punch, slice for flow (two clip-plane
        // halves — the Test-mode flow corpse shape).
        const makeEntry = (over) => Object.freeze({
          targetId: over.targetId,
          hitCommitMs: 6000,
          family: over.family,
          hand: over.hand,
          mode: over.mode,
          spawn: { x: spawn.x, y: spawn.y, z: spawn.z },
          seed: 1234,
          ...(over.appearanceColor ? { appearanceColor: over.appearanceColor } : {})
        });
        const flowNoAppearance = makeEntry({ targetId: "corpse-a", family: "flow", hand: "left", mode: "slice", shape: "orb" });
        const flowWithAppearance = makeEntry({ targetId: "corpse-b", family: "flow", hand: "left", mode: "slice", shape: "orb", appearanceColor: "#2693FF" });
        // Punch mode "straight": same one-piece trajectory as flow "single" (no slice); the
        // ONLY differences vs case A are family + the hand→role color path under test.
        const punchNoAppearance = makeEntry({ targetId: "corpse-c", family: "punch", hand: "left", mode: "straight", shape: "orb" });
        const cases = [
          ["flow_no_appearance", flowNoAppearance],
          ["flow_with_appearance", flowWithAppearance],
          ["punch_no_appearance", punchNoAppearance]
        ];
        const nowMs = 6000 + sampleOffsetMs;
        // Baseline: the same frame with NO aftermath → any diff is the corpse.
        const baseline = (() => {
          renderer.renderGameplayFrame({ presentation: "flow", nowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180 });
          return readPixels();
        })();
        const results = {};
        for (const [name, entry] of cases) {
          renderer.renderGameplayFrame({ presentation: "flow", nowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath: [entry] });
          const pixels = readPixels();
          let count = 0, sumX = 0, sumY = 0, maxLuma = 0, satSum = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (deltaRGB(pixels, baseline, i) <= 30) continue;
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            count += 1;
            sumX += (i / 4) % canvas.width;
            sumY += Math.floor(i / 4 / canvas.width);
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (luma > maxLuma) maxLuma = luma;
            satSum += (Math.max(r, g, b) - Math.min(r, g, b));
          }
          // FILL stats only: exclude the light structural outline (white parts) and
          // dark charcoal edges — keep the MID-LUMA glyph interior where the desaturated
          // fill lives. This is the pixel population whose color comes from
          // aftermathtCorpsePartColor's note_fill branch (roleColor fallback or the
          // note's real appearanceColor).
          let fillColorCount = 0, fillSumR = 0, fillSumG = 0, fillSumB = 0, fillMaxLuma = 0, fillSatSum = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (deltaRGB(pixels, baseline, i) <= 30) continue;
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (luma < 55 || luma > 160) continue;
            fillColorCount += 1;
            fillSumR += r; fillSumG += g; fillSumB += b;
            if (luma > fillMaxLuma) fillMaxLuma = luma;
            fillSatSum += (Math.max(r, g, b) - Math.min(r, g, b));
          }
          results[name] = {
            count, meanX: count ? sumX / count : 0, meanY: count ? sumY / count : 0, maxLuma,
            meanSat: count ? satSum / count : 0,
            fill: fillColorCount
              ? {
                  count: fillColorCount,
                  r: fillSumR / fillColorCount, g: fillSumG / fillColorCount, b: fillSumB / fillColorCount,
                  bMinusR: (fillSumB - fillSumR) / fillColorCount,
                  maxLuma: fillMaxLuma,
                  meanSat: fillSatSum / fillColorCount
                }
              : null
          };
        }
        // Restore a clean idle frame.
        renderer.renderGameplayFrame({ presentation: "flow", nowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180 });
        return { cases: results, canvasSize: { width: canvas.width, height: canvas.height }, diag: { modelEntries: modelEntries.slice(0, 2), liveSrc } };
      }, { spawn: SPAWN, sampleOffsetMs: SAMPLE_OFFSET_MS });
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      const logRow = (v) => ({ px: v.count, fill: v.fill ? { r: Number(v.fill.r.toFixed(1)), g: Number(v.fill.g.toFixed(1)), b: Number(v.fill.b.toFixed(1)), bMinusR: Number(v.fill.bMinusR.toFixed(1)), luma: Number(v.fill.maxLuma.toFixed(1)), sat: Number(v.fill.meanSat.toFixed(1)) } : null });
      console.log(`[b13-corpse-color] ${embedding} diag=${JSON.stringify(proof.diag)}`);
      console.log(`[b13-corpse-color] ${embedding} ${JSON.stringify(Object.fromEntries(Object.entries(proof.cases).map(([k, v]) => [k, logRow(v)])))}`);
      // Every case renders visibly before color assertions.
      for (const [name, value] of Object.entries(proof.cases)) {
        assert.ok(value.count > 200, `${embedding} ${name}: corpse must render visibly: ${value.count}px`);
        assert.ok(value.fill && value.fill.count > 40, `${embedding} ${name}: corpse fill pixels must be present: ${value.fill?.count ?? 0}`);
      }
      const a = proof.cases.flow_no_appearance.fill;
      const b = proof.cases.flow_with_appearance.fill;
      const c = proof.cases.punch_no_appearance.fill;
      // ---- (A) flow NO appearanceColor: muted blue-gray, NOT near-white receptor ----
      assert.ok(a.bMinusR > 12, `${embedding} flow-no-appearance fill must be BLUE-TINTED (muted leftHandColor #2693FF): b-r=${a.bMinusR.toFixed(1)} (near-white receptorColor gives b-r≈−14; pre-fix this fails)`);
      assert.ok(a.maxLuma > 55 && a.maxLuma < 160, `${embedding} flow-no-appearance fill must be MID LUMA (desaturated), not near-white/black: luma=${a.maxLuma.toFixed(1)}`);
      assert.ok(a.meanSat < 40, `${embedding} flow-no-appearance fill must be strongly DESATURATED (tint, not saturated): mean channel-spread=${a.meanSat.toFixed(1)}`);
      // ---- (B) flow WITH appearanceColor: also muted blue (path precedence unchanged) ----
      assert.ok(b.bMinusR > 12, `${embedding} flow-with-appearance fill must be BLUE-TINTED via the note fill token: b-r=${b.bMinusR.toFixed(1)}`);
      assert.ok(b.maxLuma > 55 && b.maxLuma < 160, `${embedding} flow-with-appearance fill must be MID LUMA: luma=${b.maxLuma.toFixed(1)}`);
      assert.ok(b.meanSat < 40, `${embedding} flow-with-appearance fill must be DESATURATED: spread=${b.meanSat.toFixed(1)}`);
      // The two flow paths land in the same muted-blue family (tight parity).
      assert.ok(Math.abs(a.bMinusR - b.bMinusR) <= 16, `${embedding} flow no/with appearance fills must match (same source color family): b-r ${a.bMinusR.toFixed(1)} vs ${b.bMinusR.toFixed(1)}`);
      // ---- (C) boxing punch corpse: THE SAME muted blue as the flow corpse ----
      assert.ok(c.bMinusR > 12, `${embedding} punch-no-appearance fill must be BLUE-TINTED (boxing was already correct): b-r=${c.bMinusR.toFixed(1)}`);
      assert.ok(c.maxLuma > 55 && c.maxLuma < 160, `${embedding} punch fill must be MID LUMA: luma=${c.maxLuma.toFixed(1)}`);
      assert.ok(c.meanSat < 40, `${embedding} punch fill must be DESATURATED: spread=${c.meanSat.toFixed(1)}`);
      assert.ok(Math.abs(a.bMinusR - c.bMinusR) <= 16, `${embedding} flow-vs-boxing PARITY: both corpses desaturate to the hand's palette color (flow b-r=${a.bMinusR.toFixed(1)}, punch b-r=${c.bMinusR.toFixed(1)})`);
      matrix.push({ embedding, cases: proof.cases });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  const [direct, iframe] = matrix;
  for (const name of Object.keys(direct.cases)) {
    const d = direct.cases[name].fill, f = iframe.cases[name].fill;
    assert.ok(Math.abs(d.bMinusR - f.bMinusR) <= 8, `${name}: direct/iframe fill b-r must agree: ${d.bMinusR.toFixed(1)} vs ${f.bMinusR.toFixed(1)}`);
    assert.ok(Math.abs(d.maxLuma - f.maxLuma) <= 10, `${name}: direct/iframe fill luma must agree: ${d.maxLuma.toFixed(1)} vs ${f.maxLuma.toFixed(1)}`);
  }
  console.log(`ORACLE 0.0.59-flow-corpse-color-pixels PASS: embeddings=2, evidence=${JSON.stringify(matrix.map((m) => ({ embedding: m.embedding, cases: Object.fromEntries(Object.entries(m.cases).map(([k, v]) => [k, { px: v.count, bMinusR: Number(v.fill.bMinusR.toFixed(1)), luma: Number(v.fill.maxLuma.toFixed(1)), sat: Number(v.fill.meanSat.toFixed(1)) }])) })))}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
