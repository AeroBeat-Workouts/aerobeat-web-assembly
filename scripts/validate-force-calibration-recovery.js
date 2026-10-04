// @ts-check
// Browser regression: real assembly/gameplay and lease coordinator, fake camera/CV/audio.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const vite = await createViteServer({ appType: "spa", configFile: false, logLevel: "error", define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("local-browser-regression"), __AEROBEAT_CACHE_BUST__: JSON.stringify("local-browser-regression"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("0.0.91") }, server: { host: "127.0.0.1", port: 0, hmr: false, watch: null, fs: { allow: [new URL("../../", import.meta.url).pathname] } } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0];
  assert.ok(url, "Vite URL unavailable");
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 740 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const type = message.type(), text = message.text(), location = message.location();
    if (["warning", "error"].includes(type)
      && !isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, url)
      && !isExpectedPlaycanvasMeshWarning(type, text)) errors.push(`${type}: ${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`);
  });
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
      const contentSnapshot = { state: "ready", packageId: "force-package", selectedVariant: variant, variants: [variant], resolvedEvents: [{ schema: "aerobeat/resolved_content_event", version: 3, eventId: "force-scored-note", variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs: 5000, sourceEventIds: ["force-source-note"], authoredBeat: { type: "note", hand: "left", placement: 5, direction: "up" } }], song: { name: "Calibration regression" }, background: null, lineage: null };
      const content = { getSnapshot: () => contentSnapshot, subscribe() { return () => {}; }, setPlaybackState() {}, readAsset() { return new Uint8Array(); }, destroy() {} };
      const video = { getRetainedCameraStream: () => state.retained, async requestCamera() { state.cameraRequests += 1; if (state.cameraFailure) return { status: "blocked", message: "Permission denied" }; state.retained = { getVideoTracks: () => [{ readyState: "live" }] }; return { status: "granted" }; }, attachCameraStream(element) { element.srcObject = null; return { sourceKind: "live-camera", sourceId: "fixture", sourceChangeId: state.cameraRequests, mirrored: true, sourceAspectRatio: 4 / 3 }; }, async play() { state.videoPlaying = true; state.videoPlays += 1; return { playbackState: "playing" }; }, pause() { state.videoPlaying = false; }, pauseForLease() { state.videoPlaying = false; }, activateLease() {}, releaseLease(options) { state.videoPlaying = false; if (options?.releaseStream) state.retained = null; }, describeSurface() { return { sourceId: "fixture", sourceChangeId: state.cameraRequests, mirrored: true, sourceAspectRatio: 4 / 3 }; }, describeStatus() { return { lifecycleState: "connected" }; }, setDocumentHidden() {}, destroy() {} };
      const cv = { async start() { state.cvStarts += 1; state.cvRunning = true; }, async stop() { state.cvRunning = false; }, getStatus() { return { lifecycleState: state.cvRunning ? "running" : "stopped" }; }, getLatestPoseFrame() { if (!state.cvRunning || !state.videoPlaying) return null; state.poseSequence += 1; return { sourceId: "fixture", mirrored: true, timestampMs: performance.now() + state.poseSequence / 10000, landmarks: [] }; }, async dispose() {} };
      const audio = { async activateLease() {}, async releaseLease() {}, async pauseForLease() { state.audioState = "paused"; }, async stop() { state.audioState = "stopped"; state.audioPosition = 0; }, async pause() { state.audioPauseCalls += 1; state.transportLog.push("pause-request"); if (state.pauseGate) { const gate = state.pauseGate; await new Promise((resolve) => { gate.resolve = resolve; }); state.pauseGate = null; } state.audioState = "paused"; state.transportLog.push("pause-settled"); }, async play() { state.audioPlayCalls += 1; state.audioState = "playing"; state.transportLog.push("play"); }, async seek(seconds) { state.audioSeekCalls += 1; state.audioPosition = seconds; state.transportLog.push("seek"); }, async setDocumentHidden() {}, getStatus() { return { state: state.audioState, durationSeconds: 120 }; }, getClockSnapshot() { return { positionSeconds: state.audioPosition, durationSeconds: 120, playing: state.audioState === "playing", contextTimeSeconds: performance.now() / 1000 }; }, getMixSnapshot() { return { musicVolume: .5, sfxVolume: .5 }; }, setMix() {}, async destroy() {} };
      return Object.freeze({ ...original, content, video, cv, audio });
    };
    document.querySelector("main").append(element);
  });
  const start = await game.evaluate(async (element) => { await element.start(); element.setMenuOpen(false, { freshSession: true }); return { state: element.graph.gameplay.getSnapshot().session.state, requests: globalThis.__forceRecovery.cameraRequests, forceButton: Boolean(element.shadowRoot.querySelector("button[data-action='force-calibrate']")), bottomButton: Boolean(element.shadowRoot.querySelector("aero-visual-test-transport")?.shadowRoot?.querySelector("button[data-role='calibrate']")) }; });
  assert.equal(start.requests, 1);
  assert.equal(start.state, "calibrating");
  assert.ok(!start.forceButton && start.bottomButton, "Info Force button must be absent while bottom Calibrate remains");
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
    await element.forceCalibrate();
    element.setMenuOpen(false);
    await element.menuPauseTail;
    await element.lifecycleIntentTail;
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { menuOpen: element.menuOpen, error: element.lastError?.message ?? "", cvStarts: state.cvStarts - before.cvStarts, freshPoses: state.poseSequence - before.poses, cvRunning: state.cvRunning, videoPlaying: state.videoPlaying, loop: Boolean(element.frameLoop), preview: element.shadowRoot.querySelector("video").dataset.previewVisible === "true", owner: element.leaseSnapshotForGameplay().ownerInstanceId };
  });
  assert.ok((!race.menuOpen && race.cvRunning && race.videoPlaying && race.loop && race.preview && race.freshPoses > 0 && race.cvStarts >= 1 && race.owner) || (race.menuOpen && /Retry Calibrate or Start/u.test(race.error)), `close racing pending Force recovery must settle or show retry: ${JSON.stringify(race)}`);
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
    await element.forceCalibrate();
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
  assert.ok(denied.after.menuOpen && !denied.after.frameLoop && !denied.after.cvRunning && /Retry Calibrate or Start/u.test(denied.after.error), `camera failure must remain recoverable: ${JSON.stringify(denied)}`);
  // The direct API recovery above does not exercise the visible bottom Calibrate
  // intent on a nonzero, already-judged production Play run. Rebuild a fresh
  // public Start after denied recovery, then commit a real shadow Miss and click
  // the actual nested transport button (never dispatch a synthetic UI intent).
  const active = await game.evaluate(async (element) => {
    const state = globalThis.__forceRecovery;
    await element.start();
    element.setMenuOpen(false, { freshSession: true });
    element.stopFrameLoop();
    const gameplay = element.graph.gameplay;
    const ready = { calibration: { calibrationId: "before-force", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: null, straightQualifications: [] };
    let session = gameplay.getSnapshot().session;
    gameplay.advance({ timestampMs: Math.max(performance.now(), session.timestampMs), clock: element.graph.audio.getClockSnapshot(), input: ready, lease: element.leaseSnapshotForGameplay() });
    gameplay.requestStart(Math.max(performance.now(), gameplay.getSnapshot().session.timestampMs));
    session = gameplay.getSnapshot().session;
    for (let index = 0; index < 3; index += 1) {
      gameplay.advance({ timestampMs: session.timestampMs + 1001, clock: element.graph.audio.getClockSnapshot(), input: ready, lease: element.leaseSnapshotForGameplay() });
      session = gameplay.getSnapshot().session;
    }
    if (session.state !== "playing") throw new Error(`Scored Play prerequisite: ${session.state}`);
    element.syncAudioForGameplay(); await element.audioSyncTail;
    state.audioPosition = 15;
    // Drive one real coordinator frame through assembly's production resolver.
    const evidenceAt = Math.max(performance.now(), session.timestampMs + 1);
    const anchor = (role) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: role, calibrationId: "before-force", measurementTimestampMs: evidenceAt, valid: true, confidence: 1, rawX: .5, rawY: .5, x: .5, y: .5, cell: 5, subcell: 20 });
    const evidence = { schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "before-force", measuredSourceFrameId: "force-scored-frame", measurementTimestampMs: evidenceAt, provenance: "measured", activeBoxingActions: [], anchors: ["nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist"].map(anchor), entries: [] };
    const scoredInput = { ...ready, sourceIdentity: "fixture-camera", latestEvidence: evidence };
    const { standaloneTestEquipmentPoses } = await import("/src/test-equipment-authoring.js");
    await element.ensureEquipmentConfigIdentity();
    gameplay.advance({ timestampMs: Math.max(evidenceAt, session.timestampMs + 1), clock: element.graph.audio.getClockSnapshot(), input: scoredInput, lease: element.leaseSnapshotForGameplay(), equipmentPoses: standaloneTestEquipmentPoses("flow", scoredInput, element.equipmentConfigIdentity) });
    const snapshot = gameplay.getSnapshot();
    if (!snapshot.judgedEventIds.includes("force-scored-note")) throw new Error(`Real scored-event prerequisite unavailable: ${JSON.stringify({ judged: snapshot.judgedEventIds, timeline: snapshot.session.timelinePositionMs, errors: element.lastError })}`);
    state.transportLog.length = 0;
    const before = { sessionGeneration: element.sessionGeneration, gameplayGeneration: snapshot.generation, timeline: snapshot.session.timelinePositionMs, judged: [...snapshot.judgedEventIds], score: structuredClone(snapshot.scorePartitions), audio: state.audioState, position: state.audioPosition, plays: state.audioPlayCalls, seeks: state.audioSeekCalls };
    const button = element.shadowRoot.querySelector("aero-visual-test-transport")?.shadowRoot?.querySelector("button[data-role='calibrate']");
    if (!button || button.getAttribute("aria-label") !== "Force calibrate now") throw new Error("Actual bottom Calibrate button absent");
    button.click();
    await element.lifecycleIntentTail;
    element.stopFrameLoop();
    const cue = element.shadowRoot.querySelector("[data-role='transient-cue']");
    const inspectCue = () => {
      element.renderRuntimePresentation();
      const snapshot = element.graph.input.getSnapshot();
      return { cue: cue.textContent, visible: !cue.hidden, reason: snapshot.calibration.invalidationReason, fresh: snapshot.tracking.freshCalibrationRequired, holdMs: snapshot.calibration.holdProgressMs, state: snapshot.calibration.state, gameplay: gameplay.getSnapshot().session.state };
    };
    const input = element.graph.input;
    const resetSnapshot = input.getSnapshot();
    const pausedSession = gameplay.getSnapshot().session;
    gameplay.advance({ timestampMs: Math.max(performance.now(), pausedSession.timestampMs) + 1, clock: element.graph.audio.getClockSnapshot(), input: resetSnapshot, lease: element.leaseSnapshotForGameplay() });
    const resetCue = inspectCue();
    const points = { nose: [.5, .3], left_shoulder: [.6, .4], right_shoulder: [.4, .4], left_elbow: [.7, .4], right_elbow: [.3, .4], left_wrist: [.8, .4], right_wrist: [.2, .4] };
    const base = performance.now() + 100;
    const pose = (offset) => ({ sourceId: "fixture", timestampMs: base + offset, mirrored: true, landmarks: Object.entries(points).map(([name, [x, y]]) => ({ name, x, y, confidence: 1 })) });
    const context = { sourceAspectRatio: 4 / 3, sourceChangeId: element.lastCameraIdentity };
    input.processPoseSample(pose(0), context);
    input.processPoseSample(pose(250), context);
    const holdCue = inspectCue();
    const after = gameplay.getSnapshot();
    const frozen = { sessionGeneration: element.sessionGeneration, gameplayGeneration: after.generation, timeline: after.session.timelinePositionMs, state: after.session.state, judged: [...after.judgedEventIds], score: structuredClone(after.scorePartitions), audio: state.audioState, position: state.audioPosition, plays: state.audioPlayCalls, seeks: state.audioSeekCalls, cv: state.cvRunning, preview: state.videoPlaying, error: element.lastError?.message ?? "" };
    const tick = (input, timestampMs) => gameplay.advance({ timestampMs, clock: element.graph.audio.getClockSnapshot(), input, lease: element.leaseSnapshotForGameplay() });
    const fresh = { ...ready, calibration: { calibrationId: null, readiness: "calibration_required" }, tracking: { gameplayPaused: true, freshCalibrationRequired: true } };
    let timestamp = Math.max(performance.now(), after.session.timestampMs) + 1;
    tick(fresh, timestamp);
    const posed = { ...ready, calibration: { calibrationId: "after-force", readiness: "countdown" } };
    timestamp += 1; tick(posed, timestamp);
    const countdown = [];
    for (let index = 0; index < 3; index += 1) {
      countdown.push({ value: gameplay.getSnapshot().countdown.value, state: gameplay.getSnapshot().session.state, timeline: gameplay.getSnapshot().session.timelinePositionMs, audio: state.audioState, plays: state.audioPlayCalls });
      timestamp += 1001; tick(posed, timestamp);
    }
    const playing = gameplay.getSnapshot();
    element.syncAudioForGameplay(); await element.audioSyncTail;
    return { before, resetCue, holdCue, frozen, countdown, after: { sessionGeneration: element.sessionGeneration, gameplayGeneration: playing.generation, timeline: playing.session.timelinePositionMs, state: playing.session.state, judged: [...playing.judgedEventIds], score: structuredClone(playing.scorePartitions), audio: state.audioState, position: state.audioPosition, plays: state.audioPlayCalls, seeks: state.audioSeekCalls, error: element.lastError?.message ?? "" } };
  });
  assert.ok(active.resetCue.visible && active.resetCue.cue === "T-pose" && active.resetCue.reason === "explicit_reset" && active.resetCue.fresh && active.resetCue.holdMs === 0 && active.resetCue.gameplay === "paused_tracking", `actual bottom button must ask for fresh T-pose from real input reset: ${JSON.stringify(active.resetCue)}`);
  assert.ok(active.holdCue.visible && active.holdCue.cue === "Hold T-pose" && active.holdCue.fresh && active.holdCue.reason !== "tracking_lost" && active.holdCue.holdMs > 0 && active.holdCue.gameplay === "paused_tracking", `hold cue requires real measured T-pose progress: ${JSON.stringify(active.holdCue)}`);
  assert.ok(active.before.timeline >= 15000 && active.before.audio === "playing" && active.before.judged.includes("force-scored-note") && active.before.score.some((partition) => partition.misses === 1), `nonzero scored Play prerequisite: ${JSON.stringify(active)}`);
  for (const phase of [active.frozen, ...active.countdown, active.after]) {
    assert.equal(phase.timeline, active.before.timeline, `force calibration must retain exact timeline: ${JSON.stringify(active)}`);
    if ("gameplayGeneration" in phase) {
      assert.deepEqual({ sessionGeneration: phase.sessionGeneration, gameplayGeneration: phase.gameplayGeneration, judged: phase.judged, score: phase.score }, { sessionGeneration: active.before.sessionGeneration, gameplayGeneration: active.before.gameplayGeneration, judged: active.before.judged, score: active.before.score }, `bottom Calibrate must preserve scored run identity/truth: ${JSON.stringify(active)}`);
    }
  }
  assert.deepEqual(active.countdown.map((step) => step.value), [3, 2, 1], `fresh T-pose must run full countdown: ${JSON.stringify(active)}`);
  assert.ok(active.frozen.audio === "paused" && active.frozen.position === active.before.position && active.frozen.plays === active.before.plays && active.frozen.cv && active.frozen.preview && !active.frozen.error, `fresh-pose gate must align and freeze audio before recovery: ${JSON.stringify(active)}`);
  assert.ok(active.countdown.every((step) => step.audio === "paused" && step.plays === active.before.plays), `countdown cannot play early: ${JSON.stringify(active)}`);
  assert.ok(active.after.state === "playing" && active.after.audio === "playing" && active.after.position === active.before.position && active.after.plays === active.before.plays + 1 && !active.after.error, `Play must restart audio only after full countdown at held time: ${JSON.stringify(active)}`);
  const retry = await game.evaluate(async (element) => {
    const state = globalThis.__forceRecovery;
    state.cameraFailure = true; state.retained = null; state.transportLog.length = 0;
    const before = element.graph.gameplay.getSnapshot();
    const button = element.shadowRoot.querySelector("aero-visual-test-transport").shadowRoot.querySelector("button[data-role='calibrate']");
    button.click(); await element.lifecycleIntentTail;
    const failed = element.graph.gameplay.getSnapshot();
    const denied = { menu: element.menuOpen, error: element.lastError?.message ?? "", audio: state.audioState, plays: state.transportLog.filter((entry) => entry === "play").length, generation: failed.generation, timeline: failed.session.timelinePositionMs, judged: [...failed.judgedEventIds], score: structuredClone(failed.scorePartitions) };
    state.cameraFailure = false;
    await element.forceCalibrate(); await element.lifecycleIntentTail;
    element.stopFrameLoop();
    const recovered = element.graph.gameplay.getSnapshot();
    return { before: { generation: before.generation, timeline: before.session.timelinePositionMs, judged: [...before.judgedEventIds], score: structuredClone(before.scorePartitions) }, denied, recovered: { menu: element.menuOpen, error: element.lastError?.message ?? "", generation: recovered.generation, timeline: recovered.session.timelinePositionMs, judged: [...recovered.judgedEventIds], score: structuredClone(recovered.scorePartitions), cv: state.cvRunning, preview: state.videoPlaying, audio: state.audioState } };
  });
  assert.ok(retry.denied.menu && /Retry Calibrate or Start/u.test(retry.denied.error) && ["paused", "stopped"].includes(retry.denied.audio) && retry.denied.plays === 0, `denied bottom recovery must fail visibly without early audio: ${JSON.stringify(retry)}`);
  for (const phase of [retry.denied, retry.recovered]) assert.deepEqual({ generation: phase.generation, timeline: phase.timeline, judged: phase.judged, score: phase.score }, retry.before, `denied and retried recovery retain same scored run: ${JSON.stringify(retry)}`);
  assert.ok(retry.recovered.cv && retry.recovered.preview && retry.recovered.audio === "paused" && !retry.recovered.error, `denied permission retry must reacquire CV/preview: ${JSON.stringify(retry)}`);
  const lostActive = await game.evaluate(async (element) => {
    const state = globalThis.__forceRecovery;
    const before = element.graph.gameplay.getSnapshot();
    const { aeroGameMediaLeaseCoordinator: coordinator } = await import("/src/media-lease-coordinator.js");
    const rival = { instanceId: "active-bottom-rival", async pauseForLease() {}, async activateLease() {}, async releaseLease() {} };
    const unregister = coordinator.register(rival);
    await coordinator.requestActionResources(rival, Object.freeze(["camera", "audio"]));
    state.retained = null;
    element.shadowRoot.querySelector("aero-visual-test-transport").shadowRoot.querySelector("button[data-role='calibrate']").click();
    await element.lifecycleIntentTail;
    element.stopFrameLoop();
    const after = element.graph.gameplay.getSnapshot();
    unregister();
    return { before: { generation: before.generation, timeline: before.session.timelinePositionMs, judged: [...before.judgedEventIds], score: structuredClone(before.scorePartitions) }, after: { generation: after.generation, timeline: after.session.timelinePositionMs, judged: [...after.judgedEventIds], score: structuredClone(after.scorePartitions), audio: state.audioState, position: state.audioPosition, cv: state.cvRunning, preview: state.videoPlaying, owner: element.leaseSnapshotForGameplay().ownerInstanceId, error: element.lastError?.message ?? "" } };
  });
  assert.deepEqual({ generation: lostActive.after.generation, timeline: lostActive.after.timeline, judged: lostActive.after.judged, score: lostActive.after.score }, lostActive.before, `lost-lease bottom recovery must preserve scored run: ${JSON.stringify(lostActive)}`);
  assert.ok(lostActive.after.cv && lostActive.after.preview && lostActive.after.owner && lostActive.after.audio === "paused" && lostActive.after.position === lostActive.before.timeline / 1000 && !lostActive.after.error, `lost-lease recovery must acquire fresh camera/CV without early audio: ${JSON.stringify(lostActive)}`);
  const legacyUi = await game.evaluate(async (element) => {
    const state = globalThis.__forceRecovery;
    const inspect = () => { const snap = element.graph.gameplay.getSnapshot(); return { generation: snap.generation, timeline: snap.session.timelinePositionMs, judged: [...snap.judgedEventIds], score: structuredClone(snap.scorePartitions), audio: state.audioState, position: state.audioPosition, cv: state.cvRunning, preview: state.videoPlaying, error: element.lastError?.message ?? "" }; };
    const before = inspect();
    const badge = element.shadowRoot.querySelector("aero-calibration-badge");
    const overlay = element.shadowRoot.querySelector("aero-tracking-pause");
    if (!badge?.shadowRoot?.querySelector("button[data-intent='calibration-reset']") || !overlay?.shadowRoot?.querySelector("button[data-intent='calibration-reset']")) throw new Error("Legacy calibration presenter actions missing");
    const results = [];
    for (const presenter of [badge, overlay]) {
      presenter.shadowRoot.querySelector("button[data-intent='calibration-reset']").click();
      await element.lifecycleIntentTail;
      element.stopFrameLoop();
      results.push(inspect());
    }
    return { before, results, hidden: getComputedStyle(badge).display === "none" && getComputedStyle(overlay).display === "none", ariaHidden: badge.getAttribute("aria-hidden") === "true" && overlay.getAttribute("aria-hidden") === "true" };
  });
  assert.ok(legacyUi.hidden && legacyUi.ariaHidden, `legacy badge and tracking overlay are present but not currently visible in product HUD: ${JSON.stringify(legacyUi)}`);
  for (const phase of legacyUi.results) {
    assert.deepEqual({ generation: phase.generation, timeline: phase.timeline, judged: phase.judged, score: phase.score }, { generation: legacyUi.before.generation, timeline: legacyUi.before.timeline, judged: legacyUi.before.judged, score: legacyUi.before.score }, `legacy UI recalibration cannot reset active scored Play: ${JSON.stringify(legacyUi)}`);
    assert.ok(phase.audio === "paused" && phase.position === phase.timeline / 1000 && phase.cv && phase.preview && !phase.error, `legacy UI recalibration recovers live camera with frozen audio: ${JSON.stringify(legacyUi)}`);
  }
  const restarted = await game.evaluate(async (element) => { const old = element.graph.gameplay.getSnapshot(); await element.start(); const next = element.graph.gameplay.getSnapshot(); return { oldGeneration: old.generation, nextGeneration: next.generation, timeline: next.session.timelinePositionMs, judged: [...next.judgedEventIds], score: structuredClone(next.scorePartitions), audioPosition: globalThis.__forceRecovery.audioPosition }; });
  assert.ok(restarted.nextGeneration > restarted.oldGeneration && restarted.timeline === 0 && restarted.audioPosition === 0 && restarted.judged.length === 0 && restarted.score.length === 0, `explicit new Start still clears run and seeks zero: ${JSON.stringify(restarted)}`);
  const genuineLoss = await game.evaluate(async (element) => {
    // An uncalibrated real input service can classify accidental loss after
    // measured low-confidence frames. Project it in the existing paused Play
    // safety state without changing gameplay/input production logic.
    const { createAeroBodyGridService } = await import("/@id/@aerobeat/web-input");
    const measuredInput = createAeroBodyGridService({ calibrationIdPrefix: "loss-cue-browser" });
    const points = { nose: [.5, .3], left_shoulder: [.6, .4], right_shoulder: [.4, .4], left_elbow: [.61, .55], right_elbow: [.39, .55], left_wrist: [.56, .6], right_wrist: [.44, .6] };
    const base = performance.now() + 100;
    const sample = (offset, confidence) => ({ sourceId: "loss-camera", timestampMs: base + offset, mirrored: true, landmarks: Object.entries(points).map(([name, [x, y]]) => ({ name, x, y, confidence })) });
    measuredInput.processPoseSample(sample(0, 1));
    for (const offset of [250, 500, 750, 1000, 1250]) measuredInput.processPoseSample(sample(offset, .2));
    const snapshot = measuredInput.getSnapshot();
    const gameplay = element.graph.gameplay;
    gameplay.pause(Math.max(performance.now(), gameplay.getSnapshot().session.timestampMs) + 1, "measured_tracking_loss");
    gameplay.advance({ timestampMs: gameplay.getSnapshot().session.timestampMs + 1, clock: element.graph.audio.getClockSnapshot(), input: snapshot, lease: element.leaseSnapshotForGameplay() });
    const priorInput = element.graph.input;
    element.setMenuOpen(false, { freshSession: true });
    element.stopFrameLoop();
    const originalSnapshot = priorInput.getSnapshot.bind(priorInput);
    priorInput.getSnapshot = () => measuredInput.getSnapshot();
    element.renderRuntimePresentation();
    const cue = element.shadowRoot.querySelector("[data-role='transient-cue']");
    const result = { reason: snapshot.calibration.invalidationReason, fresh: snapshot.tracking.freshCalibrationRequired, paused: snapshot.tracking.gameplayPaused, cue: cue.textContent, visible: !cue.hidden, state: gameplay.getSnapshot().session.state };
    priorInput.getSnapshot = originalSnapshot;
    measuredInput.destroy();
    return result;
  });
  assert.ok(genuineLoss.reason === "tracking_lost" && genuineLoss.fresh && genuineLoss.paused && genuineLoss.visible && genuineLoss.cue === "Tracking lost" && genuineLoss.state === "paused_tracking", `measured accidental loss must keep genuine loss cue: ${JSON.stringify(genuineLoss)}`);
  assert.deepEqual(errors, [], `browser page errors: ${JSON.stringify(errors)}`);
  console.log("Camera browser recovery PASS: bottom Calibrate shows measured fresh T-pose/hold instead of false loss, genuine measured loss retains Tracking lost; scored continuity, 3/2/1, frozen audio, retry, lease and new Start verified");
  await page.close();
} finally {
  if (browser) await browser.close();
  await vite.close();
}
