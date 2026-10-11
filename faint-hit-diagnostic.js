// Disposable historical 0.0.105 full-app diagnostic. No production source changes.
import "./src/index.js";

const PINS = Object.freeze({ assembly:"382fbfc6b5c9b9f3852e2bfc2a2be32ceeccd408", renderer:"0be921cea14933400bd8afdda809ea4453ea772b", gameplay:"c9c32fc9fcd18964f35e3e283f72f9b146bf22df", contentAuthoring:"f4ee9b4f466660a10d4300354ffd73ecff527d4c", audio:"464fdeff45fc109876a1600f22d3007708d1b07d" });
const game = document.querySelector("aero-game");
const recorder = document.querySelector("#faint-hit-recorder");
const panel = document.querySelector("#faint-hit-diagnostic");
const state = document.querySelector("#faint-hit-state");
const recording = document.querySelector("#faint-hit-recording");
const output = document.querySelector("#faint-hit-summary");
const toggle = document.querySelector("#faint-hit-off");
const download = document.querySelector("#faint-hit-download");
const reset = document.querySelector("#faint-hit-reset");
// The small save control stays available during Test. Only the optional
// details panel expands; it never changes the game canvas or hides export.
// Full-window 1-ms histogram, plus exact scalar max, bounded independently
// of frame rate or window duration. Quantiles are labeled approximations.
const HISTOGRAM_BINS = 60001;
const MAX_WINDOWS = 32;
const MAX_MS = 60000;
const NOW = () => performance.now();
const bounded = (n, limit = 1e7) => Math.min(limit, Math.max(0, Number.isFinite(n) ? n : 0));
let mode = "native", installedGraph = null, installedSession = -1, active = null, lastRafAt = null;
let reportWindows = [], firstHitSeen = false, firstHitStart = null, postHitUntil = null;
let methods = null, samplingPointer = false, samplingRaf = false, installationFailed = false;
let exportNoticeUntil = 0;
const sampleKeys = ["intervals","displayFrame","projection","renderer","presentation","pointer"];
const histogram = () => ({ bins:new Uint32Array(HISTOGRAM_BINS),count:0,max:null,exactMaxValues:null });
const samples = () => ({ intervals:histogram(), displayFrame:histogram(), projection:histogram(), renderer:histogram(), presentation:histogram(), pointer:histogram() });
const hitBurst = () => ({ triggeredFrameCount:0,frameCount:0,intervals:histogram(),displayFrame:histogram(),renderer:histogram() });
let currentFrameSamples = null;
function append(bucket, value) {
  const ms=bounded(value,MAX_MS);
  bucket.bins[Math.min(HISTOGRAM_BINS-1,Math.floor(ms))]++;
  bucket.count++;
  if (bucket.exactMaxValues) bucket.exactMaxValues.push(ms);
  bucket.max=bucket.max===null?ms:Math.max(bucket.max,ms);
}
function remove(bucket, value) {
  const ms=bounded(value,MAX_MS), bin=Math.min(HISTOGRAM_BINS-1,Math.floor(ms));
  if (!bucket.count || bucket.bins[bin] === 0) throw new Error("Diagnostic histogram transfer mismatch");
  bucket.bins[bin]--;bucket.count--;
  if (bucket.exactMaxValues) {
    const index=bucket.exactMaxValues.indexOf(ms);
    if(index<0)throw new Error("Diagnostic maximum transfer mismatch");
    bucket.exactMaxValues.splice(index,1);
    bucket.max=bucket.exactMaxValues.length?Math.max(...bucket.exactMaxValues):null;
  } else if (!bucket.count) bucket.max=null;
}
function timedSample(bucket, value) { append(active[bucket],value); if(currentFrameSamples) currentFrameSamples[bucket].push(bounded(value,MAX_MS)); }
const fresh = (label, now = NOW()) => ({ label, mode, sessionGeneration:installedSession, started:now, end:now, firstEligibleAt:null, lastEligibleAt:null, eligibleActiveMs:0, eligibleIntervalCount:0, ineligibleFrameCount:0, ...samples(), hitBurst:hitBurst(), displayCount:0, pointerRedrawCount:0, hitCount:0, hitGroupCount:0, maxHitDelta:0, aftermathEntriesObserved:0, aftermathPiecesObserved:0, maxAftermathPieces:0, withheldPiecesObserved:0, projectionCount:0, rendererCallCount:0, errors:0, invalidReasons:[], displayGeometry:null });
function summarize(values) {
  if (!values.count) return {count:0,p50ApproxMs:null,p95ApproxMs:null,maxMs:null,quantileBinWidthMs:1};
  const ranks=[Math.ceil(values.count*.5),Math.ceil(values.count*.95)],quantiles=[null,null];
  let seen=0;
  for (let bin=0;bin<values.bins.length && quantiles[1]===null;bin++) {
    seen+=values.bins[bin];
    for(let i=0;i<2;i++)if(quantiles[i]===null && seen>=ranks[i])quantiles[i]=bin+.5;
  }
  return {count:values.count,p50ApproxMs:quantiles[0],p95ApproxMs:quantiles[1],maxMs:Math.round(values.max*1000)/1000,quantileBinWidthMs:1};
}
function endWindow(at = NOW()) {
  if (!active) return;
  active.end = at;
  for(const key of sampleKeys) active[key].exactMaxValues=null;
  if(active.displayCount+active.pointerRedrawCount+active.projectionCount+active.rendererCallCount===0&&!active.invalidReasons.includes("no_eligible_samples"))active.invalidReasons.push("no_eligible_samples");
  reportWindows.push({label:active.label,mode:active.mode,sessionGeneration:active.sessionGeneration,wallElapsedMs:bounded(active.end-active.started),eligibleActiveMs:Math.round(active.eligibleActiveMs*1000)/1000,eligibleIntervalCount:active.eligibleIntervalCount,ineligibleFrameCount:active.ineligibleFrameCount,displayCount:active.displayCount,pointerRedrawCount:active.pointerRedrawCount,projectionCount:active.projectionCount,rendererCallCount:active.rendererCallCount,hitCount:active.hitCount,hitGroupCount:active.hitGroupCount,maxHitDelta:active.maxHitDelta,aftermathEntriesObserved:active.aftermathEntriesObserved,aftermathPiecesObserved:active.aftermathPiecesObserved,maxAftermathPieces:active.maxAftermathPieces,withheldPiecesObserved:active.withheldPiecesObserved,errors:active.errors,valid:active.invalidReasons.length===0,invalidReasons:active.invalidReasons.slice(),displayGeometry:active.displayGeometry,displayIntervalMs:summarize(active.intervals),displayFrameTotalMs:summarize(active.displayFrame),frameProjectionMs:summarize(active.projection),rendererCallMs:summarize(active.renderer),totalPresentationMs:summarize(active.presentation),pointerTotalMs:summarize(active.pointer),postHitBurst:{triggeredFrameCount:active.hitBurst.triggeredFrameCount,frameCount:active.hitBurst.frameCount,displayIntervalMs:summarize(active.hitBurst.intervals),displayFrameTotalMs:summarize(active.hitBurst.displayFrame),rendererCallMs:summarize(active.hitBurst.renderer)}});
  if (reportWindows.length > MAX_WINDOWS) reportWindows.shift();
  active = null;
}
function startWindow(label) { endWindow(); lastRafAt=null; active = fresh(label); if(label === "before-first-hit") for(const key of sampleKeys) active[key].exactMaxValues=[]; }
function currentSession() { return installedGraph?.gameplay?.getSnapshot?.()?.session ?? null; }
function displayGeometry() {
  const canvas=game?.shadowRoot?.querySelector?.("canvas[data-role='renderer']");
  const dimension=value=>Number.isSafeInteger(value)&&value>0&&value<=16384?value:null;
  const dpr=Number(globalThis.devicePixelRatio),viewport=globalThis.visualViewport;
  return {backingWidth:dimension(canvas?.width),backingHeight:dimension(canvas?.height),devicePixelRatio:Number.isFinite(dpr)&&dpr>0&&dpr<=8?Math.round(dpr*1000)/1000:null,viewportWidth:dimension(Math.round(viewport?.width??globalThis.innerWidth)),viewportHeight:dimension(Math.round(viewport?.height??globalThis.innerHeight))};
}
function eligibility() {
  const session=currentSession(),reasons=[];
  if(session?.purpose!=="visual_test")reasons.push("not_visual_test");
  if(session?.state!=="playing")reasons.push("not_playing");
  if(game?.testAutomaticFeedbackEnabled!==false)reasons.push("automatic_feedback_on");
  if(game?.testEquipmentVisible!==true)reasons.push("equipment_hidden");
  if(game?.testEquipmentMouseHand!=="left"&&game?.testEquipmentMouseHand!=="right")reasons.push("hand_not_selected");
  let cvRunning;
  try { cvRunning=installedGraph?.cv?.getStatus?.()?.running; } catch { cvRunning=undefined; }
  if(cvRunning!==false)reasons.push("cv_not_confirmed_idle");
  return reasons;
}
function validateWindow(sampledFrame=false) {
  if(!active || !sampledFrame)return;
  for(const reason of eligibility())if(!active.invalidReasons.includes(reason))active.invalidReasons.push(reason);
  const current=displayGeometry();
  if(active.displayGeometry===null)active.displayGeometry=current;
  if(Object.values(active.displayGeometry).some(value=>value===null)||Object.values(current).some(value=>value===null)) {
    if(!active.invalidReasons.includes("display_geometry_unavailable"))active.invalidReasons.push("display_geometry_unavailable");
  } else if(Object.keys(current).some(key=>active.displayGeometry[key]!==current[key])) {
    if(!active.invalidReasons.includes("display_geometry_changed"))active.invalidReasons.push("display_geometry_changed");
  }
}
function isRealTest() { return eligibility().length===0; }
function withinActiveTest() { return isRealTest(); }
function countHits(snapshot) { const judgements = snapshot?.judgements; if (!Array.isArray(judgements)) return 0; let hits = 0; for (const judgement of judgements) if (judgement?.result === "hit" && judgement?.shadow !== true) hits += 1; return bounded(hits, 100000); }
function recordHits(snapshot, beforeCount) {
  if (!active || !withinActiveTest()) return;
  const count = countHits(snapshot), delta = Math.max(0,count-beforeCount);
  if (!delta) return;
  active.hitCount += delta;
  active.maxHitDelta = Math.max(active.maxHitDelta,delta);
  if (delta > 1) active.hitGroupCount += 1;
  // Keep the hit-bearing frame (including its full display/projection/render)
  // in first-hit-burst; promote its complete samples only after the RAF returns.
  if (!firstHitSeen) { firstHitSeen = true; firstHitStart = NOW(); }
}
function promoteFirstHitFrame(frameStart, frame) {
  if (!active || active.label !== "before-first-hit") return;
  const prior=active, burst=fresh("first-hit-burst",frameStart);
  burst.displayCount=1;
  burst.firstEligibleAt=frameStart;
  burst.lastEligibleAt=frameStart;
  for (const key of sampleKeys) {
    for (const value of frame.samples[key]) { remove(prior[key],value); append(burst[key],value); }
  }
  for (const key of ["projectionCount","rendererCallCount","pointerRedrawCount","hitCount","hitGroupCount","aftermathEntriesObserved","aftermathPiecesObserved","withheldPiecesObserved","errors"]) {
    burst[key]=Math.min(prior[key],frame[key]);prior[key]-=burst[key];
  }
  burst.eligibleActiveMs=frame.eligibleActiveMs;
  burst.eligibleIntervalCount=frame.eligibleIntervalCount;
  prior.eligibleActiveMs=Math.max(0,prior.eligibleActiveMs-burst.eligibleActiveMs);
  prior.eligibleIntervalCount=Math.max(0,prior.eligibleIntervalCount-burst.eligibleIntervalCount);
  burst.maxHitDelta=frame.maxHitDelta;
  burst.maxAftermathPieces=frame.maxAftermathPieces;
  burst.invalidReasons=prior.invalidReasons.slice();
  burst.displayGeometry=prior.displayGeometry;
  prior.maxHitDelta=0;
  prior.displayCount=Math.max(0,prior.displayCount-1);
  // Historical pre-hit maxima may include older frames; retain them there.
  active=prior;endWindow(frameStart);active=burst;
}
function refresh() {
  if (installationFailed) return;
  const connected=Boolean(installedGraph),session=currentSession(),reasons=eligibility();
  const windows=reportWindows.filter(window=>window.sessionGeneration===installedSession&&window.mode===mode);
  const recordedHits=windows.reduce((n,window)=>n+window.hitCount,active?.mode===mode?active.hitCount:0);
  const recordedFrames=windows.reduce((n,window)=>n+window.displayCount,active?.mode===mode?active.displayCount:0);
  const eligible=connected&&reasons.length===0;
  recorder.dataset.gameMenu=game?.menuOpen?"true":"false";
  const notice=NOW()<exportNoticeUntil?" · JSON download requested": "";
  recording.dataset.recording=eligible?"true":"false";
  recording.textContent=eligible?`● Recording · corpses ${mode==="native"?"ON":"OFF"}`:recordedFrames?`● ${session?.state==="playing"?"Needs setup":"Paused"} · ${recordedFrames} frames saved`:`● ${connected?"Waiting for Test setup":"Waiting for game"}`;
  const missing={not_visual_test:"Start Test to record",not_playing:"Start or resume Test",automatic_feedback_on:"Turn Automatic Feedback OFF",equipment_hidden:"Show the saber",hand_not_selected:"Choose a left or right mouse hand",cv_not_confirmed_idle:"CV must be idle"};
  state.textContent=!connected?"Open game and start Test":eligible?`${recordedHits} scored hits · ${recordedFrames} frames${notice}`:recordedFrames&&session?.state!=="playing"?`${recordedHits} scored hits · ${recordedFrames} frames saved${notice}`:`Not recording: ${reasons.map(reason=>missing[reason]??reason).join("; ")}${notice}`;
  if(panel.open) output.textContent=JSON.stringify({mode,activeWindow:active?.label??null,scoredHits:recordedHits,displayFrames:recordedFrames,postHitFrames:active?.hitBurst.frameCount??0,firstHitSeen},null,2);
}
function error(message) { installationFailed=true; if(active)active.errors+=1; recording.dataset.recording="false";recording.textContent="Recorder unavailable";state.textContent=`DIAGNOSTIC INACTIVE: ${message}`;toggle.disabled=true;download.disabled=true; }
function wrapper(object, key, callback) {
  const original = object[key];
  if (typeof original !== "function") throw new Error(`${key} seam missing`);
  const wrapped = function (...args) { return callback.call(this, original, args); };
  object[key] = wrapped;
  return () => { if (object[key] === wrapped) object[key] = original; };
}
function detach() { if (methods) { for (const restore of methods.reverse()) restore(); methods=null; } endWindow(); installedGraph=null; installedSession=-1; lastRafAt=null; postHitUntil=null; samplingRaf=false; samplingPointer=false; currentFrameSamples=null; }
function attach(graph) {
  if (!graph || typeof graph !== "object" || !graph.renderer || typeof graph.renderer.updateSceneObjects !== "function" || typeof graph.renderer.renderGameplayScene !== "function" || typeof graph.renderer.renderGameplayFrameWithCursorsAndEquipment !== "function" || typeof graph.gameplay?.getSnapshot !== "function" || typeof graph.gameplay.advance !== "function" || typeof game?.runDisplayFrame !== "function" || typeof game?.renderGameplay !== "function") throw new Error("historical facade seam missing");
  const restores = [];
  const previousGraph = installedGraph;
  installedGraph = graph;
  try {
    restores.push(wrapper(graph.renderer,"updateSceneObjects",function(original,args) {
      const [objects] = args;
      if (!Array.isArray(objects)) throw new Error("scene objects invalid");
      let pieces = 0;
      for (const object of objects) if (object?.kind === "aftermath") pieces += 1;
      if (active && isRealTest()) {
        validateWindow(true);
        active.aftermathPiecesObserved += pieces;
        active.maxAftermathPieces = Math.max(active.maxAftermathPieces,pieces);
        if (mode === "off") active.withheldPiecesObserved += pieces;
      }
      // Native forwards the IDENTICAL array and guidance. In off, only the
      // immediate scene-entity update omits corpses. Model, handoff, scoring,
      // feedback, cursors, equipment, shadow receiver and draw cadence remain.
      // Even when the off control remains checked, Play, paused Test and
      // synthetic-feedback Test must render byte-for-byte native scene input.
      if (mode === "native" || !isRealTest()) return original.apply(this,args);
      return original.apply(this,[objects.filter(object=>object?.kind !== "aftermath"),...args.slice(1)]);
    }));
    restores.push(wrapper(graph.renderer,"renderGameplayFrameWithCursorsAndEquipment",function(original,args) {
      if (!withinActiveTest()) return original.apply(this,args);
      const before=NOW();try{return original.apply(this,args);}finally {if(active){active.rendererCallCount++;timedSample("renderer",NOW()-before);}}
    }));
    restores.push(wrapper(game,"rendererFrame",function(original,args) {
      if (!samplingRaf || !withinActiveTest()) return original.apply(this,args);
      const before=NOW();try{const frame=original.apply(this,args);if(active){active.projectionCount++;active.aftermathEntriesObserved += Array.isArray(frame?.aftermath)?frame.aftermath.length:0;}return frame;}finally {if(active)timedSample("projection",NOW()-before);}
    }));
    restores.push(wrapper(game,"renderGameplay",function(original,args) {
      if (!withinActiveTest()) return original.apply(this,args);
      const before=NOW();try{return original.apply(this,args);}finally {if(active){timedSample("presentation",NOW()-before);if(samplingPointer){active.pointerRedrawCount++;timedSample("pointer",NOW()-before);}}}
    }));
    // The historical Test transport stops RAF while paused and restarts it
    // without dispatching an ineligible display frame in between.
    for(const key of ["stopFrameLoop","startFrameLoop"]) if(typeof game[key]==="function") {
      restores.push(wrapper(game,key,function(original,args) {
        lastRafAt=null;
        return original.apply(this,args);
      }));
    }
    restores.push(wrapper(game,"runDisplayFrame",function(original,args) {
      // A scored first frame may arrive before the 250-ms identity check.
      // Attribute it to its actual session before measuring or taking snapshots.
      if (installedSession!==game.sessionGeneration) {
        endWindow();installedSession=game.sessionGeneration;firstHitSeen=false;firstHitStart=null;lastRafAt=null;postHitUntil=null;startWindow("before-first-hit");
      }
      const wasRaf=withinActiveTest(),frameStart=NOW(),interval=wasRaf && lastRafAt !== null ? frameStart-lastRafAt : null;
      const withinPostHitBurst=wasRaf&&postHitUntil!==null&&frameStart<=postHitUntil;
      if (active && wasRaf) validateWindow(true);
      const priorEligibleActiveMs=active?.eligibleActiveMs??0,priorEligibleIntervalCount=active?.eligibleIntervalCount??0;
      const before=active ? {projectionCount:active.projectionCount,rendererCallCount:active.rendererCallCount,pointerRedrawCount:active.pointerRedrawCount,hitCount:active.hitCount,hitGroupCount:active.hitGroupCount,aftermathEntriesObserved:active.aftermathEntriesObserved,aftermathPiecesObserved:active.aftermathPiecesObserved,withheldPiecesObserved:active.withheldPiecesObserved,errors:active.errors} : null;
      const hitsBefore=wasRaf?countHits(graph.gameplay.getSnapshot()):null;
      const frameSamples={intervals:[],displayFrame:[],projection:[],renderer:[],presentation:[],pointer:[]};currentFrameSamples=frameSamples;
      if (active && !wasRaf) active.ineligibleFrameCount++;
      if (wasRaf && active) {
        if(active.firstEligibleAt===null)active.firstEligibleAt=frameStart;
        active.lastEligibleAt=frameStart;
        if(interval !== null){timedSample("intervals",interval);active.eligibleActiveMs+=bounded(interval,MAX_MS);active.eligibleIntervalCount++;}
        active.displayCount++;
      }
      lastRafAt=wasRaf?frameStart:null;
      samplingRaf=true;
      try{return original.apply(this,args);}finally {
        // Snapshot comparison is at the mutable app-frame boundary, not a
        // measurement or replacement of the frozen gameplay facade. This
        // includes a scored hit even if the app frame later handles an error.
        if (active && wasRaf) {
          try { recordHits(graph.gameplay.getSnapshot(),hitsBefore); }
          catch { active.errors++; }
          timedSample("displayFrame",NOW()-frameStart);
        }
        samplingRaf=false;currentFrameSamples=null;
        if (active && wasRaf) validateWindow(true);
        const hitBearingFrame=Boolean(active&&before&&wasRaf&&active.hitCount>before.hitCount);
         if (active && before && firstHitSeen && active.label === "before-first-hit" && active.hitCount > before.hitCount) {
          const frame={};for(const key of ["projectionCount","rendererCallCount","pointerRedrawCount","hitCount","hitGroupCount","aftermathEntriesObserved","aftermathPiecesObserved","withheldPiecesObserved","errors"])frame[key]=active[key]-before[key];
          frame.samples=frameSamples;
          frame.eligibleActiveMs=active.eligibleActiveMs-priorEligibleActiveMs;
          frame.eligibleIntervalCount=active.eligibleIntervalCount-priorEligibleIntervalCount;
          frame.maxHitDelta=active.maxHitDelta;frame.maxAftermathPieces=active.maxAftermathPieces;
          promoteFirstHitFrame(frameStart,frame);
        }
        // Aggregate hit-bearing frames and the next 1.2 seconds without retaining
         // per-note identities or individual frame samples in the JSON.
         if(active&&wasRaf&&(hitBearingFrame||withinPostHitBurst)) {
           if(hitBearingFrame) { active.hitBurst.triggeredFrameCount++;postHitUntil=NOW()+1200; }
           active.hitBurst.frameCount++;
           for(const [key,bucket] of [["intervals",active.hitBurst.intervals],["displayFrame",active.hitBurst.displayFrame],["renderer",active.hitBurst.renderer]]) for(const value of frameSamples[key]) append(bucket,value);
         }
         if(active?.label === "first-hit-burst" && firstHitStart !== null && NOW()-firstHitStart >= 1200) startWindow("steady-after-first-hit");
      }
    }));
    restores.push(wrapper(game,"projectTestEquipmentPointer",function(original,args) {
      samplingPointer=true;try{return original.apply(this,args);}finally {samplingPointer=false;}
    }));
  } catch (cause) { for (const restore of restores.reverse()) restore(); installedGraph=previousGraph; throw cause; }
  methods=restores; installedSession=game.sessionGeneration;
  firstHitSeen=false;firstHitStart=null;postHitUntil=null;startWindow("before-first-hit");refresh();
}
function reconcile() {
  if (installationFailed) return;
  try {
    const graph = game?.graph;
    if (graph !== installedGraph) { detach(); if (graph) attach(graph); }
    else if (graph && installedSession !== game.sessionGeneration) {
      endWindow(); installedSession=game.sessionGeneration;firstHitSeen=false;firstHitStart=null;lastRafAt=null;postHitUntil=null;startWindow("before-first-hit");
    }
  } catch (cause) { detach();installationFailed=true;error(cause instanceof Error?cause.message:"wrapper installation failed"); }
}
function report() { endWindow(); postHitUntil=null; const result = {schema:"aerobeat/faint_hit_diagnostic",version:1,packageVersion:"0.0.105",served8445SourceParity:false,cookieRelease0128SourceParity:false,mixedEraAudio:true,sourceCommits:PINS,currentMode:mode,measurements:"main-thread wall time, not GPU time; rendererCallMs times only renderer facade invocation, totalPresentationMs includes projection and pose resolution, displayFrameTotalMs times the entire eligible runDisplayFrame invocation (gameplay, clock/input/pose, projection, rendering, sync and UI), not exact gameplay.advance CPU; do not subtract nested wall times to infer scoring CPU; scored-hit deltas compare gameplay snapshots at app-frame entry/exit; pointerTotalMs measures the outer pointer-triggered presentation; wallElapsedMs includes menu/setup and MUST NOT be used for FPS; eligibleActiveMs sums only consecutive eligible display intervals, eligibleIntervalCount and ineligibleFrameCount expose coverage; 1-ms approximate p50/p95 histogram over every sample in each window; count and exact max cover the entire window; aftermath observed totals sum entries/pieces across render calls, not distinct frames; postHitBurst summarizes the union of scored-hit display frames and eligible display frames starting within 1200 ms after each scored hit, retaining aggregate histograms but no per-note records; display intervals are browser presentation cadence, not GPU time",coverage:"valid windows require playing Test, Automatic Feedback OFF, visible selected hand, CV confirmed idle and stable reported backing/viewport/DPR; invalidReasons mark violations; compare hit counts/section manually; each window carries its own mode and session generation",windows:reportWindows.slice()};startWindow(firstHitSeen?"steady-after-export":"before-first-hit");return result; }
toggle.addEventListener("change", () => { if (installationFailed) return; endWindow();mode=toggle.checked?"off":"native";firstHitSeen=false;firstHitStart=null;lastRafAt=null;postHitUntil=null;startWindow("before-first-hit");refresh(); });
reset.addEventListener("click", () => { if (installationFailed) return; reportWindows=[];firstHitSeen=false;firstHitStart=null;postHitUntil=null;startWindow("before-first-hit");refresh(); });
download.addEventListener("click", () => {
  if (installationFailed) return;
  try {
    const data=JSON.stringify(report(),null,2),blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`aerobeat-test-performance-${mode}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    exportNoticeUntil=NOW()+4000;refresh();
  } catch (cause) { state.textContent=`Download failed: ${cause instanceof Error?cause.message:"browser error"}`; }
});
if (!game || !recorder || !panel || !state || !recording || !output || !toggle || !download || !reset) throw new Error("Faint-hit recorder controls missing");
panel.addEventListener("toggle", refresh);
new MutationObserver(reconcile).observe(document.querySelector("main"),{childList:true});
// The connected graph is created synchronously; periodic identity checks
// cover disconnect/reconnect without replacing the production lifecycle.
setInterval(()=>{reconcile();if(installedGraph && !toggle.disabled) refresh();},250);
reconcile();
