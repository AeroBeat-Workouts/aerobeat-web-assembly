// @ts-check

/**
 * Timestamped measured replay trace kept separate from live predictor state. It
 * covers linear movement, a completed direction reversal, then a later
 * low-confidence occlusion and re-entry. The reversal and visibility reset are
 * deliberately separated so one cannot mask the other's oracle evidence.
 *
 * @returns {readonly import("@aerobeat/web-contracts").NormalizedPoseFrame[]}
 */
export function createPredictivePoseOracleTrace() {
  const names = [
    "nose",
    "left_wrist",
    "left_elbow",
    "left_shoulder",
    "right_shoulder",
    "right_elbow",
    "right_wrist"
  ];
  return Object.freeze(Array.from({ length: 61 }, (_, index) => {
    const timestampMs = index * 25;
    const phase = index <= 20
      ? index
      : index <= 40
        ? 40 - index
        : index - 40;
    const confidence = index === 45 ? 0.2 : 0.92;
    return Object.freeze({
      sourceId: "aero.predictive.oracle.measured",
      timestampMs,
      mirrored: true,
      landmarks: Object.freeze(names.map((name, landmarkIndex) => Object.freeze({
        name,
        x: Math.min(0.95, 0.18 + phase * 0.018 + landmarkIndex * 0.003),
        y: Math.min(0.95, 0.28 + phase * 0.009 + landmarkIndex * 0.004),
        confidence
      })))
    });
  }));
}
