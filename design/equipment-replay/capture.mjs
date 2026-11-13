// Capture evidence for the equipment replay.
//
//   node capture.mjs [stills|video|all]     (default all)
//
// Serves design/ over HTTP (same pattern as ../style-comps/_shared/capture.mjs), opens
// index.html at 1600x1000 and writes into this folder:
//   stills/still-<n>-<raw|smooth>.png   same instants in both modes (deterministic seek)
//   video-raw.webm, video-smooth.webm   ~18 s real-time recordings of the same stretch
// Exits non-zero on page errors or if the page never sets window.__compReady.
import { createServer } from 'node:http';
import { readFile, mkdir, rename, rm, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/home/derrick/.local/share/agent-orchestration-machine/npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const here = dirname(fileURLToPath(import.meta.url));
const designRoot = resolve(here, '..');
const what = process.argv[2] ?? 'all';
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(designRoot, path.endsWith('/') ? path + 'index.html' : path);
    if (!file.startsWith(designRoot)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/equipment-replay/index.html`;

// Busy instants: highest wrist speed (judge cells/s between consecutive real samples) near a beat.
const frames = JSON.parse(readFileSync(join(here, 'frames.json'), 'utf8'));
function busyMoments(n) {
  const P = frames.poses, cand = [];
  for (let i = 1; i < P.length; i++) {
    const dt = (P[i].tm - P[i - 1].tm) / 1000;
    const v = Math.max(Math.hypot(P[i].rw[0] - P[i - 1].rw[0], P[i].rw[1] - P[i - 1].rw[1]), Math.hypot(P[i].lw[0] - P[i - 1].lw[0], P[i].lw[1] - P[i - 1].lw[1])) / dt;
    if (P[i].ta > frames.window.startMs + 2000 && P[i].ta < frames.window.endMs - 500) cand.push({ t: P[i].ta + 30, v });
  }
  cand.sort((a, b) => b.v - a.v);
  const out = [];
  for (const c of cand) { if (out.every((o) => Math.abs(o.t - c.t) > 4000)) out.push(c); if (out.length === n) break; }
  return out.sort((a, b) => a.t - b.t);
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const watch = (page) => { page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); }); };
const ready = (page) => page.waitForFunction(() => window.__compReady === true, null, { timeout: 60000 });

if (what === 'stills' || what === 'all') {
  await mkdir(join(here, 'stills'), { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); watch(page);
  await page.goto(`${url}?pause=1`); await ready(page);
  const moments = busyMoments(4);
  console.log('busy moments', moments.map((m) => `${(m.t / 1000).toFixed(2)}s @ ${m.v.toFixed(1)} cells/s`).join(', '));
  let i = 0;
  for (const m of moments) {
    i++;
    for (const mode of ['raw', 'smooth']) {
      await page.evaluate(([t, mode]) => { window.__replay.setMode(mode); window.__replay.seek(t); }, [m.t, mode]);
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(here, 'stills', `still-${i}-${mode}.png`) });
    }
  }
  await page.close();
}

if (what === 'video' || what === 'all') {
  const start = frames.window.startMs + 9000, seconds = 18;
  for (const mode of ['raw', 'smooth']) {
    const dir = join(here, '.video-tmp'); await rm(dir, { recursive: true, force: true });
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir, size: { width: 1600, height: 1000 } } });
    const page = await ctx.newPage(); watch(page);
    await page.goto(`${url}?mode=${mode}&t=${start}&pause=1`); await ready(page);
    await page.evaluate(() => window.__replay.set({ paused: false }));
    await page.waitForTimeout(seconds * 1000);
    const st = await page.evaluate(() => window.__replay.state());
    console.log(`${mode}: page fps ${st.fps.toFixed(1)}, reached song ${(st.t / 1000).toFixed(2)} s`);
    await page.close(); await ctx.close();
    const [f] = await readdir(dir); await rename(join(dir, f), join(here, `video-${mode}.webm`)); await rm(dir, { recursive: true, force: true });
  }
}

await browser.close(); server.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('capture ok');
