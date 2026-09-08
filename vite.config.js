// @ts-check

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeReleaseFingerprint } from "./scripts/release-fingerprint.js";
import { environmentAssetFiles } from "./src/environment-asset-catalog.js";

const basePath = process.env.AEROBEAT_BASE_PATH ?? "/";
const tailscaleHost = "derrick-alienware-aurora-r13.tail613fcb.ts.net";
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const assemblyRoot = fileURLToPath(new URL(".", import.meta.url));
export const viteAllowedFileSystemRoots = Object.freeze([assemblyRoot, ...Object.entries(packageJson.dependencies)
  .filter(([, spec]) => typeof spec === "string" && spec.startsWith("file:"))
  .map(([packageName, spec]) => {
    const packageRoot = new URL(`${spec.slice("file:".length).replace(/\/$/u, "")}/`, import.meta.url);
    const ownedPackage = JSON.parse(readFileSync(new URL("package.json", packageRoot), "utf8"));
    if (ownedPackage.name !== packageName) throw new Error(`Linked dependency ownership mismatch for ${packageName}`);
    return fileURLToPath(packageRoot);
  })]);
const rendererGameplayRoot = new URL("../aerobeat-web-renderer/assets/gameplay/0.0.10/", import.meta.url);
const rendererGameplayInventoryBytes = readFileSync(new URL("inventory.v1.json", rendererGameplayRoot));
if (createHash("sha256").update(rendererGameplayInventoryBytes).digest("hex") !== "a8eb2ea1306a6bf760b66b835d4b0dd3359601b46b1df682fe3805ee7e7e2bc8") throw new Error("Linked renderer gameplay inventory hash drifted");
const rendererGameplayProofBytes = readFileSync(new URL("proof.v1.json", rendererGameplayRoot));
if (createHash("sha256").update(rendererGameplayProofBytes).digest("hex") !== "017a6c0efaf48f85130380d774502f25785783a7ad69d400f8c0f2275855c242") throw new Error("Linked renderer gameplay proof hash drifted");
const rendererGameplayInventory = JSON.parse(rendererGameplayInventoryBytes.toString("utf8"));
const rendererGameplayGlbs = rendererGameplayInventory.payload.filter((entry) => entry.path.endsWith(".glb"));
if (rendererGameplayGlbs.length !== 7) throw new Error("Linked renderer gameplay GLB inventory drifted");
const sourceFingerprint = computeReleaseFingerprint(new URL(".", import.meta.url).pathname);
const buildStamp = `source:${sourceFingerprint}`;
const cacheBust = `${packageJson.version}-${sourceFingerprint.slice(0, 16)}`;

/**
 * Vite config for the browser assembly app.
 *
 * @type {import("vite").UserConfig}
 */
export default {
  base: basePath,
  build: { assetsInlineLimit: 0 },
  plugins: [{
    name: "aerobeat-owned-runtime-assets",
    buildStart() {
      for (const asset of rendererGameplayGlbs) {
        const source = readFileSync(new URL(asset.path, rendererGameplayRoot));
        if (source.byteLength !== asset.bytes || createHash("sha256").update(source).digest("hex") !== asset.sha256) throw new Error(`Linked renderer gameplay asset drifted: ${asset.path}`);
        this.emitFile({ type: "asset", fileName: `assets/gameplay/0.0.10/${asset.path}`, source });
      }
      for (const asset of environmentAssetFiles) {
        const source = readFileSync(new URL(`./${asset.path}`, import.meta.url));
        if (source.byteLength !== asset.bytes || createHash("sha256").update(source).digest("hex") !== asset.sha256) throw new Error(`Assembly environment asset drifted: ${asset.path}`);
        this.emitFile({ type: "asset", fileName: asset.path, source });
      }
    }
  }],
  define: {
    __AEROBEAT_BUILD_STAMP__: JSON.stringify(buildStamp),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(cacheBust),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(packageJson.version)
  },
  resolve: {
    alias: [
      { find: /^@aerobeat\/web-hash$/u, replacement: fileURLToPath(new URL("../aerobeat-web-hash/src/index.js", import.meta.url)) },
      { find: /^@aerobeat\/web-ui$/u, replacement: fileURLToPath(new URL("../aerobeat-web-ui/src/index.js", import.meta.url)) }
    ],
    preserveSymlinks: false
  },
  optimizeDeps: {
    exclude: ["@aerobeat/web-content-authoring", "@aerobeat/web-contracts", "@aerobeat/web-gameplay", "@aerobeat/web-hash", "@aerobeat/web-renderer", "@aerobeat/web-ui"]
  },
  server: {
    allowedHosts: [tailscaleHost],
    fs: { strict: true, allow: viteAllowedFileSystemRoots },
    host: "127.0.0.1",
    port: 5173,
    strictPort: false
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: false
  }
};
