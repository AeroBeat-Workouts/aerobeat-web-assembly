// @ts-check
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const HARD_TIMEOUT_MS = 90_000;
const matrix = [];
const failures = [];
let browser;
let vite;
let parentServer;
let closing = false;

const cleanup = async () => {
  if (closing) return;
  closing = true;
  await Promise.allSettled([
    browser?.close(),
    vite?.close(),
    parentServer && new Promise((resolve) => parentServer.close(resolve))
  ]);
};
const hardTimeout = setTimeout(() => {
  console.error(`Environment controls browser validator exceeded ${HARD_TIMEOUT_MS} ms`);
  void cleanup().finally(() => process.exit(124));
}, HARD_TIMEOUT_MS);

try {
  vite = await createViteServer({ appType:"spa", configFile:"vite.config.js", logLevel:"error", server:{ host:"127.0.0.1", port:0, hmr:false, watch:null } });
  await vite.listen();
  const childUrl = vite.resolvedUrls?.local?.[0];
  assert.ok(childUrl, "Vite URL unavailable");
  parentServer = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://parent.invalid");
    const width = Number(url.searchParams.get("width")) || 390;
    const height = Number(url.searchParams.get("height")) || 844;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<!doctype html><style>html,body{margin:0}iframe{display:block;border:0;width:${width}px;height:${height}px}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe><script>window.__parentMessages=[];addEventListener("message",event=>__parentMessages.push({origin:event.origin,data:event.data}));</script>`);
  });
  await new Promise((resolve) => parentServer.listen(0, "127.0.0.1", resolve));
  const address = parentServer.address();
  assert.ok(address && typeof address !== "string", "Parent URL unavailable");
  const parentUrl = `http://localhost:${address.port}/`;
  browser = await chromium.launch({ headless:true });

  for (const embedding of ["direct", "real-cross-origin-iframe"]) {
    for (const viewport of [{ name:"portrait", width:390, height:844 }, { name:"landscape", width:844, height:390 }]) {
      for (const dpr of [1, 3]) {
        const context = await browser.newContext({ viewport:embedding === "direct" ? { width:viewport.width, height:viewport.height } : { width:viewport.width + 24, height:viewport.height + 24 }, deviceScaleFactor:dpr });
        context.setDefaultTimeout(8_000);
        const page = await context.newPage();
        const noise = [];
        page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
        page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
        try {
          await page.goto(embedding === "direct" ? childUrl : `${parentUrl}?width=${viewport.width}&height=${viewport.height}`, { waitUntil:"networkidle", timeout:15_000 });
          const target = embedding === "direct" ? page : page.frames().find((frame) => frame !== page.mainFrame());
          assert.ok(target, "Real cross-origin child frame missing");
          await target.waitForSelector("aero-game");
          const evidence = await target.locator("aero-game").evaluate((game) => {
            game.debugCameraSnapshot = () => Object.freeze({ visible:true, enabled:true });
            game.menuOpen = false;
            game.syncDebugCameraPresentation();
            const root = game.shadowRoot;
            const panel = root.querySelector("[data-role='debug-camera-controls']");
            const body = root.querySelector("[data-role='visual-test-authoring-body']");
            const menu = root.querySelector("[data-role='menu-button']");
            const transport = root.querySelector("aero-visual-test-transport");
            transport.setSnapshot({ active:true, playing:false, currentMs:0, durationMs:60_000, musicVolume:.5, soundVolume:.5 });
            const rect = (node) => node.getBoundingClientRect().toJSON();
            const overlap = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            const hostRect = rect(game), panelRect = rect(panel), menuRect = rect(menu), transportRect = rect(transport);
            const controls = [root.querySelector("[data-action='debug-controls-collapse']"), ...root.querySelectorAll(".environment-authoring button,.environment-authoring select,.environment-authoring input")].filter((node) => !node.hidden).map((node) => ({ tag:node.tagName, type:node.type, action:node.dataset.action ?? "", ...rect(node) }));
            const select = root.querySelector("[data-action='environment-asset-select']");
            return {
              origins:{ child:location.origin, parent:document.referrer ? new URL(document.referrer).origin : null },
              hostRect, panelRect, menuRect, transportRect,
              controls, options:[...select.options].map((option) => ({ value:option.value, label:option.textContent })),
              panelWithin:panelRect.left >= hostRect.left && panelRect.top >= hostRect.top && panelRect.right <= hostRect.right && panelRect.bottom <= hostRect.bottom,
              noMenuOverlap:!overlap(panelRect, menuRect), noTransportOverlap:!overlap(panelRect, transportRect),
              body:{ clientHeight:body.clientHeight, scrollHeight:body.scrollHeight, overflowY:getComputedStyle(body).overflowY }
            };
          });
          assert.deepEqual(evidence.options.map(({label})=>label), ["Luminious Ice Cave","Icebergs on Sea Shore","Snow Mountain with Lake — comparison with source artifacts","Iceland Waterfall","Igloo Toon — comparison with source artifacts","Salt Lake","Salt Lake 2","Alpine River Valley"]);
          assert.equal(evidence.options.length, 8);
          assert.equal(new Set(evidence.options.map(({ value }) => value)).size, 8);
          assert.equal(evidence.options.filter(({ label }) => label.includes("comparison with source artifacts")).length, 2);
          assert.ok(evidence.controls.length >= 12 && evidence.controls.every(({ width, height }) => width >= 44 && height >= 44), `sub-44px controls: ${JSON.stringify(evidence.controls)}`);
          if (!(evidence.panelWithin && evidence.noMenuOverlap && evidence.noTransportOverlap)) failures.push(`${embedding}:${viewport.name}:DPR${dpr} unsafe layout (panelWithin=${evidence.panelWithin}, noMenuOverlap=${evidence.noMenuOverlap}, noTransportOverlap=${evidence.noTransportOverlap})`);
          assert.ok(evidence.body.clientHeight <= evidence.body.scrollHeight && ["auto", "scroll"].includes(evidence.body.overflowY), `internal scrolling unavailable: ${JSON.stringify(evidence.body)}`);
          if (embedding !== "direct") assert.notEqual(evidence.origins.child, evidence.origins.parent, "iframe must be genuinely cross-origin");

          const collapse = target.locator("aero-game").locator("[data-action='debug-controls-collapse']");
          await collapse.focus();
          await page.keyboard.press("Enter");
          const keyboard = await collapse.evaluate((button) => ({ expanded:button.getAttribute("aria-expanded"), bodyHidden:button.parentElement.querySelector("[data-role='visual-test-authoring-body']").hidden, outline:getComputedStyle(button).outlineStyle, outlineWidth:parseFloat(getComputedStyle(button).outlineWidth) }));
          assert.deepEqual({ expanded:keyboard.expanded, bodyHidden:keyboard.bodyHidden }, { expanded:"false", bodyHidden:true });
          assert.ok(keyboard.outline !== "none" && keyboard.outlineWidth >= 2, `focus-visible missing: ${JSON.stringify(keyboard)}`);
          await page.keyboard.press("Enter");
          assert.equal(await collapse.getAttribute("aria-expanded"), "true");
          assert.deepEqual(noise, []);
          matrix.push({ embedding, viewport:viewport.name, dpr, controls:evidence.controls.length, scroll:evidence.body.scrollHeight > evidence.body.clientHeight });
        } finally { await context.close(); }
      }
    }
  }

  const behaviorContexts = [];
  for (const embedding of ["direct", "real-cross-origin-iframe"]) {
  const page = await browser.newPage({ viewport:{ width:664, height:664 } });
  page.setDefaultTimeout(8_000);
  await page.goto(embedding === "direct" ? childUrl : `${parentUrl}?width=640&height=640`, { waitUntil:"networkidle", timeout:15_000 });
  const target = embedding === "direct" ? page : page.frames().find((frame) => frame !== page.mainFrame());
  assert.ok(target, "Real cross-origin behavior child frame missing");
  const game = target.locator("aero-game");
  await game.waitFor();
  await game.evaluate((element) => {
    element.debugCameraSnapshot = () => Object.freeze({ visible:true, enabled:true });
    element.setMenuOpen(false);
    element.syncDebugCameraPresentation();
    globalThis.__environmentAudit = { calls:[], storage:[], events:[], messages:[], trustedLoadActivations:[], urls:{ created:[], revoked:[], anchors:[] } };
    element.shadowRoot.addEventListener("click", (event) => { if (event.composedPath().some((node) => node?.dataset?.action === "environment-config-load")) globalThis.__environmentAudit.trustedLoadActivations.push(event.isTrusted); }, true);
    // Playwright's CDP file injection emits an untrusted change even though the picker-opening
    // click is trusted. Keep the real chooser/input and feed its File through the component's
    // handler with the recorded trusted activation so only that automation limitation is bridged.
    element.environmentConfigInput().removeEventListener("change", element.boundEnvironmentConfigFile);
    for (const storage of [localStorage, sessionStorage]) for (const method of ["setItem", "removeItem", "clear"]) { const original=storage[method].bind(storage); storage[method]=(...args)=>{globalThis.__environmentAudit.storage.push([method,...args]);return original(...args);}; }
    element.addEventListener("aero-game-event", (event) => globalThis.__environmentAudit.events.push(structuredClone(event.detail)));
    addEventListener("message", (event) => globalThis.__environmentAudit.messages.push(structuredClone(event.data)));
    const renderer=element.graph.renderer, originalTransform=renderer.setEnvironmentTransform.bind(renderer), originalAsset=renderer.setEnvironmentAsset.bind(renderer);
    globalThis.__environmentAudit.originals={ create:URL.createObjectURL, revoke:URL.revokeObjectURL, anchor:HTMLAnchorElement.prototype.click };
    URL.createObjectURL=(blob)=>{const value=`blob:audit-${globalThis.__environmentAudit.urls.created.length}`;globalThis.__environmentAudit.urls.created.push({value,blob,type:blob.type,size:blob.size});return value;};
    URL.revokeObjectURL=(value)=>globalThis.__environmentAudit.urls.revoked.push(value);
    HTMLAnchorElement.prototype.click=function(){globalThis.__environmentAudit.urls.anchors.push({download:this.download,href:this.href});};
    renderer.setEnvironmentTransform=(transform)=>{globalThis.__environmentAudit.calls.push({type:"transform",transform:structuredClone(transform)});return originalTransform(transform);};
    renderer.setEnvironmentAsset=(descriptor)=>{globalThis.__environmentAudit.calls.push({type:"asset",id:descriptor?.id ?? null});return originalAsset(descriptor);};
  });

  const behavior = await game.evaluate(async (element) => {
    const select=element.shadowRoot.querySelector("[data-action='environment-asset-select']"), ids=[...select.options].map((option)=>option.value), first=ids[0], second=ids[1];
    element.selectEnvironment(second); const switchCalls=globalThis.__environmentAudit.calls.slice(-2);
    const yaw=element.shadowRoot.querySelector("[data-environment-field='yaw']");yaw.value="37";yaw.dispatchEvent(new Event("input",{bubbles:true,composed:true}));
    element.selectEnvironment(first);element.selectEnvironment(second);const remembered=element.environmentConfig(second).transform.rotationDegrees.yYaw;
    element.cameraCompositeMode="camera";element.renderEnvironmentStatus();const hiddenStatus=element.shadowRoot.querySelector("[data-role='environment-config-status']").value;const selectedWhileHidden=element.selectedEnvironmentId;element.cameraCompositeMode="aero";element.renderEnvironmentControls(false);
    const peer=document.createElement("aero-game");peer.setAttribute("instance-id","environment-peer");element.parentElement.append(peer);await new Promise((resolve)=>setTimeout(resolve,20));
    const independent=peer.selectedEnvironmentId===first&&peer.environmentConfig(first).transform.rotationDegrees.yYaw===0&&peer.environmentConfigs!==element.environmentConfigs;
    peer.environmentControlsCollapsed=true;const parent=element.parentElement,oldGraph=peer.graph;peer.remove();parent.append(peer);await new Promise((resolve)=>setTimeout(resolve,20));
    const reconnect=peer.graph!==oldGraph&&peer.selectedEnvironmentId===first&&peer.environmentConfig(first).transform.rotationDegrees.yYaw===0&&!peer.environmentControlsCollapsed;
    peer.remove();
    return { ids, switchCalls, remembered, hiddenStatus, selectedWhileHidden, selectedAfter:element.selectedEnvironmentId, independent, reconnect };
  });
  assert.equal(behavior.ids.length, 8);
  assert.deepEqual(behavior.switchCalls.map(({ type }) => type), ["transform", "asset"], "environment selection must apply transform before asset");
  assert.equal(behavior.remembered, 37);
  assert.match(behavior.hiddenStatus, /hidden by Camera/u);
  assert.equal(behavior.selectedWhileHidden, behavior.selectedAfter, "Camera/Aero must retain environment selection");
  assert.ok(behavior.independent && behavior.reconnect, `instance/reconnect reset failed: ${JSON.stringify(behavior)}`);

  const restoreErrorLoading = await game.evaluate(async (element) => {
    await element.graph.renderer.environmentLoadPromise;
    const renderer=element.graph.renderer,owner=renderer.environmentOwner,originalFetch=owner.fetchFn;
    globalThis.__environmentAudit.restore={owner,originalFetch,pending:[]};
    owner.fetchFn=(...args)=>new Promise((resolve,reject)=>globalThis.__environmentAudit.restore.pending.push({args,resolve,reject}));
    const previous=renderer.environmentLoadPromise,generation=element.environmentLoadGeneration,canvas=element.canvasElement();
    if(element.frameTimer!==0)throw new Error("restore test requires stopped display loop");canvas.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));canvas.dispatchEvent(new Event("webglcontextrestored"));await Promise.resolve();
    const afterNotification=element.environmentLoadGeneration;
    return {frameTimer:element.frameTimer,identityChanged:previous!==renderer.environmentLoadPromise,observedIdentity:element.environmentObservedLoadPromise===renderer.environmentLoadPromise,generationDelta:afterNotification-generation,pending:globalThis.__environmentAudit.restore.pending.length,state:element.environmentLoadState,status:element.environmentStatus};
  });
  assert.deepEqual(restoreErrorLoading,{frameTimer:0,identityChanged:true,observedIdentity:true,generationDelta:1,pending:1,state:"loading",status:"Environment loading."},`${embedding} stopped-loop real context restore notification failed`);
  await game.evaluate(async (element) => { const restore=globalThis.__environmentAudit.restore,request=restore.pending.shift();request.reject(new Error("forced restore failure"));await element.graph.renderer.environmentLoadPromise;await Promise.resolve(); });
  const retry = game.locator("[data-action='environment-asset-retry']");
  const restoreError = await game.evaluate((element) => ({state:element.environmentLoadState,status:element.shadowRoot.querySelector("[data-role='environment-config-status']").value,renderer:element.graph.renderer.describe().environment.state}));
  assert.deepEqual(restoreError,{state:"error",status:"Environment unavailable. Retry.",renderer:"error"},`${embedding} real context restore error failed`);
  assert.equal(await retry.isEnabled(), true);
  await game.evaluate(() => { globalThis.__environmentAudit.calls.length=0; });
  await retry.click();
  assert.equal(await retry.isDisabled(), true, "Retry must disable while its current generation loads");
  const retryCalls = await game.evaluate(() => globalThis.__environmentAudit.calls.map(({ type,id }) => ({type,id})));
  assert.deepEqual(retryCalls.map(({ type }) => type), ["transform", "asset", "asset"]);
  assert.equal(retryCalls[1].id, null);
  await game.evaluate(async (element) => { const restore=globalThis.__environmentAudit.restore,request=restore.pending.shift();request.resolve(await restore.originalFetch(...request.args));await element.graph.renderer.environmentLoadPromise;await Promise.resolve(); });
  const restoreReady = await game.evaluate((element) => ({state:element.environmentLoadState,status:element.shadowRoot.querySelector("[data-role='environment-config-status']").value,renderer:element.graph.renderer.describe().environment.state}));
  assert.deepEqual(restoreReady,{state:"ready",status:"",renderer:"ready"},`${embedding} Retry must reconcile ready`);
  assert.equal(await retry.isDisabled(), true, "Retry must be enabled only for renderer error state");

  const save = game.locator("[data-action='environment-config-save']");
  await save.click();
  const saved = await game.evaluate(async () => { const audit=globalThis.__environmentAudit,created=audit.urls.created[0];return { created:{value:created.value,type:created.type,size:created.size,text:await created.blob.text()}, revoked:audit.urls.revoked, anchors:audit.urls.anchors }; });
  assert.equal(saved.created.type, "application/json");
  assert.equal(saved.anchors.length, 1);
  assert.equal(saved.anchors[0].download, `${behavior.selectedAfter}.environment-config.v1.json`);
  assert.deepEqual(saved.revoked, [saved.created.value]);
  assert.equal(JSON.parse(saved.created.text).id, behavior.selectedAfter);

  const loadButton = game.locator("[data-action='environment-config-load']");
  const makeConfig = (overrides = {}) => ({ schema:"aerobeat/environment_asset_config", version:1, id:behavior.selectedAfter, projection:"equirectangular", transform:{ position:{x:0,y:0,z:0}, rotationDegrees:{xPitch:0,yYaw:41,zRoll:0}, scale:1 }, ...overrides });
  const load = async (name, buffer) => {
    const chooserPromise = page.waitForEvent("filechooser");
    await loadButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name, mimeType:"application/json", buffer });
    await game.evaluate(async (element) => {
      const trusted=globalThis.__environmentAudit.trustedLoadActivations.at(-1)===true;
      await element.handleEnvironmentConfigFile({currentTarget:element.environmentConfigInput(),isTrusted:trusted});
    });
    await page.waitForTimeout(30);
  };
  const exactText = JSON.stringify(makeConfig());
  const exact = Buffer.from(exactText + " ".repeat(16 * 1024 - Buffer.byteLength(exactText)));
  assert.equal(exact.byteLength, 16 * 1024);
  await load("exact-16k.json", exact);
  const exactLoad = await game.evaluate((element) => ({ yaw:element.environmentConfig().transform.rotationDegrees.yYaw, status:element.shadowRoot.querySelector("[data-role='environment-config-status']").value, request:element.environmentPickerRequest, enabled:element.debugCameraSnapshot().enabled, trustedLoadActivations:globalThis.__environmentAudit.trustedLoadActivations }));
  assert.equal(exactLoad.yaw, 41, `exact 16 KiB trusted chooser load failed: ${JSON.stringify(exactLoad)}`);

  const invalids = [
    ["too-large.json", Buffer.alloc(16 * 1024 + 1, 0x20)],
    ["fatal-utf8.json", Buffer.from([0xc3,0x28])],
    ["malformed.json", Buffer.from("{")],
    ["wrong-id.json", Buffer.from(JSON.stringify(makeConfig({id:"igloo-toon-photosphere"})))],
    ["projection.json", Buffer.from(JSON.stringify(makeConfig({projection:"cubemap"})))],
    ["range.json", Buffer.from(JSON.stringify(makeConfig({transform:{position:{x:0,y:0,z:0},rotationDegrees:{xPitch:0,yYaw:999,zRoll:0},scale:1}})))]
  ];
  for (const [name, bytes] of invalids) {
    const before = await game.evaluate((element) => ({ config:JSON.stringify(element.environmentConfig()), calls:globalThis.__environmentAudit.calls.length, renderer:JSON.stringify(element.graph.renderer.describe().environment.transform) }));
    await load(name, bytes);
    const after = await game.evaluate((element) => ({ config:JSON.stringify(element.environmentConfig()), calls:globalThis.__environmentAudit.calls.length, renderer:JSON.stringify(element.graph.renderer.describe().environment.transform), status:element.shadowRoot.querySelector("[data-role='environment-config-status']").value }));
    assert.deepEqual({config:after.config,calls:after.calls,renderer:after.renderer},{config:before.config,calls:before.calls,renderer:before.renderer},`${name} mutated state atomically`);
    assert.match(after.status, /invalid/u);
  }

  const stale = await game.evaluate(async (element) => {
    const current=()=>Object.freeze({connectionGeneration:element.connectedGeneration,sessionGeneration:element.sessionGeneration,graph:element.graph,selectedId:element.selectedEnvironmentId});
    const base=current(), selected={...base,selectedId:"not-selected"}, session={...base,sessionGeneration:base.sessionGeneration-1}, graph={...base,graph:{}}, connection={...base,connectionGeneration:base.connectionGeneration-1};
    Object.defineProperty(document,"hidden",{configurable:true,value:true});const hidden=element.isEnvironmentPickerRequestCurrent(base);Object.defineProperty(document,"hidden",{configurable:true,value:false});
    const valid=element.isEnvironmentPickerRequestCurrent(base),selection=element.isEnvironmentPickerRequestCurrent(selected),sessionResult=element.isEnvironmentPickerRequestCurrent(session),graphResult=element.isEnvironmentPickerRequestCurrent(graph),connectionResult=element.isEnvironmentPickerRequestCurrent(connection);
    const parent=element.parentElement,old=base;element.remove();parent.append(element);await new Promise((resolve)=>setTimeout(resolve,20));const reconnect=element.isEnvironmentPickerRequestCurrent(old);
    return {valid,selection,session:sessionResult,graph:graphResult,connection:connectionResult,hidden,reconnect};
  });
  assert.deepEqual(stale,{valid:true,selection:false,session:false,graph:false,connection:false,hidden:false,reconnect:false});
  await game.evaluate(() => { globalThis.__environmentAudit.storage.length=0;globalThis.__environmentAudit.events.length=0;globalThis.__environmentAudit.messages.length=0; });

  const lifecycle = await game.evaluate(async (element) => {
    const tick=async()=>{await Promise.resolve();await Promise.resolve();};
    await element.graph.renderer.environmentLoadPromise;
    const renderer=element.graph.renderer,owner=renderer.environmentOwner,restore={owner,originalFetch:owner.fetchFn,pending:[]};globalThis.__environmentAudit.restore=restore;
    owner.fetchFn=(...args)=>new Promise((resolve,reject)=>restore.pending.push({args,resolve,reject}));
    const dispatchRestore=()=>{const canvas=element.canvasElement(),before=renderer.environmentLoadPromise,generation=element.environmentLoadGeneration;canvas.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));canvas.dispatchEvent(new Event("webglcontextrestored"));return{promise:renderer.environmentLoadPromise,request:restore.pending.at(-1),identityChanged:before!==renderer.environmentLoadPromise,generation};};
    const startRestore=async()=>{const value=dispatchRestore();await tick();return value;};
    const resolveRequest=async(request)=>request.resolve(await restore.originalFetch(...request.args));
    const ids=[...element.shadowRoot.querySelector("select[data-action='environment-asset-select']").options].map((option)=>option.value);

    const selectionRestore=await startRestore(),other=ids.find((value)=>value!==element.selectedEnvironmentId);element.selectEnvironment(other);const selectionPromise=renderer.environmentLoadPromise,selectionRequest=restore.pending.at(-1);selectionRestore.request.reject(new Error("stale selection restore"));await selectionRestore.promise;await tick();const selectionStale={state:element.environmentLoadState,selected:element.selectedEnvironmentId};await resolveRequest(selectionRequest);await selectionPromise;await tick();const selectionReady={state:element.environmentLoadState,selected:element.selectedEnvironmentId,generationDelta:element.environmentLoadGeneration-selectionRestore.generation};

    const clearRestore=await startRestore();renderer.setEnvironmentAsset(null);const clearNext=ids.find((value)=>value!==element.selectedEnvironmentId);element.selectEnvironment(clearNext);const clearRecoveryPromise=renderer.environmentLoadPromise,clearRecoveryRequest=restore.pending.at(-1),clearBefore={state:element.environmentLoadState,status:element.environmentStatus,generation:element.environmentLoadGeneration,selected:element.selectedEnvironmentId};clearRestore.request.reject(new Error("stale clear restore"));await clearRestore.promise;await tick();const clearAfter={state:element.environmentLoadState,status:element.environmentStatus,generation:element.environmentLoadGeneration,selected:element.selectedEnvironmentId};await resolveRequest(clearRecoveryRequest);await clearRecoveryPromise;await tick();const clearRecovered=renderer.describe().environment.id===element.selectedEnvironmentId&&element.environmentLoadState==="ready";

    const errorRestore=await startRestore();errorRestore.request.reject(new Error("retry setup error"));await errorRestore.promise;await tick();element.retryEnvironmentAsset();const retryPromise=renderer.environmentLoadPromise,retryRequest=restore.pending.at(-1);const newerRestore=await startRestore(),newerLoading={state:element.environmentLoadState,generation:element.environmentLoadGeneration};retryRequest.reject(new Error("stale Retry completion"));await retryPromise;await tick();const retryStale={state:element.environmentLoadState,generation:element.environmentLoadGeneration};await resolveRequest(newerRestore.request);await newerRestore.promise;await tick();const newerReady={state:element.environmentLoadState,generation:element.environmentLoadGeneration};

    Object.defineProperty(document,"hidden",{configurable:true,value:true});const hiddenBefore={state:element.environmentLoadState,status:element.environmentStatus};const hiddenRestore=await startRestore();await resolveRequest(hiddenRestore.request);await hiddenRestore.promise;await tick();const hiddenSettled={state:element.environmentLoadState,status:element.environmentStatus,needs:element.environmentLoadNeedsReconcile};Object.defineProperty(document,"hidden",{configurable:true,value:false});await element.applyVisibility();await tick();const visibleReconciled={state:element.environmentLoadState,status:element.environmentStatus,needs:element.environmentLoadNeedsReconcile};

    element.cameraCompositeMode="camera";const cameraRestore=await startRestore();cameraRestore.request.reject(new Error("camera hidden restore error"));await cameraRestore.promise;await tick();const cameraHidden={state:element.environmentLoadState,status:element.environmentStatus,copy:element.shadowRoot.querySelector("[data-role='environment-config-status']").value};element.cameraCompositeMode="aero";element.renderEnvironmentStatus();

    Object.defineProperty(document,"hidden",{configurable:true,value:true});const oldGraph=element.graph,oldRestore=dispatchRestore(),parent=element.parentElement;element.remove();parent.append(element);await element.graph.renderer.environmentLoadPromise;await tick();oldRestore.request.reject(new Error("stale disconnected restore"));await oldRestore.promise;await tick();const reconnectHidden={newGraph:element.graph!==oldGraph,state:element.environmentLoadState,status:element.environmentStatus,needs:element.environmentLoadNeedsReconcile};Object.defineProperty(document,"hidden",{configurable:true,value:false});await element.applyVisibility();await tick();const reconnectVisible={state:element.environmentLoadState,status:element.environmentStatus,needs:element.environmentLoadNeedsReconcile};
    return {frameTimer:element.frameTimer,selection:{identityChanged:selectionRestore.identityChanged,stale:selectionStale,ready:selectionReady},clear:{before:clearBefore,after:clearAfter,recovered:clearRecovered},newerRetry:{loading:newerLoading,stale:retryStale,ready:newerReady},hidden:{before:hiddenBefore,settled:hiddenSettled,visible:visibleReconciled},cameraHidden,reconnect:{hidden:reconnectHidden,visible:reconnectVisible}};
  });
  assert.equal(lifecycle.frameTimer,0,"restore lifecycle matrix must remain independent of gameplay display loop");
  assert.equal(lifecycle.selection.identityChanged,true);
  assert.equal(lifecycle.selection.ready.generationDelta,2,"one restore notification plus one selection must create exactly two assembly generations");
  assert.equal(lifecycle.selection.stale.state,"loading","stale restore settlement mutated new selection");
  assert.equal(lifecycle.selection.ready.state,"ready");
  assert.deepEqual(lifecycle.clear.after,lifecycle.clear.before,"clear invalidation allowed stale restore settlement");
  assert.equal(lifecycle.clear.recovered,true);
  assert.equal(lifecycle.newerRetry.stale.state,"loading","older Retry settlement mutated newer restore generation");
  assert.equal(lifecycle.newerRetry.stale.generation,lifecycle.newerRetry.loading.generation);
  assert.equal(lifecycle.newerRetry.ready.state,"ready");
  assert.deepEqual({state:lifecycle.hidden.settled.state,status:lifecycle.hidden.settled.status},lifecycle.hidden.before,"hidden restore settlement mutated hidden UI state");
  assert.deepEqual(lifecycle.hidden.visible,{state:"ready",status:"",needs:false},"visible resume did not reconcile current restore promise");
  assert.deepEqual(lifecycle.cameraHidden,{state:"error",status:"Environment unavailable. Retry.",copy:"Environment hidden by Camera background."},"Camera-hidden copy lost precedence over internal load truth");
  assert.equal(lifecycle.reconnect.hidden.newGraph,true);
  assert.deepEqual(lifecycle.reconnect.visible,{state:"ready",status:"",needs:false},"hidden disconnect/reconnect did not reconcile new graph");

  const privacy = await game.evaluate(() => {
    const audit=globalThis.__environmentAudit;
    return { storage:audit.storage, events:JSON.stringify(audit.events), messages:JSON.stringify(audit.messages), snapshot:JSON.stringify(document.querySelector("aero-game").getSnapshot()), urlCount:audit.urls.created.length };
  });
  assert.deepEqual(privacy.storage, []);
  for (const surface of [privacy.events,privacy.messages,privacy.snapshot]) assert.doesNotMatch(surface, /environment_asset_config|environment-config|photosphere|selectedEnvironment|environmentLoadPromise/u);
  assert.equal(privacy.urlCount, 1);
  behaviorContexts.push({ embedding, trustedSave:true, trustedExact16KiBLoad:true, atomicRejects:invalids.map(([name])=>name), stale, privacy:true });
  await page.close();
  }

  assert.deepEqual(failures, [], `Environment controls browser validator FAIL:\n- ${failures.join("\n- ")}`);
  clearTimeout(hardTimeout);
  console.log(`Environment controls browser validator PASS: ${JSON.stringify({ matrix, behaviorContexts })}`);
} finally {
  clearTimeout(hardTimeout);
  await cleanup();
}
