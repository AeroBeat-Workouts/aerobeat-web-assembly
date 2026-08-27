// @ts-check

import assert from "node:assert/strict";
import { createPredictivePoseRoutingCoordinator } from "../src/predictive-pose-routing-coordinator.js";

const landmarkNames = [
  "nose",
  "left_wrist",
  "left_elbow",
  "left_shoulder",
  "right_shoulder",
  "right_elbow",
  "right_wrist"
];

/**
 * @param {number} timestampMs
 * @param {number} xOffset
 * @param {{ sourceId?: string, mirrored?: boolean, confidence?: number }} [options]
 * @returns {import("@aerobeat/web-contracts").NormalizedPoseFrame}
 */
function frame(timestampMs, xOffset, options = {}) {
  return {
    sourceId: options.sourceId ?? "aero.routing.test",
    timestampMs,
    mirrored: options.mirrored ?? true,
    landmarks: landmarkNames.map((name, index) => ({
      name,
      x: 0.2 + xOffset + index * 0.01,
      y: 0.25 + xOffset * 0.5 + index * 0.01,
      confidence: options.confidence ?? 0.95
    }))
  };
}

const coordinator = createPredictivePoseRoutingCoordinator({ epochPrefix: "test-route" });
const initialEpoch = coordinator.getLifecycleEpoch();

const first = coordinator.routeMeasuredFrame(frame(0, 0));
assert.equal(first.outcome, "measured");
assert.equal(first.sample?.provenance, "measured");
assert.equal(first.sample?.routeEpoch.startsWith(initialEpoch), true);
assert.deepEqual(new Set(first.events.map((event) => event.mode)), new Set(["boxing", "flow"]));
assert.equal(coordinator.getStatus().measuredRoutedSampleCount, 1);
assert.equal(coordinator.getStatus().input.measuredSampleCount, 1, "one measured frame must count once across Boxing and Flow");

const duplicateMeasurement = coordinator.routeMeasuredFrame(frame(0, 0));
assert.equal(duplicateMeasurement.outcome, "duplicate-measurement");
assert.equal(duplicateMeasurement.events.length, 0);
assert.equal(coordinator.getStatus().input.measuredSampleCount, 1);

const second = coordinator.routeMeasuredFrame(frame(100, 0.04));
assert.equal(second.outcome, "measured");
assert.equal(coordinator.getStatus().input.measuredSampleCount, 2);

const predicted = coordinator.routePrediction(110, initialEpoch);
assert.equal(predicted.outcome, "predicted");
assert.equal(predicted.sample?.provenance, "predicted");
assert.equal(predicted.sample?.targetTimestampMs, 110);
assert.equal(coordinator.getStatus().input.predictedSampleCount, 1, "one prediction must count once across Boxing and Flow");

const routedBeforeCorrections = coordinator.getStatus();
const equalTargetCorrection = coordinator.routeMeasuredFrame(frame(110, 0.05));
assert.equal(equalTargetCorrection.outcome, "measurement-update");
assert.equal(equalTargetCorrection.sample, undefined);
assert.equal(equalTargetCorrection.events.length, 0);
assert.equal(coordinator.getStatus().predictor.measuredSampleCount, 3, "equal-target truth must still update the predictor");
assert.equal(coordinator.getStatus().measuredRoutedSampleCount, routedBeforeCorrections.measuredRoutedSampleCount);
assert.equal(coordinator.getStatus().input.measuredSampleCount, routedBeforeCorrections.input.measuredSampleCount);
assert.equal(coordinator.getStatus().input.emittedEventCount, routedBeforeCorrections.input.emittedEventCount);

