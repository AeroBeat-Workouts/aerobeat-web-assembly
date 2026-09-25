# Debug: Play-mode pause + calibration countdown when wrists leave the grid

> **STATUS (2026-09-25): FIXED + SHIPPED in immutable raw 0.0.71 (served on 5173). Root cause: spurious camera source-identity change from a transient 0×0 video surface firing `resetCalibration("media_source_changed")`. Fix: `refreshSourceIdentity` (aerobeat-web-video) + `updateCameraIdentity` (assembly) ignore a non-finite aspect when a known identity exists; a sustained real aspect change still resets. Facade + assembly oracles added; full unit suites green. Awaiting Derrick's physical playtest to confirm the pause is gone; if it persists, add a privacy-safe change diagnostic to capture the exact drifting component.**

## Exact Observed Failure

- Derrick, Play mode, raw `0.0.70`: "the game pauses if my wrists leave the grid area and get a calibration countdown." Expected: gameplay continues; markers/equipment/colliders stay active and visible; no pause, no countdown.
- Directly observed: a full `paused_tracking` state followed by a `tracking_resume` countdown (the `aero-resume-countdown` HUD cue). This is a TRUE pause, not the 0.0.60-F4 anchor freeze (which dims frozen markers and keeps scoring live with no countdown).

## Expected Behavior

- The 0.0.63 D1 contract: off-grid / lost tracking must NOT pause. Calibrated mid-run loss enters the anchor freeze (`anchorsFrozen=true`, `gameplayPaused=false`, `freshCalibrationRequired=false`, readiness `countdown`, calibrationId + bounds preserved) so the coordinator's `enforceSafety` stays `safetyReady` and never enters `paused_tracking` (`session-coordinator.js:755,773-791`).
- Off-grid anchors keep staging with finite raw coords (`body-grid-service.js` D1(b), `891ebba`); scoring/colliders continue.

## Execution Path

1. Play frame loop (`index.js:1277-1291`): every display frame calls `graph.video.describeSurface()` → `refreshSourceIdentity()`, then `updateCameraIdentity(surface)`.
2. `updateCameraIdentity` (`index.js:1260-1265`) builds `identity = sourceChangeId|sourceId|mirrored|aspect.toFixed(8)`; on any change it calls `graph.input.resetCalibration("media_source_changed")`.
3. `resetCalibration` (`body-grid-service.js:1028-1035`) sets `trackingPaused=true` + `invalidateCalibration(reason)` → `freshCalibrationRequired=true`, readiness `calibration_required`.
4. Coordinator `enforceSafety` (`session-coordinator.js:773-804`): `safetyReady` becomes false → `enterTrackingPause()` → state `paused_tracking` (pauseReason `tracking_lost_recalibration_required`).
5. On recovery, `enforceSafety` fires `beginCountdown("tracking_resume")` → the 3-2-1 calibration countdown Derrick sees.

## Most Likely Root Cause

A **spurious camera source-identity change** from a transient `0×0` video surface. For a live camera `sourceId` (`aero.mediapipe.live`) and `mirrored` (`true`) are stable, so the only drifting component is the **aspect ratio**. During a stream renegotiation (plausibly triggered by large Flow swings / wrists leaving the grid), the `<video>` element briefly reports `videoWidth/videoHeight = 0`. `positiveNumberOrUndefined(0)` → `undefined`, so the aspect flips to `"unknown"` (assembly `toFixed(8)`) and `"aspect-unknown"` (facade `toFixed(6)` signature) and then back. That increments the facade `sourceChangeId` and changes the assembly identity, firing `resetCalibration("media_source_changed")` → the full pause + `tracking_resume` countdown.

Evidence:
- The ONLY in-play path to a true pause + countdown is the source-identity change (`index.js:1264` `resetCalibration`; `body-grid-service.js:490-494` `invalidateCalibration("source_changed")`). The F4 freeze path keeps all pause flags false and is oracle-covered (`aerobeat-web-input/scripts/validate-midrun-confidence-freeze.js`).
- The assembly identity uses `aspect.toFixed(8)` while the facade signature uses `toFixed(6)` — the assembly is strictly more sensitive to aspect drift.
- `refreshSourceIdentity` (`browser-video-facade.js:293-304`) and `updateCameraIdentity` (`index.js:1260-1265`) both treat a non-finite aspect as a distinct identity (`"unknown"`), so a `0×0` transient is indistinguishable from a real aspect change.

## Alternative Hypotheses

