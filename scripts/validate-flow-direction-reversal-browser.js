// @ts-check
// Signed production Play scoring. Device/content fixtures drive calibrated raw
// landmarks; production input, equipment projection, coordinator and renderer stay real.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { loadSignedSnapshot, handlerForSnapshot } from "./serve-friend-game.js";

assert(process.env.AEROBEAT_DIRECTION_SIGNED_DIR, "AEROBEAT_DIRECTION_SIGNED_DIR must identify the actual signed game");
const snapshot = loadSignedSnapshot(path.resolve(process.env.AEROBEAT_DIRECTION_SIGNED_DIR));
const expectFixed = process.env.AEROBEAT_DIRECTION_EXPECT_FIXED !== "0";
if (process.env.AEROBEAT_EXPECT_GAMEPLAY_COMMIT) assert.equal(snapshot.manifest.sourceManifest.sources["@aerobeat/web-gameplay"].commit, process.env.AEROBEAT_EXPECT_GAMEPLAY_COMMIT);
const directory = mkdtempSync(path.join(tmpdir(), "aerobeat-direction-fixture-"));
let server, browser;
const results = [];
try {
  await build({ configFile: "vite.config.js", logLevel: "error", build: { outDir: directory, emptyOutDir: true, lib: { entry: "scripts/fixtures/scored-play-browser-harness.js", formats: ["es"], fileName: () => "scored-play-browser-harness.js" } } });
  const fixtures = new Map(readdirSync(directory).filter(n => n.endsWith(".js")).map(n => ["/scripts/fixtures/" + n, readFileSync(path.join(directory, n))]));
  const handler = handlerForSnapshot(snapshot);
  server = createServer((req, res) => {
    const bytes = fixtures.get(new URL(req.url ?? "/", "http://fixture.invalid").pathname);
    if (bytes) { res.setHeader("content-type", "text/javascript"); res.end(bytes); }
    else handler(req, res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true });
  for (const scenario of ["reversal", "reverse-only", "no-contact"]) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
    const result = await page.locator("aero-game").evaluate(async (element, scenario) => {
      const { installScoredPlayHarness } = await import("/scripts/fixtures/scored-play-browser-harness.js");
      const advances = [];
      const factory = element.serviceGraphFactory;
      element.serviceGraphFactory = options => {
        const graph = factory(options);
        return Object.freeze({ ...graph, gameplay: Object.freeze({ ...graph.gameplay, advance(...args) {
          const start = performance.now();
          try { return graph.gameplay.advance(...args); }
          finally { advances.push(performance.now() - start); }
        } }) });
      };
      const event = { schema: "aerobeat/resolved_content_event", version: 3, eventId: "up-after-down", centerTimestampMs: 6000, sourceEventIds: ["source-up"], authoredBeat: { type: "note", hand: "left", placement: 9, direction: "up", requiresDirection: true } };
      const harness = await installScoredPlayHarness(element, { events: [event], mode: "flow", songDurationMs: 10000 });
      await harness.waitForAssets(); await harness.selectChart();
      await harness.setSetup({ flowColliderVolume: { colliderScale: 1, colliderDepthForward: 1, colliderDepthBackward: 0 } });
      await harness.startPlay(); await harness.calibrate();
      const setup = element.activeSessionSetup;
      if (setup?.timingWindowMs !== 180 || setup.enforceAuthoredDirection !== true || setup.directionToleranceDegrees !== 45) throw Error("Original timing/direction defaults must remain active");
      const bounds = harness.graph.input.getSnapshot().calibration.bounds;
      if (!bounds) throw Error("Real calibration bounds missing");
      const raw = (sx, sy) => ({ x: bounds.left + ((sx + .5) / 4) * (bounds.right - bounds.left), y: bounds.top + ((2.5 - sy) / 3) * (bounds.bottom - bounds.top) });
      const points = [];
      for (let t = 5000; t < 5800; t += 50) points.push([t, 1.5]);
      const reversal = [[5800, 1], [5850, .65], [5900, .3], [5950, .05], [6000, -.25], [6050, .05], [6100, .3], [6150, .65], [6200, 1]];
      for (const [t, y] of reversal) points.push([t, scenario === "reverse-only" && t > 6000 ? -.25 : y]);
      for (let t = 6250; t <= 7100; t += 50) points.push([t, scenario === "reverse-only" ? -.25 : 1]);
      const ticks = [];
      for (const [t, y] of points) {
        const before = advances.length;
        const sx = scenario === "no-contact" ? 3.5 : 1;
        await harness.seekSong(t, { leftWrist: raw(sx, y), rightWrist: raw(3.5, 1) });
        if (advances.length !== before + 1 || element.lastError) throw Error("Expected one clean production advance");
        const left = element.currentEquipmentPoses.find(p => p.role === "left_wrist");
        if (!left || Math.abs(left.anchor.x - sx) > 1e-6 || Math.abs(left.anchor.y - y) > 1e-6) throw Error("Raw calibrated input did not reach intended judge-space anchor");
        ticks.push({ songMs: t, advanceElapsedMs: advances.at(-1), judgements: harness.graph.gameplay.getJudgements().length });
      }
      const judgements = harness.graph.gameplay.getJudgements();
      if (judgements.length !== 1) throw Error("Exactly one completed note judgement required");
      const output = { scenario, judgement: judgements[0], ticks, calibrationBounds: bounds };
      harness.dispose(); return output;
    }, scenario);
    assert.deepEqual(errors, []);
    assert.equal(result.judgement.result, scenario === "reversal" && expectFixed ? "hit" : "miss", `${scenario}: wrong signed scoring result`);
    if (result.judgement.result === "hit") {
      assert.equal(result.judgement.tier, "great");
      assert(result.judgement.timingOffsetMs >= -180 && result.judgement.timingOffsetMs <= 180, "reversal hit must use original base timing window");
    } else assert.equal(result.judgement.tier, "miss", "negative controls must not become near judgements");
    results.push(result);
    console.log(JSON.stringify({ scenario, result: result.judgement.result, tier: result.judgement.tier, committed: result.judgement.committedTimelinePositionMs, timingOffsetMs: result.judgement.timingOffsetMs, maxAdvanceElapsedMs: Math.max(...result.ticks.map(t => t.advanceElapsedMs)) }));
    await page.close();
  }
  if (process.env.AEROBEAT_DIRECTION_OUTPUT) writeFileSync(process.env.AEROBEAT_DIRECTION_OUTPUT, JSON.stringify({ scope: "Signed Play with calibrated raw fixture landmarks, genuine projection/scoring; not human movement or phone acceptance", buildStamp: snapshot.manifest.buildStamp, gameplay: snapshot.manifest.sourceManifest.sources["@aerobeat/web-gameplay"].commit, expectFixed, results }, null, 2));
  console.log(`PASS signed ${expectFixed ? "fixed" : "original"} Flow reversal/negative controls; unchanged geometry, time window, direction enforcement and exactly-once scoring.`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(directory, { recursive: true, force: true });
}
