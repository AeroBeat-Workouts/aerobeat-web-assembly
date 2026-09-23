// @ts-check
// 0.0.63 C3 (bead 2m10): unit oracle for boxing glove rotation states —
// motion x upcoming-beat selection, the four ease curves, and the per-hand
// eased-rotation tracker. Plain node; exercises the pure module
// `src/glove-rotation-states.js` directly. Plan:
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md (L-C, D3).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GLOVE_MOTION_DEAD_ZONE,
  GLOVE_MOTION_WINDOW_MS,
  boxingUpcomingActions,
  createGloveRotationTracker,
  easeValue,
  gloveMotionVector,
  selectGloveState
} from "../src/glove-rotation-states.js";
import { GLOVE_STATE_KEYS, validateEquipmentConfig } from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

// ── Selection: upcoming-beat PRIMARY path + validated-config closure ───────
{
  const states = validateEquipmentConfig(equipmentConfigDefaults).boxing.glove.states;
  const selections = [
    selectGloveState("left", null, { kind: "punch", hand: "left", family: "straight", beatCenterMs: 1 }),
    selectGloveState("right", null, { kind: "punch", hand: "right", family: "uppercut", beatCenterMs: 1 }),
    selectGloveState("left", null, { kind: "punch", hand: "left", family: "hook", beatCenterMs: 1 }),
    selectGloveState("right", null, { kind: "punch", hand: "right", family: "hook", beatCenterMs: 1 }),
    selectGloveState("left", null, { kind: "guard", hand: "both", family: "guard", beatCenterMs: 1 }),
    selectGloveState("left", null, null),
    selectGloveState("left", { x: 0.1, y: 0.8 }, null),
    selectGloveState("left", { x: 0.8, y: 0.1 }, null),
    selectGloveState("right", { x: -0.8, y: 0.1 }, null),
    selectGloveState("left", { x: 0.5, y: 0.5 }, null)
  ];
  for (const state of selections) {
    assert.equal(Object.hasOwn(states, state), true, `selector result ${state} must index validated config`);
    assert.deepEqual(Object.keys(states[state].rotationEulerDeg), ["x", "y", "z"], `selector result ${state} must index canonical XYZ rotation`);
  }
  assert.deepEqual([...new Set(selections)], Object.keys(states), "representative selector branches close over every validated state key");
  assert.deepEqual(GLOVE_STATE_KEYS, Object.keys(states), "exported state keys derive from validated config order");
  // The upcoming action dominates the motion vector: an upward motion plus an
  // upcoming straight must still yield straight (Derrick's camera-vs-real-space
  // insight: the upcoming beat is the PRIMARY selector).
  assert.equal(selectGloveState("left", { x: 0, y: 0.9 }, { kind: "punch", hand: "left", family: "straight", beatCenterMs: 1 }), "straight", "upcoming beat overrides motion");
  console.log("PASS: every selector branch closes over finite validated state rotations");
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
  assert.equal(selectGloveState("left", { x: 0.1, y: 0.8 }, null), "uppercut", "upward-dominant → uppercut");
  assert.equal(selectGloveState("right", { x: -0.1, y: 0.8 }, null), "uppercut", "upward-dominant (right hand) → uppercut");
  // Dominant horizontal → hook, side by hand.
  assert.equal(selectGloveState("left", { x: 0.8, y: 0.1 }, null), "hookL", "leftward/rightward-dominant on left hand → hookL");
  assert.equal(selectGloveState("right", { x: -0.8, y: 0.1 }, null), "hookR", "horizontal-dominant on right hand → hookR");
  assert.equal(selectGloveState("left", { x: -0.8, y: 0.1 }, null), "hookL", "negative-x sweep on left hand → hookL");
  // Fast straight-ish / diagonal motion → straight.
  assert.equal(selectGloveState("left", { x: 0.5, y: 0.5 }, null), "straight", "diagonal fast motion → straight");
  assert.equal(selectGloveState("right", { x: 0.5, y: 0.5 }, null), "straight", "equal-axis fast motion → straight (1.0x ratio, below the 1.2x dominance)");
  // At exactly the 1.2x dominance boundary the dominant axis wins: |y|/|x| = 1.25 ≥ 1.2 → uppercut (NOT a "below-dominance" case — the ratio IS the test).
  assert.equal(selectGloveState("right", { x: 0.4, y: 0.5 }, null), "uppercut", "upward-dominant by the 1.2x rule (0.5/0.4 = 1.25 ≥ 1.2) → uppercut");
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

// ── Upcoming target semantics + single-frame render projection ─────────────
{
  const targets = Object.freeze([
    Object.freeze({ kind: "punch", hand: "left", family: "hook", beatCenterMs: 1400 }),
    Object.freeze({ kind: "guard", hand: "both", family: "guard", beatCenterMs: 1300 }),
    Object.freeze({ kind: "punch", hand: "right", family: "uppercut", beatCenterMs: 1200 }),
    Object.freeze({ kind: "punch", hand: "left", family: "straight", beatCenterMs: 900 }),
    Object.freeze({ kind: "punch", hand: "right", family: "unknown", beatCenterMs: 1100 }),
    Object.freeze({ kind: "punch", hand: "left", family: "uppercut", beatCenterMs: 1601 })
  ]);
  assert.deepEqual(boxingUpcomingActions(targets, 1000, 500), {
    left: { kind: "guard", hand: "both", family: "guard", beatCenterMs: 1300 },
    right: { kind: "punch", hand: "right", family: "uppercut", beatCenterMs: 1200 }
  }, "earliest in-window target semantics remain hand-specific with bilateral guards");
  assert.deepEqual(boxingUpcomingActions(targets, 1200, 0), {
    left: null,
    right: { kind: "punch", hand: "right", family: "uppercut", beatCenterMs: 1200 }
  }, "upcoming interval remains inclusive at both boundaries");

  const assemblySource = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const renderGameplayBody = assemblySource.match(/\n  renderGameplay\(graph = this\.graph\) \{(?<body>[\s\S]*?)\n  \}\n\n  \/\*\* @param \{ReturnType<typeof createAeroGameServiceGraph>\} \[graph\] \*\//u)?.groups?.body ?? "";
  assert.notEqual(renderGameplayBody, "", "renderGameplay source body must be found");
  assert.equal((renderGameplayBody.match(/this\.rendererFrame\(\)/gu) ?? []).length, 1, "one rendererFrame projection per renderGameplay call");
  assert.match(renderGameplayBody, /const frame = this\.rendererFrame\(\)/u, "renderGameplay owns the single frame projection");
  assert.match(renderGameplayBody, /this\.computeBoxingStateRotations\(graph, frame\)/u, "Boxing state selection receives the rendered frame");
  assert.match(renderGameplayBody, /renderGameplayFrameWithCursorsAndEquipment\(frame,/u, "renderer consumes that same frame object");
  const boxingRotationBody = assemblySource.match(/\n  computeBoxingStateRotations\(graph, frame\) \{(?<body>[\s\S]*?)\n  \}\n\n  \/\*\*/u)?.groups?.body ?? "";
  assert.notEqual(boxingRotationBody, "", "computeBoxingStateRotations source body must be found");
  assert.doesNotMatch(boxingRotationBody, /rendererFrame\(/u, "Boxing state selection must not project another renderer frame");
  assert.match(boxingRotationBody, /boxingUpcomingActions\(frame\.targets, contentNowMs,/u, "Boxing target selection uses the frame's content timeline");
  assert.match(boxingRotationBody, /gloveMotionVector\(history \? history\[role\] : null, trackerNowMs\)/u, "motion history uses the gameplay timestamp domain");
  console.log("PASS: Boxing reuses one renderer frame without changing target-selection semantics");
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

// ── Tracker: fixed-endpoint XYZ quaternion easing ──────────────────────────
{
  const target = Object.freeze({ x:30, y:-20, z:170 });
  const dense = createGloveRotationTracker();
  dense.tick("left", target, 0, "linear", 100);
  for (let now = 10; now < 100; now += 10) dense.tick("left", target, now, "linear", 100);
  const denseEnd = dense.tick("left", target, 100, "linear", 100);
  const sparse = createGloveRotationTracker();
  sparse.tick("left", target, 0, "linear", 100);
  const sparseEnd = sparse.tick("left", target, 100, "linear", 100);
  assert.deepEqual(denseEnd, sparseEnd, "dense and sparse cadences resolve identically");
  for (const axis of ["x", "y", "z"]) assert.ok(Math.abs(denseEnd[axis] - target[axis]) < 1e-9, `${axis} reaches target`);

  const shortest = createGloveRotationTracker();
  shortest.tick("left", { x:0, y:0, z:170 }, 0, "linear", 0);
  shortest.tick("left", { x:0, y:0, z:-170 }, 10, "linear", 100);
  const halfway = shortest.tick("left", { x:0, y:0, z:-170 }, 60, "linear", 100);
  assert.ok(Math.abs(Math.abs(halfway.z) - 180) < 1e-9, `+170→-170 follows 20° shortest path (got ${halfway.z})`);

  const retarget = createGloveRotationTracker();
  retarget.tick("left", { x:0, y:0, z:90 }, 0, "linear", 100);
  const before = retarget.tick("left", { x:0, y:0, z:90 }, 50, "linear", 100);
  const atRetarget = retarget.tick("left", { x:45, y:20, z:-90 }, 50, "linear", 100);
  assert.deepEqual(atRetarget, before, "retarget captures the evaluated pose without snapping");
  const done = retarget.tick("left", { x:45, y:20, z:-90 }, 150, "linear", 100);
  assert.ok(Math.abs(done.x - 45) < 1e-9 && Math.abs(done.y - 20) < 1e-9 && Math.abs(done.z + 90) < 1e-9);

  retarget.reset();
  assert.deepEqual(retarget.tick("left", { x:0, y:0, z:0 }, 200, "linear", 100), { x:0, y:0, z:0 });
  assert.throws(() => retarget.tick("nose", target, 0, "linear", 100), TypeError);
  console.log("PASS: fixed-endpoint XYZ quaternion tracker is shortest-path, cadence-independent, retargetable, and resettable");
}

console.log("\nAll glove rotation state validations passed.");
