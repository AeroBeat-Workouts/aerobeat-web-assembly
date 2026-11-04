// @ts-check
// Observe actual input consumption and successful Play advances. Never change
// clocks, evidence, calibration, equipment or scoring. No media/proof objects.
export const playMovementRecordingSchema = "aerobeat/play_movement_recording";
export const playMovementRecordingVersion = 1;
export const playMovementRecordingMaxBytes = 48 * 1024 * 1024;
export const playMovementTickFields = Object.freeze([
  "timestampMs", "audioContextSeconds", "audioPositionSeconds", "audioPlaying",
  "inputIndex", "equipmentIndex", "rawPoseIndex", "modelIndex", "configurationIndex",
  "renderTimelineMs", "stateIndex"
]);
const observationFields = ["timestampMs", "inputIndex", "rawPoseIndex", "modelIndex", "configurationIndex"];
const encoder = new TextEncoder(), roles = ["left_wrist", "right_wrist"];
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}
const sameKey = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const metadataFor = p => ({ role: p.role, mode: p.mode, geometryIdentity: p.geometryIdentity, configIdentity: p.configIdentity });
const poseValues = p => [p.anchor.x, p.anchor.y, p.anchor.z, p.scale, p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w];
const poseMetadataEqual = (a, b) => a && b && a.role === b.role && a.mode === b.mode && a.geometryIdentity === b.geometryIdentity && a.configIdentity?.value === b.configIdentity?.value;
const samePoses = (a, b) => a && b && a.length === b.length && a.every((p, i) => poseMetadataEqual(p, b[i]) && sameKey(poseValues(p), poseValues(b[i])));

/**
 * Full snapshots once per immutable producer change; compact references per
 * actual advance. Errors/limits end observation only, never gameplay.
 * @param {{metadata?:unknown,maxBytes?:number,maxTicks?:number}} [options]
 */
