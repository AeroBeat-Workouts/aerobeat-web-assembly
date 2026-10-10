// @ts-check
// Self-contained, non-release Chromium coverage: real assembly component,
// real renderer frame/canvas, and real composed transport computed opacity.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { gameplayAssets, gameplayAssetReleaseVersion } from "@aerobeat/web-renderer";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const root=fileURLToPath(new URL("../",import.meta.url));
// An optional disposable mirror enables the same assertions against a
// production-only counterfactual, with this script/fixture left untouched.
const testRoot=process.env.AEROBEAT_PORTRAIT_TEST_ROOT?.trim()||root;
const packageVersion=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8")).version;
assert(typeof packageVersion==="string"&&/^\d+\.\d+\.\d+$/.test(packageVersion),"test root must provide an exact package version");
const screenshots=process.env.AEROBEAT_PORTRAIT_SCREENSHOTS?.trim();
if(screenshots)mkdirSync(screenshots,{recursive:true});
const siblings=resolve(root,"..");
const uiSource=resolve(siblings,"aerobeat-web-ui/src/index.js"),hashSource=resolve(siblings,"aerobeat-web-hash/src/index.js");
const equipmentContractsSource=new URL("../../aerobeat-web-contracts/src/equipment-pose-contracts.js",import.meta.url).pathname;
const assetBase=resolve(siblings,"aerobeat-web-renderer/assets/gameplay",gameplayAssetReleaseVersion);
assert(gameplayAssets.length===9&&gameplayAssetReleaseVersion==="0.0.11","expected exact pinned nine-GLB renderer asset set");
const assetInventory=new Map(gameplayAssets.map(asset=>{
  const path=resolve(assetBase,asset.path),data=readFileSync(path);
  assert(data.length===asset.bytes&&createHash("sha256").update(data).digest("hex")===asset.sha256,`renderer GLB inventory hash/length mismatch: ${asset.id}`);
  return[`/assets/gameplay/${gameplayAssetReleaseVersion}/${asset.path}`,data];
}));
const gameplayAssetPlugin={name:"qa-pinned-renderer-glbs",configureServer(server){server.middlewares.use((request,response,next)=>{
  const pathname=new URL(request.url??"/","http://127.0.0.1").pathname;
  if(!pathname.startsWith(`/assets/gameplay/${gameplayAssetReleaseVersion}/`))return next();
  const data=assetInventory.get(pathname);
  if(!data){response.writeHead(404).end();return;}
  response.writeHead(200,{"content-type":"model/gltf-binary","content-length":String(data.length),"cache-control":"no-store"}).end(data);
});}};
const vite=await createViteServer({root:testRoot,appType:"spa",configFile:false,logLevel:"error",plugins:[gameplayAssetPlugin],
  resolve:{alias:[{find:/^@aerobeat\/web-ui$/,replacement:uiSource},{find:/^@aerobeat\/web-hash$/,replacement:hashSource}]},
  define:{__AEROBEAT_BUILD_STAMP__:JSON.stringify("portrait-browser-local"),__AEROBEAT_CACHE_BUST__:JSON.stringify("portrait-browser-local"),__AEROBEAT_PACKAGE_VERSION__:JSON.stringify(packageVersion)},
  server:{host:"127.0.0.1",port:0,hmr:false,fs:{allow:[siblings,testRoot]}}});
