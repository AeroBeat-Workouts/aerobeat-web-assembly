// @ts-check
// Opt-in, child-local scalar observer of the genuine camera-backed Play graph.
// No frame bytes, coordinates, public snapshot, storage, or network access.
const MAX_WINDOW_MS = 60_000;
const MAX_COUNT = 10_000_000;
const REASONS = new Set(["not_started", "hidden", "session_changed", "not_playing", "cv_lost", "camera_lost", "geometry_changed", "counter_reset", "no_poses", "no_camera_frames", "callback_unavailable", "disposed"]);
const clamp = (value, max = MAX_COUNT) => Number.isFinite(value) && value >= 0 ? Math.min(max, Math.floor(value)) : null;
const decimal = (value, max) => Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value * 1000) / 1000 : null;
const delta = (after, before) => after >= before ? after - before : null;
const bounds = (value, max) => value === null || value === undefined ? null : decimal(value, max);
function stats(value) {
  return { count: clamp(value?.count, 2048) ?? 0, p50: bounds(value?.p50, 120_000), p95: bounds(value?.p95, 120_000) };
}
function camera(value) {
  return { width: clamp(value?.width, 16384), height: clamp(value?.height, 16384), configuredFrameRateFps: bounds(value?.frameRate, 240) };
}
function state(game) {
  const graph = game?.graph;
  const video = game?.videoElement?.();
  const session = graph?.gameplay?.getSnapshot?.()?.session;
  const cv = graph?.cv?.getStatus?.();
  const track = graph?.video?.getRetainedCameraStream?.()?.getVideoTracks?.()[0];
  const box = game?.getBoundingClientRect?.();
  return { graph, video, session, cv, track, connection:game?.connectedGeneration, generation:game?.sessionGeneration,
    calibration:graph?.input?.getSnapshot?.()?.calibration?.calibrationId,
    cameraIdentity:game?.lastCameraIdentity,
    geometry:[box?.width,box?.height,globalThis.devicePixelRatio,video?.videoWidth,video?.videoHeight].join(":"),
    geometryReady:Number.isFinite(box?.width) && box.width > 0 && Number.isFinite(box?.height) && box.height > 0 && video?.videoWidth > 0 && video?.videoHeight > 0,
    cadence:game?.cadenceSnapshot?.() };
}
function reason(base, next) {
  if (globalThis.document?.hidden) return "hidden";
  if (base.graph !== next.graph || base.connection !== next.connection || base.generation !== next.generation || base.session?.sessionId !== next.session?.sessionId || base.calibration !== next.calibration) return "session_changed";
  if (next.session?.purpose !== "play" || next.session?.state !== "playing" || next.cadence?.active !== true) return "not_playing";
  if (next.cv?.running !== true || next.cv?.lifecycleState !== "running" || next.cv?.error) return "cv_lost";
  if (!next.video || next.video !== base.video || !next.track || next.track !== base.track || next.track.readyState !== "live" || next.video.srcObject == null || next.video.paused || next.video.readyState < 2) return "camera_lost";
  if (next.cv.submittedFrameCount < base.cv.submittedFrameCount || next.cv.poseFrameCount < base.cv.poseFrameCount || next.cv.droppedFrameCount < base.cv.droppedFrameCount) return "cv_lost";
  if (!next.geometryReady || base.cameraIdentity !== next.cameraIdentity || base.geometry !== next.geometry) return "geometry_changed";
  return null;
}
/**
 * Create an opt-in observer; start(game) resets the game's private recorder and
 * returns true only for an already playing, calibrated camera-backed Play session.
 * stop() returns the final aggregate, snapshot() returns a current aggregate,
 * dispose() cancels callbacks and permanently releases references. Caller owns
 * warmup and the 30–60-second measured-window timer.
 */
