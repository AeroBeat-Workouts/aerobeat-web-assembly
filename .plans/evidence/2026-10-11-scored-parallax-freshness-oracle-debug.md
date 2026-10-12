# Scored Play parallax browser freshness failure

## Exact observed failure
Normal assembly `npm run test:browser` reached `scripts/validate-scored-play-parallax-pixels.js:143` and failed `direct/high/standing: stale measurement 215.90000009536743`. The standalone test reproduced `181.90000009536743` with the same state. The test expects measured-pose age in `[0,150)` milliseconds. No scored judgement or visual result has yet been shown to regress.

## Expected behavior
Production consumes measured nose evidence while fresh (<=150 ms), moves the camera in a real scored Play frame, and renders the pinned GLB guard. The test must verify freshness **at the point where the frame consumes the pose**; elapsed time spent performing its own later negative-control framebuffer captures and pixel scans must not invalidate an already rendered pose.

## Execution path
`settle` feeds 24 measured poses, sleeps 35 ms between feeds, then feeds a final pose and calls `sample()` (`:120-122`). `sample()` invokes `element.rendererFrame()`, captures a framebuffer with the guard, disables the guard and captures again, restores and captures a third time, then scans up to 390×844 RGBA pixels (`:82-106`). Only **after** all that work does it read the measured-pose timestamp and compute `ageMs=performance.now()-measurementTimestampMs` (`:107-111`), and the outer test compares this end-of-proof age with production's 150-ms freshness bound (`:143`).

## Most likely root cause
The assertion measures the age **after** expensive GPU/browser pixel work, not before the production frame. The 181.9/215.9-ms results include test observation overhead. This is a test-clock/observer boundary mismatch, not evidence that the input was stale when rendered.

## Alternative hypotheses
1. The measured pose was already stale before `rendererFrame`—possible; read a pre-frame age to distinguish. If true, investigate `settle` scheduling or real production freshness, not the assertion.
2. A new corpse shader caused a delay—unlikely in a guard-only scored Play test that never displays a Flow corpse; the first asserted state is unrelated.
3. The 150-ms production limit is too strict—unsupported; do not alter it to make the browser test pass.

## Why previous approaches failed
The first full browser run stopped at this assertion. Repeating the focused script alone (without another heavy validation job) still failed at 181.9 ms, so this is not just concurrency in the full suite. No product-code change or threshold increase has been tried.

## Unknowns and minimal reproduction
A first diagnostic run measured **pre-frame age 4.7 ms** and **post-capture age 216.3 ms** in direct/high/standing with all other test assertions unchanged; this confirms a fresh input at frame start and observer time exceeding the 150-ms production threshold. The specific `rendererFrame` duration within that observation was not separately measured. Reproduce by running `node scripts/validate-scored-play-parallax-pixels.js` from the synced assembly with the real imported chart harness, phone viewport, direct/high/standing pose; it fails before the later iframe and lower camera cases. Do not interpret the first pre-frame age without checking calibration's possible 15-fps clock lead.

## Proposed verification and recommended fix
Record measured timestamp and age immediately **before** `rendererFrame`, plus the current after-capture age, without changing the original assertion yet. If age is fresh at frame start but stale after the three QA captures, change only the test's returned `ageMs` to the pre-frame age and continue to require measured provenance, GLB pixel movement, no score changes, and an independently intentionally stale sample recenter after a 200-ms delay. Re-run the focused and normal browser gate; if the pre-frame sample is genuinely stale, diagnose input scheduling instead. Avoid changing production scoring, freshness threshold or renderer.

## Debugging record
Problem: Assembly full browser gate cannot reach later Flow corpse test.
Observed symptom: measured nose age 215.9 ms, then 181.9 ms in standalone scored parallax assertion.
Root cause: confirmed test observer timing; input age was 4.7 ms before frame and 216.3 ms after pixel capture.
Evidence: test computes age after `rendererFrame` plus three framebuffer captures and pixel diff.
Failed approaches: isolated rerun still stale at post-capture measurement.
Corrective action: assert freshness at frame-consumption boundary if verified fresh there.
Verification test: pre-/post-capture age proof, focused direct/iframe scored pixels and full browser chain.
Related files/components: assembly `validate-scored-play-parallax-pixels.js`; production measured nose parallax input.
Remaining uncertainty: exact pre-frame pose age before instrumentation.
