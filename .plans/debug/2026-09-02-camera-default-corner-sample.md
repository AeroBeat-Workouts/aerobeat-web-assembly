# Camera-default corner-sample diagnostic — 2026-09-02

## Exact Observed Failure

A temporary out-of-tree shell-matrix copy bypassed the separately proven baseline cadence flake so the current camera patch could reach later checks. It then failed at tracked source line 186 via `assertValidAeroCanvasSample()`:

```text
Error: direct:844x390@3 flow:afterReset must be a valid opaque Aero-background canvas sample: {"errors":["corner [171,76,94,255] is not opaque Aero background [7,20,38,255]"]...}
```

The sample was otherwise valid: 1,316,640/1,316,640 pixels opaque, 388,616 Aero-background pixels, and 928,024 non-background pixels.

## Expected Behavior

The authorized camera default `{x:0.05,y:1,z:5}` with zero Euler rotation must render all game modes correctly at all tested viewport/DPR combinations. The canvas validator should prove opaque Aero background and a complete background/non-background partition without assuming a particular pixel remains uncovered by gameplay geometry.

## Execution Path

1. Visual Test starts Flow at direct landscape `844x390`, requested DPR 3 (capped to 2).
2. The test exercises debug camera controls and invokes Reset.
3. Reset applies the new authorized closer, level camera pose.
4. `verifyVisualTestScenePixels()` samples the whole rendered canvas and records the top-left corner.
5. `assertValidAeroCanvasSample()` calls `canvasSampleValidationErrors()`.
6. Canvas-wide opacity/background/partition checks pass.
7. The final fixed-corner check compares one pixel to `#071426` and fails because visible scene geometry now covers that pixel.

## Most Likely Root Cause

The test encoded the old camera composition as an invariant: it required the top-left pixel to remain bare background. The newly authorized default legitimately changes framing and allows gameplay geometry to cover that pixel. Whole-canvas evidence proves the configured opaque background is still present and correct, so the fixed-corner requirement is stale rather than a renderer defect.

## Alternative Hypotheses

1. **Canvas clear/background regression (contradicted).** The configured background is `#071426`, all pixels are opaque, and 388,616 pixels exactly match background.
2. **Incorrect reset pose (unlikely).** Renderer camera-pose and browser tests independently passed the exact reviewed default and reset behavior.
3. **Sampling corruption (contradicted).** Buffer dimensions, DPR, sampled-pixel count, source sample count, opacity, and partition checks all passed.

## Why Previous Fixes Failed

No fix has been attempted. The cadence-only temporary bypass was diagnostic and correctly exposed this later, unrelated stale assertion; it did not modify tracked code.

## Unknowns

No material root-cause unknown remains. Other viewport/mode states still need the full matrix rerun after the narrow validator correction.

## Minimal Reproduction

Run the shell matrix far enough to reach `direct:844x390@3`, Flow `afterReset`, with the reviewed default active. The top-left pixel is scene-colored while the canvas still contains hundreds of thousands of correct opaque background pixels.

## Proposed Verification

Remove only the fixed-corner invariant, retain all canvas-wide checks, and update the self-test to prove transparent/zero-background samples still fail through `opaquePixels` and `backgroundPixels`. Then rerun the matrix (using the documented temporary cadence bypass only when necessary to reach later assertions).

## Recommended Fix

Delete the top-left corner comparison from `canvasSampleValidationErrors()`. Preserve DPR, dimensions, sampled-count, configured-background, full-opacity, positive-background, non-background, and exact partition checks. Update the validator self-test to require opacity and positive-background errors rather than a corner error.

## Debugging Record

```text
Problem: Shell pixel validator rejects authorized camera framing.
Observed symptom: top-left pixel is scene-colored after Reset at direct 844x390@3 Flow.
Root cause: stale test invariant assumes one fixed pixel must remain uncovered background.
Evidence: all 1,316,640 pixels opaque; 388,616 exact background pixels; all other validation passed.
Failed approaches: None; cadence bypass was diagnostic only.
Corrective action: remove fixed-corner assertion while preserving canvas-wide background/opacity invariants.
Verification test: shell matrix plus validator self-test.
Related files/components: scripts/validate-product-shell-matrix.js; reviewed gameplay camera default.
Remaining uncertainty: none beyond full-matrix regression rerun.
```
