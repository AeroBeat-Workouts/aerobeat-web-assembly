// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { mediaPipeDefaultModelSha256, mediaPipeDefaultModelSizeBytes } from '@aerobeat/web-vendor-mediapipe';
import { createPrivateBeatSaverFetch, requirePrivateBeatSaverUrl } from '../src/private-beatsaver-access.js';

// Execute the actual source factories under a simulated Vite define, not a duplicate implementation.
const source = readFileSync(new URL('../src/service-graph.js', import.meta.url), 'utf8');
const declarations = source.replace(/^import .*;\n/gmu, '').replace(/^export \{ lockedProductionCvProfile \};\n/mu, '').replaceAll('export function ', 'function ');
function graph(flag, origin = 'https://friend.example') {
  const adapters = [], cvServices = [], vendors = [];
  const constructors = {
    createAeroWebContentAuthoringService: () => ({loadPackage(){}, readAsset(){}, exportPackage(){}}),
    createAeroContentRuntime: () => ({}), createBrowserVideoMediaFacade: () => ({}),
    createAeroWebAudioService: () => ({}), createPrivateGameplayCvService: () => {throw Error('GPU variant selected');},
    createLockedProductionCvService: options => {cvServices.push(options);return {};},
    createMediaPipeWorkerPoseAdapter: options => {adapters.push(options);return {};},
    createAeroBeatSaverVendorService: options => {vendors.push(options);return {};},
    createPrivateBeatSaverFetch, createAeroBodyGridService: () => ({}),
    createAeroPrototypeProfileRegistry: () => ({}), createAeroGameplaySessionCoordinator: () => ({}),
    createAeroPlayCanvasRenderer: () => ({}), mediaPipeLiveSourceId: 'aero.mediapipe.live',
    mediaPipeDelegates: {cpuWasm:'cpu-wasm'}, mediaPipeDefaultModelSha256, mediaPipeDefaultModelSizeBytes,
    lockedProductionCvProfile: {minPoseDetectionConfidence:.4,minPosePresenceConfidence:.5,minTrackingConfidence:.3},
    URL, URLSearchParams, globalThis: {location: {origin,pathname:'/',search:''},fetch:async () => new Response('{}')}
  };
  const context = vm.createContext({...constructors,...(flag === undefined ? {} : {__AEROBEAT_PUBLIC_FRIEND_GAME__:flag})});
  const factory = vm.runInContext(`${declarations}\ncreateAeroGameServiceGraph`,context);
  factory();
  return {adapter:adapters[0],cv:cvServices[0],vendor:vendors[0]};
}
const origin = 'https://friend.example';
const publicGame = graph(true);
assert.equal(publicGame.adapter.delegate,'cpu-wasm');
assert.equal(publicGame.cv.submissionCadenceTargetFps,15,'keep production fixed scheduling');
assert.equal(publicGame.adapter.modelUrl,`${origin}/assets/mediapipe/pose_landmarker_lite.task`);
assert.equal(publicGame.adapter.modelSha256,mediaPipeDefaultModelSha256);
assert.equal(publicGame.adapter.modelSizeBytes,mediaPipeDefaultModelSizeBytes);
assert.equal(publicGame.adapter.streamModelDownload,true,'only public game opts into the verified model stream');
assert.equal(publicGame.adapter.wasmRootUrl,`${origin}/assets/mediapipe/wasm`);
assert.equal(publicGame.adapter.tasksVisionScriptUrl,`${origin}/assets/mediapipe/vision_bundle.js`);
assert.equal(typeof publicGame.vendor.fetch,'function');
for (const disabled of [undefined,false,'true',1]) {
  const normal=graph(disabled);
  assert.equal(normal.adapter.modelUrl,undefined,'default graph must retain vendor model URL');
  assert.equal(normal.adapter.streamModelDownload,undefined,'private/default graph must not opt into streaming');
  assert.equal(normal.adapter.wasmRootUrl,undefined,'default graph must retain vendor WASM URL');
  assert.equal(normal.adapter.tasksVisionScriptUrl,undefined,'default graph must retain vendor vision URL');
  assert.equal(normal.vendor,undefined,'default graph must retain unmodified vendor construction');
  assert.equal(normal.cv.submissionCadenceTargetFps,15);
}
for (const invalidOrigin of ['null','file://','https://user@example.com','https://friend.example/path','https://friend.example/','http://'])
  assert.throws(() => graph(true,invalidOrigin),/requires a browser origin/u,`invalid origin: ${invalidOrigin}`);
const hash = 'a'.repeat(40);
const api = 'https://api.beatsaver.com/search/text/0?q=friend';
const zip = `https://r2cdn.beatsaver.com/${hash}.zip`;
const preview = `https://cfcdn.beatsaver.com/${hash}.mp3`;
for (const url of [api,zip]) assert.equal(requirePrivateBeatSaverUrl(url).href,url);
assert.equal(requirePrivateBeatSaverUrl(preview,'preview').href,preview);
for (const url of [preview,'https://evil.example/song.zip',`https://r2cdn.beatsaver.com/${hash}.zip?evil=1`])
  assert.throws(() => requirePrivateBeatSaverUrl(url),/import it locally/u);
for (const url of [api,zip,'https://evil.example/song.mp3'])
  assert.throws(() => requirePrivateBeatSaverUrl(url,'preview'),/import it locally/u);
