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
const rendererGameplayRoot = new URL("../aerobeat-web-renderer/assets/gameplay/0.0.11/", import.meta.url);
const rendererGameplayInventoryBytes = readFileSync(new URL("inventory.v1.json", rendererGameplayRoot));
if (createHash("sha256").update(rendererGameplayInventoryBytes).digest("hex") !== "e65571211e7a5a44224c378dbb654afd56263dc37f427a9b3f0af6453a6f1d23") throw new Error("Linked renderer gameplay inventory hash drifted");
const rendererGameplayProofBytes = readFileSync(new URL("proof.v1.json", rendererGameplayRoot));
if (createHash("sha256").update(rendererGameplayProofBytes).digest("hex") !== "0c194b1a8f290cfe387ee34154199cc0758ace8baf9b60fa4a3beb5bdddf4227") throw new Error("Linked renderer gameplay proof hash drifted");
const rendererGameplayInventory = JSON.parse(rendererGameplayInventoryBytes.toString("utf8"));
const rendererGameplayGlbs = rendererGameplayInventory.payload.filter((entry) => entry.path.endsWith(".glb"));
if (rendererGameplayGlbs.length !== 7) throw new Error("Linked renderer gameplay GLB inventory drifted");
const sourceFingerprint = computeReleaseFingerprint(new URL(".", import.meta.url).pathname);
const buildStamp = `source:${sourceFingerprint}`;
const cacheBust = `${packageJson.version}-${sourceFingerprint.slice(0, 16)}`;

/** kl80: read + hash-anchor the branding-derived favicon (single source of truth). */
function readFavicon() {
  const bytes = readFileSync(new URL("./assets/favicon/favicon.ico", import.meta.url));
  if (createHash("sha256").update(bytes).digest("hex") !== "5e8ac126cbef7a8a82b00b86c91ea656b61ea34d2afb1bd445c3edfe594ddc65") throw new Error("Favicon bytes drifted from the branding anchor");
  return bytes;
}

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
        this.emitFile({ type: "asset", fileName: `assets/gameplay/0.0.11/${asset.path}`, source });
      }
      for (const asset of environmentAssetFiles) {
        const source = readFileSync(new URL(`./${asset.path}`, import.meta.url));
        if (source.byteLength !== asset.bytes || createHash("sha256").update(source).digest("hex") !== asset.sha256) throw new Error(`Assembly environment asset drifted: ${asset.path}`);
        this.emitFile({ type: "asset", fileName: asset.path, source });
      }
      // kl80: ship the branding-derived favicon at the build root as `favicon.ico`.
      // The bytes are anchored by scripts/validate-favicon-provenance.js; a hash
      // drift here fails the build exactly like every other owned asset.
      const faviconSource = readFavicon();
      this.emitFile({ type: "asset", fileName: "favicon.ico", source: faviconSource });
    },
    // Serve /favicon.ico during dev (emitFile only runs for builds). The same
    // pinned-hash guard applies so dev and prod can never diverge.
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = (request.url ?? "").split("?")[0];
        if (url !== "/favicon.ico" && url !== `${basePath}favicon.ico`) return next();
        try {
          const bytes = readFavicon();
          response.statusCode = 200;
          response.setHeader("content-type", "image/x-icon");
          response.setHeader("cache-control", "no-store");
          response.end(bytes);
        } catch {
          response.statusCode = 500;
          response.end("favicon unavailable");
        }
      });
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
