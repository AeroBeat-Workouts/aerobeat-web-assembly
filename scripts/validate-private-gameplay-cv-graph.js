// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { mediaPipeDefaultModelSha256,mediaPipeDefaultModelSizeBytes } from '@aerobeat/web-vendor-mediapipe';
import { createPrivateGameplayCvService } from '../src/private-gameplay-cv.js';

const graphSource = readFileSync(new URL('../src/service-graph.js', import.meta.url), 'utf8');
const declarations = graphSource.replace(/^import .*;\n/gmu, '').replace(/^export \{ lockedProductionCvProfile \};\n/mu, '').replaceAll('export function ', 'function ');
assert.match(declarations,/createLockedProductionPoseAdapter\(\)/u,'test must retain the real CPU adapter factory');
function graph(mode, pathname = '/index.html', search = '') {
  const made = [], candidateOptions = [];
  const constructors = {
    createAeroWebContentAuthoringService: () => ({loadPackage(){},readAsset(){},exportPackage(){}}),
    createAeroContentRuntime: () => ({}),
    createLockedProductionCvService: () => { made.push('cpu-fixed'); return {kind:'cpu-fixed'}; },
    createPrivateGameplayCvService: options => { made.push('candidate');candidateOptions.push(options);return {kind:'candidate'}; },
    createBrowserVideoMediaFacade: () => ({}),createAeroWebAudioService: () => ({}),
    createAeroBeatSaverVendorService: () => ({}),createAeroBodyGridService: () => ({}),
    createAeroPrototypeProfileRegistry: () => ({}),createAeroGameplaySessionCoordinator: () => ({}),
    createAeroPlayCanvasRenderer: () => ({}),mediaPipeLiveSourceId:'live',
    mediaPipeDelegates:{cpuWasm:'cpu-wasm'},lockedProductionCvProfile:{
      minPoseDetectionConfidence:.4,minPosePresenceConfidence:.5,minTrackingConfidence:.3
    },createMediaPipeWorkerPoseAdapter: () => {made.push('cpu-adapter');return {}; }
  };
  const context = vm.createContext({...constructors,URLSearchParams,globalThis:{location:{pathname,search}}, ...(mode === undefined ? {} : {__AEROBEAT_PRIVATE_GAMEPLAY_CV_MODE__: mode})});
  const factory = vm.runInContext(`${declarations.replace(/function createLockedProductionPoseAdapter\(\) \{[\s\S]*?\n\}/u, 'function createLockedProductionPoseAdapter() { return createMediaPipeWorkerPoseAdapter({delegate: mediaPipeDelegates.cpuWasm}); }')}\ncreateAeroGameServiceGraph`,context);
  return { actual:factory({instanceId:'actual-aero-game'}),made,candidateOptions };
}
assert.deepEqual(graph(undefined).made,['cpu-adapter','cpu-fixed'],'undefined define preserves exact CPU fixed-tick graph');
assert.deepEqual(graph('other').made,['cpu-adapter','cpu-fixed'],'nonmatching define cannot opt in');
assert.deepEqual(graph('gpu-after-result').made,['candidate'],'actual graph selects candidate without eager CPU adapter');
assert.equal(graph('gpu-after-result').actual.cv.kind,'candidate');
// This URL query is permitted only on the candidate diagnostic page + QA preview.
assert.equal(graph('gpu-after-result','/phone-play-cv-test.html','?preview=1&forceGpuInitFail=1').candidateOptions[0].qaGpuInitFailure,true);
for (const [mode,path,query] of [
  [undefined,'/phone-play-cv-test.html','?preview=1&forceGpuInitFail=1'],
  ['other','/phone-play-cv-test.html','?preview=1&forceGpuInitFail=1'],
  ['gpu-after-result','/index.html','?preview=1&forceGpuInitFail=1'],
  ['gpu-after-result','/phone-play-cv-test.html','?forceGpuInitFail=1'],
  ['gpu-after-result','/phone-play-cv-test.html','?preview=1']
]) {
  const result=graph(mode,path,query);
  assert.equal(result.candidateOptions[0]?.qaGpuInitFailure ?? false,false,'non-QA routes cannot force GPU startup failure');
}

