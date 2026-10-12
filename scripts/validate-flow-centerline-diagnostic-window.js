// @ts-check
// Bounded, source-matched v3 recorder contract; no browser/GPU compile claim.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../flow-centerline-diagnostic.js", import.meta.url), "utf8").replace('import "./src/index.js";', "");
const rendererCommit = "9f72a3ea2b890a29c3cb3c42176b97bcd101c282";
const rendererTree = "604e32a846ae5464905767e3e60e0e605361ff74";
const names = ["assembly", "renderer", "gameplay", "input", "ui", "audio", "content", "content-authoring", "contracts", "web-hash", "vendor-beatsaver", "vendor-mediapipe", "branding", "environment-assets", "asset-release"];
const manifest = { schema:"aerobeat/flow_centerline_source_manifest", version:1, packageVersion:"0.0.128", sources:Object.fromEntries(names.map((name,index)=>[`@aerobeat/web-${name}`, {commit:(index+1).toString(16).padStart(40,"0"),tree:(index+20).toString(16).padStart(40,"0"),sourceSha256:(index+50).toString(16).padStart(64,"0")}])) };
manifest.sources["@aerobeat/web-renderer"].commit=rendererCommit;
manifest.sources["@aerobeat/web-renderer"].tree=rendererTree;
const stamp="FLOW-CENTERLINE-EXPERIMENTAL-0.0.128-0123456789abcdef01234567";
const entry=(path)=>({path,bytes:123,sha256:"a".repeat(64)});
const bundle={schema:"aerobeat/flow_centerline_bundle_manifest",version:1,sourceManifest:manifest,buildStamp:stamp,html:entry("flow-centerline-test.html"),js:[entry("assets/flow-centerline-entry-123.js")]};
const run=async (options={})=>{
  let now=0,hits=0,hitDelta=0,requests=0,urls=0,clicks=0,snapshotCalls=0,cvCalls=0;
  const listeners=new Map(),forwarded=[];
  const element=id=>({id,textContent:"",dataset:{},checked:false,disabled:false,open:true,addEventListener(name,fn){listeners.set(`${id}:${name}`,fn);}});
  const ids=["faint-hit-recorder","faint-hit-diagnostic","faint-hit-state","faint-hit-recording","faint-hit-summary","faint-hit-off","faint-hit-download","faint-hit-reset"];
  const controls=Object.fromEntries(ids.map(id=>[id,element(id)]));
  const canvas={width:840,height:890},game=element("aero-game");game.shadowRoot={querySelector:selector=>selector==="canvas[data-role='renderer']"?canvas:null};
  const session={purpose:"visual_test",state:"playing"};
  const gameplay=Object.freeze({getSnapshot(){snapshotCalls++;return {session,judgements:Array.from({length:hits},()=>({result:"hit",shadow:false}))};},advance(){now+=35;hits+=hitDelta;hitDelta=0;}});
  const originalAdvance=gameplay.advance;
  class VariantMap extends Map { values(){throw Error("variant cache enumeration is forbidden");} }
  const renderer={aftermathAssetPools:new Map(),sliceVariantMaterials:new VariantMap(),assetPoolGeneration:1,materialUid:1,sign:1,
    acquireAftermathAssetEntity(assetId,index){let pool=this.aftermathAssetPools.get(assetId);if(!pool){pool=[];this.aftermathAssetPools.set(assetId,pool);}while(pool.length<=index)pool.push({});now+=2;return pool[index];},
    installSliceClipBlocks(){now+=1;},
    sliceVariantMaterial(record,sign){const key=`${sign}:${this.assetPoolGeneration}:${record.materialUid}`;let value=this.sliceVariantMaterials.get(key);if(!value){value={};this.installSliceClipBlocks();this.sliceVariantMaterials.set(key,value);}now+=3;return value;},
    applyAftermathAppearance(){this.sliceVariantMaterial({materialUid:this.materialUid},this.sign);now+=4;},
    manualTick(){now+=5;},renderGameplayScene(){},
    updateSceneObjects(objects){forwarded.push(objects);for(const object of objects)if(object.kind==="aftermath")this.applyAftermathAppearance(this.acquireAftermathAssetEntity("note",0));now+=6;},
    renderGameplayFrameWithCursorsAndEquipment(frame){this.updateSceneObjects(frame.objects);this.manualTick();now+=23;}
  };
  const cv={getStatus(){cvCalls++;return {running:false};}};
  game.graph={renderer,gameplay,cv};game.sessionGeneration=1;game.testAutomaticFeedbackEnabled=false;game.testEquipmentVisible=true;game.testEquipmentMouseHand="left";
  game.rendererFrame=()=>{now+=7;return {aftermath:[{}],objects:[{kind:"aftermath"},{kind:"feedback"}]};};
  game.renderGameplay=function(){const frame=this.rendererFrame();now+=9;renderer.renderGameplayFrameWithCursorsAndEquipment(frame);now+=10;return frame;};
  game.runDisplayFrame=function(){if(session.state==="playing")gameplay.advance();this.renderGameplay();now+=11;};
  game.projectTestEquipmentPointer=function(){this.renderGameplay();};game.stopFrameLoop=()=>{};game.startFrameLoop=()=>{};
  const saved=[];
  const context={__AEROBEAT_FLOW_SOURCE_MANIFEST__:options.compileManifest??manifest,__AEROBEAT_BUILD_STAMP__:stamp,__AEROBEAT_PACKAGE_VERSION__:"0.0.128",
    document:{querySelector(selector){return selector==="aero-game"?game:selector==="main"?element("main"):controls[selector.slice(1)]??null;},createElement(){return {click(){clicks++;saved.push(this.download);}};}},
    devicePixelRatio:2,innerWidth:540,innerHeight:960,performance:{now:()=>now},MutationObserver:class{observe(){}},setInterval(){},setTimeout(){},
    fetch:async(path,options)=>{requests++;assert.equal(path,"/flow-centerline-bundle-manifest.json");assert.equal(options.cache,"no-store");return {ok:true,json:async()=>optionsBundle()};},
    URL:{createObjectURL(){urls++;return "blob:flow-test";},revokeObjectURL(){}},Blob:class{constructor(parts,options){this.parts=parts;this.type=options.type;saved.push(JSON.parse(parts.join("")));}},console};
  function optionsBundle(){return options.bundle??bundle;}
  vm.runInNewContext(options.source??source,context,{filename:"flow-centerline-diagnostic.js"});
  const evalIn=expression=>vm.runInNewContext(expression,context);
  const frame=(delta=0)=>{hitDelta=delta;game.runDisplayFrame();};
  const download=async()=>{const handler=listeners.get("faint-hit-download:click");assert.equal(typeof handler,"function");await handler();};
  return {context,evalIn,game,renderer,gameplay,originalAdvance,cv,session,controls,listeners,forwarded,frame,download,saved,bundle,manifest,
    advance:ms=>{now+=ms;},get counts(){return {requests,urls,clicks,snapshotCalls,cvCalls,hits};}};
};

