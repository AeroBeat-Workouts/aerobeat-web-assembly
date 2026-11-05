// @ts-check
import test from "node:test";
import { createUnitMovementStore, legacyUnitMovement, streamUnitFile } from "./movement-store-unit-fixture.js";
import assert from "node:assert/strict";
import { createAeroBodyGridService } from "@aerobeat/web-input";
import { MOVEMENT_MAX_LINE_BYTES } from "../src/movement-chunk-store.js";
import { buildAbJudgementCapture } from "../src/ab-judgement-capture.js";
import { createPlayMovementRecorder, recordedEquipmentPair } from "../src/play-movement-recording.js";
import { maximumPlayMovementCaptureBytes, parsePlayMovementCapture, parsePlayMovementFile, readMovementTick } from "../src/play-movement-replay.js";

// Build a real writer fixture with the actual input model, not the ignored
// signed download. Keep provider-neutral source identity and initial metadata.
function fixture() {
  const inputService = createAeroBodyGridService({ calibrationIdPrefix: "recorded-calibration" });
  const identity = { schema: "aerobeat/equipment_config_identity", version: 1, algorithm: "sha256", value: "a".repeat(64) };
  const variant = { variantId: "recorded-variant", chartId: "recorded-chart", mode: "flow", rulesetId: "flow_colliders_v1" };
  const content = { packageId: "fixture-song", selectedVariant: variant, lineage: { sourceId: "local-fixture", sourceVersionHash: "provider-neutral-source-v1" }, song: { songName: "Recorded numeric fixture" } };
  const build = { version: "fixture", buildStamp: "fixture-build" };
  const gameplay = state => ({ selectedVariant: variant, session: { purpose: "play", state, sessionId: "recorded-play", ranked: false }, judgements: [] });
  const configuration = { gameplay: { packageId: "fixture-song", selectedVariant: variant, resolvedEvents: [] }, setup: { timingWindowMs: 180 }, equipment: { schema: "aerobeat/equipment_config", version: 4 }, equipmentIdentity: identity };
  const initial = inputService.getCalibrationModel();
  const unitStore = createUnitMovementStore();
  const recorder = createPlayMovementRecorder({ store: unitStore.store, metadata: { capture: buildAbJudgementCapture({ build, content, gameplay: gameplay("calibrating"), capturedAtMs: 0 }), configuration: configuration.gameplay, equipment: configuration.equipment, equipmentIdentity: identity, initialCalibrationModel: initial } });
  const poses = ["left_wrist", "right_wrist"].map((role, i) => ({ role, mode: "flow", geometryIdentity: "aerobeat/saber_capsule_v1", configIdentity: identity, anchor: { x: i + .12500000000000003, y: .40000000000000036, z: 0 }, scale: 2, orientation: { x: 0, y: 0, z: 0, w: 1 + Number.EPSILON } }));
  const frame = (timestampMs, rawPose = null) => ({ timestampMs, input: inputService.getSnapshot(), rawPose, modelKey: [inputService.getSnapshot().calibration.calibrationId, inputService.getSnapshot().calibration.state], getCalibrationModel: () => inputService.getCalibrationModel(), configurationKey: ["run"], getConfiguration: () => configuration, clock: { contextTimeSeconds: timestampMs / 1000, positionSeconds: 0, playing: false }, renderTimelineMs: 0, sessionState: "calibrating", equipmentPoses: null });
  recorder.record(frame(10)); // Pre-camera/pre-calibration -1 raw/equipment refs.
  const points = { nose: [.5, .3], left_shoulder: [.6, .4], right_shoulder: [.4, .4], left_elbow: [.7, .4], right_elbow: [.3, .4], left_wrist: [.8, .4], right_wrist: [.2, .4] };
  let raw;
  for (let index = 0; index <= 8; index++) {
    const timestampMs = 20 + index * 250;
    raw = { sourceId: "recorded-camera", timestampMs, mirrored: true, landmarks: Object.entries(points).map(([name, [x, y]]) => ({ name, x, y, confidence: .95, z: -.123, visibility: .91, presence: .99 })) };
    inputService.processPoseSample(raw);
    recorder.observe(frame(timestampMs, raw));
  }
  recorder.record({ ...frame(2020, raw), equipmentPoses: poses, clock: { contextTimeSeconds: 2.02, positionSeconds: 6, playing: true }, renderTimelineMs: 6000, sessionState: "playing" });
  recorder.record({ ...frame(2020, raw), equipmentPoses: poses, clock: { contextTimeSeconds: 2.02, positionSeconds: 2, playing: false }, renderTimelineMs: 2000, sessionState: "paused_manual" }); // Valid equal wall time, pause/seek.
  recorder.record({ ...frame(2030, raw), equipmentPoses: poses, clock: { contextTimeSeconds: 2.03, positionSeconds: 8, playing: false }, renderTimelineMs: 8000, sessionState: "playing", resultState: "completed" });
  const finalGameplay = { ...gameplay("completed"), judgements: [{ eventId: "note-1", result: "hit", tier: "great", timingOffsetMs: 35.41666666666674, evidenceTimestampMs: 2020, committedTimelinePositionMs: 6035.416666666667 }] };
  const result = buildAbJudgementCapture({ build, content, gameplay: finalGameplay, colliderSettings: { timingWindowMs: 180 }, movement: legacyUnitMovement(recorder, unitStore), capturedAtMs: 3000 });
  inputService.destroy();
  return result;
}
const mutable = () => JSON.parse(JSON.stringify(fixture()));
const parse = capture => parsePlayMovementCapture(JSON.stringify(capture));

