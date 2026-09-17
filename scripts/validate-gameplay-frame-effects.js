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
  // 0.0.56 W2: the flow note is directional (direction "right") → shape "arrow".
  assert.deepEqual(freshFlow[0], { targetId: "nf", hitCommitMs: 3000, family: "flow", hand: "neutral", mode: "slice", shape: "arrow", spawn: { x: -1.5, y: 1, z: 0 }, seed: aftermathSeedForTargetId("nf") }, "Flow note maps to flow/slice with cell-derived spawn + arrow shape");
  // A directionless flow note (no authoredBeat.direction) → shape "orb".
  const orbFlow = Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "no", type: "note", centerTimestampMs: 3100, authoredBeat: { type: "note", hand: "left", placement: 4 } });
  const freshOrb = projectAftermathEntries([orbFlow], snapshot([hitJudgement("no", 3100)]), 3300, [nfTarget]);
  assert.equal(freshOrb.length, 1);
  assert.equal(freshOrb[0].shape, "orb", "a directionless flow note maps to shape orb");
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
  // 0.0.56 W2: the entry now carries the note's actual glyph `shape` (arrow/orb)
  // so the renderer can render the cut-in-half corpse of the real asset.
  // 0.0.58 B11b: + optional `appearanceColor` (the note's real fill) when the
  // event carries a validated private appearance; absent otherwise.
  const expectedPrivacyKeys = list[0].appearanceColor === undefined
    ? ["family", "hand", "hitCommitMs", "mode", "seed", "shape", "spawn", "targetId"]
    : ["appearanceColor", "family", "hand", "hitCommitMs", "mode", "seed", "shape", "spawn", "targetId"];
  assert.deepEqual([...keys].sort(), expectedPrivacyKeys.sort(), "entry exposes only the renderer-contract fields");
  // A validated note appearance crosses as the canonical uppercase fill token only.
  const appearanceFlow = Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "ap", type: "note", centerTimestampMs: 9000, appearanceColor: "#FF8000", authoredBeat: { type: "note", hand: "left", placement: 6, direction: "left" } });
  const appearanceList = projectAftermathEntries([appearanceFlow], snapshot([hitJudgement("ap", 9000)]), 9100);
  assert.equal(appearanceList.length, 1);
  assert.equal(appearanceList[0].appearanceColor, "#FF8000", "validated note appearance crosses as the real fill token");
  const badAppearanceFlow = Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "ab", type: "note", centerTimestampMs: 9200, appearanceColor: "#ff8000", authoredBeat: { type: "note", hand: "left", placement: 6, direction: "left" } });
  const badAppearanceList = projectAftermathEntries([badAppearanceFlow], snapshot([hitJudgement("ab", 9200)]), 9300);
  assert.equal(badAppearanceList.length, 1);
  assert.equal(badAppearanceList[0].appearanceColor, undefined, "a non-canonical appearance is never forwarded to the renderer");
  assert.equal(list[0].shape, "arrow", "a directional flow note exposes shape arrow");
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

