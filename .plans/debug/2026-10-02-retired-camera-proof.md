# Historical 0.0.74 camera proof no longer matches current drawer

**Bead:** `aerobeat-web-assembly-ri2o`, discovered while QAing Info-drawer removal `vb55`. Standalone historical script is **not** part of assembly `npm run test:browser`.

## Exact observed failure

`node scripts/validate-0.0.74-playtest-proofs.js` reaches line 56 and throws: actual Display-section `input[type='number'][data-camera-pose-field]` fields are `[]`, expected `["y","z","xPitch","yYaw"]`. This occurs before the updated Info-drawer assertion at lines 62–64 and is not evidence that removing the obsolete Force button broke Display.

## Expected behavior and execution path

Current 0.0.89 source intentionally locks camera pose tuning. `renderGameSetupControls()` creates a `fieldset.gameplay-camera-controls`, sets `style.display='none'`, builds four camera-pose inputs, and inserts it into **Game Setup**, not Display (`src/index.js:2945–2959`). The historical script opens the real menu, adjusts UI scale, then queries **Display** for four editable fields and captures `b2.3-camera-controls`. Current visible menu should not expose them; setup identity and renderer camera values remain separate. Its following Info assertion should prove the redundant button absent and alert retained.

## Root, alternatives and prior fixes

Root is a stale, independent B2.3-era fixture: it hard-codes placement and editability that later source deliberately removed. An unexpected DOM/render regression is less likely because the current source explicitly hides/moves the group and current shell/mobile tests run. The recent Info-button removal only changes a later assertion and did not alter `renderGameSetupControls`. Unknown: other 0.0.74 assumptions after line 56 may also be obsolete; do not declare the standalone proof green without running past them. No attempted source fix to this failure yet.

## Minimal reproduction and verification

Run the standalone proof on current source. Observe actual Display count zero and hidden Game Setup group with four fields and preserved setup snapshot values; compare to current UI contract before editing historical proof. If current coverage already supersedes this screenshot, retire/rename the misleading B2.3 screenshot step while retaining honest UI-scale, Info alert, difficulty color and equipment-scene proofs. Rerun standalone script and ensure it does not produce a screenshot falsely implying pose fields are visible. Never make the hidden controls visible merely to satisfy this old oracle.

## Debugging record

```text
Problem: 0.0.74 screenshot validator expects removed editable camera fields in Display.
Observed symptom: [] !== [y,z,xPitch,yYaw] at script line56, before Info-button assertion.
Root cause: historical fixture drift; camera group now hidden under Game Setup by design.
Evidence: src/index.js:2945–2959; standalone failure; npm test:browser excludes this script.
Failed approaches: none; menu button removal did not touch camera group.
Corrective action: update/retire only the historical proof and artifact, not product UI.
Verification test: inspect current hidden group and run full standalone proof plus current shell/mobile gates.
Related files/components: scripts/validate-0.0.74-playtest-proofs.js, src/index.js renderGameSetupControls.
Remaining uncertainty: later 0.0.74 proof steps may have independent drift; old screenshot artifact ownership.
```
