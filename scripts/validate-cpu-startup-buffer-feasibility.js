// Isolated LOCAL-only test fixture. Never a product build, public route or phone benchmark.
// Run: node scripts/validate-cpu-startup-buffer-feasibility.js
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist-friend-game');
const workerPath = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/cpu-startup-worker.js');
const manifest = JSON.parse(await readFile(resolve(root, 'friend-game-bundle-manifest.json'), 'utf8'));
assert.equal(manifest.purpose, 'normal_cpu_friend_game');
const paths = new Map(manifest.assets.filter(a => a.path.startsWith('assets/mediapipe/')).map(a => [`/${a.path}`, a]));
const model = paths.get('/assets/mediapipe/pose_landmarker_lite.task');
assert.equal(model?.bytes, 5777746, 'decoded model denominator must be signed size');
const raw = new Map();
const compressedAssets = new Map();
for (const [url, asset] of paths) {
  const bytes = await readFile(resolve(root, asset.path));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `signed source ${url}`);
  raw.set(url, bytes);
  compressedAssets.set(url, brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }));
}
const worker = await readFile(workerPath);
const delayMs = Number(process.env.AEROBEAT_FIXTURE_DELAY_MS ?? 350);
assert(Number.isInteger(delayMs) && delayMs >= 0 && delayMs <= 5000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const counts = new Map(), transferWindows = new Map(); let encoding = 'identity';
const runZero = performance.now();
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const item = raw.get(path);
  if (req.method !== 'GET' || (!item && path !== '/fixture-worker.js' && path !== '/')) { res.writeHead(404); res.end(); return; }
  counts.set(path, (counts.get(path) ?? 0) + 1);
  let window = null;
  if (path.endsWith('.wasm') || path.endsWith('.task')) {
    const windows = transferWindows.get(path) ?? [];
    window = { startedMs: performance.now(), method: req.method, range: req.headers.range ?? null, finishedMs: null };
    windows.push(window);
    transferWindows.set(path, windows);
  }
  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'" });
    res.end('<!doctype html><title>LOCAL TEST ONLY: CPU startup feasibility</title>'); return;
  }
  const bytes = item ?? worker;
  // Delay each large signed asset, including the resolver's probe and full WASM GET.
  if (path.endsWith('.wasm') || path.endsWith('.task')) await sleep(delayMs);
  const compressed = encoding === 'br' && req.headers['accept-encoding']?.includes('br') && path !== '/fixture-worker.js';
  const body = compressed ? compressedAssets.get(path) : bytes;
  res.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'text/javascript' : path.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream', 'Content-Length': body.length, ...(compressed ? { 'Content-Encoding': 'br' } : {}), 'Cache-Control': 'no-store', 'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'" });
  res.end(body, () => { if (window) window.finishedMs = performance.now(); });
});
server.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (encoding of ['identity', 'br']) {
    const rows = [];
    for (const mode of ['path', 'buffer']) {
      counts.clear(); transferWindows.clear();
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      const failures = [];
      page.on('request', r => { if (!r.url().startsWith(origin)) failures.push(`off-origin ${r.url()}`); });
      page.on('requestfailed', r => failures.push(`${r.url()} ${r.failure()?.errorText}`));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      try {
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        const outcome = await page.evaluate(({ origin, mode, model, encoding }) => new Promise((resolve, reject) => {
          const worker = new Worker(`${origin}/fixture-worker.js`);
          const started = performance.now(), progress = [];
          const timer = setTimeout(() => { worker.terminate(); reject(Error('fixture Worker timeout')); }, 45000);
          worker.onerror = e => { clearTimeout(timer); worker.terminate(); reject(Error(`Worker script: ${e.message}`)); };
          worker.onmessage = ({ data }) => {
            if (data.type === 'progress') { progress.push(data); return; }
            clearTimeout(timer); worker.terminate(); resolve({ ...data, started, progress, encoding, mode });
          };
          worker.postMessage({ origin, mode, expectedModelHash: model.sha256, expectedModelBytes: model.bytes });
        }), { origin, mode, model, encoding });
        const modelCount = counts.get('/assets/mediapipe/pose_landmarker_lite.task') ?? 0;
        const wasmCounts = [...counts].filter(([p]) => p.endsWith('.wasm'));
        assert.equal(modelCount, 1, `exactly one task GET (${encoding}/${mode}): ${JSON.stringify({ counts: [...counts], outcome })}`);
        assert(wasmCounts.length >= 1, 'WASM resolver must request actual signed WASM bytes');
        assert.equal(wasmCounts.reduce((sum, [, n]) => sum + n, 0), 1, 'signed WASM MIME must allow one WASM GET');
        assert(wasmCounts.every(([p]) => transferWindows.get(p)?.every(w => w.finishedMs !== null)), 'WASM transfer completes');
        assert(transferWindows.get('/assets/mediapipe/pose_landmarker_lite.task')?.every(w => w.finishedMs !== null), 'model transfer completes');
        const wasmWindow = transferWindows.get(wasmCounts[0][0])[0];
        const modelWindow = transferWindows.get('/assets/mediapipe/pose_landmarker_lite.task')[0];
        assert(mode === 'path'
          ? modelWindow.startedMs >= wasmWindow.finishedMs
          : wasmWindow.startedMs >= modelWindow.finishedMs,
        `${mode}: fixture must report actual sequential transfer order`);
        assert(failures.every(message => message.includes('odml.pa.googleapis.com/v1/log') || (message.includes('/pose_landmarker_lite.task') && message.includes('ERR_ABORTED'))), `unexpected network: ${failures.join(', ')}`);
        assert.equal(outcome.type, 'done', outcome.error ?? 'unknown Worker failure');
        if (mode === 'buffer') assert.equal(outcome.progress.at(-1)?.received, model.bytes);
        const m = outcome.marks;
        rows.push({ mode, modelGETs: modelCount, wasmGETs: wasmCounts, elapsedMs: Math.round(m.createDone - m.start), resolverMs: Math.round(m.resolverDone - m.resolverStart), creationMs: Math.round(m.createDone - m.createStart), modelStartedAfterWasm: modelWindow.startedMs >= wasmWindow.finishedMs, wasmStartedAfterModel: wasmWindow.startedMs >= modelWindow.finishedMs, assetGetWindowsSameNodeClock: Object.fromEntries([...transferWindows].map(([p, windows]) => [p, windows.map(w => ({ ...w, startedMs: Math.round(w.startedMs - runZero), finishedMs: w.finishedMs === null ? null : Math.round(w.finishedMs - runZero) }))])), workerMarksMs: Object.fromEntries(Object.entries(m).map(([key, value]) => [key, Math.round(value - m.start)])), clock: 'server GET timestamps relative to the Node run start; Worker marks relative to Worker load; clocks are not interchangeable', progressEvents: outcome.progress.length, decodedBytes: outcome.progress.at(-1)?.received ?? null, error: null });
      } finally { await context.close(); }
    }
    console.log(JSON.stringify({ fixture: 'LOCAL TEST ONLY; signed assets, separate unsigned Worker; NOT phone speed', encoding, artificialAssetDelayMs: delayMs, rows }));
  }
} finally { await browser.close(); server.close(); }
