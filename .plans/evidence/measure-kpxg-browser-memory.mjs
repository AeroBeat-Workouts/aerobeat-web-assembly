// @ts-check
//
// kpxg (0.0.61 L-E) — IN-PAGE memory-growth harness for the long-song
// memory-growth diagnosis. NOT wired into the gate; run manually:
//
//   cd aerobeat-web-assembly
//   node .plans/evidence/measure-kpxg-browser-memory.mjs
//   (optional env: KPXG_END_MS=904000 (default), KPXG_SAMPLE_EVERY_MS=50000)
//
// Pattern: same Vite server + genuine cross-origin iframe embedding as the
// production pixel oracles (scripts/validate-0.0.59-boxing-spawn-pixels.js).
// Inside the real page it loads the REAL production modules from the Vite
// module graph and drives the REAL `createAeroGameplaySessionCoordinator`
// through a play-mode run of a synthetic ~15-minute flow_colliders_v1 chart
// (3000 notes @ 300 ms + 100 walls), advancing a simulated audio clock at
// ~60 fps tick cadence — a TIME-COMPRESSED equivalent of a 15-minute
// physical playtest (no CV/camera needed: the coordinator consumes synthetic
// contract-valid evidence frames).
//
// What it samples (every KPXG_SAMPLE_EVERY_MS of song time, gc() first via
// chromium --js-flags=--expose-gc):
//   - performance.memory.usedJSHeapSize / jsHeapSizeLimit  (real browser heap)
//   - coordinator accumulator sizes from getSnapshot():
//     judgements / judgedEventIds / hazardOutcomes / obstacleOutcomes
//
// Expected (per the static analysis + Node-side measurement):
//   - judgements: LINEAR at note rate (≈3.3/s) → ~3000 over 15 min, negligible.
//   - hazardOutcomes (flow walls): QUADRATIC — one duplicate
//     "flow_hazard_outcome" per expired wall per tick, because
//     evaluateFlowObstacles excludes finalized obstacles via obstacleOutcomes
//     while flow wall outcomes land in hazardOutcomes (session-coordinator.js
//     lines 681/901). Curve must be a parabola, NOT a plateau. If a fix lands,
//     this curve flattens to ≤ wall count (≤100 here) → use this script to
//     verify the fix in-page.
//
// Output: one TSV row per sample on stdout + a final fit summary +
//   .plans/evidence/kpxg-browser-memory-<ts>.tsv (raw series).

