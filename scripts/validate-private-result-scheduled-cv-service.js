// @ts-check
import assert from 'node:assert/strict';
import { createPrivateExperimentalCvService } from '../src/private-experimental-cv-service.js';

const original = { video: globalThis.HTMLVideoElement, frame: globalThis.VideoFrame, interval: globalThis.setInterval, clearInterval: globalThis.clearInterval, timeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
let clock = 0, nextTimer = 0;
const timers = new Map();
class Video { constructor() { this.videoWidth = 640; this.videoHeight = 480; } }
class Frame { constructor(video, options) { this.video = video; this.timestamp = options.timestamp; this.closed = false; } close() { this.closed = true; } }
globalThis.HTMLVideoElement = /** @type {typeof HTMLVideoElement} */ (/** @type {unknown} */ (Video));
globalThis.VideoFrame = /** @type {typeof VideoFrame} */ (/** @type {unknown} */ (Frame));
globalThis.setTimeout = /** @type {typeof setTimeout} */ (/** @type {unknown} */ ((fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, at: clock + ms, period: 0 }); return id; }));
globalThis.clearTimeout = /** @type {typeof clearTimeout} */ (/** @type {unknown} */ ((id) => timers.delete(id)));
globalThis.setInterval = /** @type {typeof setInterval} */ (/** @type {unknown} */ ((fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, at: clock + ms, period: ms }); return id; }));
globalThis.clearInterval = /** @type {typeof clearInterval} */ (/** @type {unknown} */ ((id) => timers.delete(id)));
const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
async function advance(to) {
  for (let safety = 0; safety < 2000; safety++) {
    let chosen, at = Infinity;
    for (const [id, timer] of timers) if (timer.at < at && timer.at <= to) { chosen = id; at = timer.at; }
    if (!chosen) break;
    clock = at;
    const timer = timers.get(chosen); if (!timer) continue;
    if (timer.period) timer.at += timer.period; else timers.delete(chosen);
    timer.fn(); await flush();
  }
  clock = to; await flush();
}
function setup(mode = 'after-result', provider = 'webgl') {
  let available = true, presentedFrameId = 0, active = 0, peak = 0, sequence = 0;
  const starts = [], transferred = [], pending = [];
  // Production's source timestamps are read-time clock values, not distinct presentation IDs.
  const source = { sourceId: 'camera', mirrored: true, frameSource: new Video(), getTimestampMs: () => clock, isFrameAvailable: () => available, frameWidth: () => 640, frameHeight: () => 480, getPresentedFrameId: () => presentedFrameId };
  const adapter = {
    vendorId: 'mediapipe-tasks-vision', async load() {},
    getExecutionStatus: () => ({ mode: 'worker', delegate: 'gpu-webgl' }),
    getExecutionTelemetry: () => ({ location: 'worker', provider, fallback: false, runtimeInferenceDurationMs: 74, estimateDurationMs: 75 }),
    async estimateNormalizedPoseFrame(frame, options) {
      active++; peak = Math.max(peak, active); starts.push(clock); transferred.push(frame);
      const id = ++sequence;
      await new Promise(resolve => pending.push(resolve));
      frame.close(); active--; return { timestampMs: options.timestampMs, id };
    }, async dispose() {}
  };
  const cv = createPrivateExperimentalCvService({ poseAdapter: adapter, selectedDelegate: 'gpu-webgl', schedulingMode: mode, now: () => clock });
  return { cv, source, starts, transferred, pending, get peak() { return peak; }, setAvailable(value) { available = value; }, setPresentedFrameId(value) { presentedFrameId = value; }, finish() { assert.ok(pending.length); pending.shift()(); } };
}
try {
  assert.throws(() => createPrivateExperimentalCvService({ poseAdapter: {}, selectedDelegate: 'gpu-webgl', schedulingMode: 'unknown' }), /schedulingMode/);
  const missingId = setup();
  const { getPresentedFrameId: unused, ...baselineSource } = missingId.source;
  await assert.rejects(() => missingId.cv.start(baselineSource), /requires getPresentedFrameId/);
  assert.equal(missingId.cv.getStatus().submittedFrameCount, 0);
  const invalid = setup('after-result', 'wasm');
  assert.equal(invalid.cv.getStatus().schedulingMode, 'after-result');
  await assert.rejects(() => invalid.cv.start(invalid.source), /provider contradicted/);
  assert.equal(invalid.cv.getStatus().providerId, null);
  assert.equal(timers.size, 0);
  await invalid.cv.dispose();
  const defaultMode = createPrivateExperimentalCvService({ poseAdapter: {}, selectedDelegate: 'gpu-webgl' });
  assert.equal(defaultMode.getStatus().schedulingMode, 'fixed-tick', 'default retains the old signed source policy');

  // A 30fps presentedFrames source with 80ms inference: fixed 67ms ticks drop the busy opportunity.
  // Presented IDs prove distinct video-element presentations, not distinct sensor captures.
  async function scenario(mode) {
    clock = 0;
    const run = setup(mode);
    assert.equal(run.cv.getStatus().schedulingMode, mode);
    const { getPresentedFrameId: unusedForFixed, ...fixedSource } = run.source;
    await run.cv.start(mode === 'fixed-tick' ? fixedSource : run.source);
    for (let t = 0; t < 1000; t += 1) {
      // Simulated 30fps requestVideoFrameCallback(metadata.presentedFrames).
      if (t % 33 === 0) run.setPresentedFrameId(1 + Math.floor(t / 33));
      await advance(t);
      while (run.pending.length && clock - run.starts[run.starts.length - 1] >= 80) { run.finish(); await flush(); }
    }
    await run.cv.stop();
    while (run.pending.length) { run.finish(); await flush(); }
    assert.equal(timers.size, 0);
    assert.equal(run.peak, 1, 'never transfer to concurrent Worker estimates');
    assert.ok(run.starts.every((time, index) => index === 0 || time - run.starts[index - 1] >= 67), '≤15 accepted submissions per second');
    assert.ok(run.transferred.every(frame => frame.closed || frame === run.transferred.at(-1)));
    await run.cv.dispose();
    return run.starts.length;
  }
  const fixed = await scenario('fixed-tick');
  const after = await scenario('after-result');
  assert.ok(after > fixed, `after-result must admit more distinct presented-frame poses than fixed-tick (${after} vs ${fixed})`);
  assert.ok(after <= 15);

  clock = 0;
  const retry = setup(); retry.setAvailable(false);
  await retry.cv.start(retry.source);
  await advance(0); assert.equal(retry.starts.length, 0);
  assert.equal(timers.size, 1, 'no-frame retry has one bounded timer, no spin');
  await advance(80); assert.equal(retry.starts.length, 0);
  retry.setAvailable(true); retry.setPresentedFrameId(undefined); await advance(150);
  assert.equal(retry.starts.length, 0, 'missing presentation ID fails closed without a Worker submit');
  assert.equal(retry.cv.getStatus().lifecycleState, 'error');
  assert.equal(retry.cv.getStatus().submittedFrameCount, 0);
  assert.equal(timers.size, 0);
  await retry.cv.dispose();
  clock = 0;
  const beforeFirstCallback = setup(); beforeFirstCallback.setPresentedFrameId(null);
  await beforeFirstCallback.cv.start(beforeFirstCallback.source); await advance(220);
  assert.equal(beforeFirstCallback.starts.length, 0, 'initial null waits for the first video callback');
  assert.equal(beforeFirstCallback.cv.getStatus().lifecycleState, 'running');
  assert.equal(timers.size, 1, 'initial null uses a single bounded retry');
  beforeFirstCallback.setPresentedFrameId(1); await advance(290);
  assert.equal(beforeFirstCallback.starts.length, 1, 'first presented frame resumes admission');
  beforeFirstCallback.finish(); await flush();
  beforeFirstCallback.setPresentedFrameId(null); await advance(370);
  assert.equal(beforeFirstCallback.cv.getStatus().lifecycleState, 'error', 'identity loss after admission fails closed');
  assert.equal(beforeFirstCallback.cv.getStatus().submittedFrameCount, 1);
  assert.equal(timers.size, 0);
  await beforeFirstCallback.cv.dispose();
  for (const invalidId of [NaN, Infinity, -1, 1.5]) {
    clock = 0;
    const malformed = setup(); malformed.setPresentedFrameId(invalidId);
    await malformed.cv.start(malformed.source); await advance(0);
    assert.equal(malformed.cv.getStatus().lifecycleState, 'error', `invalid presented ID ${invalidId} fails closed`);
    assert.equal(malformed.cv.getStatus().submittedFrameCount, 0);
    assert.equal(timers.size, 0);
    await malformed.cv.dispose();
  }

  clock = 0;
  const stalled = setup(); stalled.setPresentedFrameId(1);
  await stalled.cv.start(stalled.source); await advance(0);
  assert.equal(stalled.starts.length, 1);
  await assert.rejects(() => stalled.cv.nextPoseFrame(), /after-result.*not supported/);
  stalled.cv.submitFrame();
  assert.equal(stalled.starts.length, 1, 'public methods cannot bypass one-flight admission');
  stalled.finish(); await flush();
  await advance(220); assert.equal(stalled.starts.length, 1, 'clock changes cannot inflate pose count while presented frame ID stalls');
  assert.equal(stalled.cv.getStatus().submittedFrameCount, 1);
  await assert.rejects(() => stalled.cv.nextPoseFrame(), /after-result.*not supported/);
  stalled.cv.submitFrame();
  assert.equal(stalled.cv.getStatus().submittedFrameCount, 1, 'public methods cannot bypass a frozen ID');
  assert.equal(timers.size, 1, 'stalled presentation has only one bounded retry');
  stalled.setPresentedFrameId(2); await advance(290);
  assert.equal(stalled.starts.length, 2, 'new presented frame resumes Worker submission');
  await stalled.cv.stop(); assert.equal(timers.size, 0);
  stalled.finish(); await flush();
  assert.equal(stalled.cv.getLatestPoseFrame(), undefined, 'late result cannot publish after stop');
  stalled.setPresentedFrameId(3); await stalled.cv.start(stalled.source); await advance(290);
  assert.equal(stalled.starts.length, 3, 'restart has a fresh source generation');
  stalled.finish(); await flush(); await stalled.cv.dispose();
  assert.equal(timers.size, 0, 'dispose cancels future admissions');
  clock = 0;
  const regressed = setup(); regressed.setPresentedFrameId(4);
  await regressed.cv.start(regressed.source); await advance(0);
  regressed.finish(); await flush(); regressed.setPresentedFrameId(3); await advance(80);
  assert.equal(regressed.cv.getStatus().lifecycleState, 'error', 'regressed presented ID fails closed');
  assert.equal(regressed.cv.getStatus().submittedFrameCount, 1);
  assert.equal(timers.size, 0);
  await regressed.cv.dispose();
  console.log(`after-result private CV scheduler passed: ${after} distinct presented-frame estimates vs fixed-tick ${fixed}; ≤15/s, one Worker, stalled-video retry, cancellation, provider rejection`);
} finally {
  globalThis.HTMLVideoElement = original.video; globalThis.VideoFrame = original.frame;
  globalThis.setTimeout = original.timeout; globalThis.clearTimeout = original.clearTimeout;
  globalThis.setInterval = original.interval; globalThis.clearInterval = original.clearInterval;
}
