// @ts-check

// 0.0.59 B15 real-pixel oracle — a REAL boxing punch hit must spawn its
// aftermath "hit corpse" at the SAME screen position as the live note it
// replaces: no single-frame horizontal jump from note to corpse (the
// knock/launch then plays from that position). Proven by reading REAL
// rendered canvas pixels (OffscreenCanvas drawImage + getImageData of the
// PlayCanvas canvas), NOT the scene-graph `frame.model.objects`.
//
// What this oracle proves (driving a REAL boxing_collider_v1 `straight_left`
// punch through the public input path — measured wrist evidence swept into
// the authored target cell, a real committed HIT judgement):
//   (B15a) In the corpse-alone window (+88/+103 ms past commit; the note's own
//          removal fade completes at +80 ms so nothing else is on screen) the
//          corpse's pixel centroid matches the note's projected goal position
//          within a small tolerance — the spawn IS the note's rendered
//          position (x AND the reach-row y the note uses). Before the fix the
//          top-row corpse spawned one re-derived grid row off (~30 px vertical
//          jump in a single frame) and even the center-row X identity is only
//          guaranteed by construction; both punches are asserted.
//   (B15b) The knock moves the corpse smoothly: frame-to-frame centroid deltas
//          stay bounded (no discontinuous teleport between consecutive frames)
//          and the centroid keeps moving AWAY from the note position with the
//          launch curve (the knock still reads, it just starts AT the note).
//   (B15c) DIAGNOSTIC on record: the per-frame note-vs-corpse screen positions
//          are printed (note = the renderer's exact hit-plane world position
//          projected through the production camera; corpse = the measured
//          pixel centroid) so the diagnosis lives in the test output.
//
// Session details (mirror validate-0.0.58-boxing-vignette-pixels for how a
// real boxing session is driven + committed):
//   - straight_left, spatialTarget.targetCell = 4 → column x −0.5, row 1.
//     With DEFAULT reach {topRowReachWU: 0.25, bottomRowReachWU: 0.25} (as the
//     assembly emits from Game Setup defaults) the note renders at world Y
//     boxingColliderRowY(1, reach) = 1, while the old assembly spawn
//     re-derived gridCellToWorldZ0(4) = {x: −0.5, y: 1, z: 0}… which happens to
//     match for the CENTER row — so the probe ALSO covers the top row
//     (targetCell 0, row 0 → note y 1.25 vs old spawn y 2) where the old code
//     jumps ~0.25 WU vertically (~30 px) in one frame. Both punches are real
//     hits; the assertions run on both.
//   - countdownStepMs: 1 so the session reaches "playing".
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface).
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

