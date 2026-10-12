# Scored Boxing collider browser calibration failure — diagnosis in progress

## Exact observed failure
After fixing the separate scored parallax test's observer clock, full `npm run test:browser` advanced to the **third** script, `scripts/validate-scored-boxing-collider-volume-pixels.js`, and passed its direct 844×390, direct/iframe 390×844, direct 1280×720, and iframe 1280×720 OFF/default cases. It then failed at iframe 1280×720 `scale` during `harness.calibrate()`:

`locator.evaluate: Error: scale fresh Start/calibration: Error: Scored Play fixture: fresh measured frame was not consumed cleanly; {"session":"playing","camera":"live","cv":"running","menu":false,"active":"start"}`.

The error originates at `scripts/fixtures/scored-play-browser-harness.js:94`; the outer wrapper at `validate-scored-boxing-collider-volume-pixels.js:68-69` reports that Play is still playing, the camera track remains live, CV reports running and the setup menu is closed. It does **not** show which of `latestPoseTimestampMs !== timestampMs` or `element.lastError` failed. This is not yet proven flaky or proven to be a production defect.

## Expected behavior
For each new measured CV pose in the scored Play fixture, `feedPose()` calls the genuine `element.runDisplayFrame()` and verifies that the app consumed that exact strictly increasing timestamp and no production error was raised. Real calibration, audio, scoring and GLB visual assertions must remain intact for all direct/iframe dimensions and seven volume settings.

## Execution path
The browser case installs `installScoredPlayHarness`, selects the downloaded Boxing chart, changes native setup controls, calls `harness.startPlay()` and then `harness.calibrate()`. `calibrate()` samples ~15-fps synthetic measured timestamps during a real input hold and countdown, sometimes without rendering, then samples with display frames. `feedPose` sets `state.pose`, calls `element.runDisplayFrame()`, and asserts `element.latestPoseTimestampMs === timestampMs && !element.lastError` (`:84-103`). Production `src/index.js:1827-1891` reads `graph.cv.getLatestPoseFrame()`, assigns the new timestamp at `:1835-1837`, advances gameplay and renders; other errors route via `handleError`. The outer test's diagnostic reports normal service states but not the timestamp or `lastError`.

## Confirmed root cause after instrumented full-chain reproduction
The full browser chain failed again at the same iframe/scale case. The consumed and CV timestamps **both matched** the just-fed `6879.533333619444` ms, but wall time was `7604.10000038147` ms, so the nominally new measured sample was already ~**724.6 ms old**. The production error was `Equipment pose requires a current valid measured wrist`. `session-coordinator.js:799-803` calls `measuredColliderSample`, which rejects measured wrist evidence age >= **150 ms** (`flow-collider-collision.js:105-123`). The scorer correctly rejected stale input; the fixture incorrectly constructed its synthetic 15-fps timestamp by advancing `measurementMs + 66.7` each sample without catching it up to `performance.now()` after expensive software-GLB renders (`scored-play-browser-harness.js:193-200`). Despite its comment saying bounded by real wall time, that bound was only used once at calibration initialization. Filtered and standalone full-matrix runs happened to keep up; the normal full browser chain exposed the drift. No Flow corpse is staged in this Boxing calibration case.

## Alternative hypotheses and ruling evidence
1. Missed CV frame: ruled out; expected, consumed and CV timestamps matched exactly.
2. Renderer caused a new Flow corpse shader error: contradicted by the recorded product error coming from gameplay's 150-ms measured-wrist freshness gate in a Boxing calibration frame that has no Flow aftermath.
3. The phone's actual measured CV sample was stale: not applicable; the browser fixture synthesized its own timestamp that had fallen ~725 ms behind wall time during prior expensive scripted browser work.
4. A real product bug from rejecting stale wrist data: rejected; enforcing that guard is intended to prevent false scoring on old evidence.

## Why previous fixes failed
The previous fix changed **only** a separate parallax test's post-capture freshness assertion; it did not touch the shared Boxing fixture or production. The full browser run now reaches later cases and exposes a new failure. Repeating arbitrary scenarios until they pass would hide whether the compound assertion records a product error.

## Remaining unknowns
The precise distribution of per-frame software-GLB render durations in the full chain was not measured; it is unnecessary to explain the failure once the synthetic timestamp's ~725-ms lag is observed. Whether other scored fixture tests independently have the same clock bug remains to be checked; do not blanket-change unrelated harnesses. The filtered iframe 1280×720 scale and all 35 original Boxing cases passed standalone *before* correcting the clock, showing the trigger depends on long-chain scheduling.

## Minimal reproduction
From the synced assembly, run the full `npm run test:browser` through `validate-scored-boxing-collider-volume-pixels.js` on software Chromium/PlayCanvas. It failed in the iframe 1280×720 `scale` case after previous direct/iframe cases passed. Use the two environment filters above to isolate one case while instrumenting, not to claim the full gate passed.

## Proposed verification and observed result
Expanded **only** the failure message in `feedPose` to include expected/consumed/CV timestamps, `lastError` message/stack, wall clock and calibration state. Filtered iframe 1280×720 scale and all 35 original scored Boxing cases passed standalone. The next complete normal browser chain failed at iframe scale with an exact 724.6-ms synthetic-pose lag and the intended gameplay error. The before/after test-only fix should show original long-chain RED and corrected long-chain GREEN without weakening the production guard.

## Recommended fix
In the shared scored-browser fixture's `sampled` callback, set synthetic measurement time to `Math.max(performance.now(), measurementMs + 1000/15, latestPoseTimestampMs + 1)` on **each** new pose. This preserves monotonic sampled 15-fps minimum cadence while catching up after long real renders; it does not backdate samples, fabricate future stale evidence, lower the 150-ms product limit, skip a scored frame, or change production. Re-run focused iframe scale, complete 35-case matrix and the normal browser chain, including scored Flow pixels. Check any affected pose-clock assertions in dependent fixture tests.

## Debugging record
Problem: Full assembly browser gate stops before the centerline scored test.
Observed symptom: iframe 1280×720 Boxing scale scenario fails compound measured-frame consumption assertion.
Root cause: fixture's synthetic 15-fps clock failed to catch up to real wall time after slow software-GLB frames.
Evidence: exact consumed/CV timestamp 6879.53 ms, current wall 7604.10 ms, 150-ms production guard rejected 724.6-ms-old wrist, intended `equipment_poses_invalid` error.
Failed approaches: separate parallax freshness fix did not address independent fixture clock; focused and standalone-matrix success did not reproduce cross-suite slowdown.
Corrective action: catch up `measurementMs` to performance.now on each synthetic sample, retaining strict guard and real scored rendering.
Verification test: focused iframe scale, original 35-case matrix and full normal browser chain including direct/cross-origin Flow corpse tests.
Related files/components: `scripts/fixtures/scored-play-browser-harness.js`, `scripts/validate-scored-boxing-collider-volume-pixels.js`, `src/index.js` display loop, `aerobeat-web-gameplay/src/flow-collider-collision.js`.
Remaining uncertainty: which prior browser work tipped fixture timing into the 725-ms lag; no product fix indicated.
