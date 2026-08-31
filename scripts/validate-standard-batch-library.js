// @ts-check

import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const url = vite.resolvedUrls?.local?.[0];
if (!url) throw new Error("Vite URL unavailable");
const browser = await chromium.launch();
const noise = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  const game = page.locator("aero-game"); await game.waitFor();
  const evidence = await game.evaluate(async (element) => {
    const hash = "a".repeat(64);
    const variant = (packageId, id, modifiers = []) => ({ variantId: `${packageId}-${id}`, chartId: `${packageId}-${id}-chart`, mode: id === "flow" ? "flow" : "boxing", rulesetId: id === "flow" ? "flow_grid_v1" : id.startsWith("semantic") ? "boxing_semantic_track_v1" : "boxing_spatial_grid_v1", recipeId: id === "flow" ? null : id.endsWith("row") ? "row_family_balanced_height_v1" : "cut_family_source_height_v1", modifierIds: modifiers, ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { baseVariantId: `${packageId}-${id}` } });
    const ready = (packageId, selectedId = "flow", modifiers = []) => { const variants = ["flow", "semantic-row", "spatial-row", "semantic-cut", "spatial-cut"].map((id) => variant(packageId, id, id === selectedId ? modifiers : [])); return { state: "ready", packageId, selectedVariant: variants.find((item) => item.variantId === `${packageId}-${selectedId}`), variants, resolvedEvents: [], song: { name: packageId }, background: null, lineage: { difficulty: packageId } }; };
    const state = { content: ready("package-a", "semantic-row", ["no_squats"]), loads: [], selections: [], reads: [], exports: [], deletes: [], resolveA: () => undefined, aStarted: false, stalePackageId: "", listCalls: 0 };
    const aGate = new Promise((resolve) => { state.resolveA = () => resolve(undefined); });
    const original = element.graph;
    const content = { ...original.content, getSnapshot: () => state.content, async loadPersistenceHandle(handle) { state.loads.push(`content:${handle.packageId}`); state.content = ready(handle.packageId); }, async selectVariant(variantId, options = {}) { state.selections.push({ variantId, modifierIds: [...(options.modifierIds ?? [])] }); const selected = state.content.variants.find((item) => item.variantId === variantId); state.content = { ...state.content, selectedVariant: selected ? { ...selected, modifierIds: [...(options.modifierIds ?? [])] } : null }; }, async swapFutureVariant(variantId, options) { return this.selectVariant(variantId, options); }, setPlaybackState() {}, readAsset(path) { state.reads.push({ packageId: state.content.packageId, path }); return new Uint8Array([79, 103, 103, 83]); } };
    const packages = ["expert", "expertplus", "a", "b", "c"].map((id, index) => ({ key: `key-${id}`, packageId: `package-${id}`, songName: id === "expert" || id === "expertplus" ? "The Catalyst" : "Rapid", difficulty: id, createdAtMs: index + 1 }));
    const collections = [
      { collectionId: "collection-catalyst", songName: "The Catalyst", packages: [{ packageKey: "key-expert", packageId: "package-expert", difficultyId: "Expert", difficultyLabel: "Expert" }, { packageKey: "key-expertplus", packageId: "package-expertplus", difficultyId: "ExpertPlus", difficultyLabel: "ExpertPlus" }] },
      { collectionId: "collection-rapid", songName: "Rapid", packages: ["a", "b", "c"].map((id) => ({ packageKey: `key-${id}`, packageId: `package-${id}`, difficultyId: id.toUpperCase(), difficultyLabel: id.toUpperCase() })) }
    ];
    const authoring = { ...original.authoring, async listPackages() { state.listCalls += 1; return packages; }, async listCollections() { return collections; }, async estimateStorage() { return { usageBytes: 4, quotaBytes: 1024 }; }, async loadPackage(handle) { state.loads.push(`authoring:${handle.packageId}`); if (handle.packageId === state.stalePackageId) { const error = new Error("unbounded storage detail must not be exposed ".repeat(100)); Object.assign(error, { code: "flow_orientation_reimport_required" }); throw error; } if (handle.packageId === "package-a" && !state.aStarted) { state.aStarted = true; await aGate; } return { handle: { key: handle.key, packageId: handle.packageId }, package: {} }; }, async exportPackage(handle) { state.exports.push(handle.packageId); return { fileName: `${handle.packageId}.aeropkg`, mediaType: "application/octet-stream", byteLength: 1, bytes: new Uint8Array([1]) }; }, async deleteCollection(id) { state.deletes.push(id); return true; } };
    element.graph = Object.freeze({ ...original, authoring: Object.freeze(authoring), content: Object.freeze(content) });
    state.content = ready("package-mode", "semantic-row"); element.lastBoxingRecipeId = "row_family_balanced_height_v1";
    const commitIntent = async (type, payload) => { const before = state.selections.length; element.handleUiIntent(new CustomEvent("aero-ui-intent", { detail: { type, payload } })); for (let index = 0; index < 20 && state.selections.length === before; index += 1) await Promise.resolve(); };
    const modeEvidence = [];
    await commitIntent("boxing-conversion-select", { recipeId: "cut_family_source_height_v1" }); modeEvidence.push(state.content.selectedVariant.variantId);
    await commitIntent("gameplay-mode-select", { rulesetId: "flow_grid_v1" }); modeEvidence.push(state.content.selectedVariant.variantId); const flowFrame = element.rendererFrame();
    element.handleUiIntent(new CustomEvent("aero-ui-intent", { detail: { type: "boxing-conversion-select", payload: { recipeId: "row_family_balanced_height_v1" } } })); await Promise.resolve(); modeEvidence.push(state.content.selectedVariant.variantId);
    await commitIntent("gameplay-mode-select", { rulesetId: "boxing_spatial_grid_v1" }); modeEvidence.push(state.content.selectedVariant.variantId); const gridFrame = element.rendererFrame();
    await commitIntent("boxing-conversion-select", { recipeId: "cut_family_source_height_v1" }); modeEvidence.push(state.content.selectedVariant.variantId);
    await commitIntent("gameplay-mode-select", { rulesetId: "boxing_semantic_track_v1" }); modeEvidence.push(state.content.selectedVariant.variantId); const laneFrame = element.rendererFrame(); element.renderPresenters(); const selectedProfileId = element.shadowRoot.querySelector("aero-prototype-selector[scope='gameplay']")?.presenterSnapshot?.selectedProfileId;
    let getterCalls = 0; const hostilePayload = {}; Object.defineProperty(hostilePayload, "rulesetId", { enumerable: true, get() { getterCalls += 1; return "flow_grid_v1"; } }); element.handleUiIntent(new CustomEvent("aero-ui-intent", { detail: { type: "gameplay-mode-select", payload: hostilePayload } })); const scalarRejection = { getterCalls, code: element.lastError?.code, selected: state.content.selectedVariant.variantId }; element.lastError = null;
    const gameplayAxes = { modeEvidence, selectedProfileId, flowFrame, gridFrame, laneFrame, scalarRejection };
    state.content = ready("package-a", "semantic-row", ["no_squats"]);
    await element.refreshLibrary();
    element.librarySelectionGeneration += 1;
    state.content = ready("package-a", "semantic-row", ["no_squats"]);
    const first = element.requestLibrarySelection("collection-rapid", "package-a");
    while (!state.aStarted) await new Promise((resolve) => setTimeout(resolve, 0));
    const second = element.requestLibrarySelection("collection-rapid", "package-b");
    const third = element.requestLibrarySelection("collection-rapid", "package-c");
    state.resolveA();
    await Promise.allSettled([first, second, third]);
    const latest = { packageId: state.content.packageId, desiredPackageId: element.libraryView.selectedPackageId, loads: [...state.loads], selection: state.selections.at(-1) };
    element.libraryView = { ...element.libraryView, collections: element.libraryView.collections.filter((item) => item.collectionId === "collection-catalyst"), songs: element.libraryView.songs.filter((item) => item.collectionId === "collection-catalyst"), selectedCollectionId: "collection-catalyst", selectedPackageId: "package-expert" };
    element.renderPresenters();
    const library = element.shadowRoot.querySelector("aero-content-library"); const difficulty = library.shadowRoot.querySelector("select[data-intent='library-difficulty-select']");
    const grouped = { songRadios: library.shadowRoot.querySelectorAll("input[data-intent='library-select']").length, difficultyOptions: difficulty?.options.length ?? 0, labels: difficulty ? [...difficulty.options].map((option) => option.textContent) : [] };
    const rapid = collections[1]; element.libraryView = { ...element.libraryView, collections: [{ collectionId: rapid.collectionId, songName: rapid.songName, activePackageId: "package-c", difficulties: rapid.packages.map((item) => ({ packageKey: item.packageKey, packageId: item.packageId, difficultyId: item.difficultyId, label: item.difficultyLabel })) }], songs: [{ collectionId: rapid.collectionId, songName: rapid.songName, activePackageId: "package-c", difficulties: rapid.packages.map((item) => ({ packageId: item.packageId, difficultyId: item.difficultyId, label: item.difficultyLabel })) }], selectedCollectionId: rapid.collectionId, selectedPackageId: "package-c" };
    element.desiredLibrarySelection = { collectionId: rapid.collectionId, packageId: "package-c", generation: element.librarySelectionGeneration };
    state.content = { ...state.content, song: { name: "Rapid", audio: { filePath: "song.ogg", contentHash: `sha256:${hash}` } } };
    const preview = element.shadowRoot.querySelector("audio[data-role='preview']"); Object.defineProperty(preview, "play", { configurable: true, value() { queueMicrotask(() => preview.dispatchEvent(new Event("playing"))); return Promise.resolve(); } }); Object.defineProperty(preview, "pause", { configurable: true, value() {} }); Object.defineProperty(preview, "load", { configurable: true, value() {} });
    await element.toggleLibraryPreview("package-c");
    const previewExact = { state: element.previewView.state, packageId: element.previewView.packageId, read: state.reads.at(-1) };
    element.stopPreview(); const nativeClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {}; await element.exportLibraryPackage({ packageKey: "key-c", packageId: "package-c" });
    const staleLoadsBefore = state.loads.filter((entry) => entry === "authoring:package-a").length; const staleListsBefore = state.listCalls; state.stalePackageId = "package-a";
    await element.requestLibrarySelection("collection-rapid", "package-a");
    const stale = { code: element.lastError?.code, message: element.lastError?.message, selectedCollectionId: element.libraryView.selectedCollectionId, selectedPackageId: element.libraryView.selectedPackageId, desired: element.desiredLibrarySelection, collectionCount: element.libraryView.collections.length, listCalls: state.listCalls - staleListsBefore, loadCalls: state.loads.filter((entry) => entry === "authoring:package-a").length - staleLoadsBefore };
    await element.exportLibraryPackage({ packageKey: "key-a", packageId: "package-a" });
    state.stalePackageId = ""; await element.refreshLibrary(element.connectedGeneration, { preferredCollectionId: "collection-rapid", preferredPackageId: "package-a" });
    const corrected = { packageId: state.content.packageId, selectedPackageId: element.libraryView.selectedPackageId, error: element.lastError };
    HTMLAnchorElement.prototype.click = nativeClick;
    await element.deleteLibraryCollection("collection-rapid");
    return { gameplayAxes, latest, grouped, previewExact, stale, corrected, exports: state.exports, deletes: state.deletes, publicText: JSON.stringify(element.getSnapshot()) };
  });
  assert(JSON.stringify(evidence.gameplayAxes.modeEvidence) === JSON.stringify(["package-mode-semantic-cut","package-mode-flow","package-mode-flow","package-mode-spatial-row","package-mode-spatial-cut","package-mode-semantic-cut"]), `mode/conversion intents must resolve the exact five-variant matrix and retain conversion independently of Flow: ${JSON.stringify(evidence.gameplayAxes)}`);
  assert(evidence.gameplayAxes.selectedProfileId === "semantic-cut", `selectedProfileId must project exact selected variant intent: ${JSON.stringify(evidence.gameplayAxes)}`);
  assert(evidence.gameplayAxes.flowFrame.presentation === "flow" && !("timingWindowBeforeMs" in evidence.gameplayAxes.flowFrame) && evidence.gameplayAxes.gridFrame.presentation === "boxing_spatial_grid" && !("timingWindowBeforeMs" in evidence.gameplayAxes.gridFrame), `Flow/Grid presentations must remain timing-scalar-free 4x3 frames: ${JSON.stringify(evidence.gameplayAxes)}`);
  assert(evidence.gameplayAxes.laneFrame.presentation === "boxing_lanes" && evidence.gameplayAxes.laneFrame.timingWindowBeforeMs === 180 && evidence.gameplayAxes.laneFrame.timingWindowAfterMs === 180, `lane frame must receive authoritative contract timing values: ${JSON.stringify(evidence.gameplayAxes.laneFrame)}`);
  assert(evidence.gameplayAxes.scalarRejection.getterCalls === 0 && evidence.gameplayAxes.scalarRejection.code === "assembly_error" && evidence.gameplayAxes.scalarRejection.selected === "package-mode-semantic-cut", `hostile/non-scalar UI payload must be rejected without access or selection: ${JSON.stringify(evidence.gameplayAxes.scalarRejection)}`);
  assert(evidence.latest.packageId === "package-c" && evidence.latest.desiredPackageId === "package-c", `latest desired package must win: ${JSON.stringify(evidence)}`);
  assert(!evidence.latest.loads.some((entry) => entry.includes("package-b")) && evidence.latest.loads.filter((entry) => entry === "content:package-c").length === 1, `stale B must skip and only C may commit content: ${JSON.stringify(evidence.latest)}`);
  assert(evidence.latest.selection?.variantId === "package-c-semantic-row" && JSON.stringify(evidence.latest.selection.modifierIds) === JSON.stringify(["no_squats"]), `equivalent presentation and modifiers must survive: ${JSON.stringify(evidence.latest)}`);
  assert(evidence.grouped.songRadios === 1 && evidence.grouped.difficultyOptions === 2 && JSON.stringify(evidence.grouped.labels) === JSON.stringify(["Expert", "ExpertPlus"]), `Catalyst must be one row with two native difficulties: ${JSON.stringify(evidence.grouped)}`);
  assert(evidence.previewExact.state === "playing" && evidence.previewExact.packageId === "package-c" && evidence.previewExact.read?.packageId === "package-c", `preview must read exact selected package: ${JSON.stringify(evidence.previewExact)}`);
  assert(evidence.stale.code === "flow_orientation_reimport_required" && /reimport/iu.test(evidence.stale.message) && evidence.stale.message.length <= 256, `stale package must expose one bounded reimport-required error: ${JSON.stringify(evidence.stale)}`);
  assert(evidence.stale.selectedCollectionId === null && evidence.stale.selectedPackageId === null && evidence.stale.desired === null && evidence.stale.collectionCount === 2 && evidence.stale.listCalls === 1 && evidence.stale.loadCalls === 1, `stale selection must clear and refresh exactly once without auto-selecting: ${JSON.stringify(evidence.stale)}`);
  assert(evidence.corrected.packageId === "package-a" && evidence.corrected.selectedPackageId === "package-a" && evidence.corrected.error === null, `corrected reimport must select normally and clear stale error: ${JSON.stringify(evidence.corrected)}`);
  assert(JSON.stringify(evidence.exports) === JSON.stringify(["package-c","package-a"]) && JSON.stringify(evidence.deletes) === JSON.stringify(["collection-rapid"]), `stale rows must remain exportable/deletable: ${JSON.stringify(evidence)}`);
  assert(!/blob:|Uint8Array|ArrayBuffer|audioBytes|zipBytes|rawBytes/iu.test(evidence.publicText), "public snapshot leaked child-local media");
  assert(noise.length === 0, `batch library validation emitted browser noise: ${noise.join("\n")}`);
  console.log("Grouped library, latest-wins selection, exact preview, stale no-loop/reimport recovery, export/delete, and privacy validation passed.");
} finally { await browser.close(); await vite.close(); }

function assert(value, message) { if (!value) throw new Error(message); }
