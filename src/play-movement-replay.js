// @ts-check
// Numeric observations only. No playback pacing, identity rewriting, calibration
// restoration or scoring authority is supplied by this reader.
import { isResolvedEquipmentPose } from "@aerobeat/web-contracts";
import { playMovementTickFields, recordedEquipmentPair } from "./play-movement-recording.js";
import { createMovementChunkStore, iterateMovementFile, MOVEMENT_TABLES, MOVEMENT_MAX_LINE_BYTES } from "./movement-chunk-store.js";

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
  const counts = Object.fromEntries([...Object.keys(tableLimits), "states"].map(name => [name, m[name].length]));
  for (const name of Object.keys(tableLimits)) for (const value of m[name]) validateMovementRecord(name, value, counts, name === "equipment" && Array.isArray(value) ? m.equipmentHeaders[value[0]] : null);
  return freeze(capture);
}

/** Import gzip JSONL incrementally into temporary storage. Legacy JSON keeps
 * its original bounded parser. createStore is a unit-fixture injection seam.
 * Successful facades own their store; callers must dispose on Clear/replacement.
 */
export async function parsePlayMovementFile(file, { signal, createStore = createMovementChunkStore } = {}) {
  const checkAbort = () => { if (signal?.aborted) throw signal.reason ?? new DOMException("Import cancelled", "AbortError"); };
  checkAbort();
  requireValue(file && typeof file.stream === "function" && typeof file.slice === "function", "expected a recording File");
  const magic = new Uint8Array(await file.slice(0, 2).arrayBuffer()); checkAbort();
  if (magic[0] !== 0x1f || magic[1] !== 0x8b) {
    requireValue(Number.isSafeInteger(file.size) && file.size <= maximumPlayMovementCaptureBytes, "file exceeds the 64 MiB legacy JSON limit");
    const reader = file.stream().getReader(), chunks = [], decoder = new TextDecoder("utf-8", { fatal: true });
    const abort = () => { void reader.cancel(signal.reason).catch(() => {}); };
    signal?.addEventListener("abort", abort, { once: true });
    let bytes = 0;
    try {
      for (;;) { checkAbort(); const { value, done } = await reader.read(); checkAbort(); if (done) break; bytes += value.byteLength; requireValue(bytes <= maximumPlayMovementCaptureBytes, "file exceeds the 64 MiB legacy JSON limit"); chunks.push(decoder.decode(value, { stream: true })); }
      chunks.push(decoder.decode());
      return parsePlayMovementCapture(chunks.join(""));
    } finally { signal?.removeEventListener("abort", abort); await reader.cancel(); reader.releaseLock(); }
  }
  const store = createStore();
  let capture = null, completed = false, pendingBytes = 0;
  const equipmentHeaders = new Map();
  const counts = Object.fromEntries(MOVEMENT_TABLES.map(name => [name, 0]));
  const lastWall = { ticks: -Infinity, observations: -Infinity };
  try {
    await store.ready; checkAbort();
    for await (const event of iterateMovementFile(file, { signal, maxLineBytes: MOVEMENT_MAX_LINE_BYTES })) {
      checkAbort();
      let nodes = 0;
      function bounded(value, depth = 0) {
        requireValue(depth <= 64 && ++nodes <= MOVEMENT_MAX_LINE_BYTES, "record JSON nesting/item limit exceeded");
        if (typeof value === "number") requireValue(Number.isFinite(value), "record JSON contains a nonfinite number");
        if (value !== null && typeof value === "object") for (const item of Object.values(value)) bounded(item, depth + 1);
      }
      bounded(event);
      if (event.type === "header") {
        exactFields(event, ["type", "format", "version", "header"], "stream header");
        validateMovementStreamHeader(event.header); capture = freeze(event.header);
      } else if (event.type === "row") {
        exactFields(event, ["type", "table", "index", "row"], "stream row");
        const { table, row: value } = event;
        requireValue(capture && MOVEMENT_TABLES.includes(table) && event.index === counts[table], "stream row index is invalid");
        if (table === "metadata") {
          requireValue(event.index === 0 && JSON.stringify(value) === JSON.stringify(capture.movement.metadata), "stream metadata differs from header");
        } else if (table === "states") {
          requireValue(event.index < capture.movement.states.length && value === capture.movement.states[event.index], "stream state differs from header");
        } else {
          let header = null;
          if (table === "equipment" && Array.isArray(value) && Number.isSafeInteger(value[0]) && value[0] >= 0 && value[0] < counts.equipmentHeaders) {
            header = equipmentHeaders.get(value[0]);
            if (!header) { header = (await store.readRows("equipmentHeaders", value[0], 1))[0]; equipmentHeaders.set(value[0], header); if (equipmentHeaders.size > 4) equipmentHeaders.delete(equipmentHeaders.keys().next().value); }
          }
          validateMovementRecord(table, value, { ...counts, states: capture.movement.states.length }, header);
          if (table === "ticks" || table === "observations") { requireValue(value[0] >= lastWall[table], `${table} wall timestamps roll backwards`); lastWall[table] = value[0]; }
        }
        requireValue(store.append(table, value) === counts[table]++, "storage index differs from stream");
        // Backpressure is explicit for live capture; file import can await each
        // small batch instead of ever accumulating a whole-file write queue.
        pendingBytes += new TextEncoder().encode(JSON.stringify(value)).byteLength;
        if (pendingBytes >= 512 * 1024 || counts[table] % 32 === 0) { await store.flush(); pendingBytes = 0; }
      } else {
        exactFields(event, ["type", "counts", "complete"], "stream footer");
        exactFields(event.counts, MOVEMENT_TABLES, "stream counts");
        requireValue(event.complete === true && MOVEMENT_TABLES.every(name => event.counts[name] === counts[name] && capture.movement.counts[name] === counts[name]), "stream counts do not match");
        completed = true;
      }
    }
    checkAbort();
    requireValue(completed && capture, "movement stream is incomplete");
    for (const name of ["ticks", "inputs", "rawPoses", "models", "configurations"]) requireValue(counts[name] > 0, "movement snapshots/ticks are incomplete");
    requireValue(capture.movement.tickCount === counts.ticks && capture.movement.measuredFrames === counts.rawPoses, "declared movement counts do not match tables");
    await store.flush(); checkAbort();
    let disposed = false;
    return Object.freeze({ ...capture,
      getCounts: () => Object.freeze({ ...counts }),
      async readRows(table, start, count) { requireValue(!disposed, "import is disposed"); const rows = await store.readRows(table, start, count); requireValue(!disposed, "import is disposed"); return freeze(rows); },
      dispose() { disposed = true; return store.dispose(); }
    });
  } catch (error) { try { await store.dispose(); } catch { /* preserve the import failure */ } throw error; }
}

