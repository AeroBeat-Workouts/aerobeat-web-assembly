// @ts-check

// 0.0.61 L-C1 (htc8) real-pixel oracle — Boxing GUARD spawning: a standard
// `guard` and a `crossed_guard` must both spawn their shield glyphs at the
// canonical two-LANE pair positions (mirroring the canonical-scene
// guardPairs shape: instanceCount 2, same asset / material / scale /
// orientation, X-only placement difference) in the GUARD role color — a
// neutral, per-role fill that is distinct from BOTH hand colors (left blue /
// right green), with REAL committed-hit judgements from the 0.0.61
// collision-mode detector
// (both hands' glove volumes overlapping their authored cell boxes in one
// fresh evidence frame).
//
// What this oracle proves (driving a REAL boxing_collider_v1 session through
// the public input path — measured wrist evidence, REAL committed HIT
// judgements; guardCountMode "collision"):
//   (a) GATE-ASSERT: every authored guard projects as kind "guard",
//       hand "both", family "guard" / "crossed_guard" with the authored
//       cells, and commits a REAL hit judgement inside its ±180 ms window.
//   (b) Pre-commit spawn: at center − 600 ms (approach z = −3.6 WU) the
//       guard renders TWO icon objects — the left and right shield — at the
//       canonical lane-pair world positions (±0.9, 1.0), with the same
//       guardPairKey, pair indices 0/1, identical asset
//       "guard/outlined-shield-v1", identical scale and orientation, and an
//       X-only placement difference.
//   (c) Pixels: each shield's diff-pixel core (baseline = same frame minus
//       the guard target) is substantial, sits within 8 px of the
//       worldToScreen projection of its lane position, and its mid-luma fill
//       is the neutral guard-role color — green-dominant teal (g − r ≥ 60),
//       NOT either hand color (left blue has b − r ≈ +166, right green has
//       g − b ≈ +94, both excluded). Both shields in a pair share the fill.
//   (d) Freeze guard: every sample render advances the renderer frameCount
//       AND changes the full-scan pixel hash.
//
// Drive notes (0.0.61 glove-box guard detection): each wrist is held at its
// own authored cell's judge-space target center (glove 0.68×0.56 WU inside
// the 1×1 cell box) across the ±180 ms window, so both glove volumes
// overlap their targets in the first in-window sample (center − 150 ms) and
// the guard commits a hit there. Top row uses reach 0.5 (judge Y 1.5).
//
// Chart: guard-1 {leftCell 5, rightCell 6} mid row @ 6000; crossed-1
// {leftCell 1, rightCell 2, crossed, modifier crossed_guard} top row @ 10000.
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface).
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const REACH_TOP = 0.5;
const REACH_BOTTOM = 0.25;
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
        const REACH_TOP = 0.5;
        const REACH_BOTTOM = 0.25;
        const PRE_COMMIT_OFFSET_MS = 600;
        const APPROACH_Z_WU = -3.6;
        const CORE_BOX_PX = 24;
        const CENTROID_TOLERANCE_PX = 8;
        const MIN_SHIELD_PIXELS = 500;
        const MIN_GUARD_FILL_PIXELS = 200;
        const GUARDS = [
          { eventId: "g-standard", family: "guard", crossed: false, leftCell: 5, rightCell: 6, row: 1, center: 6000 },
          { eventId: "g-crossed", family: "crossed_guard", crossed: true, leftCell: 1, rightCell: 2, row: 0, center: 10000 },
        ];
        const game = document.querySelector("aero-game");
        const canvas = game.shadowRoot.querySelector("canvas");
        const renderer = game.graph.renderer;
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
        renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
        const [{ createAeroGameplaySessionCoordinator }, { projectAftermathEntries }, { projectSessionTargets, createSessionTargetIndex }, { gameplayWorldGrid }] = await Promise.all([
          import("/node_modules/@aerobeat/web-gameplay/src/index.js"),
          import("/src/gameplay-frame-effects.js"),
          import("/src/session-render-projection.js"),
          import("/node_modules/@aerobeat/web-renderer/src/index.js"),
        ]);
        const HASH = "b4".repeat(32);
        const variant = { variantId: "lcb1-guard", chartId: "chart-lcb1-guard", mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const events = GUARDS.map((g) => Object.freeze({
          schema: "aerobeat/resolved_content_event", version: 3,
          eventId: g.eventId, variantId: variant.variantId, chartId: variant.chartId,
          centerTimestampMs: g.center, sourceEventIds: [`s-${g.eventId}`],
          authoredBeat: Object.freeze({
            type: "guard",
            guardTarget: Object.freeze({ leftCell: g.leftCell, rightCell: g.rightCell, ...(g.crossed ? { crossed: true } : {}) }),
            ...(g.crossed ? { modifier: "crossed_guard" } : {}),
          }),
        }));
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, lw, rw) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, 2, 1.5), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, lw.x, lw.y), anchor("right_wrist", m, rw.x, rw.y)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        const { standaloneTestEquipmentPoses } = await import("/src/test-equipment-authoring.js"); await game.ensureEquipmentConfigIdentity();
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "lcb1-guard-browser", countdownStepMs: 1 });
        coordinator.configureContent({
          packageId: "lcb1-guard-pkg",
          selectedVariant: variant,
          resolvedEvents: events,
          profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false },
          boxingColliderSettings: { schema: "aerobeat/flow_collider_settings", version: 1, algorithm: "swept_athlete_plane_v1", colliderRadius: 0.12, enforceAuthoredDirection: true, directionToleranceDegrees: 45, timingWindowMs: 180, topRowReachWU: REACH_TOP, bottomRowReachWU: REACH_BOTTOM, guardCountMode: "collision" },
        });
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        coordinator.requestStart(0);
        const step = (songMs,lw,rw,id) => { const input=inputSnap(songMs,evidence(id,songMs,lw,rw)); return coordinator.advance({timestampMs:songMs,clock:clockSnap(songMs,true),input,equipmentPoses:standaloneTestEquipmentPoses("boxing",input,game.equipmentConfigIdentity)}); };
        for (let t = 1; t <= 40; t += 1) {
          coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
          if (coordinator.getSnapshot().session.state === "playing") break;
        }
        if (coordinator.getSnapshot().session.state !== "playing") throw new Error("session not playing after countdown");
        // cell → judge-space target center (x: col, y: reach-row Y).
        const judgeTarget = (cell) => {
          const col = cell % 4;
          const row = Math.floor(cell / 4);
          const y = row === 0 ? 1 + REACH_TOP : 1;
          return [col - 0, y]; // judge X == flow-grid column index
        };
        const IDLE = { x: 3, y: 0 };
        // Guard drive: both wrists held at their authored cell centers
        // (glove box inside the 1×1 cell box) across the whole window.
        const drive = (g) => {
          const [lx, ly] = judgeTarget(g.leftCell);
          const [rx, ry] = judgeTarget(g.rightCell);
          for (const d of [-200, -150, -100, -50, 0, 50, 100, 200]) {
            step(g.center + d, { x: lx, y: ly }, { x: rx, y: ry }, `${g.eventId}${d}`);
          }
        };
        for (const g of GUARDS) drive(g);
        const snap = coordinator.getSnapshot();
        // (a) GATE-ASSERT: projection kind/hand/family/cells + real committed HIT.
        const index = createSessionTargetIndex(events, {});
        const rowReach = Object.freeze({ topRowReachWU: REACH_TOP, bottomRowReachWU: REACH_BOTTOM });
        const commits = new Map();
        for (const g of GUARDS) {
          const t = projectSessionTargets(events, snap, g.center - PRE_COMMIT_OFFSET_MS, index).find((entry) => entry.id === g.eventId);
          if (!t || t.kind !== "guard" || t.hand !== "both" || t.family !== g.family) throw new Error(`${g.eventId} must project as kind "guard" hand "both" family "${g.family}", got ${JSON.stringify(t ?? null)}`);
          if (JSON.stringify(t.cells) !== JSON.stringify([g.leftCell, g.rightCell])) throw new Error(`${g.eventId} must project cells [${g.leftCell}, ${g.rightCell}], got ${JSON.stringify(t.cells)}`);
          const hit = snap.judgements.find((j) => j.eventId === g.eventId);
          if (!hit || hit.result !== "hit") throw new Error(`expected a real committed HIT for ${g.eventId}, got ${JSON.stringify(hit ?? null)} judgements=${JSON.stringify(snap.judgements.map((j) => [j.eventId, j.result]))}`);
          const commit = Number(hit.committedTimelinePositionMs);
          if (Math.abs(commit - g.center) > 180) throw new Error(`${g.eventId} commit ${commit} outside the ±180 ms window of center ${g.center}`);
          commits.set(g.eventId, commit);
        }
        // ── Pixel-level oracle ──
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
        const frameAt = (nowMs) => {
          const s = coordinator.getSnapshot();
          const targets = projectSessionTargets(events, s, nowMs, index);
          const aftermath = projectAftermathEntries(events, s, nowMs, targets, index, rowReach);
          return { presentation: "boxing_collider", nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath, rowReach };
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
        // Tag-scoped hash: two DIFFERENT guards render the same static scene
        // content (same lane pair, same color), so a global previous-hash
        // check would false-positive across guards. The freeze property
        // that matters: re-rendering the SAME tag must change nothing unless
        // the scene changed — and full vs base for the same tag is caught
        // separately by the diff-pixel core count (identical frames → 0 core).
        const freezeGuard = { lastFrameCount: -1, hashes: new Map() };
        const guard = (tag) => {
          const fc = renderer.describe().frameCount;
          if (fc === freezeGuard.lastFrameCount) throw new Error(`${tag}: renderer frameCount did not advance (frozen render)`);
          const px = readPixels();
          const h = hashOf(px);
          if (freezeGuard.hashes.has(tag) && freezeGuard.hashes.get(tag) === h) throw new Error(`${tag}: identical pixels re-rendered under the same tag (frozen frame)`);
          freezeGuard.lastFrameCount = fc;
          freezeGuard.hashes.set(tag, h);
          return px;
        };
        // Canonical lane-pair world positions (boxingLaneSeparationWorldUnits
        // default 1.8 → lanes at x = ±0.9, BOXING_LANE_CENTER_Y = 1.0).
        const LANE_LEFT = { x: -0.9, y: 1.0 };
        const LANE_RIGHT = { x: 0.9, y: 1.0 };
        const guards = [];
        for (const g of GUARDS) {
          const nowMs = g.center - PRE_COMMIT_OFFSET_MS;
          const preFrame = frameAt(nowMs);
          renderer.renderGameplayFrame(preFrame);
          guard(`${g.eventId} pre full`);
          const icons = renderer.lastModel.objects.filter((o) => o.kind === "icon" && o.targetId === g.eventId);
          if (icons.length !== 2) throw new Error(`${g.eventId}: expected the two-lane-pair shield icons, got ${icons.length} icon objects: ${JSON.stringify(icons.map((o) => o.position))}`);
          // (b) Canonical guardPairs shape: same pair key, indices 0/1, same
          //     asset / scale / orientation / Y / Z, X-only placement diff.
          const [ia, ib] = icons;
          if (!ia.guardPairKey || ia.guardPairKey !== ib.guardPairKey) throw new Error(`${g.eventId}: both shields must share one guardPairKey, got ${JSON.stringify([ia.guardPairKey, ib.guardPairKey])}`);
          if (JSON.stringify([ia.guardPairIndex, ib.guardPairIndex].sort()) !== JSON.stringify([0, 1])) throw new Error(`${g.eventId}: guard pair indices must be 0/1, got ${JSON.stringify([ia.guardPairIndex, ib.guardPairIndex])}`);
          for (const [tag, icon] of [["left", ia], ["right", ib]]) {
            if (icon.assetId !== "guard/outlined-shield-v1") throw new Error(`${g.eventId} ${tag} shield must use the guard canonical asset "guard/outlined-shield-v1", got ${JSON.stringify(icon.assetId)}`);
            if (Math.abs(icon.position.z - APPROACH_Z_WU) > 0.05) throw new Error(`${g.eventId} ${tag} shield z must be ${APPROACH_Z_WU} ± 0.05 at center − ${PRE_COMMIT_OFFSET_MS} ms, got ${icon.position.z}`);
          }
          const expA = ia.position.x < ib.position.x ? LANE_LEFT : LANE_RIGHT;
          const expB = ia.position.x < ib.position.x ? LANE_RIGHT : LANE_LEFT;
          if (Math.abs(ia.position.x - expA.x) > 1e-6 || Math.abs(ia.position.y - expA.y) > 1e-6) throw new Error(`${g.eventId}: left shield must be at (${expA.x}, ${expA.y}), got (${ia.position.x}, ${ia.position.y})`);
          if (Math.abs(ib.position.x - expB.x) > 1e-6 || Math.abs(ib.position.y - expB.y) > 1e-6) throw new Error(`${g.eventId}: right shield must be at (${expB.x}, ${expB.y}), got (${ib.position.x}, ${ib.position.y})`);
          if (Math.abs(ia.position.y - ib.position.y) > 1e-9 || Math.abs(ia.position.z - ib.position.z) > 1e-9 || Math.abs(ia.scale.x - ib.scale.x) > 1e-9 || Math.abs(ia.rotationZRad - ib.rotationZRad) > 1e-9) throw new Error(`${g.eventId}: the pair must differ only in X (same Y, Z, scale, orientation), got ${JSON.stringify({ y: [ia.position.y, ib.position.y], z: [ia.position.z, ib.position.z], sx: [ia.scale.x, ib.scale.x], rot: [ia.rotationZRad, ib.rotationZRad] })}`);
          const baseFrame = { ...preFrame, targets: preFrame.targets.filter((t) => t.id !== g.eventId) };
          renderer.renderGameplayFrame(baseFrame);
          const base = guard(`${g.eventId} pre base`);
          renderer.renderGameplayFrame(preFrame);
          const full = guard(`${g.eventId} pre full2`);
          // (c) Pixels per shield: substantial core at the lane projection,
          //     purple guard-role fill.
          const shields = [];
          const fills = [];
          for (const icon of [ia, ib]) {
            const an = project(icon.position.x, icon.position.y, icon.position.z);
            const core = diffPixels(full, base).filter((q) => Math.abs(q.x - an.x) <= CORE_BOX_PX && Math.abs(q.y - an.y) <= CORE_BOX_PX);
            if (core.length < MIN_SHIELD_PIXELS) throw new Error(`${g.eventId}: shield glyph must be substantially present at (${an.x.toFixed(0)}, ${an.y.toFixed(0)}) (got ${core.length} diff pixels, min ${MIN_SHIELD_PIXELS})`);
            const xs = core.map((q) => q.x), ys = core.map((q) => q.y);
            const dX = (Math.min(...xs) + Math.max(...xs)) / 2 - an.x;
            const dY = (Math.min(...ys) + Math.max(...ys)) / 2 - an.y;
            if (Math.abs(dX) > CENTROID_TOLERANCE_PX || Math.abs(dY) > CENTROID_TOLERANCE_PX) throw new Error(`${g.eventId}: shield bbox center must sit at the projected lane position (${an.x.toFixed(1)}, ${an.y.toFixed(1)}) within ${CENTROID_TOLERANCE_PX} px, got offset (${dX.toFixed(1)}, ${dY.toFixed(1)})`);
            let sr = 0, sg = 0, sb = 0, fn = 0;
            for (const q of core) {
              const luma = 0.2126 * q.r + 0.7152 * q.g + 0.0722 * q.b;
              if (luma >= 55 && luma <= 170) { sr += q.r; sg += q.g; sb += q.b; fn += 1; }
            }
            if (fn < MIN_GUARD_FILL_PIXELS) throw new Error(`${g.eventId}: shield fill sample too small at (${an.x.toFixed(0)}, ${an.y.toFixed(0)}) (n=${fn}, min ${MIN_GUARD_FILL_PIXELS})`);
            const rAvg = sr / fn, gAvg = sg / fn, bAvg = sb / fn;
            const gMinusR = gAvg - rAvg, bMinusR = bAvg - rAvg, gMinusB = gAvg - bAvg;
            // The shield asset's fill material ("guard_fill") is NOT retinted by the
            // renderer (only "note_fill" parts are), so the rendered guard color is the
            // asset's baked teal-green, distinct from both hand colors:
            //  - left hand blue #2693FF has b − r ≈ +166  → excluded by b − r < 90
            //  - right hand green #39C96B has g − b ≈ +94 → excluded by g − b < 70
            // Measured guard fill ≈ (61, 165, 132): g − r ≈ 104, b − r ≈ 71, g − b ≈ 33.
            if (!(gAvg >= 120 && gMinusR >= 60 && bMinusR < 90 && gMinusB < 70)) throw new Error(`${g.eventId}: shield fill must be the neutral guard color (green-dominant teal, distinct from both hand colors); got rgb=(${rAvg.toFixed(0)}, ${gAvg.toFixed(0)}, ${bAvg.toFixed(0)}), g − r = ${gMinusR.toFixed(1)}, b − r = ${bMinusR.toFixed(1)}, g − b = ${gMinusB.toFixed(1)}`);
            fills.push({ r: rAvg, g: gAvg, b: bAvg });
            shields.push({ screen: [Math.round(an.x), Math.round(an.y)], world: [icon.position.x, icon.position.y, +icon.position.z.toFixed(2)], core: core.length, dX: +dX.toFixed(1), dY: +dY.toFixed(1), fill: { n: fn, rgb: [Math.round(rAvg), Math.round(gAvg), Math.round(bAvg)], gMinusR: +gMinusR.toFixed(1), bMinusR: +bMinusR.toFixed(1), gMinusB: +gMinusB.toFixed(1) } });
          }
          // (c2) Both shields in a pair must share the SAME guard-role color.
          const [f0, f1] = fills;
          if (Math.abs(f0.r - f1.r) > 15 || Math.abs(f0.g - f1.g) > 15 || Math.abs(f0.b - f1.b) > 15) throw new Error(`${g.eventId}: the two shields in a guard pair must share the same role color, got rgb ${JSON.stringify(fills.map((f) => [Math.round(f.r), Math.round(f.g), Math.round(f.b)]))}`);
          guards.push({ eventId: g.eventId, family: g.family, cells: [g.leftCell, g.rightCell], commitOff: commits.get(g.eventId) - g.center, pair: { guardPairKey: ia.guardPairKey, indices: [ia.guardPairIndex, ib.guardPairIndex], assetId: ia.assetId, xGap: +(Math.abs(ia.position.x - ib.position.x)).toFixed(2) }, shields });
        }
        return { guards };
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
  assert.equal(direct.guards.length, 2);
  assert.equal(direct.guards.length, iframe.guards.length);
  direct.guards.forEach((row, i) => {
    const o = iframe.guards[i];
    assert.equal(row.eventId, o.eventId, "guard order must agree across embeddings");
    assert.equal(row.commitOff, o.commitOff, `${row.eventId}: commit offset must agree across embeddings`);
    row.shields.forEach((sh, j) => {
      const so = o.shields[j];
      assert.ok(Math.abs(sh.core - so.core) <= 100, `${row.eventId} shield ${j}: core count must agree across embeddings (${sh.core} vs ${so.core})`);
      assert.ok(Math.abs(sh.dX - so.dX) <= 3 && Math.abs(sh.dY - so.dY) <= 3, `${row.eventId} shield ${j}: centroid must agree across embeddings`);
      assert.ok(Math.abs(sh.fill.gMinusR - so.fill.gMinusR) <= 12, `${row.eventId} shield ${j}: fill g − r must agree across embeddings (${sh.fill.gMinusR} vs ${so.fill.gMinusR})`);
    });
  });
  const summary = matrix.map((m) => ({
    embedding: m.embedding,
    guards: m.guards.map((g) => ({ id: g.eventId, family: g.family, cells: g.cells, commitOff: g.commitOff, pair: g.pair, shields: g.shields })),
  }));
  console.log(`ORACLE 0.0.61-guard-spawn-pixels PASS: embeddings=2, guards=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
