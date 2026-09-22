// @ts-check
// 0.0.63 C5 (bead 376l, final piece of L-C): browser oracle for the Test-mode
// equipment config panel. Plan: .plans/2026-09-21-0.0.63-playtest-feedback-
// 0.0.62-retest-successor.md (L-C design, D2).
//
// The panel is part of the assembly shell `aero-game` — it rides in the same
// Visual Test authoring surface as the environment + test-presentation
// controls and MUST NOT be usable outside a visual_test session with the menu
// closed. This oracle drives a real app boot in headless Chromium (audio-only
// by design — no camera):
//
//   (a) idle (non-test) state — panel present in markup but hidden/disabled;
//       describeEquipmentConfig() === the baked defaults; getSnapshot() omits
//       any equipment-config truth;
//   (b) a REAL Flow visual_test session booted through the public start path
//       (the service-graph factory override mirrors validate-mobile-gameplay-
//       menu.js); once the menu closes, the authoring surface becomes enabled;
//   (c) panel visible/enabled + textarea preloaded with the canonical
//       serialized defaults (byte-for-byte);
//   (d) LIVE validation on input — invalid text surfaces the error without
//       mutating describeEquipmentConfig(); valid text shows the indicator;
//   (e) APPLY commits only when valid — an invalid edit leaves the live
//       config unchanged, a valid edit changes it observably;
//   (f) EXPORT triggers a Playwright download event named
//       aerobeat-equipment-config.yaml whose bytes re-parse as YAML; invalid
//       content refuses to export;
//   (g) RESET restores the baked defaults into state + textarea.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const HARD_TIMEOUT_MS = 90_000;
let closing = false;
let browser;
let vite;
const cleanup = async () => { if (closing) return; closing = true; await Promise.allSettled([browser?.close(), vite?.close()]); };
const hardTimeout = setTimeout(() => { console.error(`Equipment config panel browser validator exceeded ${HARD_TIMEOUT_MS} ms`); void cleanup().finally(() => process.exit(124)); }, HARD_TIMEOUT_MS);

