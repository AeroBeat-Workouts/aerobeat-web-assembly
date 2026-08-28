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
import {
  createPredictivePoseLinearOracleTrace,
  createPredictivePoseOracleTrace
} from "../src/predictive-pose-oracle-fixture.js";
import { evaluateHeldOutPoseTrace } from "@aerobeat/web-input";

assert.deepEqual(poseGameplaySourceOptions.map((option) => option.value), ["measured", "measured-8", "predicted-8"]);
assert.equal(isPoseGameplaySourceId("predicted-8"), true);
assert.equal(isPoseGameplaySourceId("invalid"), false);
assert.equal(supportsExperimentalPoseGameplaySource("mediapipe", "full"), true);
assert.equal(supportsExperimentalPoseGameplaySource("unsupported", "full"), false);
assert.equal(supportsExperimentalPoseGameplaySource("mediapipe", "direct-192"), false);
assert.equal(measuredSubmissionCadenceFps("measured"), 15);
assert.equal(measuredSubmissionCadenceFps("measured-8"), 8);
assert.equal(measuredSubmissionCadenceFps("predicted-8"), 8);

const defaults = resolvePoseGameplaySource({
  search: "",
  backendId: "mediapipe",
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
  backendId: "unsupported",
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

const linearOracle = evaluateHeldOutPoseTrace(createPredictivePoseLinearOracleTrace());
assert.equal(linearOracle.predictionImprovesControl, true, "constant velocity prediction must beat measured-8 hold");
assert.ok((linearOracle.treatmentMinusControl.landmarkMeanErrorReductionRatio ?? 0) > 0.7);
assert.ok((linearOracle.treatmentMinusControl.intentF1 ?? 0) >= linearOracle.thresholds.minimumIntentF1Delta);
assert.equal(linearOracle.treatment.emittedEventCount, linearOracle.control.emittedEventCount, "positive control must not win by emitting fewer events");
assert.equal(linearOracle.recommendation, "prediction-improves-control");

const oracle = evaluateHeldOutPoseTrace(trace);
assert.equal(oracle.referenceFrameCount, 61);
assert.equal(oracle.measuredFrameCount, 13);
assert.equal(oracle.heldOutFrameCount, 48);
assert.equal(oracle.heldOutPredictionCount, 32);
assert.equal(oracle.suppressedPredictionCount, 16, "reversal/occlusion/re-entry must suppress stale predictions");
assert.equal(oracle.treatmentPredictionCoverage, 2 / 3);
assert.ok(Math.abs((oracle.control.landmarkErrorMean ?? 0) - 0.05031152949374531) < 1e-12);
assert.ok(Math.abs((oracle.treatment.landmarkErrorMean ?? 0) - 0.03354101966249688) < 1e-12);
assert.ok(Math.abs((oracle.treatmentMinusControl.landmarkMeanErrorReductionRatio ?? 0) - (1 / 3)) < 1e-12);
assert.ok(Math.abs((oracle.control.intentRecall ?? 0) - 0.19607843137254902) < 1e-12);
assert.ok(Math.abs((oracle.treatment.intentRecall ?? 0) - 0.27450980392156865) < 1e-12);
assert.ok(Math.abs((oracle.treatment.intentF1 ?? 0) - 0.4097560975609756) < 1e-12);
assert.ok((oracle.treatment.intentRecall ?? 1) < oracle.thresholds.minimumTreatmentIntentRecall, "suppression lane recall must fail the declared floor truthfully");
assert.ok((oracle.treatment.landmarkErrorP95 ?? 0) > (oracle.control.landmarkErrorP95 ?? 1), "reversal/occlusion tail error must remain visible");
assert.ok((oracle.treatment.transitionTimingMeanErrorMs ?? 0) > oracle.thresholds.maximumTreatmentTransitionTimingMeanErrorMs);
assert.equal(oracle.control.falseRepeatedEventCount, 0);
assert.equal(oracle.treatment.falseRepeatedEventCount, 0, "stateful treatment route must not repeat one-shot lineages");
assert.ok(oracle.treatment.emittedEventCount >= oracle.control.emittedEventCount, "treatment precision must not improve by emitting fewer events");
assert.equal(oracle.predictionImprovesControl, false);
assert.equal(oracle.recommendation, "prediction-does-not-improve-control");

console.log("Pose gameplay source validation passed.");
