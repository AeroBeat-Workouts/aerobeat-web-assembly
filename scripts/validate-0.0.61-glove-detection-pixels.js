// @ts-check

// 0.0.61 L-C2 (htc8) real-pixel oracle — Boxing GLOVE DETECTION (0.0.61 GATE 1)
// in a REAL boxing_collider_v1 session: the rendered BOXING GLOVE (the 0.34 ×
// 0.28 WU detection volume, @aerobeat/web-contracts gloveGeometry) is the hit
// surface. A wrist that drives the glove INTO the authored punch's 1×1 judge
// cell inside the ±180 ms window commits a REAL judged hit (corpse at the note
// icon position, both hands); a wrist held clearly OUTSIDE the box commits a
// REAL miss (the icon turns the desaturated MISS gray, no corpse). The legacy
// nose marker is HIDDEN in production (empty cursor array) — proven here at
// the pixel level: the canonical gold nose dot (#F4C20D) is ABSENT at the
// projected nose position in the production frame while the gloves ARE visible,
// and a control frame WITH the nose cursor restores the gold dot.
//
// Detection geometry (flow-collider-collision.gloveBoxContactsBoxingTarget):
//   glove box  = [sx−0.34, sx+0.34] × [sy−0.28, sy+0.28]  (judge space)
//   target box = [tx−0.5, tx+0.5] × [ty−0.5, ty+0.5]       (the 1×1 cell)
//   hit ⇔ boxes overlap AND sample within [center−180, center+180]
//   straights are overlap-only (no direction gate).
//   cell 4 (straight_left,  judge (0,1))  cell 6 (straight_right, judge (2,1))
//
// Chart (one session, three punches):
//   p-hit-L : straight_left  cell 4 @ 6000  — LEFT  wrist (0, 1.25) in-box  → HIT
//   p-hit-R : straight_right cell 6 @10000  — RIGHT wrist (2, 1.25) in-box  → HIT
//   p-miss  : straight_left  cell 4 @14000  — LEFT  wrist (3, 1.0)  out-box → MISS
//
// Proven by reading REAL rendered canvas pixels (OffscreenCanvas drawImage +
// getImageData of the PlayCanvas canvas) against baseline-subtracted frames
// (|Δr|+|Δg|+|Δb| ≥ 24), NOT the scene-graph model (model reads are the
// geometry/ground-truth side). Embedding: direct + genuine_cross_origin_iframe.
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

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
      const proof = await target.evaluate(async () => {
        // ── tolerances ──
        const SPAWN_X_TOL_PX = 6;   // corpse centroid vs. note-icon screen X
        const SPAWN_Y_TOL_PX = 12;  // …and Y (launch drift + perspective)
        const KNOCK_STEP_PX = 30;   // max frame-to-frame centroid move
        const TIGHT_MS = new Set([4, 8, 12, 16]);
        const SAMPLE_MS = [4, 8, 12, 16, 40, 88, 103];
        const MIN_CORPSE_PX = 150;
        const NOSE_GOLD_R = 18;        // search radius (px) around the nose
        const NOSE_MAX_GOLD = 12;      // production: gold pixels allowed (≈0)
        const NOSE_MIN_GOLD = 100;     // control (cursor on): gold pixels needed
        const GLOVE_MIN_DIFF = 150;    // each glove must render substantially

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
        // ── chart: three punches, all sharing one variant ──
        const HASH = "c3".repeat(32);
        const variant = { variantId: "lcb2-glove", chartId: "chart-lcb2-glove", mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const punchEvent = (eventId, center, cell, hand) => Object.freeze({
          schema: "aerobeat/resolved_content_event", version: 3,
          eventId, variantId: variant.variantId, chartId: variant.chartId,
          centerTimestampMs: center, sourceEventIds: [`s-${eventId}`],
          authoredBeat: Object.freeze({ type: hand === "left" ? "straight_left" : "straight_right", hand, spatialTarget: Object.freeze({ targetCell: cell, acceptedSubcells: [], sourceCell: -1 }) }),
        });
        const events = [punchEvent("p-hit-L", 6000, 4, "left"), punchEvent("p-hit-R", 10000, 6, "right"), punchEvent("p-miss", 14000, 4, "left")];
        // ── input builders ──
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, lw, rw) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, 2, 1.5), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, lw.x, lw.y), anchor("right_wrist", m, rw.x, rw.y)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, durationSeconds: undefined, progress: undefined, playing });
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "lcb2-glove-browser", countdownStepMs: 1 });
        coordinator.configureContent({
          packageId: "lcb2-glove-pkg", selectedVariant: variant, resolvedEvents: events,
          profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false },
          boxingColliderSettings: { schema: "aerobeat/flow_collider_settings", version: 1, algorithm: "swept_athlete_plane_v1", colliderRadius: 0.12, enforceAuthoredDirection: true, directionToleranceDegrees: 45, timingWindowMs: 180, topRowReachWU: 0.25, bottomRowReachWU: 0.25, guardCountMode: "collision" },
        });
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        coordinator.requestStart(0);
        for (let t = 1; t <= 40; t += 1) {
          coordinator.advance({ timestampMs: t, clock: clockSnap(0, false), input: inputSnap(t, null) });
          if (coordinator.getSnapshot().session.state === "playing") break;
        }
        if (coordinator.getSnapshot().session.state !== "playing") throw new Error("session not playing after countdown");
        const step = (songMs, lw, rw, id) => coordinator.advance({ timestampMs: songMs, clock: clockSnap(songMs, true), input: inputSnap(songMs, evidence(id, songMs, lw, rw)) });
        // ── drives ──
        const IDLE = { x: 3, y: 1 }; // clearly outside cell 4 (judge (0,1)) and cell 6
        const drive = (center, side, wx, wy, tag) => { for (const d of [-200, -150, -100, -50, 0, 50, 100, 200]) { const lw = side === "left" ? { x: wx, y: wy } : IDLE; const rw = side === "right" ? { x: wx, y: wy } : IDLE; step(center + d, lw, rw, `${tag}${d}`); } };
        drive(6000, "left", 0, 1.25, "hl");   // LEFT glove into cell 4 → HIT
        drive(10000, "right", 2, 1.25, "hr"); // RIGHT glove into cell 6 → HIT
        step(12000, { x: 1, y: 0.5 }, { x: 2.5, y: 0.5 }, "eq"); // nose/equipment frame
        drive(14000, "left", 3, 1.0, "ms");   // LEFT glove outside cell 4 → MISS
        const snap = coordinator.getSnapshot();
        const judgement = (id) => snap.judgements.find((j) => j.eventId === id);
        // (a) GATE-ASSERT: two real hits (both hands) + one real miss.
        const hitL = judgement("p-hit-L"), hitR = judgement("p-hit-R"), miss = judgement("p-miss");
        if (!hitL || hitL.result !== "hit") throw new Error(`p-hit-L must be a REAL hit, got ${JSON.stringify(hitL ?? null)}`);
        if (!hitR || hitR.result !== "hit") throw new Error(`p-hit-R must be a REAL hit, got ${JSON.stringify(hitR ?? null)}`);
        if (!miss || miss.result !== "miss") throw new Error(`p-miss must be a REAL miss, got ${JSON.stringify(miss ?? null)}`);
        const commitL = Number(hitL.committedTimelinePositionMs), commitR = Number(hitR.committedTimelinePositionMs), missCommit = Number(miss.committedTimelinePositionMs);
        if (Math.abs(commitL - 6000) > 180) throw new Error(`p-hit-L commit ${commitL} outside ±180 of 6000`);
        if (Math.abs(commitR - 10000) > 180) throw new Error(`p-hit-R commit ${commitR} outside ±180 of 10000`);
        // ── pixel helpers ──
        const readPixels = () => { const s = new OffscreenCanvas(canvas.width, canvas.height); const c = s.getContext("2d", { willReadFrequently: true }); c.drawImage(canvas, 0, 0); return c.getImageData(0, 0, s.width, s.height).data; };
        const project = (x, y, z) => { const o = renderer.cameraEntity.camera.worldToScreen({ x, y, z }); return { x: o.x, y: o.y }; };
        const diffPixels = (full, base) => { const W = canvas.width, H = canvas.height, out = []; for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const i = (y * W + x) * 4; if (Math.abs(full[i] - base[i]) + Math.abs(full[i + 1] - base[i + 1]) + Math.abs(full[i + 2] - base[i + 2]) >= 24) out.push({ x, y, r: full[i], g: full[i + 1], b: full[i + 2] }); } return out; };
        const hashOf = (data) => { let h = 0x811c9dc5; for (let i = 0; i < data.length; i += 4) { h ^= data[i]; h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0; } return h; };
        const freezeGuard = { lastFrameCount: -1, hashes: new Map() };
        const guard = (tag) => { const fc = renderer.describe().frameCount; if (fc === freezeGuard.lastFrameCount) throw new Error(`${tag}: renderer frameCount did not advance (frozen render)`); const px = readPixels(); const h = hashOf(px); if (freezeGuard.hashes.has(tag) && freezeGuard.hashes.get(tag) === h) throw new Error(`${tag}: identical pixels re-rendered under the same tag (frozen frame)`); freezeGuard.lastFrameCount = fc; freezeGuard.hashes.set(tag, h); return px; };
        const index = createSessionTargetIndex(events, {});
        const rowReach = Object.freeze({ topRowReachWU: 0.25, bottomRowReachWU: 0.25 });
        const frameAt = (nowMs, targetsOverride) => { const s = coordinator.getSnapshot(); const targets = targetsOverride !== undefined ? targetsOverride : projectSessionTargets(events, s, nowMs, index); const aftermath = projectAftermathEntries(events, s, nowMs, targets, index, rowReach); return { presentation: "boxing_collider", nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, rowReach, aftermath }; };
        // (b) HIT: the corpse diff-centroid sits at the note icon's screen
        // position (0.0.59-boxing-spawn centroid technique) and moves smoothly.
        const checkHit = (eventId, commit, center, label) => {
          const rows = [];
          for (const off of SAMPLE_MS) {
            const nowMs = commit + off;
            const fullFrame = frameAt(nowMs);
            renderer.renderGameplayFrame(fullFrame); const withPx = guard(`${label} corpse +${off}`);
            // baseline = same frame minus this target's aftermath entry
            const baseFrame = { ...fullFrame, aftermath: fullFrame.aftermath.filter((e) => e.targetId !== eventId) };
            renderer.renderGameplayFrame(baseFrame); const basePx = guard(`${label} base +${off}`);
            const diff = diffPixels(withPx, basePx);
            if (diff.length === 0) { rows.push({ off, count: 0, meanX: null, meanY: null }); continue; }
            const sx = diff.reduce((a, q) => a + q.x, 0) / diff.length, sy = diff.reduce((a, q) => a + q.y, 0) / diff.length;
            rows.push({ off, count: diff.length, meanX: +sx.toFixed(1), meanY: +sy.toFixed(1) });
          }
          // note-icon ground truth: read the icon's world position at the commit frame.
          renderer.renderGameplayFrame(frameAt(commit));
          const model = renderer.lastModel; if (!model) throw new Error(`${label}: lastModel null`);
          const icon = model.objects.find((o) => o.kind === "icon" && o.targetId === eventId);
          if (!icon) throw new Error(`GATE-ASSERT ${label}: no kind=icon object for ${eventId} at commit (icons: ${model.objects.filter((o) => o.kind === "icon").map((o) => o.id).join(",")})`);
          const noteScreen = project(icon.position.x, icon.position.y, icon.position.z);
          for (const row of rows.filter((r) => TIGHT_MS.has(r.off))) {
            if (row.count < MIN_CORPSE_PX) throw new Error(`${label} +${row.off}ms: corpse must render visibly (${row.count}px < ${MIN_CORPSE_PX})`);
            const dx = Math.abs(row.meanX - noteScreen.x), dy = Math.abs(row.meanY - noteScreen.y);
            if (dx > SPAWN_X_TOL_PX) throw new Error(`${label} +${row.off}ms: corpse X ${row.meanX} ≠ note-icon X ${noteScreen.x.toFixed(1)} (Δ ${dx.toFixed(1)}px > ${SPAWN_X_TOL_PX}) — the hit corpse is NOT at the note position`);
            if (dy > SPAWN_Y_TOL_PX) throw new Error(`${label} +${row.off}ms: corpse Y ${row.meanY} ≠ note-icon Y ${noteScreen.y.toFixed(1)} (Δ ${dy.toFixed(1)}px > ${SPAWN_Y_TOL_PX})`);
          }
          const present = rows.filter((r) => r.meanX !== null);
          for (let i = 1; i < present.length; i += 1) { const st = Math.hypot(present[i].meanX - present[i - 1].meanX, present[i].meanY - present[i - 1].meanY); if (st >= KNOCK_STEP_PX) throw new Error(`${label} +${present[i].off}ms: corpse moved ${st.toFixed(1)}px ≥ ${KNOCK_STEP_PX}px between frames (teleport)`); }
          return { eventId, commit, note: { x: +noteScreen.x.toFixed(1), y: +noteScreen.y.toFixed(1) }, rows };
        };
        const hitLpx = checkHit("p-hit-L", commitL, 6000, "hitL");
        const hitRpx = checkHit("p-hit-R", commitR, 10000, "hitR");
        // (c) MISS: no corpse + the icon turns MISS gray.
        const missNow = missCommit + 50;
        const missFrame = frameAt(missNow);
        renderer.renderGameplayFrame(missFrame); const missWithPx = guard("miss with");
        const missBase = frameAt(missNow, missFrame.targets.filter((t) => t.id !== "p-miss"));
        renderer.renderGameplayFrame(missBase); const missBasePx = guard("miss base");
        // (c-i) NO corpse: no aftermath entry / scene object for the miss.
        if (missFrame.aftermath.some((e) => e.targetId === "p-miss")) throw new Error("p-miss: a miss must NOT spawn an aftermath corpse");
        const missCorpseObjs = renderer.lastModel.objects.filter((o) => String(o.id).startsWith("p-miss:aftermath"));
        if (missCorpseObjs.length > 0) throw new Error(`p-miss: found ${missCorpseObjs.length} aftermath scene objects on a MISS`);
        // (c-ii) GRAY turn: the isolated miss icon is low-saturation (not the
        // hand's saturated blue/green). MISS_COLOR = #7c828c.
        const missDiff = diffPixels(missWithPx, missBasePx);
        if (missDiff.length < 50) throw new Error(`p-miss: miss icon not rendered (only ${missDiff.length} diff px)`);
        let msat = 0, mlum = 0; for (const q of missDiff) { msat += Math.max(q.r, q.g, q.b) - Math.min(q.r, q.g, q.b); mlum += 0.2126 * q.r + 0.7152 * q.g + 0.0722 * q.b; }
        const missMeanSat = msat / missDiff.length, missMeanLuma = mlum / missDiff.length;
        if (missMeanSat >= 45) throw new Error(`p-miss: miss icon must be the desaturated MISS gray (mean channel-spread ${missMeanSat.toFixed(1)} ≥ 45 reads as a colored note, not a gray turn)`);
        if (missMeanLuma < 60 || missMeanLuma > 200) throw new Error(`p-miss: miss icon luma ${missMeanLuma.toFixed(1)} not mid (expected ~MISS gray #7c828c)`);
        // (d) NOSE MARKER ABSENT + equipment visible (production frame).
        const cursorOptions = { grid: { x: 0, y: 0, width: 1, height: 1 }, minConfidence: 0.5, sizeCssPx: 32 };
        const equipment = Object.freeze([{ role: "left_wrist", x: (1 + 0.5) / 4, y: (2.5 - 0.5) / 3, mode: "boxing" }, { role: "right_wrist", x: (2.5 + 0.5) / 4, y: (2.5 - 0.5) / 3, mode: "boxing" }]);
        const eqFrame = frameAt(12000);
        const noseWorld = { x: -2 + ((2 + 0.5) / 4) * 4, y: 2.5 - ((2.5 - 1.5) / 3) * 3, z: 0.45 }; // = (0.5, 1.5, 0.45)
        const noseScreen = project(noseWorld.x, noseWorld.y, noseWorld.z);
        const goldIn = (px, cx, cy) => { const W = canvas.width; let n = 0; for (let y = Math.max(0, cy - NOSE_GOLD_R) | 0; y < Math.min(canvas.height, cy + NOSE_GOLD_R + 1) | 0; y += 1) for (let x = Math.max(0, cx - NOSE_GOLD_R) | 0; x < Math.min(W, cx + NOSE_GOLD_R + 1) | 0; x += 1) { if (Math.hypot(x - cx, y - cy) > NOSE_GOLD_R) continue; const i = (y * W + x) * 4; if (px[i] > 180 && px[i + 1] > 150 && px[i + 2] < 120) n += 1; } return n; };
        // production: EMPTY cursors, gloves ON.
        renderer.renderGameplayFrameWithCursorsAndEquipment(eqFrame, Object.freeze([]), cursorOptions, equipment, { grid: { x: 0, y: 0, width: 1, height: 1 } });
        const prodPx = guard("nose prod");
        const eqDiag = renderer.describe().equipment;
        if (eqDiag.instanceCount !== 2) throw new Error(`equipment must show BOTH gloves, got ${JSON.stringify(eqDiag)}`);
        const prodGold = goldIn(prodPx, noseScreen.x, noseScreen.y);
        if (prodGold > NOSE_MAX_GOLD) throw new Error(`nose marker must be ABSENT in the production frame (empty cursors): ${prodGold} gold-ish px at the projected nose (${noseScreen.x.toFixed(0)},${noseScreen.y.toFixed(0)}) > ${NOSE_MAX_GOLD}`);
        // the gloves ARE visible: their diff vs. a no-equipment frame is substantial.
        renderer.renderGameplayFrameWithCursorsAndEquipment(eqFrame, Object.freeze([]), cursorOptions, Object.freeze([]), { grid: { x: 0, y: 0, width: 1, height: 1 } });
        const noEqPx = guard("nose noeq");
        const gloveDiff = diffPixels(prodPx, noEqPx);
        if (gloveDiff.length < GLOVE_MIN_DIFF * 2) throw new Error(`gloves must be visible in the production frame (only ${gloveDiff.length} equipment diff px)`);
        // control: SAME frame + a nose cursor → the gold dot returns.
        renderer.renderGameplayFrameWithCursorsAndEquipment(eqFrame, Object.freeze([{ role: "nose", x: (2 + 0.5) / 4, y: (2.5 - 1.5) / 3, confidence: 1 }]), cursorOptions, equipment, { grid: { x: 0, y: 0, width: 1, height: 1 } });
        const ctrlPx = guard("nose ctrl");
        const ctrlGold = goldIn(ctrlPx, noseScreen.x, noseScreen.y);
        if (ctrlGold < NOSE_MIN_GOLD) throw new Error(`control (nose cursor ON) must restore the gold dot: ${ctrlGold} gold-ish px < ${NOSE_MIN_GOLD} at the projected nose`);
        // restore a clean frame.
        renderer.renderGameplayFrameWithCursorsAndEquipment(eqFrame, Object.freeze([]), cursorOptions, equipment, { grid: { x: 0, y: 0, width: 1, height: 1 } });
        guard("nose restore");
        return {
          hitL: hitLpx, hitR: hitRpx,
          miss: { commit: missCommit, meanSat: +missMeanSat.toFixed(1), meanLuma: +missMeanLuma.toFixed(1), diffPx: missDiff.length },
          nose: { screen: { x: +noseScreen.x.toFixed(1), y: +noseScreen.y.toFixed(1) }, prodGold, ctrlGold, equipmentCount: eqDiag.instanceCount, gloveDiffPx: gloveDiff.length },
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
  const parity = (a, b, label, tol) => { if (!Number.isFinite(a) || !Number.isFinite(b)) return; assert.ok(Math.abs(a - b) <= tol, `${label} must agree across embeddings (${a} vs ${b})`); };
  for (const k of ["hitL", "hitR"]) {
    const d = direct[k], f = iframe[k];
    parity(d.note.x, f.note.x, `${k} note X`, 3); parity(d.note.y, f.note.y, `${k} note Y`, 3);
    d.rows.forEach((r, i) => { const o = f.rows[i]; if (r.meanX !== null) { parity(r.meanX, o.meanX, `${k} +${r.off} centroid X`, 3); parity(r.meanY, o.meanY, `${k} +${r.off} centroid Y`, 3); } assert.equal(r.count === 0, o.count === 0, `${k} +${r.off} presence must match`); });
  }
  parity(direct.miss.meanSat, iframe.miss.meanSat, "miss meanSat", 12);
  parity(direct.miss.meanLuma, iframe.miss.meanLuma, "miss meanLuma", 12);
  parity(direct.nose.prodGold, iframe.nose.prodGold, "nose prodGold", 20);
  parity(direct.nose.ctrlGold, iframe.nose.ctrlGold, "nose ctrlGold", 100);
  assert.equal(direct.nose.equipmentCount, iframe.nose.equipmentCount, "equipment count must match");
  const summary = matrix.map((m) => ({ embedding: m.embedding, hitL: { commit: m.hitL.commit, note: m.hitL.note, rows: m.hitL.rows }, hitR: { commit: m.hitR.commit, note: m.hitR.note, rows: m.hitR.rows }, miss: m.miss, nose: m.nose }));
  console.log(`ORACLE 0.0.61-glove-detection-pixels PASS: embeddings=2, evidence=${JSON.stringify(summary)}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
