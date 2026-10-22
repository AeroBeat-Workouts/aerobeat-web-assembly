// @ts-check
// Real connected UI: choose Boxing before downloading music, then import a
// pinned song; no personal library, public service or live BeatSaver traffic.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { handlerForSnapshot, loadSignedSnapshot } from "./serve-friend-game.js";

const archive = await readFile("/tmp/aerobeat-diagnostic-5e-44cb8963.zip");
assert.equal(createHash("sha256").update(archive).digest("hex"), "c00ad62b155b7919f96fc3c8545e5451b9122ccf1f81daeee5ded1691b0c5037");
const signedDirectory = process.env.AEROBEAT_MODE_SIGNED_DIR;
const vite = signedDirectory ? null : await createViteServer({ logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false } });
let gameServer, parent, browser;
try {
  let url;
  if (vite) { await vite.listen(); url = vite.resolvedUrls?.local?.[0]; }
  else {
    const snapshot = loadSignedSnapshot(path.resolve(signedDirectory));
    gameServer = createHttpServer(handlerForSnapshot(snapshot));
    await new Promise(resolve => gameServer.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${gameServer.address().port}/`;
  }
  assert.ok(url);
  parent = createHttpServer((_request, response) => { response.setHeader("content-type", "text/html; charset=utf-8"); response.end(`<!doctype html><iframe allow="camera; autoplay" style="width:390px;height:844px" src="${url}"></iframe>`); });
  await new Promise(resolve => parent.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch();
  for (const embedding of ["direct", "iframe"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/__pinned_song.zip", route => route.fulfill({ status: 200, contentType: "application/zip", body: archive }));
      await page.goto(embedding === "direct" ? url : `http://localhost:${parent.address().port}/`, { waitUntil: "networkidle" });
      const frame = embedding === "direct" ? page : page.frames().find(item => item !== page.mainFrame());
      assert.ok(frame);
      const game = frame.locator("aero-game"); await game.waitFor();
      const mode = value => game.locator("aero-prototype-selector[scope='gameplay']").locator(`input[value='${value}']`);
      await mode("boxing_collider_v1").click();
      await game.evaluate(element => element.lifecycleIntentTail);
      const empty = await game.evaluate(element => ({ selected: element.shadowRoot.querySelector("aero-prototype-selector[scope='gameplay']").shadowRoot.querySelector("input[name='gameplay-mode-choice']:checked")?.value, requested: element.lastGameplayRulesetId, error: element.lastError, packageId: element.graph.content.getSnapshot().packageId, playable: element.downloadedPlayable() }));
      assert.equal(empty.selected, "boxing_collider_v1", `${embedding}: empty-library radio must show chosen Boxing preference`);
      assert.equal(empty.requested, "boxing_collider_v1");
      assert.equal(empty.error, null, `${embedding}: no song cannot predate Boxing`);
      assert.equal(empty.packageId, null); assert.equal(empty.playable, false);
      const imported = await game.evaluate(async element => {
        const bytes = new Uint8Array(await (await fetch("/__pinned_song.zip")).arrayBuffer());
        await element.importLocalZip(bytes);
        const content = element.graph.content.getSnapshot();
        return { error: element.lastError, packageId: content.packageId, selected: content.selectedVariant?.rulesetId, variants: content.variants.map(variant => variant.rulesetId), playable: element.downloadedPlayable() };
      });
      assert.equal(imported.error, null, `${embedding}: successful fresh download must not show stale migration warning`);
      assert.ok(imported.packageId && imported.playable);
      assert.ok(imported.variants.includes("boxing_collider_v1") && imported.variants.includes("boxing_collider_knee_v1") && imported.variants.includes("flow_colliders_v1"));
      assert.equal(imported.selected, "boxing_collider_knee_v1", `${embedding}: selected mode persists through first download`);
      await mode("flow_colliders_v1").click();
      await game.evaluate(element => element.lifecycleIntentTail);
      const flow = await game.evaluate(element => ({ selected: element.graph.content.getSnapshot().selectedVariant?.rulesetId, error: element.lastError }));
      assert.equal(flow.selected, "flow_colliders_v1"); assert.equal(flow.error, null);
      assert.deepEqual(errors, [], `${embedding}: browser errors`);
      console.log(`${embedding}: empty library Boxing → pinned Linkin Park import → Flow: PASS`);
    } finally { await context.close(); }
  }
} finally {
  await browser?.close(); await new Promise(resolve => parent?.close(resolve) ?? resolve());
  await new Promise(resolve => gameServer?.close(resolve) ?? resolve()); await vite?.close();
}
