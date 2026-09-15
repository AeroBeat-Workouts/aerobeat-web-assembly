// @ts-check
// 0.0.52 W2 unit oracles: p5pr aftermath FIFO + dntq hazard-contact events +
// deterministic seed + privacy (only spawn WU triple / eventId+atMs cross).
import assert from "node:assert/strict";
import { projectAftermathEntries, projectHazardContactEvents, aftermathSeedForTargetId } from "../src/gameplay-frame-effects.js";
import { createSessionTargetIndex } from "../src/session-render-projection.js";

/** 0.0.55 W2: a Visual-Test gameplay snapshot (the deterministic committed-hit source is the render index, not the projection). */
const testSnapshot = () => Object.freeze({ judgements: Object.freeze([]), session: Object.freeze({ purpose: "visual_test" }) });
/** 0.0.55 W2: a Play gameplay snapshot (the real-judgement source). */
const playSnapshot = (judgements) => Object.freeze({ judgements: Object.freeze(judgements), session: Object.freeze({ purpose: "play" }) });

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
  // 0.0.54 W2-B: the retention drop is gone — the live-7 cap is the ONLY
  // cleanup, so all six hits are live candidates and the 8th-newest stamp path
  // is not reached (6 ≤ 7): every hit persists, n1 included.
  assert.equal(list.length, 6, "six live HITs produce exactly six entries; the live-7 cap is the only cleanup (no retention drop)");
  const byId = new Map(list.map((e) => [e.targetId, e]));
  assert.ok(byId.get("n1"), "a hit older than 950 ms still yields a live entry until the 8th hit evicts it");
  assert.equal(byId.get("n1").hitCommitMs, 1000, "the stale hit keeps its real committedTimelinePositionMs");
  assert.equal(byId.get("n1").evictedAtMs, undefined, "the stale hit is not evicted until the 8th-newest stamp fires");
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
  assert.equal(atNow2450.length, 7, "live-7 cap: exactly the 7 newest commits survive once the evicted fade tail has elapsed");
  assert.deepEqual(atNow2450.map((e) => e.targetId).sort(), ["f3", "f4", "f5", "f6", "f7", "f8", "f9"].sort(), "the 7 newest commits are the live entries, oldest capped");
  // 0.0.54 W2-B persistence: advance past the retention window (now 3350 >
  // f0's commit 1300 + 950) — f2's fade tail is long over, yet f0..f9 ALL
  // survive: only the live-7 cap + evicted fade tail clean up aftermath.
  const atNow3350 = projectAftermathEntries(events, snapshot(js), 3350);
  assert.equal(atNow3350.length, 7, "far past retention: the 7 newest commits persist (no time-based drop)");
  assert.ok(atNow3350.some((e) => e.targetId === "f3" && e.hitCommitMs === 1600), "f3 (commit 1600, 1750 ms old — far past the old 950 ms retention) persists: only the live-7 cap cleans up aftermath");
  assert.ok(atNow3350.every((e) => e.evictedAtMs === undefined), "no evicted entry at nowMs 3350 (f2's fade tail ended at 1850)");

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