const belowTargetCorrection = coordinator.routeMeasuredFrame(frame(105, 0.045));
assert.equal(belowTargetCorrection.outcome, "measurement-update");
assert.equal(belowTargetCorrection.sample, undefined);
assert.equal(belowTargetCorrection.events.length, 0);
assert.equal(coordinator.getStatus().predictor.measuredSampleCount, 4, "older truth must still update/reset the predictor");
assert.equal(coordinator.getStatus().measuredRoutedSampleCount, routedBeforeCorrections.measuredRoutedSampleCount);
assert.equal(coordinator.getStatus().input.measuredSampleCount, routedBeforeCorrections.input.measuredSampleCount);
assert.equal(coordinator.getStatus().input.emittedEventCount, routedBeforeCorrections.input.emittedEventCount);

const latestCorrection = coordinator.routeMeasuredFrame(frame(110, 0.05));
assert.equal(latestCorrection.outcome, "measurement-update");
assert.equal(coordinator.getStatus().predictor.measuredSampleCount, 5);
assert.equal(coordinator.getStatus().supersededMeasurementUpdateCount, 3);
assert.equal(coordinator.getStatus().input.measuredSampleCount, 2, "superseded measurements must not count as gameplay input");

const correctedPrediction = coordinator.routePrediction(120, initialEpoch);
assert.equal(correctedPrediction.outcome, "predicted");
assert.equal(correctedPrediction.sample?.targetTimestampMs, 120);
assert.equal(correctedPrediction.sample?.measurementTimestampMs, 110);
assert.equal(
  correctedPrediction.sample?.measuredSourceFrameId,
  `${coordinator.getStatus().predictor.routeEpoch}:aero.routing.test:110`,
  "the first newer target must carry the latest correction identity"
);
assert.equal(coordinator.getStatus().input.predictedSampleCount, 2);

const duplicateTarget = coordinator.routePrediction(120, initialEpoch);
assert.equal(duplicateTarget.outcome, "duplicate-target");
assert.equal(duplicateTarget.events.length, 0);
assert.equal(coordinator.getStatus().input.predictedSampleCount, 2);

const nonMonotonicTarget = coordinator.routePrediction(119, initialEpoch);
assert.equal(nonMonotonicTarget.outcome, "duplicate-target");
assert.equal(coordinator.getStatus().input.predictedSampleCount, 2);

const stale = coordinator.routePrediction(130, "test-route-stale");
assert.equal(stale.outcome, "stale-lifecycle");
assert.equal(stale.events.length, 0);
assert.equal(coordinator.getStatus().input.predictedSampleCount, 2);

const frozen = coordinator.routePrediction(300, initialEpoch);
assert.equal(frozen.outcome, "freeze");
assert.equal(frozen.sample, undefined);
assert.equal(frozen.events.length, 0);
assert.equal(coordinator.getStatus().input.predictedSampleCount, 2, "stale prediction must not route or count a sample");
assert.equal(coordinator.getStatus().frozenPredictionCount, 1);

const lifecycleReasons = [
  "gameplay-reset",
  "service-replacement",
  "source",
  "mirror",
  "backend",
  "camera",
  "mode",
  "stop",
  "restart"
];
const epochs = new Set([coordinator.getLifecycleEpoch()]);
for (const reason of lifecycleReasons) {
  epochs.add(coordinator.reset(reason));
}
assert.equal(epochs.size, lifecycleReasons.length + 1, "every lifecycle reset must produce a new route epoch");
assert.equal(coordinator.getStatus().lifecycleResetCount, lifecycleReasons.length);
for (const reason of lifecycleReasons) {
  assert.equal(coordinator.getStatus().lifecycleResetCountByReason[reason], 1);
}

const currentEpoch = coordinator.getLifecycleEpoch();
const oldCallback = coordinator.routePrediction(120, initialEpoch);
assert.equal(oldCallback.outcome, "stale-lifecycle");
const restartedMeasurement = coordinator.routeMeasuredFrame(frame(0, 0));
assert.equal(restartedMeasurement.outcome, "measured", "equal media timestamps may route in a new lifecycle epoch");
assert.equal(restartedMeasurement.sample?.routeEpoch.startsWith(currentEpoch), true);
assert.equal(coordinator.getStatus().input.measuredSampleCount, 1);

console.log("Predictive pose routing coordinator validation passed.");
