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
assert(wasmPaths.length >= 1);
const signedHandler = handlerForSnapshot(snapshot);
const holds = [0.25, 0.5, 0.75].map(fraction => Math.floor(model.length * fraction));
const release = []; const reach = [];
const gates = holds.map((_, index) => new Promise(done => { release[index] = done; }));
const reached = holds.map((_, index) => new Promise(done => { reach[index] = done; }));
const counts = new Map();
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (request.method === 'GET') counts.set(path, (counts.get(path) ?? 0) + 1);
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
  if (path !== modelPath) { await delay(1600); response.end(bytes); return; }
  let offset = 0;
  for (let index = 0; index < holds.length; index++) {
    const end = holds[index];
    while (offset < end) { const next = Math.min(end, offset + 65536); response.write(bytes.subarray(offset, next)); offset = next; await delay(15); }
    reach[index]();
    await gates[index];
  }
  while (offset < bytes.length) { const next = Math.min(bytes.length, offset + 65536); response.write(bytes.subarray(offset, next)); offset = next; await delay(15); }
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
  const external = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const approvedOrigins = new Set([origin, ...(parentUrl ? [new URL(parentUrl).origin] : [])]);
  page.on('request', request => { if (/^https?:/u.test(request.url()) && !approvedOrigins.has(new URL(request.url()).origin)) external.push(request.url()); });
  await page.route('**/*', route => approvedOrigins.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  assert.equal((await page.goto(parentUrl ?? `${origin}/`, { waitUntil: 'domcontentloaded' }))?.status(), 200);
  if (parent) await page.frameLocator('#game').locator('aero-game').waitFor();
  const frame = parent ? page.frames().find(candidate => candidate !== page.mainFrame() && candidate.url() === `${origin}/`) : page.mainFrame();
  assert(frame && frame.url() === `${origin}/`, 'actual signed game child frame');
  if (parent) assert.notEqual(new URL(page.url()).origin, new URL(frame.url()).origin, 'genuine cross-origin iframe');
  const game = frame.locator('aero-game'); await game.waitFor();
  await frame.waitForFunction(() => document.querySelector('aero-game')?.graph?.authoring?.getCapabilities?.().conversionWorker === true && document.querySelector('aero-game')?.graph?.renderer?.describe?.().gameplayAssets?.state === 'ready', null, { timeout: 45000 });
  const music = game.locator('aero-beatsaver-browser');
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
    const queuedLabel = root?.querySelector('[part="queued-status"]');
    const button = root?.querySelector('button[part="start-button"]');
    const testButton = root?.querySelector('button[part="test-button"]');
    const box = bar?.getBoundingClientRect(), buttonBox = button?.getBoundingClientRect();
    const x = box ? box.x + box.width / 2 : 0, y = box ? box.y + box.height / 2 : 0;
    const hit = box ? root.elementFromPoint(x, y) : null;
    const foreground = box ? element.shadowRoot.elementFromPoint(x, y) : null;
    const queueBox = queuedLabel?.getBoundingClientRect();
    const queueX = queueBox ? queueBox.x + queueBox.width / 2 : 0, queueY = queueBox ? queueBox.y + queueBox.height / 2 : 0;
    const queueHit = queueBox ? root.elementFromPoint(queueX, queueY) : null;
    const queueForeground = queueBox ? element.shadowRoot.elementFromPoint(queueX, queueY) : null;
    return { bar: Boolean(bar), value: bar?.value ?? null, max: bar?.max ?? null, text: label?.textContent?.trim() ?? '', aria: bar?.getAttribute('aria-label') ?? '', pending: element.pendingSessionAction,
      queuedText: queuedLabel?.textContent?.trim() ?? '', queuedRole: queuedLabel?.getAttribute('role') ?? '',
      queuedVisible: Boolean(queuedLabel && queueBox.width >= 80 && queueBox.height >= 16 && queueBox.left >= 0 && queueBox.top >= 0 && queueBox.right <= viewport.width && queueBox.bottom <= viewport.height && buttonBox.width >= 40 && Math.abs(queueBox.top - buttonBox.top) <= 200 && getComputedStyle(queuedLabel).visibility === 'visible' && getComputedStyle(queuedLabel).display !== 'none' && Number(getComputedStyle(queuedLabel).opacity) > 0 && !queuedLabel.closest('[hidden], [aria-hidden="true"]') && (queueHit === queuedLabel || queuedLabel.contains(queueHit)) && (queueForeground === actions || queueForeground === drawer)),
      testEnabled: Boolean(testButton && !testButton.disabled), testBusy: testButton?.getAttribute('aria-busy') ?? '',
      cv: element.graph.cv.getStatus().lifecycleState, camera: element.graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState ?? 'none',
      visible: Boolean(bar && drawer && !drawer.hidden && drawer.getAttribute('aria-hidden') !== 'true' && box.width >= 80 && box.height >= 4 && box.x >= 0 && box.y >= 0 && box.right <= viewport.width && box.bottom <= viewport.height && buttonBox.width >= 40 && Math.abs(box.top - buttonBox.top) <= 200 && getComputedStyle(bar).visibility === 'visible' && getComputedStyle(bar).display !== 'none' && (hit === bar || bar.contains(hit)) && (foreground === actions || foreground === drawer)),
      labelVisible: Boolean(label && label.getBoundingClientRect().width >= 80 && getComputedStyle(label).visibility === 'visible') };
  });
  const checkIndeterminate = async stage => {
    const state = await inspect();
    assert(!state.bar && !/%/u.test(state.text), `${stage}: no model or global percentage: ${JSON.stringify(state)}`);
    assert(state.labelVisible && /prepar|load|camera|queu/iu.test(state.text), `${stage}: visible indeterminate preparation: ${JSON.stringify(state)}`);
  };
  await game.locator('aero-session-actions').getByRole('button', { name: 'Start', exact: true }).click();
  await frame.waitForFunction(() => document.querySelector('aero-game')?.pendingSessionAction === 'start' && document.querySelector('aero-game')?.graph?.cv?.getStatus?.().lifecycleState === 'loading', null, { timeout: 15000 });
  await checkIndeterminate('camera/Worker before measured model');
  const seen = [];
  let testQueued = false;
  for (let index = 0; index < holds.length; index++) {
    await withTimeout(reached[index], 20000, `signed model reaches ${index}`);
    await frame.waitForFunction(floor => {
      const a = document.querySelector('aero-game')?.shadowRoot?.querySelector('aero-session-actions')?.shadowRoot;
      const bar = a?.querySelector('progress[part="model-download-progress"]');
      return bar && bar.value >= floor;
    }, holds[index], { timeout: 12000 }).catch(async error => { const state = await inspect(); throw new Error(`SLOW MODEL RED: foreground percentage absent at held signed ${index + 1}/4 (label=${JSON.stringify(state.text)}, bar=${state.bar}, camera=${state.camera}, CV=${state.cv})`, { cause: error }); });
    const state = await inspect();
    assert(state.bar && state.visible && state.labelVisible, `SLOW MODEL RED: foreground accessible progress missing at ${index + 1}/4: ${JSON.stringify(state)}`);
    assert.equal(state.max, model.length, 'decoded signed denominator');
    assert(state.value >= holds[index] && state.value < (holds[index + 1] ?? model.length), `bounded actual decoded phase ${index}: ${JSON.stringify(state)}`);
    assert.match(state.text, /^Loading pose model: (?:[0-9]|[1-9][0-9])%$/u);
    assert.equal(Number(state.text.match(/(\d+)%$/u)[1]), Math.floor(100 * state.value / model.length), 'label matches exact decoded count');
    assert.equal(state.aria, state.text, 'accessible bar names actual measured phase');
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
        assert(queued.bar && queued.visible && queued.labelVisible && queued.value === holds[2] && queued.max === model.length,
          `active Play model bar retains exact signed decoded bytes while Test queues: ${JSON.stringify(queued)}`);
        assert.equal(queued.text, `Loading pose model: ${Math.floor(100 * queued.value / model.length)}%`, 'model-only numeric label remains truthful');
        assert.equal(queued.aria, queued.text, 'accessible bar remains model-only');
        assert.equal(queued.cv, 'loading', 'Test has not bypassed Play Worker initialization');
        assert.equal(counts.get(modelPath), 1, 'queued Test cannot duplicate model GET');
        assert.equal(wasmPaths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0), 1, 'queued Test cannot duplicate WASM GET');
        console.log(`PASS signed direct queued Test plus measured Play model: ${JSON.stringify({ queuedText: queued.queuedText, modelText: queued.text, modelBytes: queued.value, modelGets: counts.get(modelPath) })}`);
      }
    }
    release[index]();
  }
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
  assert(!state.bar && !/%/u.test(state.text), `post-download state has no invented percent: ${JSON.stringify(state)}`);
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
  assert.deepEqual(external, [], 'no off-origin request (including blocked dispatch)');
  assert.deepEqual(errors, [], 'no browser page errors');
  console.log(`PASS signed ${embedding} 390x844 model progress; phases=${JSON.stringify(seen)}; Test queued=${testQueued}; one model/WASM GET; real camera/Worker${testQueued ? '' : '/pose'}; ${directory}`);
} finally {
  for (const unblock of release) unblock();
  await context?.close(); await browser?.close();
  if (parent) await new Promise(done => parent.close(done));
  await new Promise(done => server.close(done));
}
