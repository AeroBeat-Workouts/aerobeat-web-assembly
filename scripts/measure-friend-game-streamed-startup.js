// @ts-check
// TEST ONLY: matched local signed CPU control/candidate with incremental model bytes.
// Not a phone, public-relay, wire-bandwidth or physical-pose benchmark.
// Usage: node scripts/measure-friend-game-streamed-startup.js control
//        node scripts/measure-friend-game-streamed-startup.js .tmp/friend-game-cpu-stream-candidate-64d6990
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { loadSignedSnapshot, handlerForSnapshot } from './serve-friend-game.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const selection = process.argv[2];
assert.equal(process.argv.length, 3, 'exactly one argument: control or .tmp/<safe-direct-child>');
assert(selection === 'control' || /^\.tmp\/[a-zA-Z0-9][a-zA-Z0-9_-]*$/u.test(selection), 'only control or safe direct .tmp child allowed');
const directory = selection === 'control' ? resolve(root, 'dist-friend-game') : resolve(root, selection);
if (selection !== 'control') {
  assert.equal(realpathSync(resolve(root, '.tmp')), resolve(root, '.tmp'), '.tmp must be a real directory');
  assert(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink() && realpathSync(directory) === directory, 'candidate must be a real direct-child directory');
}
const snapshot = loadSignedSnapshot(directory);
const manifestBytes = readFileSync(join(directory, 'friend-game-bundle-manifest.json'));
const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
const model = '/assets/mediapipe/pose_landmarker_lite.task';
const wasm = '/assets/mediapipe/wasm/vision_wasm_internal.wasm';
const assets = [model, wasm];
for (const path of assets) {
  const entry = snapshot.manifest.assets.filter(item => `/${item.path}` === path);
  assert.equal(entry.length, 1, `unique signed ${path}`);
  const bytes = snapshot.bytes.get(path);
  assert(bytes && bytes.length === entry[0].bytes, `verified signed bytes ${path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry[0].sha256, `verified signed hash ${path}`);
}
const baseHandler = handlerForSnapshot(snapshot);
const events = [];
const zero = performance.now();
const clock = () => Math.round(performance.now() - zero);
const schedule = Object.freeze({ modelChunks: 8, modelIntervalMs: 500, wasmDelayMs: 3000 });
const counts = { [model]: 0, [wasm]: 0 };
let active = 0;
const server = createServer((request, response) => {
  const path = request.url?.split('?', 1)[0];
  if (!assets.includes(path) || !['GET', 'HEAD'].includes(request.method) || request.url !== path) return baseHandler(request, response);
  // Delegate all signed CSP/MIME/no-store/HEAD/404 policy to the production
  // snapshot handler; it returns immediately for HEAD. GET uses the exact same
  // signed bytes and headers, but test-only deterministic transfer timing.
  if (request.method === 'HEAD') return baseHandler(request, response);
  counts[path]++;
  const item = { path, ordinal: counts[path], requestMs: clock(), headersMs: null, finishMs: null, chunks: [] };
  events.push(item);
  active++;
  const data = snapshot.bytes.get(path);
  const mime = path === wasm ? 'application/wasm' : 'application/octet-stream';
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', snapshot.manifest.responsePolicy.assetCsp);
  response.setHeader('Content-Type', mime);
  response.setHeader('Content-Length', data.length);
  const finish = () => { item.finishMs = clock(); active--; };
  response.once('finish', finish);
  response.once('close', () => { if (item.finishMs === null) { item.abortedMs = clock(); active--; } });
  if (path === model) {
    // flushHeaders makes the supported stream reader observable while WASM loads.
    item.headersMs = clock(); response.flushHeaders();
    void (async () => {
      const chunkSize = Math.ceil(data.length / schedule.modelChunks);
      for (let i = 0; i < schedule.modelChunks; i++) {
        await delay(schedule.modelIntervalMs);
        if (response.destroyed) break;
        const start = i * chunkSize, end = Math.min(data.length, start + chunkSize);
        if (start >= end) break;
        response.write(data.subarray(start, end));
        item.chunks.push({ atMs: clock(), bytes: end - start });
      }
      if (!response.destroyed) response.end();
    })().catch(error => response.destroy(error));
  } else {
    void delay(schedule.wasmDelayMs).then(() => {
      if (response.destroyed) return;
      item.headersMs = clock(); response.end(data);
    }).catch(error => response.destroy(error));
  }
});

await new Promise((done, reject) => server.once('error', reject).listen(4201, '127.0.0.1', done));
const url = 'http://127.0.0.1:4201/';
try {
  // Negative and HEAD parity: no sidecar, signed CSP/MIME and same length as GET.
  for (const path of assets) {
    const head = await fetch(new URL(path, url), { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(snapshot.bytes.get(path).length));
    assert.equal(head.headers.get('content-type'), path === wasm ? 'application/wasm' : 'application/octet-stream');
    assert.equal(head.headers.get('cache-control'), 'no-store');
    assert.equal(head.headers.get('content-security-policy'), snapshot.manifest.responsePolicy.assetCsp);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  }
  for (const path of ['/friend-game-bundle-manifest.json', '/src/index.js', '/phone-play-cv-test.html']) assert.equal((await fetch(new URL(path, url))).status, 404);
  assert(!process.env.AEROBEAT_STARTUP_TRACE || process.env.AEROBEAT_STARTUP_TRACE === '1', 'trace must be 1 or unset');
  const childEnv = { ...process.env, AEROBEAT_FRIEND_GAME_QA_URL: url };
  delete childEnv.AEROBEAT_STARTUP_SHAPE;
  delete childEnv.AEROBEAT_FRIEND_GAME_QA_SNAPSHOT_DIR;
  if (selection !== 'control') childEnv.AEROBEAT_FRIEND_GAME_QA_SNAPSHOT_DIR = selection;
  if (process.env.AEROBEAT_STARTUP_TRACE === '1') childEnv.AEROBEAT_STARTUP_TRACE = '1';
  else delete childEnv.AEROBEAT_STARTUP_TRACE;
  const child = spawn(process.execPath, [fileURLToPath(new URL('./measure-friend-game-startup.js', import.meta.url))], {
    cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '', errors = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => { output += text; if (output.length > 512_000) child.kill(); });
  child.stderr.on('data', text => { errors += text; if (errors.length > 32_000) child.kill(); });
  const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', (code, signal) => done({ code, signal })); });
  if (process.env.AEROBEAT_STARTUP_TRACE === '1' && errors) console.error(errors.slice(-24_000));
  if (exit.code !== 0) {
    const diagnosis = { selection, signedManifestSha256: manifestSha256, serverEvents: events,
      child: { exitCode: exit.code, signal: exit.signal, stderr: errors.slice(-4000), stdoutTail: output.slice(-1000) } };
    console.error(JSON.stringify(diagnosis, null, 2));
  }
  assert.equal(exit.code, 0, 'signed browser runner failed; diagnostics printed without relaxing its assertions');
  const browser = JSON.parse(output);
  assert.equal(browser.signed.manifestSha256, manifestSha256, 'browser used this exact signed snapshot');
  assert.equal(browser.signed.origin, 'http://127.0.0.1:4201');
  assert.equal(browser.results.length, 2, 'first page and second new page in same context');
  for (const path of assets) assert.equal(counts[path], 2, `${path}: one logical GET per browser page`);
  assert(events.every(item => item.finishMs !== null && item.abortedMs === undefined), 'all signed responses finished');
  assert(events.filter(item => item.path === model).every(item => item.chunks.length === schedule.modelChunks && item.chunks.reduce((total, chunk) => total + chunk.bytes, 0) === snapshot.bytes.get(model).length), 'eight model chunks preserve signed bytes');
  console.log(JSON.stringify({ selection, signedManifestSha256: manifestSha256, schedule, counts, serverEvents: events,
    browser: { signed: browser.signed, results: browser.results.map(result => ({ mode: result.mode,
      nodeClockFromClickObservationMs: result.nodeClockFromClickObservationMs,
      browserClockFromTrustedClickMs: result.browserClockFromTrustedClickMs,
      totalRequests: result.totalRequests, workerAssetCounts: Object.fromEntries(assets.map(path => [path, result.workerAssets[`GET ${path}`]?.count ?? 0])),
      endState: result.endState, caveat: result.caveat })) },
    caveat: 'One Node clock measures signed HTTP request/header/finish windows; browser runner uses its own Node observations and separate browser click clock. Synthetic T-pose is not physical tracking. Uncompressed decoded-byte local schedule is not public relay/Brotli or phone throughput.' }, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
  assert.equal(active, 0, 'no unfinished asset responses');
}
