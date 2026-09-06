# Current production CV documentation coherence diagnosis

**Date:** 2026-09-06  
**Bead:** `aerobeat-web-assembly-2w9`  
**Disposition:** Diagnosis complete before documentation/test edits.

## Exact Observed Failure

Directly observed current-operational documentation contradicts the locked production source:

- `docs/secure-context.md:33` calls GPU-WebGL the no-query production path, calls CPU-WASM diagnostic, and promises CV-owned replay fallback for camera/model/runtime failure.
- `docs/secure-context.md:35` instructs the operator to inspect a selected backend/provider and interpret fallback truth.
- `docs/decisions/0001-aero-game-assembly-and-iframe-boundary.md:15` calls GPU-WebGL the immutable production composition.
- `docs/task12-physical-playtest-handoff.md:158` tells the current physical-test operator to confirm GPU-WebGL.
- `docs/task13-final-audit.md:51` describes current production as GPU-WebGL.
- `docs/task13-final-audit.md:96` and `:108` record exact old release-proof GPU-WebGL evidence, but do not label it as superseded historical frozen-release evidence; readers can mistake it for current production truth.

In contrast, `src/production-cv-profile.js` locks provider `cpu-wasm`, execution location `worker`, model `Pose Landmarker Lite float16 /1/`, Tasks Vision `1.0.1`, measured gameplay source, no resize, and a 15 FPS target. `src/production-cv-service.js` supports only `live-camera`, rejects cadence above 15 FPS, exposes `cpu-wasm`/`worker`/`measured`/`none`, validates runtime fallback is exactly false, and documents no replay, fallback, backend selector, resize, or prediction route.

## Expected Behavior

Every current production, operational, source-of-truth, and physical-check statement must describe the sole locked route: MediaPipe Pose Landmarker Lite float16 `/1/`, Tasks Vision 1.0.1, CPU-WASM in a dedicated worker, thresholds `0.5/0.5/0.5`, Fast tracking, direct full input with no resize, measured-current input only, and at most 15 FPS (`<=15.01` only as the measurement tolerance). There is no runtime provider/backend selection and no replay/provider fallback. Permission, model load, runtime, execution-identity, and tracking-freshness failure must fail closed.

Frozen raw-release evidence must remain byte-immutable. Historical prose may retain the exact old GPU-WebGL fact only when it is explicitly labeled historical frozen-release evidence, names its old target, and states that it is not current production.

## Execution Path

1. `src/production-cv-profile.js` defines the immutable selected profile.
2. `src/service-graph.js` constructs the MediaPipe CPU-WASM worker adapter and the locked production CV service.
3. `src/production-cv-service.js` accepts only a live camera source, loads the one adapter, transfers frames to worker execution, validates worker/WASM/no-fallback telemetry, and publishes measured fresh frames.
4. Assembly calibration/gameplay consumes those current measured frames and applies the existing freshness safety boundary; errors stop the locked CV route rather than changing source/provider.
5. Operators and auditors use README/current docs to verify that route. The stale docs redirect them toward a nonexistent GPU selection and replay fallback, so an incorrect deployment could appear compliant.
6. `npm test` currently has no documentation/source coherence authority, allowing source and operational docs to diverge while all runtime tests pass.

## Most Likely Root Cause

The production route changed from an earlier GPU/selectable/fallback-era composition to the CPU-WASM dedicated-worker lock, but documentation was updated piecemeal. Runtime/profile tests protected executable selection while no normal gate treated current documentation as part of the production contract. Old release-proof paragraphs and live operator instructions therefore retained stale vocabulary.

Evidence: all false current statements name the prior GPU route; the locked profile and locked service independently agree on CPU-WASM worker/measured/no-resize/no-fallback; the s1q audit found the contradiction after runtime repairs had already passed.

## Alternative Hypotheses

1. **GPU-WebGL remains a hidden production route — ruled out.** The locked profile selects CPU-WASM, the service reports CPU-WASM worker, and telemetry contradiction fails.
2. **Replay is an automatic safety recovery — ruled out.** The locked service supports only `live-camera`; its header excludes replay/fallback and telemetry requires `fallback:false`.
3. **All GPU references are harmless historical evidence — contradicted.** Secure-context and physical handoff wording is imperative/current, the decision says immutable production, and Task 13 line 51 says production has one route.
4. **A broad ban on the word fallback is sufficient — low quality.** Many docs truthfully discuss gameplay selection, ZIP acquisition, hashing, rendering, or historical debugging fallbacks unrelated to production CV. The regression must scope CV claims and recognize one explicit historical marker.

## Why Previous Fixes Failed

The prior `8yc` repair correctly fixed the locked service public identity, source comments, README, and lifecycle assertions. It did not audit every current document or add a documentation-coherence regression. Broad runtime/browser/release gates therefore continued to pass despite contradictory operator instructions. No attempted documentation repair exists for `2w9`; this diagnosis precedes edits.

