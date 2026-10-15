#!/usr/bin/env node
// @ts-check
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { handlerForSnapshot, loadSignedSnapshot } from "./serve-friend-game.js";

const hash = data => createHash("sha256").update(data).digest("hex");
const root = mkdtempSync(path.join(tmpdir(), "aerobeat-friend-static-"));
const sourceManifest = {
  schema: "aerobeat/public_friend_game_source_manifest", version: 1, packageVersion: "0.0.128",
  sources: Object.fromEntries(Array.from({ length: 15 }, (_, n) => [`repo-${n}`, { commit: "a".repeat(40), tree: "b".repeat(40), sourceSha256: "c".repeat(64) }]))
};
const buildStamp = `FRIEND-GAME-CPU-${sourceManifest.packageVersion}-${hash(Buffer.from(JSON.stringify(sourceManifest))).slice(0, 24)}`;
const files = new Map([
  ["index.html", Buffer.from(`<aero-game></aero-game><script src="/assets/index-ABC.js"></script>`) ],
  ["assets/index-ABC.js", Buffer.from(buildStamp)],
  ["favicon.ico", Buffer.from("icon")],
  ["assets/mediapipe/pose_landmarker_lite.task", Buffer.from("model")],
  ["assets/mediapipe/vision_bundle.js", Buffer.from("vision")],
  ["assets/mediapipe/wasm/vision_wasm_internal.wasm", Buffer.from("wasm")],
  ["assets/environments/test.jpg", Buffer.from("environment")],
  ["assets/environments/alpine-river-valley-photosphere/1.0.0/alpine-river-valley-photosphere.config.json", Buffer.from("{\"id\":\"alpine\"}")],
  ["assets/environments/alpine-river-valley-photosphere/1.0.0/manifest.json", Buffer.from("{\"rights\":true}")],
  ["assets/gameplay/0.0.11/manifests/guard/outlined-shield-v1.v1.json", Buffer.from("{\"asset\":\"guard\"}")],
  ["assets/gameplay/0.0.11/sets/default-v1.json", Buffer.from("{\"set\":\"default\"}")],
  ...Array.from({ length: 9 }, (_, n) => [`assets/gameplay/0.0.11/model${n}.glb`, Buffer.from(`glb${n}`)])
]);
for (const [name, bytes] of files) {
  mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  writeFileSync(path.join(root, name), bytes);
}
const policy = {
  documentCsp: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.beatsaver.com https://r2cdn.beatsaver.com; media-src 'self' blob: https://cfcdn.beatsaver.com; worker-src 'self' blob:; frame-ancestors *; base-uri 'none'; form-action 'none'; object-src 'none'",
  assetCsp: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
  referrerPolicy: "no-referrer", contentTypeOptions: "nosniff"
};
const manifest = {
  schema: "aerobeat/public_friend_game_bundle", version: 1, purpose: "normal_cpu_friend_game",
  sourceManifest, buildStamp, responsePolicy: policy,
  assets: [...files].map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }))
};
const sidecar = path.join(root, "friend-game-bundle-manifest.json");
const sign = () => writeFileSync(sidecar, JSON.stringify(manifest));
sign();
let server;
try {
  const snapshot = loadSignedSnapshot(root);
  server = createServer(handlerForSnapshot(snapshot));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  async function request(name, init) { return fetch(`${base}${name}`, init); }
  for (const name of ["/", "/index.html", "/assets/index-ABC.js"]) {
    const response = await request(name);
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), files.get(name === "/" ? "index.html" : name.slice(1)));
  }
  for (const name of ["/", "/index.html"]) {
    assert.equal((await request(name)).headers.get("content-security-policy"), policy.documentCsp);
    const head = await request(name, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-security-policy"), policy.documentCsp);
    assert.equal(head.headers.get("content-length"), String(files.get("index.html").length));
  }
  assert.equal((await request("/assets/index-ABC.js")).headers.get("content-security-policy"), policy.assetCsp);
  assert.equal((await request("/assets/index-ABC.js", { method: "HEAD" })).status, 200);
  for (const [name, bytes] of [...files].filter(([name]) => name.endsWith(".json"))) {
    const response = await request(`/${name}`);
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("content-security-policy"), policy.assetCsp);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await request(`/${name}`, { method: "HEAD" })).status, 200);
  }
  for (const name of ["/nope", "/src/index.js", "/.env", "/assets/", "/index.html/", "/INDEX.html", "/friend-game-bundle-manifest.json", "/assets/%2findex-ABC.js", "//index.html", "/phone-play-cv-test.html"]) {
    assert.equal((await request(name)).status, 404, name);
  }
  assert.equal((await request("/", { method: "POST" })).status, 405);
  const rawTraversal = await new Promise((resolve, reject) => {
    // Fetch normalizes URL dot segments, so submit the raw request target instead.
    httpRequest({ hostname: "127.0.0.1", port: address.port, path: "/%2e%2e/index.html" }, response => {
      response.resume(); response.on("end", () => resolve(response.statusCode));
    }).on("error", reject).end();
  });
  assert.equal(rawTraversal, 404, "encoded traversal must fail");
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  server = null;
  writeFileSync(path.join(root, "assets/index-ABC.js"), "tampered");
  assert.throws(() => loadSignedSnapshot(root), /signature mismatch/u, "tampered signed JS must fail startup");
  writeFileSync(path.join(root, "assets/index-ABC.js"), files.get("assets/index-ABC.js"));
  manifest.assets[1].sha256 = "f".repeat(64);
  sign();
  assert.throws(() => loadSignedSnapshot(root), /signature mismatch/u, "false SHA must fail startup");
  manifest.assets[1].sha256 = hash(files.get("assets/index-ABC.js"));
  sign();
  // Re-sign a stamped second script and reference an unstamped script from the index.
  const unstamped = Buffer.from("console.log('not stamped')");
  const extraName = "assets/extra-ABC.js";
  writeFileSync(path.join(root, extraName), unstamped);
  manifest.assets.push({ path: extraName, bytes: unstamped.length, sha256: hash(unstamped) });
  const originalHtml = files.get("index.html");
  const alteredHtml = Buffer.from(`${originalHtml}<script src="/${extraName}"></script>`);
  writeFileSync(path.join(root, "index.html"), alteredHtml);
  manifest.assets[0] = { path: "index.html", bytes: alteredHtml.length, sha256: hash(alteredHtml) };
  sign();
  assert.throws(() => loadSignedSnapshot(root), /stamped game entry/u, "every signed HTML script must carry the source stamp");
  writeFileSync(path.join(root, "index.html"), originalHtml);
  manifest.assets[0] = { path: "index.html", bytes: originalHtml.length, sha256: hash(originalHtml) };
  manifest.assets.pop();
  rmSync(path.join(root, extraName));
  sign();
  writeFileSync(path.join(root, "private.html"), "unexpected");
  assert.throws(() => loadSignedSnapshot(root), /inventory/u, "unsigned output must fail startup");
  rmSync(path.join(root, "private.html"));
  for (const bad of ["assets/environments/unknown.json", "assets/environments/alpine-river-valley-photosphere/1.0.0/debug.json", "assets/gameplay/0.0.11/manifests/guard/debug.json"]) {
    mkdirSync(path.dirname(path.join(root, bad)), { recursive: true });
    writeFileSync(path.join(root, bad), "{}");
    manifest.assets.push({ path: bad, bytes: 2, sha256: hash(Buffer.from("{}")) });
    sign();
    assert.throws(() => loadSignedSnapshot(root), /inventory/u, `signed but unowned JSON must fail: ${bad}`);
    manifest.assets.pop();
    rmSync(path.join(root, bad));
  }
  sign();
  rmSync(path.join(root, "favicon.ico"));
  symlinkSync(path.join(root, "index.html"), path.join(root, "favicon.ico"));
  assert.throws(() => loadSignedSnapshot(root), /unsupported output|symlink/u, "symlink must fail startup");
  console.log("Friend game signed startup, exact requests, CSP, and negative fixture checks passed");
} finally {
  if (server) server.close();
  rmSync(root, { recursive: true, force: true });
}
