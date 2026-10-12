// @ts-check
// Clean, committed source only: build with vite.flow-centerline.config.js, then
// generate the sidecar with write-flow-centerline-bundle-manifest.js. This test
// never launches a preview or changes a route; pass the existing local preview
// URL with AEROBEAT_FLOW_QA_URL. Synthetic seeks are NOT phone frame cadence.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist-flow-centerline-phone");
const target = new URL(process.env.AEROBEAT_FLOW_QA_URL ?? "http://127.0.0.1:4182/flow-centerline-test.html");
assert.equal(target.pathname, "/flow-centerline-test.html");
assert.equal(target.hostname,"127.0.0.1","cross-origin iframe requires the preview on 127.0.0.1");
assert.equal(target.protocol,"http:","only an existing local loopback preview is permitted");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const hex = value => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const keys = (value, names, label) => assert.deepEqual(Object.keys(value).sort(), names.slice().sort(), label);
const count = (n, ceiling, label) => assert(Number.isSafeInteger(n) && n >= 0 && n <= ceiling, `${label}: bounded count`);
const histogram = (h, label, ceiling = 100000, sum = false) => {
  keys(h, ["count","p50ApproxMs","p95ApproxMs","maxMs","quantileBinWidthMs",...(sum?["sumMs"]:[])], label);
  count(h.count, ceiling, label); assert.equal(h.quantileBinWidthMs, 1);
  for (const key of ["p50ApproxMs","p95ApproxMs","maxMs"]) assert(h.count ? Number.isFinite(h[key]) && h[key] >= 0 && h[key] <= 60000 : h[key] === null, `${label}.${key}`);
  if(sum) assert(Number.isFinite(h.sumMs) && h.sumMs >= 0 && h.sumMs <= h.count*60000, `${label}.sumMs`);
};
const profileCounters = ["poolCreated","poolReused","materialVariantInsertions","materialVariantReuses","materialVariantHighWater"];
const profileTimers = ["poolLookupMs","sliceVariantLookupMs","clippedAppearanceMs","sceneUpdateMs","manualTickMs","installClipMs"];
const profile = (p, label) => {
  keys(p, [...profileCounters,...profileTimers], label);
  for(const key of profileCounters) count(p[key], key === "materialVariantHighWater" ? 1000000 : 1e9, `${label}.${key}`);
  for(const key of profileTimers) histogram(p[key], `${label}.${key}`, 100000, true);
  assert(p.materialVariantInsertions+p.materialVariantReuses <= p.sliceVariantLookupMs.count, `${label}: material lookups cover insertions and reuses`);
  assert(p.poolCreated+p.poolReused <= p.poolLookupMs.count, `${label}: pool lookups cover changes`);
};
const sampleNames = ["displayIntervalMs","displayFrameTotalMs","frameProjectionMs","rendererCallMs","totalPresentationMs","pointerTotalMs"];
const cohortNames = ["materialVariantInsertion","aftermathNoNewVariant"];
const validateWindow = (w, label) => {
  keys(w, ["label","mode","sessionGeneration","wallElapsedMs","eligibleActiveMs","eligibleIntervalCount","ineligibleFrameCount","displayCount","pointerRedrawCount","projectionCount","rendererCallCount","hitCount","hitGroupCount","maxHitDelta","aftermathEntriesObserved","aftermathPiecesObserved","maxAftermathPieces","withheldPiecesObserved","errors","valid","invalidReasons","displayGeometry",...sampleNames,"variantProfile","variantCohorts","postHitBurst"], label);
  assert(["native","off"].includes(w.mode)); assert(["before-first-hit","first-hit-burst","steady-after-first-hit"].includes(w.label));
  for(const key of ["sessionGeneration","eligibleIntervalCount","ineligibleFrameCount","displayCount","pointerRedrawCount","projectionCount","rendererCallCount","hitCount","hitGroupCount","maxHitDelta","aftermathEntriesObserved","aftermathPiecesObserved","maxAftermathPieces","withheldPiecesObserved","errors"]) count(w[key],1e9,`${label}.${key}`);
  for(const key of ["wallElapsedMs","eligibleActiveMs"]) assert(Number.isFinite(w[key])&&w[key]>=0&&w[key]<=1e9,`${label}.${key}`);
  assert.equal(typeof w.valid,"boolean"); assert(Array.isArray(w.invalidReasons)&&w.invalidReasons.length<20&&w.invalidReasons.every(x=>typeof x==="string"&&x.length<100));
  for(const key of sampleNames) histogram(w[key],`${label}.${key}`);
  profile(w.variantProfile,`${label}.variantProfile`);
  keys(w.variantCohorts,cohortNames,`${label}.variantCohorts`);
  for(const name of cohortNames){const c=w.variantCohorts[name];keys(c,["frameCount","displayFrameTotalMs","sceneUpdateMs","manualTickMs","rendererCallMs"],name);count(c.frameCount,w.displayCount,`${name}.frameCount`);for(const key of ["displayFrameTotalMs","sceneUpdateMs","manualTickMs","rendererCallMs"])histogram(c[key],`${name}.${key}`,100000);assert.equal(c.displayFrameTotalMs.count,c.frameCount);}
  assert(cohortNames.reduce((n,name)=>n+w.variantCohorts[name].frameCount,0)<=w.displayCount);
  const burst=w.postHitBurst;keys(burst,["triggeredFrameCount","frameCount","displayIntervalMs","displayFrameTotalMs","rendererCallMs","variantProfile"],`${label}.postHitBurst`);
  count(burst.frameCount,w.displayCount,`${label}.burst.frames`);count(burst.triggeredFrameCount,burst.frameCount,`${label}.burst.triggers`);
  for(const key of ["displayIntervalMs","displayFrameTotalMs","rendererCallMs"]){histogram(burst[key],`${label}.burst.${key}`);assert(burst[key].count<=w[key].count);}
  profile(burst.variantProfile,`${label}.burst.profile`);
  for(const key of profileCounters.filter(x=>x!=="materialVariantHighWater")) assert(burst.variantProfile[key]<=w.variantProfile[key]);
  if(w.displayGeometry!==null){keys(w.displayGeometry,["backingWidth","backingHeight","devicePixelRatio","viewportWidth","viewportHeight"],`${label}.geometry`);for(const value of Object.values(w.displayGeometry))assert(Number.isFinite(value)&&value>0&&value<=16384);}else assert.equal(w.displayCount,0);
};
const assertSource = value => {
  keys(value,["schema","version","packageVersion","sources"],"source manifest");
  assert.equal(value.schema,"aerobeat/flow_centerline_source_manifest");assert.equal(value.version,1);
  assert(/^0\.0\.\d+$/u.test(value.packageVersion));
  assert.equal(Object.keys(value.sources).length,15);
  for(const [name,source] of Object.entries(value.sources)){assert(/^@aerobeat\/web-[a-z-]+$/u.test(name));keys(source,["commit","tree","sourceSha256"],name);assert(/^[0-9a-f]{40}$/u.test(source.commit)&&/^[0-9a-f]{40}$/u.test(source.tree)&&hex(source.sourceSha256));}
  assert.equal(value.sources["@aerobeat/web-renderer"].commit,"9f72a3ea2b890a29c3cb3c42176b97bcd101c282");
  assert.equal(value.sources["@aerobeat/web-renderer"].tree,"604e32a846ae5464905767e3e60e0e605361ff74");
};
const local = JSON.parse(await readFile(resolve(output,"flow-centerline-bundle-manifest.json"),"utf8"));
// Parent integration hook: bundleManifest must be asynchronously fetched from
// this exact sidecar and embedded in the actual downloaded v3 report, never
// inferred from the preview URL or copied from an unrelated historical build.
keys(local,["schema","version","sourceManifest","buildStamp","html","js"],"bundle manifest");
assert.equal(local.schema,"aerobeat/flow_centerline_bundle_manifest");assert.equal(local.version,1);assertSource(local.sourceManifest);
assert.equal(local.buildStamp,`FLOW-CENTERLINE-EXPERIMENTAL-${local.sourceManifest.packageVersion}-${digest(Buffer.from(JSON.stringify(local.sourceManifest))).slice(0,24)}`);
const asset = (entry, pattern) => {keys(entry,["path","bytes","sha256"],"asset");assert(pattern.test(entry.path));count(entry.bytes,100000000,"asset.bytes");assert(entry.bytes>0&&hex(entry.sha256));};
asset(local.html,/^flow-centerline-test\.html$/u);assert(Array.isArray(local.js)&&local.js.length>0&&local.js.length<100);
// Hash exact served Vite chunks AND copied static MediaPipe JS; neither a
// nested script nor an unsafe path may bypass the sidecar parity checks.
const viteChunk=/^assets\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*-[A-Za-z0-9_-]+\.js$/u;
const mediapipeStatic=/^assets\/mediapipe\/(?:wasm\/)?[A-Za-z0-9_-]+\.js$/u;
for(const entry of local.js){asset(entry,/^assets\//u);assert(viteChunk.test(entry.path)||mediapipeStatic.test(entry.path),`${entry.path}: safe built JS asset path`);}
assert(local.js.some(entry=>viteChunk.test(entry.path)),"manifest must include a hashed Vite entry");
assert.equal(new Set(local.js.map(x=>x.path)).size,local.js.length);
for(const entry of [local.html,...local.js]){const bytes=await readFile(resolve(output,entry.path));assert.equal(bytes.length,entry.bytes);assert.equal(digest(bytes),entry.sha256,`${entry.path}: local build changed after manifest`);}
const fetchAsset = async entry => {const response=await fetch(new URL(`/${entry.path}`,target),{cache:"no-store"});assert.equal(response.status,200,`${entry.path}: served status`);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,entry.bytes,`${entry.path}: served byte count`);assert.equal(digest(bytes),entry.sha256,`${entry.path}: served SHA-256`);return bytes;};
const servedHtml=(await fetchAsset(local.html)).toString("utf8");
assert.match(servedHtml,/<aero-game/u);for(const entry of local.js)await fetchAsset(entry);
assert(local.js.some(entry=>servedHtml.includes(`/${entry.path}`)),"HTML references a verified built JS asset");
const code=(await Promise.all(local.js.map(entry=>readFile(resolve(output,entry.path),"utf8")))).join("\n");
assert(code.includes(local.buildStamp),"built JavaScript embeds the same build stamp");

// The parent document is deliberately localhost while the preview child is
// 127.0.0.1: two actual origins; the child runs the identical scorer fixture.
const parent=createServer((_request,response)=>{response.writeHead(200,{"content-type":"text/html; charset=utf-8"});response.end(`<!doctype html><style>html,body{margin:0}iframe{width:390px;height:844px;border:0}</style><iframe allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${target.href}"></iframe>`);});
await new Promise(resolve=>parent.listen(0,"localhost",resolve));
const address=parent.address();assert(address&&typeof address!=="string");
const parentUrl=`http://localhost:${address.port}/`;
const chart=new TextEncoder().encode(JSON.stringify({_version:"2.0.0",_events:[],_notes:[{_time:6,_lineIndex:1,_lineLayer:1,_type:0,_cutDirection:8},{_time:7,_lineIndex:2,_lineLayer:1,_type:1,_cutDirection:8},{_time:8,_lineIndex:1,_lineLayer:1,_type:0,_cutDirection:8},{_time:8,_lineIndex:0,_lineLayer:1,_type:0,_cutDirection:8},{_time:10,_lineIndex:1,_lineLayer:1,_type:0,_cutDirection:8}],_obstacles:[]}));
const fixtureSha256=digest(chart);
const evidenceDir=resolve(root,".tmp","flow-centerline-phone-visual",local.buildStamp);
await mkdir(evidenceDir,{recursive:true});
const region=(image,width,box,predicate)=>{let pixels=0;for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++){const i=4*(y*width+x);if(predicate(image[i],image[i+1],image[i+2]))pixels++;}return pixels;};
const gray=(image,width,box)=>region(image,width,box,(r,g,b)=>r>=90&&r<=150&&g>=90&&g<=150&&b>=90&&b<=150&&Math.max(r,g,b)-Math.min(r,g,b)<35);
let browser;
try{
  browser=await chromium.launch({headless:true});
  for(const embedding of ["direct","genuine_cross_origin_iframe"]){
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    try{
      const response=await page.goto(embedding==="direct"?target.href:parentUrl,{waitUntil:"networkidle"});assert.equal(response?.status(),200);
      const frame=embedding==="direct"?page:page.frames().find(f=>f!==page.mainFrame()&&f.url().startsWith(target.origin));assert(frame,`${embedding}: genuine child loaded`);
      if(embedding!=="direct")assert.notEqual(new URL(frame.url()).origin,new URL(page.url()).origin);
      const game=frame.locator("aero-game");
      await frame.waitForFunction(()=>document.querySelector("aero-game")?.graph?.authoring?.getCapabilities?.().conversionWorker===true);
      await frame.waitForFunction(()=>document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state==="ready");
      assert.doesNotMatch(await frame.locator("#faint-hit-state").innerText(),/DIAGNOSTIC INACTIVE/u);
      const imported=await game.evaluate(async(element,chartBytes)=>{
        const wav=seconds=>{const rate=8000,len=rate*seconds*2,buffer=new ArrayBuffer(44+len),view=new DataView(buffer);const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};text(0,"RIFF");view.setUint32(4,36+len,true);text(8,"WAVEfmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,"data");view.setUint32(40,len,true);return new Uint8Array(buffer);};
        const chart=Uint8Array.from(chartBytes),audio=wav(20),info=new TextEncoder().encode("{}");
        const hash=async bytes=>`sha256:${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("")}`;
        const [difficultyHash,audioHash]=await Promise.all([hash(chart),hash(audio)]);
        const entries=new Map([["Info.dat",info],["Easy.dat",chart],["song.wav",audio]]);
        const source=Object.freeze({manifest:Object.freeze({schemaId:"aerobeat.beatsaver-source-manifest.v2",infoFormatMajor:2,infoFormat:"v2",infoVersion:"2.0.0",infoPath:"Info.dat",hashInputPaths:Object.freeze(["Easy.dat"]),songName:"QA Deterministic Silence",songSubName:"",songAuthorName:"AeroBeat",levelAuthorName:"AeroBeat QA",bpm:120,audioPath:"song.wav",coverPath:"",previewStartSeconds:0,previewDurationSeconds:0,difficulties:Object.freeze([Object.freeze({characteristic:"Standard",difficulty:"Easy",difficultyRank:1,path:"Easy.dat",beatMapFormatMajor:2,beatMapFormat:"v2",beatMapVersion:"2.0.0",notePalette:null,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:1})]),entries:Object.freeze([]),archiveBytes:chart.length+audio.length+info.length,expandedBytes:chart.length+audio.length+info.length}),listEntryPaths(){return Object.freeze(["Info.dat","Easy.dat","song.wav"]);},readEntry(path){const data=entries.get(path);if(!data)throw Error("fixture entry missing");return Uint8Array.from(data);}});
        const authored=await element.graph.authoring.convertAllStandardAndPersist({providerId:"beatsaver",sourceHash:"0123456789abcdef0123456789abcdef01234567",source},{sourceProvider:"beatsaver",sourceId:"QA-LOCAL",sourceVersionHash:"0123456789abcdef0123456789abcdef01234567",expectedAudioContentHash:audioHash,expectedDifficultyContentHashes:{"Easy.dat":difficultyHash},includeAudio:true,cacheSourceEntries:true});
        const loaded=await element.graph.authoring.loadPackage(authored.defaultPackage.handle);if(loaded.package.packageId!==authored.defaultPackage.packageId)throw Error("package identity changed");
        await element.refreshLibrary(element.connectedGeneration,{autoSelect:false});await element.requestLibrarySelection(authored.collection.collectionId,authored.defaultPackage.packageId);
        const selected=element.graph.content.getSnapshot();return {ready:selected.state==="ready",selected:selected.packageId===authored.defaultPackage.packageId,flow:selected.variants?.some(v=>v.mode==="flow"),worker:element.graph.authoring.getCapabilities().conversionWorker};
      },[...chart]);assert.deepEqual(imported,{ready:true,selected:true,flow:true,worker:true});
      await game.locator("aero-session-actions").getByRole("button",{name:"Test",exact:true}).click();
      await frame.waitForFunction(()=>document.querySelector("aero-game")?.graph?.gameplay?.getSnapshot?.().session?.state==="playing");
      const modes=[];
      for(const [label,off] of [["native",false],["off",true],["restored",false]]){
        await game.evaluate(async element=>{await element.startSession("visual_test",{requireDownloaded:false});element.setMenuOpen(false);await element.menuPauseTail;element.setTestEquipmentVisible(true);element.setTestAutomaticFeedbackEnabled(false);element.setTestEquipmentMouseHand("left");element.stopFrameLoop();element.audioSyncPending=false;});
        const options=frame.locator("#faint-hit-diagnostic");if(!await options.evaluate(x=>x.open))await options.locator("summary").click();
        await frame.locator("#faint-hit-off").setChecked(off);assert.equal(await frame.locator("#faint-hit-off").isChecked(),off);await options.locator("summary").click();
        const result=await game.evaluate(async element=>{
          const renderer=element.graph.renderer,canvas=element.canvasElement(),camera=renderer.cameraEntity.camera,box=canvas.getBoundingClientRect(),device=renderer.app.graphicsDevice.clientRect,Vec3=renderer.cameraEntity.getPosition().constructor;
          const buffer=document.createElement("canvas");buffer.width=canvas.width;buffer.height=canvas.height;const ctx=buffer.getContext("2d",{willReadFrequently:true});
          const capture=()=>{element.renderGameplay();ctx.drawImage(canvas,0,0);const snap=element.graph.gameplay.getSnapshot(),scene=renderer.lastModel?.objects??[];return {image:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data),hitCount:snap.judgements.filter(j=>j.result==="hit").length,scoreHits:snap.scorePartitions.reduce((n,s)=>n+(s.hits??0),0),localOnly:snap.scorePartitions.some(s=>s.hits>0&&s.localOnly===true&&s.ranked===false),great:scene.filter(o=>o.kind==="feedback"&&o.feedback?.text==="Great").length,live:scene.filter(o=>o.kind==="icon"&&o.state!=="hit").length,halves:[...renderer.aftermathAssetPools.values()].flat().filter(e=>e.enabled).length,modelHalves:scene.filter(o=>o.kind==="aftermath").length,saber:[...renderer.equipmentPools.values()].flat().some(e=>e.enabled),environment:renderer.describe().environment?.state,session:snap.session.state};};
          const pos=(x,y)=>{const p=camera.worldToScreen(new Vec3(-2+4*x,2.5-3*y,.45));const client={x:box.left+p.x/device.width*box.width,y:box.top+p.y/device.height*box.height};if(!renderer.projectDebugEquipmentAnchor(client.x,client.y))throw Error("pointer projection failed");return client;};
          const send=(type,p)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,pointerType:"touch",pointerId:621,isPrimary:true,clientX:p.x,clientY:p.y,buttons:type==="pointerup"?0:1}));
          const tick=async ms=>{await element.graph.audio.seek(ms/1000);await element.graph.audio.play();element.runDisplayFrame();};
          const a=pos(.35,.5),b=pos(.375,.5),c=pos(.425,.5),far=pos(.5,.8);
          send("pointerdown",a);await tick(2650);send("pointermove",far);await tick(2700);const miss=capture();
          send("pointermove",a);await tick(2870);send("pointermove",b);await tick(2920);send("pointermove",c);await tick(2970);const hit=capture();
          await tick(3900);send("pointermove",a);await tick(3950);send("pointermove",b);await tick(4000);const group=capture();send("pointerup",c);
          return {width:canvas.width,height:canvas.height,cvIdle:element.graph.cv.getStatus().running===false,automaticOff:element.testAutomaticFeedbackEnabled===false,quality:renderer.describe().renderScale,desiredQuality:element.desiredGameSetup.renderScale,frames:{miss,hit,group},diagnostic:document.querySelector("#faint-hit-state")?.textContent};
        });
        assert.equal(result.width,390);assert.equal(result.height,844);assert(result.cvIdle&&result.automaticOff);assert.equal(result.quality,1);assert.equal(result.desiredQuality,1);
        assert.equal(result.frames.miss.hitCount,0);assert(result.frames.hit.hitCount>=1&&result.frames.hit.scoreHits>=1&&result.frames.hit.localOnly);
        assert(result.frames.group.hitCount-result.frames.hit.hitCount>=2);
        for(const key of ["hit","group"]){const f=result.frames[key];assert(f.great>0&&f.live>0&&f.saber&&f.environment==="ready"&&f.session==="playing");assert(f.modelHalves>=2);}
        assert.doesNotMatch(result.diagnostic,/DIAGNOSTIC INACTIVE/u);
        const capturePath=resolve(evidenceDir,`${embedding}-${label}.png`);
        const screenshot=await game.locator("canvas[data-role='renderer']").screenshot({path:capturePath});
        assert(screenshot.length>1000&&screenshot.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`${embedding}/${label}: real gameplay canvas screenshot is PNG`);
        const face=[0,405,140,490],first=result.frames.hit.image,group=result.frames.group.image;
        const faces=[gray(first,result.width,face),gray(group,result.width,face)];
        for(const value of faces)assert(off?value<=700:value>=4000,`${embedding}/${label}: actual GLB corpse face ${value}`);
        const g=result.frames.hit.image,w=result.width;
        assert(region(g,w,[4,370,165,412],(r,b,c)=>r+b+c>240)>250,"visible Great pixels");
        assert(region(g,w,[207,335,292,432],(r,g,b)=>g>r*1.45&&g>b*1.18)>600,"live arrow pixels");
        assert(region(g,w,[15,35,375,260],(r,g,b)=>b>r*1.4&&b>g*1.1)>10000,"sky pixels");
        assert(region(g,w,[40,605,360,780],(r,g,b)=>r+g+b>240)>1000,"track pixels");
        assert(region(result.frames.miss.image,w,[174,585,198,782],(r,g,b)=>b>r*1.4&&b>g*1.1)>350,"actual saber pixels");
        if(label==="off"){
          // One same-script negative control: intentionally leak only the corpse
          // scene input on a scored OFF frame, then restore the wrapper in finally.
          // This checks that the pixel oracle, not pool metadata, detects leakage.
          const negative=await game.evaluate(async element=>{
            const renderer=element.graph.renderer,original=renderer.updateSceneObjects,unwrapped=Object.getPrototypeOf(renderer).updateSceneObjects,model=renderer.lastModel?.objects??[];
            if(typeof unwrapped!=="function"||!model.some(x=>x.kind==="aftermath"))throw Error("negative control needs actual scored corpse and unwrapped scene boundary");
            // Bypass only the recorder's off-mode scene wrapper for one render;
            // passing its full model back through the wrapper would re-filter it.
            renderer.updateSceneObjects=function(objects,...rest){return unwrapped.call(this,objects.every(x=>x.kind!=="aftermath")?model:objects,...rest);};
            try{element.renderGameplay();const canvas=element.canvasElement(),c=document.createElement("canvas");c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(canvas,0,0);return {image:Array.from(ctx.getImageData(0,0,c.width,c.height).data),width:c.width,halves:[...renderer.aftermathAssetPools.values()].flat().filter(x=>x.enabled).length};}finally{renderer.updateSceneObjects=original;element.renderGameplay();}
          });
          const leakFace=gray(negative.image,negative.width,face);
          assert(negative.halves>=2&&leakFace>=4000,`${embedding}: same-script corpse-off scene leak must turn pixel oracle RED`);
          assert(!(leakFace<=700),`${embedding}: negative leak must fail the unchanged off-face assertion`);
        }
        const button=frame.locator("#faint-hit-download");assert(await button.isVisible()&&await button.isEnabled());const box=await button.boundingBox();assert(box&&box.width>=40&&box.height>=40&&box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844);
        const transfer=page.waitForEvent("download",{timeout:15000});await frame.evaluate(()=>document.querySelector("#faint-hit-download").click());const download=await transfer;const text=await readFile(await download.path(),"utf8"),data=JSON.parse(text);
        assert.equal(download.suggestedFilename(),`aerobeat-flow-centerline-v3-${off?"off":"native"}.json`);
        assert(text.length>100&&text.length<250000);keys(data,["schema","version","packageVersion","sourceManifest","buildStamp","bundleManifest","served8445SourceParity","historicalSourceParity","gpuTiming","currentMode","measurements","coverage","windows"],"v3 report");
        assert.equal(data.schema,"aerobeat/flow_centerline_diagnostic");assert.equal(data.version,3);assert.equal(data.packageVersion,local.sourceManifest.packageVersion);assert.deepEqual(data.sourceManifest,local.sourceManifest);assert.equal(data.buildStamp,local.buildStamp);assert.deepEqual(data.bundleManifest,local,"downloaded manifest must match independently hashed served HTML and JS");
        assert.equal(data.currentMode,off?"off":"native");assert.equal(data.served8445SourceParity,false);assert.equal(data.historicalSourceParity,false);assert.match(data.gpuTiming,/unmeasured/iu);
        assert(Array.isArray(data.windows)&&data.windows.length>0&&data.windows.length<=32);for(const [i,win] of data.windows.entries())validateWindow(win,`${embedding}/${label}/window-${i}`);
        const attributed=data.windows.filter(win=>win.mode===data.currentMode&&win.valid&&win.hitCount>0&&win.rendererCallCount>0&&win.displayFrameTotalMs.count>0);
        assert(attributed.length>0,`${label}: attributed scored window`);
        assert(attributed.some(win=>win.label==="first-hit-burst"&&win.postHitBurst.triggeredFrameCount>0),`${label}: first hit has burst window`);
        assert(data.windows.some(win=>win.mode===data.currentMode&&win.label==="before-first-hit"&&win.displayCount>0),`${label}: sampled pre-hit window`);
        assert(attributed.some(win=>win.displayIntervalMs.count>0&&win.postHitBurst.displayFrameTotalMs.count>0),`${label}: sampled hit intervals and aftermath`);
        if(off){assert(attributed.some(win=>win.withheldPiecesObserved>0));for(const win of attributed){assert.equal(win.withheldPiecesObserved,win.aftermathPiecesObserved);for(const key of profileCounters)assert.equal(win.variantProfile[key],0);for(const name of cohortNames)assert.equal(win.variantCohorts[name].frameCount,0);assert(win.variantProfile.sceneUpdateMs.count>0&&win.variantProfile.manualTickMs.count>0);}}
        else assert(attributed.some(win=>win.aftermathPiecesObserved>0&&win.withheldPiecesObserved===0&&win.variantProfile.materialVariantInsertions>0&&win.variantProfile.materialVariantHighWater>0&&win.variantCohorts.materialVariantInsertion.frameCount>0&&win.variantCohorts.aftermathNoNewVariant.frameCount>0),"native has bounded pooled-variant insertion and reuse cohorts, not GPU compile measurements");
        assert(!/"(?:eventId|sourceEventIds|chart|audioBytes|pointerPosition|clientX|clientY|judgements|scorePartitions|videoFrame|cvFrame|cutPlane|materialKey|variantKey|cacheKey|frameSamples|rawFrames)"/iu.test(text),"report contains no raw note, touch, frame or material keys");
        // Retain only validated synthetic browser JSON for exact build QA; the
        // operator's paired physical-phone reports remain a separate requirement.
        await writeFile(resolve(evidenceDir,`${embedding}-${label}-synthetic-v3.json`),text,{flag:"w"});
        modes.push({label,off,faces,score:result.frames.hit.scoreHits,hitCount:result.frames.hit.hitCount,currentMode:data.currentMode});
      }
      assert.equal(modes[0].hitCount,modes[1].hitCount);assert.equal(modes[1].hitCount,modes[2].hitCount);
      assert.equal(modes[0].score,modes[1].score);assert.equal(modes[1].score,modes[2].score);
      assert.equal(modes[0].currentMode,"native");assert.equal(modes[1].currentMode,"off");assert.equal(modes[2].currentMode,"native");
      assert.equal(errors.length,0,`${embedding}: page errors ${JSON.stringify(errors)}`);
      console.log(`PASS ${embedding}: imported scored native/off/restored GLB pixels, bounded v3 downloads, exact served manifest; fixture sha256=${fixtureSha256}; actual-canvas PNG=${evidenceDir}`);
    }finally{await context.close();}
  }
}finally{await browser?.close();await new Promise(resolve=>parent.close(resolve));}
