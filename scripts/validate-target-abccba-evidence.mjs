import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const evidencePath=resolve(process.argv[2]??"");
if(!process.argv[2])throw new Error("Usage: node scripts/validate-target-abccba-evidence.mjs <evidence.json>");
const evidence=JSON.parse(await readFile(evidencePath,"utf8"));
const sequence=["A","B","C","C","B","A"],privacy={screenshots:false,traceSnapshots:false,rawPoses:false,pixels:false,deviceIds:false,privateGeometry:false};
const benchmark={contract:"aerobeat/abccba_explicit_null_spawn_lead.v1",eventCount:6000,indexOptions:{normalSpawnLeadMs:null},projectedTargetCountBounds:{min:0,max:1}};
assert.equal(evidence.schema,"aerobeat/private_abccba_profile");
assert.equal(evidence.version,1);
assert.equal(evidence.windowMs,4000,"authoritative target evidence requires exact four-second windows");
assert.deepEqual(evidence.sequence,sequence);
assert.deepEqual(evidence.benchmark,benchmark);
assert.deepEqual(evidence.privacy,privacy);
assert.deepEqual(evidence.noise,[]);
assert.equal(evidence.profileRuns.length,12);
for(const implementation of ["legacy","staged"]){
  const runs=evidence.profileRuns.filter(run=>run.label.startsWith(`${implementation}-`));
  assert.deepEqual(runs.map(run=>run.label.match(/-([ABC])\d+$/u)?.[1]),sequence,`${implementation} order must be exact ABCCBA`);
}
for(const run of evidence.profileRuns){
  assert.equal(run.schema,"aerobeat/private_performance_window");assert.equal(run.version,1);
  assert(Number.isFinite(run.durationMs)&&run.durationMs>=3900&&run.durationMs<5000);
  assert(Number.isInteger(run.displayFrameCount)&&run.displayFrameCount>0);assert(Number.isFinite(run.displayRateFps)&&run.displayRateFps>0);
  assert.deepEqual({contract:run.workload.contract,eventCount:run.workload.eventCount},{contract:benchmark.contract,eventCount:benchmark.eventCount});
  const targetCount=run.workload.projectedTargetCount;assert.equal(targetCount.count,run.displayFrameCount);assert(Number.isInteger(targetCount.min)&&targetCount.min>=0);assert(Number.isInteger(targetCount.max)&&targetCount.max<=1);assert(targetCount.min<=targetCount.mean&&targetCount.mean<=targetCount.max);
  assert.deepEqual(run.camera,{width:640,height:480,frameRate:30});
  assert(Number.isFinite(run.cv.submissionRateFps)&&run.cv.submissionRateFps<=15.01);
  const mode=run.label.match(/-([ABC])\d+$/u)?.[1];if(mode==="A"){assert.equal(run.cv.submittedFrameCount,0);assert.equal(run.cv.poseFrameCount,0);assert.equal(run.poseAgeMs.count,0);}else if(run.label.startsWith("staged-")){assert(run.cv.submittedFrameCount>0&&run.cv.poseFrameCount>0);assert(Number.isFinite(run.poseAgeMs.max)&&run.poseAgeMs.max<500);}
  if(run.label.startsWith("staged-"))assert(run.displayRateFps>=45,`${run.label} display ${run.displayRateFps} FPS is below 45`);
}
const stagedMean=mode=>mean(evidence.profileRuns.filter(run=>run.label.startsWith(`staged-${mode}`)).map(run=>run.displayRateFps));
const stagedA=stagedMean("A"),stagedB=stagedMean("B"),stagedC=stagedMean("C"),ba=stagedB/stagedA,cb=stagedC/stagedB;
assert(ba>=.90,`staged B/A ${ba} is below .90`);assert(cb>=.90,`staged C/B ${cb} is below .90`);
const maxCv=Math.max(...evidence.profileRuns.map(run=>run.cv.submissionRateFps)),maxPose=Math.max(...evidence.profileRuns.filter(run=>/^staged-[BC]/u.test(run.label)).map(run=>run.poseAgeMs.max));
console.log(`ORACLE target-abccba-evidence PASS: stagedMin=${Math.min(...evidence.profileRuns.filter(run=>run.label.startsWith("staged-")).map(run=>run.displayRateFps)).toFixed(3)}, B/A=${ba.toFixed(4)}, C/B=${cb.toFixed(4)}, cvMax=${maxCv.toFixed(3)}, poseMax=${maxPose.toFixed(1)}, workload=0..1@${benchmark.eventCount}`);
function mean(values){assert(values.length>0);return values.reduce((sum,value)=>sum+value,0)/values.length;}
