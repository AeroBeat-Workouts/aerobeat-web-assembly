#!/usr/bin/env node
// @ts-check
// The sidecar binds all emitted bytes to the same clean 15-repository source as Vite.
// Serving HTML/JS/Worker/model/GLB bytes still requires independent response parity.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputName = "dist-phone-play-cv-gpu-beatsaver";
const htmlPaths = ["index.html", "phone-play-cv-test.html"];
const manifestPath = "phone-play-cv-gpu-beatsaver-bundle-manifest.json";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
function fail(message) { throw new Error(`Play CV bundle manifest: ${message}`); }
function safeRelative(relative) {
  if (!relative || relative.startsWith("/") || relative.includes("\\") || relative.split("/").some(part => !part || part === "." || part === "..")) fail(`unsafe path: ${relative}`);
}
function regularWithin(base, relative) {
  safeRelative(relative);
  const full = path.resolve(base, relative);
  if (!full.startsWith(`${base}${path.sep}`)) fail(`escaped output path: ${relative}`);
  let cursor = base;
  for (const component of relative.split("/")) {
    cursor = path.join(cursor, component);
    if (lstatSync(cursor).isSymbolicLink()) fail(`symlink not allowed: ${relative}`);
  }
  if (!lstatSync(full).isFile()) fail(`not a regular file: ${relative}`);
  return full;
}
function assetsUnder(base, relative = "") {
  return readdirSync(relative ? path.join(base, relative) : base, { withFileTypes: true }).flatMap(entry => {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    safeRelative(next);
    if (entry.isSymbolicLink()) fail(`symlink in output: ${next}`);
    if (entry.isDirectory()) return assetsUnder(base, next);
    if (!entry.isFile()) fail(`unsupported output entry: ${next}`);
    return [next];
  });
}
function record(base, relative) {
  const bytes = readFileSync(regularWithin(base, relative));
  return { path: relative, bytes: bytes.byteLength, sha256: sha256(bytes) };
}
function sourceManifest(packageVersion, sources) {
  return { schema: "aerobeat/private_phone_play_cv_gpu_beatsaver_source_manifest", version: 1, packageVersion, sources };
}
function snapshot(packages) {
  return Object.fromEntries(packages.map(([name, location]) => {
    if (git(location, "status", "--porcelain=v1", "--untracked-files=all") !== "") fail(`source dirty: ${name}`);
    return [name, {
      commit: git(location, "rev-parse", "HEAD"), tree: git(location, "rev-parse", "HEAD^{tree}"),
      sourceSha256: sha256(Buffer.from(git(location, "ls-tree", "-r", "--full-tree", "HEAD")))
    }];
  }));
}
async function run() {
  if (process.argv.length !== 2) fail("no arguments accepted");
  if (realpathSync(root) !== root) fail("assembly root must have canonical realpath");
  const config = readFileSync(path.join(root, "vite.phone-play-cv-gpu-beatsaver.config.js"), "utf8");
  if (!config.includes('outDir: "dist-phone-play-cv-gpu-beatsaver"') ||
      htmlPaths.some(name => !config.includes(name)) ||
      !config.includes('const stamp = `PHONE-PLAY-CV-GPU-BEATSAVER-') ||
      !config.includes('__AEROBEAT_PRIVATE_GAMEPLAY_CV_MODE__: JSON.stringify("gpu-after-result")') ||
      !config.includes('__AEROBEAT_PRIVATE_BEATSAVER_ACCESS__: true') ||
      !config.includes('configurePreviewServer(server)') ||
      /preview:\s*\{[^}]*headers\s*:/u.test(config) ||
      !config.includes('response.setHeader("Content-Security-Policy", previewCspForPath(pathname))') ||
      !config.includes('response.setHeader("Referrer-Policy", "no-referrer")') ||
      !config.includes('response.setHeader("X-Content-Type-Options", "nosniff")')) fail("expected isolated build config or response policy missing");
  const { BEATSAVER_DOCUMENT_CSP, BEATSAVER_OTHER_CSP, previewCspForPath } = await import("../vite.phone-play-cv-gpu-beatsaver.config.js");
  const expectedDocumentCsp = "connect-src 'self' https://api.beatsaver.com https://r2cdn.beatsaver.com; media-src 'self' blob: https://cfcdn.beatsaver.com; base-uri 'none'; form-action 'none'; object-src 'none'";
  const expectedOtherCsp = "connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";
  if (BEATSAVER_DOCUMENT_CSP !== expectedDocumentCsp || BEATSAVER_OTHER_CSP !== expectedOtherCsp ||
      ["/", "/index.html", "/phone-play-cv-test.html"].some(name => previewCspForPath(name) !== expectedDocumentCsp) ||
      ["/assets/worker.js", "/no-such-page", "/index.html/", "/INDEX.html", "/assets/mediapipe/vision_bundle.js"].some(name => previewCspForPath(name) !== expectedOtherCsp)) fail("split document/Worker response policy drifted");
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.name !== "@aerobeat/web-assembly" || typeof pkg.version !== "string") fail("unexpected assembly package");
  const linked = Object.entries(pkg.dependencies ?? {});
  if (linked.length !== 14 || linked.some(([name, spec]) => !name.startsWith("@aerobeat/web-") || spec !== `file:../aerobeat-${name.slice("@aerobeat/".length)}`)) fail("unexpected linked dependency inventory");
  const packages = [[pkg.name, root], ...linked.map(([name, spec]) => {
    const expected = realpathSync(path.resolve(root, "..", `aerobeat-${name.slice("@aerobeat/".length)}`));
    const sibling = realpathSync(path.resolve(root, spec.slice(5)));
    const installed = realpathSync(path.join(root, "node_modules", name));
    if (sibling !== expected || installed !== expected || expected === root || JSON.parse(readFileSync(path.join(expected, "package.json"), "utf8")).name !== name) fail(`linked package mismatch: ${name}`);
    return [name, expected];
  })];
  const sources = snapshot(packages);
  const source = sourceManifest(pkg.version, sources);
  const buildStamp = `PHONE-PLAY-CV-GPU-BEATSAVER-${pkg.version}-${sha256(Buffer.from(JSON.stringify(source))).slice(0, 24)}`;
  const out = path.join(root, outputName);
  if (!lstatSync(out).isDirectory() || realpathSync(out) !== out) fail("build output must be a real directory");
  const files = assetsUnder(out).sort();
  if (files.includes(manifestPath)) fail("sidecar exists; rebuild cleanly before generating");
  if (htmlPaths.some(name => !files.includes(name))) fail("normal game or Play diagnostic HTML missing");
  const jsPaths = files.filter(name => name.endsWith(".js"));
  const viteChunk = /^assets\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*-[A-Za-z0-9_-]+\.js$/u;
  const mediapipeStatic = /^assets\/mediapipe\/(?:wasm\/)?[A-Za-z0-9_-]+\.js$/u;
  if (!jsPaths.some(name => viteChunk.test(name)) || jsPaths.some(name => !viteChunk.test(name) && !mediapipeStatic.test(name))) fail("built JS inventory missing or malformed");
  if (!files.some(name => /^assets\/mediapipe\/.*\.task$/u.test(name)) ||
      !files.some(name => /^assets\/mediapipe\/wasm\/.*\.wasm$/u.test(name)) ||
      files.filter(name => /^assets\/gameplay\/0\.0\.11\/.*\.glb$/u.test(name)).length !== 9 ||
      !files.some(name => /^assets\/environments\/.*\.jpe?g$/u.test(name)) ||
      !files.includes("favicon.ico")) fail("MediaPipe model/WASM, environment, favicon or gameplay GLBs missing");
  for (const htmlPath of htmlPaths) {
    const htmlText = readFileSync(regularWithin(out, htmlPath), "utf8");
    const entryScripts = [...htmlText.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gu)].map(match => match[1]);
    if (!entryScripts.length || entryScripts.some(src => !src.startsWith("/assets/") || !viteChunk.test(src.slice(1)) || !jsPaths.includes(src.slice(1)))) fail(`${htmlPath} does not reference hashed JS entry`);
    if (entryScripts.some(src => !readFileSync(regularWithin(out, src.slice(1))).includes(Buffer.from(buildStamp)))) fail(`${htmlPath} entry lacks declared build stamp`);
    if (htmlText.includes('/src/index.js') || htmlText.includes('/src/phone-play-cv-diagnostic.js')) fail(`${htmlPath} still references unbuilt source`);
  }
  if (!jsPaths.some(name => /worker/iu.test(name))) fail("built Worker JS missing");
  const result = {
    schema: "aerobeat/private_phone_play_cv_gpu_beatsaver_bundle", version: 1,
    purpose: "full_game_play_gpu_after_result_beatsaver_private_candidate",
    responsePolicy: {
      documentPaths: ["/", "/index.html", "/phone-play-cv-test.html"],
      documentCsp: "connect-src 'self' https://api.beatsaver.com https://r2cdn.beatsaver.com; media-src 'self' blob: https://cfcdn.beatsaver.com; base-uri 'none'; form-action 'none'; object-src 'none'",
      otherCsp: "connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
      referrerPolicy: "no-referrer", contentTypeOptions: "nosniff"
    },
    scheduler: { mode: "after-result", targetFps: 15 },
    requestedDelegate: "gpu-webgl", fallback: "fresh_cpu_wasm_only_on_initialization_failure",
    sourceManifest: source, buildStamp,
    assets: files.map(name => record(out, name))
  };
  if (JSON.stringify(snapshot(packages)) !== JSON.stringify(sources)) fail("source changed during hashing");
  for (const [name, spec] of linked) {
    const expected = packages.find(([packageName]) => packageName === name)?.[1];
    if (realpathSync(path.resolve(root, spec.slice(5))) !== expected || realpathSync(path.join(root, "node_modules", name)) !== expected) fail(`linked path changed during hashing: ${name}`);
  }
  if (JSON.stringify(JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))) !== JSON.stringify(pkg)) fail("assembly package changed during hashing");
  if (files.join("\n") !== assetsUnder(out).sort().join("\n")) fail("output changed during hashing");
  if (JSON.stringify({ documentCsp: BEATSAVER_DOCUMENT_CSP, otherCsp: BEATSAVER_OTHER_CSP }) !==
      JSON.stringify({ documentCsp: result.responsePolicy.documentCsp, otherCsp: result.responsePolicy.otherCsp })) fail("recorded response policy drifted");
  for (const entry of result.assets) {
    const current = record(out, entry.path);
    if (JSON.stringify(current) !== JSON.stringify(entry)) fail(`output changed during hashing: ${entry.path}`);
  }
  writeFileSync(path.join(out, manifestPath), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  console.log(`Wrote ${outputName}/${manifestPath}; verify served response parity separately.`);
}
try { await run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
