// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const BASELINE = "e37cc9fd28e7d061190829f7f0966cb8295d5826";
assert.equal(git(["cat-file", "-t", BASELINE]), "commit");
assert.equal(git(["merge-base", "--is-ancestor", BASELINE, "HEAD"], true), "", "clean public assembly baseline must remain an ancestor");
const releases = git(["ls-tree", `${BASELINE}:release/raw`]).split("\n").filter(Boolean);
assert.equal(releases.length, 12, "raw predecessor inventory drifted");
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
assert.equal(snapshots.at(-1)?.version, "0.0.36");
assert.deepEqual(snapshots.slice(-3).map(({ version, tree, files, bytes, proofSha256 }) => ({ version, tree, files, bytes, proofSha256 })), [
  { version: "0.0.34", tree: "1c8db5dff7c0136a6e5a22c6622f4a5409511f70", files: 13, bytes: 11565989, proofSha256: "46ca87869bae0016639277832520eec48031532c5ab509a2cfca36f8fc3d12a2" },
  { version: "0.0.35", tree: "bd69d3bd309660125d1a5ac3da6d07896c49bb96", files: 20, bytes: 13878153, proofSha256: "22c41e8bf0630bb6b50523a96ab0e886b399a93c74a7d1e97bb2afe47a43c4ea" },
  { version: "0.0.36", tree: "ce125ba4a596f7d6cad84c9e3bf983c5ccf0ed77", files: 41, bytes: 27760611, proofSha256: "3d18dd99afe99fcac389bccee760073baf83cc44c66cdec6d0ac5d933d142daf" }
]);
console.log(`Immutable raw baseline snapshot passed for ${snapshots.length} releases: ${JSON.stringify(snapshots)}`);
function walk(root) { return readdirSync(root).sort().flatMap((entry) => { const path = resolve(root, entry); return statSync(path).isDirectory() ? walk(path) : [path]; }); }
function git(args, allowEmpty = false) { const result = execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim(); return allowEmpty ? result : result; }
function gitBytes(args) { return execFileSync("git", args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }); }