const calls=[];
const guarded=createPrivateBeatSaverFetch(async (url,init)=>{calls.push({url:url.href,init});return new Response('{}');});
const signal=new AbortController().signal;
await guarded(api,{method:'POST',credentials:'include',redirect:'follow',referrerPolicy:'unsafe-url',signal});
assert.equal(calls[0].url,api);
assert.equal(calls[0].init.method,'GET');
assert.equal(calls[0].init.credentials,'omit');
assert.equal(calls[0].init.redirect,'error');
assert.equal(calls[0].init.referrerPolicy,'no-referrer');
assert.equal(calls[0].init.signal,signal);
await assert.rejects(()=>guarded('https://evil.example/song.zip'),/import it locally/u);
assert.equal(calls.length,1,'blocked URLs never reach fetch');
const index = readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
assert.match(index,/if \(privateBeatSaverAccess \|\| publicFriendGame\) url = requirePrivateBeatSaverUrl\(url, "preview"\);\s*await this\.startPreview\(url\.href/u);
const pendingSource = index.match(/function publicFriendPendingStatus\([^]*?\n\}\nfunction runtimeStatus/u)?.[0];
assert.ok(pendingSource, 'execute the actual public pending-status decision');
const pendingStatus = vm.runInNewContext(`${pendingSource.replace(/\nfunction runtimeStatus$/u,'')}\npublicFriendPendingStatus`);
assert.equal(pendingStatus('start',1,1,0,1),'Preparing Play: starting camera and loading pose assets…');
assert.equal(pendingStatus('test',2,2,1,2),'Test queued after Play initialization…');
assert.equal(pendingStatus('test',2,2,2,2),'Preparing Test…');
assert.equal(pendingStatus('test',2,2,0,2),'Preparing Test…');
assert.equal(pendingStatus('test',0,2,1,2),'','cleared action must not retain copy');
assert.equal(pendingStatus('test',1,2,1,2),'','superseded action must not retain copy');
assert.match(index,/return this\.menuOpen && this\.menuStarting && !this\.lastError\s*\? publicFriendPendingStatus\(/u,'only the visible menu uses pending copy while errors win');
assert.match(index,/const signature = JSON\.stringify\(\[runtimeMessage, pendingMessage, modelDownloadPercent,[\s\S]*?if \(publicFriendGame\) setPresenter\(this, "aero-session-actions", this\.sessionActionsSnapshot\(modelDownloadProgress\)\)/u,'real model byte percentage must invalidate the runtime signature and repaint the action presenter');
assert.match(index,/sessionActionsSnapshot\(modelDownloadProgress = this\.foregroundModelDownloadProgress\(\)\) \{[\s\S]*?typeof __AEROBEAT_PUBLIC_FRIEND_GAME__ !== "undefined" && __AEROBEAT_PUBLIC_FRIEND_GAME__ === true\s*\? \{ \.\.\.actions, pendingStatus: this\.publicFriendPendingMessage\(\), \.\.\.\(modelDownloadProgress \? \{ modelDownloadProgress \} : \{\}\) \} : actions/u,'only exact public flag adds optional progress to action snapshot');
const uiSource = readFileSync(new URL('../../aerobeat-web-ui/src/elements/aero-product-presenters.js',import.meta.url),'utf8');
assert.match(uiSource,/const pendingStatus = readString\(this\.presenterSnapshot, "pendingStatus", ""\);[\s\S]*?const pendingLabel = measured[\s\S]*?: pendingStatus \? `<p part="pending-status"[^`]*?\$\{escapeHtml\(pendingStatus\)\}<\/p>` : "";/u,'optional measured bar retains escaped pending copy in indeterminate states');
assert.match(uiSource,/Test<\/button><\/div>\$\{pendingLabel\}\$\{playable \?/u,'private/default markup has no extra node without pendingStatus');
assert.match(index,/this\.pendingSessionAction = action; this\.menuStarting = true;[^\n]*this\.renderPresenters\(\)/u,'each pending click synchronously renders without a CV subscription');
const sessionStart = index.match(/async startSession\(purpose, options = \{\}\) \{[\s\S]*?\n  \}\n\n  \/\*\* Await the initial action-owned audio/u)?.[0];
assert.ok(sessionStart, 'inspect actual action acceptance and lifecycle enqueue boundary');
assert.match(sessionStart,/this\.renderPresenters\(\);[\s\S]*?const intent = this\.enqueueLifecycleIntent\(`session-\$\{action\}`,[\s\S]*?if \(action === "test" && typeof __AEROBEAT_PUBLIC_FRIEND_GAME__ !== "undefined" && __AEROBEAT_PUBLIC_FRIEND_GAME__ === true\) this\.renderRuntimePresentation\(\);\s*return intent;/u,'public Test must repaint AFTER enqueue increments generation; pre-enqueue and owner-activation renders alone miss queued state');
assert.match(index,/this\.lifecycleIntentActiveGeneration = generation;[\s\S]*?kind === "session-test"[^\n]*this\.pendingSessionAction === "test"\) this\.renderRuntimePresentation\(\)/u,'queued Test owner activation visibly changes status without a CV subscription');
console.log('public friend flag: local CPU graph, strict access and visible pending Play/queued Test status passed');
