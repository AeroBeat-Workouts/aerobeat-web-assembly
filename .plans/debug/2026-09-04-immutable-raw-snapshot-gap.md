# Debugging record — immutable raw snapshot gap

## Exact Observed Failure

Independent final auditor recorded FAIL on Bead `aerobeat-web-assembly-0hu`: `scripts/validate-immutable-raw-snapshot.js` freezes baseline commit `e37cc9fd28e7d061190829f7f0966cb8295d5826`, asserts exactly 12 raw releases, and asserts `0.0.36` is last. Raw `0.0.37` and `0.0.38` exist at HEAD but are outside that baseline traversal, so the normal immutable gate cannot detect future mutation of either directory.

Directly observed current identities:

- `0.0.35`: tree `bd69d3bd309660125d1a5ac3da6d07896c49bb96`, 20 files, 13,878,153 bytes, proof SHA-256 `22c41e8bf0630bb6b50523a96ab0e886b399a93c74a7d1e97bb2afe47a43c4ea`.
- `0.0.36`: tree `ce125ba4a596f7d6cad84c9e3bf983c5ccf0ed77`, 41 files, 27,760,611 bytes, proof SHA-256 `3d18dd99afe99fcac389bccee760073baf83cc44c66cdec6d0ac5d933d142daf`.
- `0.0.37`: tree `6d2b8c4e39d3677f28e48ad076bc6259abcd47b9`, 41 files, 27,820,403 bytes, proof SHA-256 `9415f1ee7f9ddc687b4756be84e5a2bec9dfa9521eb5ec8f6c6ddc5b9ee286f9`.
- `0.0.38`: tree `9c4225c83b8697a6404190bddcbfcbee0a5d60f3`, 41 files, 27,834,715 bytes, proof SHA-256 `86f08597e4c17d0191d1ba7fb70225c8188c21c0cbc7ffa21b32cb2cef2b6041`.

## Expected Behavior

The append-only immutable snapshot authority must compare every predecessor through raw `0.0.38` against a committed public ancestor, compare HEAD trees and complete working-tree inventories/bytes, and assert exact current identities for the newest protected releases. Mutation of `0.0.37` or `0.0.38` must fail the normal unit gate.

## Execution Path

`npm test` → `test:unit` → `node scripts/validate-immutable-raw-snapshot.js` → resolve fixed `BASELINE` → enumerate only `${BASELINE}:release/raw` → compare each enumerated baseline tree/file to HEAD and working bytes → assert inventory length and final version. Because baseline `e37cc9f` predates `0.0.37` and `0.0.38`, those directories never enter the loop.

## Most Likely Root Cause

The immutable validator's fixed baseline and endpoint assertions were not advanced append-only after raw `0.0.37` and `0.0.38` landed. Evidence: `git log -- release/raw/0.0.37 release/raw/0.0.38` identifies introduction commits `238743bdbfb015ac6f4fa304865af121d94b2eaa` and `f54d5ff94e831a6ac23fc05b489e1137aadffcdd`; the latter is an ancestor of HEAD, contains 14 raw versions, ends at `0.0.38`, and has the exact present trees for `0.0.35–0.0.38`.

## Alternative Hypotheses

1. **Current raw bytes already mutated** — contradicted by clean Git state, HEAD/upstream equality, and exact tree/proof identities matching release documentation.
2. **Another normal gate already protects `0.0.37/0.0.38` equivalently** — no evidence. Release-target policy protects safe rejection behavior, but the auditor specifically confirmed the normal historical baseline gate omits these releases.
3. **The raw directories are intentionally mutable because release QA is pending** — contradicted by the plan and README, which designate raw versions append-only evidence regardless of physical approval.

## Why Previous Fixes Failed

No repair had been attempted. Prior coder/QA work concentrated on Flow obstacle functionality and treated the existing immutable-snapshot test PASS as sufficient without checking that its frozen baseline endpoint advanced with the two newer raw releases. This was a coverage omission, not a failed implementation patch.

## Unknowns

No material root-cause unknown remains. The repair must still prove a mutation of each newly covered release fails without changing immutable bytes.

## Minimal Reproduction

1. Read `scripts/validate-immutable-raw-snapshot.js` at HEAD.
2. Observe `BASELINE=e37cc9f…`, expected count `12`, and endpoint `0.0.36`.
3. Observe `release/raw/0.0.37` and `release/raw/0.0.38` at HEAD.
4. The validator passes while never traversing either directory.

The gap does not occur for versions through `0.0.36`, which are present in the old baseline.

## Proposed Verification

Advance the baseline to the immutable raw `0.0.38` introduction commit `f54d5ff94e831a6ac23fc05b489e1137aadffcdd`, assert 14 releases and endpoint `0.0.38`, and pin exact metadata for `0.0.35–0.0.38`. Run the validator. Then in disposable temporary worktrees, mutate one tracked byte under `0.0.37` and one under `0.0.38`; each invocation must exit nonzero due to byte mismatch. Confirm canonical raw files and trees remain unchanged.

## Recommended Fix

Make the smallest append-only validator update: use `f54d5ff94e831a6ac23fc05b489e1137aadffcdd` as the fixed public baseline, update inventory count/endpoint, and extend exact trailing identity assertions through `0.0.38`. Add a deterministic regression script or test path that creates disposable mutation probes for both releases without touching canonical bytes. Run the scoped validator, mutation regression, full unit gate, `git diff --check`, and clean/upstream checks. Do not rebuild, delete, or rewrite any raw release.

## Debugging Record

```text
Problem: Assembly immutable snapshot gate omits raw 0.0.37 and 0.0.38.
Observed symptom: Validator baseline has 12 versions ending at 0.0.36 while HEAD has 14 ending at 0.0.38.
Root cause: Fixed baseline/count/endpoint assertions were not advanced after the two append-only releases landed.
Evidence: f54d5ff is an ancestor of HEAD and contains exact raw trees through 0.0.38; current validator enumerates only e37cc9f.
Failed approaches: None; prior Flow validation trusted a passing but stale-coverage gate.
Corrective action: Advance baseline and exact identity assertions; add disposable mutation rejection probes for 0.0.37 and 0.0.38.
Verification test: Canonical gate passes; independent one-byte mutations in each new release fail; canonical trees remain exact.
Related files/components: scripts/validate-immutable-raw-snapshot.js, package.json test:unit, release/raw/0.0.35–0.0.38, Beads ura/0hu.
Remaining uncertainty: None material; mutation regression implementation details remain to be chosen by coder.
```
