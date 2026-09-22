# C5 live equipment transform disconnect

## Exact Observed Failure

Read-only QA found that a valid Test-mode YAML Apply updates `AeroGame.equipmentConfig` and the public diagnostic accessor, but does not affect base per-hand equipment transforms sent to the renderer.

## Expected Behavior

Applying valid YAML in Test mode must update per-hand Flow/Boxing `scale` and base `rotationZDeg` on the very next rendered equipment record. Invalid YAML must leave the prior rendered transform unchanged.

## Execution Path

1. `setEquipmentConfigYaml()` validates and replaces `this.equipmentConfig`.
2. `renderGameplay()` reads that live state for dynamic glove/saber direction logic.
3. `renderGameplay()` calls `gameplayEquipmentRecords()` without a config argument.
4. `gameplayEquipmentRecords()` imports `equipmentConfigDefaults` and resolves base transforms from those defaults on every call.
5. Renderer records therefore keep baked scale/base rotation even though the panel reports Apply success.

## Most Likely Root Cause

C5 converted dynamic state readers to the live app config but missed the base-transform record builder's independent default-config read.

## Alternative Hypotheses

- Renderer ignores record transforms: contradicted by renderer C2 tests and its application of `scale`/`rotationZDeg`.
- YAML state failed to update: contradicted by dedicated panel/accessor tests.
- Only a test gap: contradicted by the direct call path; production code has no route from `this.equipmentConfig` to the record builder.

## Why Previous Fixes Failed

The C5 browser oracle asserts `describeEquipmentConfig()` after Apply, not the next equipment record or renderer transform. Unit record tests use baked defaults, so both suites remained green while live rendering stayed disconnected.

## Unknowns

None material. The validated live config already has the exact shape required by the record builder.

## Minimal Reproduction

Start Visual Test Flow, apply YAML changing `flow.perHand.left.scale` from 1 to 2, render the next frame, and inspect the left-wrist equipment record. Current result: scale 1. Expected: scale 2.

## Proposed Verification

Add an oracle that supplies a validated non-default config to `gameplayEquipmentRecords()` and asserts next-record scale/base rotation change for both modes while dynamic rotations still add on top. Extend the real browser Apply case to capture the next rendered equipment record and assert the edited transform reaches the renderer call.

## Recommended Fix

Add a validated equipment-config parameter to `gameplayEquipmentRecords()` (defaulting to baked defaults only for compatibility/tests), pass `this.equipmentConfig` from `renderGameplay()`, and add fail-before/pass-after record plus browser assertions.

## Debugging Record

```text
Problem: C5 Apply reports success but per-hand base transforms stay baked.
Observed symptom: live config changes, record builder always reads equipmentConfigDefaults.
Root cause: renderGameplay omits live config parameter; gameplayEquipmentRecords independently resolves defaults.
Evidence: src/index.js render call and src/gameplay-equipment-records.js default-config read.
Failed approaches: accessor-only browser assertion and default-only record tests.
Corrective action: pass validated live config into record builder and lock next-record behavior.
Verification test: apply non-default scale/rotation and inspect next equipment record/renderer call.
Related files/components: src/index.js; src/gameplay-equipment-records.js; validate-gameplay-equipment-records.js; validate-equipment-config-panel-browser.js.
Remaining uncertainty: none.
```
