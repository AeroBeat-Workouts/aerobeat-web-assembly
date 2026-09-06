# Rounded, Outlined Gameplay Cues — Asset Design Diagnosis and Successor Specification

**Date:** 2026-09-06  
**Status:** DESIGN/RESEARCH COMPLETE — implementation, asset creation, integration, release, serving, and physical approval are not authorized by this record  
**Owning repo:** `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`  
**Beads:** design `aerobeat-web-assembly-zqh`; umbrella `aerobeat-web-assembly-3dc`; physical gate `aerobeat-web-assembly-k72.17`  
**Evidence baseline:** immutable web raw `0.0.41`; immutable gameplay assets `0.0.7`  
**Asset baseline identity:** creator commit `7dec076e243571144b7ead638d3e3f4780bcb9f4`; creator tree `62863270ed4455eee7132d9bb374522a46f72e30`; raw tree `846c41297230b5077ab1119880b729cc120e1098`; inventory SHA-256 `ba3f40ad3b178da9845a74c89d3a89115d13fa5bd86b291bf41031df70eabbf4`; proof SHA-256 `ebeb42ffaa351bcdbd7ae8120b62762d16d8957acd8a4b1286b324ffa5e6cfdb`  
**Current clean asset checkout:** commit `80bcb3a46e1c9465bfabd549d1b40b7989b40d9d`, a tooling-only descendant of the creator; `release/raw/0.0.7` still resolves to the raw tree above

## Scope and boundaries

This document diagnoses the cue geometry seen in Derrick's physical raw `0.0.41` review and specifies an append-only, original, procedurally authored successor. It does not modify or authorize modification of a GLB, Blender source, asset/review release, renderer, assembly runtime, web release, serving route, publication, or physical-review state.

The proposed art is informed by the readable broad-stem, broad-head, softened-corner language associated with classic dance-game arrows. It is not a trace or redistribution of a Konami/DDR image. Historical references establish the classic arrow's V-tail lineage, but the successor remains original AeroBeat/Gambit Games procedural geometry: [RemyWiki DDR 1st](https://remywiki.com/AC_DDR_1st), [LaunchBox original arcade screenshots](https://gamesdb.launchbox-app.com/games/images/35766-dance-dance-revolution).

## Exact Observed Failure

Derrick's direct raw `0.0.41` feedback is authoritative:

> “Directional arrow silhouettes are too sharp for the intended rounded Frutiger Aero art direction. Their geometry must use visibly rounded edges while preserving directional clarity and the established white stroke.”

> “Guard beats and any-direction circle beats must gain the same high-clarity white stroke language.”

Directly observed in immutable asset `0.0.7` and its creator:

- The directional-arrow outer silhouette is a seven-vertex polygon: tail corners `(-0.16,-0.39)/(0.16,-0.39)`, square shaft/shoulder transitions at `y=0.05`, head corners `±0.39`, and a point at `(0,0.39)`. No XY corner radius or curve primitive exists.
- Arrow front/rear bands are also seven-vertex polygons. Every head, shoulder, notch, and tail transition therefore reads as a hard corner. The `0.18`-deep extrusion adds hard longitudinal edges.
- The any-note is only a 24-sided polygon. At gameplay scale its perimeter can facet, especially on high-DPR displays and oblique views.
- The guard is a seven-vertex polygon with an acute top and hard side/lower transitions. No corner radius exists.
- The arrow is explicitly styled on both `+Z` and `−Z`; measured GLB cap evidence shows white, charcoal, and tint caps on both sides.
- Any-note and guard are declared `visible_face:"-Z"` and use the legacy `rimmed_plate`. Their white annulus exists only at `z=-0.09` (circle) or `z=-0.15` (guard). The `+Z` side has no matching white annulus.
- The runtime's fixed camera is at world `+Z`, looking `−Z`, so approaching unrotated cues present their `+Z` face. This is precisely the side where circle and guard lack the authored white annulus.
- Circle and guard each layer a full outer rear cap and a fill rear cap on the same `+Z` plane (`z=0.09` and `z=0.01`, respectively). Those coplanar overlapping caps are structurally capable of z-fighting. Asset `0.0.7` strictly rejects this condition for arrow and marker, but not for circle or guard.
- The individual Blender reviews use a camera direction with negative Z and therefore favor the authored `−Z` face. They do not prove the actual fixed-camera `+Z` face seen in PlayCanvas.

