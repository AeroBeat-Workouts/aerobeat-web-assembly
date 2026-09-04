// @ts-check

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";

export const releaseDependencyPins = Object.freeze([
  Object.freeze({ name: "@aerobeat/web-hash", directory: "aerobeat-web-hash", commit: "be7249b0bdfffcab568b760c1b582bfe2a0c1e92", tree: "b423c6742c07f56dde196d9f60f2e23c51ad913c" }),
  Object.freeze({ name: "@aerobeat/web-vendor-beatsaver", directory: "aerobeat-web-vendor-beatsaver", commit: "4d2479df0d4b12305cc8190dbe918995abae5d03", tree: "40c8055acab241614272fb922a51c1d092e6dd08" }),
  Object.freeze({ name: "@aerobeat/web-content-authoring", directory: "aerobeat-web-content-authoring", commit: "5da1ed92d39f6bf51e8bb0a7f53c0d818c9dab50", tree: "be43933e13d43730e02284d979eecefbad5f34ab" }),
  Object.freeze({ name: "@aerobeat/web-content", directory: "aerobeat-web-content", commit: "c6d129e6bf4162ea1a7f1eb9f8e769dd78d50fc1", tree: "d57921ec6f86050fca20b58d4de2c0f1fe12ca8b" }),
  Object.freeze({ name: "@aerobeat/web-audio", directory: "aerobeat-web-audio", commit: "2bd5c6bc96d001f9755b6d8b2a79c57cd8e196f1", tree: "4bb2a110ddeab77559d1f7ffcf5d3e348a93f027" }),
  Object.freeze({ name: "@aerobeat/web-renderer", directory: "aerobeat-web-renderer", commit: "3089f07c79e7ff55ba66813162e25e1ba8b1bcda", tree: "28e88ec65349c5724d1a5796c2daa7499895bac1" }),
  Object.freeze({ name: "@aerobeat/web-gameplay", directory: "aerobeat-web-gameplay", commit: "af595726e66b6340bf2890d3dd7b14d254f9ab13", tree: "434130b3fc7ef357684d5ad75138d41cd9d68848" })
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

/** Return exact Git identities that participate in release provenance. @param {string} [root] */
export function readReleaseDependencyProvenance(root = process.cwd()) {
  const parent = resolve(root, "..");
  return Object.freeze(releaseDependencyPins.map((pin) => {
    const repository = resolve(parent, pin.directory);
    const commit = git(repository, "rev-parse", "HEAD"); const tree = git(repository, "rev-parse", "HEAD^{tree}");
    if (commit !== pin.commit || tree !== pin.tree) throw new Error(`Release dependency provenance drifted for ${pin.name}`);
    if (git(repository, "status", "--porcelain") !== "") throw new Error(`Release dependency worktree is dirty for ${pin.name}`);
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
