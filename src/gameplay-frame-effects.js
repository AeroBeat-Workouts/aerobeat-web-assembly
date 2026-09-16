// @ts-check
//
// 0.0.52 W2 — assembly-owned hit-success aftermath FIFO (p5pr) and bounded
// hazard-contact events (dntq). The renderer validates these exact shapes in
// `gameplay-scene-model.js` (`isValidAftermathList`, `isValidHazardContactList`).
// This module owns the bounded per-frame derivation: a pure function of
// (events, gameplay snapshot, nowMs, projection targets) with no retained
// cross-frame state, so the display loop can derive both fields from the
// projection alone.
//
// Renderer tuning constants (see `defaultRendererTuning`):
//   AFTERMATH_MAX_ENTRIES = 8, AFTERMATH_EVICTED_FADE_MS = 150,
//   AFTERMATH_MAX_HAZARD_EVENTS = 32, HAZARD_GLOW_RAMP_MS = 150,
//   HAZARD_GLOW_DECAY_MS = 600.

import { canonicalWorldUnitsPerMs } from "./gameplay-visual-runtime.js";

/** p5pr: live aftermath entries retained per frame (the 7-beat FIFO cap). */
const AFTERMATH_LIVE_CAP = 7;
/** p5pr: an evicted entry drops out once the fade tail plus margin fully elapsed. */
const AFTERMATH_EVICTED_FADE_TAIL_MS = 150 + 200;
/** dntq: hazard-contact event cap (renderer AFTERMATH_MAX_HAZARD_EVENTS). */
const HAZARD_CONTACT_MAX_EVENTS = 32;
/** dntq: drop an event once ramp + decay + margin have fully elapsed. */
const HAZARD_CONTACT_RETENTION_MS = 150 + 600 + 200;
/** 0.0.55 W2: bound the Test-mode committed-hit scan to the most recent N by
 *  centerTimestampMs. 64 comfortably exceeds the live-7 cap so every currently
 *  live committed hit is always included (long songs never rescan unboundedly). */
const TEST_COMMITTED_HIT_SCAN_BOUND = 64;

/**
 * p5pr box-family authored beat types → punch family/hand/mode mapping.
 * Flow note → flow/slice; guard/crossed_guard → guard/bonk (both hands);
 * straight/hook/uppercut × left/right → punch/(mode)/(hand).
 */
const PUNCH_FAMILIES = Object.freeze({
  straight_left: Object.freeze({ hand: "left", mode: "straight" }),
  straight_right: Object.freeze({ hand: "right", mode: "straight" }),
  hook_left: Object.freeze({ hand: "left", mode: "hook" }),
  hook_right: Object.freeze({ hand: "right", mode: "hook" }),
  uppercut_left: Object.freeze({ hand: "left", mode: "uppercut" }),
  uppercut_right: Object.freeze({ hand: "right", mode: "uppercut" })
});
const GUARD_TYPES = Object.freeze(["guard", "crossed_guard"]);
const BOX_OBSTACLE_FAMILY_TYPES = Object.freeze(["squat", "weave_left", "weave_right"]);
const FLOW_OMITTED_TYPES = Object.freeze(new Set(["arc", "burst"]));

/**
 * Deterministic non-negative integer seed for one target id (FNV-1a over code
 * points). The renderer only needs determinism for its seeded tumble phase.
 *
 * @param {string} targetId
 */
