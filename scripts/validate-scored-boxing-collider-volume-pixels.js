// @ts-check
// Strict actual AeroGame scored Play browser oracle. No standalone renderer/score mocks.
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { build as buildFixture, createServer as createViteServer } from 'vite';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';
import { handlerForSnapshot, loadSignedSnapshot } from './serve-friend-game.js';

const signedDirectory=process.env.AEROBEAT_SIGNED_BOXER_DIR;
let browser,host,vite=null,signedServer=null,fixtureDirectory=null;
try {
  let childUrl;
  if(signedDirectory){
    const snapshot=loadSignedSnapshot(path.resolve(signedDirectory));
    assert(['0.0.132','0.0.133','0.0.134','0.0.135','0.0.136','0.0.137','0.0.138','0.0.139','0.0.140'].includes(snapshot.manifest.sourceManifest.packageVersion),'expected signed Boxer baseline or corrected successor');
    fixtureDirectory=mkdtempSync(path.join(tmpdir(),'aerobeat-signed-boxer-fixture-'));
    await buildFixture({configFile:false,root:process.cwd(),logLevel:'error',build:{outDir:fixtureDirectory,emptyOutDir:true,lib:{entry:'scripts/fixtures/scored-play-browser-harness.js',formats:['es'],fileName:()=> 'scored-play-browser-harness.js'}}});
    const fixtures=new Map(readdirSync(fixtureDirectory).filter(name=>name.endsWith('.js')).map(name=>[`/scripts/fixtures/${name}`,readFileSync(path.join(fixtureDirectory,name))]));
    const signedHandler=handlerForSnapshot(snapshot);
    signedServer=createHttpServer((request,response)=>{const fixture=fixtures.get(new URL(request.url??'/','http://fixture.invalid').pathname);if(fixture){response.setHeader('Content-Type','text/javascript; charset=utf-8');response.setHeader('Cache-Control','no-store');response.end(fixture);return;}signedHandler(request,response);});
    await new Promise(resolve=>signedServer.listen(0,'127.0.0.1',resolve));
    const address=signedServer.address();assert(address&&typeof address!=='string');childUrl=`http://127.0.0.1:${address.port}/`;
  }else{
    vite=await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
    await vite.listen();childUrl=vite.resolvedUrls?.local?.[0];
  }
  assert(childUrl,'Child game URL unavailable');
  host=createHttpServer((request,response)=>{const query=new URL(request.url??'/','http://fixture.invalid');const width=Number(query.searchParams.get('width')),height=Number(query.searchParams.get('height'));assert([390,844,1280].includes(width)&&[390,844,720].includes(height),'Invalid iframe fixture size');response.setHeader('content-type','text/html; charset=utf-8');response.end(`<!doctype html><style>html,body{margin:0}iframe{width:${width}px;height:${height}px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);});
  await new Promise(resolve=>host.listen(0,'127.0.0.1',resolve));
  const address=host.address();assert(address&&typeof address!=='string');const parentUrl=`http://127.0.0.1:${address.port}/`;
  browser=await chromium.launch();
  const contexts=[{kind:'direct',width:844,height:390},{kind:'direct',width:390,height:844},{kind:'iframe',width:390,height:844},{kind:'direct',width:1280,height:720},{kind:'iframe',width:1280,height:720}].filter(context=>!process.env.AEROBEAT_COLLIDER_CONTEXT||`${context.kind}:${context.width}x${context.height}`===process.env.AEROBEAT_COLLIDER_CONTEXT);
  assert(contexts.length,'Unknown AEROBEAT_COLLIDER_CONTEXT');
  const scenarioDefinitions=[
    {name:'off',volume:{colliderVisible:false,colliderScale:1,colliderDepthForward:1,colliderDepthBackward:0}},
    {name:'default',volume:{colliderVisible:true,colliderScale:1,colliderDepthForward:1,colliderDepthBackward:0}},
    {name:'scale',volume:{colliderVisible:true,colliderScale:4,colliderDepthForward:1,colliderDepthBackward:0}},
    {name:'scale-unbounded',volume:{colliderVisible:true,colliderScale:5,colliderDepthForward:1,colliderDepthBackward:0}},
    {name:'scale-zero',volume:{colliderVisible:true,colliderScale:0,colliderDepthForward:1,colliderDepthBackward:0}},
    {name:'forward',volume:{colliderVisible:true,colliderScale:1,colliderDepthForward:4,colliderDepthBackward:0}},
    {name:'backward',volume:{colliderVisible:true,colliderScale:1,colliderDepthForward:1,colliderDepthBackward:4}},
    {name:'unbounded-depths',volume:{colliderVisible:true,colliderScale:1,colliderDepthForward:.5,colliderDepthBackward:5}},
    {name:'default-near',volume:{colliderVisible:true,colliderScale:1,colliderDepthForward:1,colliderDepthBackward:0}},
    {name:'default-early',volume:{colliderVisible:true,colliderScale:1,colliderDepthForward:1,colliderDepthBackward:0}}
  ];
  for(const context of contexts){
    const results=[];
    for(const scenario of scenarioDefinitions.filter(item=>!process.env.AEROBEAT_COLLIDER_SCENARIO||item.name===process.env.AEROBEAT_COLLIDER_SCENARIO)){
    const page=await browser.newPage({viewport:{width:context.width,height:context.height},deviceScaleFactor:1});
    const noise=[];
    page.on('console',message=>{const type=message.type(),text=message.text(),location=message.location();if(['warning','error'].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,childUrl)&&!isExpectedPlaycanvasMeshWarning(type,text))noise.push(`${type}:${text}:${location.url}`);});
    page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));
    try{
      await page.goto(context.kind==='direct'?childUrl:`${parentUrl}?width=${context.width}&height=${context.height}`,{waitUntil:'networkidle'});
      const game=context.kind==='direct'?page.locator('aero-game'):page.frameLocator('#game').locator('aero-game');await game.waitFor();
      if(context.kind==='iframe'){
        assert.notEqual(await game.evaluate(()=>location.origin),new URL(parentUrl).origin,'Iframe must be genuinely cross-origin');
        const dimensions=await game.evaluate(element=>{const canvas=element.shadowRoot.querySelector('canvas[data-role="renderer"]');return{width:canvas?.width,height:canvas?.height,hostWidth:element.getBoundingClientRect().width,hostHeight:element.getBoundingClientRect().height};});
        assert.equal(dimensions.hostWidth,context.width,'Iframe child host width incorrect');assert.equal(dimensions.hostHeight,context.height,'Iframe child host height incorrect');
      }
      const result=await game.evaluate(async(element,scenario)=>{
        const {installScoredPlayHarness,boxingColliderTargetCenter,resolveGloveCylinder}=await import('/scripts/fixtures/scored-play-browser-harness.js');
        const events=[{schema:'aerobeat/resolved_content_event',version:3,eventId:'volume-pixel-punch',centerTimestampMs:6000,sourceEventIds:['volume-pixel-source'],authoredBeat:{type:'hook_left',spatialTarget:{targetCell:5,entryDirection:'right'}}}];
        const harness=await installScoredPlayHarness(element,{events});
        const fail=(condition,message)=>{if(!condition)throw Error(`Boxing scored Play pixels: ${message}`);};
        const box=(vertices)=>({minX:Math.min(...vertices.map(point=>point.x)),maxX:Math.max(...vertices.map(point=>point.x)),minY:Math.min(...vertices.map(point=>point.y)),maxY:Math.max(...vertices.map(point=>point.y))});
        const close=(actual,expected,tolerance=.00002)=>Number.isFinite(actual)&&Math.abs(actual-expected)<tolerance;
        const centeredCylinder=(cylinder,camera,Vec3)=>box([cylinder.start,cylinder.end].flatMap(point=>[-1,0,1].flatMap(x=>[-1,0,1].map(y=>camera.worldToScreen(new Vec3(point.x+x*cylinder.radius,point.y+y*cylinder.radius,point.z))))));
        // Analyze framebuffer deltas only around the projected LEFT overlay, away
        // from the right glove. No test passes on model geometry alone.
        const compare=(on,off,rect)=>{
          fail(on.width===off.width&&on.height===off.height,'on/off framebuffer dimensions differ');
          const left=Math.max(0,Math.floor(rect.minX)-8),right=Math.min(on.width-1,Math.ceil(rect.maxX)+8),top=Math.max(0,Math.floor(rect.minY)-8),bottom=Math.min(on.height-1,Math.ceil(rect.maxY)+8);
          let count=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
          for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
            const i=(y*on.width+x)*4,delta=Math.abs(on.pixels[i]-off.pixels[i])+Math.abs(on.pixels[i+1]-off.pixels[i+1])+Math.abs(on.pixels[i+2]-off.pixels[i+2]);
            if(delta<22)continue;
            count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
          }
          return{count,bounds:count?{minX,maxX,minY,maxY}:null,roi:{left,right,top,bottom}};
        };
        try{
          await harness.waitForAssets();await harness.selectChart();
          // The helper drives the native checkbox/number controls and treats an
          // untouched fresh default with absent storage as the legitimate
          // coordinator no-op; never synthesize an initial persisted setting.
          const outputs=[];
          {
            // Initial menu checkbox plus every native number change and blur are
            // committed by harness.setSetup through the production lifecycle FIFO.
            let saved;
            try{saved=await harness.setSetup({boxingColliderVolume:scenario.volume});}
            catch(error){const persisted=JSON.parse(localStorage.getItem('aerobeat.game-setup.v3')??'null'),current=element.desiredGameSetup,keys=[...new Set([...Object.keys(persisted??{}),...Object.keys(current??{})])];throw Error(`setup ${scenario.name}: ${String(error)}; diff=${JSON.stringify(keys.filter(key=>JSON.stringify(persisted?.[key])!==JSON.stringify(current?.[key])).map(key=>({key,persisted:persisted?.[key],current:current?.[key]})))}`);}
            fail(Object.entries(scenario.volume).every(([key,value])=>Object.is(saved.boxingColliderVolume?.[key],value)),`${scenario.name}: setup not saved from UI: ${JSON.stringify({actual:saved.boxingColliderVolume,expected:scenario.volume})}`);
            try{await harness.startPlay();await harness.calibrate();harness.element.stopFrameLoop();}
            catch(error){throw Error(`${scenario.name} fresh Start/calibration: ${String(error)}; ${JSON.stringify({session:harness.graph.gameplay.getSnapshot().session.state,camera:harness.graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState,cv:harness.graph.cv.getStatus().lifecycleState,menu:harness.element.menuOpen,active:harness.element.activeSessionAction})}`);}
            const locked=harness.element.activeSessionSetup?.boxingColliderVolume;
            fail(locked&&Object.entries(scenario.volume).every(([key,value])=>Object.is(locked[key],value)),`${scenario.name}: run-locked setup differs from saved: ${JSON.stringify({locked,expected:scenario.volume})}`);
            const renderer=harness.graph.renderer;
            renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:'solid',colors:['#071426'],angleDeg:180});
            const defaultPose={leftWrist:{x:.5,y:.45},rightWrist:{x:.5,y:.45},nose:{x:.5,y:.2}};
            // Near-absent approaching note still shares the exact authored chart.
            // Hold two consecutive fresh measured poses so gameplay and rendered
            // equipment derive from the same wrist identity/position.
            await harness.seekSong(5000);
            harness.feedPose(defaultPose);harness.feedPose(defaultPose);
            const preCaptureStatus=renderer.describe();
            fail(!preCaptureStatus.errorMessage,`${scenario.name}: production renderer error before capture: ${JSON.stringify({state:preCaptureStatus.state,error:preCaptureStatus.errorMessage,session:harness.graph.gameplay.getSnapshot().session.state})}`);
            const capture=harness.capture();
            // A real Play preview must name the locked scored-cylinder setting:
            // the rear Z face projects onto itself in landscape even when the
            // framebuffer is valid and its value really reaches the renderer.
            const chip=element.shadowRoot.querySelector('[data-role="collider-preview-chip"]');
            const shown=chip instanceof HTMLElement&&!chip.hidden;
            fail(scenario.volume.colliderVisible?shown:!shown,`${scenario.name}: run-locked wrist preview missing or shown while OFF in scored Play`);
            let preview={shown,text:'',bounds:null};
            if(shown){
              const text=chip.textContent??'',rect=chip.getBoundingClientRect(),host=element.getBoundingClientRect(),style=getComputedStyle(chip),color=style.backgroundColor.match(/[\d.]+/g)?.map(Number)??[];
              fail(text.includes('Scored glove cylinder')&&text.includes(`scale ×${locked.colliderScale}`)&&text.includes(`front ×${locked.colliderDepthForward}`)&&text.includes(`rear ×${locked.colliderDepthBackward}`),`${scenario.name}: Play preview does not identify all run-locked glove dimensions: ${text}`);
              fail(rect.width>=120&&rect.height>=25&&rect.left>=host.left&&rect.right<=host.right&&rect.top>=host.top&&rect.bottom<=host.bottom&&Number.parseFloat(style.fontSize)>=14&&color.length>=4&&color[3]>=.8,`${scenario.name}: Play preview is clipped or unreadably faint: ${JSON.stringify({rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},host:{x:host.x,y:host.y,width:host.width,height:host.height},font:style.fontSize,background:style.backgroundColor})}`);
              fail(rect.bottom<host.top+host.height*.42,`${scenario.name}: preview obscures center glove/target region`);
              preview={shown,text,bounds:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
            }
            // Scored Play and Show must use the same resolved glove pose.
            const frame=harness.element.rendererFrame(),poses=harness.element.currentEquipmentPoses;
            const glove=poses?.find(pose=>pose.role==='left_wrist'&&pose.mode==='boxing');
            fail(glove&&poses.length===2,`${scenario.name}: real resolved glove poses absent from production frame`);
            frame.equipmentColliderPoses=poses;
            fail(frame.presentation==='boxing_collider'&&capture.session.state==='playing'&&capture.session.purpose==='play',`${scenario.name}: not selected scored Boxing Play`);
            fail(frame.colliderSettings&&Object.entries(scenario.volume).every(([key,value])=>Object.is(frame.colliderSettings[key],value)),`${scenario.name}: run settings not sent to renderer`);
            const scene=renderer.lastModel,left=scene?.objects.find(object=>object.id==='equipment-collider-volume-left');
            fail(Boolean(left)===(scenario.volume.colliderVisible&&scenario.volume.colliderScale>0),`${scenario.name}: model overlay presence disagrees with Show and nonzero Scale`);
            const wire=renderer.boxingColliderWirePool?.[0],fill=renderer.boxingColliderCylinderPool?.find(entity=>entity.enabled&&entity.name==='equipment-collider-volume-left');
            const wireMaterial=wire?.render?.meshInstances?.[0]?.material,wirePrimitive=wire?.render?.meshInstances?.[0]?.mesh?.primitive?.[0];
            const layer=renderer.gameplayColliderOverlayLayer,world=renderer.app.scene.layers.getLayerById(0),layers=renderer.app.scene.layers;
            fail(left?left.shape==='cylinder'&&fill?.render?.enabled!==false&&wire?.enabled&&wirePrimitive?.type===1&&wirePrimitive.count>=96&&wireMaterial?.opacity>=.75&&wireMaterial?.emissive.r<.05&&fill.render.layers.includes(layer.id)&&wire.render.layers.includes(layer.id)&&layers.getTransparentIndex(layer)<layers.getTransparentIndex(world):!wire?.enabled&&!fill?.enabled,`${scenario.name}: flat-ended cylinder fill and charcoal polygon rim must share pre-World layer behind beats ${JSON.stringify({shape:left?.shape,fill:fill?.enabled,wire:wire?.enabled,primitive:wirePrimitive?.type,count:wirePrimitive?.count,opacity:wireMaterial?.opacity,layer:layer?.id,worldIndex:layers.getTransparentIndex(world),overlayIndex:layers.getTransparentIndex(layer),fillLayers:fill?.render?.layers,wireLayers:wire?.render?.layers})}`);
            if(left){
              const scoredCylinder=resolveGloveCylinder(glove,{scale:locked.colliderScale,depthForward:locked.colliderDepthForward,depthBackward:locked.colliderDepthBackward});
              fail(close(left.capsule.radius,scoredCylinder.radius),`${scenario.name}: Show radius differs from shared scored cylinder`);
              for(const endpoint of ['start','end'])for(const axis of ['x','y','z'])fail(close(left.capsule[endpoint][axis],scoredCylinder[endpoint][axis]-(axis==='x'?1.5:0)),`${scenario.name}: Show ${endpoint}.${axis} differs from shared scored cylinder`);
              for(const axis of ['x','y','z']){
                fail(close(wire.getPosition()[axis],left.position[axis])&&close(fill.getPosition()[axis],left.position[axis])&&close(wire.getLocalScale()[axis],left.scale[axis])&&close(fill.getLocalScale()[axis],left.scale[axis]),`${scenario.name}: cylinder fill/wire diverged from scored ${axis} ${JSON.stringify({wirePosition:wire.getPosition()[axis],fillPosition:fill.getPosition()[axis],wireScale:wire.getLocalScale()[axis],fillScale:fill.getLocalScale()[axis],expectedPosition:left.position[axis],expectedScale:left.scale[axis]})}`);
                fail(close(wire.getRotation()[axis],glove.orientation[axis])&&close(fill.getRotation()[axis],glove.orientation[axis]),`${scenario.name}: fill/outline lost the final glove quaternion ${axis}`);
              }
              fail(close(left.scale.x,left.capsule.radius*2)&&close(left.scale.y,left.capsule.radius*2)&&close(left.scale.z,Math.hypot(...['x','y','z'].map(axis=>left.capsule.end[axis]-left.capsule.start[axis]))),`${scenario.name}: mesh diameter/reach differs from its modeled flat-ended cylinder`);
              if(scenario.name==='default')fail(close(left.capsule.radius,.34*glove.scale)&&close(left.scale.z,.68*glove.scale),`${scenario.name}: Scale1 +1/−0 glove silhouette diameter/reach differs from source glove geometry`);
            }
            const equipment=renderer.describe().equipment;
            fail(equipment?.instanceCount===2&&equipment.assetMode==='glb',`${scenario.name}: both foreground gloves must be actual GLBs: ${JSON.stringify(equipment)}`);
            const glovePixels=harness.assertGlovePixels();
            fail(glovePixels.changed>=100&&glovePixels.strongest>=48,`${scenario.name}: pinned glove model contributes no actual framebuffer pixels`);
            // The helper restores its previous background/equipment after the
            // GLB-only control; return to the same solid camera world for the
            // on/off collider subtraction (no gameplay tick is fabricated).
            renderer.setEnvironmentVisible(false);renderer.setBackgroundProjection({kind:'solid',colors:['#071426'],angleDeg:180});
            const camera=renderer.cameraEntity?.camera,Vec3=renderer.cameraEntity?.getPosition()?.constructor;
            fail(camera&&Vec3,`${scenario.name}: active PlayCanvas camera unavailable`);
            const projection=left?centeredCylinder(left.capsule,camera,Vec3):null;
            // Paired render-only subtraction: the VERY SAME production Play frame,
            // frozen equipment and world, with visibility off solely for the
            // second renderer draw. This is NOT a second Play setup or judgement.
            const offFrame={...frame,colliderSettings:{...frame.colliderSettings,colliderVisible:false}};
            const cursorOptions={grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32,noseMarkerVisible:frame.noseMarkerVisible,noseMarkerScale:frame.noseMarkerScale};
            const nose=harness.graph.input.getSnapshot().anchors?.find(item=>item.anchor==='nose');
            const cursors=nose?.valid&&frame.noseMarkerVisible?[{role:'nose',x:nose.x,y:nose.y,confidence:nose.confidence}]:[];
            const equipmentPoses=harness.element.currentEquipmentPoses;
            fail(equipmentPoses?.length===2,`${scenario.name}: real resolved glove poses absent from production frame`);
            renderer.renderGameplayFrameWithCursorsAndEquipment(offFrame,cursors,cursorOptions,equipmentPoses,{grid:{x:0,y:0,width:1,height:1}});
            const offCapture=harness.capture();
            fail(renderer.lastModel?.objects.every(object=>object.kind!=='collider_volume'),`${scenario.name}: render-only baseline still includes collider overlay`);
            fail(Math.abs(offCapture.session.timelinePositionMs-capture.session.timelinePositionMs)<30,`${scenario.name}: paired render baseline drifted in song time`);
            renderer.renderGameplayFrameWithCursorsAndEquipment(frame,cursors,cursorOptions,equipmentPoses,{grid:{x:0,y:0,width:1,height:1}});
            const again=harness.capture();
            fail(Math.abs(again.session.timelinePositionMs-capture.session.timelinePositionMs)<60,`${scenario.name}: paired ON restoration drifted in song time`);
            const paired=projection?compare(again,offCapture,projection):{count:0,bounds:null,roi:null};
            paired.rendererStatus=renderer.describe().state;paired.rendererError=renderer.describe().errorMessage;
            let opaque=0,nonblank=0;for(let i=0;i<again.pixels.length;i+=4){if(again.pixels[i+3]===255)opaque++;if(again.pixels[i]+again.pixels[i+1]+again.pixels[i+2]>42)nonblank++;}
            fail(nonblank>again.width*again.height*.05&&opaque===again.width*again.height,`${scenario.name}: blank/invalid framebuffer readback`);
            fail(paired.rendererStatus==='running'&&!paired.rendererError,`${scenario.name}: paired render failed: ${paired.rendererError}`);
            const input=harness.graph.input.getSnapshot();
            const wrist=(judgeX,judgeY)=>{const bounds=input.calibration.bounds,x=(judgeX+.5)/4,y=(2.5-judgeY)/3;return{x:1-(bounds.left+x*(bounds.right-bounds.left)),y:bounds.top+y*(bounds.bottom-bounds.top)};};
            // The same authored chart and fixed note rectangle supply the score
            // boundary. Scale changes glove radius, not target size; longer front
            // reach can meet an earlier beat plane. Visibility alone never scores.
            const target=boxingColliderTargetCenter(5,{topRowReachWU:harness.element.activeSessionSetup.topRowReachWU,bottomRowReachWU:harness.element.activeSessionSetup.bottomRowReachWU});
            const targetX=target.x,targetY=target.y;
            const scoreCases={off:{song:6000,x:targetX,y:targetY},default:{song:6000,x:targetX,y:targetY},scale:{song:6000,x:targetX+.9,y:targetY},'scale-unbounded':{song:6000,x:targetX+.9,y:targetY},'scale-zero':{song:6000,x:targetX,y:targetY},forward:{song:6000,x:targetX,y:targetY},backward:{song:6000,x:targetX,y:targetY},'unbounded-depths':{song:6000,x:targetX,y:targetY},'default-near':{song:6000,x:targetX+.9,y:targetY},'default-early':{song:5900,x:targetX,y:targetY}};
            const contact=scoreCases[scenario.name],outsideX=['scale','scale-unbounded','default-near'].includes(scenario.name)?targetX+.9:.1,safe=wrist(outsideX,['scale','scale-unbounded','default-near'].includes(scenario.name)?targetY:1.8),at=wrist(contact.x,contact.y);
            fail(Number.isFinite(contact.x)&&Number.isFinite(contact.y)&&Number.isFinite(at.x)&&Number.isFinite(at.y),`${scenario.name}: calibrated target-centred wrist missing`);
            const before=harness.graph.gameplay.getSnapshot().judgements.find(item=>item.eventId==='volume-pixel-punch')??null;
            const safeSong=Math.max(5010,contact.song-90);
            await harness.seekSong(safeSong);harness.feedPose({leftWrist:safe,rightWrist:safe,nose:{x:.5,y:.2}});
            const approachSong=contact.song-30;
            await harness.seekSong(approachSong);harness.feedPose({leftWrist:at,rightWrist:safe,nose:{x:.5,y:.2}});
            await harness.seekSong(contact.song);harness.feedPose({leftWrist:at,rightWrist:safe,nose:{x:.5,y:.2}});
            const scored=harness.graph.gameplay.getSnapshot(),judgement=scored.judgements.find(item=>item.eventId==='volume-pixel-punch')??null,partition=scored.scorePartitions.find(item=>item.rulesetId==='boxing_collider_v1')??null;
            fail(scored.session.purpose==='play'&&scored.session.state==='playing'&&scored.session.timelinePositionMs>=contact.song,`${scenario.name}: measured score frame did not advance the real Play audio clock`);
            const negative=scenario.name.startsWith('default-')||scenario.name==='scale-zero';
            fail(!before&&(negative?!judgement&&!partition?.hits:judgement?.result==='hit'&&partition?.hits===1&&partition.score>0),`${scenario.name}: measured ${negative?'near/early miss':'target hit'} boundary failed: ${JSON.stringify({before,judgement,partition,song:contact.song,targetX,targetY,contact,safe,at,timingWindowMs:harness.element.activeSessionSetup.timingWindowMs,directionRequired:harness.element.activeSessionSetup.enforceAuthoredDirection})}`);
            outputs.push({name:scenario.name,volume:locked,frame:frame.colliderSettings,pixel:paired,projection,preview,gloveDepthWu:left?.scale.z??null,glovePixels:{changed:glovePixels.changed,strongest:glovePixels.strongest},score:{result:judgement?.result??'pending',tier:judgement?.tier??null,hits:partition?.hits??0,points:partition?.score??0,contactSongMs:contact.song}});
          }
          const row=outputs[0];
          fail(['off','scale-zero'].includes(scenario.name)?row.pixel.count===0:row.projection&&row.pixel.count>100,`${scenario.name}: expected OFF-negative or visible enabled collider pixel area: ${JSON.stringify({pixel:row.pixel,projection:row.projection})}`);
          // The separate-page parent must compare tuned rows against default;
          // this payload is bounded diagnostic evidence, not raw pose/pixels.
          return {name:row.name,pixel:row.pixel,projection:row.projection,preview:row.preview,settings:row.volume,frameSettings:row.frame,gloveDepthWu:row.gloveDepthWu,glovePixels:row.glovePixels,score:row.score};
        }finally{harness.dispose();}
      },scenario);
      assert.equal(noise.length,0,`${context.kind}:${context.width}x${context.height} browser noise ${noise.join(' | ')}`);
      console.log(`Boxing collider scored Play ${context.kind}:${context.width}x${context.height} ${scenario.name}: ${JSON.stringify(result)}`);
      results.push(result);
    }finally{await page.close();}
    }
    if(results.length===scenarioDefinitions.length){
      const byName=Object.fromEntries(results.map(row=>[row.name,row]));
      const base=byName.default.pixel;
      assert.equal(byName.off.pixel.count,0,`${context.kind}: OFF Play must have zero collider-only pixels`);
       assert.equal(byName['scale-zero'].pixel.count,0,`${context.kind}: zero Boxer Scale must hide fill and polygon wire`);
       assert.equal(byName['scale-zero'].score.result,'pending',`${context.kind}: zero Boxer Scale must disable scored contact`);
       assert.equal(byName['scale-unbounded'].score.result,'hit',`${context.kind}: Scale 5 must score with enlarged glove radius against the fixed note`);
      assert(base.count>100&&base.bounds,`${context.kind}: Scale1 glove cylinder must have visible bounded area`);
      assert.deepEqual([byName.default.settings.colliderScale,byName.default.settings.colliderDepthForward,byName.default.settings.colliderDepthBackward],[1,1,0],`${context.kind}: native default must be Scale1 / Depth+1 / Depth−0`);
      // The Play chip exposes run-locked depth controls independently of the
      // scored cylinder's measured framebuffer footprint.
      assert(!byName.off.preview.shown&&byName.default.preview.shown&&byName.backward.preview.shown&&byName.default.preview.text!==byName.backward.preview.text,`${context.kind}:${context.width}x${context.height}: backward change must remain legible in run-locked Play preview`);
      for(const name of ['scale','scale-unbounded','forward','backward']){
        const tuned=byName[name].pixel,box=tuned.bounds;
        assert(box&&tuned.count>100&&Math.abs(tuned.count-base.count)>12&&[
          Math.abs(box.minX-base.bounds.minX),Math.abs(box.maxX-base.bounds.maxX),Math.abs(box.minY-base.bounds.minY),Math.abs(box.maxY-base.bounds.maxY)
        ].some(delta=>delta>=2),`${context.kind}:${context.width}x${context.height} ${name} must change measured pixel area AND edge: ${JSON.stringify({base,tuned})}`);
      }
      const unbounded=byName['unbounded-depths'];
      assert(unbounded.settings.colliderDepthForward===.5&&unbounded.settings.colliderDepthBackward===5&&unbounded.frameSettings.colliderDepthForward===.5&&unbounded.frameSettings.colliderDepthBackward===5&&unbounded.preview.text.includes('front ×0.5')&&unbounded.preview.text.includes('rear ×5')&&unbounded.gloveDepthWu>byName.default.gloveDepthWu,`${context.kind}:${context.width}x${context.height}: native out-of-range Boxer depths must persist, lock for scored Play and enlarge the actual rendered glove Z extent: ${JSON.stringify({base:byName.default,unbounded})}`);
      assert.equal(unbounded.score.result,'hit','Out-of-range Boxer depths must still score target-centred Play contact');
      assert.equal(byName.off.score.result,'hit','Overlay visibility OFF must preserve scored hit');
      assert.equal(byName.default.score.result,'hit','Default centered glove must score');
      assert.equal(byName.scale.score.result,'hit','Scale4 lateral boundary must score');
      assert.equal(byName.forward.score.result,'hit','Forward4 centered glove must score while its visible +Z reach grows');
      assert.equal(byName.backward.score.result,'hit','Backward4 centered glove must score');
      assert.equal(byName['default-near'].score.result,'pending','Default collider must reject scale4-only lateral wrist');
      assert.equal(byName['default-early'].score.result,'pending','Default collider must reject forward4-only early wrist');
    }
  }
}finally{if(browser)await browser.close();if(host)await new Promise(resolve=>host.close(resolve));if(vite)await vite.close();if(signedServer)await new Promise(resolve=>signedServer.close(resolve));if(fixtureDirectory)rmSync(fixtureDirectory,{recursive:true,force:true});}
