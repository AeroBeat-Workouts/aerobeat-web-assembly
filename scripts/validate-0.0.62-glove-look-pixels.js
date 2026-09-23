// @ts-check

import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedPlaycanvasMeshWarning, isExpectedReadPixelsWarning } from "./readpixels-console-policy.js";

const vite=await createViteServer({appType:"spa",configFile:"vite.config.js",logLevel:"error",server:{host:"127.0.0.1",port:0,hmr:false,watch:null}});
await vite.listen();
const childUrl=vite.resolvedUrls?.local?.[0];
if(!childUrl)throw new Error("Vite URL unavailable");
const parent=createHttpServer((_request,response)=>{response.setHeader("content-type","text/html; charset=utf-8");response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="xr-spatial-tracking" src="${childUrl}"></iframe>`);});
await new Promise((resolve)=>parent.listen(0,"127.0.0.1",resolve));
const address=parent.address();
if(!address||typeof address==="string")throw new Error("Parent URL unavailable");
const parentUrl=`http://localhost:${address.port}/`;
const browser=await chromium.launch({headless:true});
const rows=[];
try{
  for(const embedding of ["direct","genuine_cross_origin_iframe"]){
    const context=await browser.newContext({viewport:embedding==="direct"?{width:844,height:390}:{width:868,height:414},deviceScaleFactor:1});
    const page=await context.newPage(),noise=[];
    page.on("console",(message)=>{const type=message.type(),text=message.text(),location=message.location();if(["warning","error"].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,childUrl)&&!isExpectedPlaycanvasMeshWarning(type,text))noise.push(`${type}:${text}`);});
    page.on("pageerror",(error)=>noise.push(`pageerror:${error.message}`));
    await page.goto(embedding==="direct"?childUrl:parentUrl,{waitUntil:"networkidle"});
    const target=embedding==="direct"?page:page.frames().find((frame)=>frame!==page.mainFrame());
    if(!target)throw new Error("Cross-origin child missing");
    await target.waitForSelector("aero-game");
    await target.waitForFunction(()=>document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state==="ready",{timeout:20_000});
    const proof=await target.evaluate(async()=>{
      const game=document.querySelector("aero-game"),renderer=game.graph.renderer,canvas=game.shadowRoot.querySelector("canvas");
      const {createEquipmentConfigIdentity,createResolvedEquipmentPose,equipmentEulerDegreesToQuaternion,gloveObbGeometry}=await import("/node_modules/@aerobeat/web-contracts/src/index.js");
      const configIdentity=createEquipmentConfigIdentity({schema:"aerobeat/equipment_config_identity",version:1,algorithm:"sha256",value:"d".repeat(64)});
      const pose=(role,x,euler)=>createResolvedEquipmentPose({role,mode:"boxing",anchor:{x,y:1,z:0},scale:.75,orientation:equipmentEulerDegreesToQuaternion(euler),geometryIdentity:gloveObbGeometry.identity,configIdentity});
      game.stopFrameLoop();game.setMenuOpen(false);renderer.resize({widthCssPx:844,heightCssPx:390,devicePixelRatio:1});renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:"solid",colors:["#071426"],angleDeg:180});
      const frame={presentation:"boxing_collider",nowMs:0,targets:[],timingWindowBeforeMs:180,timingWindowAfterMs:180,aftermath:[],hazardContacts:[]},options={grid:{x:0,y:0,width:1,height:1}},cursorOptions={...options,minConfidence:.5,sizeCssPx:32};
      const pixels=()=>{const copy=new OffscreenCanvas(canvas.width,canvas.height),ctx=copy.getContext("2d",{willReadFrequently:true});ctx.drawImage(canvas,0,0);return ctx.getImageData(0,0,copy.width,copy.height).data;};
      renderer.renderGameplayFrameWithCursorsAndEquipment(frame,[],cursorOptions,[],options);const baseline=pixels();
      const capture=(poses)=>{renderer.renderGameplayFrameWithCursorsAndEquipment(frame,[],cursorOptions,poses,options);const value=pixels();let count=0,hash=2166136261;for(let i=0;i<value.length;i+=4){const delta=Math.abs(value[i]-baseline[i])+Math.abs(value[i+1]-baseline[i+1])+Math.abs(value[i+2]-baseline[i+2]);if(delta<24)continue;count+=1;hash=Math.imul(hash^value[i]^value[i+1]^value[i+2],16777619)>>>0;}return{count,hash,equipment:renderer.describe().equipment};};
      const neutral=capture([pose("left_wrist",-.7,{x:0,y:0,z:0})]);
      const rotated=capture([pose("left_wrist",-.7,{x:25,y:-20,z:-70})]);
      const both=capture([pose("left_wrist",-.7,{x:0,y:0,z:0}),pose("right_wrist",.7,{x:0,y:0,z:0})]);
      return{neutral,rotated,both};
    });
    assert(proof.neutral.count>500&&proof.rotated.count>500,"canonical glove poses must be visibly rendered");
    assert.notEqual(proof.neutral.hash,proof.rotated.hash,"XYZ quaternion rotation must visibly alter the glove");
    assert.equal(proof.neutral.equipment.instanceCount,1);assert.equal(proof.rotated.equipment.instanceCount,1);assert.equal(proof.both.equipment.instanceCount,2);
    assert(proof.both.count>proof.neutral.count*1.5,"both canonical hand poses must remain independently visible");
    assert.deepEqual(noise,[]);rows.push({embedding,...proof});await context.close();
  }
  assert.notEqual(new URL(childUrl).origin,new URL(parentUrl).origin);
  assert.equal(rows[0].neutral.hash,rows[1].neutral.hash);assert.equal(rows[0].rotated.hash,rows[1].rotated.hash);assert.equal(rows[0].both.hash,rows[1].both.hash);
  console.log(`ORACLE 0.0.62-glove-look-pixels PASS: ${JSON.stringify(rows)}`);
}finally{await browser.close();await vite.close();await new Promise((resolve)=>parent.close(resolve));}
