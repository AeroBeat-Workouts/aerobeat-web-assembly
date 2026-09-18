// @ts-check
//
// kpxg (bead 2026-09-17 0.0.61 L-E) — Node-side accumulator sampler for the
// long-song memory-growth diagnosis. Read-only instrument: it drives the REAL
// `createAeroGameplaySessionCoordinator` (aerobeat-web-gameplay) through a
// synthetic ~15-minute flow_colliders_v1 run (3000 notes @ 300 ms + 100 flow
// wall obstacles), advancing a simulated audio clock at a 16 ms display tick,
// and samples the session's retained arrays at regular intervals. No renderer,
// no browser.
//
// What it measures (per sample):
//   - coordinator state sizes read from the PUBLIC snapshot: judgements,
//     judgedIds (judgedEventIds), obstacleOutcomes, hazardOutcomes,
//     shadowJudgements, scorePartitions, activeEventIds
//   - the FULL snapshot produced by `getSnapshot()` (the assembly's
//     `gameplay.getSnapshot()` hot path — includes deep-freeze copies of the
//     persistent arrays) + its JSON.stringify byte size, a close proxy for the
//     per-frame transient allocation the display loop incurs.
//   - an implicit GC (`globalThis.gc` under --expose-gc) before each sample so
//     heapUsed is comparable.
//
// Usage:
//   node --expose-gc <this script>
//   (plain `node` also works; heap sampling is then skipped)
//
// Output: one line per sample + a final linear fit summary. Intended to be
// appended to evidence/2026-09-17-kpxg-memory-growth-w0.md.
//
// NOTE: growth rates are reported PER MS OF SONG TIME, so they transfer to
// real-time play regardless of simulation wall-clock speed. A full 904 s run
// takes ~15–25 min of Node wall clock; use --fast (NOT supported here — just
// accept the run) or trim NOTE_COUNT for a quick shape check.

import { createAeroGameplaySessionCoordinator } from "@aerobeat/web-gameplay";

const NOTE_COUNT = 3000; // ~15 min at a Warioware-style 1 note / 300 ms
const NOTE_PERIOD_MS = 300;
const FIRST_NOTE_MS = 4000; // after a short lead-in
const OBSTACLE_COUNT = 100; // flow wall hazards spread across the run
const OBSTACLE_INTERVAL_MS = 1000;
const TICK_MS = 16; // ~60 fps display cadence
const SAMPLE_EVERY_MS = 10000; // 1 sample / 10 s of song time
const FULL_END_MS = FIRST_NOTE_MS + NOTE_COUNT * NOTE_PERIOD_MS; // ≈ 904 s ≈ 15 min
// The wall-outcome leak is QUADRATIC in song time, so per-tick cost (sort +
// push + snapshot copy of the growing array) accelerates; the full 904 s run
// can exceed ~20 min of Node wall clock. KPXG_END_MS trims the run for a
// completed fit (rates are per ms of song time, unaffected by the trim).
const END_MS = Math.min(FULL_END_MS, Number(process.env.KPXG_END_MS) || FULL_END_MS);

function cellFromNormalized(x, y) {
  const column = Math.max(0, Math.min(3, Math.floor(x * 4)));
  const row = Math.max(0, Math.min(2, Math.floor(y * 3)));
  return row * 4 + column;
}

function makeNoteEvent(i, centerMs) {
  const hand = i % 2 === 0 ? "left" : "right";
  const placement = i % 12;
  const directional = i % 4 === 0;
  return {
    schema: "aerobeat/resolved_content_event",
    version: 3,
    type: "note",
    eventId: `note-${i}`,
    centerTimestampMs: centerMs,
    hand,
    placement,
    ...(directional ? { direction: "down" } : {}),
    authoredBeat: { type: "note", hand, placement, ...(directional ? { direction: "down" } : {}) },
    variantId: "v1",
    chartId: "c1"
  };
}

function makeObstacleEvent(i, centerMs) {
  return {
    schema: "aerobeat/resolved_content_event",
    version: 3,
    type: "obstacle",
    eventId: `obs-${i}`,
    centerTimestampMs: centerMs,
    intervalStartTimestampMs: centerMs,
    intervalEndTimestampMs: centerMs + OBSTACLE_INTERVAL_MS,
    sourceGeometry: { schema: "aerobeat/obstacle_source_geometry", version: 1, coordinateSpace: "beatsaber_v3_obstacle_rect", kind: "v3_rect", x: 0, y: 0, width: 4, height: 3 },
    gameplayGeometry: { schema: "aerobeat/obstacle_gameplay_geometry", version: 1, coordinateSpace: "aerobeat_top_left_grid", x: 0, y: 0, width: 4, height: 3 },
    gridMask: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    authoredBeat: { type: "obstacle", start: 0, end: 2 },
    variantId: "v1",
    chartId: "c1"
  };
}

