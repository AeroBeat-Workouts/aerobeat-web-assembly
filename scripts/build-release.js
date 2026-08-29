// @ts-check

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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

const absoluteArtifactFiles = walkFiles(releaseRoot);
const artifactFiles = absoluteArtifactFiles.map((filePath) => relative(releaseRoot, filePath));
const runtimeWasmAssets = artifactFiles.filter((filePath) => filePath.endsWith(".wasm"));
const runtimeJavaScriptAssets = artifactFiles.filter((filePath) => filePath.endsWith(".js"));
const totalArtifactBytesBeforeManifest = absoluteArtifactFiles
  .reduce((total, filePath) => total + statSync(filePath).size, 0);
const forbiddenRuntimeAsset = artifactFiles.find((filePath) => /(?:movenet|onnx|ort-wasm|pose-detection|tensorflow)/iu.test(filePath));
if (forbiddenRuntimeAsset) {
  throw new Error(`Release contains forbidden non-MediaPipe runtime asset ${forbiddenRuntimeAsset}.`);
}
const assembledJavaScript = runtimeJavaScriptAssets
  .map((filePath) => readFileSync(resolve(releaseRoot, filePath), "utf8"))
  .join("\n");
for (const requiredMarker of ["Pose Landmarker Lite float16 /1/", "mediapipe", "gpu-webgl", "standard", "measured", "submissionCadenceTargetFps"]) {
  if (!assembledJavaScript.includes(requiredMarker)) {
    throw new Error(`Release omitted locked MediaPipe marker ${requiredMarker}.`);
  }
}
for (const forbiddenRuntimeMarker of [
  "@tensorflow-models/pose-detection",
  "onnxruntime-web",
  "createMoveNetPoseAdapter",
  "createOnnxRuntimePoseAdapter"
]) {
  if (assembledJavaScript.includes(forbiddenRuntimeMarker)) {
    throw new Error(`Release contains forbidden non-MediaPipe runtime marker ${forbiddenRuntimeMarker}.`);
  }
}
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
      productionPoseConfiguration: {
        backend: "mediapipe",
        provider: "gpu-webgl",
        model: "pose-landmarker-lite",
        modelVariant: "float16/1",
        tasksVisionVersion: "1.0.1",
        tuning: "standard",
        thresholds: [0.5, 0.5, 0.5],
        tracking: "fast",
        performancePreset: "full",
        gameplaySource: "measured",
        submissionCadenceTargetFps: 15
      },
      concretePoseVendors: ["@aerobeat/web-vendor-mediapipe"],
      poseBackends: ["mediapipe"],
      runtimeJavaScriptAssets,
      runtimeWasmAssets,
      totalArtifactBytesBeforeManifest,
      forbiddenRuntimeAssetPatternsChecked: ["movenet", "onnx", "ort-wasm", "pose-detection", "tensorflow"]
    },
    null,
    2
  )}\n`
);

console.log(`Raw ${proofVersion} MediaPipe-only release proof created at ${releaseRoot}`);
console.log(`Artifact bytes before manifest: ${totalArtifactBytesBeforeManifest}`);

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
