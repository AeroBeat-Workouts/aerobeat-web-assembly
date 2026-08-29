// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMediaLeaseSnapshot } from "@aerobeat/web-contracts";
import { AeroGameMediaLeaseCoordinator } from "../src/media-lease-coordinator.js";
import { lockedProductionCvProfile } from "../src/production-cv-profile.js";

const source = readFileSync("src/index.js", "utf8");
const html = readFileSync("index.html", "utf8");
assert.match(html, /<aero-game>/u);
assert.doesNotMatch(html + source, /<aerobeat-app\b|customElements\.define\(["']aerobeat-app/u);
assert.doesNotMatch(source, /history\.|location\.(?:assign|replace)|100vh/u);
assert.match(source, /connectedCallback\(\)/u);
assert.match(source, /disconnectedCallback\(\)/u);
assert.deepEqual(lockedProductionCvProfile, {
  backendId: "mediapipe", vendorId: "mediapipe-tasks-vision", model: "Pose Landmarker Lite float16 /1/", runtimeVersion: "1.0.1",
  providerId: "gpu-webgl", minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  trackingProfile: "fast", performancePresetId: "full", resizePath: "none", gameplaySource: "measured", submissionCadenceTargetFps: 15
});

const lease = new AeroGameMediaLeaseCoordinator();
const calls = [];
const first = participant("first");
const second = participant("second");
lease.register(first); lease.register(second);
await lease.request(first);
assert.equal(isMediaLeaseSnapshot(lease.snapshot()), true);
assert.equal(lease.snapshot().ownerInstanceId, "first");
await lease.request(second);
assert.equal(lease.snapshot().ownerInstanceId, "second");
assert.deepEqual(calls, ["first:activate", "first:pause", "second:activate"]);
await lease.release(second);
assert.equal(lease.snapshot().ownerInstanceId, null);
assert.equal(calls.at(-1), "second:release");
await lease.unregister(first); await lease.unregister(second);
assert.equal(lease.getParticipantCount(), 0);

console.log("aero-game root, locked CV and media lease validation passed.");

function participant(instanceId) { return { instanceId, async pauseForLease() { calls.push(`${instanceId}:pause`); }, async activateLease() { calls.push(`${instanceId}:activate`); }, async releaseLease() { calls.push(`${instanceId}:release`); } }; }
