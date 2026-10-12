#!/usr/bin/env node
// @ts-check
// Run only after a clean, committed Flow centerline Vite build. This records
// local build bytes; HTTPS response parity is a separate browser QA obligation.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputName = "dist-flow-centerline-phone";
const htmlPath = "flow-centerline-test.html";
const manifestPath = "flow-centerline-bundle-manifest.json";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
function fail(message) { throw new Error(`Flow centerline bundle manifest: ${message}`); }
function regularWithin(base, relative) {
  if (!relative || relative.startsWith("/") || relative.includes("\\") || relative.split("/").some(part => !part || part === "." || part === "..")) fail(`unsafe path: ${relative}`);
  const full = path.resolve(base, relative);
  if (!full.startsWith(`${base}${path.sep}`)) fail(`escaped output path: ${relative}`);
  let cursor = base;
  for (const component of relative.split("/")) {
    cursor = path.join(cursor, component);
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) fail(`symlink not allowed: ${relative}`);
  }
  if (!lstatSync(full).isFile()) fail(`not a regular file: ${relative}`);
  return full;
}
function jsonFile(full) { return JSON.parse(readFileSync(full, "utf8")); }
function assetsUnder(base, relative = "") {
  const directory = relative ? path.join(base, relative) : base;
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
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
  return { schema: "aerobeat/flow_centerline_source_manifest", version: 1, packageVersion, sources };
}
function run() {
  if (process.argv.length !== 2) fail("no arguments accepted");
  if (realpathSync(root) !== root) fail("assembly root must have canonical realpath");
  const config = readFileSync(path.join(root, "vite.flow-centerline.config.js"), "utf8");
  if (!config.includes('outDir: "dist-flow-centerline-phone"') || !config.includes('flow-centerline-test.html') || !config.includes('const stamp = `FLOW-CENTERLINE-EXPERIMENTAL-')) fail("expected isolated build config missing");
  const pkg = jsonFile(path.join(root, "package.json"));
  if (pkg.name !== "@aerobeat/web-assembly" || !/^0\.0\.(?:12[8-9]|1[3-9]\d|[2-9]\d\d|\d{4,})$/u.test(pkg.version)) fail("unexpected assembly package/version");
  const linked = Object.entries(pkg.dependencies ?? {});
  if (linked.length !== 14 || linked.some(([name, spec]) => !name.startsWith("@aerobeat/web-") || spec !== `file:../aerobeat-${name.slice("@aerobeat/".length)}`)) fail("unexpected linked dependency inventory");
  const packages = [[pkg.name, root], ...linked.map(([name, spec]) => {
    const expected = realpathSync(path.resolve(root, spec.slice(5)));
    const installed = realpathSync(path.join(root, "node_modules", name));
    if (installed !== expected || expected === root || jsonFile(path.join(expected, "package.json")).name !== name) fail(`linked package mismatch: ${name}`);
    return [name, expected];
  })];
  const sources = Object.fromEntries(packages.map(([name, location]) => {
    if (git(location, "status", "--porcelain=v1", "--untracked-files=all") !== "") fail(`source dirty: ${name}`);
    return [name, {
      commit: git(location, "rev-parse", "HEAD"),
      tree: git(location, "rev-parse", "HEAD^{tree}"),
      sourceSha256: sha256(Buffer.from(git(location, "ls-tree", "-r", "--full-tree", "HEAD")))
    }];
  }));
  const renderer = sources["@aerobeat/web-renderer"];
  if (renderer?.commit !== "2d987f5d4c00d11f7eac92dfa0437c4aaa3fe28c" || renderer.tree !== "6ec7080c544327e4601f5e61f4f2611572471056") fail("renderer pin mismatch");
  const manifest = sourceManifest(pkg.version, sources);
  const buildStamp = `FLOW-CENTERLINE-EXPERIMENTAL-${pkg.version}-${sha256(Buffer.from(JSON.stringify(manifest))).slice(0, 24)}`;
  const out = path.join(root, outputName);
  if (!lstatSync(out).isDirectory() || realpathSync(out) !== out) fail("build output must be a real directory");
  const files = assetsUnder(out);
  if (!files.includes(htmlPath)) fail("built HTML entry missing");
  const jsPaths = files.filter(name => name.endsWith(".js")).sort();
  // Vite emits hashed entry/worker chunks, but its copied MediaPipe runtime
  // includes un-hashed JS under assets/mediapipe[/wasm]. Hash and serve-check
  // ALL of them; only chunks and the HTML-referenced entry require hash names.
  const viteChunk = /^assets\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*-[A-Za-z0-9_-]+\.js$/u;
  const mediapipeStatic = /^assets\/mediapipe\/(?:wasm\/)?[A-Za-z0-9_-]+\.js$/u;
  if (!jsPaths.some(name => viteChunk.test(name)) || jsPaths.some(name => !viteChunk.test(name) && !mediapipeStatic.test(name))) fail("built JS asset inventory missing or malformed");
  const htmlBytes = readFileSync(regularWithin(out, htmlPath));
  const htmlText = htmlBytes.toString("utf8");
  // The built entry must actually reference the JS included below. Vite emits
  // hashed modules/chunks into assets/, including worker bundles when present.
  const entryScripts = [...htmlText.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gu)].map(match => match[1]);
  if (!entryScripts.length || entryScripts.some(src => !src.startsWith("/assets/") || !viteChunk.test(src.slice(1)) || !jsPaths.includes(src.slice(1)))) fail("built HTML does not reference hashed JS entry");
  if (entryScripts.some(src => !readFileSync(regularWithin(out, src.slice(1))).includes(Buffer.from(buildStamp)))) fail("built entry JS lacks declared build stamp");
  if (htmlText.includes("/flow-centerline-diagnostic.js")) fail("HTML still references unbuilt source entry");
  // Do not overwrite or digest a preexisting sidecar. A clean Vite build clears
  // stale output first; this guards repeat invocation against stale artifacts.
  if (files.includes(manifestPath)) fail("manifest exists; rebuild cleanly before generating");
  const result = {
    schema: "aerobeat/flow_centerline_bundle_manifest",
    version: 1,
    sourceManifest: manifest,
    buildStamp,
    html: record(out, htmlPath),
    js: jsPaths.map(name => record(out, name))
  };
  // Recheck source state and identities just before writing; output itself is
  // excluded from both the source and artifact digests.
  for (const [name, location] of packages) {
    if (git(location, "status", "--porcelain=v1", "--untracked-files=all") !== "" || git(location, "rev-parse", "HEAD") !== sources[name].commit) fail(`source changed during hashing: ${name}`);
  }
  writeFileSync(path.join(out, manifestPath), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  console.log(`Wrote ${outputName}/${manifestPath}; browser QA must independently hash HTTPS responses before claiming served parity.`);
}

try { run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
