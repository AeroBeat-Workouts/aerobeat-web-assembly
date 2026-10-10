// @ts-check
// Cross-package browser integration: decoded music ends shortly after the last
// scored note, but the production AudioContext clock must survive its Play miss
// deadline and feedback margin. This is deliberately not Visual Test playback.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// The browser runner is a bundled module so Vite resolves the public package
// exports before Chromium evaluates them; page.evaluate alone cannot resolve
// bare specifiers without an import map.
const fixtureEntry = `import { createAeroWebAudioService } from "@aerobeat/web-audio";
import { createAeroGameplaySessionCoordinator, defaultFlowColliderSettings, defaultBoxingColliderSettings } from "@aerobeat/web-gameplay";
import { scoringClockMinimumDurationSeconds } from "/src/scoring-clock-minimum.js";
window.__scoredShortSongFixture = { createAeroWebAudioService, createAeroGameplaySessionCoordinator, defaultFlowColliderSettings, defaultBoxingColliderSettings, scoringClockMinimumDurationSeconds };`;
const vite = await createServer({ root, appType: "spa", configFile: false, logLevel: "error", plugins: [{ name: "scored-short-song-public-entry", resolveId(id) { if (id === "/scored-short-song-fixture.js") return "\0scored-short-song-fixture"; }, load(id) { if (id === "\0scored-short-song-fixture") return fixtureEntry; } }], define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("short-song-tail-test"), __AEROBEAT_CACHE_BUST__: JSON.stringify("short-song-tail-test"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("short-song-tail-test") }, server: { host: "127.0.0.1", port: 0, hmr: false, fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] } } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0];
  assert.ok(url, "isolated Vite URL");
  browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ type: "module", content: 'import "/scored-short-song-fixture.js";' });
  await page.waitForFunction(() => Boolean(window.__scoredShortSongFixture), null, { timeout: 15000 });
  const result = await page.evaluate(async () => {
    const { createAeroWebAudioService, createAeroGameplaySessionCoordinator, defaultFlowColliderSettings, defaultBoxingColliderSettings, scoringClockMinimumDurationSeconds } = window.__scoredShortSongFixture;
    const hash = "a".repeat(64);
    const identity = { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash };
    const traces = [];
    for (const mode of ["flow", "boxing"]) {
      const rulesetId = mode === "flow" ? "flow_colliders_v1" : "boxing_collider_v1";
      const variant = { variantId: `${mode}-short`, chartId: `${mode}-chart`, mode, rulesetId, recipeId: null, modifierIds: [], ranked: true, localOnly: false, mapHash: identity, scoreIdentityHash: identity, provenance: { kind: "imported" } };
      const event = { schema: "aerobeat/resolved_content_event", version: 3, eventId: `${mode}-last-note`, variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs: 1100, sourceEventIds: [`source-${mode}`], type: mode === "flow" ? "note" : "straight_left", hand: "left", placement: 5, ...(mode === "boxing" ? { spatialTarget: { targetCell: 5, entryDirection: "up" } } : {}) };
      const mixedEvents = [{ ...event, eventId: "other-chart-note", variantId: "other-chart", centerTimestampMs: 4000 }, event];
      const settings = mode === "flow" ? defaultFlowColliderSettings : defaultBoxingColliderSettings;
      const required = scoringClockMinimumDurationSeconds(mixedEvents, variant, settings);
      if (required !== 2.5) throw new Error(`${mode}: selected chart minimum ${required}`);
      const context = new AudioContext();
      await context.resume();
      // Decode a real browser audio buffer from an actual WAV; no mocked audio
      // service or synthetic clock. 1.18s EOF is only 80ms after the final note.
      const samples = 1.18 * 8000;
      const wav = new ArrayBuffer(44 + samples * 2), header = new DataView(wav);
      const text = (offset, value) => { for (let i = 0; i < value.length; i++) header.setUint8(offset + i, value.charCodeAt(i)); };
      text(0, "RIFF"); header.setUint32(4, wav.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt "); header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true); header.setUint32(24, 8000, true); header.setUint32(28, 16000, true); header.setUint16(32, 2, true); header.setUint16(34, 16, true); text(36, "data"); header.setUint32(40, samples * 2, true);
      const decoded = await context.decodeAudioData(wav.slice(0));
      if (Math.abs(decoded.duration - 1.18) > 0.001) throw new Error(`${mode}: WAV decode duration`);
      const audio = createAeroWebAudioService({ audioContext: context });
      const gameplay = createAeroGameplaySessionCoordinator({ sessionId: `${mode}-short-tail`, countdownStepMs: 1 });
      try {
        await audio.load({ id: `${mode}-wav`, kind: "array-buffer", label: "Short decoded source", arrayBuffer: wav }, { minimumDurationSeconds: required });
        if (Math.abs(audio.getSource().durationSeconds - 1.18) > 0.001) throw new Error(`${mode}: original decoded source duration was mutated`);
        const retained = audio.ensureMinimumDurationSeconds(required - 0.2);
        if (retained.durationSeconds !== required) throw new Error(`${mode}: selected variant cannot shorten the clock`);
        const clock = () => audio.getClockSnapshot();
        // The real Play collider requires a current, calibrated two-wrist pose
        // frame even when neither wrist contacts the last note.
        const anchor = (name, measured, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-short", measurementTimestampMs: measured, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
        const equipmentIdentity = { schema: "aerobeat/equipment_config_identity", version: 1, algorithm: "sha256", value: "b".repeat(64) };
        let frameId = 0;
        const advance = timestampMs => {
          const measured = timestampMs, left = [-0.4, -0.4], right = [3.4, -0.4];
          const evidence = { schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-short", measuredSourceFrameId: `off-target-${mode}-${++frameId}`, measurementTimestampMs: measured, provenance: "measured", activeBoxingActions: [], anchors: [anchor("nose", measured, 3, 2), anchor("left_shoulder", measured, 0, 0), anchor("right_shoulder", measured, 3, 0), anchor("left_elbow", measured, 0, 0), anchor("right_elbow", measured, 3, 0), anchor("left_wrist", measured, ...left), anchor("right_wrist", measured, ...right)], entries: [] };
          const input = { sourceIdentity: "camera-short", calibration: { calibrationId: "cal-short", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: evidence, straightQualifications: [] };
          // Poses stay physically away from the note; no sweep reaches cell 5.
          // Per-frame ids and source timestamps are still genuine measured input.
          const equipmentPoses = [["left_wrist", ...left], ["right_wrist", ...right]].map(([role, sx, sy]) => ({ role, mode, anchor: { x: sx, y: sy, z: 0 }, scale: 1, orientation: { x: 0, y: 0, z: 0, w: 1 }, geometryIdentity: mode === "flow" ? "aerobeat/saber_capsule_v1" : "aerobeat/glove_obb_v1", configIdentity: equipmentIdentity }));
          gameplay.advance({ timestampMs, clock: clock(), input, equipmentPoses });
        };
        const stopped = () => ({ ...clock(), playing: false });
        gameplay.configureContent({ packageId: `${mode}-package`, selectedVariant: variant, resolvedEvents: [event], ...(mode === "flow" ? { flowColliderSettings: settings } : { boxingColliderSettings: settings }) });
        gameplay.advance({ timestampMs: 0, clock: stopped(), input: { sourceIdentity: "camera-short", calibration: { calibrationId: "cal-short", readiness: "countdown" }, tracking: { gameplayPaused: false, freshCalibrationRequired: false }, countdownFrozen: false, latestEvidence: null, straightQualifications: [] } });
        if (gameplay.requestStart(0).accepted !== true) throw new Error(`${mode}: calibration start refused`);
        for (const t of [1, 2, 3]) gameplay.advance({ timestampMs: t, clock: stopped() });
        if (gameplay.getSnapshot().session.state !== "playing") throw new Error(`${mode}: calibration countdown failed`);
        await audio.play();
        let timestamp = 4;
        const waitUntil = async (seconds) => {
          const wallDeadline = performance.now() + 5500;
          while (clock().positionSeconds < seconds && performance.now() < wallDeadline) await new Promise(resolve => setTimeout(resolve, 8));
          if (clock().positionSeconds < seconds) throw new Error(`${mode}: audio clock did not reach ${seconds}s`);
          timestamp = Math.max(timestamp + 1, performance.now());
          advance(timestamp);
          return { state: gameplay.getSnapshot().session.state, clock: clock(), judgements: gameplay.getJudgements(), scores: gameplay.getScorePartitions() };
        };
        const beforeEOF = await waitUntil(1.16);
        const afterEOF = await waitUntil(1.45);
        // A pre-clearance sample is deliberately separated from the strict
        // boundary; browser timers can overshoot a sub-frame target.
        const stillVisible = await waitUntil(1.95);
        const strictBoundary = await waitUntil(2.1);
        const committed = await waitUntil(2.145);
        const feedback = await waitUntil(2.38);
        const endDeadline = performance.now() + 3000;
        while (audio.getClockSnapshot().playing && performance.now() < endDeadline) await new Promise(resolve => setTimeout(resolve, 8));
        if (audio.getClockSnapshot().playing) throw new Error(`${mode}: audio silent tail did not end`);
        timestamp = Math.max(timestamp + 1, performance.now());
        gameplay.advance({ timestampMs: timestamp, clock: clock() });
        traces.push({ mode, decodedDuration: audio.getSource().durationSeconds, required, beforeEOF, afterEOF, stillVisible, strictBoundary, committed, feedback, ended: { state: gameplay.getSnapshot().session.state, clock: clock(), judgements: gameplay.getJudgements(), scores: gameplay.getScorePartitions() } });
      } finally {
        gameplay.destroy(); await audio.destroy(); await context.close();
      }
    }
    return traces;
  });
  for (const run of result) {
    const label = run.mode;
    assert.equal(run.decodedDuration, 1.18, `${label}: original decoded audio duration`);
    assert.equal(run.required, 2.5, `${label}: center+1000 then 400ms feedback`);
    for (const [name, frame] of [["before EOF", run.beforeEOF], ["after EOF", run.afterEOF], ["still visible", run.stillVisible]]) {
      assert.equal(frame.state, "playing", `${label} ${name}: session has not completed`);
      assert.equal(frame.judgements.length, 0, `${label} ${name}: no full Miss while note might be visible`);
      assert.equal(frame.clock.playing, true, `${label} ${name}: actual audio clock still playing`);
    }
    assert.ok(run.afterEOF.clock.positionSeconds > run.decodedDuration, `${label}: audio context truly continues after original EOF`);
    if (run.strictBoundary.clock.positionSeconds <= 2.1) assert.equal(run.strictBoundary.judgements.length, 0, `${label}: strict center+1000ms boundary not already settled`);
    else assert.equal(run.strictBoundary.judgements.length, 1, `${label}: sampled strictly beyond deadline and settled once`);
    assert.equal(run.committed.judgements.length, 1, `${label}: exactly one settled note after strict boundary`);
    assert.equal(run.committed.judgements[0].result, "miss", `${label}: actual scored Play full Miss`);
    assert.equal(run.committed.judgements[0].tier, "miss", `${label}: not synthetic Test feedback`);
    assert.equal(run.committed.judgements[0].sessionPurpose, "play", `${label}: real scored Play judgement`);
    assert.equal(run.committed.scores[0]?.misses, 1, `${label}: scored MISS exactly once`);
    assert.equal(run.feedback.judgements.length, 1, `${label}: no second Miss during feedback margin`);
    assert.equal(run.feedback.state, "playing", `${label}: feedback margin survives before terminal completion`);
    assert.equal(run.ended.judgements.length, 1, `${label}: exactly one final Miss`);
    assert.equal(run.ended.state, "completed", `${label}: session completes only after extended audio end`);
    assert.equal(run.ended.clock.playing, false, `${label}: real AudioContext tail ended`);
    console.log(`${label} scored short-song clock: decoded ${run.decodedDuration}s, after-EOF ${run.afterEOF.clock.positionSeconds.toFixed(3)}s, Miss ${run.committed.clock.positionSeconds.toFixed(3)}s, completed ${run.ended.clock.positionSeconds.toFixed(3)}s PASS`);
  }
  assert.deepEqual(failures, [], "no browser page errors");
} finally {
  await browser?.close();
  await vite.close();
}
