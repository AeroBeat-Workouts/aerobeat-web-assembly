# Hash bundle WASM scan overreach

## Exact Observed Failure

`npm run test:hash-provenance` passed all exact repository/package/fingerprint pins, then `validate-production-hash-bundle.js` failed at `production-hash-bundle-policy.js:35` with:

```text
Error: Production hashing bundle contains a WASM runtime path
```

The failure is directly observed in the assembled production JavaScript regex scan. It is not evidence that `@aerobeat/web-hash` uses WASM.

## Expected Behavior

The gate must reject a WASM or external-runtime path owned by shared hashing, while preserving the existing locked MediaPipe Tasks Vision production bundle and the release policy's existing zero emitted `.wasm` asset invariant.

## Execution Path

`validate-production-hash-bundle.js` → Vite production build with source maps → `validateProductionHashBundle(outputs)` → concatenates every production chunk → whole-bundle `/WebAssembly\s*\./` scan → failure. The scan does not attribute the match to a source owner.

## Most Likely Root Cause

The new scanner applies a hash-specific prohibition to the entire application bundle. The assembly intentionally bundles MediaPipe Tasks Vision, whose JavaScript may contain WebAssembly runtime support even though the release emits no `.wasm` assets. Source-map attribution already identifies exact `aerobeat-web-hash/src/index.js`; the WASM prohibition should apply to that source plus emitted hashing assets, not unrelated locked CV code.

## Alternative Hypotheses

1. Shared web-hash introduced WASM — contradicted by its exact audited `src/index.js`, package manifest, and no-dependency policy.
2. Vite emitted a `.wasm` asset — contradicted by the validator's output inventory check; failure occurred on JavaScript text.
3. A migrated hash consumer dynamically loads WASM — possible in principle, but source-level consumer scans already reject `.wasm` and `WebAssembly` paths in the six hash consumers; the whole bundle additionally contains unrelated MediaPipe sources.

## Why Previous Fixes Failed

This is the first run of the new gate. Its assumption that every `WebAssembly` token in the monolithic assembly bundle belongs to hashing was too broad.

## Unknowns

The exact generated match belongs to a bundled dependency and is not needed to distinguish hash ownership because source maps provide exact ownership. A targeted source-map listing can identify it if release policy later broadens beyond hashing.

## Minimal Reproduction

Run `npm run test:hash-provenance` from the assembly baseline after adding the production bundle scanner. Provenance passes; the whole-bundle WASM regex fails.

## Proposed Verification

Require exact shared-hash source-map attribution; assert that source has no `.wasm`, `WebAssembly`, external URL, fetch, or dynamic import; assert no emitted `.wasm` output; retain consumer source scans. Then rerun the production bundle gate.

## Recommended Fix

Remove the unattributed whole-bundle `WebAssembly` token rejection. Apply hash-specific network/WASM checks to the exact shared hash source content, and retain exact emitted `.wasm` inventory rejection in the validator/release policy.

## Debugging Record

```text
Problem: New hash bundle scanner rejects unrelated application WebAssembly tokens.
Observed symptom: Error "Production hashing bundle contains a WASM runtime path" after exact provenance passed.
Root cause: Whole-bundle regex lacks source ownership attribution and sees locked MediaPipe Tasks Vision runtime code.
Evidence: Shared hash exact source has no dependency/WASM/network path; source maps identify exact shared owner; emitted asset gate is separate.
Failed approaches: First implementation treated monolithic bundle text as if every token belonged to hashing.
Corrective action: Scope hash prohibitions to exact shared source-map content and emitted asset inventory.
Verification test: Rerun hash provenance/bundle gate; direct digest remains shared-only and zero `.wasm` outputs remain required.
Related files/components: scripts/production-hash-bundle-policy.js; scripts/validate-production-hash-bundle.js; Vite MediaPipe bundle.
Remaining uncertainty: None material to hash ownership.
```
