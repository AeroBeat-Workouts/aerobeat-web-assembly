# Raw 0.0.42 immutable builder failure

**Date:** 2026-09-07  
**Bead:** `aerobeat-web-assembly-1uze`  
**Authorized source:** `94031242cb9cc2d67860f8b6b14d83fe8d4e7194`  
**Disposition:** FAIL CLOSED; claimed target preserved; no rerun, deletion, serving, tag, publication, or physical claim

## Exact observed failure

The authorized `npm run version:patch` invocation completed once and advanced the four version authorities from `0.0.41` to `0.0.42`. The authorized canonical command `AEROBEAT_BASE_PATH=/ npm run build-release` was then invoked exactly once. Vite completed its release transform and wrote the claimed target, but the command exited `1` before writing `aerobeat-release-proof.json`:

```text
Error: Production conversion module Worker omitted exact @aerobeat/web-hash source ownership
    at validateProductionHashBundle (.../scripts/production-hash-bundle-policy.js:37:85)
    at .../scripts/build-release.js:40:28
```

Directly observed target state after the failed command:

- `release/raw/0.0.42` exists and is intentionally preserved.
- `38` regular files / `28,197,018` bytes.
- `aerobeat-release-proof.json` is absent.
- No Git raw tree exists because the incomplete target was not staged or committed.
- Path-order aggregate: `4f5d94e0fc1bdc6af6489cc233462e336909e35948732223f9c14e17caf1ff66`.
- Globally line-sorted complete-manifest aggregate: `0c8c44c705293923daa0b2ae6c18c381e8bbb4661e5add7b8668c6c1aa1cc687`.
- Categories: JavaScript `3 / 4,405,181 B`; source maps `2 / 7,367,202 B`; environments `24 / 16,013,893 B`; gameplay GLBs `7 / 408,912 B`; CSS `1 / 1,303 B`; HTML `1 / 527 B`; proof `0 / 0 B`.

## Expected behavior

The build must claim one absent append-only target, emit the complete raw release, verify that both the main entry and conversion Worker source maps attribute the shared hash implementation, and write a proof binding version `0.0.42`, base `/`, the exact dependency provenance, and source fingerprint. The command must exit `0` before the target can be treated as a valid immutable release.

## Execution path

1. `scripts/build-release.js` read package version `0.0.42`.
2. `claimAppendOnlyReleaseTarget()` atomically created `release/raw/0.0.42`.
3. `computeReleaseFingerprint()` bound exact clean dependency provenance and returned `2a11ca50cdf140ec045be41838f992b9726c06434df41a02d487cf5969f7891b` over `207` inputs.
4. Vite transformed `1,319` modules and emitted three JavaScript files plus two source maps and static assets.
5. `validateProductionHashBundle()` collected emitted JavaScript and maps.
6. The conversion Worker map existed as `assets/conversion-worker-C-m--G1i.js.map` and its first source was exact `../../../aerobeat-web-hash/src/index.js` with complete `sourcesContent`.
7. The filename recognizer at `scripts/production-hash-bundle-policy.js:35` used `conversion-worker(?:-[\w]+)?\.js`; the generated hash `C-m--G1i` contains hyphens, which `\w` does not match.
8. `conversionWorkerFile` was therefore undefined and line 37 threw before proof generation.

## Most likely root cause

The production hash policy's conversion-Worker filename grammar is narrower than Vite's valid generated hash alphabet. It accepts an alphanumeric/underscore suffix but rejects a hyphen-bearing suffix. This is proven by the emitted filename, the policy regex, and the map's exact shared-hash source attribution. The failure is a policy filename-recognition defect, not missing hash ownership in the Worker.

## Alternative hypotheses

1. **Actual Worker omission of shared hash source — contradicted.** The emitted Worker map lists `aerobeat-web-hash/src/index.js` first with complete source content.
2. **Incomplete or mismatched source map — contradicted.** The map parses, has matching `sources` and `sourcesContent`, and contains the exact shared module path expected by line 29.
3. **Dependency provenance drift — contradicted.** Prebuild provenance passed for all seven exact commit/tree authorities immediately before the build.
4. **Inputs changed during Vite — contradicted.** The in-command second fingerprint check passed and execution advanced to bundle-policy validation.

## Why previous checks did not catch it

No release retry or code fix was attempted. The preflight normal `npm run build` emitted `conversion-worker-DCPZmJ68.js`, whose suffix matches `\w+`, so the same policy passed. The release-mode build emitted `conversion-worker-C-m--G1i.js`, exposing the untested valid hyphen case. The policy self-test does not exercise release-mode generated filename alphabets.

