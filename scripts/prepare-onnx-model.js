// @ts-check

import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { rtmposeModelByteLength, rtmposeModelFilename, rtmposeModelSha256 } from "@aerobeat/web-vendor-onnxruntime";

const vendorRoot = resolve("..", "aerobeat-web-vendor-onnxruntime");
const vendorAssetRoot = resolve(vendorRoot, ".testbed", "model-assets", "rtmpose-t-body7");
const publicAssetRoot = resolve("public", "models", "rtmpose-t");

const fetchResult = spawnSync("npm", ["run", "model:fetch"], {
  cwd: vendorRoot,
  encoding: "utf8",
  stdio: "inherit"
});
if (fetchResult.status !== 0) {
  throw new Error(`ONNX vendor model acquisition failed with exit ${fetchResult.status ?? "unknown"}.`);
}

const sourceModel = resolve(vendorAssetRoot, rtmposeModelFilename);
const modelBytes = readFileSync(sourceModel);
const actualSha256 = createHash("sha256").update(modelBytes).digest("hex");
if (modelBytes.byteLength !== rtmposeModelByteLength || actualSha256 !== rtmposeModelSha256) {
  throw new Error(`Prepared RTMPose model verification failed: ${modelBytes.byteLength} bytes / ${actualSha256}.`);
}

rmSync(publicAssetRoot, { recursive: true, force: true });
mkdirSync(publicAssetRoot, { recursive: true });
cpSync(sourceModel, resolve(publicAssetRoot, rtmposeModelFilename));
cpSync(resolve(vendorAssetRoot, "provenance.json"), resolve(publicAssetRoot, "provenance.json"));
console.log(`Prepared same-origin ONNX model at ${resolve(publicAssetRoot, rtmposeModelFilename)}.`);
