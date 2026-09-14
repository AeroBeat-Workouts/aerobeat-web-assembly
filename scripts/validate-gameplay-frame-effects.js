// @ts-check
// 0.0.52 W2 unit oracles: p5pr aftermath FIFO + dntq hazard-contact events +
// deterministic seed + privacy (only spawn WU triple / eventId+atMs cross).
import assert from "node:assert/strict";
import { projectAftermathEntries, projectHazardContactEvents, aftermathSeedForTargetId } from "../src/gameplay-frame-effects.js";

const flowNote = (id, center) => Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: id, type: "note", centerTimestampMs: center, authoredBeat: { type: "note", hand: "left", placement: 4, direction: "right" } });
const punch = (id, type, hand, center) => Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: id, type, centerTimestampMs: center, authoredBeat: { type, spatialTarget: { targetCell: 4, entryDirection: "up" } }, hand });
const guard = (id, crossed, center) => Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: id, type: crossed ? "crossed_guard" : "guard", centerTimestampMs: center, authoredBeat: { type: crossed ? "crossed_guard" : "guard", guardTarget: { leftCell: 1, rightCell: 2, ...(crossed ? { crossed: true } : {}) } } });
const bomb = (id, center) => Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: id, type: "bomb", centerTimestampMs: center, authoredBeat: { type: "bomb", placement: 5 } });
const obstacleFlow = (id, start, end) => Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: id, type: "obstacle", centerTimestampMs: start, intervalStartTimestampMs: start, intervalEndTimestampMs: end, authoredBeat: { type: "obstacle" } });

const hitJudgement = (eventId, commitMs, shadow = false) => Object.freeze({ schema: "aerobeat/gameplay_judgement", version: 2, sessionPurpose: "play", eventId, rulesetId: "flow_colliders_v1", recipeId: null, result: "hit", beatCenterTimestampMs: commitMs, committedTimelinePositionMs: commitMs, evidenceTimestampMs: null, timingOffsetMs: 0, diagnostics: [], shadow });
const missJudgement = (eventId, commitMs) => Object.freeze({ ...hitJudgement(eventId, commitMs), result: "miss" });
const snapshot = (judgements) => Object.freeze({ judgements: Object.freeze(judgements), obstacleOutcomes: [], hazardOutcomes: [] });

// ---------- Mapping per family/mode ----------
{
  const events = [flowNote("n1", 1000), punch("p1", "straight_left", "left", 1200), punch("p2", "hook_right", "right", 1400), punch("p3", "uppercut_left", "left", 1600), guard("g1", false, 1800), guard("g2", true, 2000), bomb("b1", 900), obstacleFlow("o1", 950, 1100)];
  // Commit times: n1@1000 is already past the retention window at nowMs 2100
  // (retention tail is 950 ms). p1..g2 fall inside.
  const js = [hitJudgement("n1", 1000), hitJudgement("p1", 1350), hitJudgement("p2", 1550), hitJudgement("p3", 1750), hitJudgement("g1", 1900), hitJudgement("g2", 2000)];
  const list = projectAftermathEntries(events, snapshot(js), 2100);
  assert.equal(list.length, 5, "five live HITs produce exactly five entries; oldest past the retention window drops");
  const byId = new Map(list.map((e) => [e.targetId, e]));
  assert.equal(byId.get("n1"), undefined, "n1 dropped past retention window (commit too old)");
  assert.equal(byId.get("p1").family, "punch"); assert.equal(byId.get("p1").hand, "left"); assert.equal(byId.get("p1").mode, "straight");
  assert.equal(byId.get("p2").hand, "right"); assert.equal(byId.get("p2").mode, "hook");
  assert.equal(byId.get("p3").hand, "left"); assert.equal(byId.get("p3").mode, "uppercut");
  assert.deepEqual([byId.get("g1").family, byId.get("g1").hand, byId.get("g1").mode], ["guard", "both", "bonk"], "guard collision mode → guard/bonk");
  assert.deepEqual([byId.get("g2").family, byId.get("g2").hand, byId.get("g2").mode], ["guard", "both", "bonk"], "crossed_guard gesture/collision → guard/bonk");
  // Separate Flow mapping check with a recent commit + a matching projection target.
  const nfTarget = Object.freeze({ id: "nf", kind: "flow", hand: "left", family: "flow", cell: 4, cells: [4], lane: null, beatCenterMs: 3000 });
  const freshFlow = projectAftermathEntries([flowNote("nf", 3000)], snapshot([hitJudgement("nf", 3000)]), 3200, [nfTarget]);
  assert.equal(freshFlow.length, 1);
  // Cell 4 = column 0 (x −1.5), row 1 (y 1) of the canonical top-left 4×3 grid.
  assert.deepEqual(freshFlow[0], { targetId: "nf", hitCommitMs: 3000, family: "flow", hand: "neutral", mode: "slice", spawn: { x: -1.5, y: 1, z: 0 }, seed: aftermathSeedForTargetId("nf") }, "Flow note maps to flow/slice with cell-derived spawn");
  // Bombs and obstacles never appear.
  assert.equal(byId.has("b1"), false, "bombs never produce aftermath entries");
  assert.equal(byId.has("o1"), false, "obstacles never produce aftermath entries");
}

