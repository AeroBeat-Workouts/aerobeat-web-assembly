// @ts-check
// QA-only full-app proof: imported project-owned chart plus silent WAV, never Faint.
// Run in the isolated pinned stage against its explicitly mixed-era loopback preview.
// An actual judged Test touch, not synthetic automatic feedback, is mandatory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = process.env.AEROBEAT_FAINT_QA_EVIDENCE || resolve(root, ".plans/evidence/faint-hit-browser");
const url = process.env.AEROBEAT_FAINT_QA_URL || "http://127.0.0.1:4181/faint-hit-test.html";
const notes = [
  { beat:6,x:1,y:1,hand:0 }, { beat:7,x:2,y:1,hand:1 },
  { beat:8,x:1,y:1,hand:0 }, { beat:8,x:0,y:1,hand:0 },
  { beat:10,x:1,y:1,hand:0 }
];
const chart = new TextEncoder().encode(JSON.stringify({ _version:"2.0.0",_events:[],_notes:notes.map(n=>({ _time:n.beat,_lineIndex:n.x,_lineLayer:n.y,_type:n.hand,_cutDirection:8 })),_obstacles:[] }));
const chartHash = createHash("sha256").update(chart).digest("hex");
const assertScalar = result => assert.equal(/eventId|sourceEventIds|_notes|\.wav|"anchors"|pointerPosition/u.test(JSON.stringify(result)),false,"QA summary contains no raw event/chart/audio/touch data");
const region = (image, geometry, box) => {
  let count=0, lit=0, red=0, blue=0, green=0, sum=0;
  const left=Math.max(0,Math.floor(box[0])),top=Math.max(0,Math.floor(box[1]));
  const right=Math.min(geometry.backingWidth,Math.ceil(box[2])),bottom=Math.min(geometry.backingHeight,Math.ceil(box[3]));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const i=4*(y*geometry.backingWidth+x),r=image[i],g=image[i+1],b=image[i+2];
    count++;sum+=r+g+b;if(r+g+b>240)lit++;
    if(r>g*1.25&&r>b*1.25)red++;
    if(b>r*1.4&&b>g*1.1)blue++;
    if(g>r*1.45&&g>b*1.18)green++;
  }
  return {count,lit,red,blue,green,sum};
};
const compareRegion=(a,b,geometry,box)=>{
  let changed=0,addedInk=0,removedInk=0,magnitude=0;
  const left=Math.max(0,Math.floor(box[0])),top=Math.max(0,Math.floor(box[1]));
  const right=Math.min(geometry.backingWidth,Math.ceil(box[2])),bottom=Math.min(geometry.backingHeight,Math.ceil(box[3]));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const i=4*(y*geometry.backingWidth+x),ar=a[i],ag=a[i+1],ab=a[i+2],br=b[i],bg=b[i+1],bb=b[i+2];
    const d=Math.abs(ar-br)+Math.abs(ag-bg)+Math.abs(ab-bb);if(d<48)continue;
    changed++;magnitude+=d;
    const ai=Math.max(ar,ag,ab)-Math.min(ar,ag,ab),bi=Math.max(br,bg,bb)-Math.min(br,bg,bb);
    if(ai<70&&ar+ag+ab<570&&bi>90)addedInk++;
    if(bi<70&&br+bg+bb<570&&ai>90)removedInk++;
  }
  return {changed,addedInk,removedInk,magnitude};
};
await mkdir(evidence,{recursive:true});
let browser;
try {
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,acceptDownloads:true});
  context.setDefaultTimeout(20_000);
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  const response=await page.goto(url,{waitUntil:"networkidle"});
  assert.equal(response?.status(),200,"exact disposable diagnostic URL must respond 200");
  await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.authoring?.getCapabilities?.().conversionWorker===true);
  await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state==="ready");
  const game=page.locator("aero-game");
  const initial=await game.evaluate(element=>({title:document.title,warning:document.querySelector("[aria-label='Historical source warning']")?.textContent,root:element.parentElement?.tagName,diagnostic:document.querySelector("#faint-hit-state")?.textContent}));
  assert.match(initial.warning,/NOT served 8445.*NOT source-matched to Cookie 0\.0\.128.*parity FALSE/u);
  assert.equal(initial.root,"MAIN");
  assert.doesNotMatch(initial.diagnostic,/DIAGNOSTIC INACTIVE/u,"scene filter must actually be installed");
  // Imported through real authoring Worker -> persisted collection -> content selection.
  // The bytes never leave page.evaluate; only immutable chart digest is reported.
  const imported=await game.evaluate(async(element,chartBytes)=>{
    const wav=seconds=>{const rate=8000,len=rate*seconds*2,buffer=new ArrayBuffer(44+len),view=new DataView(buffer);const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};text(0,"RIFF");view.setUint32(4,36+len,true);text(8,"WAVEfmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,"data");view.setUint32(40,len,true);return new Uint8Array(buffer);};
    const chart=Uint8Array.from(chartBytes),audio=wav(20),info=new TextEncoder().encode("{}");
    const hash=async bytes=>`sha256:${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("")}`;
    const [difficultyHash,audioHash]=await Promise.all([hash(chart),hash(audio)]);
    const entries=new Map([["Info.dat",info],["Easy.dat",chart],["song.wav",audio]]);
    const source=Object.freeze({manifest:Object.freeze({schemaId:"aerobeat.beatsaver-source-manifest.v2",infoFormatMajor:2,infoFormat:"v2",infoVersion:"2.0.0",infoPath:"Info.dat",hashInputPaths:Object.freeze(["Easy.dat"]),songName:"QA Deterministic Silence",songSubName:"",songAuthorName:"AeroBeat",levelAuthorName:"AeroBeat QA",bpm:120,audioPath:"song.wav",coverPath:"",previewStartSeconds:0,previewDurationSeconds:0,difficulties:Object.freeze([Object.freeze({characteristic:"Standard",difficulty:"Easy",difficultyRank:1,path:"Easy.dat",beatMapFormatMajor:2,beatMapFormat:"v2",beatMapVersion:"2.0.0",notePalette:null,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:1})]),entries:Object.freeze([]),archiveBytes:chart.length+audio.length+info.length,expandedBytes:chart.length+audio.length+info.length}),listEntryPaths(){return Object.freeze(["Info.dat","Easy.dat","song.wav"]);},readEntry(path){const data=entries.get(path);if(!data)throw Error("fixture entry missing");return Uint8Array.from(data);}});
    const authored=await element.graph.authoring.convertAllStandardAndPersist({providerId:"beatsaver",sourceHash:"0123456789abcdef0123456789abcdef01234567",source},{sourceProvider:"beatsaver",sourceId:"QA-LOCAL",sourceVersionHash:"0123456789abcdef0123456789abcdef01234567",expectedAudioContentHash:audioHash,expectedDifficultyContentHashes:{"Easy.dat":difficultyHash},includeAudio:true,cacheSourceEntries:true});
    const loaded=await element.graph.authoring.loadPackage(authored.defaultPackage.handle);
    if(loaded.package.packageId!==authored.defaultPackage.packageId)throw Error("persisted package changed identity");
    await element.refreshLibrary(element.connectedGeneration,{autoSelect:false});
    await element.requestLibrarySelection(authored.collection.collectionId,authored.defaultPackage.packageId);
    const selected=element.graph.content.getSnapshot();
    return {state:selected.state,packageSelected:selected.packageId===authored.defaultPackage.packageId,flow:selected.variants?.some(v=>v.mode==="flow"),worker:element.graph.authoring.getCapabilities().conversionWorker,audioDurationSeconds:element.graph.audio.getSource()?.durationSeconds};
  },[...chart]);
  assert.deepEqual({state:imported.state,packageSelected:imported.packageSelected,flow:imported.flow,worker:imported.worker},{state:"ready",packageSelected:true,flow:true,worker:true});
  await game.locator("aero-session-actions").getByRole("button",{name:"Test",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.gameplay?.getSnapshot?.().session?.state==="playing");
  const setup=await game.evaluate(async element=>{
    element.setMenuOpen(false);await element.menuPauseTail;
    if(!element.setTestEquipmentVisible(true)||!element.setTestAutomaticFeedbackEnabled(false)||!element.setTestEquipmentMouseHand("left"))throw Error("real Test controls unavailable");
    element.stopFrameLoop();element.audioSyncPending=false;
    const canvas=element.canvasElement(),status=element.graph.renderer.describe();
    return {cvIdle:element.graph.cv.getStatus().running===false,automaticOff:element.testAutomaticFeedbackEnabled===false,saberVisible:element.testEquipmentVisible,hand:element.testEquipmentMouseHand,purpose:element.graph.gameplay.getSnapshot().session.purpose,panelCollapsed:!document.querySelector("#faint-hit-diagnostic").open,backing:[canvas.width,canvas.height],environmentState:status.environment?.state??null};
  });
  assert.equal(setup.purpose,"visual_test");assert.equal(setup.cvIdle,true);assert.equal(setup.automaticOff,true);assert.equal(setup.saberVisible,true);assert.equal(setup.hand,"left");assert.equal(setup.panelCollapsed,true);
  assert.equal(page.viewportSize().width,390);assert.equal(page.viewportSize().height,844);

  const state=async(mode,label)=>{
    await game.evaluate(async element=>{await element.startSession("visual_test",{requireDownloaded:false});element.setMenuOpen(false);await element.menuPauseTail;element.setTestEquipmentVisible(true);element.setTestAutomaticFeedbackEnabled(false);element.setTestEquipmentMouseHand("left");element.stopFrameLoop();element.audioSyncPending=false;});
    await page.evaluate(off=>{const input=document.querySelector("#faint-hit-off");input.checked=off;input.dispatchEvent(new Event("change",{bubbles:true}));},mode==="off");
    const outcome=await game.evaluate(async(element,{mode,label})=>{
      const renderer=element.graph.renderer,canvas=element.canvasElement(),camera=renderer.cameraEntity.camera,box=canvas.getBoundingClientRect(),device=renderer.app.graphicsDevice.clientRect,Vec3=renderer.cameraEntity.getPosition().constructor;
      const offscreen=document.createElement("canvas");offscreen.width=canvas.width;offscreen.height=canvas.height;const ctx=offscreen.getContext("2d",{willReadFrequently:true});
      const geometry=()=>({backingWidth:canvas.width,backingHeight:canvas.height,deviceWidth:device.width,deviceHeight:device.height,viewportWidth:innerWidth,viewportHeight:innerHeight,dpr:devicePixelRatio});
      const pos=(x,y)=>{const pixel=camera.worldToScreen(new Vec3(-2+4*x,2.5-3*y,.45));const client={x:box.left+pixel.x/device.width*box.width,y:box.top+pixel.y/device.height*box.height};if(!renderer.projectDebugEquipmentAnchor(client.x,client.y))throw Error(`genuine camera pointer projection failed ${JSON.stringify({x,y,client,canvas:{width:box.width,height:box.height},device:{width:device.width,height:device.height},cameraRect:{x:camera.rect.x,y:camera.rect.y,z:camera.rect.z,w:camera.rect.w},rendererState:renderer.state})}`);return client;};
      const send=(type,p)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,pointerType:"touch",pointerId:621,isPrimary:true,clientX:p.x,clientY:p.y,buttons:type==="pointerup"?0:1}));
      const tick=async ms=>{await element.graph.audio.seek(ms/1000);await element.graph.audio.play();element.runDisplayFrame();};
      const frames=[],readFrame=()=>{ctx.drawImage(canvas,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
      const renderAndCapture=name=>{
        element.renderGameplay();const frame=element.rendererFrame(),snap=element.graph.gameplay.getSnapshot(),parts=renderer.lastModel?.objects?.filter(o=>o.kind==="aftermath")??[];
        const backing=readFrame(),sceneObjects=renderer.lastModel?.objects??[],quality=renderer.describe(),result={name,geometry:geometry(),renderScale:quality.renderScale,desiredRenderScale:element.desiredGameSetup.renderScale,fullQualityUi:element.shadowRoot.querySelector("select[data-action='render-quality-select']")?.value??null,hitCount:snap.judgements.filter(j=>j.result==="hit").length,missCount:snap.judgements.filter(j=>j.result==="miss").length,scoreHits:snap.scorePartitions.reduce((n,s)=>n+(s.hits??0),0),feedbackCount:frame.targets.filter(t=>t.judgement==="hit").length,greatCount:sceneObjects.filter(o=>o.kind==="feedback"&&o.feedback?.text==="Great").length,targetCount:sceneObjects.filter(o=>o.kind==="icon"&&o.state!=="hit").length,aftermathEntries:frame.aftermath.length,modelHalves:parts.length,visibleHalves:[...renderer.aftermathAssetPools.values()].flat().filter(entity=>entity.enabled).length,environment:renderer.describe().environment?.state??null,cvIdle:element.graph.cv.getStatus().running===false,automaticOff:element.testAutomaticFeedbackEnabled===false,hasSaber:[...renderer.equipmentPools.values()].flat().some(entity=>entity.enabled),panelCollapsed:!document.querySelector("#faint-hit-diagnostic").open};
        // The exported report contains scalar counts ONLY; screenshot and raw
        // pixels stay inside this browser test, never in phone diagnostic JSON.
        frames.push(result);return {result,backing:Uint8Array.from(backing),screenshot:offscreen.toDataURL("image/png")};
      };
      const a=pos(.35,.5),b=pos(.375,.5),c=pos(.425,.5),far=pos(.5,.8);
      send("pointerdown",a);await tick(2650);send("pointermove",far);await tick(2700);const miss=renderAndCapture("miss-swing");
      send("pointermove",a);await tick(2870);send("pointermove",b);await tick(2920);send("pointermove",c);await tick(2970);const hit=renderAndCapture("first-hit");
      await tick(3900);send("pointermove",a);await tick(3950);send("pointermove",b);await tick(4000);const group=renderAndCapture("group");
      send("pointerup",c);
      return {frames,captures:[miss,hit,group],mode,label,cvIdle:element.graph.cv.getStatus().running===false,panelCollapsed:!document.querySelector("#faint-hit-diagnostic").open,score:element.graph.gameplay.getSnapshot().scorePartitions.map(s=>({hits:s.hits,ranked:s.ranked,localOnly:s.localOnly})),warning:document.querySelector("[aria-label='Historical source warning']")?.textContent,diagnostic:document.querySelector("#faint-hit-state")?.textContent};
    },{mode,label});
    assert.doesNotMatch(outcome.diagnostic,/DIAGNOSTIC INACTIVE/u,`${label}: filter integration must remain active`);
    const captures=[];
    for(const capture of outcome.captures){const filename=`${label}-${capture.result.name}.png`;await writeFile(resolve(evidence,filename),Buffer.from(capture.screenshot.split(",")[1],"base64"));captures.push({name:capture.result.name,backing:Uint8Array.from(capture.backing),scalar:capture.result,filename});}
    delete outcome.captures;
    return {outcome,captures};
  };
  const native=await state("native","native"),off=await state("off","off"),restored=await state("native","restored");
  const samples=[native,off,restored],get=(run,name)=>run.captures.find(c=>c.name===name);
  for(const run of samples){
    assert.equal(run.outcome.cvIdle,true);assert.equal(run.outcome.panelCollapsed,true);
    assert(run.outcome.score.some(s=>s.hits>0&&s.ranked===false&&s.localOnly===true),"real unranked/local-only scored touch required");
    const miss=get(run,"miss-swing"),hit=get(run,"first-hit"),group=get(run,"group");
    assert.equal(miss.scalar.hitCount,0,"miss-swing cannot manufacture a hit");
    assert(hit.scalar.hitCount>=1&&hit.scalar.scoreHits>=1,"first genuinely judged Test hit required");
    assert(hit.scalar.feedbackCount>=1,"Great feedback must survive scored hit");
    assert.equal(hit.scalar.modelHalves,2,"actual renderer model emits two split halves");
    assert(group.scalar.hitCount-hit.scalar.hitCount>=2&&group.scalar.modelHalves>=4,"group must commit two new overlapping scored hits");
    assert(hit.scalar.greatCount>=1&&group.scalar.greatCount>=1,"Great feedback rendered in first and grouped hits");
    assert(hit.scalar.targetCount>=1&&group.scalar.targetCount>=1,"unspent note targets survive both hit states");
    assert.equal(hit.scalar.environment,"ready","skybox remains ready");
    for(const capture of run.captures){assert.equal(capture.scalar.cvIdle,true);assert.equal(capture.scalar.automaticOff,true);assert.equal(capture.scalar.panelCollapsed,true);assert(capture.scalar.hasSaber,"rendered saber must remain enabled");assert.equal(capture.scalar.desiredRenderScale,1,"Game Setup must retain Full (1.0) quality");assert.equal(capture.scalar.renderScale,1,"actual renderer must use Full 1.0 backing scale");assert.equal(capture.scalar.fullQualityUi,"1","visible render-quality selector must identify Full (1.0)");}
  }
  const geometry=JSON.stringify(native.captures[0].scalar.geometry);
  for(const run of samples)for(const capture of run.captures)assert.equal(JSON.stringify(capture.scalar.geometry),geometry,"portrait viewport, DPR, renderer device and backing must remain identical");
  assert.equal(native.captures[0].scalar.geometry.viewportWidth,390);assert.equal(native.captures[0].scalar.geometry.viewportHeight,844);
  assert(get(native,"first-hit").scalar.visibleHalves>=2,"native GREEN: two visible corpse entities");
  assert(get(restored,"first-hit").scalar.visibleHalves>=2,"restored GREEN: two visible corpse entities");
  assert(get(native,"group").scalar.visibleHalves>2&&get(restored,"group").scalar.visibleHalves>2,"group must have >2 visible overlapping native corpse entities");
  const measured={};
  for(const name of ["first-hit","group"]){
    const on=get(native,name),hidden=get(off,name),back=get(restored,name),g=on.scalar.geometry;
    // The scene is deterministic at the same musical timestamp in every
    // independent real Test run; compare exactly the captured backing pixels.
    const boxes={corpse:[0,355,205,490],great:[4,370,165,412],target:name==="group"?[285,300,375,475]:[207,335,292,432],sky:[15,35,375,260],track:[40,605,360,780]};
    const corpse=compareRegion(on.backing,hidden.backing,g,boxes.corpse);
    const restoreDiff=compareRegion(back.backing,hidden.backing,g,boxes.corpse);
    const nativeRestored=compareRegion(on.backing,back.backing,g,boxes.corpse);
    const sky=compareRegion(on.backing,hidden.backing,g,boxes.sky);
    const track=compareRegion(on.backing,hidden.backing,g,boxes.track);
    const great=region(hidden.backing,g,boxes.great),target=region(hidden.backing,g,boxes.target),skyVisible=region(hidden.backing,g,boxes.sky);
    measured[name]={corpse,restored:restoreDiff,nativeRestored,sky,track,great,target,skyVisible};
    assert(corpse.changed>1000,`${name}: corpse-specific off pixel oracle: native/off ROI must differ for same scored hit`);
    assert(restoreDiff.changed>1000,`${name}: corpse region must return after restoring native`);
    assert(nativeRestored.changed<200,`${name}: repeated native state must reproduce same corpse pixels`);
    assert(sky.changed<200&&track.changed<200,`${name}: skybox and track pixels must remain unchanged by corpse switch`);
    assert(great.lit>250,`${name}: Great stays visibly rendered in off mode`);
    assert(target.green>600,`${name}: retained live target stays visibly green in off mode`);
    assert(skyVisible.blue>10000,`${name}: skybox stays visibly blue in off mode`);
  }
  // The held pointer steers the saber away from the fixed lower-center idle
  // cell during hit/group frames. The miss-swing sample has an unobstructed
  // visible saber at x≈174–198,y≈585–782 in the SAME full-app run. Use that
  // localized region in both modes; sky/track alone cannot satisfy gray+cyan.
  const saberBox=[174,585,198,782],saber={};
  for(const run of samples){
    const miss=get(run,"miss-swing"),stats=region(miss.backing,miss.scalar.geometry,saberBox);
    saber[run.outcome.label]=stats;
    assert(stats.blue>350&&stats.lit>700,`${run.outcome.label}: visible saber pixels must remain in portrait Test, not merely an enabled entity`);
  }
  const saberNativeOff=compareRegion(get(native,"miss-swing").backing,get(off,"miss-swing").backing,get(native,"miss-swing").scalar.geometry,saberBox);
  assert.equal(saberNativeOff.changed,0,"corpse-off must preserve exact saber pixels at matched miss-swing timing");
  measured.saber={...saber,nativeOff:saberNativeOff};
  assert(measured.group.corpse.changed>measured["first-hit"].corpse.changed, "group additional corpse halves must increase localized pixel footprint");
  // Run the image oracle first: a counterfactual removing only the scene filter
  // must fail above for actual pixels, not merely renderer pool bookkeeping.
  assert.equal(get(off,"first-hit").scalar.visibleHalves,0,"off RED: genuine Test hit must withhold ONLY corpse entities");
  assert.equal(get(off,"group").scalar.visibleHalves,0,"group off withholds all corpse entities");
  assert.equal(errors.length,0,`page errors: ${JSON.stringify(errors)}`);
  // Test the actual user-facing download control, not an internal report()
  // function or this QA script's own scalar summary. Click while Test is
  // eligible, then inspect the browser's downloaded bytes for bounded fields.
  const downloaded=[];
  for(const mode of ["native","off"]){
    await page.evaluate(off=>{const control=document.querySelector("#faint-hit-off");control.checked=off;control.dispatchEvent(new Event("change",{bubbles:true}));},mode==="off");
    // The earlier state() calls already contain real scored pointer touches.
    // Export their attributed windows directly rather than manufacturing an
    // extra session whose transport was advanced by QA-owned seek/tick calls.
    assert(get(mode==="off"?off:native,"first-hit").scalar.hitCount>=1,`${mode}: scored touch required before user download`);
    // The panel intentionally collapses during playing Test. End the run
    // through the app's own session control; the finalized scored window is
    // retained, and the download button is then genuinely clickable.
    await game.evaluate(element=>element.pause("diagnostic_export"));
    await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.gameplay?.getSnapshot?.().session?.state!=="playing");
    const panelOpen=await page.locator("#faint-hit-diagnostic").evaluate(panel=>panel.open);
    if(!panelOpen)await page.locator("#faint-hit-diagnostic summary").click();
    assert.equal(await page.locator("#faint-hit-download").isEnabled(),true,`${mode}: download control must remain enabled after Test pause`);
    const transfer=page.waitForEvent("download",{timeout:15_000});
    await page.locator("#faint-hit-download").click();
    const download=await transfer,text=await (await import("node:fs/promises")).readFile(await download.path(),"utf8"),data=JSON.parse(text);
    assert.match(download.suggestedFilename(),new RegExp(`faint-hit-${mode}-historical-nonparity\\.json$`));
    assert(text.length>100&&text.length<250_000,`${mode}: diagnostic download must stay bounded`);
    assert.equal(data.schema,"aerobeat/faint_hit_diagnostic");assert.equal(data.packageVersion,"0.0.105");
    assert.equal(data.mixedEraAudio,true);assert.equal(data.served8445SourceParity,false);
    assert.deepEqual(data.sourceCommits,{assembly:"382fbfc6b5c9b9f3852e2bfc2a2be32ceeccd408",renderer:"0be921cea14933400bd8afdda809ea4453ea772b",gameplay:"c9c32fc9fcd18964f35e3e283f72f9b146bf22df",contentAuthoring:"f4ee9b4f466660a10d4300354ffd73ecff527d4c",audio:"464fdeff45fc109876a1600f22d3007708d1b07d"});
    assert.equal(data.currentMode,mode);assert.match(data.warning,/MIXED ERA.*NOT served 8445.*NOT source-matched to Cookie 0\.0\.128/u);
    assert(Array.isArray(data.windows)&&data.windows.length<=32);
    const topKeys=["schema","version","packageVersion","served8445SourceParity","mixedEraAudio","warning","sourceCommits","currentMode","measurements","coverage","windows"];
    const windowKeys=["label","mode","sessionGeneration","wallElapsedMs","eligibleActiveMs","eligibleIntervalCount","ineligibleFrameCount","displayCount","pointerRedrawCount","projectionCount","rendererCallCount","hitCount","hitGroupCount","maxHitDelta","aftermathEntriesObserved","aftermathPiecesObserved","maxAftermathPieces","withheldPiecesObserved","errors","valid","invalidReasons","displayGeometry","displayIntervalMs","displayFrameTotalMs","frameProjectionMs","rendererCallMs","totalPresentationMs","pointerTotalMs"];
    const histogramKeys=["count","p50ApproxMs","p95ApproxMs","maxMs","quantileBinWidthMs"];
    assert.deepEqual(Object.keys(data).sort(),topKeys.sort(),`${mode}: only bounded provenance and summary keys may download`);
    for(const w of data.windows){assert.deepEqual(Object.keys(w).sort(),windowKeys.sort());for(const key of ["displayIntervalMs","displayFrameTotalMs","frameProjectionMs","rendererCallMs","totalPresentationMs","pointerTotalMs"]){assert.deepEqual(Object.keys(w[key]).sort(),histogramKeys.sort());assert(Number.isSafeInteger(w[key].count)&&w[key].count>=0&&w[key].count<=100000,`${mode}: bounded histogram sample count`);}if(w.displayGeometry!==null){assert.deepEqual(Object.keys(w.displayGeometry).sort(),["backingWidth","backingHeight","devicePixelRatio","viewportWidth","viewportHeight"].sort());assert(w.displayGeometry.backingWidth===390&&w.displayGeometry.backingHeight===844&&w.displayGeometry.devicePixelRatio===1);}else assert.equal(w.displayCount,0,"unsampled window may omit display geometry");assert(Array.isArray(w.invalidReasons)&&w.invalidReasons.length<20);}
    assert(!/"(?:eventId|sourceEventIds|chart|audioBytes|pointerPosition|clientX|clientY|judgements|scorePartitions|videoFrame|cvFrame)"/u.test(text),`${mode}: raw chart/audio/coords/event IDs or scored records must not be exported`);
    const attributed=data.windows.filter(w=>w.mode===mode&&w.valid&&w.hitCount>0&&w.rendererCallCount>0&&w.displayFrameTotalMs?.count>0);
    assert(attributed.length>0,`${mode}: download must contain a valid attributed hit window with renderer and display samples`);
    const intervals=attributed.reduce((n,w)=>n+(w.displayIntervalMs?.count??0),0);
    assert(intervals>0&&attributed.some(w=>w.eligibleIntervalCount>0),`${mode}: synthetic consecutive eligible display intervals required`);
    // The QA fixture seeks among hand-picked music times while the real app
    // judges touch. Intervals therefore prove only synthetic tick coverage;
    // they are never physical-phone cadence or FPS measurements.
    downloaded.push({mode,filename:download.suggestedFilename(),bytes:text.length,windows:data.windows.length,coverage:"project-owned fixture; synthetic audio seek and manually invoked display frames; not continuous RAF, phone FPS, or served 8445 parity",attributed:attributed.map(w=>({label:w.label,hitCount:w.hitCount,rendererCallCount:w.rendererCallCount,intervalCount:w.displayIntervalMs?.count??0,frameCount:w.displayFrameTotalMs.count,valid:w.valid,geometry:w.displayGeometry})),syntheticIntervalSamples:intervals});
    await writeFile(resolve(evidence,`diagnostic-download-${mode}.json`),text);
  }
  const summary={schema:"aerobeat/faint_hit_browser_qa",version:1,fixture:"project-owned deterministic imported V2 chart and generated silence, NOT Faint",sourceChartSha256:chartHash,served8445SourceParity:false,mixedEraAudio:true,sourceCommits:{assembly:"382fbfc6b5c9b9f3852e2bfc2a2be32ceeccd408",renderer:"0be921cea14933400bd8afdda809ea4453ea772b",gameplay:"c9c32fc9fcd18964f35e3e283f72f9b146bf22df",contentAuthoring:"f4ee9b4f466660a10d4300354ffd73ecff527d4c",audio:"464fdeff45fc109876a1600f22d3007708d1b07d"},geometry:JSON.parse(geometry),pixelRegions:measured,states:Object.fromEntries(samples.map(run=>[run.outcome.label,{mode:run.outcome.mode,frames:run.outcome.frames,score:run.outcome.score,screenshots:run.captures.map(c=>c.filename)}])),diagnosticDownloads:downloaded,consolePageErrors:errors};
  assertScalar(summary);
  await writeFile(resolve(evidence,"qa-summary.json"),JSON.stringify(summary,null,2));
  console.log("PASS real imported Test touch; named portrait screenshots and scalar summary:",evidence);
}finally{await browser?.close();}
