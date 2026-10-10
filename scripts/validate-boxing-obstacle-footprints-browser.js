// @ts-check
// Fresh v3 source -> public authoring/persistence -> content selection -> assembly projection
// -> pinned PlayCanvas wall GLB. Run: node scripts/validate-boxing-obstacle-footprints-browser.js
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// Optional disposable git-archive HEAD mirrors for same-fixture production counterfactuals.
// Normal invocation has no aliases and always consumes the checked-out public packages.
const oldAuthoring = process.env.AEROBEAT_BOXING_OLD_AUTHORING;
const oldRenderer = process.env.AEROBEAT_BOXING_OLD_RENDERER;
const mirrorAliases = [
  ...(oldAuthoring ? [{ find: /^@aerobeat\/web-content-authoring$/, replacement: fileURLToPath(new URL("src/index.js", `file://${oldAuthoring.replace(/\/$/, "")}/`)) }] : []),
  ...(oldRenderer ? [{ find: /^@aerobeat\/web-renderer$/, replacement: fileURLToPath(new URL("src/index.js", `file://${oldRenderer.replace(/\/$/, "")}/`)) }] : []),
];
const entry = `import { createAeroWebContentAuthoringService } from "@aerobeat/web-content-authoring";
import { createAeroContentRuntime } from "@aerobeat/web-content";
import { createAeroPlayCanvasRenderer, defaultRendererTuning } from "@aerobeat/web-renderer";
import { createSessionTargetIndex, projectSessionTargets } from "/src/session-render-projection.js";
window.__boxingFootprints = { createAeroWebContentAuthoringService, createAeroContentRuntime, createAeroPlayCanvasRenderer, defaultRendererTuning, createSessionTargetIndex, projectSessionTargets };`;
const vite = await createServer({ root, appType: "spa", configFile: false, logLevel: "error", resolve: { alias: mirrorAliases }, define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("boxing-footprints-fixture"), __AEROBEAT_CACHE_BUST__: JSON.stringify("boxing-footprints-fixture"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("boxing-footprints-fixture") }, plugins: [{ name: "boxing-footprints-fixture", resolveId(id) { if (id === "/boxing-footprints-fixture.js") return "\0boxing-footprints-fixture"; }, load(id) { if (id === "\0boxing-footprints-fixture") return entry; } }], server: { host: "127.0.0.1", port: 0, hmr: false, fs: { allow: [fileURLToPath(new URL("../../", import.meta.url)), ...(oldAuthoring ? [oldAuthoring] : []), ...(oldRenderer ? [oldRenderer] : [])] } } });
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
    page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.addScriptTag({ type: "module", content: 'import "/boxing-footprints-fixture.js";' });
      await page.waitForFunction(() => Boolean(window.__boxingFootprints) || Boolean(window.__boxingFootprintsError), null, { timeout: 20000 });
      assert.deepEqual(errors, [], `${viewport.name}: module import errors`);
      const evidence = await page.evaluate(async ({ width, height, dpr }) => {
        const f = window.__boxingFootprints;
        const bytes = value => new TextEncoder().encode(JSON.stringify(value));
        const sourceObstacles = [
          { b: 2, d: .8, x: 0, y: 2, w: 4, h: 1 },
          { b: 12, d: .8, x: 2, y: 0, w: 2, h: 3 },
          { b: 22, d: .8, x: 0, y: 0, w: 2, h: 3 },
        ];
        const map = bytes({ version: "3.3.0", colorNotes: [{ b: 30, x: 1, y: 1, c: 0, d: 0 }], bombNotes: [], obstacles: sourceObstacles, sliders: [], burstSliders: [] });
        const entries = new Map([["info.dat", bytes({})], ["hard.dat", map], ["song.ogg", new Uint8Array([1, 2, 3])]]);
        const source = {
          manifest: { schemaId: "aerobeat.beatsaver-source-manifest.v2", infoFormatMajor: 2, infoFormat: "v2", infoVersion: "2.1.0", infoPath: "Info.dat", hashInputPaths: ["Hard.dat"], songName: "Fresh Boxing Footprints", songSubName: "", songAuthorName: "", levelAuthorName: "", audioPath: "song.ogg", coverPath: "", bpm: 120, previewStartSeconds: 0, previewDurationSeconds: 0, difficulties: [{ characteristic: "Standard", difficulty: "Hard", difficultyRank: 5, path: "Hard.dat", beatMapFormatMajor: 3, beatMapFormat: "v3", beatMapVersion: "3.3.0", notePalette: null, noteJumpMovementSpeed: 10, noteJumpStartBeatOffset: 0 }], entries: [], archiveBytes: 0, expandedBytes: 0 },
          listEntryPaths() { return ["Info.dat", "Hard.dat", "song.ogg"]; },
          readEntry(path) { return Uint8Array.from(entries.get(path.toLowerCase())); },
        };
        const authoring = f.createAeroWebContentAuthoringService();
        const runtime = f.createAeroContentRuntime({ persistenceResolver: authoring });
        const canvas = document.createElement("canvas");
        document.body.replaceChildren(canvas);
        const renderer = f.createAeroPlayCanvasRenderer();
        try {
          const imported = await authoring.convertAndPersist({ source }, { difficulty: "Hard", sourceId: "fresh-boxing-footprints", sourceVersionHash: "v1", includeAudio: true, cacheSourceEntries: true, converterSettings: { uppercutOppositeLane: false, anyOppositeLane: true } });
          await runtime.loadPersistenceHandle(imported.handle);
          const boxing = runtime.getSnapshot().variants.find(item => item.mode === "boxing");
          if (!boxing) throw Error("No imported Boxing variant");
          await runtime.selectVariant(boxing.variantId);
          const events = runtime.getSnapshot().resolvedEvents;
          const obstacles = events.filter(event => ["squat", "weave_left", "weave_right"].includes(event.authoredBeat?.type));
          renderer.attach(canvas);
          renderer.tuning = { ...f.defaultRendererTuning, dprCap: 3 };
          renderer.resize({ widthCssPx: width, heightCssPx: height, devicePixelRatio: dpr });
          renderer.setEnvironmentVisible(false);
          renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
          await renderer.gameplayAssetLoadPromise;
          const loader = renderer.describe().gameplayAssets?.state;
          const index = f.createSessionTargetIndex(events);
          const sample = () => {
            const copy = new OffscreenCanvas(canvas.width, canvas.height);
            const ctx = copy.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(canvas, 0, 0);
            return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          };
          const aabb = entity => {
            const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
            entity.forEach(child => { for (const mesh of child.render?.meshInstances ?? []) { const box = mesh.aabb; if (!box) continue; for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], box.getMin()[["x", "y", "z"][i]]); max[i] = Math.max(max[i], box.getMax()[["x", "y", "z"][i]]); } } });
            return { min, max };
          };
          const proof = [];
          for (const presentation of ["boxing_lanes", "boxing_collider", "flow"]) {
            for (const event of obstacles) {
              const type = event.authoredBeat.type;
              const geometry = event.authoredBeat.gameplayGeometry;
              const nowMs = (event.intervalStartTimestampMs + event.intervalEndTimestampMs) / 2;
              const projected = f.projectSessionTargets(events, { selectedVariant: runtime.getSnapshot().selectedVariant, session: { purpose: "play" }, judgements: [], obstacleOutcomes: [] }, nowMs, index);
              const target = projected.find(item => item.id === event.eventId);
              if (!target) throw Error(`${presentation} ${type}: assembly projection omitted imported obstacle`);
              const frame = targets => ({ presentation, nowMs, targets, timingWindowBeforeMs: 180, timingWindowAfterMs: 180, rowReach: { topRowReachWU: .5, bottomRowReachWU: .25 }, hazardContacts: [] });
              renderer.renderGameplayFrame(frame([]));
              const off = sample();
              renderer.renderGameplayFrame(frame([target]));
              const on = sample();
              const wall = renderer.lastModel.objects.find(item => item.kind === "obstacle" && item.targetId === event.eventId);
              const glb = renderer.assetPools.get("wall/red-glass-v1")?.find(entity => entity.enabled);
              if (!wall || !glb) throw Error(`${presentation} ${type}: pinned wall GLB not active`);
              const box = aabb(glb);
              // Project local on/off deltas into the actual device-pixel framebuffer;
              // the safe side must stay dark while the extra squat height/second weave column lights up.
              const screen = (x, y, z = 0) => { const q = renderer.cameraEntity.camera.worldToScreen({ x, y, z }); return { x: q.x, y: q.y }; };
              const roi = (x, y, z = 0, radius = 9) => {
                const projected = screen(x, y, z);
                const p = { x: projected.x * (canvas.width / width), y: projected.y * (canvas.height / height) };
                let hits = 0, total = 0;
                for (let py = Math.max(0, Math.floor(p.y - radius * dpr)); py <= Math.min(canvas.height - 1, Math.ceil(p.y + radius * dpr)); py += 2)
                  for (let px = Math.max(0, Math.floor(p.x - radius * dpr)); px <= Math.min(canvas.width - 1, Math.ceil(p.x + radius * dpr)); px += 2) {
                    const i = (py * canvas.width + px) * 4;
                    if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 30) hits++;
                    total++;
                  }
                return { hits, total, screen: p };
              };
              // The outer center of the second blocked column avoids the near-plane glass
              // border. Compare to the mirrored, genuinely unblocked half.
              const blockedX = type === "weave_left" ? 1 : -1;
              const safeX = -blockedX;
              proof.push({ presentation, type, geometry, source: event.authoredBeat.sourceGeometry, mask: target.cells, wall: { position: wall.position, scale: wall.scale, assetId: wall.assetId }, aabb: box, canvas: [canvas.width, canvas.height], loader, high: roi(0, 3.2), half: roi(0, 1.25), top: roi(0, 2), blockedSecond: roi(blockedX * 1.45, 1), safe: roi(safeX * 1.45, 1) });
            }
          }
          return { emitted: obstacles.length, proof };
        } finally { renderer.destroy(); runtime.destroy(); authoring.destroy(); }
      }, viewport);
      assert.deepEqual(errors, [], `${viewport.name}: page errors`);
      assert.equal(evidence.emitted, 3, `${viewport.name}: all three obstacles survive four-second cooldown`);
      for (const row of evidence.proof) {
        const label = `${viewport.name} ${row.presentation} ${row.type}`;
        assert.equal(row.loader, "ready", `${label}: pinned GLB loader ready`);
        assert.deepEqual(row.canvas, [viewport.width * viewport.dpr, viewport.height * viewport.dpr], `${label}: active DPR canvas`);
        assert.equal(row.wall.assetId, "wall/red-glass-v1", `${label}: canonical pinned wall GLB`);
        assert.ok(row.aabb.min.every(Number.isFinite) && row.aabb.max.every(Number.isFinite), `${label}: actual wall GLB mesh AABB`);
        assert.deepEqual(row.source && [row.source.x, row.source.y, row.source.width, row.source.height], row.type === "squat" ? [0, 2, 4, 1] : row.type === "weave_left" ? [2, 0, 2, 3] : [0, 0, 2, 3], `${label}: fresh v3 source dimensions remain unmodified`);
        const expected = row.type === "squat" ? { x: 0, y: -3, width: 4, height: 4.5, mask: [0, 1, 2, 3] } : row.type === "weave_left" ? { x: 2, y: 0, width: 2, height: 3, mask: [2, 3, 6, 7, 10, 11] } : { x: 0, y: 0, width: 2, height: 3, mask: [0, 1, 4, 5, 8, 9] };
        assert.deepEqual(row.mask, expected.mask, `${label}: imported blocked grid mask`);
        for (const key of ["x", "y", "width", "height"]) assert.equal(row.geometry[key], expected[key], `${label}: newly imported ${row.type} ${key}`);
        assert.ok(Math.abs((row.aabb.max[1] - row.aabb.min[1]) - (expected.height - .06)) < .2, `${label}: pinned wall GLB AABB height ${JSON.stringify(row.aabb)}`);
        assert.ok(Math.abs((row.aabb.max[0] - row.aabb.min[0]) - (expected.width - .06)) < .2, `${label}: pinned wall GLB AABB width ${JSON.stringify(row.aabb)}`);
        if (row.type === "squat") {
          assert.ok(row.high.hits > 20 && row.half.hits > 20 && row.top.hits > 20, `${label}: wall-on/off framebuffer must occupy above-top and second-row upper-half ROIs: ${JSON.stringify({ high: row.high, half: row.half, top: row.top })}`);
        } else {
          assert.ok(row.blockedSecond.hits > 20, `${label}: second blocked weave column has framebuffer coverage: ${JSON.stringify({ blockedSecond: row.blockedSecond, aabb: row.aabb, wall: row.wall })}`);
          assert.ok(row.safe.hits < row.blockedSecond.hits / 3, `${label}: safe-side negative pixel ROI: ${JSON.stringify({ blocked: row.blockedSecond, safe: row.safe })}`);
        }
      }
      console.log(`${viewport.name}: ${evidence.proof.length} imported Boxing Lanes/Collider and Flow GLB footprint states PASS`);
    } finally { await context.close(); }
  }
} finally { await browser?.close(); await vite.close(); }