Observed immutable dimensions/triangles are arrow `0.78 × 0.78 × 0.18`, 136 triangles; circle `0.70 × 0.70 × 0.18`, 258 triangles; guard `0.72 × 0.82 × 0.16`, 71 triangles.

## Expected Behavior

- Arrow reads immediately as one of eight directions at front, rear, and three-quarter approach angles while all silhouette transitions feel rounded rather than sharp or toy-block angular.
- Arrow, any-note, and guard share one strong white-stroke grammar with a thin charcoal keyline outside and charcoal separation inside, on both `+Z` and `−Z` faces.
- Stroke geometry is opaque, depth-tested, depth-writing, outward wound, manifold, and non-overlapping. It does not depend on alpha blending, a screen-space outline pass, duplicated coplanar shells, polygon offset, or disabled depth testing.
- Arrow and any-note fill are the only gameplay-note surfaces that accept song-provided left/right note color. Guard, bomb, wall, and track remain fixed authored colors. Athlete-marker tint remains renderer cursor-role feedback and never receives song palette data.
- White and charcoal structure never inherit note tint or success tint. Success-area whitening affects only the note fill.

## Execution Path

1. Raw `0.0.41` packages renderer `0.0.7` gameplay assets.
2. Gameplay maps directional notes to `directional-arrow/outline-v1`, directionless notes to `any-note/circle-v1`, and guard events to two instances of `guard/shield-v1`.
3. Renderer instantiates the GLB and clones its materials.
4. `applyAssetAppearance` currently infers structural materials from material-name regex and tints other eligible materials; it does not consume an explicit per-material role contract for every asset.
5. Fixed gameplay camera at `(0.05,1,5)`, Euler `(0,0,0)`, FOV `48°` views approaching unrotated assets from world `+Z`.
6. Arrow shows its bidirectional style, but its seven-point silhouette and hard extrusion remain sharp.
7. Circle/guard show the legacy rear construction, not their `−Z`-only white annulus. The coincident rear fill/outer caps can compete at equal depth.

## Most Likely Root Cause

The root cause is not lighting or insufficient white pigment. It is a mismatch between authored geometry and the actual presentation contract:

1. **Sharpness:** arrow and guard silhouettes are raw polygon corners with zero fillet radius; circle has visible 24-gon chord changes. Lighting can soften shading but cannot change those projected boundaries.
2. **Missing physical stroke on circle/guard:** their white ring is single-sided (`−Z`) while gameplay normally presents `+Z` to the fixed camera.
3. **Unstable rear construction:** circle/guard use intersecting/coplanar nested caps rather than one partitioned exterior surface.
4. **Fragile tint policy:** renderer material behavior is inferred from names and asset-id exclusions rather than an explicit fill-versus-structure role asserted by asset metadata.

## Alternative Hypotheses

1. **Lighting washes out white** — possible contributor on bright environments, but contradicted as the primary cause because circle/guard have no white geometry on the presented `+Z` cap.
2. **Targets are simply too small** — may amplify faceting and stroke loss, but increasing scale would leave hard corners and the wrong-sided ring intact.
3. **Camera rotation flips the face** — unlikely. The renderer contract fixes the camera on `+Z` looking `−Z`, and note direction rotates only around local Z.
4. **Transparency sorting hides the ring** — contradicted for arrow: its three materials are opaque. The requested solution should keep all three cue roles opaque and avoid entering the transparent queue.

## Why Previous Fixes Failed

- Asset `0.0.2` replaced predominantly dark perimeter silhouettes with explicit white front rings, but circle and guard retained a one-sided legacy plate.
- Asset `0.0.5` repaired arrow bidirectionality and no-coplanar-cap validation only for the arrow. It did not generalize the construction or validator to circle/guard.
- Asset `0.0.7` changed only athlete-marker winding. Arrow, circle, and guard remained byte-identical to predecessors.
- Existing reviews are high-resolution and bounds-safe, but the cue individual camera favors `−Z`; they did not include actual-camera `+Z`, reverse, side, or minimum-render-size stroke acceptance.

## Unknowns

- No screenshot or framebuffer capture from Derrick's exact physical device is preserved in this Bead. The direct written feedback is observed; the exact device panel, browser DPR, viewing distance, and apparent cue pixel size are unknown.
- The final preferred softness among the alternatives below needs Derrick visual selection from real renders.
- Song-color parsing/fallback is owned by sibling research Bead `aerobeat-web-assembly-2ey`; this design specifies only which material roles may receive that result.

Resolve these unknowns with the acceptance render matrix and Derrick's physical successor review, not speculative runtime scaling.

