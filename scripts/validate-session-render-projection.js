// @ts-check

import assert from "node:assert/strict";
import { createAuthoredBeatToTimelineMs } from "@aerobeat/web-content";
import { buildGameplaySceneModel } from "@aerobeat/web-renderer";
import { createSessionTargetIndex, guidanceBeatTimestamps, projectSessionTargets } from "../src/session-render-projection.js";

const events = Object.freeze([
  Object.freeze({ eventId:"flow-1", centerTimestampMs:1000, appearanceColor:"#FF0000", authoredBeat:Object.freeze({type:"note",hand:"left",placement:4,direction:2}) }),
  Object.freeze({ eventId:"flow-2", centerTimestampMs:2000, appearanceColor:"#808080", authoredBeat:Object.freeze({type:"note",hand:"right",placement:7,direction:"up"}) })
]);
const playSession = Object.freeze({ session:Object.freeze({purpose:"play"}), judgements:Object.freeze([]), shadowJudgements:Object.freeze([]), scorePartitions:Object.freeze([]) });
const straightIndex=createSessionTargetIndex(events,{bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:0});
assert.equal(straightIndex.timingMapperUnavailableCount,2,"missing mapper is a truthful nonzero private diagnostic");
const pending = projectSessionTargets(events, playSession, 900,straightIndex);
const invalidAppearanceEvent={eventId:"invalid-color",centerTimestampMs:1000,appearanceColor:"#ff0000",authoredBeat:{type:"note",hand:"left",placement:4,direction:2}},invalidAppearanceEvents=[invalidAppearanceEvent],invalidAppearanceIndex=createSessionTargetIndex(invalidAppearanceEvents,{bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:0});
assert.equal(pending.length,2); assert.equal(pending[0].judgement,"pending"); assert.equal(pending[0].direction,"left");assert.deepEqual(pending.map((target)=>target.appearanceColor),["#FF0000","#808080"],"validated private Flow appearance reaches renderer targets");const invalidAppearance=projectSessionTargets(invalidAppearanceEvents,playSession,900,invalidAppearanceIndex)[0];assert.equal(Object.hasOwn(invalidAppearance,"appearanceColor"),false,"noncanonical private appearance is not forwarded");

const hit = Object.freeze({ eventId:"flow-1",result:"hit",shadow:false,committedTimelinePositionMs:1000 });
const playHit = Object.freeze({ ...playSession, judgements:Object.freeze([hit]) });
const hitBeforeCommit=projectSessionTargets(events,playHit,999,straightIndex)[0]; assert.equal(hitBeforeCommit.judgement,"pending","real hit remains pending before exact authoritative commit"); assert.equal(hitBeforeCommit.feedbackProgress,undefined);
const hitStart=projectSessionTargets(events,playHit,1000,straightIndex)[0]; assert.equal(hitStart.judgement,"hit"); assert.equal(hitStart.feedbackProgress,0,"hit feedback starts at exact committed timeline");
assert.equal(projectSessionTargets(events,playHit,1175,straightIndex)[0].feedbackProgress,.5);
assert.equal(projectSessionTargets(events,playHit,1349,straightIndex)[0].feedbackProgress,349/350);
assert.equal(projectSessionTargets(events,playHit,1350,straightIndex).some((entry)=>entry.id==="flow-1"),false,"hit feedback leaves at the exact common feedback boundary");

const miss = Object.freeze({ eventId:"flow-1",result:"miss",shadow:false,committedTimelinePositionMs:1181 });
const playMiss = Object.freeze({ ...playSession, judgements:Object.freeze([miss]) });
const missBeforeCommit=projectSessionTargets(events,playMiss,1180,straightIndex)[0]; assert.equal(missBeforeCommit.judgement,"pending","real miss remains pending before exact authoritative commit"); assert.equal(missBeforeCommit.feedbackProgress,undefined);
const missStart=projectSessionTargets(events,playMiss,1181,straightIndex)[0]; assert.equal(missStart.judgement,"miss"); assert.equal(missStart.missCommitMs,1181);assert.equal(missStart.feedbackProgress,undefined,"late miss owns a separate absolute commit clock rather than restarting travel progress");
const missLate=projectSessionTargets(events,playMiss,1530,straightIndex)[0];assert.equal(missLate.missCommitMs,1181);assert.equal(projectSessionTargets(events,playMiss,1531,straightIndex).some((entry)=>entry.id==="flow-1"),false,"miss projection expires at exact commit plus 350 ms");
const renderedMisses=[1181,1182,1530,1531].map((nowMs)=>{const targets=projectSessionTargets(events,playMiss,nowMs,straightIndex,180),model=buildGameplaySceneModel({presentation:"flow",nowMs,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets}),icon=model.objects.find((entry)=>entry.targetId==="flow-1"&&entry.kind==="icon"),shadow=model.objects.find((entry)=>entry.targetId==="flow-1"&&entry.kind==="shadow"),label=model.objects.find((entry)=>entry.targetId==="flow-1"&&entry.kind==="feedback");return{nowMs,targetId:targets.find((entry)=>entry.id==="flow-1")?.id??null,iconId:icon?.targetId??null,shadowId:shadow?.targetId??null,labelId:label?.targetId??null,z:icon?.position.z??null,color:icon?.appearanceColor??null,text:label?.feedback?.text??null};});assert.deepEqual(renderedMisses,[{nowMs:1181,targetId:"flow-1",iconId:"flow-1",shadowId:"flow-1",labelId:"flow-1",z:1.086,color:"#7c828c",text:"Miss"},{nowMs:1182,targetId:"flow-1",iconId:"flow-1",shadowId:"flow-1",labelId:"flow-1",z:1.092,color:"#7c828c",text:"Miss"},{nowMs:1530,targetId:"flow-1",iconId:"flow-1",shadowId:"flow-1",labelId:"flow-1",z:3.18,color:"#7c828c",text:"Miss"},{nowMs:1531,targetId:null,iconId:null,shadowId:null,labelId:null,z:null,color:null,text:null}],"same-ID gray moving miss and Miss label remain for full post-commit interval then cull exactly once");
const commitDescriptor=Object.getOwnPropertyDescriptor(missStart,"missCommitMs");assert(commitDescriptor?.enumerable&&"value" in commitDescriptor&&commitDescriptor.value===1181,"assembly emits renderer miss commit as exact own enumerable data");let crossPackageGetterCalls=0;const missWithoutCommit={...missStart};delete missWithoutCommit.missCommitMs;const accessorMiss={...missWithoutCommit};Object.defineProperty(accessorMiss,"missCommitMs",{enumerable:true,get(){crossPackageGetterCalls+=1;return 1181;}});const inheritedPrototype={};Object.defineProperty(inheritedPrototype,"missCommitMs",{enumerable:true,get(){crossPackageGetterCalls+=1;return 1181;}});const inheritedMiss=Object.assign(Object.create(inheritedPrototype),missWithoutCommit),nonEnumerableMiss={...missWithoutCommit};Object.defineProperty(nonEnumerableMiss,"missCommitMs",{enumerable:false,value:1181});for(const hostile of[accessorMiss,inheritedMiss,nonEnumerableMiss])assert.throws(()=>buildGameplaySceneModel({presentation:"flow",nowMs:1181,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[hostile]}),/exact committed timestamp/);assert.equal(crossPackageGetterCalls,0,"linked renderer rejects hostile assembly-boundary miss descriptors without getter invocation");
const boundaryDescriptorAttacks=(base,key,value)=>{const ownUndefined={...base,[key]:undefined},ownAccessor={...base};Object.defineProperty(ownAccessor,key,{enumerable:true,get(){crossPackageGetterCalls+=1;return value;}});const inheritedData=Object.assign(Object.create({[key]:value}),base),prototype={};Object.defineProperty(prototype,key,{enumerable:true,get(){crossPackageGetterCalls+=1;return value;}});const inheritedAccessor=Object.assign(Object.create(prototype),base),nonEnumerable={...base};Object.defineProperty(nonEnumerable,key,{enumerable:false,value});return[ownUndefined,ownAccessor,inheritedData,inheritedAccessor,nonEnumerable];},rendererFrame=(target,nowMs=1181)=>({presentation:"flow",nowMs,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[target]});for(const hostile of boundaryDescriptorAttacks(missStart,"feedbackProgress",undefined))assert.throws(()=>buildGameplaySceneModel(rendererFrame(hostile)),/no feedback progress/);const hitDescriptor=Object.getOwnPropertyDescriptor(hitStart,"feedbackProgress");assert(hitDescriptor?.enumerable&&"value" in hitDescriptor&&hitDescriptor.value===0,"assembly emits renderer hit progress as exact own enumerable data");const hitWithoutProgress={...hitStart};delete hitWithoutProgress.feedbackProgress;assert.throws(()=>buildGameplaySceneModel(rendererFrame(hitWithoutProgress,1000)),/feedback progress is required/);for(const hostile of boundaryDescriptorAttacks(hitWithoutProgress,"feedbackProgress",.5))assert.throws(()=>buildGameplaySceneModel(rendererFrame(hostile,1000)),/feedback progress is required/);for(const hostile of boundaryDescriptorAttacks(missBeforeCommit,"feedbackProgress",undefined))assert.throws(()=>buildGameplaySceneModel(rendererFrame(hostile,1180)),/forbidden on non-hit/);assert.equal(crossPackageGetterCalls,0,"linked renderer rejects hostile feedback progress descriptors without getter invocation across miss, hit, and pending states");