let browser;
try{
  await vite.listen();const url=vite.resolvedUrls?.local?.[0];assert.ok(url,"local Vite test URL unavailable");
  browser=await chromium.launch();
  const evidence=[];
  for(const dimensions of [{name:"portrait",width:393,height:852},{name:"landscape",width:852,height:393}]){
    const context=await browser.newContext({viewport:{width:dimensions.width,height:dimensions.height},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const page=await context.newPage(),noise=[];
    page.on("console",message=>{const type=message.type(),text=message.text(),location=message.location();if(["warning","error"].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,url)&&!isExpectedPlaycanvasMeshWarning(type,text))noise.push(`${type}:${text}`);});
    page.on("pageerror",error=>noise.push(`pageerror:${error.message}`));
    await page.goto(url,{waitUntil:"networkidle"});
    const game=page.locator("aero-game");await game.waitFor({state:"attached"});
    await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.renderer?.describe()?.gameplayAssets?.state==="ready",null,{timeout:30000});
    await game.evaluate(async element=>{
      const original=element.serviceGraphFactory;element.remove();
      element.serviceGraphFactory=options=>{
        const graph=original(options),audioState={state:"paused"};
        const snapshot=()=>({state:"ready",packageId:"portrait-browser",selectedVariant:{variantId:"portrait-flow",chartId:"portrait-chart",mode:"flow",rulesetId:"flow_colliders_v1",recipeId:null,modifierIds:[],ranked:false,mapHash:{schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:"a".repeat(64)},scoreIdentityHash:{schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:"a".repeat(64)},provenance:{baseVariantId:"portrait-flow"}},variants:[],resolvedEvents:[],song:{name:"Portrait browser fixture"},background:null,lineage:null});
        const content={getSnapshot:snapshot,subscribe(listener){listener(snapshot());return()=>{};},readAsset:()=>new Uint8Array(),setPlaybackState(){},destroy(){}};
        const audio={getMixSnapshot:()=>({musicVolume:.5,sfxVolume:.5}),setMix:()=>({musicVolume:.5,sfxVolume:.5}),activateLease:async()=>{},releaseLease:async()=>{},pauseForLease:async()=>{},play:async()=>{audioState.state="playing";},pause:async()=>{audioState.state="paused";},seek:async()=>{},stop:async()=>{audioState.state="stopped";},setDocumentHidden:async()=>{},destroy:async()=>{},getStatus:()=>({state:audioState.state,autoplayState:"allowed",durationSeconds:120}),getClockSnapshot:()=>({contextTimeSeconds:performance.now()/1000,positionSeconds:0,durationSeconds:120,progress:0,playing:audioState.state==="playing"})};
        const authoring={getSnapshot:()=>({state:"idle",progress:0}),subscribe:()=>()=>{},listPackages:async()=>[],listCollections:async()=>[],estimateStorage:async()=>({usageBytes:0,quotaBytes:1024}),destroy(){}};
        return Object.freeze({...graph,content,audio,authoring});
      };
      document.querySelector("main").append(element);
      await element.startSession("visual_test",{requireDownloaded:false});element.setMenuOpen(false);await element.menuPauseTail;
    });
    const state=(mode="current")=>game.evaluate((element,mode)=>{
      const renderer=element.graph.renderer,camera=renderer.cameraEntity?.camera,canvas=element.shadowRoot.querySelector("canvas"),bar=element.shadowRoot.querySelector("aero-visual-test-transport"),host=element.getBoundingClientRect(),canvasBounds=canvas.getBoundingClientRect();
      if(mode==="production")renderer.setDebugCameraEnabled(false);
      const frame=element.rendererFrame(),z=frame.trackExtensionWorldUnits;
      renderer.renderGameplayScene(frame,null,null);
      const projected=camera?.worldToScreen({x:0,y:-.8,z}),configured=element.desiredGameSetup.trackExtensionWorldUnits;
      const receiver=renderer.shadowFloorEntity,position=receiver?.getPosition(),scale=receiver?.getLocalScale(),trackObjects=renderer.lastModel?.objects?.filter(object=>object.kind==="track")??[];
      const receiverZMax=position&&scale?position.z+scale.z/2:null;
      const trackBounds=trackObjects.map(object=>({zMin:object.position.z-12,zMax:object.position.z+12})).sort((left,right)=>left.zMin-right.zMin);
      return {host:{width:host.width,height:host.height},canvas:{width:canvasBounds.width,height:canvasBounds.height,pixelWidth:canvas.width,pixelHeight:canvas.height},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},frameExtension:z,configured,receiverZMax,trackBounds,projectedY:projected?.y??null,nearClip:camera?.nearClip??null,cameraZ:renderer.cameraEntity?.getPosition()?.z??null,fov:camera?.fov??null,cameraMode:renderer.activeGameplayCameraMode??null,debugEnabled:renderer.debugEnabled,rendererWidthCssPx:renderer.widthCssPx,rendererHeightCssPx:renderer.heightCssPx,opacity:Number(getComputedStyle(bar).opacity),opacityVariable:bar.style.getPropertyValue("--aero-bottom-ui-opacity"),hidden:bar.hidden,menuOpen:element.getSnapshot().interaction.menuOpen,session:element.graph.gameplay.getSnapshot().session.state,focused:bar.matches(":focus-within"),hover:bar.matches(":hover"),rendererReady:Boolean(renderer.cameraEntity&&canvas.width>0&&canvas.height>0)};
    },mode);
    await page.waitForTimeout(420);
    const debugFrame=await state();
    const initial=await state("production");
    assert(initial.rendererReady&&!initial.hidden&&initial.session==="playing"&&!initial.menuOpen,`${dimensions.name} must show active Visual Test renderer and transport: ${JSON.stringify(initial)}`);
    assert(Math.abs(initial.host.width-dimensions.width)<1&&Math.abs(initial.host.height-dimensions.height)<1&&Math.abs(initial.canvas.width-initial.host.width)<1&&Math.abs(initial.canvas.height-initial.host.height)<1&&initial.viewport.dpr===3,`${dimensions.name} full-parent host/canvas geometry at DPR3: ${JSON.stringify(initial)}`);
    assert(debugFrame.debugEnabled&&debugFrame.frameExtension===debugFrame.configured&&Number.isFinite(debugFrame.projectedY)&&debugFrame.projectedY>=debugFrame.canvas.height+8,`${dimensions.name} Visual Test debug FOV48 must keep configured extension and cover viewport: ${JSON.stringify(debugFrame)}`);
    assert(debugFrame.trackBounds.length===3&&Math.abs(debugFrame.receiverZMax-debugFrame.frameExtension)<.001,`${dimensions.name} debug Test frame must retain three GLBs and aligned receiver: ${JSON.stringify(debugFrame)}`);
    assert(!initial.debugEnabled&&Number.isFinite(initial.projectedY)&&Number.isFinite(initial.frameExtension)&&initial.projectedY>=initial.canvas.height+8,`${dimensions.name} production camera frame must cover viewport in CSS pixels: ${JSON.stringify(initial)}`);
    assert(initial.trackBounds.length===3&&initial.trackBounds.every((segment,index)=>index===0||Math.abs(segment.zMin-initial.trackBounds[index-1].zMax)<.001)&&Math.abs(initial.trackBounds.at(-1).zMax-initial.frameExtension)<.001&&Math.abs(initial.receiverZMax-initial.frameExtension)<.001,`${dimensions.name} actual rendered three joined GLB track segments and shadow receiver zMax must match assembly frame extension: ${JSON.stringify(initial)}`);
    if(dimensions.name==="portrait"){
      assert(Math.abs(debugFrame.fov-48)<.1&&debugFrame.frameExtension===2&&debugFrame.projectedY>initial.canvas.height+8,`portrait Visual Test free-fly camera must keep extension 2 without claiming a regression: ${JSON.stringify(debugFrame)}`);
      assert(Math.abs(initial.fov-100.029)<.15&&initial.frameExtension>3&&initial.frameExtension<=20&&initial.projectedY>=initial.canvas.height+12,`portrait production camera must extend real frame past lower edge in CSS units at DPR3: ${JSON.stringify(initial)}`);
      assert(Math.abs(initial.opacity-.3)<.035,`portrait initial touch-idle computed transport opacity must be .3: ${JSON.stringify(initial)}`);
      const center=await game.evaluate(element=>{const bounds=element.shadowRoot.querySelector("aero-visual-test-transport").getBoundingClientRect();return{x:bounds.left+bounds.width/2,y:bounds.top+2};});
      const cdp=await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...center,id:1}]});await page.waitForTimeout(420);
      const touching=await state();assert(touching.opacityVariable==="1"&&touching.opacity>.95,`portrait held touch computed opacity must be 1: ${JSON.stringify(touching)}`);
      await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await page.waitForTimeout(420);
      const released=await state();assert(Math.abs(released.opacity-.3)<.035,`portrait release without mouse movement must restore .3: ${JSON.stringify(released)}`);
      await game.evaluate(async element=>{element.shadowRoot.querySelector("aero-visual-test-transport").shadowRoot.querySelector("button").click();await element.transportIntentTail;});await page.waitForTimeout(420);
      const paused=await state();assert(paused.session==="paused_manual"&&paused.opacity>.95,`portrait paused controls must remain fully legible: ${JSON.stringify(paused)}`);
      await game.evaluate(async element=>{element.setMenuOpen(true);await element.menuPauseTail;});await page.waitForTimeout(420);
      const menu=await state();assert(menu.menuOpen&&menu.opacity>.95,`portrait menu-open transport must remain opaque: ${JSON.stringify(menu)}`);
      await game.evaluate(async element=>{element.setMenuOpen(false);await element.menuPauseTail;});
      await game.evaluate(element=>element.shadowRoot.querySelector("aero-visual-test-transport").shadowRoot.querySelector("button").focus());
      await page.waitForFunction(()=>{const bar=document.querySelector("aero-game")?.shadowRoot?.querySelector("aero-visual-test-transport");return bar?.matches(":focus-within")&&Number(getComputedStyle(bar).opacity)>.95;},null,{timeout:3000});
      const focused=await state();assert(focused.focused&&focused.opacity>.95,`portrait keyboard focus must keep transport opaque: ${JSON.stringify(focused)}`);
    }else assert(initial.frameExtension===initial.configured,`landscape extension must remain exactly configured: ${JSON.stringify(initial)}`);
    const visualPixels=dimensions.name==="portrait"?await game.evaluate(async element=>{
      const renderer=element.graph.renderer,canvas=element.shadowRoot.querySelector("canvas");
      element.stopFrameLoop();renderer.setDebugCameraEnabled(false);renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:"solid",colors:["#080D16"],angleDeg:180});
      const frame=element.rendererFrame(),sample=()=>{const out=document.createElement("canvas");out.width=canvas.width;out.height=canvas.height;const context=out.getContext("2d",{willReadFrequently:true});context.drawImage(canvas,0,0);return context.getImageData(0,0,canvas.width,canvas.height).data;};
      renderer.renderGameplayFrameWithCursorsAndEquipment({...frame,targets:[]},[],null,[],null);
      const extended=sample();renderer.renderGameplayFrameWithCursorsAndEquipment({...frame,targets:[],trackExtensionWorldUnits:2},[],null,[],null);
      const short=sample();renderer.renderGameplayFrameWithCursorsAndEquipment(frame,[],null,[],null);
      let changed=0,darkened=0,brightened=0,fullChanged=0,maxDelta=0;const cssY=renderer.heightCssPx-90;
      for(let i=0;i<extended.length;i+=4){const delta=Math.abs(extended[i]-short[i])+Math.abs(extended[i+1]-short[i+1])+Math.abs(extended[i+2]-short[i+2]);maxDelta=Math.max(maxDelta,delta);if(delta>45)fullChanged++;}
      const ratio=canvas.height/renderer.heightCssPx,fromY=Math.max(0,Math.floor((cssY-12)*ratio)),toY=Math.min(canvas.height,Math.ceil((cssY+12)*ratio));
      for(let y=fromY;y<toY;y++)for(let x=Math.floor(canvas.width*.15);x<Math.ceil(canvas.width*.85);x++){
        const i=(y*canvas.width+x)*4,d=(extended[i]-short[i])+(extended[i+1]-short[i+1])+(extended[i+2]-short[i+2]);
        if(Math.abs(extended[i]-short[i])+Math.abs(extended[i+1]-short[i+1])+Math.abs(extended[i+2]-short[i+2])>45){changed++;if(d< -25)darkened++;if(d>25)brightened++;}
      }
      return{changed,darkened,brightened,fullChanged,maxDelta,cssY,cssBand:[fromY/ratio,toY/ratio],frameExtension:frame.trackExtensionWorldUnits,assetState:renderer.gameplayAssetLoader.describe().state,extendedAtCenter:[...extended.slice((Math.round(cssY*ratio)*canvas.width+Math.round(canvas.width/2))*4,(Math.round(cssY*ratio)*canvas.width+Math.round(canvas.width/2))*4+4)],shortAtCenter:[...short.slice((Math.round(cssY*ratio)*canvas.width+Math.round(canvas.width/2))*4,(Math.round(cssY*ratio)*canvas.width+Math.round(canvas.width/2))*4+4)]};
    }):null;
    if(visualPixels)assert(visualPixels.assetState==="ready"&&visualPixels.frameExtension>3&&visualPixels.changed>1000&&visualPixels.brightened>1000&&visualPixels.extendedAtCenter[3]===255&&visualPixels.shortAtCenter[3]===255&&visualPixels.extendedAtCenter.slice(0,3).reduce((a,b)=>a+b,0)>visualPixels.shortAtCenter.slice(0,3).reduce((a,b)=>a+b,0)+100,`portrait real RGBA glass at CSS H-90 must brighten against forced-extension2 negative control: ${JSON.stringify(visualPixels)}`);
    const shadowPixels=dimensions.name==="portrait"?await game.evaluate(async(element,contractsUrl)=>{
      const renderer=element.graph.renderer,canvas=element.shadowRoot.querySelector("canvas"),floor=renderer.shadowFloorEntity;
      if(renderer.gameplayAssetLoader.describe().state!=="ready"||!floor?.render?.receiveShadows)throw new Error("GLB equipment and live receiver must be ready for pixel proof");
      renderer.setDebugCameraEnabled(false);
      const frame=element.rendererFrame();
      const {createResolvedEquipmentPose,createEquipmentConfigIdentity,equipmentEulerDegreesToQuaternion,saberCapsuleGeometry,gloveObbGeometry}=await import(contractsUrl);
      const identity=createEquipmentConfigIdentity({schema:"aerobeat/equipment_config_identity",version:1,algorithm:"sha256",value:"1".repeat(64)});
      const equipment=mode=>createResolvedEquipmentPose({role:"left_wrist",mode,anchor:{x:1.5,y:.8,z:3},scale:mode==="flow"?1.7:2.2,orientation:equipmentEulerDegreesToQuaternion({x:0,y:0,z:0}),geometryIdentity:mode==="flow"?saberCapsuleGeometry.identity:gloveObbGeometry.identity,configIdentity:identity});
      const sample=()=>{const image=document.createElement("canvas");image.width=canvas.width;image.height=canvas.height;const context=image.getContext("2d",{willReadFrequently:true});context.drawImage(canvas,0,0);return context.getImageData(0,0,image.width,image.height).data;};
      const compare=(withShadow,withoutShadow)=>{let changed=0,darkened=0;const startY=Math.floor(canvas.height*.72),endY=canvas.height-60;for(let y=startY;y<endY;y++)for(let x=Math.floor(canvas.width*.15);x<Math.ceil(canvas.width*.85);x++){const index=(y*canvas.width+x)*4,delta=(withShadow[index]-withoutShadow[index])+(withShadow[index+1]-withoutShadow[index+1])+(withShadow[index+2]-withoutShadow[index+2]);if(Math.abs(withShadow[index]-withoutShadow[index])+Math.abs(withShadow[index+1]-withoutShadow[index+1])+Math.abs(withShadow[index+2]-withoutShadow[index+2])>45){changed++;if(delta< -25)darkened++;}}return{changed,darkened};};
      const results={};for(const [presentation,mode] of [["flow","flow"],["boxing_spatial_grid","boxing"]]){
        const active={...frame,presentation,targets:[]};renderer.renderGameplayFrameWithCursorsAndEquipment(active,[],null,[equipment(mode)],null);
        const equipmentId=mode==="flow"?"equipment/flow-saber-v1:left_wrist":"equipment/boxing-glove-v1:left_wrist";
        const nativeEntities=renderer.equipmentPools.get(equipmentId)??[];
        const enabledModels=nativeEntities.filter(entity=>entity.enabled&&entity.name?.includes("left_wrist")&&entity.name?.includes("model")).length;
        const withShadow=sample(),receiver=floor.render,receiverAabb=receiver.meshInstances?.[0]?.aabb;
        const receiverZMax=receiverAabb?receiverAabb.center.z+receiverAabb.halfExtents.z:null;
        receiver.receiveShadows=false;renderer.manualTick();const withoutShadow=sample();receiver.receiveShadows=true;renderer.manualTick();results[mode]={...compare(withShadow,withoutShadow),enabledModels,receiverZMax};
      }
      renderer.renderGameplayFrameWithCursorsAndEquipment({...frame,targets:[]},[],null,[],null);
      return results;
    },`/@fs/${equipmentContractsSource}`):null;
    if(shadowPixels)assert(shadowPixels.flow.enabledModels>0&&shadowPixels.boxing.enabledModels>0&&Math.abs(shadowPixels.flow.receiverZMax-initial.frameExtension)<.001&&Math.abs(shadowPixels.boxing.receiverZMax-initial.frameExtension)<.001&&shadowPixels.flow.changed>100&&shadowPixels.flow.darkened>100&&shadowPixels.boxing.changed>1000&&shadowPixels.boxing.darkened>1000,`portrait bottom-quarter native GLB equipment and exact receiver AABB must produce saber and glove shadow pixel deltas: ${JSON.stringify(shadowPixels)}`);
    const screenshotPath=screenshots?resolve(screenshots,`portrait-playfield-${dimensions.width}x${dimensions.height}.png`):null;
    const screenshot=await game.screenshot(screenshotPath?{path:screenshotPath}:{});
    assert(screenshot.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&screenshot.length>1000,`${dimensions.name} screenshot must be nonempty PNG of actual aero-game`);
    assert(noise.length===0,`${dimensions.name} unexpected browser noise: ${noise.join(" | ")}`);
    evidence.push({name:dimensions.name,visualPixels,debug:{fov:debugFrame.fov,frameExtension:debugFrame.frameExtension,nearEdgeCssY:debugFrame.projectedY},production:{fov:initial.fov,frameExtension:initial.frameExtension,nearEdgeCssY:initial.projectedY},configured:initial.configured,canvasCssHeight:initial.canvas.height,shadowPixels,screenshotPath,screenshotBytes:screenshot.length});
    await context.close();
  }
  console.log(`Portrait/landscape real-canvas geometry and computed transport-opacity assertions passed: ${JSON.stringify(evidence)}`);
}finally{await browser?.close();await vite.close();}
