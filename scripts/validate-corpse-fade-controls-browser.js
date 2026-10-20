// @ts-check
// Connected AeroGame: legacy stored timers migrate to the locked, hidden values
// and real PlayCanvas GLBs fade in both modes (direct and cross-origin iframe).
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { aeroGameSetupStorageKey } from '../src/game-setup-coordinator.js';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';

const locked={enabled:true,delayMs:150,durationMs:500};
let vite=null,signedServer=null,url;
if(process.env.AEROBEAT_SIGNED_CORPSE_FADE_DIR){
  const signed=loadSignedSnapshot(path.resolve(process.env.AEROBEAT_SIGNED_CORPSE_FADE_DIR));
  assert.equal(signed.manifest.sourceManifest.packageVersion,'0.0.138','candidate must be the locked-fade successor');
  signedServer=createHttpServer(handlerForSnapshot(signed));
  await new Promise(done=>signedServer.listen(0,'127.0.0.1',done));
  const address=signedServer.address();assert(address&&typeof address!=='string');url=`http://127.0.0.1:${address.port}/`;
}else{
  vite=await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
  await vite.listen();url=vite.resolvedUrls?.local?.[0];
}
assert(url);
const parent=createHttpServer((_req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" style="width:844px;height:390px;border:0" src="${url}"></iframe>`);});
await new Promise(done=>parent.listen(0,'127.0.0.1',done));const address=parent.address();assert(address&&typeof address!=='string');
const browser=await chromium.launch({headless:true});
try{
  for(const embedding of ['direct','iframe']){
    const context=await browser.newContext({viewport:{width:868,height:414},deviceScaleFactor:1});
    const page=await context.newPage(),noise=[];
    page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));
    page.on('console',message=>{const type=message.type(),text=message.text(),location=message.location();if(['warning','error'].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,url)&&!isExpectedPlaycanvasMeshWarning(type,text))noise.push(`${type}:${text}`);});
    try{
      await page.goto(embedding==='direct'?url:`http://localhost:${address.port}/`,{waitUntil:'networkidle'});
      const child=embedding==='direct'?page:page.frames().find(frame=>frame!==page.mainFrame());assert(child);
      await child.waitForFunction(()=>document.querySelector('aero-game')?.graph?.renderer?.describe?.().gameplayAssets?.state==='ready',{timeout:15000});
      // Simulate an actual prior signed release's persisted athlete preference.
      await child.evaluate(storageKey=>{
        const game=document.querySelector('aero-game'),before=game.desiredGameSetup;
        localStorage.setItem(storageKey,JSON.stringify({...before,showGameplayGrid:true,flowCorpseFade:{enabled:false,delayMs:100,durationMs:200},boxingCorpseFade:{enabled:true,delayMs:50,durationMs:0}}));
      },aeroGameSetupStorageKey);
      await page.reload({waitUntil:'networkidle'});
      const reloaded=embedding==='direct'?page:page.frames().find(frame=>frame!==page.mainFrame());assert(reloaded);
      await reloaded.waitForFunction(()=>document.querySelector('aero-game')?.graph?.renderer?.describe?.().gameplayAssets?.state==='ready',{timeout:15000});
      const evidence=await reloaded.evaluate(storageKey=>{
        const game=document.querySelector('aero-game'),root=game.shadowRoot,renderer=game.graph.renderer;
        game.stopFrameLoop();game.setMenuOpen(true);game.renderPresenters();
        const setup=game.desiredGameSetup,saved=JSON.parse(localStorage.getItem(storageKey));
        const hidden=root.querySelectorAll('[data-game-setup-field*="CorpseFade"]').length===0&&!root.textContent.includes('corpse fade');
        game.setMenuOpen(false);renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:'solid',colors:['#071426'],angleDeg:180});
        const original=game.rendererFrame,results={};
        try{
          for(const [mode,family,beatMode] of [['flow','flow','slice'],['boxing','punch','straight']]){
            const entry={targetId:`fade-${mode}`,hitCommitMs:1000,family,hand:'left',mode:beatMode,spawn:{x:0,y:1,z:0},seed:42,shape:'arrow',direction:'up'};
            const render=time=>{
              game.rendererFrame=()=>({presentation:mode==='flow'?'flow':'boxing_spatial_grid',nowMs:time,targets:[],aftermath:[entry]});
              game.renderGameplay();
              const objects=renderer.lastModel.objects.filter(object=>object.kind==='aftermath'&&object.targetId===entry.targetId);
              const asset=objects[0]?.assetId??null;
              const nativeRoots=asset?(renderer.aftermathAssetPools.get(asset)??[]).filter(entity=>entity.enabled).length:0;
              return {alpha:objects.map(object=>object.alpha),asset,nativeRoots};
            };
            results[mode]=[1150,1400,1650].map(render);
          }
        }finally{game.rendererFrame=original;}
        return {hidden,setup:{flow:setup.flowCorpseFade,boxing:setup.boxingCorpseFade,grid:setup.showGameplayGrid},saved:{flow:saved.flowCorpseFade,boxing:saved.boxingCorpseFade,grid:saved.showGameplayGrid},results,lastError:game.lastError?.message??null};
      },aeroGameSetupStorageKey);
      assert.equal(evidence.hidden,true,`${embedding}: no fade menu controls or labels`);
      assert.deepEqual(evidence.setup,{flow:locked,boxing:locked,grid:true},`${embedding}: old preferences normalized without losing grid choice`);
      assert.deepEqual(evidence.saved,{flow:locked,boxing:locked,grid:true},`${embedding}: canonical persisted migration`);
      for(const mode of ['flow','boxing']){
        const [opaque,partial,hidden]=evidence.results[mode];
        assert.ok(opaque.alpha.length>0&&opaque.alpha.every(value=>value===1)&&opaque.asset&&opaque.nativeRoots===opaque.alpha.length,`${embedding}:${mode} native GLB held opaque`);
        assert.ok(partial.alpha.length===opaque.alpha.length&&partial.alpha.every(value=>value===.5),`${embedding}:${mode} native GLB half-opacity`);
        assert.deepEqual(hidden.alpha,[],`${embedding}:${mode} native corpse hidden at 650ms`);
      }
      assert.equal(evidence.lastError,null);assert.deepEqual(noise,[],`${embedding}: browser warnings/errors`);
      console.log(`${embedding} connected hidden locked Flow+Boxing fade, legacy reload and native GLB states passed`);
    }finally{await context.close();}
  }
}finally{await browser.close();await new Promise(done=>parent.close(done));if(signedServer)await new Promise(done=>signedServer.close(done));if(vite)await vite.close();}
