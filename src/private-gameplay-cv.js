// @ts-check

import { createMediaPipeWorkerPoseAdapter, mediaPipeDelegates, mediaPipeLiveSourceId } from "@aerobeat/web-vendor-mediapipe";
import { createPrivateExperimentalCvService } from "./private-experimental-cv-service.js";
import { lockedProductionCvProfile } from "./production-cv-profile.js";

/**
 * Candidate-only graph service. Delegate selection occurs once, during the first
 * start: only an initialization failure permits a fresh CPU Worker. A later
 * failure (including a restart failure) remains an error, never a provider switch.
 * @param {{createAdapter?: typeof createMediaPipeWorkerPoseAdapter,createService?: typeof createPrivateExperimentalCvService,qaGpuInitFailure?:boolean}} [options]
 */
export function createPrivateGameplayCvService(options = {}) {
  const createAdapter = options.createAdapter ?? createMediaPipeWorkerPoseAdapter;
  const createService = options.createService ?? createPrivateExperimentalCvService;
  let active = null;
  let state = "idle";
  let generation = 0;
  let selected = false;
  let fallback = false;
  let sourceId = "aero.mediapipe.live";
  let mirrored = true;
  let error = null;
  /** @type {Promise<void>} */ let queue = Promise.resolve();
  /** @type {Promise<void>|null} */ let disposal = null;

  function makeService(delegate) {
    const poseAdapter = createAdapter({
      sourceId: mediaPipeLiveSourceId, mirrored: true, delegate,
      minPoseDetectionConfidence: lockedProductionCvProfile.minPoseDetectionConfidence,
      minPosePresenceConfidence: lockedProductionCvProfile.minPosePresenceConfidence,
      minTrackingConfidence: lockedProductionCvProfile.minTrackingConfidence
    });
    return createService({ poseAdapter, selectedDelegate: delegate,
      schedulingMode: "after-result", submissionCadenceTargetFps: 15 });
  }

  function enqueue(operation) {
    const next = queue.then(operation, operation);
    queue = next.catch(() => {});
    return next;
  }

  function status() {
    if (active) return Object.freeze({ ...active.getStatus(), fallback });
    return Object.freeze({ fallback,
      serviceId: "aero.cv.pose", lifecycleState: state, running: false,
      sourceKind: "live-camera", schedulingMode: "after-result", sourceId, mirrored,
      selectedVendorId: null, selectedBackendId: "mediapipe", requestedBackendId: "mediapipe",
      providerId: null, executionLocation: "worker", gameplaySource: "measured", resizePath: "none",
      submissionCadenceTargetFps: 15, submittedFrameCount: 0, poseFrameCount: 0,
      droppedFrameCount: 0, latestPoseTimestampMs: null, error
    });
  }

  return Object.freeze({
    serviceId: "aero.cv.pose",
    supportedSources: Object.freeze(["live-camera"]),
    get sourceKind() { return "live-camera"; },
    get running() { return active?.running ?? false; },
    getStatus: status,
    getLatestPoseFrame() { return active?.getLatestPoseFrame(); },
    getPerformanceSample() {
      return active?.getPerformanceSample() ?? Object.freeze({ running: false, submittedFrameCount: 0,
        poseFrameCount: 0, runtimeInferenceDurationMs: null, estimateDurationMs: null });
    },
    submitFrame() { active?.submitFrame(); },
    async nextPoseFrame() {
      if (!active) throw new Error("Private gameplay CV source is not running");
      return active.nextPoseFrame(); // after-result explicitly rejects bypass
    },
    start(source) {
      if (state === "disposed") return Promise.reject(new Error("Private gameplay CV service is disposed"));
      // Validate the paced source before attempting GPU initialization or fallback.
      if (!source || typeof source !== "object" || typeof source.getPresentedFrameId !== "function")
        return Promise.reject(new TypeError("Private gameplay CV requires getPresentedFrameId"));
      const token = ++generation;
      sourceId = source.sourceId;
      mirrored = source.mirrored;
      state = "loading";
      error = null;
      return enqueue(async () => {
        if (token !== generation || state === "disposed") return;
        try {
          if (!active) active = makeService(mediaPipeDelegates.gpuWebgl);
          // QA-only preview seam: exercise GPU construction then force a startup
          // failure before load/pose admission, so CPU still loads a REAL fresh Worker.
          if (options.qaGpuInitFailure === true && !selected) throw new Error("QA preview GPU initialization failure");
          await active.start(source);
          if (token === generation && state !== "disposed") { selected = true; state = "running"; }
        } catch (failure) {
          // Never fall back if a delegate has previously started successfully.
          if (selected || token !== generation || state === "disposed") {
            if (token === generation && state !== "disposed") { state = "error"; error = message(failure); }
            if (token === generation && state !== "disposed") throw failure;
            return;
          }
          const failed = active;
          try { if (failed) await failed.dispose(); }
          catch (disposeFailure) {
            active = failed;
            state = "error"; error = message(disposeFailure);
            throw disposeFailure;
          }
          active = null;
          if (token !== generation || state === "disposed") return;
          // A new service owns a new adapter and Worker; never reuse a failed GPU.
          try {
            active = makeService(mediaPipeDelegates.cpuWasm);
            await active.start(source);
            if (token === generation && state !== "disposed") { selected = true; fallback = true; state = "running"; }
          } catch (cpuFailure) {
            if (token === generation && state !== "disposed") { state = "error"; error = message(cpuFailure); throw cpuFailure; }
          }
        }
      });
    },
    async stop() {
      if (state === "disposed") { await disposal; return; }
      ++generation;
      state = "stopped";
      // Invalidate the active service immediately, before any queued GPU load settles.
      const stopping = active?.stop();
      const draining = enqueue(async () => { if (active && active.running) await active.stop(); });
      await stopping;
      await draining;
    },
    dispose() {
      if (disposal) return disposal;
      ++generation;
      state = "disposed";
      const stopping = active?.stop();
      const draining = enqueue(async () => { if (active) await active.dispose(); });
      disposal = (async () => { await stopping; await draining; })();
      return disposal;
    }
  });
}

function message(failure) {
  return failure instanceof Error ? failure.message.slice(0, 2048) : "Private gameplay CV failed";
}
