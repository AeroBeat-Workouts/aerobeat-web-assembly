// @ts-check
// Actual connected Boxing visual_test: an authored GLB beat must stay blue as
// the native Test glove crosses it with the scored Show box still enabled.
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { build as buildFixture, createServer as createViteServer } from 'vite';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';

const signedDirectory = process.env.AEROBEAT_SIGNED_BOXER_TEST_DIR;
const fixtureDirectory = mkdtempSync(path.join(tmpdir(), 'aerobeat-boxing-test-beat-'));
let signedServer = null, vite = null, parent = null, browser = null;
try {
  let childUrl;
  if (signedDirectory) {
    const snapshot = loadSignedSnapshot(path.resolve(signedDirectory));
    assert(['0.0.133','0.0.134','0.0.135','0.0.136','0.0.137','0.0.138','0.0.139','0.0.140'].includes(snapshot.manifest.sourceManifest.packageVersion), 'unexpected signed Boxer Test snapshot');
    await buildFixture({ configFile:false, root:process.cwd(), logLevel:'error', build:{ outDir:fixtureDirectory, emptyOutDir:true, lib:{ entry:'scripts/fixtures/scored-play-browser-harness.js', formats:['es'], fileName:()=> 'scored-play-browser-harness.js' } } });
    const fixtures = new Map(readdirSync(fixtureDirectory).filter(name => name.endsWith('.js')).map(name => [`/scripts/fixtures/${name}`,readFileSync(path.join(fixtureDirectory,name))]));
    const signedHandler = handlerForSnapshot(snapshot);
    signedServer = createHttpServer((request,response) => { const fixture=fixtures.get(new URL(request.url??'/','http://local.invalid').pathname); if(fixture){response.setHeader('Content-Type','text/javascript; charset=utf-8');response.setHeader('Cache-Control','no-store');response.end(fixture);return;} signedHandler(request,response); });
    await new Promise(resolve => signedServer.listen(0,'127.0.0.1',resolve));
    const address = signedServer.address(); assert(address && typeof address !== 'string'); childUrl=`http://127.0.0.1:${address.port}/`;
  } else {
    vite=await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
    await vite.listen(); childUrl=vite.resolvedUrls?.local?.[0];
  }
  assert(childUrl,'Boxer Test browser URL unavailable');
  parent=createHttpServer((_request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);});
  await new Promise(resolve=>parent.listen(0,'127.0.0.1',resolve));
  const parentAddress=parent.address();assert(parentAddress&&typeof parentAddress!=='string');const parentUrl=`http://localhost:${parentAddress.port}/`;
  browser=await chromium.launch({headless:true});
  for(const embedding of ['direct','genuine_cross_origin_iframe']) {
    const context=await browser.newContext({viewport:embedding==='direct'?{width:844,height:390}:{width:868,height:414},deviceScaleFactor:1});
    const page=await context.newPage(),noise=[];
    page.on('console',message=>{const loc=message.location(),type=message.type();if(['error','warning'].includes(type)&&!isExpectedReadPixelsWarning(type,message.text(),loc.url,loc.lineNumber,loc.columnNumber,childUrl)&&!isExpectedPlaycanvasMeshWarning(type,message.text()))noise.push(`${type}:${message.text()}`);});
    page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));
    try {
      await page.goto(embedding==='direct'?childUrl:parentUrl,{waitUntil:'networkidle'});
      if(embedding!=='direct')assert.notEqual(new URL(childUrl).origin,new URL(parentUrl).origin,'Test iframe must be genuinely cross-origin');
      const game=embedding==='direct'?page.locator('aero-game'):page.frameLocator('#game').locator('aero-game');await game.waitFor();
      const start=await game.evaluate(async element=>{
        const {installScoredPlayHarness}=await import('/scripts/fixtures/scored-play-browser-harness.js');
        const event={schema:'aerobeat/resolved_content_event',version:3,eventId:'boxing-test-passing-hook',centerTimestampMs:20000,sourceEventIds:['test-passing-hook'],authoredBeat:{type:'hook_left',spatialTarget:{targetCell:5,entryDirection:'right'}}};
        const harness=await installScoredPlayHarness(element,{events:[event],mode:'boxing',songDurationMs:30000});
        await harness.waitForAssets();await harness.selectChart();
        await harness.setSetup({boxingColliderVolume:{colliderVisible:true,colliderScale:.5,colliderDepthForward:1,colliderDepthBackward:3},noseMarkerVisible:false});
        // The downloaded synthetic chart has no private Beat Saber spawn timing;
        // explicitly opt its fixture into the native run's valid distance override.
        element.desiredGameSetup=Object.freeze({...element.desiredGameSetup,spawnDistanceOverride:Object.freeze({enabled:true,normalSpawnDistanceWorldUnits:20})});
        await element.startSession('visual_test',{requireDownloaded:false});element.stopFrameLoop();element.setMenuOpen(false,{freshSession:true});await element.menuPauseTail;
        return{purpose:element.graph.gameplay.getSnapshot().session.purpose,locked:element.activeSessionSetup?.boxingColliderVolume,assets:element.graph.renderer.describe().gameplayAssets.state};
      });
      assert.equal(start.purpose,'visual_test');assert.equal(start.assets,'ready');
      assert.deepEqual(start.locked,{colliderVisible:true,colliderScale:.5,colliderDepthForward:1,colliderDepthBackward:3});
      await game.locator("[data-equipment-preview-toggle='true']").check();
      const aligned=await game.evaluate(element=>{const renderer=element.graph.renderer,canvas=element.shadowRoot.querySelector('canvas[data-role="renderer"]'),Vec3=renderer.cameraEntity.getPosition().constructor,screen=renderer.cameraEntity.camera.worldToScreen(new Vec3(-.5,1,.45)),rect=canvas.getBoundingClientRect();if(!element.setTestEquipmentMouseHand('left'))throw Error('native Test hand selection failed');canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',pointerId:42,clientX:screen.x+rect.left,clientY:screen.y+rect.top}));const left=renderer.lastModel.objects.find(object=>object.id==='equipment-collider-volume-left');return{left:left?.position,preview:element.testEquipmentVisible,pointer:element.testEquipmentPointerPosition};});
      assert(aligned.preview&&aligned.pointer&&Math.abs(aligned.left.x+.5)<.001&&Math.abs(aligned.left.y-1)<.001,'real Test glove not aligned with passing authored beat');
      const rows=[];
      for(const time of [19900,19950,19975,20000]){
        const sample=await game.evaluate(async(element,time)=>{
          const graph=element.graph;await graph.audio.seek(time/1000);element.runDisplayFrame();
          const renderer=graph.renderer,model=renderer.lastModel,beat=model?.objects.find(object=>object.id==='boxing-test-passing-hook:0');
          const canvas=element.shadowRoot.querySelector('canvas[data-role="renderer"]'),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const ctx=copy.getContext('2d',{willReadFrequently:true});if(!ctx||!beat)throw Error('native Test beat or framebuffer missing');
          const Vec3=renderer.cameraEntity.getPosition().constructor,point=renderer.cameraEntity.camera.worldToScreen(new Vec3(beat.position.x,beat.position.y,beat.position.z)),x=Math.round(point.x),y=Math.round(point.y);
          const pixel=()=>{ctx.drawImage(canvas,0,0);return [...ctx.getImageData(x,y,1,1).data];};
          const wire=renderer.boxingColliderWirePool?.[0],on=pixel();if(!wire?.enabled)throw Error('Boxer Show wire missing in Test');
          wire.enabled=false;renderer.manualTick();const withoutWire=pixel();wire.enabled=true;renderer.manualTick();const restored=pixel();
          const box=model.objects.find(object=>object.id==='equipment-collider-volume-left');
          return{time:graph.gameplay.getSnapshot().session.timelinePositionMs,beat:{asset:beat.assetId,z:beat.position.z,screen:[x,y]},box:{x:box.position.x,y:box.position.y,z:box.position.z},on,withoutWire,restored,wireLayer:wire.render.layers[0],colliderLayer:renderer.gameplayColliderOverlayLayer.id,assets:renderer.describe().gameplayAssets.state,errors:element.lastError?.message??null};
        },time);
        assert.equal(sample.time,time);assert.equal(sample.beat.asset,'directional-arrow/rounded-outline-v1');assert.equal(sample.assets,'ready');assert.equal(sample.errors,null);assert.deepEqual(sample.restored,sample.on,'wire-only control did not restore the captured Test frame');
        assert.deepEqual(sample.on,sample.withoutWire,`Boxing Test beat darkens when it reaches Show wire at ${time}ms: ${JSON.stringify(sample)}`);
        assert(sample.on[2]>=190,`Boxing Test beat lost blue fill at ${time}ms: ${JSON.stringify(sample)}`);
        if(time===20000)assert.equal(sample.wireLayer,sample.colliderLayer,'Boxer wire must stage before beat GLBs rather than overpainting them');
        rows.push(sample);
      }
      assert.deepEqual(noise,[],`${embedding}: unexpected Boxer Test console/page error`);
      console.log(`PASS Boxing Test beat crossing ${embedding}: ${JSON.stringify({origin:await game.evaluate(()=>location.origin),rows})}`);
    } finally {await context.close();}
  }
  console.log('ORACLE boxing-test-beat-visibility PASS');
} finally {
  if(browser)await browser.close();if(parent)await new Promise(resolve=>parent.close(resolve));if(signedServer)await new Promise(resolve=>signedServer.close(resolve));if(vite)await vite.close();rmSync(fixtureDirectory,{recursive:true,force:true});
}
