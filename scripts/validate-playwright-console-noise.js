// @ts-check

import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0]; if (!childUrl) throw new Error("Vite URL unavailable");
const parentServer = createHttpServer((_request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><iframe id="game" style="width:640px;height:480px" allow="camera; fullscreen; autoplay" src="${childUrl}"></iframe><script>window.messages=[];addEventListener('message',event=>messages.push({origin:event.origin,data:event.data}));</script>`);
});
await new Promise((resolve) => parentServer.listen(0, "127.0.0.1", resolve));
const address = parentServer.address(); if (!address || typeof address === "string") throw new Error("Parent server unavailable");
const parentUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch(); const noise = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } }); collectNoise(page, noise);
  await page.goto(childUrl, { waitUntil: "networkidle" }); await page.locator("aero-game").waitFor();
  const direct = await page.locator("aero-game").evaluate((game) => {
    const snapshot = game.getSnapshot(); const parent = game.parentElement.getBoundingClientRect();
    return { snapshot, bounds: game.getBoundingClientRect().toJSON(), parent: parent.toJSON(), aliasCount: document.querySelectorAll("aerobeat-app").length, bodyStyle: document.body.getAttribute("style") ?? "" };
  });
  if (direct.aliasCount !== 0 || direct.snapshot.lifecycle !== "connected") throw new Error("Public root was not aero-game only");
  if (direct.snapshot.cvProfile.model !== "Pose Landmarker Lite float16 /1/" || direct.snapshot.cvProfile.runtimeVersion !== "1.0.1" || direct.snapshot.cvProfile.submissionCadenceTargetFps !== 15) throw new Error("Locked CV proof mismatch");
  if (Math.abs(direct.bounds.width - direct.parent.width) > 1 || Math.abs(direct.bounds.height - direct.parent.height) > 1) throw new Error("aero-game did not fill its parent");

  const sizing = await page.locator("aero-game").evaluate(async (game) => {
    const host = document.createElement("div"); host.style.cssText = "width:640px;height:360px;padding:13px 17px;border:5px solid transparent;box-sizing:border-box";
    game.replaceWith(host); host.append(game); game.style.cssText = "padding:7px 11px;border:3px solid transparent"; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const style = getComputedStyle(game); const expectedWidth = game.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight); const expectedHeight = game.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    return { container: game.getSnapshot().container, expectedWidth, expectedHeight };
  });
  if (Math.abs(sizing.container.widthCssPx - sizing.expectedWidth) > 0.5 || Math.abs(sizing.container.heightCssPx - sizing.expectedHeight) > 0.5) throw new Error("Container snapshot was not the exact content box");

  const aeroPackage = await makePackage();
  const actual = await page.locator("aero-game").evaluate(async (game, fixture) => {
    await game.selectContent({ kind: "direct", package: { package: fixture.songPackage, assets: [{ path: "song.wav", bytes: new Uint8Array(fixture.audioBytes) }] } });
    await game.pause("test_variant_swap");
    const before = game.getSnapshot(); const target = before.services.content.variants.find((entry) => entry.rulesetId === "boxing_spatial_grid_v1" && entry.recipeId === "cut_family_source_height_v1");
    await game.selectVariant(target.variantId, []); const after = game.getSnapshot();
    let getterCalls=0;const hostile=[];Object.defineProperty(hostile,"0",{enumerable:true,get(){getterCalls+=1;return"crossed_guard"}});hostile.length=1;let hostileRejected=false;try{await game.selectVariant(target.variantId,hostile)}catch{hostileRejected=true}
    return { variantCount: after.services.content.variants.length, selectedContent: after.services.content.selectedVariant.variantId, selectedGameplay: after.services.gameplay.selectedVariant.variantId, gameplayState: after.services.gameplay.session.state, bytesLeaked: /Uint8Array|ArrayBuffer|audioBytes|zipBytes/u.test(JSON.stringify(after)), hostileRejected, getterCalls };
  }, aeroPackage);
  if (actual.variantCount !== 5 || actual.selectedContent !== actual.selectedGameplay || actual.gameplayState !== "paused_manual" || actual.bytesLeaked || !actual.hostileRejected || actual.getterCalls !== 0) throw new Error(`Actual content/gameplay integration failed: ${JSON.stringify(actual)}`);

  await page.locator("aero-game").evaluate((game) => { game.fullscreenAudit = { count: 0, active: false }; game.requestFullscreen = async () => { game.fullscreenAudit.count += 1; game.fullscreenAudit.active = navigator.userActivation.isActive; }; });
  await page.locator("aero-game").locator("aero-fullscreen-button").locator("button").click();
  const fullscreen = await page.locator("aero-game").evaluate((game) => game.fullscreenAudit);
  if (fullscreen.count !== 1 || !fullscreen.active) throw new Error("Fullscreen was not requested from a child user gesture");

  const reconnect = await page.locator("aero-game").evaluate(async (game) => {
    const firstGeneration = game.getSnapshot().generation; const canvas = game.shadowRoot.querySelector("canvas[data-role='renderer']"); const video = game.shadowRoot.querySelector("video[data-role='media']"); const parent = game.parentElement;
    game.remove(); parent.append(game); await new Promise((resolve) => setTimeout(resolve, 40));
    return { firstGeneration, secondGeneration: game.getSnapshot().generation, stable: canvas === game.shadowRoot.querySelector("canvas[data-role='renderer']") && video === game.shadowRoot.querySelector("video[data-role='media']"), lifecycle: game.getSnapshot().lifecycle };
  });
  if (!reconnect.stable || reconnect.secondGeneration <= reconnect.firstGeneration || reconnect.lifecycle !== "connected") throw new Error("Reconnect/stable surfaces failed");

  const integration = await page.evaluate(async () => {
    document.querySelector("aero-game")?.remove(); const log = []; const variants = ["flow", "semantic-row", "spatial-row", "semantic-cut", "spatial-cut"].map((variantId) => ({ variantId, chartId: `chart-${variantId}`, mode: variantId === "flow" ? "flow" : "boxing", rulesetId: variantId === "flow" ? "flow_grid_v1" : variantId.includes("semantic") ? "boxing_semantic_track_v1" : "boxing_spatial_grid_v1", recipeId: variantId === "flow" ? null : variantId.includes("row") ? "row_family_balanced_height_v1" : "cut_family_source_height_v1", modifierIds: [], ranked: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "a".repeat(64) }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: "b".repeat(64) } }));
    function factory({ instanceId }) {
      let selected = variants[0], state = "calibrating", destroyed = false, lease = null, playback = "paused";
      const contentSnapshot = () => ({ schema: "aerobeat/content_runtime_snapshot", version: 1, state: "ready", generation: 1, source: null, lineage: null, packageId: "fixture", packageHash: null, song: null, variants, selectedVariant: selected, resolvedEvents: [], playback: { state: playback, positionMs: 0, judgedEventIds: [], activeEventIds: [] }, assets: [], theme: null, background: { kind: "css-fallback" }, capabilities: {}, error: null });
      const gameSnapshot = () => ({ schema: "aerobeat/gameplay_coordinator_snapshot", version: 1, serviceId: "aero.gameplay.session", generation: 1, session: { schema: "aerobeat/gameplay_session_snapshot", version: 1, sessionId: instanceId, state, timestampMs: 0, timelinePositionMs: 0, packageId: "fixture", chartId: selected.chartId, calibrationId: null, rulesetId: selected.rulesetId, recipeId: selected.recipeId, ranked: true, pauseReason: null }, countdown: { state: "inactive", value: null }, safety: { ready: false, freshCalibrationRequired: true }, lease, selectedVariant: selected, profileIdentity: {}, activeEventIds: [], judgedEventIds: [], judgements: [], shadowJudgements: [], scorePartitions: [], error: null });
      return {
        instanceId, vendor: { snapshot: () => ({ phase: "idle" }), searchMaps: async () => ({ maps: [] }), listLatestMaps: async () => ({ maps: [] }) },
        authoring: { getSnapshot: () => ({ state: "idle" }), subscribe: (fn) => { fn({ state: "idle" }); return () => {}; }, listPackages: async () => [], estimateStorage: async () => ({ usageBytes: 0, quotaBytes: 1 }), cancel: () => true, destroy: () => { destroyed = true; } },
        content: { getSnapshot: contentSnapshot, subscribe: (fn) => { fn(contentSnapshot()); return () => {}; }, setPlaybackState(value) { playback = value.state; }, async selectVariant(id) { selected = variants.find((entry) => entry.variantId === id); }, async swapFutureVariant(id) { selected = variants.find((entry) => entry.variantId === id); }, destroy() {} },
        video: { retained: null, getRetainedCameraStream() { return this.retained; }, async requestCamera() { this.retained = new MediaStream(); return { status: "granted", message: "ok" }; }, attachCameraStream() { return { sourceKind: "live-camera", sourceId: "fake", mirrored: true, currentTimeSeconds: 0, intrinsicWidth: 640, intrinsicHeight: 480, sourceAspectRatio: 4 / 3, sourceChangeId: 1 }; }, injectCameraStream(stream) { this.retained = stream; }, activateLease() { log.push(`${instanceId}:activate`); }, pauseForLease() { log.push(`${instanceId}:pause`); }, releaseLease() { log.push(`${instanceId}:release`); }, describeStatus: () => ({ leaseState: "active", sourceChangeId: 1 }), describeSurface: () => ({ sourceId: "fake", mirrored: true, sourceChangeId: 1, sourceAspectRatio: 4 / 3 }), pause() {}, setDocumentHidden(value) { log.push(`${instanceId}:hidden:${value}`); }, destroy() { destroyed = true; } },
        cv: { async start() {}, async stop() {}, async dispose() { destroyed = true; }, getLatestPoseFrame: () => undefined, getStatus: () => ({ lifecycleState: "idle" }) },
        input: { resetCalibration() {}, getSnapshot: () => ({ calibration: {}, tracking: {}, anchors: [], entries: [], latestEvidence: null, straightQualifications: [] }), subscribe: (fn) => { fn({}); return () => {}; }, advanceTime() {}, destroy() {} },
        audio: { async activateLease() {}, async pauseForLease() {}, async releaseLease() {}, async play() {}, async pause() {}, async stop() {}, async setDocumentHidden(value) { log.push(`${instanceId}:audio-hidden:${value}`); }, async destroy() { destroyed = true; }, getStatus: () => ({ state: "ready" }), getClockSnapshot: () => ({ positionSeconds: 0, playing: false, durationSeconds: undefined }) },
        gameplay: { requestStart() { state = "countdown"; }, pause() { state = "paused_manual"; }, resume() { state = "countdown"; }, stop() { state = "completed"; }, reset() {}, configureContent() {}, synchronizePausedClock() {}, applyFutureContent(value) { selected = value.selectedVariant; }, setLeaseSnapshot(value) { lease = value; }, advance() {}, getSnapshot: gameSnapshot, destroy() {} },
        renderer: { attach() {}, resize() {}, clear() {}, renderGameplayFrame() {}, setTheme() {}, getCapabilities: () => ({ webgl2: true }), describe: () => ({ state: destroyed ? "destroyed" : "ready" }), destroy() { destroyed = true; } }
      };
    }
    const first = document.createElement("aero-game"); first.setAttribute("instance-id", "lease-first"); first.serviceGraphFactory = factory;
    const second = document.createElement("aero-game"); second.setAttribute("instance-id", "lease-second"); second.serviceGraphFactory = factory;
    const duplicate = document.createElement("aero-game"); duplicate.setAttribute("instance-id", "lease-first"); duplicate.serviceGraphFactory = factory;
    const host = document.querySelector("main"); host.append(first, second); await first.start(); await second.start(); host.append(duplicate); await new Promise((resolve) => setTimeout(resolve, 20));
    await second.pause(); await second.selectVariant("spatial-cut");
    Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); await new Promise((resolve) => setTimeout(resolve, 20));
    Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); await new Promise((resolve) => setTimeout(resolve, 20));
    const childMap={mapId:"ABC",mapName:"Child Local",songName:"Child Local",songAuthorName:"Author",levelAuthorName:"Mapper",versions:[{hash:"c".repeat(40),key:"v1",difficulties:[{characteristic:"Standard",difficulty:"Expert"}]}]};second.browsedMaps.set("ABC",childMap);let importedMap=null;second.importBeatSaver=async(map)=>{importedMap=map;return{ok:true}};await second.executeCommand({schema:"aerobeat/game_command",version:1,commandId:"iframe-import",type:"import_beatsaver",payload:{mapId:"ABC",versionHash:"c".repeat(40),difficultyId:"Expert"}});
    const result = { owner: second.getSnapshot().lease.ownerInstanceId, log: [...log], variantCount: second.getSnapshot().services.content.variants.length, selected: second.getSnapshot().services.content.selectedVariant.variantId, duplicateLifecycle: duplicate.getSnapshot().lifecycle, childLocalImport: importedMap===childMap };
    first.remove(); second.remove(); duplicate.remove(); await new Promise((resolve) => setTimeout(resolve, 20)); return result;
  });
  if (integration.owner !== "lease-second" || integration.log.slice(0, 3).join(",") !== "lease-first:activate,lease-first:pause,lease-second:activate" || !integration.log.includes("lease-second:hidden:true") || !integration.log.includes("lease-second:audio-hidden:true") || integration.variantCount !== 5 || integration.selected !== "spatial-cut" || integration.duplicateLifecycle !== "error" || !integration.childLocalImport) throw new Error(`Lease/hidden/five-variant integration failed: ${JSON.stringify(integration)}`);
  await page.close();

  const parent = await browser.newPage(); collectNoise(parent, noise); await parent.goto(parentUrl, { waitUntil: "networkidle" }); const childOrigin = new URL(childUrl).origin;
  await parent.evaluate(({ childOrigin }) => { const frame = document.querySelector("iframe"); frame.contentWindow.postMessage(message("handshake_request", "hello", { protocolVersion: 1 }), childOrigin); function message(kind,id,payload){return{schema:"aerobeat/iframe_message",version:1,kind,messageId:id,instanceId:"aero-game-1",payload}}; }, { childOrigin });
  await parent.waitForFunction(() => window.messages.some((entry) => entry.data?.kind === "handshake_ack") && window.messages.some((entry) => entry.data?.kind === "event" && entry.data?.payload?.event?.type === "ready"));
  await parent.evaluate(({ childOrigin }) => {
    const frame = document.querySelector("iframe"); const command = (id, type, payload) => ({ schema:"aerobeat/iframe_message",version:1,kind:"command",messageId:id,instanceId:"aero-game-1",payload:{command:{schema:"aerobeat/game_command",version:1,commandId:id,type,payload}}});
    frame.contentWindow.postMessage(command("configure", "configure", {}), childOrigin);
    for (const [id,payload] of [["raw-case",{ZiP_ByTeS:[1]}],["raw-media",{MEDIA_STREAM:{}}],["raw-screen",{screen_shot:"x"}],["oversize",{value:"x".repeat(70*1024)}]]) frame.contentWindow.postMessage(command(id,"configure",payload),childOrigin);
    frame.contentWindow.postMessage({ ...command("wrong-instance","configure",{}), instanceId:"other" },childOrigin);
    frame.contentWindow.postMessage({ ...command("wrong-version","configure",{}), version:2 },childOrigin);
    const withExtra=command("extra","configure",{});withExtra.extra=true;frame.contentWindow.postMessage(withExtra,childOrigin);
    const attacker=document.createElement("iframe");attacker.sandbox="allow-scripts";const hostile=command("wrong-source","configure",{});attacker.srcdoc=`<script>parent.frames[0].postMessage(JSON.parse(${JSON.stringify(JSON.stringify(hostile))}),${JSON.stringify(childOrigin)})<\/script>`;document.body.append(attacker);
  }, { childOrigin });
  await parent.waitForFunction(() => window.messages.some((entry) => entry.data?.kind === "event" && entry.data?.payload?.event?.type === "capabilities_changed")); await parent.waitForTimeout(150);
  const beforeDestroy = await parent.evaluate(() => window.messages.map((entry) => entry.data));
  const events = beforeDestroy.filter((entry) => entry?.kind === "event");
  if (events.filter((entry) => entry.payload?.event?.type === "capabilities_changed").length !== 1 || events.filter((entry) => entry.payload?.event?.type === "ready").length !== 1) throw new Error("Unsafe iframe messages were not rejected exactly");
  if (JSON.stringify(beforeDestroy).match(/zip.?bytes|media.?stream|screen.?shot|audio.?bytes|video.?frame|pixels/iu)) throw new Error("Raw payload crossed iframe bridge");
  await parent.evaluate(({ childOrigin }) => { const frame=document.querySelector("iframe");frame.contentWindow.postMessage({schema:"aerobeat/iframe_message",version:1,kind:"command",messageId:"destroy",instanceId:"aero-game-1",payload:{command:{schema:"aerobeat/game_command",version:1,commandId:"destroy",type:"destroy",payload:{}}}},childOrigin); }, { childOrigin });
  await parent.waitForFunction(() => window.messages.some((entry) => entry.data?.payload?.event?.type === "destroyed") && window.messages.some((entry) => entry.data?.kind === "disconnect"));
  const lifecycle = await parent.evaluate(() => window.messages.map((entry) => entry.data?.kind === "event" ? entry.data.payload.event.type : entry.data?.kind).filter(Boolean));
  if (lifecycle.indexOf("destroyed") < 0 || lifecycle.indexOf("disconnect") < lifecycle.indexOf("destroyed")) throw new Error("Iframe destroyed/disconnect lifecycle ordering failed");
  await parent.close();
} finally { await browser.close(); await vite.close(); await new Promise((resolve) => parentServer.close(resolve)); }
if (noise.length) throw new Error(noise.join("\n"));
console.log("Chromium actual graph, exact sizing, user fullscreen, reconnect, lease, five variants and adversarial cross-origin iframe validation passed.");

function collectNoise(page, noise) { page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}: ${message.text()}`); }); page.on("pageerror", (error) => noise.push(`pageerror: ${error.message}`)); }
function hashBytes(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function hashJson(value) { return hashBytes(new TextEncoder().encode(JSON.stringify(sort(value)))); }
function sort(value) { if (Array.isArray(value)) return value.map(sort); if (value && typeof value === "object") { const result = {}; for (const key of Object.keys(value).sort()) result[key] = sort(value[key]); return result; } return value; }
async function makePackage() {
  const audioBytes = makeSilentWav(); const audioHash = hashBytes(audioBytes);
  const sourceHash = `sha256:${hashBytes(new TextEncoder().encode("assembly-public-source"))}`; const charts=[];
  for (const recipeId of ["row_family_balanced_height_v1","cut_family_source_height_v1"]) for (const rulesetId of ["boxing_semantic_track_v1","boxing_spatial_grid_v1"]) { const token=`${recipeId.startsWith("row")?"row":"cut"}-${rulesetId.includes("semantic")?"semantic":"spatial"}`; const beats=[{start:1,type:"hook_left",eventId:`${token}-hook`,sourceEventIds:[`${token}-source`],spatialTarget:{targetCell:5,acceptedSubcells:[20],sourceCell:9,entryDirection:"up"}}]; const contentHash=hashJson({beats,recipeId,rulesetId,sourceHash}); charts.push({schemaId:"aerobeat.chart.boxing.v1",schemaVersion:1,recordVersion:1,chartId:`chart-${token}`,chartName:token,mode:"boxing",difficulty:"Expert",prototype:{contractId:"aerobeat.boxing.prototype.v1",recipeId,recipeVersion:"1.0.0",rulesetId,rulesetVersion:"1.0.0",sourceHash,recipeHash:`sha256:${"1".repeat(64)}`,rulesetHash:`sha256:${"2".repeat(64)}`,contentHash:`sha256:${contentHash}`,modifiers:[],regenerationRequiredFor:[]},beats}); }
  charts.push({schemaId:"aerobeat.chart.v1",schemaVersion:1,recordVersion:1,chartId:"chart-flow",chartName:"Flow",mode:"flow",difficulty:"Expert",beats:[{start:1,type:"note",hand:"left",placement:4,direction:1}]});
  const songPackage = {schemaId:"aerobeat.song-package.v1",schemaVersion:1,packageVersion:"1.0.0",packageId:"assembly-public-package",songId:"assembly-public-song",songName:"Assembly Public Integration",source:{provider:"local",sourceId:"assembly-public",sourceVersionHash:"public-version",difficulty:"Expert",sourceDifficultyPath:"Expert.dat",sourceHash},song:{schemaId:"aerobeat.song.v1",schemaVersion:1,recordVersion:1,songId:"assembly-public-song",songName:"Assembly Public Integration",durationSec:1,audio:{filePath:"song.wav",contentHash:`sha256:${audioHash}`},timing:{anchorMs:0,tempoSegments:[{startBeat:0,bpm:120}],stopSegments:[],timeSignatureSegments:[{startBeat:0,numerator:4,denominator:4}]}},charts,sets:charts.map((chart,index)=>({schemaId:"aerobeat.set.v1",schemaVersion:1,recordVersion:1,setId:`set-${index}`,setName:chart.chartName,songId:"assembly-public-song",chartId:chart.chartId})),recipeDefinitions:[],rulesetDefinitions:[],conversionTrace:{},presentationSuggestion:null};
  return { songPackage, audioBytes: [...audioBytes] };
}
function makeSilentWav() { const sampleRate=8000,samples=8000,dataBytes=samples*2,buffer=Buffer.alloc(44+dataBytes);buffer.write("RIFF",0);buffer.writeUInt32LE(36+dataBytes,4);buffer.write("WAVEfmt ",8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write("data",36);buffer.writeUInt32LE(dataBytes,40);return new Uint8Array(buffer); }
