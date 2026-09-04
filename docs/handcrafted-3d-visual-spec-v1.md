# AeroBeat Handcrafted 3D Visual Specification v1

**Status:** Task 1 visual-review specification; not a runtime asset contract

**Coordinate convention:** right-handed, **+Y up**, **local forward = −Z**

**Review camera:** position `[0.05, 1, 5]`, Euler `[0, 0, 0]`, vertical FOV `48°`

## Shared visual language

All dimensions are in world units. A gameplay cell is `1.00 × 1.00` in X/Y. Geometry is centered on its stated pivot, authored at identity rotation and unit scale, and faces local −Z. Front silhouettes use a bright white geometric rim plus a dark separation rim; the white treatment is never implemented as a translucent coplanar duplicate. Preferred runtime technique for later work is a renderer-owned two-pass shell or screen-space silhouette with depth test on, depth write off for the outline pass, a `0.018–0.030` world-unit equivalent width, and a `2 px` minimum / `5 px` maximum screen clamp. Interior geometry remains depth-tested and normally depth-writing.

Opaque role surfaces use a restrained roughness range (`0.30–0.48`) and no photographic textures. Color is assigned by semantic role at runtime; review colors are illustrative. Emissive accents are additive cues, not bloom-dependent silhouettes. All reusable meshes must fit the listed collision-free render bound at identity and must not cross an adjacent `1.00`-wide cell.

Texture budgets are maxima, not requirements. Flat colors, vertex colors, and analytic material parameters are preferred. If authored maps become necessary in Task 2, each role may use one packed ORM map and one base-color/emissive map at the stated maximum resolution; no normal map unless explicitly approved after silhouette review.

## Canonical role specifications

| Role | Exact dimensions (X × Y × Z) | Pivot | Geometry and local forward | Material / outline | Depth and transparency | Budget | Collision-free render bound | Reuse rule | Acceptance |
|---|---:|---|---|---|---|---|---|---|---|
| Directional arrow | `0.78 × 0.78 × 0.18` | geometric center `[0,0,0]` | Beveled DDR-like arrow plate; arrow tip points **+Y in mesh space** at identity; gameplay direction is rotation about local Z; visible face looks toward **−Z** | Role-colored satin core, roughness `0.38`, white outer rim and charcoal separator | Opaque; depth test/write on; outline depth test on/write off | ≤ `420` triangles; ≤ `256²` maps | AABB `[-0.42,0.42] × [-0.42,0.42] × [-0.11,0.11]` | One mesh for Flow and Boxing; direction only by rotation/material | At 1600×900 review framing, tip, shaft, bevel, and uninterrupted white rim are readable; no adjacent-cell overlap |
| Any-note circle | `0.70 × 0.70 × 0.18` | geometric center `[0,0,0]` | Beveled circular puck with shallow recessed face; visible face looks toward **−Z** | Same role-colored satin core and two-stage rim as arrow | Opaque; depth test/write on; outline depth test on/write off | ≤ `320` triangles; ≤ `256²` maps | AABB `[-0.38,0.38] × [-0.38,0.38] × [-0.11,0.11]` | One directionless mesh across applicable modes | Circular silhouette stays distinct from arrow at approach distance; rim is continuous and center does not read as a hole |
| Shared shield | `0.72 × 0.82 × 0.16` | center of rear grip plane `[0,0,0.07]` | Convex crest shield, top shoulders at +Y and point at −Y; front faces **−Z** | Satin green face, darker bevel, white perimeter rim; the two displayed instances use the same material and icon | Opaque; depth test/write on; outline depth test on/write off | ≤ `520` triangles; ≤ `256²` maps | AABB `[-0.39,0.39] × [-0.44,0.44] × [-0.10,0.10]` relative to geometry center | **Exactly one canonical shield model/icon**, instantiated twice for every guard beat: simultaneous identical instances in both applicable left/right cells or lanes; no mirroring, handed emblem, geometry variant, or one-shield substitution | A guard is accepted only when both identical shields are visibly present at once; instance transforms may place them left/right but may not distinguish their geometry, icon, scale, or material |
| Full interval wall | Exact unit-source dimensions `0.94 × 0.94 × 1.00`; runtime Z length `L = max(0.08, speedWorldUnitsPerMs × (endTimestampMs − centerTimestampMs))` | interval center `[0,0,0]` after placement | Beveled rectangular volume uses unit runtime X/Y scale and interval-authoritative Z scale `L`, extending `L/2` along ±Z; travel-facing front is **−Z** | Red glass body, alpha `0.24`; red emissive edge cage alpha `0.82`; no white note outline | Body depth test on/write off; edge cage depth test/write on; render opaque gameplay first, then wall body back-to-front, then edges; no alpha discard | Unit-source box ≤ `48` triangles plus edge cage ≤ `96`; no textures | Exact source AABB before interval-authoritative Z scaling: `[-0.47,0.47] × [-0.47,0.47] × [-0.5,0.5]`; at unit X/Y runtime scale, adjacent footprints one canonical `1.00` X or Y pitch apart do not overlap and leave exactly `0.06` clear gap | One source wall with runtime scale X/Y exactly `1`; scale only Z from the authoritative full interval and never substitute a short slab | Review shows front, side, and complete length simultaneously; objects remain legible through body; adjacent cells retain the `0.06` X/Y gap; wall begins/ends exactly at authoritative interval endpoints |
| Spiny bomb | `0.78 × 0.78 × 0.78` tip-to-tip; core diameter `0.44`; 14–18 conical spines | core center `[0,0,0]` | Black sea-urchin silhouette with nonuniform evenly distributed sharp cones; one forward-biased spine points generally **−Z** | Near-black rough core (`0.12` value, roughness `0.46`), charcoal spines, red emissive root ring and silhouette halo | Opaque core/spines depth test/write on; red halo additive, depth test on/write off; halo never reveals occluded back spines | ≤ `900` triangles; ≤ `256²` emissive/base map | Bounding sphere radius `0.42`; AABB `[-0.42,0.42]³` | One bomb mesh for all bomb events | Reads as hazardous from silhouette alone; sharp tips do not enter adjacent cells; red cue is visible without washing black core gray |
| Glass track | `4.20 × 0.06 × 24.00` review/runtime seed dimensions; may extend Z by segment reuse | top-surface center `[0,0.03,0]` with placement below gameplay at world Y chosen by renderer | Thin slab runs along local **−Z** approach direction; beveled long edges | Ice-blue glass alpha `0.20`, roughness `0.16`, subtle cyan edge emissive; sparse analytic lane lines, no environment image | Body depth test on/write off; lane/edge lines depth test/write on; render after opaque events but before translucent walls; stable back-to-front ordering by renderer | ≤ `160` triangles per canonical segment; ≤ `512²` optional repeatable mask | AABB `[-2.14,2.14] × [-0.04,0.08] × [-12.04,12.04]` | One canonical segment; extend by deterministic segment reuse, never stretch lane-line width | Perspective is immediately legible, surface remains below athlete/events, background shows through, and edge/lane cues do not obscure timing floor |

