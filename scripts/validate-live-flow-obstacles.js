// @ts-check

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const mapId = "3C9D";
const versionHash = "5662f64a12c76a3dd11a5f6ee22611608cd06760";
const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", optimizeDeps: { force: true }, server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const pageUrl = vite.resolvedUrls?.local?.[0];
if (!pageUrl) throw new Error("Vite URL unavailable");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const noise = [];
page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
await page.addInitScript(() => {
  globalThis.__liveFlowCameraRequests = 0;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { async getUserMedia() { globalThis.__liveFlowCameraRequests += 1; throw new Error("Flow obstacle import must not request camera"); } } });
});
let importedCollectionId;
try {
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  const game = page.locator("aero-game"); await game.waitFor();
  const evidence = await game.evaluate(async (element, fixture) => {
    const map = await element.graph.vendor.getMapById(fixture.mapId, { signal: element.activeAbort.signal });
    const exact = map.versions.find((version) => version.hash === fixture.versionHash);
    if (!exact) throw new Error(`BeatSaver ${fixture.mapId} no longer exposes exact version ${fixture.versionHash}`);
    const result = await element.importBeatSaver(map, fixture.versionHash, { difficulty: "Easy", sourceId: fixture.mapId });
    const content = element.graph.content.getSnapshot();
    const obstacles = content.resolvedEvents.filter((event) => event.authoredBeat?.type === "obstacle");
    const { projectSessionTargets } = await import("/src/session-render-projection.js");
    const testTruth = Object.freeze({ session:Object.freeze({ purpose:"visual_test" }), judgements:Object.freeze([]), shadowJudgements:Object.freeze([]), scorePartitions:Object.freeze([]) });
    const proofs = obstacles.map((event) => {
      const before = projectSessionTargets([event], testTruth, event.centerTimestampMs - 2500.001);
      const approach = projectSessionTargets([event], testTruth, event.centerTimestampMs - 2500);
      const active = projectSessionTargets([event], testTruth, (event.centerTimestampMs + event.endTimestampMs) / 2);
      const after = projectSessionTargets([event], testTruth, event.endTimestampMs + 0.001);
      const rendered = element.graph.renderer.renderGameplayFrame({ presentation:"flow", nowMs:(event.centerTimestampMs + event.endTimestampMs) / 2, timingWindowBeforeMs:180, timingWindowAfterMs:180, overlay:"none", targets:active });
      const volumes = rendered.model.objects.filter((object) => object.targetId === event.eventId && object.kind === "obstacle");
      return { eventId:event.eventId, cells:[...event.authoredBeat.cells], startMs:event.centerTimestampMs, endMs:event.endTimestampMs, durationMs:event.endTimestampMs-event.centerTimestampMs, before:before.length, approach:approach.length, active:active.length, after:after.length, volumeCount:volumes.length, intervalStarts:[...new Set(volumes.map((object) => object.intervalStartMs))], intervalEnds:[...new Set(volumes.map((object) => object.intervalEndMs))], rowPositions:[...new Set(volumes.map((object) => object.position.y))], judgements:active.map((target) => target.judgement) };
    });
    return { collectionId:result.collection.collectionId, selectedPackageId:content.packageId, selectedVariantId:content.selectedVariant?.variantId, selectedChartId:content.selectedVariant?.chartId, obstacleCount:obstacles.length, proofs, cameraRequests:globalThis.__liveFlowCameraRequests };
  }, { mapId, versionHash });
  importedCollectionId = evidence.collectionId;
  assert.equal(evidence.obstacleCount, 16);
  assert.match(String(evidence.selectedVariantId), /flow-easy$/u);
  assert.match(String(evidence.selectedChartId), /flow-easy$/u);
  for (const proof of evidence.proofs) {
    assert.ok(proof.cells.length > 0 && proof.cells.every((cell) => cell === 1 || cell === 2), `${proof.eventId} must preserve exact selected Easy cells`);
    assert.ok(Math.abs(proof.durationMs - 25) < 0.001, `${proof.eventId} must preserve exact 25 ms interval`);
    assert.deepEqual({ before:proof.before, approach:proof.approach, active:proof.active, after:proof.after }, { before:0, approach:1, active:1, after:0 });
    assert.equal(proof.volumeCount, proof.cells.length);
    assert.deepEqual(proof.intervalStarts, [proof.startMs]);
    assert.deepEqual(proof.intervalEnds, [proof.endMs]);
    assert.equal(proof.rowPositions.length, new Set(proof.cells.map((cell) => Math.floor(cell / 4))).size, `${proof.eventId} must preserve distinct authored obstacle rows`);
    assert.deepEqual(proof.judgements, [undefined]);
  }
  assert.equal(evidence.cameraRequests, 0); assert.deepEqual(noise, []);
  console.log(`Live Flow obstacles passed: map=${mapId} hash=${versionHash} package=${evidence.selectedPackageId} variant=${evidence.selectedVariantId} obstacles=${evidence.obstacleCount} volumes=${evidence.proofs.reduce((sum,proof)=>sum+proof.volumeCount,0)}`);
} finally {
  if (importedCollectionId) { try { await page.locator("aero-game").evaluate((element, collectionId) => element.deleteLibraryCollection(collectionId), importedCollectionId); } catch { /* ephemeral context is the final cleanup boundary */ } }
  await browser.close(); await vite.close();
}
