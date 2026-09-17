// @ts-check
// 0.0.60 W1 (F1) DEBUG — full-frame dumps: baseline (no aftermath) vs one case (flow #2693FF).
// Diagnoses why the sweep crops show the track instead of the corpse.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const SCRIPTS_DIR = dirname(new URL(import.meta.url).pathname);
const EVIDENCE_DIR = join(SCRIPTS_DIR, "..", ".plans", "evidence");
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
  const proof = await page.evaluate(async () => {
    const game = document.querySelector("aero-game");
    const renderer = game.graph.renderer;
    game.stopFrameLoop();
    game.setMenuOpen(false);
    renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
    renderer.setEnvironmentVisible(false);
    renderer.setBackgroundProjection({ kind: "solid", colors: ["#071426"], angleDeg: 180 });
    const canvas = game.shadowRoot.querySelector("canvas");
    const dump = (name) => {
      const sample = new OffscreenCanvas(canvas.width, canvas.height);
      sample.getContext("2d", { willReadFrequently: true }).drawImage(canvas, 0, 0);
      return sample.convertToBlob({ type: "image/png" }).then((blob) => new Promise((res) => {
        const fr = new FileReader();
        fr.onloadend = () => res(fr.result);
        fr.readAsDataURL(blob);
      })).then((dataUrl) => { window.__dumps ??= {}; window.__dumps[name] = dataUrl; return dataUrl.length; });
    };
    const nowMs = 6040;
    const base = { presentation: "flow", nowMs, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180 };
    // sequence: baseline, then case, then baseline again, then case again (state stability check).
    renderer.renderGameplayFrame({ ...base, aftermath: [] });
    await dump("1-baseline-first");
    const entry = Object.freeze({ targetId: "dbg", hitCommitMs: 6000, family: "flow", hand: "left", mode: "slice", spawn: { x: 0, y: 1, z: 0 }, seed: 1234, shape: "orb", appearanceColor: "#2693FF" });
    renderer.renderGameplayFrame({ ...base, aftermath: [entry] });
    await dump("2-case-first");
    renderer.renderGameplayFrame({ ...base, aftermath: [] });
    await dump("3-baseline-second");
    renderer.renderGameplayFrame({ ...base, aftermath: [entry] });
    await dump("4-case-second");
    // scene-model introspection: what objects does the last frame contain?
    const model = renderer.describe?.();
    const lastScene = (() => { try { const m = renderer.lastSceneModel ?? renderer.sceneModel ?? null; return m ? m.objects.map((o) => `${o.kind}:${o.id}`) : "no-lastSceneModel-accessor"; } catch (e) { return `introspect-failed:${String(e).slice(0, 100)}`; } })();
    return { dumps: window.__dumps, describeKeys: model ? Object.keys(model).slice(0, 20) : null, lastScene: Array.isArray(lastScene) ? lastScene : [lastScene] };
  });
  for (const [name, dataUrl] of Object.entries(proof.dumps)) {
    const buf = Buffer.from(dataUrl.split(",")[1], "base64");
    writeFileSync(join(EVIDENCE_DIR, `debug-corpse-${name}.png`), buf);
    console.log(`dumped ${name} (${buf.length} bytes)`);
  }
  console.log("describeKeys:", JSON.stringify(proof.describeKeys));
  console.log("lastScene:", JSON.stringify(proof.lastScene));
  await context.close();
} finally {
  await browser.close();
  await vite.close();
}
