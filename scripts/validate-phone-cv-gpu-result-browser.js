#!/usr/bin/env node
// @ts-check
// Separate already-served after-result GPU experiment gate. Named visible states:
// loading (controls gated), GPU-ready, fresh CPU fallback-ready, warmup,
// recording, and invalid preview download. This gate is separate from npm test.
// Synthetic calibration/CSS dots are NOT real landmarks or phone throughput.
// rVFC presentedFrames/media times identify observed video-element presentations,
// NOT distinct sensor exposures; service getTimestampMs() is a clock, not frame ID.
// This browser check proves source callback + real Worker wiring, not the
// unchanged-ID rejection: the deterministic service unit owns that counterfactual.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const build=resolve(root,'dist-phone-cv-gpu-result-experiment');
const sidecarName='phone-cv-gpu-result-bundle-manifest.json';
const reportPurpose='camera_cv_gpu_after_result_experiment';
const scheduler=Object.freeze({mode:'after-result',targetFps:15});
const schedulerKeys=['mode','targetFps'];
const assertScheduler=(value,label)=>{keys(value,schedulerKeys,label);assert.deepEqual(value,scheduler,`${label}: exact after-result 15/s scheduler`);};
const raw=process.env.AEROBEAT_CV_GPU_RESULT_QA_URL;
assert(raw,'INVALID SETUP: AEROBEAT_CV_GPU_RESULT_QA_URL must name an already-served exact signed preview');
// Source gate only until the parent signs and serves the final artifact; NEVER
// invoke this script against an unsigned dev server or treat its preview as phone evidence.
const target=new URL(raw);
assert.equal(target.pathname,'/phone-cv-marker-baseline.html','INVALID SETUP: wrong experiment page');
assert(['http:','https:'].includes(target.protocol)&&!target.username&&!target.password&&target.search==='?preview=1'&&!target.hash,'INVALID SETUP: exact ?preview=1 route required');
assert(target.protocol==='https:'||(target.hostname==='127.0.0.1'&&target.port==='4197'),'INVALID SETUP: isolated local QA requires loopback4197; authorized remote must be HTTPS');
const forced=new URL(target);forced.search='?preview=1&forceGpuInitFail=1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const keys=(value,names,label)=>{assert(value&&typeof value==='object'&&!Array.isArray(value),`${label}: object`);assert.deepEqual(Object.keys(value).sort(),names.slice().sort(),`${label}: strict allowlist`);};
const bounded=(value,max,label)=>assert(Number.isSafeInteger(value)&&value>=0&&value<=max,`${label}: bounded integer`);
const scalar=(value,max,label)=>assert(value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max,`${label}: finite bounded number or null`);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const csp=response=>{const policy=response.headers.get('content-security-policy');assert(policy&&/(?:^|;)\s*connect-src\s+'self'\s*(?:;|$)/u.test(policy),`${response.url}: exact connect-src 'self' CSP required`);assert.equal(response.headers.get('referrer-policy'),'no-referrer',`${response.url}: no-referrer required`);return policy;};
const externalCspProbeUrl='https://example.invalid/aerobeat-csp-probe';
const manifestBytes=await readFile(resolve(build,sidecarName)).catch(cause=>{throw new Error('INVALID SETUP: local clean after-result GPU bundle sidecar unavailable',{cause});});
assert(manifestBytes.length>128&&manifestBytes.length<=128000,'INVALID SETUP: bounded local sidecar');
const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));
keys(manifest,['schema','version','purpose','scheduler','sourceManifest','buildStamp','assets'],'bundle');
assert.equal(manifest.schema,'aerobeat/private_phone_cv_gpu_result_bundle');assert.equal(manifest.version,1);assert.equal(manifest.purpose,reportPurpose);assertScheduler(manifest.scheduler,'bundle.scheduler');
const source=manifest.sourceManifest;
keys(source,['schema','version','packageVersion','sources'],'source');assert.equal(source.schema,'aerobeat/private_phone_cv_gpu_result_source_manifest');assert.equal(source.version,1);
assert(/^0\.0\.\d+$/u.test(source.packageVersion));assert.equal(Object.keys(source.sources).length,15);
assert(Object.hasOwn(source.sources,'@aerobeat/web-assembly'));
for(const [name,pin] of Object.entries(source.sources)){assert(/^@aerobeat\/web-[a-z-]+$/u.test(name));keys(pin,['commit','tree','sourceSha256'],name);assert(/^[a-f0-9]{40}$/u.test(pin.commit)&&/^[a-f0-9]{40}$/u.test(pin.tree)&&sha(pin.sourceSha256),`${name}: exact source pin`);}
assert.equal(manifest.buildStamp,`PHONE-CV-GPU-AFTER-RESULT-${source.packageVersion}-${hash(Buffer.from(JSON.stringify(source))).slice(0,24)}`);
assert(Array.isArray(manifest.assets)&&manifest.assets.length===12,'exact full GPU asset inventory');
const paths=manifest.assets.map(item=>item.path);assert.equal(new Set(paths).size,paths.length);
const workerPaths=paths.filter(path=>/^assets\/.*worker.*\.js$/iu.test(path));
assert(paths.includes('phone-cv-marker-baseline.html')&&workerPaths.length===1&&paths.some(path=>/^assets\/mediapipe\/.*\.task$/u.test(path))&&paths.some(path=>/^assets\/mediapipe\/wasm\/.*\.wasm$/u.test(path))&&paths.some(path=>/^assets\/.*\.js$/u.test(path)),'HTML/JS/exact dedicated Worker/WASM/model inventory');
assert(!paths.some(path=>/\.glb$|^assets\/(?:gameplay|environments|audio)\//iu.test(path)),'no scene models, game or audio assets');
async function inventory(directory,prefix=''){const entries=await readdir(directory,{withFileTypes:true});return (await Promise.all(entries.map(async entry=>{const path=prefix?`${prefix}/${entry.name}`:entry.name;assert(entry.isFile()||entry.isDirectory(),`INVALID SETUP: nonregular output ${path}`);return entry.isDirectory()?inventory(resolve(directory,entry.name),path):[path];}))).flat();}
assert.deepEqual((await inventory(build)).filter(path=>path!==sidecarName).sort(),paths.slice().sort(),'INVALID SETUP: sidecar includes every emitted file');
assert.deepEqual(paths.slice().sort(),paths,'INVALID SETUP: signer outputs sorted deterministic complete inventory');
const verified=new Map(),policies=new Map();
for(const item of manifest.assets){keys(item,['path','bytes','sha256'],'asset');assert(typeof item.path==='string'&&/^(?:phone-cv-marker-baseline\.html|favicon\.ico|assets\/[A-Za-z0-9._/-]+)$/u.test(item.path)&&!item.path.split('/').some(part=>!part||part==='.'||part==='..'),`safe path ${item.path}`);bounded(item.bytes,100_000_000,item.path);assert(item.bytes>0&&sha(item.sha256));const local=await readFile(resolve(build,item.path));assert.equal(local.length,item.bytes,`${item.path} local size`);assert.equal(hash(local),item.sha256,`${item.path} local hash`);const response=await fetch(new URL(`/${item.path}`,target),{cache:'no-store'});assert.equal(response.status,200,`${item.path} served response`);policies.set(item.path,csp(response));const remote=Buffer.from(await response.arrayBuffer());assert.equal(remote.length,item.bytes,`${item.path} served size`);assert.equal(hash(remote),item.sha256,`${item.path} served SHA-256`);verified.set(item.path,remote);}
const servedSidecar=await fetch(new URL(`/${sidecarName}`,target),{cache:'no-store'});assert.equal(servedSidecar.status,200,'served result GPU sidecar');csp(servedSidecar);assert.equal(hash(Buffer.from(await servedSidecar.arrayBuffer())),hash(manifestBytes),'served complete sidecar SHA-256');
assert.equal(policies.get(workerPaths[0]),policies.get('phone-cv-marker-baseline.html'),'actual dedicated Worker and document must carry the same connect-src self CSP');
const html=verified.get('phone-cv-marker-baseline.html').toString('utf8');assert(/GPU-first after-result \/ CPU fallback CV marker experiment/u.test(html),'built HTML declares after-result visible identity');assert(!/<aero-game\b|playcanvas/iu.test(html),'no game or PlayCanvas in HTML');assert(!html.includes('/src/phone-cv-marker-baseline.js')&&!html.includes('/src/phone-cv-gpu-experiment.js'),'built entry, not source');assert(paths.some(path=>path.endsWith('.js')&&html.includes(`/${path}`)),'hashed entry loaded');
assert([...verified].some(([path,bytes])=>path.endsWith('.js')&&bytes.includes(Buffer.from(reportPurpose))&&bytes.includes(Buffer.from('after-result'))),'built JS embeds distinct after-result report purpose and scheduler');
for(const [path,bytes] of verified)if(path.endsWith('.js'))assert(!/<aero-game\b|playcanvas|@aerobeat\/web-gameplay|@aerobeat\/web-audio/iu.test(bytes.toString('utf8')),`${path}: no game/PlayCanvas/audio chunk`);
assert([...verified].some(([path,bytes])=>path.endsWith('.js')&&bytes.includes(Buffer.from(manifest.buildStamp))),'source stamp in built entry');
console.log(`PASS GPU provenance: ${paths.length} complete local/served SHA-256 pairs, sidecar ${hash(manifestBytes)}`);

const stats=(value,label)=>{keys(value,['count','p50','p95'],label);bounded(value.count,2048,`${label}.count`);scalar(value.p50,120000,`${label}.p50`);scalar(value.p95,120000,`${label}.p95`);};
function validateReport(report,selected){
  keys(report,['schema','version','purpose','packageVersion','build','scheduler','delegate','valid','invalidReason','window'],'report');
  assert.equal(report.schema,'aerobeat/private_phone_cv_gpu_result_experiment_report');assert.equal(report.version,1);assert.equal(report.purpose,reportPurpose);assertScheduler(report.scheduler,'report.scheduler');assert.equal(report.packageVersion,source.packageVersion);
  assert.equal(report.valid,false,'outer QA preview always invalid as sustained phone evidence');assert.equal(report.invalidReason,'qa_preview_not_phone_evidence','preview invalidity takes precedence over fallback');
  keys(report.build,['stamp','bundleManifestSha256'],'build');assert.equal(report.build.stamp,manifest.buildStamp);assert.equal(report.build.bundleManifestSha256,hash(manifestBytes));
  keys(report.delegate,['requested','selected','fallback','fallbackReason'],'delegate');assert.equal(report.delegate.requested,'gpu-webgl');assert.equal(report.delegate.selected,selected);assert.equal(report.delegate.fallback,selected==='cpu-wasm');assert.equal(report.delegate.fallbackReason,selected==='cpu-wasm'?'gpu_init_failed':null);
  const w=report.window;keys(w,['schema','version','purpose','scheduler','valid','invalidReason','durationMs','counts','ratesFps','camera','inferenceMs','roundtripMs','displayWeightedPoseAgeMs'],'window');
  assert.equal(w.schema,'aerobeat/private_phone_cv_gpu_result_window');assert.equal(w.version,1);assert.equal(w.purpose,reportPurpose);assertScheduler(w.scheduler,'window.scheduler');assert.equal(w.valid,false,'checkerboard has no human landmarks; inner marker window must not pass');assert.equal(w.invalidReason,'no_valid_markers');
  scalar(w.durationMs,10000,'durationMs');assert(w.durationMs>=3500,'actual measured 4-second preview window');
  keys(w.counts,['cameraUniqueMediaFrames','cvSubmitted','cvPoses','cvBusyDrops','nativeFreshInput','freshValidMarkers','freshHeldMarkers','markerPresentationFrames'],'counts');
  for(const [name,value] of Object.entries(w.counts))bounded(value,10_000_000,`counts.${name}`);
  // Unique VIDEO-ELEMENT presentation times are not unique camera acquisitions;
  // submissions may still reuse a sensor image. No FPS/performance pass threshold.
  for(const name of ['cameraUniqueMediaFrames','cvSubmitted','cvPoses','nativeFreshInput','markerPresentationFrames'])assert(w.counts[name]>0,`INVALID SETUP: observed ${name} missing`);
  assert.equal(w.counts.freshValidMarkers,0,'checkerboard has zero valid measured wrists/nose');
  // Native frozen-anchor held counts can arise from the synthetic calibration fixture; they are NOT real human landmarks or visible dots.
  assert(w.counts.freshHeldMarkers<=w.counts.nativeFreshInput,'fixture-held native samples bounded by fresh input; not real human markers');
  keys(w.ratesFps,['denominatorMs','cameraUnique','cvSubmitted','cvPoses','nativeFreshInput','markerPresentation'],'rates');assert.equal(w.ratesFps.denominatorMs,w.durationMs);
  for(const [name,value] of Object.entries(w.ratesFps))scalar(value,name==='denominatorMs'?10000:100000,`rates.${name}`);
  keys(w.camera,['width','height','configuredFrameRateFps'],'camera');scalar(w.camera.width,16384,'camera.width');scalar(w.camera.height,16384,'camera.height');scalar(w.camera.configuredFrameRateFps,240,'configured FPS');
  for(const name of ['inferenceMs','roundtripMs','displayWeightedPoseAgeMs'])stats(w[name],name);
  assert(w.inferenceMs.count>0&&w.roundtripMs.count>0,'real selected Worker inference/roundtrip distributions');
}
const parent=createServer((_req,response)=>{response.writeHead(200,{'content-type':'text/html; charset=utf-8','referrer-policy':'strict-origin-when-cross-origin'});response.end(`<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}iframe{width:390px;height:844px;border:0}</style><iframe allow="camera; fullscreen; autoplay" src="${target.href}"></iframe>`);});
await new Promise(done=>parent.listen(0,'localhost',done));const address=parent.address();assert(address&&typeof address!=='string');const parentUrl=`http://localhost:${address.port}/`;assert.notEqual(new URL(parentUrl).origin,target.origin,'INVALID SETUP: parent must be genuinely cross-origin');
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  // Assert CSP on every actual served response (including Worker), and prove
  // document fetch rejection without contacting an external host. The real
  // vendor Worker exposes no QA fetch message; Playwright evaluates directly
  // inside the actual live dedicated Worker after GPU initialization.
  const probe=await browser.newContext({viewport:{width:390,height:844}}),blocked=[];
  const external=externalCspProbeUrl;
  try{
    await probe.route('**/aerobeat-csp-probe',route=>{blocked.push(route.request().url());return route.fulfill({status:204});});
    const page=await probe.newPage(),response=await page.goto(target.href,{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200,'probe document response');
    assert(/(?:^|;)\s*connect-src\s+'self'\s*(?:;|$)/u.test(response.headers()['content-security-policy']??''),'document CSP connect-src self');
    const result=await page.evaluate(external=>fetch(external,{mode:'cors'}).then(()=>false,()=>true),external);
    assert.equal(result,true,'document third-party fetch blocked by CSP');
    assert.deepEqual(blocked,[],'CSP-blocked request never reaches network interceptor');
  }finally{await probe.close();}
  const ordinary=await browser.newContext({viewport:{width:390,height:844}});
  try{const normal=await ordinary.newPage();const normalUrl=new URL(target);normalUrl.search='';const response=await normal.goto(normalUrl.href,{waitUntil:'domcontentloaded'});assert.equal(response?.status(),200,'INVALID SETUP: normal phone experiment unavailable');assert.equal(await normal.evaluate(()=>Object.hasOwn(window,'__aerobeatCvMarkerQa')),false,'normal nonpreview page exposes no QA calibration/overlay/delegate seam');assert.match(await normal.title(),/GPU-first.*after-result/iu,'normal page visibly names after-result mode');assert.match(await normal.locator('aside').innerText(),/after-result/iu,'normal page displays after-result label');assert.match(await normal.locator('aside').getAttribute('aria-label'),/after-result/iu,'normal page names accessible scheduler identity');assert.match(await normal.locator('#start').innerText(),/60 seconds/iu,'normal page retains 60-second measurement control');assert.equal(await normal.locator('#download').isHidden(),true,'normal download remains gated');}finally{await ordinary.close();}
  for(const embedding of ['direct','genuine_cross_origin_iframe'])for(const force of [false,true]){
    const label=`${embedding} ${force?'forced_init_failure':'GPU_first'}`,url=force?forced:target;
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,acceptDownloads:true});
    const page=await context.newPage(),errors=[],messages=[],events=[],networkEscapes=[];
    // Observe browser requests without modifying the product's network or Worker.
    context.on('request',request=>{const url=request.url();if(/^https?:/u.test(url)&&new URL(url).origin!==target.origin&&new URL(url).origin!==new URL(parentUrl).origin)networkEscapes.push(url);});
    page.on('pageerror',error=>errors.push(error.message));
    if(embedding==='direct'&&!force){await context.route('**/aerobeat-csp-probe',route=>{networkEscapes.push(route.request().url());return route.fulfill({status:204});});}
    await page.exposeBinding('__qaPublished',(_source,type,payload)=>(type==='message'?messages:events).push(payload));
    await page.addInitScript(()=>{window.addEventListener('message',event=>window.__qaPublished('message',JSON.stringify(event.data)));window.addEventListener('aero-game-event',event=>window.__qaPublished('event',JSON.stringify(event.detail)));});
    try{
      // The parent has no experiment API; it embeds the exact already-served child.
      const response=await page.goto(embedding==='direct'?url.href:parentUrl,{waitUntil:'domcontentloaded'});assert.equal(response?.status(),200);
      let frame=page;
      if(embedding!=='direct'){
        const owner=page.frameLocator('iframe').owner();await owner.waitFor({state:'attached',timeout:30000});
        assert.equal(await owner.getAttribute('src'),target.href,`${label}: exact already-served iframe URL`);
        // Force mode must be carried by the real child URL; the local parent
        // HTML starts at the ordinary URL, then navigates its iframe only.
        if(force)await owner.evaluate((element,href)=>{element.src=href;},url.href);
        await page.frameLocator('iframe').locator('#state').waitFor({timeout:30000});
        frame=page.frames().find(candidate=>candidate!==page.mainFrame()&&candidate.url()===url.href);
        assert(frame,`INVALID SETUP ${label}: exact served child frame missing`);
        assert.notEqual(new URL(frame.url()).origin,new URL(page.url()).origin,`${label}: genuinely cross-origin child`);
      }
      const status=frame.locator('#state'),start=frame.locator('#start'),download=frame.locator('#download');
      assert.match(await frame.locator('aside strong').innerText(),/GPU-first after-result CV experiment · no game/iu,`${label}: visible after-result label`);
      assert.match(await frame.locator('aside').getAttribute('aria-label'),/after-result/iu,`${label}: accessible after-result label`);
      assert.match(await start.innerText(),/Measure/iu,`${label}: measurement control named`);
      assert.equal(await frame.locator('aero-game').count(),0,'no game component');
      assert.match(await status.innerText(),/not ready|camera|loading|permission|T-pose|GPU|CPU/iu,`${label}: named loading state`);
      assert(await start.isDisabled()&&await download.isHidden(),`${label}: controls gated`);
      await frame.waitForFunction(()=>{const v=document.querySelector('#camera');return v?.srcObject?.getVideoTracks()[0]?.readyState==='live'&&v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0&&typeof v.requestVideoFrameCallback==='function';},null,{timeout:30000}).catch(cause=>{throw new Error(`INVALID SETUP ${label}: real fake-device camera not live`,{cause});});
      const capability=await frame.evaluate(()=>({webgl2:!!document.createElement('canvas').getContext('webgl2'),worker:typeof Worker==='function',videoFrame:typeof VideoFrame==='function'}));
      assert(capability.worker&&capability.videoFrame,`${label}: real transferable Worker path available`);
      const calibration=await frame.evaluate(async()=>{
        const qa=window.__aerobeatCvMarkerQa,input=qa?.getNativeInput?.(),wait=ms=>new Promise(done=>setTimeout(done,ms)),deadline=performance.now()+20000;
        if(!input||!qa?.getCvStatus||!qa?.getLatestPose||!qa?.getDelegate)throw Error('INVALID SETUP: preview-only native/Worker/delegate readback unavailable');
        let initial=null;
        while(performance.now()<deadline){const cv=qa.getCvStatus(),pose=qa.getLatestPose(),delegate=qa.getDelegate(),presentedFrameId=qa.getPresentedFrameId?.();if(cv?.running&&cv.lifecycleState==='running'&&cv.schedulingMode==='after-result'&&cv.poseFrameCount>0&&Number.isSafeInteger(presentedFrameId)&&presentedFrameId>0&&pose?.sourceId&&delegate?.actualDelegate&&delegate?.provider){initial={cv,pose,delegate,presentedFrameId};break;}await wait(40);}
        if(!initial)throw Error('real selected after-result Worker did not produce a frame');
        const video=document.querySelector('#camera'),identity=qa.getCameraIdentity?.();if(!identity||!(video.videoWidth>0&&video.videoHeight>0))throw Error('native camera identity/aspect unavailable');
        let clock=Math.max(performance.now(),(input.getSnapshot().tracking.timestampMs??0)+1),samples=0;
        while(performance.now()<deadline&&!input.getSnapshot().calibration.calibrationId){const cv=qa.getCvStatus(),delegate=qa.getDelegate();if(!cv?.running||cv.schedulingMode!=='after-result'||qa.getCameraIdentity()!==identity||qa.getLatestPose()?.sourceId!==initial.pose.sourceId||delegate?.actualDelegate!==initial.delegate.actualDelegate||delegate?.provider!==initial.delegate.provider)throw Error('CV/camera/delegate identity changed during native fixture');clock=Math.max(performance.now(),clock+1000/15,(input.getSnapshot().tracking.timestampMs??0)+1);const points={nose:{x:.5,y:.2},left_shoulder:{x:.35,y:.4},right_shoulder:{x:.65,y:.4},left_elbow:{x:.2,y:.4},right_elbow:{x:.8,y:.4},left_wrist:{x:.05,y:.4},right_wrist:{x:.95,y:.4},left_hip:{x:.43,y:.68},right_hip:{x:.57,y:.68}};const next=input.processPoseSample({sourceId:initial.pose.sourceId,timestampMs:clock,mirrored:initial.pose.mirrored,landmarks:Object.entries(points).map(([name,p])=>({name,...p,confidence:.99}))},{sourceAspectRatio:video.videoWidth/video.videoHeight,sourceChangeId:identity});samples++;if(next.tracking.timestampMs!==clock)throw Error('native input rejected synthetic T-pose fixture');await wait(30);}
        const snap=input.getSnapshot(),after=qa.getCvStatus();if(!snap.calibration.calibrationId||snap.calibration.readiness!=='countdown'||after.poseFrameCount<=initial.cv.poseFrameCount)throw Error('native T-pose calibration or concurrent real Worker missing');
        const presentedFrameId=qa.getPresentedFrameId();if(!Number.isSafeInteger(presentedFrameId)||presentedFrameId<=initial.presentedFrameId)throw Error('real video presentation identity did not advance');
        return {before:initial.cv.poseFrameCount,after:after.poseFrameCount,presentedBefore:initial.presentedFrameId,presentedAfter:presentedFrameId,samples,delegate:initial.delegate,status:{providerId:after.providerId,schedulingMode:after.schedulingMode,submitted:after.submittedFrameCount,poses:after.poseFrameCount},sourceId:initial.pose.sourceId,mirrored:initial.pose.mirrored};
      });
      const selected=calibration.delegate.selectedDelegate,provider=selected==='gpu-webgl'?'webgl':'wasm';
      assert(['gpu-webgl','cpu-wasm'].includes(selected),`${label}: selected delegate known`);
      assert.equal(calibration.delegate.actualDelegate,selected,`${label}: adapter actual delegate must agree with selected`);
      assert.equal(calibration.delegate.provider,provider,`${label}: actual Worker execution provider must agree with selected`);
      assert.equal(calibration.status.providerId,selected,`${label}: experimental service provider must agree with Worker execution telemetry`);
      assert.equal(calibration.status.schedulingMode,scheduler.mode,`${label}: live service reports after-result mode`);
      // The source's getTimestampMs() is performance.now(), not an identity
      // for unique presented or physically acquired camera frames.
      assert(calibration.status.poses>0,`${label}: actual Worker emitted moving pose-count telemetry`);
      assert.equal(calibration.mirrored,true,`${label}: real pose source mirrored`);
      assert(calibration.sourceId&&calibration.presentedBefore>0&&calibration.presentedAfter>calibration.presentedBefore&&calibration.after>calibration.before&&calibration.status.submitted>=calibration.status.poses,`${label}: real video presentations and Worker poses continue through synthetic-only native calibration`);
      if(force){assert.equal(selected,'cpu-wasm',`${label}: forced GPU init failure MUST select fresh real CPU Worker`);assert.equal(calibration.delegate.fallback,true);assert.equal(calibration.delegate.fallbackReason,'gpu_init_failed');}
      else{assert.equal(selected,'gpu-webgl',`${label}: GPU journey requires actual GPU/WebGL Worker, not a fallback masquerading as GPU proof`);assert(capability.webgl2,`${label}: GPU selected without browser WebGL2 capability`);assert.equal(calibration.delegate.fallback,false);assert.equal(calibration.delegate.fallbackReason,null);}
      const liveWorkers=page.workers();assert.equal(context.serviceWorkers().length,0,`${label}: no service worker may intercept`);
      assert.equal(liveWorkers.length,1,`${label}: exactly one live selected Worker (fresh CPU replaces failed GPU)`);
      assert.equal(new URL(liveWorkers[0].url()).origin,target.origin,`${label}: Worker served by experiment origin`);
      assert.equal(new URL(liveWorkers[0].url()).pathname,`/${workerPaths[0]}`,`${label}: Worker URL matches signed asset`);
      console.log(`${label}: WebGL2=${capability.webgl2}, selected=${selected}, adapterActual=${calibration.delegate.actualDelegate}, executionProvider=${calibration.delegate.provider}; video presentation IDs ${calibration.presentedBefore}→${calibration.presentedAfter}; Worker poses ${calibration.before}→${calibration.after}; synthetic native T-pose ONLY`);
      if(embedding==='direct'&&!force){
        const blocked=await liveWorkers[0].evaluate(url=>fetch(url,{mode:'cors'}).then(()=>false,()=>true),externalCspProbeUrl);
        assert.equal(blocked,true,`${label}: actual GPU Worker third-party fetch blocked under Worker CSP`);
        assert.deepEqual(networkEscapes,[],`${label}: probe did not reach network interception`);
      }
      await frame.waitForFunction(()=>document.querySelector('#start')?.disabled===false,null,{timeout:5000});assert.match(await status.innerText(),/ready/iu,`${label}: ${force?'CPU fallback-ready':'GPU-ready'} state`);assert.match(await status.innerText(),force?/CPU\/WASM fallback/iu:/GPU\/WebGL/iu,`${label}: visible actual delegate`);
      const overlay=await frame.evaluate(()=>{const qa=window.__aerobeatCvMarkerQa,before=qa.getCvStatus(),returned=qa.renderFixtureMarkers(),after=qa.getCvStatus(),video=document.querySelector('#camera'),stage=document.querySelector('#stage');return {returned,before:{submitted:before.submittedFrameCount,poses:before.poseFrameCount},after:{submitted:after.submittedFrameCount,poses:after.poseFrameCount},dots:[...document.querySelectorAll('.marker')].map(dot=>({role:dot.dataset.role,hidden:dot.hidden,left:dot.style.left,top:dot.style.top,display:getComputedStyle(dot).display})),stage:{width:stage.clientWidth,height:stage.clientHeight},video:{width:video.videoWidth,height:video.videoHeight,transform:getComputedStyle(video).transform,objectFit:getComputedStyle(video).objectFit}};});
      assert.equal(overlay.returned,true,`${label}: CSS fixture projection only`);assert.deepEqual(overlay.after,overlay.before,`${label}: CSS fixture cannot alter real Worker counts`);assert.equal(overlay.video.objectFit,'cover');assert.notEqual(overlay.video.transform,'none');assert.deepEqual(overlay.dots.map(dot=>dot.role).sort(),['left','nose','right']);const scale=Math.max(overlay.stage.width/overlay.video.width,overlay.stage.height/overlay.video.height);for(const dot of overlay.dots){assert.equal(dot.hidden,false,`${label} ${dot.role}: fixture dot visible`);assert.notEqual(dot.display,'none');const point={left:{x:.35,y:.48},right:{x:.65,y:.48},nose:{x:.5,y:.32}}[dot.role];const x=overlay.stage.width/2+(.5-point.x)*overlay.video.width*scale,y=overlay.stage.height/2+(point.y-.5)*overlay.video.height*scale;assert(Math.abs(Number.parseFloat(dot.left)-x)<.06&&Math.abs(Number.parseFloat(dot.top)-y)<.06,`${label} ${dot.role}: mirrored cover position`);}
      const geometry=()=>frame.evaluate(()=>{const stage=document.querySelector('#stage'),video=document.querySelector('#camera');return {stageWidth:stage.clientWidth,stageHeight:stage.clientHeight,viewportWidth:innerWidth,viewportHeight:innerHeight,dpr:devicePixelRatio,orientation:screen.orientation?.angle??0,videoWidth:video.videoWidth,videoHeight:video.videoHeight};});
      const before=await geometry();assert(before.stageWidth>0&&before.stageHeight>0&&before.videoWidth>0&&before.videoHeight>0);
      const stable=async name=>assert.deepEqual(await geometry(),before,`${label}: ${name} geometry stability`);
      const box=await start.boundingBox();assert(box&&box.width>=44&&box.height>=44,`${label}: start touch target`);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
      await frame.waitForFunction(()=>/warmup/iu.test(document.querySelector('#state')?.textContent??''),null,{timeout:3000});assert.match(await status.innerText(),/QA warmup.*not sustained phone evidence/iu,`${label}: preview warmup labeled`);await stable('warmup');
      await frame.waitForFunction(()=>/recording markers/iu.test(document.querySelector('#state')?.textContent??''),null,{timeout:4000});await stable('measurement');assert(await start.isDisabled()&&await download.isHidden(),`${label}: recording controls gated`);
      await frame.waitForFunction(()=>!document.querySelector('#download')?.hidden,null,{timeout:7000});await stable('download');assert.match(await status.innerText(),/invalid.*qa_preview_not_phone_evidence/iu,`${label}: visible invalid-preview result`);assert.match(await download.innerText(),/Download.*JSON/iu,`${label}: accessible JSON download label`);
      const downloadBox=await download.boundingBox();assert(downloadBox&&downloadBox.width>=44&&downloadBox.height>=44&&downloadBox.x>=0&&downloadBox.y>=0&&downloadBox.x+downloadBox.width<=390&&downloadBox.y+downloadBox.height<=844,`${label}: accessible touch download`);
      const transfer=page.waitForEvent('download',{timeout:15000});await page.touchscreen.tap(downloadBox.x+downloadBox.width/2,downloadBox.y+downloadBox.height/2);const file=await transfer;assert.equal(file.suggestedFilename(),'aerobeat-camera-cv-gpu-after-result-v1.json');
      const bytes=await readFile(await file.path());assert(bytes.length>100&&bytes.length<=16384);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),report=JSON.parse(text);validateReport(report,selected);
      assert(!/(?:(?:"(?:landmarks|coordinates|poseX|deviceId|deviceLabel|audioBytes|songName|songId|chartId|sessionId|calibrationId|sourceId|eventId|frameBytes|videoFrame|screenshot|mediaTime|presentedFrames|rawFrames|perFrame|timestampMs)"))/iu.test(text),`${label}: aggregate-only report`);
      assert.deepEqual(messages,[],`${label}: no public/cross-origin messages`);assert.deepEqual(events,[],`${label}: no public game events`);assert.deepEqual(networkEscapes,[],`${label}: no document/Worker third-party network request`);assert.equal(errors.length,0,`${label}: browser errors ${JSON.stringify(errors)}`);
      console.log(`PASS ${label}: selected real ${selected} Worker; inner no_valid_markers; outer preview invalid; no public messages`);
    }finally{await context.close();}
  }
}finally{await browser?.close();await new Promise(done=>parent.close(done));}
