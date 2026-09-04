// @ts-check

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const VALIDATOR = resolve(fileURLToPath(new URL("validate-immutable-raw-snapshot.js", import.meta.url)));
const temporaryRoot = mkdtempSync(join(tmpdir(), "aerobeat-immutable-raw-"));
const worktree = join(temporaryRoot, "worktree");
let added = false;

try {
  execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: ROOT, stdio: "pipe" });
  added = true;

  for (const version of ["0.0.37", "0.0.38"]) {
    const relativeProof = `release/raw/${version}/aerobeat-release-proof.json`;
    const proofPath = join(worktree, relativeProof);
    const original = readFileSync(proofPath);
    assert.ok(original.byteLength > 0, `${relativeProof} must not be empty`);
    const mutated = Buffer.from(original);
    mutated[0] ^= 1;
    writeFileSync(proofPath, mutated);

    const result = spawnSync(process.execPath, [VALIDATOR], {
      cwd: worktree,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    });
    writeFileSync(proofPath, original);

    assert.notEqual(result.status, 0, `${version} one-byte mutation must be rejected`);
    assert.match(`${result.stdout ?? ""}\n${result.stderr ?? ""}`, new RegExp(`${relativeProof} changed from clean public baseline`));
  }
} finally {
  if (added) execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: ROOT, stdio: "pipe" });
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("Immutable raw mutation rejection passed for 0.0.37 and 0.0.38 in a disposable worktree");
