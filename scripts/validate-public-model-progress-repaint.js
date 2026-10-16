// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const watcher = source.match(/  watchPublicModelDownload\(owner, sessionGeneration, actionGeneration, ordinal\) \{[\s\S]*?\n  \}/u)?.[0];
assert.ok(watcher, 'test actual public foreground repaint method');
const startSequence = source.match(/          cvStartAttempted = true;[\s\S]*?\n        \} else \{/u)?.[0]?.replace(/\n        \} else \{$/u, '');
assert.ok(startSequence, 'extract actual Play CV start and watcher order');
async function runStartSequence(instance, owner, fail = false) {
  const operation = new Function('owner', 'sessionGeneration', 'actionGeneration', 'actionIntentOrdinal',
    `return async function() { ${startSequence.replace('cvStartAttempted = true;', 'this.cvStartAttempted = true;')} }`)(owner, 9, 3, 7);
  instance.cvStartAttempted = false;
  const pending = operation.call(instance);
  if (fail) { await assert.rejects(pending, /load failed/u); return; }
  await pending;
}
function fixture(flag, initialState = 'loading') {
  const timers = new Map(); let nextId = 1; let renders = 0; let lifecycleState = initialState;
  let resolveCv = () => {}; let rejectCv = () => {};
  const cvPending = new Promise((resolve, reject) => { resolveCv = resolve; rejectCv = reject; });
  const context = { __AEROBEAT_PUBLIC_FRIEND_GAME__: flag,
    globalThis: { setInterval(fn, ms) { assert.equal(ms, 100); const id = nextId++; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); } } };
  const watch = vm.runInNewContext(`({${watcher}}).watchPublicModelDownload`, context);
  const owner = { generation: 4, connectionGeneration: 2, graph: {} };
  const game = { graph: { cv: { getStatus: () => ({ lifecycleState }) } },
    menuOpen: true, menuStarting: true, lastError: null, pendingSessionAction: 'start',
    pendingSessionActionOrdinal: 7, sessionActionIntentOrdinal: 7, lifecycleIntentActiveGeneration: 4,
    lifecycleIntentGeneration: 4, connectedGeneration: 2, sessionGeneration: 9, sessionActionGeneration: 3,
    lifecycle: 'connected', receivedBytes: 0, renderRuntimePresentation() { renders++; },
    async startCv() { lifecycleState = 'loading'; return cvPending; },
    foregroundModelDownloadProgress() { return this.receivedBytes ? { receivedBytes: this.receivedBytes, totalBytes: 100 } : null; },
    isActionIntentOwner(value, session, action) { return this.lifecycle === 'connected' && value === owner &&
      value.connectionGeneration === this.connectedGeneration && value.graph === this.graph &&
      value.generation === this.lifecycleIntentActiveGeneration && session === this.sessionGeneration &&
      action === this.sessionActionGeneration; } };
  owner.graph = game.graph;
  const stop = watch.call(game, owner, 9, 3, 7);
  const tick = () => { for (const fn of [...timers.values()]) fn(); };
  return { game, owner, watch, stop, tick, active: () => timers.size, renders: () => renders,
    completeCv() { lifecycleState = 'running'; resolveCv(); }, failCv() { lifecycleState = 'error'; rejectCv(Error('load failed')); } };
}
const publicGame = fixture(true);
assert.equal(publicGame.active(), 1, 'only foreground public Play installs one bounded timer');
publicGame.tick();
const initialRenders = publicGame.renders();
publicGame.game.receivedBytes = 25; publicGame.tick();
assert.equal(publicGame.renders(), initialRenders + 1, 'partial real bytes must trigger a runtime repaint before CV is ready');
publicGame.game.receivedBytes = 25.9; publicGame.tick();
assert.equal(publicGame.renders(), initialRenders + 1, 'same integer percent does not waste a repaint');
publicGame.game.receivedBytes = 50; publicGame.tick();
assert.equal(publicGame.renders(), initialRenders + 2, 'new percent triggers another repaint');
publicGame.game.pendingSessionActionOrdinal = 8;
publicGame.tick();
assert.equal(publicGame.active(), 0, 'superseded Test/cancel must stop old timer');
assert.equal(publicGame.renders(), initialRenders + 2, 'stale action must never repaint');
publicGame.stop();
const queuedGame = fixture(true);
queuedGame.tick();
const queuedBefore = queuedGame.renders();
queuedGame.game.pendingSessionAction = 'test';
queuedGame.game.pendingSessionActionOrdinal = 8;
queuedGame.game.sessionActionIntentOrdinal = 8;
queuedGame.game.publicFriendPendingMessage = () => 'Test queued after Play initialization…';
queuedGame.game.receivedBytes = 32;
queuedGame.tick();
assert.equal(queuedGame.active(), 1, 'queued Test keeps the Play-owned tracker asset repaint timer alive after model EOF at 32%');
assert.equal(queuedGame.renders(), queuedBefore + 1, 'completed model bytes repaint below 100% while actual WASM is still held');
queuedGame.game.receivedBytes = 100;
queuedGame.tick();
assert.equal(queuedGame.renders(), queuedBefore + 2, '100% combined model plus runtime asset bytes repaint only after WASM load, beside still-queued Test');
queuedGame.game.publicFriendPendingMessage = () => 'Preparing Test…';
queuedGame.tick();
assert.equal(queuedGame.active(), 0, 'timer stops once Test actually owns initialization');
queuedGame.stop();
for (const mutate of [g => { g.menuOpen = false; }, g => { g.lastError = 'load failed'; },
  g => { g.sessionActionGeneration++; }, g => { g.connectedGeneration++; },
  g => { g.lifecycle = 'disconnected'; }, g => { g.graph.cv.getStatus = () => ({ lifecycleState: 'error' }); }]) {
  const instance = fixture(true); mutate(instance.game); instance.tick();
  assert.equal(instance.active(), 0, 'invalidated load must clear timer');
  assert.equal(instance.renders(), 0, 'invalidated load must not repaint');
}
const privateGame = fixture(false);
assert.equal(privateGame.active(), 0, 'private game never schedules loading UI');
// The real start path stopped CV before the camera plays. Execute the production
// CV/watch sequence from that state, rather than a VM that starts in loading.
const stoppedGame = fixture(true, 'stopped');
stoppedGame.game.watchPublicModelDownload = (...args) => stoppedGame.watch.call(stoppedGame.game, ...args);
const loading = runStartSequence(stoppedGame.game, stoppedGame.owner);
assert.equal(stoppedGame.game.cvStartAttempted, true);
assert.equal(stoppedGame.active(), 1, 'production ordering must install watcher after CV enters loading');
stoppedGame.game.receivedBytes = 25; stoppedGame.tick();
assert.equal(stoppedGame.renders(), 1, '25% delivered during real CV await must repaint');
stoppedGame.completeCv(); await loading;
assert.equal(stoppedGame.active(), 0, 'CV completion clears bounded timer');
const failedGame = fixture(true, 'stopped');
failedGame.game.watchPublicModelDownload = (...args) => failedGame.watch.call(failedGame.game, ...args);
const failure = runStartSequence(failedGame.game, failedGame.owner, true);
assert.equal(failedGame.active(), 1);
failedGame.failCv(); await failure;
assert.equal(failedGame.active(), 0, 'CV rejection clears bounded timer');
const privateStopped = fixture(false, 'stopped');
privateStopped.game.watchPublicModelDownload = (...args) => privateStopped.watch.call(privateStopped.game, ...args);
const privateLoading = runStartSequence(privateStopped.game, privateStopped.owner);
assert.equal(privateStopped.active(), 0, 'private CV startup never installs watcher');
privateStopped.completeCv(); await privateLoading;
console.log('public model progress repaint: stopped-to-loading partial bytes, integer throttle, stale/error/teardown cleanup passed');
