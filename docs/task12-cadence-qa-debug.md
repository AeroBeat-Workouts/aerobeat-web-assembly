# Task 12 Cadence QA Debug Record

## Exact Observed Failure

At pushed cadence implementation `6605067`, `npm run test:browser` passed the mobile/menu, preview, and four-context product-shell matrices, then intermittently failed `validate-camera-compositor-pixels.js:69`:

```text
Error: Aero must restore opaque projection without camera reacquire:
{"mode":"aero","preview":"true","background":"#00000000","sameStream":true}
```

Five focused attempts reproduced a pass followed by the same failure. The retained stream remained identical and the selected mode was Aero.

A separate source audit found a tracking-recovery audio race: gameplay can enter its recovery countdown before an asynchronous audio pause has completed, allowing the next countdown advance to observe a still-playing clock and pause with `countdown_audio_not_frozen`. This adjacent countdown issue was not newly introduced by the rAF scheduler, but rAF makes the window easier to exercise.

## Expected Behavior

- Aero is opaque only when camera preview is not force-required.
- Initial/recovery calibration and tracking loss intentionally force the mirrored camera preview even when Aero is selected.
- A tracking-resume countdown must not advance until audio is truthfully frozen.
- Cadence QA must distinguish compositor choice from calibration safety state rather than expecting Aero to hide a safety-required preview.

## Execution Path

1. The pixel test completes calibration/countdown and selects Camera.
2. It pauses/resumes, then simulates document hidden/visible.
3. The assembly display loop continues freshness checks; the test supplies pose samples directly to input instead of through `cv.getLatestPoseFrame()`, so assembly has no current CV frame/freshness timestamp.
4. Depending on timing, input becomes stale and gameplay enters `paused_tracking` or fresh-calibration-required recovery.
5. `cameraPreviewForced()` returns true for that state.
6. Selecting Aero sets `environmentMode="aero"`, but `syncCameraPresentation()` correctly keeps preview visible and renderer transparent because safety preview overrides environment.
7. The test asserts unconditional opaque Aero and intermittently fails.

For the adjacent audio race:

1. While playing, tracking loss changes gameplay to `paused_tracking`.
2. `syncAudioForGameplay()` starts asynchronous `audio.pause()` and marks `audioSyncPending`.
3. Fresh calibration can make gameplay begin a tracking-resume countdown before that promise settles.
4. The display loop’s `awaitingAudioStart` guard applies only to `playing`, not `countdown` awaiting audio pause.
5. A countdown advance can therefore receive `clock.playing=true`; the gameplay coordinator correctly rejects it as `countdown_audio_not_frozen`.

## Most Likely Root Cause

The pixel failure is a validation-state bug, not an Aero compositor defect: `mode=aero` plus `preview=true` can only result from `cameraPreviewForced()` when retained/visible, and forced recovery preview is required product behavior. The test bypasses the CV path while the production display lane truthfully advances stale-input safety, making the old unconditional assertion timing-dependent.

The audio finding is a pre-existing asynchronous synchronization gap adjacent to countdown presentation. The new display cadence does not create the promise/state ordering, though its higher tick rate reduces time between state transitions. It belongs to countdown P0 `aerobeat-web-assembly-1fl`, not to a relaxation of tracking safety or rAF cadence.

## Alternative Hypotheses

1. **Aero click handler failed:** contradicted by `mode:"aero"`.
2. **Camera projection cache stayed stale:** contradicted by the visibility predicate; projection remains transparent only because computed visibility remains true.
3. **A new stream was acquired:** contradicted by `sameStream:true`.
4. **rAF loop failed to run:** contradicted by prior sustained product-shell cadence proof and the synchronous environment-mode update.

## Why Previous Validation Failed

The test treated Camera/Aero as an unconditional visibility switch but did not inspect session safety. Earlier low-cadence timing often reached the assertion before stale tracking took effect, so the incorrect expectation appeared stable. Directly injecting future-timestamp input samples also bypassed assembly’s one-fresh-CV-frame accounting.

Synthetic shell audio pauses resolve immediately, so existing recovery tests cannot exercise an in-flight audio pause during fresh calibration.

## Unknowns

- Exact Android Web Audio pause latency distribution.
- Whether the original physical countdown failure encountered the audio race.
- Whether phone inference latency reaches the 500ms tracking threshold; safety must not be weakened without evidence.

## Minimal Reproduction

Run `node scripts/validate-camera-compositor-pixels.js` repeatedly at `6605067`; it alternates between pass and the line-69 Aero assertion. The failure occurs only when safety has forced recovery preview before the final Aero selection.

## Proposed Verification

- Change the pixel validator to branch on truthful gameplay safety: if recovery is required, assert that Aero still shows the forced preview; then provide fresh calibration and prove Aero becomes opaque without camera reacquisition.
- Add a delayed-pause recovery test under countdown P0 `1fl`: keep `audio.pause()` pending across fresh calibration, prove countdown cannot advance on a playing clock, and ensure it resumes only after frozen audio.

## Recommended Fix

For cadence QA, fix only the validator’s invalid assumption and retain the production compositor/safety behavior. Do not hide camera during recovery and do not weaken the 500ms freshness contract.

Record the delayed-pause race on Bead `1fl` for countdown-specific repair and deterministic testing.

## Debugging Record

```text
Problem: Cadence browser QA intermittently expects opaque Aero during a safety-required recovery preview; tracking-resume countdown can also race asynchronous audio pause.
Observed symptom: mode=aero, preview=true, transparent renderer, same retained stream; focused test is intermittent.
Root cause: Pixel test bypasses CV freshness and ignores cameraPreviewForced recovery semantics. Separate existing audio-sync gap allows countdown before pause completion.
Evidence: Failure tuple excludes click/stream defects; syncCameraPresentation predicate; repeated pass/fail; async pause/countdown source ordering.
Failed approaches: Unconditional final Aero assertion and immediate-pause synthetic recovery tests.
Corrective action: Make compositor pixel test safety-aware and recalibrate before asserting opaque Aero; track delayed-pause countdown work in 1fl.
Verification test: Repeated pixel matrix plus full browser suite; delayed-pause recovery test in countdown P0.
Related files/components: scripts/validate-camera-compositor-pixels.js, src/index.js cameraPreviewForced/syncCameraPresentation/syncAudioForGameplay/runDisplayFrame, gameplay session coordinator.
Remaining uncertainty: Physical audio pause/CV latency and whether either contributed to Derrick’s missing countdown.
```
