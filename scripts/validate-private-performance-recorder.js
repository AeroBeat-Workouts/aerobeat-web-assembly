// @ts-check
import assert from "node:assert/strict";
import { createPrivatePerformanceRecorder } from "../src/private-performance-recorder.js";

const recorder=createPrivatePerformanceRecorder({capacity:32});
recorder.reset("ABCCBA-A1",1000);
for(let index=0;index<40;index+=1)recorder.record({timestampMs:1000+index*(index===20?34:16.5),rendererCpuMs:index%4+.25,poseTimestampMs:990+index*16.5,cv:{submittedFrameCount:index>>2,poseFrameCount:index>>2,runtimeInferenceDurationMs:8+index%3,estimateDurationMs:10+index%4},camera:{width:640,height:480,frameRate:30,deviceId:"must-not-pass"}});
const snapshot=recorder.snapshot(1700),encoded=JSON.stringify(snapshot);
assert.equal(snapshot.label,"ABCCBA-A1");
assert.equal(snapshot.displayIntervals.count,32,"display intervals are rolling-bounded");
assert.equal(snapshot.rendererCpuMs.count,32,"renderer CPU samples are rolling-bounded");
assert.equal(snapshot.mediaPipeRuntimeMs.count,10,"CV timing records once per new measured pose");
assert.deepEqual(snapshot.camera,{width:640,height:480,frameRate:30});
assert.ok(snapshot.displayIntervals.p50!==null&&snapshot.displayIntervals.p95!==null&&snapshot.displayIntervals.max!==null&&snapshot.missedVsyncCount>0);
assert.equal(/device|poseTimestamp|landmark|pixel|geometry|sourceId/u.test(encoded),false,`private aggregate contains prohibited detail: ${encoded}`);
recorder.reset("x".repeat(100),2000);assert.equal(recorder.snapshot(2000).label.length,32);assert.deepEqual(recorder.snapshot(2000).displayIntervals,{count:0,p50:null,p95:null,max:null});
console.log("Bounded aggregate-only display/CV/renderer/camera performance recorder validation passed.");
