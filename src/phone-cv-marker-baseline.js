// @ts-check
// Private camera → unchanged production CV → native calibration → CSS marker baseline.
import { defaultLiveCameraConstraints } from '@aerobeat/web-video';
import { createMediaPipeWorkerPoseAdapter,mediaPipeDelegates,mediaPipeLiveSourceId,mediaPipeDefaultModelSha256,mediaPipeDefaultModelSizeBytes } from '@aerobeat/web-vendor-mediapipe';
import { createAeroBodyGridService } from '@aerobeat/web-input';
import { sha256Hex } from '@aerobeat/web-hash';
import { createLockedProductionCvService,createLockedVideoFrameSource } from './production-cv-service.js';
import { lockedProductionCvProfile } from './production-cv-profile.js';
import { createPhoneCvMarkerWindow,markerCoverPosition } from './phone-cv-marker-window.js';

const video=document.querySelector('#camera'),stage=document.querySelector('#stage'),state=document.querySelector('#state'),summary=document.querySelector('#summary'),startButton=document.querySelector('#start'),downloadButton=document.querySelector('#download');
const dots=Object.fromEntries([...document.querySelectorAll('.marker')].map(el=>[el.dataset.role,el]));
const preview=new URLSearchParams(location.search).get('preview')==='1';
const WARMUP=preview?500:3000,MEASURE=preview?4000:60000;
const BUILD_STAMP=typeof __AEROBEAT_CV_MARKER_BUILD_STAMP__==='undefined'?'development':__AEROBEAT_CV_MARKER_BUILD_STAMP__;
const PACKAGE_VERSION=typeof __AEROBEAT_PACKAGE_VERSION__==='undefined'?'development':__AEROBEAT_PACKAGE_VERSION__;
let provenance=null,provenanceFailure=false,stream=null,cv=null,input=null,observer=null,lastReport=null,phase='loading',disposed=false;
let lastPoseCount=0,lastPoseAt=0,lastSourceId=null,lastMirror=null,calibrationId=null,lastCameraTime=0,lastMediaTime=-Infinity,lastPresented=-Infinity;
let videoCallback=null,raf=null,measureTimer=null,warmupTimer=null,requestCancelled=false,geometry='',cameraIdentity='',cameraTrack=null,lastCvCounters=null;
const markerNames={left:'left_wrist',right:'right_wrist',nose:'nose'};
function hideDots(){for(const dot of Object.values(dots))dot.hidden=true;}
function stageGeometry(){return [stage.clientWidth,stage.clientHeight,devicePixelRatio,innerWidth,innerHeight,screen.orientation?.angle ?? 0,video.videoWidth,video.videoHeight].join(':');}
function cameraSettings(){const settings=stream?.getVideoTracks()[0]?.getSettings()??{};return {width:settings.width??video.videoWidth,height:settings.height??video.videoHeight,frameRate:settings.frameRate??null};}
function cameraLive(){const track=stream?.getVideoTracks()[0];return track?.readyState==='live' && video.srcObject===stream && !video.paused && video.readyState>=2 && video.videoWidth>0 && video.videoHeight>0;}
function cvLive(){try {const status=cv?.getStatus();return status?.running===true && status.lifecycleState==='running' && !status.error;}catch{return false;}}
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
    if(reason)observer.invalidate(reason);
    let cvStatus=null;try{cvStatus=cv?.getStatus();}catch{/* CV has failed; preserve invalid reason */}
    const window=observer.stop(performance.now(),cvStatus);
    const verified=typeof provenance?.sha256==='string' && /^[0-9a-f]{64}$/.test(provenance.sha256);
    const invalidReason=preview?'qa_preview_not_phone_evidence':!verified?'unverified_build':window.invalidReason;
    lastReport=Object.freeze({schema:'aerobeat/private_phone_cv_marker_baseline_report',version:1,purpose:'camera_cv_marker_baseline',packageVersion:PACKAGE_VERSION,
      build:{stamp:BUILD_STAMP,bundleManifestSha256:provenance?.sha256??null},valid:window.valid&&!preview&&verified,invalidReason,window});
    downloadButton.hidden=false;downloadButton.disabled=false;
    summary.textContent=`Camera ${window.ratesFps.cameraUnique??'—'}/s · poses ${window.ratesFps.cvPoses??'—'}/s · markers ${window.ratesFps.markerPresentation??'—'}/s`;
    state.textContent=lastReport.valid?'60-second baseline complete. Download JSON.':`Window invalid (${invalidReason??reason}). Download JSON or retry.`;
  }else state.textContent=`Warmup interrupted (${reason}). Retry when ready.`;
  phase='waiting';refresh();
}
function checkWindow(){
  if(phase!=='warmup'&&phase!=='measuring')return null;
  if(document.hidden)return 'hidden';
  if(!cameraLive()||performance.now()-lastCameraTime>2000)return 'camera_lost';
  if(!cvLive())return 'cv_lost';
  if(stageGeometry()!==geometry)return 'geometry_changed';
  if(cameraTrack!==stream?.getVideoTracks()[0] || cameraIdentity!==cameraKey())return 'camera_changed';
  if(!calibrated()||snapshot().calibration.calibrationId!==calibrationId)return 'calibration_changed';
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
  if(phase==='waiting'&&!lastReport)state.textContent=provenanceFailure?'Bundle manifest failed; physical reports unavailable.':!cameraLive()?'Allow the camera; loading video…':!cvLive()?'Loading CPU-WASM pose Worker…':!calibrated()?snapshot()?.tracking?.anchorsFrozen?'Tracking lost: hold still until wrists and nose recover.':'Hold a T-pose for calibration, then release.':'Ready. Tap Measure to record camera + CV markers.';
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
    if(rendered.held)state.textContent='Tracking lost: native input holding last measured pose; dots hidden.';
    if(now%1000<25){const win=observer.snapshot(now,status);if(!rendered.held)state.textContent=`Recording markers · ${Math.max(0,Math.ceil((MEASURE-(now-windowStartedAt))/1000))}s left`;
      summary.textContent=`Camera ${win.ratesFps.cameraUnique??'—'}/s · poses ${win.ratesFps.cvPoses??'—'}/s · marker presentation ${win.ratesFps.markerPresentation??'—'}/s`;}
  }
  refresh();
}
let windowStartedAt=0;
function cameraTick(_now,metadata){videoCallback=null;if(disposed)return;
  const time=metadata?.mediaTime,presented=metadata?.presentedFrames;
  if(Number.isFinite(time)&&time>lastMediaTime&&(!Number.isFinite(presented)||presented>lastPresented)){
    lastMediaTime=time;if(Number.isFinite(presented))lastPresented=presented;lastCameraTime=performance.now();
    if(phase==='measuring')observer.videoFrame(metadata);
  }
  videoCallback=video.requestVideoFrameCallback(cameraTick);
}
async function boot(){
  try{
    if(!navigator.mediaDevices?.getUserMedia||!video.requestVideoFrameCallback)throw new Error('Secure camera and video-frame callbacks required');
    state.textContent='Requesting camera permission…';
    const acquired=await navigator.mediaDevices.getUserMedia(defaultLiveCameraConstraints());
    if(disposed||requestCancelled){acquired.getTracks().forEach(track=>track.stop());return;}
    stream=acquired;video.srcObject=stream;await video.play();
    if(disposed){stream.getTracks().forEach(track=>track.stop());return;}
    cameraTrack=stream.getVideoTracks()[0];cameraIdentity=cameraKey();lastCameraTime=performance.now();
    stream.getVideoTracks()[0].addEventListener('ended',()=>{stopWindow('camera_lost');hideDots();refresh();});
    videoCallback=video.requestVideoFrameCallback(cameraTick);
    state.textContent='Loading CPU-WASM Pose Landmarker Lite…';
    const adapter=createMediaPipeWorkerPoseAdapter({sourceId:mediaPipeLiveSourceId,mirrored:true,delegate:mediaPipeDelegates.cpuWasm,
      modelUrl:new URL('assets/mediapipe/pose_landmarker_lite.task',location.href).href,modelSha256:mediaPipeDefaultModelSha256,modelSizeBytes:mediaPipeDefaultModelSizeBytes,
      wasmRootUrl:new URL('assets/mediapipe/wasm',location.href).href,tasksVisionScriptUrl:new URL('assets/mediapipe/vision_bundle.js',location.href).href,
      minPoseDetectionConfidence:lockedProductionCvProfile.minPoseDetectionConfidence,minPosePresenceConfidence:lockedProductionCvProfile.minPosePresenceConfidence,minTrackingConfidence:lockedProductionCvProfile.minTrackingConfidence});
    cv=createLockedProductionCvService({poseAdapter:adapter,submissionCadenceTargetFps:lockedProductionCvProfile.submissionCadenceTargetFps});
    input=createAeroBodyGridService();
    // Production admission source is passed unchanged: no unique-media-frame gate.
    await cv.start(createLockedVideoFrameSource(video,{sourceId:mediaPipeLiveSourceId,mirrored:true}));
    if(disposed)return;phase='waiting';raf=requestAnimationFrame(frame);refresh();
  }catch(error){stopWindow('cv_lost');state.textContent=`Camera/CV unavailable: ${error instanceof Error?error.message:'unknown failure'}`;hideDots();}
}
function begin(){if(phase!=='waiting'||!calibrated()||!cvLive()||!cameraLive()||!provenance)return;
  lastReport=null;downloadButton.hidden=true;downloadButton.disabled=true;phase='warmup';geometry=stageGeometry();cameraTrack=stream.getVideoTracks()[0];cameraIdentity=cameraKey();calibrationId=snapshot().calibration.calibrationId;lastCvCounters=cv.getStatus();
  state.textContent=preview?'QA warmup (not sustained phone evidence)':'Warmup · 3 seconds';
  warmupTimer=setTimeout(()=>{warmupTimer=null;if(phase!=='warmup')return;const failure=checkWindow();if(failure){stopWindow(failure);return;}
    observer=createPhoneCvMarkerWindow();windowStartedAt=performance.now();
    if(!observer.start(windowStartedAt,cv.getStatus(),cameraSettings())){stopWindow('counter_reset');return;}
    phase='measuring';measureTimer=setTimeout(()=>stopWindow(checkWindow()),MEASURE);
  },WARMUP);
}
startButton.addEventListener('click',event=>{if(event.isTrusted)begin();});
downloadButton.addEventListener('click',event=>{if(!event.isTrusted||!lastReport)return;
  const json=JSON.stringify(lastReport,null,2);if(json.length>16384){state.textContent='Report exceeded private size bound';return;}
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='aerobeat-camera-cv-marker-baseline-v1.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopWindow('hidden');hideDots();}});
window.addEventListener('pagehide',()=>{disposed=true;requestCancelled=true;stopWindow('disposed');if(raf!==null)cancelAnimationFrame(raf);if(videoCallback!==null)video.cancelVideoFrameCallback(videoCallback);void cv?.dispose();input?.destroy();video.pause();video.srcObject=null;stream?.getTracks().forEach(track=>track.stop());});
(async()=>{try{const response=await fetch('/phone-cv-marker-bundle-manifest.json',{cache:'no-store'});if(!response.ok)throw new Error('missing manifest');const bytes=await response.arrayBuffer();if(bytes.byteLength<16||bytes.byteLength>128000)throw new Error('manifest size');
  const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(manifest?.schema!=='aerobeat/private_phone_cv_marker_bundle'||manifest.version!==1||manifest.buildStamp!==BUILD_STAMP||!Array.isArray(manifest.assets)||manifest.assets.length<2)throw new Error('manifest identity');
  provenance=Object.freeze({sha256:await sha256Hex(bytes)});
  }catch{if(import.meta.env.DEV)provenance=Object.freeze({sha256:null});else{provenanceFailure=true;state.textContent='Bundle identity failed; no physical report allowed.';}}
  refresh();})();
if(preview)summary.textContent='QA preview: 0.5s warmup + 4s window; JSON always invalid as sustained physical evidence.';
void boot();
