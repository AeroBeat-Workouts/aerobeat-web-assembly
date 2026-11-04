# Record human Play movement and replay it in Test

Status: APPROVED, CAPTURE SLICE ACTIVE. Derrick selected “Add recording and replay first” in native question next_delivery. The numeric recording and Test Load Recording control are approved before publishing the gameplay fix. Both public A/B builds stay unchanged during implementation.
Owner: Pico. Feature Bead: aerobeat-web-assembly-1fnl.

## Current action

Parent owns assembly capture/schema/export and later Test replay integration. Same bounded coder completed input-owned read-only calibration export under 4zvi: commit 374de74, normal input tests and independent parent focused check pass. No restoration or scoring authority is added. Parent will repin it before building the capture path. Next passing check is a genuine completed Play download containing marker/model/tick/equipment data that match accepted input, with unchanged judgements and exactly one gameplay advance per display tick.

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

## Delivery slices and checks

1. Implement observational capture/export with the existing button. Verify marker samples, calibration/model changes, timing and settings survive a real built Play export. Check recording adds no duplicate gameplay updates or scoring changes and has bounded measured overhead.
2. Implement the approved Test-only loader/replay adapter. A recorded fixture must reproduce its calibration/marker mapping and judgement sequence on the same implementation; a cross-build comparison reports differences without rewriting expected results.
3. Add one project-owned movement fixture for the demonstrated down-then-up contact case and preserve reverse-only/no-contact controls. Raw personal recordings stay local by default; any versioned fixture is a deliberate, minimal test input, not an automatic upload of Derrick's files.
4. Run relevant existing tests and a genuine built recording -> download -> load -> Test replay check. Update README/owning plans and keep source-only, built, and physical acceptance distinct.

No public comparison-build replacement, telemetry service, alternate scorer, leaderboard path or new tuning UI is included in this proposal.
