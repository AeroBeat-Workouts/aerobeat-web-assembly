// Replay real recorded play against candidate corner Pause targets.
//
//   node design/corner-check/corner-check.mjs <recording.json> [more recordings...]
//
// Question: if a Pause target sat in a screen corner during play, how often would the
// athlete's ordinary gameplay movement have triggered it by accident?
//
// Method
// - Uses each frame's calibrated wrist anchors (athlete_top_left space, where 0..1
//   spans the athlete's calibration box). That is the space a menu cursor would use.
// - Maps athlete space to screen space with the identity mapping: the calibration box
//   fills the screen. Edge reach beyond the box is kept (values < 0 or > 1 are real).
// - Applies the same selection rule as the menu prototype: each wrist is a disc; a
//   wrist is "on" the target if its disc overlaps the target rectangle; both wrists on
//   the same target continuously for the hold time = an accidental selection.
// - Only frames where the session state is "playing" count.
// - Reports, per candidate corner, size and hold time: accidental selections, the
//   longest continuous both-wrists dwell, and single-wrist exposure.
//
// Screen units: fractions of a 1600x1000 screen, so disc and target sizes match the
// prototype (disc 56 px, targets at least 120-180 px).

import { readFileSync } from 'node:fs';

const SCREEN_W = 1600, SCREEN_H = 1000;
const DISC = 56; // px, same as the prototype wrist disc

const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const sizes = [120, 180];          // px, short side of a square target
const margins = [24];              // px from the screen edges
const holds = [520, 1000];         // ms

function rectFor(corner, size, margin) {
  const left = corner.endsWith('left') ? margin : SCREEN_W - margin - size;
  const top = corner.startsWith('top') ? margin : SCREEN_H - margin - size;
  return { left, top, right: left + size, bottom: top + size };
}

function discOverlaps(x, y, r) {
  const h = DISC / 2;
  return x + h > r.left && x - h < r.right && y + h > r.top && y - h < r.bottom;
}

function framesFrom(file) {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const m = d.movement;
  const f = Object.fromEntries(m.tickFields.map((k, i) => [k, i]));
  const out = [];
  let lastInput = -1;
  for (const t of m.ticks) {
    const state = m.states[t[f.stateIndex]];
    const inputIndex = t[f.inputIndex];
    if (state !== 'playing' || inputIndex < 0 || inputIndex === lastInput) continue;
    lastInput = inputIndex;
    const input = m.inputs[inputIndex];
    if (!input || input.calibration?.state !== 'calibrated') continue;
    const anchor = (name) => input.anchors?.find((a) => a.anchor === name && a.valid);
    const lw = anchor('left_wrist'), rw = anchor('right_wrist');
    out.push({
      t: input.timestampMs,
      l: lw ? { x: lw.x * SCREEN_W, y: lw.y * SCREEN_H } : null,
      r: rw ? { x: rw.x * SCREEN_W, y: rw.y * SCREEN_H } : null,
    });
  }
  return { song: `${d.song.name} — ${d.song.difficulty} ${d.song.rulesetId}`, frames: out };
}

function analyse(frames, rect, holdMs) {
  let accidental = 0, longest = 0, runStart = null, fired = false;
  let singleFrames = 0, bothFrames = 0;
  for (const fr of frames) {
    const lOn = fr.l && discOverlaps(fr.l.x, fr.l.y, rect);
    const rOn = fr.r && discOverlaps(fr.r.x, fr.r.y, rect);
    if (lOn || rOn) singleFrames += 1;
    if (lOn && rOn) {
      bothFrames += 1;
      if (runStart === null) { runStart = fr.t; fired = false; }
      const dwell = fr.t - runStart;
      longest = Math.max(longest, dwell);
      if (!fired && dwell >= holdMs) { accidental += 1; fired = true; }
    } else {
      runStart = null; fired = false;
    }
  }
  return { accidental, longest, singleShare: singleFrames / frames.length, bothFrames };
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: corner-check.mjs <recording.json>...'); process.exit(2); }

for (const file of files) {
  const { song, frames } = framesFrom(file);
  const span = frames.length ? (frames.at(-1).t - frames[0].t) / 1000 : 0;
  const xs = frames.flatMap((f) => [f.l?.x, f.r?.x]).filter((v) => v !== undefined);
  const ys = frames.flatMap((f) => [f.l?.y, f.r?.y]).filter((v) => v !== undefined);
  console.log(`\n${song}`);
  console.log(`${frames.length} calibrated playing frames over ${span.toFixed(0)} s`);
  console.log(`wrist reach on a 1600x1000 screen: x ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)} px, y ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)} px`);
  console.log('\ncorner        size  hold   accidental  longest both-wrist dwell  one-wrist exposure');
  for (const corner of corners) for (const size of sizes) for (const margin of margins) for (const hold of holds) {
    const r = analyse(frames, rectFor(corner, size, margin), hold);
    console.log(`${corner.padEnd(13)} ${String(size).padStart(4)}  ${String(hold).padStart(4)}ms  ${String(r.accidental).padStart(10)}  ${(r.longest.toFixed(0) + ' ms').padStart(24)}  ${(100 * r.singleShare).toFixed(1).padStart(17)}%`);
  }
}
