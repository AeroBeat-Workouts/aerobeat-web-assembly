# Wrist collider setup validator diagnosis

## Exact Observed Failure
`node scripts/validate-game-setup-coordinator.js` fails at line 12 `assert.deepEqual(storage.setCalls,[[aeroGameSetupStorageKey,JSON.stringify(valid)]])`: actual serialized record places `visibleWristObstacleRadius` and `wristBombColliderScale` before existing visibility fields, while expected `valid` places them after existing visibility fields. Syntax checks succeeded; subsequent assembly validator did not run because the commands were chained with `&&`.

## Expected Behavior
The coordinator must persist its canonical frozen snapshot and the focused test must compare canonical serialized data, including the two new fields, without requiring test fixture insertion order.

## Execution Path
The test builds `defaults`, derives `valid`, then `coordinator.setSnapshot(valid)` calls `normalizeGameSetup`, `freezeSnapshot`, `applySnapshot`, and `persistReset(JSON.stringify(next))`. `freezeSnapshot` emits the two new properties before `...visibilityFields`; the test compares those JSON bytes to `JSON.stringify(valid)` where insertion order puts them after visibility fields.

## Most Likely Root Cause
The focused test's serialized-input equality assumption no longer matches canonical serialization order. Both JSON records show identical key-value pairs, differing only in property order. `assert.deepEqual(coordinator.setSnapshot(valid),valid)` passed, confirming structural normalization.

## Alternative Hypotheses
1. Missing field persisted: contradicted by actual JSON including both fields.
2. Wrong field values: contradicted by actual and expected JSON both containing `false` and `1`.
3. Other normalization failure: contradicted by earlier assertions passing.

## Why Previous Fixes Failed
The implementation was written before executing the focused oracle; no earlier fix was attempted. Adding fixture properties to the end made the structural assertions pass, but not the byte-order-sensitive storage assertion.

## Unknowns
Whether the remaining legacy migration and bound tests pass. Rerun the complete focused validator after correcting the assertion.

## Minimal Reproduction
Run `node scripts/validate-game-setup-coordinator.js` with the new defaults fixture. Without the two fields inserted in a different order, the pre-change assertion compares differently ordered JSON strings.

## Proposed Verification
Compare `JSON.parse(storage.setCalls[0][1])` to `valid` while separately checking the persisted key and number of writes. This distinguishes value loss from property-order-only differences.

## Recommended Fix
Update this focused test to compare parsed persisted JSON to the canonical record, retaining an explicit storage key/write-count assertion; do not alter product serialization merely to satisfy fixture insertion order. Then rerun the focused and requested assembly validators.

## Debugging Record
Problem: focused setup storage oracle fails after adding two fields.
Observed symptom: JSON string equality differs only in key order at line 12.
Root cause: test assumes fixture order equals canonical snapshot property order.
Evidence: actual/expected assertion diff and earlier structural comparison passing.
Failed approaches: none; initial fixture append was insufficient for string assertion.
Corrective action: compare parsed persisted record and assert exact key/write count.
Verification test: focused coordinator and assembly validators.
Related files/components: scripts/validate-game-setup-coordinator.js; src/game-setup-coordinator.js.
Remaining uncertainty: downstream assertions pending rerun.
