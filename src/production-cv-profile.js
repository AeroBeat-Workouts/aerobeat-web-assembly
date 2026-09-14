// @ts-check

/** Immutable production CV route; diagnostics cannot change this selection. */
export const lockedProductionCvProfile = Object.freeze({
  backendId: "mediapipe",
  vendorId: "mediapipe-tasks-vision",
  model: "Pose Landmarker Lite float16 /1/",
  runtimeVersion: "1.0.1",
  providerId: "cpu-wasm",
  executionLocation: "worker",
  // tm4m threshold split: detection lowered to 0.4 and tracking to 0.3 for
  // mid-song stability; presence stays at 0.5.
  minPoseDetectionConfidence: 0.4,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.3,
  trackingProfile: "fast",
  performancePresetId: "full",
  resizePath: "none",
  gameplaySource: "measured",
  submissionCadenceTargetFps: 15
});
