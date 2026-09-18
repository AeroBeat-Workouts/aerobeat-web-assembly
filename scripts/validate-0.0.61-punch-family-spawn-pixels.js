// @ts-check

// 0.0.61 L-C1 (htc8) real-pixel oracle — every Boxing punch FAMILY must spawn
// its committed-hit "hit corpse" at the SAME screen position as the live note
// icon it replaces, keep a substantial glyph, and carry the SONG PALETTE
// per-hand fill (left #2693FF blue / right #39C96B green desaturated), proven
// by reading REAL rendered canvas pixels (OffscreenCanvas drawImage +
// getImageData of the PlayCanvas canvas), NOT the scene-graph model.
//
// The 0.0.59 boxing-spawn oracle covered straight_left/straight_right
// position-spawn only. This closes the gap table's punch-family hole:
// hook_left / hook_right / uppercut_left / uppercut_right (arrow glyphs via
// authored spatialTarget.entryDirection) PLUS both straights (orb glyphs),
// i.e. BOTH hands for straight+hook and both hands for uppercut, cells
// spanning columns 0..3 and mid+top rows (the top-row uppercuts exercise the
// non-default topRowReachWU 0.5 spawn-Y path).
//
// What this oracle proves (driving a REAL boxing_collider_v1 session through
// the public input path — measured wrist evidence, REAL committed HIT
// judgements; 0.0.61 detection is the glove box `gloveBoxContactsBoxingTarget`,
// hooks/uppercuts additionally enforce their authored approach direction):
//   (a) GATE-ASSERT: every authored punch projects as kind "punch" with the
//       authored targetCell + hand/family, and every punch commits a REAL hit
//       judgement inside its ±180 ms window.
//   (b) Unit anchor: `projectAftermathEntries` (the REAL assembly output)
//       spawns each punch at { x: gameplayWorldGrid.columnX[cell % 4],
//       y: boxingColliderRowY(row, reach).worldY, z: 0 } — the renderer's own
//       grid constant, not the judge-plane X (cell % 4 ∈ 0..3).
//   (c) Pre-commit spawn: at center − 600 ms the live note icon is present at
//       the exact grid world position (z = 3.6 WU approach) and its glyph
//       pixels sit at the worldToScreen projection within 10 px.
//   (d) Pixels: at nowMs = commit + 4..16 ms the corpse's diff-pixel centroid
//       equals the note icon's screen position (READ FROM THE RENDERER: the
//       icon's world position at the commit frame, projected with
//       camera.worldToScreen — top-left-origin y-down, no manual flip) within
//       ≤ 6 px X / ≤ 8 px Y. The baseline is the SAME frame at the SAME nowMs
//       minus the aftermath entries, so the diff isolates EXACTLY the corpse.
//       A judge-plane-X spawn (cell % 4 instead of columnX) would miss by
//       ~131 px at this camera (87.6 px/WU at z=0), far outside tolerance.
//   (e) Glyph presence: the corpse's diff bounding box must contain a
//       substantial glyph (crop vs. baseline-region diff ≥ 30 % of the box)
//       and a white structural outline (max luma > 200).
//   (f) Per-hand color (the right-hand + non-straight hole): the corpse's
//       mid-luma fill at commit + 12 ms is a desaturated tint of the HAND's
//       palette color — left-hand punches read BLUE (b − r > 60; measured
//       82..131), right-hand punches read GREEN (g − r > 30 AND g − b > 8;
//       measured 44..83 / 15..43). A hand-swapped or neutral-gray corpse
//       fails.
//   (g) Knock smoothness: frame-to-frame centroid deltas across the tight
//       window stay < 30 px (continuous launch, no teleport).
//   (h) Freeze guard: every sample render must advance the renderer
//       frameCount AND change the pixel hash vs the previous sample.
//
// Drive notes (0.0.61 glove-box hit detection): straights are overlap-only —
// the own wrist is held statically at the target judge center across the
// ±180 ms window (hit commits at center − 150 ms, the first in-window
// sample). Hooks/uppercuts enforce their authored direction (hook_left
// "right", hook_right "left", uppercut "up") — the own wrist takes two
// static pre-samples at the target center, then a +0.5 WU step along the
// authored direction at center − 50 ms (displacement ≥ 0.05, exact authored
// direction, glove box overlapping the target box → hit commits at
// center − 50 ms).
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface).
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

