# T6 opposite-lane setup diagnosis

## Exact Observed Failure
Derrick reports that changing “Uppercuts in opposite lane” or “Any punches in opposite lane” after loading a song does not reposition boxing punches. This behavior is the reported symptom; a physical reproduction has not been run here.

## Expected Behavior
The selected settings must determine the authored boxing target columns. If settings apply only during conversion, the UI must say that changing them requires reimporting the song. “Any punches” also requires the `any_punch` modifier.

## Execution Path
`importBeatSaver` / `importBeatSaverById` → `convertAcquired` → `authoring.convertAllStandardAndPersist` (`converterSettings` from `desiredGameSetup`) → worker request `options.converterSettings` → `executeWorkerConversion` → `convertDifficulty` → `generateEvents` → `spatialTarget` → `beat.spatialTarget.targetCell` → persisted package. At play time, assembly's session render projection reads `spatialTarget.targetCell` directly and frame effects place the authored target; setup synchronization does not reconvert charts.

## Most Likely Root Cause
Import-time target baking, not a missing settings wire. Source inspection confirms the import path passes all three settings, authoring forwards them to the worker and conversion, and emitted beats store computed target cells. Changing Game Setup only updates local settings and play-time configuration; the already-loaded chart is unchanged.

## Alternative Hypotheses
1. Broken request chain: contradicted by explicit forwarding and worker accepted-shape rules; end-to-end worker target-column test will confirm.
2. The `any_punch` modifier is absent: plausible for normal imports and independently explains why the “Any punches” switch sometimes has no effect, even after reimport; this is a modifier-specific constraint, not the general uppercut failure.
3. Some candidates drop for feasibility/spacing: possible per chart; choose a synthetic fixture with guaranteed emitted uppercut and straight punches for verification.

## Why Previous Fixes Failed
No fix in this task has been attempted. Existing baseline tests check profile overrides and default columns, but not the explicit Game Setup `converterSettings` request.

## Unknowns
A physical browser retest remains unperformed; the synthetic import oracle and assembly request assertion will check the implicated causal boundary. The handling of selecting `any_punch` in the product UI is outside this narrow fix.

## Minimal Reproduction
Import a map, select boxing, toggle either switch, replay the same imported package: authored targets do not change. Set toggles before import and reimport a map with an uppercut (and, for the second switch, an `any_punch` straight), then compare emitted target columns.

## Proposed Verification
Convert a fixed fixture through the worker with explicit `converterSettings` true/false and compare `spatialTarget.targetCell % 4` for the uppercut and an `any_punch` straight. Confirm assembly's request sends setup values before conversion and its drawer states the reimport requirement.

## Recommended Fix
Option A: keep conversion at import time; add a visible Game Setup hint that guard spacing and opposite-lane switches affect the next import/reimport only, and add focused worker/assembly regressions. Do not mutate already-hashed charts at play time.

## Debugging Record
Problem: Game Setup opposite-lane toggles appear inert on imported songs.
Observed symptom: Existing punches retain their original lane after switches change.
Root cause: Target columns are computed and stored once during import; no play-time chart reconversion.
Evidence: assembly `convertAcquired`, authoring `service.js` and `worker-protocol.js`, `converter.js` `generateEvents`/`spatialTarget`, assembly `session-render-projection.js`.
Failed approaches: None in this task; prior tests only cover defaults/profile path.
Corrective action: Option A, explicit import-time UX and request/worker oracles.
Verification test: Two settings permutations produce different emitted target columns for uppercut and `any_punch` straight.
Related files/components: assembly `src/index.js`, content-authoring `src/service.js`, `src/worker-protocol.js`, `src/converter.js`.
Remaining uncertainty: Physical browser retest; whether users opt into `any_punch` at import.
