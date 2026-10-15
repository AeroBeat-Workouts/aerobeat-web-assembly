#!/usr/bin/env node
// @ts-check
// Fail-closed server: pin every served byte and reject everything outside the signed inventory.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDirectory = fileURLToPath(new URL("../dist-friend-game/", import.meta.url));
const sidecar = "friend-game-bundle-manifest.json";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = message => { throw new Error(`Friend game server: ${message}`); };
function safeRelative(relative) {
  return typeof relative === "string" && relative.length > 0 && !relative.startsWith("/") && !relative.includes("\\") &&
    relative.split("/").every(part => part && part !== "." && part !== ".." && !part.startsWith("."));
}
function inventoryFiles(root, relative = "") {
  return readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (!safeRelative(name)) fail(`unsafe output: ${name}`);
    if (entry.isDirectory()) return inventoryFiles(root, name);
    if (!entry.isFile()) fail(`symlink or unsupported output: ${name}`);
    return [name];
  });
}
function checkedFile(root, relative) {
  if (!safeRelative(relative)) fail(`unsafe path: ${relative}`);
  let cursor = root;
  for (const part of relative.split("/")) {
    cursor = path.join(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) fail(`symlink: ${relative}`);
  }
  if (!lstatSync(cursor).isFile()) fail(`not a regular file: ${relative}`);
  return readFileSync(cursor);
}
const documentCsp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.beatsaver.com https://r2cdn.beatsaver.com; media-src 'self' blob: https://cfcdn.beatsaver.com; worker-src 'self' blob:; frame-ancestors *; base-uri 'none'; form-action 'none'; object-src 'none'";
// Worker policy: importScripts loads only signed same-origin scripts; MediaPipe compiles local WASM.
// Never permit BeatSaver (or any other external connect target) inside a Worker.
const assetCsp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";
const mime = Object.freeze({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".wasm": "application/wasm", ".task": "application/octet-stream", ".glb": "model/gltf-binary", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml" });
export function loadSignedSnapshot(directory = defaultDirectory) {
  const root = path.resolve(directory);
  if (!lstatSync(root).isDirectory() || realpathSync(root) !== root) fail("snapshot root must be a real directory");
  const manifest = JSON.parse(checkedFile(root, sidecar).toString("utf8"));
  if (manifest.schema !== "aerobeat/public_friend_game_bundle" || manifest.version !== 1 ||
      manifest.purpose !== "normal_cpu_friend_game" || manifest.responsePolicy?.documentCsp !== documentCsp ||
      manifest.responsePolicy?.assetCsp !== assetCsp || manifest.responsePolicy?.referrerPolicy !== "no-referrer" ||
      manifest.responsePolicy?.contentTypeOptions !== "nosniff" || !Array.isArray(manifest.assets)) fail("invalid signed sidecar or response policy");
  const sources = manifest.sourceManifest;
  if (sources?.schema !== "aerobeat/public_friend_game_source_manifest" || sources.version !== 1 ||
      typeof sources.packageVersion !== "string" || !sources.sources || typeof sources.sources !== "object" ||
      Object.keys(sources.sources).length !== 15 ||
      !Object.values(sources.sources).every(value => value && /^[0-9a-f]{40}$/u.test(value.commit) && /^[0-9a-f]{40}$/u.test(value.tree) && /^[0-9a-f]{64}$/u.test(value.sourceSha256))) fail("source provenance incomplete");
  if (manifest.buildStamp !== `FRIEND-GAME-CPU-${sources.packageVersion}-${sha256(Buffer.from(JSON.stringify(sources))).slice(0, 24)}`) fail("source stamp mismatch");
  const found = inventoryFiles(root).sort();
  const named = manifest.assets.map(entry => entry?.path);
  if (named.length !== new Set(named).size || found.join("\n") !== [...named, sidecar].sort().join("\n") ||
      named.filter(name => name.endsWith(".html")).join() !== "index.html" || named.includes(sidecar) ||
      named.some(name => !safeRelative(name) || /phone-|diagnostic|\.map$|\.json$|gpu/iu.test(name) || !mime[path.extname(name)])) fail("output differs from allowed signed inventory");
  const bytes = new Map();
  for (const entry of manifest.assets) {
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[0-9a-f]{64}$/u.test(entry.sha256)) fail(`invalid asset signature: ${entry.path}`);
    const data = checkedFile(root, entry.path);
    if (data.length !== entry.bytes || sha256(data) !== entry.sha256) fail(`asset signature mismatch: ${entry.path}`);
    bytes.set(`/${entry.path}`, data);
  }
  const html = bytes.get("/index.html")?.toString("utf8");
  const entryScripts = [...(html?.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gu) ?? [])].map(match => match[1]);
  if (!html?.includes("<aero-game>") || html.includes("/src/index.js") || !entryScripts.length ||
      entryScripts.some(name => !/^\/assets\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*-[A-Za-z0-9_-]+\.js$/u.test(name) ||
        !bytes.get(name)?.includes(Buffer.from(manifest.buildStamp)))) fail("normal stamped game entry missing");
  if (named.filter(name => /^assets\/gameplay\/0\.0\.11\/.*\.glb$/u.test(name)).length !== 9 ||
      !named.includes("assets/mediapipe/pose_landmarker_lite.task") || !named.includes("assets/mediapipe/vision_bundle.js") ||
      !named.some(name => /^assets\/mediapipe\/wasm\/.*\.wasm$/u.test(name)) || !named.some(name => /^assets\/environments\/.*\.jpe?g$/u.test(name)) ||
      !named.includes("favicon.ico")) fail("required local game assets missing");
  return Object.freeze({ bytes, manifest });
}
function exactPath(raw) {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("#")) return null;
  const pathname = raw.split("?", 1)[0];
  if (pathname !== "/" && (!safeRelative(pathname.slice(1)) || /%|[\u0000-\u001f\u007f]/u.test(pathname))) return null;
  return pathname;
}
export function handlerForSnapshot(snapshot) {
  return (request, response) => {
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    const pathname = exactPath(request.url);
    const resource = pathname === "/" ? "/index.html" : pathname;
    const data = pathname === `/${sidecar}` ? null : resource && snapshot.bytes.get(resource);
    response.setHeader("Content-Security-Policy", resource === "/index.html" && data ? documentCsp : assetCsp);
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.statusCode = 405;
      response.setHeader("Allow", "GET, HEAD");
      response.end();
      return;
    }
    if (!data) { response.statusCode = 404; response.end(); return; }
    response.statusCode = 200;
    response.setHeader("Content-Type", mime[path.extname(resource)]);
    response.setHeader("Content-Length", data.length);
    response.end(request.method === "HEAD" ? undefined : data);
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) fail("usage: node scripts/serve-friend-game.js [absolute-snapshot-directory]");
  const directory = process.argv[2] ?? defaultDirectory;
  if (!path.isAbsolute(directory)) fail("snapshot directory must be absolute");
  const snapshot = loadSignedSnapshot(directory);
  createServer(handlerForSnapshot(snapshot)).listen(4200, "127.0.0.1", () => {
    console.log(`Signed friend game listening on 127.0.0.1:4200 (${snapshot.manifest.assets.length} files)`);
  });
}
