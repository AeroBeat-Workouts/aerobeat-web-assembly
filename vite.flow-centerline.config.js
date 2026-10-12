// Isolated latest-source Flow tester, never a production or historical release.
// Dev accepts an in-progress assembly; build accepts only clean committed source.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { environmentAssetFiles } from "./src/environment-asset-catalog.js";

const root = new URL("./", import.meta.url);
const rootPath = realpathSync(fileURLToPath(root));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (path, ...args) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8" }).trim();
const expectedRenderer = Object.freeze({ commit: "e6b369472e33a56e0520bb2085fb3d4c6a707c55", tree: "5ff8c34070c2743e83b66453f7f9570c2f044407" });
const assemblyPackage = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
if (assemblyPackage.name !== "@aerobeat/web-assembly" || !/^0\.0\.(?:12[8-9]|1[3-9]\d|[2-9]\d\d|\d{4,})$/u.test(assemblyPackage.version)) {
  throw new Error("Flow tester requires a current assembly package version (at least 0.0.128)");
}
const linked = Object.entries(assemblyPackage.dependencies).filter(([, spec]) => typeof spec === "string" && spec.startsWith("file:"));
if (linked.length !== Object.keys(assemblyPackage.dependencies).length || linked.length !== 14) throw new Error("Flow tester linked dependency inventory drifted");
const packages = linked.map(([name, spec]) => {
  const sibling = new URL(`${spec.slice(5).replace(/\/$/u, "")}/`, root);
  const path = realpathSync(fileURLToPath(sibling));
  const siblingName = `aerobeat-${name.slice("@aerobeat/".length)}`;
  const expected = realpathSync(fileURLToPath(new URL(`../${siblingName}/`, root)));
  const installed = realpathSync(fileURLToPath(new URL(`node_modules/${name}/`, root)));
  if (!name.startsWith("@aerobeat/web-") || spec !== `file:../${siblingName}` || path !== expected || installed !== path || path === rootPath) {
    throw new Error(`Flow tester exact linked symlink/realpath mismatch: ${name}`);
  }
  const owned = JSON.parse(readFileSync(new URL("package.json", sibling), "utf8"));
  if (owned.name !== name) throw new Error(`Flow tester linked package ownership mismatch: ${name}`);
  return { name, path, exports: owned.exports ?? {} };
});
const renderer = packages.find(({ name }) => name === "@aerobeat/web-renderer");
if (!renderer) throw new Error("Flow tester renderer is not linked");
const sourceRoots = [{ name: assemblyPackage.name, path: rootPath }, ...packages];
const sourceManifest = () => {
  const sources = Object.fromEntries(sourceRoots.map(({ name, path }) => {
    const tree = git(path, "rev-parse", "HEAD^{tree}");
    return [name, {
      commit: git(path, "rev-parse", "HEAD"),
      tree,
      // SHA-256 of Git's recursive tracked-file tree listing; the Git tree
      // itself binds every committed byte, including file modes and paths.
      sourceSha256: sha256(Buffer.from(git(path, "ls-tree", "-r", "--full-tree", "HEAD")))
    }];
  }));
  if (sources[renderer.name].commit !== expectedRenderer.commit || sources[renderer.name].tree !== expectedRenderer.tree) {
    throw new Error("Flow tester renderer fixed-centerline commit/tree pin drifted");
  }
  return { schema: "aerobeat/flow_centerline_source_manifest", version: 1, packageVersion: assemblyPackage.version, sources };
};
const manifest = sourceManifest();
function assertCleanBuild() {
  for (const { name, path } of sourceRoots) {
    if (git(path, "status", "--porcelain=v1", "--untracked-files=all") !== "") throw new Error(`Flow tester build requires clean committed source: ${name}`);
  }
  if (JSON.stringify(sourceManifest()) !== JSON.stringify(manifest)) throw new Error("Flow tester sources changed since config load");
  const installed = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  if (JSON.stringify(installed.dependencies) !== JSON.stringify(assemblyPackage.dependencies) || installed.version !== assemblyPackage.version) throw new Error("Flow tester assembly package changed since config load");
  for (const { name, path } of packages) {
    if (realpathSync(fileURLToPath(new URL(`node_modules/${name}/`, root))) !== path) throw new Error(`Flow tester symlink changed since config load: ${name}`);
  }
  if (sha256(readFileSync(new URL("inventory.v1.json", gameplayRoot))) !== sha256(inventoryBytes) ||
      sha256(readFileSync(new URL("proof.v1.json", gameplayRoot))) !== sha256(proofBytes)) throw new Error("Flow tester gameplay inventory changed since config load");
  if (sha256(readFileSync(new URL("assets/favicon/favicon.ico", root))) !== sha256(favicon)) throw new Error("Flow tester favicon changed since config load");
  const liveMedia = mediaFiles.map(([name, url]) => [name, readFileSync(url)]);
  if (sha256(Buffer.from(liveMedia.map(([name, bytes]) => `${name}\t${bytes.byteLength}\t${sha256(bytes)}\n`).join(""))) !== mediaDigest()) throw new Error("Flow tester MediaPipe assets changed since config load");
  for (const entry of gameplayInventory.payload) checked(new URL(entry.path, gameplayRoot), entry.bytes, entry.sha256);
  for (const entry of environmentAssetFiles) checked(new URL(entry.path, root), entry.bytes, entry.sha256);
}
const sourceManifestJson = JSON.stringify(manifest);
const stamp = `FLOW-CENTERLINE-EXPERIMENTAL-${assemblyPackage.version}-${sha256(Buffer.from(sourceManifestJson)).slice(0, 24)}`;
const aliases = packages.flatMap(({ name, path, exports: exported }) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const subpaths = Object.entries(exported).filter(([key, target]) => key.startsWith("./") && typeof target === "string")
    .map(([key, target]) => ({ find: `${name}/${key.slice(2)}`, replacement: `${path}/${target.replace(/^\.\//u, "")}` }));
  return [
    ...subpaths,
    { find: new RegExp(`^${escaped}/(.+)$`, "u"), replacement: `${path}/src/$1.js` },
    { find: new RegExp(`^${escaped}$`, "u"), replacement: `${path}/src/index.js` }
  ];
});
const gameplayRoot = new URL("../aerobeat-web-renderer/assets/gameplay/0.0.11/", root);
const inventoryBytes = readFileSync(new URL("inventory.v1.json", gameplayRoot));
const proofBytes = readFileSync(new URL("proof.v1.json", gameplayRoot));
if (sha256(inventoryBytes) !== "b043fe4f039f34527aae229224e0fb1f4069848b67ea5a89a51d732f063cac29" ||
    sha256(proofBytes) !== "a3c9ffbd4d07fa2d8b0810d8b22210145c35a479d87399c5ac87060f7b7614d3") throw new Error("Flow tester gameplay asset inventory/proof drifted");
