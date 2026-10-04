// @ts-check
// Focused browser proof: programmatic upgrade, persisted/detached scale, reconnect, listener ownership.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: false, logLevel: "error", define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("local-browser-regression"), __AEROBEAT_CACHE_BUST__: JSON.stringify("local-browser-regression"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("0.0.90") }, server: { host: "127.0.0.1", port: 0, hmr: false, watch: null, fs: { allow: [new URL("../../", import.meta.url).pathname] } } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0];
  assert.ok(url, "Vite URL unavailable");
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  const result = await page.evaluate(async () => {
    const key = "aerobeat.uiScale", previous = localStorage.getItem(key);
    let game;
    try {
      localStorage.setItem(key, "1.3");
      game = document.createElement("aero-game");
      const upgraded = game instanceof customElements.get("aero-game") && typeof game.getSnapshot === "function";
      const cleanHost = game.attributes.length === 0;
      game.setUiScale(1.45);
      const detachedClean = game.attributes.length === 0 && game.uiScale === 1.45;
      const host = document.querySelector("main");
      host.append(game);
      const first = { lifecycle: game.getSnapshot().lifecycle, generation: game.getSnapshot().generation, style: game.style.getPropertyValue("--aero-ui-scale"), listenerCount: game.unsubscribe.length };
      game.remove();
      game.style.removeProperty("--aero-ui-scale");
      host.append(game);
      const second = { lifecycle: game.getSnapshot().lifecycle, generation: game.getSnapshot().generation, style: game.style.getPropertyValue("--aero-ui-scale"), listenerCount: game.unsubscribe.length };
      game.remove();
      const persisted = document.createElement("aero-game");
      const persistedClean = persisted.attributes.length === 0 && persisted.uiScale === 1.45;
      host.append(persisted);
      const persistedConnected = persisted.getSnapshot().lifecycle === "connected" && persisted.style.getPropertyValue("--aero-ui-scale") === "1.45";
      persisted.remove();
      return { upgraded, cleanHost, detachedClean, first, second, persistedClean, persistedConnected };
    } finally {
      game?.remove();
      if (previous === null) localStorage.removeItem(key); else localStorage.setItem(key, previous);
    }
  });
  assert.equal(result.upgraded, true, "createElement must upgrade synchronously");
  assert.equal(result.cleanHost, true, "constructor must leave host attribute-free");
  assert.equal(result.detachedClean, true, "detached scale update must leave host attribute-free");
  assert.equal(result.first.lifecycle, "connected");
  assert.equal(result.first.style, "1.45");
  assert.equal(result.second.lifecycle, "connected");
  assert.ok(result.second.generation > result.first.generation, "reconnection must create a new graph");
  assert.equal(result.second.style, "1.45");
  assert.equal(result.second.listenerCount, result.first.listenerCount, "reconnection must not duplicate listeners");
  assert.equal(result.persistedClean, true);
  assert.equal(result.persistedConnected, true);
  assert.deepEqual(errors, [], "no pageerrors");
  console.log("Programmatic constructor, detached/persisted scale, reconnect and pageerror proof PASS");
} finally {
  await browser?.close();
  await vite.close();
}
