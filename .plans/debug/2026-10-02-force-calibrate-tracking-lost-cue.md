# Forced Play calibration says “Tracking lost”

**Bead:** `aerobeat-web-assembly-ibx6` (discovered from `wm21`). **Scope:** source-only 0.0.89 candidate; no raw/live change.

## Exact observed failure

Derrick refreshed the 5174 source preview with input owner `cc07bfa`, pressed bottom Calibrate during Play, kept his arms down, then held a T-pose. Play did **not** resume with arms down. It resumed only after his T-pose and visible 3–2–1, but the interim cue said **“Tracking Lost.”** He could not tell whether he was in calibration mode. He did not report exact before/after time, score or the input calibration ID, so physical continuity/new-ID acceptance is still open.

## Expected behavior

During a deliberate forced reset, the visible cue should ask for a new T-pose, then show holding progress or the countdown; a real accidental tracking loss can say “Tracking lost.” The scored run and paused audio should remain at the held position.

## Execution path and likely root

Bottom transport Calibrate → `visual-test-calibrate` → assembly `forceCalibrate()` → `recoverPlayCamera(true)` pauses the gameplay run, audio and CV; `input.resetCalibration('explicit_reset')` sets `freshCalibrationRequired=true` and `calibration.invalidationReason='explicit_reset'`. Gameplay `enforceSafety()` enters its shared `paused_tracking` state with a generic safety pause reason (`session-coordinator.js:903–934`). The renderer cue is computed by `transientCue()` in assembly `src/index.js:3357–3365`: it unconditionally returns `Tracking lost` whenever `session.state==='paused_tracking'` **before** inspecting input calibration reason or hold progress. The displayed string therefore mistakes an intentional reset for accidental tracking loss. Runtime status separately says “Recalibrate to continue,” which does not override the full-screen cue.

## Alternative hypotheses

1. **Most likely:** the unconditional cue priority is sufficient to explain the observed string; it is source-confirmed, independent of CV health.
2. A camera source change after the reset may replace `explicit_reset` with `source_changed`, but this still requires a fresh T-pose and should not display “Tracking lost.” Input's `cc07bfa` gap guard preserves non-loss fresh requirements.
3. A simultaneous *real* tracking failure can also occur. The observed T-pose/countdown suggests input recovery worked, but without calibration-ID and time/score readings this is not physical acceptance of all invariants.

## Why previous fixes did not address it

Assembly `wm21` preserved run time/score instead of calling gameplay reset. Input `p3fa` prevented an explicit reset being downgraded to automatic tracking-loss recovery across CV gaps. Neither changed the existing cue function, whose first paused-tracking branch has always said “Tracking lost.” The prior browser test asserted frozen audio and countdown but not this visible cue or the measured input service path.

## Unknowns, minimal reproduction, verification

Minimal reproduction: refreshed source preview, a live scored Play song, bottom Calibrate, arms down, then measured T-pose. It occurs on the explicit path even when CV frames are running and the game correctly waits. Before code, add browser evidence clicking the nested button and reading the actual visible cue plus real input snapshot `freshCalibrationRequired/invalidationReason`; also drive a genuine tracking-loss snapshot and verify the old loss label remains. This distinguishes presentation priority from misclassified input. Physical retest should note new calibration ID only as equality/new-generation scalar (no landmarks), exact held/resumed time, score and audio after countdown.

## Recommended fix

In `transientCue`, when `paused_tracking` and input still requires fresh calibration for a **non-tracking-loss** invalidation, show `T-pose`, and `Hold T-pose` only with actual measured hold progress; keep `Tracking lost` for ordinary loss. Allow `Release` during post-commit cooldown. No gameplay or input state mutation; regression-test both branches and existing mobile/shell cues, then real BRIO retest.

## Follow-up QA diagnosis: stale menu-close shell cue (`8ivr`)

**Exact failure:** independent `node scripts/validate-product-shell-matrix.js` fails twice at `direct:390x844@1` close/recovery: line 270 demands `Tracking lost`, while the real visible cue is `T-pose`. The fresh cue browser proof, mobile-menu validator and diff check pass. **Expected:** closing the active Play menu triggers fresh recalibration, not an accidental tracking-loss label. **Execution path:** shell opens and closes menu via Escape (`validate-product-shell-matrix.js:254–270`); assembly `setMenuOpen(false)` calls `recoverPlayCamera(false)` (`src/index.js:2849`), which calls `input.resetCalibration('menu_closed_recalibration_required')` (`:834`). Gameplay enters shared paused_tracking; updated cue correctly asks for T-pose for this non-loss reason. **Root:** the historical assertion conflates intentional menu-close fresh calibration with genuine tracking loss. **Alternative:** an unrelated measured tracking loss might cause the observed cue, but source explicitly calls non-loss reset and shell's earlier healthy input/play assertions passed. **Previous fix:** `ibx6` made cue intent-aware without modifying this older shell oracle. **Unknown:** confirm live input `calibration.invalidationReason` at the assertion frame (do not assume the menu close reason if camera source changed). **Minimal reproduction/verification:** run focused direct portrait shell matrix with failure diagnostics including only `invalidationReason`, `freshCalibrationRequired`, session state and cue; assert non-loss reason plus T-pose, and retain separate genuine measured tracking-loss cue proof and full direct/iframe matrix. **Recommended fix:** update this single historical expected string only if the input reason is non-loss; keep clock/audio/camera/inventory assertions strict. No product/input change.

## Debugging record

```text
Problem: Force-calibrate during Play shows a false loss cue.
Observed symptom: “Tracking Lost” until a real T-pose/countdown; no premature auto-resume.
Root cause: transientCue blindly prioritizes shared gameplay paused_tracking over input reset reason/hold state.
Evidence: src/index.js:3357–3365; recoverPlayCamera(true) explicit_reset; user BRIO observation.
Failed approaches: earlier run-preserving and gap fixes addressed behavior but not presentation.
Corrective action: distinguish explicit/non-loss fresh input reset from ordinary tracking loss in cue only.
Verification test: actual nested button + visible cue/input reason; ordinary loss cue unchanged; BRIO clock/score/new calibration ID.
Related files/components: assembly src/index.js, scripts/validate-force-calibration-recovery.js, gameplay session-coordinator.js, input body-grid-service.js.
Remaining uncertainty: actual physical calibration ID, exact held/resumed clock, score and audio after countdown.
```
