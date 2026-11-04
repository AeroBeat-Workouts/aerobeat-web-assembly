# Record human Play movement and replay it in Test

Status: IMPLEMENTED AND VERIFIED LOCALLY. Signed native replay and final normal suite pass. Publication/phone acceptance remain. Derrick selected “Add recording and replay first” in native question next_delivery. The numeric recording and Test Load Recording control are approved before publishing the gameplay fix. Both public A/B builds stay unchanged during implementation.
Owner: Pico. Feature Bead: aerobeat-web-assembly-1fnl.

## Current action

Capture/export is implemented in assembly 1abb81d with input 374de74. Full assembly tests pass. The actual signed Play download contains 80 measured frames and 51 actual advances, all 13 available named markers, exact calibration/model mapping and equipment, unchanged judgement and run-locked settings. Capture observes each real advance once. Saved synthetic fixture: `.tmp/movement-capture-built-fixture.json` (520486 bytes; not human data).

Reader e25f566 passes 7 focused / 20 combined tests and parses all 51 actual saved ticks without changing any numbers. Gameplay a4ba863 adds the explicit non-ranked recorded-Play temporal context; parent inspected its small production diff and independently passed its focused Flow/Boxing/epoch/admission checks. Source full tests pass; parent handles pins/push.

Test UI/playback is implemented under us3e in 0985418: native Load/Clear control and recorded-input status, local settings, all ticks/observations, body-pivot projection, existing pause/restart/seek and current audio-only Test lease. Final controller 7/7, combined 27/27, signed native flow and monolithic npm test pass. Two old static syntax oracles initially caught normal-Test branch-shape changes; production structure was corrected and the original gates left untouched. Child had one unknown native/empty-closing failure; resumed the same verified ID idempotently, preserved all partial work and collected all jobs. No replacement worker or skipped gate.

Actual Play -> Download -> native Test Load Recording -> real Test scoring is verified, including marker/equipment equality, positive reversal, >180 ms late contact and strict miss controls. Repro command: npm run test:movement-replay after a clean signed build. Next is the publication decision and physical phone test. No public build changes yet.

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

## Latest actual acceptance (cd8330c, local signed candidate only)

- `npm run test:movement-replay` PASS (bash76). Genuine Play -> Download -> native file chooser -> same real Test scorer. Reversal Great at6050, qualified offset +35.41666666666697; late reversal Great at6550, +535.416666666667; reverse-only/no-contact remain Miss7050. Every recorded tick and observation is consumed.
- Native UI passes marker/equipment equality, active audio-only ownership and terminal release, unranked Test, pause/prefix seek/resume, EOF restart with cleared scores and second terminal release, Clear, portrait control bounds, and old-file error. Play preferences/equipment globals stay unchanged.
- Actual live nose visibility was changed during the recorded run and changed back for the next run. Test preserves the captured hidden nose (actual renderer cursor count), not current preferences. Source regression also verifies 150% notes and hook height +.5 reach the local binding/real coordinator while next-run collider scale is ignored. Seven controller tests + npm check PASS.
- Recorder methods measured on the real synthetic Play boundary: combined observation+tick elapsed mean per advance 0.0906–0.1465 ms across four cases; per-method maximum 0.3 ms. This excludes other frame work and is not phone FPS/human acceptance. Exactly-once actual advances remain checked.
- Monolithic final `npm test`: bash77 PASS, including all normal source/static/unit/public progress checks. Current combined data/controller coverage is 27 tests. Both public comparison builds remain unchanged. No physical recovery claim.
- Verified local signed artifact: assembly cd8330c, gameplay a4ba863, input374de74; stamp FRIEND-GAME-CPU-0.0.153-f40a7f4cee73bd77cab8ed58. This is a local candidate, not either original public comparison.
- Exact continuation: commit/push completed checks/docs, close bounded recording/QA tasks, then ask Derrick whether to publish a distinctly versioned 0.0.154 at the current .153 link while keeping authentic .149 unchanged. No further audits, schema cleanup or optimization are required before that decision.
- Independent QA nvnb completed one bounded pass. Its one faithful-replay defect xkrs was repaired in cd8330c and verified above. Optional file compaction is deferred as iomn; no format refactor or extra audit is required for this delivery.

## Resolved repair: live settings lost on replay (xkrs, from QA nvnb)

### Exact observed failure / expected behavior

QA parsed a valid saved synthetic file with recorded presentationSetup nose=false, note scale=150 and hook height=+.5. prepareRecordedTest accepted it but returned original nose=true, scale=100, hook=0. Replay must use the same live visual/height values as the original run, without importing desired next-run collider changes.

### Execution path / root cause

The producer records active setup and current presentationSetup. prepareRecordedTest normalizes only setup and drops presentationSetup. Replay renderer locks its values to that setup, and both controller and component Boxing-height code read its old offsets. Original Play deliberately overlays the live desired values. The omitted binding causes the demonstrated mismatch.

### Alternatives / previous fixes / unknowns

