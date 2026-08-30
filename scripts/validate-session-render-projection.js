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
assert.equal(projectSessionTargets(events,playHit,999)[0].feedbackProgress,0,"feedback clamps before exact commit");
const hitStart=projectSessionTargets(events,playHit,1000)[0]; assert.equal(hitStart.judgement,"hit"); assert.equal(hitStart.feedbackProgress,0,"hit feedback starts at exact committed timeline");
assert.equal(projectSessionTargets(events,playHit,1175)[0].feedbackProgress,.5);
assert.equal(projectSessionTargets(events,playHit,1350)[0].feedbackProgress,1);
assert.equal(projectSessionTargets(events,playHit,1351).some((entry)=>entry.id==="flow-1"),false,"judged target leaves immediately after common feedback window");

const miss = Object.freeze({ eventId:"flow-1",result:"miss",shadow:false,committedTimelinePositionMs:1181 });
const playMiss = Object.freeze({ ...playSession, judgements:Object.freeze([miss]) });
assert.equal(projectSessionTargets(events,playMiss,1180)[0].feedbackProgress,0);
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

assert.equal(projectSessionTargets(events,playSession,0).length,2);
assert.equal(projectSessionTargets(Array.from({length:200},(_,index)=>({eventId:`event-${index}`,centerTimestampMs:index,authoredBeat:{type:"note"}})),testTruth,0).length,128,"projection remains bounded");
console.log("Real commitment-timed feedback and unscored alternating visual Test projection passed.");
