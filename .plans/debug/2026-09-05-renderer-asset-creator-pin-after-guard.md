# Renderer asset creator pin after immutable-guard commit

## Exact Observed Failure

`aerobeat-web-renderer` `npm test` fails in `npm run check:assets` at `scripts/sync-gameplay-assets.js:29`:

```text
Error: asset source HEAD must equal pinned creator commit: 80bcb3a46e1c9465bfabd549d1b40b7989b40d9d
```

Directly observed: the sibling asset repository is clean at `80bcb3a...`; the script requires exact `HEAD === 7dec076e...` before checking release bytes.

## Expected Behavior

The renderer must pin the immutable gameplay `0.0.7` creator provenance and raw payload while permitting later clean descendant commits that change validation tooling only. It must reject a checkout that does not descend from the creator, a dirty checkout, or any current raw `0.0.7` tree/inventory/proof/payload drift.

## Execution Path

1. Renderer `npm test` invokes `npm run check`.
2. `check:assets` invokes `node scripts/sync-gameplay-assets.js --verify`.
3. The script resolves sibling `aerobeat-asset-gameplay`.
4. It reads current `HEAD` as `80bcb3a...`.
5. Line 29 compares current HEAD to creator commit `7dec076e...` and throws.
6. Later creator-tree, current-release-tree, clean-worktree, inventory, proof, set, GLB, and packaged-copy checks never run.

## Most Likely Root Cause

The validator conflates two identities: immutable release creator provenance and the mutable repository checkout tip. Exact HEAD/full-tree equality was safe only while the asset repository had no post-release tooling commits. Commit `80bcb3a...` is a descendant of `7dec076e...` and changes only `tools/reproducibility.py`, `tools/test_subprocess_contract.py`, and `tools/validate.py`; `release/raw/0.0.7` remains exact tree `846c41297230b5077ab1119880b729cc120e1098`.

## Alternative Hypotheses

1. **Payload drift** — contradicted by `git rev-parse 80bcb3a:release/raw/0.0.7` returning the pinned tree.
2. **Dirty checkout** — contradicted by clean status; the script fails before its dirty-worktree check.
3. **Wrong creator commit** — contradicted by the renderer's public contract and release tree at `7dec076e...`.

## Why Previous Fixes Failed

No renderer fix was attempted. The asset immutability repair correctly added post-release validation tooling while preserving frozen payloads, exposing a latent overly broad exact-HEAD assumption.

## Unknowns

The minimal implementation shape is still to be independently reviewed: either use `git merge-base --is-ancestor` or an equivalent object-level ancestry check. Verification must prove non-descendant and payload-drift rejection rather than merely making the current checkout pass.

## Minimal Reproduction

From clean renderer and asset `origin/main` checkouts:

```bash
cd aerobeat-web-renderer
npm test
```

The failure does not occur if the asset checkout is detached at `7dec076e...`, but that excludes legitimate later tooling-only commits.

## Proposed Verification

Before changing behavior, assert all of:

- current asset HEAD descends from the pinned creator commit;
- the pinned creator commit has the pinned full tree;
- both creator and current HEAD resolve raw `0.0.7` to the pinned release tree;
- current worktree is clean;
- current release inventory/proof/files remain exact;
- disposable non-descendant, dirty, and mutated-release fixtures fail closed.

## Recommended Fix

Keep `gameplayAssetSourceCommit` and creator provenance unchanged. Replace current-HEAD/full-tree equality with a creator-object full-tree check plus a current-HEAD descendant check. Retain current release-tree, clean status, inventory/proof/hash, payload, and packaged-copy checks. Add explicit adversarial coverage.

## Debugging Record

```text
Problem: Renderer asset validation rejects legitimate post-release asset-tooling commits.
Observed symptom: check:assets throws because current clean asset HEAD 80bcb3a does not equal creator commit 7dec076e.
Root cause: Validator conflates immutable creator provenance with mutable clean repository tip.
Evidence: 80bcb3a descends from 7dec076e; only tools changed; raw 0.0.7 tree remains 846c4129.
Failed approaches: None; first failure after immutable-guard commit.
Corrective action: Pin creator object/tree and require current clean HEAD descendant plus exact current release bytes.
Verification test: Current descendant passes; non-descendant, dirty, and release-drift copies fail.
Related files/components: renderer scripts/sync-gameplay-assets.js, asset release/raw/0.0.7.
Remaining uncertainty: Exact bounded fixture strategy for non-descendant rejection.
```

## CODER Resolution (2026-09-05)

The smallest production change landed in the renderer validator. Public/runtime creator identity remains exact commit `7dec076e243571144b7ead638d3e3f4780bcb9f4`; the validator resolves that Git object's complete tree and requires exact `62863270ed4455eee7132d9bb374522a46f72e30`. It then requires the current clean asset `HEAD` to descend from the creator with `git merge-base --is-ancestor`. Both the creator object and current `HEAD` must resolve `release/raw/0.0.7` to exact tree `846c41297230b5077ab1119880b729cc120e1098` before the unchanged inventory, proof, set, GLB, exact-membership, byte/hash, packaged-copy, and sole-release checks run.

A disposable shared-clone fixture now runs under `npm run check:assets`. It accepts the current clean tooling-only descendant and rejects: (1) an unrelated root commit built from the exact creator full tree, proving ancestry is not inferred from equal content; (2) an untracked dirty-worktree probe; and (3) a clean committed raw-release mutation. A creator-tree mismatch cannot be fabricated without substituting the pinned SHA-1 object or adding a production bypass, so the production object-resolution comparison itself remains the direct fail-closed authority rather than weakening it for a synthetic test seam.

