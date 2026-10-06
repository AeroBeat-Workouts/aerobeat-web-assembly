# Mode-switch hard-lock diagnosis (2026-09-29)

## Exact Observed Failure
Derrick reports that Boxing → Stop → Flow → Play displays "Resolved events must belong to the selected variant and chart" and remains unplayable without refresh. This is the exact gameplay `event_variant_mismatch` message from `normalizeEvents` in the gameplay coordinator. The physical page has not been inspected in this session; the code path below is deterministic.

## Expected Behavior
A fresh between-run selection must configure gameplay with the selected variant and only events stamped for that variant/chart. An in-run paused future-only swap may retain prior judged/past/active events as immutable truth but must not pass those events through gameplay's new-variant normalization; gameplay itself owns preservation and merging.

## Execution Path
`performSelectVariant` first synchronizes content playback from the gameplay session. If `sessionStartRequested` is true and gameplay state is calibrating or paused, it calls content `swapFutureVariant`. The content method preserves old past/judged/active event objects unchanged, appends new-variant future events, sets `selectedVariant` to the new target, and publishes a mixed `resolvedEvents` snapshot. Assembly passes that snapshot wholesale to `applyFutureContent`, which calls `normalizeEvents` on the entire array *before* preserving its own old events. Old-stamped objects fail the variant/chart check. On a normal Stop, assembly clears `sessionStartRequested` and gameplay enters completed, so it instead invokes content `selectVariant`; this publishes only new-stamped events. A stopped→mode-switch mismatch cannot be caused by stale content snapshot in this strictly serialized path; its actual state at the physical failure is still unknown (e.g., stop button may pause instead of call stop).

## Most Likely Root Cause
The future-only assembly branch forwards content's mixed old/new event array as a homogeneous new-variant array. This is incompatible with gameplay's strict `applyFutureContent` contract, whose own preservation stage already retains old objects with their original event truth. The pause and in-flight active event cases deterministically trigger this mismatch. `configureContent` itself is transactionally validating before mutation, so the error is surfaced without changing gameplay; content has already switched, leaving its new selectedVariant at odds with gameplay's previous variant.

## Alternative Hypotheses
1. **Stopped case actually paused/manual:** plausible if the UI action closes/pauses rather than invokes the public Stop; inspect `session.state` and `sessionStartRequested` at failure. 
2. **Stale asynchronous snapshot:** contradicted by the awaited `selectVariant` and synchronous `getSnapshot` within the serialized lifecycle intent.
3. **New events stamped incorrectly:** contradicted by content `timelineFor`, which stamps the target variant/chart; only preserved old objects differ.
4. **Fresh configure foreign collider settings:** possible independent error, but would emit a different `*_settings_locked` code; the mismatch check runs before collider settings.

## Why Previous Fixes Failed
No prior fix for this precise mismatch is documented; existing future-only selection preserved old events in content *and* attempted to preserve them again in gameplay.

## Unknowns
The exact physical Stop control action and session state at the moment of error remain unknown. A browser trace of `session.state`, `sessionStartRequested`, content selectedVariant and first mismatched event would settle it. The code itself proves the mismatch for paused in-flight swaps.

## Minimal Reproduction
Start Boxing; pause with at least one Boxing event before the timeline or active/judged; select Flow. Content snapshot now includes old Boxing event objects and selected Flow. Gameplay rejects the mixed array. For truly completed Stop, this particular mismatch is absent; add a separate stopped→Flow→Play regression to guard the reported sequence and reverse direction.

## Proposed Verification
Intercept the assembly→gameplay `applyFutureContent` configuration with a valid old-stamped preserved event and new-stamped future event, assert that only new-stamped events are forwarded. Independently exercise stopped Boxing→Flow→fresh Play and reverse; assert consistent variant/chart and no error. Force gameplay configuration failure and assert that a subsequent selection/start can recover without reload.

## Recommended Fix
For `futureOnly`, send only events stamped with the new variant/chart to `applyFutureContent`; it already retains old past/judged/active events and immutable truth by itself. On configuration failure after content selection, catch within the assembly, make the session restartable and surface the bounded error; a fresh Start should use a homogeneous selection, not repeat a future-only merge. Do not loosen gameplay's identity check.

## Debugging Record
```text
Problem: Cross-mode variant selection hard-locks with identity mismatch.
Observed symptom: "Resolved events must belong to the selected variant and chart" after mode change.
Root cause: Assembly forwards content's mixed preserved-old/new resolvedEvents into gameplay's homogeneous new-event validator on future-only swaps.
Evidence: content-runtime swapFutureVariant lines 183-191; assembly performSelectVariant lines 823-839; gameplay applyFutureContent lines 545-563 and normalizeEvents line 1820.
Failed approaches: None documented for this mismatch.
Corrective action: Filter future-only forwarded events by exact selected variant/chart; recover session on configuration failure.
Verification test: Paused mixed snapshot and both stopped direction changes, then fail/retry sequence.
Related files/components: assembly src/index.js, tests; content runtime and gameplay coordinator read only.
Remaining uncertainty: Exact physical Stop action and session state when original failure occurred.
```
