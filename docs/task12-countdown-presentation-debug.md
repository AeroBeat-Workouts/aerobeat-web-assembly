# Task 12 Countdown Presentation Debug Record

## Exact Observed Failure

Derrick’s Android test reached T-pose and later gameplay beats but presented no perceptible 3-2-1. A delayed recovery-audio reproduction also showed that gameplay could become ready to resume while `audio.pause()` was still pending.

The first pixel/timing validator exposed a deterministic presentation conflict: gameplay had already entered `countdown` with value `3`, while the only visible transient cue still read `Release` because input calibration remained in `cooldown`.

## Expected Behavior

Initial and tracking-recovery starts must expose exactly one ordered, high-contrast DOM cue: `3`, `2`, `1`, each paint-eligible for at least 800ms. Gameplay/audio remain frozen until countdown completes. A recovery countdown cannot enter or advance while audio is playing or stopped at a position different from the coordinator timeline.

## Execution Path

1. Input accepts T-pose, then enters release/cooldown.
2. Gameplay receives ready input and begins countdown.
3. `transientCue()` formerly checked input `cooldown` before `gameplay.countdown.value`, so `Release` masked a live countdown numeral.
4. Gameplay could therefore traverse 3-2-1 while the DOM kept showing release copy.
5. During tracking loss, gameplay enters `paused_tracking` and assembly begins asynchronous `audio.pause()`.
6. Fresh calibration can arrive before pause resolves.
7. Without a freeze gate, the next gameplay advance can begin/advance recovery countdown against a still-playing or position-mismatched audio clock, producing `countdown_audio_not_frozen`.
8. The audio service supports an explicit paused seek, but assembly previously synchronized only manual-paused gameplay to the later audio position; it did not align tracking/countdown audio back to the coordinator’s frozen timeline.

## Most Likely Root Cause

Two confirmed assembly ordering defects:

- Numeric countdown presentation had lower priority than calibration cooldown copy.
- Tracking recovery did not wait for asynchronous pause plus exact paused-position alignment before advancing gameplay.

The first defect directly explains a countdown that logically occurred but was not visible. The second can cancel a recovery countdown on slower devices where audio pause spans multiple display frames.

## Alternative Hypotheses

- Main-thread starvation contributed to poor physical paint cadence, but the display-rAF repair addresses it and does not explain the deterministic `Release`/value-3 conflict.
- CSS stacking or contrast could hide digits, but direct/iframe DPR1/3 screenshots now prove pixel variation over Aero and bright/dark Camera backgrounds.
- Gameplay skipped countdown states, but gameplay HEAD `7d8323d` independently guarantees full-dwell sequential transitions.

## Why Previous Validation Failed

Previous matrices sampled any finite countdown value and did not require the cue text to equal that value. Fake audio pauses resolved immediately and reported already-aligned clocks, so they could not exercise the tracking pause race. No test captured all three cue pixels and dwell times across direct/iframe phone contexts.

## Unknowns

Exact physical Android Web Audio pause latency remains device-specific. Physical confirmation is still required, but no correctness decision now depends on assuming a particular latency.

## Minimal Reproduction

- Start calibration, complete T-pose, and release. At the release/countdown boundary, inspect gameplay and cue together: before repair, gameplay value is 3 while cue text is `Release`.
- While playing, trigger tracking pause with a fake `audio.pause()` promise held pending and a clock 250ms ahead. Complete fresh calibration before resolving pause. Before repair, recovery may enter countdown against the live/misaligned clock.

## Proposed Verification

- Observe exact cue sequence and monotonic timestamps; require 3,2,1 and >=800ms dwell each.
- Screenshot the one cue at DPR1/3, portrait/landscape, direct/real iframe, Aero and bright/dark Camera.
- Hold `audio.pause()` pending across complete recovery calibration; require session to remain `paused_tracking`, no countdown value, then pause and seek exactly to gameplay timeline before countdown begins.
- Require audio to start only after `playing`, current calibrated cursors to remain visible during countdown, renderer >=45fps, CV <=15fps, and no new public media/pixel payload.

## Recommended Fix

Give finite gameplay countdown values priority over cooldown/release copy. For paused tracking/countdown, block gameplay advancement until the audio clock is stopped and exactly matches `session.timelinePositionMs`. Pause asynchronously, then use the audio service’s legitimate seek operation to align the stopped clock to that frozen coordinator timeline. Keep manual pause synchronization behavior separate.

## Debugging Record

```text
Problem: Physical 3-2-1 was absent and tracking-resume countdown could race audio pause.
Observed symptom: Gameplay countdown value 3 while the only cue displayed Release; delayed pause leaves audio playing/misaligned during recovery readiness.
Root cause: transientCue prioritized cooldown over countdown, and assembly advanced paused_tracking/countdown before asynchronous audio pause+seek alignment.
Evidence: Product state/cue boundary capture; delayed-pause test with 250ms mismatch; gameplay countdown_audio_not_frozen invariant.
Failed approaches: Sampling any numeric state, immediate-pause mocks, and assuming DOM state implied painted ordered digits.
Corrective action: Numeric cue precedence; exact stopped-clock gate; pause then seek to coordinator timeline; manual pause remains separate.
Verification test: Ordered >=800ms pixel-proven 3/2/1 in direct/iframe DPR1/3 phone matrices plus delayed recovery pause/seek and full regression suite.
Related files/components: src/index.js; validate-mobile-gameplay-menu.js; validate-product-shell-matrix.js; web-audio seek; gameplay session coordinator.
Remaining uncertainty: Physical Android latency/legibility requires Derrick retest.
```
