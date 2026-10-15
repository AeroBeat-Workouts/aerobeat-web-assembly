#!/usr/bin/env node
// @ts-check
// Candidate-path tests are deliberately invalid invocations: never sign dirty source.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstatSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(root, "scripts/write-friend-game-bundle-manifest.js");
const frozen = path.join(root, "dist-friend-game/friend-game-bundle-manifest.json");
const before = lstatSync(frozen);
const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
for (const args of [
  ["--candidate-dir", "/tmp/other"], ["--candidate-dir", "../elsewhere"],
  ["--candidate-dir", ".tmp/../dist-friend-game"], ["--candidate-dir", "dist-friend-game"],
  ["--candidate-dir", ".tmp/../../elsewhere"], ["--candidate-dir", ".tmp/nested/other"],
  ["--candidate-dir", ".tmp/absent"], ["--candidate-dir"], ["--other", ".tmp/test"],
]) {
  const result = run(...args);
  assert.notEqual(result.status, 0, `unsafe invocation accepted: ${args}`);
  assert.match(result.stderr, /Friend game signing:/u);
}
const temporary = mkdtempSync(path.join(root, ".tmp/", "candidate-path-test-"));
const name = path.basename(temporary);
try {
  rmSync(temporary, { recursive: true });
  symlinkSync(path.join(root, "dist-friend-game"), temporary, "dir");
  assert.notEqual(run("--candidate-dir", `.tmp/${name}`).status, 0, "symlink candidate accepted");
} finally {
  rmSync(temporary);
}
// No-argument behavior still targets the frozen original, rejecting its existing sidecar
// (or dirty source) rather than creating or selecting a candidate.
const defaultResult = run();
assert.notEqual(defaultResult.status, 0);
assert.match(defaultResult.stderr, /source dirty|sidecar exists/u);
assert.equal(lstatSync(frozen).ino, before.ino);
assert.equal(lstatSync(frozen).size, before.size);
console.log("Candidate path and unchanged default assertions passed.");
