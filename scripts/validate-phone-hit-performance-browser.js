// @ts-check
// Real renderer browser oracle for private Test committed-hit presentation.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server=await createServer({configFile:"vite.phone-hit.config.js",server:{host:"127.0.0.1",port:0,strictPort:false,hmr:false,watch:null},logLevel:"error"});
const configured=JSON.parse(server.config.define.__AEROBEAT_PHONE_SHADOW_MODE__);
assert(["native","disabled"].includes(configured));
let browser;
try {
  await server.listen();
  const base=server.resolvedUrls?.local?.[0];
  assert(base,"Vite URL missing");
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${base}scripts/fixtures/phone-hit-synthetic.html`,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>window.__phoneHitFixture?.ready()==="ready",null,{timeout:30000});
  const render=(t,mode,omit=null)=>page.evaluate(([time,kind,without])=>window.__phoneHitFixture.renderAt(time,kind,without),[t,mode,omit]);
  const pixels=()=>page.evaluate(()=>window.__phoneHitFixture.pixels());
  const pair=async (t,omit=null)=>{const base=await render(t,"no-hit"),basePixels=await pixels(),hit=await render(t,"hit",omit),hitPixels=await pixels();return{base,basePixels,hit,hitPixels};};
  for(const [timeMs,expected] of [[0,59],[209,64],[850,63]]){
    const baseline=await render(timeMs,"no-hit");
    assert.equal(baseline.targets,expected,`Test-purpose no-hit baseline at t=${timeMs}ms`);
    assert.equal(baseline.hitFeedback,0,`Test-purpose no-hit feedback at t=${timeMs}ms`);
    assert.equal(baseline.aftermathEntries,0,`Test-purpose no-hit aftermath at t=${timeMs}ms`);
  }
  const before=await pair(4299);
  assert.equal(before.base.targets>=59&&before.base.targets<=64,true);
  assert.equal(before.hit.hitFeedback,0);
  assert.equal(before.hit.halves.length,0);
  assert.equal(before.hit.shadow.exists,true);
  assert.equal(before.hit.shadow.receiver,true);
  assert.equal(before.hit.shadow.resolution,2048);
  assert.equal(before.hit.shadow.casting,configured==="native");
  assert.equal(before.hit.equipmentCount,2);
  assert.equal(before.hit.cursorCount,0);
  const first=await pair(4300);
  assert.equal(first.base.halves.length,0);
  assert.deepEqual(first.hit.halves.map(half=>half.id).sort(),["note-100:aftermath:half+","note-100:aftermath:half-"]);
  assert.deepEqual(first.hit.halves.map(half=>half.sign).sort(),[-1,1]);
  assert(first.hit.halves.every(half=>half.assetId?.includes("directional-arrow")));
  assert.equal(first.hit.feedback.length,1);
  assert.equal(first.hit.feedback[0].text,"Great");
  const feedbackPoint=await page.evaluate(([feedback,half])=>({
    feedback:window.__phoneHitFixture.projected(feedback.x,feedback.y,feedback.z),
    half:window.__phoneHitFixture.projected(half.x,half.y,half.z)
  }),[first.hit.feedback[0],first.hit.halves[0]]);
  // Great is a visible renderer effect distinct from the corpse: compare real
  // hit vs no-hit at its projected location, but exclude the half's local ROI.
  const greatPixels=changedNearExcluding(first.basePixels,first.hitPixels,844,390,feedbackPoint.feedback.x,feedbackPoint.feedback.y,40,48,feedbackPoint.half.x,feedbackPoint.half.y,16,24);
  assert(greatPixels>20,`note-100 Great feedback pixels: expected >20 outside corpse ROI, got ${greatPixels}`);
  const firstWithoutCorpses=await render(4300,"hit","note-100");
  const firstCorpseFreePixels=await pixels();
  const greatWithoutCorpses=changedNear(first.basePixels,firstCorpseFreePixels,844,390,feedbackPoint.feedback.x,feedbackPoint.feedback.y,40,48);
  assert(greatWithoutCorpses>20,`note-100 Great feedback pixels must survive corpse-only suppression, got ${greatWithoutCorpses}`);
  assert.equal(firstWithoutCorpses.hitFeedback,first.hit.hitFeedback,"first-hit counterfactual must retain hit targets");
  assert.deepEqual(firstWithoutCorpses.feedback,first.hit.feedback,"first-hit counterfactual must retain Great feedback");
  assert.equal(firstWithoutCorpses.halves.length,0);
  const steady=await pair(4340);
  const isolated=await render(4340,"hit","note-100");
  const withoutHalves=await pixels();
  await render(4340,"hit");
  const withHalves=await pixels();
  assert.equal(isolated.halves.length,0);
  assert.equal(isolated.hitFeedback,steady.hit.hitFeedback,"same-hit control must retain committed targets");
  assert.deepEqual(isolated.feedback,steady.hit.feedback,"same-hit control must retain Great feedback");
  assert.equal(steady.hit.halves.length,2);
  const anchors=await page.evaluate(halves=>halves.map(half=>window.__phoneHitFixture.projected(half.x,half.y,half.z)),steady.hit.halves);
  const named="note-100 two individually visible clipped corpse halves";
  const assertHalves=(full,noHit,halfFree)=>{
    // A hit removes its live icon and adds feedback; neither is proof of a corpse.
    // Compare the same hit frame with only note-100 aftermath removed, and require
    // two visible regions *also* different from the matched no-hit frame.
    const count=anchors.map(point=>changedNear(halfFree,full,844,390,point.x,point.y,18,28));
    const againstNoHit=anchors.map(point=>changedNear(noHit,full,844,390,point.x,point.y,18,28));
    assert(count.every(n=>n>20)&&againstNoHit.every(n=>n>20),`${named}: expected >20 changed pixels per half vs both controls; got ${count.join(",")} and ${againstNoHit.join(",")}`);
    return count;
  };
  const visible=assertHalves(withHalves,steady.basePixels,withoutHalves);
  const corpseOnlyRoi=(full)=>anchors.map(point=>changedNear(withoutHalves,full,844,390,point.x,point.y,18,28));
  const withheld=await page.evaluate(()=>window.__phoneHitFixture.suppressDelivery(true));
  assert.equal(withheld.halves.length,0);
  assert.equal(withheld.aftermathEntries,0,"only aftermath field withheld");
  assert.equal(withheld.hitFeedback,steady.hit.hitFeedback,"suppression keeps the exact committed hit targets");
  assert.equal(withheld.targets,steady.hit.targets,"suppression keeps target count unchanged");
  assert.deepEqual(withheld.feedback,steady.hit.feedback,"suppression keeps Great feedback unchanged");
  assert.equal(withheld.equipmentCount,steady.hit.equipmentCount,"suppression keeps both static sabers");
  assert.deepEqual(withheld.shadow,steady.hit.shadow,"suppression keeps the light and catcher");
  const missing=await pixels();
  assert.deepEqual(missing,withoutHalves,"suppression pixels equal same-hit-minus-aftermath, not no-hit");
  const redCounts=corpseOnlyRoi(missing);
  assert.deepEqual(redCounts,[0,0],"corpse-only withheld: both half ROIs have zero pixel delta against same-hit-minus-corpses");
  assert.throws(()=>assertHalves(missing,steady.basePixels,withoutHalves),/note-100 two individually visible clipped corpse halves/u);
  const restored=await page.evaluate(()=>window.__phoneHitFixture.suppressDelivery(false));
  assert.equal(restored.halves.length,2);
  assert.deepEqual(restored.feedback,steady.hit.feedback,"Great feedback stays unchanged through corpse restoration");
  const restoredCounts=assertHalves(await pixels(),steady.basePixels,withoutHalves);
  assert.deepEqual(restoredCounts,visible,"corpse-only restored: per-half pixel counts recover exactly");
  assert(changedNear(steady.basePixels,steady.hitPixels,844,390,anchors[0].x,anchors[0].y,55,55)>20,"hit scene must differ from matched no-hit near note-100");
  const fading=await pair(4380);
  assert.equal(fading.hit.iconCount,0,"hit live icon has finished 80ms removal");
  assert.equal(fading.hit.halves.length,2);
  assert.equal((await pair(4649)).hit.feedback.length,1);
  assert.equal((await pair(4650)).hit.feedback.length,0,"Great expires at 350ms");
  const seventh=await render(5332,"hit");
  assert.equal(seventh.aftermathEntries,7);
  const eighth=await render(5504,"hit");
  assert.equal(eighth.aftermathEntries,7,"frameHit(5504) returns exactly seven aftermath entries; first is already evicted");
  assert.equal(eighth.halves.length,0,"old note-100 halves already off-screen/evicted");
  const lightBefore=await render(4340,"no-hit");
  await page.evaluate(()=>window.__phoneHitFixture.shadowProbe(true));const native=await pixels();
  const off=await page.evaluate(()=>window.__phoneHitFixture.shadowProbe(false));const offPixels=await pixels();
  assert.equal(off.shadow.casting,false);
  let darker=0;for(let i=0;i<native.length;i+=4)if(offPixels[i]+offPixels[i+1]+offPixels[i+2]-native[i]-native[i+1]-native[i+2]>=24)darker++;
  assert(darker>=20,`same-renderer native shadow receiver must darken >=20 pixels, got ${darker}`);
  const final=await page.evaluate(initial=>window.__phoneHitFixture.shadowProbe(initial),configured==="native");
  assert.equal(final.shadow.casting,configured==="native");
  assert.equal(final.targets,lightBefore.targets);
  // Phone-sized exact same scene, static Test sabers and camera: object counts
  // alone cannot establish that the leftmost note-100 corpse survives clipping.
  const portrait=await page.evaluate(()=>window.__phoneHitFixture.resize(390,460));
  assert.deepEqual(portrait,{width:390,height:460});
  assert.equal((await render(4300,"hit")).halves.length,2);
  const firstPortrait=await render(4340,"hit");
  const firstPortraitPixels=await pixels();
  const omittedPortrait=await render(4340,"hit","note-100");
  const corpseFreePortraitPixels=await pixels();
  assert.equal(omittedPortrait.hitFeedback,firstPortrait.hitFeedback,"portrait corpse control preserves Great");
  const portraitAnchors=await page.evaluate(halves=>halves.map(half=>window.__phoneHitFixture.projected(half.x,half.y,half.z)),firstPortrait.halves);
  const portraitHalfPixels=portraitAnchors.map(point=>changedNear(corpseFreePortraitPixels,firstPortraitPixels,390,460,point.x,point.y,18,28));
  assert(portraitHalfPixels.every(count=>count>20),`portrait note-100 clipped corpse halves must EACH be visible: pixels=${portraitHalfPixels}, centers=${JSON.stringify(portraitAnchors)}`);
  const portraitGear=await render(4340,"no-hit");
  const portraitGearPixels=await pixels();
  const withoutGear=await page.evaluate(()=>window.__phoneHitFixture.renderWithoutEquipment(4340,"no-hit"));
  const withoutGearPixels=await pixels();
  assert.equal(portraitGear.equipmentCount,2);
  assert.equal(withoutGear.equipmentCount,0);
  assert.equal(withoutGear.targets,portraitGear.targets);
  const gearPixelCount=changedNear(withoutGearPixels,portraitGearPixels,390,460,195,230,195,230);
  assert(gearPixelCount>20,`portrait static Flow sabers must contribute visible renderer pixels, got ${gearPixelCount}`);
  // The page's responsive .stage clamps to >=270 CSS px on 390px phones.
  // Exercise the narrower visible vertical slice as well, not just 390x460.
  assert.deepEqual(await page.evaluate(()=>window.__phoneHitFixture.resize(390,270)),{width:390,height:270});
  const shortHit=await render(4340,"hit"),shortHitPixels=await pixels();
  await render(4340,"hit","note-100");const shortCorpseFree=await pixels();
  const shortCenters=await page.evaluate(halves=>halves.map(half=>window.__phoneHitFixture.projected(half.x,half.y,half.z)),shortHit.halves);
  const shortHalves=shortCenters.map(point=>changedNear(shortCorpseFree,shortHitPixels,390,270,point.x,point.y,18,28));
  assert(shortHalves.every(count=>count>20),`short portrait 390x270 clipped corpse halves must EACH be visible: pixels=${shortHalves}, centers=${JSON.stringify(shortCenters)}`);
  await render(4340,"no-hit");const shortGearPixels=await pixels();
  await page.evaluate(()=>window.__phoneHitFixture.renderWithoutEquipment(4340,"no-hit"));const shortWithoutGear=await pixels();
  const shortGear=changedNear(shortWithoutGear,shortGearPixels,390,270,195,135,195,135);
  assert(shortGear>20,`short portrait static Flow sabers must contribute visible pixels, got ${shortGear}`);
  assert.deepEqual(errors,[],"fixture browser page errors");
  const smoke=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  await smoke.addInitScript(()=>{
    const NativeWorker=window.Worker;
    window.__phoneHitMediaCalls={workers:0,cameraRequests:0};
    window.Worker=class extends NativeWorker {
      constructor(...args){window.__phoneHitMediaCalls.workers++;super(...args);}
    };
    if(navigator.mediaDevices?.getUserMedia){
      const nativeGetUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia=(...args)=>{
        window.__phoneHitMediaCalls.cameraRequests++;
        return nativeGetUserMedia(...args);
      };
    }
  });
  const live=await smoke.newPage(),liveErrors=[];
  live.on("pageerror",error=>liveErrors.push(error.message));
  await live.goto(`${base}phone-hit-performance.html?preview=1`);
  await live.waitForFunction(()=>{
    const stage=document.querySelector(".stage"),canvas=stage?.querySelector("canvas");
    if(!canvas)return false;
    const rect=canvas.getBoundingClientRect();
    return canvas.width>320&&canvas.height>=270&&canvas.width===Math.round(rect.width)&&canvas.height===Math.round(rect.height);
  },null,{timeout:30000});
  const pageGeometry=await live.locator(".stage").evaluate(stage=>{
    const rect=stage.getBoundingClientRect(),canvas=stage.querySelector("canvas"),canvasRect=canvas.getBoundingClientRect();
    return{stage:{width:rect.width,height:rect.height},canvasCss:{width:canvasRect.width,height:canvasRect.height},backing:{width:canvas.width,height:canvas.height},dpr:devicePixelRatio};
  });
  assert.equal(pageGeometry.dpr,1);
  assert.equal(pageGeometry.backing.width,Math.round(pageGeometry.canvasCss.width),"Full quality page backing width must match canvas CSS");
  assert.equal(pageGeometry.backing.height,Math.round(pageGeometry.canvasCss.height),"Full quality page backing height must match canvas CSS");
  assert(pageGeometry.backing.width>=320&&pageGeometry.backing.width<=900&&pageGeometry.backing.height>=270&&pageGeometry.backing.height<=900,"portrait stage fixture geometry must be within oracle bounds");
  for(const mode of ["no-hit","real-hit"]){
    await live.locator(`aero-button[data-mode="${mode}"]`).click();
    await live.locator("#status").getByText("complete",{exact:false}).waitFor({timeout:45000});
    assert.deepEqual(await live.evaluate(()=>window.__phoneHitMediaCalls),{workers:0,cameraRequests:0},`${mode}: CV-off Test preview must create no Worker or request camera`);
  }
  const download=live.waitForEvent("download");await live.locator("#download").click();
  const stream=await(await download).createReadStream();let text="";for await(const chunk of stream)text+=chunk.toString();
  const report=JSON.parse(text);
  assert.equal(report.schema,"aerobeat/phone_test_hit_comparison");
  assert.equal(report.previewOnly,true);
  assert.equal(report.workload.purpose,"visual_test");
  assert.equal(report.workload.automaticFeedback,false);
  assert.equal(report.renderer.shadowMode,configured);
  assert.equal(report.source,JSON.parse(server.config.define.__AEROBEAT_PHONE_COMMIT__));
  assert.equal(report.renderer.commit,JSON.parse(server.config.define.__AEROBEAT_PHONE_RENDERER_COMMIT__));
  assert.equal(report.renderer.facadeSha256,JSON.parse(server.config.define.__AEROBEAT_PHONE_RENDERER_SOURCE_SHA256__));
  assert.deepEqual(report.runs.map(run=>run.mode),["no-hit","real-hit"]);
  assert(report.runs.every(run=>run.renderScale===1),"both page runs must use Full backing scale");
  assert(report.runs.every(run=>run.backing.width===pageGeometry.backing.width&&run.backing.height===pageGeometry.backing.height),"both page modes must retain captured portrait stage backing");
  for(const run of report.runs){
    assert(run.displayIntervals.count>2,`${run.mode}: actual display frames required`);
    if(run.mode==="no-hit")assert(run.targets.min>=59&&run.targets.max<=64,`${run.mode}: Test-purpose no-hit target range required`);
    else assert(run.targets.min>0&&run.targets.max<=128,`${run.mode}: positive bounded hit projection required (350ms feedback adds targets)`);
    assert(run.rendererCallWallMs.count>0,`${run.mode}: renderer-call samples required`);
    assert(run.projectionWallMs.count>0,`${run.mode}: projection samples required`);
    if(run.mode==="real-hit"){
      assert(run.aftermath.intendedPieceCountMax>=2,"page hit mode must render two intended pieces");
      assert(run.aftermath.firstHitBurst.hitFeedbackFrames>0,"page first hit must have Great feedback coverage");
      assert(run.aftermath.steady.aftermathFrames>0,"page steady hits must have aftermath coverage");
    }else assert.equal(run.aftermath.intendedPieceCountMax,0,"page no-hit must have zero corpses");
  }
  assert.deepEqual(report.failures,[]);
  assert.deepEqual(liveErrors,[],"new phone page browser errors");
  await smoke.close();
  const pageSize=pageGeometry.backing;
  // Reuse EXACT page stage backing in the independent fixture. The fixture
  // shares the page's Test wrist recipe, camera and workload; only equipment
  // or aftermath delivery differs within each frozen time pair.
  const captured=await page.evaluate(([w,h])=>window.__phoneHitFixture.resize(w,h),[pageSize.width,pageSize.height]);
  assert.deepEqual(captured,pageSize,"portrait fixture backing must match actual page Full backing");
  // Disable ONLY native light shadow casting for this gear/no-gear pair so
  // receiver darkening cannot masquerade as painted saber pixels.
  const gearOn=await page.evaluate(()=>{window.__phoneHitFixture.shadowProbe(false);return window.__phoneHitFixture.renderAt(850,"no-hit");});
  const gearOnPixels=await pixels(),gearSubject=await page.evaluate(()=>window.__phoneHitFixture.equipmentCenters());
  const gearOff=await page.evaluate(()=>window.__phoneHitFixture.renderWithoutEquipment(850,"no-hit")),gearOffPixels=await pixels();
  assert.equal(gearOff.status,"running");
  assert.equal(gearOn.targets,63,"frozen Test no-hit t850 corpus");
  assert.equal(gearOff.targets,gearOn.targets,"equipment removal cannot change no-hit targets");
  assert.equal(gearOn.equipmentCount,2);
  assert.equal(gearOff.equipmentCount,0);
  const gearRois=gearSubject.map(point=>changedNear(gearOffPixels,gearOnPixels,pageSize.width,pageSize.height,point.x,point.y,42,50));
  assert.equal(gearOn.shadow.casting,false,"painted-gear comparison must have native shadow casting off");
  assert.deepEqual(gearSubject.map(point=>point.anchorX),[-.5,3.5],"portrait saber ROI tracks exact Test resolved wrist anchors");
  assert(gearRois[0]>20,`page-sized portrait LEFT Flow saber must paint >=20 localized pixels with shadows off, left/right=${gearRois}, centers=${JSON.stringify(gearSubject)}, stage=${JSON.stringify(pageGeometry)}`);
  const restoredLight=await page.evaluate(initial=>window.__phoneHitFixture.shadowProbe(initial),configured==="native");
  assert.equal(restoredLight.shadow.casting,configured==="native","fixture restores declared light before corpse visual checks");
  const portraitHit=await render(4340,"hit"),portraitHitPixels=await pixels();
  const portraitNoCorpse=await render(4340,"hit","note-100"),portraitNoCorpsePixels=await pixels();
  assert.equal(portraitHit.halves.length,2);
  assert.deepEqual(portraitNoCorpse.feedback,portraitHit.feedback,"page-sized corpse-only control keeps Great");
  assert.equal(portraitNoCorpse.hitFeedback,portraitHit.hitFeedback);
  const actualStageCenters=await page.evaluate(halves=>halves.map(half=>window.__phoneHitFixture.projected(half.x,half.y,half.z)),portraitHit.halves);
  const actualStageHalfPixels=actualStageCenters.map(point=>changedNear(portraitNoCorpsePixels,portraitHitPixels,pageSize.width,pageSize.height,point.x,point.y,18,28));
  assert(actualStageHalfPixels.every(n=>n>20),`page-sized portrait note-100 halves must each be visible, pixels=${actualStageHalfPixels}, centers=${JSON.stringify(actualStageCenters)}, stage=${JSON.stringify(pageGeometry)}`);
  assert.deepEqual(errors,[],"fixture browser page errors through exact page-sized pixel checks");
  await page.evaluate(()=>window.__phoneHitFixture.destroy());
  await context.close();
  console.log(`Phone Test hit browser (${configured}) PASS: first hit, Great expiry, clipped halves pixel counts green=${visible}, corpse-only red=${redCounts}, restore=${restoredCounts}, seventh/eighth eviction, shadow darkening ${darker}, portrait 390x460 half pixels=${portraitHalfPixels}, gear pixels=${gearPixelCount}; 390x270 half pixels=${shortHalves}, gear pixels=${shortGear}, real-page stage=${JSON.stringify(pageGeometry)}, exact-stage fixture shadow-off t850 localized left/right saber ROIs=${gearRois}, t4340 half ROIs=${actualStageHalfPixels}; page modes/provenance/coverage with zero Worker/camera requests in both modes. Synthetic commits are not collision or phone GPU proof.`);
} finally {await browser?.close();await server.close();}
function changedNear(a,b,w,h,cx,cy,rx,ry){let n=0;for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(h,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(w,Math.ceil(cx+rx));x++){const i=(y*w+x)*4;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>=24)n++;}return n;}
function changedNearExcluding(a,b,w,h,cx,cy,rx,ry,ex,ey,erx,ery){let n=0;for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(h,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(w,Math.ceil(cx+rx));x++){if(Math.abs(x-ex)<=erx&&Math.abs(y-ey)<=ery)continue;const i=(y*w+x)*4;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>=24)n++;}return n;}
