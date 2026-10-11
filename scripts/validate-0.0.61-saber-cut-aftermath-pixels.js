// @ts-check

// 0.0.61 L-C2 (htc8) real-pixel oracle — Flow SABER-CUT aftermath. A real,
// measured wrist sweep that drives the saber capsule (0.75 WU beam from the
// wrist along the wrist-history direction) into a directional note's 1×1 judge
// cell inside the ±180 ms window commits a REAL judged hit. The hit spawns the
// slice AFTERMATH at the note's spawn: two half-note glyph entities
// (`:aftermath:half-` / `half+`) that (a) begin their fall from the note's
// position, and (b) keep the note's HAND palette color DESATURATED (left blue
// #2693FF → blue-shift fill, right green #39C96B → green-shift fill).
//
// Proven by reading REAL rendered canvas pixels (OffscreenCanvas drawImage +
// getImageData of the PlayCanvas canvas) against a baseline-subtracted diff
// (same frame minus this note's aftermath entry — |Δr|+|Δg|+|Δb| ≥ 24), NOT the
// scene-graph model. The original fall/color sequence uses two notes, one per
// hand, spaced 6 s apart so their approach windows never overlap:
//   n-left  LEFT  placement 5 (col 1, mid row)  dir "up"     center 6000
//   n-right RIGHT placement 6 (col 2, mid row)  dir "right"  center 12000
// The first-contact seam oracle also scores two FRESH runs of that SAME n-left
// authored arrow with independently measured sweeps, then compares sign-specific
// GLB framebuffer pixels at the same corpse age.
//
// What this oracle proves:
//   (a) GATE-ASSERT: each note projects as kind "flow" with the authored
//       cell/hand/direction AND commits a real hit inside the ±180 ms window.
//   (b) TWO HALF-ENTITIES at the note position: lastModel carries exactly the
//       two slice halves for the target, at the authored spawn, distinct in X.
//   (c) PER-HAND DESATURATED FILL: the diff-pixel fill is mid-luma + low-
//       saturation (desaturated, not the saturated live glyph), and the hand's
//       palette tint survives desaturation — left reads BLUE-SHIFT (b−r, b−g
//       positive) and right reads GREEN-SHIFT (g−r, g−b positive); the left is
//       measurably more blue and the right more green than the other (reusing
//       the 0.0.59-flow-corpse-color fill-stats technique, extended to the
//       green hand).
//   (d) MONOTONE FALL: across nowMs = commit + 0/100/300/600 ms the halves'
//       diff-pixel centroid Y is monotonically non-decreasing and each step is
//       bounded (a continuous fall, no teleport/snap).
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface).
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const VIEW_W = 844;
const VIEW_H = 390;
const FALL_OFFSETS_MS = [0, 100, 300, 600];
const FILL_SAMPLE_OFFSET_MS = 40; // full alpha, both halves up, tumble negligible
const FALL_STEP_BOUND_PX = 100; // no single-frame centroid jump this large
const MIN_HALF_PIXELS = 500;

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
        const MIN_HALF_PIXELS = 500;
        const FALL_OFFSETS_MS = [0, 100, 300, 600];
        const FILL_SAMPLE_OFFSET_MS = 40;
        const FALL_STEP_BOUND_PX = 100;
        const NOTES = [
          { eventId: "n-left", hand: "left", placement: 5, direction: "up", center: 6000 },
          { eventId: "n-right", hand: "right", placement: 6, direction: "right", center: 12000 },
        ];
        const game = document.querySelector("aero-game");
        const canvas = game.shadowRoot.querySelector("canvas");
        const renderer = game.graph.renderer;
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
        renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
        const [{ createAeroGameplaySessionCoordinator }, { projectAftermathEntries }, { projectSessionTargets, createSessionTargetIndex }] = await Promise.all([
          import("/node_modules/@aerobeat/web-gameplay/src/index.js"),
          import("/src/gameplay-frame-effects.js"),
          import("/src/session-render-projection.js"),
        ]);
        const HASH = "d3".repeat(32);
        const variant = { variantId: "lcb2-saber", chartId: "chart-lcb2-saber", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const events = NOTES.map((n) => Object.freeze({
          schema: "aerobeat/resolved_content_event", version: 3,
          eventId: n.eventId, variantId: variant.variantId, chartId: variant.chartId,
          centerTimestampMs: n.center, sourceEventIds: [`s-${n.eventId}`],
          authoredBeat: Object.freeze({ type: "note", hand: n.hand, placement: n.placement, direction: n.direction }),
        }));
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, lw, rw) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, 2, 1.5), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, lw.x, lw.y), anchor("right_wrist", m, rw.x, rw.y)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        const { standaloneTestEquipmentPoses } = await import("/src/test-equipment-authoring.js"); await game.ensureEquipmentConfigIdentity();
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "lcb2-saber-browser", countdownStepMs: 1 });
        coordinator.configureContent({ packageId: "lcb2-saber-pkg", selectedVariant: variant, resolvedEvents: events, profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false } });
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        coordinator.requestStart(0);
        const step = (songMs,lw,rw,id) => { const input=inputSnap(songMs,evidence(id,songMs,lw,rw)); return coordinator.advance({timestampMs:songMs,clock:clockSnap(songMs,true),input,equipmentPoses:standaloneTestEquipmentPoses("flow",input,game.equipmentConfigIdentity)}); };
        for (let t = 1; t <= 40; t += 1) {
          coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
          if (coordinator.getSnapshot().session.state === "playing") break;
        }
        if (coordinator.getSnapshot().session.state !== "playing") throw new Error("session not playing after countdown");
        // Each own wrist sweeps through the note's judge cell IN the authored
        // direction (40 ms steps, displacement ≥ 0.05 exactly along the direction);
        // the other wrist idles clear. Directional notes commit at center − 80 ms.
        const IDLE = { x: 3.5, y: 2.2 };
        const DRIVES = {
          "n-left": [[-120, { x: 1, y: 0.4 }], [-80, { x: 1, y: 0.75 }], [-40, { x: 1, y: 1.05 }], [0, { x: 1, y: 1.05 }], [80, { x: 1, y: 1.05 }]],
          "n-right": [[-120, { x: 1.4, y: 1.0 }], [-80, { x: 1.75, y: 1.0 }], [-40, { x: 2.05, y: 1.0 }], [0, { x: 2.05, y: 1.0 }], [80, { x: 2.05, y: 1.0 }]],
        };
        for (const n of NOTES) {
          for (const [d, pos] of DRIVES[n.eventId]) {
            const lw = n.hand === "left" ? pos : IDLE;
            const rw = n.hand === "right" ? pos : IDLE;
            step(n.center + d, lw, rw, `${n.eventId}${d}`);
          }
        }
        const snap = coordinator.getSnapshot();
        const index = createSessionTargetIndex(events, {});
        const commits = new Map();
        for (const n of NOTES) {
          const t = projectSessionTargets(events, snap, n.center - 600, index).find((e) => e.id === n.eventId);
          if (!t || t.kind !== "flow" || t.cell !== n.placement || t.hand !== n.hand || t.direction !== n.direction) throw new Error(`${n.eventId} must project as kind "flow" cell ${n.placement} hand ${n.hand} direction ${n.direction}, got ${JSON.stringify(t ?? null)}`);
          const hit = snap.judgements.find((j) => j.eventId === n.eventId);
          if (!hit || hit.result !== "hit") throw new Error(`expected a real committed HIT for ${n.eventId}, got ${JSON.stringify(hit ?? null)}`);
          const commit = Number(hit.committedTimelinePositionMs);
          if (Math.abs(commit - n.center) > 180) throw new Error(`${n.eventId} commit ${commit} outside the ±180 ms window of center ${n.center}`);
          commits.set(n.eventId, commit);
        }
        // ── Pixel-level oracle ──
        const readPixels = () => {
          const sample = new OffscreenCanvas(canvas.width, canvas.height);
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, sample.width, sample.height).data;
        };
        const project = (x, y, z) => { const out = renderer.cameraEntity.camera.worldToScreen({ x, y, z }); return { x: out.x, y: out.y }; };
        const gridCell = (cell) => { const column = cell % 4; const row = Math.floor(cell / 4); const xs = [-1.5, -0.5, 0.5, 1.5]; const ys = [2, 1, 0]; return { x: xs[column], y: ys[row], z: 0 }; };
        const acceptedFlowSliceT = coordinator[Symbol.for("aerobeat.web-gameplay.internal-flow-slice")];
        if (typeof acceptedFlowSliceT !== "function") throw new Error("private accepted Flow contact lookup unavailable");
        const acceptedCuts = NOTES.map((n) => [n.eventId, acceptedFlowSliceT(n.eventId)]);
        for (const [id, cut] of acceptedCuts) {
          if (typeof cut !== "number" || !Number.isFinite(cut) || cut < 0.15 || cut > 0.85) throw new Error(`${id}: missing bounded first-contact scalar ${String(cut)}`);
        }
        const frameAt = (nowMs) => {
          const s = coordinator.getSnapshot();
          const targets = projectSessionTargets(events, s, nowMs, index);
          const aftermath = projectAftermathEntries(events, s, nowMs, targets, index, null, (id) => acceptedFlowSliceT(id));
          for (const [id, cut] of acceptedCuts) {
            if (aftermath.find((entry) => entry.targetId === id)?.sliceT !== cut) throw new Error(`${id}: aftermath must preserve accepted cut across later frames`);
          }
          return { presentation: "flow", nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath };
        };
        // Baseline: the same frame with THIS note's aftermath entry removed.
        const renderWithOut = (nowMs, excludeTargetId) => {
          const f = frameAt(nowMs);
          const aftermath = excludeTargetId ? f.aftermath.filter((e) => e.targetId !== excludeTargetId) : f.aftermath;
          renderer.renderGameplayFrame({ ...f, aftermath });
          return readPixels();
        };
        // Diff pixels (full vs baseline), isolated to one aftermath target.
        const diffFor = (nowMs, targetId) => {
          const full = renderWithOut(nowMs, null);
          const base = renderWithOut(nowMs, targetId);
          const W = canvas.width, H = canvas.height, out = [];
          for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
            const i = (y * W + x) * 4;
            if (Math.abs(full[i] - base[i]) + Math.abs(full[i + 1] - base[i + 1]) + Math.abs(full[i + 2] - base[i + 2]) >= 24) out.push({ x, y, r: full[i], g: full[i + 1], b: full[i + 2] });
          }
          return out;
        };
        const fillStats = (diff) => {
          let n = 0, sr = 0, sg = 0, sb = 0, maxLuma = 0, satSum = 0;
          for (const p of diff) {
            const luma = 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
            if (luma < 55 || luma > 175) continue;
            n += 1; sr += p.r; sg += p.g; sb += p.b; if (luma > maxLuma) maxLuma = luma;
            satSum += (Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b));
          }
          if (!n) return null;
          const r = sr / n, g = sg / n, b = sb / n;
          return { n, r: +r.toFixed(1), g: +g.toFixed(1), b: +b.toFixed(1), bMinusR: +(b - r).toFixed(1), gMinusR: +(g - r).toFixed(1), bMinusG: +(b - g).toFixed(1), gMinusB: +(g - b).toFixed(1), maxLuma: +maxLuma.toFixed(1), meanSat: +(satSum / n).toFixed(1) };
        };
        // Model halves at commit + FILL offset.
        const modelHalves = (nowMs, targetId) => {
          const f = frameAt(nowMs);
          renderer.renderGameplayFrame(f);
          return renderer.lastModel.objects.filter((o) => o.kind === "aftermath" && String(o.id).startsWith(`${targetId}:aftermath:`));
        };
        const notes = [];
        for (const n of NOTES) {
          const commit = commits.get(n.eventId);
          const fillNow = commit + FILL_SAMPLE_OFFSET_MS;
          // (b) two distinct half-entities at the note position.
          const halves = modelHalves(fillNow, n.eventId);
          if (halves.length !== 2) throw new Error(`${n.eventId}: expected exactly two slice half-entities, got ${halves.length}: ${JSON.stringify(halves.map((o) => o.id))}`);
          const signOk = halves.some((o) => o.id.endsWith("half-")) && halves.some((o) => o.id.endsWith("half+"));
          if (!signOk) throw new Error(`${n.eventId}: halves must be half- / half+, got ${JSON.stringify(halves.map((o) => o.id))}`);
          const spawn = gridCell(n.placement);
          const minus = halves.find((o) => o.id.endsWith("half-"));
          const plus = halves.find((o) => o.id.endsWith("half+"));
          // A signed accepted cut separates the two centers by .76 WU total,
          // not by <=.12 WU each. Both halves share one seed jitter bounded by
          // spread*.25/2 = .095 WU and a 40ms launch displacement; the pair
          // midpoint, rather than either deliberately separated piece, must
          // stay anchored to the authored cell. The ±.12 midpoint bound
          // permits that documented jitter and bounded early launch only.
          const gap = plus.position.x - minus.position.x;
          const midpointX = (minus.position.x + plus.position.x) / 2;
          if (Math.abs(gap - 0.76) > 1e-6) throw new Error(`${n.eventId}: signed accepted halves must be .76 WU apart, got ${gap}`);
          if (Math.abs(midpointX - spawn.x) > 0.12) throw new Error(`${n.eventId}: half-pair midpoint must remain near authored spawn X ${spawn.x}, got ${midpointX}`);
          for (const o of halves) {
            if (Math.abs(o.position.y - spawn.y) > 0.12) throw new Error(`${n.eventId}: half ${o.id} must stay near authored spawn Y ${spawn.y}, got ${o.position.y}`);
          }
          // (c) per-hand desaturated fill.
          const diff = diffFor(fillNow, n.eventId);
          if (diff.length < MIN_HALF_PIXELS) throw new Error(`${n.eventId}: slice halves must be substantially present (got ${diff.length} diff px, min ${MIN_HALF_PIXELS})`);
          const fill = fillStats(diff);
          if (!fill) throw new Error(`${n.eventId}: no mid-luma fill pixels found`);
          // (c) Per-hand DESATURATED fill (reuse of the 0.0.59-flow-corpse-color
          // technique: mid-luma, low channel-spread, palette tint survives).
          // The fill is the hand palette color desaturated ×0.92, semi-
          // transparent over the dark blue stage, so it reads as a mid-luma
          // tint — assert the tint direction, not saturation.
          if (n.hand === "left") {
            if (fill.bMinusR <= 12) throw new Error(`${n.eventId}: left-hand corpse must be BLUE-SHIFT (desaturated #2693FF): b−r=${fill.bMinusR} (need > 12, the 0.0.59 proof bound)`);
            if (fill.bMinusG <= 10) throw new Error(`${n.eventId}: left-hand corpse must be blue-DOMINANT (b > g): b−g=${fill.bMinusG} (need > 10)`);
          } else {
            if (fill.gMinusR <= 8) throw new Error(`${n.eventId}: right-hand corpse must be GREEN-SHIFT (desaturated #39C96B): g−r=${fill.gMinusR} (need > 8)`);
            if (fill.bMinusG >= 12) throw new Error(`${n.eventId}: right-hand corpse must NOT be blue-dominant (that is the left hand's signature): b−g=${fill.bMinusG} (need < 12)`);
          }
          if (fill.meanSat >= 45) throw new Error(`${n.eventId}: corpse fill must be DESATURATED (a saturated glyph reads ≫ 45 channel-spread): meanSat=${fill.meanSat}`);
          if (fill.maxLuma >= 185) throw new Error(`${n.eventId}: corpse fill must be mid-luma, not near-white: maxLuma=${fill.maxLuma}`);
          // (d) monotone fall: centroid Y non-decreasing, bounded step.
          const anchor = project(spawn.x, spawn.y, spawn.z);
          const fall = [];
          let prevY = null;
          for (const off of FALL_OFFSETS_MS) {
            const d = diffFor(commit + off, n.eventId);
            if (d.length < 300) throw new Error(`${n.eventId} @+${off}: too few diff pixels (${d.length}) to track the fall`);
            const cY = d.reduce((s, p) => s + p.y, 0) / d.length;
            const cX = d.reduce((s, p) => s + p.x, 0) / d.length;
            if (prevY !== null) {
              if (cY < prevY - 0.5) throw new Error(`${n.eventId} @+${off}: fall centroid Y must be non-decreasing (no upward snap), got ${prevY.toFixed(1)} → ${cY.toFixed(1)}`);
              if (cY - prevY > FALL_STEP_BOUND_PX) throw new Error(`${n.eventId} @+${off}: fall step too large (snap/teleport): ${prevY.toFixed(1)} → ${cY.toFixed(1)}`);
            }
            prevY = cY;
            fall.push({ off, centroidX: +cX.toFixed(1), centroidY: +cY.toFixed(1), dXFromSpawn: +(cX - anchor.x).toFixed(1), dYFromSpawn: +(cY - anchor.y).toFixed(1), px: d.length });
          }
          // B11a regression guard: the halves keep the note's COLUMN during the
          // fall — at commit the centroid X sits at the note's spawn X, not
          // teleported to track center (x=0). (The old bug moved the spawn to
          // {0,1,0} → a ~+44 px X jump for col 1.)
          const at0 = fall[0];
          if (Math.abs(at0.dXFromSpawn) > 10) throw new Error(`${n.eventId}: halves must begin their fall at the note's column (spawn X), got centroid X offset ${at0.dXFromSpawn}px from spawn (center-teleport?)`);
          notes.push({ id: n.eventId, hand: n.hand, commit, fill, fall });
        }
        // Two fresh real-scoring runs of one IDENTICAL authored arrow. No direct
        // sliceT fixture: the only scalar authority is each coordinator's
        // accepted, first-sampled 3D saber contact. Renderer age, camera,
        // event identity (and therefore seed), palette and placement are fixed.
        const { createResolvedEquipmentPose, equipmentEulerDegreesToQuaternion, saberCapsuleGeometry } = await import("/node_modules/@aerobeat/web-contracts/src/index.js");
        const CUT_NOTE = Object.freeze({ eventId: "n-left", hand: "left", placement: 5, direction: "up", center: 6000 });
        const CUT_EVENT = events[0];
        const CUT_INDEX = createSessionTargetIndex([CUT_EVENT], {});
        const CUT_DRIVES = [
          { label: "lower", wristY: [0.4, 0.7] },
          { label: "upper", wristY: [1.27, 1.57] },
        ];
        const cutRuns = [];
        for (const drive of CUT_DRIVES) {
          const scorer = createAeroGameplaySessionCoordinator({ sessionId: `lcb2-cut-${drive.label}`, countdownStepMs: 1 });
          scorer.configureContent({ packageId: "lcb2-saber-pkg", selectedVariant: variant, resolvedEvents: [CUT_EVENT], profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false } });
          scorer.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
          scorer.requestStart(0);
          for (let t = 1; t <= 40; t += 1) {
            scorer.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
            if (scorer.getSnapshot().session.state === "playing") break;
          }
          if (scorer.getSnapshot().session.state !== "playing") throw new Error(`${drive.label}: fresh cut scorer did not start`);
          // The authored up stroke is a measured +0.30 judge-WU Y sweep. The
          // strict gameplay pose uses THAT frame's measured wrist as its anchor
          // (<= 1e-6 contract), but resolves a scale-2, +60° Z tilted 3D saber
          // instead of replacing contact with a fabricated cut scalar.
          const sweep = [[-120, drive.wristY[0]], [-80, drive.wristY[1]], [-40, drive.wristY[1]], [0, drive.wristY[1]]];
          for (const [delta, y] of sweep) {
            const songMs = CUT_NOTE.center + delta;
            const input = inputSnap(songMs, evidence(`cut-${drive.label}-${delta}`, songMs, { x: 1, y }, IDLE));
            const poses = standaloneTestEquipmentPoses("flow", input, game.equipmentConfigIdentity).map((pose) => pose.role === "left_wrist"
              ? createResolvedEquipmentPose({ role: pose.role, mode: pose.mode, anchor: pose.anchor, scale: 2, orientation: equipmentEulerDegreesToQuaternion({ x: 0, y: 0, z: 60 }), geometryIdentity: saberCapsuleGeometry.identity, configIdentity: pose.configIdentity })
              : pose);
            const wrist = input.latestEvidence.anchors.find((entry) => entry.anchor === "left_wrist");
            if (Math.abs(poses[0].anchor.x - (wrist.x * 4 - 0.5)) > 1e-6 || Math.abs(poses[0].anchor.y - (2.5 - wrist.y * 3)) > 1e-6 || Math.abs(poses[0].anchor.z) > 1e-6) throw new Error(`${drive.label}: resolved 3D pose did not match measured wrist`);
            scorer.advance({ timestampMs: songMs, clock: clockSnap(songMs, true), input, equipmentPoses: poses });
          }
          const judged = scorer.getSnapshot();
          const hit = judged.judgements.find((entry) => entry.eventId === CUT_NOTE.eventId);
          if (!hit || hit.result !== "hit" || Math.abs(Number(hit.committedTimelinePositionMs) - CUT_NOTE.center) > 180) throw new Error(`${drive.label}: authored up arrow must commit a real in-window hit: ${JSON.stringify(hit ?? null)}`);
          const lookup = scorer[Symbol.for("aerobeat.web-gameplay.internal-flow-slice")];
          if (typeof lookup !== "function") throw new Error(`${drive.label}: private accepted first-contact lookup missing`);
          const cut = lookup(CUT_NOTE.eventId);
          if (typeof cut !== "number" || !Number.isFinite(cut) || cut < 0.15 || cut > 0.85) throw new Error(`${drive.label}: no bounded accepted 3D contact scalar: ${String(cut)}`);
          const projected = projectSessionTargets([CUT_EVENT], judged, Number(hit.committedTimelinePositionMs), CUT_INDEX);
          const aftermath = projectAftermathEntries([CUT_EVENT], judged, Number(hit.committedTimelinePositionMs), projected, CUT_INDEX, null, (id) => lookup(id));
          const corpse = aftermath.find((entry) => entry.targetId === CUT_NOTE.eventId);
          if (!corpse || corpse.sliceT !== cut || corpse.shape !== "arrow" || corpse.direction !== "up" || corpse.hand !== "left") throw new Error(`${drive.label}: scored cut was not projected as the same authored left UP arrow`);
          cutRuns.push({ label: drive.label, cut, corpse, commit: Number(hit.committedTimelinePositionMs), wristY: drive.wristY });
        }
        const [lower, upper] = cutRuns;
        if (upper.cut - lower.cut < 0.20) throw new Error(`two accepted first-contact cuts must differ >= .20, got ${lower.cut}→${upper.cut}`);
        for (const key of ["targetId", "family", "hand", "mode", "shape", "direction", "seed", "appearanceColor"]) {
          if (lower.corpse[key] !== upper.corpse[key]) throw new Error(`cut comparison changed authored ${key}`);
        }
        if (JSON.stringify(lower.corpse.spawn) !== JSON.stringify(upper.corpse.spawn)) throw new Error("cut comparison changed authored spawn");
        // Attribute only the pinned arrow GLB sign− pixels: render both pieces
        // at their OWN hit age zero, disable that same half's pooled entity,
        // and compare framebuffer bytes with it re-enabled. Invert the camera
        // worldToScreen XY basis after each half's actual model rotation; no
        // color centroid, scene metadata or absolute screen-Y can prove a seam.
        const samplePiece = (run) => {
          renderer.renderGameplayFrame({ presentation: "flow", nowMs: run.commit, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath: [run.corpse] });
          const halves = renderer.lastModel.objects.filter((o) => o.targetId === CUT_NOTE.eventId && o.kind === "aftermath");
          if (halves.length !== 2) throw new Error(`${run.label}: expected two visible arrow pieces`);
          const pool = renderer.aftermathAssetPools.get("directional-arrow/rounded-outline-v1") ?? [];
          const bySign = {};
          for (const half of halves) {
            const sign = half.aftermath.sliceSign;
            const slot = pool.find((entity) => String(entity.name).includes(sign === -1 ? "half-" : "half+"));
            if (!slot) throw new Error(`${run.label}: missing real GLB pool sign ${sign}`);
            const assetMeshes = slot.findComponents("render").reduce((sum, part) => sum + part.meshInstances.length, 0);
            if (assetMeshes < 3) throw new Error(`${run.label}: sign ${sign} is not pinned arrow GLB geometry`);
            const center = project(half.position.x, half.position.y, half.position.z);
            const rotation = half.rotationZRad;
            const xWorld = project(half.position.x + Math.cos(rotation), half.position.y + Math.sin(rotation), half.position.z);
            const yWorld = project(half.position.x - Math.sin(rotation), half.position.y + Math.cos(rotation), half.position.z);
            const xAxis = [xWorld.x - center.x, xWorld.y - center.y], yAxis = [yWorld.x - center.x, yWorld.y - center.y];
            const determinant = xAxis[0] * yAxis[1] - xAxis[1] * yAxis[0];
            if (Math.abs(determinant) < 1) throw new Error(`${run.label}: degenerate screen-to-arrow XY basis`);
            slot.enabled = false; renderer.manualTick(); const without = readPixels();
            slot.enabled = true; renderer.manualTick(); const withPiece = readPixels();
            // Fixed bins in authored arrow-local coordinates, shared by BOTH
            // real cuts: lower, middle, and upper toward the local +Y tip
            // (far from seam/AA boundaries).
            const bins = { lower: 0, middle: 0, upper: 0 };
            let visible = 0;
            for (let index = 0; index < withPiece.length; index += 4) {
              if (Math.abs(withPiece[index] - without[index]) + Math.abs(withPiece[index + 1] - without[index + 1]) + Math.abs(withPiece[index + 2] - without[index + 2]) < 24) continue;
              visible += 1;
              const px = (index / 4) % canvas.width - center.x, py = Math.floor(index / 4 / canvas.width) - center.y;
              const localX = (px * yAxis[1] - py * yAxis[0]) / determinant;
              const localY = (py * xAxis[0] - px * xAxis[1]) / determinant;
              if (localX >= -0.055) continue;
              if (localY < -0.12 && localY > -0.34) bins.lower += 1;
              if (localY >= -0.10 && localY <= 0.10) bins.middle += 1;
              if (localY > 0.12 && localY < 0.34) bins.upper += 1;
            }
            bySign[sign] = { visible, bins };
          }
          return bySign;
        };
        const lowerPixels = samplePiece(lower), upperPixels = samplePiece(upper);
        for (const run of [lowerPixels, upperPixels]) {
          if (run[-1].visible < 150 || run[1].visible < 150) throw new Error(`both pinned GLB pieces must be visible: ${JSON.stringify(run)}`);
        }
        // Signed B10: the arrow-local +Y tip is sign− territory ONLY ahead
        // of the crossing (Y >= c). As accepted t increases, c moves toward
        // that tip, so sign− must LOSE fixed middle pixels and sign+ must
        // GAIN them. Local lower/upper bins guard against a swapped mask or
        // whole-glyph toggle. Midpoint-only production leaves both unchanged.
        const middleLoss = lowerPixels[-1].bins.middle - upperPixels[-1].bins.middle;
        const middleGainPlus = upperPixels[1].bins.middle - lowerPixels[1].bins.middle;
        const upperLoss = lowerPixels[-1].bins.upper - upperPixels[-1].bins.upper;
        const lowerLeak = Math.max(lowerPixels[-1].bins.lower, upperPixels[-1].bins.lower);
        if (lowerPixels[-1].bins.upper < 30 || upperPixels[1].bins.lower < 30 || middleLoss < 65 || middleGainPlus < 65 || lowerLeak > 25 || upperLoss < -25) throw new Error(`real first-contact seam must move toward local +Y tip and reduce sign− middle occupancy: cuts ${lower.cut}→${upper.cut}, lower ${JSON.stringify(lowerPixels)}, upper ${JSON.stringify(upperPixels)}, middleLoss=${middleLoss}, middleGainPlus=${middleGainPlus}`);
        return { notes, firstContactPixels: { cuts: cutRuns.map(({ label, cut, wristY }) => ({ label, cut, wristY })), lower: lowerPixels, upper: upperPixels, middleLoss, middleGainPlus } };
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
  const byId = (m) => Object.fromEntries(m.notes.map((n) => [n.id, n]));
  for (const id of ["n-left", "n-right"]) {
    const d = byId(direct)[id], f = byId(iframe)[id];
    assert.ok(Math.abs(d.fill.bMinusR - f.fill.bMinusR) <= 12, `${id}: fill b−r must agree across embeddings (${d.fill.bMinusR} vs ${f.fill.bMinusR})`);
    assert.ok(Math.abs(d.fill.gMinusR - f.fill.gMinusR) <= 12, `${id}: fill g−r must agree across embeddings (${d.fill.gMinusR} vs ${f.fill.gMinusR})`);
    assert.ok(Math.abs(d.fill.bMinusG - f.fill.bMinusG) <= 12, `${id}: fill b−g must agree across embeddings (${d.fill.bMinusG} vs ${f.fill.bMinusG})`);
    assert.ok(Math.abs(d.fill.meanSat - f.fill.meanSat) <= 12, `${id}: fill sat must agree across embeddings`);
    d.fall.forEach((s, i) => {
      assert.ok(Math.abs(s.centroidY - f.fall[i].centroidY) <= 3, `${id} @+${s.off}: fall centroid Y must agree across embeddings`);
      assert.ok(Math.abs(s.centroidX - f.fall[i].centroidX) <= 3, `${id} @+${s.off}: fall centroid X must agree across embeddings`);
    });
  }
  // Cross-hand assignment: within each embedding the LEFT corpse must be
  // measurably more blue than the RIGHT corpse (the hand identity must be
  // recoverable from the rendered tint, not just from the scene-graph label).
  for (const m of matrix) {
    const L = byId(m)["n-left"], R = byId(m)["n-right"];
    assert.ok(L.fill.bMinusG > R.fill.bMinusG + 6, `${m.embedding}: left corpse must be more blue than the right (b−g ${L.fill.bMinusG} vs ${R.fill.bMinusG})`);
    assert.ok(L.fill.bMinusR > R.fill.bMinusR, `${m.embedding}: left corpse must be more blue than the right (b−r ${L.fill.bMinusR} vs ${R.fill.bMinusR})`);
  }
  const summary = matrix.map((m) => ({
    embedding: m.embedding,
    notes: m.notes.map((n) => ({ id: n.id, hand: n.hand, commit: n.commit, fill: n.fill, fall: n.fall })),
    firstContactPixels: {
      cuts: m.firstContactPixels.cuts.map(({ label, cut }) => ({ label, cut })),
      middleLoss: m.firstContactPixels.middleLoss,
      middleGainPlus: m.firstContactPixels.middleGainPlus,
      halfCounts: Object.fromEntries(["lower", "upper"].map((position) => [position, Object.fromEntries([-1, 1].map((sign) => [sign, {
        visible: m.firstContactPixels[position][sign].visible,
        bins: m.firstContactPixels[position][sign].bins,
      }]))])),
    },
  }));
  console.log(`ORACLE 0.0.61-saber-cut-aftermath-pixels PASS: embeddings=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
