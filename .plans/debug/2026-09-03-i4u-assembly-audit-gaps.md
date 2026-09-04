# i4u.1.5 assembly audit gaps

## Exact Observed Failure

Independent auditor `1b2255b7-7ae0-4dbb-85af-88d80bc1f86b` returned FAIL with concrete candidate gaps: release proof checked pinned sibling HEAD/tree but could consume dirty working bytes; browser routing allowed any request to Tailscale/localhost/127.0.0.1 on arbitrary ports; production source-map counts double-counted asset and in-memory maps rather than requiring main plus conversion Worker; post-delete checks omitted the IndexedDB shared `assets` store; public validation trusted local `origin/main`; and assembly-level mismatch evidence relied partly on exact-pinned consumer suites.

## Expected Behavior

Release evidence must describe the exact bytes built, test routing must permit only exact ephemeral origins/fixture endpoints, both required hashing graphs must be individually attributed, shared audio must be absent after collection deletion, current public refs must equal pins, and every integrity boundary must have explicit fail-closed behavioral evidence.

## Execution Path

Candidate build → `computeReleaseFingerprint()` → `readReleaseDependencyProvenance()` read Git HEAD/tree but not status → recursive fingerprint read working files. Candidate browser test → catch-all Playwright route → hostname-only local allow branch → arbitrary ports continued. Vite in-memory output → policy gathered `.js.map` assets and `chunk.map` copies → global attribution counts. Delete row → public authoring lists only → no direct IDB store counts.

## Most Likely Root Cause

The first implementation proved each concern independently but did not bind evidence tightly enough at the seams: Git identity to consumed worktree bytes, allowed hostname to exact test origin, source attribution to required output chunk, and logical deletion to physical shared-asset store state.

## Alternative Hypotheses

- Existing focused tests could be considered sufficient operationally, but they do not make release generation itself fail closed or prevent an unrelated local-service request.
- Duplicate map counts currently still included the correct main/Worker sources, but count-based acceptance can false-pass after future output changes.
- Authoring delete implementation already garbage-collects assets, but the assembly integration did not observe that physical store.

## Why Previous Fixes Failed

The implementation optimized for exact positive evidence and reused broad local routing/source-map collection patterns. Separate provenance tests caught dirtiness, but release generation did not invoke that test. Logical list checks were mistaken for complete persistence cleanup proof.

## Unknowns

A compact assembly-level chart mismatch setup may require package rehash helpers; exact-pinned consumer suites already behaviorally cover package/chart/asset/audio/GLB/JPEG one-byte rows. Re-audit must decide whether binding those exact suites plus added assembled GLB/JPEG/IDB checks is equivalent or whether more production-row mutation is required.

## Minimal Reproduction

1. Dirty a pinned sibling source without changing HEAD; old release provenance still reports pinned commit/tree while fingerprinting dirty bytes.
2. Request the protected Tailscale host on another port from a test page; old route continues it.
3. Inspect Vite write:false outputs; the old policy counts both emitted map assets and `chunk.map` objects.
4. Delete a collection; old evidence reads only public package/collection lists.

## Proposed Verification

- Require exact clean porcelain state in release provenance and simulate a harmless untracked/dirty sentinel in a temporary pinned-repo worktree or inspect the explicit check.
- Route only exact child/parent origins; assert all other local origins become `network-escape` and abort.
- Deduplicate maps by target JS and return exact shared-attributed chunk names; require one main entry and the conversion Worker.
- Count `packages`, `collections`, and `assets` object stores after deletion.
- Compare `git ls-remote origin refs/heads/main` to each pin in the provenance audit.
- Retain/rerun exact-pinned behavioral mismatch suites and add assembled asset mutation where practical.

## Recommended Fix

Implement the seam bindings above without weakening any product integrity check, changing exact pins, or touching release/server state. Update evidence metrics after the final diff and request fresh independent re-audit.

## Debugging Record

```text
Problem: Candidate evidence could false-pass at several provenance/isolation/cleanup seams.
Observed symptom: Independent audit FAIL with six prioritized findings.
Root cause: Checks established nearby facts but did not cryptographically/operationally bind the exact consumed bytes, origins, chunks, and physical stores.
Evidence: Dirty working bytes are outside HEAD/tree; hostname-only route ignores port; duplicate map representations; public deletion lists omit assets store.
Failed approaches: Separate clean test instead of release-time clean check; global source counts; hostname allowlist; logical-only cleanup evidence.
Corrective action: Bind exact clean worktrees, live public refs, exact origins, exact required chunks, and exact IDB stores; strengthen mutation evidence.
Verification test: Focused provenance/bundle plus four-row production matrix, package/release gates, final independent re-audit.
Related files/components: release-fingerprint.js, production-hash-bundle-policy.js, validate-production-hash-bundle.js, validate-insecure-hash-integration.js, validate-shared-hash-provenance.js.
Remaining uncertainty: Whether auditor requires duplicate assembly mutation of every exact-pinned consumer boundary after equivalent official suite proof.
```

## Repair Results

- Release provenance now rejects any tracked, staged, or untracked sibling dirtiness in addition to exact commit/tree drift before reading recursive source inputs.
- Live `git ls-remote origin refs/heads/main` equality is part of the focused public provenance gate; deterministic fingerprinting itself remains based on local exact pins/clean bytes.
- Browser routing now permits only the exact ephemeral child origin and, for iframe rows, its exact ephemeral parent origin. Any other loopback/Tailscale port is a `network-escape` failure.
- First deduplication attempt exposed a second exact failure: Vite represents the conversion Worker JavaScript as an asset with a `.js.map` asset, not as an output chunk. The corrected scanner deduplicates one map per target JS, finds the main entry from chunks, finds the conversion Worker from map targets, and passes with 4 actual scripts / 3 physical maps / exact `index` + `conversion-worker` shared ownership.
- Genuine insecure direct production composition now mutates persisted package bytes, one boxing chart beat with a recomputed outer package hash, and shared audio bytes. Exact stable rejections are `export_package_hash_mismatch`, `chart_hash_mismatch`, and `audio_declaration_mismatch`, with restoration/recovery after every case. It additionally intercepts and flips one byte in actual GLB and JPEG responses and requires renderer asset/environment `error` states.
- Final deletion and real cancelled re-import now both count IndexedDB `packages`, `collections`, and `assets` stores and require all three to equal zero. Four-origin production integration passes after repair.