// Top row uses a NON-default reach 0.5 (default is 0.25) so the reach-row
// spawn-Y path (boxingColliderRowY row 0 → 1 + topRowReachWU = 1.5) is
// exercised distinctly; mid-row punches are reach-independent (y = 1).
const REACH_TOP = 0.5;
const REACH_BOTTOM = 0.25;
const VIEW_W = 844;
const VIEW_H = 390;
// Centroid tolerance (px) for "corpse centroid ≈ note-icon screen position".
// Measured 0.0.61 worst case |dX| 2.3 / |dY| 3.2 across the 4..16 ms window;
// 6/8 px absorbs antialiasing + the −4 WU/s launch perspective shrink while
// staying ≪ the ~131 px judge-plane-X error.
const SPAWN_MATCH_TOLERANCE_PX = 6;
const SPAWN_MATCH_TOLERANCE_Y_PX = 8;
// Max allowed frame-to-frame centroid delta across the knock.
const KNOCK_STEP_BOUND_PX = 30;
// Post-commit sample offsets (ms): tight spawn-match window + one color
// sample at +12 ms (middle of the window; +4 ms fill stats are washed by the
// removal-fade overlap, +40 ms is already in the desaturated flight tail).
const TIGHT_MATCH_OFFSETS_MS = [4, 8, 12, 16];
const COLOR_OFFSET_MS = 12;
// Minimum visible glyph pixels for a corpse sample (measured 1700..3100).
const MIN_CORPSE_PIXELS = 150;
// Minimum glyph coverage of the diff bounding box (crop vs. baseline diff).
const MIN_GLYPH_COVERAGE = 0.3;
// Pre-commit live-note sample offset (ms before center) → approach z −3.6 WU
// (timestampToWorldZ = −(center − now) × 0.006 WU/ms: the timeline future is
// world −Z, so a pending note sits in front of the z = 0 hit plane).
const PRE_COMMIT_OFFSET_MS = 600;
const APPROACH_Z_WU = -3.6;

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
      const proof = await target.evaluate(async (reach) => {
        const { top: REACH_TOP, bottom: REACH_BOTTOM } = reach;
        const TIGHT_MATCH_OFFSETS_MS = [4, 8, 12, 16];
        const COLOR_OFFSET_MS = 12;
        const MIN_CORPSE_PIXELS = 150;
        const MIN_GLYPH_COVERAGE = 0.3;
        const SPAWN_MATCH_TOLERANCE_PX = 6;
        const SPAWN_MATCH_TOLERANCE_Y_PX = 8;
        const KNOCK_STEP_BOUND_PX = 30;
        const PRE_COMMIT_OFFSET_MS = 600;
        const APPROACH_Z_WU = -3.6;
        // cell → judge-space target center (x: col, y: reach-row Y).
        const JUDGE = { 4: [0, 1], 6: [2, 1], 5: [1, 1], 7: [3, 1], 0: [0, 1 + REACH_TOP], 1: [1, 1 + REACH_TOP] };
        const DIR = { right: [1, 0], left: [-1, 0], up: [0, 1] };
        // Six punches: BOTH hands for straight + hook + uppercut; cells span
        // columns 0..3 and mid row (straights/hooks) + top row (uppercuts,
        // non-default reach 0.5). Arrow glyphs (entryDirection) for the hook/
        // uppercut families; orb glyphs for the straights.
        const PUNCHES = [
          { eventId: "p-straight-left", type: "straight_left", hand: "left", family: "straight", cell: 4, entryDirection: null, center: 6000 },
          { eventId: "p-straight-right", type: "straight_right", hand: "right", family: "straight", cell: 6, entryDirection: null, center: 9000 },
          { eventId: "p-hook-left", type: "hook_left", hand: "left", family: "hook", cell: 5, entryDirection: "right", center: 12000 },
          { eventId: "p-hook-right", type: "hook_right", hand: "right", family: "hook", cell: 7, entryDirection: "left", center: 15000 },
          { eventId: "p-upper-left", type: "uppercut_left", hand: "left", family: "uppercut", cell: 0, entryDirection: "up", center: 18000 },
          { eventId: "p-upper-right", type: "uppercut_right", hand: "right", family: "uppercut", cell: 1, entryDirection: "up", center: 21000 },
        ];
        const game = document.querySelector("aero-game");
        const renderer = game.graph.renderer;
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
        renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
        // The real production modules (Vite-served, same module graph as the app).
        const [{ createAeroGameplaySessionCoordinator }, { projectAftermathEntries }, { projectSessionTargets, createSessionTargetIndex }, { gameplayWorldGrid }] = await Promise.all([
          import("/node_modules/@aerobeat/web-gameplay/src/index.js"),
          import("/src/gameplay-frame-effects.js"),
          import("/src/session-render-projection.js"),
          import("/node_modules/@aerobeat/web-renderer/src/index.js"),
        ]);
        const HASH = "a".repeat(64);
        const variant = { variantId: "lcb1-pixel", chartId: "chart-lcb1-pixel", mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const events = PUNCHES.map((p) => Object.freeze({
          schema: "aerobeat/resolved_content_event", version: 3,
          eventId: p.eventId, variantId: variant.variantId, chartId: variant.chartId,
          centerTimestampMs: p.center, sourceEventIds: [`s-${p.eventId}`],
          authoredBeat: Object.freeze({
            type: p.type,
            spatialTarget: Object.freeze({ targetCell: p.cell, acceptedSubcells: [], sourceCell: -1, ...(p.entryDirection ? { entryDirection: p.entryDirection } : {}) }),
          }),
        }));
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, lw, rw) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, 2, 1.5), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, lw.x, lw.y), anchor("right_wrist", m, rw.x, rw.y)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "lcb1-pixel-browser", countdownStepMs: 1 });
        coordinator.configureContent({
          packageId: "lcb1-pkg",
          selectedVariant: variant,
          resolvedEvents: events,
          profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false },
          boxingColliderSettings: { schema: "aerobeat/flow_collider_settings", version: 1, algorithm: "swept_athlete_plane_v1", colliderRadius: 0.12, enforceAuthoredDirection: true, directionToleranceDegrees: 45, timingWindowMs: 180, topRowReachWU: REACH_TOP, bottomRowReachWU: REACH_BOTTOM, guardCountMode: "collision" },
        });
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        coordinator.requestStart(0);
        const step = (songMs, lw, rw, id) => coordinator.advance({ timestampMs: songMs, clock: clockSnap(songMs, true), input: inputSnap(songMs, evidence(id, songMs, lw, rw)) });
        for (let t = 1; t <= 40; t += 1) {
          coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
          if (coordinator.getSnapshot().session.state === "playing") break;
        }
        const preState = coordinator.getSnapshot().session.state;
        if (preState !== "playing") throw new Error(`session must be "playing" before driving the punches, got "${preState}" (countdownStepMs: 1 required)`);
        const IDLE = { x: 3, y: 0 };
        const drive = (p) => {
          const [tx, ty] = JUDGE[p.cell];
          if (p.entryDirection === null) {
            // Straight: overlap-only — hold the own wrist at the target judge
            // center across the whole ±180 ms window.
            for (const d of [-200, -150, -100, -50, 0, 50, 100, 200]) {
              const lw = p.hand === "left" ? { x: tx, y: ty } : IDLE;
              const rw = p.hand === "right" ? { x: tx, y: ty } : IDLE;
              step(p.center + d, lw, rw, `s-${p.eventId}-${d}`);
            }
          } else {
            // Hook/uppercut: authored direction enforced — two static
            // pre-samples at the target center (displacement < 0.05, no
            // contact commit), then the +0.5 WU authored-direction step whose
            // glove box overlaps the target box.
            const [dx, dy] = DIR[p.entryDirection];
            const end = { x: tx + 0.5 * dx, y: ty + 0.5 * dy };
            const seq = [[-200, { x: tx, y: ty }], [-150, { x: tx, y: ty }], [-100, { x: tx, y: ty }], [-50, end], [0, end], [50, end], [100, end], [200, end]];
            for (const [d, pos] of seq) {
              const lw = p.hand === "left" ? pos : IDLE;
              const rw = p.hand === "right" ? pos : IDLE;
              step(p.center + d, lw, rw, `d-${p.eventId}-${d}`);
            }
          }
        };
        for (const p of PUNCHES) drive(p);
        const snap = coordinator.getSnapshot();
        // (a) GATE-ASSERT: projection kind/cell/hand/family + real committed HIT
        //     inside the ±180 ms window for every punch.
        const hitFor = (p) => {
          const hit = snap.judgements.find((j) => j.eventId === p.eventId);
          if (!hit || hit.result !== "hit") throw new Error(`expected a real committed HIT for ${p.eventId}, got ${JSON.stringify(hit ?? null)} judgements=${JSON.stringify(snap.judgements.map((j) => [j.eventId, j.result]))}`);
          const commit = Number(hit.committedTimelinePositionMs);
          if (Math.abs(commit - p.center) > 180) throw new Error(`${p.eventId} commit ${commit} outside the ±180 ms window of center ${p.center}`);
          return commit;
        };
        const commits = new Map(PUNCHES.map((p) => [p.eventId, hitFor(p)]));
        const index = createSessionTargetIndex(events, {});
        const rowReach = Object.freeze({ topRowReachWU: REACH_TOP, bottomRowReachWU: REACH_BOTTOM });
        for (const p of PUNCHES) {
          // Each punch is visible only from its own normalSpawnMs = center − 2500,
          // so project at the punch's OWN pre-commit time.
          const t = projectSessionTargets(events, snap, p.center - PRE_COMMIT_OFFSET_MS, index).find((entry) => entry.id === p.eventId);
          if (!t || t.kind !== "punch" || t.cell !== p.cell || t.hand !== p.hand || t.family !== p.family) throw new Error(`${p.eventId} must project as kind "punch" cell ${p.cell} hand ${p.hand} family ${p.family}, got ${JSON.stringify(t ?? null)}`);
        }
        // (b) Unit anchor: real assembly aftermath spawn = note icon's rendered
        //     grid position (columnX / reach-row Y), not the judge-plane X.
        const anchorNowMs = Math.max(...commits.values());
        const unitAnchor = (p) => {
          const list = projectAftermathEntries(events, snap, anchorNowMs, [], index, rowReach);
          const entry = list.find((e) => e.targetId === p.eventId);
          if (!entry) throw new Error(`projectAftermathEntries produced no entry for ${p.eventId} (got ${JSON.stringify(list.map((e) => e.targetId))})`);
          const expected = { x: gameplayWorldGrid.columnX[p.cell % 4], y: Math.floor(p.cell / 4) === 0 ? 1 + REACH_TOP : 1, z: 0 };
          if (Math.abs(entry.spawn.x - expected.x) > 1e-9 || Math.abs(entry.spawn.y - expected.y) > 1e-9 || Math.abs(entry.spawn.z - expected.z) > 1e-9) {
            throw new Error(`${p.eventId} (cell ${p.cell}) spawn must be the note icon's rendered position (${expected.x}, ${expected.y}, ${expected.z}), got (${entry.spawn.x}, ${entry.spawn.y}, ${entry.spawn.z})`);
          }
          if (entry.mode !== p.family || (p.entryDirection === null ? entry.shape !== "orb" : entry.shape !== "arrow") || entry.hand !== p.hand) throw new Error(`${p.eventId} aftermath must be mode ${p.family} shape ${p.entryDirection === null ? "orb" : "arrow"} hand ${p.hand}, got ${JSON.stringify({ mode: entry.mode, shape: entry.shape, hand: entry.hand })}`);
          return entry;
        };
        for (const p of PUNCHES) unitAnchor(p);
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
        // Frame derivation EXACTLY like the assembly rendererFrame().
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
        const stats = (px, box, full, base) => {
          const xs = px.map((q) => q.x), ys = px.map((q) => q.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          let sr = 0, sg = 0, sb = 0, n = 0, lumaMax = 0, covered = 0;
          for (const q of px) {
            const luma = 0.2126 * q.r + 0.7152 * q.g + 0.0722 * q.b;
            if (luma > lumaMax) lumaMax = luma;
            if (luma >= 55 && luma <= 160) { sr += q.r; sg += q.g; sb += q.b; n += 1; }
          }
          if (box) { for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y += 1) for (let x = Math.max(0, minX); x <= Math.min(W - 1, maxX); x += 1) { const i = (y * W + x) * 4; if (Math.abs(full[i] - base[i]) + Math.abs(full[i + 1] - base[i + 1]) + Math.abs(full[i + 2] - base[i + 2]) >= 24) covered += 1; } }
          return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, lumaMax, coverage: box ? covered / ((maxX - minX + 1) * (maxY - minY + 1)) : 1, fill: n > 0 ? { n, r: sr / n, g: sg / n, b: sb / n, bMinusR: (sb - sr) / n, gMinusR: (sg - sr) / n, gMinusB: (sg - sb) / n } : null };
        };
        let W = canvas.width, H = canvas.height;
        const freezeGuard = { lastFrameCount: renderer.describe().frameCount, lastHash: 0 };
        // Full-scan FNV over every pixel byte — a strided hash can collide when
        // the frame-to-frame change (a ~1 px corpse drift) falls between samples.
        const hashOf = (data) => { let h = 0x811c9dc5; for (let i = 0; i < data.length; i += 4) { h ^= data[i]; h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0; } return h; };
        const punches = [];
        for (const p of PUNCHES) {
          const commit = commits.get(p.eventId);
          // (c) Pre-commit spawn: live note icon at the exact grid world
          //     position on the approach (z = 3.6 WU), glyph pixels at the
          //     projected position within 10 px.
          const preFrame = frameAt(p.center - PRE_COMMIT_OFFSET_MS);
          renderer.renderGameplayFrame(preFrame);
          const preIcon = renderer.lastModel.objects.find((o) => o.kind === "icon" && o.targetId === p.eventId);
          if (!preIcon) throw new Error(`${p.eventId}: no live note icon in lastModel at center − ${PRE_COMMIT_OFFSET_MS} ms`);
          const [, expY] = JUDGE[p.cell];
          const expWorldX = gameplayWorldGrid.columnX[p.cell % 4];
          if (Math.abs(preIcon.position.x - expWorldX) > 1e-6 || Math.abs(preIcon.position.y - expY) > 1e-6 || Math.abs(preIcon.position.z - APPROACH_Z_WU) > 0.05) throw new Error(`${p.eventId}: pre-commit icon world position must be (${expWorldX}, ${expY}, ${APPROACH_Z_WU}), got (${preIcon.position.x}, ${preIcon.position.y}, ${preIcon.position.z})`);
          const preScreen = project(preIcon.position.x, preIcon.position.y, preIcon.position.z);
          const preBaseFrame = { ...preFrame, targets: preFrame.targets.filter((t) => t.id !== p.eventId) };
          renderer.renderGameplayFrame(preBaseFrame);
          const preBase = readPixels();
          renderer.renderGameplayFrame(preFrame);
          const preFull = readPixels();
          // The live-target diff includes the icon AND its floor shadow (the
          // shadow sits ~1.7..2.7 WU below the anchor), so bound the diff to a
          // box around the projected icon anchor — the glyph itself — before
          // measuring its centroid.
          const PRE_BOX = 32;
          const bx0 = Math.max(0, Math.round(preScreen.x - PRE_BOX)), bx1 = Math.min(canvas.width - 1, Math.round(preScreen.x + PRE_BOX));
          const by0 = Math.max(0, Math.round(preScreen.y - PRE_BOX)), by1 = Math.min(canvas.height - 1, Math.round(preScreen.y + PRE_BOX));
          const prePx = diffPixels(preFull, preBase).filter((q) => q.x >= bx0 && q.x <= bx1 && q.y >= by0 && q.y <= by1);
          if (prePx.length < 100) throw new Error(`${p.eventId}: pre-commit note glyph must be substantially present at its lane column (got ${prePx.length} diff pixels in the icon box)`);
          const preSt = stats(prePx, null, preFull, preBase);
          if (Math.abs(preSt.cx - preScreen.x) > 8 || Math.abs(preSt.cy - preScreen.y) > 8) throw new Error(`${p.eventId}: pre-commit glyph centroid (${preSt.cx.toFixed(1)}, ${preSt.cy.toFixed(1)}) must sit at the projected icon position (${preScreen.x.toFixed(1)}, ${preScreen.y.toFixed(1)}) within 8 px`);
          // (d) corpse spawn-position samples at commit + 4..16 ms
          const frameCommit = frameAt(commit);
          renderer.renderGameplayFrame(frameCommit);
          const icon = renderer.lastModel.objects.find((o) => o.kind === "icon" && o.targetId === p.eventId);
          if (!icon) throw new Error(`${p.eventId}: no note icon in the commit frame lastModel`);
          const noteScreen = project(icon.position.x, icon.position.y, icon.position.z);
          const centroids = [];
          let colorStats = null, coverage = 0, lumaMax = 0;
          for (const off of TIGHT_MATCH_OFFSETS_MS) {
            const f = frameAt(commit + off);
            renderer.renderGameplayFrame({ ...f, aftermath: [] });
            const base = readPixels();
            renderer.renderGameplayFrame(f);
            const full = readPixels();
            const fc = renderer.describe().frameCount;
            if (fc === freezeGuard.lastFrameCount) throw new Error(`${p.eventId} +${off} ms: renderer frameCount did not advance (frozen render)`);
            const h = hashOf(full);
            if (h === freezeGuard.lastHash) throw new Error(`${p.eventId} +${off} ms: pixel hash did not change (frozen frame)`);
            freezeGuard.lastFrameCount = fc; freezeGuard.lastHash = h;
            const px = diffPixels(full, base);
            if (px.length < MIN_CORPSE_PIXELS) throw new Error(`${p.eventId} +${off} ms: corpse must be a substantial glyph (got ${px.length} diff pixels, min ${MIN_CORPSE_PIXELS})`);
            W = canvas.width; H = canvas.height;
            const st = stats(px, true, full, base);
            if (st.coverage < MIN_GLYPH_COVERAGE) throw new Error(`${p.eventId} +${off} ms: corpse bbox must contain a substantial glyph (coverage ${(st.coverage * 100).toFixed(1)}% < ${MIN_GLYPH_COVERAGE * 100}%)`);
            lumaMax = Math.max(lumaMax, st.lumaMax);
            coverage = Math.max(coverage, st.coverage);
            if (off === COLOR_OFFSET_MS) colorStats = st;
            if (Math.abs(st.cx - noteScreen.x) > SPAWN_MATCH_TOLERANCE_PX || Math.abs(st.cy - noteScreen.y) > SPAWN_MATCH_TOLERANCE_Y_PX) throw new Error(`${p.eventId} +${off} ms: corpse centroid (${st.cx.toFixed(1)}, ${st.cy.toFixed(1)}) must equal the note icon screen position (${noteScreen.x.toFixed(1)}, ${noteScreen.y.toFixed(1)}) within ${SPAWN_MATCH_TOLERANCE_PX}/${SPAWN_MATCH_TOLERANCE_Y_PX} px (judge-plane-X spawn would miss by ~131 px)`);
            centroids.push({ off, cx: st.cx, cy: st.cy, count: px.length });
          }
          if (lumaMax <= 200) throw new Error(`${p.eventId}: corpse must keep the white structural outline (max luma ${lumaMax.toFixed(0)} ≤ 200)`);
          // (g) knock smoothness across the tight window
          for (let i = 1; i < centroids.length; i += 1) {
            const stepX = Math.abs(centroids[i].cx - centroids[i - 1].cx), stepY = Math.abs(centroids[i].cy - centroids[i - 1].cy);
            if (stepX > KNOCK_STEP_BOUND_PX || stepY > KNOCK_STEP_BOUND_PX) throw new Error(`${p.eventId} ${centroids[i - 1].off}→${centroids[i].off} ms: centroid delta (${stepX.toFixed(1)}, ${stepY.toFixed(1)}) teleports (bound ${KNOCK_STEP_BOUND_PX} px)`);
          }
          // (f) per-hand palette tint of the corpse fill at commit + 12 ms
          const fill = colorStats?.fill;
          if (!fill || fill.n < 300) throw new Error(`${p.eventId}: corpse fill sample too small (n=${fill?.n ?? 0})`);
          if (p.hand === "left") {
            if (fill.bMinusR <= 60) throw new Error(`${p.eventId} (LEFT hand): corpse fill must be a desaturated tint of leftHandColor #2693FF (blue-dominant, b − r > 60; got b − r = ${fill.bMinusR.toFixed(1)}, rgb=(${fill.r.toFixed(0)}, ${fill.g.toFixed(0)}, ${fill.b.toFixed(0)}))`);
          } else {
            if (fill.gMinusR <= 30 || fill.gMinusB <= 8) throw new Error(`${p.eventId} (RIGHT hand): corpse fill must be a desaturated tint of rightHandColor #39C96B (green-dominant, g − r > 30 AND g − b > 8; got g − r = ${fill.gMinusR.toFixed(1)}, g − b = ${fill.gMinusB.toFixed(1)}, rgb=(${fill.r.toFixed(0)}, ${fill.g.toFixed(0)}, ${fill.b.toFixed(0)}))`);
          }
          punches.push({
            label: p.type, cell: p.cell, hand: p.hand, family: p.family, entryDirection: p.entryDirection,
            commitMs: commit,
            note: { world: { x: icon.position.x, y: icon.position.y, z: icon.position.z }, screen: { x: Math.round(noteScreen.x * 10) / 10, y: Math.round(noteScreen.y * 10) / 10 } },
            prePx: prePx.length,
            centroids: centroids.map((c) => ({ ms: c.off, cx: Math.round(c.cx * 10) / 10, cy: Math.round(c.cy * 10) / 10, px: c.count })),
            fill: { n: fill.n, rgb: [Math.round(fill.r), Math.round(fill.g), Math.round(fill.b)], bMinusR: Math.round(fill.bMinusR), gMinusR: Math.round(fill.gMinusR), gMinusB: Math.round(fill.gMinusB) },
            coverage: Math.round(coverage * 100) / 100, lumaMax: Math.round(lumaMax),
          });
          renderer.renderGameplayFrame(frameAt(0));
        }
        return { punches, canvas: { width: canvas.width, height: canvas.height } };
      }, { top: REACH_TOP, bottom: REACH_BOTTOM });
      if (noise.length > 0) throw new Error(`unexpected console/page noise: ${JSON.stringify(noise)}`);
      matrix.push({ embedding, ...proof });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  const [direct, iframe] = matrix;
  assert.equal(direct.punches.length, 6);
  assert.equal(direct.punches.length, iframe.punches.length);
  // Cross-embedding parity: same deterministic chart, same camera — centroids
  // and per-hand fill stats must agree within tight tolerances.
  direct.punches.forEach((row, i) => {
    const o = iframe.punches[i];
    assert.equal(row.label, o.label, "punch order must agree across embeddings");
    assert.equal(row.commitMs, o.commitMs, `${row.label}: commit must agree across embeddings`);
    row.centroids.forEach((c, ci) => {
      const oc = o.centroids[ci];
      assert.ok(Math.abs(c.cx - oc.cx) <= 3, `${row.label} +${c.ms} ms: centroid x must agree across embeddings (${c.cx} vs ${oc.cx})`);
      assert.ok(Math.abs(c.cy - oc.cy) <= 3, `${row.label} +${c.ms} ms: centroid y must agree across embeddings (${c.cy} vs ${oc.cy})`);
    });
    assert.ok(Math.abs(row.fill.bMinusR - o.fill.bMinusR) <= 8, `${row.label}: fill b−r must agree across embeddings (${row.fill.bMinusR} vs ${o.fill.bMinusR})`);
    assert.ok(Math.abs(row.fill.gMinusR - o.fill.gMinusR) <= 8, `${row.label}: fill g−r must agree across embeddings (${row.fill.gMinusR} vs ${o.fill.gMinusR})`);
    assert.ok(Math.abs(row.fill.gMinusB - o.fill.gMinusB) <= 8, `${row.label}: fill g−b must agree across embeddings (${row.fill.gMinusB} vs ${o.fill.gMinusB})`);
  });
  const summary = matrix.map((m) => ({
    embedding: m.embedding,
    punches: m.punches.map((p) => ({ label: p.label, cell: p.cell, hand: p.hand, commit: p.commitMs, note: p.note.screen, centroids: p.centroids, fill: p.fill, coverage: p.coverage, lumaMax: p.lumaMax })),
  }));
  console.log(`ORACLE 0.0.61-punch-family-spawn-pixels PASS: embeddings=2, punches=6, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
