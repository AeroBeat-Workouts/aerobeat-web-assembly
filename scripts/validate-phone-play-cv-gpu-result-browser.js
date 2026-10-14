// @ts-check
// Independent, preview-dependent QA. No fixture may replace CV, scoring, camera,
// the authoring Worker, or production calibration. Synthetic Chromium rates are
// not physical-phone performance. A failed setup is INVALID, never a green test.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const build = resolve(root, "dist-phone-play-cv-gpu-result");
const sidecarName = "phone-play-cv-gpu-result-bundle-manifest.json";
const rawUrl = process.env.AEROBEAT_PLAY_CV_GPU_RESULT_QA_URL;
assert(rawUrl, "INVALID SETUP: AEROBEAT_PLAY_CV_GPU_RESULT_QA_URL must name an already-served distinct private build");
const target = new URL(rawUrl);
assert.equal(target.pathname, "/phone-play-cv-test.html", "INVALID SETUP: wrong private diagnostic page");
assert(["http:", "https:"].includes(target.protocol) && !target.username && !target.password && (target.search === "" || target.search === "?preview=1") && !target.hash, "INVALID SETUP: exact private page URL or ?preview=1 QA route required");
assert.equal(target.search, "?preview=1", "INVALID SETUP: short browser journey requires ?preview=1; default 60s is physical-only");
assert(target.protocol === "https:" || target.hostname === "127.0.0.1" && target.port === "4198", "INVALID SETUP: signed QA requires private HTTPS or isolated loopback4198");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const keys = (object, expected, label) => { assert(object && typeof object === "object" && !Array.isArray(object), `${label}: object`); assert.deepEqual(Object.keys(object).sort(), expected.slice().sort(), `${label}: exact allowlist`); };
const count = (value, max, label) => assert(Number.isSafeInteger(value) && value >= 0 && value <= max, `${label}: bounded count`);
const scalar = (value, max, label) => assert(value === null || typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max, `${label}: finite bounded scalar or null`);
const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const source = value => {
  keys(value, ["schema", "version", "packageVersion", "sources"], "source manifest");
  assert.equal(value.schema, "aerobeat/private_phone_play_cv_gpu_result_source_manifest"); assert.equal(value.version, 1);
  assert(/^0\.0\.\d+$/u.test(value.packageVersion));
  assert.equal(Object.keys(value.sources).length, 15, "assembly plus fourteen linked repositories");
  assert(Object.hasOwn(value.sources, "@aerobeat/web-assembly"));
  for (const [name, pin] of Object.entries(value.sources)) {
    assert(/^@aerobeat\/web-[a-z-]+$/u.test(name)); keys(pin, ["commit", "tree", "sourceSha256"], name);
    assert(/^[a-f0-9]{40}$/u.test(pin.commit) && /^[a-f0-9]{40}$/u.test(pin.tree) && hex(pin.sourceSha256), `${name}: pinned Git/source identity`);
  }
};
const manifestBytes = await readFile(resolve(build, sidecarName)).catch(cause => { throw new Error("INVALID SETUP: clean signed candidate output unavailable", {cause}); });
assert(manifestBytes.byteLength > 128 && manifestBytes.byteLength <= 128000, "bounded local manifest");
const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
keys(manifest, ["schema", "version", "purpose", "scheduler", "requestedDelegate", "fallback", "sourceManifest", "buildStamp", "assets"], "bundle manifest");
assert.equal(manifest.purpose, "full_game_play_gpu_after_result_candidate"); assert.deepEqual(manifest.scheduler, {mode:"after-result",targetFps:15});
assert.equal(manifest.requestedDelegate,"gpu-webgl"); assert.equal(manifest.fallback,"fresh_cpu_wasm_only_on_initialization_failure");
assert.equal(manifest.schema, "aerobeat/private_phone_play_cv_gpu_result_bundle"); assert.equal(manifest.version, 1); source(manifest.sourceManifest);
assert.equal(manifest.buildStamp, `PHONE-PLAY-CV-GPU-AFTER-RESULT-${manifest.sourceManifest.packageVersion}-${digest(Buffer.from(JSON.stringify(manifest.sourceManifest))).slice(0, 24)}`);
assert(Array.isArray(manifest.assets) && manifest.assets.length > 20 && manifest.assets.length <= 150, "complete bounded bundle inventory");
const paths = manifest.assets.map(entry => entry.path);
assert.equal(new Set(paths).size, paths.length, "no duplicate paths");
assert(paths.includes("index.html") && paths.includes("phone-play-cv-test.html") && paths.some(path => /^assets\/.*worker.*\.js$/iu.test(path)) && paths.some(path => /^assets\/mediapipe\/.*\.task$/u.test(path)) && paths.some(path => /^assets\/mediapipe\/wasm\/.*\.wasm$/u.test(path)), "HTML, Worker, MediaPipe model and WASM inventory");
assert.equal(paths.filter(path => /^assets\/gameplay\/0\.0\.11\/.*\.glb$/u.test(path)).length, 9, "nine real gameplay models");
assert(paths.some(path => /^assets\/.*-[A-Za-z0-9_-]+\.js$/u.test(path)), "built JS entry");
async function inventory(directory,prefix="") {
  const entries=await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.map(async entry=>{
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;
    assert(entry.isFile() || entry.isDirectory(),`INVALID SETUP: nonregular output ${relative}`);
    return entry.isDirectory()?inventory(resolve(directory,entry.name),relative):[relative];
  }))).flat();
}
assert.deepEqual((await inventory(build)).filter(name=>name!==sidecarName).sort(),paths.slice().sort(),"INVALID SETUP: complete signed asset inventory");
assert.deepEqual(paths,paths.slice().sort(),"INVALID SETUP: signer emits deterministic sorted inventory");
const checkedPaths = new Map();
const policy = response => {
  const csp = response.headers.get("content-security-policy");
  assert(csp && /(?:^|;)\s*connect-src\s+'self'\s*(?:;|$)/u.test(csp), `${response.url}: connect-src self CSP`);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer", `${response.url}: private no-referrer`);
  return csp;
};
const policies = new Map();
for (const entry of manifest.assets) {
  keys(entry, ["path", "bytes", "sha256"], "asset entry");
  assert(typeof entry.path === "string" && /^(?:index\.html|phone-play-cv-test\.html|favicon\.ico|assets\/[A-Za-z0-9._/-]+)$/u.test(entry.path) && !entry.path.split("/").some(part => !part || part === "." || part === ".."), "safe relative asset path");
  count(entry.bytes, 100_000_000, entry.path); assert(entry.bytes > 0 && hex(entry.sha256));
  const disk = await readFile(resolve(build, entry.path));
  assert.equal(disk.byteLength, entry.bytes, `${entry.path}: local bytes`);
  assert.equal(digest(disk), entry.sha256, `${entry.path}: local SHA-256`);
  const response = await fetch(new URL(`/${entry.path}`, target), { cache: "no-store" });
  assert.equal(response.status, 200, `${entry.path}: served status`);
   policies.set(entry.path, policy(response));
  const served = Buffer.from(await response.arrayBuffer());
  assert.equal(served.byteLength, entry.bytes, `${entry.path}: served bytes`);
  assert.equal(digest(served), entry.sha256, `${entry.path}: served SHA-256`);
  checkedPaths.set(entry.path, served);
}
const servedManifest = await fetch(new URL("/phone-play-cv-gpu-result-bundle-manifest.json", target), { cache: "no-store" });
assert.equal(servedManifest.status, 200); policy(servedManifest);
assert.equal(digest(Buffer.from(await servedManifest.arrayBuffer())), digest(manifestBytes), "exact served sidecar parity");
const workerPaths = paths.filter(path => /^assets\/.*worker.*\.js$/iu.test(path));
assert(workerPaths.length >= 1, "signed dedicated Worker must exist");
for (const workerPath of workerPaths) assert.equal(policies.get(workerPath), policies.get("phone-play-cv-test.html"), `Worker ${workerPath} and document enforce the same CSP`);
for (const pagePath of ["index.html","phone-play-cv-test.html"]) {
  const pageHtml = checkedPaths.get(pagePath).toString("utf8");
  assert.match(pageHtml, /<aero-game\b/u, `${pagePath}: actual full game`);
  assert(!pageHtml.includes("/src/index.js") && !pageHtml.includes("/src/phone-play-cv-diagnostic.js"), `${pagePath}: no dev entry`);
  assert(manifest.assets.some(entry => entry.path.endsWith(".js") && pageHtml.includes(`/${entry.path}`)), `${pagePath}: hashed JS entry`);
}
const html = checkedPaths.get("phone-play-cv-test.html").toString("utf8");
assert.match(html, /<aero-game\b/u);
assert(!html.includes("/src/phone-play-cv-diagnostic.js"), "served entry is built, not dev source");
assert(manifest.assets.some(entry => entry.path.endsWith(".js") && html.includes(`/${entry.path}`)), "HTML references hashed JavaScript");
assert([...checkedPaths].some(([path, bytes]) => path.endsWith(".js") && bytes.includes(Buffer.from(manifest.buildStamp))), "source-pinned stamp embedded in JS");
console.log(`PASS candidate provenance: ${manifest.assets.length} exact local/served asset hashes, sidecar SHA-256 ${digest(manifestBytes)}, stamp ${manifest.buildStamp}`);

