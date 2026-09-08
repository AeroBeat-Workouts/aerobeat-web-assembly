# Live raw 0.0.43 bounce diagnosis

## Exact Observed Failure

Derrick's physical review of the exact securely served raw `0.0.43` found no visible note bounce with either the default settings or the maximum-obvious `leadBeats: 8` / `heightWorldUnits: 1.5` settings.

The live process was reproduced without changing it: PID `2133101` serves the immutable raw directory on loopback `127.0.0.1:5173`, and the loaded app reports version `0.0.43` with source fingerprint `152671d9af8a564e4f79666f2214913b45f25f9a52a9e455f9aae11dcb4a92f8`. A synthetic event was driven through that served bundle's actual private content projection, assembly `rendererFrame()`, and PlayCanvas renderer. For a 120 BPM note at beat 20 / hit `10000 ms`, the default four-beat config derived `bounceStartMs: 8000`; the target was absent before that timestamp, was near its apex far down the lane, returned to `Y = 1.001499375` at `9999 ms`, and landed exactly at base `Y = 1`, `Z = 0` at `10000 ms`.

Direct observations are: timing metadata reaches the renderer; the target is eligible; absolute-time endpoint behavior is correct; and the offset exists in the world model. The physical symptom is therefore not missing timing metadata or a failed setter. It is an ineffective presentation trajectory.

## Expected Behavior

A hittable target must have a visibly legible rise/fall while it is in the useful approach view, then land at its canonical lane position and `Z = 0` on the authoritative hit timestamp. Bombs and every continuous obstacle remain static. A separately configurable optional sky prelude may start farther/elevated, but it must join the canonical lane exactly at the configured normal far-spawn boundary and then follow the unchanged lane approach.

## Execution Path

1. Content runtime preserves the authored beat and maps its authoritative beat to `centerTimestampMs`.
2. Assembly `rendererFrame()` obtains the private render-event projection and constructs a session target index.
3. `createSessionTargetIndex()` maps `authoredBeat.start - leadBeats` to `bounceStartMs`.
4. `projectSessionTargets()` does not emit the target before `bounceStartMs`; once emitted it forwards the private timestamp.
5. Renderer `targetObjects()` maps the hit timestamp to canonical world Z and independently adds `beatBounceOffsetY()` to canonical X/Y.
6. The fixed perspective camera projects that world-space offset. With larger beat leads, the apex occurs farther from the camera; as the target becomes visually large near the athlete, the configured curve is already almost back at zero.

## Most Likely Root Cause

The old config incorrectly uses one beat-relative timestamp for both **visibility/spawn policy** and **bounce animation duration**. Increasing lead beats moves the apex farther down world `-Z`, where perspective compression makes even a large world-space Y offset visually small. It also delays target emission until that far-away bounce start and provides no explicit normal far-spawn boundary. By the time the target is near enough for clear physical motion, the fall curve is nearly complete.

This explains all observed facts: the model has a nonzero offset, exact-hit landing passes, the setter and mapper work, yet maximum lead can make the physical effect less apparent rather than more apparent.

## Alternative Hypotheses

1. **Timing mapper unavailable or mismatched — rejected for the reproduced path.** The served bundle produced `timingMismatchCount: 0` and exact `bounceStartMs: 8000`.
2. **Renderer eligibility rejected the note — rejected.** The served model emitted the exact Flow note as a bounce-eligible icon.
3. **Config UI failed to commit — unlikely and not causal.** Existing strict config tests prove branded setter/reset behavior; the same presentation weakness is present with the default branded config driven directly through the live graph.
4. **Hit resolution suppresses all movement — rejected.** The pre-hit model has a nonzero Y offset, while exact hit correctly suppresses it.

## Why Previous Fixes Failed