// ---------- 0.0.55 W2 follow-up: real resolved events carry NO top-level `type` ----------
{
  // Real resolved content events (content-runtime timelineFor()) have schema,
  // version, eventId, variantId, chartId, centerTimestampMs, authoredBeat — but NO
  // top-level `type`. The mapping must fall back to `authoredBeat.type`. The
  // synthetic fixtures above carry BOTH (top-level `type` present), which masks
  // this; these fixtures mirror the real shape exactly.
  const realFlow = Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "rr1", variantId: "v1", chartId: "c1", centerTimestampMs: 4000, authoredBeat: { type: "note", hand: "left", placement: 4, direction: "right" } });
  const realPunch = Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "rr2", variantId: "v1", chartId: "c1", centerTimestampMs: 4200, authoredBeat: { type: "straight_right", spatialTarget: { targetCell: 4, entryDirection: "up" } } });
  const realGuard = Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "rr3", variantId: "v1", chartId: "c1", centerTimestampMs: 4400, authoredBeat: { type: "crossed_guard", guardTarget: { leftCell: 1, rightCell: 2, crossed: true } } });
  const realBomb = Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "rr4", variantId: "v1", chartId: "c1", centerTimestampMs: 4600, authoredBeat: { type: "bomb", placement: 5 } });
  const events = [realFlow, realPunch, realGuard, realBomb];
  const js = [hitJudgement("rr1", 4000), hitJudgement("rr2", 4200), hitJudgement("rr3", 4400)];
  const list = projectAftermathEntries(events, snapshot(js), 4500);
  assert.equal(list.length, 3, "real-shaped events (no top-level type): each real HIT maps via authoredBeat.type");
  const byId = new Map(list.map((e) => [e.targetId, e]));
  assert.deepEqual([byId.get("rr1").family, byId.get("rr1").hand, byId.get("rr1").mode], ["flow", "neutral", "slice"], "real flow note → flow/neutral/slice via authoredBeat.type");
  assert.deepEqual([byId.get("rr2").family, byId.get("rr2").hand, byId.get("rr2").mode], ["punch", "right", "straight"], "real punch → punch/right/straight via authoredBeat.type");
  assert.deepEqual([byId.get("rr3").family, byId.get("rr3").hand, byId.get("rr3").mode], ["guard", "both", "bonk"], "real crossed_guard → guard/both/bonk via authoredBeat.type");
  assert.equal(byId.has("rr4"), false, "real bomb still produces no aftermath entry via authoredBeat.type");
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
  // 0.0.58 B11a: the flow note's authored placement (cell 4 → column 0, row 1)
  // drives the spawn even with targets=null — the cull-resistant authored source
  // wins over the old lane-anchored center fallback.
  assert.deepEqual(projectAftermathEntries(bombEvents, testSnapshot(), 6200, null, bombIndex), [{ targetId: "t-b", hitCommitMs: 6000, family: "flow", hand: "neutral", mode: "slice", shape: "arrow", spawn: { x: -1.5, y: 1, z: 0 }, seed: aftermathSeedForTargetId("t-b") }], "only the even-index flow note commits; the bomb never appears");
  // Cell-less authored beat (no placement, no spatialTarget.targetCell) → the
  // lane-anchored center-row fallback remains the last-resort spawn.
  const celllessNote = Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "t-nc", type: "note", centerTimestampMs: 6500, authoredBeat: { type: "note", hand: "left", direction: "up" } });
  const celllessIndex = createSessionTargetIndex([celllessNote], {});
  assert.deepEqual(projectAftermathEntries([celllessNote], testSnapshot(), 6700, null, celllessIndex), [{ targetId: "t-nc", hitCommitMs: 6500, family: "flow", hand: "neutral", mode: "slice", shape: "arrow", spawn: { x: 0, y: 1, z: 0 }, seed: aftermathSeedForTargetId("t-nc") }], "a cell-less authored beat falls back to the lane-anchored center-row spawn");
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

