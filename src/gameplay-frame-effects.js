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
// 0.0.59 B15: the shared row-reach mapping — the SAME contract function the
// renderer uses for boxing_collider presentation rows (presentationRowY →
// boxingColliderRowY) and the gameplay judge plane (boxingColliderTargetCenter).
import { boxingColliderRowY } from "@aerobeat/web-contracts/gameplay-contracts";
// 0.0.63 D5: the saber geometry constants — the SAME `saberGeometry` (length +
// radius) the gameplay capsule detector and the renderer's visible beam are
// built from (`@aerobeat/web-contracts/equipment-contracts`). sliceT re-derives
// the blade crossing with these exact values so visual == hit == cut-position.
import { saberGeometry } from "@aerobeat/web-contracts/equipment-contracts";
// 0.0.63 D5: the shared PRE-push wrist-history direction oracle AND the sample
// freshness bound — both come from `@aerobeat/web-gameplay`'s flow-collider
// collision module, the EXACT source the session coordinator uses to orient the
// saber capsule and to validate a measured wrist sample. Importing them here
// keeps sliceT aligned with the live hit volume (visual == hit == cut-position).
import { saberDirectionFromWristHistory, maximumColliderSampleFreshnessMs } from "@aerobeat/web-gameplay";
// 0.0.60 F2: the renderer's 4×3 presentation grid — the SAME constant the renderer
// uses for the live note icon (worldPositionForCell → columnX). The corpse must
// spawn at the NOTE'S rendered position, which is the presentation grid, NOT the
// judge-plane column convention (placement % 4).
import { gameplayWorldGrid } from "@aerobeat/web-renderer";

/** p5pr: live aftermath entries retained per frame (the 7-beat FIFO cap). */
const AFTERMATH_LIVE_CAP = 7;
/**
 * 0.0.63 D5: sliceT clamping bounds — keep BOTH halves a sane size by never
 * letting the cut land inside the outer 15% of the glyph's long axis
 * (0 = tail, 1 = tip/head). A blade crossing measured outside this range is
 * clamped so a near-tip / near-tail cut still leaves two recognizable halves.
 */
const SLICE_T_MIN = 0.15;
const SLICE_T_MAX = 0.85;
/**
 * 0.0.63 D5: judge-space cell → authored-direction unit vector (in-plane,
 * up-positive). Mirrors the renderer's `directionUnitVector` AND the
 * gameplay-side `DIRECTIONS` map (`flow-collider-collision.js`) exactly so the
 * arrow's long axis aligns with the direction the note was hit in. Integer
 * directions use the canonical Beat Saber flow enum
 * [`up`,`down`,`left`,`right`,`up-left`,`up-right`,`down-left`,`down-right`]
 * (the SAME ordering `session-coordinator.flowDirectionName` resolves against);
 * string directions are looked up by name.
 */
