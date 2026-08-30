# Task 12 Countdown Independent QA Debug Record

## Exact Observed Failure

Implementation `bfaafce` passes the focused mobile countdown validator, the eight-context product shell matrix, and unit contracts. Source inspection and live tests confirm ordered countdown state/cue behavior.

Independent QA first found an evidence defect: screenshot checks labeled the cue “high-contrast” but recorded only linear 8-bit luminance range (`maximum - minimum`). A range threshold does not establish an actual WCAG-style contrast ratio.

After hardening the analyzer, the eight-context matrix exposed a real product contrast defect on the first direct 390×844 DPR1 bright-Camera case. Actual cue screenshot contrast was `3.64:1` for 3, `3.41:1` for 2, and `2.81:1` for 1, below the required `4.5:1`. Aero measured about `19.6–19.9:1` and dark Camera measured `21:1`. The focused initial Aero test still passed.

## Expected Behavior

Each physical screenshot of the single DOM countdown cue over Aero, dark Camera, and light Camera composition must contain a visible pixel mask and demonstrate at least 4.5:1 contrast, in addition to ordered 3, 2, 1 state and at least 800ms dwell.

## Execution Path

1. `captureCountdownPresentation()` waits for each gameplay countdown value.
2. It screenshots the actual transient cue bounding box after Aero/dark-Camera/light-Camera composition changes.
3. `screenshotPixelRange()` decodes the PNG and scans nontransparent pixels.
4. The current helper returns only maximum minus minimum gamma-encoded luminance.
5. Assertions accept ranges of 90/120 as “high contrast” without computing a contrast ratio.

Countdown ordering and audio synchronization are correct in inspected evidence, but the presentation styling is not contrast-safe over bright Camera pixels:

1. Gameplay enters countdown while input may remain in release cooldown.
2. `transientCue()` now prioritizes finite countdown values before `Release`.
3. During tracking recovery, `runDisplayFrame()` gates gameplay while audio sync is pending, playing, or position-misaligned.
4. `pauseAudioForGameplay()` truthfully pauses and then invokes the audio service seek to the coordinator timeline.
5. Gameplay advances only after the authoritative clock reports stopped and exactly aligned; audio starts only after gameplay enters `playing`.

## Most Likely Root Cause

There are two layers:

1. The validator reused a simple pixel-variation heuristic that proves nonempty contrasting pixels but not a ratio.
2. Once measured correctly, the cue’s white text with only a blurred black shadow is insufficient over a bright Camera background. The blur produces no reliable dark boundary/backplate around every glyph; the numeral 1 is worst at `2.81:1`.

## Alternative Hypotheses

1. **Cue lacks physical contrast:** confirmed specifically over bright Camera pixels by actual ratios `3.64`, `3.41`, and `2.81`.
2. **Screenshot excludes composition background:** contradicted. Locator screenshots capture the composited bounding box, including transparent portions over the current game surface; dark/light Camera changes produce distinct valid rendered samples.
3. **Countdown remains masked by Release:** contradicted by exact state/cue assertions and ordered focused runs at `bfaafce`.
4. **Recovery advances against live audio:** contradicted by the delayed 250ms mismatch/pending-pause reproduction, but full-suite regression remains required.

## Why Previous Fixes Failed

Earlier validators sampled one finite state or one DOM string. The coder added ordered dwell and screenshot variation, correctly repairing those omissions, but treated pixel range as equivalent to contrast ratio.

## Unknowns

Physical Android camera content and display characteristics remain operator-dependent. Automated screenshots cannot replace Derrick’s physical confirmation.

## Minimal Reproduction

Read `screenshotPixelRange()` in `scripts/validate-product-shell-matrix.js`: it computes gamma-weighted minimum/maximum and returns only their difference. A pixel range can exceed the threshold without satisfying 4.5:1 contrast.

## Proposed Verification

Decode the same actual screenshots, convert channels to linear sRGB, calculate minimum and maximum relative luminance, and return `(lighter + 0.05) / (darker + 0.05)`. Require both a nontrivial pixel range and contrast >= 4.5 for every numeral/environment/context.

## Recommended Fix

Keep the hardened test analyzers and assertions. Add one compact opaque dark backplate to the existing transient cue (padding and rounded corners) so white digits retain at least 4.5:1 contrast over arbitrary Camera pixels. This remains exactly one minimal transient DOM cue and does not reintroduce a renderer/HUD duplicate. Do not change runtime ordering or audio behavior.

## Debugging Record

```text
Problem: Countdown contrast was asserted from pixel range and fails over bright Camera pixels.
Observed symptom: Hardened screenshot analysis measures bright-Camera 3/2/1 at 3.64:1, 3.41:1, and 2.81:1.
Root cause: Incomplete prior analyzer hid that a blurred shadow alone does not provide a reliable contrast boundary over bright imagery.
Evidence: Aero is ~19.6–19.9:1, dark Camera 21:1, while the same actual bright-Camera screenshots fail 4.5:1.
Failed approaches: Treating broad pixel variation and text-shadow presence as a contrast-ratio proof.
Corrective action: Retain actual ratio analysis and add a compact opaque dark backplate to the one DOM cue.
Verification test: Every 3/2/1 Aero/dark-Camera/light-Camera screenshot has a visible mask and >=4.5:1 contrast.
Related files/components: scripts/validate-mobile-gameplay-menu.js; scripts/validate-product-shell-matrix.js; transient countdown cue.
Remaining uncertainty: Physical Android legibility remains for Derrick’s retest.
```
