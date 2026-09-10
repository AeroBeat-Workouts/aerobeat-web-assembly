// @ts-check

import assert from "node:assert/strict";
import { createAeroGameplaySessionCoordinator } from "@aerobeat/web-gameplay";

const HASH="a".repeat(64);
const SOURCE_GEOMETRY=Object.freeze({schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v2_legacy_obstacle",kind:"v2_type_1",x:1,y:2,width:1,height:3});const GAMEPLAY_GEOMETRY=Object.freeze({schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:1,y:0,width:1,height:3});

// Staggered overlapping walls under flow_colliders_v1 resolve separately but apply one aggregate consequence.
{
  const selected=variant("flow-staggered");
  const gameplay=createAeroGameplaySessionCoordinator({sessionId:"assembly-staggered-overlap"});
  readyPlaying(gameplay,[wall("a-staggered",700,800,selected),wall("b-staggered",750,850,selected)],selected);
  gameplay.advance(frame(4000,680,noseEvidence("before",4000,.125)));
  gameplay.advance(frame(4080,760,noseEvidence("inside",4080,.375)));
  gameplay.advance(frame(4180,860,noseEvidence("after",4180,.125)));
  assert.deepEqual(gameplay.getHazardOutcomes().map((entry)=>[entry.eventId,entry.kind,entry.result,entry.consequenceApplied]),[["a-staggered","wall","contact",true],["b-staggered","wall","contact",false]]);
  assert.equal(gameplay.getObstacleOutcomes().length,0,"flow_colliders_v1 must not emit legacy aerobeat/obstacle_outcome records");
  assert.deepEqual(gameplay.getScorePartitions().map((entry)=>[entry.variantId,entry.bombContacts,entry.obstacleContacts,entry.hits,entry.misses,entry.score]),[["flow-staggered",0,1,0,0,0]]);
  assert.equal(gameplay.getJudgements().length,0,"obstacles must remain outside note judgement truth");
  gameplay.destroy();
}

// A completed old wall remains in its original partition; only future wall truth adopts the paused swap identity.
{
  const oldVariant=variant("flow-old"),nextVariant=variant("flow-next");
  const gameplay=createAeroGameplaySessionCoordinator({sessionId:"assembly-paused-future-partitions"});
  readyPlaying(gameplay,[wall("old-wall",600,700,oldVariant),wall("discarded-future",1200,1300,oldVariant)],oldVariant);
  gameplay.advance(frame(4000,580,noseEvidence("old-before",4000,.125)));
  gameplay.advance(frame(4070,650,noseEvidence("old-inside",4070,.375)));
  gameplay.advance(frame(4140,720,noseEvidence("old-after",4140,.125)));
  gameplay.pause(4200,"variant_change");
  gameplay.applyFutureContent(configuration([wall("next-wall",1200,1300,nextVariant)],nextVariant,"2","b".repeat(64)));
  assert.equal(gameplay.getSnapshot().selectedVariant.variantId,"flow-next");
  gameplay.resume(4200);
  gameplay.advance(frame(5200,720,null,false));gameplay.advance(frame(6200,720,null,false));gameplay.advance(frame(7200,720,null,false));
  assert.equal(gameplay.getSnapshot().session.state,"playing");
  gameplay.advance(frame(7660,1180,noseEvidence("next-before",7660,.125)));
  gameplay.advance(frame(7730,1250,noseEvidence("next-inside",7730,.375)));
  gameplay.advance(frame(7800,1320,noseEvidence("next-after",7800,.125)));
  // Runtime observation under flow_colliders_v1: pause() clears continuous collision
  // history but leaves the in-flight obstacle in obstacleStates, so after resume the
  // preserved pre-swap wall re-closes "unevaluated_tracking" once per no-evidence
  // advance (three here) and again on the first measured advance. Only the
  // consequence-bearing record is unique, so assert the contact outcome exactly and
  // bound the re-closed noise to the wall itself with no consequence applied.
  assert.deepEqual(gameplay.getHazardOutcomes().map((entry)=>[entry.eventId,entry.kind,entry.result,entry.consequenceApplied]).filter((entry)=>entry[3]===true),[["old-wall","wall","contact"],["next-wall","wall","contact"]].map((entry)=>[entry[0],entry[1],entry[2],true]));
  assert.deepEqual(gameplay.getHazardOutcomes().filter((entry)=>entry.consequenceApplied===false).map((entry)=>[entry.eventId,entry.kind,entry.result]),[["old-wall","wall","unevaluated_tracking"],["old-wall","wall","unevaluated_tracking"],["old-wall","wall","unevaluated_tracking"]]);
  assert.equal(gameplay.getObstacleOutcomes().length,0,"flow_colliders_v1 must not emit legacy aerobeat/obstacle_outcome records");
  assert.deepEqual(gameplay.getScorePartitions().map((entry)=>[entry.variantId,entry.profileVersion,entry.obstacleContacts,entry.hits,entry.misses,entry.score]).sort(),[["flow-next","2",1,0,0,0],["flow-old","1",1,0,0,0]].sort());
  assert.equal(gameplay.getHazardOutcomes().some((entry)=>entry.eventId==="discarded-future"),false,"paused swap must replace non-active future wall truth");
  assert.equal(gameplay.getJudgements().length,0,"future wall partitioning must not create or rewrite note judgements");
  gameplay.destroy();
}

console.log("Assembly staggered-overlap outcomes and paused future-variant obstacle partition proof passed.");

function variant(id){return {variantId:id,chartId:`chart-${id}`,mode:"flow",rulesetId:"flow_colliders_v1",recipeId:null,modifierIds:[],ranked:false,mapHash:{schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:HASH},scoreIdentityHash:{schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:HASH},provenance:{baseVariantId:id}};}
function wall(eventId,startMs,endMs,selected){return {schema:"aerobeat/resolved_content_event",version:3,eventId,variantId:selected.variantId,chartId:selected.chartId,centerTimestampMs:startMs,intervalStartTimestampMs:startMs,intervalEndTimestampMs:endMs,sourceEventIds:[`source-${eventId}`],authoredBeat:{start:startMs/1000,end:endMs/1000,type:"obstacle",sourceGeometry:SOURCE_GEOMETRY,gameplayGeometry:GAMEPLAY_GEOMETRY,gridMask:[1,5,9]}};}
function configuration(events,selected,profileVersion="1",contentHash=HASH){return {packageId:"assembly-obstacle-package",selectedVariant:selected,resolvedEvents:events,profileIdentity:{schema:"aerobeat/prototype_tuning_identity",version:1,profileId:"assembly-profile",profileVersion,contentHash,class:"between_run_ruleset",regenerationRequired:false},shadowVariants:[]};}
function clock(positionMs,playing){return {contextTimeSeconds:positionMs/1000,positionSeconds:positionMs/1000,playing};}
function frame(timestampMs,positionMs,evidenceValue,playing=true){return {timestampMs,clock:clock(positionMs,playing),input:{calibration:{calibrationId:"cal-1",readiness:"countdown"},tracking:{gameplayPaused:false,freshCalibrationRequired:false},sourceIdentity:"assembly-source",countdownFrozen:false,latestEvidence:evidenceValue??null,straightQualifications:[]}};}
function noseEvidence(frameId,measurementTimestampMs,x){const names=["nose","left_shoulder","right_shoulder","left_elbow","right_elbow","left_wrist","right_wrist"];return {schema:"aerobeat/gameplay_evidence_snapshot",version:1,calibrationId:"cal-1",measuredSourceFrameId:frameId,measurementTimestampMs,provenance:"measured",activeBoxingActions:[],anchors:names.map((name)=>({schema:"aerobeat/body_grid_anchor_snapshot",version:1,anchor:name,calibrationId:"cal-1",measurementTimestampMs,valid:true,confidence:1,rawX:name==="nose"?x:.5,rawY:name==="nose"?0:.5,x:name==="nose"?x:.5,y:name==="nose"?0:.5,cell:name==="nose"?1:5,subcell:name==="nose"?2:20})),entries:[]};}
function readyPlaying(gameplay,events,selected){gameplay.configureContent(configuration(events,selected));gameplay.advance({timestampMs:0,clock:clock(0,false),input:input(0,null)});assert.equal(gameplay.requestStart(0).accepted,true);gameplay.advance({timestampMs:1000,clock:clock(0,false)});gameplay.advance({timestampMs:2000,clock:clock(0,false)});gameplay.advance({timestampMs:3000,clock:clock(0,false)});assert.equal(gameplay.getSnapshot().session.state,"playing");}
function input(timestampMs,latestEvidence){return {calibration:{calibrationId:"cal-1",readiness:"countdown"},tracking:{gameplayPaused:false,freshCalibrationRequired:false},sourceIdentity:"assembly-source",countdownFrozen:false,latestEvidence,straightQualifications:[]};}