const FLOW_DIRECTION_VECTORS = Object.freeze({
  up: Object.freeze([0, 1]),
  down: Object.freeze([0, -1]),
  left: Object.freeze([-1, 0]),
  right: Object.freeze([1, 0]),
  "up-left": Object.freeze([-Math.SQRT1_2, Math.SQRT1_2]),
  "up-right": Object.freeze([Math.SQRT1_2, Math.SQRT1_2]),
  "down-left": Object.freeze([-Math.SQRT1_2, -Math.SQRT1_2]),
  "down-right": Object.freeze([Math.SQRT1_2, -Math.SQRT1_2])
});
/** 0.0.63 D5: the integer enum order (Beat Saber flow convention) for integer directions. */
const FLOW_DIRECTION_ENUM = Object.freeze(["up", "down", "left", "right", "up-left", "up-right", "down-left", "down-right"]);
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
 * 0.0.58 B11a: resolve the aftermath spawn position (world WU triple) from a
 * CULL-RESISTANT source — the resolved content event's authored beat, NOT the
 * ephemeral projection `targets`. The old implementation re-derived the spawn
 * from `targets` every frame; when a committed target cullled out of the 350 ms
 * feedback window the lookup missed and the spawn degraded to the track center
 * `{x:0,y:1,z:0}`, teleporting the falling halves to the middle of the track
 * mid-fall. The authored cell is session-stable, so the spawn now holds the
 * note's column position for the entire fall+settle:
 *   - Flow note: `authoredBeat.placement` (canonical 0–11 grid cell).
 *   - Boxing punch: `authoredBeat.spatialTarget.targetCell` when present
 *     (real resolved punches carry it; synthetic fixtures may not).
 *   - Guard / no derivable cell: the lane-anchored center row default
 *     `{x:0,y:1,z:0}` — the last-resort fallback.
 *
 * 0.0.59 B15: a boxing punch spawns at the NOTE'S ACTUAL RENDERED POSITION,
 * not a re-derived flow-grid cell that can drift from where the live note sits.
 * The playtest jump had two components, both reproduced by the real-pixel
 * oracle (`validate-0.0.59-boxing-spawn-pixels.js`, note vs. corpse screen
 * centroids per frame):
 *   - X: the live note (and the gameplay judge plane via
 *     `targetCenterForPlacement`) render at world x = `placement % 4` ∈
 *     [0,1,2,3], while the old spawn used the FLOW grid columnX (−0.5 for the
 *     straight-left cell 4) — a ~48 px single-frame horizontal jump on the
 *     default camera. The spawn now uses the shared `targetCenterForPlacement`
 *     X directly (the same value the renderer derives for the punch icon), so
 *     X is identical by construction.
 *   - Y: the live note renders at the reach-row Y (`boxingColliderRowY(row)` —
 *     1 + topRowReachWU for row 0, 1 for row 1, 1 − bottomRowReachWU for row
 *     2 under the Game Setup reach fractions), while the old spawn used the
 *     legacy full-grid `rowY` (2/1/0) — up to a ~25 px vertical jump for the
 *     top/bottom rows. The spawn now resolves the SAME shared contract
 *     function the renderer's presentation uses, with the run's configured
 *     reach fractions (session-stable, defaults 0.25/0.25 when unset) —
 *     matching Y exactly at any reach setting.
 * Flow notes still use `gridCellToWorldZ0` (their presentation maps through
 * `columnX`/`rowY` without reach adjustment), so only the boxing path moved.
 *
 * @param {Record<string, unknown>} event Resolved content event (carries authoredBeat).
 * @param {Readonly<{topRowReachWU?:unknown,bottomRowReachWU?:unknown}>|null} [reach] Run-configured row-reach fractions (Game Setup v3); absent values take the 0.25 defaults.
 */