// The test fails if either delegate silently regresses to vendor CDN defaults.
const browserOrigin='https://private-candidate.example:8456';
const previousLocation=globalThis.location;
globalThis.location={origin:browserOrigin};
function assertLocalAssets(options) {
  assert.equal(options.modelUrl,`${browserOrigin}/assets/mediapipe/pose_landmarker_lite.task`);
  assert.equal(options.modelSha256,mediaPipeDefaultModelSha256);
  assert.equal(options.modelSizeBytes,mediaPipeDefaultModelSizeBytes);
  assert.equal(options.wasmRootUrl,`${browserOrigin}/assets/mediapipe/wasm`);
  assert.equal(options.tasksVisionScriptUrl,`${browserOrigin}/assets/mediapipe/vision_bundle.js`);
  for (const url of [options.modelUrl,options.wasmRootUrl,options.tasksVisionScriptUrl]) assert.equal(new URL(url).origin,browserOrigin);
}
const deferred = () => { let resolve; const promise = new Promise(done => {resolve=done}); return {promise,resolve}; };
function fixture({gpuFailure = false,gpuDisposeFailure = false,cpuFailure = false, gatedGpu = false} = {}) {
  const calls = [], gate = deferred(), instances = [];
  const cv = createPrivateGameplayCvService({
    createAdapter(options) { assertLocalAssets(options);calls.push(`adapter:${options.delegate}`); return {delegate:options.delegate}; },
    createService({poseAdapter,selectedDelegate,schedulingMode,submissionCadenceTargetFps}) {
      assert.equal(poseAdapter.delegate,selectedDelegate);
      assert.equal(schedulingMode,'after-result');assert.equal(submissionCadenceTargetFps,15);
      const service = {
        running:false,
        async start(source) {
          calls.push(`start:${selectedDelegate}`);
          assert.equal(typeof source.getPresentedFrameId,'function');
          if (selectedDelegate === 'gpu-webgl' && gatedGpu) await gate.promise;
          if (selectedDelegate === 'gpu-webgl' && gpuFailure) throw Error('gpu initialization failed');
          if (selectedDelegate === 'cpu-wasm' && cpuFailure) throw Error('cpu initialization failed');
          this.running=true;
        },
        async stop() {calls.push(`stop:${selectedDelegate}`);this.running=false;},
        async dispose() {calls.push(`dispose:${selectedDelegate}`);if(selectedDelegate==='gpu-webgl'&&gpuDisposeFailure)throw Error('gpu disposal failed');},
        getStatus() {return { lifecycleState:this.running?'running':'error',running:this.running,providerId:this.running?selectedDelegate:null,schedulingMode:'after-result'};},
        getLatestPoseFrame() {return undefined;},
        getPerformanceSample(){return {running:this.running};},
        submitFrame(){calls.push('submit');},
        async nextPoseFrame(){throw Error('after-result nextPoseFrame is not supported');}
      };
      instances.push(service);
      return service;
    }
  });
  return {cv,calls,gate,instances};
}
const source = {sourceId:'camera',mirrored:true,getPresentedFrameId:()=>null};
const fallback=fixture({gpuFailure:true});
assert.equal(fallback.cv.getStatus().providerId,null,'no false provider claim before startup');
await fallback.cv.start(source);
assert.deepEqual(fallback.calls,['adapter:gpu-webgl','start:gpu-webgl','dispose:gpu-webgl','adapter:cpu-wasm','start:cpu-wasm']);
assert.equal(fallback.cv.getStatus().providerId,'cpu-wasm');
assert.equal(fallback.cv.getStatus().schedulingMode,'after-result');
assert.equal(fallback.cv.getStatus().fallback,true);
await assert.rejects(()=>fallback.cv.nextPoseFrame(),/after-result/);
await fallback.cv.stop();await fallback.cv.start(source);
assert.equal(fallback.calls.filter(call=>call==='adapter:gpu-webgl').length,1,'restarts never reselect GPU');
await fallback.cv.dispose();
const successful=fixture();await successful.cv.start(source);
assert.equal(successful.cv.getStatus().providerId,'gpu-webgl');
assert.equal(successful.cv.getStatus().fallback,false);
await successful.cv.stop();
successful.instances[0].start=async()=>{throw Error('gpu restart failed')};
await assert.rejects(()=>successful.cv.start(source),/gpu restart failed/);
assert.equal(successful.calls.includes('adapter:cpu-wasm'),false,'no fallback after successful startup');
await successful.cv.dispose();
const qa=fixture();
// The QA flag is injected only by the graph's exact build/page/preview gate.
// GPU never loads or admits a pose; the CPU service is a newly constructed Worker.
const qaCv=createPrivateGameplayCvService({
  qaGpuInitFailure:true,
  createAdapter(options){assertLocalAssets(options);qa.calls.push(`adapter:${options.delegate}`);return {delegate:options.delegate};},
  createService({selectedDelegate}) {const service={running:false,async start(){qa.calls.push(`start:${selectedDelegate}`);this.running=true;},async stop(){this.running=false;},async dispose(){qa.calls.push(`dispose:${selectedDelegate}`);},getStatus(){return {running:this.running,providerId:this.running?selectedDelegate:null,schedulingMode:'after-result'};},getLatestPoseFrame(){},getPerformanceSample(){return {};},submitFrame(){},nextPoseFrame(){throw Error('after-result');}};return service;}
});
await qaCv.start(source);
assert.deepEqual(qa.calls,['adapter:gpu-webgl','dispose:gpu-webgl','adapter:cpu-wasm','start:cpu-wasm']);
assert.equal(qaCv.getStatus().fallback,true);
await qaCv.dispose();await qa.cv.dispose();
const failedDisposal=fixture({gpuFailure:true,gpuDisposeFailure:true});
await assert.rejects(()=>failedDisposal.cv.start(source),/gpu disposal failed/);
assert.equal(failedDisposal.calls.includes('adapter:cpu-wasm'),false,'failed GPU must dispose before CPU');
await failedDisposal.cv.dispose().catch(()=>{});
const failedCpu=fixture({gpuFailure:true,cpuFailure:true});
await assert.rejects(()=>failedCpu.cv.start(source),/cpu initialization failed/);
assert.equal(failedCpu.cv.getStatus().providerId,null);
await failedCpu.cv.dispose();
const invalid=fixture();await assert.rejects(()=>invalid.cv.start({}),/getPresentedFrameId/);
assert.equal(invalid.calls.length,0);await invalid.cv.dispose();
const cancelled=fixture({gatedGpu:true});const pending=cancelled.cv.start(source);
await Promise.resolve();await Promise.resolve();const stopping=cancelled.cv.stop();
cancelled.gate.resolve();await Promise.all([pending,stopping]);
assert.equal(cancelled.cv.getStatus().running,false);
assert.equal(cancelled.calls.includes('adapter:cpu-wasm'),false);
await cancelled.cv.dispose();
const replaced=fixture({gatedGpu:true});
const sourceA={...source,sourceId:'source-A'},sourceB={...source,sourceId:'source-B'};
const pendingA=replaced.cv.start(sourceA);
await Promise.resolve();await Promise.resolve();
const pendingB=replaced.cv.start(sourceB);
replaced.gate.resolve();await Promise.all([pendingA,pendingB]);
assert.equal(replaced.cv.getStatus().running,true,'a newer B start must survive an older A load completing');
assert.equal(replaced.cv.getStatus().providerId,'gpu-webgl','camera replacement cannot force a CPU fallback');
assert.equal(replaced.calls.filter(call=>call==='start:gpu-webgl').length,2,'the new source starts the same selected GPU Worker');
assert.equal(replaced.calls.includes('adapter:cpu-wasm'),false,'source replacement cannot select a fresh CPU');
await replaced.cv.dispose();
globalThis.location=previousLocation;
console.log('actual graph define/default identity, candidate GPU-first startup-only fresh CPU fallback and source-A/B replacement passed');
