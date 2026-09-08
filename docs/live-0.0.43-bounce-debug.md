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

## Independent QA — PASS (2026-09-08)

Audited exact pushed renderer `67bd21ee53b6e21e8525ae77cfc212db44613e45` / tree `89aad8422d324d69e44d32fd3a2bfae19caf96fb` and assembly `dd506d47bd491134ca7345605e6c83576ebe8ae3` / tree `b8612aacb1c48bdef52f3801427e4a326e9dc142`; both `HEAD` and `origin/main` matched. The predecessor renderer authority was `6f554cd45c15cfda868196cd46e6147e72cb86e1`. Source read-back independently confirms the old seven-key config coupled target emission to beat lead, matching the raw `0.0.43` symptom: its apex moves into perspective-compressed distance and its offset converges toward zero near hit. The unchanged live comparison process remained PID `2133101`, loopback-only `127.0.0.1:5173`, serving raw subtree `62b9475ec079849cd285b3e788357fc88fb52b91`; its proof remained SHA-256 `cb362e103db705ab0c3b7e9fc6666cafe8255a2d093acfd7a9a2dd5bc9b5f1c0`.

The replacement is one exact 13-key schema: `schema`, `version`, `bounceLeadBeats`, `bounceHeightWorldUnits`, `bounceApexFraction`, `bounceRiseEasing`, `bounceFallEasing`, `normalSpawnDistanceWorldUnits`, `skyMode`, `skyPreludeHeightWorldUnits`, `skyPreludeDurationMs`, `skyPreludeEasing`, and `boxingLaneSeparationWorldUnits`. Defaults are `4`, `.9`, `.4`, `out_quad`, `in_quad`, `15`, `off`, `4`, `1200`, `in_out_sine`, and `2.7`; numeric bounds are lead `.25…8`, height `0…1.5`, apex `.15….85`, normal spawn `3…72`, sky height `0…24`, sky duration `100…10000`, and lane separation `1.7…4`. Only primitive construction or internal strict JSON parsing creates the module-private `WeakSet` brand. Accessors, Proxies, clones, frozen copies, and cross-realm lookalikes rejected atomically with zero getter/trap execution; strict exact keys/schema/version/ranges and deterministic serialization passed.

Renderer unit/model and real Chromium framebuffer gates proved the new default bounce in the useful approach: the same target sampled at `Z -12/-7.2/-3/0` had world Y `2/2.9/2.59375/2`, visible changed-pixel counts `285/572/1297/3564`, and distinct centroids while its shadow remained at `Y -0.702`. Exact hit was base `Y 2`, `Z 0`. Focused model checks also exercised maximum accepted lead/height through the same bounded constructor, both sky modes, exact prelude start and exact zero-offset join at the configured normal boundary, and deterministic absolute-time evaluation across pause/resume and seek-style repeated timestamps. Bombs, walls, checkpoints, shadows, timing/static surfaces, feedback, environment, and cursors remained excluded. Direct and genuine cross-origin iframe product-shell Test rows loaded selected downloaded-package fixtures, rendered Flow/Lanes/Grid, retained non-background gameplay pixels across Reset and pause/resume, and kept Test `visual_test`, unranked, audio-only, with zero camera/CV calls.

Boxing Lanes runtime pixels proved one continuous `wall/red-glass-v1` plus one shadow per semantic obstacle, no static cell duplicates, exact interval depth, and full canonical top-to-bottom AABB. Both row-family and cut-family direct/iframe rows produced identical AABB (within the asserted `1e-5` tolerance): min `(0.5000000153,-0.4699999891,-0.1500000060)`, max `(2.2000000324,2.4699999891,0)`, size `(1.7000000171,2.9399999782,0.1500000060)`. Model tests covered squat multiplicity, left/right weave families, separation bounds/extremes, and consistent target/timing-tile/wall/shadow placement without changing lane width, exact interval, collision/scoring semantics, timing truth, or privacy.

Bounded independent commands all exited `0`:

- Renderer: `timeout --preserve-status -k 10s 600s npm test`; `timeout --preserve-status -k 10s 600s npm run test:browser`; isolated `npm pack --dry-run --json --ignore-scripts` (`40` files, `158432` packed / `652260` unpacked bytes, SHA-1 `f435e9a1e145b1f6869e4066db77646a86337b74`).
- Assembly focused direct/iframe authoring: `timeout --preserve-status -k 10s 300s node scripts/validate-environment-controls-browser.js`; mobile: `… validate-mobile-gameplay-menu.js`; product shell: `timeout --preserve-status -k 10s 600s node scripts/validate-product-shell-matrix.js`; privacy: `… validate-obstacle-public-privacy.js`; lifecycle: `timeout --preserve-status -k 10s 600s env AEROBEAT_TERMINAL_ORACLE=1 node scripts/validate-product-shell-matrix.js`; exact pixels/AABB: `… validate-exact-3c9d-browser-pixels.js`.
- Assembly regression/build/pack: `timeout --preserve-status -k 10s 600s npm test`; `timeout --preserve-status -k 10s 300s npm run build`; `timeout --preserve-status -k 10s 300s npm run test:release-pack-policy`; isolated `npm pack --dry-run --json --ignore-scripts` (`121` files, `16299309` packed / `17728669` unpacked bytes, SHA-1 `c8b55642341b42a328e08ccefa975ade1f1286d6`).