export function createPhonePlayCvWindow() {
  let game = null, baseline = null, callback = null, frameCount = 0, lastMediaTime = -Infinity, lastPresented = -Infinity;
  let startedAt = 0, ended = null, invalid = "not_started", disposed = false;
  function cancel() {
    if (callback !== null) { try { baseline?.video?.cancelVideoFrameCallback?.(callback); } catch { /* detached video */ } callback = null; }
  }
  function check() {
    if (!baseline || invalid) return;
    try { invalid = reason(baseline, state(game)) ?? ""; } catch { invalid = "session_changed"; }
    if (invalid) { ended ??= performance.now(); cancel(); }
  }
  function tick(_now, metadata) {
    callback = null;
    check();
    if (invalid || ended !== null) return;
    const mediaTime = metadata?.mediaTime, presented = metadata?.presentedFrames;
    if (Number.isFinite(mediaTime) && mediaTime > lastMediaTime && (!Number.isFinite(presented) || presented > lastPresented)) {
      lastMediaTime = mediaTime;
      if (Number.isFinite(presented)) lastPresented = presented;
      frameCount += 1;
    }
    callback = baseline.video.requestVideoFrameCallback(tick);
  }
  function snapshot() {
    check();
    const durationMs = baseline ? decimal(Math.min(MAX_WINDOW_MS, Math.max(0, (ended ?? performance.now()) - startedAt)), MAX_WINDOW_MS) : 0;
    let perf = null, cadence = null, cv = null;
    if (baseline) {
      try { perf = game.privatePerformanceSnapshot(); cadence = game.cadenceSnapshot(); cv = game.graph.cv.getStatus(); } catch { invalid ||= "session_changed"; }
    }
    const counterDelta = (current, initial) => Number.isSafeInteger(current) && Number.isSafeInteger(initial) && current >= 0 && initial >= 0 ? delta(current, initial) : null;
    const submitted = baseline && cv ? counterDelta(cv.submittedFrameCount, baseline.cv.submittedFrameCount) : null;
    const poses = baseline && cv ? counterDelta(cv.poseFrameCount, baseline.cv.poseFrameCount) : null;
    const busyDrops = baseline && cv ? counterDelta(cv.droppedFrameCount, baseline.cv.droppedFrameCount) : null;
    const sceneFrames = baseline && cadence ? counterDelta(cadence.displayFrameCount, baseline.cadence.displayFrameCount) : null;
    const fresh = baseline && cadence ? counterDelta(cadence.freshPoseConsumptionCount, baseline.cadence.freshPoseConsumptionCount) : null;
    const advanced = baseline && cadence ? counterDelta(cadence.inputAdvanceCount, baseline.cadence.inputAdvanceCount) : null;
    if ([submitted, poses, busyDrops, sceneFrames, fresh, advanced].some(value => value === null) && baseline) invalid ||= "counter_reset";
    if (!invalid && ended !== null && poses === 0) invalid = "no_poses";
    if (!invalid && ended !== null && frameCount === 0) invalid = "no_camera_frames";
    if (invalid && ended === null && baseline) { ended = performance.now(); cancel(); }
    const rate = value => durationMs > 0 && value !== null ? decimal(value * 1000 / durationMs, 100_000) : null;
    // Construct every output property explicitly; private objects are never spread.
    return { schema:"aerobeat/private_phone_play_cv_window", version:1, purpose:"play", valid:!invalid,
      invalidReason:invalid || null, durationMs,
      counts:{ cameraUniqueMediaFrames:clamp(frameCount), cvSubmitted:clamp(submitted), cvPoses:clamp(poses), cvBusyDrops:clamp(busyDrops), freshPoseConsumptions:clamp(fresh), inputAdvances:clamp(advanced), sceneFrames:clamp(sceneFrames) },
      ratesFps:{ denominatorMs:durationMs, cameraUnique:rate(frameCount), cvSubmitted:rate(submitted), cvPoses:rate(poses), freshPoseConsumption:rate(fresh), scene:rate(sceneFrames) },
      camera:camera(perf?.camera), inferenceMs:stats(perf?.mediaPipeRuntimeMs), endToEndMs:stats(perf?.mediaPipeEndToEndMs), poseAgeMs:stats(perf?.poseAgeMs), sceneIntervalMs:stats(perf?.displayIntervals) };
  }
  function stop() { if (baseline && ended === null) { check(); ended ??= performance.now(); cancel(); } return snapshot(); }
  function start(nextGame) {
    if (disposed) return false;
    cancel(); game = nextGame; baseline = null; ended = null; frameCount = 0; lastMediaTime = -Infinity; lastPresented = -Infinity;
    invalid = "not_playing";
    try {
      const candidate = state(game);
      if (!candidate.video?.requestVideoFrameCallback || !candidate.video?.cancelVideoFrameCallback) { invalid = "callback_unavailable"; return false; }
      if (!candidate.calibration || reason(candidate, candidate)) { invalid = reason(candidate, candidate) ?? "not_playing"; return false; }
      if (!candidate.geometryReady) { invalid = "geometry_changed"; return false; }
      if (![candidate.cv.submittedFrameCount,candidate.cv.poseFrameCount,candidate.cv.droppedFrameCount,candidate.cadence.displayFrameCount,candidate.cadence.freshPoseConsumptionCount,candidate.cadence.inputAdvanceCount].every(value => Number.isSafeInteger(value) && value >= 0)) { invalid = "counter_reset"; return false; }
      if (typeof game.resetPrivatePerformanceWindow !== "function" || typeof game.privatePerformanceSnapshot !== "function") return false;
      game.resetPrivatePerformanceWindow("phone-play-cv");
      baseline = { ...candidate, cv:{ submittedFrameCount:candidate.cv.submittedFrameCount, poseFrameCount:candidate.cv.poseFrameCount, droppedFrameCount:candidate.cv.droppedFrameCount }, cadence:{ displayFrameCount:candidate.cadence.displayFrameCount, freshPoseConsumptionCount:candidate.cadence.freshPoseConsumptionCount, inputAdvanceCount:candidate.cadence.inputAdvanceCount } }; startedAt = performance.now(); invalid = "";
      callback = candidate.video.requestVideoFrameCallback(tick);
      return true;
    } catch { invalid = "session_changed"; return false; }
  }
  function dispose() { cancel(); disposed = true; invalid = "disposed"; baseline = null; game = null; }
  return Object.freeze({ start, stop, snapshot, dispose });
}
export const phonePlayCvWindowReasons = Object.freeze([...REASONS]);