const events = [];
for (let i = 0; i < NOTE_COUNT; i += 1) events.push(makeNoteEvent(i, FIRST_NOTE_MS + i * NOTE_PERIOD_MS));
for (let i = 0; i < OBSTACLE_COUNT; i += 1) {
  const center = FIRST_NOTE_MS + 2000 + i * Math.floor((END_MS - FIRST_NOTE_MS - 4000) / (OBSTACLE_COUNT + 1));
  events.push(makeObstacleEvent(i, center));
}
events.sort((a, b) => a.centerTimestampMs - b.centerTimestampMs || (a.eventId < b.eventId ? -1 : 1));
const resolvedEvents = Object.freeze(events.map((event) => Object.freeze(event)));

const variant = Object.freeze({
  variantId: "v1",
  chartId: "c1",
  mode: "flow",
  rulesetId: "flow_colliders_v1",
  recipeId: null,
  modifierIds: Object.freeze([]),
  ranked: false,
  localOnly: true,
  mapHash: Object.freeze({ schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "a".repeat(64) }),
  scoreIdentityHash: Object.freeze({ schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "b".repeat(64) }),
  provenance: null
});

// Contract-valid synthetic input snapshot: calibration ready, all three
// gameplay anchors (nose + both wrists) inside valid cells, measured provenance.
// Wrists follow Lissajous curves through the grid so SOME notes hit and the
// rest miss — the hit/miss mix does not matter for the growth curve: hits AND
// misses both append a persistent judgement (recordJudgementAt → judgements).
function inputFor(tMs) {
  const frame = `f${Math.floor(tMs / TICK_MS)}`;
  const ts = 0.9; // sample freshness < 150 ms checkpoint gate
  const t = tMs - ts;
  const left = { x: 0.5 + 0.4 * Math.sin(t / 900), y: 0.5 + 0.4 * Math.cos(t / 700) };
  const right = { x: 0.5 + 0.4 * Math.cos(t / 800), y: 0.5 + 0.4 * Math.sin(t / 600) };
  const nose = { x: 0.5 + 0.3 * Math.sin(t / 1200), y: 0.5 + 0.3 * Math.cos(t / 1100) };
  const anchor = (id, p, cell) => ({
    schema: "aerobeat/body_grid_anchor_snapshot",
    version: 1,
    anchor: id,
    calibrationId: "cal-1",
    measurementTimestampMs: t,
    valid: true,
    confidence: 0.9,
    rawX: p.x,
    rawY: p.y,
    x: p.x,
    y: p.y,
    cell,
    subcell: cell
  });
  const entry = (id, cell, direction) => ({
    schema: "aerobeat/body_grid_cell_entry",
    version: 1,
    anchor: id,
    calibrationId: "cal-1",
    measurementTimestampMs: t,
    fromCell: cell,
    toCell: cell,
    direction,
    provenance: "measured"
  });
  const lCell = cellFromNormalized(left.x, left.y);
  const rCell = cellFromNormalized(right.x, right.y);
  const nCell = cellFromNormalized(nose.x, nose.y);
  return {
    input: {
      calibration: { calibrationId: "cal-1", readiness: "ready" },
      tracking: { gameplayPaused: false, freshCalibrationRequired: false },
      countdownFrozen: false,
      latestEvidence: {
        schema: "aerobeat/gameplay_evidence_snapshot",
        version: 1,
        calibrationId: "cal-1",
        measurementTimestampMs: t,
        measuredSourceFrameId: frame,
        provenance: "measured",
        anchors: [anchor("nose", nose, nCell), anchor("left_wrist", left, lCell), anchor("right_wrist", right, rCell)],
        entries: [entry("left_wrist", lCell, "down"), entry("right_wrist", rCell, "down")],
        activeBoxingActions: []
      },
      straightQualifications: []
    },
    lease: null
  };
}

