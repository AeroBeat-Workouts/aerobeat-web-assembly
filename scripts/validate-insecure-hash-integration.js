// @ts-check

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { networkInterfaces, tmpdir } from "node:os";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { build } from "vite";
import { sha256Hex } from "@aerobeat/web-hash";
import { computeBeatSaverMapHash, inspectBeatSaverArchive } from "@aerobeat/web-vendor-beatsaver";

const VERSION_HASH = "431ffaa53a1e45ffab6c81a895e456f6aad1e038";
const FIXTURE_PATHS = [
  process.env.AEROBEAT_BEATSAVER_4858_ZIP,
  "/home/derrick/.dsh/projects/aerobeat/aerobeat-vendor-beatsaver/.testbed/.artifacts/4858/431ffaa53a1e45ffab6c81a895e456f6aad1e038/4858-431ffaa53a1e.zip",
  "/home/derrick/.dsh/projects/aerobeat/aerobeat-web-vendor-beatsaver/.testbed/.artifacts/4858/431ffaa53a1e45ffab6c81a895e456f6aad1e038/4858-431ffaa53a1e.zip"
].filter(Boolean);
const fixturePath = await firstReadable(FIXTURE_PATHS);
const fixtureBytes = new Uint8Array(await readFile(fixturePath));
const fixtureSha256 = createHash("sha256").update(fixtureBytes).digest("hex");
const fixtureRawSha1 = createHash("sha1").update(fixtureBytes).digest("hex");
const fixtureSource = await inspectBeatSaverArchive(fixtureBytes);
assert.equal(await computeBeatSaverMapHash(fixtureSource), VERSION_HASH, "local 4858 fixture provider identity drifted");
const manifest = fixtureSource.manifest;
const standardDifficulties = manifest.difficulties.filter((entry) => entry.characteristic === "Standard");
assert.ok(standardDifficulties.length > 0, "4858 must expose Standard difficulties");
const map = providerMap(manifest, standardDifficulties);
const tailscaleIp = findTailscaleIp();
const outputRoot = await mkdtemp(resolve(tmpdir(), "aerobeat-insecure-production-"));
let childServer;
let parentServer;
let browser;
try {
  await build({ configFile: "vite.config.js", logLevel: "silent", build: { outDir: outputRoot, emptyOutDir: true, sourcemap: true } });
  childServer = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://child.invalid");
      if (url.pathname === "/__fixture/4858.zip") { send(response, 200, fixtureBytes, "application/zip"); return; }
      const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      const file = resolve(outputRoot, relativePath);
      if (!(file === outputRoot || file.startsWith(`${outputRoot}${sep}`))) { send(response, 403, "forbidden", "text/plain"); return; }
      const info = await stat(file); if (!info.isFile()) throw new Error("not-file");
      send(response, 200, await readFile(file), mime(file));
    } catch { send(response, 404, "not found", "text/plain"); }
  });
  await listen(childServer);
  const childPort = port(childServer);
  parentServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://parent.invalid");
    const child = url.searchParams.get("child");
    if (!child || !/^http:\/\/(?:localhost|127\.0\.0\.1|100\.(?:6[4-9]|[78][0-9]|9[0-9]|1[01][0-9]|12[0-7])\.[0-9]{1,3}\.[0-9]{1,3}):[0-9]+\/$/u.test(child)) { send(response, 400, "invalid child", "text/plain"); return; }
    send(response, 200, `<!doctype html><meta charset="utf-8"><title>AeroBeat genuine cross-origin parent</title><style>html,body,iframe{border:0;margin:0;width:100%;height:100%;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${child}"></iframe>`, "text/html; charset=utf-8");
  });
  await listen(parentServer);
  const parentPort = port(parentServer);
  const origins = {
    insecure: { child: `http://${tailscaleIp}:${childPort}/`, parent: `http://${tailscaleIp}:${parentPort}/` },
    secure: { child: `http://localhost:${childPort}/`, parent: `http://127.0.0.1:${parentPort}/` }
  };
  browser = await chromium.launch();
  const rows = [
    { trust: "insecure", kind: "direct", importKind: "remote" },
    { trust: "insecure", kind: "iframe", importKind: "local" },
    { trust: "secure", kind: "direct", importKind: "remote" },
    { trust: "secure", kind: "iframe", importKind: "local" }
  ];
  const rowFilter = process.env.AEROBEAT_INTEGRATION_ROW?.trim() ?? "";
  const selectedRows = rowFilter ? rows.filter((row) => `${row.trust}/${row.kind}/${row.importKind}` === rowFilter) : rows;
  if (selectedRows.length === 0) throw new Error(`Unknown AEROBEAT_INTEGRATION_ROW ${rowFilter}`);
  const evidence = [];
  for (const row of selectedRows) evidence.push(await runRow(browser, row, origins[row.trust]));
  assert.deepEqual(evidence.map(({ trust, kind, secure, parentOrigin, childOrigin }) => ({ trust, kind, secure, parentOrigin, childOrigin })), selectedRows.map((row) => ({ trust: row.trust, kind: row.kind, secure: row.trust === "secure", parentOrigin: row.kind === "iframe" ? new URL(origins[row.trust].parent).origin : null, childOrigin: new URL(origins[row.trust].child).origin })));
  console.log(`Insecure/secure production runtime integration passed: fixture sha256=${fixtureSha256}, rawSha1=${fixtureRawSha1}, provider=${VERSION_HASH}, difficulties=${standardDifficulties.map((entry) => entry.difficulty).join(",")}; ${evidence.map((item) => `${item.trust}/${item.kind}/${item.importKind}`).join(", ")}.`);
} finally {
  await browser?.close();
  await close(parentServer); await close(childServer);
  await rm(outputRoot, { recursive: true, force: true });
}

