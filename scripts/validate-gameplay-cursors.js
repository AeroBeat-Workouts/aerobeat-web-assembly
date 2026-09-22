// @ts-check
// 0.0.61 L-F5 (chgy/hk5q/vths): repurposed from the legacy marker oracle to
// validate EQUIPMENT staging through the combined production entry
// renderGameplayFrameWithCursorsAndEquipment. GATE 1: legacy wrist/nose
// markers are hidden (production always passes an empty cursor array); the
// Flow saber beam and Boxing glove are the visible + detection surface.

import { createServer as createHttpServer } from "node:http";
import { cameraPreviewToAthlete } from "@aerobeat/web-contracts";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parentServer = createHttpServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://parent.invalid");
  const width = Number(url.searchParams.get("width")) || 390; const height = Number(url.searchParams.get("height")) || 844;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><style>html,body{margin:0}iframe{border:0;display:block;width:${width}px;height:${height}px}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parentServer.listen(0, "127.0.0.1", resolve));
const address = parentServer.address();
if (!address || typeof address === "string") throw new Error("Parent server unavailable");
const parentUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch();
const contexts = [
  { kind:"direct",width:390,height:844,dpr:1 }, { kind:"direct",width:390,height:844,dpr:3 },
  { kind:"direct",width:844,height:390,dpr:1 }, { kind:"direct",width:844,height:390,dpr:3 },
  { kind:"iframe",width:390,height:844,dpr:1 }, { kind:"iframe",width:390,height:844,dpr:3 },
  { kind:"iframe",width:844,height:390,dpr:1 }, { kind:"iframe",width:844,height:390,dpr:3 }
];
const evidence = [];
try {
  for (const context of contexts) evidence.push(await runContext(context));
  console.log(`Gameplay equipment integration passed: ${evidence.map((item) => `${item.kind}:${item.width}x${item.height}@${item.dpr}`).join(", ")}`);
} finally {
  await browser.close(); await vite.close(); await new Promise((resolve) => parentServer.close(resolve));
}

