// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lockedProductionCvProfile } from "../src/production-cv-profile.js";
import { mapProductionPoseConfiguration } from "../src/production-pose-proof.js";

const expectedProductionPoseConfiguration = {
  backend: "mediapipe",
  provider: "cpu-wasm",
  executionLocation: "worker",
  transferFrameType: "VideoFrame",
  model: "pose-landmarker-lite",
  modelVariant: "float16/1",
  tasksVisionVersion: "1.0.1",
  tuning: "standard",
  thresholds: [0.4, 0.5, 0.3],
  tracking: "fast",
  performancePreset: "full",
  gameplaySource: "measured",
  submissionCadenceTargetFps: 15
};

assert.deepEqual(
  mapProductionPoseConfiguration(lockedProductionCvProfile),
  expectedProductionPoseConfiguration,
  "release proof must exactly map the complete locked production CV profile"
);

for (const [field, value] of [
  ["minPoseDetectionConfidence", 0.5],
  ["minPosePresenceConfidence", 0.4],
  ["minTrackingConfidence", 0.5],
  ["runtimeVersion", "1.0.2"],
  ["trackingProfile", "responsive"],
  ["performancePresetId", "reduced"],
  ["gameplaySource", "predicted"],
  ["submissionCadenceTargetFps", 30]
]) {
  const driftedProfile = { ...lockedProductionCvProfile, [field]: value };
  assert.notDeepEqual(
    mapProductionPoseConfiguration(driftedProfile),
    expectedProductionPoseConfiguration,
    `mutated ${field} must not retain the accepted proof configuration`
  );
}

const buildReleaseSource = readFileSync("scripts/build-release.js", "utf8");
assert.match(buildReleaseSource, /mapProductionPoseConfiguration\(lockedProductionCvProfile\)/u, "release builder must consume the profile mapper");
assert.doesNotMatch(buildReleaseSource, /productionPoseConfiguration:\s*\{/u, "release builder must not duplicate the proof configuration literal");
assert.doesNotMatch(buildReleaseSource, /thresholds:\s*\[[^\]]+\]/u, "release builder must not duplicate threshold constants");

console.log("Production pose release-proof mapper oracle passed.");
