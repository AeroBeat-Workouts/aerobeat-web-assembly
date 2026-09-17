// @ts-check
// 0.0.60 W1 (F1) DEBUG 3 — inspect the aftermath entity's materials in-page:
// per mesh-instance material name, role mapping, diffuse, and which parts exist.
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(childUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("aero-game");
  await page.waitForFunction(() => document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state === "ready", { timeout: 20000 });
  const report = await page.evaluate(async () => {
    const game = document.querySelector("aero-game");
    const renderer = game.graph.renderer;
    game.stopFrameLoop();
    game.setMenuOpen(false);
    renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
    renderer.setEnvironmentVisible(false);
    renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
    const nowMs = 6040;
    const base = { presentation: "flow", nowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180 };
    // ONE flow slice corpse (pale color) + ONE punch whole corpse (saturated) — inspect both.
    const entryFlow = Object.freeze({ targetId: "probe-flow", hitCommitMs: 6000, family: "flow", hand: "left", mode: "slice", spawn: { x: 0, y: 1.4, z: 0 }, seed: 1234, shape: "orb", appearanceColor: "#A8C8E8" });
    const entryPunch = Object.freeze({ targetId: "probe-punch", hitCommitMs: 6000, family: "punch", hand: "left", mode: "straight", spawn: { x: 0, y: 0.8, z: 0 }, seed: 999, shape: "orb", appearanceColor: "#FF3355" });
    renderer.renderGameplayFrame({ ...base, aftermath: [entryFlow, entryPunch] });
    // scene model: which objects + assetIds?
    const sm = await import("/node_modules/@aerobeat/web-renderer/src/gameplay-scene-model.js");
    const model = sm.buildGameplaySceneModel({ ...base, aftermath: [entryFlow, entryPunch] });
    const corpseObjects = model.objects.filter((o) => o.kind === "aftermath").map((o) => ({ id: o.id, role: o.role, assetId: o.assetId, appearance: o.appearanceColor }));
    // entity materials in the live scene graph:
    const dumpMaterials = (root, namePrefix) => {
      const found = [];
      const walk = (e) => {
        if (e.name.startsWith(namePrefix)) {
          for (const comp of e.findComponents("render")) {
            for (const mi of comp.meshInstances ?? []) {
              const m = mi.material;
              found.push({ entity: e.name, mesh: mi.mesh?.name ?? "?", materialName: m.name, diffuse: [m.diffuse?.r, m.diffuse?.g, m.diffuse?.b].map((v) => Number(v.toFixed(3))), opacity: m.opacity, blendType: m.blendType });
            }
          }
        }
        for (const c of e.children ?? []) walk(c);
      };
      walk(root);
      return found;
    };
    const flowMats = dumpMaterials(renderer.app.root, "probe-flow");
    const punchMats = dumpMaterials(renderer.app.root, "probe-punch");
    // role mapping for the orb asset:
    const ga = await import("/node_modules/@aerobeat/web-renderer/src/gameplay-assets.js");
    const roleFor = (matName) => ga.gameplayAssetMaterialRole("any-note/outlined-circle-v1", matName);
    return { corpseObjects, flowMats, punchMats, roleProbe: { "mat/white": roleFor("mat/white"), "mat/charcoal": roleFor("mat/charcoal"), "mat/tint_base": roleFor("mat/tint_base"), "Mat/white": roleFor("Mat/white") } };
  });
  const compact = (m) => `${m.entity} :: ${m.materialName} :: rgb(${m.diffuse.map(v=>Math.round(v*255)).join(",")}) op=${m.opacity}`;
console.log("FLOW:"); for (const m of report.flowMats) console.log("  " + compact(m));
console.log("PUNCH:"); for (const m of report.punchMats) console.log("  " + compact(m));
console.log("roleProbe:", JSON.stringify(report.roleProbe));
console.log("corpseObjects:", JSON.stringify(report.corpseObjects, null, 1));
  await context.close();
} finally {
  await browser.close();
  await vite.close();
}
