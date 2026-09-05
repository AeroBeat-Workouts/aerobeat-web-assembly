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
  /** @type {Promise<void>|null} */ let loading = null;
  /** @type {Promise<unknown>} */ let adapterQueue = Promise.resolve();
  let latestPoseFrame;
  let latestPoseGeneration = -1;
  /** @type {Promise<unknown>|null} */ let nextFrameOperation = null;
  /** @type {Promise<void>|null} */ let disposeOperation = null;
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
      stopTimer(); activeSource = null; latestPoseFrame = undefined; latestPoseGeneration = -1; nextFrameOperation = null; lifecycleState = "loading"; lastError = null;
      const operation = enqueueAdapter(() => adapter.load()); loading = operation;
      try { await operation; }
      catch (error) { if (token !== generation || lifecycleState === "disposed") return; lastError = errorMessage(error); lifecycleState = "error"; throw new Error(lastError); }
      finally { if (loading === operation) loading = null; }
      if (token !== generation || lifecycleState === "disposed") return;
      activeSource = normalized; lifecycleState = "running";
      timer = globalThis.setInterval(() => { void estimate(token); }, Math.ceil(1000 / targetFps));
    },
    async stop() { if (disposeOperation) { await disposeOperation; return; } if (lifecycleState === "disposed") return; ++generation; stopTimer(); activeSource = null; latestPoseFrame = undefined; latestPoseGeneration = -1; nextFrameOperation = null; lifecycleState = "stopped"; },
    async dispose() {
      if (disposeOperation) { await disposeOperation; return; }
      if (lifecycleState === "disposed") return;
      ++generation; stopTimer(); activeSource = null; latestPoseFrame = undefined; latestPoseGeneration = -1; nextFrameOperation = null; lifecycleState = "disposed";
      const operation = (async () => { await loading?.catch(() => {}); await inFlight?.catch(() => {}); await enqueueAdapter(() => adapter.dispose?.()); })(); disposeOperation = operation; await operation;
    },
    async nextPoseFrame() {
      if (!activeSource || lifecycleState !== "running") throw new Error("Production CV source is not running");
      if (nextFrameOperation) return nextFrameOperation;
      const token = generation;
      const operation = (async () => {
        if (inFlight) { const pending = inFlight; await pending; if (inFlight === pending) inFlight = null; }
        if (token !== generation || lifecycleState !== "running" || !activeSource) throw new Error("Production CV source changed before a fresh frame completed");
        const previousFrameCount = poseFrameCount;
        await estimate(token);
        if (token !== generation || lifecycleState !== "running" || latestPoseGeneration !== token || poseFrameCount === previousFrameCount || !latestPoseFrame) throw new Error(lastError ?? "Production CV did not produce a fresh pose frame");
        return latestPoseFrame;
      })();
      nextFrameOperation = operation;
      try { return await operation; } finally { if (nextFrameOperation === operation) nextFrameOperation = null; }
    },
    submitFrame() { void estimate(generation); },
    getLatestPoseFrame() { return latestPoseFrame; },
    getPerformanceSample() {
      const execution = adapter.getExecutionTelemetry?.();
      return Object.freeze({ running:lifecycleState === "running", submittedFrameCount, poseFrameCount, runtimeInferenceDurationMs:finiteDuration(execution?.runtimeInferenceDurationMs), estimateDurationMs:finiteDuration(execution?.estimateDurationMs) });
    },
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

  /** @param {number} token */
  async function estimate(token) {
    if (inFlight) { droppedFrameCount += 1; return; }
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
      const executionMode=adapter.getExecutionStatus?.().mode;
      const frameSource=executionMode==="worker"?createTransferFrame(source.frameSource,timestampMs):source.frameSource;
      const frame = await enqueueAdapter(() => adapter.estimateNormalizedPoseFrame(frameSource, { sourceId: source.sourceId, timestampMs, mirrored: source.mirrored, flipHorizontal: false, frameWidth: source.frameWidth(), frameHeight: source.frameHeight() }));
      if (token !== generation || lifecycleState !== "running") return;
      lastTimestampMs = timestampMs; latestPoseFrame = frame; latestPoseGeneration = token; poseFrameCount += 1; lastError = null;
    } catch (error) {
      if (token === generation) { latestPoseFrame = undefined; latestPoseGeneration = -1; lastError = errorMessage(error); lifecycleState = "error"; stopTimer(); }
    }
  }

  /** @template T @param {()=>T|Promise<T>} operation @returns {Promise<T>} */
  function enqueueAdapter(operation) { const queued = adapterQueue.then(operation, operation); adapterQueue = queued.catch(() => {}); return queued; }
  function stopTimer() { if (timer) globalThis.clearInterval(timer); timer = 0; }
}

/** @param {HTMLVideoElement} video @param {{sourceId?:string,mirrored?:boolean}} surface */
export function createLockedVideoFrameSource(video, surface) {
  if (!(video instanceof HTMLVideoElement)) throw new TypeError("Production CV requires an HTMLVideoElement");
  return Object.freeze({
    kind: "live-camera", sourceId: typeof surface.sourceId === "string" && surface.sourceId ? surface.sourceId : "aero.mediapipe.live",
    mirrored: surface.mirrored === true, frameSource: video,
    getTimestampMs: () => performance.now(),
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

/** @param {HTMLVideoElement} video @param {number} timestampMs */
function createTransferFrame(video,timestampMs){if(typeof VideoFrame!=="function")throw new Error("Production MediaPipe worker requires transferable VideoFrame support");return new VideoFrame(video,{timestamp:Math.round(timestampMs*1000)});}
/** @param {unknown} value */
function finiteDuration(value) { if(value===null||value===undefined)return null;const number=Number(value);return Number.isFinite(number)&&number>=0?number:null; }
/** @param {unknown} error */
function errorMessage(error) { if (!error || typeof error !== "object") return "Production CV failed"; const descriptor = Object.getOwnPropertyDescriptor(error, "message"); return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value.slice(0, 2048) : "Production CV failed"; }
