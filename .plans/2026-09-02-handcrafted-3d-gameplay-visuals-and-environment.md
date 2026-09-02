# Handcrafted 3D Gameplay Visuals and Environment

**Status:** TASK 1 CODER COMPLETE — specification and review boards authored; QA/audit and Derrick visual approval remain; Tasks 2–6 remain unapproved
**Owning repo:** `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`
**Planning Bead:** `aerobeat-web-assembly-k72`
**Task 1 chain:** coder `aerobeat-web-assembly-k72.1` → QA `aerobeat-web-assembly-k72.2` → audit `aerobeat-web-assembly-k72.3`
**Supersedes:** closed bloq/platform-conversion PoC `aerobeat-web-assembly-zd0`

## Goal

Replace the discarded block/background conversion direction with jointly authored, rights-clean 3D gameplay models, a perspective-defining track, and one locally owned test environment. Preserve PlayCanvas as the single runtime renderer and keep all assets self-contained.

## Approved visual direction to plan

- **Directional note:** DDR-style 3D arrow with a white outline treatment, shared by Flow and Boxing.
- **Any note:** circular 3D note with the same coherent visual language.
- **Guard:** one shield model reused identically for left/right hands in the two nearby cells; role color/material distinguishes side rather than separate geometry.
- **Wall obstacle:** semi-transparent red rectangular volume. In Flow its world-Z length must span the complete authoritative obstacle interval rather than appearing as a short temporary slab.
- **Bomb:** black sea-urchin silhouette—a sphere with sharp cone spines—with red emissive glow/outline signaling avoidance.
- **Track:** semi-transparent blue-tinted glass surface below the athlete and event lanes, extending through the visible approach path so camera perspective and beat travel are immediately legible.
- **Test environment:** use the already-owned local GLB at `/home/derrick/.dsh/projects/aerobeat/aerobeat-environment-community/.testbed/assets/models/alien-moon-icescape/alien-moon-icescape.glb` with its sibling transform config. Do not acquire or redistribute third-party assets.
- **Future environments:** locally owned Gaussian splats remain a later explicitly approved experiment, not part of this first implementation.

## Constraints

- Handcrafted/model-generation work must be reviewed visually by Derrick before runtime integration.
- Use one canonical asset per semantic role where specified; do not duplicate left/right shield geometry.
- White outlines must remain visible against the ice environment and transparent track without breaking depth ordering or alpha.
- Translucent walls and track must retain truthful depth, interval length, and gameplay visibility.
- Preserve role colors, handedness, timing, scoring, event IDs, camera conventions, privacy, and public contracts.
- No Theme runtime, network asset fetch, public release, upload, third-party acquisition, or Gaussian-splat integration in this slice.

## Proposed tasks

### Task 1 — Author visual specifications and review renders

- Define dimensions, pivots, forward axes, materials, outline technique, polygon/texture budgets, and collision-free render bounds for arrow, circle, shield, wall, bomb, and track.
- Produce neutral and in-context review renders before integration.
- Derrick approves silhouettes/materials before Task 2.

**Task 1 results (2026-09-02):**

- Authored `docs/handcrafted-3d-visual-spec-v1.md` with exact role dimensions, pivots, +Y-up/local−Z-forward convention, materials, outline/depth/transparency rules, polygon/texture budgets, collision-free render bounds, reuse constraints, and acceptance criteria.
- Produced exactly two labeled deterministic `1600 × 900` RGB PNG review boards in `.plans/review/2026-09-02-handcrafted-3d-task1/`. Both visibly cover directional arrow, any-note circle, the one shared shield, full interval wall, spiny bomb, and glass track.
- Gameplay context uses only locally drawn abstract ice-toned gradients/polygons; it does not import the owned alien-moon environment or any other environment asset.
- Recorded dimensions, SHA-256 hashes, rights/provenance, non-runtime disclaimer, and review camera in `manifest.json`. The boards are review evidence only and no generator, model, mesh, GLB, texture, or runtime code is retained in the repository.
- Validation passed: both PNGs are nonempty RGB `1600 × 900`, manifest hashes reproduce, directory contains exactly the two PNGs plus manifest, JSON parses, and `git diff --check` passes.
- Coder Bead `aerobeat-web-assembly-k72.1` completed; visual approval remains the gate before Task 2, and Tasks 2–6 remain untouched/unapproved.

### Task 2 — Create canonical self-contained model assets

- Generate or model the arrow, circle, shield, and bomb geometry.
- Author red translucent wall and blue glass track materials.
- Normalize transforms and deterministic source/export files.
- Record provenance and rights ownership for every new asset.

### Task 3 — Add renderer-owned 3D asset contract

- Load canonical local assets through the renderer without introducing runtime network dependencies.
- Map Flow and Boxing directional events to the shared arrow, directionless events to the circle, guard cells to the shared shield, obstacles to interval-sized walls, and bombs to the urchin model.
- Keep fallback behavior explicit and testable during development; remove obsolete production sprite/block paths when landing.

### Task 4 — Correct full-length Flow walls and add the glass track

- Derive wall center and world-Z scale from authoritative `centerTimestampMs → endTimestampMs` interval truth.
- Add a stable blue-glass approach track below the athlete/grid and through the visible timeline depth.
- Validate sorting, clipping, transparency, and perspective at supported viewports/DPRs.

### Task 5 — Integrate alien moon ice test environment

- Import the local GLB and sibling transform config as a self-contained test background.
- Establish camera/environment/track framing without changing gameplay coordinates.
- Keep environment selection and lifecycle teardown deterministic.

### Task 6 — QA, audit, and physical review

- Unit/model tests for semantic mapping, reuse, full obstacle length, transforms, and deterministic manifests.
- Chromium direct/iframe portrait/landscape DPR matrix for depth, alpha, outlines, handedness, and full-length walls.
- Visual evidence for Flow, Boxing Lanes, and Boxing Grid.
- Derrick physical review before immutable successor release work.

## Approval gate

Derrick approved Task 1 only, after the camera-loader successor is ready. Task 1 may specify and render-review the proposed geometry/materials but must not create landing-ready runtime assets or integrate them. Tasks 2–6 require separate approval.
