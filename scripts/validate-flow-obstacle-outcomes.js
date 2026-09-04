// @ts-check

import assert from "node:assert/strict";
import { createAeroGameplaySessionCoordinator } from "@aerobeat/web-gameplay";

const HASH="a".repeat(64);
const GEOMETRY=Object.freeze({schema:"aerobeat/flow_obstacle_geometry",version:1,coordinateSpace:"beatsaber_lane_layer",x:1,y:2,width:1,height:3});

// Staggered overlapping walls resolve separately but apply one aggregate consequence.
{
  const selected=variant("flow-staggered");
  const gameplay=createAeroGameplaySessionCoordinator({sessionId:"assembly-staggered-overlap"});
  readyPlaying(gameplay,[wall("a-staggered",700,800,selected),wall("b-staggered",750,850,selected)],selected);
  gameplay.advance(frame(4000,680,noseEvidence("before",4000,.125)));
  gameplay.advance(frame(4080,760,noseEvidence("inside",4080,.375)));
  gameplay.advance(frame(4180,860,noseEvidence("after",4180,.125)));
  assert.deepEqual(gameplay.getObstacleOutcomes().map((entry)=>[entry.eventId,entry.result,entry.consequenceApplied]),[["a-staggered","contact",true],["b-staggered","contact",false]]);
  assert.deepEqual(gameplay.getScorePartitions().map((entry)=>[entry.variantId,entry.obstacleContacts,entry.hits,entry.misses,entry.score]),[["flow-staggered",1,0,0,0]]);
  assert.equal(gameplay.getJudgements().length,0,"obstacles must remain outside note judgement truth");
  gameplay.destroy();
}

// A completed old obstacle remains in its original partition; only future obstacle truth adopts the paused swap identity.
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
  assert.deepEqual(gameplay.getObstacleOutcomes().map((entry)=>[entry.eventId,entry.result,entry.consequenceApplied]),[["next-wall","contact",true],["old-wall","contact",true]]);
  assert.deepEqual(gameplay.getScorePartitions().map((entry)=>[entry.variantId,entry.profileVersion,entry.obstacleContacts,entry.hits,entry.misses,entry.score]).sort(),[["flow-next","2",1,0,0,0],["flow-old","1",1,0,0,0]].sort());
  assert.equal(gameplay.getObstacleOutcomes().some((entry)=>entry.eventId==="discarded-future"),false,"paused swap must replace non-active future obstacle truth");
  assert.equal(gameplay.getJudgements().length,0,"future obstacle partitioning must not create or rewrite note judgements");
  gameplay.destroy();
}

console.log("Assembly staggered-overlap outcomes and paused future-variant obstacle partition proof passed.");

function variant(id){return {variantId:id,chartId:`chart-${id}`,mode:"flow",rulesetId:"flow_grid_v2",recipeId:null,modifierIds:[],ranked:false,mapHash:{schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:HASH},scoreIdentityHash:{schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:HASH},provenance:{baseVariantId:id}};}
function wall(eventId,startMs,endMs,selected){return {schema:"aerobeat/resolved_content_event",version:2,eventId,variantId:selected.variantId,chartId:selected.chartId,centerTimestampMs:startMs,intervalStartTimestampMs:startMs,intervalEndTimestampMs:endMs,sourceEventIds:[`source-${eventId}`],authoredBeat:{start:startMs/1000,end:endMs/1000,type:"obstacle",geometry:GEOMETRY,gridMask:[1]}};}
function configuration(events,selected,profileVersion="1",contentHash=HASH){return {packageId:"assembly-obstacle-package",selectedVariant:selected,resolvedEvents:events,profileIdentity:{schema:"aerobeat/prototype_tuning_identity",version:1,profileId:"assembly-profile",profileVersion,contentHash,class:"between_run_ruleset",regenerationRequired:false},shadowVariants:[]};}
function clock(positionMs,playing){return {contextTimeSeconds:positionMs/1000,positionSeconds:positionMs/1000,playing};}
function frame(timestampMs,positionMs,evidenceValue,playing=true){return {timestampMs,clock:clock(positionMs,playing),...(evidenceValue?{input:input(timestampMs,evidenceValue)}:{})};}
function input(timestampMs,latestEvidence){return {calibration:{calibrationId:"cal-1",readiness:"countdown"},tracking:{gameplayPaused:false,freshCalibrationRequired:false},countdownFrozen:false,latestEvidence,straightQualifications:[]};}
function noseEvidence(frameId,measurementTimestampMs,x){const names=["nose","left_shoulder","right_shoulder","left_elbow","right_elbow","left_wrist","right_wrist"];return {schema:"aerobeat/gameplay_evidence_snapshot",version:1,calibrationId:"cal-1",measuredSourceFrameId:frameId,measurementTimestampMs,provenance:"measured",activeBoxingActions:[],anchors:names.map((name)=>({schema:"aerobeat/body_grid_anchor_snapshot",version:1,anchor:name,calibrationId:"cal-1",measurementTimestampMs,valid:true,confidence:1,rawX:name==="nose"?x:.5,rawY:name==="nose"?0:.5,x:name==="nose"?x:.5,y:name==="nose"?0:.5,cell:name==="nose"?1:5,subcell:name==="nose"?2:20})),entries:[]};}
function readyPlaying(gameplay,events,selected){gameplay.configureContent(configuration(events,selected));gameplay.advance({timestampMs:0,clock:clock(0,false),input:input(0,null)});assert.equal(gameplay.requestStart(0).accepted,true);gameplay.advance({timestampMs:1000,clock:clock(0,false)});gameplay.advance({timestampMs:2000,clock:clock(0,false)});gameplay.advance({timestampMs:3000,clock:clock(0,false)});assert.equal(gameplay.getSnapshot().session.state,"playing");}
