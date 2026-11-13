// Measure time to first paint and time to body-tracker-ready, cold and warm.
//
//   node design/attract-flow/verify/timing.mjs <baseUrl> [runs] [throttleBytesPerSec]
//
// cold = new browser profile (empty HTTP cache and empty Cache Storage)
// warm = reload in the same profile after a full load (tracker files come from Cache Storage)
// Also measures the returning-player pass-through: Start click -> practice target on screen,
// with camera permission already granted and the tracker cached.

import pw from '/home/derrick/.local/share/agent-orchestration-machine/npm-global/lib/node_modules/playwright/index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5791';
const runs = Number(process.argv[3] ?? 3);
const throttle = process.argv[4] ? Number(process.argv[4]) : null;
const url = `${base}/design/attract-flow/index.html`;
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];

async function measure(page) {
  await page.waitForFunction(() => window.__attract?.timings?.poseReady, null, { timeout: 120000, polling: 50 });
  return page.evaluate(() => {
    const t = window.__attract.timings;
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    return { fcp: Math.round(fcp ?? -1), firstFrame: t.firstFrame, fontReady: t.fontReady, poseStart: t.poseStart, poseReady: t.poseReady, stages: window.__attract.pose.timings, cacheHits: window.__attract.pose.fromCache };
  });
}
async function throttleIt(context, page) {
  if (!throttle) return;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 30, downloadThroughput: throttle, uploadThroughput: throttle });
}

const rows = [];
for (let i = 0; i < runs; i += 1) {
  const dir = await mkdtemp(join(tmpdir(), 'af-timing-'));
  const context = await pw.chromium.launchPersistentContext(dir, { channel: 'chromium', args, viewport: { width: 1600, height: 1000 } });
  await context.grantPermissions(['camera'], { origin: base });
  const page = context.pages()[0] ?? await context.newPage();
  await throttleIt(context, page);
  await page.goto(url);
  const cold = await measure(page);
  await page.waitForTimeout(500);
  await page.reload();
  const warm = await measure(page);
  // Returning player: click Start, time until the practice target is live.
  const r = await page.evaluate(() => window.__attract.targets().start);
  const clickAt = await page.evaluate(() => performance.now());
  await page.mouse.click((r.left + r.right) / 2, (r.top + r.bottom) / 2);
  await page.waitForFunction(() => window.__attract.phase === 'phase3', null, { timeout: 20000, polling: 20 });
  const pass = await page.evaluate((c) => ({ clickToPhase3: Math.round(window.__attract.timings.phase3 - c), warmupShown: !!window.__attract.warmupShown }), clickAt);
  rows.push({ cold, warm, pass });
  console.log(JSON.stringify({ run: i + 1, cold, warm, pass }));
  await context.close();
  await rm(dir, { recursive: true, force: true });
}
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const pick = (k, f) => med(rows.map((r) => f(r[k])));
console.log(`\nmedian of ${runs}${throttle ? ` at ${(throttle * 8 / 1e6).toFixed(0)} Mbit/s` : ' (localhost, unthrottled)'}:`);
console.log(`cold: first contentful paint ${pick('cold', (x) => x.fcp)} ms, first frame ${pick('cold', (x) => x.firstFrame)} ms, tracker ready ${pick('cold', (x) => x.poseReady)} ms`);
console.log(`warm: first contentful paint ${pick('warm', (x) => x.fcp)} ms, first frame ${pick('warm', (x) => x.firstFrame)} ms, tracker ready ${pick('warm', (x) => x.poseReady)} ms (cache hits ${rows[0].warm.cacheHits}/4)`);
console.log(`returning player: Start click -> practice target ${med(rows.map((r) => r.pass.clickToPhase3))} ms, warm-up shown: ${rows.some((r) => r.pass.warmupShown)}`);