## Unknowns

- No unknown remains about the selected production route; profile and service agree.
- The exact old release targets represented by Task 13 lines 96 and 108 are inferable from their dated audit addenda and hashes, but they predate the current lock. They should remain as historical evidence with explicit scoping rather than being rewritten as if those old proofs used CPU-WASM.
- Other uses of “fallback” in docs may be valid non-CV concepts. A focused regression plus a full reviewed grep resolves this without rewriting unrelated history.

## Minimal Reproduction

1. Read `src/production-cv-profile.js` and observe `providerId: "cpu-wasm"`, `executionLocation: "worker"`, `resizePath: "none"`, `gameplaySource: "measured"`, and target FPS `15`.
2. Read `src/production-cv-service.js` and observe live-camera-only support plus `fallback !== false` rejection.
3. Read `docs/secure-context.md:33-35`; observe current GPU, diagnostic CPU, selected-provider, and replay-fallback instructions.
4. Run a tracked-doc grep for `GPU-WebGL|CPU-WASM|replay|fallback|provider`; observe the additional current claims and unlabeled old release-proof claims.
5. Run current `npm test`; it does not inspect this documentation contract, so the contradiction is not rejected.

## Proposed Verification

Add a normal executable documentation-coherence validator that:

- imports the current locked profile and verifies exact model/runtime/provider/location/threshold/tracking/input/resize/source/cadence values;
- inspects the locked service source for live-camera-only/no-replay/no-selector/no-resize/no-prediction and fail-closed telemetry assertions;
- enumerates tracked README/docs Markdown through Git;
- rejects GPU-WebGL except on an exact explicit historical frozen-release marker that also says it is not current production;
- rejects diagnostic-CPU, selectable production backend/provider, and affirmative CV replay/provider fallback claims;
- requires the current operator/decision/audit documents to contain CPU-WASM worker, measured-current, no-resize, no-fallback, fail-closed, and cadence truth;
- is wired into `npm test` and prints a bounded success record.

Then run the required assembly, browser/privacy/CV/performance/immutable/release-policy/build/dry-pack/q7g gates and compare raw `0.0.35–0.0.39` Git trees before/after.

## Recommended Fix

Correct all current statements to the source lock. Rewrite secure-context instructions around one fixed route and fail-closed outcomes rather than selection/fallback. Correct the decision, physical handoff, and current Task 13 route. Preserve Task 13 old proof hashes and GPU fact with a conspicuous historical frozen-release label and explicit statement that they are not current production. Add the focused tracked-doc/source regression to normal `npm test`; do not alter runtime behavior or frozen raw artifacts.

## Debugging Record

```text
Problem: Current production CV documentation contradicts the locked source route.
Observed symptom: Current operator/decision/audit text claims GPU-WebGL, diagnostic CPU, provider selection, and replay fallback; old proof paragraphs are not clearly historical.
Root cause: CPU-worker production migration updated runtime/profile tests and README but not every current document, and normal tests do not enforce documentation/source coherence.
Evidence: production-cv-profile locks cpu-wasm/worker/measured/no-resize/15; production-cv-service is live-camera-only and rejects fallback; exact stale docs at secure-context 33/35, decision 15, handoff 158, audit 51/96/108.
Failed approaches: Prior runtime identity repair covered service lifecycle and README only; broad tests and grep prose did not form a source-backed docs regression.
Corrective action: Align every current statement, explicitly scope frozen historical GPU proof, and add a tracked-doc/source coherence validator to npm test.
Verification test: New regression plus assembly npm test/build/q7g/browser/privacy/CV/performance/immutable/release-policy/dry-pack; raw 0.0.35–0.0.39 tree equality.
Related files/components: README.md; docs/secure-context.md; docs/decisions/0001-aero-game-assembly-and-iframe-boundary.md; docs/task12-physical-playtest-handoff.md; docs/task13-final-audit.md; src/production-cv-profile.js; src/production-cv-service.js; package.json; new validator.
Remaining uncertainty: Unrelated non-CV fallback wording must remain untouched; old Task 13 GPU proof remains exact historical evidence, not current truth.
```

## Validation transient diagnosis

The first post-edit aggregate browser run failed at `scripts/validate-mobile-gameplay-menu.js:265` with exact error `Timed out waiting for mobile state transition` while waiting up to 12 seconds for recovery calibration to return to `playing`. The failure occurred after q7g and the browser console/insecure-hash/audio gates had passed. This docs/test-only patch changes no runtime source, and the repository's existing mobile nondeterminism diagnosis plus active-plan history documents this host-sensitive recovery-transition timeout class. The focused mobile validator immediately passed unchanged, distinguishing a sustained product transition defect from host/scheduler contention. One clean full `npm run test:browser` retry then passed every ordered browser gate, including mobile, privacy, product-shell, compositor, cursor, square-grid, visual-correction, exact-3c9d, and live-marker coverage. No timeout, assertion, fixture, or product source was changed.
