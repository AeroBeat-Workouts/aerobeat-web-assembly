// Separate private Play CV page, built only from clean committed source.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { environmentAssetFiles } from "./src/environment-asset-catalog.js";

const root = new URL("./", import.meta.url);
const rootPath = realpathSync(fileURLToPath(root));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
if (pkg.name !== "@aerobeat/web-assembly") throw new Error("Play CV assembly package mismatch");
const linked = Object.entries(pkg.dependencies ?? {});
if (linked.length !== 14) throw new Error("Play CV requires exactly fourteen linked repositories");
const packages = linked.map(([name, spec]) => {
  const siblingName = `aerobeat-${name.slice("@aerobeat/".length)}`;
  if (!name.startsWith("@aerobeat/web-") || spec !== `file:../${siblingName}`) throw new Error(`Play CV linked specification drifted: ${name}`);
  const expected = realpathSync(fileURLToPath(new URL(`../${siblingName}/`, root)));
  const linkedPath = realpathSync(fileURLToPath(new URL(`${spec.slice(5)}/`, root)));
  const installed = realpathSync(fileURLToPath(new URL(`node_modules/${name}/`, root)));
  if (linkedPath !== expected || installed !== expected || expected === rootPath) throw new Error(`Play CV linked realpath mismatch: ${name}`);
  const owned = JSON.parse(readFileSync(new URL(`../${siblingName}/package.json`, root), "utf8"));
  if (owned.name !== name) throw new Error(`Play CV package ownership mismatch: ${name}`);
  return { name, path: expected, exports: owned.exports ?? {} };
});
const sourceRoots = [{ name: pkg.name, path: rootPath }, ...packages];
function sourceManifest() {
  return {
    schema: "aerobeat/private_phone_play_cv_source_manifest", version: 1, packageVersion: pkg.version,
    sources: Object.fromEntries(sourceRoots.map(({ name, path }) => [name, {
      commit: git(path, "rev-parse", "HEAD"), tree: git(path, "rev-parse", "HEAD^{tree}"),
      sourceSha256: sha256(Buffer.from(git(path, "ls-tree", "-r", "--full-tree", "HEAD")))
    }]))
  };
}
const manifest = sourceManifest();
const manifestJson = JSON.stringify(manifest);
const stamp = `PHONE-PLAY-CV-PRIVATE-${pkg.version}-${sha256(Buffer.from(manifestJson)).slice(0, 24)}`;
const aliases = packages.flatMap(({ name, path, exports: exported }) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return [
    ...Object.entries(exported).filter(([key, target]) => key.startsWith("./") && typeof target === "string")
      .map(([key, target]) => ({ find: `${name}/${key.slice(2)}`, replacement: `${path}/${target.replace(/^\.\//u, "")}` })),
    { find: new RegExp(`^${escaped}/(.+)$`, "u"), replacement: `${path}/src/$1.js` },
    { find: new RegExp(`^${escaped}$`, "u"), replacement: `${path}/src/index.js` }
  ];
});
const gameplayRoot = new URL("../aerobeat-web-renderer/assets/gameplay/0.0.12/", root);
const inventoryBytes = readFileSync(new URL("inventory.v1.json", gameplayRoot));
const proofBytes = readFileSync(new URL("proof.v1.json", gameplayRoot));
if (sha256(inventoryBytes) !== "a7a4902e7aa0bf92da8179dd4149e4e241e04ac64d0b9887d66151dacbf30231" ||
    sha256(proofBytes) !== "f37bb12bc3cafc53e0e3314c95e8bd0551a76a1366ee16e9af4adcb522dc9910") throw new Error("Play CV gameplay inventory/proof drifted");
