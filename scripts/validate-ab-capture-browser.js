// @ts-check
// Actual signed UI, real input/coordinator/judgements, existing deterministic
// camera/audio/content fixture. This is download proof, not physical play proof.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { loadSignedSnapshot, handlerForSnapshot } from "./serve-friend-game.js";
import { recordedEquipmentPair } from "../src/play-movement-recording.js";
import { inspectShortMovementDownload } from "./inspect-short-movement-download.js";

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
        if (graph.gameplay.getSnapshot().session.purpose === "visual_test" && args[0]?.input) element.__recordedTestLastInput = args[0].input;
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
    // Initial waiting must not allocate a recording or spend the song budget.
    // These are actual measured input publications through the connected graph.
    for (let index = 0; index < 256; index++) harness.feedPose({ tPose: false, render: false });
    harness.feedPose({ tPose: false });
    if (harness.graph.gameplay.getSnapshot().session.state !== "calibrating") throw Error("Expected initial calibration wait");
    if (element.playMovementRecorder !== null) throw Error("Initial calibration waiting must not allocate a recorder");
    await harness.calibrate();
    const liveNose = element.shadowRoot.querySelector("[data-game-setup-field='noseMarkerVisible']");
    if (!(liveNose instanceof HTMLInputElement) || liveNose.disabled || !liveNose.checked) throw Error("Expected live nose visibility control");
    liveNose.click(); await element.lifecycleIntentTail;
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
    // Completed gameplay is synchronous; persisted recording completion is not.
    if (!element.playMovementRecorder) throw Error("Expected real movement recorder");
    await element.playMovementRecorder.flush();
    if (element.playMovementRecorder.getStatus().status !== "completed") {
      const invalid = (value, path = "") => value === undefined || typeof value === "number" && !Number.isFinite(value) ? [path] : value && typeof value === "object" ? Object.entries(value).flatMap(([key, item]) => invalid(item, `${path}.${key}`)) : [];
      throw Error(`Recording did not persist completely: ${JSON.stringify({ status: element.playMovementRecorder.getStatus(), modelInvalid: invalid(harness.graph.input.getCalibrationModel()), configurationInvalid: invalid(element.activeGameplayConfiguration), inputInvalid: invalid(harness.graph.input.getSnapshot()), cameraInvalid: invalid(surface), counts: element.playMovementRecorder.snapshot().counts })}`);
    }
    element.setMenuOpen(true);
    element.renderPresenters();
    // Change the next-run control: export must retain the just-finished run.
    await harness.setSetup({ flowColliderVolume: { colliderScale: 2 }, noseMarkerVisible: true });
    return { judgements: gameplay.judgements.map(j => ({ eventId: j.eventId, result: j.result, diagnostics: j.diagnostics })), state: gameplay.session.state, model, equipment, surface, recordedAdvances };
  });
  assert(await button.isEnabled(), "completed run with real judgement must enable download");
  const pending = page.waitForEvent("download", { timeout: 10000 });
  await button.click();
  const download = await pending;
  const downloadPath = await download.path();
  const capture = inspectShortMovementDownload(downloadPath);
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
  assert(download.suggestedFilename().endsWith("-Expert.jsonl.gz"));
  assert.deepEqual(errors, []);
  if (process.env.AEROBEAT_AB_TEST_REPLAY === "1") {
    await game.evaluate(async element => {
      await element.startSession("visual_test", { requireDownloaded: true });
      element.stopFrameLoop(); element.setMenuOpen(false, { freshSession: true }); element.renderPresenters();
      element.__recordingFileEvents = [];
      element.shadowRoot.querySelector("[data-role='recording-file']").addEventListener("change", event => {
        const request = element.recordedTestPickerRequest;
        element.__recordingFileEvents.push({ trusted: event.isTrusted, file: event.target.files?.[0]?.name, session: element.sessionGeneration, requestSession: request?.session, menuStarting: element.menuStarting, pending: element.pendingSessionAction, canLoad: element.recordedTestCanLoad(), state: element.graph.gameplay.getSnapshot().session.state });
      }, true);
      element.__recordingEquipmentBefore = element.equipmentConfig;
      element.__recordingPrefsBefore = localStorage.getItem("aerobeat.game-setup.v3");
      if (!element.__recordingPrefsBefore) throw Error("Expected real persisted Play preferences before replay");
    });
    const load = game.locator("[data-role='recording-load']");
    assert(await load.isVisible() && await load.isEnabled(), "Test must expose the approved Load Recording control");
    const chooser = page.waitForEvent("filechooser"); await load.click();
    await (await chooser).setFiles(await download.path());
    await page.waitForFunction(() => document.querySelector("aero-game")?.recordedTestPlayback, null, { timeout: 10000 });
    await game.evaluate(async element => { await element.pause(); element.enqueueVisualTestSeek(5500); await element.transportIntentTail; });
    await page.waitForFunction(() => {
      const source = document.querySelector("aero-game")?.recordedTestPlayback?.getSnapshot();
      return source && !source.rebuilding && source.frame?.clock.positionSeconds === 5.5;
    }, null, { timeout: 10000 });
    const paused = await game.evaluate(element => {
      const graph = element.graph, source = element.recordedTestPlayback.getSnapshot(), gameplay = graph.gameplay.getSnapshot();
      const scene = graph.renderer.describe();
      const canvas = element.shadowRoot.querySelector("canvas[data-role='renderer']");
      graph.renderer.manualTick();
      const copy = new OffscreenCanvas(canvas.width, canvas.height), context = copy.getContext("2d");
      context.drawImage(canvas, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonblack = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] || pixels[i + 1] || pixels[i + 2]) nonblack++;
      return { purpose: gameplay.session.purpose, ranked: gameplay.session.ranked, calibrationId: gameplay.session.calibrationId, partitions: gameplay.scorePartitions, judgements: gameplay.judgements, source, equipment: JSON.parse(JSON.stringify(element.currentEquipmentPoses)), anchors: element.__recordedTestLastInput?.latestEvidence?.anchors ?? [], scene, nonblack, cvRunning: graph.cv.getStatus().running, lease: element.leaseSnapshotForGameplay().resources, preferencesUnchanged: element.__recordingPrefsBefore === localStorage.getItem("aerobeat.game-setup.v3"), equipmentUnchanged: element.equipmentConfig === element.__recordingEquipmentBefore, lastError: element.lastError?.message ?? null };
    });
    assert.equal(paused.purpose, "visual_test"); assert.equal(paused.ranked, false); assert.equal(paused.calibrationId, null);
    assert.equal(paused.cvRunning, false); assert.deepEqual(paused.lease, ["audio"]);
    assert.equal(paused.preferencesUnchanged, true); assert.equal(paused.equipmentUnchanged, true); assert.equal(paused.lastError, null);
    assert.equal(paused.source.total, movement.counts.ticks); assert.equal(paused.source.observations, movement.counts.observations);
    assert.equal(paused.source.playing, false); assert.equal(paused.source.index, tick === movement.ticks.at(-1) ? movement.ticks.length : movement.ticks.indexOf(tick) + 1);
    assert.deepEqual(paused.equipment, expected.equipment);
    assert.deepEqual(paused.judgements.map(j => ({ eventId: j.eventId, result: j.result, diagnostics: j.diagnostics })), expected.judgements);
    assert(paused.partitions.every(p => p.ranked === false && p.localOnly === true));
    assert.equal(paused.scene.state, "running"); assert.equal(paused.scene.equipment.instanceCount, 2); assert(paused.nonblack > 0);
    assert.equal(paused.scene.cursors.instanceCount, 0, "replay must retain recorded live nose visibility, not the current Play preference");

    const capturedSetup = movement.configurations[tick[8]];
    assert.equal(capturedSetup.setup.noseMarkerVisible, true); assert.equal(capturedSetup.presentationSetup.noseMarkerVisible, false);
    const originalInput = movement.inputs[tick[4]];
    for (const anchor of originalInput.anchors.filter(a => a.valid)) {
      const actual = paused.anchors.find(a => a.anchor === anchor.anchor);
      assert(actual && actual.x === anchor.x && actual.y === anchor.y, `recorded ${anchor.anchor} must reach the actual Test coordinator`);
      assert.notEqual(actual.calibrationId, anchor.calibrationId, "original live calibration identity must not be restored");
    }
    assert.match(await game.locator("[data-role='recording-status']").textContent(), /Recorded input/);
    assert.equal(await load.textContent(), "Clear Recording");
    assert(await game.locator("[data-test-webcam-fps]").isDisabled(), "pointer cadence must not replace recorded cadence");
    await page.setViewportSize({ width: 375, height: 812 }); await load.scrollIntoViewIfNeeded();
    const rect = await load.boundingBox(); assert(rect && rect.width > 0 && rect.x >= 0 && rect.x + rect.width <= 375, "recording control must fit the portrait viewport");
    await game.evaluate(async element => { await element.resume(); });
    await page.waitForFunction(() => document.querySelector("aero-game")?.recordedTestPlayback?.getSnapshot().complete, null, { timeout: 10000 });
    const completed = await game.evaluate(element => ({ purpose: element.graph.gameplay.getSnapshot().session.purpose, state: element.graph.gameplay.getSnapshot().session.state, judgements: element.graph.gameplay.getJudgements(), source: element.recordedTestPlayback.getSnapshot() }));
    assert.equal(completed.state, "completed"); assert.equal(completed.purpose, "visual_test"); assert.equal(completed.source.index, movement.ticks.length);
    assert.deepEqual(completed.judgements.map(j => ({ eventId: j.eventId, result: j.result, diagnostics: j.diagnostics })), expected.judgements);
    await game.evaluate(async element => { await element.terminalServiceTail; await element.resume(); });
    await page.waitForFunction(() => {
      const source = document.querySelector("aero-game")?.recordedTestPlayback?.getSnapshot();
      return source?.playing && !source.complete;
    }, null, { timeout: 10000 });
    await game.evaluate(async element => { await element.pause(); });
    const restarted = await game.evaluate(element => ({ source: element.recordedTestPlayback.getSnapshot(), judgements: element.graph.gameplay.getJudgements() }));
    assert(restarted.source.index < movement.ticks.length, "restart must rewind the source rather than fall through to pointer Test");
    assert.equal(restarted.judgements.length, 0, "restart must clear the prior run's result");
    await game.evaluate(async element => { await element.resume(); });
    await page.waitForFunction(() => document.querySelector("aero-game")?.recordedTestPlayback?.getSnapshot().complete, null, { timeout: 10000 });
    const secondEnd = await game.evaluate(async element => { await element.terminalServiceTail; return { lease: element.leaseSnapshotForGameplay().resources, judgements: element.graph.gameplay.getJudgements(), error: element.lastError?.message ?? null }; });
    assert.equal(secondEnd.error, null); assert.deepEqual(secondEnd.lease, [], "restarted replay must also release its terminal audio lease");
    assert.deepEqual(secondEnd.judgements.map(j => ({ eventId: j.eventId, result: j.result, diagnostics: j.diagnostics })), expected.judgements);
    await load.click();
    await page.waitForFunction(() => !document.querySelector("aero-game")?.recordedTestPrepared);
    const invalid = page.waitForEvent("filechooser"); await load.click();
    // An in-memory Playwright upload dispatches an untrusted change event.
    // Use a real local file through the native chooser, as the positive case does.
    const legacyPath = path.join(fixturesDir, "old-judgements-only.json");
    writeFileSync(legacyPath, JSON.stringify({ ...capture, version: 1, movement: undefined }));
    await (await invalid).setFiles(legacyPath);
    try { await page.waitForFunction(() => /judgement-only/.test(document.querySelector("aero-game")?.shadowRoot.querySelector("[data-role='recording-status']")?.textContent ?? ""), null, { timeout: 5000 }); }
    catch (error) {
      const detail = await game.evaluate(element => ({ events: element.__recordingFileEvents, status: element.recordedTestStatus, caption: element.shadowRoot.querySelector("[data-role='recording-status']")?.textContent, outputValue: element.shadowRoot.querySelector("[data-role='recording-status']")?.value, session: element.sessionGeneration, pending: element.pendingSessionAction, menuStarting: element.menuStarting, prepared: Boolean(element.recordedTestPrepared), lastError: element.lastError?.message ?? null }));
      throw Error(`Legacy file error was not visible: ${JSON.stringify(detail)}; ${error.message}`);
    }
    assert.equal(await game.evaluate(element => element.recordedTestPrepared), null, "judgement-only data must not manufacture a movement source");
    console.log("PASS native Test Load Recording: original markers/equipment, real unranked judgements, paused seek/resume, current audio-only lease, unchanged Play preferences, portrait control and legacy-file error.");
  }
  if (process.env.AEROBEAT_AB_CAPTURE_OUTPUT) copyFileSync(downloadPath, process.env.AEROBEAT_AB_CAPTURE_OUTPUT);
  console.log(`PASS actual signed ${capture.build.version} numeric run download: ${movement.rawPoses.length} measured frames, ${movement.ticks.length} real advances; raw/model marker mapping, equipment, judgement and run-locked options match.`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(fixturesDir, { recursive: true, force: true });
}
