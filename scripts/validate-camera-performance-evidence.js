// @ts-check

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [gpu,cpu,abccba]=await Promise.all([
  load("../.plans/evidence/2026-09-05-mi6-worker-benchmark.json"),
  load("../.plans/evidence/2026-09-05-mi6-worker-cpu-benchmark.json"),
  load("../.plans/evidence/2026-09-05-mi6-local-abccba.json")
]);
const privacy={screenshots:false,traceSnapshots:false,rawPoses:false,pixels:false,deviceIds:false,privateGeometry:false};
validateWorkerEvidence(gpu,"gpu-webgl");
validateWorkerEvidence(cpu,"cpu-wasm");
assert.deepEqual(gpu.privacy,privacy);
assert.deepEqual(cpu.privacy,privacy);
assert.deepEqual(gpu.noise,[]);
assert.deepEqual(cpu.noise,[]);

const gpuCandidate=candidateRuns(gpu,"worker-gpu");
assert.equal(gpuCandidate.length,2);
assert(gpuCandidate.every((run)=>run.poseAgeMs.max>=500),"GPU-worker must be rejected by the existing 500 ms measured-pose freshness boundary in both B/C windows");
assert(gpuCandidate.every((run)=>run.cv.submissionRateFps<=15.01),"GPU rejection cannot be disguised as cadence overflow");

const cpuReference=candidateRuns(cpu,"direct-gpu");
const cpuCandidate=candidateRuns(cpu,"worker-cpu-wasm");
assert.equal(cpuReference.length,2);
assert.equal(cpuCandidate.length,2);
for(const mode of ["B","C"]){
  const reference=cpuReference.find((run)=>run.label.endsWith(`-${mode}`));
  const candidate=cpuCandidate.find((run)=>run.label.endsWith(`-${mode}`));
  assert(reference&&candidate);
  assert(candidate.displayRateFps/reference.displayRateFps>=2,`CPU worker ${mode} must materially improve local display by at least 2x over the paired direct-GPU evidence`);
  assert(candidate.poseAgeMs.max<500,`CPU worker ${mode} must retain measured pose freshness below 500 ms`);
  assert(candidate.cv.submissionRateFps<=15.01&&candidate.cv.poseFrameCount>0,`CPU worker ${mode} must produce measured poses within the 15fps ceiling`);
}
assert.equal(cpu.worker.rejected,0);

assert.equal(abccba.schema,"aerobeat/private_abccba_profile");
assert.equal(abccba.version,1);
assert.equal(abccba.windowMs,4000,"committed local evaluation uses bounded reproducible four-second windows");
assert.deepEqual(abccba.sequence,["A","B","C","C","B","A"]);
assert.equal(abccba.profileRuns.length,12,"local evaluation must contain two complete six-window ABCCBA blocks");
assert.deepEqual(abccba.privacy,privacy);
assert.deepEqual(abccba.noise,[]);
for(const implementation of ["legacy","staged"]){
  const runs=abccba.profileRuns.filter((run)=>run.label.startsWith(`${implementation}-`));
  assert.deepEqual(runs.map((run)=>run.label.match(/-([ABC])\d+$/u)?.[1]),abccba.sequence,`${implementation} run order must be exact ABCCBA`);
  for(const run of runs){validateWindow(run);const mode=run.label.match(/-([ABC])\d+$/u)?.[1];if(mode==="A"){assert.equal(run.cv.submittedFrameCount,0);assert.equal(run.cv.poseFrameCount,0);assert.equal(run.poseAgeMs.count,0);}else{assert(run.cv.submittedFrameCount>0&&run.cv.poseFrameCount>0);assert(run.cv.submissionRateFps<=15.01);}}
}
const modes={};
for(const mode of ["A","B","C"]){
  const legacy=mean(abccba.profileRuns.filter((run)=>run.label.startsWith(`legacy-${mode}`)).map((run)=>run.displayRateFps));
  const staged=mean(abccba.profileRuns.filter((run)=>run.label.startsWith(`staged-${mode}`)).map((run)=>run.displayRateFps));
  assert(staged/legacy>=1.25,`staged ${mode} local display mean must improve at least 25%`);
  modes[mode]={legacy,staged,gain:staged/legacy};
}
const stagedA=modes.A.staged,stagedB=modes.B.staged,stagedC=modes.C.staged;
assert(stagedB/stagedA>=.90,"measured hidden-camera Aero must retain at least 90% of staged render-only local display");
assert(stagedC/stagedB>=.90,"visible Camera composition must retain at least 90% of paired measured Aero local display");
for(const run of abccba.profileRuns.filter((entry)=>/^staged-[BC]/u.test(entry.label))){assert(run.poseAgeMs.max<500);assert(run.cv.submissionRateFps<=15.01);}
assert(!JSON.stringify({gpu,cpu,abccba}).includes("physicalPassClaimed"),"historical local evidence cannot contain a physical PASS claim");
console.log(`ORACLE camera-performance-evidence PASS: production=cpu-wasm-worker, gpuRejectedWindows=${gpuCandidate.length}/2@poseAge>=500ms, cpuSelectedWindows=${cpuCandidate.length}/2@fresh<500ms+>=2x, abccbaRuns=${abccba.profileRuns.length}, stagedB/A=${(stagedB/stagedA).toFixed(4)}, stagedC/B=${(stagedC/stagedB).toFixed(4)}, bugPhysicalThresholdClaim=false`);

