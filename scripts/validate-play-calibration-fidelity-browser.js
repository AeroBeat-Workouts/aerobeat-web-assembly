// @ts-check
// Revision-5 design truth versus genuinely connected configured-source Play.
// Run from assembly root: node scripts/validate-play-calibration-fidelity-browser.js
// Fixture replaces device transports only; never substitute the production presenter.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import { isExpectedReadPixelsWarning } from './readpixels-console-policy.js';

const root = resolve(import.meta.dirname, '..');
const design = resolve(root, '../aerobeat-web-ui/design/play-calibration-checklist.html');
const evidence = resolve(root, '.ui-fidelity/evidence/play-calibration-checklist');
const states = [
  ['phone-portrait-knee-flicker', 'knee-flicker', 390, 844, 'boxing'],
  ['phone-portrait-holding', 'holding', 390, 844, 'boxing'],
  ['phone-portrait-countdown', 'countdown', 390, 844, 'boxing'],
  ['phone-portrait-flow', 'flow', 390, 844, 'flow'],
  ['phone-portrait-boxing-knees-off', 'boxing-knees-off', 390, 844, 'knees-off'],
  ['desktop-knee-flicker', 'knee-flicker', 1440, 900, 'boxing'],
  ['desktop-holding', 'holding', 1440, 900, 'boxing'],
  ['desktop-countdown', 'countdown', 1440, 900, 'boxing'],
  ['phone-landscape-knee-flicker', 'knee-flicker', 844, 390, 'boxing'],
  ['phone-landscape-flow', 'flow', 844, 390, 'flow']
];
const freeze = '* { animation: none !important; transition: none !important; scroll-behavior: auto !important; }';
const tokenProps = ['color', 'background-color', 'border-top-color', 'border-radius', 'font-family', 'font-size', 'font-weight', 'width', 'height', 'padding-top', 'padding-left'];
const mappings = {
  cue: ['.cue', '[data-role="transient-cue"]'], card: ['.panel', '[data-role="play-calibration-checklist"]'],
  title: ['.panel h1', '[data-role="play-calibration-checklist-title"]'],
  mode: ['.eyebrow', '[data-checklist-mode]'],
  row: ['.row', '.checklist-row:not([hidden])'],
  rowName: ['.row > span:nth-child(2)', '.checklist-row:not([hidden]) .checklist-name'],
  rowValue: ['.row .value', '.checklist-row:not([hidden]) .checklist-value'],
  hold: ['#pose .row:last-child', '[data-checklist-hold]']
};
const legPoints = { left: { hip: { x: .43, y: .68 }, knee: { x: .43, y: .8 }, ankle: { x: .43, y: .93 } }, right: { hip: { x: .57, y: .68 }, knee: { x: .57, y: .8 }, ankle: { x: .57, y: .93 } } };
const events = {
  boxing: { schema: 'aerobeat/resolved_content_event', version: 3, eventId: 'checklist-knee-beat', centerTimestampMs: 6000, sourceEventIds: ['source-checklist-beat'], authoredBeat: { type: 'knee_left', spatialTarget: { targetCell: 9, acceptedSubcells: [36, 37, 38, 39] }, timingWindowMs: 180, evidenceFreshnessMs: 150 } },
  'knees-off': { schema: 'aerobeat/resolved_content_event', version: 3, eventId: 'checklist-guard-beat', centerTimestampMs: 6000, sourceEventIds: ['source-checklist-beat'], authoredBeat: { type: 'guard', guardTarget: { leftCell: 5, rightCell: 6, sourcePair: [5, 6] } } },
  flow: { schema: 'aerobeat/resolved_content_event', version: 3, eventId: 'checklist-flow-beat', centerTimestampMs: 6000, sourceEventIds: ['source-checklist-beat'], authoredBeat: { type: 'note', hand: 'left', placement: 5, requiresDirection: false } }
};

