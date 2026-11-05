// @ts-check
// File observations drive only the existing unranked Test coordinator. No camera
// lease, calibration restoration, file-authored events or persisted settings.
import { createEquipmentConfigIdentity } from "@aerobeat/web-contracts";
import { sha256Hex } from "@aerobeat/web-hash";
import { canonicalEquipmentConfigIdentityInput, validateEquipmentConfig } from "./equipment-config.js";
import { normalizeGameSetup } from "./game-setup-coordinator.js";
import { recordedEquipmentPair } from "./play-movement-recording.js";

export const recordedTestContentOptions = Object.freeze({ purpose: "visual_test", recordedPlayReplay: true });
const startRequest = Object.freeze({ schema: "aerobeat/gameplay_session_start", version: 1, purpose: "visual_test" });
const livePresentationFields = ["boxingHeightOffsets", "obstaclesEnabled", "guidanceBandMode", "showGameplayGrid", "noteScalePercent", "obstacleScalePercent", "bombScalePercent", "markerScalePercent", "noseMarkerVisible", "noseMarkerScale", "trackExtensionWorldUnits", "flowCorpseFade", "boxingCorpseFade"];
const wallFields = new Set(["timestampMs", "measurementTimestampMs", "measuredAt", "semanticStartTimestampMs", "spatialStartTimestampMs", "startTimestampMs", "latestTargetTimestampMs", "targetTimestampMs"]);
let namespaceSequence = 0;
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
function requireValue(condition, message) { if (!condition) throw new Error(`Recording: ${message}`); }
function remember(cache, key, value, limit = 4) {
  cache.delete(key); cache.set(key, value);
  if (cache.size > limit) cache.delete(cache.keys().next().value);
  return value;
}

// One bounded row adapter for both legacy arrays and disk-backed imports.
export function movementRows(capture) {
  const counts = typeof capture.getCounts === "function" ? capture.getCounts() : Object.fromEntries(["inputs", "rawPoses", "models", "configurations", "equipmentHeaders", "equipment", "observations", "ticks"].map(name => [name, capture.movement[name].length]));
  const cache = new Map();
  async function get(table, index) {
    if (index === -1) return null;
    requireValue(Number.isSafeInteger(index) && index >= 0 && index < counts[table], `${table} reference is invalid.`);
    const blockSize = table === "ticks" || table === "observations" ? 32 : 1;
    const start = Math.floor(index / blockSize) * blockSize, key = `${table}:${start}`;
    let rows = cache.get(key);
    if (!rows) {
      rows = typeof capture.readRows === "function" ? await capture.readRows(table, start, Math.min(blockSize, counts[table] - start)) : capture.movement[table].slice(start, start + blockSize);
      requireValue(rows.length === Math.min(blockSize, counts[table] - start), `${table} storage read is incomplete.`);
      remember(cache, key, rows, 16);
    }
    return rows[index - start];
  }
  return Object.freeze({ counts, get });
}

export function assertRecordedContentMatches(capture, content) {
  const original = capture.movement.metadata.configuration, selected = content?.selectedVariant, recorded = original?.selectedVariant;
  requireValue(content?.state === "ready" && selected && recorded && content.packageId === original.packageId && capture.song.id === content.packageId, "load the matching downloaded song first.");
  for (const key of ["variantId", "chartId", "mode", "rulesetId", "recipeId"]) requireValue(selected[key] === recorded[key], `selected ${key} does not match the recording.`);
  for (const key of ["mapHash", "scoreIdentityHash"]) requireValue(selected[key]?.value && selected[key].value === recorded[key]?.value, `selected ${key} does not match the recording.`);
  requireValue(JSON.stringify([...(selected.modifierIds ?? [])].sort()) === JSON.stringify([...(recorded.modifierIds ?? [])].sort()), "selected modifiers do not match the recording.");
}

