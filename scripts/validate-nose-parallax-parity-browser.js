// @ts-check
// Project-owned regression: real PlayCanvas + pinned gameplay GLB, assembly setup/config/input boundary.
// Run: node scripts/validate-nose-parallax-parity-browser.js
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const entry = `import { createAeroPlayCanvasRenderer } from "@aerobeat/web-renderer";
import { AeroGameSetupCoordinator, defaultAeroGameSetupSnapshot, aeroGameSetupStorageKey } from "/src/game-setup-coordinator.js";
import { rendererGameplayVisualConfig, sanitizedNoseCameraDeflection, INTERNAL_INPUT_MEASURED_NOSE_PARALLAX } from "/src/gameplay-visual-runtime.js";
window.__noseParityFixture = { createAeroPlayCanvasRenderer, AeroGameSetupCoordinator, defaultAeroGameSetupSnapshot, aeroGameSetupStorageKey, rendererGameplayVisualConfig, sanitizedNoseCameraDeflection, INTERNAL_INPUT_MEASURED_NOSE_PARALLAX };`;
const vite = await createServer({ root, appType: "spa", configFile: false, logLevel: "error", define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("nose-parity-fixture"), __AEROBEAT_CACHE_BUST__: JSON.stringify("nose-parity-fixture"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("nose-parity-fixture") }, plugins: [{ name: "nose-parallax-parity-fixture", resolveId(id) { if (id === "/nose-parity-fixture.js") return "\0nose-parity-fixture"; }, load(id) { if (id === "\0nose-parity-fixture") return entry; } }], server: { host: "127.0.0.1", port: 0, hmr: false, fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] } } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0];
  assert.ok(url, "fixture Vite URL");
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ name: "phone portrait DPR3", width: 390, height: 844, dpr: 3 }, { name: "desktop landscape", width: 844, height: 390, dpr: 1 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.dpr });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.addScriptTag({ type: "module", content: 'import "/nose-parity-fixture.js";' });
      await page.waitForFunction(() => Boolean(window.__noseParityFixture), null, { timeout: 20000 });
      const evidence = await page.evaluate(async ({ width, height, dpr }) => {
        const f = window.__noseParityFixture;
        const storageValues = new Map();
        const storage = { getItem: key => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value) };
        const coordinator = new f.AeroGameSetupCoordinator({ storageFactory: () => storage, eventTarget: null });
        const defaultSetup = coordinator.getSnapshot();
        const historical = { ...defaultSetup, noseCameraParallaxEnabled: true, noseCameraRangeXWorldUnits: .55, noseCameraRangeYWorldUnits: .35 };
        storage.setItem(f.aeroGameSetupStorageKey, JSON.stringify(historical));
        const migratedCoordinator = new f.AeroGameSetupCoordinator({ storageFactory: () => storage, eventTarget: null });
        const migrated = migratedCoordinator.getSnapshot();
        const persisted = JSON.parse(storage.getItem(f.aeroGameSetupStorageKey));
        storage.setItem(f.aeroGameSetupStorageKey, JSON.stringify({ ...historical, noseCameraRangeYWorldUnits: .48 }));
        const customCoordinator = new f.AeroGameSetupCoordinator({ storageFactory: () => storage, eventTarget: null });
        const custom = customCoordinator.getSnapshot();
        const config = f.rendererGameplayVisualConfig({ ...defaultSetup, noseCameraParallaxEnabled: true });
        const offConfig = f.rendererGameplayVisualConfig(defaultSetup);
        const measured = (x, y, now = 1000, timestamp = 990) => f.sanitizedNoseCameraDeflection({ [f.INTERNAL_INPUT_MEASURED_NOSE_PARALLAX]: () => ({ calibrationId: "calibration", sourceIdentity: "source", measuredSourceFrameId: "frame", measurementTimestampMs: timestamp, xDeflection: x, yDeflection: y }) }, now, true);
        let now = 0;
        const canvas = document.createElement("canvas");
        document.body.replaceChildren(canvas);
        const renderer = f.createAeroPlayCanvasRenderer({ now: () => now });
        try {
          renderer.attach(canvas);
          renderer.resize({ widthCssPx: width, heightCssPx: height, devicePixelRatio: dpr });
          renderer.setEnvironmentVisible(false);
          renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
          await renderer.gameplayAssetLoadPromise;
          const assets = renderer.describe().gameplayAssets;
          const presentations = ["flow", "boxing_lanes", "boxing_spatial_grid"];
          const results = [];
          for (const presentation of presentations) {
            const target = presentation === "flow" ? { id: "fixture-flow", kind: "flow", hand: "left", family: "flow", cell: 5, cells: [], lane: null, beatCenterMs: 1000, direction: "right" } : { id: "fixture-boxing", kind: "punch", hand: "left", family: "straight", cell: presentation === "boxing_lanes" ? null : 5, cells: [], lane: "left", beatCenterMs: 1000 };
            const frame = deflection => ({ presentation, nowMs: 1000, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, targets: [target], cameraDeflection: deflection });
            const measure = (axis, elapsed, enabled = true) => {
              renderer.setGameplayVisualExperimentConfig(enabled ? config : offConfig);
              now += 1000;
              renderer.renderGameplayFrame(frame(measured(0, 0)));
              const origin = renderer.cameraEntity.getPosition().clone();
              const baseline = renderer.cameraEntity.camera.worldToScreen({ x: 0, y: 1, z: 0 });
              const deflection = axis === "x" ? measured(1, 0) : measured(0, 1);
              for (let t = 16; t <= elapsed; t += 16) { now += 16; renderer.renderGameplayFrame(frame(deflection)); }
              const position = renderer.cameraEntity.getPosition();
              const screen = renderer.cameraEntity.camera.worldToScreen({ x: 0, y: 1, z: 0 });
              return { worldX: position.x - origin.x, worldY: position.y - origin.y, screenX: screen.x - baseline.x, screenY: screen.y - baseline.y };
            };
            const early = [16, 48].map(t => ({ t, x: measure("x", t), y: measure("y", t) }));
            const steady = { x: measure("x", 640), y: measure("y", 640) };
            const off = measure("y", 640, false);
            // A real pinned GLB instance must be visible; geometry-only or blank-canvas evidence is invalid.
            const glbAssetId = presentation === "flow" ? "directional-arrow/rounded-outline-v1" : "any-note/outlined-circle-v1";
            const glb = renderer.assetPools.get(glbAssetId)?.find(entity => entity.enabled);
            const readback = new OffscreenCanvas(canvas.width, canvas.height);
            const ctx = readback.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(canvas, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let lit = 0;
            for (let i = 0; i < data.length; i += 40) if (data[i] > 50 || data[i + 1] > 50 || data[i + 2] > 50) lit++;
            results.push({ presentation, early, steady, off, glb: Boolean(glb), lit });
          }
          return { defaultSetup: { x: defaultSetup.noseCameraRangeXWorldUnits, y: defaultSetup.noseCameraRangeYWorldUnits, on: defaultSetup.noseCameraParallaxEnabled }, migrated: { x: migrated.noseCameraRangeXWorldUnits, y: migrated.noseCameraRangeYWorldUnits, persistedY: persisted.noseCameraRangeYWorldUnits }, customY: custom.noseCameraRangeYWorldUnits, config: { speedX: config.maximumHorizontalVelocityWorldUnitsPerSecond, speedY: config.maximumVerticalVelocityWorldUnitsPerSecond }, stale: measured(1, 1, 1000, 850), assets: assets?.state, canvas: [canvas.width, canvas.height], results, privacy: JSON.stringify(renderer.describe()).includes("measuredSourceFrameId") || JSON.stringify(renderer.describe()).includes("sourceIdentity") };
        } finally { renderer.destroy(); coordinator.destroy(); migratedCoordinator.destroy(); customCoordinator.destroy(); }
      }, { width: viewport.width, height: viewport.height, dpr: viewport.dpr });
      assert.deepEqual(errors, [], `${viewport.name}: browser startup must be clean`);
      assert.equal(evidence.assets, "ready", `${viewport.name}: pinned gameplay GLB preload`);
      assert.ok(evidence.canvas[0] > 0 && evidence.canvas[1] > 0, `${viewport.name}: real PlayCanvas surface`);
      assert.equal(evidence.stale.active, false, "150ms-old measured nose is rejected");
      assert.equal(evidence.privacy, false, "raw nose identities stay out of renderer public description");
      assert.equal(evidence.defaultSetup.on, false, "Nose defaults off");
      assert.equal(evidence.customY, .48, "custom Y setting survives migration");
      for (const row of evidence.results) {
        const label = `${viewport.name} ${row.presentation}`;
        assert.ok(row.glb && row.lit > 50, `${label}: pinned GLB and nonblank framebuffer required, got ${JSON.stringify({ glb: row.glb, lit: row.lit })}`);
        for (const sample of [...row.early, { t: 640, ...row.steady }]) {
          const { x, y } = sample;
          assert.ok(x.worldX > 0 && y.worldY < 0, `${label} ${sample.t}ms: +X moves camera right and +Y lowers it`);
          assert.ok(x.screenX < 0 && y.screenY < 0, `${label} ${sample.t}ms: +X moves scene left, lowered camera moves scene up: ${JSON.stringify({ x, y })}`);
          assert.ok(Math.abs(Math.abs(x.worldX) - Math.abs(y.worldY)) < .015, `${label} ${sample.t}ms: X/Y camera travel parity: ${JSON.stringify({ x, y })}`);
          assert.ok(Math.abs(Math.abs(x.screenX) - Math.abs(y.screenY)) < 4, `${label} ${sample.t}ms: X/Y projected scene travel parity: ${JSON.stringify({ x, y })}`);
        }
        assert.ok(Math.abs(row.off.worldX) < 1e-6 && Math.abs(row.off.worldY) < 1e-6, `${label}: disabled Nose never drifts`);
      }
      assert.ok(Math.abs(evidence.defaultSetup.x - evidence.defaultSetup.y) < 1e-9, `${viewport.name}: new setup X/Y range parity: ${JSON.stringify(evidence.defaultSetup)}`);
      assert.ok(Math.abs(evidence.migrated.x - evidence.migrated.y) < 1e-9 && evidence.migrated.persistedY === evidence.migrated.y, `${viewport.name}: old persisted .35 default migrates atomically: ${JSON.stringify(evidence.migrated)}`);
      console.log(`${viewport.name}: Flow, Boxing Lanes, Boxing Grid early/steady real GLB projections and setup migration passed`);
    } finally { await context.close(); }
  }
} finally { await browser?.close(); await vite.close(); }
