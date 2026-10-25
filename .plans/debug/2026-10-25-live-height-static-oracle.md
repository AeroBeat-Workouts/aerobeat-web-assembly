# Live-height assembly static-oracle failure

## Exact Observed Failure
`npm test` failed in `scripts/validate-equipment-config-live-state.js:86`: `AssertionError [ERR_ASSERTION]: the same private feedback flag must gate aftermath projection through the accepted first-contact lookup` (`actual: false`). The prior renderer-pin failure was corrected and the suite passed the asset, provenance, mode-selection, aftermath, and assembly checks before reaching this assertion.

## Expected Behavior
The frame must still pass `this.testAutomaticFeedbackEnabled` as the eighth argument to `projectAftermathEntries` immediately after `acceptedFlowSliceT`; the new optional ninth Boxing height argument must not change Test feedback or private Flow first-contact lookup.

## Execution Path
`npm test` → `test:unit` → `validate-equipment-config-live-state.js` reads `src/index.js` as a string → line 86 checks for a literal call suffix `acceptedFlowSliceT, this.testAutomaticFeedbackEnabled)` → `rendererFrame()` now calls `projectAftermathEntries(..., acceptedFlowSliceT, this.testAutomaticFeedbackEnabled, isBoxingColliderForAftermath ? heightTuning : null)`.

## Most Likely Root Cause
A stale literal-string oracle rejects the intentional ninth argument, although the original eighth feedback flag has not moved. Direct source inspection shows the same flag and Flow lookup still in the call. The standalone aftermath unit oracle already passed with the new defaulted optional argument.

## Alternative Hypotheses
1. Functional Test feedback gate missing: contradicted by the inspected call and passing `validate-gameplay-frame-effects.js`; unlikely.
2. Flow first-contact lookup removed: contradicted by `Symbol.for("aerobeat.web-gameplay.internal-flow-slice")` in the inspected caller; unlikely.
3. Source read points to stale build: this oracle reads the live `src/index.js` directly and its old expected suffix differs exactly at the ninth argument; unlikely.

## Why Previous Fixes Failed
The previous fix updated two renderer source-pin oracles after owner revision drift and allowed the full suite to reach this later, independent static-string assertion. No prior attempt has changed the Test feedback behavior or this oracle.

## Unknowns
Whether later tests encode other static call signatures. Continuing the full suite after the focused fix will resolve that; do not infer their status from this failure.

## Minimal Reproduction
From assembly, `node scripts/validate-equipment-config-live-state.js` fails at line 86 against the current modified frame call. Before adding the optional ninth argument, the same source suffix matched.

## Proposed Verification
Check that the actual source includes both the unchanged eighth feedback argument and the ninth height-only optional argument, then rerun the focused oracle and remaining assembly suite. A functional Test feedback/Flow-scoring check supplies behavioral coverage beyond this literal assertion.

## Recommended Fix
Update only the static oracle's expected call substring to include the appended conditional height argument. Keep the production call and its feedback flag unchanged. Rerun the focused script and suite; check genuine configured Play after a clean committed-source build.

## Debugging Record
Problem: nine-argument aftermath call trips eight-argument literal oracle.
Observed symptom: assertion at `validate-equipment-config-live-state.js:86`.
Root cause: stale exact caller text expectation after adding optional Boxer height input.
Evidence: inspected source call retains the flag and Flow slice lookup; focused aftermath suite passed.
Failed approaches: unrelated renderer-pin refresh exposed this later assertion, no prior fix to this check.
Corrective action: update expected source substring only.
Verification test: focused script, complete assembly suite, then genuine private Play.
Related files/components: `src/index.js`, `src/gameplay-frame-effects.js`, `scripts/validate-equipment-config-live-state.js`.
Remaining uncertainty: later suite checks and genuine Play not yet run.

## Focused floating-point assertion, diagnosed before changing it
Exact failure: new `validate-gameplay-frame-effects.js:478` Test guard assertion expected strict `0.6`, actual `0.6000000000000001`. Requirement is shoulder 0.8 plus guard offset -0.2 within numeric world precision, for BOTH shields. The source path is `projectAftermathEntries` → synthetic guard pair → `atBoxingHeight` sum; the scored/renders use the same finite sum. Leading root cause is JavaScript binary floating-point rounding; alternate hypothesis of wrong family or row Y is contradicted by actual value and first guard/punch epsilon assertions. The earlier static-oracle fix is unrelated; this is the first run of the new Test guard assertion. Minimal repro: `0.8 - 0.2` evaluates to `0.6000000000000001`. Confirmation: compare epsilon ≤1e-9 as already used for other families; no product logic change. Fix only the two strict test assertions, then rerun focused tests. Unknown: genuine Play remains pending.

## Rotated-glove native Show oracle, diagnosed before changing it
Exact failure: `node scripts/validate-scored-boxing-collider-volume-pixels.js` direct 844×390 default Show-on scenario failed `Boxing scored Play pixels: default: fill/outline lost the final glove quaternion z` at the in-browser assertion in lines 132–135. Before this, the Show-off scenario yielded a real scored HIT and actual native glove pixels (872 changed), with no renderer error. Expected approved behavior is a rotating glove GLB and a scoring/Show cylinder whose axis and quaternion remain fixed world-Z/identity. The execution path is native scored Play → real equipment pose quaternion → `resolveGloveCylinder` now ignores glove rotation → renderer Show model sets cylinder `capsule.orientation` to identity → PlayCanvas wire/fill rotation is identity → old pixel oracle compares those entities to the moving `glove.orientation`. Most likely root cause is the stale oracle's obsolete quaternion equality, not a product regression: the contracts and renderer source explicitly set fixed-Z/identity, and their owner native suites passed. Alternatives: overlay missing (contradicted by passed presence and geometry checks), glove art not rotating (requires checking its pose quaternion and GLB pixels), score not functional (off scenario scored a hit). Earlier source suite did not invoke this standalone native browser script; refreshing provenance/static-Test oracles did not address it. Minimal reproduction is this script's default Show-on case with nonzero pose Z. Verification that distinguishes alternatives: assert native overlay orientation is identity in all components while the equipment pose is nonidentity; retain scored cylinder endpoint/radius parity, actual pixel delta, and HIT/miss matrix. Smallest fix is update only the overlay-orientation oracle, preserving real framebuffer and scoring assertions, then rerun direct and iframe. Unknown until run: later native scenarios and configured clean-build behavior.

Problem: old native Show expectation rotates a scoring cylinder with glove art.
Observed symptom: default Show-on cylinder quaternion Z assertion fails.
Root cause: stale oracle, fixed-world-Z geometry now intentionally identity.
Evidence: production contract and renderer orientation, owner native tests, real Play off HIT.
Failed approaches: no previous change to this standalone browser oracle.
Corrective action: assert fixed Show identity and independently moving glove pose.
Verification test: native direct/iframe scored Play Show pixel and all collider-volume scenarios.
Related files/components: `scripts/validate-scored-boxing-collider-volume-pixels.js`, contracts and renderer cylinder owners.
Remaining uncertainty: full native suite and clean configured build.
