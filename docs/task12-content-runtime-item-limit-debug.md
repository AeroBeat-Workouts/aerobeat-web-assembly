# Task 12 — Catalyst content-runtime item-limit diagnosis

## Exact Observed Failure

Exact live Catalyst import (`1AE3A`, version `1348bac90dd94d7299bda388bd101a2b967e28b3`) completes BeatSaver acquisition and atomic authoring, but selecting the authored persistence package through `@aerobeat/web-content` throws:

```text
data_too_large: Content data exceeds the item limit
```

The failure occurs in `aerobeat-web-content/src/runtime-data.js` `cloneFrozenData()` before runtime package validation or downloaded Preview can complete.

Direct measurement of freshly authored Catalyst packages produced:

- Expert: 154,636 visited JSON-like values, depth 9, 2,285,159 encoded JSON bytes, 5 charts.
- ExpertPlus: 194,912 visited values, depth 9, 2,877,427 encoded JSON bytes, 5 charts.

The measurement command completed both counts; its final process exit was non-zero only because the diagnostic attempted a nonexistent vendor `destroy()` method after logging.

## Expected Behavior

Any package satisfying the frozen `aerobeat.song-package.v1` five-chart contract, package/chart/hash rules, and existing byte/security bounds must load through `loadPersistenceHandle()`. Catalyst Standard Expert and ExpertPlus are valid authored packages and must preview/play from their downloaded collection. Untrusted oversized/cyclic/accessor-bearing data must remain bounded and fail closed.

## Execution Path

1. Assembly downloads exact BeatSaver version once.
2. Authoring `convertAllStandardAndPersist()` emits Expert and ExpertPlus as separate one-difficulty v1 packages and persists one shared audio asset.
3. Assembly latest-wins selection calls content runtime `loadPersistenceHandle()`.
4. The injected authoring resolver returns the selected package/export.
5. Content runtime calls `validateRuntimePackage(packageValue)`.
6. `validateRuntimePackage()` calls `cloneFrozenData(packageValue)` with no explicit limits.
7. `cloneFrozenData()` applies its generic default `maximumItems = 100_000`.
8. Valid Catalyst packages cross that generic threshold at 100,001 values and throw before schema/hash/chart validation.

## Most Likely Root Cause

The generic data-cloning default is being used as the package-format capacity limit. The 100,000-value default is lower than real valid five-chart packages produced by the canonical converter. It is not derived from the package contract or the content runtime's existing 16 MiB external-package bound.

Evidence:

- The only `data_too_large` throw is `runtime-data.js:70`.
- `package-content.js:20` invokes `cloneFrozenData(packageValue)` without a package-specific item limit.
- Measured valid Catalyst packages contain 154,636 and 194,912 values while remaining only 2.29 MiB and 2.88 MiB, well below the 16 MiB external-package limit.
- Authoring validation and exact Catalyst QA already pass, proving the data is canonical rather than malformed.

## Alternative Hypotheses

1. **Malformed or duplicated Catalyst chart data** — unlikely. Both packages pass authoring validation, preserve deterministic package hashes, contain exactly five charts, and remain under existing byte bounds.
2. **Shared-audio expansion into package data** — contradicted. Audio is one content-addressed persistence asset and is absent from package JSON.
3. **Unexpected nesting/cycle/accessor** — contradicted. Measured depth is 9, authoring validation passes, and the thrown code is item count rather than depth/cycle/descriptor.
4. **Assembly stale-selection bug** — contradicted for this symptom. The exact selected package reaches content validation; failure is deterministic for either Catalyst difficulty.

## Why Previous Fixes Failed

The earlier assembly repairs fixed selection identity, exact-target Preview, and grouped collections. Those fixes correctly route the desired package but cannot alter content runtime validation bounds. Mock/smaller fixtures pass because they remain below 100,000 visited values; they did not reproduce a full canonical Catalyst chart matrix.

## Unknowns

- The largest real package expected under current canonical source/converter bounds is not yet measured.
- Browser-specific memory cost near a revised item limit needs regression evidence.
- The content schema currently does not declare an explicit maximum beat count; the clone limit remains an important denial-of-service bound.

## Minimal Reproduction

1. Acquire BeatSaver `1AE3A` version `1348bac90dd94d7299bda388bd101a2b967e28b3`.
2. Run `convertAllStandardAndPersist()`.
3. Call content runtime `loadPersistenceHandle()` for Expert or ExpertPlus.
4. Observe `data_too_large` before readiness.

Smaller authored fixtures below 100,000 visited values load successfully.

