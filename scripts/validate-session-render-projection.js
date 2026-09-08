// @ts-check

import assert from "node:assert/strict";
import { createAuthoredBeatToTimelineMs } from "@aerobeat/web-content";
import { createSessionTargetIndex, projectSessionTargets } from "../src/session-render-projection.js";

const events = Object.freeze([
  Object.freeze({ eventId:"flow-1", centerTimestampMs:1000, appearanceColor:"#FF0000", authoredBeat:Object.freeze({type:"note",hand:"left",placement:4,direction:2}) }),
  Object.freeze({ eventId:"flow-2", centerTimestampMs:2000, appearanceColor:"#808080", authoredBeat:Object.freeze({type:"note",hand:"right",placement:7,direction:"up"}) })
]);
const playSession = Object.freeze({ session:Object.freeze({purpose:"play"}), judgements:Object.freeze([]), shadowJudgements:Object.freeze([]), scorePartitions:Object.freeze([]) });
const pending = projectSessionTargets(events, playSession, 900);
assert.equal(pending.length,2); assert.equal(pending[0].judgement,"pending"); assert.equal(pending[0].direction,"left");assert.deepEqual(pending.map((target)=>target.appearanceColor),["#FF0000","#808080"],"validated private Flow appearance reaches renderer targets");const invalidAppearance=projectSessionTargets([{eventId:"invalid-color",centerTimestampMs:1000,appearanceColor:"#ff0000",authoredBeat:{type:"note",hand:"left",placement:4,direction:2}}],playSession,900)[0];assert.equal(Object.hasOwn(invalidAppearance,"appearanceColor"),false,"noncanonical private appearance is not forwarded");

const hit = Object.freeze({ eventId:"flow-1",result:"hit",shadow:false,committedTimelinePositionMs:1000 });
const playHit = Object.freeze({ ...playSession, judgements:Object.freeze([hit]) });
const hitBeforeCommit=projectSessionTargets(events,playHit,999)[0]; assert.equal(hitBeforeCommit.judgement,"pending","real hit remains pending before exact authoritative commit"); assert.equal(hitBeforeCommit.feedbackProgress,undefined);
const hitStart=projectSessionTargets(events,playHit,1000)[0]; assert.equal(hitStart.judgement,"hit"); assert.equal(hitStart.feedbackProgress,0,"hit feedback starts at exact committed timeline");
assert.equal(projectSessionTargets(events,playHit,1175)[0].feedbackProgress,.5);
assert.equal(projectSessionTargets(events,playHit,1350)[0].feedbackProgress,1);
assert.equal(projectSessionTargets(events,playHit,1351).some((entry)=>entry.id==="flow-1"),false,"judged target leaves immediately after common feedback window");

const miss = Object.freeze({ eventId:"flow-1",result:"miss",shadow:false,committedTimelinePositionMs:1181 });
const playMiss = Object.freeze({ ...playSession, judgements:Object.freeze([miss]) });
const missBeforeCommit=projectSessionTargets(events,playMiss,1180)[0]; assert.equal(missBeforeCommit.judgement,"pending","real miss remains pending before exact authoritative commit"); assert.equal(missBeforeCommit.feedbackProgress,undefined);
const missStart=projectSessionTargets(events,playMiss,1181)[0]; assert.equal(missStart.judgement,"miss"); assert.equal(missStart.feedbackProgress,0,"miss feedback starts at exact committed timeline");
assert.equal(projectSessionTargets(events,playMiss,1531)[0].feedbackProgress,1);
assert.equal(projectSessionTargets(events,playMiss,1532).some((entry)=>entry.id==="flow-1"),false);

