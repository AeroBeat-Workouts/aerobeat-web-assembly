# Raw release target immutability defect

## Exact Observed Failure

At assembly metadata commit `22d936b`, package version remains `0.0.34` and tracked immutable predecessor `release/raw/0.0.34` exists with tree `1c8db5dff7c0136a6e5a22c6622f4a5409511f70`.

`scripts/build-release.js` computes `release/raw/${packageJson.version}` and then unconditionally executes:

```js
rmSync(releaseRoot, { force: true, recursive: true });
mkdirSync(releaseRoot, { recursive: true });
```

Therefore `npm run build-release` at the current package version deletes and replaces the immutable predecessor before any Vite build or proof validation. This is directly observed in source; the destructive command was not rerun for diagnosis.

The current worktree also contained ignored generated `assets/environments/` and `assets/gameplay/` subtrees beneath raw `0.0.34` (ten exact new runtime payload files). The tracked tree remained unchanged, but filesystem immutability was already contaminated. The process that created those ignored files is unknown.

README line 115 directly but incorrectly identifies `0.0.33` as the current deterministic raw proof, while tracked `0.0.34` is the actual immutable predecessor.

## Expected Behavior

Raw release directories are append-only. Release tooling must fail before deletion or build whenever `release/raw/<package-version>` already exists. Task 6 must first advance package metadata to exact successor `0.0.35`, validate that the new target is absent, build once, and thereafter reject rebuilding that target. Raw `0.0.34` tracked and filesystem bytes must remain unchanged.

## Execution Path

1. `npm run build-release` starts `scripts/build-release.js`.
2. The script reads `package.json.version` (`0.0.34`).
3. It computes `releaseRoot = release/raw/0.0.34`.
4. `rmSync(...recursive:true)` deletes the existing immutable release tree.
5. `mkdirSync` recreates the same path.
6. Vite builds new linked source/assets into the predecessor version.
7. Only after mutation does the script validate source-fingerprint stability and write a new proof.

The irreversible policy violation occurs at step 4, before later validations can fail closed.

## Most Likely Root Cause

The builder was designed as a replaceable output-directory build rather than an append-only immutable release publisher. Vite's ordinary `emptyOutDir` model was copied into release semantics, and no explicit existing-target policy guard or regression test was added.

Evidence is the unconditional recursive removal at line 13, current package/target version equality, and absence of any existing-target assertion in release-policy tests.

## Alternative Hypotheses

1. **Git protects tracked release files — false.** Git can restore them afterward, but the build command still deletes/mutates current filesystem bytes and could be committed as a false successor.
2. **`emptyOutDir` alone is the root cause — secondary.** Vite can clear an output directory, but the script already violates immutability before Vite starts. The primary fix must reject existing targets before build.
3. **Ignored payload contamination proves the current script was run — unproven.** The exact files are consistent with a post-integration build, but no authoritative process log identifies their creator. Their presence is a separate current-filesystem cleanup requirement.
4. **Only README is stale — false.** Documentation drift does not cause recursive deletion; executable policy is defective.

## Why Previous Fixes Failed

No prior fix targeted this path. Earlier release-policy work hardened tar/npm derivation and immutable proof verification, but did not place an append-only guard in the raw release builder. Final audits correctly avoided creating `0.0.35`, so the dangerous current-version path remained latent until static inspection.

## Unknowns

- The creator of the ignored raw `0.0.34` payload directories is unknown. Existing shell/job records do not prove attribution.
- Whether a future operator might invoke the script concurrently is not yet covered. An atomic exclusive target creation is preferable but the acceptance minimum is rejection before deletion/build.

## Minimal Reproduction

Do not execute against the real repository because it is destructive. The source-level reproduction is sufficient:

1. Keep `package.json.version` at `0.0.34`.
2. Confirm `release/raw/0.0.34` exists.
3. Trace the first filesystem mutation in `scripts/build-release.js`; it is recursive deletion of that exact path.

A safe regression fixture should create a temporary existing target with a sentinel, invoke the extracted target policy, assert a fail-closed error, and verify sentinel/tree bytes unchanged.

## Proposed Verification

1. Extract a small release-target policy function and unit-test an existing temporary directory/sentinel and an absent target.
2. Assert `build-release.js` calls the guard before `mkdirSync`/Vite and contains no recursive removal path.
3. Safely invoke the current-version builder only after the fail-closed guard exists; it must reject `0.0.34` before build and preserve tracked tree/proof plus filesystem inventory/hash.
4. Clean only the known ignored generated gameplay/environment subtrees and verify raw `0.0.34` matches its tracked inventory exactly.
5. Run unit/browser/build/pack/release-policy gates. Do not create `0.0.35` yet.

## Recommended Fix

Remove recursive target deletion. Add a reusable guard that rejects any existing raw target and use it before directory creation or Vite. Add a focused regression validator with temporary sentinels plus source-order/no-`rmSync` checks, and include it in normal unit/release-policy gates. Update README to name `0.0.34` as immutable predecessor and `0.0.35` as the approved exact successor. Remove only the known ignored generated subtrees from raw `0.0.34` and verify the tracked tree/proof are unchanged.

## Debugging Record

```text
Problem: Raw release builder can overwrite the current immutable release.
Observed symptom: build-release derives existing 0.0.34 target then recursively deletes it; ignored payload subtrees contaminate current raw filesystem.
Root cause: Replaceable output-directory semantics were used for an append-only release path, with no existing-target guard/test.
Evidence: build-release.js lines 8-16; package version 0.0.34; existing tracked target/tree; git clean preview of ignored payload directories.
Failed approaches: Prior tar/npm proof hardening did not cover raw target creation policy.
Corrective action: Fail closed on any existing target before mutation/build; remove rmSync; add regression policy; update README; clean known ignored contamination.
Verification test: Temporary sentinel guard test, source-order check, safe current-version rejection, exact raw 0.0.34 tracked/filesystem hash preservation, full gates.
Related files/components: scripts/build-release.js; new target-policy/validator; package.json; README.md; release/raw/0.0.34.
Remaining uncertainty: Which prior process created ignored files; concurrent publisher race unless target creation is atomic.
```