/** Validate all configurations/endpoints using bounded reads, not a binding per row. */
export async function prepareRecordedTest(capture, content, { signal } = {}) {
  const check = () => signal?.throwIfAborted();
  check(); assertRecordedContentMatches(capture, content);
  const resolvedEvents = content.resolvedEvents.filter(event => event.variantId === content.selectedVariant.variantId && event.chartId === content.selectedVariant.chartId);
  requireValue(resolvedEvents.length > 0, "matching content has no resolved events.");
  const rows = movementRows(capture), cache = new Map();
  const read = async (table, index) => { check(); const value = await rows.get(table, index); check(); return value; };
  async function getBinding(index) {
    check(); if (index === -1) index = 0;
    if (cache.has(index)) return cache.get(index);
    const value = await read("configurations", index);
    requireValue(value.gameplay && value.gameplay.packageId === content.packageId, "configuration belongs to another song.");
    assertRecordedContentMatches({ ...capture, movement: { metadata: { configuration: value.gameplay } } }, content);
    const equipment = validateEquipmentConfig(value.equipment), setup = normalizeGameSetup(value.setup), presentationSetup = normalizeGameSetup(value.presentationSetup), identity = createEquipmentConfigIdentity(value.equipmentIdentity);
    requireValue(setup !== null && presentationSetup !== null, "recorded Game Setup is invalid.");
    const renderSetup = { ...setup };
    for (const key of livePresentationFields) renderSetup[key] = presentationSetup[key];
    requireValue(await sha256Hex(canonicalEquipmentConfigIdentityInput(equipment)) === identity.value, "recorded equipment settings do not match their identity.");
    const { resolvedEvents: ignoredEvents, selectedVariant: ignoredVariant, packageId: ignoredPackage, ...rules } = value.gameplay;
    return remember(cache, index, freeze({ equipment, identity, setup, presentationSetup, renderSetup, kneePadRotations: value.kneePadRotations, configuration: { ...rules, packageId: content.packageId, selectedVariant: content.selectedVariant, resolvedEvents } }));
  }
  for (let i = 0; i < rows.counts.configurations; i++) await getBinding(i);
  for (let i = 0; i < rows.counts.ticks; i++) {
    const row = await read("ticks", i);
    if (row[5] < 0) continue;
    requireValue(row[8] >= 0, "equipment endpoints do not match recorded settings.");
    const binding = await getBinding(row[8]), equipment = await read("equipment", row[5]), headers = await read("equipmentHeaders", equipment[0]);
    requireValue(headers.every(header => header.configIdentity.value === binding.identity.value), "equipment endpoints do not match recorded settings.");
  }
  const first = await read("ticks", 0), observation = rows.counts.observations ? await read("observations", 0) : null;
  check();
  return Object.freeze({ capture, content, rows, getBinding, bindings: Object.freeze([await getBinding(0)]), firstWall: Math.min(first[0], observation?.[0] ?? first[0]) });
}

/** One actual-coordinator scorer; each async advance processes at most 32 events.
 * Commands synchronously invalidate any outstanding reads before resetting state.
 */
