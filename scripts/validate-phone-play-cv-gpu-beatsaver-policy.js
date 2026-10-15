#!/usr/bin/env node
// @ts-check
// Isolated static policy contract; full signed-byte and browser QA run separately after a clean build.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import config, { BEATSAVER_DOCUMENT_CSP, BEATSAVER_OTHER_CSP, previewCspForPath } from "../vite.phone-play-cv-gpu-beatsaver.config.js";

const root = new URL("../", import.meta.url);
const signer = readFileSync(new URL("scripts/write-phone-play-cv-gpu-beatsaver-bundle-manifest.js", root), "utf8");
const original = readFileSync(new URL("vite.phone-play-cv-gpu-result.config.js", root), "utf8");
const expectedDocument = "connect-src 'self' https://api.beatsaver.com https://r2cdn.beatsaver.com; media-src 'self' blob: https://cfcdn.beatsaver.com; base-uri 'none'; form-action 'none'; object-src 'none'";
const expectedOther = "connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";
assert.equal(BEATSAVER_DOCUMENT_CSP, expectedDocument);
assert.equal(BEATSAVER_OTHER_CSP, expectedOther);
for (const path of ["/", "/index.html", "/phone-play-cv-test.html"]) assert.equal(previewCspForPath(path), expectedDocument);
for (const path of ["/assets/worker.js", "/assets/mediapipe/vision_bundle.js", "/missing", "/index.html/", "/INDEX.html", ""]) assert.equal(previewCspForPath(path), expectedOther);
assert.equal(config.preview.port, 4199);
assert.equal(config.build.outDir, "dist-phone-play-cv-gpu-beatsaver");
assert.equal(config.define.__AEROBEAT_PRIVATE_GAMEPLAY_CV_MODE__, JSON.stringify("gpu-after-result"));
assert.equal(config.define.__AEROBEAT_PRIVATE_BEATSAVER_ACCESS__, true);
assert.equal(config.define.__AEROBEAT_PRIVATE_PLAY_CV_BUNDLE_PATH__, JSON.stringify("/phone-play-cv-gpu-beatsaver-bundle-manifest.json"));
assert.equal(config.preview.headers, undefined, "Vite static setHeaders overrides preview.headers CSP");
const middleware = [];
config.plugins.find(plugin => plugin.name === "phone-play-cv-beatsaver-preview-response-policy").configurePreviewServer({ middlewares: { use(callback) { middleware.push(callback); } } });
assert.equal(middleware.length, 1, "response policy must be installed before static middleware");
for (const [url, expected] of [["/", expectedDocument], ["/index.html?x=1", expectedDocument], ["/phone-play-cv-test.html", expectedDocument], ["/assets/worker.js", expectedOther], ["/no-such-page", expectedOther]]) {
  const headers = new Map(); let nextCount = 0;
  middleware[0]({ url }, { setHeader(name, value) { headers.set(name, value); } }, () => { nextCount++; });
  assert.equal(headers.get("Content-Security-Policy"), expected, url);
  assert.equal(headers.get("Referrer-Policy"), "no-referrer", url);
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff", url);
  assert.equal(nextCount, 1, url);
}
assert.match(signer, /source dirty:/u);
assert.match(signer, /assetsUnder\(out\)\.sort\(\)/u);
assert.match(signer, /previewCspForPath\(name\)/u);
assert.match(signer, /full_game_play_gpu_after_result_beatsaver_private_candidate/u);
assert.match(original, /outDir: "dist-phone-play-cv-gpu-result"/u, "original rollback profile remains unchanged");
console.log(`PASS isolated BeatSaver document CSP, self-only Worker/other, signer contract and preview headers (${fileURLToPath(root)})`);