const shadowOnly=Object.freeze({ ...playSession, judgements:Object.freeze([{...hit,shadow:true}]) }); assert.equal(projectSessionTargets(events,shadowOnly,1100,straightIndex)[0].judgement,"pending","shadow judgement never drives production feedback");
const testTruth=Object.freeze({ session:Object.freeze({purpose:"visual_test"}),judgements:Object.freeze([]),shadowJudgements:Object.freeze([]),scorePartitions:Object.freeze([]) });
const truthBefore=JSON.stringify(testTruth);
const syntheticFirst=projectSessionTargets(events,testTruth,1100,straightIndex); assert.equal(syntheticFirst[0].judgement,"hit"); assert.equal(syntheticFirst[1].judgement,"pending");
const unsortedEvents=Object.freeze([events[1],events[0]]),unsortedIndex=createSessionTargetIndex(unsortedEvents,{bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:0}),syntheticUnsorted=projectSessionTargets(unsortedEvents,testTruth,1100,unsortedIndex); assert.equal(syntheticUnsorted[0].id,"flow-1"); assert.equal(syntheticUnsorted[0].judgement,"hit","stable timeline sort owns parity and always begins hit-first"); assert.equal(syntheticUnsorted[1].id,"flow-2"); assert.equal(syntheticUnsorted[1].judgement,"pending");
const syntheticSecond=projectSessionTargets(events,testTruth,2181,straightIndex); assert.equal(syntheticSecond.length,1); assert.equal(syntheticSecond[0].id,"flow-2"); assert.equal(syntheticSecond[0].judgement,"miss"); assert.equal(syntheticSecond[0].missCommitMs,2181);assert.equal(syntheticSecond[0].feedbackProgress,undefined);
assert.equal(JSON.stringify(testTruth),truthBefore,"synthetic projection must not mutate gameplay judgement or score truth");
assert.equal(projectSessionTargets(events,testTruth,2530,straightIndex)[0].missCommitMs,2181); assert.equal(projectSessionTargets(events,testTruth,2531,straightIndex).length,0);

