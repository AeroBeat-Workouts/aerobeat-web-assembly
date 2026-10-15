// @ts-check
// Test-only snapshot-selection contract; no server, build, or public route changes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadSignedSnapshot, handlerForSnapshot } from './serve-friend-game.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidate = '.tmp/friend-game-cpu-stream-candidate-64d6990';
const snapshot = loadSignedSnapshot(resolve(root, candidate));
const manifest = readFileSync(resolve(root, candidate, 'friend-game-bundle-manifest.json'));
assert.equal(createHash('sha256').update(manifest).digest('hex'), 'df573a145b7f11a85fad93f4253e52d953122b575d87e1fd9f406bce30e86282');
const runner = fileURLToPath(new URL('./measure-friend-game-startup.js', import.meta.url));
const cases = [
  ['4200 override rejected', 'http://127.0.0.1:4200/', candidate, /snapshot override is allowed only/u],
  ['traversal rejected', 'http://127.0.0.1:4201/', '.tmp/../dist-friend-game', /safe direct \.tmp child/u],
  ['nested child rejected', 'http://127.0.0.1:4201/', `${candidate}/assets`, /safe direct \.tmp child/u],
  ['absolute rejected', 'http://127.0.0.1:4201/', resolve(root, candidate), /safe direct \.tmp child/u],
  ['missing child rejected', 'http://127.0.0.1:4201/', '.tmp/no-such-signed-candidate', /ENOENT|snapshot/u]
];
for (const [label, url, selected, reason] of cases) {
  const result = spawnSync(process.execPath, [runner], { cwd: root, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, AEROBEAT_FRIEND_GAME_QA_URL: url, AEROBEAT_FRIEND_GAME_QA_SNAPSHOT_DIR: selected } });
  assert.notEqual(result.status, 0, `${label}: must fail before browser`);
  assert.match(result.stderr, reason, `${label}: specific fail-closed reason`);
}
// A short-lived self-contained signed handler verifies selected HTML and policy,
// without occupying 4201 or altering any existing service.
const server = createServer(handlerForSnapshot(snapshot));
await new Promise((resolvePromise, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolvePromise));
try {
  const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/`;
  const html = await fetch(base), bytes = Buffer.from(await html.arrayBuffer());
  assert.equal(html.status, 200);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), snapshot.manifest.assets.find(item => item.path === 'index.html')?.sha256);
  assert.equal((await fetch(new URL('friend-game-bundle-manifest.json', base))).status, 404);
  assert.equal(html.headers.get('cache-control'), 'no-store');
} finally { await new Promise((resolvePromise, reject) => server.close(error => error ? reject(error) : resolvePromise())); }
console.log('PASS candidate snapshot path restrictions and ephemeral signed handler');
