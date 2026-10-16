// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createLockedProductionCvService } from '../src/production-cv-service.js';

function deferred() {
  /** @type {(value?:void)=>void} */ let resolve = () => {};
  /** @type {(reason?:unknown)=>void} */ let reject = () => {};
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class FakeVideo {}
globalThis.HTMLVideoElement = /** @type {typeof HTMLVideoElement} */ (/** @type {unknown} */ (FakeVideo));
const source = { sourceId: 'camera', mirrored: true, frameSource: new FakeVideo(), getTimestampMs: () => 0,
  isFrameAvailable: () => false, frameWidth: () => 640, frameHeight: () => 480 };
const gates = [deferred(), deferred(), deferred()];
let loadCount = 0;
let bytes = 0;
let progressVisible = false;
let modelVerified = false;
const cv = createLockedProductionCvService({ poseAdapter: {
  vendorId: 'mediapipe-tasks-vision', async load() { progressVisible = false; modelVerified = false; await gates[loadCount++].promise; },
  getModelDownloadProgress() { return progressVisible ? { receivedBytes: bytes, totalBytes: 100, verified: false, modelVerified } : null; },
  async estimateNormalizedPoseFrame() { throw Error('unexpected'); }, async dispose() {}
} });
assert.equal(cv.getModelDownloadProgress(), null);
const first = cv.start(source);
await Promise.resolve();
bytes = 43; progressVisible = true;
assert.deepEqual(cv.getModelDownloadProgress(), { receivedBytes: 43, totalBytes: 100, verified: true });
bytes = 100;
assert.deepEqual(cv.getModelDownloadProgress(), { receivedBytes: 100, totalBytes: 100, verified: true }, 'last downloaded byte is not SHA verification');
modelVerified = true;
assert.deepEqual(cv.getModelDownloadProgress(), { receivedBytes: 100, totalBytes: 100, verified: true, modelVerified: true }, 'same-byte model SHA-verified transition is forwarded');
await cv.stop();
assert.equal(cv.getModelDownloadProgress(), null, 'stop hides stale bytes immediately');
const second = cv.start(source);
assert.equal(cv.getModelDownloadProgress(), null, 'a new generation must not expose prior transfer');
gates[0].resolve();
await new Promise(resolve => setTimeout(resolve, 0));
bytes = 55; progressVisible = true;
assert.deepEqual(cv.getModelDownloadProgress(), { receivedBytes: 55, totalBytes: 100, verified: true });
gates[1].resolve();
await Promise.all([first, second]);
assert.equal(cv.getModelDownloadProgress(), null, 'running is not a download phase');
const third = cv.start(source);
await Promise.resolve();
assert.equal(cv.getModelDownloadProgress(), null, 'new adapter load must not retain previous bytes');
bytes = 60; progressVisible = true;
assert.deepEqual(cv.getModelDownloadProgress(), { receivedBytes: 60, totalBytes: 100, verified: true });
const disposing = cv.dispose();
assert.equal(cv.getModelDownloadProgress(), null, 'dispose hides progress synchronously');
gates[2].resolve();
await Promise.all([third, disposing]);

// Exercise actual public action snapshot and foreground guard rather than a duplicate policy.
const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const methodSource = index.match(/  foregroundModelDownloadProgress\(\) \{[\s\S]*?\n  \}\n  sessionActionsSnapshot\([^]*?\n  \}/u)?.[0];
assert.ok(methodSource, 'extract production action snapshot methods');
function fixture(publicFlag) {
  const methods = vm.runInNewContext(`({${methodSource.replace('\n  sessionActionsSnapshot(', '\n  ,sessionActionsSnapshot(')}})`, { __AEROBEAT_PUBLIC_FRIEND_GAME__: publicFlag, mediaPipeDefaultModelSizeBytes: 100, Number, Object });
  const current = { menuOpen: true, menuStarting: true, lastError: null, pendingSessionAction: 'start',
    pendingSessionActionOrdinal: 1, sessionActionIntentOrdinal: 1, lifecycleIntentActiveGeneration: 1,
    lifecycleIntentGeneration: 1, activeSessionAction: '', downloadedPlayable: () => true,
    publicFriendPendingMessage: () => 'Preparing Play', graph: { cv: {
      getStatus: () => ({ lifecycleState: 'loading' }), getModelDownloadProgress: () => ({ receivedBytes: 43, totalBytes: 230, verified: true })
    } }, publicModelDownloadAlmostReady: false };
  return Object.assign(current, methods);
}
const game = fixture(true);
assert.deepEqual(JSON.parse(JSON.stringify(game.sessionActionsSnapshot().modelDownloadProgress)), { receivedBytes: 43, totalBytes: 100 }, 'present only signed model bytes, not the opaque WASM aggregate');
game.graph.cv.getModelDownloadProgress = () => ({ receivedBytes: 100, totalBytes: 230, verified: true, modelVerified: true });
assert.deepEqual(JSON.parse(JSON.stringify(game.sessionActionsSnapshot().modelDownloadProgress)), { receivedBytes: 100, totalBytes: 100, modelVerified: true }, 'actual final model chunk gives 100%, not aggregate 43%');
game.publicModelDownloadAlmostReady = true;
assert.equal(game.sessionActionsSnapshot().modelDownloadProgress.almostReady, true, 'only verified model can progress to same-slot Almost Ready');
game.pendingSessionAction = 'test';
assert.ok(game.sessionActionsSnapshot().modelDownloadProgress, 'queued Test may show current loading Play');
for (const change of [
  g => { g.pendingSessionActionOrdinal = 0; },
  g => { g.sessionActionIntentOrdinal += 1; },
  g => { g.menuOpen = false; },
  g => { g.lastError = 'failed'; },
  g => { g.graph.cv.getStatus = () => ({ lifecycleState: 'running' }); },
  g => { g.graph.cv.getModelDownloadProgress = () => ({ receivedBytes: 43, totalBytes: 100, verified: false }); }
]) {
  const scenario = fixture(true); change(scenario);
  assert.equal(scenario.sessionActionsSnapshot().modelDownloadProgress, undefined);
}
assert.equal(fixture(false).sessionActionsSnapshot().modelDownloadProgress, undefined, 'private flag cannot export model progress');
assert.match(index, /modelDownloadPercent = modelDownloadProgress \? Math\.floor\(100 \* modelDownloadProgress\.receivedBytes \/ modelDownloadProgress\.totalBytes\) : null;[\s\S]*?JSON\.stringify\(\[runtimeMessage, pendingMessage, modelDownloadPercent/u,
  'actual integer percent changes runtime signature without every chunk committing');
console.log('public CPU model download progress: loading generation, stale action, private scope, integer repaint passed');
