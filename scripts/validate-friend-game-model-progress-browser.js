// @ts-check
// Signed, isolated direct/cross-origin iframe browser oracle. Fake camera and chart are test-owned;
// this is not physical calibration, scored contact, or a public service.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { loadSignedSnapshot, handlerForSnapshot } from './serve-friend-game.js';
import { createSyntheticBeatSaverZip } from '../../aerobeat-web-vendor-beatsaver/scripts/fixture-helpers.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const selected = process.env.AEROBEAT_FRIEND_GAME_PROGRESS_DIR;
const directory = selected === undefined ? resolve(root, 'dist-friend-game') : resolve(root, selected);
const embedding = process.env.AEROBEAT_FRIEND_GAME_PROGRESS_EMBEDDING ?? 'direct';
assert(['direct', 'iframe'].includes(embedding), 'only direct or cross-origin iframe embedding');
const extendedSlowStart = process.env.AEROBEAT_FRIEND_GAME_PROGRESS_EXTENDED_SLOW_START;
assert(extendedSlowStart === undefined || extendedSlowStart === '1', 'extended slow start must be exactly 1 when supplied');
const wasmHoldMs = extendedSlowStart === '1' ? 35_000 : 6_000;
if (selected !== undefined) {
  assert(!isAbsolute(selected) && !selected.includes('\\') && selected.split('/').every(part => part && part !== '.' && part !== '..'), 'candidate selector must be a safe relative path');
  const inside = relative(resolve(root, '.tmp'), directory);
  assert(inside && inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside) && !inside.includes(sep), 'candidate must be a direct child of .tmp');
}
const snapshot = loadSignedSnapshot(directory); // Verifies every asset and exact response policy before listening.
const modelPath = '/assets/mediapipe/pose_landmarker_lite.task';
const model = snapshot.bytes.get(modelPath);
assert.equal(model?.length, 5_777_746, 'exact signed decoded model size');
assert.equal(createHash('sha256').update(model).digest('hex'), snapshot.manifest.assets.find(asset => asset.path === modelPath.slice(1))?.sha256);
const wasmPaths = [...snapshot.bytes.keys()].filter(path => /^\/assets\/mediapipe\/wasm\/[^/]+\.wasm$/u.test(path));
assert.equal(wasmPaths.length, 3, 'three signed Tasks Vision 1.0.1 classic/module/nosimd variants');
const runtimePairs = new Map(wasmPaths.map(binaryPath => {
  const loaderPath = binaryPath.replace(/\.wasm$/u, '.js');
  const loader = snapshot.bytes.get(loaderPath), binary = snapshot.bytes.get(binaryPath);
  assert(loader?.length > 0 && binary?.length > 0, `complete signed WASM pair: ${binaryPath}`);
  return [binaryPath, { loaderPath, total: model.length + loader.length + binary.length }];
}));
const possibleAssetTotals = new Set([...runtimePairs.values()].map(pair => pair.total));
const signedHandler = handlerForSnapshot(snapshot);
const holds = [0.25, 0.5, 0.75].map(fraction => Math.floor(model.length * fraction));
const release = []; const reach = [];
const gates = holds.map((_, index) => new Promise(done => { release[index] = done; }));
const reached = holds.map((_, index) => new Promise(done => { reach[index] = done; }));
const counts = new Map();
let wasmHoldStartedAt = null, wasmBodySentAt = null, modelBodySentAt = null, modelResponseFinishedAt = null;
let wasmRequestStartedAt = null, browserModelFinishedAt = null, browserWasmStartedAt = null;
let markWasmSent;
const wasmSent = new Promise(done => { markWasmSent = done; });
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (request.method === 'GET') {
    counts.set(path, (counts.get(path) ?? 0) + 1);
    if (wasmPaths.includes(path)) {
      if (wasmRequestStartedAt === null) wasmRequestStartedAt = performance.now();
    }
  }
  if (request.method !== 'GET' || ![modelPath, ...wasmPaths].includes(path)) return signedHandler(request, response);
  // Use the same signed handler's exact headers/CSP/MIME, but pace only its
  // verified identity bytes. The model content length is decoded identity size.
  const headers = { ...request.headers, 'accept-encoding': 'identity' };
  const chunks = [];
  const sink = {
    setHeader: (...args) => response.setHeader(...args),
    end: body => { if (body) chunks.push(body); },
    set statusCode(code) { response.statusCode = code; }
  };
  signedHandler({ ...request, headers }, sink);
  if (response.statusCode !== 200 || chunks.length !== 1) { response.end(); return; }
  const bytes = chunks[0];
  assert.deepEqual(bytes, snapshot.bytes.get(path), 'paced body is exact signed identity bytes');
  response.removeHeader('Content-Encoding');
  response.setHeader('Content-Length', bytes.length);
  response.flushHeaders();
  if (path !== modelPath) {
    assert(wasmHoldStartedAt === null, 'one real signed WASM response held');
    wasmHoldStartedAt = performance.now();
    await delay(wasmHoldMs + 50);
    wasmBodySentAt = performance.now();
    response.end(bytes); markWasmSent(); return;
  }
  let offset = 0;
  for (let index = 0; index < holds.length; index++) {
    const end = holds[index];
    while (offset < end) { const next = Math.min(end, offset + 65536); response.write(bytes.subarray(offset, next)); offset = next; await delay(15); }
    reach[index]();
    await gates[index];
  }
  while (offset < bytes.length) { const next = Math.min(bytes.length, offset + 65536); response.write(bytes.subarray(offset, next)); offset = next; await delay(15); }
  modelBodySentAt = performance.now();
  response.once('finish', () => { modelResponseFinishedAt = performance.now(); });
  response.end();
});
const withTimeout = (promise, milliseconds, label) => Promise.race([promise, delay(milliseconds).then(() => { throw Error(`timeout: ${label}`); })]);
const { unzipSync, zipSync } = createRequire(new URL('../../aerobeat-web-vendor-beatsaver/package.json', import.meta.url))('fflate');
const entries = unzipSync(createSyntheticBeatSaverZip(2));
const info = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entries['Info.dat']));
const sampleRate = 8000, seconds = 35;
const wav = new Uint8Array(44 + sampleRate * seconds * 2), view = new DataView(wav.buffer);
const label = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
label(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); label(8, 'WAVEfmt ');
view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
view.setUint16(32, 2, true); view.setUint16(34, 16, true);
label(36, 'data'); view.setUint32(40, wav.length - 44, true);
info._songFilename = 'Audio/Song.wav'; entries['Info.dat'] = new TextEncoder().encode(JSON.stringify(info));
delete entries['Audio/Song.egg']; entries['Audio/Song.wav'] = wav;
const archive = Buffer.from(zipSync(entries, { level: 0 }));
assert(archive.length < 1_000_000);