## Proposed Verification

Before changing behavior:

- Reproduce that default `cloneFrozenData()` rejects a value above 100,000 items.
- Prove package validation succeeds when the same canonical Catalyst package is cloned with a bounded package-specific allowance above 194,912.
- Prove a value above the new package-specific allowance still fails `data_too_large`.
- Run content security/unit/browser suites and the exact assembly Catalyst selection/Preview path.

This distinguishes a capacity mismatch from malformed data, asset expansion, or assembly routing.

## Recommended Fix

Keep the generic `cloneFrozenData()` default unchanged for handles, themes, metadata, and other boundaries. Add a package-specific bounded item allowance in `package-content.js` and pass it only when cloning the top-level song package. A 500,000-value ceiling is the smallest practical rounded bound with more than 2× headroom over measured ExpertPlus while remaining finite and materially constrained alongside the existing 16 MiB package-byte limit.

Add focused tests proving:

- a valid canonical package above 100,000 values can validate under the package-specific bound;
- values/packages above 500,000 still fail closed;
- accessor/cycle/depth/string/security behavior is unchanged;
- exact Catalyst persistence loading and Preview succeed in assembly.

Potential regressions: higher worst-case clone/validation CPU and memory for direct in-memory packages. Retain byte bounds for external packages and the finite item ceiling; measure/cover browser behavior.

## Follow-up after package-validator repair `f9ad383`

The first bounded repair correctly gave `validateRuntimePackage()` a 500,000-item package-only allowance while retaining the 100,000 generic default. Content unit/security/browser/pack validation passed, but exact assembly `npm run test:live-catalyst` still failed with the same error before selection.

### New exact observed path

The live stack still ends at `runtime-data.js:70`, but inspection reveals an earlier persistence-export boundary:

1. `loadPersistenceHandle()` prefers authoring `exportPackage(handle)`.
2. Content `parseAeroPackage()` decodes `AEROPKG1` metadata.
3. `assets.js:30` calls generic `cloneFrozenData(metadataValue)` on the entire metadata record.
4. That metadata contains the full canonical package plus asset table.
5. The embedded package crosses 100,000 values before `validateRuntimePackage()` receives it, so the new package-validator allowance is never reached.

This confirms the package-specific allowance was necessary but applied too late for the preferred persistence/export path. Direct package validation is repaired; AEROPKG metadata parsing remains the active failure.

### Revised verification

- Direct `validateRuntimePackage()` above 100,000 must remain passing.
- Generic clone default must remain 100,000.
- Exact AEROPKG persistence parsing with a >100,000-value valid embedded package must pass under a finite package-specific allowance.
- Oversized metadata envelope, asset table, and >500,000 embedded package must still fail closed.
- Exact assembly Catalyst persistence load and Preview must pass.

### Revised recommended fix

Do not raise the generic metadata clone limit for all fields. In `parseAeroPackage()`, validate the JSON-parsed exact metadata envelope and bounded scalar fields, clone the embedded `package` with the same internal 500,000 package allowance, and clone/validate the small asset table under the existing generic/default or its own bound. Return only these separately narrowed/frozen values. This preserves the 16 MiB metadata byte bound, 2,048-asset bound, descriptor/path/range/hash checks, and 100,000 generic limit without letting the full package consume the generic envelope budget.

## Debugging Record

```text
Problem: Valid canonical Catalyst packages cannot enter content runtime.
Observed symptom: data_too_large at cloneFrozenData default 100,000-item threshold.
Root cause: Generic clone default is incorrectly applied both to the top-level package validator and earlier to the whole AEROPKG metadata wrapper containing that package.
Evidence: Expert=154,636 items/2.29 MiB; ExpertPlus=194,912 items/2.88 MiB; direct package-specific validation passes after f9ad383, while exact persistence still fails at assets.js whole-metadata clone before validation.
Failed approaches: Assembly selection/Preview repairs and small fixtures did not cross the bound; f9ad383 fixed direct validation but not the preferred AEROPKG parser boundary.
Corrective action: Keep generic default; use the finite 500,000 allowance at both package boundaries while separately narrowing the small exact metadata envelope and asset table.
Verification test: >100k direct and AEROPKG packages pass, >500k fails, content security/browser pass, exact Catalyst load/Preview passes.
Related files/components: aerobeat-web-content/src/runtime-data.js, package-content.js, assets.js, content-runtime persistence loading; assembly downloaded selection/Preview.
Remaining uncertainty: Maximum future canonical package size and browser memory cost near the revised ceiling.
```