export function createRecordedTestPlayback(prepared, { gameplay, durationSeconds, leaseSnapshot, onFrame = () => {} }) {
  requireValue(Number.isFinite(durationSeconds) && durationSeconds > 0, "matching song audio duration is unavailable.");
  const { capture, rows, getBinding, firstWall } = prepared, counts = rows.counts;
  let index = 0, observationIndex = 0, last = null, running = false, startAt = 0, elapsed = 0, offset = 0, epoch = 0, authority = null, rebuildThrough = -1, resumeAfterRebuild = false, namespace;
  let seekSong = null, rebuildWall = null, generation = 0, disposed = false, advancing = false;
  let inputs = new Map(), models = new Map(), rawPoses = new Map(), pivots = { left: null, right: null }, pivotCalibration = null, bindingIndex = -1, currentBinding = null;
  function remap(value, key = "") {
    if (value === null) return null;
    if (wallFields.has(key) && typeof value === "number") return value + offset;
    if (["calibrationId", "sourceIdentity", "measuredSourceFrameId", "sourceFrameId", "sourceId"].includes(key) && typeof value === "string") return `${namespace}:${key}:${value}`;
    if (Array.isArray(value)) return value.map(item => remap(item));
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, remap(item, name)]));
    return value;
  }
  const valid = token => !disposed && token === generation;
  async function adapted(table, cache, ref, token) {
    if (ref === -1) return null;
    if (cache.has(ref)) return cache.get(ref);
    const value = await rows.get(table, ref);
    if (!valid(token)) return null;
    return remember(cache, ref, freeze(remap(value)));
  }
  function reset(now) {
    requireValue(!disposed, "playback is disposed."); generation++;
    namespace = `recorded-test:${++namespaceSequence}`;
    offset = Math.max(now, Number(gameplay.getSnapshot().session.timestampMs ?? 0)) + 1;
    index = 0; observationIndex = 0; last = null; elapsed = 0; startAt = now; epoch = 0; authority = null; rebuildThrough = -1; resumeAfterRebuild = false; seekSong = null; rebuildWall = null;
    inputs = new Map(); models = new Map(); rawPoses = new Map(); pivots = { left: null, right: null }; pivotCalibration = null; bindingIndex = -1; currentBinding = null;
    gameplay.configureContent(prepared.bindings[0].configuration, recordedTestContentOptions);
    gameplay.setLeaseSnapshot(leaseSnapshot());
    requireValue(gameplay.requestStart(offset, startRequest).accepted, "Test audio lease is unavailable.");
  }
  async function observe(row, token) {
    const binding = await getBinding(row[4]), input = await adapted("inputs", inputs, row[1], token), calibrationModel = await adapted("models", models, row[3], token), rawPose = await adapted("rawPoses", rawPoses, row[2], token);
    if (!valid(token)) return;
    observationIndex++;
    last = freeze({ ...(last ?? { index: -1, clock: { contextTimeSeconds: 0, positionSeconds: 0, playing: false }, equipmentPoses: null, renderTimelineMs: 0, sessionState: "calibrating" }), timestampMs: row[0] + offset, input, calibrationModel, rawPose, binding, pivots: { ...pivots } });
    onFrame(last);
  }
  async function consume(row, token) {
    const input = await adapted("inputs", inputs, row[4], token), calibrationModel = await adapted("models", models, row[7], token), rawPose = await adapted("rawPoses", rawPoses, row[6], token), binding = await getBinding(row[8]);
    const configuration = await rows.get("configurations", row[8]);
    const equipment = row[5] === -1 ? null : await rows.get("equipment", row[5]);
    const headers = equipment ? await rows.get("equipmentHeaders", equipment[0]) : null;
    if (!valid(token)) return;
    const source = { index, configuration, timestampMs: row[0], clock: { contextTimeSeconds: row[1], positionSeconds: row[2], playing: row[3] === 1 }, equipmentPoses: equipment ? recordedEquipmentPair({ equipment: [[0, ...equipment.slice(1)]], equipmentHeaders: [headers] }, 0) : null, renderTimelineMs: row[9], sessionState: capture.movement.states[row[10]] };
    const timestampMs = source.timestampMs + offset;
    requireValue(timestampMs >= gameplay.getSnapshot().session.timestampMs, "recorded wall timestamps roll backwards.");
    if (row[8] !== bindingIndex) {
      if (currentBinding && JSON.stringify(binding.configuration) !== JSON.stringify(currentBinding.configuration)) {
        gameplay.configureContent(binding.configuration, recordedTestContentOptions);
        gameplay.requestStart(timestampMs, startRequest); authority = null;
      }
      bindingIndex = row[8]; currentBinding = binding;
    }
    if (pivotCalibration !== input?.calibration?.calibrationId) { pivotCalibration = input?.calibration?.calibrationId; pivots = { left: null, right: null }; }
    for (const hand of ["left", "right"]) {
      const shoulder = input?.anchors?.find(value => value.anchor === `${hand}_shoulder` && value.valid && Number.isFinite(value.x) && Number.isFinite(value.y));
      if (shoulder) pivots[hand] = { x: shoulder.x, y: shoulder.y };
    }
    const frame = freeze({ ...source, timestampMs, input, calibrationModel, rawPose, binding, pivots: { ...pivots }, clock: { ...source.clock, durationSeconds } });
    last = frame; onFrame(frame);
    if (!valid(token)) return;
    const state = gameplay.getSnapshot().session.state;
    const active = source.sessionState === "playing" && source.clock.playing && input?.latestEvidence && input?.calibration?.calibrationId && !input.tracking?.gameplayPaused && !input.tracking?.freshCalibrationRequired && source.equipmentPoses?.length === 2;
    if (active && state === "paused_manual") gameplay.resume(timestampMs);
    if (!active) authority = null;
    if (active && authority === null) authority = Object.freeze({ schema: "aerobeat/visual_test_interaction", version: 1, mode: "production_judgement", epoch: ++epoch, activationTimelineMs: source.clock.positionSeconds * 1000 });
    if (source.clock.positionSeconds * 1000 < gameplay.getSnapshot().session.timelinePositionMs) {
      if (gameplay.getSnapshot().session.state === "playing") gameplay.pause(timestampMs, "recorded_clock_seek");
      gameplay.synchronizePausedClock({ timestampMs, clock: { ...frame.clock, playing: false } }); authority = null;
      if (active) { gameplay.resume(timestampMs); authority = Object.freeze({ schema: "aerobeat/visual_test_interaction", version: 1, mode: "production_judgement", epoch: ++epoch, activationTimelineMs: source.clock.positionSeconds * 1000 }); }
    }
    if (typeof gameplay.setBoxingHeightTuning === "function") gameplay.setBoxingHeightTuning({ shoulderWorldY: input?.calibratedShoulderWorldY ?? calibrationModel?.calibratedShoulderWorldY ?? 1, offsets: binding.renderSetup.boxingHeightOffsets });
    gameplay.advance({ timestampMs, clock: frame.clock, ...(input ? { input } : {}), ...(active ? { interaction: authority } : {}), ...(source.equipmentPoses ? { equipmentPoses: source.equipmentPoses } : {}), lease: leaseSnapshot() });
    if (!source.clock.playing && gameplay.getSnapshot().session.state === "paused_manual") gameplay.synchronizePausedClock({ timestampMs, clock: frame.clock });
    if (seekSong !== null && (row[2] * 1000 >= seekSong || index === counts.ticks - 1)) { seekSong = null; rebuildThrough = index; rebuildWall = row[0]; }
    index++;
  }
  const rebuilding = () => seekSong !== null || rebuildThrough >= 0;
  return Object.freeze({
    start(now) { reset(now); running = true; },
    pause(now) { generation++; if (running) elapsed += Math.max(0, now - startAt); running = false; resumeAfterRebuild = false; },
    resume(now) { generation++; if (index === counts.ticks) reset(now); startAt = now; running = true; if (rebuilding()) resumeAfterRebuild = true; },
    rebuild(count, now) { requireValue(Number.isSafeInteger(count) && count >= 0 && count <= counts.ticks, "invalid rebuild prefix."); reset(now); running = false; rebuildThrough = count - 1; resumeAfterRebuild = true; if (count === 0) { running = true; resumeAfterRebuild = false; } },
    seek(songMs, now) { requireValue(Number.isFinite(songMs) && songMs >= 0, "invalid seek position."); reset(now); running = false; seekSong = songMs; },
    async advance(now, maximumTicks = 32) {
      requireValue(Number.isSafeInteger(maximumTicks) && maximumTicks > 0, "invalid event batch.");
      if (disposed) return last;
      requireValue(!advancing, "advance must be serialized."); advancing = true;
      const token = generation, due = elapsed + (running ? Math.max(0, now - startAt) : 0);
      try {
        if (rebuildThrough >= 0 && rebuildWall === null) { const target = await rows.get("ticks", rebuildThrough); if (!valid(token)) return last; rebuildWall = target[0]; }
        for (let processed = 0; processed < Math.min(32, maximumTicks); processed++) {
          const tick = index < counts.ticks ? await rows.get("ticks", index) : null;
          if (!valid(token)) return last;
          const observation = observationIndex < counts.observations ? await rows.get("observations", observationIndex) : null;
          if (!valid(token)) return last;
          const tickTime = tick?.[0] ?? Infinity, observationTime = observation?.[0] ?? Infinity;
          const limit = seekSong !== null ? Infinity : rebuilding() ? rebuildWall : running ? firstWall + due : -Infinity;
          if (Math.min(tickTime, observationTime) > limit || !tick && !observation) break;
          if (observationTime <= tickTime) await observe(observation, token); else await consume(tick, token);
          if (!valid(token)) return last;
        }
        const nextObservation = observationIndex < counts.observations ? await rows.get("observations", observationIndex) : null;
        if (!valid(token)) return last;
        if (rebuildThrough >= 0 && index > rebuildThrough && (nextObservation?.[0] ?? Infinity) > rebuildWall) {
          elapsed = rebuildWall - firstWall; rebuildThrough = -1; rebuildWall = null;
          if (resumeAfterRebuild) { running = true; startAt = now; resumeAfterRebuild = false; }
        }
        if (index === counts.ticks && observationIndex === counts.observations) running = false;
        return last;
      } finally { advancing = false; }
    },
    dispose() { disposed = true; generation++; running = false; inputs.clear(); models.clear(); rawPoses.clear(); last = null; },
    getSnapshot() { return Object.freeze({ index, total: counts.ticks, observationIndex, observations: counts.observations, playing: running, rebuilding: rebuilding(), complete: index === counts.ticks && observationIndex === counts.observations, frame: last }); }
  });
}
