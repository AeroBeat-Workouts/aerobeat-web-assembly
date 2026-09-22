// @ts-check
// 0.0.63 C3 (bead 2m10): unit oracle for boxing glove rotation states —
// motion x upcoming-beat selection, the four ease curves, and the per-hand
// eased-rotation tracker. Plain node; exercises the pure module
// `src/glove-rotation-states.js` directly. Plan:
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md (L-C, D3).

import assert from "node:assert/strict";
import {
  GLOVE_MOTION_DEAD_ZONE,
  GLOVE_MOTION_WINDOW_MS,
  createGloveRotationTracker,
  easeValue,
  gloveMotionVector,
  selectGloveState
} from "../src/glove-rotation-states.js";
import { GLOVE_STATE_KEYS } from "../src/equipment-config.js";

// ── Selection: upcoming-beat PRIMARY path ──────────────────────────────────
{
  // Each of the 5 states is reachable via the upcoming action.
  assert.equal(selectGloveState("left", null, { kind: "punch", hand: "left", family: "straight", beatCenterMs: 1 }), "straight", "upcoming straight → straight");
  assert.equal(selectGloveState("right", null, { kind: "punch", hand: "right", family: "uppercut", beatCenterMs: 1 }), "upercut", "upcoming uppercut → uppercut");
  assert.equal(selectGloveState("left", null, { kind: "punch", hand: "left", family: "hook", beatCenterMs: 1 }), "hookL", "upcoming hook on LEFT hand → hookL");
  assert.equal(selectGloveState("right", null, { kind: "punch", hand: "right", family: "hook", beatCenterMs: 1 }), "hookR", "upcoming hook on RIGHT hand → hookR");
  assert.equal(selectGloveState("left", null, { kind: "guard", hand: "both", family: "guard", beatCenterMs: 1 }), "guard", "upcoming guard → guard");
  // The upcoming action dominates the motion vector: an upward motion plus an
  // upcoming straight must still yield straight (Derrick's camera-vs-real-space
  // insight: the upcoming beat is the PRIMARY selector).
  assert.equal(selectGloveState("left", { x: 0, y: 0.9 }, { kind: "punch", hand: "left", family: "straight", beatCenterMs: 1 }), "straight", "upcoming beat overrides motion");
  // All 5 states are exactly the configured state keys.
  assert.deepEqual(GLOVE_STATE_KEYS, ["straight", "upercut", "hookL", "hookR", "guard"], "state keys match config foundation");
  console.log("PASS: selection via upcoming beat (5 states; upcoming dominates motion)");
}

// ── Selection: motion-fallback path ────────────────────────────────────────
{
  // Dead zone / null motion → guard.
  assert.equal(selectGloveState("left", null, null), "guard", "no motion → guard");
  // NOTE: selectGloveState receives an ALREADY-normalized (unit) vector from
  // gloveMotionVector; its "dead zone" check only fires on degenerate near-zero
  // inputs. The real dead-zone gate lives in gloveMotionVector (see below).
  assert.equal(selectGloveState("left", { x: 1e-9, y: 1e-9 }, null), "guard", "degenerate near-zero vector → guard (dead zone in selectGloveState)");
  // Dominant upward → uppercut (both hands).
  assert.equal(selectGloveState("left", { x: 0.1, y: 0.8 }, null), "upercut", "upward-dominant → uppercut");
  assert.equal(selectGloveState("right", { x: -0.1, y: 0.8 }, null), "upercut", "upward-dominant (right hand) → uppercut");
  // Dominant horizontal → hook, side by hand.
  assert.equal(selectGloveState("left", { x: 0.8, y: 0.1 }, null), "hookL", "leftward/rightward-dominant on left hand → hookL");
  assert.equal(selectGloveState("right", { x: -0.8, y: 0.1 }, null), "hookR", "horizontal-dominant on right hand → hookR");
  assert.equal(selectGloveState("left", { x: -0.8, y: 0.1 }, null), "hookL", "negative-x sweep on left hand → hookL");
  // Fast straight-ish / diagonal motion → straight.
  assert.equal(selectGloveState("left", { x: 0.5, y: 0.5 }, null), "straight", "diagonal fast motion → straight");
  assert.equal(selectGloveState("right", { x: 0.5, y: 0.5 }, null), "straight", "equal-axis fast motion → straight (1.0x ratio, below the 1.2x dominance)");
  // At exactly the 1.2x dominance boundary the dominant axis wins: |y|/|x| = 1.25 ≥ 1.2 → uppercut (NOT a "below-dominance" case — the ratio IS the test).
  assert.equal(selectGloveState("right", { x: 0.4, y: 0.5 }, null), "upercut", "upward-dominant by the 1.2x rule (0.5/0.4 = 1.25 ≥ 1.2) → uppercut");
  // Equal-axis 45° diagonal: neither axis clears the dominance ratio → straight.
  assert.equal(selectGloveState("left", { x: 0.3, y: 0.3 }, null), "straight", "equal-axis 45° diagonal (1.0x ratio, below the 1.2x dominance) → straight");
  console.log("PASS: selection via motion fallback (dead zone, uppercut, hook L/R, straight)");
}

