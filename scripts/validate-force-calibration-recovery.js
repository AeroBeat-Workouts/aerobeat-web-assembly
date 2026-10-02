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
      const state = globalThis.__forceRecovery = { retained: null, cameraRequests: 0, cameraFailure: false, videoPlaying: false, videoPlays: 0, cvRunning: false, cvStarts: 0, poseSequence: 0, audioState: "paused", audioPosition: 0, audioPauseCalls: 0, audioPlayCalls: 0, audioSeekCalls: 0, pauseGate: null, transportLog: [] };
      const hash = "a".repeat(64);
      const variant = { variantId: "force-flow", chartId: "force-chart", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { baseVariantId: "force-flow" } };
      const contentSnapshot = { state: "ready", packageId: "force-package", selectedVariant: variant, variants: [variant], resolvedEvents: [], song: { name: "Calibration regression" }, background: null, lineage: null };
      const content = { getSnapshot: () => contentSnapshot, subscribe() { return () => {}; }, setPlaybackState() {}, readAsset() { return new Uint8Array(); }, destroy() {} };
      const video = { getRetainedCameraStream: () => state.retained, async requestCamera() { state.cameraRequests += 1; if (state.cameraFailure) return { status: "blocked", message: "Permission denied" }; state.retained = { getVideoTracks: () => [{ readyState: "live" }] }; return { status: "granted" }; }, attachCameraStream(element) { element.srcObject = null; return { sourceKind: "live-camera", sourceId: "fixture", sourceChangeId: state.cameraRequests, mirrored: true, sourceAspectRatio: 4 / 3 }; }, async play() { state.videoPlaying = true; state.videoPlays += 1; return { playbackState: "playing" }; }, pause() { state.videoPlaying = false; }, pauseForLease() { state.videoPlaying = false; }, activateLease() {}, releaseLease(options) { state.videoPlaying = false; if (options?.releaseStream) state.retained = null; }, describeSurface() { return { sourceId: "fixture", sourceChangeId: state.cameraRequests, mirrored: true, sourceAspectRatio: 4 / 3 }; }, describeStatus() { return { lifecycleState: "connected" }; }, setDocumentHidden() {}, destroy() {} };
      const cv = { async start() { state.cvStarts += 1; state.cvRunning = true; }, async stop() { state.cvRunning = false; }, getStatus() { return { lifecycleState: state.cvRunning ? "running" : "stopped" }; }, getLatestPoseFrame() { if (!state.cvRunning || !state.videoPlaying) return null; state.poseSequence += 1; return { sourceId: "fixture", mirrored: true, timestampMs: performance.now() + state.poseSequence / 10000, landmarks: [] }; }, async dispose() {} };
      const audio = { async activateLease() {}, async releaseLease() {}, async pauseForLease() { state.audioState = "paused"; }, async stop() { state.audioState = "stopped"; state.audioPosition = 0; }, async pause() { state.audioPauseCalls += 1; state.transportLog.push("pause-request"); if (state.pauseGate) { const gate = state.pauseGate; await new Promise((resolve) => { gate.resolve = resolve; }); state.pauseGate = null; } state.audioState = "paused"; state.transportLog.push("pause-settled"); }, async play() { state.audioPlayCalls += 1; state.audioState = "playing"; state.transportLog.push("play"); }, async seek(seconds) { state.audioSeekCalls += 1; state.audioPosition = seconds; state.transportLog.push("seek"); }, async setDocumentHidden() {}, getStatus() { return { state: state.audioState, durationSeconds: 120 }; }, getClockSnapshot() { return { positionSeconds: state.audioPosition, durationSeconds: 120, playing: state.audioState === "playing", contextTimeSeconds: performance.now() / 1000 }; }, getMixSnapshot() { return { musicVolume: .5, sfxVolume: .5 }; }, setMix() {}, async destroy() {} };
      return Object.freeze({ ...original, content, video, cv, audio });
    };
    document.querySelector("main").append(element);
  });
  const start = await game.evaluate(async (element) => { await element.start(); element.setMenuOpen(false, { freshSession: true }); return { state: element.graph.gameplay.getSnapshot().session.state, requests: globalThis.__forceRecovery.cameraRequests, forceButton: Boolean(element.shadowRoot.querySelector("button[data-action='force-calibrate']")) }; });
  assert.equal(start.requests, 1);
  assert.equal(start.state, "calibrating");
  assert.ok(start.forceButton, "Force calibration button missing");
  // Exercise the real active Play menu reset. The unresolved audio pause must
  // prevent menu-close recovery, not merely leave a synthetic coordinator paused.
  const deferred = await game.evaluate(async (element) => {
    const state = globalThis.__forceRecovery;
    const session = element.graph.gameplay.getSnapshot().session;
    const readyInput = { calibration: { calibrationId: "browser-cal", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: null, straightQualifications: [] };
    element.stopFrameLoop();
    element.graph.gameplay.advance({ timestampMs: Math.max(performance.now(), session.timestampMs), clock: element.graph.audio.getClockSnapshot(), input: readyInput, lease: element.leaseSnapshotForGameplay() });
    const requested = element.graph.gameplay.requestStart(Math.max(performance.now(), element.graph.gameplay.getSnapshot().session.timestampMs));
    if (!requested.accepted) throw new Error(`Play countdown preparation rejected: ${JSON.stringify(requested)}`);
    let step = element.graph.gameplay.getSnapshot().session;
    for (const delta of [1000, 2000, 3000, 4000]) {
      if (step.state === "playing") break;
      element.graph.gameplay.advance({ timestampMs: step.timestampMs + delta, clock: element.graph.audio.getClockSnapshot(), input: readyInput, lease: element.leaseSnapshotForGameplay() });
      step = element.graph.gameplay.getSnapshot().session;
    }
    if (step.state !== "playing") throw new Error(`Active Play prerequisite unavailable: ${step.state}`);
    element.syncAudioForGameplay();
    await element.audioSyncTail;
    if (state.audioState !== "playing") throw new Error("Active Play audio prerequisite unavailable");
    state.transportLog.length = 0;
    const baseline = { plays: state.audioPlayCalls, seeks: state.audioSeekCalls, cvStarts: state.cvStarts, poses: state.poseSequence, timelineMs: step.timelinePositionMs };
    state.pauseGate = { resolve: null };
    element.shadowRoot.querySelector("[data-action='menu-toggle']").click();
    if (typeof state.pauseGate.resolve !== "function") throw new Error("Public menu did not request audio pause");
    const pausedSession = element.graph.gameplay.getSnapshot().session;
    element.shadowRoot.querySelector("[data-action='menu-toggle']").click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const pending = { menuOpen: element.menuOpen, armed: element.menuPauseArmed, pausePending: Boolean(state.pauseGate?.resolve), session: element.graph.gameplay.getSnapshot().session.state, timelineMs: element.graph.gameplay.getSnapshot().session.timelinePositionMs, countdown: element.graph.gameplay.getSnapshot().countdown?.value ?? null, audio: state.audioState, plays: state.audioPlayCalls - baseline.plays, seeks: state.audioSeekCalls - baseline.seeks, cvStarts: state.cvStarts - baseline.cvStarts, log: [...state.transportLog] };
    state.pauseGate.resolve();
    await element.menuPauseTail;
    await element.lifecycleIntentTail;
    const deadline = performance.now() + 2000;
    while ((state.cvStarts === baseline.cvStarts || !element.frameLoop || state.poseSequence === baseline.poses) && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    const after = { menuOpen: element.menuOpen, session: element.graph.gameplay.getSnapshot().session.state, audio: state.audioState, cvStarts: state.cvStarts - baseline.cvStarts, poses: state.poseSequence - baseline.poses, loop: Boolean(element.frameLoop), log: [...state.transportLog] };
    return { activeTimelineMs: baseline.timelineMs, pausedSession: pausedSession.state, pausedTimelineMs: pausedSession.timelinePositionMs, pending, after };
  });
  assert.equal(deferred.pausedSession, "paused_manual", `public menu must pause active Play: ${JSON.stringify(deferred)}`);
  assert.ok(!deferred.pending.menuOpen && !deferred.pending.armed && deferred.pending.pausePending && deferred.pending.session !== "countdown" && deferred.pending.session !== "playing" && deferred.pending.timelineMs === deferred.pausedTimelineMs && deferred.pausedTimelineMs >= deferred.activeTimelineMs && deferred.pending.countdown === null && deferred.pending.audio === "playing" && deferred.pending.plays === 0 && deferred.pending.seeks === 0 && deferred.pending.cvStarts === 0 && JSON.stringify(deferred.pending.log) === JSON.stringify(["pause-request"]), `unresolved pause must block recovery countdown, seek, CV and audio restart: ${JSON.stringify(deferred)}`);
  assert.ok(!deferred.after.menuOpen && deferred.after.cvStarts >= 1 && deferred.after.poses > 0 && deferred.after.loop && deferred.after.audio === "paused" && ["calibrating", "paused_tracking", "countdown"].includes(deferred.after.session) && deferred.after.log[0] === "pause-request" && deferred.after.log[1] === "pause-settled" && !deferred.after.log.includes("play") && (deferred.after.log.indexOf("seek") === -1 || deferred.after.log.indexOf("pause-settled") < deferred.after.log.indexOf("seek")), `resolving pause must precede frozen-clock alignment and calibration recovery: ${JSON.stringify(deferred)}`);
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
    assert.ok(after.previewVisible && after.cvRunning && after.freshPoses > 0 && after.frameLoop && !after.menuOpen && ["calibrating", "paused_tracking", "countdown", "playing"].includes(after.session), `${kind} must show camera, consume fresh CV and enter calibration/countdown/play: ${JSON.stringify(after)}`);
  }
  const denied = await run("denied");
  assert.ok(denied.after.menuOpen && !denied.after.frameLoop && !denied.after.cvRunning && /Retry Force calibrate or Start/u.test(denied.after.error), `camera failure must remain recoverable: ${JSON.stringify(denied)}`);
  assert.deepEqual(errors, [], `browser page errors: ${JSON.stringify(errors)}`);
  console.log("Camera browser recovery PASS: active Play delayed menu pause blocks countdown/audio until resolved; ordinary close, racing close, Force retained/lost lease/denied verified");
  await page.close();
} finally {
  if (browser) await browser.close();
  await vite.close();
}
