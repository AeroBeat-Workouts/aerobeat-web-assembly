// @ts-check
// Local capacity regression. Personal trajectories are never copied into the repo.
// A repeated/rebased continuation tests storage only; it is NOT recovered movement.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPlayMovementRecorder, recordedEquipmentPair } from "../src/play-movement-recording.js";

const file = process.env.AEROBEAT_RECORDING_CAPACITY_FILE;
assert(file, "Set AEROBEAT_RECORDING_CAPACITY_FILE to a local measured capture");
const capture = JSON.parse(readFileSync(file, "utf8")), source = capture.movement;
const playing = source.ticks.filter(tick => source.states[tick[10]] === "playing");
assert(playing.length > 2);
const first = playing[0], last = playing.at(-1), span = last[2] - first[2];
assert(span > 1);
const duration = Number(process.env.AEROBEAT_RECORDING_CAPACITY_SECONDS ?? 270);
assert(Number.isFinite(duration) && duration >= span && duration <= 600);
const renderRate = (playing.length - 1) / span;
const recorder = createPlayMovementRecorder({ metadata: source.metadata });
let lastInputIndex = -1, previousCycle = -1, input, rawPose;
const modelIndex = first[7], configurationIndex = first[8];
// Match measured snapshot sizes and timestamp precision, retaining every generated
// observation and advance. Rebase only the synthetic second-and-later cycles.
const shift = (value, delta) => {
  if (Array.isArray(value)) return value.map(v => shift(v, delta));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, typeof v === "number" && /timestampMs$/i.test(key) ? v + delta : shift(v, delta)]));
};
const total = Math.ceil(duration * renderRate);
for (let index = 0; index <= total; index++) {
  const cycle = Math.floor(index / playing.length), tick = playing[index % playing.length];
  const delta = cycle * (last[0] - first[0] + 1000 / renderRate);
  if (tick[4] !== lastInputIndex || cycle !== previousCycle) {
    input = shift(source.inputs[tick[4]], delta);
    rawPose = shift(source.rawPoses[tick[6]], delta);
    lastInputIndex = tick[4]; previousCycle = cycle;
  }
  const songSeconds = index / renderRate;
  const ok = recorder.record({ timestampMs: tick[0] + delta, input, rawPose,
    modelKey: [modelIndex], configurationKey: [configurationIndex],
    getCalibrationModel: () => source.models[modelIndex],
    getConfiguration: () => source.configurations[configurationIndex],
    equipmentPoses: recordedEquipmentPair(source, tick[5]),
    clock: { contextTimeSeconds: tick[1] + cycle * span, positionSeconds: songSeconds, playing: true },
    renderTimelineMs: songSeconds * 1000, sessionState: "playing", resultState: index === total ? "completed" : "playing" });
  assert(ok, `Full-song capacity failed at ${songSeconds.toFixed(3)}s: ${JSON.stringify(recorder.getStatus())}`);
}
const status = recorder.getStatus();
assert.equal(status.complete, true); assert.equal(status.tickCount, total + 1);
console.log(JSON.stringify({ pass: true, kind: "measured-prefix with synthetic repeated continuation; storage only", durationSeconds: duration, renderRate, ...status }));