test("writer round-trip retains original root, source numbers, initial metadata and resolved tick pairs", () => {
  const original = fixture(), capture = parse(original), m = capture.movement;
  assert.deepEqual(capture, original);
  assert.equal(capture.song.sourceVersionHash, "provider-neutral-source-v1", "not every recording is a 40-character BeatSaver identity");
  assert.equal(m.metadata.capture.movement, null);
  assert.equal(m.metadata.capture.run.state, "calibrating");
  assert.equal(m.complete, true);
  assert.equal(readMovementTick(capture, 0).equipmentPoses, null);
  assert.equal(readMovementTick(capture, 0).rawPose, null);
  for (let index = 0; index < m.ticks.length; index++) {
    const tick = readMovementTick(capture, index), row = m.ticks[index];
    assert.deepEqual(Object.keys(tick), ["index", "timestampMs", "clock", "input", "equipmentPoses", "rawPose", "calibrationModel", "configuration", "renderTimelineMs", "sessionState"]);
    assert.equal(tick.index, index);
    assert.equal(tick.timestampMs, row[0]);
    assert.deepEqual(tick.clock, { contextTimeSeconds: row[1], positionSeconds: row[2], playing: row[3] === 1 });
    assert.equal(tick.input, m.inputs[row[4]]);
    assert.equal(tick.calibrationModel, m.models[row[7]]);
    assert.equal(tick.configuration, m.configurations[row[8]]);
    assert.deepEqual(tick.equipmentPoses, recordedEquipmentPair(original.movement, row[5]));
  }
  const tick = readMovementTick(capture, 1);
  assert.equal(tick.equipmentPoses[0].orientation.w, 1 + Number.EPSILON, "validation must not renormalize even one ULP");
  assert.equal(tick.input.sourceIdentity, m.inputs.at(-1).sourceIdentity);
  assert.equal(tick.calibrationModel.calibrationId, "recorded-calibration-1");
  assert.equal(tick.rawPose.timestampMs, 2020);
  assert.equal(tick.rawPose.landmarks[0].z, -.123);
  assert.equal(readMovementTick(capture, 2).timestampMs, tick.timestampMs, "equal wall timestamps remain legal");
  assert.equal(readMovementTick(capture, 2).clock.positionSeconds, 2, "seek/pause observations are not pacing policy");
});

