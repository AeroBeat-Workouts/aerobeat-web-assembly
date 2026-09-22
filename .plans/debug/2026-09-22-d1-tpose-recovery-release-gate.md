# D1 in-play T-pose recovery gate regression

## Exact Observed Failure

At assembly `45ca766`, `node scripts/validate-mobile-gameplay-menu.js` fails at `scripts/validate-mobile-gameplay-menu.js:342`:

```text
Error: Timed out waiting for mobile state transition
```

The timed-out predicate expects the in-play T-pose to enter `paused_tracking`. Temporary diagnostic logging (untracked copy only, then removed) showed the actual state after the timeout:

- gameplay session: `playing`
- gameplay calibration: `aero-game-1-calibration-1`
- input calibration: `aero-game-1-calibration-2`
- input calibration state/readiness: `cooldown` / `countdown`
- input `tracking.gameplayPaused=false`
- input `tracking.freshCalibrationRequired=false`
- audio still `playing`; no delayed pause resolver was installed

Directly observed: the input service committed a second calibration generation while the athlete remained in the T-pose, but the gameplay coordinator never exposed the required tracking pause.

## Expected Behavior

The established product contract keeps the in-play T-pose pause/recovery flow: entering and holding a T-pose during Play must put the session in `paused_tracking`, freeze audio before countdown, require the recovery release/countdown sequence, and only then return to `playing`.

D1 changes a different path: ordinary out-of-grid wrists and true confidence loss must not pause gameplay. It does not delete the intentional in-play T-pose pause/recalibration flow.

## Execution Path

1. `validate-mobile-gameplay-menu.js` reaches steady `playing` state.
2. It enables a delayed next audio pause and pushes T-pose frames.
3. `aerobeat-web-input/src/body-grid-service.js:updateCalibration()` starts a mid-run recalibration hold (`calibration_required`).
4. A complete hold commits a new calibration ID.
5. The commit sets `freshCalibrationRequired=false`, `trackingPaused=false`, `calibrationState="cooldown"`, and `readiness="countdown"`.
6. Subsequent held frames execute the cooldown branch and continue to publish `countdown`.
7. `aerobeat-web-gameplay/src/session-coordinator.js:commitInput()` treats that new generation as recovered because readiness is already `countdown` and fresh is false.
8. `enforceSafety()` therefore has no unsafe truth with which to enter `paused_tracking`; Play continues.

## Most Likely Root Cause

Input commit `b4fc258` introduced `recoveryReleaseSatisfied`, sets it at the recalibration commit, but never reads it. The code and comments say it distinguishes:

- fresh-required recovery/initial commits, where release may be treated as satisfied; and
- ordinary held-pose refire commits, where release remains outstanding.

The implementation instead branches on `freshCalibrationRequired` in the cooldown gate after the commit has unconditionally set `freshCalibrationRequired=false`. It also sets `readiness="countdown"` unconditionally at commit. Therefore every completed mid-run T-pose commit is published as immediately recovered, including the ordinary in-play refire that must pause and await release.

Evidence:

- `body-grid-service.js:654-655` assigns `recoveryReleaseSatisfied`.
- No production read of `recoveryReleaseSatisfied` exists.
- `body-grid-service.js:674-679` clears fresh/tracking and publishes countdown unconditionally.
- The diagnostic snapshot showed exactly that impossible combination on the new calibration generation.
- The mobile oracle fails precisely at the missing `paused_tracking` transition.

## Alternative Hypotheses

1. **The browser oracle schedule is stale** — medium-low likelihood. The initial calibration schedule was recently corrected, but the failure snapshot is not merely early/late: a new calibration generation has committed and is explicitly marked recovered while the held pose continues. More waiting cannot restore the missed pause contract.
2. **Gameplay `paused_manual` precedence is still wrong** — low likelihood for this failure. `f1eeaa4` covers that separate branch, while the observed session never reached any paused state and input itself advertised safe countdown truth.
3. **Assembly swallowed a coordinator error** — contradicted by the current narrow catch and by the diagnostic snapshot: the loop remained active, produced a new input generation, and gameplay stayed live rather than freezing on a thrown contract error.
4. **D1 intentionally removed in-play T-pose pause** — contradicted by README/runtime contracts and the unchanged mobile recovery assertions. D1 removes out-of-grid/confidence-loss pauses, not the deliberate T-pose control.

## Why Previous Fixes Failed

