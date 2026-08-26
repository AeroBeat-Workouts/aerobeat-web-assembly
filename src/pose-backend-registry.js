// @ts-check

import {
  createMoveNetMockPoseAdapter,
  createMoveNetPoseAdapter,
  createMoveNetWorkerPoseAdapter,
  moveNetLiveSourceId
} from "@aerobeat/web-vendor-movenet";
import {
  createMediaPipePoseAdapter,
  mediaPipeDelegates,
  mediaPipeLiveSourceId
} from "@aerobeat/web-vendor-mediapipe";
import {
  createOnnxRuntimePoseAdapter,
  onnxRuntimeLiveSourceId
} from "@aerobeat/web-vendor-onnxruntime";

/** @typedef {"movenet" | "mediapipe" | "onnxruntime"} PoseBackendId */
/** @typedef {"webgl" | "cpu-wasm" | "gpu-webgl" | "wasm" | "webgpu"} PoseProviderId */
/** @typedef {"standard" | "responsive"} MediaPipeTuningId */

export const defaultPoseBackendId = "movenet";
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
  Object.freeze({ value: "movenet", label: "MoveNet Lightning" }),
  Object.freeze({ value: "mediapipe", label: "MediaPipe Pose Landmarker Lite" }),
  Object.freeze({ value: "onnxruntime", label: "ONNX Runtime RTMPose-t" })
]);

const backendDefinitions = Object.freeze({
  movenet: Object.freeze({
    defaultProviderId: "webgl",
    providers: Object.freeze([
      Object.freeze({ value: "webgl", label: "TensorFlow.js WebGL" })
    ]),
    sourceId: moveNetLiveSourceId
  }),
  mediapipe: Object.freeze({
    defaultProviderId: "cpu-wasm",
    providers: Object.freeze([
      Object.freeze({ value: "cpu-wasm", label: "MediaPipe CPU / WASM" }),
      Object.freeze({ value: "gpu-webgl", label: "MediaPipe GPU / WebGL" })
    ]),
    sourceId: mediaPipeLiveSourceId
  }),
  onnxruntime: Object.freeze({
    defaultProviderId: "wasm",
    providers: Object.freeze([
      Object.freeze({ value: "wasm", label: "ONNX Runtime WASM" }),
      Object.freeze({ value: "webgpu", label: "ONNX Runtime WebGPU" })
    ]),
    sourceId: onnxRuntimeLiveSourceId
  })
});

/**
 * @typedef {Object} PoseSelection
 * @property {string} requestedBackendId Raw requested backend or the default when absent.
 * @property {PoseBackendId} selectedBackendId Supported selected backend.
 * @property {string} requestedProviderId Raw requested provider or the backend default when absent.
 * @property {PoseProviderId} selectedProviderId Supported selected provider.
 * @property {string} requestedMediaPipeTuningId Raw requested tuning or the standard default when absent.
 * @property {MediaPipeTuningId} selectedMediaPipeTuningId Supported MediaPipe tuning selection.
 * @property {boolean} mediaPipeTuningApplicable Whether the selected backend consumes MediaPipe tuning.
 * @property {string | undefined} onnxModelAssetUrl Same-origin ONNX model URL.
 * @property {string | undefined} rejectedOnnxModelUrl Rejected cross-origin or malformed model URL.
 * @property {string | undefined} warning Visible fallback explanation.
 */

/**
 * Resolves stable query policy without loading or exposing a vendor runtime.
 *
 * @param {{ search?: string, origin?: string, baseUrl?: string }} [options]
 * @returns {PoseSelection}
 */
