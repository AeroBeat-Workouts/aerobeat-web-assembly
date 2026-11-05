// @ts-check
// Numeric observations only. The disk store owns bounded admission and writes;
// clocks, calibration, scoring and measured samples are never changed here.
import { createMovementChunkStore } from "./movement-chunk-store.js";
export const playMovementRecordingSchema = "aerobeat/play_movement_recording";
export const playMovementRecordingVersion = 2;
export const playMovementTickFields = Object.freeze([
  "timestampMs", "audioContextSeconds", "audioPositionSeconds", "audioPlaying",
  "inputIndex", "equipmentIndex", "rawPoseIndex", "modelIndex", "configurationIndex",
  "renderTimelineMs", "stateIndex"
]);
const observationFields = ["timestampMs", "inputIndex", "rawPoseIndex", "modelIndex", "configurationIndex"];
const roles = ["left_wrist", "right_wrist"];
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
// Replay already requires the matching downloaded chart and discards file events.
// Retain all identities/rules without repeating that shared chart in every row.
const compactGameplay = value => { if (!value || typeof value !== "object") return value; const { resolvedEvents: ignored, ...rules } = value; return rules; };

/** Disk-backed per-run capture. Supplying a store also supports focused tests. */
export function createPlayMovementRecorder({ metadata = {}, store: suppliedStore } = {}) {
  const states = [];
  let status = "recording", reason = null, finalSessionState = null, exportedFile = null;
  let lastInput = null, inputIndex = -1, modelIndex = -1, configurationIndex = -1, rawPoseIndex = -1;
  let lastRawIdentity = null, lastRawSource = null, lastRawTimestamp = null;
  let lastModelKey = null, lastConfigurationKey = null, lastPoses = null, equipmentIndex = -1;
  let lastHeader = null, headerIndex = -1, capturedMetadata = null;
  const fail = why => { if (status !== "disposed") { status = "capture_error"; reason = why; } };
  const store = suppliedStore ?? createMovementChunkStore({ onError: error => fail(error.code ?? "storage_unavailable") });
  const health = () => { const error = store.getStatus().error; if (error) fail(error.code ?? "storage_unavailable"); };
  store.ready.catch(error => fail(error.code ?? "storage_unavailable"));
  try { const value = structuredClone(metadata); if (value && Object.hasOwn(value, "configuration")) value.configuration = compactGameplay(value.configuration); capturedMetadata = freeze(value); }
  catch { fail("metadata_unavailable"); }
  function append(table, value) {
    health(); if (status !== "recording") return -1;
    return store.append(table, value);
  }
  function observe(frame) {
    health(); if (status !== "recording") return false;
    try {
      let changed = false;
      if (frame.input !== lastInput) { inputIndex = frame.input == null ? -1 : append("inputs", frame.input); lastInput = frame.input; changed = true; }
      const modelKey = frame.modelKey ?? [], configKey = frame.configurationKey ?? [];
      if (!sameKey(modelKey, lastModelKey)) { modelIndex = frame.getCalibrationModel ? append("models", frame.getCalibrationModel()) : -1; lastModelKey = modelKey.slice(); changed = true; }
      if (!sameKey(configKey, lastConfigurationKey)) {
        if (frame.getConfiguration) { const value = frame.getConfiguration(); configurationIndex = append("configurations", Object.hasOwn(value, "gameplay") ? { ...value, gameplay: compactGameplay(value.gameplay) } : value); }
        else configurationIndex = -1;
        lastConfigurationKey = configKey.slice(); changed = true;
      }
      const source = frame.rawPose, identity = frame.input?.sourceIdentity ?? null;
      if (source && (source.sourceId !== lastRawSource || source.timestampMs !== lastRawTimestamp || identity !== lastRawIdentity)) {
        if (!Number.isFinite(source.timestampMs)) throw new Error("nonfinite raw timestamp");
        const landmarks = source.landmarks.map(point => {
          if (![point.x, point.y, point.confidence].every(Number.isFinite)) throw new Error("nonfinite landmark");
          const out = { name: point.name, x: point.x, y: point.y, confidence: point.confidence };
          for (const key of ["z", "visibility", "presence"]) if (Number.isFinite(point[key])) out[key] = point[key];
          return out;
        });
        rawPoseIndex = append("rawPoses", { sourceId: source.sourceId, timestampMs: source.timestampMs, mirrored: source.mirrored, landmarks });
        lastRawSource = source.sourceId; lastRawTimestamp = source.timestampMs; lastRawIdentity = identity; changed = true;
      }
      if (changed) append("observations", [frame.timestampMs, inputIndex, rawPoseIndex, modelIndex, configurationIndex]);
      return status === "recording";
    } catch (error) { fail(error.code ?? "input_unavailable"); return false; }
  }
  function equipment(poses) {
    if (!Array.isArray(poses) || poses.length === 0) { lastPoses = null; equipmentIndex = -1; return -1; }
    const pair = roles.map(role => poses.find(p => p.role === role));
    if (pair.some(p => !p)) throw new Error("incomplete equipment pair");
    if (samePoses(pair, lastPoses)) return equipmentIndex;
    if (!lastHeader || !pair.every((p, i) => poseMetadataEqual(p, lastHeader[i]))) { headerIndex = append("equipmentHeaders", pair.map(metadataFor)); lastHeader = pair; }
    const row = [headerIndex, ...poseValues(pair[0]), ...poseValues(pair[1])];
    if (!row.every(Number.isFinite)) throw new Error("nonfinite equipment data");
    equipmentIndex = append("equipment", row); lastPoses = pair; return equipmentIndex;
  }
  const getStatus = () => {
    health(); const counts = store.getCounts(), disk = store.getStatus();
    return Object.freeze({ status, reason, complete: status === "completed", finalSessionState, tickCount: counts.ticks ?? 0, measuredFrames: counts.rawPoses ?? 0, estimatedBytes: disk.logicalBytes ?? 0, pendingBytes: disk.pendingBytes ?? 0, pendingHighWaterBytes: disk.pendingHighWaterBytes ?? 0, storedBytes: disk.committedBytes ?? 0 });
  };
  const snapshot = () => freeze({ schema: playMovementRecordingSchema, version: playMovementRecordingVersion, coordinateSpaces: { raw: "camera_preview_top_left", calibrated: "athlete_top_left", equipment: "judge_world" }, tickFields: [...playMovementTickFields], observationFields: [...observationFields], equipmentValueFields: ["x", "y", "z", "scale", "qx", "qy", "qz", "qw"], ...getStatus(), metadata: capturedMetadata, states: [...states], counts: store.getCounts() });
  const flush = async () => {
    try { await store.flush(); health(); if (status === "finalizing") status = finalSessionState === "completed" ? "completed" : "stopped"; }
    catch (error) { fail(error.code ?? "storage_write_failed"); }
    return snapshot();
  };
  const finish = state => {
    if (finalSessionState === null) finalSessionState = state;
    if (status === "recording") status = "finalizing";
    if (status === "finalizing") void flush();
  };
  return Object.freeze({
    observe, getStatus, snapshot, flush, finish, fail,
    record(frame) {
      if (!observe(frame)) return false;
      try {
        const poseIndex = equipment(frame.equipmentPoses);
        let stateIndex = states.indexOf(frame.sessionState);
        if (stateIndex < 0) { states.push(frame.sessionState); stateIndex = states.length - 1; }
        const row = [frame.timestampMs, frame.clock.contextTimeSeconds, frame.clock.positionSeconds, frame.clock.playing ? 1 : 0, inputIndex, poseIndex, rawPoseIndex, modelIndex, configurationIndex, frame.renderTimelineMs, stateIndex];
        if (!row.every(Number.isFinite)) throw new Error("nonfinite tick data");
        const index = append("ticks", row);
        if (frame.resultState === "completed" || frame.resultState === "stopped") finish(frame.resultState);
        return index >= 0;
      } catch (error) { fail(error.code ?? "frame_unavailable"); return false; }
    },
    async exportFile(header) {
      const movement = await flush();
      // Finished run data is immutable: repeated downloads share one disk file.
      if (!exportedFile) exportedFile = store.exportFile({ ...header, movement });
      return exportedFile;
    },
    readRows: (table, start, count) => store.readRows(table, start, count),
    async dispose() { status = "disposed"; await store.dispose(); }
  });
}

/** Legacy JSON endpoint decoder; new replay sources use bounded async row reads. */
export function recordedEquipmentPair(recording, index) {
  if (index === -1) return null;
  const row = recording.equipment[index], headers = recording.equipmentHeaders[row[0]];
  return headers.map((header, i) => { const n = 1 + i * 8; return { ...header, anchor: { x: row[n], y: row[n + 1], z: row[n + 2] }, scale: row[n + 3], orientation: { x: row[n + 4], y: row[n + 5], z: row[n + 6], w: row[n + 7] } }; });
}