const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "kpxg-measure", countdownStepMs: 250 });
coordinator.configureContent({ packageId: "pkg-kpxg", selectedVariant: variant, resolvedEvents }, { purpose: "play" });
// The play path requires an owned media lease (audio resource) before the
// session can leave calibrating — the assembly always supplies one
// (graph.gameplay.setLeaseSnapshot in the display loop).
coordinator.setLeaseSnapshot({
  schema: "aerobeat/media_lease_snapshot",
  version: 1,
  ownerInstanceId: "measure",
  generation: 1,
  state: "owned",
  resources: ["audio"]
});
// Prime the coordinator's calibration state with the first input (readiness
// "ready" + matching calibrationId), THEN explicitly restart: the restart
// re-enters requestStart with safetyReady now armed, which starts the 3-step
// countdown (audio frozen, positionMs = 0, countdownStepMs = 250 → playing by
// t ≈ 750 ms).
const primeInput = inputFor(TICK_MS);
coordinator.advance({
  timestampMs: TICK_MS,
  clock: { contextTimeSeconds: 0, positionSeconds: 0, durationSeconds: Math.ceil(END_MS / 1000) + 1, progress: 0, playing: false },
  input: primeInput.input
});
const startResult = coordinator.requestStart(TICK_MS, { schema: "aerobeat/gameplay_session_start", version: 1, purpose: "play" });
if (startResult.accepted !== true) {
  const s = coordinator.getSnapshot().session;
  throw new Error(`requestStart rejected: ${JSON.stringify(startResult)} state=${s.state} pause=${s.pauseReason}`);
}

// Node runs this simulation much faster than real time. To keep the
// wall-clock run bounded, subsample the input: every Nth tick sends a real
// (fresh) evidence frame; the other ticks send a NULL input so the
// coordinator clears its evidence, runs its finalize paths, and records the
// timing_miss judgements the same way it would for a real no-input frame.
// The per-note/per-second growth rates are measured per ms of SONG time, so
// the input rate does not change them (a wall outcome is emitted ONCE per
// obstacle regardless of input cadence).
const INPUT_EVERY_N = Number(process.env.KPXG_INPUT_EVERY ?? "4");

const gc = typeof globalThis.gc === "function" ? globalThis.gc : null;
function memoryStats() {
  try {
    const stats = process.memoryUsage();
    return { heapUsedKb: Math.round(stats.heapUsed / 1024), rssKb: Math.round(stats.rss / 1024) };
  } catch {
    return { heapUsedKb: null, rssKb: null };
  }
}

// Structural sample: array lengths only. NEVER JSON.stringify the snapshot —
// for ~1.3M hazardOutcomes entries that alone would cost ~150 s and ~300 MB of
// transient churn, dwarfing everything we are trying to measure.
function sample(t) {
  if (gc) gc();
  const snap = coordinator.getSnapshot();
  const session = snap.session;
  return {
    tMs: t,
    state: session.state,
    timelineMs: Number(session.timelinePositionMs),
    judgements: Array.isArray(snap.judgements) ? snap.judgements.length : -1,
    judgedIds: Array.isArray(snap.judgedEventIds) ? snap.judgedEventIds.length : -1,
    obstacleOutcomes: Array.isArray(snap.obstacleOutcomes) ? snap.obstacleOutcomes.length : -1,
    hazardOutcomes: Array.isArray(snap.hazardOutcomes) ? snap.hazardOutcomes.length : -1,
    shadowJudgements: Array.isArray(snap.shadowJudgements) ? snap.shadowJudgements.length : -1,
    scorePartitions: Array.isArray(snap.scorePartitions) ? snap.scorePartitions.length : -1,
    activeEventIds: Array.isArray(snap.activeEventIds) ? snap.activeEventIds.length : -1,
    snapshotBytes: null, // intentionally not measured (see note above)
    ...memoryStats()
  };
}

