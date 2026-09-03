# Mobile calibration validator nondeterminism

## Exact Observed Failure

Final re-audit reported two nondeterministic failures in `scripts/validate-mobile-gameplay-menu.js`: calibration remained `tracking_lost` with visible cue `T-pose` instead of `Hold T-pose`, or the countdown transition timed out.

Parent reproduced the issue deterministically under contention by launching three copies of the validator concurrently. All three failed:

- Two stopped at line 208 with `Error: T-pose hold must remain one minimal cue` and snapshots containing `sessionState:"calibrating"`, `calibrationState:"tracking_lost"`, `cueText:"T-pose"`.
- One stopped in `captureOrderedCountdown` at line 374 with `Error: Timed out waiting for mobile state transition`.

A single isolated run passed. This distinction is directly observed.

## Expected Behavior

The browser harness is intended to supply a continuous mock camera pose stream while a pose shape is active. Calibration should therefore move through detecting/holding/cooldown into one ordered `3,2,1` countdown regardless of unrelated CPU/GPU contention. Product assertions must not be weakened: `Hold T-pose`, overlay count, camera preview, full countdown dwell, audio ordering, and all later menu/session behavior remain required.

## Execution Path

1. The test replaces the production service graph in `validate-mobile-gameplay-menu.js`.
2. Its CV mock returns `state.pose` unchanged from `getLatestPoseFrame()`.
3. `pushPose()` replaces `state.pose` with one new synthetic timestamp, then sleeps for 80 ms.
4. `AeroGameElement.startFrameLoop()` drives `runDisplayFrame()` through requestAnimationFrame.
5. `runDisplayFrame()` processes a pose only when `frame.timestampMs !== latestPoseTimestampMs`.
6. Once the same mock frame has been observed, no further fresh timestamp exists until the next `pushPose()` callback executes.
7. After 100 ms without a fresh pose, `runDisplayFrame()` calls `graph.input.advanceTime(frameNow)` at 15 Hz.
8. Under concurrent Chromium/Vite load, an 80 ms timer or next synthetic update can be delayed past this 100 ms stale threshold. Input truthfully enters `tracking_lost`, resetting the holding progression and cue.
9. The line-208 state assertion then sees `T-pose`, or the shortened/aborted hold never reaches countdown and line 374 times out.

## Most Likely Root Cause

The test double models a sequence of isolated static frames rather than a live CV stream. Its freshness depends on wall-clock scheduling of 80 ms sleeps against a production 100 ms stale-frame threshold. That leaves only about 20 ms of scheduling margin and makes test outcome load-dependent.

Evidence:

- The failing snapshot is specifically `calibrationState:"tracking_lost"` rather than a rendering-only mismatch.
- `runDisplayFrame()` has an explicit 100 ms no-fresh-frame branch.
- The mock returns an identical timestamp until `pushPose()` executes again.
- One isolated run passes while three concurrent runs fail 3/3.
- `validate-product-shell-matrix.js` already avoids this flaw by advancing active mock pose timestamps at a 15 Hz cadence from `getLatestPoseFrame()`.

## Alternative Hypotheses

1. **Countdown observer registration race — low likelihood for the line-208 failure.** A prior change moved observer registration earlier. It can affect captured countdown transitions but cannot explain `calibrationState:"tracking_lost"` before countdown.
2. **Photosphere decode/GPU load changes production calibration — low likelihood.** Added rendering load exposes the race, but calibration state is driven by freshness timestamps; isolated behavior passes and no production code changed in this failure path.
3. **Synthetic pose geometry is marginal — contradicted.** The same landmark geometry reaches holding/countdown when fresh and passes all isolated/full matrix runs.
4. **Test timeouts are merely too short — contradicted as root cause.** Increasing waits would leave the mock repeatedly entering `tracking_lost`; it would mask or prolong the symptom rather than provide fresh frames.

## Why Previous Fixes Failed

The prior photosphere wiring commit changed countdown MutationObserver timing so the first `3` transition and dwell could be observed reliably. That addressed countdown measurement, not input freshness. It left the static `getLatestPoseFrame: () => state.pose` mock and 80 ms/100 ms scheduling race untouched. Allowing either `T-pose` or `Hold T-pose` at the earlier line-205 snapshot also did not stabilize the later explicit holding requirement.

## Unknowns

- Exact event-loop delay distribution under every CI host is not measured. It is unnecessary for root-cause confirmation because any delay beyond 100 ms triggers the demonstrated path.
- Whether Chromium page scheduling or Node host contention contributes more delay is unknown. The proposed mock contract removes dependence on both.