const shadowOnly=Object.freeze({ ...playSession, judgements:Object.freeze([{...hit,shadow:true}]) }); assert.equal(projectSessionTargets(events,shadowOnly,1100)[0].judgement,"pending","shadow judgement never drives production feedback");
const testTruth=Object.freeze({ session:Object.freeze({purpose:"visual_test"}),judgements:Object.freeze([]),shadowJudgements:Object.freeze([]),scorePartitions:Object.freeze([]) });
const truthBefore=JSON.stringify(testTruth);
const syntheticFirst=projectSessionTargets(events,testTruth,1100); assert.equal(syntheticFirst[0].judgement,"hit"); assert.equal(syntheticFirst[1].judgement,"pending");
const syntheticUnsorted=projectSessionTargets(Object.freeze([events[1],events[0]]),testTruth,1100); assert.equal(syntheticUnsorted[0].id,"flow-1"); assert.equal(syntheticUnsorted[0].judgement,"hit","stable timeline sort owns parity and always begins hit-first"); assert.equal(syntheticUnsorted[1].id,"flow-2"); assert.equal(syntheticUnsorted[1].judgement,"pending");
const syntheticSecond=projectSessionTargets(events,testTruth,2181); assert.equal(syntheticSecond.length,1); assert.equal(syntheticSecond[0].id,"flow-2"); assert.equal(syntheticSecond[0].judgement,"miss"); assert.equal(syntheticSecond[0].feedbackProgress,0);
assert.equal(JSON.stringify(testTruth),truthBefore,"synthetic projection must not mutate gameplay judgement or score truth");
assert.equal(projectSessionTargets(events,testTruth,2531)[0].feedbackProgress,1); assert.equal(projectSessionTargets(events,testTruth,2532).length,0);

