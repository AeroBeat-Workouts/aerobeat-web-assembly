# Song-swap hard-lock diagnostic record

## Exact Observed Failure
Derrick reports Test song A (Forklift Simulator), download song B (Wario Ware in Beat Saber), press Test for B, receive `Resolved events must belong to the selected variant and chart`, and cannot Test B without refreshing. The exact message is thrown by gameplay `normalizeEvents` (`session-coordinator.js:1821`). This session has not reproduced the physical page or obtained its stack/selected event identities.

## Expected Behavior
Every fresh Test/Play for B configures the exact selected B variant with exclusively B-stamped resolved events, clears previous run truth, and starts at time zero. A failure after content selection leaves menu controls usable and a later retry/reselection can recover without reload. Gameplay's event identity validation remains strict.

## Execution Path
Library `requestLibrarySelection` immediately selects the B row and queues `selectLibraryPackage` via a lifecycle FIFO. `selectLibraryPackage` awaits `performSelectContent`; this loads B from authoring/persistence, calls content `startLoad` (clears old state and publishes a B-only snapshot), loads B audio, then invokes `configureGameplayFromContent(false)`. The latter reads one content snapshot and sends its `selectedVariant` and `resolvedEvents` directly into gameplay `configureContent`, which validates all B events before replacing A events. The library path may then reprocess Boxing and select a retained equivalent variant; `performSelectVariant` routes paused same-package variants through future-only swapping but cross-package B is already configured at this point. Start/Test is queued behind selection and calls `configureGameplayFromContent(false, purpose, true)` again before requestStart.

## Most Likely Root Cause
**Confirmed code-level song-swap flaw:** the first B configuration occurs while A's session is still active; `gameplayContentPurpose()` inherits A's active Test purpose, so gameplay `configureContent` may preserve the `playing`/`paused_manual` session state and timeline while replacing package/variant/events with B. Assembly leaves `sessionStartRequested`, `activeSessionAction`, frame loop, and media lease tied to the A run until a later successful Start. On a failure, `performSelectContent` lacks the `performSelectVariant` recovery branch; the selected B content and A gameplay stay split. `startSession` catches and rethrows errors but does not restore menu disposition/frame loop when configure fails before a lease is acquired. This establishes a hard-lock route and mixed lifecycle truth, though it does *not alone prove* the reported exact event mismatch: normal content B events are B-stamped and gameplay replaces A events atomically.

## Alternative Hypotheses (ranked)
1. **Unexpected mixed content projection at physical failure:** future-only `swapFutureVariant` intentionally retains A-stamped old events alongside new ones, but assembly currently filters this path. It could explain the exact error only if another call passes mixed content through fresh `configureContent`. Inspect error-time event IDs and stack.
2. **Stale snapshot/async interleave:** content `startLoad` publishes atomically after validation and lifecycle FIFO serializes selection/start. Contradicted by direct code, barring untracked external calls.
3. **Gameplay residual event state:** `configureContent` constructs/validates next events before committing `events = nextEvents`, so residual A events do not flow into `normalizeEvents` from gameplay state.
4. **Package ID mismatch:** `normalizeEvents` compares variant/chart only; a package ID mismatch alone cannot throw this exact error.

## Why Previous Fixes Failed
The prior mode-switch fix filtered mixed *future-only* content and added a `performSelectVariant` recovery branch. Song changes use fresh `performSelectContent`, which did not get the recovery branch. These fixes do not restart/quiesce A when B becomes selected and do not guard fresh cross-package configuration failure.

## Unknowns
Physical event IDs, chart IDs, stack, session state, content state, and whether A is still actively running when B is selected. A browser A→B fixture and an injected configure failure distinguish a true B snapshot problem from stale transport, and establish recovery.

## Minimal Reproduction
Use two valid distinct song packages, run Test A, select B while A is active, press Test B. Also test reverse direction and Play after either Test or Play. Force one gameplay configuration failure after content switches to B and retry without reload. A→B normal path may succeed but still temporarily retain A run state; this is itself the proven lifecycle flaw.

## Proposed Verification
Instrument the assembly→gameplay configuration calls in a focused browser oracle: record content B identity, every event's variant/chart, gameplay package and session state at each configure. Assert B-only event arrays and no active A run after B selection; after deliberate throw assert recoverable menu and successful retry; compare reverse direction and Play. If identity still mismatches, log only sanitized IDs of first mismatched event to isolate the producer.

## Recommended Fix
At a cross-package boundary, stop/quiesce the old transport and clear active session ownership before installing B gameplay content; prevent old Test preservation from treating a different package as the same run. Catch configuration failure in `performSelectContent`, transition to actionable menu, stop frame loop and old gameplay/media, surface bounded error, retain selected content for retry. Keep strict gameplay validation unchanged and do not change content runtime unless fixture proves it publishes mixed fresh-load events.

## Result and validation
Assembly now retires A's active session at a cross-package boundary, configures B from B's event array, and shares a recoverable menu transition for selection-time configuration failures. Content runtime and gameplay strict validation remain unchanged. `node --check src/index.js`, `node --check scripts/validate-song-swap.js`, `node scripts/validate-aero-game-assembly.js`, and `node scripts/validate-song-swap.js` pass. The Vite-based `validate-standard-batch-library.js` could not start because assembly's release provenance pin rejects the already-ahead contracts checkout (`Release dependency provenance drifted for @aerobeat/web-contracts`). The Node oracle uses extracted source methods, synthetic valid event envelopes, and the real gameplay coordinator; a physical browser A/B test remains advisable when pins align. Bead: aerobeat-web-assembly-7na7 (closed).

## Debugging Record
```text
Problem: Test/Play song swap can strand content and gameplay in different sessions.
Observed symptom: "Resolved events must belong to the selected variant and chart" on Test B after Test A.
Root cause: Confirmed lifecycle bug: assembly configures B while A run/transport remains active and lacks cross-package configure failure recovery; exact event producer at physical error not yet proven.
Evidence: assembly performSelectContent/configureGameplayFromContent/startSession; content startLoad/timelineFor; gameplay configureContent/normalizeEvents.
Failed approaches: Prior mode-switch fix filters future-only events but does not handle fresh song selection.
Corrective action: Quiesce A at cross-package boundary and recover coherently from B configuration failure.
Verification test: Browser A→B→A Test/Play with B-only event assertions, injected failure and retry.
Related files/components: assembly src/index.js and focused assembly test, content runtime read-only, gameplay coordinator read-only.
Remaining uncertainty: physical stack and whether exact mismatch is generated by an unexpected mixed snapshot from another call path.
```
