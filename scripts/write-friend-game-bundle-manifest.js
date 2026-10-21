#!/usr/bin/env node
// @ts-check
// Sign every emitted byte from a clean assembly and fourteen clean linked packages.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const defaultOut = path.join(root, "dist-friend-game");
let out = defaultOut;
const sidecar = "friend-game-bundle-manifest.json";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const fail = message => { throw new Error(`Friend game signing: ${message}`); };
function safeName(name) {
  if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) fail(`unsafe output path: ${name}`);
}
// JSON is permitted only as an owned environment config/rights manifest or gameplay manifest/set.
const gameJson = /^(?:assets\/environments\/([a-z0-9]+(?:-[a-z0-9]+)*)\/1\.0\.0\/(?:\1\.config|manifest)|assets\/gameplay\/0\.0\.13\/(?:manifests\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.v1|sets\/[a-z0-9]+(?:-[a-z0-9]+)*))\.json$/u;
function regularFile(relative) {
  safeName(relative);
  let cursor = out;
  for (const part of relative.split("/")) {
    cursor = path.join(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) fail(`symlink in output: ${relative}`);
  }
  if (!lstatSync(cursor).isFile()) fail(`not a regular output file: ${relative}`);
  return cursor;
}
function filesUnder(relative = "") {
  return readdirSync(path.join(out, relative), { withFileTypes: true }).flatMap(entry => {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    safeName(next);
    if (entry.isDirectory()) return filesUnder(next);
    if (!entry.isFile()) fail(`unsupported output entry: ${next}`);
    return [next];
  });
}
function record(relative) {
  const bytes = readFileSync(regularFile(relative));
  return { path: relative, bytes: bytes.byteLength, sha256: sha256(bytes) };
}
function snapshot(packages) {
  return Object.fromEntries(packages.map(([name, location]) => {
    if (git(location, "status", "--porcelain=v1", "--untracked-files=all")) fail(`source dirty: ${name}`);
    return [name, {
      commit: git(location, "rev-parse", "HEAD"), tree: git(location, "rev-parse", "HEAD^{tree}"),
      sourceSha256: sha256(Buffer.from(git(location, "ls-tree", "-r", "--full-tree", "HEAD")))
    }];
  }));
}
function outputDirectory(args) {
  if (args.length === 0) return defaultOut;
  if (args.length !== 2 || args[0] !== "--candidate-dir") fail("only test-only --candidate-dir .tmp/<candidate> is supported");
  const relative = args[1];
  // Require a single named child of .tmp, not a path alias, traversal or a public dist.
  if (!/^\.tmp\/[a-zA-Z0-9][a-zA-Z0-9_-]*$/u.test(relative)) fail("candidate must be a relative .tmp/<candidate> directory");
  const temp = path.join(root, ".tmp");
  if (!existsSync(temp) || !lstatSync(temp).isDirectory() || realpathSync(temp) !== temp) fail(".tmp must be a real directory");
  const candidate = path.join(root, relative);
  if (!existsSync(candidate) || !lstatSync(candidate).isDirectory() || realpathSync(candidate) !== candidate) fail("candidate must be a real directory beneath .tmp");
  return candidate;
}
function main() {
  if (realpathSync(root) !== root) fail("canonical assembly root required");
  out = outputDirectory(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.name !== "@aerobeat/web-assembly" || typeof pkg.version !== "string") fail("unexpected assembly package");
  const linked = Object.entries(pkg.dependencies ?? {});
  if (linked.length !== 14) fail("fourteen linked packages required");
  const packages = [[pkg.name, root], ...linked.map(([name, spec]) => {
    const sibling = `aerobeat-${name.slice("@aerobeat/".length)}`;
    if (!name.startsWith("@aerobeat/web-") || spec !== `file:../${sibling}`) fail(`linked specification drift: ${name}`);
    const expected = realpathSync(path.resolve(root, "..", sibling));
    if (expected === root || realpathSync(path.resolve(root, spec.slice(5))) !== expected ||
        realpathSync(path.join(root, "node_modules", name)) !== expected ||
        JSON.parse(readFileSync(path.join(expected, "package.json"), "utf8")).name !== name) fail(`linked ownership or realpath drift: ${name}`);
    return [name, expected];
  })];
  const sources = snapshot(packages);
  const sourceManifest = { schema: "aerobeat/public_friend_game_source_manifest", version: 1, packageVersion: pkg.version, sources };
  const buildStamp = `FRIEND-GAME-CPU-${pkg.version}-${sha256(Buffer.from(JSON.stringify(sourceManifest))).slice(0, 24)}`;
  if (!lstatSync(out).isDirectory() || realpathSync(out) !== out) fail("output must be a real directory");
  const files = filesUnder().sort();
  if (files.includes(sidecar)) fail("sidecar exists; rebuild cleanly before signing");
  if (files.filter(name => name.endsWith(".html")).join() !== "index.html") fail("only normal index.html may ship");
  const html = readFileSync(regularFile("index.html"), "utf8");
  if (!html.includes("<aero-game>") || html.includes("/src/index.js") || /phone-|diagnostic|preview=1|json.downloader/iu.test(html)) fail("normal game HTML missing or diagnostic HTML present");
  const jsPaths = files.filter(name => name.endsWith(".js"));
  const chunk = /^assets\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*-[A-Za-z0-9_-]+\.js$/u;
  const mediaJs = /^assets\/mediapipe\/(?:wasm\/)?[A-Za-z0-9_-]+\.js$/u;
  if (!jsPaths.some(name => chunk.test(name) && /worker/iu.test(name)) || jsPaths.some(name => !chunk.test(name) && !mediaJs.test(name))) fail("Worker or JS inventory invalid");
  const entries = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gu)].map(match => match[1]);
  if (!entries.length || entries.some(name => !name.startsWith("/assets/") || !chunk.test(name.slice(1)) || !jsPaths.includes(name.slice(1)) ||
      !readFileSync(regularFile(name.slice(1))).includes(Buffer.from(buildStamp)))) fail("built game entry or source stamp missing");
  if (files.filter(name => /^assets\/gameplay\/0\.0\.13\/.*\.glb$/u.test(name)).length !== 11 ||
      !files.some(name => /^assets\/environments\/.*\.jpe?g$/u.test(name)) || !files.includes("favicon.ico") ||
      !files.includes("assets/mediapipe/pose_landmarker_lite.task") || !files.includes("assets/mediapipe/vision_bundle.js") ||
      !files.some(name => /^assets\/mediapipe\/wasm\/.*\.wasm$/u.test(name))) fail("pinned game or MediaPipe assets missing");
  if (files.some(name => /phone-|diagnostic|\.map$|gpu/iu.test(name) || (name.endsWith(".json") && !gameJson.test(name)))) fail("diagnostic, source map, unowned JSON or GPU output forbidden");
  const result = {
    schema: "aerobeat/public_friend_game_bundle", version: 1, purpose: "normal_cpu_friend_game",
    sourceManifest, buildStamp,
    responsePolicy: {
      documentCsp: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.beatsaver.com https://r2cdn.beatsaver.com; media-src 'self' blob: https://cfcdn.beatsaver.com; worker-src 'self' blob:; frame-ancestors *; base-uri 'none'; form-action 'none'; object-src 'none'",
      assetCsp: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
      referrerPolicy: "no-referrer", contentTypeOptions: "nosniff"
    },
    assets: files.map(record)
  };
  if (JSON.stringify(snapshot(packages)) !== JSON.stringify(sources) ||
      JSON.stringify(JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))) !== JSON.stringify(pkg) ||
      files.join("\n") !== filesUnder().sort().join("\n")) fail("source or output changed during signing");
  for (const [name, location] of packages.slice(1)) if (realpathSync(path.join(root, "node_modules", name)) !== location) fail(`linked symlink changed: ${name}`);
  for (const entry of result.assets) if (JSON.stringify(record(entry.path)) !== JSON.stringify(entry)) fail(`output changed during signing: ${entry.path}`);
  writeFileSync(path.join(out, sidecar), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  console.log(`Signed ${result.assets.length} files in ${path.relative(root, out)}; serve only this frozen snapshot.`);
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
