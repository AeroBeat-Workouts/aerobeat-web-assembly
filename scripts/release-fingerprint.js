// @ts-check

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";

export const releaseDependencyPins = Object.freeze([
  Object.freeze({ name: "@aerobeat/web-hash", directory: "aerobeat-web-hash", commit: "be7249b0bdfffcab568b760c1b582bfe2a0c1e92", tree: "b423c6742c07f56dde196d9f60f2e23c51ad913c" }),
  Object.freeze({ name: "@aerobeat/web-vendor-beatsaver", directory: "aerobeat-web-vendor-beatsaver", commit: "13ffc006562afd3e0ab9e52c30df45df4377ae75", tree: "a014a5a47ffd8c5e50f1fab12dc5ed2dda620e0d" }),
  Object.freeze({ name: "@aerobeat/web-content-authoring", directory: "aerobeat-web-content-authoring", commit: "9edce4c5ba8592d377ed824cf1e68fc33b7be23a", tree: "78f336195b2f2f4adcb9c4db098aa7a5bec72e4f" }),
  Object.freeze({ name: "@aerobeat/web-content", directory: "aerobeat-web-content", commit: "4721207b9b68747d828f15a26dfccac11858cf0e", tree: "49646483d22416a1737cadf424cd897f92035e68" }),
  Object.freeze({ name: "@aerobeat/web-audio", directory: "aerobeat-web-audio", commit: "464fdeff45fc109876a1600f22d3007708d1b07d", tree: "475fb4134a2d550e62807c93e249bb015d5034be" }),
  Object.freeze({ name: "@aerobeat/web-contracts", directory: "aerobeat-web-contracts", commit: "43ec0a4f72aab6fdc539c0a853a57f50a2348950", tree: "817b12ac7b2f66c0a1fc52b18d22141f0a6a1656" }),
  Object.freeze({ name: "@aerobeat/web-renderer", directory: "aerobeat-web-renderer", commit: "94f1a06422f4e720f16b2d9f1b14f43dfd7a7b40", tree: "840cc205eb4f5fa5c74b62a6599c362896f4dc80" }),
  Object.freeze({ name: "@aerobeat/web-gameplay", directory: "aerobeat-web-gameplay", commit: "4a89afd5c7315135d8a9198cc6f293f3ba078fd6", tree: "0703da3379eabd724b2ea02317b136d575252b12" }),
  Object.freeze({ name: "@aerobeat/web-input", directory: "aerobeat-web-input", commit: "31c96a36e6c7a9ac6f9c61e7c52ba0e776137990", tree: "3e55c9d3eb04556c52c15ec9bacb4eb0b411130d" }),
  Object.freeze({ name: "@aerobeat/web-ui", directory: "aerobeat-web-ui", commit: "7385163c89c387325315263bdd696690bbc771f4", tree: "4d395be4cc0514b00d90b32214313bd22d43e983" })
]);

/**
 * Compute a deterministic fingerprint over this browser entrypoint, assembly
 * runtime assets, and every recursively linked local runtime package including
 * each package's source and runtime assets. Generated release/dist output is
 * intentionally outside this set.
 *
 * @param {string} [root]
 */
export function computeReleaseFingerprint(root = process.cwd()) {
  const absoluteRoot = resolve(root); const hash = createHash("sha256");
  hash.update("aerobeat-release-dependency-provenance-v1\0");
  hash.update(JSON.stringify(readReleaseDependencyProvenance(absoluteRoot))); hash.update("\0");
  for (const path of listReleaseFingerprintInputs(absoluteRoot)) {
    hash.update(relative(absoluteRoot, path)); hash.update("\0"); hash.update(readFileSync(path)); hash.update("\0");
  }
  return hash.digest("hex");
}

const protectedLedgerStatus = " M .beads/interactions.jsonl";

/**
 * Parse exact NUL-delimited porcelain-v1 status output without normalizing it.
 *
 * @param {string} output
 * @returns {readonly string[]}
 */