test("root, referenced observations and decoded equipment are deeply immutable", () => {
  const capture = parse(fixture()), tick = readMovementTick(capture, 1);
  const check = value => { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); for (const nested of Object.values(value)) check(nested); } };
  check(capture); check(tick);
  assert.throws(() => { capture.movement.ticks[0][0] = 99; }, TypeError);
  assert.throws(() => { tick.rawPose.landmarks[0].x = 99; }, TypeError);
  assert.throws(() => { tick.equipmentPoses[0].orientation.w = 0; }, TypeError);
  for (const index of [-1, .5, Infinity, capture.movement.ticks.length]) assert.throws(() => readMovementTick(capture, index), /tick index/);
});

test("-1 snapshot references decode to null without fabricating missing input", () => {
  const capture = mutable();
  for (let column = 4; column <= 8; column++) capture.movement.ticks[0][column] = -1;
  const tick = readMovementTick(parse(capture), 0);
  for (const name of ["input", "equipmentPoses", "rawPose", "calibrationModel", "configuration"]) assert.equal(tick[name], null);
});

test("judgement-only, unfinished, unsupported and partial files give clear errors", () => {
  let capture = mutable(); capture.version = 1;
  assert.throws(() => parse(capture), /unsupported capture.*judgement-only/);
  capture = mutable(); capture.movement = null;
  assert.throws(() => parse(capture), /movement recording is missing/);
  capture = mutable(); capture.movement.version = 2;
  assert.throws(() => parse(capture), /unsupported movement/);
  for (const status of ["recording", "truncated", "capture_error", "stopped"]) {
    capture = mutable(); capture.movement.status = status; capture.movement.complete = false;
    assert.throws(() => parse(capture), /incomplete, truncated or not completed/);
  }
  capture = mutable(); capture.run.state = "playing";
  assert.throws(() => parse(capture), /completed Play/);
  capture = mutable(); delete capture.movement.inputs;
  assert.throws(() => parse(capture), /movement fields/);
  capture = mutable(); capture.movement.metadata.capture = { ...capture.movement.metadata.capture, movement: {} };
  assert.throws(() => parse(capture), /initial Play header/);
  capture = mutable(); capture.movement.metadata.initialCalibrationModel.version = 2;
  assert.throws(() => parse(capture), /calibration model schema\/version/);
});

test("table counts, refs and declared columns cannot silently reinterpret data", () => {
  for (const [table, column] of [["ticks", 4], ["ticks", 5], ["ticks", 6], ["ticks", 7], ["ticks", 8], ["ticks", 10], ["observations", 1], ["observations", 2], ["observations", 3], ["observations", 4], ["equipment", 0]]) {
    for (const value of [-2, .5, 999999]) {
      const capture = mutable(); capture.movement[table][0][column] = value;
      assert.throws(() => parse(capture), /reference is invalid/);
    }
  }
  for (const name of ["tickFields", "observationFields", "equipmentValueFields"]) {
    const capture = mutable(); capture.movement[name].reverse();
    assert.throws(() => parse(capture), /columns are unsupported/);
  }
  for (const name of ["ticks", "observations", "equipment"]) {
    const capture = mutable(); capture.movement[name][0].pop();
    assert.throws(() => parse(capture), /finite numbers/);
  }
  let capture = mutable(); capture.movement.tickCount++;
  assert.throws(() => parse(capture), /counts do not match/);
  capture = mutable(); capture.movement.ticks[0][3] = 2;
  assert.throws(() => parse(capture), /audioPlaying/);
  capture = mutable(); capture.movement.inputs = Array(24001).fill({});
  assert.throws(() => parse(capture), /inputs table exceeds/);
});

