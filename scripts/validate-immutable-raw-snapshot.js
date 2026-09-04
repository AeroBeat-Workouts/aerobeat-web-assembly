// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const BASELINE = "f54d5ff94e831a6ac23fc05b489e1137aadffcdd";
assert.equal(git(["cat-file", "-t", BASELINE]), "commit");
assert.equal(git(["merge-base", "--is-ancestor", BASELINE, "HEAD"], true), "", "clean public assembly baseline must remain an ancestor");
const releases = git(["ls-tree", `${BASELINE}:release/raw`]).split("\n").filter(Boolean);
assert.equal(releases.length, 14, "raw predecessor inventory drifted");
const snapshots = [];
for (const line of releases) {
  const match = /^040000 tree ([0-9a-f]{40})\t(.+)$/u.exec(line); assert.ok(match);
  const [, tree, version] = match; const path = `release/raw/${version}`;
  assert.equal(git(["rev-parse", `${BASELINE}:${path}`]), tree);
  assert.equal(git(["rev-parse", `HEAD:${path}`]), tree, `${version} tracked tree changed after baseline`);
  const tracked = git(["ls-tree", "-r", "--name-only", BASELINE, "--", path]).split("\n").filter(Boolean).sort();
  const filesystem = walk(resolve(ROOT, path)).map((file) => relative(ROOT, file)).sort();
  assert.deepEqual(filesystem, tracked, `${version} filesystem inventory changed`);
  let bytes = 0; const aggregate = createHash("sha256");
  for (const file of tracked) {
    const working = readFileSync(resolve(ROOT, file)); const baseline = gitBytes(["show", `${BASELINE}:${file}`]);
    assert.deepEqual(working, baseline, `${file} changed from clean public baseline`); bytes += working.byteLength;
    aggregate.update(createHash("sha256").update(working).digest("hex")); aggregate.update("  "); aggregate.update(file); aggregate.update("\n");
  }
  const proofPath = `${path}/aerobeat-release-proof.json`; const proofSha256 = tracked.includes(proofPath) ? createHash("sha256").update(readFileSync(resolve(ROOT, proofPath))).digest("hex") : null;
  snapshots.push({ version, tree, files: tracked.length, bytes, proofSha256, aggregate: aggregate.digest("hex") });
}
assert.equal(snapshots.at(-1)?.version, "0.0.38");
assert.deepEqual(snapshots.slice(-4).map(({ version, tree, files, bytes, proofSha256 }) => ({ version, tree, files, bytes, proofSha256 })), [
  { version: "0.0.35", tree: "bd69d3bd309660125d1a5ac3da6d07896c49bb96", files: 20, bytes: 13878153, proofSha256: "22c41e8bf0630bb6b50523a96ab0e886b399a93c74a7d1e97bb2afe47a43c4ea" },
  { version: "0.0.36", tree: "ce125ba4a596f7d6cad84c9e3bf983c5ccf0ed77", files: 41, bytes: 27760611, proofSha256: "3d18dd99afe99fcac389bccee760073baf83cc44c66cdec6d0ac5d933d142daf" },
  { version: "0.0.37", tree: "6d2b8c4e39d3677f28e48ad076bc6259abcd47b9", files: 41, bytes: 27820403, proofSha256: "9415f1ee7f9ddc687b4756be84e5a2bec9dfa9521eb5ec8f6c6ddc5b9ee286f9" },
  { version: "0.0.38", tree: "9c4225c83b8697a6404190bddcbfcbee0a5d60f3", files: 41, bytes: 27834715, proofSha256: "86f08597e4c17d0191d1ba7fb70225c8188c21c0cbc7ffa21b32cb2cef2b6041" }
]);
console.log(`Immutable raw baseline snapshot passed for ${snapshots.length} releases: ${JSON.stringify(snapshots)}`);
function walk(root) { return readdirSync(root).sort().flatMap((entry) => { const path = resolve(root, entry); return statSync(path).isDirectory() ? walk(path) : [path]; }); }
function git(args, allowEmpty = false) { const result = execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim(); return allowEmpty ? result : result; }
function gitBytes(args) { return execFileSync("git", args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }); }
