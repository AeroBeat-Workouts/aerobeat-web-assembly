// @ts-check
// Actual signed UI, real input/coordinator/judgements, existing deterministic
// camera/audio/content fixture. This is download proof, not physical play proof.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { loadSignedSnapshot, handlerForSnapshot } from "./serve-friend-game.js";

const directory = process.env.AEROBEAT_AB_SIGNED_DIR;
assert(directory, "AEROBEAT_AB_SIGNED_DIR must identify the signed build being tested");
const snapshot = loadSignedSnapshot(path.resolve(directory));
const fixturesDir = mkdtempSync(path.join(tmpdir(), "aerobeat-ab-download-"));
let server, browser;
try {
  await build({ configFile: "vite.config.js", logLevel: "error", build: { outDir: fixturesDir, emptyOutDir: true, lib: { entry: "scripts/fixtures/scored-play-browser-harness.js", formats: ["es"], fileName: () => "scored-play-browser-harness.js" } } });
  const fixtures = new Map(readdirSync(fixturesDir).filter(name => name.endsWith(".js")).map(name => ["/scripts/fixtures/" + name, readFileSync(path.join(fixturesDir, name))]));
  const handler = handlerForSnapshot(snapshot);
  server = createServer((req, res) => {
    const bytes = fixtures.get(new URL(req.url ?? "/", "http://fixture.invalid").pathname);
    if (bytes) { res.setHeader("content-type", "text/javascript"); res.end(bytes); }
    else handler(req, res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
  const game = page.locator("aero-game");
  const button = game.locator("[data-role='download-data']");
  assert(await button.isDisabled(), "no data must disable download");
  const expected = await game.evaluate(async element => {
    const { installScoredPlayHarness } = await import("/scripts/fixtures/scored-play-browser-harness.js");
    const event = { schema: "aerobeat/resolved_content_event", version: 3, eventId: "capture-note", centerTimestampMs: 3000, sourceEventIds: ["capture-source"], authoredBeat: { type: "note", hand: "left", placement: 5, requiresDirection: false } };
    const harness = await installScoredPlayHarness(element, { events: [event], mode: "flow", songDurationMs: 7000 });
    // Supply realistic content lineage at the existing content fixture boundary.
    // Gameplay and its immutable published snapshots remain the real services.
    const contentSnapshot = harness.graph.content.getSnapshot;
    harness.graph.content.getSnapshot = () => ({ ...contentSnapshot(), lineage: { difficulty: "Expert", sourceId: "capture-map", sourceVersionHash: "fixture-source" } });
    await harness.waitForAssets();
    await harness.selectChart();
    await harness.setSetup({ flowColliderVolume: { colliderScale: 1.5, colliderDepthForward: 1, colliderDepthBackward: 0 } });
    await harness.startPlay();
    await harness.calibrate();
    await harness.seekSong(5500);
    await harness.graph.audio.seek(7);
    await harness.graph.audio.pause(); // Audio device reports ended only when no longer playing.
    harness.feedPose();
    await element.audioSyncTail;
    const gameplay = harness.graph.gameplay.getSnapshot();
    if (gameplay.session.state !== "completed") throw Error(`Expected actual completed run, got ${gameplay.session.state}`);
    if (gameplay.judgements.length !== 1) throw Error("Expected one real committed judgement");
    element.setMenuOpen(true);
    element.renderPresenters();
    // Change the next-run control: export must retain the just-finished run.
    await harness.setSetup({ flowColliderVolume: { colliderScale: 2 } });
    return { judgements: gameplay.judgements.map(j => ({ eventId: j.eventId, result: j.result, diagnostics: j.diagnostics })), state: gameplay.session.state };
  });
  assert(await button.isEnabled(), "completed run with real judgement must enable download");
  const pending = page.waitForEvent("download", { timeout: 10000 });
  await button.click();
  const download = await pending;
  const capture = JSON.parse(readFileSync(await download.path(), "utf8"));
  assert.equal(capture.build.version, snapshot.manifest.sourceManifest.packageVersion);
  assert.equal(capture.build.buildStamp, snapshot.manifest.buildStamp);
  assert.equal(capture.song.difficulty, "Expert");
  assert.equal(capture.song.sourceId, "capture-map");
  assert.equal(capture.options.colliderScale, 1.5, "export uses completed-run settings, not next-run edits");
  assert.equal(capture.options.colliderDepthBackward, 0);
  assert.equal(capture.run.state, "completed");
  assert.equal(capture.summary.totalJudgements, 1);
  assert.deepEqual(capture.judgements.map(j => ({ eventId: j.eventId, result: j.result, diagnostics: j.diagnostics })), expected.judgements);
  assert(download.suggestedFilename().endsWith("-Expert.json"));
  assert.deepEqual(errors, []);
  console.log(`PASS actual signed ${capture.build.version} completed-run UI download: ${download.suggestedFilename()}; exact real judgement, source difficulty, run-locked depth/scale.`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(fixturesDir, { recursive: true, force: true });
}
