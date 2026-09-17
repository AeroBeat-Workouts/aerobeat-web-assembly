// @ts-check
// Zoom 4x into a region of a rendered frame PNG (nearest-neighbor), for visual inspection.
// Usage: node scripts/zoom-region.js <input.png> <output.png> <x> <y> <w> <h> <scale>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const [, , inFile, outFile, xs, ys, ws, hs, ks] = process.argv;
const x = Number(xs), y = Number(ys), w = Number(ws), h = Number(hs), k = Number(ks);
const b64 = readFileSync(inFile).toString("base64");
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
await page.setContent("<html></html>");
const out = await page.evaluate(async (args) => {
  const [b64, x, y, w, h, k] = args;
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${b64}`; });
  const c = new OffscreenCanvas(w * k, h * k);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, x, y, w, h, 0, 0, w * k, h * k);
  const blob = await c.convertToBlob({ type: "image/png" });
  return new Promise((res) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.readAsDataURL(blob); });
}, [b64, x, y, w, h, k]);
writeFileSync(outFile, Buffer.from(out.split(",")[1], "base64"));
await browser.close();
console.log(`wrote ${outFile}`);
