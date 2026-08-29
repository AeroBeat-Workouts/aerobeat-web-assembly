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
  await page.addInitScript(() => {
    globalThis.__cameraRequests = 0;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { async getUserMedia() { globalThis.__cameraRequests += 1; return new MediaStream(); } } });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const game = page.locator("aero-game"); await game.waitFor();
  await game.evaluate((element) => {
    const originalFactory = element.serviceGraphFactory;
    element.remove();
    element.serviceGraphFactory = (options) => {
      const original = originalFactory(options);
      const hash = "a".repeat(64);
      const variant = (packageId) => ({ variantId: `${packageId}-flow`, chartId: `${packageId}-chart`, mode: "flow", rulesetId: "flow_grid_v1", recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { baseVariantId: `${packageId}-flow` } });
      const idleContent = () => ({ state: "idle", packageId: null, selectedVariant: null, variants: [], resolvedEvents: [], song: null, background: null, lineage: null });
      const readyContent = (packageId) => { const selectedVariant = variant(packageId); return { state: "ready", packageId, selectedVariant, variants: [selectedVariant], resolvedEvents: [], song: { name: packageId }, background: null, lineage: null }; };
      const state = globalThis.__mobileState = { pose: undefined, audioState: "paused", audioPlayCalls: 0, audioPauseCalls: 0, cvStartCalls: 0, cvStopCalls: 0, videoPauseCalls: 0, videoPlayCalls: 0, retained: null, library: [], packageLoadCalls: [], exportCalls: [], importCalls: [], maps: [], contentSnapshot: idleContent() };
      const content = { getSnapshot: () => state.contentSnapshot, async loadPersistenceHandle(handle) { state.packageLoadCalls.push(handle.packageId); state.contentSnapshot = readyContent(handle.packageId); }, async selectVariant(variantId) { state.contentSnapshot = { ...state.contentSnapshot, selectedVariant: state.contentSnapshot.variants.find((item) => item.variantId === variantId) ?? null }; }, async swapFutureVariant(variantId) { await this.selectVariant(variantId); }, subscribe() { return () => {}; }, setPlaybackState() {}, readAsset() { return new Uint8Array(); }, destroy() {} };
      const authoring = { getSnapshot: () => ({ state: "idle", progress: 0 }), subscribe() { return () => {}; }, async listPackages() { return state.library; }, async estimateStorage() { return { usageBytes: 0, quotaBytes: 1024 }; }, async loadPackage(handle) { return { handle, package: {} }; }, async exportPackage(handle) { state.exportCalls.push(handle.packageId); return { fileName: `${handle.packageId}.aerobeat.zip`, mediaType: "application/zip", byteLength: 1, bytes: new Uint8Array([1]) }; }, async deletePackage() { return false; }, cancel() {}, destroy() {} };
      const vendor = { snapshot: () => original.vendor.snapshot(), async searchMaps() { return { maps: state.maps }; }, async listLatestMaps() { return { maps: state.maps }; } };
      const video = {
        getRetainedCameraStream: () => state.retained,
        async requestCamera() { state.retained = await navigator.mediaDevices.getUserMedia({ video: true }); return { status: "granted", message: "ok" }; },
        attachCameraStream: () => ({ sourceKind: "live-camera", sourceId: "mock-camera", mirrored: true, currentTimeSeconds: 0, intrinsicWidth: 640, intrinsicHeight: 480, sourceAspectRatio: 4 / 3, sourceChangeId: 1 }),
        injectCameraStream(stream) { state.retained = stream; }, async play() { state.videoPlayCalls += 1; }, activateLease() {}, pauseForLease() {}, releaseLease() {},
        describeStatus: () => ({ state: "ready", sourceChangeId: 1 }), describeSurface: () => ({ sourceId: "mock-camera", mirrored: true, sourceChangeId: 1, sourceAspectRatio: 4 / 3 }),
        pause() { state.videoPauseCalls += 1; }, setDocumentHidden() {}, destroy() {}
      };
      const cv = { async start() { state.cvStartCalls += 1; }, async stop() { state.cvStopCalls += 1; }, async dispose() {}, getLatestPoseFrame: () => state.pose, getStatus: () => ({ lifecycleState: "running" }) };
      const audio = {
        async activateLease() {}, async releaseLease() {}, async pauseForLease() { state.audioState = "paused"; state.audioPauseCalls += 1; },
        async play() { state.audioState = "playing"; state.audioPlayCalls += 1; }, async pause() { state.audioState = "paused"; state.audioPauseCalls += 1; }, async stop() { state.audioState = "stopped"; },
        async setDocumentHidden(hidden) { if (hidden) state.audioState = "paused"; }, async destroy() {},
        getStatus: () => ({ state: state.audioState, autoplayState: "allowed" }), getClockSnapshot: () => ({ contextTimeSeconds: performance.now() / 1000, positionSeconds: 0, playing: state.audioState === "playing" })
      };
      return Object.freeze({ ...original, vendor, authoring, content, video, cv, audio });
    };
    document.querySelector("main")?.append(element);
  });

  const initial = await shellSnapshot(game);
  assert(initial.menuOpen && initial.drawerVisible, "first-run drawer must open");
  assert(initial.buttonWidth >= 44 && initial.buttonHeight >= 44 && initial.buttonTop <= 12, "hamburger must be accessible at top right");
  assert(initial.compactCount === initial.presenterCount && initial.presenterCount === 6, "all six drawer presenters must consume [compact]");
  assert(initial.videoStable && initial.canvasStable && initial.surfaceFill, "stable video/canvas must fill portrait viewport");
  assert(initial.ariaExpanded === "true" && initial.ariaControls === "aero-game-drawer" && initial.buttonFocused, "first-run drawer must expose one focused corner control");
  const initialVisual = await visualShellSnapshot(game);
  assert(initialVisual.drawer && initialVisual.menu && !initialVisual.status && !initialVisual.cue && initialVisual.hudPresenters === 0 && !initialVisual.brand && !initialVisual.infoStatus, `open idle shell must hide HUD/status and omit drawer brand/runtime copy: ${JSON.stringify(initialVisual)}`);
  const taxonomy = await game.evaluate((element) => {
    const root = element.shadowRoot; const drawer = root.querySelector("[data-role='drawer']");
    const sections = [...drawer.querySelectorAll(".drawer-content > .drawer-section")];
    const gameplay = drawer.querySelector("aero-prototype-selector[scope='gameplay']"); const visuals = drawer.querySelector("aero-prototype-selector[scope='visuals']");
    const gameplayChecked = gameplay.shadowRoot.querySelector("input[type='radio']:checked"); const visualsChecked = visuals.shadowRoot.querySelector("input[type='radio']:checked");
    const forbidden = [...sections].map((section) => section.innerText).join(" ").match(/schema|profile bundle|converter|scoring|ruleset|recipe|content hash|development telemetry/giu) ?? [];
    const surface = drawer.querySelector("[data-role='drawer-surface']"); const heading = sections[0]?.querySelector("h2");
    const rgb = (value) => (value.match(/[\d.]+/gu) ?? []).slice(0, 3).map(Number); const linear = (channel) => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }; const luminance = (value) => { const [red, green, blue] = rgb(value); return .2126 * linear(red) + .7152 * linear(green) + .0722 * linear(blue); }; const contrast = (foreground, background) => { const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
    const surfaceStyle = getComputedStyle(surface); const headingStyle = getComputedStyle(heading); const closeControls = [...element.shadowRoot.querySelectorAll("[data-role='menu-button'],[data-action='menu-close']")].filter((button) => button.getClientRects().length > 0);
    return { headings: sections.map((section) => section.querySelector(":scope > h2")?.textContent), sectionCount: sections.length, selectorCount: drawer.querySelectorAll("aero-prototype-selector[compact]").length, gameplayChecked: gameplayChecked?.value, visualsChecked: visualsChecked?.value, forbidden, oneSurface: Boolean(surface && surface.contains(element.shadowRoot.querySelector("[data-action='calibrate-start']")) && sections.every((section) => surface.contains(section))), surfaceAlpha: Number(surfaceStyle.backgroundColor.match(/[\d.]+/gu)?.[3] ?? 1), contrast: contrast(headingStyle.color, surfaceStyle.backgroundColor), closeControls: closeControls.length, menuState: element.shadowRoot.querySelector("[data-role='menu-button']")?.dataset.menuState, environmentValues: [...element.shadowRoot.querySelectorAll("input[data-action='environment-select']")].map((input) => input.value), environmentChecked: element.shadowRoot.querySelector("input[data-action='environment-select']:checked")?.value, environmentHeights: [...element.shadowRoot.querySelectorAll(".environment-option")].map((label) => label.getBoundingClientRect().height), closeBar: (() => { const icon = element.shadowRoot.querySelector(".menu-icon"); const style = getComputedStyle(icon, "::before"); return { width: style.width, height: style.height, color: style.backgroundColor }; })() };
  });
  assert(JSON.stringify(taxonomy.headings) === JSON.stringify(["Gameplay", "Visuals", "Music", "Info"]) && taxonomy.sectionCount === 4, `drawer must have exactly four ordered product headings: ${JSON.stringify(taxonomy)}`);
  assert(taxonomy.selectorCount === 2 && taxonomy.gameplayChecked === "flow" && taxonomy.visualsChecked === "aero.visual.default", `scoped radio defaults must select Flow and Default: ${JSON.stringify(taxonomy)}`);
  assert(taxonomy.oneSurface && taxonomy.surfaceAlpha === 1 && taxonomy.contrast >= 4.5 && taxonomy.closeControls === 1 && taxonomy.menuState === "open" && taxonomy.closeBar.width === "24px" && taxonomy.closeBar.height === "4px" && taxonomy.closeBar.color === "rgb(255, 255, 255)", `drawer must use one opaque AA surface and one explicit close control: ${JSON.stringify(taxonomy)}`);
  assert(JSON.stringify(taxonomy.environmentValues) === JSON.stringify(["aero", "camera"]) && taxonomy.environmentChecked === "aero" && taxonomy.environmentHeights.every((height) => height >= 42), `Visuals must expose independent 42px native Aero/Camera radios with Aero default: ${JSON.stringify(taxonomy)}`);
  assert(taxonomy.forbidden.length === 0, `drawer must omit development controls/text: ${taxonomy.forbidden.join(",")}`);
  const prestartEnvironment = await game.evaluate((element) => { element.shadowRoot.querySelector("input[value='camera'][data-action='environment-select']").click(); const camera = { mode: element.environmentMode, preview: element.shadowRoot.querySelector("video").dataset.previewVisible }; element.shadowRoot.querySelector("input[value='aero'][data-action='environment-select']").click(); return { camera, finalMode: element.environmentMode, cameraRequests: globalThis.__cameraRequests }; });
  assert(prestartEnvironment.camera.mode === "camera" && prestartEnvironment.camera.preview === "false" && prestartEnvironment.finalMode === "aero" && prestartEnvironment.cameraRequests === 0, `pre-start environment switching must remain child-local and never acquire camera: ${JSON.stringify(prestartEnvironment)}`);

  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='calibrate-start']").click());
  await page.waitForTimeout(100);
  const freshGate = await game.evaluate((element) => ({ cameraRequests: globalThis.__cameraRequests, prerequisite: element.shadowRoot.querySelector("[data-role='music-prerequisite']").textContent, musicFocused: element.shadowRoot.activeElement === element.shadowRoot.querySelector("[data-section='music']"), sessionState: element.graph.gameplay.getSnapshot().session.state }));
  assert(freshGate.cameraRequests === 0 && /song/u.test(freshGate.prerequisite) && freshGate.musicFocused, `fresh Calibrate must focus one Music prerequisite without camera: ${JSON.stringify(freshGate)}`);

  const selection = await game.evaluate(async (element) => {
    const makeVersion = (hash) => ({ hash, key: hash.slice(0, 6), difficulties: [{ characteristic: "Standard", difficulty: "Expert" }] });
    const unsupportedVersion = (hash) => ({ hash, key: hash.slice(0, 6), difficulties: [{ characteristic: "Lightshow", difficulty: "Easy" }] });
    const radioState = (presenter, intent) => { const radios = [...presenter.shadowRoot.querySelectorAll(`input[type='radio'][data-intent='${intent}']`)]; return { count: radios.length, checked: radios.filter((radio) => radio.checked).map((radio) => radio.value) }; };
    const browser = element.shadowRoot.querySelector("aero-beatsaver-browser"); const library = element.shadowRoot.querySelector("aero-content-library");
    globalThis.__mobileState.maps = [
      { mapId: "FIRST", mapName: "First result", songName: "First result", songAuthorName: "Artist A", levelAuthorName: "Mapper A", versions: [unsupportedVersion("0".repeat(40)), makeVersion("1".repeat(40))] },
      { mapId: "SECOND", mapName: "Second result", songName: "Second result", songAuthorName: "Artist B", levelAuthorName: "Mapper B", versions: [makeVersion("2".repeat(40))] },
      { mapId: "THIRD", mapName: "Unsupported result", songName: "Unsupported result", songAuthorName: "Artist C", levelAuthorName: "Mapper C", versions: [unsupportedVersion("3".repeat(40))] }
    ];
    await element.browseBeatSaver({ text: "result" });
    const firstMapRadios = radioState(browser, "beatsaver-select-map");
    browser.shadowRoot.querySelector("input[data-intent='beatsaver-select-map'][value='SECOND']").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const selectedSearch = element.beatSaverView.selectedMap?.mapId; const selectedMapRadios = radioState(browser, "beatsaver-select-map");
    await element.browseBeatSaver({ text: "result" }); const preservedMapRadios = radioState(browser, "beatsaver-select-map");
    element.importBeatSaverById = async (mapId, versionHash, options) => { const hash = "a".repeat(64); const selectedVariant = { variantId: "package-imported-flow", chartId: "package-imported-chart", mode: "flow", rulesetId: "flow_grid_v1", recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { baseVariantId: "package-imported-flow" } }; globalThis.__mobileState.importCalls.push({ mapId, versionHash, difficulty: options.difficulty }); globalThis.__mobileState.contentSnapshot = { state: "ready", packageId: "package-imported", selectedVariant, variants: [selectedVariant], resolvedEvents: [], song: { name: "Imported" }, background: null, lineage: null }; return { handle: { packageId: "package-imported" } }; };
    element.shadowRoot.querySelector("[data-action='calibrate-start']").click();
    const startDeadline = performance.now() + 1000; while ((globalThis.__cameraRequests !== 1 || element.getSnapshot().interaction.menuOpen) && performance.now() < startDeadline) await new Promise((resolve) => setTimeout(resolve, 10));
    const searchCameraRequests = globalThis.__cameraRequests; const searchMenuOpen = element.getSnapshot().interaction.menuOpen; const searchImports = [...globalThis.__mobileState.importCalls];
    element.setMenuOpen(true); await new Promise((resolve) => setTimeout(resolve, 30));
    const packageSummary = (packageId, songName, createdAtMs) => ({ key: `key-${packageId}`, packageId, packageHash: `sha256:${"a".repeat(64)}`, songName, difficulty: "Expert", createdAtMs, assetCount: 1, sourceCacheCount: 0 });
    globalThis.__mobileState.library = [packageSummary("package-first", "First library song", 100), packageSummary("package-current", "Current library song", 200)];
    globalThis.__mobileState.contentSnapshot = { ...globalThis.__mobileState.contentSnapshot, ...{ state: "ready", packageId: "package-current", selectedVariant: { variantId: "package-current-flow", chartId: "package-current-chart", mode: "flow", rulesetId: "flow_grid_v1", recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "a".repeat(64) }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "a".repeat(64) }, provenance: { baseVariantId: "package-current-flow" } }, variants: [], resolvedEvents: [], song: { name: "Current" }, background: null, lineage: null } };
    await element.refreshLibrary();
    const preserved = element.graph.content.getSnapshot().packageId; const preservedLoads = globalThis.__mobileState.packageLoadCalls.length; const currentPackageRadios = radioState(library, "library-select");
    library.shadowRoot.querySelector("input[data-intent='library-select'][value='package-first']").click();
    const intentDeadline = performance.now() + 1000; while (element.graph.content.getSnapshot().packageId !== "package-first" && performance.now() < intentDeadline) await new Promise((resolve) => setTimeout(resolve, 10));
    const radioIntentPackage = element.graph.content.getSnapshot().packageId; const intentPackageRadios = radioState(library, "library-select");
    globalThis.__mobileState.packageLoadCalls.length = 0;
    globalThis.__mobileState.contentSnapshot = { state: "idle", packageId: null, selectedVariant: null, variants: [], resolvedEvents: [], song: null, background: null, lineage: null };
    await element.refreshLibrary();
    const fallbackPackageRadios = radioState(library, "library-select");
    const browserActions = [...browser.shadowRoot.querySelectorAll("button")].map((button) => button.textContent.trim());
    const libraryActions = [...library.shadowRoot.querySelectorAll("button")].map((button) => button.textContent.trim());
    library.shadowRoot.querySelector("button[data-intent='library-export']")?.click(); await new Promise((resolve) => setTimeout(resolve, 30));
    const progress = element.shadowRoot.querySelector("aero-content-import-progress"); const cancel = progress.shadowRoot.querySelector("[data-intent='content-import-cancel']");
    const optionButtonCount = browser.shadowRoot.querySelectorAll("button[data-intent='beatsaver-select-map']").length + library.shadowRoot.querySelectorAll("button[data-intent='library-select']").length;
    const version = browser.shadowRoot.querySelector("[aria-label='Version']"); const difficulty = browser.shadowRoot.querySelector("[aria-label='Difficulty']");
    return { firstMapRadios, selectedSearch, selectedMapRadios, preservedMapRadios, searchCameraRequests, searchMenuOpen, searchImports, preserved, preservedLoads, currentPackageRadios, radioIntentPackage, intentPackageRadios, autoSelected: element.graph.content.getSnapshot().packageId, fallbackPackageRadios, loadCalls: [...globalThis.__mobileState.packageLoadCalls], browserActions, libraryActions, exportCalls: [...globalThis.__mobileState.exportCalls], optionButtonCount, cancelTag: cancel?.tagName, versionTag: version?.tagName, versionOptions: version instanceof HTMLSelectElement ? version.options.length : null, versionValue: version?.textContent, difficultyTag: difficulty?.tagName, difficultyOptions: difficulty instanceof HTMLSelectElement ? difficulty.options.length : null, difficultyValue: difficulty?.textContent };
  });
  assert(selection.firstMapRadios.count === 2 && JSON.stringify(selection.firstMapRadios.checked) === JSON.stringify(["FIRST"]), `first search radio must be checked deterministically: ${JSON.stringify(selection)}`);
  assert(selection.selectedSearch === "SECOND" && selection.selectedMapRadios.count === 2 && JSON.stringify(selection.selectedMapRadios.checked) === JSON.stringify(["SECOND"]), `map radio intent must update assembly and checked state: ${JSON.stringify(selection)}`);
  assert(selection.preservedMapRadios.count === 2 && JSON.stringify(selection.preservedMapRadios.checked) === JSON.stringify(["SECOND"]), `valid current map radio must survive refreshed results: ${JSON.stringify(selection)}`);
  assert(selection.searchCameraRequests === 1 && !selection.searchMenuOpen && selection.searchImports.length === 1 && selection.searchImports[0].mapId === "SECOND" && selection.searchImports[0].difficulty === "Expert", `one Calibrate tap must import the selected song before one camera request and close the menu: ${JSON.stringify(selection)}`);
  assert(selection.preserved === "package-current" && selection.preservedLoads === 0 && selection.currentPackageRadios.count === 2 && JSON.stringify(selection.currentPackageRadios.checked) === JSON.stringify(["package-current"]), `valid current library radio must be preserved: ${JSON.stringify(selection)}`);
  assert(selection.radioIntentPackage === "package-first" && selection.intentPackageRadios.count === 2 && JSON.stringify(selection.intentPackageRadios.checked) === JSON.stringify(["package-first"]), `library radio intent must update assembly and checked state: ${JSON.stringify(selection)}`);
  assert(selection.autoSelected === "package-first" && selection.fallbackPackageRadios.count === 2 && JSON.stringify(selection.fallbackPackageRadios.checked) === JSON.stringify(["package-first"]) && JSON.stringify(selection.loadCalls) === JSON.stringify(["package-first"]), `first library radio must be checked as deterministic fallback: ${JSON.stringify(selection)}`);
  assert(selection.versionTag === "OUTPUT" && selection.versionOptions === null && selection.versionValue === "222222" && selection.difficultyTag === "OUTPUT" && selection.difficultyOptions === null && selection.difficultyValue === "Expert", `singleton Version/Difficulty must be concise labeled values without false select affordances: ${JSON.stringify(selection)}`);
  assert(selection.optionButtonCount === 0 && selection.cancelTag === "BUTTON" && ["Search", "Latest", "Choose local ZIP", "Preview", "Import selected map"].every((label) => selection.browserActions.includes(label)) && JSON.stringify(selection.libraryActions) === JSON.stringify(["Preview", "Export", "Delete"]) && JSON.stringify(selection.exportCalls) === JSON.stringify(["package-first"]), `Music must expose selected-only Preview/Export/Delete actions and no Play: ${JSON.stringify(selection)}`);
  const drawerCopy = await composedDrawerText(game);
  const allowedDrawerText = new Set(["Calibrate / Start", "Gameplay", "Flow", "Semantic Row", "Spatial Row", "Semantic Cut", "Spatial Cut", "Visuals", "Default", "Compact", "Environment", "Aero", "Camera", "Music", "Search", "Latest", "Choose local ZIP", "First result", "Second result", "Preview", "Version", "222222", "Difficulty", "Expert", "Import selected map", "Idle · 0%", "First library song · Expert", "Current library song · Expert", "Export", "Delete", "Cancel import", "Info", "Enter fullscreen", "Exit fullscreen"]);
  const unexpectedDrawerText = drawerCopy.filter((text) => !allowedDrawerText.has(text));
  assert(unexpectedDrawerText.length === 0 && !drawerCopy.includes("AeroBeat"), `compact drawer composed text must match the product allowlist: ${JSON.stringify({ drawerCopy, unexpectedDrawerText })}`);

  const focusCycle = await game.evaluate((element) => {
    const drawer = element.shadowRoot.querySelector("[data-role='drawer']");
    const collect = (root) => [...root.querySelectorAll("*")].flatMap((item) => item instanceof HTMLElement && !item.hidden ? [...(item.matches("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])") ? [item] : []), ...(item.shadowRoot ? collect(item.shadowRoot) : [])] : []);
    const active = () => { let item = element.shadowRoot.activeElement; while (item?.shadowRoot?.activeElement) item = item.shadowRoot.activeElement; return item; };
    const controls = [element.shadowRoot.querySelector("[data-role='menu-button']"), ...collect(drawer)]; const first = controls[0]; const last = controls.at(-1);
    last.focus(); last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, composed: true, cancelable: true })); const forward = active() === first;
    first.focus(); first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, composed: true, cancelable: true })); return { forward, backward: active() === last, nested: controls.some((control) => control.getRootNode() !== element.shadowRoot) };
  });
  assert(focusCycle.forward && focusCycle.backward && focusCycle.nested, "drawer focus trap must include nested presenter shadow controls");
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-backdrop']").click()); await page.waitForTimeout(50);
  const backdropClosed = await shellSnapshot(game); assert(!backdropClosed.menuOpen && backdropClosed.buttonFocused, "backdrop close must restore hamburger focus");
  const idleClosedVisual = await visualShellSnapshot(game);
  assert(idleClosedVisual.menu && !idleClosedVisual.drawer && !idleClosedVisual.status && idleClosedVisual.cue && idleClosedVisual.cueText === "T-pose" && idleClosedVisual.hudPresenters === 0 && idleClosedVisual.visibleOverlayCount === 2, `closing after transactional start must expose only the corner control and T-pose cue: ${JSON.stringify(idleClosedVisual)}`);
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-toggle']").click()); await page.waitForTimeout(50);

  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='calibrate-start']").click());
  await waitFor(page, async () => await page.evaluate(() => globalThis.__cameraRequests === 1 && globalThis.__mobileState.cvStartCalls >= 1));
  await pushPose(game, 1000, true); await pushPose(game, 5500, true);
  const started = await game.evaluate((element) => ({ menuOpen: element.getSnapshot().interaction.menuOpen, calibrationId: element.graph.input.getSnapshot().calibration.calibrationId }));
  assert(!started.menuOpen && started.calibrationId === null, "Calibrate / Start must close the menu into a fresh T-pose gate");

  const calibratingVisual = await visualShellSnapshot(game);
  assert(calibratingVisual.menu && !calibratingVisual.drawer && calibratingVisual.cue && ["T-pose", "Hold T-pose"].includes(calibratingVisual.cueText) && calibratingVisual.hudPresenters === 0 && calibratingVisual.visibleOverlayCount === 2 && calibratingVisual.previewVisible && calibratingVisual.previewOpacity === "1" && calibratingVisual.rendererBackground === "#00000000" && calibratingVisual.videoPlayCalls >= 1, `calibration may expose only menu plus one minimal T-pose cue: ${JSON.stringify(calibratingVisual)}`);
  for (let offset = 0; offset <= 2000; offset += 250) await pushPose(game, 6000 + offset, true);
  const holdingVisual = await visualShellSnapshot(game);
  assert(holdingVisual.cue && holdingVisual.cueText === "Hold T-pose" && holdingVisual.visibleOverlayCount === 2 && holdingVisual.previewVisible && holdingVisual.rendererBackground === "#00000000", `T-pose hold must remain one minimal cue: ${JSON.stringify(holdingVisual)}`);
  for (let offset = 2250; offset <= 4000; offset += 250) await pushPose(game, 6000 + offset, true);
  await releaseHold(game, 10250);
  await waitFor(page, async () => Number.isFinite(await game.evaluate((element) => element.graph.gameplay.getSnapshot().countdown?.value)), 3000);
  const countdownVisual = await visualShellSnapshot(game);
  assert(countdownVisual.menu && countdownVisual.cue && /^[123]$/u.test(countdownVisual.cueText) && countdownVisual.hudPresenters === 0 && countdownVisual.visibleOverlayCount === 2 && !countdownVisual.previewVisible && countdownVisual.previewOpacity === "0" && countdownVisual.rendererBackground === "#071426", `countdown may expose only menu plus one numeric cue: ${JSON.stringify(countdownVisual)}`);
  await waitFor(page, async () => (await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)) === "playing", 6000);
  let state = await stateSnapshot(game);
  assert(state.audioState === "playing" && state.audioPlayCalls >= 1, "audio must start only after initial countdown enters play");
  const playingVisual = await visualShellSnapshot(game);
  assert(playingVisual.menu && !playingVisual.drawer && !playingVisual.status && !playingVisual.cue && playingVisual.hudPresenters === 0 && playingVisual.visibleOverlayCount === 1 && playingVisual.visibleOverlayText.length === 0 && !playingVisual.previewVisible && playingVisual.rendererBackground === "#071426", `steady gameplay must expose exactly the corner menu control above video/canvas: ${JSON.stringify(playingVisual)}`);
  await game.evaluate((element) => element.shadowRoot.querySelector("input[value='camera'][data-action='environment-select']").click());
  const cameraPlaying = await visualShellSnapshot(game); assert(cameraPlaying.environmentMode === "camera" && cameraPlaying.previewVisible && cameraPlaying.previewOpacity === "1" && cameraPlaying.rendererBackground === "#00000000", `Camera selection must expose retained preview during calibrated play without reacquire: ${JSON.stringify(cameraPlaying)}`);
  await game.evaluate((element) => element.shadowRoot.querySelector("input[value='aero'][data-action='environment-select']").click());
  const aeroPlaying = await visualShellSnapshot(game); assert(aeroPlaying.environmentMode === "aero" && !aeroPlaying.previewVisible && aeroPlaying.rendererBackground === "#071426" && await page.evaluate(() => globalThis.__cameraRequests === 1), `Aero selection must immediately restore opaque play without camera reacquire: ${JSON.stringify(aeroPlaying)}`);

  await pushPose(game, 15000, true); await pushPose(game, 15250, true);
  await waitFor(page, async () => (await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)) === "paused_tracking");
  state = await stateSnapshot(game);
  assert(state.audioState === "paused", "sustained in-play T-pose must enter pose-aware pause");
  const trackingVisual = await visualShellSnapshot(game);
  assert(trackingVisual.menu && trackingVisual.cue && trackingVisual.cueText === "Tracking lost" && trackingVisual.hudPresenters === 0 && trackingVisual.visibleOverlayCount === 2 && trackingVisual.previewVisible && trackingVisual.rendererBackground === "#00000000", `tracking recovery may expose only menu plus one minimal cue: ${JSON.stringify(trackingVisual)}`);
  for (let offset = 500; offset <= 4000; offset += 250) await pushPose(game, 15000 + offset, true);
  await releaseHold(game, 19250);
  await waitFor(page, async () => (await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)) === "playing", 6000);

  const beforeMenu = await stateSnapshot(game);
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-toggle']").click());
  await waitFor(page, async () => ["paused_manual", "paused_tracking"].includes(await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)));
  const opened = await stateSnapshot(game);
  assert(opened.audioState === "paused" && opened.cvStopCalls === beforeMenu.cvStopCalls && opened.videoPauseCalls === beforeMenu.videoPauseCalls, "menu pause must pause audio/gameplay while retaining camera/CV/frame loop");
  const menuPausedVisual = await visualShellSnapshot(game);
  assert(menuPausedVisual.drawer && menuPausedVisual.menu && !menuPausedVisual.cue && !menuPausedVisual.status && menuPausedVisual.hudPresenters === 0 && !menuPausedVisual.previewVisible && menuPausedVisual.rendererBackground === "#071426", `open paused menu must suppress all gameplay cues/status: ${JSON.stringify(menuPausedVisual)}`);
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-role='drawer']").focus());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const escapedShell = await shellSnapshot(game); assert(escapedShell.ariaExpanded === "false" && escapedShell.buttonFocused, `Escape must close drawer and return focus to the corner control: ${JSON.stringify(escapedShell)}`);
  const closed = await stateSnapshot(game);
  assert(closed.sessionState === "paused_tracking" && !closed.menuOpen, "closing menu must stay paused awaiting fresh calibration");
  const closedPausedVisual = await visualShellSnapshot(game);
  assert(closedPausedVisual.menu && closedPausedVisual.cue && closedPausedVisual.visibleOverlayCount === 2 && closedPausedVisual.hudPresenters === 0 && closedPausedVisual.previewVisible && closedPausedVisual.rendererBackground === "#00000000", `closed paused state must expose only menu plus one recovery cue: ${JSON.stringify(closedPausedVisual)}`);
  await calibrateAndRelease(game, 24000);
  await waitFor(page, async () => (await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)) === "playing", 6000);

  const closedShell = await shellSnapshot(game);
  const resumedPlayingVisual = await visualShellSnapshot(game);
  assert(!closedShell.drawerVisible && closedShell.closedVisiblePresenterCount === 0 && closedShell.surfaceFill && resumedPlayingVisual.visibleOverlayCount === 1 && resumedPlayingVisual.visibleOverlayText.length === 0 && !resumedPlayingVisual.previewVisible && resumedPlayingVisual.rendererBackground === "#071426", `resumed closed play must expose only the corner control: ${JSON.stringify({ closedShell, resumedPlayingVisual })}`);
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(100);
  const landscape = await shellSnapshot(game);
  assert(landscape.surfaceFill && landscape.buttonWidth >= 44 && landscape.buttonHeight >= 44, "landscape surfaces/menu must remain stable and accessible");
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-toggle']").click()); await page.waitForTimeout(100);
  const landscapeMusic = await game.evaluate((element) => {
    const drawer = element.shadowRoot.querySelector("[data-role='drawer']"); const browser = drawer.querySelector("aero-beatsaver-browser"); const library = drawer.querySelector("aero-content-library");
    const inspect = (presenter, intent) => { const radios = [...presenter.shadowRoot.querySelectorAll(`input[type='radio'][data-intent='${intent}']`)]; return { count: radios.length, checked: radios.filter((radio) => radio.checked).length, minimum: Math.min(...radios.map((radio) => Math.min(radio.getBoundingClientRect().width, radio.getBoundingClientRect().height))) }; };
    return { map: inspect(browser, "beatsaver-select-map"), library: inspect(library, "library-select"), drawerWidth: drawer.getBoundingClientRect().width, gameWidth: element.getBoundingClientRect().width };
  });
  assert(landscapeMusic.map.count === 2 && landscapeMusic.map.checked === 1 && landscapeMusic.library.count === 2 && landscapeMusic.library.checked === 1 && landscapeMusic.map.minimum >= 42 && landscapeMusic.library.minimum >= 42 && landscapeMusic.drawerWidth <= landscapeMusic.gameWidth, `populated Music radios must remain checked and touch-sized at 844×390: ${JSON.stringify(landscapeMusic)}`);

  const reconnect = await game.evaluate(async (element) => { const video = element.shadowRoot.querySelector("video"); const canvas = element.shadowRoot.querySelector("canvas"); element.remove(); document.querySelector("main")?.append(element); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); return { menuOpen: element.getSnapshot().interaction.menuOpen, fresh: element.graph.input.getSnapshot().calibration.calibrationId === null, newVideo: element.shadowRoot.querySelector("video") === video, newCanvas: element.shadowRoot.querySelector("canvas") === canvas }; });
  assert(reconnect.menuOpen && reconnect.fresh && reconnect.newVideo && reconnect.newCanvas, "reconnect must create fresh interaction/service state while preserving stable surfaces");
  assert(noise.length === 0, `unexpected console noise: ${noise.join(" | ")}`);
  console.log("Mobile composed-tree shell, minimal transient cues, drawer allowlist, Music radios/actions, full start/menu pause, and responsive stable-surface validation passed.");
} finally { await browser.close(); await vite.close(); }

