// @ts-check

import { readFileSync } from "node:fs";
import { computeReleaseFingerprint } from "./scripts/release-fingerprint.js";

const basePath = process.env.AEROBEAT_BASE_PATH ?? "/";
const tailscaleHost = "derrick-alienware-aurora-r13.tail613fcb.ts.net";
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
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
  define: {
    __AEROBEAT_BUILD_STAMP__: JSON.stringify(buildStamp),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(cacheBust),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(packageJson.version)
  },
  resolve: {
    preserveSymlinks: true
  },
  optimizeDeps: {
    exclude: ["@aerobeat/web-content-authoring", "@aerobeat/web-contracts", "@aerobeat/web-gameplay", "@aerobeat/web-renderer", "@aerobeat/web-ui"]
  },
  server: {
    allowedHosts: [tailscaleHost],
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
