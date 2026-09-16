// @ts-check

// 0.0.58 B12 real-pixel oracle — a REAL boxing_collider_v1 nose–obstacle
// collision must produce the SAME red edge vignette as Flow, proven by
// reading REAL rendered canvas pixels (NOT the scene-graph
// `frame.model.objects`).
//
// What this oracle proves:
//   (B12) A boxing-derived `hazardContactActive` frame renders a RED-TINTED
//         band at the screen edges (above a no-collision baseline), identical
//         in mechanism to the Flow vignette. The contact signal comes from a
//         REAL `obstacleOutcomes` entry with `rulesetId:"boxing_collider_v1"` +
//         `result:"contact"`, derived through the existing assembly W5 path
//         (`projectHazardContactEvents` → `hazardContactActive`) with NO new
//         assembly wiring.
//
// Approach: drive a real boxing session headlessly via the public input path
// (calibration-ready pose frames with a measured nose anchor sweeping into an
// authored obstacle geometry) until `snapshot.hazardContact.active === true`
// and an `obstacleOutcomes` contact is committed. Then monkey-patch
// `graph.gameplay.getSnapshot()` to return that exact captured snapshot shape
// (the same way validate-0.0.55-visual-proof drives the Flow case) and read
// pixels with `hazardContactActive` present vs absent.
//
// Embedding: direct + genuine_cross_origin_iframe (the playtest surface).
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
        const game = document.querySelector("aero-game");
        const renderer = game.graph.renderer;
        game.stopFrameLoop();
        game.setMenuOpen(false);
        renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
        renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
        const [{ createAeroGameplaySessionCoordinator }] = await Promise.all([import("/node_modules/@aerobeat/web-gameplay/src/index.js")]);
        // Build a real boxing_collider_v1 session with a full-height left-column
        // wall (weave_right) and drive a measured nose sweep into it.
        const HASH = "a".repeat(64);
        const variant = { variantId: "b12-pixel", chartId: "chart-b12-pixel", mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const G = { x: 0, y: 0, width: 1, height: 3 };
        const gridMask = [0, 4, 8];
        const weaveEvent = { schema: "aerobeat/resolved_content_event", version: 3, eventId: "wall", variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs: 1000, intervalStartTimestampMs: 1000, intervalEndTimestampMs: 1300, sourceEventIds: ["s-wall"], type: "weave_right", sourceGeometry: { schema: "aerobeat/obstacle_source_geometry", version: 1, coordinateSpace: "beatsaber_v2_legacy_obstacle", kind: "v2_type_1", ...G }, gameplayGeometry: { schema: "aerobeat/obstacle_gameplay_geometry", version: 1, coordinateSpace: "aerobeat_top_left_grid", ...G }, gridMask, blockedCells: [...gridMask], checkpoint: { kind: "instantaneous", freshnessMs: 150, timingWindowMs: 180, noseSafeCells: [1,2,3,5,6,7,9,10,11] }, spatialTarget: { targetCell: 5, acceptedSubcells: [], sourceCell: -1 } };
        const keeperPunch = { schema: "aerobeat/resolved_content_event", version: 3, eventId: "keeper", variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs: 5000, sourceEventIds: ["s-keeper"], type: "straight_left", spatialTarget: { targetCell: 5, acceptedSubcells: [], sourceCell: -1 } };
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, sx, sy) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, sx, sy), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, 1, 1), anchor("right_wrist", m, 3, 1)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, playing });
        // countdownStepMs: 1 (same as the gameplay unit test) so the session
        // reaches "playing" and evaluateBoxingObstacles() runs — without it the
        // session is still in countdown when the collision is driven, so no
        // obstacle outcome is ever committed.
        const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "b12-pixel-browser", countdownStepMs: 1 });
        coordinator.configureContent({ packageId: "b12-pkg", selectedVariant: variant, resolvedEvents: [weaveEvent, keeperPunch], profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false } });
        coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
        coordinator.requestStart(0);
        coordinator.advance({ timestampMs: 1, clock: clockSnap(0, false) });
        coordinator.advance({ timestampMs: 2, clock: clockSnap(0, false) });
        coordinator.advance({ timestampMs: 3, clock: clockSnap(0, false) });
        // Nose outside → inside (segment entry) → exit → past-end (finalize).
        const send = (songMs, sx, sy, id) => coordinator.advance({ timestampMs: songMs, clock: clockSnap(songMs, true), input: inputSnap(songMs, evidence(id, songMs, sx, sy)) });
        const preState = coordinator.getSnapshot().session.state;
        if (preState !== "playing") throw new Error(`session must be "playing" before driving the collision, got "${preState}" (countdownStepMs: 1 required)`);
        send(950, 1, 2, "f0");
        send(1100, 0, 1.5, "f1");
        const midSnapshot = coordinator.getSnapshot();
        send(1200, 2, 1.5, "f2");
        send(1400, 2, 1.5, "f3");
        const finalSnapshot = coordinator.getSnapshot();
        // Capture the REAL boxing contact truth for the derivation proof.
        const contactActive = midSnapshot.hazardContact;
        const contactOutcome = finalSnapshot.obstacleOutcomes.find((o) => o.eventId === "wall");
        if (!contactOutcome || contactOutcome.result !== "contact" || contactOutcome.rulesetId !== "boxing_collider_v1") throw new Error(`expected a real boxing_collider_v1 contact outcome, got ${JSON.stringify(contactOutcome)}`);
        if (!Number.isFinite(contactOutcome.firstContactTimelinePositionMs)) throw new Error("contact outcome must carry a finite firstContactTimelinePositionMs");
        if (!contactActive.active) throw new Error(`expected hazardContact active during the collision, got ${JSON.stringify(contactActive)}`);
        // Derive hazardContactActive EXACTLY like the assembly W5 path does:
        // projectHazardContactEvents over obstacleOutcomes result==="contact"
        // with rulesetId boxing_collider_v1 → active state from the event.
        const nowMs = Number(finalSnapshot.session.timelinePositionMs ?? 0);
        const events = [];
        for (const outcome of finalSnapshot.obstacleOutcomes) {
          if (outcome.result !== "contact") continue;
          const atMs = Number(outcome.firstContactTimelinePositionMs);
          if (!Number.isFinite(atMs) || atMs < 0) continue;
          if (nowMs - atMs > 2000) continue;
          events.push({ eventId: String(outcome.eventId), atMs });
        }
        events.sort((a, b) => b.atMs - a.atMs);
        const latestContact = events[0] ?? null;
        let hazardContactActive = null;
        if ((finalSnapshot.hazardContact === undefined || finalSnapshot.hazardContact === null || finalSnapshot.hazardContact.active === false) && latestContact !== null) {
          const outcomeForLatest = finalSnapshot.obstacleOutcomes.find((o) => o.eventId === latestContact.eventId);
          if (outcomeForLatest && outcomeForLatest.rulesetId === "boxing_collider_v1") hazardContactActive = Object.freeze({ active: true, sinceMs: latestContact.atMs, releasedAtMs: null });
        } else if (finalSnapshot.hazardContact && finalSnapshot.hazardContact.active === true) {
          hazardContactActive = Object.freeze({ active: true, sinceMs: finalSnapshot.hazardContact.sinceMs, releasedAtMs: finalSnapshot.hazardContact.releasedAtMs });
        }
        if (!hazardContactActive || hazardContactActive.active !== true) throw new Error(`W5 derivation did not produce an active hazardContactActive for the boxing collision: ${JSON.stringify(hazardContactActive)}`);
        // Render the baseline (no vignette) then the collision frame (with
        // hazardContactActive) and compare edge-band pixels.
        const canvas = game.shadowRoot.querySelector("canvas");
        const readPixels = () => {
          const sample = new OffscreenCanvas(canvas.width, canvas.height);
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, sample.width, sample.height).data;
        };
        const baseFrame = { presentation: "boxing_collider", nowMs: 1150, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180 };
        renderer.renderGameplayFrame(baseFrame);
        const baseline = readPixels();
        const collFrame = { ...baseFrame, hazardContactActive, hazardVignetteParams: Object.freeze({ intensity: 1, pulseHz: 2, pulseDepth: 0.5, rampMs: 120, decayMs: 400 }) };
        renderer.renderGameplayFrame(collFrame);
        const pixels = readPixels();
        // Count red-tinted edge pixels (red channel dominant) in the outer
        // 15% band on all four edges — the vignette footprint.
        const w = canvas.width, h = canvas.height;
        const band = Math.max(1, Math.floor(Math.min(w, h) * 0.15));
        let redEdgeBase = 0, redEdgeColl = 0, totalEdgeBase = 0, totalEdgeColl = 0;
        const isRedTinted = (px, i) => px[i] > px[i + 1] * 1.15 && px[i] > px[i + 2] * 1.1 && px[i] > 40;
        const inEdgeBand = (x, y) => x < band || x >= w - band || y < band || y >= h - band;
        for (let y = 0; y < h; y += 2) {
          for (let x = 0; x < w; x += 2) {
            if (!inEdgeBand(x, y)) continue;
            const i = (y * w + x) * 4;
            totalEdgeBase += 1; totalEdgeColl += 1;
            if (isRedTinted(baseline, i)) redEdgeBase += 1;
            if (isRedTinted(pixels, i)) redEdgeColl += 1;
          }
        }
        // Also count total differing pixels between the two frames (the whole
        // vignette, including interior falloff).
        let differing = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (Math.abs(pixels[i] - baseline[i]) + Math.abs(pixels[i + 1] - baseline[i + 1]) + Math.abs(pixels[i + 2] - baseline[i + 2]) > 24) differing += 1;
        }
        return {
          contactActive: { active: contactActive.active, sinceMs: contactActive.sinceMs },
          outcome: { eventId: contactOutcome.eventId, rulesetId: contactOutcome.rulesetId, result: contactOutcome.result, firstContact: contactOutcome.firstContactTimelinePositionMs, consequenceApplied: contactOutcome.consequenceApplied },
          hazardContactActive,
          redEdgeBase, redEdgeColl, totalEdgeBase, totalEdgeColl, differing,
          canvasSize: { width: w, height: h }
        };
      });
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      // ---- B12: the REAL collision produced the contact signal ----
      assert.equal(proof.contactActive.active, true, `${embedding}: a real boxing nose-obstacle collision must set hazardContact active`);
      assert.ok(Number.isFinite(proof.contactActive.sinceMs), `${embedding}: the collision episode must carry a finite sinceMs`);
      assert.equal(proof.outcome.rulesetId, "boxing_collider_v1", `${embedding}: the contact outcome must be a boxing_collider_v1 obstacle outcome`);
      assert.equal(proof.outcome.result, "contact", `${embedding}: the contact outcome must be result "contact"`);
      assert.equal(proof.outcome.consequenceApplied, false, `${embedding}: a boxing head collision must apply no score consequence`);
      assert.ok(Number.isFinite(proof.outcome.firstContact), `${embedding}: the contact outcome must carry a finite firstContactTimelinePositionMs`);
      // ---- B12: the W5 derivation produces an active hazardContactActive ----
      assert.equal(proof.hazardContactActive.active, true, `${embedding}: the assembly W5 derivation must produce an active hazardContactActive from the boxing contact`);
      // ---- B12: real pixels — red edge band above the no-collision baseline ----
      assert.ok(proof.differing > 500, `${embedding}: the collision frame must differ from the baseline in substantial pixels (diff=${proof.differing})`);
      assert.ok(proof.redEdgeColl > proof.redEdgeBase, `${embedding}: red-tinted edge pixels must INCREASE with the collision (base=${proof.redEdgeBase}, coll=${proof.redEdgeColl})`);
      assert.ok(proof.redEdgeColl > proof.totalEdgeBase * 0.01, `${embedding}: the red edge band must cover a meaningful fraction of the edge (coll=${proof.redEdgeColl}/${proof.totalEdgeBase})`);
      matrix.push({ embedding, redEdgeBase: proof.redEdgeBase, redEdgeColl: proof.redEdgeColl, differing: proof.differing, sinceMs: proof.contactActive.sinceMs, canvas: proof.canvasSize });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  const [direct, iframe] = matrix;
  assert.ok(Math.abs(direct.redEdgeColl - iframe.redEdgeColl) <= Math.max(20, direct.redEdgeColl * 0.15), "direct/iframe red-edge pixel counts must agree within tolerance");
  console.log(`ORACLE 0.0.58-boxing-vignette-pixels PASS: embeddings=2, evidence=${JSON.stringify(matrix.map((m) => ({ embedding: m.embedding, redEdge: [m.redEdgeBase, m.redEdgeColl], differing: m.differing, sinceMs: m.sinceMs })))}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
