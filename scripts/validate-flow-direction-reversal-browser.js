// @ts-check
// Signed production Play scoring. Device/content fixtures drive calibrated raw
// landmarks; production input, equipment projection, coordinator and renderer stay real.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { loadSignedSnapshot, handlerForSnapshot } from "./serve-friend-game.js";

assert(process.env.AEROBEAT_DIRECTION_SIGNED_DIR, "AEROBEAT_DIRECTION_SIGNED_DIR must identify the actual signed game");
const snapshot = loadSignedSnapshot(path.resolve(process.env.AEROBEAT_DIRECTION_SIGNED_DIR));
const expectFixed = process.env.AEROBEAT_DIRECTION_EXPECT_FIXED !== "0";
const noteCount = Number(process.env.AEROBEAT_DIRECTION_STRESS_NOTE_COUNT ?? 1);
assert(Number.isInteger(noteCount) && noteCount >= 1 && noteCount <= 12, "Contact stress uses 1–12 notes, never a machine-dependent pass threshold");
if (process.env.AEROBEAT_EXPECT_GAMEPLAY_COMMIT) assert.equal(snapshot.manifest.sourceManifest.sources["@aerobeat/web-gameplay"].commit, process.env.AEROBEAT_EXPECT_GAMEPLAY_COMMIT);
const directory = mkdtempSync(path.join(tmpdir(), "aerobeat-direction-fixture-"));
let server, browser;
const results = [];
const recordingDirectory = process.env.AEROBEAT_DIRECTION_RECORDING_DIR;
if (recordingDirectory) mkdirSync(recordingDirectory, { recursive: true });
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
  for (const scenario of noteCount === 1 ? ["reversal", "reverse-only", "no-contact", ...(process.env.AEROBEAT_DIRECTION_INCLUDE_LATE === "1" ? ["late-reversal"] : [])] : ["reverse-only"]) {
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1000, height: 700 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
    const result = await page.locator("aero-game").evaluate(async (element, { scenario, noteCount, captureRecording, measureRecording }) => {
      const { installScoredPlayHarness } = await import("/scripts/fixtures/scored-play-browser-harness.js");
      const advances = [], recordingCosts = [];
      const factory = element.serviceGraphFactory;
      element.serviceGraphFactory = options => {
        const graph = factory(options);
        return Object.freeze({ ...graph, gameplay: Object.freeze({ ...graph.gameplay, advance(...args) {
          const start = performance.now();
          try { return graph.gameplay.advance(...args); }
          finally { advances.push(performance.now() - start); }
        } }) });
      };
      const events = Array.from({ length: noteCount }, (_, i) => ({ schema: "aerobeat/resolved_content_event", version: 3, eventId: `up-after-down-${i}`, centerTimestampMs: 6000 + i * 100, sourceEventIds: [`source-up-${i}`], authoredBeat: { type: "note", hand: "left", placement: 9, direction: "up", requiresDirection: true } }));
      const harness = await installScoredPlayHarness(element, { events, mode: "flow", songDurationMs: 10000 });
      await harness.waitForAssets(); await harness.selectChart();
      await harness.setSetup({ flowColliderVolume: { colliderScale: 1, colliderDepthForward: 1, colliderDepthBackward: 0 } });
      await harness.startPlay(); await harness.calibrate();
      if (measureRecording) {
        const recorder = element.playMovementRecorder;
        if (!recorder) throw Error("Recording cost measurement requires the actual capture build");
        const timed = method => (...args) => { const start = performance.now(); try { return recorder[method](...args); } finally { recordingCosts.push(performance.now() - start); } };
        element.playMovementRecorder = Object.freeze({ ...recorder, observe: timed("observe"), record: timed("record") });
      }
      const setup = element.activeSessionSetup;
      if (setup?.timingWindowMs !== 180 || setup.enforceAuthoredDirection !== true || setup.directionToleranceDegrees !== 45) throw Error("Original timing/direction defaults must remain active");
      const bounds = harness.graph.input.getSnapshot().calibration.bounds;
      if (!bounds) throw Error("Real calibration bounds missing");
      // Calibration bounds use athlete space; camera-preview x is mirrored.
      const raw = (sx, sy) => ({ x: 1 - (bounds.left + ((sx + .5) / 4) * (bounds.right - bounds.left)), y: bounds.top + ((2.5 - sy) / 3) * (bounds.bottom - bounds.top) });
      const points = [], lateShift = scenario === "late-reversal" ? 500 : 0;
      for (let t = 5000; t < 5800 + lateShift; t += 50) points.push([t, 1.5]);
      const reversal = [[5800, 1], [5850, .65], [5900, .3], [5950, .05], [6000, -.25], [6050, .05], [6100, .3], [6150, .65], [6200, 1]];
      for (const [t, y] of reversal) points.push([t + lateShift, scenario === "reverse-only" && t > 6000 ? -.25 : y]);
      for (let t = 6250 + lateShift; t <= 7100 + lateShift + (noteCount - 1) * 100; t += 50) points.push([t, scenario === "reverse-only" ? -.25 : 1]);
      const ticks = [];
      for (const [t, y] of points) {
        const before = advances.length;
        const sx = scenario === "no-contact" ? 3.5 : 1;
        try { await harness.seekSong(t, { leftWrist: raw(sx, y), rightWrist: raw(3.5, 1) }); }
        catch (error) { throw Error(`${error.message}; ${JSON.stringify({ songMs: t, clock: harness.graph.audio.getClockSnapshot(), session: harness.graph.gameplay.getSnapshot().session, input: harness.graph.input.getSnapshot().latestEvidence?.provenance })}`); }
        if (advances.length !== before + 1 || element.lastError) throw Error("Expected one clean production advance");
        const left = element.currentEquipmentPoses.find(p => p.role === "left_wrist");
        if (!left || Math.abs(left.anchor.x - sx) > 1e-6 || Math.abs(left.anchor.y - y) > 1e-6) throw Error(`Raw calibrated input did not reach intended judge-space anchor: ${JSON.stringify({ songMs: t, expected: { x: sx, y }, actual: left?.anchor, bounds })}`);
        ticks.push({ songMs: t, advanceElapsedMs: advances.at(-1), judgements: harness.graph.gameplay.getJudgements().length });
      }
      const judgements = harness.graph.gameplay.getJudgements();
      if (judgements.length !== noteCount || new Set(judgements.map(j => j.eventId)).size !== noteCount) throw Error("Exactly one completed judgement per note required");
      const sortedCosts = [...recordingCosts].sort((a, b) => a - b);
      const recordingCost = sortedCosts.length ? { scope: "synchronous recorder observe+record method elapsed, not phone FPS or whole-frame CPU", calls: sortedCosts.length, meanMs: sortedCosts.reduce((a, b) => a + b, 0) / sortedCosts.length, perAdvanceMs: sortedCosts.reduce((a, b) => a + b, 0) / points.length, p95Ms: sortedCosts[Math.ceil(sortedCosts.length * .95) - 1], maxMs: sortedCosts.at(-1) } : null;
      if (measureRecording && !recordingCost) throw Error("Actual recorder methods were not observed");
      const output = { scenario, noteCount, judgement: judgements.find(j => j.eventId === "up-after-down-0"), judgements, ticks, calibrationBounds: bounds, recordingCost };
      if (captureRecording) {
        await harness.graph.audio.seek(10); await harness.graph.audio.pause();
        harness.feedPose(); await element.audioSyncTail;
        if (harness.graph.gameplay.getSnapshot().session.state !== "completed") throw Error("Recording fixture must finish through the actual audio-end path");
        element.setMenuOpen(true); element.renderPresenters();
      } else harness.dispose();
      return output;
    }, { scenario, noteCount, captureRecording: Boolean(recordingDirectory), measureRecording: process.env.AEROBEAT_DIRECTION_RECORDING_COST === "1" });
    assert.deepEqual(errors, []);
    assert.equal(result.judgement.result, ["reversal", "late-reversal"].includes(scenario) && expectFixed ? "hit" : "miss", `${scenario}: wrong signed scoring result`);
    if (result.judgement.result === "hit") {
      assert.equal(result.judgement.tier, "great");
      if (scenario === "late-reversal") assert(result.judgement.timingOffsetMs > 180 && result.judgement.timingOffsetMs <= 1000, "late fixture must exercise existing Play rules beyond ordinary Test's base window");
      else assert(result.judgement.timingOffsetMs >= -180 && result.judgement.timingOffsetMs <= 180, "reversal hit must use original base timing window");
    } else for (const judgement of result.judgements) assert.equal(judgement.tier, "miss", "negative controls must not become hits or near judgements");
    if (scenario === "no-contact") assert.deepEqual(result.judgement.diagnostics, ["wrong_collider"], "missing contact is not proven direction rejection");
    if (scenario === "reverse-only") assert.deepEqual(result.judgement.diagnostics, ["wrong_direction"], "actual rejected contact retains the direction reason");
    if (recordingDirectory) {
      const pending = page.waitForEvent("download");
      await page.locator("aero-game").locator("[data-role='download-data']").click();
      const download = await pending;
      const text = readFileSync(await download.path(), "utf8"), capture = JSON.parse(text);
      assert.equal(capture.movement?.complete, true, "the actual completed run must include its movement recording");
      assert.deepEqual(capture.judgements.map(j => ({ eventId: j.eventId, result: j.result, tier: j.tier, timingOffsetMs: j.timingOffsetMs })), result.judgements.map(j => ({ eventId: j.eventId, result: j.result, tier: j.tier, timingOffsetMs: j.timingOffsetMs })));
      writeFileSync(path.join(recordingDirectory, `${scenario}.json`), text);
      if (process.env.AEROBEAT_DIRECTION_TEST_REPLAY === "1") {
        const game = page.locator("aero-game");
        await game.evaluate(async element => { await element.startSession("visual_test", { requireDownloaded: true }); element.setMenuOpen(false, { freshSession: true }); element.renderPresenters(); });
        const chooser = page.waitForEvent("filechooser"); await game.locator("[data-role='recording-load']").click();
        await (await chooser).setFiles(await download.path());
        await page.waitForFunction(() => document.querySelector("aero-game")?.recordedTestPlayback?.getSnapshot().complete, null, { timeout: 15000 });
        const replay = await game.evaluate(async element => { await element.terminalServiceTail; return { gameplay: element.graph.gameplay.getSnapshot(), source: element.recordedTestPlayback.getSnapshot(), cv: element.graph.cv.getStatus(), lease: element.leaseSnapshotForGameplay().resources, error: element.lastError?.message ?? null }; });
        assert.equal(replay.error, null); assert.equal(replay.gameplay.session.purpose, "visual_test"); assert.equal(replay.gameplay.session.ranked, false);
        assert.equal(replay.gameplay.session.state, "completed");
        assert.equal(replay.cv.running, false); assert.deepEqual(replay.lease, [], "terminal replay must release its audio-only lease");
        assert.equal(replay.source.index, capture.movement.ticks.length); assert.equal(replay.source.observationIndex, capture.movement.observations.length);
        assert.equal(replay.gameplay.judgements.length, result.judgements.length);
        for (const expected of result.judgements) {
          const actual = replay.gameplay.judgements.find(j => j.eventId === expected.eventId);
          assert(actual, `${scenario}: native replay lost ${expected.eventId}`);
          for (const key of ["result", "tier", "beatCenterTimestampMs", "committedTimelinePositionMs"]) assert.equal(actual[key], expected[key], `${scenario}: replay ${key}`);
          assert.deepEqual(actual.diagnostics, expected.diagnostics);
          if (expected.timingOffsetMs === null) assert.equal(actual.timingOffsetMs, null);
          else assert(Math.abs(actual.timingOffsetMs - expected.timingOffsetMs) < 1e-6, `${scenario}: qualifying contact changed`);
        }
        assert.match(await game.locator("[data-role='recording-status']").textContent(), /Recorded input/);
        console.log(`PASS native ${scenario} Play download -> Test Load Recording: identical real judgement/contact, all ticks/observations, non-ranked audio-only scope.`);
      }
    }
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