// ── Motion vector derivation from wrist history ────────────────────────────
{
  const NOW = 1000;
  // Upward sweep inside the 150 ms window (window = [850, 1000]): displacement
  // (0, +0.5) in 120 ms → dy/dt ≈ 0.0042 /ms which clears the 0.005 /ms dead
  // zone at the default 150 ms window.
  const up = [{ t: 880, x: 0.5, y: 0.2 }, { t: 990, x: 0.5, y: 0.7 }];
  const vUp = gloveMotionVector(up, NOW);
  assert.ok(vUp !== null && vUp.y > 0 && Math.abs(vUp.x) < 1e-9, `upward sweep → +y vector (got ${JSON.stringify(vUp)})`);
  // Horizontal sweep → +x vector.
  const right = [{ t: 880, x: 0.2, y: 0.5 }, { t: 990, x: 0.9, y: 0.5 }];
  const vRight = gloveMotionVector(right, NOW);
  assert.ok(vRight !== null && vRight.x > 0 && Math.abs(vRight.y) < 1e-9, `rightward sweep → +x vector (got ${JSON.stringify(vRight)})`);
  // Stationary history → null (dead zone).
  assert.equal(gloveMotionVector([{ t: 880, x: 0.5, y: 0.5 }, { t: 990, x: 0.5, y: 0.5 }], NOW), null, "stationary → null");
  // Empty / null / single-sample history → null.
  assert.equal(gloveMotionVector([], NOW), null, "empty history → null");
  assert.equal(gloveMotionVector(null, NOW), null, "null history → null");
  assert.equal(gloveMotionVector([{ t: 990, x: 0.5, y: 0.5 }], NOW), null, "single sample → null");
  // Samples outside the lookback window are ignored (window = [850, 1000]).
  const stale = [{ t: 840, x: 0.2, y: 0.2 }, { t: 845, x: 0.9, y: 0.9 }];
  assert.equal(gloveMotionVector(stale, NOW), null, "stale-only history (outside 150 ms window) → null");
  // Sub-dead-zone displacement (dy/dt = 0.005/150 ≈ 0.00033/ms) → null.
  const tiny = [{ t: 880, x: 0.5, y: 0.5 }, { t: 990, x: 0.5, y: 0.55 }];
  assert.equal(gloveMotionVector(tiny, NOW), null, "tiny displacement below dead zone → null");
  // Window constant sanity.
  assert.equal(GLOVE_MOTION_WINDOW_MS, 150, "motion lookback window is 150 ms");
  console.log("PASS: motion vector derivation (direction, dead zone, window, degenerate histories)");
}

// ── Easing curves ──────────────────────────────────────────────────────────
{
  const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `expected ${b}, got ${a}`);
  // Endpoints hold for every curve.
  for (const type of ["linear", "easeIn", "easeOut", "easeInOut"]) {
    close(easeValue(0, type), 0, 0);
    close(easeValue(1, type), 1, 0);
  }
  // Midpoint values.
  close(easeValue(0.5, "linear"), 0.5, 0);
  close(easeValue(0.5, "easeIn"), 0.25, 0);
  close(easeValue(0.5, "easeOut"), 0.75, 0);
  close(easeValue(0.5, "easeInOut"), 0.5, 0);
  // Linear is monotonic and identity.
  let prev = easeValue(0, "linear");
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const v = easeValue(t, "linear");
    assert.ok(v > prev, "linear must be strictly increasing");
    prev = v;
  }
  // Curvature signatures at t=0.25 (all monotone increasing on [0,1]).
  const mono = (type) => { let p = easeValue(0, type); for (let t = 0.1; t <= 1.0001; t += 0.1) { const v = easeValue(t, type); assert.ok(v >= p, `${type} must be non-decreasing`); p = v; } };
  mono("easeIn"); mono("easeOut"); mono("easeInOut");
  assert.ok(easeValue(0.25, "easeIn") < 0.25, "easeIn starts slow");
  assert.ok(easeValue(0.25, "easeOut") > 0.25, "easeOut starts fast");
  // Clamping at the boundaries.
  close(easeValue(-1, "easeOut"), 0, 0);
  close(easeValue(2, "easeIn"), 1, 0);
  // Bad input rejected.
  assert.throws(() => easeValue(NaN, "linear"), TypeError, "NaN t rejected");
  assert.throws(() => easeValue(0.5, "backOut"), TypeError, "unknown ease type rejected");
  console.log("PASS: easing curves (endpoints, midpoints, monotonicity, clamping, errors)");
}