try {
  // Canonical serialized defaults — computed in node exactly like the app at
  // build time so the expected string is byte-stable across runs.
  const [configModule, defaultsModule] = await Promise.all([import("../src/equipment-config.js"), import("../src/equipment-config-defaults.js")]);
  const expectedDefaultsYaml = configModule.serializeEquipmentConfigYaml(configModule.validateEquipmentConfig(defaultsModule.equipmentConfigDefaults));
  const expectedDefaultsJson = JSON.stringify(configModule.validateEquipmentConfig(defaultsModule.equipmentConfigDefaults));

  vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
  await vite.listen();
  const childUrl = vite.resolvedUrls?.local?.[0];
  assert.ok(childUrl, "Vite URL unavailable");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  context.setDefaultTimeout(10_000);
  const page = await context.newPage();
  const noise = [];
  page.on("console", (message) => { const type = message.type(), text = message.text(), location = message.location(); if (["warning", "error"].includes(type) && !isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, childUrl) && !isExpectedPlaycanvasMeshWarning(type, text)) noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:line=${location.lineNumber}:col=${location.columnNumber}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));

  await page.goto(childUrl, { waitUntil: "networkidle" });
  const game = page.locator("aero-game");
  await game.waitFor();

  // ---------- (a) idle: complete grouped controls, no YAML editor/Apply ----------
  const expectedPaths = [
    "flow.perHand.left.scale","flow.perHand.left.rotationZDeg","flow.perHand.right.scale","flow.perHand.right.rotationZDeg",
    "flow.saber.zones.edgeTop.rotationDeg","flow.saber.zones.edgeBottom.rotationDeg","flow.saber.zones.edgeLeft.rotationDeg","flow.saber.zones.edgeRight.rotationDeg","flow.saber.zones.center.rotationDeg","flow.saber.ease.type","flow.saber.ease.durationMs","flow.saber.blendRadius",
    "boxing.perHand.left.scale","boxing.perHand.left.rotationZDeg","boxing.perHand.right.scale","boxing.perHand.right.rotationZDeg",
    "boxing.glove.states.straight.rotationZDeg","boxing.glove.states.uppercut.rotationZDeg","boxing.glove.states.hookL.rotationZDeg","boxing.glove.states.hookR.rotationZDeg","boxing.glove.states.guard.rotationZDeg","boxing.glove.ease.type","boxing.glove.ease.durationMs","boxing.glove.upcomingBeatWindowMs"
  ];
  const idleEvidence = await game.evaluate((element) => { const root=element.shadowRoot; return {textarea:root.querySelectorAll(".equipment-authoring textarea").length,apply:root.querySelectorAll("[data-action='equipment-config-apply']").length,paths:[...root.querySelectorAll("[data-equipment-config-field]")].map((control)=>control.dataset.equipmentConfigField),groups:[...root.querySelectorAll(".equipment-control-group>legend")].map((legend)=>legend.textContent),toggle:root.querySelector("[data-equipment-preview-toggle='true']")?.checked,disabled:[...root.querySelectorAll("[data-equipment-config-field],[data-equipment-preview-toggle],button[data-equipment-config-action]")].every((control)=>control.disabled),snapshotLeak:/equipmentConfig|equipment_config|rotationZDeg|testEquipmentVisible/u.test(JSON.stringify(element.getSnapshot()))}; });
  assert.equal(idleEvidence.textarea,0,"raw YAML textarea removed"); assert.equal(idleEvidence.apply,0,"Apply path removed"); assert.deepEqual(idleEvidence.paths,expectedPaths,"complete ordered grouped field inventory"); assert.deepEqual(idleEvidence.groups,["Flow · hand transforms","Flow · saber zones","Boxing · hand transforms","Boxing · glove states"]); assert.equal(idleEvidence.toggle,false); assert.equal(idleEvidence.disabled,true); assert.equal(idleEvidence.snapshotLeak,false);
  console.log("PASS: grouped idle inventory, no YAML editor/Apply, privacy clean");

  // ---------- (b) boot a REAL Flow visual_test session ----------
  await game.evaluate((element) => {
    const originalFactory = element.serviceGraphFactory;
    element.remove();
    element.serviceGraphFactory = (options) => {
      const original = originalFactory(options);
      const hash = "a".repeat(64);
      const base = { recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash } };
      const flow = { ...base, variantId: "c5-panel-flow", chartId: "c5-panel-flow-chart", mode: "flow", rulesetId: "flow_colliders_v1", provenance: { baseVariantId: "c5-panel-flow" } };
      const boxing = { ...base, variantId: "c5-panel-boxing", chartId: "c5-panel-boxing-chart", mode: "boxing", rulesetId: "boxing_collider_v1", provenance: { baseVariantId: "c5-panel-boxing" } };
      const variants = [flow, boxing];
      const readyContent = (selectedVariant = flow) => ({ state: "ready", packageId: "c5-panel", selectedVariant, variants, resolvedEvents: [], song: { name: "c5-panel", durationSec: 60 }, background: null, lineage: null });
      const state = globalThis.__c5State = { contentSnapshot: readyContent(), listeners: new Set() };
      const content = {
        getSnapshot: () => state.contentSnapshot,
        loadPersistenceHandle: async () => { state.contentSnapshot = readyContent(); },
        selectVariant: async (variantId) => { const selected = variants.find((candidate) => candidate.variantId === variantId); if (!selected) throw new Error("unknown variant"); state.contentSnapshot = readyContent(selected); for (const listener of state.listeners) listener(state.contentSnapshot); },
        swapFutureVariant: async () => {},
        subscribe(listener) { state.listeners.add(listener); listener(state.contentSnapshot); return () => state.listeners.delete(listener); },
        setPlaybackState(playback) { state.contentSnapshot = { ...state.contentSnapshot, playback: structuredClone(playback) }; },
        readAsset: () => new Uint8Array(),
        destroy: () => { state.listeners.clear(); },
      };
      const vendor = { snapshot: () => original.vendor.snapshot(), searchMaps: async () => ({ maps: [] }), listLatestMaps: async () => ({ maps: [] }) };
      const video = {
        getRetainedCameraStream: () => null,
        requestCamera: async () => { throw new Error("camera must not activate in visual_test"); },
        attachCameraStream: () => ({ sourceKind: "none", sourceId: "none", mirrored: false, currentTimeSeconds: 0, intrinsicWidth: 1, intrinsicHeight: 1, sourceAspectRatio: 1, sourceChangeId: 1 }),
        injectCameraStream: () => {}, play: async () => {}, pause: () => {},
        activateLease: () => {}, pauseForLease: () => {}, releaseLease: () => {},
        describeStatus: () => ({ state: "idle", sourceChangeId: 1 }),
        describeSurface: () => ({ sourceId: "none", mirrored: false, sourceChangeId: 1, sourceAspectRatio: 1 }),
        setDocumentHidden: () => {}, destroy: () => {},
      };
      const cv = { start: async () => { throw new Error("cv must not start in visual_test"); }, stop: async () => {}, dispose: async () => {}, getLatestPoseFrame: () => null, getStatus: () => ({ lifecycleState: "idle" }) };
      const audio = {
        getMixSnapshot: () => Object.freeze({ musicVolume: 0.5, sfxVolume: 0.5 }),
        setMix: function () { return this.getMixSnapshot(); },
        activateLease: async () => {}, releaseLease: async () => {}, pauseForLease: async () => {},
        play: async () => {}, pause: async () => {}, seek: async () => {}, stop: async () => {},
        setDocumentHidden: async () => {}, destroy: async () => {},
        getStatus: () => ({ state: "playing", autoplayState: "allowed", durationSeconds: 60 }),
        getClockSnapshot: () => ({ contextTimeSeconds: performance.now() / 1000, positionSeconds: 0, durationSeconds: 60, progress: 0, playing: true }),
      };
      const gameplay = Object.create(original.gameplay);
      const input = Object.create(original.input);
      return Object.freeze({ ...original, vendor, authoring: original.authoring, content, video, cv, audio, gameplay, input });
    };
    document.querySelector("main")?.append(element);
  });
  await page.waitForFunction(() => document.querySelector("aero-game")?.graph !== undefined, { timeout: 15_000 });
  await page.waitForTimeout(30);

  // Start the visual_test session through the public API.
  await game.evaluate(async (element) => {
    await element.startSession("visual_test", { requireDownloaded: false });
  });
  await page.waitForFunction(() => {
    const g = document.querySelector("aero-game");
    const session = g?.graph?.gameplay?.getSnapshot?.()?.session;
    return session?.purpose === "visual_test" && session?.state === "playing";
  }, { timeout: 15_000 });

  // Close the menu so the authoring surface flips enabled, then force one sync.
  await game.evaluate(async (element) => {
    element.setMenuOpen(false);
    await element.menuPauseTail;
    element.syncDebugCameraPresentation();
  });

  // Inject the compare baseline inside the page for later evaluate calls.
  await page.evaluate((value) => { globalThis.__expectedDefaultsJson = value; }, expectedDefaultsJson);

  // ---------- live Test preview, transforms, uppercut, geometry, reset/export ----------
  const result = await game.evaluate((element) => {
    const root=element.shadowRoot, renderer=element.graph.renderer, original=renderer.renderGameplayFrameWithCursorsAndEquipment.bind(renderer), calls=[];
    renderer.renderGameplayFrameWithCursorsAndEquipment=(...args)=>{calls.push(structuredClone(args[3]));return original(...args);};
    try { element.renderGameplay(); } finally { renderer.renderGameplayFrameWithCursorsAndEquipment=original; }
    const defaultOff=calls.at(-1);
    return {defaultOff,enabled:[...root.querySelectorAll("[data-equipment-config-field],[data-equipment-preview-toggle],button[data-equipment-config-action]")].every((control)=>!control.disabled)};
  });
  assert.deepEqual(result.defaultOff,[],"Test preview defaults off with zero records"); assert.equal(result.enabled,true,"controls enabled in active Test");

  await game.locator("[data-equipment-preview-toggle='true']").check();
  const toggledOn=await game.evaluate((element)=>{element.renderGameplay(); return {visible:element.testEquipmentVisible,snapshot:JSON.stringify(element.getSnapshot()),input:structuredClone(element.graph.input.getSnapshot())};});
  const onRecords=await game.evaluate((element)=>{let captured=null;const renderer=element.graph.renderer,original=renderer.renderGameplayFrameWithCursorsAndEquipment;renderer.renderGameplayFrameWithCursorsAndEquipment=(...args)=>{captured=structuredClone(args[3]);return original.apply(renderer,args);};try{element.renderGameplay();}finally{renderer.renderGameplayFrameWithCursorsAndEquipment=original;}return captured;});
  assert.equal(toggledOn.visible,true); assert.equal(onRecords.length,2,"toggle-on emits exactly two deterministic preview records"); assert.deepEqual(onRecords.map(({role,x,y})=>({role,x,y})),[{role:"left_wrist",x:.3,y:.62},{role:"right_wrist",x:.7,y:.62}]); assert.equal(/equipmentConfig|equipment_config|rotationZDeg|testEquipmentVisible/u.test(toggledOn.snapshot),false,"preview/config remain private"); assert.equal(toggledOn.input.anchors.length,0,"preview never mutates input service");

  await game.evaluate((element)=>{element.stopFrameLoop();const renderer=element.graph.renderer;globalThis.__equipmentLiveOriginal=renderer.renderGameplayFrameWithCursorsAndEquipment;globalThis.__equipmentLiveCaptured=null;renderer.renderGameplayFrameWithCursorsAndEquipment=(...args)=>{globalThis.__equipmentLiveCaptured=structuredClone(args[3]);return globalThis.__equipmentLiveOriginal.apply(renderer,args);};});
  const scale=game.locator("[data-equipment-config-field='flow.perHand.left.scale']"); await scale.fill("2");
  const live=await game.evaluate((element)=>{const renderer=element.graph.renderer,captured=globalThis.__equipmentLiveCaptured;renderer.renderGameplayFrameWithCursorsAndEquipment=globalThis.__equipmentLiveOriginal;delete globalThis.__equipmentLiveOriginal;delete globalThis.__equipmentLiveCaptured;return{frameTimer:element.frameTimer,config:element.describeEquipmentConfig().flow.perHand.left.scale,left:captured?.find((record)=>record.role==="left_wrist")??null,status:element.equipmentConfigStatus};});
  assert.equal(live.frameTimer,0,"normal display loop remains stopped"); assert.equal(live.config,2); assert.equal(live.left.scale,2,"accepted field edit explicitly renders the next transform with loop stopped"); assert.match(live.status,/updated/iu);

  await game.locator("[data-equipment-preview-toggle='true']").uncheck();
  const offRecords=await game.evaluate((element)=>{let captured=null;const renderer=element.graph.renderer,original=renderer.renderGameplayFrameWithCursorsAndEquipment;renderer.renderGameplayFrameWithCursorsAndEquipment=(...args)=>{captured=structuredClone(args[3]);return original.apply(renderer,args);};try{element.renderGameplay();}finally{renderer.renderGameplayFrameWithCursorsAndEquipment=original;}return captured;});
  assert.deepEqual(offRecords,[],"toggle-off returns to zero equipment");

  const uppercut=await game.evaluate(async(element)=>{await element.graph.content.selectVariant("c5-panel-boxing");element.configureGameplayFromContent(false,"visual_test",true);element.activeSessionAction="test";element.sessionStartRequested=true;element.menuOpen=false;element.testEquipmentVisible=true;const now=element.graph.gameplay.getSnapshot().session.timelinePositionMs;let rotations=null,error=null;try{rotations=element.computeBoxingStateRotations(element.graph,Object.freeze({nowMs:now,targets:Object.freeze([{id:"uppercut",kind:"punch",hand:"left",family:"uppercut",beatCenterMs:now+100}])}));element.renderGameplay();}catch(value){error=value instanceof Error?value.message:String(value);}return{error,rotations,lastError:element.lastError};});
  assert.equal(uppercut.error,null,"uppercut frame must not throw"); assert.equal(uppercut.lastError,null,"uppercut must not reach Info error"); assert(Number.isFinite(uppercut.rotations.left)&&Number.isFinite(uppercut.rotations.right));

  const geometry=await game.evaluate((element)=>{const root=element.shadowRoot,panel=root.querySelector("[data-role='debug-camera-controls']"),host=element.getBoundingClientRect(),rect=panel.getBoundingClientRect(),actions=[...root.querySelectorAll(".equipment-actions button")];return{panel:{left:rect.left,right:rect.right,width:rect.width,hostRight:host.right,scrollWidth:panel.scrollWidth,clientWidth:panel.clientWidth},actions:actions.map((button)=>({text:button.textContent.trim(),scrollWidth:button.scrollWidth,clientWidth:button.clientWidth,whiteSpace:getComputedStyle(button).whiteSpace}))};});
  assert(geometry.panel.width>220&&geometry.panel.left>=0&&geometry.panel.right<=geometry.panel.hostRight&&geometry.panel.scrollWidth<=geometry.panel.clientWidth,`responsive panel geometry ${JSON.stringify(geometry)}`); assert(geometry.actions.every((button)=>button.scrollWidth<=button.clientWidth&&button.whiteSpace==="nowrap"),`action overflow ${JSON.stringify(geometry.actions)}`);

  await game.locator("button[data-action='equipment-config-reset']").click();
  const reset=await game.evaluate((element)=>JSON.stringify(element.describeEquipmentConfig())); assert.equal(reset,expectedDefaultsJson,"Reset restores build defaults");
  const downloadPromise=page.waitForEvent("download"); await game.locator("button[data-action='equipment-config-export']").click(); const download=await downloadPromise; assert.equal(download.suggestedFilename(),"aerobeat-equipment-config.yaml"); const saved=await download.path(); assert.ok(saved); const bytes=await readFile(saved,"utf8"); assert.equal(bytes,expectedDefaultsYaml,"trusted Export serializes live config deterministically"); configModule.parseEquipmentConfigYaml(bytes);

  assert.deepEqual(noise,[],`unexpected console/page noise: ${JSON.stringify(noise)}`);
  console.log("PASS: preview toggle/live edit/uppercut/geometry/reset/export/privacy");

  clearTimeout(hardTimeout);
  console.log("Equipment config panel browser oracle PASS.");
} finally {
  clearTimeout(hardTimeout);
  await cleanup();
}
