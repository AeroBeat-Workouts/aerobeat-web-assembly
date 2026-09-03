// @ts-check

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { build } from "vite";
import { listReleaseFingerprintInputs } from "./release-fingerprint.js";
import { luminiousIceCavePhotosphereAsset } from "../src/luminious-ice-cave-photosphere-asset.js";

const root = process.cwd();
const environmentRoot = "assets/environments/luminious-ice-cave-photosphere/1.0.0";
const JPEG_HASH = "ff142b3ce3d3509ab3cfafcfc6a8cc2d3b0ff737852072d3a7aea8075478eed5";
const CONFIG_HASH = "d415e7de8cdc9c78cfc2d3261b9f50a0d9cb626fe8e368bec43de2c8e686fb42";
const MANIFEST_HASH = "524c7a5623dfbafb65590a9b3b78dc894d4341165d564ac267d470f03acf7e80";
const REJECTED_CONTENT = Object.freeze([["Luis", "Vidal"].join(" "), ["Sketch", "fab"].join(""), ["bfc9a041814f4112", "b016904edfaad0c5"].join(""), ["alien", "moon", "icescape"].join("-")]);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = readFileSync("package-lock.json", "utf8");
const source = readFileSync("src/index.js", "utf8");
const descriptorSource = readFileSync("src/luminious-ice-cave-photosphere-asset.js", "utf8");
const expectedDescriptor = {
  id: "luminious-ice-cave-photosphere", url: luminiousIceCavePhotosphereAsset.url, mimeType: "image/jpeg", bytes: 2210289, sha256: JPEG_HASH,
  projection: "equirectangular", dimensions: [4096, 2048], orientation: { yaw: 0, pitch: 0, roll: 0 }, centerForward: [0, 0, -1], worldUp: [0, 1, 0]
};

assert(Object.isFrozen(luminiousIceCavePhotosphereAsset));
for (const key of ["dimensions", "orientation", "centerForward", "worldUp"]) assert(Object.isFrozen(luminiousIceCavePhotosphereAsset[key]), `${key} must be frozen`);
assert.deepEqual(luminiousIceCavePhotosphereAsset, expectedDescriptor, "assembly descriptor drifted from renderer aaebf80 contract");
assert.deepEqual(Object.keys(luminiousIceCavePhotosphereAsset).sort(), ["bytes", "centerForward", "dimensions", "id", "mimeType", "orientation", "projection", "sha256", "url", "worldUp"], "descriptor keys drifted");
assert.equal(new URL(luminiousIceCavePhotosphereAsset.url).protocol, "file:", "source descriptor URL must resolve package-relatively");
assert.match(new URL(luminiousIceCavePhotosphereAsset.url).pathname, /\/assets\/environments\/luminious-ice-cave-photosphere\/1\.0\.0\/luminious-ice-cave-photosphere\.jpg$/u);
assert.equal(hash(readFileSync(new URL(luminiousIceCavePhotosphereAsset.url))), JPEG_HASH);
assert.match(descriptorSource, /new URL\("\.\.\/assets\/environments\/luminious-ice-cave-photosphere\/1\.0\.0\/luminious-ice-cave-photosphere\.jpg", import\.meta\.url\)\.href/u, "Vite cannot statically discover the literal JPEG URL");
assert.equal(Object.values(packageJson.exports).includes("./src/luminious-ice-cave-photosphere-asset.js"), false, "environment descriptor must not become a public package export");
assert.equal(packageJson.dependencies["@aerobeat/branding"], undefined); assert.doesNotMatch(packageLock, /aerobeat-branding|@aerobeat\/branding/u);
for (const token of ["webGameplayIconBundle", "rasterizeBrandingIconAtlas", "uploadIconAtlas", "beginIconAtlasInitialization", "restartIconAtlasIfPending", "iconAtlasGeneration", "iconAtlasAbort"]) assert.equal(source.includes(token), false, `assembly retained obsolete atlas token ${token}`);
const snapshotBody = source.slice(source.indexOf("  getSnapshot()"), source.indexOf("  /** Terminal until", source.indexOf("  getSnapshot()")));
assert.doesNotMatch(snapshotBody, /luminiousIceCave|environmentAsset|2210289|ff142b3c|d415e7de|524c7a56/u, "private environment identity or payload metadata entered public snapshots");

const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
assert.equal(packed.length, 1); const packedPaths = packed[0].files.map((file) => file.path);
const expectedPackedPayload = [`${environmentRoot}/luminious-ice-cave-photosphere.config.yaml`, `${environmentRoot}/luminious-ice-cave-photosphere.jpg`, `${environmentRoot}/manifest.json`];
assert.deepEqual(packedPaths.filter((path) => path.startsWith("assets/environments/")), expectedPackedPayload, "npm package environment inventory drifted");
assert.equal(packedPaths.some((path) => /(?:\.glb$|\.ply$|(?:^|\/)(?:pos|neg)_[xyz]\.png$)/iu.test(path) || REJECTED_CONTENT.some((token) => path.toLowerCase().includes(token.toLowerCase()))), false, "npm package contains rejected GLB, source PLY, standalone cube face, or obsolete environment path");
assert.equal(hash(readFileSync(expectedPackedPayload[0])), CONFIG_HASH); assert.equal(hash(readFileSync(expectedPackedPayload[1])), JPEG_HASH); assert.equal(hash(readFileSync(expectedPackedPayload[2])), MANIFEST_HASH);