// ---------- Zero entries on misses / idle ----------
{
  const events = [flowNote("m1", 1000), flowNote("m2", 1200)];
  const jsMisses = [missJudgement("m1", 1000), missJudgement("m2", 1200)];
  assert.deepEqual(projectAftermathEntries(events, snapshot(jsMisses), 1500), [], "misses produce zero aftermath entries");
  assert.deepEqual(projectAftermathEntries([], snapshot([]), 0), [], "idle produces zero entries");
  assert.deepEqual(projectAftermathEntries(events, snapshot([]), 0), [], "no judgements produces zero entries");
}

// ---------- FIFO eviction order + fade-tail drop ----------
{
  // 10 hits 100 ms apart starting at commit 1300 so all stay within retention.
  const N = 10;
  const events = Array.from({ length: N }, (_, i) => flowNote(`f${i}`, 1300 + i * 100));
  const js = events.map((e, i) => hitJudgement(e.eventId, 1300 + i * 100));
  // At nowMs = 2450 (mid-run, well inside retention for f0..f9), the most-recent 7
  // commits survive as "live"; the 8th-newest (f2 @ 1500) is stamped evictedAtMs and
  // sits inside the fade tail until 1500 + 350 = 1850. Past that it has already
  // dropped, so at 2450 we see only the newest 7 live.
  const atNow2450 = projectAftermathEntries(events, snapshot(js), 2450);
  assert.equal(atNow2450.length, 7, "retention window trims everything older than ~now-950 ms to the newest 7 live");
  assert.deepEqual(atNow2450.map((e) => e.targetId).sort(), ["f3", "f4", "f5", "f6", "f7", "f8", "f9"].sort(), "the 7 newest commits are retained, oldest trimmed");

  // To exercise the 8th-newest stamp path in isolation, use a tighter timing
  // window: commits f0..f9 each 30 ms apart so at nowMs=600 we're right at the
  // eviction boundary and the evicted f0 is still in its fade tail.
  const tightEvents = Array.from({ length: 10 }, (_, i) => flowNote(`t${i}`, 300 + i * 30));
  const tightJs = tightEvents.map((e, i) => hitJudgement(e.eventId, 300 + i * 30));
  // Retention tail is 950 ms; at nowMs=600 nothing is yet expired. Newest 7 = t3..t9
  // (commits 390..570), 8th-newest = t2 (commit 360). Its evicted fade tail ends at
  // 360+350=710, so at nowMs=600 it is still present, stamped with evictedAtMs=360.
  const atTight600 = projectAftermathEntries(tightEvents, snapshot(tightJs), 600);
  assert.equal(atTight600.length, 8, "tight window: 7 live + 1 evicted-in-fade-tail = 8 entries");
  const tightEvicted = atTight600.find((e) => e.evictedAtMs !== undefined);
  assert.ok(tightEvicted, "exactly one entry carries evictedAtMs within the fade tail");
  assert.equal(tightEvicted.targetId, "t2", "the 8th-newest live commit (t2) is the evicted one");
  assert.equal(tightEvicted.evictedAtMs, 360, "evictedAtMs equals the evicted entry's own commit time");
  // Advance past the fade tail: t2 drops, leaving 7.
  const atTight711 = projectAftermathEntries(tightEvents, snapshot(tightJs), 711);
  assert.equal(atTight711.length, 7, "past the fade tail (360+350=710), the evicted entry drops: only 7 live remain");
  assert.equal(atTight711.some((e) => e.targetId === "t2"), false, "t2 is gone after the fade tail");
  // Just before the fade-tail boundary, t2 is still present.
  const atTight709 = projectAftermathEntries(tightEvents, snapshot(tightJs), 709);
  assert.equal(atTight709.length, 8, "still 8 just before the exact fade-tail boundary");
  assert.equal(atTight709.some((e) => e.targetId === "t2" && e.evictedAtMs === 360), true, "t2 still stamped at the boundary-minus-one");
}

// ---------- Deterministic seed ----------
{
  const a = aftermathSeedForTargetId("target-A");
  const b = aftermathSeedForTargetId("target-A");
  const c = aftermathSeedForTargetId("target-B");
  assert.equal(a, b, "seed is deterministic for the same targetId");
  assert.notEqual(a, c, "seed differs for different targetIds");
  assert.ok(Number.isInteger(a) && a >= 0, "seed is a non-negative integer");
}

