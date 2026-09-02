# Release pack complete-grammar diagnosis

## Exact Observed Failure

Independent QA against release-pack-policy source `8082fb4` produced four block-framed archives with valid recomputed header checksums that the verifier accepted:

- directory mode `0007558\0` collapsed to `0755`;
- file mode `0644\0XYZ` collapsed to `0644`;
- file size `000000000068` collapsed to octal `6`;
- checksum with an invalid trailing `8` collapsed to the preceding valid octal checksum.

QA's other 70 termination, path, padding, UTF-8, and CLI probes rejected correctly.

## Expected Behavior

The release evidence verifier is not a general tar reader. Under the pinned Node `22.22.3` / npm `10.9.8` toolchain it must accept exactly the archive identified by trusted `npm pack --json` metadata and the exact normalized detached target, while rejecting every alternate gzip wrapper, package inventory, USTAR header encoding, content byte, padding byte, or terminator.

## Execution Path

1. `verifyArchive()` validates a clean normalized detached target.
2. Baseline code used `gunzipSync()` and parsed selected tar fields.
3. `readTarNumber()` converted a whole field to ASCII, removed everything after NUL, trimmed, and called permissive `Number.parseInt(text, 8)`.
4. Semantic mode/size/checksum comparisons therefore ran after distinct malformed byte encodings had already collapsed to accepted integers.
5. Other fields and the gzip wrapper were not bound to one canonical byte grammar. Recomputed checksums allowed mutations in ignored header fields; metadata membership and archive hashes were not required inputs.

## Most Likely Root Cause

The verifier decoded selected semantic values instead of validating one complete canonical archive. Strict parsing of only mode/size would still leave equivalent encodings, ignored USTAR fields, alternate path splits, package subset/order, base-256 numbers, and gzip concatenation/trailing-member ambiguity.

Canonical npm evidence establishes a narrow byte contract:

- metadata is a one-record exact-schema JSON array whose identity, file inventory, byte sizes/modes, entry count, SHA-1, SHA-512 integrity, and archive length bind the package;
- gzip header is `1f8b08000000000002ff`, with one complete raw-deflate stream, CRC32/ISIZE trailer, and exact EOF;
- each member is a regular file with a canonical ASCII USTAR name/prefix split, Git/npm-bin-derived `0644` or `0755` mode, zero portable uid/gid/uname/gname/link fields, exact size, mtime `499162500`, ASCII type `0`, `ustar\0`/`00`, zero dev/reserved fields, canonical six-octal checksum termination, exact content, and zero padding;
- exactly two zero blocks terminate the tar.

## Alternative Hypotheses

1. **Header checksum corruption** — disproved because QA recomputed valid checksums and malformed checksum syntax itself remained accepted.
2. **Gzip/zlib nondeterminism** — disproved by unchanged authoritative normalized archive reproduction; the failing mutations were tar-header bytes.
3. **Mode normalization failure** — disproved because exact tracked modes and member contents remained correct; only malformed encodings collapsed.
4. **The four numeric fields are the entire bug** — contradicted by mutation probes showing ignored USTAR fields, base-256 encodings, alternate inventory/order, and gzip wrapper variants were not independently constrained.

## Why Previous Fixes Failed

The mode-policy repair solved host filesystem mode drift. The next repair solved missing terminators, post-terminator data, unsafe all-member paths, and loose CLI options. Both retained a best-effort tar parser. Their tests asserted decoded outcomes but did not compare the entire trusted package wrapper and every header byte, so each QA pass exposed the next unvalidated representation.

## Unknowns

None for the pinned toolchain and current candidate. A future Node/npm/tar version may emit a different canonical wrapper or header and must establish a reviewed new policy instead of widening this verifier implicitly.

## Minimal Reproduction

Starting from one valid npm archive, alter one numeric field to include `8`, post-NUL junk, or a base-256 high bit; recompute the ordinary tar header checksum; gzip the result; then invoke the `8082fb4` verifier. It accepts the malformed mode/size variants. The complete-grammar verifier rejects the first byte difference from its reconstructed canonical header.

## Proposed Verification

- Use real npm fixtures covering empty/nonempty files, a `bin` forced to `0755`, nested paths, exactly 100-byte archive paths, and the longest supported USTAR prefix.
- Mutate every USTAR field and run exhaustive invalid numeric/termination/base-256 tests.
- Mutate trusted metadata schema, identity, membership, order, modes, sizes, hashes, and bundled state.
- Mutate gzip magic/method/flags/mtime/XFL/OS, concatenate members, append bytes, and corrupt CRC32/ISIZE.
- Retain all target safety, CLI, path, content, padding, and exact terminator probes.
- Reproduce the authoritative normalized `55f4088` JSON/tgz/tar/manifest identities in two fresh differently-moded worktrees.

## Recommended Fix

Require trusted npm metadata, validate its complete pinned schema and archive hashes, validate one canonical gzip member, and reconstruct each expected USTAR regular-file header from exact metadata/target bytes for a full 512-byte comparison. Derive content boundaries from trusted source sizes, reject every non-file/PAX/base-256 representation, and require exact content/padding/terminator bytes. This addresses the representation-level root cause rather than adding another permissive numeric decoder.

## Debugging Record

```text
Problem: Release pack verifier accepts alternate raw archive representations that decode to selected expected semantics.
Observed symptom: Invalid octal digits, post-NUL junk, and malformed checksum termination pass.
Root cause: Best-effort numeric/header decoding instead of complete trusted npm wrapper and USTAR byte validation.
Evidence: parseInt partial parsing; ignored header fields/wrapper; valid-checksum QA mutations; canonical archive field inventory.
Failed approaches: Mode normalization and structural/path/CLI hardening left selected semantic decoding in place.
Corrective action: Bind trusted metadata/hashes, canonical single gzip member, and byte-exact reconstructed USTAR headers/content/padding/terminator.
Verification test: Real npm boundary fixtures plus metadata/gzip/every-header mutation matrices and two exact-candidate reproductions.
Related files/components: scripts/release-pack-policy.js; scripts/validate-release-pack-policy.js; README.md; qmc/cf1/1wu/nme.
Remaining uncertainty: None for pinned Node 22.22.3/npm 10.9.8; future toolchains require explicit policy review.
```
