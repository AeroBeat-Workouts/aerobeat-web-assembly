// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { abCaptureFilename, abCaptureReadiness, buildAbJudgementCapture } from "../src/ab-judgement-capture.js";

/** A finished Flow run with a hit, a timing miss and a direction miss. */
function finishedRun() {
  return {
    session: { state: "completed", purpose: "play", sessionId: "session-1", ranked: false },
    rulesetId: "flow_colliders_v1",
    chartId: "chart-1",
    judgements: [
      { eventId: "note-1", result: "hit", tier: "great", timingOffsetMs: 3, diagnostics: [] },
      { eventId: "note-2", result: "miss", tier: "miss", diagnostics: ["out_of_window"] },
      { eventId: "note-3", result: "hit", tier: "good", timingOffsetMs: -8, diagnostics: ["direction_marginal"] },
      { eventId: "note-4", result: "hit", tier: "almost", timingOffsetMs: 61 }
    ]
  };
}

function sampleContent() {
  return {
    packageId: "1a2b3c",
    song: { songName: "Probe Test Song" },
    selectedVariant: { difficulty: "Expert", characteristic: "Standard", variantId: "variant-1" }
  };
}

test("capture records build, song, difficulty and the run's real options", () => {
  const capture = buildAbJudgementCapture({
    build: { version: "0.0.153", buildStamp: "BUILD-STAMP" },
    gameplay: finishedRun(),
    content: sampleContent(),
    colliderSettings: { colliderScale: 1, colliderDepthForward: 1, colliderDepthBackward: 1, colliderDepthBackwardAthleteFacing: true, timingWindowMs: 150 },
    capturedAtMs: 1762000000000
  });
  assert.equal(capture.schema, "aerobeat/ab_judgement_capture");
  assert.equal(capture.version, 1);
  assert.equal(capture.build.version, "0.0.153");
  assert.equal(capture.build.buildStamp, "BUILD-STAMP");
  assert.equal(capture.song.name, "Probe Test Song");
  assert.equal(capture.song.id, "1a2b3c");
  assert.equal(capture.song.difficulty, "Expert");
  assert.equal(capture.song.rulesetId, "flow_colliders_v1");
  assert.equal(capture.options.colliderScale, 1);
  assert.equal(capture.options.colliderDepthBackward, 1);
  assert.equal(capture.options.colliderDepthBackwardAthleteFacing, true);
});

test("capture keeps diagnostic codes, which explain why a note was missed", () => {
  const capture = buildAbJudgementCapture({ gameplay: finishedRun(), content: sampleContent() });
  assert.equal(capture.judgements.length, 4);
  const miss = capture.judgements.find((entry) => entry.eventId === "note-2");
  assert.deepEqual(miss?.diagnostics, ["out_of_window"]);
  const direction = capture.judgements.find((entry) => entry.eventId === "note-3");
  assert.deepEqual(direction?.diagnostics, ["direction_marginal"]);
  // A judgement with no diagnostics must not invent any.
  const none = capture.judgements.find((entry) => entry.eventId === "note-4");
  assert.equal(none?.diagnostics, undefined);
});

test("summary counts each result so the two builds can be compared at a glance", () => {
  const capture = buildAbJudgementCapture({ gameplay: finishedRun(), content: sampleContent() });
  assert.equal(capture.summary.totalJudgements, 4);
  assert.deepEqual(capture.summary.byResult, { hit: 3, miss: 1 });
});

test("capture is disabled until a run finishes with judgements", () => {
  assert.equal(abCaptureReadiness({ session: { state: "idle" }, judgements: [] }).ready, false);
  assert.equal(abCaptureReadiness(finishedRun()).ready, true);
  // A mid-song export would be indistinguishable from a complete one.
  const midSong = abCaptureReadiness({ session: { state: "playing" }, judgements: [{ eventId: "a", result: "hit" }] });
  assert.equal(midSong.ready, false);
  assert.equal(midSong.count, 1);
});

test("missing identity stays null instead of being invented", () => {
  const capture = buildAbJudgementCapture({ gameplay: { session: { state: "completed" }, judgements: [{ eventId: "a", result: "hit" }] } });
  assert.equal(capture.build.version, null);
  assert.equal(capture.song.name, null);
  assert.equal(capture.song.difficulty, null);
  assert.equal(capture.summary.totalJudgements, 1);
});

test("malformed judgements are dropped rather than recorded as fake results", () => {
  const capture = buildAbJudgementCapture({
    gameplay: { session: { state: "completed" }, judgements: [null, {}, { eventId: "" }, { eventId: "real", result: "hit" }] }
  });
  assert.deepEqual(capture.judgements.map((entry) => entry.eventId), ["real"]);
});

test("real snapshot lineage and nested run options survive export", () => {
  const content = { ...sampleContent(), lineage: { difficulty: "ExpertPlus", sourceId: "beatsaver-map-id", sourceVersionHash: "source-hash" }, selectedVariant: { mode: "flow", rulesetId: "flow_colliders_v1", chartId: "chart-1" } };
  const setup = { timingWindowMs: 180, repeatedPunchSwitchChancePercent: 100, flowColliderVolume: { colliderScale: 1.5, colliderDepthForward: 1, colliderDepthBackward: 0, colliderDepthBackwardAthleteFacing: false }, boxingColliderVolume: { colliderScale: 2, colliderDepthBackward: 1 } };
  const capture = buildAbJudgementCapture({ content, gameplay: finishedRun(), colliderSettings: setup });
  assert.equal(capture.song.difficulty, "ExpertPlus");
  assert.equal(capture.song.sourceId, "beatsaver-map-id");
  assert.equal(capture.options.colliderScale, 1.5);
  assert.equal(capture.options.colliderDepthBackward, 0);
  assert.equal(capture.options.colliderDepthBackwardAthleteFacing, false);
  assert.equal(capture.options.repeatedPunchSwitchChancePercent, 100);
  assert.deepEqual(capture.options.boxingColliderVolume, setup.boxingColliderVolume);
});

test("filename identifies the run without opening the file", () => {
  const capture = buildAbJudgementCapture({
    build: { version: "0.0.149" },
    gameplay: finishedRun(),
    content: { packageId: "15f9", selectedVariant: { difficulty: "ExpertPlus" } }
  });
  assert.equal(abCaptureFilename(capture, "json"), "aerobeat-ab-0.0.149-15f9-ExpertPlus.json");
  // Unsafe characters cannot escape the download name.
  const unsafe = buildAbJudgementCapture({
    build: { version: "0.0.153" },
    gameplay: finishedRun(),
    content: { packageId: "../../etc/passwd", selectedVariant: { difficulty: "Expert" } }
  });
  const name = abCaptureFilename(unsafe, "json");
  assert.equal(name.includes(".."), false);
  assert.equal(name.includes("/"), false);
});