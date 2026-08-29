// @ts-check

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const mapId = "53F26";
const versionHash = "addd9d6f8e7340ad6f5633947136d8475a7a99b5";
const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", optimizeDeps: { force: true }, server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const pageUrl = vite.resolvedUrls?.local?.[0];
if (!pageUrl) throw new Error("Vite URL unavailable");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const noise = [];
page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
await page.addInitScript(() => {
  globalThis.__liveV4CameraRequests = 0; globalThis.__liveV4Events = [];
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { async getUserMedia() { globalThis.__liveV4CameraRequests += 1; throw new Error("Live v4 import must not request camera"); } } });
  addEventListener("aero-game-event", (event) => globalThis.__liveV4Events.push(structuredClone(event.detail)));
});
let importedHandle;
try {
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  const game = page.locator("aero-game"); await game.waitFor();
  const evidence = await game.evaluate(async (element, fixture) => {
    const map = await element.graph.vendor.getMapById(fixture.mapId, { signal: element.activeAbort.signal });
    const exact = map.versions.find((version) => version.hash === fixture.versionHash);
    if (!exact) throw new Error(`BeatSaver ${fixture.mapId} no longer exposes exact version ${fixture.versionHash}`);
    const result = await element.importBeatSaver(map, fixture.versionHash, { difficulty: "ExpertPlus", sourceId: fixture.mapId });
    const packages = await element.graph.authoring.listPackages(); const content = element.graph.content.getSnapshot(); const snapshot = element.getSnapshot();
    const rawExposure = []; const seen = new WeakSet(); const visit = (value, path = "root") => { if (!value || typeof value !== "object" || seen.has(value)) return; seen.add(value); const ctor = value.constructor?.name ?? "Object"; if (["ArrayBuffer","Uint8Array","Blob","File","MediaStream","VideoFrame"].includes(ctor)) rawExposure.push(`${path}:${ctor}`); for (const [key, child] of Object.entries(value)) { if (/zipBytes|audioBytes|rawBytes|pixels|screenshots/iu.test(key)) rawExposure.push(`${path}.${key}`); visit(child, `${path}.${key}`); } };
    [snapshot, result, ...globalThis.__liveV4Events].forEach((value, index) => visit(value, `value${index}`));
    return { handle: result.handle, resultSourceHash: result.package.source.sourceVersionHash, packageCount: packages.length, persisted: packages.some((entry) => entry.packageId === result.handle.packageId && entry.key === result.handle.key), contentState: content.state, selectedPackageId: content.packageId, selectedVariantId: content.selectedVariant?.variantId, variantCount: content.variants.length, lineageHash: content.lineage?.sourceVersionHash, cameraRequests: globalThis.__liveV4CameraRequests, rawExposure, snapshotText: JSON.stringify(snapshot) };
  }, { mapId, versionHash });
  importedHandle = evidence.handle;
  assert.equal(evidence.resultSourceHash, versionHash); assert.equal(evidence.lineageHash, versionHash); assert.equal(evidence.packageCount, 1); assert.equal(evidence.persisted, true); assert.equal(evidence.contentState, "ready"); assert.ok(evidence.selectedPackageId); assert.ok(evidence.selectedVariantId); assert.ok(evidence.variantCount >= 5); assert.equal(evidence.cameraRequests, 0); assert.deepEqual(evidence.rawExposure, []); assert.doesNotMatch(evidence.snapshotText, /production.?winner|"winner"\s*:/iu); assert.deepEqual(noise, []);
  console.log(`Live assembly v4 import passed: map=${mapId} hash=${versionHash} package=${evidence.selectedPackageId} variants=${evidence.variantCount} rawExposure=0 cameraRequests=0`);
} finally {
  if (importedHandle) { try { await page.locator("aero-game").evaluate((element, handle) => element.deletePackage(handle), importedHandle); } catch { /* ephemeral browser context is the final cleanup boundary */ } }
  await browser.close(); await vite.close();
}
