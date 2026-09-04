// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { environmentArtifactComparisonIds, environmentAssetCatalog, environmentAssetClassifications } from "../src/environment-asset-catalog.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRepository = resolve(root, "../aerobeat-environment-community");
const sourceCommit = "c8fedde5a940c93b6e4d9fa35d5eba43ca3e6e23";
const sourceImagesRoot = resolve(sourceRepository, ".testbed/assets/images");
const payloadRoot = resolve(root, "assets/environments");
const catalogPath = resolve(sourceImagesRoot, "photosphere-catalog.json");
const catalogHash = "007c4bf63ac9cfccc062986ffa10f28f1bd438f0cabebbf387dee6c77b27cb9d";
const arguments_ = process.argv.slice(2);
if (![["sync"], ["verify"], ["sync", "--check"], []].some((expected) => expected.length === arguments_.length && expected.every((value, index) => value === arguments_[index]))) throw new Error("Usage: node scripts/sync-environment-assets.js [sync [--check]|verify]");
const mode = arguments_.includes("--check") ? "verify" : arguments_[0] ?? "verify";

assert.equal(git(["rev-parse", "HEAD"]), sourceCommit, "environment source repository HEAD drifted");
assert.equal(git(["status", "--porcelain", "--untracked-files=no"]), "", "environment source repository tracked files are dirty");
const catalogBytes = readFileSync(catalogPath);
assert.equal(hash(catalogBytes), catalogHash, "environment source catalog hash drifted");
const sourceCatalog = JSON.parse(catalogBytes.toString("utf8"));
assert.equal(sourceCatalog.entryCount, 8);
assert.deepEqual(sourceCatalog.entries.map((entry) => entry.id), environmentAssetCatalog.map((entry) => entry.descriptor.id), "ordered environment catalog ids drifted");

if (mode === "sync") rmSync(payloadRoot, { recursive:true, force:true });
for (let index = 0; index < environmentAssetCatalog.length; index += 1) {
  const entry = environmentAssetCatalog[index]; const sourceEntry = sourceCatalog.entries[index]; const id = entry.descriptor.id;
  assert.equal(entry.label, sourceEntry.label);
  assert.equal(sourceEntry.conversionAssessment.classification, environmentAssetClassifications[index]);
  assert.equal(environmentArtifactComparisonIds.includes(id), environmentAssetClassifications[index] === "comparison-with-artifacts");
  assert.deepEqual(sourceEntry.centerForward, [0,0,-1]); assert.deepEqual(sourceEntry.worldUp, [0,1,0]);
  const sourceDirectory = resolve(sourceImagesRoot, id);
  const sourceFiles = [sourceEntry.image, sourceEntry.config, sourceEntry.manifest];
  const allowedSourceNames = new Set(sourceFiles.map(({path}) => path.split("/").at(-1)));
  if (id === "luminious-ice-cave-photosphere") allowedSourceNames.add(`${id}.config.yaml`);
  const sourceInventory = readdirSync(sourceDirectory).filter((name) => !name.endsWith(".import")).sort();
  assert.deepEqual(sourceInventory, [...allowedSourceNames].sort(), `source inventory drifted for ${id}`);
  const targetDirectory = resolve(payloadRoot, id, "1.0.0");
  if (mode === "sync") mkdirSync(targetDirectory, { recursive:true });
  for (let fileIndex = 0; fileIndex < sourceFiles.length; fileIndex += 1) {
    const sourceFile = sourceFiles[fileIndex]; const expected = entry.files[fileIndex];
    assert.equal(sourceFile.bytes, expected.bytes); assert.equal(sourceFile.sha256, expected.sha256);
    const sourcePath = resolve(sourceRepository, sourceFile.path);
    const targetPath = resolve(root, expected.path);
    verifyFile(sourcePath, expected, `source ${id}`);
    if (mode === "sync") copyFileSync(sourcePath, targetPath);
    verifyFile(targetPath, expected, `payload ${id}`);
  }
  const config = JSON.parse(readFileSync(resolve(targetDirectory, `${id}.config.json`), "utf8"));
  if (mode === "verify") assert.deepEqual(config, entry.defaultConfig, `default config drifted for ${id}`);
}
const payloadIds = readdirSync(payloadRoot).sort();
assert.deepEqual(payloadIds, environmentAssetCatalog.map(({descriptor}) => descriptor.id).sort(), "payload contains missing or extra environment ids");
for (const id of payloadIds) assert.deepEqual(readdirSync(resolve(payloadRoot, id, "1.0.0")).sort(), [`${id}.config.json`, `${id}.jpg`, "manifest.json"].sort(), `payload inventory drifted for ${id}`);
if (mode === "sync") execFileSync(process.execPath, [fileURLToPath(import.meta.url), "verify"], { cwd:root, stdio:"inherit" });
console.log(`Owned photosphere catalog ${mode} passed: source ${sourceCommit}, exact 8 entries / 24 runtime files.`);

function verifyFile(path, expected, label) { const bytes = readFileSync(path); assert.equal(bytes.byteLength, expected.bytes, `${label} bytes drifted: ${path}`); assert.equal(hash(bytes), expected.sha256, `${label} hash drifted: ${path}`); }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function git(arguments_) { return execFileSync("git", ["-C", sourceRepository, ...arguments_], { encoding:"utf8", maxBuffer:1024*1024 }).trim(); }
