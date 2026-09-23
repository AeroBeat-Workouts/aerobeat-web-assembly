// @ts-check

// 0.0.61 L-C1 (htc8) real-pixel oracle — Flow NOTE spawning: directional
// notes (up / right / up-right) and the directionless orb must
//   (1) appear, before commit, as a substantial glyph at the EXACT lane-column
//       grid position (lastModel icon world position + worldToScreen
//       projection; diff-pixel centroid within a tight px bound),
//   (2) carry the SONG PALETTE per-hand fill (left #2693FF blue / right
//       #39C96B green) — a hand-swapped or neutral fill fails,
//   (3) show the DIRECTION'S glyph: each authored direction's rotated-arrow
//       pixel signature differs from every other direction's AND from the
//       orb's (centroid-aligned 40×40 glyph masks, pairwise Jaccard distance
//       > 0.12; measured 0.200..0.378), and
//   (4) after a REAL committed hit, the note pixels DECAY over the 350 ms
//       feedback/fade window: the saturated hand-color core is strong at
//       commit +20 ms, ≤ half by +40 ms, essentially gone by +250 ms, while
//       the live icon is still in lastModel at +40 ms and removed by +250 ms.
// Proven by reading REAL rendered canvas pixels (OffscreenCanvas drawImage +
// getImageData of the PlayCanvas canvas) against a baseline-subtracted diff
// (same frame minus the note's target — |Δr|+|Δg|+|Δb| ≥ 24), NOT the
// scene-graph model.
//
// What this oracle drives: a REAL flow_colliders_v1 session through the
// public input path (measured wrist evidence; 0.0.61 detection is the saber
// capsule — 0.75 WU beam from the wrist along the wrist-history direction —
// with the authored-direction check for directional notes). Four notes,
// spaced 4 s apart so no two approach windows overlap:
//   n-up       left  placement 5 (col 1, mid row)  dir "up"       6000 ms
//   n-right    right placement 6 (col 2, mid row)  dir "right"    10000 ms
//   n-upright  left  placement 1 (col 1, TOP row)  dir "up-right" 14000 ms
//   n-orb      right placement 8 (col 0, bot row)  (no direction) 18000 ms
// Each own wrist sweeps through the note's 1×1 judge cell IN the authored
// direction (40 ms steps, prior→current displacement ≥ 0.05 exactly along
// the authored direction), so every note commits a REAL hit inside the
// ±180 ms window (measured commits: −80 ms for the directional notes,
// −120 ms for the orb). GATE-ASSERT: each note projects as kind "flow" with
// the authored cell/hand/direction AND commits a real hit.
//
// Spawn geometry (calibrated, single-embedding, 844×390 dpr-1):
//   pre-commit at center − 600 ms → icon world (columnX[col], rowY[row],
//   −3.6 WU) (timeline future is world −Z); glyph core (diff pixels within
//   ±24 px of the projected icon anchor) 971..1104 px, bbox centroid within
//   1 px of the anchor, mid-luma fill: left b−r 161..167 (b ≈ 215..218),
//   right g−r 91..108 / g−b 50..60 (g ≈ 160..168).
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface).
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const VIEW_W = 844;
const VIEW_H = 390;
// Pairwise glyph-mask Jaccard distances must exceed this (measured minimum
// 0.200: orb vs. its nearest directional arrow). All other thresholds live
// in the page-scope block inside evaluate() (node scope is not visible there).
const MIN_JACCARD_DIST = 0.12;

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parent = createHttpServer((_request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parent.listen(0, "127.0.0.1", resolve));
const address = parent.address();
if (!address || typeof address === "string") throw new Error("Parent URL unavailable");
const parentUrl = `http://localhost:${address.port}/`;
const browser = await chromium.launch({ headless: true });
const matrix = [];
try {
  for (const embedding of ["direct", "genuine_cross_origin_iframe"]) {
    const context = await browser.newContext({ viewport: embedding === "direct" ? { width: VIEW_W, height: VIEW_H } : { width: 868, height: 414 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const noise = [];
    page.on("console", (message) => { const type = message.type(), text = message.text(), location = message.location(); if (["warning", "error"].includes(type) && !isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, childUrl) && !isExpectedPlaycanvasMeshWarning(type, text)) noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`); });
    page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
    try {
      await page.goto(embedding === "direct" ? childUrl : parentUrl, { waitUntil: "networkidle" });
      const target = embedding === "direct" ? page : page.frames().find((frame) => frame !== page.mainFrame());
      if (!target) throw new Error("Cross-origin child missing");
      await target.waitForSelector("aero-game");
      await target.waitForFunction(() => document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state === "ready", { timeout: 15000 });
      const proof = await target.evaluate(async () => {
        // (page-scope copies of the thresholds — Node scope is not visible here)
        const PRE_COMMIT_OFFSET_MS = 600;
        const APPROACH_Z_WU = -3.6;
        const CORE_BOX_PX = 24;
        const MIN_GLYPH_PIXELS = 800;
        const CENTROID_TOLERANCE_PX = 8;
        const MIN_FILL_PIXELS = 300;
        const FADE_OFFSETS_MS = [20, 40, 250, 340];
        const FADE_BOX_PX = 40;
        const MIN_SAT_AT_20 = 360;
        const FADE_HALF_BOUND = 0.5;
        const SAT_AT_250_BOUND = 60;
        const NOTES = [
          { eventId: "n-up", hand: "left", placement: 5, direction: "up", center: 6000 },
          { eventId: "n-right", hand: "right", placement: 6, direction: "right", center: 10000 },
          { eventId: "n-upright", hand: "left", placement: 1, direction: "up-right", center: 14000 },
          { eventId: "n-orb", hand: "right", placement: 8, direction: null, center: 18000 },
        ];
        const game = document.querySelector("aero-game");
        const renderer = game.graph.renderer;
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
        renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
        const [{ createAeroGameplaySessionCoordinator }, { projectAftermathEntries, projectHazardContactEvents }, { projectSessionTargets, createSessionTargetIndex }, { gameplayWorldGrid }] = await Promise.all([
          import("/node_modules/@aerobeat/web-gameplay/src/index.js"),
          import("/src/gameplay-frame-effects.js"),
          import("/src/session-render-projection.js"),
          import("/node_modules/@aerobeat/web-renderer/src/index.js"),
        ]);
        const HASH = "c7".repeat(32);
        const variant = { variantId: "lcb1-flow", chartId: "chart-lcb1-flow", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const events = NOTES.map((n) => Object.freeze({
          schema: "aerobeat/resolved_content_event", version: 3,
          eventId: n.eventId, variantId: variant.variantId, chartId: variant.chartId,
          centerTimestampMs: n.center, sourceEventIds: [`s-${n.eventId}`],
          authoredBeat: Object.freeze({ type: "note", hand: n.hand, placement: n.placement, ...(n.direction ? { direction: n.direction } : {}) }),
        }));
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, lw, rw) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, 2, 1.5), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, lw.x, lw.y), anchor("right_wrist", m, rw.x, rw.y)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        const { standaloneTestEquipmentPoses } = await import("/src/test-equipment-authoring.js"); await game.ensureEquipmentConfigIdentity();
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "lcb1-flow-browser", countdownStepMs: 1 });
        coordinator.configureContent({ packageId: "lcb1-flow-pkg", selectedVariant: variant, resolvedEvents: events, profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false } });
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        coordinator.requestStart(0);
        const step = (songMs,lw,rw,id) => { const input=inputSnap(songMs,evidence(id,songMs,lw,rw)); return coordinator.advance({timestampMs:songMs,clock:clockSnap(songMs,true),input,equipmentPoses:standaloneTestEquipmentPoses("flow",input,game.equipmentConfigIdentity)}); };
        for (let t = 1; t <= 40; t += 1) {
          coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
          if (coordinator.getSnapshot().session.state === "playing") break;
        }
        if (coordinator.getSnapshot().session.state !== "playing") throw new Error("session not playing after countdown");
        // Drive: own wrist sweeps through the note's judge cell IN the authored
        // direction (40 ms steps → prior→current displacement 0.35 ≥ 0.05,
        // exact authored direction); the other wrist idles at (3.5, 2.2),
        // clear of every authored cell box. Hits commit inside the window:
        // directional notes at center − 80 ms (capsule p0 inside the cell box
        // at the first in-window direction-valid sample), the orb (no
        // direction check) at center − 120 ms.
        const IDLE = { x: 3.5, y: 2.2 };
        const DRIVES = {
          "n-up": [[-120, { x: 1, y: 0.4 }], [-80, { x: 1, y: 0.75 }], [-40, { x: 1, y: 1.05 }], [0, { x: 1, y: 1.05 }], [80, { x: 1, y: 1.05 }]],
          "n-right": [[-120, { x: 1.4, y: 1.0 }], [-80, { x: 1.75, y: 1.0 }], [-40, { x: 2.05, y: 1.0 }], [0, { x: 2.05, y: 1.0 }], [80, { x: 2.05, y: 1.0 }]],
          "n-upright": [[-120, { x: 0.4, y: 1.4 }], [-80, { x: 0.75, y: 1.75 }], [-40, { x: 1.1, y: 2.1 }], [0, { x: 1.1, y: 2.1 }], [80, { x: 1.1, y: 2.1 }]],
          "n-orb": [[-120, { x: 0, y: -0.3 }], [-80, { x: 0, y: 0 }], [-40, { x: 0, y: 0.3 }], [0, { x: 0, y: 0.3 }], [80, { x: 0, y: 0.3 }]],
        };
        for (const n of NOTES) {
          for (const [d, pos] of DRIVES[n.eventId]) {
            const lw = n.hand === "left" ? pos : IDLE;
            const rw = n.hand === "right" ? pos : IDLE;
            step(n.center + d, lw, rw, `${n.eventId}${d}`);
          }
        }
        const snap = coordinator.getSnapshot();
        // GATE-ASSERT: projection kind/cell/hand/direction + real committed HIT
        // inside the ±180 ms window for every note.
        const index = createSessionTargetIndex(events, {});
        const commits = new Map();
        for (const n of NOTES) {
          // Each note is visible only from its own normalSpawnMs = center − 2500,
          // so project at the note's OWN pre-commit time.
          const t = projectSessionTargets(events, snap, n.center - PRE_COMMIT_OFFSET_MS, index).find((e) => e.id === n.eventId);
          if (!t || t.kind !== "flow" || t.cell !== n.placement || t.hand !== n.hand || t.direction !== n.direction) throw new Error(`${n.eventId} must project as kind "flow" cell ${n.placement} hand ${n.hand} direction ${JSON.stringify(n.direction)}, got ${JSON.stringify(t ?? null)}`);
          const hit = snap.judgements.find((j) => j.eventId === n.eventId);
          if (!hit || hit.result !== "hit") throw new Error(`expected a real committed HIT for ${n.eventId}, got ${JSON.stringify(hit ?? null)} judgements=${JSON.stringify(snap.judgements.map((j) => [j.eventId, j.result]))}`);
          const commit = Number(hit.committedTimelinePositionMs);
          if (Math.abs(commit - n.center) > 180) throw new Error(`${n.eventId} commit ${commit} outside the ±180 ms window of center ${n.center}`);
          commits.set(n.eventId, commit);
        }
        // ── Pixel-level oracle ──
        const canvas = game.shadowRoot.querySelector("canvas");
        const readPixels = () => {
          const sample = new OffscreenCanvas(canvas.width, canvas.height);
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, sample.width, sample.height).data;
        };
        // World → screen through the LIVE production camera (top-left origin,
        // y DOWN — no manual flip).
        const project = (x, y, z) => {
          const out = renderer.cameraEntity.camera.worldToScreen({ x, y, z });
          return { x: out.x, y: out.y };
        };
        // Frame derivation EXACTLY like the assembly rendererFrame() (minimal
        // field set, as in the gated 0.0.59 oracles; renderer applies defaults).
        const frameAt = (nowMs) => {
          const s = coordinator.getSnapshot();
          const targets = projectSessionTargets(events, s, nowMs, index);
          const aftermath = projectAftermathEntries(events, s, nowMs, targets, index);
          const hazardContacts = projectHazardContactEvents(s, nowMs);
          return { presentation: "flow", nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath, hazardContacts };
        };
        const diffPixels = (full, base) => {
          const W = canvas.width, H = canvas.height, out = [];
          for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
            const i = (y * W + x) * 4;
            if (Math.abs(full[i] - base[i]) + Math.abs(full[i + 1] - base[i + 1]) + Math.abs(full[i + 2] - base[i + 2]) >= 24) out.push({ x, y, r: full[i], g: full[i + 1], b: full[i + 2] });
          }
          return out;
        };
        // Full-scan FNV over every pixel byte — a strided hash can collide when
        // the frame-to-frame change falls between samples.
        const hashOf = (data) => { let h = 0x811c9dc5; for (let i = 0; i < data.length; i += 4) { h ^= data[i]; h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0; } return h; };
        const freezeGuard = { lastFrameCount: -1, lastHash: null };
        const guard = (tag) => {
          const fc = renderer.describe().frameCount;
          if (fc === freezeGuard.lastFrameCount) throw new Error(`${tag}: renderer frameCount did not advance (frozen render)`);
          const px = readPixels();
          const h = hashOf(px);
          if (freezeGuard.lastHash !== null && h === freezeGuard.lastHash) throw new Error(`${tag}: pixel hash did not change (frozen frame)`);
          freezeGuard.lastFrameCount = fc;
          freezeGuard.lastHash = h;
          return px;
        };
        // Saturated hand-color predicate (the note FILL, not the desaturated
        // aftermath halves, not the white feedback text, not the receptor band).
        const isSat = (q, hand) => (hand === "left" ? q.b - q.r >= 40 && q.b > 90 : q.g - q.r >= 30 && q.g - q.b >= 8 && q.g > 90);
        const notes = [];
        for (const n of NOTES) {
          const commit = commits.get(n.eventId);
          const col = n.placement % 4;
          const row = Math.floor(n.placement / 4);
          const expX = gameplayWorldGrid.columnX[col];
          const expY = gameplayWorldGrid.rowY[row];
          // (1)+(2)+(3) pre-commit spawn: icon world position, glyph core,
          // per-hand hue, glyph mask for the direction signature.
          const preFrame = frameAt(n.center - PRE_COMMIT_OFFSET_MS);
          renderer.renderGameplayFrame(preFrame);
          guard(`${n.eventId} pre full`);
          const preIcon = renderer.lastModel.objects.find((o) => o.kind === "icon" && o.targetId === n.eventId);
          if (!preIcon) throw new Error(`${n.eventId}: no live note icon in lastModel at center − ${PRE_COMMIT_OFFSET_MS} ms`);
          const { x: iw, y: iy, z: iz } = preIcon.position;
          if (Math.abs(iw - expX) > 1e-6 || Math.abs(iy - expY) > 1e-6 || Math.abs(iz - APPROACH_Z_WU) > 0.05) throw new Error(`${n.eventId}: pre-commit icon world position must be (${expX}, ${expY}, ${APPROACH_Z_WU} ± 0.05), got (${iw}, ${iy}, ${iz})`);
          const an = project(iw, iy, iz);
          const preBaseFrame = { ...preFrame, targets: preFrame.targets.filter((t) => t.id !== n.eventId) };
          renderer.renderGameplayFrame(preBaseFrame);
          const preBase = guard(`${n.eventId} pre base`);
          renderer.renderGameplayFrame(preFrame);
          const preFull = guard(`${n.eventId} pre full2`);
          const core = diffPixels(preFull, preBase).filter((q) => Math.abs(q.x - an.x) <= CORE_BOX_PX && Math.abs(q.y - an.y) <= CORE_BOX_PX);
          if (core.length < MIN_GLYPH_PIXELS) throw new Error(`${n.eventId}: pre-commit note glyph must be substantially present at its lane column (got ${core.length} diff pixels, min ${MIN_GLYPH_PIXELS})`);
          const xs = core.map((q) => q.x), ys = core.map((q) => q.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          const dX = (minX + maxX) / 2 - an.x, dY = (minY + maxY) / 2 - an.y;
          if (Math.abs(dX) > CENTROID_TOLERANCE_PX || Math.abs(dY) > CENTROID_TOLERANCE_PX) throw new Error(`${n.eventId}: pre-commit glyph bbox center (${((minX + maxX) / 2).toFixed(1)}, ${((minY + maxY) / 2).toFixed(1)}) must sit at the projected icon position (${an.x.toFixed(1)}, ${an.y.toFixed(1)}) within ${CENTROID_TOLERANCE_PX} px (a wrong lane column misses by ~${(Math.abs(gameplayWorldGrid.columnX[(col + 1) % 4] - expX) * 87.6).toFixed(0)} px at the hit plane)`);
          // Per-hand hue of the mid-luma fill.
          let sr = 0, sg = 0, sb = 0, fn = 0;
          for (const q of core) {
            const luma = 0.2126 * q.r + 0.7152 * q.g + 0.0722 * q.b;
            if (luma >= 55 && luma <= 170) { sr += q.r; sg += q.g; sb += q.b; fn += 1; }
          }
          if (fn < MIN_FILL_PIXELS) throw new Error(`${n.eventId}: glyph fill sample too small (n=${fn}, min ${MIN_FILL_PIXELS})`);
          const bMinusR = (sb - sr) / fn, gMinusR = (sg - sr) / fn, gMinusB = (sg - sb) / fn, bAvg = sb / fn, gAvg = sg / fn;
          if (n.hand === "left") {
            if (bMinusR < 90 || bAvg < 180) throw new Error(`${n.eventId} (LEFT hand): glyph fill must be a tint of leftHandColor #2693FF (blue-dominant: b − r ≥ 90, b ≥ 180; got b − r = ${bMinusR.toFixed(1)}, b = ${bAvg.toFixed(0)})`);
          } else {
            if (gMinusR < 50 || gMinusB < 25) throw new Error(`${n.eventId} (RIGHT hand): glyph fill must be a tint of rightHandColor #39C96B (green-dominant: g − r ≥ 50 AND g − b ≥ 25; got g − r = ${gMinusR.toFixed(1)}, g − b = ${gMinusB.toFixed(1)})`);
          }
          // Centroid-aligned 40×40 glyph mask (the direction signature).
          let sx = 0, sy = 0;
          for (const q of core) { sx += q.x; sy += q.y; }
          const cx = sx / core.length, cy = sy / core.length;
          const S2 = 40;
          const bits = new Uint8Array(S2 * S2);
          for (const q of core) {
            const bx = Math.round(q.x - cx + S2 / 2), by = Math.round(q.y - cy + S2 / 2);
            if (bx >= 0 && bx < S2 && by >= 0 && by < S2) bits[by * S2 + bx] = 1;
          }
          // (4) removal fade across the 350 ms feedback window: the live icon
          // (saturated hand-color fill) decays while the desaturated aftermath
          // halves + white feedback text take over.
          const frameC = frameAt(commit);
          renderer.renderGameplayFrame(frameC);
          const iconC = renderer.lastModel.objects.find((o) => o.kind === "icon" && o.targetId === n.eventId);
          if (!iconC) throw new Error(`${n.eventId}: no note icon in the commit frame lastModel`);
          const cpos = project(iconC.position.x, iconC.position.y, iconC.position.z);
          const fades = {};
          for (const off of FADE_OFFSETS_MS) {
            const f = frameAt(commit + off);
            renderer.renderGameplayFrame(f);
            const ic = renderer.lastModel.objects.find((o) => o.kind === "icon" && o.targetId === n.eventId);
            const baseFrame = { ...f, targets: f.targets.filter((t) => t.id !== n.eventId), aftermath: f.aftermath.filter((e) => e.targetId !== n.eventId) };
            renderer.renderGameplayFrame(baseFrame);
            const b2 = guard(`${n.eventId} +${off} base`);
            renderer.renderGameplayFrame(f);
            const f2 = guard(`${n.eventId} +${off} full`);
            const boxPx = diffPixels(f2, b2).filter((q) => Math.abs(q.x - cpos.x) <= FADE_BOX_PX && Math.abs(q.y - cpos.y) <= FADE_BOX_PX);
            fades[off] = { icon: !!ic, sat: boxPx.filter((q) => isSat(q, n.hand)).length };
          }
          const sat20 = fades[20].sat, sat40 = fades[40].sat, sat250 = fades[250].sat;
          if (!fades[20].icon || !fades[40].icon) throw new Error(`${n.eventId}: the live note icon must still be in lastModel at commit +20/+40 ms (removal is 80 ms), got icon=${fades[20].icon}/${fades[40].icon}`);
          if (fades[250].icon || fades[340].icon) throw new Error(`${n.eventId}: the note icon must be removed from lastModel by commit +250/+340 ms (inside the 350 ms fade window), got ${fades[250].icon}/${fades[340].icon}`);
          if (sat20 < MIN_SAT_AT_20) throw new Error(`${n.eventId}: the note's saturated hand-color core at commit +20 ms must be strong (got ${sat20} px, min ${MIN_SAT_AT_20})`);
          if (sat40 > FADE_HALF_BOUND * sat20) throw new Error(`${n.eventId}: the saturated core must decay to ≤ ${FADE_HALF_BOUND * 100}% of the +20 ms value by commit +40 ms (got ${sat40} vs ${sat20})`);
          if (sat250 > SAT_AT_250_BOUND) throw new Error(`${n.eventId}: by commit +250 ms (inside the 350 ms fade window) the saturated note core must be essentially gone (got ${sat250} px, bound ${SAT_AT_250_BOUND})`);
          notes.push({
            eventId: n.eventId, hand: n.hand, direction: n.direction, placement: n.placement,
            commitOff: commit - n.center,
            pre: { world: [iw, iy, +iz.toFixed(2)], coreCount: core.length, dX: +dX.toFixed(1), dY: +dY.toFixed(1), fill: { n: fn, bMinusR: +bMinusR.toFixed(1), gMinusR: +gMinusR.toFixed(1), gMinusB: +gMinusB.toFixed(1), b: +bAvg.toFixed(0), g: +gAvg.toFixed(0) } },
            mask: Array.from(bits).join(""),
            fade: { sat20, sat40, sat250, sat340: fades[340].sat, iconAt40: fades[40].icon, iconAt250: fades[250].icon },
          });
        }
        return { notes };
      });
      if (noise.length > 0) throw new Error(`unexpected console/page noise: ${JSON.stringify(noise)}`);
      matrix.push({ embedding, ...proof });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  // (3) direction signature: pairwise centroid-aligned glyph-mask Jaccard
  //     distances — every directional note differs from the orb AND from the
  //     other directions (a wrong/unrotated glyph collapses these distances).
  const jaccard = (a, b) => {
    let inter = 0, uni = 0;
    for (let i = 0; i < a.length; i += 1) {
      const x = a[i] === "1", y = b[i] === "1";
      if (x || y) uni += 1;
      if (x && y) inter += 1;
    }
    return uni ? 1 - inter / uni : 1;
  };
  const jMatrix = {};
  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const m of matrix) {
    for (let i = 0; i < m.notes.length; i += 1) for (let j = i + 1; j < m.notes.length; j += 1) {
      const d = +jaccard(m.notes[i].mask, m.notes[j].mask).toFixed(3);
      const key = pairKey(m.notes[i].eventId, m.notes[j].eventId);
      jMatrix[`${m.embedding}:${key}`] = d;
      const aDir = m.notes[i].direction !== null, bDir = m.notes[j].direction !== null;
      if (d < MIN_JACCARD_DIST) throw new Error(`${m.embedding} ${key}: glyph signatures must differ (Jaccard distance ${d} < ${MIN_JACCARD_DIST}) — the ${aDir ? "arrow" : "orb"} for ${m.notes[i].eventId} looks like the ${bDir ? "arrow" : "orb"} for ${m.notes[j].eventId}`);
    }
  }
  // Cross-embedding parity: same deterministic chart, same camera.
  const [direct, iframe] = matrix;
  assert.equal(direct.notes.length, 4);
  assert.equal(direct.notes.length, iframe.notes.length);
  direct.notes.forEach((row, i) => {
    const o = iframe.notes[i];
    assert.equal(row.eventId, o.eventId, "note order must agree across embeddings");
    assert.equal(row.commitOff, o.commitOff, `${row.eventId}: commit offset must agree across embeddings`);
    assert.ok(Math.abs(row.pre.coreCount - o.pre.coreCount) <= 100, `${row.eventId}: core count must agree across embeddings (${row.pre.coreCount} vs ${o.pre.coreCount})`);
    assert.ok(Math.abs(row.pre.dX - o.pre.dX) <= 3 && Math.abs(row.pre.dY - o.pre.dY) <= 3, `${row.eventId}: glyph centroid must agree across embeddings`);
    for (const key of ["bMinusR", "gMinusR", "gMinusB"]) assert.ok(Math.abs(row.pre.fill[key] - o.pre.fill[key]) <= 12, `${row.eventId}: fill ${key} must agree across embeddings (${row.pre.fill[key]} vs ${o.pre.fill[key]})`);
    assert.ok(Math.abs(row.fade.sat20 - o.fade.sat20) <= 130, `${row.eventId}: saturated core must agree across embeddings (${row.fade.sat20} vs ${o.fade.sat20})`);
    // Glyph signatures must agree across embeddings too.
    for (let j = 0; j < direct.notes.length; j += 1) {
      if (j === i) continue;
      const keyA = row.eventId < direct.notes[j].eventId ? `${row.eventId}|${direct.notes[j].eventId}` : `${direct.notes[j].eventId}|${row.eventId}`;
      const da = jMatrix[`direct:${keyA}`], db = jMatrix[`genuine_cross_origin_iframe:${keyA}`];
      assert.ok(da !== undefined && db !== undefined, `missing jaccard entry for ${keyA}`);
      assert.ok(Math.abs(da - db) <= 0.05, `${keyA}: glyph Jaccard must agree across embeddings (${da} vs ${db})`);
    }
  });
  const summary = matrix.map((m) => ({
    embedding: m.embedding,
    notes: m.notes.map((p) => ({ id: p.eventId, hand: p.hand, dir: p.direction, commitOff: p.commitOff, core: p.pre.coreCount, dX: p.pre.dX, dY: p.pre.dY, fill: p.pre.fill, fade: p.fade })),
    jaccard: Object.fromEntries(Object.entries(jMatrix).filter(([k]) => k.startsWith(m.embedding)).map(([k, v]) => [k.split(":")[1], v])),
  }));
  console.log(`ORACLE 0.0.61-flow-note-spawn-pixels PASS: embeddings=2, notes=4, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
