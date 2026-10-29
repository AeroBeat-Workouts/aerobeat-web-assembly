# 0.0.153: athlete-facing depth-minus option

Status: delivered publicly as 0.0.153; automated acceptance complete. Physical preference remains Derrick's playtest.
Bead: aerobeat-web-assembly-qrtp. Owner: Pico; contracts/gameplay/renderer source owners participate.
Goal: goal-c58ca57d-af68-4d2a-b290-5a2f9dc4b4da; round cap Maximum safe integer.

## Product decision

Add `Keep depth− aimed toward athlete` to the existing Flow saber / Boxing glove collider controls in the gameplay/pause drawer. Default Flow OFF, Boxing ON. It affects only the negative/rear extension; positive reach and equipment art rotations remain as they are. Athlete-facing means fixed judge/world +Z, not a vector toward a moving head or a debug camera.

The OFF direction follows the equipment: opposite the saber's local +X axis, or the glove's local +Z rear axis. Boxing's current positive/front world-Z body stays unchanged. Flow keeps its current projected capsule judgement and independent timing window; do not add new timing eligibility or enlarge targets.

A bent rear and front must be represented as separate convex parts (union), not a diagonal capsule/cylinder connecting their far endpoints. This avoids inventing hittable space between the arms. Default Flow OFF and Boxing ON retain existing geometry. Zero reach/scale behavior stays unchanged. Both point and spline scoring consume the same geometry as Show volume; one successful part still uses the existing single judgement/consumption path.

## Shared interface and bounded cleanup

- Flat settings field: `colliderDepthBackwardAthleteFacing` (boolean). Mode defaults Flow false / Boxing true. Strict normalization and invalid-input handling retain existing principles; old partial settings normalize with correct mode default.
- Geometry volume argument: `depthBackwardAthleteFacing` (boolean, per-mode default).
- Add public contracts helpers `resolveSaberColliderParts(pose, volume)` and `resolveGloveColliderParts(pose, volume)` returning immutable arrays of `{start,end,radius,axis}` convex parts in judge space. Axis is unit length even for zero-length parts; saber's axis points forward along each part's start→end. Existing endpoint helper contracts remain valid for their original callers.
- Flow OFF: one capsule identical to the current backward→forward blade. ON: front capsule hilt→tip plus rear capsule hilt→world +Z (omit unnecessary zero-rear part, preserve point-radius behavior).
- Boxing ON: one cylinder identical to current world-Z cylinder. OFF: front cylinder unchanged with zero rear plus a rear cylinder from the existing rear-cap location along pose-rotated local +Z. Do not rotate the front body or shift its attachment. Preserve flat caps.
- Gameplay keeps its existing timing/direction/tiers/consumption. Setting participates in scored settings identity; legacy/default mode values preserve previous identities where existing identity rules require that, non-default direction cannot collide with the old identity.
- Renderer uses those same helper parts. Moving duplicate Flow reach math into the shared helper is justified by the new requirement for drawn/judged parity; no broader collider redesign.

## Menu and run behavior

The requested checkbox uses the existing settings-row style and active mode-specific fieldset, independent of Show volume. No knee-pad checkbox. No equipment-YAML version change is needed: collider-volume settings already live separately in Game Setup.

Retain current collider settings run binding: changes made in the pause menu apply to the next Play/Test run, like the existing depth controls. Do not silently mutate an active scoring partition or reset scores mid-run. Verify checkbox state survives mode switching and that starting a new run binds it consistently in judgement and renderer. Document restart behavior for playtesters.

## Tasks and acceptance

1. Complete: inspect existing geometry/settings/UI and claim feature. Read owner READMEs/status before edits; protect unrelated assembly ledger/screenshots.
2. Complete: contracts + gameplay implementation, normal regressions for mode defaults/boolean validation, rotated front invariant/rear direction, zero depths, setting identities, point/sweep exactly-once scoring.
3. Complete: matching renderer Show parts + native orientation and menu wiring. Test checkbox independence, mode-switch retention and next-run binding in Play/Test.
4. Complete: focused source gates and actual signed 0.0.153 browser checks with visibly rotated equipment. Confirm front/art unchanged, Show geometry matches scorer, defaults preserve existing behavior. Retain calibration152, spline150 and cache151 regressions where affected.
5. Complete: commit/push dependencies, repin clean source, build candidate, freeze snapshot, publish with0.0.152 rollback and verify public direct/iframe readiness. Update affected source and assembly READMEs/plans, close completed bead, verify intentional pushed state.

## Execution results before signed build

