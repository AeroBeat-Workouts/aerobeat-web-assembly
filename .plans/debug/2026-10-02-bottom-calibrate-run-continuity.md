# Bottom Calibrate active-Play diagnosis (wm21)

## Exact Observed Failure
Derrick physically observed on the BRIO localhost 5174 preview: fresh T-pose, full countdown, audible advancing Play and body response pass; clicking bottom-row Calibrate at any nonzero song time re-T-poses but resumes at 0:00. Direct observation is the rewind; cleared score is inferred from the code, not measured physically.

## Expected Behavior
Force Calibrate in an active Play run must freeze audio/gameplay at one held position, recover live camera/CV and lease, require a fresh T-pose and full 3/2/1 countdown, and resume that run without clearing judgments, score or generation. A new Start still resets to zero; Visual Test and host reset_calibration keep their prior behavior.

## Execution Path
UI transport emits `visual-test-calibrate` → assembly `handleUiIntent` calls `reset()` → input resets calibration, gameplay coordinator `reset()` clears run truth and timeline → display/audio sync freezes/seeks to zero. Existing browser proof clicks old menu `force-calibrate` during calibration, not nested bottom control during scored Play. The already serialized `forceCalibrate()` → `recoverPlayCamera(true)` acquires camera+audio lease, restores preview/CV and runs frame loop, but currently calls `reset()` and therefore also destroys the run. Coordinator safety on fresh input moves playing/paused_manual to paused_tracking; after fresh calibration it starts full tracking_resume countdown if audio is frozen at held gameplay timeline.

## Most Likely Root Cause
Assembly binds the actual bottom Calibrate to destructive `reset()` rather than run-preserving recovery. Recovery itself also uses destructive `reset()` for forceReset. Coordinator `reset()` and explicit `requestStart` clear run truth, while `synchronizePausedClock` calls `seekTo` and also clears truth; recovery must avoid all three. The paused audio clock must be aligned by `audio.seek(heldSeconds)` directly, not coordinator seek.

## Alternative Hypotheses
1. Audio player spontaneously rewinds: contradicted by deterministic coordinator reset and audio seek to coordinator zero; possible additional defect only if seen after route repair.
2. Lease/CV failure: contradicted by physical fresh T-pose after click; lost lease remains a separate recovery test.
3. Gameplay's tracking_resume skips full countdown: coordinator begins at three and advances full dwell; test required to confirm actual path.

## Why Previous Fixes Failed
Earlier Force recovery repaired camera/lease/CV, but exercised the obsolete menu button in calibration; the bottom control still invoked `reset()`. The physical failure was therefore outside that test's path.

## Unknowns
Precise physical score loss and audio/player rounding after real BRIO recovery are unmeasured. A deterministic browser test should prove score/generation/timeline and audio freeze/alignment/countdown first; Derrick's retest remains necessary.

## Minimal Reproduction
Play real camera song beyond 0:00 and click bottom Calibrate; fresh pose then rewind. Not reproduced via old menu button or a new Start, where zero is expected.

## Proposed Verification
Drive real assembly/coordinator via bottom transport shadow button in browser with fake camera/CV/audio; record nonzero run generation, judged ID/score, timeline, audio pause/seek/play and full countdown, including retained/lost lease and denied retry. This distinguishes destructive reset from audio-only seek or camera loss.

## Recommended Fix
Only active Play bottom Calibrate calls lifecycle-serialized recovery; recovery force-reset clears input calibration without calling gameplay.reset. Freeze coordinator at held timeline without `synchronizePausedClock`, pause/align audio before display advances, then allow existing fresh-input safety to start full tracking_resume countdown. Leave Test and host reset untouched. Regression risks: races with pending transport seeks, menu close, denied camera, audio resume too early and lost lease; test these boundaries.

## Additional verified defect
An active scored Play lost-lease regression initially failed: transferring the lease called assembly `pauseForLease` → `synchronizePausedClock` → gameplay `seekTo`, clearing score and incrementing generation even when transport Calibrate itself was fixed. The deterministic real-coordinator fixture retained timeline 15000 but changed generation 11→12 and erased one scored Miss. Ordinary scored Play pauses (including menu/hidden) shared this helper. Skip that implicit seek for `purpose: play` in `paused_manual`; explicit transport seek still calls gameplay.seekTo and deliberately clears truth. The same nested-button lost-lease regression now retains generation, score and position.

## Additional UI intent inspection
The UI presenter source includes `calibration-reset` buttons in both `AeroCalibrationBadge` and `AeroTrackingPause`. Assembly still instantiated both, but marked both `aria-hidden="true"` and suppressed all `.hud-presenter` with `display:none!important`; they are not presently visible/clickable through the product surface, contrary to the initial read-only characterization. Their event route nevertheless called destructive `reset()` and would rewind scored Play if re-exposed or invoked. Assembly now routes only active Play `calibration-reset` to the same lifecycle-owned force recovery; Visual Test stays on reset, and explicit host `executeCommand('reset_calibration')` stays on reset. The focused browser regression clicks both real nested presenter buttons programmatically, confirms hidden status and scored-run continuity; no UI-owner edit.

## Source validation checkpoint
The focused nested-button browser validator passes with a real scored coordinator Miss at 15s, frozen pose and 3/2/1, no early audio, retained/lost lease, permission denial/retry and explicit fresh Start at zero. Full assembly `npm test` and `npm run test:browser` completed with exit 0, including immutable raw/provenance, real direct/cross-origin iframe pixels and privacy. The final immediate-freeze ordering was then re-run in the focused browser validator and `git diff --check`; the physical BRIO retest and independent QA/audit remain open. No raw build or service change.

```text
Problem: Bottom Calibrate rewinds active scored Play.
Observed symptom: BRIO re-T-pose succeeds, song returns to zero.
Root cause: bottom intent and force recovery call destructive reset(), clearing coordinator run truth and clock.
Evidence: UI intent handler, assembly reset/recovery, coordinator reset/seekTo, physical report.
Failed approaches: prior browser test clicked old menu button only during calibration.
Corrective action: route active Play to serialized run-preserving recovery and freeze/align audio before calibration countdown.
Verification test: nested button mid-run with nonzero judged score, full countdown and retained/lost/denied camera cases.
Related files/components: src/index.js, validate-force-calibration-recovery.js, gameplay/session-coordinator.js.
Remaining uncertainty: physical BRIO alignment/score until Derrick retests.
```