Renderer commit `24dac468ff2f2dc9bd3ed983198d6d61470ca83e` (tree `cf319eb753d6ac317d5c1cb85501343ba43d04b9`) is pushed. The exact previously failing `npm test`, full renderer Chromium suite, asset `0.0.7` validation, and renderer dry pack passed. Dry pack remains exactly 39 public package files including the exact 17-file gameplay payload; test scripts are not packaged.

Assembly's exact immutable-source pin remains intentionally unchanged at renderer `48af4340ff74bfed28be44641f89628292a14f1d` / tree `90129f441c1327d22f64fca9e9d84e1fe01de45c`. Therefore aggregate assembly `npm test` correctly fails its public-main synchronization check after renderer `main` advances; changing that pin would mutate current assembly source and falsely rewrite frozen `0.0.39` provenance. Immutable snapshot/mutation and linked asset/package checks passed with the renderer detached at the exact frozen pin. Full assembly browser validation passed on retry after one isolated 3-second mobile transition timeout; the focused mobile gate passed immediately between attempts, so no speculative timeout edit was made. No release build, serve, publication, tag, GitHub Release, or frozen payload mutation occurred.

## Follow-up diagnosis: current-source integration pin versus frozen raw proof

### Exact observed follow-up failure

With renderer `main` clean at `24dac468ff2f2dc9bd3ed983198d6d61470ca83e` / tree `cf319eb753d6ac317d5c1cb85501343ba43d04b9`, assembly `npm test` fails while loading Vite configuration:

```text
Error: Release dependency provenance drifted for @aerobeat/web-renderer
```

The path is `npm test` → `npm run check` → `check:console` → Vite config → `computeReleaseFingerprint()` → `readReleaseDependencyProvenance()` → current renderer commit/tree comparison in `scripts/release-fingerprint.js`. `scripts/validate-environment-assembly.js` and the README current dependency table independently retain the same stale renderer pin.

### Corrected distinction and root cause

The prior CODER conclusion conflated two different authorities. `releaseDependencyPins` binds the **current assembly source graph** consumed by ordinary tests/builds; advancing it to an intentional clean renderer successor does not modify or rewrite any frozen raw release. In contrast, raw `0.0.39`'s stored source fingerprint `84cbbaa7445a24095dccc21af2c5f504840d136891798577739696101e1a879a`, raw tree `799c9b346f1e1bffc96bf8e0cd01d8edd5e33928`, proof bytes, and immutable validator baseline describe the already-built frozen payload and must remain unchanged.

Root cause: the renderer fix was pushed without advancing the three current-source assembly pin authorities. The smallest correction is to update only current-source renderer commit/tree constants and documentation to `24dac468ff2f2dc9bd3ed983198d6d61470ca83e` / `cf319eb753d6ac317d5c1cb85501343ba43d04b9`, allow the current fingerprint to derive naturally, and retain all frozen raw fingerprint/tree/proof fixtures exactly.

Verification must distinguish these authorities: ordinary assembly tests/build/browser and current-source fingerprint validators pass at the new renderer pin, while immutable snapshot/mutation gates reproduce every existing raw tree and raw `0.0.39` stored fingerprint unchanged. No `build-release`, serve, or publication operation is permitted.

## Follow-up implementation and verification

Only three current-source authorities changed: the renderer commit/tree row in `scripts/release-fingerprint.js`, the matching linked-renderer assertions in `scripts/validate-environment-assembly.js`, and the README current integration/table pins. The derived current-source fingerprint is now `817d6ef3a84460771fb8621918d2957f829c697a9a1e3334ccfee31faea0b9e2` over 202 inputs. No raw proof or immutable baseline fixture was rewritten.

PASS: assembly `npm test`; normal `npm run build`; `npm run test:q7g-oracles`; full `npm run test:browser`; immutable snapshot and one-byte mutation rejection; release-target and release-pack policy; and `npm pack --dry-run --json` (`119` files, `16,195,032` packed / `17,222,207` unpacked bytes, SHA-1 `46e18e4ff9f62353c90c51a006f3b1deedbf2060`). The first two aggregate q7g attempts reached the final terminal shard and encountered Playwright `locator.evaluate: Resulting promise was garbage collected` during first-load Vite dependency optimization; a focused desktop terminal shard and a traced full terminal matrix passed, then the complete q7g command passed after the optimizer cache reported a consistent hash. No code or timeout workaround was introduced for that transient harness condition.

Frozen raw trees remain exact: `0.0.35` `bd69d3bd309660125d1a5ac3da6d07896c49bb96`; `0.0.36` `ce125ba4a596f7d6cad84c9e3bf983c5ccf0ed77`; `0.0.37` `6d2b8c4e39d3677f28e48ad076bc6259abcd47b9`; `0.0.38` `9c4225c83b8697a6404190bddcbfcbee0a5d60f3`; `0.0.39` `799c9b346f1e1bffc96bf8e0cd01d8edd5e33928`. Raw `0.0.39` retains stored source fingerprint `84cbbaa7445a24095dccc21af2c5f504840d136891798577739696101e1a879a` and proof SHA-256 `a7687d39d0447b65f786c4de947d2c645a010e078cd976690cc2f8998415417d`.
