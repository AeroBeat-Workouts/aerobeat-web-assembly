// @ts-check

const DEFAULT_CAPACITY = 512;
const NOMINAL_VSYNC_MS = 1000 / 60;

/** Bounded aggregate-only profiler. It never accepts pose coordinates, pixels, device IDs, or geometry. */
export function createPrivatePerformanceRecorder(options = {}) {
  const capacity = Math.max(32, Math.min(2048, Number.isInteger(options.capacity) ? Number(options.capacity) : DEFAULT_CAPACITY));
  let label = "unlabeled";
  let startedAtMs = 0;
  let lastDisplayAtMs = null;
  let latestCvPoseCount = -1;
  let displayFrameCount = 0;
  let submittedFrameStart = 0;
  let submittedFrameLatest = 0;
  let poseFrameStart = 0;
  let poseFrameLatest = 0;
  let missedVsyncCount = 0;
  let cameraFormat = Object.freeze({ width:null, height:null, frameRate:null });
  const displayIntervals = [];
  const rendererCpuDurations = [];
  const mediaPipeRuntimeDurations = [];
  const mediaPipeEndToEndDurations = [];
  const poseAges = [];

  return Object.freeze({
    reset(nextLabel, nowMs) {
      label = boundedLabel(nextLabel); startedAtMs = finiteNonNegative(nowMs); lastDisplayAtMs = null; latestCvPoseCount = -1; displayFrameCount = 0; submittedFrameStart = 0; submittedFrameLatest = 0; poseFrameStart = 0; poseFrameLatest = 0; missedVsyncCount = 0; cameraFormat = Object.freeze({ width:null, height:null, frameRate:null });
      displayIntervals.length = 0; rendererCpuDurations.length = 0; mediaPipeRuntimeDurations.length = 0; mediaPipeEndToEndDurations.length = 0; poseAges.length = 0;
    },
    record(sample) {
      const timestampMs = finiteNonNegative(sample?.timestampMs);
      if (lastDisplayAtMs !== null && timestampMs >= lastDisplayAtMs) {
        const interval = timestampMs - lastDisplayAtMs; pushBounded(displayIntervals, interval, capacity); missedVsyncCount += Math.max(0, Math.round(interval / NOMINAL_VSYNC_MS) - 1);
      }
      lastDisplayAtMs = timestampMs; displayFrameCount += 1;
      pushBounded(rendererCpuDurations, finiteNonNegative(sample?.rendererCpuMs), capacity);
      const poseTimestampMs = optionalFiniteNonNegative(sample?.poseTimestampMs), poseObservedAtMs=optionalFiniteNonNegative(sample?.poseObservedAtMs)??timestampMs;
      if (poseTimestampMs !== null) pushBounded(poseAges, Math.max(0, poseObservedAtMs - poseTimestampMs), capacity);
      const cv = sample?.cv;
      if (cv && typeof cv === "object") {
        const submitted = integerNonNegative(cv.submittedFrameCount), poses = integerNonNegative(cv.poseFrameCount);
        if (displayFrameCount === 1) { submittedFrameStart = submitted; poseFrameStart = poses; }
        submittedFrameLatest = submitted; poseFrameLatest = poses;
        if (cv.running !== false && poses !== latestCvPoseCount) {
          latestCvPoseCount = poses;
          const runtime = optionalFiniteNonNegative(cv.runtimeInferenceDurationMs), endToEnd = optionalFiniteNonNegative(cv.estimateDurationMs);
          if (runtime !== null) pushBounded(mediaPipeRuntimeDurations, runtime, capacity);
          if (endToEnd !== null) pushBounded(mediaPipeEndToEndDurations, endToEnd, capacity);
        }
      }
      cameraFormat = sanitizeCameraFormat(sample?.camera);
    },
    snapshot(nowMs) {
      const endedAtMs = finiteNonNegative(nowMs), durationMs = Math.max(0, endedAtMs - startedAtMs), intervalStats = statistics(displayIntervals);
      return Object.freeze({
        schema:"aerobeat/private_performance_window", version:1, label, durationMs, displayFrameCount,
        displayRateFps:durationMs > 0 && displayFrameCount > 1 ? round3((displayFrameCount - 1) * 1000 / durationMs) : null,
        displayIntervals:intervalStats, missedVsyncCount,
        rendererCpuMs:statistics(rendererCpuDurations), mediaPipeRuntimeMs:statistics(mediaPipeRuntimeDurations), mediaPipeEndToEndMs:statistics(mediaPipeEndToEndDurations), poseAgeMs:statistics(poseAges),
        cv:Object.freeze({ submittedFrameCount:Math.max(0,submittedFrameLatest-submittedFrameStart), poseFrameCount:Math.max(0,poseFrameLatest-poseFrameStart), submissionRateFps:durationMs>0?round3(Math.max(0,submittedFrameLatest-submittedFrameStart)*1000/durationMs):null }),
        camera:cameraFormat
      });
    }
  });
}

function pushBounded(values,value,capacity){values.push(value);if(values.length>capacity)values.splice(0,values.length-capacity);}
function statistics(values){if(values.length===0)return Object.freeze({count:0,p50:null,p95:null,max:null});const ordered=[...values].sort((left,right)=>left-right);return Object.freeze({count:values.length,p50:round3(percentile(ordered,.5)),p95:round3(percentile(ordered,.95)),max:round3(ordered[ordered.length-1])});}
function percentile(ordered,quantile){return ordered[Math.min(ordered.length-1,Math.max(0,Math.ceil(ordered.length*quantile)-1))];}
function sanitizeCameraFormat(value){if(!value||typeof value!=="object")return Object.freeze({width:null,height:null,frameRate:null});return Object.freeze({width:boundedDimension(value.width),height:boundedDimension(value.height),frameRate:boundedFrameRate(value.frameRate)});}
function boundedDimension(value){const number=Number(value);return Number.isFinite(number)&&number>0&&number<=16384?Math.round(number):null;}
function boundedFrameRate(value){const number=Number(value);return Number.isFinite(number)&&number>0&&number<=240?round3(number):null;}
function boundedLabel(value){return typeof value==="string"&&value.length>0?value.slice(0,32):"unlabeled";}
function integerNonNegative(value){const number=Number(value);return Number.isInteger(number)&&number>=0?number:0;}
function finiteNonNegative(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,number):0;}
function optionalFiniteNonNegative(value){if(value===null||value===undefined)return null;const number=Number(value);return Number.isFinite(number)?Math.max(0,number):null;}
function round3(value){return Math.round(value*1000)/1000;}
