// @ts-check

import { chromium } from "playwright";
import { createServer as createHttpServer } from "node:http";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parentServer = createHttpServer((request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><iframe id="game" allow="camera; fullscreen; autoplay" src="${childUrl}"></iframe><script>window.messages=[];addEventListener('message',event=>messages.push({origin:event.origin,data:event.data}));</script>`);
});
await new Promise((resolve) => parentServer.listen(0, "127.0.0.1", resolve));
const address = parentServer.address();
if (!address || typeof address === "string") throw new Error("Parent server unavailable");
const parentUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch();
const noise = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}: ${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`pageerror: ${error.message}`));
  await page.goto(childUrl, { waitUntil: "networkidle" });
  await page.locator("aero-game").waitFor();
  const direct = await page.locator("aero-game").evaluate((game) => {
    const snapshot = game.getSnapshot();
    const parent = game.parentElement.getBoundingClientRect();
    return { snapshot, bounds: game.getBoundingClientRect().toJSON(), parent: parent.toJSON(), aliasCount: document.querySelectorAll("aerobeat-app").length };
  });
  if (direct.aliasCount !== 0 || direct.snapshot.lifecycle !== "connected") throw new Error("Public root was not aero-game only");
  if (direct.snapshot.cvProfile.model !== "Pose Landmarker Lite float16 /1/" || direct.snapshot.cvProfile.runtimeVersion !== "1.0.1" || direct.snapshot.cvProfile.submissionCadenceTargetFps !== 15) throw new Error("Locked CV proof mismatch");
  if (Math.abs(direct.bounds.width - direct.parent.width) > 1 || Math.abs(direct.bounds.height - direct.parent.height) > 1) throw new Error("aero-game did not fill its parent");

  const reconnect = await page.locator("aero-game").evaluate(async (game) => {
    const firstGeneration = game.getSnapshot().generation;
    const canvas = game.shadowRoot.querySelector("canvas[data-role='renderer']");
    const video = game.shadowRoot.querySelector("video[data-role='media']");
    await game.configure({});
    let fullscreenRequests = 0; game.requestFullscreen = async () => { fullscreenRequests += 1; };
    await game.enterFullscreen();
    const stable = canvas === game.shadowRoot.querySelector("canvas[data-role='renderer']") && video === game.shadowRoot.querySelector("video[data-role='media']");
    const parent = game.parentElement; game.remove(); parent.append(game); await new Promise((resolve) => setTimeout(resolve, 30));
    return { firstGeneration, secondGeneration: game.getSnapshot().generation, stable, lifecycle: game.getSnapshot().lifecycle, fullscreenRequests };
  });
  if (!reconnect.stable || reconnect.secondGeneration <= reconnect.firstGeneration || reconnect.lifecycle !== "connected" || reconnect.fullscreenRequests !== 1) throw new Error("Reconnect/stable surfaces/fullscreen failed");

  const integration = await page.evaluate(async () => {
    document.querySelector("aero-game")?.remove();
    const log = [];
    const variants = ["flow", "semantic-row", "spatial-row", "semantic-cut", "spatial-cut"].map((variantId) => ({ variantId, mode: variantId === "flow" ? "flow" : "boxing" }));
    function factory({ instanceId }) {
      let selected = variants[0]; let destroyed = false; let lease = "inactive";
      const contentSnapshot = () => ({ schema: "aerobeat/content_runtime_snapshot", version: 1, state: "ready", generation: 1, source: null, lineage: null, packageId: "fixture", packageHash: null, song: null, variants, selectedVariant: selected, resolvedEvents: [], playback: { state: "paused", positionMs: 0, judgedEventIds: [], activeEventIds: [] }, assets: [], theme: null, background: { kind: "css-fallback" }, capabilities: {}, error: null });
      return {
        instanceId,
        vendor: { snapshot: () => ({ phase: "idle" }), searchMaps: async () => ({ maps: [] }) },
        authoring: { getSnapshot: () => ({ state: "idle" }), subscribe: (fn) => { fn({ state: "idle" }); return () => {}; }, cancel: () => true, destroy: () => { destroyed = true; } },
        content: { getSnapshot: contentSnapshot, subscribe: (fn) => { fn(contentSnapshot()); return () => {}; }, async selectVariant(id) { selected = variants.find((entry) => entry.variantId === id); }, destroy() {} },
        video: { retained: null, getRetainedCameraStream() { return this.retained; }, async requestCamera() { this.retained = new MediaStream(); return { status: "granted", message: "ok" }; }, attachCameraStream() { return { sourceKind: "live-camera", sourceId: "fake", mirrored: true, currentTimeSeconds: 0, intrinsicWidth: 640, intrinsicHeight: 480, sourceAspectRatio: 4 / 3, sourceChangeId: 1 }; }, injectCameraStream(stream) { this.retained = stream; }, activateLease() { lease = "active"; log.push(`${instanceId}:activate`); }, pauseForLease() { lease = "paused"; log.push(`${instanceId}:pause`); }, releaseLease() { lease = "released"; log.push(`${instanceId}:release`); }, describeStatus: () => ({ leaseState: lease, sourceChangeId: 1 }), describeSurface: () => ({ sourceAspectRatio: 4 / 3 }), pause() {}, setDocumentHidden(value) { log.push(`${instanceId}:hidden:${value}`); }, destroy() { destroyed = true; } },
        cv: { async start() {}, async stop() {}, async dispose() { destroyed = true; }, getLatestPoseFrame: () => undefined, getStatus: () => ({ lifecycleState: "idle" }) },
        input: { resetCalibration() {}, getSnapshot: () => ({ calibration: {}, tracking: {}, anchors: [], entries: [], latestEvidence: null, straightQualifications: [] }), subscribe: (fn) => { fn({}); return () => {}; }, advanceTime() {}, destroy() {} },
        audio: { async activateLease() {}, async pauseForLease() {}, async releaseLease() {}, async play() {}, async pause() {}, async stop() {}, async setDocumentHidden(value) { log.push(`${instanceId}:audio-hidden:${value}`); }, async destroy() { destroyed = true; }, getStatus: () => ({ state: "ready" }), getClockSnapshot: () => ({ positionSeconds: 0, playing: false }) },
        gameplay: { requestStart() {}, pause() {}, resume() {}, stop() {}, reset() {}, configureContent() {}, advance() {}, getSnapshot: () => ({ state: "paused_manual", countdown: {} }), destroy() {} },
        renderer: { attach() {}, resize() {}, clear() {}, renderGameplayFrame() {}, setTheme() {}, getCapabilities: () => ({ webgl2: true }), describe: () => ({ state: destroyed ? "destroyed" : "ready" }), destroy() { destroyed = true; } }
      };
    }
    const first = document.createElement("aero-game"); first.setAttribute("instance-id", "lease-first"); first.serviceGraphFactory = factory;
    const second = document.createElement("aero-game"); second.setAttribute("instance-id", "lease-second"); second.serviceGraphFactory = factory;
    const host = document.querySelector("main"); host.append(first, second); await first.start(); await second.start();
    await second.selectVariant("spatial-cut");
    Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); await new Promise((resolve) => setTimeout(resolve, 20));
    Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); await new Promise((resolve) => setTimeout(resolve, 20));
    const result = { owner: second.getSnapshot().lease.ownerInstanceId, log: [...log], variantCount: second.graph.content.getSnapshot().variants.length, selected: second.graph.content.getSnapshot().selectedVariant.variantId };
    first.remove(); second.remove(); await new Promise((resolve) => setTimeout(resolve, 20)); return result;
  });
  if (integration.owner !== "lease-second" || integration.log.slice(0, 3).join(",") !== "lease-first:activate,lease-first:pause,lease-second:activate" || !integration.log.includes("lease-second:hidden:true") || !integration.log.includes("lease-second:audio-hidden:true") || integration.variantCount !== 5 || integration.selected !== "spatial-cut") throw new Error(`Lease/hidden/five-variant integration failed: ${JSON.stringify(integration)}`);
  await page.close();

  const parent = await browser.newPage();
  parent.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}: ${message.text()}`); });
  parent.on("pageerror", (error) => noise.push(`pageerror: ${error.message}`));
  await parent.goto(parentUrl, { waitUntil: "networkidle" });
  const childOrigin = new URL(childUrl).origin;
  await parent.evaluate(({ childOrigin }) => {
    const frame = document.querySelector("iframe");
    frame.contentWindow.postMessage({ schema: "aerobeat/iframe_message", version: 1, kind: "handshake_request", messageId: "hello", instanceId: "aero-game-1", payload: { protocolVersion: 1 } }, childOrigin);
  }, { childOrigin });
  await parent.waitForFunction(() => window.messages.some((entry) => entry.data?.kind === "handshake_ack"));
  await parent.evaluate(({ childOrigin }) => {
    const frame = document.querySelector("iframe");
    frame.contentWindow.postMessage({ schema: "aerobeat/iframe_message", version: 1, kind: "command", messageId: "configure", instanceId: "aero-game-1", payload: { command: { schema: "aerobeat/game_command", version: 1, commandId: "c1", type: "configure", payload: {} } } }, childOrigin);
    frame.contentWindow.postMessage({ schema: "aerobeat/iframe_message", version: 1, kind: "command", messageId: "raw", instanceId: "aero-game-1", payload: { command: { schema: "aerobeat/game_command", version: 1, commandId: "c2", type: "configure", payload: { zipBytes: [1, 2] } } } }, childOrigin);
    const attacker = document.createElement("iframe"); attacker.sandbox = "allow-scripts";
    const hostile = { schema: "aerobeat/iframe_message", version: 1, kind: "command", messageId: "wrong-source", instanceId: "aero-game-1", payload: { command: { schema: "aerobeat/game_command", version: 1, commandId: "c3", type: "configure", payload: {} } } };
    attacker.srcdoc = `<script>parent.frames[0].postMessage(JSON.parse(${JSON.stringify(JSON.stringify(hostile))}), ${JSON.stringify(childOrigin)})<\/script>`;
    document.body.append(attacker);
  }, { childOrigin });
  await parent.waitForFunction(() => window.messages.some((entry) => entry.data?.kind === "event" && entry.data?.payload?.event?.type === "capabilities_changed"));
  await parent.waitForTimeout(100);
  const bridge = await parent.evaluate(() => ({ messages: window.messages, iframeOrigin: new URL(document.querySelector("iframe").src).origin, parentOrigin: location.origin }));
  if (bridge.iframeOrigin === bridge.parentOrigin) throw new Error("Iframe test was not cross-origin");
  if (JSON.stringify(bridge.messages).match(/zipBytes|audioBytes|mediaStream|videoFrame|screenshot|pixels/u)) throw new Error("Raw payload crossed iframe bridge");
  if (bridge.messages.filter((entry) => entry.data?.kind === "event").length !== 1) throw new Error("Unsafe iframe command was not rejected");
  await parent.close();
} finally {
  await browser.close(); await vite.close(); await new Promise((resolve) => parentServer.close(resolve));
}
if (noise.length) throw new Error(noise.join("\n"));
console.log("Chromium direct, reconnect, lease, five-variant and cross-origin iframe validation passed.");
