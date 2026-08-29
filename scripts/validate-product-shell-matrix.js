// @ts-check

import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parentServer = createHttpServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://parent.invalid");
  const width = Number(url.searchParams.get("width")) || 390; const height = Number(url.searchParams.get("height")) || 844;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><title>Cross-origin shell host</title><style>html,body{margin:0}iframe{border:0;display:block;width:${width}px;height:${height}px}</style><iframe id="game" allow="camera; fullscreen; autoplay" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parentServer.listen(0, "127.0.0.1", resolve));
const address = parentServer.address();
if (!address || typeof address === "string") throw new Error("Parent server unavailable");
const parentUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch();
const contexts = [
  { kind: "direct", width: 390, height: 844 }, { kind: "direct", width: 844, height: 390 },
  { kind: "iframe", width: 390, height: 844 }, { kind: "iframe", width: 844, height: 390 }
];
const evidence = [];
try {
  for (const context of contexts) evidence.push(await runContext(context));
  console.log(`Product shell matrix passed: ${evidence.map((item) => `${item.kind}:${item.width}x${item.height}`).join(", ")}`);
} finally {
  await browser.close(); await vite.close(); await new Promise((resolve) => parentServer.close(resolve));
}

/** @param {{kind:string,width:number,height:number}} context */
async function runContext(context) {
  const noise = [];
  const page = await browser.newPage({ viewport: context.kind === "direct" ? { width: context.width, height: context.height } : { width: context.width + 24, height: context.height + 24 } });
  page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
  await page.addInitScript(() => {
    globalThis.__shellMatrixCameraRequests = 0;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { async getUserMedia() { globalThis.__shellMatrixCameraRequests += 1; return new MediaStream(); } } });
  });
  let game;
  if (context.kind === "direct") {
    await page.goto(childUrl, { waitUntil: "networkidle" }); game = page.locator("aero-game");
  } else {
    await page.goto(`${parentUrl}?width=${context.width}&height=${context.height}`, { waitUntil: "networkidle" });
    game = page.frameLocator("#game").locator("aero-game");
    const origins = await game.evaluate(() => ({ child: location.origin, parent: new URL(document.referrer).origin }));
    assert(origins.child !== origins.parent, `${label(context)} must use real cross-origin iframe origins`);
  }
  await game.waitFor(); await installFixture(game);
  const initialLegacyCount = await game.evaluate((element) => { element.__shellMatrixLegacy = [...element.shadowRoot.querySelectorAll("aero-calibration-badge,aero-tracking-pause,aero-resume-countdown")]; return element.__shellMatrixLegacy.length; });
  assert(initialLegacyCount === 3, `${label(context)} must retain three stable legacy presenter nodes`);

  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='calibrate-start']").click()); await page.waitForTimeout(80);
  const fresh = await shellSnapshot(game);
  assert(fresh.cameraRequests === 0 && fresh.musicFocused && /song/u.test(fresh.musicPrerequisite), `${label(context)} fresh Music gate must focus without camera: ${JSON.stringify(fresh)}`);

  await game.evaluate(async (element) => {
    const version = (hash) => ({ hash, key: hash.slice(0, 6), difficulties: [{ characteristic: "Standard", difficulty: "Expert" }] });
    globalThis.__shellMatrixState.maps = [
      { mapId: "FIRST", mapName: "First result", songName: "First result", songAuthorName: "Artist A", levelAuthorName: "Mapper A", versions: [version("1".repeat(40))] },
      { mapId: "SECOND", mapName: "Second result", songName: "Second result", songAuthorName: "Artist B", levelAuthorName: "Mapper B", versions: [version("2".repeat(40))] }
    ];
    await element.browseBeatSaver({ text: "result" });
    globalThis.__shellMatrixState.library = [{ packageId: "package-first", name: "First library song", variantCount: 1 }, { packageId: "package-second", name: "Second library song", variantCount: 1 }];
    await element.refreshLibrary();
  });
  const drawer = await shellSnapshot(game);
  assert(drawer.mapRadios === 2 && drawer.checkedMaps === 1 && drawer.packageRadios === 2 && drawer.checkedPackages === 1 && drawer.musicFocused, `${label(context)} drawer Music/focus contract failed: ${JSON.stringify(drawer)}`);
  assert(drawer.drawerText.every((text) => !/(?:AeroBeat|schema|hash|author|mapped|storage|quota|variant|ruleset|recipe|winner|production)/iu.test(text)), `${label(context)} drawer allowlist rejected text: ${JSON.stringify(drawer.drawerText)}`);

  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-backdrop']").click()); await page.waitForTimeout(60);
  assertSteady(await shellSnapshot(game), context, "configured idle");
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-toggle']").click()); await page.waitForTimeout(30);
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='calibrate-start']").click());
  await waitFor(page, async () => (await shellSnapshot(game)).cameraRequests === 1);
  const startedOpen = await shellSnapshot(game);
  assert(startedOpen.drawer && !startedOpen.cue, `${label(context)} start must remain menu-gated`);
  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-close']").click()); await page.waitForTimeout(80);
  assertTransient(await shellSnapshot(game), context, "T-pose", "calibrating");

  for (let offset = 0; offset <= 2000; offset += 250) await pushPose(game, 6000 + offset, true);
  assertTransient(await shellSnapshot(game), context, "Hold T-pose", "hold");
  for (let offset = 2250; offset <= 4000; offset += 250) await pushPose(game, 6000 + offset, true);
  await pushPose(game, 10250, false);
  assertTransient(await shellSnapshot(game), context, "Release", "release");
  for (let offset = 500; offset <= 4000; offset += 250) await pushPose(game, 10000 + offset, false);
  await waitFor(page, async () => /^[123]$/u.test((await shellSnapshot(game)).cueText), 2500);
  const countdown = await shellSnapshot(game); assertTransient(countdown, context, countdown.cueText, "countdown");
  assert(countdown.canvasCountdown === null && countdown.canvasNumericOverlayCount === 0, `${label(context)} countdown must not reach renderer frame: ${JSON.stringify(countdown)}`);
  await waitFor(page, async () => (await shellSnapshot(game)).sessionState === "playing", 6000);
  assertSteady(await shellSnapshot(game), context, "steady play");

  await pushPose(game, 15000, true); await pushPose(game, 16250, true);
  await waitFor(page, async () => (await shellSnapshot(game)).sessionState === "paused_tracking");
  assertTransient(await shellSnapshot(game), context, "Tracking lost", "tracking pause");
  await calibrateAndRelease(game, 20000); await waitFor(page, async () => (await shellSnapshot(game)).sessionState === "playing", 6000);

  await game.evaluate((element) => element.shadowRoot.querySelector("[data-action='menu-toggle']").click()); await page.waitForTimeout(60);
  const menuPaused = await shellSnapshot(game);
  assert(menuPaused.drawer && !menuPaused.cue && menuPaused.hudPresenters === 0 && menuPaused.legacyStable && !menuPaused.statusVisible && menuPaused.statusAriaLive === "polite" && menuPaused.statusWidth <= 1 && menuPaused.statusHeight <= 1 && menuPaused.canvasCountdown === null && menuPaused.canvasOverlay === "none", `${label(context)} menu-open pause must suppress gameplay/canvas cues and preserve hidden accessible nodes: ${JSON.stringify(menuPaused)}`);
  await page.keyboard.press("Escape"); await page.waitForTimeout(60);
  const recovery = await shellSnapshot(game); assertTransient(recovery, context, "Tracking lost", "close/recovery");
  assert(recovery.buttonFocused, `${label(context)} Escape must restore corner-control focus`);
  await calibrateAndRelease(game, 30000); await waitFor(page, async () => (await shellSnapshot(game)).sessionState === "playing", 6000);
  assertSteady(await shellSnapshot(game), context, "resumed play");

  const policy = await game.evaluate((element) => {
    const snapshot = element.getSnapshot(); const serialized = JSON.stringify(snapshot); const containsWinnerKey = (value) => value && typeof value === "object" && (Reflect.ownKeys(value).some((key) => key === "winner" || key === "productionWinner") || Object.values(value).some(containsWinnerKey));
    const oldGraph = element.graph; const video = element.shadowRoot.querySelector("video"); const canvas = element.shadowRoot.querySelector("canvas"); const parent = element.parentElement; element.remove(); parent.append(element);
    return new Promise((resolve) => setTimeout(() => resolve({ noWinner: !containsWinnerKey(snapshot) && !/production.?winner/iu.test(serialized), private: !/prototype_profile_bundle|MediaStream|VideoFrame|screenshots|zipBytes|audioBytes/iu.test(serialized), generationFresh: element.graph !== oldGraph, surfacesStable: video === element.shadowRoot.querySelector("video") && canvas === element.shadowRoot.querySelector("canvas") }), 80));
  });
  assert(policy.noWinner && policy.private && policy.generationFresh && policy.surfacesStable, `${label(context)} lifecycle/privacy/no-winner policy failed: ${JSON.stringify(policy)}`);
  assert(noise.length === 0, `${label(context)} emitted unexpected console noise: ${noise.join(" | ")}`);
  await page.close(); return context;
}

