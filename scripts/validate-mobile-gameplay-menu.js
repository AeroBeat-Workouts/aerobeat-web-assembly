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
      const state = globalThis.__mobileState = { pose: undefined, audioState: "paused", audioPlayCalls: 0, audioPauseCalls: 0, cvStartCalls: 0, cvStopCalls: 0, videoPauseCalls: 0, retained: null, library: [], packageLoadCalls: [], maps: [], contentSnapshot: idleContent() };
      const content = { getSnapshot: () => state.contentSnapshot, async loadPersistenceHandle(handle) { state.packageLoadCalls.push(handle.packageId); state.contentSnapshot = readyContent(handle.packageId); }, async selectVariant(variantId) { state.contentSnapshot = { ...state.contentSnapshot, selectedVariant: state.contentSnapshot.variants.find((item) => item.variantId === variantId) ?? null }; }, async swapFutureVariant(variantId) { await this.selectVariant(variantId); }, subscribe() { return () => {}; }, setPlaybackState() {}, readAsset() { return new Uint8Array(); }, destroy() {} };
      const authoring = { getSnapshot: () => ({ state: "idle", progress: 0 }), subscribe() { return () => {}; }, async listPackages() { return state.library; }, async estimateStorage() { return { usageBytes: 0, quotaBytes: 1024 }; }, async loadPackage(handle) { return { handle, package: {} }; }, async deletePackage() { return false; }, cancel() {}, destroy() {} };
      const vendor = { snapshot: () => original.vendor.snapshot(), async searchMaps() { return { maps: state.maps }; }, async listLatestMaps() { return { maps: state.maps }; } };
      const video = {
        getRetainedCameraStream: () => state.retained,
        async requestCamera() { state.retained = await navigator.mediaDevices.getUserMedia({ video: true }); return { status: "granted", message: "ok" }; },
        attachCameraStream: () => ({ sourceKind: "live-camera", sourceId: "mock-camera", mirrored: true, currentTimeSeconds: 0, intrinsicWidth: 640, intrinsicHeight: 480, sourceAspectRatio: 4 / 3, sourceChangeId: 1 }),
        injectCameraStream(stream) { state.retained = stream; }, activateLease() {}, pauseForLease() {}, releaseLease() {},
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
  assert(initial.ariaExpanded === "true" && initial.ariaControls === "aero-game-drawer" && initial.drawerFocused, "first-run drawer must expose controls state and receive focus");
  const taxonomy = await game.evaluate((element) => {
    const root = element.shadowRoot; const drawer = root.querySelector("[data-role='drawer']");
    const sections = [...drawer.querySelectorAll(":scope > .drawer-content > .drawer-section")];
    const gameplay = drawer.querySelector("aero-prototype-selector[scope='gameplay']"); const visuals = drawer.querySelector("aero-prototype-selector[scope='visuals']");
    const gameplayChecked = gameplay.shadowRoot.querySelector("input[type='radio']:checked"); const visualsChecked = visuals.shadowRoot.querySelector("input[type='radio']:checked");
    const forbidden = [...sections].map((section) => section.innerText).join(" ").match(/schema|profile bundle|converter|scoring|ruleset|recipe|content hash|development telemetry/giu) ?? [];
    return { headings: sections.map((section) => section.querySelector(":scope > h2")?.textContent), sectionCount: sections.length, selectorCount: drawer.querySelectorAll("aero-prototype-selector[compact]").length, gameplayChecked: gameplayChecked?.value, visualsChecked: visualsChecked?.value, forbidden };
  });
  assert(JSON.stringify(taxonomy.headings) === JSON.stringify(["Gameplay", "Visuals", "Music", "Info"]) && taxonomy.sectionCount === 4, `drawer must have exactly four ordered product headings: ${JSON.stringify(taxonomy)}`);
  assert(taxonomy.selectorCount === 2 && taxonomy.gameplayChecked === "flow" && taxonomy.visualsChecked === "aero.visual.default", `scoped radio defaults must select Flow and Default: ${JSON.stringify(taxonomy)}`);
  assert(taxonomy.forbidden.length === 0, `drawer must omit development controls/text: ${taxonomy.forbidden.join(",")}`);

  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='calibrate-start']").click());
  await page.waitForTimeout(100);
  const freshGate = await game.evaluate((element) => ({ cameraRequests: globalThis.__cameraRequests, prerequisite: element.shadowRoot.querySelector("[data-role='music-prerequisite']").textContent, musicFocused: element.shadowRoot.activeElement === element.shadowRoot.querySelector("[data-section='music']"), sessionState: element.graph.gameplay.getSnapshot().session.state }));
  assert(freshGate.cameraRequests === 0 && /song/u.test(freshGate.prerequisite) && freshGate.musicFocused, `fresh Calibrate must focus one Music prerequisite without camera: ${JSON.stringify(freshGate)}`);

  const selection = await game.evaluate(async (element) => {
    const makeVersion = (hash) => ({ hash, key: hash.slice(0, 6), difficulties: [{ characteristic: "Standard", difficulty: "Expert" }] });
    const radioState = (presenter, intent) => { const radios = [...presenter.shadowRoot.querySelectorAll(`input[type='radio'][data-intent='${intent}']`)]; return { count: radios.length, checked: radios.filter((radio) => radio.checked).map((radio) => radio.value) }; };
    const browser = element.shadowRoot.querySelector("aero-beatsaver-browser"); const library = element.shadowRoot.querySelector("aero-content-library");
    globalThis.__mobileState.maps = [
      { mapId: "FIRST", mapName: "First result", songName: "First result", songAuthorName: "Artist A", levelAuthorName: "Mapper A", versions: [makeVersion("1".repeat(40))] },
      { mapId: "SECOND", mapName: "Second result", songName: "Second result", songAuthorName: "Artist B", levelAuthorName: "Mapper B", versions: [makeVersion("2".repeat(40))] }
    ];
    await element.browseBeatSaver({ text: "result" });
    const firstMapRadios = radioState(browser, "beatsaver-select-map");
    browser.shadowRoot.querySelector("input[data-intent='beatsaver-select-map'][value='SECOND']").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const selectedSearch = element.beatSaverView.selectedMap?.mapId; const selectedMapRadios = radioState(browser, "beatsaver-select-map");
    await element.browseBeatSaver({ text: "result" }); const preservedMapRadios = radioState(browser, "beatsaver-select-map");
    element.shadowRoot.querySelector("[data-action='calibrate-start']").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const searchCameraRequests = globalThis.__cameraRequests; const searchPrerequisite = element.shadowRoot.querySelector("[data-role='music-prerequisite']").textContent;
    const packageSummary = (packageId, name) => ({ packageId, name, variantCount: 1 });
    globalThis.__mobileState.library = [packageSummary("package-first", "First library song"), packageSummary("package-current", "Current library song")];
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
    const progress = element.shadowRoot.querySelector("aero-content-import-progress"); const cancel = progress.shadowRoot.querySelector("[data-intent='content-import-cancel']");
    const optionButtonCount = browser.shadowRoot.querySelectorAll("button[data-intent='beatsaver-select-map']").length + library.shadowRoot.querySelectorAll("button[data-intent='library-select']").length;
    const version = browser.shadowRoot.querySelector("[aria-label='Version']"); const difficulty = browser.shadowRoot.querySelector("[aria-label='Difficulty']");
    return { firstMapRadios, selectedSearch, selectedMapRadios, preservedMapRadios, searchCameraRequests, searchPrerequisite, preserved, preservedLoads, currentPackageRadios, radioIntentPackage, intentPackageRadios, autoSelected: element.graph.content.getSnapshot().packageId, fallbackPackageRadios, loadCalls: [...globalThis.__mobileState.packageLoadCalls], browserActions, libraryActions, optionButtonCount, cancelTag: cancel?.tagName, versionTag: version?.tagName, difficultyTag: difficulty?.tagName };
  });
  assert(selection.firstMapRadios.count === 2 && JSON.stringify(selection.firstMapRadios.checked) === JSON.stringify(["FIRST"]), `first search radio must be checked deterministically: ${JSON.stringify(selection)}`);
  assert(selection.selectedSearch === "SECOND" && selection.selectedMapRadios.count === 2 && JSON.stringify(selection.selectedMapRadios.checked) === JSON.stringify(["SECOND"]), `map radio intent must update assembly and checked state: ${JSON.stringify(selection)}`);
  assert(selection.preservedMapRadios.count === 2 && JSON.stringify(selection.preservedMapRadios.checked) === JSON.stringify(["SECOND"]), `valid current map radio must survive refreshed results: ${JSON.stringify(selection)}`);
  assert(selection.searchCameraRequests === 0 && /Import selected song/u.test(selection.searchPrerequisite), `unimported result must never be claimed playable: ${JSON.stringify(selection)}`);
  assert(selection.preserved === "package-current" && selection.preservedLoads === 0 && selection.currentPackageRadios.count === 2 && JSON.stringify(selection.currentPackageRadios.checked) === JSON.stringify(["package-current"]), `valid current library radio must be preserved: ${JSON.stringify(selection)}`);
  assert(selection.radioIntentPackage === "package-first" && selection.intentPackageRadios.count === 2 && JSON.stringify(selection.intentPackageRadios.checked) === JSON.stringify(["package-first"]), `library radio intent must update assembly and checked state: ${JSON.stringify(selection)}`);
  assert(selection.autoSelected === "package-first" && selection.fallbackPackageRadios.count === 2 && JSON.stringify(selection.fallbackPackageRadios.checked) === JSON.stringify(["package-first"]) && JSON.stringify(selection.loadCalls) === JSON.stringify(["package-first"]), `first library radio must be checked as deterministic fallback: ${JSON.stringify(selection)}`);
  assert(selection.versionTag === "SELECT" && selection.difficultyTag === "SELECT", `Version and Difficulty must remain selects: ${JSON.stringify(selection)}`);
  assert(selection.optionButtonCount === 0 && selection.cancelTag === "BUTTON" && ["Search", "Latest", "Choose local ZIP", "Import selected map"].every((label) => selection.browserActions.includes(label)) && ["Export", "Delete"].every((label) => selection.libraryActions.includes(label)), `only Music actions may remain buttons: ${JSON.stringify(selection)}`);

  const focusCycle = await game.evaluate((element) => {
    const drawer = element.shadowRoot.querySelector("[data-role='drawer']");
    const collect = (root) => [...root.querySelectorAll("*")].flatMap((item) => item instanceof HTMLElement && !item.hidden ? [...(item.matches("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])") ? [item] : []), ...(item.shadowRoot ? collect(item.shadowRoot) : [])] : []);
    const active = () => { let item = element.shadowRoot.activeElement; while (item?.shadowRoot?.activeElement) item = item.shadowRoot.activeElement; return item; };
    const controls = collect(drawer); const first = controls[0]; const last = controls.at(-1);
    last.focus(); last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, composed: true, cancelable: true })); const forward = active() === first;
    first.focus(); first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, composed: true, cancelable: true })); return { forward, backward: active() === last, nested: controls.some((control) => control.getRootNode() !== element.shadowRoot) };
  });
  assert(focusCycle.forward && focusCycle.backward && focusCycle.nested, "drawer focus trap must include nested presenter shadow controls");
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-backdrop']").click()); await page.waitForTimeout(50);
  const backdropClosed = await shellSnapshot(game); assert(!backdropClosed.menuOpen && backdropClosed.buttonFocused, "backdrop close must restore hamburger focus");
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-toggle']").click()); await page.waitForTimeout(50);

  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='calibrate-start']").click());
  await waitFor(page, async () => await page.evaluate(() => globalThis.__cameraRequests === 1 && globalThis.__mobileState.cvStartCalls >= 1));
  await pushPose(game, 1000, true); await pushPose(game, 5500, true);
  const obscured = await game.evaluate((element) => ({ menuOpen: element.getSnapshot().interaction.menuOpen, calibrationId: element.graph.input.getSnapshot().calibration.calibrationId }));
  assert(obscured.menuOpen && obscured.calibrationId === null, "configuration must suppress accidental pose calibration");

  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-close']").click());
  await calibrateAndRelease(game, 6000);
  await waitFor(page, async () => (await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)) === "playing", 6000);
  let state = await stateSnapshot(game);
  assert(state.audioState === "playing" && state.audioPlayCalls >= 1, "audio must start only after initial countdown enters play");

  await pushPose(game, 15000, true); await pushPose(game, 15250, true);
  await waitFor(page, async () => (await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)) === "paused_tracking");
  state = await stateSnapshot(game);
  assert(state.audioState === "paused", "sustained in-play T-pose must enter pose-aware pause");
  for (let offset = 500; offset <= 4000; offset += 250) await pushPose(game, 15000 + offset, true);
  await releaseHold(game, 19250);
  await waitFor(page, async () => (await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)) === "playing", 6000);

  const beforeMenu = await stateSnapshot(game);
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-toggle']").click());
  await waitFor(page, async () => ["paused_manual", "paused_tracking"].includes(await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)));
  const opened = await stateSnapshot(game);
  assert(opened.audioState === "paused" && opened.cvStopCalls === beforeMenu.cvStopCalls && opened.videoPauseCalls === beforeMenu.videoPauseCalls, "menu pause must pause audio/gameplay while retaining camera/CV/frame loop");
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-role='drawer']").focus());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const escapedShell = await shellSnapshot(game); assert(escapedShell.ariaExpanded === "false" && (escapedShell.buttonFocused || escapedShell.activeRole === "AERO-TRACKING-PAUSE"), `Escape must close drawer and yield focus to the trigger or active tracking modal: ${JSON.stringify(escapedShell)}`);
  const closed = await stateSnapshot(game);
  assert(closed.sessionState === "paused_tracking" && !closed.menuOpen, "closing menu must stay paused awaiting fresh calibration");
  await calibrateAndRelease(game, 24000);
  await waitFor(page, async () => (await game.evaluate((element) => element.graph.gameplay.getSnapshot().session.state)) === "playing", 6000);

  const closedShell = await shellSnapshot(game);
  assert(!closedShell.drawerVisible && closedShell.closedVisiblePresenterCount === 0 && closedShell.surfaceFill, "closed phone view must expose only playfield overlays/status/hamburger");
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
  console.log("Mobile four-section drawer, populated Music radios/actions, camera start, T-pose/countdown, pose/menu pause, and responsive stable-surface validation passed.");
} finally { await browser.close(); await vite.close(); }