async function settle(page) {
  await page.addStyleTag({ content: freeze });
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
}
const overlaps = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const normalizeColor = value => {
  const m = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(value);
  if (!m) return value.toLowerCase();
  return `#${[1, 2, 3].map(i => Number(m[i]).toString(16).padStart(2, '0')).join('')}${m[4] === undefined ? '' : Math.round(Number(m[4]) * 255).toString(16).padStart(2, '0')}`;
};
function parity(mockup, real, property) {
  if (property.includes('color')) return { pass: normalizeColor(mockup) === normalizeColor(real), tolerance: 'exact-hex' };
  if (property === 'font-family') return { pass: mockup.split(',')[0].trim() === real.split(',')[0].trim(), tolerance: 'family; rendered fallback recorded' };
  if (mockup === real) return { pass: true, tolerance: property === 'font-weight' ? 'exact' : '±1px' };
  const a = /^(-?[\d.]+)px$/.exec(mockup), b = /^(-?[\d.]+)px$/.exec(real);
  return { pass: Boolean(a && b && Math.abs(Number(a[1]) - Number(b[1])) <= 1), tolerance: '±1px' };
}
async function observe(page, reference) {
  return page.evaluate(({ reference, mappings, tokenProps }) => {
    const root = reference ? document : document.querySelector('aero-game')?.shadowRoot;
    if (!root) throw Error('connected real game shadow root missing');
    const pick = selector => root.querySelector(selector);
    const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const card = pick(reference ? '.panel' : '[data-role="play-calibration-checklist"]');
    const cue = pick(reference ? '.cue' : '[data-role="transient-cue"]');
    const rows = [...root.querySelectorAll(reference ? '.row' : '.checklist-row:not([hidden])')];
    const tokens = Object.fromEntries(Object.entries(mappings).map(([name, selectors]) => {
      const node = pick(selectors[reference ? 0 : 1]);
      if (!node || node.hidden || getComputedStyle(node).display === 'none') return [name, null];
      const css = getComputedStyle(node);
      return [name, Object.fromEntries(tokenProps.map(prop => [prop, css.getPropertyValue(prop).trim()]))];
    }));
    return { bodyLength: document.body?.textContent?.length ?? 0, card: box(card), cue: box(cue), menu: box(pick(reference ? '.menu' : '.menu-button')), visible: Boolean(card && !card.hidden && getComputedStyle(card).display !== 'none'), cueText: reference ? pick('#cueText')?.textContent?.trim() : cue?.textContent?.trim(), mode: pick(reference ? '#mode' : '[data-checklist-mode]')?.textContent?.trim(), subtitle: pick(reference ? '#subtitle' : '[data-checklist-subtitle]')?.textContent?.trim(), detail: pick(reference ? '#detail' : '[data-checklist-detail]')?.textContent?.trim(), elapsed: pick(reference ? '#elapsed' : '[data-checklist-elapsed]')?.textContent?.trim(),
      rows: rows.map(row => ({ label: row.querySelector(reference ? 'span:nth-child(2)' : '.checklist-name')?.textContent?.trim(), value: row.querySelector(reference ? '.value' : '.checklist-value')?.textContent?.trim() })), tokens };
  }, { reference, mappings, tokenProps });
}

// Capture and token extraction use the SAME page load. Browser canvas decodes
// both PNGs and emits diff/composite PNGs without adding a package dependency.
// Only the synthetic scene/camera OUTSIDE the union of both cue/card rectangles
// is masked; every card and cue pixel, including their backgrounds, is compared.
async function diffOnCapturedPage(page, reference, real, referenceBoxes, realBoxes) {
  return page.evaluate(async ({ reference, real, referenceBoxes, realBoxes }) => {
    const decode = async bytes => { const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bitmap, 0, 0); bitmap.close(); return ctx.getImageData(0, 0, canvas.width, canvas.height); };
    const a = await decode(reference), b = await decode(real);
    if (a.width !== b.width || a.height !== b.height) throw Error('reference and real PNG dimensions differ');
    const { width, height } = a; const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); const out = ctx.createImageData(width, height), marks = new Uint8Array(width * height);
    const boxes = [referenceBoxes.card, referenceBoxes.cue, realBoxes.card, realBoxes.cue].filter(Boolean);
    const inside = (x, y) => boxes.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    let compared = 0, differing = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x, p = i * 4;
      if (!inside(x, y)) { out.data[p + 3] = 255; continue; }
      compared++;
      if ([0, 1, 2, 3].some(channel => Math.abs(a.data[p + channel] - b.data[p + channel]) > 4)) { marks[i] = 1; differing++; out.data[p] = 255; out.data[p + 3] = 255; }
      else { out.data[p] = a.data[p]; out.data[p + 1] = a.data[p + 1]; out.data[p + 2] = a.data[p + 2]; out.data[p + 3] = 255; }
    }
    if (!compared) throw Error('cue/card comparison has zero pixels');
    const regions = [], visited = new Uint8Array(marks.length);
    for (let start = 0; start < marks.length; start++) {
      if (!marks[start] || visited[start]) continue;
      const stack = [start]; visited[start] = 1; let minX = width, maxX = 0, minY = height, maxY = 0, pixels = 0;
      while (stack.length) { const at = stack.pop(), x = at % width, y = Math.floor(at / width); pixels++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        for (const next of [x ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y ? at - width : -1, y < height - 1 ? at + width : -1]) if (next >= 0 && marks[next] && !visited[next]) { visited[next] = 1; stack.push(next); }
      }
      if (pixels > 2) regions.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixels, percent: Number((100 * pixels / compared).toFixed(4)) });
    }
    regions.sort((x, y) => y.pixels - x.pixels);
    ctx.putImageData(out, 0, 0);
    const composite = document.createElement('canvas'); composite.width = width * 3 + 16; composite.height = height; const cc = composite.getContext('2d');
    const paste = async (bytes, x) => { const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })); cc.drawImage(bitmap, x, 0); bitmap.close(); };
    await paste(reference, 0); await paste(real, width + 8); cc.drawImage(canvas, width * 2 + 16, 0);
    const png = async surface => [...new Uint8Array(await (await new Promise(done => surface.toBlob(done, 'image/png'))).arrayBuffer())];
    return { metric: { percent: Number((100 * differing / compared).toFixed(4)), differing, compared, masked: width * height - compared, regions }, diff: await png(canvas), composite: await png(composite) };
  }, { reference: [...reference], real: [...real], referenceBoxes, realBoxes });
}