Invalid recorded settings are ruled out by successful parse/normalization and valid control ranges. This is not the trusted-upload/terminal-lease fixture issue; those native flows now pass. No product fix attempted yet for this defect. Remaining unknown is post-fix built behavior, not whether the values were discarded.

### Minimal reproduction / proposed verification

Use one configuration with different run-locked and live settings, then parse/prepare it. Assert the live visual/height values survive while locked collider scale and global Play preferences remain unchanged. Observe actual controller setBoxingHeightTuning arguments. Add a live visual change to the native signed capture/replay check; rerun only affected checks, then the final normal suite.

### Recommended fix

Normalize and retain presentationSetup separately. Derive a private render setup by copying only the original Play live overlay fields onto the recorded active setup. Use that for replay rendering and Boxing height, not for locked collision rules. Do not add a new UI, format, scorer or authority path.

Problem: recorded live settings discarded. Symptom: wrong marker/target appearance and potentially wrong Boxing heights. Root cause: preparation drops presentationSetup. Evidence: QA scoped reproduction and source path. Failed approaches: none. Action: local live overlay binding. Verification: focused binding/controller regression plus native visual change. Related: recorded-test-source.js and index.js. Uncertainty: post-fix acceptance pending.

## Native UI diagnostic: Clear then legacy-file load

### Exact observed failure

Signed a49bf87 built successfully. Native capture/replay check passed marker/equipment equality, real Test result, audio-only/unranked scope, unchanged preferences, paused prefix seek, resume/complete and portrait bounds. It timed out at validate-ab-capture-browser.js:181 waiting for the legacy-file error caption after Clear -> Load (30000 ms).

### Expected behavior

Clearing returns to ordinary Test. A subsequent old judgement-only file must show the explicit missing-movement error and must not create a recorded source.

### Execution path

Trusted Clear click -> clearRecordedTest clears the prepared source synchronously, then awaits startSession(Test). Test waits only for prepared=null, clicks Load, chooses legacy JSON. handleRecordedTestFile checks captured connection/session scope before and after async reads, parses, and writes the status output on error.

### Most likely cause and alternatives

Hypothesis: Load can open during Clear's still-pending Test restart because recordedTestCanLoad does not check menuStarting/pending action; the session-generation guard then silently discards the chosen stale file. Alternative: parser error text or output rendering differs; standalone parser has the expected judgement-only message. No root cause is confirmed yet.

### Previous fixes and unknowns

No product fix attempted for this failure. The earlier delegate native failure had no recoverable result and is not this observed timeout. Need actual caption/value, picker request generation, current generation and pending-action state at the negative file change.

### Minimal reproduction and verification

Run the signed native capture validator with AEROBEAT_AB_TEST_REPLAY=1. Add test-only event/state diagnostics around the second file chooser and on timeout. Distinguish stale-session discard from a parser/rendering failure before editing product code.

### Recommended fix

Pending diagnostic result. If the pending-restart hypothesis is confirmed, disable/open-guard Load while the serialized session action is pending; keep existing stale-file guards intact. Then rerun the same native flow.

Confirmed diagnostic: the negative fixture's in-memory Playwright upload emitted isTrusted=false. The real downloaded-file path emitted isTrusted=true. Both had matching/current session scope, menuStarting=false and pending action empty. This refutes the Clear/restart race hypothesis. The existing trusted-file guard correctly ignored the synthetic upload. Corrective action is test-only: write the legacy JSON to a real local file and select its path through the native chooser. No product guard is changed.

A separate new direction-replay assertion expected an audio lease after EOF. The actual app correctly released it during terminal cleanup. Await terminalServiceTail and assert an empty lease there; the paused/active replay already independently asserts audio-only ownership. This is a test lifecycle-point correction, not a runtime gate change.

Problem: two native test-fixture expectations were wrong. Observed symptoms: missing legacy caption for untrusted buffer upload; empty lease at completed EOF. Root causes: upload event trust and normal terminal resource release. Evidence: captured event/scope diagnostics and source terminal path. Failed approaches: no product fixes attempted. Corrective actions: native file path and awaited terminal cleanup assertion. Verification: rerun the same signed UI flows. Remaining uncertainty: final rerun results only.

## Delivery slices and checks

1. Implement observational capture/export with the existing button. Verify marker samples, calibration/model changes, timing and settings survive a real built Play export. Check recording adds no duplicate gameplay updates or scoring changes and has bounded measured overhead.
2. Implement the approved Test-only loader/replay adapter. A recorded fixture must reproduce its calibration/marker mapping and judgement sequence on the same implementation; a cross-build comparison reports differences without rewriting expected results.
3. Add one project-owned movement fixture for the demonstrated down-then-up contact case and preserve reverse-only/no-contact controls. Raw personal recordings stay local by default; any versioned fixture is a deliberate, minimal test input, not an automatic upload of Derrick's files.
4. Run relevant existing tests and a genuine built recording -> download -> load -> Test replay check. Update README/owning plans and keep source-only, built, and physical acceptance distinct.

No public comparison-build replacement, telemetry service, alternate scorer, leaderboard path or new tuning UI is included in this proposal.
