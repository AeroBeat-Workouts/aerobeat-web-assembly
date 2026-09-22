# D1 off-grid equipment renderer admission gap

## Exact Observed Failure

Static end-to-end audit at assembly `45ca766`, input `db53314`, renderer `3c4df9d` found a deterministic D1(b) contract break:

- input emits confident off-grid wrist anchors as `valid:true` with finite out-of-range normalized `x/y`;
- assembly emits those values unchanged in equipment records;
- renderer `stageGameplayEquipment()` rejects any record outside `[0,1]`;
- assembly intentionally renders no legacy cursor fallback because equipment replaced wrist markers.

Directly observed in code and locked by `aerobeat-web-renderer/scripts/validate-renderer-facade.js`: an equipment record with `x:2` is expected to produce `equipmentCount===0`.

## Expected Behavior

Confirmed D1(b): a confident wrist outside the calibrated grid must not pause and its visible equipment must continue staging. It must not acquire a grid cell/subcell or become scoring-eligible outside the calibrated area.

## Execution Path

1. `aerobeat-web-input/src/body-grid-service.js:mapMeasuredAnchors()` sets `valid` from signal validity and publishes finite raw normalized coordinates beyond `[0,1]`; `cell/subcell` remain null.
2. `aerobeat-web-assembly/src/gameplay-equipment-records.js` accepts finite coordinates and emits them unchanged.
3. Assembly passes equipment records and an empty cursor array to renderer.
4. `aerobeat-web-renderer/src/renderer-facade.js:stageGameplayEquipment()` rejects out-of-range `x/y` before staging.
5. The same renderer file's `gridPositionForNormalized()` would clamp finite coordinates to the grid edge, but the admission guard prevents that bounded mapping from running.

## Most Likely Root Cause

The D1 input contract changed without updating the final renderer admission contract. The renderer already owns a bounded presentation policy (`gridPositionForNormalized()` clamps to `[0,1]`), but its legacy precondition still discards off-grid records.

## Alternative Hypotheses

1. **Extrapolation beyond the grid is required** — less likely. The renderer's shared normalized-to-world helper deliberately clamps all marker/equipment positions, giving an existing safe bounded policy.
2. **Assembly should clamp before renderer** — possible but weaker ownership. Renderer is the authority that validates and maps presentation records, and its existing helper already performs the clamp.
3. **Legacy cursor fallback keeps the hand visible** — contradicted by assembly intentionally passing no cursors once equipment replaces markers.

## Why Previous Fixes Failed

Input commit `891ebba` proved only producer-side validity and scoring separation. Assembly record tests stop before the renderer. The renderer's existing oracle explicitly preserves the obsolete rejection, so green input/assembly unit tests did not prove visible continuity.

## Unknowns

- Physical preference between edge-clamped presentation and off-grid world extrapolation. Current renderer architecture strongly favors edge clamping and bounds the asset within the calibrated playfield.
- The pre-freeze hysteresis window may briefly suppress equipment when all required anchors are not visible; that is separate from confident off-grid tracking and should be physically observed later.

## Minimal Reproduction

Stage one otherwise-valid flow or boxing equipment record with `x=-0.1` or `x=1.1`. Current renderer returns `equipmentCount:0`; an in-grid coordinate stages normally.

## Proposed Verification

Before/after renderer oracle:

- finite off-grid left/right equipment records are accepted;
- staged positions clamp to exact grid edges;
- NaN/Infinity, invalid roles, unknown keys, duplicate roles, invalid mode/direction remain rejected;
- scoring remains unchanged because input `cell/subcell` are null and gameplay range guards still reject out-of-range evidence.

Then re-pin renderer and run assembly equipment, cursor, mobile-menu, product-shell, and browser validation.

## Recommended Fix

Remove only the renderer's `[0,1]` admission rejection for otherwise-valid finite equipment coordinates. Preserve finite checks and every structural bound. Let the existing `gridPositionForNormalized()` clamp presentation to the edge. Update the renderer oracle to prove bounded edge staging and retain rejection coverage for malformed records.

### Integration addendum (2026-09-22)

After the renderer fix and input release-gate fix landed, the mobile oracle still timed out. A direct coordinator advance with the current input snapshot exposed the exact hidden rejection: `Input evidence does not satisfy the public contract`. `@aerobeat/web-contracts` still requires every `valid:true` body-grid anchor's `x/y` to be normalized `[0,1]`, while D1 intentionally emits finite out-of-grid `x/y` and keeps `cell/subcell=null`. Assembly's narrowed catch correctly surfaces the error, but the browser oracle's frame loop cannot advance gameplay while every off-grid snapshot is rejected.

The contract must be updated consistently: `rawX/rawY` and staged `x/y` may be finite outside `[0,1]` for a signal-valid off-grid anchor; scoring eligibility remains represented by null `cell/subcell` plus existing gameplay range guards. Add contract adversaries for nonfinite coordinates and valid in-grid/out-of-grid shapes, then re-pin contracts in assembly. Do not clamp input `x/y`: clamping there could make existing gameplay range guards treat an off-grid wrist as scoring-eligible at the edge.

## Debugging Record

```text
Problem: Confident off-grid wrists disappear despite D1(b).
Observed symptom: Input and assembly emit the record, renderer rejects it; no cursor fallback exists.
Root cause: Producer contract permits finite out-of-range coordinates while renderer retains legacy [0,1] admission rejection.
Evidence: body-grid-service mapMeasuredAnchors; assembly gameplayEquipmentRecords/render path; renderer stageGameplayEquipment rejection plus gridPositionForNormalized clamp and locked oracle.
Failed approaches: Input-only validity/scoring fix and producer-side tests stopped before final consumer.
Corrective action: Accept finite off-grid equipment coordinates in renderer and apply existing edge clamp; keep scoring guards unchanged.
Verification test: renderer stages off-grid records at exact edges, rejects malformed/nonfinite records; assembly browser seams remain green.
Related files/components: aerobeat-web-input/src/body-grid-service.js; aerobeat-web-assembly/src/gameplay-equipment-records.js; aerobeat-web-renderer/src/renderer-facade.js; renderer facade oracle.
Remaining uncertainty: edge clamp versus future extrapolated presentation; edge clamp matches current renderer policy and is safest for this cycle.
```
