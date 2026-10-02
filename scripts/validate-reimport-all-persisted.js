// @ts-check
// Real IndexedDB BeatSaver collection, imported and reimported from a local hash-verified ZIP.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const mapId = "54510";
const versionHash = "f5c04797fe0831741adec66ce5386971153919d4";
const archive = await readFile(`/tmp/aerobeat-${mapId}-${versionHash}.zip`);
assert.equal(createHash("sha256").update(archive).digest("hex"), "0dc3f98537c679cb8e96ffc5d079a1e0cbb9ae59df571f693a67a53c5d051db3");
const vite = await createViteServer({ appType: "spa", configFile: false, logLevel: "error", define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("local-browser-regression"), __AEROBEAT_CACHE_BUST__: JSON.stringify("local-browser-regression"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("0.0.88") }, server: { host: "127.0.0.1", port: 0, hmr: false, watch: null, fs: { allow: [new URL("../../", import.meta.url).pathname] } } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0];
  assert.ok(url);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/__reimport_fixture_54510.zip", (route) => route.fulfill({ status: 200, contentType: "application/zip", body: archive }));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof document.querySelector("aero-game")?.reimportAllLibraryCollections === "function");
  const game = page.locator("aero-game");
  const evidence = await game.evaluate(async (element, { mapId, versionHash }) => {
    const graph = element.graph;
    if (typeof graph.authoring.getCollectionReimportSource !== "function") throw new Error("Real authoring reimport accessor unavailable");
    const response = await fetch("/__reimport_fixture_54510.zip");
    if (!response.ok) throw new Error("Fixture route unavailable");
    const acquired = await graph.vendor.importLocalArchive(new Uint8Array(await response.arrayBuffer()));
    if (acquired.sourceHash !== versionHash) throw new Error(`Wrong real source hash ${acquired.sourceHash}`);
    const authored = await graph.authoring.convertAllStandardAndPersist(acquired.source, { sourceProvider: "beatsaver", sourceId: mapId, sourceVersionHash: versionHash, includeAudio: true, cacheSourceEntries: true });
    const id = authored.collection.collectionId;
    const before = await graph.authoring.listCollections();
    const summary = before.find((collection) => collection.collectionId === id);
    const source = await graph.authoring.getCollectionReimportSource(id);
    const originalGet = graph.vendor.getMapById;
    const originalAcquire = graph.vendor.acquireVersion;
    const getCalls = [], acquireCalls = [];
    let conversionCalls = 0;
    const authoring = Object.freeze({ ...graph.authoring, async convertAllStandardAndPersist(...args) { conversionCalls += 1; return graph.authoring.convertAllStandardAndPersist(...args); } });
    element.graph = Object.freeze({ ...graph, authoring });
    const map = { mapId, versions: [{ hash: versionHash, downloadUrl: "http://127.0.0.1/never-fetch.zip" }] };
    graph.vendor.getMapById = async (requestedId) => { getCalls.push(requestedId); return map; };
    graph.vendor.acquireVersion = async (requestedMap, requestedHash) => {
      acquireCalls.push({ mapId: requestedMap.mapId, hash: requestedHash });
      if (requestedMap.mapId !== mapId || requestedHash !== versionHash) throw new Error("Unexpected provider source");
      return Object.freeze({ providerId: "beatsaver", map, version: map.versions[0], sourceHash: acquired.sourceHash, archiveSha1: acquired.archiveSha1, source: acquired.source });
    };
    let outcome;
    try {
      const result = await element.reimportAllLibraryCollections();
      const after = await graph.authoring.listCollections();
      const library = element.shadowRoot.querySelector("aero-content-library");
      outcome = { result, after: after.map((entry) => ({ collectionId: entry.collectionId, packages: entry.packages.length })), status: element.bulkReimport, visible: library.shadowRoot.textContent, presenter: JSON.stringify(library.presenterSnapshot), getCalls, acquireCalls, conversionCalls, authoringState: graph.authoring.getSnapshot().state };
    } finally {
      element.graph = graph;
      graph.vendor.getMapById = originalGet;
      graph.vendor.acquireVersion = originalAcquire;
    }
    return { id, sourceHash: acquired.sourceHash, authoredPackages: authored.packages.length, summary, source, ...outcome };
  }, { mapId, versionHash });
  assert.equal(evidence.sourceHash, versionHash);
  assert.ok(evidence.authoredPackages >= 1, "real Worker must author Standard difficulties");
  assert.ok(evidence.summary);
  for (const field of ["sourceProvider", "sourceId", "sourceVersionHash"]) assert.equal(Object.hasOwn(evidence.summary, field), false, `public collection leaked ${field}`);
  assert.deepEqual(evidence.source, { collectionId: evidence.id, sourceProvider: "beatsaver", sourceId: mapId, sourceVersionHash: versionHash });
  assert.deepEqual(Object.keys(evidence.source).sort(), ["collectionId", "sourceId", "sourceProvider", "sourceVersionHash"].sort());
  assert.deepEqual(evidence.getCalls, [mapId]);
  assert.deepEqual(evidence.acquireCalls, [{ mapId, hash: versionHash }]);
  assert.equal(evidence.conversionCalls, 1, "reimport must call the real authoring converter once");
  assert.equal(evidence.authoringState, "complete", "real Worker reimport must finish");
  assert.equal(evidence.result.reimported.length, 1, `real reimport evidence: ${JSON.stringify(evidence)}`);
  assert.deepEqual([evidence.status.state, evidence.status.reimported, evidence.status.skipped, evidence.status.failed], ["complete", 1, 0, 0]);
  assert.ok(evidence.after.some((entry) => entry.collectionId === evidence.id && entry.packages === evidence.authoredPackages), "real collection must remain persisted after reimport");
  assert.match(evidence.visible, /1 reimported, 0 skipped, 0 failed/u);
  assert.doesNotMatch(evidence.presenter, /"sourceProvider"|"sourceId"|"sourceVersionHash"|"archiveSha1"|"sourceCache"/u);
  assert.deepEqual(errors, [], `browser errors: ${JSON.stringify(errors)}`);
  console.log(`Persisted Reimport All browser proof passed: ${mapId}/${versionHash}, ${evidence.authoredPackages} real packages, vendor calls=1, visible 1/0/0, no presenter provenance.`);
  await context.close();
} finally {
  await browser?.close();
  await vite.close();
}
