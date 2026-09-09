// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { computeReleaseFingerprint, listReleaseFingerprintInputs, parseReleaseDependencyStatus, readReleaseDependencyProvenance, releaseDependencyPins, validateReleaseDependencyStatus } from "./release-fingerprint.js";

const root = process.cwd();
const parent = resolve(root, "..");
const protectedLedgerStatus = " M .beads/interactions.jsonl\0";
assert.deepEqual(parseReleaseDependencyStatus(""), []);
assert.deepEqual(parseReleaseDependencyStatus(protectedLedgerStatus), [" M .beads/interactions.jsonl"]);
validateReleaseDependencyStatus("", "clean fixture");
validateReleaseDependencyStatus(protectedLedgerStatus, "protected-ledger fixture");
for (const [name, status] of [
  ["staged", "M  .beads/interactions.jsonl\0"],
  ["mixed", "MM .beads/interactions.jsonl\0"],
  ["unstaged deleted", " D .beads/interactions.jsonl\0"],
  ["staged deleted", "D  .beads/interactions.jsonl\0"],
  ["unstaged renamed", " R .beads/interactions.jsonl\0.previous-ledger\0"],
  ["staged renamed", "R  .beads/interactions.jsonl\0.previous-ledger\0"],
  ["untracked", "?? .beads/interactions.jsonl\0"],
  ["other path", " M src/index.js\0"],
  ["duplicate protected entries", `${protectedLedgerStatus}${protectedLedgerStatus}`],
  ["protected plus other", `${protectedLedgerStatus} M package.json\0`],
  ["missing NUL", " M .beads/interactions.jsonl"],
  ["empty entry", " M .beads/interactions.jsonl\0\0"],
  ["newline suffix", " M .beads/interactions.jsonl\0\n"]
]) assert.throws(() => validateReleaseDependencyStatus(status, `${name} fixture`), /Release dependency worktree (?:is dirty|status is malformed)/u, `${name} status must reject`);
assert.throws(() => parseReleaseDependencyStatus(Buffer.from(protectedLedgerStatus)), /must be a string/u);
assert.equal(withStatusFixture((repository) => writeFileSync(resolve(repository, ".beads/interactions.jsonl"), "baseline\nprotected\n")), protectedLedgerStatus);
for (const [name, mutate] of [
  ["staged protected ledger", (repository) => {
    writeFileSync(resolve(repository, ".beads/interactions.jsonl"), "baseline\nstaged\n");
    git(repository, "add", ".beads/interactions.jsonl");
  }],
  ["deleted protected ledger", (repository) => unlinkSync(resolve(repository, ".beads/interactions.jsonl"))],
  ["renamed protected ledger", (repository) => renameSync(resolve(repository, ".beads/interactions.jsonl"), resolve(repository, ".beads/renamed.jsonl"))],
  ["untracked path", (repository) => writeFileSync(resolve(repository, "untracked.txt"), "untracked\n")],
  ["protected plus source", (repository) => {
    writeFileSync(resolve(repository, ".beads/interactions.jsonl"), "baseline\nprotected\n");
    writeFileSync(resolve(repository, "source.txt"), "baseline\nsource\n");
  }]
]) {
  const status = withStatusFixture(mutate);
  assert.throws(() => validateReleaseDependencyStatus(status, `${name} temporary fixture`), /Release dependency worktree is dirty/u, `${name} temporary fixture must reject`);
}
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
assert.equal(packageJson.version, "0.0.47", "lev0 release source must use the exact authorized successor version");
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
  validateReleaseDependencyStatus(gitRaw(repository, "status", "--porcelain=v1", "-z", "--untracked-files=all"), pin.name);
  assert.equal(git(repository, "remote", "get-url", "origin"), `git@github.com:AeroBeat-Workouts/${pin.directory}.git`, `${pin.name} public origin drifted`);
  const manifest = JSON.parse(readFileSync(resolve(repository, "package.json"), "utf8"));
  assert.equal(manifest.name, pin.name);
  if (pin.name !== "@aerobeat/web-hash" && pin.name !== "@aerobeat/web-input") {
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
assert.match(fingerprintSource, /"status", "--porcelain=v1", "-z", "--untracked-files=all"/u);
assert.doesNotMatch(fingerprintSource, /status[^\n]+\.trim\(\)/u, "release dependency status must never be trimmed");
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

/** @param {(repository: string) => void} mutate */
function withStatusFixture(mutate) {
  const repository = mkdtempSync(resolve(tmpdir(), "aerobeat-release-status-"));
  try {
    git(repository, "init", "-q");
    mkdirSync(resolve(repository, ".beads"));
    writeFileSync(resolve(repository, ".beads/interactions.jsonl"), "baseline\n");
    writeFileSync(resolve(repository, "source.txt"), "baseline\n");
    git(repository, "add", ".beads/interactions.jsonl", "source.txt");
    git(repository, "-c", "user.name=AeroBeat Fixture", "-c", "user.email=fixture@invalid", "commit", "-qm", "fixture");
    mutate(repository);
    return gitRaw(repository, "status", "--porcelain=v1", "-z", "--untracked-files=all");
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}

/** @param {string} repository @param {...string} args */
function git(repository, ...args) { return gitRaw(repository, ...args).trim(); }

/** @param {string} repository @param {...string} args */
function gitRaw(repository, ...args) { return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }); }
