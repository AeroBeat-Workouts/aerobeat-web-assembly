// @ts-check
// 0.0.61 L-F4 (chgy/hk5q/vths): Unit validator for gameplayEquipmentRecords —
// equipment (saber/glove) record emission mirroring the cursor-record gates,
// with the Flow saber `direction` re-derived from the coordinator's own
// pre-push wrist-history (visual == hit). Deterministic, no camera; exercises
// the pure function directly.

import assert from "node:assert/strict";
import { gameplayEquipmentRecords } from "../src/gameplay-equipment-records.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

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
  // 0.0.63 C2: every equipment record carries the per-hand base transform (defaults 1 / 0).
  for (const r of records) {
    assert.equal(r.scale, 2, `${r.role} Flow scale default must be 2`);
    assert.equal(r.rotationZDeg, 0, `${r.role} rotationZDeg default must be 0`);
  }
  console.log("PASS: freeze active — frozen wrists emitted, per-anchor dimmed, flow direction re-derived, base transform present");
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

// --- Test 4: purpose visual_test → EMISSION (0.0.63 C2: Test mode shows equipped models).
// Both wrists emitted (nose excluded); right dimmed under freeze; every record carries
// the per-hand base transform (defaults scale 1 / rotationZDeg 0) plus flow direction.
{
  const input = inputSnapshot({ retainedGeometryDimmed: true, tracking: { anchorsFrozen: true, degradedAnchors: ["right_wrist"], allRequiredAnchorsVisible: false } });
  const records = gameplayEquipmentRecords(false, session("playing", "visual_test"), input, "flow", flowHistory);
  assert.equal(records.length, 2, "visual_test must NOT suppress equipment (0.0.63 C2)");
  const left = find(records, "left_wrist"); const right = find(records, "right_wrist");
  assert.ok(left && right, "both wrist roles present under visual_test");
  assert.equal(right.dimmed, true, "degraded right must be dimmed");
  for (const r of records) {
    assert.equal(typeof r.scale, "number", `record ${r.role} must carry numeric scale`);
    assert.equal(r.scale, 2, `default build config: ${r.role} Flow scale must be 2`);
    assert.equal(typeof r.rotationZDeg, "number", `record ${r.role} must carry numeric rotationZDeg`);
    assert.equal(r.rotationZDeg, 0, `default build config: ${r.role} rotationZDeg must be 0`);
  }
  assert.deepEqual(left.direction, { x: 1, y: 0 }, "moving left wrist → +x beam even in Test");
  console.log("PASS: visual_test purpose EMITS equipment (no longer suppressed) with base transform");
}

// --- Test 5: paused_manual is admitted for visual_test only, without weakening
// any existing menu/tracking/calibration/countdown/anchor gate.
{
  const healthy = inputSnapshot();
  assert.equal(gameplayEquipmentRecords(false, session("paused_manual", "visual_test"), healthy, "flow", flowHistory).length, 2, "paused Visual Test must retain both equipment records");
  assert.equal(gameplayEquipmentRecords(false, session("paused_manual", "play"), healthy, "flow", flowHistory).length, 0, "paused Play must remain suppressed");
  assert.equal(gameplayEquipmentRecords(false, session("paused_manual", "other"), healthy, "flow", flowHistory).length, 0, "paused non-Test purposes must remain suppressed");
  assert.equal(gameplayEquipmentRecords(false, { state: "paused_manual", timestampMs: 1000 }, healthy, "flow", flowHistory).length, 0, "paused state without the exact visual_test purpose must fail closed");
  assert.equal(gameplayEquipmentRecords(false, session("paused_tracking", "visual_test"), healthy, "flow", flowHistory).length, 0, "other paused Visual Test states must remain suppressed");
  assert.equal(gameplayEquipmentRecords(true, session("paused_manual", "visual_test"), healthy, "flow", flowHistory).length, 0, "menu-open paused Visual Test must remain suppressed");
  const suppressedInputs = [
    [inputSnapshot({ tracking: { gameplayPaused: true } }), "gameplayPaused"],
    [inputSnapshot({ tracking: { freshCalibrationRequired: true } }), "freshCalibrationRequired"],
    [inputSnapshot({ countdownFrozen: true }), "countdownFrozen"],
    [inputSnapshot({ tracking: { allRequiredAnchorsVisible: false } }), "missing required anchors"],
    [inputSnapshot({ retainedGeometryDimmed: true }), "retained dimmed geometry"],
    [inputSnapshot({ anchorsList: [{ anchor: "left_wrist", valid: false, x: 0.2, y: 0.6, confidence: 0.9 }] }), "invalid anchors"],
  ];
  for (const [input, label] of suppressedInputs) {
    assert.equal(gameplayEquipmentRecords(false, session("paused_manual", "visual_test"), input, "flow", flowHistory).length, 0, `paused Visual Test must preserve ${label} suppression`);
  }
  console.log("PASS: paused_manual admits exact visual_test only and preserves every existing suppression gate");
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
    // 0.0.63 C2: base transform present on boxing records too (defaults 1 / 0).
    assert.equal(r.scale, 0.75, `boxing ${r.role} scale default must be 0.75`);
    assert.equal(r.rotationZDeg, 0, `boxing ${r.role} rotationZDeg default must be 0`);
  }
  assert.equal(find(records, "left_wrist")?.dimmed, true, "left degraded → dimmed");
  assert.equal(find(records, "right_wrist")?.dimmed, false, "right not degraded → not dimmed");
  console.log("PASS: boxing mode — direction absent, dimmed per degraded anchor, base transform present");
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

// --- Test 16: live config replaces baked per-hand base transforms on the next record.
{
  const input = inputSnapshot({ tracking: { anchorsFrozen: false, allRequiredAnchorsVisible: true } });
  const config = structuredClone(equipmentConfigDefaults);
  config.flow.perHand.left.scale = 3;
  config.flow.perHand.left.rotationEulerDeg = { x: 9, y: -12, z: 17 };
  config.boxing.perHand.right.scale = 1.5;
  config.boxing.perHand.right.rotationEulerDeg = { x: -4, y: 8, z: -11 };
  const flow = gameplayEquipmentRecords(false, session("playing", "visual_test"), input, "flow", flowHistory, null, null, config);
  assert.equal(find(flow, "left_wrist")?.scale, 3, "live Flow left scale must reach the next equipment record");
  assert.equal(find(flow, "left_wrist")?.rotationZDeg, 17, "live Flow left base rotation must reach the next equipment record");
  const boxing = gameplayEquipmentRecords(false, session("playing", "visual_test"), input, "boxing", flowHistory, { left: {x:0,y:0,z:5}, right: {x:0,y:0,z:7} }, null, config);
  assert.equal(find(boxing, "right_wrist")?.scale, 1.5, "live Boxing right scale must reach the next equipment record");
  assert.equal(find(boxing, "right_wrist")?.rotationZDeg, -4, "live Boxing state rotation must add to the edited base rotation");
  console.log("PASS: live config — per-hand scale/base rotation reach the next record and dynamic rotation remains additive");
}

console.log("\nAll gameplay equipment records validations passed.");