async function drive(page, state, mode) {
  await page.locator('aero-game').waitFor({ state: 'attached' });
  await page.waitForFunction(() => Boolean(document.querySelector('aero-game')?.graph), { timeout: 20000 });
  return page.locator('aero-game').evaluate(async (element, { state, mode, legPoints, event }) => {
    const { installScoredPlayHarness } = await import('/scripts/fixtures/scored-play-browser-harness.js');
    const harness = await installScoredPlayHarness(element, { events: [event], mode: mode === 'flow' ? 'flow' : 'boxing', kneeRuleset: mode === 'boxing', songDurationMs: 10000 });
    const card = () => element.shadowRoot.querySelector('[data-role="play-calibration-checklist"]');
    const cue = () => element.shadowRoot.querySelector('[data-role="transient-cue"]');
    const require = (condition, message) => { if (!condition) throw Error(`${state}: ${message}`); };
    await harness.waitForAssets(); await harness.selectChart();
    if (mode === 'knees-off') await harness.setSetup({ kneeStrikesEnabled: false });
    await harness.startPlay(); require(!card()?.hidden, 'checklist missing in connected Play');
    const feed = (legs, render = true, tPose = true) => harness.feedPose({ tPose, legs, render });
    let countdownFrame = null;
    if (state === 'knee-flicker') {
      // The display must reset a partially accumulated hold, not just show
      // Missing before the hold ever starts.
      feed(legPoints);
      let timestamp = Math.max(performance.now(), Number(element.latestPoseTimestampMs || 0) + 1);
      const deadline = performance.now() + 8000;
      while (performance.now() < deadline && (harness.graph.input.getSnapshot().calibration.holdProgressMs || 0) < 400) {
        timestamp = Math.max(performance.now(), timestamp + 1000 / 15, Number(element.latestPoseTimestampMs || 0) + 1);
        harness.feedPose({ tPose: true, legs: legPoints, timestampMs: timestamp, render: false });
        await new Promise(done => setTimeout(done, 35));
      }
      require((harness.graph.input.getSnapshot().calibration.holdProgressMs || 0) >= 400, 'measured partial hold never started');
      feed({ left: legPoints.left });
      require(card().querySelector('[data-checklist-landmark="right_knee"] .checklist-value')?.textContent === 'Missing', 'right knee confidence loss not shown');
      require(card().querySelector('[data-checklist-hold] .checklist-value')?.textContent === 'Waiting' && !harness.graph.input.getSnapshot().calibration.calibrationId, 'knee flicker must reset hold');
      feed(legPoints); require(card().querySelector('[data-checklist-landmark="right_knee"] .checklist-value')?.textContent === 'Seen', 'right knee must recover from measured pose');
      feed({ left: legPoints.left });
      require(card().querySelector('[data-checklist-hold] .checklist-value')?.textContent === 'Waiting', 'second knee flicker must reset hold');
    } else if (state === 'holding' || state === 'countdown' || state === 'flow') {
      feed(mode === 'flow' ? null : legPoints);
      let timestamp = Math.max(performance.now(), Number(element.latestPoseTimestampMs || 0) + 1);
      const counted = state === 'countdown';
      const goal = counted ? 2000 : state === 'flow' ? 800 : 1200;
      const deadline = performance.now() + 14000;
      while (performance.now() < deadline) {
        timestamp = Math.max(performance.now(), timestamp + 1000 / 15, Number(element.latestPoseTimestampMs || 0) + 1);
        const sample = harness.feedPose({ tPose: true, legs: mode === 'flow' ? null : legPoints, timestampMs: timestamp, render: false }).input;
        if (counted ? sample.calibration.calibrationId != null : sample.calibration.holdProgressMs >= goal && sample.calibration.calibrationId == null) break;
        await new Promise(done => setTimeout(done, 35));
      }
      const input = harness.graph.input.getSnapshot();
      require(counted ? input.calibration.calibrationId != null : input.calibration.holdProgressMs >= goal && input.calibration.calibrationId == null, 'target measured hold not reached');
      if (counted) {
        // Approved revision 4 keeps the immediate countdown: the measured
        // commit and the native first cue land in the same display frame, so
        // there is no Complete screen to capture and none is fabricated.
        timestamp = Math.max(performance.now(), timestamp + 1000 / 15, Number(element.latestPoseTimestampMs || 0) + 1);
        harness.feedPose({ tPose: true, legs: legPoints, timestampMs: timestamp });
        const gameplay = harness.graph.gameplay.getSnapshot();
        countdownFrame = { cue: cue()?.textContent?.trim() ?? null, cardHidden: card()?.hidden ?? null, gameplayState: gameplay.session?.state ?? null, countdown: gameplay.countdown?.value ?? null };
        require(countdownFrame.cue === '3' && countdownFrame.cardHidden === true, `native countdown did not own the frame after commit: ${JSON.stringify(countdownFrame)}`);
      } else element.runDisplayFrame();
    } else if (mode === 'knees-off') feed(null, true, false);
    const session = harness.graph.gameplay.getSnapshot().session;
    require(session.purpose === 'play' && !element.lastError && (state === 'countdown' || !card().hidden), 'capture is not real connected Play calibration');
    require(!card().textContent.includes('Both knees must') && !card().textContent.includes('Visible'), 'revision-5 copy missing');
    require(card().querySelectorAll('[data-checklist-landmark]:not([hidden])').length === (mode === 'boxing' ? 9 : 7), 'mode knee-row count incorrect');
    const input = harness.graph.input.getSnapshot();
    const summary = { session: session.state, calibration: input.calibration.state, holdProgressMs: input.calibration.holdProgressMs, committed: input.calibration.calibrationId != null, kneeRequired: mode === 'boxing', ...(countdownFrame ? { countdownFrame } : {}) };
    window.__qaHarness = harness;
    window.__qaCleanupPlay = () => { harness.dispose(); delete window.__qaHarness; };
    return summary;
  }, { state, mode, legPoints, event: events[mode] });
}

