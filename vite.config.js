// @ts-check

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeReleaseFingerprint } from "./scripts/release-fingerprint.js";

const basePath = process.env.AEROBEAT_BASE_PATH ?? "/";
const tailscaleHost = "derrick-alienware-aurora-r13.tail613fcb.ts.net";
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const rendererGameplayRoot = new URL("../aerobeat-web-renderer/assets/gameplay/0.0.2/", import.meta.url);
const rendererGameplayInventoryBytes = readFileSync(new URL("inventory.v1.json", rendererGameplayRoot));
if (createHash("sha256").update(rendererGameplayInventoryBytes).digest("hex") !== "1a5b66f543bae940b8bb789e9ab9979d073663b5f6ff12382e08f4ad10c0ff1b") throw new Error("Linked renderer gameplay inventory hash drifted");
const rendererGameplayInventory = JSON.parse(rendererGameplayInventoryBytes.toString("utf8"));
const rendererGameplayGlbs = rendererGameplayInventory.payload.filter((entry) => entry.path.endsWith(".glb"));
if (rendererGameplayGlbs.length !== 7) throw new Error("Linked renderer gameplay GLB inventory drifted");
const environmentAssetRoot = new URL("./assets/environments/luminious-ice-cave-photosphere/1.0.0/", import.meta.url);
const environmentAssets = Object.freeze([
  Object.freeze({ path: "luminious-ice-cave-photosphere.config.yaml", sha256: "d415e7de8cdc9c78cfc2d3261b9f50a0d9cb626fe8e368bec43de2c8e686fb42" }),
  Object.freeze({ path: "luminious-ice-cave-photosphere.jpg", sha256: "ff142b3ce3d3509ab3cfafcfc6a8cc2d3b0ff737852072d3a7aea8075478eed5" }),
  Object.freeze({ path: "manifest.json", sha256: "524c7a5623dfbafb65590a9b3b78dc894d4341165d564ac267d470f03acf7e80" })
]);
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
        this.emitFile({ type: "asset", fileName: `assets/gameplay/0.0.2/${asset.path}`, source });
      }
      for (const asset of environmentAssets) {
        const source = readFileSync(new URL(asset.path, environmentAssetRoot));
        if (createHash("sha256").update(source).digest("hex") !== asset.sha256) throw new Error(`Assembly environment asset drifted: ${asset.path}`);
        this.emitFile({ type: "asset", fileName: `assets/environments/luminious-ice-cave-photosphere/1.0.0/${asset.path}`, source });
      }
    }
  }],
  define: {
    __AEROBEAT_BUILD_STAMP__: JSON.stringify(buildStamp),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(cacheBust),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(packageJson.version)
  },
  resolve: {
    alias: [{ find: /^@aerobeat\/web-ui$/u, replacement: fileURLToPath(new URL("../aerobeat-web-ui/src/index.js", import.meta.url)) }],
    preserveSymlinks: false
  },
  optimizeDeps: {
    exclude: ["@aerobeat/web-content-authoring", "@aerobeat/web-contracts", "@aerobeat/web-gameplay", "@aerobeat/web-renderer", "@aerobeat/web-ui"]
  },
  server: {
    allowedHosts: [tailscaleHost],
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
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
