// @ts-check

// 0.0.61 L-C1 (htc8) real-pixel oracle — Flow BOMB spawning + contact
// vignette. Bombs are NEUTRAL, non-scoring hazards (never judged):
//   (1) SPAWN: a real flow `bomb` at an authored cell renders its urchin
//       glyph at the exact lane-column grid position (lastModel icon world
//       position + worldToScreen; diff-pixel centroid within a tight px
//       bound) in the neutral obstacle-role color #E5484D (red-dominant
//       fill — not the per-hand song palette).
//   (2) CONTACT: a measured wrist saber clip through the bomb's ±180 ms
//       timing window produces a REAL hazard outcome {kind:"bomb",
//       result:"contact"} and renders the proven RED EDGE-BAND VIGNETTE
//       (outer 15% edge band, r > g·1.15 && r > b·1.1 && r > 40; detector
//       from validate-0.0.58-boxing-vignette-pixels.js): red-tinted edge
//       pixels rise well above the no-contact baseline, and the scene
//       model's hazardGlow.intensity reads the deterministic envelope
//       value (≈ 0.92 at contact +200 ms: 150 ms ramp / 600 ms decay).
//   (3) NO JUDGEMENT: bombs never receive a judgement — the snapshot must
//       carry hazardOutcomes only, no judgement entries for either bomb.
//   (4) AVOIDED: a second bomb where both wrists stay tracked continuously
//       across the whole window (never clipping the cell) resolves to the
//       real outcome {result:"avoided"} and produces NO vignette —
//       hazardGlow.intensity stays 0 and the red edge band equals baseline.
// Proven by reading REAL rendered canvas pixels (OffscreenCanvas drawImage
// + getImageData) against baseline-subtracted frames, NOT the scene-graph
// model (the glow intensity read is a secondary deterministic check).
//
// Chart (flow_colliders_v1), bombs 4 s apart so windows never overlap:
//   bomb-a  placement 5 (col 1, mid row, judge (1,1))  6000 ms — CONTACT
//   bomb-b  placement 8 (col 0, bot row, judge (0,0))  10000 ms — AVOIDED
// Contact drive: own left wrist held at the cell center from center −120 ms
// (saber capsule origin inside the 1×1 cell box → immediate contact).
// Avoided drive: both wrists at idle positions, continuous 40 ms samples
// from 9680 to 10240 ms — full [center−180, center+180] coverage for both
// wrists with zero capsule contact → "avoided".
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface).
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const VIEW_W = 844;
const VIEW_H = 390;

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
        // (page-scope copies of the thresholds — node scope is not visible here)
        const PRE_COMMIT_OFFSET_MS = 600;
        const APPROACH_Z_WU = -3.6; // −(600 ms) × 0.006 WU/ms
        const CORE_BOX_PX = 24;
        const MIN_BOMB_GLYPH_PIXELS = 500;
        const CENTROID_TOLERANCE_PX = 10;
        // Minimum strongly-red core pixels (r > g·1.15 && r > b·1.1 && r > 40;
        // the urchin's lit surface — measured 34 at z = −3.6).
        const MIN_BOMB_FILL_PIXELS = 20;
        const GLOW_ELAPSED_MS = 200; // contact + 200 ms → envelope 1 − (200−150)/600 = 0.9167
        const MIN_GLOW_INTENSITY = 0.85;
        const BOMB_A = { eventId: "bomb-a", placement: 5, center: 6000 };
        const BOMB_B = { eventId: "bomb-b", placement: 8, center: 10000 };
        const BOMBS = [BOMB_A, BOMB_B];
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
        const HASH = "d9".repeat(32);
        const variant = { variantId: "lcb1-bomb", chartId: "chart-lcb1-bomb", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const events = BOMBS.map((b) => Object.freeze({
          schema: "aerobeat/resolved_content_event", version: 3,
          eventId: b.eventId, variantId: variant.variantId, chartId: variant.chartId,
          centerTimestampMs: b.center, sourceEventIds: [`s-${b.eventId}`],
          authoredBeat: Object.freeze({ type: "bomb", placement: b.placement }),
        }));
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, lw, rw) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, 2, 1.5), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, lw.x, lw.y), anchor("right_wrist", m, rw.x, rw.y)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "lcb1-bomb-browser", countdownStepMs: 1 });
        coordinator.configureContent({ packageId: "lcb1-bomb-pkg", selectedVariant: variant, resolvedEvents: events, profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false } });
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        coordinator.requestStart(0);
        const step = (songMs, lw, rw, id) => coordinator.advance({ timestampMs: songMs, clock: clockSnap(songMs, true), input: inputSnap(songMs, evidence(id, songMs, lw, rw)) });
        for (let t = 1; t <= 40; t += 1) {
          coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
          if (coordinator.getSnapshot().session.state === "playing") break;
        }
        if (coordinator.getSnapshot().session.state !== "playing") throw new Error("session not playing after countdown");
        const IDLE_L = { x: 3.5, y: 2.2 };
        const IDLE_R = { x: 2.8, y: 2.2 };
        // (2) CONTACT drive: left wrist at the bomb-a cell center (1,1) —
        //     the saber capsule origin is inside the 1×1 cell box, so the
        //     first in-window sample detonates the bomb (contact is
        //     direction-free for bombs).
        step(5880, { x: 1, y: 1 }, IDLE_R, "ba1");
        step(5930, { x: 1, y: 1 }, IDLE_R, "ba2");
        // (4) AVOIDED drive: both wrists tracked continuously (40 ms steps,
        //     gap ≪ 150 ms) across bomb-b's whole ±180 ms window, far from
        //     its cell box → full left+right coverage, zero contact.
        for (let t = 9680; t <= 10240; t += 40) {
          step(t, IDLE_L, IDLE_R, `bb${t}`);
        }
        const snap = coordinator.getSnapshot();
        // GATE-ASSERTS: real hazard outcomes, and NO judgements for bombs.
        const outcomeA = snap.hazardOutcomes.find((o) => o.eventId === BOMB_A.eventId);
        if (!outcomeA || outcomeA.kind !== "bomb" || outcomeA.result !== "contact" || outcomeA.consequenceApplied !== true) throw new Error(`bomb-a must produce a real CONTACT hazard outcome, got ${JSON.stringify(outcomeA ?? null)}`);
        const contactAtMs = Number(outcomeA.committedTimelinePositionMs);
        if (Math.abs(contactAtMs - BOMB_A.center) > 180) throw new Error(`bomb-a contact at ${contactAtMs} outside the ±180 ms window of center ${BOMB_A.center}`);
        const outcomeB = snap.hazardOutcomes.find((o) => o.eventId === BOMB_B.eventId);
        if (!outcomeB || outcomeB.kind !== "bomb" || outcomeB.result !== "avoided" || outcomeB.consequenceApplied !== false) throw new Error(`bomb-b must produce a real AVOIDED hazard outcome, got ${JSON.stringify(outcomeB ?? null)}`);
        for (const b of BOMBS) {
          const j = snap.judgements.find((entry) => entry.eventId === b.eventId);
          if (j) throw new Error(`bombs never receive judgements, but ${b.eventId} has one: ${JSON.stringify(j)}`);
        }
        const index = createSessionTargetIndex(events, {});
        const frameAt = (nowMs, hazardContacts) => {
          const s = coordinator.getSnapshot();
          const targets = projectSessionTargets(events, s, nowMs, index);
          const aftermath = projectAftermathEntries(events, s, nowMs, targets, index);
          return { presentation: "flow", nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath, hazardContacts };
        };
        // ── Pixel-level oracle ──
        const canvas = game.shadowRoot.querySelector("canvas");
        const readPixels = () => {
          const sample = new OffscreenCanvas(canvas.width, canvas.height);
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, sample.width, sample.height).data;
        };
        const project = (x, y, z) => {
          const out = renderer.cameraEntity.camera.worldToScreen({ x, y, z });
          return { x: out.x, y: out.y };
        };
        const diffPixels = (full, base) => {
          const W = canvas.width, H = canvas.height, out = [];
          for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
            const i = (y * W + x) * 4;
            if (Math.abs(full[i] - base[i]) + Math.abs(full[i + 1] - base[i + 1]) + Math.abs(full[i + 2] - base[i + 2]) >= 24) out.push({ x, y, r: full[i], g: full[i + 1], b: full[i + 2] });
          }
          return out;
        };
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
        const bombs = [];
        // (1) SPAWN: pre-commit urchin glyph at the authored cell position,
        //     neutral obstacle-role red fill.
        for (const b of BOMBS) {
          const col = b.placement % 4;
          const row = Math.floor(b.placement / 4);
          const expX = gameplayWorldGrid.columnX[col];
          const expY = gameplayWorldGrid.rowY[row];
          const preFrame = frameAt(b.center - PRE_COMMIT_OFFSET_MS, []);
          renderer.renderGameplayFrame(preFrame);
          guard(`${b.eventId} spawn full`);
          const icon = renderer.lastModel.objects.find((o) => o.kind === "icon" && o.targetId === b.eventId);
          if (!icon) throw new Error(`${b.eventId}: no bomb icon in lastModel at center − ${PRE_COMMIT_OFFSET_MS} ms`);
          const { x: iw, y: iy, z: iz } = icon.position;
          if (Math.abs(iw - expX) > 1e-6 || Math.abs(iy - expY) > 1e-6 || Math.abs(iz - APPROACH_Z_WU) > 0.05) throw new Error(`${b.eventId}: pre-commit icon world position must be (${expX}, ${expY}, ${APPROACH_Z_WU} ± 0.05), got (${iw}, ${iy}, ${iz})`);
          const an = project(iw, iy, iz);
          const baseFrame = { ...preFrame, targets: preFrame.targets.filter((t) => t.id !== b.eventId) };
          renderer.renderGameplayFrame(baseFrame);
          const base = guard(`${b.eventId} spawn base`);
          renderer.renderGameplayFrame(preFrame);
          const full = guard(`${b.eventId} spawn full2`);
          const core = diffPixels(full, base).filter((q) => Math.abs(q.x - an.x) <= CORE_BOX_PX && Math.abs(q.y - an.y) <= CORE_BOX_PX);
          if (core.length < MIN_BOMB_GLYPH_PIXELS) throw new Error(`${b.eventId}: bomb urchin glyph must be substantially present at its cell (got ${core.length} diff pixels, min ${MIN_BOMB_GLYPH_PIXELS})`);
          const xs = core.map((q) => q.x), ys = core.map((q) => q.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          const dX = (minX + maxX) / 2 - an.x, dY = (minY + maxY) / 2 - an.y;
          if (Math.abs(dX) > CENTROID_TOLERANCE_PX || Math.abs(dY) > CENTROID_TOLERANCE_PX) throw new Error(`${b.eventId}: bomb glyph bbox center (${((minX + maxX) / 2).toFixed(1)}, ${((minY + maxY) / 2).toFixed(1)}) must sit at the projected icon position (${an.x.toFixed(1)}, ${an.y.toFixed(1)}) within ${CENTROID_TOLERANCE_PX} px`);
          // Neutral (obstacle-role) fill: the urchin renders as a mostly-dark
          // red sprite (base #E5484D under scene lighting), so judge RED
          // DOMINANCE over the whole glyph mass rather than a mid-luma tint.
          // A hand-color glyph (blue/green-dominant) or a neutral gray would
          // fail r > g AND r > b.
          let sr = 0, sg = 0, sb = 0, redDom = 0;
          for (const q of core) {
            if (q.r > q.g * 1.15 && q.r > q.b * 1.1 && q.r > 40) { redDom += 1; sr += q.r; sg += q.g; sb += q.b; }
          }
          if (redDom < MIN_BOMB_FILL_PIXELS) throw new Error(`${b.eventId}: bomb glyph must contain a red-dominant lit core (got ${redDom} strongly-red pixels, min ${MIN_BOMB_FILL_PIXELS})`);
          const rAvg = sr / redDom, gAvg = sg / redDom, bAvg = sb / redDom;
          const rMinusG = rAvg - gAvg, rMinusB = rAvg - bAvg;
          if (rAvg < 150 || rMinusG < 60 || rMinusB < 60) throw new Error(`${b.eventId}: the bomb's lit surface must be the neutral obstacle red #E5484D (r ≥ 150, r − g ≥ 60, r − b ≥ 60; got rgb=(${rAvg.toFixed(0)}, ${gAvg.toFixed(0)}, ${bAvg.toFixed(0)}), r − g = ${rMinusG.toFixed(1)}, r − b = ${rMinusB.toFixed(1)})`);
          bombs.push({ eventId: b.eventId, placement: b.placement, world: [iw, iy, +iz.toFixed(2)], coreCount: core.length, dX: +dX.toFixed(1), dY: +dY.toFixed(1), fill: { n: redDom, rgb: [Math.round(rAvg), Math.round(gAvg), Math.round(bAvg)], rMinusG: +rMinusG.toFixed(1), rMinusB: +rMinusB.toFixed(1) } });
        }
        // (2) CONTACT VIGNETTE: same frame with vs without the real contact
        //     event → the red edge band must rise above baseline.
        const glowNowMs = contactAtMs + GLOW_ELAPSED_MS;
        const contacts = projectHazardContactEvents(coordinator.getSnapshot(), glowNowMs);
        if (!contacts.some((e) => e.eventId === BOMB_A.eventId && e.atMs === contactAtMs)) throw new Error(`projectHazardContactEvents must carry the bomb contact event, got ${JSON.stringify(contacts)}`);
        const withGlowFrame = frameAt(glowNowMs, contacts);
        renderer.renderGameplayFrame(withGlowFrame);
        const glowFull = guard("glow full");
        const glowIntensity = renderer.lastModel.hazardGlow.intensity;
        if (glowIntensity < MIN_GLOW_INTENSITY) throw new Error(`hazardGlow.intensity at contact + ${GLOW_ELAPSED_MS} ms must be ≈ 0.9167 (envelope ramp 150 / decay 600), got ${glowIntensity}`);
        const noGlowFrame = frameAt(glowNowMs, []);
        renderer.renderGameplayFrame(noGlowFrame);
        const glowBase = guard("glow base");
        const noGlowIntensity = renderer.lastModel.hazardGlow.intensity;
        if (noGlowIntensity !== 0) throw new Error(`without the contact event hazardGlow.intensity must be 0, got ${noGlowIntensity}`);
        // Red-tinted outer 15% edge band (detector from 0.0.58-boxing-vignette).
        const W = canvas.width, H = canvas.height;
        const band = Math.max(1, Math.floor(Math.min(W, H) * 0.15));
        const isRedTinted = (px, i) => px[i] > px[i + 1] * 1.15 && px[i] > px[i + 2] * 1.1 && px[i] > 40;
        let redBase = 0, redGlow = 0, totalEdge = 0, differing = 0;
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            if (!(x < band || x >= W - band || y < band || y >= H - band)) continue;
            const i = (y * W + x) * 4;
            totalEdge += 1;
            if (isRedTinted(glowBase, i)) redBase += 1;
            if (isRedTinted(glowFull, i)) redGlow += 1;
          }
        }
        for (let i = 0; i < glowFull.length; i += 4) {
          if (Math.abs(glowFull[i] - glowBase[i]) + Math.abs(glowFull[i + 1] - glowBase[i + 1]) + Math.abs(glowFull[i + 2] - glowBase[i + 2]) > 24) differing += 1;
        }
        if (redGlow <= redBase) throw new Error(`red-tinted edge pixels must INCREASE with the bomb contact (base=${redBase}, glow=${redGlow})`);
        if (redGlow <= totalEdge * 0.01) throw new Error(`the red edge band must cover a meaningful fraction of the edge (glow=${redGlow}/${totalEdge})`);
        // (4) AVOIDED: after bomb-b's window the scene must stay clean.
        const avoidNowMs = 10240;
        const avoidContacts = projectHazardContactEvents(coordinator.getSnapshot(), avoidNowMs);
        if (avoidContacts.some((e) => e.eventId === BOMB_B.eventId)) throw new Error(`an avoided bomb must produce no hazard contact event, got ${JSON.stringify(avoidContacts)}`);
        const avoidFrame = frameAt(avoidNowMs, avoidContacts);
        renderer.renderGameplayFrame(avoidFrame);
        const avoidFull = guard("avoid full");
        const avoidIntensity = renderer.lastModel.hazardGlow.intensity;
        if (avoidIntensity !== 0) throw new Error(`after the avoided bomb hazardGlow.intensity must be 0, got ${avoidIntensity}`);
        const avoidBaseFrame = { presentation: "flow", nowMs: avoidNowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath: [], hazardContacts: [] };
        renderer.renderGameplayFrame(avoidBaseFrame);
        const avoidBase = guard("avoid base");
        let redAvoid = 0, redAvoidBase = 0;
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            if (!(x < band || x >= W - band || y < band || y >= H - band)) continue;
            const i = (y * W + x) * 4;
            if (isRedTinted(avoidBase, i)) redAvoidBase += 1;
            if (isRedTinted(avoidFull, i)) redAvoid += 1;
          }
        }
        if (redAvoid > redAvoidBase + 4) throw new Error(`the avoided bomb must render NO red edge band (base=${redAvoidBase}, avoid=${redAvoid}, tolerance 4)`);
        return {
          bombs,
          contact: { atMs: contactAtMs, offset: contactAtMs - BOMB_A.center, glowIntensity: +glowIntensity.toFixed(4), noGlowIntensity, redBase, redGlow, totalEdge, differing, canvas: { width: W, height: H } },
          avoided: { redBase: redAvoidBase, red: redAvoid, glowIntensity: avoidIntensity },
        };
      });
      if (noise.length > 0) throw new Error(`unexpected console/page noise: ${JSON.stringify(noise)}`);
      matrix.push({ embedding, ...proof });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  // Cross-embedding parity: same deterministic chart, same camera.
  const [direct, iframe] = matrix;
  assert.equal(direct.bombs.length, 2);
  assert.equal(direct.bombs.length, iframe.bombs.length);
  direct.bombs.forEach((row, i) => {
    const o = iframe.bombs[i];
    assert.equal(row.eventId, o.eventId, "bomb order must agree across embeddings");
    assert.ok(Math.abs(row.coreCount - o.coreCount) <= 100, `${row.eventId}: glyph count must agree across embeddings (${row.coreCount} vs ${o.coreCount})`);
    assert.ok(Math.abs(row.dX - o.dX) <= 3 && Math.abs(row.dY - o.dY) <= 3, `${row.eventId}: glyph centroid must agree across embeddings`);
    assert.ok(Math.abs(row.fill.rMinusG - o.fill.rMinusG) <= 12, `${row.eventId}: fill r − g must agree across embeddings`);
  });
  assert.equal(direct.contact.atMs, iframe.contact.atMs, "contact timestamp must agree across embeddings");
  assert.ok(Math.abs(direct.contact.glowIntensity - iframe.contact.glowIntensity) <= 0.01, "glow intensity must agree across embeddings");
  assert.ok(Math.abs(direct.contact.redGlow - iframe.contact.redGlow) <= Math.max(20, direct.contact.redGlow * 0.15), "red edge counts must agree across embeddings");
  const summary = matrix.map((m) => ({
    embedding: m.embedding,
    bombs: m.bombs.map((b) => ({ id: b.eventId, cell: b.placement, world: b.world, core: b.coreCount, dX: b.dX, dY: b.dY, fill: b.fill })),
    contact: { atMs: m.contact.atMs, offset: m.contact.offset, glow: m.contact.glowIntensity, redEdge: [m.contact.redBase, m.contact.redGlow], differing: m.contact.differing },
    avoided: { redEdge: [m.avoided.redBase, m.avoided.red], glow: m.avoided.glowIntensity },
  }));
  console.log(`ORACLE 0.0.61-bomb-spawn-vignette-pixels PASS: embeddings=2, bombs=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
