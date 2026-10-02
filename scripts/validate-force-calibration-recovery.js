// @ts-check
// Browser regression: real assembly/gameplay and lease coordinator, fake camera/CV/audio.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: false, logLevel: "error", define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("local-browser-regression"), __AEROBEAT_CACHE_BUST__: JSON.stringify("local-browser-regression"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("0.0.88") }, server: { host: "127.0.0.1", port: 0, hmr: false, watch: null, fs: { allow: [new URL("../../", import.meta.url).pathname] } } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0];
  assert.ok(url, "Vite URL unavailable");
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 740 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url, { waitUntil: "networkidle" });
  const game = page.locator("aero-game");
  await page.waitForFunction(() => typeof document.querySelector("aero-game")?.start === "function", null, { timeout: 15000 }).catch(() => { throw new Error(`Component failed to load: ${JSON.stringify(errors)}`); });
  await game.evaluate((element) => {
    const factory = element.serviceGraphFactory;
    element.remove();
    element.serviceGraphFactory = (options) => {
      const original = factory(options);
      const state = globalThis.__forceRecovery = { retained: null, cameraRequests: 0, cameraFailure: false, videoPlaying: false, videoPlays: 0, cvRunning: false, cvStarts: 0, poseSequence: 0, audioState: "paused", audioPosition: 0 };
      const hash = "a".repeat(64);
      const variant = { variantId: "force-flow", chartId: "force-chart", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { baseVariantId: "force-flow" } };
      const contentSnapshot = { state: "ready", packageId: "force-package", selectedVariant: variant, variants: [variant], resolvedEvents: [], song: { name: "Calibration regression" }, background: null, lineage: null };
      const content = { getSnapshot: () => contentSnapshot, subscribe() { return () => {}; }, setPlaybackState() {}, readAsset() { return new Uint8Array(); }, destroy() {} };
      const video = { getRetainedCameraStream: () => state.retained, async requestCamera() { state.cameraRequests += 1; if (state.cameraFailure) return { status: "blocked", message: "Permission denied" }; state.retained = { getVideoTracks: () => [{ readyState: "live" }] }; return { status: "granted" }; }, attachCameraStream(element) { element.srcObject = null; return { sourceKind: "live-camera", sourceId: "fixture", sourceChangeId: state.cameraRequests, mirrored: true, sourceAspectRatio: 4 / 3 }; }, async play() { state.videoPlaying = true; state.videoPlays += 1; return { playbackState: "playing" }; }, pause() { state.videoPlaying = false; }, pauseForLease() { state.videoPlaying = false; }, activateLease() {}, releaseLease(options) { state.videoPlaying = false; if (options?.releaseStream) state.retained = null; }, describeSurface() { return { sourceId: "fixture", sourceChangeId: state.cameraRequests, mirrored: true, sourceAspectRatio: 4 / 3 }; }, describeStatus() { return { lifecycleState: "connected" }; }, setDocumentHidden() {}, destroy() {} };
      const cv = { async start() { state.cvStarts += 1; state.cvRunning = true; }, async stop() { state.cvRunning = false; }, getStatus() { return { lifecycleState: state.cvRunning ? "running" : "stopped" }; }, getLatestPoseFrame() { if (!state.cvRunning || !state.videoPlaying) return null; state.poseSequence += 1; return { sourceId: "fixture", mirrored: true, timestampMs: performance.now() + state.poseSequence / 10000, landmarks: [] }; }, async dispose() {} };
      const audio = { async activateLease() {}, async releaseLease() {}, async pauseForLease() { state.audioState = "paused"; }, async stop() { state.audioState = "stopped"; state.audioPosition = 0; }, async pause() { state.audioState = "paused"; }, async play() { state.audioState = "playing"; }, async seek(seconds) { state.audioPosition = seconds; }, async setDocumentHidden() {}, getStatus() { return { state: state.audioState, durationSeconds: 120 }; }, getClockSnapshot() { return { positionSeconds: state.audioPosition, durationSeconds: 120, playing: state.audioState === "playing", contextTimeSeconds: performance.now() / 1000 }; }, getMixSnapshot() { return { musicVolume: .5, sfxVolume: .5 }; }, setMix() {}, async destroy() {} };
      return Object.freeze({ ...original, content, video, cv, audio });
    };
    document.querySelector("main").append(element);
  });
  const start = await game.evaluate(async (element) => { await element.start(); element.setMenuOpen(false, { freshSession: true }); return { state: element.graph.gameplay.getSnapshot().session.state, requests: globalThis.__forceRecovery.cameraRequests, forceButton: Boolean(element.shadowRoot.querySelector("button[data-action='force-calibrate']")) }; });
  assert.equal(start.requests, 1);
  assert.equal(start.state, "calibrating");
  assert.ok(start.forceButton, "Force calibration button missing");
  const ordinary = await game.evaluate(async (element) => {
    const state = globalThis.__forceRecovery;
    element.setMenuOpen(true);
    await element.menuPauseTail;
    const before = { cvRunning: state.cvRunning, cvStarts: state.cvStarts, poses: state.poseSequence, cameraRequests: state.cameraRequests, loop: Boolean(element.frameLoop) };
    element.setMenuOpen(false);
    await element.menuPauseTail;
    await element.lifecycleIntentTail;
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { before, after: { menuOpen: element.menuOpen, cvRunning: state.cvRunning, cvStarts: state.cvStarts, freshPoses: state.poseSequence - before.poses, cameraRequests: state.cameraRequests, videoPlaying: state.videoPlaying, loop: Boolean(element.frameLoop), preview: element.shadowRoot.querySelector("video").dataset.previewVisible === "true", state: element.graph.gameplay.getSnapshot().session.state, error: element.lastError?.message ?? "" } };
  });
  assert.ok(!ordinary.before.cvRunning && ordinary.after.cvStarts > ordinary.before.cvStarts && ordinary.after.cameraRequests === ordinary.before.cameraRequests && !ordinary.after.menuOpen && ordinary.after.cvRunning && ordinary.after.videoPlaying && ordinary.after.loop && ordinary.after.preview && ordinary.after.freshPoses > 0 && ["calibrating", "paused_tracking", "countdown", "playing"].includes(ordinary.after.state), `ordinary menu close must resume retained camera/CV without Force: ${JSON.stringify(ordinary)}`);
  const race = await game.evaluate(async (element) => {
    const state = globalThis.__forceRecovery;
    element.setMenuOpen(true);
    await element.menuPauseTail;
    const before = { cvStarts: state.cvStarts, poses: state.poseSequence };
    element.shadowRoot.querySelector("button[data-action='force-calibrate']").click();
    element.setMenuOpen(false);
    await element.menuPauseTail;
    await element.lifecycleIntentTail;
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { menuOpen: element.menuOpen, error: element.lastError?.message ?? "", cvStarts: state.cvStarts - before.cvStarts, freshPoses: state.poseSequence - before.poses, cvRunning: state.cvRunning, videoPlaying: state.videoPlaying, loop: Boolean(element.frameLoop), preview: element.shadowRoot.querySelector("video").dataset.previewVisible === "true", owner: element.leaseSnapshotForGameplay().ownerInstanceId };
  });
  assert.ok((!race.menuOpen && race.cvRunning && race.videoPlaying && race.loop && race.preview && race.freshPoses > 0 && race.cvStarts >= 1 && race.owner) || (race.menuOpen && /Retry Force calibrate or Start/u.test(race.error)), `close racing pending Force recovery must settle or show retry: ${JSON.stringify(race)}`);
  const run = async (kind) => game.evaluate(async (element, kind) => {
    const state = globalThis.__forceRecovery;
    element.setMenuOpen(true);
    await element.menuPauseTail;
    const startsBefore = state.cvStarts, posesBefore = state.poseSequence, requestsBefore = state.cameraRequests;
    if (kind === "lost-lease") {
      const { aeroGameMediaLeaseCoordinator: coordinator } = await import("/src/media-lease-coordinator.js");
      const rival = { instanceId: "force-calibration-rival", async pauseForLease() {}, async activateLease() {}, async releaseLease() {} };
      const unregister = coordinator.register(rival);
      await coordinator.requestActionResources(rival, Object.freeze(["camera", "audio"]));
      state.retained = null;
      element.__forceRival = unregister;
    }
    if (kind === "denied") { state.retained = null; state.cameraFailure = true; }
    element.shadowRoot.querySelector("button[data-action='force-calibrate']").click();
    await element.lifecycleIntentTail;
    const during = { cvStarts: state.cvStarts - startsBefore, requests: state.cameraRequests - requestsBefore, owner: element.leaseSnapshotForGameplay().ownerInstanceId, retained: Boolean(state.retained), videoPlaying: state.videoPlaying, error: element.lastError?.message ?? "", menuOpen: element.menuOpen };
    element.setMenuOpen(false);
    await element.menuPauseTail;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const after = { menuOpen: element.menuOpen, previewVisible: element.shadowRoot.querySelector("video").dataset.previewVisible === "true", cvRunning: state.cvRunning, freshPoses: state.poseSequence - posesBefore, frameLoop: Boolean(element.frameLoop), session: element.graph.gameplay.getSnapshot().session.state, error: element.lastError?.message ?? "" };
    if (kind === "denied") state.cameraFailure = false;
    if (element.__forceRival) { element.__forceRival(); delete element.__forceRival; }
    return { during, after };
  }, kind);
  for (const kind of ["normal", "lost-lease"]) {
    const { during, after } = await run(kind);
    assert.ok(during.cvStarts >= 1 && during.owner && during.retained && during.videoPlaying, `${kind} must restart video and CV under an owned lease: ${JSON.stringify(during)}`);
    assert.ok(after.previewVisible && after.cvRunning && after.freshPoses > 0 && after.frameLoop && !after.menuOpen && ["calibrating", "countdown", "playing"].includes(after.session), `${kind} must show camera, consume fresh CV and enter calibration/countdown/play: ${JSON.stringify(after)}`);
  }
  const denied = await run("denied");
  assert.ok(denied.after.menuOpen && !denied.after.frameLoop && !denied.after.cvRunning && /Retry Force calibrate or Start/u.test(denied.after.error), `camera failure must remain recoverable: ${JSON.stringify(denied)}`);
  assert.deepEqual(errors, [], `browser page errors: ${JSON.stringify(errors)}`);
  console.log("Camera browser recovery PASS: ordinary menu close, racing close, Force retained/lost lease/denied; preview/CV/display and actionable retry verified");
  await page.close();
} finally {
  if (browser) await browser.close();
  await vite.close();
}
