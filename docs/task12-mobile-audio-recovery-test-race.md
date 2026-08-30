# Task 12 — Mobile recovery audio-alignment test race

## Exact Observed Failure

A full `npm run test:browser` run failed in `validate-mobile-gameplay-menu.js`:

```text
recovery must seek frozen audio to the coordinator timeline before restart
{"sessionState":"playing","audioPositionSeconds":0.25,"audioSeekCalls":0,...}
```

The same focused test had previously passed.

## Expected Behavior

The recovery test must deterministically create a paused gameplay timeline/audio-clock mismatch, then prove assembly pauses and seeks audio to the frozen gameplay position before the 3-2-1 restart.

## Execution Path

The fixture set `delayNextPause=true` and `audioPositionSeconds=.25` before pushing tracking-loss poses. The display rAF loop could advance the playing coordinator once with the synthetic `.25` audio clock before tracking loss transitioned to `paused_tracking`. If that happened, the coordinator froze at 250ms. After delayed pause resolved, audio was also at 250ms, so `audioClockAlignedWithGameplay()` correctly skipped `seek()`. The assertion nevertheless required a seek to 0.

## Most Likely Root Cause

The test mutated the audio clock before the gameplay timeline froze. Frame scheduling therefore decided whether the intended mismatch existed. Production synchronization behaved correctly for the observed aligned clock.

## Alternative Hypotheses

- Production skipped a required seek despite mismatch: contradicted by the observed 250ms audio position and scheduling window; the test did not capture frozen timeline in its failure payload.
- Content collection changes altered audio sync: no causal path; the failure is in the existing synthetic tracking-recovery phase.

## Why Previous Runs Differed

Focused and earlier browser runs happened to process tracking loss before a display frame consumed the synthetic `.25` clock, leaving the coordinator at 0 and forcing a seek. The full run scheduled one rAF first.

## Unknowns

The failure payload does not expose the frozen gameplay timeline, but code and timing fully explain the two outcomes. Add it to future diagnostics if needed.

## Minimal Reproduction

Set synthetic audio position before pushing tracking-loss poses; allow one rAF before pause. The coordinator and audio both freeze at 250ms and no seek is needed.

## Proposed Verification

Set only `delayNextPause` before tracking loss. Wait for `paused_tracking` and the delayed pause resolver. Then mutate synthetic audio position to `.25`, resolve pause, and verify a seek to the already-frozen 0ms coordinator timeline occurs before countdown/play.

## Recommended Fix

Move the synthetic `.25` audio mutation until after `paused_tracking` and pending pause are observed. This changes only the test harness and deterministically establishes the mismatch it claims to verify.

## Debugging Record

```text
Problem: Recovery seek browser assertion is scheduling-dependent.
Observed symptom: playing resumes at synthetic .25 with zero seek calls in one full suite run.
Root cause: Test changed audio clock before coordinator timeline froze, allowing rAF to align both at 250ms.
Evidence: audio .25, seek0, production equality guard; focused runs previously passed.
Failed approaches: Timing luck in focused runs masked the race.
Corrective action: Mutate audio to .25 only after paused_tracking/pending pause is established.
Verification test: Repeated mobile test and full browser suite require seek>=1 and position0.
Related files/components: scripts/validate-mobile-gameplay-menu.js; syncAudioForGameplay/pauseAudioForGameplay.
Remaining uncertainty: None material after deterministic mismatch setup.
```