function spawnForEvent(event, reach) {
  const beat = isRecord(event.authoredBeat) ? event.authoredBeat : {};
  const placement = beat.placement;
  if (Number.isInteger(placement) && placement >= 0 && placement < 12) {
    return gridCellToWorldZ0(placement);
  }
  const spatialTarget = isRecord(beat.spatialTarget) ? beat.spatialTarget : {};
  const targetCell = spatialTarget.targetCell;
  if (Number.isInteger(targetCell) && targetCell >= 0 && targetCell < 12) {
    return punchCellToRenderedPositionZ0(targetCell, reach);
  }
  // Lane-anchored guard / cell-less fallback: center row Y 1, track center X.
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
 * 0.0.59 B15 / 0.0.60 F2: the rendered Z=0 world position of one boxing punch
 * target cell — the EXACT anchor the renderer places the live punch icon at
 * commit. The boxing_collider presentation renders the icon at
 * `worldPositionForCell` (X = `gameplayWorldGrid.columnX[cell % 4]` ∈
 * {−1.5, −0.5, 0.5, 1.5}) plus the reach-row Y via the shared
 * `boxingColliderRowY` contract, with z pinned to 0 at hit
 * (`iconRenderPosition`). Deriving from the authored target cell alone (plus
 * the session-stable reach settings) keeps the spawn cull-resistant while
 * guaranteeing it equals the note's rendered position: the knock/launch then
 * plays from the note, with no single-frame jump.
 *
 * 0.0.60 F2 correction: B15 used `cell % 4` for X on the false premise that
 * the renderer places the icon at the JUDGE-plane X (`targetCenterForPlacement`
 * = `placement % 4` ∈ 0..3, the athlete-grid/wrist space). The renderer never
 * renders there — the icon is at `columnX` (judge X − 1.5), so the B15 corpse
 * spawned a constant +1.5 WU right of the note on every cell (the 0.0.59
 * playtest symptom). X now uses the renderer's own grid constant.
 *
 * @param {number} cell Canonical 4×3 target cell (0–11).
 * @param {Readonly<{topRowReachWU?:unknown,bottomRowReachWU?:unknown}>|null} [reach] Run-configured row-reach fractions; absent/out-of-range values take the Game Setup 0.25 defaults.
 */
function punchCellToRenderedPositionZ0(cell, reach) {
  const row = /** @type {0|1|2} */(Math.floor(cell / 4));
  const normalized = normalizeSpawnRowReach(reach);
  // X from the RENDERER's presentation grid (the icon's real rendered X). The
  // judge-plane X (placement % 4) is a different coordinate system
  // (wrist/athlete-grid space, = presentation X + 1.5) and must NOT be used
  // for the visual spawn.
  const x = gameplayWorldGrid.columnX[cell % 4];
  // Reach-row Y from the SHARED contract (renderer presentationRowY + judge
  // plane both call this exact function): 1 + top, 1, 1 − bottom.
  const y = boxingColliderRowY(row, normalized).worldY;
  return { x, y, z: 0 };
}

const SPAWN_ROW_REACH_DEFAULT = 0.25;
/** Coerce optional run reach fractions into the plain shape `boxingColliderRowY` requires (out-of-range values fall back to the 0.25 Game Setup defaults). @param {Readonly<{topRowReachWU?:unknown,bottomRowReachWU?:unknown}>|null} [reach] */
function normalizeSpawnRowReach(reach) {
  const value = (key) => {
    const candidate = reach === null || typeof reach !== "object" ? undefined : /** @type {unknown} */(reach[key]);
    return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1 ? candidate : SPAWN_ROW_REACH_DEFAULT;
  };
  return { topRowReachWU: value("topRowReachWU"), bottomRowReachWU: value("bottomRowReachWU") };
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
 * @param {readonly Record<string, unknown>[]|null} [targets] Current projection. 0.0.58 B11a:
 * accepted for signature compatibility only — the aftermath spawn is derived from the
 * resolved content events' authored beats (cull-resistant), never from this ephemeral
 * projection, so a committed target culling from the 350 ms feedback window can no
 * longer degrade the spawn to the track center mid-fall.
 * @param {unknown} [renderEventIndex] The deterministic session target index (0.0.55 W2 Test-mode source).
 * @param {Readonly<{topRowReachWU?:unknown,bottomRowReachWU?:unknown}>|null} [rowReach] 0.0.59 B15: the run-configured row-reach fractions (Game Setup v3, emitted by the frame for the boxing_collider presentation) so the punch spawn Y matches the note's reach-row Y at ANY reach setting; absent values take the 0.25 defaults.
 * @param {Readonly<{ left_wrist?: ReadonlyArray<Readonly<{t:number,x:number,y:number}>> | null, right_wrist?: ReadonlyArray<Readonly<{t:number,x:number,y:number}>> | null }> | null} [saberWristHistory] 0.0.63 D5: the session-snapshot PRE-push per-wrist history (the SAME frozen arrays the coordinator's saber orients from — chgy). Used to compute `sliceT` at cut time for each flow-note hit. Absent → every entry omits sliceT (renderer midpoint fallback, backward compatible).
 */
export function projectAftermathEntries(events, gameplay, nowMs, targets, renderEventIndex, rowReach = null, saberWristHistory = null) {
  const judgementsValue = recordValue(gameplay, "judgements");
  if (!Array.isArray(judgementsValue)) return [];
  /** @type {{eventId:string}} */
  const eventsById = new Map();
  for (const event of events) {
    if (isRecord(event)) eventsById.set(String(event.eventId ?? ""), event);
  }
  /** @type {{targetId:string,hitCommitMs:number,family:"flow"|"punch"|"guard",hand:"left"|"right"|"both"|"neutral",mode:"straight"|"hook"|"uppercut"|"slice"|"bonk",spawn:{x:number,y:number,z:number},seed:number,shape?:"arrow"|"orb",appearanceColor?:string,sliceT?:number,evictedAtMs?:number}[]} */
  const output = [];
  /** @type {{commitMs:number,targetId:string,entry:{family:string,hand:string,mode:string,spawn:{x:number,y:number,z:number},seed:number,shape?:string,appearanceColor?:string,sliceT?:number}}[]} */
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
    // 0.0.63 D5: compute sliceT for flow notes (mode "slice") using the PRE-push
    // wrist history at the evidence timestamp. Non-flow families omit it (the
    // renderer only honors it on mode "slice" entries).
    const sliceT = mapping.family === "flow" && mapping.mode === "slice"
      ? computeSliceT(event, mapping.hand, Number(judgement.evidenceTimestampMs ?? judgement.committedTimelinePositionMs), saberWristHistory)
      : null;
    candidates.push({
      commitMs,
      targetId: eventId,
      entry: {
        family: mapping.family,
        hand: mapping.hand,
        mode: mapping.mode,
        spawn: spawnForEvent(event, rowReach),
        seed: aftermathSeedForTargetId(eventId),
        ...(mapping.shape ? { shape: mapping.shape } : {}),
        ...(mapping.appearanceColor ? { appearanceColor: mapping.appearanceColor } : {}),
        ...(sliceT !== null ? { sliceT } : {})
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
        // 0.0.63 D5: Test-mode synthetic hits have NO measured wrist sample
        // (no judgement carries evidenceTimestampMs). Fall back to `null` so
        // the renderer uses the midpoint — identical to pre-D5 behavior.
        // When a future test harness DOES feed the wrist history + an
        // evidence timestamp on the index entry, we can lift this restriction.
        const sliceT = null;
        candidates.push({
          commitMs,
          targetId,
          entry: {
            family: mapping.family,
            hand: mapping.hand,
            mode: mapping.mode,
            spawn: spawnForEvent(event, rowReach),
            seed: aftermathSeedForTargetId(targetId),
            ...(mapping.shape ? { shape: mapping.shape } : {}),
            ...(mapping.appearanceColor ? { appearanceColor: mapping.appearanceColor } : {}),
            ...(sliceT !== null ? { sliceT } : {})
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
      ...(item.entry.shape ? { shape: item.entry.shape } : {}),
      ...(item.entry.appearanceColor ? { appearanceColor: item.entry.appearanceColor } : {}),
      ...(typeof item.entry.sliceT === "number" ? { sliceT: item.entry.sliceT } : {}),
      ...(evictedCommitMs !== null && item.commitMs === evictedCommitMs ? { evictedAtMs: item.commitMs } : {})
    });
    output.push(entry);
  }
  return output;
}

/**
 * 0.0.63 D5 — compute the slice `sliceT` (0..1 fraction along the glyph's
 * long axis where the saber blade actually crossed at cut time). This is what
 * makes the aftermath "hit corpse" split at the BLADE'S ACTUAL CUT POSITION
 * instead of always the midpoint (Derrick: "when a beat is cut, it doesn't
 * necessarily happen from the spot the sword cut").
 *
 * ## Derivation
 * For a directional flow note (`shape === "arrow"`):
 *   1. The judge-space cell center = `(placement % 4, 2 - floor(placement/4))`
 *      — the SAME `targetCenterForPlacement` the gameplay capsule detector uses.
 *   2. The arrow's local long axis in world/JUDGE space = the authored direction
 *      unit vector (mirrors `directionUnitVector`).
 *   3. The blade line at cut = `{ wristSample → wristSample + saberGeometry.length
 *      · saberDirection }` (the EXACT capsule centerline `saberCapsuleContactsFlowTarget`
 *      tests; `saberGeometry` from the shared equipment contract).
 *   4. Project the blade segment onto the arrow axis:
 *        `t_axis = ((p1 − cellCenter)·axis − (p0 − cellCenter)·axis) / length`,
 *      then map that to [0, 1] over the CELL WIDTH projected onto the axis and
 *      clamp to `[SLICE_T_MIN, SLICE_T_MAX]`.
 *   For a directionless note (`shape === "orb"`):
 *   5. There is no authored long axis, so take the blade's own direction as the
 *      reference axis (the orb is isotropic, so any consistent axis gives a
 *      meaningful crossing point).
 *
 * ## Where the blade position comes from (documented approximation)
 * The hit judgement record carries `evidenceTimestampMs` (the measurement
 * timestamp of the wrist frame that fired the capsule test, when available) but
 * NOT the raw `{x, y}` of that sample. The session snapshot DOES expose
 * `saberWristHistory` (chgy): the PRE-push per-wrist frozen arrays the
 * coordinator's OWN saber orients from, each entry being `{ t, x, y }` in judge
 * space. We pick the history entry whose `t` is closest to `evidenceTimestampMs`
 * AND within `maximumColliderSampleFreshnessMs` (150 ms, imported from
 * `@aerobeat/web-gameplay`). In steady state (one measurement per tick) this is
 * the very sample that committed the hit; when multiple frames fall in the
 * window we take the nearest one. This is a DOCUMENTED APPROXIMATION because:
 *   - if the judgement has no `evidenceTimestampMs` (legacy fixture / shadow
 *     path), we fall back to `committedTimelinePositionMs`;
 *   - if the relevant wrist's history is absent, empty, or has no entry within
 *     the freshness window for that timestamp, we return `null` and the caller
 *     OMITS `sliceT` from the entry — the renderer then uses its midpoint
 *     fallback, identical to pre-D5 behavior. No silent degradation: the
 *     "blade cut position" is either the actual last-measured wrist, or absent.
 * The blade DIRECTION is re-derived with the SAME pure oracle
 * (`saberDirectionFromWristHistory`, imported from `@aerobeat/web-gameplay`) on
 * the coordinator's OWN pre-push history, so the crossing computation aligns
 * with the live hit volume (visual == hit == cut-position, the chgy invariant).
 *
 * @param {{authoredBeat?: Record<string, unknown>, type?: string}} event Resolved content event.
 * @param {"left"|"right"} hand The hand that committed the hit.
 * @param {unknown} evidenceTimestampMs The judgement's evidence measurement timestamp (ms).
 * @param {Readonly<{ left_wrist?: ReadonlyArray<Readonly<{t:number,x:number,y:number}>> | null, right_wrist?: ReadonlyArray<Readonly<{t:number,x:number,y:number}>> | null }> | null} [saberWristHistory] Session-snapshot PRE-push per-wrist history.
 * @returns {number|null} The clamped sliceT, or null when no usable wrist sample exists (caller omits the field → renderer midpoint fallback).
 */
export function computeSliceT(event, hand, evidenceTimestampMs, saberWristHistory = null) {
  // Resolve the event's shape the same way the mapping does.
  const type = typeof event.type === "string" ? event.type : (typeof event.authoredBeat?.type === "string" ? event.authoredBeat.type : null);
  if (type !== "note") return null; // Only Flow notes use mode "slice".
  const beat = isRecord(event.authoredBeat) ? event.authoredBeat : {};
  const placement = beat.placement;
  if (!Number.isInteger(placement) || placement < 0 || placement >= 12) return null;
  // Judge-space cell center (same as targetCenterForPlacement).
  const col = placement % 4;
  const row = Math.floor(placement / 4);
  const cellCenterX = col;
  const cellCenterY = 2 - row;
  // Choose the reference axis. Directional note → the arrow's TAIL→HEAD axis,
  // which is ALIGNED with the authored direction unit vector: for a flow "up"
  // arrow the glyph's head points +Y (same as the direction), and the athlete
  // swings UP through it. So a wrist positioned BELOW the cell (smaller Y)
  // means the blade crossed near the tail (small sliceT), and a wrist AT/ABOVE
  // center means it crossed mid-to-head (larger sliceT). The arrow's long-axis
  // fraction runs from tail (t=0) to head (t=1) along +direction. Otherwise →
  // the blade's own direction (for orbs, isotropic).
  const dirName = directionNameFromAuthored(beat.direction);
  let refAxis = null;
  if (dirName !== null) {
    const vec = FLOW_DIRECTION_VECTORS[dirName];
    refAxis = { x: vec[0], y: vec[1] };
  }
  // Grab the wrist sample for this hand, preferring the last entry whose `t` is
  // closest to (and ≤) evidenceTimestampMs.
  const wristRole = hand === "right" ? "right_wrist" : "left_wrist";
  const history = saberWristHistory && Array.isArray(saberWristHistory[wristRole]) ? saberWristHistory[wristRole] : [];
  /** @type {{x:number,y:number}|null} */ let wristSample = null;
  let bestDelta = Infinity;
  for (const s of history) {
    if (!isRecord(s)) continue;
    if (typeof s.x !== "number" || !Number.isFinite(s.x) || typeof s.y !== "number" || !Number.isFinite(s.y) || typeof s.t !== "number" || !Number.isFinite(s.t)) continue;
    const delta = Number(evidenceTimestampMs) - s.t;
    if (delta < 0 || delta > maximumColliderSampleFreshnessMs) continue; // stale or future
    if (Math.abs(delta) < Math.abs(bestDelta)) { bestDelta = delta; wristSample = { x: s.x, y: s.y }; }
  }
  if (wristSample === null) return null; // No usable wrist → omit (renderer midpoint fallback).
  // Blade direction: re-derive via the SAME pure oracle the visible beam uses,
  // on the coordinator's OWN pre-push history (the visual==hit invariant). The
  // oracle returns the grid-up fallback when the history is degenerate, so no
  // extra guard is needed here.
  const saberDir = saberDirectionFromWristHistory(history, Number(evidenceTimestampMs));
  // Reference axis: for an orb, use the blade's own direction.
  if (refAxis === null) refAxis = { x: saberDir.x, y: saberDir.y };
  // Build the blade segment endpoints (in judge space, Z=0).
  const p0 = { x: wristSample.x, y: wristSample.y };
  const p1 = { x: wristSample.x + saberGeometry.length * saberDir.x, y: wristSample.y + saberGeometry.length * saberDir.y };
  // Project both endpoints onto the reference axis relative to the cell center.
  const projP0 = (p0.x - cellCenterX) * refAxis.x + (p0.y - cellCenterY) * refAxis.y;
  const projP1 = (p1.x - cellCenterX) * refAxis.x + (p1.y - cellCenterY) * refAxis.y;
  // Project the cell's FOUR CORNERS onto the reference axis (relative to the
  // cell center, so the center itself maps to 0). For an "up" arrow over a 1×1
  // cell this gives −0.5 (tail edge) and +0.5 (head edge), axisSpan = 1.0.
  // Using the actual corner extent is robust to diagonal directions where the
  // cell projects onto a shorter axis-aligned span (e.g., a 45° axis over a
  // square cell has span √2/2 ≈ 0.707 instead of 1).
  const cornerProjections = [];
  for (const [dx, dy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    cornerProjections.push(dx * refAxis.x + dy * refAxis.y);
  }
  const axisMin = Math.min(...cornerProjections);
  const axisMax = Math.max(...cornerProjections);
  const axisSpan = axisMax - axisMin;
  if (axisSpan < 1e-9) return 0.5; // Degenerate axis (shouldn't happen with unit vectors).
  // Average the two endpoint projections to get the blade-line's central crossing.
  const bladeProjCenter = (projP0 + projP1) / 2;
  // Fraction along the axis where the blade crosses.
  const rawT = (bladeProjCenter - axisMin) / axisSpan;
  const clamped = Math.min(SLICE_T_MAX, Math.max(SLICE_T_MIN, rawT));
  return Number(clamped.toFixed(4));
}

/** 0.0.63 D5: resolve an authored direction (integer enum index OR string name) to its canonical name. Returns null when absent/unrecognized. */
function directionNameFromAuthored(direction) {
  if (typeof direction === "string") {
    return FLOW_DIRECTION_VECTORS[direction] ? direction : null;
  }
  if (Number.isInteger(direction) && direction >= 0 && direction < FLOW_DIRECTION_ENUM.length) {
    return FLOW_DIRECTION_ENUM[direction];
  }
  return null;
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
 * 0.0.56 W2: the hit note's ACTUAL glyph shape for the aftermath "hit corpse"
 * (`"arrow"` for a directional note, `"orb"` for a directionless / any note).
 * Mirrors the renderer's `assetForTarget` note-shape rule (direction → arrow,
 * otherwise orb) so the corpse is a cut-in-half of the note's real asset, not a
 * generic circle (B3) and so a straight punch from an orb "any" note keeps the
 * orb shape (B9).
 *
 * @param {Record<string, unknown>} event
 * @param {string} type
 * @returns {"arrow"|"orb"|string}
 */
function noteShapeForEvent(event, type) {
  const beat = isRecord(event.authoredBeat) ? event.authoredBeat : {};
  if (type === "note") {
    // Flow: `authoredBeat.direction` is the authored direction (integer index
    // 0–7 in real resolved content, or the string name in legacy/synthetic
    // fixtures). A directional note renders as an arrow, a directionless one
    // (absent direction) as an orb. Mirrors the projection's `flowDirection`.
    const direction = beat.direction;
    const isDirectional = Number.isInteger(direction) || (typeof direction === "string" && direction.length > 0);
    return isDirectional ? "arrow" : "orb";
  }
  if (PUNCH_FAMILIES[type]) {
    // Boxing punch: `authoredBeat.spatialTarget.entryDirection` is the
    // direction the punch came from; present (a string direction) → arrow,
    // absent (orb "any" note reused as a straight punch) → orb.
    const spatial = isRecord(beat.spatialTarget) ? beat.spatialTarget : null;
    const direction = spatial ? spatial.entryDirection : null;
    return typeof direction === "string" && direction.length > 0 ? "arrow" : "orb";
  }
  return "orb";
}

/**
 * 0.0.58 B11b: the event's validated private note appearance — the note's REAL fill
 * color (canonical uppercase `#RRGGBB`) — so the renderer can desaturate the hit
 * corpse's ACTUAL glyph instead of flattening it to one gray value. `null` when the
 * event carries no validated appearance (the renderer falls back to a neutral fill).
 *
 * @param {Record<string, unknown>} event
 * @returns {string|null}
 */
function eventNoteAppearance(event) {
  const value = event.appearanceColor;
  return typeof value === "string" && /^#[0-9A-F]{6}$/u.test(value) ? value : null;
}

/**
 * Map one resolved content event to its aftermath family/hand/mode/shape.
 * Returns `null` for events that do not produce an aftermath entry (non-note
 * non-punch non-guard types, omitted arc/burst, obstacles, bombs).
 *
 * @param {Record<string, unknown>} event
 */
function aftermathMappingForEvent(event) {
  // 0.0.55 W2 follow-up: real resolved content events (content-runtime
  // timelineFor()) carry NO top-level `type` — only `authoredBeat.type`.
  // Synthetic events in unit tests DO carry a top-level `type`. Prefer the
  // top-level field when present, otherwise fall back to authoredBeat.type.
  const type = (typeof event.type === "string" ? event.type : null) ?? (typeof event.authoredBeat?.type === "string" ? event.authoredBeat.type : null);
  // 0.0.59 B13: flow corpses read flat gray because the entry `hand` was hard-coded
  // "neutral", so the renderer's corpse-color fallback resolved to the near-white
  // receptorColor. The corpse color must come from the NOTE'S HAND via the same song
  // palette system boxing uses. A real authored flow note always carries
  // `authoredBeat.hand` ∈ {"left","right"} (enforced at package validation), so read
  // it directly; fall back to "left" only for synthetic/legacy fixtures missing it.
  const beat = isRecord(event.authoredBeat) ? event.authoredBeat : {};
  const flowHand = beat.hand === "right" ? "right" : "left";
  const mapping = type === "note"
    ? { family: "flow", hand: flowHand, mode: "slice", shape: noteShapeForEvent(event, "note") }
    : PUNCH_FAMILIES[type]
      ? { family: "punch", hand: PUNCH_FAMILIES[type].hand, mode: PUNCH_FAMILIES[type].mode, shape: noteShapeForEvent(event, type) }
      : GUARD_TYPES.includes(type)
        ? { family: "guard", hand: "both", mode: "bonk", shape: null }
        : null;
  if (!mapping) return null;
  // 0.0.58 B11b: carry the note's real fill so the renderer desaturates the
  // ACTUAL glyph (white outline kept light, fill grayed) instead of flattening
  // the corpse to a single uniform gray value.
  const appearance = eventNoteAppearance(event);
  return appearance === null ? mapping : { ...mapping, appearanceColor: appearance };
}

// Exported because src/index.js (rendererFrame, D5 aftermath-slice wiring) calls
// it directly — importing keeps the definition in one place (D2 fix).
/** @param {unknown} value */
export function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** @param {unknown} value @param {string} key */
function recordValue(value, key) { return isRecord(value) ? value[key] : undefined; }