## Unknowns

- Whether Vite documents a stable complete hash-character alphabet that should be encoded directly, or whether the policy should avoid parsing the suffix entirely and bind the Worker through source-map identity.
- Whether other emitted chunk recognizers use similarly narrow `\w+` suffix assumptions.

A source audit of generated-name recognizers and a focused fixture containing a hyphenated conversion-Worker filename would resolve these unknowns.

## Minimal reproduction

From exact source `94031242cb9cc2d67860f8b6b14d83fe8d4e7194`, update the assertion for `1uze`/`0.0.42`, advance the version once, and run the release-mode build. The generated conversion Worker suffix `C-m--G1i` fails line 35 even though its map owns the shared hash source. Ordinary production build emitted `DCPZmJ68` and passed, demonstrating the filename-dependent boundary.

The canonical command must not be rerun against the now-existing target, and the target must not be deleted or edited.

## Proposed verification

Before any future authorized successor build, add a focused policy fixture with:

- a main entry map owning the shared hash source;
- `conversion-worker-C-m--G1i.js` plus its complete map owning the same source;
- negative rows for absent Worker, missing shared attribution, incomplete map, and ambiguous/non-Worker filenames.

The current policy must fail the positive hyphenated row; the corrected policy must pass it while every negative row remains fail-closed. Then run normal build, release policy, provenance, and a disposable release-mode build against an absent noncanonical target.

## Recommended fix

Do not alter this claimed `0.0.42` target. In a separately authorized source-repair lane, replace the suffix-specific `\w+` recognizer with a strict basename rule that accepts Vite's complete emitted hash alphabet or, preferably, identifies exactly one conversion Worker from its source-map source identity and constrained `conversion-worker-*.js` basename. Add the positive/negative fixture above. Because `0.0.42` is already claimed and incomplete, any valid immutable candidate requires explicit successor authorization rather than a rerun or deletion.

## Debugging record

```text
Problem: Canonical immutable raw 0.0.42 build claimed its target but failed before proof generation.
Observed symptom: validateProductionHashBundle threw "Production conversion module Worker omitted exact @aerobeat/web-hash source ownership"; target has 38 files and no proof.
Root cause: conversion Worker filename regex uses [\w]+ and rejects valid generated suffix C-m--G1i containing hyphens.
Evidence: emitted map exists, is complete, and lists exact aerobeat-web-hash/src/index.js; normal build's alphanumeric DCPZmJ68 suffix passed the same policy.
Failed approaches: None; no retry, deletion, output edit, or speculative code fix was attempted.
Corrective action: Preserve failed target; repair filename/source-map identity policy only in a separately authorized source lane; use an explicitly authorized successor version.
Verification test: Hyphenated positive Worker-map fixture plus absent/missing/incomplete/ambiguous negative fixtures; disposable release-mode build only.
Related files/components: scripts/production-hash-bundle-policy.js; scripts/build-release.js; release/raw/0.0.42/assets/conversion-worker-C-m--G1i.js.map.
Remaining uncertainty: Complete future Vite hash alphabet and whether other generated-name recognizers share this defect.
```

## Policy repair coder result — PASS / independent QA pending

**Repair Bead:** `aerobeat-web-assembly-xrww`
**QA Bead:** `aerobeat-web-assembly-6qqf`
**Disposition:** Source policy and focused adversarial coverage repaired; raw `0.0.42` remains incomplete and immutable; no successor release is authorized by this result

The generated-name audit found the same `\w+` limitation in both the conversion Worker recognizer and the main-entry fallback. Both now use the narrow Vite/Rollup base64url-style hash alphabet `[A-Za-z0-9_-]+`; no arbitrary basename widening was introduced. The policy requires exactly one main source-map identity and exactly one conversion Worker source-map identity, requires each identity to attribute the exact shared hash module with complete `sourcesContent`, and rejects unsafe absolute, traversal, empty-segment, backslash, and colon-bearing JavaScript output paths.

Focused fixtures now prove positive `assets/index-C-m--G1i.js` plus `assets/conversion-worker-C-m--G1i.js` ownership and fail closed for an absent Worker, incomplete Worker map, missing shared attribution, ambiguous Workers, ambiguous fallback mains, path injection, and a malformed dotted hash. The fixture matrix runs before the actual Vite production bundle check in `scripts/validate-production-hash-bundle.js`.

Coder validation passed:

- `node scripts/validate-production-hash-bundle.js`
- `npm test`
- `npm run build`
- `npm run test:release-pack-policy`
- focused `git diff --check`

No `version:patch` or `build-release` command was run. No byte under `release/raw/0.0.42` was edited. Post-validation evidence remains exactly `38` regular files / `28,197,018` bytes, path-order aggregate `4f5d94e0fc1bdc6af6489cc233462e336909e35948732223f9c14e17caf1ff66`, and globally line-sorted complete-manifest aggregate `0c8c44c705293923daa0b2ae6c18c381e8bbb4661e5add7b8668c6c1aa1cc687`, with no proof file. Version, release assertion, Beads dirt, and the ignored raw target remain excluded from the source-policy commit. `xrww` remains open for independent QA through `6qqf`.

## Final bounded auditor result — PASS / one raw 0.0.43 build authorized

**Audit Bead:** `aerobeat-web-assembly-xz9r`

**Audited repair:** `1eb25bd061c4353be58cc615ecffbe2b93a54b71` / tree `9087e1f9ab159bd8757ea6ffaf4e3452aca41091`

**Closed QA evidence:** `aerobeat-web-assembly-6qqf`, PASS comment `01a07d6f-96b1-76e1-aa06-8168d19b97f0`

The final audit inspected the complete policy and focused validator rather than relying only on QA output. The repair narrowly changes both generated-name recognizers from `\w+` to the Vite/Rollup base64url-style hash alphabet `[A-Za-z0-9_-]+`, requires exactly one main and one conversion-Worker JavaScript/source-map identity, requires complete exact shared-hash source attribution for both, and rejects absolute, traversal, empty-segment, backslash, and colon-bearing JavaScript paths. Release scanning remains supported through chunk-form JavaScript plus asset-form source maps; the normal Vite validator exercises the in-memory bundle representation.

Independent audit validation passed:

- `node scripts/validate-production-hash-bundle.js`: `3` scripts / `2` deduplicated maps with exact main and conversion-Worker ownership.
- Independent read-only policy matrix: `2` positives, including hyphenated chunk and asset-map representations, plus `14` fail-closed adversaries spanning missing/incomplete/unattributed maps, absent/duplicate identities, unsafe paths, and malformed/empty hashes.
- `npm run test:release-pack-policy`: release-target append-only policy and release-pack self-test PASS.
- `node scripts/validate-immutable-raw-snapshot.js`: all `17` committed raws through `0.0.41` remain exact; newest locked trees remain `0.0.35` `bd69d3bd309660125d1a5ac3da6d07896c49bb96`, `0.0.36` `ce125ba4a596f7d6cad84c9e3bf983c5ccf0ed77`, `0.0.37` `6d2b8c4e39d3677f28e48ad076bc6259abcd47b9`, `0.0.38` `9c4225c83b8697a6404190bddcbfcbee0a5d60f3`, `0.0.39` `799c9b346f1e1bffc96bf8e0cd01d8edd5e33928`, `0.0.40` `7e73b56e512ff877f17dc44a0bc8a19fd2104987`, and `0.0.41` `0b5f7841ef65779d84f028a544724a6d76cd06a1`.
- Repair diff hygiene passed and contains no raw path. `HEAD == origin/main` matched the audited repair before documentation-only audit recording.

The incomplete ignored raw `0.0.42` was independently recomputed as exactly `38` files / `28,197,018` bytes, path-order aggregate `4f5d94e0fc1bdc6af6489cc233462e336909e35948732223f9c14e17caf1ff66`, globally line-sorted complete-manifest aggregate `0c8c44c705293923daa0b2ae6c18c381e8bbb4661e5add7b8668c6c1aa1cc687`, and no proof. Categories remain JavaScript `3 / 4,405,181 B`; source maps `2 / 7,367,202 B`; environments `24 / 16,013,893 B`; gameplay GLBs `7 / 408,912 B`; CSS `1 / 1,303 B`; HTML `1 / 527 B`; proof `0 / 0 B`. Intentional package/lock/HTML `0.0.42`, `1uze` assertion, Beads interactions, and ignored raw dirt were preserved and excluded from the audit commit.

**Disposition:** PASS. Raw `0.0.42` is permanently failed, incomplete, and unservable; it must never be rebuilt, completed, deleted, edited, tagged, published, or served. Exactly one canonical append-only raw `0.0.43` build is authorized from the exact pushed documentation-only audit commit recorded in the `xz9r` closure comment and final handoff. No other source identity or repeated build is authorized. This audit itself performed no version, build-release, tag, publish, serve, or physical-approval action.
