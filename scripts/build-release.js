// @ts-check

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { build } from "vite";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const proofVersion = packageJson.version;

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

const artifactFiles = walkFiles(releaseRoot).map((filePath) => relative(releaseRoot, filePath));
const runtimeWasmAssets = artifactFiles.filter((filePath) => filePath.endsWith(".wasm"));
const runtimeJavaScriptAssets = artifactFiles.filter((filePath) => filePath.endsWith(".js"));
if (runtimeWasmAssets.length === 0) {
  throw new Error("Release omitted ONNX Runtime WASM assets.");
}
const assembledJavaScript = runtimeJavaScriptAssets
  .map((filePath) => readFileSync(resolve(releaseRoot, filePath), "utf8"))
  .join("\n");
for (const requiredMarker of ["poseBackend", "mediapipe", "onnxruntime", "movenet"]) {
  if (!assembledJavaScript.includes(requiredMarker)) {
    throw new Error(`Release omitted selected-backend marker ${requiredMarker}.`);
  }
}
const onnxModelAssetPath = "models/rtmpose-t/end2end.onnx";
const onnxModelIncluded = existsSync(resolve(releaseRoot, onnxModelAssetPath));
const basePath = process.env.AEROBEAT_BASE_PATH ?? "/";

const manifestPath = resolve(releaseRoot, "aerobeat-release-proof.json");
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      artifactKind: "raw-unminified-browser-proof",
      packageName: "@aerobeat/web-assembly",
      proofVersion,
      createdAt: new Date().toISOString(),
      minified: false,
      basePath,
      poseBackends: ["movenet", "mediapipe", "onnxruntime"],
      runtimeJavaScriptAssets,
      runtimeWasmAssets,
      onnxModelPolicy: {
        bundledByDefault: false,
        expectedSameOriginPath: `${basePath.replace(/\/$/u, "")}/${onnxModelAssetPath}`,
        includedInThisArtifact: onnxModelIncluded,
        prepareCommand: "npm run model:prepare:onnx"
      }
    },
    null,
    2
  )}\n`
);

console.log(`Raw ${proofVersion} release proof created at ${releaseRoot}`);
console.log(`ONNX model included: ${onnxModelIncluded ? "yes" : "no - run npm run model:prepare:onnx for real ONNX runtime proof"}`);

/**
 * @param {string} root
 * @returns {string[]}
 */
function walkFiles(root) {
  return readdirSync(root)
    .flatMap((entry) => {
      const entryPath = resolve(root, entry);
      return statSync(entryPath).isDirectory() ? walkFiles(entryPath) : [entryPath];
    });
}
