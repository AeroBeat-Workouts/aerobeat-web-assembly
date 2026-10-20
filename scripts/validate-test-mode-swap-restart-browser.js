// @ts-check
// Connected downloaded-song Test: pausing at 30s, switching Flow↔Boxing and
// pressing Test must restart the full newly selected beat chart at song zero.
// The boundary substitutes only package/audio devices; gameplay, Assembly,
// native renderer and its GLBs stay production services (direct + iframe).
import assert from 'node:assert/strict';
import {createServer as createHttpServer} from 'node:http';
import {chromium} from 'playwright';
import {createServer as createViteServer} from 'vite';
import {isExpectedReadPixelsWarning,isExpectedPlaycanvasMeshWarning} from './readpixels-console-policy.js';

const vite=await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
let browser=null,parent=null;
try{
  await vite.listen();const url=vite.resolvedUrls?.local?.[0];assert(url);
  parent=createHttpServer((_req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><iframe allow="camera; autoplay" style="width:844px;height:390px" src="${url}"></iframe>`);});
  await new Promise(done=>parent.listen(0,'127.0.0.1',done));const address=parent.address();assert(address&&typeof address!=='string');
  browser=await chromium.launch({headless:true});
  for(const embedding of ['direct','iframe'])for(const mode of ['flow','boxing']){
    const context=await browser.newContext({viewport:{width:868,height:414},deviceScaleFactor:1});
    const page=await context.newPage(),noise=[];
    page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));
    page.on('console',message=>{const location=message.location(),type=message.type();if(['warning','error'].includes(type)&&!isExpectedReadPixelsWarning(type,message.text(),location.url,location.lineNumber,location.columnNumber,url)&&!isExpectedPlaycanvasMeshWarning(type,message.text()))noise.push(`${type}:${message.text()}`);});
    try{
      await page.goto(embedding==='direct'?url:`http://localhost:${address.port}/`,{waitUntil:'networkidle'});
      const child=embedding==='direct'?page:page.frames().find(frame=>frame!==page.mainFrame());assert(child);
      await child.waitForFunction(()=>Boolean(document.querySelector('aero-game')?.graph));
      const result=await child.locator('aero-game').evaluate(async(element,mode)=>{
        const {installScoredPlayHarness}=await import('/scripts/fixtures/scored-play-browser-harness.js');
        const fail=(condition,message)=>{if(!condition)throw Error(`${mode}: ${message}`);};
        const beat=(id,type)=>({schema:'aerobeat/resolved_content_event',version:3,eventId:id,centerTimestampMs:id.endsWith('early')?3000:33000,sourceEventIds:[`source-${id}`],authoredBeat:type==='flow'?{type:'note',hand:'left',placement:5,requiresDirection:false}:{type:'hook_left',spatialTarget:{targetCell:5,entryDirection:'right'}}});
        const opposite=mode==='flow'?'boxing':'flow',events=[beat(`${mode}-early`,mode),beat(`${mode}-late`,mode)],alternativeEvents=[beat(`${opposite}-early`,opposite),beat(`${opposite}-late`,opposite)];
        const harness=await installScoredPlayHarness(element,{mode,events,alternativeEvents,songDurationMs:45000,beatToTimelineMs:beat=>beat*500});
        try{
          await harness.waitForAssets();await harness.selectChart();
          await harness.setSetup({spawnDistanceOverrideEnabled:true,spawnDistanceOverrideWorldUnits:20});
          await element.startSession('visual_test',{requireDownloaded:false});element.stopFrameLoop();element.setMenuOpen(false,{freshSession:true});await element.menuPauseTail;
          await harness.graph.audio.seek(30);element.runDisplayFrame();
          element.setMenuOpen(true);await element.menuPauseTail;
          const paused=harness.graph.gameplay.getSnapshot().session;
          fail(paused.state==='paused_manual'&&paused.timelinePositionMs>=29900,`old Test not paused at ~30s: ${JSON.stringify(paused)}`);
          const next=harness.graph.content.getSnapshot().variants.find(entry=>entry.mode===opposite);
          fail(next,'opposite variant unavailable');
          await element.selectVariant(next.variantId);await element.lifecycleIntentTail;
          const future=harness.graph.content.getSnapshot();
          fail(future.selectedVariant?.mode===opposite&&future.resolvedEvents.length===1&&future.resolvedEvents[0].eventId===`${opposite}-late`,`paused swap must remain future-only: ${JSON.stringify(future.resolvedEvents.map(entry=>[entry.eventId,entry.centerTimestampMs]))}`);
          await element.startSession('visual_test',{requireDownloaded:false});element.stopFrameLoop();element.setMenuOpen(false,{freshSession:true});await element.menuPauseTail;
          const audio=harness.graph.audio.getStatus(),content=harness.graph.content.getSnapshot(),session=harness.graph.gameplay.getSnapshot().session;
          element.renderGameplay();
          const frame=element.rendererFrame(),native=harness.graph.renderer.lastModel.objects.filter(object=>object.targetId===`${opposite}-early`);
          fail(audio.positionSeconds===0,`new Test audio did not restart at zero: ${audio.positionSeconds}`);
          fail(content.selectedVariant?.mode===opposite&&content.resolvedEvents.length===2&&content.resolvedEvents.some(event=>event.eventId===`${opposite}-early`),`early new-mode content not restored: ${JSON.stringify(content.resolvedEvents.map(event=>[event.eventId,event.centerTimestampMs]))}`);
          fail(session.purpose==='visual_test'&&session.state==='playing'&&frame.targets.some(target=>target.id===`${opposite}-early`)&&native.length>0,`early beat missing from real Test/frame/native renderer: ${JSON.stringify({session,targets:frame.targets.map(target=>target.id),native:native.length})}`);
          fail(frame.guidanceBandMode==='song_beat_grid'&&frame.guidanceBeatTimestampsMs.length>=12&&frame.guidanceBeatTimestampsMs.slice(0,12).every((time,index)=>time===index*500),`quarter-note rows must follow song tempo rather than sparse arrivals: ${JSON.stringify(frame.guidanceBeatTimestampsMs)}`);
          fail(harness.graph.renderer.lastModel.objects.filter(object=>object.kind==='guidance_band').length>=12,'native quarter-note row instances missing');
          fail(!element.lastError,`runtime error: ${element.lastError?.message}`);
          return {oldPositionMs:paused.timelinePositionMs,oldFuture:future.resolvedEvents.map(event=>event.eventId),newAudioSeconds:audio.positionSeconds,newMode:content.selectedVariant.mode,newEvents:content.resolvedEvents.map(event=>event.eventId),earlyNativeObjects:native.length};
        }finally{harness.dispose();}
      },mode);
      assert.deepEqual(noise,[],`${embedding}:${mode} browser warnings/errors`);
      console.log(`${embedding} ${mode}→${result.newMode} Test full-chart zero restart passed: ${JSON.stringify(result)}`);
    }finally{await context.close();}
  }
}finally{if(browser)await browser.close();if(parent)await new Promise(done=>parent.close(done));await vite.close();}