The prior work hardened branding, strict JSON, mapper parity, semantic eligibility, lifecycle ownership, and exact endpoint behavior. Those fixes addressed security and correctness invariants, but retained the original assumption that `leadBeats` could also define when a target becomes usefully visible. Unit and pixel tests sampled known trajectory timestamps and proved nonzero movement; they did not prove that the motion was perceptually useful relative to configured far-spawn distance under perspective.

## Unknowns

The exact values Derrick will prefer for normal spawn distance, sky prelude, and lane separation remain a physical tuning decision. Source defaults can be bounded and deterministic, but final promotion still requires Derrick's returned Test JSON and physical QA.

## Minimal Reproduction

1. Load the exact served raw `0.0.43`.
2. Drive a Flow note at 120 BPM, authored beat 20, hit `10000 ms`, through the private content projection.
3. Use four or eight lead beats.
4. Observe that target visibility and bounce begin at the same beat-derived instant; the apex occurs far down the lane, while Y is effectively back at base immediately before hit.
5. At hit, observe exact canonical `Y` and `Z = 0`.

The failure does not mean the mathematical offset is zero. It is absent when timing metadata truly rejects, and it is visible in contrived close-camera/model samples; the defect is coupling the physically useful presentation window to beat lead.

## Proposed Verification

Introduce an independent bounded normal spawn distance. Prove that:

- the normal target first appears exactly at world `Z = -normalSpawnDistanceWorldUnits`;
- bounce timing is clamped to the visible normal approach rather than occurring only in perspective-compressed distance;
- optional sky prelude starts earlier/elevated and reaches exactly zero sky offset at the same normal boundary;
- samples immediately before/at/after that boundary are continuous;
- every eligible target lands at exact base X/Y and `Z = 0` at hit across frame rates;
- bombs and walls are byte-for-byte/model-equivalent with the config changed.

## Recommended Fix

Replace the bounce-only contract with one private branded strict-JSON Test presentation config. Keep the bounce fields, add an independent normal spawn distance, optional sky prelude height/duration/easing, and Boxing Lanes center separation. Derive a normal boundary in absolute time from the canonical world-Z rate, clamp the bounce's effective start to that visible boundary, and treat sky prelude as a separate additive offset that is exactly zero at the boundary. Renderer culling must use the configured boundary instead of ad-hoc approach constants. Apply lane separation from one function to lane timing tiles, targets, and walls. Scale Boxing Lanes walls over the full canonical top-to-bottom vertical span without changing width, interval Z, or gameplay truth.

Regression focus: exact-hit landing, hittable-only semantics, authored tempo/stop mapping, strict branded identity and hostile-object zero-inspection behavior, 16 KiB fatal UTF-8 file handling, stale generation rejection, public privacy, direct/iframe rendering, and wall interval/scoring invariants.

## Debugging Record

```text
Problem: Raw 0.0.43 exposes mathematically nonzero but physically ineffective beat bounce.
Observed symptom: No visible bounce at default or 8-beat/1.5-world-unit settings.
Root cause: Beat lead simultaneously controls spawn visibility and bounce duration, placing the apex far down -Z under perspective and leaving near-camera motion almost complete.
Evidence: Served 0.0.43 private graph derives exact bounceStartMs with zero timing mismatch; model is offset pre-hit and exact at hit, but target is absent before bounce start and nearly at base at 9999 ms.
Failed approaches: Security/mapper/eligibility/endpoint fixes and fixed-time pixel samples proved correctness but not useful perspective-relative motion.
Corrective action: One branded Test presentation config with independent normal spawn, sky prelude, bounce, and Boxing Lanes separation; visible-boundary bounce clamp and exact sky join.
Verification test: Live/direct/iframe model and PlayCanvas pixel samples at spawn, apex, join, approach, and hit plus hostile config/privacy/lifecycle/wall invariants.
Related files/components: assembly session-render-projection/index/Test controls; renderer presentation config/gameplay scene model/facade; browser pixel validators.
Remaining uncertainty: Derrick's physically preferred exported default values.
```
