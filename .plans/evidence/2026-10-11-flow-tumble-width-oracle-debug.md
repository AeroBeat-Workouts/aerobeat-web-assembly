# Legacy Flow tumble-width oracle conflicts with fixed centerline mask

## Exact observed failure
The post-shell browser remainder passed real GLB/noise tests through `validate-0.0.58-aftermath-pixels.js`, then `scripts/validate-0.0.59-fall-offscreen-pixels.js:227` failed direct mode: `flow slice bbox width must keep varying (continuous tumble), got 2 distinct values (need 3): 92,113`. Its *real framebuffer* flow samples are +0 ms 3,146 pixels, bbox width 92, lowest row 228; +200 ms 2,645 pixels, width 113, row 232; +500 ms 2,114 pixels, width 113, row 296; by +900 ms no visible pixels. The punch samples show widths 64→59→44→5 and keep descent/fade. Log `/tmp/aerobeat-assembly-browser-post-shell-remainder.log:14-33`.

## Expected behavior
The original 0.0.59 visual test must prove a Flow corpse continues its single accelerating fall and *tumble*, with no old bounce/settle branch, in direct and cross-origin real frames. New Flow arrow corpse geometry intentionally clips **both halves along a fixed full-length centerline**, not along a variable contact point. A failure due only to equal bbox widths for two distinct rotating poses is a stale visual proxy, but dropping the rotation assertion entirely would weaken the gate.

## Execution path
The script runs a real `aero-game` facade scene at six fixed post-hit times. For each time it samples the canvas with and without one Flow aftermath entry, segments differing pixels, records per-frame count/centroid/bbox and screen-lowest row, and in `checkBody()` first proves fade/accelerated descent/smooth width continuity, then asserts at least three distinct bbox widths among all visible Flow frames. The new renderer fixed-mask material affects the cross-sectional silhouette of each half, so a rotating shape can project to identical integer widths at +200 and +500 despite different lowest rows and pixel count. The oracle fails on the **last width distinctness clause**; all earlier fall/fade/smoothness clauses passed in this run.

## Most likely root cause (hypothesis)
The old three-width invariant was calibrated to contact-varying clip geometry; full-centerline two-half geometry and integer pixel quantization yield only two widths across the three visible resolved samples. The unchanged aftermath pose may still rotate, but current evidence alone does not prove that rotation: lowest-row motion/pixel count also follow gravity/fade.

## Alternative hypotheses
- Production rotation regressed/froze: plausible; this visual assertion could be correctly catching a real loss of tumble. Inspect `aftermathPose` orientation and measure a pixel-derived orientation statistic before changing test thresholds.
- GPU frame/skipped sample: unlikely, because explicit deterministic `renderGameplayFrame(nowMs)` returns distinct counts/rows and punch changes widths; no rAF cadence drives these captures.
- Segmentation noise: possible but same direct/iframe data test after instrumentation would distinguish; current thresholded pixels number in thousands, not blank.

## Why earlier fixes did not resolve it
The centerline scope changed visual clipping but did not aim to alter motion. Earlier scored GLB centerline oracle verified shape and metadata, while this legacy fall oracle uses old width-based rotation proxy and was reached only after unrelated full-gate blockers were removed.

## Unknowns and minimal reproduction
Need direct orientation of the actual Flow piece or a rotation-sensitive **framebuffer** metric (e.g. normalized pixel covariance principal axis) across +0/+200/+500 and a frozen-rotation counterfactual. Run unchanged focused `node scripts/validate-0.0.59-fall-offscreen-pixels.js` for RED then instrument only its pixel-stat diagnostic to distinguish unchanged tumble from frozen pose. There may be other downstream legacy tests calibrated to old clip geometry.

## Proposed verification
Establish that production `aftermathPose` orientation changes at the three times. Add a signed pixel covariance / principal-axis or shape moment to the *same real-canvas sampler* and show it changes in direct and iframe even if widths plateau; then replace the stale width-distinctness proxy with an assertion on that rotation-sensitive metric while retaining existing monotonic descent, smooth width, fade/cull, and punch checks. In a disposable fixture mutate **only production tumble rotation** to fixed while keeping unchanged new test; it must fail specifically on orientation, not setup or unrelated geometry. Restore and rerun focused and normal suffix.

## Recommended fix
Do **not** lower `minWidthVariants` from 3 to 2 or drop the check without a stronger rotation-sensitive framebuffer replacement; that would permit a frozen piece whose perspective width changes. First gather orientation evidence and prove a bug-specific negative control. No scoring or renderer motion changes unless orientation itself has regressed.

## Debugging record
Problem: fixed full-length centerline corpse fails legacy three-width tumble assertion.
Observed symptom: real Flow widths 92,113,113 at +0/+200/+500, but falling rows/pixels remain distinct.
Root cause: unconfirmed stale width proxy versus actual lost rotation.
Evidence: named script line 227, deterministic six-frame pixel log, new fixed-mask geometry.
Failed approaches: earlier relevant centerline test did not cover old continuous-tumble proxy; no fix yet.
Corrective action: measure orientation in actual framebuffer and keep a frozen-tumble counterfactual before replacing proxy.
Verification test: same focused real-canvas direct/iframe GREEN, production rotation mutant RED, restored GREEN.
Related files/components: assembly `scripts/validate-0.0.59-fall-offscreen-pixels.js:103-135,215-233`; renderer `src/renderer-facade.js` aftermath pose/shader.
Remaining uncertainty: the complete browser suite still has a separate software-GPU product-shell cadence failure; this corrected Flow visual test is not a physical-phone performance measurement.

## Verification result
The project-owned test now computes normalized second moments **from actual baseline-differenced canvas pixels** at +0/+200/+500. Translation and uniform perspective scaling cancel in the normalized X/Y variance difference. Fixed-centerline Flow widths plateau at 92,113,113, yet the real rendered shape's normalized anisotropy changes 0.3329→0.5321→0.7505 (Δ0.4176 >0.25). The same production scene/render/GLB path with **only** `renderer.tuning.aftermathSettledTumbleRadPerS` temporarily zeroed (original object restored in finally) produces 0.3329→0.2915→0.2877 (Δ0.0452 <0.08) and the **identical positive assertion** is required to throw. The unchanged fall/descent/fade, punch, strict noise and genuine cross-origin iframe checks remain. Scoped coder and parent independently ran `node scripts/validate-0.0.59-fall-offscreen-pixels.js` GREEN for direct and iframe; parent output `/tmp/aerobeat-centerline-tumble-zero-rate-green.log` shows both controls. No production motion/scoring or fixed mask was changed, and simply lowering the old width count was rejected.
