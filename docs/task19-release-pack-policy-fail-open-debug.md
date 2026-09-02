# Release pack policy fail-open diagnosis

## Exact Observed Failure

Independent QA demonstrated four accepted inputs that must fail closed:

1. A decompressed tar truncated exactly before its end-of-archive zero blocks verifies successfully.
2. A mode-`0755` directory named `../escape/` verifies successfully.
3. A duplicate file member appended after two zero blocks is silently ignored.
4. The CLI accepts and ignores an unknown accessor-like option such as `--__proto__ x`.

Direct source inspection at baseline `3f604c1` confirms each path. `parseTar()` stops at the first zero block and returns without requiring a second zero block or inspecting the remainder. `verifyArchive()` constrains paths only in the file branch, after directory/PAX/type handling. `parseArguments()` stores arbitrary option names in a `Map`, overwrites duplicates, and command dispatch reads only known keys.

A fresh local positive npm fixture under the recorded npm toolchain produced a `3,072`-byte decompressed tar, exact `512`-byte framing, and exactly two terminal zero blocks with no bytes after them. This establishes the narrow canonical npm shape used by the repair; broader custom-tar padding is unnecessary.

## Expected Behavior

The release verifier must accept the canonical npm tar emitted for an exact normalized detached target and reject malformed or ambiguous structures:

- exact 512-byte framing and enough bytes for a two-block end marker;
- exactly two consecutive terminal 512-byte zero blocks;
- no member, nonzero byte, or extra trailing block after that marker;
- safe canonical `package/` paths for every member before type/mode decisions;
- exact directory mode `0755`, exact tracked-file mode/content checks, and existing checksum/PAX/unsupported/duplicate protections;
- command-specific, exact CLI option schemas with required options and no unknown, duplicate, attached, missing, odd, or positional arguments.

## Execution Path

1. `verifyArchive()` reads and gunzips the archive.
2. `parseTar()` iterates 512-byte headers.
3. At the first all-zero header, baseline code executes `break`; it does not require another block and does not inspect later bytes.
4. Parsed members reach `verifyArchive()`.
5. Baseline code checks `member.type` first. A directory with mode `0755` immediately `continue`s, so its path never reaches the file-only `package/` check.
6. CLI execution calls `parseArguments()`, whose unconstrained `Map` accepts any `--name value`; dispatch ignores keys it does not read.

## Most Likely Root Cause

The verifier treated tar parsing as best-effort member extraction rather than validation of one canonical npm archive grammar. Termination, path safety, and CLI grammar were distributed as permissive conveniences:

- zero block meant “stop” instead of “validate the complete terminator and EOF”;
- path safety was coupled to tracked-file verification instead of being a precondition for every tar member;
- option parsing collected data without validating the selected command’s schema.

This causal chain explains all four QA reproductions without requiring a gzip, npm, mode-normalization, or candidate-byte defect.

## Alternative Hypotheses

1. **Gzip truncation handling is permissive.** Possible for damaged compressed streams, but contradicted by QA’s valid gzip wrapper around a deliberately shortened decompressed tar. `gunzipSync()` succeeds and the tar parser then fails open.
2. **Only directory handling is defective.** Contradicted by appended-after-terminator and unknown-option reproductions, which do not use directory verification.
3. **JavaScript prototype pollution changes dispatch.** The `Map` avoids object-prototype mutation, but this does not make the option valid. The observed defect is ignored unknown input, not mutation.
4. **npm emits arbitrary trailing record padding that requires permissive parsing.** A fresh npm fixture emitted exactly two terminal zero blocks and no additional blocks; the authoritative normalized candidate is also expected to retain its existing decompressed-tar identity under structural verification only.

## Why Previous Fixes Failed

The prior pack-mode repair correctly solved host-dependent source modes and added checksum, exact bytes/modes, PAX, unsupported-type, and duplicate-before-end checks. Its self-test exercised those repaired invariants but did not mutate archive termination, append data after the terminator, stage unsafe non-file paths, or invoke malformed CLI shapes. The implementation therefore validated members that it chose to parse, not the complete tar/CLI input.

## Unknowns

The required normalized `55f4088` reproduction resolved the only material unknown: its authoritative tar also ends in exactly two zero blocks, and the strict verifier preserves the existing JSON/tgz/tar/manifest identities. No evidence requires accepting extra all-zero record padding. If a future npm toolchain emits it, that toolchain must first receive explicit evidence and policy review rather than silently broadening this verifier.

## Minimal Reproduction

- Remove the terminal zero blocks from a valid npm tar, re-gzip it, and call `verifyArchive()`.
- Build a valid-checksum directory header for `../escape/`, mode `0755`, followed by two zero blocks, then verify it.
- Insert a valid duplicate file header/content after the first two zero blocks of an otherwise valid tar.
- Invoke `node scripts/release-pack-policy.js assert --target TARGET --commit COMMIT --__proto__ x`.

The canonical unmodified npm archive does not reproduce the failure and must remain accepted.

## Proposed Verification

Add adversarial self-tests that begin from one positive canonical npm archive and independently mutate:

- absent, one-block, non-block-framed, and overlong terminators;
- nonzero bytes and valid members after the terminator;
- unsafe path forms across file, directory, PAX, and unsupported types, plus malformed name/prefix fields;
- unknown/prototype-ish, duplicate, missing, extra, odd, attached, and malformed command options.

Also retain focused mutations for checksum, member truncation/padding, duplicate-before-end, PAX, unsupported types, wrong modes, and exact-content mismatch. Finally reproduce one exact normalized candidate pack and require the existing JSON/tgz/tar/manifest hashes.

## Recommended Fix

1. Make `parseTar()` validate exact block framing, member content padding bounds, two terminal zero blocks, and exact EOF after the canonical marker.
2. Decode and validate canonical tar name/prefix fields, then run one safe npm `package/` path validator for every parsed member before branching on type or mode.
3. Replace generic option collection with a command-schema parser that rejects every token not belonging to the selected documented grammar and rejects duplicate/unknown/malformed options before filesystem work.
4. Expand the existing self-test around a real positive npm tar and bounded adversarial mutations; do not add general-purpose tar compatibility.

## Debugging Record

```text
Problem: Release archive verifier accepts malformed tar and CLI inputs.
Observed symptom: Missing terminators, unsafe directories, post-terminator members, and --__proto__ are accepted/ignored.
Root cause: Best-effort member extraction and unconstrained option collection do not validate complete canonical input grammars.
Evidence: parseTar breaks on first zero; file-only path check follows directory continue; parseArguments accepts arbitrary Map keys and overwrites duplicates.
Failed approaches: Prior tests covered normalized modes/member equality/PAX but not termination, all-type paths, trailing streams, or strict CLI schemas.
Corrective action: Validate exact canonical tar framing/EOF, prevalidate every member path, and enforce command-specific CLI schemas.
Verification test: Positive canonical npm tar plus adversarial boundary mutations and exact normalized 55f4088 hash reproduction.
Related files/components: scripts/release-pack-policy.js; scripts/validate-release-pack-policy.js; README.md; approved release plan.
Remaining uncertainty: None for the supported npm toolchain; future toolchains require fresh canonical padding evidence before policy changes.
```
