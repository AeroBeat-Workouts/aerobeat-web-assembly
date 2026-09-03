// @ts-check

import { strict as assert } from "node:assert";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { claimAppendOnlyReleaseTarget } from "./release-target-policy.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BUILD_SCRIPT = resolve(ROOT, "scripts", "build-release.js");
const POLICY_SCRIPT = resolve(ROOT, "scripts", "release-target-policy.js");
const IMMUTABLE_VERSION = "0.0.34";
const IMMUTABLE_TREE = "1c8db5dff7c0136a6e5a22c6622f4a5409511f70";
const IMMUTABLE_PROOF_SHA256 = "46ca87869bae0016639277832520eec48031532c5ab509a2cfca36f8fc3d12a2";
const immutableRoot = resolve(ROOT, "release", "raw", IMMUTABLE_VERSION);
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "aerobeat-release-target-policy-"));

try {
  const existingTarget = resolve(temporaryRoot, "existing");
  const sentinel = resolve(existingTarget, "sentinel.bin");
  const sentinelBytes = Buffer.from([0, 255, 19, 42, 10, 0, 91]);
  mkdirSync(existingTarget);
  writeFileSync(sentinel, sentinelBytes);
  const existingInventory = inventory(existingTarget);
  assert.throws(
    () => claimAppendOnlyReleaseTarget(existingTarget),
    /already exists and is immutable/u
  );
  assert.deepEqual(readFileSync(sentinel), sentinelBytes, "existing sentinel bytes must remain exact");
  assert.deepEqual(inventory(existingTarget), existingInventory, "existing target inventory must remain exact");

  const absentTarget = resolve(temporaryRoot, "single-claim");
  assert.equal(claimAppendOnlyReleaseTarget(absentTarget), absentTarget);
  assert.deepEqual(inventory(absentTarget), []);
  assert.throws(() => claimAppendOnlyReleaseTarget(absentTarget), /already exists and is immutable/u);

  const concurrentTarget = resolve(temporaryRoot, "concurrent-claim");
  const claimProgram = `import { claimAppendOnlyReleaseTarget } from ${JSON.stringify(pathToFileURL(POLICY_SCRIPT).href)}; claimAppendOnlyReleaseTarget(${JSON.stringify(concurrentTarget)});`;
  const concurrentResults = await Promise.all([
    runNode(["--input-type=module", "--eval", claimProgram]),
    runNode(["--input-type=module", "--eval", claimProgram])
  ]);
  assert.equal(concurrentResults.filter(({ status }) => status === 0).length, 1, "exactly one concurrent publisher must claim the target");
  const rejectedClaim = concurrentResults.find(({ status }) => status !== 0);
  assert(rejectedClaim, "one concurrent publisher must reject");
  assert.match(rejectedClaim.stderr, /already exists and is immutable/u);
  assert.deepEqual(inventory(concurrentTarget), []);

  const buildSource = readFileSync(BUILD_SCRIPT, "utf8");
  const policySource = readFileSync(POLICY_SCRIPT, "utf8");
  const claimOffset = buildSource.indexOf("claimAppendOnlyReleaseTarget(releaseRoot)");
  const buildOffset = buildSource.indexOf("await build(");
  assert(claimOffset >= 0 && buildOffset >= 0 && claimOffset < buildOffset, "target claim must precede await build");
  assert.match(buildSource, /emptyOutDir:\s*false/u, "Vite must not empty a claimed target");
  for (const [label, source] of [["build", buildSource], ["policy", policySource]]) {
    assert.doesNotMatch(source, /\b(?:rmSync|rmdirSync|unlinkSync)\s*\(|\b(?:rm|rmdir|unlink)\s*\(/u, `${label} target path must expose no delete API`);
    assert.doesNotMatch(source, /recursive\s*:\s*true/u, `${label} target path must expose no recursive filesystem operation`);
  }

  const before = assertImmutableRelease();
  const packageVersion = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;
  const currentTarget = resolve(ROOT, "release", "raw", packageVersion);
  if (existsSync(currentTarget)) {
    const invocation = spawnSync(process.execPath, [BUILD_SCRIPT], { cwd: ROOT, encoding: "utf8" });
    assert.notEqual(invocation.status, 0, "actual current-version release invocation must reject an existing target");
    assert.match(`${invocation.stdout}${invocation.stderr}`, /already exists and is immutable/u);
    assert.doesNotMatch(`${invocation.stdout}${invocation.stderr}`, /building for production|Raw .* release proof created/u, "existing-target rejection must precede Vite build");
  } else {
    console.log(`Skipped actual build-release invocation because ${relative(ROOT, currentTarget)} is absent; ordinary tests must never claim or build a missing future target.`);
  }
  assert.deepEqual(assertImmutableRelease(), before, "safe rejection must preserve the complete immutable raw release");

  console.log("Release target append-only policy validation passed.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

/** @returns {{tree: string, proofSha256: string, inventory: string[]}} */
function assertImmutableRelease() {
  assert.equal(git(["rev-parse", `HEAD:release/raw/${IMMUTABLE_VERSION}`]), IMMUTABLE_TREE);
  const tracked = git(["ls-tree", "-r", "--name-only", "HEAD", "--", `release/raw/${IMMUTABLE_VERSION}`]).split("\n").filter(Boolean).sort();
  const filesystem = walkFiles(immutableRoot).map((path) => relative(ROOT, path)).sort();
  assert.deepEqual(filesystem, tracked, "raw filesystem inventory must exactly equal tracked inventory");
  for (const path of tracked) {
    const workingBytes = readFileSync(resolve(ROOT, path));
    const trackedBytes = execFileSync("git", ["show", `HEAD:${path}`], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
    assert.deepEqual(workingBytes, trackedBytes, `${path} must remain byte-identical to its tracked blob`);
  }
  const proofSha256 = sha256(readFileSync(resolve(immutableRoot, "aerobeat-release-proof.json")));
  assert.equal(proofSha256, IMMUTABLE_PROOF_SHA256);
  return { tree: IMMUTABLE_TREE, proofSha256, inventory: tracked.map((path) => `${path}\t${sha256(readFileSync(resolve(ROOT, path)))}`) };
}

/** @param {string[]} args */
function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

/** @param {string} root @returns {string[]} */
function inventory(root) {
  return walkFiles(root).map((path) => `${relative(root, path)}\t${statSync(path).size}\t${sha256(readFileSync(path))}`);
}

/** @param {string} root @returns {string[]} */
function walkFiles(root) {
  return readdirSync(root).sort().flatMap((entry) => {
    const path = resolve(root, entry);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

/** @param {Buffer} bytes */
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** @param {string[]} args @returns {Promise<{status: number | null, stdout: string, stderr: string}>} */
function runNode(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
  });
}