// ---------- 0.0.53 W3-A: Flow wall (nose–obstacle) contact emits ----------
{
  // The flow_colliders_v1 gameplay coordinator emits nose–obstacle WALL contact
  // into hazardOutcomes as kind:"wall" with committedTimelinePositionMs; the
  // vignette gate must accept it in addition to kind:"bomb".
  const gameplay = Object.freeze({
    judgements: [],
    obstacleOutcomes: [],
    hazardOutcomes: [
      Object.freeze({ schema: "aerobeat/flow_hazard_outcome", version: 1, eventId: "wall-1", kind: "wall", result: "contact", committedTimelinePositionMs: 1700, consequenceApplied: true }),
      // Wall avoid / miss must NOT emit.
      Object.freeze({ schema: "aerobeat/flow_hazard_outcome", version: 1, eventId: "wall-2", kind: "wall", result: "avoided", committedTimelinePositionMs: 1800, consequenceApplied: false }),
      // A bomb and a wall in the same window must both emit.
      Object.freeze({ schema: "aerobeat/flow_hazard_outcome", version: 1, eventId: "bomb-1", kind: "bomb", result: "contact", committedTimelinePositionMs: 1600, consequenceApplied: true })
    ]
  });
  const events = projectHazardContactEvents(gameplay, 2200);
  assert.equal(events.length, 2, "wall contact emits alongside bomb contact; wall avoid/miss does not");
  assert.deepEqual(events.map((e) => [e.eventId, e.atMs]).sort(), [["bomb-1", 1600], ["wall-1", 1700]], "wall event is driven by committedTimelinePositionMs");
  // A wall contact alone (no bombs) triggers the vignette.
  const wallOnly = Object.freeze({ judgements: [], obstacleOutcomes: [], hazardOutcomes: [Object.freeze({ schema: "aerobeat/flow_hazard_outcome", version: 1, eventId: "wall-only", kind: "wall", result: "contact", committedTimelinePositionMs: 1700, consequenceApplied: true })] });
  assert.deepEqual(projectHazardContactEvents(wallOnly, 2200), [{ eventId: "wall-only", atMs: 1700 }], "a nose–obstacle wall contact alone produces a hazardContact event");
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

// ---------- 0.0.55 W2: Test-mode committed synthetic hits from the render index ----------
{
  // 0.0.55 W2: in Test the aftermath source is the deterministic render event
  // index, NOT the ephemeral projection. The index assigns `feedbackIndex`
  // 0..N-1 in canonical center-timestamp order (Test alternates GREAT/miss
  // starting with GREAT), so EVEN feedbackIndex = synthetic hit committing
  // exactly at centerTimestampMs; ODD = miss (never appears). A bomb (non-
  // renderable feedback type) has feedbackIndex -1 and never appears.
  const events = [
    flowNote("t-flow", 5000),
    punch("t-punch", "straight_left", "left", 5200),
    guard("t-guard", false, 5400),
    flowNote("t-miss", 5600)
  ];
  const index = createSessionTargetIndex(events, {});
  const list = projectAftermathEntries(events, testSnapshot(), 5500, null, index);
  const byId = new Map(list.map((e) => [e.targetId, e]));
  assert.equal(list.length, 2, "Test: even-feedbackIndex targets (t-flow@0, t-guard@2) commit; odd (t-punch@1, t-miss@3) never appear");
  assert.deepEqual([byId.get("t-flow").family, byId.get("t-flow").hand, byId.get("t-flow").mode], ["flow", "neutral", "slice"], "flow note → flow/neutral/slice");
  assert.equal(byId.get("t-flow").hitCommitMs, 5000, "synthetic hit commits exactly at centerTimestampMs");
  assert.deepEqual([byId.get("t-guard").family, byId.get("t-guard").hand, byId.get("t-guard").mode], ["guard", "both", "bonk"], "guard → guard/both/bonk");
  assert.equal(byId.get("t-guard").hitCommitMs, 5400, "synthetic guard commits at centerTimestampMs");
  assert.equal(byId.has("t-punch"), false, "odd feedbackIndex (punch@1) is a miss — never appears");
  assert.equal(byId.has("t-miss"), false, "odd feedbackIndex (note@3) is a miss — never appears");
  // A bomb (non-renderable feedback type, feedbackIndex -1) never appears, and
  // a single flow note (feedbackIndex 0) is a committed hit.
  const bombEvents = [flowNote("t-b", 6000), bomb("t-bomb", 6100)];
  const bombIndex = createSessionTargetIndex(bombEvents, {});
  // targets=null → spawnForTarget falls back to the lane-anchored grid default.
  assert.deepEqual(projectAftermathEntries(bombEvents, testSnapshot(), 6200, null, bombIndex), [{ targetId: "t-b", hitCommitMs: 6000, family: "flow", hand: "neutral", mode: "slice", spawn: { x: 0, y: 1, z: 0 }, seed: aftermathSeedForTargetId("t-b") }], "only the even-index flow note commits; the bomb never appears");
}

// ---------- 0.0.55 W2: Play real hits + real-judgement mapping (unchanged path) ----------
{
  // (b) Play mode: a real hit judgement produces an aftermath entry; mapping
  // flows through the event type; a miss judgement produces nothing.
  const events = [flowNote("r1", 7000), flowNote("r2", 7100)];
  const list = projectAftermathEntries(events, playSnapshot([hitJudgement("r1", 7050), missJudgement("r2", 7100)]), 7200, null, null);
  assert.equal(list.length, 1, "Play: one real hit → one entry; the miss judgement produces nothing");
  const byId = new Map(list.map((e) => [e.targetId, e]));
  assert.equal(byId.get("r1").hitCommitMs, 7050, "the real hit keeps the judgement's committedTimelinePositionMs");
  assert.equal(byId.get("r1").family, "flow", "the real-judgement path still maps through the event type");
  assert.equal(byId.get("r2"), undefined, "a Play miss judgement never produces an aftermath entry");
}

// ---------- 0.0.55 W2: Test committed hit PERSISTS past the 350 ms feedback window ----------
{
  // (a) THE KEY REGRESSION: a synthetic Test hit (even feedbackIndex) still
  // yields an aftermath entry at nowMs = commit + 400, PAST the 350 ms
  // feedback window where the old ephemeral-`targets` path would have culled
  // the target and lost the aftermath. Deriving from the render index is a pure
  // function of (index, nowMs), so it persists across frames.
  const events = [flowNote("k1", 5000)];
  const index = createSessionTargetIndex(events, {});
  const duringWindow = projectAftermathEntries(events, testSnapshot(), 5300, null, index); // commit + 300 (inside 350 ms)
  const pastWindow = projectAftermathEntries(events, testSnapshot(), 5400, null, index); // commit + 400 (past 350 ms)
  assert.equal(duringWindow.length, 1, "Test committed hit present at commit + 300");
  assert.equal(pastWindow.length, 1, "Test committed hit PERSISTS at commit + 400 (past the 350 ms feedback window where the old target path lost it)");
  assert.equal(pastWindow[0].targetId, "k1", "the persisting entry is the committed hit");
  assert.equal(pastWindow[0].hitCommitMs, 5000, "the persisting entry commits exactly at centerTimestampMs");
  // (c) An ODD-feedbackIndex target is a miss and produces NO aftermath entry.
  // Two notes: the first (feedbackIndex 0) is the hit, the second (feedbackIndex
  // 1) is the miss. At nowMs 5400 (past the 350 ms window) only the first's
  // aftermath persists; the odd-indexed miss never appears.
  const missEvents = [flowNote("k-h", 5000), flowNote("k-m", 5200)];
  const missIndex = createSessionTargetIndex(missEvents, {});
  const missList = projectAftermathEntries(missEvents, testSnapshot(), 5400, null, missIndex);
  assert.equal(missList.length, 1, "only the even-feedbackIndex (hit) note produces an aftermath entry");
  assert.equal(missList[0].targetId, "k-h", "the even-feedbackIndex note is the committed hit");
  assert.equal(missList.some((e) => e.targetId === "k-m"), false, "(c) the odd-feedbackIndex (miss) note produces NO aftermath entry");
}

// ---------- 0.0.55 W2: Test-mode committed hits persist through many frames ----------
{
  // 10 notes 500 ms apart (alternating hit/miss in Test). The even-feedbackIndex
  // ones (c0, c2, c4, c6, c8) are the committed hits. By nowMs 9400 every hit is
  // >350 ms past commit (every one would be culled from the ephemeral
  // projection), yet all five persist from the deterministic index; the 7-live
  // cap does not engage (5 ≤ 7).
  const N = 10;
  const events = Array.from({ length: N }, (_, i) => flowNote(`c${i}`, 4000 + i * 500));
  const index = createSessionTargetIndex(events, {});
  const atNow9400 = projectAftermathEntries(events, testSnapshot(), 9400, null, index);
  assert.equal(atNow9400.length, 5, "all five even-feedbackIndex committed hits persist far past the 350 ms window (no ephemeral culling)");
  assert.deepEqual(atNow9400.map((e) => e.targetId).sort(), ["c0", "c2", "c4", "c6", "c8"].sort(), "every even-feedbackIndex committed hit is retained (odd-indexed misses never appear)");
  // (d) 8 hits → the 7-live cap evicts the oldest. 16 notes 100 ms apart; the
  // even-feedbackIndex ones (d0..d14 step 2) are 8 committed hits. At nowMs 13900
  // the evicted d0 (commit 1300) is far past its fade tail → exactly 7 live.
  const N8 = 16;
  const events8 = Array.from({ length: N8 }, (_, i) => flowNote(`d${i}`, 1300 + i * 100));
  const index8 = createSessionTargetIndex(events8, {});
  const at8 = projectAftermathEntries(events8, testSnapshot(), 13900, null, index8);
  assert.equal(at8.length, 7, "8 committed Test hits → the 7-live cap evicts the oldest (past its fade tail)");
  assert.deepEqual(at8.map((e) => e.targetId).sort(), ["d2", "d4", "d6", "d8", "d10", "d12", "d14"].sort(), "the 7 newest even-feedbackIndex committed hits are the live entries (oldest d0 evicted)");
}

console.log("p5pr aftermath FIFO + dntq hazard-contact + deterministic-seed + privacy + 0.0.54 W2-B Test-mode/persistence oracles passed.");
