#!/usr/bin/env node
// @ts-check
// Sidecar pins all emitted HTML/JS/Worker/MediaPipe bytes to clean 15-repo source.
// Independent browser QA must still compare every served HTTPS response to it.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputName = "dist-phone-cv-gpu-result-experiment";
const htmlPath = "phone-cv-marker-baseline.html";
const manifestPath = "phone-cv-gpu-result-bundle-manifest.json";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
function fail(message) { throw new Error(`CV GPU experiment bundle manifest: ${message}`); }
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
  return { schema: "aerobeat/private_phone_cv_gpu_result_source_manifest", version: 1, packageVersion, sources };
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
function run() {
  if (process.argv.length !== 2) fail("no arguments accepted");
  if (realpathSync(root) !== root) fail("assembly root must have canonical realpath");
  const config = readFileSync(path.join(root, "vite.phone-cv-gpu-result.config.js"), "utf8");
  if (!config.includes('outDir: "dist-phone-cv-gpu-result-experiment"') || !config.includes('phone-cv-marker-baseline.html') ||
      !config.includes('"/src/phone-cv-gpu-experiment.js"') ||
      !config.includes('const stamp = `PHONE-CV-GPU-AFTER-RESULT-') ||
       !config.includes('__AEROBEAT_CV_SCHEDULING_MODE__: JSON.stringify("after-result")')) fail("expected isolated build config missing");
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
  const buildStamp = `PHONE-CV-GPU-AFTER-RESULT-${pkg.version}-${sha256(Buffer.from(JSON.stringify(source))).slice(0, 24)}`;
  const out = path.join(root, outputName);
  if (!lstatSync(out).isDirectory() || realpathSync(out) !== out) fail("build output must be a real directory");
  const files = assetsUnder(out).sort();
  if (files.includes(manifestPath)) fail("sidecar exists; rebuild cleanly before generating");
  if (!files.includes(htmlPath)) fail("built HTML missing");
  if (files.length !== 12) fail(`expected exactly 12 pinned assets, found ${files.length}`);
  const jsPaths = files.filter(name => name.endsWith(".js"));
  const viteChunk = /^assets\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*-[A-Za-z0-9_-]+\.js$/u;
  const mediapipeStatic = /^assets\/mediapipe\/(?:wasm\/)?[A-Za-z0-9_-]+\.js$/u;
  if (!jsPaths.some(name => viteChunk.test(name)) || jsPaths.some(name => !viteChunk.test(name) && !mediapipeStatic.test(name))) fail("built JS inventory missing or malformed");
  if (!files.some(name => /^assets\/mediapipe\/.*\.task$/u.test(name)) ||
      !files.some(name => /^assets\/mediapipe\/wasm\/.*\.wasm$/u.test(name)) ||
      !files.some(name => /^assets\/.*worker.*-[A-Za-z0-9_-]+\.js$/iu.test(name))) fail("MediaPipe model/WASM or Worker JS missing");
  if (files.some(name => /\.glb$/iu.test(name) || /^assets\/(?:gameplay|environments|audio)\//u.test(name))) fail("scene/audio/gameplay asset included in camera-only GPU experiment");
  const htmlText = readFileSync(regularWithin(out, htmlPath), "utf8");
  const entryScripts = [...htmlText.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gu)].map(match => match[1]);
  if (!entryScripts.length || entryScripts.some(src => !src.startsWith("/assets/") || !viteChunk.test(src.slice(1)) || !jsPaths.includes(src.slice(1)))) fail("built HTML does not reference hashed JS entry");
  if (entryScripts.some(src => {
    const bytes = readFileSync(regularWithin(out, src.slice(1)));
    return !bytes.includes(Buffer.from(buildStamp)) || !bytes.includes(Buffer.from("after-result"));
  })) fail("built entry lacks declared build stamp or scheduler identity");
  if (htmlText.includes("/src/phone-cv-marker-baseline.js") || htmlText.includes("/src/phone-cv-gpu-experiment.js")) fail("HTML still references unbuilt source entry");
  for (const label of ["GPU-first after-result / CPU fallback CV marker experiment", "Private GPU-first after-result / CPU fallback CV marker experiment", "GPU-first after-result / CPU fallback · camera + CV markers only · no game"]) {
    if (!htmlText.includes(label)) fail(`built HTML missing experiment identity: ${label}`);
  }
  const result = { schema: "aerobeat/private_phone_cv_gpu_result_bundle", version: 1, purpose: "camera_cv_gpu_after_result_experiment", scheduler: { mode: "after-result", targetFps: 15 }, sourceManifest: source, buildStamp, assets: files.map(name => record(out, name)) };
  if (JSON.stringify(snapshot(packages)) !== JSON.stringify(sources)) fail("source changed during hashing");
  for (const [name, spec] of linked) {
    const expected = packages.find(([packageName]) => packageName === name)?.[1];
    if (realpathSync(path.resolve(root, spec.slice(5))) !== expected || realpathSync(path.join(root, "node_modules", name)) !== expected) fail(`linked path changed during hashing: ${name}`);
  }
  if (JSON.stringify(JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))) !== JSON.stringify(pkg)) fail("assembly package changed during hashing");
  if (files.length !== assetsUnder(out).length) fail("output changed during hashing");
  for (const entry of result.assets) if (JSON.stringify(record(out, entry.path)) !== JSON.stringify(entry)) fail(`output changed during hashing: ${entry.path}`);
  writeFileSync(path.join(out, manifestPath), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  console.log(`Wrote ${outputName}/${manifestPath}; verify served response parity separately.`);
}
try { run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