// The stream transports tables separately; retain the original header rules,
// but not the old total-file/table admission limits.
export function validateMovementStreamHeader(capture) {
  header(capture, "capture");
  requireValue(capture.run.purpose === "play" && capture.run.state === "completed", "requires a completed Play run");
  const m = capture.movement;
  requireValue(record(m) && m.schema === "aerobeat/play_movement_recording" && m.version === 2, "unsupported movement schema/version");
  exactFields(m, ["schema", "version", "coordinateSpaces", "tickFields", "observationFields", "equipmentValueFields", "status", "reason", "complete", "finalSessionState", "tickCount", "measuredFrames", "estimatedBytes", "pendingBytes", "pendingHighWaterBytes", "storedBytes", "metadata", "states", "counts"], "stream movement");
  exactFields(m.counts, MOVEMENT_TABLES, "declared stream counts");
  for (const count of Object.values(m.counts)) requireValue(Number.isSafeInteger(count) && count >= 0, "declared stream count is invalid");
  for (const name of ["estimatedBytes", "pendingBytes", "pendingHighWaterBytes", "storedBytes"]) requireValue(Number.isSafeInteger(m[name]) && m[name] >= 0, "movement byte count is invalid");
  requireValue(m.complete === true && m.status === "completed" && m.finalSessionState === "completed" && m.reason === null, "movement is incomplete, truncated or not completed");
  columns(m.tickFields, playMovementTickFields, "tick"); columns(m.observationFields, observationFields, "observation"); columns(m.equipmentValueFields, equipmentFields, "equipment");
  exactFields(m.coordinateSpaces, ["raw", "calibrated", "equipment"], "coordinate spaces");
  requireValue(m.coordinateSpaces.raw === "camera_preview_top_left" && m.coordinateSpaces.calibrated === "athlete_top_left" && m.coordinateSpaces.equipment === "judge_world", "unsupported coordinate spaces");
  requireValue(Number.isSafeInteger(m.tickCount) && m.tickCount > 0 && Number.isSafeInteger(m.measuredFrames) && m.measuredFrames > 0, "declared movement counts are invalid");
  requireValue(Array.isArray(m.states) && m.states.length > 0 && m.states.length <= 64 && m.states.every(value => textValue(value) && value.length <= 128), "session states are invalid");
  requireValue(record(m.metadata), "movement metadata is missing");
  header(m.metadata.capture, "initial metadata capture");
  requireValue(m.metadata.capture.movement === null && m.metadata.capture.run.purpose === "play", "metadata capture must be an initial Play header with movement null");
  requireValue(record(m.metadata.configuration) && record(m.metadata.equipment) && record(m.metadata.equipmentIdentity), "movement configuration metadata is incomplete");
  model(m.metadata.initialCalibrationModel, "initial metadata");
  for (const name of Object.keys(tableLimits)) requireValue(!Object.hasOwn(m, name), "stream header must not contain movement table arrays");
}

