// @ts-check

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "../aerobeat-environment-community/.testbed/assets/models/alien-moon-icescape");
const payloadRoot = resolve(root, "assets/environments/alien-moon-icescape/1.0.0");
const GLB_FILE = "alien-moon-icescape.glb";
const CONFIG_FILE = "alien-moon-icescape.config.yaml";
const MANIFEST_FILE = "manifest.json";
const EXPECTED_CONFIG = "transform:\n  position: [0.0, 0.0, 0.0]\n  rotation_degrees: [0.0, 0.0, 0.0]\n  scale: [1.0, 1.0, 1.0]\n";
const EXPECTED_FILES = Object.freeze({
  [CONFIG_FILE]: Object.freeze({ bytes: 100, sha256: "1e50a9416dc2e506284919947088df812da54e537df69be5ec002c4cc167e788" }),
  [GLB_FILE]: Object.freeze({ bytes: 6149400, sha256: "40e38a7bdce9eab4266d8bb19510a95bb4e0410534f3f14a500f36fac2b65077" })
});
const manifest = {
  schema: "aerobeat/environment-runtime-asset-manifest", version: 1, assetId: "alien-moon-icescape", assetVersion: "1.0.0",
  source: { ownership: "owned-local-source", repository: "aerobeat-environment-community", path: ".testbed/assets/models/alien-moon-icescape", glb: GLB_FILE, config: CONFIG_FILE, thirdPartyAcquisitionForThisAssembly: false },
  payload: { glb: { path: GLB_FILE, ...EXPECTED_FILES[GLB_FILE] }, config: { path: CONFIG_FILE, ...EXPECTED_FILES[CONFIG_FILE] } },
  glbContract: {
    container: "glTF-2.0-binary", externalUris: false, embeddedImages: [{ mimeType: "image/png", bufferView: 3 }], extensionsUsed: ["KHR_materials_unlit"], extensionsRequired: [], materialExtensions: ["KHR_materials_unlit"],
    nominalBounds: { min: [-30, -30, -30], max: [30, 30, 30] },
    positionAccessorBounds: { min: [-29.999984741210938, -30.000003814697266, -30], max: [30.000001907348633, 30, 30] }, boundsTolerance: 0.00002
  },
  transform: { position: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1] },
  provenance: { copyOperation: "byte-exact local copy", networkUsed: false, thirdPartyAssetAcquiredForThisAssembly: false, externalPayloadCopied: false, sourceMetadataRetainedInGlb: true }
};
const canonicalManifest = `${JSON.stringify(manifest, null, 2)}\n`;
const mode = process.argv[2] ?? "verify";
if (!new Set(["sync", "verify"]).has(mode) || process.argv.length > 3) throw new Error("Usage: node scripts/sync-environment-assets.js [sync|verify]");

verifyInputs(sourceRoot, "source");
if (mode === "sync") {
  mkdirSync(payloadRoot, { recursive: true });
  for (const name of Object.keys(EXPECTED_FILES)) copyFileSync(resolve(sourceRoot, name), resolve(payloadRoot, name));
  writeFileSync(resolve(payloadRoot, MANIFEST_FILE), canonicalManifest);
}
verifyPayload();
console.log(`Alien moon environment ${mode} passed: ${Object.keys(EXPECTED_FILES).length} exact source files, 3-file payload.`);

/** @param {string} directory @param {string} label */
function verifyInputs(directory, label) {
  for (const [name, expected] of Object.entries(EXPECTED_FILES)) verifyFile(resolve(directory, name), expected, `${label} ${name}`);
  assert.equal(readFileSync(resolve(directory, CONFIG_FILE), "utf8"), EXPECTED_CONFIG, `${label} config bytes drifted`);
  verifyGlb(readFileSync(resolve(directory, GLB_FILE)));
}
function verifyPayload() {
  assert.deepEqual(readdirSync(payloadRoot).sort(), [CONFIG_FILE, GLB_FILE, MANIFEST_FILE].sort(), "environment payload contains missing or extra files");
  verifyInputs(payloadRoot, "payload");
  assert.equal(readFileSync(resolve(payloadRoot, MANIFEST_FILE), "utf8"), canonicalManifest, "environment manifest drifted");
}
/** @param {string} path @param {{bytes:number,sha256:string}} expected @param {string} label */
function verifyFile(path, expected, label) {
  const bytes = readFileSync(path);
  assert.equal(bytes.byteLength, expected.bytes, `${label} byte length drifted`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, `${label} SHA-256 drifted`);
}
/** @param {Buffer} bytes */
function verifyGlb(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", "GLB magic drifted");
  assert.equal(bytes.readUInt32LE(4), 2, "GLB version drifted");
  assert.equal(bytes.readUInt32LE(8), bytes.byteLength, "GLB declared length drifted");
  const jsonLength = bytes.readUInt32LE(12); assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, "GLB JSON chunk is missing");
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trimEnd());
  assert.deepEqual(json.extensionsUsed, ["KHR_materials_unlit"], "GLB extension use drifted");
  assert.deepEqual(json.extensionsRequired ?? [], [], "GLB required extensions drifted");
  assert(json.buffers.every((buffer) => buffer.uri === undefined), "GLB contains an external buffer URI");
  assert.deepEqual(json.images, [{ bufferView: 3, mimeType: "image/png" }], "GLB must contain exactly one embedded PNG and no external image URI");
  assert(json.materials.length > 0 && json.materials.every((material) => Object.keys(material.extensions ?? {}).length === 1 && material.extensions.KHR_materials_unlit), "GLB materials must use only KHR_materials_unlit");
  const position = json.accessors.find((accessor) => accessor.type === "VEC3" && Array.isArray(accessor.min) && Math.max(...accessor.max) > 29);
  assert(position, "GLB position bounds accessor is missing");
  assert.deepEqual(position.min, manifest.glbContract.positionAccessorBounds.min, "GLB minimum bounds drifted");
  assert.deepEqual(position.max, manifest.glbContract.positionAccessorBounds.max, "GLB maximum bounds drifted");
  for (let axis = 0; axis < 3; axis += 1) {
    assert(Math.abs(position.min[axis] + 30) <= manifest.glbContract.boundsTolerance, `GLB minimum axis ${axis} exceeds nominal -30 bound tolerance`);
    assert(Math.abs(position.max[axis] - 30) <= manifest.glbContract.boundsTolerance, `GLB maximum axis ${axis} exceeds nominal +30 bound tolerance`);
  }
}
