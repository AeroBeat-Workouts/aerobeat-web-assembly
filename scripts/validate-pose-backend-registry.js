// @ts-check

import assert from "node:assert/strict";
import { getAeroCvPerformancePreset } from "@aerobeat/web-cv";
import {
  createPoseBackendComposition,
  getMediaPipeTuningDefinition,
  getPoseProviderOptions,
  getPoseSourceId,
  mediaPipeTuningOptions,
  poseBackendOptions,
  resolvePoseSelection,
  supportsMediaPipeVideoFrameWorkerPreset,
  supportsWorkerPerformancePresets,
  updateMediaPipeTuningSearch,
  updatePoseSelectionSearch
} from "../src/pose-backend-registry.js";
import { createSerializedPoseSwitch } from "../src/serialized-pose-switch.js";

const base = {
  origin: "https://aerobeat.example",
  baseUrl: "https://aerobeat.example/checkpoint/"
};

const defaults = resolvePoseSelection(base);
assert.deepEqual(
  [defaults.requestedBackendId, defaults.selectedBackendId, defaults.requestedProviderId, defaults.selectedProviderId],
  ["movenet", "movenet", "webgl", "webgl"]
);
assert.equal(defaults.warning, undefined);
assert.equal(defaults.requestedMediaPipeTuningId, "standard");
assert.equal(defaults.selectedMediaPipeTuningId, "standard");
assert.equal(defaults.mediaPipeTuningApplicable, false);
assert.equal(defaults.onnxModelAssetUrl, "https://aerobeat.example/checkpoint/models/rtmpose-t/end2end.onnx");
assert.deepEqual(poseBackendOptions.map((option) => option.value), ["movenet", "mediapipe", "onnxruntime"]);
assert.deepEqual(mediaPipeTuningOptions.map((option) => option.value), ["standard", "responsive"]);
assert.deepEqual(getMediaPipeTuningDefinition("standard"), {
  id: "standard",
  label: "Standard",
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
});

for (const [backend, provider, source] of [
  ["movenet", "webgl", "aero.movenet.live"],
  ["mediapipe", "cpu-wasm", "aero.mediapipe.live"],
  ["mediapipe", "gpu-webgl", "aero.mediapipe.live"],
  ["onnxruntime", "wasm", "aero.onnxruntime.rtmpose.live"],
  ["onnxruntime", "webgpu", "aero.onnxruntime.rtmpose.live"]
]) {
  const selection = resolvePoseSelection({ ...base, search: `?poseBackend=${backend}&poseProvider=${provider}` });
  assert.equal(selection.selectedBackendId, backend);
  assert.equal(selection.selectedProviderId, provider);
  assert.equal(getPoseSourceId(selection.selectedBackendId), source);
  const composition = createPoseBackendComposition(selection, getAeroCvPerformancePreset("full"));
  assert.equal(composition.sourceId, source);
  assert.equal(composition.poseAdapter.vendorId, backend === "onnxruntime" ? "onnxruntime" : backend);
  assert.equal(composition.fallbackPoseAdapter.vendorId, "movenet");
  if (backend === "mediapipe") {
    assert.match(composition.poseAdapter.getExecutionTelemetry?.().detail ?? "", /detection 0\.5.*presence 0\.5.*tracking 0\.5/u);
  }
  await composition.poseAdapter.dispose?.();
  await composition.fallbackPoseAdapter.dispose?.();
}

const invalid = resolvePoseSelection({ ...base, search: "?poseBackend=nope&poseProvider=webgpu" });
assert.equal(invalid.requestedBackendId, "nope");
assert.equal(invalid.selectedBackendId, "movenet");
assert.equal(invalid.requestedProviderId, "webgpu");
assert.equal(invalid.selectedProviderId, "webgl");
assert.match(invalid.warning ?? "", /unsupported backend nope/u);
assert.match(invalid.warning ?? "", /unsupported provider webgpu/u);

const wrongProvider = resolvePoseSelection({ ...base, search: "?poseBackend=mediapipe&poseProvider=webgpu" });
assert.equal(wrongProvider.selectedProviderId, "cpu-wasm");
assert.match(wrongProvider.warning ?? "", /unsupported provider webgpu/u);

