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
