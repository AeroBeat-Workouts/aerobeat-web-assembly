// Isolated normal CPU game; source and copied assets must be immutable before signing.
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
if (pkg.name !== "@aerobeat/web-assembly") throw new Error("Friend game assembly mismatch");
const linked = Object.entries(pkg.dependencies ?? {});
if (linked.length !== 14) throw new Error("Friend game requires fourteen linked packages");
const packages = linked.map(([name, spec]) => {
  const sibling = `aerobeat-${name.slice("@aerobeat/".length)}`;
  if (!name.startsWith("@aerobeat/web-") || spec !== `file:../${sibling}`) throw new Error(`Friend game dependency drift: ${name}`);
  const expected = realpathSync(fileURLToPath(new URL(`../${sibling}/`, root)));
  if (realpathSync(fileURLToPath(new URL(`${spec.slice(5)}/`, root))) !== expected ||
      realpathSync(fileURLToPath(new URL(`node_modules/${name}/`, root))) !== expected || expected === rootPath) throw new Error(`Friend game dependency realpath drift: ${name}`);
  const owned = JSON.parse(readFileSync(new URL(`../${sibling}/package.json`, root), "utf8"));
  if (owned.name !== name) throw new Error(`Friend game package ownership drift: ${name}`);
  return { name, path: expected, exports: owned.exports ?? {} };
});
const roots = [{ name: pkg.name, path: rootPath }, ...packages];
function sourceManifest() {
  return {
    schema: "aerobeat/public_friend_game_source_manifest", version: 1, packageVersion: pkg.version,
    sources: Object.fromEntries(roots.map(({ name, path }) => [name, {
      commit: git(path, "rev-parse", "HEAD"), tree: git(path, "rev-parse", "HEAD^{tree}"),
      sourceSha256: sha256(Buffer.from(git(path, "ls-tree", "-r", "--full-tree", "HEAD")))
    }]))
  };
}
const sourceJson = JSON.stringify(sourceManifest());
const stamp = `FRIEND-GAME-CPU-${pkg.version}-${sha256(Buffer.from(sourceJson)).slice(0, 24)}`;
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
    sha256(proofBytes) !== "f37bb12bc3cafc53e0e3314c95e8bd0551a76a1366ee16e9af4adcb522dc9910") throw new Error("Friend game gameplay authority drift");
const inventory = JSON.parse(inventoryBytes);
if (inventory.expected_asset_count !== 9 || inventory.payload.filter(({ path }) => path.endsWith(".glb")).length !== 9) throw new Error("Friend game GLB inventory drift");
function checked(url, bytes, digest) {
  const content = readFileSync(url);
  if (content.byteLength !== bytes || sha256(content) !== digest) throw new Error(`Friend game asset drift: ${url.pathname}`);
  return content;
}
const favicon = readFileSync(new URL("assets/favicon/favicon.ico", root));
if (sha256(favicon) !== "5e8ac126cbef7a8a82b00b86c91ea656b61ea34d2afb1bd445c3edfe594ddc65") throw new Error("Friend game favicon drift");
const mediaRoot = new URL("../aerobeat-web-vendor-mediapipe/node_modules/@mediapipe/tasks-vision/", root);
const mediaFiles = [
  ["assets/mediapipe/pose_landmarker_lite.task", new URL("../aerobeat-vendor-mediapipe-python/models/pose_landmarker_lite.task", root)],
  ["assets/mediapipe/vision_bundle.js", new URL("vision_bundle.js", mediaRoot)],
  ...readdirSync(new URL("wasm/", mediaRoot)).sort().map(name => [`assets/mediapipe/wasm/${name}`, new URL(`wasm/${name}`, mediaRoot)])
];
function mediaDigest() {
  return sha256(Buffer.from(mediaFiles.map(([name, url]) => {
    const content = readFileSync(url);
    return `${name}\t${content.byteLength}\t${sha256(content)}\n`;
  }).join("")));
}
if (mediaFiles.length !== 8 || mediaDigest() !== "73dce3877d951dff100ed46655b82143d6644b1e1308164b8feab48dda0fee9b") throw new Error("Friend game MediaPipe inventory drift");
const assets = [
  ...inventory.payload.map(entry => [`assets/gameplay/0.0.12/${entry.path}`, checked(new URL(entry.path, gameplayRoot), entry.bytes, entry.sha256)]),
  ...environmentAssetFiles.map(entry => [entry.path, checked(new URL(entry.path, root), entry.bytes, entry.sha256)]),
  ["favicon.ico", favicon], ...mediaFiles.map(([name, url]) => [name, readFileSync(url)])
];
function assertCleanBuild() {
  for (const { name, path } of roots) {
    if (git(path, "status", "--porcelain=v1", "--untracked-files=all") !== "") throw new Error(`Friend game requires clean committed source: ${name}`);
  }
  if (JSON.stringify(sourceManifest()) !== sourceJson || mediaDigest() !== "73dce3877d951dff100ed46655b82143d6644b1e1308164b8feab48dda0fee9b") throw new Error("Friend game input changed during build");
  const current = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  if (JSON.stringify(current) !== JSON.stringify(pkg)) throw new Error("Friend game package changed during build");
  for (const { name, path } of packages) if (realpathSync(fileURLToPath(new URL(`node_modules/${name}/`, root))) !== path) throw new Error(`Friend game symlink drift: ${name}`);
  if (sha256(readFileSync(new URL("inventory.v1.json", gameplayRoot))) !== sha256(inventoryBytes) ||
      sha256(readFileSync(new URL("proof.v1.json", gameplayRoot))) !== sha256(proofBytes) ||
      sha256(readFileSync(new URL("assets/favicon/favicon.ico", root))) !== sha256(favicon)) throw new Error("Friend game asset authority changed");
  for (const entry of inventory.payload) checked(new URL(entry.path, gameplayRoot), entry.bytes, entry.sha256);
  for (const entry of environmentAssetFiles) checked(new URL(entry.path, root), entry.bytes, entry.sha256);
}
export default {
  base: "/",
  define: {
    __AEROBEAT_BUILD_STAMP__: JSON.stringify(stamp),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(`${pkg.version}-${sha256(Buffer.from(sourceJson)).slice(0, 16)}`),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(pkg.version),
    __AEROBEAT_PUBLIC_FRIEND_GAME__: true
  },
  resolve: { alias: aliases, preserveSymlinks: false },
  optimizeDeps: { exclude: packages.map(({ name }) => name) },
  plugins: [{
    name: "friend-game-clean-source-and-owned-assets", apply: "build",
    buildStart() {
      assertCleanBuild();
      for (const [fileName, source] of assets) this.emitFile({ type: "asset", fileName, source });
    },
    closeBundle() { assertCleanBuild(); }
  }],
  server: { host: "127.0.0.1", port: 5200, strictPort: true, fs: { strict: true, allow: [rootPath, ...packages.map(({ path }) => path)] } },
  build: { outDir: "dist-friend-game", assetsInlineLimit: 0, rollupOptions: { input: fileURLToPath(new URL("index.html", root)) } }
};
