# ABCCBA hardware evidence source-binding diagnosis

## Exact Observed Failure

The authoritative hardware evidence file `.plans/evidence/2026-09-09-combined-flow-successor-target-abccba.json` contains no source fingerprint, source-input count, Git commit, or tree identity. A full search for `fingerprint`, `commit`, `tree`, `source`, and `authority` finds only `graphicsBackend.authority`.

`scripts/profile-camera-abccba.mjs` returns and writes performance, backend, workload, privacy, and noise fields but never calls `computeReleaseFingerprint()` or records source provenance. `scripts/validate-target-abccba-evidence.mjs` validates those behavioral fields but never computes or compares the current release fingerprint. Consequently, the old evidence validator still passes while the current local release fingerprint is `febf6a161982fa73e4580b6434dde7f1f2d62a83f0f6d69a5c3b49316010433c` and plan prose says the evidence is bound to a prior fingerprint.

Directly observed: the JSON is not self-describing with respect to source provenance, and the validator cannot detect cross-source reuse. Inference: Git commit adjacency gives contextual provenance but does not satisfy the stated fingerprint binding.

## Expected Behavior

A target-hardware evidence record used to authorize the immutable successor must include the exact release fingerprint and input count computed from the source authority it profiled. The validator must compare those fields to a freshly computed current checkout fingerprint/count and fail when evidence from another source authority is supplied.

## Execution Path

1. `profile-camera-abccba.mjs` starts Vite and Playwright from the current checkout.
2. The browser executes the ABCCBA workload and returns a semantic result object.
3. Node appends only `noise` and writes the JSON.
4. The evidence may later be moved or retained while source authorities change.
5. `validate-target-abccba-evidence.mjs` reads the JSON and checks workload/performance/privacy/backend semantics only.
6. Because no source identity is present or compared, stale evidence passes against a different release fingerprint.

## Most Likely Root Cause

The profile was originally designed as a semantic hardware-performance oracle. Later plan prose upgraded it into source-authorizing evidence and described it as fingerprint-bound, but the generator and validator were never extended to implement that stronger provenance contract.

Evidence: no provenance imports or fields in either script; old evidence passes after renderer/UI provenance pins changed the current fingerprint.

## Alternative Hypotheses

1. **The evidence commit alone is sufficient binding.** Git history helps establish when bytes were added, but the JSON can still validate after checkout changes and carries no independently checkable source identity. This contradicts the explicit fingerprint-bound gate.
2. **Package-lock/browser binding is enough.** The release fingerprint includes package-lock and production inputs, but that fingerprint is absent from evidence.
3. **Regenerating the same JSON after every source change is sufficient.** Without an embedded/computed identity, a validator cannot distinguish regenerated evidence from copied stale evidence.

## Why Previous Fixes Failed

Previous validation reran the semantic oracle and observed PASS, then plan prose recorded a fingerprint association outside the file. That approach checked behavior but not provenance. The later renderer/UI pin change exposed the gap because the validator still passed unchanged evidence.

## Unknowns

- Final top-level field names should follow existing release terminology; `sourceFingerprint` and `sourceInputCount` are the minimal compatible choices.
- The final assembly Git commit cannot be embedded before evidence is generated without creating a commit/evidence cycle. The release fingerprint intentionally excludes `.plans/evidence` and scripts, so fingerprint plus input count avoids that cycle.

## Minimal Reproduction

1. Keep the existing evidence JSON unchanged.
2. Change a release dependency provenance pin so `computeReleaseFingerprint()` changes while production behavior remains valid.
3. Run `node scripts/validate-target-abccba-evidence.mjs <old-evidence>`.
4. Current behavior: PASS. Expected behavior: fail with source fingerprint mismatch.

## Proposed Verification

Add source identity to generated evidence and current-source comparison to the validator. The generator must capture fingerprint/count before browser profiling, recompute both after all windows and browser cleanup, and refuse to write evidence on drift. Create temporary copies with one fingerprint character changed and confirm validation fails. Also confirm missing fingerprint, wrong input count, malformed fingerprint, extra provenance, and stale otherwise-valid evidence fail. Regenerate the final headed evidence and validate it against the exact current checkout.

## Recommended Fix

Import `computeReleaseFingerprint` and `listReleaseFingerprintInputs` into the profile generator and validator. Before profiling, compute exact `sourceFingerprint` and `sourceInputCount`; add them as fixed top-level evidence fields. After profiling and cleanup but before writing, recompute both and fail closed if source drifted during the run. In the validator, enforce an exact provenance key set, canonical lowercase 64-hex fingerprint, exact positive integer count, and equality to the current checkout computation before accepting performance results. Extend an existing unit oracle or add a narrowly invoked mutation check without altering package publication/release semantics.

Because scripts and `.plans/evidence` are outside the 214-input fingerprint, this does not create a hash cycle. Regenerate the final evidence only after the complete assembly source repair and authority commit.

## Debugging Record

```text
Problem: ABCCBA evidence is described as source-fingerprint-bound but contains and validates no source identity.
Observed symptom: old evidence passes after the current release fingerprint changed.
Root cause: semantic profile/validator were never extended when the plan adopted a source-authorizing provenance gate.
Evidence: no fingerprint fields/imports/comparisons in profile-camera-abccba.mjs, evidence JSON, or validate-target-abccba-evidence.mjs.
Failed approaches: plan-only fingerprint association and semantic validator reruns.
Corrective action: generate sourceFingerprint/sourceInputCount and validate them against current computeReleaseFingerprint/listReleaseFingerprintInputs.
Verification test: current evidence passes; missing/malformed/mutated/stale identity fails before behavioral authorization.
Related files/components: profile-camera-abccba.mjs; validate-target-abccba-evidence.mjs; final evidence JSON; release-fingerprint.js.
Remaining uncertainty: final field naming only; Git commit embedding is intentionally avoided to prevent authority cycles.
```
