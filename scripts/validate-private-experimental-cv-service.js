// @ts-check
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLockedProductionCvService, createLockedVideoFrameSource } from "../src/production-cv-service.js";
import { createPrivateExperimentalCvService } from "../src/private-experimental-cv-service.js";

const originalVideo = globalThis.HTMLVideoElement;
const originalFrame = globalThis.VideoFrame;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
const timers = new Map();
let nextTimer = 0;
/** @type {typeof globalThis & {HTMLVideoElement:typeof HTMLVideoElement,VideoFrame:typeof VideoFrame}} */ (globalThis).HTMLVideoElement = class HTMLVideoElement { constructor() { this.readyState = 3; this.videoWidth = 640; this.videoHeight = 480; } };
/** @type {typeof globalThis & {HTMLVideoElement:typeof HTMLVideoElement,VideoFrame:typeof VideoFrame}} */ (globalThis).VideoFrame = class VideoFrame { constructor(source, options) { this.source = source; this.timestamp = options.timestamp; this.closed = false; } close() { this.closed = true; } };
/** @type {typeof globalThis & {HTMLVideoElement:typeof HTMLVideoElement,VideoFrame:typeof VideoFrame}} */ (globalThis).setInterval = (callback, interval) => { timers.set(++nextTimer, { callback, interval }); return nextTimer; };
/** @type {typeof globalThis & {HTMLVideoElement:typeof HTMLVideoElement,VideoFrame:typeof VideoFrame}} */ (globalThis).clearInterval = (timer) => { timers.delete(timer); };

