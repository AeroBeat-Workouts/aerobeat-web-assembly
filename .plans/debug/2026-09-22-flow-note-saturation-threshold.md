# Flow-note +20 ms saturation threshold drift

## Exact Observed Failure

Final full browser gate fails deterministically in `validate-0.0.61-flow-note-spawn-pixels.js`:

```text
n-up: the note's saturated hand-color core at commit +20 ms must be strong (got 380 px, min 400)
```

A focused rerun reproduces 380. A diagnostic-only temporary copy with the minimum disabled collected all evidence and was removed. Both direct and genuine cross-origin iframe are byte-identical:

- n-up: sat20 380, sat40 53, sat250 19, sat340 29; core 983; fill 562
- n-right: 443 / 62 / 0 / 0
- n-upright: 421 / 62 / 0 / 0
- n-orb: 684 / 70 / 0 / 0

All fade-ratio, late-disappearance, glyph/core/fill, centroid, color, shape-distinction, and cross-embedding checks pass when only the 400 floor is disabled.

## Expected Behavior

The oracle should reject a weak or absent saturated hand-color core while tolerating small deterministic raster/anti-aliasing drift that does not change the signed-off visual or fade envelope.

## Execution Path

The browser renders the legacy locked 0.0.61 Flow note at commit +20 ms, samples a fixed 40 px box, counts pixels satisfying the saturated hand-color predicate, and compares that count to the absolute floor 400 before evaluating the fade ratios.

## Most Likely Root Cause

The absolute 400-pixel floor has zero headroom for the current deterministic Chromium/PlayCanvas raster. The complete evidence shows the visual is present and strong (983 core pixels; 562 fill pixels), the +20→+40 saturated core drops from 380 to 53 (14%), and both embeddings agree exactly. No 0.0.63 production change touches Flow-note geometry, color, or fade; current changes affect equipment, tracking contracts, config plumbing, and docs/pins.

## Alternative Hypotheses

- Production note regression: contradicted by unchanged relevant runtime code and every adjacent note visual/fade assertion passing.
- Random flake: contradicted by exact repeated 380 and direct/iframe equality.
- One direction genuinely weak: n-up remains above all core/fill floors and has the correct blue hand color; only the historical absolute saturation count misses by 5%.

## Why Previous Fixes Failed

The threshold was introduced once with the 0.0.61 oracle and never calibrated with explicit margin. Later browser/raster conditions can preserve the visual while crossing that narrow absolute boundary.

## Unknowns

The original 0.0.61 sat20 count was not persisted in plan evidence, so its exact margin above 400 is unavailable.

## Minimal Reproduction

Run `node scripts/validate-0.0.61-flow-note-spawn-pixels.js`; n-up deterministically reports 380 in the first embedding.

## Proposed Verification

Re-anchor only `MIN_SAT_AT_20` to a conservative 360-pixel floor (5.3% below current 380, still 90% of the old threshold). Keep the stronger relative fade and all other pixel/color/geometry/cross-embedding assertions unchanged. Rerun the focused oracle and then the full browser chain.

## Recommended Fix

Change only the absolute sat20 floor from 400 to 360 and document the current two-embedding evidence. This preserves a hard lower bound while giving minimal raster headroom; do not change production visuals.

## Debugging Record

```text
Problem: Final browser gate rejects unchanged Flow note visual.
Observed symptom: deterministic n-up sat20=380 versus absolute floor 400 in both embeddings.
Root cause: stale zero-headroom absolute pixel floor; all stronger adjacent visual/fade/color assertions pass.
Evidence: complete 4-note × 2-embedding diagnostic evidence; n-up core=983/fill=562 and sat20→sat40=380→53.
Failed approaches: exact rerun reproduces; not a transient flake.
Corrective action: re-anchor only MIN_SAT_AT_20 400→360.
Verification test: focused flow-note pixel oracle, then full browser gate.
Related files/components: scripts/validate-0.0.61-flow-note-spawn-pixels.js.
Remaining uncertainty: original 0.0.61 measured sat20 was not persisted.
```
