// @ts-check

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { build } from "vite";
import { computeReleaseFingerprint, readReleaseDependencyProvenance } from "./release-fingerprint.js";
import { claimAppendOnlyReleaseTarget } from "./release-target-policy.js";
import { validateProductionHashBundle } from "./production-hash-bundle-policy.js";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const proofVersion = packageJson.version;
const releaseRoot = resolve("release", "raw", proofVersion);
claimAppendOnlyReleaseTarget(releaseRoot);
const sourceFingerprint = computeReleaseFingerprint();

await build({
  build: {
    emptyOutDir: false,
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
if (computeReleaseFingerprint() !== sourceFingerprint) throw new Error("Release inputs changed while the deterministic build was running");

const absoluteArtifactFiles = walkFiles(releaseRoot);
const artifactFiles = absoluteArtifactFiles.map((filePath) => relative(releaseRoot, filePath));
const runtimeWasmAssets = artifactFiles.filter((filePath) => filePath.endsWith(".wasm"));
const runtimeJavaScriptAssets = artifactFiles.filter((filePath) => filePath.endsWith(".js"));
if (runtimeWasmAssets.length !== 0) throw new Error("Release contains an unexpected WASM runtime asset");
const hashBundleEvidence = validateProductionHashBundle([
  ...runtimeJavaScriptAssets.map((fileName) => ({ type: "chunk", fileName, code: readFileSync(resolve(releaseRoot, fileName), "utf8") })),
  ...artifactFiles.filter((fileName) => fileName.endsWith(".js.map")).map((fileName) => ({ type: "asset", fileName, source: readFileSync(resolve(releaseRoot, fileName)) }))
]);
const totalArtifactBytesBeforeManifest = absoluteArtifactFiles
  .reduce((total, filePath) => total + statSync(filePath).size, 0);
const forbiddenRuntimeAsset = artifactFiles.find((filePath) => /(?:movenet|onnx|ort-wasm|pose-detection|tensorflow)/iu.test(filePath));
if (forbiddenRuntimeAsset) {
  throw new Error(`Release contains forbidden non-MediaPipe runtime asset ${forbiddenRuntimeAsset}.`);
}
const assembledJavaScript = runtimeJavaScriptAssets
  .map((filePath) => readFileSync(resolve(releaseRoot, filePath), "utf8"))
  .join("\n");
for (const requiredMarker of ["Pose Landmarker Lite float16 /1/", "mediapipe", "cpu-wasm", "VideoFrame", "standard", "measured", "submissionCadenceTargetFps"]) {
  if (!assembledJavaScript.includes(requiredMarker)) {
    throw new Error(`Release omitted locked MediaPipe marker ${requiredMarker}.`);
  }
}
const forbiddenRuntimeMarkersChecked = Object.freeze([
  "tensorflow", "onnx", "movenet", "predictive", "predictedpose",
  "responsive a/b", "direct-256", "experimental-worker-videoframe"
]);
for (const forbiddenRuntimeMarker of forbiddenRuntimeMarkersChecked) {
  if (assembledJavaScript.toLowerCase().includes(forbiddenRuntimeMarker)) {
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
      sourceFingerprint,
      dependencyProvenance: readReleaseDependencyProvenance(),
      minified: false,
      basePath,
      productionPoseConfiguration: {
        backend: "mediapipe",
        provider: "cpu-wasm",
        executionLocation: "worker",
        transferFrameType: "VideoFrame",
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
      hashBundleEvidence,
      totalArtifactBytesBeforeManifest,
      forbiddenRuntimeAssetPatternsChecked: ["movenet", "onnx", "ort-wasm", "pose-detection", "tensorflow"],
      forbiddenRuntimeMarkersChecked
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