1. **Genuine resolution change** (16:9 → 4:3): would also change the aspect and correctly invalidate the bounds. Less likely given the tight correlation with motion and no reported camera settings change. The fix below tolerates `0×0` transients but still honors a sustained real aspect change.
2. **F4 freeze misfiring as a pause**: rejected — the freeze keeps `trackingPaused`/`freshCalibrationRequired` false and the coordinator stays `safetyReady`; it produces dimmed frozen markers, not a pause + countdown.
3. **Uncalibrated loss / manual reset / destroy**: not applicable mid-song with an active calibration.

## Why Previous Fixes Failed

- 0.0.63 D1 fixed the off-grid staging (anchors stay valid) and the F4 freeze (calibrated loss → freeze, not pause). It explicitly left the **source-identity change** as the one remaining in-play pause path and recorded an open question: "confirm with Derrick what his pause looked like (camera preview = source-change path; dimmed frozen markers = F4 freeze) before coding any source-stability change." Derrick has now confirmed the camera-preview/full-pause signature, so the source-identity path is the live defect. No source-stability change was ever made.

## Unknowns

- The exact renegotiation trigger on Derrick's hardware (which component drifts and by how much) is not directly observed. The `0×0` transient is the leading mechanism; a temporary, privacy-safe diagnostic (log prior/new identity + `videoWidth`×`videoHeight` on a detected change) would confirm it on the next playtest if the tolerance fix alone does not stop the pause.

## Minimal Reproduction

- Play mode, calibrated, mid-song: cause the live camera stream to renegotiate (large motion / wrists leaving the grid) so the `<video>` briefly reports `0×0`. The identity flips to `"unknown"` and back → `resetCalibration("media_source_changed")` → `paused_tracking` → `tracking_resume` countdown.
- Does NOT occur: steady-state tracking, off-grid staging with a stable `16:9` surface, or the F4 freeze (confidence loss with a stable surface).

## Proposed Verification

- Add a focused video-facade oracle: attach a stream, force `videoWidth/videoHeight = 0` (metadata gap), assert `sourceChangeId` does NOT advance and the signature is unchanged; then restore real dimensions and assert a single, correct advance only on a genuine aspect change.
- Add an assembly oracle: `updateCameraIdentity` with a non-finite `sourceAspectRatio` after a known identity must NOT call `resetCalibration`; a sustained real aspect change MUST.
- Rerun the equipment/camera-focused gates + `npm test` + the relevant browser gates.

## Recommended Fix

Smallest root-cause fix in two places, both ignoring a `0×0` (no-intrinsic-dimensions) transient while preserving a genuine sustained aspect change:
1. `aerobeat-web-video/src/browser-video-facade.js` `refreshSourceIdentity`: when the aspect is non-finite and a signature is already known, skip the update (do not advance `sourceChangeId`).
2. `aerobeat-web-assembly/src/index.js` `updateCameraIdentity`: when `sourceAspectRatio` is non-finite and a last identity is known, skip the update (do not call `resetCalibration`).

This stops the spurious `0×0`-driven `media_source_changed` reset while still invalidating calibration on a real, sustained geometry change.

## Debugging Record

```text
Problem: Play pauses + tracking_resume countdown when wrists leave the grid (raw 0.0.70).
Observed symptom: full paused_tracking + calibration countdown; not the F4 dimmed freeze.
Root cause: spurious camera source-identity change from a transient 0×0 video surface (aspect flips to "unknown" and back) firing resetCalibration("media_source_changed").
Evidence: only in-play true-pause path is source-identity; sourceId/mirrored stable; assembly toFixed(8) stricter than facade toFixed(6); positiveNumberOrUndefined(0)→undefined; 0.0.63 open question now confirmed by Derrick.
Failed approaches: 0.0.63 D1 (off-grid staging + F4 freeze) is sound and oracle-covered; it never addressed the source-identity path.
Corrective action: ignore 0×0 transients in refreshSourceIdentity (video facade) + updateCameraIdentity (assembly); keep honoring sustained real aspect changes.
Verification test: new facade + assembly oracles for 0×0 transient (no advance / no reset) and genuine aspect change (single advance / reset); rerun focused + full gates.
Related files/components: aerobeat-web-video/src/browser-video-facade.js (refreshSourceIdentity, describeSurface); aerobeat-web-assembly/src/index.js (updateCameraIdentity, runDisplayFrame); aerobeat-web-input/src/body-grid-service.js (resetCalibration, invalidateCalibration, F4 freeze); aerobeat-web-gameplay/src/session-coordinator.js (enforceSafety, enterTrackingPause, beginCountdown).
Remaining uncertainty: exact renegotiation trigger on Derrick's hardware; add a privacy-safe change diagnostic if the tolerance fix alone does not stop the pause.
```
