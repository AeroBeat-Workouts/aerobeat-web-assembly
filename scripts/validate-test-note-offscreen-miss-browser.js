// @ts-check
// A real Boxing visual_test note must never become gray/MISS while still visible.
// Cover renderer-local automatic feedback and genuine unranked production judgement.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, createServer as createViteServer } from 'vite';
import { chromium } from 'playwright';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';
import {isExpectedReadPixelsWarning,isExpectedPlaycanvasMeshWarning} from './readpixels-console-policy.js';
const signedDirectory=process.env.AEROBEAT_SIGNED_TEST_MISS_DIR;
const fixturesDir=mkdtempSync(path.join(tmpdir(),'aerobeat-test-miss-'));let server=null,vite=null,parent=null,browser=null;
try{
 let childUrl;
 if(signedDirectory){
   const snapshot=loadSignedSnapshot(path.resolve(signedDirectory));
   assert(['0.0.135','0.0.136'].includes(snapshot.manifest.sourceManifest.packageVersion),'unsupported signed Test MISS snapshot');
   await build({configFile:false,root:process.cwd(),logLevel:'error',build:{outDir:fixturesDir,emptyOutDir:true,lib:{entry:'scripts/fixtures/scored-play-browser-harness.js',formats:['es'],fileName:()=> 'scored-play-browser-harness.js'}}});
   const fixtures=new Map(readdirSync(fixturesDir).filter(file=>file.endsWith('.js')).map(file=>['/scripts/fixtures/'+file,readFileSync(path.join(fixturesDir,file))]));const handler=handlerForSnapshot(snapshot);
   server=createServer((request,response)=>{const file=fixtures.get(new URL(request.url??'/','http://local.invalid').pathname);if(file){response.setHeader('Content-Type','text/javascript; charset=utf-8');response.end(file);return;}handler(request,response);});
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert(address&&typeof address!=='string');childUrl=`http://127.0.0.1:${address.port}/`;
 }else{vite=await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await vite.listen();childUrl=vite.resolvedUrls?.local?.[0];}
 assert(childUrl);
 parent=createServer((_request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0}</style><iframe id="game" allow="camera; autoplay; fullscreen; xr-spatial-tracking" src="${childUrl}"></iframe>`);});await new Promise(resolve=>parent.listen(0,'127.0.0.1',resolve));const parentAddress=parent.address();assert(parentAddress&&typeof parentAddress!=='string');const parentUrl=`http://localhost:${parentAddress.port}/`;
 browser=await chromium.launch({headless:true});
 for(const embedding of ['direct','genuine_cross_origin_iframe'])for(const automatic of [true,false]){
   const context=await browser.newContext({viewport:embedding==='direct'?{width:844,height:390}:{width:868,height:414},deviceScaleFactor:1});
   const page=await context.newPage(),noise=[];
   page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));page.on('console',message=>{const location=message.location();if(['warning','error'].includes(message.type())&&!isExpectedReadPixelsWarning(message.type(),message.text(),location.url,location.lineNumber,location.columnNumber,childUrl)&&!isExpectedPlaycanvasMeshWarning(message.type(),message.text()))noise.push(`${message.type()}:${message.text()}`);});
   try{
     await page.goto(embedding==='direct'?childUrl:parentUrl,{waitUntil:'networkidle'});
     if(embedding!=='direct')assert.notEqual(new URL(childUrl).origin,new URL(parentUrl).origin);
     const game=embedding==='direct'?page.locator('aero-game'):page.frameLocator('#game').locator('aero-game');await game.waitFor();
     const legacy=Boolean(signedDirectory?.includes('135-'));
     const setup=await game.evaluate(async(element,{automatic,legacy})=>{
       const {installScoredPlayHarness}=await import('/scripts/fixtures/scored-play-browser-harness.js');
       const beat=(id,time)=>({schema:'aerobeat/resolved_content_event',version:3,eventId:id,centerTimestampMs:time,sourceEventIds:[id],authoredBeat:{type:'hook_left',spatialTarget:{targetCell:1,entryDirection:'right'}}});
       const harness=await installScoredPlayHarness(element,{events:[beat('earlier-test-note',18000),beat('visible-test-miss',20000)],mode:'boxing',songDurationMs:30000});await harness.waitForAssets();await harness.selectChart();
       await harness.setSetup({boxingColliderVolume:{colliderVisible:true,colliderScale:legacy?.5:1,colliderDepthForward:1,colliderDepthBackward:legacy?3:0},noseMarkerVisible:false});
       element.desiredGameSetup=Object.freeze({...element.desiredGameSetup,spawnDistanceOverride:Object.freeze({enabled:true,normalSpawnDistanceWorldUnits:20})});
       await element.startSession('visual_test',{requireDownloaded:false});element.stopFrameLoop();element.setMenuOpen(false,{freshSession:true});await element.menuPauseTail;
       const initial={visible:element.testEquipmentVisible,hand:element.testEquipmentMouseHand,uiChecked:element.shadowRoot.querySelector('[data-equipment-preview-toggle]')?.checked,rightChecked:element.shadowRoot.querySelector('[data-equipment-mouse-hand="right"]')?.checked};
       if(!element.setTestEquipmentVisible(true)||!element.setTestEquipmentMouseHand('right')||!element.setTestAutomaticFeedbackEnabled(automatic))throw Error('native Test options rejected');
       const renderer=element.graph.renderer,canvas=element.shadowRoot.querySelector('canvas[data-role="renderer"]'),Vec3=renderer.cameraEntity.getPosition().constructor,point=renderer.cameraEntity.camera.worldToScreen(new Vec3(1.5,1,.45)),rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',pointerId:44,clientX:rect.left+point.x,clientY:rect.top+point.y}));
       if(!element.testEquipmentPointerPosition)throw Error('native Test right-hand pointer not projected');
       return {initial,purpose:element.graph.gameplay.getSnapshot().session.purpose,assets:renderer.describe().gameplayAssets.state,locked:element.activeSessionSetup?.boxingColliderVolume};
     },{automatic,legacy});
     assert.equal(setup.purpose,'visual_test');assert.equal(setup.assets,'ready');assert.equal(setup.locked?.colliderDepthBackward,legacy?3:0);assert.equal(setup.locked?.colliderScale,legacy?.5:1);
     if(!legacy)assert.deepEqual(setup.initial,{visible:true,hand:'right',uiChecked:true,rightChecked:true},'Test must default preview on and right mouse hand');
     const rows=[];
     for(const time of [19000,20540,20541,20999,21000,21001]){
       const result=await game.evaluate(async(element,time)=>{
         await element.graph.audio.seek(time/1000);element.runDisplayFrame();const renderer=element.graph.renderer,model=renderer.lastModel,note=model?.objects.find(object=>object.id==='visible-test-miss:0'),feedback=model?.objects.filter(object=>object.kind==='feedback').map(object=>object.feedback?.text)??[],canvas=element.shadowRoot.querySelector('canvas[data-role="renderer"]'),position=note?.position,camera=renderer.cameraEntity.getPosition();let screen=null,pixel=null;
         if(position){const Vec3=camera.constructor,p=renderer.cameraEntity.camera.worldToScreen(new Vec3(position.x,position.y,position.z));screen=[p.x,p.y,p.z];if(p.x>=0&&p.x<canvas.width&&p.y>=0&&p.y<canvas.height&&p.z>0){const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const context=copy.getContext('2d',{willReadFrequently:true});if(!context)throw Error('2D readback unavailable');context.drawImage(canvas,0,0);pixel=[...context.getImageData(Math.round(p.x),Math.round(p.y),1,1).data];}}
         return {time:element.graph.gameplay.getSnapshot().session.timelinePositionMs,screen,pixel,noteState:note?.state??null,noteZ:position?.z??null,cameraZ:camera.z,feedback,judgements:element.graph.gameplay.getJudgements().filter(j=>j.eventId==='visible-test-miss').map(j=>({result:j.result,commit:j.committedTimelinePositionMs})),error:element.lastError?.message??null};
       },time);assert.equal(result.time,time);assert.equal(result.error,null);rows.push(result);
       if(time===20540||time===20541){assert(result.screen&&result.screen[0]>0&&result.screen[0]<844&&result.screen[1]>0&&result.screen[1]<390,`real Test beat must be onscreen at ${time}: ${JSON.stringify(result)}`);assert(result.pixel&&result.pixel[2]>=190&&result.noteState!=='miss',`Boxing Test note became gray/MISS while onscreen at ${time}: ${JSON.stringify(result)}`);assert(!result.feedback.includes('Miss'),`red MISS appeared before note exits at ${time}: ${JSON.stringify(result)}`);assert.deepEqual(result.judgements,[],`actual Test judgement committed while beat visible at ${time}`);}
       if(time===21001){assert(result.feedback.includes('Miss'),`late Test MISS absent after note clears camera: ${JSON.stringify(result)}`);assert(!result.screen||result.noteZ>result.cameraZ||result.screen[0]<0||result.screen[0]>=844||result.screen[1]<0||result.screen[1]>=390,'Test MISS must follow offscreen beat');if(!automatic)assert.deepEqual(result.judgements,[{result:'miss',commit:21001}]);}
     }
     assert.deepEqual(noise,[],`${embedding}/${automatic} unexpected browser errors`);console.log(`PASS native Boxing Test onscreen MISS ${embedding} automatic=${automatic}: ${JSON.stringify({origin:await game.evaluate(()=>location.origin),rows})}`);
   }finally{await context.close();}
 }
 console.log('ORACLE test-note-offscreen-miss PASS');
}finally{if(browser)await browser.close();if(parent)await new Promise(resolve=>parent.close(resolve));if(server)await new Promise(resolve=>server.close(resolve));if(vite)await vite.close();rmSync(fixturesDir,{recursive:true,force:true});}