// ---------- 0.0.58 B11a: the aftermath spawn is STABLE across the whole fall ----------
{
  // The 0.0.57 bug: spawnForTarget re-derived the spawn from the ephemeral
  // projection every frame; once the committed target cullled from the 350 ms
  // feedback window, the spawn degraded to {x:0,y:1,z:0} (track center) and
  // the halves teleported to the middle of the track mid-fall. The spawn must
  // now be a pure function of the cull-resistant authored beat: identical
  // before AND after the target leaves the projection, and a stale center-cell
  // target for the same id must not corrupt it.
  const note = flowNote("b11", 5000); // placement 4 → column 0, row 1 → {x:-1.5,y:1,z:0}
  const index = createSessionTargetIndex([note], {});
  const staleCenterTarget = Object.freeze({ id: "b11", kind: "flow", hand: "left", family: "flow", cell: 5, cells: [], lane: null, beatCenterMs: 5000 });
  const duringWindow = projectAftermathEntries([note], testSnapshot(), 5100, [staleCenterTarget], index);
  const pastWindow = projectAftermathEntries([note], testSnapshot(), 5400, null, index);
  const midFall = projectAftermathEntries([note], testSnapshot(), 5900, null, index);
  assert.equal(duringWindow.length, 1, "Test committed hit present inside the feedback window");
  assert.equal(pastWindow.length, 1, "Test committed hit persists past the feedback window");
  assert.equal(midFall.length, 1, "Test committed hit still present mid-fall");
  for (const list of [duringWindow, pastWindow, midFall]) {
    assert.deepEqual(list[0].spawn, { x: -1.5, y: 1, z: 0 }, "spawn holds the note's authored column through the whole fall (no center degradation)");
  }
  assert.deepEqual(duringWindow[0].spawn, pastWindow[0].spawn, "spawn is identical before/after the 350 ms cull boundary");
  assert.deepEqual(duringWindow[0].spawn, midFall[0].spawn, "spawn is identical into the mid-fall frames");
  // Play path: same stability through a real hit judgement.
  const playDuring = projectAftermathEntries([note], playSnapshot([hitJudgement("b11", 5050)]), 5150, [staleCenterTarget], null);
  const playPast = projectAftermathEntries([note], playSnapshot([hitJudgement("b11", 5050)]), 5450, null, null);
  assert.deepEqual(playDuring[0].spawn, { x: -1.5, y: 1, z: 0 }, "Play real hit: spawn derived from the authored beat (targets ignored)");
  assert.deepEqual(playDuring[0].spawn, playPast[0].spawn, "Play real hit: spawn stable across the cull boundary");
  // Guard (cell-less) keeps the lane-anchored center-row fallback on both paths.
  const guardEvents = [guard("b11g", false, 7000)];
  const guardIndex = createSessionTargetIndex(guardEvents, {});
  const guardList = projectAftermathEntries(guardEvents, testSnapshot(), 7400, null, guardIndex);
  assert.deepEqual(guardList[0].spawn, { x: 0, y: 1, z: 0 }, "guard (cell-less) falls back to the lane-anchored center-row spawn");
}

