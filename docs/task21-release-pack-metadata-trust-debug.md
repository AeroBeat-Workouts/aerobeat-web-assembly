# Release pack metadata trust-boundary diagnosis

## Exact Observed Failure

Independent QA against verifier source `127addc5` built a canonical one-file gzip/USTAR archive containing exact tracked `.github/workflows/.gitkeep` bytes and mode, then supplied matching caller-authored npm-shaped metadata with recomputed size, SHA-1, SHA-512, entry count, and file inventory. Verification exited `0`.

Accepted evidence identity: archive SHA-256 `8debd173f6c930314d50a0b9ae77c468aa1b9e0d98a001abfd80cb257d1b76c1`, tar SHA-256 `91df8af939209c5b14471a1d7551fa46a9c8b4015861a9a45500e0de4724d5d0`, manifest SHA-256 `2663b06efba09b489c76d70851249acfa0098536d15675d0fad44916bdd9ba9b`, one `0644` member.

## Expected Behavior

Verification must bind the archive to the exact package npm `10.9.8` independently derives from the clean normalized detached target. A caller must not be able to redefine the package inventory by jointly authoring an archive and matching metadata.

## Execution Path

1. `verifyArchive()` validates the detached target and reads the caller-supplied `--metadata` JSON.
2. `readTrustedMetadata()` checks schema, package identity, listed tracked paths, sizes, modes, and archive hashes.
3. It does not independently derive which tracked paths npm-packlist selects.
4. `verifyCanonicalTar()` treats `metadata.files` as the complete expected inventory.
5. A subset archive and subset metadata therefore agree at every later gzip, USTAR, content, order, and hash check.

## Most Likely Root Cause

The metadata is labeled trusted but crosses the same caller-controlled boundary as the archive. Its hashes establish circular self-consistency, not provenance. Complete canonical encoding cannot prove package completeness when the expected inventory comes only from the object being verified.

## Alternative Hypotheses

- **USTAR or gzip parser bypass:** disproven; the accepted subset is canonical and passes the intended grammar.
- **Untracked or mismatched source bytes:** disproven; the member is an exact tracked candidate file.
- **Ordering bug:** not required; one member is trivially sorted.
- **Hash weakness:** disproven; the hashes are correct but bind only caller-authored inputs.

## Why Previous Fixes Failed

Mode normalization fixed host metadata drift. Structural and complete-header repairs fixed malformed representation handling. The latest repair added strict metadata schema and archive hashes, but assumed a matching `npm pack --json` file was independently trustworthy without deriving or authenticating it. That moved completeness authority into an unauthenticated parameter.

## Unknowns

None for the approved pinned toolchain. Future npm versions must establish a new reviewed policy rather than silently widening the accepted contract.

## Minimal Reproduction

Create one canonical regular-file member from any tracked candidate path, construct canonical gzip/USTAR bytes, compute matching npm-shaped metadata, and call `verify --archive subset.tgz --metadata subset.json`. Source `127addc5` exits `0` although npm's real package contains 97 members.

## Proposed Verification

Run pinned `npm pack --dry-run --json --ignore-scripts` internally from the already-normalized detached target under a sanitized environment and external temporary destination. Use that internally derived record—not caller metadata—as the only inventory/hash authority. Then replay the one-file pair, empty/subset/extra/reordered pairs, and jointly mutated archive+metadata pairs; all must fail. Two fresh exact-`55f4088` worktrees must still derive and verify the authoritative 97-member identity.

## Recommended Fix

Remove caller-supplied metadata authority. The verifier should itself invoke exact pinned npm `10.9.8` through a pinned executable/toolchain check, with lifecycle scripts disabled, deterministic locale/environment, isolated cache/temp/output paths outside the target, and exact JSON parsing. Bind the candidate archive to that independently derived dry-pack record before canonical gzip/USTAR verification. If retained for diagnostics, external metadata may only be compared byte-for-byte with the derived record; it must never define membership or hashes.

Also assert the derived record has the exact supported schema and package identity, and keep all complete-header, gzip, target, mode, and CLI protections. This fixes provenance rather than adding another self-consistency check.

## Debugging Record

```text
Problem: Caller can redefine complete npm package inventory.
Observed symptom: Canonical one-file subset plus matching self-authored metadata verifies.
Root cause: Caller metadata is the sole inventory/hash authority; no independent npm derivation or immutable anchor exists.
Evidence: One exact tracked member with recomputed canonical metadata exits 0 at source 127addc5.
Failed approaches: Complete header and hash validation assumed unauthenticated matching metadata was trusted.
Corrective action: Internally derive the authoritative dry-pack record from normalized target with pinned npm and sanitized execution; remove caller authority.
Verification test: Reject self-authored subset/extra/reorder pairs and reproduce the 97-member authoritative identity in two fresh worktrees.
Related files/components: scripts/release-pack-policy.js; scripts/validate-release-pack-policy.js; README.md; nji/qmc/cf1/1wu/nme.
Remaining uncertainty: None for pinned Node 22.22.3/npm 10.9.8.
```