export function createPlayMovementRecorder({ metadata = {}, maxBytes = playMovementRecordingMaxBytes, maxTicks = 120000 } = {}) {
  const tables = { inputs: [], rawPoses: [], models: [], configurations: [], equipmentHeaders: [], equipment: [], observations: [], ticks: [] }, states = [];
  let status = "recording", reason = null, estimatedBytes = 2048, finalSessionState = null;
  let lastInput = null, inputIndex = -1, modelIndex = -1, configurationIndex = -1, rawPoseIndex = -1;
  let lastRawIdentity = null, lastRawSource = null, lastRawTimestamp = null;
  let lastModelKey = null, lastConfigurationKey = null, lastPoses = null, equipmentIndex = -1;
  let lastHeader = null, headerIndex = -1;
  const stop = why => { if (status === "recording") { status = "truncated"; reason = why; } };
  function append(table, value, limit = 24000) {
    if (status !== "recording") return -1;
    const text = JSON.stringify(value);
    if (typeof text !== "string") throw new Error("recording value is not JSON data");
    const size = encoder.encode(text).byteLength + 1;
    if (table.length >= limit || estimatedBytes + size > maxBytes) { stop("recording_limit"); return -1; }
    estimatedBytes += size;
    table.push(freeze(JSON.parse(text)));
    return table.length - 1;
  }
  let capturedMetadata = null;
  try { const a = []; if (append(a, metadata, 1) === 0) capturedMetadata = a[0]; }
  catch { status = "capture_error"; reason = "metadata_unavailable"; }

  /** Input can be consumed while an audio transition temporarily skips scoring. */
  function observe(frame) {
    if (status !== "recording") return false;
    try {
      let changed = false;
      if (frame.input !== lastInput) {
        inputIndex = frame.input == null ? -1 : append(tables.inputs, frame.input);
        lastInput = frame.input; changed = true;
      }
      const modelKey = frame.modelKey ?? [], configKey = frame.configurationKey ?? [];
      if (!sameKey(modelKey, lastModelKey)) {
        modelIndex = frame.getCalibrationModel ? append(tables.models, frame.getCalibrationModel(), 1024) : -1;
        lastModelKey = modelKey.slice(); changed = true;
      }
      if (!sameKey(configKey, lastConfigurationKey)) {
        configurationIndex = frame.getConfiguration ? append(tables.configurations, frame.getConfiguration(), 1024) : -1;
        lastConfigurationKey = configKey.slice(); changed = true;
      }
      const source = frame.rawPose;
      const identity = frame.input?.sourceIdentity ?? null;
      if (source && (source.sourceId !== lastRawSource || source.timestampMs !== lastRawTimestamp || identity !== lastRawIdentity)) {
        if (!Number.isFinite(source.timestampMs)) throw new Error("nonfinite raw timestamp");
        const landmarks = source.landmarks.map(point => {
          if (![point.x, point.y, point.confidence].every(Number.isFinite)) throw new Error("nonfinite landmark");
          const out = { name: point.name, x: point.x, y: point.y, confidence: point.confidence };
          for (const key of ["z", "visibility", "presence"]) if (Number.isFinite(point[key])) out[key] = point[key];
          return out;
        });
        rawPoseIndex = append(tables.rawPoses, { sourceId: source.sourceId, timestampMs: source.timestampMs, mirrored: source.mirrored, landmarks });
        lastRawSource = source.sourceId; lastRawTimestamp = source.timestampMs; lastRawIdentity = identity; changed = true;
      }
      if (changed) append(tables.observations, [frame.timestampMs, inputIndex, rawPoseIndex, modelIndex, configurationIndex], 48000);
      return status === "recording";
    } catch { status = "capture_error"; reason = "input_unavailable"; return false; }
  }
  function equipment(poses) {
    if (!Array.isArray(poses) || poses.length === 0) { lastPoses = null; equipmentIndex = -1; return -1; }
    const pair = roles.map(role => poses.find(p => p.role === role));
    if (pair.some(p => !p)) throw new Error("incomplete equipment pair");
    if (samePoses(pair, lastPoses)) return equipmentIndex;
    if (!lastHeader || !pair.every((p, i) => poseMetadataEqual(p, lastHeader[i]))) {
      headerIndex = append(tables.equipmentHeaders, pair.map(metadataFor), 1024); lastHeader = pair;
    }
    const row = [headerIndex, ...poseValues(pair[0]), ...poseValues(pair[1])];
    if (!row.every(Number.isFinite)) throw new Error("nonfinite equipment data");
    equipmentIndex = append(tables.equipment, row, maxTicks); lastPoses = pair;
    return equipmentIndex;
  }
  const getStatus = () => Object.freeze({ status, reason, complete: status === "completed", finalSessionState, tickCount: tables.ticks.length, measuredFrames: tables.rawPoses.length, estimatedBytes, maxBytes });
  return Object.freeze({
    observe,
    /** One call per successful actual advance; suppliers run only on key changes. */
    record(frame) {
      if (finalSessionState === null && (frame.resultState === "completed" || frame.resultState === "stopped")) finalSessionState = frame.resultState;
      if (!observe(frame)) return false;
      try {
        const poseIndex = equipment(frame.equipmentPoses);
        let stateIndex = states.indexOf(frame.sessionState);
        if (stateIndex < 0) { states.push(frame.sessionState); stateIndex = states.length - 1; }
        const row = [frame.timestampMs, frame.clock.contextTimeSeconds, frame.clock.positionSeconds, frame.clock.playing ? 1 : 0, inputIndex, poseIndex, rawPoseIndex, modelIndex, configurationIndex, frame.renderTimelineMs, stateIndex];
        if (!row.every(Number.isFinite)) throw new Error("nonfinite tick data");
        const index = append(tables.ticks, row, maxTicks);
        if (status === "recording" && finalSessionState) status = finalSessionState;
        return index >= 0;
      } catch { status = "capture_error"; reason = "frame_unavailable"; return false; }
    },
    finish(state) { if (finalSessionState === null) finalSessionState = state; if (status === "recording") status = state === "completed" ? "completed" : "stopped"; },
    fail(why) { if (status === "recording") { status = "capture_error"; reason = why; } },
    getStatus,
    snapshot() {
      // Export is outside gameplay. Rows are copied/frozen at admission;
      // shallow table copies make this view stable even during capture.
      return freeze({ schema: playMovementRecordingSchema, version: playMovementRecordingVersion, coordinateSpaces: { raw: "camera_preview_top_left", calibrated: "athlete_top_left", equipment: "judge_world" }, tickFields: [...playMovementTickFields], observationFields: [...observationFields], equipmentValueFields: ["x", "y", "z", "scale", "qx", "qy", "qz", "qw"], ...getStatus(), metadata: capturedMetadata, states: [...states], ...Object.fromEntries(Object.entries(tables).map(([key, rows]) => [key, [...rows]])) });
    }
  });
}

/** Rebuild recorded endpoints for an explicitly Test-only consumer. */
export function recordedEquipmentPair(recording, index) {
  if (index === -1) return null;
  const row = recording.equipment[index], headers = recording.equipmentHeaders[row[0]];
  return headers.map((header, i) => {
    const n = 1 + i * 8;
    return { ...header, anchor: { x: row[n], y: row[n + 1], z: row[n + 2] }, scale: row[n + 3], orientation: { x: row[n + 4], y: row[n + 5], z: row[n + 6], w: row[n + 7] } };
  });
}
