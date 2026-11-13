// Extract a compact replay excerpt + latency measurements from an AeroBeat play capture.
//
//   node extract.mjs [capture.json] [windowSeconds]
//
// Writes frames.json (replay excerpt) and latency.json (numbers used by LATENCY.md)
// next to this script. Read-only on the capture.
//
// Field meanings verified against aerobeat-web-assembly/src/play-movement-recording.js,
// src/index.js runDisplayFrame() and src/production-cv-service.js (r155):
//   movement.ticks[i]           one row per display frame (rAF), columns = movement.tickFields
//   tick.timestampMs            max(performance.now() at frame start, measurement ts) = frame time
//   tick.inputIndex             body-grid snapshot used by gameplay on that frame
//   tick.renderTimelineMs       renderer song clock on that frame (ms)
//   input.anchors[].measurementTimestampMs
//                               performance.now() when the CV service started MediaPipe
//                               inference on the latest <video> frame (createLockedVideoFrameSource
//                               uses getTimestampMs: () => performance.now()); same clock as ticks.
//   input.anchors[].x/y         athlete_top_left: 0..1 spans the calibration box.
//   judge space (what the game scores in): sx = 4x - 0.5, sy = 2.5 - 3y  (flow-collider-collision.js)
//   note placement p:           cell centre (p % 4, 2 - floor(p / 4)) in judge space
//   note direction d:           ["up","down","left","right","up-left","up-right","down-left","down-right"][d]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] ?? '/home/derrick/Downloads/aerobeat-ab-0.0.155-ab-songpkg-undefeatable-feat-kellin-quinn-sonic--Expert.json';
const windowMs = Number(process.argv[3] ?? 45) * 1000;

const cap = JSON.parse(readFileSync(src, 'utf8'));
const m = cap.movement;
const F = Object.fromEntries(m.tickFields.map((n, i) => [n, i]));
const T = m.ticks, I = m.inputs;
const playing = m.states.indexOf('playing');
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]; };
const r1 = (v) => Math.round(v * 10) / 10;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// ---- Playing ticks and first-reference of each input --------------------------------
const playTicks = [];
for (let i = 0; i < T.length; i++) if (T[i][F.stateIndex] === playing) playTicks.push(i);
const firstTick = new Map();
for (const i of playTicks) { const k = T[i][F.inputIndex]; if (k >= 0 && !firstTick.has(k)) firstTick.set(k, i); }

const anchorOf = (inp, name) => inp.anchors?.find((a) => a.anchor === name);
const poses = [];
for (const [k, i] of [...firstTick].sort((a, b) => a[0] - b[0])) {
  const inp = I[k];
  if (inp?.calibration?.state !== 'calibrated') continue;
  const w = anchorOf(inp, 'right_wrist');
  if (!w) continue;
  const measTs = w.measurementTimestampMs;
  const tickTs = T[i][F.timestampMs];
  const latency = tickTs - measTs;
  const ta = T[i][F.renderTimelineMs];            // song time when it first reached a rendered frame
  poses.push({ k, i, measTs, tickTs, latency, ta, tm: ta - latency, inp });
}

// ---- Latency + rate ----------------------------------------------------------------
const lat = poses.map((p) => p.latency);
const dts = poses.slice(1).map((p, j) => p.measTs - poses[j].measTs);
const tickDts = playTicks.slice(1).map((i, j) => T[i][F.timestampMs] - T[playTicks[j]][F.timestampMs]);
// Age of the pose on screen at every rendered frame (latency + hold until next pose).
const ageAll = playTicks.map((i) => { const a = anchorOf(I[T[i][F.inputIndex]], 'right_wrist'); return T[i][F.timestampMs] - a.measurementTimestampMs; });
const allMeasSame = poses.every((p) => p.inp.anchors.every((a) => a.measurementTimestampMs === p.measTs) && p.inp.timestampMs === p.measTs);
const durS = (poses.at(-1).measTs - poses[0].measTs) / 1000;
const latency = {
  method: 'tick.timestampMs of the first display frame whose inputIndex references a body-grid snapshot, minus that snapshot\'s anchor measurementTimestampMs (both performance.now()).',
  playingPoses: poses.length,
  latencyMs: { min: r1(Math.min(...lat)), p10: r1(q(lat, 0.1)), median: r1(q(lat, 0.5)), p90: r1(q(lat, 0.9)), p99: r1(q(lat, 0.99)), max: r1(Math.max(...lat)) },
  poseIntervalMs: { p10: r1(q(dts, 0.1)), median: r1(q(dts, 0.5)), p90: r1(q(dts, 0.9)), max: r1(Math.max(...dts)), over100ms: dts.filter((d) => d > 100).length },
  poseRateHz: { fromMedianInterval: r1(1000 / q(dts, 0.5)), fromCount: r1((poses.length - 1) / durS) },
  displayFrameMs: { median: r1(q(tickDts, 0.5)), p90: r1(q(tickDts, 0.9)), rateHz: r1(1000 / q(tickDts, 0.5)) },
  ageOnScreenMs: { median: r1(q(ageAll, 0.5)), p90: r1(q(ageAll, 0.9)), mean: r1(ageAll.reduce((s, v) => s + v, 0) / ageAll.length) },
  allAnchorsShareOneMeasurementTimestamp: allMeasSame,
  provenance: Object.entries(poses.reduce((o, p) => { const v = p.inp.latestEvidence?.provenance ?? 'none'; o[v] = (o[v] ?? 0) + 1; return o; }, {})),
  recordingStatus: { status: m.status, reason: m.reason, lastSongMs: r1(T.at(-1)[F.renderTimelineMs]) }
};

