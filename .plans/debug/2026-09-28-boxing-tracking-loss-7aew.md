# Bead 7aew — Boxing tracking-loss diagnosis

## Exact observed failure
Derrick reports that Boxing enters `paused_tracking` during fast punches while music continues and beats later jump; Flow reportedly freezes markers but keeps playing. This is a physical observation, not yet captured with a matching input snapshot or served-bundle version. An instrumented in-repo calibrated-loss oracle instead produced `playing` in **both** Flow and Boxing, with both timelines following the audio clock.

## Expected behavior
After calibration, ordinary confidence or no-frame tracking loss should retain last-good anchors, publish frozen evidence, and keep both modes' gameplay timeline driven by the live audio position. Source changes and explicit menu/reset recalibration must still pause for safety. The 0.0.73 mid-game T-pose guard must remain intact.

## Execution path
Assembly `src/index.js:1293-1327` feeds the same `graph.input.getSnapshot()` to the coordinator for both modes. It branches on ruleset only to build the two mode-specific equipment poses (`:1621-1633`), sharing the same frozen anchors and clock. Input `src/body-grid-service.js:411-425` freezes when bounds and held evidence exist, and `:389-400` publishes `provenance:"frozen"`. The coordinator `src/session-coordinator.js:727-780` pauses only if input readiness/flags fail; both collider branches at `:1156-1218` and `:1319-1394` use frozen evidence and current song time via `measuredColliderSample`. Assembly `:1234-1259` stops/seeks audio only when the session stops playing.

## Most likely root cause
**Not reproduced for ordinary calibrated loss.** There is no Boxing-only pause branch in the inspected source; the tested Boxing path stays playing. To identify a true `paused_tracking`, capture input `calibration.readiness`, `tracking.gameplayPaused`, `tracking.freshCalibrationRequired`, `tracking.anchorsFrozen`, `calibration.calibrationId`, `sourceIdentity`, and `session.pauseReason` on the first pause. A changed camera/source identity (`index.js:1267-1275`, input `body-grid-service.js:493-502`) or a separate calibration invalidation will force the common pause path. A separate audio/gameplay divergence can result when the assembly's advance throws (e.g. stale or missing poses) and its per-frame catch at `index.js:1332-1340` reports the error but skips advancing gameplay while audio continues.

## Alternative hypotheses (ranked)
1. A live source identity or calibration invalidation: plausible common-path pause, but cannot explain a mode-only effect without a mode-correlated camera/gesture difference; 0×0 transient and healthy mid-game T-pose were separately fixed before this Bead.
2. A per-frame coordinator throw during an intermediate low-confidence window: concrete reproducible `equipment_poses_invalid` when the assembly supplies zero poses but the session/audio remain active and safety is still ready. This freezes gameplay time with music advancing, but **does not enter `paused_tracking`**, so it only explains the reported audio jump, not the reported state.
3. Boxing-specific judgement: rejected as pause origin. Both handlers finalize events without assigning `paused_tracking`; existing gameplay F4 unit tests already prove both consume frozen evidence and keep playing.

## Why previous fixes failed
F4 addressed calibrated confidence loss, not other invalidation sources or gaps between healthy and frozen frames. The 0.0.73 gate fixed healthy active-play T-pose refires; it does not and must not disable recovery/initial recalibration. No fix for the present Bead had yet been attempted.

## Unknowns
No first-pausing-frame input telemetry or served build identity accompanies the physical Boxing report. A live capture (or a reproduction that enters `paused_tracking` in Boxing but not Flow from equivalent input) would disambiguate source reset, generation change, unexpected input readiness, lease, or other external effects.

## Minimal reproduction
`node scripts/validate-boxing-tracking-freeze.js` in the assembly repo calibrates a real input service, enters `playing` for each production collider ruleset, submits a low-confidence frame after an 800 ms measured gap, then no-frame ticks and a recovering good frame. Both modes stay `playing`, keep frozen anchors, and follow the advancing audio clock. Separately, a low-confidence pre-freeze frame can cause assembly to omit equipment poses and the coordinator to throw `equipment_poses_invalid` in both modes; it is not a pause.

## Proposed verification
Add a failure-before oracle only after reproducing the Boxing-only first-pausing input snapshot. Distinguish true `paused_tracking` from the audio-advanced coordinator-throw signature, and compare identical loss samples for both modes. If the pause is attributable to camera identity, prove a legitimate source change still invalidates calibration.

## Recommended fix
Do **not** bypass coordinator safety or suppress Boxing pauses speculatively. Preserve the focused cross-mode oracle and obtain a first-pausing-frame capture; if the intermediate pose omission is the actual issue, fix the assembly/coordinator frame-admission mismatch for **both** collider modes separately without relaxing calibration safety.

## Debugging record
```text
Problem: Boxing reported to pause on lost tracking while Flow does not.
Observed symptom: physical report of paused_tracking/music continuation; local matched calibrated-loss oracle keeps both playing.
Root cause: undetermined without first-pausing-frame input/clock/error snapshot.
Evidence: input freeze and coordinator safety are mode-independent; both frozen judgement paths covered; integrated oracle passes both.
Failed approaches: F4 excludes only calibrated loss; 0.0.73 excludes only active healthy T-pose recalibration.
Corrective action: record first-pausing-frame telemetry; do not weaken safety or guess mode gate.
Verification test: integrated real input + coordinator Flow/Boxing calibrated-loss oracle, plus physical replay/capture.
Related files/components: assembly index.js, input body-grid-service.js, gameplay session-coordinator.js, assembly gameplay-equipment-records.js.
Remaining uncertainty: which input/lease/source state occurs on Derrick's physical Boxing pause.
```