async function runRow(browserInstance, row, origin) {
  const context = await browserInstance.newContext({ viewport: { width: 390, height: 844 } });
  const noise = []; const requests = []; let tamperAssetKind = null;
  const allowedLocalOrigins = new Set([new URL(origin.child).origin, ...(row.kind === "iframe" ? [new URL(origin.parent).origin] : [])]);
  await context.addInitScript(() => {
    globalThis.__aerobeatIntegrityPrecondition = Object.freeze({ isSecureContext: globalThis.isSecureContext, cryptoType: typeof globalThis.crypto, subtleType: typeof globalThis.crypto?.subtle });
    globalThis.__aerobeatWorkerLifecycle = { created: 0, terminated: 0 };
    const NativeWorker = globalThis.Worker;
    globalThis.Worker = new Proxy(NativeWorker, { construct(target, args, newTarget) { const worker = Reflect.construct(target, args, newTarget); globalThis.__aerobeatWorkerLifecycle.created += 1; const terminate = worker.terminate.bind(worker); worker.terminate = () => { globalThis.__aerobeatWorkerLifecycle.terminated += 1; return terminate(); }; return worker; } });
    globalThis.__aerobeatCameraRequests = 0;
    const media = navigator.mediaDevices; if (media?.getUserMedia) { const native = media.getUserMedia.bind(media); media.getUserMedia = (...args) => { globalThis.__aerobeatCameraRequests += 1; return native(...args); }; }
    globalThis.__aerobeatObjectUrls = { created: 0, revoked: 0 };
    const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (value) => { globalThis.__aerobeatObjectUrls.created += 1; return create(value); };
    URL.revokeObjectURL = (value) => { globalThis.__aerobeatObjectUrls.revoked += 1; return revoke(value); };
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "api.beatsaver.com") {
      requests.push(`fixture:${url.pathname}`);
      if (url.pathname === "/maps/latest" || url.pathname.startsWith("/search/text/")) { await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ docs: [map], info: { page: 0, pages: 1, total: 1 } }) }); return; }
      if (url.pathname === "/maps/id/4858" || url.pathname === `/maps/hash/${VERSION_HASH}`) { await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(map) }); return; }
      await route.abort("blockedbyclient"); return;
    }
    if (url.hostname === "cdn.example.invalid" && url.pathname === "/4858.zip") { requests.push("fixture:/4858.zip"); await route.fulfill({ status: 200, contentType: "application/zip", headers: { "access-control-allow-origin": "*", "content-length": String(fixtureBytes.byteLength) }, body: Buffer.from(fixtureBytes) }); return; }
    if (url.origin === new URL(origin.child).origin && ((tamperAssetKind === "glb" && url.pathname.endsWith(".glb")) || (tamperAssetKind === "jpeg" && url.pathname.endsWith(".jpg")))) { const kind = tamperAssetKind; tamperAssetKind = null; const response = await route.fetch(); const body = Buffer.from(await response.body()); body[0] ^= 1; requests.push(`tamper:${kind}:${url.pathname}`); await route.fulfill({ response, body }); return; }
    if (allowedLocalOrigins.has(url.origin)) { requests.push(`local:${url.origin}${url.pathname}`); await route.continue(); return; }
    noise.push(`network-escape:${route.request().url()}`); await route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !/^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/u.test(message.text())) noise.push(`${message.type()}:${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
  page.on("requestfailed", (request) => { if (!request.failure()?.errorText.includes("ERR_ABORTED")) noise.push(`requestfailed:${request.url()}:${request.failure()?.errorText}`); });
  let game;
  if (row.kind === "direct") { await page.goto(origin.child, { waitUntil: "networkidle" }); game = page.locator("aero-game"); }
  else { await page.goto(`${origin.parent}?child=${encodeURIComponent(origin.child)}`, { waitUntil: "networkidle" }); game = page.frameLocator("#game").locator("aero-game"); }
  await game.waitFor();
  const expectedSecure = row.trust === "secure";
  const precondition = await game.evaluate(async () => {
    const probeUrl = URL.createObjectURL(new Blob(["postMessage({isSecureContext:globalThis.isSecureContext,cryptoType:typeof globalThis.crypto,subtleType:typeof globalThis.crypto?.subtle})"], { type: "text/javascript" }));
    const worker = new Worker(probeUrl, { type: "module" });
    const workerValue = await new Promise((resolvePromise, reject) => { worker.onmessage = (event) => resolvePromise(event.data); worker.onerror = reject; }); worker.terminate(); URL.revokeObjectURL(probeUrl);
    return { window: globalThis.__aerobeatIntegrityPrecondition, worker: workerValue, childOrigin: location.origin, parentOrigin: document.referrer ? new URL(document.referrer).origin : null };
  });
  assert.equal(precondition.window.isSecureContext, expectedSecure); assert.equal(precondition.worker.isSecureContext, expectedSecure);
  assert.equal(precondition.window.subtleType, expectedSecure ? "object" : "undefined"); assert.equal(precondition.worker.subtleType, expectedSecure ? "object" : "undefined");
  assert.equal(precondition.childOrigin, new URL(origin.child).origin);
  if (row.kind === "iframe") { assert.equal(precondition.parentOrigin, new URL(origin.parent).origin); assert.notEqual(precondition.parentOrigin, precondition.childOrigin); }
  const capabilities = await game.evaluate((element) => ({ public: element.getSnapshot().capabilities, authoring: element.graph.authoring.getCapabilities() }));
  assert.equal(capabilities.public.secureContext, expectedSecure); assert.equal(capabilities.public.camera, expectedSecure); assert.equal(capabilities.public.limitations.includes("camera_unavailable"), !expectedSecure);
  assert.equal(capabilities.authoring.conversionWorker, true); assert.equal(capabilities.authoring.indexedDb, true);
  await waitFor(page, () => game.evaluate((element) => { const state = element.graph.renderer.describe(); return state.gameplayAssets.state === "ready" && state.environment.state === "ready"; }), 30_000, `${row.trust}/${row.kind} initial assets`);
  const raw = await game.evaluate(async (element) => { const bytes = new Uint8Array(await (await fetch("/__fixture/4858.zip")).arrayBuffer()); const acquired = await element.graph.vendor.importLocalArchive(bytes); return { archiveSha1: acquired.archiveSha1, sourceHash: acquired.sourceHash, sourceFormatMajor: acquired.source.manifest.sourceFormatMajor }; });
  assert.equal(raw.archiveSha1, fixtureRawSha1); assert.equal(raw.sourceHash, VERSION_HASH); assert.ok([2, 3, 4].includes(raw.sourceFormatMajor));
  await game.evaluate((element) => element.browseLatestBeatSaver({ pageSize: 1 }));
  await game.evaluate((element) => element.browseBeatSaver({ text: "4858", pageSize: 1 }));
  if (row.importKind === "remote") {
    const selected = await game.evaluate((element) => { const ui = element.shadowRoot.querySelector("aero-beatsaver-browser"); const button = ui.shadowRoot.querySelector("button[data-intent='beatsaver-import']"); const radio = ui.shadowRoot.querySelector("input[type='radio']:checked"); button.click(); return { radio: radio?.value, disabled: button.disabled }; });
    assert.deepEqual(selected, { radio: "4858", disabled: false });
  } else {
    const localResult = await game.evaluate(async (element) => { const bytes = new Uint8Array(await (await fetch("/__fixture/4858.zip")).arrayBuffer()); try { await element.importLocalZip(new Blob([bytes], { type: "application/zip" }), { sourceId: "4858-local" }); return { accepted: true }; } catch (error) { return { accepted: false, code: error?.code, message: error?.message }; } });
    assert.deepEqual({ accepted: localResult.accepted, code: localResult.code }, { accepted: false, code: "obstacle_duration_invalid" });
  }
  await waitFor(page, () => game.evaluate((element) => element.graph.authoring.getSnapshot().state === "failed"), 30_000, `${row.trust}/${row.kind} malformed obstacle rejection`);
  const rejected = await game.evaluate(async (element) => ({ code:element.graph.authoring.getSnapshot().errorCode, packages:(await element.graph.authoring.listPackages()).length, collections:(await element.graph.authoring.listCollections()).length }));
  assert.deepEqual(rejected, { code:"obstacle_duration_invalid",packages:0,collections:0 }, "strict v2/v3/v4 normalization must reject the malformed source archive atomically");
  assert.deepEqual(noise, []);
  if (row.importKind === "remote") assert.ok(requests.includes("fixture:/4858.zip"));
  await context.close();
  return { trust: row.trust, kind: row.kind, importKind: row.importKind, secure: expectedSecure, childOrigin: precondition.childOrigin, parentOrigin: precondition.parentOrigin };
  try { await waitFor(page, () => game.evaluate(async (element, count) => element.graph.authoring.getSnapshot().state === "complete" && (await element.graph.authoring.listPackages()).length === count, standardDifficulties.length), 120_000, `${row.trust}/${row.kind} import/atomic persistence`); }
  catch (error) { const state = await game.evaluate(async (element) => ({ authoring: element.graph.authoring.getSnapshot(), packages: await element.graph.authoring.listPackages(), collections: await element.graph.authoring.listCollections(), content: element.graph.content.getSnapshot(), audio: element.graph.audio.getStatus(), vendor: element.graph.vendor.snapshot(), lastError: element.lastError, workers: globalThis.__aerobeatWorkerLifecycle })); throw new Error(`${error.message}: ${JSON.stringify({ state, noise, requests })}`, { cause: error }); }
  await waitFor(page, () => game.evaluate((element) => element.graph.content.getSnapshot().state === "error"), 30_000, `${row.trust}/${row.kind} reversed interval rejection`);
  const legacyIntervalBoundary = await game.evaluate(async (element) => { const content = element.graph.content.getSnapshot(); const collection = (await element.graph.authoring.listCollections())[0]; const expertPlus = collection.packages.find((entry) => entry.difficultyId === "ExpertPlus"); if (!expertPlus) throw new Error("4858 ExpertPlus package is unavailable"); await element.requestLibrarySelection(collection.collectionId, expertPlus.packageId); return { initialState: content.state, initialCode: content.error?.code ?? null, selectedPackageId: expertPlus.packageId }; });
  assert.deepEqual({ state: legacyIntervalBoundary.initialState, code: legacyIntervalBoundary.initialCode }, { state: "error", code: "event_interval_invalid" }, "legacy reversed obstacle interval must remain fail-closed");
  await waitFor(page, () => game.evaluate((element) => element.graph.content.getSnapshot().state === "ready" && element.graph.audio.getStatus().state === "ready"), 30_000, `${row.trust}/${row.kind} valid ExpertPlus content/audio`);
  const imported = await game.evaluate(async (element) => { const packages = await element.graph.authoring.listPackages(); const collections = await element.graph.authoring.listCollections(); const content = element.graph.content.getSnapshot(); return { packages: packages.map((item) => ({ packageId: item.packageId, difficulty: item.difficulty })), collections: collections.length, sourceVersionHash: content.lineage.sourceVersionHash, variants: content.variants.length, audio: element.graph.audio.getStatus(), workers: globalThis.__aerobeatWorkerLifecycle }; });
  assert.equal(imported.packages.length, standardDifficulties.length); assert.equal(imported.collections, 1); assert.equal(imported.sourceVersionHash, VERSION_HASH); assert.ok(imported.variants >= 5, `selected valid package lost variants: ${JSON.stringify(imported)}`); assert.equal(imported.audio.state, "ready"); assert.ok(imported.workers.created >= standardDifficulties.length + 1); assert.ok(imported.workers.terminated >= standardDifficulties.length + 1);
  const reconnect = await game.evaluate(async (element, selectedPackageId) => { const parent = element.parentElement; const oldGraph = element.graph; element.remove(); parent.append(element); const deadline = performance.now() + 60_000; while (performance.now() < deadline && (await element.graph.authoring.listPackages()).length === 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25)); const collection = (await element.graph.authoring.listCollections())[0]; await element.requestLibrarySelection(collection.collectionId, selectedPackageId); while (performance.now() < deadline && (element.graph.content.getSnapshot().state !== "ready" || element.graph.audio.getStatus().state !== "ready")) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25)); return { freshGraph: element.graph !== oldGraph, packages: (await element.graph.authoring.listPackages()).length, content: element.graph.content.getSnapshot().state, audio: element.graph.audio.getStatus().state }; }, legacyIntervalBoundary.selectedPackageId);
  assert.deepEqual(reconnect, { freshGraph: true, packages: standardDifficulties.length, content: "ready", audio: "ready" });
  if (row.trust === "insecure" && row.kind === "direct") {
    const chartTamperPackage = await game.evaluate(async (element, selectedPackageId) => { const collection = (await element.graph.authoring.listCollections())[0]; const packageKey = collection.packages.find((entry) => entry.packageId === selectedPackageId).packageKey; const database = await new Promise((resolvePromise, reject) => { const request = indexedDB.open("aerobeat-web-content-authoring", 4); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const value = await new Promise((resolvePromise, reject) => { const request = database.transaction("packages", "readonly").objectStore("packages").get(packageKey); request.onsuccess = () => resolvePromise(request.result.package); request.onerror = () => reject(request.error); }); database.close(); return value; }, legacyIntervalBoundary.selectedPackageId);
    const boxingChart = chartTamperPackage.charts.find((chart) => chart.mode === "boxing"); boxingChart.beats[0].start += 0.000001;
    const chartPackageHash = `sha256:${await sha256Hex(canonicalJsonForTest(chartTamperPackage))}`;
    const mismatchCodes = await game.evaluate(async (element, tamper) => { const selectedPackageId = tamper.selectedPackageId; const database = await new Promise((resolvePromise, reject) => { const request = indexedDB.open("aerobeat-web-content-authoring", 4); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const collection = (await element.graph.authoring.listCollections())[0]; const packageKey = collection.packages.find((entry) => entry.packageId === selectedPackageId).packageKey; const read = (storeName, key) => new Promise((resolvePromise, reject) => { const transaction = database.transaction(storeName, "readonly"); const request = transaction.objectStore(storeName).get(key); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const write = (storeName, value) => new Promise((resolvePromise, reject) => { const transaction = database.transaction(storeName, "readwrite"); transaction.objectStore(storeName).put(value); transaction.oncomplete = () => resolvePromise(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); }); const packageBaseline = await read("packages", packageKey); const assets = await new Promise((resolvePromise, reject) => { const transaction = database.transaction("assets", "readonly"); const request = transaction.objectStore("assets").getAll(); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const assetBaseline = assets[0]; const run = async (mutate, restore) => { await mutate(); let code = null; try { await element.requestLibrarySelection(collection.collectionId, selectedPackageId); } catch (error) { code = error?.code ?? null; } await restore(); await element.requestLibrarySelection(collection.collectionId, selectedPackageId); return code; }; const packageTamper = structuredClone(packageBaseline); packageTamper.package.source.sourceId += "-one-byte"; const packageCode = await run(() => write("packages", packageTamper), () => write("packages", packageBaseline)); const chartTamper = structuredClone(packageBaseline); chartTamper.package = tamper.chartPackage; chartTamper.packageHash = tamper.chartPackageHash; const chartCode = await run(() => write("packages", chartTamper), () => write("packages", packageBaseline)); const assetTamper = structuredClone(assetBaseline); assetTamper.bytes[0] ^= 1; const assetCode = await run(() => write("assets", assetTamper), () => write("assets", assetBaseline)); database.close(); return { packageCode, chartCode, assetCode }; }, { selectedPackageId: legacyIntervalBoundary.selectedPackageId, chartPackage: chartTamperPackage, chartPackageHash });
    assert.deepEqual(mismatchCodes, { packageCode: "export_package_hash_mismatch", chartCode: "chart_hash_mismatch", assetCode: "audio_declaration_mismatch" });
  }
  const presentations = await game.evaluate((element) => { const variants = element.graph.content.getSnapshot().variants; for (const key of ["flow_grid_v2", "boxing_semantic_track_v1", "boxing_spatial_grid_v1"]) if (!variants.some((entry) => entry.rulesetId === key)) throw new Error(`missing ${key}`); const base = element.rendererFrame(); return ["flow", "boxing_lanes", "boxing_spatial_grid"].map((presentation) => { element.graph.renderer.renderGameplayFrame({ ...base, presentation, targets: [], blockedCells: presentation === "boxing_spatial_grid" ? [] : undefined }); return presentation; }); });
  assert.deepEqual(presentations, ["flow", "boxing_lanes", "boxing_spatial_grid"]);
  const environments = await game.evaluate(async (element) => { const select = element.shadowRoot.querySelector("select[data-action='environment-asset-select']"); const states = []; for (const option of select.options) { element.selectEnvironment(option.value); const deadline = performance.now() + 30_000; while (performance.now() < deadline && element.graph.renderer.describe().environment.state === "loading") await new Promise((resolvePromise) => setTimeout(resolvePromise, 25)); const state = element.graph.renderer.describe().environment; states.push({ id: option.value, state: state.state, fallback: state.fallback, count: state.count }); } return states; });
  assert.equal(environments.length, 8); assert.ok(environments.every((entry) => entry.state === "ready" && entry.fallback === false && entry.count === 1), JSON.stringify(environments));
  await game.locator("aero-session-actions button[data-intent='session-test']").click();
  await waitFor(page, () => game.evaluate((element) => element.graph.audio.getStatus().state === "playing" && element.graph.gameplay.getSnapshot().session.purpose === "visual_test"), 30_000, `${row.trust}/${row.kind} Test playback`);
  const exportDelete = await game.evaluate(async (element) => { await element.stop(); const packages = await element.graph.authoring.listPackages(); const first = packages[0]; const one = await element.graph.authoring.exportPackage(first); const two = await element.graph.authoring.exportPackage(first); let equal = one.bytes.byteLength === two.bytes.byteLength; for (let index = 0; equal && index < one.bytes.byteLength; index += 1) equal = one.bytes[index] === two.bytes[index]; await element.exportLibraryPackage({ packageKey: first.key, packageId: first.packageId }); const collections = await element.graph.authoring.listCollections(); await element.deleteLibraryCollection(collections[0].collectionId); const database = await new Promise((resolvePromise, reject) => { const request = indexedDB.open("aerobeat-web-content-authoring", 4); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const transaction = database.transaction(["packages", "collections", "assets"], "readonly"); const idb = Object.fromEntries(await Promise.all(["packages", "collections", "assets"].map((name) => new Promise((resolvePromise, reject) => { const request = transaction.objectStore(name).count(); request.onsuccess = () => resolvePromise([name, request.result]); request.onerror = () => reject(request.error); })))); database.close(); return { equal, bytes: one.bytes.byteLength, packages: (await element.graph.authoring.listPackages()).length, collections: (await element.graph.authoring.listCollections()).length, idb, cameraRequests: globalThis.__aerobeatCameraRequests, urls: globalThis.__aerobeatObjectUrls }; });
  assert.equal(exportDelete.equal, true); assert.ok(exportDelete.bytes > 0); assert.equal(exportDelete.packages, 0); assert.equal(exportDelete.collections, 0); assert.deepEqual(exportDelete.idb, { packages: 0, collections: 0, assets: 0 }); assert.equal(exportDelete.cameraRequests, 0); assert.ok(exportDelete.urls.created >= 1 && exportDelete.urls.revoked >= 1);
  if (row.trust === "insecure" && row.kind === "direct") {
    const cancellation = await game.evaluate(async (element) => { const bytes = new Uint8Array(await (await fetch("/__fixture/4858.zip")).arrayBuffer()); const pending = element.importLocalZip(bytes, { sourceId: "4858-cancel" }).then(() => ({ completed: true }), (error) => ({ completed: false, code: error?.code })); const deadline = performance.now() + 30_000; while (performance.now() < deadline && !["converting", "persisting"].includes(element.graph.authoring.getSnapshot().state)) await new Promise((resolvePromise) => setTimeout(resolvePromise, 0)); const requested = element.cancelImport(); const outcome = await pending; const database = await new Promise((resolvePromise, reject) => { const request = indexedDB.open("aerobeat-web-content-authoring", 4); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const transaction = database.transaction(["packages", "collections", "assets"], "readonly"); const idb = Object.fromEntries(await Promise.all(["packages", "collections", "assets"].map((name) => new Promise((resolvePromise, reject) => { const request = transaction.objectStore(name).count(); request.onsuccess = () => resolvePromise([name, request.result]); request.onerror = () => reject(request.error); })))); database.close(); return { requested, outcome, state: element.graph.authoring.getSnapshot().state, packages: (await element.graph.authoring.listPackages()).length, collections: (await element.graph.authoring.listCollections()).length, idb }; });
    assert.equal(cancellation.requested, true); assert.deepEqual(cancellation.outcome, { completed: false, code: "operation_aborted" }); assert.equal(cancellation.state, "cancelled"); assert.equal(cancellation.packages, 0); assert.equal(cancellation.collections, 0); assert.deepEqual(cancellation.idb, { packages: 0, collections: 0, assets: 0 });
  }
  if (row.trust === "insecure" && row.kind === "direct") {
    tamperAssetKind = "glb"; await game.evaluate((element) => { const parent = element.parentElement; element.remove(); parent.append(element); });
    await waitFor(page, () => game.evaluate((element) => element.graph.renderer.describe().gameplayAssets.state === "error"), 30_000, "one-byte GLB rejection");
    assert.ok(requests.some((entry) => entry.startsWith("tamper:glb:")));
    tamperAssetKind = "jpeg"; await game.evaluate((element) => { const parent = element.parentElement; element.remove(); parent.append(element); });
    await waitFor(page, () => game.evaluate((element) => element.graph.renderer.describe().environment.state === "error"), 30_000, "one-byte JPEG rejection");
    assert.ok(requests.some((entry) => entry.startsWith("tamper:jpeg:")));
  }
  const cleanup = await game.evaluate(async (element) => { element.remove(); await new Promise((resolvePromise) => setTimeout(resolvePromise, 0)); return { workers: globalThis.__aerobeatWorkerLifecycle, urls: globalThis.__aerobeatObjectUrls }; });
  assert.ok(cleanup.workers.terminated >= cleanup.workers.created); assert.ok(cleanup.urls.revoked >= cleanup.urls.created);
  assert.deepEqual(noise, [], `${row.trust}/${row.kind} emitted noise:\n${noise.join("\n")}`);
  assert.ok(requests.some((entry) => entry.includes("/maps/latest"))); assert.ok(requests.some((entry) => entry.includes("/search/text/")));
  if (row.importKind === "remote") assert.ok(requests.includes("fixture:/4858.zip"));
  await context.close();
  return { trust: row.trust, kind: row.kind, importKind: row.importKind, secure: expectedSecure, childOrigin: precondition.childOrigin, parentOrigin: precondition.parentOrigin };
}

/** @param {unknown} value */
function canonicalJsonForTest(value) { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("Non-finite test value"); return JSON.stringify(Object.is(value, -0) ? 0 : value); } if (Array.isArray(value)) return `[${value.map(canonicalJsonForTest).join(",")}]`; if (typeof value !== "object") throw new TypeError("Non-data test value"); return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonForTest(Object.getOwnPropertyDescriptor(value, key)?.value)}`).join(",")}}`; }
function providerMap(info, difficulties) { return { id: "4858", name: info.songName, description: "Deterministic local 4858 integration fixture", tags: ["balanced"], metadata: { songName: info.songName, songSubName: "", songAuthorName: info.songAuthorName, levelAuthorName: info.levelAuthorName, bpm: info.bpm, duration: 120 }, uploader: { id: 1, name: "Local fixture", avatar: "https://cdn.example.invalid/avatar.png" }, stats: { downloads: 1, plays: 1, upvotes: 1, downvotes: 0, score: 1 }, versions: [{ hash: VERSION_HASH, key: "4858", state: "Published", createdAt: "2026-01-01T00:00:00Z", downloadURL: "https://cdn.example.invalid/4858.zip", coverURL: "https://cdn.example.invalid/cover.png", previewURL: "https://cdn.example.invalid/preview.ogg", diffs: difficulties.map((entry, index) => ({ characteristic: "Standard", difficulty: entry.difficulty, notes: index + 1, bombs: 0, obstacles: 0, njs: 10, nps: 1, seconds: 120 })) }], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", uploaded: "2026-01-01T00:00:00Z", ranked: false, qualified: false, automapper: false, declaredAi: false }; }
function findTailscaleIp() { for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) if (entry.family === "IPv4" && !entry.internal && inTailscaleRange(entry.address)) return entry.address; throw new Error("genuine-non-loopback-unavailable: no RFC6598 Tailscale IPv4 interface"); }
function inTailscaleRange(value) { const parts = value.split(".").map(Number); return parts.length === 4 && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255); }
async function firstReadable(paths) { for (const path of paths) try { const info = await stat(path); if (info.isFile()) return path; } catch {} throw new Error("missing-local-fixture: 4858 exact archive is required for assembly integration"); }
function listen(server) { return new Promise((resolvePromise, reject) => { server.once("error", reject); server.listen(0, "0.0.0.0", () => { server.off("error", reject); resolvePromise(); }); }); }
function port(server) { const address = server.address(); if (!address || typeof address === "string") throw new Error("HTTP server address unavailable"); return address.port; }
function close(server) { return new Promise((resolvePromise) => { if (!server?.listening) { resolvePromise(); return; } server.close(() => resolvePromise()); }); }
function send(response, status, body, contentType) { response.statusCode = status; response.setHeader("content-type", contentType); response.setHeader("cache-control", "no-store"); response.end(body); }
function mime(path) { return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".map": "application/json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg" })[extname(path)] ?? "application/octet-stream"; }
async function waitFor(page, predicate, timeoutMs, label) { const started = Date.now(); while (Date.now() - started < timeoutMs) { if (await predicate()) return; await page.waitForTimeout(50); } throw new Error(`Timed out waiting for ${label}`); }
