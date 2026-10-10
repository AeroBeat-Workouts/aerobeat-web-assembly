// @ts-check
import assert from "node:assert/strict";
import { createPhoneHitWorkload, phoneHitWorkload } from "../src/phone-hit-workload.js";
import { createPhonePerformanceWorkload } from "../src/phone-performance-workload.js";

const workload = createPhoneHitWorkload();
assert.equal(workload.events.length, 6000);
assert.deepEqual(workload.events, createPhonePerformanceWorkload().events, "matched corpus includes identical authored walls");
assert.equal(phoneHitWorkload.firstHitMs, 4300);

// Both scenarios use Test's short pending-note deadline, never Play's 1000 ms tail.
// Sample a bounded representative range; full millisecond census is a separate
// host research gate and would rebuild a 6,000-event Map on every iteration.
let minimum = Infinity, maximum = -Infinity;
for (let nowMs = 0; nowMs < 12_000; nowMs += 209) {
  const noHit = workload.frameNoHit(nowMs);
  const count = noHit.targets.length;
  minimum = Math.min(minimum, count);
  maximum = Math.max(maximum, count);
  assert.equal(noHit.aftermath.length, 0, "automatic Test aftermath stays disabled");
  assert.equal(noHit.targets.some((target) => target.judgement === "hit" || target.judgement === "miss"), false, "automatic Test feedback stays disabled");
}
assert(minimum >= 59 && maximum <= 64, `Test baseline outside 59–64: ${minimum}–${maximum}`);
assert.equal(workload.frameNoHit(0).targets.length, 59, "Test baseline t0 exactly 59");
assert.equal(workload.frameNoHit(209).targets.length, 64, "Test baseline t209 exactly 64");
assert.equal(workload.frameNoHit(850).targets.length, 63, "Test baseline t850 differs from Play's 78");

// Named first-hit and 350 ms feedback boundaries.
const firstId = "note-100";
const before = workload.frameHit(4299);
assert.equal(before.targets.find((target) => target.id === firstId)?.judgement, "pending", "first-hit: pending before commit");
assert.equal(before.aftermath.length, 0, "first-hit: no premature corpse");
const first = workload.frameHit(4300);
assert.equal(first.targets.find((target) => target.id === firstId)?.judgement, "hit", "first-hit: committed real feedback");
assert.equal(first.targets.find((target) => target.id === firstId)?.tier, "great", "first-hit: real GREAT tier");
assert.equal(first.aftermath.length, 1, "first-hit: exactly one clipped corpse entry");
assert.equal(first.aftermath[0].targetId, firstId);
assert.equal(first.aftermath[0].sliceT, undefined, "first-hit: midpoint fallback, no fabricated wrist sample");
assert.equal(workload.frameCounts(4300, true).intendedAftermathPieces, 2);
assert.equal(workload.frameHit(4649).targets.find((target) => target.id === firstId)?.judgement, "hit", "350ms feedback: last live millisecond");
assert.equal(workload.frameHit(4650).targets.some((target) => target.id === firstId), false, "350ms feedback: exact expiry");
assert.equal(workload.frameHit(4650).aftermath.some((entry) => entry.targetId === firstId), true, "350ms feedback: corpse survives label");
assert.equal(workload.frameNoHit(4300).aftermath.length, 0, "matched no-hit does not invent corpses");

// Repeated hits keep seven live aftermath entries; the eighth evicts the oldest.
const committed = workload.events.filter((event) => /^note-\d+$/.test(event.eventId) && Number(event.eventId.slice(5)) >= 100 && (Number(event.eventId.slice(5)) - 100) % 4 === 0).sort((a,b) => a.centerTimestampMs - b.centerTimestampMs);
assert.deepEqual(committed.slice(0, 3).map((event) => [event.eventId,event.centerTimestampMs]), [["note-100",4300],["note-104",4472],["note-108",4644]]);
const seventh = committed[6].centerTimestampMs, eighth = committed[7].centerTimestampMs;
assert.equal(workload.frameHit(seventh).aftermath.length, 7, "repeated 7: live cap reached");
const eight = workload.frameHit(eighth).aftermath;
assert.equal(eight.length, 7, "repeated 7+eviction: old corpse no longer live after fade tail");
assert.equal(eight.some((entry) => entry.targetId === firstId), false, "repeated 7+eviction: first corpse evicted");
assert.equal(eight.some((entry) => entry.targetId === committed[7].eventId), true);

// Future exclusion must hold at a timeline before the eighth commit: otherwise
// future records can displace the first corpse despite never having happened.
assert.equal(workload.frameHit(4300).aftermath[0].targetId, firstId, "future exclusion: only committed records enter aftermath");
assert.equal(workload.frameCounts(4300, true).aftermathEntries, 1);
assert.deepEqual(workload.frameHit(4300), workload.frameHit(4300), "deterministic seek/replay");
console.log(`Phone Test hit workload passed: baseline ${minimum}–${maximum}, t850=63, first-hit, 350ms feedback, repeated 7+eviction, future exclusion.`);
