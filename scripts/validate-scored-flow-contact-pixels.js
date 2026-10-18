// @ts-check
// Representative scored Flow Play, never Visual Test or an exact-song claim.
// A connected production graph consumes measured CV-seam wrists; only camera,
// downloaded fixture content and audio device transport are substituted.
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { convertDifficulty, deriveBeatSaberSpawnTiming } from '@aerobeat/web-content-authoring';
import { build as buildFixture, createServer as createViteServer } from 'vite';

import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';

// Source conversion is checked separately from the scored representative Play
// chart: this fixture does not claim that its notes came from an exact song.
const sourceNote=(placement,hand,index,direction=8)=>({cell:(2-Math.floor(placement/4))*4+placement%4,hand,start:1,sourceIndex:index,direction});
const conversionOptions={difficulty:'Easy',songToken:'center-play-fixture',songName:'Center Play Fixture',bpm:120,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:0,spawnTiming:deriveBeatSaberSpawnTiming(120,10,0),sourceProvider:'synthetic',sourceId:'center-play-fixture',sourceVersionHash:'0'.repeat(40),sourceInfoFormat:'v2',sourceInfoVersion:'2.1.0',sourceInfoHash:`sha256:${'0'.repeat(64)}`,sourceDifficultyPath:'Easy.dat',sourceBeatmapFormat:'v3',sourceBeatmapVersion:'3.3.0',sourceDifficultyHash:`sha256:${'0'.repeat(64)}`,notePalette:null};
for(const [left,right] of [[2,1],[10,9],[10,1],[2,9]]){
  const converted=await convertDifficulty({colorNotes:[sourceNote(left,'left',0),sourceNote(right,'right',1,2)],bombNotes:[],obstacles:[],sliders:[],burstSliders:[]},conversionOptions);
  const flow=converted.charts.find(chart=>chart.mode==='flow');
  assert.deepEqual(flow?.beats.map(beat=>[beat.hand,beat.placement]),[['left',right],['right',left]],`source Flow center L${left}/R${right} maps to player-side hands`);
  assert.ok(converted.flowTrace&&/^sha256:[0-9a-f]{64}$/.test(String(flow.contentHash))&&/^sha256:[0-9a-f]{64}$/.test(String(converted.packageHash)),`center pair L${left}/R${right} carries converted trace and hash-bound package`);
}
const signedDirectory=process.env.AEROBEAT_SIGNED_FLOW_DIR;
let vite=null,signedServer=null,fixtureDirectory=null,childUrl;
if(signedDirectory){
  const snapshot=loadSignedSnapshot(path.resolve(signedDirectory));
  assert.equal(snapshot.manifest.sourceManifest.packageVersion,'0.0.130','signed candidate must carry the corrected phone-playtest version');
  fixtureDirectory=mkdtempSync(path.join(tmpdir(),'aerobeat-signed-flow-fixture-'));
  await buildFixture({configFile:false,root:process.cwd(),logLevel:'error',build:{outDir:fixtureDirectory,emptyOutDir:true,lib:{entry:'scripts/fixtures/scored-play-browser-harness.js',formats:['es'],fileName:()=> 'scored-play-browser-harness.js'}}});
  const fixtureBytes=new Map(readdirSync(fixtureDirectory).filter(name=>name.endsWith('.js')).map(name=>[`/scripts/fixtures/${name}`,readFileSync(path.join(fixtureDirectory,name))]));
  const signedHandler=handlerForSnapshot(snapshot);
  signedServer=createHttpServer((request,response)=>{
    const fixture=fixtureBytes.get(new URL(request.url??'/','http://local.invalid').pathname);
    if(fixture){response.setHeader('Content-Type','text/javascript; charset=utf-8');response.setHeader('Cache-Control','no-store');response.end(fixture);return;}
    signedHandler(request,response);
  });
  await new Promise(resolve=>signedServer.listen(0,'127.0.0.1',resolve));
  const address=signedServer.address();assert(address&&typeof address!=='string');
  childUrl=`http://127.0.0.1:${address.port}/`;
}else{
  vite=await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
  await vite.listen();
  childUrl=vite.resolvedUrls?.local?.[0];
}
assert(childUrl,'child game URL unavailable');
const parent=createHttpServer((_request,response)=>{response.setHeader('content-type','text/html; charset=utf-8');response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);});
await new Promise(resolve=>parent.listen(0,'127.0.0.1',resolve));
const address=parent.address();assert(address&&typeof address!=='string');
const parentUrl=`http://localhost:${address.port}/`;
const browser=await chromium.launch({headless:true});
try{
  const matrix=[];
  for(const embedding of ['direct','genuine_cross_origin_iframe']){
    const context=await browser.newContext({viewport:embedding==='direct'?{width:844,height:390}:{width:868,height:414},deviceScaleFactor:1});
    const page=await context.newPage(),noise=[];
    page.on('console',message=>{const type=message.type(),text=message.text(),location=message.location();if(['warning','error'].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,childUrl)&&!isExpectedPlaycanvasMeshWarning(type,text))noise.push(`${type}:${text}`);});
    page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));
    try{
      await page.goto(embedding==='direct'?childUrl:parentUrl,{waitUntil:'networkidle'});
      if(embedding!=='direct')assert.notEqual(new URL(parentUrl).origin,new URL(childUrl).origin);
      const game=embedding==='direct'?page.locator('aero-game'):page.frameLocator('#game').locator('aero-game');await game.waitFor();
      const result=await game.evaluate(async (element,captureProof)=>{
        const {installScoredPlayHarness,resolveSaberCapsule}=await import('/scripts/fixtures/scored-play-browser-harness.js');
        // Distinct pre-eligible baseline (center-200), then an eligible measured
        // pose; late tip also holds a fresh noncontact at center+40 before
        // crossing at +80. Never sweep through a near/far target.
        const cases=[
          {id:'early-hilt',at:6000,path:'hilt',contactAt:-100,expected:'great'},
          {id:'late-hilt',at:10000,path:'hilt',contactAt:100,expected:'great'},
          {id:'early-tip',at:14000,path:'tip',contactAt:-80,expected:'great'},
          {id:'late-tip',at:18000,path:'tip',contactAt:80,expected:'great'},
          {id:'behind-hilt',at:22000,path:'behind',contactAt:0,expected:'almost'},
          {id:'near-then-hilt',at:26000,path:'near-then-hilt',contactAt:0,expected:'great'},
          {id:'distant',at:30000,path:'distant',contactAt:0,expected:'miss'},
          {id:'tail',at:34000,path:'distant',contactAt:0,expected:'pending'}
        ];
        const events=cases.map(row=>({schema:'aerobeat/resolved_content_event',version:3,eventId:row.id,centerTimestampMs:row.at,sourceEventIds:[`source-${row.id}`],appearanceColor:'#2693FF',authoredBeat:{type:'note',hand:'left',placement:5,requiresDirection:false}}));
        const harness=await installScoredPlayHarness(element,{events,mode:'flow',songDurationMs:37000});
        await harness.waitForAssets();await harness.selectChart();await harness.setSetup({noseMarkerVisible:false,flowColliderVolume:{colliderVisible:true,colliderScale:.5,colliderDepthForward:1,colliderDepthBackward:0}});
        for(const [name,value] of [['spawnDistanceOverrideEnabled',true],['spawnDistanceOverrideWorldUnits',20]]){
          const input=harness.element.shadowRoot.querySelector(`[data-game-setup-field='${name}']`);
          if(!(input instanceof HTMLInputElement))throw Error(`Native spawn override ${name} unavailable`);
          if(input.type==='checkbox'){if(input.checked!==value)input.click();}
          else{input.focus();input.value=String(value);input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();}
          await harness.element.lifecycleIntentTail;
        }
        await harness.startPlay();await harness.calibrate();
        const game=harness.element,renderer=harness.graph.renderer;
        renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:'solid',colors:['#071426'],angleDeg:180});
        const wrist=(x,y)=>{const bounds=harness.graph.input.getSnapshot().calibration.bounds;return{x:1-(bounds.left+(x+.5)/4*(bounds.right-bounds.left)),y:bounds.top+(2.5-y)/3*(bounds.bottom-bounds.top)};};
        const advance=async(time,left,tag)=>{const previous=game.latestPoseTimestampMs;await harness.seekSong(time,{leftWrist:left,rightWrist:wrist(3.4,-.4),nose:{x:.5,y:.2}});const input=harness.graph.input.getSnapshot(),evidence=input.latestEvidence;if(evidence?.provenance!=='measured'||!(evidence.measurementTimestampMs>previous)||evidence.measurementTimestampMs!==game.latestPoseTimestampMs||input.tracking.gameplayPaused||input.tracking.freshCalibrationRequired)throw Error(`${tag}: fresh time-advancing measured Play evidence missing`);};
        const score=()=>harness.graph.gameplay.getSnapshot().scorePartitions.reduce((sum,part)=>sum+Number(part.score??0),0);
        const summarize=(pixels,baseline)=>{let changed=0,blue=0,white=0,red=0,yellow=0;for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2],delta=Math.abs(r-baseline[i])+Math.abs(g-baseline[i+1])+Math.abs(b-baseline[i+2]);if(delta<35)continue;changed++;if(b>110&&b>r*1.35&&b>g*1.2)blue++;if(r>155&&g>155&&b>155&&Math.max(r,g,b)-Math.min(r,g,b)<42)white++;if(r>115&&r>g*1.55&&r>b*1.35)red++;if(r>175&&g>130&&b<r*.55&&b<g*.65)yellow++;}return{changed,blue,white,red,yellow};};
        // This fixed measured scale-two pose keeps the hilt clear while the
        // distal capsule sphere alone reaches the scaled Flow hit rectangle.
        const tipPose={x:1.76,y:1};
        const rows=[];
        for(const row of cases.slice(0,-1)){
          const pre=score(),outside=wrist(-.4,-.4),tipOutside=wrist(3.4,1),behind=wrist(1,1.72),position=row.path==='hilt'||row.path==='near-then-hilt'?wrist(1.35,1):row.path==='tip'?wrist(tipPose.x,tipPose.y):row.path==='behind'?behind:wrist(3.4,0);
          await advance(row.at-200,row.path==='tip'?tipOutside:row.path==='behind'||row.path==='near-then-hilt'?behind:outside,`${row.id} pre-eligible baseline`);
          if(row.path==='tip'){
            const baseline=harness.graph.gameplay.getSnapshot();
            if(baseline.judgements.some(j=>j.eventId===row.id))throw Error(`${row.id}: noncontact baseline already judged`);
            const restingBlade=resolveSaberCapsule(game.currentEquipmentPoses[0]);
            if(!(restingBlade.start.x>2&&restingBlade.end.x>2))throw Error(`${row.id}: baseline blade not safely outside target: ${JSON.stringify(restingBlade)}`);
          }
          if(row.id==='late-hilt'){
            await advance(row.at+40,outside,`${row.id} fresh post-center noncontact`);
            if(harness.graph.gameplay.getSnapshot().judgements.some(j=>j.eventId===row.id))throw Error(`${row.id}: hilt contacted before the post-center approach`);
          }
          if(row.id==='late-tip'){
            await advance(row.at+40,tipOutside,`${row.id} fresh post-center noncontact`);
            if(harness.graph.gameplay.getSnapshot().judgements.some(j=>j.eventId===row.id))throw Error(`${row.id}: contact occurred before post-center tip approach`);
            const restingBlade=resolveSaberCapsule(game.currentEquipmentPoses[0]);
            if(!(restingBlade.start.x>2&&restingBlade.end.x>2))throw Error(`${row.id}: post-center fresh pose contacted target: ${JSON.stringify(restingBlade)}`);
          }
          if(row.path==='near-then-hilt'){
            await advance(row.at,behind,`${row.id} eligible near noncontact`);
            const pending=harness.graph.gameplay.getSnapshot(),pendingFrame=game.rendererFrame();
            if(pending.judgements.some(j=>j.eventId===row.id)||score()!==pre||pendingFrame.targets.find(t=>t.id===row.id)?.judgement!=='pending')throw Error(`${row.id}: near at center must remain unjudged and unscored before genuine contact`);
            await advance(row.at+80,position,`${row.id} later valid hilt contact`);
          }else await advance(row.at+row.contactAt,position,`${row.id} crossing`);
          const contact=harness.graph.gameplay.getSnapshot(),equipment=game.currentEquipmentPoses;
          if(equipment.length!==2||renderer.describe().equipment.assetMode!=='glb'||equipment[0].mode!=='flow')throw Error(`${row.id}: measured real saber GLBs absent`);
          const blade=resolveSaberCapsule(equipment[0]);
          const visibleCollider=renderer.lastModel?.objects?.find(object=>object.id==='equipment-collider-volume-left');
          if(visibleCollider?.shape!=='capsule'||Math.abs(visibleCollider.capsule.start.x-(blade.start.x-1.5))>1e-7||Math.abs(visibleCollider.capsule.start.y-blade.start.y)>1e-7||Math.abs(visibleCollider.capsule.end.x-(blade.end.x-1.5))>1e-7||Math.abs(visibleCollider.capsule.end.y-blade.end.y)>1e-7||Math.abs(visibleCollider.capsule.radius-blade.radius)>1e-7)throw Error(`${row.id}: real scored Flow blade and visible rear0/front1 collider disagree: ${JSON.stringify({blade,visibleCollider})}`);
          // Model endpoints alone do not prove the actual GPU mesh's endcaps.
          const entity=renderer.flowColliderCapsulePool?.find(candidate=>candidate.enabled&&candidate.name===visibleCollider.id),vertices=[];
          const count=entity?.render?.meshInstances?.[0]?.mesh?.getPositions(vertices)??0;
          if(count<4||vertices.length<count*3)throw Error(`${row.id}: actual Flow overlay mesh is unavailable`);
          let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
          for(let index=0;index<count*3;index+=3){minX=Math.min(minX,vertices[index]);maxX=Math.max(maxX,vertices[index]);minY=Math.min(minY,vertices[index+1]);maxY=Math.max(maxY,vertices[index+1]);minZ=Math.min(minZ,vertices[index+2]);maxZ=Math.max(maxZ,vertices[index+2]);}
          const meshScale=entity.getLocalScale(),centerline=Math.hypot(visibleCollider.capsule.end.x-visibleCollider.capsule.start.x,visibleCollider.capsule.end.y-visibleCollider.capsule.start.y,visibleCollider.capsule.end.z-visibleCollider.capsule.start.z),radius=visibleCollider.capsule.radius;
          const actual={axis:(maxX-minX)*meshScale.x,radialY:(maxY-minY)*meshScale.y,radialZ:(maxZ-minZ)*meshScale.z,midpoint:(maxX+minX)*meshScale.x/2},expected={axis:centerline+2*radius,radialY:2*radius,radialZ:2*radius,midpoint:0};
          if(Object.entries(expected).some(([key,value])=>Math.abs(actual[key]-value)>1e-5))throw Error(`${row.id}: actual GPU collider silhouette extends beyond scored saber capsule: ${JSON.stringify({actual,expected,meshScale,blade})}`);
          if((row.path==='hilt'||row.path==='near-then-hilt')&&!(Math.abs(blade.start.x-1.35)<.01&&Math.abs(blade.start.y-1)<.01))throw Error(`${row.id}: measured hilt differs from named path: ${JSON.stringify(blade)}`);
          let hiltEvidence=null;
          if(row.path==='hilt'||row.path==='near-then-hilt'){
            const judgement=contact.judgements.find(j=>j.eventId===row.id),offset=judgement?.timingOffsetMs;
            if(!(judgement?.result==='hit'&&Number.isFinite(offset)&&
              (row.id==='early-hilt'?offset<0:row.id==='near-then-hilt'?offset>=0&&offset<=80:offset>40&&offset<=100)))throw Error(`${row.id}: actual hilt contact timing differs from named early/late state: ${JSON.stringify(judgement)}`);
            hiltEvidence={firstContactMs:row.at+offset,hitDepthHalf:offset<0?'front':'back'};
          }
          if(row.path==='behind'){
            // The nearest point of the RAW cell (not its smaller hit collider)
            // lies behind the hilt along the actual resolved blade axis.
            const nearest={x:Math.max(.5,Math.min(1.5,blade.start.x)),y:Math.max(.5,Math.min(1.5,blade.start.y))};
            const behindDot=(nearest.x-blade.start.x)*(blade.end.x-blade.start.x)+(nearest.y-blade.start.y)*(blade.end.y-blade.start.y);
            if(!(blade.start.y>1.5&&blade.start.y<1.75&&behindDot<-.01))throw Error(`${row.id}: measured near noncontact not geometrically behind the hilt: ${JSON.stringify({blade,nearest,behindDot})}`);
          }
          let tipEvidence=null;
          if(row.path==='tip'){
            const placement=events.find(event=>event.eventId===row.id)?.authoredBeat.placement;
            const locked=game.activeSessionSetup,volume=locked?.flowColliderVolume;
            if(!locked||locked!==game.desiredGameSetup||!volume||!Number.isFinite(volume.colliderScale)||placement!==5)throw Error(`${row.id}: run-locked Flow collider authority or placement missing`);
            // Canonical 4×3 placement 5 has center (1,1) and raw half-size
            // (.5,.5). Production colliderScale shrinks both XY half-sizes.
            const centerX=placement%4,centerY=2-Math.floor(placement/4),half=.5*volume.colliderScale;
            const bounds={minX:centerX-half,maxX:centerX+half,minY:centerY-half,maxY:centerY+half};
            const distance=point=>Math.hypot(Math.max(bounds.minX-point.x,0,point.x-bounds.maxX),Math.max(bounds.minY-point.y,0,point.y-bounds.maxY));
            const startDistance=distance(blade.start),endDistance=distance(blade.end);
            if(!(startDistance>blade.radius&&endDistance<=blade.radius&&blade.end.x<blade.start.x))throw Error(`${row.id}: distal-only measured saber contact invalid: ${JSON.stringify({blade,bounds,startDistance,endDistance,volume})}`);
            const judgement=contact.judgements.find(j=>j.eventId===row.id);
            // Gameplay's recorded timingOffsetMs is the actual earliest swept
            // contact (recordJudgementAt receives swept.firstContactMs), not
            // the later display frame's crossing timestamp.
            const timingOffsetMs=judgement?.timingOffsetMs;
            if(!(judgement?.result==='hit'&&Number.isFinite(timingOffsetMs)&&
              (row.id==='early-tip'?timingOffsetMs<0:timingOffsetMs>=0&&timingOffsetMs>40&&timingOffsetMs<=80)))throw Error(`${row.id}: actual first swept contact not in intended temporal half: ${JSON.stringify(judgement)}`);
            tipEvidence={wrist:{x:tipPose.x,y:tipPose.y},blade,bounds,startDistance,endDistance,radius:blade.radius,firstContactMs:row.at+timingOffsetMs,hitDepthHalf:timingOffsetMs<0?'front':'back'};
          }
          if(row.expected==='great'&&contact.judgements.find(j=>j.eventId===row.id)?.result!=='hit')throw Error(`${row.id}: real scored blade contact did not hit: ${JSON.stringify({judgements:contact.judgements,equipment,session:contact.session,input:harness.graph.input.getSnapshot().latestEvidence?.anchors?.filter(a=>a.anchor==='left_wrist'),history:contact.saberWristHistory,frame:game.rendererFrame().targets.filter(t=>t.id===row.id),setup:game.desiredGameSetup.enforceAuthoredDirection})}`);
          if(row.path==='behind'){
            const pendingFrame=game.rendererFrame(),pendingTarget=pendingFrame.targets.find(t=>t.id===row.id);
            if(contact.judgements.some(j=>j.eventId===row.id)||score()!==pre||pendingTarget?.judgement!=='pending'||pendingTarget?.tier!==undefined)throw Error(`${row.id}: near-at-center prematurely judged/scored: ${JSON.stringify({judgements:contact.judgements,score:score(),pre,pendingTarget})}`);
            const pendingIcon=renderer.lastModel.objects.find(object=>object.kind==='icon'&&object.targetId===row.id);
            if(pendingIcon?.appearanceColor!=='#2693FF'||renderer.lastModel.objects.some(object=>object.targetId===row.id&&(object.kind==='feedback'||object.kind==='aftermath')))throw Error(`${row.id}: near-at-center must keep tinted intact GLB without feedback or slice`);
            await advance(row.at+999,position,`${row.id} before existing Miss boundary`);
            if(harness.graph.gameplay.getSnapshot().judgements.some(j=>j.eventId===row.id)||score()!==pre||game.rendererFrame().targets.find(t=>t.id===row.id)?.judgement!=='pending')throw Error(`${row.id}: near candidate resolved before existing Miss boundary`);
            await advance(row.at+1001,position,`${row.id} full Miss deadline`);
          }else if(row.expected==='miss'){
            await advance(row.at+190,position,`${row.id} near deadline`);
            await advance(row.at+1001,position,`${row.id} full deadline`);
          }
          const current=harness.graph.gameplay.getSnapshot(),judgement=current.judgements.find(j=>j.eventId===row.id),delta=score()-pre;
          const frame=game.rendererFrame(),full=harness.capture();
          const feedback=renderer.feedbackPool.filter(entry=>entry.root.enabled).map(entry=>({text:entry.text,texture:entry.quad.findComponents('render')[0]?.meshInstances?.[0]?.material?.diffuseMap?.name??null}));
          const icon=renderer.lastModel.objects.find(object=>object.kind==='icon'&&object.targetId===row.id);
          const assetEntities=icon?[...(renderer.assetPools.get(icon.assetId)??[])].filter(entity=>entity.enabled):[];
          const tinted=assetEntities.flatMap(entity=>(renderer.assetMaterials.get(entity)??[]).map(record=>record.meshInstance.material.diffuse)).some(color=>color.b>color.r+.05);
          const aftermath=renderer.lastModel.objects.filter(object=>object.kind==='aftermath'&&object.targetId===row.id);
          if((row.expected==='almost'||row.expected==='miss')&&assetEntities.length===0)throw Error(`${row.id}: real target GLB pool missing at scored feedback: ${JSON.stringify({judgement,nowMs:frame.nowMs,targets:frame.targets.filter(t=>t.id===row.id),icon,feedback,model:renderer.lastModel.objects.filter(o=>o.targetId===row.id),assetState:renderer.describe().gameplayAssets})}`);
          renderer.renderGameplayFrameWithCursorsAndEquipment({...frame,targets:frame.targets.filter(target=>target.id!==row.id)},[],null,equipment,null);
          const baseline=harness.capture();const pixels=summarize(full.pixels,baseline.pixels);
          renderer.renderGameplayFrameWithCursorsAndEquipment(frame,[],null,equipment,null);
          if(!judgement||judgement.tier!==row.expected||judgement.result!==(row.expected==='great'?'hit':'miss'))throw Error(`${row.id}: wrong actual scored Play judgement ${JSON.stringify(judgement??null)}`);
          const expectedCombo=row.expected==='miss'?0:rows.length+1;
          if(current.scorePartitions.at(-1)?.combo!==expectedCombo)throw Error(`${row.id}: Almost/Great must keep combo; Miss breaks it: ${JSON.stringify(current.scorePartitions)}`);
          const multiplier=expectedCombo>=8?8:expectedCombo>=4?4:expectedCombo>=2?2:1;
          const expectedScore=(row.expected==='great'?100:row.expected==='almost'?50:0)*multiplier;
          if(delta!==expectedScore)throw Error(`${row.id}: wrong base score/multiplier: ${JSON.stringify({delta,expectedScore,expectedCombo,multiplier})}`);
          const label=row.expected==='great'?'Great':row.expected==='almost'?'Almost':'Miss';
          if(!feedback.some(item=>item.text===label&&item.texture?.toLowerCase().includes(label.toLowerCase()))||pixels.changed<15)throw Error(`${row.id}: ${label} texture absent from real scored frame: ${JSON.stringify({feedback,pixels})}`);
          if(row.expected==='great'&&pixels.white<15)throw Error(`${row.id}: Great white feedback absent from real GLB framebuffer: ${JSON.stringify(pixels)}`);
          if(row.expected==='almost'&&(!judgement.diagnostics.includes('near_timing')||icon?.appearanceColor!=='#2693FF'||!tinted||pixels.yellow<15||aftermath.length!==0))throw Error(`${row.id}: yellow Almost must keep intact tinted real GLB and show no slice: ${JSON.stringify({judgement,feedback,icon,pixels,aftermath})}`);
          if(row.expected==='miss'&&(icon?.appearanceColor!=='#2a3038'||pixels.red<15||aftermath.length!==0))throw Error(`${row.id}: full Miss must gray icon and draw red feedback without slice: ${JSON.stringify({icon,pixels,aftermath})}`);
          if(row.id==='near-then-hilt'&&(judgement.diagnostics.includes('near_timing')||aftermath.length!==2||aftermath.some(piece=>piece.aftermath?.sliceSign!==1&&piece.aftermath?.sliceSign!==-1)))throw Error(`${row.id}: later real contact must yield Great and two genuine slice halves, never Almost: ${JSON.stringify({judgement,aftermath})}`);
          if(captureProof&&row.id==='early-hilt'){
             const canvas=game.shadowRoot.querySelector('canvas[data-role="renderer"]'),image=document.createElement('canvas');
             if(!(canvas instanceof HTMLCanvasElement))throw Error('signed Flow visual proof canvas missing');
             image.width=canvas.width;image.height=canvas.height;image.getContext('2d')?.drawImage(canvas,0,0);
             globalThis.__aerobeatFlowProof=image.toDataURL('image/png');
           }
           rows.push({id:row.id,result:judgement.result,tier:judgement.tier,scoreDelta:delta,combo:current.scorePartitions.at(-1)?.combo??null,feedback,pixels,icon:icon?.assetId??null,aftermath:aftermath.length,...(hiltEvidence?{hiltEvidence}:{}),...(tipEvidence?{tipEvidence}:{})});
        }
        // A genuinely measured low-confidence frame must never conjure a fallback
        // collider away from the blade; a valid held pose may remain until expiry.
        const judgementsBeforeLoss=harness.graph.gameplay.getSnapshot().judgements.length;
        for(const elapsed of [100,1100]){
          harness.feedPose({confidence:.1,timestampMs:game.latestPoseTimestampMs+elapsed,leftWrist:wrist(1.35,1),rightWrist:wrist(3.4,-.4)});
          const held=game.currentEquipmentPoses.filter(pose=>pose.mode==='flow');
          const volumes=renderer.lastModel.objects.filter(object=>object.kind==='collider_volume');
          if(volumes.length!==held.length)throw Error(`lost tracking invented or dropped Flow collider: ${JSON.stringify({elapsed,held,volumes})}`);
          for(const pose of held){const blade=resolveSaberCapsule(pose),volume=volumes.find(object=>object.role===pose.role.replace('_wrist',''));if(volume?.shape!=='capsule'||Math.abs(volume.capsule.start.x-(blade.start.x-1.5))>1e-7||Math.abs(volume.capsule.end.x-(blade.end.x-1.5))>1e-7)throw Error(`held Flow collider diverged from equipment: ${JSON.stringify({pose,blade,volume})}`);}
          if(harness.graph.gameplay.getSnapshot().judgements.length!==judgementsBeforeLoss)throw Error('invalid wrists scored during tracking loss');
        }
        harness.dispose();return rows;
      },Boolean(process.env.AEROBEAT_FLOW_VISUAL_PROOF_DIR));
      assert.deepEqual(noise,[],`${embedding}: browser noise`);
      if(process.env.AEROBEAT_FLOW_VISUAL_PROOF_DIR){
        const proof=embedding==='direct'?await page.evaluate(()=>globalThis.__aerobeatFlowProof):await page.frameLocator('#game').locator('html').evaluate(()=>globalThis.__aerobeatFlowProof);
        assert(typeof proof==='string'&&proof.startsWith('data:image/png;base64,'),`${embedding}: actual scored frame visual proof missing`);
        const directory=path.resolve(process.env.AEROBEAT_FLOW_VISUAL_PROOF_DIR),file=path.join(directory,`${embedding}-scored-flow.png`);
        mkdirSync(directory,{recursive:true});writeFileSync(file,Buffer.from(proof.slice('data:image/png;base64,'.length),'base64'),{flag:'wx'});
        console.log(`Saved scored Flow actual-browser image: ${file}`);
      }
      matrix.push({embedding,rows:result});
    }finally{await context.close();}
  }
  assert.deepEqual(matrix[0].rows.map(({id,result,tier,scoreDelta})=>({id,result,tier,scoreDelta})),matrix[1].rows.map(({id,result,tier,scoreDelta})=>({id,result,tier,scoreDelta})));
  console.log(`ORACLE scored-flow-contact-pixels PASS ${JSON.stringify(matrix)}`);
}finally{await browser.close();if(vite)await vite.close();if(signedServer)await new Promise(resolve=>signedServer.close(resolve));await new Promise(resolve=>parent.close(resolve));if(fixtureDirectory)rmSync(fixtureDirectory,{recursive:true,force:true});}
