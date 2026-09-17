// @ts-check

// 0.0.60 W1 (F1) — corpse color SWEEP harness (ON-DEMAND e2e, NOT in the default gate).
//
// Purpose (Derrick-approved approach): drive a RANGE of note palette colors "as if the song
// requested them", render one flow hit corpse (slice halves) and one punch corpse (whole) per
// color, read the REAL rendered pixels, and emit a labeled before/after contact sheet for
// HUMAN sign-off on the look. Iterate the renderer constants (AFTERMATH_CORPSE_MIN_CHROMA,
// AFTERMATH_CORPSE_DESATURATION in aerobeat-web-renderer/src/gameplay-scene-model.js), re-run,
// repeat until the look is agreed — then the constants are locked for the W5 build.
//
// How it works (same family as validate-0.0.59-flow-corpse-color-pixels.js):
//   Vite (live ../aerobeat-web-renderer source) + Playwright; the page is loaded TWICE:
//     phase "after"  — the renderer working tree as-is (the candidate fix present),
//     phase "before" — the candidate fix reverse-applied via a patch (applied back in finally),
//   so one run produces a combined before/after sheet. The corpse fill pixels are read by
//   OffscreenCanvas drawImage + getImageData (baseline-subtracted diff pixels), never the
//   scene-graph model. Crops are the diff-pixel bounding boxes (the glyph itself).
//
// Output (under .plans/evidence/):
//   <stamp>-corpse-sweep-combined.png   — rows = sweep colors, columns = before/after × flow/punch
//   <stamp>-corpse-sweep-combined.json  — measured fill stats per (color, kind, phase)
//
// Usage: node scripts/sweep-corpse-colors.js
// (stamp override: AEROBEAT_SWEEP_STAMP=YYYY-MM-DD)

import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const SCRIPTS_DIR = dirname(new URL(import.meta.url).pathname);
const ASSEMBLY_DIR = join(SCRIPTS_DIR, "..");
const RENDERER_DIR = join(dirname(ASSEMBLY_DIR), "aerobeat-web-renderer");
const EVIDENCE_DIR = join(ASSEMBLY_DIR, ".plans", "evidence");
const STAMP = process.env.AEROBEAT_SWEEP_STAMP ?? "2026-09-17";
const FIX_FILES = ["src/gameplay-scene-model.js", "src/renderer-facade.js"];
const FIX_PATCH = `/tmp/w1-corpse-fix-${Date.now()}.patch`;

// The sweep: colors "as if the song requested them". null = no appearanceColor (role fallback).
// If the real "Incomplete" hexes become reachable, insert them here labeled "incomplete-L/R".
const SWEEP = [
  { token: "#2693FF", label: "default-L" },
  { token: "#39C96B", label: "default-R" },
  { token: "#A8C8E8", label: "pale-L" },
  { token: "#CDE3F5", label: "very-pale" },
  { token: "#D9F5FF", label: "receptor" },
  { token: "#F2F2F2", label: "near-white" },
  { token: "#FF3355", label: "saturated-X" },
  { token: null, label: "no-color(fallback)" }
];
const COMMIT_MS = 6000;
const SAMPLE_OFFSET_MS = 40; // full alpha, halves up, tumble negligible
const FILL_LUMA_MIN = 50, FILL_LUMA_MAX = 225; // glyph interior band (excludes white outline ~235+ and charcoal edges)

