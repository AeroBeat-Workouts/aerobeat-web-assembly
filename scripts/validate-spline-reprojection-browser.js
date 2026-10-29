// @ts-check
// Connected production Test scoring at simulated 1fps and 2fps. Optional signed snapshot uses
// the existing scored-Play fixture transport; the shipped scorer/renderer stay real.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build, createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { loadSignedSnapshot, handlerForSnapshot } from "./serve-friend-game.js";

let vite,server,browser,fixtureDirectory;
try {
  let url;
  const signed=process.env.AEROBEAT_SPLINE_SIGNED_DIR;
  if(signed) {
    const snapshot=loadSignedSnapshot(path.resolve(signed));
    assert.equal(snapshot.manifest.sourceManifest.packageVersion,"0.0.150");
    fixtureDirectory=mkdtempSync(path.join(tmpdir(),"aerobeat-spline-fixture-"));
    await build({configFile:"vite.config.js",logLevel:"error",build:{outDir:fixtureDirectory,emptyOutDir:true,lib:{entry:"scripts/fixtures/scored-play-browser-harness.js",formats:["es"],fileName:()=>"scored-play-browser-harness.js"}}});
    const fixtures=new Map(readdirSync(fixtureDirectory).filter(name=>name.endsWith(".js")).map(name=>["/scripts/fixtures/"+name,readFileSync(path.join(fixtureDirectory,name))]));
    const handler=handlerForSnapshot(snapshot);
    server=createServer((request,response)=>{const bytes=fixtures.get(new URL(request.url??"/","http://fixture.invalid").pathname);if(bytes){response.setHeader("content-type","text/javascript");response.end(bytes);}else handler(request,response);});
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    url=`http://127.0.0.1:${server.address().port}/`;
  } else {
    vite=await createViteServer({configFile:"vite.config.js",logLevel:"error",server:{host:"127.0.0.1",port:0,hmr:false,watch:null}});
    await vite.listen();url=vite.resolvedUrls.local[0];
  }
  browser=await chromium.launch({headless:true});
  for(const {mode,fps} of ["flow","boxing"].flatMap(mode=>[2,1].map(fps=>({mode,fps})))) {
    const page=await browser.newPage({viewport:{width:1000,height:700}});
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(url,{waitUntil:"networkidle"});
    const game=page.locator("aero-game");
    assert.equal(await game.locator("[data-test-webcam-fps]").isDisabled(),true,"simulated webcam control is disabled outside Test");
    const result=await game.evaluate(async(element,{mode,fps})=>{
      const {installScoredPlayHarness}=await import("/scripts/fixtures/scored-play-browser-harness.js");
      const check=(condition,message)=>{if(!condition)throw Error(`Spline ${mode}: ${message}`);};
      const event={schema:"aerobeat/resolved_content_event",version:3,eventId:"sparse-crossing",centerTimestampMs:6000,sourceEventIds:["sparse-source"],authoredBeat:mode==="flow"?{type:"note",hand:"left",placement:5,direction:"right",requiresDirection:true}:{type:"hook_left",spatialTarget:{targetCell:5,entryDirection:"right"}}};
      const harness=await installScoredPlayHarness(element,{events:[event],mode,songDurationMs:12000});
      await harness.waitForAssets();await harness.selectChart();
      await harness.setSetup({spawnDistanceOverrideEnabled:true,spawnDistanceOverrideWorldUnits:20});
      await element.startSession("visual_test",{requireDownloaded:false});
      await element.setMenuOpen(false);await element.menuPauseTail;await element.audioSyncTail;
      element.stopFrameLoop();element.audioSyncPending=false;
      element.setTestEquipmentVisible(true);element.setTestAutomaticFeedbackEnabled(false);element.setTestEquipmentMouseHand("left");
      const control=element.shadowRoot.querySelector("[data-test-webcam-fps]");
      check(control instanceof HTMLInputElement && !control.disabled && control.getClientRects().length>0,"Test FPS control must be visible and enabled");
      control.value=String(fps);control.dispatchEvent(new Event("change",{bubbles:true}));
      check(element.testWebcamFps===fps,"native Test control must configure sampler");
      let y=.5;
      const tick=async(ms)=>{await harness.graph.audio.seek(ms/1000);element.runDisplayFrame();check(!element.lastError,element.lastError?.message??"display error");};
      // Default automatic feedback still samples visible equipment, but cannot score.
      element.setTestAutomaticFeedbackEnabled(true);
      element.testEquipmentPointerPosition={x:.02,y};
      await tick(1000);
      const automaticFirst=element.visualTestEvidenceFrameSequence;
      element.testEquipmentPointerPosition={x:.98,y};
      await new Promise(resolve=>setTimeout(resolve,100));
      await tick(1100);
      check(element.visualTestEvidenceFrameSequence===automaticFirst,"default automatic Test must also hold sampled equipment");
      check(harness.graph.gameplay.getJudgements().length===0,"automatic feedback must not admit production scoring evidence");
      element.setTestAutomaticFeedbackEnabled(false);
      element.testEquipmentPointerPosition={x:.02,y};
      await tick(5500);
      const target=element.rendererFrame().targets.find(target=>target.id==="sparse-crossing");
      if(mode==="boxing") {
        check(Number.isFinite(target?.heightWorldY),"use the current production Boxer target height");
        y=(2.5-target.heightWorldY)/3;
      }
      element.setTestWebcamFps(fps);
      element.testEquipmentPointerPosition={x:.02,y};
      await tick(5750);
      const first=element.visualTestEvidenceFrameSequence;
      const rendersBefore=harness.graph.renderer.describe().frameCount;
      element.testEquipmentPointerPosition={x:.98,y};
      await new Promise(resolve=>setTimeout(resolve,100));
      await tick(5850);
      const held=element.visualTestEvidenceFrameSequence;
      const before=harness.graph.gameplay.getJudgements().map(j=>({eventId:j.eventId,result:j.result}));
      const rendersHeld=harness.graph.renderer.describe().frameCount;
      check(first===held,"render ticks must hold the measured webcam frame");
      check(rendersHeld>rendersBefore,"renderer must advance independently of simulated webcam FPS");
      check(before.length===0,"neither endpoint or held frame should pre-hit the crossing");
      await new Promise(resolve=>setTimeout(resolve,fps===1?740:440));
      if(fps===1) {
        await tick(6590);
        check(element.visualTestEvidenceFrameSequence===held,"stale held measurement must remain idle, without wiping its bracket");
        await new Promise(resolve=>setTimeout(resolve,240));
      }
      const endpointMs=fps===1?6850:6290;
      await tick(endpointMs);
      const after=harness.graph.gameplay.getJudgements().map(j=>({eventId:j.eventId,result:j.result}));
      check(element.visualTestEvidenceFrameSequence>held,"next webcam update must admit a fresh endpoint");
      check(after.length===1 && after[0].result==="hit",`reconstructed crossing must hit: ${JSON.stringify({after,y,target,session:harness.graph.gameplay.getSnapshot().session})}`);
      await tick(endpointMs+10);
      check(harness.graph.gameplay.getJudgements().length===1,"the hit cannot be consumed twice");
      const canvas=element.canvasElement();check(canvas.width>0&&canvas.height>0,"nonzero built framebuffer");
      const output={mode,first,held,next:element.visualTestEvidenceFrameSequence,before,after,renderFrames:rendersHeld-rendersBefore,canvas:[canvas.width,canvas.height],fps:element.testWebcamFps};
      harness.dispose();return output;
    },{mode,fps});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify(result));
    await page.close();
  }
  console.log("Connected Flow/Boxing Test spline scoring and independent renderer cadence passed"+(signed?" in signed 0.0.150":""));
} finally {
  await browser?.close();await vite?.close();if(server)await new Promise(resolve=>server.close(resolve));if(fixtureDirectory)rmSync(fixtureDirectory,{recursive:true,force:true});
}