async function runContext(context) {
  const browserContext = await browser.newContext({ viewport: context.kind === "direct" ? { width:context.width,height:context.height } : { width:context.width + 24,height:context.height + 24 }, deviceScaleFactor:context.dpr });
  const page = await browserContext.newPage(); const noise = [];
  page.on("console", (message) => { const type=message.type(),text=message.text(),location=message.location(); if (["warning", "error"].includes(type) && !isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,childUrl) && !isExpectedPlaycanvasMeshWarning(type,text)) noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
  let game;
  if (context.kind === "direct") { await page.goto(childUrl, { waitUntil:"networkidle" }); game = page.locator("aero-game"); }
  else { await page.goto(`${parentUrl}?width=${context.width}&height=${context.height}`, { waitUntil:"networkidle" }); game = page.frameLocator("#game").locator("aero-game"); }
  await game.waitFor();
  const athleteLeftWrist = cameraPreviewToAthlete({ x: 0.1, y: 0.47 });
  const result = await game.evaluate((element, athleteLeftWrist) => {
    const originalGraph = element.graph; const renderer = originalGraph.renderer; const originalFrame = renderer.renderGameplayFrame.bind(renderer);
    const originalCombined = renderer.renderGameplayFrameWithCursorsAndEquipment.bind(renderer); const originalManualTick=renderer.manualTick.bind(renderer);
    const canvas = element.shadowRoot.querySelector("canvas[data-role='renderer']"); const calls = []; let baseline = null; let latestCall = null; let manualTickCount=0; renderer.manualTick=()=>{manualTickCount+=1;return originalManualTick();};
    const displayedPixels = () => { const copy=document.createElement("canvas"); const scale=Math.min(1,256/Math.max(canvas.width,canvas.height)); copy.width=Math.max(1,Math.round(canvas.width*scale)); copy.height=Math.max(1,Math.round(canvas.height*scale)); const context=copy.getContext("2d",{willReadFrequently:true}); context.drawImage(canvas,0,0,copy.width,copy.height); return context.getImageData(0,0,copy.width,copy.height).data; };
    renderer.renderGameplayFrameWithCursorsAndEquipment = (frame,cursors,cursorOptions,equipment,equipmentOptions) => { originalFrame(frame); baseline=displayedPixels(); calls.push("gameplay","equipment"); const beforeTicks=manualTickCount,value=originalCombined(frame,cursors,cursorOptions,equipment,equipmentOptions); latestCall={cursors:structuredClone(cursors),cursorOptions:structuredClone(cursorOptions),equipment:structuredClone(equipment),equipmentOptions:structuredClone(equipmentOptions),result:{cursorCount:value.cursorCount??null,equipmentCount:value.equipmentCount??null},manualTickDelta:manualTickCount-beforeTicks};return value; };
    const cursorInput = (overrides = {}) => ({ tracking:{ gameplayPaused:false,freshCalibrationRequired:false,allRequiredAnchorsVisible:true },retainedGeometryDimmed:false,countdownFrozen:false,anchors:[{ anchor:"nose",valid:true,x:.17,y:.23,confidence:.99 },{ anchor:"left_wrist",valid:true,x:athleteLeftWrist.x,y:athleteLeftWrist.y,confidence:.98 },{ anchor:"right_wrist",valid:true,x:.53,y:.71,confidence:.97 }],...overrides });
    let input = cursorInput(); let session = { state:"playing",purpose:"play",timelinePositionMs:0,rulesetId:"flow_colliders_v1" };
    const content = { state:"ready",packageId:"cursor-fixture",selectedVariant:{ variantId:"cursor-flow",chartId:"cursor-flow-chart",mode:"flow",rulesetId:"flow_colliders_v1" },resolvedEvents:[] };
    const graph = { ...originalGraph,content:{ getSnapshot:()=>content },gameplay:{ getSnapshot:()=>({ session }) },input:{ getSnapshot:()=>input },renderer };
    element.graph=graph; element.menuOpen=false;
    const sceneDump = () => { const equipment=[]; for(const [assetId,list] of renderer.equipmentPools) for(const entity of list) equipment.push({assetId,name:entity.name,enabled:entity.enabled,x:entity.getPosition().x,y:entity.getPosition().y}); const markers=[...renderer.markerPool].map((entity)=>({name:entity.name,enabled:entity.enabled})); return { equipment, markers }; };
    const render = (background,environment) => { element.environmentMode=environment; renderer.setBackgroundProjection({kind:"solid",colors:[background],angleDeg:0}); calls.length=0; latestCall=null; element.renderGameplay(graph); const displayed=displayedPixels(); let changedPixels=0; for(let index=0;index<displayed.length;index+=4)if(displayed[index]!==baseline[index]||displayed[index+1]!==baseline[index+1]||displayed[index+2]!==baseline[index+2]||displayed[index+3]!==baseline[index+3])changedPixels+=1; const scene=sceneDump(); const status=renderer.describe(); return {order:[...calls],call:latestCall,scene,changedPixels,environment,background,effectiveDpr:status.devicePixelRatio,serviceId:status.serviceId}; };
    const dark=render("#071426","aero");
    const light=render("#f5f5f5","camera");
    input=cursorInput({tracking:{gameplayPaused:true,freshCalibrationRequired:true,allRequiredAnchorsVisible:false},retainedGeometryDimmed:true,countdownFrozen:true}); const stale=render("#071426","aero");
    input=cursorInput(); element.menuOpen=true; const menu=render("#071426","aero"); element.menuOpen=false;
    input=cursorInput(); session={state:"calibrating",purpose:"play",timelinePositionMs:0,rulesetId:"flow_colliders_v1"}; const calibrating=render("#071426","aero");
    session={state:"countdown",purpose:"play",timelinePositionMs:0,rulesetId:"flow_colliders_v1"}; const countdown=render("#071426","aero");
    input=cursorInput({tracking:{gameplayPaused:false,freshCalibrationRequired:false,allRequiredAnchorsVisible:false,anchorsFrozen:true,degradedAnchors:["left_wrist"]}}); const frozen=render("#071426","aero");
    input=cursorInput(); input.anchors[1]={anchor:"left_wrist",valid:true,x:.9,y:.47,confidence:.2}; const lowConfidence=render("#071426","aero");
    input=cursorInput(); session={state:"playing",purpose:"play",timelinePositionMs:0,rulesetId:"boxing_collider_v1"}; content.selectedVariant={variantId:"cursor-boxing",chartId:"cursor-boxing-chart",mode:"boxing",rulesetId:"boxing_collider_v1"}; const boxing=render("#071426","aero");
    const boxingLight=render("#f5f5f5","camera");
    renderer.renderGameplayFrameWithCursorsAndEquipment=originalCombined;renderer.manualTick=originalManualTick;element.graph=originalGraph; const snapshotText=JSON.stringify(element.getSnapshot());
    return {dark,light,stale,menu,calibrating,countdown,frozen,lowConfidence,boxing,boxingLight,snapshotHasCursorPayload:/gameplayCursors|cursorRecords|cursorPixels|equipmentRecords|gameplayEquipment|private_performance|mediaPipeRuntime|poseAge|cameraFormat/u.test(snapshotText),devicePixelRatio};
  },athleteLeftWrist);
  const label=`${context.kind}:${context.width}x${context.height}@${context.dpr}`;
  // 0.0.62 L-C (r2lb r1a): the flow saber is now a single GLB entity
  // (flow-saber/flow-saber-v1) with two material slots (core + shell)
  // inside the same entity. The old primitive saber had a separate core
  // entity (`equipment-{hand}-core`).
  const flowNames=(frame,hand)=>[`equipment-${hand}`];
  const gloveNames=(frame,hand)=>[`equipment-${hand}`];
  const hasEnabled=(frame,names)=>names.every((name)=>frame.scene.equipment.some((entry)=>entry.name===name&&entry.enabled===true));
  const anyEnabledEquipment=(frame)=>frame.scene.equipment.some((entry)=>entry.enabled===true);
  const noMarkersEnabled=(frame)=>!frame.scene.markers.some((entry)=>entry.enabled===true);
  const noCursorNamed=(frame)=>!frame.scene.markers.some((entry)=>/cursor-/u.test(entry.name))&&!frame.scene.equipment.some((entry)=>/cursor-/u.test(entry.name));
  for(const frame of [result.dark,result.countdown,result.frozen,result.lowConfidence,result.stale,result.menu,result.calibrating]){
    assert(JSON.stringify(frame.order)===JSON.stringify(["gameplay","equipment"]),`${label} draw order must be gameplay then equipment: ${JSON.stringify(frame.order)}`);
    assert(frame.serviceId==="aero.renderer.playcanvas",`${label} must use the PlayCanvas renderer: ${JSON.stringify(frame)}`);
    assert(Array.isArray(frame.call.cursors)&&frame.call.cursors.length===0,`${label} GATE 1: production must pass an empty cursor array (legacy markers hidden): ${JSON.stringify(frame.call.cursors)}`);
    assert(JSON.stringify(frame.call.cursorOptions.grid)===JSON.stringify({x:0,y:0,width:1,height:1})&&frame.call.cursorOptions.minConfidence===.5&&frame.call.cursorOptions.sizeCssPx===32,`${label} cursor options seam must still carry the exact assembly projection grid: ${JSON.stringify(frame.call.cursorOptions)}`);
    assert(JSON.stringify(frame.call.equipmentOptions.grid)===JSON.stringify({x:0,y:0,width:1,height:1}),`${label} equipment options must use the exact assembly projection grid: ${JSON.stringify(frame.call.equipmentOptions)}`);
    assert(frame.call.manualTickDelta===1,`${label} staged gameplay/equipment must use one PlayCanvas tick: ${JSON.stringify(frame.call.manualTickDelta)}`);
    assert(noMarkersEnabled(frame)&&noCursorNamed(frame),`${label} no legacy marker entities may be enabled or present: ${JSON.stringify(frame.scene)}`);
  }
  // Flow, playing, full confidence: both hands staged as saber beams.
  assert(result.dark.call.equipment.length===2&&JSON.stringify(result.dark.call.equipment.map((record)=>record.role))===JSON.stringify(["left_wrist","right_wrist"]),`${label} flow playing must stage both hands: ${JSON.stringify(result.dark.call.equipment)}`);
  assert(result.dark.call.equipment.every((record)=>JSON.stringify(Object.keys(record).sort().filter((key) => !["scale", "rotationZDeg", "dimmed"].includes(key)))===JSON.stringify(["direction", "mode", "role", "x", "y"])&&record.mode==="flow"&&Number.isFinite(record.direction.x)&&Number.isFinite(record.direction.y)),`${label} flow records must be exact bounded records with a finite direction: ${JSON.stringify(result.dark.call.equipment)}`);
  assert(result.dark.call.equipment.find((record)=>record.role==="left_wrist").x===athleteLeftWrist.x&&result.dark.call.equipment.find((record)=>record.role==="left_wrist").y===athleteLeftWrist.y&&result.dark.call.equipment.find((record)=>record.role==="right_wrist").x===.53&&result.dark.call.equipment.find((record)=>record.role==="right_wrist").y===.71,`${label} equipment records must carry the input wrist coordinates: ${JSON.stringify(result.dark.call.equipment)}`);
  assert(result.dark.call.result.equipmentCount===2&&result.dark.call.result.cursorCount===0,`${label} renderer must stage both flow equipment records and zero legacy cursors: ${JSON.stringify(result.dark.call.result)}`);
  assert(hasEnabled(result.dark,flowNames(result.dark,"left_wrist"))&&hasEnabled(result.dark,flowNames(result.dark,"right_wrist")),`${label} both flow hands must have enabled equipment + core entities: ${JSON.stringify(result.dark.scene)}`);
  const darkLeft=result.dark.scene.equipment.find((entry)=>entry.name==="equipment-left_wrist"); assert(darkLeft&&darkLeft.x>0,`${label} camera x=.1 projected athlete x=.9 must remain athlete-right without a second mirror: ${JSON.stringify(darkLeft)}`);
  assert(result.dark.changedPixels>0,`${label} flow saber on dark Aero must alter displayed canvas pixels: ${JSON.stringify({changedPixels:result.dark.changedPixels})}`);
  // Flow on bright Camera: additive glow may not add pixels over #f5f5f5, so prove
  // staging (records + entities), and prove the coordinate seam is environment-stable.
  assert(JSON.stringify(result.dark.call.equipment)===JSON.stringify(result.light.call.equipment),`${label} Aero/Camera equipment coordinates must match`);
  assert(result.light.call.result.equipmentCount===2&&hasEnabled(result.light,flowNames(result.light,"left_wrist"))&&hasEnabled(result.light,flowNames(result.light,"right_wrist")),`${label} flow equipment must stay staged on Camera: ${JSON.stringify(result.light)}`);
  // Suppressed states: no records, no entities, no pixels.
  for(const frame of [result.stale,result.menu,result.calibrating]){
    assert(frame.call.equipment.length===0&&frame.call.result.equipmentCount===0&&!anyEnabledEquipment(frame)&&frame.changedPixels===0,`${label} stale/menu/calibrating frames must clear equipment records, entities and pixels: ${JSON.stringify(frame)}`);
  }
  // Countdown retains current calibrated equipment.
  assert(result.countdown.call.equipment.length===2&&result.countdown.call.result.equipmentCount===2&&result.countdown.changedPixels>0,`${label} countdown must retain current calibrated equipment: ${JSON.stringify(result.countdown.call.equipment)} changed=${result.countdown.changedPixels}`);
  // Mid-run freeze: degraded hand is retained but dimmed; the other hand is not.
  const frozenLeft=result.frozen.call.equipment.find((record)=>record.role==="left_wrist"),frozenRight=result.frozen.call.equipment.find((record)=>record.role==="right_wrist");
  assert(result.frozen.call.equipment.length===2&&frozenLeft?.dimmed===true&&frozenRight?.dimmed===false&&hasEnabled(result.frozen,flowNames(result.frozen,"left_wrist"))&&hasEnabled(result.frozen,flowNames(result.frozen,"right_wrist"))&&result.frozen.changedPixels>0,`${label} frozen/degraded left hand must stay retained with dimmed=true while the right hand stays dimmed=false: ${JSON.stringify(result.frozen.call.equipment)} changed=${result.frozen.changedPixels}`);
  // Low-confidence hand is omitted from records and scene.
  assert(result.lowConfidence.call.equipment.length===1&&result.lowConfidence.call.equipment.every((record)=>record.role==="right_wrist")&&!result.lowConfidence.scene.equipment.some((entry)=>entry.name==="equipment-left_wrist"&&entry.enabled)&&result.lowConfidence.call.result.equipmentCount===1&&result.lowConfidence.changedPixels>0,`${label} low-confidence wrist must be omitted from equipment records and scene: ${JSON.stringify(result.lowConfidence)}`);
  // Boxing variant: gloves (opaque body + accent), no direction key.
  assert(result.boxing.call.equipment.length===2&&JSON.stringify(result.boxing.call.equipment.map((record)=>record.role))===JSON.stringify(["left_wrist","right_wrist"])&&result.boxing.call.equipment.every((record)=>JSON.stringify(Object.keys(record).sort().filter((key) => !["scale", "rotationZDeg", "dimmed"].includes(key)))===JSON.stringify(["mode", "role", "x", "y"])&&record.mode==="boxing"),`${label} boxing playing must stage both hands as gloves without a direction: ${JSON.stringify(result.boxing.call.equipment)}`);
  assert(result.boxing.call.result.equipmentCount===2&&hasEnabled(result.boxing,gloveNames(result.boxing,"left_wrist"))&&hasEnabled(result.boxing,gloveNames(result.boxing,"right_wrist")),`${label} both boxing hands must have enabled glove GLB entities: ${JSON.stringify(result.boxing.scene)}`);
  assert(result.boxing.changedPixels>0,`${label} boxing gloves on dark Aero must alter displayed canvas pixels: ${JSON.stringify({changedPixels:result.boxing.changedPixels})}`);
  assert(result.boxingLight.changedPixels>0,`${label} opaque boxing gloves must stay pixel-visible over bright Camera: ${JSON.stringify({changedPixels:result.boxingLight.changedPixels})}`);
  assert(!result.snapshotHasCursorPayload,`${label} equipment drawing must add no public cursor/equipment/media payload`);
  assert(result.dark.effectiveDpr===Math.min(context.dpr,2)&&result.boxingLight.effectiveDpr===Math.min(context.dpr,2),`${label} renderer must preserve truthful DPR cap: ${JSON.stringify(result)}`);
  assert(noise.length===0,`${label} emitted console noise: ${noise.join(" | ")}`);
  await browserContext.close(); return context;
}

function assert(value,message){if(!value)throw new Error(message);}
