# Cross-Mode Camera Capture Parity

**Status:** Approved diagnostic in progress
**Owner:** assembly orchestrator → regression coder → independent QA → auditor
**Umbrella Bead:** `aerobeat-web-assembly-81f`
**QA Bead:** `aerobeat-web-assembly-edg`
**Audit Bead:** `aerobeat-web-assembly-unk`
**Deferred art Bead:** `aerobeat-web-assembly-ubg`
**Product baseline:** deterministic `0.0.30` at assembly `ec2386960ded74008afbacecc52839f792c53b73`, renderer `fb103de71a3cc2e3b90587616d7f37ca61f9c282`

## Goal

Guarantee that Flow, Boxing Lanes, and Boxing Grid share one Visual Test camera contract: desktop right-click toggles mouse-look capture, touch two-finger tap toggles touch-look capture, repeating the relevant gesture or pressing Escape exits, and all modes retain the same gradual camera-relative keyboard/GUI movement, speed, Reset and lifecycle behavior. Diagnose before production edits. Defer beat-art work until Derrick physically tests this slice.

## Debugging report

### Exact Observed Failure

Derrick requested: “right clicking or two finger tap captures mouse/touch so we can rotate the camera, and either pressing right click / two finger tap again or escape on the keyboard to leave this mode,” and asked that Boxing Lanes and Boxing Grid share these capabilities.

No concrete `0.0.30` physical failure, error, stack trace, or mode-specific symptom was reported in this message. Direct source inspection shows the requested toggle behavior is already present in audited renderer `fb103de`:

- canvas right-button `mousedown` enters capture when mode is `none` and exits otherwise;
- pointer lock is requested with a bounded fallback;
- document mouse movement applies yaw/pitch while pointer/fallback captured;
- Escape exits;
- a valid two-finger touch tap enters/exits touch capture;
- one-finger drag applies look only while touch-captured.

The concrete evidence gap is in assembly regression scope: `validate-product-shell-matrix.js` starts downloaded Flow through the actual UI and performs the complete capture/movement/touch proof there. Separate tests prove mode selection and renderer geometry for Boxing Lanes/Grid, but do not repeat the actual-UI camera interaction sequence inside each boxing presentation.

### Expected Behavior

All three Visual Test presentations must use the exact same camera state machine and controls. Presentation choice may change scene-model geometry only; it must not alter capture, look, movement, speed, Reset, cleanup, privacy or scored-Play isolation.

### Execution Path

1. The user selects Flow, Boxing Lanes, or Boxing Grid in the drawer.
2. Content selects a variant/ruleset.
3. `rendererFrame()` maps the selected variant through `rendererPresentationForVariant()` to `flow`, `boxing_lanes`, or `boxing_spatial_grid` and constructs presentation-specific targets.
4. `debugCameraSnapshot()` derives visibility/enabled state only from Visual Test/session/menu/lifecycle/visibility/play state; it does not inspect presentation.
5. `syncDebugCameraPresentation()` calls the same renderer `setDebugCameraEnabled()` for every presentation.
6. `setDebugCameraEnabled()` installs one common canvas/document/window input set.
7. Right-button/touch gestures mutate `debugCaptureMode`; mouse/touch motion mutates the same yaw/pitch pose.
8. Every `renderGameplayFrame()` integrates common keyboard/DOM movement before applying the camera, then renders whichever presentation the frame names.

### Most Likely Root Cause

The leading diagnosis is not a known production branch defect but an evidence/communication gap: the runtime input path is presentation-agnostic, while the highest-fidelity assembly interaction proof is Flow-centric. This can make “all presentations pass” sound stronger than the exact evidence: geometry/presentation tests cover all three, while actual-UI capture interactions currently run in Flow.

Evidence:

- `debugCameraSnapshot()` has no mode/presentation condition.
- Renderer listeners and pose integration have no presentation condition.
- Renderer tests render all presentations and separately test capture/movement.
- Assembly standard-batch tests prove all three mappings.
- Assembly product-shell interaction proof starts a Flow variant.

### Alternative Hypotheses

1. **Mode transition/session restart disables debug input** — plausible until actual UI mode-switch/Test sequencing is exercised. The common policy argues against it, but selected variant or session state could fail to settle.
2. **Boxing scene geometry makes rotation appear ineffective** — plausible visual/perceptual issue even when yaw changes; presentation-specific pixel sensitivity is needed.
3. **Touch/right-click lands on DOM controls instead of canvas** — possible user interaction issue, but independent of mode and contradicted when gestures originate on the canvas.
4. **Pointer-lock browser rejection** — handled by fallback and independent of mode, but should still be observed in each actual mode context.

### Why Previous Fixes Failed