- `b4fc258` correctly addressed cross-generation stale evidence, but its release-gate repair encoded the distinction in a variable that is never consumed. It treated the symptom (recovery could not reach countdown) by forcing countdown too broadly.
- `fca84c4` correctly lets the coordinator resume from authoritative recovered truth, but because input now labels an ordinary held-pose refire as recovered truth, the coordinator cannot distinguish it from a valid recovery.
- `f1eeaa4` restores tracking-safety precedence over `paused_manual`, but no safety violation reaches the coordinator in this failing path.
- `2b88f4b` correctly narrowed the assembly catch, exposing errors instead of freezing silently; this failure is now a state-machine truth error, not a swallowed exception.

## Unknowns

- Whether initial calibration and fresh-required source-change recovery should both use the same implied-release rule. Existing comments say yes, but the focused fix must prove both independently.
- Whether a held-pose refire should publish `calibration_required` immediately at commit or remain in an explicit paused/cooldown state until a non-qualified frame. The existing oracle expects the latter behavior semantically but does not assert readiness after the second commit.

## Minimal Reproduction

1. Calibrate and release into steady Play.
2. Hold a valid T-pose long enough to commit a second calibration generation.
3. Observe input snapshot and gameplay session.

Current result: new calibration ID with input `countdown`, fresh false, tracking pause false; gameplay remains `playing`.

Expected result: the in-play hold causes `paused_tracking`; release and ordered countdown are required before Play resumes.

The same failure is reproduced by `node scripts/validate-mobile-gameplay-menu.js` at line 342.

## Proposed Verification

Add focused input assertions that distinguish all three cases:

1. Initial/fresh-required calibration can reach countdown under its intended release rule.
2. Ordinary mid-play held-pose refire commits a new ID but remains calibration-required/paused until a non-T-pose frame releases it.
3. Source-change fresh-required recalibration resumes only through the intended release/countdown path and never publishes cross-generation evidence.

Then run:

```text
cd ../aerobeat-web-input && npm test
cd ../aerobeat-web-gameplay && npm test
cd ../aerobeat-web-assembly && node scripts/validate-mobile-gameplay-menu.js
cd ../aerobeat-web-assembly && node scripts/validate-product-shell-matrix.js
```

The focused input test must fail before the fix and pass after it; the two browser tests distinguish state-machine correctness from unit-only behavior.

## Recommended Fix

Use the persisted commit-context flag (`recoveryReleaseSatisfied`, or a smaller correctly named equivalent) as the sole cooldown/release discriminator instead of re-reading `freshCalibrationRequired` after it has been cleared. At commit time, preserve whether this was a fresh-required recovery versus an ordinary held-pose refire; publish countdown only for the explicitly allowed recovery case, and keep the ordinary mid-play refire calibration-required until a real non-T-pose release frame.

Add the missing readiness/release assertions to `validate-body-grid-service.js`. Avoid changing gameplay coordinator logic unless the new input snapshots expose a separate coordinator defect.

Regression checks: initial calibration, source-change recovery, confidence-loss freeze/no-pause, out-of-grid staging/no-pause, in-play T-pose pause, menu-open precedence, and the full mobile/product-shell browser matrices.

## Debugging Record

```text
Problem: In-play T-pose no longer enters paused_tracking after D1 recovery fixes.
Observed symptom: validate-mobile-gameplay-menu times out at line 342; diagnostic state remains playing while input commits calibration-2 as cooldown/countdown with fresh=false and gameplayPaused=false.
Root cause: b4fc258 introduced recoveryReleaseSatisfied but never consumes it; cooldown/commit readiness instead uses freshCalibrationRequired after clearing it, so ordinary held-pose refires are misclassified as recovered.
Evidence: dead write-only variable; unconditional countdown at commit; diagnostic cross-component snapshot; deterministic browser failure.
Failed approaches: stale-evidence clearing, coordinator latch release, paused_manual precedence, and narrowed assembly catch repaired adjacent symptoms but did not preserve the input release distinction.
Corrective action: consume a persisted commit-context flag in the cooldown/release gate and keep ordinary refire calibration-required until physical release; add exact input assertions.
Verification test: focused input three-case oracle, then input/gameplay suites plus mobile-menu and product-shell browser matrices.
Related files/components: aerobeat-web-input/src/body-grid-service.js; aerobeat-web-input/scripts/validate-body-grid-service.js; aerobeat-web-gameplay/src/session-coordinator.js; aerobeat-web-assembly/scripts/validate-mobile-gameplay-menu.js.
Remaining uncertainty: exact intended implied-release policy for initial calibration versus source-change recovery must be proven by existing product oracles.
```
