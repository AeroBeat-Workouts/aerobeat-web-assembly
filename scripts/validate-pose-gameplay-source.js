// @ts-check

import assert from "node:assert/strict";
import {
  isPoseGameplaySourceId,
  measuredSubmissionCadenceFps,
  poseGameplaySourceOptions,
  resolvePoseGameplaySource,
  supportsExperimentalPoseGameplaySource,
  updatePoseGameplaySourceSearch
} from "../src/pose-gameplay-source.js";
import { createPredictivePoseOracleTrace } from "../src/predictive-pose-oracle-fixture.js";
import { evaluateHeldOutPoseTrace } from "@aerobeat/web-input";

assert.deepEqual(poseGameplaySourceOptions.map((option) => option.value), ["measured", "measured-8", "predicted-8"]);
assert.equal(isPoseGameplaySourceId("predicted-8"), true);
assert.equal(isPoseGameplaySourceId("invalid"), false);
assert.equal(supportsExperimentalPoseGameplaySource("mediapipe", "full"), true);
assert.equal(supportsExperimentalPoseGameplaySource("movenet", "full"), false);
assert.equal(supportsExperimentalPoseGameplaySource("mediapipe", "direct-192"), false);
assert.equal(measuredSubmissionCadenceFps("measured"), 15);
assert.equal(measuredSubmissionCadenceFps("measured-8"), 8);
assert.equal(measuredSubmissionCadenceFps("predicted-8"), 8);

const defaults = resolvePoseGameplaySource({
  search: "?poseBackend=movenet",
  backendId: "movenet",
  performancePresetId: "full"
});
assert.deepEqual([defaults.requestedId, defaults.selectedId, defaults.effectiveId], ["measured", "measured", "measured"]);

const predicted = resolvePoseGameplaySource({
  search: "?poseGameplaySource=predicted-8",
  backendId: "mediapipe",
  performancePresetId: "full"
});
assert.deepEqual([predicted.requestedId, predicted.selectedId, predicted.effectiveId, predicted.warning], [
  "predicted-8", "predicted-8", "predicted-8", undefined
]);

const incompatible = resolvePoseGameplaySource({
  search: "?poseGameplaySource=predicted-8",
  backendId: "movenet",
  performancePresetId: "full"
});
assert.equal(incompatible.requestedId, "predicted-8");
assert.equal(incompatible.selectedId, "measured");
assert.ok(incompatible.warning?.includes("requires MediaPipe Direct full"));

const invalid = resolvePoseGameplaySource({
  search: "?poseGameplaySource=future",
  backendId: "mediapipe",
  performancePresetId: "full"
});
assert.equal(invalid.selectedId, "measured");
assert.ok(invalid.warning?.includes("unsupported"));

assert.equal(
  updatePoseGameplaySourceSearch("?poseBackend=mediapipe&poseGameplaySource=measured&poseProvider=gpu-webgl", "measured-8"),
  "?poseBackend=mediapipe&poseGameplaySource=measured-8&poseProvider=gpu-webgl"
);
assert.equal(
  resolvePoseGameplaySource({
    search: "?poseGameplaySource=measured-8",
    backendId: "mediapipe",
    performancePresetId: "direct-192"
  }).selectedId,
  "measured",
  "downscale presets must truthfully filter experimental gameplay sources"
);

const trace = createPredictivePoseOracleTrace();
const reversalPeak = trace[20];
const reversalNext = trace[21];
const occluded = trace[45];
const reentered = trace[46];
assert.ok((reversalPeak?.landmarks[0]?.x ?? 0) > (reversalNext?.landmarks[0]?.x ?? 1));
assert.ok((reversalNext?.landmarks[0]?.confidence ?? 0) >= 0.9, "reversal evidence must remain visible");
assert.ok((occluded?.landmarks[0]?.confidence ?? 1) < 0.5, "occlusion must be independently exercised");
assert.ok((reentered?.landmarks[0]?.confidence ?? 0) >= 0.9, "re-entry must restore visible landmarks");
assert.ok((occluded?.timestampMs ?? 0) > (reversalNext?.timestampMs ?? 0));

const oracle = evaluateHeldOutPoseTrace(trace);
assert.equal(oracle.referenceFrameCount, 61);
assert.ok(oracle.measuredFrameCount > 0);
assert.ok(oracle.heldOutPredictionCount > 0);
assert.ok((oracle.normalizedMaxJointError ?? 1) <= 0.2);
assert.ok((oracle.bodyGridCellAgreement ?? 0) >= 0.8);
assert.ok((oracle.intentPrecision ?? -1) >= 0 && (oracle.intentPrecision ?? 2) <= 1);
assert.ok((oracle.intentRecall ?? -1) >= 0 && (oracle.intentRecall ?? 2) <= 1);
assert.equal(oracle.falseRepeatedEventCount, 0, "stateful treatment route must not repeat one-shot lineages");
assert.ok(oracle.suppressedPredictionCount > 0, "occlusion/re-entry must suppress stale predictions");

console.log("Pose gameplay source validation passed.");
