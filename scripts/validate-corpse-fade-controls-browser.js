// @ts-check
// Real connected AeroGame, Game Setup DOM and native PlayCanvas GLBs (direct + iframe).
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { aeroGameSetupStorageKey } from '../src/game-setup-coordinator.js';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';

let vite=null,signedServer=null,url;
if(process.env.AEROBEAT_SIGNED_CORPSE_FADE_DIR){
  const signed=loadSignedSnapshot(path.resolve(process.env.AEROBEAT_SIGNED_CORPSE_FADE_DIR));
  assert.equal(signed.manifest.sourceManifest.packageVersion,'0.0.137','candidate must be the distinct corpse-fade source version');
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
      if(embedding==='iframe')assert.notEqual(new URL(url).origin,`http://localhost:${address.port}`,'iframe must have a distinct origin');
      const child=embedding==='direct'?page:page.frames().find(frame=>frame!==page.mainFrame());assert(child);
      await child.waitForFunction(()=>document.querySelector('aero-game')?.graph?.renderer?.describe?.().gameplayAssets?.state==='ready',{timeout:15000});
      const evidence=await child.evaluate(async(storageKey)=>{
        const game=document.querySelector('aero-game'),root=game.shadowRoot,renderer=game.graph.renderer;
        game.stopFrameLoop();game.setMenuOpen(true);game.renderPresenters();
        const pick=name=>root.querySelector(`[data-game-setup-field='${name}']`);
        const defaults={};
        for(const mode of ['flow','boxing']){
          const toggle=pick(`${mode}CorpseFadeEnabled`),delay=pick(`${mode}CorpseFadeDelayMs`),duration=pick(`${mode}CorpseFadeDurationMs`);
          if(!(toggle instanceof HTMLInputElement&&delay instanceof HTMLInputElement&&duration instanceof HTMLInputElement))throw Error(`${mode}: Game Setup fields absent`);
          defaults[mode]={enabled:toggle.checked,delay:delay.value,duration:duration.value,numeric:delay.type==='number'&&duration.type==='number'&&delay.min==='0'&&duration.min==='0'&&!delay.hasAttribute('max')&&!duration.hasAttribute('max')};
        }
        const set=async(name,value)=>{const input=pick(name);if(!(input instanceof HTMLInputElement))throw Error(`Missing ${name}`);if(input.type==='checkbox'){if(input.checked!==value)input.click();}else{input.focus();input.value=String(value);input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();}await game.lifecycleIntentTail;};
        for(const [mode,delay,duration] of [['flow',100,200],['boxing',50,100]]){await set(`${mode}CorpseFadeEnabled`,true);await set(`${mode}CorpseFadeDelayMs`,delay);await set(`${mode}CorpseFadeDurationMs`,duration);}
        const saved=JSON.parse(localStorage.getItem(storageKey));
        game.setMenuOpen(false);renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:'solid',colors:['#071426'],angleDeg:180});
        const original=game.rendererFrame;
        const results={};
        for(const [mode,family,beatMode,times] of [['flow','flow','slice',[1100,1200,1300]],['boxing','punch','straight',[1050,1100,1150]]]){
          const entry={targetId:`fade-${mode}`,hitCommitMs:1000,family,hand:'left',mode:beatMode,spawn:{x:0,y:1,z:0},seed:42,shape:'arrow',direction:'up'};
          const render=(time)=>{
            game.rendererFrame=()=>({presentation:mode==='flow'?'flow':'boxing_spatial_grid',nowMs:time,targets:[],aftermath:[entry]});
            game.renderGameplay();
            const objects=renderer.lastModel.objects.filter(object=>object.kind==='aftermath'&&object.targetId===entry.targetId);
            const asset=objects[0]?.assetId??null;
            const nativeRoots=asset?(renderer.aftermathAssetPools.get(asset)??[]).filter(entity=>entity.enabled).length:0;
            return {alpha:objects.map(object=>object.alpha),asset,nativeRoots};
          };
          results[mode]=times.map(render);
        }
        const uiValues={flow:[pick('flowCorpseFadeDelayMs').value,pick('flowCorpseFadeDurationMs').value],boxing:[pick('boxingCorpseFadeDelayMs').value,pick('boxingCorpseFadeDurationMs').value]};
        await set('flowCorpseFadeEnabled',false);
        game.rendererFrame=()=>({presentation:'flow',nowMs:1200,targets:[],aftermath:[{targetId:'old-flow',hitCommitMs:1000,family:'flow',hand:'left',mode:'slice',spawn:{x:0,y:1,z:0},seed:42,shape:'arrow',direction:'up'}]});game.renderGameplay();
        const legacy=renderer.lastModel.objects.filter(object=>object.kind==='aftermath'&&object.targetId==='old-flow').map(object=>object.alpha);
        await set('boxingCorpseFadeDurationMs',0);
        game.rendererFrame=()=>({presentation:'boxing_spatial_grid',nowMs:1050,targets:[],aftermath:[{targetId:'zero-boxing',hitCommitMs:1000,family:'punch',hand:'left',mode:'straight',spawn:{x:0,y:1,z:0},seed:42,shape:'arrow',direction:'up'}]});game.renderGameplay();
        const zero=renderer.lastModel.objects.filter(object=>object.kind==='aftermath'&&object.targetId==='zero-boxing').map(object=>object.alpha);
        game.rendererFrame=original;
        return {defaults,saved,results,uiValues,legacy,zero,lastError:game.lastError?.message??null};
      },aeroGameSetupStorageKey);
      assert.deepEqual(evidence.defaults,{flow:{enabled:false,delay:'150',duration:'500',numeric:true},boxing:{enabled:false,delay:'150',duration:'500',numeric:true}},`${embedding}: legacy defaults and public float inputs`);
      assert.deepEqual(evidence.saved.flowCorpseFade,{enabled:true,delayMs:100,durationMs:200});
      assert.deepEqual(evidence.saved.boxingCorpseFade,{enabled:true,delayMs:50,durationMs:100});
      assert.deepEqual(evidence.uiValues,{flow:['100','200'],boxing:['50','100']});
      for(const mode of ['flow','boxing']){
        const [opaque,partial,hidden]=evidence.results[mode];
        assert.ok(opaque.alpha.length>0&&opaque.alpha.every(value=>value===1)&&opaque.asset&&opaque.nativeRoots===opaque.alpha.length,`${embedding}:${mode} native opaque GLB`);
        assert.ok(partial.alpha.length===opaque.alpha.length&&partial.alpha.every(value=>value===.5),`${embedding}:${mode} half-opacity GLB`);
        assert.deepEqual(hidden.alpha,[],`${embedding}:${mode} corpse hidden after duration`);
      }
      assert.deepEqual(evidence.legacy,[1,1],`${embedding}: disabled Flow timer preserves opaque old on-screen halves`);
      assert.deepEqual(evidence.zero,[],`${embedding}: zero-duration Boxing timer hides exactly at delay boundary`);
      assert.equal(evidence.lastError,null);assert.deepEqual(noise,[],`${embedding}: browser errors`);
      await page.reload({waitUntil:'networkidle'});
      const reloaded=embedding==='direct'?page:page.frames().find(frame=>frame!==page.mainFrame());assert(reloaded);
      await reloaded.waitForSelector('aero-game');
      const persisted=await reloaded.evaluate(()=>{const game=document.querySelector('aero-game');return {flow:game.desiredGameSetup.flowCorpseFade,boxing:game.desiredGameSetup.boxingCorpseFade};});
      assert.deepEqual(persisted,{flow:{enabled:false,delayMs:100,durationMs:200},boxing:{enabled:true,delayMs:50,durationMs:0}},`${embedding}: mode-independent controls survive a real reload`);
      assert.deepEqual(noise,[],`${embedding}: browser errors after reload`);
      console.log(`${embedding} connected Game Setup Flow+Boxing controls, reload, native GLB opaque/partial/hidden states passed`);
    }finally{await context.close();}
  }
}finally{await browser.close();await new Promise(done=>parent.close(done));if(signedServer)await new Promise(done=>signedServer.close(done));if(vite)await vite.close();}
