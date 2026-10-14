// @ts-check
import assert from 'node:assert/strict';
import { createPhonePlayCvWindow, phonePlayCvWindowReasons } from '../src/phone-play-cv-window.js';

const previousDocument = globalThis.document;
const previousDpr = globalThis.devicePixelRatio;
globalThis.document = { hidden:false };
globalThis.devicePixelRatio = 2;
function fixture() {
  let callback, cancelled = 0, nextId = 0;
  const video = { videoWidth:640, videoHeight:480, readyState:4, paused:false, srcObject:{},
    requestVideoFrameCallback(fn) { callback=fn; return ++nextId; }, cancelVideoFrameCallback() { cancelled++; callback=null; } };
  const track = { readyState:'live' };
  const cv = { running:true, lifecycleState:'running', error:null, submittedFrameCount:10, poseFrameCount:5, droppedFrameCount:2 };
  const cadence = { active:true, displayFrameCount:40, freshPoseConsumptionCount:4, inputAdvanceCount:1 };
  const session = { purpose:'play', state:'playing', sessionId:'sensitive-session' };
  const stream = {getVideoTracks:()=>[track]};
  const graph = { cv:{getStatus:()=>cv}, gameplay:{getSnapshot:()=>({session})}, input:{getSnapshot:()=>({calibration:{calibrationId:'sensitive-calibration'}})}, video:{getRetainedCameraStream:()=>stream} };
  let resets=0;
  const game = { graph, connectedGeneration:1, sessionGeneration:2, lastCameraIdentity:'sensitive-camera',
    videoElement:()=>video, getBoundingClientRect:()=>({width:320,height:240}), cadenceSnapshot:()=>({...cadence}),
    resetPrivatePerformanceWindow:()=>{resets++;}, privatePerformanceSnapshot:()=>({
      camera:{width:640,height:480,frameRate:30,deviceId:'secret'},mediaPipeRuntimeMs:{count:3,p50:9,p95:13,max:20,poseX:44},
      mediaPipeEndToEndMs:{count:3,p50:12,p95:19},poseAgeMs:{count:4,p50:20,p95:30},displayIntervals:{count:5,p50:16,p95:34},
      poseCoordinates:[1,2],latestPoseTimestampMs:123,sourceId:'secret' }) };
  return {game,cv,cadence,session,video,track,get callback(){return callback;},get cancelled(){return cancelled;},get resets(){return resets;}};
}
try {
  const f=fixture(), observer=createPhonePlayCvWindow();
  assert.equal(observer.start(f.game),true,JSON.stringify(observer.snapshot())); assert.equal(f.resets,1);
  f.callback(1,{mediaTime:1,presentedFrames:1});
  f.callback(2,{mediaTime:1,presentedFrames:2}); // Duplicate media time must not count.
  f.callback(3,{mediaTime:2,presentedFrames:3});
  f.cv.submittedFrameCount+=6; f.cv.poseFrameCount+=3; f.cv.droppedFrameCount+=2;
  f.cadence.displayFrameCount+=10; f.cadence.freshPoseConsumptionCount+=2; f.cadence.inputAdvanceCount+=1;
  const result=observer.stop();
  assert.equal(result.valid,true,JSON.stringify(result)); assert.equal(result.counts.cameraUniqueMediaFrames,2);
  assert.deepEqual(result.counts,{cameraUniqueMediaFrames:2,cvSubmitted:6,cvPoses:3,cvBusyDrops:2,freshPoseConsumptions:2,inputAdvances:1,sceneFrames:10});
  assert.equal(result.ratesFps.denominatorMs,result.durationMs);
  assert.equal(result.inferenceMs.p95,13);
  assert.equal(result.camera.configuredFrameRateFps,30);
  assert.ok(f.cancelled>0);
  const forbidden=/timestamp|mediaTime|presentedFrames|sessionId|calibrationId|sourceId|deviceId|coordinates|poseX|frameBytes|image|landmarks|songId/i;
  assert.doesNotMatch(JSON.stringify(result),forbidden);
  assert.deepEqual(Object.keys(result).sort(),['camera','counts','durationMs','endToEndMs','inferenceMs','invalidReason','poseAgeMs','purpose','ratesFps','sceneIntervalMs','schema','valid','version'].sort());
  assert.ok(Object.values(result.ratesFps).every(value=>value===null||Number.isFinite(value)));
  observer.dispose();

  const hidden=fixture(), hiddenObserver=createPhonePlayCvWindow();
  assert.equal(hiddenObserver.start(hidden.game),true);
  globalThis.document.hidden=true;
  assert.equal(hiddenObserver.snapshot().invalidReason,'hidden');
  assert.ok(hidden.cancelled>0);
  globalThis.document.hidden=false;
  const changed=fixture(), changedObserver=createPhonePlayCvWindow();
  assert.equal(changedObserver.start(changed.game),true);
  changed.game.sessionGeneration++;
  assert.equal(changedObserver.stop().invalidReason,'session_changed');
  const reset=fixture(), resetObserver=createPhonePlayCvWindow();
  assert.equal(resetObserver.start(reset.game),true);
  reset.cv.submittedFrameCount=0;
  assert.equal(resetObserver.stop().invalidReason,'cv_lost');
  const absent=fixture(), absentObserver=createPhonePlayCvWindow();
  absent.session.purpose='visual_test';
  assert.equal(absentObserver.start(absent.game),false);
  assert.equal(absentObserver.snapshot().valid,false);
  assert.ok(phonePlayCvWindowReasons.includes('no_poses'));
  console.log('phone Play CV scalar window: PASS');
} finally {
  globalThis.document=previousDocument;
  globalThis.devicePixelRatio=previousDpr;
}