const chart = new TextEncoder().encode(JSON.stringify({ _version:"2.0.0", _events:[], _notes:[{_time:6,_lineIndex:1,_lineLayer:1,_type:0,_cutDirection:8},{_time:10,_lineIndex:2,_lineLayer:1,_type:1,_cutDirection:8}], _obstacles:[] }));
const fixtureSha256 = digest(chart);
const validateStats = (value, label) => { keys(value, ["count", "p50", "p95"], label); count(value.count, 2048, `${label}.count`); scalar(value.p50, 120000, `${label}.p50`); scalar(value.p95, 120000, `${label}.p95`); };
const validateReport = (report, expectedDelegate) => {
  keys(report, ["schema", "version", "purpose", "packageVersion", "build", "scheduler", "delegate", "valid", "invalidReason", "window"], "download");
   assert.deepEqual(report.scheduler, {mode:"after-result",targetFps:15});
   keys(report.delegate,["requested","selected","executionLocation","fallback"],"actual Worker delegate");
   assert.equal(report.delegate.requested,"gpu-webgl");
   assert.equal(report.delegate.executionLocation,"worker");
   assert.equal(report.delegate.selected, expectedDelegate);
   assert.equal(report.delegate.fallback, expectedDelegate === "gpu-webgl" ? "none" : "fresh_cpu_wasm_initialization_fallback");
  assert.equal(report.schema, "aerobeat/private_phone_play_cv_gpu_result_report"); assert.equal(report.version, 1); assert.equal(report.purpose, "full_game_play_gpu_after_result_candidate");
  assert.equal(report.packageVersion, manifest.sourceManifest.packageVersion);
  assert.equal(report.valid, false, "QA preview report is never phone evidence");
  assert.equal(report.invalidReason, "qa_preview_not_phone_evidence");
  keys(report.build, ["stamp", "bundleManifestSha256"], "build");
  assert.equal(report.build.stamp, manifest.buildStamp); assert.equal(report.build.bundleManifestSha256, digest(manifestBytes));
  const w = report.window;
  keys(w, ["schema", "version", "purpose", "valid", "invalidReason", "durationMs", "counts", "ratesFps", "camera", "inferenceMs", "endToEndMs", "poseAgeMs", "sceneIntervalMs"], "window");
  assert.equal(w.schema, "aerobeat/private_phone_play_cv_window"); assert.equal(w.version, 1); assert.equal(w.purpose, "play");
  assert.equal(typeof w.valid, "boolean");
  assert(w.invalidReason === null || ["not_started", "hidden", "session_changed", "not_playing", "cv_lost", "camera_lost", "geometry_changed", "counter_reset", "no_poses", "no_camera_frames", "callback_unavailable", "disposed"].includes(w.invalidReason));
  assert.equal(w.valid, w.invalidReason === null);
  scalar(w.durationMs, 60000, "durationMs");
  keys(w.counts, ["cameraUniqueMediaFrames", "cvSubmitted", "cvPoses", "cvBusyDrops", "freshPoseConsumptions", "inputAdvances", "sceneFrames", "freshProcessedEquipment", "freshValidEquipmentPairs", "freshHeldEquipmentPairs"], "counts");
  for (const [name, value] of Object.entries(w.counts)) { scalar(value, 10000000, `counts.${name}`); if (value !== null) count(value, 10000000, name); }
  keys(w.ratesFps, ["denominatorMs", "cameraUnique", "cvSubmitted", "cvPoses", "freshPoseConsumption", "scene"], "rates");
  assert.equal(w.ratesFps.denominatorMs, w.durationMs);
  for (const [name, value] of Object.entries(w.ratesFps)) scalar(value, name === "denominatorMs" ? 60000 : 100000, `rates.${name}`);
  keys(w.camera, ["width", "height", "configuredFrameRateFps"], "camera");
  scalar(w.camera.width, 16384, "camera.width"); scalar(w.camera.height, 16384, "camera.height"); scalar(w.camera.configuredFrameRateFps, 240, "configured camera FPS (not measured)");
  for (const name of ["inferenceMs", "endToEndMs", "poseAgeMs", "sceneIntervalMs"]) validateStats(w[name], name);
  assert(w.counts.freshValidEquipmentPairs === null || w.counts.freshProcessedEquipment === null || w.counts.freshValidEquipmentPairs <= w.counts.freshProcessedEquipment);
  assert(w.counts.freshHeldEquipmentPairs === null || w.counts.freshValidEquipmentPairs === null || w.counts.freshHeldEquipmentPairs <= w.counts.freshValidEquipmentPairs);
};
// The ordinary full-game route has no QA fallback seam, even with a query
// string; only the separately labeled diagnostic preview may force GPU failure.
async function checkNormalPage(browser) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try {
    const page=await context.newPage(),normal=new URL("/index.html?preview=1&forceGpuInitFail=1",target);
    const response=await page.goto(normal.href,{waitUntil:"domcontentloaded"});
    assert.equal(response?.status(),200,"normal full game served");
    assert.equal(await page.locator("aero-game").count(),1,"normal page is real full game");
    const identity=await page.locator("aero-game").evaluate(element=>({cv:element.graph?.cv?.getStatus?.(),snapshot:element.getSnapshot()}));
    const cv=identity.cv, profile=identity.snapshot.cvProfile;
    assert.equal(cv?.schedulingMode,"after-result","candidate graph, not old CPU build");
    assert.equal(cv?.fallback,false,"ordinary page query cannot force fallback");
    assert.equal(cv?.providerId,null,"ordinary page has not initialized a fake CPU Worker");
    assert.equal(profile?.requestedProviderId,"gpu-webgl","candidate snapshot labels requested GPU separately");
    assert.equal(profile?.schedulingMode,"after-result","candidate snapshot labels scheduler");
    assert.equal(profile?.providerId,null,"candidate snapshot must not claim GPU before Worker selection");
    assert.equal(identity.snapshot.services?.cv?.providerId,null,"public service status must not claim GPU before Worker selection");
    assert.equal(await page.locator("#play-cv-start").count(),0,"normal page has no diagnostic recorder");
    assert.equal(await page.evaluate(()=>Object.hasOwn(window,"__aerobeatCvMarkerQa")),false,"normal page has no marker QA seam");
    console.log("PASS normal index.html: candidate graph without preview-only fallback or recorder seam");
  } finally { await context.close(); }
}
// The alternate parent is the hostname localhost; child URL must retain the
// independently served build origin (127.0.0.1 or private HTTPS).
const parent = createServer((_request, response) => { response.writeHead(200, { "content-type":"text/html; charset=utf-8", "referrer-policy":"strict-origin-when-cross-origin" }); response.end(`<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}iframe{border:0;width:390px;height:844px}</style><iframe allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${target.href}"></iframe>`); });
await new Promise(done => parent.listen(0, "localhost", done));
const address = parent.address(); assert(address && typeof address !== "string");
const parentUrl = `http://localhost:${address.port}/`;
assert.notEqual(new URL(parentUrl).origin, target.origin, "INVALID SETUP: iframe parent must be cross-origin");
let browser;
try {
  browser = await chromium.launch({ headless:true, args:["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  await checkNormalPage(browser);
  for (const embedding of ["direct", "genuine_cross_origin_iframe"]) for (const force of [false, true]) {
    const journey = `${embedding} ${force ? "forced_fresh_CPU" : "GPU_first"}`;
    const child = new URL(target); if (force) child.search = "?preview=1&forceGpuInitFail=1";
    const context = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, hasTouch:true, acceptDownloads:true });
    const page = await context.newPage(), errors = [], publicMessages = [], publicEvents = [], networkEscapes = [];
     context.on("request", request => { const url = request.url(); if (/^https?:/u.test(url) && ![target.origin,new URL(parentUrl).origin].includes(new URL(url).origin)) networkEscapes.push(url); });
     if (embedding === "direct") await context.route("**/aerobeat-csp-probe", route => { networkEscapes.push(route.request().url()); return route.fulfill({status:204}); });
    // Match the prior private full-game browser oracle's pageerror boundary;
    // do not collect only console errors and silently miss other diagnostics.
    page.on("pageerror", error => errors.push(error.message));
    await page.exposeBinding("__qaCapturePublic", (_source, kind, payload) => { (kind === "message" ? publicMessages : publicEvents).push(payload); });
    await page.addInitScript(() => {
      window.addEventListener("message", event => { if (event.data?.schema === "aerobeat/iframe_message") window.__qaCapturePublic("message", JSON.stringify(event.data)); });
      window.addEventListener("aero-game-event", event => window.__qaCapturePublic("event", JSON.stringify(event.detail)));
    });
    try {
      const response = await page.goto(embedding === "direct" ? child.href : parentUrl, { waitUntil:"domcontentloaded" }); assert.equal(response?.status(), 200);
      if(embedding!=="direct") await page.waitForFunction(origin=>[...document.querySelectorAll("iframe")].some(node=>{try{return new URL(node.src).origin===origin&&node.contentWindow!==null}catch{return false}}),target.origin,{timeout:15000}).catch(cause=>{throw new Error(`INVALID SETUP ${embedding}: private iframe missing`,{cause});});
      if(embedding!=="direct") {
         const owner = page.frameLocator("iframe").owner();
         if (force) await owner.evaluate((element, href) => { element.src = href; }, child.href);
         await page.frameLocator("iframe").locator("aero-game").waitFor({timeout:30000});
       }
      const frame = embedding === "direct" ? page : page.frames().find(candidate => candidate !== page.mainFrame() && candidate.url().startsWith(target.origin));
      assert(frame && frame.url() === child.href, `${journey}: exact signed child loaded`);
      if (embedding !== "direct") assert.notEqual(new URL(frame.url()).origin, new URL(page.url()).origin);
      const game = frame.locator("aero-game");
       assert.equal(context.serviceWorkers().length,0,`${journey}: no service worker interception`);
      const status = frame.locator("#play-cv-state"), start = frame.locator("#play-cv-start"), download = frame.locator("#play-cv-download");
      await frame.waitForFunction(() => document.querySelector("aero-game")?.graph?.authoring?.getCapabilities?.().conversionWorker === true, null, { timeout:30000 });
      await frame.waitForFunction(() => document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state === "ready", null, { timeout:30000 });
      assert.match(await status.innerText(), /Load a chart|Checking private build identity/u, `${journey}: named not-ready state`);
       assert.match(await frame.locator("#play-cv-recorder strong").innerText(), /full-game GPU-first after-result \/ fresh CPU fallback/u,`${journey}: visible candidate identity`);
      assert(await start.isDisabled() && await download.isHidden(), `${embedding}: not-ready buttons gated`);
      assert.match(await start.innerText(), /QA preview \(not phone evidence\)/u, `${embedding}: explicit preview-only UI`);
      const beforeWorker=await game.evaluate(element=>({status:element.graph.cv.getStatus(),snapshot:element.getSnapshot()}));
      assert.equal(beforeWorker.status.providerId,null,`${journey}: no pre-load actual Worker delegate`);
      assert.equal(beforeWorker.snapshot.cvProfile.requestedProviderId,"gpu-webgl",`${journey}: requested GPU profile before Worker`);
      assert.equal(beforeWorker.snapshot.cvProfile.schedulingMode,"after-result",`${journey}: candidate scheduler before Worker`);
      assert.equal(beforeWorker.snapshot.cvProfile.providerId,null,`${journey}: snapshot never calls requested GPU actual`);
      assert.equal(beforeWorker.snapshot.services.cv.providerId,null,`${journey}: service snapshot never calls requested GPU actual`);
      const imported = await game.evaluate(async (element, chartBytes) => {
        const wav = seconds => { const rate=8000,len=rate*seconds*2,buffer=new ArrayBuffer(44+len),view=new DataView(buffer);const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};text(0,"RIFF");view.setUint32(4,36+len,true);text(8,"WAVEfmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,"data");view.setUint32(40,len,true);return new Uint8Array(buffer);};
        const difficulty=Uint8Array.from(chartBytes),audio=wav(120),info=new TextEncoder().encode("{}");
        const hash=async bytes=>`sha256:${[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(value=>value.toString(16).padStart(2,"0")).join("")}`;
        const [difficultyHash,audioHash]=await Promise.all([hash(difficulty),hash(audio)]);
        const entries=new Map([["Info.dat",info],["Easy.dat",difficulty],["song.wav",audio]]);
        const source=Object.freeze({manifest:Object.freeze({schemaId:"aerobeat.beatsaver-source-manifest.v2",infoFormatMajor:2,infoFormat:"v2",infoVersion:"2.0.0",infoPath:"Info.dat",hashInputPaths:Object.freeze(["Easy.dat"]),songName:"QA Deterministic Silence",songSubName:"",songAuthorName:"AeroBeat",levelAuthorName:"AeroBeat QA",bpm:120,audioPath:"song.wav",coverPath:"",previewStartSeconds:0,previewDurationSeconds:0,difficulties:Object.freeze([Object.freeze({characteristic:"Standard",difficulty:"Easy",difficultyRank:1,path:"Easy.dat",beatMapFormatMajor:2,beatMapFormat:"v2",beatMapVersion:"2.0.0",notePalette:null,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:1})]),entries:Object.freeze([]),archiveBytes:difficulty.length+audio.length+info.length,expandedBytes:difficulty.length+audio.length+info.length}),listEntryPaths(){return Object.freeze(["Info.dat","Easy.dat","song.wav"]);},readEntry(path){const bytes=entries.get(path);if(!bytes)throw Error("fixture entry missing");return Uint8Array.from(bytes);}});
        const authored=await element.graph.authoring.convertAllStandardAndPersist({providerId:"beatsaver",sourceHash:"0123456789abcdef0123456789abcdef01234567",source},{sourceProvider:"beatsaver",sourceId:"QA-LOCAL",sourceVersionHash:"0123456789abcdef0123456789abcdef01234567",expectedAudioContentHash:audioHash,expectedDifficultyContentHashes:{"Easy.dat":difficultyHash},includeAudio:true,cacheSourceEntries:true});
        await element.refreshLibrary(element.connectedGeneration,{autoSelect:false});await element.requestLibrarySelection(authored.collection.collectionId,authored.defaultPackage.packageId);
        const selected=element.graph.content.getSnapshot();
        return {ready:selected.state==="ready",selected:selected.packageId===authored.defaultPackage.packageId,worker:element.graph.authoring.getCapabilities().conversionWorker};
      }, [...chart]);
      assert.deepEqual(imported, { ready:true, selected:true, worker:true }, `${embedding}: real Worker imported selected chart`);
      // Real browser camera and real MediaPipe Worker; fake-device's synthetic
      // checkerboard may contain no body. Do NOT set calibrationId or replace CV.
      await game.locator("aero-session-actions").getByRole("button", { name:"Start", exact:true }).click();
      // configureContent sets purpose=play before camera acquisition and CV load;
      // purpose alone is not a media-readiness boundary.
      await frame.waitForFunction(() => {
        const element=document.querySelector("aero-game"),graph=element?.graph;
        return graph?.gameplay?.getSnapshot?.()?.session?.purpose === "play" &&
          graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState === "live" &&
          graph.cv.getStatus().lifecycleState === "running" &&
          graph.authoring.getCapabilities().conversionWorker === true;
      }, null, { timeout:30000 }).catch(async cause => {
        const detail=await game.evaluate(element=>({session:element.graph.gameplay.getSnapshot().session.state,cv:element.graph.cv.getStatus().lifecycleState,track:element.graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState ?? null,error:element.lastError?.message ?? null}));
        throw new Error(`INVALID SETUP ${embedding}: camera/CV/Worker never became ready: ${JSON.stringify(detail)}`, {cause});
      });
      const setup = await game.evaluate(element => ({
         provider:element.graph.cv.getStatus().providerId, scheduler:element.graph.cv.getStatus().schedulingMode, submissions:element.graph.cv.getStatus().submittedFrameCount, poseCount:element.graph.cv.getStatus().poseFrameCount,
         presentedFrameId:element.activeCvSource?.getPresentedFrameId?.() ?? null,
         profile:element.getSnapshot().cvProfile, publicCv:element.getSnapshot().services.cv,
        session:element.graph.gameplay.getSnapshot().session.state,
        purpose:element.graph.gameplay.getSnapshot().session.purpose,
        cv:element.graph.cv.getStatus().lifecycleState,
        track:element.graph.video.getRetainedCameraStream()?.getVideoTracks()[0]?.readyState ?? null,
        calibration:element.graph.input.getSnapshot().calibration.state,
        ready:!!element.graph.input.getSnapshot().calibration.calibrationId,
        worker:element.graph.authoring.getCapabilities().conversionWorker,
        error:element.lastError?.message ?? null
      }));
      if (setup.purpose !== "play" || setup.track !== "live" || setup.cv !== "running" || setup.worker !== true) throw new Error(`INVALID SETUP ${embedding}: actual Play camera/CV/Worker boundary unavailable: ${JSON.stringify(setup)}`);
      assert.equal(setup.scheduler,"after-result",`${journey}: real graph scheduling identity`);
      assert.equal(setup.provider,force ? "cpu-wasm" : "gpu-webgl",`${journey}: actual selected Worker provider`);
      assert.equal(setup.profile.requestedProviderId,"gpu-webgl",`${journey}: GPU remains requested independent of actual delegate`);
      assert.equal(setup.profile.schedulingMode,"after-result",`${journey}: snapshot scheduler follows candidate graph`);
      assert.equal(setup.profile.providerId,setup.provider,`${journey}: snapshot actual provider follows selected Worker`);
      assert.equal(setup.publicCv.providerId,setup.provider,`${journey}: public CV status agrees with selected Worker`);
      assert.equal(setup.publicCv.schedulingMode,setup.scheduler,`${journey}: public CV scheduler agrees with graph`);
      assert(Number.isSafeInteger(setup.presentedFrameId) && setup.presentedFrameId > 0,`${journey}: genuine video-element presentation callback`);
      const liveWorkers = page.workers().filter(worker => new URL(worker.url()).origin === target.origin);
      const cvWorkers = liveWorkers.filter(worker => workerPaths.includes(new URL(worker.url()).pathname.slice(1)) && /mediapipe/iu.test(worker.url()));
      assert.equal(cvWorkers.length,1,`${journey}: one live signed MediaPipe Worker (failed GPU replaced on CPU path)`);
      if (embedding === "direct" && !force) {
        const probeUrl="https://example.invalid/aerobeat-csp-probe";
        assert.equal(await frame.evaluate(url => fetch(url).then(()=>false,()=>true),probeUrl),true,"document CSP actively blocks third-party fetch");
        assert.equal(await cvWorkers[0].evaluate(url => fetch(url).then(()=>false,()=>true),probeUrl),true,"actual running CV Worker CSP actively blocks third-party fetch");
        assert.deepEqual(networkEscapes,[],"blocked fetch never reaches outbound request interception");
      }
      // SYNTHETIC CALIBRATION STIMULUS ONLY: Chromium's checkerboard camera
      // cannot provide T-pose landmarks. Feed native input measured-form samples
      // with the REAL Worker frame sourceId and the current camera/aspect identity.
      // Camera, MediaPipe Worker, scorer and game implementation stay untouched.
      // This proves the native hold/release/countdown path, NOT camera pose quality.
      const calibration = await game.evaluate(async element => {
        const graph=element.graph, wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
        const deadline=performance.now()+14000;
        while(performance.now()<deadline && !graph.cv.getLatestPoseFrame())await wait(35);
        const initial=graph.cv.getStatus(), initialFrame=graph.cv.getLatestPoseFrame();
        if (!initial.running || !initialFrame?.sourceId || !element.lastCameraIdentity || element.menuOpen) throw Error(`INVALID SETUP: native synthetic stimulus requires live CV frame, camera identity, closed menu: ${JSON.stringify({running:initial.running,frame:Boolean(initialFrame),poseCount:initial.poseFrameCount,camera:Boolean(element.lastCameraIdentity),menu:element.menuOpen})}`);
        if (!(initial.poseFrameCount > 0 && initial.submittedFrameCount >= initial.poseFrameCount)) throw Error(`INVALID SETUP: actual selected Worker must produce poses from admitted frames after bounded real pose wait: ${JSON.stringify({submitted:initial.submittedFrameCount,poses:initial.poseFrameCount})}`);
        const sourceId=initialFrame.sourceId, cameraIdentity=element.lastCameraIdentity, surface=graph.video.describeSurface(element.videoElement());
        if (!(surface.sourceAspectRatio>0)) throw Error("INVALID SETUP: camera aspect unavailable");
        const graphIdentity=graph;
        let clock=Math.max(performance.now(),Number(graph.input.getSnapshot().tracking.timestampMs??0)+1), samples=0;
        const feed=tPose=>{
          if(element.graph!==graphIdentity || graph.cv.getStatus().running!==true || element.lastCameraIdentity!==cameraIdentity || graph.cv.getLatestPoseFrame()?.sourceId!==sourceId)throw Error("INVALID SETUP: CV source/camera identity changed during native calibration");
          clock=Math.max(performance.now(),clock+1000/15,Number(graph.input.getSnapshot().tracking.timestampMs??0)+1);
          const y=tPose?.4:.58;
          const points={nose:{x:.5,y:.2},left_shoulder:{x:.35,y:.4},right_shoulder:{x:.65,y:.4},left_elbow:{x:.2,y},right_elbow:{x:.8,y},left_wrist:{x:tPose?.05:.05,y},right_wrist:{x:tPose?.95:.95,y},left_hip:{x:.43,y:.68},right_hip:{x:.57,y:.68}};
          graph.input.processPoseSample({sourceId,timestampMs:clock,mirrored:initialFrame.mirrored,landmarks:Object.entries(points).map(([name,position])=>({name,...position,confidence:.99}))},{sourceAspectRatio:surface.sourceAspectRatio,sourceChangeId:cameraIdentity});
          samples++;
          const snapshot=graph.input.getSnapshot();
          if(snapshot.tracking.timestampMs!==clock)throw Error(`INVALID SETUP: synthetic sample not accepted by native input (${samples})`);
          return snapshot;
        };
        // Real native measured-time 2s T-pose hold, then arm the real display
        // and audio countdown. Leave Worker running; interleaving is observable.
        while(performance.now()<deadline && !graph.input.getSnapshot().calibration.calibrationId){feed(true);await wait(30);}
        if(!graph.input.getSnapshot().calibration.calibrationId)throw Error(`INVALID SETUP: alternating Worker frames blocked native T-pose hold: ${JSON.stringify({samples,poseCount:graph.cv.getStatus().poseFrameCount,state:graph.input.getSnapshot().calibration.state,session:graph.gameplay.getSnapshot().session.state})}`);
        while(performance.now()<deadline && graph.gameplay.getSnapshot().session.state!=="playing"){feed(false);await wait(35);}
        const input=graph.input.getSnapshot(),session=graph.gameplay.getSnapshot().session,cv=graph.cv.getStatus();
        if(!(input.calibration.state==="calibrated" && session.purpose==="play" && session.state==="playing" && cv.running && cv.poseFrameCount>initial.poseFrameCount))throw Error(`INVALID SETUP: native release/countdown did not reach scored Play: ${JSON.stringify({samples,poseBefore:initial.poseFrameCount,poseAfter:cv.poseFrameCount,calibration:input.calibration.state,session:session.state,purpose:session.purpose,error:element.lastError?.message??null})}`);
        return {syntheticNativeSamples:samples,workerPosesBefore:initial.poseFrameCount,workerPosesAfter:cv.poseFrameCount,nativeCalibrated:!!input.calibration.calibrationId,play:session.state==="playing",cvRunning:cv.running};
      }).catch(cause=>{throw new Error(`INVALID SETUP ${embedding}: test-owned measured T-pose could not reach native calibrated Play: ${cause.message}`,{cause});});
      assert(calibration.nativeCalibrated && calibration.play && calibration.cvRunning && calibration.workerPosesAfter>calibration.workerPosesBefore,`${embedding}: synthetic input fixture plus real CV coexisted`);
      console.log(`[synthetic-calibration] ${embedding} nativeSamples=${calibration.syntheticNativeSamples} realWorkerPoseDelta=${calibration.workerPosesAfter-calibration.workerPosesBefore}; NOT physical CV or FPS evidence`);
      await game.evaluate(element => element.setMenuOpen(false));
      await frame.waitForFunction(() => document.querySelector("#play-cv-start")?.disabled === false, null, { timeout:5000 }).catch(async cause => { throw new Error(`INVALID SETUP ${embedding}: calibrated Play never reached recorder-ready state; UI=${JSON.stringify(await status.innerText())}`, {cause}); });
      assert.match(await status.innerText(), /Ready: keep moving in Play/u, `${journey}: ready UI state`);
       assert.match(await frame.locator("#play-cv-summary").innerText(),force ? /Scheduler after-result.*actual Worker cpu-wasm.*fresh CPU fallback/u : /Scheduler after-result.*actual Worker gpu-webgl/u,`${journey}: visible actual delegate`);
      const button = await start.boundingBox(); assert(button && button.width >= 40 && button.height >= 40);
      // No simulated click: touch must carry trusted user activation.
      await page.touchscreen.tap(button.x+button.width/2, button.y+button.height/2);
      await frame.waitForFunction(() => /QA warmup/u.test(document.querySelector("#play-cv-state")?.textContent ?? ""), null, { timeout:5000 });
      assert.match(await status.innerText(), /QA warmup · not sustained phone evidence/u, `${embedding}: warmup UI`);
      await frame.waitForFunction(() => /Recording Play/u.test(document.querySelector("#play-cv-state")?.textContent ?? ""), null, { timeout:5000 });
      assert(await start.isDisabled(), `${embedding}: measurement cannot restart`);
      assert.match(await status.innerText(), /Recording Play/u, `${embedding}: measuring UI`);
      // Wait for the controller's real four-second QA timer, not the default
      // sixty-second phone window. No production clock/CV/scorer manipulation.
      await frame.waitForFunction(() => /QA preview complete/u.test(document.querySelector("#play-cv-state")?.textContent ?? ""), null, { timeout:7000 });
      assert.match(await status.innerText(), /QA preview complete\. JSON is not sustained phone evidence/u, `${embedding}: invalid QA preview state`);
      assert(await download.isVisible() && await download.isEnabled(), `${embedding}: invalid JSON downloadable`);
      assert.match(await download.innerText(), /Download tracking JSON/u, `${embedding}: named download control`);
      const box=await download.boundingBox(); assert(box && box.width>=40 && box.height>=40 && box.x>=0 && box.y>=0 && box.x+box.width<=390 && box.y+box.height<=844, `${embedding}: visible touch target`);
      const transfer=page.waitForEvent("download", { timeout:15000 });
      await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
      const file=await transfer;
      assert.equal(file.suggestedFilename(), "aerobeat-private-play-gpu-after-result-v1.json");
      const bytes=await readFile(await file.path()); assert(bytes.length>100 && bytes.length<=16384);
      const report=JSON.parse(new TextDecoder("utf-8", {fatal:true}).decode(bytes)); validateReport(report, force ? "cpu-wasm" : "gpu-webgl");
      const reportedIdentity=await game.evaluate(element=>({provider:element.graph.cv.getStatus().providerId,scheduler:element.graph.cv.getStatus().schedulingMode,profile:element.getSnapshot().cvProfile}));
      assert.equal(report.delegate.selected,reportedIdentity.provider,`${journey}: exported delegate equals actual selected Worker at download`);
      assert.equal(report.delegate.selected,reportedIdentity.profile.providerId,`${journey}: exported delegate equals public snapshot actual provider`);
      assert.equal(report.scheduler.mode,reportedIdentity.scheduler,`${journey}: exported scheduler equals live CV scheduler`);
      assert.equal(reportedIdentity.profile.requestedProviderId,report.delegate.requested,`${journey}: requested GPU identity remains honest`);
      assert.equal(report.valid,false, "QA preview is never green physical-performance evidence");
      assert.equal(report.invalidReason,"qa_preview_not_phone_evidence");
      assert(report.window.durationMs > 0 && report.window.durationMs <= 10000, "bounded short observed Play window");
      assert.equal(report.window.valid, true, `${embedding}: inner Play measurement must be valid even though QA preview is never physical evidence: ${report.window.invalidReason}`);
      for (const name of ["cameraUniqueMediaFrames", "cvSubmitted", "cvPoses", "sceneFrames", "freshPoseConsumptions", "freshProcessedEquipment"]) assert(report.window.counts[name] > 0, `${embedding}: real Play ${name} must increment in measured window: ${JSON.stringify(report.window.counts)}`);
      assert(!/(?:"(?:landmarks|coordinates|poseX|deviceId|deviceLabel|audioBytes|songName|songId|chartId|sessionId|calibrationId|sourceId|eventId|frameBytes|videoFrame|screenshot|mediaTime|presentedFrames|rawFrames|perFrame|timestampMs)"|QA Deterministic Silence)/iu.test(bytes.toString("utf8")), `${embedding}: aggregate-only JSON privacy`);
      const published=JSON.stringify({publicMessages,publicEvents});
      // The ordinary public game snapshot may contain the existing release
      // build stamp. This diagnostic must not add its private scalar report,
      // bundle sidecar digest or QA-preview reason to any public channel.
      assert(!published.includes(report.build.bundleManifestSha256) && !published.includes("private_phone_play_cv") && !published.includes("qa_preview_not_phone_evidence") && !published.includes("cameraUniqueMediaFrames") && !published.includes("freshValidEquipmentPairs"), `${embedding}: diagnostic never leaks through public events/iframe messages`);
      assert.deepEqual(networkEscapes,[],`${journey}: no outward third-party request`);
       assert.equal(errors.length,0, `${embedding}: browser errors ${JSON.stringify(errors)}`);
      console.log(`PASS ${journey}: real Worker chart + real MediaPipe Play, named not-ready/ready/warmup/measuring/invalid/download; four-second QA preview report valid=false (not phone evidence); fixture SHA-256=${fixtureSha256}`);
    } finally { await context.close(); }
  }
} finally { await browser?.close(); await new Promise(done => parent.close(done)); }
