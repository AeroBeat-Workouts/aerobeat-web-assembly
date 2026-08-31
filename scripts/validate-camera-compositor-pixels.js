// @ts-check

import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parentServer = createHttpServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://parent.invalid"); const width = Number(url.searchParams.get("width")) || 390; const height = Number(url.searchParams.get("height")) || 844;
  response.setHeader("content-type", "text/html; charset=utf-8"); response.end(`<!doctype html><style>html,body{margin:0}iframe{border:0;display:block;width:${width}px;height:${height}px}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parentServer.listen(0, "127.0.0.1", resolve));
const address = parentServer.address(); if (!address || typeof address === "string") throw new Error("Parent server unavailable");
const parentUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch();
try {
  for (const dpr of [1, 3]) for (const kind of ["direct", "iframe"]) for (const [width, height] of [[390, 844], [844, 390]]) await validateClosePixels({ dpr, kind, width, height });
  await validateMovingCameraComposition();
  console.log("Close glyph DPR1/3 framebuffer mask and moving mirrored camera compositor validation passed.");
} finally { await browser.close(); await vite.close(); await new Promise((resolve) => parentServer.close(resolve)); }

/** @param {{dpr:number,kind:string,width:number,height:number}} context */
async function validateClosePixels(context) {
  const page = await browser.newPage({ viewport: { width: context.kind === "direct" ? context.width : context.width + 20, height: context.kind === "direct" ? context.height : context.height + 20 }, deviceScaleFactor: context.dpr });
  try {
    const game = await openGame(page, context); await game.evaluate((element) => element.setMenuOpen(true));
    const button = game.locator("[data-role='menu-button']");
    const style = await button.evaluate((element) => { const icon = element.querySelector(".menu-icon"); const before = getComputedStyle(icon, "::before"); const after = getComputedStyle(icon, "::after"); const own = getComputedStyle(element); return { state: element.dataset.menuState, label: element.getAttribute("aria-label"), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, background: own.backgroundColor, foreground: own.color, before: { width: before.width, height: before.height, color: before.backgroundColor }, after: { width: after.width, height: after.height, color: after.backgroundColor } }; });
    const pixels = await decodeButton(await button.screenshot(), context.dpr);
    const contrast = colorContrast(style.before.color, style.background);
    assert(style.state === "open" && style.label === "Close configuration menu" && style.width === 48 && style.height === 48, `${label(context)} close semantics/geometry failed: ${JSON.stringify(style)}`);
    assert(style.foreground === "rgb(255, 255, 255)" && style.before.width === "24px" && style.before.height === "4px" && style.before.color === "rgb(255, 255, 255)" && JSON.stringify(style.before) === JSON.stringify(style.after), `${label(context)} close bars must be explicit paired 24x4 white geometry: ${JSON.stringify(style)}`);
    assert(contrast >= 7 && pixels.width === 48 * context.dpr && pixels.height === 48 * context.dpr && pixels.maskCount >= 140 * context.dpr * context.dpr && pixels.pureWhiteCount >= 80 * context.dpr * context.dpr && pixels.centerFilled && pixels.minimumCenterStrokeCssPx >= 3 && pixels.quadrants.every(Boolean), `${label(context)} close framebuffer X mask failed: ${JSON.stringify({ contrast, pixels })}`);
  } finally { await page.close(); }
}

async function validateMovingCameraComposition() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(childUrl, { waitUntil: "networkidle" }); const game = page.locator("aero-game"); await game.waitFor();
    const started = await game.evaluate(async (element) => {
      element.setMenuOpen(false);
      const hash = "a".repeat(64); const selectedVariant = { variantId: "camera-proof-flow", chartId: "camera-proof-chart", mode: "flow", rulesetId: "flow_grid_v1", recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { baseVariantId: "camera-proof-flow" } };
      const scoring = element.graph.profiles.getActive("between_run_ruleset"); element.graph.gameplay.configureContent({ packageId: "camera-proof", selectedVariant, resolvedEvents: [], profileIdentity: scoring.identity, scoringSettings: scoring.settings });
      const source = document.createElement("canvas"); source.width = 320; source.height = 240; const stream = source.captureStream(0); globalThis.__cameraPixelProof = { source, track: stream.getVideoTracks()[0] };
      paint("first"); element.injectCameraStream(stream, { sourceId: "camera-pixel-proof", mirrored: true }); element.startCv = async () => {}; await element.start();
      await new Promise((resolve) => setTimeout(resolve, 120)); element.syncCameraPresentation(); element.graph.renderer.renderGameplayFrame(element.rendererFrame());
      const video = element.shadowRoot.querySelector("video"); return { session: element.graph.gameplay.getSnapshot().session.state, preview: video.dataset.previewVisible, paused: video.paused, opacity: getComputedStyle(video).opacity, transform: getComputedStyle(video).transform, background: element.graph.renderer.background.colors[0] };
      function paint(frame) { const context = source.getContext("2d"); context.fillStyle = frame === "first" ? "#ff0000" : "#0000ff"; context.fillRect(0, 0, 160, 240); context.fillStyle = frame === "first" ? "#00ff00" : "#ffff00"; context.fillRect(160, 0, 160, 240); globalThis.__cameraPixelProof.track.requestFrame(); }
    });
    assert(started.session === "calibrating" && started.preview === "true" && !started.paused && started.opacity === "1" && started.transform.startsWith("matrix(-1") && started.background === "#00000000", `initial calibration preview contract failed: ${JSON.stringify(started)}`);
    const first = await sampleGame(page, game); assert(mirroredPair(first, "green", "red"), `first calibration frame must be visibly mirrored under transparent WebGL: ${JSON.stringify(first)}`);
    await game.evaluate(() => { const { source, track } = globalThis.__cameraPixelProof; const context = source.getContext("2d"); context.fillStyle = "#0000ff"; context.fillRect(0, 0, 160, 240); context.fillStyle = "#ffff00"; context.fillRect(160, 0, 160, 240); track.requestFrame(); }); await page.waitForTimeout(100);
    const second = await sampleGame(page, game); assert(mirroredPair(second, "yellow", "blue") && JSON.stringify(first) !== JSON.stringify(second), `moving calibration frame must update and remain mirrored: ${JSON.stringify({ first, second })}`);
    const countdown = await game.evaluate(async (element) => {
      const base = performance.now() + 100; for (let offset = 0; offset <= 4000; offset += 250) element.graph.input.processPoseSample(pose(base + offset, true), { sourceAspectRatio: 4 / 3, sourceChangeId: element.lastCameraIdentity }); element.graph.input.processPoseSample(pose(base + 4250, false), { sourceAspectRatio: 4 / 3, sourceChangeId: element.lastCameraIdentity }); await new Promise((resolve) => setTimeout(resolve, 180)); const video = element.shadowRoot.querySelector("video"); const snapshot = element.getSnapshot(); return { state: element.graph.gameplay.getSnapshot().session.state, preview: video.dataset.previewVisible, opacity: getComputedStyle(video).opacity, background: element.graph.renderer.background.colors[0], private: !JSON.stringify(snapshot).match(/cameraPixelProof|pixels|screenshots|videoFrame|mediaStream/iu) };
      function pose(timestampMs, tPose) { const y = tPose ? .4 : .58; const points = { nose:{x:.5,y:.2},left_shoulder:{x:.35,y:.4},right_shoulder:{x:.65,y:.4},left_elbow:{x:.2,y},right_elbow:{x:.8,y},left_wrist:{x:.05,y},right_wrist:{x:.95,y} }; return { sourceId:"camera-pixel-proof",timestampMs,mirrored:true,landmarks:Object.entries(points).map(([name,value])=>({name,...value,confidence:.99})) }; }
    });
    assert(countdown.state === "countdown" && countdown.preview === "false" && countdown.opacity === "0" && countdown.background === "#071426" && countdown.private, `fresh calibration must hide default preview immediately and remain private: ${JSON.stringify(countdown)}`);
    const camera = await game.evaluate(async (element) => { element.shadowRoot.querySelector("input[value='camera'][data-action='environment-select']").click(); await new Promise((resolve) => setTimeout(resolve, 40)); const video = element.shadowRoot.querySelector("video"); return { mode: element.environmentMode, preview: video.dataset.previewVisible, paused: video.paused, background: element.graph.renderer.background.colors[0], retained: Boolean(element.graph.video.getRetainedCameraStream()) }; });
    assert(camera.mode === "camera" && camera.preview === "true" && !camera.paused && camera.background === "#00000000" && camera.retained, `Camera environment must reuse retained playing stream during calibrated state: ${JSON.stringify(camera)}`);
    const selected = await sampleGame(page, game); assert(mirroredPair(selected, "yellow", "blue"), `Camera environment must keep moving mirrored feed below WebGL: ${JSON.stringify(selected)}`);
    const lifecycle = await game.evaluate(async (element) => { const stream = element.graph.video.getRetainedCameraStream(); const video = element.shadowRoot.querySelector("video"); await element.pause("pixel-proof"); const paused = video.paused; await element.resume(); const resumed = !video.paused; Object.defineProperty(document, "hidden", { configurable: true, value: true }); await element.applyVisibility(); const hidden = video.paused && video.dataset.previewVisible === "false"; Object.defineProperty(document, "hidden", { configurable: true, value: false }); await element.applyVisibility(); const restored = !video.paused && video.dataset.previewVisible === "true"; return { paused, resumed, hidden, restored, sameStream: stream === element.graph.video.getRetainedCameraStream() }; });
    assert(lifecycle.paused && lifecycle.resumed && lifecycle.hidden && lifecycle.restored && lifecycle.sameStream, `pause/resume/document visibility must explicitly pause/play retained Camera stream without reacquire: ${JSON.stringify(lifecycle)}`);
    const aero = await game.evaluate((element) => { const retained = element.graph.video.getRetainedCameraStream(); element.shadowRoot.querySelector("input[value='aero'][data-action='environment-select']").click(); const video = element.shadowRoot.querySelector("video"); const gameplay = element.graph.gameplay.getSnapshot(); const forced = element.cameraPreviewForced(); return { mode: element.environmentMode, preview: video.dataset.previewVisible, background: element.graph.renderer.background.colors[0], sameStream: retained === element.graph.video.getRetainedCameraStream(), forced, sessionState: gameplay.session.state, freshCalibrationRequired: gameplay.safety.freshCalibrationRequired }; });
    const opaqueAero = aero.preview === "false" && aero.background === "#071426" && !aero.forced;
    const safeRecovery = aero.preview === "true" && aero.background === "#00000000" && aero.forced && (aero.sessionState === "calibrating" || aero.sessionState === "paused_tracking" || aero.freshCalibrationRequired);
    assert(aero.mode === "aero" && aero.sameStream && (opaqueAero || safeRecovery), `Aero must restore opaque projection or retain the required recovery preview without camera reacquire: ${JSON.stringify(aero)}`);
  } finally { await page.close(); }
}

/** @param {import("playwright").Page} page @param {{kind:string,width:number,height:number}} context */
async function openGame(page, context) { if (context.kind === "direct") { await page.goto(childUrl, { waitUntil: "networkidle" }); return page.locator("aero-game"); } await page.goto(`${parentUrl}?width=${context.width}&height=${context.height}`, { waitUntil: "networkidle" }); return page.frameLocator("#game").locator("aero-game"); }
/** @param {Buffer} png @param {number} dpr */
async function decodeButton(png, dpr) { const page = await browser.newPage(); try { await page.setContent(`<img id="source" src="data:image/png;base64,${png.toString("base64")}">`); return await page.evaluate(async (scale) => { const image = document.querySelector("#source"); await image.decode(); const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data; const threshold = (x, y) => { const index = (y * canvas.width + x) * 4; return .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2] >= 220; }; let maskCount = 0; let pureWhiteCount = 0; const margin = 8 * scale; const quadrants = [false, false, false, false]; for (let y = margin; y < canvas.height - margin; y += 1) for (let x = margin; x < canvas.width - margin; x += 1) if (threshold(x, y)) { maskCount += 1; const index = (y * canvas.width + x) * 4; if (pixels[index] === 255 && pixels[index + 1] === 255 && pixels[index + 2] === 255) pureWhiteCount += 1; quadrants[(y < canvas.height / 2 ? 0 : 2) + (x < canvas.width / 2 ? 0 : 1)] = true; } let centerRun = 0; let maximumRun = 0; const centerX = Math.floor(canvas.width / 2); for (let y = margin; y < canvas.height - margin; y += 1) { if (threshold(centerX, y)) { centerRun += 1; maximumRun = Math.max(maximumRun, centerRun); } else centerRun = 0; } return { width: canvas.width, height: canvas.height, maskCount, pureWhiteCount, centerFilled: threshold(centerX, Math.floor(canvas.height / 2)), minimumCenterStrokeCssPx: maximumRun / scale, quadrants }; }, dpr); } finally { await page.close(); } }
/** @param {import("playwright").Page} page @param {import("playwright").Locator} game */
async function sampleGame(page, game) { const png = await game.screenshot(); const decoder = await browser.newPage(); try { await decoder.setContent(`<img id="source" src="data:image/png;base64,${png.toString("base64")}">`); return await decoder.evaluate(async () => { const image = document.querySelector("#source"); await image.decode(); const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); const pixel = (x, y) => [...context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data]; return { left: pixel(.25, .05), right: pixel(.75, .05) }; }); } finally { await decoder.close(); } }
/** @param {{left:number[],right:number[]}} sample @param {"green"|"yellow"} left @param {"red"|"blue"} right */
function mirroredPair(sample, left, right) { const dominant = (pixel, color) => color === "red" ? pixel[0] > 180 && pixel[1] < 70 && pixel[2] < 70 : color === "green" ? pixel[1] > 180 && pixel[0] < 70 && pixel[2] < 70 : color === "blue" ? pixel[2] > 180 && pixel[0] < 70 && pixel[1] < 70 : pixel[0] > 180 && pixel[1] > 180 && pixel[2] < 70; return dominant(sample.left, left) && dominant(sample.right, right); }
function colorContrast(foreground, background) { const luminance = (color) => { const channels = (color.match(/[\d.]+/gu) ?? []).slice(0, 3).map((channel) => { const value = Number(channel) / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }); return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]; }; const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); }
function label(context) { return `${context.kind}:${context.width}x${context.height}@${context.dpr}x`; }
function assert(value, message) { if (!value) throw new Error(message); }
