// @ts-check
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

// Project-owned phone diagnostic gate: preview windows exercise real PlayCanvas and
// MediaPipe Worker with fake browser camera; only physical 60s windows are authoritative.
const server=await createServer({configFile:"vite.phone.config.js",server:{host:"127.0.0.1",port:0,strictPort:false},logLevel:"error"});
let browser;
try{
  await server.listen();const base=server.resolvedUrls.local[0];
  browser=await chromium.launch({headless:true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
  const context=await browser.newContext({viewport:{width:390,height:844},permissions:["camera"]});
  await context.addInitScript(()=>{
    const probe={cameraCalls:0,workerCalls:0,workerTerminations:0,videoFrames:0};Object.defineProperty(window,"__phoneProbe",{value:probe});
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=(...args)=>{probe.cameraCalls++;return original(...args);};
    const WorkerType=window.Worker;
    window.Worker=class extends WorkerType{constructor(...args){probe.workerCalls++;super(...args);}terminate(){probe.workerTerminations++;return super.terminate();}};
    if(typeof window.VideoFrame==="function")window.VideoFrame=new Proxy(window.VideoFrame,{construct(target,args){probe.videoFrames++;return Reflect.construct(target,args);}});
  });
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("response",response=>{if(response.status()>=400)errors.push(`${response.status()}: ${new URL(response.url()).pathname}`);});
  await page.goto(`${base}phone-performance.html?preview=1`);
  await page.locator("#summary").getByText(/^Game: scene/u).waitFor({timeout:30000});
  const scene=page.locator("#game"),gamePixels=await scene.screenshot();
  const sceneEvidence=await pixelEvidence(page,gamePixels);
  assert(sceneEvidence.differentColors>20,"Game scene must show actual colorful beats and lane, not a blank canvas");
  assert(sceneEvidence.cyan&&sceneEvidence.blue,"Game scene must show visible perspective lane and moving blue beats");
  await page.waitForTimeout(400);assert.equal(gamePixels.equals(await scene.screenshot()),false,"Dense beat scene must visibly advance with time");
  assert.equal(await page.locator("aero-button[data-mode=game]").getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator("#camera").isHidden(),true);
  assert.deepEqual(await page.evaluate(()=>window.__phoneProbe),{cameraCalls:0,workerCalls:0,workerTerminations:0,videoFrames:0},"Game must never request camera, transfer video, or instantiate CV worker");
  const hud=await page.locator("#fps").evaluate(element=>{const panel=element.shadowRoot.querySelector("[part=panel]"),style=getComputedStyle(panel);return{top:element.getBoundingClientRect().top,stageTop:document.querySelector(".stage").getBoundingClientRect().top,color:style.color,background:style.backgroundColor};});
  assert(hud.top>=hud.stageTop&&hud.top<hud.stageTop+50,"Backed FPS HUD must be at scene top");
  assert.equal(hud.color,"rgb(255, 255, 255)");assert.match(hud.background,/rgba\(2, 19, 32, 0\.93\)/u);
  const selector=page.locator("#quality");const labels=await selector.evaluate(element=>[...element.shadowRoot.querySelectorAll("option")].map(option=>[option.textContent,option.value]));
  assert.deepEqual(labels,[["Full (1.0)","1"],["High (0.75)","0.75"],["Medium (0.5)","0.5"],["Low (0.25)","0.25"]]);
  const full=await scene.evaluate(canvas=>({width:canvas.width,height:canvas.height}));
  await selector.locator("select").selectOption("0.5"); // Playwright pierces open component shadow root.
  await page.locator("#summary").getByText(/^Game: scene/u).waitFor({timeout:25000});
  const half=await scene.evaluate(canvas=>({width:canvas.width,height:canvas.height}));
  assert(half.width>0&&half.width<=Math.ceil(full.width/2)+1&&half.height<=Math.ceil(full.height/2)+1,"Render quality must change real canvas backing size");
  await selector.locator("select").selectOption("1");
  await page.locator("aero-button[data-mode=camera]").click();
  await page.locator("#summary").getByText(/^Game \+ Camera: scene/u).waitFor({timeout:30000});
  const cameraProbe=await page.evaluate(()=>window.__phoneProbe);
  assert.equal(cameraProbe.cameraCalls,1,"Camera mode requests one real stream");assert.equal(cameraProbe.workerCalls,0,"Camera mode cannot initialize CV worker");assert.equal(cameraProbe.videoFrames,0,"Camera mode cannot create transferable frames");
  assert.equal(await page.locator("#camera").isVisible(),true,"Camera composite must be visible behind beats");
  const previewPixels=await page.locator("#camera").evaluate(video=>{const canvas=document.createElement("canvas");canvas.width=32;canvas.height=32;const context=canvas.getContext("2d");context.drawImage(video,0,0,32,32);const pixels=context.getImageData(0,0,32,32).data;const colors=new Set();for(let i=0;i<pixels.length;i+=16)colors.add(`${pixels[i]>>4}:${pixels[i+1]>>4}:${pixels[i+2]>>4}`);return{width:video.videoWidth,height:video.videoHeight,colors:colors.size,playing:!video.paused};});
  assert(previewPixels.playing&&previewPixels.width>0&&previewPixels.height>0&&previewPixels.colors>5,"Camera composite must contain live nonblank video pixels");
  const cameraScene=await pixelEvidence(page,await scene.screenshot());assert(cameraScene.cyan&&cameraScene.blue,"Same gameplay geometry must remain visible in Camera mode");
  await page.locator("aero-button[data-mode=cv]").click();
  await page.locator("#summary").getByText(/^Game \+ CV: scene/u).waitFor({timeout:50000});
  const cvProbe=await page.evaluate(()=>window.__phoneProbe);assert(cvProbe.workerCalls>=1,"CV mode must instantiate a real Worker");
  const cvScene=await pixelEvidence(page,await scene.screenshot());assert(cvScene.cyan&&cvScene.blue,"CV state must retain colorful dense 3D beats");
  assert.equal(await page.locator("aero-button[data-mode=cv]").getAttribute("aria-pressed"),"true");
  const downloadPromise=page.waitForEvent("download");await page.locator("#download").click();
  const download=await downloadPromise;const stream=await download.createReadStream();let text="";for await(const chunk of stream)text+=chunk.toString();
  const report=JSON.parse(text);assert.equal(report.schema,"aerobeat/phone_performance_ablation");
  for(const mode of ["game","camera","cv"]){const run=report.runs.find(item=>item.mode===mode&&item.renderScale===1);assert(run,`Missing completed ${mode} run`);assert.equal(run.workload,"aerobeat/abccba_historical_default_2500.v1");assert(run.targets.min>=59&&run.targets.max<=64,"Historical deterministic target density changed");assert(run.displayFps>0);assert(run.displayIntervals.p95>0);}
  const game=report.runs.find(item=>item.mode==="game"&&item.renderScale===1),camera=report.runs.find(item=>item.mode==="camera"),cv=report.runs.find(item=>item.mode==="cv");
  assert.equal(game.camera,null);assert.equal(game.cv,null);assert.equal(game.activeCameraTracks,0);assert(camera.cameraNewFrameFps>0);assert.equal(camera.cv,null);assert.equal(camera.activeCameraTracks,1);assert.equal(camera.requestedCamera.video.facingMode,"user");assert(camera.camera.width>0&&camera.camera.frameRate>0);assert(cv.cv.poseOutputFps>0&&cv.cv.poseFrameCount>0&&cv.cv.submittedFrameCount>0);assert(cv.cv.submittedFrameCount<=Math.ceil(cv.cameraNewFrameFps*cv.durationMs/1000)+1,"CV submissions cannot exceed distinct camera frames");assert(cvProbe.videoFrames>=cv.cv.submittedFrameCount,"CV must transfer real VideoFrames");
  await page.locator("aero-button[data-mode=game]").click();await page.locator("#camera").waitFor({state:"hidden"});
  assert.equal(await page.locator("#camera").evaluate(video=>video.srcObject),null,"Leaving CV must detach camera stream");
  assert((await page.evaluate(()=>window.__phoneProbe)).workerTerminations>=1,"Leaving CV must terminate the Worker");
  await page.setViewportSize({width:844,height:390});
  await selector.locator("select").selectOption("0.75");
  await page.locator("#summary").getByText(/^Game: scene/u).waitFor({timeout:25000});
  const high=await scene.evaluate(canvas=>({width:canvas.width,height:canvas.height}));
  const landscape=await pixelEvidence(page,await scene.screenshot());assert(landscape.cyan&&landscape.blue,"Landscape High must show dense perspective beats");
  const layout=await page.evaluate(()=>({stage:document.querySelector(".stage").getBoundingClientRect().toJSON(),hud:document.querySelector("#fps").getBoundingClientRect().toJSON(),controls:document.querySelector(".controls").getBoundingClientRect().toJSON()}));
  assert(layout.hud.right<=layout.stage.right&&layout.hud.top>=layout.stage.top,"Landscape HUD must remain inside scene");
  assert(layout.controls.bottom<=layout.stage.top,"Landscape controls cannot overlap the scene HUD");
  await selector.locator("select").selectOption("0.25");
  await page.locator("#summary").getByText(/^Game: scene/u).waitFor({timeout:25000});
  const low=await scene.evaluate(canvas=>({width:canvas.width,height:canvas.height}));
  assert(low.width>0&&low.width<=high.width/3+2&&low.height<=high.height/3+2,"Low and High must reach renderer backing at correct scales");
  assert.deepEqual(errors,[],`Browser errors: ${errors.join("; ")}`);
  await context.close();

  const denied=await browser.newContext({viewport:{width:390,height:844}});
  await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException("Denied for test","NotAllowedError"));});
  const failure=await denied.newPage();await failure.goto(`${base}phone-performance.html?preview=1`);await failure.locator("aero-button[data-mode=camera]").click();
  await failure.locator("#status").getByText(/unavailable: Denied for test/u).waitFor({timeout:20000});
  assert.equal(await failure.locator("#camera").isHidden(),true,"Denied camera cannot leave preview visible");
  await denied.close();

  const pending=await browser.newContext({viewport:{width:390,height:844}});
  await pending.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(()=>{});});
  const permission=await pending.newPage();await permission.goto(`${base}phone-performance.html?preview=1`);
  await permission.locator("aero-button[data-mode=camera]").click();
  await permission.locator("#status").getByText(/Switching to Game \+ Camera/u).waitFor({timeout:10000});
  await permission.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
  await permission.locator("#status").getByText(/Window invalid: Tab hidden/u).waitFor({timeout:10000});
  await permission.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
  await permission.locator("aero-button[data-mode=game]").click();
  await permission.locator("#summary").getByText(/^Game: scene/u).waitFor({timeout:25000});
  assert.equal(await permission.locator("#camera").isHidden(),true,"Pending camera permission must be cancelled by hidden-tab invalidation");
  await pending.close();

  const invalid=await browser.newContext({viewport:{width:390,height:844}});
  const geometry=await invalid.newPage();await geometry.goto(`${base}phone-performance.html?preview=1`);
  await geometry.locator("#summary").getByText(/Measuring Game for/u).waitFor({timeout:25000});
  await geometry.setViewportSize({width:460,height:844});
  await geometry.locator("#status").getByText(/Window invalid: Canvas size or orientation changed/u).waitFor({timeout:10000});
  await geometry.waitForTimeout(4500);
  const geometryDownload=geometry.waitForEvent("download");await geometry.locator("#download").click();
  const geometryStream=await(await geometryDownload).createReadStream();let geometryJson="";for await(const chunk of geometryStream)geometryJson+=chunk.toString();
  assert.equal(JSON.parse(geometryJson).runs.length,0,"A resized mid-window scene cannot be exported as a valid run");
  await geometry.locator("aero-button[data-mode=game]").click();
  await geometry.locator("#summary").getByText(/^Game: scene/u).waitFor({timeout:25000});
  await geometry.locator("aero-button[data-mode=game]").click();
  await geometry.locator("#summary").getByText(/Warming up/u).waitFor({timeout:10000});
  await geometry.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
  await geometry.locator("#status").getByText(/Window invalid: Tab hidden/u).waitFor({timeout:10000});
  await geometry.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
  await geometry.waitForTimeout(4500);
  assert.match(await geometry.locator("#status").textContent(),/Window invalid/u,"Showing the tab must not restart a hidden warmup");
  await invalid.close();

  const brokenWorker=await browser.newContext({viewport:{width:390,height:844},permissions:["camera"]});
  await brokenWorker.addInitScript(()=>{window.Worker=class{constructor(){throw new Error("CV worker failure fixture");}};});
  const cvError=await brokenWorker.newPage();await cvError.goto(`${base}phone-performance.html?preview=1`);
  await cvError.locator("aero-button[data-mode=cv]").click();
  await cvError.locator("#status").getByText(/Game \+ CV unavailable: CV worker failure fixture/u).waitFor({timeout:20000});
  assert.equal(await cvError.locator("#camera").evaluate(video=>video.srcObject),null,"CV setup error must release the stream");
  await brokenWorker.close();

  const freeze=await browser.newContext({viewport:{width:390,height:844},permissions:["camera"]});
  await freeze.addInitScript(()=>{
    window.__freezeCamera=false;
    const request=HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback){return request.call(this,(now,metadata)=>{if(!window.__freezeCamera)callback(now,metadata);});};
  });
  const frozen=await freeze.newPage();await frozen.goto(`${base}phone-performance.html?preview=1`);
  await frozen.locator("aero-button[data-mode=cv]").click();
  try{await frozen.locator("#summary").getByText(/Measuring Game \+ CV/u).waitFor({timeout:45000});}
  catch(error){throw new Error(`Frozen-CV setup: ${await frozen.locator("#status").textContent()} / ${await frozen.locator("#summary").textContent()}`,{cause:error});}
  await frozen.evaluate(()=>{window.__freezeCamera=true;});
  await frozen.waitForFunction(()=>/Window invalid|complete/u.test(document.querySelector("#status")?.textContent??""),undefined,{timeout:15000});
  assert.match(await frozen.locator("#status").textContent(),/Window invalid: Camera stopped delivering new frames/u,"Frozen CV source must invalidate instead of completing a run");
  await frozen.waitForTimeout(4500);
  const frozenDownloadPromise=frozen.waitForEvent("download");await frozen.locator("#download").click();
  const frozenStream=await(await frozenDownloadPromise).createReadStream();let frozenJson="";for await(const chunk of frozenStream)frozenJson+=chunk.toString();
  const frozenReport=JSON.parse(frozenJson);assert.equal(frozenReport.runs.some(run=>run.mode==="cv"),false,"A frozen camera cannot yield a valid CV run");
  assert(frozenReport.failures.some(failure=>failure.reason.includes("Camera stopped")),"Frozen camera must be reported as a failure");
  await freeze.close();
  console.log("Phone performance browser gate passed: Game/Camera/CV, quality and landscape visuals, real worker/export/cleanup, denied/pending permission, hidden-tab cancellation, frozen-camera invalidation.");
}finally{await browser?.close();await server.close();}

async function pixelEvidence(page,bytes){return page.evaluate(async base64=>{const source=await createImageBitmap(await(await fetch(`data:image/png;base64,${base64}`)).blob());const scratch=document.createElement("canvas");scratch.width=source.width;scratch.height=source.height;const context=scratch.getContext("2d");context.drawImage(source,0,0);const colors=new Set();let cyan=false,blue=false;for(let y=Math.floor(source.height*.2);y<source.height;y+=11){for(let x=0;x<source.width;x+=11){const [r,g,b,a]=context.getImageData(x,y,1,1).data;if(a<200)continue;colors.add(`${r>>4}:${g>>4}:${b>>4}`);if(g>130&&b>130&&r<140)cyan=true;if(b>145&&r<90&&g>50&&g<190)blue=true;}}source.close();return{differentColors:colors.size,cyan,blue};},bytes.toString("base64"));}
