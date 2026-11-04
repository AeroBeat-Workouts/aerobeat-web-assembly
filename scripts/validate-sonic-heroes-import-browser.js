// @ts-check
import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { loadSignedSnapshot, handlerForSnapshot } from "./serve-friend-game.js";

assert(process.env.AEROBEAT_SIGNED_NJS_DIR, "Select the actual signed candidate");
const snapshot = loadSignedSnapshot(path.resolve(process.env.AEROBEAT_SIGNED_NJS_DIR));
assert.equal(snapshot.manifest.sourceManifest.packageVersion, "0.0.155");
const hash = "fb09ccd3edeb747ee3735a01824234d5c31fb9a1";
const response = await fetch(`https://cdn.beatsaver.com/${hash}.zip`);
assert.equal(response.status, 200);
const archive = Buffer.from(await response.arrayBuffer());
const server = createServer(handlerForSnapshot(snapshot));
let browser, parent;
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  parent = createServer((_req, res) => { res.setHeader("content-type", "text/html"); res.end(`<iframe allow="camera; autoplay" width="390" height="844" src="${url}"></iframe>`); });
  await new Promise(resolve => parent.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch();
  for (const embedding of ["direct", "iframe"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/__sonic-heroes.zip", route => route.fulfill({ status: 200, contentType: "application/zip", body: archive }));
    await page.goto(embedding === "direct" ? url : `http://localhost:${parent.address().port}/`, { waitUntil: "networkidle" });
    const frame = embedding === "direct" ? page : page.frames().find(frame => frame !== page.mainFrame());
    const game = frame.locator("aero-game");
    await frame.waitForFunction(() => !!document.querySelector("aero-game")?.graph);
    const result = await game.evaluate(async (element, expectedHash) => {
      const bytes = new Uint8Array(await (await fetch("/__sonic-heroes.zip")).arrayBuffer());
      const acquired = await element.graph.vendor.importLocalArchive(bytes), manifest = acquired.source.manifest;
      if (acquired.sourceHash !== expectedHash) throw Error("Named map source hash mismatch");
      const raw = JSON.parse(new TextDecoder().decode(await acquired.source.readEntry(manifest.infoPath)));
      if (raw._difficultyBeatmapSets[0]._difficultyBeatmaps[0]._noteJumpMovementSpeed !== 0) throw Error("Fixture no longer exercises actual zero NJS");
      const imported = await element.importLocalZip(bytes, { difficulty: "Easy", sourceId: "sonic-heroes-njs-regression" });
      return { speeds: manifest.difficulties.map(row => [row.difficulty, row.noteJumpMovementSpeed]), packages: imported.packages.length, selected: element.graph.content.getSnapshot().state, library: element.libraryView.collections.length, playing: element.graph.audio.getClockSnapshot().playing, error: element.lastError?.message ?? null };
    }, hash);
    assert.deepEqual(result.speeds, [["Easy", 10], ["Expert", 16], ["ExpertPlus", 18]]);
    assert.equal(result.packages, 3); assert(result.library > 0); assert.equal(result.selected, "ready");
    assert.equal(result.playing, false); assert.equal(result.error, null); assert.deepEqual(errors, []);
    console.log(`PASS signed ${embedding} Sonic Heroes: real zero-NJS archive imports all difficulties through component/Worker/persistence without autoplay.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (parent) await new Promise(resolve => parent.close(resolve));
  await new Promise(resolve => server.close(resolve));
}
