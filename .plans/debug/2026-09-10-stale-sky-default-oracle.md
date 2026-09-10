# Stale environment-controls sky-default oracle diagnosis

## Exact Observed Failure

Running `node scripts/validate-environment-controls-browser.js` during exhaustive console-policy validation fails because the test expects the sky-height input and private config default to be `24`, while the browser exposes `50`.

The stale assertions are in `scripts/validate-environment-controls-browser.js` around lines 154-168: native input value `24`, private default `24`, and restoration to `24`.

Direct source evidence establishes current authority as `50`:

- `aerobeat-web-renderer/src/test-presentation-config.js` allows `[0,50]` and its default config resolves to `50`.
- Renderer `validate-third-feedback.js`, `validate-browser-renderer.js`, and `validate-test-presentation.js` assert the approved default is `50`.
- Assembly `validate-real-3c9d-trajectory-controls.js` asserts the assembled default is `50` and independently validates maximum/overflow behavior.

## Expected Behavior

The environment-controls browser validator must expect the authoritative default `skyPreludeHeightWorldUnits=50`, continue proving the native maximum `50` is valid, prove `51` is invalid and does not commit, and restore the authoritative default `50`.

## Execution Path

1. Assembly imports the pinned renderer default test-presentation config.
2. The game renders the sky-height number input from that config.
3. Browser runtime correctly gives the input and private config value `50`.
4. The validator compares them to obsolete literal `24` values.
5. The assertion fails before completing the direct/iframe, viewport, and DPR matrix.

## Most Likely Root Cause

The renderer's third-feedback sky-height repair changed the approved default from `24` to `50`, and primary renderer/trajectory tests were updated, but this optional environment-controls browser validator retained three old literals. It is a stale test oracle, not runtime drift.

## Alternative Hypotheses

1. **Runtime accidentally initializes to maximum instead of default.** Contradicted by renderer source and multiple authoritative tests explicitly defining default `50`.
2. **Only direct embedding should use `24`.** Contradicted by shared config and the validator's own intent to prove parity across direct/iframe modes.
3. **The console-policy edit changed configuration.** Contradicted by its import/callback-only diff and by current renderer authority preceding that edit.

## Why Previous Fixes Failed

The validator is not included in the main `npm run test:browser` command, so previous full-suite PASS did not execute it. The exhaustive collector rerun was the first recent gate to invoke every affected script individually.

## Unknowns

None affecting the minimal repair. Exact line numbers may shift while the console-policy coder adds imports/callbacks, so implementation must identify assertions semantically rather than by fixed line.

## Minimal Reproduction

Run `node scripts/validate-environment-controls-browser.js` against current pinned renderer authority. The first sky-default assertion compares actual `50` to expected `24` and fails. Other renderer configuration tests pass with `50`.

## Proposed Verification

Change only the three stale default/restoration expectations to `50`. Run the complete environment-controls browser matrix (direct and cross-origin iframe; portrait and landscape; DPR 1 and 3), renderer test-presentation/third-feedback tests, full assembly unit/browser suites, build/pack, fingerprint, release-target, immutable-history, and diff checks.

## Recommended Fix

After the in-flight console-policy commit settles, update only the stale `24` default/restoration literals and assertion prose in `validate-environment-controls-browser.js` to `50`. Do not change runtime source, numeric bounds, maximum handling, or overflow handling. Keep this in its separate Bead `aerobeat-web-assembly-6egv` and require independent QA `aerobeat-web-assembly-26ym`.

## Debugging Record

```text
Problem: Environment-controls browser validator expects obsolete sky-height default 24.
Observed symptom: actual browser input/private config is 50 and assertion fails.
Root cause: optional validator missed the approved third-feedback default update to 50.
Evidence: renderer config source and three renderer tests plus assembly trajectory test all require 50.
Failed approaches: relying on the main browser suite, which does not invoke this optional validator.
Corrective action: update only three stale default/restoration assertions to 50 after rwfk lands.
Verification test: full direct/iframe viewport/DPR matrix plus renderer and assembly suites.
Related files/components: validate-environment-controls-browser.js; renderer test-presentation-config.js and its tests.
Remaining uncertainty: none beyond line shifts caused by the concurrent console-policy import.
```
