// @ts-check
// LOCAL browser-only cache feasibility; does not build, serve, or change the public game.
// Run: node scripts/validate-cpu-repeat-cache-feasibility.js
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist-friend-game');
const manifest = JSON.parse(await readFile(resolve(root, 'friend-game-bundle-manifest.json'), 'utf8'));
assert.equal(manifest.purpose, 'normal_cpu_friend_game');
const entries = manifest.assets.filter(a => a.path === 'assets/mediapipe/pose_landmarker_lite.task' || a.path === 'assets/mediapipe/wasm/vision_wasm_internal.wasm');
assert.equal(entries.filter(a => a.path.endsWith('.task')).length, 1);
assert(entries.some(a => a.path.endsWith('.wasm')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = await Promise.all(entries.map(async entry => {
  const bytes = await readFile(resolve(root, entry.path));
  assert.equal(bytes.length, entry.bytes);
  assert.equal(sha(bytes), entry.sha256, `signed asset ${entry.path}`);
  return { ...entry, bytes, url: `/hash/${entry.sha256}/${entry.path}` };
}));
const byUrl = new Map(assets.map(asset => [asset.url, asset]));
const delayMs = 350;
const requests = [];
const html = `<!doctype html><title>LOCAL signed-byte cache experiment</title><script>
window.loadAssets = async (urls) => {
  const started = performance.now();
  const results = await Promise.all(urls.map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw Error('fetch ' + response.status);
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return { url, byteLength: bytes.byteLength, sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') };
  }));
  return { elapsedMs: performance.now() - started, results };
};
</script>`;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const asset = byUrl.get(path);
  const control = path.startsWith('/control/') && byUrl.get(path.slice('/control'.length));
  const item = asset ?? control;
  if (req.method !== 'GET' || (path !== '/' && !item)) { res.writeHead(404); res.end(); return; }
  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(html); return;
  }
  requests.push({ path, started: performance.now() });
  await new Promise(done => setTimeout(done, delayMs));
  res.writeHead(200, {
    'Content-Type': extname(path) === '.wasm' ? 'application/wasm' : 'application/octet-stream',
    'Content-Length': item.bytes.length,
    'Cache-Control': asset ? 'public, max-age=31536000, immutable' : 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(item.bytes);
});
server.listen(0, '127.0.0.1');
await new Promise(done => server.once('listening', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const run = async (label, urls) => {
      const page = await context.newPage(); // New document, retained Chrome HTTP cache.
      try {
        const before = requests.length;
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        const response = await page.evaluate(urls => window.loadAssets(urls), urls);
        for (const result of response.results) {
          const asset = byUrl.get(result.url.replace(/^\/control/, ''));
          assert(asset, `known signed URL ${result.url}`);
          assert.equal(result.byteLength, asset.bytes.length);
          assert.equal(result.sha256, asset.sha256, `browser decoded identity ${label} ${result.url}`);
        }
        const gets = requests.slice(before).map(r => r.path);
        return { label, elapsedMs: Math.round(response.elapsedMs), largeGETs: gets, decodedSHA256: response.results.map(result => byUrl.get(result.url.replace(/^\/control/, '')).sha256) };
      } finally { await page.close(); }
    };
    const urls = assets.map(a => a.url);
    const controlUrls = urls.map(url => `/control${url}`);
    const rows = [];
    rows.push(await run('signed control no-store first', controlUrls));
    rows.push(await run('signed control no-store repeat', controlUrls));
    rows.push(await run('content-hash immutable first', urls));
    rows.push(await run('new page same context immutable repeat', urls));
    const old = assets[0];
    // A changed URL with a different hash must not reuse cached old bytes.
    const changed = Buffer.from(old.bytes);
    changed[0] ^= 1;
    const changedHash = sha(changed);
    const changedUrl = `/hash/${changedHash}/${old.path}`;
    byUrl.set(changedUrl, { ...old, bytes: changed, sha256: changedHash, url: changedUrl });
    rows.push(await run('new content-hash URL', [changedUrl]));
    rows.push(await run('old content-hash URL remains cached', [old.url]));
    rows.push(await run('model-only immutable repeat', [old.url]));
    const [controlFirst, controlRepeat, immutableFirst, immutableRepeat, changedFirst, oldRepeat, modelRepeat] = rows;
    assert.deepEqual(controlFirst.largeGETs, controlUrls);
    assert.deepEqual(controlRepeat.largeGETs, controlUrls);
    assert.deepEqual(immutableFirst.largeGETs, urls);
    assert.deepEqual(changedFirst.largeGETs, [changedUrl], 'new hash does not alias old cache');
    assert.deepEqual(oldRepeat.largeGETs, [], 'old hash remains independently cached');
    assert.deepEqual(modelRepeat.largeGETs, [], 'repeat model-only hash avoids a network GET');
    assert(modelRepeat.elapsedMs + delayMs / 2 < immutableFirst.elapsedMs, 'cache-hit model transfer-bound wait decreases');
    if (immutableRepeat.largeGETs.length === 0) {
      assert(immutableRepeat.elapsedMs + delayMs / 2 < immutableFirst.elapsedMs,
        'repeat immutable transfer-bound wait decreases under fixed 350ms delay');
      assert(controlRepeat.elapsedMs + delayMs / 2 > immutableRepeat.elapsedMs,
        'no-store repeat retains transfer-bound delay');
    } else {
      // Chromium may evict the larger WASM from its HTTP cache under its normal
      // per-entry/cache limits. Do not misreport a model-only hit as a full win.
      assert(immutableRepeat.largeGETs.every(url => urls.includes(url)));
      assert(immutableRepeat.largeGETs.length < urls.length, 'at least one immutable signed asset must cache');
    }
    console.log(JSON.stringify({ fixture: 'LOCAL browser fixture; no product initialization or physical phone speed measured', signedBuild: manifest.buildStamp, policy: { html: 'no-store', control: 'no-store', versioned: 'public, max-age=31536000, immutable' }, perLargeGetDelayMs: delayMs, fullRepeatCacheHit: immutableRepeat.largeGETs.length === 0, transferBoundWaitReduced: immutableRepeat.largeGETs.length === 0 && immutableRepeat.elapsedMs + delayMs / 2 < immutableFirst.elapsedMs, rows }));
  } finally { await context.close(); }
} finally { await browser.close(); await new Promise(done => server.close(done)); }
