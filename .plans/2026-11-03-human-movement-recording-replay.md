# Record human Play movement and replay it in Test

Status: APPROVED, TEST LOADER/PLAYBACK SLICE ACTIVE. Derrick selected “Add recording and replay first” in native question next_delivery. The numeric recording and Test Load Recording control are approved before publishing the gameplay fix. Both public A/B builds stay unchanged during implementation.
Owner: Pico. Feature Bead: aerobeat-web-assembly-1fnl.

## Current action

Capture/export is implemented in assembly 1abb81d with input 374de74. Full assembly tests pass. The actual signed Play download contains 80 measured frames and 51 actual advances, all 13 available named markers, exact calibration/model mapping and equipment, unchanged judgement and run-locked settings. Capture observes each real advance once. Saved synthetic fixture: `.tmp/movement-capture-built-fixture.json` (520486 bytes; not human data).

Reader e25f566 passes 7 focused / 20 combined tests and parses all 51 actual saved ticks without changing any numbers. Gameplay a4ba863 adds the explicit non-ranked recorded-Play temporal context; parent inspected its small production diff and independently passed its focused Flow/Boxing/epoch/admission checks. Source full tests pass; parent handles pins/push.

Test UI/playback is implemented under us3e in 0985418: native Load/Clear control and recorded-input status, local settings, all ticks/observations, body-pivot projection, existing pause/restart/seek and current audio-only Test lease. Source checks/controller 6/6 and combined 26/26 pass. Two old static syntax oracles caught normal-Test branch-shape changes; production structure was corrected and the original gates left untouched. All tail checks pass, but final monolithic npm test remains to run. Child had one unknown native/empty-closing failure; resumed the same verified ID idempotently, preserved all partial work and collected all jobs. No replacement worker or skipped gate.

Next acceptance is actual Play -> Download Data -> native Test Load Recording -> real Test scoring, with recorded markers/equipment and expected results, plus positive reversal, >180 ms late contact and strict negative controls. The exact next commands are the signed capture validator with AEROBEAT_AB_TEST_REPLAY=1 and the direction validator with AEROBEAT_DIRECTION_TEST_REPLAY=1, RECORDING_DIR and INCLUDE_LATE=1 after a clean signed rebuild. No public build changes yet. Source helpers alone are not replay acceptance.

Keep measured samples once, deduplicate immutable input/equipment/configuration snapshots, and store compact tick references so real input gaps and display cadence remain reproducible without repeating full snapshots at display FPS. Capture is bounded and observational; failure/truncation must be explicit and must not affect gameplay. Native goal-text editing was denied on the automatic turn, so this approved plan and the task-list mirror carry the updated supporting slice; the same original goal remains active.

## Outcome

Keep **Download Data** at the top of the menu. Its file should let us replay the same human movement against different game builds, instead of asking Derrick to repeat a performance or guessing movement from hit counts.

The current files contain judgements/settings only. They cannot recover the missing movement or calibration after the fact.

## Proposed experience

1. Start Play normally. Recording starts automatically with session preparation, including calibration, and observes existing input without changing scoring or asking for extra camera work.
2. Finish the run and press the same Download Data button. It downloads one numeric recording with the results. No video, camera images or microphone/song-audio recording; no automatic upload.
3. In **Test only**, add **Load Recording** and a clearly labeled **Recorded input** state. Reuse existing Test playback/pause/restart/seek controls where they fit. Do not add another HUD or a separate developer screen.
4. Replay shows the recorded markers and runs the real scoring path against the matching downloaded song/chart. It is visibly a replay, never live-camera or ranked Play evidence. Missing/mismatched content is reported rather than silently changing the chart.

## Data required

- Measured frame ID and monotonic timestamp; song/audio-clock alignment; fresh, held, missing and tracking-loss transitions. Record each actual measured frame once, without inventing intermediate camera measurements.
- Raw normalized landmark positions, confidence/visibility, including nose, wrists, elbows, shoulders, knees and the supporting hip/ankle landmarks used by calibration. Preserve the coordinate-space definition, source dimensions/aspect, crop/fit and mirroring.
- Calibration lifecycle and numerical model: bounds, source identity/aspect, grids, shoulder baseline, nose baseline and the thresholds/tuning needed to interpret the markers. Include recalibration changes, not just the last calibration ID.
- Derived marker/evidence snapshots and resolved equipment poses at the scoring boundary. This allows comparison of raw tracking, calibration mapping, blade orientation and the final judge without confusing those stages.
- Actual run-locked Game Setup and equipment configuration/identity; chart/source hashes, difficulty, variant/modifiers, build identity, and expected judgements.
- Compact arrays and explicit completeness status. A recording limit may stop observation with a clear incomplete flag, never pause or modify gameplay.

## Owning boundaries and first implementation check

Assembly already sees the raw pose, accepted input and resolved equipment at frame advancement; use that existing seam, not a second CV pipeline. Input snapshots expose calibration bounds, grids, anchors and calibrated shoulder height, but the nose baseline is private. The input owner must provide a narrow read-only calibration export or sufficient calibration frames; do not pretend the existing calibration ID/bounds alone are enough.

Inspect existing Test-source contracts before implementing replay. Preserve original timestamp spacing, idle periods and calibration boundaries. Do not restore old media leases, forge camera provenance, assign arbitrary trusted snapshots, or relax live admission gates.

There is an observed comparison trap: Play permits the existing 1000 ms late deadline, while ordinary Test uses the base timing window (180 ms in these runs). The old human capture contains valid hits later than 180 ms. A replay comparison must explicitly reproduce the recorded Play rules in the non-ranked Test environment, rather than label Test's different defaults a regression. Do not make recorded files eligible for live/ranked scoring to solve this.

## Owners and continuation

- Parent Pico owns integration review, source pins, commits/pushes and actual signed acceptance/publication decisions.
- Coder f2e79c08-0a57-4d34-bd1e-9a04cae662cf, verified direct child, completed 4zvi (input model), bg6v (file reader), kit4 (explicit Test rules); next us3e owns assembly Test UI/playback. Existing QA child remains idle; no serial audit chain.
- Preserve actual `visual_test`/non-ranked purpose. Import data through a fresh explicit Test namespace/epoch and current audio-only lease; never restore old camera IDs/leases or pretend the recording is live input.
- Reuse the real coordinator and recorded full endpoints. Use recorded body shoulders for Flow spline reprojection, not pointer Test's neutral center. Preserve source confidence/frozen states, timing spacing and configuration. Do not mutate global Play preferences when binding recorded Test settings.
- Matching content is mandatory. Report old judgement-only files, incomplete files or mismatched song/chart clearly. Loader parsing is not evidence authority.

## Delivery slices and checks

1. Implement observational capture/export with the existing button. Verify marker samples, calibration/model changes, timing and settings survive a real built Play export. Check recording adds no duplicate gameplay updates or scoring changes and has bounded measured overhead.
2. Implement the approved Test-only loader/replay adapter. A recorded fixture must reproduce its calibration/marker mapping and judgement sequence on the same implementation; a cross-build comparison reports differences without rewriting expected results.
3. Add one project-owned movement fixture for the demonstrated down-then-up contact case and preserve reverse-only/no-contact controls. Raw personal recordings stay local by default; any versioned fixture is a deliberate, minimal test input, not an automatic upload of Derrick's files.
4. Run relevant existing tests and a genuine built recording -> download -> load -> Test replay check. Update README/owning plans and keep source-only, built, and physical acceptance distinct.

No public comparison-build replacement, telemetry service, alternate scorer, leaderboard path or new tuning UI is included in this proposal.
