// @ts-check

/** Immutable production CV route; diagnostics cannot change this selection. */
export const lockedProductionCvProfile = Object.freeze({
  backendId: "mediapipe",
  vendorId: "mediapipe-tasks-vision",
  model: "Pose Landmarker Lite float16 /1/",
  runtimeVersion: "1.0.1",
  providerId: "gpu-webgl",
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  trackingProfile: "fast",
  performancePresetId: "full",
  resizePath: "none",
  gameplaySource: "measured",
  submissionCadenceTargetFps: 15
});