async function visualShellSnapshot(game) { return game.evaluate((element) => {
  const root = element.shadowRoot; const visible = (item) => { if (!(item instanceof HTMLElement) || item.hidden || item.getAttribute("aria-hidden") === "true") return false; let current = item; while (current instanceof HTMLElement) { const style = getComputedStyle(current); if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false; current = current.parentElement ?? current.getRootNode()?.host; } const style = getComputedStyle(item); const rect = item.getBoundingClientRect(); return rect.width > 1 && rect.height > 1 && style.clipPath !== "inset(50%)" && style.clip === "auto"; };
  const menu = root.querySelector("[data-role='menu-button']"); const drawer = root.querySelector("[data-role='drawer']"); const backdrop = root.querySelector("[data-role='menu-backdrop']"); const status = root.querySelector("[data-role='status']"); const cue = root.querySelector("[data-role='transient-cue']"); const video = root.querySelector("video[data-role='media']"); const hudPresenters = [...root.querySelectorAll(".hud-presenter")].filter(visible).length;
  const gameplay = element.graph?.gameplay.getSnapshot(); const input = element.graph?.input.getSnapshot(); const overlays = [menu, backdrop, drawer, status, cue].filter(visible); return { menu: visible(menu), drawer: visible(drawer), backdrop: visible(backdrop), status: visible(status), cue: visible(cue), cueText: cue?.textContent?.trim() ?? "", hudPresenters, brand: Boolean(root.querySelector(".drawer-title")), infoStatus: Boolean(root.querySelector("[data-role='info-status']")), visibleOverlayCount: overlays.length + hudPresenters, visibleOverlayText: overlays.filter((item) => item !== drawer && item !== backdrop).map((item) => item.textContent?.trim() ?? "").filter(Boolean), sessionState: gameplay?.session?.state, countdown: gameplay?.countdown, calibrationState: input?.calibration?.state, sessionStartRequested: element.sessionStartRequested, previewVisible: video.dataset.previewVisible === "true", previewOpacity: getComputedStyle(video).opacity, environmentMode: element.environmentMode, rendererBackground: element.graph?.renderer.background?.colors?.[0] ?? null, videoPlayCalls: globalThis.__mobileState?.videoPlayCalls ?? 0 };
}); }
async function composedDrawerText(game) { return game.evaluate((element) => {
  const drawer = element.shadowRoot.querySelector("[data-role='drawer']"); const result = []; const visible = (item) => { if (!(item instanceof HTMLElement) || item.hidden || item.getAttribute("aria-hidden") === "true") return false; let current = item; while (current instanceof HTMLElement) { const style = getComputedStyle(current); if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false; current = current.parentElement ?? current.getRootNode()?.host; } const style = getComputedStyle(item); const rect = item.getBoundingClientRect(); return rect.width > 1 && rect.height > 1 && style.clipPath !== "inset(50%)" && style.clip === "auto"; };
  const walk = (node) => { if (node instanceof Text) { const text = node.data.replaceAll(/\s+/gu, " ").trim(); if (text && visible(node.parentElement)) result.push(text); return; } if (!(node instanceof HTMLElement || node instanceof ShadowRoot)) return; if (node instanceof HTMLElement && !visible(node)) return; if (node instanceof HTMLElement && node.shadowRoot) walk(node.shadowRoot); for (const child of node.childNodes) walk(child); };
  walk(drawer); return [...new Set(result)];
}); }
async function shellSnapshot(game) { return game.evaluate((element) => { const root=element.shadowRoot,drawer=root.querySelector("[data-role='drawer']"),button=root.querySelector("[data-role='menu-button']"),video=root.querySelector("video"),canvas=root.querySelector("canvas"),gameRect=element.getBoundingClientRect(),videoRect=video.getBoundingClientRect(),canvasRect=canvas.getBoundingClientRect(),presenters=[...drawer.querySelectorAll("aero-prototype-selector,aero-beatsaver-browser,aero-content-import-progress,aero-content-library,aero-capabilities-panel,aero-error-panel,aero-fullscreen-button")],buttonRect=button.getBoundingClientRect(); return { menuOpen:element.getSnapshot().interaction.menuOpen,drawerVisible:!drawer.hidden,buttonWidth:buttonRect.width,buttonHeight:buttonRect.height,buttonTop:buttonRect.top-gameRect.top,presenterCount:presenters.length,compactCount:presenters.filter((item)=>item.hasAttribute("compact")).length,closedVisiblePresenterCount:presenters.filter((item)=>!drawer.hidden&&item.getClientRects().length>0).length,ariaExpanded:button.getAttribute("aria-expanded"),ariaControls:button.getAttribute("aria-controls"),drawerFocused:root.activeElement===drawer,buttonFocused:root.activeElement===button,activeRole:root.activeElement?.getAttribute?.("data-role")??root.activeElement?.tagName??null,videoStable:video===root.querySelector("video"),canvasStable:canvas===root.querySelector("canvas"),surfaceFill:Math.abs(videoRect.width-gameRect.width)<1&&Math.abs(videoRect.height-gameRect.height)<1&&Math.abs(canvasRect.width-gameRect.width)<1&&Math.abs(canvasRect.height-gameRect.height)<1}; }); }
async function stateSnapshot(game) { return game.evaluate((element) => ({ sessionState:element.graph.gameplay.getSnapshot().session.state,menuOpen:element.getSnapshot().interaction.menuOpen,audioState:globalThis.__mobileState.audioState,audioPlayCalls:globalThis.__mobileState.audioPlayCalls,audioPauseCalls:globalThis.__mobileState.audioPauseCalls,cvStopCalls:globalThis.__mobileState.cvStopCalls,videoPauseCalls:globalThis.__mobileState.videoPauseCalls })); }
async function pushPose(game, timestampMs, tPose) { await game.evaluate((element, payload) => { const base={nose:{x:.5,y:.3},left_shoulder:{x:.6,y:.4},right_shoulder:{x:.4,y:.4},left_elbow:{x:.7,y:.4},right_elbow:{x:.3,y:.4},left_wrist:payload.tPose?{x:.8,y:.4}:{x:.64,y:.62},right_wrist:payload.tPose?{x:.2,y:.4}:{x:.36,y:.62}}; globalThis.__mobileState.pose={sourceId:"mock-camera",timestampMs:payload.timestampMs,mirrored:true,landmarks:Object.entries(base).map(([name,value])=>({name,...value,confidence:.99}))}; }, { timestampMs, tPose }); await new Promise((resolve) => setTimeout(resolve, 80)); }
async function tPoseHold(game, start) { for(let offset=0;offset<=4000;offset+=250) await pushPose(game,start+offset,true); }
async function releaseHold(game, start) { for(let offset=0;offset<=4000;offset+=250) await pushPose(game,start+offset,false); }
async function calibrateAndRelease(game, start) { await tPoseHold(game,start); await releaseHold(game,start+4250); }
async function waitFor(page, predicate, timeout=3000) { const started=Date.now(); while(Date.now()-started<timeout){ if(await predicate()) return; await page.waitForTimeout(50); } throw new Error("Timed out waiting for mobile state transition"); }
function assert(value, message) { if(!value) throw new Error(message); }