## Minimal Reproduction

1. Serve the already-authorized exact raw `0.0.41` through its existing secure physical-review route.
2. Open Visual Test at the canonical fixed camera.
3. Observe one directional note, one any-direction note, and one guard approaching along world `−Z → 0`.
4. Arrow head, shoulder, concave neck, and tail corners remain hard; circle can facet; circle and guard do not exhibit the same prominent white perimeter as the arrow on the presented face.

The defect is less apparent in `review/0.0.7/*--*.png` because those individual renders favor the opposite (`−Z`) face and display cues much larger than gameplay.

## Proposed Verification

Before implementing a successor, use a temporary, non-release procedural render of each alternative. A candidate confirms the diagnosis only if:

- increasing XY curve tessellation and applying the radii below changes the projected outer boundary while keeping camera, lighting, size, and colors fixed;
- both `+Z` and `−Z` renders show the same ordered structural bands;
- wireframe/topology inspection shows one exterior surface with shared band edges and zero coplanar/internal duplicate faces;
- turning lighting off does not remove the white stroke;
- rendering dark, bright, and saturated-blue fields proves the charcoal/white/charcoal sandwich remains identifiable;
- disabling runtime tint changes no white/charcoal pixels; applying two extreme valid note colors changes only note fill pixels.

## Recommended Fix — exact successor design

### 1. Recommended silhouette: Alternative B “Aero Rounded”

Keep the established overall cue scale and directional proportions, but replace raw polygon corners with deterministic tangent fillets. Curves are authored analytically and tessellated; they are not Blender bevel-operator output.

All numeric values are local world units after final normalization.

#### Directional arrow

- Overall AABB: exactly `[-0.39,+0.39] X`, `[-0.39,+0.39] Y`, `[-0.09,+0.09] Z`; pivot/origin `[0,0,0]`; dimensions remain `0.78 × 0.78 × 0.18`.
- Preserve the seven-anchor proportion family: shaft half-width target `0.155`, shoulder Y `0.055`, head half-width `0.390`, tail Y `−0.390`, tip Y `+0.390`.
- Preserve a broad arrowhead and concave shoulder; do not add the historical DDR V-tail notch. This keeps the result original and avoids reducing small-size stem mass.
- Tangent fillet radii: tip `0.055`; two outer head/shoulder corners `0.060`; two concave neck corners `0.045`; two tail corners `0.050`.
- Build fillets against the anchor polygon, then normalize the resulting curve extrema independently to exact `0.78 × 0.78`; reported radii after normalization must remain within `±0.002` of targets.
- Each quarter-circle equivalent gets at least 4 equal-angle segments; maximum XY chord error `≤0.0015`. No segment turn may exceed `11.25°` on convex fillets or `15°` on concave fillets.
- Fill must retain a connected shaft width `≥0.170`, connected neck width `≥0.145`, head-tip local radius `≥0.045`, and projected fill area `≥42%` of outer face area. These guards preserve eight-direction readability at small size.

#### Any-direction circle

- AABB remains `[-0.35,+0.35] X/Y`, `[-0.09,+0.09] Z`; dimensions `0.70 × 0.70 × 0.18`; pivot/origin `[0,0,0]`.
- Use an exact analytic circle with 64 deterministic perimeter samples, starting at `+X` and proceeding CCW as viewed from `+Z`.
- Maximum radial error from `0.350` is `1e-6`; maximum chord sagitta is `0.000422`.
- Circularity ratio (minimum/maximum projected radius in orthographic face view) `≥0.998`.

#### Guard shield

- AABB remains `[-0.36,+0.36] X`, `[-0.41,+0.41] Y`; overall depth remains `0.16`; preserve rear-grip pivot `[0,0,0.07]` and measured Z `[-0.15,+0.01]`.
- Preserve the current shield mass and bilateral symmetry, but replace all seven hard transitions with tangent fillets.
- Radii after normalization: top crown `0.050`; upper shoulders `0.055`; lower side transitions `0.060`; bottom point/lobes `0.065`.
- Minimum 4 segments per quarter-circle equivalent; maximum XY chord error `≤0.0015`; exact mirror symmetry around X=0.
- Fill area `≥48%` of outer face area. The lower center remains recognizably shield-like, never circular.

### 2. Shared stroke and depth construction

Use one closed, connected, two-manifold exterior mesh per cue. Front and rear caps are concentric/offset regions sharing boundary edges; they are not stacked solids or duplicate coplanar shells.

