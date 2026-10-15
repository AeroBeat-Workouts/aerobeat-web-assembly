// @ts-check
// Served, signed NORMAL CPU game acceptance. Browser fake camera and test-owned
// calibration stimuli are not physical-phone calibration, tracking or hit proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { computeBeatSaverMapHash, inspectBeatSaverArchive } from '@aerobeat/web-vendor-beatsaver';
import { createSyntheticBeatSaverZip, createSyntheticMapPayload } from '../../aerobeat-web-vendor-beatsaver/scripts/fixture-helpers.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = resolve(root, 'dist-friend-game');
const sidecar = 'friend-game-bundle-manifest.json';
const rawUrl = process.env.AEROBEAT_FRIEND_GAME_QA_URL;
assert.equal(rawUrl, 'http://127.0.0.1:4200/', 'INVALID SETUP: exact isolated signed loopback URL required');
const origin = new URL(rawUrl).origin;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exactKeys = (object, expected, label) => {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label}: object required`);
  assert.deepEqual(Object.keys(object).sort(), expected.slice().sort(), `${label}: exact keys`);
};
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`, 'u').test(value);
const failHash = (bytes, entry) => {
  assert.equal(bytes.length, entry.bytes, `${entry.path}: signed byte length`);
  assert.equal(digest(bytes), entry.sha256, `${entry.path}: signed SHA-256`);
};
let manifestBytes;
try { manifestBytes = await readFile(resolve(build, sidecar)); }
catch (cause) { throw new Error('INVALID SETUP: signed dist-friend-game is absent', { cause }); }
assert(manifestBytes.length > 128 && manifestBytes.length < 128000, 'bounded sidecar');
const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
exactKeys(manifest, ['schema', 'version', 'purpose', 'sourceManifest', 'buildStamp', 'responsePolicy', 'assets'], 'sidecar');
assert.equal(manifest.schema, 'aerobeat/public_friend_game_bundle');
assert.equal(manifest.version, 1);
assert.equal(manifest.purpose, 'normal_cpu_friend_game');
exactKeys(manifest.sourceManifest, ['schema', 'version', 'packageVersion', 'sources'], 'source provenance');
assert.equal(manifest.sourceManifest.schema, 'aerobeat/public_friend_game_source_manifest');
assert.equal(manifest.sourceManifest.version, 1);
assert.equal(Object.keys(manifest.sourceManifest.sources).length, 15, 'assembly plus fourteen linked packages');
assert(Object.hasOwn(manifest.sourceManifest.sources, '@aerobeat/web-assembly'));
for (const [name, pin] of Object.entries(manifest.sourceManifest.sources)) {
  assert(/^@aerobeat\/web-[a-z-]+$/u.test(name), `source name ${name}`);
  exactKeys(pin, ['commit', 'tree', 'sourceSha256'], name);
  assert(hex(pin.commit, 40) && hex(pin.tree, 40) && hex(pin.sourceSha256, 64), `${name}: pinned identity`);
}
assert.equal(manifest.buildStamp, `FRIEND-GAME-CPU-${manifest.sourceManifest.packageVersion}-${digest(Buffer.from(JSON.stringify(manifest.sourceManifest))).slice(0, 24)}`);
exactKeys(manifest.responsePolicy, ['documentCsp', 'assetCsp', 'referrerPolicy', 'contentTypeOptions'], 'response policy');
const documentCsp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.beatsaver.com https://r2cdn.beatsaver.com; media-src 'self' blob: https://cfcdn.beatsaver.com; worker-src 'self' blob:; frame-ancestors *; base-uri 'none'; form-action 'none'; object-src 'none'";
const assetCsp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";
assert.equal(manifest.responsePolicy.documentCsp, documentCsp);
assert.equal(manifest.responsePolicy.assetCsp, assetCsp);
assert.equal(manifest.responsePolicy.referrerPolicy, 'no-referrer');
assert.equal(manifest.responsePolicy.contentTypeOptions, 'nosniff');
assert(Array.isArray(manifest.assets) && manifest.assets.length > 25 && manifest.assets.length < 150, 'complete bounded signed inventory');
const names = manifest.assets.map(entry => entry.path);
// JSON is data only inside the two pinned runtime asset catalogs, never an
// arbitrary upload, diagnostic, build sidecar, or top-level file.
const ownedJson = name => /^(?:assets\/environments\/([a-z0-9]+(?:-[a-z0-9]+)*)\/1\.0\.0\/(?:\1\.config|manifest)|assets\/gameplay\/0\.0\.11\/(?:manifests\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.v1|sets\/[a-z0-9]+(?:-[a-z0-9]+)*))\.json$/u.test(name);
assert.deepEqual(names, names.slice().sort(), 'sorted inventory');
assert.equal(new Set(names).size, names.length, 'unique inventory');
assert.deepEqual(names.filter(name => name.endsWith('.html')), ['index.html'], 'normal game HTML only');
assert(names.includes('favicon.ico') && names.includes('assets/mediapipe/pose_landmarker_lite.task') && names.includes('assets/mediapipe/vision_bundle.js') && names.some(name => /^assets\/mediapipe\/wasm\/.*\.wasm$/u.test(name)) && names.filter(name => /^assets\/gameplay\/0\.0\.11\/.*\.glb$/u.test(name)).length === 9, 'signed local model, WASM, GLBs and favicon');
assert(names.some(name => /^assets\/.*worker.*\.js$/iu.test(name)), 'signed authoring/CV Worker');
assert(names.some(name => /^assets\/mediapipe\/wasm\/.*\.js$/u.test(name)), 'signed local MediaPipe WASM loader');
assert.equal(names.filter(name => name.endsWith('.json')).length, 24, 'exactly 24 pinned environment/gameplay JSON files');
assert(names.some(name => /^assets\/environments\/.*\.json$/u.test(name)) && names.some(name => /^assets\/gameplay\/0\.0\.11\/.*\.json$/u.test(name)), 'signed pinned environment and gameplay JSON catalogs');
async function inventory(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    assert(entry.isDirectory() || entry.isFile(), `symlink/nonregular output ${name}`);
    return entry.isDirectory() ? inventory(resolve(directory, entry.name), name) : [name];
  }))).flat();
}
assert.deepEqual((await inventory(build)).sort(), [...names, sidecar].sort(), 'all output files signed; no extras');
const policy = (response, expected, label) => {
  assert.equal(response.headers.get('content-security-policy'), expected, `${label}: exact CSP`);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer', `${label}: no referrer`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${label}: no sniff`);
};
const served = new Map();
for (const entry of manifest.assets) {
  exactKeys(entry, ['path', 'bytes', 'sha256'], 'asset signature');
  assert(/^(?:index\.html|favicon\.ico|assets\/[a-zA-Z0-9._/-]+)$/u.test(entry.path) && !entry.path.split('/').some(part => !part || part.startsWith('.') || part === '..') && !/phone-|diagnostic|\.map$|gpu/iu.test(entry.path) && (!entry.path.endsWith('.json') || ownedJson(entry.path)), `approved asset ${entry.path}`);
  assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= 100_000_000 && hex(entry.sha256, 64), `bounded signature ${entry.path}`);
  failHash(await readFile(resolve(build, entry.path)), entry);
  const response = await fetch(new URL(`/${entry.path}`, rawUrl), { cache: 'no-store' });
  assert.equal(response.status, 200, `signed static route ${entry.path}`);
  policy(response, entry.path === 'index.html' ? documentCsp : assetCsp, entry.path);
  if (entry.path.endsWith('.json')) assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8', `${entry.path}: exact JSON MIME`);
  const bytes = Buffer.from(await response.arrayBuffer()); failHash(bytes, entry); served.set(entry.path, bytes);
  if (entry.path.endsWith('.json')) {
    const record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    assert(record && typeof record === 'object' && !Array.isArray(record), `${entry.path}: pinned JSON object`);
  }
}
const rootResponse = await fetch(rawUrl, { cache: 'no-store' });
assert.equal(rootResponse.status, 200, '/ serves normal HTML');
policy(rootResponse, documentCsp, '/');
const rootBytes = Buffer.from(await rootResponse.arrayBuffer());
assert.deepEqual(rootBytes, served.get('index.html'), '/ and /index.html serve identical signed HTML');
failHash(rootBytes, manifest.assets.find(entry => entry.path === 'index.html'));
const html = rootBytes.toString('utf8');
assert.match(html, /<aero-game>/u);
assert(!/\/src\/|phone-play|diagnostic|json.reporter|preview=1/iu.test(html), 'no dev/diagnostic entry');
assert(names.some(name => name.endsWith('.js') && html.includes(`/${name}`) && served.get(name)?.includes(Buffer.from(manifest.buildStamp))), 'signed entry carries source stamp');
// Counterfactual: same signed bytes and unchanged expected hash, one mutated in-memory byte.
const badBytes = Buffer.from(rootBytes); badBytes[0] ^= 1;
assert.throws(() => failHash(badBytes, manifest.assets.find(entry => entry.path === 'index.html')), /signed SHA-256/u, 'mutated response must fail the exact production hash assertion');
for (const path of ['/missing-friend-qa', '/.env', '/src/index.js', '/assets/', '/index.html/', '/phone-play-cv-test.html', '/friend-game-bundle-manifest.json', '/assets/debug.json', '/assets/environments/diagnostic.json', '/assets/gameplay/0.0.11/unowned.json', '/assets/%2findex.js', '//index.html']) {
  const response = await fetch(`${origin}${path}`, { cache: 'no-store' });
  assert.equal(response.status, 404, `unknown/forbidden path ${path}`);
  policy(response, assetCsp, path);
}
const traversal = await new Promise((resolvePromise, reject) => httpRequest({ hostname: '127.0.0.1', port: 4200, path: '/%2e%2e/index.html' }, response => { response.resume(); response.on('end', () => resolvePromise(response.statusCode)); }).on('error', reject).end());
assert.equal(traversal, 404, 'encoded raw traversal denied');
assert.equal((await fetch(rawUrl, { method: 'POST' })).status, 405, 'no POST');
console.log(`PASS signed served bytes/CSP/static negatives: ${names.length} assets; counterfactual hash fails`);