## Minimal Reproduction

From assembly commit `8be57b3`, launch three concurrent copies of:

```bash
node scripts/validate-mobile-gameplay-menu.js
```

The parent reproduction produced 3/3 failures. Run the same command once in isolation; it passed.

## Proposed Verification

Before treating a change as fixed:

1. Change only the CV mock so an active pose yields a fresh monotonically increasing timestamp no faster than 15 Hz, mirroring the existing product-shell mock.
2. Repeat the same three-way concurrent stress twice (six total runs). This directly distinguishes freshness correction from a coincidental isolated pass.
3. Run the validator alone, full `npm test`, and full `npm run test:browser`.
4. Retain exact line-208 and countdown assertions; do not increase production stale thresholds or merely widen timeouts.

## Recommended Fix

Add `lastProducedPoseAtMs` to the test state. Replace the static CV getter with a getter that, while `state.pose` exists, clones it with a monotonically increasing timestamp at a `1000/15` ms production-like cadence. Have `pushPose()` reset the production marker so each explicit shape/timestamp is immediately observable. Do not modify production frame-loop/input calibration code or assertion strength.

This addresses the underlying mismatch: the mock will represent a live CV stream, while an undefined pose can still represent absence. Adjacent tests are calibration hold/release timing, initial/resume countdown, tracking-pause behavior, camera compositor visibility, audio start ordering, and frame cadence.

## Debugging Record

```text
Problem: Mobile browser validation fails nondeterministically during T-pose calibration.
Observed symptom: tracking_lost/T-pose at line 208 or countdown timeout at line 374; isolated pass, 3/3 concurrent failures.
Root cause: Static mock CV timestamp plus 80 ms sleeps races the production 100 ms stale-frame threshold under event-loop contention.
Evidence: runDisplayFrame freshness branch, unchanged mock timestamps, exact tracking_lost snapshot, contention reproduction, stable continuous mock in product-shell matrix.
Failed approaches: Earlier countdown observer registration and broader initial cue acceptance addressed observation timing, not live-frame freshness.
Corrective action: Emit monotonic active mock pose timestamps at 15 Hz and reset cadence on explicit pose-shape updates.
Verification test: Two rounds of three concurrent validators, isolated validator, npm test, and full browser suite without weakened assertions.
Related files/components: scripts/validate-mobile-gameplay-menu.js; src/index.js runDisplayFrame; input calibration freshness state.
Remaining uncertainty: Host-specific source of scheduling delay; irrelevant once mock freshness no longer depends on an 80 ms/100 ms margin.
```

## Follow-up: continuous frames fixed tracking loss but exposed driver timeout

### Exact observed follow-up

The first narrow implementation added the recommended 15 Hz monotonic CV getter. Its isolated validator passed, but the first three-way contention round failed `0/3`. All three now failed only at `captureOrderedCountdown()` line 374 while awaiting countdown value `3`; the earlier line-208 `tracking_lost`/`T-pose` failure did not recur.

### Revised causal path

The first correction removed stale input frames, confirming the leading freshness diagnosis for the original symptom. A second independent wall-clock race remains in the test driver:

1. `captureOrderedCountdown()` starts a 4,000 ms wait for countdown `3`.
2. The test then calls `releaseHold()`, which performs 17 sequential `pushPose()` operations.
3. Every `pushPose()` waits a fixed 80 ms for an uncontrolled requestAnimationFrame to consume the newly assigned mock frame.
4. Nominal driver time is already 1,360 ms. Under three Chromium instances, Node/page scheduling can push the 17 serial wall waits beyond the separately running 4,000 ms countdown wait.
5. The capture promise rejects before `releaseHold()` finishes driving cooldown and entering countdown. This is a test-driver timeout, not evidence that the production countdown skipped value `3`.

The countdown coordinator itself advances exactly one state per call (`three → two → one → complete`) and resets each step start timestamp, so delayed animation frames cannot skip countdown values. The failure occurring while the test is still serially manufacturing release frames distinguishes this from a countdown-state defect.

### Why the first correction was insufficient

Continuous timestamps made each polled frame fresh, but `pushPose()` still relies on an 80 ms sleep as an implicit acknowledgement that some future animation frame consumed it. The sleep is neither an acknowledgement nor bounded under contention. Fixing data freshness did not fix driver synchronization.

### Revised recommended fix and verification