Face-band order from outer silhouette inward, identical on both `+Z` and `−Z`:

1. fixed outer charcoal keyline: normal width `0.014`;
2. fixed white stroke: normal width `0.052`;
3. fixed inner charcoal separator: normal width `0.020`;
4. role fill.

For the circle these become exact radii `0.350 / 0.336 / 0.284 / 0.264`, with fill radius `0.264`. For arrow and shield use true inward curve offsets, not origin scaling; reject self-intersections and any band narrower than `90%` of its target. Miter joins are forbidden. Offset curves use round joins with the same local radius family.

Depth-edge bevel:

- Arrow/circle axial bevel `0.012` on each face; guard axial bevel `0.010` on each face.
- Bevel uses 3 equal-angle segments over 90°; maximum normal-angle step `30°`.
- The front/rear white region continues onto the face bevel. The central longitudinal side wall is fixed charcoal, producing a stable dark silhouette at near-side-on angles.
- Cap interiors remain planar. Normals are explicit: planar cap normals exactly `±Z`, smooth radial bevel normals, and hard-normal boundaries at cap-to-band material seams where needed for crisp color separation.

The result must have:

- every undirected mesh edge referenced exactly twice;
- outward CCW triangle winding under glTF semantics;
- positive signed volume;
- no degenerate/duplicate triangles, non-manifold vertices, self-intersection, coplanar overlap, internal faces, T-junctions, or zero-area bands;
- `doubleSided:false`, back-face culling, alpha `1.0`, `alphaMode:"OPAQUE"`, depth test/write true for every cue material;
- no polygon offset, depth bias, screen-space outline, transparent blend, stencil dependency, or always-on-top pass.

Triangle budgets: arrow `≤360`, circle `≤520`, guard `≤420`. These are upper bounds, not targets. The generator must produce explicit normals for the changed cues and validators must prove geometric/NORMAL agreement (`dot > 0.90`) for every referenced corner.

### 3. Material roles and tint contract

Use stable material names plus explicit `extras.aerobeat` roles; renderer integration must consume/validate metadata rather than infer tintability from a regex.

| Cue | Material | `materialRole` | `runtimeTintable` | Color ownership |
|---|---|---|---:|---|
| Arrow | `mat/tint_base` | `note_fill` | true | valid song left/right note color, deterministic AeroBeat fallback |
| Any-note | `mat/tint_base` | `note_fill` | true | valid song left/right note color by note side/type, deterministic AeroBeat fallback |
| Arrow/any/guard | `mat/white` | `outline_white` | false | fixed authored white |
| Arrow/any/guard | `mat/charcoal` | `outline_charcoal` | false | fixed authored charcoal |
| Guard | `mat/green` | `guard_fill` | false | fixed authored guard green |

Every material also declares `blend:"opaque"`, `cull:"back"`, `depthTest:true`, and `depthWrite:true`. Exactly one primitive/material role per fill and at least one primitive for each structural role are required. Success-window whitening and song color multiplication target only `materialRole:"note_fill"`.

Fixed-policy inventory:

- guard: fixed green fill + fixed white/charcoal structure; both identical instances use identical materials;
- bomb: existing fixed black/charcoal/red-emissive materials, byte-identical from `0.0.7`;
- wall: existing fixed red glass/edge, byte-identical from `0.0.7`;
- track: existing fixed blue glass/cyan edge, byte-identical from `0.0.7`;
- athlete marker: existing cursor-role `mat/tint_base` behavior remains byte-identical and is not song-color eligible.

### 4. Alternatives for Derrick review

Render all three as temporary review-only candidates with identical camera/light/background framing:

- **A — Conservative:** radii `0.035/0.040/0.030/0.035` for arrow classes; guard `0.035–0.045`; same stroke widths. Highest crispness, but likely still too angular physically.
- **B — Aero Rounded (recommended):** exact values above. Best balance of friendly Frutiger Aero softness and direction readability.
- **C — Bubble:** arrow `0.070/0.075/0.055/0.065`; guard `0.070–0.085`; white `0.058`. Friendliest silhouette, but risks shrinking fill neck/head definition below the acceptance limits.

Only one selected alternative may enter successor source/release. Alternatives are review artifacts, not retained GLBs or variants unless Derrick explicitly approves more than one independently swappable variant.

## Asset inventory and append-only version flow

Recommended new canonical variant identities preserve old editable sources instead of silently replacing them:

- changed/new: `directional-arrow/rounded-outline-v1`;
- changed/new: `any-note/outlined-circle-v1`;
- changed/new: `guard/outlined-shield-v1`;
- unchanged exact bytes: `bomb/urchin-v1`;
- unchanged exact bytes: `wall/red-glass-v1`;
- unchanged exact bytes: `track/blue-glass-v1`;
- unchanged exact bytes: `athlete-marker/sphere-v1`.

The next asset release is `0.0.8`, never an edit or regeneration of `release/raw/0.0.7` or `review/0.0.7`. The `0.0.8` default set maps the three new variants and retains the other four identities. Runtime release inventory remains one selected GLB and one copied manifest per seven semantic roles, plus one set, inventory, and proof (17 files total). Root `source/` and `manifests/` may retain old and new variants as independently swappable source history; strict release membership follows the selected set.

Required flow:

1. Before generation, hash and Git-tree verify all immutable raw/review `0.0.1–0.0.7` trees.
2. Add new source directories/manifests and successor-aware tooling. Do not rewrite old source variant directories.
3. Generate into absent temporary paths first. Existing target rejection is mandatory.
4. Produce temporary A/B/C review-only renders; Derrick selects one silhouette.
5. Generate absent `release/raw/0.0.8` and `review/0.0.8` exactly once from the selected source.
6. Validate topology, winding, normals, dimensions, material roles, immutable predecessors, exact four-role byte identity, review hashes, and no external dependencies.
7. Run clean Blender source/GLB smoke operations through `tools/subprocess_contract.py` and two independent temporary byte-reproduction builds.
8. Finalize append-only `0.0.8`; capture creator commit and full creator tree, raw subtree, inventory/proof/set hashes, every GLB byte/hash, and generator/tool identities.
9. Independent asset QA/audit verifies local/origin equality and creator-object truth. Derrick reviews real Blender renders before renderer integration.
10. Renderer copies only the selected immutable 17-file payload, pins creator commit/full tree and raw tree, requires current asset HEAD to descend from creator, and verifies current raw tree/hash equality. Never require mutable asset HEAD to equal creator commit.
11. Renderer QA then assembly QA/audit precede any separately authorized immutable web successor. No tag, GitHub Release, npm publication, serving change, or physical PASS is implied.

Creator provenance in every changed manifest/proof must state: `AeroBeat / Gambit Games`; locally authored deterministic procedural primitives; Blender exactly `4.0.2`; generator identity and SHA-256; no network; no external assets; no images/textures/fonts; no third-party content; CC-BY-NC-4.0. The source snapshot remains editable evidence, while generator code is deterministic authority; do not claim deterministic `.blend` container bytes.

## Acceptance renders and QA oracle

### Asset-repository renders

All review images are nonempty RGB PNG, exactly `1600 × 900`, Blender `4.0.2` EEVEE, fixed deterministic lighting, recorded camera transform/lens, computed projected bounds, and SHA-256.

Required changed-cue evidence:

- one labeled A/B/C silhouette board on dark neutral before selection;
- selected-candidate front matrices from camera directions `+Z` and `−Z`, plus side `+X` and three-quarter `(0.45,0.30,+1)` / `(0.45,0.30,−1)`;
- each direction on dark `#08111f`, bright ice-equivalent `(0.72,0.88,0.96)`, and saturated blue `(0.03,0.24,0.52)` fields;
- wireframe/material-ID board proving outer-charcoal → white → inner-charcoal → fill order on both caps and bevel/side allocation;
- shared gameplay-context board containing arrow in two directions, any-note, exactly two byte-identical/unmirrored guards, bomb, wall, track, and three markers without clipping;
- orthographic projected silhouette overlay comparing `0.0.7` and selected successor at the same bounds.

Every object keeps at least `12%` image margin in individual views. Pixel analysis must prove a contiguous white band around `≥98%` of each front/rear silhouette after excluding only the deliberately charcoal outer keyline, and zero white-band gaps longer than 2 pixels at 1600×900.

### Renderer actual-pixel matrix

Use the canonical fixed camera `(0.05,1,5)`, Euler `(0,0,0)`, FOV `48`, near `0.1`, far `80`; test Flow, Boxing Lanes, and Boxing Grid in direct and real cross-origin iframe presentation.

Viewport/requested DPR matrix:

- desktop `1280×720` at DPR `1` and `2`;
- portrait `390×844` at DPR `1` and requested `3` (renderer cap truthfully reports applied `2`);
- landscape `844×390` at DPR `1` and requested `3` (applied `2`).

