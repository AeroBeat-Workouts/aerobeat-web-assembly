// @ts-check

// 0.0.62 xshm (L-B) — equipment visual SWEEP harness (ON-DEMAND e2e, NOT in the default gate).
//
// Purpose (Derrick-approved approach, mirrors scripts/sweep-corpse-colors.js):
// drive a RANGE of synthetic EQUIPMENT records through the renderer's
// `renderGameplayFrameWithCursorsAndEquipment` path, read the REAL rendered
// canvas pixels, and emit labeled contact-sheet PNGs + measured RGB/geometry
// JSON so the CURRENT 0.0.61 saber + glove look can be reviewed (baseline)
// before any redesign. Iterate the renderer constants, re-run, repeat — faster
// than one-build-at-a-time.
//
// How it works (same family as sweep-corpse-colors.js + the 0.0.61-saber-cut
// oracle):
//   Vite (live ../aerobeat-web-renderer source) + Playwright. The page is
//   loaded ONCE; the app's `aero-game` graph is quiesced (stopFrameLoop +
//   setMenuOpen(false)) and the renderer is driven DIRECTLY:
//     - renderGameplayFrameWithCursorsAndEquipment(frame, [], cursorOptions,
//       equipment, { grid })  with a minimal valid frame (presentation:"flow",
//       empty targets) so ONLY the equipment stages — no notes/aftermath.
//     - setEnvironmentAsset(descriptor) + setEnvironmentVisible(true) for the
//       AERO (photosphere) mode; setEnvironmentVisible(false) +
//       setBackgroundProjection(solid) for the CAMERA mode. Both use the REAL
//       environment-owner path (the alpine-river-valley photosphere staged on
//       a dedicated opaque layer BEFORE the World layer) — never faked.
//   The equipment pixels are read by OffscreenCanvas drawImage + getImageData
//   (the cross-origin-safe capture pattern), never the scene-graph model.
//   World geometry is measured via camera.worldToScreen of the AABB corners
//   (accessible through renderer.cameraEntity.camera); the screen-pixel
//   bounding box of the equipment crop is also reported.
//
// Sweep dimensions:
//   Saber (mode "flow"):   wrist position × saber direction × per-hand color
//                          × dimmed × both-hands.
//   Glove (mode "boxing"): wrist position × per-hand color × dimmed ×
//                          both-hands (no direction — axis-aligned).
//   Per-hand colors: the theme defaults (#2693ff left / #39c96b right) AND
//   one song-palette pair, set through the real effective-palette seam
//   (the renderer's internalEffectivePalette symbol, exposed by the
//   `describe().theme`/setTheme path — but the per-hand palette seam is a
//   private internal; we drive colors via the renderer's OWN theme defaults
//   for the "default" pair and via the `effectiveMarkerPalettes` WeakMap seam
//   that `renderGameplayEquipment` reads. For the song-palette pair we set
//   the renderer's theme leftHandColor/rightHandColor directly).
//
// Output (under .plans/evidence/2026-09-19-0.0.61-equipment-baseline/):
//   <stamp>-saber-sweep-aero.png / -camera.png      — rows = sweep cases
//   <stamp>-glove-sweep-aero.png / -camera.png
//   <stamp>-environment-aero.png / -camera.png      — environment-mode diff
//   <stamp>-equipment-sweep.json                    — measured values per case
//   README.md                                        — sweep dims + rerun command
//
// Usage: node scripts/sweep-equipment-visuals.js
// (stamp override: AEROBEAT_SWEEP_STAMP=YYYY-MM-DD)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const SCRIPTS_DIR = dirname(new URL(import.meta.url).pathname);
const ASSEMBLY_DIR = join(SCRIPTS_DIR, "..");
// 0.0.62 L-C (r2lb): the evidence directory is CLI-overridable via
// AEROBEAT_SWEEP_DIR so the same harness can target different evidence dirs
// (baseline vs. saber-v1 vs. future iterations). Default = the 0.0.61 baseline
// dir (byte-identical behavior to the pre-change harness).
const DEFAULT_EVIDENCE_DIR = join(ASSEMBLY_DIR, ".plans", "evidence", "2026-09-19-0.0.61-equipment-baseline");
const EVIDENCE_DIR = process.env.AEROBEAT_SWEEP_DIR ?? DEFAULT_EVIDENCE_DIR;
const STAMP = process.env.AEROBEAT_SWEEP_STAMP ?? "2026-09-19";

// Viewport: matches the production 844×390 (Derrick's test surface).
const VIEW_W = 844;
const VIEW_H = 390;

