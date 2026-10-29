// @ts-check
// Actual menu/run binding, Show geometry and production scoring in Play and Test.
import assert from 'node:assert/strict';
import {createServer as httpServer} from 'node:http';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';
import {build,createServer as viteServer} from 'vite';import {chromium} from 'playwright';
import {handlerForSnapshot,loadSignedSnapshot} from './serve-friend-game.js';
import {isExpectedReadPixelsWarning} from './readpixels-console-policy.js';
let vite,server,fixtureDirectory,browser,url;
try{
 if(process.env.AEROBEAT_REAR_DEPTH_SIGNED_DIR){
  const snapshot=loadSignedSnapshot(process.env.AEROBEAT_REAR_DEPTH_SIGNED_DIR);assert.equal(snapshot.manifest.sourceManifest.packageVersion,'0.0.153');
  fixtureDirectory=mkdtempSync(path.join(tmpdir(),'aerobeat-rear-depth-'));
  await build({configFile:false,root:process.cwd(),logLevel:'error',build:{outDir:fixtureDirectory,emptyOutDir:true,lib:{entry:'scripts/fixtures/rear-depth-browser-harness.js',formats:['es'],fileName:()=> 'rear-depth-browser-harness.js'}}});
  const fixtures=new Map(readdirSync(fixtureDirectory).filter(name=>name.endsWith('.js')).map(name=>[`/scripts/fixtures/${name}`,readFileSync(path.join(fixtureDirectory,name))]));const handler=handlerForSnapshot(snapshot);
  server=httpServer((request,response)=>{const bytes=fixtures.get(new URL(request.url??'/','http://local.invalid').pathname);if(bytes){response.setHeader('content-type','text/javascript');response.end(bytes);}else handler(request,response);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/`;
 }else{vite=await viteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await vite.listen();url=vite.resolvedUrls?.local?.[0];}
 assert(url);browser=await chromium.launch({headless:true});
 for(const mode of ['flow','boxing']){
  const context=await browser.newContext({viewport:{width:1000,height:700}}),page=await context.newPage(),noise=[];
  page.on('pageerror',error=>noise.push(error.message));page.on('console',message=>{if(!['warning','error'].includes(message.type()))return;const l=message.location();if(!isExpectedReadPixelsWarning(message.type(),message.text(),l.url,l.lineNumber,l.columnNumber,url))noise.push(message.type()+':'+message.text());});
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!document.querySelector('aero-game')?.graph);
  const result=await page.locator('aero-game').evaluate(async(element,mode)=>{
   const {installScoredPlayHarness,resolveSaberColliderParts,resolveGloveColliderParts,judgeToPresentationPoint,flowColliderSettingsIdentity,boxingColliderSettingsIdentity,gameplayFlowColliderSettings,gameplayBoxingColliderSettings}=await import('/scripts/fixtures/rear-depth-browser-harness.js');
   const check=(value,message)=>{if(!value)throw Error(`${mode}: ${message}`);};const near=(a,b)=>Math.abs(a-b)<1e-8;
   const field='colliderDepthBackwardAthleteFacing',key=mode==='flow'?'flowColliderVolume':'boxingColliderVolume',defaultValue=mode==='boxing';
   const authoredBeat=mode==='flow'?{type:'note',hand:'left',placement:5,requiresDirection:false}:{type:'straight_left',spatialTarget:{targetCell:5,acceptedSubcells:[20,21,22,23]},timingWindowMs:180,evidenceFreshnessMs:150};
   const event={schema:'aerobeat/resolved_content_event',version:3,eventId:'rear-depth-beat',centerTimestampMs:6000,sourceEventIds:['source-rear-depth'],...(mode==='flow'?{appearanceColor:'#2693FF'}:{}),authoredBeat};
   const harness=await installScoredPlayHarness(element,{events:[event],mode,songDurationMs:12000});
   const rows=[],artByPurpose=new Map(),frontByPurpose=new Map();
   const checkbox=()=>element.shadowRoot.querySelector(`[data-collider-volume-field='${field}']`);
   const show=()=>element.shadowRoot.querySelector("[data-collider-volume-field='colliderVisible']");
   const start=async purpose=>{
    if(purpose==='play'){await harness.startPlay();await harness.calibrate();}
    else{await element.startSession('visual_test',{requireDownloaded:false});element.stopFrameLoop();element.setMenuOpen(false,{freshSession:true});await element.menuPauseTail;element.audioSyncPending=false;element.setTestEquipmentVisible(true);element.setTestAutomaticFeedbackEnabled(false);element.setTestEquipmentMouseHand('left');element.setTestWebcamFps(0);}
   };
   const geometry=()=>{
    element.renderGameplay();const volume=element.activeSessionSetup[key],poses=element.currentEquipmentPoses,objects=harness.graph.renderer.lastModel.objects.filter(o=>o.kind==='collider_volume');
    check(poses.length===2&&objects.length>0,'actual equipment and Show volumes present');
    for(const pose of poses){
     const hand=pose.role==='left_wrist'?'left':'right';const actual=objects.filter(o=>o.id.startsWith(`equipment-collider-volume-${hand}`));
     const parts=(mode==='flow'?resolveSaberColliderParts:resolveGloveColliderParts)(pose,{scale:volume.colliderScale,depthForward:volume.colliderDepthForward,depthBackward:volume.colliderDepthBackward,depthBackwardAthleteFacing:volume[field]});
     check(actual.length===parts.length,'all shared union parts shown, without a diagonal bridge');
     for(let i=0;i<parts.length;i++){const part=parts[i],drawn=actual[i].capsule;check(near(drawn.radius,part.radius),'drawn/scored radius parity');for(const endpoint of ['start','end']){const expected=judgeToPresentationPoint(part[endpoint]);for(const axis of ['x','y'])check(near(drawn[endpoint][axis],expected[axis]),`drawn/scored ${endpoint}.${axis}`);check(near(drawn[endpoint].z,part[endpoint].z),'drawn/scored depth parity');}}
    }
    return {flag:volume[field],parts:objects.length,art:poses.map(p=>({role:p.role,orientation:p.orientation,scale:p.scale})),front:poses.map(p=>objects.find(o=>o.id===`equipment-collider-volume-${p.role==='left_wrist'?'left':'right'}`).capsule[mode==='flow'?'end':'start']),canvas:[element.canvasElement().width,element.canvasElement().height]};
   };
   const score=async purpose=>{
    await harness.graph.audio.seek(5.75);element.runDisplayFrame();
    const target=element.rendererFrame().targets.find(t=>t.id==='rear-depth-beat');check(target,'real rendered target exists');
    const x=(1+.5)/4,y=mode==='boxing'?(2.5-target.heightWorldY)/3:.5;
    if(purpose==='visual_test'){element.testEquipmentPointerPosition={x,y};await harness.graph.audio.seek(6);element.runDisplayFrame();}
    else{const b=harness.graph.input.getSnapshot().calibration.bounds;const wrist={x:1-(b.left+x*(b.right-b.left)),y:b.top+y*(b.bottom-b.top)};await harness.graph.audio.seek(6);harness.feedPose({leftWrist:wrist});}
    check(harness.graph.gameplay.getJudgements().filter(j=>j.eventId==='rear-depth-beat'&&j.result==='hit').length===1,'real scorer accepts target once');
    const settings=(mode==='flow'?gameplayFlowColliderSettings:gameplayBoxingColliderSettings)(element.activeSessionSetup),identity=(mode==='flow'?flowColliderSettingsIdentity:boxingColliderSettingsIdentity)(settings);
    const identityField=mode==='flow'?'flowColliderSettingsIdentity':'boxingColliderSettingsIdentity';check(harness.graph.gameplay.getSnapshot().scorePartitions.some(p=>p[identityField]===identity&&p.hits===1),'correct option reaches scored identity/partition');
    element.runDisplayFrame();check(harness.graph.gameplay.getJudgements().filter(j=>j.eventId==='rear-depth-beat'&&j.result==='hit').length===1,'no duplicate hit from union parts');
   };
   try{
    await harness.waitForAssets();await harness.selectChart();check(checkbox() instanceof HTMLInputElement&&checkbox().type==='checkbox','native requested boolean control exists');check(checkbox().checked===defaultValue,'per-mode requested default');check(checkbox().parentElement.textContent.includes('athlete'),'clear athlete-facing label');
    await harness.setSetup({kneeStrikesEnabled:false,spawnDistanceOverrideEnabled:true,spawnDistanceOverrideWorldUnits:20,[key]:{colliderVisible:true,colliderDepthForward:1,colliderDepthBackward:1}});
    await start('visual_test');
    // Existing Test authoring controls provide visibly non-cardinal equipment.
    for(const hand of ['left','right'])for(const [axis,value] of [['x',20],['y',30],['z',40]]){const control=element.shadowRoot.querySelector(`[data-equipment-config-field='${mode}.perHand.${hand}.rotationEulerDeg.${axis}']`);check(control instanceof HTMLInputElement&&!control.disabled,'native rotation authoring enabled');control.value=String(value);control.dispatchEvent(new Event('change',{bubbles:true}));await element.equipmentConfigCommitTail;}
    for(const purpose of ['visual_test','play'])for(const value of [defaultValue,!defaultValue]){
     if(purpose!=='visual_test'||value!==defaultValue)await start(purpose);
     if(purpose==='visual_test')element.testEquipmentPointerPosition={x:.375,y:.5};
     await harness.graph.audio.seek(5.5);element.runDisplayFrame();await new Promise(r=>setTimeout(r,10));element.runDisplayFrame();
     check(element.activeSessionSetup[key][field]===value,'new run binds requested option');const before=geometry();
     if(artByPurpose.has(purpose)){const previous=artByPurpose.get(purpose),front=frontByPurpose.get(purpose);for(let i=0;i<before.art.length;i++){check(near(before.art[i].scale,previous[i].scale),'toggle does not scale art');for(const axis of ['x','y','z','w'])check(near(before.art[i].orientation[axis],previous[i].orientation[axis]),'toggle does not rotate art');for(const axis of ['x','y','z'])check(near(before.front[i][axis],front[i][axis]),'positive/front reach stays unchanged');}}
     else{artByPurpose.set(purpose,before.art);frontByPurpose.set(purpose,before.front);}
     await score(purpose);rows.push({purpose,value,parts:before.parts,canvas:before.canvas});
     element.setMenuOpen(true);await element.menuPauseTail;element.renderColliderVolumeControls();
     const priorShow=show().checked;checkbox().click();await element.lifecycleIntentTail;
     check(element.desiredGameSetup[key][field]===!value&&show().checked===priorShow,'native checkbox independent from Show volume');
     check(element.activeSessionSetup[key][field]===value,'paused edit does not mutate active run');
     check(JSON.stringify(element.desiredGameSetup[mode==='flow'?'boxingColliderVolume':'flowColliderVolume'])===JSON.stringify(element.activeSessionSetup[mode==='flow'?'boxingColliderVolume':'flowColliderVolume']),'other mode option stays independent');
    }
    return {mode,defaultValue,rows};
   }finally{harness.dispose();}
  },mode);
  assert.deepEqual(noise,[],'no unexpected console/page errors');console.log(JSON.stringify(result));await context.close();
 }
 console.log('Rear-depth checkbox, shared Show geometry and exactly-once Play/Test scoring passed'+(process.env.AEROBEAT_REAR_DEPTH_SIGNED_DIR?' in signed 0.0.153':''));
}finally{await browser?.close();if(vite)await vite.close();if(server)await new Promise(r=>server.close(r));if(fixtureDirectory)rmSync(fixtureDirectory,{recursive:true,force:true});}
