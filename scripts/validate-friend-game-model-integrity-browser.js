// @ts-check
// Test-owned signed-byte adversarial browser oracle; never a phone-speed or scoring test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { lstatSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { loadSignedSnapshot, handlerForSnapshot } from './serve-friend-game.js';
import { createSyntheticBeatSaverZip } from '../../aerobeat-web-vendor-beatsaver/scripts/fixture-helpers.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const selected = process.env.AEROBEAT_FRIEND_GAME_PROGRESS_DIR;
const directory = selected === undefined ? resolve(root, 'dist-friend-game') : resolve(root, selected);
if (selected !== undefined) {
  assert(!isAbsolute(selected) && !selected.includes('\\') && selected.split('/').every(part => part && part !== '.' && part !== '..'), 'candidate selector must be a safe relative path');
  const inside = relative(resolve(root, '.tmp'), directory);
  assert(inside && inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside) && !inside.includes(sep), 'candidate must be a direct child of .tmp');
  assert.equal(realpathSync(resolve(root, '.tmp')), resolve(root, '.tmp'), 'candidate parent must be canonical');
  assert(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink(), 'candidate must be a real directory');
  assert.equal(realpathSync(directory), directory, 'candidate directory must be canonical and not a symlink');
}
const modelPath = '/assets/mediapipe/pose_landmarker_lite.task';
const snapshot = loadSignedSnapshot(directory); // Verify full inventory, bytes, provenance and policy before listening.
const model = snapshot.bytes.get(modelPath);
assert.equal(model?.length, 5_777_746, 'signed model decoded size');
assert.equal(createHash('sha256').update(model).digest('hex'), snapshot.manifest.assets.find(asset => asset.path === modelPath.slice(1))?.sha256);
const wasmPaths = [...snapshot.bytes.keys()].filter(path => /^\/assets\/mediapipe\/wasm\/[^/]+\.wasm$/u.test(path));
assert.equal(wasmPaths.length, 3, 'all signed classic/module/nosimd WASM variants present');
const selectedAssetTotals = new Set(wasmPaths.map(path => {
  const loader = snapshot.bytes.get(path.replace(/\.wasm$/u, '.js'));
  const binary = snapshot.bytes.get(path);
  assert(loader?.length > 0 && binary?.length > 0, `signed runtime pair ${path}`);
  return model.length + loader.length + binary.length;
}));
const signedHandler = handlerForSnapshot(snapshot);
const { unzipSync, zipSync } = createRequire(new URL('../../aerobeat-web-vendor-beatsaver/package.json', import.meta.url))('fflate');
const entries = unzipSync(createSyntheticBeatSaverZip(2));
const info = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entries['Info.dat']));
const rate = 8000, wav = new Uint8Array(44 + rate * 35 * 2), view = new DataView(wav.buffer);
for (const [offset, text] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']]) for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
view.setUint32(4, wav.length - 8, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, wav.length - 44, true);
info._songFilename = 'Audio/Song.wav'; entries['Info.dat'] = new TextEncoder().encode(JSON.stringify(info));
delete entries['Audio/Song.egg']; entries['Audio/Song.wav'] = wav;
const archive = Buffer.from(zipSync(entries, { level: 0 }));
assert(archive.length < 1_000_000, 'test-owned chart size');
const timeout = (promise, ms, label) => Promise.race([promise, delay(ms).then(() => { throw Error(`timeout ${label}`); })]);

async function runCase(kind) {
  assert(['tamper', 'truncate', 'cancel'].includes(kind), 'known signed model failure case');
  const tamper = kind === 'tamper', cancel = kind === 'cancel';
  const sent = tamper ? Buffer.from(model) : kind === 'truncate' ? model.subarray(0, model.length - 1) : model;
  if (tamper) sent[sent.length - 1] ^= 1;
  assert(cancel ? sent === model : tamper ? sent.length === model.length && !sent.equals(model) : sent.length === model.length - 1);
  const counts = new Map(), reached = [];
  const checkpoints = [1, 2, 3].map(index => Math.floor(model.length * index / 4));
  const held = checkpoints.map((_, index) => new Promise(done => { reached[index] = done; }));
  const resume = []; const released = checkpoints.map((_, index) => new Promise(done => { resume[index] = done; }));
  const streaming = new Set();
  let modelResponseCompleted = false;
  let modelBytesSent = 0;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (request.method === 'GET') counts.set(path, (counts.get(path) ?? 0) + 1);
    if (request.method !== 'GET' || path !== modelPath) return signedHandler(request, response);
    // Delegate all response headers to the signed server, changing only the body
    // of this one test-owned model response. Immediate identity headers give an
    // original-size denominator independent of compressed wire Content-Length.
    const chunks = [];
    const sink = {
      setHeader: (...args) => response.setHeader(...args),
      end: body => { if (body) chunks.push(body); },
      set statusCode(code) { response.statusCode = code; }
    };
    signedHandler({ ...request, headers: { ...request.headers, 'accept-encoding': 'identity' } }, sink);
    if (response.statusCode !== 200 || chunks.length !== 1) { response.end(); return; }
    assert.deepEqual(chunks[0], model, 'unmodified signed handler model response');
    response.removeHeader('Content-Encoding');
    response.setHeader('Content-Length', model.length);
    response.flushHeaders();
    response.once('finish', () => { modelResponseCompleted = true; });
    streaming.add(response);
    try {
      let offset = 0;
      for (let index = 0; index < checkpoints.length; index++) {
        const end = checkpoints[index];
        while (offset < end) {
          const next = Math.min(end, offset + 65_536);
          response.write(sent.subarray(offset, next)); offset = next; modelBytesSent = offset;
          await delay(10);
        }
        reached[index]();
        await released[index];
      }
      while (offset < sent.length) {
        const next = Math.min(sent.length, offset + 65_536);
        response.write(sent.subarray(offset, next)); offset = next; modelBytesSent = offset;
        await delay(10);
      }
      response.end();
    } catch (error) { response.destroy(error); }
    finally { streaming.delete(response); }
  });
  let browser, context, page;
  try {
    server.listen(0, '127.0.0.1');
    await new Promise(done => server.once('listening', done));
    const address = server.address(); assert(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block' });
    page = await context.newPage();
    const external = [], errors = [], workerUrls = [], requestFailures = [];
    page.on('worker', worker => workerUrls.push(worker.url()));
    page.on('requestfailed', request => { if (new URL(request.url()).pathname === modelPath) requestFailures.push(request.failure()?.errorText ?? 'unknown'); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/u.test(request.url()) && new URL(request.url()).origin !== origin) external.push(request.url()); });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    assert.equal((await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' }))?.status(), 200);
    const game = page.locator('aero-game'); await game.waitFor();
    await page.waitForFunction(() => document.querySelector('aero-game')?.graph?.authoring?.getCapabilities?.().conversionWorker === true && document.querySelector('aero-game')?.graph?.renderer?.describe?.().gameplayAssets?.state === 'ready', null, { timeout: 45000 });
    const chooser = page.waitForEvent('filechooser');
    await game.locator('aero-beatsaver-browser').getByRole('button', { name: 'Choose local ZIP' }).click();
    await (await chooser).setFiles({ name: 'integrity-qa.zip', mimeType: 'application/zip', buffer: archive });
    await page.waitForFunction(() => { const g = document.querySelector('aero-game'); return g?.libraryView?.selectedPackageId && g.graph?.content?.getSnapshot?.().state === 'ready' && g.graph.audio.getStatus().state === 'ready'; }, null, { timeout: 60000 });
    const initial = await game.evaluate(g => ({ playable: g.selectedDownloadedContentPlayable(), cv: g.graph.cv.getStatus().lifecycleState, audio: g.graph.audio.getStatus().state }));
    assert(initial.playable && initial.audio === 'ready' && initial.cv !== 'running', `valid chart setup ${JSON.stringify(initial)}`);
    await game.locator('aero-session-actions').getByRole('button', { name: 'Start', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('aero-game')?.graph?.cv?.getStatus?.().lifecycleState === 'loading', null, { timeout: 15000 });
    const state = () => game.evaluate(g => {
      const actions = g.shadowRoot.querySelector('aero-session-actions')?.shadowRoot;
      const bar = actions?.querySelector('progress[part="model-download-progress"]');
      const status = actions?.querySelector('[part="pending-status"]');
      const percent = actions?.querySelector('[part="model-download-percent"]');
      const visibleCopy = [...(actions?.querySelectorAll('p, [part="model-download-percent"]') ?? [])].filter(item => { const rect = item.getBoundingClientRect(), style = getComputedStyle(item); return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility === 'visible'; }).map(item => item.textContent?.trim() ?? '');
      const error = g.shadowRoot.querySelector('[data-role="info-action"]');
      return { cv: g.graph.cv.getStatus(), session: g.graph.gameplay.getSnapshot().session,
        audio: g.graph.audio.getStatus().state, pending: g.pendingSessionAction,
        active: g.activeSessionAction, error: g.lastError,
        errorText: error?.textContent?.trim() ?? '', errorVisible: Boolean(error && !error.hidden && error.getBoundingClientRect().width > 0 && error.getBoundingClientRect().height > 0),
        text: status?.textContent?.trim() ?? '', percent: percent?.textContent?.trim() ?? '', visibleCopy,
        panel: Boolean(actions?.querySelector('[part="model-download"]')), bar: Boolean(bar), determinate: bar?.hasAttribute('value') ?? false,
        aria: bar?.getAttribute('aria-label') ?? '', bytes: bar?.value ?? null,
        total: bar?.max ?? null, progress: g.graph.cv.getModelDownloadProgress?.() ?? null,
        camera: g.graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState ?? 'none' };
    });
    const preBytes = await state();
    assert(preBytes.bar && !preBytes.determinate && preBytes.aria === 'Tracker asset download' && preBytes.percent === '' && preBytes.visibleCopy.length === 0 && preBytes.text === '' && !preBytes.panel,
      `${kind}: pre-byte loading uses same indeterminate native bar without old visible prose, number, or panel: ${JSON.stringify(preBytes)}`);
    const observed = [];
    let cameraBeforeRemoval = null;
    for (let index = 0; index < checkpoints.length; index++) {
      await timeout(held[index], 25000, `${kind} chunk ${index}`);
      await page.waitForFunction(floor => {
        const root = document.querySelector('aero-game')?.shadowRoot?.querySelector('aero-session-actions')?.shadowRoot;
        return root?.querySelector('progress[part="model-download-progress"]')?.value >= floor;
      }, checkpoints[index], { timeout: 12000 });
      const now = await state();
      assert.equal(now.cv.lifecycleState, 'loading');
      assert(selectedAssetTotals.has(now.total), 'bar denominator includes exact selected signed model+WASM loader/binary assets');
      assert(now.bytes >= checkpoints[index] && now.bytes < (checkpoints[index + 1] ?? model.length), JSON.stringify(now));
      assert(now.bar && now.determinate && now.aria === 'Tracker asset download', 'native bar names selected tracker asset downloads');
      assert.equal(now.percent, `${Math.floor(100 * now.bytes / now.total)}%`, 'bare adjacent percent derives from signed decoded model and runtime asset bytes');
      assert.deepEqual(now.visibleCopy, [now.percent], 'old model prose and extra visible status absent');
      assert(now.text === '' && !now.panel, 'no former Loading pose model sentence or status panel');
      assert(now.camera === 'live' && !now.error && now.active === '' && now.pending === 'start', 'real pending Play and camera during model streaming');
      assert.equal(now.audio === 'playing', false);
      assert.notEqual(now.session.state, 'playing');
      assert.equal(counts.get(modelPath), 1);
      assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 0,
        `${kind}: zero WASM GETs while signed model held at ${index + 1}/4`);
      observed.push(now.bytes);
      if (cancel) { cameraBeforeRemoval = now.camera; break; } // Hold at 25%; never send the other 75%.
      resume[index]();
    }
    if (cancel) {
      const cancellation = await game.evaluate(g => {
        const track = g.graph.video.getRetainedCameraStream()?.getVideoTracks()[0];
        globalThis.__modelCancel = { videoTrack: track, graph: g.graph, element: g };
        g.remove(); // Real custom-element disconnect, not a vendor or adapter mock.
        return { disconnected: !g.isConnected, trackBeforeRemoval: track?.readyState ?? 'none' };
      });
      assert(cancellation.disconnected && cameraBeforeRemoval === 'live', `real game disconnects after verified live camera at held 25%: ${JSON.stringify({ cancellation, cameraBeforeRemoval })}`);
      await page.waitForFunction(() => document.querySelector('aero-game') === null, null, { timeout: 10000 });
      const cancelled = await page.evaluate(() => {
        const { videoTrack, graph, element } = globalThis.__modelCancel;
        return { track: videoTrack?.readyState ?? 'none', cv: graph.cv.getStatus(),
          audio: graph.audio.getStatus().state, session: graph.gameplay.getSnapshot().session.state,
          workerRunning: graph.cv.running, elementLifecycle: element.lifecycle, pending: element.pendingSessionAction,
          active: element.activeSessionAction, oldBar: Boolean(element.shadowRoot.querySelector('progress[part="model-download-progress"]')),
          oldPercent: Boolean(element.shadowRoot.querySelector('[part="model-download-percent"]')) };
      });
      assert.equal(cancelled.track, 'ended', 'disconnected game stops its owned fake-camera track');
      assert.equal(cancelled.cv.lifecycleState, 'disposed', 'old CV service invalidated before load can finish');
      assert.equal(cancelled.cv.poseFrameCount, 0, 'no stale Worker pose accepted');
      assert.equal(cancelled.cv.error, null, 'deliberate cancellation is not a model-integrity failure');
      assert.equal(cancelled.audio, 'destroyed', 'old audio service destroyed');
      assert.equal(cancelled.session, 'destroyed', 'old gameplay service destroyed');
      assert.equal(cancelled.workerRunning, false);
      assert.equal(cancelled.elementLifecycle, 'disconnected');
      assert.equal(cancelled.pending, ''); assert.equal(cancelled.active, '');
      assert.equal(cancelled.oldBar, false, 'disconnected element has no stale model bar');
      assert.equal(cancelled.oldPercent, false, 'disconnected element has no stale model percent');
      // Old Worker termination may wait for its intentionally blocked fetch; the
      // disposed CV generation must reject all late loaded/pose continuations.
      assert.deepEqual(observed, [checkpoints[0]], 'model progress stopped at exact 25% checkpoint');
      assert.equal(modelBytesSent, checkpoints[0], 'fixture delivered only 25% signed model bytes');
      assert.equal(modelResponseCompleted, false, 'cancelled transfer did not complete signed model bytes');
      assert.equal(counts.get(modelPath), 1, 'one model GET before user cancellation');
      assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 0, 'no WASM GET before incomplete model cancellation');
      assert.equal(workerUrls.filter(url => /mediapipe/u.test(url)).length, 1, 'real MediaPipe Worker created');
      assert.deepEqual(external, [], 'no off-origin request attempts');
      assert.deepEqual(errors, [], 'no uncaught page errors');
      await page.waitForTimeout(300);
      const late = await page.evaluate(() => {
        const { graph, element, videoTrack } = globalThis.__modelCancel;
        return { cv: graph.cv.getStatus(), audio: graph.audio.getStatus().state,
          session: graph.gameplay.getSnapshot().session.state, track: videoTrack?.readyState ?? 'none',
          pending: element.pendingSessionAction, active: element.activeSessionAction,
          progress: element.foregroundModelDownloadProgress?.() ?? null,
          bar: Boolean(element.shadowRoot.querySelector('progress[part="model-download-progress"]')),
          percent: Boolean(element.shadowRoot.querySelector('[part="model-download-percent"]')) };
      });
      assert.equal(late.cv.lifecycleState, 'disposed', 'late Worker messages cannot restore CV');
      assert.equal(late.cv.poseFrameCount, 0, 'late Worker messages cannot create accepted poses');
      assert.equal(late.audio, 'destroyed'); assert.equal(late.session, 'destroyed');
      assert.equal(late.track, 'ended'); assert.equal(late.pending, ''); assert.equal(late.active, '');
      assert.equal(late.progress, null); assert.equal(late.bar, false); assert.equal(late.percent, false);
      console.log(`PASS cancel: ${JSON.stringify({ bytes: observed[0], modelGets: counts.get(modelPath), wasmGets: wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), track: cancelled.track, cv: cancelled.cv.lifecycleState, session: cancelled.session, audio: cancelled.audio, responseCompleted: modelResponseCompleted, liveWorkersAfterRemoval: page.workers().filter(worker => /mediapipe/u.test(worker.url())).length, browserRequestFailures: requestFailures })}`);
      return;
    }
    await page.waitForFunction(() => {
      const g = document.querySelector('aero-game');
      return g?.lastError && g.pendingSessionAction === '' && g.graph.cv.getStatus().lifecycleState !== 'running';
    }, null, { timeout: 40000 });
    const failed = await state();
    assert.equal(counts.get(modelPath), 1, 'exactly one tampered/truncated model GET');
    assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 0, 'tampered or truncated model cannot trigger any CPU WASM GET');
    assert.equal(workerUrls.filter(url => /mediapipe/u.test(url)).length, 1, `genuine MediaPipe Worker created: ${JSON.stringify(workerUrls)}`);
    assert(failed.error && /model|integrity|hash|length|fetch|load|network/iu.test(failed.error.message), `actionable model failure ${JSON.stringify(failed)}`);
    assert(!failed.bar && failed.percent === '' && !failed.panel && !/%/u.test(failed.text), `no stale model bar or foreground percentage after failure: ${JSON.stringify(failed)}`);
    assert(failed.errorVisible && failed.errorText.includes(failed.error.message), `visible actionable error: ${JSON.stringify(failed)}`);
    assert.notEqual(failed.cv.lifecycleState, 'running');
    assert.notEqual(failed.session.state, 'playing');
    assert.notEqual(failed.audio, 'playing');
    assert.equal(failed.pending, ''); assert.equal(failed.active, '');
    assert.equal(failed.camera, 'none', 'failed Play releases the test camera lease');
    assert.deepEqual(observed, checkpoints, 'deterministic original-size quarter-chunk progress');
    assert.deepEqual(external, [], 'no off-origin request attempts');
    assert.deepEqual(errors, [], 'no uncaught page errors');
    console.log(`PASS ${kind}: ${JSON.stringify({ chunks: checkpoints, error: failed.error, cv: failed.cv.lifecycleState, session: failed.session.state, audio: failed.audio, modelGets: counts.get(modelPath), wasmGets: wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), external: external.length })}`);
  } finally {
    for (const unblock of resume) unblock();
    for (const response of streaming) response.destroy();
    await context?.close(); await browser?.close();
    if (server.listening) await new Promise(done => server.close(done));
  }
}

await runCase('tamper');
await runCase('truncate');
await runCase('cancel');
