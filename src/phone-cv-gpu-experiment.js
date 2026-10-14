// @ts-check
// Private camera → experimental GPU-first CV → native calibration → CSS markers.
import { defaultLiveCameraConstraints } from '@aerobeat/web-video';
import { createMediaPipeWorkerPoseAdapter,mediaPipeDelegates,mediaPipeLiveSourceId,mediaPipeDefaultModelSha256,mediaPipeDefaultModelSizeBytes } from '@aerobeat/web-vendor-mediapipe';
import { createAeroBodyGridService } from '@aerobeat/web-input';
import { sha256Hex } from '@aerobeat/web-hash';
import { createLockedVideoFrameSource } from './production-cv-service.js';
import { createPrivateExperimentalCvService } from './private-experimental-cv-service.js';
import { lockedProductionCvProfile } from './production-cv-profile.js';
import { createPhoneCvMarkerWindow,markerCoverPosition } from './phone-cv-marker-window.js';

const video=document.querySelector('#camera'),stage=document.querySelector('#stage'),state=document.querySelector('#state'),summary=document.querySelector('#summary'),startButton=document.querySelector('#start'),downloadButton=document.querySelector('#download');
const dots=Object.fromEntries([...document.querySelectorAll('.marker')].map(el=>[el.dataset.role,el]));
const preview=new URLSearchParams(location.search).get('preview')==='1';
const WARMUP=preview?500:3000,MEASURE=preview?4000:60000;
const BUILD_STAMP=typeof __AEROBEAT_CV_MARKER_BUILD_STAMP__==='undefined'?'development':__AEROBEAT_CV_MARKER_BUILD_STAMP__;
const PACKAGE_VERSION=typeof __AEROBEAT_PACKAGE_VERSION__==='undefined'?'development':__AEROBEAT_PACKAGE_VERSION__;
const AFTER_RESULT=typeof __AEROBEAT_CV_SCHEDULING_MODE__!=='undefined' && __AEROBEAT_CV_SCHEDULING_MODE__==='after-result';
const SCHEDULER=Object.freeze({mode:'after-result',targetFps:lockedProductionCvProfile.submissionCadenceTargetFps});
const REPORT_PURPOSE=AFTER_RESULT?'camera_cv_gpu_after_result_experiment':'camera_cv_gpu_first_experiment';
const WINDOW_SCHEMA=AFTER_RESULT?'aerobeat/private_phone_cv_gpu_result_window':'aerobeat/private_phone_cv_gpu_window';
const REPORT_SCHEMA=AFTER_RESULT?'aerobeat/private_phone_cv_gpu_result_experiment_report':'aerobeat/private_phone_cv_gpu_experiment_report';
const MANIFEST_SCHEMA=AFTER_RESULT?'aerobeat/private_phone_cv_gpu_result_bundle':'aerobeat/private_phone_cv_gpu_bundle';
const MANIFEST_FILE=AFTER_RESULT?'/phone-cv-gpu-result-bundle-manifest.json':'/phone-cv-gpu-bundle-manifest.json';
let provenance=null,provenanceFailure=false,stream=null,cv=null,adapter=null,input=null,observer=null,lastReport=null,phase='loading',disposed=false;
let selectedDelegate=null,fallback=false,fallbackReason=null;
let lastPoseCount=0,lastPoseAt=0,lastSourceId=null,lastMirror=null,calibrationId=null,lastCameraTime=0,lastMediaTime=-Infinity,lastPresented=-Infinity;
let videoCallback=null,raf=null,measureTimer=null,warmupTimer=null,requestCancelled=false,geometry='',cameraIdentity='',cameraTrack=null,lastCvCounters=null;
// Only the after-result source uses this callback-derived, never fabricated frame identity.
let presentedFrameId=null,videoPresentationFailed=false;
const markerNames={left:'left_wrist',right:'right_wrist',nose:'nose'};
const forceGpuInitFail=preview && new URLSearchParams(location.search).get('forceGpuInitFail')==='1';
// The original HTML stays byte-identical; only this private entry relabels its controls.
document.title=AFTER_RESULT?'AeroBeat · GPU-first after-result camera CV experiment':'AeroBeat · GPU-first camera CV experiment';
document.querySelector('aside').setAttribute('aria-label',AFTER_RESULT?'Private GPU-first after-result camera and CV marker experiment':'Private GPU-first camera and CV marker experiment');
document.querySelector('aside strong').textContent=AFTER_RESULT?'GPU-first after-result CV experiment · no game':'GPU-first CV experiment · no game';
function delegateLabel(){return selectedDelegate==='gpu-webgl'?'GPU/WebGL Worker':selectedDelegate==='cpu-wasm'?'CPU/WASM fallback Worker':'GPU/WebGL Worker';}
function checkedExecution(requested,instance){
  const telemetry=instance.getTelemetryStatus(),execution=instance.getExecutionTelemetry();
  if(telemetry?.actualDelegate!==requested || telemetry?.selectedDelegate!==requested || telemetry?.loadState!=='ready' || execution?.location!=='worker' || execution?.provider!==(requested==='gpu-webgl'?'webgl':'wasm') || execution?.fallback!==false)throw new Error('Worker delegate identity mismatch');
  return Object.freeze({delegate:requested,provider:execution.provider});
}
function hideDots(){for(const dot of Object.values(dots))dot.hidden=true;}
function stageGeometry(){return [stage.clientWidth,stage.clientHeight,devicePixelRatio,innerWidth,innerHeight,screen.orientation?.angle ?? 0,video.videoWidth,video.videoHeight].join(':');}
function cameraSettings(){const settings=stream?.getVideoTracks()[0]?.getSettings()??{};return {width:settings.width??video.videoWidth,height:settings.height??video.videoHeight,frameRate:settings.frameRate??null};}
function cameraLive(){const track=stream?.getVideoTracks()[0];return track?.readyState==='live' && video.srcObject===stream && !video.paused && video.readyState>=2 && video.videoWidth>0 && video.videoHeight>0;}
function cvLive(){try {const status=cv?.getStatus();return selectedDelegate!==null && status?.running===true && status.lifecycleState==='running' && (!AFTER_RESULT||(status.schedulingMode==='after-result'&&!videoPresentationFailed)) && !status.error && checkedExecution(selectedDelegate,adapter).delegate===selectedDelegate;}catch{return false;}}
function snapshot(){return input?.getSnapshot();}
function calibrated(){const snap=snapshot();return snap?.calibration?.calibrationId != null && snap.calibration.readiness==='countdown' && snap.tracking.freshCalibrationRequired!==true && snap.tracking.gameplayPaused!==true;}
function renderMarkers(pose,snap){
  const ready=calibrated(),tracked=ready && snap.tracking.allRequiredAnchorsVisible===true && snap.retainedGeometryDimmed!==true;
  const held=ready && snap.tracking.anchorsFrozen===true;
  for(const [role,name] of Object.entries(markerNames)){
    const dot=dots[role];const anchor=snap.anchors?.find(item=>item.anchor===name);
    const measured=pose?.landmarks?.find(item=>item.name===name);
    // Markers are ONLY measured camera coordinates, never the calibrated grid's
    // transformed anchors. Frozen native anchors cannot invent fresh pixels.
    const landmark=held ? null : tracked && anchor?.valid===true && measured?.confidence>=.5 ? measured : null;
    const position=landmark && markerCoverPosition(landmark,video.videoWidth,video.videoHeight,stage.clientWidth,stage.clientHeight);
    dot.hidden=!position || position.x<0 || position.x>stage.clientWidth || position.y<0 || position.y>stage.clientHeight;
    if(!dot.hidden){dot.style.left=`${position.x}px`;dot.style.top=`${position.y}px`;dot.dataset.held='false';}
  }
  return {valid:tracked && !held && !dots.left.hidden && !dots.right.hidden && !dots.nose.hidden,held};
}
function stopWindow(reason){
  if(phase!=='measuring'&&phase!=='warmup')return;
  if(warmupTimer!==null){clearTimeout(warmupTimer);warmupTimer=null;}
  if(measureTimer!==null){clearTimeout(measureTimer);measureTimer=null;}
  if(phase==='measuring'){
    if(!observer){phase='waiting';state.textContent=`${delegateLabel()} · recorder unavailable. Retry when ready.`;refresh();return;}
    if(reason)observer.invalidate(reason);
    let cvStatus=null;try{cvStatus=cv?.getStatus();}catch{/* CV has failed; preserve invalid reason */}
    const measuredWindow=observer.stop(performance.now(),cvStatus);
    // Keep the exact scalar recorder, but do not mislabel a GPU window as the
    // original CPU camera baseline when a consumer inspects it on its own.
    const window=Object.freeze({...measuredWindow,schema:WINDOW_SCHEMA,purpose:REPORT_PURPOSE,...(AFTER_RESULT?{scheduler:SCHEDULER}:{})});
    const verified=typeof provenance?.sha256==='string' && /^[0-9a-f]{64}$/.test(provenance.sha256);
    const invalidReason=preview?'qa_preview_not_phone_evidence':fallback?'gpu_fallback':!verified?'unverified_build':window.invalidReason;
    lastReport=Object.freeze({schema:REPORT_SCHEMA,version:1,purpose:REPORT_PURPOSE,packageVersion:PACKAGE_VERSION,
      build:{stamp:BUILD_STAMP,bundleManifestSha256:provenance?.sha256??null},
      ...(AFTER_RESULT?{scheduler:SCHEDULER}:{}),
      delegate:{requested:'gpu-webgl',selected:selectedDelegate,fallback,fallbackReason},
      valid:window.valid&&!preview&&!fallback&&verified,invalidReason,window});
    downloadButton.hidden=false;downloadButton.disabled=false;
    summary.textContent=`Camera ${window.ratesFps.cameraUnique??'—'}/s · poses ${window.ratesFps.cvPoses??'—'}/s · markers ${window.ratesFps.markerPresentation??'—'}/s`;
    state.textContent=lastReport.valid?'GPU/WebGL 60-second experiment complete. Download JSON.':`${delegateLabel()} · window invalid (${invalidReason??reason}). Download JSON or retry.`;
  }else state.textContent=`${delegateLabel()} · warmup interrupted (${reason}). Retry when ready.`;
  phase='waiting';refresh();
}
function checkWindow(){
  if(phase!=='warmup'&&phase!=='measuring')return null;
  if(document.hidden)return 'hidden';
  if(!cameraLive()||performance.now()-lastCameraTime>2000)return 'camera_lost';
  if(AFTER_RESULT&&videoPresentationFailed)return 'camera_presentation_identity_lost';
  if(!cvLive())return 'cv_lost';
  if(stageGeometry()!==geometry)return 'geometry_changed';
  if(cameraTrack!==stream?.getVideoTracks()[0] || cameraIdentity!==cameraKey())return 'camera_changed';
  if(!calibrated()||snapshot().calibration.calibrationId!==calibrationId)return 'calibration_changed';
  try{checkedExecution(selectedDelegate,adapter);}catch{return 'cv_lost';}
  const status=cv.getStatus();
  if(lastCvCounters && (status.submittedFrameCount<lastCvCounters.submittedFrameCount || status.poseFrameCount<lastCvCounters.poseFrameCount || status.droppedFrameCount<lastCvCounters.droppedFrameCount))return 'counter_reset';
  lastCvCounters=status;
  return null;
}
function cameraKey(){const t=stream?.getVideoTracks()[0],s=t?.getSettings()??{};return [video.videoWidth,video.videoHeight,s.width,s.height,s.frameRate,s.facingMode].join('|');}
// A synthetic browser fixture may reach unchanged native calibration only in
// the explicitly invalid QA preview. Normal physical-phone pages expose no seam.
if(preview)Object.defineProperty(window,'__aerobeatCvMarkerQa',{value:Object.freeze({
  getNativeInput:()=>input,getCvStatus:()=>cv?.getStatus(),getLatestPose:()=>cv?.getLatestPoseFrame(),getCameraIdentity:()=>cameraIdentity,
  getDelegate:()=>({selectedDelegate,fallback,fallbackReason,actualDelegate:adapter?.getTelemetryStatus()?.actualDelegate,provider:adapter?.getExecutionTelemetry()?.provider}),
  getPresentedFrameId:()=>AFTER_RESULT?presentedFrameId:null,
  renderFixtureMarkers:()=>{
    // Synchronous local DOM projection only: no adapter, input or recorder mutation.
    // The real checkerboard Worker has zero human landmarks; this tests CSS mapping,
    // not whether it detects a person. Only the invalid ?preview=1 mode has this hook.
    if(!input||!cameraLive()||!calibrated())return false;
    return renderMarkers({landmarks:[
      {name:'left_wrist',x:.35,y:.48,confidence:.99},
      {name:'right_wrist',x:.65,y:.48,confidence:.99},
      {name:'nose',x:.50,y:.32,confidence:.99}
    ]},input.getSnapshot()).valid;
  }
}),configurable:false,enumerable:false});
function refresh(){startButton.disabled=disposed||phase!=='waiting'||!cameraLive()||!cvLive()||!calibrated()||!provenance;
  if(phase==='waiting'&&!lastReport)state.textContent=provenanceFailure?'GPU experiment bundle manifest failed; physical reports unavailable.':!cameraLive()?'Allow the camera; loading video…':!cvLive()?`Loading ${delegateLabel()} pose Worker…`:!calibrated()?snapshot()?.tracking?.anchorsFrozen?`${delegateLabel()} · tracking lost: hold still until wrists and nose recover.`:`${delegateLabel()} · hold a T-pose for calibration, then release.`:`${delegateLabel()} ready. Tap Measure to record camera + CV markers.`;
}
function frame(now){
  if(disposed)return;raf=requestAnimationFrame(frame);
  const failed=checkWindow();if(failed){stopWindow(failed);hideDots();return;}
  if(!cvLive()||!cameraLive()){hideDots();refresh();return;}
  if(phase==='waiting' && (cameraTrack!==stream?.getVideoTracks()[0] || cameraIdentity!==cameraKey())){cameraTrack=stream?.getVideoTracks()[0];cameraIdentity=cameraKey();input.resetCalibration('media_source_changed');hideDots();}
  const status=cv.getStatus(),pose=cv.getLatestPoseFrame();
  if(status.poseFrameCount!==lastPoseCount && pose){
    lastPoseCount=status.poseFrameCount;lastPoseAt=performance.now();
    if(lastSourceId!==null && (pose.sourceId!==lastSourceId||pose.mirrored!==lastMirror)){stopWindow('source_changed');input.resetCalibration('media_source_changed');hideDots();}
    lastSourceId=pose.sourceId;lastMirror=pose.mirrored;
    if(pose.sourceId!==mediaPipeLiveSourceId||pose.mirrored!==true){stopWindow('source_changed');hideDots();return;}
    const before=input.getSnapshot();
    const next=input.processPoseSample(pose,{sourceAspectRatio:video.videoWidth/video.videoHeight,sourceChangeId:cameraIdentity});
    const processed=next!==before;
    const evidence=next.latestEvidence;
    const visibleMeasured=Object.values(markerNames).every(name=>{
      const item=pose.landmarks?.find(landmark=>landmark.name===name);
      const projected=item?.confidence>=.5 && markerCoverPosition(item,video.videoWidth,video.videoHeight,stage.clientWidth,stage.clientHeight);
      return projected && projected.x>=0 && projected.x<=stage.clientWidth && projected.y>=0 && projected.y<=stage.clientHeight;
    });
    const valid=processed && calibrated() && next.tracking.allRequiredAnchorsVisible && !next.tracking.anchorsFrozen && evidence?.provenance==='measured' && visibleMeasured;
    const held=processed && next.tracking.anchorsFrozen===true;
    const telemetry=cv.getPerformanceSample();
    if(phase==='measuring')observer.pose(status,pose.timestampMs,telemetry.runtimeInferenceDurationMs,telemetry.estimateDurationMs,processed,valid,held);
    if(phase==='warmup' && snapshot().calibration.calibrationId!==calibrationId){stopWindow('calibration_changed');}
    if(phase==='measuring' && snapshot().calibration.calibrationId!==calibrationId){stopWindow('calibration_changed');}
  }
  if(lastPoseAt && now-lastPoseAt>=100 && now-input.getSnapshot().timestampMs>=100){input.advanceTime(now);}
  if(phase==='measuring' && !calibrated()){stopWindow('calibration_changed');hideDots();return;}
  if(phase==='warmup'||phase==='measuring'){const afterAdvance=checkWindow();if(afterAdvance){stopWindow(afterAdvance);hideDots();return;}}
  const snap=input.getSnapshot();
  const rendered=renderMarkers(pose,snap);
  if(phase==='measuring'){
    observer.display(now,rendered.valid || rendered.held);
    if(rendered.held)state.textContent=`${delegateLabel()} · tracking lost: native input holding last measured pose; dots hidden.`;
    if(now%1000<25){const win=observer.snapshot(now,status);if(!rendered.held)state.textContent=`${delegateLabel()} recording markers · ${Math.max(0,Math.ceil((MEASURE-(now-windowStartedAt))/1000))}s left`;
      summary.textContent=`Camera ${win.ratesFps.cameraUnique??'—'}/s · poses ${win.ratesFps.cvPoses??'—'}/s · marker presentation ${win.ratesFps.markerPresentation??'—'}/s`;}
  }
  refresh();
}
let windowStartedAt=0;
function cancelCameraTick(){if(videoCallback!==null){video.cancelVideoFrameCallback(videoCallback);videoCallback=null;}presentedFrameId=null;}
function cameraTick(_now,metadata){videoCallback=null;if(disposed||videoPresentationFailed)return;
  const time=metadata?.mediaTime,presented=metadata?.presentedFrames;
  if(AFTER_RESULT && (!Number.isSafeInteger(presented)||presented<0||!Number.isFinite(time))){
    videoPresentationFailed=true;stopWindow('camera_presentation_identity_lost');hideDots();refresh();return;
  }
  if(AFTER_RESULT&&presented<lastPresented){videoPresentationFailed=true;stopWindow('camera_presentation_identity_lost');hideDots();refresh();return;}
  if(Number.isFinite(time)&&time>lastMediaTime&&(!Number.isFinite(presented)||presented>lastPresented)){
    lastMediaTime=time;if(Number.isFinite(presented))lastPresented=presented;lastCameraTime=performance.now();
    if(AFTER_RESULT)presentedFrameId=presented;
    if(phase==='measuring')observer.videoFrame(metadata);
  }
  videoCallback=video.requestVideoFrameCallback(cameraTick);
}
async function boot(){
  try{
    if(!navigator.mediaDevices?.getUserMedia||!video.requestVideoFrameCallback||(AFTER_RESULT&&!video.cancelVideoFrameCallback))throw new Error('Secure camera and video-frame callbacks required');
    state.textContent='Requesting camera permission…';
    const acquired=await navigator.mediaDevices.getUserMedia(defaultLiveCameraConstraints());
    if(disposed||requestCancelled){acquired.getTracks().forEach(track=>track.stop());return;}
    stream=acquired;video.srcObject=stream;await video.play();
    if(disposed){stream.getTracks().forEach(track=>track.stop());return;}
    cameraTrack=stream.getVideoTracks()[0];cameraIdentity=cameraKey();lastCameraTime=performance.now();presentedFrameId=null;videoPresentationFailed=false;
    stream.getVideoTracks()[0].addEventListener('ended',()=>{stopWindow('camera_lost');hideDots();refresh();});
    videoCallback=video.requestVideoFrameCallback(cameraTick);
    input=createAeroBodyGridService();
    // Failed GPU initialization alone permits fallback; never switch after a window starts.
    try{await startDelegate(mediaPipeDelegates.gpuWebgl);}
    catch{
      let disposedFailed=true;
      if(cv){try{await cv.dispose();}catch{disposedFailed=false;}}
      else if(adapter){try{await adapter.dispose();}catch{disposedFailed=false;}}
      if(!disposedFailed)throw new Error('Failed GPU Worker could not be disposed');
      cv=null;adapter=null;selectedDelegate=null;
      if(disposed)return;fallback=true;fallbackReason='gpu_init_failed';
      state.textContent='GPU/WebGL initialization failed. Loading fresh CPU/WASM fallback Worker…';
      await startDelegate(mediaPipeDelegates.cpuWasm);
    }
    if(disposed){await cv?.dispose();return;}phase='waiting';raf=requestAnimationFrame(frame);refresh();
  }catch{cancelCameraTick();stopWindow('cv_lost');state.textContent='Camera/CV unavailable. Retry after reloading this private experiment.';hideDots();if(cv)void cv.dispose().catch(()=>{});else if(adapter)void adapter.dispose().catch(()=>{});}
}
async function startDelegate(requested){
  state.textContent=`Loading ${requested==='gpu-webgl'?'GPU/WebGL':'CPU/WASM fallback'} Pose Landmarker Lite Worker…`;
  const candidate=createMediaPipeWorkerPoseAdapter({sourceId:mediaPipeLiveSourceId,mirrored:true,delegate:requested,
    modelUrl:new URL('assets/mediapipe/pose_landmarker_lite.task',location.href).href,modelSha256:mediaPipeDefaultModelSha256,modelSizeBytes:mediaPipeDefaultModelSizeBytes,
    wasmRootUrl:new URL('assets/mediapipe/wasm',location.href).href,tasksVisionScriptUrl:new URL('assets/mediapipe/vision_bundle.js',location.href).href,
    minPoseDetectionConfidence:lockedProductionCvProfile.minPoseDetectionConfidence,minPosePresenceConfidence:lockedProductionCvProfile.minPosePresenceConfidence,minTrackingConfidence:lockedProductionCvProfile.minTrackingConfidence});
  adapter=candidate;
  cv=createPrivateExperimentalCvService({poseAdapter:candidate,selectedDelegate:requested,submissionCadenceTargetFps:lockedProductionCvProfile.submissionCadenceTargetFps,...(AFTER_RESULT?{schedulingMode:'after-result'}:{})});
  // Preview-only seam does not generate synthetic poses; CPU still loads a real Worker.
  if(requested==='gpu-webgl'&&forceGpuInitFail)throw new Error('Preview-only GPU initialization failure');
  const cameraSource=createLockedVideoFrameSource(video,{sourceId:mediaPipeLiveSourceId,mirrored:true});
  // The sole callback above observes real presentations for both recorder and scheduler.
  // Do not derive identity from performance.now() or increment on a scheduler retry.
  const source=AFTER_RESULT?Object.freeze({...cameraSource,getPresentedFrameId:()=>videoPresentationFailed?null:presentedFrameId}):cameraSource;
  await cv.start(source);
  checkedExecution(requested,candidate);
  if(disposed)throw new Error('Page disposed during CV startup');
  selectedDelegate=requested;
}
function begin(){if(phase!=='waiting'||!calibrated()||!cvLive()||!cameraLive()||!provenance)return;
  try{checkedExecution(selectedDelegate,adapter);}catch{state.textContent='Worker delegate identity unavailable; cannot record.';return;}
  lastReport=null;downloadButton.hidden=true;downloadButton.disabled=true;phase='warmup';geometry=stageGeometry();cameraTrack=stream.getVideoTracks()[0];cameraIdentity=cameraKey();calibrationId=snapshot().calibration.calibrationId;lastCvCounters=cv.getStatus();
  state.textContent=preview?`${delegateLabel()} · QA warmup (not sustained phone evidence)`:`${delegateLabel()} · warmup · 3 seconds`;
  warmupTimer=setTimeout(()=>{warmupTimer=null;if(phase!=='warmup')return;const failure=checkWindow();if(failure){stopWindow(failure);return;}
    observer=createPhoneCvMarkerWindow();windowStartedAt=performance.now();
    if(!observer.start(windowStartedAt,cv.getStatus(),cameraSettings())){stopWindow('counter_reset');return;}
    phase='measuring';measureTimer=setTimeout(()=>stopWindow(checkWindow()),MEASURE);
  },WARMUP);
}
startButton.addEventListener('click',event=>{if(event.isTrusted)begin();});
downloadButton.addEventListener('click',event=>{if(!event.isTrusted||!lastReport)return;
  const json=JSON.stringify(lastReport,null,2);if(json.length>16384){state.textContent='Report exceeded private size bound';return;}
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=AFTER_RESULT?'aerobeat-camera-cv-gpu-after-result-v1.json':'aerobeat-camera-cv-gpu-experiment-v1.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopWindow('hidden');hideDots();}});
window.addEventListener('pagehide',()=>{disposed=true;requestCancelled=true;stopWindow('disposed');if(raf!==null)cancelAnimationFrame(raf);cancelCameraTick();void cv?.dispose();input?.destroy();video.pause();video.srcObject=null;stream?.getTracks().forEach(track=>track.stop());});
(async()=>{try{const response=await fetch(MANIFEST_FILE,{cache:'no-store'});if(!response.ok)throw new Error('missing manifest');const bytes=await response.arrayBuffer();if(bytes.byteLength<16||bytes.byteLength>128000)throw new Error('manifest size');
  const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(manifest?.schema!==MANIFEST_SCHEMA||manifest.version!==1||manifest.buildStamp!==BUILD_STAMP||(AFTER_RESULT&&(manifest.scheduler?.mode!==SCHEDULER.mode||manifest.scheduler?.targetFps!==SCHEDULER.targetFps||manifest.purpose!==REPORT_PURPOSE))||!Array.isArray(manifest.assets)||manifest.assets.length<2)throw new Error('manifest identity');
  provenance=Object.freeze({sha256:await sha256Hex(bytes)});
  }catch{if(import.meta.env.DEV)provenance=Object.freeze({sha256:null});else{provenanceFailure=true;state.textContent='Bundle identity failed; no physical report allowed.';}}
  refresh();})();
if(preview)summary.textContent=`GPU-first ${AFTER_RESULT?'after-result ':''}QA preview: 0.5s warmup + 4s window; JSON always invalid as sustained physical evidence.`;
void boot();