// ---------- 0.0.59 B15: boxing punch spawns at the NOTE'S RENDERED position ----------
{
  // The 0.0.58 playtest jump: the old spawn re-derived `gridCellToWorldZ0`
  // (flow-grid columnX + legacy full-grid rowY), so a straight_left on cell 4
  // spawned at (-0.5, 1) while the live note rendered at (placement%4,
  // reach-row Y) = (0, 1) — and cell 0 (top row) at (-0.5, 2) vs (0, 1.25).
  // The spawn must now equal the renderer's exact hit-plane anchor:
  //   X = placement % 4  (the shared targetCenterForPlacement truth the
  //       renderer uses for the punch icon + the gameplay judge plane)
  //   Y = boxingColliderRowY(row, reach).worldY  (the same shared contract
  //       the renderer's presentationRowY + judge plane call).
  const reachDefault = Object.freeze({ topRowReachWU: 0.25, bottomRowReachWU: 0.25 });
  const punchAt = (id, type, targetCell) => Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId: id, type, centerTimestampMs: 8000, authoredBeat: { type, spatialTarget: { targetCell, entryDirection: "up" } } });
  const js = (ids) => ids.map((id) => hitJudgement(id, 8000));
  // Center row (cell 4): (0, 1) at any reach; top row (cell 0): (0, 1+reach);
  // bottom row (cell 8): (0, 1-reach); right hand (cell 6): (2, 1).
  const events = [punchAt("sl-c", "straight_left", 4), punchAt("sl-t", "straight_left", 0), punchAt("sl-b", "straight_left", 8), punchAt("sr-m", "straight_right", 6)];
  const list = projectAftermathEntries([...events], playSnapshot(js(["sl-c", "sl-t", "sl-b", "sr-m"])), 8200, null, null, reachDefault);
  const byId = new Map(list.map((e) => [e.targetId, e]));
  assert.equal(list.length, 4, "all four punches produce entries (Play real-hit path)");
  assert.deepEqual(byId.get("sl-c").spawn, { x: 0, y: 1, z: 0 }, "center-row straight_left (cell 4) spawns at the note's rendered position (x = placement%4, reach-row y = 1)");
  assert.deepEqual(byId.get("sl-t").spawn, { x: 0, y: 1.25, z: 0 }, "top-row straight_left (cell 0) spawns at the REACH-ROW y (1 + topRowReachWU), not the legacy full-grid row y (2)");
  assert.deepEqual(byId.get("sl-b").spawn, { x: 0, y: 0.75, z: 0 }, "bottom-row straight_left (cell 8) spawns at the REACH-ROW y (1 − bottomRowReachWU), not the legacy full-grid row y (0)");
  assert.deepEqual(byId.get("sr-m").spawn, { x: 2, y: 1, z: 0 }, "straight_right (cell 6) spawns at x = placement%4 = 2 (not the flow-grid column 0.5)");
  // Non-default reach flows through: the spawn follows the configured rows.
  const wideReach = Object.freeze({ topRowReachWU: 1, bottomRowReachWU: 0.5 });
  const wide = new Map(projectAftermathEntries([...events], playSnapshot(js(["sl-c", "sl-t", "sl-b", "sr-m"])), 8200, null, null, wideReach).map((e) => [e.targetId, e]));
  assert.deepEqual(wide.get("sl-t").spawn, { x: 0, y: 2, z: 0 }, "top row follows topRowReachWU = 1 (y 2 — equals the legacy full-grid mapping exactly)");
  assert.deepEqual(wide.get("sl-b").spawn, { x: 0, y: 0.5, z: 0 }, "bottom row follows bottomRowReachWU = 0.5 (y 0.5)");
  // Absent reach takes the 0.25 Game Setup defaults (backward compatible).
  const defaulted = new Map(projectAftermathEntries([punchAt("sl-d", "straight_left", 0)], playSnapshot([hitJudgement("sl-d", 8000)]), 8200, null, null).map((e) => [e.targetId, e]));
  assert.deepEqual(defaulted.get("sl-d").spawn, { x: 0, y: 1.25, z: 0 }, "absent rowReach takes the 0.25 defaults (top row y 1.25)");
  // Test-mode path: the synthetic committed hit gets the SAME rendered-position spawn.
  // (The Test GREAT/miss alternation is by center-timestamp order, so the
   // LATER beat carries the even feedbackIndex and is the synthetic HIT.)
  const testPunches = [punchAt("t-miss", "straight_left", 0), punchAt("t-hit", "straight_left", 4)];
  // The index must be built over the SAME array instance passed to the
  // projection (validSessionTargetIndex checks candidate.events === events).
  const testIndex = createSessionTargetIndex(testPunches, {});
  const testList = projectAftermathEntries(testPunches, testSnapshot(), 8200, null, testIndex, reachDefault);
  const testById = new Map(testList.map((e) => [e.targetId, e]));
  assert.equal(testList.length, 1, "Test mode: even-feedbackIndex punch commits; odd is a miss");
  assert.deepEqual(testById.get("t-hit").spawn, { x: 0, y: 1, z: 0 }, "Test-mode punch spawn also matches the note rendered position");
  assert.equal(testById.has("t-miss"), false, "the odd-feedbackIndex (miss) punch never appears");
  // Flow notes are UNCHANGED: placement still maps through the legacy grid.
  const flowSpawn = projectAftermathEntries([flowNote("f15", 9000)], playSnapshot([hitJudgement("f15", 9000)]), 9200, null, null, reachDefault);
  assert.deepEqual(flowSpawn[0].spawn, { x: -1.5, y: 1, z: 0 }, "flow notes keep the legacy grid-cell spawn (reach never applied)");
  // Cull-resistant: identical before AND after the target leaves the projection.
  const stableA = projectAftermathEntries([punchAt("st1", "straight_left", 0)], playSnapshot([hitJudgement("st1", 8000)]), 8100, [{ id: "st1", kind: "punch", hand: "left", family: "straight", cell: 5, cells: [], lane: "left", beatCenterMs: 8000 }], null, reachDefault);
  const stableB = projectAftermathEntries([punchAt("st1", "straight_left", 0)], playSnapshot([hitJudgement("st1", 8000)]), 8600, null, null, reachDefault);
  assert.deepEqual(stableA[0].spawn, stableB[0].spawn, "punch spawn holds the authored cell's rendered position through the cull boundary (no mid-fall teleport)");
}

console.log("p5pr aftermath FIFO + dntq hazard-contact + deterministic-seed + privacy + 0.0.54 W2-B Test-mode/persistence + 0.0.58 B11a stable-spawn + 0.0.59 B15 punch-rendered-position oracles passed.");
