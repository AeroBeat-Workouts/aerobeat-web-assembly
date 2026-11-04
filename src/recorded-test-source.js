// @ts-check
// Explicit non-ranked Test source. File observations never enter the live input
// service, restore calibration, or acquire a camera/media lease.
import { createEquipmentConfigIdentity } from "@aerobeat/web-contracts";
import { sha256Hex } from "@aerobeat/web-hash";
import { canonicalEquipmentConfigIdentityInput, validateEquipmentConfig } from "./equipment-config.js";
import { normalizeGameSetup } from "./game-setup-coordinator.js";
import { readMovementTick } from "./play-movement-replay.js";

export const recordedTestContentOptions = Object.freeze({ purpose: "visual_test", recordedPlayReplay: true });
const startRequest = Object.freeze({ schema: "aerobeat/gameplay_session_start", version: 1, purpose: "visual_test" });
const wallFields = new Set(["timestampMs", "measurementTimestampMs", "measuredAt", "semanticStartTimestampMs", "spatialStartTimestampMs", "startTimestampMs", "latestTargetTimestampMs", "targetTimestampMs"]);
let namespaceSequence = 0;
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
function requireValue(condition, message) { if (!condition) throw new Error(`Recording: ${message}`); }

export function assertRecordedContentMatches(capture, content) {
  const original = capture.movement.metadata.configuration, selected = content?.selectedVariant, recorded = original?.selectedVariant;
  requireValue(content?.state === "ready" && selected && recorded && content.packageId === original.packageId && capture.song.id === content.packageId, "load the matching downloaded song first.");
  for (const key of ["variantId", "chartId", "mode", "rulesetId", "recipeId"]) requireValue(selected[key] === recorded[key], `selected ${key} does not match the recording.`);
  for (const key of ["mapHash", "scoreIdentityHash"]) requireValue(selected[key]?.value && selected[key].value === recorded[key]?.value, `selected ${key} does not match the recording.`);
  requireValue(JSON.stringify([...(selected.modifierIds ?? [])].sort()) === JSON.stringify([...(recorded.modifierIds ?? [])].sort()), "selected modifiers do not match the recording.");
}

/** Validate recorded settings locally; never persist them or use file events. */
export async function prepareRecordedTest(capture, content) {
  assertRecordedContentMatches(capture, content);
  const resolvedEvents = content.resolvedEvents.filter(event => event.variantId === content.selectedVariant.variantId && event.chartId === content.selectedVariant.chartId);
  requireValue(resolvedEvents.length > 0, "matching content has no resolved events.");
  const bindings = [];
  for (const value of capture.movement.configurations) {
    requireValue(value.gameplay && value.gameplay.packageId === content.packageId, "configuration belongs to another song.");
    assertRecordedContentMatches({ ...capture, movement: { metadata: { configuration: value.gameplay } } }, content);
    const equipment = validateEquipmentConfig(value.equipment), setup = normalizeGameSetup(value.setup), identity = createEquipmentConfigIdentity(value.equipmentIdentity);
    requireValue(setup !== null, "recorded Game Setup is invalid.");
    requireValue(await sha256Hex(canonicalEquipmentConfigIdentityInput(equipment)) === identity.value, "recorded equipment settings do not match their identity.");
    const { resolvedEvents: ignoredEvents, selectedVariant: ignoredVariant, packageId: ignoredPackage, ...rules } = value.gameplay;
    bindings.push(freeze({ equipment, identity, setup, kneePadRotations: value.kneePadRotations, configuration: { ...rules, packageId: content.packageId, selectedVariant: content.selectedVariant, resolvedEvents } }));
  }
  for (const row of capture.movement.ticks) if (row[5] >= 0) {
    const binding = bindings[row[8]], equipmentRow = capture.movement.equipment[row[5]], headers = capture.movement.equipmentHeaders[equipmentRow[0]];
    requireValue(binding && headers.every(header => header.configIdentity.value === binding.identity.value), "equipment endpoints do not match recorded settings.");
  }
  return Object.freeze({ capture, bindings: Object.freeze(bindings), content });
}

/**
 * Drives the EXISTING coordinator with each recorded tick, in order. Wall time
 * schedules ticks, not song time (which may pause/seek). Batches never discard
 * intermediate rows. User seeks rebuild the real prefix in bounded batches.
 */
