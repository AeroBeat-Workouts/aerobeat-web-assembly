// @ts-check
// 0.0.63 C4 (bead 6ax2): unit oracle for the FLOW saber grid-zone direction
// map — the distance-blended continuous zone vector field, the neutral center
// zone, the per-hand eased direction tracker, and the shared easing curves
// (imported from their new home, `src/easing.js`).
//
// Plain node; exercises the pure modules `src/saber-zone-direction.js`,
// `src/easing.js`, and the `flowZoneDirections` parameter of
// `gameplayEquipmentRecords` directly. Plan:
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md (L-C, D4).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SABER_ZONE_ANCHORS,
  _zoneWeights,
  createSaberDirectionTracker,
  zoneAngleToVector,
  zoneDirection
} from "../src/saber-zone-direction.js";
import { easeValue } from "../src/easing.js";
import {
  equipmentConfigDefaults
} from "../src/equipment-config-defaults.js";
import { gameplayEquipmentRecords } from "../src/gameplay-equipment-records.js";

const DEG = 180 / Math.PI;
const rad = (v) => Math.atan2(v.y, v.x) * DEG;
const norm = (a) => { let x = a % 360; if (x > 180) x -= 360; if (x <= -180) x += 360; return x; };
const angDelta = (a, b) => norm(a - b);
// True when vector v points to `expectedDeg` (0..360 convention). The angle
// is evaluated by the SIGNED-OFF in-plane rule: 90 = blade up, 270 = down,
// 180 = left, 0 = right — i.e. atan2(y, x) taken in the [0°, 360°) range.
const atAngle = (v, expectedDeg, tol = 1e-6) => {
  let a = Math.atan2(v.y, v.x) * DEG;
  if (a < 0) a += 360;
  const d = Math.min(Math.abs(a - expectedDeg), 360 - Math.abs(a - expectedDeg));
  return d <= tol;
};
const close = (a, b, tol = 1e-9, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b}, got ${a}`);
const vecClose = (v, x, y, tol = 1e-9, msg = "") => {
  assert.ok(Math.abs(v.x - x) <= tol, `${msg} x: expected ${x}, got ${v.x}`);
  assert.ok(Math.abs(v.y - y) <= tol, `${msg} y: expected ${y}, got ${v.y}`);
};

// Defaults under test (the config foundation values).
const CFG = equipmentConfigDefaults.flow.saber;
const ZONES = CFG.zones;
const R = CFG.blendRadius;
const FB = Object.freeze({ x: 1, y: 0 }); // motion fallback: +x (plus-x)
// A non-axis fallback used to prove neutrality is "keep the motion direction",
// not "always +x".
const FB2 = Object.freeze({ x: 0.6, y: 0.8 }); // 53.130102 deg

// ════════════════════════════════════════════════════════════════════════════
// (a) Each edge anchor position returns its zone angle (within epsilon).
// ════════════════════════════════════════════════════════════════════════════
{
  const cases = [
    ["edgeTop", 0.5, 1.0, 90],
    ["edgeBottom", 0.5, 0.0, 270],
    ["edgeLeft", 0.0, 0.5, 180],
    ["edgeRight", 1.0, 0.5, 0],
  ];
  for (const [key, x, y, expectedDeg] of cases) {
    const v = zoneDirection(x, y, FB, ZONES, R);
    assert.ok(atAngle(v, expectedDeg), `${key} anchor angle must be ${expectedDeg} deg (got vector ${JSON.stringify(v)})`);
  }
  // Anchor constants are the signed-off positions.
  assert.deepEqual(SABER_ZONE_ANCHORS.edgeTop, { x: 0.5, y: 1.0 });
  assert.deepEqual(SABER_ZONE_ANCHORS.edgeBottom, { x: 0.5, y: 0.0 });
  assert.deepEqual(SABER_ZONE_ANCHORS.edgeLeft, { x: 0.0, y: 0.5 });
  assert.deepEqual(SABER_ZONE_ANCHORS.edgeRight, { x: 1.0, y: 0.5 });
  assert.deepEqual(SABER_ZONE_ANCHORS.center, { x: 0.5, y: 0.5 });
  console.log("PASS: (a) edge anchors return their zone angles; anchor constants");
}

// ════════════════════════════════════════════════════════════════════════════
// (b) Center position returns EXACTLY the fallback direction (neutral).
// ════════════════════════════════════════════════════════════════════════════
{
  assert.equal(ZONES.center.headingDeg, null, "default center zone must be NEUTRAL (null)");
  assert.deepEqual(zoneDirection(0.5, 0.5, FB, ZONES, R), FB, "center + plus-x fallback → EXACTLY +x");
  // With a non-axis motion direction the neutral center must return that
  // direction EXACTLY (bit-identical), not merely "close to it".
  assert.deepEqual(zoneDirection(0.5, 0.5, FB2, ZONES, R), FB2, "center + oblique fallback → EXACTLY the fallback vector");
  // Weight identity at the center anchor: every edge weight is 0, center is 1.
  const w = _zoneWeights(0.5, 0.5, R);
  close(w.edgeTop, 0, 1e-12); close(w.edgeBottom, 0, 1e-12);
  close(w.edgeLeft, 0, 1e-12); close(w.edgeRight, 0, 1e-12);
  close(w.center, 1, 1e-12);
  // Weights always sum to 1 (convex combination → continuous field).
  for (const [x, y] of [[0.5, 1.0], [0.1, 0.9], [0.5, 0.15], [0.2, 0.3], [1.0, 0.0], [0.0, 1.0], [0.33, 0.67], [0.75, 0.25]]) {
    const wgt = _zoneWeights(x, y, R);
    const s = wgt.edgeTop + wgt.edgeBottom + wgt.edgeLeft + wgt.edgeRight + wgt.center;
    close(s, 1, 1e-9, `weights sum to 1 at (${x},${y})`);
    for (const k of ["edgeTop", "edgeBottom", "edgeLeft", "edgeRight", "center"]) {
      assert.ok(wgt[k] >= 0 && wgt[k] <= 1, `weight ${k} in [0,1] at (${x},${y})`);
    }
  }
  console.log("PASS: (b) center is NEUTRAL — returns the fallback direction exactly; weights form a convex partition");
}

// ════════════════════════════════════════════════════════════════════════════
// (c) Continuity: fine sample paths center→top and center→right. Consecutive
//     angles change by less than the step bound (no jumps); the path is
//     monotone toward the edge angle.
// ════════════════════════════════════════════════════════════════════════════
{
    const walk = (name, x0, y0, x1, y1, n, targetDeg) => {
    // Monotone: the angle-distance to the target is non-increasing at every
    // sample. This is the geometric no-jump test that is immune to the ±180°
    // branch cut of atan2 (which a raw consecutive-step bound is NOT — e.g.
    // on center→bottom where the field sits exactly on the branch at start).
    let dist = Math.abs(angDelta(rad(zoneDirection(x0, y0, FB, ZONES, R)), targetDeg));
    let p = null;
    for (let i = 1; i <= n; i += 1) {
      const t = i / n;
      p = zoneDirection(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, FB, ZONES, R);
      const d2 = Math.abs(angDelta(rad(p), targetDeg));
      assert.ok(d2 <= dist + 1e-9, `${name}: distance to target must not increase (t=${t.toFixed(2)}: ${d2.toFixed(2)} > ${dist.toFixed(2)})`);
      dist = d2;
    }
    // Endpoint: after the full walk the direction IS the edge angle (per the
    // signed-off 0..360 convention: 90 up, 270 down, 180 left, 0 right).
    assert.ok(atAngle(p, targetDeg), `${name} endpoint must be the edge angle ${targetDeg} deg (got ${JSON.stringify(p)})`);
  };
  walk("center→top", 0.5, 0.5, 0.5, 1.0, 50, 90);
  walk("center→right", 0.5, 0.5, 1.0, 0.5, 50, 0);
  walk("center→bottom", 0.5, 0.5, 0.5, 0.0, 50, 270);
  walk("center→left", 0.5, 0.5, 0.0, 0.5, 50, 180);
}
// The two paths the signed-off semantics name (center→top, center→right):
// enforce an explicit consecutive-step bound (15 deg; a hard zone boundary
// would show a ~45-90 deg step).
{
  const stepBound = (name, x0, y0, x1, y1, n) => {
    let prev = zoneDirection(x0, y0, FB, ZONES, R);
    let maxStep = 0;
    for (let i = 1; i <= n; i += 1) {
      const t = i / n;
      const v = zoneDirection(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, FB, ZONES, R);
      maxStep = Math.max(maxStep, Math.abs(angDelta(rad(v), rad(prev))));
      prev = v;
    }
    assert.ok(maxStep < 15, `${name}: max consecutive step ${maxStep.toFixed(2)} deg >= 15 deg — discontinuity`);
    return maxStep;
  };
  const s1 = stepBound("center→top", 0.5, 0.5, 0.5, 1.0, 50);
  const s2 = stepBound("center→right", 0.5, 0.5, 1.0, 0.5, 50);
  console.log(`PASS: (c) continuity — all four center→edge paths monotone (distance to target never increases); center→top / center→right max consecutive steps ${s1.toFixed(2)}° / ${s2.toFixed(2)}° (< 15 deg no-jump bound)`);
}

// ════════════════════════════════════════════════════════════════════════════
// (d) Mirror symmetry with the symmetric (default) config.
//     Invariants (all provable, independent of the neutral fallback choice):
//     1. Weight symmetry: wLR(1-x,y) swaps edgeLeft/edgeRight (top/bottom/
//        center preserved); wUD(x,1-y) swaps edgeTop/edgeBottom.
//     2. Under the NEUTRAL center (default), the fallback vector enters with
//        the SAME weight everywhere a mirror maps onto, so:
//        vLR(1-x,y).x = -v(x,y).x and vUD(x,1-y).y = -v(x,y).y.
//     3. Full-vector symmetry on points with edge weight > 0 (there the
//        center weight is 0 because an edge anchor within blendRadius means
//        distance-to-center <= blendRadius < 0.5, so w_center = 0): the
//        mirrored vector is the exact sign-mirror.
// ════════════════════════════════════════════════════════════════════════════
{
  const pts = [[0.15, 0.3], [0.2, 0.7], [0.35, 0.1], [0.8, 0.6], [0.5, 0.25], [0.7, 0.9], [0.05, 0.5], [0.9, 0.15], [0.5, 0.5], [0.3, 0.8]];
  for (const [x, y] of pts) {
    const w = _zoneWeights(x, y, R);
    const wlr = _zoneWeights(1 - x, y, R);
    const wud = _zoneWeights(x, 1 - y, R);
    // Left/right mirror swaps the left and right edge weights.
    close(wlr.edgeLeft, w.edgeRight, 1e-12, `LR edgeLeft at (${x},${y})`);
    close(wlr.edgeRight, w.edgeLeft, 1e-12, `LR edgeRight at (${x},${y})`);
    close(wlr.edgeTop, w.edgeTop, 1e-12, `LR edgeTop at (${x},${y})`);
    close(wlr.edgeBottom, w.edgeBottom, 1e-12, `LR edgeBottom at (${x},${y})`);
    close(wlr.center, w.center, 1e-12, `LR center at (${x},${y})`);
    // Up/down mirror swaps the top and bottom edge weights.
    close(wud.edgeTop, w.edgeBottom, 1e-12, `UD edgeTop at (${x},${y})`);
    close(wud.edgeBottom, w.edgeTop, 1e-12, `UD edgeBottom at (${x},${y})`);
    close(wud.edgeLeft, w.edgeLeft, 1e-12, `UD edgeLeft at (${x},${y})`);
    close(wud.edgeRight, w.edgeRight, 1e-12, `UD edgeRight at (${x},${y})`);
    close(wud.center, w.center, 1e-12, `UD center at (${x},${y})`);
  }
  // Invariant 2 (edge-dominated points, where the field is NOT the neutral
  // fallback): the left/right mirror flips the x-component and preserves y.
  // Edge-dominated = at least one edge weight > 0 AND w_center < 1 (with the
  // default map, any non-zero edge weight implies w_center < 1).
  for (const [x, y] of pts) {
    const w = _zoneWeights(x, y, R);
    const edgeSum = w.edgeTop + w.edgeBottom + w.edgeLeft + w.edgeRight;
    if (edgeSum <= 1e-9 || Math.abs(w.center - 1) < 1e-12) continue; // pure-neutral: both mirror points return the same fallback vector
    const v = zoneDirection(x, y, FB, ZONES, R);
    const vmx = zoneDirection(1 - x, y, FB, ZONES, R);
    close(vmx.x, -v.x, 1e-9, `LR vector x at (${x},${y})`);
    close(vmx.y, v.y, 1e-9, `LR vector y at (${x},${y})`);
    const vmy = zoneDirection(x, 1 - y, FB, ZONES, R);
    close(vmy.y, -v.y, 1e-9, `UD vector y at (${x},${y})`);
    close(vmy.x, v.x, 1e-9, `UD vector x at (${x},${y})`);
  }
  // Invariant 3: full-vector mirror symmetry at the four pure edge anchors
  // (single weight 1, no fallback involved).
  for (const [x, y] of [[0.5, 1.0], [0.5, 0.0], [0.0, 0.5], [1.0, 0.5]]) {
    const v = zoneDirection(x, y, FB, ZONES, R);
    const vmx = zoneDirection(1 - x, y, FB, ZONES, R);
    const vmy = zoneDirection(x, 1 - y, FB, ZONES, R);
    close(vmx.x, -v.x, 1e-9, `LR anchor x at (${x},${y})`);
    close(vmx.y, v.y, 1e-9, `LR anchor y at (${x},${y})`);
    close(vmy.x, v.x, 1e-9, `UD anchor x at (${x},${y})`);
    close(vmy.y, -v.y, 1e-9, `UD anchor y at (${x},${y})`);
  }
  console.log("PASS: (d) mirror symmetry — weight partition, edge-dominated component flips, and full-vector symmetry at anchors (LR + UD)");
}

// ════════════════════════════════════════════════════════════════════════════
// (e) All-5-zones-set config (center non-null): center returns the CENTER
//     angle when away from edges (and away from the fallback).
// ════════════════════════════════════════════════════════════════════════════
{
  const z5 = Object.freeze({
    edgeTop: Object.freeze({ headingDeg: 90 }),
    edgeBottom: Object.freeze({ headingDeg: 270 }),
    edgeLeft: Object.freeze({ headingDeg: 180 }),
    edgeRight: Object.freeze({ headingDeg: 0 }),
    center: Object.freeze({ headingDeg: 45 })
  });
  // At the center anchor every edge weight is 0 → pure center angle, and it
  // must be the center angle, NOT the fallback (45 ≠ 0).
  const v = zoneDirection(0.5, 0.5, FB, z5, R);
  close(rad(v), 45, 1e-6, "all-5 config: center returns the center angle");
  // Edge anchors still return their edge angles (center weight is 0 there).
  assert.ok(atAngle(zoneDirection(0.5, 1.0, FB, z5, R), 90), "all-5 config: edgeTop anchor");
  assert.ok(atAngle(zoneDirection(1.0, 0.5, FB, z5, R), 0), "all-5 config: edgeRight anchor");
  // With the all-5 config (center = 45°), moving from center toward edgeTop:
  //   - Inside blendRadius of any edge anchor: no change (all weights at
  //     center anchor are zero by construction).
  //   - At the boundary (distance == R): edge weight goes to exactly 0; the
  //     angle stays at 45° (continuity, no jump).
  //   - Just inside the blend band (distance < R but > 0 for edgeTop): the
  //     field starts rotating from 45° toward 90°. The first non-trivial
  //     sample is at d ≈ 0.14 (just inside R=0.15), where w_edge ≈ 0.074.
  const vBoundary = zoneDirection(0.5, 0.5 + R, FB, z5, R); // d=R → w=0 exactly
  assert.ok(Math.abs(rad(vBoundary) - 45) < 1e-3, `all-5: at boundary d=R, angle stays at 45° (got ${rad(vBoundary).toFixed(6)})`);
  // A point just INSIDE the blend radius (distance 0.14 < 0.15):
  const yInside = 1.0 - 0.14; // 0.86; distance from center = 0.36 → no, this is for edgeTop
  // Actually: (0.5, 0.86) is distance 0.36 from center — NOT inside blend radius.
  // Correct: we need (0.5, y) where |y - 1.0| < 0.15, i.e. y in (0.85, 1.0).
  const aNearTop = rad(zoneDirection(0.5, 0.90, FB, z5, R));  // d_to_top=0.10 < R
  const aMidTop  = rad(zoneDirection(0.5, 0.95, FB, z5, R));  // d_to_top=0.05 < R
  assert.ok(aNearTop >= 45 && aNearTop <= 90, `all-5: approaching edgeTop from below, angle between 45 and 90 (got ${aNearTop.toFixed(2)})`);
  assert.ok(aMidTop >= aNearTop, `all-5: closer to edgeTop, angle moves further toward 90° (${aMidTop.toFixed(2)} ≥ ${aNearTop.toFixed(2)})`);
  assert.ok(aMidTop > 45, `all-5: inside the blend band the angle moved off 45° (got ${aMidTop.toFixed(4)})`);
  console.log("PASS: (e) all-5-zones-set config — center returns the center angle when away from edges");
}

// ════════════════════════════════════════════════════════════════════════════
// (f) Degenerates: opposing-zone cancel → fallback; out-of-range clamp;
//     blendRadius=0 hard zones (still correct at anchors).
// ════════════════════════════════════════════════════════════════════════════
{
  // f1: EXACT symmetric cancel. With blendRadius=0.25, every point in the
  // open square (0.25..0.75) × (0.25..0.75) sits at distance < 0.25 from ALL
  // four edge anchors; by symmetry all four weights are EQUAL. At the exact
  // center of that square, (0.5, 0.5), the distance is 0.25 → smoothstep gives
  // w = 0 for each edge — but ANY interior point (e.g. (0.5, 0.6)) has
  // d_to_top < 0.25 and d_to_bottom < 0.25 while d_to_left/right > 0.25…
  // The cleanest provable cancel: the geometric CENTER of the grid, with
  // blendRadius set so that all four edge weights are EQUAL AND non-zero.
  // At (0.5, 0.5) the distance to every edge anchor is exactly 0.5, so we need
  // R ≥ 0.5. Use R=0.5: w_edge = 1 − smoothstep(0, 0.5, 0.5) = 0 again!
  // The only way to get equal non-zero edge weights at a single point is a
  // point equidistant from all four anchors with distance d < R.
  // The unique such point is (0.5, 0.5) with d = 0.5, so we MUST have R > 0.5.
  // Use R = 1.0: w_edge = 1 − smoothstep(0, 1.0, 0.5) = 1 − 0.5 = 0.5. ✓
  const wc = _zoneWeights(0.5, 0.5, 1.0);
  for (const k of ["edgeTop", "edgeBottom", "edgeLeft", "edgeRight"]) close(wc[k], 0.5, 1e-9, `cancel weight ${k}`);
  close(wc.center, 0, 1e-9, "cancel center weight");
  assert.deepEqual(zoneDirection(0.5, 0.5, FB, ZONES, 1.0), FB, "exact opposing-zone cancel (br=1.0, all w=0.5) → fallback +x");
  assert.deepEqual(zoneDirection(0.5, 0.5, FB2, ZONES, 1.0), FB2, "exact cancel honors an oblique fallback");
  // f2: Out-of-range positions clamp to [0,1] BEFORE the field is evaluated.
  assert.deepEqual(zoneDirection(10, 10, FB, ZONES, R), zoneDirection(1, 1, FB, ZONES, R), "upper-out clamps to (1,1)");
  assert.deepEqual(zoneDirection(-4, 2, FB, ZONES, R), zoneDirection(0, 1, FB, ZONES, R), "lower-out clamps to (0,1)");
  assert.deepEqual(zoneDirection(1, 1, FB, ZONES, R), zoneDirection(1.7, 0.2, FB, ZONES, R), "any >1-x clamps to the same (1,1) corner");
  // f3: blendRadius=0 → hard zones (nearest anchor wins outright), anchors
  //     still exact.
  assert.ok(atAngle(zoneDirection(0.5, 1.0, FB, ZONES, 0), 90), "br=0 edgeTop anchor exact");
  assert.ok(atAngle(zoneDirection(0.5, 0.0, FB, ZONES, 0), 270), "br=0 edgeBottom anchor exact");
  assert.ok(atAngle(zoneDirection(0.0, 0.5, FB, ZONES, 0), 180), "br=0 edgeLeft anchor exact");
  assert.ok(atAngle(zoneDirection(1.0, 0.5, FB, ZONES, 0), 0), "br=0 edgeRight anchor exact");
  // Near the top edge but off the anchor: the hard field stays at the fallback
  // (center weight 1) — no soft pull — and exactly at the anchor it is the
  // zone angle: the hard discontinuity of blendRadius=0 is intended.
  assert.deepEqual(zoneDirection(0.5, 0.99, FB, ZONES, 0), FB, "br=0: off-anchor hard zone → fallback (center weight 1)");
  const wh = _zoneWeights(0.5, 1.0, 0);
  close(wh.edgeTop, 1, 1e-12, "br=0 anchor weight is 1");
  close(wh.center, 0, 1e-12, "br=0 anchor center weight is 0");
  console.log("PASS: (f) degenerate cancel → fallback; out-of-range clamps; blendRadius=0 hard zones exact at anchors");
}

// ════════════════════════════════════════════════════════════════════════════
// (g) Easing: shared src/easing.js curves (imported from the NEW home) at
//     t=0/0.5/1; tracker persistence / retarget / reset / snap /
//     near-parallel stability; and the builder integration.
// ════════════════════════════════════════════════════════════════════════════
{
  // g1: the four curves at t = 0, 0.5, 1 (imported from src/easing.js).
  close(easeValue(0, "linear"), 0, 0); close(easeValue(0.5, "linear"), 0.5, 0); close(easeValue(1, "linear"), 1, 0);
  close(easeValue(0, "easeIn"), 0, 0); close(easeValue(0.5, "easeIn"), 0.25, 0); close(easeValue(1, "easeIn"), 1, 0);
  close(easeValue(0, "easeOut"), 0, 0); close(easeValue(0.5, "easeOut"), 0.75, 0); close(easeValue(1, "easeOut"), 1, 0);
  close(easeValue(0, "easeInOut"), 0, 0); close(easeValue(0.5, "easeInOut"), 0.5, 0); close(easeValue(1, "easeInOut"), 1, 0);
  close(easeValue(-3, "easeOut"), 0, 0, "clamp low");
  close(easeValue(7, "easeIn"), 1, 0, "clamp high");
  assert.throws(() => easeValue(NaN, "linear"), TypeError, "NaN rejected");
  assert.throws(() => easeValue(0.5, "backOut"), TypeError, "unknown ease type rejected");
  // The glove module still re-exports the SAME function (C3 oracle compat).
  const { easeValue: gloveEaseValue } = await import("../src/glove-rotation-states.js");
  assert.equal(gloveEaseValue, easeValue, "glove-rotation-states re-exports the shared easeValue");

  // g2: tracker persistence + per-hand independence.
  const t = createSaberDirectionTracker();
  const a = t.tick("left", { x: 0, y: 1 }, 0, "linear", 100); // first tick starts AT target
  vecClose(a, 0, 1, 1e-9, "first tick starts at the target");
  vecClose(t.tick("left", { x: 0, y: 1 }, 50, "linear", 100), 0, 1, 1e-9, "persists at a held target");
  const b = t.tick("right", { x: 0, y: -1 }, 50, "linear", 100);
  vecClose(b, 0, -1, 1e-9, "right hand independent (starts at its own target)");

  // g3: mid-ease retarget from the CURRENT value (no snap). A changed target
  // at `nowMs` starts a fresh ease from the current eased vector; at t=0 of
  // that new ease the value is still the current position (no jump).
  const t2 = createSaberDirectionTracker();
  t2.tick("left", { x: 0, y: 1 }, 0, "linear", 100); // at 90 deg
  const retargetStart = t2.tick("left", { x: 1, y: 0 }, 25, "linear", 100); // retarget to 0 deg at t=25
  close(rad(retargetStart), 90, 1e-9, "retarget at t=0 of new ease keeps the current eased angle (90)");
  const half = t2.tick("left", { x: 1, y: 0 }, 75, "linear", 100); // t=50 of new ease → halfway
  close(rad(half), 45, 1e-9, "mid-new-ease is halfway between 90 and 0 (→ 45)");
  const done = t2.tick("left", { x: 1, y: 0 }, 125, "linear", 100); // t=100 → complete
  vecClose(done, 1, 0, 1e-9, "retargeted ease lands exactly on the new target");

  // g4: shortest arc — the tracker must take the SHORT way around. From +y
  // (90°) toward +x (0°), a 90-degree turn, after half the duration the eased
  // angle must be ~45° (short-arc midpoint), never ~−45° or ~135° (long way).
  const t3 = createSaberDirectionTracker();
  t3.tick("left", { x: 0, y: 1 }, 0, "linear", 100); // start at +y (90 deg)
  t3.tick("left", { x: 1, y: 0 }, 50, "linear", 100); // retarget to +x at t=50 (start new ease from current 90°)
  const mid3 = t3.tick("left", { x: 1, y: 0 }, 75, "linear", 100); // t=25/100 of new ease → 90° − 22.5° = 67.5°
  close(rad(mid3), 67.5, 1e-6, `shortest arc +y→+x: at t=25 of new ease angle is 67.5° (got ${rad(mid3).toFixed(2)})`);
  const end3 = t3.tick("left", { x: 1, y: 0 }, 150, "linear", 100); // t=100 → complete
  vecClose(end3, 1, 0, 1e-9, "+y→+x completes at +x");
  // Anti-shortest check: from −y (−90°) toward −x (180°), the short way goes
  // through −135°; verify by sampling one step into the new ease and checking
  // the angle moved in the correct (negative-decreasing) direction.
  const t3b = createSaberDirectionTracker();
  t3b.tick("right", { x: 0, y: -1 }, 0, "linear", 100); // start at −y
  t3b.tick("right", { x: -1, y: 0 }, 50, "linear", 100); // retarget to −x at t=50
  const mid3b = t3b.tick("right", { x: -1, y: 0 }, 75, "linear", 100); // t=25 of new ease
  // From −90° heading to 180° via the short way (through −135°, i.e. Δ=−90°):
  // at t=0.25: −90° + (−90°)(0.25) = −112.5°
  close(rad(mid3b), -112.5, 1e-6, `shortest arc −y→−x: at t=25 of new ease angle is −112.5° (got ${rad(mid3b).toFixed(2)})`);

  // g5: near-parallel stability — an almost-parallel target must not perturb
  //     the vector (no lerp+normalize cancellation).
  const t4 = createSaberDirectionTracker();
  t4.tick("left", { x: Math.cos(0.001), y: Math.sin(0.001) }, 0, "linear", 1000);
  const n1 = t4.tick("left", { x: 1, y: 0 }, 1, "linear", 1000); // ~0.057 deg away
  const dot = n1.x + n1.y * 0; // |v| should remain ~1
  close(Math.hypot(n1.x, n1.y), 1, 1e-9, "near-parallel result stays unit-length");
  close(dot, 1, 1e-3, "near-parallel target stays within 0.06 deg of current");

  // g6: snap on durationMs <= 0.
  const t5 = createSaberDirectionTracker();
  t5.tick("left", { x: 0, y: 1 }, 0, "linear", 100); // at +y
  const s1 = t5.tick("left", { x: 0, y: -1 }, 10, "linear", 0);
  vecClose(s1, 0, -1, 1e-9, "durationMs=0 snaps to the new target");
  const t5b = createSaberDirectionTracker();
  vecClose(t5b.tick("right", { x: 1, y: 0 }, 0, "linear", -5), 1, 0, 1e-9, "negative duration snaps (first tick)");

  // g7: reset() clears every hand.
  const t6 = createSaberDirectionTracker();
  t6.tick("left", { x: 0, y: 1 }, 0, "linear", 100);
  t6.tick("right", { x: 0, y: -1 }, 0, "linear", 100);
  t6.reset();
  vecClose(t6.tick("left", { x: 1, y: 0 }, 10, "linear", 100), 1, 0, 1e-9, "left hand re-initialized after reset");
  vecClose(t6.tick("right", { x: -1, y: 0 }, 10, "linear", 100), -1, 0, 1e-9, "right hand re-initialized after reset");

  // g8: dense and sparse cadences evaluate the same fixed endpoints.
  const dense = createSaberDirectionTracker();
  dense.tick("left", { x:0, y:1 }, 0, "linear", 100);
  dense.tick("left", { x:-1, y:0 }, 10, "linear", 100);
  for (let now = 20; now < 110; now += 10) dense.tick("left", { x:-1, y:0 }, now, "linear", 100);
  const denseEnd = dense.tick("left", { x:-1, y:0 }, 110, "linear", 100);
  const sparse = createSaberDirectionTracker();
  sparse.tick("left", { x:0, y:1 }, 0, "linear", 100);
  sparse.tick("left", { x:-1, y:0 }, 10, "linear", 100);
  const sparseEnd = sparse.tick("left", { x:-1, y:0 }, 110, "linear", 100);
  vecClose(denseEnd, sparseEnd.x, sparseEnd.y, 1e-12, "dense/sparse cadence parity");

  // g9: bad inputs rejected.
  const t7 = createSaberDirectionTracker();
  assert.throws(() => t7.tick("nose", { x: 1, y: 0 }, 0, "linear", 100), TypeError, "unknown hand rejected");
  assert.throws(() => t7.tick("left", { x: NaN, y: 0 }, 0, "linear", 100), TypeError, "non-finite target rejected");

  console.log("PASS: (g) shared easing curves + fixed-endpoint tracker (cadence parity, retarget, shortest arc, snap, reset, errors)");
}

// ════════════════════════════════════════════════════════════════════════════
// (g-continued) Builder integration: gameplayEquipmentRecords.
//   - flowZoneDirections ABSENT (null) → existing motion-only direction
//     (all prior callers keep passing).
//   - flowZoneDirections PRESENT → the flow branch uses it instead of
//     re-deriving from history.
// ════════════════════════════════════════════════════════════════════════════
{
  const anchors = [
    { anchor: "nose", valid: true, x: 0.5, y: 0.3, confidence: 0.95 },
    { anchor: "left_wrist", valid: true, x: 0.2, y: 0.6, confidence: 0.9 },
    { anchor: "right_wrist", valid: true, x: 0.8, y: 0.6, confidence: 0.92 },
  ];
  const input = {
    tracking: { gameplayPaused: false, freshCalibrationRequired: false, allRequiredAnchorsVisible: true, anchorsFrozen: false, degradedAnchors: [] },
    retainedGeometryDimmed: false,
    countdownFrozen: false,
    anchors,
  };
  const session = { state: "playing", purpose: "play", timestampMs: 1000 };
  // Left wrist sweeping +x inside the 100 ms window → motion direction {1,0};
  // right wrist stationary → fallback {0,1}.
  const history = {
    left_wrist: [{ t: 940, x: 0, y: 0 }, { t: 980, x: 1, y: 0 }],
    right_wrist: [{ t: 940, x: 0, y: 0 }, { t: 980, x: 0, y: 0 }],
  };
  const find = (records, role) => records.find((r) => r.role === role);

  // Absent param → motion-only (the pre-C4 behavior, unchanged).
  const rec0 = gameplayEquipmentRecords(false, session, input, "flow", history);
  assert.deepEqual(find(rec0, "left_wrist").direction, { x: 1, y: 0 }, "absent param: motion-only left");
  assert.deepEqual(find(rec0, "right_wrist").direction, { x: 0, y: 1 }, "absent param: motion-only right (fallback)");

  // Present param → builder uses the passed per-hand zone directions even
  // though the history implies a different (motion) direction.
  const zoneDirs = {
    left: { x: 0, y: 1, position: { x: 0.5, y: 1.0 } },   // edgeTop target
    right: { x: -1, y: 0, position: { x: 0.0, y: 0.5 } }, // edgeLeft target
  };
  const rec1 = gameplayEquipmentRecords(false, session, input, "flow", history, null, zoneDirs);
  assert.deepEqual(find(rec1, "left_wrist").direction, { x: 0, y: 1 }, "present param: left uses the zone direction (+y), NOT the motion (+x)");
  assert.deepEqual(find(rec1, "right_wrist").direction, { x: -1, y: 0 }, "present param: right uses the zone direction (-x)");
  // Boxing records never carry a direction, with or without the param.
  const rec2 = gameplayEquipmentRecords(false, session, input, "boxing", history, null, zoneDirs);
  for (const r of rec2) assert.ok(!("direction" in r), "boxing record must not carry direction");
  console.log("PASS: (g) gameplayEquipmentRecords — flowZoneDirections absent → motion-only; present → zone directions used; boxing unaffected");
}

{
  const assembly = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const body = assembly.match(/\n  computeFlowZoneDirections\(graph, inputOverride = null\) \{(?<body>[\s\S]*?)\n  \}\n\n  renderGameplay/u)?.groups?.body ?? "";
  assert.match(body, /snapshot\.session\?\.timestampMs/u, "Flow history and tracker use gameplay timestamp domain");
  assert.match(body, /zoneDirection\(position\.x, 1 - position\.y,/u, "body-grid y-down is converted to authored/judge y-up");
  assert.doesNotMatch(body, /timelinePositionMs/u, "Flow tracker must not compare wall-clock history samples with content time");
  console.log("PASS: assembly Flow ownership corrects Y axis and timestamp domain");
}

console.log("\nAll saber zone direction validations passed.");