No source fix, version, immutable build/release, tag, publication, or serve/process/route change was made. Raw releases, failed raw `0.0.42`, live raw `0.0.43`, and pre-existing Beads interaction dirt were preserved. This is automated/model/framebuffer QA PASS, not Derrick's reserved physical default-tuning approval.

## Final independent audit — PASS (2026-09-08)

Final audit independently read the implementation, predecessor diff, QA-only diff, this diagnosis, the active plan, and Beads `xz09`, `1r2t`, `zajp`, and `8agl`. Exact pushed authority remains renderer `67bd21ee53b6e21e8525ae77cfc212db44613e45` / tree `89aad8422d324d69e44d32fd3a2bfae19caf96fb`, assembly product `dd506d47bd491134ca7345605e6c83576ebe8ae3` / tree `b8612aacb1c48bdef52f3801427e4a326e9dc142`, and QA docs `3c3f237dae95bf4ff61b932aa41801eb9b18b533` / tree `3ac6145e3820ca02b498a19b74475addb92332b7`.

Source read-back confirms the root-cause chain: raw `0.0.43` coupled beat-relative bounce start to first visibility, putting the apex in perspective-compressed distance while retaining correct metadata and exact landing. The legacy seven-key module/API/test path is deleted, and the replacement is the sole 13-key `aerobeat/test_presentation_config` v1 authority. Its primitive constructor and strict parser alone create module-private `WeakSet`-branded deeply frozen values; setter/normalizer/serializer reject arbitrary objects, clones, cross-realm lookalikes, accessors, and Proxies without inspection. Assembly keeps the trusted-child-local 16-KiB/fatal-UTF-8/generation/session/graph/purpose/lifecycle boundary and excludes config from snapshots, events, iframe messages, storage, packages, telemetry, network, scoring, and gameplay authority.

The normal far-spawn boundary is independent of beat lead; bounce starts no earlier than that visible boundary and shows default and maximum accepted near-camera motion before exact base-Y/world-Z-zero hit. Sky prelude is a separate additive absolute-time offset that is elevated at prelude start, approaches the assigned lane, is exactly zero at the normal boundary, and leaves the subsequent canonical approach unchanged. Eligibility is exact Flow notes, all straight/hook/uppercut punches, and both guard families; bombs, continuous walls, squat/weave checkpoints, shadows, timing/static surfaces, feedback, environment, and cursors remain static. Boxing Lanes separation is shared by targets, timing tiles, walls, and shadows, while lane width and exact intervals remain unchanged. Each semantic obstacle produces one continuous wall and one shadow, no legacy per-cell duplicate, spanning canonical `Y -0.47…2.47` with height `2.94`.

Focused final-audit commands exited `0`: renderer `node scripts/validate-test-presentation.js`, `node scripts/validate-renderer-facade.js`, and `node scripts/validate-grid-target-layering.js`; assembly `node scripts/validate-environment-controls-browser.js`, `node scripts/validate-mobile-gameplay-menu.js`, `node scripts/validate-obstacle-public-privacy.js`, `node scripts/validate-product-shell-matrix.js`, and `node scripts/validate-exact-3c9d-browser-pixels.js`. The first combined assembly attempt reached the product-shell gate's 600-second wrapper and was terminated by that wrapper without an assertion failure; the product-shell gate then passed independently under its bounded 1200-second wrapper, and exact pixels passed separately. Renderer pixels again produced `(Z,Y,count) = (-12,2,285), (-7.2,2.9,572), (-3,2.59375,1297), (0,2,3564)` with shadow `Y -0.702`; direct and genuine cross-origin iframe `3c9d` rows again matched the exact full-height wall AABB within `1e-5`.

Recorded full QA in commit `3c3f237` was inspected and accepted for the unchanged broad unit/browser/build/pack/privacy/lifecycle/scoring gates. Renderer and assembly remain at their pushed audited tips. Raw `0.0.43` remains byte/tree-identical at subtree `62b9475ec079849cd285b3e788357fc88fb52b91`, the raw `0.0.42` failure evidence is unchanged, PID `2133101` still serves only that raw `0.0.43` directory on `127.0.0.1:5173`, and pre-existing `.beads/interactions.jsonl` dirt remains preserved. No source, release, version, asset, serving, route, tag, or publication action occurred.

Final disposition: source integration for the trajectory and Boxing Lanes repairs may proceed. No immutable web/gameplay-asset release is authorized until the separate rounded-arrow asset audit passes and the consolidated release gate explicitly authorizes it; Derrick's physical default-tuning approval also remains reserved.
