// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const watcher = source.match(/  watchPublicModelDownload\(owner, sessionGeneration, actionGeneration, ordinal\) \{[\s\S]*?\n  \}/u)?.[0];
assert.ok(watcher, 'test actual public foreground repaint method');
assert.match(source, /const stopModelDownloadRepaint = this\.watchPublicModelDownload\(owner, sessionGeneration, actionGeneration, actionIntentOrdinal\);\s*try \{ await this\.startCv\(\); \} finally \{ stopModelDownloadRepaint\(\); \}/u,
  'real Play CV await owns timer teardown even on errors');
function fixture(flag) {
  const timers = new Map(); let nextId = 1; let renders = 0;
  const context = { __AEROBEAT_PUBLIC_FRIEND_GAME__: flag,
    globalThis: { setInterval(fn, ms) { assert.equal(ms, 100); const id = nextId++; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); } } };
  const watch = vm.runInNewContext(`({${watcher}}).watchPublicModelDownload`, context);
  const owner = { generation: 4, connectionGeneration: 2, graph: {} };
  const game = { graph: { cv: { getStatus: () => ({ lifecycleState: 'loading' }) } },
    menuOpen: true, menuStarting: true, lastError: null, pendingSessionAction: 'start',
    pendingSessionActionOrdinal: 7, sessionActionIntentOrdinal: 7, lifecycleIntentActiveGeneration: 4,
    lifecycleIntentGeneration: 4, connectedGeneration: 2, sessionGeneration: 9, sessionActionGeneration: 3,
    lifecycle: 'connected', receivedBytes: 0, renderRuntimePresentation() { renders++; },
    foregroundModelDownloadProgress() { return this.receivedBytes ? { receivedBytes: this.receivedBytes, totalBytes: 100 } : null; },
    isActionIntentOwner(value, session, action) { return this.lifecycle === 'connected' && value === owner &&
      value.connectionGeneration === this.connectedGeneration && value.graph === this.graph &&
      value.generation === this.lifecycleIntentActiveGeneration && session === this.sessionGeneration &&
      action === this.sessionActionGeneration; } };
  owner.graph = game.graph;
  const stop = watch.call(game, owner, 9, 3, 7);
  const tick = () => { for (const fn of [...timers.values()]) fn(); };
  return { game, stop, tick, active: () => timers.size, renders: () => renders };
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
for (const mutate of [g => { g.menuOpen = false; }, g => { g.lastError = 'load failed'; },
  g => { g.sessionActionGeneration++; }, g => { g.connectedGeneration++; },
  g => { g.lifecycle = 'disconnected'; }, g => { g.graph.cv.getStatus = () => ({ lifecycleState: 'error' }); }]) {
  const instance = fixture(true); mutate(instance.game); instance.tick();
  assert.equal(instance.active(), 0, 'invalidated load must clear timer');
  assert.equal(instance.renders(), 0, 'invalidated load must not repaint');
}
const privateGame = fixture(false);
assert.equal(privateGame.active(), 0, 'private game never schedules loading UI');
console.log('public model progress repaint: partial bytes, integer throttle, stale/error/teardown cleanup passed');