server.listen(0, '127.0.0.1');
await new Promise(done => server.once('listening', done));
const address = server.address(); assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const parent = embedding === 'iframe' ? createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer' });
  response.end(`<!doctype html><meta name="viewport" content="width=device-width"><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" style="border:0;width:390px;height:844px" src="${origin}/"></iframe>`);
}) : null;
if (parent) { parent.listen(0, 'localhost'); await new Promise(done => parent.once('listening', done)); }
const parentAddress = parent?.address();
if (parent) assert(parentAddress && typeof parentAddress !== 'string', 'cross-origin iframe parent listening');
const parentUrl = parent ? `http://localhost:${parentAddress.port}/` : null;
let browser, context;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const external = [], errors = [], modelRequestFailures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => { if (new URL(request.url()).pathname === modelPath) modelRequestFailures.push(request.failure()?.errorText ?? 'unknown'); });
  const approvedOrigins = new Set([origin, ...(parentUrl ? [new URL(parentUrl).origin] : [])]);
  page.on('request', request => {
    if (!/^https?:/u.test(request.url())) return;
    const url = new URL(request.url());
    if (!approvedOrigins.has(url.origin)) external.push(request.url());
    if (request.method() === 'GET' && wasmPaths.includes(url.pathname) && browserWasmStartedAt === null) browserWasmStartedAt = performance.now();
  });
  page.on('requestfinished', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === modelPath) browserModelFinishedAt = performance.now();
  });
  await page.route('**/*', route => approvedOrigins.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  assert.equal((await page.goto(parentUrl ?? `${origin}/`, { waitUntil: 'domcontentloaded' }))?.status(), 200);
  if (parent) await page.frameLocator('#game').locator('aero-game').waitFor();
  const frame = parent ? page.frames().find(candidate => candidate !== page.mainFrame() && candidate.url() === `${origin}/`) : page.mainFrame();
  assert(frame && frame.url() === `${origin}/`, 'actual signed game child frame');
  if (parent) assert.notEqual(new URL(page.url()).origin, new URL(frame.url()).origin, 'genuine cross-origin iframe');
  const game = frame.locator('aero-game'); await game.waitFor();
  await frame.waitForFunction(() => document.querySelector('aero-game')?.graph?.authoring?.getCapabilities?.().conversionWorker === true && document.querySelector('aero-game')?.graph?.renderer?.describe?.().gameplayAssets?.state === 'ready', null, { timeout: 45000 });
  const music = game.locator('aero-beatsaver-browser');
  const beforeTest = await game.evaluate(element => ({ cv: element.graph.cv.getStatus().lifecycleState,
    modelBar: Boolean(element.shadowRoot.querySelector('aero-session-actions')?.shadowRoot?.querySelector('progress[part="model-download-progress"]')),
    modelPercent: Boolean(element.shadowRoot.querySelector('aero-session-actions')?.shadowRoot?.querySelector('[part="model-download-percent"]')) }));
  assert(beforeTest.cv !== 'running' && !beforeTest.modelBar && !beforeTest.modelPercent, 'standalone audio-only Test begins without an earlier Play or model bar');
  const chooserPromise = page.waitForEvent('filechooser');
  await music.getByRole('button', { name: 'Choose local ZIP' }).click();
  await (await chooserPromise).setFiles({ name: 'qa-model-progress.zip', mimeType: 'application/zip', buffer: archive });
  await frame.waitForFunction(() => { const game = document.querySelector('aero-game'); return game?.libraryView?.selectedPackageId && game.graph?.content?.getSnapshot?.().state === 'ready' && game.graph.audio.getStatus().state === 'ready'; }, null, { timeout: 60000 });
  const inspect = () => game.evaluate(element => {
    const drawer = element.shadowRoot.querySelector('[data-role="drawer"]');
    const viewport = { width: Math.min(innerWidth, document.documentElement.clientWidth), height: Math.min(innerHeight, document.documentElement.clientHeight) };
    const actions = drawer?.querySelector('aero-session-actions');
    const root = actions?.shadowRoot;
    const bar = root?.querySelector('progress[part="model-download-progress"]');
    const label = root?.querySelector('[part="pending-status"]');
    const percent = root?.querySelector('[part="model-download-percent"]');
    const panel = root?.querySelector('[part="model-download"]');
    const visibleCopy = [...(root?.querySelectorAll('p, [part="model-download-percent"]') ?? [])].filter(item => { const rect = item.getBoundingClientRect(), style = getComputedStyle(item); return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility === 'visible'; }).map(item => item.textContent?.trim() ?? '');
    const queuedLabel = root?.querySelector('[part="queued-status"]');
    const button = root?.querySelector('button[part="start-button"]');
    const testButton = root?.querySelector('button[part="test-button"]');
    const box = bar?.getBoundingClientRect(), buttonBox = button?.getBoundingClientRect();
    const percentBox = percent?.getBoundingClientRect();
    const x = box ? box.x + box.width / 2 : 0, y = box ? box.y + box.height / 2 : 0;
    const hit = box ? root.elementFromPoint(x, y) : null;
    const foreground = box ? element.shadowRoot.elementFromPoint(x, y) : null;
    const percentX = percentBox ? percentBox.x + percentBox.width / 2 : 0, percentY = percentBox ? percentBox.y + percentBox.height / 2 : 0;
    const percentHit = percentBox ? root.elementFromPoint(percentX, percentY) : null;
    const percentForeground = percentBox ? element.shadowRoot.elementFromPoint(percentX, percentY) : null;
    const queueBox = queuedLabel?.getBoundingClientRect();
    const queueX = queueBox ? queueBox.x + queueBox.width / 2 : 0, queueY = queueBox ? queueBox.y + queueBox.height / 2 : 0;
    const queueHit = queueBox ? root.elementFromPoint(queueX, queueY) : null;
    const queueForeground = queueBox ? element.shadowRoot.elementFromPoint(queueX, queueY) : null;
    return { bar: Boolean(bar), determinate: bar?.hasAttribute('value') ?? false, value: bar?.value ?? null, max: bar?.max ?? null,
      text: label?.textContent?.trim() ?? '', percent: percent?.textContent?.trim() ?? '', visibleCopy, panel: Boolean(panel), aria: bar?.getAttribute('aria-label') ?? '', pending: element.pendingSessionAction,
      percentVisible: Boolean(percentBox && box && percentBox.width > 0 && percentBox.height > 0 && percentBox.left >= box.right && percentBox.right <= viewport.width && percentBox.bottom <= viewport.height && Math.abs(percentBox.top - box.top) <= 16 && getComputedStyle(percent).visibility === 'visible' && getComputedStyle(percent).display !== 'none' && (percentHit === percent || percent.contains(percentHit)) && (percentForeground === actions || percentForeground === drawer)),
      queuedText: queuedLabel?.textContent?.trim() ?? '', queuedRole: queuedLabel?.getAttribute('role') ?? '',
      queuedVisible: Boolean(queuedLabel && queueBox.width >= 80 && queueBox.height >= 16 && queueBox.left >= 0 && queueBox.top >= 0 && queueBox.right <= viewport.width && queueBox.bottom <= viewport.height && buttonBox.width >= 40 && Math.abs(queueBox.top - buttonBox.top) <= 200 && getComputedStyle(queuedLabel).visibility === 'visible' && getComputedStyle(queuedLabel).display !== 'none' && Number(getComputedStyle(queuedLabel).opacity) > 0 && !queuedLabel.closest('[hidden], [aria-hidden="true"]') && (queueHit === queuedLabel || queuedLabel.contains(queueHit)) && (queueForeground === actions || queueForeground === drawer)),
      testEnabled: Boolean(testButton && !testButton.disabled), testBusy: testButton?.getAttribute('aria-busy') ?? '',
      cv: element.graph.cv.getStatus().lifecycleState, camera: element.graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState ?? 'none',
      session: element.graph.gameplay.getSnapshot().session.state, audio: element.graph.audio.getStatus().state,
      active: element.activeSessionAction, modelDownload: element.graph.cv.getModelDownloadProgress?.() ?? null,
      visible: Boolean(bar && drawer && !drawer.hidden && drawer.getAttribute('aria-hidden') !== 'true' && box.width >= 80 && box.height >= 4 && box.x >= 0 && box.y >= 0 && box.right <= viewport.width && box.bottom <= viewport.height && buttonBox.width >= 40 && Math.abs(box.top - buttonBox.top) <= 200 && getComputedStyle(bar).visibility === 'visible' && getComputedStyle(bar).display !== 'none' && (hit === bar || bar.contains(hit)) && (foreground === actions || foreground === drawer)),
      labelVisible: Boolean(label && label.getBoundingClientRect().width >= 80 && getComputedStyle(label).visibility === 'visible') };
  });
  const checkIndeterminate = async stage => {
    const state = await inspect();
    assert(state.bar && state.visible && !state.determinate && ['Tracker asset download', 'Pose model download'].includes(state.aria), `${stage}: same accessible native indeterminate bar before asset selection: ${JSON.stringify(state)}`);
    assert(state.percent === '' && state.visibleCopy.length === 0 && state.text === '' && !state.labelVisible && !state.panel, `${stage}: no numeric percent, old visible model prose or extra panel: ${JSON.stringify(state)}`);
  };
  // Before Play, this exact signed fixture can exercise Test in isolation: audio only,
  // no Worker/model/WASM request, then stop cleanly before the paced Play journey.
  await game.locator('aero-session-actions').getByRole('button', { name: 'Test', exact: true }).click();
  await frame.waitForFunction(() => {
    const g = document.querySelector('aero-game');
    return g?.graph?.gameplay?.getSnapshot?.().session?.purpose === 'visual_test' &&
      g.graph.gameplay.getSnapshot().session.state === 'playing' && g.graph.audio.getStatus().state === 'playing' &&
      g.activeSessionAction === 'test' && g.pendingSessionAction === '';
  }, null, { timeout: 40000 });
  const standalone = await inspect();
  assert(!standalone.bar && standalone.percent === '' && !standalone.panel && standalone.cv !== 'running',
    `standalone audio-only Test must not show model bar/percent or activate CV: ${JSON.stringify(standalone)}`);
  assert.equal(counts.get(modelPath) ?? 0, 0, 'standalone audio-only Test never requests pose model');
  assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 0, 'standalone audio-only Test never requests pose WASM');
  await game.evaluate(element => element.stop());
  await game.evaluate(element => element.setMenuOpen(true));
  await frame.waitForFunction(() => {
    const g = document.querySelector('aero-game');
    return g?.graph?.audio?.getStatus?.().state !== 'playing' && g?.pendingSessionAction === '';
  }, null, { timeout: 15000 });
  assert(!page.workers().some(worker => /mediapipe/u.test(worker.url())), 'standalone Test never instantiated a pose Worker');
  await game.locator('aero-session-actions').getByRole('button', { name: 'Start', exact: true }).click();
  await frame.waitForFunction(() => document.querySelector('aero-game')?.pendingSessionAction === 'start' && document.querySelector('aero-game')?.graph?.cv?.getStatus?.().lifecycleState === 'loading', null, { timeout: 15000 });
  await checkIndeterminate('camera/Worker before measured model');
  await frame.waitForFunction(() => document.querySelector('aero-game')?.graph?.video?.getRetainedCameraStream?.()?.getVideoTracks?.()[0]?.readyState === 'live', null, { timeout: 10000 });
  assert.equal(wasmHoldStartedAt, null, 'no WASM request before model download');
  assert.equal(wasmBodySentAt, null, 'no WASM body before model download');
  assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 0, 'zero WASM GETs before signed model bytes');
  const seen = [];
  let testQueued = false;
  for (let index = 0; index < holds.length; index++) {
    await withTimeout(reached[index], 20000, `signed model reaches ${index}`);
    await frame.waitForFunction(floor => {
      const a = document.querySelector('aero-game')?.shadowRoot?.querySelector('aero-session-actions')?.shadowRoot;
      const bar = a?.querySelector('progress[part="model-download-progress"]');
      return bar && bar.value >= floor;
    }, holds[index], { timeout: wasmHoldMs + 12000 }).catch(async error => { const state = await inspect(); throw new Error(`SLOW MODEL RED: native bar missing held signed decoded bytes at ${index + 1}/4 (state=${JSON.stringify(state)})`, { cause: error }); });
    const state = await inspect();
    assert(state.bar && state.visible && state.determinate && state.percentVisible, `SLOW MODEL RED: foreground native bar plus adjacent bare percent missing at ${index + 1}/4: ${JSON.stringify(state)}`);
    assert.equal(counts.get(modelPath), 1, `one signed model GET at held ${index + 1}/4`);
    assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 0, `zero WASM GETs at held ${index + 1}/4 model bytes`);
    assert.equal(wasmHoldStartedAt, null, 'WASM hold cannot start before verified full model');
    assert(possibleAssetTotals.has(state.max), 'denominator includes exact selected signed Lite model plus Tasks Vision runtime loader and WASM bytes');
    assert(state.value >= holds[index] && state.value < (holds[index + 1] ?? model.length), `bounded actual decoded phase ${index}: ${JSON.stringify(state)}`);
    assert.equal(state.percent, `${Math.floor(100 * state.value / state.max)}%`, 'adjacent bare percent reflects combined selected assets, not model-only bytes');
    assert.deepEqual(state.visibleCopy, [state.percent], 'no other visible status or old model prose beside numeric percent');
    assert.equal(state.text, '', 'obsolete Loading pose model sentence absent');
    assert(!state.panel && !state.labelVisible, 'no model panel or visible prose');
    assert.equal(state.aria, 'Tracker asset download', 'bar names combined tracker assets nonvisually');
    assert(state.camera === 'live' && state.cv === 'loading', `real camera and loading Worker at phase ${index}: ${JSON.stringify(state)}`);
    assert(seen.length === 0 || state.value > seen.at(-1), 'measured bytes monotone');
    seen.push(state.value);
    if (index === 2) {
      if (!state.testEnabled) {
        console.log(`OBSERVED: Test is not clickable during pending Play at model 75%; queued-Test visual state cannot be asserted: ${JSON.stringify(state)}`);
      } else {
        await game.locator('aero-session-actions').getByRole('button', { name: 'Test', exact: true }).click();
        await frame.waitForFunction(() => {
          const game = document.querySelector('aero-game');
          const actions = game?.shadowRoot?.querySelector('aero-session-actions');
          const queued = actions?.shadowRoot?.querySelector('[part="queued-status"]');
          return game?.pendingSessionAction === 'test' && /test/iu.test(queued?.textContent ?? '') && /queu/iu.test(queued?.textContent ?? '');
        }, null, { timeout: 5000 }).catch(async error => {
          const presentation = await game.evaluate(element => ({
            pendingMessage: element.publicFriendPendingMessage?.(),
            snapshot: element.sessionActionsSnapshot?.(),
            ordinals: { pending: element.pendingSessionActionOrdinal, latest: element.sessionActionIntentOrdinal },
            generations: { active: element.lifecycleIntentActiveGeneration, latest: element.lifecycleIntentGeneration },
            runtimeStatus: element.shadowRoot?.querySelector('[data-role="status"]')?.textContent?.trim() ?? ''
          }));
          const requests = { model: counts.get(modelPath) ?? 0, wasm: wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0) };
          throw new Error(`queued Test text absent beside honest model progress: visible=${JSON.stringify(await inspect())}; production=${JSON.stringify(presentation)}; requests=${JSON.stringify(requests)}`, { cause: error });
        });
        const queued = await inspect();
        assert.equal(queued.pending, 'test', 'last intent is Test during held Play model');
        testQueued = true;
        assert.equal(queued.testBusy, 'true', 'Test action remains pending while Play owns Worker load');
        assert(queued.queuedVisible && queued.queuedRole === 'status' && queued.queuedText === 'Test queued after Play initialization…', `foreground queued Test status visible and hit-testable: ${JSON.stringify(queued)}`);
        assert(!/%|error|fail|running/iu.test(queued.queuedText), 'queue text is not a global/Test-running percentage');
        assert(queued.bar && queued.visible && queued.determinate && queued.percentVisible && queued.value === holds[2] && possibleAssetTotals.has(queued.max),
          `active Play native tracker bar retains exact signed model bytes plus selected runtime total while Test queues: ${JSON.stringify(queued)}`);
        assert.equal(queued.percent, `${Math.floor(100 * queued.value / queued.max)}%`, 'adjacent bare numeric aggregate percent remains truthful');
        assert.deepEqual(queued.visibleCopy, [queued.queuedText, queued.percent], 'only original queue text and bare percent visible');
        assert(queued.text === '' && !queued.panel && !queued.labelVisible, 'no former model sentence or panel');
        assert.equal(queued.aria, 'Tracker asset download', 'accessible bar names all tracker downloads, not calibration');
        assert.equal(queued.cv, 'loading', 'Test has not bypassed Play Worker initialization');
        assert.equal(counts.get(modelPath), 1, 'queued Test cannot duplicate model GET');
        assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 0, 'queued Test cannot start WASM while signed model remains held at 75%');
        console.log(`PASS signed ${embedding} queued Test plus measured Play model: ${JSON.stringify({ queuedText: queued.queuedText, modelPercent: queued.percent, modelBytes: queued.value, modelGets: counts.get(modelPath) })}`);
      }
    }
    release[index]();
  }
  assert(testQueued, 'Test must remain clickable so queued visual state runs in the gate');
  // A browser must observe a real WASM request, then the signed response remains
  // held for the full 6s/35s while Play's queued Test cannot overtake CV startup.
  await withTimeout((async () => {
    while (wasmHoldStartedAt === null) await delay(25);
  })(), 20000, 'WASM GET after verified model');
  assert.equal(wasmBodySentAt, null, 'genuine delayed WASM body has not yet been sent');
  await frame.waitForFunction(({ total, lastHold }) => {
    const g = document.querySelector('aero-game');
    const root = g?.shadowRoot?.querySelector('aero-session-actions')?.shadowRoot;
    const bar = root?.querySelector('progress[part="model-download-progress"]');
    const percent = root?.querySelector('[part="model-download-percent"]')?.textContent?.trim();
    const measured = g?.graph?.cv?.getModelDownloadProgress?.();
    // The 100ms foreground repaint deliberately skips byte changes that round
    // to the same integer percent. Prove real underlying EOF, while asserting
    // the actual user-visible number remains truthful and below 100%.
    return g?.graph?.cv?.getStatus?.().lifecycleState === 'loading' && measured?.receivedBytes === total &&
      bar?.hasAttribute('value') && bar.value >= lastHold && bar.value <= total && bar.max > total &&
      percent === `${Math.floor(100 * bar.value / bar.max)}%` && percent === `${Math.floor(100 * total / bar.max)}%`;
  }, { total: model.length, lastHold: holds[2] }, { timeout: Math.min(5000, wasmHoldMs - 500) }).catch(async cause => {
    throw new Error(`held WASM model EOF must remain BELOW asset 100%: ${JSON.stringify({ visible: await inspect(), wasmHoldMs, wasBodySent: wasmBodySentAt !== null, modelFinished: modelResponseFinishedAt !== null, browserModelFinished: browserModelFinishedAt !== null })}`, { cause });
  });
  const heldWasm = await inspect();
  assert.equal(wasmBodySentAt, null, 'real signed WASM body is still held during below-100% capture');
  assert.equal(counts.get(modelPath), 1, 'one complete signed model GET before aggregate 100%');
  assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 1, 'one actual held WASM GET before aggregate 100%');
  assert(modelResponseFinishedAt !== null && wasmRequestStartedAt >= modelResponseFinishedAt && browserWasmStartedAt !== null,
    'signed model EOF precedes actual WASM fetch');
  const selectedWasmPath = wasmPaths.find(path => counts.get(path) === 1);
  const selectedPair = runtimePairs.get(selectedWasmPath);
  assert(selectedPair && counts.get(selectedPair.loaderPath) === 1, 'one actual selected signed runtime loader JS GET before held WASM');
  assert(heldWasm.bar && heldWasm.visible && heldWasm.determinate && heldWasm.percentVisible && heldWasm.value >= holds[2] && heldWasm.value <= model.length && heldWasm.max === selectedPair.total &&
    heldWasm.percent === `${Math.floor(100 * heldWasm.value / selectedPair.total)}%` && heldWasm.percent === `${Math.floor(100 * model.length / selectedPair.total)}%` && heldWasm.percent !== '100%' &&
    heldWasm.aria === 'Tracker asset download' && heldWasm.modelDownload?.receivedBytes === model.length && heldWasm.modelDownload?.totalBytes === selectedPair.total,
    `held WASM: native asset bar and bare percent remain below 100 after model EOF until selected JS/WASM load: ${JSON.stringify(heldWasm)}`);
  assert(heldWasm.text === '' && !heldWasm.panel && !heldWasm.labelVisible && heldWasm.visibleCopy.length === 2 &&
    heldWasm.visibleCopy[0] === heldWasm.queuedText && heldWasm.visibleCopy[1] === heldWasm.percent &&
    heldWasm.pending === 'test' && heldWasm.queuedVisible && heldWasm.queuedText === 'Test queued after Play initialization…',
    `held WASM: original queued Test and only bare asset percentage, without old model prose/panel: ${JSON.stringify(heldWasm)}`);
  assert(heldWasm.cv === 'loading' && heldWasm.active === '' && heldWasm.audio !== 'playing' && heldWasm.session !== 'playing',
    `tracker/runtime still loading without counting subsequent calibration: ${JSON.stringify(heldWasm)}`);
  console.log(`PASS signed ${embedding} verified model EOF while real ${selectedWasmPath} held: native asset bar=${heldWasm.percent}, decoded=${heldWasm.modelDownload.receivedBytes}/${selectedPair.total}, no early 100% or calibration counted`);
  await withTimeout(wasmSent, wasmHoldMs + 15000, 'delayed signed WASM body release after model verification');
  assert(modelBodySentAt !== null && modelResponseFinishedAt !== null, 'complete signed model response EOF preceded WASM');
  assert(wasmRequestStartedAt !== null && wasmRequestStartedAt >= modelResponseFinishedAt,
    'WASM GET starts after signed model EOF; task cannot initialize before full model verification');
  // Playwright's requestfinished can arrive after Worker EOF/next WASM request, or
  // not arrive for the previously observed ERR_ABORTED case. This short device-
  // handoff smoke asserts the signed server's actual model EOF and real Worker
  // readiness; the separate strict same-request CDP gate remains UNRUN, not green.
  console.log(`OBSERVED browser model requestfinished=${browserModelFinishedAt !== null}; server model EOF before WASM=${wasmRequestStartedAt >= modelResponseFinishedAt}`);
  assert(wasmHoldStartedAt !== null && wasmBodySentAt - wasmHoldStartedAt >= wasmHoldMs,
    `real WASM response hold must meet ${wasmHoldMs}ms, observed ${wasmBodySentAt - wasmHoldStartedAt}ms`);
  assert.equal(counts.get(modelPath), 1, 'one model GET after delayed WASM release');
  assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 1, 'one signed WASM GET only after full model EOF');
  if (testQueued) await frame.waitForFunction(() => {
    const game = document.querySelector('aero-game');
    const session = game?.graph?.gameplay?.getSnapshot?.().session;
    return session?.purpose === 'visual_test' && session.state === 'playing' && game.menuOpen === false &&
      game.pendingSessionAction === '' && game.graph.audio.getStatus().state === 'playing' &&
      game.graph.cv.getStatus().lifecycleState !== 'running';
  }, null, { timeout: 40000 });
  else await frame.waitForFunction(() => document.querySelector('aero-game')?.graph?.cv?.getStatus?.().lifecycleState === 'running' && document.querySelector('aero-game')?.graph?.cv?.getStatus?.().poseFrameCount > 0 && document.querySelector('aero-game')?.graph?.gameplay?.getSnapshot?.().session.state === 'calibrating', null, { timeout: 40000 });
  const worker = page.workers().filter(item => /mediapipe/u.test(item.url()));
  assert.equal(worker.length, 1, 'one genuine MediaPipe Worker');
  const state = await inspect();
  assert(!state.bar && state.percent === '' && !state.panel && !/%/u.test(state.text), `CV ready / ordered audio-only Test has no model bar or percent: ${JSON.stringify(state)}`);
  if (testQueued) {
    const final = await game.evaluate(element => ({ purpose: element.graph.gameplay.getSnapshot().session.purpose,
      session: element.graph.gameplay.getSnapshot().session.state, audio: element.graph.audio.getStatus().state,
      cv: element.graph.cv.getStatus(), active: element.activeSessionAction, pending: element.pendingSessionAction,
      camera: element.graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState ?? 'none' }));
    assert.equal(final.purpose, 'visual_test'); assert.equal(final.session, 'playing');
    assert.equal(final.audio, 'playing'); assert.equal(final.active, 'test'); assert.equal(final.pending, '');
    assert.notEqual(final.cv.lifecycleState, 'running', 'queued Test owns audio without active Play CV');
    assert.equal(final.cv.providerId, 'cpu-wasm', 'Play initialized genuine CPU Worker before ordered Test');
  }
  assert.equal(counts.get(modelPath), 1, 'one signed model GET');
  assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 1, 'one signed WASM GET');
  assert(modelBodySentAt !== null && modelResponseFinishedAt !== null && modelResponseFinishedAt <= wasmRequestStartedAt,
    'complete signed model response preceded one WASM request and ordered Test audio');
  assert.deepEqual(external, [], 'no off-origin request (including blocked dispatch)');
  assert.deepEqual(errors, [], 'no browser page errors');
  console.log(`OBSERVED model requestfinished=${browserModelFinishedAt !== null}; requestfailed=${JSON.stringify(modelRequestFailures)}`);
  console.log(`PASS signed ${embedding} 390x844 model progress; phases=${JSON.stringify(seen)}; full=${model.length}; WASM hold=${Math.round(wasmBodySentAt - wasmHoldStartedAt)}ms (required ${wasmHoldMs}ms); queued Test/audio-only; one model/WASM GET; real camera/Worker; ${directory}`);
} finally {
  for (const unblock of release) unblock();
  await context?.close(); await browser?.close();
  if (parent) await new Promise(done => parent.close(done));
  await new Promise(done => server.close(done));
}
