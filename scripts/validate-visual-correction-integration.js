// @ts-check

import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType:"spa", configFile:"vite.config.js", logLevel:"error", server:{ host:"127.0.0.1", port:0, hmr:false, watch:null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parent = createHttpServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://parent.invalid");
  const width = Number(url.searchParams.get("width")) || 390; const height = Number(url.searchParams.get("height")) || 844;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><style>html,body{margin:0}iframe{border:0;display:block;width:${width}px;height:${height}px}</style><iframe allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parent.listen(0, "127.0.0.1", resolve));
const address = parent.address();
if (!address || typeof address === "string") throw new Error("Parent URL unavailable");
const parentUrl = `http://localhost:${address.port}/`;
const browser = await chromium.launch({ headless:true });
const matrix = [];
try {
  for (const embedding of ["direct", "real_cross_origin_iframe"]) for (const viewport of [{name:"portrait",width:390,height:844},{name:"landscape",width:844,height:390}]) for (const requestedDpr of [1,3]) {
    const context = await browser.newContext({ viewport:embedding === "direct" ? {width:viewport.width,height:viewport.height} : {width:viewport.width+24,height:viewport.height+24}, deviceScaleFactor:requestedDpr });
    const page = await context.newPage(); const noise = [];
    page.on("console", (message) => { if (["warning","error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
    page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
    try {
      await page.goto(embedding === "direct" ? childUrl : `${parentUrl}?width=${viewport.width}&height=${viewport.height}`, { waitUntil:"networkidle" });
      const target = embedding === "direct" ? page : page.frames().find((frame) => frame !== page.mainFrame());
      if (!target) throw new Error("Real cross-origin child missing");
      await target.waitForSelector("aero-game");
      await target.waitForFunction(() => { const state=document.querySelector("aero-game")?.graph?.renderer?.describe?.(); return state?.gameplayAssets?.state === "ready" && state?.environment?.state === "ready"; }, {timeout:15_000});
      const evidence = await target.evaluate(({width,height,requestedDpr}) => {
        const game = document.querySelector("aero-game"), originalGraph = game.graph, renderer = originalGraph.renderer;
        game.stopFrameLoop(); game.setMenuOpen(false); renderer.resize({widthCssPx:width,heightCssPx:height,devicePixelRatio:requestedDpr}); renderer.setEnvironmentVisible(false); renderer.setBackgroundProjection({kind:"solid",colors:["#071426"],angleDeg:180});
        const variant={variantId:"visual-contract-flow",chartId:"visual-contract-chart",mode:"flow",rulesetId:"flow_grid_v2",recipeId:null,modifierIds:[],ranked:false};
        const events=[
          {eventId:"pending-right",centerTimestampMs:1211,authoredBeat:{type:"note",hand:"right",placement:6,direction:"right"}},
          {eventId:"hit-visible",centerTimestampMs:1102,authoredBeat:{type:"note",hand:"right",placement:7,direction:"right"}},
          {eventId:"hit-gone",centerTimestampMs:1101,authoredBeat:{type:"note",hand:"right",placement:7,direction:"right"}},
          {eventId:"miss-continuing",centerTimestampMs:1000,authoredBeat:{type:"note",hand:"left",placement:4,direction:"left"}}
        ];
        const gameplay={session:{purpose:"play",state:"playing",timelinePositionMs:1181},selectedVariant:variant,judgements:[
          {eventId:"hit-visible",result:"hit",shadow:false,committedTimelinePositionMs:1102},
          {eventId:"hit-gone",result:"hit",shadow:false,committedTimelinePositionMs:1101},
          {eventId:"miss-continuing",result:"miss",shadow:false,committedTimelinePositionMs:1000}
        ],shadowJudgements:[],scorePartitions:[],obstacleOutcomes:[]};
        const input={tracking:{gameplayPaused:false,freshCalibrationRequired:false,allRequiredAnchorsVisible:true},retainedGeometryDimmed:false,countdownFrozen:false,anchors:[
          {anchor:"nose",valid:true,x:.5,y:.25,confidence:1},{anchor:"left_wrist",valid:true,x:.25,y:.65,confidence:1},{anchor:"right_wrist",valid:true,x:.75,y:.65,confidence:1}
        ]};
        const graph={...originalGraph,content:{...originalGraph.content,getSnapshot:()=>({selectedVariant:variant,resolvedEvents:events})},gameplay:{...originalGraph.gameplay,getSnapshot:()=>gameplay},input:{...originalGraph.input,getSnapshot:()=>input}};
        const cursorCalls=[], originalCombined=renderer.renderGameplayFrameWithCursors.bind(renderer);
        renderer.renderGameplayFrameWithCursors=(renderFrame,cursors,options)=>{cursorCalls.push({cursors:structuredClone(cursors),options:structuredClone(options)});return originalCombined(renderFrame,cursors,options);};
        game.graph=graph; const frame=game.rendererFrame(); const result=game.renderGameplay(graph); const cursorStatus=renderer.describe().cursors; game.graph=originalGraph; renderer.renderGameplayFrameWithCursors=originalCombined;
        const objects=result.model.objects, timing=objects.filter((entry)=>entry.kind==="timing"), timingBounds={};
        for(const segment of result.model.timingZone.segments){const tiles=timing.filter((entry)=>entry.id.startsWith(`timing-${segment.name}-`));timingBounds[segment.name]={count:tiles.length,lanes:[...new Set(tiles.map((entry)=>entry.position.x))],start:Math.min(...tiles.map((entry)=>entry.position.z-entry.scale.z/2)),end:Math.max(...tiles.map((entry)=>entry.position.z+entry.scale.z/2)),expectedStart:segment.startZ,expectedEnd:segment.endZ};}
        const byTarget=(id,kind)=>objects.filter((entry)=>entry.targetId===id&&entry.kind===kind),feedback=(id)=>byTarget(id,"feedback")[0]?.feedback??null;
        const wallEvent={eventId:"3c9d-hard-tall-wall",centerTimestampMs:37039.99938964844,intervalStartTimestampMs:37039.99938964844,intervalEndTimestampMs:37064.99938964844,authoredBeat:{type:"obstacle",start:92.5999984741211,end:92.6624984741211,sourceGeometry:{schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v2_legacy_obstacle",kind:"v2_type_1",x:1,y:2,width:1,height:3},gameplayGeometry:{schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:1,y:0,width:1,height:3},gridMask:[1,5,9]}};
        const wallGameplay={...gameplay,session:{...gameplay.session,timelinePositionMs:37040},judgements:[]};
        game.graph={...graph,content:{...graph.content,getSnapshot:()=>({selectedVariant:variant,resolvedEvents:[wallEvent]})},gameplay:{...graph.gameplay,getSnapshot:()=>wallGameplay}};
        const wallFrame=game.rendererFrame(),wallResult=renderer.renderGameplayFrame(wallFrame),wall=wallResult.model.objects.find((entry)=>entry.id==="3c9d-hard-tall-wall:wall"),wallShadow=wallResult.model.objects.find((entry)=>entry.id==="3c9d-hard-tall-wall:shadow");game.graph=originalGraph;
        return {origins:{child:location.origin,parent:document.referrer?new URL(document.referrer).origin:null},frame:{before:frame.timingWindowBeforeMs,after:frame.timingWindowAfterMs},timingBounds,renderOrder:result.model.renderOrder,cursorCall:cursorCalls.at(-1),cursorStatus,pendingRight:byTarget("pending-right","icon")[0],hitVisible:byTarget("hit-visible","icon")[0],hitGone:byTarget("hit-gone","icon").length,greatVisible:feedback("hit-visible"),greatGone:feedback("hit-gone"),missIcon:byTarget("miss-continuing","icon")[0],missFeedback:feedback("miss-continuing"),missShadows:byTarget("miss-continuing","shadow").length,wallFrame:{before:wallFrame.timingWindowBeforeMs,after:wallFrame.timingWindowAfterMs,target:wallFrame.targets[0]},wall,wallShadow,appliedDpr:renderer.devicePixelRatio};
      }, {width:viewport.width,height:viewport.height,requestedDpr});
      if (embedding !== "direct") assert.notEqual(evidence.origins.child,evidence.origins.parent,"iframe must be genuinely cross-origin");
      assert.deepEqual(evidence.frame,{before:180,after:180}); assert.deepEqual(evidence.wallFrame.before,180); assert.deepEqual(evidence.wallFrame.after,180);
      for(const [name,bounds] of Object.entries(evidence.timingBounds)){assert.equal(bounds.lanes.length,4,`${name} timing tiles must cover four canonical Flow lanes`);assert(bounds.count>=4&&bounds.count%4===0,`${name} timing tile count must be data-derived per lane`);assert(Math.abs(bounds.start-bounds.expectedStart)<1e-9&&Math.abs(bounds.end-bounds.expectedEnd)<1e-9,`${name} timing tile bounds must equal authoritative segment bounds`);}
      assert.deepEqual(evidence.renderOrder,["world_opaque","grid_timing_tiles","targets","world_transparent_shadows_track_walls_feedback"]);
      assert.equal(evidence.cursorCall.options.sizeCssPx,32); assert.equal(evidence.cursorCall.options.minConfidence,.5); assert.equal(evidence.cursorCall.cursors.length,3); assert.equal(evidence.cursorStatus.sizeCssPx,32); assert.equal(evidence.cursorStatus.instanceCount,3);
      assert.equal(evidence.pendingRight.assetId,"directional-arrow/outline-v1"); assert.equal(evidence.pendingRight.rotationZRad,-Math.PI/2); assert.equal(evidence.pendingRight.whiteCore,true,"right directional note must retain the white timing flash");
      assert(evidence.hitVisible&&evidence.hitVisible.removal.elapsedMs===79,"hit remains visible through exact 79 ms"); assert.equal(evidence.hitGone,0,"hit disappears at exact 80 ms");
      assert.equal(evidence.greatVisible.apparentHeightCssPx,48); assert.equal(evidence.greatVisible.animation,"bounce"); assert(evidence.greatVisible.offsetY>0&&evidence.greatVisible.scale>1,"Great must use deterministic 0.20 bounce motion"); assert.equal(evidence.greatGone.apparentHeightCssPx,48,"Great feedback survives exact hit removal");
      assert.equal(evidence.missIcon.appearanceColor,"#7c828c"); assert(evidence.missIcon.position.z>0,"miss must continue past the athlete along authoritative timeline motion"); assert.equal(evidence.missFeedback.apparentHeightCssPx,42); assert.equal(evidence.missFeedback.animation,"shake"); assert.notEqual(evidence.missFeedback.offsetX,0,"Miss must use deterministic nine-cycle shake motion"); assert.equal(evidence.missShadows,1,"continuing miss keeps one gameplay-inert shadow");
      assert.deepEqual(evidence.wallFrame.target.gameplayGeometry,{schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:1,y:0,width:1,height:3}); assert.deepEqual(evidence.wallFrame.target.cells,[1,5,9]); assert.equal(evidence.wall.scale.x,1); assert(Math.abs(evidence.wall.scale.y-2.94/.94)<1e-12); assert(Math.abs(evidence.wall.scale.z-.15)<1e-9); assert.deepEqual({x:evidence.wall.position.x,y:evidence.wall.position.y},{x:-.5,y:1}); assert(Math.abs(evidence.wall.position.z+.075)<1e-5); assert(evidence.wallShadow&&evidence.wallShadow.position.y<evidence.wall.position.y&&evidence.wallShadow.targetId===evidence.wall.targetId,"tall wall must retain one directly-below gameplay-inert shadow");
      assert.equal(evidence.appliedDpr,Math.min(requestedDpr,2)); assert.deepEqual(noise,[]);
      matrix.push({embedding,viewport:viewport.name,requestedDpr,appliedDpr:evidence.appliedDpr,timing:Object.fromEntries(Object.entries(evidence.timingBounds).map(([name,value])=>[name,value.count])),markerSizeCssPx:evidence.cursorStatus.sizeCssPx,missZ:evidence.missIcon.position.z,wallScale:evidence.wall.scale});
    } finally { await context.close(); }
  }
  console.log(`Assembly visual-correction direct/iframe matrix passed: ${JSON.stringify(matrix)}`);
} finally { await browser.close(); await vite.close(); await new Promise((resolve)=>parent.close(resolve)); }
