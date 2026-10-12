// @ts-check
// Browser acceptance for an already built, separately served full AeroBeat app.
// Uses the real chart importer and Test action; does not fake scored hits or phone CV/Play.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.AEROBEAT_FULL_GAME_PREVIEW_URL;
assert(url && /^https?:\/\//u.test(url), 'Set AEROBEAT_FULL_GAME_PREVIEW_URL to the exact built app URL');
const screenshot = process.env.AEROBEAT_FULL_GAME_PREVIEW_SCREENSHOT ?? '/tmp/aerobeat-full-game-preview.png';
const chart = new TextEncoder().encode(JSON.stringify({
  _version: '2.0.0', _events: [], _notes: [
    { _time: 6, _lineIndex: 1, _lineLayer: 1, _type: 0, _cutDirection: 8 },
    { _time: 7, _lineIndex: 2, _lineLayer: 1, _type: 1, _cutDirection: 8 }
  ], _obstacles: []
}));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, 'full app HTML must load');
  assert.equal(await page.title(), 'AeroBeat Web Assembly');
  await page.waitForFunction(() => document.querySelector('aero-game')?.graph?.renderer?.describe()?.gameplayAssets?.state === 'ready', null, { timeout: 30_000 });
  const game = page.locator('aero-game');
  const imported = await game.evaluate(async (element, chartBytes) => {
    const chart = Uint8Array.from(chartBytes);
    const wav = (seconds) => {
      const rate = 8000, length = rate * seconds * 2, buffer = new ArrayBuffer(44 + length), view = new DataView(buffer);
      const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
      text(0, 'RIFF'); view.setUint32(4, 36 + length, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
      view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, length, true); return new Uint8Array(buffer);
    };
    const audio = wav(20), info = new TextEncoder().encode('{}');
    const hash = async bytes => `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('')}`;
    const [chartHash, audioHash] = await Promise.all([hash(chart), hash(audio)]);
    const entries = new Map([['Info.dat', info], ['Easy.dat', chart], ['song.wav', audio]]);
    const manifest = Object.freeze({ schemaId: 'aerobeat.beatsaver-source-manifest.v2', infoFormatMajor: 2, infoFormat: 'v2', infoVersion: '2.0.0', infoPath: 'Info.dat',
      hashInputPaths: Object.freeze(['Easy.dat']), songName: 'Full Game Preview QA', songSubName: '', songAuthorName: 'AeroBeat', levelAuthorName: 'AeroBeat QA', bpm: 120,
      audioPath: 'song.wav', coverPath: '', previewStartSeconds: 0, previewDurationSeconds: 0, difficulties: Object.freeze([Object.freeze({
        characteristic: 'Standard', difficulty: 'Easy', difficultyRank: 1, path: 'Easy.dat', beatMapFormatMajor: 2, beatMapFormat: 'v2', beatMapVersion: '2.0.0',
        notePalette: null, noteJumpMovementSpeed: 10, noteJumpStartBeatOffset: 1
      })]), entries: Object.freeze([]), archiveBytes: chart.length + audio.length + info.length, expandedBytes: chart.length + audio.length + info.length });
    const source = Object.freeze({ manifest, listEntryPaths() { return Object.freeze(['Info.dat', 'Easy.dat', 'song.wav']); }, readEntry(path) {
      const bytes = entries.get(path); if (!bytes) throw Error('chart fixture entry missing'); return Uint8Array.from(bytes);
    } });
    const authoring = element.graph.authoring;
    const converted = await authoring.convertAllStandardAndPersist({ providerId: 'beatsaver', sourceHash: '0123456789abcdef0123456789abcdef01234567', source },
      { sourceProvider: 'beatsaver', sourceId: 'QA-FULL-GAME', sourceVersionHash: '0123456789abcdef0123456789abcdef01234567',
        expectedAudioContentHash: audioHash, expectedDifficultyContentHashes: { 'Easy.dat': chartHash }, includeAudio: true, cacheSourceEntries: true });
    await authoring.loadPackage(converted.defaultPackage.handle);
    await element.refreshLibrary(element.connectedGeneration, { autoSelect: false });
    await element.requestLibrarySelection(converted.collection.collectionId, converted.defaultPackage.packageId);
    const selected = element.graph.content.getSnapshot();
    return { selected: selected.packageId === converted.defaultPackage.packageId, flow: selected.variants?.some(variant => variant.mode === 'flow'),
      worker: authoring.getCapabilities().conversionWorker === true, state: selected.state };
  }, [...chart]);
  assert.deepEqual(imported, { selected: true, flow: true, worker: true, state: 'ready' }, 'real Worker import and selected Flow chart');
  const actions = game.locator('aero-session-actions');
  assert.equal(await actions.getByRole('button', { name: 'Start', exact: true }).isEnabled(), true, 'real camera-backed Play action available for phone');
  await actions.getByRole('button', { name: 'Test', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('aero-game')?.graph?.gameplay?.getSnapshot?.().session?.state === 'playing');
  const playing = await game.evaluate(async element => {
    element.setMenuOpen(false); await element.menuPauseTail;
    element.setTestEquipmentVisible(true);
    const canvas = element.canvasElement(), snapshot = element.graph.gameplay.getSnapshot(), renderer = element.graph.renderer;
    element.renderGameplay();
    return { purpose: snapshot.session.purpose, state: snapshot.session.state, canvas: [canvas.width, canvas.height],
      glbs: renderer.describe().gameplayAssets.state, cvIdle: element.graph.cv.getStatus().running === false,
      saber: [...renderer.equipmentPools.values()].flat().some(entity => entity.enabled) };
  });
  assert.equal(playing.purpose, 'visual_test');
  assert.equal(playing.state, 'playing');
  assert.equal(playing.glbs, 'ready');
  assert.equal(playing.cvIdle, true, 'Test requires no camera');
  assert.equal(playing.saber, true, 'visible equipment renders in actual gameplay');
  assert(playing.canvas.every(value => value > 0), 'real gameplay canvas has nonzero backing pixels');
  const collapse = game.locator("[data-action='debug-controls-collapse']");
  if (await collapse.count()) await collapse.click();
  const beat = await game.evaluate(async element => {
    await element.graph.audio.seek(2.9); await element.graph.audio.play();
    element.runDisplayFrame(); element.renderGameplay();
    const model = element.graph.renderer.lastModel;
    return { beat: element.graph.audio.getClockSnapshot().positionSeconds, icons: model?.objects?.filter(object => object.kind === 'icon').length ?? 0 };
  });
  assert(beat.icons > 0, 'real chart GLBs render during scored Test');
  await page.screenshot({ path: screenshot });
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log(JSON.stringify({ pass: true, url, imported, playing, screenshot }));
  await context.close();
} finally { await browser.close(); }