// Drive the loop: during the countdown the audio clock must stay FROZEN at
// positionMs 0 / playing false (the coordinator cancels the countdown into
// paused_manual otherwise); after the session reports state "playing", the
// clock advances in lockstep with the simulated audio position.
const samples = [];
let tMs = TICK_MS;
let nextSampleMs = SAMPLE_EVERY_MS;
while (tMs <= END_MS) {
  const stateBefore = coordinator.getSnapshot().session.state;
  const clock = stateBefore === "countdown"
    ? { contextTimeSeconds: 0, positionSeconds: 0, durationSeconds: Math.ceil(END_MS / 1000) + 1, progress: 0, playing: false }
    : { contextTimeSeconds: tMs / 1000, positionSeconds: tMs / 1000, durationSeconds: Math.ceil(END_MS / 1000) + 1, progress: Math.min(1, tMs / END_MS), playing: true };
  // Subsampled input: send a real fresh evidence frame every Nth tick; the
  // rest send null input (coordinator clears evidence + finalizes).
  const sendInput = Math.floor(tMs / TICK_MS) % INPUT_EVERY_N === 0;
  coordinator.advance({
    timestampMs: tMs,
    clock,
    input: sendInput ? inputFor(tMs).input : undefined
  });
  if (tMs >= nextSampleMs) {
    const row = sample(tMs);
    nextSampleMs += SAMPLE_EVERY_MS;
    samples.push(row);
    const parts = [
      `t=${row.tMs}`,
      `state=${row.state}`,
      `judgements=${row.judgements}`,
      `judgedIds=${row.judgedIds}`,
      `obstacleOutcomes=${row.obstacleOutcomes}`,
      `hazardOutcomes=${row.hazardOutcomes}`,
      `scorePartitions=${row.scorePartitions}`,
      gc ? `heapUsedKb=${row.heapUsedKb}` : "heap=n/a"
    ];
    console.log(parts.join(" "));
  }
  tMs += TICK_MS;
}

// Least-squares linear fit.
function fit(values, times) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += times[i];
    sy += values[i];
    sxx += times[i] * times[i];
    sxy += times[i] * values[i];
  }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

const times = samples.map((s) => s.tMs);
const jFit = fit(samples.map((s) => s.judgements), times);
const oFit = fit(samples.map((s) => s.obstacleOutcomes), times);
const hFit = fit(samples.map((s) => s.hazardOutcomes), times);
const first2 = samples[0];
const last = samples[samples.length - 1];

// Approximate retained byte sizes from the measured entry counts (each entry
// is a small frozen plain record; ~250 B for a judgement, ~120 B for a
// hazard_outcome). This is a LOWER BOUND on the retained graph size.
const JUDGEMENT_BYTES = 250;
const HAZARD_OUTCOME_BYTES = 120;

console.log("");
console.log("=== kpxg coordinator accumulator fit (synthetic 15-min flow_colliders_v1 run) ===");
console.log(`events=${events.length} (notes=${NOTE_COUNT} obstacles=${OBSTACLE_COUNT}) ticks=${Math.round(END_MS / TICK_MS)} sampleCount=${samples.length} gc=${gc ? "on" : "off"} inputEvery=${INPUT_EVERY_N}`);
console.log(`judgements     end=${last.judgements} (Δ=${last.judgements - first2.judgements} over ${((last.tMs - first2.tMs) / 1000).toFixed(0)} s) fit=${jFit.slope.toFixed(5)} per ms ≈ ${(jFit.slope * 1000).toFixed(3)}/s ≈ ${(jFit.slope * 60).toFixed(4)}/min → ~${(jFit.slope * 1000 * 60 * 15 * JUDGEMENT_BYTES / 1048576).toFixed(2)} MiB retained over 15 min at 250 B/entry`);
console.log(`judgedIds      end=${last.judgedIds} (same count: one Set entry per judged note)`);
console.log(`obstacleOutcomes end=${last.obstacleOutcomes} fit=${oFit.slope.toFixed(6)} per ms`);
console.log(`hazardOutcomes end=${last.hazardOutcomes} fit=${hFit.slope.toFixed(4)} per ms ≈ ${(hFit.slope * 1000).toFixed(1)}/s → ~${(hFit.slope * 1000 * 60 * 15 * HAZARD_OUTCOME_BYTES / 1048576).toFixed(2)} MiB retained over 15 min at 120 B/entry`);
console.log(`scorePartitions end=${last.scorePartitions} (bounded: 1 per variant)`);
console.log(`activeEventIds end=${last.activeEventIds} (bounded: concurrent active events)`);
if (gc) {
  const heapFit = fit(samples.map((s) => s.heapUsedKb), times);
  console.log(`heapUsedKb     end=${last.heapUsedKb} fit=${heapFit.slope.toFixed(2)} KiB/ms ≈ ${(heapFit.slope * 60).toFixed(1)} KiB/s (Node process; includes sampler + V8 noise; shape check only)`);
}
console.log("");
console.log("NOTE: hazardOutcomes growth is driven by per-tick obstacle re-finalization in the");
console.log("synthetic run (null input clears lastObstacleSourceIdentity → finalizeObstacles runs on");
console.log("every tick for active obstacles). In a real run with continuous input the per-obstacle");
console.log("outcome is emitted ONCE at intervalEnd, but the array still persists for the whole");
console.log("session — the persistent cost is the same, the per-tick churn differs.");