const sourceGeometry=Object.freeze({schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v2_legacy_obstacle",kind:"v2_type_1",x:1,y:2,width:1,height:3});
const gameplayGeometry=Object.freeze({schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:1,y:0,width:1,height:3});
const actualObstacle = Object.freeze({
  eventId:"ab-chart-dance-dance-revolution-ddrmix-flow-hard:event:20",
  centerTimestampMs:37039.99938964844,
  intervalStartTimestampMs:37039.99938964844, intervalEndTimestampMs:37064.99938964844,
  authoredBeat:Object.freeze({start:92.5999984741211,end:92.6624984741211,type:"obstacle",sourceGeometry,gameplayGeometry,gridMask:Object.freeze([1,5,9])})
});
// zcsh oracle D: with sky prelude on, the obstacle's first visible frame is the shared note boundary (S-L-D); the head is exact (now-S)*0.006 there, and the wall is absent 1 ms before.
const dFallbackLead=2500;
{
  const dSkyD=500;
  const dStart=actualObstacle.intervalStartTimestampMs;
  const dEvents=Object.freeze([actualObstacle]);
  const dPreludeIndex=createSessionTargetIndex(dEvents,{bounceLeadBeats:4,normalSpawnLeadMs:dFallbackLead,skyMode:"prelude",skyPreludeDurationMs:dSkyD});
  assert.equal(projectSessionTargets(dEvents,testTruth,dStart-dFallbackLead-dSkyD-.001,dPreludeIndex).length,0,"D prelude obstacle stays hidden strictly before the shared sky start S-L-D");
  assert.equal(projectSessionTargets(dEvents,testTruth,dStart-dFallbackLead-dSkyD,dPreludeIndex).length,1,"D prelude obstacle enters at the exact shared sky start S-L-D");
  const dAtSky=projectSessionTargets(dEvents,testTruth,dStart-dFallbackLead-dSkyD,dPreludeIndex)[0];
  const dModel=buildGameplaySceneModel({presentation:"flow",nowMs:dStart-dFallbackLead-dSkyD,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[dAtSky]});
  const dWall=dModel.objects.find((entry)=>entry.targetId===actualObstacle.eventId&&entry.kind==="obstacle");
  assert.ok(dWall,"D prelude obstacle scene object is present at the shared sky start");
  const dExpectedHead=(actualObstacle.intervalStartTimestampMs-dFallbackLead-dSkyD-actualObstacle.intervalStartTimestampMs)*0.006;
  assert.ok(Math.abs((dWall.position.z+dWall.scale.z/2)-dExpectedHead)<1e-9,`D prelude obstacle leading face equals exact (now-S)*0.006 at the sky start: ${JSON.stringify(dWall.position)}`);
  const dOffLead=8334;
  const dOffIndex=createSessionTargetIndex(dEvents,{bounceLeadBeats:4,normalSpawnLeadMs:dOffLead,skyMode:"off",skyPreludeDurationMs:dSkyD});
  assert.equal(projectSessionTargets(dEvents,testTruth,dStart-dOffLead,dOffIndex).length,1,"D off-mode obstacle still enters at the normal spawn row S-L");
  assert.equal(projectSessionTargets(dEvents,testTruth,dStart-dOffLead-.001,dOffIndex).length,0,"D off-mode obstacle stays hidden before S-L");
}
assert.equal(projectSessionTargets([actualObstacle],testTruth,actualObstacle.intervalStartTimestampMs-dFallbackLead-.001).length,0,"D off default: obstacle stays hidden before the visible spawn row");
for (const nowMs of [actualObstacle.centerTimestampMs, (actualObstacle.centerTimestampMs+actualObstacle.intervalEndTimestampMs)/2, actualObstacle.intervalEndTimestampMs]) {
  assert.deepEqual(projectSessionTargets([actualObstacle],testTruth,nowMs),[{
    id:actualObstacle.eventId,kind:"obstacle",hand:"neutral",family:"obstacle",cell:null,cells:[1,5,9],sourceGeometry,gameplayGeometry,lane:null,
    beatCenterMs:actualObstacle.centerTimestampMs,intervalStartMs:actualObstacle.centerTimestampMs,intervalEndMs:actualObstacle.intervalEndTimestampMs,normalSpawnMs:actualObstacle.intervalStartTimestampMs-dFallbackLead
  }],`D actual obstacle remains exact and feedback-free at ${nowMs}`);
}
assert.equal(projectSessionTargets([actualObstacle],testTruth,actualObstacle.intervalEndTimestampMs+.001).length,0,"actual obstacle leaves immediately after exact end");
const obstacleEarlier=projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-1000);
projectSessionTargets([actualObstacle],testTruth,actualObstacle.intervalEndTimestampMs);
const obstacleEarlierAfterForward=projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-1000);
assert.deepEqual(obstacleEarlierAfterForward,obstacleEarlier,"forward-then-backward projection reconstructs the exact earlier obstacle state");
// q1j3 oracles A/B: wall rigid-column travel at exactly 0.006 WU/ms with head/tail ts2z parity, absent before / present at the visible spawn row.
{
  const S=20000,E=22000,LEAD_MS=50/0.006;
  const longGeom=Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2});
  const wall=Object.freeze({eventId:"travel-wall",centerTimestampMs:S,intervalStartTimestampMs:S,intervalEndTimestampMs:E,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:longGeom,gridMask:Object.freeze([1,2,5,6])})});
  const wallIndex=createSessionTargetIndex([wall],{bounceLeadBeats:4,normalSpawnLeadMs:LEAD_MS,skyMode:"off",skyPreludeDurationMs:0});
  const wallTarget=(nowMs)=>{const result=projectSessionTargets([wall],testTruth,nowMs,wallIndex);return result.find((entry)=>entry.id==="travel-wall")??null;};
  // Find the exact admission boundary by bisection.
  let lo=S-LEAD_MS-1,hi=S;for(let i=0;i<80;i+=1){const mid=(lo+hi)/2;if(wallTarget(mid))hi=mid;else lo=mid;}
  const admissionRow=Math.ceil(hi);
  assert.equal(wallTarget(admissionRow-1)?.id,undefined,`B wall is absent strictly before its admission row ${admissionRow}`);
  const atRow=wallTarget(admissionRow);assert.equal(atRow?.id,"travel-wall",`B wall is present exactly at its admission row ${admissionRow} (regression guard for the pop-in)`);
  assert.equal(typeof atRow.normalSpawnMs,"number",`B wall carries a finite song-derived normalSpawnMs at its admission row`);
  const modelFor=(nowMs)=>buildGameplaySceneModel({presentation:"flow",nowMs,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[...(wallTarget(nowMs)?[wallTarget(nowMs)]:[])]});
  assert.equal(modelFor(admissionRow-1).objects.some((entry)=>entry.targetId==="travel-wall"&&entry.kind==="obstacle"),false,"A wall scene object is culled strictly before its admission row");
  assert.ok(modelFor(admissionRow).objects.some((entry)=>entry.targetId==="travel-wall"&&entry.kind==="obstacle"),"B wall scene object is present at its admission row");
  // A: rigid column at exactly 0.006 WU/ms with head/tail ts2z parity across the full visible window.
  const samples=[];for(let nowMs=admissionRow;nowMs<=E+200;nowMs+=16){const target=wallTarget(nowMs);if(!target)continue;const wallObj=modelFor(nowMs).objects.find((entry)=>entry.targetId==="travel-wall"&&entry.kind==="obstacle");if(!wallObj)break;const zHead=(nowMs-S)*0.006,zTail=(nowMs-E)*0.006;samples.push({nowMs,z:wallObj.position.z,depth:wallObj.scale.z,expectedCenter:(zHead+zTail)/2,expectedDepth:Math.abs(zTail-zHead)});}assert.ok(samples.length>=20,"A wall must sample across its visible travel window");samples.forEach((sample,index)=>{assert.ok(Math.abs(sample.z-sample.expectedCenter)<1e-9,`A wall center z equals head/tail ts2z midpoint at ${sample.nowMs}`);assert.ok(Math.abs(sample.depth-sample.expectedDepth)<1e-9,`A wall depth spans the exact authored interval at ${sample.nowMs}`);if(index>0){const previous=samples[index-1],velocity=(previous.z-sample.z)/(sample.nowMs-previous.nowMs);assert.ok(Math.abs(Math.abs(velocity)-0.006)<1e-12,`A wall travels as one rigid column at exactly 0.006 WU/ms between ${previous.nowMs} and ${sample.nowMs}`);}});
}
// q1j3 oracle C: bomb/note travel parity (same normalSpawnMs, same z at sampled times, same entry boundary).
{
  const C=20000,LEAD_MS=8334,lead=LEAD_MS;
  const noteEvent=Object.freeze({eventId:"parity-note",centerTimestampMs:C,appearanceColor:"#FF0000",authoredBeat:Object.freeze({type:"note",hand:"left",placement:4,direction:2})});
  const bombEvent=Object.freeze({eventId:"parity-bomb",centerTimestampMs:C,authoredBeat:Object.freeze({type:"bomb",placement:4})});
  const bothEvents=Object.freeze([noteEvent,bombEvent]);
  const index=createSessionTargetIndex(bothEvents,{bounceLeadBeats:4,normalSpawnLeadMs:lead,skyMode:"off",skyPreludeDurationMs:0});
  const noteAtC=projectSessionTargets(bothEvents,testTruth,C,index).find((entry)=>entry.id==="parity-note");
  const bombAtC=projectSessionTargets(bothEvents,testTruth,C,index).find((entry)=>entry.id==="parity-bomb");
  assert.equal(noteAtC?.normalSpawnMs,C-lead,"C note carries the song-derived normalSpawnMs");
  assert.equal(bombAtC?.normalSpawnMs,C-lead,"C bomb now carries the same song-derived normalSpawnMs");
  const entryNote=projectSessionTargets(bothEvents,testTruth,C-lead,index).some((entry)=>entry.id==="parity-note");
  const entryBomb=projectSessionTargets(bothEvents,testTruth,C-lead,index).some((entry)=>entry.id==="parity-bomb");
  const preEntryNote=projectSessionTargets(bothEvents,testTruth,C-lead-1,index).some((entry)=>entry.id==="parity-note");
  const preEntryBomb=projectSessionTargets(bothEvents,testTruth,C-lead-1,index).some((entry)=>entry.id==="parity-bomb");
  assert.deepEqual([entryNote,entryBomb],[true,true],"C note and bomb both enter visibility at the same nowMs=C-LEAD");
  assert.deepEqual([preEntryNote,preEntryBomb],[false,false],"C note and bomb are both absent strictly before C-LEAD");
  const modelNow=(nowMs)=>{const targets=projectSessionTargets(bothEvents,testTruth,nowMs,index);return buildGameplaySceneModel({presentation:"flow",nowMs,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets});};
  for(const offset of [lead,Math.round(lead/2),0]){const nowMs=C-offset;const model=modelNow(nowMs);const noteIcon=model.objects.find((entry)=>entry.targetId==="parity-note"&&entry.kind==="icon");const bombIcon=model.objects.find((entry)=>entry.targetId==="parity-bomb"&&entry.kind==="icon");const expectedZ=(nowMs-C)*0.006;if(noteIcon&&bombIcon){assert.ok(Math.abs(noteIcon.position.z-expectedZ)<1e-9,`C note z equals canonical (now-C)*0.006 at ${nowMs}`);assert.ok(Math.abs(bombIcon.position.z-expectedZ)<1e-9,`C bomb z equals canonical (now-C)*0.006 at ${nowMs}`);assert.equal(noteIcon.position.z,bombIcon.position.z,`C note and bomb share identical z at ${nowMs}`);}else if(offset===0){assert.ok(noteIcon&&bombIcon,"C both targets remain visible at center");}}
}
const longGameplayGeometry=Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2});
const longObstacle=Object.freeze({eventId:"long-obstacle",centerTimestampMs:1000,intervalStartTimestampMs:1000,intervalEndTimestampMs:2000,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:longGameplayGeometry,gridMask:Object.freeze([1,2,5,6])})});
assert.deepEqual({ start:projectSessionTargets([longObstacle],testTruth,1500)[0]?.intervalStartMs, end:projectSessionTargets([longObstacle],testTruth,1500)[0]?.intervalEndMs },{ start:1000,end:2000 },"long obstacle publishes its exact renderer duration interval beyond generic feedback lifetime");
assert.equal(projectSessionTargets([longObstacle],testTruth,2001).length,0,"long obstacle uses exact interval end");
const falseObstacleHit=Object.freeze({...testTruth,judgements:Object.freeze([{eventId:"long-obstacle",result:"hit",shadow:false,committedTimelinePositionMs:1000}])});
assert.equal(projectSessionTargets([longObstacle],falseObstacleHit,1200)[0]?.judgement,undefined,"obstacle ignores all synthetic/real feedback");
const noObstacleTruth=Object.freeze({...playSession,selectedVariant:Object.freeze({modifierIds:Object.freeze(["no_obstacles"])})});
assert.deepEqual(projectSessionTargets([longObstacle],noObstacleTruth,1200),[],"no_obstacles suppresses Flow visuals");
// q1j3 oracle D (R4): a no_obstacles-suppressed wall stays absent through its full visible travel window (the fix must not resurrect or hide it incorrectly).
{
  const S=10000,E=12000,LEAD_MS=8334;
  const longGeomS=Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2}),suppressedWall=Object.freeze({eventId:"suppressed-wall",centerTimestampMs:S,intervalStartTimestampMs:S,intervalEndTimestampMs:E,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:longGeomS,gridMask:Object.freeze([1,2,5,6])})});
  for(const nowMs of [S-LEAD_MS,S-1,S,(S+E)/2,E]){assert.deepEqual(projectSessionTargets([suppressedWall],noObstacleTruth,nowMs),[],`D no_obstacles wall stays absent at ${nowMs} despite the new visible-spawn gate`);}
  assert.equal(projectSessionTargets([suppressedWall],noObstacleTruth,S+1)[0]?.judgement,undefined,"D suppressed wall never acquires a synthetic outcome");
}
// id8w migration: a stored/stale Game Setup v3 value carrying the retired obstacle_visual_only modifier must load as Disabled — the conservative migration never starts scoring hazards the player was told do not count, so presentation suppression honors it exactly like no_obstacles.
{
  const migratedTruth=Object.freeze({...playSession,selectedVariant:Object.freeze({modifierIds:Object.freeze(["no_obstacles"]),provenance:Object.freeze({requestedModifierIds:Object.freeze(["obstacle_visual_only"]),effectiveModifierIds:Object.freeze(["no_obstacles"])})})});
  const enabledOnlyTruth=Object.freeze({...playSession,selectedVariant:Object.freeze({modifierIds:Object.freeze([])})});
  assert.deepEqual(projectSessionTargets([longObstacle],migratedTruth,1200),[],"id8w stored obstacle_visual_only migrates to no_obstacles (Disabled) and suppresses Flow obstacles");
  assert.equal(projectSessionTargets([longObstacle],enabledOnlyTruth,1200).length,1,"id8w Enabled (no modifier) keeps Flow obstacles visible");
  // The retired id itself, if ever present in a hostile or pre-migration runtime snapshot, is also suppressed rather than rendered.
  const staleRetiredTruth=Object.freeze({...playSession,selectedVariant:Object.freeze({modifierIds:Object.freeze(["obstacle_visual_only"])})});
  assert.deepEqual(projectSessionTargets([longObstacle],staleRetiredTruth,1200),[],"id8w a live retired obstacle_visual_only modifier still suppresses (never re-scores) Flow obstacles");
}
const contactTruth=Object.freeze({...playSession,selectedVariant:Object.freeze({modifierIds:Object.freeze([])}),obstacleOutcomes:Object.freeze([{eventId:"long-obstacle",result:"contact",firstContactTimelinePositionMs:1100}])});
assert.equal(projectSessionTargets([longObstacle],contactTruth,1100)[0]?.contactPulseProgress,0,"contact pulse starts at exact first contact");
assert.equal(projectSessionTargets([longObstacle],contactTruth,1275)[0]?.contactPulseProgress,.5);
assert.equal(projectSessionTargets([longObstacle],contactTruth,1451)[0]?.contactPulseProgress,undefined,"contact pulse is bounded to 350 ms");
// zcsh oracles: shared first-visible frame (wall==note), bomb/note parity, plumbing, no-motion, and edge cases.
// Use a simple linear mapper (500 ms per beat) so notes derive exact skyPreludeStartMs.
{
  const L=8334,D=1000,S=20000,E=22000,C=25000;
  const wallGeom=Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2});
  const wall=Object.freeze({eventId:"zcsh-wall",centerTimestampMs:S,intervalStartTimestampMs:S,intervalEndTimestampMs:E,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:wallGeom,gridMask:Object.freeze([1,2,5,6])})});
  const note=Object.freeze({eventId:"zcsh-note",centerTimestampMs:S,appearanceColor:"#FF0000",authoredBeat:Object.freeze({type:"note",start:S/500,hand:"left",placement:4,direction:2})});
  const bomb=Object.freeze({eventId:"zcsh-bomb",centerTimestampMs:C,authoredBeat:Object.freeze({type:"bomb",placement:4})});
  const bombNote=Object.freeze({eventId:"zcsh-bomb-note",centerTimestampMs:C,appearanceColor:"#00FF00",authoredBeat:Object.freeze({type:"note",start:C/500,hand:"right",placement:7,direction:1})});
  const allEvents=Object.freeze([wall,note,bomb,bombNote]);
  const zcshMapBeat=(beat)=>beat*500;
  const preludeIndex=createSessionTargetIndex(allEvents,{mapBeatToTimelineMs:zcshMapBeat,bounceLeadBeats:4,normalSpawnLeadMs:L,skyMode:"prelude",skyPreludeDurationMs:D});
  const offIndex=createSessionTargetIndex(allEvents,{mapBeatToTimelineMs:zcshMapBeat,bounceLeadBeats:4,normalSpawnLeadMs:L,skyMode:"off",skyPreludeDurationMs:D});
  const find=(nowMs,index,id)=>projectSessionTargets(allEvents,testTruth,nowMs,index).find((entry)=>entry.id===id)??null;
  const modelFor=(nowMs,index,id)=>{const target=find(nowMs,index,id);return{target,model:buildGameplaySceneModel({presentation:"flow",nowMs,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:target?[target]:[]})};};
  // Shared first-visible frame: wall [S,E] absent at S-L-D-1, present at S-L-D, with rigid z; side-by-side a note at the same center produces an icon on the SAME frame.
  const wallAtGate=find(S-L-D,preludeIndex,"zcsh-wall"),noteAtGate=find(S-L-D,preludeIndex,"zcsh-note");
  assert.ok(wallAtGate,"wall target present at shared gate S-L-D");assert.ok(noteAtGate,"note target present at shared gate S-L-D");
  assert.equal(find(S-L-D-1,preludeIndex,"zcsh-wall"),null,"wall absent at S-L-D-1");assert.equal(find(S-L-D-1,preludeIndex,"zcsh-note"),null,"note absent at S-L-D-1");
  const {model:gatedModel}=modelFor(S-L-D,preludeIndex,"zcsh-wall");
  const gatedWall=gatedModel.objects.find((entry)=>entry.targetId==="zcsh-wall"&&entry.kind==="obstacle");
  assert.ok(gatedWall,"wall scene object present at the shared first-visible frame");
  const gatedNoteModel=modelFor(S-L-D,preludeIndex,"zcsh-note").model;
  const gatedIcon=gatedNoteModel.objects.find((entry)=>entry.targetId==="zcsh-note"&&entry.kind==="icon");
  assert.ok(gatedIcon,"note icon present on the same frame as the wall gate");
  assert.equal(gatedWall.position.z,( (S-L-D-S)*0.006+(S-L-D-E)*0.006 )/2,"wall position.z is the exact ts2z midpoint at the gate");
  assert.equal(gatedWall.scale.z,Math.abs((S-L-D-E)*0.006-(S-L-D-S)*0.006),"wall scale.z is the exact authored interval depth at the gate");
  // Plumbing: projected wall/bomb carry finite skyPreludeStartMs === max(0, normalSpawnMs - D) when prelude on, absent when off.
  assert.equal(wallAtGate.normalSpawnMs,S-L);assert.equal(wallAtGate.skyPreludeStartMs,S-L-D,"wall carries exact skyPreludeStartMs under prelude");
  const bombAtGate=find(C-L-D,preludeIndex,"zcsh-bomb");const bombNoteAtGate=find(C-L-D,preludeIndex,"zcsh-bomb-note");
  assert.ok(bombAtGate&&bombNoteAtGate,"bomb and its co-temporal note present at C-L-D");
  assert.equal(bombAtGate.normalSpawnMs,C-L);assert.equal(bombAtGate.skyPreludeStartMs,C-L-D,"bomb carries exact skyPreludeStartMs under prelude");
  assert.equal(find(C-L-D-1,preludeIndex,"zcsh-bomb"),null,"bomb absent at C-L-D-1");
  const offWall=find(S-L-1,offIndex,"zcsh-wall");const offNote=find(S-L-1,offIndex,"zcsh-note");const offWallAt=find(S-L,offIndex,"zcsh-wall");const offNoteAt=find(S-L,offIndex,"zcsh-note");
  assert.equal(offWall,null,"off mode: wall absent at S-L-1");assert.equal(offNote,null,"off mode: note absent at S-L-1");
  assert.ok(offWallAt&&offNoteAt,"off mode: wall and note both present at S-L");
  assert.equal(Object.hasOwn(offWallAt,"skyPreludeStartMs"),false,"off mode: wall omits skyPreludeStartMs");
  assert.equal(Object.hasOwn(find(C-L,offIndex,"zcsh-bomb")??{},"skyPreludeStartMs"),false,"off mode: bomb omits skyPreludeStartMs");
  // Bomb/note z parity at sampled times.
  for(const nowMs of [C-L-D,C-Math.round(L/2),C]){const b=modelFor(nowMs,preludeIndex,"zcsh-bomb").model.objects.find((entry)=>entry.targetId==="zcsh-bomb"&&entry.kind==="icon");const n=modelFor(nowMs,preludeIndex,"zcsh-bomb-note").model.objects.find((entry)=>entry.targetId==="zcsh-bomb-note"&&entry.kind==="icon");assert.ok(b&&n,`bomb+note icons present at ${nowMs}`);assert.equal(b.position.z,n.position.z,`bomb z == note z at ${nowMs}`);assert.ok(Math.abs(b.position.z-(nowMs-C)*0.006)<1e-9,`bomb z canonical at ${nowMs}`);}
  // No-motion guard: across [gate, E] the wall x is constant; wall y is elevated above the base lane during the prelude and returns to exactly the base lane at/after the join (sky offset zero); the note icon Y is constant after the join.
  const wallXY=(nowMs)=>modelFor(nowMs,preludeIndex,"zcsh-wall").model.objects.find((entry)=>entry.targetId==="zcsh-wall"&&entry.kind==="obstacle")?.position??null;
  const noteIconY=(nowMs)=>modelFor(nowMs,preludeIndex,"zcsh-note").model.objects.find((entry)=>entry.targetId==="zcsh-note"&&entry.kind==="icon")?.position.y??null;
  const wallBaseY=wallXY(S)?.y??null;assert.ok(wallBaseY!==null,"wall present at join for base-Y reference");
  let priorX=null;for(let nowMs=S-L-D;nowMs<=E;nowMs+=100){const w=wallXY(nowMs);assert.ok(w,`wall present at ${nowMs}`);if(priorX!==null)assert.equal(w.x,priorX,"wall x is rigid-constant across the visible window");priorX=w.x;
    if(nowMs<S-L)assert.ok(w.y>wallBaseY,`wall y is elevated above base lane (${wallBaseY}) during prelude at ${nowMs}: ${w.y}`);
    else assert.ok(Math.abs(w.y-wallBaseY)<1e-9,`wall y is exactly at base lane at/after the join at ${nowMs}: ${w.y} vs base ${wallBaseY}`);}
  const noteYAfterJoinA=noteIconY(S-L+1),noteYAfterJoinB=noteIconY(S-L+400);assert.ok(noteYAfterJoinA!==null&&noteYAfterJoinB!==null,"note icon present in the post-join visibility window");assert.equal(noteYAfterJoinA,noteYAfterJoinB,"note icon Y is constant after the sky join (no bounce/sky motion for a plain note)");
  // Long wall edge case: tail z may exceed the frustum; the model stays truthful and scale.z equality holds.
  const longWallEvents=Object.freeze([Object.freeze({eventId:"zcsh-long-wall",centerTimestampMs:30000,intervalStartTimestampMs:30000,intervalEndTimestampMs:60000,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:wallGeom,gridMask:Object.freeze([1,2,5,6])})})]);
  const longIndex=createSessionTargetIndex(longWallEvents,{bounceLeadBeats:4,normalSpawnLeadMs:L,skyMode:"prelude",skyPreludeDurationMs:D});
  const findLong=(nowMs)=>projectSessionTargets(longWallEvents,testTruth,nowMs,longIndex).find((entry)=>entry.id==="zcsh-long-wall")??null;
  for(const nowMs of [30000-L-D,45000,60000]){const lw=findLong(nowMs);assert.ok(lw,`long wall present at ${nowMs}`);const lm=buildGameplaySceneModel({presentation:"flow",nowMs,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[lw]}).objects.find((entry)=>entry.targetId==="zcsh-long-wall"&&entry.kind==="obstacle");assert.equal(lm.scale.z,Math.abs((nowMs-60000)*0.006-(nowMs-30000)*0.006),`long wall scale.z exact at ${nowMs}`);assert.equal(lm.position.z,((nowMs-30000)*0.006+(nowMs-60000)*0.006)/2,`long wall center z exact at ${nowMs}`);}
}
// zcsh clamped-zero edge case: early-song wall with normalSpawnMs clamped to 0 hides before the clamped sky start and appears at the clamped row.
{
  const S=1000,E=3000,L=8334,D=1000;
  const clampedWallEvents=Object.freeze([Object.freeze({eventId:"clamped-wall",centerTimestampMs:S,intervalStartTimestampMs:S,intervalEndTimestampMs:E,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2}),gridMask:Object.freeze([1,2,5,6])})})]);
  const clampedIndex=createSessionTargetIndex(clampedWallEvents,{bounceLeadBeats:4,normalSpawnLeadMs:L,skyMode:"prelude",skyPreludeDurationMs:D});
  assert.equal(projectSessionTargets(clampedWallEvents,testTruth,-1,clampedIndex).length,0,"clamped-to-zero normalSpawnMs: wall hidden before the clamped sky start");
  const clampedAtZero=projectSessionTargets(clampedWallEvents,testTruth,0,clampedIndex)[0];
  assert.equal(clampedAtZero?.id,"clamped-wall","clamped wall present at the clamped sky start row 0");
  assert.equal(clampedAtZero.normalSpawnMs,0,"clamped wall normalSpawnMs is clamped to 0");assert.equal(clampedAtZero.skyPreludeStartMs,0,"clamped wall skyPreludeStartMs is clamped to 0");
  const clampedModel=buildGameplaySceneModel({presentation:"flow",nowMs:0,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[clampedAtZero]}).objects.find((entry)=>entry.targetId==="clamped-wall"&&entry.kind==="obstacle");
  assert.ok(Math.abs((clampedModel.position.z+clampedModel.scale.z/2)-(0-S)*0.006)<1e-9,"clamped wall leading face exact at the clamped row");
}
// zcsh index admission: obstacles must be candidates from the widened start (S-L-D) even when the center-based timeline window excludes them.
{
  const S=20000,E=22000,L=8334,D=5000;
  const earlyWallEvents=Object.freeze([Object.freeze({eventId:"early-admission-wall",centerTimestampMs:S,intervalStartTimestampMs:S,intervalEndTimestampMs:E,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2}),gridMask:Object.freeze([1,2,5,6])})})]);
  const earlyIndex=createSessionTargetIndex(earlyWallEvents,{bounceLeadBeats:4,normalSpawnLeadMs:L,skyMode:"prelude",skyPreludeDurationMs:D});
  const atSkyStart=projectSessionTargets(earlyWallEvents,testTruth,S-L-D,earlyIndex).find((entry)=>entry.id==="early-admission-wall");
  assert.ok(atSkyStart,"widened index admission admits the wall at S-L-D");
  assert.equal(atSkyStart.skyPreludeStartMs,S-L-D,"widened admission row carries the exact skyPreludeStartMs");
  assert.equal(projectSessionTargets(earlyWallEvents,testTruth,S-L-D-.001,earlyIndex).length,0,"widened admission stays closed 1 ms before S-L-D");
}
// zcsh no_obstacles suppression rows: a suppressed wall stays absent across the full [S-L-D, E] window and beyond.
{
  const S=10000,E=12000,L=8334,D=1000;
  const suppressedWallEvents=Object.freeze([Object.freeze({eventId:"zcsh-suppressed",centerTimestampMs:S,intervalStartTimestampMs:S,intervalEndTimestampMs:E,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2}),gridMask:Object.freeze([1,2,5,6])})})]);
  const suppressedIndex=createSessionTargetIndex(suppressedWallEvents,{bounceLeadBeats:4,normalSpawnLeadMs:L,skyMode:"prelude",skyPreludeDurationMs:D});
  for(const nowMs of [S-L-D-1,S-L-D,S-L-1,S-L,(S+E)/2,E,E+1]){assert.deepEqual(projectSessionTargets(suppressedWallEvents,noObstacleTruth,nowMs,suppressedIndex),[],`no_obstacles wall stays absent at ${nowMs} under the widened sky window`);}
}
// zcsh plumbing fallback equivalence: with skyPreludeStartMs ABSENT from the target, the renderer scene model derives identical values (the scene-model fallback is max(0,normalSpawnMs-D)) — renderer behavior is unchanged whether or not the field is present.
{
  const S=20000,E=22000,L=8334,D=1000;
  const wallGeom2=Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2});
  const bareWall=Object.freeze({id:"bare-wall",kind:"obstacle",hand:"neutral",family:"obstacle",cell:null,cells:[1,2,5,6],sourceGeometry,gameplayGeometry:wallGeom2,lane:null,beatCenterMs:S,intervalStartMs:S,intervalEndMs:E,normalSpawnMs:S-L});
  const withField={...bareWall,skyPreludeStartMs:S-L-D};
  const frame={presentation:"flow",nowMs:S-L-D,timingWindowBeforeMs:180,timingWindowAfterMs:180};
  const fallbackModel=buildGameplaySceneModel({...frame,targets:[bareWall]});const plumbedModel=buildGameplaySceneModel({...frame,targets:[withField]});
  const fallbackWall=fallbackModel.objects.find((entry)=>entry.targetId==="bare-wall"&&entry.kind==="obstacle");const plumbedWall=plumbedModel.objects.find((entry)=>entry.targetId==="bare-wall"&&entry.kind==="obstacle");
  assert.ok(fallbackWall&&plumbedWall,"both bare and plumbed walls project at the shared gate");
  assert.deepEqual(plumbedModel.objects.map((entry)=>({kind:entry.kind,position:entry.position,scale:entry.scale,alpha:entry.alpha})),fallbackModel.objects.map((entry)=>({kind:entry.kind,position:entry.position,scale:entry.scale,alpha:entry.alpha})),"scene model output is identical whether skyPreludeStartMs is plumbed or left to the renderer fallback");
}
// zcsh Boxing parity: Boxing Lanes/Grid obstacles get the identical sky entry.
{
  const S=15000,L=8334,D=1000;
  const boxingWallEvents=Object.freeze([boxingObstacleEvent("zcsh-boxing-weave",S,"weave_left",{x:2,y:0,width:2,height:2})]);
  const boxingPreludeIndex=createSessionTargetIndex(boxingWallEvents,{bounceLeadBeats:4,normalSpawnLeadMs:L,skyMode:"prelude",skyPreludeDurationMs:D});
  const boxingOffIndex=createSessionTargetIndex(boxingWallEvents,{bounceLeadBeats:4,normalSpawnLeadMs:L,skyMode:"off",skyPreludeDurationMs:D});
  const atGate=projectSessionTargets(boxingWallEvents,testTruth,S-L-D,boxingPreludeIndex).find((entry)=>entry.id==="zcsh-boxing-weave");
  const beforeGate=projectSessionTargets(boxingWallEvents,testTruth,S-L-D-.001,boxingPreludeIndex);
  const offBefore=projectSessionTargets(boxingWallEvents,testTruth,S-L-1,boxingOffIndex);const offAt=projectSessionTargets(boxingWallEvents,testTruth,S-L,boxingOffIndex);
  assert.ok(atGate,"Boxing obstacle present at the shared sky gate");assert.equal(beforeGate.length,0,"Boxing obstacle absent 1 ms before the shared sky gate");
  assert.equal(atGate.skyPreludeStartMs,S-L-D,"Boxing obstacle carries the exact skyPreludeStartMs");
  assert.equal(offBefore.length,0,"Boxing off mode: absent before S-L");assert.ok(offAt,"Boxing off mode: present at S-L");
  const lanesModel=buildGameplaySceneModel({presentation:"boxing_lanes",nowMs:S-L-D,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[atGate]});
  const lanesWall=lanesModel.objects.find((entry)=>entry.targetId==="zcsh-boxing-weave"&&entry.kind==="obstacle");
  assert.ok(lanesWall,"Boxing Lanes wall scene object present at the shared gate");
  const boxingNow=S-L-D,boxingEnd=S+200;
  assert.ok(Math.abs(lanesWall.position.z-((boxingNow-S)*0.006+(boxingNow-boxingEnd)*0.006)/2)<1e-9,`Boxing wall z is the exact ts2z midpoint at the gate: ${lanesWall.position.z}`);
}