const inventory = JSON.parse(inventoryBytes);
if (inventory.expected_asset_count !== 9 || inventory.payload.filter(({ path }) => path.endsWith(".glb")).length !== 9) throw new Error("Play CV gameplay GLB inventory drifted");
function checked(url, bytes, digest) {
  const source = readFileSync(url);
  if (source.byteLength !== bytes || sha256(source) !== digest) throw new Error(`Play CV owned asset drifted: ${url.pathname}`);
  return source;
}
const favicon = readFileSync(new URL("assets/favicon/favicon.ico", root));
if (sha256(favicon) !== "5e8ac126cbef7a8a82b00b86c91ea656b61ea34d2afb1bd445c3edfe594ddc65") throw new Error("Play CV favicon drifted");
const model = new URL("../aerobeat-vendor-mediapipe-python/models/pose_landmarker_lite.task", root);
const mediaRoot = new URL("../aerobeat-web-vendor-mediapipe/node_modules/@mediapipe/tasks-vision/", root);
const mediaFiles = [
  ["assets/mediapipe/pose_landmarker_lite.task", model],
  ["assets/mediapipe/vision_bundle.js", new URL("vision_bundle.js", mediaRoot)],
  ...readdirSync(new URL("wasm/", mediaRoot)).sort().map(name => [`assets/mediapipe/wasm/${name}`, new URL(`wasm/${name}`, mediaRoot)])
];
const mediaAssets = mediaFiles.map(([name, url]) => [name, readFileSync(url)]);
const mediaDigest = () => sha256(Buffer.from(mediaAssets.map(([name, bytes]) => `${name}\t${bytes.byteLength}\t${sha256(bytes)}\n`).join("")));
if (sha256(mediaAssets[0][1]) !== "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a" ||
    mediaAssets.length !== 8 || mediaDigest() !== "73dce3877d951dff100ed46655b82143d6644b1e1308164b8feab48dda0fee9b") throw new Error("Play CV MediaPipe asset inventory drifted");
const assets = [
  ...inventory.payload.map(entry => [`assets/gameplay/0.0.12/${entry.path}`, checked(new URL(entry.path, gameplayRoot), entry.bytes, entry.sha256)]),
  ...environmentAssetFiles.map(entry => [entry.path, checked(new URL(entry.path, root), entry.bytes, entry.sha256)]),
  ["favicon.ico", favicon], ...mediaAssets
];
function assertCleanBuild() {
  for (const { name, path } of sourceRoots) {
    if (git(path, "status", "--porcelain=v1", "--untracked-files=all") !== "") throw new Error(`Play CV build requires clean committed source: ${name}`);
  }
  if (JSON.stringify(sourceManifest()) !== manifestJson) throw new Error("Play CV source changed since config load");
  const current = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  if (JSON.stringify(current.dependencies) !== JSON.stringify(pkg.dependencies) || current.version !== pkg.version) throw new Error("Play CV assembly package changed since config load");
  for (const { name, path } of packages) {
    if (realpathSync(fileURLToPath(new URL(`node_modules/${name}/`, root))) !== path) throw new Error(`Play CV installed symlink changed: ${name}`);
  }
  if (sha256(readFileSync(new URL("inventory.v1.json", gameplayRoot))) !== sha256(inventoryBytes) ||
      sha256(readFileSync(new URL("proof.v1.json", gameplayRoot))) !== sha256(proofBytes) ||
      sha256(readFileSync(new URL("assets/favicon/favicon.ico", root))) !== sha256(favicon)) throw new Error("Play CV asset authority changed since config load");
  if (sha256(Buffer.from(mediaFiles.map(([name, url]) => {
    const bytes = readFileSync(url); return `${name}\t${bytes.byteLength}\t${sha256(bytes)}\n`;
  }).join(""))) !== mediaDigest()) throw new Error("Play CV MediaPipe assets changed since config load");
  for (const entry of inventory.payload) checked(new URL(entry.path, gameplayRoot), entry.bytes, entry.sha256);
  for (const entry of environmentAssetFiles) checked(new URL(entry.path, root), entry.bytes, entry.sha256);
}
export default {
  base: "/",
  define: {
    __AEROBEAT_BUILD_STAMP__: JSON.stringify(stamp),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(`${pkg.version}-${sha256(Buffer.from(manifestJson)).slice(0, 16)}`),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(pkg.version)
  },
  resolve: { alias: aliases, preserveSymlinks: false },
  optimizeDeps: { exclude: packages.map(({ name }) => name) },
  plugins: [{
    name: "phone-play-cv-clean-source-and-owned-assets", apply: "build",
    buildStart() {
      assertCleanBuild();
      for (const [fileName, source] of assets) this.emitFile({ type: "asset", fileName, source });
    },
    closeBundle() { assertCleanBuild(); }
  }],
  server: { host: "127.0.0.1", port: 5193, strictPort: true, allowedHosts: ["derrick-legion-go-8apu1.tail613fcb.ts.net"], fs: { strict: true, allow: [rootPath, ...packages.map(({ path }) => path)] } },
  preview: { host: "127.0.0.1", port: 4193, strictPort: true, allowedHosts: ["derrick-legion-go-8apu1.tail613fcb.ts.net"] },
  build: { outDir: "dist-phone-play-cv", assetsInlineLimit: 0, rollupOptions: { input: fileURLToPath(new URL("phone-play-cv-test.html", root)) } }
};
