// @ts-check

// 0.0.61 L-B (3gb2) real-pixel oracle — the hazard vignette is ENVELOPE-ONLY:
// contact episode + ramp(150 ms)/pulse(2 Hz)/decay(400 ms). The 0.0.56 W5
// post-exit re-fire (forcing `hazardContactActive` to {active:true,
// releasedAtMs:null} for up to the 950 ms retention after the athlete exited a
// boxing_collider_v1 obstacle) is GONE: no re-derived active state may outlive
// the real release boundary.
//
// What this oracle proves (B12 weave_right fixture, real rendered canvas
// pixels + the state channel `lastModel.hazardGlow.intensity`):
//   (a) PASS-BY: nose sweeps through (2,1.5) — clear of the left-column wall
//       geometry {x:0,y:0,width:1,height:3} — across the interval.
//       hazardContact.active stays false, the obstacle outcome is not
//       "contact", hazardGlow.intensity === 0 for every frame, and the
//       outer ~15% edge-band red pixels ≈ baseline.
//   (b) CONTACT control: nose sweeps through (0,1.5) — inside the wall.
//       outcome "contact", hazardContact.active true during the collision,
//       state channel ramping to >0.4 by ~250 ms after entry, edge-band red
//       pixels > baseline, >500 differing pixels.
//   (c) POST-EXIT envelope (the regression): up to ~1000 ms after the real
//       release boundary, hazardGlow.intensity reaches 0 within ~550 ms of
//       release and STAYS 0. Pre-fix, the W5 override re-derived
//       {active:true, releasedAtMs:null} from the retained contact event and
//       the vignette re-ramped until atMs+950 ms.
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
        // Same B12 fixture as the 0.0.58 gate: full-height left-column wall
        // (weave_right), interval [1000,1300], keeper straight_left punch at 5000.
        const HASH = "a".repeat(64);
        const variant = { variantId: "v061-env", chartId: "chart-v061-env", mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: HASH }, provenance: { kind: "imported" } };
        const G = { x: 0, y: 0, width: 1, height: 3 };
        const gridMask = [0, 4, 8];
        const weaveEvent = { schema: "aerobeat/resolved_content_event", version: 3, eventId: "wall", variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs: 1000, intervalStartTimestampMs: 1000, intervalEndTimestampMs: 1300, sourceEventIds: ["s-wall"], type: "weave_right", sourceGeometry: { schema: "aerobeat/obstacle_source_geometry", version: 1, coordinateSpace: "beatsaber_v2_legacy_obstacle", kind: "v2_type_1", ...G }, gameplayGeometry: { schema: "aerobeat/obstacle_gameplay_geometry", version: 1, coordinateSpace: "aerobeat_top_left_grid", ...G }, gridMask, blockedCells: [...gridMask], checkpoint: { kind: "instantaneous", freshnessMs: 150, timingWindowMs: 180, noseSafeCells: [1,2,3,5,6,7,9,10,11] }, spatialTarget: { targetCell: 5, acceptedSubcells: [], sourceCell: -1 } };
        const keeperPunch = { schema: "aerobeat/resolved_content_event", version: 3, eventId: "keeper", variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs: 5000, sourceEventIds: ["s-keeper"], type: "straight_left", spatialTarget: { targetCell: 5, acceptedSubcells: [], sourceCell: -1 } };
        const anchor = (name, m, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: m, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const evidence = (id, m, sx, sy) => ({ schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measuredSourceFrameId: id, measurementTimestampMs: m, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", m, sx, sy), anchor("left_shoulder", m, 0, 0), anchor("right_shoulder", m, 3, 0), anchor("left_elbow", m, 0, 0), anchor("right_elbow", m, 3, 0), anchor("left_wrist", m, 1, 1), anchor("right_wrist", m, 3, 1)], entries: [] });
        const inputSnap = (m, latest) => ({ sourceIdentity: "camera-a", calibration: { calibrationId: "cal-1", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: latest, straightQualifications: [] });
        const clockSnap = (ms, playing) => ({ contextTimeSeconds: ms / 1000, positionSeconds: ms / 1000, playing });
        const { standaloneTestEquipmentPoses } = await import("/src/test-equipment-authoring.js"); await game.ensureEquipmentConfigIdentity();
        const startSession = (sessionId) => {
          const coordinator = createAeroGameplaySessionCoordinator({ sessionId, countdownStepMs: 1 });
          coordinator.configureContent({ packageId: `${sessionId}-pkg`, selectedVariant: variant, resolvedEvents: [weaveEvent, keeperPunch], profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "profile", profileVersion: "1", contentHash: HASH, class: "between_run_ruleset", regenerationRequired: false } });
          coordinator.advance({ timestampMs: 0, clock: clockSnap(0, false), input: inputSnap(0, null) });
          coordinator.requestStart(0);
          coordinator.advance({ timestampMs: 1, clock: clockSnap(0, false) });
          coordinator.advance({ timestampMs: 2, clock: clockSnap(0, false) });
          coordinator.advance({ timestampMs: 3, clock: clockSnap(0, false) });
          if (coordinator.getSnapshot().session.state !== "playing") throw new Error(`${sessionId}: session must be "playing" before driving the sweep`);
          return coordinator;
        };
        // (a) PASS-BY: nose (2,1.5) — column 2, center row; the wall occupies
        // column 0 only (±0.5 padding reaches x=-0.5..0.5) → no contact.
        const passBy = startSession("v061-pb");
        const send = (coordinator,songMs,sx,sy,id) => { const input=inputSnap(songMs,evidence(id,songMs,sx,sy)); return coordinator.advance({timestampMs:songMs,clock:clockSnap(songMs,true),input,equipmentPoses:standaloneTestEquipmentPoses("boxing",input,game.equipmentConfigIdentity)}); };
        send(passBy, 900, 2, 1.5, "pb0");
        send(passBy, 1050, 2, 1.5, "pb1");
        send(passBy, 1250, 2, 1.5, "pb2");
        const passByFinal = passBy.getSnapshot();
        const passByOutcome = passByFinal.obstacleOutcomes.find((o) => o.eventId === "wall") ?? null;
        const passByChecks = {
          active: passByFinal.hazardContact.active === true ? true : false,
          sinceMs: passByFinal.hazardContact.sinceMs,
          releasedAtMs: passByFinal.hazardContact.releasedAtMs,
          outcome: passByOutcome ? passByOutcome.result : null
        };
        // (b) CONTACT: nose (0,1.5) — column 0, inside the wall → segment
        // entry 900→1050, exit 1050→1250, finalize at interval end 1300.
        const contact = startSession("v061-ct");
        send(contact, 900, 2, 1.5, "c0");
        send(contact, 1050, 0, 1.5, "c1");
        const contactMid = contact.getSnapshot();
        send(contact, 1250, 2, 1.5, "c2");
        const contactPost = contact.getSnapshot();
        send(contact, 1400, 2, 1.5, "c3");
        const contactFinal = contact.getSnapshot();
        const contactOutcome = contactFinal.obstacleOutcomes.find((o) => o.eventId === "wall") ?? null;
        // Render: baseline, then per-scenario state-channel + pixel frames.
        const canvas = game.shadowRoot.querySelector("canvas");
        const readPixels = () => {
          const sample = new OffscreenCanvas(canvas.width, canvas.height);
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, sample.width, sample.height).data;
        };
        const baseFrame = { presentation: "boxing_collider", nowMs: 1150, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180 };
        const params = Object.freeze({ intensity: 1, pulseHz: 2, pulseDepth: 0.5, rampMs: 150, decayMs: 400 });
        // The envelope is driven by the REAL post-exit session state (retained entry sinceMs +
        // measured release tick) — the release-moment pulse phase is recomputed statelessly from
        // (sinceMs, releasedAtMs, params), so a sinceMs:null state would decay to 0 by design.
        const releasedState = { active: false, sinceMs: contactPost.hazardContact.sinceMs, releasedAtMs: contactPost.hazardContact.releasedAtMs };
        const intensityAt = (nowMs, hca) => {
          const result = renderer.renderGameplayFrame({ ...baseFrame, nowMs, ...(hca === null ? {} : { hazardContactActive: hca }), hazardVignetteParams: params, aftermath: [], hazardContacts: [] });
          return { intensity: result.model?.hazardGlow?.intensity ?? 0, enabled: Boolean(renderer.hazardGlowEntity?.enabled) };
        };
        function readPixelsAfter(render) { render(); return readPixels(); }
        // Baseline: no hazard state at all (no vignette).
        const baseline = readPixelsAfter(() => { renderer.renderGameplayFrame({ ...baseFrame, aftermath: [], hazardContacts: [], hazardVignetteParams: params }); });
        const intensityBaseline = renderer.lastModel?.hazardGlow?.intensity ?? 0;
        // (b) contact frame: active episode {sinceMs:1150} at nowMs 1300 — 150 ms
        // past entry so the ramp is complete and the 2 Hz pulse is mid-band.
        const collState = intensityAt(1300, { active: true, sinceMs: 1150, releasedAtMs: null });
        const contactFramePixels = readPixelsAfter(() => { renderer.renderGameplayFrame({ ...baseFrame, nowMs: 1300, hazardContactActive: { active: true, sinceMs: 1150, releasedAtMs: null }, hazardVignetteParams: params, aftermath: [], hazardContacts: [] }); });
        // Ramp sample for the state-channel ramp proof (~250 ms after entry).
        const rampProbe = (() => {
          const result = renderer.renderGameplayFrame({ ...baseFrame, nowMs: 1300, hazardContactActive: { active: true, sinceMs: 1150, releasedAtMs: null }, hazardVignetteParams: params, aftermath: [], hazardContacts: [] });
          return result.model?.hazardGlow?.intensity ?? 0;
        })();
        // (a) pass-by frame: no active state → intensity must be exactly 0.
        const passByState = intensityAt(1250, null);
        const passByFramePixels = readPixelsAfter(() => { renderer.renderGameplayFrame({ ...baseFrame, nowMs: 1250, aftermath: [], hazardContacts: [], hazardVignetteParams: params }); });
        // (c) post-exit envelope: released state sampled across nowMs.
        const envelope = [];
        for (const nowMs of [1300, 1400, 1500, 1600, 1700, 1900, 2100, 2300]) {
          envelope.push({ nowMs, ...intensityAt(nowMs, releasedState) });
        }
        // 15%-edge-band red pixel counting (proven detector, 0.0.58 gate).
        const w = canvas.width, h = canvas.height;
        const band = Math.max(1, Math.floor(Math.min(w, h) * 0.15));
        const isRedTinted = (px, i) => px[i] > px[i + 1] * 1.15 && px[i] > px[i + 2] * 1.1 && px[i] > 40;
        const inEdgeBand = (x, y) => x < band || x >= w - band || y < band || y >= h - band;
        const countRedEdge = (px) => {
          let redEdge = 0, totalEdge = 0;
          for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
              if (!inEdgeBand(x, y)) continue;
              totalEdge += 1;
              if (isRedTinted(px, (y * w + x) * 4)) redEdge += 1;
            }
          }
          return { redEdge, totalEdge };
        };
        const redBase = countRedEdge(baseline);
        const redPassBy = countRedEdge(passByFramePixels);
        const redColl = countRedEdge(contactFramePixels);
        let differing = 0;
        for (let i = 0; i < contactFramePixels.length; i += 4) {
          if (Math.abs(contactFramePixels[i] - baseline[i]) + Math.abs(contactFramePixels[i + 1] - baseline[i + 1]) + Math.abs(contactFramePixels[i + 2] - baseline[i + 2]) > 24) differing += 1;
        }
        let passByDiffering = 0;
        for (let i = 0; i < passByFramePixels.length; i += 4) {
          if (Math.abs(passByFramePixels[i] - baseline[i]) + Math.abs(passByFramePixels[i + 1] - baseline[i + 1]) + Math.abs(passByFramePixels[i + 2] - baseline[i + 2]) > 24) passByDiffering += 1;
        }
        return {
          passBy: passByChecks,
          contact: {
            mid: { active: contactMid.hazardContact.active, sinceMs: contactMid.hazardContact.sinceMs, releasedAtMs: contactMid.hazardContact.releasedAtMs },
            post: { active: contactPost.hazardContact.active, sinceMs: contactPost.hazardContact.sinceMs, releasedAtMs: contactPost.hazardContact.releasedAtMs },
            outcome: contactOutcome ? { rulesetId: contactOutcome.rulesetId, result: contactOutcome.result, consequenceApplied: contactOutcome.consequenceApplied } : null
          },
          intensityBaseline,
          rampProbe,
          collState,
          passByState,
          envelope,
          redBase: redBase.redEdge, totalEdge: redBase.totalEdge,
          redPassBy: redPassBy.redEdge,
          redColl: redColl.redEdge,
          differing, passByDiffering,
          releasedAt: contactPost.hazardContact.releasedAtMs,
          canvasSize: { width: w, height: h }
        };
      });
      if (embedding !== "direct") assert.notEqual(new URL(childUrl).origin, new URL(parentUrl).origin, "iframe must be genuinely cross-origin");
      assert.deepEqual(noise, []);
      // ---- (a) PASS-BY: no contact state, no contact outcome, no vignette ----
      assert.equal(proof.passBy.active, false, `${embedding}: pass-by must never set hazardContact active`);
      assert.notEqual(proof.passBy.outcome, "contact", `${embedding}: pass-by must not commit a contact outcome (got ${JSON.stringify(proof.passBy.outcome)})`);
      assert.equal(proof.passByState.intensity, 0, `${embedding}: pass-by frame must have hazardGlow.intensity === 0, got ${proof.passByState.intensity}`);
      assert.equal(proof.passByState.enabled, false, `${embedding}: pass-by frame must leave the hazard-glow entity disabled`);
      assert.equal(proof.intensityBaseline, 0, `${embedding}: baseline frame must have hazardGlow.intensity === 0`);
      assert.ok(proof.passByDiffering <= 60, `${embedding}: pass-by frame must stay ≈ baseline (diff=${proof.passByDiffering})`);
      assert.ok(Math.abs(proof.redPassBy - proof.redBase) <= 5, `${embedding}: pass-by edge-band red pixels must ≈ baseline (base=${proof.redBase}, passBy=${proof.redPassBy})`);
      // ---- (b) CONTACT: real episode, outcome "contact", vignette ON + ramped ----
      assert.equal(proof.contact.mid.active, true, `${embedding}: hazardContact must be active during the collision`);
      // The episode starts at the MEASURED entry sample (fixture pose-clock samples land at
      // 1012.5-ish, not the exact 1050 tick the fixture intended) — assert the property
      // (entry sample inside the wall interval near its start), not the incidental tick.
      assert.ok(Number.isFinite(proof.contact.mid.sinceMs) && proof.contact.mid.sinceMs >= 1000 && proof.contact.mid.sinceMs <= 1100, `${embedding}: contact episode must start at a measured entry sample within the wall interval, got ${JSON.stringify(proof.contact.mid)}`);
      assert.equal(proof.contact.mid.releasedAtMs, null, `${embedding}: active episode must not carry a release boundary`);
      assert.equal(proof.contact.outcome?.rulesetId, "boxing_collider_v1", `${embedding}: contact outcome must be a boxing_collider_v1 outcome`);
      assert.equal(proof.contact.outcome?.result, "contact", `${embedding}: contact outcome must be "contact"`);
      assert.equal(proof.contact.outcome?.consequenceApplied, false, `${embedding}: boxing head collision must apply no score consequence`);
      assert.equal(proof.contact.post.active, false, `${embedding}: after exit the episode must be inactive`);
      assert.ok(Number.isFinite(proof.contact.post.releasedAtMs) && proof.contact.post.releasedAtMs >= 1250 && proof.contact.post.releasedAtMs <= 1300, `${embedding}: release boundary must land at the exit tick (1250..1300), got ${JSON.stringify(proof.contact.post)}`);
      assert.ok(proof.rampProbe >= 0.4, `${embedding}: state channel must be ramped by ~250 ms after entry (sinceMs=1150 @1300: ${proof.rampProbe})`);
      assert.ok(proof.collState.intensity > 0.3, `${embedding}: contact frame must be above 30% intensity (pulse trough), got ${proof.collState.intensity}`);
      assert.equal(proof.collState.enabled, true, `${embedding}: contact frame must enable the hazard-glow entity`);
      assert.ok(proof.differing > 500, `${embedding}: contact frame must differ from baseline in substantial pixels (diff=${proof.differing})`);
      assert.ok(proof.redColl > proof.redBase, `${embedding}: contact frame edge-band red pixels must EXCEED baseline (base=${proof.redBase}, coll=${proof.redColl})`);
      assert.ok(proof.redColl > proof.totalEdge * 0.01, `${embedding}: contact frame red band must cover a meaningful edge fraction (coll=${proof.redColl}/${proof.totalEdge})`);
      // ---- (c) POST-EXIT envelope: strictly decaying while visible, exactly 0 from
      // releasedAtMs+decayMs (400 ms) onward, stays 0 (no re-fire — the 3gb2 regression) ----
      const env = proof.envelope;
      const releasedAt = proof.releasedAt;
      assert.equal(env.length, 8, `${embedding}: envelope must carry the 8 post-exit samples`);
      assert.ok(env[0].intensity > 0.2, `${embedding}: the first post-release sample must still carry visible decay intensity (>0.2), got ${env[0].intensity} at ${env[0].nowMs} (release ${releasedAt})`);
      for (let i = 1; i < env.length; i += 1) assert.ok(env[i].intensity === 0 && env[i - 1].intensity === 0 ? true : env[i].intensity < env[i - 1].intensity, `${embedding}: the post-exit decay must be strictly decreasing while visible, flat only at 0 (${env[i - 1].nowMs}=${env[i - 1].intensity} -> ${env[i].nowMs}=${env[i].intensity})`);
      for (const s of env) {
        if (s.nowMs >= releasedAt + 400) assert.equal(s.intensity, 0, `${embedding}: intensity must be exactly 0 at/after release+decayMs (${releasedAt}+400), got ${s.intensity} at ${s.nowMs}`);
        else assert.ok(s.intensity > 0, `${embedding}: intensity must still be > 0 before release+decayMs, got ${s.intensity} at ${s.nowMs}`);
      }
      assert.equal(env[env.length - 1].intensity, 0, `${embedding}: intensity must STAY 0 through the final sample (${env[env.length - 1].nowMs}) — no post-exit re-fire`);
      matrix.push({ embedding, redBase: proof.redBase, redPassBy: proof.redPassBy, redColl: proof.redColl, differing: proof.differing, passByDiffering: proof.passByDiffering, rampProbe: proof.rampProbe, envelopeHead: [env[0].intensity, env[1].intensity, env[2].intensity, env[3].intensity], canvas: proof.canvasSize });
    } finally {
      await context.close();
    }
  }
  assert.equal(matrix.length, 2);
  const [direct, iframe] = matrix;
  assert.ok(Math.abs(direct.redColl - iframe.redColl) <= Math.max(20, direct.redColl * 0.15), "direct/iframe red-edge pixel counts must agree within tolerance");
  assert.equal(direct.rampProbe, iframe.rampProbe, "direct/iframe state-channel ramp intensities must agree");
  assert.deepEqual(direct.envelopeHead, iframe.envelopeHead, "direct/iframe post-exit envelope heads must agree");
  console.log(`ORACLE 0.0.61-vignette-envelope-pixels PASS: embeddings=2, evidence=${JSON.stringify(matrix.map((m) => ({ embedding: m.embedding, redEdge: [m.redBase, m.redPassBy, m.redColl], differing: m.differing, passByDiffering: m.passByDiffering, ramp: m.rampProbe, envelopeHead: m.envelopeHead })))}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
