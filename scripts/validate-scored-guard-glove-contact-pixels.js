// @ts-check
// Representative, not Brilliant 2 U Expert: scored Play guard/glove contact.
// Real connected <aero-game>, selected downloaded Boxing package, CV-measured
// calibrated wrists, production display loop, pinned GLB framebuffer and actual
// graph gameplay judgements/score. No detached coordinator or model-only pass.
// A real GLB's depth buffer may hide a glove behind a shield. Same-frame
// isolated shield-only/glove-only GLB pixels establish overlapping footprint;
// the complete frame proves depth occlusion, never a model-only visual pass.
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';

const vite=await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await vite.listen();
const childUrl=vite.resolvedUrls?.local?.[0];assert(childUrl,'Vite URL unavailable');
const parent=createHttpServer((_request,response)=>{response.setHeader('content-type','text/html; charset=utf-8');response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);});
await new Promise(resolve=>parent.listen(0,'127.0.0.1',resolve));
const address=parent.address();assert(address && typeof address!=='string');
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
      const game=embedding==='direct'?page.locator('aero-game'):page.frameLocator('#game').locator('aero-game');await game.waitFor();
      if(embedding!=='direct')assert.notEqual(new URL(parentUrl).origin,new URL(childUrl).origin);
      const result=await game.evaluate(async element=>{
        const {installScoredPlayHarness}=await import('/scripts/fixtures/scored-play-browser-harness.js');
        const cases=[
          {id:'standard-front',left:5,right:6,sourcePair:[5,6],at:6000,path:'front',hit:true},
          {id:'former-reversed-front',left:5,right:6,sourcePair:[6,5],at:10000,path:'front',hit:true},
          {id:'standard-back',left:5,right:6,sourcePair:[5,6],at:14000,path:'back',hit:true},
          {id:'former-reversed-back',left:5,right:6,sourcePair:[6,5],at:18000,path:'back',hit:true},
          {id:'standard-side',left:5,right:6,sourcePair:[5,6],at:22000,path:'side',hit:true},
          {id:'former-reversed-side',left:5,right:6,sourcePair:[6,5],at:26000,path:'side',hit:true},
          {id:'one-hand-only',left:5,right:6,sourcePair:[5,6],at:30000,path:'one-hand',hit:false},
          {id:'near-miss',left:5,right:6,sourcePair:[5,6],at:34000,path:'near',hit:false},
          {id:'swapped-wrists',left:5,right:6,sourcePair:[6,5],at:36000,path:'swapped',hit:false},
          {id:'former-reversed-late-inside-window',left:5,right:6,sourcePair:[6,5],at:40000,path:'back-late',hit:true},
          {id:'off-time',left:5,right:6,sourcePair:[5,6],at:42000,path:'late',hit:false},
          {id:'settling-tail',left:5,right:6,sourcePair:[5,6],at:46000,path:'near',hit:false}, // Keeps Play active after off-time miss.
        ];
        const events=cases.map(row=>({schema:'aerobeat/resolved_content_event',version:3,eventId:row.id,centerTimestampMs:row.at,sourceEventIds:[`source-${row.id}`],authoredBeat:{type:'guard',guardTarget:{leftCell:row.left,rightCell:row.right,sourcePair:row.sourcePair}}}));
        for(const event of events){const target=event.authoredBeat.guardTarget;if(target.leftCell%4!==1||target.rightCell%4!==2||target.leftCell>=target.rightCell||Object.hasOwn(target,'crossed')||Object.hasOwn(event.authoredBeat,'modifier'))throw Error(`${event.eventId}: scored Play fixture must contain only same-side guards without a crossing type/modifier/flag`);}
        const harness=await installScoredPlayHarness(element,{events,songDurationMs:49000});
        await harness.waitForAssets();await harness.selectChart();
        await harness.setSetup({noseMarkerVisible:false});
        // The representative package lacks private Beat Saber timing metadata.
        // Explicit native Game Setup spawn override supplies legitimate render
        // timing; the same selected Play content/scoring remains authoritative.
        for(const [name,value] of [['spawnDistanceOverrideEnabled',true],['spawnDistanceOverrideWorldUnits',20]]){
          const input=harness.element.shadowRoot.querySelector(`[data-game-setup-field='${name}']`);
          if(!(input instanceof HTMLInputElement))throw Error(`Native spawn override ${name} unavailable`);
          if(input.type==='checkbox'){if(input.checked!==value)input.click();}
          else{input.focus();input.value=String(value);input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();}
          await harness.element.lifecycleIntentTail;
        }
        if(!harness.element.desiredGameSetup.spawnDistanceOverride.enabled||harness.element.desiredGameSetup.spawnDistanceOverride.normalSpawnDistanceWorldUnits!==20)throw Error('Native representative spawn override failed to persist');
        if(harness.element.desiredGameSetup.guardCountMode!=='collision')throw Error('Representative guard test requires the production default collision counting mode');
        await harness.startPlay();await harness.calibrate();
        const game=harness.element,renderer=harness.graph.renderer;
        renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:'solid',colors:['#071426'],angleDeg:180});
        const canvas=game.shadowRoot.querySelector("canvas[data-role='renderer']");
        const sample=()=>{const before=renderer.describe().frameCount,gameplay=harness.graph.gameplay.getSnapshot();renderer.manualTick();if(renderer.describe().frameCount!==before||harness.graph.gameplay.getSnapshot()!==gameplay)throw Error('Framebuffer repaint must not advance renderer/gameplay');const s=new OffscreenCanvas(canvas.width,canvas.height),c=s.getContext('2d',{willReadFrequently:true});c.drawImage(canvas,0,0);const data=c.getImageData(0,0,canvas.width,canvas.height).data;let opaque=0,nonblack=0;for(let i=0;i<data.length;i+=4){if(data[i+3]===255)opaque++;if(data[i]||data[i+1]||data[i+2])nonblack++;}if(opaque!==canvas.width*canvas.height||nonblack===0)throw Error(`Guard Play framebuffer blank/transparent: ${JSON.stringify({opaque,nonblack,width:canvas.width,height:canvas.height})}`);return data;};
        const patch=(full,base,x,y,r=30)=>{let count=0;for(let iy=Math.max(0,Math.floor(y-r));iy<Math.min(canvas.height,Math.ceil(y+r));iy++)for(let ix=Math.max(0,Math.floor(x-r));ix<Math.min(canvas.width,Math.ceil(x+r));ix++){const i=(iy*canvas.width+ix)*4;if(Math.abs(full[i]-base[i])+Math.abs(full[i+1]-base[i+1])+Math.abs(full[i+2]-base[i+2])>=30)count++;}return count;};
        const project=point=>renderer.cameraEntity.camera.worldToScreen({x:point.x,y:point.y,z:point.z});
        const wrist=(cell,dx=0,dy=0)=>{const judgeX=cell%4+dx,judgeY=1+dy,bounds=harness.graph.input.getSnapshot().calibration.bounds;const normalizedX=(judgeX+.5)/4,normalizedY=(2.5-judgeY)/3;return{x:1-(bounds.left+normalizedX*(bounds.right-bounds.left)),y:bounds.top+normalizedY*(bounds.bottom-bounds.top)};};
        const pose=(left,right,tag)=>{const priorSequence=harness.element.latestPoseTimestampMs,result=harness.feedPose({leftWrist:left,rightWrist:right,nose:{x:.5,y:.2}}),input=harness.graph.input.getSnapshot(),evidence=input.latestEvidence;if(evidence?.provenance!=='measured'||!(evidence.measurementTimestampMs>priorSequence)||evidence.measurementTimestampMs!==harness.element.latestPoseTimestampMs||input.tracking.gameplayPaused||input.tracking.freshCalibrationRequired||harness.graph.gameplay.getSnapshot().session.purpose!=='play')throw Error(`${tag}: production CV frame was not accepted as fresh measured Play evidence: ${JSON.stringify({priorSequence,latestPoseTimestampMs:harness.element.latestPoseTimestampMs,measurementTimestampMs:evidence?.measurementTimestampMs,provenance:evidence?.provenance,tracking:input.tracking,session:harness.graph.gameplay.getSnapshot().session})}`);return result;};
        // The fixture advances only its mocked audio transport; each subsequent
        // CV-measured display frame advances the REAL connected Play graph.
        const moveAt=async(ms,left,right,tag)=>{await harness.seekSong(ms);return pose(left,right,tag);};
        const rows=[];
        for(const row of cases){
          if(row.id==='settling-tail')break; // Selection contains a later event so the off-time MISS does not end Play.
          const left=wrist(row.left),right=wrist(row.right),outLeft=wrist(row.left,0,.85),outRight=wrist(row.right,0,.85);
          const nearLeft=wrist(row.left,row.left%4===3?.98:-.98,0),nearRight=wrist(row.right,row.right%4===3?.98:-.98,0);
          const sideL=wrist(row.left,row.left%4===0?.85:-.85,0),sideR=wrist(row.right,row.right%4===0?.85:-.85,0);
          const startL=row.path==='side'?sideL:row.path==='near'?nearLeft:row.path==='back'||row.path==='back-late'?wrist(row.left,0,-.85):outLeft;
          const startR=row.path==='side'?sideR:row.path==='near'?nearRight:row.path==='back'||row.path==='back-late'?wrist(row.right,0,-.85):outRight;
          const endL=row.path==='near'?nearLeft:row.path==='swapped'?right:left,endR=row.path==='near'?nearRight:row.path==='one-hand'?outRight:row.path==='swapped'?left:right;
          const beforeTimeline=harness.graph.gameplay.getSnapshot().session.timelinePositionMs,beforeWall=harness.graph.gameplay.getSnapshot().session.timestampMs;
          await moveAt(row.at-900,startL,startR,`${row.id} approach`);
          await moveAt(row.at-350,startL,startR,`${row.id} shield capture`);
          const scene=renderer.lastModel;
          const guards=scene.objects.filter(object=>object.kind==='icon'&&object.targetId===row.id);
          if(guards.length!==2||guards.some(object=>object.assetId!=='guard/outlined-shield-v1'))throw Error(`${row.id}: two real pinned shield GLBs required at scored approach, got ${guards.length}; session=${JSON.stringify(harness.graph.gameplay.getSnapshot().session)}, judgement=${JSON.stringify(harness.graph.gameplay.getSnapshot().judgements.find(j=>j.eventId===row.id)??null)}, frame=${JSON.stringify({nowMs:game.rendererFrame().nowMs,targets:game.rendererFrame().targets.map(t=>[t.id,t.kind,t.judgement,t.cells])})}, objects=${JSON.stringify(scene.objects.filter(o=>o.kind==='icon').map(o=>[o.targetId,o.assetId]))}`);
          if(renderer.describe().equipment.instanceCount!==2||renderer.describe().equipment.assetMode!=='glb')throw Error(`${row.id}: two real pinned glove GLBs required in the same frame: ${JSON.stringify(renderer.describe().equipment)}`);
          const full=sample(),frame=game.rendererFrame(),equipment=game.currentEquipmentPoses;
          if(guards[0].role!=='left'||guards[0].position.x!==row.left%4-1.5||guards[1].role!=='right'||guards[1].position.x!==row.right%4-1.5||!(guards[0].position.x<0&&guards[1].position.x>0&&guards[0].position.x<guards[1].position.x))throw Error(`${row.id}: player-side guard hand-role color/cell mismatch in the actual GLB frame: ${JSON.stringify(guards.map(g=>[g.role,g.position.x]))}`);
          // Pixel-only readback controls: temporarily remove each layer from the
          // same exact production frame and restore via the real display loop.
          renderer.renderGameplayFrameWithCursorsAndEquipment({...frame,targets:frame.targets.filter(target=>target.id!==row.id)},[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32},equipment,{grid:{x:0,y:0,width:1,height:1}});
          const noGuard=sample();
          renderer.renderGameplayFrameWithCursorsAndEquipment(frame,[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32},[],{grid:{x:0,y:0,width:1,height:1}});
          const noGlove=sample();
          const guardPixels=guards.map(icon=>{const p=project(icon.position);return patch(full,noGuard,p.x,p.y);});
          const chroma=guards.map((icon,index)=>{const p=project(icon.position);let red=0,green=0,blue=0,count=0;for(let y=Math.max(0,Math.floor(p.y-23));y<Math.min(canvas.height,Math.ceil(p.y+23));y++)for(let x=Math.max(0,Math.floor(p.x-23));x<Math.min(canvas.width,Math.ceil(p.x+23));x++){const i=(y*canvas.width+x)*4;if(Math.abs(full[i]-noGuard[i])+Math.abs(full[i+1]-noGuard[i+1])+Math.abs(full[i+2]-noGuard[i+2])<30)continue;const r=full[i],g=full[i+1],b=full[i+2],luma=.2126*r+.7152*g+.0722*b;if(luma<55||luma>170)continue;red+=r;green+=g;blue+=b;count++;}if(count<150)throw Error(`${row.id}: shield role ${icon.role} GLB tint core too small (${count})`);const mean={r:red/count,g:green/count,b:blue/count};if(icon.role==='left'&&!(mean.b>mean.g+55&&mean.b>mean.r+100)||icon.role==='right'&&!(mean.g>mean.r+60&&mean.g>mean.b+20))throw Error(`${row.id}: authored ${icon.role} shield GLB color swapped; sample ${JSON.stringify({index,mean,count})}`);return{count,r:Math.round(mean.r),g:Math.round(mean.g),b:Math.round(mean.b)};});
          const glovePixels=equipment.map(glove=>{const p=project({x:glove.anchor.x-1.5,y:glove.anchor.y,z:glove.anchor.z});return patch(full,noGlove,p.x,p.y);});
          const overlapPixels=(withBoth,guardBase,gloveBase)=>{let n=0;for(let p=0;p<withBoth.length;p+=4){const shield=Math.abs(withBoth[p]-guardBase[p])+Math.abs(withBoth[p+1]-guardBase[p+1])+Math.abs(withBoth[p+2]-guardBase[p+2])>=30;const glove=Math.abs(withBoth[p]-gloveBase[p])+Math.abs(withBoth[p+1]-gloveBase[p+1])+Math.abs(withBoth[p+2]-gloveBase[p+2])>=30;if(shield&&glove)n++;}return n;};
          const overlapApproach=overlapPixels(full,noGuard,noGlove);
          if(guardPixels.some(n=>n<100)||glovePixels.length!==2||glovePixels.some(n=>n<50))throw Error(`${row.id}: scored-frame shield/glove pixels absent: ${JSON.stringify({guardPixels,glovePixels})}`);
          const before=harness.graph.gameplay.getSnapshot(),score=s=>s.scorePartitions.reduce((sum,part)=>sum+Number(part.score??0),0);
          const preScore=score(before);
          if(row.path==='late'){await moveAt(row.at+600,startL,startR,`${row.id} late out`);await moveAt(row.at+1200,endL,endR,`${row.id} late crossing`);}
          else{await moveAt(row.path==='back-late'?row.at+175:row.at+80,endL,endR,`${row.id} contact`);}
          const contact=harness.graph.gameplay.getSnapshot(),contactInput=harness.graph.input.getSnapshot(),contactEvidence=contactInput.latestEvidence,contactJudgement=contact.judgements.find(j=>j.eventId===row.id),contactModel=renderer.lastModel;let overlapContact=null,contactOcclusion=null,pixelOverlapByHand=null;
          if(contactEvidence?.provenance!=='measured'||contactEvidence.measurementTimestampMs!==game.latestPoseTimestampMs||contactInput.tracking.gameplayPaused||contactInput.tracking.freshCalibrationRequired)throw Error(`${row.id}: scored guard contact requires fresh camera/CV-seam measured input, not direct input or frozen evidence: ${JSON.stringify({evidence:contactEvidence?.provenance,timestamp:contactEvidence?.measurementTimestampMs,cvTimestamp:game.latestPoseTimestampMs,tracking:contactInput.tracking})}`);
          if(row.hit&&contactJudgement?.result!=='hit'&&contact.session.timelinePositionMs>row.at+180)throw Error(`${row.id}: scored contact already expired before a hit: ${JSON.stringify({contactJudgement,session:contact.session,evidence:harness.graph.input.getSnapshot().latestEvidence?.measurementTimestampMs,poses:game.currentEquipmentPoses.map(p=>[p.role,p.anchor])})}`);
          if(row.hit){
            const target=contactModel.objects.filter(object=>object.kind==='icon'&&object.targetId===row.id);
            if(target.length!==2||renderer.describe().equipment.assetMode!=='glb')throw Error(`${row.id}: scored contact frame lost actual shield/glove GLBs before their hit removal window: ${JSON.stringify({target:target.length,equipment:renderer.describe().equipment})}`);
            const contactFrame=game.rendererFrame(),equipmentAtContact=game.currentEquipmentPoses,contactFull=sample();
            renderer.renderGameplayFrameWithCursorsAndEquipment({...contactFrame,targets:contactFrame.targets.filter(t=>t.id!==row.id)},[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32},equipmentAtContact,{grid:{x:0,y:0,width:1,height:1}});
            const contactNoGuard=sample();
            renderer.renderGameplayFrameWithCursorsAndEquipment(contactFrame,[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32},[],{grid:{x:0,y:0,width:1,height:1}});
            const contactNoGlove=sample();
            renderer.renderGameplayFrameWithCursorsAndEquipment({...contactFrame,targets:contactFrame.targets.filter(t=>t.id!==row.id)},[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32},[],{grid:{x:0,y:0,width:1,height:1}});
            const contactNeither=sample();
            overlapContact=overlapPixels(contactFull,contactNoGuard,contactNoGlove);
            const nearPlaneOcclusion=target.map((icon,i)=>{const p=project(icon.position),guardContribution=patch(contactNoGlove,contactNeither,p.x,p.y),gloveContribution=patch(contactNoGuard,contactNeither,p.x,p.y),fullVsNoGlove=patch(contactFull,contactNoGlove,p.x,p.y),fullVsNoGuard=patch(contactFull,contactNoGuard,p.x,p.y);if(guardContribution<50||gloveContribution<50||Math.max(fullVsNoGlove,fullVsNoGuard)<50)throw Error(`${row.id}: scored frame shield ${i} and its glove must occupy the same projected GLB pixel region: ${JSON.stringify({guardContribution,gloveContribution,fullVsNoGlove,fullVsNoGuard})}`);return{guardContribution,gloveContribution,fullVsNoGlove,fullVsNoGuard};});contactOcclusion=nearPlaneOcclusion;
            // Per-role pixel intersection in the exact scored frame: each GLB
            // is isolated against the identical scene-with-neither baseline.
            // This does not mistake the fully depth-occluded complete frame for
            // "no glove". It requires ≥60 truly shared shield/glove pixels
            // separately for BOTH authored hands, not just nearby models.
            pixelOverlapByHand=target.map((icon,index)=>{const p=project(icon.position),r=38;let intersect=0,guardOnly=0,gloveOnly=0;for(let y=Math.max(0,Math.floor(p.y-r));y<Math.min(canvas.height,Math.ceil(p.y+r));y++)for(let x=Math.max(0,Math.floor(p.x-r));x<Math.min(canvas.width,Math.ceil(p.x+r));x++){const offset=(y*canvas.width+x)*4,g=Math.abs(contactNoGlove[offset]-contactNeither[offset])+Math.abs(contactNoGlove[offset+1]-contactNeither[offset+1])+Math.abs(contactNoGlove[offset+2]-contactNeither[offset+2])>=30,v=Math.abs(contactNoGuard[offset]-contactNeither[offset])+Math.abs(contactNoGuard[offset+1]-contactNeither[offset+1])+Math.abs(contactNoGuard[offset+2]-contactNeither[offset+2])>=30;if(g)guardOnly++;if(v)gloveOnly++;if(g&&v)intersect++;}if(intersect<60)throw Error(`${row.id}: ${icon.role} glove does not spatially overlap its authored guard GLB at contact: ${JSON.stringify({index,intersect,guardOnly,gloveOnly,role:icon.role})}`);return intersect;});
            if(pixelOverlapByHand.length!==2)throw Error(`${row.id}: both authored guard contact pixel intersections required`);
            const gloveByRole=new Map(equipmentAtContact.map(entry=>[entry.role.replace('_wrist',''),entry]));
            for(const [i,icon] of target.entries()){
              const glove=gloveByRole.get(icon.role),expectedX=icon.position.x+1.5;
              if(!glove||Math.abs(glove.anchor.x-expectedX)>.06||Math.abs(glove.anchor.y-icon.position.y)>.06)throw Error(`${row.id}: ${icon.role} glove's real 3D pose must enter its AUTHORED visible guard GLB (never the opposite player hand): ${JSON.stringify({i,icon:icon.position,glove:glove?.anchor??null})}`);
              const guardScreen=project(icon.position),gloveScreen=project({x:glove.anchor.x-1.5,y:glove.anchor.y,z:glove.anchor.z});
              if(Math.hypot(guardScreen.x-gloveScreen.x,guardScreen.y-gloveScreen.y)>45)throw Error(`${row.id}: ${icon.role} guard/glove projected center diverged at contact: ${JSON.stringify({guardScreen,gloveScreen})}`);
            }
            const coloredContact=target.map(icon=>patch(contactFull,contactNoGuard,project(icon.position).x,project(icon.position).y));
            const gloveContact=equipmentAtContact.map(glove=>patch(contactFull,contactNoGlove,project({x:glove.anchor.x-1.5,y:glove.anchor.y,z:glove.anchor.z}).x,project({x:glove.anchor.x-1.5,y:glove.anchor.y,z:glove.anchor.z}).y));
            if(coloredContact.some(n=>n<50)||gloveContact.length!==2)throw Error(`${row.id}: scored-frame GLB shield pixel coverage missing: ${JSON.stringify({coloredContact,gloveContact,nearPlaneOcclusion})}`);
          }
          if(row.path!=='late'&&row.hit&&!contactJudgement&&row.path!=='back-late'){
            await moveAt(row.at+140,endL,endR,`${row.id} second in-window contact`);
            const delayed=harness.graph.gameplay.getSnapshot().judgements.find(j=>j.eventId===row.id);
            if(delayed?.result!=='hit')throw Error(`${row.id}: actual in-window guard/glove motion did not score: ${JSON.stringify(delayed??null)}`);
          }
          if(row.path!=='late'&&row.hit)await moveAt(row.at+450,endL,endR,`${row.id} settled`);
          if(!row.hit&&row.path!=='late'){
            const negativeFrame=game.rendererFrame(),negativeEquipment=game.currentEquipmentPoses,negativeFull=sample(),negativeTarget=negativeFrame.targets.filter(t=>t.id!==row.id);
            renderer.renderGameplayFrameWithCursorsAndEquipment({...negativeFrame,targets:negativeTarget},[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32},negativeEquipment,{grid:{x:0,y:0,width:1,height:1}});
            const negativeNoGuard=sample();
            renderer.renderGameplayFrameWithCursorsAndEquipment(negativeFrame,[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32},[],{grid:{x:0,y:0,width:1,height:1}});
            const negativeNoGlove=sample();
            const negativeOverlap=overlapPixels(negativeFull,negativeNoGuard,negativeNoGlove);
            if(row.path==='one-hand'){
              // The near-plane GLB glove may be fully occluded by the shield at
              // physical contact. Guard-removed minus complete-frame pixels
              // then proves the one-hand overlap rather than requiring both
              // objects to contribute their own final depth-buffer pixel.
              const occluded=negativeEquipment.map(p=>{const q=project({x:p.anchor.x-1.5,y:p.anchor.y,z:0});return patch(negativeNoGuard,negativeFull,q.x,q.y);});
              if(negativeOverlap<10&&occluded[0]<10)throw Error(`${row.id}: one glove must visibly contact/occlude its shield without a two-hand score: ${JSON.stringify({negativeOverlap,occluded})}`);
            }
            if(row.path==='near'&&negativeOverlap>50)throw Error(`${row.id}: near-miss glove/shield pixels should remain separated (${negativeOverlap} overlapping pixels)`);
          }
          const after=harness.graph.gameplay.getSnapshot(),judgement=after.judgements.find(j=>j.eventId===row.id),delta=score(after)-preScore;
          if(!(after.session.timelinePositionMs>beforeTimeline&&after.session.timestampMs>beforeWall))throw Error(`${row.id}: production Play song-time/wall-clock must advance strictly: ${JSON.stringify({beforeTimeline,beforeWall,afterTimeline:after.session.timelinePositionMs,afterWall:after.session.timestampMs})}`);
          if(row.hit&&(!judgement||judgement.result!=='hit'||delta<=0))throw Error(`${row.id}: ${row.path} shield/glove contact must score a real Play HIT; judgement=${JSON.stringify(judgement??null)}, scoreDelta=${delta}, session=${JSON.stringify(after.session)}, input=${JSON.stringify({calibration:harness.graph.input.getSnapshot().calibration,tracking:harness.graph.input.getSnapshot().tracking,evidence:harness.graph.input.getSnapshot().latestEvidence?.measurementTimestampMs})}, equipment=${JSON.stringify(game.currentEquipmentPoses.map(p=>[p.role,p.anchor]))}, otherJudgements=${JSON.stringify(after.judgements.map(j=>[j.eventId,j.result]))}`);
          if(!row.hit&&(judgement?.result==='hit'||delta>0))throw Error(`${row.id}: ${row.path} negative falsely scored: judgement=${JSON.stringify(judgement??null)}, scoreDelta=${delta}`);
          if(row.path==='swapped'){
            const swappedEvidence=contactEvidence?.anchors??[];
            const leftWrist=swappedEvidence.find(anchor=>anchor.anchor==='left_wrist'),rightWrist=swappedEvidence.find(anchor=>anchor.anchor==='right_wrist');
            if(!leftWrist||!rightWrist||leftWrist.cell!==row.right||rightWrist.cell!==row.left)throw Error(`${row.id}: actual fresh measured evidence must swap BOTH wrist cells, not merely omit input: ${JSON.stringify(swappedEvidence.map(anchor=>[anchor.anchor,anchor.cell]))}`);
            if(judgement?.result==='hit'||delta!==0)throw Error(`${row.id}: opposite named wrist cells must not score during the active guard window: ${JSON.stringify({judgement:judgement??null,delta})}`);
            // The +80-ms contact frame is inside the guard window. This
            // synthetic event has no checkpoint override, so the authoritative
            // miss deadline is the configured 180 ms times the Boxing collider's
            // backward depth (3 by default). Keep fresh swapped wrists until
            // real Play passes that deadline.
            const checkpointWindowMs=Number(events.find(entry=>entry.eventId===row.id)?.authoredBeat?.checkpoint?.timingWindowMs);
            const deadlineMs=row.at+(Number.isFinite(checkpointWindowMs)&&checkpointWindowMs>0?checkpointWindowMs:180*Number(game.desiredGameSetup.boxingColliderVolume.colliderDepthBackward));
            await moveAt(deadlineMs+100,endL,endR,`${row.id} after guard miss deadline`);
            const expired=harness.graph.gameplay.getSnapshot(),miss=expired.judgements.find(entry=>entry.eventId===row.id),expiredScore=score(expired)-preScore;
            if(!(expired.session.timelinePositionMs>deadlineMs))throw Error(`${row.id}: fixture did not pass guard deadline: ${JSON.stringify({deadlineMs,timelinePositionMs:expired.session.timelinePositionMs})}`);
            const expiredEvidence=harness.graph.input.getSnapshot().latestEvidence,expiredLeft=expiredEvidence?.anchors.find(anchor=>anchor.anchor==='left_wrist'),expiredRight=expiredEvidence?.anchors.find(anchor=>anchor.anchor==='right_wrist');
            if(expiredEvidence?.provenance!=='measured'||expiredEvidence.measurementTimestampMs!==game.latestPoseTimestampMs||expiredLeft?.cell!==row.right||expiredRight?.cell!==row.left)throw Error(`${row.id}: post-deadline Play frame must still contain fresh opposite named wrists: ${JSON.stringify({timestamp:expiredEvidence?.measurementTimestampMs,left:expiredLeft?.cell,right:expiredRight?.cell})}`);
            if(miss?.result!=='miss'||expiredScore!==0)throw Error(`${row.id}: role-swapped gloves at a same-side guard must commit an authoritative MISS with zero score after deadline: ${JSON.stringify({miss:miss??null,expiredScore,deadlineMs,timelinePositionMs:expired.session.timelinePositionMs,backwardDepth:game.desiredGameSetup.boxingColliderVolume.colliderDepthBackward})}`);
            rows.push({id:row.id,cells:[row.left,row.right],path:row.path,guardPixels,glovePixels,chroma,overlapApproach,overlapContact,contactOcclusion,pixelOverlapByHand,result:miss.result,scoreDelta:expiredScore});
            continue;
          }
          if(row.id==='off-time'&&judgement?.result!=='miss')throw Error(`${row.id}: contact after timing window must commit an authoritative MISS, not remain an unevaluated pending icon: ${JSON.stringify(judgement??null)}`);
          rows.push({id:row.id,cells:[row.left,row.right],path:row.path,guardPixels,glovePixels,chroma,overlapApproach,overlapContact,contactOcclusion,pixelOverlapByHand,result:judgement?.result??'pending',scoreDelta:delta});
        }
        const session=harness.graph.gameplay.getSnapshot().session;
        if(session.purpose!=='play')throw Error('Only scored Play qualifies');
        harness.dispose();
        return{rows,sessionPurpose:session.purpose};
      });
      assert.deepEqual(noise,[],`${embedding}: browser noise`);
      matrix.push({embedding,...result});
    }finally{await context.close();}
  }
  assert.equal(matrix.length,2);
  assert.deepEqual(matrix[0].rows.map(row=>[row.id,row.result,row.scoreDelta>0]),matrix[1].rows.map(row=>[row.id,row.result,row.scoreDelta>0]));
  console.log(`ORACLE scored-guard-glove-contact-pixels PASS ${JSON.stringify(matrix)}`);
}finally{await browser.close();await vite.close();await new Promise(resolve=>parent.close(resolve));}