/** @param {import("playwright").Locator} game */
async function installFixture(game) {
  await game.evaluate((element) => {
    const originalFactory = element.serviceGraphFactory; element.remove();
    element.serviceGraphFactory = (options) => {
      const original = originalFactory(options); const hash = "a".repeat(64);
      const variant = (packageId) => ({ variantId: `${packageId}-flow`, chartId: `${packageId}-chart`, mode: "flow", rulesetId: "flow_grid_v1", recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { baseVariantId: `${packageId}-flow` } });
      const idle = () => ({ state: "idle", packageId: null, selectedVariant: null, variants: [], resolvedEvents: [], song: null, background: null, lineage: null });
      const ready = (packageId) => { const selectedVariant = variant(packageId); return { state: "ready", packageId, selectedVariant, variants: [selectedVariant], resolvedEvents: [], song: { name: packageId }, background: null, lineage: null }; };
      const state = globalThis.__shellMatrixState = { pose: undefined, retained: null, library: [], maps: [], contentSnapshot: idle(), audioState: "paused" };
      const content = { getSnapshot: () => state.contentSnapshot, async loadPersistenceHandle(handle) { state.contentSnapshot = ready(handle.packageId); }, async selectVariant(variantId) { state.contentSnapshot = { ...state.contentSnapshot, selectedVariant: state.contentSnapshot.variants.find((item) => item.variantId === variantId) ?? null }; }, async swapFutureVariant(variantId) { await this.selectVariant(variantId); }, subscribe() { return () => {}; }, setPlaybackState() {}, readAsset() { return new Uint8Array(); }, destroy() {} };
      const authoring = { getSnapshot: () => ({ state: "idle", progress: 0 }), subscribe() { return () => {}; }, async listPackages() { return state.library; }, async estimateStorage() { return { usageBytes: 0, quotaBytes: 1024 }; }, async loadPackage(handle) { return { handle, package: {} }; }, async deletePackage() { return false; }, cancel() {}, destroy() {} };
      const vendor = { snapshot: () => original.vendor.snapshot(), async searchMaps() { return { maps: state.maps }; }, async listLatestMaps() { return { maps: state.maps }; } };
      const video = { getRetainedCameraStream: () => state.retained, async requestCamera() { state.retained = await navigator.mediaDevices.getUserMedia({ video: true }); return { status: "granted", message: "ok" }; }, attachCameraStream: () => ({ sourceKind: "live-camera", sourceId: "matrix-camera", mirrored: true, currentTimeSeconds: 0, intrinsicWidth: 640, intrinsicHeight: 480, sourceAspectRatio: 4 / 3, sourceChangeId: 1 }), injectCameraStream(stream) { state.retained = stream; }, activateLease() {}, pauseForLease() {}, releaseLease() {}, describeStatus: () => ({ state: "ready", sourceChangeId: 1 }), describeSurface: () => ({ sourceId: "matrix-camera", mirrored: true, sourceChangeId: 1, sourceAspectRatio: 4 / 3 }), pause() {}, setDocumentHidden() {}, destroy() {} };
      const cv = { async start() {}, async stop() {}, async dispose() {}, getLatestPoseFrame: () => state.pose, getStatus: () => ({ lifecycleState: "running" }) };
      const audio = { async activateLease() {}, async releaseLease() {}, async pauseForLease() { state.audioState = "paused"; }, async play() { state.audioState = "playing"; }, async pause() { state.audioState = "paused"; }, async stop() { state.audioState = "stopped"; }, async setDocumentHidden(hidden) { if (hidden) state.audioState = "paused"; }, async destroy() {}, getStatus: () => ({ state: state.audioState, autoplayState: "allowed" }), getClockSnapshot: () => ({ contextTimeSeconds: performance.now() / 1000, positionSeconds: 0, playing: state.audioState === "playing" }) };
      return Object.freeze({ ...original, vendor, authoring, content, video, cv, audio });
    };
    document.querySelector("main")?.append(element);
  });
}