const git = (args) => {
  const r = spawnSync("/usr/bin/git", args, { cwd: RENDERER_DIR, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr ?? r.stdout}`);
  return r.stdout ?? "";
};

// Capture the candidate fix (the renderer's LAST commit, which must touch the W1 files) as a
// patch so "before" = HEAD minus the fix. The worktree must be CLEAN at start (the Vite
// provenance gate rejects dirty dependency worktrees).
const fixPatch = git(["diff", "HEAD~1..HEAD", "--", ...FIX_FILES]);
if (!fixPatch.trim()) throw new Error("renderer HEAD~1..HEAD does not touch the W1 fix files — commit the candidate fix first (worktree clean)");
writeFileSync(FIX_PATCH, fixPatch);
console.log(`[sweep] candidate fix captured (${fixPatch.length} bytes) → ${FIX_PATCH}`);

let fixedState = "after"; // current working tree state
const revertToBefore = () => { git(["apply", "-R", FIX_PATCH]); fixedState = "before"; };
const restoreAfter = () => { git(["apply", FIX_PATCH]); fixedState = "after"; };

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const browser = await chromium.launch({ headless: true });
const results = { before: {}, after: {} }; // [token|label][kind] = stats
const crops = { before: {}, after: {} }; // [label] = { flow: dataUrl, punch: dataUrl }

try {
  for (const phase of ["after", "before"]) {
    if (phase === "before" && fixedState !== "before") revertToBefore();
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(childUrl, { waitUntil: "networkidle" });
    const target = page;
    await target.waitForSelector("aero-game");
    await target.waitForFunction(() => document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state === "ready", { timeout: 20000 });
    const proof = await target.evaluate(async ({ sweep, commitMs, sampleOffsetMs, fillLumaMin, fillLumaMax }) => {
      const game = document.querySelector("aero-game");
      const renderer = game.graph.renderer;
      game.stopFrameLoop();
      game.setMenuOpen(false);
      renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
      renderer.setEnvironmentVisible(false);
      renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
      const canvas = game.shadowRoot.querySelector("canvas");
      const readPixels = () => {
        const sample = new OffscreenCanvas(canvas.width, canvas.height);
        const ctx = sample.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(0, 0, sample.width, sample.height).data;
      };
      const deltaRGB = (a, b, i) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      const makeEntry = (targetId, family, mode, appearanceColor) => Object.freeze({
        targetId, hitCommitMs: commitMs, family, hand: "left", mode,
        spawn: { x: 0, y: 1, z: 0 }, seed: 1234, shape: "orb",
        ...(appearanceColor ? { appearanceColor } : {})
      });
      const frame = () => renderer.renderGameplayFrame({ presentation: "flow", nowMs: commitMs + sampleOffsetMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath: [] });
      const baseline = (() => { frame(); return readPixels(); })();
      const nowMs = commitMs + sampleOffsetMs;
      const out = [];
      for (const row of sweep) {
        for (const kind of ["flow", "punch"]) {
          const entry = makeEntry(`sweep-${row.label}-${kind}`, kind, kind === "flow" ? "slice" : "straight", row.token);
          renderer.renderGameplayFrame({ presentation: "flow", nowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath: [entry] });
          const pixels = readPixels();
          // diff-pixel bounding box (the whole glyph) + fill-band stats (the colored interior).
          let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, count = 0;
          let fCount = 0, fR = 0, fG = 0, fB = 0, fMaxLuma = 0, fSat = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (deltaRGB(pixels, baseline, i) <= 30) continue;
            const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width);
            minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
            count += 1;
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (luma < fillLumaMin || luma > fillLumaMax) continue;
            fCount += 1; fR += r; fG += g; fB += b;
            if (luma > fMaxLuma) fMaxLuma = luma;
            fSat += (Math.max(r, g, b) - Math.min(r, g, b));
          }
          frame(); // restore baseline frame between cases
          if (count < 200 || maxX < 0) throw new Error(`corpse not visibly rendered for ${row.label}/${kind} (${count}px)`);
          // crop the glyph bounding box (padded) as a PNG data URL.
          const pad = 6;
          const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
          const sw = Math.min(canvas.width - sx, maxX - minX + pad * 2), sh = Math.min(canvas.height - sy, maxY - minY + pad * 2);
          const crop = new OffscreenCanvas(sw, sh);
          crop.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
          const blob = await crop.convertToBlob({ type: "image/png" });
          const cropDataUrl = await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onloadend = () => res(fr.result);
            fr.onerror = () => rej(fr.error);
            fr.readAsDataURL(blob);
          });
          out.push({
            label: row.label, token: row.token, kind,
            box: { x: sx, y: sy, w: sw, h: sh },
            px: count,
            fill: fCount ? {
              r: fR / fCount, g: fG / fCount, b: fB / fCount,
              bMinusR: (fB - fR) / fCount, gMinusB: (fG - fB) / fCount,
              maxLuma: fMaxLuma, meanSat: fSat / fCount, count: fCount
            } : null,
            crop: cropDataUrl
          });
        }
      }
      return out;
    }, { sweep: SWEEP, commitMs: COMMIT_MS, sampleOffsetMs: SAMPLE_OFFSET_MS, fillLumaMin: FILL_LUMA_MIN, fillLumaMax: FILL_LUMA_MAX });
    for (const row of proof) {
      results[phase][`${row.label}/${row.kind}`] = row.fill;
      (crops[phase][row.label] ??= {})[row.kind] = row.crop;
      const f = row.fill;
      console.log(`[sweep] ${phase.padEnd(6)} ${row.label.padEnd(18)} ${row.kind.padEnd(5)} ${f ? `rgb(${f.r.toFixed(0)},${f.g.toFixed(0)},${f.b.toFixed(0)}) b-r=${f.bMinusR.toFixed(1)} sat=${f.meanSat.toFixed(1)} luma=${f.maxLuma.toFixed(0)} px=${row.px}` : "NO FILL PIXELS"}`);
    }
    await context.close();
  }
  if (fixedState !== "after") restoreAfter();
  console.log(`[sweep] renderer working tree restored to ${fixedState} (fix ${fixedState === "after" ? "present" : "MISSING — restore manually: git apply ${FIX_PATCH}"})`);

  // Assemble the combined before/after contact sheet: rows = colors, cols = before-flow, before-punch, after-flow, after-punch.
  const context = await browser.newContext({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 1 });
  const sheet = await context.newPage();
  const cell = (phase, label, kind) => {
    const url = crops[phase][label]?.[kind];
    const f = results[phase][`${label}/${kind}`];
    const stat = f ? `rgb(${f.r.toFixed(0)},${f.g.toFixed(0)},${f.b.toFixed(0)})<br>b-r ${f.bMinusR.toFixed(0)} · sat ${f.meanSat.toFixed(0)}` : "—";
    return `<td><div class="lab">${label} · ${phase} · ${kind}</div><div class="img">${url ? `<img src="${url}">` : "<b>missing</b>"}</div><div class="stat">${stat}</div></td>`;
  };
  const rows = SWEEP.map((row) => `<tr>${cell("before", row.label, "flow")}${cell("before", row.label, "punch")}${cell("after", row.label, "flow")}${cell("after", row.label, "punch")}</tr>`).join("");
  await sheet.setContent(`<!doctype html><style>body{background:#0b0f16;margin:0;padding:16px;font:12px/1.4 ui-monospace,monospace;color:#cfd8e3}h1{font-size:14px;margin:0 0 10px}table{border-collapse:collapse}td{vertical-align:top;padding:8px;background:#111722;border:1px solid #223} .lab{color:#8fa3bd;font-size:11px;margin-bottom:4px}.img img{display:block;background:#071426;border:1px solid #345;max-width:180px}.stat{margin-top:4px;color:#9fd6a5;font-size:11px}th{color:#8fa3bd;font-size:11px;text-align:left;padding:4px 8px}</style><h1>0.0.60 W1 (F1) corpse color sweep — note palette → rendered corpse fill (real pixels, commit+40ms). Columns: BEFORE (0.92 desat, no substitution) × flow/punch, AFTER (candidate constants) × flow/punch.</h1><table><tr><th></th><th>before · flow</th><th>before · punch</th><th>after · flow</th><th>after · punch</th></tr>${rows}</table>`);
  await sheet.waitForTimeout(250);
  const pngPath = join(EVIDENCE_DIR, `${STAMP}-corpse-sweep-combined.png`);
  const jsonPath = join(EVIDENCE_DIR, `${STAMP}-corpse-sweep-combined.json`);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await sheet.screenshot({ path: pngPath, fullPage: true });
  writeFileSync(jsonPath, JSON.stringify({ stamp: STAMP, sweep: SWEEP, measured: { before: results.before, after: results.after }, note: "fill stats: mean RGB over baseline-diff pixels in luma band [50,225]; bMinusR/gMinusB/meanSat/maxLuma; one flow slice + one punch whole per color, hand left, commit+40ms" }, null, 2));
  console.log(`[sweep] contact sheet → ${pngPath}`);
  console.log(`[sweep] measured table → ${jsonPath}`);
  await context.close();
} finally {
  // Never leave the working tree without the candidate fix.
  try { if (fixedState !== "after") restoreAfter(); } catch (e) { console.error(`[sweep] WARNING: could not restore fix state: ${String(e)}`); }
  await browser.close();
  await vite.close();
}
console.log(`[sweep] DONE (final renderer state: ${fixedState})`);
