// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMediaLeaseSnapshot } from "@aerobeat/web-contracts";
import { AeroGameMediaLeaseCoordinator } from "../src/media-lease-coordinator.js";
import { createLockedProductionCvService } from "../src/production-cv-service.js";
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
assert.throws(() => lease.register(participant("first")), /already registered/u);
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

const failureLease = new AeroGameMediaLeaseCoordinator();
const broken = participant("broken", { pauseError: true }); const next = participant("next");
failureLease.register(broken); failureLease.register(next); await failureLease.request(broken);
await assert.rejects(() => failureLease.request(next), /pause failed/u);
assert.equal(failureLease.snapshot().state, "owned");
assert.equal(failureLease.snapshot().ownerInstanceId, "broken");
const activationFailureLease=new AeroGameMediaLeaseCoordinator();const stable=participant("stable"),activationBroken=participant("activation-broken",{activateError:true});activationFailureLease.register(stable);activationFailureLease.register(activationBroken);await activationFailureLease.request(stable);await assert.rejects(()=>activationFailureLease.request(activationBroken),/activate failed/u);assert.equal(activationFailureLease.snapshot().ownerInstanceId,"stable");assert.deepEqual(calls.slice(-4),["stable:activate","stable:pause","activation-broken:activate","stable:activate"]);

const reentrantLease = new AeroGameMediaLeaseCoordinator();
let reentrantRejected = false;
const reentrant = { instanceId: "reentrant", async pauseForLease() {}, async activateLease() { await Promise.resolve(); try { await reentrantLease.release(reentrant); } catch { reentrantRejected = true; } }, async releaseLease() {} };
reentrantLease.register(reentrant); await reentrantLease.request(reentrant);
assert.equal(reentrantRejected, true);
assert.equal(reentrantLease.snapshot().ownerInstanceId, "reentrant");

const serializedLease = new AeroGameMediaLeaseCoordinator(); const serializedLog = []; let callbacks = 0; let maximumCallbacks = 0;
const serialParticipant = (instanceId) => ({ instanceId, async pauseForLease() { callbacks += 1; maximumCallbacks = Math.max(maximumCallbacks, callbacks); serializedLog.push(`${instanceId}:pause`); await Promise.resolve(); callbacks -= 1; }, async activateLease() { callbacks += 1; maximumCallbacks = Math.max(maximumCallbacks, callbacks); serializedLog.push(`${instanceId}:activate`); await Promise.resolve(); callbacks -= 1; }, async releaseLease() { callbacks += 1; maximumCallbacks = Math.max(maximumCallbacks, callbacks); serializedLog.push(`${instanceId}:release`); await Promise.resolve(); callbacks -= 1; } });
const serialFirst=serialParticipant("serial-first"),serialSecond=serialParticipant("serial-second");serializedLease.register(serialFirst);serializedLease.register(serialSecond);await Promise.all([serializedLease.request(serialFirst),serializedLease.request(serialSecond),serializedLease.release(serialSecond)]);
assert.equal(maximumCallbacks,1);assert.deepEqual(serializedLog,["serial-first:activate","serial-first:pause","serial-second:activate","serial-second:release"]);assert.equal(serializedLease.snapshot().state,"idle");
const overlapLease=new AeroGameMediaLeaseCoordinator(),activateGate=deferred();let secondActivated=false;const slow={instanceId:"slow",async pauseForLease(){},async activateLease(){await activateGate.promise},async releaseLease(){}},afterSlow={instanceId:"after-slow",async pauseForLease(){},async activateLease(){secondActivated=true},async releaseLease(){}};overlapLease.register(slow);overlapLease.register(afterSlow);const slowRequest=overlapLease.request(slow);await Promise.resolve();const queuedRequest=overlapLease.request(afterSlow);await Promise.resolve();assert.equal(secondActivated,false);activateGate.resolve();await Promise.all([slowRequest,queuedRequest]);assert.equal(overlapLease.snapshot().ownerInstanceId,"after-slow");
const teardownLease=new AeroGameMediaLeaseCoordinator(),teardownGate=deferred();let teardownReleases=0;const tearingDown={instanceId:"tearing-down",async pauseForLease(){},async activateLease(){await teardownGate.promise},async releaseLease(){teardownReleases+=1}};const unregisterTearingDown=teardownLease.register(tearingDown);const teardownRequest=teardownLease.request(tearingDown);await Promise.resolve();unregisterTearingDown();assert.equal(teardownLease.getParticipantCount(),0);teardownGate.resolve();await teardownRequest;await new Promise((resolve)=>setTimeout(resolve,0));assert.equal(teardownReleases,1);assert.notEqual(teardownLease.snapshot().ownerInstanceId,"tearing-down");

if (!("HTMLVideoElement" in globalThis)) Object.defineProperty(globalThis,"HTMLVideoElement",{configurable:true,value:class HTMLVideoElement{}});
const pendingEstimates=[];let activeEstimates=0,maxEstimates=0;
const cv=createLockedProductionCvService({poseAdapter:{vendorId:"mediapipe-tasks-vision",async load(){},async estimateNormalizedPoseFrame(_frame,options){activeEstimates+=1;maxEstimates=Math.max(maxEstimates,activeEstimates);const gate=deferred();pendingEstimates.push({gate,options});await gate.promise;activeEstimates-=1;return{timestampMs:options.timestampMs}},async dispose(){},getExecutionTelemetry(){return{provider:"gpu-webgl"}}}});
const cvSource={sourceId:"camera",mirrored:true,frameSource:new globalThis.HTMLVideoElement(),getTimestampMs:()=>1,isFrameAvailable:()=>true,frameWidth:()=>640,frameHeight:()=>480};
await cv.start(cvSource);cv.submitFrame();await Promise.resolve();await cv.stop();await cv.start(cvSource);cv.submitFrame();await Promise.resolve();assert.equal(pendingEstimates.length,1);pendingEstimates[0].gate.resolve();await pendingEstimates[0].gate.promise;await new Promise((resolve)=>setTimeout(resolve,0));cv.submitFrame();await Promise.resolve();assert.equal(pendingEstimates.length,2);pendingEstimates[1].gate.resolve();await pendingEstimates[1].gate.promise;await new Promise((resolve)=>setTimeout(resolve,0));assert.equal(maxEstimates,1);assert.equal(cv.getLatestPoseFrame().timestampMs,1);await cv.dispose();

console.log("aero-game root, locked CV and transactional media lease validation passed.");

function deferred(){let resolve;const promise=new Promise((done)=>{resolve=done});return{promise,resolve};}
function participant(instanceId, options = {}) { return { instanceId, async pauseForLease() { calls.push(`${instanceId}:pause`); if (options.pauseError) throw new Error("pause failed"); }, async activateLease() { calls.push(`${instanceId}:activate`); if (options.activateError) throw new Error("activate failed"); }, async releaseLease() { calls.push(`${instanceId}:release`); } }; }