export function resolvePoseSelection(options = {}) {
  const search = options.search ?? globalThis.location?.search ?? "";
  const origin = options.origin ?? globalThis.location?.origin ?? "http://127.0.0.1";
  const baseUrl = options.baseUrl ?? globalThis.document?.baseURI ?? `${origin}/`;
  const params = new URLSearchParams(search);
  const rawBackend = params.get("poseBackend") ?? defaultPoseBackendId;
  const selectedBackendId = isPoseBackendId(rawBackend) ? rawBackend : defaultPoseBackendId;
  const definition = backendDefinitions[selectedBackendId];
  const rawProvider = params.get("poseProvider") ?? definition.defaultProviderId;
  const selectedProviderId = definition.providers.some((option) => option.value === rawProvider)
    ? /** @type {PoseProviderId} */ (rawProvider)
    : /** @type {PoseProviderId} */ (definition.defaultProviderId);
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

  const rawOnnxModelUrl = params.get("onnxModelUrl");
  let onnxModelAssetUrl;
  let rejectedOnnxModelUrl;
  if (rawOnnxModelUrl) {
    try {
      const candidate = new URL(rawOnnxModelUrl, baseUrl);
      if (candidate.origin === origin) {
        onnxModelAssetUrl = candidate.href;
      } else {
        rejectedOnnxModelUrl = rawOnnxModelUrl;
        warnings.push("cross-origin onnxModelUrl rejected; using same-origin default");
      }
    } catch {
      rejectedOnnxModelUrl = rawOnnxModelUrl;
      warnings.push("malformed onnxModelUrl rejected; using same-origin default");
    }
  }
  onnxModelAssetUrl ??= new URL("models/rtmpose-t/end2end.onnx", baseUrl).href;

  return {
    requestedBackendId: rawBackend,
    selectedBackendId,
    requestedProviderId: rawProvider,
    selectedProviderId,
    requestedMediaPipeTuningId: rawMediaPipeTuning,
    selectedMediaPipeTuningId,
    mediaPipeTuningApplicable: selectedBackendId === "mediapipe",
    onnxModelAssetUrl,
    rejectedOnnxModelUrl,
    warning: warnings.length > 0 ? warnings.join("; ") : undefined
  };
}

/**
 * @param {PoseBackendId} backendId
 * @returns {readonly { value: string, label: string }[]}
 */
export function getPoseProviderOptions(backendId) {
  return backendDefinitions[backendId].providers;
}

/**
 * @param {MediaPipeTuningId} tuningId
 * @returns {{ id: MediaPipeTuningId, label: string, minPoseDetectionConfidence: number, minPosePresenceConfidence: number, minTrackingConfidence: number }}
 */
export function getMediaPipeTuningDefinition(tuningId) {
  return mediaPipeTuningDefinitions[tuningId];
}

/**
 * @param {PoseBackendId} backendId
 * @returns {string}
 */
export function getPoseSourceId(backendId) {
  return backendDefinitions[backendId].sourceId;
}

/**
 * @param {PoseBackendId} backendId
 * @returns {boolean}
 */
export function supportsWorkerPerformancePresets(backendId) {
  return backendId === "movenet";
}

/**
 * @param {PoseSelection} selection
 * @param {import("@aerobeat/web-cv").AeroCvPerformancePreset} performancePreset
 * @returns {{ poseAdapter: import("@aerobeat/web-contracts/pose-adapter").AeroPoseAdapter, fallbackPoseAdapter: import("@aerobeat/web-contracts/pose-adapter").AeroPoseAdapter, sourceId: string }}
 */
export function createPoseBackendComposition(selection, performancePreset) {
  const sourceId = getPoseSourceId(selection.selectedBackendId);
  const commonOptions = { sourceId, mirrored: true };
  let poseAdapter;
  if (selection.selectedBackendId === "movenet") {
    poseAdapter = performancePreset.executionPolicy === "worker-experimental"
      ? createMoveNetWorkerPoseAdapter(commonOptions)
      : createMoveNetPoseAdapter(commonOptions);
  } else if (selection.selectedBackendId === "mediapipe") {
    const tuning = getMediaPipeTuningDefinition(selection.selectedMediaPipeTuningId);
    poseAdapter = createMediaPipePoseAdapter({
      ...commonOptions,
      delegate: selection.selectedProviderId === "gpu-webgl"
        ? mediaPipeDelegates.gpuWebgl
        : mediaPipeDelegates.cpuWasm,
      minPoseDetectionConfidence: tuning.minPoseDetectionConfidence,
      minPosePresenceConfidence: tuning.minPosePresenceConfidence,
      minTrackingConfidence: tuning.minTrackingConfidence
    });
  } else {
    poseAdapter = createOnnxRuntimePoseAdapter({
      ...commonOptions,
      executionProvider: selection.selectedProviderId === "webgpu" ? "webgpu" : "wasm",
      fallbackExecutionProvider: null,
      modelAssetUrl: selection.onnxModelAssetUrl
    });
  }
  return {
    poseAdapter,
    fallbackPoseAdapter: createMoveNetMockPoseAdapter(),
    sourceId
  };
}

/**
 * Returns a URL search string synchronized with a selected backend/provider.
 * Unknown unrelated parameters are retained.
 *
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
 * Returns a URL search string synchronized with a MediaPipe tuning selection.
 * Unknown unrelated parameters, including backend/provider, are retained.
 *
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
  return value === "movenet" || value === "mediapipe" || value === "onnxruntime";
}