const bombs=Object.freeze(Array.from({length:12},(_,placement)=>Object.freeze({eventId:`bomb-${placement}`,centerTimestampMs:1000+placement,authoredBeat:Object.freeze({type:"bomb",placement})})));
const projectedBombsAtBoundary=projectSessionTargets(bombs,testTruth,-1);
assert.equal(projectedBombsAtBoundary.length,0,"bomb is absent strictly before its clamped-to-zero normalSpawnMs boundary");
const projectedBombs=projectSessionTargets(bombs,testTruth,0);
assert.ok(projectedBombs.some((entry)=>entry.id==="bomb-0"),"bomb enters at its clamped-to-zero normalSpawnMs visible spawn row (default fallback lead)");
assert.deepEqual(projectedBombs.find((entry)=>entry.id==="bomb-0"),{id:"bomb-0",kind:"bomb",hand:"neutral",family:"bomb",cell:0,cells:[],lane:null,beatCenterMs:1000,normalSpawnMs:Math.max(0,1000-dFallbackLead)},"bomb now carries the song-derived normalSpawnMs and remains truthful, neutral and feedback-free");
const allBombs=projectSessionTargets(bombs,testTruth,1000);
assert.equal(allBombs.length,12,"all authored placements 0..11 project in the bounded visibility window");
assert.deepEqual(allBombs.map(({id,cell})=>({id,cell})),Array.from({length:12},(_,cell)=>({id:`bomb-${cell}`,cell})),"bomb IDs, timeline ordering and exact authored placements are preserved");
assert(allBombs.every((target)=>target.kind==="bomb"&&target.family==="bomb"&&target.hand==="neutral"&&target.judgement===undefined&&target.feedbackProgress===undefined),"bombs never acquire judgement or feedback fields");
assert.equal(projectSessionTargets([bombs[0]],testTruth,1500).length,1,"bomb remains visible through the same 500 ms post-center window as unresolved visuals");
assert.equal(projectSessionTargets([bombs[0]],testTruth,1500.001).length,0,"bomb leaves immediately after the bounded visibility window");
const falseBombHit=Object.freeze({...testTruth,judgements:Object.freeze([{eventId:"bomb-0",result:"hit",shadow:false,committedTimelinePositionMs:1000}])});
assert.equal(projectSessionTargets([bombs[0]],falseBombHit,1200)[0]?.judgement,undefined,"bomb ignores synthetic and real feedback truth");
for(const placement of [-1,12,1.5,NaN,null,undefined,"1"]) assert.deepEqual(projectSessionTargets([{eventId:`invalid-${String(placement)}`,centerTimestampMs:1000,authoredBeat:{type:"bomb",placement}}],testTruth,1000),[],`invalid bomb placement ${String(placement)} is omitted`);
const omittedFlowNonNotes=Object.freeze(["arc","burst"].map((type,index)=>Object.freeze({eventId:`omitted-${type}`,centerTimestampMs:1000+index,authoredBeat:Object.freeze({type,placement:1,startPlacement:1,endPlacement:2,tailPlacement:2})})));
assert.deepEqual(projectSessionTargets(omittedFlowNonNotes,testTruth,900),[],"Flow arc/burst remain explicitly omitted rather than misprojected as Boxing punches");
assert.deepEqual(projectSessionTargets([{eventId:"unknown",centerTimestampMs:1000,authoredBeat:{type:"future_unknown"}}],testTruth,900),[],"unrecognized authored types cannot reach the recognized-only Boxing punch branch");

