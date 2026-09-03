# Renderer gameplay sync atomicity during k72.28

## Exact Observed Failure

During concurrent renderer environment-lifecycle work, `scripts/validate-browser-renderer.js:6` timed out while waiting for both renderer instances to report `gameplayAssets.state === "ready"`. Direct inspection showed `src/gameplay-assets.js` and validators already named `0.0.3`, while `assets/gameplay/0.0.3/` had not yet been copied. Both renderers therefore requested missing package-local GLBs. This was a transient worktree failure, not a committed baseline or environment-transform behavior.

## Expected Behavior

The renderer source pin and packaged payload must change as one coherent candidate: exact gameplay release `0.0.3` must exist before browser validation requests its seven GLBs. Both instances must reach ready with seven independently parsed resources.

## Execution Path

1. `validate-browser-renderer.js` opens the renderer testbed.
2. Testbed constructs two renderer facades.
3. Each `PlayCanvasGameplayAssetPreloader` resolves URLs from `src/gameplay-assets.js`.
4. The source module had already switched URL roots to `assets/gameplay/0.0.3/`.
5. Concurrent orchestration had not yet completed the binary sync into that directory.
6. Package-local GLB requests failed, so the readiness wait could not complete.

## Most Likely Root Cause

The root cause was non-atomic ordering of two concurrent integration actions in one renderer checkout: source constants changed before the exact payload copy settled. Evidence is the observed half-synced worktree, the absence then later appearance of the `0.0.3` directory, and successful browser validation after the exact 17-file payload was synced and `0.0.2` removed. No environment owner code change was needed to clear the failure.

## Alternative Hypotheses

1. **Environment transform regression** — contradicted by the readiness predicate targeting gameplay assets and by focused environment owner/facade tests passing.
2. **Malformed 0.0.3 GLB** — contradicted by source strict validation, exact hashes, renderer unit parsing, and the subsequent full Chromium pass.
3. **PlayCanvas or HTTP server race** — possible in general, but contradicted here by deterministic missing paths in the half-synced checkout and successful unchanged harness behavior once files existed.

## Why Previous Fixes Failed

No product-code fix was attempted. Retrying while the checkout remained half-synced would only repeat the symptom because the requests still targeted absent files. The environment coder correctly stopped rather than masking the timeout or weakening the wait.

## Unknowns

The precise sub-second interleaving between source edits and the first browser request was not logged. It is not needed for the product fix; reproducing with a deliberately missing `assets/gameplay/0.0.3/` directory would confirm the same path failure.

## Minimal Reproduction

1. Set `gameplayAssetReleaseVersion` to `0.0.3`.
2. Leave only `assets/gameplay/0.0.2/` present.
3. Run `node scripts/validate-browser-renderer.js`.
4. Observe the gameplay-ready wait fail. The failure does not occur when the exact 17-file `0.0.3` tree is present.

## Proposed Verification

Verify the source commit and exact 17-file inventory/hash contract, then run `npm test` followed by `npm run test:browser`. Confirm two applications each parse seven resources and that the browser matrix completes without timeout or request failure.

## Recommended Fix

Stage/sync the exact immutable payload before switching source URL constants, or avoid concurrent edits to pin and payload in the same checkout. For this candidate, complete exact `0.0.3` sync, remove superseded packaged `0.0.2`, strengthen sync verification to reject multiple packaged release directories, then rerun unit/package/browser gates. Do not weaken readiness or timeout assertions.

## Debugging Record

```text
Problem: Renderer browser validation ran against a half-synced gameplay release migration.
Observed symptom: validate-browser-renderer.js timed out waiting for gameplayAssets.ready.
Root cause: Source URLs targeted 0.0.3 before assets/gameplay/0.0.3 existed.
Evidence: Missing directory during failure; later exact 17-file directory; unchanged environment tests; full pass after sync.
Failed approaches: No code workaround attempted; retry before payload completion would repeat the failure.
Corrective action: Sync exact 0.0.3 first, remove 0.0.2, and reject dual/missing packaged releases.
Verification test: npm test; npm run test:browser; npm pack --dry-run --json --ignore-scripts.
Related files/components: src/gameplay-assets.js, scripts/sync-gameplay-assets.js, assets/gameplay/0.0.3, scripts/validate-browser-renderer.js.
Remaining uncertainty: Exact timing of the concurrent edit interleaving was not instrumented.
```
