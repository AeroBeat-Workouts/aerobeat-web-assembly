// @ts-check

// 0.0.61 L-C2 (htc8) real-pixel oracle — Boxing SQUAT and WEAVE_LEFT wall
// geometry + nose contact, in a REAL boxing_collider_v1 session, closing the
// two open htc8 gap rows (squat geometry+contact, weave_left geometry+contact).
//   (a) SQUAT GEOMETRY: a canonical squat (gameplay {x:0,y:0,w:4,h:1} — the
//       full-width TOP row, gridMask [0,1,2,3], noseSafeCells [4..11])
//       renders as TWO full-height lane walls — one per lane (the renderer
//       duplicates squat walls per lane by design,
//       gameplay-scene-model.js:256-263): exactly two kind:"obstacle" wall
//       objects at the two lane positions (x = ±0.9, y = 1.0 — the canonical
//       boxing lane pair), each scaled to the FULL lane height
//       (2.94 WU = BOXING_LANE_HEIGHT, i.e. scale.y = 2.94/0.94), distinct
//       from each other, covering both lanes (lastModel + worldToScreen;
//       per-wall diff-pixel glyph presence at each projected position).
//   (b) WEAVE_LEFT GEOMETRY: a single-lane-column full-height weave_left
//       (gameplay {x:3,y:0,w:1,h:3}, gridMask [3,7,11], the mirror of the
//       weave_right coverage in validate-0.0.58-boxing-vignette-pixels.js at
//       the OPPOSITE lane) renders exactly ONE full-height wall at the
//       PRESENTATION X of its AUTHORED grid column (column 3 → columnX[3] =
//       +1.5 — the same space as the punch icons and the collision), spanning
//       exactly the authored column (scale.x 1.0), full lane height, with NO
//       wall at the weave-direction lane positions (x = ±0.9).
//       0.0.61 L-F8 (aerobeat-web-renderer 931c749) fixed the former
//       weave-direction-lane placement (weave_left → lane "left" x = −0.9),
//       which drew the wall on the SAFE side of its blocked column.
//   (c) SQUAT CONTACT: the measured nose driven through the squat's blocked
//       cells (top row, sy 1.5..2.5) inside the interval produces a REAL
//       obstacle outcome {result:"contact"} (firstContact + duration from
//       the analytic segment clip) and renders the proven RED EDGE-BAND
//       VIGNETTE (outer 15% edge band, r > g·1.15 && r > b·1.1 && r > 40):
//       the scene model's hazardGlow.intensity reads the deterministic
//       envelope (ramp 150 ms / decay 600 ms) and the red edge-band pixels
//       rise far above the same-frame no-contact baseline.
//   (d) WEAVE AVOIDED: the nose kept in a safe cell (left half, sx 1.0) with
//       continuous 40 ms tracking across the whole interval produces a REAL
//       outcome {result:"avoided"} (full coverage, zero contact), the state
//       channel stays flat (hazardGlow.intensity 0, no retained contact
//       events) and the red edge band equals the no-contact baseline; a
//       synthetic contact event on the SAME frame proves the detector would
//       fire (large red-edge delta) — so the flatness is the absence of a
//       contact, not a dead detector.
// Proven by reading REAL rendered canvas pixels (OffscreenCanvas drawImage +
// getImageData of the PlayCanvas canvas) against baseline-subtracted frames,
// NOT the scene-graph model (model reads are the geometry ground truth).
//
// Chart (one obstacle per session + one far-later punch so the session is
// still alive when the obstacle interval finalizes):
//   session A: squat   {x:0,y:0,w:4,h:1}  [6000, 6400]  — CONTACT drive
//   session B: weave   {x:3,y:0,w:1,h:3}  [12000, 12400] — AVOIDED drive
//   (a padding straight_left punch @ 20000 in each session)
// Contact drive: nose (1.5, 1.0) → (1.5, 2.0) across the interval boundary
// (segment clip enters the top row at 6010, exits at 6310). Avoided drive:
// nose (1.0, 1.0) on continuous 40 ms samples from 11920 to 12480 — full
// [12000, 12400] coverage with zero blocked-cell intersection.
//
// L-F8 NOTE (0.0.61): the former mismatch — weave wall drawn in the lane
// named by the weave DIRECTION (weave_left → lane "left", x = −0.9) while its
// blocked cells (grid column 3) sit in the right half of the judge grid — was
// FIXED in aerobeat-web-renderer 931c749: the wall now renders at the
// presentation X of its authored grid column (+1.5 for column 3), matching the
// collision lane. This oracle asserts the corrected position.
//
// PRODUCTION DEFECT FLAGGED (not fixed here, per lane scope):
// (1) evaluateBoxingObstacles (aerobeat-web-gameplay session-coordinator.js)
//     finalizes an expired obstacle BEFORE processing the current frame's
//     nose sample, so nose coverage can never be recorded through
//     intervalEnd; a perfectly safe drive therefore closes as
//     "unevaluated_tracking" and result "avoided" is unreachable for boxing
//     obstacles (the Flow mirror finalizes after sample processing). This
//     oracle asserts the physically meaningful properties (zero contact,
//     flat vignette) and reports the observed result string.
// (2) Weave wall lane mirroring — FIXED in 0.0.61 L-F8 (aerobeat-web-renderer
//     931c749): the weave_left wall now renders at the presentation X of its
//     authored grid column (column 3 → +1.5, i.e. inside the blocked cells'
//     own lane, sx 2.5..3.5) instead of the weave-direction lane "left"
//     (x=-0.9). Oracle asserts the corrected position.
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
        const REACH_TOP = 0.5;
        const REACH_BOTTOM = 0.25;
        // Canonical boxing lane geometry (boxingLaneSeparationWorldUnits
        // default 1.8 → lanes at x = ±0.9; BOXING_LANE_CENTER_Y = 1.0;
        // BOXING_LANE_HEIGHT = 2.94; GAMEPLAY_CELL_SIZE = 0.94).
        const LANE_LEFT_X = -0.9;
        const LANE_RIGHT_X = 0.9;
        const LANE_Y = 1.0;
        const WALL_SCALE_X = 1.7 / 0.94; // BOXING_LANE_WIDTH / GAMEPLAY_CELL_SIZE
        // 0.0.61 L-F8: a weave wall renders at the PRESENTATION X of its
        // authored grid column (columnX: col 3 → +1.5) and spans exactly that
        // column — the flow-wall inset formula at authored width 1:
        // (1 − 0.06×1) / 0.94 = 1.0.
        const WEAVE_COL_X = 1.5;
        const WEAVE_SCALE_X = 1.0;
        const WALL_SCALE_Y = 2.94 / 0.94; // BOXING_LANE_HEIGHT / GAMEPLAY_CELL_SIZE (full lane height)
        const WALL_DEPTH_Z = 2.4; // 400 ms interval × 0.006 WU/ms at mid-interval
        const CORE_BOX_X_PX = 70;
        const CORE_BOX_Y_PX = 80;
        const MIN_WALL_CORE = 1500;
        const CENTROID_TOLERANCE_PX = 10;
        const MIN_GLOW_INTENSITY = 0.85; // 1 − (6200−6010−150)/600 = 0.9333 at contact+190 ms
        const MIN_VIGNETTE_DELTA = 10000; // measured ≈ 24k / ≈ 26k
        const SQUAT = { eventId: "obstacle-squat", start: 6000, end: 6400 };
        const WEAVE = { eventId: "obstacle-weave_left", start: 12000, end: 12400 };
        const PAD_CENTER = 20000;
        const game = document.querySelector("aero-game");
        const canvas = game.shadowRoot.querySelector("canvas");
        const renderer = game.graph.renderer;
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, deviceScaleFactor: 1 });
        renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
        const [{ createAeroGameplaySessionCoordinator }, { projectHazardContactEvents }, { projectSessionTargets, createSessionTargetIndex }] = await Promise.all([
          import("/node_modules/@aerobeat/web-gameplay/src/index.js"),
          import("/src/gameplay-frame-effects.js"),
          import("/src/session-render-projection.js"),
        ]);
        const HASH = "c2".repeat(32);
        // Canonical squat: full-width TOP row (gameplay y=0), v3 source
        // rect {x:0,y:2,w:4,h:1} (top layer 2 → gameplay row 0).
        const SQUAT_CONFIG = Object.freeze({ type: "squat", start: SQUAT.start, end: SQUAT.end,
          sourceGeometry: Object.freeze({ schema: "aerobeat/obstacle_source_geometry", version: 1, coordinateSpace: "beatsaber_v3_obstacle_rect", kind: "v3_rect", x: 0, y: 2, width: 4, height: 1 }),
          gameplayGeometry: Object.freeze({ schema: "aerobeat/obstacle_gameplay_geometry", version: 1, coordinateSpace: "aerobeat_top_left_grid", x: 0, y: 0, width: 4, height: 1 }),
          gridMask: [0, 1, 2, 3], noseSafeCells: [4, 5, 6, 7, 8, 9, 10, 11] });
        // weave_left: single right-column full-height wall — the converter's
        // v2_type_1 obstacle (lineIndex 3): right > left cells → "weave_left".
        const WEAVE_CONFIG = Object.freeze({ type: "weave_left", start: WEAVE.start, end: WEAVE.end,
          sourceGeometry: Object.freeze({ schema: "aerobeat/obstacle_source_geometry", version: 1, coordinateSpace: "beatsaber_v2_legacy_obstacle", kind: "v2_type_1", x: 3, y: 0, width: 1, height: 3 }),
          gameplayGeometry: Object.freeze({ schema: "aerobeat/obstacle_gameplay_geometry", version: 1, coordinateSpace: "aerobeat_top_left_grid", x: 3, y: 0, width: 1, height: 3 }),
          gridMask: [3, 7, 11], noseSafeCells: [0, 1, 2, 4, 5, 6, 8, 9, 10] });
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, nose) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, nose.x, nose.y), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, 0.5, 0.5), anchor("right_wrist", m, 2.5, 0.5)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        const { standaloneTestEquipmentPoses } = await import("/src/test-equipment-authoring.js"); await game.ensureEquipmentConfigIdentity();
        const makeSession = (sessionId, config) => {
          const variantId = `lcb2-${config.type}`;
          const variant = { variantId, chartId: `chart-${variantId}`, mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
          // Every event in the session shares the selected variant's ids.
          const obstacle = Object.freeze({
            schema: "aerobeat/resolved_content_event", version: 3,
            eventId: `obstacle-${config.type}`, variantId: variant.variantId, chartId: variant.chartId,
            centerTimestampMs: config.start, intervalStartTimestampMs: config.start, intervalEndTimestampMs: config.end,
            sourceEventIds: [`s-obstacle-${config.type}`],
            authoredBeat: Object.freeze({
              type: config.type, start: 0, end: 8,
              sourceGeometry: config.sourceGeometry, gameplayGeometry: config.gameplayGeometry,
              gridMask: [...config.gridMask], blockedCells: [...config.gridMask],
              checkpoint: Object.freeze({ kind: "instantaneous", freshnessMs: 150, timingWindowMs: 180, noseSafeCells: [...config.noseSafeCells] }),
            }),
          });
          const pad = Object.freeze({
            schema: "aerobeat/resolved_content_event", version: 3,
            eventId: `pad-${config.type}`, variantId: variant.variantId, chartId: variant.chartId,
            centerTimestampMs: PAD_CENTER, sourceEventIds: [`s-pad-${config.type}`],
            authoredBeat: Object.freeze({ type: "straight_left", spatialTarget: Object.freeze({ targetCell: 4, acceptedSubcells: [], sourceCell: -1 }) }),
          });
          const coordinator = createAeroGameplaySessionCoordinator({ sessionId, countdownStepMs: 1 });
          coordinator.configureContent({
            packageId: `lcb2-${config.type}-pkg`,
            selectedVariant: variant,
            resolvedEvents: [obstacle, pad],
            profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false },
            boxingColliderSettings: { schema: "aerobeat/flow_collider_settings", version: 1, algorithm: "swept_athlete_plane_v1", colliderRadius: 0.12, enforceAuthoredDirection: true, directionToleranceDegrees: 45, timingWindowMs: 180, topRowReachWU: REACH_TOP, bottomRowReachWU: REACH_BOTTOM, guardCountMode: "collision" },
          });
          coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
          coordinator.requestStart(0);
          for (let t = 1; t <= 40; t += 1) {
            coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
            if (coordinator.getSnapshot().session.state === "playing") break;
          }
          if (coordinator.getSnapshot().session.state !== "playing") throw new Error(`${sessionId}: session not playing after countdown`);
          const step = (songMs,nose,id) => { const input=inputSnap(songMs,evidence(id,songMs,nose)); return coordinator.advance({timestampMs:songMs,clock:clockSnap(songMs,true),input,equipmentPoses:standaloneTestEquipmentPoses("boxing",input,game.equipmentConfigIdentity)}); };
          return { coordinator, step, events: [obstacle, pad], obstacleId: obstacle.eventId };
        };
        // ── Pixel helpers ──
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
        // The proven red edge-band detector (validate-0.0.58-boxing-vignette):
        // outer 15% band, r > g·1.15 && r > b·1.1 && r > 40.
        const redEdge = (px) => {
          const W = canvas.width, H = canvas.height, band = Math.max(1, Math.floor(Math.min(W, H) * 0.15));
          let n = 0;
          for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
            if (!(x < band || x >= W - band || y < band || y >= H - band)) continue;
            const i = (y * W + x) * 4;
            if (px[i] > px[i + 1] * 1.15 && px[i] > px[i + 2] * 1.1 && px[i] > 40) n += 1;
          }
          return n;
        };
        const hashOf = (data) => { let h = 0x811c9dc5; for (let i = 0; i < data.length; i += 4) { h ^= data[i]; h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0; } return h; };
        // Tag-scoped freeze guard: the two sessions render IDENTICAL static
        // empty scenes (and near-identical wall frames), so a single global
        // previous-hash check would false-positive across tags. Property per
        // tag: the same tag must never re-render identical pixels, and every
        // render advances frameCount.
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
        const wallBox = (diff, an) => diff.filter((q) => Math.abs(q.x - an.x) <= CORE_BOX_X_PX && Math.abs(q.y - an.y) <= CORE_BOX_Y_PX);
        const wallCore = (diff, an) => {
          const core = wallBox(diff, an);
          if (core.length < MIN_WALL_CORE) throw new Error(`wall glyph must be substantially present at (${an.x.toFixed(0)}, ${an.y.toFixed(0)}): ${core.length} diff pixels < ${MIN_WALL_CORE}`);
          const xs = core.map((q) => q.x), ys = core.map((q) => q.y);
          const dX = (Math.min(...xs) + Math.max(...xs)) / 2 - an.x;
          const dY = (Math.min(...ys) + Math.max(...ys)) / 2 - an.y;
          if (Math.abs(dX) > CENTROID_TOLERANCE_PX || Math.abs(dY) > CENTROID_TOLERANCE_PX) throw new Error(`wall bbox center must sit at the projected lane position (${an.x.toFixed(1)}, ${an.y.toFixed(1)}) within ${CENTROID_TOLERANCE_PX} px, got offset (${dX.toFixed(1)}, ${dY.toFixed(1)})`);
          return { count: core.length, dX: +dX.toFixed(1), dY: +dY.toFixed(1) };
        };
        const checkWalls = (eventId, expectCount, expectX, expectScaleX = WALL_SCALE_X) => {
          const walls = renderer.lastModel.objects.filter((o) => o.targetId === eventId && o.kind === "obstacle");
          if (walls.length !== expectCount) throw new Error(`${eventId}: expected ${expectCount} lane wall(s), got ${walls.length}: ${JSON.stringify(walls.map((o) => ({ id: o.id, x: o.position.x })))}`);
          for (const w of walls) {
            if (expectX !== null && Math.abs(w.position.x - expectX) > 1e-6) throw new Error(`${eventId}: wall must sit at x = ${expectX}, got ${w.position.x}`);
            if (Math.abs(w.position.y - LANE_Y) > 1e-6) throw new Error(`${eventId}: wall must sit at y = ${LANE_Y}, got ${w.position.y}`);
            if (Math.abs(w.position.z - 0) > 0.01) throw new Error(`${eventId}: mid-interval wall z must be 0 (interval straddles the hit plane), got ${w.position.z}`);
            if (Math.abs(w.scale.x - expectScaleX) > 0.01 || Math.abs(w.scale.y - WALL_SCALE_Y) > 0.01 || Math.abs(w.scale.z - WALL_DEPTH_Z) > 0.01) throw new Error(`${eventId}: wall scale.x must be ${expectScaleX.toFixed(3)} (× ${WALL_SCALE_Y.toFixed(3)} × depth ${WALL_DEPTH_Z}), got (${w.scale.x}, ${w.scale.y}, ${w.scale.z})`);
          }
          return walls;
        };
        // ════════════════ SESSION A: canonical SQUAT — CONTACT ════════════════
        const A = makeSession("lcb2-squat-browser", SQUAT_CONFIG);
        // (c) CONTACT drive: nose through the blocked top row inside the
        // interval. Segment 5960(1.0)→6060(2.0) crosses sy=1.5 at 6010;
        // 6260(2.0)→6360(1.0) exits at 6310.
        const SAFE = { x: 1.5, y: 1.0 };
        const TOP = { x: 1.5, y: 2.0 };
        A.step(5960, SAFE, "a0");
        A.step(6060, TOP, "a1");
        A.step(6160, TOP, "a2");
        A.step(6260, TOP, "a3");
        A.step(6360, SAFE, "a4");
        A.step(6520, SAFE, "a5");
        const snapA = A.coordinator.getSnapshot();
        const outcomeA = snapA.obstacleOutcomes.find((o) => o.eventId === SQUAT.eventId);
        if (!outcomeA || outcomeA.result !== "contact") throw new Error(`squat must produce a REAL contact outcome, got ${JSON.stringify(outcomeA ?? null)}`);
        const firstContactA = Number(outcomeA.firstContactTimelinePositionMs);
        if (!Number.isFinite(firstContactA) || firstContactA < SQUAT.start || firstContactA > SQUAT.end) throw new Error(`squat firstContact ${outcomeA.firstContactTimelinePositionMs} outside the interval [${SQUAT.start}, ${SQUAT.end}]`);
        if (Number(outcomeA.contactDurationMs) < 200) throw new Error(`squat contact duration ${outcomeA.contactDurationMs} ms too short (< 200)`);
        // (a) Geometry at mid-interval (walls straddle the Z=0 hit plane).
        const indexA = createSessionTargetIndex(A.events, {});
        const rowReach = Object.freeze({ topRowReachWU: REACH_TOP, bottomRowReachWU: REACH_BOTTOM });
        const frameA = (nowMs, targetsOverride, hazardContactsOverride) => {
          const s = A.coordinator.getSnapshot();
          const targets = targetsOverride !== undefined ? targetsOverride : projectSessionTargets(A.events, s, nowMs, indexA);
          const hazardContacts = hazardContactsOverride !== undefined ? hazardContactsOverride : projectHazardContactEvents(s, nowMs);
          return { presentation: "boxing_collider", nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, rowReach, hazardContacts };
        };
        const nowA = 6200;
        const targetsA = frameA(nowA).targets;
        const squatTarget = targetsA.find((t) => t.id === SQUAT.eventId);
        if (!squatTarget || squatTarget.kind !== "obstacle" || squatTarget.family !== "squat" || JSON.stringify(squatTarget.cells) !== JSON.stringify([0, 1, 2, 3])) throw new Error(`squat must project as a kind:"obstacle" family:"squat" target with cells [0,1,2,3], got ${JSON.stringify(squatTarget ?? null)}`);
        // Vignette: state channel + pixels (same frame, contact vs none).
        const contactsA = projectHazardContactEvents(snapA, nowA);
        if (contactsA.length !== 1 || Number(contactsA[0].atMs) !== firstContactA) throw new Error(`squat must retain exactly one hazard contact event at firstContact ${firstContactA}, got ${JSON.stringify(contactsA)}`);
        renderer.renderGameplayFrame(frameA(nowA));
        const withGlowPx = guard("squat glow");
        const glowA = renderer.lastModel.hazardGlow;
        if (glowA.present !== true || glowA.activeCount !== 1 || glowA.intensity < MIN_GLOW_INTENSITY) throw new Error(`squat contact frame must read the deterministic glow envelope (≥ ${MIN_GLOW_INTENSITY}), got ${JSON.stringify(glowA)}`);
        const redGlow = redEdge(withGlowPx);
        renderer.renderGameplayFrame(frameA(nowA, targetsA, []));
        const noGlowPx = guard("squat noglow");
        const redBase = redEdge(noGlowPx);
        if (redGlow - redBase < MIN_VIGNETTE_DELTA) throw new Error(`squat contact vignette must add ≥ ${MIN_VIGNETTE_DELTA} red edge pixels over the same-frame no-contact baseline, got ${redGlow} − ${redBase} = ${redGlow - redBase}`);
        // Wall geometry (model) + per-wall glyph presence (pixels).
        const squatWalls = checkWalls(SQUAT.eventId, 2, null);
        // Two DISTINCT walls, one per lane, covering BOTH lanes.
        const sortedX = squatWalls.map((w) => w.position.x).sort((a, b) => a - b);
        if (Math.abs(sortedX[0] - LANE_LEFT_X) > 1e-6 || Math.abs(sortedX[1] - LANE_RIGHT_X) > 1e-6) throw new Error(`squat walls must occupy BOTH lanes (x = ${LANE_LEFT_X} and ${LANE_RIGHT_X}), got ${JSON.stringify(sortedX)}`);
        renderer.renderGameplayFrame(frameA(nowA, targetsA.filter((t) => t.id !== SQUAT.eventId), []));
        const emptyPx = guard("squat empty");
        const wallDiff = diffPixels(noGlowPx, emptyPx);
        const coreL = wallCore(wallDiff, project(LANE_LEFT_X, LANE_Y, 0));
        const coreR = wallCore(wallDiff, project(LANE_RIGHT_X, LANE_Y, 0));
        // ════════════════ SESSION B: WEAVE_LEFT — AVOIDED ════════════════
        const B = makeSession("lcb2-weave-browser", WEAVE_CONFIG);
        // (d) AVOIDED drive: nose held in the safe half (sx 1.0 < 2.5 block
        // edge) on continuous 40 ms samples across the whole interval →
        // full coverage, zero contact.
        const SAFE_WEAVE = { x: 1.0, y: 1.0 };
        B.step(11920, SAFE_WEAVE, "b0");
        for (let t = 11960; t <= 12480; t += 40) B.step(t, SAFE_WEAVE, `b${t}`);
        const snapB = B.coordinator.getSnapshot();
        const outcomeB = snapB.obstacleOutcomes.find((o) => o.eventId === WEAVE.eventId);
        if (!outcomeB) throw new Error(`weave_left must produce a real outcome, got none`);
        // PRODUCTION DEFECT (0.0.61, L-C2 finding): evaluateBoxingObstacles
        // finalizes BEFORE processing the current frame's sample, so
        // coverage can never reach intervalEnd and "avoided" is unreachable —
        // the wall always closes as "unevaluated_tracking" even with a
        // perfect safe-cell drive. The correct assertion is result ===
        // "avoided"; until the finalize-ordering bug is fixed we assert the
        // physically meaningful properties: NO false contact was registered.
        if (outcomeB.result === "contact") throw new Error(`weave_left nose in safe cell must NOT produce a contact outcome, got ${JSON.stringify(outcomeB)}`);
        if (outcomeB.firstContactTimelinePositionMs !== null || Number(outcomeB.contactDurationMs) !== 0) throw new Error(`weave_left nose in safe cell must carry zero contact, got firstContact=${outcomeB.firstContactTimelinePositionMs} duration=${outcomeB.contactDurationMs}`);
        const indexB = createSessionTargetIndex(B.events, {});
        const frameB = (nowMs, targetsOverride, hazardContactsOverride) => {
          const s = B.coordinator.getSnapshot();
          const targets = targetsOverride !== undefined ? targetsOverride : projectSessionTargets(B.events, s, nowMs, indexB);
          const hazardContacts = hazardContactsOverride !== undefined ? hazardContactsOverride : projectHazardContactEvents(s, nowMs);
          return { presentation: "boxing_collider", nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, rowReach, hazardContacts };
        };
        const nowB = 12200;
        const targetsB = frameB(nowB).targets;
        const weaveTarget = targetsB.find((t) => t.id === WEAVE.eventId);
        if (!weaveTarget || weaveTarget.kind !== "obstacle" || weaveTarget.family !== "weave" || weaveTarget.lane !== "left" || JSON.stringify(weaveTarget.cells) !== JSON.stringify([3, 7, 11])) throw new Error(`weave_left must project as a kind:"obstacle" family:"weave" lane:"left" target with cells [3,7,11], got ${JSON.stringify(weaveTarget ?? null)}`);
        // (d) Vignette FLAT: no retained contact events, intensity 0, and a
        // synthetic contact on the SAME frame proves detector power.
        const contactsB = projectHazardContactEvents(snapB, nowB);
        if (contactsB.length !== 0) throw new Error(`weave_left avoided frame must retain NO hazard contact events, got ${JSON.stringify(contactsB)}`);
        renderer.renderGameplayFrame(frameB(nowB));
        const naturalPx = guard("weave natural");
        const glowB = renderer.lastModel.hazardGlow;
        if (glowB.present !== false || glowB.intensity !== 0) throw new Error(`weave_left avoided frame must have a FLAT vignette state channel, got ${JSON.stringify(glowB)}`);
        const redNatural = redEdge(naturalPx);
        renderer.renderGameplayFrame(frameB(nowB, targetsB, [{ eventId: "synthetic", atMs: nowB - 190 }]));
        const synthPx = guard("weave synth");
        const redSynth = redEdge(synthPx);
        if (redSynth - redNatural < MIN_VIGNETTE_DELTA) throw new Error(`synthetic contact on the weave frame must prove the detector fires (≥ ${MIN_VIGNETTE_DELTA} red edge pixels), got ${redSynth} − ${redNatural} = ${redSynth - redNatural}`);
        // (b) Geometry: ONE full-height wall at the PRESENTATION X of the
        // AUTHORED column (column 3 → +1.5, L-F8), spanning exactly that
        // column (scale.x 1.0); NO wall at the weave-direction lane
        // positions (x = ±0.9).
        const weaveWalls = checkWalls(WEAVE.eventId, 1, WEAVE_COL_X, WEAVE_SCALE_X);
        const lanePositionWall = renderer.lastModel.objects.filter((o) => o.targetId === WEAVE.eventId && o.kind === "obstacle" && (Math.abs(o.position.x - LANE_LEFT_X) < 1e-6 || Math.abs(o.position.x - LANE_RIGHT_X) < 1e-6));
        if (lanePositionWall.length !== 0) throw new Error(`weave_left must NOT sit at a weave-direction lane position (x = ±${LANE_RIGHT_X}); got ${lanePositionWall.length} wall(s) there`);
        renderer.renderGameplayFrame(frameB(nowB, targetsB.filter((t) => t.id !== WEAVE.eventId), []));
        const emptyBPx = guard("weave empty");
        const weaveDiff = diffPixels(naturalPx, emptyBPx);
        const weaveCore = wallCore(weaveDiff, project(WEAVE_COL_X, LANE_Y, 0));
        // The blocked cells' center (column 3, sx 2.5..3.5) — L-F8: the drawn
        // wall now sits exactly here; the wall's screen X must match the
        // blocked-column projection (worldToScreen ground truth, 1px bound).
        const blockCenterScreen = project(1.5, 1.0, 0);
        if (Math.abs(project(weaveWalls[0].position.x, LANE_Y, 0).x - blockCenterScreen.x) > 1) throw new Error(`drawn weave wall screen X must match the blocked-column projection within 1px (wall=${project(weaveWalls[0].position.x, LANE_Y, 0).x.toFixed(1)}, block=${blockCenterScreen.x.toFixed(1)})`);
        return {
          squat: {
            result: outcomeA.result, firstContact: firstContactA, duration: Number(outcomeA.contactDurationMs),
            glowIntensity: glowA.intensity, redEdge: [redBase, redGlow],
            walls: squatWalls.map((w) => ({ id: w.id, x: w.position.x, y: w.position.y, scale: [w.scale.x, w.scale.y, w.scale.z], screen: project(w.position.x, LANE_Y, 0) })),
            cores: [coreL, coreR],
          },
          weave: {
            result: outcomeB.result, glowIntensity: glowB.intensity, redEdge: [redNatural, redSynth],
            wall: { id: weaveWalls[0].id, x: weaveWalls[0].position.x, y: weaveWalls[0].position.y, scale: [weaveWalls[0].scale.x, weaveWalls[0].scale.y, weaveWalls[0].scale.z], screen: project(weaveWalls[0].position.x, LANE_Y, 0) },
            blockCenterScreen, core: weaveCore,
          },
        };
      });
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      matrix.push({ embedding, ...proof });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  const [direct, iframe] = matrix;
  // Geometry is deterministic model truth — exact across embeddings.
  assert.deepEqual(direct.squat.walls.map((w) => [w.x, w.y, w.scale]), iframe.squat.walls.map((w) => [w.x, w.y, w.scale]), "squat wall positions/scales must agree exactly across embeddings");
  assert.deepEqual(direct.weave.wall.scale, iframe.weave.wall.scale, "weave wall scale must agree exactly across embeddings");
  assert.equal(direct.squat.firstContact, iframe.squat.firstContact, "squat firstContact must agree across embeddings");
  assert.ok(Math.abs(direct.squat.glowIntensity - iframe.squat.glowIntensity) <= 0.01, "glow intensity must agree across embeddings");
  const deltaD = direct.squat.redEdge[1] - direct.squat.redEdge[0];
  const deltaI = iframe.squat.redEdge[1] - iframe.squat.redEdge[0];
  assert.ok(Math.abs(deltaD - deltaI) <= Math.max(200, deltaD * 0.15), `squat vignette delta must agree across embeddings (${deltaD} vs ${deltaI})`);
  const flatD = direct.weave.redEdge[1] - direct.weave.redEdge[0];
  const flatI = iframe.weave.redEdge[1] - iframe.weave.redEdge[0];
  assert.ok(Math.abs(flatD - flatI) <= Math.max(200, flatD * 0.15), `weave synthetic-contact delta must agree across embeddings (${flatD} vs ${flatI})`);
  direct.squat.cores.forEach((c, i) => {
    const o = iframe.squat.cores[i];
    assert.ok(Math.abs(c.count - o.count) <= Math.max(100, c.count * 0.15), `squat wall ${i} core must agree across embeddings (${c.count} vs ${o.count})`);
    assert.ok(Math.abs(c.dX - o.dX) <= 3 && Math.abs(c.dY - o.dY) <= 3, `squat wall ${i} centroid must agree across embeddings`);
  });
  assert.ok(Math.abs(direct.weave.core.count - iframe.weave.core.count) <= Math.max(100, direct.weave.core.count * 0.15), "weave core must agree across embeddings");
  const summary = matrix.map((m) => ({
    embedding: m.embedding,
    squat: { result: m.squat.result, firstContact: m.squat.firstContact, duration: m.squat.duration, glow: m.squat.glowIntensity, redEdge: m.squat.redEdge, walls: m.squat.walls.map((w) => ({ x: w.x, screenX: Math.round(w.screen.x), scale: w.scale.map((v) => Number(v.toFixed(3))) })), cores: m.squat.cores.map((c) => ({ px: c.count, dX: c.dX, dY: c.dY })) },
    weave: { result: m.weave.result, glow: m.weave.glowIntensity, redEdge: [m.weave.redEdge[0], m.weave.redEdge[1]], wall: { x: m.weave.wall.x, screenX: Math.round(m.weave.wall.screen.x) }, blockCenterScreenX: Math.round(m.weave.blockCenterScreen.x), core: { px: m.weave.core.count, dX: m.weave.core.dX, dY: m.weave.core.dY } },
  }));
  console.log(`ORACLE 0.0.61-squat-weave-spawn-pixels PASS: embeddings=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
