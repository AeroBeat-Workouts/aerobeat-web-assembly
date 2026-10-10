// @ts-check
// Isolated phone diagnostic: no production <aero-game> graph or mutable CV defaults.
import { createAeroPlayCanvasRenderer } from "@aerobeat/web-renderer";
import { defineAeroUiElements } from "@aerobeat/web-ui";
import { defaultLiveCameraConstraints } from "@aerobeat/web-video";
import { createMediaPipeWorkerPoseAdapter, mediaPipeDelegates, mediaPipeLiveSourceId, mediaPipeDefaultModelSha256, mediaPipeDefaultModelSizeBytes } from "@aerobeat/web-vendor-mediapipe";
import { createLockedProductionCvService, createLockedVideoFrameSource } from "./production-cv-service.js";
import { lockedProductionCvProfile } from "./production-cv-profile.js";
import { createPrivatePerformanceRecorder } from "./private-performance-recorder.js";
import { createPhonePerformanceWorkload, phonePerformanceWorkload } from "./phone-performance-workload.js";
import { createPhonePerformancePipeline } from "./phone-performance-pipeline.js";

defineAeroUiElements();
const canvas=/** @type {HTMLCanvasElement} */(document.querySelector("#game"));
const video=/** @type {HTMLVideoElement} */(document.querySelector("#camera"));
const stage=/** @type {HTMLElement} */(document.querySelector(".stage"));
const quality=/** @type {import('@aerobeat/web-ui').AeroSelect} */(document.querySelector("#quality"));
const fps=/** @type {HTMLElement} */(document.querySelector("#fps"));
const status=/** @type {HTMLOutputElement} */(document.querySelector("#status"));
const summary=/** @type {HTMLOutputElement} */(document.querySelector("#summary"));
const notice=/** @type {HTMLElement} */(document.querySelector("#notice"));
const modes=["game","camera","cv"];
const qualityOptions=Object.freeze([{value:"1",label:"Full (1.0)"},{value:"0.75",label:"High (0.75)"},{value:"0.5",label:"Medium (0.5)"},{value:"0.25",label:"Low (0.25)"}]);
const previewOnly=new URLSearchParams(location.search).get("preview")==="1";
const measureMs=previewOnly?4000:60000;
const warmMs=previewOnly?500:3000;
const requestedCamera=Object.freeze({audio:false,video:Object.freeze({facingMode:"user",width:"browser default",height:"browser default",frameRate:"browser default"})});
quality.setOptions(qualityOptions);
if(previewOnly)notice.textContent="PREVIEW ONLY: 4-second windows are not sustained phone evidence. Remove ?preview=1 for 60-second windows.";

const renderer=createAeroPlayCanvasRenderer();
const workload=createPhonePerformanceWorkload();
const recorder=createPrivatePerformanceRecorder({capacity:2048});
/** @type {MediaStream|null} */ let stream=null;
/** @type {ReturnType<typeof createLockedProductionCvService>|null} */ let cv=null;
/** @type {ReturnType<typeof createPhonePerformancePipeline>|null} */ let cvPipeline=null;
/** @type {Array<Record<string,unknown>>} */ const runs=[];
/** @type {Array<{mode:string,reason:string}>} */ const failures=[];
let activeMode="game",desiredMode="game",generation=0,renderScale=1;
let raf=0,videoCallback=0,cameraFrameCount=0,cameraFrameStart=0,lastCameraAt=0,cameraTimestamp=0,cvConsumedFrame=0,lastMediaTime=-Infinity;
let phase="loading",phaseStarted=0,windowStart=0,latestStatsAt=0,minTargets=Infinity,maxTargets=0;
let windowGeometry="",disposed=false,transition=Promise.resolve(),cvDispose=Promise.resolve();
/** @type {null|(()=>void)} */ let cancelCameraRequest=null;

renderer.attach(canvas);
renderer.setBackgroundProjection({kind:"linear-gradient",colors:["#071426","#153b5d"],angleDeg:180});
const resizeObserver=new ResizeObserver(()=>resize());
resizeObserver.observe(stage);resize();

