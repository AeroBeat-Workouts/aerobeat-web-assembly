// @ts-check

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";

export const releaseDependencyPins = Object.freeze([
  Object.freeze({ name: "@aerobeat/web-hash", directory: "aerobeat-web-hash", commit: "be7249b0bdfffcab568b760c1b582bfe2a0c1e92", tree: "b423c6742c07f56dde196d9f60f2e23c51ad913c" }),
  Object.freeze({ name: "@aerobeat/web-vendor-beatsaver", directory: "aerobeat-web-vendor-beatsaver", commit: "5866f8e418e4a0ef11362f9e6c80ebc5a2ad3c3a", tree: "997e8a476ab9ff04f0197cfa203091c58c865772" }),
  Object.freeze({ name: "@aerobeat/web-content-authoring", directory: "aerobeat-web-content-authoring", commit: "54db1a1fb4c3dc95d75d69194d8e25a121b729e4", tree: "3daec05624de32b1dd3cbef545935f112759481d" }),
  Object.freeze({ name: "@aerobeat/web-content", directory: "aerobeat-web-content", commit: "4963c8609094c7e10dffe65983f69c1c6645e4d3", tree: "d53b8e592d6c6d8060d59bfd4587f8819a9c24ce" }),
  Object.freeze({ name: "@aerobeat/web-audio", directory: "aerobeat-web-audio", commit: "464fdeff45fc109876a1600f22d3007708d1b07d", tree: "475fb4134a2d550e62807c93e249bb015d5034be" }),
  Object.freeze({ name: "@aerobeat/web-contracts", directory: "aerobeat-web-contracts", commit: "f6cfde401a3d9e50da3b8344aae066c098cfb119", tree: "669bb592c04d86ad3abd9d20ee700565c51cc5cb" }),
  Object.freeze({ name: "@aerobeat/web-renderer", directory: "aerobeat-web-renderer", commit: "054003c60230f1bb56092aa68e3a0d626eab3f57", tree: "eaa1b3f5be7740034ad9ec7548eb1146e16f6aa3" }),
  Object.freeze({ name: "@aerobeat/web-gameplay", directory: "aerobeat-web-gameplay", commit: "b885a87cf250260670a8285363a0c8976188e665", tree: "6d97f67c4ddf8eebe4a8b57ae310d6518e1df139" }),
  Object.freeze({ name: "@aerobeat/web-input", directory: "aerobeat-web-input", commit: "b7b6bb901ed58abf0cd9855cb286b02ecc996d18", tree: "94869a0ace3d483a254ff3b6802c110238ff027c" }),
  Object.freeze({ name: "@aerobeat/web-ui", directory: "aerobeat-web-ui", commit: "6f0556dabefa0e124488e516c9b4108759b26eb9", tree: "e25a1d8b8d9f3ce7f282b2e2d92b28f56ac01649" })
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