- Contracts/gameplay coder 51b221cb-c2bb-46af-9524-5e631e8db922 and renderer coder 294c0b47-4819-4e56-a91e-3b57617e44e3 were verified running direct children at launch. Both completed their bounded source tasks, committed/pushed and reported clean upstream state. No other implementation delegates or child trees.
- Contracts a1c1fbc2a51bdc2eb0c63dc3a2b46ae2dd4f2296 / tree b46197517882e33d795eafbb7218ef5bded119f9. Contracts normal tests, type/static gates, export regression and iframe contract script pass.
- Gameplay 20a1697ec3b4d0dae2fb1fb1263ed736981146a5 / tree 7df16ec878f38efcc8742930ab4091d016e58a03. Full npm test, Chromium and targeted type checks pass. Tests cover rear-only point/sweep contacts, no diagonal bridge, front invariant, zero behavior, mode defaults, strict booleans, legacy/default identities, nondefault identity separation, near/slice and exactly-once coordinator consumption. Recorded contracts pin updated.
- Renderer b5a1e77efc2bcf53ce3c5c9f6f6fe4a1bb9fe473 / tree 55a758670ccfe7af3d0adee059f7840f5aca2738. npm test and focused native Boxing-wire, Flow-volume and knee browser runners pass. Bent parts have separate native fill/wire slots; art/front invariants and quaternion cap/ring alignment are covered. Existing exact signed-zero expectation was restored by presentation-only zero canonicalization.
- Parent implements per-mode stored boolean normalization (old four-field records preserved with mode defaults), scorer field forwarding, requested checkbox and independent Show handling. Dedicated source regression passes defaults, invalid booleans/accessors, persistence, knee exclusion and scored identity.
- Connected source browser test passed all eight choices: Flow/Boxing × Play/Test × toggle OFF/ON. Native checkbox, next-run binding, same Show/scorer parts, real hits and exactly-once records pass. Additional explicit art/front invariant assertions are included for signed repetition.
- Normal test fixtures were updated to include the requested new boolean. Existing asset-source guards correctly rejected the old renderer pin; both asset-sync/environment guards were repinned to the new committed renderer, without changing asset bytes or weakening checks. The first normal check also required two missing @ts-check headers in new test files; corrected. Final assembly suite is running.

## Signed release and public results

- Assembly build source 6aa7422bb76ea0ed04bd5ad2f69bf4db929edf49; dependencies pinned to the exact source identities above. Built from clean private candidate checkout; source/asset/provenance gates retained. Final assembly npm test passes.
- Frozen snapshot .tmp/boxing-r153-6aa7422; stamp FRIEND-GAME-CPU-0.0.153-e4fb0750c7f2a4802ddeda7e, 59 signed files, entry assets/index-BTL98-AL.js.
- Signed test:rear-depth passes all eight mode/purpose/value cases. Native checkbox and mode defaults, separate Show boolean, next-run binding, all shared convex parts, unchanged wearable rotation/scale and positive front endpoints, real hit, scored identity and duplicate prevention are asserted. Eight cases each render into a nonzero 1000×700 framebuffer. Source settings test separately verifies old saved values, mode defaults, strict booleans/accessors, persistence roundtrip and unchanged knee shape.
- Signed 4 FPS calibration regression passes knee-enabled Boxing, knee-disabled Boxing and Flow: 9 actual pose samples, 16 idle ticks, successful countdown. Signed directional 1/2 FPS Flow/Boxing spline matrix passes. These are controlled browser input tests, not raw phone-camera claims.
- Public service aerobeat-r153 is enabled on 4216; pico funnel targets it. Local/public HTML SHA-256 identical: eb7236f4f1c2c06ae2979186397aa581a5fcf12749bb7d853df9a149cf8cdea5.
- Public HTTPS direct and true cross-origin iframe show 0.0.153 and the new checkbox, Flow false/Boxing true defaults, ready conversion/render assets/environment, cpu-wasm and nonzero canvases. No page errors.
- Rollback: repoint the public funnel to http://127.0.0.1:4215 and stop aerobeat-r153. aerobeat-r152 remains active. README explains Depth− must be >0 for added rear reach and changes apply next run.
- Source and release documentation are committed/pushed; close qrtp with automated evidence. Preserve unrelated ledger/screenshots. No new in-scope unresolved findings; earlier unrelated camera-control follow-up nnm6 and custom-wall discussion igiw are unchanged and do not block this feature.

## References / non-goals

Observed current sources: contracts src/collider-contracts.js and equipment-pose-contracts.js; gameplay src/equipment-pose-collision.js, flow/boxing settings, session-coordinator.js; renderer src/gameplay-scene-model.js; assembly src/game-setup-coordinator.js and index.js controls.

No new timing/scoring policy, confidence rule, generic safety/provenance layer, MediaPipe change, custom-wall support or speculative audit. No new UI design/mockup is required: Derrick explicitly requested this boolean in existing controls; only this row is added, using existing styles. Physical preference remains Derrick's phone playtest.
