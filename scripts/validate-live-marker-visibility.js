// @ts-check

import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning } from "./readpixels-console-policy.js";

const sizes = [18, 24, 28, 32, 36];
// uo1y §7 thresholds: marker-center pixel is role-color-dominant; tint patch ≥80% of projected front area at both default (18) and enlarged (32).
const roleHex = Object.freeze({ nose:"#F4C20D", left_wrist:"#2693FF", right_wrist:"#39C96B" });
const environmentIds = [
  "luminious-ice-cave-photosphere", "icebergs-on-sea-shore-photosphere", "snow-mountain-with-lake-photosphere", "iceland-waterfall-photosphere",
  "igloo-toon-photosphere", "salt-lake-photosphere", "salt-lake-2-photosphere", "alpine-river-valley-photosphere"
];
const viewports = [{ name:"portrait", width:390, height:844 }, { name:"landscape", width:844, height:390 }];
const vite = await createViteServer({ appType:"spa", configFile:"vite.config.js", logLevel:"error", server:{ host:"127.0.0.1", port:0, hmr:false, watch:null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const expectedPageUrl = childUrl;
const parent = createHttpServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://parent.invalid"), width=Number(url.searchParams.get("width"))||390, height=Number(url.searchParams.get("height"))||844;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><style>html,body{margin:0}iframe{border:0;display:block;width:${width}px;height:${height}px}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parent.listen(0, "127.0.0.1", resolve));
const address=parent.address(); if(!address||typeof address==="string")throw new Error("Parent URL unavailable");
const parentUrl=`http://localhost:${address.port}/`;
const browser=await chromium.launch({headless:true});
const rows=[];
try {
  for (const embedding of ["direct","genuine_iframe"]) for (const viewport of viewports) for (const requestedDpr of [1,3]) {
    const context=await browser.newContext({viewport:embedding==="direct"?{width:viewport.width,height:viewport.height}:{width:viewport.width+24,height:viewport.height+24},deviceScaleFactor:requestedDpr});
    const page=await context.newPage(),noise=[];
    page.on("console",(message)=>{const type=message.type(),text=message.text(),location=message.location();if(["warning","error"].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,expectedPageUrl))noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`);});
    page.on("pageerror",(error)=>noise.push(`pageerror:${error.message}`));
    try {
      await page.goto(embedding==="direct"?childUrl:`${parentUrl}?width=${viewport.width}&height=${viewport.height}`,{waitUntil:"networkidle"});
      const target=embedding==="direct"?page:page.frames().find((frame)=>frame!==page.mainFrame()); if(!target)throw new Error("Genuine iframe child missing");
      await target.waitForFunction(()=>document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state==="ready",{timeout:15_000});
      const evidence=await target.evaluate(async({width,height,requestedDpr,sizes,environmentIds,roleHex})=>{
        const game=document.querySelector("aero-game"),renderer=game.graph.renderer,canvas=game.shadowRoot.querySelector("canvas[data-role='renderer']");
        game.stopFrameLoop();game.setMenuOpen(false);renderer.resize({widthCssPx:width,heightCssPx:height,devicePixelRatio:requestedDpr});renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:"solid",colors:["#00000000"],angleDeg:0});
        const roles=["nose","left_wrist","right_wrist"],roleColors={nose:"yellow",left_wrist:"cyan",right_wrist:"red"},positions=[[.5,.5],[.5,.25],[.65,.5],[.5,.75],[.35,.5],[.35,.25],[.65,.25],[.65,.75],[.35,.75]];
        const cursor=(role,[x,y])=>({role,x,y,confidence:1});
        const blank=()=>renderer.clear({color:[0,0,0,0]});
        const cropFor=(entity,pad=6)=>{const screen=renderer.cameraEntity.camera.worldToScreen(entity.getPosition()),dpr=renderer.devicePixelRatio,w=Math.min(canvas.width,Math.ceil((48+pad*2)*dpr)),h=Math.min(canvas.height,Math.ceil((48+pad*2)*dpr)),clampStart=(value,limit,span)=>Math.max(0,Math.min(limit-span,Math.round(value-span/2))),x=clampStart(screen.x*dpr,canvas.width,w),directY=clampStart(screen.y*dpr,canvas.height,h),invertedY=clampStart(canvas.height-screen.y*dpr,canvas.height,h);return{x,y:directY,alternateY:invertedY,w,h};};
        const readCrop=(rect)=>{const capture=(y)=>{const out=new OffscreenCanvas(rect.w,rect.h),ctx=out.getContext("2d",{willReadFrequently:true});ctx.drawImage(canvas,rect.x,y,rect.w,rect.h,0,0,rect.w,rect.h);return{width:rect.w,height:rect.h,data:ctx.getImageData(0,0,rect.w,rect.h).data};},direct=capture(rect.y);if(rect.alternateY===rect.y)return direct;const alternate=capture(rect.alternateY),alpha=(image)=>{let sum=0;for(let p=3;p<image.data.length;p+=4)sum+=image.data[p];return sum;};return alpha(alternate)>alpha(direct)?alternate:direct;};
        const analyzeRaw=(image)=>{const {data,width,height}=image;let covered=0,opaque=0,dark=0,white=0,tint=0,minX=width,minY=height,maxX=-1,maxY=-1;const perimeter=[];for(let p=0;p<data.length;p+=4){const a=data[p+3];if(!a)continue;covered++;if(a===255)opaque++;const r=data[p],g=data[p+1],b=data[p+2],light=(r+g+b)/3,span=Math.max(r,g,b)-Math.min(r,g,b);if(a===255&&light<92)dark++;else if(a===255&&light>176&&span<58)white++;else if(a===255&&span>34)tint++;const i=p/4,x=i%width,y=Math.floor(i/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);const neighbors=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]];if(neighbors.some(([nx,ny])=>nx<0||ny<0||nx>=width||ny>=height||data[(ny*width+nx)*4+3]===0))perimeter.push(p);}return{covered,opaque,dark,white,tint,bbox:maxX<0?null:{width:maxX-minX+1,height:maxY-minY+1},perimeter};};
        const background=(width,height,phase,kind)=>{const out=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*4,q=((x+phase*7)>>2)+((y+phase*5)>>2),stripe=((x*3+y*5+phase*17)>>3)&1;let rgb;if(kind===0)rgb=(q&1)?[250,250,250]:[4,6,8];else if(kind===1)rgb=stripe?[237,185,154]:[31,24,21];else if(kind===2)rgb=(q%3)?[5,62,118]:[224,244,255];else rgb=stripe?[8,108,56]:[244,230,38];out[p]=rgb[0];out[p+1]=rgb[1];out[p+2]=rgb[2];out[p+3]=255;}return out;};
        const contrast=(raw,analysis)=>{const means=[];for(let kind=0;kind<4;kind++)for(let phase=0;phase<2;phase++){const bg=background(raw.width,raw.height,phase,kind);let sum=0;for(const p of analysis.perimeter){const a=raw.data[p+3]/255,r=(raw.data[p]*a+bg[p]*(1-a)),g=(raw.data[p+1]*a+bg[p+1]*(1-a)),b=(raw.data[p+2]*a+bg[p+2]*(1-a));sum+=(Math.abs(r-bg[p])+Math.abs(g-bg[p+1])+Math.abs(b-bg[p+2]))/3;}means.push(sum/Math.max(1,analysis.perimeter.length));}return Math.min(...means);};
        const hexToRgbTop=(hex)=>{const v=parseInt(hex.slice(1),16);return[(v>>16)&255,(v>>8)&255,v&255];};
        const sizeRows=[];
        for(const size of sizes){const samples=[];for(let shift=0;shift<positions.length;shift++){blank();const cursors=roles.map((role,index)=>cursor(role,positions[(shift+index*3)%positions.length]));renderer.renderGameplayCursors(cursors,{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:size});for(const role of roles){const entity=renderer.markerPool.find((entry)=>entry.name===`cursor-${role}`),image=readCrop(cropFor(entity)),metric=analyzeRaw(image);if(!metric.bbox){const full=readCrop({x:0,y:0,alternateY:0,w:canvas.width,h:canvas.height}),screen=renderer.cameraEntity.camera.worldToScreen(entity.getPosition());throw new Error(`marker crop diagnostic ${JSON.stringify({role,position:positions[(shift+roles.indexOf(role)*3)%positions.length],screen:{x:screen.x,y:screen.y},canvas:{width:canvas.width,height:canvas.height},full:analyzeRaw(full).bbox})}`);}// uo1y §7: marker-center pixel is role-color-dominant (NOT white, NOT background).
const hexToRgb=(hex)=>{const v=parseInt(hex.slice(1),16);return[(v>>16)&255,(v>>8)&255,v&255];};
const centerPixel=(image)=>{const p=(Math.floor(image.height/2)*image.width+Math.floor(image.width/2))*4;return Array.from(image.data.slice(p,p+4));};
const roleRgb=hexToRgb(roleHex[role]);
const center=centerPixel(image);
// Tint patch ≥80% of projected front area: fraction of covered pixels that are neither structural white nor background (i.e. tint-dominant face). With the 0.0.11 tint-dominant marker the structural white share is a thin polar keyline, so the tint face owns ≥80%.
const coveredCount=metric.covered,whiteCount=metric.white;const tintFacePixels=coveredCount-whiteCount;const tintFraction=coveredCount>0?tintFacePixels/coveredCount:0;
samples.push({role,position:positions[(shift+roles.indexOf(role)*3)%positions.length],...metric,perimeterContrast:contrast(image,metric),centerPixel:center,roleExpected:roleRgb,tintFraction});}}
          blank();renderer.renderGameplayCursors(roles.map((role,index)=>cursor(role,[[.5,.28],[.35,.68],[.65,.68]][index])),{grid:{x:0,y:0,width:1,height:1},sizeCssPx:size});const materialCoverage={};for(const name of ["mat/charcoal","mat/white","mat/tint_base"]){for(const entity of renderer.markerPool)for(const record of renderer.assetMaterials.get(entity))record.meshInstance.visible=record.name===name;renderer.manualTick();materialCoverage[name]=roles.map((role)=>{const entity=renderer.markerPool.find((entry)=>entry.name===`cursor-${role}`);return analyzeRaw(readCrop(cropFor(entity))).opaque;});}for(const entity of renderer.markerPool)for(const record of renderer.assetMaterials.get(entity))record.meshInstance.visible=true;renderer.manualTick();
          const materialState=renderer.markerPool.flatMap((entity)=>renderer.assetMaterials.get(entity).map((record)=>({name:record.name,opacity:record.material.opacity,blendType:record.material.blendType,depthTest:record.material.depthTest,depthWrite:record.material.depthWrite,cull:record.material.cull,useLighting:record.material.useLighting,diffuse:[record.material.diffuse.r,record.material.diffuse.g,record.material.diffuse.b],emissive:[record.material.emissive.r,record.material.emissive.g,record.material.emissive.b]})));
          // uo1y §7 deterministic center/tint capture at well-separated fixed positions (no overlap) for this size.
          const uo1ySamples=[];if(size===18||size===32){blank();const uo1yPositions=[[.5,.28],[.35,.68],[.65,.68]];renderer.renderGameplayCursors(roles.map((role,index)=>cursor(role,uo1yPositions[index])),{grid:{x:0,y:0,width:1,height:1},sizeCssPx:size});for(const role of roles){const entity=renderer.markerPool.find((entry)=>entry.name===`cursor-${role}`),image=readCrop(cropFor(entity)),metric=analyzeRaw(image);const p=(Math.floor(image.height/2)*image.width+Math.floor(image.width/2))*4;uo1ySamples.push({role,centerPixel:Array.from(image.data.slice(p,p+4)),roleExpected:hexToRgbTop(roleHex[role]),tintFraction:metric.covered>0?(metric.covered-metric.white)/metric.covered:0});}}
          sizeRows.push({size,samples,materialCoverage,materialState,uo1ySamples});
        }
        const flicker=[];for(const nowMs of [1000,1016,1032,1048,1064,1080]){renderer.renderGameplayFrame({presentation:"flow",nowMs,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[]});renderer.renderGameplayCursors(roles.map((role,index)=>cursor(role,[[.5,.28],[.35,.68],[.65,.68]][index])),{grid:{x:0,y:0,width:1,height:1},sizeCssPx:32});flicker.push(roles.map((role)=>{const entity=renderer.markerPool.find((entry)=>entry.name===`cursor-${role}`),image=readCrop(cropFor(entity)),p=(Math.floor(image.height/2)*image.width+Math.floor(image.width/2))*4;return Array.from(image.data.slice(p,p+4));}));}
        // rt4k both-environment pixel oracle: per environment asset AND for the camera/composite
        // equivalent (setEnvironmentVisible(false) + solid-background projection), assert per-marker
        // center-pixel role-color dominance at BOTH 18px and 32px, plus a structural guardrail.
        const environmentRows=[];
        const markerPositions=[[.5,.28],[.35,.68],[.65,.68]];
        const analyzeMarkerPixels=(image,entity,dpr,roleHex)=>{
          const screen=renderer.cameraEntity.camera.worldToScreen(entity.getPosition());
          const cx=Math.round(screen.x*dpr),cyInv=Math.round(canvas.height-screen.y*dpr),cyDirect=Math.round(screen.y*dpr);
          // Try both Y orientations; pick the one with more alpha.
          const sampleAt=(x,y)=>{if(x<0||y<0||x>=canvas.width||y>=canvas.height)return null;const oc=new OffscreenCanvas(1,1),octx=oc.getContext("2d",{willReadFrequently:true});octx.drawImage(canvas,x,y,1,1,0,0,1,1);return Array.from(octx.getImageData(0,0,1,1).data);};
          const c1=sampleAt(cx,cyDirect),c2=sampleAt(cx,cyInv);
          const center=(c1&&c2)?(c1[3]>=c2[3]?c1:c2):(c1??c2);
          if(!center)return null;
          const [r,g,b,a]=center;
          const roleRgb=roleHex[role];const v=parseInt(roleRgb.slice(1),16);const er=(v>>16)&255,eg=(v>>8)&255,eb=v&255;
          const channelDistance=Math.abs(r-er)+Math.abs(g-eg)+Math.abs(b-eb);
          const light=(r+g+b)/3,span=Math.max(r,g,b)-Math.min(r,g,b);
          const isWhiteLike=light>176&&span<58;
          // Ring samples: 4 points at radius ~half the marker CSS px * dpr around center
          const ringRadius=Math.max(2,Math.round(size*dpr*0.4));
          const ring=[];
          for(const [dx,dy] of [[ringRadius,0],[-ringRadius,0],[0,ringRadius],[0,-ringRadius]]){const px=cx+dx,py=(c1&&c2&&c2[3]>c1[3])?cyInv+dy:cyDirect+dy;const smp=sampleAt(px,py);if(smp)ring.push({r:smp[0],g:smp[1],b:smp[2],a:smp[3],dist:Math.abs(smp[0]-er)+Math.abs(smp[1]-eg)+Math.abs(smp[2]-eb),whiteLike:(smp[0]+smp[1]+smp[2])/3>176&&(Math.max(smp[0],smp[1],smp[2])-Math.min(smp[0],smp[1],smp[2]))<58});}
          return{center:[r,g,b,a],channelDistance,isWhiteLike,ring};
        };
        const hexToRoleRgb=(hex)=>{const v=parseInt(hex.slice(1),16);return[(v>>16)&255,(v>>8)&255,v&255];};
        const runMarkerPixelCheck=(envMode,id,size)=>{
          const results=[];
          for(let ri=0;ri<roles.length;ri++){
            const role=roles[ri],pos=markerPositions[ri];
            const entity=renderer.markerPool.find((entry)=>entry.name===`cursor-${role}`);
            if(!entity)continue;
            const image=null; // we use sampleAt directly
            const screen=renderer.cameraEntity.camera.worldToScreen(entity.getPosition());
            const dpr=renderer.devicePixelRatio;
            const cx=Math.round(screen.x*dpr);
            const cyDirect=Math.round(screen.y*dpr),cyInv=Math.round(canvas.height-screen.y*dpr);
            const samplePt=(x,y)=>{if(x<0||y<0||x>=canvas.width||y>=canvas.height)return null;const oc=new OffscreenCanvas(1,1),octx=oc.getContext("2d",{willReadFrequently:true});octx.drawImage(canvas,x,y,1,1,0,0,1,1);return Array.from(octx.getImageData(0,0,1,1).data);};
            const cD=samplePt(cx,cyDirect),cI=samplePt(cx,cyInv);
            const center=(cD&&cI)?(cD[3]>=cI[3]?cD:cI):(cD??cI);
            if(!center)continue;
            const [r,g,b,a]=center;const expected=hexToRoleRgb(roleHex[role]);
            const chDist=Math.abs(r-expected[0])+Math.abs(g-expected[1])+Math.abs(b-expected[2]);
            const light=(r+g+b)/3,span=Math.max(r,g,b)-Math.min(r,g,b);
            const whiteLike=light>176&&span<58;
            const ringRad=Math.max(2,Math.round(size*dpr*0.4));
            let minRingDistToRole=Infinity,minRingDistToBackground=0;
            for(const [ddx,ddy] of [[ringRad,0],[-ringRad,0],[0,ringRad],[0,-ringRad]]){
              const py=(cI&&cD&&cI[3]>cD[3])?cyInv+ddy:cyDirect+ddy;
              const s=samplePt(cx+ddx,py);if(!s)continue;
              const rd=Math.abs(s[0]-expected[0])+Math.abs(s[1]-expected[1])+Math.abs(s[2]-expected[2]);
              minRingDistToRole=Math.min(minRingDistToRole,rd);
              const bgLight=(s[0]+s[1]+s[2])/3,bgSpan=Math.max(s[0],s[1],s[2])-Math.min(s[0],s[1],s[2]);
              const bgWhiteLike=bgLight>176&&bgSpan<58;
              if(bgWhiteLike)minRingDistToBackground=Math.max(minRingDistToBackground,rd);
            }
            results.push({role,id,size,envMode,center:[r,g,b,a],channelDistance:chDist,whiteLike,minRingDistToRole,minRingDistToBackground});
          }
          return results;
        };
        for(const id of environmentIds){
          game.selectEnvironment(id);await renderer.environmentLoadPromise;
          // PASS A: environment visible (Aero photosphere) — the overpaint regression path.
          renderer.setEnvironmentVisible(true);
          renderer.renderGameplayFrame({presentation:"flow",nowMs:1000,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[]});
          for(const size of [18,32]){
            renderer.renderGameplayCursors(roles.map((role,i)=>cursor(role,markerPositions[i])),{grid:{x:0,y:0,width:1,height:1},sizeCssPx:size});
            renderer.manualTick();
            for(const m of runMarkerPixelCheck("aero_visible",id,size))environmentRows.push(m);
          }
          // Keep existing minEnvironmentDelta check (env contribution still measurable).
          {renderer.renderGameplayCursors(roles.map((role,i)=>cursor(role,markerPositions[i])),{grid:{x:0,y:0,width:1,height:1},sizeCssPx:18});const fullRect={x:0,y:0,alternateY:0,w:canvas.width,h:canvas.height},withMarker=readCrop(fullRect);for(const marker of renderer.markerPool)marker.enabled=false;renderer.renderGameplayFrame({presentation:"flow",nowMs:1000,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[]});const withoutMarker=readCrop(fullRect);let sum=0,count=0;for(let p=0;p<withMarker.data.length;p+=4){const delta=(Math.abs(withMarker.data[p]-withoutMarker.data[p])+Math.abs(withMarker.data[p+1]-withoutMarker.data[p+1])+Math.abs(withMarker.data[p+2]-withoutMarker.data[p+2]))/3;if(delta>2){sum+=delta;count++;}}environmentRows.push({id,size:18,minimumMeanDelta:sum/Math.max(1,count)});}
          // PASS B: camera/composite equivalent — env hidden, solid transparent background.
          renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:"solid",colors:["#00000000"],angleDeg:0});
          for(const size of [18,32]){
            renderer.renderGameplayFrame({presentation:"flow",nowMs:1000,timingWindowBeforeMs:180,timingWindowAfterMs:180,targets:[]});
            renderer.renderGameplayCursors(roles.map((role,i)=>cursor(role,markerPositions[i])),{grid:{x:0,y:0,width:1,height:1},sizeCssPx:size});
            renderer.manualTick();
            for(const m of runMarkerPixelCheck("camera_solid",id,size))environmentRows.push(m);
          }
        }
        // Structural guardrail: env opaque index < World opaque index, paired with env material depthTest === false.
        // Structural guardrail (rt4k): after attach, the dedicated "Aero Environment Photosphere"
        // opaque layer index is STRICTLY less than the World layer's opaque index, paired with the
        // photosphere material depthTest === false. Encoded explicitly so a future depthTest flip
        // or re-ordering forces a conscious update of this invariant.
        let envOpaqueIndex=null,worldOpaqueIndex=null,envDepthTest=null,envFound=false;
        try{
          const app=renderer.app??renderer._app;
          const composition=app?.scene?.layers;
          if(composition&&composition.getLayerById&&typeof composition.getOpaqueIndex==="function"){
            const pcModule=window.__DSH_PC__??null;
            // LAYERID_WORLD is 6 in current PlayCanvas; resolve it through the engine registry when available.
            // PlayCanvas constants (2.21.4 as pinned by the renderer): LAYERID_WORLD=0, LAYERID_DEPTH=1, LAYERID_SKYBOX=2.
            const WORLD_LAYER_ID=0;
            const worldLayer=composition.getLayerById(WORLD_LAYER_ID);
            let envLayer=null;
            if(composition.layerNameMap&&typeof composition.layerNameMap.get==="function")envLayer=composition.layerNameMap.get("Aero Environment Photosphere")??null;
            if(!envLayer&&Array.isArray(composition.layerList))for(const l of composition.layerList){if(l?.name==="Aero Environment Photosphere"){envLayer=l;break;}}
            envFound=Boolean(envLayer);
            if(worldLayer&&envLayer){worldOpaqueIndex=composition.getOpaqueIndex(worldLayer);envOpaqueIndex=composition.getOpaqueIndex(envLayer);}
            // Photosphere material: walk the scene for an entity carrying the env tag.
            const findEntity=(node)=>{if(node?.tags?.has&&node.tags.has("aerobeat-environment-background"))return node;for(const c of node?.children??[]){const r=findEntity(c);if(r)return r;}return null;};
            const envEntity=findEntity(app.root);
            if(envEntity?.render?.meshInstances?.[0])envDepthTest=envEntity.render.meshInstances[0].material.depthTest;
          }
        }catch(e){/* best-effort */}
        environmentRows.push({structuralGuard:true,layerInfo:{envFound,envOpaqueIndex,worldOpaqueIndex,envDepthTest}});
        renderer.setEnvironmentVisible(false);
        renderer.setEnvironmentVisible(false);blank();const lifecycleBefore=renderer.markerPool.length,oldPool=[...renderer.markerPool];const gl=canvas.getContext("webgl2"),ext=gl?.getExtension("WEBGL_lose_context");let contextRestored=true;if(ext){ext.loseContext();await new Promise((done)=>setTimeout(done,60));ext.restoreContext();const deadline=performance.now()+5000;while(performance.now()<deadline&&renderer.describe().gameplayAssets.state!=="ready")await new Promise((done)=>setTimeout(done,25));renderer.renderGameplayCursors([cursor("nose",[.5,.5])],{grid:{x:0,y:0,width:1,height:1},sizeCssPx:32});contextRestored=renderer.markerPool.length===1&&!oldPool.includes(renderer.markerPool[0]);}
        const snapshot=JSON.stringify(game.getSnapshot());return{origin:location.origin,parentOrigin:document.referrer?new URL(document.referrer).origin:null,appliedDpr:renderer.devicePixelRatio,sizeRows,flicker,environmentRows,lifecycle:{before:lifecycleBefore,contextRestored},privacy:/cursorPixels|markerPixels|framebuffer|materialCoverage/u.test(snapshot),roleColors};
      },{width:viewport.width,height:viewport.height,requestedDpr,sizes,environmentIds,roleHex});
      if(embedding!=="direct")assert.notEqual(evidence.origin,evidence.parentOrigin,"iframe must be genuinely cross-origin");assert.equal(evidence.appliedDpr,Math.min(requestedDpr,2));assert.equal(evidence.privacy,false);assert.equal(evidence.lifecycle.contextRestored,true);assert.equal(new Set(evidence.flicker.map((frame)=>JSON.stringify(frame))).size,1,"marker center pixels must not flicker while timing/grid frames advance");assert.deepEqual(noise,[]);
      rows.push({embedding,viewport:viewport.name,requestedDpr,...evidence});
    } finally {await context.close();}
  }
} finally {await browser.close();await vite.close();await new Promise((resolve)=>parent.close(resolve));}

for(const row of rows)for(const entry of row.sizeRows)for(const sample of entry.samples)assert(sample.bbox,`marker crop missed ${JSON.stringify({embedding:row.embedding,viewport:row.viewport,requestedDpr:row.requestedDpr,size:entry.size,role:sample.role,position:sample.position})}`);
const summaries=sizes.map((size)=>{const sizeRows=rows.map((row)=>row.sizeRows.find((entry)=>entry.size===size));const samples=sizeRows.flatMap((entry)=>entry.samples),environment=rows.flatMap((row)=>row.environmentRows.filter((entry)=>entry.size===size&&typeof entry.minimumMeanDelta==="number"));const cssOpaque=rows.flatMap((row)=>row.sizeRows.find((entry)=>entry.size===size).samples.map((sample)=>sample.opaque/(row.appliedDpr**2)));return{size,minOpaqueRatio:Math.min(...samples.map((sample)=>sample.opaque/sample.covered)),minDark:Math.min(...samples.map((sample)=>sample.dark)),minWhite:Math.min(...samples.map((sample)=>sample.white)),minTint:Math.min(...samples.map((sample)=>sample.tint)),minPerimeterContrast:Math.min(...samples.map((sample)=>sample.perimeterContrast)),maxBboxError:Math.max(...rows.flatMap((row)=>row.sizeRows.find((entry)=>entry.size===size).samples.map((sample)=>Math.max(Math.abs(sample.bbox.width/row.appliedDpr-size),Math.abs(sample.bbox.height/row.appliedDpr-size))))),minMaterialPixels:Math.min(...sizeRows.flatMap((entry)=>Object.values(entry.materialCoverage).flat())),minEnvironmentDelta:Math.min(...environment.map((entry)=>entry.minimumMeanDelta)),minOpaqueCssPixels:Math.min(...cssOpaque)};});
for(const row of rows)for(const entry of row.sizeRows)for(const material of entry.materialState){assert.ok(["mat/charcoal","mat/white","mat/tint_base"].includes(material.name),`material name must be one of the exact authored roles: ${material.name}`);assert.equal(material.opacity,1,"per-mesh-instance opacity must be exactly 1");assert.equal(material.blendType,3,"BLEND_NONE (3) per mesh instance");assert.equal(material.depthTest,true,"depth test on per mesh instance");assert.equal(material.depthWrite,true,"depth write on per mesh instance");assert.equal(material.cull,1,"CULLFACE_BACK (1) per mesh instance");}
// uo1y §7 pixel thresholds at BOTH default (18 CSS px) and enlarged (32 CSS px):
for(const size of [18,32]){const sizeRows=rows.map((row)=>row.sizeRows.find((entry)=>entry.size===size));const samples=sizeRows.flatMap((entry)=>entry.uo1ySamples);
  // marker-center pixel is role-color-dominant for nose/left wrist/right wrist — NOT white, NOT background.
  for(const sample of samples){const c=sample.centerPixel,[r,g,b,a]=c;assert.ok(a>=250,`center pixel must be opaque at ${size}px (${a})`);const expected=sample.roleExpected;const channelDistance=Math.abs(r-expected[0])+Math.abs(g-expected[1])+Math.abs(b-expected[2]);const light=(r+g+b)/3,span=Math.max(r,g,b)-Math.min(r,g,b);const isWhiteLike=light>176&&span<58;assert.ok(!isWhiteLike,`center pixel must NOT be structural white at ${size}px (${JSON.stringify(c)})`);// The marker uses an unlit emissive tint at exact role color; lighting-independent structural response may shift channels slightly. Dominance means the hue matches and no channel is dominated by white/background.
const maxExpectedChannel=Math.max(...expected);const minExpectedChannel=Math.min(...expected);const spanExpected=maxExpectedChannel-minExpectedChannel;const actualSpan=Math.max(r,g,b)-Math.min(r,g,b);assert.ok(actualSpan>=spanExpected*0.5||maxExpectedChannel<80,`center pixel hue span must track the role color for ${sample.role} at ${size}px`);assert.ok(channelDistance<=144,`center pixel must be role-color-dominant for ${sample.role} at ${size}px: rgb(${r},${g},${b}) vs expected ${JSON.stringify(expected)} (distance ${channelDistance})`);}
  // tint patch ≥80% of projected front area.
  const minTintFraction=Math.min(...samples.map((s)=>s.tintFraction));assert.ok(minTintFraction>=0.8,`tint face must own ≥80% of projected front area at ${size}px (min ${minTintFraction.toFixed(3)})`);
}
// uo1y §7 retargeted pass criteria for the tint-dominant 0.0.11 marker: the marker must be opaque, role-color-dominant at center (asserted above), own ≥80% tint face (asserted above), retain perimeter contrast, bounded bbox error, and environment visibility. The old structural white/dark material-pixel minimums are retired because the 0.0.11 tint-dominant sphere keeps only a thin white/charcoal polar keyline.
const passes=(summary)=>summary.minOpaqueRatio>=.72&&summary.minPerimeterContrast>=24&&summary.maxBboxError<=2.1&&summary.minEnvironmentDelta>=8&&summary.minOpaqueCssPixels>=150;
const selected=summaries.find(passes);assert(selected,`No physically plausible marker size passed: ${JSON.stringify(summaries)}`);assert.equal(selected.size,18,`default 18 CSS px must now be the smallest objective pixel-oracle PASS with the tint-dominant marker: ${JSON.stringify(summaries)}`);
// rt4k both-environment role-color dominance: per environment asset AND camera/composite equivalent,
// center-pixel role color at 18px and 32px in BOTH paths. The regression signature is ring==center==local
// background (the overpaint), so also assert minRingDistToRole < minRingDistToBackground * 0.6 when both finite.
const markerPixelChecks=rows.flatMap((row)=>row.environmentRows.filter((entry)=>entry.center!==undefined));
assert.ok(markerPixelChecks.length>0,"both-environment marker pixel checks must have executed");
for(const size of [18,32]){
  for(const entry of markerPixelChecks.filter((e)=>e.size===size)){
    const [r,g,b,a]=entry.center;
    assert.ok(a>=250,`${entry.envMode} ${entry.id} ${entry.role} ${size}px: center alpha must be >=250 (${a})`);
    assert.ok(entry.channelDistance<=144,`${entry.envMode} ${entry.id} ${entry.role} ${size}px: center channel distance to role color must be <=144 (${entry.channelDistance})`);
    assert.equal(entry.whiteLike,false,`${entry.envMode} ${entry.id} ${entry.role} ${size}px: center must NOT be white-like`);
    // Discriminant: ring closer to role than to background (when background samples exist)
    if(Number.isFinite(entry.minRingDistToRole)&&Number.isFinite(entry.minRingDistToBackground)&&entry.minRingDistToBackground>0){
      assert.ok(entry.minRingDistToRole<entry.minRingDistToBackground*0.6||entry.minRingDistToRole<=96,
        `${entry.envMode} ${entry.id} ${entry.role} ${size}px: ring must favor role color (distToRole=${entry.minRingDistToRole}, distToBg=${entry.minRingDistToBackground})`);
    }
  }
}
// Structural guardrail: after attach, the environment layer's opaque index is STRICTLY less than the World
// layer's opaque index, paired with the env material's depthTest === false.
// Structural guardrail: after attach, the environment layer's opaque index is STRICTLY less than the World
// layer's opaque index, paired with the env material's depthTest === false.
// This is verified in-browser (the renderer has access to its own layer lists) and reported back.
const structuralResults=rows.flatMap((row)=>row.environmentRows.filter((entry)=>entry.structuralGuard));
for(const sr of structuralResults){
  assert.ok(sr.layerInfo?.envFound===true,"dedicated Aero Environment Photosphere layer must exist after attach (rt4k)");
  assert.ok(typeof sr.layerInfo.envOpaqueIndex==="number"&&typeof sr.layerInfo.worldOpaqueIndex==="number",`layer opaque indices must be resolvable: ${JSON.stringify(sr.layerInfo)}`);
  assert.ok(sr.layerInfo.envOpaqueIndex<sr.layerInfo.worldOpaqueIndex,
    `env opaque index (${sr.layerInfo.envOpaqueIndex}) must be STRICTLY less than World opaque index (${sr.layerInfo.worldOpaqueIndex}) (rt4k ordering invariant)`);
  assert.equal(sr.layerInfo.envDepthTest,false,"env photosphere material depthTest must remain false under corrected ordering (rt4k)");
}
console.log(`Live marker visibility oracle PASS selected=${selected.size} CSS px metrics=${JSON.stringify(summaries)} markerPixelChecks=${markerPixelChecks.length}`);