/** @param {import("playwright").Locator} game */
async function shellSnapshot(game) { return game.evaluate((element) => {
  const root = element.shadowRoot; const visible = (item) => { if (!(item instanceof HTMLElement) || item.hidden || item.getAttribute("aria-hidden") === "true") return false; let current = item; while (current instanceof HTMLElement) { const style = getComputedStyle(current); if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false; current = current.parentElement ?? current.getRootNode()?.host; } const style = getComputedStyle(item); const rect = item.getBoundingClientRect(); return rect.width > 1 && rect.height > 1 && style.clipPath !== "inset(50%)" && style.clip === "auto"; };
  const directText = []; const controls = []; const walk = (node, overlay) => { if (node instanceof Text) { const text = node.data.replaceAll(/\s+/gu, " ").trim(); if (overlay && text && visible(node.parentElement)) directText.push(text); return; } if (!(node instanceof HTMLElement || node instanceof ShadowRoot)) return; if (node instanceof HTMLElement && !visible(node)) return; const nextOverlay = overlay || (node instanceof HTMLElement && (node.matches(".hud,[data-role='status'],[data-role='menu-button'],[data-role='menu-backdrop'],[data-role='drawer']"))); if (node instanceof HTMLElement && nextOverlay && node.matches("button,input,select,[role='status'],[role='alert'],[role='dialog']")) controls.push({ tag: node.tagName, role: node.getAttribute("role") ?? "", label: node.getAttribute("aria-label") ?? "", text: node.textContent?.replaceAll(/\s+/gu, " ").trim() ?? "" }); if (node instanceof HTMLElement && node.shadowRoot) walk(node.shadowRoot, nextOverlay); for (const child of node.childNodes) walk(child, nextOverlay); };
  walk(root, false);
  const hostRect = element.getBoundingClientRect(); const surfaces = [...root.querySelectorAll("video,canvas")].map((surface) => surface.getBoundingClientRect()); const menu = root.querySelector("[data-role='menu-button']"); const menuRect = menu.getBoundingClientRect(); const menuStyle = getComputedStyle(menu); const cue = root.querySelector("[data-role='transient-cue']"); const status = root.querySelector("[data-role='status']"); const statusRect = status.getBoundingClientRect(); const legacy = [...root.querySelectorAll("aero-calibration-badge,aero-tracking-pause,aero-resume-countdown")]; const drawer = root.querySelector("[data-role='drawer']"); const frame = element.rendererFrame(); const snapshot = element.graph.gameplay.getSnapshot(); const inputSnapshot = element.graph.input.getSnapshot();
  const drawerText = directText.filter((text) => visible(drawer));
  return { sessionState: snapshot.session.state, countdown: snapshot.countdown, calibrationState: inputSnapshot.calibration?.state, latestPoseTimestampMs: element.latestPoseTimestampMs, fixturePoseTimestamp: globalThis.__shellMatrixState?.pose?.timestampMs, frameTimer: element.frameTimer, menu: visible(menu), menuWidth: menuRect.width, menuHeight: menuRect.height, menuTop: menuRect.top - hostRect.top, menuRight: hostRect.right - menuRect.right, surfacesExact: surfaces.length === 2 && surfaces.every((rect) => rect.width === hostRect.width && rect.height === hostRect.height && rect.left === hostRect.left && rect.top === hostRect.top), menuBackground: menuStyle.backgroundColor, buttonFocused: root.activeElement === menu, drawer: visible(drawer), drawerFocused: root.activeElement === drawer, cue: visible(cue), cueText: cue.textContent?.trim() ?? "", statusVisible: visible(status), statusAriaLive: status.getAttribute("aria-live"), statusWidth: statusRect.width, statusHeight: statusRect.height, statusClip: getComputedStyle(status).clipPath, hudPresenters: legacy.filter(visible).length, legacyStable: legacy.every((node, index) => node === element.__shellMatrixLegacy[index] && node.getAttribute("aria-hidden") === "true" && getComputedStyle(node).display === "none"), controls, visibleTexts: [...new Set(directText.filter((text) => !visible(drawer)))], drawerText: [...new Set(drawerText)], canvasCountdown: frame.countdown, canvasOverlay: frame.overlay, canvasNumericOverlayCount: frame.countdown === null ? 0 : 1, cameraRequests: globalThis.__shellMatrixCameraRequests, musicPrerequisite: root.querySelector("[data-role='music-prerequisite']")?.textContent ?? "", musicFocused: root.activeElement === root.querySelector("[data-section='music']"), mapRadios: root.querySelector("aero-beatsaver-browser")?.shadowRoot?.querySelectorAll("input[type='radio']").length ?? 0, checkedMaps: root.querySelector("aero-beatsaver-browser")?.shadowRoot?.querySelectorAll("input[type='radio']:checked").length ?? 0, packageRadios: root.querySelector("aero-content-library")?.shadowRoot?.querySelectorAll("input[type='radio']").length ?? 0, checkedPackages: root.querySelector("aero-content-library")?.shadowRoot?.querySelectorAll("input[type='radio']:checked").length ?? 0 };
}); }