async function main() {
  await mkdir(evidence, { recursive: true });
  const report = { schema: 'ui-fidelity-report/v1', generated_at: new Date().toISOString(), design_truth: { revision: 5, commit: '7385163c89c387325315263bdd696690bbc771f4', file: design }, build: 'configured Vite source, connected scored Play; not signed or physical', viewports: { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 }, desktop: { width: 1440, height: 900 } }, states: [], overall_verdict: 'INVALID' };
  const vite = await createViteServer({ appType: 'spa', configFile: 'vite.config.js', logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  let browser;
  try {
    await vite.listen(); const url = vite.resolvedUrls?.local?.[0]; assert(url, 'configured Vite URL missing');
    browser = await chromium.launch({ headless: true });
    for (const [name, state, width, height, mode] of states) {
      const entry = { state: name, tier: 'structural', viewport: { width, height }, artifacts: {}, tokens: [], pixel_diff: null, residual_deltas: [], verdict: 'INVALID' };
      report.states.push(entry);
      const folder = join(evidence, name); await mkdir(folder, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      try {
        const reference = await context.newPage(), real = await context.newPage(), noise = [];
        const mockupUrl = `${pathToFileURL(design)}?state=${state}`;
        for (const [side, page] of [['reference', reference], ['real', real]]) {
          const expectedUrl = side === 'real' ? url : mockupUrl;
          // Warn-visible collection: only the exact managed-browser ReadPixels
          // warning for this page is admitted, nothing filtered to error-only.
          page.on('pageerror', e => noise.push({ side, kind: 'pageerror', message: e.message, stack: e.stack }));
          page.on('console', msg => {
            const type = msg.type(), text = msg.text(), location = msg.location();
            if (!['warning', 'error'].includes(type)) return;
            if (isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, expectedUrl)) return;
            noise.push({ side, kind: 'console', type, text, sourceUrl: location.url });
          });
          page.on('requestfailed', request => noise.push({ side, kind: 'requestfailed', url: request.url(), reason: request.failure()?.errorText ?? 'unknown' }));
        }
        await reference.goto(mockupUrl, { waitUntil: 'load' });
        await real.goto(url, { waitUntil: 'networkidle' });
        // A module parse/import error must invalidate this capture immediately:
        // do not wait for a graph timeout or report a UI mismatch for blank Play.
        if (noise.length) throw Error(`paired page startup noise: ${JSON.stringify(noise)}`);
        try { entry.drive = await drive(real, state, mode); }
        catch (error) { throw Error(`real Play drive failed: ${error.stack || error}; browser noise: ${JSON.stringify(noise)}`); }
        await settle(reference); await settle(real);
        const expected = await observe(reference, true), actual = await observe(real, false);
        assert.deepEqual(noise, [], `paired page/import/console noise: ${JSON.stringify(noise)}`);
        assert(expected.bodyLength > 0 && actual.bodyLength > 0 && expected.card && actual.card, 'blank/wrong-page guard');
        const countdown = state === 'countdown';
        if (countdown) {
          // Revision 4 design truth: after the measured 2 second hold the real
          // Play shell shows the native cue in the same display frame and the
          // checklist never paints. The approved reference hides the panel too.
          const frame = entry.drive.countdownFrame;
          assert(frame, 'missing native post-commit countdown frame');
          if (actual.visible) throw Error('real checklist still painted during the native countdown');
          if (expected.visible) throw Error('approved countdown reference must hide the checklist');
          if (frame.cue !== '3') entry.residual_deltas.push({ class: 'structural', description: `native first countdown cue: expected 3, drive observed ${frame.cue}` });
          if (frame.cardHidden !== true) entry.residual_deltas.push({ class: 'structural', description: `checklist must be absent at countdown; cardHidden=${frame.cardHidden}` });
          if (actual.cueText !== expected.cueText) entry.residual_deltas.push({ class: 'structural', description: `countdown cue text: approved ${expected.cueText}, real ${actual.cueText}` });
        } else if (!actual.visible) throw Error('real checklist hidden before approved capture state');
        if (!countdown) {
          assert.deepEqual(actual.rows.map(row => row.label), expected.rows.map(row => row.label), 'approved row names and order');
          assert.equal(actual.rows.length, mode === 'boxing' ? 12 : 10, 'knee-dependent row count');
          assert.equal(actual.mode, expected.mode, 'mode/0%-chance label');
          if (actual.cueText !== expected.cueText) entry.residual_deltas.push({ class: 'structural', description: `cue text: approved ${expected.cueText}, real ${actual.cueText}` });
          for (const field of ['subtitle', 'detail', 'elapsed']) if (actual[field] !== expected[field]) entry.residual_deltas.push({ class: 'structural', description: `${field}: approved ${expected[field]}, real ${actual[field]}` });
          for (let i = 0; i < actual.rows.length; i++) if (actual.rows[i].value !== expected.rows[i].value) entry.residual_deltas.push({ class: 'structural', description: `${actual.rows[i].label} status: approved ${expected.rows[i].value}, real ${actual.rows[i].value}` });
          if (state === 'knee-flicker') assert.equal(actual.rows.find(row => row.label === 'Right Knee')?.value, 'Missing', 'missing knee after flicker');
          if (state === 'holding' || state === 'flow') assert.equal(actual.rows.at(-1)?.value, 'Holding', 'measured hold not displayed');
        }
        for (const rect of [actual.card, actual.menu]) assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= width && rect.y + rect.h <= height, 'card/menu outside viewport');
        assert.equal(overlaps(actual.card, actual.menu), 0, 'card overlaps menu');
        for (const [name, refRect, realRect] of [['card', expected.card, actual.card], ['cue', expected.cue, actual.cue]]) {
          if (refRect && realRect) for (const axis of ['x', 'y', 'w', 'h']) if (Math.abs(refRect[axis] - realRect[axis]) > 1) entry.residual_deltas.push({ class: 'structural', description: `${name} geometry ${axis}: approved ${refRect[axis].toFixed(2)}px, real ${realRect[axis].toFixed(2)}px` });
        }
        if (height <= 390) {
          const transport = await real.locator('aero-game').evaluate(element => { const node = element.shadowRoot.querySelector('[data-role="visual-test-transport"]'); if (!node || getComputedStyle(node).display === 'none') return []; const r = node.getBoundingClientRect(); return [{ className: 'visual-test-transport', rect: { x: r.x, y: r.y, w: r.width, h: r.height } }]; });
          for (const item of transport) if (overlaps(actual.card, item.rect) > 0) entry.residual_deltas.push({ class: 'structural', description: `visible ${item.className} overlaps checklist by ${overlaps(actual.card, item.rect).toFixed(0)}px² in landscape` });
        }
        // The countdown state owns only the cue: the approved card and every row
        // are hidden in both reference and real, so comparing hidden artefacts
        // would fabricate deltas the design itself does not declare.
        for (const key of countdown ? ['cue'] : Object.keys(expected.tokens)) {
          const ref = expected.tokens[key], rendered = actual.tokens[key];
          if (!ref || !rendered) { entry.tokens.push({ selector: key, property: '(element)', mockup: ref ? 'present' : 'MISSING', real: rendered ? 'present' : 'MISSING', tolerance: 'exact', pass: false }); continue; }
          for (const property of tokenProps) { const check = parity(ref[property], rendered[property], property); entry.tokens.push({ selector: key, property, mockup: ref[property], real: rendered[property], tolerance: check.tolerance, pass: check.pass }); }
        }
        // Freeze, fonts and state assertions precede screenshots; extraction
        // above and screenshot below both operate on these same page loads.
        const refPng = await reference.screenshot(), realPng = await real.screenshot();
        const pixels = await diffOnCapturedPage(real, refPng, realPng, expected, actual);
        const files = { reference: join(folder, 'reference.png'), real: join(folder, 'real.png'), diff: join(folder, 'diff.png'), side_by_side: join(folder, 'side-by-side.png') };
        await Promise.all([writeFile(files.reference, refPng), writeFile(files.real, realPng), writeFile(files.diff, Buffer.from(pixels.diff)), writeFile(files.side_by_side, Buffer.from(pixels.composite))]);
        entry.artifacts = files; entry.pixel_diff = pixels.metric;
        for (const token of entry.tokens.filter(token => !token.pass)) entry.residual_deltas.push({ class: token.tolerance.startsWith('exact') ? 'structural' : 'below-tier', description: `${token.selector} ${token.property}: mockup ${token.mockup}, real ${token.real}` });
        // Explicit approval states remain INVALID while their required
        // content differs, even when all four PNGs exist. Do not call them
        // passing fidelity on the strength of matching boxes and raw pixels.
        if ((state === 'countdown' || state === 'flow') && entry.residual_deltas.some(delta => delta.class === 'structural')) entry.contract_state = 'INVALID';
        // A large raw region is not a structural assertion: native scenery
        // remains visible THROUGH the approved translucent card, and masking
        // that region would also mask the card. Preserve every raw pixel and
        // region metric; classify scene-dependent appearance separately.
        // Hierarchy/geometry/copy/tokens above decide structural deviations.
        const sceneThroughCard = pixels.metric.regions.filter(region => region.pixels >= 400);
        for (const region of sceneThroughCard) entry.residual_deltas.push({ class: 'asset', description: `unmasked cue/card pixel region (${region.x},${region.y}) ${region.w}x${region.h}; ${region.percent}% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta` });
        entry.verdict = entry.contract_state === 'INVALID' ? 'INVALID' : entry.residual_deltas.some(delta => delta.class === 'structural') ? 'FAIL' : 'PASS';
        // Supplemental native lifecycle checks do not affect the paired state
        // pixels; use the same connected fixture, not a synthetic presenter.
        if (name === 'phone-portrait-countdown') {
          try { entry.lifecycle_checks = await real.locator('aero-game').evaluate(async element => {
            const root = element.shadowRoot, harness = window.__qaHarness;
            const card = root.querySelector('[data-role="play-calibration-checklist"]');
            const cue = root.querySelector('[data-role="transient-cue"]');
            const wait = ms => new Promise(done => setTimeout(done, ms));
            // The capture already holds the native first cue; finish the
            // authored countdown and prove the approved checklist never repaints.
            const values = [], deadline = performance.now() + 13000;
            let stamp = Math.max(performance.now(), Number(element.latestPoseTimestampMs || 0) + 1);
            while (performance.now() < deadline) {
              stamp = Math.max(performance.now(), stamp + 1000 / 15, Number(element.latestPoseTimestampMs || 0) + 1);
              harness.feedPose({ tPose: false, legs: null, timestampMs: stamp });
              const text = cue.textContent.trim();
              if (card.hidden !== true) throw Error(`checklist repainted during native countdown: ${JSON.stringify({ values, cue: text })}`);
              if (text && values.at(-1) !== text) values.push(text);
              if (!text && values.length) break;
              await wait(35);
            }
            if (!values.length || values.some(value => !['3', '2', '1'].includes(value))) throw Error(`native countdown gate: ${JSON.stringify({ values, cardHidden: card.hidden })}`);
            await element.startSession('visual_test', { requireDownloaded: false });
            element.stopFrameLoop(); element.setMenuOpen(false, { freshSession: true }); element.runDisplayFrame();
            if (!card.hidden || cue.textContent.trim()) throw Error('Visual Test shows Play checklist or calibration cue');
            return { countdown: values, countdownCardHidden: true, visualTestCardHidden: true, visualTestCueHidden: true };
          }); } catch (error) { entry.lifecycle_checks = { error: error.message }; entry.residual_deltas.push({ class: 'capture-issue', description: `supplemental Test/countdown lifecycle not proven: ${error.message}` }); entry.verdict = 'INVALID'; }
        }
        await real.evaluate(() => window.__qaCleanupPlay?.());
        console.log(`${name}: ${entry.verdict}; ${pixels.metric.percent}% (${pixels.metric.regions.length} regions)`);
      } catch (error) {
        entry.verdict = 'INVALID'; entry.artifacts = {}; entry.tokens = []; entry.pixel_diff = null;
        entry.residual_deltas.push({ class: 'capture-issue', description: `${error.stack || error.message}; reference=${pathToFileURL(design)}?state=${state}; real=configured Vite source; genuine paired state and complete artifacts not established` });
        console.error(`${name}: INVALID: ${error.message}`);
      } finally { await context.close(); }
    }
  } finally { if (browser) await browser.close(); await vite.close(); }
  report.overall_verdict = report.states.some(state => state.verdict === 'INVALID') ? 'INVALID' : report.states.some(state => state.verdict === 'FAIL') ? 'FAIL' : 'PASS';
  await writeFile(join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const lines = ['# Approved revision-5 checklist versus connected Play', '', `Overall: **${report.overall_verdict}**. This is configured source Play, never signed private/public acceptance.`, 'Reference and real captured with one Chromium on the same host at DPR 1, fonts ready, animation frozen. Scene/camera outside the card/cue union is masked, never the card. Artifacts are written beside this report and regenerate by rerunning `node scripts/validate-play-calibration-fidelity-browser.js`.', ''];
  for (const item of report.states) {
    lines.push(`## ${item.state}: ${item.verdict}`, '', `Difference: ${item.pixel_diff?.percent ?? 'INVALID'}%; regions: ${item.pixel_diff?.regions.length ?? 'INVALID'}.`, `Artifacts: ${JSON.stringify(item.artifacts)}`, '', '| Selector | Property | Reference | Real | Tolerance | Pass |', '| --- | --- | --- | --- | --- | --- |');
    for (const row of item.tokens) lines.push(`| ${row.selector} | ${row.property} | ${row.mockup} | ${row.real} | ${row.tolerance} | ${row.pass ? 'PASS' : 'FAIL'} |`);
    lines.push('', 'Residual deltas:', ...(item.residual_deltas.length ? item.residual_deltas.map(delta => `- [${delta.class}] ${delta.description}`) : ['- None.']), '');
  }
  await writeFile(join(evidence, 'report.md'), lines.join('\n') + '\n');
  console.log(`Overall ${report.overall_verdict}; ${join(evidence, 'report.json')}`);
  if (report.overall_verdict !== 'PASS') process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
