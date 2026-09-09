# Raw 0.0.48 landmark transparency diagnosis

**Date:** 2026-09-09
**Beads:** `aerobeat-web-assembly-uo1y` (P0), umbrella `aerobeat-web-assembly-pver`
**Physical authority:** Derrick's raw `0.0.48` screenshot/feedback
**Disposition:** Diagnosis complete. No source, immutable raw, build, serving, publication, or physical-PASS action is authorized or performed. `uo1y` remains open/in progress for approved implementation.

## Exact Observed Failure

### Directly observed/reported

Derrick's physical raw `0.0.48` feedback, durably recorded on `pver`, is:

> “Screenshot shows three landmarks as largely transparent circular cutouts: both wrists and nose remain invisible/incorrectly rendered; P0 uo1y, wrists must use song-provided left/right colors like beats.”

The failure occurs during live-camera Flow gameplay in the final composited presentation. All three accepted gameplay landmarks are affected, not only one hand or one content color.

The screenshot bytes themselves are not present in this checkout or attached to this delegated session. Therefore “transparent circular cutouts” is the exact physical symptom report; it is not evidence by itself that the WebGL material alpha is less than one.

### Direct source/raw observations

The exact immutable raw marker is `release/raw/0.0.48/assets/gameplay/0.0.10/athlete-marker/sphere-v1.glb`, SHA-256 `b2316b8ec013e9d9087a0bd6d9e5dcef643a34132f9c51fc2526c68d317f7530`. It is byte-identical to the renderer package and canonical asset release copies.

That GLB has one closed 168-triangle sphere split into three disjoint surface primitives:

- `mat/charcoal`: 24 triangles;
- `mat/white`: 80 triangles;
- `mat/tint_base`: 64 triangles.

All three glTF materials are `alphaMode: "OPAQUE"`, base alpha `1`, `doubleSided: false`, with no diffuse, emissive, or opacity map. Read-only geometry inspection found 168/168 outward-wound triangles. From the production camera's `+Z` side, orthographic projected front-surface area is approximately:

- charcoal: `2.9243%`;
- white: `52.0416%`;
- tint: `45.0341%`.

The marker is therefore technically opaque but visually dominated by a white triangular patchwork, with less than half of its visible face carrying the landmark role color and almost no dark separator area.

Raw `0.0.48` then treats markers differently from note beats. Its marker branch applies `0.68 × roleColor` to `mat/tint_base`; its ordinary note-fill branch applies `1.0 × appearanceColor`. Thus the wrist's visible tint is neither the exact song color nor the same fill treatment used by note beats. Nose similarly starts from fixed `#f4c20d` but is reduced to `0.68 ×` that yellow on only the tint primitive.

## Expected Behavior

- Every accepted nose/left-wrist/right-wrist sphere must read as a solid, opaque, visible 3D landmark over live camera and Flow geometry.
- Left and right wrist visible fills must use the exact generation-bound selected-song left/right colors used by note beats, without a marker-only `0.68` RGB reduction.
- Nose must remain clearly visible under its fixed approved yellow role contract (`#f4c20d` in current renderer authority), not become a pale/white-dominant circular patch.
- Preserve measured calibrated positions, apparent size contract, normal depth test/write, truthful occlusion, back-face culling, lifecycle/pooling/context restoration, and privacy.
- Do not solve visibility by lowering alpha, disabling depth/culling, moving markers, forcing always-on-top, or exposing palette/pose data publicly.

## Execution Path

1. `src/production-cv-service.js::runEstimate()` submits the current camera `VideoFrame` to the locked MediaPipe adapter and retains the returned normalized pose frame after generation/runtime validation.
2. `src/index.js::runDisplayFrame()` reads `graph.cv.getLatestPoseFrame()` and passes each fresh frame to `graph.input.processPoseSample(...)` with the current camera aspect/source identity.
3. `aerobeat-web-input/src/body-grid-service.js::processPoseSample()` validates measured source/timestamps, calibration visibility, and freshness. `mapMeasuredAnchors()` converts MediaPipe camera-preview landmarks into athlete coordinates, normalizes them against calibrated bounds, and publishes anchor records for nose and wrists.
4. `src/index.js::gameplayCursorRecords()` admits only `nose`, `left_wrist`, and `right_wrist` anchors that are valid, finite, calibrated/current, and confidence `>= 0.5`. It emits exact private `{role,x,y,confidence}` cursor records.
5. `src/index.js::renderGameplay()` stages the gameplay model and those cursor records in one renderer call with `sizeCssPx: 32`.
6. On content readiness, `src/index.js::applyContentVisualTruth()` obtains the generation-bound private effective song palette and sends it through the renderer's non-enumerable internal palette capability. This palette is not serialized publicly.
7. `aerobeat-web-renderer/src/renderer-facade.js::renderGameplayScene()` updates world/grid/target objects, then calls `stageGameplayCursors()` before the same manual PlayCanvas tick.
8. `stageGameplayCursors()` maps normalized X/Y to world position at Z `0.45`, selects fixed nose `#f4c20d` or private song left/right color, computes a world scale for 32 CSS px, instantiates the canonical marker GLB, and calls `applyAssetAppearance(..., alpha=1)`.
9. `applyAssetAppearance()` keeps source opacity/blend/depth/cull/maps. For marker clones it disables lighting, assigns fixed charcoal/white values, and assigns only `mat/tint_base` to `0.68 × roleColor` for both diffuse and emissive.
10. PlayCanvas renders marker primitives in the World opaque pass. The camera video DOM element is z-index 1 and the renderer canvas is z-index 2; the canvas clear is transparent in Camera mode. Fully opaque marker fragments replace the underlying video, while the marker's white/tint triangular partition determines what the user perceives.