// Bounded, fully local BeatSaver route fixture. Only vendor GET requests are fulfilled;
// a real GET is an additional optional integration probe, never substituted for this UI test.
const { unzipSync, zipSync } = createRequire(new URL('../../aerobeat-web-vendor-beatsaver/package.json', import.meta.url))('fflate');
const entries = unzipSync(createSyntheticBeatSaverZip(2));
const info = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entries['Info.dat']));
assert.equal(info._songFilename, 'Audio/Song.egg');
const sampleRate = 8000, seconds = 35;
const wav = new Uint8Array(44 + sampleRate * seconds * 2), view = new DataView(wav.buffer);
const label = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
label(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); label(8, 'WAVEfmt ');
view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
label(36, 'data'); view.setUint32(40, wav.length - 44, true);
info._songFilename = 'Audio/Song.wav'; entries['Info.dat'] = new TextEncoder().encode(JSON.stringify(info));
delete entries['Audio/Song.egg']; entries['Audio/Song.wav'] = wav;
const archive = zipSync(entries, { level: 0 });
assert(archive.length > wav.length && archive.length < 1_000_000, 'bounded playable ZIP');
const sourceHash = await computeBeatSaverMapHash(await inspectBeatSaverArchive(archive));
assert(hex(sourceHash, 40), 'real provider hash from fixture archive');
const zipUrl = `https://r2cdn.beatsaver.com/${sourceHash}.zip`;
const payload = createSyntheticMapPayload(sourceHash, zipUrl, 'FRIENDQA');
payload.name = 'Friend QA Fixture'; payload.metadata.songName = 'Friend QA Fixture';
payload.versions[0].previewURL = `https://cfcdn.beatsaver.com/${sourceHash}.mp3`;
payload.versions[0].coverURL = '';
const parent = createServer((_request, response) => { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer' }); response.end(`<!doctype html><meta name="viewport" content="width=device-width"><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" style="border:0;width:390px;height:844px" src="${rawUrl}"></iframe>`); });
await new Promise(done => parent.listen(0, 'localhost', done));
const address = parent.address(); assert(address && typeof address !== 'string');
const parentUrl = `http://localhost:${address.port}/`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  for (const embedding of ['direct', 'cross-origin iframe']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, acceptDownloads: true });
    const external = [], errors = [], fixtureHits = [];
    context.on('request', request => {
      if (!/^https?:/u.test(request.url())) return;
      const url = new URL(request.url());
      if ([origin, new URL(parentUrl).origin].includes(url.origin)) return;
      const approved = url.protocol === 'https:' && (
        url.hostname === 'api.beatsaver.com' && /^\/(?:search\/text\/[0-9]+|maps\/(?:latest|id\/[0-9a-zA-Z]+|hash\/[0-9a-fA-F]{40}))\/?$/u.test(url.pathname) ||
        url.hostname === 'r2cdn.beatsaver.com' && /^\/[a-f0-9]{40}\.zip$/iu.test(url.pathname) ||
        url.hostname === 'cfcdn.beatsaver.com' && /^\/[a-f0-9]{40}\.mp3$/iu.test(url.pathname));
      if (!approved || request.headers()['cookie'] || request.headers()['authorization'] || request.headers()['referer']) external.push(`${request.method()} ${url.origin}${url.pathname}`);
    });
    context.on('response', response => {
      if (!/^https?:/u.test(response.url())) return;
      const url = new URL(response.url());
      if ([origin, new URL(parentUrl).origin].includes(url.origin)) return;
      if (!['api.beatsaver.com', 'r2cdn.beatsaver.com', 'cfcdn.beatsaver.com'].includes(url.hostname)) external.push(`response ${url.origin}${url.pathname}`);
    });
    await context.route('https://api.beatsaver.com/search/text/*', async route => {
      fixtureHits.push('api');
      assert.equal(route.request().method(), 'GET');
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }, body: JSON.stringify({ docs: [payload], info: { page: 0, pages: 1, total: 1 } }) });
    });
    await context.route(zipUrl, async route => {
      fixtureHits.push('zip'); assert.equal(route.request().method(), 'GET');
      await route.fulfill({ status: 200, contentType: 'application/zip', headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }, body: Buffer.from(archive) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    try {
      const response = await page.goto(embedding === 'direct' ? rawUrl : parentUrl, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200);
      const frame = embedding === 'direct' ? page : page.frameLocator('#game');
      const game = frame.locator('aero-game'); await game.waitFor();
      if (embedding !== 'direct') assert.notEqual(new URL(parentUrl).origin, origin);
      assert.equal(await frame.locator('aero-game').count(), 1);
      assert.equal(await frame.locator('#play-cv-start, #play-cv-download, #play-cv-recorder').count(), 0, 'no diagnostic or JSON reporter');
      await frame.waitForFunction(() => document.querySelector('aero-game')?.graph?.authoring?.getCapabilities?.().conversionWorker === true && document.querySelector('aero-game')?.graph?.renderer?.describe?.().gameplayAssets?.state === 'ready', null, { timeout: 45000 });
      const music = game.locator('aero-beatsaver-browser');
      assert(await music.getByRole('textbox', { name: 'Search maps' }).isVisible(), 'visible Music search');
      assert(await music.getByRole('button', { name: 'Choose local ZIP' }).isVisible(), 'visible local import');
      await music.getByRole('textbox', { name: 'Search maps' }).fill('Friend QA Fixture');
      await music.getByRole('button', { name: 'Search', exact: true }).click();
      await frame.waitForFunction(() => document.querySelector('aero-game')?.beatSaverView?.state === 'ready', null, { timeout: 15000 });
      assert.deepEqual(await game.evaluate(element => ({ name: element.beatSaverView.results[0]?.name, count: element.beatSaverView.results.length })), { name: 'Friend QA Fixture', count: 1 });
      assert.match(await music.locator("[part='results']").innerText(), /Friend QA Fixture/u, 'fixture visible in Music results');
      assert(fixtureHits.includes('api'), 'real UI sent bounded API request');
      await music.locator("[part='result'] input[value='FRIENDQA']").check();
      assert(await music.getByRole('button', { name: 'Download', exact: true }).isEnabled());
      assert(await music.locator("[part='version-select']").isVisible(), 'selected provider version');
      await music.getByRole('button', { name: 'Download', exact: true }).click();
      await frame.waitForFunction(() => { const game = document.querySelector('aero-game'); return game?.libraryView?.collections?.length > 0 && game.graph?.content.getSnapshot().state === 'ready' && game.libraryView.selectedPackageId === game.graph.content.getSnapshot().packageId; }, null, { timeout: 60000 });
      assert(fixtureHits.includes('zip'), 'real selected exact-hash ZIP requested');
      assert(await game.locator('aero-session-actions').getByRole('button', { name: 'Start', exact: true }).isEnabled(), 'downloaded chart Start');
      await frame.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('aero-game')?.graph?.audio?.getStatus?.().state), null, { timeout: 12000 });
      const download = await game.evaluate(element => ({ worker: element.graph.authoring.getCapabilities().conversionWorker, variant: element.graph.content.getSnapshot().selectedVariant?.mode, audio: element.graph.audio.getStatus() }));
      assert.equal(download.worker, true); assert.equal(download.variant, 'flow');
      assert.equal(download.audio.state, 'ready', `${embedding}: BeatSaver ZIP audio decoding failed: ${download.audio.errorCode ?? 'no error code'}`);
      // New isolated browser origin: verify the genuine child-local file picker too.
      const chooserPending = page.waitForEvent('filechooser');
      await music.getByRole('button', { name: 'Choose local ZIP' }).click();
      const chooser = await chooserPending;
      await chooser.setFiles({ name: 'friend-qa-stored-wav.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) });
      await frame.waitForFunction(() => { const game = document.querySelector('aero-game'); return game?.libraryView?.collections?.length >= 2 && game.graph?.content.getSnapshot().state === 'ready' && game.libraryView.selectedPackageId === game.graph.content.getSnapshot().packageId; }, null, { timeout: 60000 });
      await frame.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('aero-game')?.graph?.audio?.getStatus?.().state), null, { timeout: 12000 });
      const local = await game.evaluate(element => ({ audio: element.graph.audio.getStatus(), worker: element.graph.authoring.getCapabilities().conversionWorker, mode: element.graph.content.getSnapshot().selectedVariant?.mode }));
      assert.equal(local.audio.state, 'ready', `${embedding}: local ZIP audio decoding failed: ${local.audio.errorCode ?? 'no error code'}`);
      assert.equal(local.worker, true); assert.equal(local.mode, 'flow');
      await game.locator('aero-session-actions').getByRole('button', { name: 'Start', exact: true }).click();
      await frame.waitForFunction(() => { const game = document.querySelector('aero-game'); return game?.graph?.gameplay.getSnapshot().session.purpose === 'play' && game.graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState === 'live' && game.graph.cv.getStatus().lifecycleState === 'running' && game.graph.cv.getStatus().poseFrameCount > 0; }, null, { timeout: 45000 });
      const state = await game.evaluate(element => ({ profile: element.getSnapshot().cvProfile, provider: element.graph.cv.getStatus().providerId, session: element.graph.gameplay.getSnapshot().session.state, poses: element.graph.cv.getStatus().poseFrameCount, worker: element.graph.authoring.getCapabilities().conversionWorker }));
      assert.equal(state.provider, 'cpu-wasm', 'actual initialized CPU Worker');
      assert.equal(state.profile.providerId, 'cpu-wasm'); assert(state.poses > 0 && state.worker);
      const canvas = await game.evaluate(element => { const renderer = element.shadowRoot.querySelector('canvas[data-role="renderer"]'); return { width: renderer?.width, height: renderer?.height, assets: element.graph.renderer.describe().gameplayAssets.state }; });
      assert(canvas.width > 0 && canvas.height > 0 && canvas.assets === 'ready', 'named camera Play state has actual GLB-ready nonzero framebuffer');
      const cvWorkers = page.workers().filter(worker => /mediapipe/iu.test(worker.url()) && new URL(worker.url()).origin === origin);
      assert.equal(cvWorkers.length, 1, 'one actual same-origin MediaPipe Worker');
      const workerPaths = names.filter(name => /worker.*\.js$/iu.test(name));
      assert(workerPaths.includes(new URL(cvWorkers[0].url()).pathname.slice(1)), 'real CPU Worker is a signed served asset');
      const beforeForbidden = external.length;
      assert.equal(await cvWorkers[0].evaluate(() => fetch('https://api.beatsaver.com/search/text/0?q=blocked-worker').then(() => false, () => true)), true, 'Worker must not inherit document API egress');
      assert.equal(await frame.evaluate(() => fetch('https://example.invalid/friend-qa-probe').then(() => false, () => true)), true, 'document blocks off-host');
      assert.equal(external.length, beforeForbidden, 'CSP-denied probes never dispatch external HTTP');
      assert.deepEqual(external, [], `unexpected request egress: ${embedding}`);
      assert.equal(context.serviceWorkers().length, 0, 'no unsigned service-worker interception');
      assert.deepEqual(errors, [], `uncaught errors: ${embedding}`);
      console.log(`PASS ${embedding}: real authoring Worker, BeatSaver ZIP, local ZIP, camera and CPU MediaPipe Worker; state=${state.session} (not physical calibration/scoring)`);
    } finally { await context.close(); }
  }
} finally {
  await browser?.close();
  await new Promise(done => parent.close(done));
}
console.log('PASS signed normal CPU friend game browser gate; physical phone and scored-body-contact acceptance remain separate');