function assertSteady(snapshot, context, state) {
  assert(snapshot.menu && !snapshot.drawer && !snapshot.cue && !snapshot.statusVisible && snapshot.hudPresenters === 0 && snapshot.legacyStable, `${label(context)} ${state} hidden chrome failed: ${JSON.stringify(snapshot)}`);
  assert(snapshot.surfacesExact && snapshot.menuWidth === 48 && snapshot.menuHeight === 48 && [8, 12].includes(snapshot.menuTop) && [8, 12].includes(snapshot.menuRight) && snapshot.menuBackground !== "rgba(0, 0, 0, 0)", `${label(context)} ${state} exact corner control failed: ${JSON.stringify(snapshot)}`);
  assert(JSON.stringify(snapshot.visibleTexts) === JSON.stringify(["☰"]) && snapshot.controls.length === 1 && snapshot.controls[0].tag === "BUTTON", `${label(context)} ${state} exact composed UI failed: ${JSON.stringify(snapshot)}`);
  assert(snapshot.canvasCountdown === null && snapshot.canvasOverlay === "none" && snapshot.canvasNumericOverlayCount === 0, `${label(context)} ${state} canvas overlay failed: ${JSON.stringify(snapshot)}`);
  assert(snapshot.statusAriaLive === "polite" && snapshot.statusWidth <= 1 && snapshot.statusHeight <= 1 && snapshot.statusClip === "inset(50%)", `${label(context)} ${state} aria-live clipping failed: ${JSON.stringify(snapshot)}`);
}
function assertTransient(snapshot, context, expected, state) {
  assert(snapshot.menu && !snapshot.drawer && snapshot.cue && snapshot.cueText === expected && !snapshot.statusVisible && snapshot.hudPresenters === 0 && snapshot.legacyStable, `${label(context)} ${state} transient visibility failed: ${JSON.stringify(snapshot)}`);
  assert(JSON.stringify([...snapshot.visibleTexts].sort()) === JSON.stringify(["☰", expected].sort()) && snapshot.controls.length === 2 && snapshot.controls.filter((control) => control.role === "status").length === 1, `${label(context)} ${state} exact transient composition failed: ${JSON.stringify(snapshot)}`);
  assert(snapshot.surfacesExact && snapshot.menuWidth === 48 && snapshot.menuHeight === 48 && [8, 12].includes(snapshot.menuTop) && [8, 12].includes(snapshot.menuRight) && snapshot.menuBackground !== "rgba(0, 0, 0, 0)", `${label(context)} ${state} exact corner control failed: ${JSON.stringify(snapshot)}`);
  assert(snapshot.statusAriaLive === "polite" && snapshot.statusWidth <= 1 && snapshot.statusHeight <= 1 && snapshot.statusClip === "inset(50%)", `${label(context)} ${state} aria-live clipping failed: ${JSON.stringify(snapshot)}`);
  assert(snapshot.canvasCountdown === null && snapshot.canvasOverlay === "none" && snapshot.canvasNumericOverlayCount === 0, `${label(context)} ${state} must have zero canvas overlay: ${JSON.stringify(snapshot)}`);
}
/** @param {import("playwright").Locator} game @param {number} timestampMs @param {boolean} tPose */
async function pushPose(game, timestampMs, tPose) { await game.evaluate((_element, { timestampMs, tPose }) => { const y = tPose ? .4 : .58; const base = { nose:{x:.5,y:.2},left_shoulder:{x:.35,y:.4},right_shoulder:{x:.65,y:.4},left_elbow:{x:.2,y},right_elbow:{x:.8,y},left_wrist:{x:.05,y},right_wrist:{x:.95,y},left_hip:{x:.43,y:.68},right_hip:{x:.57,y:.68} }; globalThis.__shellMatrixState.pose = { sourceId:"matrix-camera",timestampMs,mirrored:true,landmarks:Object.entries(base).map(([name,value])=>({name,...value,confidence:.99})) }; }, { timestampMs, tPose }); await new Promise((resolve) => setTimeout(resolve, 80)); }
/** @param {import("playwright").Locator} game @param {number} start */
async function calibrateAndRelease(game, start) { for (let offset=0;offset<=4000;offset+=250) await pushPose(game,start+offset,true); for(let offset=0;offset<=4000;offset+=250) await pushPose(game,start+4250+offset,false); }
async function waitFor(page, predicate, timeout=3500) { const started=Date.now(); while(Date.now()-started<timeout){ if(await predicate()) return; await page.waitForTimeout(40); } throw new Error("Timed out waiting for shell matrix state"); }
function label(context) { return `${context.kind}:${context.width}x${context.height}`; }
function assert(value, message) { if (!value) throw new Error(message); }
