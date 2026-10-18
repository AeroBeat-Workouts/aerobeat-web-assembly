// @ts-check
// Product Test (visual_test), not measured Play: use native Show and Equipment preview
// controls, the signed game and pinned GLBs, then compare same-frame GPU pixels.
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { build as buildFixture, createServer as createViteServer } from 'vite';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';

const signedDirectory = process.env.AEROBEAT_SIGNED_FLOW_DIR;
const proofDirectory = process.env.AEROBEAT_FLOW_TEST_PROOF_DIR;
const deviceScaleFactor = Number(process.env.AEROBEAT_FLOW_TEST_DPR ?? 1);
assert([1, 3].includes(deviceScaleFactor), 'Flow Test proof DPR must be 1 or 3');
let vite = null, signedServer = null, fixtureDirectory = null, childUrl;
if (signedDirectory) {
  const snapshot = loadSignedSnapshot(path.resolve(signedDirectory));
  assert(['0.0.131', '0.0.132'].includes(snapshot.manifest.sourceManifest.packageVersion), 'expected signed before/after Flow Test snapshot');
  fixtureDirectory = mkdtempSync(path.join(tmpdir(), 'aerobeat-flow-test-'));
  await buildFixture({ configFile: false, root: process.cwd(), logLevel: 'error', build: { outDir: fixtureDirectory, emptyOutDir: true, lib: { entry: 'scripts/fixtures/scored-play-browser-harness.js', formats: ['es'], fileName: () => 'scored-play-browser-harness.js' } } });
  const fixtures = new Map(readdirSync(fixtureDirectory).filter(name => name.endsWith('.js')).map(name => [`/scripts/fixtures/${name}`, readFileSync(path.join(fixtureDirectory, name))]));
  const signedHandler = handlerForSnapshot(snapshot);
  signedServer = createHttpServer((request, response) => {
    const fixture = fixtures.get(new URL(request.url ?? '/', 'http://local.invalid').pathname);
    if (fixture) { response.setHeader('Content-Type', 'text/javascript; charset=utf-8'); response.setHeader('Cache-Control', 'no-store'); response.end(fixture); return; }
    signedHandler(request, response);
  });
  await new Promise(resolve => signedServer.listen(0, '127.0.0.1', resolve));
  const address = signedServer.address(); assert(address && typeof address !== 'string');
  childUrl = `http://127.0.0.1:${address.port}/`;
} else {
  vite = await createViteServer({ appType: 'spa', configFile: 'vite.config.js', logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await vite.listen(); childUrl = vite.resolvedUrls?.local?.[0];
}
assert(childUrl, 'signed/source game URL unavailable');
const parent = createHttpServer((_request, response) => { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`); });
await new Promise(resolve => parent.listen(0, '127.0.0.1', resolve));
const address = parent.address(); assert(address && typeof address !== 'string');
const parentUrl = `http://localhost:${address.port}/`;
const browser = await chromium.launch({ headless: true });
try {
  for (const embedding of ['direct', 'genuine_cross_origin_iframe']) {
    const context = await browser.newContext({ viewport: embedding === 'direct' ? { width: 844, height: 390 } : { width: 868, height: 414 }, deviceScaleFactor });
    const page = await context.newPage(), noise = [];
    page.on('console', message => { const location = message.location(); if (['warning', 'error'].includes(message.type()) && !isExpectedReadPixelsWarning(message.type(), message.text(), location.url, location.lineNumber, location.columnNumber, childUrl) && !isExpectedPlaycanvasMeshWarning(message.type(), message.text())) noise.push(`${message.type()}:${message.text()}`); });
    page.on('pageerror', error => noise.push(`pageerror:${error.message}`));
    try {
      await page.goto(embedding === 'direct' ? childUrl : parentUrl, { waitUntil: 'networkidle' });
      if (embedding !== 'direct') assert.notEqual(new URL(parentUrl).origin, new URL(childUrl).origin);
      const game = embedding === 'direct' ? page.locator('aero-game') : page.frameLocator('#game').locator('aero-game');
      await game.waitFor();
      const setup = await game.evaluate(async element => {
        const { installScoredPlayHarness } = await import('/scripts/fixtures/scored-play-browser-harness.js');
        const event = { schema: 'aerobeat/resolved_content_event', version: 3, eventId: 'test-visibility-probe', centerTimestampMs: 20000, sourceEventIds: ['test-probe'], appearanceColor: '#2693ff', authoredBeat: { type: 'note', hand: 'left', placement: 5, requiresDirection: false } };
        const harness = await installScoredPlayHarness(element, { events: [event], mode: 'flow', songDurationMs: 30000 });
        await harness.waitForAssets(); await harness.selectChart();
        await harness.setSetup({ flowColliderVolume: { colliderVisible: true, colliderScale: 1, colliderDepthForward: 1, colliderDepthBackward: 0 }, noseMarkerVisible: false });
        await element.startSession('visual_test', { requireDownloaded: false });
        element.stopFrameLoop(); element.setMenuOpen(false, { freshSession: true }); await element.menuPauseTail;
        element.renderGameplay();
        return { state: harness.graph.gameplay.getSnapshot().session.state, purpose: harness.graph.gameplay.getSnapshot().session.purpose, previewDefault: element.testEquipmentVisible, collider: element.activeSessionSetup?.flowColliderVolume, lastError: element.lastError?.message ?? null };
      });
      assert.equal(setup.purpose, 'visual_test'); assert.equal(setup.state, 'playing'); assert.equal(setup.previewDefault, false);
      assert.deepEqual(setup.collider, { colliderVisible: true, colliderScale: 1, colliderDepthForward: 1, colliderDepthBackward: 0 });
      assert.equal(setup.lastError, null);
      // The separate Test Equipment preview is enabled by its actual native checkbox.
      await game.locator("[data-equipment-preview-toggle='true']").check();
      if (proofDirectory) { mkdirSync(proofDirectory, { recursive: true }); await game.locator('canvas[data-role="renderer"]').screenshot({ path: path.join(proofDirectory, `${embedding}-flow-test-normal-environment.png`) }); }
      const result = await game.evaluate(element => {
        const renderer = element.graph.renderer;
        element.stopFrameLoop(); renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: 'solid', colors: ['#071426'], angleDeg: 180 });
        element.renderGameplay();
        const canvas = element.shadowRoot.querySelector('canvas[data-role="renderer"]');
        if (!(canvas instanceof HTMLCanvasElement)) throw Error('Test canvas unavailable');
        const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
        const cx = copy.getContext('2d', { willReadFrequently: true }); if (!cx) throw Error('Test framebuffer readback unavailable');
        const pixels = () => { cx.drawImage(canvas, 0, 0); return Uint8Array.from(cx.getImageData(0, 0, copy.width, copy.height).data); };
        const frame = element.rendererFrame(), equipment = element.currentEquipmentPoses;
        const draw = show => { renderer.renderGameplayFrameWithCursorsAndEquipment({ ...frame, colliderSettings: { ...frame.colliderSettings, colliderVisible: show } }, [], { grid: { x: 0, y: 0, width: 1, height: 1 } }, equipment, { grid: { columns: 4, rows: 3 } }); return pixels(); };
        const on = draw(true), model = renderer.lastModel, active = model?.objects?.filter(object => object.kind === 'collider_volume') ?? [];
        const entities = renderer.flowColliderCapsulePool?.filter(entity => entity.enabled) ?? [];
        const off = draw(false);
        const offObjects = renderer.lastModel?.objects?.filter(object => object.kind === 'collider_volume') ?? [];
        const offEntities = renderer.flowColliderCapsulePool?.filter(entity => entity.enabled) ?? [];
        const halves = [0, 0], strong = [0, 0], columns = [new Set(), new Set()];
        for (let i = 0; i < on.length; i += 4) {
          const delta = Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]);
          const x = (i / 4) % copy.width, hand = x < copy.width / 2 ? 0 : 1;
          if (delta >= 6) halves[hand]++;
          if (delta >= 35) { strong[hand]++; columns[hand].add(x); }
        }
        draw(true);
        return { purpose: element.graph.gameplay.getSnapshot().session.purpose, state: element.graph.gameplay.getSnapshot().session.state, preview: element.testEquipmentVisible, setup: element.activeSessionSetup?.flowColliderVolume, equipment: renderer.describe().equipment, poses: equipment.length, active: active.map(object => ({ id: object.id, radius: object.capsule?.radius, length: object.capsule ? Math.hypot(object.capsule.end.x - object.capsule.start.x, object.capsule.end.y - object.capsule.start.y, object.capsule.end.z - object.capsule.start.z) : null })), entities: entities.map(entity => ({ name: entity.name, enabled: entity.enabled })), offObjects: offObjects.length, offEntities: offEntities.length, changed: halves, strong, columns: columns.map(set => set.size), canvas: [copy.width, copy.height], lastError: element.lastError?.message ?? null };
      });
      assert.equal(result.purpose, 'visual_test'); assert.equal(result.state, 'playing'); assert.equal(result.preview, true);
      assert.equal(result.equipment.assetMode, 'glb'); assert.equal(result.poses, 2); assert.equal(result.lastError, null);
      assert.deepEqual(result.active.map(object => [object.id, object.radius, object.length]), [['equipment-collider-volume-left', .048, 1.5], ['equipment-collider-volume-right', .048, 1.5]]);
      assert.equal(result.entities.length, 2);
      assert.equal(result.offObjects, 0, 'Show off must remove Test capsule scene objects');
      assert.equal(result.offEntities, 0, 'Show off must disable actual Test GPU overlays');
      if (proofDirectory) { mkdirSync(proofDirectory, { recursive: true }); await game.locator('canvas[data-role="renderer"]').screenshot({ path: path.join(proofDirectory, `${embedding}-flow-test-show.png`) }); }
      // At least one high-contrast true-radius stroke on each hand's visible blade.
      // The signed 0.0.131 baseline has only ~55 strong pixels per half.
      assert(result.strong.every(count => count >= 130) && result.columns.every(count => count >= 75), `Flow Test Show is visually lost behind the GLB saber: ${JSON.stringify(result)}`);
      assert.deepEqual(noise, [], `${embedding}: unexpected console/page error`);
      // Native run-locked Test settings: a subsequent Test run at Scale 0 must
      // still draw the saber, but never a scored-volume outline. Show off, too.
      for (const [field, value, expectedColliders] of [['colliderScale', 0, 0], ['colliderScale', 1, 2], ['colliderVisible', false, 0]]) {
        const setupControl = await game.evaluate(async (element, { field, value }) => {
          element.setMenuOpen(true); await element.menuPauseTail;
          const input = element.shadowRoot.querySelector(`input[data-collider-volume-field='${field}']`);
          if (!(input instanceof HTMLInputElement)) throw Error(`native ${field} Test input unavailable`);
          if (input.type === 'checkbox') { if (input.checked !== value) input.click(); }
          else { input.focus(); input.value = String(value); input.dispatchEvent(new Event('change', { bubbles: true })); input.blur(); }
          await element.lifecycleIntentTail;
          await element.startSession('visual_test', { requireDownloaded: false });
          element.stopFrameLoop(); element.setMenuOpen(false, { freshSession: true }); await element.menuPauseTail;
          return { purpose: element.graph.gameplay.getSnapshot().session.purpose, locked: element.activeSessionSetup?.flowColliderVolume, preview: element.testEquipmentVisible };
        }, { field, value });
        assert.equal(setupControl.purpose, 'visual_test'); assert.equal(setupControl.preview, false);
        assert.equal(setupControl.locked[field], value);
        await game.locator("[data-equipment-preview-toggle='true']").check();
        const control = await game.evaluate(element => {
          element.stopFrameLoop(); element.renderGameplay();
          const renderer = element.graph.renderer;
          return { asset: renderer.describe().equipment.assetMode, poses: element.currentEquipmentPoses.length, colliders: renderer.lastModel?.objects?.filter(object => object.kind === 'collider_volume').length ?? -1, activeFills: renderer.flowColliderCapsulePool?.filter(entity => entity.enabled).length ?? 0, lastError: element.lastError?.message ?? null };
        });
        assert.equal(control.asset, 'glb'); assert.equal(control.poses, 2); assert.equal(control.colliders, expectedColliders); assert.equal(control.activeFills, expectedColliders); assert.equal(control.lastError, null);
      }
      assert.deepEqual(noise, [], `${embedding}: unexpected Test console/page error`);
      console.log(`PASS Flow Test Show ${embedding}: ${JSON.stringify(result)}`);
    } finally { await context.close(); }
  }
  console.log('ORACLE flow-test-collider-visibility PASS');
} finally {
  await browser.close(); await new Promise(resolve => parent.close(resolve));
  if (signedServer) await new Promise(resolve => signedServer.close(resolve));
  if (vite) await vite.close();
  if (fixtureDirectory) rmSync(fixtureDirectory, { recursive: true, force: true });
}
