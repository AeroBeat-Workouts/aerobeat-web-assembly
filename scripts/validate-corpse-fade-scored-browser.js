// @ts-check
// Connected production gameplay and native GLBs: do not substitute rendererFrame.
// Only downloaded fixture content, fake camera/CV and audio transport are substituted.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';

const vite = await createViteServer({ appType:'spa', configFile:'vite.config.js', logLevel:'error', server:{host:'127.0.0.1',port:0,hmr:false,watch:null} });
let browser;
try {
  await vite.listen();
  const url=vite.resolvedUrls?.local?.[0];assert(url);
  browser=await chromium.launch({headless:true});
  for(const mode of ['flow','boxing'])for(const purpose of ['play','visual_test']){
    const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1});
    const page=await context.newPage(),noise=[];
    page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));
    page.on('console',message=>{const location=message.location(),type=message.type();if(['warning','error'].includes(type)&&!isExpectedReadPixelsWarning(type,message.text(),location.url,location.lineNumber,location.columnNumber,url)&&!isExpectedPlaycanvasMeshWarning(type,message.text()))noise.push(`${type}:${message.text()}`);});
    try {
      await page.goto(url,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>Boolean(document.querySelector('aero-game')?.graph));
      const result=await page.locator('aero-game').evaluate(async(element,{mode,purpose})=>{
        const {installScoredPlayHarness,boxingColliderTargetCenter}=await import('/scripts/fixtures/scored-play-browser-harness.js');
        const id=`fade-${mode}-${purpose}`,at=6000;
        const event={schema:'aerobeat/resolved_content_event',version:3,eventId:id,centerTimestampMs:at,sourceEventIds:[`source-${id}`],appearanceColor:'#2693FF',authoredBeat:mode==='flow'?{type:'note',hand:'left',placement:5,requiresDirection:false}:{type:'hook_left',spatialTarget:{targetCell:5,entryDirection:'right'}}};
        const harness=await installScoredPlayHarness(element,{events:[event],mode,songDurationMs:10000});
        const fail=(condition,message)=>{if(!condition)throw Error(`${mode}/${purpose}: ${message}`);};
        try {
          await harness.waitForAssets();await harness.selectChart();
          const fade={enabled:true,delayMs:150,durationMs:500},other=fade;
          fail(element.shadowRoot.querySelectorAll('[data-game-setup-field*="CorpseFade"]').length===0,'locked fade options must be hidden');
          const marker=element.shadowRoot.querySelector('[data-game-setup-field="noseMarkerVisible"]');
          fail(marker instanceof HTMLInputElement,'native nose marker field missing');
          if(marker.checked)marker.click();
          await element.lifecycleIntentTail;
          // This synthetic chart has no authored spawn lead; use native setup inputs.
          for(const [name,value] of [['spawnDistanceOverrideEnabled',true],['spawnDistanceOverrideWorldUnits',20]]){
            const input=element.shadowRoot.querySelector(`[data-game-setup-field='${name}']`);
            fail(input instanceof HTMLInputElement,`native setup field ${name} missing`);
            if(input.type==='checkbox'){if(input.checked!==value)input.click();}
            else {input.focus();input.value=String(value);input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();}
            await element.lifecycleIntentTail;
          }
          if(mode==='boxing'){
            const {setGameSetupSnapshot}=await import('/src/game-setup-coordinator.js');
            setGameSetupSnapshot({...element.desiredGameSetup,enforceAuthoredDirection:false});
            await element.lifecycleIntentTail;
          }
          const desired=element.desiredGameSetup;
          fail(JSON.stringify(desired.flowCorpseFade)===JSON.stringify(fade)&&JSON.stringify(desired.boxingCorpseFade)===JSON.stringify(fade),'both native timers must remain locked');
          const renderer=harness.graph.renderer;
          renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:'solid',colors:['#071426'],angleDeg:180});
          const original=renderer.renderGameplayFrameWithCursorsAndEquipment;
          let actualFrame=null;
          renderer.renderGameplayFrameWithCursorsAndEquipment=function(frame,...args){actualFrame=frame;return original.call(this,frame,...args);};
          const sample=()=>{
            const frame=actualFrame,scene=renderer.lastModel,session=harness.graph.gameplay.getSnapshot().session;
            fail(frame&&scene&&session.purpose===purpose,'native frame/session absent');
            const settings=frame.aftermathFadeByMode;
            fail(JSON.stringify(settings?.[mode])===JSON.stringify(fade)&&JSON.stringify(settings?.[mode==='flow'?'boxing':'flow'])===JSON.stringify(other),`native frame timer settings incorrect: ${JSON.stringify(settings)}`);
            const entries=frame.aftermath?.filter(entry=>entry.targetId===id)??[];
            const objects=scene.objects.filter(object=>object.kind==='aftermath'&&object.targetId===id);
            const assets=objects.map(object=>object.assetId),roots=objects.map(object=>(renderer.aftermathAssetPools.get(object.assetId)??[]).filter(entity=>entity.enabled).length);
            return {nowMs:frame.nowMs,session:session.state,purpose:session.purpose,entries:entries.map(entry=>({hitCommitMs:entry.hitCommitMs,family:entry.family})),alpha:objects.map(object=>object.alpha),assets,roots,judgements:harness.graph.gameplay.getJudgements().filter(j=>j.eventId===id).map(j=>({result:j.result,tier:j.tier})),error:element.lastError?.message??null};
          };
          let rows;
          if(purpose==='play'){
            await harness.startPlay();await harness.calibrate();
            fail(element.activeSessionSetup?.[`${mode}CorpseFade`]?.enabled,'timer not locked into scored Play');
            const bounds=harness.graph.input.getSnapshot().calibration.bounds;
            const wrist=(x,y)=>({x:1-(bounds.left+(x+.5)/4*(bounds.right-bounds.left)),y:bounds.top+(2.5-y)/3*(bounds.bottom-bounds.top)});
            const pose=x=>({leftWrist:wrist(x,1),rightWrist:wrist(3.4,-.4),nose:{x:.5,y:.2}});
            if(mode==='flow'){
              await harness.seekSong(at-200,pose(-.4));
              await harness.seekSong(at,pose(1.35));
            }else{
              const target=boxingColliderTargetCenter(5,{topRowReachWU:element.activeSessionSetup.topRowReachWU,bottomRowReachWU:element.activeSessionSetup.bottomRowReachWU});
              const safe=wrist(.1,1.8),contact=wrist(target.x,target.y),measured=leftWrist=>({leftWrist,rightWrist:safe,nose:{x:.5,y:.2}});
              await harness.seekSong(at-90,measured(safe));harness.feedPose(measured(safe));
              await harness.seekSong(at-30,measured(contact));harness.feedPose(measured(contact));
              await harness.seekSong(at,measured(contact));harness.feedPose(measured(contact));
            }
            rows=[sample()];
            for(const time of [at+400,at+800]){await harness.seekSong(time,pose(mode==='flow'?1.35:1));rows.push(sample());}
          }else{
            await element.startSession('visual_test',{requireDownloaded:false});element.stopFrameLoop();element.setMenuOpen(false,{freshSession:true});await element.menuPauseTail;
            fail(element.setTestEquipmentVisible(true)&&element.setTestAutomaticFeedbackEnabled(false)&&element.setTestEquipmentMouseHand('left'),'native Test hand/feedback controls unavailable');
            const canvas=element.shadowRoot.querySelector('canvas[data-role="renderer"]'),rect=canvas.getBoundingClientRect(),Vec3=renderer.cameraEntity.getPosition().constructor;
            const move=(x,y)=>{const p=renderer.cameraEntity.camera.worldToScreen(new Vec3(x,y,.45));canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',pointerId:44,clientX:rect.left+p.x,clientY:rect.top+p.y}));fail(element.testEquipmentPointerPosition,'native Test pointer not projected');};
            if(mode==='boxing'){
              const target=boxingColliderTargetCenter(5,{topRowReachWU:element.activeSessionSetup.topRowReachWU,bottomRowReachWU:element.activeSessionSetup.bottomRowReachWU});
              move(-1.9,1.8);await harness.graph.audio.seek((at-200)/1000);element.runDisplayFrame();
              // The Test mouse's normalized X maps to world [-2,2], whereas
              // the scored Boxing target X uses the native lane offset.
              move(target.x-1.5,target.y);await harness.graph.audio.seek((at-80)/1000);element.runDisplayFrame();
              await harness.graph.audio.seek((at-30)/1000);element.runDisplayFrame();
              await harness.graph.audio.seek(at/1000);element.runDisplayFrame();
            }else{
              move(-2,1);await harness.graph.audio.seek((at-200)/1000);element.runDisplayFrame();
              move(-.15,1);await harness.graph.audio.seek(at/1000);element.runDisplayFrame();
            }
            rows=[sample()];
            for(const time of [at+400,at+800]){await harness.graph.audio.seek(time/1000);element.runDisplayFrame();rows.push(sample());}
          }
          const count=mode==='flow'?2:1;
          fail(rows[0].judgements.some(j=>j.result==='hit'),`genuine hit missing: ${JSON.stringify({rows,setup:element.activeSessionSetup?.boxingColliderVolume,target:mode==='boxing'?boxingColliderTargetCenter(5,{topRowReachWU:element.activeSessionSetup.topRowReachWU,bottomRowReachWU:element.activeSessionSetup.bottomRowReachWU}):null,pointer:element.testEquipmentPointerPosition,poses:element.currentEquipmentPoses?.map(p=>({role:p.role,anchor:p.anchor})),frame:actualFrame?.targets?.filter(t=>t.id===id),test:element.visualTestInteractionActivationMs,input:element.graph.gameplay.getSnapshot().input,interaction:element.graph.gameplay.getSnapshot().visualTestInteraction,settings:element.activeSessionSetup?.enforceAuthoredDirection})}`);
          fail(rows.every(row=>row.entries.length===1&&row.entries[0].family===(mode==='flow'?'flow':'punch')&&row.error===null),`genuine aftermath entry missing: ${JSON.stringify(rows)}`);
          const commit=rows[0].entries[0].hitCommitMs;
          fail(rows.every(row=>row.entries[0].hitCommitMs===commit),`hit commit changed: ${JSON.stringify(rows)}`);
          fail(rows[0].alpha.length===count&&rows[0].alpha.every(alpha=>alpha===1)&&rows[0].assets.every(Boolean)&&rows[0].roots.every(n=>n>=1),`native hit GLB not held opaque for 150 ms: ${JSON.stringify(rows)}`);
          fail(rows[1].alpha.length===count&&rows[1].alpha.every(alpha=>Math.abs(alpha-(1-(rows[1].nowMs-commit-150)/500))<1e-8)&&rows[1].alpha.every(alpha=>alpha>0&&alpha<1),`native hit GLB not partially transparent: ${JSON.stringify(rows)}`);
          fail(rows[2].nowMs-commit>=650&&rows[2].alpha.length===0,`native hit GLB not removed: ${JSON.stringify(rows)}`);
          return rows;
        }finally{harness.dispose();}
      },{mode,purpose});
      assert.deepEqual(noise,[],`${mode}/${purpose}: browser warnings/errors`);
      console.log(`PASS genuine ${mode} ${purpose} fade: ${JSON.stringify(result)}`);
    } finally {await context.close();}
  }
} finally {if(browser)await browser.close();await vite.close();}