## Most Likely Root Cause

The physical failure is a **visual/material-contract mismatch, not demonstrated alpha blending**:

1. The marker asset is one low-poly sphere whose surface itself is partitioned into large white/tint triangular patches. At the runtime camera face, white occupies about `52%`, exact role tint only about `45%`, and charcoal about `3%`. This can read as a white/clear circular cutout over similarly bright Flow/video content rather than a solid role-colored landmark.
2. The renderer deliberately reduces the already-minority tint region to `0.68 × roleColor`. Notes use the full appearance RGB. This directly violates the new explicit requirement that wrists inherit the exact song left/right colors “like note beats,” and it also weakens the fixed nose yellow.
3. Previous automation treated opacity, pixel count, and minimum presence of each material as success. It did not require role-color dominance, exact note/marker RGB parity, or physical final-composite readability. One current assembly oracle explicitly encodes the incorrect `0.68 × palette` value as the expected wrist result.

Evidence is causal: measured landmarks and private palette reach the renderer correctly; the raw marker bytes and live code deliberately convert the requested colors into a white-dominant, reduced-tint surface while preserving opaque alpha. That output matches the reported circular low-visibility symptom and independently proves the exact-color contract failure.

## Alternative Hypotheses

Ranked by likelihood:

1. **White-dominant partition plus marker-only color reduction — highest / confirmed contract defect.** Supported by exact GLB primitive geometry, projected area, and raw `0.0.48` code. It explains all three roles and exact-color failure.
2. **Final live-camera composite interaction — plausible contributor, not primary alpha cause.** Existing live-marker automation does not place real moving video behind the DOM canvas; it mathematically composites raw marker alpha against synthetic fields and tests photospheres within the WebGL canvas. Device/browser antialiasing and camera imagery may amplify the cutout appearance. It does not explain why raw code intentionally uses only `0.68 ×` wrist colors.
3. **Material state/cache replacement regression — lower likelihood.** Raw `0.0.48` includes renderer commit `bd8ad9e`, which reconciles unexpected live mesh-material replacements. Source GLB and captured material contracts are opaque. No evidence shows the final live marker material becoming blended after reconciliation. A targeted long-running final-composite capture should still observe it.
4. **Depth/layer/z-fighting — low likelihood.** Markers are at world Z `0.45`, depth-test/write, and prior grid-on/off probes found no change in fully opaque marker interiors. They are staged after gameplay before one tick, with no intervening depth clear. A final screenshot mask against coincident Flow remains useful to exclude a device-specific ordering issue.
5. **Inward winding/back-face culling — contradicted for current raw.** That was real in immutable marker `0.0.6`, but `0.0.7` reversed it. The exact `0.0.10` copy has 168/168 outward triangles, positive face/centroid orientation, explicit radial normals, and back culling.
6. **Opacity map/texture alpha — contradicted.** The GLB and runtime records contain no opacity/diffuse/emissive maps; all base alphas are one and source blend is `BLEND_NONE`.
7. **Pose mapping/confidence loss — contradicted by symptom shape.** Invalid/stale anchors disappear rather than render as stable circular cutouts. The screenshot shows all three marker-shaped artifacts, so the failure is downstream of accepted pose projection.

## Why Previous Fixes Failed

