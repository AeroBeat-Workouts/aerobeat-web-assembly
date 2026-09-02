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
| Shared shield | `0.72 × 0.82 × 0.16` | center of rear grip plane `[0,0,0.07]` | Convex crest shield, top shoulders at +Y and point at −Y; front faces **−Z** | Satin role-color face, darker bevel, white perimeter rim; left/right differ by material only | Opaque; depth test/write on; outline depth test on/write off | ≤ `520` triangles; ≤ `256²` maps | AABB `[-0.39,0.39] × [-0.44,0.44] × [-0.10,0.10]` relative to geometry center | **Exactly one shared shield mesh** reused identically for left and right hands; no mirrored or duplicated geometry | Both hand roles remain recognizable using only role color; crest is neutral (no handed emblem); one canonical identity is recorded |
| Full interval wall | Base cross-section `1.80 × 1.90`; variable Z length `L = max(0.08, speedWorldUnitsPerMs × (endTimestampMs − centerTimestampMs))` | interval center `[0,0,0]` after placement | Beveled rectangular volume extends `L/2` along ±Z; travel-facing front is **−Z** | Red glass body, alpha `0.24`; red emissive edge cage alpha `0.82`; no white note outline | Body depth test on/write off; edge cage depth test/write on; render opaque gameplay first, then wall body back-to-front, then edges; no alpha discard | Unit-source box ≤ `48` triangles plus edge cage ≤ `96`; no textures | AABB `[-0.94,0.94] × [-0.99,0.99] × [-(L/2+0.04), L/2+0.04]` | One unit wall scaled only from authoritative full interval; never substitute a short slab | Review shows front, side, and complete length simultaneously; objects remain legible through body; wall begins/ends exactly at authoritative interval endpoints |
| Spiny bomb | `0.78 × 0.78 × 0.78` tip-to-tip; core diameter `0.44`; 14–18 conical spines | core center `[0,0,0]` | Black sea-urchin silhouette with nonuniform evenly distributed sharp cones; one forward-biased spine points generally **−Z** | Near-black rough core (`0.12` value, roughness `0.46`), charcoal spines, red emissive root ring and silhouette halo | Opaque core/spines depth test/write on; red halo additive, depth test on/write off; halo never reveals occluded back spines | ≤ `900` triangles; ≤ `256²` emissive/base map | Bounding sphere radius `0.42`; AABB `[-0.42,0.42]³` | One bomb mesh for all bomb events | Reads as hazardous from silhouette alone; sharp tips do not enter adjacent cells; red cue is visible without washing black core gray |
| Glass track | `4.20 × 0.06 × 24.00` review/runtime seed dimensions; may extend Z by segment reuse | top-surface center `[0,0.03,0]` with placement below gameplay at world Y chosen by renderer | Thin slab runs along local **−Z** approach direction; beveled long edges | Ice-blue glass alpha `0.20`, roughness `0.16`, subtle cyan edge emissive; sparse analytic lane lines, no environment image | Body depth test on/write off; lane/edge lines depth test/write on; render after opaque events but before translucent walls; stable back-to-front ordering by renderer | ≤ `160` triangles per canonical segment; ≤ `512²` optional repeatable mask | AABB `[-2.14,2.14] × [-0.04,0.08] × [-12.04,12.04]` | One canonical segment; extend by deterministic segment reuse, never stretch lane-line width | Perspective is immediately legible, surface remains below athlete/events, background shows through, and edge/lane cues do not obscure timing floor |

## Layering and visibility contract

1. Render opaque notes, shield, bomb core/spines, timing floor, and other opaque gameplay with normal depth writes.
2. Render the glass-track body with depth test on and depth writes off; render its lane/edge accents with depth writes on only where the renderer can guarantee no intersection with gameplay.
3. Sort translucent wall bodies by camera-space depth, far to near, with depth writes off. Render their edge cages after each body with depth test on.
4. Render white note/shield silhouettes last among their own opaque group using a bounded shell/screen-space technique. Do not use blended coplanar decals.
5. Render the bomb's red halo additively with depth test on so rear spines and glow remain occluded.
6. Transparency must not change semantic timing, placement, or event visibility. The wall's visible Z extent is always the complete authoritative interval.

## Poly and texture aggregate budget

A representative visible set of 24 notes, 2 shields, 2 bombs, 3 walls, and 1 track segment must remain below `18,000` source triangles before renderer instancing. Canonical geometry is instanced by role. Optional authored texture storage for all six roles combined is capped at `2 MiB` uncompressed source pixels and `1 MiB` packaged GPU-ready payload in a future approved task. Task 1 supplies no runtime textures or models.

## Review-board acceptance

- Exactly two labeled `1600 × 900` PNG boards provide neutral and abstract ice-toned gameplay-context views.
- Every board visibly identifies all six roles: directional arrow, any-note circle, one shared shield, full interval wall, spiny bomb, and glass track.
- The gameplay-context board uses only an abstract ice-toned background and does not import an environment or third-party asset.
- White rims remain readable over both dark neutral and pale ice fields; black bomb silhouette and red avoidance cue remain distinct.
- Wall and track translucency communicate depth without hiding notes; the wall visibly spans an interval rather than reading as a thin target.
- Boards are design-review evidence only. They are not model sheets, textures, meshes, GLBs, collision geometry, or runtime assets.

## Rights and provenance

This specification and both review boards are original AeroBeat/Gambit Games visual-development work generated locally from deterministic vector primitives and pseudo-3D shading. They contain no imported models, environment imagery, third-party textures, logos, fonts beyond Pillow's local default rendering, or derivative asset content. The planned owned alien-moon environment is intentionally absent from Task 1 review production.
