# Calibration checklist flicker: diagnosis and proposed fix

Status: diagnosis complete. Derrick approved the fix and a new public build; implementation and 0.0.152 verification in progress.

## Approved execution

Goal: goal-f0c96883-9745-49ad-b845-2bc5cc45b9a7. Source plan: ../aerobeat-web-input/.plans/2026-10-29-calibration-idle-gap-fix.md.

- Source implementation complete and pushed: input 18b5e24887fc3b54680816445165b1ecd8899d78, tree 7d502f3124d6a09ea3bdb0cd91d1f583d9c92845. Preserve last measured checklist/visibility and calibration hold across ordinary gaps shorter than existing 750 ms timeout. New actual missing/low-confidence results and true timeout still invalidate immediately as appropriate. Do not fabricate measurements or change model, thresholds, loss hysteresis, frozen publication or spline scoring.
- Input coder 20865026-b312-4d4f-99c6-e88092b9c899 verified running as direct child. Single bounded input-source task plus tests/docs/commit/push; parent owns assembly UI regression and release. No other implementation delegate.
- Source product check passes: test:slow-calibration covers controlled 4 FPS stable poses through the real assembly display loop. Knee-required Boxing, knee-disabled Boxing and Flow each consumed 9 measured samples, ran 16 real no-new-result ticks and committed the genuine hold into countdown; maximum sample gap was 274–279 ms. Visible rows stayed Seen. Actual missing/low-confidence results and >750 ms silence still displayed Missing/reset. Signed repetition is next.
- Input coder delivered exactly source guard, regressions, README and source plan, with clean pushed state. npm check, npm test, Chromium module smoke, npm pack --dry-run and diff checks pass. Existing tracking/frozen/source/reset tests remain green. Source countercheck failed on the expected cleared-checklist timestamp before the fix. Coder has finished with all jobs collected.
- Add the focused browser regression to the normal browser command and run it against the actual signed bundle. Preserve approved checklist layout/copy; this is a state fix, not a UI redesign.
- Repin final clean input commit, bump release to 0.0.152, build from clean candidate, verify signed calibration flow and public direct/iframe readiness before/after cutover. Retain active 0.0.151 on 4214 for rollback; next free port expected 4215.
- Update affected READMEs and plan results, close dvay after verification, commit/push intentional changes only. Preserve unrelated ledger/screenshots and deferred custom-wall task igiw.

## Historical investigation
Bug: **aerobeat-web-assembly-dvay** (P1, open).
Owners: input for landmark/calibration state; assembly for display pacing and integration.
Current shipped build: 0.0.151. No runtime code, model, thresholds or published bundle changed during this investigation.

## Conclusion and next step

There is a demonstrated application bug sufficient to cause the reported flicker even with perfectly stable landmark results. After 100 ms without a new completed pose, assembly calls input.advanceTime. That function clears the checklist instead of distinguishing an inference still in progress from an actual missing-landmark result. A later good result sets the checklist back to Seen. Knee-required calibration also loses its hold progress on every such idle tick.

Recommend fixing this state handling first, preserving the actual tracking-loss timeout and measured-only calibration. Do not initially lower confidence thresholds or upgrade MediaPipe. If individual rows still chatter after this fix, inspect raw visibility near the existing 0.5 cutoff before deciding on additional smoothing.

## Exact observed failure

Derrick's phone shows individual body landmarks repeatedly switching between Missing and Seen in good lighting. The camera preview appears smooth. Pose inference is known to be slow on that phone. No recording of that phone's raw MediaPipe output was available in this investigation.

Confirmed independently against the actual public 0.0.151 bundle: identical confidence-0.99 poses at 4 FPS produce nine Seen joints at every measured update. Calling the existing no-frame path 100 ms after each update changes all nine to Missing. Repeating this for three seconds prevents knee-required calibration from committing. The control with the same measurements but without those idle ticks commits calibration at two seconds.

## Expected behavior

No new inference result yet is not the same observation as a new result reporting absent joints. Normal inference gaps should not repeatedly erase the last measured checklist or restart calibration. Actual missing/low-confidence measurements and a genuine prolonged timeout must still be handled honestly.

## Execution path

1. Assembly src/production-cv-service.js: target submission rate is at most 15 FPS; one estimate may be in flight, and busy submissions are skipped. Completed normalized results remain available through getLatestPoseFrame. This service does not publish a fabricated empty result for every display tick.
2. MediaPipe runs synchronous detectForVideo in a dedicated CPU/WASM worker. Source timestamps survive normalization; internal inference timestamps are forced strictly increasing. Raw camera video can continue smoothly while that worker produces fewer pose results.
3. Assembly src/index.js:1999–2014 consumes a new pose when its timestamp changes. Otherwise, after 100 ms since the last consumed result, it calls input.advanceTime at up to 15 Hz.
4. Input src/body-grid-service.js:1087–1100 unconditionally sets allRequiredAnchorsVisible false and calibrationChecklist to calibrationStatus(null,...). When knees are required it also clears holdStartedAt and holdFrames.
5. A new measured frame restores calibrationStatus from its measured landmarks at body-grid-service.js:559–560.
6. Assembly src/index.js:4033–4072 writes Seen/Missing directly from those booleans. There is no separate pending-result state.

