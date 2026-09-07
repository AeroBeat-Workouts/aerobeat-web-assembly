# Completed Visual Test terminal purpose diagnosis

**Date:** 2026-09-07
**Bead:** `aerobeat-web-assembly-gbvk`
**Baseline:** assembly `f822d5e19bada1d8eb0c80ecc3528b76076ca2c1`; gameplay `2ba22596398c9ef36a555ef5240b802ea02cc437`
**Disposition:** root cause confirmed from exact independent QA reproduction and current source; diagnosis completed before corrective edits

## Exact Observed Failure

Independent QA's fresh exact detached topology passed the focused `36 + 24 + 24` lifecycle matrices, then the unchanged full browser suite failed deterministically at `scripts/validate-mobile-gameplay-menu.js:187`. The standalone validator reproduced the same failure. After a Visual Test reached `completed`, terminal-menu Song, Difficulty, Gameplay, and Conversion selections ended in `idle/visual_test`; the existing browser contract requires each between-run selection to establish `calibrating/play`. The menu remained terminal and no resource resume was requested.

Direct observation is the failing final coordinator state and the exact source branch described below. It is inferred, but consistent with passing active-Test rows, that resource and ordering ownership are otherwise intact.

## Expected Behavior

Purpose preservation is state-aware:

- a pending Test action owns `visual_test` configuration;
- an already accepted current Visual Test may preserve `visual_test` through a legitimate selection only while its coordinator is `playing` or `paused_manual`, and not while the menu still has terminal disposition;
- `completed`, `stopped`, `idle`, Play calibration/tracking states, and terminal between-run selections establish ordinary `play/calibrating` configuration;
- terminal selection and menu close acquire or resume no audio, camera, video, CV, gameplay, or lease;
- a later explicit Test action still performs the full exact zero-time `visual_test` reconfiguration and audio-only start;
- Start remains `play/calibrating` with camera/CV.

## Execution Path

1. Natural Test completion publishes `completed/visual_test` and terminal reconciliation releases resources.
2. Opening the menu records `menuDisposition="terminal"`.
3. Song/Difficulty/Gameplay/Conversion enters the serialized lifecycle drain and ultimately calls `configureGameplayFromContent(false)`.
4. Its default purpose comes from `gameplayContentPurpose()`.
5. Current source returns `visual_test` whenever `sessionStartRequested`, `activeSessionAction==="test"`, and the coordinator purpose remains `visual_test`.
6. Completion deliberately retains those accepted-action fields, so the helper does not distinguish active resumable Test from terminal Test.
7. Gameplay receives `configureContent(configuration, { purpose:"visual_test" })`, which correctly publishes `idle/visual_test` for a between-run Visual Test configuration.
8. The terminal menu therefore retains a stale prior-run purpose rather than establishing the next default Play calibration truth.

## Most Likely Root Cause

`gameplayContentPurpose()` uses action identity and coordinator purpose but omits coordinator state and terminal menu disposition. The previous repair correctly made configuration purpose-aware, but its preservation predicate is broader than the lifecycle contract: it treats `completed/visual_test` as though it were still an active or manually paused Test.

Evidence:

- exact QA observed `idle/visual_test` after all four terminal selections;
- `src/index.js:846-849` has no state or menu-disposition guard;
- the focused action-before-selection matrix passes precisely for the legitimate `playing` and menu-paused `paused_manual` cases;
- gameplay's purpose-aware configuration behaves consistently with the supplied purpose, so coercing gameplay would be wrong.

## Alternative Hypotheses

1. **Overbroad assembly purpose predicate — confirmed/highest likelihood.** It directly explains both the terminal failure and active-row success.
2. **Gameplay purpose-aware API defect — contradicted.** Test startup and active selection publication matrices pass and the API publishes the requested purpose.
3. **Terminal reconciliation resumes resources — contradicted.** QA's terminal matrix and existing close assertions show zero resume/acquisition.
4. **Selection ordering regression — contradicted.** Selection-before-action, action-before-selection, rejection, disconnect, and destroy matrices pass.
5. **Browser timing/contention — contradicted.** The unchanged standalone mobile validator reproduces deterministically at a state assertion.

## Why Previous Fixes Failed

The serialization repair solved stale selection continuations. The purpose-aware follow-up solved transient Play calibration during Test and legitimate active/menu-paused Test selections. Its helper encoded “accepted Test action whose current purpose is Visual Test” but did not encode the terminal boundary. The new action-first oracle intentionally covers `playing` and `paused_manual`; the older mobile terminal assertion covers the final terminal result but does not currently assert the purpose/resource invariants after every individual Song/Difficulty/Gameplay/Conversion commit.

## Unknowns

No material root-cause unknown remains. The exact aggregate command durations remain environment-dependent, but no timeout or assertion change is needed. Validation must confirm that terminal disposition dominates a manually paused timeline only when that disposition is still terminal, while ordinary active menu pause continues preserving Visual Test.

## Minimal Reproduction

1. Start Visual Test with playable downloaded content.
2. Drive audio to natural end and reconcile to `completed/visual_test` with no lease.
3. Open the menu and confirm terminal disposition.
4. Select Song, Difficulty, Gameplay, or Conversion.
5. Observe current faulty result `idle/visual_test`; expected result is `calibrating/play` with terminal disposition retained and zero resource activity.

Control: make the same Gameplay selection during `playing/visual_test` or an active-menu `paused_manual/visual_test`; it must remain Visual Test.

## Proposed Verification

- Add a source oracle requiring the preservation predicate to name only `playing`/`paused_manual` and reject terminal disposition.
- Strengthen the existing real-browser held-control terminal oracle so every Song/Difficulty/Gameplay/Conversion selection independently records `calibrating/play`, zero audio/gameplay/CV/camera resume/acquisition deltas, and no lease.
- Preserve line 187 and its final exact state assertion unchanged in meaning.
- Rerun standalone mobile, exact terminal `36 + 24 + 24`, unchanged eight-context product shell, complete browser, and all requested unit/build/raw/privacy/DB7/provenance/pack gates in an exact clean topology.

## Recommended Fix

Narrow only `gameplayContentPurpose()`: pending Test still returns `visual_test`; an accepted Test returns `visual_test` only when the current coordinator is `playing` or `paused_manual` and `menuDisposition !== "terminal"`; every other configuration returns `play`. Do not alter gameplay, selection serialization, terminal reconciliation, resource activation, timing, or assertions.

Potential regressions to guard are active playing selection, active menu-pause selection, pending Test ownership, terminal seek/restart, Start camera/CV, selection rejection, disconnect/destroy, and terminal close.

## Debugging Record

```text
Problem: Completed Visual Test purpose leaks into terminal between-run content configuration.
Observed symptom: terminal Song/Difficulty/Gameplay/Conversion selections end idle/visual_test instead of calibrating/play.
Root cause: gameplayContentPurpose preserves visual_test from accepted Test identity without checking active state or terminal disposition.
Evidence: exact QA standalone/full-browser line-187 failure; current source predicate; passing active playing/menu-paused purpose rows.
Failed approaches: purpose-aware configuration predicate was action-aware but not terminal-state-aware.
Corrective action: preserve visual_test only for pending Test or nonterminal playing/paused_manual accepted Test.
Verification test: strengthened per-control mobile terminal oracle, source predicate oracle, 36+24+24 lifecycle matrix, full unchanged product/browser gates.
Related files/components: src/index.js; scripts/validate-aero-game-assembly.js; scripts/validate-mobile-gameplay-menu.js.
Remaining uncertainty: none material; complete validation required.
```