// The two environment modes (0.0.50 rt4k skybox-layering class).
// AERO  = photosphere visible + linear-gradient clear (the real Aero background).
// CAMERA= photosphere hidden + solid transparent clear (the real Camera background;
//         the camera video would composite behind the canvas — here the clear is
//         transparent so the page background shows through, which is the truthful
//         "camera is the background" state).
const AERO_BG = { kind: "linear-gradient", colors: ["#071426", "#153b5d"], angleDeg: 180 };
const CAMERA_BG = { kind: "solid", colors: ["#00000000"], angleDeg: 180 };

// The sweep-dimension constants (positions, directions, color pairs, dim
// states, both-hands combos) live INSIDE runSweep because that function is
// serialized into the browser page via page.evaluate and must be
// self-contained. The same values are re-declared there.

const vite = await createViteServer({
  appType: "spa",
  configFile: "vite.config.js",
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null }
});
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const browser = await chromium.launch({ headless: true });

const results = { aero: [], camera: [], environment: { aero: null, camera: null } };
const crops = { aero: {}, camera: {} }; // [caseLabel] = dataUrl

// In-page sweep driver. Runs inside the browser context (where OffscreenCanvas
// and the renderer live). MUST be fully self-contained — it is serialized into
// the page via page.evaluate, so it may reference no Node-side bindings.
// All sweep-dimension constants are re-declared inside.
async function runSweep(envMode) {
  const AERO_ENV = {
    id: "alpine-river-valley-photosphere",
    url: "/assets/environments/alpine-river-valley-photosphere/1.0.0/alpine-river-valley-photosphere.jpg",
    mimeType: "image/jpeg", bytes: 2664010,
    sha256: "7a529a6e0c1bee343633273d672a22f346f8ffc7406bf6a40812ae5435f3260b",
    projection: "equirectangular", dimensions: [4096, 2048],
    centerForward: [0, 0, -1], worldUp: [0, 1, 0]
  };
  const AERO_BG = { kind: "linear-gradient", colors: ["#071426", "#153b5d"], angleDeg: 180 };
  const CAMERA_BG = { kind: "solid", colors: ["#00000000"], angleDeg: 180 };
  const POSITIONS = [
    { label: "center", x: 0.5, y: 0.5 },
    { label: "left-up", x: 0.125, y: 0.125 },
    { label: "right-low", x: 0.875, y: 0.875 }
  ];
  const SQRT1_2 = Math.SQRT1_2;
  const DIRECTIONS = [
    { label: "plus-x", x: 1, y: 0 },
    { label: "plus-y", x: 0, y: 1 },
    { label: "45deg", x: SQRT1_2, y: SQRT1_2 },
    { label: "stationary-fallback", x: 0, y: 0 }
  ];
  const COLOR_PAIRS = [
    { label: "theme-defaults", left: "#2693FF", right: "#39C96B" },
    { label: "song-palette", left: "#FF7A2F", right: "#2FE0D0" }
  ];
  const DIM_STATES = [
    { label: "undimmed", dimmed: false },
    { label: "dimmed", dimmed: true }
  ];
  const BOTH_HANDS = [
    { label: "both-sabers", left: "flow", right: "flow", leftDir: { x: 1, y: 0 }, rightDir: { x: 0, y: 1 } },
    { label: "both-gloves", left: "boxing", right: "boxing", leftDir: null, rightDir: null },
    { label: "saber+glove", left: "flow", right: "boxing", leftDir: { x: 1, y: 0 }, rightDir: null }
  ];
  const cursorOptions = { grid: { x: 0, y: 0, width: 1, height: 1 }, minConfidence: 0.5, sizeCssPx: 32 };

  const game = document.querySelector("aero-game");
  const renderer = game.graph.renderer;
  const canvas = game.shadowRoot.querySelector("canvas");

  // Quiesce the app loop and lock the viewport to the production 844×390.
  game.stopFrameLoop();
  game.setMenuOpen(false);
  renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });

  // Stage the environment for this mode using the REAL environment-owner path.
  if (envMode === "aero") {
    renderer.setEnvironmentTransform({ position: { x: 0, y: 0, z: 0 }, rotationDegrees: { xPitch: 0, yYaw: 180, zRoll: 0 }, scale: 1 });
    renderer.setEnvironmentAsset(AERO_ENV);
    renderer.setEnvironmentVisible(true);
    renderer.setBackgroundProjection(AERO_BG);
  } else {
    renderer.setEnvironmentVisible(false);
    renderer.setBackgroundProjection(CAMERA_BG);
  }

  // Wait for the environment asset to reach "ready" (aero only — the camera
  // mode has no asset to load).
  if (envMode === "aero") {
    await new Promise((resolve, reject) => {
      const started = performance.now();
      const poll = () => {
        const env = renderer.describe().environment;
        if (env && (env.state === "ready" || env.state === "error")) return resolve();
        if (performance.now() - started > 20000) return reject(new Error(`environment asset did not reach ready/error (state=${env?.state})`));
        setTimeout(poll, 50);
      };
      poll();
    });
  }

  // A minimal valid frame: presentation "flow", empty targets, so ONLY the
  // equipment stages (no notes, no aftermath, no hazard).
  const frame = () => ({
    presentation: "flow",
    nowMs: 0,
    targets: [],
    timingWindowBeforeMs: 180,
    timingWindowAfterMs: 180,
    aftermath: [],
    hazardContacts: []
  });

  // Read the real rendered pixels (the cross-origin-safe capture pattern).
  const readPixels = () => {
    const sample = new OffscreenCanvas(canvas.width, canvas.height);
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0);
    return ctx.getImageData(0, 0, sample.width, sample.height).data;
  };

  // Baseline: the frame with NO equipment staged. Equipment pixels are the
  // diff against this baseline.
  const baselinePixels = (() => {
    renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], { grid: { x: 0, y: 0, width: 1, height: 1 } });
    return readPixels();
  })();

  const diffThreshold = 30; // sum |Δr|+|Δg|+|Δb| — same as the corpse sweep.

  // Project a world point to screen px via the camera (accessible).
  const project = (x, y, z) => {
    const out = renderer.cameraEntity.camera.worldToScreen({ x, y, z });
    return { x: out.x, y: out.y };
  };

  // Per-case: stage one equipment record, capture the diff bbox + crop + stats.
  const captureOne = async (label, equipment, expectedWorldAABB) => {
    renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, equipment, { grid: { x: 0, y: 0, width: 1, height: 1 } });
    const pixels = readPixels();
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, count = 0;
    let sR = 0, sG = 0, sB = 0, maxLuma = 0, satSum = 0, edgeCount = 0, edgeR = 0, edgeG = 0, edgeB = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const d = Math.abs(pixels[i] - baselinePixels[i]) + Math.abs(pixels[i + 1] - baselinePixels[i + 1]) + Math.abs(pixels[i + 2] - baselinePixels[i + 2]);
        if (d <= diffThreshold) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        count += 1;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        sR += r; sG += g; sB += b;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luma > maxLuma) maxLuma = luma;
        satSum += (Math.max(r, g, b) - Math.min(r, g, b));
        // Edge pixels: diff pixels adjacent to a non-diff pixel (the silhouette boundary).
        const isEdge = (x > 0 && Math.abs(pixels[i - 4] - baselinePixels[i - 4]) + Math.abs(pixels[i - 3] - baselinePixels[i - 3]) + Math.abs(pixels[i - 2] - baselinePixels[i - 2]) <= diffThreshold)
          || (x < canvas.width - 1 && Math.abs(pixels[i + 4] - baselinePixels[i + 4]) + Math.abs(pixels[i + 5] - baselinePixels[i + 5]) + Math.abs(pixels[i + 6] - baselinePixels[i + 6]) <= diffThreshold)
          || (y > 0 && Math.abs(pixels[i - 4 * canvas.width] - baselinePixels[i - 4 * canvas.width]) + Math.abs(pixels[i - 4 * canvas.width + 1] - baselinePixels[i - 4 * canvas.width + 1]) + Math.abs(pixels[i - 4 * canvas.width + 2] - baselinePixels[i - 4 * canvas.width + 2]) <= diffThreshold)
          || (y < canvas.height - 1 && Math.abs(pixels[i + 4 * canvas.width] - baselinePixels[i + 4 * canvas.width]) + Math.abs(pixels[i + 4 * canvas.width + 1] - baselinePixels[i + 4 * canvas.width + 1]) + Math.abs(pixels[i + 4 * canvas.width + 2] - baselinePixels[i + 4 * canvas.width + 2]) <= diffThreshold);
        if (isEdge) { edgeCount += 1; edgeR += r; edgeG += g; edgeB += b; }
      }
    }
    if (count < 50 || maxX < 0) {
      renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], { grid: { x: 0, y: 0, width: 1, height: 1 } });
      return { label, error: `equipment not visibly rendered (${count}px)` };
    }
    // Crop the diff bounding box (padded) while the case frame is still on the canvas.
    const pad = 6;
    const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
    const sw = Math.min(canvas.width - sx, maxX - minX + pad * 2), sh = Math.min(canvas.height - sy, maxY - minY + pad * 2);
    const crop = new OffscreenCanvas(sw, sh);
    crop.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    const cropDataUrl = await (async () => {
      const blob = await crop.convertToBlob({ type: "image/png" });
      return new Promise((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
    })();
    // Restore the baseline frame between cases (AFTER the crop).
    renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], { grid: { x: 0, y: 0, width: 1, height: 1 } });
    const screenW = maxX - minX + 1, screenH = maxY - minY + 1;
    // Per-hand color confirmation: the mean RGB of the diff pixels, compared
    // against the expected hand colors. For a single-hand case this confirms
    // the hand tint. For both-hands it reports the overall mean (both hands
    // mixed).
    const meanR = sR / count, meanG = sG / count, meanB = sB / count;
    return {
      label,
      box: { x: sx, y: sy, w: sw, h: sh },
      diffPx: count,
      screenWidthPx: screenW,
      screenHeightPx: screenH,
      aspect: screenW / screenH,
      centroid: { x: +(((minX + maxX) / 2)).toFixed(1), y: +(((minY + maxY) / 2)).toFixed(1) },
      meanRGB: { r: +meanR.toFixed(1), g: +meanG.toFixed(1), b: +meanB.toFixed(1) },
      edge: edgeCount ? { r: +(edgeR / edgeCount).toFixed(1), g: +(edgeG / edgeCount).toFixed(1), b: +(edgeB / edgeCount).toFixed(1), count: edgeCount } : null,
      maxLuma: +maxLuma.toFixed(1),
      meanSat: +(satSum / count).toFixed(1),
      worldAABB: expectedWorldAABB ? expectedWorldAABB.screen : null,
      worldAABBSource: expectedWorldAABB ? "camera.worldToScreen(corners)" : "none",
      crop: cropDataUrl
    };
  };

  const out = [];

  // Set the per-hand theme colors for a color pair. The renderer resolves
  // equipment colors from the internal effectiveMarkerPalettes seam, which is
  // null here (no song palette applied), so it falls back to
  // this.theme.leftHandColor/rightHandColor. Mutating the theme tokens directly
  // is the truthful way to sweep per-hand colors through the REAL color path.
  const setHandColors = (pair) => {
    // renderer.theme is a frozen token object, so reassign the whole record
    // (the renderer reads this.theme.leftHandColor/rightHandColor when the
    // effective song-palette seam is null, which it is here).
    renderer.theme = { ...renderer.theme, leftHandColor: pair.left, rightHandColor: pair.right };
  };

  // ── Saber sweep (mode "flow") ──
  for (const pos of POSITIONS) {
    for (const dir of DIRECTIONS) {
      for (const colorPair of COLOR_PAIRS) {
        setHandColors(colorPair);
        for (const dim of DIM_STATES) {
          const record = { role: "left_wrist", x: pos.x, y: pos.y, mode: "flow", direction: { x: dir.x, y: dir.y } };
          if (dim.dimmed) record.dimmed = true;
          const posWorld = { x: -2 + pos.x * 4, y: 3 - pos.y * 3 };
          const dirLen = Math.hypot(dir.x, dir.y);
          const ux = dirLen > 0 ? dir.x / dirLen : 0;
          const uy = dirLen > 0 ? dir.y / dirLen : -1;
          const saberMid = { x: posWorld.x + ux * 0.75 / 2, y: posWorld.y + uy * 0.75 / 2 };
          const saberEnd = { x: posWorld.x + ux * 0.75, y: posWorld.y + uy * 0.75 };
          const corners = [
            { x: posWorld.x, y: posWorld.y, z: 0.45 },
            { x: saberEnd.x, y: saberEnd.y, z: 0.45 },
            { x: saberMid.x - ux * 0.18, y: saberMid.y - uy * 0.18, z: 0.45 },
            { x: saberMid.x + ux * 0.18, y: saberMid.y + uy * 0.18, z: 0.45 }
          ].map((c) => project(c.x, c.y, c.z));
          const aabb = {
            minX: +Math.min(...corners.map((c) => c.x)).toFixed(1),
            maxX: +Math.max(...corners.map((c) => c.x)).toFixed(1),
            minY: +Math.min(...corners.map((c) => c.y)).toFixed(1),
            maxY: +Math.max(...corners.map((c) => c.y)).toFixed(1)
          };
          const caseLabel = `saber_${pos.label}_${dir.label}_${colorPair.label}_${dim.label}`;
          const res = await captureOne(caseLabel, [record], { screen: aabb });
          res.caseKind = "saber";
          res.worldAABB = res.worldAABB; // already set
          res.input = { role: "left_wrist", pos: pos.label, dir: dir.label, colors: colorPair.label, dim: dim.label };
          out.push(res);
        }
      }
    }
  }

  // ── Glove sweep (mode "boxing") ──
  for (const pos of POSITIONS) {
    for (const colorPair of COLOR_PAIRS) {
      setHandColors(colorPair);
      for (const dim of DIM_STATES) {
        const record = { role: "left_wrist", x: pos.x, y: pos.y, mode: "boxing" };
        if (dim.dimmed) record.dimmed = true;
        const posWorld = { x: -2 + pos.x * 4, y: 3 - pos.y * 3 };
        const z = 0.45 + 0.05; // glove body sits at z = 0.45 + offsetZ
        const corners = [
          { x: posWorld.x - 0.34, y: posWorld.y - 0.28, z },
          { x: posWorld.x + 0.34, y: posWorld.y + 0.28, z }
        ].map((c) => project(c.x, c.y, c.z));
        const aabb = {
          minX: +Math.min(...corners.map((c) => c.x)).toFixed(1),
          maxX: +Math.max(...corners.map((c) => c.x)).toFixed(1),
          minY: +Math.min(...corners.map((c) => c.y)).toFixed(1),
          maxY: +Math.max(...corners.map((c) => c.y)).toFixed(1)
        };
        const caseLabel = `glove_${pos.label}_${colorPair.label}_${dim.label}`;
        const res = await captureOne(caseLabel, [record], { screen: aabb });
        res.caseKind = "glove";
        res.input = { role: "left_wrist", pos: pos.label, colors: colorPair.label, dim: dim.label };
        out.push(res);
      }
    }
  }

  // ── Both-hands-present sweep ──
  for (const bh of BOTH_HANDS) {
    for (const colorPair of COLOR_PAIRS) {
      setHandColors(colorPair);
      for (const dim of DIM_STATES) {
        const leftRecord = { role: "left_wrist", x: 0.375, y: 0.5, mode: bh.left };
        const rightRecord = { role: "right_wrist", x: 0.625, y: 0.5, mode: bh.right };
        if (dim.dimmed) { leftRecord.dimmed = true; rightRecord.dimmed = true; }
        if (bh.left === "flow") leftRecord.direction = { x: bh.leftDir.x, y: bh.leftDir.y };
        if (bh.right === "flow") rightRecord.direction = { x: bh.rightDir.x, y: bh.rightDir.y };
        // World AABB: union of both hands' geometry.
        const posL = { x: -2 + 0.375 * 4, y: 3 - 0.5 * 3 };
        const posR = { x: -2 + 0.625 * 4, y: 3 - 0.5 * 3 };
        const handCorners = (posWorld, mode, dir) => {
          if (mode === "flow") {
            const dl = Math.hypot(dir.x, dir.y);
            const ux = dl > 0 ? dir.x / dl : 0;
            const uy = dl > 0 ? dir.y / dl : -1;
            return [
              { x: posWorld.x, y: posWorld.y, z: 0.45 },
              { x: posWorld.x + ux * 0.75, y: posWorld.y + uy * 0.75, z: 0.45 }
            ];
          }
          return [
            { x: posWorld.x - 0.34, y: posWorld.y - 0.28, z: 0.5 },
            { x: posWorld.x + 0.34, y: posWorld.y + 0.28, z: 0.5 }
          ];
        };
        const allCorners = [...handCorners(posL, bh.left, bh.leftDir), ...handCorners(posR, bh.right, bh.rightDir)].map((c) => project(c.x, c.y, c.z));
        const aabb = {
          minX: +Math.min(...allCorners.map((c) => c.x)).toFixed(1),
          maxX: +Math.max(...allCorners.map((c) => c.x)).toFixed(1),
          minY: +Math.min(...allCorners.map((c) => c.y)).toFixed(1),
          maxY: +Math.max(...allCorners.map((c) => c.y)).toFixed(1)
        };
        const caseLabel = `bothhands_${bh.label}_${colorPair.label}_${dim.label}`;
        const res = await captureOne(caseLabel, [leftRecord, rightRecord], { screen: aabb });
        res.caseKind = "both-hands";
        res.input = { left: bh.left, right: bh.right, label: bh.label, colors: colorPair.label, dim: dim.label };
        out.push(res);
      }
    }
  }

  // ── Environment-mode baseline (no equipment, just the background) ──
  renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], { grid: { x: 0, y: 0, width: 1, height: 1 } });
  const envPixels = readPixels();
  const envCrop = new OffscreenCanvas(canvas.width, canvas.height);
  envCrop.getContext("2d").drawImage(canvas, 0, 0);
  const envDataUrl = await (async () => {
    const blob = await envCrop.convertToBlob({ type: "image/png" });
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
  })();
  // Mean + std of the full background (proves Aero shows the photosphere).
  let envSum = 0, envSq = 0;
  for (let i = 0; i < envPixels.length; i += 4) {
    const luma = 0.2126 * envPixels[i] + 0.7152 * envPixels[i + 1] + 0.0722 * envPixels[i + 2];
    envSum += luma; envSq += luma * luma;
  }
  const envCount = canvas.width * canvas.height;
  const envMean = envSum / envCount;
  const envStd = Math.sqrt(envSq / envCount - envMean * envMean);
  const envInfo = { meanLuma: +envMean.toFixed(1), stdLuma: +envStd.toFixed(1), mode: envMode, crop: envDataUrl };

  return { cases: out, environment: envInfo };
}

