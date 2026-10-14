// @ts-check

/** @typedef {import("@aerobeat/web-contracts/pose-adapter").AeroPoseAdapter} AeroPoseAdapter */

/**
 * Private marker experiment only. No production route or automatic fallback lives here:
 * the caller must construct a fresh adapter/service when GPU initialization fails.
 *
 * @param {{poseAdapter:AeroPoseAdapter,selectedDelegate:"gpu-webgl"|"cpu-wasm",submissionCadenceTargetFps?:number,now?:()=>number}} options
 */
export function createPrivateExperimentalCvService(options) {
  if (options.selectedDelegate !== "gpu-webgl" && options.selectedDelegate !== "cpu-wasm") throw new TypeError("Experimental CV selectedDelegate must be gpu-webgl or cpu-wasm");
  const selectedDelegate = options.selectedDelegate;
  const expectedProvider = selectedDelegate === "gpu-webgl" ? "webgl" : "wasm";
  const adapter = options.poseAdapter;
  const targetFps = options.submissionCadenceTargetFps ?? 15;
  if (!Number.isFinite(targetFps) || targetFps <= 0 || targetFps > 15) throw new TypeError("Experimental CV cadence must be within the 15fps ceiling");
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
  /** @type {"webgl"|"wasm"|null} */ let actualProvider = null;

  return Object.freeze({
    serviceId: "aero.cv.pose",
    supportedSources: Object.freeze(["live-camera"]),
    get sourceKind() { return "live-camera"; },
    get running() { return lifecycleState === "running"; },
    async start(source) {
      if (lifecycleState === "disposed") throw new Error("Experimental CV service is disposed");
      const normalized = normalizeSource(source);
      const token = ++generation;
      stopTimer(); activeSource = null; latestPoseFrame = undefined; latestPoseGeneration = -1; nextFrameOperation = null; lifecycleState = "loading"; lastError = null; actualProvider = null;
      const operation = enqueueAdapter(async () => { await adapter.load(); actualProvider = validateExecution(); }); loading = operation;
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
      if (!activeSource || lifecycleState !== "running") throw new Error("Experimental CV source is not running");
      if (nextFrameOperation) return nextFrameOperation;
      const token = generation;
      const operation = (async () => {
        if (inFlight) { const pending = inFlight; await pending; if (inFlight === pending) inFlight = null; }
        if (token !== generation || lifecycleState !== "running" || !activeSource) throw new Error("Experimental CV source changed before a fresh frame completed");
        const previousFrameCount = poseFrameCount;
        await estimate(token);
        if (token !== generation || lifecycleState !== "running" || latestPoseGeneration !== token || poseFrameCount === previousFrameCount || !latestPoseFrame) throw new Error(lastError ?? "Experimental CV did not produce a fresh pose frame");
        return latestPoseFrame;
      })();
      nextFrameOperation = operation;
      try { return await operation; } finally { if (nextFrameOperation === operation) nextFrameOperation = null; }
    },
    submitFrame() { void estimate(generation); },
    getLatestPoseFrame() { return latestPoseFrame; },
    getPerformanceSample() {
      const execution = actualProvider === null ? undefined : validateExecutionTelemetry(adapter.getExecutionTelemetry?.());
      return Object.freeze({ running:lifecycleState === "running", submittedFrameCount, poseFrameCount, runtimeInferenceDurationMs:finiteDuration(execution?.runtimeInferenceDurationMs), estimateDurationMs:finiteDuration(execution?.estimateDurationMs) });
    },
    getStatus() {
      // Before the first successful load the vendor deliberately has no actual provider.
      // Never promote the requested delegate into purported actual execution identity.
      if (actualProvider !== null) validateExecutionTelemetry(adapter.getExecutionTelemetry?.());
      return Object.freeze({
        serviceId: "aero.cv.pose", lifecycleState, running: lifecycleState === "running", sourceKind: "live-camera",
        sourceId: activeSource?.sourceId ?? "aero.mediapipe.live", mirrored: activeSource?.mirrored ?? true,
        selectedVendorId: adapter.vendorId, selectedBackendId: "mediapipe", requestedBackendId: "mediapipe",
        providerId: actualProvider === "webgl" ? "gpu-webgl" : actualProvider === "wasm" ? "cpu-wasm" : null, executionLocation: "worker", gameplaySource: "measured", resizePath: "none",
        submissionCadenceTargetFps: targetFps, submittedFrameCount, poseFrameCount, droppedFrameCount,
        latestPoseTimestampMs: latestPoseFrame?.timestampMs ?? null, error: lastError
      });
    }
  });

  function validateExecution() {
    const status = adapter.getExecutionStatus?.();
    if (!status || status.mode !== "worker" || status.delegate !== selectedDelegate) throw new Error("Experimental CV requested delegate contradicted selected worker route");
    const execution = validateExecutionTelemetry(adapter.getExecutionTelemetry?.());
    return /** @type {"webgl"|"wasm"} */ (execution.provider);
  }
  /** @param {unknown} telemetry */
  function validateExecutionTelemetry(telemetry) {
    if (!telemetry || typeof telemetry !== "object") throw new Error("Experimental CV actual execution telemetry is missing");
    const execution = /** @type {{location?:unknown,provider?:unknown,fallback?:unknown,runtimeInferenceDurationMs?:unknown,estimateDurationMs?:unknown}} */ (telemetry);
    if (execution.location !== "worker") throw new Error("Experimental CV execution location contradicted worker route");
    if (execution.provider !== expectedProvider) throw new Error("Experimental CV actual execution provider contradicted selected delegate");
    if (execution.fallback !== false) throw new Error("Experimental CV execution fallback contradicted selected route");
    return execution;
  }

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
      if (executionMode !== "worker") throw new Error("Experimental CV execution mode contradicted worker route");
      const frameSource=createTransferFrame(source.frameSource,timestampMs);
      const frame = await enqueueAdapter(() => adapter.estimateNormalizedPoseFrame(frameSource, { sourceId: source.sourceId, timestampMs, mirrored: source.mirrored, flipHorizontal: false, frameWidth: source.frameWidth(), frameHeight: source.frameHeight() }));
      actualProvider = /** @type {"webgl"|"wasm"} */ (validateExecutionTelemetry(adapter.getExecutionTelemetry?.()).provider);
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

/** @param {unknown} source */
function normalizeSource(source) {
  if (!source || typeof source !== "object" || Object.getPrototypeOf(source) !== Object.prototype) throw new TypeError("Experimental CV source must be a plain record");
  for (const key of ["sourceId", "mirrored", "frameSource", "getTimestampMs", "isFrameAvailable", "frameWidth", "frameHeight"]) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError(`Experimental CV source ${key} is invalid`);
  }
  if (typeof source.sourceId !== "string" || !source.sourceId || source.sourceId.length > 512 || typeof source.mirrored !== "boolean" || !(source.frameSource instanceof HTMLVideoElement) || typeof source.getTimestampMs !== "function" || typeof source.isFrameAvailable !== "function" || typeof source.frameWidth !== "function" || typeof source.frameHeight !== "function") throw new TypeError("Experimental CV source fields are invalid");
  return source;
}

/** @param {HTMLVideoElement} video @param {number} timestampMs */
function createTransferFrame(video,timestampMs){if(typeof VideoFrame!=="function")throw new Error("Experimental MediaPipe worker requires transferable VideoFrame support");return new VideoFrame(video,{timestamp:Math.round(timestampMs*1000)});}
/** @param {unknown} value */
function finiteDuration(value) { if(value===null||value===undefined)return null;const number=Number(value);return Number.isFinite(number)&&number>=0?number:null; }
/** @param {unknown} error */
function errorMessage(error) { if (!error || typeof error !== "object") return "Experimental CV failed"; const descriptor = Object.getOwnPropertyDescriptor(error, "message"); return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value.slice(0, 2048) : "Experimental CV failed"; }
