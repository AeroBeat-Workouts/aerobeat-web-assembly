// @ts-check

// t7sv W2b rebaseline — the committed 3C9D Standard Hard legacy v2.0.0 beatmap
// contains only `_type:1` END-marker entries, so after W1-A's t7sv fix the
// fixture converts with ZERO obstacles (pre-fix it produced six full-height
// column walls). The raw fixture bytes remain pinned so any drift in the
// vendored chart is caught immediately.
//
// Coverage preservation: this oracle's purpose was "the exact 3c9d Flow
// obstacle renders one red wall + one shadow at the exact golden AABB across
// direct and genuine cross-origin iframe embeddings." That rendering proof is
// now anchored on a synthetic two-cell full-height wall built the way this
// repo's other oracles build fixtures, so the pixel-level wall/shadow/AABB
// coverage survives while the 3c9d package itself asserts its new
// zero-obstacle outcome.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const fixture=await readFile(new URL("../../aerobeat-web-content-authoring/fixtures/flow-obstacle-3c9d-hard-v1.dat",import.meta.url));
const golden=JSON.parse(await readFile(new URL("../../aerobeat-web-content-authoring/fixtures/obstacle-normalization-3c9d-hard-golden-v2.json",import.meta.url),"utf8"));
assert.equal(fixture.byteLength,89424);
assert.equal(createHash("sha256").update(fixture).digest("hex"),golden.source.sha256);
const vite=await createViteServer({appType:"spa",configFile:"vite.config.js",logLevel:"error",server:{host:"127.0.0.1",port:0,hmr:false,watch:null}});
await vite.listen();const childUrl=vite.resolvedUrls?.local?.[0];if(!childUrl)throw new Error("Vite URL unavailable");
const parent=createHttpServer((_request,response)=>{response.setHeader("content-type","text/html; charset=utf-8");response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);});
await new Promise(resolve=>parent.listen(0,"127.0.0.1",resolve));const address=parent.address();if(!address||typeof address==="string")throw new Error("Parent URL unavailable");const parentUrl=`http://localhost:${address.port}/`;
const browser=await chromium.launch({headless:true});const matrix=[];
try{
  for(const embedding of ["direct","genuine_cross_origin_iframe"]){
    const context=await browser.newContext({viewport:embedding==="direct"?{width:844,height:390}:{width:868,height:414},deviceScaleFactor:1});const page=await context.newPage(),noise=[];
    page.on("console",message=>{const type=message.type(),text=message.text(),location=message.location();if(["warning","error"].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,childUrl)&&!isExpectedPlaycanvasMeshWarning(type,text))noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`);});page.on("pageerror",error=>noise.push(`pageerror:${error.message}`));
    try{
      await page.goto(embedding==="direct"?childUrl:parentUrl,{waitUntil:"networkidle"});const target=embedding==="direct"?page:page.frames().find(frame=>frame!==page.mainFrame());if(!target)throw new Error("Cross-origin child missing");
      await target.waitForSelector("aero-game");await target.waitForFunction(()=>document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state==="ready",{timeout:15000});
      const proof=await target.evaluate(async({fixtureBytes,golden})=>{
        const game=document.querySelector("aero-game"),renderer=game.graph.renderer;game.stopFrameLoop();game.setMenuOpen(false);renderer.resize({widthCssPx:844,heightCssPx:390,devicePixelRatio:1});renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:"solid",colors:["#071426"],angleDeg:180});
        const [{parseBeatMapDifficulty,convertDifficulty},{createAeroGameplaySessionCoordinator}]=await Promise.all([import("/node_modules/@aerobeat/web-content-authoring/src/index.js"),import("/node_modules/@aerobeat/web-gameplay/src/index.js")]);
        const bytes=Uint8Array.from(fixtureBytes),summary=parseBeatMapDifficulty(bytes,"v2"),audioBytes=new TextEncoder().encode("offline-3c9d-audio"),audioHash=await crypto.subtle.digest("SHA-256",audioBytes),hex=[...new Uint8Array(audioHash)].map(value=>value.toString(16).padStart(2,"0")).join("");
        // t7sv: all-END-marker legacy v2 map must normalize to zero obstacles.
        if(summary.obstacles.length!==0)throw new Error(`t7sv: expected zero parsed obstacles, got ${summary.obstacles.length}`);
        const converted=await convertDifficulty(summary,{difficulty:"Hard",songToken:"3c9d",songName:"Dance Dance Revolution - DDRMix",bpm:150,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:1,sourceProvider:"beatsaver",sourceId:"3C9D",sourceVersionHash:golden.source.versionHash,sourceInfoFormat:"v2",sourceInfoVersion:"2.0.0",sourceInfoHash:`sha256:${"0".repeat(64)}`,sourceDifficultyPath:golden.source.path,sourceBeatmapFormat:"v2",sourceBeatmapVersion:golden.source.format,notePalette:null,spawnTiming:{schema:"aerobeat/beatsaber_spawn_timing",version:1,algorithm:"beatsaber_core_hjd_v1",bpm:150,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:1,maxHalfJumpDistance:17.999,startHalfJumpDurationBeats:4,minimumHalfJumpDurationBeats:.25,halfJumpDurationBeats:5,reactionTimeMs:2000,jumpDistanceMeters:40},sourceDifficultyHash:`sha256:${golden.source.sha256}`,audioPath:"song.ogg",audioContentHash:`sha256:${hex}`});
        const canvas=game.shadowRoot.querySelector("canvas"),readPixels=()=>{const sample=new OffscreenCanvas(canvas.width,canvas.height),ctx=sample.getContext("2d",{willReadFrequently:true});ctx.drawImage(canvas,0,0);return ctx.getImageData(0,0,sample.width,sample.height).data;};
        renderer.renderGameplayFrame({presentation:"flow",nowMs:40_000,targets:[]});const baseline=readPixels();
        // Synthetic re-anchored wall: a two-cell full-height wall built the way
        // this repo's other oracles build fixtures, so the red-wall pixel proof
        // survives even though the real 3c9d fixture now has zero obstacles.
        const sourceGeometry={schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v2_legacy_obstacle",kind:"v2_type_0",x:0,y:0,width:2,height:3};
        const gameplayGeometry={schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:0,y:0,width:2,height:3};
        const S=40_000,E=41_000,now=40_500;
        const syntheticObstacle={schema:"aerobeat/resolved_content_event",version:3,eventId:"synth-3c9d-wall",centerTimestampMs:S,intervalStartTimestampMs:S,intervalEndTimestampMs:E,authoredBeat:{type:"obstacle",start:66.667,end:68.334,sourceGeometry,gameplayGeometry,gridMask:[0,1,4,5,8,9]}};
        const synthVariant={variantId:"synth-flow",chartId:"synth-chart",mode:"flow",rulesetId:"flow_colliders_v1",recipeId:null,modifierIds:[],ranked:true,localOnly:false,mapHash:{schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:"1".repeat(64)},scoreIdentityHash:{schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:"2".repeat(64)}};
        const gameplay=createAeroGameplaySessionCoordinator({sessionId:`browser-${synthVariant.variantId}`});
        gameplay.configureContent({packageId:"synth-pkg",selectedVariant:synthVariant,resolvedEvents:[syntheticObstacle]});
        const {projectSessionTargets}=await import("/src/session-render-projection.js");
        const targets=projectSessionTargets([syntheticObstacle],gameplay.getSnapshot(),now);
        const frame={presentation:"flow",nowMs:now,targets,timingWindowBeforeMs:180,timingWindowAfterMs:180};
        const result=renderer.renderGameplayFrame(frame),pixels=readPixels();
        let differingPixels=0,redWallPixels=0;
        for(let i=0;i<pixels.length;i+=4){if(pixels[i]!==baseline[i]||pixels[i+1]!==baseline[i+1]||pixels[i+2]!==baseline[i+2]||pixels[i+3]!==baseline[i+3])differingPixels+=1;if(pixels[i]>pixels[i+1]*1.2&&pixels[i]>pixels[i+2]*1.1&&pixels[i+3]>0)redWallPixels+=1;}
        const pixelDigest=await crypto.subtle.digest("SHA-256",pixels),pixelHash=[...new Uint8Array(pixelDigest)].map(value=>value.toString(16).padStart(2,"0")).join("");
        const walls=result.model.objects.filter(entry=>entry.targetId===syntheticObstacle.eventId&&entry.kind==="obstacle");
        const shadows=result.model.objects.filter(entry=>entry.targetId===syntheticObstacle.eventId&&entry.kind==="shadow");
        const entities=(renderer.assetPools.get("wall/red-glass-v1")??[]).filter(entity=>entity.enabled).slice(0,walls.length);
        const bounds=entities.map(entity=>{const boxes=entity.findComponents("render").flatMap(component=>(component.meshInstances??[]).map(instance=>instance.aabb??null)).filter(Boolean);const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};for(const box of boxes){if(!box||!box.c||!box.h)continue;min.x=Math.min(min.x,box.c[0]-box.h[0]);min.y=Math.min(min.y,box.c[1]-box.h[1]);min.z=Math.min(min.z,box.c[2]-box.h[2]);max.x=Math.max(max.x,box.c[0]+box.h[0]);max.y=Math.max(max.y,box.c[1]+box.h[1]);max.z=Math.max(max.z,box.c[2]+box.h[2]);}if(boxes.length===0)return null;return{min,max,size:{x:max.x-min.x,y:max.y-min.y,z:max.z-min.z}};}).filter(Boolean).sort((left,right)=>left.min.x-right.min.x)[0]??null;
        const flowVariant=converted.package.charts.find(chart=>chart.mode==="flow");
        const boxingCharts=converted.package.charts.filter(chart=>chart.mode==="boxing");
        return{origins:{child:location.origin,parent:document.referrer?new URL(document.referrer).origin:null},fixtureByteLength:bytes.byteLength,zeroObstacles:flowVariant.beats.filter(beat=>beat.type==="obstacle").length,boxingCount:boxingCharts.length,boxingWeaveFree:boxingCharts.every(chart=>!chart.beats.some(beat=>String(beat.type??"").startsWith("weave_")||String(beat.type??"")==="squat")),variants:[{variantId:synthVariant.variantId,chartId:synthVariant.chartId,presentation:"flow",differingPixels,redWallPixels,pixelHash,walls:walls.map(wall=>({assetId:wall.assetId,interval:[wall.intervalStartMs,wall.intervalEndMs],position:{x:wall.position.x,y:wall.position.y,z:wall.position.z},scale:{x:wall.scale.x,y:wall.scale.y,z:wall.scale.z}})),shadows:shadows.length,bounds,activeWallAssets:entities.length}],snapshotPrivate:!/sourceGeometry|gameplayGeometry|gridMask|blockedCells|noseSafeCells/u.test(JSON.stringify(game.getSnapshot()))};
      },{fixtureBytes:[...fixture],golden});
      if(embedding!=="direct")assert.notEqual(proof.origins.child,proof.origins.parent,"browser oracle iframe must be genuinely cross-origin");
      assert.equal(proof.fixtureByteLength,89424);
      assert.equal(proof.zeroObstacles,0,"t7sv: 3c9d Flow chart must contain zero obstacles because every source obstacle was an END marker");
      assert.equal(proof.boxingCount,1,"W1-A: a fresh import now authors exactly one boxing (collider) chart — the Lanes/Grid pair is retired");
      assert.equal(proof.boxingWeaveFree,true,"t7sv: no Boxing weave/squat beats may survive the re-baseline");
      assert.equal(proof.snapshotPrivate,true);
      assert.deepEqual(noise,[]);
      for(const row of proof.variants){
        assert(row.differingPixels>100,`${embedding}/${row.variantId} synthetic wall must produce non-background renderer pixels`);
        assert(row.redWallPixels>100,`${embedding}/${row.variantId} synthetic wall must produce directly read red wall pixels`);
        assert.match(row.pixelHash,/^[0-9a-f]{64}$/u);
        assert.equal(row.walls.length,1);
        assert.equal(row.shadows,1);
        assert.equal(row.activeWallAssets,1);
        assert.equal(row.walls[0].assetId,"wall/red-glass-v1");
        assert.deepEqual(row.walls[0].interval,[40_000,41_000]);
        // Two-cell full-height wall: scene model places center at x=-1, y=1
        // (columns 0-1, rows 0-2) with scale ((2-.06)/.94, (3-.06)/.94, depth).
        assert(Math.abs(row.walls[0].position.x-(-1))<1e-12,`${embedding} synthetic wall position.x mismatch`);
        assert(Math.abs(row.walls[0].position.y-1)<1e-12,`${embedding} synthetic wall position.y mismatch`);
        assert(Math.abs(row.walls[0].scale.x-((2-.06)/.94))<1e-9,`${embedding} synthetic wall scale.x mismatch`);
        assert(Math.abs(row.walls[0].scale.y-((3-.06)/.94))<1e-9,`${embedding} synthetic wall scale.y mismatch`);
        assert(row.walls[0].scale.z>0&&Number.isFinite(row.walls[0].scale.z),`${embedding} synthetic wall depth must be positive and finite`);
      }
      matrix.push({embedding,fixtureBytes:proof.fixtureByteLength,fixtureSha256:golden.source.sha256,variants:proof.variants,zeroObstacles:proof.zeroObstacles});
    }finally{await context.close();}
  }
  assert.equal(matrix.length,2);
  for(const directRow of matrix[0].variants){const iframeRow=matrix[1].variants.find(row=>row.chartId===directRow.chartId);assert.equal(iframeRow?.pixelHash,directRow.pixelHash,`${directRow.chartId} direct and genuine-iframe framebuffer hashes must match exactly`);}
  console.log(`ORACLE exact-3c9d-browser-pixels PASS: fixtureBytes=${fixture.byteLength}, fixtureSha256=${golden.source.sha256}, embeddings=2, zeroObstacleProofs=${matrix.reduce((sum,item)=>sum+(item.zeroObstacles===0?1:0),0)}, evidence=${JSON.stringify(matrix.map(item=>({embedding:item.embedding,variants:item.variants.map(row=>({chartId:row.chartId,presentation:row.presentation,pixels:row.differingPixels,assets:row.activeWallAssets,AABB:row.bounds}))})))}`);
}finally{await browser.close();await vite.close();await new Promise(resolve=>parent.close(resolve));}