test("raw snapshots and equipment metadata/quaternions are checked without normalization", () => {
  const changes = [
    [c => { c.movement.inputs[0] = []; }, /input snapshot/],
    [c => { c.movement.configurations[0] = null; }, /configuration snapshot/],
    [c => { c.movement.rawPoses[0].landmarks[0].x = "0.5"; }, /finite x\/y\/confidence/],
    [c => { c.movement.rawPoses[0].landmarks[0].visibility = null; }, /visibility must be finite/],
    [c => { c.movement.equipmentHeaders[0][0].role = "right_wrist"; }, /equipment metadata/],
    [c => { c.movement.equipmentHeaders[0][0].configIdentity.value = "not-an-identity"; }, /equipment metadata/],
    [c => { c.movement.equipment[0][8] = 0; }, /equipment pose\/quaternion/]
  ];
  for (const [change, error] of changes) { const capture = mutable(); change(capture); assert.throws(() => parse(capture), error); }
});

test("bounded JSON rejects malformed, nonfinite and excessively nested or large files", () => {
  assert.equal(maximumPlayMovementCaptureBytes, 64 * 1024 * 1024);
  assert.throws(() => parsePlayMovementCapture("{"), /invalid JSON/);
  assert.throws(() => parsePlayMovementCapture(null), /expected JSON text/);
  assert.throws(() => parsePlayMovementCapture(" ".repeat(maximumPlayMovementCaptureBytes + 1)), /64 MiB/);
  assert.throws(() => parsePlayMovementCapture(JSON.stringify(fixture()).replace('"estimatedBytes":', '"nonfinite":1e999,"estimatedBytes":')), /nonfinite number/);
  const capture = mutable(); let node = capture.options;
  for (let i = 0; i < 70; i++) { node.next = {}; node = node.next; }
  assert.throws(() => parse(capture), /nesting\/item limit/);
});

test("stream import preserves numeric rows and legacy File compatibility; facade owns disposal", async () => {
  const capture = fixture(); capture.movement.rawPoses[0].landmarks[0].z = -0;
  const unit = createUnitMovementStore(), { file } = await streamUnitFile(capture);
  const imported = await parsePlayMovementFile(file, { createStore: () => unit.store });
  assert.equal(imported.movement.version, 2);
  assert.equal(imported.movement.inputs, undefined);
  for (const table of Object.keys(imported.getCounts()).filter(name => !["metadata", "states"].includes(name))) assert.deepEqual(await imported.readRows(table, 0, imported.getCounts()[table]), capture.movement[table]);
  const legacy = await parsePlayMovementFile(new Blob([JSON.stringify(capture)]));
  assert.deepEqual(legacy, parse(capture));
  await imported.dispose(); assert.equal(unit.store.getStatus().state === "disposed", true);
  await assert.rejects(imported.readRows("ticks", 0, 1), /disposed/);
});

