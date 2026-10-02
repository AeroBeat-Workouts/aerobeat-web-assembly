// @ts-check
// Browser proof: Reimport All uses private persisted provenance, not public rows,
// and reports progress, local skips and failures inside the library panel.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const vite = await createViteServer({ appType: "spa", configFile: false, logLevel: "error", define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("local-browser-regression"), __AEROBEAT_CACHE_BUST__: JSON.stringify("local-browser-regression"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("0.0.88") }, server: { host: "127.0.0.1", port: 0, hmr: false, watch: null, fs: { allow: [new URL("../../", import.meta.url).pathname] } } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0];
  assert.ok(url);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const type = message.type(), text = message.text(), location = message.location();
    if (["warning", "error"].includes(type)
      && !isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, url)
      && !isExpectedPlaycanvasMeshWarning(type, text)) errors.push(`${type}: ${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`);
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof document.querySelector("aero-game")?.reimportAllLibraryCollections === "function");
  const game = page.locator("aero-game");
  const evidence = await game.evaluate(async (element) => {
    const persisted = [
      { collectionId: "song-one", songName: "First BeatSaver", sourceProvider: "beatsaver", sourceId: "A1", sourceVersionHash: "a".repeat(40) },
      { collectionId: "local-one", songName: "Local ZIP", sourceProvider: "local", sourceId: "", sourceVersionHash: "" },
      { collectionId: "song-two", songName: "Second BeatSaver", sourceProvider: "beatsaver", sourceId: "B2", sourceVersionHash: "b".repeat(40) }
    ];
    const original = element.graph;
    let sources = persisted;
    let terminalAuthoring = false;
    let collectionsToList = persisted.map(({ collectionId, songName }) => ({ collectionId, songName, createdAtMs: 1, packages: [] }));
    const authoring = { ...original.authoring, getSnapshot() { const snapshot = original.authoring.getSnapshot(); return terminalAuthoring ? { ...snapshot, state: "complete", progress: 1, jobId: "stale-job" } : snapshot; }, async listCollections() { return collectionsToList; }, async getCollectionReimportSource(id) { const source = sources.find((item) => item.collectionId === id); return source ? Object.freeze({ collectionId: id, sourceProvider: source.sourceProvider, sourceId: source.sourceId, sourceVersionHash: source.sourceVersionHash }) : null; } };
    element.graph = Object.freeze({ ...original, authoring: Object.freeze(authoring) });
    // Deliberately expose only presentation metadata, exactly as refreshLibrary does.
    const publicSongs = persisted.map((entry) => ({ collectionId: entry.collectionId, songName: entry.songName, activePackageId: `package-${entry.collectionId}`, difficulties: [{ packageId: `package-${entry.collectionId}`, difficultyId: "Expert", label: "Expert" }] }));
    element.libraryView = Object.freeze({ ...element.libraryView, collections: publicSongs, songs: publicSongs, selectedCollectionId: "song-one", selectedPackageId: "package-song-one" });
    const calls = [];
    let releaseFirst = () => {};
    const gate = new Promise((resolve) => { releaseFirst = () => resolve(undefined); });
    element.importBeatSaverById = async (id, version) => { calls.push({ id, version }); if (id === "A1") { await gate; return { collection: { collectionId: "song-one" } }; } throw new Error("test import failed"); };
    element.renderPresenters();
    const library = element.shadowRoot.querySelector("aero-content-library");
    library.shadowRoot.querySelector("button[data-intent='library-reimport-all']").click();
    for (let attempt = 0; attempt < 20 && element.bulkReimport?.state !== "running"; attempt += 1) await Promise.resolve();
    const running = { status: element.bulkReimport, buttonDisabled: library.shadowRoot.querySelector("button[data-intent='library-reimport-all']")?.disabled, text: library.shadowRoot.textContent };
    releaseFirst();
    await element.bulkReimportTask;
    const final = { status: element.bulkReimport, calls: [...calls], buttonDisabled: library.shadowRoot.querySelector("button[data-intent='library-reimport-all']")?.disabled, text: library.shadowRoot.textContent, librarySnapshot: JSON.stringify(library.presenterSnapshot) };
    sources = [{ collectionId: "local-only", songName: "Local only", sourceProvider: "local", sourceId: "", sourceVersionHash: "" }];
    collectionsToList = [{ collectionId: "local-only", songName: "Local only", createdAtMs: 1, packages: [] }];
    await element.reimportAllLibraryCollections();
    const localOnly = { status: element.bulkReimport, calls: [...calls], text: library.shadowRoot.textContent };
    sources = [{ collectionId: "cancel-first", songName: "First", sourceProvider: "beatsaver", sourceId: "C3", sourceVersionHash: "c".repeat(40) }, { collectionId: "cancel-second", songName: "Second", sourceProvider: "beatsaver", sourceId: "D4", sourceVersionHash: "d".repeat(40) }];
    collectionsToList = sources.map(({ collectionId, songName }) => ({ collectionId, songName, createdAtMs: 1, packages: [] }));
    terminalAuthoring = true;
    let releaseVendor = () => {};
    const vendorGate = new Promise((resolve) => { releaseVendor = () => resolve(undefined); });
    element.importBeatSaverById = async (id) => { calls.push({ id }); if (id === "C3") { await vendorGate; return null; } throw new Error("Cancel must prevent second song"); };
    const bulk = element.reimportAllLibraryCollections();
    for (let attempt = 0; attempt < 40 && calls.length < 3; attempt += 1) await Promise.resolve();
    const progress = element.shadowRoot.querySelector("aero-content-import-progress");
    const cancelButton = progress.shadowRoot.querySelector("button[data-intent='content-import-cancel']");
    const button = { disabled: cancelButton.disabled, label: cancelButton.textContent, progressText: progress.shadowRoot.textContent };
    cancelButton.click();
    const cancelledByButton = element.bulkReimportCancelled;
    releaseVendor();
    await bulk;
    const cancelled = { status: element.bulkReimport, calls: [...calls], text: library.shadowRoot.textContent, button, cancelledByButton };
    return { running, final, localOnly, cancelled };
  });
  assert.equal(evidence.running.status.state, "running");
  assert.equal(evidence.running.buttonDisabled, true);
  assert.match(evidence.running.text, /Preparing Reimport All|Reimport All:/u);
  assert.deepEqual(evidence.final.calls, [{ id: "A1", version: "a".repeat(40) }, { id: "B2", version: "b".repeat(40) }]);
  assert.equal(evidence.final.status.state, "failed");
  assert.deepEqual([evidence.final.status.reimported, evidence.final.status.skipped, evidence.final.status.failed], [1, 1, 1]);
  assert.equal(evidence.final.buttonDisabled, false);
  assert.match(evidence.final.text, /1 reimported, 1 skipped, 1 failed/u);
  assert.ok(!/"sourceId"|"sourceVersionHash"/u.test(evidence.final.librarySnapshot), "library presenter must not expose source provenance");
  assert.equal(evidence.localOnly.status.state, "complete");
  assert.deepEqual([evidence.localOnly.status.reimported, evidence.localOnly.status.skipped, evidence.localOnly.status.failed], [0, 1, 0]);
  assert.match(evidence.localOnly.text, /0 reimported, 1 skipped, 0 failed/u);
  assert.equal(evidence.localOnly.calls.length, 2, "local-only run must not refetch");
  assert.equal(evidence.cancelled.button.disabled, false, "visible Cancel must work despite terminal per-song authoring");
  assert.match(evidence.cancelled.button.label, /Cancel Reimport All/u);
  assert.match(evidence.cancelled.button.progressText, /Reimport All/u);
  assert.equal(evidence.cancelled.cancelledByButton, true, "UI intent must reach assembly cancelImport");
  assert.equal(evidence.cancelled.status.state, "cancelled");
  assert.equal(evidence.cancelled.status.completed, 0);
  assert.deepEqual(evidence.cancelled.calls.slice(2), [{ id: "C3" }], "Cancel must stop before the second map");
  assert.match(evidence.cancelled.text, /cancelled after 0 of 2/u);
  assert.deepEqual(errors, [], `browser errors: ${JSON.stringify(errors)}`);
  console.log("Reimport All browser states passed: stripped summaries, private source accessor, progress, failure, local skip, cancellation, privacy.");
} finally { await browser?.close(); await vite.close(); }
