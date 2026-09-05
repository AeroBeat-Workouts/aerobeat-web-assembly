# q7g acceptance-oracle gap diagnosis

**Date:** 2026-09-05  
**Bead:** `aerobeat-web-assembly-q7g`  
**QA comment:** `01a0736c-3f25-7099-a250-33ef68fe4b2f`  
**Disposition:** Diagnosis complete; repair is test/evidence only unless a private test seam proves necessary.

## Exact Observed Failure

Independent QA inspected clean `origin/main` and reported six source-proven coverage gaps, not a production runtime regression:

1. `scripts/validate-session-render-projection.js` constructs `5000` generated entries plus one Flow obstacle and five Boxing entries: exactly `5,006`, despite the active-plan claim of `6,003`.
2. `scripts/validate-visual-correction-integration.js` labels a hand-authored event `3c9d-hard-tall-wall`; the committed `3c9d` difficulty bytes and fixture SHA-256 never drive that browser render. The offline fixture gate does not read browser pixels.
3. Existing terminal checks cover selected flows in large shell/mobile scripts, but no executable manifest asserts the required three modes × two backgrounds × desktop/mobile portrait/mobile landscape/genuine iframe cross-product and every named lifecycle transition/final resource invariant.
4. `validate-offline-flow-obstacles.js` checks all four exact Boxing chart identities and scene walls, but does not independently drive each chart through gameplay scoring with Semantic action-only versus Spatial action-plus-instantaneous-safe-cell outcomes.
5. Browser IndexedDB tests open the current database directly or use fakes. None creates an actual version-4 Chromium database, stores exact bytes/hash, upgrades it to DB6, and proves stale list/export/delete/reimport behavior without rewrite.
6. Performance generators produced committed aggregate JSON but no normal executable gate validates production CPU-worker selection, rejects GPU-worker evidence against explicit freshness/runtime criteria, validates the evidence schema/privacy flags, or recomputes the local ABCCBA evaluation. The physical Bug thresholds remain deferred.

Directly observed locations: `scripts/validate-session-render-projection.js:108`, `scripts/validate-visual-correction-integration.js:61`, `scripts/validate-offline-flow-obstacles.js`, `scripts/validate-mobile-gameplay-menu.js`, `scripts/profile-camera-abccba.mjs`, `scripts/benchmark-mediapipe-worker.mjs`, and `.plans/evidence/2026-09-05-mi6-*.json`.

## Expected Behavior

Normal documented gates must execute bounded assertions for all six exact claims. Fixture and evidence identity/count must be explicit. Tests may expose private read-only seams but must not weaken production validation, persistence, privacy, scoring, lifecycle, or performance contracts. Raw assembly `0.0.35–0.0.39` and gameplay assets `0.0.1–0.0.7` remain byte-immutable. No Bug physical PASS is inferred from local/headless evidence.

## Execution Path

- Projection: resolved-event array → `createSessionTargetIndex()` → indexed candidate query → `projectSessionTargets()`; reference path omits the index and fully orders/scans.
- Browser fixture render: committed Hard.dat bytes → parser → converter → package → content runtime → selected exact variant → gameplay coordinator → assembly private projection → renderer → WebGL framebuffer readback and runtime asset/AABB inspection, under direct or true cross-origin child frame.
- Terminal: production-faithful ended audio clock → gameplay completion → terminal reconciliation → menu open/change/close → backward/exact-end seek → explicit Test/Start generation → audio/CV/lease/privacy final state.
- Boxing scoring: each exact authored chart → content resolution → gameplay configure/start/advance → action and calibrated nose input → judgements/score partitions; renderer wall count/interval remains separate visual truth.
- Migration: Chromium IndexedDB v4 records → production DB6 upgrade callback → persistence list/getForExport/get/delete plus assembly Play/Test selection path → corrected reimport.
- Performance: production service graph adapter construction → CPU-WASM worker execution; committed GPU/CPU benchmark records and ABCCBA windows → deterministic schema/privacy/threshold evaluator.

## Most Likely Root Cause

The consolidated plan summarized evidence from several specialized tests and manual generators as if those tests formed one exact acceptance oracle. They do not. The implementation work landed, but the final QA claims were not converted into explicit named, count-bearing, independently executable gates.

Evidence: the parity constructor arithmetic is literally `5000 + 1 + 5`; the browser wall event is synthetic; DB6 migration exists in production but browser tests do not originate a v4 database; performance JSON is consumed only by prose; and the four Boxing loops stop at configuration/projection rather than scored outcome assertions.

## Alternative Hypotheses

