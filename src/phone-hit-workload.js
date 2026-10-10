// @ts-check
import { createPhonePerformanceWorkload, phonePerformanceWorkload } from "./phone-performance-workload.js";
import { createSessionTargetIndex, projectSessionTargets } from "./session-render-projection.js";
import { projectAftermathEntries } from "./gameplay-frame-effects.js";

// Presentation-only Test fixture: authored note-100 at 4300 ms, then each fourth
// authored note. Walls never become judgements. No wrist evidence is fabricated;
// the renderer uses its midpoint slice fallback, not a measured cut position.
export const phoneHitWorkload = Object.freeze({
  contract: "aerobeat/phone_visual_test_real_hit_every_fourth_note.v1",
  firstNote: 100,
  noteStride: 4,
  firstHitMs: 4300,
  feedbackDurationMs: 350,
  expectedVisibleMin: 59,
  expectedVisibleMax: 64,
  expectedVisibleAt850: 63
});

/** A private same-corpus pair. Nothing in this module publishes geometry or IDs. */
export function createPhoneHitWorkload() {
  const events = createPhonePerformanceWorkload().events;
  const index = createSessionTargetIndex(events);
  const hits = Object.freeze(events.filter((event) => {
    const ordinal = Number(event.eventId.slice(5));
    return event.authoredBeat.type === "note" && ordinal >= phoneHitWorkload.firstNote &&
      (ordinal - phoneHitWorkload.firstNote) % phoneHitWorkload.noteStride === 0;
  }).map((event) => Object.freeze({
    eventId: event.eventId,
    result: "hit",
    tier: "great",
    shadow: false,
    committedTimelinePositionMs: event.centerTimestampMs
  })).sort((a, b) => a.committedTimelinePositionMs - b.committedTimelinePositionMs));
  const session = Object.freeze({purpose: "visual_test"});
  const selectedVariant = Object.freeze({modifierIds: Object.freeze([])});
  const obstacleOutcomes = Object.freeze([]);
  const emptyJudgements = Object.freeze([]);
  /** @param {number} elapsedMs @param {boolean} withHits */
  function frameFor(elapsedMs, withHits) {
    const nowMs = Math.max(0, elapsedMs) % phonePerformanceWorkload.cycleMs;
    // Future judgements must not evict committed aftermath or alter feedback.
    const judgements = withHits ? hits.filter((hit) => hit.committedTimelinePositionMs <= nowMs) : emptyJudgements;
    const gameplay = {session, selectedVariant, obstacleOutcomes, judgements};
    const targets = projectSessionTargets(events, gameplay, nowMs, index, 180, false, 1);
    const aftermath = projectAftermathEntries(events, gameplay, nowMs, targets, index, null, null, false);
    return {presentation: "flow", nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath};
  }
  return Object.freeze({
    // Identical authored objects, including the same wall geometry and order.
    events,
    frameNoHit: (elapsedMs) => frameFor(elapsedMs, false),
    frameHit: (elapsedMs) => frameFor(elapsedMs, true),
    // Deliberately private diagnostic scalars, not snapshot/event/bridge fields.
    frameCounts: (elapsedMs, withHits = false) => {
      const frame = frameFor(elapsedMs, withHits);
      return Object.freeze({targets: frame.targets.length, aftermathEntries: frame.aftermath.length,
        intendedAftermathPieces: frame.aftermath.reduce((count, entry) => count + (entry.family === "flow" ? 2 : 1), 0),
        hitFeedback: frame.targets.filter((target) => target.judgement === "hit").length});
    }
  });
}