export function aftermathSeedForTargetId(targetId) {
  let h = 0x811c9dc5;
  for (let i = 0; i < targetId.length; i += 1) {
    h ^= targetId.codePointAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Resolve the aftermath spawn position (world WU triple) for one target id at
 * the commit frame. Uses the projection's current world positions when available;
 * otherwise falls back to the cell-derived grid position (canonical 4×3 top-left
 * columns [-1.5,-0.5,0.5,1.5], rows top→bottom [2,1,0] in world Y).
 *
 * @param {readonly Record<string, unknown>[]|null} targets Current projection (may carry committed positions).
 * @param {Record<string, unknown>|null} target The resolved target record.
 */
function spawnForTarget(targets, eventId) {
  if (targets && Array.isArray(targets)) {
    const target = targets.find((t) => isRecord(t) && t.id === eventId);
    if (target) {
      // Prefer the target's first projected position cell if it exposes one.
      const cells = Array.isArray(target.cells) ? target.cells : [];
      const cell = Number.isInteger(target.cell) ? Number(target.cell) : cells[0];
      if (Number.isInteger(cell) && cell >= 0 && cell < 12) {
        return gridCellToWorldZ0(cell);
      }
      // Lane-anchored boxing punch/guard fallback: center row Y 1.
      return { x: 0, y: 1, z: 0 };
    }
  }
  return { x: 0, y: 1, z: 0 };
}

/** Convert a canonical 4×3 grid cell to its world position at Z=0. */
function gridCellToWorldZ0(cell) {
  const column = cell % 4;
  const row = Math.floor(cell / 4);
  const xs = [-1.5, -0.5, 0.5, 1.5];
  const ys = [2, 1, 0];
  return { x: xs[column], y: ys[row], z: 0 };
}

/**
 * Derive the bounded p5pr aftermath list for one frame.
 *
 * Hit-success outcomes (Flow notes, Boxing straight/hook/uppercut Counts, guard
 * Counts in either guard mode) become one entry each at their committed timeline
 * position; misses, obstacles, and bombs never appear. Two candidate sources
 * feed the same FIFO, selected by `gameplay.session.purpose`:
 *   - `"play"` — real hit judgements from `gameplay.judgements` (persistent,
 *     cleared only on a full session reset).
 *   - `"visual_test"` — 0.0.55 W2 — the deterministic committed synthetic
 *     hits derived from the render event index. In Test Mode a target with an
 *     even `feedbackIndex` is a hit committing exactly at its
 *     `centerTimestampMs`; that is a PURE function of (renderEventIndex,
 *     nowMs) that persists across frames. The old 0.0.54 W2-B path read the
 *     projected `targets`, which cull a hit at the 350 ms feedback window, so
 *     the stateless FIFO lost each Test hit 350 ms after commit.
 * Live entries are capped at the 7 most recent by `hitCommitMs`; the
 * 8th-newest live commit stamps the oldest live entry with `evictedAtMs`;
 * evicted entries drop out after the fade tail (150 ms + 200 ms margin). The
 * live-7 cap is the ONLY cleanup: settled pieces persist until evicted by the
 * 8th hit (no time-based retention drop).
 *
 * @param {readonly Record<string, unknown>[]} events Resolved content events.
 * @param {Record<string, unknown>} gameplay Snapshot carrying `judgements` + `session`.
 * @param {number} nowMs Absolute song time (timeline ms).
 * @param {readonly Record<string, unknown>[]|null} [targets] Current projection.
 * @param {unknown} [renderEventIndex] The deterministic session target index (0.0.55 W2 Test-mode source).
 */
export function projectAftermathEntries(events, gameplay, nowMs, targets, renderEventIndex) {
  const judgementsValue = recordValue(gameplay, "judgements");
  if (!Array.isArray(judgementsValue)) return [];
  /** @type {{eventId:string}} */
  const eventsById = new Map();
  for (const event of events) {
    if (isRecord(event)) eventsById.set(String(event.eventId ?? ""), event);
  }
  /** @type {{targetId:string,hitCommitMs:number,family:"flow"|"punch"|"guard",hand:"left"|"right"|"both"|"neutral",mode:"straight"|"hook"|"uppercut"|"slice"|"bonk",spawn:{x:number,y:number,z:number},seed:number,evictedAtMs?:number}[]} */
  const output = [];
  /** @type {{commitMs:number,targetId:string,entry:{family:string,hand:string,mode:string,spawn:{x:number,y:number,z:number},seed:number}}[]} */
  const candidates = [];
  /** 0.0.54 W2-B: real hit judgements win; a target already covered by one produces no synthetic candidate. */
  const realHitIds = new Set();
  for (const judgement of judgementsValue) {
    if (!isRecord(judgement) || judgement.shadow === true) continue;
    if (judgement.result !== "hit") continue;
    const eventId = String(judgement.eventId ?? "");
    if (eventId.length < 1 || eventId.length > 128) continue;
    const commitMs = Number(judgement.committedTimelinePositionMs);
    if (!Number.isFinite(commitMs) || commitMs < 0) continue;
    // 0.0.54 W2-B: the live-7 cap is the ONLY aftermath cleanup; settled pieces
    // persist until evicted by the 8th hit (retention no longer drops old hits).
    const event = eventsById.get(eventId);
    if (!event) continue;
    const mapping = aftermathMappingForEvent(event);
    if (!mapping) continue;
    realHitIds.add(eventId);
    candidates.push({
      commitMs,
      targetId: eventId,
      entry: {
        family: mapping.family,
        hand: mapping.hand,
        mode: mapping.mode,
        spawn: spawnForTarget(targets, eventId),
        seed: aftermathSeedForTargetId(eventId)
      }
    });
  }
  // 0.0.55 W2: Test-mode committed synthetic hits — a deterministic,
  // session-scoped derivation from the render event index (NOT the ephemeral
  // projection). In Test the synthetic GREAT outcomes are the ONLY hits (no
  // real judgements exist); a target with an even `feedbackIndex` is a hit
  // committing exactly at its `centerTimestampMs`. Deriving from the full index
  // (bounded to the most recent TEST_COMMITTED_HIT_SCAN_BOUND entries) means a
  // committed hit persists across frames instead of being lost when its target
  // culls from the 350 ms feedback window. The Play path above is unchanged.
  if (recordValue(recordValue(gameplay, "session"), "purpose") === "visual_test") {
    const orderedEntries = isRecord(renderEventIndex) && Array.isArray(renderEventIndex.orderedEntries) ? renderEventIndex.orderedEntries : null;
    if (orderedEntries !== null) {
      const committed = orderedEntries.filter((entry) => isRecord(entry) && Number.isInteger(entry.feedbackIndex) && entry.feedbackIndex % 2 === 0)
        .map((entry) => ({ entry, commitMs: Number(entry.centerTimestampMs) }))
        .filter((item) => Number.isFinite(item.commitMs) && item.commitMs >= 0 && nowMs >= item.commitMs)
        .sort((a, b) => b.commitMs - a.commitMs);
      const scan = committed.length > TEST_COMMITTED_HIT_SCAN_BOUND ? committed.slice(0, TEST_COMMITTED_HIT_SCAN_BOUND) : committed;
      for (const item of scan) {
        const { entry, commitMs } = item;
        // The index entry carries the resolved content event (eventId, type,
        // authoredBeat) plus the deterministic feedbackIndex/centerTimestampMs.
        const targetId = String(recordValue(entry, "eventId") ?? recordValue(recordValue(entry, "event"), "eventId") ?? "");
        if (targetId.length < 1 || targetId.length > 128 || realHitIds.has(targetId)) continue;
        const event = recordValue(entry, "event");
        if (!isRecord(event)) continue;
        // Map through the resolved content event (definitive type + authoredBeat):
        // note → flow/slice, punch family → punch/mode/hand, guard/crossed_guard
        // → guard/bonk; anything else (bombs, obstacles) → null so it never
        // appears. This matches the Play real-judgement mapping exactly.
        const mapping = aftermathMappingForEvent(event);
        if (!mapping) continue;
        candidates.push({
          commitMs,
          targetId,
          entry: {
            family: mapping.family,
            hand: mapping.hand,
            mode: mapping.mode,
            spawn: spawnForTarget(targets, targetId),
            seed: aftermathSeedForTargetId(targetId)
          }
        });
      }
    }
  }
  if (candidates.length === 0) return [];
  // Sort newest-first by (commit, then targetId) for a deterministic cap.
  candidates.sort((a, b) => b.commitMs - a.commitMs || a.targetId.localeCompare(b.targetId));
  const kept = candidates.slice(0, AFTERMATH_LIVE_CAP + 1); // one extra → evict candidate
  const evictedCommitMs = kept.length > AFTERMATH_LIVE_CAP ? kept[AFTERMATH_LIVE_CAP].commitMs : null;
  for (const item of kept) {
    if (evictedCommitMs !== null && item.commitMs === evictedCommitMs) {
      if (nowMs - item.commitMs > AFTERMATH_EVICTED_FADE_TAIL_MS) continue;
    }
    const entry = Object.freeze({
      targetId: item.targetId,
      hitCommitMs: item.commitMs,
      family: item.entry.family,
      hand: item.entry.hand,
      mode: item.entry.mode,
      spawn: Object.freeze(item.entry.spawn),
      seed: item.entry.seed,
      ...(evictedCommitMs !== null && item.commitMs === evictedCommitMs ? { evictedAtMs: item.commitMs } : {})
    });
    output.push(entry);
  }
  return output;
}

/** dntq: derive the bounded hazard-contact event list for one frame. */
export function projectHazardContactEvents(gameplay, nowMs) {
  const obstacleOutcomesValue = recordValue(gameplay, "obstacleOutcomes");
  const obstacleOutcomes = Array.isArray(obstacleOutcomesValue) ? obstacleOutcomesValue : [];
  const hazardOutcomesValue = recordValue(gameplay, "hazardOutcomes");
  const hazardOutcomes = Array.isArray(hazardOutcomesValue) ? hazardOutcomesValue : [];
  /** @type {{eventId:string,atMs:number}[]} */
  const events = [];
  const seenEventIds = new Set();
  for (const outcome of obstacleOutcomes) {
    if (!isRecord(outcome)) continue;
    // Flow obstacle head-collision contact outcome (result==="contact").
    if (outcome.result !== "contact") continue;
    const firstContactTimelinePositionMs = Number(outcome.firstContactTimelinePositionMs);
    if (!Number.isFinite(firstContactTimelinePositionMs) || firstContactTimelinePositionMs < 0) continue;
    const eventId = String(outcome.eventId ?? "");
    if (eventId.length < 1 || eventId.length > 128 || seenEventIds.has(eventId)) continue;
    if (nowMs - firstContactTimelinePositionMs > HAZARD_CONTACT_RETENTION_MS) continue;
    seenEventIds.add(eventId);
    events.push({ eventId, atMs: firstContactTimelinePositionMs });
  }
  for (const outcome of hazardOutcomes) {
    if (!isRecord(outcome)) continue;
    // Flow hazard contact: kind "bomb" (bomb touch) or kind "wall"
    // (flow_colliders_v1 nose–obstacle wall contact), result==="contact".
    if ((outcome.kind !== "bomb" && outcome.kind !== "wall") || outcome.result !== "contact") continue;
    const committedTimelinePositionMs = Number(outcome.committedTimelinePositionMs);
    if (!Number.isFinite(committedTimelinePositionMs) || committedTimelinePositionMs < 0) continue;
    const eventId = String(outcome.eventId ?? "");
    if (eventId.length < 1 || eventId.length > 128 || seenEventIds.has(eventId)) continue;
    if (nowMs - committedTimelinePositionMs > HAZARD_CONTACT_RETENTION_MS) continue;
    seenEventIds.add(eventId);
    events.push({ eventId, atMs: committedTimelinePositionMs });
  }
  if (events.length === 0) return [];
  // Newest-first sort for a deterministic cap; avoided/miss outcomes produce nothing.
  events.sort((a, b) => b.atMs - a.atMs || a.eventId.localeCompare(b.eventId));
  return events.slice(0, HAZARD_CONTACT_MAX_EVENTS).map(Object.freeze);
}

/**
 * Map one resolved content event to its aftermath family/hand/mode. Returns
 * `null` for events that do not produce an aftermath entry (non-note non-punch
 * non-guard types, omitted arc/burst, obstacles, bombs).
 *
 * @param {Record<string, unknown>} event
 */
function aftermathMappingForEvent(event) {
  // 0.0.55 W2 follow-up: real resolved content events (content-runtime
  // timelineFor()) carry NO top-level `type` — only `authoredBeat.type`.
  // Synthetic events in unit tests DO carry a top-level `type`. Prefer the
  // top-level field when present, otherwise fall back to authoredBeat.type.
  const type = (typeof event.type === "string" ? event.type : null) ?? (typeof event.authoredBeat?.type === "string" ? event.authoredBeat.type : null);
  if (type === "note") return { family: "flow", hand: "neutral", mode: "slice" };
  if (PUNCH_FAMILIES[type]) {
    const m = PUNCH_FAMILIES[type];
    return { family: "punch", hand: m.hand, mode: m.mode };
  }
  if (GUARD_TYPES.includes(type)) return { family: "guard", hand: "both", mode: "bonk" };
  return null;
}

/** @param {unknown} value */
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** @param {unknown} value @param {string} key */
function recordValue(value, key) { return isRecord(value) ? value[key] : undefined; }
