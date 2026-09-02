// @ts-check

import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { assertDetachedTarget, normalizeDetachedTarget, verifyArchive } from "./release-pack-policy.js";

const temporaryRoot = mkdtempSync(resolve(tmpdir(), "aerobeat-pack-policy-"));
const fixture = resolve(temporaryRoot, "fixture");
const packs = resolve(temporaryRoot, "packs");
mkdirSync(fixture);
mkdirSync(packs);

try {
  writeFileSync(resolve(fixture, "package.json"), `${JSON.stringify({ name: "pack-policy-fixture", version: "1.0.0", private: true, files: ["plain.txt", "tool.sh"] }, null, 2)}\n`);
  writeFileSync(resolve(fixture, "plain.txt"), "plain\n");
  writeFileSync(resolve(fixture, "tool.sh"), "#!/bin/sh\nexit 0\n");
  chmodSync(resolve(fixture, "plain.txt"), 0o644);
  chmodSync(resolve(fixture, "package.json"), 0o644);
  chmodSync(resolve(fixture, "tool.sh"), 0o755);
  git(fixture, ["init", "-q"]);
  git(fixture, ["config", "user.name", "Pack Policy Test"]);
  git(fixture, ["config", "user.email", "pack-policy@example.invalid"]);
  git(fixture, ["add", "."]);
  git(fixture, ["commit", "-qm", "fixture"]);
  const commit = git(fixture, ["rev-parse", "HEAD"]);

  assert.throws(() => normalizeDetachedTarget(fixture, commit), /explicitly detached/u);
  git(fixture, ["checkout", "--detach", "-q"]);
  chmodSync(resolve(fixture, "package.json"), 0o600);
  chmodSync(resolve(fixture, "plain.txt"), 0o600);
  chmodSync(resolve(fixture, "tool.sh"), 0o700);
  assert.throws(() => assertDetachedTarget(fixture, commit), /has mode 0600, expected 0644/u);

  const normalized = normalizeDetachedTarget(fixture, commit);
  assert.equal(normalized.trackedFileCount, 3);
  assert.deepEqual(normalized.modeCounts, { "0644": 2, "0755": 1 });
  assert.equal(statSync(resolve(fixture, "plain.txt")).mode & 0o777, 0o644);
  assert.equal(statSync(resolve(fixture, "tool.sh")).mode & 0o777, 0o755);
  assert.equal(git(fixture, ["status", "--porcelain=v1", "--untracked-files=all"]), "");

  const pack = spawnSync("npm", ["pack", "--json", "--pack-destination", packs], {
    cwd: fixture,
    encoding: "utf8"
  });
  if (pack.status !== 0) throw new Error(`fixture npm pack failed:\n${pack.stderr}`);
  const metadata = JSON.parse(pack.stdout)[0];
  const archive = resolve(packs, metadata.filename);
  const manifest = resolve(temporaryRoot, "manifest.tsv");
  const verified = verifyArchive(fixture, commit, archive, manifest);
  assert.equal(verified.memberCount, 3);
  assert.equal(verified.paxCount, 0);
  assert.deepEqual(verified.modeCounts, { "0644": 2, "0755": 1 });
  assert.equal(readFileSync(manifest, "utf8").split("\n").filter(Boolean).length, 3);

  const paxArchive = resolve(temporaryRoot, "pax.tgz");
  const tar = spawnSync("tar", ["--format=pax", "-czf", paxArchive, "package.json"], { cwd: fixture, encoding: "utf8" });
  if (tar.status !== 0) throw new Error(`fixture pax tar failed:\n${tar.stderr}`);
  assert.throws(() => verifyArchive(fixture, commit, paxArchive, undefined), /PAX member is forbidden/u);

  console.log("Release pack policy self-test passed: detached-only normalization, Git-index modes, npm-member manifest, and PAX rejection.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

/** @param {string} root @param {string[]} args */
function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
