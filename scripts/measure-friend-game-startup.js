// @ts-check
// Signed CPU game timing evidence. TEST-ONLY synthetic input is NOT physical pose tracking.
// Real camera/MediaPipe Worker/game remain intact; only input service receives measured-form
// T-pose samples after a genuine Worker pose to exercise native hold/release/countdown.
// Run: AEROBEAT_FRIEND_GAME_QA_URL=http://127.0.0.1:4200/ node scripts/measure-friend-game-startup.js
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createSyntheticBeatSaverZip } from '../../aerobeat-web-vendor-beatsaver/scripts/fixture-helpers.js';
import { createRequire } from 'node:module';

const url = process.env.AEROBEAT_FRIEND_GAME_QA_URL;
assert(['http://127.0.0.1:4200/', 'http://127.0.0.1:4201/'].includes(url), 'exact signed loopback URL required');
const origin = new URL(url).origin;
// Opt-in fixed decoded-byte response-delay fixture. This is NOT network bandwidth shaping.
// The same constants apply to each of the two exact signed Worker assets on every run.
// Usage: AEROBEAT_STARTUP_SHAPE=1 AEROBEAT_FRIEND_GAME_QA_URL=http://127.0.0.1:4200/ node scripts/measure-friend-game-startup.js
const shaping = process.env.AEROBEAT_STARTUP_SHAPE === undefined ? null : (() => {
  assert.equal(process.env.AEROBEAT_STARTUP_SHAPE, '1', 'AEROBEAT_STARTUP_SHAPE must be 1 or unset');
  return Object.freeze({ chunkBytes: 256 * 1024, intervalMs: 150 });
})();
const manifestPath = fileURLToPath(new URL('../dist-friend-game/friend-game-bundle-manifest.json', import.meta.url));
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
assert.equal(manifest.purpose, 'normal_cpu_friend_game');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const signedIndex = manifest.assets.find(asset => asset.path === 'index.html');
assert(signedIndex, 'signed index identity required');
const servedIndex = Buffer.from(await (await fetch(url, { cache: 'no-store' })).arrayBuffer());
assert.equal(digest(servedIndex), signedIndex.sha256, 'served HTML must match frozen signed index');
const signedWasm = manifest.assets.filter(asset => asset.path === 'assets/mediapipe/wasm/vision_wasm_internal.wasm');
const signedModel = manifest.assets.filter(asset => asset.path === 'assets/mediapipe/pose_landmarker_lite.task');
assert.equal(signedWasm.length, 1, 'exactly one signed CPU WASM asset');
assert.equal(signedModel.length, 1, 'exactly one signed model asset');
const shapedAssets = new Map([...signedWasm, ...signedModel].map(asset => [`/${asset.path}`, asset]));
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
  for (const mode of ['first-new-page-context', 'second-new-page-same-context']) {
    // First is a new page in a new context; second is another new page/game instance
    // in that same context, NOT a second Play on the same connected game.
    // The signed server's no-store policy can still force full transfers on both visits.
    const requests = new Map(), denied = [], errors = [], workerMessages = [];
    const zero = now();
    let tapOffsetMs = null;
    const paced = [];
    const pacingFailures = [];
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
    // The route applies to real Worker requests too. The intercepted GET is fetched
    // exactly once and SHA-checked before its decoded bytes are paced into Chromium.
    await page.route('**/*', async route => {
      const request = route.request(), target = new URL(request.url());
      if (target.origin !== origin) { denied.push(request.url()); return route.abort(); }
      const signed = shaping && shapedAssets.get(target.pathname);
      if (!signed) return route.continue();
      try {
        assert.equal(request.method(), 'GET', 'only a signed GET can be paced');
        const response = await route.fetch({ maxRedirects: 0 });
        assert.equal(response.status(), 200, `signed paced response ${target.pathname}`);
        const bytes = Buffer.from(await response.body());
        assert.equal(bytes.length, signed.bytes, `decoded signed length ${target.pathname}`);
        assert.equal(digest(bytes), signed.sha256, `decoded signed SHA-256 ${target.pathname}`);
        // Playwright fulfill sends a complete body, not chunks. Bounded deterministic
        // whole-response delay preserves exact bytes, but is NOT a bandwidth fixture.
        const chunks = Math.ceil(bytes.length / shaping.chunkBytes);
        const delayMs = chunks * shaping.intervalMs;
        await delay(delayMs);
        paced.push({ path: target.pathname, bytes: bytes.length, chunks, delayMs, sha256: signed.sha256 });
        await route.fulfill({ response, body: bytes });
      } catch (error) { pacingFailures.push(String(error)); await route.abort(); }
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
      // Capture the trusted browser click *inside* the already-running page clock.
      // No production instrumentation or programmatic click: Playwright performs
      // the actual user gesture, the capture listener only marks its timestamp.
      await page.evaluate(() => {
        window.__aeroStartupClickMs = null;
        document.addEventListener('click', event => {
          if (event.composedPath().some(node => node?.tagName === 'AERO-SESSION-ACTIONS')) window.__aeroStartupClickMs = performance.now();
        }, { capture: true, once: true });
      });
      await game.locator('aero-session-actions').getByRole('button', { name: 'Start', exact: true }).click();
      const browserTapTime = await page.evaluate(() => window.__aeroStartupClickMs);
      assert(Number.isFinite(browserTapTime), 'trusted Play click captured in browser clock');
      mark('playTapObservedNode'); tapOffsetMs = Math.round(marks.playTapObservedNode - zero);
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
          if (state.calibration?.state === 'holding') mark('syntheticTPoseHolding');
          if (state.calibration?.calibrationId) mark('syntheticCalibrationAccepted');
          if (state.session?.purpose === 'play' && state.session?.state === 'countdown') mark('countdown');
          if (state.session?.purpose === 'play' && state.session?.state === 'playing') mark('playSession');
          if (state.session?.purpose === 'play' && state.session?.state === 'playing' && state.audio?.state === 'playing') mark('playAudio');
        } catch (error) { errors.push(String(error)); }
      }, 25);
      await page.waitForFunction(() => { const game = document.querySelector('aero-game'); return game?.graph?.cv?.getStatus?.().lifecycleState === 'running' && game.graph.cv.getStatus().poseFrameCount > 0 && game.graph.gameplay.getSnapshot().session.state === 'calibrating'; }, null, { timeout: 90000 });
      // Adapt the private phone-Play QA native-input stimulus, only after real CV
      // produced a frame. Never replace the camera, Worker, scorer or game clock.
      const synthetic = await game.evaluate(async element => {
        const graph = element.graph, wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const deadline = performance.now() + 14000;
        while (performance.now() < deadline && !graph.cv.getLatestPoseFrame()) await wait(35);
        const initial = graph.cv.getStatus(), frame = graph.cv.getLatestPoseFrame();
        if (!initial.running || !frame?.sourceId || !element.lastCameraIdentity || element.menuOpen) throw Error(`INVALID SETUP: native synthetic stimulus requires live CV frame, camera identity, closed menu: ${JSON.stringify({ running: initial.running, frame: Boolean(frame), poseCount: initial.poseFrameCount, camera: Boolean(element.lastCameraIdentity), menu: element.menuOpen })}`);
        const sourceId = frame.sourceId, cameraIdentity = element.lastCameraIdentity;
        const surface = graph.video.describeSurface(element.videoElement());
        if (!(surface.sourceAspectRatio > 0)) throw Error('INVALID SETUP: camera aspect unavailable');
        let clock = Math.max(performance.now(), Number(graph.input.getSnapshot().tracking.timestampMs ?? 0) + 1), samples = 0;
        const events = {}, stamp = name => { if (!(name in events)) events[name] = performance.now(); };
        const feed = tPose => {
          if (element.graph !== graph || graph.cv.getStatus().running !== true || element.lastCameraIdentity !== cameraIdentity || graph.cv.getLatestPoseFrame()?.sourceId !== sourceId) throw Error('INVALID SETUP: CV source/camera identity changed during native calibration');
          clock = Math.max(performance.now(), clock + 1000 / 15, Number(graph.input.getSnapshot().tracking.timestampMs ?? 0) + 1);
          const y = tPose ? .4 : .58;
          const points = { nose: { x: .5, y: .2 }, left_shoulder: { x: .35, y: .4 }, right_shoulder: { x: .65, y: .4 }, left_elbow: { x: .2, y }, right_elbow: { x: .8, y }, left_wrist: { x: .05, y }, right_wrist: { x: .95, y }, left_hip: { x: .43, y: .68 }, right_hip: { x: .57, y: .68 } };
          graph.input.processPoseSample({ sourceId, timestampMs: clock, mirrored: frame.mirrored, landmarks: Object.entries(points).map(([name, position]) => ({ name, ...position, confidence: .99 })) }, { sourceAspectRatio: surface.sourceAspectRatio, sourceChangeId: cameraIdentity });
          samples++;
          const input = graph.input.getSnapshot(), session = graph.gameplay.getSnapshot().session;
          if (input.tracking.timestampMs !== clock) throw Error(`INVALID SETUP: synthetic sample not accepted by native input (${samples})`);
          if (input.calibration.state === 'holding') stamp('tPoseHolding');
          if (input.calibration.calibrationId) stamp('calibrationAccepted');
          if (session.state === 'countdown') stamp('countdown');
          if (session.state === 'playing') stamp('playSession');
        };
        stamp('syntheticStimulusStart');
        while (performance.now() < deadline && !graph.input.getSnapshot().calibration.calibrationId) { feed(true); await wait(30); }
        if (!graph.input.getSnapshot().calibration.calibrationId) throw Error(`INVALID SETUP: alternating Worker frames blocked native T-pose hold: ${JSON.stringify({ samples, poses: graph.cv.getStatus().poseFrameCount, state: graph.input.getSnapshot().calibration.state, session: graph.gameplay.getSnapshot().session.state })}`);
        while (performance.now() < deadline && (graph.gameplay.getSnapshot().session.state !== 'playing' || graph.audio.getStatus().state !== 'playing')) { feed(false); await wait(35); }
        const input = graph.input.getSnapshot(), session = graph.gameplay.getSnapshot().session, cv = graph.cv.getStatus(), audio = graph.audio.getStatus();
        if (!(input.calibration.state === 'calibrated' && session.purpose === 'play' && session.state === 'playing' && audio.state === 'playing' && cv.running && cv.poseFrameCount > initial.poseFrameCount)) throw Error(`INVALID SETUP: native release/countdown/audio did not reach Play: ${JSON.stringify({ samples, poseBefore: initial.poseFrameCount, poseAfter: cv.poseFrameCount, calibration: input.calibration.state, session: session.state, audio: audio.state, error: element.lastError?.message ?? null })}`);
        stamp('playAudio');
        return { events, samples, workerPosesBefore: initial.poseFrameCount, workerPosesAfter: cv.poseFrameCount };
      }).catch(cause => { throw new Error(`Synthetic input did not reach signed Play audio: ${cause.message}`, { cause }); });
      const state = await game.evaluate(element => ({
        provider: element.graph.cv.getStatus().providerId, poses: element.graph.cv.getStatus().poseFrameCount,
        session: element.graph.gameplay.getSnapshot().session.state,
        calibration: element.graph.input.getSnapshot().calibration.state, audio: element.graph.audio.getStatus().state
      }));
      const assets = Object.fromEntries([...requests].filter(([path]) => /mediapipe|\.task$|\.wasm$/iu.test(path)).map(([path, item]) => [path, { ...item, startsFromNodeClickObservationMs: item.startsMs.map(ms => ms - tapOffsetMs), finishesFromNodeClickObservationMs: item.finishesMs.map(ms => ms - tapOffsetMs) }]));
      assert.equal(state.provider, 'cpu-wasm'); assert(state.poses > 0);
      for (const [path, item] of Object.entries(assets)) assert.equal(item.count, 1, `${path}: exactly one request`);
      assert.equal(workerMessages.length, 1, 'one real CPU MediaPipe Worker created');
      assert.equal(denied.length, 0, 'no off-origin request, including uploads');
      assert.deepEqual(pacingFailures, [], 'signed shaping fixture must not abort');
      if (shaping) assert.deepEqual(paced.map(item => item.path).sort(), [...shapedAssets.keys()].sort(), 'each exact signed asset was paced exactly once');
      assert.equal(errors.length, 0, 'no page errors');
      assert([...requests.values()].every(item => item.failures.length === 0), 'local request failures');
      assert.equal(state.session, 'playing', 'signed Play session reached song');
      assert.equal(state.audio, 'playing', 'signed Play audio reached playback');
      const browserMarksMs = Object.fromEntries(Object.entries(synthetic.events).map(([key, value]) => [key, Math.round(value - browserTapTime)]));
      browserMarksMs.trustedPlayClick = 0;
      const nodeMarksMs = Object.fromEntries(Object.entries(marks).map(([key, value]) => [key, Math.round(value - marks.playTapObservedNode)]));
      assert(Number.isFinite(browserMarksMs.playAudio), 'browser-clock click-to-audio mark required');
      assert(Number.isFinite(nodeMarksMs.cvRunning), 'Node-observed Worker-ready mark required');
      results.push({ mode, shaping: shaping ? { ...shaping, kind: 'whole-response-delay-not-bandwidth', paced } : null,
        browserClockFromTrustedClickMs: browserMarksMs,
        nodeClockFromClickObservationMs: nodeMarksMs,
        workerEvents: workerMessages.map(item => ({ ...item, fromNodeClickObservationMs: item.ms - tapOffsetMs })),
        workerAssets: assets, syntheticSamples: synthetic.samples, workerPosesDuringStimulus: synthetic.workerPosesAfter - synthetic.workerPosesBefore,
        requestsByOrigin: { [origin]: Object.fromEntries(requests) }, totalRequests: [...requests.values()].reduce((count, item) => count + item.count, 0), endState: state,
        caveat: 'TEST-ONLY synthetic native input is NOT physical pose tracking. Worker/camera/game are real. Play→CV running uses a Node observation after the click (25ms polling), not cross-clock subtraction. Play→audio uses the browser click clock and artificial T-pose/countdown. Whole-response decoded-byte delay is NOT bandwidth or public relay emulation. First and second runs are distinct new page/game instances in one browser context; no-store may refetch.' });
    } finally {
      clearInterval(timer); await page.close();
      context.off('request', started); context.off('requestfinished', finished); context.off('requestfailed', failed);
    }
  }
  console.log(JSON.stringify({ signed: { manifestSha256: digest(manifestBytes), buildStamp: manifest.buildStamp, sourceCommit: manifest.sourceManifest.sources['@aerobeat/web-assembly'].commit, origin }, results }, null, 2));
} finally { await context.close(); await browser.close(); }