// ---- Judgements -> song time ---------------------------------------------------------
const playTs = playTicks.map((i) => T[i][F.timestampMs]);
function perfToSong(ts) {
  let lo = 0, hi = playTs.length - 1;
  if (ts < playTs[0] || ts > playTs[hi]) return null;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (playTs[mid] < ts) lo = mid + 1; else hi = mid; }
  const i = playTicks[lo];
  return T[i][F.renderTimelineMs] - (T[i][F.timestampMs] - ts);
}
const events = new Map(m.configurations[0].gameplay.resolvedEvents.map((e) => [e.eventId, e]));
const DIRS = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'];
const notes = cap.judgements.map((j) => {
  const b = events.get(j.eventId)?.authoredBeat ?? {};
  return {
    t: j.beatCenterTimestampMs, hand: b.hand ?? null, placement: b.placement ?? null,
    dir: Number.isInteger(b.direction) ? DIRS[b.direction] : null,
    result: j.result, offsetMs: j.timingOffsetMs === null ? null : r1(j.timingOffsetMs),
    hitT: j.evidenceTimestampMs === null ? null : r1(perfToSong(j.evidenceTimestampMs)),
    why: j.diagnostics?.length ? j.diagnostics : undefined
  };
});

// ---- Pick the busiest window that the movement recording fully covers -----------------
const songStart = poses[0].ta, songEnd = poses.at(-1).ta;
let best = { start: songStart, count: -1 };
for (let s = Math.ceil(songStart / 500) * 500; s + windowMs <= songEnd; s += 500) {
  const c = notes.filter((n) => n.t >= s && n.t < s + windowMs).length;
  if (c > best.count) best = { start: s, count: c };
}
const w0 = best.start, w1 = best.start + windowMs;
const pt = (a) => [r4(4 * a.x - 0.5), r4(2.5 - 3 * a.y)];
const names = { n: 'nose', ls: 'left_shoulder', rs: 'right_shoulder', le: 'left_elbow', re: 'right_elbow', lw: 'left_wrist', rw: 'right_wrist' };
const pad = 1000; // a little pose context either side so smoothing/physics have history
const framePoses = poses.filter((p) => p.ta >= w0 - pad && p.ta <= w1 + pad).map((p) => {
  const o = { ta: r1(p.ta), tm: r1(p.tm) };
  for (const [key, name] of Object.entries(names)) { const a = anchorOf(p.inp, name); o[key] = a && a.valid ? pt(a) : null; }
  return o;
});
const winNotes = notes.filter((n) => n.t >= w0 - 600 && n.t <= w1 + 300);
const winLat = poses.filter((p) => p.ta >= w0 && p.ta <= w1).map((p) => p.latency);
const winDt = framePoses.slice(1).map((p, j) => p.tm - framePoses[j].tm);

const frames = {
  source: src.split('/').pop(),
  song: cap.song.name, difficulty: cap.song.difficulty, build: cap.build?.version ?? m.metadata?.capture?.build?.version,
  space: 'judge: x right, y up, 1 unit = 1 note cell; calibration box spans x -0.5..3.5, y -0.5..2.5',
  times: 'song ms. ta = first rendered frame using this pose (real latency included); tm = estimated song time it was measured',
  window: { startMs: w0, endMs: w1, notes: winNotes.filter((n) => n.t >= w0 && n.t < w1).length },
  latency: { medianMs: latency.latencyMs.median, p90Ms: latency.latencyMs.p90, poseHz: latency.poseRateHz.fromMedianInterval,
    windowMedianMs: r1(q(winLat, 0.5)), windowP90Ms: r1(q(winLat, 0.9)), windowIntervalMedianMs: r1(q(winDt, 0.5)) },
  poses: framePoses,
  notes: winNotes
};
writeFileSync(join(here, 'frames.json'), JSON.stringify(frames));
writeFileSync(join(here, 'latency.json'), JSON.stringify({ ...latency, window: frames.window, windowStats: frames.latency }, null, 2));
console.log(JSON.stringify({ ...latency, window: frames.window, windowStats: frames.latency, framePoses: framePoses.length, bytes: JSON.stringify(frames).length }, null, 2));
