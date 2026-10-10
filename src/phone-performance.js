// @ts-check
// Standalone diagnostic. It never configures the production <aero-game> graph.
import { createAeroPlayCanvasRenderer } from "@aerobeat/web-renderer";
import { defineAeroUiElements } from "@aerobeat/web-ui";
import { defaultLiveCameraConstraints } from "@aerobeat/web-video";
import { createMediaPipeWorkerPoseAdapter, mediaPipeDelegates, mediaPipeLiveSourceId } from "@aerobeat/web-vendor-mediapipe";
import { createLockedProductionCvService, createLockedVideoFrameSource } from "./production-cv-service.js";
import { lockedProductionCvProfile } from "./production-cv-profile.js";
import { createPrivatePerformanceRecorder } from "./private-performance-recorder.js";
import { createPhonePerformanceWorkload, phonePerformanceWorkload } from "./phone-performance-workload.js";

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
quality.setOptions(qualityOptions);
const previewOnly=new URLSearchParams(location.search).get("preview")==="1";
const measureMs=previewOnly?4000:60000;
const warmMs=previewOnly?500:3000;
const renderer=createAeroPlayCanvasRenderer();
const workload=createPhonePerformanceWorkload();
renderer.setBackgroundProjection({kind:"linear-gradient",colors:["#071426","#153b5d"],angleDeg:180});
const recorder=createPrivatePerformanceRecorder({capacity:2048});
/** @type {MediaStream|null} */ let stream=null;
/** @type {ReturnType<typeof createLockedProductionCvService>|null} */ let cv=null;
let activeMode="game",desiredMode="game",generation=0,renderScale=1,raf=0,videoCallback=0,cameraFrameCount=0,cameraFrameStart=0,phase="loading",phaseStarted=0,windowStart=0,latestStatsAt=0,frameCount=0,minTargets=Infinity,maxTargets=0,disposed=false,transition=Promise.resolve();
/** @type {Array<Record<string,unknown>>} */ const runs=[];
if(previewOnly)notice.textContent="PREVIEW ONLY: 4-second windows are not sustained phone evidence. Remove ?preview=1 for 60-second windows.";

