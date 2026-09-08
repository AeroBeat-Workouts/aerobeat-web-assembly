# Product-shell Game Setup allowlist failure

## Exact Observed Failure

`npm run test:browser` failed in `scripts/validate-product-shell-matrix.js:490` through `assertExactDrawer`:

> `direct:390x844@1 baseline exact drawer visible-text allowlist failed`

The actual visible-text inventory contained `Game Setup` and `Show 4 × 3 grid`; the expected inventory did not. All preceding browser suites, including the focused mobile drawer test, passed.

## Expected Behavior

The approved second-feedback contract adds a Game Setup section and a default-on `Show 4 × 3 grid` checkbox. The exact full-shell inventory must include those two product strings and continue rejecting any other text drift.

## Execution Path

1. `AeroGame` builds the existing drawer template.
2. `installGameSetupControls()` prepends the new section to `.drawer-content`.
3. `validate-product-shell-matrix.js` traverses the composed visible shell inventory.
4. `assertExactDrawer()` compares the inventory against `baseDrawerText`.
5. `baseDrawerText`, unlike the separately updated focused mobile allowlist, still represents the pre-Game-Setup drawer.

## Most Likely Root Cause

The implementation intentionally changed the product-visible drawer contract, but the independent full-shell oracle's exact expected inventory was not updated. Evidence: the actual set differs by exactly the two authorized strings, and `baseDrawerText` at line 47 lacks exactly those strings.

## Alternative Hypotheses

1. **Game Setup inserted in the wrong composed subtree — low likelihood.** The focused mobile oracle now verifies the ordered five sections under `.drawer-content`, one-surface containment, and the checkbox behavior.
2. **Unexpected duplicate controls — contradicted.** The actual inventory contains each new string once; section and input counts are already checked in the focused oracle.
3. **Product copy is wrong — contradicted.** Actual copy exactly matches Derrick's requested `Game Setup` and `Show 4 × 3 grid`.

## Why Previous Fixes Failed

The focused `validate-mobile-gameplay-menu.js` allowlist and taxonomy were updated after its first failure. That test passed, but the assumption that it was the only exact visible-copy inventory was incomplete. `validate-product-shell-matrix.js` owns a separate exact array and therefore failed later in the complete suite.

## Unknowns

None affecting the root cause. The remainder of the full browser suite did not execute after this fail-fast assertion and must be rerun after correction.

## Minimal Reproduction

Run `node scripts/validate-product-shell-matrix.js` against the current assembly. Any baseline direct mobile context renders the authorized new section, then fails against the stale `baseDrawerText`.

## Proposed Verification

Add only the two authorized strings to `baseDrawerText`, rerun the product-shell matrix, then rerun the complete browser suite. Any other visible text must still fail the exact-set comparison.

## Recommended Fix

Update the oracle's immutable expected product inventory by inserting `Game Setup` and `Show 4 × 3 grid` in product order after `Start`/`Test`. Do not loosen, filter, or subset-match the inventory.

## Debugging Record

```text
Problem: Full product-shell browser oracle rejects authorized Game Setup copy.
Observed symptom: Actual inventory has Game Setup and Show 4 × 3 grid; expected inventory does not.
Root cause: Separate exact baseDrawerText remained on the pre-feedback contract.
Evidence: Focused drawer oracle passes; full actual/expected set differs by exactly two requested strings; source line 47 omits them.
Failed approaches: Updating only validate-mobile-gameplay-menu.js's separate taxonomy and allowlist.
Corrective action: Add exactly the two authorized strings to baseDrawerText.
Verification test: validate-product-shell-matrix.js, followed by npm run test:browser.
Related files/components: scripts/validate-product-shell-matrix.js, src/index.js Game Setup section.
Remaining uncertainty: None; later fail-fast browser stages still need execution.
```