export function createRecordedTestPlayback(prepared, { gameplay, durationSeconds, leaseSnapshot, onFrame = () => {} }) {
  requireValue(Number.isFinite(durationSeconds) && durationSeconds > 0, "matching song audio duration is unavailable.");
  const { capture, bindings } = prepared, rows = capture.movement.ticks;
  const observations = capture.movement.observations, firstWall = Math.min(rows[0][0], observations[0]?.[0] ?? rows[0][0]);
  let index = 0, observationIndex = 0, last = null, running = false, startAt = 0, elapsed = 0, offset = 0, epoch = 0, authority = null, rebuildThrough = -1, resumeAfterRebuild = false, namespace;
  let inputs = new Map(), models = new Map(), rawPoses = new Map(), identities = new Map(), pivots = { left: null, right: null }, pivotCalibration = null, bindingIndex = -1;
  function remap(value, key = "") {
    if (value === null) return null;
    if (wallFields.has(key) && typeof value === "number") return value + offset;
    if (["calibrationId", "sourceIdentity", "measuredSourceFrameId", "sourceFrameId", "sourceId"].includes(key) && typeof value === "string") {
      const id = `${key}:${value}`;
      if (!identities.has(id)) identities.set(id, `${namespace}:${key}:${identities.size}`);
      return identities.get(id);
    }
    if (Array.isArray(value)) return value.map(item => remap(item));
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, remap(item, name)]));
    return value;
  }
  function adapted(table, cache, ref) {
    if (ref === -1) return null;
    if (!cache.has(ref)) cache.set(ref, freeze(remap(capture.movement[table][ref])));
    return cache.get(ref);
  }
  function reset(now) {
    namespace = `recorded-test:${++namespaceSequence}`;
    offset = Math.max(now, Number(gameplay.getSnapshot().session.timestampMs ?? 0)) + 1;
    index = 0; observationIndex = 0; last = null; elapsed = 0; startAt = now; epoch = 0; authority = null; rebuildThrough = -1; resumeAfterRebuild = false;
    inputs = new Map(); models = new Map(); rawPoses = new Map(); identities = new Map(); pivots = { left: null, right: null }; pivotCalibration = null; bindingIndex = -1;
    gameplay.configureContent(bindings[0].configuration, recordedTestContentOptions);
    gameplay.setLeaseSnapshot(leaseSnapshot());
    requireValue(gameplay.requestStart(offset, startRequest).accepted, "Test audio lease is unavailable.");
  }
  function observe() {
    const row = observations[observationIndex++], binding = bindings[row[4]] ?? bindings[0];
    const input = adapted("inputs", inputs, row[1]), calibrationModel = adapted("models", models, row[3]);
    last = freeze({ ...(last ?? { index: -1, clock: { contextTimeSeconds: 0, positionSeconds: 0, playing: false }, equipmentPoses: null, renderTimelineMs: 0, sessionState: "calibrating" }), timestampMs: row[0] + offset, input, calibrationModel, rawPose: adapted("rawPoses", rawPoses, row[2]), binding, pivots: { ...pivots } });
    onFrame(last);
  }
  function consume() {
    const source = readMovementTick(capture, index), row = rows[index], input = adapted("inputs", inputs, row[4]), calibrationModel = adapted("models", models, row[7]);
    const binding = bindings[row[8]] ?? bindings[0], timestampMs = source.timestampMs + offset;
    requireValue(timestampMs >= gameplay.getSnapshot().session.timestampMs, "recorded wall timestamps roll backwards.");
    if (row[8] !== bindingIndex) {
      // Only actual gameplay configuration changes replace run truth. Visual
      // snapshots (camera/settings publication) do not reset an ongoing score.
      if (bindingIndex >= 0 && JSON.stringify(binding.configuration) !== JSON.stringify(bindings[bindingIndex].configuration)) {
        gameplay.configureContent(binding.configuration, recordedTestContentOptions);
        gameplay.requestStart(timestampMs, startRequest); authority = null;
      }
      bindingIndex = row[8];
    }
    if (pivotCalibration !== input?.calibration?.calibrationId) { pivotCalibration = input?.calibration?.calibrationId; pivots = { left: null, right: null }; }
    for (const hand of ["left", "right"]) {
      const shoulder = input?.anchors?.find(value => value.anchor === `${hand}_shoulder` && value.valid && Number.isFinite(value.x) && Number.isFinite(value.y));
      if (shoulder) pivots[hand] = { x: shoulder.x, y: shoulder.y };
    }
    const frame = freeze({ ...source, timestampMs, input, calibrationModel, rawPose: adapted("rawPoses", rawPoses, row[6]), binding, pivots: { ...pivots }, clock: { ...source.clock, durationSeconds } });
    last = frame;
    onFrame(frame);
    const state = gameplay.getSnapshot().session.state;
    const active = source.sessionState === "playing" && source.clock.playing && input?.latestEvidence && input?.calibration?.calibrationId && !input.tracking?.gameplayPaused && !input.tracking?.freshCalibrationRequired && source.equipmentPoses?.length === 2;
    if (active && state === "paused_manual") gameplay.resume(timestampMs);
    if (!active) authority = null;
    if (active && authority === null) authority = Object.freeze({ schema: "aerobeat/visual_test_interaction", version: 1, mode: "production_judgement", epoch: ++epoch, activationTimelineMs: source.clock.positionSeconds * 1000 });
    // Preserve recorded paused/seek transitions through normal lifecycle APIs.
    // Never use seekTo here: a viewer seek reconstructs this full prefix instead.
    if (source.clock.positionSeconds * 1000 < gameplay.getSnapshot().session.timelinePositionMs) {
      if (gameplay.getSnapshot().session.state === "playing") gameplay.pause(timestampMs, "recorded_clock_seek");
      gameplay.synchronizePausedClock({ timestampMs, clock: { ...frame.clock, playing: false } });
      authority = null;
      if (active) { gameplay.resume(timestampMs); authority = Object.freeze({ schema: "aerobeat/visual_test_interaction", version: 1, mode: "production_judgement", epoch: ++epoch, activationTimelineMs: source.clock.positionSeconds * 1000 }); }
    }
    if (typeof gameplay.setBoxingHeightTuning === "function") gameplay.setBoxingHeightTuning({ shoulderWorldY: input?.calibratedShoulderWorldY ?? calibrationModel?.calibratedShoulderWorldY ?? 1, offsets: binding.setup.boxingHeightOffsets });
    gameplay.advance({ timestampMs, clock: frame.clock, ...(input ? { input } : {}), ...(active ? { interaction: authority } : {}), ...(source.equipmentPoses ? { equipmentPoses: source.equipmentPoses } : {}), lease: leaseSnapshot() });
    if (!source.clock.playing && gameplay.getSnapshot().session.state === "paused_manual") gameplay.synchronizePausedClock({ timestampMs, clock: frame.clock });
    index++;
  }
  return Object.freeze({
    start(now) { reset(now); running = true; },
    pause(now) { if (running) elapsed += Math.max(0, now - startAt); running = false; resumeAfterRebuild = false; },
    resume(now) { if (index === rows.length) { reset(now); } startAt = now; running = true; if (rebuildThrough >= 0) resumeAfterRebuild = true; },
    rebuild(count, now) { reset(now); running = false; rebuildThrough = count - 1; resumeAfterRebuild = true; if (count === 0) { running = true; resumeAfterRebuild = false; } },
    seek(songMs, now) {
      reset(now); running = false;
      const found = rows.findIndex(row => row[2] * 1000 >= songMs);
      rebuildThrough = found < 0 ? rows.length - 1 : found;
    },
    advance(now, maximumTicks = 32) {
      const due = elapsed + (running ? Math.max(0, now - startAt) : 0);
      let processed = 0;
      while (processed < maximumTicks) {
        const tickTime = rows[index]?.[0] ?? Infinity, observationTime = observations[observationIndex]?.[0] ?? Infinity;
        const limit = rebuildThrough >= 0 ? rows[rebuildThrough][0] : running ? firstWall + due : -Infinity;
        if (Math.min(tickTime, observationTime) > limit || tickTime === Infinity && observationTime === Infinity) break;
        if (observationTime <= tickTime) observe(); else consume();
        processed++;
      }
      if (rebuildThrough >= 0 && index > rebuildThrough && (observations[observationIndex]?.[0] ?? Infinity) > rows[rebuildThrough][0]) { elapsed = rows[index - 1][0] - firstWall; rebuildThrough = -1; if (resumeAfterRebuild) { running = true; startAt = now; resumeAfterRebuild = false; } }
      if (index === rows.length && observationIndex === observations.length) running = false;
      return last;
    },
    getSnapshot() { return Object.freeze({ index, total: rows.length, observationIndex, observations: observations.length, playing: running, rebuilding: rebuildThrough >= 0, complete: index === rows.length && observationIndex === observations.length, frame: last }); }
  });
}
