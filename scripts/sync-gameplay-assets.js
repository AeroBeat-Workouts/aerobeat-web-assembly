// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, readFileSync, readdirSync, realpathSync, renameSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseDependencyStatus } from "./release-fingerprint.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parent = resolve(root, "..");
const canonicalRenderer = resolve(parent, "aerobeat-web-renderer");
const rendererCommit = "b73eee00892c17d1ed1334cdddfa72392336fd32";
const rendererTree = "f93ebc62da260e545d94ca92814a6e08b879da25";
const earlierRelease = "0.0.11";
const earlierTree = "06fb120939b17326c558b8a698025d6ab8bd093d";
const historicalRelease = "0.0.12";
const historicalTree = "2ba5fc46f8aea74a1bc6e55a40a4d0b8bebfa36f";
const release = "0.0.13";
const releaseTree = "71a96a79a6f4f325e6c1919814e54689b06ee189";
const inventoryHash = "77e90badd35b8e21460045f05ab669d624bd6249b1b248609f32778b48660123";
const proofHash = "0bbf78d723babd15150b8dfbf544f5b289673bdf98f9ddc738c46fa682d1ebdb";
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
validateReleaseDependencyStatus(gitRaw(source, "status", "--porcelain=v1", "-z", "--untracked-files=all"), "renderer gameplay source");
assert.equal(git(source, "rev-parse", `HEAD:assets/gameplay/${release}`), releaseTree, "renderer gameplay release tree drifted");
assert.equal(git(source, "rev-parse", `HEAD:assets/gameplay/${historicalRelease}`), historicalTree, "renderer historical gameplay release drifted");
assert.equal(git(source, "rev-parse", `HEAD:assets/gameplay/${earlierRelease}`), earlierTree, "renderer earlier gameplay release drifted");
const sourceRoot = resolve(source, "assets/gameplay", release);
const payloadRoot = resolve(root, "assets/gameplay");
const targetRoot = resolve(payloadRoot, release);
const inventoryBytes = readFileSync(resolve(sourceRoot, "inventory.v1.json"));
const proofBytes = readFileSync(resolve(sourceRoot, "proof.v1.json"));
assert.equal(hash(inventoryBytes), inventoryHash, "renderer gameplay inventory hash drifted");
assert.equal(hash(proofBytes), proofHash, "renderer gameplay proof hash drifted");
const inventory = JSON.parse(inventoryBytes.toString("utf8"));
const proof = JSON.parse(proofBytes.toString("utf8"));
assert.equal(inventory.expected_asset_count, 11, "renderer gameplay asset count drifted");
assert.equal(inventory.immutable, true, "renderer gameplay immutable claim drifted");
assert.equal(inventory.payload.length, 21, "renderer gameplay payload inventory drifted");
assert.equal(proof.release, release, "renderer gameplay proof release drifted");
assert.equal(proof.inventory_sha256, inventoryHash, "renderer gameplay proof inventory binding drifted");
const markerEntry = inventory.payload.find((entry) => entry.path === "athlete-marker/sphere-v1.glb");
assert.equal(markerEntry?.sha256, "f376934f218a25c11f2f31928c67684611aaf9c73aa1724548682ae280b5cbcc", "tint-dominant marker identity drifted");
// Additive 0.0.13 keeps all predecessor GLB/manifest bytes and adds two distinct
// knee target/pad GLBs and their manifests (11 GLBs + 9 manifests + 1 set).
const expectedFiles = [...inventory.payload.map((entry) => entry.path), "inventory.v1.json", "proof.v1.json"].sort();
assert.equal(expectedFiles.length, 23, "renderer gameplay exact file count drifted");
assert.equal(new Set(expectedFiles).size, 23, "renderer gameplay inventory contains duplicates");
verifyTree(sourceRoot, "renderer source");

verifyHistoricalTree();
if (mode === "sync") {
  const existingReleases = directories(payloadRoot);
  assert.deepEqual(existingReleases, existingReleases.includes(release) ? [earlierRelease, historicalRelease, release] : [earlierRelease, historicalRelease], "assembly gameplay releases must retain the immutable predecessor");
  if (!existingReleases.includes(release)) {
    // Add only the new release. Never remove or rewrite the signed predecessor.
    const staging = resolve(payloadRoot, `.gameplay-${release}-${process.pid}-${Date.now()}`);
    assert.equal(existsSync(staging), false, "fresh gameplay staging directory required");
    cpSync(sourceRoot, staging, { recursive:true, errorOnExist:true, force:false });
    verifyTree(staging, "staged new assembly payload");
    renameSync(staging, targetRoot);
  }
}
verifyHistoricalTree();
verifyTree(targetRoot, "assembly payload");
assert.deepEqual(directories(payloadRoot), [earlierRelease, historicalRelease, release], "assembly gameplay payload must preserve both predecessors beside the active release");
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
function verifyHistoricalTree() {
  for(const predecessor of [earlierRelease,historicalRelease]){
    const sourceFiles=filesUnder(resolve(source,"assets/gameplay",predecessor));
    assert.deepEqual(filesUnder(resolve(payloadRoot,predecessor)),sourceFiles,`immutable ${predecessor} assembly inventory drifted`);
    for(const file of sourceFiles)assert.equal(hash(readFileSync(resolve(payloadRoot,predecessor,file))),hash(readFileSync(resolve(source,"assets/gameplay",predecessor,file))),`immutable ${predecessor} assembly bytes drifted: ${file}`);
  }
}
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function git(repository, ...arguments_) { return gitRaw(repository, ...arguments_).trim(); }
function gitRaw(repository, ...arguments_) { return execFileSync("git", ["-C", repository, ...arguments_], { encoding:"utf8", maxBuffer:16*1024*1024 }); }
