// @ts-check
// Isolated 0.0.140 switched-punch diagnostic. Never opens the personal library.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { build as buildFixture, createServer as createViteServer } from 'vite';
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from './readpixels-console-policy.js';

const mapFixtures=Object.freeze({
  '54510':{path:'/tmp/aerobeat-54510-f5c04797fe0831741adec66ce5386971153919d4.zip',sha256:'0dc3f98537c679cb8e96ffc5d079a1e0cbb9ae59df571f693a67a53c5d051db3',sourceHash:'f5c04797fe0831741adec66ce5386971153919d4'},
  '5c4c':{path:'/tmp/aerobeat-diagnostic-5c4c-d2a2e9b6.zip',sha256:'198d729107e54c3d39c366f7a1fdee6c2f96b79b816d98d6ff333ec261cc7319',sourceHash:'d2a2e9b6'},
  '5e':{path:'/tmp/aerobeat-diagnostic-5e-44cb8963.zip',sha256:'c00ad62b155b7919f96fc3c8545e5451b9122ccf1f81daeee5ded1691b0c5037',sourceHash:'44cb8963'}
});
const mapId=process.env.AEROBEAT_SWITCHED_MAP??'54510',mapFixture=mapFixtures[mapId];
assert(mapFixture,`Unknown isolated map fixture ${mapId}`);
const archive=readFileSync(mapFixture.path);
assert.equal(createHash('sha256').update(archive).digest('hex'),mapFixture.sha256);
const signed=process.env.AEROBEAT_SWITCHED_SIGNED==='1';
const vite=signed?null:await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
let fixtureServer,iframeServer,browser;
try{
  if(vite)await vite.listen();
  let childUrl=vite?.resolvedUrls?.local?.[0];
  if(signed){
    const fixtureJs=await import('node:fs/promises').then(async fs=>{
      const os=await import('node:os'),path=await import('node:path');
      const directory=await fs.mkdtemp(path.join(os.tmpdir(),'switched-play-fixture-'));
      try {await buildFixture({configFile:false,root:process.cwd(),logLevel:'error',build:{outDir:directory,emptyOutDir:true,lib:{entry:'scripts/fixtures/scored-play-browser-harness.js',formats:['es'],fileName:()=> 'scored-play-browser-harness.js'}}});return new Map((await fs.readdir(directory)).filter(name=>name.endsWith('.js')).map(name=>[name,fs.readFile(path.join(directory,name))]));}
      finally{await fs.rm(directory,{recursive:true,force:true});}
    });
    // Only the new throwaway test origin receives the fixture module; 4203 is read-only.
    const {handlerForSnapshot,loadSignedSnapshot}=await import('./serve-friend-game.js');
    const signedHandler=handlerForSnapshot(loadSignedSnapshot('.tmp/boxing-b140-2f2ca37'));
    fixtureServer=createServer((req,res)=>{
      const pathname=new URL(req.url??'/','http://fixture.invalid').pathname;
      if(pathname.startsWith('/scripts/fixtures/')&&fixtureJs.has(pathname.slice('/scripts/fixtures/'.length))){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});fixtureJs.get(pathname.slice('/scripts/fixtures/'.length)).then(bytes=>res.end(bytes)).catch(error=>{res.statusCode=500;res.end(String(error));});return;}
      signedHandler(req,res);
    });
    await new Promise(resolve=>fixtureServer.listen(0,'127.0.0.1',resolve));
    childUrl=`http://127.0.0.1:${fixtureServer.address().port}/`;
  }
  assert(childUrl);
  iframeServer=createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><style>html,body{margin:0}iframe{width:844px;height:390px;border:0}</style><iframe id="game" allow="camera; autoplay; fullscreen; xr-spatial-tracking" src="${childUrl}"></iframe>`);});
  await new Promise(resolve=>iframeServer.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  for(const embedding of ['direct','iframe']){
    const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1});
    const page=await context.newPage(),noise=[];
    page.on('pageerror',error=>noise.push(`pageerror:${error.message}`));
    page.on('console',message=>{const type=message.type(),location=message.location(),text=message.text();if(['warning','error'].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,childUrl)&&!isExpectedPlaycanvasMeshWarning(type,text)&&!text.startsWith('WebXR availability detection skipped:'))noise.push(`${type}:${text}`);});
    try{
      await page.route('**/__switched_map.zip',route=>route.fulfill({status:200,contentType:'application/zip',body:archive}));
      await page.goto(embedding==='direct'?childUrl:`http://localhost:${iframeServer.address().port}/`,{waitUntil:'networkidle'});
      const game=embedding==='direct'?page.locator('aero-game'):page.frameLocator('#game').locator('aero-game');await game.waitFor();
      const result=await game.evaluate(async(element,{signed,embedding,mapId,mapFixture})=>{
        const fail=(condition,message)=>{if(!condition)throw Error(`Switched punch ${embedding}: ${message}`);};
        const {installScoredPlayHarness,boxingColliderTargetCenter}=await import('/scripts/fixtures/scored-play-browser-harness.js');
        // Isolated real hash-pinned map conversion. No personal IndexedDB/library read.
        const bytes=new Uint8Array(await(await fetch('/__switched_map.zip')).arrayBuffer());
        const graph=element.graph,acquired=await graph.vendor.importLocalArchive(bytes);
        fail(acquired.sourceHash.startsWith(mapFixture.sourceHash),'source hash differs');
        const converted=await graph.authoring.convertAllStandardAndPersist(acquired.source,{sourceProvider:'beatsaver',sourceId:mapId,sourceVersionHash:acquired.sourceHash,includeAudio:true,cacheSourceEntries:true,converterSettings:{sameHandPunchMinGapMs:0,repeatedPunchSwitchChancePercent:50,repeatedGuardReplaceChancePercent:0}});
        const all=await Promise.all(converted.packages.map(entry=>graph.authoring.loadPackage(entry.handle)));
        const collected=all.map(entry=>{const chart=entry.package.charts.find(item=>item.prototype?.rulesetId==='boxing_collider_v1');return {entry,chart,switched:entry.package.conversionTrace.boxing[0].events.filter(row=>row.action==='emit'&&row.repetition?.kind==='repeated_punch_switched')};});
        const switched=collected.flatMap(({entry,chart,switched})=>switched.map(row=>({difficulty:entry.package.source.difficulty,sourceHand:row.repetition.sourceHand,switchedHand:row.hand,type:chart.beats.find(beat=>beat.eventId===row.eventId)?.type,cell:chart.beats.find(beat=>beat.eventId===row.eventId)?.spatialTarget?.targetCell,id:row.eventId,start:row.start})));
        const families=[...new Set(switched.map(row=>row.type?.split('_')[0]))];
        const focusDifficulty=switched.find(row=>row.type?.startsWith('uppercut_'))?.difficulty??switched[0]?.difficulty;
        const chosen=families.flatMap(family=>switched.filter(row=>row.difficulty===focusDifficulty&&row.type?.startsWith(`${family}_`)).slice(0,2));
        if(chosen.length===0)return {source:{mapId,sampleCount:0,families:[],byDifficulty:collected.map(item=>({difficulty:item.entry.package.source.difficulty,switched:item.switched.length,punches:item.chart?.beats.filter(beat=>/^(straight|hook|uppercut)_(left|right)$/u.test(beat.type)).length}))},rows:[],session:null,renderer:null,signed};
        const anchor=chosen[0],stored=collected.find(item=>item.entry.package.source.difficulty===anchor.difficulty);
        fail(stored&&anchor.type?.endsWith(`_${anchor.switchedHand}`)&&anchor.sourceHand!==anchor.switchedHand,'authoring switched hand/type mismatch');
        const selectedPackage=converted.packages.find(entry=>entry.packageId===stored.entry.handle.packageId);
        await element.refreshLibrary(element.connectedGeneration,{preferredCollectionId:converted.collection.collectionId,preferredPackageId:selectedPackage.packageId});
        await element.lifecycleIntentTail;
        await element.selectGameplayAxes('boxing_collider_v1');
        await element.lifecycleIntentTail;
        const selected=graph.content.getSnapshot();
        const projection=Object.getOwnPropertySymbols(graph.content).find(symbol=>String(symbol).includes('render'));
        const liveRender=projection?graph.content[projection]?.():null;
        const liveRows=switched.filter(row=>row.difficulty===anchor.difficulty).map(row=>{const live=selected.resolvedEvents.find(entry=>entry.eventId===row.id),colored=liveRender?.find(entry=>entry.eventId===row.id);return {...row,liveType:live?.authoredBeat?.type??null,liveCell:live?.authoredBeat?.spatialTarget?.targetCell??null,color:colored?.appearanceColor??null};});
        fail(liveRows.every(row=>row.type===row.liveType&&row.cell===row.liveCell),`live Content switched beats missing: ${JSON.stringify(liveRows)}`);
        const sourceReport={mapId,sampleCount:switched.length,families,byDifficulty:collected.map(item=>({difficulty:item.entry.package.source.difficulty,switched:item.switched.length,punches:item.chart?.beats.filter(beat=>/^(straight|hook|uppercut)_(left|right)$/u.test(beat.type)).length})),representative:anchor,liveRows,variant:selected.selectedVariant?.rulesetId,liveCount:selected.resolvedEvents.length};
        fail(liveRows.every(row=>row.color===liveRows.find(candidate=>candidate.switchedHand===row.switchedHand)?.color),'hand colors inconsistent across same-side beats');
        const chartBeats=stored.chart.beats.filter(beat=>/^(straight|hook|uppercut)_(left|right)$/u.test(beat.type));
        const bpm=stored.entry.package.song.timing.tempoSegments[0].bpm;
        sourceReport.adjacent=liveRows.map(row=>{const neighbors=chartBeats.filter(beat=>beat.eventId!==row.id).map(beat=>({type:beat.type,cell:beat.spatialTarget.targetCell,deltaMs:Math.round((beat.start-row.start)*60000/bpm),id:beat.eventId})).filter(beat=>Math.abs(beat.deltaMs)<=1100).sort((a,b)=>Math.abs(a.deltaMs)-Math.abs(b.deltaMs)).slice(0,4);return {type:row.type,cell:row.cell,start:row.start,neighbors};});
        // Stop this isolated real-map graph; new connected fixture substitutes ONLY content,
        // media, authoring. Its input, scorer, renderer and Play scene remain production.
        const contactRows=chosen.filter(row=>row.difficulty===anchor.difficulty);
        const scenarios=contactRows.flatMap((row,index)=>[{id:`switched-${index}-new`,role:row.switchedHand,at:6000+index*12000,row},{id:`switched-${index}-old`,role:row.sourceHand,at:12000+index*12000,row}]);
        const events=scenarios.map(item=>({schema:'aerobeat/resolved_content_event',version:3,eventId:item.id,centerTimestampMs:item.at,sourceEventIds:[`source-${item.id}`],authoredBeat:{type:item.row.type,spatialTarget:{targetCell:item.row.cell,...(item.row.type.startsWith('hook_')?{entryDirection:item.row.switchedHand==='left'?'right':'left'}:item.row.type.startsWith('uppercut_')?{entryDirection:'up'}:{})}}}));
        const harness=await installScoredPlayHarness(element,{events,songDurationMs:Math.max(...scenarios.map(item=>item.at))+3000});
        try{
          await harness.waitForAssets();await harness.selectChart();
          await harness.setSetup({noseMarkerVisible:false});
          const override=harness.element.shadowRoot.querySelector('[data-game-setup-field="spawnDistanceOverrideEnabled"]');
          if(!override.checked)override.click();await harness.element.lifecycleIntentTail;
          await harness.startPlay();await harness.calibrate();harness.element.stopFrameLoop();
          const setup=harness.element.activeSessionSetup,bounds=harness.graph.input.getSnapshot().calibration.bounds;
          const wrist=(x,y)=>({x:1-(bounds.left+(x+.5)/4*(bounds.right-bounds.left)),y:bounds.top+(2.5-y)/3*(bounds.bottom-bounds.top)});
          const away=wrist(.1,1.8),rows=[];
          const seek=async(song,pose,tag)=>{try{return await harness.seekSong(song,pose);}catch(error){const actual=harness.graph.gameplay.getSnapshot().session.timelinePositionMs;if(String(error).includes('scored Play did not consume a fresh measured frame')&&Math.abs(actual-song)<.001&&harness.graph.input.getSnapshot().latestEvidence?.provenance==='measured')return null;throw Error(`${tag} at ${song}: ${String(error)} ${JSON.stringify({session:harness.graph.gameplay.getSnapshot().session,evidence:harness.graph.input.getSnapshot().latestEvidence?.provenance,latest:harness.element.latestPoseTimestampMs,lastError:harness.element.lastError?.message})}`);}};
          for(const item of scenarios){
            const center=boxingColliderTargetCenter(item.row.cell,{topRowReachWU:setup.topRowReachWU,bottomRowReachWU:setup.bottomRowReachWU}),on=wrist(center.x,center.y);
            const family=item.row.type.split('_')[0],direction=family==='hook'?(item.row.switchedHand==='left'?'right':'left'):family==='uppercut'?'up':null;
            const start=direction==='right'?wrist(center.x-.35,center.y):direction==='left'?wrist(center.x+.35,center.y):direction==='up'?wrist(center.x,center.y-.35):away;
            const pose=point=>({leftWrist:item.role==='left'?point:away,rightWrist:item.role==='right'?point:away,nose:{x:.5,y:.2}});
            await seek(item.at-900,pose(away),`${item.id} safe`);
            await seek(item.at-90,pose(start),`${item.id} approach`);
            const projected=harness.element.rendererFrame().targets.find(target=>target.id===item.id);
            const icon=harness.graph.renderer.lastModel?.objects.find(object=>object.kind==='icon'&&object.targetId===item.id);
            const before=harness.graph.gameplay.getSnapshot();
            await seek(item.at-30,pose(on),`${item.id} entry`);
            await seek(item.at,pose(on),`${item.id} center`);
            const after=harness.graph.gameplay.getSnapshot(),judgement=after.judgements.find(entry=>entry.eventId===item.id);
            const evidence=harness.graph.input.getSnapshot().latestEvidence;
            const measuredWrist=evidence?.anchors?.find(entry=>entry.anchor===`${item.role}_wrist`);
            rows.push({measuredWrist:measuredWrist?{x:measuredWrist.x,y:measuredWrist.y,valid:measuredWrist.valid,cell:measuredWrist.cell}:null,tracking:harness.graph.input.getSnapshot().tracking.gameplayPaused,id:item.id,sourceId:item.row.id,sourceHand:item.row.sourceHand,authoredHand:item.row.switchedHand,contactRole:item.role,authoredType:item.row.type,cell:item.row.cell,center,projected:projected?{hand:projected.hand,cell:projected.cell,family:projected.family,appearanceColor:projected.appearanceColor}:null,icon:icon?{assetId:icon.assetId,role:icon.role,position:icon.position,appearanceColor:icon.appearanceColor}:null,evidence:evidence?.provenance,measuredAt:evidence?.measurementTimestampMs,poseRole:harness.element.currentEquipmentPoses?.find(entry=>entry.role===`${item.role}_wrist`)?.anchor??null,judgement:judgement?.result??null,scoreBefore:before.scorePartitions.reduce((sum,entry)=>sum+entry.score,0),scoreAfter:after.scorePartitions.reduce((sum,entry)=>sum+entry.score,0),timeline:after.session.timelinePositionMs});
            await seek(item.at+1100,pose(away),`${item.id} settle`);
          }
          const mapCamera=harness.graph.input.getSnapshot().calibration.bounds;
          return {source:sourceReport,rows,camera:{mirrored:harness.graph.cv.getLatestPoseFrame()?.mirrored??null,bounds:mapCamera,exampleSourceCameraX:1-(mapCamera.left+(centerOfCell(2)+.5)/4*(mapCamera.right-mapCamera.left))},session:harness.graph.gameplay.getSnapshot().session.purpose,renderer:harness.graph.renderer.describe().state,signed};
          function centerOfCell(cell){return cell%4;}
        }finally{harness.dispose();}
      },{signed,embedding,mapId,mapFixture});
      console.log(`${signed?'signed':'source'} ${embedding} ${mapId}: ${JSON.stringify(result)}`);
      if(result.source.sampleCount>0){
        for(let index=0;index<result.rows.length;index+=2){const newer=result.rows[index],older=result.rows[index+1];
          assert.equal(newer.judgement,'hit',`${newer.authoredType} new switched hand must score`);
          assert.equal(older.judgement,null,`${older.authoredType} original hand must not score switched event`);
          assert.equal(newer.sourceId,older.sourceId);
          assert.notEqual(newer.sourceHand,newer.authoredHand);
          assert.equal(newer.projected.hand,newer.authoredHand);
          assert.equal(newer.projected.cell,newer.cell);
          assert.equal(newer.evidence,'measured');assert.equal(older.evidence,'measured');
        }
        assert.equal(result.session,'play');assert.equal(result.renderer,'running');
      }
      if(embedding==='iframe')assert.notEqual(new URL(childUrl).origin,new URL(`http://localhost:${iframeServer.address().port}/`).origin);
      assert.deepEqual(noise,[],`browser errors: ${noise.join(' | ')}`);
    }finally{await context.close();}
  }
}finally{await browser?.close();await new Promise(resolve=>iframeServer?.close(resolve)??resolve());await new Promise(resolve=>fixtureServer?.close(resolve)??resolve());await vite?.close();}
