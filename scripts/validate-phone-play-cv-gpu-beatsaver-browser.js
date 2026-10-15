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
import { createSyntheticBeatSaverZip } from "../../aerobeat-web-vendor-beatsaver/scripts/fixture-helpers.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const build = resolve(root, "dist-phone-play-cv-gpu-beatsaver");
const sidecarName = "phone-play-cv-gpu-beatsaver-bundle-manifest.json";
const rawUrl = process.env.AEROBEAT_PLAY_CV_GPU_BEATSAVER_QA_URL;
assert(rawUrl, "INVALID SETUP: AEROBEAT_PLAY_CV_GPU_BEATSAVER_QA_URL must name an already-served distinct private build");
const target = new URL(rawUrl);
assert.equal(target.pathname, "/phone-play-cv-test.html", "INVALID SETUP: wrong private diagnostic page");
assert(["http:", "https:"].includes(target.protocol) && !target.username && !target.password && (target.search === "" || target.search === "?preview=1") && !target.hash, "INVALID SETUP: exact private page URL or ?preview=1 QA route required");
assert.equal(target.search, "?preview=1", "INVALID SETUP: short browser journey requires ?preview=1; default 60s is physical-only");
assert(target.protocol === "https:" || target.hostname === "127.0.0.1" && target.port === "4199", "INVALID SETUP: signed QA requires private HTTPS or isolated loopback4199");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const keys = (object, expected, label) => { assert(object && typeof object === "object" && !Array.isArray(object), `${label}: object`); assert.deepEqual(Object.keys(object).sort(), expected.slice().sort(), `${label}: exact allowlist`); };
const count = (value, max, label) => assert(Number.isSafeInteger(value) && value >= 0 && value <= max, `${label}: bounded count`);
const scalar = (value, max, label) => assert(value === null || typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max, `${label}: finite bounded scalar or null`);
const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const source = value => {
  keys(value, ["schema", "version", "packageVersion", "sources"], "source manifest");
  assert.equal(value.schema, "aerobeat/private_phone_play_cv_gpu_beatsaver_source_manifest"); assert.equal(value.version, 1);
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
keys(manifest, ["schema", "version", "purpose", "scheduler", "requestedDelegate", "fallback", "sourceManifest", "buildStamp", "responsePolicy", "assets"], "bundle manifest");
assert.equal(manifest.purpose, "full_game_play_gpu_after_result_beatsaver_private_candidate"); assert.deepEqual(manifest.scheduler, {mode:"after-result",targetFps:15});
assert.equal(manifest.requestedDelegate,"gpu-webgl"); assert.equal(manifest.fallback,"fresh_cpu_wasm_only_on_initialization_failure");
assert.equal(manifest.schema, "aerobeat/private_phone_play_cv_gpu_beatsaver_bundle"); assert.equal(manifest.version, 1); source(manifest.sourceManifest);
assert.equal(manifest.buildStamp, `PHONE-PLAY-CV-GPU-BEATSAVER-${manifest.sourceManifest.packageVersion}-${digest(Buffer.from(JSON.stringify(manifest.sourceManifest))).slice(0, 24)}`);
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
const documentCsp = "connect-src 'self' https://api.beatsaver.com https://r2cdn.beatsaver.com; media-src 'self' blob: https://cfcdn.beatsaver.com; base-uri 'none'; form-action 'none'; object-src 'none'";
const otherCsp = "connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";
keys(manifest.responsePolicy, ["documentPaths", "documentCsp", "otherCsp", "referrerPolicy", "contentTypeOptions"], "signed response policy");
assert.deepEqual(manifest.responsePolicy.documentPaths, ["/", "/index.html", "/phone-play-cv-test.html"]);
assert.equal(manifest.responsePolicy.documentCsp, documentCsp);
assert.equal(manifest.responsePolicy.otherCsp, otherCsp);
assert.equal(manifest.responsePolicy.referrerPolicy, "no-referrer");
assert.equal(manifest.responsePolicy.contentTypeOptions, "nosniff");
const checkedPaths = new Map();
const policy = (response, expected) => {
  assert.equal(response.headers.get("content-security-policy"), expected, `${response.url}: exact CSP`);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer", `${response.url}: private no-referrer`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${response.url}: nosniff`);
};
for (const entry of manifest.assets) {
  keys(entry, ["path", "bytes", "sha256"], "asset entry");
  assert(typeof entry.path === "string" && /^(?:index\.html|phone-play-cv-test\.html|favicon\.ico|assets\/[A-Za-z0-9._/-]+)$/u.test(entry.path) && !entry.path.split("/").some(part => !part || part === "." || part === ".."), "safe relative asset path");
  count(entry.bytes, 100_000_000, entry.path); assert(entry.bytes > 0 && hex(entry.sha256));
  const disk = await readFile(resolve(build, entry.path));
  assert.equal(disk.byteLength, entry.bytes, `${entry.path}: local bytes`);
  assert.equal(digest(disk), entry.sha256, `${entry.path}: local SHA-256`);
  const response = await fetch(new URL(`/${entry.path}`, target), { cache: "no-store" });
  assert.equal(response.status, 200, `${entry.path}: served status`);
  policy(response, entry.path === "index.html" || entry.path === "phone-play-cv-test.html" ? documentCsp : otherCsp);
  const served = Buffer.from(await response.arrayBuffer());
  assert.equal(served.byteLength, entry.bytes, `${entry.path}: served bytes`);
  assert.equal(digest(served), entry.sha256, `${entry.path}: served SHA-256`);
  checkedPaths.set(entry.path, served);
}
const servedManifest = await fetch(new URL("/phone-play-cv-gpu-beatsaver-bundle-manifest.json", target), { cache: "no-store" });
assert.equal(servedManifest.status, 200); policy(servedManifest, otherCsp);
assert.equal(digest(Buffer.from(await servedManifest.arrayBuffer())), digest(manifestBytes), "exact served sidecar parity");
const workerPaths = paths.filter(path => /^assets\/.*worker.*\.js$/iu.test(path));
assert(workerPaths.length >= 1, "signed dedicated Worker must exist");
for (const path of ["/", "/index.html", "/phone-play-cv-test.html", "/missing-csp-probe"]) {
  const response = await fetch(new URL(path, target), { cache:"no-store" });
  policy(response, path === "/missing-csp-probe" ? otherCsp : documentCsp);
  if (path === "/missing-csp-probe") assert.equal(response.headers.get("content-security-policy"), otherCsp, "SPA fallback retains self-only CSP even with HTTP 200");
}
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
let offHostServerHits = 0;
const offHostServer = createServer((_request, response) => { offHostServerHits++; response.writeHead(204); response.end(); });
await new Promise(done => parent.listen(0, "localhost", done));
await new Promise(done => offHostServer.listen(0, "127.0.0.1", done));
const offHostAddress = offHostServer.address(); assert(offHostAddress && typeof offHostAddress !== "string");
const offHostMediaUrl = `http://127.0.0.1:${offHostAddress.port}/aerobeat-preview-redirect-probe.mp3`;
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
    const page = await context.newPage(), errors = [], publicMessages = [], publicEvents = [], networkEscapes = [], allowedRequests = [], visibleStates = [], blockedRedirects = [], unexpectedResponses = [], cspViolations = [];
    let redirectProbeActive=false;
    context.on("request", request => {
      const url=request.url();
      if (!/^https?:/u.test(url) || [target.origin,new URL(parentUrl).origin].includes(new URL(url).origin)) return;
      const parsed=new URL(url);
      if(redirectProbeActive && url===offHostMediaUrl) return;
      if(parsed.protocol==="https:" && ["api.beatsaver.com","r2cdn.beatsaver.com","cfcdn.beatsaver.com"].includes(parsed.hostname) && !request.isNavigationRequest() && request.headers()["referer"]===undefined && request.headers()["cookie"]===undefined) {
        allowedRequests.push({host:parsed.hostname,path:parsed.pathname});
      } else networkEscapes.push(`${parsed.origin}${parsed.pathname}`);
    });
    context.on("requestfailed",request=>{
      if(request.url()===offHostMediaUrl)blockedRedirects.push(request.failure()?.errorText??"");
    });
    context.on("response",response=>{
      if(response.url()===offHostMediaUrl)unexpectedResponses.push(response.status());
    });
    page.on("console",message=>{if(message.type()==="error" && message.text().includes("aerobeat-preview-redirect-probe.mp3"))cspViolations.push(message.text());});
     // Match the prior private full-game browser oracle's pageerror boundary;
    // do not collect only console errors and silently miss other diagnostics.
    page.on("pageerror", error => errors.push(error.message));
    await page.exposeBinding("__qaCapturePublic", (_source, kind, payload) => { (kind === "message" ? publicMessages : publicEvents).push(payload); });
    await page.exposeBinding("__qaVisibleBeatSaver",(_source,state)=>visibleStates.push(state));
    await page.addInitScript(() => {
      window.addEventListener("DOMContentLoaded",()=>{
        const track=()=>{const game=document.querySelector("aero-game"), browser=game?.shadowRoot?.querySelector("aero-beatsaver-browser");
          if(!browser?.shadowRoot){requestAnimationFrame(track);return;}
          new MutationObserver(()=>{const label=browser.shadowRoot?.querySelector("[part='panel'] [role='status']")?.textContent??"";
            if(label.includes("Loading BeatSaver maps"))window.__qaVisibleBeatSaver("loading");}).observe(browser.shadowRoot,{childList:true,subtree:true});
          const importPresenter=game.shadowRoot?.querySelector("aero-content-import-progress");
          if(importPresenter?.shadowRoot)new MutationObserver(()=>{const text=importPresenter.shadowRoot?.querySelector("[part='panel'] [role='status']")?.textContent??"";
            if(/(?:converting|authoring|persisting|loading)/iu.test(text))window.__qaVisibleBeatSaver("import-progress");}).observe(importPresenter.shadowRoot,{childList:true,subtree:true});
        };track();
      },{once:true});
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
      assert(!/Private build identity failed/u.test(await status.innerText()),`${journey}: distinct signed diagnostic accepted`);
       assert.match(await frame.locator("#play-cv-recorder strong").innerText(), /full-game GPU-first after-result \/ fresh CPU fallback/u,`${journey}: visible candidate identity`);
      assert(await start.isDisabled() && await download.isHidden(), `${embedding}: not-ready buttons gated`);
      assert.match(await start.innerText(), /QA preview \(not phone evidence\)/u, `${embedding}: explicit preview-only UI`);
      const beforeWorker=await game.evaluate(element=>({status:element.graph.cv.getStatus(),snapshot:element.getSnapshot()}));
      assert.equal(beforeWorker.status.providerId,null,`${journey}: no pre-load actual Worker delegate`);
      assert.equal(beforeWorker.snapshot.cvProfile.requestedProviderId,"gpu-webgl",`${journey}: requested GPU profile before Worker`);
      assert.equal(beforeWorker.snapshot.cvProfile.schedulingMode,"after-result",`${journey}: candidate scheduler before Worker`);
      assert.equal(beforeWorker.snapshot.cvProfile.providerId,null,`${journey}: snapshot never calls requested GPU actual`);
      assert.equal(beforeWorker.snapshot.services.cv.providerId,null,`${journey}: service snapshot never calls requested GPU actual`);
      const music = game.locator("aero-beatsaver-browser");
      assert(await music.locator("[part='panel']").isVisible(),`${journey}: Music panel visible`);
      assert(await music.getByRole("textbox",{name:"Search maps"}).isVisible(),`${journey}: visible search input`);
      assert(await music.getByRole("button",{name:"Choose local ZIP"}).isVisible(),`${journey}: fallback visible`);
      if (!force) {
        const apiStatuses=[];
        const onResponse=response=>{if(response.url().startsWith("https://api.beatsaver.com/"))apiStatuses.push(response.status());};
        page.on("response",onResponse);
        try {
          await music.getByRole("textbox",{name:"Search maps"}).fill("Linkin Park");
          await music.getByRole("button",{name:"Search",exact:true}).click();
          // A transition may be shorter than one Playwright poll: capture every
          // presenter commit, then assert the named loading state actually ran.
          await frame.waitForFunction(()=>["ready","empty","error"].includes(document.querySelector("aero-game")?.beatSaverView?.state),null,{timeout:25000});
          const result=await game.evaluate(element=>({state:element.beatSaverView.state,query:element.beatSaverView.query,count:element.beatSaverView.results.length,error:element.beatSaverView.errorMessage}));
          if(result.state!=="ready")throw new Error(`LIVE PROVIDER/CORS ${journey}: ${JSON.stringify(result)} API HTTP=${JSON.stringify(apiStatuses)}`);
          assert(visibleStates.includes("loading"),`${journey}: visible Loading BeatSaver maps state occurred`);
          assert.equal(result.query,"Linkin Park");assert(result.count>0 && result.count<=20,`${journey}: compatible results`);
          assert.match(await music.locator("[part='results']").innerText(),/Linkin Park/iu,`${journey}: visible actual results`);
          assert.equal(await music.locator("[part='result']").count(),result.count,`${journey}: visible cards`);
          const candidates=await game.evaluate(element=>element.beatSaverView.results.map(row=>({mapId:row.mapId,name:row.name})).filter(row=>/Linkin Park/iu.test(row.name)));
          assert(candidates.length>0,`${journey}: selected Linkin Park result`);
          await music.locator(`[part='result'] input[value='${candidates[0].mapId}']`).check();
          const detail=music.locator("[part='detail']");
          assert(await detail.isVisible() && await detail.getByRole("button",{name:"Download",exact:true}).isEnabled(),`${journey}: selected map Download visible`);
          assert(await detail.locator("[part='version-select']").isVisible(),`${journey}: selected version visible`);
          const selected=await game.evaluate(element=>{const id=element.beatSaverView.selectedMap.mapId;
            const version=element.browsedMaps.get(id.toUpperCase()).versions.find(row=>row.hash===element.beatSaverView.selectedVersionHash);
            return {hash:version.hash,downloadUrl:version.downloadUrl,previewUrl:version.previewUrl};});
          assert.match(selected.hash,/^[a-f0-9]{40}$/iu,`${journey}: exact selected provider hash`);
          assert.equal(selected.downloadUrl,`https://r2cdn.beatsaver.com/${selected.hash}.zip`,`${journey}: exact-hash provider ZIP URL`);
          assert.equal(selected.previewUrl,`https://cfcdn.beatsaver.com/${selected.hash}.mp3`,`${journey}: exact-hash preview URL`);
          const preview=detail.getByRole("button",{name:/^Preview /u});
          await preview.click();
          await frame.waitForFunction(()=>["playing","error"].includes(document.querySelector("aero-game")?.previewView?.state),null,{timeout:12000});
          assert(allowedRequests.some(row=>row.host==="cfcdn.beatsaver.com" && row.path===`/${selected.hash}.mp3`),`${journey}: actual selected preview host/path`);
          if(await detail.getByRole("button",{name:/^Stop /u}).count())await detail.getByRole("button",{name:/^Stop /u}).click();
          // Test-only transport substitute: preserve the game's selected-map URL
          // and HTMLAudioElement path, but respond with a local 302 to a
          // different origin. A request event can precede CSP denial; the
          // independent loopback server proves whether HTTP was dispatched.
          let redirected=0;
          const serverHitsBefore=offHostServerHits;
          redirectProbeActive=true;
          await context.route(`https://cfcdn.beatsaver.com/${selected.hash}.mp3`,async route=>{
            redirected++;
            await route.fulfill({status:302,headers:{location:offHostMediaUrl,"cache-control":"no-store"},body:""});
          });
          try {
            await detail.getByRole("button",{name:/^Preview /u}).click();
            await frame.waitForFunction(()=>document.querySelector("aero-game")?.previewView?.state==="error",null,{timeout:8000});
            assert(redirected>0,`${journey}: real HTMLAudioElement requested allowed initial preview`);
            assert.equal(offHostServerHits,serverHitsBefore,`${journey}: no off-host media HTTP dispatch`);
            assert.deepEqual(blockedRedirects,["net::ERR_ABORTED"],`${journey}: off-host redirect aborted by browser`);
            assert.equal(unexpectedResponses.length,0,`${journey}: no off-host redirect response`);
            assert(cspViolations.some(text=>text.includes("media-src") && text.includes("violates")),`${journey}: redirect blocked by actual document media-src CSP`);
            assert.equal(await game.evaluate(element=>element.previewView.state),"error",`${journey}: media error visible through presenter state`);
          } finally {redirectProbeActive=false;await context.unroute(`https://cfcdn.beatsaver.com/${selected.hash}.mp3`);}
          const before=await game.evaluate(element=>element.libraryView.collections.length);
          await detail.getByRole("button",{name:"Download",exact:true}).click();
          await frame.waitForFunction(count=>{const game=document.querySelector("aero-game");return game?.libraryView?.collections?.length>count && game.graph?.content.getSnapshot().state==="ready" && game.libraryView.selectedPackageId===game.graph.content.getSnapshot().packageId;},before,{timeout:120000}).catch(async cause=>{
            const failure=await game.evaluate(element=>({error:element.lastError?.message??null,library:element.libraryView.collections.length}));
            throw new Error(`LIVE PROVIDER/ZIP/CONVERSION ${journey}: ${JSON.stringify(failure)} API HTTP=${JSON.stringify(apiStatuses)}`,{cause});
          });
          assert(visibleStates.includes("import-progress"),`${journey}: real import progress visible in Music panel`);
          assert(allowedRequests.some(entry=>entry.host==="api.beatsaver.com" && entry.path.startsWith("/search/text/")),`${journey}: real API search`);
          assert(allowedRequests.some(entry=>entry.host==="r2cdn.beatsaver.com" && entry.path===`/${selected.hash}.zip`),`${journey}: exact selected provider ZIP`);
          assert(await game.locator("aero-content-library").getByRole("heading",{name:"Downloaded songs",exact:true}).isVisible(),`${journey}: downloaded panel`);
          assert(await game.locator("aero-session-actions").getByRole("button",{name:"Start",exact:true}).isEnabled(),`${journey}: imported Start`);
          // Retain the provider's normalized selected map/version shape. Change
          // only its ZIP URL so selectVersion succeeds and the real candidate
          // URL guard, rather than malformed test metadata, rejects the fetch.
          const denied=await game.evaluate(async element=>{
            const selectedMapId=element.beatSaverView.selectedMap.mapId;
            const selectedHash=element.beatSaverView.selectedVersionHash;
            const original=element.browsedMaps.get(selectedMapId.toUpperCase());
            const altered={...original,versions:original.versions.map(version=>version.hash===selectedHash
              ? {...version,downloadUrl:`https://example.invalid/${selectedHash}.zip`}
              : version)};
            try {await element.graph.vendor.acquireVersion(altered,selectedHash);return "unexpected success";}
            catch(error){return error instanceof Error?error.message:String(error);}
          });
                    assert.match(denied,/not approved for this private build/u,`${journey}: off-list provider ZIP rejected before fetch`);
          assert.deepEqual(networkEscapes,[],`${journey}: rejected ZIP made no off-host request`);
          console.log(`PASS ${journey}: live Linkin Park UI search, results, selected version and real ZIP; API HTTP=${apiStatuses.join(",")}`);
        } finally {page.off("response",onResponse);}
      } else {
        const zip=createSyntheticBeatSaverZip(2);
        const chooserEvent=page.waitForEvent("filechooser");
        await music.getByRole("button",{name:"Choose local ZIP"}).click();
        const chooser=await chooserEvent;
        await chooser.setFiles({name:"qa-synthetic.zip",mimeType:"application/zip",buffer:Buffer.from(zip)});
        await frame.waitForFunction(()=>{const game=document.querySelector("aero-game");return game?.libraryView?.collections?.length>0 && game.graph?.content.getSnapshot().state==="ready" && game.libraryView.selectedPackageId===game.graph.content.getSnapshot().packageId;},null,{timeout:60000});
        assert(await game.locator("aero-session-actions").getByRole("button",{name:"Start",exact:true}).isEnabled(),`${journey}: local ZIP Start`);
        console.log(`PASS ${journey}: child-local ZIP picker, actual authoring Worker and selected chart`);
      }
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
      if (!force) {
        const beforeProbe=allowedRequests.length;
        const probeUrl="https://example.invalid/aerobeat-csp-probe";
        assert.equal(await frame.evaluate(url=>fetch(url).then(()=>false,()=>true),probeUrl),true,"document CSP blocks example.invalid");
        assert.equal(await cvWorkers[0].evaluate(url=>fetch(url).then(()=>false,()=>true),probeUrl),true,"real CV Worker blocks example.invalid");
        assert.equal(await cvWorkers[0].evaluate(url=>fetch(url).then(()=>false,()=>true),"https://api.beatsaver.com/search/text/0?q=WorkerProbe"),true,"real CV Worker blocks document-allowed API");
        assert.equal(allowedRequests.length,beforeProbe,`${journey}: denied Worker API probe emitted no request`);
        assert.deepEqual(networkEscapes,[],`${journey}: denied probes emitted no network escape`);
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
      assert.deepEqual(networkEscapes,[],`${journey}: only approved BeatSaver egress`);
       assert.equal(errors.length,0, `${embedding}: browser errors ${JSON.stringify(errors)}`);
      console.log(`PASS ${journey}: real Worker chart + real MediaPipe Play, named not-ready/ready/warmup/measuring/invalid/download; four-second QA report is not physical evidence`);
    } finally { await context.close(); }
  }
} finally { await browser?.close(); await new Promise(done => parent.close(done)); await new Promise(done => offHostServer.close(done)); }
