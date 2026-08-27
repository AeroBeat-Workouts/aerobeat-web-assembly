// @ts-check

import {
  createMeasuredPoseRoutingSample,
  createPoseInputRouter,
  createPosePredictor
} from "@aerobeat/web-input";

/**
 * @typedef {Object} PredictivePoseRoutingResult
 * @property {"measured" | "measurement-update" | "predicted" | "freeze" | "duplicate-measurement" | "duplicate-target" | "stale-lifecycle"} outcome
 * @property {import("@aerobeat/web-contracts").AeroPoseRoutingSample | undefined} sample
 * @property {readonly import("@aerobeat/web-input").PoseInputDraftEvent[]} events
 */

/**
 * @typedef {Object} PredictivePoseRoutingCoordinatorStatus
 * @property {number} lifecycleGeneration
 * @property {string} lifecycleEpoch
 * @property {number} lifecycleResetCount
 * @property {Readonly<Record<string, number>>} lifecycleResetCountByReason
 * @property {number} measuredRoutedSampleCount
 * @property {number} predictedRoutedSampleCount
 * @property {number} duplicateMeasurementSuppressionCount
 * @property {number} supersededMeasurementUpdateCount
 * @property {number} duplicateTargetSuppressionCount
 * @property {number} staleLifecycleSuppressionCount
 * @property {number} frozenPredictionCount
 * @property {Readonly<Record<string, number>>} measuredEventCountByIntent
 * @property {Readonly<Record<string, number>>} predictedEventCountByIntent
 * @property {number | undefined} lastRoutedTargetTimestampMs
 * @property {ReturnType<ReturnType<typeof createPosePredictor>["getStatus"]>} predictor
 * @property {ReturnType<ReturnType<typeof createPoseInputRouter>["getStatus"]>} input
 */

/**
 * Owns the predicted-treatment routing boundary. A real CV frame is pushed and
 * routed once, while cadence ticks may route only successful, unique,
 * monotonically increasing predictions from the current lifecycle.
 *
 * @param {{ epochPrefix?: string }} [options]
 */
