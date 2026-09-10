# Immutable target version and hardware-profile ordering diagnosis

## Exact Observed Failure

The current assembly package version is `0.0.48`, and immutable raw `release/raw/0.0.48` already exists. `scripts/build-release.js` derives its release target exclusively from `package.json.version` and claims that path before building, so invoking it now correctly rejects the existing immutable target.

Creating successor raw `0.0.49` therefore requires `scripts/bump-patch-version.js`, which changes `package.json`, root and root-package versions in `package-lock.json`, and the `aerobeat-release-proof` meta marker in `index.html` to `0.0.49`. `scripts/release-fingerprint.js` explicitly includes all three root files in the source fingerprint. Thus the version bump necessarily changes the fingerprint.

The current plan sequence says to finalize source, run fingerprint-bound hardware profiling/source audit, then build the successor. If the version bump occurs only inside the later release-build lane, it invalidates the supposedly final hardware fingerprint and source audit. If no bump occurs, the builder cannot target `0.0.49` at all.

No version or release files were changed during this diagnosis.

## Expected Behavior

The source-only version bump to `0.0.49` must occur and be committed before the final fingerprint is computed, before authoritative target-hardware evidence is generated, and before final source audit. The actual release build must remain blocked until source audit passes and must be invoked exactly once against the already-staged absent `release/raw/0.0.49` target.

## Execution Path

1. Current source has package version `0.0.48`; immutable raw `0.0.48` exists.
2. `build-release.js` reads `package.json.version` and sets `releaseRoot=release/raw/<version>`.
3. Append-only target policy rejects existing `release/raw/0.0.48` before Vite runs.
4. `bump-patch-version.js` changes package/lock versions and the index release-proof meta marker to `0.0.49`.
5. Release fingerprint hashes those changed root files, producing a new source identity.
6. Any hardware evidence generated before the bump is stale under the required source-binding contract.
7. Once bumped, tested, profiled, and audited, the single builder invocation can claim absent `release/raw/0.0.49` without another source change.

## Most Likely Root Cause

The plan treated “version bump and build” as one release-stage action while also requiring hardware evidence to bind the final source fingerprint before release construction. That sequencing overlooks that package version is itself a fingerprinted source input.

## Alternative Hypotheses

1. **Build `0.0.49` via an environment override without changing package version.** Contradicted by `build-release.js`, which reads only `package.json.version` for target and proof version.
2. **Version bump does not affect runtime fingerprint.** Contradicted by `listReleaseFingerprintInputs()`, which includes root package, lock, and index files.
3. **Profile `0.0.48` source and accept equivalent runtime behavior.** Contradicts the explicit final-source fingerprint binding and immutable proof's `proofVersion`.
4. **Bump after audit and rerun only the fingerprint check.** Insufficient: source audit and hardware evidence would both predate final fingerprinted bytes.

## Why Previous Fixes Failed

Previous hardware evidence was treated as reusable because behavior and 214-input count remained stable. Renderer/UI provenance changes already showed that hash identity matters. The newly identified evidence-binding repair makes the latent version-ordering cycle explicit.

## Unknowns

- An earlier in-memory reproduction of the supported three-file bump predicted `8e4e6458e93be4e5643899b05a7bbf472e9d37407cb1e9c5e6e03d5bded8de82` over 214 inputs, but `4waa` subsequently proved the obsolete VideoFrame smoke is exported by a `package.json` script that must be removed with the file. Because `package.json` is fingerprinted, that prediction is now explicitly invalid. An updated in-memory simulation that removes the obsolete package script and applies the exact supported three-file bump predicts `510faed6a6a1c221c7c53d49191a94e082ebc2722ca07d4bd3e54ecb5d8d3a65` over 214 inputs. This too remains non-authoritative until `4waa` lands and `3ngx` executes with canonical helper confirmation; any further fingerprint-input repair invalidates it.
- The bump script deterministically updates exactly three tracked files: package version in `package.json`, top-level and root-package versions in `package-lock.json`, and the release-proof meta marker in `index.html`. A disposable-directory execution of the real supported script confirmed all four version fields/markers become exactly `0.0.49` and the index contains exactly one matching meta marker; the temporary directory was removed without touching the source worktree. Final diff verification must reject any additional path or unmatched/duplicated meta marker.

## Minimal Reproduction

1. On current `0.0.48` source, run the release-target policy: it confirms an actual build would reject existing raw `0.0.48`.
2. Inspect `bump-patch-version.js`: it changes package/lock versions and the index meta marker.
3. Inspect `listReleaseFingerprintInputs()`: all three files are hashed.
4. Therefore a pre-bump evidence fingerprint cannot equal the final pre-build `0.0.49` source fingerprint.

## Proposed Verification

After all code repairs and QA settle:

1. Snapshot immutable raw history and prove `release/raw/0.0.49` absent.
2. Run the supported patch bump exactly once; inspect that only intended version markers changed and no raw directory was created.
3. Commit/push the version-staged source authority.
4. Recompute fingerprint/count and run full unit/browser/build-dry-run/release-target gates.
5. Generate and validate fingerprint-bound hardware evidence.
6. Complete final source audit.
7. Invoke `build-release.js` exactly once; confirm its proof version/fingerprint equal the pre-audited source authority.

## Recommended Fix

Create a separate source-staging Bead for the safe `0.0.48` → `0.0.49` version bump. Make it depend on completion of all source repair/QA and make final hardware profiling/source audit depend on it. Keep `4pod` as the one-use immutable builder and do not invoke it during version staging. Add preflight assertions that `package.json`, both lockfile version fields, and the sole index meta marker all equal `0.0.49`, raw target is absent, and final fingerprint matches embedded hardware evidence before authorizing the build.

## Debugging Record

```text
Problem: A post-profile version bump would change the fingerprint, while an unbumped builder targets existing immutable 0.0.48.
Observed symptom: build target derives from package version 0.0.48; bump changes three fingerprinted files.
Root cause: plan combined source version staging with later immutable construction despite pre-build final-source hardware/audit gates.
Evidence: build-release.js target/proof derivation; bump-patch-version.js edits; release-fingerprint.js input list.
Failed approaches: treating version bump as part of post-audit build; assuming behaviorally unchanged evidence remains source-bound.
Corrective action: commit a source-only 0.0.49 bump before final fingerprint, hardware profile, and source audit; build once afterward.
Verification test: post-bump source gates/evidence/audit pass, then one builder invocation produces proofVersion 0.0.49 with identical source fingerprint.
Related files/components: package.json, package-lock.json, index.html, bump-patch-version.js, build-release.js, release-fingerprint.js, t53h evidence binding, 4pod builder.
Remaining uncertainty: exact final fingerprint and any additional bump-script marker diff until repairs settle.
```
