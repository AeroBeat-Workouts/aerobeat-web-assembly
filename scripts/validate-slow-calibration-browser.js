// @ts-check
// Real assembly display cadence and visible calibration states. The existing
// scored-Play harness substitutes camera/CV transport, not input or calibration.
import assert from 'node:assert/strict';
import {createServer as httpServer} from 'node:http';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {build,createServer as viteServer} from 'vite';
import {chromium} from 'playwright';
import {handlerForSnapshot,loadSignedSnapshot} from './serve-friend-game.js';
import {isExpectedReadPixelsWarning} from './readpixels-console-policy.js';
let vite,server,fixtureDirectory,browser,url;
try{
 if(process.env.AEROBEAT_CALIBRATION_SIGNED_DIR){
  const snapshot=loadSignedSnapshot(process.env.AEROBEAT_CALIBRATION_SIGNED_DIR);
  assert.ok(['0.0.152','0.0.153'].includes(snapshot.manifest.sourceManifest.packageVersion),'calibration fix release or successor required');
  fixtureDirectory=mkdtempSync(path.join(tmpdir(),'aerobeat-slow-calibration-'));
  await build({configFile:false,root:process.cwd(),logLevel:'error',build:{outDir:fixtureDirectory,emptyOutDir:true,lib:{entry:'scripts/fixtures/scored-play-browser-harness.js',formats:['es'],fileName:()=> 'scored-play-browser-harness.js'}}});
  const fixtures=new Map(readdirSync(fixtureDirectory).filter(name=>name.endsWith('.js')).map(name=>[`/scripts/fixtures/${name}`,readFileSync(path.join(fixtureDirectory,name))]));
  const handler=handlerForSnapshot(snapshot);
  server=httpServer((request,response)=>{const bytes=fixtures.get(new URL(request.url??'/','http://local.invalid').pathname);if(bytes){response.setHeader('content-type','text/javascript');response.end(bytes);}else handler(request,response);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/`;
 }else{
  vite=await viteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await vite.listen();url=vite.resolvedUrls?.local?.[0];
 }
 assert(url);browser=await chromium.launch({headless:true});
 for(const variant of ['boxing-knees','boxing-upper','flow']){
  const page=await browser.newPage({viewport:{width:1000,height:700}}),noise=[];
  page.on('pageerror',error=>noise.push(error.message));
  page.on('console',message=>{if(!['warning','error'].includes(message.type()))return;const location=message.location();if(isExpectedReadPixelsWarning(message.type(),message.text(),location.url,location.lineNumber,location.columnNumber,url))return;noise.push(`${message.type()}:${message.text()}`);});
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!document.querySelector('aero-game')?.graph);
  const result=await page.locator('aero-game').evaluate(async(element,variant)=>{
   const {installScoredPlayHarness}=await import('/scripts/fixtures/scored-play-browser-harness.js');
   const check=(condition,message)=>{if(!condition)throw Error(`${variant}: ${message}`);};
   const knees=variant==='boxing-knees',flow=variant==='flow';
   const authoredBeat=flow?{type:'note',hand:'left',placement:5,requiresDirection:false}:knees?{type:'knee_left',spatialTarget:{targetCell:9,acceptedSubcells:[36,37,38,39]},timingWindowMs:180,evidenceFreshnessMs:150}:{type:'straight_left',spatialTarget:{targetCell:5,acceptedSubcells:[20,21,22,23]},timingWindowMs:180,evidenceFreshnessMs:150};
   const event={schema:'aerobeat/resolved_content_event',version:3,eventId:'slow-calibration-beat',centerTimestampMs:6000,sourceEventIds:['source-slow-calibration'],...(flow?{appearanceColor:'#2693FF'}:{}),authoredBeat};
   const harness=await installScoredPlayHarness(element,{events:[event],mode:flow?'flow':'boxing',kneeRuleset:knees,songDurationMs:15000});
   const legs={left:{hip:{x:.43,y:.68},knee:{x:.43,y:.8},ankle:{x:.43,y:.93}},right:{hip:{x:.57,y:.68},knee:{x:.57,y:.8},ankle:{x:.57,y:.93}}};
   const pose={tPose:true,legs:knees?legs:null};
   const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
   try{
    await harness.waitForAssets();await harness.selectChart();await harness.setSetup({kneeStrikesEnabled:knees});await harness.startPlay();
    const card=element.shadowRoot.querySelector('[data-role="play-calibration-checklist"]');
    const visibleRows=()=>[...card.querySelectorAll('[data-checklist-landmark]')].filter(row=>!row.hidden);
    const allSeen=()=>visibleRows().every(row=>row.querySelector('.checklist-value').textContent==='Seen');
    check(!card.hidden,'genuine Play calibration card shown');check(visibleRows().length===(knees?9:7),'correct required row count');
    harness.feedPose(pose);check(allSeen(),'fresh measured pose is Seen');
    // A genuinely bad measured frame must still turn Missing immediately.
    harness.feedPose(knees?{...pose,legs:{left:legs.left}}:{...pose,confidence:.2});
    check(!allSeen(),'actual missing/low-confidence measurement remains honest');
    await wait(125);element.runDisplayFrame();check(!allSeen(),'idle tick cannot resurrect an actually missing joint');
    harness.feedPose(pose);check(allSeen(),'fresh measured recovery is Seen');
    // Exercise genuine silence beyond the existing 750 ms boundary.
    const silenceStart=performance.now();
    while(performance.now()-silenceStart<825){await wait(40);element.runDisplayFrame();}
    check(visibleRows().every(row=>row.querySelector('.checklist-value').textContent==='Missing'),'genuine timeout expires visible joints');
    check(harness.graph.input.getSnapshot().calibration.holdProgressMs===0,'genuine timeout clears hold');
    // Four real measured updates per second; display ticks run independently.
    let nextMeasurement=0,lastMeasurement=null,lastPublishedAt=null,maxGapMs=0,samples=0,displayTicks=0;
    const idleBefore=element.inputAdvanceCount,start=performance.now();
    while(performance.now()-start<6000&&!harness.graph.input.getSnapshot().calibration.calibrationId){
     const now=performance.now();
     if(now>=nextMeasurement){
      if(lastMeasurement!==null)maxGapMs=Math.max(maxGapMs,now-lastMeasurement);
      harness.feedPose(pose);lastMeasurement=now;nextMeasurement=now+250;samples++;
      lastPublishedAt=harness.graph.input.getSnapshot().calibrationChecklist.measuredAt;
     }else{
      element.runDisplayFrame();
      check(harness.graph.input.getSnapshot().calibrationChecklist.measuredAt===lastPublishedAt,'idle display cannot invent a measurement timestamp');
     }
     displayTicks++;
     const input=harness.graph.input.getSnapshot();
     if(!input.calibration.calibrationId){check(!card.hidden&&allSeen(),'stable slow inference must not flash Missing between results');}
     await wait(25);
    }
    const input=harness.graph.input.getSnapshot(),session=harness.graph.gameplay.getSnapshot().session;
    check(maxGapMs<750,`fixture stayed within existing timeout (${maxGapMs}ms)`);
    check(samples>=5&&samples<=13,`real sparse measured cadence exercised (${samples} samples)`);
    check(element.inputAdvanceCount>idleBefore,'actual assembly no-new-result branch ran');
    check(input.calibration.calibrationId!==null,'real measured hold commits calibration at slow FPS');
    check(session.state==='countdown'&&card.hidden,'genuine countdown hides checklist immediately');
    return {variant,samples,displayTicks,idleTicks:element.inputAdvanceCount-idleBefore,maxGapMs:Math.round(maxGapMs),calibrationCommitted:true,state:session.state};
   }finally{harness.dispose();}
  },variant);
  assert.deepEqual(noise,[],'no unexpected browser warnings/errors');console.log(JSON.stringify(result));await page.close();
 }
 console.log(`Slow-pose calibration UI/display-loop regression passed${process.env.AEROBEAT_CALIBRATION_SIGNED_DIR?' in signed bundle':''}`);
}finally{await browser?.close();if(vite)await vite.close();if(server)await new Promise(resolve=>server.close(resolve));if(fixtureDirectory)rmSync(fixtureDirectory,{recursive:true,force:true});}
