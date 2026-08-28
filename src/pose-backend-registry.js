// @ts-check

import { createAeroCvMockPoseAdapter } from "@aerobeat/web-cv";
import {
  createMediaPipePoseAdapter,
  createMediaPipeWorkerPoseAdapter,
  mediaPipeDelegates,
  mediaPipeLiveSourceId
} from "@aerobeat/web-vendor-mediapipe";

/** @typedef {"mediapipe"} PoseBackendId */
/** @typedef {"gpu-webgl" | "cpu-wasm"} PoseProviderId */
/** @typedef {"standard" | "responsive"} MediaPipeTuningId */

export const defaultPoseBackendId = "mediapipe";
export const defaultPoseProviderId = "gpu-webgl";
export const defaultMediaPipeTuningId = "standard";

export const mediaPipeTuningOptions = Object.freeze([
  Object.freeze({ value: "standard", label: "Standard (0.5 / 0.5 / 0.5)" }),
  Object.freeze({ value: "responsive", label: "Responsive A/B (0.5 / 0.4 / 0.3)" })
]);

const mediaPipeTuningDefinitions = Object.freeze({
  standard: Object.freeze({
    id: "standard",
    label: "Standard",
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  }),
  responsive: Object.freeze({
    id: "responsive",
    label: "Responsive A/B",
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.3
  })
});

export const poseBackendOptions = Object.freeze([
  Object.freeze({ value: "mediapipe", label: "MediaPipe Pose Landmarker Lite" })
]);

const mediaPipeProviderOptions = Object.freeze([
  Object.freeze({ value: "gpu-webgl", label: "MediaPipe GPU / WebGL" }),
  Object.freeze({ value: "cpu-wasm", label: "MediaPipe CPU / WASM (diagnostic)" })
]);

/**
 * @typedef {Object} PoseSelection
 * @property {string} requestedBackendId Raw requested backend or the locked default when absent.
 * @property {PoseBackendId} selectedBackendId Locked supported backend.
 * @property {string} requestedProviderId Raw requested provider or the locked default when absent.
 * @property {PoseProviderId} selectedProviderId Supported same-vendor provider.
 * @property {string} requestedMediaPipeTuningId Raw requested tuning or standard when absent.
 * @property {MediaPipeTuningId} selectedMediaPipeTuningId Supported MediaPipe tuning selection.
 * @property {true} mediaPipeTuningApplicable MediaPipe tuning is always applicable.
 * @property {string | undefined} warning Visible normalization explanation.
 */

/**
 * Resolves the locked MediaPipe-only query policy. Historical backend/provider
 * values remain visible in requested telemetry while selection normalizes to
 * MediaPipe GPU-WebGL.
 *
 * @param {{ search?: string }} [options]
 * @returns {PoseSelection}
 */
export function resolvePoseSelection(options = {}) {
  const search = options.search ?? globalThis.location?.search ?? "";
  const params = new URLSearchParams(search);
  const rawBackend = params.get("poseBackend") ?? defaultPoseBackendId;
  const selectedBackendId = defaultPoseBackendId;
  const rawProvider = params.get("poseProvider") ?? defaultPoseProviderId;
  const selectedProviderId = mediaPipeProviderOptions.some((option) => option.value === rawProvider)
    ? /** @type {PoseProviderId} */ (rawProvider)
    : defaultPoseProviderId;
  const warnings = [];
  if (rawBackend !== selectedBackendId) {
    warnings.push(`unsupported backend ${rawBackend}; using ${selectedBackendId}`);
  }
  if (rawProvider !== selectedProviderId) {
    warnings.push(`unsupported provider ${rawProvider} for ${selectedBackendId}; using ${selectedProviderId}`);
  }
  const rawMediaPipeTuning = params.get("mediaPipeTuning") ?? defaultMediaPipeTuningId;
  const selectedMediaPipeTuningId = isMediaPipeTuningId(rawMediaPipeTuning)
    ? rawMediaPipeTuning
    : defaultMediaPipeTuningId;
  if (rawMediaPipeTuning !== selectedMediaPipeTuningId) {
    warnings.push(`unsupported MediaPipe tuning ${rawMediaPipeTuning}; using ${selectedMediaPipeTuningId}`);
  }

  return {
    requestedBackendId: rawBackend,
    selectedBackendId,
    requestedProviderId: rawProvider,
    selectedProviderId,
    requestedMediaPipeTuningId: rawMediaPipeTuning,
    selectedMediaPipeTuningId,
    mediaPipeTuningApplicable: true,
    warning: warnings.length > 0 ? warnings.join("; ") : undefined
  };
}

