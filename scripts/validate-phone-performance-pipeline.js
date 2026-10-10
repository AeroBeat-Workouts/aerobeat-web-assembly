// @ts-check
import assert from "node:assert/strict";
import { createPhonePerformancePipeline } from "../src/phone-performance-pipeline.js";

const p=createPhonePerformancePipeline();
p.reset(5);
assert.equal(p.checkAvailability({ready:false,fresh:false,recent:false}),false);
assert.equal(p.checkAvailability({ready:true,fresh:false,recent:true}),false);
assert.equal(p.checkAvailability({ready:true,fresh:true,recent:false}),false);
assert.equal(p.checkAvailability({ready:true,fresh:true,recent:true}),true);
p.admitted(100);const first=p.adapterCalled(102);p.settled(first,190,{workerRoundTripDurationMs:85,runtimeInferenceDurationMs:80,postprocessDurationMs:2});
p.admitted(234);const second=p.adapterCalled(236);p.settled(second,327,{workerRoundTripDurationMs:86,runtimeInferenceDurationMs:81,postprocessDurationMs:2});
const report=p.snapshot(7);
assert.deepEqual(report.counts,{busySkips:2,availabilityChecks:4,observedOpportunities:6,readyFailures:1,heldFrameChecks:1,staleFrameChecks:1,freshChecks:1,admissions:2,adapterCalls:2,completed:2,estimateFailures:0,unpairedWorkerTimings:0});
assert.deepEqual(report.timingsMs.admissionGapMs,{count:1,p50:134,p95:134,max:134});
assert.deepEqual(report.timingsMs.completionToAdmissionMs,{count:1,p50:44,p95:44,max:44});
assert.deepEqual(report.timingsMs.sourceToAdapterMs,{count:2,p50:2,p95:2,max:2});
assert.deepEqual(report.timingsMs.workerOtherCombinedMs,{count:2,p50:3,p95:3,max:3});
assert.deepEqual(report.timingsMs.adapterWallMs,{count:2,p50:88,p95:91,max:91});
assert(!JSON.stringify(report).includes('"at"'),"Only bounded scalar statistics, no per-frame timestamps");
p.admitted(350);const failed=p.adapterCalled(351);p.settled(failed,352,null,true);
assert.equal(p.snapshot(8).counts.estimateFailures,1);
p.stop();p.settled(second,380,null);assert.equal(p.snapshot(8).counts.completed,2,"Stop excludes late completions");
p.reset(11);p.settled(first,400,null);const empty=p.snapshot(11);
assert.equal(empty.counts.observedOpportunities,0);assert.equal(empty.counts.completed,0);assert.equal(empty.timingsMs.workerRoundTripMs.count,0,"Retry resets timing and ignores stale epochs");
for(let i=0;i<520;i++){p.admitted(500+i*100);const ticket=p.adapterCalled(501+i*100);p.settled(ticket,585+i*100,{workerRoundTripDurationMs:83,runtimeInferenceDurationMs:80,postprocessDurationMs:1});}
const bounded=p.snapshot(11);assert.equal(bounded.counts.admissions,520);assert.equal(bounded.timingsMs.inferenceMs.count,512);assert.equal(bounded.timingsMs.workerRoundTripMs.count,512);
console.log("Phone pipeline timing unit gate passed: busy/fresh counts, paired segments, reset, bounded samples and scalar privacy.");
