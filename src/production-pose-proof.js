// @ts-check

/**
 * Purely maps the locked production CV profile into its release-proof shape.
 * Proof-only names and identities are derived here so the release builder owns
 * no second copy of runtime configuration values.
 *
 * @param {{
 *   backendId:string,
 *   model:string,
 *   runtimeVersion:string,
 *   providerId:string,
 *   executionLocation:string,
 *   minPoseDetectionConfidence:number,
 *   minPosePresenceConfidence:number,
 *   minTrackingConfidence:number,
 *   trackingProfile:string,
 *   performancePresetId:string,
 *   gameplaySource:string,
 *   submissionCadenceTargetFps:number
 * }} profile
 */
export function mapProductionPoseConfiguration(profile) {
  const modelMatch = /^Pose Landmarker (?<size>[^ ]+) (?<precision>[^ ]+) \/(?<revision>[^/]+)\/$/u.exec(profile.model);
  const thresholds = Object.freeze([
    profile.minPoseDetectionConfidence,
    profile.minPosePresenceConfidence,
    profile.minTrackingConfidence
  ]);

  return Object.freeze({
    backend: profile.backendId,
    provider: profile.providerId,
    executionLocation: profile.executionLocation,
    transferFrameType: profile.executionLocation === "worker" ? "VideoFrame" : "direct-source",
    model: modelMatch
      ? `pose-landmarker-${modelMatch.groups?.size.toLowerCase()}`
      : profile.model,
    modelVariant: modelMatch
      ? `${modelMatch.groups?.precision}/${modelMatch.groups?.revision}`
      : profile.model,
    tasksVisionVersion: profile.runtimeVersion,
    tuning: "standard",
    thresholds,
    tracking: profile.trackingProfile,
    performancePreset: profile.performancePresetId,
    gameplaySource: profile.gameplaySource,
    submissionCadenceTargetFps: profile.submissionCadenceTargetFps
  });
}
