// @ts-check

import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const mapId = "1AE3A";
const versionHash = "1348bac90dd94d7299bda388bd101a2b967e28b3";
const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await vite.listen(); const url = vite.resolvedUrls?.local?.[0]; if (!url) throw new Error("Vite URL unavailable");
const browser = await chromium.launch(); const noise = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
  await page.goto(url, { waitUntil: "networkidle" }); const game = page.locator("aero-game"); await game.waitFor();
  const result = await game.evaluate(async (element, fixture) => {
    const preview = element.shadowRoot.querySelector("audio[data-role='preview']");
    Object.defineProperty(preview, "play", { configurable: true, value() { queueMicrotask(() => preview.dispatchEvent(new Event("playing"))); return Promise.resolve(); } }); Object.defineProperty(preview, "pause", { configurable: true, value() {} }); Object.defineProperty(preview, "load", { configurable: true, value() {} });
    const imported = await element.importBeatSaverById(fixture.mapId, fixture.versionHash, { sourceId: fixture.mapId });
    const authoringCollections = await element.graph.authoring.listCollections(); const packages = await element.graph.authoring.listPackages();
    const library = element.shadowRoot.querySelector("aero-content-library"); const difficulty = library.shadowRoot.querySelector("select[data-intent='library-difficulty-select']");
    const firstPackageId = difficulty.options[0].value; const secondPackageId = difficulty.options[1].value;
    await element.toggleLibraryPreview(firstPackageId); const firstPreview = { state: element.previewView.state, packageId: element.previewView.packageId }; element.stopPreview();
    const currentDifficulty = library.shadowRoot.querySelector("select[data-intent='library-difficulty-select']");
    currentDifficulty.value = secondPackageId; currentDifficulty.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    const deadline = performance.now() + 20_000; while (element.graph.content.getSnapshot().packageId !== secondPackageId && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    await element.toggleLibraryPreview(secondPackageId); const secondPreview = { state: element.previewView.state, packageId: element.previewView.packageId }; element.stopPreview();
    const publicText = JSON.stringify(element.getSnapshot());
    return { resultPackages: imported.packages.map((entry) => entry.difficultyId), collectionCount: authoringCollections.length, collectionPackages: authoringCollections[0]?.packages.length, packageCount: packages.length, chartCounts: await Promise.all(imported.packages.map(async (entry) => (await element.graph.authoring.loadPackage(entry.handle)).package.charts.length)), songRadios: library.shadowRoot.querySelectorAll("input[data-intent='library-select']").length, difficultyOptions: [...difficulty.options].map((option) => option.textContent), firstPreview, secondPreview, selectedPackageId: element.libraryView.selectedPackageId, cameraState: element.graph.video.describeStatus().state, publicLeak: /blob:|Uint8Array|ArrayBuffer|audioBytes|zipBytes|rawBytes|previewUrl/iu.test(publicText) };
  }, { mapId, versionHash });
  assert(JSON.stringify(result.resultPackages) === JSON.stringify(["Expert", "ExpertPlus"]), `Catalyst package order mismatch: ${JSON.stringify(result)}`);
  assert(result.collectionCount === 1 && result.collectionPackages === 2 && result.packageCount === 2 && result.chartCounts.every((count) => count === 5), `Catalyst atomic collection mismatch: ${JSON.stringify(result)}`);
  assert(result.songRadios === 1 && JSON.stringify(result.difficultyOptions) === JSON.stringify(["Expert", "ExpertPlus"]), `Catalyst compact grouping mismatch: ${JSON.stringify(result)}`);
  assert(result.firstPreview.state === "playing" && result.secondPreview.state === "playing" && result.firstPreview.packageId !== result.secondPreview.packageId && result.selectedPackageId === result.secondPreview.packageId, `Catalyst exact previews failed: ${JSON.stringify(result)}`);
  assert(result.cameraState !== "streaming" && !result.publicLeak && noise.length === 0, `Catalyst privacy/no-camera validation failed: ${JSON.stringify({ result, noise })}`);
  console.log(`Live Catalyst ${mapId}/${versionHash}: one row, Expert + ExpertPlus, 10 charts, exact Preview/Stop, no camera or public media.`);
} finally { await browser.close(); await vite.close(); }
function assert(value, message) { if (!value) throw new Error(message); }
