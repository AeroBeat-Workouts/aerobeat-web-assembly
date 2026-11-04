// @ts-check
// Numeric observations only. No playback pacing, identity rewriting, calibration
// restoration or scoring authority is supplied by this reader.
import { isResolvedEquipmentPose } from "@aerobeat/web-contracts";
import { playMovementTickFields, recordedEquipmentPair } from "./play-movement-recording.js";

export const maximumPlayMovementCaptureBytes = 64 * 1024 * 1024;
const observationFields = ["timestampMs", "inputIndex", "rawPoseIndex", "modelIndex", "configurationIndex"];
const equipmentFields = ["x", "y", "z", "scale", "qx", "qy", "qz", "qw"];
const tableLimits = { inputs: 24000, rawPoses: 24000, models: 1024, configurations: 1024, equipmentHeaders: 1024, equipment: 120000, observations: 48000, ticks: 120000 };
const rootFields = ["schema", "version", "capturedAt", "build", "song", "run", "options", "summary", "judgements", "movement"];
const movementFields = ["schema", "version", "coordinateSpaces", "tickFields", "observationFields", "equipmentValueFields", "status", "reason", "complete", "finalSessionState", "tickCount", "measuredFrames", "estimatedBytes", "maxBytes", "metadata", "states", ...Object.keys(tableLimits)];
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = message => { throw new TypeError(`Play movement capture: ${message}`); };
const requireValue = (condition, message) => { if (!condition) fail(message); };
const textValue = value => typeof value === "string" && value.length > 0;
function exactFields(value, fields, label) {
  requireValue(record(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), `${label} fields are invalid`);
}
function columns(value, expected, label) {
  requireValue(Array.isArray(value) && value.length === expected.length && value.every((field, i) => field === expected[i]), `${label} columns are unsupported`);
}
function reference(value, table, label, nullable = true) {
  requireValue(Number.isInteger(value) && (nullable && value === -1 || value >= 0 && value < table.length), `${label} reference is invalid`);
}
function row(value, length, label) {
  requireValue(Array.isArray(value) && value.length === length && value.every(Number.isFinite), `${label} must contain ${length} finite numbers`);
}
function freeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}
function model(value, label) {
  requireValue(record(value) && value.schema === "aerobeat/calibration_model" && value.version === 1, `${label} calibration model schema/version is unsupported`);
  requireValue(record(value.grid) && record(value.subgrid) && record(value.interpretation), `${label} calibration model is incomplete`);
  requireValue(value.bounds === null || record(value.bounds), `${label} bounds are invalid`);
  requireValue(value.normalizedNoseBaseline === null || record(value.normalizedNoseBaseline), `${label} nose baseline is invalid`);
}
function header(value, label) {
  exactFields(value, rootFields, label);
  requireValue(value.schema === "aerobeat/ab_judgement_capture" && value.version === 2, `${label} schema/version is unsupported; judgement-only captures cannot replay movement`);
  requireValue(textValue(value.capturedAt) && record(value.build) && record(value.song) && record(value.run) && record(value.options) && record(value.summary) && Array.isArray(value.judgements), `${label} header is incomplete`);
}

/**
 * Parse a completed Play export, retaining the original numeric observations.
 * Limits mirror the writer's bounded tables, with 64 MiB for the whole export.
 * Validation never normalizes equipment quaternions or rewrites timestamps.
 * @param {string} text
 * @returns {Readonly<Record<string, unknown>>} Deeply frozen original JSON root.
 */
