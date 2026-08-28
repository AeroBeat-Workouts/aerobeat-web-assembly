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

const base = { search: "" };
const defaults = resolvePoseSelection(base);
assert.deepEqual(
  [defaults.requestedBackendId, defaults.selectedBackendId, defaults.requestedProviderId, defaults.selectedProviderId],
  ["mediapipe", "mediapipe", "gpu-webgl", "gpu-webgl"]
);
assert.equal(defaults.warning, undefined);
assert.equal(defaults.requestedMediaPipeTuningId, "standard");
assert.equal(defaults.selectedMediaPipeTuningId, "standard");
assert.equal(defaults.mediaPipeTuningApplicable, true);
assert.deepEqual(poseBackendOptions.map((option) => option.value), ["mediapipe"]);
assert.deepEqual(getPoseProviderOptions("mediapipe").map((option) => option.value), ["gpu-webgl", "cpu-wasm"]);
assert.deepEqual(mediaPipeTuningOptions.map((option) => option.value), ["standard", "responsive"]);
assert.deepEqual(getMediaPipeTuningDefinition("standard"), {
  id: "standard",
  label: "Standard",
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
});
assert.equal(getPoseSourceId("mediapipe"), "aero.mediapipe.live");

for (const provider of ["gpu-webgl", "cpu-wasm"]) {
  const selection = resolvePoseSelection({ search: `?poseBackend=mediapipe&poseProvider=${provider}` });
  assert.equal(selection.selectedBackendId, "mediapipe");
  assert.equal(selection.selectedProviderId, provider);
  const composition = createPoseBackendComposition(selection, getAeroCvPerformancePreset("full"));
  assert.equal(composition.sourceId, "aero.mediapipe.live");
  assert.equal(composition.poseAdapter.vendorId, "mediapipe");
  assert.equal(composition.fallbackPoseAdapter.vendorId, "aero-cv-replay");
  assert.match(composition.poseAdapter.getExecutionTelemetry?.().detail ?? "", /detection 0\.5.*presence 0\.5.*tracking 0\.5/u);
  await composition.poseAdapter.dispose?.();
  await composition.fallbackPoseAdapter.dispose?.();
}

for (const historicalBackend of ["movenet", "onnxruntime", "invalid"]) {
  const selection = resolvePoseSelection({ search: `?poseBackend=${historicalBackend}&poseProvider=webgpu` });
  assert.equal(selection.requestedBackendId, historicalBackend);
  assert.equal(selection.selectedBackendId, "mediapipe");
  assert.equal(selection.requestedProviderId, "webgpu");
  assert.equal(selection.selectedProviderId, "gpu-webgl");
  assert.match(selection.warning ?? "", new RegExp(`unsupported backend ${historicalBackend}; using mediapipe`, "u"));
  assert.match(selection.warning ?? "", /unsupported provider webgpu for mediapipe; using gpu-webgl/u);
}

const historicalMoveNetProvider = resolvePoseSelection({ search: "?poseBackend=movenet&poseProvider=webgl" });
assert.equal(historicalMoveNetProvider.selectedBackendId, "mediapipe");
assert.equal(historicalMoveNetProvider.selectedProviderId, "gpu-webgl");
assert.match(historicalMoveNetProvider.warning ?? "", /unsupported provider webgl for mediapipe; using gpu-webgl/u);

const responsive = resolvePoseSelection({
  search: "?poseBackend=mediapipe&poseProvider=gpu-webgl&mediaPipeTuning=responsive"
});
assert.equal(responsive.selectedMediaPipeTuningId, "responsive");
const responsiveComposition = createPoseBackendComposition(responsive, getAeroCvPerformancePreset("full"));
assert.match(responsiveComposition.poseAdapter.getExecutionTelemetry?.().detail ?? "", /detection 0\.5.*presence 0\.4.*tracking 0\.3/u);
await responsiveComposition.poseAdapter.dispose?.();
await responsiveComposition.fallbackPoseAdapter.dispose?.();

const invalidTuning = resolvePoseSelection({
  search: "?poseBackend=mediapipe&poseProvider=gpu-webgl&mediaPipeTuning=reckless"
});
assert.equal(invalidTuning.requestedMediaPipeTuningId, "reckless");
assert.equal(invalidTuning.selectedMediaPipeTuningId, "standard");
assert.match(invalidTuning.warning ?? "", /unsupported MediaPipe tuning reckless; using standard/u);

const updatedSearch = updatePoseSelectionSearch("?keep=yes", "mediapipe", "cpu-wasm");
const updatedParams = new URLSearchParams(updatedSearch);
assert.equal(updatedParams.get("keep"), "yes");
assert.equal(updatedParams.get("poseBackend"), "mediapipe");
assert.equal(updatedParams.get("poseProvider"), "cpu-wasm");
const tuningSearch = updateMediaPipeTuningSearch(updatedSearch, "responsive");
assert.equal(new URLSearchParams(tuningSearch).get("mediaPipeTuning"), "responsive");

assert.equal(supportsWorkerPerformancePresets("mediapipe"), true);
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

const workerMediaPipeSelection = resolvePoseSelection({ search: "?poseProvider=cpu-wasm" });
const workerMediaPipeComposition = createPoseBackendComposition(
  workerMediaPipeSelection,
  getAeroCvPerformancePreset("fast")
);
assert.equal(workerMediaPipeComposition.poseAdapter.capabilities.supportsWorker, true);
assert.equal(workerMediaPipeComposition.poseAdapter.capabilities.workerInference, true);
assert.equal(workerMediaPipeComposition.poseAdapter.getExecutionTelemetry?.().location, "worker");
assert.match(workerMediaPipeComposition.poseAdapter.getExecutionStatus?.().detail ?? "", /classic worker/u);
await workerMediaPipeComposition.poseAdapter.dispose?.();
await workerMediaPipeComposition.fallbackPoseAdapter.dispose?.();

const videoFrameMediaPipeComposition = createPoseBackendComposition(
  workerMediaPipeSelection,
  getAeroCvPerformancePreset("experimental-worker-videoframe")
);
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
let selectedGeneration = "initial";
let liveCameraRestartCount = 0;
/** @type {{ reason: string, current: boolean, retired: boolean }[]} */
const switchEvents = [];
const coordinator = createSerializedPoseSwitch(async (context) => {
  const retired = await context.retireOnce(activeService, () => activeService.dispose());
  switchEvents.push({ reason: context.reason, current: context.isCurrent(), retired });
  if (!context.isCurrent()) {
    return;
  }
  selectedGeneration = context.reason;
  activeService = { disposeCount: 0, async dispose() { this.disposeCount += 1; } };
  if (context.consumeRestartRequest()) {
    liveCameraRestartCount += 1;
  }
});
const firstSwitch = coordinator.request("provider-cpu", true);
await firstDisposeStarted;
const winningSwitch = coordinator.request("provider-gpu", false);
releaseFirstDispose();
await Promise.all([firstSwitch, winningSwitch]);
assert.deepEqual(switchEvents, [
  { reason: "provider-cpu", current: false, retired: true },
  { reason: "provider-gpu", current: true, retired: false }
]);
assert.equal(originalService.disposeCount, 1);
assert.equal(selectedGeneration, "provider-gpu");
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

console.log("MediaPipe-only pose backend registry validation passed.");
