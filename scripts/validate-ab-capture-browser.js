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
import { recordedEquipmentPair } from "../src/play-movement-recording.js";

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
    let recordedAdvances = 0;
    const factory = element.serviceGraphFactory;
    element.serviceGraphFactory = options => {
      const graph = factory(options);
      return Object.freeze({ ...graph, gameplay: Object.freeze({ ...graph.gameplay, advance(...args) {
        const recording = element.playMovementRecorder?.getStatus().status === "recording";
        const result = graph.gameplay.advance(...args);
        if (recording) recordedAdvances++;
        return result;
      } }) });
    };
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
    const legs = { left: { hip: { x: .43, y: .68 }, knee: { x: .4, y: .8 }, ankle: { x: .43, y: .97 } }, right: { hip: { x: .57, y: .68 }, knee: { x: .6, y: .8 }, ankle: { x: .57, y: .97 } } };
    await harness.seekSong(5500, { legs });
    const model = harness.graph.input.getCalibrationModel();
    const equipment = JSON.parse(JSON.stringify(element.currentEquipmentPoses));
    const surface = harness.graph.video.describeSurface(element.videoElement());
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
    return { judgements: gameplay.judgements.map(j => ({ eventId: j.eventId, result: j.result, diagnostics: j.diagnostics })), state: gameplay.session.state, model, equipment, surface, recordedAdvances };
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
  assert.equal(capture.version, 2);
  const movement = capture.movement;
  assert.equal(movement?.schema, "aerobeat/play_movement_recording");
  assert.equal(movement.complete, true, `capture must finish honestly: ${JSON.stringify(movement && { status: movement.status, reason: movement.reason })}`);
  assert(movement.rawPoses.length >= 2 && movement.ticks.length >= 2, "actual input and scoring frames must be present");
  assert.equal(movement.ticks.length, expected.recordedAdvances, "recording must observe each actual advance exactly once");
  assert.equal(new Set(movement.rawPoses.map(frame => `${frame.sourceId}:${frame.timestampMs}`)).size, movement.rawPoses.length, "held source frames must not become new measurements");
  const fullBodyIndex = movement.rawPoses.findIndex(frame => ["nose", "left_wrist", "right_wrist", "left_elbow", "right_elbow", "left_shoulder", "right_shoulder", "left_knee", "right_knee", "left_hip", "right_hip", "left_ankle", "right_ankle"].every(name => frame.landmarks.some(p => p.name === name)));
  assert(fullBodyIndex >= 0, "all available named markers, including legs, survive export");
  const observation = movement.observations.find(row => row[2] === fullBodyIndex);
  assert(observation, "raw movement must remain tied to the actual accepted input/model");
  const input = movement.inputs[observation[1]], model = movement.models[observation[3]];
  assert.deepEqual(model.bounds, expected.model.bounds);
  assert.deepEqual(model.normalizedNoseBaseline, expected.model.normalizedNoseBaseline);
  assert.equal(model.calibratedShoulderWorldY, expected.model.calibratedShoulderWorldY);
  assert.equal(model.sourceAspectRatio, expected.model.sourceAspectRatio);
  for (const anchor of input.anchors.filter(a => a.valid)) {
    const point = movement.rawPoses[fullBodyIndex].landmarks.find(p => p.name === anchor.anchor);
    assert(point);
    assert(Math.abs(anchor.x - ((1 - point.x - model.bounds.left) / (model.bounds.right - model.bounds.left))) < 1e-12);
    assert(Math.abs(anchor.y - ((point.y - model.bounds.top) / (model.bounds.bottom - model.bounds.top))) < 1e-12);
  }
  const tick = movement.ticks.find(row => row[2] === 5.5);
  assert(tick && tick[5] >= 0, "the real scoring boundary's equipment must be recorded");
  assert.deepEqual(recordedEquipmentPair(movement, tick[5]), expected.equipment);
  assert.equal(expected.surface.intrinsicWidth, 640); assert.equal(expected.surface.intrinsicHeight, 480);
  assert(movement.configurations.some(c => c.camera?.intrinsicWidth === 640 && c.camera?.intrinsicHeight === 480 && c.camera?.mirrored === true && c.camera?.fitMode === "contain"));
  assert(movement.configurations.every(c => c.setup.flowColliderVolume.colliderScale === 1.5), "next-run edits cannot rewrite recorded configuration");
  assert(download.suggestedFilename().endsWith("-Expert.json"));
  assert.deepEqual(errors, []);
  console.log(`PASS actual signed ${capture.build.version} completed-run UI download: ${download.suggestedFilename()}; exact real judgement, source difficulty, run-locked depth/scale.`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(fixturesDir, { recursive: true, force: true });
}