- Asset `0.0.6` added white/charcoal/tint structure and opaque declarations, but its sphere winding was inward and its review path disabled culling.
- Asset `0.0.7` correctly repaired winding, normals, culling, and immutable validation. It did not change the patchwork partition into a role-color-dominant silhouette.
- Renderer `1ba6d28` made marker clones lighting-independent and selected 32 CSS px. This fixed the measured 18 px contrast collapse, but it preserved the same 52%-white/45%-tint surface and introduced/retained the `0.68 × roleColor` marker-only treatment.
- The live-marker oracle's selected-32 PASS required only `>=8` isolated pixels from each material, an opaque ratio, perimeter contrast, environment delta, and raw-canvas size. It never required most visible pixels to carry the role color, exact wrist-note RGB equality, or a real final DOM camera composite.
- `validate-real-3c9d-trajectory-controls.js` labels wrists as matching the song palette while calculating the expected result as `palette × 0.68`; it therefore blesses the precise mismatch Derrick now rejects.
- Material-cache and lifecycle tests prove stable reapplication, replacement recovery, context restoration, and no stale mutation. They do not prove approved visual semantics.
- Large Blender cardinal renders make the opaque patchwork obvious at review scale but are not a 32-CSS-px, live-camera, song-color acceptance oracle.

## Unknowns

1. The original physical screenshot bytes and device/browser/DPR details are not available in this delegated session. Attaching the image or recording its crop/histogram would allow exact comparison with reproduction captures.
2. It is not yet proven whether removing marker-only RGB attenuation alone makes Derrick's physical target acceptable. A/B final-composite captures can distinguish color attenuation from geometry partition dominance.
3. The exact approved nose presentation beyond the current fixed `#f4c20d` token is not restated in `uo1y`. Current code and prior plan establish fixed yellow plus structural contrast; Derrick should confirm whether its full fill must be exact `#F4C20D` or whether a narrowly bounded white/charcoal structure remains desired.
4. Device-specific MSAA/color-management effects on the final Camera-mode canvas/video composite are unmeasured.
5. No evidence currently shows alpha, blend, depth, cull, or map state mutating after several minutes of dense physical play. A long-running readback would close that residual cache hypothesis.

## Minimal Reproduction

### Exact immutable/raw inspection (performed, no serving or mutation)

1. Parse raw `0.0.48` marker GLB JSON/BIN.
2. Confirm three OPAQUE materials, alpha one, no maps, outward winding, and the `24/80/64` triangle partition.
3. Project front-facing triangle areas and observe approximately `2.9%` charcoal / `52.0%` white / `45.0%` tint.
4. Inspect raw `assets/index.js`: wrists receive the private song palette, but marker tint becomes `rgba × 0.68`; ordinary note fill becomes full `rgba`.

This reproduces the deterministic semantic defect without running a server or altering immutable output.

### Smallest user-visible reproduction for approved QA

1. Open exact raw `0.0.48` on the existing secure private route; do not rebuild it.
2. Import/select a song whose left/right palette differs strongly from default cyan/red.
3. Start calibrated live-camera Flow gameplay with grid hidden, place both wrists and nose over a visible approaching note and over bright/dark camera regions, and capture the final screenshot.
4. Sample the note's `mat/tint_base` and corresponding wrist `mat/tint_base`. Current expected failure: wrist RGB equals `0.68 × songColor`, not the note's exact RGB, and less than half the marker face presents tint.
5. Toggle Flow grid and environment/camera composition while holding landmark positions. If the cutout remains with unchanged opaque marker alpha, layering is not causal.

The symptom does not occur when markers are omitted by stale/invalid tracking; that is correct fail-closed behavior, not this defect.

## Proposed Verification

Before implementation, add a diagnostic A/B that separates the leading cause from alternatives:

1. Capture raw renderer and final DOM-composite crops for all three roles over a real or deterministic moving video, with a same-color note adjacent or partially behind.
2. Record every live marker mesh material after render and after several dense frames: material identity, RGB/emissive, opacity, blend, depth test/write, cull, maps, and shader variant. Assert opacity `1`, `BLEND_NONE`, depth test/write true, back culling, and no maps throughout.
3. A/B only the marker appearance in a disposable diagnostic build:
   - A: current 52%-white / 45%-tint / `0.68 ×` treatment;
   - B1: same geometry with exact `1.0 ×` role tint;
   - B2: exact tint plus role-color-dominant structural geometry.
4. Require exact wrist tint equality with the neighboring note's effective song-color fill in linear renderer values and bounded screenshot color-space tolerance. Require nose fill equality with its approved fixed token.
5. Require a role-color projected-area floor from every cardinal view at 32 CSS px and bright/dark/skin/high-frequency backgrounds; a suggested diagnostic threshold is a majority of opaque interior pixels, not the current eight-pixel presence floor. Final acceptance threshold remains Derrick's physical judgment.
6. Repeat direct/genuine iframe, portrait/landscape, DPR 1/requested 3, grid on/off, Flow/Boxing, camera/Aero, context restore/reconnect, dense frames, truthful occlusion, and privacy checks.