## Root cause and alternatives

**Confirmed, high likelihood and impact:** normal inter-result gaps are treated as missing landmarks at 100 ms. This explains a cycle of Seen after a result, Missing while waiting, Seen after the next result. It can also prevent knee calibration indefinitely. The existing actual tracking-loss threshold is 750 ms, not 100 ms; those are different paths.

**Secondary possible contributor:** the per-joint checklist is an immediate confidence >=0.5 decision, with no display hysteresis. Vendor normalization maps landmark visibility to confidence, using presence only if visibility is absent. A joint alternating around 0.5 will toggle individually. This was established from code, not from captured phone scores.

**Possible model/input uncertainty:** real MediaPipe results can omit a pose or vary in visibility due to pose, occlusion, framing and motion, even with good lighting. Smooth preview does not prove stable landmark inference.

**Upstream SDK bug:** historical jitter and visibility bugs exist, but no confirmed issue matching our exact pinned Tasks Vision 1.0.1 / Lite float16 /1/ CPU-WASM configuration and this checklist symptom was found. It is unnecessary to assume one to explain the demonstrated local defect.

## Online findings

- Official Web guide: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js — inference is synchronous; a worker isolates it from the preview/UI. Visibility is an estimated likelihood, not ground-truth joint presence.
- JS API: https://ai.google.dev/edge/api/mediapipe/js/tasks-vision.poselandmarker — VIDEO calls take millisecond frame timestamps. No timestamp rollback was found in our worker path; this was not a phone timing trace.
- Empty-result report: https://github.com/google-ai-edge/mediapipe/issues/4946 — maintainers explain detection is not guaranteed on every frame. An actual empty result differs from no completed inference.
- Historical jitter: https://github.com/google-ai-edge/mediapipe/issues/4507 — old 0.10.x reports/fixes concern positional jitter, not proof that our pinned runtime causes this Seen/Missing cycle.
- Visibility-model issue: https://github.com/google-ai-edge/mediapipe/issues/5197 — implausibly high visibility on occluded joints; opposite of the specific missing-state symptom.

## Reproduction and verification

Used fresh Playwright pages on the public HTTPS 0.0.151 app and its real graph.input service. No replacement service or copied calibration algorithm was used. Injected nine identical normalized landmarks (seven T-pose anchors plus both knees), all confidence 0.99, every 250 ms. This is a controlled downstream diagnostic, not physical-phone or raw-camera acceptance.

- Control: 13 measured samples, no advanceTime calls. Nine visible joints throughout; calibrationId becomes non-null at sample 8 (2000 ms), entering the normal cooldown.
- Suspected path: same 13 samples, each followed by advanceTime(measurementTimestamp+100). Every measured snapshot has nine visible joints; every idle snapshot has zero. Hold remains zero and no calibrationId is committed.
- Initial probe incorrectly asserted the control state label would be calibrated immediately. It actually enters cooldown after committing; the corrected assertion checks calibrationId. This was a probe assertion correction, not a product failure or code fix.

The assembly timer branch was traced in source; this probe manually invoked that existing branch's input call. It did not run real camera inference or capture the user's exact phone frames.

## Proposed fix and acceptance (awaiting approval)

1. Distinguish a pending/no-new-result interval from a newly measured missing/low-confidence result and a genuine stale timeout.
2. Preserve the last real checklist through ordinary inference gaps without fabricating new measurement timestamps or hold samples. Do not merely mask the DOM flicker: knee hold state must remain consistent too.
3. Preserve existing tracking-loss safety, source/reset behavior, frozen-equipment publication and measured-only calibration. Do not simply stop advanceTime or globally delay its gameplay clock: it also supports the shipped sparse-input scoring path. Retain truthful Missing on actual failed measurements and genuine timeout.
4. Add regression coverage at realistic slow result rates, through assembly's real display loop, with and without knee-required calibration. Exercise actual missing landmarks, low confidence, long silence and source changes.
5. Verify the corrected signed calibration screen, then have Derrick repeat the phone check. Update affected input/assembly README behavior, commit/push and repin normally if a release is approved.

No new developer UI, model switch, blanket confidence reduction or unrelated pipeline redesign is proposed.

## Debugging record

Problem: calibration landmarks flash Seen/Missing while the video preview remains smooth.
Observed symptom: nine good landmarks become all false on no-frame ticks; knee hold is repeatedly erased.
Root cause: 100 ms no-new-result policy calls advanceTime, which treats the gap as absent measured landmarks.
Evidence: source trace plus controlled replay through the shipped 0.0.151 input service and passing no-idle control.
Failed approaches: no product fix attempted; one diagnostic assertion corrected for the normal cooldown state.
Corrective action: proposed separation of pending results from actual failure/timeout; not implemented.
Verification test: real assembly cadence, slow stable results, knee/on/off calibration and honest missing/timeout handling.
Related files/components: assembly src/index.js and src/production-cv-service.js; input src/body-grid-service.js; MediaPipe normalizers.
Remaining uncertainty: raw per-joint phone visibility, actual inference durations and whether threshold chatter also contributes.