async function load(relative){return JSON.parse(await readFile(new URL(relative,import.meta.url),"utf8"));}
function validateWorkerEvidence(value,delegate){
  assert.equal(value.schema,"aerobeat/private_worker_benchmark");assert.equal(value.version,1);assert.equal(value.windowMs,4000);assert.equal(value.runs.length,4);
  assert.equal(value.worker.execution.location,"worker");assert.equal(value.worker.execution.fallback,false);assert.equal(value.worker.execution.transferFrameType,"VideoFrame");
  assert.equal(value.worker.oneInFlight,true);assert.equal(value.worker.latestWinsAdmissionBeforeTransfer,true);assert.equal(value.worker.acceptedFrameClosedInWorker,true);assert.equal(value.worker.rejectedFrameClosedByAdapter,true);assert.equal(value.worker.exactCaptureTimestamp,true);
  assert(value.worker.execution.detail.includes(delegate==="cpu-wasm"?"CPU/WASM":"GPU/WebGL"));assert(value.worker.execution.detail.includes("thresholds detection 0.5 presence 0.5 tracking 0.5"));
  for(const run of value.runs)validateWindow(run);
}
function validateWindow(run){
  assert.equal(run.schema,"aerobeat/private_performance_window");assert.equal(run.version,1);assert(typeof run.label==="string"&&run.label.length>0);assert(Number.isFinite(run.durationMs)&&run.durationMs>=3900&&run.durationMs<5000);assert(Number.isFinite(run.displayRateFps)&&run.displayRateFps>0);assert(Number.isInteger(run.displayFrameCount)&&run.displayFrameCount>0);
  for(const key of ["displayIntervals","rendererCpuMs","mediaPipeRuntimeMs","mediaPipeEndToEndMs","poseAgeMs"]){const metric=run[key];assert(Number.isInteger(metric.count)&&metric.count>=0);for(const field of ["p50","p95","max"])assert(metric[field]===null||(Number.isFinite(metric[field])&&metric[field]>=0));}
  assert(Number.isFinite(run.cv.submissionRateFps)&&run.cv.submissionRateFps>=0&&run.cv.submissionRateFps<=15.01);assert(Number.isFinite(run.camera.width)&&Number.isFinite(run.camera.height)&&Number.isFinite(run.camera.frameRate));
}
function candidateRuns(value,prefix){return value.runs.filter((run)=>run.label.startsWith(prefix));}
function mean(values){assert(values.length>0);return values.reduce((sum,value)=>sum+value,0)/values.length;}