const responsive = resolvePoseSelection({
  ...base,
  search: "?poseBackend=mediapipe&poseProvider=gpu-webgl&mediaPipeTuning=responsive"
});
assert.equal(responsive.requestedMediaPipeTuningId, "responsive");
assert.equal(responsive.selectedMediaPipeTuningId, "responsive");
assert.equal(responsive.mediaPipeTuningApplicable, true);
const responsiveComposition = createPoseBackendComposition(responsive, getAeroCvPerformancePreset("full"));
assert.match(responsiveComposition.poseAdapter.getExecutionTelemetry?.().detail ?? "", /detection 0\.5.*presence 0\.4.*tracking 0\.3/u);
await responsiveComposition.poseAdapter.dispose?.();
await responsiveComposition.fallbackPoseAdapter.dispose?.();

const invalidTuning = resolvePoseSelection({
  ...base,
  search: "?poseBackend=mediapipe&poseProvider=gpu-webgl&mediaPipeTuning=reckless"
});
assert.equal(invalidTuning.requestedMediaPipeTuningId, "reckless");
assert.equal(invalidTuning.selectedMediaPipeTuningId, "standard");
assert.equal(invalidTuning.mediaPipeTuningApplicable, true);
assert.match(invalidTuning.warning ?? "", /unsupported MediaPipe tuning reckless; using standard/u);

const retainedNonMediaPipeTuning = resolvePoseSelection({
  ...base,
  search: "?poseBackend=movenet&poseProvider=webgl&mediaPipeTuning=responsive"
});
assert.equal(retainedNonMediaPipeTuning.selectedMediaPipeTuningId, "responsive");
assert.equal(retainedNonMediaPipeTuning.mediaPipeTuningApplicable, false);
assert.equal(retainedNonMediaPipeTuning.warning, undefined);

const sameOriginModel = resolvePoseSelection({
  ...base,
  search: "?poseBackend=onnxruntime&poseProvider=wasm&onnxModelUrl=%2Fprivate%2Frtmpose.onnx"
});
assert.equal(sameOriginModel.onnxModelAssetUrl, "https://aerobeat.example/private/rtmpose.onnx");
assert.equal(sameOriginModel.rejectedOnnxModelUrl, undefined);

const crossOriginModel = resolvePoseSelection({
  ...base,
  search: "?poseBackend=onnxruntime&onnxModelUrl=https%3A%2F%2Fdownload.openmmlab.com%2Fmodel.onnx"
});
assert.equal(crossOriginModel.rejectedOnnxModelUrl, "https://download.openmmlab.com/model.onnx");
assert.equal(crossOriginModel.onnxModelAssetUrl, defaults.onnxModelAssetUrl);
assert.match(crossOriginModel.warning ?? "", /cross-origin onnxModelUrl rejected/u);

const updatedSearch = updatePoseSelectionSearch("?keep=yes&onnxModelUrl=%2Fmodel.onnx", "onnxruntime", "webgpu");
const updatedParams = new URLSearchParams(updatedSearch);
assert.equal(updatedParams.get("keep"), "yes");
assert.equal(updatedParams.get("onnxModelUrl"), "/model.onnx");
assert.equal(updatedParams.get("poseBackend"), "onnxruntime");
assert.equal(updatedParams.get("poseProvider"), "webgpu");

const tuningSearch = updateMediaPipeTuningSearch(updatedSearch, "responsive");
const tuningParams = new URLSearchParams(tuningSearch);
assert.equal(tuningParams.get("keep"), "yes");
assert.equal(tuningParams.get("onnxModelUrl"), "/model.onnx");
assert.equal(tuningParams.get("poseBackend"), "onnxruntime");
assert.equal(tuningParams.get("poseProvider"), "webgpu");
assert.equal(tuningParams.get("mediaPipeTuning"), "responsive");

assert.deepEqual(getPoseProviderOptions("movenet").map((option) => option.value), ["webgl"]);
assert.deepEqual(getPoseProviderOptions("mediapipe").map((option) => option.value), ["cpu-wasm", "gpu-webgl"]);
assert.deepEqual(getPoseProviderOptions("onnxruntime").map((option) => option.value), ["wasm", "webgpu"]);
assert.equal(supportsWorkerPerformancePresets("movenet"), true);
assert.equal(supportsWorkerPerformancePresets("mediapipe"), true);
assert.equal(supportsWorkerPerformancePresets("onnxruntime"), false);
class FakeVideoFrame {}
class FakeVideoElementWithRvfc {
  requestVideoFrameCallback() { return 1; }
  cancelVideoFrameCallback() {}
}
class FakeVideoElementWithoutRvfc {}
assert.equal(supportsMediaPipeVideoFrameWorkerPreset({
  VideoFrame: FakeVideoFrame,
  HTMLVideoElement: FakeVideoElementWithRvfc
}), true);
assert.equal(supportsMediaPipeVideoFrameWorkerPreset({
  VideoFrame: FakeVideoFrame,
  HTMLVideoElement: FakeVideoElementWithoutRvfc
}), false);
assert.equal(supportsMediaPipeVideoFrameWorkerPreset({
  HTMLVideoElement: FakeVideoElementWithRvfc
}), false);