function boxingObstacleEvent(eventId,centerTimestampMs,type,geometry){const gridMask=Object.freeze(Array.from({length:geometry.width*geometry.height},(_,index)=>(geometry.y+Math.floor(index/geometry.width))*4+geometry.x+index%geometry.width));return Object.freeze({eventId,centerTimestampMs,intervalStartTimestampMs:centerTimestampMs,intervalEndTimestampMs:centerTimestampMs+200,authoredBeat:Object.freeze({start:centerTimestampMs/1000,end:(centerTimestampMs+200)/1000,type,sourceGeometry:Object.freeze({schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v3_obstacle_rect",kind:"v3_rect",...geometry}),gameplayGeometry:Object.freeze({schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",...geometry}),gridMask,blockedCells:gridMask,checkpoint:Object.freeze({kind:"instantaneous",freshnessMs:150,timingWindowMs:180,noseSafeCells:Object.freeze(Array.from({length:12},(_,cell)=>cell).filter((cell)=>!gridMask.includes(cell)))})})});}
const canonicalPunchCases=Object.freeze([["straight_left","left","straight"],["straight_right","right","straight"],["hook_left","left","hook"],["hook_right","right","hook"],["uppercut_left","left","uppercut"],["uppercut_right","right","uppercut"]]),canonicalPunchEvents=Object.freeze(canonicalPunchCases.map(([type,hand],index)=>Object.freeze({eventId:`canonical-${type}`,centerTimestampMs:1000+index,appearanceColor:hand==="left"?"#FF0000":"#00FF00",authoredBeat:Object.freeze({type,spatialTarget:Object.freeze({targetCell:4+index})})}))),canonicalPunchIndex=createSessionTargetIndex(canonicalPunchEvents,{bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:0}),canonicalPunchTargets=projectSessionTargets(canonicalPunchEvents,playSession,900,canonicalPunchIndex);
assert.deepEqual(canonicalPunchTargets.map((target)=>[target.id,target.hand,target.family,target.appearanceColor]),canonicalPunchCases.map(([type,hand,family])=>[`canonical-${type}`,hand,family,hand==="left"?"#FF0000":"#00FF00"]),"all six canonical Boxing authored types map exact family/hand/color without suffix inference");
const boxingEvents = Object.freeze([
  Object.freeze({ eventId:"punch-left",centerTimestampMs:1000,appearanceColor:"#FF0000",authoredBeat:Object.freeze({type:"hook_left",spatialTarget:Object.freeze({targetCell:5,entryDirection:"up"})}) }),
  boxingObstacleEvent("weave-left",1100,"weave_left",{x:2,y:0,width:2,height:2}),
  boxingObstacleEvent("weave-right",1200,"weave_right",{x:0,y:0,width:2,height:2}),
  Object.freeze({ eventId:"guard",centerTimestampMs:1300,appearanceColor:"#808080",authoredBeat:Object.freeze({type:"guard",guardTarget:Object.freeze({leftCell:4,rightCell:7})}) }),
  boxingObstacleEvent("squat",1400,"squat",{x:0,y:2,width:4,height:1})
]);
const boxingIndex=createSessionTargetIndex(boxingEvents,{bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:0});
const boxing = projectSessionTargets(boxingEvents,playSession,900,boxingIndex);
assert.equal(boxing.find((entry)=>entry.id==="punch-left")?.lane,"left","punch lane follows authored hand");assert.equal(boxing.find((entry)=>entry.id==="punch-left")?.appearanceColor,"#FF0000","validated private Boxing punch appearance reaches renderer target");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="weave-left")?.hand,lane:boxing.find((entry)=>entry.id==="weave-left")?.lane,cells:boxing.find((entry)=>entry.id==="weave-left")?.cells},{hand:"left",lane:"left",cells:[2,3,6,7]},"left weave keeps directional lane and exact Grid blocked cells");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="weave-right")?.hand,lane:boxing.find((entry)=>entry.id==="weave-right")?.lane,cells:boxing.find((entry)=>entry.id==="weave-right")?.cells},{hand:"right",lane:"right",cells:[0,1,4,5]},"right weave keeps directional lane and exact Grid blocked cells");
assert.deepEqual({lane:boxing.find((entry)=>entry.id==="guard")?.lane,cells:boxing.find((entry)=>entry.id==="guard")?.cells,appearanceColor:boxing.find((entry)=>entry.id==="guard")?.appearanceColor},{lane:null,cells:[4,7],appearanceColor:undefined},"guard remains fixed-color despite a hostile private appearance and preserves Grid cells");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="squat")?.hand,lane:boxing.find((entry)=>entry.id==="squat")?.lane,cells:boxing.find((entry)=>entry.id==="squat")?.cells},{hand:"neutral",lane:null,cells:[8,9,10,11]},"squat remains neutral for lane duplication and preserves Grid cells");
for(const target of boxing.filter((entry)=>entry.kind==="obstacle")){assert.ok(target.sourceGeometry&&target.gameplayGeometry&&target.intervalEndMs-target.intervalStartMs===200,"Boxing projection must privately retain source/gameplay geometry and exact interval");assert.equal(target.judgement,undefined,"Boxing walls never receive Flow or synthetic continuous outcomes");}
assert.deepEqual(projectSessionTargets([boxingEvents[1]],testTruth,1100),projectSessionTargets([boxingEvents[1]],playSession,1100),"unranked Test must project the same feedback-free Boxing wall without gameplay truth");