export function parsePlayMovementCapture(text) {
  requireValue(typeof text === "string", "expected JSON text");
  requireValue(text.length <= maximumPlayMovementCaptureBytes && new TextEncoder().encode(text).byteLength <= maximumPlayMovementCaptureBytes, "file exceeds the 64 MiB limit");
  let capture;
  try { capture = JSON.parse(text); } catch { fail("invalid JSON"); }
  // JSON can contain overflowing numeric exponents. Bound nesting/work before
  // subsequent traversal/freezing, including producer-owned opaque snapshots.
  let nodes = 0;
  function boundedJson(value, depth = 0) {
    requireValue(depth <= 64 && ++nodes <= 8 * 1024 * 1024, "JSON nesting/item limit exceeded");
    if (typeof value === "number") requireValue(Number.isFinite(value), "JSON contains a nonfinite number");
    if (value !== null && typeof value === "object") for (const nested of Object.values(value)) boundedJson(nested, depth + 1);
  }
  boundedJson(capture);
  requireValue(record(capture) && capture.schema === "aerobeat/ab_judgement_capture" && capture.version === 2, "unsupported capture schema/version; judgement-only captures cannot replay movement");
  header(capture, "capture");
  requireValue(capture.run.purpose === "play" && capture.run.state === "completed", "requires a completed Play run");
  const m = capture.movement;
  requireValue(record(m), "movement recording is missing; judgement-only captures cannot replay movement");
  requireValue(m.schema === "aerobeat/play_movement_recording" && m.version === 1, "unsupported movement schema/version");
  exactFields(m, movementFields, "movement");
  requireValue(m.complete === true && m.status === "completed" && m.finalSessionState === "completed" && m.reason === null, "movement is incomplete, truncated or not completed");
  columns(m.tickFields, playMovementTickFields, "tick");
  columns(m.observationFields, observationFields, "observation");
  columns(m.equipmentValueFields, equipmentFields, "equipment");
  exactFields(m.coordinateSpaces, ["raw", "calibrated", "equipment"], "coordinate spaces");
  requireValue(m.coordinateSpaces.raw === "camera_preview_top_left" && m.coordinateSpaces.calibrated === "athlete_top_left" && m.coordinateSpaces.equipment === "judge_world", "unsupported coordinate spaces");
  for (const [name, limit] of Object.entries(tableLimits)) requireValue(Array.isArray(m[name]) && m[name].length <= limit, `${name} table exceeds its length bound or is missing`);
  requireValue(m.ticks.length > 0 && m.inputs.length > 0 && m.rawPoses.length > 0 && m.models.length > 0 && m.configurations.length > 0, "movement snapshots/ticks are incomplete");
  requireValue(m.tickCount === m.ticks.length && m.measuredFrames === m.rawPoses.length, "declared movement counts do not match tables");
  requireValue(Number.isSafeInteger(m.estimatedBytes) && m.estimatedBytes >= 0 && Number.isSafeInteger(m.maxBytes) && m.maxBytes > 0 && m.estimatedBytes <= m.maxBytes && m.maxBytes <= maximumPlayMovementCaptureBytes, "movement byte bounds are invalid");
  requireValue(Array.isArray(m.states) && m.states.length > 0 && m.states.length <= 64 && m.states.every(value => textValue(value) && value.length <= 128), "session states are invalid");
  requireValue(record(m.metadata), "movement metadata is missing");
  header(m.metadata.capture, "initial metadata capture");
  requireValue(m.metadata.capture.movement === null && m.metadata.capture.run.purpose === "play", "metadata capture must be an initial Play header with movement null");
  requireValue(record(m.metadata.configuration) && record(m.metadata.equipment) && record(m.metadata.equipmentIdentity), "movement configuration metadata is incomplete");
  model(m.metadata.initialCalibrationModel, "initial metadata");
  for (const value of m.inputs) requireValue(record(value) && value.schema === "aerobeat/body_grid_service_snapshot" && value.version === 1 && record(value.calibration) && record(value.tracking) && Array.isArray(value.anchors) && Array.isArray(value.entries), "input snapshot is invalid");
  for (const value of m.models) model(value, "recorded");
  for (const value of m.configurations) requireValue(record(value), "configuration snapshot must be an object");
  for (const raw of m.rawPoses) {
    requireValue(record(raw) && textValue(raw.sourceId) && Number.isFinite(raw.timestampMs) && typeof raw.mirrored === "boolean" && Array.isArray(raw.landmarks) && raw.landmarks.length <= 128, "raw pose is invalid");
    for (const point of raw.landmarks) {
      requireValue(record(point) && textValue(point.name) && [point.x, point.y, point.confidence].every(Number.isFinite), "raw landmark must have a name and finite x/y/confidence");
      for (const key of ["z", "visibility", "presence"]) if (Object.hasOwn(point, key)) requireValue(Number.isFinite(point[key]), `raw landmark ${key} must be finite`);
    }
  }
  for (const pair of m.equipmentHeaders) {
    requireValue(Array.isArray(pair) && pair.length === 2, "equipment header must contain both wrists");
    pair.forEach((value, i) => {
      exactFields(value, ["role", "mode", "geometryIdentity", "configIdentity"], "equipment metadata");
      requireValue(value.role === (i === 0 ? "left_wrist" : "right_wrist") && isResolvedEquipmentPose({ ...value, anchor: { x: 0, y: 0, z: 0 }, scale: 1, orientation: { x: 0, y: 0, z: 0, w: 1 } }), "equipment metadata is invalid");
    });
    requireValue(pair[0].mode === pair[1].mode && pair[0].configIdentity.value === pair[1].configIdentity.value, "equipment pair identities differ");
  }
  for (let i = 0; i < m.equipment.length; i++) {
    row(m.equipment[i], 17, "equipment row");
    reference(m.equipment[i][0], m.equipmentHeaders, "equipment header", false);
    // Boolean contract validation only: constructors can renormalize a producer
    // quaternion by an ULP. Keep the original endpoint numbers unchanged.
    requireValue(recordedEquipmentPair(m, i).every(isResolvedEquipmentPose), "equipment pose/quaternion is invalid");
  }
  for (const value of m.observations) {
    row(value, 5, "observation row");
    ["inputs", "rawPoses", "models", "configurations"].forEach((name, i) => reference(value[i + 1], m[name], `observation ${name}`));
  }
  for (const value of m.ticks) {
    row(value, 11, "tick row");
    requireValue(value[3] === 0 || value[3] === 1, "audioPlaying must be 0 or 1");
    ["inputs", "equipment", "rawPoses", "models", "configurations", "states"].forEach((name, i) => reference(value[i === 5 ? 10 : i + 4], m[name], `tick ${name}`, name !== "states"));
  }
  return freeze(capture);
}

/**
 * Resolve one tick from parsePlayMovementCapture's immutable root. The clock
 * and all source/calibration/timestamp values are observations, not live input.
 * Equal wall timestamps, paused audio and seeks are intentionally retained.
 * @param {Readonly<Record<string, unknown>>} capture
 * @param {number} index
 */
export function readMovementTick(capture, index) {
  const m = capture?.movement;
  requireValue(record(m) && Array.isArray(m.ticks), "expected a parsed movement capture");
  requireValue(Number.isInteger(index) && index >= 0 && index < m.ticks.length, "tick index is out of range");
  const value = m.ticks[index];
  const snapshot = (name, ref) => ref === -1 ? null : m[name][ref];
  return freeze({ index, timestampMs: value[0], clock: { contextTimeSeconds: value[1], positionSeconds: value[2], playing: value[3] === 1 }, input: snapshot("inputs", value[4]), equipmentPoses: recordedEquipmentPair(m, value[5]), rawPose: snapshot("rawPoses", value[6]), calibrationModel: snapshot("models", value[7]), configuration: snapshot("configurations", value[8]), renderTimelineMs: value[9], sessionState: m.states[value[10]] });
}
