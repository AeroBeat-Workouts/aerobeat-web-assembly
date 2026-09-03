# Environment controls landscape transport overlap

## Exact Observed Failure

Focused Chromium validator fails only its final layout aggregate. In direct and genuine cross-origin iframe landscape at `844×390`, DPR 1 and requested DPR 3, the expanded authoring panel bottom is `350.796875px` while the Visual Test transport top is `329px`, an overlap of about `21.8px`. Portrait, sizing, accessibility, behavioral, config, lifecycle, and privacy checks pass.

## Expected Behavior

The top-left authoring panel must stay inside safe bounds, scroll internally, and not overlap the bottom Visual Test transport in supported portrait/landscape contexts.

## Execution Path

The panel begins at the top safe inset. `.visual-test-authoring-body` uses `max-block-size:min(72vh,620px)`. Panel chrome (collapse button, gap, border, padding) sits outside that body maximum. At 390px height, the body may consume about 280.8px plus about 62px chrome, placing the panel bottom near 350.8px. The transport begins at 329px.

## Most Likely Root Cause

The scroll-body limit is viewport-relative but does not reserve the bottom transport height plus panel chrome. Evidence is the exact arithmetic and failure only in short landscape viewports.

## Alternative Hypotheses

1. DPR rounding — unlikely: CSS geometry is identical at DPR 1/3.
2. iframe origin/sizing — contradicted by identical direct failure.
3. transport unexpectedly visible — it is intentionally activated by the acceptance test and must be accommodated.

## Why Previous Fixes Failed

The initial UI used a general `72vh` cap and browser validation measured only the collapse button/basic fields, so full panel-versus-transport geometry was never exercised.

## Unknowns

The smallest safe cap must preserve usable internal scrolling across the existing portrait/landscape matrix. A CSS `calc(100vh - reserved pixels)` cap should be verified in all eight contexts.

## Minimal Reproduction

Run `npm run test:environment-controls-browser`; observe the four landscape unsafe-layout entries and no other failures.

## Proposed Verification

Set a body maximum that reserves transport and panel chrome, rerun the focused eight-context validator, and require panel bounds plus no menu/transport overlap and internal scrolling.

## Recommended Fix

Change the body max block size to the minimum of the existing cap and a viewport-minus-reserved-space calculation (approximately `100vh - 132px`), retaining `overflow:auto` and safe inset positioning.

## Debugging Record

```text
Problem: Expanded environment authoring overlaps Visual Test transport in landscape.
Observed symptom: Panel bottom 350.796875px; transport top 329px at 844x390, direct/iframe DPR1/3.
Root cause: 72vh body cap excludes panel chrome and reserves no transport space.
Evidence: Exact runtime geometry and landscape-only deterministic matrix failure.
Failed approaches: Generic 72vh cap plus static/basic DOM validation.
Corrective action: Reserve bottom transport and panel chrome in scroll-body max size.
Verification test: npm run test:environment-controls-browser.
Related files/components: src/index.js CSS; scripts/validate-environment-controls-browser.js.
Remaining uncertainty: Exact reserve value pending matrix rerun.
```

## Repair Result

The authoring-body cap is now `min(58vh, 620px)`, preserving `overflow:auto`, the at-least-44px collapse control, and all existing authoring controls. The reconciled executable validator passed all eight direct/genuine-cross-origin-iframe portrait/landscape requested-DPR1/3 rows with panel containment, no menu overlap, no Test-transport overlap, internal scrolling, keyboard collapse/expand, and visible focus. The same run also executed trusted save/exact-16-KiB load, hostile atomic rejects, stale lifecycle rejection, Retry failure handling, Camera precedence, and privacy checks in both direct and real-iframe behavior contexts. Final `npm test`, production build, environment sync/package/Vite validation, component validation, and `git diff --check` also passed.

## Full-browser integration follow-up

### Exact Observed Failure

Independent audit then ran the separately configured full browser gate. `npm run test:browser` exited 1; isolated `npm run test:shell-matrix` failed at `scripts/validate-product-shell-matrix.js:277` in the first direct `390×844` DPR1 Flow row. Its camera-control inventory still required exactly ten pre-environment button labels, `aria-describedby="debug-camera-state"`, and positional `aria-pressed` assumptions.

### Expected Behavior and Execution Path

The full product-shell validator must recognize the approved expanded authoring surface: one collapse control, the existing ten camera controls, three environment actions, and both described status outputs. It must continue validating the six movement intents, seven camera movement/speed pressed states, minimum 44px sizing, safe-area/menu/transport separation, privacy, camera behavior, and all later cross-mode assertions.

### Root Cause and Alternatives

The runtime is correct; the focused exact matrix proves current DOM/accessibility/layout behavior in direct and real iframe contexts. The stale full-shell assertion encoded the earlier button list and single `aria-describedby` value. This is not a renderer, DPR, iframe, or landscape regression because the failure is a deterministic inventory equality before those later behaviors run.

### Recommended Fix and Verification

Update only the full-shell inventory expectation to the exact approved expanded order and dual description IDs, and shift the pressed-state slice past the collapse button. Do not weaken geometry, movement, privacy, or later product-shell assertions. Re-run isolated shell matrix, complete `npm run test:browser`, focused environment controls, `npm test`, build, and diff check.
