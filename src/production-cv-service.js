// @ts-check

/** @typedef {import("@aerobeat/web-contracts/pose-adapter").AeroPoseAdapter} AeroPoseAdapter */

/**
 * Narrow live-camera CV service used by the product root. It intentionally has
 * no replay, fallback, backend selector, resize, prediction, or worker route.
 *
 * @param {{poseAdapter:AeroPoseAdapter,submissionCadenceTargetFps?:number,now?:()=>number}} options
 */
export function createLockedProductionCvService(options) {
  const adapter = options.poseAdapter;
  const targetFps = options.submissionCadenceTargetFps ?? 15;
  if (!Number.isFinite(targetFps) || targetFps <= 0 || targetFps > 15) throw new TypeError("Production CV cadence must be within the 15fps ceiling");
  const now = options.now ?? (() => performance.now());
  let lifecycleState = "idle";
  let generation = 0;
  let timer = 0;
  let activeSource = null;
  let latestPoseFrame;
  let lastError = null;
  let submittedFrameCount = 0;
  let poseFrameCount = 0;
  let droppedFrameCount = 0;
  /** @type {Promise<void>|null} */ let inFlight = null;
  let lastTimestampMs = -1;

  return Object.freeze({
    serviceId: "aero.cv.pose",
    supportedSources: Object.freeze(["live-camera"]),
    get sourceKind() { return "live-camera"; },
    get running() { return lifecycleState === "running"; },
    async start(source) {
      if (lifecycleState === "disposed") throw new Error("Production CV service is disposed");
      const normalized = normalizeSource(source);
      const token = ++generation;
      stopTimer(); lifecycleState = "loading"; lastError = null;
      await adapter.load();
      if (token !== generation || lifecycleState === "disposed") return;
      activeSource = normalized; lifecycleState = "running";
      timer = globalThis.setInterval(() => { void estimate(token); }, Math.ceil(1000 / targetFps));
    },
    async stop() { if (lifecycleState === "disposed") return; ++generation; stopTimer(); activeSource = null; lifecycleState = "stopped"; },
    async dispose() { if (lifecycleState === "disposed") return; ++generation; stopTimer(); activeSource = null; latestPoseFrame = undefined; lifecycleState = "disposed"; await inFlight?.catch(() => {}); await adapter.dispose?.(); },
    async nextPoseFrame() { if (!activeSource) throw new Error("Production CV source is not running"); await estimate(generation, true); if (!latestPoseFrame) throw new Error("Production CV did not produce a pose frame"); return latestPoseFrame; },
    submitFrame() { void estimate(generation); },
    getLatestPoseFrame() { return latestPoseFrame; },
    getStatus() {
      const execution = adapter.getExecutionTelemetry?.();
      return Object.freeze({
        serviceId: "aero.cv.pose", lifecycleState, running: lifecycleState === "running", sourceKind: "live-camera",
        sourceId: activeSource?.sourceId ?? "aero.mediapipe.live", mirrored: activeSource?.mirrored ?? true,
        selectedVendorId: adapter.vendorId, selectedBackendId: "mediapipe", requestedBackendId: "mediapipe",
        providerId: execution?.provider ?? "gpu-webgl", gameplaySource: "measured", resizePath: "none",
        submissionCadenceTargetFps: targetFps, submittedFrameCount, poseFrameCount, droppedFrameCount,
        latestPoseTimestampMs: latestPoseFrame?.timestampMs ?? null, error: lastError
      });
    }
  });

  /** @param {number} token @param {boolean} [waitForExisting] */
  async function estimate(token, waitForExisting = false) {
    if (inFlight) { if (!waitForExisting) { droppedFrameCount += 1; return; } const pending = inFlight; await pending; if (inFlight === pending) inFlight = null; return estimate(token, false); }
    const source = activeSource;
    if (token !== generation || lifecycleState !== "running" || !source || !source.isFrameAvailable()) return;
    submittedFrameCount += 1;
    const operation = runEstimate(token, source); inFlight = operation;
    try { await operation; } finally { if (inFlight === operation) inFlight = null; }
  }

  /** @param {number} token @param {ReturnType<typeof normalizeSource>} source */
  async function runEstimate(token, source) {
    try {
      const rawTimestamp = source.getTimestampMs();
      const timestampMs = Math.max(lastTimestampMs + 0.001, Number.isFinite(rawTimestamp) ? rawTimestamp : now());
      const frame = await adapter.estimateNormalizedPoseFrame(source.frameSource, { sourceId: source.sourceId, timestampMs, mirrored: source.mirrored, flipHorizontal: false, frameWidth: source.frameWidth(), frameHeight: source.frameHeight() });
      if (token !== generation || lifecycleState !== "running") return;
      lastTimestampMs = timestampMs; latestPoseFrame = frame; poseFrameCount += 1; lastError = null;
    } catch (error) {
      if (token === generation) { lastError = errorMessage(error); lifecycleState = "error"; stopTimer(); }
    }
  }

  function stopTimer() { if (timer) globalThis.clearInterval(timer); timer = 0; }
}

/** @param {HTMLVideoElement} video @param {{sourceId?:string,mirrored?:boolean}} surface */
export function createLockedVideoFrameSource(video, surface) {
  if (!(video instanceof HTMLVideoElement)) throw new TypeError("Production CV requires an HTMLVideoElement");
  return Object.freeze({
    kind: "live-camera", sourceId: typeof surface.sourceId === "string" && surface.sourceId ? surface.sourceId : "aero.mediapipe.live",
    mirrored: surface.mirrored === true, frameSource: video,
    getTimestampMs: () => Number.isFinite(video.currentTime) ? video.currentTime * 1000 : performance.now(),
    isFrameAvailable: () => video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0,
    frameWidth: () => video.videoWidth,
    frameHeight: () => video.videoHeight
  });
}

/** @param {unknown} source */
function normalizeSource(source) {
  if (!source || typeof source !== "object" || Object.getPrototypeOf(source) !== Object.prototype) throw new TypeError("Production CV source must be a plain record");
  for (const key of ["sourceId", "mirrored", "frameSource", "getTimestampMs", "isFrameAvailable", "frameWidth", "frameHeight"]) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError(`Production CV source ${key} is invalid`);
  }
  if (typeof source.sourceId !== "string" || !source.sourceId || source.sourceId.length > 512 || typeof source.mirrored !== "boolean" || !(source.frameSource instanceof HTMLVideoElement) || typeof source.getTimestampMs !== "function" || typeof source.isFrameAvailable !== "function" || typeof source.frameWidth !== "function" || typeof source.frameHeight !== "function") throw new TypeError("Production CV source fields are invalid");
  return source;
}

/** @param {unknown} error */
function errorMessage(error) { if (!error || typeof error !== "object") return "Production CV failed"; const descriptor = Object.getOwnPropertyDescriptor(error, "message"); return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value.slice(0, 2048) : "Production CV failed"; }