// Shared by the bounded legacy reader and incremental file import. Counts can
// describe already admitted rows, so streaming references cannot point forward.
export function validateMovementRecord(table, value, counts, equipmentHeader = null) {
  const ref = (value, name, label, nullable = true) => reference(value, { length: counts[name] }, label, nullable);
  switch (table) {
    case "inputs":
      requireValue(record(value) && value.schema === "aerobeat/body_grid_service_snapshot" && value.version === 1 && record(value.calibration) && record(value.tracking) && Array.isArray(value.anchors) && Array.isArray(value.entries), "input snapshot is invalid"); break;
    case "models": model(value, "recorded"); break;
    case "configurations": requireValue(record(value), "configuration snapshot must be an object"); break;
    case "rawPoses":
      requireValue(record(value) && textValue(value.sourceId) && Number.isFinite(value.timestampMs) && typeof value.mirrored === "boolean" && Array.isArray(value.landmarks) && value.landmarks.length <= 128, "raw pose is invalid");
      for (const point of value.landmarks) {
        requireValue(record(point) && textValue(point.name) && [point.x, point.y, point.confidence].every(Number.isFinite), "raw landmark must have a name and finite x/y/confidence");
        for (const key of ["z", "visibility", "presence"]) if (Object.hasOwn(point, key)) requireValue(Number.isFinite(point[key]), `raw landmark ${key} must be finite`);
      } break;
    case "equipmentHeaders":
      requireValue(Array.isArray(value) && value.length === 2, "equipment header must contain both wrists");
      value.forEach((item, i) => {
        exactFields(item, ["role", "mode", "geometryIdentity", "configIdentity"], "equipment metadata");
        requireValue(item.role === (i === 0 ? "left_wrist" : "right_wrist") && isResolvedEquipmentPose({ ...item, anchor: { x: 0, y: 0, z: 0 }, scale: 1, orientation: { x: 0, y: 0, z: 0, w: 1 } }), "equipment metadata is invalid");
      });
      requireValue(value[0].mode === value[1].mode && value[0].configIdentity.value === value[1].configIdentity.value, "equipment pair identities differ"); break;
    case "equipment":
      row(value, 17, "equipment row"); ref(value[0], "equipmentHeaders", "equipment header", false);
      requireValue(recordedEquipmentPair({ equipment: [[0, ...value.slice(1)]], equipmentHeaders: [equipmentHeader] }, 0).every(isResolvedEquipmentPose), "equipment pose/quaternion is invalid"); break;
    case "observations":
      row(value, 5, "observation row");
      ["inputs", "rawPoses", "models", "configurations"].forEach((name, i) => ref(value[i + 1], name, `observation ${name}`)); break;
    case "ticks":
      row(value, 11, "tick row"); requireValue(value[3] === 0 || value[3] === 1, "audioPlaying must be 0 or 1");
      ["inputs", "equipment", "rawPoses", "models", "configurations", "states"].forEach((name, i) => ref(value[i === 5 ? 10 : i + 4], name, `tick ${name}`, name !== "states")); break;
    default: fail("unsupported movement table");
  }
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
