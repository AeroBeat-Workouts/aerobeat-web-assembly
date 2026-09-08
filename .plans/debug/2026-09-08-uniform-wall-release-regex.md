# Uniform-wall release regex oracle debug

## Exact Observed Failure

`node scripts/validate-environment-assembly.js` fails at line 57:

> `AssertionError: The input did not match the regular expression /gameplayAssetReleaseVersion="0\.0\.9"/u`

The linked renderer source truthfully exports `0.0.10`.

## Expected Behavior

Assembly must pin renderer release `0.0.10`, final asset provenance, Git raw tree, inventory, proof, and exact 17 packaged files.

## Execution Path

The integration synced renderer `0.0.10`, then environment validation read `src/gameplay-assets.js` from the linked renderer and applied a literal regex containing escaped `0\.0\.9`.

## Most Likely Root Cause

A plain-text `0.0.9` replacement updated paths and messages but not the regex source spelling `0\.0\.9`. The remaining assertion is a stale independent oracle, not runtime divergence.

## Alternative Hypotheses

- Linked renderer stale: contradicted by sync verification and failure input showing `0.0.10` with exact new hashes.
- Wrong renderer commit: contradicted by preceding exact commit/tree assertions passing.

## Why Previous Fixes Failed

The edit matched unescaped version text only; regex source contains backslashes.

## Unknowns

Later fail-fast assembly gates remain unexecuted.

## Minimal Reproduction

Run `node scripts/validate-environment-assembly.js` after syncing `0.0.10`.

## Proposed Verification

Update only the escaped regex to `0\.0\.10`, rerun targeted validation and full assembly suite.

## Recommended Fix

Align the stale exact release regex; retain all strict provenance assertions.

## Debugging Record

```text
Problem: Assembly exact-version regex remains at predecessor.
Observed symptom: 0.0.10 linked source fails 0.0.9 regex.
Root cause: Plain replacement did not match escaped regex spelling.
Evidence: Renderer commit/tree and sync passed; assertion input exports exact 0.0.10 pins.
Failed approaches: Replacing unescaped 0.0.9 occurrences only.
Corrective action: Change escaped regex to 0\.0\.10.
Verification test: Environment validation and full assembly suite.
Related files/components: scripts/validate-environment-assembly.js.
Remaining uncertainty: Later fail-fast gates.
```