Keep the 15 Hz live-stream behavior. Make `pushPose()` set the requested pose and synchronously invoke the element's existing public test seam `runDisplayFrame()` once, so the exact frame is consumed before the helper returns. Set the cadence marker so that synchronous consumption observes the explicit timestamp. Remove the arbitrary per-sample 80 ms sleep; calibration duration remains driven by the explicit monotonic synthetic timestamps, not wall sleep. Do not change production code, stale thresholds, countdown step duration, capture timeouts, or assertions.

Repeat two three-way contention rounds. This verifies both original freshness and follow-up driver synchronization under the exact failing load.

## Instrumented correction: screenshot work misses later countdown values

The synchronous driver experiment removed the release-loop wall delay but three stressed runs still failed. Temporary in-page diagnostics identified the exact expected value and MutationObserver history. All three were waiting for expected `2` after the first screenshot, while current countdown was already complete/playing. Their observer records were complete and ordered:

- Run 1: `3@9705.3`, `2@10713.2`, `1@11723.8`, empty/complete `@12735.7`.
- Run 2: `3@9636.7`, `2@10653.5`, `1@11655.6`, empty/complete `@12670.3`.
- Run 3: `3@9557.9`, `2@10582.4`, `1@11602.5`, empty/complete `@12608.8`.

Every production countdown step therefore rendered in order with a dwell above 1,000 ms. The Playwright screenshot and pixel-analysis work for `3` consumed long enough under contention that the test began polling for `2` only after `2`, `1`, and completion had already occurred. This disproves the follow-up hypothesis that release driving itself exceeded the initial 4-second wait; the timeout is a test-observer race after correct product transitions.

The minimal robust correction is to make the already-test-only MutationObserver pause the existing display-loop seam synchronously whenever it observes numeric cue `3`, `2`, or `1`. The validator captures that frozen cue's exact DOM style and pixels, then explicitly restarts the same loop before awaiting the next value. This does not change production code, countdown duration, assertions, or timeouts, and prevents test screenshot overhead from consuming subsequent states. Combined with synchronous explicit pose consumption and the 15 Hz live mock, it removes both independently proven scheduler dependencies.

## Second instrumented correction: recovery observer must precede unfreeze

Pausing each observed numeric cue fixed the initial countdown, but the next three-way stress run failed `3/3` at the recovery dwell assertion. All runs captured `[3,2,1]`; only the computed first dwell was short (`591–625 ms`). The recovery path resolved the delayed audio pause before `captureOrderedCountdown()` installed its observer. Value `3` therefore started before the first observer record; the fallback mixed the gameplay snapshot timestamp with later MutationObserver `performance.now()` timestamps, undercounting only the first dwell. The initial-start path had already registered the observer before releasing calibration and did not have this flaw.

Registering `beginCountdownDwellProof()` before resolving the delayed pause is the smallest causal fix. The observer then records/stops `3` at its actual DOM transition just as it does for the initial countdown. One stressed screenshot also captured incomplete third-cue raster contrast even though computed CSS was correct; after the observer stops the game loop, awaiting one independent browser animation frame before screenshot allows that DOM mutation to paint without advancing gameplay. These are test-only synchronization seams, not timeout/assertion relaxation.

## Independent review correction: do not count screenshot freeze as proof

Independent review correctly found that stopping immediately at each transition and asserting MutationObserver-to-MutationObserver wall time could let slow screenshot work satisfy `dwell >= 800` even if the coordinator's natural step duration regressed. That would stabilize the test by weakening what its measurement proves.

The corrected design delays the test-only stop until the same numeric cue has remained unchanged for an independently scheduled 850 ms minimum-dwell probe. The timer marks that specific transition as naturally proven only if the cue is still identical, then stops the game loop for exact screenshot capture. `captureOrderedCountdown()` waits for that proof marker, not merely the numeric value; all three markers are required in addition to ordered values, style, pixels, and existing dwell reporting. A duration regression below 800 ms transitions before the 850 ms probe and therefore fails rather than being masked by screenshot time.

## Corrected verification

- Isolated corrected validator: PASS.
- First corrected three-process contention round: `3/3` PASS.
- Second corrected three-process contention round: `3/3` PASS.
- Independent code review initially found the screenshot-freeze measurement weakness above; after the 850 ms cue-specific pre-freeze proof was added, re-review closed the finding with no new findings.
- The production assembly frame loop, input stale threshold, gameplay countdown coordinator, timeout bounds, visual assertions, and runtime source files were not modified.