If B1 remains cutout-like but B2 is solid, asset partition is causal. If B1 passes, the minimal renderer RGB correction suffices. If live material state becomes blended or mapped despite expected records, investigate material replacement/shader state instead of reauthoring geometry.

## Recommended Minimal Fix

The smallest fix that fully satisfies the explicit contract is likely two narrow ownership changes, gated by the A/B above:

1. **Renderer:** for marker `mat/tint_base`, use the exact resolved color (`1.0 × rgba`) as note beats do. Keep alpha one, source `BLEND_NONE`, depth test/write, back culling, no maps, marker-only lighting independence, measured position, and 32 CSS px. This is mandatory for exact wrist-song color parity and clearer fixed-yellow nose output.
2. **Asset only if B1 does not physically pass:** create an append-only gameplay-asset successor that preserves the closed 0.18-unit sphere but makes exact role tint visually dominant from every camera direction, with a narrow camera-independent charcoal/white separator rather than the current large white triangular surface partition. Do not mutate `0.0.7`–`0.0.10`; do not add textures, transparent shells, coplanar faces, or always-on-top behavior.
3. Replace tests that encode `palette × 0.68` with note/marker exact-color parity, projected role-color dominance, and final Camera-mode DOM-composite evidence. Preserve all existing alpha/depth/winding/lifecycle/privacy tests.

A renderer-only “set alpha again” fix is not recommended: alpha is already one and opaque. Disabling depth/culling or moving Z would suppress the symptom at the cost of truthful gameplay occlusion.

Potential regressions: very bright song palettes losing white-structure separation, nose yellow contrast over yellow video, marker/near-target occlusion, context-restored material identity, color-space tolerance, and asset triangle/draw budgets. The proposed verification covers these directly.

## Debugging Record

```text
Problem:
Raw 0.0.48 physically shows nose and both wrist landmarks as largely transparent circular cutouts; wrists do not visibly carry the exact song left/right colors like beats.

Observed symptom:
All three live-camera Flow markers are invisible/incorrectly rendered in Derrick's screenshot. Exact screenshot bytes are unavailable here; repo/raw inspection shows technically opaque but white-dominant patchwork spheres.

Root cause:
The canonical marker surface is approximately 52% white, 45% tint, and 3% charcoal from the production camera face, while renderer marker tint is deliberately reduced to 0.68 × roleColor. This visual/material contract differs from full-color note fills and makes opaque markers read like pale circular cutouts.

Evidence:
Exact raw/renderer/asset GLB byte identity and SHA-256; 168 outward triangles; three alpha-1 OPAQUE materials; no maps; projected primitive-area measurement; raw 0.0.48 marker branch uses rgba × .68 while note branch uses rgba; current test oracle encodes × .68 as expected.

Failed approaches:
0.0.6 structural opacity had inward winding; 0.0.7 fixed winding/culling; renderer 1ba6d28 added unlit contrast and selected 32 CSS px. Those fixes preserved white-dominant patch geometry and reduced tint. Tests proved technical opacity/presence, not exact color parity or final physical composite visibility.

Corrective action:
First apply exact 1.0 × effective song/fixed-nose tint in a disposable diagnostic A/B. If still physically insufficient, append-only reauthor the marker to a role-color-dominant opaque sphere with narrow structural separation. Never weaken depth/cull/alpha truth.

Verification test:
Raw plus final live-camera DOM-composite crops; exact note/wrist color equality; fixed nose-color equality; majority role-color projected coverage across cardinal views/backgrounds; persistent opaque material state; direct/iframe/orientation/DPR/grid/mode/lifecycle/privacy matrix; Derrick physical retest.

Related files/components:
aerobeat-web-assembly/src/index.js
aerobeat-web-assembly/scripts/validate-live-marker-visibility.js
aerobeat-web-assembly/scripts/validate-real-3c9d-trajectory-controls.js
aerobeat-web-assembly/release/raw/0.0.48/assets/index.js
aerobeat-web-renderer/src/renderer-facade.js
aerobeat-web-renderer/src/gameplay-assets.js
aerobeat-web-input/src/body-grid-service.js
aerobeat-asset-gameplay/release/raw/0.0.10/athlete-marker/sphere-v1.glb
aerobeat-asset-gameplay/manifests/athlete-marker/sphere-v1.v1.json

Remaining uncertainty:
Original screenshot pixels/device details, whether exact-color renderer correction alone physically passes, and Derrick's precise desired fixed-nose fill/structure balance.
```