const workerMediaPipeSelection = resolvePoseSelection({
  ...base,
  search: "?poseBackend=mediapipe&poseProvider=cpu-wasm"
});
const workerMediaPipeComposition = createPoseBackendComposition(
  workerMediaPipeSelection,
  getAeroCvPerformancePreset("fast")
);
assert.equal(workerMediaPipeComposition.poseAdapter.capabilities.supportsWorker, true);
assert.equal(workerMediaPipeComposition.poseAdapter.capabilities.workerInference, true);
assert.equal(workerMediaPipeComposition.poseAdapter.getExecutionTelemetry?.().location, "worker");
assert.equal(workerMediaPipeComposition.poseAdapter.getExecutionTelemetry?.().provider, undefined);
assert.match(workerMediaPipeComposition.poseAdapter.getExecutionStatus?.().detail ?? "", /classic worker/u);
await workerMediaPipeComposition.poseAdapter.dispose?.();
await workerMediaPipeComposition.fallbackPoseAdapter.dispose?.();

const videoFrameMediaPipeComposition = createPoseBackendComposition(
  workerMediaPipeSelection,
  getAeroCvPerformancePreset("experimental-worker-videoframe")
);
assert.equal(videoFrameMediaPipeComposition.poseAdapter.capabilities.supportsWorker, true);
assert.deepEqual(videoFrameMediaPipeComposition.poseAdapter.capabilities.transferableFrameTypes, ["ImageBitmap", "VideoFrame"]);
await videoFrameMediaPipeComposition.poseAdapter.dispose?.();
await videoFrameMediaPipeComposition.fallbackPoseAdapter.dispose?.();

let releaseFirstDispose = () => {};
let signalFirstDisposeStarted = () => {};
const firstDisposeGate = new Promise((resolve) => {
  releaseFirstDispose = resolve;
});
const firstDisposeStarted = new Promise((resolve) => {
  signalFirstDisposeStarted = resolve;
});
const originalService = {
  disposeCount: 0,
  async dispose() {
    this.disposeCount += 1;
    signalFirstDisposeStarted();
    await firstDisposeGate;
  }
};
let activeService = originalService;
let selectedBackend = "movenet";
let liveCameraRestartCount = 0;
/** @type {{ reason: string, current: boolean, retired: boolean }[]} */
const switchEvents = [];
const coordinator = createSerializedPoseSwitch(async (context) => {
  const retired = await context.retireOnce(activeService, () => activeService.dispose());
  switchEvents.push({ reason: context.reason, current: context.isCurrent(), retired });
  if (!context.isCurrent()) {
    return;
  }
  selectedBackend = context.reason;
  activeService = { disposeCount: 0, async dispose() { this.disposeCount += 1; } };
  if (context.consumeRestartRequest()) {
    liveCameraRestartCount += 1;
  }
});
const firstSwitch = coordinator.request("mediapipe", true);
await firstDisposeStarted;
const winningSwitch = coordinator.request("onnxruntime", false);
releaseFirstDispose();
await Promise.all([firstSwitch, winningSwitch]);
assert.deepEqual(switchEvents, [
  { reason: "mediapipe", current: false, retired: true },
  { reason: "onnxruntime", current: true, retired: false }
]);
assert.equal(originalService.disposeCount, 1);
assert.equal(selectedBackend, "onnxruntime");
assert.equal(liveCameraRestartCount, 1);
assert.equal(await coordinator.settled(), undefined);

const recoveryEvents = [];
const recoveringCoordinator = createSerializedPoseSwitch(async (context) => {
  recoveryEvents.push(context.reason);
  if (context.reason === "fails") {
    throw new Error("intentional switch failure");
  }
});
await assert.rejects(
  () => recoveringCoordinator.request("fails", false),
  /intentional switch failure/u
);
assert.equal(recoveringCoordinator.currentGeneration(), 1);
assert.equal(await recoveringCoordinator.settled(), undefined);
await recoveringCoordinator.request("recovers", false);
assert.equal(recoveringCoordinator.currentGeneration(), 2);
assert.deepEqual(recoveryEvents, ["fails", "recovers"]);

console.log("Pose backend registry validation passed.");