async function shellSnapshot(game) { return game.evaluate((element) => { const root=element.shadowRoot,drawer=root.querySelector("[data-role='drawer']"),button=root.querySelector("[data-role='menu-button']"),video=root.querySelector("video"),canvas=root.querySelector("canvas"),gameRect=element.getBoundingClientRect(),videoRect=video.getBoundingClientRect(),canvasRect=canvas.getBoundingClientRect(),presenters=[...drawer.querySelectorAll("aero-prototype-selector,aero-beatsaver-browser,aero-content-import-progress,aero-content-library,aero-capabilities-panel,aero-error-panel,aero-fullscreen-button")],buttonRect=button.getBoundingClientRect(); return { menuOpen:element.getSnapshot().interaction.menuOpen,drawerVisible:!drawer.hidden,buttonWidth:buttonRect.width,buttonHeight:buttonRect.height,buttonTop:buttonRect.top-gameRect.top,presenterCount:presenters.length,compactCount:presenters.filter((item)=>item.hasAttribute("compact")).length,closedVisiblePresenterCount:presenters.filter((item)=>!drawer.hidden&&item.getClientRects().length>0).length,ariaExpanded:button.getAttribute("aria-expanded"),ariaControls:button.getAttribute("aria-controls"),drawerFocused:root.activeElement===drawer,buttonFocused:root.activeElement===button,activeRole:root.activeElement?.getAttribute?.("data-role")??root.activeElement?.tagName??null,videoStable:video===root.querySelector("video"),canvasStable:canvas===root.querySelector("canvas"),surfaceFill:Math.abs(videoRect.width-gameRect.width)<1&&Math.abs(videoRect.height-gameRect.height)<1&&Math.abs(canvasRect.width-gameRect.width)<1&&Math.abs(canvasRect.height-gameRect.height)<1}; }); }
async function stateSnapshot(game) { return game.evaluate((element) => ({ sessionState:element.graph.gameplay.getSnapshot().session.state,menuOpen:element.getSnapshot().interaction.menuOpen,audioState:globalThis.__mobileState.audioState,audioPlayCalls:globalThis.__mobileState.audioPlayCalls,audioPauseCalls:globalThis.__mobileState.audioPauseCalls,cvStopCalls:globalThis.__mobileState.cvStopCalls,videoPauseCalls:globalThis.__mobileState.videoPauseCalls })); }
async function pushPose(game, timestampMs, tPose) { await game.evaluate((element, payload) => { const base={nose:{x:.5,y:.3},left_shoulder:{x:.6,y:.4},right_shoulder:{x:.4,y:.4},left_elbow:{x:.7,y:.4},right_elbow:{x:.3,y:.4},left_wrist:payload.tPose?{x:.8,y:.4}:{x:.64,y:.62},right_wrist:payload.tPose?{x:.2,y:.4}:{x:.36,y:.62}}; globalThis.__mobileState.pose={sourceId:"mock-camera",timestampMs:payload.timestampMs,mirrored:true,landmarks:Object.entries(base).map(([name,value])=>({name,...value,confidence:.99}))}; }, { timestampMs, tPose }); await new Promise((resolve) => setTimeout(resolve, 80)); }
async function tPoseHold(game, start) { for(let offset=0;offset<=4000;offset+=250) await pushPose(game,start+offset,true); }
async function releaseHold(game, start) { for(let offset=0;offset<=4000;offset+=250) await pushPose(game,start+offset,false); }
async function calibrateAndRelease(game, start) { await tPoseHold(game,start); await releaseHold(game,start+4250); }
async function waitFor(page, predicate, timeout=3000) { const started=Date.now(); while(Date.now()-started<timeout){ if(await predicate()) return; await page.waitForTimeout(50); } throw new Error("Timed out waiting for mobile state transition"); }
function assert(value, message) { if(!value) throw new Error(message); }
