// @ts-check
// Connected QA: pinned real 5e ZIP, completed Play/Test or paused Play → selected Reimport.
// Runs configured Vite or an isolated immutable signed snapshot; never touches public services.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';

const fixture = { id: '5e', hash: '44cb89635aee2ec8b9d01adb80e148300b6324d0', file: '/tmp/aerobeat-diagnostic-5e-44cb8963.zip', sha256: 'c00ad62b155b7919f96fc3c8545e5451b9122ccf1f81daeee5ded1691b0c5037' };
fixture.bytes = await readFile(fixture.file);
assert.equal(createHash('sha256').update(fixture.bytes).digest('hex'), fixture.sha256);
// A source provenance rejection is a hard blocker: never use configFile:false.
const signedDirectory = process.env.AEROBEAT_TERMINAL_SIGNED_DIR;
const pausedMode = process.env.AEROBEAT_PAUSED_REIMPORT_TEST === '1';
const vite = signedDirectory ? null : await createViteServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser, parent, gameServer;
try {
  let base;
  if (vite) { await vite.listen(); base = vite.resolvedUrls?.local?.[0]; }
  else {
    const snapshot = loadSignedSnapshot(path.resolve(signedDirectory));
    assert.ok(['0.0.141', '0.0.142', '0.0.143'].includes(snapshot.manifest.sourceManifest.packageVersion), 'terminal Reimport QA requires a signed corrective or knee successor');
    gameServer = createServer(handlerForSnapshot(snapshot));
    await new Promise(resolve => gameServer.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${gameServer.address().port}/`;
  }
  assert.ok(base);
  parent = createServer((_request, response) => { response.setHeader('content-type', 'text/html; charset=utf-8'); response.end(`<!doctype html><iframe allow="camera; autoplay" style="width:390px;height:844px" src="${base}"></iframe>`); });
  await new Promise(resolve => parent.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  for (const purpose of pausedMode ? ['play'] : ['play', 'visual_test']) for (const embedding of ['direct', 'iframe']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/__pinned_song.zip', route => route.fulfill({ status: 200, contentType: 'application/zip', body: fixture.bytes }));
      await page.goto(embedding === 'direct' ? base : `http://localhost:${parent.address().port}/`, { waitUntil: 'networkidle' });
      const frame = embedding === 'direct' ? page : page.frames().find(item => item !== page.mainFrame()); assert.ok(frame);
      const game = frame.locator('aero-game'); await game.waitFor();
      const result = await game.evaluate(async (element, { id, hash, purpose, pausedMode }) => {
        const graph = element.graph, events = [], t0 = performance.now(), wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const snap = label => {
          const content = graph.content.getSnapshot(), session = graph.gameplay.getSnapshot().session, audio = graph.audio.getStatus(), clock = graph.audio.getClockSnapshot();
          const media = [...element.shadowRoot.querySelectorAll('audio,video')].map(node => ({ role: node.dataset.role ?? null, paused: node.paused, currentTime: node.currentTime, readyState: node.readyState }));
          const row = { ms: Math.round(performance.now() - t0), label, session: { state: session.state, purpose: session.purpose, timelineMs: session.timelinePositionMs, packageId: session.packageId }, flags: { startRequested: element.sessionStartRequested, action: element.activeSessionAction, armedOrdinal: element.visualTestTransportArmedOrdinal }, audio: { state: audio.state, positionSeconds: audio.positionSeconds, contextState: audio.contextState, leaseState: audio.leaseState }, clock: { playing: clock.playing, positionSeconds: clock.positionSeconds }, lease: element.leaseSnapshotForGameplay().resources, media, preview: element.previewView.state, menuOpen: element.menuOpen, content: { packageId: content.packageId, hash: content.packageHash?.value ?? null }, error: element.lastError?.message ?? null };
          events.push(row); return row;
        };
        const originalStart = AudioBufferSourceNode.prototype.start, originalPlay = HTMLMediaElement.prototype.play;
        AudioBufferSourceNode.prototype.start = function (...args) { snap('source.start'); return originalStart.apply(this, args); };
        HTMLMediaElement.prototype.play = function (...args) { snap('media.play'); return originalPlay.apply(this, args); };
        try {
          const bytes = new Uint8Array(await (await fetch('/__pinned_song.zip')).arrayBuffer());
          const acquired = await graph.vendor.importLocalArchive(bytes);
          if (acquired.sourceHash !== hash) throw Error(`Pinned source mismatch: ${acquired.sourceHash}`);
          const converted = await graph.authoring.convertAllStandardAndPersist(acquired.source, { sourceProvider: 'beatsaver', sourceId: id, sourceVersionHash: hash, includeAudio: true, cacheSourceEntries: true });
          await element.refreshLibrary(element.connectedGeneration, { preferredCollectionId: converted.collection.collectionId, preferredPackageId: converted.defaultPackage.packageId });
          await element.lifecycleIntentTail;
          if (element.libraryView.selectedCollectionId !== converted.collection.collectionId) throw Error('Selected collection mismatch');
          snap('selected');
          if (pausedMode) {
            await element.selectGameplayAxes('boxing_collider_v1');
            if (!['boxing_collider_v1', 'boxing_collider_knee_v1'].includes(graph.content.getSnapshot().selectedVariant?.rulesetId)) throw Error('The paused Play regression must start in Boxing');
          }
          // Explicit first session only. No further Start/Test/Preview until after E+2.
          await element.startSession(purpose, { requireDownloaded: true });
          if (purpose === 'play') {
            element.setMenuOpen(false, { freshSession: true });
            // Real camera/Worker and native input. Fake-device checkerboard has no body;
            // measured-form T-pose is test stimulus, not proof of physical CV accuracy.
            const deadline = performance.now() + 18000;
            while (performance.now() < deadline && !graph.cv.getLatestPoseFrame()) await wait(40);
            const pose = graph.cv.getLatestPoseFrame(), identity = element.lastCameraIdentity, surface = graph.video.describeSurface(element.videoElement());
            if (!pose?.sourceId || !identity || !(surface.sourceAspectRatio > 0)) throw Error('No Worker pose frame or live camera identity');
            let timestamp = Math.max(performance.now(), graph.input.getSnapshot().tracking.timestampMs + 1);
            const feed = tPose => {
              if (element.graph !== graph || !graph.cv.getStatus().running || element.lastCameraIdentity !== identity || graph.cv.getLatestPoseFrame()?.sourceId !== pose.sourceId) throw Error('Camera/CV identity changed during calibration');
              timestamp = Math.max(performance.now(), timestamp + 1000 / 15, graph.input.getSnapshot().tracking.timestampMs + 1);
              const y = tPose ? .4 : .58;
              const landmarks = { nose: { x: .5, y: .2 }, left_shoulder: { x: .35, y: .4 }, right_shoulder: { x: .65, y: .4 }, left_elbow: { x: .2, y }, right_elbow: { x: .8, y }, left_wrist: { x: .05, y }, right_wrist: { x: .95, y }, left_hip: { x: .43, y: .68 }, right_hip: { x: .57, y: .68 } };
              graph.input.processPoseSample({ sourceId: pose.sourceId, timestampMs: timestamp, mirrored: pose.mirrored, landmarks: Object.entries(landmarks).map(([name, point]) => ({ name, ...point, confidence: .99 })) }, { sourceAspectRatio: surface.sourceAspectRatio, sourceChangeId: identity });
              if (graph.input.getSnapshot().tracking.timestampMs !== timestamp) throw Error('Native T-pose stimulus was rejected');
            };
            while (performance.now() < deadline && !graph.input.getSnapshot().calibration.calibrationId) { feed(true); await wait(30); }
            if (!graph.input.getSnapshot().calibration.calibrationId) throw Error(`Scored Play calibration failed: ${JSON.stringify(graph.input.getSnapshot().calibration)}`);
            while (performance.now() < deadline && graph.gameplay.getSnapshot().session.state !== 'playing') { feed(false); await wait(35); }
          } else { element.stopFrameLoop(); element.setMenuOpen(false, { freshSession: true }); }
          const audioStartDeadline = performance.now() + 3000;
          while (graph.gameplay.getSnapshot().session.state === 'playing' && graph.audio.getStatus().state !== 'playing' && performance.now() < audioStartDeadline) await wait(25);
          if (graph.gameplay.getSnapshot().session.state !== 'playing' || graph.gameplay.getSnapshot().session.purpose !== purpose || graph.audio.getStatus().state !== 'playing') throw Error(`Real ${purpose} did not reach playing: ${JSON.stringify(snap('not-playing'))}`);
          snap('first-session-playing');
          if (pausedMode) {
            // Natural full-length music can stop fractionally before the scoring
            // clock and leave this same active-paused run instead of completed.
            await graph.audio.seek(Math.max(0, graph.audio.getStatus().durationSeconds - .01));
            await graph.audio.pause();
            const deadline = performance.now() + 5000;
            while (performance.now() < deadline && graph.gameplay.getSnapshot().session.state !== 'paused_manual') await wait(35);
            if (graph.gameplay.getSnapshot().session.state !== 'paused_manual') throw Error(`Play did not reach the natural-EOF pause branch: ${JSON.stringify(snap('pause-blocked'))}`);
            snap('paused-before-menu'); element.menuButtonElement().click();
            if (!element.menuOpen || element.menuDisposition !== 'active-paused') throw Error('The real menu button did not take the outgoing active-paused path');
          } else {
            await graph.audio.seek(Math.max(0, graph.audio.getStatus().durationSeconds - .015));
            if (purpose === 'visual_test') element.runDisplayFrame();
            const finishDeadline = performance.now() + 5000;
            while (performance.now() < finishDeadline && graph.gameplay.getSnapshot().session.state !== 'completed') { if (purpose === 'visual_test') element.runDisplayFrame(); await wait(35); }
            if (graph.gameplay.getSnapshot().session.state !== 'completed') throw Error(`Real ${purpose} did not complete: ${JSON.stringify(snap('completion-blocked'))}`);
            await element.terminalServiceTail;
            snap('completed'); element.setMenuOpen(true);
          }
          const previousHash = graph.content.getSnapshot().packageHash?.value;
          const originalMap = graph.vendor.getMapById, originalAcquire = graph.vendor.acquireVersion;
          graph.vendor.getMapById = async sourceId => ({ mapId: sourceId, versions: [{ hash, downloadUrl: 'https://fixture.invalid/archive.zip' }] });
          graph.vendor.acquireVersion = async (_map, requestedHash) => { if (requestedHash !== hash) throw Error('Incorrect pinned version'); return acquired; };
          try {
            const button = element.shadowRoot.querySelector('aero-content-library')?.shadowRoot?.querySelector("button[data-intent='library-reimport']");
            if (!button || button.disabled || button.dataset.value !== converted.collection.collectionId) throw Error('Selected Reimport button unavailable');
            button.click(); snap('reimport-click');
            await element.lifecycleIntentTail;
            if (element.pendingLibrarySelection) await element.pendingLibrarySelection;
          } finally { graph.vendor.getMapById = originalMap; graph.vendor.acquireVersion = originalAcquire; }
          const reimportClickIndex = events.findIndex(row => row.label === 'reimport-click');
          const E0 = snap('E+0'); await wait(2000); const E2 = snap('E+2');
          const E2Index = events.indexOf(E2);
          const collections = await graph.authoring.listCollections();
          const selected = collections.find(row => row.collectionId === converted.collection.collectionId);
          if (!selected || collections.length !== 1 || selected.packages.length !== 1) throw Error('Selected Reimport did not retain one isolated collection/package');
          const stored = await graph.authoring.loadPackage({ key: selected.packages[0].packageKey, packageId: selected.packages[0].packageId });
          const storedHash = stored.handle.packageHash?.value ?? String(stored.handle.packageHash ?? '').replace(/^sha256:/u, '');
          const loadedHash = graph.content.getSnapshot().packageHash?.value;
          if (!storedHash || loadedHash !== storedHash || !previousHash) throw Error(`Stored/loaded package hash mismatch ${JSON.stringify({ previousHash, storedHash, loadedHash })}`);
          for (const row of [E0, E2]) {
            if (row.flags.startRequested || row.flags.action !== '' || row.flags.armedOrdinal > 0 || row.clock.playing || row.clock.positionSeconds !== 0 || row.audio.positionSeconds !== 0 || !['ready', 'stopped'].includes(row.audio.state) || row.lease.length || row.audio.leaseState === 'active' || row.preview !== 'idle' || !row.media.every(item => item.paused)) throw Error(`Reimport transport not retired: ${JSON.stringify(row)}`);
          }
          const postCalls = events.slice(reimportClickIndex + 1, E2Index).filter(row => ['source.start', 'media.play'].includes(row.label));
          if (postCalls.length) throw Error(`Unexpected post-Reimport media calls: ${JSON.stringify(postCalls)}`);
          if (pausedMode) {
            element.menuButtonElement().click();
            await wait(2000);
            const closed = snap('menu-closed+2');
            if (element.menuOpen || closed.flags.startRequested || closed.session.state === 'countdown' || closed.audio.state === 'playing' || events.slice(E2Index + 1).some(row => ['source.start', 'media.play'].includes(row.label))) throw Error(`Outgoing Play resumed on menu close: ${JSON.stringify(closed)}`);
            const flow = element.shadowRoot.querySelector("aero-prototype-selector[scope='gameplay']")?.shadowRoot?.querySelector("input[data-intent='gameplay-mode-select'][value='flow_colliders_v1']");
            if (!(flow instanceof HTMLInputElement)) throw Error('Flow radio unavailable after Boxer Reimport');
            flow.click(); await element.lifecycleIntentTail;
            if (graph.content.getSnapshot().selectedVariant?.rulesetId !== 'flow_colliders_v1' || element.lastError) throw Error(`Boxing→Flow after paused Reimport failed: ${JSON.stringify({ selected: graph.content.getSnapshot().selectedVariant?.rulesetId, error: element.lastError })}`);
            snap('boxing-to-flow-after-reimport');
          }
          // Only now verify an explicit new Test/Start can play the reloaded song.
          const restart = 'visual_test';
          snap('explicit-restart-invoked');
          await element.startSession(restart, { requireDownloaded: true });
          element.stopFrameLoop();
          const restarted = snap('explicit-restart-playing');
          if (restarted.session.state !== 'playing' || restarted.session.purpose !== restart || restarted.audio.state !== 'playing' || !restarted.clock.playing || !events.slice(E2Index + 1).some(row => row.label === 'source.start')) throw Error(`Explicit restart did not play: ${JSON.stringify(restarted)}`);
          await graph.audio.pause();
          return { purpose, sourceHash: hash, previousHash, storedHash, loadedHash, callsBeforeRestart: events.filter(row => ['source.start', 'media.play'].includes(row.label)), E0, E2, restarted, events };
        } finally { AudioBufferSourceNode.prototype.start = originalStart; HTMLMediaElement.prototype.play = originalPlay; }
      }, { id: fixture.id, hash: fixture.hash, purpose, pausedMode });
      assert.equal(result.purpose, purpose);
      assert.equal(result.sourceHash, fixture.hash);
      assert.equal(result.loadedHash, result.storedHash);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ embedding, purpose, sourceHash: result.sourceHash, previousHash: result.previousHash, storedHash: result.storedHash, loadedHash: result.loadedHash, E0: result.E0, E2: result.E2, restarted: result.restarted, mediaCalls: result.callsBeforeRestart }));
    } finally { await context.close(); }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => parent?.close(resolve) ?? resolve());
  await new Promise(resolve => gameServer?.close(resolve) ?? resolve());
  await vite?.close();
}
