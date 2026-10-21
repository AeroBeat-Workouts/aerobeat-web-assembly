// @ts-check
// Connected source <aero-game> direct and genuinely cross-origin iframe wall
// clearance. Real gameplay/content/renderer graph, isolated chart/audio fixture.
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';

// Use the normal source configuration and its linked-dependency provenance gate.
const vite = await createViteServer({ appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null} });
let parent=null,browser=null;
try {
  await vite.listen();
  const childUrl=vite.resolvedUrls?.local?.[0];assert(childUrl,'source Vite URL unavailable');
  parent=createHttpServer((_request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="camera; autoplay; fullscreen; xr-spatial-tracking" src="${childUrl}"></iframe>`);});
  await new Promise(resolve=>parent.listen(0,'127.0.0.1',resolve));
  const address=parent.address();assert(address&&typeof address!=='string');const parentUrl=`http://localhost:${address.port}/`;
  browser=await chromium.launch({headless:true});
  for(const embedding of ['direct','cross_origin_iframe'])for(const mode of ['flow','boxing']){
    const context=await browser.newContext({viewport:embedding==='direct'?{width:844,height:390}:{width:868,height:414},deviceScaleFactor:1});
    const page=await context.newPage(),noise=[];
    page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));
    page.on('console',message=>{const location=message.location();if(['warning','error'].includes(message.type())&&!isExpectedReadPixelsWarning(message.type(),message.text(),location.url,location.lineNumber,location.columnNumber,childUrl)&&!isExpectedPlaycanvasMeshWarning(message.type(),message.text()))noise.push(`${message.type()}:${message.text()}`);});
    try{
      await page.goto(embedding==='direct'?childUrl:parentUrl,{waitUntil:'networkidle'});
      const child=embedding==='direct'?page:page.frames().find(frame=>frame!==page.mainFrame());assert(child,'connected child frame unavailable');
      if(embedding!=='direct')assert.notEqual(new URL(child.url()).origin,new URL(page.url()).origin,'iframe must have different origin');
      await child.waitForSelector('aero-game');
      const rows=await child.evaluate(async mode=>{
        const game=document.querySelector('aero-game');if(!game?.graph)throw Error('connected game graph missing');
        const {installScoredPlayHarness}=await import('/scripts/fixtures/scored-play-browser-harness.js');
        const S=10000,E=12000,id=`long-${mode}-wall`,geometry={x:0,y:0,width:2,height:3},gridMask=Array.from({length:6},(_,i)=>Math.floor(i/2)*4+geometry.x+i%2);
        const authoredBeat={start:20,end:24,type:mode==='flow'?'obstacle':'weave_right',sourceGeometry:{schema:'aerobeat/obstacle_source_geometry',version:1,coordinateSpace:'beatsaber_v3_obstacle_rect',kind:'v3_rect',...geometry},gameplayGeometry:{schema:'aerobeat/obstacle_gameplay_geometry',version:1,coordinateSpace:'aerobeat_top_left_grid',...geometry},gridMask,...(mode==='boxing'?{blockedCells:[...gridMask],checkpoint:{kind:'instantaneous',freshnessMs:150,timingWindowMs:180,noseSafeCells:Array.from({length:12},(_,cell)=>cell).filter(cell=>!gridMask.includes(cell))}}:{})};
        const event={schema:'aerobeat/resolved_content_event',version:3,eventId:id,centerTimestampMs:S,intervalStartTimestampMs:S,intervalEndTimestampMs:E,sourceEventIds:[`source-${id}`],authoredBeat};
        const harness=await installScoredPlayHarness(game,{events:[event],mode,songDurationMs:16000,beatToTimelineMs:beat=>beat*500});
        try{
          await harness.waitForAssets();await harness.selectChart();
          await harness.setSetup({spawnDistanceOverrideEnabled:true,spawnDistanceOverrideWorldUnits:20});
          game.stopFrameLoop();game.setMenuOpen(false,{freshSession:true});
          game.activeSessionSetup=game.desiredGameSetup;
          const renderer=game.graph.renderer,canvas=game.shadowRoot.querySelector('canvas[data-role="renderer"]');
          if(!(canvas instanceof HTMLCanvasElement)||renderer.describe().gameplayAssets.state!=='ready')throw Error('native GLB renderer unavailable');
          renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:'solid',colors:['#071426'],angleDeg:180});
          renderer.resize({widthCssPx:844,heightCssPx:390,devicePixelRatio:1});
          const {defaultGameplayCameraPose}=await import('/node_modules/@aerobeat/web-renderer/src/index.js');
          renderer.setGameplayCameraPose(mode,{...defaultGameplayCameraPose,position:{...defaultGameplayCameraPose.position,x:mode==='boxing'?-1.5:0.05,z:20}});
          const sample=()=>{renderer.manualTick();const copy=new OffscreenCanvas(canvas.width,canvas.height),ctx=copy.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('pixel readback unavailable');ctx.drawImage(canvas,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
          const rows=[];
          for(const nowMs of [E+1,E+500,E+1000,E+1000.01]){
            // Exercise the connected component's real rendererFrame/index path.
            // This harness has not started Play; inject the target song timestamp only
            // into the connected component's frame snapshot. The real gameplay
            // service, resolved authored interval, and renderer remain intact.
            const graph=game.graph;
            await graph.audio.seek(nowMs/1000);
            const truth=graph.gameplay.getSnapshot();
            const nextSnapshot=()=>({...truth,session:{...truth.session,purpose:'play',timelinePositionMs:nowMs}});
            const originalGraph=game.graph;
            game.graph={...originalGraph,gameplay:{...originalGraph.gameplay,getSnapshot:nextSnapshot}};
            try{
              const frame=game.rendererFrame(),target=frame.targets.find(item=>item.id===id);
              renderer.renderGameplayFrame({...frame,targets:frame.targets.filter(item=>item.id!==id),kneeJoints:{left:null,right:null}});const off=sample();
              renderer.renderGameplayFrame({...frame,kneeJoints:{left:null,right:null}});const on=sample();
              const wall=renderer.lastModel.objects.find(item=>item.kind==='obstacle'&&item.targetId===id),glb=(renderer.assetPools.get('wall/red-glass-v1')??[]).find(entity=>entity.enabled);
              let changed=0,red=0;for(let i=0;i<on.length;i+=4){const delta=Math.abs(on[i]-off[i])+Math.abs(on[i+1]-off[i+1])+Math.abs(on[i+2]-off[i+2]);if(delta>40)changed++;if(delta>40&&on[i]>on[i+1]*1.15&&on[i]>on[i+2]*1.1)red++;}
              rows.push({nowMs,presentation:frame.presentation,frameNowMs:frame.nowMs,interval:target?[target.intervalStartMs,target.intervalEndMs]:null,wall:wall?{assetId:wall.assetId,z:wall.position.z,depth:wall.scale.z}:null,glb:Boolean(glb),changed,red,sourceEnd:event.intervalEndTimestampMs,gameplayInterval:game.graph.content.getSnapshot().resolvedEvents[0].intervalEndTimestampMs,score:truth.scorePartitions?.map(partition=>({obstacleContacts:partition.obstacleContacts,hits:partition.hits,misses:partition.misses}))??[],judgements:truth.judgements?.length??0});
            }finally{game.graph=originalGraph;}
          }
          return rows;
        }finally{game.graph.renderer.setEnvironmentVisible(true);}
      },mode);
      for(const row of rows){const label=`${embedding}/${mode}/${row.nowMs}`;const visible=row.nowMs<=13000;assert.equal(row.presentation,mode==='flow'?'flow':'boxing_collider',`${label} actual selected presentation`);assert.equal(row.frameNowMs,row.nowMs,`${label} connected frame uses requested timeline`);assert.equal(row.sourceEnd,12000);assert.equal(row.gameplayInterval,12000,`${label} original collision interval unchanged`);assert.equal(row.judgements,0,`${label} presentation alone cannot score`);assert.equal(Boolean(row.wall),visible,`${label} native scene wall cutoff: ${JSON.stringify(row)}`);assert.equal(row.glb,visible,`${label} native GLB activation cutoff`);assert.equal(Boolean(row.interval),visible,`${label} connected indexed target cutoff`);if(visible){assert.deepEqual(row.interval,[10000,12000]);assert.equal(row.wall.assetId,'wall/red-glass-v1');assert(row.wall.z+row.wall.depth/2>6,`${label} front must have passed beat despawn line`);assert(Math.abs((row.wall.z-row.wall.depth/2)-(row.nowMs-12000)*.006)<1e-8,`${label} back face follows authored collider end`);assert(row.changed>500,`${label} actual native GLB framebuffer difference: ${JSON.stringify(row)}`);}else assert.equal(row.changed,0,`${label} wall removal does not alter framebuffer`);}
      assert.deepEqual(noise,[],`${embedding}/${mode} browser errors`);
      console.log(`PASS connected ${embedding}/${mode} long wall ${JSON.stringify(rows.map(({nowMs,interval,glb,changed,red})=>({nowMs,interval,glb,changed,red})))}`);
    }finally{await context.close();}
  }
}finally{await browser?.close();if(parent)await new Promise(resolve=>parent.close(resolve));await vite.close();}