## Review-only gameplay-state specification

This section fixes the visual-review proposal only; it does **not** alter judgement thresholds, event timing, score, combo, event IDs, persistence, or any public/runtime contract. All times below are renderer presentation durations measured from existing authoritative timeline/judgement truth and require separate approval before implementation.

### Guard instancing

For every guard beat, acquire the one canonical shield model/icon once and submit **two simultaneous visible instances**: one centered in the applicable left cell/lane and one centered in the applicable right cell/lane at the same authoritative beat Z and Y. Both instances use the exact same geometry, icon, scale, orientation, and material. Their X placement is the only intentional difference. The pair enters, approaches, tints, resolves, and disappears as one event; a single displayed shield is invalid. Review bound: each instance remains inside its own `0.78 × 0.90 × 0.22` AABB, with at least `0.10` world-unit clear space at the center divider.

### Athlete-space sphere markers

The nose, left wrist, and right wrist are full 3D spheres—not discs, billboards, rings, or screen overlays—with diameter `0.18` world units (≤ `192` triangles each; no textures). Their centers are the truthful renderer-projected world positions for the current calibrated nose/left-wrist/right-wrist records; no snapping to cells, shared depth plane, second mirror, or cosmetic offset is allowed. Preserve the existing renderer-owned role colors (review board: nose white, left wrist cyan, right wrist magenta). Spheres depth-test and depth-write normally, so track, notes, hands, and walls occlude them truthfully; no always-on-top pass. Their bound is a radius-`0.10` sphere around each landmark center. Existing confidence/lifecycle clearing behavior remains unchanged.

### Near-athlete timing rows and approaching tint

The three near-athlete grid rows remain visibly colored, in travel order, **red / yellow / green**, with the green row as the success area nearest the athlete. Rows are floor surfaces below events (`0.92` cell depth each, `0.04` gaps, alpha `0.42–0.54`), depth-tested and non-scoring. An unresolved approaching beat retains its role color through red and yellow. On first entering the existing authoritative green success-area bounds, its core color interpolates to white over a review-only `60 ms`, then remains white while inside that area; its original arrow/circle/shield silhouette, bevel, depth, and bounded white/dark rim remain intact. Tinting is material-only: no geometry replacement, scale pulse, threshold shift, or score effect. If the beat leaves the area unresolved, return to its role color over `60 ms`.

