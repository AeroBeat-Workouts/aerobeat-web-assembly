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
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

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
  const expectedPageUrl = origin.child;
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
  page.on("console", (message) => { const type = message.type(); const text = message.text(); const location = message.location(); if (["warning", "error"].includes(type) && !isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, expectedPageUrl) && !isExpectedPlaycanvasMeshWarning(type,text)) noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`); });
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
  const raw = await game.evaluate(async (element) => { const bytes = new Uint8Array(await (await fetch("/__fixture/4858.zip")).arrayBuffer()); const acquired = await element.graph.vendor.importLocalArchive(bytes); return { archiveSha1: acquired.archiveSha1, sourceHash: acquired.sourceHash, infoFormatMajor: acquired.source.manifest.infoFormatMajor,beatMapFormatMajors:acquired.source.manifest.difficulties.map((entry)=>entry.beatMapFormatMajor) }; });
  assert.equal(raw.archiveSha1, fixtureRawSha1); assert.equal(raw.sourceHash, VERSION_HASH); assert.equal(raw.infoFormatMajor,2);assert.deepEqual(raw.beatMapFormatMajors,[2,2,2]);
  await game.evaluate((element) => element.browseLatestBeatSaver({ pageSize: 1 }));
  await game.evaluate((element) => element.browseBeatSaver({ text: "4858", pageSize: 1 }));
  // t7sv W2b rebaseline: the 4858 fixture's legacy v2 `_type:1` END-marker
  // obstacles were the original "malformed" input this oracle pinned for an
  // atomic `obstacle_duration_invalid` rejection (the pre-fix parser treated
  // every END marker as an independent obstacle and its negative duration
  // tripped strict validation). After W1-A's t7sv fix (`3a4af13`) those END
  // markers are skipped at parse, so the archive now imports cleanly to all
  // Standard difficulties. The hash/integration assertions below remain intact;
  // only the rejection expectation is replaced by a valid-import expectation.
  // Node-side probe against the SAME parser module the browser uses (both rows
  // share the exact node_modules resolution). The three inputs below MUST still
  // be rejected under the post-t7sv parser — keeping the rejection coverage
  // meaningful now that the 4858 END markers are legal:
  // (a) a v2 START entry with a negative _duration (the same value 4858 carries,
  //     but on a real START entry which is no longer skipped);
  // (b) a v4 metadata x out of bounds (x=4 > grid width 4-1);
  // (c) a v4 entry-level geometry field conflicting with obstaclesData.
  const { parseBeatMapDifficulty } = await import("@aerobeat/web-content-authoring");
  const v2NegativeDurationStart = JSON.stringify({ _version: "2.0.0", _notes: [], _obstacles: [{ _time: 83.75, _lineIndex: 3, _type: 0, _duration: -0.25, _width: 1 }] });
  const v4OutOfBoundsX = JSON.stringify({ obstacles: [{ b: 1, i: 0 }], obstaclesData: [{ d: 1, x: 4, y: 0, w: 1, h: 1 }] });
  const v4MetadataConflict = JSON.stringify({ obstacles: [{ b: 1, i: 0, w: 1 }], obstaclesData: [{ d: 1, x: 0, y: 0, w: 1, h: 1 }] });
  const codeOf = (document, format) => { try { parseBeatMapDifficulty(document, format); return null; } catch (error) { return error?.code ?? null; } };
  const rejectionCoverage = {
    v2NegativeDurationStart: codeOf(v2NegativeDurationStart, "v2"),
    v4OutOfBoundsX: codeOf(v4OutOfBoundsX, "v4"),
    v4MetadataConflict: codeOf(v4MetadataConflict, "v4")
  };
  assert.deepEqual(rejectionCoverage, {
    v2NegativeDurationStart: "obstacle_duration_invalid",
    v4OutOfBoundsX: "obstacle_geometry_invalid",
    v4MetadataConflict: "obstacle_geometry_conflict"
  }, `post-t7sv strict normalization must still reject genuinely malformed inputs: ${JSON.stringify(rejectionCoverage)}`);
  if (row.importKind === "remote") {
    const selected = await game.evaluate((element) => { const ui = element.shadowRoot.querySelector("aero-beatsaver-browser"); const button = ui.shadowRoot.querySelector("button[data-intent='beatsaver-import']"); const radio = ui.shadowRoot.querySelector("input[type='radio']:checked"); button.click(); return { radio: radio?.value, disabled: button.disabled }; });
    assert.deepEqual(selected, { radio: "4858", disabled: false });
  } else {
    // t7sv W2b rebaseline: the pre-fix oracle pinned a rejected `obstacle_duration_invalid`
    // for this local import (the 4858 END markers tripped strict validation). Post-t7sv
    // those END markers are skipped at parse, so the same import must now COMPLETE —
    // the rejection coverage is carried by the node-side probe above.
    const localResult = await game.evaluate(async (element) => { const bytes = new Uint8Array(await (await fetch("/__fixture/4858.zip")).arrayBuffer()); try { await element.importLocalZip(new Blob([bytes], { type: "application/zip" }), { sourceId: "4858-local" }); return { accepted: true }; } catch (error) { return { accepted: false, code: error?.code, message: error?.message }; } });
    assert.equal(localResult.accepted, true, `post-t7sv local import of 4858 must be accepted (was rejected as obstacle_duration_invalid pre-fix): ${JSON.stringify(localResult)}`);
  }
  try { await waitFor(page, () => game.evaluate(async (element, count) => element.graph.authoring.getSnapshot().state === "complete" && (await element.graph.authoring.listPackages()).length === count, standardDifficulties.length), 120_000, `${row.trust}/${row.kind} import/atomic persistence`); }
  catch (error) { const state = await game.evaluate(async (element) => ({ authoring: element.graph.authoring.getSnapshot(), packages: await element.graph.authoring.listPackages(), collections: await element.graph.authoring.listCollections(), content: element.graph.content.getSnapshot(), audio: element.graph.audio.getStatus(), vendor: element.graph.vendor.snapshot(), lastError: element.lastError, workers: globalThis.__aerobeatWorkerLifecycle })); throw new Error(`${error.message}: ${JSON.stringify({ state, noise, requests })}`, { cause: error }); }
  // t7sv W2b rebaseline: the ExpertPlus content used to land in `error` with
  // `event_interval_invalid` because the pre-fix parser turned orphaned END
  // markers into zero/negative-duration obstacle intervals. Post-t7sv those
  // entries are skipped, so selecting ExpertPlus must land directly in `ready`.
  const legacyIntervalBoundary = await game.evaluate(async (element) => { const collection = (await element.graph.authoring.listCollections())[0]; const expertPlus = collection.packages.find((entry) => entry.difficultyId === "ExpertPlus"); if (!expertPlus) throw new Error("4858 ExpertPlus package is unavailable"); await element.requestLibrarySelection(collection.collectionId, expertPlus.packageId); const deadline = performance.now() + 30_000; while (performance.now() < deadline && element.graph.content.getSnapshot().state !== "ready") await new Promise((resolvePromise) => setTimeout(resolvePromise, 25)); return { initialState: element.graph.content.getSnapshot().state, initialCode: element.graph.content.getSnapshot().error?.code ?? null, selectedPackageId: expertPlus.packageId }; });
  assert.deepEqual({ state: legacyIntervalBoundary.initialState, code: legacyIntervalBoundary.initialCode }, { state: "ready", code: null }, "post-t7sv ExpertPlus selection must land directly in ready (no event_interval_invalid)");
  await waitFor(page, () => game.evaluate((element) => element.graph.content.getSnapshot().state === "ready" && element.graph.audio.getStatus().state === "ready"), 30_000, `${row.trust}/${row.kind} valid ExpertPlus content/audio`);
  const imported = await game.evaluate(async (element) => { const packages = await element.graph.authoring.listPackages(); const collections = await element.graph.authoring.listCollections(); const content = element.graph.content.getSnapshot(); return { packages: packages.map((item) => ({ packageId: item.packageId, difficulty: item.difficulty })), collections: collections.length, sourceVersionHash: content.lineage.sourceVersionHash, variants: content.variants.length, audio: element.graph.audio.getStatus(), workers: globalThis.__aerobeatWorkerLifecycle }; });
  assert.equal(imported.packages.length, standardDifficulties.length); assert.equal(imported.collections, 1); assert.equal(imported.sourceVersionHash, VERSION_HASH); assert.ok(imported.variants === 2 || imported.variants >= 5, `selected valid package lost variants (W1-A new shape = 2, legacy stored = 5): ${JSON.stringify(imported)}`); assert.equal(imported.audio.state, "ready"); assert.ok(imported.workers.created >= standardDifficulties.length + 1); assert.ok(imported.workers.terminated >= standardDifficulties.length + 1);
  const reconnect = await game.evaluate(async (element, selectedPackageId) => { const parent = element.parentElement; const oldGraph = element.graph; element.remove(); parent.append(element); const deadline = performance.now() + 60_000; while (performance.now() < deadline && (await element.graph.authoring.listPackages()).length === 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25)); const collection = (await element.graph.authoring.listCollections())[0]; await element.requestLibrarySelection(collection.collectionId, selectedPackageId); while (performance.now() < deadline && (element.graph.content.getSnapshot().state !== "ready" || element.graph.audio.getStatus().state !== "ready")) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25)); return { freshGraph: element.graph !== oldGraph, packages: (await element.graph.authoring.listPackages()).length, content: element.graph.content.getSnapshot().state, audio: element.graph.audio.getStatus().state }; }, legacyIntervalBoundary.selectedPackageId);
  assert.deepEqual(reconnect, { freshGraph: true, packages: standardDifficulties.length, content: "ready", audio: "ready" });
  if (row.trust === "insecure" && row.kind === "direct") {
    const chartTamperPackage = await game.evaluate(async (element, selectedPackageId) => { const collection = (await element.graph.authoring.listCollections())[0]; const packageKey = collection.packages.find((entry) => entry.packageId === selectedPackageId).packageKey; const database = await new Promise((resolvePromise, reject) => { const request = indexedDB.open("aerobeat-web-content-authoring", 8); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const value = await new Promise((resolvePromise, reject) => { const request = database.transaction("packages", "readonly").objectStore("packages").get(packageKey); request.onsuccess = () => resolvePromise(request.result.package); request.onerror = () => reject(request.error); }); database.close(); return value; }, legacyIntervalBoundary.selectedPackageId);
    const boxingChart = chartTamperPackage.charts.find((chart) => chart.mode === "boxing"); boxingChart.beats[0].start += 0.000001;
    const chartPackageHash = `sha256:${await sha256Hex(canonicalJsonForTest(chartTamperPackage))}`;
    const mismatchCodes = await game.evaluate(async (element, tamper) => { const selectedPackageId = tamper.selectedPackageId; const database = await new Promise((resolvePromise, reject) => { const request = indexedDB.open("aerobeat-web-content-authoring", 8); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const collection = (await element.graph.authoring.listCollections())[0]; const packageKey = collection.packages.find((entry) => entry.packageId === selectedPackageId).packageKey; const read = (storeName, key) => new Promise((resolvePromise, reject) => { const transaction = database.transaction(storeName, "readonly"); const request = transaction.objectStore(storeName).get(key); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const write = (storeName, value) => new Promise((resolvePromise, reject) => { const transaction = database.transaction(storeName, "readwrite"); transaction.objectStore(storeName).put(value); transaction.oncomplete = () => resolvePromise(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); }); const packageBaseline = await read("packages", packageKey); const assets = await new Promise((resolvePromise, reject) => { const transaction = database.transaction("assets", "readonly"); const request = transaction.objectStore("assets").getAll(); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const assetBaseline = assets[0]; const run = async (mutate, restore) => { await mutate(); let code = null; try { await element.requestLibrarySelection(collection.collectionId, selectedPackageId); } catch (error) { code = error?.code ?? null; } await restore(); await element.requestLibrarySelection(collection.collectionId, selectedPackageId); return code; }; const packageTamper = structuredClone(packageBaseline); packageTamper.package.source.sourceId += "-one-byte"; const packageCode = await run(() => write("packages", packageTamper), () => write("packages", packageBaseline)); const chartTamper = structuredClone(packageBaseline); chartTamper.package = tamper.chartPackage; chartTamper.packageHash = tamper.chartPackageHash; const chartCode = await run(() => write("packages", chartTamper), () => write("packages", packageBaseline)); const assetTamper = structuredClone(assetBaseline); assetTamper.bytes[0] ^= 1; const assetCode = await run(() => write("assets", assetTamper), () => write("assets", assetBaseline)); database.close(); return { packageCode, chartCode, assetCode }; }, { selectedPackageId: legacyIntervalBoundary.selectedPackageId, chartPackage: chartTamperPackage, chartPackageHash });
    assert.deepEqual(mismatchCodes, { packageCode: "export_package_hash_mismatch", chartCode: "chart_hash_mismatch", assetCode: "audio_declaration_mismatch" });
  }
  const presentations = await game.evaluate((element) => {
    const variantRulesets = element.graph.content.getSnapshot().variants.map((entry) => entry.rulesetId);
    if (!variantRulesets.includes("flow_colliders_v1")) throw new Error("missing flow_colliders_v1");
    // 0.0.54 W1-A rebaseline: fresh imports carry the sole no-recipe boxing collider variant; legacy stored packages keep the Lanes/Grid pair.
    const hasLegacyBoxing = variantRulesets.includes("boxing_semantic_track_v1") && variantRulesets.includes("boxing_spatial_grid_v1");
    if (hasLegacyBoxing) { for (const key of ["boxing_semantic_track_v1", "boxing_spatial_grid_v1"]) if (!variantRulesets.includes(key)) throw new Error(`missing ${key}`); }
    else { if (!variantRulesets.includes("boxing_collider_v1")) throw new Error("missing boxing_collider_v1"); }
    const base = element.rendererFrame(); const order = hasLegacyBoxing ? ["flow", "boxing_lanes", "boxing_spatial_grid"] : ["flow", "boxing_collider"];
    return order.map((presentation) => { element.graph.renderer.renderGameplayFrame({ ...base, presentation, targets: [], blockedCells: presentation === "boxing_spatial_grid" ? [] : undefined }); return presentation; });
  });
  assert.ok(JSON.stringify(presentations)===JSON.stringify(["flow","boxing_lanes","boxing_spatial_grid"])||JSON.stringify(presentations)===JSON.stringify(["flow","boxing_collider"]),`presentation sweep must match the package shape: ${JSON.stringify(presentations)}`);
  const environments = await game.evaluate(async (element) => { const select = element.shadowRoot.querySelector("select[data-action='environment-asset-select']"); const states = []; for (const option of select.options) { element.selectEnvironment(option.value); const deadline = performance.now() + 30_000; while (performance.now() < deadline && element.graph.renderer.describe().environment.state === "loading") await new Promise((resolvePromise) => setTimeout(resolvePromise, 25)); const state = element.graph.renderer.describe().environment; states.push({ id: option.value, state: state.state, fallback: state.fallback, count: state.count }); } return states; });
  assert.equal(environments.length, 8); assert.ok(environments.every((entry) => entry.state === "ready" && entry.fallback === false && entry.count === 1), JSON.stringify(environments));
  await game.locator("aero-session-actions button[data-intent='session-test']").click();
  await waitFor(page, () => game.evaluate((element) => element.graph.audio.getStatus().state === "playing" && element.graph.gameplay.getSnapshot().session.purpose === "visual_test"), 30_000, `${row.trust}/${row.kind} Test playback`);
  const exportDelete = await game.evaluate(async (element) => { await element.stop(); const packages = await element.graph.authoring.listPackages(); const first = packages[0]; const one = await element.graph.authoring.exportPackage(first); const two = await element.graph.authoring.exportPackage(first); let equal = one.bytes.byteLength === two.bytes.byteLength; for (let index = 0; equal && index < one.bytes.byteLength; index += 1) equal = one.bytes[index] === two.bytes[index]; await element.exportLibraryPackage({ packageKey: first.key, packageId: first.packageId }); const collections = await element.graph.authoring.listCollections(); await element.deleteLibraryCollection(collections[0].collectionId); const database = await new Promise((resolvePromise, reject) => { const request = indexedDB.open("aerobeat-web-content-authoring", 8); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const transaction = database.transaction(["packages", "collections", "assets"], "readonly"); const idb = Object.fromEntries(await Promise.all(["packages", "collections", "assets"].map((name) => new Promise((resolvePromise, reject) => { const request = transaction.objectStore(name).count(); request.onsuccess = () => resolvePromise([name, request.result]); request.onerror = () => reject(request.error); })))); database.close(); return { equal, bytes: one.bytes.byteLength, packages: (await element.graph.authoring.listPackages()).length, collections: (await element.graph.authoring.listCollections()).length, idb, cameraRequests: globalThis.__aerobeatCameraRequests, urls: globalThis.__aerobeatObjectUrls }; });
  assert.equal(exportDelete.equal, true); assert.ok(exportDelete.bytes > 0); assert.equal(exportDelete.packages, 0); assert.equal(exportDelete.collections, 0); assert.deepEqual(exportDelete.idb, { packages: 0, collections: 0, assets: 0 }); assert.equal(exportDelete.cameraRequests, 0); assert.ok(exportDelete.urls.created >= 1 && exportDelete.urls.revoked >= 1);
  if (row.trust === "insecure" && row.kind === "direct") {
    // Cancellation coverage: fire cancelImport IMMEDIATELY after kicking off
    // the import (no polling) so the cancel races the convert worker. On a
    // fast machine the import may complete before the cancel lands — accept
    // either outcome but verify the post-condition in both branches:
    //   - if cancelled: state=cancelled, no packages/collections/assets
    //   - if completed: state=complete, all difficulties persisted
    const cancellation = await game.evaluate(async (element) => { const bytes = new Uint8Array(await (await fetch("/__fixture/4858.zip")).arrayBuffer()); const pending = element.importLocalZip(bytes, { sourceId: "4858-cancel" }).then(() => ({ completed: true }), (error) => ({ completed: false, code: error?.code })); const requested = element.cancelImport(); const outcome = await pending; const database = await new Promise((resolvePromise, reject) => { const request = indexedDB.open("aerobeat-web-content-authoring", 8); request.onsuccess = () => resolvePromise(request.result); request.onerror = () => reject(request.error); }); const transaction = database.transaction(["packages", "collections", "assets"], "readonly"); const idb = Object.fromEntries(await Promise.all(["packages", "collections", "assets"].map((name) => new Promise((resolvePromise, reject) => { const request = transaction.objectStore(name).count(); request.onsuccess = () => resolvePromise([name, request.result]); request.onerror = () => reject(request.error); })))); database.close(); return { requested, outcome, state: element.graph.authoring.getSnapshot().state, packages: (await element.graph.authoring.listPackages()).length, collections: (await element.graph.authoring.listCollections()).length, idb }; });
    // cancelImport returns true only if it actually aborted a live job; on a
    // fast machine the import may already be settled, in which case it returns
    // false and the outcome reflects a clean completion. Both branches are valid.
    if (cancellation.outcome.completed === false) {
      assert.equal(cancellation.requested, true, "cancelled import must have been accepted by cancelImport");
      assert.equal(cancellation.outcome.code, "operation_aborted", "cancelled import must report operation_aborted");
      assert.equal(cancellation.state, "cancelled");
      assert.deepEqual(cancellation.idb, { packages: 0, collections: 0, assets: 0 }, "cancelled import must persist nothing");
    } else {
      assert.equal(cancellation.state, "complete", "fast-import branch: import must have completed");
      assert.ok(cancellation.packages >= standardDifficulties.length, "fast-import branch: completed import must persist its packages");
      assert.ok(cancellation.collections >= 1, "fast-import branch: completed import must persist its collection");
    }
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
