// @ts-check

import assert from "node:assert/strict";
import { getAeroCvPerformancePreset } from "@aerobeat/web-cv";
import {
  createPoseBackendComposition,
  getPoseProviderOptions,
  getPoseSourceId,
  poseBackendOptions,
  resolvePoseSelection,
  supportsWorkerPerformancePresets,
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
assert.equal(defaults.onnxModelAssetUrl, "https://aerobeat.example/checkpoint/models/rtmpose-t/end2end.onnx");
assert.deepEqual(poseBackendOptions.map((option) => option.value), ["movenet", "mediapipe", "onnxruntime"]);

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

assert.deepEqual(getPoseProviderOptions("movenet").map((option) => option.value), ["webgl"]);
assert.deepEqual(getPoseProviderOptions("mediapipe").map((option) => option.value), ["cpu-wasm", "gpu-webgl"]);
assert.deepEqual(getPoseProviderOptions("onnxruntime").map((option) => option.value), ["wasm", "webgpu"]);
assert.equal(supportsWorkerPerformancePresets("movenet"), true);
assert.equal(supportsWorkerPerformancePresets("mediapipe"), false);
assert.equal(supportsWorkerPerformancePresets("onnxruntime"), false);

let releaseFirstDispose = () => {};
const firstDisposeGate = new Promise((resolve) => {
  releaseFirstDispose = resolve;
});
/** @type {{ reason: string, current: boolean, restart: boolean | undefined }[]} */
const switchEvents = [];
const coordinator = createSerializedPoseSwitch(async (context) => {
  const event = { reason: context.reason, current: context.isCurrent(), restart: undefined };
  switchEvents.push(event);
  if (context.reason === "first") {
    await firstDisposeGate;
    event.current = context.isCurrent();
  }
  if (context.isCurrent()) {
    event.restart = context.consumeRestartRequest();
  }
});
const firstSwitch = coordinator.request("first", true);
await new Promise((resolve) => setImmediate(resolve));
const winningSwitch = coordinator.request("second", false);
releaseFirstDispose();
await Promise.all([firstSwitch, winningSwitch]);
assert.deepEqual(switchEvents, [
  { reason: "first", current: false, restart: undefined },
  { reason: "second", current: true, restart: true }
]);
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
assert.equal(await recoveringCoordinator.settled(), undefined);
await recoveringCoordinator.request("recovers", false);
assert.deepEqual(recoveryEvents, ["fails", "recovers"]);

console.log("Pose backend registry validation passed.");
