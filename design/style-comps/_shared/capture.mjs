// Capture a style comp the same way for every direction, so screenshots compare fairly.
//
//   node design/style-comps/_shared/capture.mjs <comp-folder-name>
//
// Serves design/ over HTTP (ES modules do not load from file://), opens the comp at
// 1600x1000, waits for window.__compReady, then writes into the comp folder:
//   shot-idle.png    the screen at rest
//   shot-arming.png  both simulated wrists on the "hero" target, mid-hold
//   shot-selected.png just after the hero target's selection fires
// It exits non-zero on page errors, a missing hero target, or a comp that never
// becomes ready, so a comp cannot pass by rendering a blank canvas.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/home/derrick/.local/share/agent-orchestration-machine/npm-global/lib/node_modules/playwright/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const designRoot = resolve(here, '../..');
const comp = process.argv[2];
if (!comp) { console.error('usage: capture.mjs <comp-folder-name>'); process.exit(2); }

const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(designRoot, path.endsWith('/') ? path + 'index.html' : path);
    if (!file.startsWith(designRoot)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const outDir = join(designRoot, 'style-comps', comp);
let failed = false;
try {
  await page.goto(`${base}/style-comps/${comp}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__compReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(1200); // let entrance motion settle
  await page.screenshot({ path: join(outDir, 'shot-idle.png') });

  const targets = await page.evaluate(() => window.__hands?.targetsOnScreen() ?? {});
  const names = Object.keys(targets);
  console.log(`targets on screen (${names.length}): ${names.join(', ')}`);
  const hero = targets.hero;
  if (!hero) throw new Error('no target registered as "hero" is on screen');

  const box = await page.locator('canvas').first().boundingBox();
  const hx = box.x + (hero.left + hero.right) / 2;
  const hy = box.y + (hero.top + hero.bottom) / 2;
  await page.mouse.move(hx, hy - 120);
  await page.waitForTimeout(100);
  await page.mouse.move(hx, hy);
  await page.waitForTimeout(280); // about half of HOLD_MS
  await page.screenshot({ path: join(outDir, 'shot-arming.png') });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, 'shot-selected.png') });
  console.log(`hero rect: ${JSON.stringify(hero)}`);
} catch (error) {
  failed = true;
  console.error(`FAIL: ${error.message}`);
}
if (errors.length) { failed = true; console.error(errors.join('\n')); }
await browser.close();
server.close();
console.log(failed ? 'capture FAILED' : `captured into ${outDir}`);
process.exit(failed ? 1 : 0);