renderer.attach(canvas);
const resizeObserver=new ResizeObserver(()=>resize());resizeObserver.observe(stage);resize();
function resize(){const bounds=stage.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return;renderer.resize({widthCssPx:bounds.width,heightCssPx:bounds.height,devicePixelRatio:devicePixelRatio||1,renderScale});}
function updateModeButtons(){for(const button of document.querySelectorAll("aero-button[data-mode]")){const selected=button.getAttribute("data-mode")===desiredMode;button.setAttribute("aria-pressed",String(selected));}}
function cameraFormat(){const settings=stream?.getVideoTracks()[0]?.getSettings()??{};return{width:settings.width??video.videoWidth??null,height:settings.height??video.videoHeight??null,frameRate:settings.frameRate??null};}
function cameraTick(){cameraFrameCount++;videoCallback=video.requestVideoFrameCallback(()=>cameraTick());}
function stopCamera(){if(videoCallback){video.cancelVideoFrameCallback?.(videoCallback);videoCallback=0;}video.pause();video.srcObject=null;video.hidden=true;stream?.getTracks().forEach(track=>track.stop());stream=null;}
async function stopCv(){const old=cv;cv=null;if(old)await old.dispose();}
function syncCameraPresentation(){const visible=activeMode!=="game"&&Boolean(stream);video.hidden=!visible;renderer.setEnvironmentVisible(!visible);renderer.setBackgroundProjection(visible?{kind:"solid",colors:["#00000000"],angleDeg:180}:{kind:"linear-gradient",colors:["#071426","#153b5d"],angleDeg:180});}
async function startCamera(token){if(!navigator.mediaDevices?.getUserMedia||!video.requestVideoFrameCallback)throw new Error("Secure camera access and requestVideoFrameCallback are required on this phone");const acquired=await navigator.mediaDevices.getUserMedia(defaultLiveCameraConstraints());if(token!==generation||disposed){acquired.getTracks().forEach(track=>track.stop());return false;}stream=acquired;video.srcObject=acquired;video.hidden=false;await video.play();if(token!==generation||disposed){stopCamera();return false;}cameraFrameCount=0;videoCallback=video.requestVideoFrameCallback(()=>cameraTick());return true;}
function beginWindow(now){phase="warmup";phaseStarted=now;windowStart=0;frameCount=0;cameraFrameStart=cameraFrameCount;status.textContent=`${label(activeMode)} warming up…`;summary.textContent="Warming up assets, camera, and pose (if selected)…";}
async function changeMode(mode){if(!modes.includes(mode)||disposed)return;desiredMode=mode;const token=++generation;updateModeButtons();phase="switching";status.textContent=`Switching to ${label(mode)}…`;transition=transition.catch(()=>{}).then(async()=>{await stopCv();stopCamera();if(token!==generation||disposed)return;activeMode=mode;try{if(mode!=="game"){if(!await startCamera(token))return;if(mode==="cv"){const adapter=createMediaPipeWorkerPoseAdapter({sourceId:mediaPipeLiveSourceId,mirrored:true,delegate:mediaPipeDelegates.cpuWasm,minPoseDetectionConfidence:lockedProductionCvProfile.minPoseDetectionConfidence,minPosePresenceConfidence:lockedProductionCvProfile.minPosePresenceConfidence,minTrackingConfidence:lockedProductionCvProfile.minTrackingConfidence});cv=createLockedProductionCvService({poseAdapter:adapter,submissionCadenceTargetFps:lockedProductionCvProfile.submissionCadenceTargetFps});await cv.start(createLockedVideoFrameSource(video,{sourceId:"aero.mediapipe.live",mirrored:true}));if(token!==generation||disposed){await stopCv();stopCamera();return;}}}if(token!==generation||disposed)return;syncCameraPresentation();beginWindow(performance.now());}catch(error){if(token!==generation||disposed)return;phase="error";status.textContent=`${label(mode)} unavailable: ${error instanceof Error?error.message:String(error)}`;summary.textContent="No valid measurement for this mode. Check camera permission and secure HTTPS origin.";await stopCv();stopCamera();syncCameraPresentation();}});await transition;}
function label(mode){return mode==="game"?"Game":mode==="camera"?"Game + Camera":"Game + CV";}
function frame(now){if(disposed)return;raf=requestAnimationFrame(frame);if(renderer.describe().gameplayAssets.state!=="ready"){status.textContent="Loading actual PlayCanvas gameplay assets…";return;}if(phase==="loading")beginWindow(now);if(phase==="switching"||phase==="error")return;
  const renderStarted=performance.now();const elapsed=phase==="measuring"?now-windowStart:now-phaseStarted;const scene=workload.frame(elapsed);
  // Render the identical scene in every mode. Camera/CV cannot stall or gate the beats.
  const result=renderer.renderGameplayFrameWithCursors(scene,[],{grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32});
  if(result.status.state!=="running"){phase="error";status.textContent=`Renderer failed: ${result.status.errorMessage??result.status.state}`;return;}
  frameCount++;
  if(phase==="warmup"){
    const cvStatus=activeMode==="cv"?cv?.getStatus():null;
    if(cvStatus?.lifecycleState==="error"||activeMode==="cv"&&now-phaseStarted>30000&&!(cvStatus?.poseFrameCount>0)){phase="error";status.textContent=`CV did not start: ${cvStatus?.error??"no pose output after 30 seconds"}`;summary.textContent="No valid CV run was recorded; camera-only and game measurements remain available.";return;}
    const ready=activeMode!=="cv"||((cvStatus?.poseFrameCount??0)>0);
    if(!ready||now-phaseStarted<warmMs)return;
    phase="measuring";windowStart=now;frameCount=0;minTargets=Infinity;maxTargets=0;cameraFrameStart=cameraFrameCount;recorder.reset(`${activeMode}-${renderScale}`,now);summary.textContent=`Measuring ${label(activeMode)} for ${measureMs/1000} seconds. Keep this tab visible.`;
  }
  if(phase!=="measuring")return;
  if(activeMode==="cv"&&cv?.getStatus().lifecycleState==="error"){phase="error";status.textContent=`CV stopped: ${cv.getStatus().error??"unknown error"}`;summary.textContent="This window is invalid; choose Game + CV to retry.";return;}
  minTargets=Math.min(minTargets,scene.targets.length);maxTargets=Math.max(maxTargets,scene.targets.length);
  const latestPose=activeMode==="cv"?cv?.getLatestPoseFrame():undefined;
  recorder.record({timestampMs:now,rendererCpuMs:performance.now()-renderStarted,poseTimestampMs:latestPose?.timestampMs,poseObservedAtMs:performance.now(),cv:activeMode==="cv"?cv?.getPerformanceSample():null,camera:activeMode==="game"?null:cameraFormat()});
  if(now-latestStatsAt>500){latestStatsAt=now;const elapsedMs=Math.max(1,now-windowStart);const current=recorder.snapshot(now);const cameraRate=activeMode==="game"?0:Math.round((cameraFrameCount-cameraFrameStart)*1000/elapsedMs);fps.setAttribute("heading",`${current.displayRateFps??0} scene FPS`);fps.setAttribute("status",`Camera ${cameraRate}/s · Pose ${activeMode==="cv"?Math.round(current.cv.poseFrameCount*1000/elapsedMs):0}/s`);status.textContent=`${label(activeMode)} · ${Math.ceil((measureMs-elapsedMs)/1000)}s left · ${renderScale}× backing scale · ${canvas.width}×${canvas.height} px`;}
  if(now-windowStart>=measureMs)finishWindow(now);
}
function finishWindow(now){const sample=recorder.snapshot(now);const camera=activeMode==="game"?null:cameraFormat();const run={mode:activeMode,renderScale,backing:{width:canvas.width,height:canvas.height},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},workload:phonePerformanceWorkload.contract,targets:{min:minTargets,max:maxTargets},displayFps:sample.displayRateFps,displayIntervals:sample.displayIntervals,missedVsync:sample.missedVsyncCount,rendererCpuMs:sample.rendererCpuMs,camera,cameraNewFrameFps:activeMode==="game"?0:Number(((cameraFrameCount-cameraFrameStart)*1000/sample.durationMs).toFixed(3)),cv:activeMode==="cv"?{...sample.cv,poseOutputFps:Number((sample.cv.poseFrameCount*1000/sample.durationMs).toFixed(3)),inferenceMs:sample.mediaPipeRuntimeMs,estimateMs:sample.mediaPipeEndToEndMs,poseAgeMs:sample.poseAgeMs}:null,durationMs:sample.durationMs,previewOnly};runs.push(run);phase="done";summary.textContent=`${label(activeMode)}: scene ${run.displayFps} FPS; camera ${run.cameraNewFrameFps} new frames/s; pose ${run.cv?.poseOutputFps??0} FPS; frame interval p95 ${sample.displayIntervals.p95} ms. ${runs.length} run(s) saved.`;status.textContent=`${label(activeMode)} complete — choose the next mode or change resolution.`;fps.setAttribute("heading",`${run.displayFps} scene FPS`);fps.setAttribute("status","Window complete");}
function report(){return{schema:"aerobeat/phone_performance_ablation",version:1,source:typeof __AEROBEAT_BUILD_STAMP__!=="undefined"?__AEROBEAT_BUILD_STAMP__:"development",browser:navigator.userAgent.slice(0,200),workload:phonePerformanceWorkload,productionCv:{model:lockedProductionCvProfile.model,provider:lockedProductionCvProfile.providerId,location:lockedProductionCvProfile.executionLocation,submissionCeilingFps:lockedProductionCvProfile.submissionCadenceTargetFps},runs};}
document.addEventListener("aero-button-activate",event=>{const target=event.target;if(!(target instanceof HTMLElement))return;const mode=target.dataset.mode;if(mode){void changeMode(mode);return;}if(target.id==="copy")void navigator.clipboard.writeText(JSON.stringify(report())).then(()=>{notice.textContent="Results copied. Paste the JSON into chat after all three runs.";},()=>{notice.textContent="Clipboard unavailable. Use Download JSON instead.";});if(target.id==="download"){const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="aerobeat-phone-performance.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});
quality.addEventListener("aero-select-change",event=>{const scale=Number(event.detail?.value);if(!qualityOptions.some(option=>Number(option.value)===scale))return;renderScale=scale;resize();if(phase==="measuring"||phase==="warmup"||phase==="done")beginWindow(performance.now());});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&phase==="measuring"){phase="invalid";status.textContent="Window invalid: tab was hidden. Choose the mode again to restart.";summary.textContent="No hidden-tab result was saved.";}});
window.addEventListener("pagehide",()=>{disposed=true;++generation;cancelAnimationFrame(raf);resizeObserver.disconnect();void stopCv();stopCamera();renderer.destroy();});
raf=requestAnimationFrame(frame);
