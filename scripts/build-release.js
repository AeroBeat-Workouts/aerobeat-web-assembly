// @ts-check

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";

/**
 * Raw proof release version for the first assembly artifact pass.
 *
 * @type {"0.0.1"}
 */
const proofVersion = "0.0.1";

const releaseRoot = resolve("release", "raw", proofVersion);
rmSync(releaseRoot, { force: true, recursive: true });
mkdirSync(releaseRoot, { recursive: true });

await build({
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: releaseRoot,
    sourcemap: true,
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name].js"
      }
    }
  },
  configFile: "vite.config.js",
  mode: "release"
});

const manifestPath = resolve(releaseRoot, "aerobeat-release-proof.json");
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      artifactKind: "raw-unminified-browser-proof",
      packageName: "@aerobeat/web-assembly",
      proofVersion,
      createdAt: new Date().toISOString(),
      minified: false
    },
    null,
    2
  )}\n`
);

console.log(`Raw ${proofVersion} release proof created at ${releaseRoot}`);
