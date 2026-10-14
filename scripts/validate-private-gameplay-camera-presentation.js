// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPrivateGameplayCameraPresentation } from "../src/private-gameplay-camera-presentation.js";
import { createPrivateExperimentalCvService } from "../src/private-experimental-cv-service.js";

class FakeVideo {
  readyState = 4;
  videoWidth = 640;
  videoHeight = 480;
  callbacks = new Map();
  nextId = 1;
  cancellations = 0;
  requestVideoFrameCallback(callback) { const id = this.nextId++; this.callbacks.set(id, callback); return id; }
  cancelVideoFrameCallback(id) { this.cancellations++; this.callbacks.delete(id); }
  present(metadata) { const [id, callback] = this.callbacks.entries().next().value ?? []; if (!callback) return; this.callbacks.delete(id); callback(0, metadata); }
}
globalThis.HTMLVideoElement = FakeVideo;
const video = new FakeVideo();
const first = createPrivateGameplayCameraPresentation(video, { sourceId: "test-camera", mirrored: true });
assert.equal(Object.getOwnPropertyDescriptor(first.source, "getPresentedFrameId")?.enumerable, true);
assert.equal(first.source.getPresentedFrameId(), null, "no callback means no presentation identity");
assert.equal(video.callbacks.size, 1);
video.present({ presentedFrames: 1 });
assert.equal(first.source.getPresentedFrameId(), 1);
video.present({ presentedFrames: 1 });
assert.equal(first.source.getPresentedFrameId(), 1, "frozen identity never advances with time");
video.present({ presentedFrames: 2 });
assert.equal(first.source.getPresentedFrameId(), 2);
video.present({ presentedFrames: 0 });
assert.equal(first.source.isFrameAvailable(), true, "ready failed source must reach the terminal getter");
assert.throws(() => first.source.getPresentedFrameId(), /identity failed/, "regressed ID fails closed");
assert.equal(video.callbacks.size, 0, "failed presentation has no queued callback");
first.dispose();
assert.equal(first.source.isFrameAvailable(), false);
assert.equal(first.source.getPresentedFrameId(), null);
const second = createPrivateGameplayCameraPresentation(video, { sourceId: "replacement", mirrored: true });
assert.equal(second.source.getPresentedFrameId(), null, "replacement cannot inherit the prior ID");
video.present({ presentedFrames: 7 });
assert.equal(second.source.getPresentedFrameId(), 7);
const queued = video.callbacks.values().next().value;
second.dispose();
assert.equal(video.cancellations, 1);
assert.equal(video.callbacks.size, 0);
queued(0, { presentedFrames: 8 });
assert.equal(second.source.getPresentedFrameId(), null, "late callback cannot resurrect a disposed source");
second.dispose();
assert.equal(video.cancellations, 1);
const invalid = createPrivateGameplayCameraPresentation(video, { sourceId: "invalid", mirrored: false });
video.present({ presentedFrames: NaN });
assert.equal(invalid.source.isFrameAvailable(), true, "malformed callback cannot become no-frame retry");
assert.throws(() => invalid.source.getPresentedFrameId(), /identity failed/);
invalid.dispose();