// ---------- Privacy: only the spawn WU triple crosses ----------
{
  const events = [flowNote("priv", 1000)];
  const js = [hitJudgement("priv", 1000)];
  const list = projectAftermathEntries(events, snapshot(js), 1100);
  assert.equal(list.length, 1);
  const keys = Reflect.ownKeys(list[0]).filter((k) => typeof k === "string");
  assert.deepEqual([...keys].sort(), ["family", "hand", "hitCommitMs", "mode", "seed", "spawn", "targetId"].sort(), "entry exposes only the renderer-contract fields");
  const spawnKeys = Reflect.ownKeys(list[0].spawn).filter((k) => typeof k === "string");
  assert.deepEqual([...spawnKeys].sort(), ["x", "y", "z"].sort(), "spawn exposes only the WU triple");
}

// ---------- dntq: both obstacle-contact modes emit ----------
{
  const gameplay = Object.freeze({
    judgements: [],
    obstacleOutcomes: [
      // Flow head-collision contact
      Object.freeze({ schema: "aerobeat/obstacle_outcome", version: 1, eventId: "ow1", result: "contact", firstContactTimelinePositionMs: 1000, committedTimelinePositionMs: 1050 }),
      // Boxing obstacle contact outcome (same shape, different rulesetId)
      Object.freeze({ schema: "aerobeat/obstacle_outcome", version: 1, eventId: "ow2", rulesetId: "boxing_collider_v1", result: "contact", firstContactTimelinePositionMs: 1200, committedTimelinePositionMs: 1250 })
    ],
    hazardOutcomes: []
  });
  const events = projectHazardContactEvents(gameplay, 1500);
  assert.equal(events.length, 2, "both Flow and Boxing obstacle head-collision contacts emit");
  assert.deepEqual(events.map((e) => [e.eventId, e.atMs]).sort(), [["ow1", 1000], ["ow2", 1200]].sort());
  // Avoided obstacle (result==="avoided") produces nothing.
  const avoided = Object.freeze({ judgements: [], obstacleOutcomes: [Object.freeze({ eventId: "av1", result: "avoided", firstContactTimelinePositionMs: null, committedTimelinePositionMs: 9999 })], hazardOutcomes: [] });
  assert.deepEqual(projectHazardContactEvents(avoided, 1500), [], "avoided obstacle produces no event");
  // Miss produces nothing.
  const missed = Object.freeze({ judgements: [missJudgement("m1", 1000)], obstacleOutcomes: [], hazardOutcomes: [] });
  assert.deepEqual(projectHazardContactEvents(missed, 1500), [], "miss produces no event");
}

// ---------- dntq: Flow bomb touch emits ----------
{
  const gameplay = Object.freeze({
    judgements: [],
    obstacleOutcomes: [],
    hazardOutcomes: [
      Object.freeze({ schema: "aerobeat/flow_hazard_outcome", version: 1, eventId: "bomb-1", kind: "bomb", result: "contact", committedTimelinePositionMs: 1500, consequenceApplied: true }),
      // Bomb avoid / miss must NOT emit
      Object.freeze({ schema: "aerobeat/flow_hazard_outcome", version: 1, eventId: "bomb-2", kind: "bomb", result: "avoided", committedTimelinePositionMs: 2000, consequenceApplied: false })
    ]
  });
  const events = projectHazardContactEvents(gameplay, 2200);
  assert.equal(events.length, 1, "only bomb contact emits, not bomb avoid/miss");
  assert.deepEqual(events[0], { eventId: "bomb-1", atMs: 1500 });
}

// ---------- dntq: bounds + aging ----------
{
  // Retention window is 150 + 600 + 200 = 950 ms past atMs.
  const agedSnapshot = Object.freeze({ judgements: [], obstacleOutcomes: [Object.freeze({ eventId: "aged", result: "contact", firstContactTimelinePositionMs: 1000, committedTimelinePositionMs: 1050 })], hazardOutcomes: [] });
  assert.equal(projectHazardContactEvents(agedSnapshot, 1949).length, 1, "event still retained just inside the retention window");
  assert.equal(projectHazardContactEvents(agedSnapshot, 1951).length, 0, "event dropped after ramp+decay+margin fully elapsed");
  // Bounds: more than 32 recent events → capped at 32 (newest kept).
  const many = Array.from({ length: 40 }, (_, i) => Object.freeze({ eventId: `h${i}`, result: "contact", firstContactTimelinePositionMs: 1000 + i, committedTimelinePositionMs: 1000 + i }));
  const manySnap = Object.freeze({ judgements: [], obstacleOutcomes: many, hazardOutcomes: [] });
  const manyEvents = projectHazardContactEvents(manySnap, 1100);
  assert.equal(manyEvents.length, 32, "cap is exactly 32 events");
  assert.deepEqual(manyEvents.map((e) => e.atMs).sort((a, b) => b - a), Array.from({ length: 32 }, (_, i) => 1039 - i), "the 32 newest events are retained");
}

console.log("p5pr aftermath FIFO + dntq hazard-contact + deterministic-seed + privacy oracles passed.");
