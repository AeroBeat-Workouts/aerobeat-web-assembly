// @ts-check

// 0.0.60 W2b (F2) real-pixel oracle — a REAL boxing punch hit must spawn its
// aftermath "hit corpse" at the SAME screen position as the live note icon it
// replaces: no single-frame horizontal jump from note to corpse (the
// knock/launch then plays from that position). Proven by reading REAL rendered
// canvas pixels (OffscreenCanvas drawImage + getImageData of the PlayCanvas
// canvas), NOT the scene-graph model.
//
// This REPLACES the broken 0.0.59 B15 oracle (untracked until this commit):
// the old version built events with `type`/`spatialTarget` at TOP LEVEL and NO
// `authoredBeat`, so `projectSessionTargets` (which reads `authoredBeat.type`)
// fell back to "note" → punches projected as FLOW targets with cell:null →
// the renderer's boxing_collider branch hit the LANE fallback (x=−0.9 for
// every left-hand punch) → pixel-identical frames (the "freeze"). Its
// expected note position used the same false `cell % 4` identity
// (self-referential) and it flipped Y twice.
//
// What this oracle proves (driving a REAL boxing_collider_v1 session through
// the public input path — measured wrist evidence swept into the authored
// target cells, real committed HIT judgements):
//   (a) GATE-ASSERT: every authored punch projects as kind "punch" with the
//       authored targetCell set (catches the shape-mismatch class above).
//   (b) Unit anchor: `projectAftermathEntries` (the REAL assembly output,
//       imported from ../src) spawns each punch at
//       { x: gameplayWorldGrid.columnX[cell % 4],
//         y: boxingColliderRowY(row, reach).worldY, z: 0 } — the renderer's
//       own grid constant, not the judge-plane X (cell % 4 ∈ 0..3).
//   (c) Pixels: at nowMs = commit + 4..16 ms (the straight launch
//       {x:0,y:0.5,z:−4} WU/s moves the glyph < 2 px in that window — the
//       corpse still sits AT the spawn), the corpse's diff-pixel centroid
//       equals the note icon's screen position (READ FROM THE RENDERER: the
//       icon's world position in the scene model at the commit frame,
//       projected with camera.worldToScreen — top-left-origin y-down, no
//       manual flip) within ≤ 6 px X / ≤ 12 px Y.  The baseline is the SAME
//       frame at the SAME nowMs minus the aftermath entry, so the diff
//       isolates EXACTLY the corpse (the note's removal fade is in both).
//       Pre-fix the corpse spawned at the judge-plane X (+1.5 WU) → ΔX ≈
//       131 px at this camera, far outside tolerance.
//   (d) Glyph presence: the corpse's diff bounding box must contain a
//       substantial glyph (crop vs. baseline-region diff ≥ 30 % of the box).
//   (e) Knock smoothness: frame-to-frame centroid deltas across the whole
//       sample window stay < 30 px (continuous launch, no teleport).
//   (f) Freeze guard: every sample render must advance the renderer
//       frameCount AND change the pixel hash vs the previous sample.
//
// Multi-cell + reach coverage: cell 4 (col 0, mid row), cell 6 (col 2, mid
// row) at default bottom reach, and cell 0 (col 0, TOP row) with
// non-default topRowReachWU 0.5 (the mid-row spawns are reach-independent,
// so only the top-row case exercises a non-default reach fraction).
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface).
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