// Exercise the real after-result service boundary with virtual timers: a
// malformed/regressed callback must enter error, not schedule an endless retry.
const originalTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalFrame = globalThis.VideoFrame;
class FakeFrame { constructor() {} close() {} }
globalThis.VideoFrame = FakeFrame;
const timers = new Map(); let nextTimer = 0;
globalThis.setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; };
globalThis.clearTimeout = (id) => { timers.delete(id); };
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
async function fireTimer() {
  const [id, timer] = timers.entries().next().value ?? [];
  assert.ok(timer, "expected a bounded scheduler opportunity");
  timers.delete(id); timer.callback(); await flush();
}
try {
  for (const badIds of [[NaN], [4, 3]]) {
    const camera = new FakeVideo();
    const presentation = createPrivateGameplayCameraPresentation(camera, { sourceId: "camera", mirrored: true });
    let transfers = 0;
    const adapter = {
      vendorId: "mediapipe-tasks-vision", async load() {},
      getExecutionStatus: () => ({ mode: "worker", delegate: "gpu-webgl" }),
      getExecutionTelemetry: () => ({ location: "worker", provider: "webgl", fallback: false }),
      async estimateNormalizedPoseFrame(frame, options) { transfers++; frame.close(); return { timestampMs: options.timestampMs }; },
      async dispose() {}
    };
    let clock = 0;
    const cv = createPrivateExperimentalCvService({ poseAdapter: adapter, selectedDelegate: "gpu-webgl", schedulingMode: "after-result", now: () => clock });
    await cv.start(presentation.source);
    camera.readyState = 0;
    await fireTimer();
    assert.equal(cv.getStatus().lifecycleState, "running", "ordinary absent video frame uses bounded retry");
    assert.equal(timers.size, 1);
    camera.readyState = 4;
    await fireTimer();
    assert.equal(cv.getStatus().lifecycleState, "running", "initial null ID uses bounded retry");
    assert.equal(timers.size, 1);
    if (badIds.length === 2) {
      camera.present({ presentedFrames: badIds[0] });
      await fireTimer();
      assert.equal(cv.getStatus().lifecycleState, "running", "first valid presentation must be admitted");
      assert.equal(cv.getStatus().submittedFrameCount, 1);
      assert.equal(transfers, 1);
    }
    camera.present({ presentedFrames: badIds.at(-1) });
    camera.readyState = 0;
    assert.equal(presentation.source.isFrameAvailable(), true, "terminal callback must bypass concurrent video unready state");
    clock = 1000;
    await fireTimer();
    assert.equal(cv.getStatus().lifecycleState, "error", "asynchronous bad camera callback must terminate CV");
    assert.match(cv.getStatus().error, /presentation identity failed/);
    assert.equal(cv.getStatus().submittedFrameCount, badIds.length === 2 ? 1 : 0);
    assert.equal(transfers, badIds.length === 2 ? 1 : 0, "failure cannot submit another frame");
    assert.equal(timers.size, 0, "failure must not leave a queued retry");
    presentation.dispose();
    assert.equal(camera.callbacks.size, 0);
    await cv.dispose();
  }
} finally {
  globalThis.setTimeout = originalTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  globalThis.VideoFrame = originalFrame;
}
const gameSource = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const startBody = gameSource.match(/  async startCv\(\) \{([\s\S]*?)\n  \}/u)?.[1] ?? "";
assert.match(startBody, /await this\.graph\.cv\.start\(this\.activeCvSource\)/u);
assert.doesNotMatch(startBody, /this\.graph\.cv\.stop\(/u, "stale start continuation must never stop replacement");
// Run the actual AeroGame startCv body against a queued-start CV fake. A remains
// pending as B is attached; resolving A must neither stop nor invalidate B.
const startCv = new Function(`return async function startCv() { ${startBody} }`)();
const previousDocument = globalThis.document;
globalThis.document = { hidden: false };
try {
  let resolveA; let resolveB; let stopped = 0; const starts = [];
  const sourceA = { sourceId: "A" }, sourceB = { sourceId: "B" };
  const cv = {
    start(source) {
      starts.push(source);
      return new Promise((resolve) => { if (source === sourceA) resolveA = resolve; else resolveB = resolve; });
    },
    async stop() { stopped++; }
  };
  const game = { graph: { gameplay: { getSnapshot: () => ({ session: { purpose: "play" } }) }, cv }, activeCvSource: sourceA, privateCameraPresentation: { source: sourceA } };
  const oldStart = startCv.call(game);
  game.activeCvSource = sourceB; game.privateCameraPresentation = { source: sourceB };
  const newStart = startCv.call(game);
  assert.deepEqual(starts, [sourceA, sourceB]);
  resolveA(); await oldStart;
  assert.equal(stopped, 0, "old source A completion cannot cancel queued source B");
  resolveB(); await newStart;
  assert.equal(stopped, 0);
} finally { globalThis.document = previousDocument; }
const snapshot = gameSource.match(/  getSnapshot\(\) \{([\s\S]*?)\n  \}\n\n  \/\*\*/u)?.[1] ?? "";
assert.match(snapshot, /const candidate = typeof __AEROBEAT_PRIVATE_GAMEPLAY_CV_MODE__[^;]*=== "gpu-after-result"/u);
assert.match(snapshot, /const cvStatus = candidate && graph \? graph\.cv\.getStatus\(\) : null/u);
assert.match(snapshot, /cvStatus\?\.providerId === "gpu-webgl" \|\| cvStatus\?\.providerId === "cpu-wasm" \? cvStatus\.providerId : null/u, "unproven Worker must not be labeled GPU");
assert.match(snapshot, /requestedProviderId: "gpu-webgl", schedulingMode: "after-result"/u);
assert.match(snapshot, /: lockedProductionCvProfile/u, "default must keep the exact locked profile");
assert.match(snapshot, /lease: aeroGameMediaLeaseCoordinator\.snapshot\(\), cvProfile,/u);
console.log("PASS private gameplay camera callback identity, freeze, lifecycle and snapshot profile wiring");
