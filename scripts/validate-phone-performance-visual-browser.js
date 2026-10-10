// @ts-check
// Project-owned visual oracle. Synthetic pose proves wiring/pixels only; a host fake
// camera cannot perform physical T-pose calibration or reproduce scored Play.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server=await createServer({configFile:"vite.phone.config.js",server:{host:"127.0.0.1",port:0,strictPort:false},logLevel:"error"});
// Trust only the Vite-config declaration, never a query parameter or page claim.
const declaredShadowMode=JSON.parse(server.config.define.__AEROBEAT_PHONE_SHADOW_MODE__);
assert(["native","disabled"].includes(declaredShadowMode),`Unexpected configured phone shadow mode: ${declaredShadowMode}`);
const initiallyCasting=declaredShadowMode==="native";
let browser;
try{
  await server.listen();const base=server.resolvedUrls.local[0];
  browser=await chromium.launch({headless:true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
  const live=await browser.newContext({viewport:{width:390,height:844},permissions:["camera"]});
  await live.addInitScript(()=>{const NativeWorker=window.Worker;window.__realWorkers=0;window.Worker=class extends NativeWorker{constructor(...args){super(...args);window.__realWorkers++;}};});
  const page=await live.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${base}phone-performance.html?preview=1`);
  await page.locator("aero-button[data-mode=cv-visual]").click();
  await page.waitForFunction(()=>window.__realWorkers>0,{},{timeout:30000});
  await page.locator("#status").getByText(/hold a T-pose/u).waitFor({timeout:50000});
  await page.waitForTimeout(5200);
  assert.match(await page.locator("#status").textContent(),/hold a T-pose/u,"real Worker + fake camera must stay explicitly warming without human T-pose");
  assert.match(await page.locator("#summary").textContent(),/Hold a T-pose/u);
  const reportPromise=page.waitForEvent("download");await page.locator("#download").click();
  const stream=await(await reportPromise).createReadStream();let text="";for await(const chunk of stream)text+=chunk.toString();
  const report=JSON.parse(text);
  assert(!report.runs.some(run=>run.mode==="cv-visual"),"fake camera must never silently publish calibrated visual benchmark");
  assert(windowless(report),"report must exclude raw landmarks, equipment, pixels and calibration identity");
  assert.equal(errors.length,0,`live diagnostic browser errors: ${errors}`);
  await live.close();

  const context=await browser.newContext({viewport:{width:640,height:480}});
  const fixture=await context.newPage(),fixtureErrors=[];
  fixture.on("pageerror",error=>fixtureErrors.push(error.message));
  await fixture.goto(`${base}scripts/fixtures/phone-visual-synthetic.html`);
  await fixture.waitForFunction(()=>window.__phoneVisualFixture?.ready()==="ready",null,{timeout:30000});
  const run=async command=>fixture.evaluate(command=>window.__phoneVisualFixture[command](),command);
  const state=await run("render");assert.equal(state.state,"running");assert(state.targets>=59&&state.targets<=64,"dense Flow scene must remain frozen");
  assert(state.shadow.light&&state.shadow.receiver&&state.shadow.resolution===2048,"pinned 2048 shadow light and receiver must exist in both modes");
  assert.equal(state.shadow.casting,initiallyCasting,`initial light casting must match Vite-config shadow mode ${declaredShadowMode}`);
  assert.equal(state.equipmentCount,0);assert.equal(state.cursorCount,0);
  const before=await pixels(fixture);
  assert.equal((await run("hold")).equipmentCount,2,"two-second synthetic T-pose must drive real calibrated visual service");
  assert.equal((await run("release")).cursorCount,1,"released tracked pose must stage real nose marker");
  const after=await pixels(fixture);
  const pixelName="visible Flow sabers/nose after synthetic calibration";
  assertPixelDelta(before,after,pixelName);
  const withheld=await fixture.evaluate(()=>window.__phoneVisualFixture.suppressDelivery(true));
  assert.equal(withheld.equipmentCount,0);assert.equal(withheld.cursorCount,0);
  const negative=await pixels(fixture);
  // Same fixture and same named assertion: suppress only equipment/nose delivery.
  assert.throws(()=>assertPixelDelta(before,negative,pixelName),/visible Flow sabers\/nose after synthetic calibration/u);
  await fixture.evaluate(()=>window.__phoneVisualFixture.suppressDelivery(false));
  assertPixelDelta(before,await pixels(fixture),pixelName);
  const native=await fixture.evaluate(()=>window.__phoneVisualFixture.shadowProbe(true));
  assert(native.shadow.casting,"native renderer must cast from 2048 light");
  const nativePixels=await pixels(fixture);
  const unshadowed=await fixture.evaluate(()=>window.__phoneVisualFixture.shadowProbe(false));
  assert.equal(unshadowed.shadow.casting,false,"counterfactual disables the same renderer light shadow casting only");
  const unshadowedPixels=await pixels(fixture);
  assertShadowDarkening(nativePixels,unshadowedPixels,"native shadow caster/receiver darkening pixels, same scene and light");
  const restored=await fixture.evaluate(initial=>window.__phoneVisualFixture.shadowProbe(initial),initiallyCasting);
  assert.equal(restored.shadow.casting,initiallyCasting,`shadow probe must restore ${declaredShadowMode} initial casting state`);
  if(initiallyCasting)assertPixelDelta(unshadowedPixels,await pixels(fixture),"native shadow caster/receiver pixels restored");
  else assert.deepEqual(await pixels(fixture),unshadowedPixels,"disabled shadow caster/receiver pixels restored");
  const lost=await run("invalidate");assert.equal(lost.calibrationReady,false);assert.equal(lost.equipmentCount,0);assert.equal(lost.cursorCount,0);
  const cleanup=await run("destroy");assert.equal(cleanup.equipment.length,0);assert.equal(cleanup.cursors.length,0);
  assert.deepEqual(fixtureErrors,[],"synthetic renderer fixture page errors");
  await context.close();
  console.log(`Phone visual browser (${declaredShadowMode}): fake camera/real Worker remains warming; synthetic real-input/PlayCanvas empty, calibrated saber+nose, same-renderer shadow-darkening pixels, source-loss and cleanup; named delivery pixel assertion red on suppression and green on restore. No physical Play proof.`);
}finally{await browser?.close();await server.close();}
function windowless(value){return !/landmarks|calibrationId|sourceId|geometryIdentity|configIdentity|"equipment"|"pixels"/u.test(JSON.stringify(value));}
async function pixels(page){return page.locator("#game").evaluate(canvas=>{const data=document.createElement("canvas");data.width=canvas.width;data.height=canvas.height;const ctx=data.getContext("2d",{willReadFrequently:true});ctx.drawImage(canvas,0,0);return Array.from(ctx.getImageData(0,0,data.width,data.height).data);});}
function assertPixelDelta(a,b,name){assert.equal(a.length,b.length);let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++;assert(changed>16,`${name}: expected >16 changed renderer pixels; observed ${changed}`);}
function assertShadowDarkening(native,off,name){assert.equal(native.length,off.length);let darkened=0;for(let i=0;i<native.length;i+=4){const brightness=native[i]+native[i+1]+native[i+2],without=off[i]+off[i+1]+off[i+2];if(without-brightness>=24)darkened++;}assert(darkened>=20,`${name}: expected >=20 darkened receiver pixels; observed ${darkened}`);}
