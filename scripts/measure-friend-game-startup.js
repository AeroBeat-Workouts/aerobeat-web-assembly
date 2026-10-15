// @ts-check
// Read-only signed CPU game timing evidence. Fake camera is NOT physical pose calibration.
// Run: AEROBEAT_FRIEND_GAME_QA_URL=http://127.0.0.1:4200/ node scripts/measure-friend-game-startup.js
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createSyntheticBeatSaverZip } from '../../aerobeat-web-vendor-beatsaver/scripts/fixture-helpers.js';
import { createRequire } from 'node:module';

const url = process.env.AEROBEAT_FRIEND_GAME_QA_URL;
assert(['http://127.0.0.1:4200/', 'http://127.0.0.1:4201/'].includes(url), 'exact signed loopback URL required');
const origin = new URL(url).origin;
const manifestPath = fileURLToPath(new URL('../dist-friend-game/friend-game-bundle-manifest.json', import.meta.url));
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
assert.equal(manifest.purpose, 'normal_cpu_friend_game');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const signedIndex = manifest.assets.find(asset => asset.path === 'index.html');
assert(signedIndex, 'signed index identity required');
const servedIndex = Buffer.from(await (await fetch(url, { cache: 'no-store' })).arrayBuffer());
assert.equal(digest(servedIndex), signedIndex.sha256, 'served HTML must match frozen signed index');
const { unzipSync, zipSync } = createRequire(new URL('../../aerobeat-web-vendor-beatsaver/package.json', import.meta.url))('fflate');
const entries = unzipSync(createSyntheticBeatSaverZip(2));
const info = JSON.parse(new TextDecoder().decode(entries['Info.dat']));
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
assert(archive.length < 1_000_000, 'bounded local playable fixture');
const now = () => performance.now();
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block' });
const results = [];
try {
  for (const mode of ['cold-fresh-context', 'repeat-same-context']) {
    // Repeat uses the same context and browser profile, but a new page and new game instance.
    // The signed server's no-store policy can still force full transfers on both visits.
    const requests = new Map(), denied = [], errors = [], workerMessages = [];
    const zero = now();
    let tapOffsetMs = null;
    const record = (request, field) => {
      const path = `${request.method()} ${new URL(request.url()).pathname}`;
      const entry = requests.get(path) ?? { count: 0, startsMs: [], finishesMs: [], failures: [] };
      if (field === 'start') { entry.count++; entry.startsMs.push(Math.round(now() - zero)); }
      else if (field === 'finish') entry.finishesMs.push(Math.round(now() - zero));
      else entry.failures.push(request.failure()?.errorText ?? 'unknown');
      requests.set(path, entry);
    };
    const started = request => {
      if (!/^https?:/u.test(request.url())) return;
      if (new URL(request.url()).origin !== origin) { denied.push(request.url()); return; }
      record(request, 'start');
    };
    const finished = request => { if (/^https?:/u.test(request.url()) && new URL(request.url()).origin === origin) record(request, 'finish'); };
    const failed = request => { if (/^https?:/u.test(request.url()) && new URL(request.url()).origin === origin) record(request, 'failure'); };
    context.on('request', started); context.on('requestfinished', finished); context.on('requestfailed', failed);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('worker', worker => {
      if (new URL(worker.url()).origin === origin && /mediapipe-worker/iu.test(worker.url())) workerMessages.push({ event: 'workerCreated', ms: Math.round(now() - zero) });
    });
    // Fail closed before network: no BeatSaver, analytics, remote models, or uploads.
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      denied.push(route.request().url()); return route.abort();
    });
    const marks = {}; const mark = key => { if (!(key in marks)) marks[key] = now(); };
    let timer;
    try {
      assert.equal((await page.goto(url, { waitUntil: 'domcontentloaded' }))?.status(), 200);
      const game = page.locator('aero-game'); await game.waitFor();
      await page.waitForFunction(() => document.querySelector('aero-game')?.graph?.authoring?.getCapabilities?.().conversionWorker === true && document.querySelector('aero-game')?.graph?.renderer?.describe?.().gameplayAssets?.state === 'ready', null, { timeout: 45000 });
      const music = game.locator('aero-beatsaver-browser');
      const chooserPromise = page.waitForEvent('filechooser');
      await music.getByRole('button', { name: 'Choose local ZIP' }).click();
      await (await chooserPromise).setFiles({ name: 'startup-timing-fixture.zip', mimeType: 'application/zip', buffer: archive });
      await page.waitForFunction(() => { const game = document.querySelector('aero-game'); return game?.libraryView?.selectedPackageId && game.graph?.content?.getSnapshot?.().state === 'ready' && game.graph.audio.getStatus().state === 'ready'; }, null, { timeout: 60000 });
      mark('playTap'); tapOffsetMs = Math.round(marks.playTap - zero);
      await game.locator('aero-session-actions').getByRole('button', { name: 'Start', exact: true }).click();
      timer = setInterval(async () => {
        try {
          const state = await game.evaluate(element => ({
            camera: element.graph?.video?.getRetainedCameraStream?.()?.getVideoTracks?.()[0]?.readyState,
            cv: element.graph?.cv?.getStatus?.(), session: element.graph?.gameplay?.getSnapshot?.().session,
            calibration: element.graph?.input?.getSnapshot?.().calibration, audio: element.graph?.audio?.getStatus?.()
          }));
          if (state.camera === 'live') mark('cameraLive');
          if (state.cv?.lifecycleState === 'running' && state.cv?.providerId === 'cpu-wasm') mark('cvRunning');
          if (state.cv?.poseFrameCount > 0) mark('firstWorkerPose');
          if (state.session?.purpose === 'play' && state.session?.state === 'calibrating') mark('tPoseCalibrating');
          if (state.session?.purpose === 'play' && state.session?.state === 'playing' && state.audio?.state === 'playing') mark('playAudio');
        } catch (error) { errors.push(String(error)); }
      }, 25);
      await page.waitForFunction(() => { const game = document.querySelector('aero-game'); return game?.graph?.cv?.getStatus?.().lifecycleState === 'running' && game.graph.cv.getStatus().poseFrameCount > 0 && game.graph.gameplay.getSnapshot().session.state === 'calibrating'; }, null, { timeout: 90000 });
      await new Promise(resolve => setTimeout(resolve, 250));
      const state = await game.evaluate(element => ({
        provider: element.graph.cv.getStatus().providerId, poses: element.graph.cv.getStatus().poseFrameCount,
        session: element.graph.gameplay.getSnapshot().session.state,
        calibration: element.graph.input.getSnapshot().calibration.state, audio: element.graph.audio.getStatus().state
      }));
      const assets = Object.fromEntries([...requests].filter(([path]) => /mediapipe|\.task$|\.wasm$/iu.test(path)).map(([path, item]) => [path, { ...item, startsFromTapMs: item.startsMs.map(ms => ms - tapOffsetMs), finishesFromTapMs: item.finishesMs.map(ms => ms - tapOffsetMs) }]));
      assert.equal(state.provider, 'cpu-wasm'); assert(state.poses > 0);
      for (const [path, item] of Object.entries(assets)) assert.equal(item.count, 1, `${path}: exactly one request`);
      assert.equal(workerMessages.length, 1, 'one real CPU MediaPipe Worker created');
      assert.equal(denied.length, 0, 'no off-origin request, including uploads');
      assert.equal(errors.length, 0, 'no page errors');
      assert([...requests.values()].every(item => item.failures.length === 0), 'local request failures');
      results.push({ mode, workerEvents: workerMessages.map(item => ({ ...item, fromTapMs: item.ms - tapOffsetMs })), marksMs: Object.fromEntries(Object.entries(marks).map(([key, value]) => [key, Math.round(value - marks.playTap)])), workerAssets: assets, requestsByOrigin: { [origin]: Object.fromEntries(requests) }, totalRequests: [...requests.values()].reduce((count, item) => count + item.count, 0), endState: state, caveat: 'Fresh page in fresh/same context; no-store may refetch. Fake camera cannot provide measured human T-pose; Play-to-song remains unobserved unless playAudio exists.' });
    } finally {
      clearInterval(timer); await page.close();
      context.off('request', started); context.off('requestfinished', finished); context.off('requestfailed', failed);
    }
  }
  console.log(JSON.stringify({ signed: { manifestSha256: digest(manifestBytes), buildStamp: manifest.buildStamp, sourceCommit: manifest.sourceManifest.sources['@aerobeat/web-assembly'].commit, origin }, results }, null, 2));
} finally { await context.close(); await browser.close(); }
