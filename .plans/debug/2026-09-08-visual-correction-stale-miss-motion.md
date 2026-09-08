# Visual-correction stale miss-motion expectation

## Exact Observed Failure

The post-product-shell browser tail failed at `scripts/validate-visual-correction-integration.js:78`:

> `AssertionError: miss must continue past the athlete along authoritative timeline motion`

The assertion requires `evidence.missIcon.position.z > 0`.

## Expected Behavior

Derrick's second physical feedback requires one continuous target at the crossing: unresolved through the `+180 ms` late window, then atomically gray on miss commit, frozen at `Z=0`, followed by one bounded expiry. The exact real-map browser oracle and renderer facade already verify `Z=0` at `+1`, `+180`, and `+181 ms`.

## Execution Path

The visual-correction fixture creates a committed miss, assembly projects it, renderer builds its icon, the browser oracle captures `missIcon`, then an old assertion expects post-crossing positive Z motion.

## Most Likely Root Cause

This independent integration assertion preserves the superseded pre-feedback motion contract. Runtime output follows the approved new freeze-at-crossing contract, so the test—not the implementation—is stale.

## Alternative Hypotheses

- Renderer freeze failed: contradicted by this assertion failing specifically because Z is not positive and by passing unit/real-map exact-Z evidence.
- Miss icon is absent: contradicted; the preceding appearance-color assertion evaluates the same object and passes.

## Why Previous Fixes Failed

Renderer unit and real-map regression expectations were updated, but this separate browser matrix assertion was missed. The full browser suite is fail-fast and did not expose it until the earlier Game Setup allowlist failure was repaired.

## Unknowns

Later browser-tail scripts still need execution after this assertion is corrected.

## Minimal Reproduction

Run `node scripts/validate-visual-correction-integration.js` on assembly commit `1608a2c`.

## Proposed Verification

Replace only the stale motion expectation with exact `Z=0`, retain gray color, shadow, shake, timing, and matrix checks, then rerun the script and remaining/full browser suite.

## Recommended Fix

Assert exact crossing freeze. Do not loosen the condition or change runtime code.

## Debugging Record

```text
Problem: Browser integration oracle expects superseded miss motion.
Observed symptom: Requires miss Z > 0.
Root cause: Stale independent test after approved continuous crossing-to-gray design.
Evidence: Renderer unit and four-row real 3c9d oracle pass exact Z=0 at +1/+180/+181.
Failed approaches: Updating only earlier renderer and real-map tests.
Corrective action: Require exact Z=0 here.
Verification test: visual-correction integration and complete browser tail/suite.
Related files/components: scripts/validate-visual-correction-integration.js, renderer gameplay-scene-model.
Remaining uncertainty: Later fail-fast browser stages.
```
