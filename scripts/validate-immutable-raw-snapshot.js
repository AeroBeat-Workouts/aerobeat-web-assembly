// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const BASELINE = "2dbe2b7adb505c44ca979a27958f8b3c5a8cf2e9";
assert.equal(git(["cat-file", "-t", BASELINE]), "commit");
assert.equal(git(["merge-base", "--is-ancestor", BASELINE, "HEAD"], true), "", "clean public assembly baseline must remain an ancestor");
const releases = git(["ls-tree", `${BASELINE}:release/raw`]).split("\n").filter(Boolean);
assert.equal(releases.length, 15, "raw predecessor inventory drifted");
const snapshots = [];
for (const line of releases) {
  const match = /^040000 tree ([0-9a-f]{40})\t(.+)$/u.exec(line); assert.ok(match);
  const [, tree, version] = match; const path = `release/raw/${version}`;
  assert.equal(git(["rev-parse", `${BASELINE}:${path}`]), tree);
  assert.equal(git(["rev-parse", `HEAD:${path}`]), tree, `${version} tracked tree changed after baseline`);
  const entries = git(["ls-tree", "-r", BASELINE, "--", path]).split("\n").filter(Boolean).map((entry) => {
    const match = /^(\d{6}) blob ([0-9a-f]{40})\t(.+)$/u.exec(entry); assert.ok(match, `invalid tracked entry ${entry}`);
    return { mode: match[1], blob: match[2], file: match[3] };
  }).sort((a, b) => a.file.localeCompare(b.file));
  const tracked = entries.map(({ file }) => file);
  const filesystem = walk(resolve(ROOT, path)).map((file) => relative(ROOT, file)).sort();
  assert.deepEqual(filesystem, tracked, `${version} filesystem inventory changed`);
  let bytes = 0; const aggregate = createHash("sha256"); const completeManifestRows = [];
  for (const { mode, blob, file } of entries) {
    assert.equal(mode, "100644", `${file} tracked mode changed from 100644`);
    assert.equal(git(["rev-parse", `HEAD:${file}`]), blob, `${file} tracked blob changed after baseline`);
    assert.equal(statSync(resolve(ROOT, file)).mode & 0o111, 0, `${file} worktree executable mode drifted`);
    const working = readFileSync(resolve(ROOT, file)); const baseline = gitBytes(["show", `${BASELINE}:${file}`]);
    assert.deepEqual(working, baseline, `${file} changed from clean public baseline`); bytes += working.byteLength;
    const manifestRow = `${createHash("sha256").update(working).digest("hex")}  ${file}\n`;
    aggregate.update(manifestRow); completeManifestRows.push(manifestRow);
  }
  const proofPath = `${path}/aerobeat-release-proof.json`; const proofSha256 = tracked.includes(proofPath) ? createHash("sha256").update(readFileSync(resolve(ROOT, proofPath))).digest("hex") : null;
  const proof = proofSha256 === null ? null : JSON.parse(readFileSync(resolve(ROOT, proofPath), "utf8"));
  const completeManifestAggregate = createHash("sha256").update(completeManifestRows.sort().join("")).digest("hex");
  snapshots.push({ version, tree, files: tracked.length, bytes, modes: [...new Set(entries.map(({ mode }) => mode))], proofSha256, sourceFingerprint: proof?.sourceFingerprint ?? null, aggregate: aggregate.digest("hex"), completeManifestAggregate });
}
assert.equal(snapshots.at(-1)?.version, "0.0.39");
assert.deepEqual(snapshots.slice(-5).map(({ version, tree, files, bytes, proofSha256 }) => ({ version, tree, files, bytes, proofSha256 })), [
  { version: "0.0.35", tree: "bd69d3bd309660125d1a5ac3da6d07896c49bb96", files: 20, bytes: 13878153, proofSha256: "22c41e8bf0630bb6b50523a96ab0e886b399a93c74a7d1e97bb2afe47a43c4ea" },
  { version: "0.0.36", tree: "ce125ba4a596f7d6cad84c9e3bf983c5ccf0ed77", files: 41, bytes: 27760611, proofSha256: "3d18dd99afe99fcac389bccee760073baf83cc44c66cdec6d0ac5d933d142daf" },
  { version: "0.0.37", tree: "6d2b8c4e39d3677f28e48ad076bc6259abcd47b9", files: 41, bytes: 27820403, proofSha256: "9415f1ee7f9ddc687b4756be84e5a2bec9dfa9521eb5ec8f6c6ddc5b9ee286f9" },
  { version: "0.0.38", tree: "9c4225c83b8697a6404190bddcbfcbee0a5d60f3", files: 41, bytes: 27834715, proofSha256: "86f08597e4c17d0191d1ba7fb70225c8188c21c0cbc7ffa21b32cb2cef2b6041" },
  { version: "0.0.39", tree: "799c9b346f1e1bffc96bf8e0cd01d8edd5e33928", files: 41, bytes: 27979912, proofSha256: "a7687d39d0447b65f786c4de947d2c645a010e078cd976690cc2f8998415417d" }
]);
assert.deepEqual(snapshots.at(-1), {
  version: "0.0.39",
  tree: "799c9b346f1e1bffc96bf8e0cd01d8edd5e33928",
  files: 41,
  bytes: 27979912,
  modes: ["100644"],
  proofSha256: "a7687d39d0447b65f786c4de947d2c645a010e078cd976690cc2f8998415417d",
  sourceFingerprint: "84cbbaa7445a24095dccc21af2c5f504840d136891798577739696101e1a879a",
  aggregate: "6d117d6d5c8185c9e694d5e5ef3ffbc88efa382cfe75f2c49a0ded16a9821059",
  completeManifestAggregate: "d700c4d055c2a5d11e52c6fb59e1cb7b270bec8cb4b1f4a949821ea912dab59d"
});
console.log(`Immutable raw baseline snapshot passed for ${snapshots.length} releases: ${JSON.stringify(snapshots)}`);
function walk(root) { return readdirSync(root).sort().flatMap((entry) => { const path = resolve(root, entry); return statSync(path).isDirectory() ? walk(path) : [path]; }); }
function git(args, allowEmpty = false) { const result = execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim(); return allowEmpty ? result : result; }
function gitBytes(args) { return execFileSync("git", args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }); }