export function parseReleaseDependencyStatus(output) {
  if (typeof output !== "string") throw new TypeError("Release dependency status output must be a string");
  if (output === "") return Object.freeze([]);
  if (!output.endsWith("\0")) throw new Error("Release dependency status output is missing its NUL terminator");
  const entries = output.slice(0, -1).split("\0");
  if (entries.some((entry) => entry === "")) throw new Error("Release dependency status output contains an empty entry");
  return Object.freeze(entries);
}

/**
 * Accept a clean dependency or its sole exact protected unstaged ledger export.
 *
 * @param {string} output
 * @param {string} dependencyName
 */
export function validateReleaseDependencyStatus(output, dependencyName) {
  let entries;
  try {
    entries = parseReleaseDependencyStatus(output);
  } catch (error) {
    throw new Error(`Release dependency worktree status is malformed for ${dependencyName}`, { cause: error });
  }
  if (entries.length === 0 || (entries.length === 1 && entries[0] === protectedLedgerStatus)) return;
  throw new Error(`Release dependency worktree is dirty for ${dependencyName}`);
}

/** Return exact Git identities that participate in release provenance. @param {string} [root] */
export function readReleaseDependencyProvenance(root = process.cwd()) {
  const parent = resolve(root, "..");
  return Object.freeze(releaseDependencyPins.map((pin) => {
    const repository = resolve(parent, pin.directory);
    const commit = git(repository, "rev-parse", "HEAD"); const tree = git(repository, "rev-parse", "HEAD^{tree}");
    if (commit !== pin.commit || tree !== pin.tree) throw new Error(`Release dependency provenance drifted for ${pin.name}`);
    const status = execFileSync("git", ["-C", repository, "status", "--porcelain=v1", "-z", "--untracked-files=all"], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    validateReleaseDependencyStatus(status, pin.name);
    return Object.freeze({ name: pin.name, commit, tree });
  }));
}

/** @param {string} [root] @returns {string[]} */
export function listReleaseFingerprintInputs(root = process.cwd()) {
  const absoluteRoot = resolve(root); const files = new Set(); const packages = new Set();
  addFile(resolve(absoluteRoot, "index.html")); addFile(resolve(absoluteRoot, "package-lock.json")); addFile(resolve(absoluteRoot, "vite.config.js"));
  collectPackage(absoluteRoot);
  return [...files].sort((left, right) => compareCodePoints(relative(absoluteRoot, left), relative(absoluteRoot, right)));

  /** @param {string} packageRoot */
  function collectPackage(packageRoot) {
    const resolvedRoot = resolve(packageRoot); if (packages.has(resolvedRoot)) return; packages.add(resolvedRoot);
    const packagePath = resolve(resolvedRoot, "package.json"); addFile(packagePath);
    for (const directory of ["src", "assets"]) {
      const contentRoot = resolve(resolvedRoot, directory);
      if (existsSync(contentRoot)) for (const path of walk(contentRoot)) addFile(path);
    }
    const packageData = JSON.parse(readFileSync(packagePath, "utf8"));
    const dependencies = packageData && typeof packageData === "object" ? packageData.dependencies : null;
    if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) return;
    for (const [name, specifier] of Object.entries(dependencies).sort(([left], [right]) => compareCodePoints(left, right))) {
      if (typeof specifier !== "string" || !specifier.startsWith("file:")) continue;
      collectPackage(resolve(dirname(packagePath), specifier.slice(5)));
    }
  }
  /** @param {string} path */
  function addFile(path) { if (existsSync(path) && statSync(path).isFile()) files.add(resolve(path)); }
}

/** @param {string} root @returns {string[]} */
function walk(root) {
  return readdirSync(root).sort(compareCodePoints).flatMap((entry) => {
    const path = resolve(root, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** @param {string} left @param {string} right */
function compareCodePoints(left, right) { return left < right ? -1 : left > right ? 1 : 0; }

/** @param {string} repository @param {...string} args */
function git(repository, ...args) { return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8", maxBuffer: 1024 * 1024 }).trim(); }
