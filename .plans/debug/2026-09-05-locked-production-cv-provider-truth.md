# Locked production CV provider truth diagnosis

## Exact Observed Failure

Fact: `createLockedProductionCvService(...).getStatus()` returns `providerId: execution?.provider ?? "gpu-webgl"` in `src/production-cv-service.js`. The exact locked adapter reports pre-load telemetry with `provider: undefined`, so idle and pre-initialization public status report `gpu-webgl`.

Fact: `src/index.js` copies `graph.cv.getStatus()` into the public serializable assembly snapshot. This makes the fallback externally visible rather than a private diagnostic detail.

Fact: `README.md` lines 60–69 name `GPU-WebGL`, then line 71 names the pinned CPU-WASM MediaPipe worker. The service header says there is no worker route, while `src/service-graph.js` constructs `createMediaPipeWorkerPoseAdapter` with `mediaPipeDelegates.cpuWasm`.

Audit evidence: s1q comments `01a073f1-adc6-792d-95f9-d1d0c8e7a017` and blocker `aerobeat-web-assembly-8yc` independently reproduced the idle false identity.

## Expected Behavior

Every public status state—idle, loading, running, stopped, error, and disposed—must report the immutable production selection `providerId: "cpu-wasm"` and worker execution truth before telemetry exists. Runtime telemetry remains evidence that the actual adapter execution agrees with the lock, not authority that changes the selected identity. Public status must remain bounded scalars only and must not expose durations, private performance samples, media, frames, pose landmarks, or raw errors beyond the already bounded public error string.

The service must retain measured-current gameplay input, no resize/prediction, a cadence at or below 15 FPS, 500 ms safety behavior owned by the surrounding lifecycle, generation invalidation, serialized adapter operations, denial/error teardown, and privacy.

## Execution Path

1. `createAeroGameServiceGraph()` calls `createLockedProductionPoseAdapter()`.
2. That factory locks `mode: "worker"` and delegate `cpu-wasm` in `@aerobeat/web-vendor-mediapipe`.
3. It passes the adapter to `createLockedProductionCvService()` with a 15 FPS target.
4. Before adapter load/inference, `adapter.getExecutionTelemetry()` returns `provider: undefined`.
5. `getStatus()` treats absent observed telemetry as permission to substitute `gpu-webgl`.
6. `AeroGameElement.getSnapshot()` publishes that status at `snapshot.services.cv`.
7. Therefore public identity contradicts both the selected adapter and later CPU-WASM execution until telemetry arrives; lifecycle changes do not fix the fallback path.

## Most Likely Root Cause

The service conflates two separate concepts: immutable selected provider identity and optional observed execution telemetry. A stale GPU-era fallback was retained in public status even after production selection moved to the CPU-WASM worker. The contradictory header and README line are the same stale-contract residue.

Evidence: the locked profile says `providerId: "cpu-wasm"`, the actual adapter inspection says `mode: "worker", delegate: "cpu-wasm"`, and pre-init telemetry intentionally has no provider. Only the fallback literal says `gpu-webgl`.

## Alternative Hypotheses

1. **The adapter dynamically selects GPU at runtime (low likelihood).** Contradicted by the exact worker adapter factory and inspected `delegate: "cpu-wasm"` status.
2. **`provider` telemetry uses the canonical public ID (medium-low likelihood).** Existing test doubles return `wasm` or `gpu-webgl`; telemetry vocabulary is observed implementation detail and is not stable selection authority.
3. **The false value is private only (ruled out).** `src/index.js` copies CV status into the public snapshot.

## Why Previous Fixes Failed

No source fix was attempted in this blocker. Prior work correctly locked the profile and constructed the CPU-WASM worker, but it verified those routes separately from pre-telemetry public status. Tests asserted profile and adapter truth without asserting lifecycle-wide public identity, leaving the stale fallback reachable.

## Unknowns

- Whether observed provider telemetry always reports `wasm`, `cpu-wasm`, or another vendor spelling after all MediaPipe versions. This does not need to control public selected identity; a validation helper/test can normalize only the accepted actual telemetry spellings or fail on contradiction.
- Whether public consumers require an explicit execution-location field. Source inspection shows none today; acceptance requires worker execution truth, so adding a bounded `executionLocation: "worker"` is the smallest explicit contract if tests confirm no schema restriction.

## Minimal Reproduction

1. Construct the locked production service with an adapter whose `getExecutionTelemetry()` returns `{ provider: undefined }`.
2. Call `getStatus()` before `start()`.
3. Observe `lifecycleState === "idle"` and `providerId === "gpu-webgl"`.

The failure is absent only after telemetry supplies a provider string, but the supplied string can still expose a noncanonical telemetry spelling rather than the locked public ID.

## Proposed Verification

Add a focused lifecycle matrix using the production service with missing telemetry and then valid CPU-WASM telemetry. Assert the exact same `providerId: "cpu-wasm"` and `executionLocation: "worker"` in idle, loading, running, stopped, error, and disposed states. Assert telemetry contradiction is rejected or surfaced as an error without changing public identity. Assert the public status key set excludes private timing metrics/raw media and remains JSON-serializable. Keep existing generation, queue, cadence, VideoFrame transfer/closure, and disposal tests.

## Recommended Fix

Make locked profile identity—not optional telemetry—the source for public `providerId` and execution location. Validate actual telemetry when it exists against accepted CPU-WASM observation values; never let telemetry rewrite public selection. Correct the service comment and README to one CPU-WASM worker route. Add lifecycle/missing-telemetry/privacy regression coverage in the existing assembly validator.

Potential regressions: accidental rejection of the vendor's actual telemetry spelling, changing generic selectable registry behavior, or leaking execution-duration metrics into public status. Limit changes to the locked production service/docs/tests and leave the generic pose registry untouched.

## Debugging Record

```text
Problem: Locked CPU-WASM production CV publishes false provider identity.
Observed symptom: Idle/pre-init getStatus() returns providerId gpu-webgl; docs/header contradict worker construction.
Root cause: Public selected identity is incorrectly derived from optional observed telemetry with a stale GPU fallback.
Evidence: locked profile cpu-wasm; adapter mode worker/delegate cpu-wasm; telemetry provider undefined before load; public snapshot includes getStatus().
Failed approaches: Prior profile/adapter tests did not cover pre-telemetry lifecycle public status.
Corrective action: Publish immutable cpu-wasm/worker identity and separately validate actual telemetry when present; align docs/comments.
Verification test: Missing/pre-init plus idle/loading/running/stopped/error/disposed matrix, telemetry contradiction, exact public key/privacy assertions.
Related files/components: src/production-cv-service.js, src/production-cv-profile.js, src/service-graph.js, src/index.js, scripts/validate-aero-game-assembly.js, README.md.
Remaining uncertainty: Exact post-load vendor telemetry spelling; inspect/accept only evidenced CPU-WASM spellings without changing public identity.
```
