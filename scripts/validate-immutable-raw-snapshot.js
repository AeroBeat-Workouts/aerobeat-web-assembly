// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const BASELINE = "2dbe2b7adb505c44ca979a27958f8b3c5a8cf2e9";
const SUCCESSOR_BASELINE = "e00614e10e74bf084bed859e74c1c6c1f2d22eea";
const DB7_SUCCESSOR_BASELINE = "d895b40776dcd5b8d1b67ab2e5cf5621013e5c7d";
const RELEASE_043_BASELINE = "2454719e7210536b394071def4a327342288af38";
const RELEASE_044_BASELINE = "d581aace7a508057d0351532a01066036bf777c9";
const RELEASE_045_BASELINE = "992d0bb132b69b03ee25d22503b363df2bd5ce3f";
const RELEASE_046_TREE = "90d6b0640087dba82b787c4111fdb024a85b253b";
for (const baseline of [BASELINE, SUCCESSOR_BASELINE, DB7_SUCCESSOR_BASELINE, RELEASE_043_BASELINE, RELEASE_044_BASELINE, RELEASE_045_BASELINE]) {
  assert.equal(git(["cat-file", "-t", baseline]), "commit");
  assert.equal(git(["merge-base", "--is-ancestor", baseline, "HEAD"], true), "", `${baseline} immutable assembly baseline must remain an ancestor`);
}
const predecessorReleases = git(["ls-tree", `${BASELINE}:release/raw`]).split("\n").filter(Boolean);
assert.equal(predecessorReleases.length, 15, "raw predecessor inventory drifted");
const releases = [
  ...predecessorReleases,
  "040000 tree 7e73b56e512ff877f17dc44a0bc8a19fd2104987\t0.0.40",
  "040000 tree 0b5f7841ef65779d84f028a544724a6d76cd06a1\t0.0.41",
  "040000 tree 62b9475ec079849cd285b3e788357fc88fb52b91\t0.0.43",
  "040000 tree 691aca00aae5ec23b5004b6df70c49ac9364fd9e\t0.0.44",
  "040000 tree 7f956672151127aceb748891ac4861f825cdb699\t0.0.45",
  `040000 tree ${RELEASE_046_TREE}\t0.0.46`
];
const snapshots = [];
for (const line of releases) {
  const match = /^040000 tree ([0-9a-f]{40})\t(.+)$/u.exec(line); assert.ok(match);
  const [, tree, version] = match; const path = `release/raw/${version}`;
  const referenceCommit = version === "0.0.46" ? "HEAD" : version === "0.0.45" ? RELEASE_045_BASELINE : version === "0.0.44" ? RELEASE_044_BASELINE : version === "0.0.43" ? RELEASE_043_BASELINE : version === "0.0.41" ? DB7_SUCCESSOR_BASELINE : version === "0.0.40" ? SUCCESSOR_BASELINE : BASELINE;
  assert.equal(git(["rev-parse", `${referenceCommit}:${path}`]), tree);
  assert.equal(git(["rev-parse", `HEAD:${path}`]), tree, `${version} tracked tree changed after baseline`);
  const entries = git(["ls-tree", "-r", referenceCommit, "--", path]).split("\n").filter(Boolean).map((entry) => {
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
    const working = readFileSync(resolve(ROOT, file)); const baseline = gitBytes(["show", `${referenceCommit}:${file}`]);
    assert.deepEqual(working, baseline, `${file} changed from clean public baseline`); bytes += working.byteLength;
    const manifestRow = `${createHash("sha256").update(working).digest("hex")}  ${file}\n`;
    aggregate.update(manifestRow); completeManifestRows.push(manifestRow);
  }
  const proofPath = `${path}/aerobeat-release-proof.json`; const proofSha256 = tracked.includes(proofPath) ? createHash("sha256").update(readFileSync(resolve(ROOT, proofPath))).digest("hex") : null;
  const proof = proofSha256 === null ? null : JSON.parse(readFileSync(resolve(ROOT, proofPath), "utf8"));
  const completeManifestAggregate = createHash("sha256").update(completeManifestRows.sort().join("")).digest("hex");
  snapshots.push({ version, tree, files: tracked.length, bytes, modes: [...new Set(entries.map(({ mode }) => mode))], proofSha256, sourceFingerprint: proof?.sourceFingerprint ?? null, aggregate: aggregate.digest("hex"), completeManifestAggregate });
}
assert.equal(snapshots.at(-1)?.version, "0.0.46");
assert.deepEqual(snapshots.slice(-10).map(({ version, tree, files, bytes, proofSha256 }) => ({ version, tree, files, bytes, proofSha256 })), [
  { version: "0.0.36", tree: "ce125ba4a596f7d6cad84c9e3bf983c5ccf0ed77", files: 41, bytes: 27760611, proofSha256: "3d18dd99afe99fcac389bccee760073baf83cc44c66cdec6d0ac5d933d142daf" },
  { version: "0.0.37", tree: "6d2b8c4e39d3677f28e48ad076bc6259abcd47b9", files: 41, bytes: 27820403, proofSha256: "9415f1ee7f9ddc687b4756be84e5a2bec9dfa9521eb5ec8f6c6ddc5b9ee286f9" },
  { version: "0.0.38", tree: "9c4225c83b8697a6404190bddcbfcbee0a5d60f3", files: 41, bytes: 27834715, proofSha256: "86f08597e4c17d0191d1ba7fb70225c8188c21c0cbc7ffa21b32cb2cef2b6041" },
  { version: "0.0.39", tree: "799c9b346f1e1bffc96bf8e0cd01d8edd5e33928", files: 41, bytes: 27979912, proofSha256: "a7687d39d0447b65f786c4de947d2c645a010e078cd976690cc2f8998415417d" },
  { version: "0.0.40", tree: "7e73b56e512ff877f17dc44a0bc8a19fd2104987", files: 39, bytes: 27494704, proofSha256: "cce82e47d1c00f7f2ef49e095c414c2079cf564254f3d7e1d34267d024e73af3" },
  { version: "0.0.41", tree: "0b5f7841ef65779d84f028a544724a6d76cd06a1", files: 39, bytes: 27517598, proofSha256: "8640745a387bf510c762a3d62e80b1e3a095386d3857f24c7e561f8614f9c76c" },
  { version: "0.0.43", tree: "62b9475ec079849cd285b3e788357fc88fb52b91", files: 39, bytes: 28199850, proofSha256: "cb362e103db705ab0c3b7e9fc6666cafe8255a2d093acfd7a9a2dd5bc9b5f1c0" },
  { version: "0.0.44", tree: "691aca00aae5ec23b5004b6df70c49ac9364fd9e", files: 39, bytes: 28219166, proofSha256: "26ce02f790178d6604a651f13239b29e428bfb3926523671e96e0676ca3bc01e" },
  { version: "0.0.45", tree: "7f956672151127aceb748891ac4861f825cdb699", files: 39, bytes: 28222754, proofSha256: "86f5ae56b027452adad0d4d6062560a3d6c0eeb84d44bedf7bf44ba2c56ce57d" },
  { version: "0.0.46", tree: "90d6b0640087dba82b787c4111fdb024a85b253b", files: 39, bytes: 28247911, proofSha256: "083df3fb347abdb9eaa68d188621225c6c99e821cfa071a0639f0f7a654c633d" }
]);
assert.deepEqual(snapshots.at(-1), {
  version: "0.0.46",
  tree: "90d6b0640087dba82b787c4111fdb024a85b253b",
  files: 39,
  bytes: 28247911,
  modes: ["100644"],
  proofSha256: "083df3fb347abdb9eaa68d188621225c6c99e821cfa071a0639f0f7a654c633d",
  sourceFingerprint: "3b17f29ccb8e0870d50004b9757f50ecc346d926650eab3ff6716f7f9e497e25",
  aggregate: "70a0222c3ee494449cd86ff789fbd009d198d2dfdedbfb57790516499546d872",
  completeManifestAggregate: "9f882267f68f99f8fc66a238c07c7183c97db74991e3a992b9e580621ab02489"
});
console.log(`Immutable raw baseline snapshot passed for ${snapshots.length} releases: ${JSON.stringify(snapshots)}`);
function walk(root) { return readdirSync(root).sort().flatMap((entry) => { const path = resolve(root, entry); return statSync(path).isDirectory() ? walk(path) : [path]; }); }
function git(args, allowEmpty = false) { const result = execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim(); return allowEmpty ? result : result; }
function gitBytes(args) { return execFileSync("git", args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }); }
