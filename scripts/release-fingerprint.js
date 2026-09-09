// @ts-check

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";

export const releaseDependencyPins = Object.freeze([
  Object.freeze({ name: "@aerobeat/web-hash", directory: "aerobeat-web-hash", commit: "be7249b0bdfffcab568b760c1b582bfe2a0c1e92", tree: "b423c6742c07f56dde196d9f60f2e23c51ad913c" }),
  Object.freeze({ name: "@aerobeat/web-vendor-beatsaver", directory: "aerobeat-web-vendor-beatsaver", commit: "5866f8e418e4a0ef11362f9e6c80ebc5a2ad3c3a", tree: "997e8a476ab9ff04f0197cfa203091c58c865772" }),
  Object.freeze({ name: "@aerobeat/web-content-authoring", directory: "aerobeat-web-content-authoring", commit: "b22a05d9c9b6c2bc7727b29f98e1d5a3a3ea4065", tree: "f6f668117598b6270d46099b382736aa015a7f38" }),
  Object.freeze({ name: "@aerobeat/web-content", directory: "aerobeat-web-content", commit: "4f06b266a03b12b1e1ca44c99d05feaccc02da0b", tree: "0204062dc3962787e43cb04b03082a068d98fa39" }),
  Object.freeze({ name: "@aerobeat/web-audio", directory: "aerobeat-web-audio", commit: "19fd3a91eb67712806a17e4c82e2631d63f72434", tree: "9bd3418296d8fbdbfe72669958087f50a3302675" }),
  Object.freeze({ name: "@aerobeat/web-contracts", directory: "aerobeat-web-contracts", commit: "d6fb3b979eb8ba8a5ac8c51ae759b533955ba793", tree: "51c7b07462b9d3107f1142d4de1f1b792673aeb0" }),
  Object.freeze({ name: "@aerobeat/web-renderer", directory: "aerobeat-web-renderer", commit: "9f19e2b6f28e419cecdac4335ddd2004c6e935d9", tree: "45e77ab2514f26253d37f2b479c416215ca014e3" }),
  Object.freeze({ name: "@aerobeat/web-gameplay", directory: "aerobeat-web-gameplay", commit: "7fc290fd66fc2deb1aca62c5f2448d316e30a9e7", tree: "b3e2a3875fcb2fa6302a73f27a47dcde1ceb2282" }),
  Object.freeze({ name: "@aerobeat/web-input", directory: "aerobeat-web-input", commit: "f724672d5a431c455d7061e4f7f07effe25aaa2d", tree: "29e7a3b6647216275b8eae50fec7585041878041" }),
  Object.freeze({ name: "@aerobeat/web-ui", directory: "aerobeat-web-ui", commit: "622bb0cb8eef6e873d27f81ddfc4de870fe74486", tree: "7cb35267a0532ea146ae051d826d1a1f60ac619b" })
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