try {
  const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(childUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("aero-game");
  await page.waitForFunction(() => document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state === "ready", { timeout: 20000 });

  for (const envMode of ["aero", "camera"]) {
    console.log(`[sweep] staging environment mode: ${envMode}`);
    const { cases, environment } = await page.evaluate(runSweep, envMode);
    for (const row of cases) {
      if (row.error) {
        console.log(`[sweep] ${envMode} ${row.label} ERROR: ${row.error}`);
        results[envMode].push(row);
        continue;
      }
      results[envMode].push(row);
      (crops[envMode])[row.label] = row.crop;
      const m = row.meanRGB, e = row.edge;
      console.log(`[sweep] ${envMode} ${row.label.padEnd(40)} ${row.caseKind.padEnd(9)} w=${row.screenWidthPx} h=${row.screenHeightPx} aspect=${row.aspect.toFixed(2)} px=${row.diffPx} mean=rgb(${m.r.toFixed(0)},${m.g.toFixed(0)},${m.b.toFixed(0)})${e ? ` edge=rgb(${e.r.toFixed(0)},${e.g.toFixed(0)},${e.b.toFixed(0)})` : ""} sat=${row.meanSat.toFixed(0)} luma=${row.maxLuma.toFixed(0)}`);
    }
    results.environment[envMode] = { ...environment, crop: undefined };
    console.log(`[sweep] ${envMode} environment baseline: meanLuma=${environment.meanLuma} stdLuma=${environment.stdLuma}`);
  }
  await context.close();

  // ── Assemble the contact sheets (Node side, via a scratch page) ──
  const sheetContext = await browser.newContext({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 1 });
  const sheet = await sheetContext.newPage();
  const buildSheet = async (envMode, title, rows) => {
    const cell = (row) => {
      const url = crops[envMode][row.label];
      const m = row.meanRGB, e = row.edge;
      const stat = m ? `mean rgb(${m.r.toFixed(0)},${m.g.toFixed(0)},${m.b.toFixed(0)})<br>sat ${row.meanSat.toFixed(0)} · luma ${row.maxLuma.toFixed(0)}${e ? `<br>edge rgb(${e.r.toFixed(0)},${e.g.toFixed(0)},${e.b.toFixed(0)})` : ""}` : "—";
      return `<td><div class="lab">${row.label}</div><div class="img">${url ? `<img src="${url}">` : "<b>missing</b>"}</div><div class="stat">${stat}</div></td>`;
    };
    const html = `<!doctype html><style>body{background:#0b0f16;margin:0;padding:16px;font:12px/1.4 ui-monospace,monospace;color:#cfd8e3}h1{font-size:14px;margin:0 0 10px}table{border-collapse:collapse}td{vertical-align:top;padding:8px;background:#111722;border:1px solid #223}.lab{color:#8fa3bd;font-size:11px;margin-bottom:4px}.img img{display:block;background:#071426;border:1px solid #345;max-width:160px}.stat{margin-top:4px;color:#9fd6a5;font-size:11px}</style><h1>${title}</h1><table>${rows.map((row) => `<tr>${cell(row)}</tr>`).join("")}</table>`;
    await sheet.setContent(html);
    await sheet.waitForTimeout(250);
    const pngPath = join(EVIDENCE_DIR, `${STAMP}-${title.toLowerCase().replace(/\s+/g, "-")}-${envMode}.png`);
    await sheet.screenshot({ path: pngPath, fullPage: true });
    console.log(`[sweep] contact sheet → ${pngPath}`);
    return pngPath;
  };
  // Saber sheet: all saber cases (group by env mode, one column each).
  // Combine into one sheet with aero + camera columns per case. The sheet
  // filename slug is derived from a clean label (no parentheses).
  const saberCombined = results.aero.filter((r) => r.caseKind === "saber");
  await buildCombinedSheet(sheet, "0.0.61 baseline saber visual sweep", saberCombined, results.camera.filter((r) => r.caseKind === "saber"));
  const gloveAero = results.aero.filter((r) => r.caseKind === "glove");
  await buildCombinedSheet(sheet, "0.0.61 baseline glove visual sweep", gloveAero, results.camera.filter((r) => r.caseKind === "glove"));
  const bothAero = results.aero.filter((r) => r.caseKind === "both-hands");
  await buildCombinedSheet(sheet, "0.0.61 baseline both-hands equipment sweep", bothAero, results.camera.filter((r) => r.caseKind === "both-hands"));

  // Environment-mode baseline sheet.
  const envSheetPath = join(EVIDENCE_DIR, `${STAMP}-environment-aero-vs-camera.png`);
  const aeroEnv = results.environment.aero, camEnv = results.environment.camera;
  await sheet.setContent(`<!doctype html><style>body{background:#0b0f16;margin:0;padding:16px;font:12px/1.4 ui-monospace,monospace;color:#cfd8e3}h1{font-size:14px;margin:0 0 10px}.row{display:flex;gap:20px}.cell{background:#111722;border:1px solid #223;padding:8px}.lab{color:#8fa3bd;font-size:11px;margin-bottom:4px}.stat{margin-top:4px;color:#9fd6a5;font-size:11px}img{display:block;max-width:300px}</style><h1>Environment-mode baseline (0.0.61) — Aero (photosphere) vs Camera (hidden)</h1><div class="row"><div class="cell"><div class="lab">AERO — photosphere visible, linear-gradient clear</div><img src="${aeroEnv?.crop ?? ""}"><div class="stat">meanLuma ${aeroEnv?.meanLuma} · stdLuma ${aeroEnv?.stdLuma}</div></div><div class="cell"><div class="lab">CAMERA — photosphere hidden, solid transparent clear</div><img src="${camEnv?.crop ?? ""}"><div class="stat">meanLuma ${camEnv?.meanLuma} · stdLuma ${camEnv?.stdLuma}</div></div></div>`);
  await sheet.waitForTimeout(250);
  await sheet.screenshot({ path: envSheetPath, fullPage: true });
  console.log(`[sweep] environment baseline sheet → ${envSheetPath}`);
  await sheetContext.close();

  // ── numbers.json ──
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const jsonPath = join(EVIDENCE_DIR, `${STAMP}-equipment-sweep.json`);
  const numbers = {
    stamp: STAMP,
    note: "0.0.62 xshm equipment visual sweep — 0.0.61 BASELINE of the CURRENT saber+glove look. Per case: diff-bbox screen px, aspect, centroid, mean/edge RGB (baseline-subtracted diff pixels), maxLuma, meanSat, world AABB (camera.worldToScreen of corners). Both environment modes. No equipment 'fixes' — this is a truth capture.",
    viewport: { w: VIEW_W, h: VIEW_H },
    environments: { aero: results.environment.aero, camera: results.environment.camera },
    cases: { aero: results.aero, camera: results.camera }
  };
  // Strip the large crop dataURLs out of the JSON (they live in the PNGs).
  const strip = (arr) => arr.map((r) => { const { crop, ...rest } = r; return rest; });
  numbers.cases.aero = strip(results.aero);
  numbers.cases.camera = strip(results.camera);
  numbers.environments.aero = { ...results.environment.aero, crop: undefined };
  numbers.environments.camera = { ...results.environment.camera, crop: undefined };
  // 0.0.62 L-C (r2lb): dimmed-vs-undimmed pixel delta for saber cases.
  // For each (env, wrist, direction, color, both-hands) combo, measure the
  // mean-luma difference between the dimmed and undimmed saber crops.
  // A non-zero delta proves the saber visibly dims (the 0.0.61 baseline
  // had byte-identical dimmed/undimmed pixels — the additive-glow defect).
  const dimDelta = { aero: [], camera: [] };
  for (const env of ["aero", "camera"]) {
    const cases = results[env].filter((r) => r.caseKind === "saber");
    // Group by (pos, dir, colors, dim) from the input record to pair dim/undim.
    const groups = new Map();
    for (const r of cases) {
      const inp = r.input ?? {};
      const key = `${inp.pos}|${inp.dir}|${inp.colors}`;
      if (!groups.has(key)) groups.set(key, { dimmed: null, undimmed: null, key });
      if (inp.dim === "dimmed") groups.get(key).dimmed = r;
      else groups.get(key).undimmed = r;
    }
    for (const { key, dimmed, undimmed } of groups.values()) {
      if (!dimmed || !undimmed) continue;
      // meanLuma is derived from meanRGB (luma = 0.2126r + 0.7152g + 0.0722b).
      const luma = (rgb) => rgb ? (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) : 0;
      const dimmedLuma = luma(dimmed.meanRGB);
      const undimmedLuma = luma(undimmed.meanRGB);
      const meanLumaDelta = dimmedLuma - undimmedLuma;
      const diffPxDelta = (dimmed.diffPx ?? 0) - (undimmed.diffPx ?? 0);
      const maxLumaDelta = (dimmed.maxLuma ?? 0) - (undimmed.maxLuma ?? 0);
      dimDelta[env].push({ key, meanLumaDelta: +meanLumaDelta.toFixed(2), diffPxDelta, maxLumaDelta: +maxLumaDelta.toFixed(2), dimmedDiffPx: dimmed.diffPx ?? 0, undimmedDiffPx: undimmed.diffPx ?? 0 });
    }
  }
  numbers.dimmedVsUndimmed = dimDelta;
  const allDelta = [...dimDelta.aero, ...dimDelta.camera];
  const meanLumaDeltas = allDelta.map((d) => d.meanLumaDelta).filter((v) => v !== 0);
  if (meanLumaDeltas.length > 0) {
    const avg = meanLumaDeltas.reduce((a, b) => a + b, 0) / meanLumaDeltas.length;
    console.log(`[sweep] dimmed-vs-undimmed saber delta: ${meanLumaDeltas.length} paired cases, avg meanLumaDelta=${avg.toFixed(2)} (0.0.61 baseline was 0.00 — byte-identical)`);
  } else {
    console.log("[sweep] WARNING: no dimmed-vs-undimmed saber delta measured (no paired cases)");
  }
  writeFileSync(jsonPath, JSON.stringify(numbers, null, 2));
  console.log(`[sweep] measured table → ${jsonPath}`);
  console.log(`[sweep] cases: aero=${results.aero.length} camera=${results.camera.length} (saber ${results.aero.filter((r) => r.caseKind === "saber").length}, glove ${results.aero.filter((r) => r.caseKind === "glove").length}, both-hands ${results.aero.filter((r) => r.caseKind === "both-hands").length} per env)`);
} finally {
  await browser.close();
  // The known Vite close fix (from validate-vite-fs-allowlist.js): with
  // watch:null there is no chokidar to wait on; hold the loop alive a beat
  // while httpServer.closeAllConnections() + close() settle, so the process
  // exits cleanly instead of an "unsettled top-level await".
  await new Promise((resolve) => setTimeout(resolve, 50));
  try { vite.httpServer?.closeAllConnections?.(); } catch { /* ignore */ }
  await vite.close();
}
console.log("[sweep] DONE");

// Helper: build a combined aero+camera contact sheet for one case family.
async function buildCombinedSheet(sheet, title, aeroRows, cameraRows) {
  const cell = (envMode, row) => {
    const url = crops[envMode][row.label];
    const m = row.meanRGB, e = row.edge;
    const stat = m ? `rgb(${m.r.toFixed(0)},${m.g.toFixed(0)},${m.b.toFixed(0)})<br>sat ${row.meanSat.toFixed(0)} · luma ${row.maxLuma.toFixed(0)}${e ? `<br>edge rgb(${e.r.toFixed(0)},${e.g.toFixed(0)},${e.b.toFixed(0)})` : ""}` : "—";
    return `<td><div class="lab">${envMode}</div><div class="img">${url ? `<img src="${url}">` : "<b>missing</b>"}</div><div class="stat">${stat}</div></td>`;
  };
  const rows = aeroRows.map((row, i) => {
    const cam = cameraRows[i];
    return `<tr><th class="case">${row.label}</th>${cell("aero", row)}${cell("camera", cam ?? { label: "missing", meanRGB: null })}</tr>`;
  }).join("");
  const html = `<!doctype html><style>body{background:#0b0f16;margin:0;padding:16px;font:12px/1.4 ui-monospace,monospace;color:#cfd8e3}h1{font-size:14px;margin:0 0 10px}table{border-collapse:collapse}td,th{vertical-align:top;padding:8px;background:#111722;border:1px solid #223}.lab{color:#8fa3bd;font-size:11px;margin-bottom:4px}th.case{color:#9fd6a5;font-size:11px;text-align:left;padding:4px 8px}.img img{display:block;background:#071426;border:1px solid #345;max-width:150px}.stat{margin-top:4px;color:#9fd6a5;font-size:11px}</style><h1>${title}</h1><table><tr><th>case</th><th>Aero (photosphere)</th><th>Camera (hidden)</th></tr>${rows}</table>`;
  await sheet.setContent(html);
  await sheet.waitForTimeout(250);
  const pngPath = join(EVIDENCE_DIR, `${STAMP}-${title.toLowerCase().replace(/\s+/g, "-")}-combined.png`);
  await sheet.screenshot({ path: pngPath, fullPage: true });
  console.log(`[sweep] combined contact sheet → ${pngPath}`);
}
