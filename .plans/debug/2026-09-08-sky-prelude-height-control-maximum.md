# Sky Prelude Height Native-Control Maximum

## Exact Observed Failure

Direct source inspection shows the actual Visual Test `skyPreludeHeightWorldUnits` number input in `src/index.js` advertises `max="24"`. Audit comment `01a082cd-4935-70c7-905b-28a25c2258fc` identifies the same P0 user-facing defect. This is directly observed markup, not an inferred renderer failure.

## Expected Behavior

The native number control must expose `max="50"`, accept and commit exactly `50`, and report/reject values above `50`. The strict renderer authority already accepts `[0,50]` in `aerobeat-web-renderer/src/test-presentation-config.js`. The default must remain `24`; lower bound, step, strict schema, private-only state, and connection/session lifecycle behavior must remain unchanged.

## Execution Path

A Visual Test enables the private authoring fieldset. User input/change events from `[data-test-presentation-field='skyPreludeHeightWorldUnits']` reach `applyTestPresentationControls()` in `src/index.js`. That method reads all native controls, converts number inputs with `Number(input.value)`, and calls renderer `createTestPresentationConfig(...)`. A valid branded config flows through `commitTestPresentationConfig()`, `renderer.setTestPresentationConfig()`, private `testPresentationConfig`, and `renderTestPresentationControls()`. Invalid values throw in strict renderer construction; the catch preserves the prior private config. The failing HTML `max="24"` acts earlier at the browser constraint-validation surface, making renderer-supported values `24…50` invalid to the user-facing control.

## Most Likely Root Cause

The renderer/schema bound was raised from `24` to `50`, but the independently authored assembly HTML attribute remained `24`. Evidence: renderer bounds are `skyPreludeHeightWorldUnits:[0,50]`, its default constructor still uses `24`, while assembly markup contains `max="24"`.

## Alternative Hypotheses

1. **Renderer still rejects 50 — contradicted.** Renderer unit authority explicitly accepts `50` and rejects `50.000001`.
2. **Assembly commit code clamps to 24 — contradicted.** It forwards `Number(input.value)` to renderer construction without a separate clamp.
3. **Lifecycle disables the field — not causal.** Lifecycle gating controls availability, but the defect remains whenever Visual Test authoring is enabled.

## Why Previous Fixes Failed

The prior real-map oracle assigned every control's `.value` inside `evaluate()`, including sky height `"50"`, then dispatched input/change only on the separate `skyMode` select. Programmatic `.value` assignment can place `50` in a number input even when its declared maximum is `24`, and committing via another valid control never asserts the sky-height control's `max`, native `validity.rangeOverflow`, focus/blur commit behavior, or above-bound rejection. The oracle therefore proved downstream schema/trajectory behavior while bypassing the defective native control contract.

## Unknowns

No root-cause uncertainty remains. Browser assertions are still required to prove Chromium's direct and genuine cross-origin iframe native-control behavior after repair.

## Minimal Reproduction

1. Open Visual Test and enable its authoring controls.
2. Locate the native `skyPreludeHeightWorldUnits` number input.
3. Observe `input.max === "24"`.
4. Enter `50` through that control: native validity reports range overflow under current source even though renderer construction accepts 50.

The defect is absent only when bypassing native validation (for example, assigning `.value` and committing through another field) or when using values at or below 24.

## Proposed Verification

In Chromium, for both direct embedding and a genuinely cross-origin child iframe: assert the actual element is `type=number`, `min` and `step` are unchanged, `max === "50"`, and default value/private config are `24`; drive the real locator with Playwright `fill("50")` and blur/Tab, then assert value `50`, `validity.valid === true`, no range overflow, and private config committed to 50. Next drive that same locator with `fill("51")` and blur/Tab, assert `validity.rangeOverflow === true`, and assert private configuration did not commit 51. Retain existing reset, strict JSON, privacy, and stale lifecycle assertions.

## Recommended Fix

Change only the existing sky-height input's `max` attribute from `24` to `50`. Add the native-control assertions to the existing direct/genuine-cross-origin environment-controls browser behavior matrix, which already covers strict config, privacy, reset, and lifecycle. Do not change defaults, schema, renderer, package version, raw releases, serving, or asset tooling.

## Debugging Record

```text
Problem: Assembly native sky-height constraint lags renderer authority.
Observed symptom: Actual number input has max=24 while accepted bound is 50.
Root cause: Independent HTML max attribute was not raised with renderer schema bound.
Evidence: src/index.js max=24; renderer bound [0,50], default 24, explicit 50 acceptance.
Failed approaches: Real-map oracle assigned value=50 programmatically and committed via skyMode, bypassing the sky-height native constraint path.
Corrective action: Change only input max to 50 and add direct/iframe native-control tests.
Verification test: Same native input commits valid 50; 51 reports rangeOverflow and does not commit, in direct and genuine cross-origin iframe contexts.
Related files/components: src/index.js; scripts/validate-environment-controls-browser.js; scripts/validate-real-3c9d-trajectory-controls.js; renderer test-presentation-config.js.
Remaining uncertainty: None in root cause; Chromium matrix remains to be run after repair.
```