const sourceGeometry=Object.freeze({schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v2_legacy_obstacle",kind:"v2_type_1",x:1,y:2,width:1,height:3});
const gameplayGeometry=Object.freeze({schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:1,y:0,width:1,height:3});
const actualObstacle = Object.freeze({
  eventId:"ab-chart-dance-dance-revolution-ddrmix-flow-hard:event:20",
  centerTimestampMs:37039.99938964844,
  intervalStartTimestampMs:37039.99938964844, intervalEndTimestampMs:37064.99938964844,
  authoredBeat:Object.freeze({start:92.5999984741211,end:92.6624984741211,type:"obstacle",sourceGeometry,gameplayGeometry,gridMask:Object.freeze([1,5,9])})
});
assert.equal(projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-2500).length,1,"actual obstacle enters at exact 2500 ms approach boundary");
assert.equal(projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-2500.001).length,0,"actual obstacle stays hidden before approach boundary");
for (const nowMs of [actualObstacle.centerTimestampMs, (actualObstacle.centerTimestampMs+actualObstacle.intervalEndTimestampMs)/2, actualObstacle.intervalEndTimestampMs]) {
  assert.deepEqual(projectSessionTargets([actualObstacle],testTruth,nowMs),[{
    id:actualObstacle.eventId,kind:"obstacle",hand:"neutral",family:"obstacle",cell:null,cells:[1,5,9],sourceGeometry,gameplayGeometry,lane:null,
    beatCenterMs:actualObstacle.centerTimestampMs,intervalStartMs:actualObstacle.centerTimestampMs,intervalEndMs:actualObstacle.intervalEndTimestampMs
  }],`actual obstacle remains exact and feedback-free at ${nowMs}`);
}
assert.equal(projectSessionTargets([actualObstacle],testTruth,actualObstacle.intervalEndTimestampMs+.001).length,0,"actual obstacle leaves immediately after exact end");
const obstacleEarlier=projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-1000);
projectSessionTargets([actualObstacle],testTruth,actualObstacle.intervalEndTimestampMs);
const obstacleEarlierAfterForward=projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-1000);
assert.deepEqual(obstacleEarlierAfterForward,obstacleEarlier,"forward-then-backward projection reconstructs the exact earlier obstacle state");
const longGameplayGeometry=Object.freeze({...gameplayGeometry,x:1,y:0,width:2,height:2});
const longObstacle=Object.freeze({eventId:"long-obstacle",centerTimestampMs:1000,intervalStartTimestampMs:1000,intervalEndTimestampMs:2000,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",sourceGeometry,gameplayGeometry:longGameplayGeometry,gridMask:Object.freeze([1,2,5,6])})});
assert.deepEqual({ start:projectSessionTargets([longObstacle],testTruth,1500)[0]?.intervalStartMs, end:projectSessionTargets([longObstacle],testTruth,1500)[0]?.intervalEndMs },{ start:1000,end:2000 },"long obstacle publishes its exact renderer duration interval beyond generic feedback lifetime");
assert.equal(projectSessionTargets([longObstacle],testTruth,2001).length,0,"long obstacle uses exact interval end");
const falseObstacleHit=Object.freeze({...testTruth,judgements:Object.freeze([{eventId:"long-obstacle",result:"hit",shadow:false,committedTimelinePositionMs:1000}])});
assert.equal(projectSessionTargets([longObstacle],falseObstacleHit,1200)[0]?.judgement,undefined,"obstacle ignores all synthetic/real feedback");
const noObstacleTruth=Object.freeze({...playSession,selectedVariant:Object.freeze({modifierIds:Object.freeze(["no_obstacles"])})});
assert.deepEqual(projectSessionTargets([longObstacle],noObstacleTruth,1200),[],"no_obstacles suppresses Flow visuals");
const contactTruth=Object.freeze({...playSession,selectedVariant:Object.freeze({modifierIds:Object.freeze([])}),obstacleOutcomes:Object.freeze([{eventId:"long-obstacle",result:"contact",firstContactTimelinePositionMs:1100}])});
assert.equal(projectSessionTargets([longObstacle],contactTruth,1100)[0]?.contactPulseProgress,0,"contact pulse starts at exact first contact");
assert.equal(projectSessionTargets([longObstacle],contactTruth,1275)[0]?.contactPulseProgress,.5);
assert.equal(projectSessionTargets([longObstacle],contactTruth,1451)[0]?.contactPulseProgress,undefined,"contact pulse is bounded to 350 ms");
const bombs=Object.freeze(Array.from({length:12},(_,placement)=>Object.freeze({eventId:`bomb-${placement}`,centerTimestampMs:1000+placement,authoredBeat:Object.freeze({type:"bomb",placement})})));
const projectedBombs=projectSessionTargets(bombs,testTruth,-1500);
assert.equal(projectedBombs.length,1,"bomb enters at its exact shared 2500 ms approach boundary");
assert.deepEqual(projectedBombs[0],{id:"bomb-0",kind:"bomb",hand:"neutral",family:"bomb",cell:0,cells:[],lane:null,beatCenterMs:1000},"bomb projection is truthful, neutral and feedback-free");
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
const canonicalPunchCases=Object.freeze([["straight_left","left","straight"],["straight_right","right","straight"],["hook_left","left","hook"],["hook_right","right","hook"],["uppercut_left","left","uppercut"],["uppercut_right","right","uppercut"]]),canonicalPunchEvents=Object.freeze(canonicalPunchCases.map(([type,hand],index)=>Object.freeze({eventId:`canonical-${type}`,centerTimestampMs:1000+index,appearanceColor:hand==="left"?"#FF0000":"#00FF00",authoredBeat:Object.freeze({type,spatialTarget:Object.freeze({targetCell:4+index})})}))),canonicalPunchTargets=projectSessionTargets(canonicalPunchEvents,playSession,900);
assert.deepEqual(canonicalPunchTargets.map((target)=>[target.id,target.hand,target.family,target.appearanceColor]),canonicalPunchCases.map(([type,hand,family])=>[`canonical-${type}`,hand,family,hand==="left"?"#FF0000":"#00FF00"]),"all six canonical Boxing authored types map exact family/hand/color without suffix inference");
const boxingEvents = Object.freeze([
  Object.freeze({ eventId:"punch-left",centerTimestampMs:1000,appearanceColor:"#FF0000",authoredBeat:Object.freeze({type:"hook_left",spatialTarget:Object.freeze({targetCell:5,entryDirection:"up"})}) }),
  boxingObstacleEvent("weave-left",1100,"weave_left",{x:2,y:0,width:2,height:2}),
  boxingObstacleEvent("weave-right",1200,"weave_right",{x:0,y:0,width:2,height:2}),
  Object.freeze({ eventId:"guard",centerTimestampMs:1300,appearanceColor:"#808080",authoredBeat:Object.freeze({type:"guard",guardTarget:Object.freeze({leftCell:4,rightCell:7})}) }),
  boxingObstacleEvent("squat",1400,"squat",{x:0,y:2,width:4,height:1})
]);
const boxing = projectSessionTargets(boxingEvents,playSession,900);
assert.equal(boxing.find((entry)=>entry.id==="punch-left")?.lane,"left","punch lane follows authored hand");assert.equal(boxing.find((entry)=>entry.id==="punch-left")?.appearanceColor,"#FF0000","validated private Boxing punch appearance reaches renderer target");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="weave-left")?.hand,lane:boxing.find((entry)=>entry.id==="weave-left")?.lane,cells:boxing.find((entry)=>entry.id==="weave-left")?.cells},{hand:"left",lane:"left",cells:[2,3,6,7]},"left weave keeps directional lane and exact Grid blocked cells");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="weave-right")?.hand,lane:boxing.find((entry)=>entry.id==="weave-right")?.lane,cells:boxing.find((entry)=>entry.id==="weave-right")?.cells},{hand:"right",lane:"right",cells:[0,1,4,5]},"right weave keeps directional lane and exact Grid blocked cells");
assert.deepEqual({lane:boxing.find((entry)=>entry.id==="guard")?.lane,cells:boxing.find((entry)=>entry.id==="guard")?.cells,appearanceColor:boxing.find((entry)=>entry.id==="guard")?.appearanceColor},{lane:null,cells:[4,7],appearanceColor:undefined},"guard remains fixed-color despite a hostile private appearance and preserves Grid cells");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="squat")?.hand,lane:boxing.find((entry)=>entry.id==="squat")?.lane,cells:boxing.find((entry)=>entry.id==="squat")?.cells},{hand:"neutral",lane:null,cells:[8,9,10,11]},"squat remains neutral for lane duplication and preserves Grid cells");
for(const target of boxing.filter((entry)=>entry.kind==="obstacle")){assert.ok(target.sourceGeometry&&target.gameplayGeometry&&target.intervalEndMs-target.intervalStartMs===200,"Boxing projection must privately retain source/gameplay geometry and exact interval");assert.equal(target.judgement,undefined,"Boxing walls never receive Flow or synthetic continuous outcomes");}
assert.deepEqual(projectSessionTargets([boxingEvents[1]],testTruth,1100),projectSessionTargets([boxingEvents[1]],playSession,1100),"unranked Test must project the same feedback-free Boxing wall without gameplay truth");