assert.throws(()=>vm.runInNewContext(source,{__AEROBEAT_FLOW_SOURCE_MANIFEST__:{...manifest,sources:{...manifest.sources,"@aerobeat/web-renderer":{...manifest.sources["@aerobeat/web-renderer"],tree:"0".repeat(40)}}},__AEROBEAT_BUILD_STAMP__:stamp,__AEROBEAT_PACKAGE_VERSION__:"0.0.128"}),/Flow source manifest entries/u);
const t=await run();
assert.equal(Object.keys(manifest.sources).length,15);
assert.equal(t.evalIn("installedGraph === game.graph"),true,"frozen gameplay must permit attachment");
assert.equal(t.gameplay.advance,t.originalAdvance,"scoring facade must remain frozen and unchanged");
t.frame();
assert.equal(t.evalIn("active.variantProfile.materialVariantInsertions"),1);
assert.equal(t.evalIn("active.variantCohorts.materialVariantInsertion.frameCount"),1);
t.advance(200);t.frame(1);
assert.equal(t.evalIn("active.label"),"first-hit-burst");
assert.equal(t.evalIn("active.hitBurst.triggeredFrameCount"),1);
assert.equal(t.evalIn("active.displayFrame.count"),1,"scored first frame promoted whole");
assert.equal(t.evalIn("active.projection.count"),1);
assert.equal(t.evalIn("active.eligibleIntervalCount"),0,"pre-hit interval remains before hit");
assert.equal(t.evalIn("reportWindows.find(w=>w.label==='before-first-hit').eligibleIntervalCount"),1);
assert.equal(t.evalIn("active.variantProfile.materialVariantReuses"),1);
assert.equal(t.evalIn("active.variantCohorts.aftermathNoNewVariant.frameCount"),1);
for(const [uid,sign,generation] of [[2,1,1],[2,-1,1],[2,-1,2],[2,-1,2]]){t.renderer.materialUid=uid;t.renderer.sign=sign;t.renderer.assetPoolGeneration=generation;t.frame();}
assert.equal(t.evalIn("active.variantProfile.materialVariantInsertions"),3,"only sign:generation:uid changes insert");
assert.equal(t.evalIn("active.variantProfile.materialVariantReuses"),2);
assert.equal(t.evalIn("active.variantProfile.materialVariantHighWater"),4);
assert.equal(t.evalIn("active.variantCohorts.materialVariantInsertion.frameCount"),3);
assert.equal(t.evalIn("active.variantCohorts.aftermathNoNewVariant.frameCount"),2);
const before=t.counts;for(let i=0;i<100;i++)t.renderer.sliceVariantMaterial({materialUid:2},-1);
assert.equal(t.counts.snapshotCalls,before.snapshotCalls,"nested variant probes do not resnapshot");
const hist=t.evalIn("histogram()");const append=t.evalIn("append");append(hist,233.8);for(let i=0;i<700;i++)append(hist,8.4);
assert.equal(hist.bins.length,60001);assert.equal(t.evalIn("summarize")(hist).maxMs,233.8);assert.equal(t.evalIn("summarize")(hist).p95ApproxMs,8.5);
t.evalIn("firstHitStart=NOW()");t.game.projectTestEquipmentPointer();
assert.equal(t.evalIn("active.variantCohorts.materialVariantInsertion.frameCount+active.variantCohorts.aftermathNoNewVariant.frameCount"),5,"pointer redraw is not RAF cohort");
const off=t.controls["faint-hit-off"];off.checked=true;t.listeners.get("faint-hit-off:change")();
t.game.sessionGeneration=2;t.frame(2);
assert.equal(t.evalIn("active.sessionGeneration"),2,"first scored RAF belongs to new generation");
assert.equal(t.forwarded.at(-1).length,1,"off excludes only aftermath");assert.equal(t.forwarded.at(-1)[0].kind,"feedback");
assert.equal(t.counts.hits,3);assert.equal(t.evalIn("active.hitCount"),2);
assert.equal(t.evalIn("active.variantCohorts.materialVariantInsertion.frameCount"),0);
for(const [purpose,state,automatic] of [["play","playing",false],["visual_test","playing",true],["visual_test","paused_manual",false]]){
  t.session.purpose=purpose;t.session.state=state;t.game.testAutomaticFeedbackEnabled=automatic;t.game.renderGameplay();assert.equal(t.forwarded.at(-1).length,2,"ineligible off must forward untouched input");
}
t.session.purpose="visual_test";t.session.state="playing";t.game.testAutomaticFeedbackEnabled=false;t.frame();assert.equal(t.forwarded.at(-1).length,1);
for(let i=0;i<40;i++){off.checked=i%2===0;t.listeners.get("faint-hit-off:change")();t.frame();}
off.checked=true;t.listeners.get("faint-hit-off:change")();t.frame();
assert.equal(t.evalIn("reportWindows.length"),32,"rolling completed windows bounded");
t.session.state="paused_manual";const report=t.evalIn("report()");assert.equal(report.schema,"aerobeat/flow_centerline_diagnostic");assert.equal(report.version,3);assert.equal(report.packageVersion,"0.0.128");assert.equal(report.sourceManifest.sources["@aerobeat/web-renderer"].commit,rendererCommit);
assert.match(report.gpuTiming,/unmeasured/u);assert.equal(report.windows.length,32);
assert.equal(report.windows.at(-1).valid,true,"paused download retains eligible measurements");
assert.equal("sliceCacheMisses" in report.windows.at(-1).variantProfile,false,"obsolete variant key absent");
assert.equal("gpuCompileCount" in report,false);
await t.download();assert.equal(t.counts.requests,1);assert.equal(t.counts.clicks,1);assert.equal(t.counts.urls,1);
assert.equal(t.saved[0].bundleManifest.schema,"aerobeat/flow_centerline_bundle_manifest");assert.equal(t.saved[0].bundleManifest.buildStamp,stamp);assert.equal(t.saved[1],"aerobeat-flow-centerline-v3-off.json");
off.checked=false;t.listeners.get("faint-hit-off:change")();await t.download();assert.equal(t.saved.at(-1),"aerobeat-flow-centerline-v3-native.json");
const allowedLabels=new Set(["before-first-hit","first-hit-burst","steady-after-first-hit"]);
for(const exported of [t.saved[0],t.saved[2]])for(const window of exported.windows)assert(allowedLabels.has(window.label),`v3 export window label ${window.label} must be comparable across modes`);
const afterExport=await run();afterExport.frame(1);await afterExport.download();
assert.equal(afterExport.evalIn("active.label"),"steady-after-first-hit","first-hit export resumes the supported steady cohort");
afterExport.controls["faint-hit-off"].checked=true;afterExport.listeners.get("faint-hit-off:change")();await afterExport.download();
for(const window of afterExport.saved.at(-2).windows)assert(allowedLabels.has(window.label),`after toggle unsupported label ${window.label}`);
assert.doesNotMatch(JSON.stringify(t.saved[0]),/poseLandmarks|VideoFrame|rawCv|cameraPixels/u);
for(const bad of [{...bundle,buildStamp:"WRONG"},{...bundle,sourceManifest:{...manifest,packageVersion:"0.0.127"}},{...bundle,js:[entry("assets/entry.js"),{...entry("assets/other.js"),sha256:"bad"}]}]){
  const rejected=await run({bundle:bad});rejected.frame(1);await rejected.download();
  assert.equal(rejected.counts.requests,1);assert.equal(rejected.counts.urls,0);assert.equal(rejected.counts.clicks,0);
  assert.match(rejected.controls["faint-hit-state"].textContent,/Download failed/u);
}
// Mutation targets the reporter's own off forwarding, with the same test input.
const mutant=source.replace('objects.filter(object=>object?.kind !== "aftermath")','objects.filter(object=>object?.kind === "aftermath")');
assert.notEqual(mutant,source);
// Run the negative via an isolated VM fixture: do not modify production or historical files.
const negative=await run({source:mutant});negative.controls["faint-hit-off"].checked=true;negative.listeners.get("faint-hit-off:change")();negative.frame(1);
assert.equal(negative.forwarded.at(-1).some(object=>object.kind==="aftermath"),true,"mutation genuinely forwards a corpse");
assert.throws(()=>assert.equal(negative.forwarded.at(-1).every(object=>object.kind!=="aftermath"),true),/AssertionError|Expected values/u,"off assertion rejects corpse-forwarding regression");
console.log("Flow centerline v3 VM source, cohorts, off identity, limits and async fail-closed download passed.");
