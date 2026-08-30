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
  const setup = await game.evaluate((element) => {
    const preview = element.shadowRoot.querySelector("audio[data-role='preview']");
    if (!(preview instanceof HTMLAudioElement)) throw new Error("dedicated preview element missing");
    const operations = globalThis.__previewOperations = { play: 0, pause: 0, load: 0, created: [], revoked: [] };
    Object.defineProperty(preview, "play", { configurable: true, value() { operations.play += 1; queueMicrotask(() => preview.dispatchEvent(new Event("playing"))); return Promise.resolve(); } });
    Object.defineProperty(preview, "pause", { configurable: true, value() { operations.pause += 1; } });
    Object.defineProperty(preview, "load", { configurable: true, value() { operations.load += 1; } });
    const nativeAddEventListener = preview.addEventListener.bind(preview);
    Object.defineProperty(preview, "addEventListener", { configurable: true, value(type, listener, options) { if (type !== "error") nativeAddEventListener(type, listener, options); } });
    const nativeCreate = URL.createObjectURL.bind(URL); const nativeRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const value = nativeCreate(blob); operations.created.push({ value, size: blob.size, type: blob.type }); return value; };
    URL.revokeObjectURL = (value) => { operations.revoked.push(value); nativeRevoke(value); };
    const remote = {
      mapId: "4BE5E", mapName: "Saja Boys - Soda Pop (From Kpop Demon Hunters)", songName: "Soda Pop", songAuthorName: "Saja Boys", levelAuthorName: "Mapper",
      versions: [{ hash: "bd4eb4e885a3b055d7b7eacdd61882946e39e0c4", key: "", previewUrl: "https://cfcdn.beatsaver.com/bd4eb4e885a3b055d7b7eacdd61882946e39e0c4.mp3", difficulties: [{ characteristic: "Standard", difficulty: "Hard" }] }]
    };
    element.browsedMaps.set(remote.mapId, remote);
    element.beatSaverView = { ...element.beatSaverView, state: "ready", results: [{ mapId: remote.mapId, name: remote.mapName, songAuthorName: remote.songAuthorName }], selectedMap: null };
    element.selectBrowsedMap(remote.mapId);
    const browserPresenter = element.shadowRoot.querySelector("aero-beatsaver-browser");
    const button = browserPresenter.shadowRoot.querySelector("button[data-intent='beatsaver-preview-toggle']");
    const versionSelect = browserPresenter.shadowRoot.querySelector("select[aria-label='Version']"); const difficultySelect = browserPresenter.shadowRoot.querySelector("select[aria-label='Difficulty']");
    const singletonValues = [...browserPresenter.shadowRoot.querySelectorAll(".compact-singleton-field output")].map((output) => output.textContent);
    return { hasButton: button instanceof HTMLButtonElement, label: button?.textContent, singletonValues, versionSelect: Boolean(versionSelect), difficultySelect: Boolean(difficultySelect), graphAudio: element.graph.audio.getStatus().state, camera: element.graph.video.describeStatus().state, session: element.graph.gameplay.getSnapshot().session.state };
  });
  assert(setup.hasButton && setup.label === "Preview", `remote Preview action missing: ${JSON.stringify(setup)}`);
  assert(!setup.versionSelect && !setup.difficultySelect && JSON.stringify(setup.singletonValues) === JSON.stringify(["1"]), `remote compact fields must show a human-numbered Version and no Difficulty: ${JSON.stringify(setup)}`);

  await game.evaluate((element) => element.shadowRoot.querySelector("aero-beatsaver-browser").shadowRoot.querySelector("button[data-intent='beatsaver-preview-toggle']").click());
  await waitFor(page, async () => (await game.evaluate((element) => element.previewView.state)) === "playing");
  const remotePlaying = await previewSnapshot(game);
  assert(remotePlaying.button === "Stop" && remotePlaying.preview.state === "playing" && remotePlaying.preview.mapId === "4BE5E" && remotePlaying.operations.play === 1, `remote preview must play and become Stop: ${JSON.stringify(remotePlaying)}`);
  assert(remotePlaying.graphAudio === setup.graphAudio && remotePlaying.camera === setup.camera && remotePlaying.session === setup.session, `preview must not mutate gameplay services: ${JSON.stringify(remotePlaying)}`);
  assert(!JSON.stringify(remotePlaying.publicSnapshot).match(/blob:|previewUrl|rawAudio|audioBytes/iu), "public snapshot must not expose preview media data");

  await game.evaluate((element) => element.shadowRoot.querySelector("aero-beatsaver-browser").shadowRoot.querySelector("button[data-intent='beatsaver-preview-toggle']").click());
  await waitFor(page, async () => (await game.evaluate((element) => element.previewView.state)) === "idle");
  const remoteStopped = await previewSnapshot(game);
  assert(remoteStopped.button === "Preview" && remoteStopped.operations.pause >= 1, `remote Stop must reset one player: ${JSON.stringify(remoteStopped)}`);

  const localSetup = await game.evaluate((element) => {
    const packageId = "package-soda-pop-hard";
    const collectionId = "collection-soda-pop"; const collection = { collectionId, songName: "Soda Pop", activePackageId: packageId, difficulties: [{ packageKey: "soda-pop-hard", packageId, difficultyId: "Hard", label: "Hard" }] };
    const song = { collectionId, songName: "Soda Pop", activePackageId: packageId, difficulties: [{ packageId, difficultyId: "Hard", label: "Hard" }] };
    element.libraryView = { packages: [{ key: "soda-pop-hard", packageId, songName: "Soda Pop", difficulty: "Hard", createdAtMs: 1 }], collections: [collection], songs: [song], selectedCollectionId: collectionId, selectedPackageId: packageId, storage: null };
    element.desiredLibrarySelection = { collectionId, packageId, generation: element.librarySelectionGeneration };
    const originalGraph = element.graph; const originalContent = originalGraph.content;
    const localContent = Object.freeze({ ...originalContent, getSnapshot: () => ({ state: "ready", packageId, selectedVariant: { variantId: "flow", mode: "flow" }, variants: [], resolvedEvents: [], song: { name: "Soda Pop", audio: { filePath: "SODA POP.egg", contentHash: `sha256:${"a".repeat(64)}` } }, background: null }), readAsset: () => new Uint8Array([79, 103, 103, 83, 0, 1, 2, 3]) });
    element.graph = Object.freeze({ ...originalGraph, content: localContent }); element.renderPresenters();
    const library = element.shadowRoot.querySelector("aero-content-library"); const button = library.shadowRoot.querySelector("button[data-intent='library-preview-toggle']");
    return { packageId, button: button?.textContent, actionAreaCount: library.shadowRoot.querySelectorAll("[part='selected-actions']").length, previewCount: library.shadowRoot.querySelectorAll("button[data-intent='library-preview-toggle']").length };
  });
  assert(localSetup.button === "Preview" && localSetup.actionAreaCount === 1 && localSetup.previewCount === 1, `local selected-only Preview action missing: ${JSON.stringify(localSetup)}`);
  await game.evaluate((element) => element.toggleLibraryPreview("package-soda-pop-hard"));
  await waitFor(page, async () => (await game.evaluate((element) => element.previewView.state)) === "playing");
  const localPlaying = await previewSnapshot(game);
  assert(localPlaying.localButton === "Stop" && localPlaying.preview.packageId === localSetup.packageId && localPlaying.operations.created.length === 1 && localPlaying.operations.created[0].type === "audio/ogg" && localPlaying.operations.created[0].size === 8, `local verified bytes must use one Ogg Blob preview: ${JSON.stringify(localPlaying)}`);
  assert(localPlaying.timerActive && localPlaying.graphAudio === setup.graphAudio && localPlaying.camera === setup.camera && localPlaying.session === setup.session, `local preview must be bounded and gameplay-isolated: ${JSON.stringify(localPlaying)}`);

  await game.evaluate((element) => element.setMenuOpen(false));
  const menuStopped = await previewSnapshot(game);
  assert(menuStopped.preview.state === "idle" && menuStopped.operations.revoked.length === 1 && menuStopped.operations.revoked[0] === menuStopped.operations.created[0].value && !menuStopped.timerActive, `menu close must stop and revoke exactly once: ${JSON.stringify(menuStopped)}`);
  await game.evaluate((element) => { element.setMenuOpen(true); element.toggleLibraryPreview("package-soda-pop-hard"); });
  await waitFor(page, async () => (await game.evaluate((element) => element.previewView.state)) === "playing");
  await game.evaluate((element) => element.remove());
  const teardown = await page.evaluate(() => globalThis.__previewOperations);
  assert(teardown.created.length === 2 && teardown.revoked.length === 2 && new Set(teardown.revoked).size === 2, `disconnect must revoke each local URL exactly once: ${JSON.stringify(teardown)}`);
  assert(noise.length === 0, `preview validation emitted browser noise: ${noise.join("\n")}`);
  console.log("Remote/local Preview/Stop, singleton fields, lifecycle cleanup, service isolation, and privacy validation passed.");
} finally {
  await browser.close(); await vite.close();
}

async function previewSnapshot(game) {
  return game.evaluate((element) => ({
    preview: element.previewView,
    button: element.shadowRoot.querySelector("aero-beatsaver-browser")?.shadowRoot?.querySelector("button[data-intent='beatsaver-preview-toggle']")?.textContent ?? "",
    localButton: element.shadowRoot.querySelector("aero-content-library")?.shadowRoot?.querySelector("button[data-intent='library-preview-toggle']")?.textContent ?? "",
    operations: globalThis.__previewOperations,
    timerActive: element.previewTimer !== 0,
    graphAudio: element.graph.audio.getStatus().state,
    camera: element.graph.video.describeStatus().state,
    session: element.graph.gameplay.getSnapshot().session.state,
    publicSnapshot: element.getSnapshot()
  }));
}

async function waitFor(page, predicate, timeoutMs = 3000) { const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) { if (await predicate()) return; await page.waitForTimeout(20); } throw new Error("Timed out waiting for preview state"); }
function assert(condition, message) { if (!condition) throw new Error(message); }
