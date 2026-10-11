// @ts-check
// QA-only full-app proof: imported project-owned chart plus silent WAV, never Faint.
// Run in the isolated pinned stage against its explicitly mixed-era loopback preview.
// An actual judged Test touch, not synthetic automatic feedback, is mandatory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
// Opaque gray corpse face shades blend against the photosphere. A narrow
// neutral-only classifier (RGB 70..170, spread <12) inverted the result on
// saved failures (native/restored/off=1/1/54). This empirically bounded shade
// band separates the actual opaque face from the revealed blue note and sky.
const corpseGray=(image,geometry,box)=>{
  let count=0;
  for(let y=Math.max(0,Math.floor(box[1]));y<Math.min(geometry.backingHeight,Math.ceil(box[3]));y++)for(let x=Math.max(0,Math.floor(box[0]));x<Math.min(geometry.backingWidth,Math.ceil(box[2]));x++){
    const i=4*(y*geometry.backingWidth+x),r=image[i],g=image[i+1],b=image[i+2];
    if(r>=90&&r<=150&&g>=90&&g<=150&&b>=90&&b<=150&&Math.max(r,g,b)-Math.min(r,g,b)<35)count++;
  }
  return count;
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
  assert.equal(initial.root,"MAIN");
  assert.doesNotMatch(initial.diagnostic,/DIAGNOSTIC INACTIVE/u,"scene filter must actually be installed");
  // Named visual state: the portrait game has no obstructive build-era banner,
  // title, or diagnostic copy. Historical provenance stays in downloaded JSON.
  const assertQuietUi=async label=>{
    const visible=await page.locator("body").innerText();
    assert.equal(await page.locator("[aria-label='Historical source warning']").count(),0,`${label}: build warning must be absent`);
    assert.doesNotMatch(await page.title(),/mixed.era|historical|8445|0\.0\.128/iu,`${label}: title must not describe build history`);
    assert.doesNotMatch(visible,/mixed.era|historical|non.parity|NOT served 8445|source parity FALSE/iu,`${label}: visible play UI must not repeat build history`);
  };
  await assertQuietUi("initial portrait");
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
    return {cvIdle:element.graph.cv.getStatus().running===false,automaticOff:element.testAutomaticFeedbackEnabled===false,saberVisible:element.testEquipmentVisible,hand:element.testEquipmentMouseHand,purpose:element.graph.gameplay.getSnapshot().session.purpose,sessionState:element.graph.gameplay.getSnapshot().session.state,backing:[canvas.width,canvas.height],environmentState:status.environment?.state??null};
  });
  assert.equal(setup.purpose,"visual_test");assert.equal(setup.cvIdle,true);assert.equal(setup.automaticOff,true);assert.equal(setup.saberVisible,true);assert.equal(setup.hand,"left");
  await assertQuietUi("eligible playing portrait");
  const recorderStatus=page.locator("#faint-hit-recording"),recorderCounts=page.locator("#faint-hit-state");
  await page.waitForFunction(()=>/recording/i.test(document.querySelector("#faint-hit-recording")?.textContent??""),null,{timeout:5000});
  assert.match(await recorderStatus.innerText(),/recording/i,"eligible playing state must visibly announce Recording");
  assert.equal(await recorderStatus.isVisible(),true,"Recording status must be visible while playing");
  const exportButton=page.locator("#faint-hit-download");
  assert.equal(await exportButton.isVisible(),true,"playing export must be exposed without opening a disclosure");
  assert.equal(await exportButton.isEnabled(),true,"playing export must be enabled");
  const exportBox=await exportButton.boundingBox();
  assert(exportBox&&exportBox.width>=40&&exportBox.height>=40,"playing export has a touch-sized visible target");
  assert(exportBox.x>=0&&exportBox.y>=0&&exportBox.x+exportBox.width<=390&&exportBox.y+exportBox.height<=844,"playing export is within portrait viewport");
  await page.screenshot({path:resolve(evidence,"playing-recorder-before-hit.png")});
  assert.equal(page.viewportSize().width,390);assert.equal(page.viewportSize().height,844);

  const state=async(mode,label)=>{
    await game.evaluate(async element=>{await element.startSession("visual_test",{requireDownloaded:false});element.setMenuOpen(false);await element.menuPauseTail;element.setTestEquipmentVisible(true);element.setTestAutomaticFeedbackEnabled(false);element.setTestEquipmentMouseHand("left");element.stopFrameLoop();element.audioSyncPending=false;});
    const corpseToggle=page.locator("#faint-hit-off"),options=page.locator("#faint-hit-diagnostic");
    if(!await options.evaluate(element=>element.open))await options.locator("summary").click();
    await corpseToggle.setChecked(mode==="off");
    assert.equal(await corpseToggle.isChecked(),mode==="off",`${label}: visible corpse setting must match scene mode`);
    await options.locator("summary").click();
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
        const backing=readFrame(),sceneObjects=renderer.lastModel?.objects??[],quality=renderer.describe(),result={name,geometry:geometry(),renderScale:quality.renderScale,desiredRenderScale:element.desiredGameSetup.renderScale,fullQualityUi:element.shadowRoot.querySelector("select[data-action='render-quality-select']")?.value??null,hitCount:snap.judgements.filter(j=>j.result==="hit").length,missCount:snap.judgements.filter(j=>j.result==="miss").length,scoreHits:snap.scorePartitions.reduce((n,s)=>n+(s.hits??0),0),feedbackCount:frame.targets.filter(t=>t.judgement==="hit").length,greatCount:sceneObjects.filter(o=>o.kind==="feedback"&&o.feedback?.text==="Great").length,targetCount:sceneObjects.filter(o=>o.kind==="icon"&&o.state!=="hit").length,aftermathEntries:frame.aftermath.length,modelHalves:parts.length,visibleHalves:[...renderer.aftermathAssetPools.values()].flat().filter(entity=>entity.enabled).length,environment:renderer.describe().environment?.state??null,cvIdle:element.graph.cv.getStatus().running===false,automaticOff:element.testAutomaticFeedbackEnabled===false,hasSaber:[...renderer.equipmentPools.values()].flat().some(entity=>entity.enabled),sessionState:snap.session.state};
        // The exported report contains scalar counts ONLY; screenshot and raw
        // pixels stay inside this browser test, never in phone diagnostic JSON.
        frames.push(result);return {result,backing:Uint8Array.from(backing),screenshot:offscreen.toDataURL("image/png")};
      };
      const a=pos(.35,.5),b=pos(.375,.5),c=pos(.425,.5),far=pos(.5,.8);
      send("pointerdown",a);await tick(2650);send("pointermove",far);await tick(2700);const miss=renderAndCapture("miss-swing");
      send("pointermove",a);await tick(2870);send("pointermove",b);await tick(2920);send("pointermove",c);await tick(2970);const hit=renderAndCapture("first-hit");
      await tick(3900);send("pointermove",a);await tick(3950);send("pointermove",b);await tick(4000);const group=renderAndCapture("group");
      send("pointerup",c);
      return {frames,captures:[miss,hit,group],mode,label,cvIdle:element.graph.cv.getStatus().running===false,sessionState:element.graph.gameplay.getSnapshot().session.state,score:element.graph.gameplay.getSnapshot().scorePartitions.map(s=>({hits:s.hits,ranked:s.ranked,localOnly:s.localOnly})),warning:document.querySelector("[aria-label='Historical source warning']")?.textContent,diagnostic:document.querySelector("#faint-hit-state")?.textContent};
    },{mode,label});
    assert.doesNotMatch(outcome.diagnostic,/DIAGNOSTIC INACTIVE/u,`${label}: filter integration must remain active`);
    assert.match(await recorderStatus.innerText(),/recording/i,`${label}: playing scored Test must visibly announce Recording`);
    // Fixture advances genuine frames synchronously in one evaluate; wait for
    // the page's normal status refresh instead of invoking its private code.
    await page.waitForFunction(()=>{const text=document.querySelector("#faint-hit-state")?.textContent??"";return /\b[1-9]\d*\s+scored hits\b/iu.test(text)&&/\b[1-9]\d*\s+frames\b/iu.test(text);},null,{timeout:5000}).catch(async cause=>{const observed=await game.evaluate(element=>({sessionGeneration:element.sessionGeneration,session:element.graph.gameplay.getSnapshot().session.state,recording:document.querySelector("#faint-hit-recording")?.textContent,status:document.querySelector("#faint-hit-state")?.textContent,summary:document.querySelector("#faint-hit-summary")?.textContent,body:document.querySelector("#faint-hit-diagnostic")?.outerHTML?.slice(0,350)}));throw new Error(`${label}: visible recorder did not publish scored hit and frame counts; observed=${JSON.stringify(observed)}; captured=${JSON.stringify(outcome.frames.map(frame=>({name:frame.name,hits:frame.hitCount,sessionState:frame.sessionState})))}; ${cause.message}`);});
    const counts=await recorderCounts.innerText();
    assert.match(counts,/\b(?:hits?|scored)\b[^\n]*\b[1-9]\d*\b|\b[1-9]\d*\b[^\n]*\bhits?\b/iu,`${label}: visible recorder must show nonzero hit count`);
    assert.match(counts,/\b(?:samples?|frames?|intervals?)\b[^\n]*\b[1-9]\d*\b|\b[1-9]\d*\b[^\n]*\b(?:samples?|frames?|intervals?)\b/iu,`${label}: visible recorder must show nonzero sample count`);
    await assertQuietUi(`${label} scored playing`);
    await page.screenshot({path:resolve(evidence,`${label}-recorder-after-hit.png`)});
    const captures=[];
    for(const capture of outcome.captures){const filename=`${label}-${capture.result.name}.png`;await writeFile(resolve(evidence,filename),Buffer.from(capture.screenshot.split(",")[1],"base64"));captures.push({name:capture.result.name,backing:Uint8Array.from(capture.backing),scalar:capture.result,filename});}
    delete outcome.captures;
    return {outcome,captures};
  };
  const native=await state("native","native"),off=await state("off","off");
  // A human can save the paired corpse-OFF scored run before switching back.
  // This deliberately precedes the restored/native run; export is never
  // silently reconstructed later from a different mode's report windows.
  const offTransfers=[];
  assert.equal(await game.evaluate(element=>element.graph.gameplay.getSnapshot().session.state),"playing","off export starts while scored Test plays");
  await assertQuietUi("off playing before touch export");
  const offExportButton=page.locator("#faint-hit-download"),offTouchBox=await offExportButton.boundingBox();
  assert(await offExportButton.isVisible()&&await offExportButton.isEnabled(),"off playing export remains human-reachable");
  assert(offTouchBox&&offTouchBox.width>=40&&offTouchBox.height>=40,"off playing export has touch-sized target");
  await page.screenshot({path:resolve(evidence,"off-playing-export-visible.png")});
  const offPlayingTransfer=page.waitForEvent("download",{timeout:15_000});
  await page.touchscreen.tap(offTouchBox.x+offTouchBox.width/2,offTouchBox.y+offTouchBox.height/2);
  offTransfers.push({mode:"off",phase:"off-playing-touch",download:await offPlayingTransfer});
  assert.equal(await game.evaluate(element=>element.graph.gameplay.getSnapshot().session.state),"playing","off touch export must not pause Test");
  await game.evaluate(element=>element.pause("diagnostic_export_off"));
  await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.gameplay?.getSnapshot?.().session?.state!=="playing");
  await page.waitForFunction(()=>/paused/i.test(document.querySelector("#faint-hit-recording")?.textContent??""),null,{timeout:5000});
  assert.equal(await offExportButton.isVisible(),true,"off paused export remains visible");
  await page.screenshot({path:resolve(evidence,"off-paused-export-visible.png")});
  const offPausedTransfer=page.waitForEvent("download",{timeout:15_000});
  await offExportButton.click();
  offTransfers.push({mode:"off",phase:"off-paused-click",download:await offPausedTransfer});
  const restored=await state("native","restored");
  const samples=[native,off,restored],get=(run,name)=>run.captures.find(c=>c.name===name);
  for(const run of samples){
    assert.equal(run.outcome.cvIdle,true);assert.equal(run.outcome.sessionState,"playing","scored Test must remain playing");
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
    for(const capture of run.captures){assert.equal(capture.scalar.cvIdle,true);assert.equal(capture.scalar.automaticOff,true);assert.equal(capture.scalar.sessionState,"playing");assert(capture.scalar.hasSaber,"rendered saber must remain enabled");assert.equal(capture.scalar.desiredRenderScale,1,"Game Setup must retain Full (1.0) quality");assert.equal(capture.scalar.renderScale,1,"actual renderer must use Full 1.0 backing scale");assert.equal(capture.scalar.fullQualityUi,"1","visible render-quality selector must identify Full (1.0)");}
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
    // Independent scored Test runs can shift the corpse animation pose by
    // thousands of pixels; exact native/restored equality was a false oracle.
    // Keep the substantial on/off image difference and protect non-corpse ROIs.
    const boxes={corpse:[0,355,205,490],corpseFace:[0,405,140,490],great:[4,370,165,412],target:name==="group"?[285,300,375,475]:[207,335,292,432],sky:[15,35,375,260],track:[40,605,360,780]};
    const corpse=compareRegion(on.backing,hidden.backing,g,boxes.corpse);
    const restoreDiff=compareRegion(back.backing,hidden.backing,g,boxes.corpse);
    const nativeRestored=compareRegion(on.backing,back.backing,g,boxes.corpse);
    const sky=compareRegion(on.backing,hidden.backing,g,boxes.sky);
    const track=compareRegion(on.backing,hidden.backing,g,boxes.track);
    const great=region(hidden.backing,g,boxes.great),target=region(hidden.backing,g,boxes.target),skyVisible=region(hidden.backing,g,boxes.sky);
    const corpseFace={native:corpseGray(on.backing,g,boxes.corpseFace),off:corpseGray(hidden.backing,g,boxes.corpseFace),restored:corpseGray(back.backing,g,boxes.corpseFace)};
    measured[name]={corpse,restored:restoreDiff,nativeRestored,corpseFace,sky,track,great,target,skyVisible};
    // Measured failing and passing saved captures: native/restored 4,975–5,287
    // gray face pixels (one animated pose 5,123); off 437–527. A high floor
    // and low ceiling reject a missing corpse without demanding pose parity.
    // Check this before whole-ROI differences so a filter-only negative names
    // the semantic assertion itself as the failure boundary.
    assert(corpseFace.native>=4000&&corpseFace.restored>=4000&&corpseFace.off<=700,`${name}: semantic gray corpse face must appear in native/restored and vanish in off`);
    assert(corpse.changed>1000,`${name}: corpse-specific off pixel oracle: native/off ROI must differ for same scored hit`);
    assert(restoreDiff.changed>1000,`${name}: corpse region must return after restoring native`);
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
  // Run the image oracle first: a counterfactual removing only the scene filter
  // must fail above for actual pixels, not merely renderer pool bookkeeping.
  assert.equal(get(off,"first-hit").scalar.visibleHalves,0,"off RED: genuine Test hit must withhold ONLY corpse entities");
  assert.equal(get(off,"group").scalar.visibleHalves,0,"group off withholds all corpse entities");
  assert.equal(errors.length,0,`page errors: ${JSON.stringify(errors)}`);
  // Test the actual user-facing download control, not an internal report()
  // function or this QA script's own scalar summary. Click while Test is
  // eligible, then inspect the browser's downloaded bytes for bounded fields.
  const downloaded=[];
  // The restored run already produced a judged hit and eligible frame samples.
  // A real Playwright touch must reach the on-screen export before any pause.
  assert(get(restored,"first-hit").scalar.hitCount>=1,"playing export requires real scored touch");
  assert.equal(await game.evaluate(element=>element.graph.gameplay.getSnapshot().session.state),"playing","export must happen during Test playing");
  await assertQuietUi("playing before touch export");
  await page.screenshot({path:resolve(evidence,"playing-export-visible.png")});
  const touchBox=await exportButton.boundingBox();
  assert(touchBox&&touchBox.width>=40&&touchBox.height>=40,"playing export remains touch sized after scored hit");
  const touchTransfer=page.waitForEvent("download",{timeout:15_000});
  await page.touchscreen.tap(touchBox.x+touchBox.width/2,touchBox.y+touchBox.height/2);
  const touchDownload=await touchTransfer;
  assert.equal(await game.evaluate(element=>element.graph.gameplay.getSnapshot().session.state),"playing","touch export must not pause Test");
  const transfers=[...offTransfers,{mode:"native",phase:"playing-touch",download:touchDownload}];
  // Preserve a separate after-pause browser download, but never use this
  // programmatic pause as a prerequisite for the playing touch proof.
  await game.evaluate(element=>element.pause("diagnostic_export"));
  await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.gameplay?.getSnapshot?.().session?.state!=="playing");
  await assertQuietUi("paused after touch export");
  await page.waitForFunction(()=>/paused/i.test(document.querySelector("#faint-hit-recording")?.textContent??""),null,{timeout:5000});
  assert.match(await recorderStatus.innerText(),/paused/i,"paused run must have a visible status");
  assert.equal(await exportButton.isVisible(),true,"paused export must remain visible");
  assert.equal(await exportButton.isEnabled(),true,"paused export must remain enabled");
  await page.screenshot({path:resolve(evidence,"paused-export-visible.png")});
  const pausedTransfer=page.waitForEvent("download",{timeout:15_000});
  await exportButton.click();
  transfers.push({mode:"native",phase:"paused-click",download:await pausedTransfer});
  for(const {mode,phase,download} of transfers){
    const text=await readFile(await download.path(),"utf8"),data=JSON.parse(text);
    assert.equal(download.suggestedFilename(),`aerobeat-test-performance-${mode}.json`,`${phase}: neutral performance JSON filename`);
    assert(text.length>100&&text.length<250_000,`${mode}: diagnostic download must stay bounded`);
    assert.equal(data.schema,"aerobeat/faint_hit_diagnostic");assert.equal(data.packageVersion,"0.0.105");
    assert.equal(data.mixedEraAudio,true);assert.equal(data.served8445SourceParity,false);assert.equal(data.cookieRelease0128SourceParity,false);
    assert.deepEqual(data.sourceCommits,{assembly:"382fbfc6b5c9b9f3852e2bfc2a2be32ceeccd408",renderer:"0be921cea14933400bd8afdda809ea4453ea772b",gameplay:"c9c32fc9fcd18964f35e3e283f72f9b146bf22df",contentAuthoring:"f4ee9b4f466660a10d4300354ffd73ecff527d4c",audio:"464fdeff45fc109876a1600f22d3007708d1b07d"});
    assert.equal(data.currentMode,mode);assert.equal(Object.hasOwn(data,"warning"),false,"provenance remains structured, not repeated warning prose");
    assert(Array.isArray(data.windows)&&data.windows.length<=32);
    const topKeys=["schema","version","packageVersion","served8445SourceParity","cookieRelease0128SourceParity","mixedEraAudio","sourceCommits","currentMode","measurements","coverage","windows"];
    const windowKeys=["label","mode","sessionGeneration","wallElapsedMs","eligibleActiveMs","eligibleIntervalCount","ineligibleFrameCount","displayCount","pointerRedrawCount","projectionCount","rendererCallCount","hitCount","hitGroupCount","maxHitDelta","aftermathEntriesObserved","aftermathPiecesObserved","maxAftermathPieces","withheldPiecesObserved","errors","valid","invalidReasons","displayGeometry","displayIntervalMs","displayFrameTotalMs","frameProjectionMs","rendererCallMs","totalPresentationMs","pointerTotalMs","postHitBurst"];
    const histogramKeys=["count","p50ApproxMs","p95ApproxMs","maxMs","quantileBinWidthMs"];
    assert.deepEqual(Object.keys(data).sort(),topKeys.sort(),`${mode}: only bounded provenance and summary keys may download`);
    for(const w of data.windows){
      assert.deepEqual(Object.keys(w).sort(),windowKeys.sort(),`${phase}: only allowed window fields`);
      for(const key of ["displayIntervalMs","displayFrameTotalMs","frameProjectionMs","rendererCallMs","totalPresentationMs","pointerTotalMs"]){assert.deepEqual(Object.keys(w[key]).sort(),histogramKeys.sort());assert(Number.isSafeInteger(w[key].count)&&w[key].count>=0&&w[key].count<=100000,`${mode}: bounded histogram sample count`);}
      assert.deepEqual(Object.keys(w.postHitBurst).sort(),["triggeredFrameCount","frameCount","displayIntervalMs","displayFrameTotalMs","rendererCallMs"].sort(),`${phase}: post-hit burst contains scalar aggregates only`);
      for(const key of ["triggeredFrameCount","frameCount"]){assert(Number.isSafeInteger(w.postHitBurst[key])&&w.postHitBurst[key]>=0&&w.postHitBurst[key]<=100000,`${phase}: bounded post-hit ${key}`);}
      assert(w.postHitBurst.triggeredFrameCount<=w.postHitBurst.frameCount&&w.postHitBurst.frameCount<=w.displayCount,`${phase}: post-hit frames belong to eligible window`);
      for(const key of ["displayIntervalMs","displayFrameTotalMs","rendererCallMs"]){
        const burst=w.postHitBurst[key],whole=w[key];
        assert.deepEqual(Object.keys(burst).sort(),histogramKeys.sort(),`${phase}: ${key} has histogram-only burst summary`);
        assert(Number.isSafeInteger(burst.count)&&burst.count>=0&&burst.count<=whole.count,`${phase}: ${key} burst sample count bounded by full window`);
        assert.equal(burst.quantileBinWidthMs,1,`${phase}: histogram resolution remains bounded`);
        for(const field of ["p50ApproxMs","p95ApproxMs","maxMs"])assert(burst[field]===null||Number.isFinite(burst[field])&&burst[field]>=0&&burst[field]<=60000,`${phase}: ${key}.${field} bounded scalar`);
      }
      if(w.displayGeometry!==null){assert.deepEqual(Object.keys(w.displayGeometry).sort(),["backingWidth","backingHeight","devicePixelRatio","viewportWidth","viewportHeight"].sort());assert(w.displayGeometry.backingWidth===390&&w.displayGeometry.backingHeight===844&&w.displayGeometry.devicePixelRatio===1);}else assert.equal(w.displayCount,0,"unsampled window may omit display geometry");assert(Array.isArray(w.invalidReasons)&&w.invalidReasons.length<20);
    }
    assert(!/"(?:eventId|sourceEventIds|chart|audioBytes|pointerPosition|clientX|clientY|judgements|scorePartitions|videoFrame|cvFrame)"/u.test(text),`${mode}: raw chart/audio/coords/event IDs or scored records must not be exported`);
    const attributed=data.windows.filter(w=>w.mode===mode&&w.valid&&w.hitCount>0&&w.rendererCallCount>0&&w.displayFrameTotalMs?.count>0);
    assert(attributed.length>0,`${mode}: download must contain a valid attributed hit window with renderer and display samples`);
    const intervals=attributed.reduce((n,w)=>n+(w.displayIntervalMs?.count??0),0);
    assert(intervals>0&&attributed.some(w=>w.eligibleIntervalCount>0),`${mode}: synthetic consecutive eligible display intervals required`);
    const burstWindows=attributed.filter(w=>w.postHitBurst.triggeredFrameCount>0&&w.postHitBurst.frameCount>0&&w.postHitBurst.displayFrameTotalMs.count>0&&w.postHitBurst.rendererCallMs.count>0);
    assert(burstWindows.length>0,`${phase}: real scored hits must yield bounded post-hit frame and renderer samples`);
    assert(burstWindows.some(w=>w.postHitBurst.displayIntervalMs.count>0),`${phase}: scored run must include a post-hit display interval sample`);
    // Compare the actual user-downloaded paired reports at the same scored,
    // valid post-hit boundary: OFF really withheld corpse scene objects, while
    // native observed those same objects without withholding any of them.
    if(mode==="off"){
      assert(attributed.some(w=>w.withheldPiecesObserved>0),`${phase}: real corpse-OFF hit window must withhold scene pieces`);
      assert(burstWindows.some(w=>w.aftermathPiecesObserved>0&&w.withheldPiecesObserved>0),`${phase}: valid OFF scored post-hit window must observe and withhold corpse pieces`);
    }else{
      assert(burstWindows.some(w=>w.aftermathPiecesObserved>0&&w.withheldPiecesObserved===0),`${phase}: valid native scored post-hit window must observe corpse pieces without withholding them`);
    }
    // The QA fixture seeks among hand-picked music times while the real app
    // judges touch. Intervals therefore prove only synthetic tick coverage;
    // they are never physical-phone cadence or FPS measurements.
    downloaded.push({mode,phase,filename:download.suggestedFilename(),bytes:text.length,windows:data.windows.length,coverage:"project-owned fixture; synthetic audio seek and manually invoked display frames; not continuous RAF, phone FPS, or served 8445 parity",attributed:attributed.map(w=>({label:w.label,hitCount:w.hitCount,rendererCallCount:w.rendererCallCount,intervalCount:w.displayIntervalMs?.count??0,frameCount:w.displayFrameTotalMs.count,aftermathPiecesObserved:w.aftermathPiecesObserved,withheldPiecesObserved:w.withheldPiecesObserved,valid:w.valid,geometry:w.displayGeometry})),syntheticIntervalSamples:intervals,postHitBurst:burstWindows.map(w=>({label:w.label,triggeredFrameCount:w.postHitBurst.triggeredFrameCount,frameCount:w.postHitBurst.frameCount,intervalCount:w.postHitBurst.displayIntervalMs.count,displayFrameCount:w.postHitBurst.displayFrameTotalMs.count,rendererCount:w.postHitBurst.rendererCallMs.count}))});
    await writeFile(resolve(evidence,`diagnostic-download-${phase}.json`),text);
  }
  // Named ineligible state: restore a fresh Test without changing the chart;
  // automatic feedback ON must show setup guidance instead of pretending to record.
  await game.evaluate(async element=>{await element.startSession("visual_test",{requireDownloaded:false});element.setMenuOpen(false);await element.menuPauseTail;element.setTestAutomaticFeedbackEnabled(true);});
  await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.gameplay?.getSnapshot?.().session?.state==="playing");
  await page.waitForFunction(()=>/automatic feedback|needs setup|set up|not recording/i.test(`${document.querySelector("#faint-hit-recording")?.textContent??""} ${document.querySelector("#faint-hit-state")?.textContent??""}`),null,{timeout:5000});
  const ineligibleStatus=`${await recorderStatus.innerText()} ${await recorderCounts.innerText()}`;
  assert.match(ineligibleStatus,/automatic feedback|needs setup|set up|not recording/i,"ineligible playing state must explain needed setup");
  assert.doesNotMatch(ineligibleStatus,/^recording\b/iu,"ineligible Test must not falsely claim recording");
  await assertQuietUi("ineligible setup prompt");
  await page.screenshot({path:resolve(evidence,"playing-ineligible-setup-prompt.png")});
  const summary={schema:"aerobeat/faint_hit_browser_qa",version:1,fixture:"project-owned deterministic imported V2 chart and generated silence, NOT Faint",sourceChartSha256:chartHash,served8445SourceParity:false,mixedEraAudio:true,sourceCommits:{assembly:"382fbfc6b5c9b9f3852e2bfc2a2be32ceeccd408",renderer:"0be921cea14933400bd8afdda809ea4453ea772b",gameplay:"c9c32fc9fcd18964f35e3e283f72f9b146bf22df",contentAuthoring:"f4ee9b4f466660a10d4300354ffd73ecff527d4c",audio:"464fdeff45fc109876a1600f22d3007708d1b07d"},geometry:JSON.parse(geometry),pixelRegions:measured,states:Object.fromEntries(samples.map(run=>[run.outcome.label,{mode:run.outcome.mode,frames:run.outcome.frames,score:run.outcome.score,screenshots:run.captures.map(c=>c.filename)}])),diagnosticDownloads:downloaded,consolePageErrors:errors};
  assertScalar(summary);
  await writeFile(resolve(evidence,"qa-summary.json"),JSON.stringify(summary,null,2));
  console.log("PASS real imported Test touch; named portrait screenshots and scalar summary:",evidence);
}finally{await browser?.close();}
