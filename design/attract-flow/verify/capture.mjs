// Capture every phase and problem state of the attract flow with headless Chromium.
//
//   node design/attract-flow/verify/capture.mjs <baseUrl> <fixturesDir> [only]
//
// baseUrl:     where the assembly repo root is served (Vite: node_modules/.bin/vite --host 0.0.0.0 --port 5791)
// fixturesDir: folder with person.y4m, black.y4m, frozen.y4m (see verify/make-fixtures.sh)
// only:        optional comma list of scenario names
//
// Writes PNGs to design/attract-flow/shots/ and a JSON summary to shots/capture-results.json.
// Exits non-zero if a scenario misses its expected state or the page throws.

import pw from '/home/derrick/.local/share/agent-orchestration-machine/npm-global/lib/node_modules/playwright/index.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'shots');
const base = process.argv[2] ?? 'http://127.0.0.1:5791';
const fx = process.argv[3] ?? '/tmp/af';
const only = process.argv[4]?.split(',');
const lanBase = process.env.LAN_BASE; // e.g. http://192.168.0.123:5791 for the insecure-context case
const PAGE = '/design/attract-flow/index.html';
await mkdir(out, { recursive: true });

const results = [];
let failed = false;

const FAKE = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];

async function open({ args = FAKE, init = null, ua = null, throttle = null, query = '?fresh', origin = base } = {}) {
  const browser = await pw.chromium.launch({ channel: 'chromium', args });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ...(ua ? { userAgent: ua } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/TensorFlow Lite XNNPACK/.test(m.text())) errors.push(m.text()); });
  if (init) await page.addInitScript(init);
  if (throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: throttle, uploadThroughput: throttle });
  }
  await page.goto(`${origin}${PAGE}${query}`);
  await page.waitForFunction(() => window.__attract?.timings?.fontReady && window.__attract?.timings?.firstFrame, null, { timeout: 20000 });
  return { browser, page, errors };
}
const state = (page) => page.evaluate(() => {
  const a = window.__attract;
  return { phase: a.phase, problem: a.problem, notice: a.notice, pose: a.pose?.stage, loaded: a.pose?.loaded, total: a.pose?.total, audio: a.audio, fullscreen: a.fullscreen, xr: a.xr, permission: a.permission, warmupShown: !!a.warmupShown, cameras: a.cameras?.map((c) => c.label), camera: a.camera?.label, arm: a.arm, selected: a.selected, health: a.health, timings: a.timings, cameraError: a.cameraError };
});
async function clickTarget(page, name) {
  const r = await page.evaluate((n) => window.__attract.targets()[n], name);
  if (!r) throw new Error(`target ${name} not on screen`);
  await page.mouse.click((r.left + r.right) / 2, (r.top + r.bottom) / 2);
}
const shot = (page, name) => page.screenshot({ path: join(out, `${name}.png`) });
const until = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });

const scenarios = {
  // Phase 1 while the tracker is still downloading (throttled to ~16 Mbit/s so the bar is mid-way).
  async 'phase1-loading'() {
    const { browser, page, errors } = await open({ throttle: 2_000_000 });
    await until(page, () => (window.__attract.pose?.loaded ?? 0) > 5e6, null, 30000);
    await page.waitForTimeout(300);
    await shot(page, '01-phase1-loading');
    // Poke the toys with the mouse.
    await page.mouse.move(240, 530); await page.waitForTimeout(120);
    await page.mouse.down(); await page.mouse.up();
    await page.mouse.move(1300, 520, { steps: 4 }); await page.waitForTimeout(140);
    await shot(page, '02-phase1-toys-poked');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.phase === 'phase1' && s.pose === 'download' };
  },

  // Desktop with WebXR: webcam flow stays, small "Play in VR" target appears.
  async 'phase1-desktop-xr'() {
    const init = () => { Object.defineProperty(navigator, 'xr', { value: Object.assign(new EventTarget(), { isSessionSupported: async (m) => m === 'immersive-vr' }) }); };
    const { browser, page, errors } = await open({ init });
    await until(page, () => window.__attract.xr !== 'unknown');
    await page.waitForTimeout(500);
    await shot(page, '03-phase1-desktop-xr');
    await clickTarget(page, 'vr');
    await page.waitForTimeout(400);
    const s = await state(page);
    const stub = await page.evaluate(() => window.__attract.vrStub);
    await browser.close();
    return { s, errors, ok: s.xr === 'desktop' && !!stub && s.phase === 'phase1' };
  },

  // Standalone headset: main target says "Enter VR".
  async 'phase1-headset'() {
    const init = () => { Object.defineProperty(navigator, 'xr', { value: Object.assign(new EventTarget(), { isSessionSupported: async (m) => m === 'immersive-vr' }) }); };
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.0 Chrome/128.0 VR Safari/537.36';
    const { browser, page, errors } = await open({ init, ua });
    await until(page, () => window.__attract.xr === 'headset');
    await page.waitForTimeout(500);
    await shot(page, '04-phase1-headset-enter-vr');
    await clickTarget(page, 'start');
    await page.waitForTimeout(300);
    const s = await state(page);
    const stub = await page.evaluate(() => window.__attract.vrStub);
    await browser.close();
    return { s, errors, ok: s.xr === 'headset' && !!stub && s.phase === 'phase1' };
  },

  // Real denial: no fake-UI flag, so headless Chromium denies the permission request.
  async 'camera-denied'() {
    const { browser, page, errors } = await open({ args: ['--use-fake-device-for-media-stream'] });
    await page.waitForTimeout(600);
    await shot(page, '00-phase1-first-visit'); // permission not yet asked: "Turn on camera"
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.problem);
    await page.waitForTimeout(500);
    await shot(page, '05-camera-blocked');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.problem === 'denied' };
  },

  // Prompt dismissed (permission still "prompt"): retry is meaningful, so the action is "Ask again".
  async 'camera-dismissed'() {
    const init = () => {
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission dismissed', 'NotAllowedError'); };
      const q = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = async (d) => (d?.name === 'camera' ? { state: 'prompt', addEventListener() {} } : q(d));
    };
    const { browser, page, errors } = await open({ init });
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.problem);
    await page.waitForTimeout(500);
    await shot(page, '06-camera-dismissed');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.problem === 'dismissed' };
  },

  // Site permission granted but getUserMedia still says NotAllowedError: the OS blocks the browser.
  async 'camera-os-blocked'() {
    const init = () => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied by system', 'NotAllowedError'); }; };
    const { browser, page, errors } = await open({ init });
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.problem);
    await page.waitForTimeout(500);
    await shot(page, '06b-camera-os-blocked');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.problem === 'osBlocked' };
  },

  async 'camera-not-found'() {
    const init = () => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Requested device not found', 'NotFoundError'); }; };
    const { browser, page, errors } = await open({ init });
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.problem);
    await page.waitForTimeout(500);
    await shot(page, '07-camera-not-found');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.problem === 'notFound' };
  },

  async 'camera-busy'() {
    const init = () => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Could not start video source', 'NotReadableError'); }; };
    const { browser, page, errors } = await open({ init });
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.problem);
    await page.waitForTimeout(500);
    await shot(page, '08-camera-busy');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.problem === 'busy' };
  },

  // Real insecure context: the same page over plain http on the LAN address.
  async 'camera-insecure'() {
    if (!lanBase) return { skipped: 'set LAN_BASE to run' };
    const { browser, page, errors } = await open({ origin: lanBase });
    await page.waitForTimeout(600);
    await shot(page, '09-camera-insecure');
    const s = await state(page);
    await browser.close();
    return { s, errors: errors.filter((e) => !/caches|Cache/.test(e)), ok: s.problem === 'insecure' };
  },

  async 'camera-unsupported'() {
    const init = () => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined }); };
    const { browser, page, errors } = await open({ init });
    await page.waitForTimeout(600);
    await shot(page, '10-camera-unsupported');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.problem === 'unsupported' };
  },

  // Touch only (phone in landscape): tap a toy, tap Start, tap Switch camera, tap a camera.
  async 'touch'() {
    const browser = await pw.chromium.launch({ channel: 'chromium', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream=device-count=2'] });
    const context = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}${PAGE}`);
    await until(page, () => window.__attract?.timings?.fontReady && window.__attract.pose?.stage === 'ready', null, 30000);
    const tap = async (name) => { const r = await page.evaluate((n) => window.__attract.targets()[n], name); await page.touchscreen.tap((r.left + r.right) / 2, (r.top + r.bottom) / 2); };
    const pad = await page.evaluate(() => window.__attract.designToScreen(240, 530));
    await page.touchscreen.tap(pad.x, pad.y);
    await page.waitForTimeout(150);
    await shot(page, '22-touch-phone-phase1');
    await tap('start');
    await until(page, () => window.__attract.phase === 'phase3', null, 15000);
    await page.waitForTimeout(900);
    await tap('switch');
    await until(page, () => window.__attract.chooserOpen);
    await page.waitForTimeout(400);
    await shot(page, '23-touch-phone-chooser');
    await tap('cam-1');
    await page.waitForTimeout(1200);
    const s = await state(page);
    const pokes = await page.evaluate(() => window.__attract.toyPokes ?? 0);
    await browser.close();
    return { s, pokes, errors, ok: pokes > 0 && s.camera === 'fake_device_1' };
  },

  // Phase 2: camera on while the tracker is still downloading. Warm-up prompt shows.
  async 'phase2-warmup'() {
    const { browser, page, errors } = await open({ args: [...FAKE, `--use-file-for-fake-video-capture=${fx}/person.y4m`], throttle: 1_500_000 });
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.phase === 'phase2');
    await page.waitForTimeout(2200);
    await shot(page, '11-phase2-warmup');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.phase === 'phase2' && s.warmupShown && s.audio === 'running' };
  },

  // Black feed during phase 2.
  async 'phase2-black'() {
    const { browser, page, errors } = await open({ args: [...FAKE, `--use-file-for-fake-video-capture=${fx}/black.y4m`], throttle: 1_000_000 });
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.problem === 'black', null, 15000);
    await page.waitForTimeout(500);
    await shot(page, '12-feed-black');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.problem === 'black' };
  },

  // Frozen feed (a one-frame file loops the same picture).
  async 'phase2-frozen'() {
    const { browser, page, errors } = await open({ args: [...FAKE, `--use-file-for-fake-video-capture=${fx}/frozen.y4m`], throttle: 1_000_000 });
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.problem === 'frozen', null, 15000);
    await page.waitForTimeout(500);
    await shot(page, '13-feed-frozen');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.problem === 'frozen' };
  },

  // Chromium's built-in test pattern: a live feed with no person, so tracking finds nobody.
  async 'phase3-nobody'() {
    const { browser, page, errors } = await open({ query: '' });
    await until(page, () => window.__attract.pose?.stage === 'ready', null, 30000);
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.problem === 'nobody', null, 15000);
    await page.waitForTimeout(500);
    await shot(page, '14-phase3-cant-see-you');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.phase === 'phase3' && s.problem === 'nobody' };
  },

  // Camera chooser with three fake devices; pick another one and check it is remembered.
  async 'chooser'() {
    const { browser, page, errors } = await open({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream=device-count=3'], query: '' });
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.phase === 'phase3' || window.__attract.phase === 'phase2', null, 30000);
    await page.waitForTimeout(800);
    await clickTarget(page, 'switch');
    await until(page, () => window.__attract.chooserOpen);
    await page.waitForTimeout(500);
    await shot(page, '15-camera-chooser');
    await clickTarget(page, 'cam-2');
    await page.waitForTimeout(1500);
    await shot(page, '16-camera-switched');
    const s = await state(page);
    const stored = await page.evaluate(() => localStorage.getItem('aerobeat.attract.cameraId'));
    await page.reload();
    await until(page, () => window.__attract?.timings?.firstFrame);
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.camera, null, 15000);
    const after = await state(page);
    await browser.close();
    return { s, after: after.camera, stored, errors, ok: s.camera === 'fake_device_2' && after.camera === 'fake_device_2' };
  },

  // Phase 3 with a recorded person: real MediaPipe tracking puts the wrist markers on the
  // athlete's wrists; when the athlete raises both hands the practice target arms and selects.
  async 'phase3-person'() {
    const { browser, page, errors } = await open({ args: [...FAKE, `--use-file-for-fake-video-capture=${fx}/person.y4m`], query: '' });
    await until(page, () => window.__attract.pose?.stage === 'ready', null, 30000);
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.phase === 'phase3');
    await page.waitForTimeout(900);
    await until(page, () => window.__attract.wrists.every(Boolean) && window.__attract.wrists[0].y > 450, null, 15000);
    await shot(page, '17-phase3-wrists');
    await until(page, () => (window.__attract.arm?.practice ?? 0) > 0.05, null, 20000);
    await shot(page, '18-phase3-arming');
    await until(page, () => window.__attract.phase === 'done', null, 10000);
    await page.waitForTimeout(700);
    await shot(page, '19-done-next-calibration');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.phase === 'done' && s.selected.includes('practice') };
  },

  // The tracker fails to download: phase 1 says so in the progress line, and after the
  // camera is on, a problem card offers a retry.
  async 'pose-failed'() {
    const browser = await pw.chromium.launch({ channel: 'chromium', args: FAKE });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/pose_landmarker_lite.task', (r) => r.abort());
    await page.goto(`${base}${PAGE}?fresh`);
    await until(page, () => window.__attract.pose?.stage === 'failed');
    await page.waitForTimeout(400);
    await shot(page, '20-phase1-tracker-failed');
    await clickTarget(page, 'start');
    await until(page, () => window.__attract.notice === 'pose-failed', null, 15000);
    await page.waitForTimeout(500);
    await shot(page, '21-phase2-tracker-failed');
    const s = await state(page);
    await browser.close();
    return { s, errors, ok: s.notice === 'pose-failed' };
  },
};

for (const [name, run] of Object.entries(scenarios)) {
  if (only && !only.includes(name)) continue;
  const started = Date.now();
  try {
    const r = await run();
    if (r.skipped) { console.log(`SKIP ${name}: ${r.skipped}`); results.push({ name, ...r }); continue; }
    const bad = !r.ok || r.errors.length;
    if (bad) failed = true;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${name} (${Date.now() - started} ms) ${JSON.stringify({ phase: r.s.phase, problem: r.s.problem, notice: r.s.notice, pose: r.s.pose, audio: r.s.audio, fullscreen: r.s.fullscreen, xr: r.s.xr })}${r.errors.length ? `\n     errors: ${r.errors.join(' | ')}` : ''}`);
    results.push({ name, ok: !bad, ...r });
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
    results.push({ name, ok: false, error: error.message });
  }
}
await writeFile(join(out, `capture-results${only ? '-partial' : ''}.json`), JSON.stringify(results, null, 2));
process.exit(failed ? 1 : 0);