The `0.0.30` control implementation itself has not been shown to fail this newly stated contract. The prior implementation fixed strict pointer-lock gating, key-step movement and world-axis reversal and added the requested toggle/touch GUI contract. The remaining weakness is that validation composed two separate facts—controls pass in actual Flow and all renderer presentations render—rather than proving their intersection through actual Flow/Lanes/Grid UI sessions.

### Unknowns

- Whether Derrick has already physically tried `0.0.30` capture in any mode.
- Whether each downloaded chart exposes compatible boxing variants in the physical test selection.
- Whether boxing visuals provide enough asymmetric geometry for rotation to be perceptually obvious.

Actual three-mode UI sessions with scalar pose and valid pixel evidence resolve these unknowns without screenshots leaving browser evaluation.

### Minimal Reproduction

For each gameplay mode:

1. Select the mode through the actual drawer.
2. Start Test and confirm the renderer presentation.
3. Right-click the canvas; confirm capture and yaw/pitch change on mouse movement.
4. Right-click again; confirm `none`. Re-enter and press Escape; confirm `none`.
5. Perform a two-finger tap; confirm touch capture. Drag one finger; confirm pose change. Tap two fingers again; confirm `none`.
6. Hold movement and use Reset; confirm gradual motion and scene-facing reset.
7. Pause/resume and confirm capture/intent cleanup and valid scene pixels.

The failure does not reproduce if all steps pass in all three presentations.

### Proposed Verification

Add one sensitive actual-UI regression that iterates Flow, Boxing Lanes and Boxing Grid and asserts, per mode:

- exact selected presentation and non-empty representative geometry;
- right-click pointer/fallback capture, mouse-look delta, second-click exit and Escape exit;
- two-finger capture, one-finger look, second two-finger exit and invalid gesture rejection;
- held keyboard/DOM camera-relative movement, speed and Reset;
- pause/resume cleanup;
- opaque valid composited pixels before/reset/resume and a presentation-sensitive scene.

This distinguishes a real mode-specific runtime defect from the leading test-coverage hypothesis.

### Recommended Fix

If the verification passes at unchanged production commits, add only the missing sensitive regression and truthful plan/handoff evidence. Do not alter production, bump the version, or claim a new runtime fix. If it fails, preserve the exact failing presentation/state transition, create a P0 discovered bug, diagnose the conditional path and only then make the smallest production correction followed by release QA.

Adjacent regressions: direct/real iframe, portrait/landscape, DPR1/3, coarse/fine input, scored fixed camera, terminal replay, timing/duration, privacy/lifecycle/context recovery and `0.0.30` artifact immutability.

### Debugging Record

```text
Problem: Requested capture parity is not proven end-to-end in all three actual UI presentations.
Observed symptom: No new concrete 0.0.30 failure reported; user restated toggle contract and requested Boxing Lanes/Grid parity.
Root cause: Leading diagnosis is a Flow-centric highest-fidelity interaction-test gap, not a confirmed production branch defect.
Evidence: Capture policy/listeners are presentation-agnostic; actual assembly interaction matrix starts Flow; separate tests cover boxing geometry/mapping.
Failed approaches: Prior evidence composed control proof and presentation proof separately instead of testing their intersection.
Corrective action: Add actual-UI three-presentation sensitive regression; patch production only if it exposes a real conditional defect.
Verification test: Per presentation, prove capture/look/second gesture/Escape, gradual movement/Reset/cleanup and valid pixels.
Related files/components: assembly src/index.js, scripts/validate-product-shell-matrix.js or focused validator, renderer src/renderer-facade.js.
Remaining uncertainty: Physical 0.0.30 mode-specific behavior and chart availability.
```

## Task 1 — Sensitive three-mode regression

**Bead:** `aerobeat-web-assembly-81f`
**Status:** Ready after diagnosis

Implement the smallest test-only actual-UI proof described above. Do not touch production or version/release surfaces unless a reproducible defect is found. Update the physical handoff to record this as automated parity evidence while leaving physical observations Pending.

## Task 2 — Independent QA

**Bead:** `aerobeat-web-assembly-edg`
**Status:** Blocked by Task 1

Independently inspect the evidence boundary, reproduce all three modes and reject any test that only composes separate control and presentation assertions.

## Task 3 — Final audit

**Bead:** `aerobeat-web-assembly-unk`
**Status:** Blocked by Task 2

Audit source immutability or any justified correction, all high-value gates, Beads/Git/server, `0.0.30` artifact immutability, and physical Pending truth. Close only on PASS.

## Deferred art slice

**Bead:** `aerobeat-web-assembly-ubg`
**Status:** Deferred by Derrick

Do not begin beat-art implementation until Derrick tests the completed control parity slice. The future plan should separately address silhouettes, contrast, directional glyphs, materials, threshold readability and mode-specific visual language without changing authoritative gameplay truth.
