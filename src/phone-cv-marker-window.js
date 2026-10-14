// @ts-check
// Private scalar-only camera/CV marker window. Pose geometry never enters this observer.
const LIMIT = 10_000_000;
const round = value => Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) / 1000 : null;
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= LIMIT ? value : null;
const delta = (after, before) => count(after) !== null && count(before) !== null && after >= before ? count(after - before) : null;
const metric = values => {
  const sorted = [...values].sort((a,b) => a-b);
  return {count:sorted.length,p50:sorted.length ? round(sorted[Math.ceil(sorted.length*.5)-1]) : null,p95:sorted.length ? round(sorted[Math.ceil(sorted.length*.95)-1]) : null};
};
function safeCamera(value) {
  const dimension = n => Number.isSafeInteger(n) && n > 0 && n <= 16384 ? n : null;
  return {width:dimension(value?.width),height:dimension(value?.height),configuredFrameRateFps:Number.isFinite(value?.frameRate) && value.frameRate > 0 && value.frameRate <= 240 ? round(value.frameRate) : null};
}
/** Cover-crop measured normalized camera point into mirrored CSS stage coordinates. Never serialize its result. */
export function markerCoverPosition(point, width, height, stageWidth, stageHeight) {
  if (![point?.x,point?.y,width,height,stageWidth,stageHeight].every(Number.isFinite) || width <= 0 || height <= 0 || stageWidth <= 0 || stageHeight <= 0 || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
  const scale = Math.max(stageWidth / width, stageHeight / height);
  return {x:stageWidth / 2 + (.5 - point.x) * width * scale,y:stageHeight / 2 + (point.y - .5) * height * scale};
}
/** Samples remain local scalar rolling distributions; caller supplies no coordinate-bearing object. */
export function createPhoneCvMarkerWindow() {
  let base = null, ended = null, invalidReason = 'not_started', cameraFrames = 0, presentationFrames = 0, fresh = 0, valid = 0, held = 0;
  let lastMediaTime = -Infinity, lastPresented = -Infinity, lastPoseCount = -1, lastPoseTimestamp = null;
  const inference = [], roundtrip = [], ages = [];
  const push = (values, value) => { if (Number.isFinite(value) && value >= 0 && value <= 120000) { values.push(value); if (values.length > 2048) values.shift(); } };
  function start(now, status, camera) {
    if (!Number.isFinite(now) || now < 0 || !status || [status.submittedFrameCount,status.poseFrameCount,status.droppedFrameCount].some(v => count(v) === null)) return false;
    base = {now, submitted:status.submittedFrameCount, poses:status.poseFrameCount, dropped:status.droppedFrameCount,camera:safeCamera(camera)};
    ended = null; invalidReason = ''; cameraFrames = presentationFrames = fresh = valid = held = 0;
    lastMediaTime = lastPresented = -Infinity; lastPoseCount = status.poseFrameCount; lastPoseTimestamp = null;
    inference.length = roundtrip.length = ages.length = 0;
    return true;
  }
  function videoFrame(metadata) {
    if (!base || ended !== null || invalidReason) return;
    const time = metadata?.mediaTime, presented = metadata?.presentedFrames;
    if (Number.isFinite(time) && time > lastMediaTime && (!Number.isFinite(presented) || presented > lastPresented)) {
      lastMediaTime = time; if (Number.isFinite(presented)) lastPresented = presented; cameraFrames++;
    }
  }
  function pose(status, timestampMs, inferenceMs, roundtripMs, processed, isValid, isHeld) {
    if (!base || ended !== null || invalidReason || !status) return;
    if (count(status.poseFrameCount) === null || status.poseFrameCount < lastPoseCount) { invalidate('counter_reset'); return; }
    if (status.poseFrameCount === lastPoseCount) return;
    lastPoseCount = status.poseFrameCount;
    lastPoseTimestamp = Number.isFinite(timestampMs) ? timestampMs : null;
    push(inference,inferenceMs); push(roundtrip,roundtripMs);
    if (processed) fresh++;
    if (processed && isValid) valid++;
    if (processed && isHeld) held++;
  }
  function display(now, visible) {
    if (!base || ended !== null || invalidReason) return;
    presentationFrames++;
    if (visible && lastPoseTimestamp !== null) push(ages,Math.max(0,now-lastPoseTimestamp));
  }
  function invalidate(reason) { if (base && !invalidReason && ended === null) invalidReason = String(reason); }
  function snapshot(now,status) {
    const durationMs = base ? round(Math.min(60000,Math.max(0,(ended ?? now)-base.now))) : 0;
    const submitted = base ? delta(status?.submittedFrameCount,base.submitted) : null;
    const poses = base ? delta(status?.poseFrameCount,base.poses) : null;
    const drops = base ? delta(status?.droppedFrameCount,base.dropped) : null;
    const reason = invalidReason || (base && [submitted,poses,drops].some(v=>v===null) ? 'counter_reset' : null) || (ended !== null && !cameraFrames ? 'no_camera_frames' : null) || (ended !== null && !poses ? 'no_poses' : null);
    const rate = n => n !== null && durationMs > 0 ? round(n*1000/durationMs) : null;
    return {schema:'aerobeat/private_phone_cv_marker_window',version:1,purpose:'camera_cv_marker_baseline',valid:!reason,invalidReason:reason,durationMs,
      counts:{cameraUniqueMediaFrames:count(cameraFrames),cvSubmitted:submitted,cvPoses:poses,cvBusyDrops:drops,nativeFreshInput:count(fresh),freshValidMarkers:count(valid),freshHeldMarkers:count(held),markerPresentationFrames:count(presentationFrames)},
      ratesFps:{denominatorMs:durationMs,cameraUnique:rate(cameraFrames),cvSubmitted:rate(submitted),cvPoses:rate(poses),nativeFreshInput:rate(fresh),markerPresentation:rate(presentationFrames)},
      camera:base?.camera ?? safeCamera(null),inferenceMs:metric(inference),roundtripMs:metric(roundtrip),displayWeightedPoseAgeMs:metric(ages)};
  }
  function stop(now,status) { if (base && ended === null) ended = now; return snapshot(now,status); }
  return Object.freeze({start,videoFrame,pose,display,invalidate,snapshot,stop});
}