const bounceTiming={anchorMs:125,tempoSegments:[{startBeat:0,bpm:120},{startBeat:16,bpm:180}],stopSegments:[{startBeat:15,durationMs:250}],timeSignatureSegments:[{startBeat:0,numerator:4,denominator:4}]},mapBeat=createAuthoredBeatToTimelineMs(bounceTiming),bounceHit=mapBeat(18),bounceEvents=[{eventId:"bounce-flow",centerTimestampMs:bounceHit,authoredBeat:{type:"note",start:18,hand:"left",placement:4}},{eventId:"bounce-guard",centerTimestampMs:bounceHit,authoredBeat:{type:"guard",start:18,guardTarget:{leftCell:5,rightCell:6}}},{eventId:"bounce-bomb",centerTimestampMs:bounceHit,authoredBeat:{type:"bomb",start:18,placement:1}}],bounceIndex=createSessionTargetIndex(bounceEvents,{mapBeatToTimelineMs:mapBeat,bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:1200}),expectedBounceStart=mapBeat(14);
assert.equal(bounceIndex.timingMismatchCount,0);assert.equal(bounceIndex.timingMapperUnavailableCount,0);assert.equal(bounceIndex.events,bounceEvents,"index retains the exact resolved-event array identity");assert.equal(bounceIndex.orderedEntries.find((entry)=>entry.sourceIndex===0)?.event,bounceEvents[0],"index entries retain exact event object identity");assert.equal(bounceIndex.leadLimited,false);const groupedEntries=bounceIndex.orderedEntries.filter(entry=>entry.arrivalGroupIdentity);assert.equal(groupedEntries.length,2);assert.equal(groupedEntries[0].arrivalGroupIdentity,groupedEntries[1].arrivalGroupIdentity,"exact simultaneous actionable targets share one opaque identity");assert.equal(Object.hasOwn(groupedEntries[0],"arrivalGroupOrdinal"),false,"arrival ordinals are deleted");const bounced=projectSessionTargets(bounceEvents,playSession,expectedBounceStart,bounceIndex);assert.equal(bounced.find(target=>target.id==="bounce-flow")?.bounceStartMs,expectedBounceStart,"tempo/stop authority derives exact private start");assert.equal(bounced.find(target=>target.id==="bounce-guard")?.bounceStartMs,expectedBounceStart,"guard pair shares one event start");assert.deepEqual(new Set(bounced.filter(target=>target.id!=="bounce-bomb").map(target=>target.arrivalGroupIdentity)).size,1);assert.equal(Object.hasOwn(bounced.find(target=>target.id==="bounce-bomb")??{},"arrivalGroupIdentity"),false,"bomb never gains arrival cues");assert.equal(Object.hasOwn(bounced.find(target=>target.id==="bounce-bomb")??{},"bounceStartMs"),false,"bomb never gains bounce data");
const groupedBefore=projectSessionTargets(bounceEvents,playSession,expectedBounceStart,bounceIndex).filter(target=>target.arrivalGroupIdentity),groupedAfterSeek=projectSessionTargets(bounceEvents,playSession,bounceHit-1,bounceIndex).filter(target=>target.arrivalGroupIdentity),groupedAfterHit=projectSessionTargets(bounceEvents,{...playSession,judgements:[{eventId:"bounce-flow",result:"hit",shadow:false,committedTimelinePositionMs:bounceHit}]},bounceHit,bounceIndex).filter(target=>target.arrivalGroupIdentity);assert.deepEqual(groupedBefore.map(target=>target.id),["bounce-flow","bounce-guard"]);assert.deepEqual(groupedAfterSeek.map(target=>target.id),["bounce-flow","bounce-guard"]);assert(groupedAfterHit.every(target=>target.arrivalGroupIdentity===groupedBefore[0].arrivalGroupIdentity),"hit/cull/seek projection retains immutable opaque groups");const guidance=guidanceBeatTimestamps(bounceIndex,expectedBounceStart,2500);assert(guidance.length>0&&guidance.length<=512);assert(guidance.every((value,index)=>index===0||value>guidance[index-1]));assert.deepEqual(guidanceBeatTimestamps(bounceIndex,bounceHit-1,2500),guidanceBeatTimestamps(bounceIndex,bounceHit-1,2500),"guidance is seek-stable and bounded");const wholeSongIndex=createSessionTargetIndex([],{mapBeatToTimelineMs:(beat)=>beat*500,songDurationMs:10_000,normalSpawnLeadMs:2500});assert.deepEqual(guidanceBeatTimestamps(wholeSongIndex,7500,2500),[7500,8000,8500,9000,9500,10000],"event-free/trailing whole-song guidance must follow timing duration rather than event extent");
const mismatchEvents=[{...bounceEvents[0],centerTimestampMs:bounceHit+0.0011}],mismatchIndex=createSessionTargetIndex(mismatchEvents,{mapBeatToTimelineMs:mapBeat,bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:1200});assert.equal(mismatchIndex.timingMismatchCount,1);assert.equal(mismatchIndex.timingMapperUnavailableCount,0,"an available mismatching mapper is distinct from mapper unavailability");const mismatchTarget=projectSessionTargets(mismatchEvents,playSession,bounceHit,mismatchIndex)[0];assert.equal(Object.hasOwn(mismatchTarget??{},"bounceStartMs"),false,"mapper mismatch fails static without rewriting hit time");assert.equal(mismatchIndex.orderedEntries[0].normalSpawnMs,bounceHit+0.0011-2500,"mismatch retains only configured straight-approach visibility");assert.equal(mismatchTarget?.normalSpawnMs,bounceHit+0.0011-2500,"source timing still reaches the renderer when optional bounce mapping mismatches");assert.equal(Object.hasOwn(mismatchTarget??{},"skyPreludeStartMs"),false,"mismatch cannot enable sky trajectory");
const cappedMap=(beat)=>beat===20?20_000:0,cappedEvent={eventId:"capped",centerTimestampMs:20_000,authoredBeat:{type:"note",start:20,placement:1,hand:"left"}},cappedEvents=[cappedEvent],cappedIndex=createSessionTargetIndex(cappedEvents,{mapBeatToTimelineMs:cappedMap,bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:1200});assert.equal(cappedIndex.leadLimited,true);assert.equal(projectSessionTargets(cappedEvents,playSession,17_500,cappedIndex)[0]?.bounceStartMs,10_000,"bounce lead is capped at 10 seconds");
const realTimingMap=createAuthoredBeatToTimelineMs({anchorMs:0,tempoSegments:[{startBeat:0,bpm:150}],stopSegments:[],timeSignatureSegments:[{startBeat:0,numerator:4,denominator:4}]}),realTrajectoryEvent=Object.freeze({eventId:"real-3c9d-beat-50",centerTimestampMs:20_000,authoredBeat:Object.freeze({type:"note",start:50,placement:11,hand:"right"})}),realTrajectoryEvents=Object.freeze([realTrajectoryEvent]),defaultTrajectoryIndex=createSessionTargetIndex(realTrajectoryEvents,{mapBeatToTimelineMs:realTimingMap,bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:1000}),extremeTrajectoryIndex=createSessionTargetIndex(realTrajectoryEvents,{mapBeatToTimelineMs:realTimingMap,bounceLeadBeats:8,normalSpawnLeadMs:12000,skyMode:"prelude",skyPreludeDurationMs:10000});
assert.deepEqual([defaultTrajectoryIndex.orderedEntries[0].bounceStartMs,defaultTrajectoryIndex.orderedEntries[0].normalSpawnMs,defaultTrajectoryIndex.orderedEntries[0].skyPreludeStartMs],[18400,17500,17500],"3c9d timing defaults derive exact finite trajectory timestamps");
assert.deepEqual([extremeTrajectoryIndex.orderedEntries[0].bounceStartMs,extremeTrajectoryIndex.orderedEntries[0].normalSpawnMs,extremeTrajectoryIndex.orderedEntries[0].skyPreludeStartMs],[16800,8000,0],"3c9d timing extremes derive exact finite trajectory timestamps");
assert.equal(extremeTrajectoryIndex.maximumPresentationLeadMs,20000,"extreme sky prelude expands indexed lookahead beyond the removed 10 s fallback");
assert.equal(projectSessionTargets(realTrajectoryEvents,testTruth,-0.001,extremeTrajectoryIndex).length,0,"target is absent before exact sky start");
assert.equal(projectSessionTargets(realTrajectoryEvents,testTruth,0,extremeTrajectoryIndex)[0]?.skyPreludeStartMs,0,"target enters at exact sky start despite a 20 s lead");
assert.equal(projectSessionTargets(events,playSession,0,straightIndex).length,2);
const obstacleDistanceEvents=Object.freeze([longObstacle]),obstacleDistanceIndex=createSessionTargetIndex(obstacleDistanceEvents,{normalSpawnLeadMs:5000});
assert.equal(projectSessionTargets(obstacleDistanceEvents,playSession,-.001,obstacleDistanceIndex).length,0,"obstacle remains absent before the timeline-clamped configured normal-spawn boundary");
assert.equal(projectSessionTargets(obstacleDistanceEvents,playSession,0,obstacleDistanceIndex)[0]?.id,"long-obstacle","Flow obstacle appears at the same timeline-clamped configured normal-spawn boundary used by beats");
const boxingDistanceEvents=Object.freeze([boxingEvents[1]]),boxingDistanceIndex=createSessionTargetIndex(boxingDistanceEvents,{normalSpawnLeadMs:5000});
assert.equal(projectSessionTargets(boxingDistanceEvents,playSession,0,boxingDistanceIndex)[0]?.id,"weave-left","Boxing obstacle appears at the configured beat normal-spawn boundary");const alignedNote={eventId:"aligned-note",centerTimestampMs:1000,authoredBeat:{type:"note",placement:0,hand:"left"}},alignedEvents=[alignedNote,longObstacle],alignedIndex=createSessionTargetIndex(alignedEvents,{normalSpawnLeadMs:500});const alignedTargets=projectSessionTargets(alignedEvents,playSession,500,alignedIndex);assert.deepEqual(alignedTargets.map(target=>[target.id,target.normalSpawnMs]),[["aligned-note",500],["long-obstacle",500]],"same-time normal beat and obstacle leading face share exact selected-difficulty lead");assert.equal(projectSessionTargets(alignedEvents,playSession,1000,createSessionTargetIndex(alignedEvents,{normalSpawnLeadMs:null})).length,0,"missing source timing without override fails closed for beats and obstacles");
const missContinuityEvents=Object.freeze([{eventId:"even-hit",centerTimestampMs:1000,authoredBeat:{type:"note",start:1,placement:0,hand:"left"}},{eventId:"odd-miss",centerTimestampMs:1000,authoredBeat:{type:"note",start:1,placement:1,hand:"right"}}]),missContinuityIndex=createSessionTargetIndex(missContinuityEvents,{mapBeatToTimelineMs:()=>1000,normalSpawnLeadMs:2500,bounceLeadBeats:2,skyMode:"off",skyPreludeDurationMs:1000});
for(const offset of[0,1,180]){const target=projectSessionTargets(missContinuityEvents,testTruth,1000+offset,missContinuityIndex,180).find(entry=>entry.id==="odd-miss");assert.equal(target?.judgement,"pending",`miss candidate must remain continuously pending through +${offset} ms`);}
const committedMiss=projectSessionTargets(missContinuityEvents,testTruth,1181,missContinuityIndex,180).find(entry=>entry.id==="odd-miss");assert.deepEqual({id:committedMiss?.id,judgement:committedMiss?.judgement},{id:"odd-miss",judgement:"miss"},"same target identity atomically turns gray when the miss commits");
const boundedEvents=Array.from({length:200},(_,index)=>({eventId:`event-${index}`,centerTimestampMs:index,authoredBeat:{type:"note"}})),boundedIndex=createSessionTargetIndex(boundedEvents,{bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:0});
assert.equal(projectSessionTargets(boundedEvents,testTruth,0,boundedIndex).length,128,"projection remains bounded");