const bounceTiming={anchorMs:125,tempoSegments:[{startBeat:0,bpm:120},{startBeat:16,bpm:180}],stopSegments:[{startBeat:15,durationMs:250}],timeSignatureSegments:[{startBeat:0,numerator:4,denominator:4}]},mapBeat=createAuthoredBeatToTimelineMs(bounceTiming),bounceHit=mapBeat(18),bounceEvents=[{eventId:"bounce-flow",centerTimestampMs:bounceHit,authoredBeat:{type:"note",start:18,hand:"left",placement:4}},{eventId:"bounce-guard",centerTimestampMs:bounceHit,authoredBeat:{type:"guard",start:18,guardTarget:{leftCell:5,rightCell:6}}},{eventId:"bounce-bomb",centerTimestampMs:bounceHit,authoredBeat:{type:"bomb",start:18,placement:1}}],bounceIndex=createSessionTargetIndex(bounceEvents,{mapBeatToTimelineMs:mapBeat,bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:1200}),expectedBounceStart=mapBeat(14);
assert.equal(bounceIndex.timingMismatchCount,0);assert.equal(bounceIndex.leadLimited,false);const bounced=projectSessionTargets(bounceEvents,playSession,expectedBounceStart,bounceIndex);assert.equal(bounced.find(target=>target.id==="bounce-flow")?.bounceStartMs,expectedBounceStart,"tempo/stop authority derives exact private start");assert.equal(bounced.find(target=>target.id==="bounce-guard")?.bounceStartMs,expectedBounceStart,"guard pair shares one event start");assert.equal(Object.hasOwn(bounced.find(target=>target.id==="bounce-bomb")??{},"bounceStartMs"),false,"bomb never gains bounce data");
const mismatchIndex=createSessionTargetIndex([{...bounceEvents[0],centerTimestampMs:bounceHit+0.0011}],{mapBeatToTimelineMs:mapBeat,bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:1200});assert.equal(mismatchIndex.timingMismatchCount,1);assert.equal(Object.hasOwn(projectSessionTargets([{...bounceEvents[0],centerTimestampMs:bounceHit+0.0011}],playSession,bounceHit,mismatchIndex)[0]??{},"bounceStartMs"),false,"mapper mismatch fails static without rewriting hit time");
const cappedMap=(beat)=>beat===20?20_000:0,cappedEvent={eventId:"capped",centerTimestampMs:20_000,authoredBeat:{type:"note",start:20,placement:1,hand:"left"}},cappedEvents=[cappedEvent],cappedIndex=createSessionTargetIndex(cappedEvents,{mapBeatToTimelineMs:cappedMap,bounceLeadBeats:4,normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:1200});assert.equal(cappedIndex.leadLimited,true);assert.equal(projectSessionTargets(cappedEvents,playSession,17_500,cappedIndex)[0]?.bounceStartMs,10_000,"bounce lead is capped at 10 seconds");
assert.equal(projectSessionTargets(events,playSession,0).length,2);
assert.equal(projectSessionTargets(Array.from({length:200},(_,index)=>({eventId:`event-${index}`,centerTimestampMs:index,authoredBeat:{type:"note"}})),testTruth,0).length,128,"projection remains bounded");

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
