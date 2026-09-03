# k72.28 assembly candidate audit failures

## Exact Observed Failure

Independent assembly audit returned FAIL with actionable gaps: config IDs outside the catalog grammar/membership could normalize and create path-like filenames (`../escape.environment-config.v1.json`); loading/error/Retry UI did not settle from renderer lifecycle and Camera-hidden text could be suppressed; runtime tests did not exercise the complete component/config/privacy/accessibility matrix; dry npm packing included `.plans/**` visual evidence; and the catalog entry object included classification despite the approved exact entry shape.

## Expected Behavior

Only selected known catalog IDs may normalize or generate filenames. Environment state must settle generation-safely, Camera-hidden truth must win, and Retry must be error-only. Executable tests must cover component atomicity, trusted <=16 KiB load/save and privacy/lifecycle behavior. Package output must exclude plan/review evidence. Catalog entries must retain the approved exact shape while truthful artifact classification remains assembly-owned separately.

## Execution Path

1. Config helpers accepted caller-provided `expectedId` without applying catalog ID grammar/membership.
2. Serializer used that normalized ID to construct the download filename.
3. Selection/retry assigned a loading string but did not observe the renderer environment load promise/diagnostics after settlement.
4. Rendering selected `environmentStatus || hidden`, allowing stale status to mask Camera mode.
5. Retry enablement followed Visual Test enabled state instead of renderer error state.
6. Existing browser validation mostly inspected DOM/source invariants rather than driving complete load/switch/failure paths.
7. npm's default package walk included tracked `.plans` review assets because no files/ignore boundary excluded them.
8. Artifact classification lived directly on catalog entries, adding a fifth entry key.

## Most Likely Root Cause

The first implementation optimized around internal known callers and static validators rather than treating helpers, async renderer state, and packaging as independent hostile boundaries. Evidence is the accepted path-like ID probe, persistent loading copy, static-regex-heavy validator, and actual dry-pack inventory.

## Alternative Hypotheses

- Browser-only renderer failure: contradicted by deterministic source flow; the status gap exists even when loading succeeds.
- Vite emission leak: contradicted by exact Vite 24-file environment output; the evidence leak is npm pack policy.
- Catalog source defect: contradicted by exact source catalog validation; the extra classification key was introduced in assembly representation.

## Why Previous Fixes Failed

Prior hardening focused on numeric/schema/accessor/proxy input and renderer atomicity. It did not validate ID membership, settle assembly-visible load state, constrain package traversal, or exercise full component behavior. Source regexes proved code presence, not behavior under lifecycle transitions.

## Unknowns

The smallest package-boundary mechanism compatible with this private app must be selected: a narrow `.npmignore` is preferable to a broad `files` whitelist unless existing release tooling expects other tracked files. Focused tests must confirm no required package member is lost.

## Minimal Reproduction

- Normalize/serialize a strict-shaped config with `id` and `expectedId` both `../escape`; observe acceptance/path-like filename.
- Select an environment and await renderer readiness; observe status remains `Environment loading.`.
- Enter Camera mode after any status text; observe hidden truth is masked.
- Run `npm pack --dry-run --json --ignore-scripts`; observe `.plans/**` PNG evidence in package members.

## Proposed Verification

Add known-ID and filename negatives, generation-bound load-state tests, error-only Retry and Camera precedence checks, direct/real-iframe control matrix, trusted load/save and atomic reject instrumentation, storage/event/message instrumentation, and exact dry-pack forbidden-member assertions. Re-run bounded npm test/build/package/browser validators and independent audit.

## Recommended Fix

Apply strict catalog membership/grammar before config normalization and serialization; separate artifact classification into a private ID set while restoring exact catalog entry keys; add generation-bound settlement from the renderer's current environment load promise and generic diagnostics; make Camera copy precedence explicit and Retry error-gated; add focused executable validation; exclude `.plans` from npm package output and assert the boundary.

## Debugging Record

```text
Problem: Assembly candidate passed broad tests but missed hostile ID, async UI, executable coverage, and package-boundary requirements.
Observed symptom: Independent audit FAIL with ../escape filename, stale loading/Camera copy, always-enabled Retry, static-only proof, .plans package leak, and extra catalog key.
Root cause: Internal-caller assumptions and static validators did not model each boundary independently.
Evidence: Focused audit probes, source execution paths, and npm dry-pack inventory.
Failed approaches: Numeric/schema/proxy helper tests and DOM regex checks alone were insufficient.
Corrective action: Strict known IDs, generation-safe status, Camera precedence, error Retry, exact entry shape, focused runtime tests, and package exclusions.
Verification test: npm test/build/dry-pack; focused direct/iframe controls; independent audit.
Related files/components: src/environment-asset-catalog.js, src/index.js, scripts/validate-environment-assembly.js, scripts/validate-playwright-console-noise.js, package boundary files.
Remaining uncertainty: Exact minimal package exclusion mechanism pending validation.
```

## Replacement-coder follow-up: landscape authoring overlap

### Exact Observed Failure

The executable direct/real-iframe matrix failed all four `844×390` landscape rows at DPR 1/3 with `panelWithin=true`, `noMenuOverlap=true`, but `noTransportOverlap=false`. Portrait rows passed.

### Expected Behavior

The scrollable Visual Test authoring panel must remain inside the component and must not cover the bottom Test transport in either embedding or DPR.

### Execution Path and Root Cause

The panel begins at the top safe-area inset and contains the 44 px collapse control plus an authoring body capped at `72vh`. At 390 CSS px height, that body may consume about 281 px before the collapse control, panel gaps, borders, and padding are added. The resulting panel intersects the bottom transport. DPR and iframe do not cause the failure because the same CSS geometry fails in all four landscape combinations while portrait passes.

### Alternative Hypotheses

- A framebuffer/DPR rounding defect is contradicted by identical DPR 1/3 results.
- An iframe sizing defect is contradicted by identical direct and iframe results and `panelWithin=true`.
- A menu collision is contradicted by `noMenuOverlap=true`.

### Verification and Recommended Fix

Reduce the authoring body's viewport-height cap enough to reserve the 44 px collapse row, panel chrome, and bottom transport, while retaining its existing internal scrolling. Re-run all eight direct/real-iframe portrait/landscape DPR rows and require panel containment plus no menu/transport overlap.

```text
Problem: Visual Test authoring panel overlaps Test transport in short landscape viewports.
Observed symptom: Four 844×390 direct/iframe DPR1/3 rows report noTransportOverlap=false.
Root cause: 72vh body cap excludes collapse-row/panel chrome and leaves no transport reserve.
Evidence: All portrait rows pass; all landscape rows fail independent of embedding/DPR.
Failed approaches: Containment and internal scrolling alone did not prevent sibling overlap.
Corrective action: Lower the viewport-height body cap while preserving overflow:auto.
Verification test: Exact eight-row environment controls browser matrix.
Related files/components: src/index.js authoring CSS; scripts/validate-environment-controls-browser.js.
Remaining uncertainty: None after matrix geometry readback.
```