const fingerprintInputs = listReleaseFingerprintInputs(root).map((path) => relative(root, path));
assert.deepEqual(fingerprintInputs.filter((path) => path.startsWith("assets/environments/")), expectedPackedPayload, "release fingerprint omitted assembly environment source truth");
const rendererInputs = fingerprintInputs.filter((path) => path.startsWith("../aerobeat-web-renderer/assets/gameplay/0.0.2/"));
assert.equal(rendererInputs.length, 17, "release fingerprint must include all 17 linked renderer gameplay asset records");
const rendererGlbs = rendererInputs.filter((path) => path.endsWith(".glb"));
assert.equal(rendererGlbs.length, 7, "release fingerprint must include the seven linked renderer GLBs");
const rendererInventoryPath = resolve(root, "../aerobeat-web-renderer/assets/gameplay/0.0.2/inventory.v1.json");
const rendererProofPath = resolve(root, "../aerobeat-web-renderer/assets/gameplay/0.0.2/proof.v1.json");
assert.equal(hash(readFileSync(rendererInventoryPath)), "1a5b66f543bae940b8bb789e9ab9979d073663b5f6ff12382e08f4ad10c0ff1b", "linked renderer gameplay inventory hash drifted");
assert.equal(hash(readFileSync(rendererProofPath)), "90dcbe52b35d2ec11a01784a96f195b5cd01ac141000886cb950c74864eec288", "linked renderer gameplay proof hash drifted");
const rendererInventory = JSON.parse(readFileSync(rendererInventoryPath, "utf8"));
const expectedGlbs = rendererInventory.payload.filter((entry) => entry.path.endsWith(".glb"));
assert.equal(expectedGlbs.length, 7);
for (const entry of expectedGlbs) {
  const path = resolve(root, "../aerobeat-web-renderer/assets/gameplay/0.0.2", entry.path);
  assert(rendererGlbs.includes(relative(root, path)), `release fingerprint omitted renderer GLB ${entry.path}`);
  const bytes = readFileSync(path); assert.equal(bytes.byteLength, entry.bytes); assert.equal(hash(bytes), entry.sha256);
}

const result = await build({ logLevel: "silent", build: { write: false } });
const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output);
const builtAssets = outputs.filter((entry) => entry.type === "asset").map((entry) => ({ fileName: entry.fileName, bytes: Buffer.from(entry.source) }));
assert.equal(builtAssets.some(({ bytes }) => bytes.byteLength === 2210289 && hash(bytes) === JPEG_HASH), true, "Vite omitted or changed the exact photosphere JPEG");
for (const entry of expectedGlbs) assert.equal(builtAssets.some(({ bytes }) => bytes.byteLength === entry.bytes && hash(bytes) === entry.sha256), true, `Vite omitted or changed renderer GLB ${entry.path}`);
assert.equal(builtAssets.filter(({ fileName }) => fileName.endsWith(".glb")).length, 7, "Vite emitted a GLB outside the seven approved renderer gameplay assets");
assert.equal(builtAssets.some(({ fileName }) => /\.ply$|(?:pos|neg)_[xyz]\.png$/iu.test(fileName) || REJECTED_CONTENT.some((token) => fileName.toLowerCase().includes(token.toLowerCase()))), false, "Vite emitted rejected source PLY/standalone cube face payload");
const chunks = outputs.filter((entry) => entry.type === "chunk").map((entry) => entry.code).join("\n");
assert.doesNotMatch(chunks, /aerobeat-branding|web-gameplay-assets|rasterizeBrandingIconAtlas/u, "build retained obsolete atlas code");
assert.equal(REJECTED_CONTENT.some((token) => chunks.toLowerCase().includes(token.toLowerCase())), false, "build retained rejected third-party metadata");

const currentFiles = ["README.md", "package.json", "package-lock.json", "vite.config.js"].map((path) => resolve(root, path)).concat(["src", "scripts", "assets", "docs"].flatMap((directory) => walkFiles(resolve(root, directory))));
for (const path of currentFiles) {
  if (!/\.(?:js|json|md|yaml|yml|html)$/u.test(path)) continue;
  const text = readFileSync(path, "utf8").toLowerCase();
  assert.equal(REJECTED_CONTENT.some((token) => text.includes(token.toLowerCase())), false, `current nonhistorical file retained rejected environment reference: ${relative(root, path)}`);
}
console.log(`Owned photosphere descriptor/privacy, no-atlas source, exact package/build payload, and fingerprint coverage passed (${packed[0].files.length} package files; ${rendererInputs.length} renderer asset inputs).`);

/** @param {Uint8Array} bytes */
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
/** @param {string} directory @returns {string[]} */
function walkFiles(directory) { return readdirSync(directory).flatMap((entry) => { const path = resolve(directory, entry); return statSync(path).isDirectory() ? walkFiles(path) : [path]; }); }