// Row-reach fractions for the whole probe: TOP row uses a NON-default 0.5
// (default is 0.25) so the reach-row Y path is exercised distinctly; the
// mid-row punches are reach-independent (y = 1 at any reach).
const REACH_TOP = 0.5;
const REACH_BOTTOM = 0.25;
// Canvas (renderer.resize 844×390 dpr 1).
const VIEW_W = 844;
const VIEW_H = 390;
// Centroid tolerance (px) for "corpse centroid ≈ note-icon screen position".
// The pre-fix X error is 1.5 WU ≈ 131 px at this camera (87.6 px/WU at z=0);
// 6 px ≪ 131 px, yet > antialiasing/centroid noise (~1 px at the 4..16 ms
// window, where the perspective shrink of the −4 WU/s launch is ≤ 2 px and
// the +0.5 WU/s launch Y-drift is < 1 px).  Y gets 2× to absorb the launch
// drift + perspective together.
const SPAWN_MATCH_TOLERANCE_PX = 6;
const SPAWN_MATCH_TOLERANCE_Y_PX = 12;
// Max allowed frame-to-frame centroid delta across the knock (continuous
// launch, no teleport): far below any single-frame +131 px spawn jump.
const KNOCK_STEP_BOUND_PX = 30;
// Post-commit sample offsets (ms).  4..16: tight spawn-match window (launch
// sub-pixel-to-few-px); 40..103: knock-smoothness window (the corpse keeps
// falling off-screen — one uninterrupted parabola, 0.0.59 B14).
const SAMPLE_OFFSETS_MS = [4, 8, 12, 16, 40, 88, 103];
const TIGHT_MATCH_OFFSETS_MS = new Set([4, 8, 12, 16]);
// Minimum visible glyph pixels for a corpse sample (an orb glyph is ~5k px).
const MIN_CORPSE_PIXELS = 150;

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
    const context = await browser.newContext({ viewport: embedding === "direct" ? { width: 844, height: 390 } : { width: 868, height: 414 }, deviceScaleFactor: 1 });
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
        const SAMPLE_OFFSETS_MS = [4, 8, 12, 16, 40, 88, 103];
        if (SAMPLE_OFFSETS_MS.length !== 7) throw new Error("sample offsets literal drifted");
        const TIGHT_MATCH_OFFSETS_MS = new Set([4, 8, 12, 16]);
        const MIN_CORPSE_PIXELS = 150;
        const VIEW_W = 844;
        const VIEW_H = 390;
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
        // ── PRODUCTION-SHAPED chart: authoredBeat.{type, hand, spatialTarget} ──
        const HASH = "a".repeat(64);
        const variant = { variantId: "w2b-pixel", chartId: "chart-w2b-pixel", mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const punchEvent = (eventId, centerTimestampMs, targetCell, hand) => Object.freeze({
          schema: "aerobeat/resolved_content_event", version: 3,
          eventId, variantId: variant.variantId, chartId: variant.chartId,
          centerTimestampMs, sourceEventIds: [`s-${eventId}`],
          authoredBeat: {
            type: hand === "left" ? "straight_left" : "straight_right",
            hand,
            spatialTarget: { targetCell, acceptedSubcells: [], sourceCell: -1 },
          },
        });
        // Three punches: cell 4 (col 0, mid row), cell 6 (col 2, mid row),
        // cell 0 (col 0, TOP row → exercises the non-default top reach).
        const events = [
          punchEvent("p-cell4", 6000, 4, "left"),
          punchEvent("p-cell6", 12000, 6, "right"),
          punchEvent("p-cell0", 22000, 0, "left"),
        ];
        // Measured-anchor helper: (sx, sy) are judge-space coordinates (the
        // anchor x/y normalize so 4·x_norm−0.5 = sx / 2.5−3·y_norm = sy —
        // the exact mapping of `measuredColliderSample`).
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, sx, sy, rx, ry) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, 2, 1.5), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, sx, sy), anchor("right_wrist", m, rx, ry)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        const { standaloneTestEquipmentPoses } = await import("/src/test-equipment-authoring.js"); await game.ensureEquipmentConfigIdentity();
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "w2b-pixel-browser", countdownStepMs: 1 });
        coordinator.configureContent({
          packageId: "w2b-pkg",
          selectedVariant: variant,
          resolvedEvents: events,
          profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false },
          boxingColliderSettings: { schema: "aerobeat/flow_collider_settings", version: 1, algorithm: "swept_athlete_plane_v1", colliderRadius: 0.12, enforceAuthoredDirection: true, directionToleranceDegrees: 45, timingWindowMs: 180, topRowReachWU: REACH_TOP, bottomRowReachWU: REACH_BOTTOM, guardCountMode: "collision" },
        });
        // The calibration input at t=0 (readiness "countdown", calibrationId)
        // must land BEFORE requestStart so safetyReady is set when the start
        // is accepted (the proven vignette-oracle sequence).
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        coordinator.requestStart(0);
        const step = (songMs, lw, rw, id) => { const input=inputSnap(songMs,evidence(id,songMs,lw.x,lw.y,rw.x,rw.y)); return coordinator.advance({ timestampMs:songMs,clock:clockSnap(songMs,true),input,equipmentPoses:standaloneTestEquipmentPoses("boxing",input,game.equipmentConfigIdentity,coordinator.getSnapshot()) }); };
        // Step through the wall-clock countdown (clock frozen at 0 until the
        // state flips to "playing").
        for (let t = 1; t <= 40; t += 1) {
          coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
          if (coordinator.getSnapshot().session.state === "playing") break;
        }
        const preState = coordinator.getSnapshot().session.state;
        if (preState !== "playing") throw new Error(`session must be "playing" before driving the punches, got "${preState}" (countdownStepMs: 1 required)`);
        // Drive each punch: hold the OWN wrist (straights are hand-strict)
        // statically inside the target's judge slab (half-extent 0.375 +
        // colliderRadius 0.12 = 0.495) across the ±180 ms timing window.
        //   cell 4 → straight_left,  judge (0, 1)   slab sx∈[−0.495,0.495], sy∈[0.505,1.495]
        //   cell 6 → straight_right, judge (2, 1)   slab sx∈[1.505,2.495], sy∈[0.505,1.495]
        //   cell 0 → straight_left,  judge (0, 1.5) slab sx∈[−0.495,0.495], sy∈[1.005,1.995] (reach 0.5)
        // (0, 1.25) sits inside the cell-4 AND cell-0 slabs; (2, 1.25) in cell 6.
        const IDLE = { x: 3, y: 1 };
        const drivePunch = (centerMs, eventId, side, wx, wy) => {
          for (const d of [-200, -150, -100, -50, 0, 50, 100, 200]) {
            const lw = side === "left" ? { x: wx, y: wy } : IDLE;
            const rw = side === "right" ? { x: wx, y: wy } : IDLE;
            step(centerMs + d, lw, rw, `${eventId}-${d}`);
          }
        };
        drivePunch(6000, "p-cell4", "left", 0, 1.25);
        drivePunch(12000, "p-cell6", "right", 2, 1.25);
        drivePunch(22000, "p-cell0", "left", 0, 1.25);
        const snap = coordinator.getSnapshot();
        const hitFor = (eventId) => {
          const hit = snap.judgements.find((j) => j.eventId === eventId);
          if (!hit || hit.result !== "hit") throw new Error(`expected a real committed HIT for ${eventId}, got ${JSON.stringify(hit ?? null)} judgements=${JSON.stringify(snap.judgements.map((j) => [j.eventId, j.result]))}`);
          return Number(hit.committedTimelinePositionMs);
        };
        const commitA = hitFor("p-cell4");
        const commitB = hitFor("p-cell6");
        const commitC = hitFor("p-cell0");
        // The wrist enters the slab before the timing window, so point contact
        // commits on the first in-window sample (center − 150 ms); the commit
        // must be a real contact time INSIDE each punch's ±180 ms window.
        for (const [label, commit, center] of [["cell4", commitA, 6000], ["cell6", commitB, 12000], ["cell0", commitC, 22000]]) {
          if (Math.abs(commit - center) > 180) throw new Error(`${label} commit off expected center: ${commit} vs ${center}`);
        }
        // ── Unit anchor: the REAL assembly output (projectAftermathEntries)
        //    spawns each punch at the note icon's rendered world position ──
        const index = createSessionTargetIndex(events, {});
        const rowReach = Object.freeze({ topRowReachWU: REACH_TOP, bottomRowReachWU: REACH_BOTTOM });
        // Derive at a nowMs at or after ALL commits so every hit judgement
        // is an active aftermath candidate.
        const anchorNowMs = Math.max(commitA, commitB, commitC);
        const unitAnchor = (eventId, targetCell, expected) => {
          const list = projectAftermathEntries(events, snap, anchorNowMs, [], index, rowReach);
          const entry = list.find((e) => e.targetId === eventId);
          if (!entry) throw new Error(`projectAftermathEntries produced no entry for ${eventId} (got ${JSON.stringify(list.map((e) => e.targetId))})`);
          if (Math.abs(entry.spawn.x - expected.x) > 1e-9 || Math.abs(entry.spawn.y - expected.y) > 1e-9 || Math.abs(entry.spawn.z - expected.z) > 1e-9) {
            throw new Error(`${eventId} (cell ${targetCell}) spawn must be the note icon's rendered position {x: gameplayWorldGrid.columnX[${targetCell % 4}], y: boxingColliderRowY(${Math.floor(targetCell / 4)}, reach).worldY, z: 0} = (${expected.x}, ${expected.y}, ${expected.z}), got (${entry.spawn.x}, ${entry.spawn.y}, ${entry.spawn.z})`);
          }
          return entry;
        };
        const entryA = unitAnchor("p-cell4", 4, { x: gameplayWorldGrid.columnX[0], y: 1, z: 0 });
        const entryB = unitAnchor("p-cell6", 6, { x: gameplayWorldGrid.columnX[2], y: 1, z: 0 });
        const entryC = unitAnchor("p-cell0", 0, { x: gameplayWorldGrid.columnX[0], y: 1 + REACH_TOP, z: 0 });
        // ── Pixel-level oracle ──
        const canvas = game.shadowRoot.querySelector("canvas");
        const readPixels = () => {
          const sample = new OffscreenCanvas(canvas.width, canvas.height);
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, sample.width, sample.height).data;
        };
        // World → screen through the LIVE production camera. PlayCanvas
        // `worldToScreen` returns canvas pixels, TOP-LEFT origin, y DOWN —
        // no manual flip (the old oracle flipped Y twice; this must not).
        const project = (x, y, z) => {
          const out = renderer.cameraEntity.camera.worldToScreen({ x, y, z });
          return { x: out.x, y: out.y };
        };
        // Frame derivation EXACTLY like the assembly rendererFrame():
        // projection targets + REAL aftermath from projectAftermathEntries.
        const frameAt = (nowMs) => {
          const s = coordinator.getSnapshot();
          const targets = projectSessionTargets(events, s, nowMs, index);
          const aftermath = projectAftermathEntries(events, s, nowMs, targets, index, rowReach);
          return {
            presentation: "boxing_collider",
            nowMs,
            targets,
            timingWindowBeforeMs: 180,
            timingWindowAfterMs: 180,
            aftermath,
            rowReach,
          };
        };
        // (a) GATE-ASSERT: each authored punch projects as a real PUNCH target
        // with its authored cell (the shape-mismatch class that caused the
        // old "freeze" — top-level type, no authoredBeat → flow/lane fallback).
        for (const [label, nowMs, cell] of [["cell4", 6000, 4], ["cell6", 12000, 6], ["cell0", 22000, 0]]) {
          const tFrame = frameAt(nowMs);
          const punchTarget = tFrame.targets.find((t) => t.kind === "punch" && t.cell === cell);
          if (!punchTarget) {
            const kinds = tFrame.targets.map((t) => `${t.id}:${t.kind}:cell=${t.cell}`).join(", ");
            throw new Error(`GATE-ASSERT ${label}: no projected kind=punch target with cell=${cell} at ${nowMs}ms (punches must project as real punch targets, not flow/lane fallback). targets=[${kinds}]`);
          }
        }
        const punches = [
          { label: "cell4-mid", eventId: "p-cell4", commitMs: commitA, targetCell: 4 },
          { label: "cell6-mid", eventId: "p-cell6", commitMs: commitB, targetCell: 6 },
          { label: "cell0-top", eventId: "p-cell0", commitMs: commitC, targetCell: 0 },
        ];
        const results = [];
        // (f) freeze-guard state across all samples of this embedding.
        let prevFrameCount = 0;
        let prevPixelHash = null;
        // Driving the session (advance/requestStart) restarted the app frame
        // loop; stop it again so the oracle's renderGameplayFrame calls
        // exclusively control the canvas.
        game.stopFrameLoop();
        renderer.clear();
        for (const punch of punches) {
          renderer.clear();
          const rows = [];
          for (const offsetMs of SAMPLE_OFFSETS_MS) {
            const nowMs = punch.commitMs + offsetMs;
            const frame = frameAt(nowMs);
            // Per-frame SAME-NOWMS baseline: the identical frame minus the
            // aftermath entry → the pixel diff isolates EXACTLY the corpse
            // (the note's removal fade is present in both frames).
            renderer.renderGameplayFrame({ ...frame, aftermath: [] });
            const base = readPixels();
            renderer.renderGameplayFrame(frame);
            // (f) freeze guard: frameCount must advance + pixels must change.
            const frameCount = renderer.describe().frameCount;
            if (frameCount <= prevFrameCount) throw new Error(`FREEZE GUARD ${punch.label} +${offsetMs}ms: renderer frameCount did not advance (${prevFrameCount} → ${frameCount}) — literal canvas freeze`);
            prevFrameCount = frameCount;
            const pixels = readPixels();
            let pixelHash = 0;
            for (let i = 0; i < pixels.length; i += 4) pixelHash = (pixelHash + pixels[i] * 31 + pixels[i + 1] * 17 + pixels[i + 2]) | 0;
            if (pixelHash === prevPixelHash) throw new Error(`FREEZE GUARD ${punch.label} +${offsetMs}ms: pixel hash identical to the previous sample — canvas is frozen`);
            prevPixelHash = pixelHash;
            // Diff pixels (the corpse), bounding box + centroid.
            let count = 0, sumX = 0, sumY = 0, minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
            const w = canvas.width;
            for (let i = 0; i < pixels.length; i += 4) {
              if (Math.abs(pixels[i] - base[i]) + Math.abs(pixels[i + 1] - base[i + 1]) + Math.abs(pixels[i + 2] - base[i + 2]) <= 30) continue;
              const x = (i / 4) % w, y = Math.floor(i / 4 / w);
              count += 1; sumX += x; sumY += y;
              if (x < minX) minX = x; if (y < minY) minY = y;
              if (x > maxX) maxX = x; if (y > maxY) maxY = y;
            }
            if (count > 0 && count < MIN_CORPSE_PIXELS) throw new Error(`${punch.label} +${offsetMs}ms: corpse must render visibly (only ${count} diff px)`);
            // (d) glyph-presence sanity: the crop (diff bbox, padded) read
            // FROM THE CANVAS — before any further re-render — must differ
            // from the baseline region in a substantial fraction of the box.
            let cropDiff = 0, cropBox = null;
            if (count > 0) {
              const pad = 6;
              const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
              const sw = Math.min(w - sx, maxX - minX + pad * 2), sh = Math.min(canvas.height - sy, maxY - minY + pad * 2);
              const crop = new OffscreenCanvas(sw, sh);
              crop.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
              const cropPixels = crop.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
              for (let yy = 0; yy < sh; yy += 1) {
                for (let xx = 0; xx < sw; xx += 1) {
                  const ci = (yy * sw + xx) * 4;
                  const bi = ((sy + yy) * w + (sx + xx)) * 4;
                  if (Math.abs(cropPixels[ci] - base[bi]) + Math.abs(cropPixels[ci + 1] - base[bi + 1]) + Math.abs(cropPixels[ci + 2] - base[bi + 2]) > 30) cropDiff += 1;
                }
              }
              cropBox = { x: sx, y: sy, w: sw, h: sh };
              if (cropDiff < 0.3 * sw * sh) throw new Error(`${punch.label} +${offsetMs}ms: crop sanity failed — only ${cropDiff}/${sw * sh} box px differ from baseline; the crop does not contain the corpse glyph`);
            }
            rows.push({ offsetMs, count, meanX: count ? sumX / count : null, meanY: count ? sumY / count : null, cropBox, cropDiff });
          }
          // (c) ground truth READ FROM THE RENDERER: render the commit frame,
          // read the icon's world position from the scene model (lastModel),
          // project it — this is the note's disappearance pixel.
          const commitFrame = frameAt(punch.commitMs);
          renderer.renderGameplayFrame(commitFrame);
          const model = renderer.lastModel;
          if (!model) throw new Error(`${punch.label}: renderer.lastModel is null after rendering the commit frame`);
          const iconObj = model.objects.find((o) => o.kind === "icon" && o.targetId === punch.eventId);
          if (!iconObj) {
            const iconIds = model.objects.filter((o) => o.kind === "icon").map((o) => `${o.id}`);
            throw new Error(`GATE-ASSERT ${punch.label}: no kind=icon scene object for targetId="${punch.eventId}" at the commit frame (icons: ${iconIds.join(", ")})`);
          }
          const noteWorld = iconObj.position;
          const noteScreen = project(noteWorld.x, noteWorld.y, noteWorld.z);
          results.push({ label: punch.label, eventId: punch.eventId, commitMs: punch.commitMs, targetCell: punch.targetCell, noteWorld: { ...noteWorld }, noteScreen: { x: noteScreen.x, y: noteScreen.y }, rows });
        }
        return {
          punches: results,
          canvasSize: { width: canvas.width, height: canvas.height },
          spawns: [
            { label: "cell4", spawn: { ...entryA.spawn } },
            { label: "cell6", spawn: { ...entryB.spawn } },
            { label: "cell0", spawn: { ...entryC.spawn } },
          ],
        };
      }, { top: REACH_TOP, bottom: REACH_BOTTOM });
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      // ---- Diagnostic printout: note vs. corpse screen positions per frame ----
      for (const punch of proof.punches) {
        console.log(`[W2b ${embedding}] ${punch.label} (${punch.eventId}) commit=${punch.commitMs}ms cell=${punch.targetCell} noteWorld=${JSON.stringify(punch.noteWorld)} noteScreen=(${punch.noteScreen.x.toFixed(1)},${punch.noteScreen.y.toFixed(1)})`);
        for (const row of punch.rows) {
          const dx = row.meanX === null ? "n/a" : (row.meanX - punch.noteScreen.x).toFixed(1);
          const dy = row.meanY === null ? "n/a" : (row.meanY - punch.noteScreen.y).toFixed(1);
          console.log(`[W2b ${embedding}] ${punch.label} +${row.offsetMs}ms: corpseCentroid=${row.meanX === null ? "absent" : `(${row.meanX.toFixed(1)},${row.meanY.toFixed(1)})`} px=${row.count} ΔfromNote=(dx ${dx}px, dy ${dy}px)`);
        }
      }
      // ---- (c): in the tight window the corpse centroid is the note's pixel ----
      for (const punch of proof.punches) {
        const tight = punch.rows.filter((row) => TIGHT_MATCH_OFFSETS_MS.has(row.offsetMs));
        assert.equal(tight.length, 4, `${embedding} ${punch.label}: the corpse must be visible across the tight 4..16 ms window`);
        for (const row of tight) {
          assert.ok(row.count >= MIN_CORPSE_PIXELS, `${embedding} ${punch.label} +${row.offsetMs}ms: the corpse must render visibly (${row.count}px)`);
          const dxPx = Math.abs(row.meanX - punch.noteScreen.x);
          const dyPx = Math.abs(row.meanY - punch.noteScreen.y);
          assert.ok(dxPx <= SPAWN_MATCH_TOLERANCE_PX, `${embedding} ${punch.label} +${row.offsetMs}ms: corpse screen-x must equal the note icon's (Δ=${dxPx.toFixed(1)}px > ${SPAWN_MATCH_TOLERANCE_PX}px) — the spawn is NOT the note's rendered position (pre-fix: judge-plane X, Δ≈131px)`);
          assert.ok(dyPx <= SPAWN_MATCH_TOLERANCE_Y_PX, `${embedding} ${punch.label} +${row.offsetMs}ms: corpse screen-y must equal the note icon's (Δ=${dyPx.toFixed(1)}px > ${SPAWN_MATCH_TOLERANCE_Y_PX}px) — the spawn is not the note's reach-row position`);
        }
      }
      // ---- (e): the knock moves the corpse smoothly (no teleport) ----
      for (const punch of proof.punches) {
        const present = punch.rows.filter((row) => row.meanX !== null);
        assert.ok(present.length >= 5, `${embedding} ${punch.label}: the corpse must be present across the sample window (${present.length} frames)`);
        for (let i = 1; i < present.length; i += 1) {
          const stepPx = Math.hypot(present[i].meanX - present[i - 1].meanX, present[i].meanY - (present[i - 1].meanY ?? present[i].meanY));
          assert.ok(stepPx < KNOCK_STEP_BOUND_PX, `${embedding} ${punch.label} +${present[i].offsetMs}ms: frame-to-frame corpse move must be smooth (Δ=${stepPx.toFixed(1)}px ≥ ${KNOCK_STEP_BOUND_PX}px) — a discontinuous single-frame jump`);
        }
      }
      matrix.push({
        embedding,
        punches: proof.punches.map((p) => ({
          label: p.label,
          commitMs: p.commitMs,
          note: { x: +p.noteScreen.x.toFixed(1), y: +p.noteScreen.y.toFixed(1) },
          centroids: p.rows.map((r) => ({ ms: r.offsetMs, px: r.count, cx: r.meanX === null ? null : +r.meanX.toFixed(1), cy: r.meanY === null ? null : +r.meanY.toFixed(1) })),
        })),
        spawns: proof.spawns,
      });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  const [direct, iframe] = matrix;
  // Cross-embedding agreement on the spawn-match evidence.
  direct.punches.forEach((punch, pi) => {
    const other = iframe.punches[pi];
    punch.centroids.forEach((row, ri) => {
      const o = other.centroids[ri];
      if (row.cx !== null && o.cx !== null) {
        assert.ok(Math.abs(row.cx - o.cx) <= 3, `${direct.embedding}/${other.embedding} ${punch.label} +${row.ms}ms: centroid x must agree (${row.cx} vs ${o.cx})`);
        assert.ok(Math.abs(row.cy - o.cy) <= 3, `${direct.embedding}/${other.embedding} ${punch.label} +${row.ms}ms: centroid y must agree (${row.cy} vs ${o.cy})`);
      }
    });
  });
  const summary = matrix.map((m) => ({
    embedding: m.embedding,
    punches: m.punches.map((p) => ({ label: p.label, commit: p.commitMs, note: p.note, centroids: p.centroids })),
    spawns: m.spawns,
  }));
  console.log(`ORACLE 0.0.60-boxing-spawn-pixels PASS: embeddings=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
