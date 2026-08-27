// @ts-check

/** @typedef {"measured" | "measured-8" | "predicted-8"} PoseGameplaySourceId */

/** @type {readonly {value: PoseGameplaySourceId, label: string}[]} */
export const poseGameplaySourceOptions = Object.freeze([
  Object.freeze({ value: "measured", label: "Measured / current cadence (recommended)" }),
  Object.freeze({ value: "measured-8", label: "Experimental measured / 8fps" }),
  Object.freeze({ value: "predicted-8", label: "Experimental predicted gameplay / 8fps" })
]);

/**
 * @param {unknown} value
 * @returns {value is PoseGameplaySourceId}
 */
export function isPoseGameplaySourceId(value) {
  return value === "measured" || value === "measured-8" || value === "predicted-8";
}

/**
 * Experimental cadence/prediction applies only to the exact Direct-full
 * MediaPipe main-thread workload selected by the approved experiment.
 *
 * @param {string} backendId
 * @param {string} performancePresetId
 * @returns {boolean}
 */
export function supportsExperimentalPoseGameplaySource(backendId, performancePresetId) {
  return backendId === "mediapipe" && performancePresetId === "full";
}

/**
 * @param {{ search?: string, backendId: string, performancePresetId: string }} options
 * @returns {{ requestedId: string, selectedId: PoseGameplaySourceId, effectiveId: PoseGameplaySourceId, warning: string | undefined }}
 */
export function resolvePoseGameplaySource(options) {
  const route = new URLSearchParams(options.search ?? globalThis.location?.search ?? "");
  const requestedId = route.get("poseGameplaySource") ?? "measured";
  if (!isPoseGameplaySourceId(requestedId)) {
    return {
      requestedId,
      selectedId: "measured",
      effectiveId: "measured",
      warning: `unsupported pose gameplay source ${requestedId}; using measured`
    };
  }
  if (requestedId !== "measured" && !supportsExperimentalPoseGameplaySource(options.backendId, options.performancePresetId)) {
    return {
      requestedId,
      selectedId: "measured",
      effectiveId: "measured",
      warning: `${requestedId} requires MediaPipe Direct full; using measured`
    };
  }
  return {
    requestedId,
    selectedId: requestedId,
    effectiveId: requestedId,
    warning: undefined
  };
}

/**
 * @param {string} search
 * @param {PoseGameplaySourceId} sourceId
 * @returns {string}
 */
export function updatePoseGameplaySourceSearch(search, sourceId) {
  const route = new URLSearchParams(search);
  route.set("poseGameplaySource", sourceId);
  const serialized = route.toString();
  return serialized ? `?${serialized}` : "";
}

/** @param {PoseGameplaySourceId} sourceId @returns {number} */
export function measuredSubmissionCadenceFps(sourceId) {
  return sourceId === "measured" ? 15 : 8;
}