// Default Game Setup reach fractions (aeroRowReachBounds defaults, emitted by
// the assembly rendererFrame() for the boxing_collider presentation).
const TOP_REACH = 0.25;
const BOTTOM_REACH = 0.25;
// Canvas center (renderer.resize 844×390 dpr 1).
const VIEW_W = 844;
const VIEW_H = 390;
// Centroid tolerance (px) for "corpse spawns at the note" — far below any
// inter-column offset (columns project ~107 px apart) yet above antialiasing.
const SPAWN_MATCH_TOLERANCE_PX = 14;
// Knock smoothness bound: max allowed frame-to-frame centroid delta over the
// first 60 ms after commit (at 15 ms steps ≈ ~34–44 px of continuous travel).
// A single-frame teleport of ≥~30 px would violate this.
const KNOCK_STEP_BOUND_PX = 55;
// Post-commit sample offsets (ms). Offsets 1..77 also see the note's fading
// removal sprite co-rendered (removal ends at +80 ms); 88+ see the corpse
// alone. The tight spawn-match assertion runs on the corpse-alone window so
// it cannot be diluted by the outgoing note sprite; the smoothness window
// spans the handoff because that is exactly where the playtest saw the jump.
const SAMPLE_OFFSETS_MS = [8, 23, 38, 53, 68, 88, 103];
const CORPSE_ALONE_OFFSETS_MS = new Set([88, 103]);

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
        const TOP_REACH = reach.top;
        const BOTTOM_REACH = reach.bottom;
        // Mirror of the node-side SAMPLE_OFFSETS_MS constant (page functions
        // cannot reference script scope).
        const SAMPLE_OFFSETS_MS = [8, 23, 38, 53, 68, 88, 103];
        if (!Array.isArray(SAMPLE_OFFSETS_MS) || SAMPLE_OFFSETS_MS.length !== 7) throw new Error("sample offsets literal drifted");
        const VIEW_W = 844;
        const VIEW_H = 390;
        const game = document.querySelector("aero-game");
        const renderer = game.graph.renderer;
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
        renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
        const [{ createAeroGameplaySessionCoordinator }] = await Promise.all([import("/node_modules/@aerobeat/web-gameplay/src/index.js")]);
        // Real boxing_collider_v1 chart: ONE straight_left punch. Center row
        // (cell 4 → x −0.5, row 1) AND top row (cell 0 → x −0.5, row 0) so the
        // row-reach Y mismatch of the old spawnForEvent is exercised directly.
        const HASH = "a".repeat(64);
        const variant = { variantId: "b15-pixel", chartId: "chart-b15-pixel", mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const punch = (eventId, centerTimestampMs, targetCell) => Object.freeze({ schema: "aerobeat/resolved_content_event", version: 3, eventId, variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs, sourceEventIds: [`s-${eventId}`], type: "straight_left", spatialTarget: { targetCell, acceptedSubcells: [], sourceCell: -1 } });
        const events = [punch("straight-center", 6000, 4), punch("straight-top", 16000, 0)];
        // Measured-anchor helper: athlete grid cell/subcell (row 1 = middle
        // row, column 1 = left-center — the straight-left target cells).
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, sx, sy) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, 2, 1.5), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, sx, sy), anchor("right_wrist", m, 3, 1)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        // countdownStepMs: 1 so the session reaches "playing" quickly. The
        // DEFAULT boxing collider settings (reach 0.25/0.25 — matching the
        // Game Setup defaults the assembly emits) are passed explicitly so the
        // judge-plane Y and the renderer's presentation row-reach are pinned
        // to one truth for the whole probe.
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "b15-pixel-browser", countdownStepMs: 1 });
        coordinator.configureContent({ packageId: "b15-pkg", selectedVariant: variant, resolvedEvents: events, profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false }, boxingColliderSettings: { schema: "aerobeat/flow_collider_settings", version: 1, algorithm: "swept_athlete_plane_v1", colliderRadius: 0.12, enforceAuthoredDirection: true, directionToleranceDegrees: 45, timingWindowMs: 180, topRowReachWU: TOP_REACH, bottomRowReachWU: BOTTOM_REACH, guardCountMode: "collision" } });
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        // Explicit PLAY purpose start (real judgements feed the aftermath).
        coordinator.requestStart(0, { schema: "aerobeat/gameplay_session_start", version: 1, purpose: "play" });
        const step = (songMs, sx, sy, id) => coordinator.advance({ timestampMs: songMs, clock: clockSnap(songMs, true), input: inputSnap(songMs, evidence(id, songMs, sx, sy)) });
        // Step through the wall-clock countdown (clock frozen at 0 until the
        // state flips to "playing").
        for (let t = 1; t <= 40; t += 1) {
          coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
          if (coordinator.getSnapshot().session.state === "playing") break;
        }
        const preState = coordinator.getSnapshot().session.state;
        if (preState !== "playing") throw new Error(`session must be "playing" before driving the punches, got "${preState}" (countdownStepMs: 1 required)`);
        // Drive the FIRST punch (center row, commit ~6000): hold the LEFT WRIST
        // inside the judge slab — athlete coords (sx≈0, sy≈1): target cell 4
        // judges at (placement%4, row-reach y) = (0, 1) in athlete space with
        // half-extent 0.375 + colliderRadius (0.12) = 0.495, so the slab is sx
        // ∈ [-0.495, 0.495], sy ∈ [0.505, 1.495] (row 1); cell 0 judges at
        // (0, 1.25) with sy ∈ [0.755, 1.745]. (sx, sy) = (0, 1) sits inside
        // BOTH slabs, so one static hold drives both punches' real point
        // contacts. Straights are overlap-only (no qualification needed).
        const sendAt = (songMs, id) => step(songMs, 0, 1, id);
        sendAt(5800, "f0");
        sendAt(5850, "f1");
        sendAt(5900, "f2");
        sendAt(5950, "f3");
        sendAt(6000, "f4");
        sendAt(6050, "f5");
        sendAt(6100, "f6");
        sendAt(6200, "f7");
        const snapshotA = coordinator.getSnapshot();
        const hitA = snapshotA.judgements.find((j) => j.eventId === "straight-center");
        if (!hitA || hitA.result !== "hit") throw new Error(`expected a real committed HIT for straight-center, got ${JSON.stringify(hitA ?? null)} judgements=${JSON.stringify(snapshotA.judgements.map((j) => [j.eventId, j.result]))}`);
        const commitA = Number(hitA.committedTimelinePositionMs);
        // Drive the SECOND punch (top row, commit ~16000): the SAME hold keeps
        // the wrist inside its larger top-row slab through the timing window.
        const sendAtTop = (songMs, id) => step(songMs, 0, 1, id);
        sendAtTop(15800, "g0");
        sendAtTop(15850, "g1");
        sendAtTop(15900, "g2");
        sendAtTop(15950, "g3");
        sendAtTop(16000, "g4");
        sendAtTop(16050, "g5");
        sendAtTop(16100, "g6");
        sendAtTop(16200, "g7");
        const snapshotB = coordinator.getSnapshot();
        const hitB = snapshotB.judgements.find((j) => j.eventId === "straight-top");
        if (!hitB || hitB.result !== "hit") throw new Error(`expected a real committed HIT for straight-top, got ${JSON.stringify(hitB ?? null)}`);
        const commitB = Number(hitB.committedTimelinePositionMs);
        // The wrist hold enters the slab before the timing window, so point
        // contact commits early (the first in-slab sample at 5850/15850); the
        // commit must be a real contact time INSIDE each punch's ±180 ms
        // timing window.
        if (Math.abs(commitA - 6000) > 180 || Math.abs(commitB - 16000) > 180) throw new Error(`commits off expected centers: A=${commitA}, B=${commitB}`);
        // Derive the AFTERMATH EXACTLY like the assembly rendererFrame() does
        // (projectAftermathEntries over the real resolved events + real play
        // judgements + render event index). The live targets for the frame are
        // the projection at the sample nowMs — identical to the assembly's.
        const [{ projectAftermathEntries }, { projectSessionTargets, createSessionTargetIndex }] = await Promise.all([import("/src/gameplay-frame-effects.js"), import("/src/session-render-projection.js")]);
        const index = createSessionTargetIndex(events, {});
        const frameAt = (nowMs) => {
          const snap = coordinator.getSnapshot();
          const targets = projectSessionTargets(events, snap, nowMs, index);
          // 0.0.59 B15: pass the SAME row-reach fractions the assembly
          // rendererFrame() passes (the frame below carries them in rowReach),
          // so this derivation mirrors the production spawn exactly.
          const aftermath = projectAftermathEntries(events, snap, nowMs, targets, index, Object.freeze({ topRowReachWU: TOP_REACH, bottomRowReachWU: BOTTOM_REACH }));
          return {
            presentation: "boxing_collider",
            nowMs,
            targets,
            timingWindowBeforeMs: 180,
            timingWindowAfterMs: 180,
            aftermath,
            rowReach: Object.freeze({ topRowReachWU: TOP_REACH, bottomRowReachWU: BOTTOM_REACH })
          };
        };
        const canvas = game.shadowRoot.querySelector("canvas");
        const readPixels = () => {
          const sample = new OffscreenCanvas(canvas.width, canvas.height);
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, sample.width, sample.height).data;
        };
        // World → screen through the LIVE production camera pose (the same
        // camera the facade applies to the last rendered frame). Screen Y is
        // flipped to pixel space.
        const project = (x, y, z) => {
          const out = renderer.cameraEntity.camera.worldToScreen({ x, y, z });
          return { x: out.x, y: VIEW_H - out.y };
        };
        // Baseline render helper: the SAME idle frame (a moment before either
        // punch commits) is rendered and captured around every punch window so
        // each diff isolates exactly that punch's aftermath (+ its brief note
        // removal fade).
        const baselineNowMs = 5500;
        const renderBaseline = () => {
          renderer.renderGameplayFrame(frameAt(baselineNowMs));
          return readPixels();
        };
        const renderSample = (nowMs) => {
          renderer.renderGameplayFrame(frameAt(nowMs));
          return readPixels();
        };
        // Per-punch pixel stats.
        const punches = [
          { label: "center", eventId: "straight-center", commitMs: commitA, targetCell: 4 },
          { label: "top", eventId: "straight-top", commitMs: commitB, targetCell: 0 }
        ];
        const results = [];
        globalThis.__debugSpawn = [];
        // Driving the session (advance/requestStart) restarts the app frame
        // loop, which would re-render the SESSION's own frames over our canvas.
        // Stop it again so the oracle's renderGameplayFrame controls the pixels,
        // then clear the scene so each diff isolates exactly the frame rendered.
        game.stopFrameLoop();
        renderer.clear();
        for (const punch of punches) {
          renderer.clear();
          const base = renderBaseline();
          const rows = [];
          // DEBUG: dump the actual aftermath entries this frame derives
          if (punch === punches[0]) {
            const dbgFrame = frameAt(punch.commitMs + 88);
            console.log("[DEBUG-ORACLE] aftermath spawns at commit+88:", JSON.stringify(dbgFrame.aftermath.map((e) => [e.targetId, e.spawn])));
            console.log("[DEBUG-ORACLE] targets count:", dbgFrame.targets.length, "targetIds:", JSON.stringify(dbgFrame.targets.map((t) => t.id)));
          }
          for (const offsetMs of SAMPLE_OFFSETS_MS) {
            const pixels = renderSample(punch.commitMs + offsetMs);
            let count = 0, sumX = 0, sumY = 0;
            const w = canvas.width;
            for (let i = 0; i < pixels.length; i += 4) {
              if (Math.abs(pixels[i] - base[i]) + Math.abs(pixels[i + 1] - base[i + 1]) + Math.abs(pixels[i + 2] - base[i + 2]) <= 30) continue;
              count += 1;
              sumX += (i / 4) % w;
              sumY += Math.floor(i / 4 / w);
            }
            rows.push({ offsetMs, count, meanX: count ? sumX / count : null, meanY: count ? sumY / count : null });
          }
          // The note's ACTUAL rendered world position at commit (the renderer's
          // boxing_collider path maps a punch target cell through
          // targetCenterForPlacement — the shared gameplay judge-plane truth:
          // x = placement % 4 ∈ [0,1,2,3], NOT the flow grid columnX — and
          // reach-row Y at z=0). Row 1 (center) → y 1; row 0 (top) → y
          // 1 + topRowReachWU; row 2 (bottom) → y 1 − bottomRowReachWU.
          const gridRow = Math.floor(punch.targetCell / 4);
          const noteWorld = { x: punch.targetCell % 4, y: gridRow === 0 ? 1 + TOP_REACH : gridRow === 1 ? 1 : 1 - BOTTOM_REACH, z: 0 };
          const noteScreen = project(noteWorld.x, noteWorld.y, noteWorld.z);
          // DEBUG: dump the aftermath entries the derivation produced.
          if (globalThis.__debugSpawn) globalThis.__debugSpawn.push({ label: punch.label, nowMs: punch.commitMs + 88, spawns: frameAt(punch.commitMs + 88).aftermath.map((e) => [e.targetId, e.spawn]) });
          results.push({ label: punch.label, eventId: punch.eventId, commitMs: punch.commitMs, targetCell: punch.targetCell, noteWorld, noteScreen: { x: noteScreen.x, y: noteScreen.y }, rows });
        }
        return { punches: results, canvasSize: { width: canvas.width, height: canvas.height }, debugSpawns: globalThis.__debugSpawn ?? null };
      }, { top: TOP_REACH, bottom: BOTTOM_REACH });
      console.log("[B15-DEBUG] derived aftermath spawns:", JSON.stringify(proof.debugSpawns));
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      // ---- Diagnostic printout: note vs. corpse screen positions per frame ----
      for (const punch of proof.punches) {
        console.log(`[B15 ${embedding}] ${punch.label} (${punch.eventId}) commit=${punch.commitMs}ms cell=${punch.targetCell} noteWorld=${JSON.stringify(punch.noteWorld)} noteScreen=(${punch.noteScreen.x.toFixed(1)},${punch.noteScreen.y.toFixed(1)})`);
        for (const row of punch.rows) {
          const dx = row.meanX === null ? "n/a" : (row.meanX - punch.noteScreen.x).toFixed(1);
          const dy = row.meanY === null ? "n/a" : (row.meanY - punch.noteScreen.y).toFixed(1);
          console.log(`[B15 ${embedding}] ${punch.label} +${row.offsetMs}ms: corpseCentroid=${row.meanX === null ? "absent" : `(${row.meanX.toFixed(1)},${row.meanY.toFixed(1)})`} px=${row.count} ΔfromNote=(dx ${dx}px, dy ${dy}px)`);
        }
      }
      // ---- B15a: the corpse spawns at the note's rendered position ----
      for (const punch of proof.punches) {
        const alone = punch.rows.filter((row) => CORPSE_ALONE_OFFSETS_MS.has(row.offsetMs));
        assert.equal(alone.length, 2, `${embedding} ${punch.label}: the corpse must be visible in the corpse-alone window`);
        for (const row of alone) {
          assert.ok(row.count > 150, `${embedding} ${punch.label} +${row.offsetMs}ms: the corpse must render visibly (${row.count}px)`);
          const dxPx = Math.abs(row.meanX - punch.noteScreen.x);
          const dyPx = Math.abs(row.meanY - punch.noteScreen.y);
          assert.ok(dxPx < SPAWN_MATCH_TOLERANCE_PX, `${embedding} ${punch.label} +${row.offsetMs}ms: corpse screen-x must equal the note's (Δ=${dxPx.toFixed(1)}px ≥ ${SPAWN_MATCH_TOLERANCE_PX}px) — the single-frame horizontal jump (B15)`);
          assert.ok(dyPx < SPAWN_MATCH_TOLERANCE_PX * 2, `${embedding} ${punch.label} +${row.offsetMs}ms: corpse screen-y must equal the note's (Δ=${dyPx.toFixed(1)}px) — the spawn is the note's reach-row position, not a re-derived grid row`);
        }
      }
      // ---- B15b: the knock moves the corpse smoothly away from the note ----
      for (const punch of proof.punches) {
        const present = punch.rows.filter((row) => row.meanX !== null);
        assert.ok(present.length >= 5, `${embedding} ${punch.label}: the corpse must be present across the sample window (${present.length} frames)`);
        for (let i = 1; i < present.length; i += 1) {
          const stepPx = Math.hypot(present[i].meanX - present[i - 1].meanX, present[i].meanY - (present[i - 1].meanY ?? present[i].meanY));
          assert.ok(stepPx < KNOCK_STEP_BOUND_PX, `${embedding} ${punch.label} +${present[i].offsetMs}ms: frame-to-frame corpse move must be smooth (Δ=${stepPx.toFixed(1)}px ≥ ${KNOCK_STEP_BOUND_PX}px) — a discontinuous single-frame jump`);
        }
        // The knock must actually move: the farthest sampled centroid is well
        // past the note (it launched away), proving the knock survived.
        const farthest = present.reduce((best, row) => {
          const d = Math.hypot(row.meanX - punch.noteScreen.x, row.meanY - punch.noteScreen.y);
          return d > best.d ? { d, row } : best;
        }, { d: -1, row: present[0] });
        assert.ok(farthest.d > 25, `${embedding} ${punch.label}: the knock must visibly launch the corpse away from the note (farthest Δ=${farthest.d.toFixed(1)}px ≤ 25px)`);
      }
      matrix.push({ embedding, punches: proof.punches.map((p) => ({ label: p.label, commitMs: p.commitMs, note: { x: +p.noteScreen.x.toFixed(1), y: +p.noteScreen.y.toFixed(1) }, centroids: p.rows.map((r) => ({ ms: r.offsetMs, px: r.count, cx: r.meanX === null ? null : +r.meanX.toFixed(1), cy: r.meanY === null ? null : +r.meanY.toFixed(1) })) })) });
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
  const summary = matrix.map((m) => {
    const punchSummary = m.punches.map((p) => ({ label: p.label, commit: p.commitMs, note: p.note, centroids: p.centroids }));
    return { embedding: m.embedding, punches: punchSummary };
  });
  console.log(`ORACLE 0.0.59-boxing-spawn-pixels PASS: embeddings=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
