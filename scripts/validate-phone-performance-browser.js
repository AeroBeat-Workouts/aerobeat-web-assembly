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
    const probe={cameraCalls:0,workerCalls:0};Object.defineProperty(window,"__phoneProbe",{value:probe});
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=(...args)=>{probe.cameraCalls++;return original(...args);};
    const WorkerType=window.Worker;
    window.Worker=class extends WorkerType{constructor(...args){probe.workerCalls++;super(...args);}};
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
  assert.equal(await page.locator("aero-button[data-mode=game]").getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator("#camera").isHidden(),true);
  assert.deepEqual(await page.evaluate(()=>window.__phoneProbe),{cameraCalls:0,workerCalls:0},"Game must never request camera or instantiate CV worker");
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
  assert.equal(cameraProbe.cameraCalls,1,"Camera mode requests one real stream");assert.equal(cameraProbe.workerCalls,0,"Camera mode cannot initialize CV worker");
  assert.equal(await page.locator("#camera").isVisible(),true,"Camera composite must be visible behind beats");
  const cameraScene=await pixelEvidence(page,await scene.screenshot());assert(cameraScene.cyan&&cameraScene.blue,"Same gameplay geometry must remain visible in Camera mode");
  await page.locator("aero-button[data-mode=cv]").click();
  await page.locator("#summary").getByText(/^Game \+ CV: scene/u).waitFor({timeout:50000});
  const cvProbe=await page.evaluate(()=>window.__phoneProbe);assert(cvProbe.workerCalls>=1,"CV mode must instantiate a real Worker");
  const downloadPromise=page.waitForEvent("download");await page.locator("#download").click();
  const download=await downloadPromise;const stream=await download.createReadStream();let text="";for await(const chunk of stream)text+=chunk.toString();
  const report=JSON.parse(text);assert.equal(report.schema,"aerobeat/phone_performance_ablation");
  for(const mode of ["game","camera","cv"]){const run=report.runs.find(item=>item.mode===mode&&item.renderScale===1);assert(run,`Missing completed ${mode} run`);assert.equal(run.workload,"aerobeat/abccba_historical_default_2500.v1");assert(run.targets.min>=59&&run.targets.max<=64,"Historical deterministic target density changed");assert(run.displayFps>0);assert(run.displayIntervals.p95>0);}
  const game=report.runs.find(item=>item.mode==="game"&&item.renderScale===1),camera=report.runs.find(item=>item.mode==="camera"),cv=report.runs.find(item=>item.mode==="cv");
  assert.equal(game.camera,null);assert.equal(game.cv,null);assert(camera.cameraNewFrameFps>0);assert.equal(camera.cv,null);assert(cv.cv.poseOutputFps>0&&cv.cv.poseFrameCount>0);
  await page.locator("aero-button[data-mode=game]").click();await page.locator("#camera").waitFor({state:"hidden"});
  assert.equal(await page.locator("#camera").evaluate(video=>video.srcObject),null,"Leaving CV must detach camera stream");
  assert.deepEqual(errors,[],`Browser errors: ${errors.join("; ")}`);
  await context.close();

  const denied=await browser.newContext({viewport:{width:390,height:844}});
  await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException("Denied for test","NotAllowedError"));});
  const failure=await denied.newPage();await failure.goto(`${base}phone-performance.html?preview=1`);await failure.locator("aero-button[data-mode=camera]").click();
  await failure.locator("#status").getByText(/unavailable: Denied for test/u).waitFor({timeout:20000});
  assert.equal(await failure.locator("#camera").isHidden(),true,"Denied camera cannot leave preview visible");
  await denied.close();
  console.log("Phone performance browser gate passed: Game scene/HUD/resolution, Camera compositor/isolation, real CV Worker/output/report/cleanup, denied permission.");
}finally{await browser?.close();await server.close();}

async function pixelEvidence(page,bytes){return page.evaluate(async base64=>{const source=await createImageBitmap(await(await fetch(`data:image/png;base64,${base64}`)).blob());const scratch=document.createElement("canvas");scratch.width=source.width;scratch.height=source.height;const context=scratch.getContext("2d");context.drawImage(source,0,0);const colors=new Set();let cyan=false,blue=false;for(let y=Math.floor(source.height*.2);y<source.height;y+=11){for(let x=0;x<source.width;x+=11){const [r,g,b,a]=context.getImageData(x,y,1,1).data;if(a<200)continue;colors.add(`${r>>4}:${g>>4}:${b>>4}`);if(g>130&&b>130&&r<140)cyan=true;if(b>145&&r<90&&g>50&&g<190)blue=true;}}source.close();return{differentColors:colors.size,cyan,blue};},bytes.toString("base64"));}
