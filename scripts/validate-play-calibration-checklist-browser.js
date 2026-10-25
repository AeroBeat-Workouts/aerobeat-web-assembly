// @ts-check
// Connected assembly Play shell, configured Vite and native input/gameplay.
// Device/CV transport is the existing scored-Play browser harness, not a signed or physical camera test.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';

const vite = await createViteServer({ appType: 'spa', configFile: 'vite.config.js', logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0];
  assert(url);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  const game = page.locator('aero-game');
  await game.waitFor({ state: 'attached' });
  try { await page.waitForFunction(() => Boolean(document.querySelector('aero-game')?.graph), null, { timeout: 10000 }); }
  catch (error) {
    const lifecycle = await game.evaluate(element => ({ defined: Boolean(customElements.get('aero-game')), connected: element.isConnected, lifecycle: element.lifecycle ?? null, lastError: element.lastError?.message ?? null }));
    throw new Error(`Assembly did not connect: ${JSON.stringify({ errors, lifecycle })}; ${error}`);
  }
  const result = await game.evaluate(async element => {
    const { installScoredPlayHarness } = await import('/scripts/fixtures/scored-play-browser-harness.js');
    const check = (condition, description) => { if (!condition) throw Error(`Play checklist: ${description}`); };
    const event = { schema: 'aerobeat/resolved_content_event', version: 3, eventId: 'checklist-beat', centerTimestampMs: 6000, sourceEventIds: ['source-checklist-beat'], authoredBeat: { type: 'knee_left', spatialTarget: { targetCell: 9, acceptedSubcells: [36, 37, 38, 39] }, timingWindowMs: 180, evidenceFreshnessMs: 150 } };
    const harness = await installScoredPlayHarness(element, { events: [event], kneeRuleset: true, songDurationMs: 10000 });
    const root = element.shadowRoot;
    const card = () => root.querySelector('[data-role="play-calibration-checklist"]');
    const row = key => root.querySelector(`[data-checklist-landmark="${key}"]`);
    const shown = () => !card().hidden;
    const legs = { left: { hip: { x: .43, y: .68 }, knee: { x: .43, y: .8 }, ankle: { x: .43, y: .93 } }, right: { hip: { x: .57, y: .68 }, knee: { x: .57, y: .8 }, ankle: { x: .57, y: .93 } } };
    try {
      check(!shown(), 'card must be absent before Play');
      await harness.waitForAssets(); await harness.selectChart(); await harness.startPlay();
      check(shown() && card().querySelector('[data-checklist-mode]').textContent.includes('0% CHANCE'), '0% knee-enabled Boxer must show the checklist');
      const transport = root.querySelector('[data-role="visual-test-transport"]');
      const scoreHud = root.querySelector('aero-flow-hud');
      check(transport.hidden && getComputedStyle(transport).display === 'none', 'bottom transport must not paint or accept clicks over landscape checklist footer');
      check(getComputedStyle(scoreHud).display === 'none', 'zero-score Combo HUD must not shift landscape cue during calibration');
      check(Math.abs(root.querySelector('[data-role="transient-cue"]').getBoundingClientRect().x - 140) < 3, `landscape calibration cue keeps approved x=140 without Combo HUD; actual=${root.querySelector('[data-role="transient-cue"]').getBoundingClientRect().x}`);
      check(card().getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom, 'landscape checklist footer must remain within game bounds');
      check(getComputedStyle(card()).fontFamily.startsWith('system-ui'), 'checklist card must use approved system-ui font rather than inherited Inter');
      check(card().querySelectorAll('[data-checklist-landmark]').length === 9 && !row('left_elbow').hidden && !row('right_elbow').hidden, 'all nine stable landmark rows required');
      check(row('right_knee').querySelector('.checklist-value').textContent === 'Missing', 'initial missing knee');
      harness.feedPose({ tPose: true, legs });
      check(row('right_knee').querySelector('.checklist-value').textContent === 'Seen', 'fresh measured knee becomes seen immediately');
      harness.feedPose({ tPose: true, legs: { left: legs.left } });
      check(row('right_knee').querySelector('.checklist-value').textContent === 'Missing' && card().querySelector('[data-checklist-hold] .checklist-value').textContent === 'Waiting', 'knee confidence loss resets display immediately');
      harness.feedPose({ tPose: true, legs });
      check(row('right_knee').querySelector('.checklist-value').textContent === 'Seen', 'knee recovers without latching missing');
      check(!card().textContent.includes('Visible') && !card().textContent.includes('Both knees must'), 'approved revision 3 copy');
      element.setMenuOpen(true);
      check(!shown() && !transport.hidden && getComputedStyle(scoreHud).display !== 'none', 'menu restores transport and Combo HUD immediately');
      await element.menuPauseTail;
      element.setMenuOpen(false, { freshSession: true });
      await element.recoverPlayCamera();
      element.stopFrameLoop();
      check(!shown() && !transport.hidden && getComputedStyle(scoreHud).display !== 'none', 'paused Play menu recovery does not hide transport and Combo HUD');
      await element.startSession('play', { requireDownloaded: true });
      element.stopFrameLoop(); element.setMenuOpen(false, { freshSession: true });
      check(shown() && transport.hidden && getComputedStyle(scoreHud).display === 'none', 'fresh Play calibration hides only nonessential chrome');
      // Native input-only measured hold commits a real calibration generation;
      // one display frame then enters the genuine countdown without delay.
      let measuredAt = Math.max(performance.now(), element.latestPoseTimestampMs + 1);
      const deadline = performance.now() + 14000;
      while (performance.now() < deadline && !harness.graph.input.getSnapshot().calibration.calibrationId) {
        measuredAt = Math.max(performance.now(), measuredAt + 1000 / 15, element.latestPoseTimestampMs + 1);
        harness.feedPose({ tPose: true, legs, timestampMs: measuredAt, render: false });
        await new Promise(resolve => setTimeout(resolve, 35));
      }
      check(harness.graph.input.getSnapshot().calibration.calibrationId != null, 'measured two-second hold commits');
      element.runDisplayFrame();
      const countdown = harness.graph.gameplay.getSnapshot();
      check(countdown.session.state === 'countdown' && countdown.countdown.value === 3, 'countdown begins without delayed gameplay');
      check(!shown() && !transport.hidden && getComputedStyle(scoreHud).display !== 'none', 'countdown immediately restores transport and Combo HUD');
      check(root.querySelector('[data-role="transient-cue"]').textContent === '3', 'countdown cue takes precedence over Release without invented complete frame');
      await harness.calibrate();
      check(!shown() && root.querySelector('[data-role="transient-cue"]').textContent === '', 'normal gameplay hides card and cue');
      await element.startSession('visual_test', { requireDownloaded: false });
      element.stopFrameLoop(); element.setMenuOpen(false, { freshSession: true }); element.runDisplayFrame();
      check(!shown() && !transport.hidden && getComputedStyle(scoreHud).display !== 'none', 'Visual Test retains transport and Combo HUD, no Play card');
      return { landmarkRows: 9, flicker: 'Seen → Missing → Seen', gameplay: 'hidden', visualTest: 'hidden' };
    } finally { harness.dispose(); }
  });
  assert.deepEqual(errors, [], 'connected Play page errors');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(document.querySelector('aero-game')?.graph), null, { timeout: 10000 });
  const flow = await game.evaluate(async element => {
    const { installScoredPlayHarness } = await import('/scripts/fixtures/scored-play-browser-harness.js');
    const event = { schema: 'aerobeat/resolved_content_event', version: 3, eventId: 'flow-checklist-beat', centerTimestampMs: 6000, sourceEventIds: ['source-flow-checklist-beat'], appearanceColor: '#2693FF', authoredBeat: { type: 'note', hand: 'left', placement: 5, requiresDirection: false } };
    const harness = await installScoredPlayHarness(element, { events: [event], mode: 'flow', songDurationMs: 10000 });
    try {
      await harness.waitForAssets(); await harness.selectChart(); await harness.startPlay();
      const card = element.shadowRoot.querySelector('[data-role="play-calibration-checklist"]');
      harness.feedPose({ tPose: true });
      let measuredAt = Math.max(performance.now(), element.latestPoseTimestampMs + 1);
      const deadline = performance.now() + 14000;
      while (performance.now() < deadline && harness.graph.input.getSnapshot().calibration.holdProgressMs < 800) {
        measuredAt = Math.max(performance.now(), measuredAt + 1000 / 15, element.latestPoseTimestampMs + 1);
        harness.feedPose({ tPose: true, timestampMs: measuredAt, render: false });
        await new Promise(resolve => setTimeout(resolve, 35));
      }
      element.runDisplayFrame();
      if (card.hidden || !card.querySelector('[data-checklist-mode]').textContent.includes('FLOW · KNEES NOT REQUIRED') ||
          card.querySelector('[data-checklist-subtitle]').textContent !== 'Upper-body landmarks only.' ||
          card.querySelector('[data-checklist-hold] .checklist-value').textContent !== 'Holding' ||
          !card.querySelector('[data-checklist-landmark="left_knee"]').hidden || !card.querySelector('[data-checklist-landmark="right_knee"]').hidden) throw Error('Flow measured hold checklist or knee omission deviates from approved state');
      return 'Flow hold subtitle and seven rows';
    } finally { harness.dispose(); }
  }, { timeout: 120000 });
  assert.deepEqual(errors, [], 'connected Play page errors');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(document.querySelector('aero-game')?.graph), null, { timeout: 10000 });
  const kneesOff = await game.evaluate(async element => {
    const { installScoredPlayHarness } = await import('/scripts/fixtures/scored-play-browser-harness.js');
    const event = { schema: 'aerobeat/resolved_content_event', version: 3, eventId: 'knees-off-checklist-beat', centerTimestampMs: 6000, sourceEventIds: ['source-knees-off-checklist-beat'], authoredBeat: { type: 'straight_left', spatialTarget: { targetCell: 5, acceptedSubcells: [20, 21, 22, 23] }, timingWindowMs: 180, evidenceFreshnessMs: 150 } };
    const harness = await installScoredPlayHarness(element, { events: [event], mode: 'boxing', songDurationMs: 10000 });
    try {
      await harness.waitForAssets(); await harness.selectChart(); await harness.setSetup({ kneeStrikesEnabled: false }); await harness.startPlay();
      const root = element.shadowRoot, card = root.querySelector('[data-role="play-calibration-checklist"]');
      if (card.hidden || !card.querySelector('[data-checklist-mode]').textContent.includes('BOXING · KNEE STRIKES OFF') ||
          !card.querySelector('[data-checklist-landmark="left_knee"]').hidden || !card.querySelector('[data-checklist-landmark="right_knee"]').hidden ||
          !root.querySelector('[data-role="visual-test-transport"]').hidden || getComputedStyle(root.querySelector('aero-flow-hud')).display !== 'none') throw Error('knee-disabled Boxer must show seven upper rows and hide calibration-only chrome');
      return 'knee-disabled Boxer seven rows';
    } finally { harness.dispose(); }
  });
  assert.deepEqual(errors, [], 'connected Play page errors');
  console.log(`ORACLE play-calibration-checklist-browser PASS ${JSON.stringify({ ...result, flow, kneesOff })}`);
  await page.close();
} finally { if (browser) await browser.close(); await vite.close(); }