const PARITY_GENERATED_EVENT_COUNT=5997;
const PARITY_CORPUS_COUNT=6003;
const parityEvents=Object.freeze([...Array.from({length:PARITY_GENERATED_EVENT_COUNT},(_,index)=>Object.freeze({eventId:`parity-${String(index).padStart(4,"0")}`,centerTimestampMs:index*17,authoredBeat:Object.freeze({type:index%29===0?"bomb":"note",placement:index%12,hand:index%2?"right":"left",direction:index%8})})),longObstacle,...boxingEvents].reverse());
assert.equal(parityEvents.length,PARITY_CORPUS_COUNT,"acceptance corpus must contain exactly 6,003 identities");
assert.equal(new Set(parityEvents.map((event)=>event.eventId)).size,PARITY_CORPUS_COUNT,"all 6,003 acceptance-corpus event identities must be unique");
assert.deepEqual(parityEvents.slice(0,6).map((event)=>event.eventId),["squat","guard","weave-right","weave-left","punch-left","long-obstacle"],"reversed corpus must retain the explicit Flow plus Boxing boundary identities");
assert.equal(parityEvents.at(-1)?.eventId,"parity-0000","reversed generated corpus identity/order sentinel must remain exact");
const parityIndex=createSessionTargetIndex(parityEvents);
const farCommitTruth=Object.freeze({...playSession,judgements:Object.freeze([{eventId:`parity-${PARITY_GENERATED_EVENT_COUNT-1}`,result:"hit",shadow:false,committedTimelinePositionMs:120000}])});
const parityTimes=Object.freeze([-2500,-0.001,0,0.001,531,999.999,1000,1000.001,1099.999,1100,1100.001,1199.999,1200,1200.001,1399.999,1400,1400.001,1999.999,2000,2000.001,2500,120000,120175,120350,120351,40000,85000]);
let parityComparisons=0;
for(const truth of [playSession,testTruth,farCommitTruth,noObstacleTruth,contactTruth])for(const nowMs of parityTimes){assert.equal(JSON.stringify(projectSessionTargets(parityEvents,truth,nowMs,parityIndex)),JSON.stringify(projectSessionTargets(parityEvents,truth,nowMs)),`indexed projection must preserve exact target bytes/order at ${nowMs}/${truth.session.purpose}`);parityComparisons+=1;}
assert.equal(parityComparisons,5*parityTimes.length,"every declared session/boundary parity row must execute");
assert.equal(createSessionTargetIndex(parityEvents).orderedEntries.length,PARITY_CORPUS_COUNT,"pre-index retains every one of the exact 6,003 events once");
console.log(`ORACLE indexed-full-projection-parity PASS: corpus=${PARITY_CORPUS_COUNT}, unique=${PARITY_CORPUS_COUNT}, comparisons=${parityComparisons}, generatedNotesBombs=${PARITY_GENERATED_EVENT_COUNT}, continuousFlow=1, boxingIntervals=${boxingEvents.filter((event)=>event.authoredBeat.type==="weave_left"||event.authoredBeat.type==="weave_right"||event.authoredBeat.type==="squat").length}`);
