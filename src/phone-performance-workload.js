// @ts-check
import { createSessionTargetIndex, projectSessionTargets } from "./session-render-projection.js";

// Exact deterministic ABCCBA profile event geometry/cadence (profile-camera-abccba.mjs).
// v2 distinguishes current Play's 1000ms post-center note clearance from
// historical physical v1; the authored no-hit corpus and spawn lead are unchanged.
export const phonePerformanceWorkload = Object.freeze({
  contract: "aerobeat/abccba_play_clearance_2500.v2",
  eventCount: 6000,
  eventIntervalMs: 43,
  spawnLeadMs: 2500,
  cycleMs: 180000,
  expectedVisibleMin: 59,
  expectedVisibleMax: 83
});

/** One immutable event/index set, shared across every diagnostic mode. */
export function createPhonePerformanceWorkload() {
  const sourceGeometry = Object.freeze({schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v3_obstacle_rect",kind:"v3_rect",x:1,y:0,width:1,height:3});
  const gameplayGeometry = Object.freeze({schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:1,y:0,width:1,height:3});
  const events = Object.freeze(Array.from({length:phonePerformanceWorkload.eventCount},(_,index)=>index%113===0
    ? Object.freeze({eventId:`wall-${index}`,centerTimestampMs:index*43,intervalStartTimestampMs:index*43,intervalEndTimestampMs:index*43+1200,authoredBeat:Object.freeze({type:"obstacle",sourceGeometry,gameplayGeometry,gridMask:Object.freeze([1,5,9])})})
    : Object.freeze({eventId:`note-${index}`,centerTimestampMs:index*43,authoredBeat:Object.freeze({type:"note",hand:index%2?"right":"left",placement:index%12,direction:index%8})})).reverse());
  const index=createSessionTargetIndex(events);
  const gameplay=Object.freeze({session:Object.freeze({purpose:"play"}),selectedVariant:Object.freeze({modifierIds:Object.freeze([])}),judgements:Object.freeze([]),obstacleOutcomes:Object.freeze([])});
  return Object.freeze({
    events,
    /** @param {number} elapsedMs */
    frame(elapsedMs) {
      const timeline=Math.max(0,elapsedMs)%phonePerformanceWorkload.cycleMs;
      return {presentation:"flow",nowMs:timeline,targets:projectSessionTargets(events,gameplay,timeline,index),timingWindowBeforeMs:180,timingWindowAfterMs:180};
    }
  });
}
