# Real 4858 negative obstacle intervals at assembly runtime

## Exact Observed Failure

The first genuine insecure production-bundle integration row completed vendor acquisition and all three real module-Worker authoring jobs for local BeatSaver fixture `4858` / provider hash `431ffaa53a1e45ffab6c81a895e456f6aad1e038`, then timed out waiting for content/audio readiness. Diagnostic state showed:

```text
authoring.state = complete
packages = Hard, Expert, ExpertPlus
content.state = error
content.error.code = event_interval_invalid
content.error.message = Event 93 interval is invalid
audio.state = idle
```

A Node reproduction located exact authored Flow obstacle rows with `end < start`, including Hard event 93 `{start:83.75,end:83.5,type:"obstacle",cells:[0]}` and corresponding rows in Hard/Expert. No hash failed: raw SHA-1 and provider SHA-1 matched, all Worker jobs terminated, and the collection committed atomically.

## Expected Behavior

The hash integration must prove real 4858 provider/raw hashing, Worker authoring, persistence, and at least one admitted package through content/audio/Test. Content runtime must continue to fail closed on non-monotonic authored intervals; the integration must not weaken or bypass that integrity/semantic boundary.

## Execution Path

UI Latest/search/Download → real vendor fetch fulfilled with local 4858 bytes → exact raw/provider SHA-1 → v2 source manifest with Hard/Expert/ExpertPlus → `convertAllStandardAndPersist` → three real module Workers → atomic IndexedDB collection commit → assembly defaults to first Hard package → content persistence load → `package-content.js` validates Flow chart beats → beat index 93 has `end < start` → stable `event_interval_invalid` → selected audio is not loaded.

## Most Likely Root Cause

The real 4858 source contains negative-duration obstacle semantics which browser authoring currently projects as Flow intervals by adding the negative duration to start. Authoring's own package validator admits those rows, while the downstream content runtime correctly requires monotonic intervals. The cross-package contract is inconsistent for this legacy source edge case; it is independent of shared hashing.

## Alternative Hypotheses

1. Shared hash mismatch — contradicted by exact raw/provider identities, completed authoring and persisted packages.
2. Worker cleanup race — contradicted by all four observed Workers (preflight plus three conversions) terminating and authoring state `complete`.
3. IndexedDB partial commit — contradicted by one complete collection and all three packages.
4. Content runtime regression in monotonic checking — possible policy mismatch, but accepting `end < start` would violate current interval invariants; source normalization is the safer eventual owner.
5. Fixture corruption — contradicted by exact established provider hash and fixture SHA-256 `4273f0305518aa79ae4a7b58ccb07e86704ba50dbe679d0f0e29c52cb7b6beed`.

## Why Previous Fixes Failed

This is the first genuine assembly use of 4858 through current content interval validation. Authoring's package-local real-fixture suite validates persistence/export but does not load the result through `@aerobeat/web-content`, so the seam was previously untested.

## Unknowns

Whether Beat Saber defines negative obstacle duration as a legacy encoding to normalize, or whether such rows should be omitted, requires an authoring-domain decision and sanitized source comparison. That decision is outside i4u.1.5's exact audited consumer pins.

## Minimal Reproduction

Inspect exact local 4858 ZIP, author all Standard difficulties, load the persisted default Hard package through current content runtime. Hard Flow event 93 rejects with `event_interval_invalid`.

## Proposed Verification

Keep the invalid Hard/Expert rows fail-closed, explicitly select the authored ExpertPlus package (which has no observed reversed Flow intervals), and require content/audio/Test success. File a separate authoring/content seam Bead for later policy resolution; do not alter exact i4u pins.

## Recommended Fix

For i4u.1.5, make the validator assert the stable fail-closed default-package error and then exercise exact library selection of the valid ExpertPlus package. Do not clamp, omit, or accept reversed intervals in assembly. A future authoring Bead should decide and test the canonical legacy-negative-duration normalization before changing the audited authoring pin.

## Debugging Record

```text
Problem: Real 4858 default Hard package cannot enter current content runtime.
Observed symptom: event_interval_invalid at Flow event 93 after successful hash/Worker/IndexedDB commit.
Root cause: Authoring projects legacy negative obstacle durations to end < start while content requires monotonic intervals.
Evidence: Exact authored events (for example 83.75→83.5), all three persisted packages, exact raw/provider hashes, content package-content.js monotonic gate.
Failed approaches: Initial validator assumed every package admitted by authoring would be admitted by content.
Corrective action: Assert fail-closed invalid default, select valid ExpertPlus for downstream hash/audio/Test proof; track normalization separately.
Verification test: In all trust/embed rows, three-package commit followed by ExpertPlus content/audio/Test success; reversed Hard/Expert remains rejected.
Related files/components: content-authoring Flow obstacle conversion/package validation; content package-content.js; assembly refreshLibrary/requestLibrarySelection; local 4858 fixture.
Remaining uncertainty: Canonical Beat Saber meaning and desired normalization of negative-duration obstacles.
```