function geometryKey(){return `${stage.clientWidth}:${stage.clientHeight}:${devicePixelRatio}:${renderScale}:${canvas.width}:${canvas.height}`;}
function resize(){
  const bounds=stage.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return;
  renderer.resize({widthCssPx:bounds.width,heightCssPx:bounds.height,devicePixelRatio:devicePixelRatio||1,renderScale});
  if((phase==="warmup"||phase==="measuring")&&windowGeometry&&geometryKey()!==windowGeometry)invalidate("Canvas size or orientation changed during the window.",true);
}
function label(mode){return mode==="game"?"Game":mode==="camera"?"Game + Camera":"Game + CV";}
function updateModeButtons(){for(const button of document.querySelectorAll("aero-button[data-mode]"))button.setAttribute("aria-pressed",String(button.getAttribute("data-mode")===desiredMode));}
function cameraFormat(){const settings=stream?.getVideoTracks()[0]?.getSettings()??{};return{width:settings.width??video.videoWidth??null,height:settings.height??video.videoHeight??null,frameRate:settings.frameRate??null};}
function cameraTick(now,metadata){
  if(!stream||disposed)return;
  // Do not count callbacks that present the same media frame again.
  const mediaTime=metadata?.mediaTime;
  if(!Number.isFinite(mediaTime)||mediaTime>lastMediaTime){
    cameraFrameCount++;lastCameraAt=performance.now();cameraTimestamp=now;
    if(Number.isFinite(mediaTime))lastMediaTime=mediaTime;
  }
  videoCallback=video.requestVideoFrameCallback(cameraTick);
}
function stopCamera(){
  cancelCameraRequest?.();cancelCameraRequest=null;
  if(videoCallback){video.cancelVideoFrameCallback?.(videoCallback);videoCallback=0;}
  video.pause();video.srcObject=null;video.hidden=true;
  stream?.getTracks().forEach(track=>track.stop());stream=null;
}
async function stopCv(){
  cvPipeline?.stop();cvPipeline=null;
  const previous=cv;cv=null;
  if(previous)cvDispose=cvDispose.catch(()=>{}).then(()=>previous.dispose());
  await cvDispose;
}
function syncCameraPresentation(){
  const visible=activeMode!=="game"&&Boolean(stream);
  video.hidden=!visible;renderer.setEnvironmentVisible(!visible);
  renderer.setBackgroundProjection(visible?{kind:"solid",colors:["#00000000"],angleDeg:180}:{kind:"linear-gradient",colors:["#071426","#153b5d"],angleDeg:180});
}
async function startCamera(token){
  if(!navigator.mediaDevices?.getUserMedia||!video.requestVideoFrameCallback)throw new Error("Secure camera access and requestVideoFrameCallback are required on this phone");
  let cancelled=false;
  const request=navigator.mediaDevices.getUserMedia(defaultLiveCameraConstraints()).then(acquired=>{
    if(cancelled){acquired.getTracks().forEach(track=>track.stop());return null;}
    return acquired;
  });
  const aborted=new Promise(resolve=>{cancelCameraRequest=()=>{cancelled=true;resolve(null);};});
  const acquired=await Promise.race([request,aborted]);
  cancelCameraRequest=null;
  if(!acquired)return false;
  if(token!==generation||disposed||document.hidden){acquired.getTracks().forEach(track=>track.stop());return false;}
  stream=acquired;video.srcObject=acquired;video.hidden=false;await video.play();
  if(token!==generation||disposed||document.hidden){stopCamera();return false;}
  cameraFrameCount=0;lastMediaTime=-Infinity;lastCameraAt=performance.now();cameraTimestamp=lastCameraAt;
  videoCallback=video.requestVideoFrameCallback(cameraTick);
  return true;
}
function beginWindow(now){
  phase="warmup";phaseStarted=now;windowStart=0;windowGeometry=geometryKey();cameraFrameStart=cameraFrameCount;
  status.textContent=`${label(activeMode)} warming up…`;
  summary.textContent="Warming up assets, camera, and pose (if selected)…";
}
function invalidate(reason,releaseCamera){
  if(phase==="invalid"||disposed)return;
  const previous=phase==="switching"?desiredMode:activeMode;
  phase="invalid";failures.push({mode:previous,reason:reason.slice(0,256)});
  status.textContent=`Window invalid: ${reason} Choose ${label(previous)} to retry.`;
  summary.textContent="No invalid or hidden-tab window is included in the JSON report.";
  fps.setAttribute("status","Invalid window");
  if(releaseCamera){
    ++generation;stopCamera();void stopCv();syncCameraPresentation();
    void transition.catch(()=>{}).then(async()=>{await stopCv();stopCamera();syncCameraPresentation();});
  }
}
function instrumentAdapter(adapter){
  return Object.freeze({
    vendorId:adapter.vendorId,model:adapter.model,capabilities:adapter.capabilities,
    get status(){return adapter.status;},
    getExecutionStatus:()=>adapter.getExecutionStatus(),
    getExecutionTelemetry:()=>adapter.getExecutionTelemetry(),
    getTelemetryStatus:()=>adapter.getTelemetryStatus(),
    load:()=>adapter.load(),dispose:()=>adapter.dispose(),
    estimateNormalizedPoseFrame(frameSource,options){
      const pipeline=cvPipeline,ticket=pipeline?.adapterCalled(performance.now());
      let pending;
      try{pending=Reflect.apply(adapter.estimateNormalizedPoseFrame,adapter,[frameSource,options]);}
      catch(error){pipeline?.settled(ticket,performance.now(),null,true);throw error;}
      // Observe the original Promise without delaying or changing its result.
      if(ticket)void pending.then(
        ()=>pipeline?.settled(ticket,performance.now(),adapter.getExecutionTelemetry()),
        ()=>pipeline?.settled(ticket,performance.now(),null,true)
      );
      return pending;
    }
  });
}
function uniqueFrameSource(){
  const source=createLockedVideoFrameSource(video,{sourceId:mediaPipeLiveSourceId,mirrored:true});
  return Object.freeze({
    ...source,
    // Production CV remains unchanged. This diagnostic admits each observed
    // camera frame at most once, so frozen video cannot fake fresh pose output.
    isFrameAvailable:()=>{
      const ready=source.isFrameAvailable(),fresh=cameraFrameCount>cvConsumedFrame,recent=performance.now()-lastCameraAt<2000;
      return cvPipeline?.checkAvailability({ready,fresh,recent})??Boolean(ready&&fresh&&recent);
    },
    getTimestampMs:()=>{cvConsumedFrame=cameraFrameCount;cvPipeline?.admitted(performance.now());return cameraTimestamp;}
  });
}
async function changeMode(mode){
  if(!modes.includes(mode)||disposed)return;
  if(document.hidden){invalidate("The tab is hidden.",true);return;}
  desiredMode=mode;const token=++generation;cancelCameraRequest?.();updateModeButtons();phase="switching";
  fps.setAttribute("heading","— scene FPS");fps.setAttribute("status","Switching mode");
  status.textContent=`Switching to ${label(mode)}…`;
  summary.textContent="Preparing a fresh, visible measurement window…";
  transition=transition.catch(()=>{}).then(async()=>{
    await stopCv();stopCamera();if(token!==generation||disposed||document.hidden)return;
    activeMode=mode;
    try{
      if(mode!=="game"){
        if(!await startCamera(token))return;
        if(mode==="cv"){
          cvConsumedFrame=0;cvPipeline=createPhonePerformancePipeline();
          const adapter=createMediaPipeWorkerPoseAdapter({
            sourceId:mediaPipeLiveSourceId,mirrored:true,delegate:mediaPipeDelegates.cpuWasm,
            modelUrl:new URL("assets/mediapipe/pose_landmarker_lite.task",location.href).href,
            modelSha256:mediaPipeDefaultModelSha256,modelSizeBytes:mediaPipeDefaultModelSizeBytes,
            wasmRootUrl:new URL("assets/mediapipe/wasm",location.href).href,
            tasksVisionScriptUrl:new URL("assets/mediapipe/vision_bundle.js",location.href).href,
            minPoseDetectionConfidence:lockedProductionCvProfile.minPoseDetectionConfidence,
            minPosePresenceConfidence:lockedProductionCvProfile.minPosePresenceConfidence,
            minTrackingConfidence:lockedProductionCvProfile.minTrackingConfidence
          });
          cv=createLockedProductionCvService({poseAdapter:instrumentAdapter(adapter),submissionCadenceTargetFps:lockedProductionCvProfile.submissionCadenceTargetFps});
          await cv.start(uniqueFrameSource());
          if(token!==generation||disposed||document.hidden){await stopCv();stopCamera();return;}
        }
      }
      if(token!==generation||disposed||document.hidden)return;
      syncCameraPresentation();beginWindow(performance.now());
    }catch(error){
      if(token!==generation||disposed)return;
      const reason=(error instanceof Error?error.message:String(error)).slice(0,256);
      failures.push({mode,reason});phase="error";
      status.textContent=`${label(mode)} unavailable: ${reason}`;
      summary.textContent="No valid measurement for this mode. Check permission and secure HTTPS origin.";
      await stopCv();stopCamera();syncCameraPresentation();
    }
  });
  await transition;
}
function frame(now){
  if(disposed)return;
  raf=requestAnimationFrame(frame);
  if(document.hidden)return;
  if(renderer.describe().gameplayAssets.state!=="ready"){
    if(phase==="loading")status.textContent="Loading actual PlayCanvas gameplay assets…";
    return;
  }
  if(phase==="loading")beginWindow(now);
  if(phase==="switching"||phase==="error"||phase==="invalid")return;
  const renderStarted=performance.now();
  const elapsed=phase==="measuring"?now-windowStart:now-phaseStarted;
  const scene=workload.frame(elapsed);
  // Identical moving beats in every mode; CV never gates scene rendering.
  const result=renderer.renderGameplayFrameWithCursors(scene,[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32});
  if(result.status.state!=="running"){invalidate(`Renderer failed: ${result.status.errorMessage??result.status.state}`,true);return;}
  if(phase==="warmup"){
    const cvStatus=activeMode==="cv"?cv?.getStatus():null;
    if(cvStatus?.lifecycleState==="error"||activeMode==="cv"&&now-phaseStarted>30000&&!(cvStatus?.poseFrameCount>0)){
      invalidate(`CV did not start: ${cvStatus?.error??"no pose output after 30 seconds"}`,true);return;
    }
    if(activeMode!=="game"&&now-lastCameraAt>2000){invalidate("Camera stopped delivering new frames.",true);return;}
    if(activeMode==="cv"&&!(cvStatus?.poseFrameCount>0)||now-phaseStarted<warmMs)return;
    phase="measuring";windowStart=now;windowGeometry=geometryKey();minTargets=Infinity;maxTargets=0;
    cameraFrameStart=cameraFrameCount;recorder.reset(`${activeMode}-${renderScale}`,now);
    if(activeMode==="cv")cvPipeline?.reset(cv?.getStatus().droppedFrameCount??0);
    summary.textContent=`Measuring ${label(activeMode)} for ${measureMs/1000} seconds. Keep this tab visible.`;
  }
  if(phase!=="measuring")return;
  if(geometryKey()!==windowGeometry){invalidate("Canvas size or orientation changed during the window.",true);return;}
  if(activeMode!=="game"&&now-lastCameraAt>2000){invalidate("Camera stopped delivering new frames.",true);return;}
  if(activeMode==="cv"&&cv?.getStatus().lifecycleState==="error"){
    invalidate(`CV stopped: ${cv.getStatus().error??"unknown error"}`,true);return;
  }
  minTargets=Math.min(minTargets,scene.targets.length);maxTargets=Math.max(maxTargets,scene.targets.length);
  const latestPose=activeMode==="cv"?cv?.getLatestPoseFrame():undefined;
  recorder.record({timestampMs:now,rendererCpuMs:performance.now()-renderStarted,poseTimestampMs:latestPose?.timestampMs,poseObservedAtMs:performance.now(),cv:activeMode==="cv"?cv?.getPerformanceSample():null,camera:activeMode==="game"?null:cameraFormat()});
  if(now-latestStatsAt>500){
    latestStatsAt=now;const elapsedMs=Math.max(1,now-windowStart);const current=recorder.snapshot(now);
    const cameraRate=activeMode==="game"?0:Math.round((cameraFrameCount-cameraFrameStart)*1000/elapsedMs);
    fps.setAttribute("heading",`${current.displayRateFps??0} scene FPS`);
    fps.setAttribute("status",`Camera ${cameraRate}/s · Pose ${activeMode==="cv"?Math.round(current.cv.poseFrameCount*1000/elapsedMs):0}/s`);
    status.textContent=`${label(activeMode)} · ${Math.ceil((measureMs-elapsedMs)/1000)}s left · ${renderScale}× backing scale · ${canvas.width}×${canvas.height} px`;
  }
  if(now-windowStart>=measureMs)finishWindow(now);
}
function finishWindow(now){
  const sample=recorder.snapshot(now),camera=activeMode==="game"?null:cameraFormat();
  if(activeMode!=="game"&&cameraFrameCount<=cameraFrameStart||activeMode==="cv"&&sample.cv.poseFrameCount<1){invalidate("Missing live camera frames or measured pose output.",true);return;}
  const run={
    mode:activeMode,renderScale,backing:{width:canvas.width,height:canvas.height},
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
    workload:phonePerformanceWorkload.contract,targets:{min:minTargets,max:maxTargets},
    displayFps:sample.displayRateFps,displayIntervals:sample.displayIntervals,displayIntervalSampleCount:sample.displayIntervals.count,
    missedVsync:sample.missedVsyncCount,rendererCpuMs:sample.rendererCpuMs,
    requestedCamera:activeMode==="game"?null:requestedCamera,camera,activeCameraTracks:stream?.getVideoTracks().filter(track=>track.readyState==="live").length??0,
    cameraNewFrameFps:activeMode==="game"?0:Number(((cameraFrameCount-cameraFrameStart)*1000/sample.durationMs).toFixed(3)),
    cv:activeMode==="cv"?{...sample.cv,poseOutputFps:Number((sample.cv.poseFrameCount*1000/sample.durationMs).toFixed(3)),inferenceMs:sample.mediaPipeRuntimeMs,estimateMs:sample.mediaPipeEndToEndMs,poseAgeMs:sample.poseAgeMs,pipeline:cvPipeline?.snapshot(cv?.getStatus().droppedFrameCount??0)}:null,
    durationMs:sample.durationMs,previewOnly
  };
  runs.push(run);phase="done";cvPipeline?.stop();
  summary.textContent=`${label(activeMode)}: scene ${run.displayFps} FPS; camera ${run.cameraNewFrameFps} new frames/s; pose ${run.cv?.poseOutputFps??0} FPS; frame interval p95 ${sample.displayIntervals.p95} ms. ${runs.length} run(s) saved.`;
  status.textContent=`${label(activeMode)} complete — choose the next mode or change resolution.`;
  fps.setAttribute("heading",`${run.displayFps} scene FPS`);fps.setAttribute("status","Window complete");
}
function report(){return{
  schema:"aerobeat/phone_performance_ablation",version:1,
  source:typeof __AEROBEAT_PHONE_COMMIT__!=="undefined"?__AEROBEAT_PHONE_COMMIT__:"development",
  browser:navigator.userAgent.slice(0,200),workload:phonePerformanceWorkload,
  productionCv:{model:lockedProductionCvProfile.model,provider:lockedProductionCvProfile.providerId,location:lockedProductionCvProfile.executionLocation,submissionCeilingFps:lockedProductionCvProfile.submissionCadenceTargetFps},
  statisticsNote:"Display p95 uses the last at most 2048 rendered frame intervals of each window; FPS spans the whole window.",
  failures,runs
};}
document.addEventListener("aero-button-activate",event=>{
  const target=event.target;if(!(target instanceof HTMLElement))return;
  const mode=target.dataset.mode;if(mode){void changeMode(mode);return;}
  if(target.id==="copy")void navigator.clipboard.writeText(JSON.stringify(report())).then(
    ()=>{notice.textContent="Results copied. Paste the JSON into chat after all three runs.";},
    ()=>{notice.textContent="Clipboard unavailable. Use Download JSON instead.";}
  );
  if(target.id==="download"){
    const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="aerobeat-phone-performance.json";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
quality.addEventListener("aero-select-change",event=>{
  const scale=Number(event.detail?.value);
  if(!qualityOptions.some(option=>Number(option.value)===scale)||scale===renderScale)return;
  const completed=phase==="done";
  if(phase==="switching")invalidate("Render resolution changed during mode setup.",true);
  else if(phase==="measuring"||phase==="warmup")invalidate("Render resolution changed mid-window.",true);
  renderScale=scale;resize();
  if(completed){
    phase="invalid";++generation;stopCamera();void stopCv();syncCameraPresentation();
    fps.setAttribute("heading","— scene FPS");fps.setAttribute("status","Select mode to measure");
    status.textContent=`Resolution changed to ${renderScale}×. Choose ${label(activeMode)} to start a fresh window.`;
    summary.textContent=`${runs.length} completed run(s) saved. Changing resolution never restarts a finished window automatically.`;
  }
});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&phase!=="invalid")invalidate("Tab hidden before or during a benchmark window.",true);
});
window.addEventListener("pagehide",()=>{
  disposed=true;++generation;cancelAnimationFrame(raf);resizeObserver.disconnect();
  void stopCv();stopCamera();renderer.destroy();
});
raf=requestAnimationFrame(frame);
