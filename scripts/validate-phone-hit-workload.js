// @ts-check
import assert from "node:assert/strict";
import { createPhoneHitWorkload, phoneHitWorkload } from "../src/phone-hit-workload.js";
import { createPhonePerformanceWorkload } from "../src/phone-performance-workload.js";

const workload = createPhoneHitWorkload();
assert.equal(workload.events.length, 6000);
assert.deepEqual(workload.events, createPhonePerformanceWorkload().events, "matched corpus includes identical authored walls");
assert.equal(phoneHitWorkload.firstHitMs, 4300);
assert.equal(phoneHitWorkload.noteStride, 5);
assert.equal(phoneHitWorkload.contract, "aerobeat/phone_visual_test_real_hit_every_fifth_note.v1");

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

// The unchanged authored corpus supplies both hands, every grid column and all
// eight directional glyphs to the committed presentation schedule. No private
// ids/placements/directions are included in the browser's scalar report.
const directionNames = ["up","down","left","right","up-left","up-right","down-left","down-right"];
const committed = workload.events.filter((event) => /^note-\d+$/.test(event.eventId) && Number(event.eventId.slice(5)) >= 100 && (Number(event.eventId.slice(5)) - 100) % phoneHitWorkload.noteStride === 0).sort((a,b) => a.centerTimestampMs - b.centerTimestampMs);
assert.deepEqual(new Set(committed.map((event) => event.authoredBeat.hand)), new Set(["left","right"]), "committed schedule covers both wrist roles");
assert.deepEqual(new Set(committed.map((event) => event.authoredBeat.placement % 4)), new Set([0,1,2,3]), "committed schedule covers four authored columns");
assert.deepEqual(new Set(committed.map((event) => directionNames[event.authoredBeat.direction])), new Set(directionNames), "committed schedule covers all authored directions");
assert.deepEqual(new Set(committed.map((event) => event.appearanceColor ?? null)), new Set([null]), "same corpus has no private appearance override; renderer derives hand-role colors");
for (const event of committed.slice(0, 16)) {
  const target = workload.frameHit(event.centerTimestampMs).targets.find((entry) => entry.id === event.eventId);
  const corpse = workload.frameHit(event.centerTimestampMs).aftermath.find((entry) => entry.targetId === event.eventId);
  assert.equal(target?.hand, event.authoredBeat.hand, "projected hit retains authored hand color role");
  assert.equal(target?.cell, event.authoredBeat.placement, "projected hit retains authored cell");
  assert.equal(target?.direction, directionNames[event.authoredBeat.direction], "projected hit retains authored direction");
  assert.equal(corpse?.hand, event.authoredBeat.hand, "projected corpse retains authored hand color role");
  assert.equal(corpse?.appearanceColor, undefined, "no invented per-note color override");
}

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
assert.deepEqual(committed.slice(0, 4).map((event) => [event.eventId,event.centerTimestampMs]), [["note-100",4300],["note-105",4515],["note-110",4730],["note-115",4945]], "every fifth authored note; wall-113 is skipped");
assert.equal(committed.some((event) => event.eventId.startsWith("wall-")), false, "walls never become hit records");
const seventh = committed[6].centerTimestampMs, eighth = committed[7].centerTimestampMs;
assert.equal(seventh, 5590, "seventh committed hit is note-130 at 5590");
assert.equal(eighth, 5805, "eighth committed hit is note-135 at 5805");
const seven = workload.frameHit(seventh).aftermath;
assert.equal(seven.length, 7, "repeated 7: live cap reached");
assert.deepEqual(new Set(seven.map((entry) => entry.targetId)), new Set(committed.slice(0,7).map((event) => event.eventId)), "seven-entry FIFO contains first seven hits");
const eight = workload.frameHit(eighth).aftermath;
assert.equal(eight.length, 7, "repeated 7+eviction: old corpse no longer live after fade tail");
assert.deepEqual(new Set(eight.map((entry) => entry.targetId)), new Set(committed.slice(1,8).map((event) => event.eventId)), "eighth hit evicts oldest and retains seven newest");
assert.equal(workload.frameHit(eighth - 1).aftermath.some((entry) => entry.targetId === committed[7].eventId), false, "future exclusion: eighth hit cannot enter before commit");

// Future exclusion must hold at a timeline before the eighth commit: otherwise
// future records can displace the first corpse despite never having happened.
assert.equal(workload.frameHit(4300).aftermath[0].targetId, firstId, "future exclusion: only committed records enter aftermath");
assert.equal(workload.frameCounts(4300, true).aftermathEntries, 1);
assert.deepEqual(workload.frameHit(4300), workload.frameHit(4300), "deterministic seek/replay");
console.log(`Phone Test hit workload passed: baseline ${minimum}–${maximum}, t850=63, first-hit, 350ms feedback, repeated 7+eviction, future exclusion.`);
