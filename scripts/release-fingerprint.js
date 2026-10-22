// @ts-check

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";

export const releaseDependencyPins = Object.freeze([
  Object.freeze({ name: "@aerobeat/web-hash", directory: "aerobeat-web-hash", commit: "be7249b0bdfffcab568b760c1b582bfe2a0c1e92", tree: "b423c6742c07f56dde196d9f60f2e23c51ad913c" }),
  Object.freeze({ name: "@aerobeat/web-vendor-beatsaver", directory: "aerobeat-web-vendor-beatsaver", commit: "5866f8e418e4a0ef11362f9e6c80ebc5a2ad3c3a", tree: "997e8a476ab9ff04f0197cfa203091c58c865772" }),
  Object.freeze({ name: "@aerobeat/web-content-authoring", directory: "aerobeat-web-content-authoring", commit: "b0a86ff4f8b1e3a9b115333504bfad8a68a359f8", tree: "acf9c8e2a9848b2ee469739caac377e8029f2e79" }),
  Object.freeze({ name: "@aerobeat/web-content", directory: "aerobeat-web-content", commit: "07254cb56e2481dbd66635c920aa222da2ce4ec9", tree: "83f21099ff0228006b085bed8fa04ad33b71db16" }),
  Object.freeze({ name: "@aerobeat/web-audio", directory: "aerobeat-web-audio", commit: "464fdeff45fc109876a1600f22d3007708d1b07d", tree: "475fb4134a2d550e62807c93e249bb015d5034be" }),
  Object.freeze({ name: "@aerobeat/web-contracts", directory: "aerobeat-web-contracts", commit: "a50752a92826ee8cc2a6f0f257d8cad85b6c2764", tree: "2df62c42da523e7f027aafc3d5d0264e17405a49" }),
  Object.freeze({ name: "@aerobeat/web-renderer", directory: "aerobeat-web-renderer", commit: "884c720efc11ca7d7daf118168403d3d41db41df", tree: "76392bfcc976090269c1310817c7297dae5975d5" }),
  Object.freeze({ name: "@aerobeat/web-gameplay", directory: "aerobeat-web-gameplay", commit: "de9c1ef0fb1f526cb55beab7be0b64c004aac60c", tree: "58950d0af51d28507c5424a7ab8ba8eab270cbf7" }),
  Object.freeze({ name: "@aerobeat/web-input", directory: "aerobeat-web-input", commit: "69a6e87b2438e45e7bd5f22969fad0b341378f1a", tree: "8afbe6ec3370379d6a982de76dadd9ffd2ab535f" }),
  Object.freeze({ name: "@aerobeat/web-ui", directory: "aerobeat-web-ui", commit: "859a1f4215a34718627975689dc3980fbcab9e1d", tree: "e54156647f6364b36deb64bda192bf2592ef2ce9" })
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