import { createServer as createHttpServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const scriptsDir = dirname(fileURLToPath(import.meta.url)); // .plans/evidence
const END_MS = Number(process.env.KPXG_END_MS) || 904_000; // ~15 min of song time
const SAMPLE_EVERY_MS = Number(process.env.KPXG_SAMPLE_EVERY_MS) || 50_000;

// Self-contained Vite config (deliberately NOT the repo's vite.config.js, which
// runs release provenance/fingerprint checks that reject dirty sibling-lane
// worktrees). The harness only needs the SAME module resolution + fs roots as
// the app so the page runs the real production module graph; the define
// constants carry placeholder values (irrelevant to memory accounting).
const assemblyRoot = join(dirname(scriptsDir), ".."); // aerobeat-web-assembly
const assemblyPackageJson = JSON.parse(readFileSync(join(assemblyRoot, "package.json"), "utf8"));
const linkedRoots = Object.entries(assemblyPackageJson.dependencies)
  .filter(([, spec]) => typeof spec === "string" && spec.startsWith("file:"))
  .map(([packageName, spec]) => {
    const packageRoot = new URL(spec.replace(/\/$/u, ""), `file://${assemblyRoot}/`);
    return fileURLToPath(packageRoot);
  });
const packageVersion = assemblyPackageJson.version;
const vite = await createViteServer({
  appType: "spa",
  configFile: false,
  root: assemblyRoot,
  logLevel: "error",
  define: {
    __AEROBEAT_BUILD_STAMP__: JSON.stringify("kpxg-harness"),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(`kpxg-${packageVersion}`),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(packageVersion)
  },
  resolve: {
    alias: [
      { find: /^@aerobeat\/web-hash$/u, replacement: fileURLToPath(new URL("../aerobeat-web-hash/src/index.js", `file://${assemblyRoot}/`)) },
      { find: /^@aerobeat\/web-ui$/u, replacement: fileURLToPath(new URL("../aerobeat-web-ui/src/index.js", `file://${assemblyRoot}/`)) }
    ],
    preserveSymlinks: false
  },
  optimizeDeps: {
    exclude: ["@aerobeat/web-content-authoring", "@aerobeat/web-contracts", "@aerobeat/web-gameplay", "@aerobeat/web-hash", "@aerobeat/web-renderer", "@aerobeat/web-ui"]
  },
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null, fs: { strict: true, allow: [assemblyRoot, ...linkedRoots] } }
});
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parent = createHttpServer((_request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parent.listen(0, "127.0.0.1", resolve));
const address = parent.address();
if (!address || typeof address === "string") throw new Error("Parent URL unavailable");
const parentUrl = `http://localhost:${address.port}/`;

const browser = await chromium.launch({ headless: true, args: ["--js-flags=--expose-gc"] });
const page = await (await browser.newContext({ viewport: { width: 868, height: 414 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", (error) => console.error("pageerror:", error.message));
try {
  await page.goto(parentUrl, { waitUntil: "networkidle" });
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (!frame) throw new Error("Cross-origin child missing");
  await frame.waitForSelector("aero-game");

  const result = await frame.evaluate(async (cfg) => {
    // REAL production module graph (same Vite-served modules as the app).
    const { createAeroGameplaySessionCoordinator } = await import("/node_modules/@aerobeat/web-gameplay/src/index.js");

    const TICK_MS = 16;
    const NOTE_PERIOD_MS = 300;
    const FIRST_NOTE_MS = 4000;
    const noteCount = Math.floor((cfg.endMs - FIRST_NOTE_MS - 2000) / NOTE_PERIOD_MS);
    const obstacleCount = 100;
    const wallIntervalMs = 1000;

    const note = (i, centerMs) => ({
      schema: "aerobeat/resolved_content_event", version: 3, type: "note",
      eventId: `note-${i}`, centerTimestampMs: centerMs,
      hand: i % 2 === 0 ? "left" : "right", placement: i % 12,
      ...(i % 4 === 0 ? { direction: "down" } : {}),
      authoredBeat: { type: "note", hand: i % 2 === 0 ? "left" : "right", placement: i % 12, ...(i % 4 === 0 ? { direction: "down" } : {}) },
      variantId: "v1", chartId: "c1"
    });
    const wall = (i, centerMs) => ({
      schema: "aerobeat/resolved_content_event", version: 3, type: "obstacle",
      eventId: `obs-${i}`, centerTimestampMs: centerMs,
      intervalStartTimestampMs: centerMs, intervalEndTimestampMs: centerMs + wallIntervalMs,
      sourceGeometry: { schema: "aerobeat/obstacle_source_geometry", version: 1, coordinateSpace: "beatsaber_v3_obstacle_rect", kind: "v3_rect", x: 0, y: 0, width: 4, height: 3 },
      gameplayGeometry: { schema: "aerobeat/obstacle_gameplay_geometry", version: 1, coordinateSpace: "aerobeat_top_left_grid", x: 0, y: 0, width: 4, height: 3 },
      gridMask: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      authoredBeat: { type: "obstacle", start: 0, end: 2 },
      variantId: "v1", chartId: "c1"
    });
    const events = [];
    for (let i = 0; i < noteCount; i += 1) events.push(note(i, FIRST_NOTE_MS + i * NOTE_PERIOD_MS));
    for (let i = 0; i < obstacleCount; i += 1) {
      const center = FIRST_NOTE_MS + 2000 + i * Math.floor((cfg.endMs - FIRST_NOTE_MS - 4000) / (obstacleCount + 1));
      events.push(wall(i, center));
    }
    events.sort((a, b) => a.centerTimestampMs - b.centerTimestampMs || (a.eventId < b.eventId ? -1 : 1));

    const coordinator = createAeroGameplaySessionCoordinator({ sessionId: "kpxg-browser", countdownStepMs: 250 });
    coordinator.configureContent(
      { packageId: "pkg-kpxg", selectedVariant: { variantId: "v1", chartId: "c1", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: false, localOnly: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "a".repeat(64) }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "b".repeat(64) }, provenance: null }, resolvedEvents: events },
      { purpose: "play" }
    );
    coordinator.setLeaseSnapshot({ schema: "aerobeat/media_lease_snapshot", version: 1, ownerInstanceId: "browser", generation: 1, state: "owned", resources: ["audio"] });

    const anchor = (id, p, cell) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: id, calibrationId: "cal-1", measurementTimestampMs: 0, valid: true, confidence: 0.9, rawX: p.x, rawY: p.y, x: p.x, y: p.y, cell, subcell: cell });
    const entry = (id, cell) => ({ schema: "aerobeat/body_grid_cell_entry", version: 1, anchor: id, calibrationId: "cal-1", measurementTimestampMs: 0, fromCell: cell, toCell: cell, direction: "down", provenance: "measured" });
    const cellOf = (x, y) => Math.min(2, Math.max(0, Math.floor(y * 3))) * 4 + Math.min(3, Math.max(0, Math.floor(x * 4)));
    const inputFor = (t) => {
      const l = { x: 0.5 + 0.4 * Math.sin(t / 900), y: 0.5 + 0.4 * Math.cos(t / 700) };
      const r = { x: 0.5 + 0.4 * Math.cos(t / 800), y: 0.5 + 0.4 * Math.sin(t / 600) };
      const n = { x: 0.5 + 0.3 * Math.sin(t / 1200), y: 0.5 + 0.3 * Math.cos(t / 1100) };
      return {
        calibration: { calibrationId: "cal-1", readiness: "ready" },
        tracking: { gameplayPaused: false, freshCalibrationRequired: false },
        countdownFrozen: false,
        latestEvidence: { schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1", measurementTimestampMs: t - 1, measuredSourceFrameId: `f${t}`, provenance: "measured", anchors: [anchor("nose", n, cellOf(n.x, n.y)), anchor("left_wrist", l, cellOf(l.x, l.y)), anchor("right_wrist", r, cellOf(r.x, r.y))], entries: [entry("left_wrist", cellOf(l.x, l.y)), entry("right_wrist", cellOf(r.x, r.y))], activeBoxingActions: [] },
        straightQualifications: []
      };
    };

    const mem = () => {
      const m = performance.memory;
      return m ? { usedKb: Math.round(m.usedJSHeapSize / 1024), limitKb: Math.round(m.jsHeapSizeLimit / 1024) } : { usedKb: null, limitKb: null };
    };
    const sizes = () => {
      const s = coordinator.getSnapshot();
      return {
        judgements: s.judgements.length,
        judgedIds: s.judgedEventIds.length,
        hazardOutcomes: s.hazardOutcomes.length,
        obstacleOutcomes: s.obstacleOutcomes.length
      };
    };

    coordinator.advance({ timestampMs: TICK_MS, clock: { contextTimeSeconds: 0, positionSeconds: 0, durationSeconds: cfg.endMs / 1000 + 1, progress: 0, playing: false }, input: inputFor(TICK_MS) });
    const start = coordinator.requestStart(TICK_MS, { schema: "aerobeat/gameplay_session_start", version: 1, purpose: "play" });
    if (!start.accepted) throw new Error(`requestStart rejected: ${JSON.stringify(start)}`);

    const samples = [];
    let nextSampleAt = cfg.sampleEveryMs;
    for (let t = 2 * TICK_MS; t <= cfg.endMs; t += TICK_MS) {
      const playing = coordinator.getSnapshot().session.state === "playing";
      coordinator.advance({
        timestampMs: t,
        clock: playing
          ? { contextTimeSeconds: t / 1000, positionSeconds: t / 1000, durationSeconds: cfg.endMs / 1000 + 1, progress: Math.min(1, t / cfg.endMs), playing: true }
          : { contextTimeSeconds: 0, positionSeconds: 0, durationSeconds: cfg.endMs / 1000 + 1, progress: 0, playing: false },
        input: inputFor(t)
      });
      if (t >= nextSampleAt) {
        const gc = globalThis.gc;
        if (typeof gc === "function") gc();
        samples.push({ tMs: t, state: coordinator.getSnapshot().session.state, ...sizes(), ...mem() });
        nextSampleAt += cfg.sampleEveryMs;
      }
    }
    return { eventCount: events.length, noteCount, obstacleCount, finalState: coordinator.getSnapshot().session.state, samples };
  }, { endMs: END_MS, sampleEveryMs: SAMPLE_EVERY_MS });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tsvPath = join(scriptsDir, `kpxg-browser-memory-${stamp}.tsv`);
  const header = "tMs\tstate\tjudgements\tjudgedIds\thazardOutcomes\tobstacleOutcomes\tusedKb\tlimitKb\n";
  const rows = result.samples.map((s) => `${s.tMs}\t${s.state}\t${s.judgements}\t${s.judgedIds}\t${s.hazardOutcomes}\t${s.obstacleOutcomes}\t${s.usedKb}\t${s.limitKb}`).join("\n");
  writeFileSync(tsvPath, header + rows + "\n");

  console.log(`events=${result.eventCount} (notes=${result.noteCount} walls=${result.obstacleCount}) finalState=${result.finalState} samples=${result.samples.length}`);
  for (const s of result.samples) console.log(`t=${s.tMs} state=${s.state} judgements=${s.judgements} judgedIds=${s.judgedIds} hazardOutcomes=${s.hazardOutcomes} obstacleOutcomes=${s.obstacleOutcomes} usedKb=${s.usedKb} limitKb=${s.limitKb}`);

  const ts = result.samples.map((s) => s.tMs / 1000);
  const fit = (ys) => {
    const n = ys.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i += 1) { sx += ts[i]; sy += ys[i]; sxx += ts[i] * ts[i]; sxy += ts[i] * ys[i]; }
    const denom = n * sxx - sx * sx;
    return denom === 0 ? { slope: 0, intercept: 0 } : { slope: (n * sxy - sx * sy) / denom, intercept: (sy - (n * sxy - sx * sy) / denom * sx) / n };
  };
  const jFit = fit(result.samples.map((s) => s.judgements));
  const hFit = fit(result.samples.map((s) => s.hazardOutcomes));
  const memFit = fit(result.samples.filter((s) => s.usedKb !== null).map((s) => s.usedKb));
  console.log("\n=== kpxg browser fit (t in s of song time) ===");
  console.log(`judgements     slope=${jFit.slope.toFixed(3)}/s (expect ≈ note rate, linear)`);
  console.log(`hazardOutcomes slope=${hFit.slope.toFixed(1)}/s AVG over window — check CURVE shape in TSV (parabolic = leak present; flat ≤ wall count = leak fixed)`);
  console.log(`usedJSHeapKb   slope=${memFit.slope.toFixed(1)} KiB/s (browser, gc() before each sample)`);
  console.log(`raw series: ${tsvPath}`);
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => parent.close(resolve));
}
