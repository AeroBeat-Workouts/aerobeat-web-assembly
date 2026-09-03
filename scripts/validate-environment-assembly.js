// @ts-check

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { build } from "vite";
import { alienMoonEnvironmentAsset } from "../src/alien-moon-environment-asset.js";

const GLB_HASH = "40e38a7bdce9eab4266d8bb19510a95bb4e0410534f3f14a500f36fac2b65077";
const CONFIG_HASH = "1e50a9416dc2e506284919947088df812da54e537df69be5ec002c4cc167e788";
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = readFileSync("package-lock.json", "utf8");
const source = readFileSync("src/index.js", "utf8");
const descriptorSource = readFileSync("src/alien-moon-environment-asset.js", "utf8");

assert(Object.isFrozen(alienMoonEnvironmentAsset));
assert(Object.isFrozen(alienMoonEnvironmentAsset.glb)); assert(Object.isFrozen(alienMoonEnvironmentAsset.config)); assert(Object.isFrozen(alienMoonEnvironmentAsset.transform));
assert(Object.values(alienMoonEnvironmentAsset.transform).every(Object.isFrozen), "identity transform vectors must be frozen");
assert.deepEqual({ id: alienMoonEnvironmentAsset.id, version: alienMoonEnvironmentAsset.version, glb: alienMoonEnvironmentAsset.glb, config: alienMoonEnvironmentAsset.config, transform: alienMoonEnvironmentAsset.transform }, {
  id: "alien-moon-icescape", version: "1.0.0", glb: { bytes: 6149400, sha256: GLB_HASH }, config: { bytes: 100, sha256: CONFIG_HASH }, transform: { position: [0,0,0], rotationDegrees: [0,0,0], scale: [1,1,1] }
});
for (const url of [alienMoonEnvironmentAsset.glbUrl, alienMoonEnvironmentAsset.configUrl, alienMoonEnvironmentAsset.manifestUrl]) assert.equal(new URL(url).protocol, "file:", "source descriptor URL must resolve package-relatively");
assert.equal(hash(readFileSync(new URL(alienMoonEnvironmentAsset.glbUrl))), GLB_HASH); assert.equal(hash(readFileSync(new URL(alienMoonEnvironmentAsset.configUrl))), CONFIG_HASH);
assert.equal(Object.values(packageJson.exports).includes("./src/alien-moon-environment-asset.js"), false, "environment descriptor must not become a public package export");
assert.equal(packageJson.dependencies["@aerobeat/branding"], undefined); assert.doesNotMatch(packageLock, /aerobeat-branding|@aerobeat\/branding/u);
for (const token of ["webGameplayIconBundle","rasterizeBrandingIconAtlas","uploadIconAtlas","beginIconAtlasInitialization","restartIconAtlasIfPending","iconAtlasGeneration","iconAtlasAbort"]) assert.equal(source.includes(token), false, `assembly retained obsolete atlas token ${token}`);
assert.match(descriptorSource, /Not part of the package exports or host snapshot contract/u);
const snapshotBody = source.slice(source.indexOf("  getSnapshot()"), source.indexOf("  /** Terminal until", source.indexOf("  getSnapshot()")));
assert.doesNotMatch(snapshotBody, /alienMoon|environmentAsset|6149400|40e38a7b|1e50a941/u, "private environment identity or payload metadata entered public snapshots");

const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
assert.equal(packed.length, 1); const packedPaths = packed[0].files.map((file) => file.path);
const expectedPackedPayload = ["assets/environments/alien-moon-icescape/1.0.0/alien-moon-icescape.config.yaml","assets/environments/alien-moon-icescape/1.0.0/alien-moon-icescape.glb","assets/environments/alien-moon-icescape/1.0.0/manifest.json"];
assert.deepEqual(packedPaths.filter((path) => path.startsWith("assets/environments/alien-moon-icescape/")), expectedPackedPayload, "npm package environment inventory drifted");
assert.equal(packedPaths.some((path) => /aerobeat-environment-community|alien-moon-icescape_0\.png|\.import$/u.test(path)), false, "npm package contains source-only or external environment payload");

const result = await build({ logLevel: "silent", build: { write: false } });
const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output);
const builtAssets = outputs.filter((entry) => entry.type === "asset").map((entry) => Buffer.from(entry.source));
assert.equal(builtAssets.some((bytes) => bytes.byteLength === 6149400 && hash(bytes) === GLB_HASH), true, "build omitted or changed exact GLB bytes");
assert.equal(builtAssets.some((bytes) => bytes.byteLength === 100 && hash(bytes) === CONFIG_HASH), true, "build omitted or changed exact config bytes");
const manifestBytes = readFileSync("assets/environments/alien-moon-icescape/1.0.0/manifest.json");
assert.equal(builtAssets.some((bytes) => bytes.equals(manifestBytes)), true, "build omitted or changed strict provenance manifest bytes");
const chunks = outputs.filter((entry) => entry.type === "chunk").map((entry) => entry.code).join("\n");
assert.doesNotMatch(chunks, /aerobeat-branding|web-gameplay-assets|rasterizeBrandingIconAtlas/u, "build retained obsolete production atlas code");

console.log(`Environment descriptor/privacy, no-atlas source, exact 3-file npm package and build payload passed (${packed[0].files.length} package files).`);

/** @param {Uint8Array} bytes */
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