1. **Production defects remain.** Possible, especially if the new high-fidelity tests expose one, but current broad gates and direct code inspection support missing-oracle as the leading cause.
2. **Existing aggregate shell matrices implicitly cover every row.** They cover many contexts, but implicit coverage is insufficient because no exact manifest/count and no complete transition record makes the requested cross-product auditable.
3. **Offline model assertions are equivalent to browser pixels.** Contradicted: they do not exercise asset loading, WebGL, framebuffer pixels, or genuine iframe origin behavior.
4. **Fake IndexedDB is sufficient for migration.** Contradicted by the requirement for real Chromium upgrade semantics.
5. **Committed benchmark prose is sufficient evidence.** Contradicted because malformed/altered evidence and production worker drift would still pass `npm test`.

## Why Previous Fixes Failed

Previous coder slices correctly repaired production behavior and added focused regression tests, but optimized for each implementation boundary. The final plan then aggregated their outputs without adding a final acceptance layer. Specifically:

- parity prose was updated to `6,003` without changing the `5,006` corpus;
- exact offline fixture conversion and synthetic browser pixel tests remained separate;
- terminal scenarios were distributed across shell/mobile helpers without an exact row manifest;
- all four Boxing charts were validated structurally, not each scored;
- migration logic was unit/fake tested, not a native Chromium upgrade;
- benchmark generators wrote evidence but no evaluator guarded selection/rejection claims.

## Unknowns

- Whether fixture-driven browser rendering or DB4→DB6 migration reveals a latent production bug. Resolve by implementing and running those tests before any source edit.
- The smallest bounded terminal shard structure that stays below the harness cap. Resolve by timing one context shard and exposing an environment row selector.
- Whether exact Boxing input injection needs a new private test seam. Resolve by using the public gameplay coordinator API first.
- Whether historical DB4 records include collections/assets or only packages. Use a fully representative v4 package+collection+asset fixture and assert untouched canonical bytes before/after upgrade.

## Minimal Reproduction

Run the existing source inspections:

- evaluate the parity corpus length in `validate-session-render-projection.js` → `5006`;
- search the visual browser test for fixture reads → none, only a synthetic `wallEvent`;
- search browser tests for creation of database version `4` followed by production open at `6` → absent;
- search normal npm gates for readers of the three `mi6` evidence JSON files → absent.

Each reproduces a missing executable claim while current tests may still pass.

## Proposed Verification

Add six named gates and wire them into unit/browser/documented shard scripts. Each gate must print an explicit oracle name and row/event/chart count. Mutate one required count, fixture hash, migration byte, worker provider, GPU freshness metric, ABCCBA sequence, or terminal row in a disposable copy and confirm failure. Run full existing gates afterward and compare immutable tree identities.

## Recommended Fix

Add the smallest acceptance-only layer:

1. correct the projection corpus to exactly `6,003`, assert its identity/count, and enumerate exact center/interval/judgement boundaries;
2. add a committed-fixture browser oracle that performs the real conversion and pixel/asset/AABB checks under direct and cross-origin iframe;
3. add a manifest-driven, row-filterable terminal matrix with exact aggregate count and final-state assertions;
4. extend the exact four-chart fixture loop through independent gameplay scoring probes for Semantic and Spatial semantics plus wall multiplicity/interval;
5. add a native Chromium DB4→DB6 migration oracle with pre/post canonical byte/hash snapshots and current reimport control;
6. add a screenshot-free deterministic performance evidence evaluator that checks production CPU worker construction, GPU rejection, schema/privacy, and ABCCBA recomputation while explicitly rejecting any Bug physical-threshold claim.

Only add production source seams if the tests cannot observe a private invariant otherwise. Re-run all assembly and affected dependency gates.

## Debugging Record

```text
Problem: Consolidated P0 acceptance claims are not directly executable.
Observed symptom: Six exact QA claims are absent, mislabeled, under-counted, synthetic, fake-IDB-only, or prose-only.
Root cause: Specialized implementation tests were summarized as a consolidated oracle without a final exact acceptance layer.
Evidence: 5,006 corpus arithmetic; synthetic browser wall; no native DB4 origin; structural-only four-chart loop; no evidence evaluator.
Failed approaches: Broad aggregate coverage and prose evidence were treated as equivalent to exact named acceptance gates.
Corrective action: Add six bounded count/identity-bearing acceptance oracles and shard browser matrices.
Verification test: Run new gates, adversarially alter each authority in disposable copies, then run all existing gates and immutable guards.
Related files/components: assembly scripts/package.json; committed authoring fixtures; gameplay scoring; renderer browser readback; IndexedDB persistence; performance evidence.
Remaining uncertainty: New high-fidelity fixture/migration/scoring tests may expose a narrow production defect; no such defect is assumed.
```
