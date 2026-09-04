// @ts-check

import { createServer as createHttpServer } from "node:http";
import { cameraPreviewToAthlete } from "@aerobeat/web-contracts";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

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
  console.log(`Gameplay cursor integration passed: ${evidence.map((item) => `${item.kind}:${item.width}x${item.height}@${item.dpr}`).join(", ")}`);
} finally {
  await browser.close(); await vite.close(); await new Promise((resolve) => parentServer.close(resolve));
}

async function runContext(context) {
  const browserContext = await browser.newContext({ viewport: context.kind === "direct" ? { width:context.width,height:context.height } : { width:context.width + 24,height:context.height + 24 }, deviceScaleFactor:context.dpr });
  const page = await browserContext.newPage(); const noise = [];
  page.on("console", (message) => { if (["warning","error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
  let game;
  if (context.kind === "direct") { await page.goto(childUrl, { waitUntil:"networkidle" }); game = page.locator("aero-game"); }
  else { await page.goto(`${parentUrl}?width=${context.width}&height=${context.height}`, { waitUntil:"networkidle" }); game = page.frameLocator("#game").locator("aero-game"); }
  await game.waitFor();
  const athleteLeftWrist = cameraPreviewToAthlete({ x: 0.1, y: 0.47 });
  const result = await game.evaluate((element, athleteLeftWrist) => {
    const originalGraph = element.graph; const renderer = originalGraph.renderer; const originalFrame = renderer.renderGameplayFrame.bind(renderer); const originalCursors = renderer.renderGameplayCursors.bind(renderer);
    const canvas = element.shadowRoot.querySelector("canvas[data-role='renderer']"); const calls = []; let baseline = null; let latestCursorCall = null;
    const displayedPixels = () => { const copy=document.createElement("canvas"); const scale=Math.min(1,256/Math.max(canvas.width,canvas.height)); copy.width=Math.max(1,Math.round(canvas.width*scale)); copy.height=Math.max(1,Math.round(canvas.height*scale)); const context=copy.getContext("2d",{willReadFrequently:true}); context.drawImage(canvas,0,0,copy.width,copy.height); return context.getImageData(0,0,copy.width,copy.height).data; };
    renderer.renderGameplayFrame = (frame) => { calls.push("gameplay"); const value = originalFrame(frame); baseline = displayedPixels(); return value; };
    renderer.renderGameplayCursors = (cursors, options) => { calls.push("cursors"); const value=originalCursors(cursors,options); latestCursorCall = { cursors:structuredClone(cursors),options:structuredClone(options),result:structuredClone(value) }; return value; };
    const cursorInput = (overrides = {}) => ({ tracking:{ gameplayPaused:false,freshCalibrationRequired:false,allRequiredAnchorsVisible:true },retainedGeometryDimmed:false,countdownFrozen:false,anchors:[{ anchor:"nose",valid:true,x:.17,y:.23,confidence:.99 },{ anchor:"left_wrist",valid:true,x:athleteLeftWrist.x,y:athleteLeftWrist.y,confidence:.98 },{ anchor:"right_wrist",valid:true,x:.53,y:.71,confidence:.97 }],...overrides });
    let input = cursorInput(); let session = { state:"playing",timelinePositionMs:0 };
    const content = { state:"ready",packageId:"cursor-fixture",selectedVariant:{ variantId:"cursor-flow",mode:"flow",rulesetId:"flow_grid_v2" },resolvedEvents:[] };
    const graph = { ...originalGraph,content:{ getSnapshot:()=>content },gameplay:{ getSnapshot:()=>({ session }) },input:{ getSnapshot:()=>input },renderer };
    element.graph=graph; element.menuOpen=false;
    const render = (background,environment) => { element.environmentMode=environment; renderer.setBackgroundProjection({kind:"solid",colors:[background],angleDeg:0}); calls.length=0; latestCursorCall=null; element.renderGameplay(graph); const displayed=displayedPixels(); let changedPixels=0; for(let index=0;index<displayed.length;index+=4)if(displayed[index]!==baseline[index]||displayed[index+1]!==baseline[index+1]||displayed[index+2]!==baseline[index+2]||displayed[index+3]!==baseline[index+3])changedPixels+=1; const scene=[...renderer.markerPool,...renderer.overlayEntities].filter((entity)=>entity.enabled).map((entity)=>({name:entity.name,x:entity.getPosition().x,y:entity.getPosition().y,z:entity.getPosition().z})); const status=renderer.describe(); return {order:[...calls],call:latestCursorCall,scene,changedPixels,environment,background,effectiveDpr:status.devicePixelRatio,serviceId:status.serviceId}; };
    const dark=render("#071426","aero"),light=render("#f5f5f5","camera");
    input=cursorInput({tracking:{gameplayPaused:true,freshCalibrationRequired:true,allRequiredAnchorsVisible:false},retainedGeometryDimmed:true,countdownFrozen:true}); const stale=render("#071426","aero");
    input=cursorInput(); input.anchors[1]={anchor:"left_wrist",valid:true,x:.9,y:.47,confidence:.2}; const lowConfidence=render("#071426","aero");
    input=cursorInput(); element.menuOpen=true; const menu=render("#071426","aero");
    element.menuOpen=false; session={state:"calibrating",timelinePositionMs:0}; const calibrating=render("#071426","aero");
    session={state:"countdown",timelinePositionMs:0}; const countdown=render("#071426","aero");
    renderer.renderGameplayFrame=originalFrame; renderer.renderGameplayCursors=originalCursors; element.graph=originalGraph; const snapshotText=JSON.stringify(element.getSnapshot());
    return {dark,light,stale,lowConfidence,menu,calibrating,countdown,snapshotHasCursorPayload:/gameplayCursors|cursorRecords|cursorPixels/u.test(snapshotText),devicePixelRatio};
  },athleteLeftWrist);
  const label=`${context.kind}:${context.width}x${context.height}@${context.dpr}`;
  for(const frame of [result.dark,result.light,result.countdown]){
    assert(JSON.stringify(frame.order)===JSON.stringify(["gameplay","cursors"]),`${label} draw order must be gameplay then cursors: ${JSON.stringify(frame.order)}`);
    assert(frame.serviceId==="aero.renderer.playcanvas",`${label} must use the PlayCanvas renderer: ${JSON.stringify(frame)}`);
    assert(frame.call.cursors.length===3&&JSON.stringify(frame.call.cursors.map((cursor)=>cursor.role))===JSON.stringify(["nose","left_wrist","right_wrist"]),`${label} canonical cursor roles missing: ${JSON.stringify(frame.call)}`);
    assert(frame.call.cursors.every((cursor)=>JSON.stringify(Object.keys(cursor).sort())===JSON.stringify(["confidence","role","x","y"])),`${label} cursors must be exact bounded records: ${JSON.stringify(frame.call.cursors)}`);
    assert(JSON.stringify(frame.call.options.grid)===JSON.stringify({x:0,y:0,width:1,height:1})&&frame.call.options.minConfidence===.5&&frame.call.options.sizeCssPx===18,`${label} cursor options must use the exact assembly projection grid: ${JSON.stringify(frame.call.options)}`);
    assert(frame.call.result.cursorCount===3&&frame.scene.length===3&&frame.changedPixels>0,`${label} PlayCanvas cursor entities must alter displayed canvas pixels: ${JSON.stringify(frame)}`);
    const left=frame.scene.find((entry)=>entry.name==="cursor-left_wrist"); assert(frame.call.cursors[1].x===.9&&left?.x>0,`${label} camera x=.1 projected athlete x=.9 must remain athlete-right without a second mirror: ${JSON.stringify(frame.scene)}`);
  }
  assert(result.dark.call.cursors.map((cursor)=>JSON.stringify(cursor)).join("|")===result.light.call.cursors.map((cursor)=>JSON.stringify(cursor)).join("|"),`${label} Aero/Camera cursor coordinates must match`);
  for(const frame of [result.stale,result.menu,result.calibrating])assert(frame.call.cursors.length===0&&frame.call.result.cursorCount===0&&frame.scene.length===0&&frame.changedPixels===0,`${label} stale/menu/calibrating frames must clear cursor entities and pixels: ${JSON.stringify(frame)}`);
  assert(result.lowConfidence.call.cursors.length===2&&!result.lowConfidence.call.cursors.some((cursor)=>cursor.role==="left_wrist")&&!result.lowConfidence.scene.some((entry)=>entry.name==="cursor-left_wrist")&&result.lowConfidence.call.result.cursorCount===2,`${label} low-confidence cursor must be omitted from records and scene: ${JSON.stringify(result.lowConfidence)}`);
  assert(result.countdown.call.cursors.length===3,`${label} countdown must retain current calibrated gameplay cursors`);
  assert(!result.snapshotHasCursorPayload,`${label} cursor drawing must add no public cursor/media payload`);
  assert(result.dark.effectiveDpr===Math.min(context.dpr,2)&&result.light.effectiveDpr===Math.min(context.dpr,2),`${label} renderer must preserve truthful DPR cap: ${JSON.stringify(result)}`);
  assert(noise.length===0,`${label} emitted console noise: ${noise.join(" | ")}`);
  await browserContext.close(); return context;
}

function assert(value,message){if(!value)throw new Error(message);}
