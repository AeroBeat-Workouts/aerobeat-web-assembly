# C5 product-shell authoring inventory mismatch

## Exact Observed Failure

After D1 integration became green, `node scripts/validate-product-shell-matrix.js` failed in `verifyDebugCameraControls()` at line 547 for the first direct mobile Flow context.

The actual Visual Test panel correctly includes C5 equipment authoring:

- `aria-describedby="debug-camera-state environment-config-status test-presentation-status equipment-config-status"`
- a second explanatory paragraph
- equipment YAML textarea plus Apply / Reset defaults / Export `.yaml` controls

The oracle still expects the pre-C5 `aria-describedby` value without `equipment-config-status` and exactly one paragraph.

## Expected Behavior

The matrix must lock the integrated C5 accessibility/inventory contract rather than reject the newly approved equipment-config panel. It should prove the equipment field, three actions, and polite status output exist inside the same bounded Visual Test authoring panel while preserving camera/environment controls and safe-area behavior.

## Execution Path

1. C5 adds the equipment authoring fieldset and status linkage in `src/index.js`.
2. `verifyDebugCameraControls()` inventories the whole authoring panel.
3. The returned inventory truth includes the new status ID and paragraph.
4. The hard-coded pre-C5 assertion rejects that correct inventory before later shell rows run.

## Most Likely Root Cause

C5 added a dedicated browser oracle but did not update the product-shell matrix's integrated authoring inventory assertion.

## Alternative Hypotheses

- Product UI regression: contradicted by the exact expected C5 controls and status appearing in the failure payload.
- Safe-area overlap: contradicted by `within=true`, `noMenuOverlap=true`, and `noTransportOverlap=true`.
- Accessibility loss: contradicted by the polite status ID being added to `aria-describedby`; the stale oracle rejects the improvement.

## Why Previous Fixes Failed

The standalone equipment panel oracle verifies C5 behavior, but the product-shell matrix maintains a separate exact inventory lock. Updating only component rules and the dedicated oracle left this independent lock stale.

## Unknowns

None material. The panel contract is already declared in the C5 commit and dedicated tests.

## Minimal Reproduction

Run `node scripts/validate-product-shell-matrix.js` at assembly HEAD with current clean dependencies. It fails on the first context at the exact pre-C5 inventory assertion.

## Proposed Verification

Update the inventory capture/assertion to prove:

- the four-ID `aria-describedby` chain;
- equipment YAML textarea identity/label;
- Apply, Reset defaults, and Export `.yaml` actions;
- polite equipment status output;
- exactly two explanatory paragraphs;
- existing camera/environment controls, touch minimum, and overlap constraints unchanged.

Then rerun product-shell matrix and the dedicated C5 browser oracle.

## Recommended Fix

Update only `scripts/validate-product-shell-matrix.js` with the current exact C5 inventory. Do not change production code.

## Debugging Record

```text
Problem: Product-shell matrix rejects approved C5 equipment authoring UI.
Observed symptom: line 547 sees equipment-config-status and two paragraphs; expected pre-C5 status chain and one paragraph.
Root cause: stale integrated inventory oracle.
Evidence: exact failure payload shows all new controls with safe-area checks green.
Failed approaches: dedicated C5 oracle/component allowlist did not update the separate shell inventory lock.
Corrective action: add equipment controls/status/textarea assertions and update exact describedBy/paragraph count.
Verification test: product-shell matrix plus equipment-config-panel browser oracle.
Related files/components: scripts/validate-product-shell-matrix.js; src/index.js C5 equipment authoring panel.
Remaining uncertainty: none.
```
