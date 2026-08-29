// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isIframeMessage, isMediaLeaseSnapshot } from "@aerobeat/web-contracts";
import { isAeroGameIframeValueWithinLimits } from "../src/iframe-bridge.js";
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
const exactBridgeBytes = [...Array.from({ length: 7 }, () => "x".repeat(8192)), "x".repeat(8167)];
assert.equal(new TextEncoder().encode(JSON.stringify(exactBridgeBytes)).byteLength, 64 * 1024); assert.equal(isAeroGameIframeValueWithinLimits(exactBridgeBytes), true);
exactBridgeBytes[7] += "x"; assert.equal(isAeroGameIframeValueWithinLimits(exactBridgeBytes), false);
assert.equal(isAeroGameIframeValueWithinLimits("x".repeat(8192)), true); assert.equal(isAeroGameIframeValueWithinLimits("x".repeat(8193)), false);
assert.equal(isAeroGameIframeValueWithinLimits(Array.from({ length: 256 }, () => "x")), true); assert.equal(isAeroGameIframeValueWithinLimits(Array.from({ length: 257 }, () => "x")), false);
let depthTwelve = null; for (let index = 0; index < 12; index += 1) depthTwelve = { nested: depthTwelve }; assert.equal(isAeroGameIframeValueWithinLimits(depthTwelve), true);
let depthThirteen = null; for (let index = 0; index < 13; index += 1) depthThirteen = { nested: depthThirteen }; assert.equal(isAeroGameIframeValueWithinLimits(depthThirteen), false);
const keys128 = Object.fromEntries(Array.from({ length: 128 }, (_, index) => [`key${index}`, null])); const keys129 = { ...keys128, overflow: null }; assert.equal(isAeroGameIframeValueWithinLimits(keys128), true); assert.equal(isAeroGameIframeValueWithinLimits(keys129), false);
assert.equal(isAeroGameIframeValueWithinLimits({ ["k".repeat(256)]: null }), true); assert.equal(isAeroGameIframeValueWithinLimits({ ["k".repeat(257)]: null }), false);
const aggregate2048 = Object.fromEntries(Array.from({ length: 16 }, (_, index) => [`group${index}`, Array.from({ length: index === 15 ? 126 : 127 }, () => null)])); assert.equal(isAeroGameIframeValueWithinLimits(aggregate2048), true);
const aggregate2049 = { ...aggregate2048, group15: Array.from({ length: 127 }, () => null) }; assert.equal(isAeroGameIframeValueWithinLimits(aggregate2049), false);
let getterCalls = 0; const accessor = {}; Object.defineProperty(accessor, "value", { enumerable: true, get() { getterCalls += 1; return "unsafe"; } }); assert.equal(isAeroGameIframeValueWithinLimits(accessor), false); assert.equal(getterCalls, 0);
const nonEnumerable = {}; Object.defineProperty(nonEnumerable, "value", { value: "unsafe" }); assert.equal(isAeroGameIframeValueWithinLimits(nonEnumerable), false); assert.equal(isAeroGameIframeValueWithinLimits({ [Symbol("unsafe")]: true }), false);
const arrayWithExtra = []; arrayWithExtra.extra = true; assert.equal(isAeroGameIframeValueWithinLimits(arrayWithExtra), false); const cyclic = {}; cyclic.self = cyclic; assert.equal(isAeroGameIframeValueWithinLimits(cyclic), false); assert.equal(isAeroGameIframeValueWithinLimits(new (class Payload {})()), false);
for (const field of ["messageId", "instanceId", "commandId"]) { const accepted = iframeCommandIds(field, "i".repeat(8192)); assert.equal(isIframeMessage(accepted), true); assert.equal(isAeroGameIframeValueWithinLimits(accepted), true); const rejected = iframeCommandIds(field, "i".repeat(8193)); assert.equal(isIframeMessage(rejected), true); assert.equal(isAeroGameIframeValueWithinLimits(rejected), false); }

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
await cv.start(cvSource);cv.submitFrame();await Promise.resolve();await cv.stop();const restartCv=cv.start(cvSource);await Promise.resolve();assert.equal(pendingEstimates.length,1);pendingEstimates[0].gate.resolve();await pendingEstimates[0].gate.promise;await restartCv;const freshFramePromise=cv.nextPoseFrame();await Promise.resolve();assert.equal(pendingEstimates.length,2);pendingEstimates[1].gate.resolve();const freshFrame=await freshFramePromise;assert.equal(maxEstimates,1);assert.equal(freshFrame,cv.getLatestPoseFrame());assert.equal(freshFrame.timestampMs,1);await cv.stop();assert.equal(cv.getLatestPoseFrame(),undefined);await cv.start(cvSource);assert.equal(cv.getLatestPoseFrame(),undefined);await cv.dispose();
const failingCv=createLockedProductionCvService({poseAdapter:{vendorId:"mediapipe-tasks-vision",async load(){throw new Error("x".repeat(3000))},async estimateNormalizedPoseFrame(){throw new Error("unexpected")},async dispose(){}}});await assert.rejects(()=>failingCv.start(cvSource),(error)=>error.message.length===2048);assert.equal(failingCv.getStatus().lifecycleState,"error");assert.equal(failingCv.getStatus().error.length,2048);await failingCv.dispose();
const loadGates=[];let activeLoads=0,maxLoads=0;const concurrentLoadCv=createLockedProductionCvService({poseAdapter:{vendorId:"mediapipe-tasks-vision",async load(){activeLoads+=1;maxLoads=Math.max(maxLoads,activeLoads);const gate=deferred();loadGates.push(gate);await gate.promise;activeLoads-=1},async estimateNormalizedPoseFrame(){throw new Error("unexpected")},async dispose(){}}});const firstLoad=concurrentLoadCv.start(cvSource),secondLoad=concurrentLoadCv.start(cvSource);await Promise.resolve();await Promise.resolve();assert.equal(loadGates.length,1);loadGates[0].resolve();await new Promise((resolve)=>setTimeout(resolve,0));assert.equal(loadGates.length,2);loadGates[1].resolve();await Promise.all([firstLoad,secondLoad]);assert.equal(maxLoads,1);assert.equal(concurrentLoadCv.getStatus().lifecycleState,"running");await concurrentLoadCv.dispose();
const freshGates=[];let freshId=0,freshAvailable=true,freshFailure=false;const freshCv=createLockedProductionCvService({poseAdapter:{vendorId:"mediapipe-tasks-vision",async load(){},async estimateNormalizedPoseFrame(_frame,options){const gate=deferred(),id=++freshId;freshGates.push({gate,id});await gate.promise;if(freshFailure)throw new Error("estimate-failed");return{timestampMs:options.timestampMs,id}},async dispose(){}}});const freshSource={...cvSource,isFrameAvailable:()=>freshAvailable};await freshCv.start(freshSource);freshCv.submitFrame();await Promise.resolve();let firstWaiterSettled=false,secondWaiterSettled=false;const firstWaiter=freshCv.nextPoseFrame().then((frame)=>{firstWaiterSettled=true;return frame}),secondWaiter=freshCv.nextPoseFrame().then((frame)=>{secondWaiterSettled=true;return frame});freshGates[0].gate.resolve();await new Promise((resolve)=>setTimeout(resolve,0));assert.equal(freshGates.length,2);assert.equal(firstWaiterSettled||secondWaiterSettled,false);freshGates[1].gate.resolve();const [firstFresh,secondFresh]=await Promise.all([firstWaiter,secondWaiter]);assert.equal(firstFresh.id,2);assert.equal(secondFresh.id,2);freshAvailable=false;await assert.rejects(()=>freshCv.nextPoseFrame(),/fresh pose frame/u);freshAvailable=true;freshFailure=true;const failedFresh=freshCv.nextPoseFrame();await Promise.resolve();freshGates[2].gate.resolve();await assert.rejects(()=>failedFresh,/estimate-failed/u);assert.equal(freshCv.getStatus().lifecycleState,"error");assert.equal(freshCv.getLatestPoseFrame(),undefined);await freshCv.dispose();
const loadGate=deferred();let adapterDisposals=0;const disposeGate=deferred();const disposeCv=createLockedProductionCvService({poseAdapter:{vendorId:"mediapipe-tasks-vision",async load(){await loadGate.promise},async estimateNormalizedPoseFrame(){throw new Error("unexpected")},async dispose(){adapterDisposals+=1;await disposeGate.promise}}});const pendingStart=disposeCv.start(cvSource);await Promise.resolve();let firstDisposeSettled=false,secondDisposeSettled=false;const pendingDispose=disposeCv.dispose().then(()=>{firstDisposeSettled=true}),joinedDispose=disposeCv.dispose().then(()=>{secondDisposeSettled=true});loadGate.resolve();await new Promise((resolve)=>setTimeout(resolve,0));assert.equal(adapterDisposals,1);assert.equal(firstDisposeSettled||secondDisposeSettled,false);disposeGate.resolve();await Promise.all([pendingStart,pendingDispose,joinedDispose]);assert.equal(adapterDisposals,1);assert.equal(disposeCv.getStatus().lifecycleState,"disposed");assert.equal(disposeCv.getLatestPoseFrame(),undefined);

console.log("aero-game root, locked CV and transactional media lease validation passed.");

function iframeCommandIds(field, value) { const message = { schema: "aerobeat/iframe_message", version: 1, kind: "command", messageId: "message", instanceId: "instance", payload: { command: { schema: "aerobeat/game_command", version: 1, commandId: "command", type: "configure", payload: {} } } }; if (field === "commandId") message.payload.command.commandId = value; else message[field] = value; return message; }
function deferred(){let resolve;const promise=new Promise((done)=>{resolve=done});return{promise,resolve};}
function participant(instanceId, options = {}) { return { instanceId, async pauseForLease() { calls.push(`${instanceId}:pause`); if (options.pauseError) throw new Error("pause failed"); }, async activateLease() { calls.push(`${instanceId}:activate`); if (options.activateError) throw new Error("activate failed"); }, async releaseLease() { calls.push(`${instanceId}:release`); } }; }
