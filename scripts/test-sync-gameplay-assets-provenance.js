// @ts-check

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = process.cwd();
const canonicalRenderer = resolve(root, "../aerobeat-web-renderer");
const validator = resolve(root, "scripts/sync-gameplay-assets.js");
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "aerobeat-assembly-gameplay-provenance-"));
const fixture = resolve(temporaryRoot, "renderer");
const run = () => spawnSync(process.execPath, [validator, "verify", "--source", fixture], { cwd:root, encoding:"utf8" });
const expectPass = (label) => { const result = run(); if (result.status !== 0) throw new Error(`${label} unexpectedly failed\n${result.stdout}${result.stderr}`); };
const expectFailure = (label, fragment) => { const result = run(); const output = `${result.stdout}${result.stderr}`; if (result.status === 0 || !output.includes(fragment)) throw new Error(`${label} did not fail closed with ${JSON.stringify(fragment)}\n${output}`); };
try {
  execFileSync("git", ["clone", "--shared", "--quiet", canonicalRenderer, fixture]);
  expectPass("exact clean renderer authority");
  const ledgerPath = resolve(fixture, ".beads/interactions.jsonl");
  const ledgerBytes = readFileSync(ledgerPath);
  writeFileSync(ledgerPath, Buffer.concat([ledgerBytes, Buffer.from("{\"fixture\":true}\n")]));
  expectPass("exact protected unstaged renderer ledger authority");
  writeFileSync(ledgerPath, ledgerBytes);
  execFileSync("git", ["checkout", "--quiet", "--detach", "HEAD^"], { cwd:fixture });
  expectFailure("wrong renderer authority", "renderer source commit drifted");
  execFileSync("git", ["checkout", "--quiet", "main"], { cwd:fixture });
  writeFileSync(resolve(fixture, "untracked-provenance-probe"), "dirty\n");
  expectFailure("dirty renderer authority", "Release dependency worktree is dirty for renderer gameplay source");
  console.log("Assembly gameplay provenance adversaries passed: clean and sole exact protected ledger dirt accepted; wrong commit and all other dirt rejected before package mutation.");
} finally {
  rmSync(temporaryRoot, { recursive:true, force:true });
}
