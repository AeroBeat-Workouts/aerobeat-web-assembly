// @ts-check
// 0.0.60 W1 (F1) DEBUG 2 — numerical diff of baseline vs case debug frames:
// exact diff-pixel bounding box + crop dump + fill-band stats. Replicates the sweep's math.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const DIR = dirname(new URL(import.meta.url).pathname);
const EV = join(DIR, "..", ".plans", "evidence");
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
await page.setContent("<html><body style='margin:0'></body></html>");
const fs = await import("node:fs");
const toDataUrl = (f) => `data:image/png;base64,${fs.readFileSync(join(EV, f)).toString("base64")}`;
const result = await page.evaluate(async ([bUrl, cUrl]) => {
  const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const [baseImg, caseImg] = await Promise.all([load(bUrl), load(cUrl)]);
  const w = baseImg.width, h = baseImg.height;
  const mk = (img) => { const c = new OffscreenCanvas(w, h); c.getContext("2d").drawImage(img, 0, 0); return c.getContext("2d").getImageData(0, 0, w, h).data; };
  const base = mk(baseImg), casePx = mk(caseImg);
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, count = 0;
  let fCount = 0, fR = 0, fG = 0, fB = 0, fMaxLuma = 0, fSat = 0;
  const samples = [];
  for (let i = 0; i < base.length; i += 4) {
    const d = Math.abs(base[i] - casePx[i]) + Math.abs(base[i + 1] - casePx[i + 1]) + Math.abs(base[i + 2] - casePx[i + 2]);
    if (d <= 30) continue;
    const x = (i / 4) % w, y = Math.floor(i / 4 / w);
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    count += 1;
    const r = casePx[i], g = casePx[i + 1], b = casePx[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luma >= 50 && luma <= 225) { fCount += 1; fR += r; fG += g; fB += b; if (luma > fMaxLuma) fMaxLuma = luma; fSat += (Math.max(r, g, b) - Math.min(r, g, b)); if (samples.length < 5) samples.push([x, y, r, g, b]); }
  }
  const pad = 6, sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad), sw = Math.min(w - sx, maxX - minX + pad * 2), sh = Math.min(h - sy, maxY - minY + pad * 2);
  const crop = new OffscreenCanvas(sw, sh);
  crop.getContext("2d").drawImage(caseImg, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await crop.convertToBlob({ type: "image/png" });
  const cropUrl = await new Promise((res) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.readAsDataURL(blob); });
  return { canvas: { w, h }, box: { minX, minY, maxX, maxY }, count, fill: { count: fCount, r: fR / fCount, g: fG / fCount, b: fB / fCount, bMinusR: (fB - fR) / fCount, maxLuma: fMaxLuma, meanSat: fSat / fCount }, samples, crop: cropUrl };
}, [toDataUrl("debug-corpse-1-baseline-first.png"), toDataUrl("debug-corpse-2-case-first.png")]);
console.log(JSON.stringify({ ...result, crop: undefined }, null, 1));
writeFileSync(join(EV, "debug-corpse-diff-crop.png"), Buffer.from(result.crop.split(",")[1], "base64"));
console.log("crop → .plans/evidence/debug-corpse-diff-crop.png");
await browser.close();