test("stream structural, reference, footer, truncation and nonfinite failures dispose partial imports", async () => {
  const changes = [
    event => event.type === "footer" ? null : event,
    event => { if (event.type === "header") event.header.movement.counts.inputs++; return event; },
    event => { if (event.type === "row" && event.table === "ticks") event.row[4] = 99999; return event; },
    event => { if (event.type === "row" && event.table === "equipment") event.row[8] = 0; return event; },
    event => { if (event.type === "row" && event.table === "ticks") event.row[3] = 3; return event; },
    event => { if (event.type === "row" && event.table === "rawPoses") event.row.landmarks[0].x = "bad"; return event; },
    event => { if (event.type === "header") event.header.movement.complete = false; return event; },
    event => { if (event.type === "footer") event.counts.ticks++; return event; },
    event => { if (event.type === "row" && event.table === "ticks") event.index++; return event; }
  ];
  for (const mutate of changes) {
    const unit = createUnitMovementStore(), { file } = await streamUnitFile(fixture(), { mutate });
    await assert.rejects(parsePlayMovementFile(file, { createStore: () => unit.store }));
    assert.equal(unit.store.getStatus().state === "disposed", true);
  }
  const { file } = await streamUnitFile(fixture());
  const unit = createUnitMovementStore();
  await assert.rejects(parsePlayMovementFile(file.slice(0, file.size - 10), { createStore: () => unit.store }));
  assert.equal(unit.store.getStatus().state === "disposed", true);
  const overflowing = new Blob([new TextEncoder().encode('{"type":"header","format":"aerobeat-movement-jsonl","version":1,"header":1e999}\n')]);
  const gzip = await new Response(overflowing.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  const bad = createUnitMovementStore();
  await assert.rejects(parsePlayMovementFile(gzip, { createStore: () => bad.store }), /nonfinite/);
  assert.equal(bad.store.getStatus().state === "disposed", true);
});

test("import cancellation and storage failures dispose admitted partial rows", async () => {
  const { file } = await streamUnitFile(fixture());
  for (const abort of [false, true]) {
    const unit = createUnitMovementStore(), controller = new AbortController(), append = unit.store.append;
    unit.store.append = (...args) => { const index = append(...args); if (abort) controller.abort(); else throw new Error("unit quota failure"); return index; };
    await assert.rejects(parsePlayMovementFile(file, { signal: controller.signal, createStore: () => unit.store }), abort ? /abort/i : /quota/);
    assert.equal(unit.store.getStatus().state === "disposed", true);
  }
});

test("shared unit-only store fault options reject writes/flushes and report disposal", async () => {
  const append = createUnitMovementStore({ failAfter: 1 });
  assert.equal(append.store.append("inputs", {}), 0);
  assert.throws(() => append.store.append("inputs", {}), /unit_append_failure/);
  assert.equal(append.store.getStatus().error.code, "unit_append_failure");
  const flush = createUnitMovementStore({ failFlush: true });
  flush.store.append("inputs", {});
  await assert.rejects(flush.store.flush(), /unit_flush_failure/);
  assert.equal(flush.rows.inputs.length, 1);
  await flush.store.dispose(); assert.equal(flush.rows.inputs.length, 0);
  assert.equal(flush.store.getStatus().state, "disposed");
});

test("abort interrupts a blocked native stream read and bounded records reject oversized/nested input", async () => {
  const { file } = await streamUnitFile(fixture()), controller = new AbortController(), unit = createUnitMovementStore();
  let requested, cancelled = false, onCancelled;
  const cancellation = new Promise(resolve => { onCancelled = resolve; });
  const waiting = new Promise(resolve => { requested = resolve; });
  const blocked = { slice: (...args) => file.slice(...args), stream: () => new ReadableStream({ pull() { requested(); return new Promise(() => {}); }, cancel() { cancelled = true; onCancelled(); } }) };
  const importing = parsePlayMovementFile(blocked, { signal: controller.signal, createStore: () => unit.store });
  await waiting; controller.abort(); await assert.rejects(importing, /abort/i);
  await cancellation;
  assert.equal(cancelled, true); assert.equal(unit.store.getStatus().state === "disposed", true);
  for (const large of [false, true]) {
    const malformed = await streamUnitFile(fixture(), { mutate(event) { if (event.type === "header") { if (large) event.header.options.extra = "x".repeat(MOVEMENT_MAX_LINE_BYTES); else { let next = event.header.options; for (let i = 0; i < 70; i++) { next.next = {}; next = next.next; } } } return event; } });
    const target = createUnitMovementStore();
    await assert.rejects(parsePlayMovementFile(malformed.file, { createStore: () => target.store }), large ? /bounded record size/ : /nesting/);
    assert.equal(target.store.getStatus().state === "disposed", true);
  }
});

test("stream import has no total64MiB or120000-tick gate (bounded procedural unit store)", async () => {
  const capture = fixture(), total = 120001, { file, logicalBytes } = await streamUnitFile(capture, { ticks: total, padding: 512 });
  assert.ok(logicalBytes > 64 * 1024 * 1024);
  const unit = createUnitMovementStore(), counts = unit.store.getCounts, append = unit.store.append;
  let ticks = 0, last = null;
  unit.store.append = (table, row) => { if (table !== "ticks") return append(table, row); last = row; return ticks++; };
  unit.store.getCounts = () => ({ ...counts(), ticks });
  const imported = await parsePlayMovementFile(file, { createStore: () => unit.store });
  assert.equal(imported.getCounts().ticks, total); assert.equal(last[0], total - 1);
  await imported.dispose();
});
