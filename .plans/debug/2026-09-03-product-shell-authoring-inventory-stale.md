# Product shell matrix stale authoring inventory

## Exact Observed Failure

Independent audit ran `npm run test:browser`; it exited 1 at `scripts/validate-product-shell-matrix.js:277`. Isolated `npm run test:shell-matrix` reproduced at the first direct `390×844`, DPR 1, Flow row.

The assertion still requires:

- `aria-describedby="debug-camera-state"`
- the complete panel button inventory to equal exactly ten camera-control `aria-label` values
- `aria-pressed="false"` on the first seven buttons

The current product intentionally renders one combined Visual Test authoring panel with `aria-describedby="debug-camera-state environment-config-status"`, an accessible collapse button before the camera controls, and Load/Save/Retry environment buttons after them. The latter have visible text accessible names rather than redundant `aria-label` attributes.

## Expected Behavior

The mandatory product shell matrix must validate the integrated Visual Test authoring surface rather than an obsolete camera-only DOM inventory. It must retain exact camera-control assertions while also recognizing the collapse control, environment status description, and visible-text environment actions. The full `npm run test:browser` gate must pass without weakening camera movement, accessibility, safe-area, privacy, or lifecycle coverage.

## Execution Path

1. `npm run test:browser` invokes `node scripts/validate-product-shell-matrix.js`.
2. `verifyVisualTestScenePixels(...)` enters Flow and calls `verifyDebugCameraControls(...)`.
3. `verifyDebugCameraControls(...)` queries every `button` under `[data-role='debug-camera-controls']` into one undifferentiated array.
4. It maps only each button's explicit `aria-label`, then compares the entire array with an exact ten-item legacy camera list.
5. Because the combined panel now starts with the collapse button and ends with three environment action buttons, array length/order/content differ; visible-text accessible names appear as null attributes.
6. The same stale indexing makes `pressed.slice(0,7)` begin with the collapse button rather than the seven camera speed/movement controls.
7. The assertion fails before the remaining shell matrix can execute.

## Most Likely Root Cause

The shell validator encodes the old camera-only panel structure. The implementation was expanded correctly, and focused environment-control tests cover the new surface, but the mandatory cross-mode product shell validator was not updated to select camera controls semantically and validate the integrated authoring controls separately.

Evidence:

- `src/index.js` gives the panel `aria-label="Visual Test authoring controls"` and `aria-describedby="debug-camera-state environment-config-status"`.
- The collapse button has an explicit dynamic accessible label and `aria-expanded`.
- Environment Load/Save/Retry buttons use visible text, which supplies their accessible names without `aria-label`.
- `scripts/validate-product-shell-matrix.js:275-277` queries all panel buttons and assumes exactly ten camera buttons.
- Focused `npm run test:environment-controls-browser`, full `npm test`, build, packaging, and eight-row authoring layout matrices pass.

## Alternative Hypotheses

1. **Implementation accessibility regression:** unlikely. The collapse button has an explicit label; Load/Save/Retry have visible text; focused accessibility checks pass.
2. **Button order changed unexpectedly:** contradicted by intentional template order and repeatable first-row failure.
3. **Iframe or DPR-specific rendering issue:** contradicted by failure in the first direct DPR1 row before iframe/DPR variants.
4. **Environment status ID missing:** contradicted by current markup and focused tests.

## Why Previous Fixes Failed

Prior repair work correctly added focused executable authoring controls tests and fixed landscape overlap, but it treated the new focused validator as sufficient coverage. It did not run or update the pre-existing mandatory `test:browser` shell matrix, whose camera-only exact inventory assumptions remained stale. No prior attempted fix targeted this assertion.

## Unknowns

- Whether later product-shell assertions also assume camera-only panel indexing after line 277. A complete semantic audit of the remainder of `verifyDebugCameraControls` is required.
- Whether the combined panel should gain additional product-shell assertions for collapsed state here or rely on the focused environment validator. The minimal repair should at least verify the integrated panel identity/descriptions and environment action inventory while preserving existing camera checks.

## Minimal Reproduction

From the assembly repo run:

```bash
npm run test:shell-matrix
```

The first direct `390×844`, DPR 1, Flow row fails at `validate-product-shell-matrix.js:277`. `npm run test:environment-controls-browser` passes because it understands the combined authoring surface.

## Proposed Verification

Before changing source behavior, inspect the runtime inventory grouped by semantic selectors:

- collapse: `[data-action='debug-controls-collapse']`
- camera movement/speed/reset/load/export controls by their existing camera data attributes/actions
- environment actions: `[data-action^='environment-']`
- panel description IDs and environment status output

Confirm the ten camera labels and seven camera pressed states are unchanged when selected semantically. Then update the matrix assertion and run isolated `npm run test:shell-matrix`, full `npm run test:browser`, focused environment controls, full `npm test`, build, and `git diff --check`.

## Recommended Fix

Change only `scripts/validate-product-shell-matrix.js` to stop interpreting all panel buttons as camera buttons. Collect and assert:

- integrated panel role/name and exact two-ID description relationship
- accessible collapse button state/label
- exact ten camera labels using semantic camera selectors in stable order
- camera-only pressed states and movement intents
- exact environment action identities and visible accessible text/status relationship

Preserve all existing safe-area, movement, privacy, load/export, cleanup, and cross-mode assertions. Do not remove or relax camera coverage and do not add redundant `aria-label` attributes to visible-text environment buttons merely to satisfy a stale test.

## Debugging Record

```text
Problem: Mandatory product shell browser matrix models the Visual Test panel as camera-only.
Observed symptom: test:shell-matrix fails at line 277 in the first direct 390×844 DPR1 Flow row.
Root cause: Validator queries every panel button and compares it to a ten-camera-button aria-label array; combined authoring now adds collapse and environment actions and a second described-by status.
Evidence: Current markup, repeatable isolated failure, focused authoring matrix PASS, and stale all-button/index assertions at lines 275-277.
Failed approaches: New focused authoring coverage and layout repair did not update the older mandatory full-browser inventory assertion.
Corrective action: Partition inventory by semantic selectors and assert integrated authoring plus unchanged camera contracts.
Verification test: npm run test:shell-matrix; npm run test:browser; npm run test:environment-controls-browser; npm test; npm run build; git diff --check.
Related files/components: scripts/validate-product-shell-matrix.js; src/index.js Visual Test authoring template.
Remaining uncertainty: Audit remaining shell-matrix code for later camera-only positional assumptions.
```