const gameplayInventory = JSON.parse(inventoryBytes);
if (gameplayInventory.expected_asset_count !== 9 || gameplayInventory.payload.filter(({ path }) => path.endsWith(".glb")).length !== 9) throw new Error("Flow tester gameplay GLB inventory drifted");
const checked = (url, bytes, digest) => {
  const source = readFileSync(url);
  if (source.byteLength !== bytes || sha256(source) !== digest) throw new Error(`Flow tester owned asset drifted: ${url.pathname}`);
  return source;
};
const favicon = readFileSync(new URL("assets/favicon/favicon.ico", root));
if (sha256(favicon) !== "5e8ac126cbef7a8a82b00b86c91ea656b61ea34d2afb1bd445c3edfe594ddc65") throw new Error("Flow tester favicon drifted");
const model = new URL("../aerobeat-vendor-mediapipe-python/models/pose_landmarker_lite.task", root);
const mediaRoot = new URL("../aerobeat-web-vendor-mediapipe/node_modules/@mediapipe/tasks-vision/", root);
const mediaFiles = [
  ["assets/mediapipe/pose_landmarker_lite.task", model],
  ["assets/mediapipe/vision_bundle.js", new URL("vision_bundle.js", mediaRoot)],
  ...readdirSync(new URL("wasm/", mediaRoot)).sort().map((name) => [`assets/mediapipe/wasm/${name}`, new URL(`wasm/${name}`, mediaRoot)])
];
const mediaAssets = mediaFiles.map(([name, url]) => [name, readFileSync(url)]);
const mediaDigest = () => sha256(Buffer.from(mediaAssets.map(([name, bytes]) => `${name}\t${bytes.byteLength}\t${sha256(bytes)}\n`).join("")));
if (sha256(mediaAssets[0][1]) !== "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a" ||
    mediaAssets.length !== 8 || mediaDigest() !== "73dce3877d951dff100ed46655b82143d6644b1e1308164b8feab48dda0fee9b") {
  throw new Error("Flow tester MediaPipe asset inventory/bytes drifted");
}
const assets = [
  ...gameplayInventory.payload.map((entry) => [`assets/gameplay/0.0.11/${entry.path}`, checked(new URL(entry.path, gameplayRoot), entry.bytes, entry.sha256)]),
  ...environmentAssetFiles.map((entry) => [entry.path, checked(new URL(entry.path, root), entry.bytes, entry.sha256)]),
  ["favicon.ico", favicon], ...mediaAssets
];
export default {
  base: "/",
  define: {
    __AEROBEAT_FLOW_SOURCE_MANIFEST__: sourceManifestJson,
    __AEROBEAT_BUILD_STAMP__: JSON.stringify(stamp),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(`${assemblyPackage.version}-${sha256(Buffer.from(sourceManifestJson)).slice(0, 16)}`),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(assemblyPackage.version)
  },
  resolve: { alias: aliases, preserveSymlinks: false },
  optimizeDeps: { exclude: packages.map(({ name }) => name) },
  plugins: [{
    name: "flow-centerline-clean-source-and-owned-assets",
    apply: "build",
    buildStart() {
      assertCleanBuild();
      for (const [fileName, source] of assets) this.emitFile({ type: "asset", fileName, source });
    }
  }],
  server: { host: "127.0.0.1", port: 5182, strictPort: true, allowedHosts: ["derrick-legion-go-8apu1.tail613fcb.ts.net"], fs: { strict: true, allow: [rootPath, ...packages.map(({ path }) => path)] } },
  preview: { host: "127.0.0.1", port: 4182, strictPort: true, allowedHosts: ["derrick-legion-go-8apu1.tail613fcb.ts.net"] },
  build: { outDir: "dist-flow-centerline-phone", assetsInlineLimit: 0, rollupOptions: { input: fileURLToPath(new URL("flow-centerline-test.html", root)) } }
};