Place each changed cue at projected apparent heights `18/24/28/32/36` CSS px and at near-success, mid-approach, and far-approach Z. Include up/right/down/left and all four diagonals for arrows. Acceptance:

- direction classifier from silhouette remains correct for all eight arrows at `24 CSS px` and above; human QA has zero ambiguous directions at `18 CSS px`;
- white stroke has contiguous median normal thickness `≥1.0 CSS px` at 18 and `≥1.5 CSS px` at 24–36, with at least one fully covered physical pixel after applied DPR;
- white/charcoal boundaries remain present on dark, bright, blue-track, and representative photosphere/live-video frames;
- no flicker, moiré-like alternating cap ownership, missing rear face, alpha fringe, z-fighting, WebGL warning, or camera-dependent band disappearance across a 120-frame approach capture;
- outline/charcoal pixel hashes are invariant when note fill cycles through black, white, saturated red, saturated blue, and fallback colors;
- only arrow/any-note fill changes under song palette; guard/bomb/wall/track do not change; both guard instances remain pixel-equivalent after X-reflection of placement only;
- success whitening changes note fill only and leaves the stroke intact;
- depth occlusion against other opaque targets remains physical; transparent track/wall ordering remains unchanged;
- fallback primitive remains truthful if successor loading fails, but fallback is not acceptance for canonical appearance.

### Physical gate

Derrick reviews the exact independently audited immutable web successor on target desktop/mobile secure contexts. Required explicit outcomes: roundedness preference, eight-direction readability, circle/guard stroke parity, bright-background visibility, no flicker, and acceptable near/far scale. Record PASS or exact revision requests; silence is not approval.

## Fallback

If Alternative B fails the physical gate:

1. do not mutate `0.0.8` if finalized;
2. record the exact failing camera/background/size and preserve its evidence;
3. choose A or C, or adjust only the failed radius/stroke parameter within a newly approved spec;
4. create a new variant identity and append-only asset release `0.0.9` (or next unused version);
5. repeat creator provenance, reproducibility, QA/audit, renderer pin, assembly audit, and physical review.

If explicit material-role metadata is unavailable or malformed, renderer loading must fail closed to its existing explicit primitive fallback. It must not guess tintability from material names for the successor.

## Recommended implementation order

1. Asset coder: successor-aware generator/validator plus temporary A/B/C reviews; no release until Derrick chooses.
2. Asset QA/auditor: topology, winding, two-sided stroke, dimensions, immutability, provenance, and review matrix.
3. Derrick asset gate: select alternative.
4. Asset coder: append-only `0.0.8`, exact reproduction and provenance; independent QA/audit.
5. Renderer coder: explicit material-role validation/tint targeting and immutable successor pin; no other visual/runtime feature.
6. Renderer QA: actual-pixel matrix and adversarial material-role rejection.
7. Assembly QA/audit: modes, iframe, song-color lane join with `2ey`, and immutable predecessor guards.
8. Separately authorized web successor build/audit/serve, then Derrick physical gate.

## Debugging Record

```text
Problem: Raw 0.0.41 gameplay cues are too angular and circle/guard lack arrow-equivalent white stroke in physical presentation.
Observed symptom: Derrick rejects sharp arrow edges and requests matching white strokes on guards and any-direction circles.
Root cause: Zero-radius polygon silhouettes plus circle/guard single-sided -Z rings viewed from the runtime +Z camera; legacy rear caps also overlap coplanarly.
Evidence: Generator anchor loops and legacy rimmed_plate; manifests declare arrow both faces but circle/guard -Z only; measured GLB cap/material planes; renderer fixed +Z camera and name-inferred tint path.
Failed approaches: Earlier explicit rings fixed review-facing fronts only; bidirectional/no-overlap validation was generalized to arrow, not circle/guard; 0.0.7 changed marker only.
Corrective action: Original tangent-filleted silhouettes and one opaque two-manifold, two-sided, partitioned charcoal/white/charcoal/fill exterior surface; explicit material roles.
Verification test: Cardinal/oblique asset renders plus direct/iframe actual-pixel size/DPR/background matrix, topology/winding checks, tint-invariance tests, and Derrick physical review.
Related files/components: asset tools/generate.py, tools/validate.py, raw/review 0.0.7 cue GLBs/manifests, renderer gameplay-assets.js, sync-gameplay-assets.js, renderer-facade.js.
Remaining uncertainty: Derrick's preferred A/B/C softness and exact target-device apparent cue sizes require render and physical selection.
```