try {
  const video = new globalThis.HTMLVideoElement();
  // Both production and experiment consume this exact unchanged camera source.
  const productionVideoSource = createLockedVideoFrameSource(video, { sourceId: "camera", mirrored: true });
  assert.equal(productionVideoSource.frameSource, video);
  assert.equal(productionVideoSource.isFrameAvailable(), true);
  assert.equal(productionVideoSource.frameWidth(), 640);
  const steadySource = { ...productionVideoSource, getTimestampMs: () => 12.345 };
  for (const selectedDelegate of ["gpu-webgl", "cpu-wasm"]) {
    const provider = selectedDelegate === "gpu-webgl" ? "webgl" : "wasm";
    const events = [];
    const gates = [];
    let inAdapter = 0, maxInAdapter = 0;
    let execution = { location: "worker", provider, fallback: false, runtimeInferenceDurationMs: 12, estimateDurationMs: 14 };
    const adapter = {
      vendorId: "mediapipe-tasks-vision",
      async load() { events.push("load"); },
      getExecutionStatus() { return { mode: "worker", delegate: selectedDelegate }; },
      getExecutionTelemetry() { return execution; },
      async estimateNormalizedPoseFrame(frame, options) {
        inAdapter++; maxInAdapter = Math.max(maxInAdapter, inAdapter);
        events.push({ frame, options });
        const gate = deferred(); gates.push(gate);
        await gate.promise;
        frame.close(); inAdapter--;
        return { timestampMs: options.timestampMs, id: gates.length };
      },
      async dispose() { events.push("dispose"); }
    };
    const privateCv = createPrivateExperimentalCvService({ poseAdapter: adapter, selectedDelegate });
    const productionCv = selectedDelegate === "cpu-wasm" ? createLockedProductionCvService({ poseAdapter: adapter }) : null;
    assert.equal(privateCv.getStatus().providerId, null, "unloaded adapter cannot claim measured provider");
    assert.deepEqual(privateCv.getPerformanceSample(), { running: false, submittedFrameCount: 0, poseFrameCount: 0, runtimeInferenceDurationMs: null, estimateDurationMs: null }, "pre-load sample must have null durations and no actual provider claim");
    await privateCv.start(steadySource);
    assert.equal(privateCv.getStatus().providerId, selectedDelegate);
    assert.equal(privateCv.getStatus().lifecycleState, "running");
    assert.equal(privateCv.getStatus().submissionCadenceTargetFps, 15);
    const timer = [...timers.values()][0];
    assert.equal(timer.interval, 67);
    privateCv.submitFrame();
    await tick();
    assert.equal(gates.length, 1);
    const first = events[1];
    assert.equal(first.frame.timestamp, 12345);
    assert.deepEqual(first.options, { sourceId: "camera", timestampMs: 12.345, mirrored: true, flipHorizontal: false, frameWidth: 640, frameHeight: 480 });
    timer.callback(); privateCv.submitFrame();
    assert.equal(privateCv.getStatus().submittedFrameCount, 1);
    assert.equal(privateCv.getStatus().droppedFrameCount, 2);
    const fresh = privateCv.nextPoseFrame();
    gates[0].resolve(); await tick();
    assert.equal(first.frame.closed, true, "vendor owns closing accepted transfer frame");
    assert.equal(gates.length, 2, "fresh request waits for first inference, then submits a new frame");
    assert.equal(events[2].frame.timestamp, 12346, "reused capture timestamps advance monotonically");
    gates[1].resolve();
    assert.equal((await fresh).id, 2);
    assert.equal(maxInAdapter, 1);
    assert.equal(privateCv.getLatestPoseFrame().timestampMs, 12.346);
    assert.deepEqual(privateCv.getPerformanceSample(), { running: true, submittedFrameCount: 2, poseFrameCount: 2, runtimeInferenceDurationMs: 12, estimateDurationMs: 14 });
    assert.equal(privateCv.getStatus().latestPoseTimestampMs, 12.346);
    await privateCv.stop();
    assert.equal(timers.size, 0);
    assert.equal(privateCv.getLatestPoseFrame(), undefined);
    assert.equal(privateCv.getStatus().lifecycleState, "stopped");
    await privateCv.dispose(); await privateCv.dispose();
    assert.equal(privateCv.getStatus().lifecycleState, "disposed");
    assert.equal(events.filter(event => event === "dispose").length, 1);
    await assert.rejects(() => privateCv.start(steadySource), /disposed/u);
    if (productionCv) {
      await productionCv.start(steadySource);
      assert.equal([...timers.values()][0].interval, 67, "CPU cadence matches locked production");
      productionCv.submitFrame(); await tick();
      assert.equal(gates.length, 3);
      [...timers.values()][0].callback(); productionCv.submitFrame();
      assert.equal(productionCv.getStatus().droppedFrameCount, 2);
      gates[2].resolve(); await tick();
      assert.deepEqual(productionCv.getPerformanceSample(), { running: true, submittedFrameCount: 1, poseFrameCount: 1, runtimeInferenceDurationMs: 12, estimateDurationMs: 14 });
      await productionCv.dispose();
    }
  }
  for (const selectedDelegate of ["cpu-wasm", "gpu-webgl"]) {
    const expectedProvider = selectedDelegate === "gpu-webgl" ? "webgl" : "wasm";
    for (const telemetry of [undefined, {}, { location: "worker", fallback: false }, { location: "worker", provider: selectedDelegate === "gpu-webgl" ? "wasm" : "webgl", fallback: false }, { location: "main-thread", provider: expectedProvider, fallback: false }, { location: "worker", provider: expectedProvider }, { location: "worker", provider: expectedProvider, fallback: true }]) {
      const cv = createPrivateExperimentalCvService({ selectedDelegate, poseAdapter: makeAdapter(selectedDelegate, () => telemetry) });
      await assert.rejects(() => cv.start(steadySource), /telemetry is missing|execution location contradicted|actual execution provider contradicted|execution fallback contradicted/u);
      assert.equal(cv.getStatus().providerId, null);
      await cv.dispose();
    }
    const mismatch = createPrivateExperimentalCvService({ selectedDelegate, poseAdapter: makeAdapter(selectedDelegate === "gpu-webgl" ? "cpu-wasm" : "gpu-webgl", () => ({ location: "worker", provider: expectedProvider, fallback: false })) });
    await assert.rejects(() => mismatch.start(steadySource), /requested delegate contradicted/u);
    assert.deepEqual(mismatch.getPerformanceSample(), { running: false, submittedFrameCount: 0, poseFrameCount: 0, runtimeInferenceDurationMs: null, estimateDurationMs: null }, "failed load cannot claim runtime performance");
    await mismatch.dispose();
    const drift = { location: "worker", provider: expectedProvider, fallback: false };
    const cv = createPrivateExperimentalCvService({ selectedDelegate, poseAdapter: makeAdapter(selectedDelegate, () => drift) });
    await cv.start(steadySource);
    drift.provider = selectedDelegate === "gpu-webgl" ? "wasm" : "webgl";
    assert.throws(() => cv.getStatus(), /actual execution provider contradicted/u, "runtime provider drift must not be labeled requested provider");
    await cv.dispose();
  }
  for (const value of [undefined, "webgl", "wasm", "GPU", null]) assert.throws(() => createPrivateExperimentalCvService({ selectedDelegate: value, poseAdapter: makeAdapter("gpu-webgl", () => undefined) }), /selectedDelegate/u);
  for (const value of [0, -1, 15.01, Infinity]) assert.throws(() => createPrivateExperimentalCvService({ selectedDelegate: "gpu-webgl", submissionCadenceTargetFps: value, poseAdapter: makeAdapter("gpu-webgl", () => undefined) }), /15fps ceiling/u);
  const productionSource = await readFile(new URL("../src/production-cv-service.js", import.meta.url), "utf8");
  const experimentSource = await readFile(new URL("../src/private-experimental-cv-service.js", import.meta.url), "utf8");
  const productionAdmission = productionSource.slice(productionSource.indexOf("  async function estimate(token) {"), productionSource.indexOf("  /** @param {number} token @param {ReturnType<typeof normalizeSource>} source */"));
  const experimentAdmission = experimentSource.slice(experimentSource.indexOf("  async function estimate(token) {"), experimentSource.indexOf("  /** @param {number} token @param {ReturnType<typeof normalizeSource>} source */"));
  assert.equal(experimentAdmission, productionAdmission, "negative mutant: any changed drop/admission path must fail CPU parity");
  assert.notEqual(experimentAdmission.replace("droppedFrameCount += 1", "droppedFrameCount += 0"), productionAdmission, "wrong-drop mutant is caught");
  assert.equal(timers.size, 0);
  console.log("private experimental CV CPU parity, worker transfer, GPU identity and fail-closed telemetry passed");
} finally {
  /** @type {typeof globalThis & {HTMLVideoElement:typeof HTMLVideoElement,VideoFrame:typeof VideoFrame}} */ (globalThis).HTMLVideoElement = originalVideo;
  /** @type {typeof globalThis & {HTMLVideoElement:typeof HTMLVideoElement,VideoFrame:typeof VideoFrame}} */ (globalThis).VideoFrame = originalFrame;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
}

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function tick() { return new Promise(resolve => setTimeout(resolve, 0)); }
function makeAdapter(delegate, telemetry) { return { vendorId: "mediapipe-tasks-vision", async load() {}, getExecutionStatus() { return { mode: "worker", delegate }; }, getExecutionTelemetry: telemetry, async estimateNormalizedPoseFrame(frame, options) { frame.close(); return { timestampMs: options.timestampMs }; }, async dispose() {} }; }
