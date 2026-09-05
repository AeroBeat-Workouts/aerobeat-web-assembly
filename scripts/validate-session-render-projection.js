// @ts-check

import assert from "node:assert/strict";
import { projectSessionTargets } from "../src/session-render-projection.js";

const events = Object.freeze([
  Object.freeze({ eventId:"flow-1", centerTimestampMs:1000, authoredBeat:Object.freeze({type:"note",hand:"left",placement:4,direction:2}) }),
  Object.freeze({ eventId:"flow-2", centerTimestampMs:2000, authoredBeat:Object.freeze({type:"note",hand:"right",placement:7,direction:"up"}) })
]);
const playSession = Object.freeze({ session:Object.freeze({purpose:"play"}), judgements:Object.freeze([]), shadowJudgements:Object.freeze([]), scorePartitions:Object.freeze([]) });
const pending = projectSessionTargets(events, playSession, 900);
assert.equal(pending.length,2); assert.equal(pending[0].judgement,"pending"); assert.equal(pending[0].direction,"left");

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

const crouchGeometry = Object.freeze({schema:"aerobeat/flow_obstacle_geometry",version:1,coordinateSpace:"beatsaber_lane_layer",x:1,y:2,width:1,height:3});
const actualObstacle = Object.freeze({
  eventId:"ab-chart-dance-dance-revolution-ddrmix-flow-hard:event:20",
  centerTimestampMs:37039.99938964844,
  intervalStartTimestampMs:37039.99938964844, intervalEndTimestampMs:37064.99938964844,
  authoredBeat:Object.freeze({start:92.5999984741211,end:92.6624984741211,type:"obstacle",geometry:crouchGeometry,gridMask:Object.freeze([1])})
});
assert.equal(projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-2500).length,1,"actual obstacle enters at exact 2500 ms approach boundary");
assert.equal(projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-2500.001).length,0,"actual obstacle stays hidden before approach boundary");
for (const nowMs of [actualObstacle.centerTimestampMs, (actualObstacle.centerTimestampMs+actualObstacle.intervalEndTimestampMs)/2, actualObstacle.intervalEndTimestampMs]) {
  assert.deepEqual(projectSessionTargets([actualObstacle],testTruth,nowMs),[{
    id:actualObstacle.eventId,kind:"obstacle",hand:"neutral",family:"obstacle",cell:null,cells:[1],geometry:crouchGeometry,lane:null,
    beatCenterMs:actualObstacle.centerTimestampMs,intervalStartMs:actualObstacle.centerTimestampMs,intervalEndMs:actualObstacle.intervalEndTimestampMs
  }],`actual obstacle remains exact and feedback-free at ${nowMs}`);
}
assert.equal(projectSessionTargets([actualObstacle],testTruth,actualObstacle.intervalEndTimestampMs+.001).length,0,"actual obstacle leaves immediately after exact end");
const obstacleEarlier=projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-1000);
projectSessionTargets([actualObstacle],testTruth,actualObstacle.intervalEndTimestampMs);
const obstacleEarlierAfterForward=projectSessionTargets([actualObstacle],testTruth,actualObstacle.centerTimestampMs-1000);
assert.deepEqual(obstacleEarlierAfterForward,obstacleEarlier,"forward-then-backward projection reconstructs the exact earlier obstacle state");
const longGeometry=Object.freeze({...crouchGeometry,x:1,y:1,width:2,height:2});
const longObstacle=Object.freeze({eventId:"long-obstacle",centerTimestampMs:1000,intervalStartTimestampMs:1000,intervalEndTimestampMs:2000,authoredBeat:Object.freeze({start:1,end:2,type:"obstacle",geometry:longGeometry,gridMask:Object.freeze([1,2,5,6])})});
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

const boxingEvents = Object.freeze([
  Object.freeze({ eventId:"punch-left",centerTimestampMs:1000,authoredBeat:Object.freeze({type:"hook_left",spatialTarget:Object.freeze({targetCell:5,entryDirection:"up"})}) }),
  Object.freeze({ eventId:"weave-left",centerTimestampMs:1100,authoredBeat:Object.freeze({type:"weave_left",blockedCells:Object.freeze([0,1,4,5])}) }),
  Object.freeze({ eventId:"weave-right",centerTimestampMs:1200,authoredBeat:Object.freeze({type:"weave_right",blockedCells:Object.freeze([2,3,6,7])}) }),
  Object.freeze({ eventId:"guard",centerTimestampMs:1300,authoredBeat:Object.freeze({type:"guard",guardTarget:Object.freeze({leftCell:4,rightCell:7})}) }),
  Object.freeze({ eventId:"squat",centerTimestampMs:1400,authoredBeat:Object.freeze({type:"squat",blockedCells:Object.freeze([8,9,10,11])}) })
]);
const boxing = projectSessionTargets(boxingEvents,playSession,900);
assert.equal(boxing.find((entry)=>entry.id==="punch-left")?.lane,"left","punch lane follows authored hand");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="weave-left")?.hand,lane:boxing.find((entry)=>entry.id==="weave-left")?.lane,cells:boxing.find((entry)=>entry.id==="weave-left")?.cells},{hand:"left",lane:"left",cells:[0,1,4,5]},"left weave keeps directional lane and exact Grid blocked cells");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="weave-right")?.hand,lane:boxing.find((entry)=>entry.id==="weave-right")?.lane,cells:boxing.find((entry)=>entry.id==="weave-right")?.cells},{hand:"right",lane:"right",cells:[2,3,6,7]},"right weave keeps directional lane and exact Grid blocked cells");
assert.deepEqual({lane:boxing.find((entry)=>entry.id==="guard")?.lane,cells:boxing.find((entry)=>entry.id==="guard")?.cells},{lane:null,cells:[4,7]},"guard remains neutral for lane duplication and preserves Grid cells");
assert.deepEqual({hand:boxing.find((entry)=>entry.id==="squat")?.hand,lane:boxing.find((entry)=>entry.id==="squat")?.lane,cells:boxing.find((entry)=>entry.id==="squat")?.cells},{hand:"neutral",lane:null,cells:[8,9,10,11]},"squat remains neutral for lane duplication and preserves Grid cells");

assert.equal(projectSessionTargets(events,playSession,0).length,2);
assert.equal(projectSessionTargets(Array.from({length:200},(_,index)=>({eventId:`event-${index}`,centerTimestampMs:index,authoredBeat:{type:"note"}})),testTruth,0).length,128,"projection remains bounded");
console.log("Real 350 ms feedback, lane cue semantics, Grid cells, and unscored alternating visual Test projection passed.");
