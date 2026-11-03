// @ts-check
// Diagnostic, not a machine-dependent performance gate. Same signed build,
// cache OFF/ON/ON/OFF, deterministic device fixtures and real gameplay advance.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { loadSignedSnapshot, handlerForSnapshot } from "./serve-friend-game.js";

assert(process.env.AEROBEAT_SPLINE_SIGNED_DIR, "set AEROBEAT_SPLINE_SIGNED_DIR to the candidate snapshot");
const snapshot = loadSignedSnapshot(path.resolve(process.env.AEROBEAT_SPLINE_SIGNED_DIR));
const temporary = mkdtempSync(path.join(tmpdir(), "aerobeat-projection-cost-"));
let server, browser;
const runs = [];
try {
  await build({ configFile: "vite.config.js", logLevel: "error", build: { outDir: temporary, emptyOutDir: true, lib: { entry: "scripts/fixtures/scored-play-browser-harness.js", formats: ["es"], fileName: () => "scored-play-browser-harness.js" } } });
  const fixtures = new Map(readdirSync(temporary).filter(n => n.endsWith(".js")).map(n => ["/scripts/fixtures/" + n, readFileSync(path.join(temporary, n))]));
  const handler = handlerForSnapshot(snapshot);
  server = createServer((req, res) => {
    const bytes = fixtures.get(new URL(req.url ?? "/", "http://fixture.invalid").pathname);
    if (bytes) { res.setHeader("content-type", "text/javascript"); res.end(bytes); }
    else handler(req, res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true });
  for (const cache of [false, true, true, false]) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
    const result = await page.locator("aero-game").evaluate(async (element, cache) => {
      const { installScoredPlayHarness } = await import("/scripts/fixtures/scored-play-browser-harness.js");
      const durations = [];
      const factory = element.serviceGraphFactory;
      element.serviceGraphFactory = options => {
        const graph = factory(options);
        return Object.freeze({ ...graph, gameplay: Object.freeze({ ...graph.gameplay,
          advance(...args) {
            const start = performance.now();
            try { return graph.gameplay.advance(...args); }
            finally { durations.push(performance.now() - start); }
          }
        }) });
      };
      const events = Array.from({ length: 12 }, (_, i) => ({ schema: "aerobeat/resolved_content_event", version: 3, eventId: `cpu-note-${i}`, centerTimestampMs: 6000 + i * 100, sourceEventIds: [`source-${i}`], authoredBeat: { type: "note", hand: i % 2 ? "right" : "left", placement: 0, direction: "right", requiresDirection: true } }));
      const harness = await installScoredPlayHarness(element, { events, mode: "flow", songDurationMs: 12000 });
      await harness.waitForAssets(); await harness.selectChart();
      let scoped = null;
      Object.defineProperty(element, "scoringFrameEquipmentProjector", { configurable: true,
        get: () => cache ? scoped : null, set: value => { scoped = value; } });
      await harness.setSetup({ flowColliderVolume: { colliderScale: 1, colliderDepthForward: 1, colliderDepthBackward: 0 } });
      await harness.startPlay(); await harness.calibrate();
      const frames = [];
      for (let i = 0; i < 55; i++) {
        await harness.graph.audio.seek((5000 + i * 66) / 1000);
        const before = durations.length, start = performance.now();
        harness.feedPose({ leftWrist: { x: .88 + .03 * Math.sin(i * .2), y: .92 }, rightWrist: { x: .94, y: .92 } });
        const frameElapsedMs = performance.now() - start;
        if (durations.length !== before + 1 || scoped !== null) throw Error("one genuine advance with no retained projection cache required");
        if (element.lastError) throw Error(element.lastError.message);
        frames.push({ index: i, songMs: 5000 + i * 66, advanceElapsedMs: durations.at(-1), frameElapsedMs });
      }
      const judgements = harness.graph.gameplay.getSnapshot().judgements.map(j => ({ ...j, evidenceTimestampMs: null }));
      harness.dispose(); return { cache, frames, judgements };
    }, cache);
    assert.deepEqual(errors, []);
    assert.equal(result.judgements.length, 12);
    if (runs.length) assert.deepEqual(result.judgements, runs[0].judgements, "every scoring field must match; only independent device wall timestamp is excluded");
    runs.push(result);
    console.log(JSON.stringify({ cache, meanAdvanceElapsedMs: result.frames.reduce((sum, f) => sum + f.advanceElapsedMs, 0) / result.frames.length }));
    await page.close();
  }
  const stats = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return { mean: values.reduce((a, b) => a + b, 0) / values.length, p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) };
  };
  const summary = [false, true].map(cache => {
    const frames = runs.filter(run => run.cache === cache).flatMap(run => run.frames);
    return { cache, advanceElapsedMs: stats(frames.map(f => f.advanceElapsedMs)), frameElapsedMs: stats(frames.map(f => f.frameElapsedMs)) };
  });
  const report = { scope: "Signed runtime, deterministic camera/audio/content fixtures, elapsed timings; not phone cadence or causal hit-rate proof", buildStamp: snapshot.manifest.buildStamp, order: runs.map(run => run.cache), summary, runs };
  if (process.env.AEROBEAT_SPLINE_COST_OUTPUT) writeFileSync(process.env.AEROBEAT_SPLINE_COST_OUTPUT, JSON.stringify(report, null, 2));
  console.log("SUMMARY " + JSON.stringify(summary));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