// ── Tracker: per-hand eased rotation ───────────────────────────────────────
{
  const t = createGloveRotationTracker();
  // 1) Persists across ticks (easeOut over 100 ms toward -70).
  let v = t.tick("left", -70, 0, "easeOut", 100);
  assert.ok(Math.abs(v) < 1e-9, "fresh hand starts at 0");
  v = t.tick("left", -70, 50, "easeOut", 100);
  assert.ok(v > -70 && v < 0, "mid-ease value strictly between start and target");
  const half = v;
  v = t.tick("left", -70, 100, "easeOut", 100);
  assert.equal(v, -70, "reaches target at t=duration");
  v = t.tick("left", -70, 500, "easeOut", 100);
  assert.equal(v, -70, "stays at target after completion (persisted state)");
  // 2) Per-hand independence: right hand untouched by left's ticks.
  assert.equal(t.tick("right", 0, 500, "easeOut", 100), 0, "right hand independent of left hand");
  t.tick("left", 60, 600, "easeOut", 100); // left retargets
  const r = t.tick("right", 60, 600, "easeOut", 100);
  assert.ok(r === 0, "right hand still at its own target while left moves");
  // 3) Retargets mid-ease: start fresh from the CURRENT eased value.
  const t2 = createGloveRotationTracker();
  t2.tick("left", -70, 0, "linear", 100);
  const mid = t2.tick("left", -70, 50, "linear", 100); // -35
  assert.ok(Math.abs(mid - -35) < 1e-9, `linear midpoint is -35 (got ${mid})`);
  const retarget = t2.tick("left", -10, 50, "linear", 100); // retarget from -35 to -10 at t=50
  assert.equal(retarget, -35, "retarget mid-ease starts from the current eased value (no snap)");
  assert.ok(Math.abs(t2.tick("left", -10, 150, "linear", 100) - -10) < 1e-9, "retargeted ease completes at the new target");
  // 4) Zero/negative duration snaps.
  const t3 = createGloveRotationTracker();
  assert.equal(t3.tick("right", -60, 0, "easeIn", 0), -60, "durationMs=0 snaps to target");
  // 5) reset() clears every hand.
  const t4 = createGloveRotationTracker();
  t4.tick("left", -70, 0, "easeOut", 100);
  t4.tick("right", 60, 0, "easeOut", 100);
  t4.reset();
  assert.equal(t4.tick("left", 0, 50, "easeOut", 100), 0, "left reset to 0 after reset()");
  assert.equal(t4.tick("right", 0, 50, "easeOut", 100), 0, "right reset to 0 after reset()");
  // 6) Bad input rejected.
  assert.throws(() => t4.tick("nose", 0, 0, "linear", 100), TypeError, "unknown hand rejected");
  console.log("PASS: tracker (persistence, mid-ease retarget, per-hand independence, snap, reset, errors)");
}

// ── End-to-end: selection → angle → eased record value ─────────────────────
{
  // Replicates the C3 pipeline: upcoming hook (right hand) → hookR (-60 deg),
  // eased easeOut over 100 ms; record rotation = base (0) + eased state.
  const angle = { straight: 0, uppercut: -35, hookL: 60, hookR: -60, guard: -70 };
  const state = selectGloveState("right", { x: -0.9, y: 0.1 }, { kind: "punch", hand: "right", family: "hook", beatCenterMs: 120 });
  assert.equal(state, "hookR");
  const tracker = createGloveRotationTracker();
  const v0 = tracker.tick("right", angle[state], 0, "easeOut", 100);
  assert.equal(v0, 0, "first tick at t=0 starts at base 0 deg");
  // easeOut, t=(50-0)/100=0.5 → eased 0.75 of the way from 0 to -60 → -45 deg.
  const deg = tracker.tick("right", angle[state], 50, "easeOut", 100);
  assert.ok(Math.abs(deg - -45) < 1e-9, `eased hookR at t=0.5 is -45 deg (got ${deg})`);
  const done = tracker.tick("right", angle[state], 100, "easeOut", 100);
  assert.ok(Math.abs(done - -60) < 1e-9, "reaches the hookR target -60 deg at t=1.0");
  console.log("PASS: end-to-end selection → eased per-hand rotation");
}

console.log("\nAll glove rotation state validations passed.");