export function createPredictivePoseRoutingCoordinator(options = {}) {
  const epochPrefix = options.epochPrefix ?? "assembly-route";
  let lifecycleGeneration = 0;
  let lifecycleEpoch = `${epochPrefix}-${lifecycleGeneration}`;
  let predictor = createPosePredictor({ routeEpochPrefix: lifecycleEpoch });
  let inputRouter = createPoseInputRouter();
  let lastMeasuredFrameKey = "";
  let lastAttemptedTargetTimestampMs;
  let lastRoutedTargetTimestampMs;
  let lifecycleResetCount = 0;
  /** @type {Record<string, number>} */
  const lifecycleResetCountByReason = {};
  let measuredRoutedSampleCount = 0;
  let predictedRoutedSampleCount = 0;
  let duplicateMeasurementSuppressionCount = 0;
  let supersededMeasurementUpdateCount = 0;
  let duplicateTargetSuppressionCount = 0;
  let staleLifecycleSuppressionCount = 0;
  let frozenPredictionCount = 0;
  /** @type {Record<string, number>} */
  let measuredEventCountByIntent = {};
  /** @type {Record<string, number>} */
  let predictedEventCountByIntent = {};

  /**
   * @param {readonly import("@aerobeat/web-input").PoseInputDraftEvent[]} events
   * @param {Record<string, number>} counts
   * @returns {void}
   */
  const recordEventIntents = (events, counts) => {
    for (const event of events) {
      const intent = event.mode === "boxing"
        ? event.detail.name
        : `${event.detail.kind}:${event.detail.anchor}`;
      counts[intent] = (counts[intent] ?? 0) + 1;
    }
  };

  /** @returns {PredictivePoseRoutingResult} */
  const emptyResult = () => ({ outcome: "freeze", sample: undefined, events: Object.freeze([]) });

  return {
    /** @returns {string} */
    getLifecycleEpoch() {
      return lifecycleEpoch;
    },

    /**
     * @param {string} [reason]
     * @returns {string}
     */
    reset(reason = "manual") {
      lifecycleGeneration += 1;
      lifecycleEpoch = `${epochPrefix}-${lifecycleGeneration}`;
      predictor = createPosePredictor({ routeEpochPrefix: lifecycleEpoch });
      inputRouter = createPoseInputRouter();
      lastMeasuredFrameKey = "";
      lastAttemptedTargetTimestampMs = undefined;
      lastRoutedTargetTimestampMs = undefined;
      measuredRoutedSampleCount = 0;
      predictedRoutedSampleCount = 0;
      duplicateMeasurementSuppressionCount = 0;
      supersededMeasurementUpdateCount = 0;
      duplicateTargetSuppressionCount = 0;
      staleLifecycleSuppressionCount = 0;
      frozenPredictionCount = 0;
      measuredEventCountByIntent = {};
      predictedEventCountByIntent = {};
      lifecycleResetCount += 1;
      lifecycleResetCountByReason[reason] = (lifecycleResetCountByReason[reason] ?? 0) + 1;
      return lifecycleEpoch;
    },

    /**
     * @param {import("@aerobeat/web-contracts").NormalizedPoseFrame} frame
     * @returns {PredictivePoseRoutingResult}
     */
    routeMeasuredFrame(frame) {
      const frameKey = `${lifecycleEpoch}:${frame.sourceId}:${frame.mirrored}:${frame.timestampMs}`;
      if (frameKey === lastMeasuredFrameKey) {
        duplicateMeasurementSuppressionCount += 1;
        return {
          outcome: "duplicate-measurement",
          sample: undefined,
          events: Object.freeze([])
        };
      }
      lastMeasuredFrameKey = frameKey;
      predictor.pushMeasuredFrame(frame);
      if (lastRoutedTargetTimestampMs !== undefined && frame.timestampMs <= lastRoutedTargetTimestampMs) {
        supersededMeasurementUpdateCount += 1;
        return {
          outcome: "measurement-update",
          sample: undefined,
          events: Object.freeze([])
        };
      }
      const predictorEpoch = predictor.getStatus().routeEpoch;
      const sample = createMeasuredPoseRoutingSample(frame, { routeEpoch: predictorEpoch });
      const events = inputRouter.routePoseSampleBatch(sample);
      recordEventIntents(events, measuredEventCountByIntent);
      measuredRoutedSampleCount += 1;
      lastAttemptedTargetTimestampMs = frame.timestampMs;
      lastRoutedTargetTimestampMs = lastRoutedTargetTimestampMs === undefined
        ? frame.timestampMs
        : Math.max(lastRoutedTargetTimestampMs, frame.timestampMs);
      return { outcome: "measured", sample, events };
    },

    /**
     * @param {number} targetTimestampMs
     * @param {string} callbackLifecycleEpoch
     * @returns {PredictivePoseRoutingResult}
     */
    routePrediction(targetTimestampMs, callbackLifecycleEpoch) {
      if (callbackLifecycleEpoch !== lifecycleEpoch) {
        staleLifecycleSuppressionCount += 1;
        return {
          outcome: "stale-lifecycle",
          sample: undefined,
          events: Object.freeze([])
        };
      }
      if (
        !Number.isFinite(targetTimestampMs)
        || targetTimestampMs === lastAttemptedTargetTimestampMs
        || (lastRoutedTargetTimestampMs !== undefined && targetTimestampMs <= lastRoutedTargetTimestampMs)
      ) {
        duplicateTargetSuppressionCount += 1;
        return {
          outcome: "duplicate-target",
          sample: undefined,
          events: Object.freeze([])
        };
      }
      lastAttemptedTargetTimestampMs = targetTimestampMs;
      const sample = predictor.predict(targetTimestampMs);
      if (!sample) {
        frozenPredictionCount += 1;
        return emptyResult();
      }
      const events = inputRouter.routePoseSampleBatch(sample);
      recordEventIntents(events, predictedEventCountByIntent);
      predictedRoutedSampleCount += 1;
      lastRoutedTargetTimestampMs = targetTimestampMs;
      return { outcome: "predicted", sample, events };
    },

    /** @returns {PredictivePoseRoutingCoordinatorStatus} */
    getStatus() {
      return {
        lifecycleGeneration,
        lifecycleEpoch,
        lifecycleResetCount,
        lifecycleResetCountByReason: Object.freeze({ ...lifecycleResetCountByReason }),
        measuredRoutedSampleCount,
        predictedRoutedSampleCount,
        duplicateMeasurementSuppressionCount,
        supersededMeasurementUpdateCount,
        duplicateTargetSuppressionCount,
        staleLifecycleSuppressionCount,
        frozenPredictionCount,
        measuredEventCountByIntent: Object.freeze({ ...measuredEventCountByIntent }),
        predictedEventCountByIntent: Object.freeze({ ...predictedEventCountByIntent }),
        lastRoutedTargetTimestampMs,
        predictor: predictor.getStatus(),
        input: inputRouter.getStatus()
      };
    }
  };
}
