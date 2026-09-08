// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parent = resolve(root, "..");
const canonicalRenderer = resolve(parent, "aerobeat-web-renderer");
const rendererCommit = "258c9407213e703318578cf7d474658112c99036";
const rendererTree = "1c9703e96507c63bec1a0743aa98843071740a0e";
const release = "0.0.9";
const releaseTree = "541b693eabc11c716adca84931015213055ebfe8";
const inventoryHash = "95ec22c1657d4931e42327e0544b86f782075288a3330a4d23b0fed07dce65fa";
const proofHash = "e1726ca2bc3a0980cc86ba6184bf7da57079f7ee1e42e24094c47196a3dbace9";
const arguments_ = process.argv.slice(2);
const sourceIndex = arguments_.indexOf("--source");
const source = resolve(sourceIndex >= 0 ? arguments_[sourceIndex + 1] ?? "" : canonicalRenderer);
const modeArguments = sourceIndex >= 0 ? arguments_.toSpliced(sourceIndex, 2) : arguments_;
if (![[], ["verify"], ["sync"]].some((expected) => expected.length === modeArguments.length && expected.every((value, index) => value === modeArguments[index])) || (sourceIndex >= 0 && !arguments_[sourceIndex + 1])) throw new Error("Usage: node scripts/sync-gameplay-assets.js [sync|verify] [--source PATH]");
const mode = modeArguments[0] ?? "verify";
if (mode === "sync" && source !== canonicalRenderer) throw new Error("sync accepts only the canonical linked renderer source");

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
assert.equal(packageJson.dependencies?.["@aerobeat/web-renderer"], "file:../aerobeat-web-renderer", "assembly renderer dependency must be the exact committed file link");
assert.equal(packageLock.packages?.[""]?.dependencies?.["@aerobeat/web-renderer"], "file:../aerobeat-web-renderer", "assembly renderer lock dependency drifted");
assert.equal(packageLock.packages?.["node_modules/@aerobeat/web-renderer"]?.resolved, "../aerobeat-web-renderer", "installed renderer lock resolution drifted");
assert.equal(packageLock.packages?.["node_modules/@aerobeat/web-renderer"]?.link, true, "installed renderer lock entry must remain a link");
const installedRenderer = resolve(root, "node_modules/@aerobeat/web-renderer");
assert.equal(lstatSync(installedRenderer).isSymbolicLink(), true, "installed renderer dependency must be a symlink");
assert.equal(realpathSync(installedRenderer), canonicalRenderer, "installed renderer dependency must resolve to the canonical checkout");

assert.equal(git(source, "rev-parse", "HEAD"), rendererCommit, "renderer source commit drifted");
assert.equal(git(source, "rev-parse", "HEAD^{tree}"), rendererTree, "renderer source tree drifted");
assert.equal(git(source, "status", "--porcelain", "--untracked-files=all"), "", "renderer source worktree is not fully clean");
assert.equal(git(source, "rev-parse", `HEAD:assets/gameplay/${release}`), releaseTree, "renderer gameplay release tree drifted");
const sourceRoot = resolve(source, "assets/gameplay", release);
const payloadRoot = resolve(root, "assets/gameplay");
const targetRoot = resolve(payloadRoot, release);
const inventoryBytes = readFileSync(resolve(sourceRoot, "inventory.v1.json"));
const proofBytes = readFileSync(resolve(sourceRoot, "proof.v1.json"));
assert.equal(hash(inventoryBytes), inventoryHash, "renderer gameplay inventory hash drifted");
assert.equal(hash(proofBytes), proofHash, "renderer gameplay proof hash drifted");
const inventory = JSON.parse(inventoryBytes.toString("utf8"));
const proof = JSON.parse(proofBytes.toString("utf8"));
assert.equal(inventory.expected_asset_count, 7, "renderer gameplay asset count drifted");
assert.equal(inventory.immutable, true, "renderer gameplay immutable claim drifted");
assert.equal(inventory.payload.length, 15, "renderer gameplay payload inventory drifted");
assert.equal(proof.release, release, "renderer gameplay proof release drifted");
assert.equal(proof.inventory_sha256, inventoryHash, "renderer gameplay proof inventory binding drifted");
const expectedFiles = [...inventory.payload.map((entry) => entry.path), "inventory.v1.json", "proof.v1.json"].sort();
assert.equal(expectedFiles.length, 17, "renderer gameplay exact file count drifted");
assert.equal(new Set(expectedFiles).size, 17, "renderer gameplay inventory contains duplicates");
verifyTree(sourceRoot, "renderer source");

if (mode === "sync") {
  const existingReleases = directories(payloadRoot);
  assert.deepEqual(existingReleases, existingReleases.includes(release) ? [release] : ["0.0.8"], "assembly mutable gameplay payload contains an unexpected release");
  const staging = resolve(root, "assets/.gameplay-0.0.9-staging");
  rmSync(staging, { recursive:true, force:true });
  try {
    mkdirSync(staging, { recursive:true });
    cpSync(sourceRoot, resolve(staging, release), { recursive:true });
    verifyTree(resolve(staging, release), "staged assembly payload");
    makeDirectoriesWritable(payloadRoot);
    rmSync(payloadRoot, { recursive:true, force:true });
    mkdirSync(resolve(root, "assets"), { recursive:true });
    renameSync(staging, payloadRoot);
  } finally {
    rmSync(staging, { recursive:true, force:true });
  }
}
verifyTree(targetRoot, "assembly payload");
assert.deepEqual(directories(payloadRoot), [release], "assembly must package only gameplay 0.0.9");
console.log(`Gameplay package ${mode} passed: renderer ${rendererCommit}/${rendererTree}, release tree ${releaseTree}, exact ${expectedFiles.length} files.`);

function verifyTree(directory, label) {
  assert.equal(statSync(directory).isDirectory(), true, `${label} is missing`);
  const actual = filesUnder(directory);
  assert.deepEqual(actual, expectedFiles, `${label} exact inventory drifted`);
  for (const entry of inventory.payload) {
    const bytes = readFileSync(resolve(directory, entry.path));
    assert.equal(bytes.byteLength, entry.bytes, `${label} bytes drifted: ${entry.path}`);
    assert.equal(hash(bytes), entry.sha256, `${label} hash drifted: ${entry.path}`);
  }
  assert.equal(hash(readFileSync(resolve(directory, "inventory.v1.json"))), inventoryHash, `${label} inventory bytes drifted`);
  assert.equal(hash(readFileSync(resolve(directory, "proof.v1.json"))), proofHash, `${label} proof bytes drifted`);
}
function filesUnder(directory, current = "") {
  return readdirSync(resolve(directory, current), { withFileTypes:true }).flatMap((entry) => {
    const item = current ? `${current}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return filesUnder(directory, item);
    if (entry.isFile()) return [item];
    throw new Error(`Unsupported gameplay payload member: ${item}`);
  }).sort();
}
function directories(directory) { return readdirSync(directory, { withFileTypes:true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); }
function makeDirectoriesWritable(directory) {
  chmodSync(directory, 0o755);
  for (const entry of readdirSync(directory, { withFileTypes:true })) if (entry.isDirectory()) makeDirectoriesWritable(resolve(directory, entry.name));
}
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function git(repository, ...arguments_) { return execFileSync("git", ["-C", repository, ...arguments_], { encoding:"utf8", maxBuffer:16*1024*1024 }).trim(); }
