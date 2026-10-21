// @ts-check
// Signed 0.0.140 baseline versus corrected normal-Vite connected Play regression.
// Throwaway browser storage only; never writes source/public/personal library.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {build,createServer as createViteServer} from 'vite';
import {handlerForSnapshot,loadSignedSnapshot} from './serve-friend-game.js';

const temp=mkdtempSync(path.join(tmpdir(),'aerobeat-signed-glove-axis-'));
const signed=process.env.AEROBEAT_GLOVE_DEPTH_SIGNED==='1';
const signedDirectory=process.env.AEROBEAT_GLOVE_DEPTH_SIGNED_DIR??'.tmp/boxing-b140-2f2ca37';
const inverseSigned=signed&&process.env.AEROBEAT_GLOVE_DEPTH_SIGNED_DIR===undefined;
let gameServer,parentServer,vite,browser;
try{
  let childUrl;
  if(signed){
    await build({configFile:false,root:process.cwd(),logLevel:'error',build:{outDir:temp,emptyOutDir:true,lib:{entry:'scripts/fixtures/scored-play-browser-harness.js',formats:['es'],fileName:()=> 'scored-play-browser-harness.js'}}});
    const modules=new Map(readdirSync(temp).filter(name=>name.endsWith('.js')).map(name=>[name,readFileSync(path.join(temp,name))]));
    const signedHandler=handlerForSnapshot(loadSignedSnapshot(signedDirectory));
    gameServer=createServer((req,res)=>{const name=new URL(req.url??'/','http://fixture.invalid').pathname.slice('/scripts/fixtures/'.length);if(modules.has(name)){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});res.end(modules.get(name));return;}signedHandler(req,res);});
    await new Promise(resolve=>gameServer.listen(0,'127.0.0.1',resolve));
    childUrl=`http://127.0.0.1:${gameServer.address().port}/`;
  }else{
    vite=await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
    await vite.listen();childUrl=vite.resolvedUrls?.local?.[0];
  }
  assert(childUrl,'normal Vite or signed fixture URL unavailable');
  parentServer=createServer((_request,response)=>{response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0}</style><iframe id="game" allow="camera; autoplay; fullscreen; xr-spatial-tracking" src="${childUrl}"></iframe>`);});
  await new Promise(resolve=>parentServer.listen(0,'127.0.0.1',resolve));
  const parentUrl=`http://localhost:${parentServer.address().port}/`;
  browser=await chromium.launch({headless:true});
  const cases=[{name:'default',forward:1,backward:0},{name:'plus4',forward:4,backward:0},{name:'minus4',forward:1,backward:4}];
  for(const embedding of (inverseSigned?['direct']:['direct','iframe']))for(const scenario of cases){
    const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1});
    const page=await context.newPage();
    await page.goto(embedding==='direct'?childUrl:parentUrl,{waitUntil:'networkidle'});
    const game=embedding==='direct'?page.locator('aero-game'):page.frameLocator('#game').locator('aero-game');await game.waitFor();
    if(embedding==='iframe')assert.notEqual(new URL(childUrl).origin,new URL(parentUrl).origin);
    const result=await game.evaluate(async(element,scenario)=>{
      const {installScoredPlayHarness}=await import('/scripts/fixtures/scored-play-browser-harness.js');
      const events=[{schema:'aerobeat/resolved_content_event',version:3,eventId:'depth-axis-early',centerTimestampMs:6000,sourceEventIds:['depth-axis-source-early'],authoredBeat:{type:'straight_left',spatialTarget:{targetCell:5}}},{schema:'aerobeat/resolved_content_event',version:3,eventId:'depth-axis-late',centerTimestampMs:12000,sourceEventIds:['depth-axis-source-late'],authoredBeat:{type:'straight_left',spatialTarget:{targetCell:5}}}];
      const h=await installScoredPlayHarness(element,{events,songDurationMs:17000});
      try{
        await h.waitForAssets();await h.selectChart();
        const volume={colliderVisible:true,colliderScale:1,colliderDepthForward:scenario.forward,colliderDepthBackward:scenario.backward};
        const saved=await h.setSetup({boxingColliderVolume:volume});await h.startPlay();await h.calibrate();h.element.stopFrameLoop();
        await h.seekSong(5000);h.feedPose({leftWrist:{x:.5,y:.45},rightWrist:{x:.5,y:.45},nose:{x:.5,y:.2}});
        const pose=h.element.currentEquipmentPoses.find(item=>item.role==='left_wrist'),locked=h.element.activeSessionSetup.boxingColliderVolume;
        // The native Show model derives from the production capsule used by the
        // scorer. The QA fixture's current linked contracts do NOT establish
        // frozen signed product geometry; measure actual signed Show instead.
        const render=h.element.graph.renderer,overlay=render.lastModel.objects.find(item=>item.id==='equipment-collider-volume-left');
        const actual={start:overlay.capsule.start,end:overlay.capsule.end,axis:{x:overlay.capsule.end.x-overlay.capsule.start.x,y:overlay.capsule.end.y-overlay.capsule.start.y,z:overlay.capsule.end.z-overlay.capsule.start.z},radius:overlay.capsule.radius};
        const glb=render.equipmentPools.get('equipment/boxing-glove-v1:left_wrist')?.find(item=>item.name==='equipment-left_wrist-model'),glbRoot=render.equipmentPoseRoots.get('left_wrist');
        const wire=render.boxingColliderWirePool?.find(item=>item.enabled),fill=render.boxingColliderCylinderPool?.find(item=>item.enabled&&item.name==='equipment-collider-volume-left');
        const on=h.capture(),frame=h.element.rendererFrame(),offFrame={...frame,colliderSettings:{...frame.colliderSettings,colliderVisible:false}},poses=h.element.currentEquipmentPoses;
        render.renderGameplayFrameWithCursorsAndEquipment(offFrame,[],{grid:{x:0,y:0,width:1,height:1}},poses,{grid:{x:0,y:0,width:1,height:1}});
        const off=h.capture();let changed=0;for(let i=0;i<on.pixels.length;i+=4){const delta=Math.abs(on.pixels[i]-off.pixels[i])+Math.abs(on.pixels[i+1]-off.pixels[i+1])+Math.abs(on.pixels[i+2]-off.pixels[i+2]);if(delta>=22)changed++;}
        // Real production scorer with fresh measured target-centered motion
        // at an incoming negative-Z beat plane. No shared source edits.
        const input=h.graph.input.getSnapshot(),bounds=input.calibration.bounds,wr=(x,y)=>({x:1-(bounds.left+(x+.5)/4*(bounds.right-bounds.left)),y:bounds.top+(2.5-y)/3*(bounds.bottom-bounds.top)});
        const safe=wr(.1,1.8),at=wr(1,1.25),measure=point=>({leftWrist:point,rightWrist:safe,nose:{x:.5,y:.2}});
        await h.seekSong(5750,measure(safe));await h.seekSong(5800,measure(safe));
        await h.seekSong(5840,measure(at));await h.seekSong(5860,measure(at));
        const early=h.graph.gameplay.getSnapshot(),earlyHit=early.judgements.find(row=>row.eventId==='depth-axis-early')?.result??null;
        if(!earlyHit){await h.seekSong(5950,measure(at));await h.seekSong(6000,measure(at));}
        const final=h.graph.gameplay.getSnapshot(),finalHit=final.judgements.find(row=>row.eventId==='depth-axis-early')?.result??null;
        // A second independent beat tests the rear/spent side without allowing
        // the first beat's judgement to mask its result.
        await h.seekSong(11500,measure(safe));await h.seekSong(11990,measure(safe));
        await h.seekSong(12120,measure(safe));await h.seekSong(12140,measure(at));await h.seekSong(12160,measure(at));
        const late=h.graph.gameplay.getSnapshot(),lateHit=late.judgements.find(row=>row.eventId==='depth-axis-late')?.result??null;
        const metadata={pose:{anchor:pose.anchor,orientation:pose.orientation,scale:pose.scale},saved:saved.boxingColliderVolume,locked,frame:frame.colliderSettings,cylinder:actual,overlay:{start:overlay.capsule.start,end:overlay.capsule.end,radius:overlay.capsule.radius,position:overlay.position},wire:{position:wire?.getPosition().toString(),enabled:wire?.enabled},fill:{position:fill?.getPosition().toString(),enabled:fill?.enabled},glb:{position:glb?.getPosition().toString(),localPosition:glb?.getLocalPosition().toString(),localScale:glb?.getLocalScale().toString(),enabled:glb?.enabled,rootPosition:glbRoot?.getPosition().toString()},pixelsChanged:changed,earlyHit,finalHit,lateHit,earlyTimeline:early.session.timelinePositionMs,finalTimeline:final.session.timelinePositionMs,lateTimeline:late.session.timelinePositionMs,renderer:render.describe().state,session:h.element.graph.gameplay.getSnapshot().session.state,beatAt5000Z:-(6000-5000)*.006,beatAt5900Z:-(6000-5900)*.006,beatAt6100Z:-(6000-6100)*.006,frontCoverageAtMinusPointSix:actual.start.z<=-.6&&actual.end.z>=-.6,rearCoverageAtPlusPointSix:actual.start.z<=.6&&actual.end.z>=.6};
        return metadata;
      }finally{h.dispose();}
    },scenario);
    console.log(`${signed?'signed':'source'} ${embedding} ${scenario.name}: ${JSON.stringify(result)}`);
    assert.equal(result.session,'playing');assert(result.pixelsChanged>100);assert.equal(result.renderer,'running');
    assert.equal(result.earlyHit,inverseSigned?(scenario.name==='minus4'?'hit':null):(scenario.name==='plus4'?'hit':null),`${inverseSigned?'frozen signed':'corrected'} incoming early note polarity ${scenario.name}`);
    assert.equal(result.finalHit,'hit',`beat-center contact ${scenario.name}`);
    assert.ok(Math.abs(result.cylinder.start.z-(inverseSigned?(scenario.name==='minus4'?-2.2575:-.2175):(scenario.name==='plus4'?-1.7475:-.2175)))<1e-5,`${inverseSigned?'frozen signed':'corrected'} native Show start geometry ${scenario.name}`);
    assert.ok(Math.abs(result.cylinder.end.z-(inverseSigned?(scenario.name==='plus4'?1.8225:.2925):(scenario.name==='minus4'?2.3325:.2925)))<1e-5,`${inverseSigned?'frozen signed':'corrected'} native Show end geometry ${scenario.name}`);
    if(!inverseSigned){
      assert.equal(result.lateHit,scenario.name==='minus4'?'hit':null,`source rear/spent late note polarity ${scenario.name}`);
      assert.ok(Math.abs(result.cylinder.start.z-(scenario.name==='plus4'?-1.7475:-.2175))<1e-5,`source start geometry ${scenario.name}`);
      assert.ok(Math.abs(result.cylinder.end.z-(scenario.name==='minus4'?2.3325:.2925))<1e-5,`source end geometry ${scenario.name}`);
      assert.deepEqual([result.overlay.start.z,result.overlay.end.z],[result.cylinder.start.z,result.cylinder.end.z],`source native Show endpoints ${scenario.name}`);
    }
    assert.deepEqual([result.saved.colliderDepthForward,result.saved.colliderDepthBackward],[scenario.forward,scenario.backward],`${scenario.name} persisted native controls`);
    assert.deepEqual([result.locked.colliderDepthForward,result.locked.colliderDepthBackward],[scenario.forward,scenario.backward],`${scenario.name} run-locked scorer controls`);
    assert.deepEqual([result.frame.colliderDepthForward,result.frame.colliderDepthBackward],[scenario.forward,scenario.backward],`${scenario.name} production renderer controls`);
    assert.equal(result.glb.enabled,true,`${scenario.name} native GLB visible`);
    await context.close();
  }
}finally{await browser?.close();await new Promise(resolve=>parentServer?.close(resolve)??resolve());await new Promise(resolve=>gameServer?.close(resolve)??resolve());await vite?.close();rmSync(temp,{recursive:true,force:true});}