/**
 * @param {PoseBackendId} _backendId
 * @returns {readonly { value: string, label: string }[]}
 */
export function getPoseProviderOptions(_backendId) {
  return mediaPipeProviderOptions;
}

/**
 * @param {MediaPipeTuningId} tuningId
 * @returns {{ id: MediaPipeTuningId, label: string, minPoseDetectionConfidence: number, minPosePresenceConfidence: number, minTrackingConfidence: number }}
 */
export function getMediaPipeTuningDefinition(tuningId) {
  return mediaPipeTuningDefinitions[tuningId];
}

/**
 * @param {PoseBackendId} _backendId
 * @returns {string}
 */
export function getPoseSourceId(_backendId) {
  return mediaPipeLiveSourceId;
}

/**
 * @param {PoseBackendId} backendId
 * @returns {boolean}
 */
export function supportsWorkerPerformancePresets(backendId) {
  return backendId === "mediapipe";
}

/**
 * Requires every primitive used by the exact-presentation-time VideoFrame lane.
 *
 * @param {object} [environment]
 * @returns {boolean}
 */
export function supportsMediaPipeVideoFrameWorkerPreset(environment = globalThis) {
  const VideoFrameConstructor = Reflect.get(environment, "VideoFrame");
  const HtmlVideoElementConstructor = Reflect.get(environment, "HTMLVideoElement");
  if (typeof VideoFrameConstructor !== "function" || typeof HtmlVideoElementConstructor !== "function") {
    return false;
  }
  const prototype = Reflect.get(HtmlVideoElementConstructor, "prototype");
  return Boolean(prototype)
    && typeof Reflect.get(prototype, "requestVideoFrameCallback") === "function"
    && typeof Reflect.get(prototype, "cancelVideoFrameCallback") === "function";
}

/**
 * @param {PoseSelection} selection
 * @param {import("@aerobeat/web-cv").AeroCvPerformancePreset} performancePreset
 * @returns {{ poseAdapter: import("@aerobeat/web-contracts/pose-adapter").AeroPoseAdapter, fallbackPoseAdapter: import("@aerobeat/web-contracts/pose-adapter").AeroPoseAdapter, sourceId: string }}
 */
export function createPoseBackendComposition(selection, performancePreset) {
  const sourceId = mediaPipeLiveSourceId;
  const tuning = getMediaPipeTuningDefinition(selection.selectedMediaPipeTuningId);
  const mediaPipeOptions = {
    sourceId,
    mirrored: true,
    delegate: selection.selectedProviderId === "gpu-webgl"
      ? mediaPipeDelegates.gpuWebgl
      : mediaPipeDelegates.cpuWasm,
    minPoseDetectionConfidence: tuning.minPoseDetectionConfidence,
    minPosePresenceConfidence: tuning.minPosePresenceConfidence,
    minTrackingConfidence: tuning.minTrackingConfidence
  };
  const poseAdapter = performancePreset.executionPolicy !== "main-thread"
    ? createMediaPipeWorkerPoseAdapter(mediaPipeOptions)
    : createMediaPipePoseAdapter(mediaPipeOptions);
  return {
    poseAdapter,
    fallbackPoseAdapter: createAeroCvMockPoseAdapter(),
    sourceId
  };
}

/**
 * @param {string} search
 * @param {PoseBackendId} backendId
 * @param {PoseProviderId} providerId
 * @returns {string}
 */
export function updatePoseSelectionSearch(search, backendId, providerId) {
  const params = new URLSearchParams(search);
  params.set("poseBackend", backendId);
  params.set("poseProvider", providerId);
  return `?${params.toString()}`;
}

/**
 * @param {string} search
 * @param {MediaPipeTuningId} tuningId
 * @returns {string}
 */
export function updateMediaPipeTuningSearch(search, tuningId) {
  const params = new URLSearchParams(search);
  params.set("mediaPipeTuning", tuningId);
  return `?${params.toString()}`;
}

/**
 * @param {unknown} value
 * @returns {value is MediaPipeTuningId}
 */
export function isMediaPipeTuningId(value) {
  return value === "standard" || value === "responsive";
}

/**
 * @param {unknown} value
 * @returns {value is PoseBackendId}
 */
export function isPoseBackendId(value) {
  return value === "mediapipe";
}