### Resolution and world feedback

At the existing authoritative judgement threshold, the resolved beat begins a fast `0.92→0.00` opacity/scale removal over `80 ms` and is absent afterward. At that same threshold time, spawn one camera-facing but world-positioned text instance at the beat's exact crossing X/Z and the beat center's exact world Y; do not move it to HUD space or a generic lane label. `Great` uses a white face with a dark `2 px` equivalent separation shadow. `Miss` uses a red face with a white `2 px` equivalent outline. Both hold for `180 ms`, then fade to zero over `170 ms` (total lifetime `350 ms`), with no travel and no scale pulse. World-text bounds are at most `0.72 × 0.24 × 0.02` world units, clamped to `18–42 px` apparent text height. Depth test is on, depth write is off, and ordinary opaque gameplay may occlude the text; a small `0.01` camera-facing depth bias prevents z-fighting only. At most four feedback labels may coexist; oldest labels expire first. Text must not cover an adjacent lane center or remain long enough to compete with later beats. Obstacles and bombs never emit this feedback.

### Review presentation budget

The added review proposal contributes at most 3 marker spheres (`576` triangles total), one extra shield instance (`520` triangles), and four text quads (`8` triangles) beyond the original representative set. No added textures are required: sphere/row/tint colors are analytic, and future text must use an already renderer-owned bounded glyph atlas rather than a new Task 1 asset. The complete representative view remains below `20,000` source triangles before instancing.

## Layering and visibility contract

1. Render opaque notes, both guard-shield instances, bomb core/spines, 3D athlete spheres, timing rows, and other opaque gameplay with normal depth writes.
2. Render the glass-track body with depth test on and depth writes off; render its lane/edge accents with depth writes on only where the renderer can guarantee no intersection with gameplay.
3. Sort translucent wall bodies by camera-space depth, far to near, with depth writes off. Render their edge cages after each body with depth test on.
4. Render bounded note/shield silhouettes last among their own opaque group using a shell/screen-space technique. The success-area white core tint must preserve that silhouette and its dark separator. Do not use blended coplanar decals.
5. Render the bomb's red halo additively with depth test on so rear spines and glow remain occluded.
6. Render threshold-positioned world feedback depth-tested/write-off after opaque gameplay; it remains occludable and never becomes HUD text.
7. Transparency and review-only transitions must not change semantic timing, placement, scoring, or event visibility. The wall's visible Z extent is always the complete authoritative interval.

## Poly and texture aggregate budget

A representative visible set of 24 notes, 2 simultaneous guard-shield instances, 3 athlete spheres, 2 bombs, 3 walls, 4 feedback quads, and 1 track segment must remain below `20,000` source triangles before renderer instancing. Canonical geometry is instanced by role. Optional authored texture storage for all six roles combined is capped at `2 MiB` uncompressed source pixels and `1 MiB` packaged GPU-ready payload in a future approved task. Task 1 supplies no runtime textures or models.

## Review-board acceptance

- Exactly two labeled `1600 × 900` PNG boards provide neutral and abstract ice-toned gameplay-context views.
- Every board visibly identifies all six original roles: directional arrow, any-note circle, canonical shared shield, full interval wall, spiny bomb, and glass track.
- Every board also visibly demonstrates two simultaneous identical shield instances, truthful-depth nose/left-wrist/right-wrist spheres, red/yellow/green near-athlete rows, an approaching white-tinted beat with silhouette retained, rapid resolved-beat disappearance, and threshold-height `Great` / outlined `Miss` world text.
- The gameplay-context board uses only an abstract ice-toned background and does not import an environment or third-party asset.
- White rims remain readable over both dark neutral and pale ice fields; black bomb silhouette and red avoidance cue remain distinct.
- Wall and track translucency communicate depth without hiding notes; the wall visibly spans an interval rather than reading as a thin target.
- Boards are design-review evidence only. They are not model sheets, textures, meshes, GLBs, collision geometry, environment assets, or runtime inputs; all illustrated durations and transitions remain non-scoring review proposals.

## Rights and provenance

This specification and both review boards are original AeroBeat/Gambit Games visual-development work generated locally from deterministic vector primitives and pseudo-3D shading. They contain no imported models, environment imagery, third-party textures, logos, fonts beyond Pillow's local default rendering, or derivative asset content. The later selected AeroBeat-controlled ice-cave photosphere is intentionally absent from Task 1 review production.
