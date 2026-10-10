// @ts-check

const SAMPLE_LIMIT=512;
const timingNames=["admissionGapMs","sourceToAdapterMs","adapterWallMs","workerRoundTripMs","inferenceMs","postprocessMs","workerOtherCombinedMs","completionToAdmissionMs"];

/** Bounded, scalar-only timing for the isolated phone page. No production service or Worker hooks. */
export function createPhonePerformancePipeline(){
  let active=false,epoch=0,busyAtStart=0,lastAdmissionAt=null,lastCompletionAt=null,pendingAdmission=null;
  let availabilityChecks=0,readyFailures=0,heldFrameChecks=0,staleFrameChecks=0,freshChecks=0,admissions=0,adapterCalls=0,completed=0,estimateFailures=0,unpairedWorkerTimings=0;
  const samples=Object.fromEntries(timingNames.map(name=>[name,[]]));
  return Object.freeze({
    reset(busyDrops){
      ++epoch;active=true;busyAtStart=boundedCount(busyDrops);lastAdmissionAt=null;lastCompletionAt=null;pendingAdmission=null;
      availabilityChecks=0;readyFailures=0;heldFrameChecks=0;staleFrameChecks=0;freshChecks=0;admissions=0;adapterCalls=0;completed=0;estimateFailures=0;unpairedWorkerTimings=0;
      for(const name of timingNames)samples[name].length=0;
    },
    stop(){active=false;++epoch;pendingAdmission=null;},
    checkAvailability({ready,fresh,recent}){
      if(active){
        availabilityChecks++;
        if(!ready)readyFailures++;
        else if(!fresh)heldFrameChecks++;
        else if(!recent)staleFrameChecks++;
        else freshChecks++;
      }
      return Boolean(ready&&fresh&&recent);
    },
    admitted(atMs){
      if(!active)return;
      const at=validTime(atMs);if(at===null)return;
      admissions++;
      if(lastAdmissionAt!==null)push(samples.admissionGapMs,at-lastAdmissionAt);
      if(lastCompletionAt!==null)push(samples.completionToAdmissionMs,at-lastCompletionAt);
      lastAdmissionAt=at;pendingAdmission={at,epoch};
    },
    adapterCalled(atMs){
      if(!active)return null;
      const at=validTime(atMs);if(at===null)return null;
      adapterCalls++;
      const admission=pendingAdmission;pendingAdmission=null;
      if(admission?.epoch===epoch)push(samples.sourceToAdapterMs,at-admission.at);
      return Object.freeze({at,epoch});
    },
    settled(ticket,atMs,telemetry,error=false){
      if(!active||!ticket||ticket.epoch!==epoch)return;
      const at=validTime(atMs);if(at===null)return;
      if(error){estimateFailures++;return;}
      completed++;lastCompletionAt=at;
      push(samples.adapterWallMs,at-ticket.at);
      const worker=finiteDuration(telemetry?.workerRoundTripDurationMs),inference=finiteDuration(telemetry?.runtimeInferenceDurationMs),postprocess=finiteDuration(telemetry?.postprocessDurationMs);
      if(worker===null||inference===null||postprocess===null||worker+0.001<inference+postprocess){unpairedWorkerTimings++;return;}
      push(samples.workerRoundTripMs,worker);push(samples.inferenceMs,inference);push(samples.postprocessMs,postprocess);
      push(samples.workerOtherCombinedMs,Math.max(0,worker-inference-postprocess));
    },
    snapshot(busyDrops){
      const busySkips=Math.max(0,boundedCount(busyDrops)-busyAtStart);
      return Object.freeze({
        sampleLimit:SAMPLE_LIMIT,
        counts:Object.freeze({busySkips,availabilityChecks,observedOpportunities:busySkips+availabilityChecks,readyFailures,heldFrameChecks,staleFrameChecks,freshChecks,admissions,adapterCalls,completed,estimateFailures,unpairedWorkerTimings}),
        timingsMs:Object.freeze(Object.fromEntries(timingNames.map(name=>[name,statistics(samples[name])]))),
        note:"Observed opportunities count only busy skips and availability checks, not all timer callbacks. Source-to-adapter includes frame construction and metadata/queue work. Worker-other combines transfer, Worker scheduling/preprocess and reply dispatch; it is not transfer-only. Timing samples retain at most 512 values per segment."
      });
    }
  });
}

function boundedCount(value){return Number.isSafeInteger(value)&&value>=0?value:0;}
function validTime(value){return typeof value==="number"&&Number.isFinite(value)&&value>=0?value:null;}
function finiteDuration(value){return validTime(value);}
function push(list,value){if(Number.isFinite(value)&&value>=0){list.push(value);if(list.length>SAMPLE_LIMIT)list.shift();}}
function statistics(values){
  if(!values.length)return Object.freeze({count:0,p50:null,p95:null,max:null});
  const sorted=[...values].sort((a,b)=>a-b);
  return Object.freeze({count:sorted.length,p50:round(sorted[Math.ceil(sorted.length*.5)-1]),p95:round(sorted[Math.ceil(sorted.length*.95)-1]),max:round(sorted[sorted.length-1])});
}
function round(value){return Math.round(value*1000)/1000;}
