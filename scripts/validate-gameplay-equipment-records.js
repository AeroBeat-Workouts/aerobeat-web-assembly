// @ts-check
// 0.0.61 L-F4 (chgy/hk5q/vths): Unit validator for gameplayEquipmentRecords —
// equipment (saber/glove) record emission mirroring the cursor-record gates,
// with the Flow saber `direction` re-derived from the coordinator's own
// pre-push wrist-history (visual == hit). Deterministic, no camera; exercises
// the pure function directly.

import assert from "node:assert/strict";
import { gameplayEquipmentRecords } from "../src/gameplay-equipment-records.js";

// --- helpers ---
function defaultAnchors() {
  // nose is present to prove it is NEVER emitted as an equipment record.
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

/**
 * @param {string} [state]
 * @param {string} [purpose]
 * @param {number} [timestampMs]
 */
function session(state = "playing", purpose = "play", timestampMs = 1000) {
  return { state, purpose, timestampMs };
}

// A left wrist sweeping +x (judge space) inside the 100 ms direction window →
// direction {1,0}; a stationary right wrist → fallback {0,1}. Both entries sit
// at t >= nowMs-100 so both are inside the window (nowMs = timestampMs = 1000).
const movingLeft = Object.freeze([
  Object.freeze({ t: 940, x: 0, y: 0 }),
  Object.freeze({ t: 980, x: 1, y: 0 }),
]);
const stationaryRight = Object.freeze([
  Object.freeze({ t: 940, x: 0, y: 0 }),
  Object.freeze({ t: 980, x: 0, y: 0 }),
]);
const flowHistory = { left_wrist: movingLeft, right_wrist: stationaryRight };

const find = (records, role) => records.find((r) => r.role === role);

// --- Test 1: Freeze active, degradedAnchors=["right_wrist"], retainedGeometryDimmed=true.
// Expect: both wrists emitted (nose never); right dimmed=true, left dimmed=false;
// flow → direction present on both (left {1,0}, right fallback {0,1}).
{
  const input = inputSnapshot({
    retainedGeometryDimmed: true,
    tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"], allRequiredAnchorsVisible: false },
  });
  const records = gameplayEquipmentRecords(false, session("playing"), input, "flow", flowHistory);
  assert.equal(records.length, 2, "freeze: both wrists emitted, nose excluded");
  assert.ok(!find(records, "nose"), "nose must never be an equipment record");
  const left = find(records, "left_wrist"); const right = find(records, "right_wrist");
  assert.ok(left && right, "both wrist roles present");
  assert.equal(left.dimmed, false, "left not degraded → not dimmed");
  assert.equal(right.dimmed, true, "right degraded → dimmed");
  // frozen positions carry through unchanged
  assert.equal(left.x, 0.2); assert.equal(left.y, 0.6);
  assert.equal(right.x, 0.8); assert.equal(right.y, 0.6);
  assert.equal(left.mode, "flow"); assert.equal(right.mode, "flow");
  assert.deepEqual(left.direction, { x: 1, y: 0 }, "moving left wrist → +x beam");
  assert.deepEqual(right.direction, { x: 0, y: 1 }, "stationary right wrist → fallback up");
  console.log("PASS: freeze active — frozen wrists emitted, per-anchor dimmed, flow direction re-derived");
}

// --- Test 2: Freeze cleared → no dimmed key; flow direction still present.
{
  const input = inputSnapshot({
    retainedGeometryDimmed: false,
    tracking: { anchorsFrozen: false, degradedAnchors: [], allRequiredAnchorsVisible: true },
  });
  const records = gameplayEquipmentRecords(false, session("playing"), input, "flow", flowHistory);
  assert.equal(records.length, 2, "no freeze: both wrists emitted");
  for (const r of records) {
    assert.ok(!("dimmed" in r), `record for ${r.role} should not carry dimmed key when not frozen`);
    assert.ok("direction" in r, `flow record for ${r.role} should carry direction`);
  }
  console.log("PASS: freeze cleared — no dimmed key; flow direction present");
}

// --- Test 3: menuOpen = true → [] (suppression unchanged, even during freeze).
{
  const input = inputSnapshot({ retainedGeometryDimmed: true, tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"], allRequiredAnchorsVisible: false } });
  assert.equal(gameplayEquipmentRecords(true, session("playing"), input, "flow", flowHistory).length, 0, "menuOpen must suppress equipment");
  console.log("PASS: menuOpen suppresses equipment");
}

// --- Test 4: purpose visual_test → [].
{
  const input = inputSnapshot({ retainedGeometryDimmed: true, tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"], allRequiredAnchorsVisible: false } });
  assert.equal(gameplayEquipmentRecords(false, session("playing", "visual_test"), input, "flow", flowHistory).length, 0, "visual_test must suppress equipment");
  console.log("PASS: visual_test purpose suppresses equipment");
}

// --- Test 5: state not countdown/playing → [].
{
  const input = inputSnapshot({ tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"] } });
  assert.equal(gameplayEquipmentRecords(false, session("paused_tracking"), input, "flow", flowHistory).length, 0, "non-countdown/playing state must suppress equipment");
  console.log("PASS: non-countdown/playing state suppresses equipment");
}

// --- Test 6: gameplayPaused → [].
{
  const input = inputSnapshot({ tracking: { gameplayPaused: true, anchorsFrozen: true, degradedAnchors: ["right_wrist"] } });
  assert.equal(gameplayEquipmentRecords(false, session("playing"), input, "flow", flowHistory).length, 0, "gameplayPaused must suppress equipment");
  console.log("PASS: gameplayPaused suppresses equipment");
}

// --- Test 7: freshCalibrationRequired → [].
{
  const input = inputSnapshot({ tracking: { freshCalibrationRequired: true, anchorsFrozen: true, degradedAnchors: ["right_wrist"] } });
  assert.equal(gameplayEquipmentRecords(false, session("playing"), input, "flow", flowHistory).length, 0, "freshCalibrationRequired must suppress equipment");
  console.log("PASS: freshCalibrationRequired suppresses equipment");
}

// --- Test 8: countdownFrozen → [].
{
  const input = inputSnapshot({ countdownFrozen: true, tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"] } });
  assert.equal(gameplayEquipmentRecords(false, session("countdown"), input, "flow", flowHistory).length, 0, "countdownFrozen must suppress equipment");
  console.log("PASS: countdownFrozen suppresses equipment");
}

// --- Test 9: No freeze + retainedGeometryDimmed = true → [].
{
  const input = inputSnapshot({ retainedGeometryDimmed: true, tracking: { anchorsFrozen: false, allRequiredAnchorsVisible: true } });
  assert.equal(gameplayEquipmentRecords(false, session("playing"), input, "flow", flowHistory).length, 0, "retainedGeometryDimmed (no freeze) must suppress equipment");
  console.log("PASS: retainedGeometryDimmed (no freeze) suppresses equipment");
}

// --- Test 10: No freeze + allRequiredAnchorsVisible = false → [].
{
  const input = inputSnapshot({ retainedGeometryDimmed: false, tracking: { anchorsFrozen: false, allRequiredAnchorsVisible: false } });
  assert.equal(gameplayEquipmentRecords(false, session("playing"), input, "flow", flowHistory).length, 0, "allRequiredAnchorsVisible=false (no freeze) must suppress equipment");
  console.log("PASS: allRequiredAnchorsVisible=false (no freeze) suppresses equipment");
}

// --- Test 11: Freeze active, right wrist below 0.5 confidence → excluded (per-anchor gate unchanged).
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
  const records = gameplayEquipmentRecords(false, session("playing"), input, "flow", flowHistory);
  assert.equal(records.length, 1, "low-confidence wrist must be excluded even during freeze");
  assert.ok(!find(records, "right_wrist"), "right_wrist (conf 0.3) must not appear");
  assert.ok(find(records, "left_wrist"), "left_wrist still present");
  console.log("PASS: low-confidence wrist excluded even during freeze");
}

// --- Test 12: Boxing mode → direction ABSENT on every record (gloves are axis-aligned).
{
  const input = inputSnapshot({
    retainedGeometryDimmed: true,
    tracking: { anchorsFrozen: true, degradedAnchors: ["left_wrist"], allRequiredAnchorsVisible: false },
  });
  const records = gameplayEquipmentRecords(false, session("playing"), input, "boxing", flowHistory);
  assert.equal(records.length, 2, "boxing: both wrists emitted");
  for (const r of records) {
    assert.equal(r.mode, "boxing");
    assert.ok(!("direction" in r), `boxing record for ${r.role} must NOT carry direction`);
  }
  assert.equal(find(records, "left_wrist")?.dimmed, true, "left degraded → dimmed");
  assert.equal(find(records, "right_wrist")?.dimmed, false, "right not degraded → not dimmed");
  console.log("PASS: boxing mode — direction absent, dimmed per degraded anchor");
}

// --- Test 13: Flow with NO wrist-history (null) → direction still present (fallback {0,1}).
{
  const input = inputSnapshot({ tracking: { anchorsFrozen: false, allRequiredAnchorsVisible: true } });
  const records = gameplayEquipmentRecords(false, session("playing"), input, "flow", null);
  assert.equal(records.length, 2, "flow without history: both wrists emitted");
  for (const r of records) {
    assert.deepEqual(r.direction, { x: 0, y: 1 }, `flow record for ${r.role} degrades to fallback up`);
  }
  console.log("PASS: flow without history — direction degrades to shared fallback");
}

// --- Test 14: Invalid mode → [] (mode guard; renderer only accepts flow/boxing).
{
  const input = inputSnapshot({ tracking: { anchorsFrozen: false, allRequiredAnchorsVisible: true } });
  assert.equal(gameplayEquipmentRecords(false, session("playing"), input, "lanes", flowHistory).length, 0, "invalid mode must emit no records");
  console.log("PASS: invalid mode emits no records");
}

// --- Test 15: Emitted records never exceed the renderer's 4-record cap (the
// >4 rejection is a passthrough that can never trip from this producer).
{
  const input = inputSnapshot({
    retainedGeometryDimmed: true,
    tracking: { anchorsFrozen: true, degradedAnchors: ["left_wrist", "right_wrist"], allRequiredAnchorsVisible: false },
  });
  for (const mode of ["flow", "boxing"]) {
    const records = gameplayEquipmentRecords(false, session("playing"), input, mode, flowHistory);
    assert.ok(records.length <= 4, `${mode}: emitted ${records.length} records must be <= renderer cap of 4`);
    assert.ok(new Set(records.map((r) => r.role)).size === records.length, "no duplicate roles");
  }
  console.log("PASS: emitted records respect the renderer's 4-record cap (no >4 rejection)");
}

console.log("\nAll gameplay equipment records validations passed.");
