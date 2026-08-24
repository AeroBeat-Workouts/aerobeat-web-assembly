// @ts-check

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const buildStamp = new Date().toISOString();
const cacheBust = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const basePath = process.env.AEROBEAT_BASE_PATH ?? "/";
const tailscaleHost = "derrick-alienware-aurora-r13.tail613fcb.ts.net";
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

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
    alias: {
      "@mediapipe/pose": fileURLToPath(new URL("./src/mediapipe-pose-shim.js", import.meta.url))
    },
    preserveSymlinks: true
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
