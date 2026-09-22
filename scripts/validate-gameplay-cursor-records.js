// @ts-check
// 0.0.60 W4-C2b (F4): Unit validator for gameplayCursorRecords — frozen cursor emission and per-anchor dimming.
// Deterministic, no camera. Exercises the pure function directly.

import assert from "node:assert/strict";
import { gameplayCursorRecords } from "../src/gameplay-cursor-records.js";

// --- helpers ---
function defaultAnchors() {
  return [
    { anchor: "nose", valid: true, x: 0.5, y: 0.3, confidence: 0.95 },
    { anchor: "left_wrist", valid: true, x: 0.2, y: 0.6, confidence: 0.9 },
    { anchor: "right_wrist", valid: true, x: 0.8, y: 0.6, confidence: 0.92 },
  ];
}

/**
 * @param {{ tracking?: object, anchorsList?: object[], retainedGeometryDimmed?: boolean, countdownFrozen?: boolean }} opts
 */
function inputSnapshot({ tracking = {}, anchorsList = null, retainedGeometryDimmed = false, countdownFrozen = false } = {}) {
  return {
    tracking: {
      gameplayPaused: false,
      freshCalibrationRequired: false,
      allRequiredAnchorsVisible: true,
      anchorsFrozen: false,
      degradedAnchors: [],
      ...tracking,
    },
    retainedGeometryDimmed,
    countdownFrozen,
    anchors: anchorsList ?? defaultAnchors(),
  };
}

const session = (state = "playing", purpose = "play") => ({ state, purpose });

// --- Test 1: Freeze active, degradedAnchors = ["right_wrist"], retainedGeometryDimmed = true.
// Expect: all 3 anchors emitted; right_wrist dimmed=true; others dimmed=false.
{
  const input = inputSnapshot({
    retainedGeometryDimmed: true,
    tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"], allRequiredAnchorsVisible: false },
  });
  const records = gameplayCursorRecords(false, session("playing"), input);
  assert.equal(records.length, 3, "freeze: all 3 anchors should be emitted");
  const nose = records.find((r) => r.role === "nose");
  const left = records.find((r) => r.role === "left_wrist");
  const right = records.find((r) => r.role === "right_wrist");
  assert.ok(nose && left && right, "all roles present");
  assert.equal(nose.dimmed, false, "nose should not be dimmed");
  assert.equal(left.dimmed, false, "left_wrist should not be dimmed");
  assert.equal(right.dimmed, true, "right_wrist should be dimmed (in degradedAnchors)");
  // frozen positions must carry through unchanged
  assert.equal(right.x, 0.8); assert.equal(right.y, 0.6); assert.equal(right.confidence, 0.92);
  console.log("PASS: freeze active — frozen anchors emitted with correct per-anchor dimmed flags");
}

// --- Test 2: Freeze cleared (anchorsFrozen false, all anchors visible) → no dimmed field.
{
  const input = inputSnapshot({
    retainedGeometryDimmed: false,
    tracking: { anchorsFrozen: false, degradedAnchors: [], allRequiredAnchorsVisible: true },
  });
  const records = gameplayCursorRecords(false, session("playing"), input);
  assert.equal(records.length, 3, "no freeze: all 3 anchors emitted");
  for (const r of records) {
    assert.ok(!("dimmed" in r), `record for ${r.role} should not carry dimmed key when not frozen`);
  }
  console.log("PASS: freeze cleared — records carry no dimmed field (full brightness)");
}

// --- Test 3: menuOpen = true → [] (suppression unchanged, even during freeze)
{
  const input = inputSnapshot({
    retainedGeometryDimmed: true,
    tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"], allRequiredAnchorsVisible: false },
  });
  assert.equal(gameplayCursorRecords(true, session("playing"), input).length, 0, "menuOpen must suppress cursors");
  console.log("PASS: menuOpen suppresses cursors");
}

// --- Test 4: purpose visual_test → EMISSION (0.0.63 C2: Test mode shows live markers).
// The freeze is active + a degraded anchor, so this exercises the same emit path
// as a playing session: all anchors emitted, per-anchor dimming intact.
{
  const input = inputSnapshot({
    retainedGeometryDimmed: true,
    tracking: { anchorsFrozen: true, degradedAnchors: ["nose"], allRequiredAnchorsVisible: false },
  });
  const records = gameplayCursorRecords(false, session("playing", "visual_test"), input);
  assert.equal(records.length, 3, "visual_test must NOT suppress cursors (0.0.63 C2)");
  assert.equal(records.find((r) => r.role === "nose").dimmed, true, "nose degraded under visual_test must be dimmed");
  assert.equal(records.find((r) => r.role === "left_wrist").dimmed, false, "non-degraded left must not be dimmed");
  console.log("PASS: visual_test purpose EMITS cursors (no longer suppressed)");
}

