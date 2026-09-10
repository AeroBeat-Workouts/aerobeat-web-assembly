# Stale successor-version provenance oracle diagnosis

## Exact Observed Failure

After the supported `npm run version:patch` changed the intended source authority from `0.0.48` to `0.0.49`, `npm test` reached `scripts/validate-shared-hash-provenance.js` and failed at line 52:

```text
AssertionError [ERR_ASSERTION]: lev0 release source must use the exact authorized successor version
actual: '0.0.49'
expected: '0.0.48'
```

Directly observed facts:

- The supported bump ran exactly once.
- Its worktree diff is exactly `package.json`, `package-lock.json`, and `index.html`, with four intended `0.0.48` → `0.0.49` replacements.
- `scripts/validate-shared-hash-provenance.js:52` contains the literal assertion `assert.equal(packageJson.version, "0.0.48", ...)`.
- Earlier unit gates passed through immutable history/mutation, release-target, environment/gameplay sync/provenance, environment inventory, and Vite allowlist.
- The full browser job was stopped fail-closed after the deterministic unit failure.
- Raw `release/raw/0.0.49` remains absent; no build/profile/evidence/serving/publication action occurred.

## Expected Behavior

The approved source-staging sequence requires committed source version `0.0.49` before final fingerprint-bound hardware evidence and source audit, while raw `0.0.49` remains absent. The provenance validator must accept the newly authorized successor source version and continue verifying shared-hash dependency provenance. Historical immutable raw `0.0.48` assertions must remain unchanged.

## Execution Path

1. `npm run version:patch` invokes the supported bump script.
2. The script updates root package version, the two root lockfile version fields, and the sole HTML release-proof marker to `0.0.49`.
3. `npm test` runs `npm run check && npm run test:unit`.
4. `test:unit` reaches `node scripts/validate-shared-hash-provenance.js` after earlier source and immutable gates pass.
5. The validator parses the now-authoritative root `package.json`.
6. Line 52 compares `packageJson.version` to the stale literal `0.0.48`.
7. Node throws before the validator can complete its shared-hash provenance and fingerprint checks.

## Most Likely Root Cause

The version-ordering diagnosis correctly identified the three files mutated by the bump script, but the `3ngx` acceptance scope incorrectly assumed those were the only source-version authorities needing alignment. `validate-shared-hash-provenance.js:52` is a fourth tracked source oracle that intentionally hard-codes the authorized successor version. It was not included in the predicted bump diff or acceptance criteria, so the planned `0.0.49` authority deterministically conflicts with the old test oracle.

Evidence:

- The literal at line 52 directly explains actual `0.0.49` versus expected `0.0.48`.
- Repository-wide `0.0.48` search finds this as the only current source-version equality assertion outside historical immutable snapshot/mutation records, historical evidence filenames, and immutable `0.0.48` documentation.
- The new fingerprint `510faed6a6a1c221c7c53d49191a94e082ebc2722ca07d4bd3e54ecb5d8d3a65` over 214 inputs matches the prior diagnosis prediction, showing the bump itself behaved as expected.

## Alternative Hypotheses

1. **The bump script changed the wrong files or wrong version.** Very unlikely: exact diff and four expected replacements were independently read back.
2. **The test should continue requiring `0.0.48` because source staging is forbidden.** Contradicted by the approved cycle-free sequence and `3ngx`, which explicitly require source `0.0.49` before hardware profiling/build.
3. **The validator should derive the expected version dynamically from `package.json`.** Possible design alternative, but it would make this particular authorization assertion tautological and weaken its purpose. A literal authorized successor update is the minimal contract-preserving repair.
4. **Other stale `0.0.48` assertions will fail next.** Repository-wide search does not reveal another live source-version equality oracle. Historical raw snapshot, mutation, evidence filename, and immutable release docs correctly retain `0.0.48`.

## Why Previous Fixes Failed

No repair was attempted after this failure. The prior version-ordering diagnosis simulated only the bump script’s direct three-file mutation and predicted the resulting fingerprint. That correctly solved the sequencing cycle but omitted an indirect consumer: the provenance test’s explicit authorized-version literal. The three-file-only acceptance assumption therefore treated the bump output as the entire authority surface rather than tracing all validators that consume the changed version.

## Unknowns

- Whether another non-literal or constructed `0.0.48` expectation exists outside the searched JS/MJS/JSON/HTML/Markdown surface. A complete post-repair `npm test` and managed browser suite resolve this.
- The exact post-repair fingerprint. `scripts/validate-shared-hash-provenance.js` is a release-fingerprint input, so changing its literal will intentionally produce a new fingerprint while retaining 214 inputs.

## Minimal Reproduction

1. Start at pushed source authority `99da0faa2e0f921fca52b812524e3c31c223e8e8` with package version `0.0.48` and absent raw `0.0.49`.
2. Run supported `npm run version:patch` once.
3. Run `node scripts/validate-shared-hash-provenance.js`.
4. Observe line 52 reject actual `0.0.49` against stale expected `0.0.48`.

The failure does not occur before the bump because both values are then `0.0.48`.

## Proposed Verification

Before landing, change only the line-52 authorized source version from `0.0.48` to `0.0.49`, then:

1. Run the validator directly and confirm it completes shared-hash provenance and prints a valid new fingerprint over 214 inputs.
2. Search live validator/source files for stale successor-version equality checks, separating legitimate immutable-history references.
3. Run full `npm test` and the complete managed sequential browser suite to distinguish this single stale oracle from additional consumers.
4. Re-audit the final intended commit as exactly four files: the three supported bump outputs plus this one test-authority repair.
5. Verify raw `0.0.49` remains absent and no build/profile/evidence/serving action occurred.

## Recommended Fix

Update only `scripts/validate-shared-hash-provenance.js:52` from authorized source version `0.0.48` to `0.0.49`. Expand `3ngx` and `v49q` acceptance from an exact three-file commit to the exact four-file source-stage commit, with the fourth file restricted to this single semantic literal change. Do not alter any historical immutable raw `0.0.48` record or documentation. Recompute the fingerprint and rerun all required gates before commit/push.

This fixes the underlying contract mismatch while preserving an explicit authorized-version check; deleting or dynamically self-comparing the assertion would merely suppress the guard.

## Debugging Record

```text
Problem: Source-only 0.0.49 staging conflicts with a stale explicit authorized-version provenance oracle.
Observed symptom: validate-shared-hash-provenance.js:52 rejects actual 0.0.49 against expected 0.0.48 during npm test.
Root cause: The three-file bump scope omitted a tracked validator that independently hard-codes the authorized successor source version.
Evidence: Exact line-52 literal; exact supported bump diff; prior gates pass; repository-wide 0.0.48 search; predicted 510faed6.../214 fingerprint confirmed.
Failed approaches: The earlier ordering diagnosis traced direct bump outputs but not all source-version consumers; no post-failure fix attempted.
Corrective action: Change only the validator's authorized source literal to 0.0.49 and expand staging/QA scope to exactly four files.
Verification test: Direct provenance validator, stale-source search, full npm test, managed full browser exit 0, exact four-file diff, fingerprint/count, absent raw 0.0.49.
Related files/components: package.json, package-lock.json, index.html, scripts/validate-shared-hash-provenance.js, 3ngx, v49q.
Remaining uncertainty: Exact post-repair fingerprint and whether a non-literal downstream oracle exists; full gates resolve both.
```
