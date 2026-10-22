// @ts-check
// Actual connected source or immutable signed <aero-game>: measured legs
// through input, native PlayCanvas art and scored Play. Test remains visual-only.
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { build as buildFixture, createServer as createViteServer } from 'vite';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';

const signedDirectory = process.env.AEROBEAT_KNEE_SCORED_SIGNED_DIR;
const vite = signedDirectory ? null : await createViteServer({ appType: 'spa', configFile: 'vite.config.js', logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
let browser, parent, signedServer, fixtureDirectory;
try {
  let url;
  if (vite) { await vite.listen(); url = vite.resolvedUrls?.local?.[0]; }
  else {
    const snapshot = loadSignedSnapshot(path.resolve(signedDirectory));
    assert.ok(['0.0.142', '0.0.143'].includes(snapshot.manifest.sourceManifest.packageVersion), 'signed knee scoring needs the knee release or corrective successor');
    fixtureDirectory = mkdtempSync(path.join(tmpdir(), 'aerobeat-signed-knee-scoring-'));
    await buildFixture({ configFile: false, root: process.cwd(), logLevel: 'error', build: { outDir: fixtureDirectory, emptyOutDir: true, lib: { entry: 'scripts/fixtures/scored-play-browser-harness.js', formats: ['es'], fileName: () => 'scored-play-browser-harness.js' } } });
    const fixtures = new Map(readdirSync(fixtureDirectory).filter(name => name.endsWith('.js')).map(name => [`/scripts/fixtures/${name}`, readFileSync(path.join(fixtureDirectory, name))]));
    const handler = handlerForSnapshot(snapshot);
    signedServer = createHttpServer((request, response) => {
      const fixture = fixtures.get(new URL(request.url ?? '/', 'http://fixture.invalid').pathname);
      if (fixture) { response.setHeader('content-type', 'text/javascript; charset=utf-8'); response.setHeader('cache-control', 'no-store'); response.end(fixture); return; }
      handler(request, response);
    });
    await new Promise(resolve => signedServer.listen(0, '127.0.0.1', resolve));
    const address = signedServer.address(); assert(address && typeof address !== 'string');
    url = `http://127.0.0.1:${address.port}/`;
  }
  assert(url, 'connected source or signed URL unavailable');
  parent = createHttpServer((_request, response) => { response.setHeader('content-type', 'text/html; charset=utf-8'); response.end(`<!doctype html><iframe id="knee-game-frame" allow="camera; autoplay; fullscreen; xr-spatial-tracking" style="width:844px;height:390px;border:0" src="${url}"></iframe>`); });
  await new Promise(resolve => parent.listen(0, '127.0.0.1', resolve));
  const address = parent.address(); assert(address && typeof address !== 'string');
  const parentUrl = `http://localhost:${address.port}/`;
  browser = await chromium.launch({ headless: true });
  for (const embedding of ['direct', 'cross_origin_iframe']) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage(), noise = [];
    page.on('pageerror', error => noise.push(`pageerror:${error.message}`));
    page.on('console', message => {
      const type = message.type(), location = message.location();
      if (['warning', 'error'].includes(type) && !isExpectedReadPixelsWarning(type, message.text(), location.url, location.lineNumber, location.columnNumber, url) && !isExpectedPlaycanvasMeshWarning(type, message.text())) noise.push(`${type}:${message.text()}`);
    });
    await page.goto(embedding === 'direct' ? url : parentUrl, { waitUntil: 'networkidle' });
    if (embedding === 'cross_origin_iframe') {
      await page.frameLocator('#knee-game-frame').locator('aero-game').waitFor();
      const child = page.frames().find(frame => frame !== page.mainFrame() && frame.url() === url);
      assert(child, 'real cross-origin game iframe unavailable');
      assert.notEqual(new URL(child.url()).origin, new URL(page.url()).origin);
    }
    const game = embedding === 'direct' ? page.locator('aero-game') : page.frameLocator('#knee-game-frame').locator('aero-game'); await game.waitFor();
    const result = await game.evaluate(async element => {
      const { installScoredPlayHarness } = await import('/scripts/fixtures/scored-play-browser-harness.js');
      const check = (condition, message) => { if (!condition) throw Error(`Knee scored Play: ${message}`); };
      const cases = [
        { id: 'left-hit', type: 'knee_left', cell: 9, at: 6000, pose: 'matching', hit: true },
        { id: 'right-hit', type: 'knee_right', cell: 10, at: 10000, pose: 'matching', hit: true },
        { id: 'wrong-side', type: 'knee_left', cell: 9, at: 14000, pose: 'opposite', hit: false },
        { id: 'missing-leg', type: 'knee_right', cell: 10, at: 18000, pose: 'missing', hit: false },
        { id: 'frozen-frame', type: 'knee_left', cell: 9, at: 22000, pose: 'frozen', hit: false },
        { id: 'tail', type: 'knee_right', cell: 10, at: 30000, pose: 'missing', hit: false }
      ];
      const events = cases.map(row => ({ schema: 'aerobeat/resolved_content_event', version: 3, eventId: row.id, centerTimestampMs: row.at, sourceEventIds: [`source-${row.id}`], authoredBeat: { type: row.type, spatialTarget: { targetCell: row.cell, acceptedSubcells: [row.cell * 4, row.cell * 4 + 1, row.cell * 4 + 2, row.cell * 4 + 3] }, timingWindowMs: 180, evidenceFreshnessMs: 150 } }));
      const harness = await installScoredPlayHarness(element, { events, kneeRuleset: true, songDurationMs: 34000 });
      try {
        await harness.waitForAssets(); await harness.selectChart();
        await harness.setSetup({ noseMarkerVisible: true, spawnDistanceOverrideEnabled: true, spawnDistanceOverrideWorldUnits: 20, kneeColliderVolume: { colliderVisible: true } });
        await harness.startPlay(); await harness.calibrate();
        const { graph } = harness;
        // Calibration can intentionally run its 15fps measurement clock ahead
        // of wall time. Native Play visuals correctly reject future poses, so
        // restore a real-time measured clock before asserting pad/marker pixels.
        while (performance.now() <= harness.element.latestPoseTimestampMs + 20) await new Promise(resolve => setTimeout(resolve, 50));
        const bounds = graph.input.getSnapshot().calibration.bounds;
        const toCamera = (x, y) => ({ x: 1 - (bounds.left + x * (bounds.right - bounds.left)), y: bounds.top + y * (bounds.bottom - bounds.top) });
        const leg = (x, y) => ({ hip: toCamera(x, y - .22), knee: toCamera(x, y), ankle: toCamera(x, y + .22) });
        const bottomTargetY = 1 - harness.element.activeSessionSetup.bottomRowReachWU;
        const raisedY = (2.5 - bottomTargetY) / 3;
        const raised = { left: leg(.375, raisedY), right: leg(.625, raisedY) };
        const away = { left: leg(.375, 1.35), right: leg(.625, 1.35) };
        const absent = { left: away.left };
        const score = snapshot => snapshot.scorePartitions.reduce((sum, partition) => sum + Number(partition.score ?? 0), 0);
        const rows = [];
        for (const row of cases.slice(0, -1)) {
          await harness.seekSong(row.at - 600, { legs: away });
          await harness.seekSong(row.at - 300, { legs: away });
          const target = harness.element.rendererFrame().targets.find(entry => entry.id === row.id);
          const native = graph.renderer.lastModel.objects.filter(object => object.targetId === row.id && object.kind === 'icon');
          check(target?.kind === 'knee' && target.cell === row.cell && native.length > 0, `${row.id}: authored lowest-row native knee target absent`);
          const before = graph.gameplay.getSnapshot(), beforeScore = score(before);
          // Freeze a genuine previously contacting LEFT knee just before the
          // later authored left target; no new pose is allowed at its center.
          const legs = row.pose === 'matching' || row.pose === 'frozen' ? raised : row.pose === 'opposite' ? { left: away.left, right: raised.right } : absent;
          await harness.seekSong(row.pose === 'frozen' ? row.at - 220 : row.at + 35, { legs });
          const input = graph.input.getSnapshot(), evidence = input.latestEvidence;
          check(evidence?.provenance === 'measured' && evidence.measurementTimestampMs === harness.element.latestPoseTimestampMs && !input.tracking.gameplayPaused, `${row.id}: real input did not consume fresh measured evidence`);
          check(row.pose !== 'matching' || evidence.kneePose?.legs?.length === 2, `${row.id}: bilateral measured knee pose missing`);
          check(row.pose !== 'missing' || !evidence.kneePose?.legs.some(leg => leg.side === 'right'), `${row.id}: missing leg leaked into measured evidence`);
          const displayed = harness.element.rendererFrame(), equipment = graph.renderer.describe().equipment;
          const kneeObjects = graph.renderer.lastModel.objects.filter(object => ['knee_pad', 'knee_marker', 'knee_collider'].includes(object.kind));
          if (row.pose === 'matching') check(equipment?.assetMode === 'glb' && displayed.kneeEnabled === true && kneeObjects.filter(object => object.kind === 'knee_pad').length === 2 && kneeObjects.filter(object => object.kind === 'knee_marker').length === 2 && kneeObjects.filter(object => object.kind === 'knee_collider').length === 2, `${row.id}: bilateral native knee pads, markers or Show volumes missing: ${JSON.stringify({objects:kneeObjects.map(object => [object.kind, object.role, object.assetId]),kneeEnabled:displayed.kneeEnabled,joints:displayed.kneeJoints,age:performance.now()-evidence.kneePose?.measurementTimestampMs,overlay:displayed.overlay})}`);
          if (row.pose === 'missing') check(kneeObjects.every(object => object.role !== 'right') && kneeObjects.some(object => object.role === 'left' && object.kind === 'knee_pad'), `${row.id}: tracking-loss right knee retained or remaining left pad missing`);
          if (row.pose === 'frozen') {
            const held = evidence.measurementTimestampMs;
            const left = evidence.kneePose?.legs.find(leg => leg.side === 'left');
            check(left && Math.abs(left.knee.x - .375) < .001 && Math.abs(left.knee.y - raisedY) < .001 && score(graph.gameplay.getSnapshot()) === beforeScore, 'frozen setup must hold a previously contacting measured left knee without an early hit');
            // Move only the audio device to the later authored target. A replay
            // of the held same-side contact would score despite no fresh CV.
            await graph.audio.seek((row.at + 35) / 1000);
            harness.element.runDisplayFrame();
            check(graph.input.getSnapshot().latestEvidence?.measurementTimestampMs === held && harness.element.latestPoseTimestampMs === held, 'frozen frame unexpectedly gained a fresh measured timestamp');
            check(graph.gameplay.getSnapshot().session.timelinePositionMs >= row.at + 35, 'frozen frame did not traverse the later authored knee target');
          }
          const current = graph.gameplay.getSnapshot(), judgement = current.judgements.find(entry => entry.eventId === row.id);
          if (row.hit) {
            check(judgement?.result === 'hit' && score(current) > beforeScore, `${row.id}: matching named leg did not score: ${JSON.stringify({ judgement, evidence: evidence.kneePose, session: current.session })}`);
            await harness.seekSong(row.at + 130, { legs: raised });
            check(graph.gameplay.getSnapshot().judgements.filter(entry => entry.eventId === row.id && entry.result === 'hit').length === 1, `${row.id}: knee scored twice`);
          } else check(judgement?.result !== 'hit' && score(current) === beforeScore, `${row.id}: ${row.pose} falsely scored`);
          rows.push({ id: row.id, result: judgement?.result ?? 'pending', targetCell: target.cell, nativeTargets: native.length, measuredLegs: evidence.kneePose?.legs.map(leg => leg.side) ?? [], scoreDelta: score(current) - beforeScore });
        }
        // Visual Test is never scored by its automatic renderer feedback.
        await harness.element.startSession('visual_test', { requireDownloaded: false });
        harness.element.stopFrameLoop(); harness.element.setMenuOpen(false, { freshSession: true });
        await graph.audio.seek(6); harness.element.runDisplayFrame();
        const test = graph.gameplay.getSnapshot(), testFrame = harness.element.rendererFrame();
        check(test.session.purpose === 'visual_test' && testFrame.targets.some(target => target.kind === 'knee') && test.judgements.length === 0 && score(test) === 0, 'Test automatic preview became scored or lost authored knee target');
        return { rows, test: { purpose: test.session.purpose, judgements: test.judgements.length, score: score(test), kneeTargets: testFrame.targets.filter(target => target.kind === 'knee').length } };
      } finally { harness.dispose(); }
    });
    assert.deepEqual(noise, [], `${embedding}: source Chromium warnings/errors`);
    console.log(`ORACLE knee-scored-play-browser ${embedding} PASS ${JSON.stringify(result)}`);
  } finally { await context.close(); }
  }
} finally { if (browser) await browser.close(); await new Promise(resolve => parent?.close(resolve) ?? resolve()); await new Promise(resolve => signedServer?.close(resolve) ?? resolve()); await vite?.close(); if (fixtureDirectory) rmSync(fixtureDirectory, { recursive: true, force: true }); }