// --- Test 5: state not countdown/playing → []
{
  const input = inputSnapshot({ tracking: { anchorsFrozen: true, degradedAnchors: ["nose"] } });
  assert.equal(gameplayCursorRecords(false, session("paused_tracking"), input).length, 0, "non-countdown/playing state must suppress cursors");
  console.log("PASS: non-countdown/playing state suppresses cursors");
}

// --- Test 6: gameplayPaused → []
{
  const input = inputSnapshot({ tracking: { gameplayPaused: true, anchorsFrozen: true, degradedAnchors: ["nose"] } });
  assert.equal(gameplayCursorRecords(false, session("playing"), input).length, 0, "gameplayPaused must suppress cursors");
  console.log("PASS: gameplayPaused suppresses cursors");
}

// --- Test 7: freshCalibrationRequired → []
{
  const input = inputSnapshot({ tracking: { freshCalibrationRequired: true, anchorsFrozen: true, degradedAnchors: ["nose"] } });
  assert.equal(gameplayCursorRecords(false, session("playing"), input).length, 0, "freshCalibrationRequired must suppress cursors");
  console.log("PASS: freshCalibrationRequired suppresses cursors");
}

// --- Test 8: countdownFrozen → []
{
  const input = inputSnapshot({ countdownFrozen: true, tracking: { anchorsFrozen: true, degradedAnchors: ["nose"] } });
  assert.equal(gameplayCursorRecords(false, session("countdown"), input).length, 0, "countdownFrozen must suppress cursors");
  console.log("PASS: countdownFrozen suppresses cursors");
}

// --- Test 9: No freeze + retainedGeometryDimmed = true → [] (normal suppression still applies)
{
  const input = inputSnapshot({ retainedGeometryDimmed: true, tracking: { anchorsFrozen: false, allRequiredAnchorsVisible: true } });
  assert.equal(gameplayCursorRecords(false, session("playing"), input).length, 0, "retainedGeometryDimmed (no freeze) must suppress cursors");
  console.log("PASS: retainedGeometryDimmed (no freeze) suppresses cursors");
}

// --- Test 10: No freeze + allRequiredAnchorsVisible = false → []
{
  const input = inputSnapshot({ retainedGeometryDimmed: false, tracking: { anchorsFrozen: false, allRequiredAnchorsVisible: false } });
  assert.equal(gameplayCursorRecords(false, session("playing"), input).length, 0, "allRequiredAnchorsVisible=false (no freeze) must suppress cursors");
  console.log("PASS: allRequiredAnchorsVisible=false (no freeze) suppresses cursors");
}

// --- Test 11: Freeze active, one retained anchor below 0.5 confidence → excluded (per-anchor gate unchanged).
{
  const input = inputSnapshot({
    retainedGeometryDimmed: true,
    tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"], allRequiredAnchorsVisible: false },
    anchorsList: [
      { anchor: "nose", valid: true, x: 0.5, y: 0.3, confidence: 0.95 },
      { anchor: "left_wrist", valid: true, x: 0.2, y: 0.6, confidence: 0.9 },
      { anchor: "right_wrist", valid: true, x: 0.8, y: 0.6, confidence: 0.3 },
    ],
  });
  const records = gameplayCursorRecords(false, session("playing"), input);
  assert.equal(records.length, 2, "low-confidence anchor must be excluded even during freeze");
  assert.ok(!records.find((r) => r.role === "right_wrist"), "right_wrist (conf 0.3) must not appear");
  console.log("PASS: low-confidence anchor excluded even during freeze");
}

// --- Test 12: Freeze active but ALL anchors degraded → all three dimmed.
{
  const input = inputSnapshot({
    retainedGeometryDimmed: true,
    tracking: { anchorsFrozen: true, degradedAnchors: ["nose", "left_wrist", "right_wrist"], allRequiredAnchorsVisible: false },
  });
  const records = gameplayCursorRecords(false, session("playing"), input);
  assert.equal(records.length, 3);
  assert.ok(records.every((r) => r.dimmed === true), "all degraded anchors must be dimmed");
  console.log("PASS: all-degraded freeze dims every marker");
}

console.log("\nAll gameplay cursor records validations passed.");
