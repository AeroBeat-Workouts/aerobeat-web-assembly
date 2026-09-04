// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";
import { computeReleaseFingerprint, listReleaseFingerprintInputs, readReleaseDependencyProvenance, releaseDependencyPins } from "./release-fingerprint.js";

const root = process.cwd();
const parent = resolve(root, "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
assert.equal(packageJson.version, "0.0.38", "k72.37 release source must use the exact authorized successor version");
assert.equal(packageJson.dependencies["@aerobeat/web-hash"], "file:../aerobeat-web-hash");
assert.equal(packageLock.packages[""].dependencies["@aerobeat/web-hash"], "file:../aerobeat-web-hash");
assert.equal(packageLock.packages["../aerobeat-web-hash"].name, "@aerobeat/web-hash");
assert.deepEqual(packageLock.packages["../aerobeat-web-hash"].dependencies, undefined);
assert.equal(packageLock.packages["node_modules/@aerobeat/web-hash"].resolved, "../aerobeat-web-hash");
assert.equal(packageLock.packages["node_modules/@aerobeat/web-hash"].link, true);
const installedHash = resolve(root, "node_modules", "@aerobeat", "web-hash");
assert.equal(lstatSync(installedHash).isSymbolicLink(), true, "assembly hash dependency must be a committed file link");
assert.equal(realpathSync(installedHash), resolve(parent, "aerobeat-web-hash"));

const provenance = readReleaseDependencyProvenance(root);
assert.equal(provenance.length, releaseDependencyPins.length);
for (const pin of releaseDependencyPins) {
  const repository = resolve(parent, pin.directory);
  assert.equal(git(repository, "rev-parse", "HEAD"), pin.commit, `${pin.name} commit drifted`);
  assert.equal(git(repository, "rev-parse", "HEAD^{tree}"), pin.tree, `${pin.name} tree drifted`);
  assert.equal(git(repository, "rev-parse", "origin/main"), pin.commit, `${pin.name} is not synchronized with public main`);
  assert.equal(git(repository, "ls-remote", "origin", "refs/heads/main").split("\t")[0], pin.commit, `${pin.name} current public main drifted`);
  assert.equal(git(repository, "status", "--porcelain"), "", `${pin.name} must start clean`);
  assert.equal(git(repository, "remote", "get-url", "origin"), `git@github.com:AeroBeat-Workouts/${pin.directory}.git`, `${pin.name} public origin drifted`);
  const manifest = JSON.parse(readFileSync(resolve(repository, "package.json"), "utf8"));
  assert.equal(manifest.name, pin.name);
  if (pin.name !== "@aerobeat/web-hash") {
    assert.equal(manifest.dependencies?.["@aerobeat/web-hash"], "file:../aerobeat-web-hash", `${pin.name} must directly own its shared hash dependency`);
    const lock = JSON.parse(readFileSync(resolve(repository, "package-lock.json"), "utf8"));
    assert.equal(lock.packages?.[""]?.dependencies?.["@aerobeat/web-hash"], "file:../aerobeat-web-hash", `${pin.name} lock lost shared hash ownership`);
  }
}
assert.deepEqual(provenance, releaseDependencyPins.map(({ name, commit, tree }) => ({ name, commit, tree })));

const inputs = listReleaseFingerprintInputs(root).map((path) => relative(root, path).replaceAll("\\", "/"));
const hashInputs = inputs.filter((path) => path.startsWith("../aerobeat-web-hash/"));
assert.deepEqual(hashInputs, ["../aerobeat-web-hash/package.json", "../aerobeat-web-hash/src/index.d.ts", "../aerobeat-web-hash/src/index.js"]);
const fingerprintSource = readFileSync(resolve(root, "scripts", "release-fingerprint.js"), "utf8");
assert.match(fingerprintSource, /aerobeat-release-dependency-provenance-v1/u);
assert.match(fingerprintSource, /readReleaseDependencyProvenance\(absoluteRoot\)/u);
const fingerprint = computeReleaseFingerprint(root);
assert.match(fingerprint, /^[0-9a-f]{64}$/u);

for (const pin of releaseDependencyPins) {
  const sourceRoot = resolve(parent, pin.directory, "src");
  for (const path of git(resolve(parent, pin.directory), "ls-files", "src").split("\n").filter(Boolean)) {
    const source = readFileSync(resolve(parent, pin.directory, path), "utf8");
    if (pin.name !== "@aerobeat/web-hash") assert.doesNotMatch(source, /(?:crypto\s*\??\.\s*subtle|subtle\s*\.\s*digest)/u, `${pin.name}/${path} owns a direct SubtleCrypto digest`);
    assert.doesNotMatch(source, /import\s*\(\s*["']https?:\/\//u, `${pin.name}/${path} contains a dynamic external import`);
    assert.doesNotMatch(source, /WebAssembly\s*\.|\.wasm(?:\?|["'])/u, `${pin.name}/${path} contains a WASM hashing path`);
  }
  assert.ok(sourceRoot);
}
for (const path of git(root, "ls-files", "src").split("\n").filter(Boolean)) {
  const source = readFileSync(resolve(root, path), "utf8");
  assert.doesNotMatch(source, /(?:crypto\s*\??\.\s*subtle|subtle\s*\.\s*digest)/u, `assembly production ${path} owns a direct SubtleCrypto digest`);
}
console.log(`Shared hash provenance passed: ${provenance.map((entry) => `${entry.name}@${entry.commit.slice(0, 8)}`).join(", ")}; fingerprint ${fingerprint} over ${inputs.length} inputs.`);

/** @param {string} repository @param {...string} args */
function git(repository, ...args) { return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim(); }
