// Historical full-app Test diagnostic only. This config never invokes release
// fingerprinting, and must never be used to publish an immutable raw release.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { environmentAssetFiles } from "./src/environment-asset-catalog.js";

const root = new URL("./", import.meta.url);
const rootPath = fileURLToPath(root);
const historicalPins = Object.freeze({
  "aerobeat-web-assembly": "382fbfc6b5c9b9f3852e2bfc2a2be32ceeccd408",
  "aerobeat-web-renderer": "0be921cea14933400bd8afdda809ea4453ea772b",
  "aerobeat-web-gameplay": "c9c32fc9fcd18964f35e3e283f72f9b146bf22df",
  "aerobeat-web-content-authoring": "f4ee9b4f466660a10d4300354ffd73ecff527d4c"
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (directory, ...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
for (const [directory, expected] of Object.entries(historicalPins)) {
  const path = fileURLToPath(new URL(`../${directory}/`, root));
  if (git(path, "rev-parse", "HEAD") !== expected) throw new Error(`Faint-hit historical pin drifted: ${directory}`);
  if (git(path, "status", "--porcelain=v1", "--untracked-files=all") !== "" && directory !== "aerobeat-web-assembly") {
    throw new Error(`Faint-hit historical dependency is dirty: ${directory}`);
  }
}
const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
if (manifest.name !== "@aerobeat/web-assembly" || manifest.version !== "0.0.105") throw new Error("Faint-hit historical package identity drifted");
const dependencies = Object.entries(manifest.dependencies).filter(([, spec]) => typeof spec === "string" && spec.startsWith("file:"));
const packageRoots = dependencies.map(([name, spec]) => {
  const path = realpathSync(fileURLToPath(new URL(`${spec.slice(5).replace(/\/$/u, "")}/`, root)));
  const owned = JSON.parse(readFileSync(new URL("package.json", new URL(`${spec.slice(5).replace(/\/$/u, "")}/`, root)), "utf8"));
  if (owned.name !== name) throw new Error(`Faint-hit linked dependency ownership drifted: ${name}`);
  return [name, path];
});
for (const [directory] of Object.entries(historicalPins).filter(([name]) => name !== "aerobeat-web-assembly")) {
  const expectedPath = realpathSync(fileURLToPath(new URL(`../${directory}/`, root)));
  if (!packageRoots.some(([name, path]) => name === `@aerobeat/${directory.slice("aerobeat-".length)}` && path === expectedPath)) {
    throw new Error(`Faint-hit historical dependency link drifted: ${directory}`);
  }
}
const aliases = packageRoots.flatMap(([name, path]) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const owned = JSON.parse(readFileSync(new URL("package.json", `file://${path}/`), "utf8"));
  const exports = owned.exports ?? {};
  const subpaths = Object.entries(exports).filter(([key, target]) => key.startsWith("./") && typeof target === "string")
    .map(([key, target]) => ({ find: `${name}/${key.slice(2)}`, replacement: `${path}/${target.replace(/^\.\//u, "")}` }));
  return [
    ...subpaths,
    { find: new RegExp(`^${escaped}/(.+)$`, "u"), replacement: `${path}/src/$1.js` },
    { find: new RegExp(`^${escaped}$`, "u"), replacement: `${path}/src/index.js` }
  ];
});
const rendererRoot = new URL("../aerobeat-web-renderer/assets/gameplay/0.0.11/", root);
const inventoryBytes = readFileSync(new URL("inventory.v1.json", rendererRoot));
const proofBytes = readFileSync(new URL("proof.v1.json", rendererRoot));
if (hash(inventoryBytes) !== "b043fe4f039f34527aae229224e0fb1f4069848b67ea5a89a51d732f063cac29" || hash(proofBytes) !== "a3c9ffbd4d07fa2d8b0810d8b22210145c35a479d87399c5ac87060f7b7614d3") {
  throw new Error("Faint-hit gameplay asset inventory/proof drifted");
}
const glbs = JSON.parse(inventoryBytes).payload.filter((entry) => entry.path.endsWith(".glb"));
if (glbs.length !== 9) throw new Error("Faint-hit gameplay GLB inventory drifted");
const checkedAsset = (url, bytes, digest) => {
  const content = readFileSync(url);
  if (content.byteLength !== bytes || hash(content) !== digest) throw new Error(`Faint-hit owned asset drifted: ${url.pathname}`);
  return content;
};
const favicon = readFileSync(new URL("assets/favicon/favicon.ico", root));
if (hash(favicon) !== "5e8ac126cbef7a8a82b00b86c91ea656b61ea34d2afb1bd445c3edfe594ddc65") throw new Error("Faint-hit favicon drifted");
const mediaFiles = [
  ["assets/mediapipe/pose_landmarker_lite.task", new URL("../aerobeat-vendor-mediapipe-python/models/pose_landmarker_lite.task", root), "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"],
  ["assets/mediapipe/vision_bundle.js", new URL("../aerobeat-web-vendor-mediapipe/node_modules/@mediapipe/tasks-vision/vision_bundle.js", root), null]
];
// Test never initializes CV. Ship the same local model/runtime inputs as the
// scoped phone build so full-app asset coverage cannot silently shrink.
const mediaRoot = new URL("../aerobeat-web-vendor-mediapipe/node_modules/@mediapipe/tasks-vision/wasm/", root);
for (const name of readdirSync(mediaRoot).sort()) mediaFiles.push([`assets/mediapipe/wasm/${name}`, new URL(name, mediaRoot), null]);
const mediaAssets = mediaFiles.map(([fileName, url, expected]) => {
  const bytes = readFileSync(url);
  if (expected && hash(bytes) !== expected) throw new Error(`Faint-hit MediaPipe asset drifted: ${fileName}`);
  return [fileName, bytes];
});
const mediaInventory = hash(Buffer.from(mediaAssets.map(([name, bytes]) => `${name}\t${bytes.byteLength}\t${hash(bytes)}\n`).join("")));
if (mediaAssets.length !== 8 || mediaInventory !== "73dce3877d951dff100ed46655b82143d6644b1e1308164b8feab48dda0fee9b") throw new Error("Faint-hit MediaPipe inventory drifted");
const diagnosticStamp = `DIAGNOSTIC-NONPARITY-0.0.105-${historicalPins["aerobeat-web-assembly"].slice(0, 8)}-served8445SourceParity:false`;
export default {
  base: "/",
  define: {
    __AEROBEAT_BUILD_STAMP__: JSON.stringify(diagnosticStamp),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(`faint-hit-0.0.105-${historicalPins["aerobeat-web-assembly"].slice(0, 12)}`),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(manifest.version)
  },
  resolve: { alias: aliases, preserveSymlinks: false },
  optimizeDeps: { exclude: packageRoots.map(([name]) => name) },
  plugins: [{
    name: "historical-faint-hit-owned-assets",
    apply: "build",
    buildStart() {
      for (const entry of glbs) {
        const source = checkedAsset(new URL(entry.path, rendererRoot), entry.bytes, entry.sha256);
        this.emitFile({ type: "asset", fileName: `assets/gameplay/0.0.11/${entry.path}`, source });
      }
      for (const entry of environmentAssetFiles) {
        const source = checkedAsset(new URL(entry.path, root), entry.bytes, entry.sha256);
        this.emitFile({ type: "asset", fileName: entry.path, source });
      }
      this.emitFile({ type: "asset", fileName: "favicon.ico", source: favicon });
      for (const [fileName, source] of mediaAssets) this.emitFile({ type: "asset", fileName, source });
    }
  }],
  server: { host: "127.0.0.1", port: 5181, strictPort: true, allowedHosts: ["derrick-legion-go-8apu1.tail613fcb.ts.net"], fs: { strict: true, allow: [rootPath, ...packageRoots.map(([, path]) => path)] } },
  preview: { host: "127.0.0.1", port: 4181, strictPort: true, allowedHosts: ["derrick-legion-go-8apu1.tail613fcb.ts.net"] },
  build: { assetsInlineLimit: 0, rollupOptions: { input: fileURLToPath(new URL("faint-hit-test.html", root)) } }
};
