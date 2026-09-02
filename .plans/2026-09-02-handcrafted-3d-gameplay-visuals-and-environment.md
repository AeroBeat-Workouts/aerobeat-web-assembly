# Handcrafted 3D Gameplay Visuals and Environment

**Status:** TASK 1 COMPLETE AND DERRICK-APPROVED — STOPPED AT GATE; Tasks 2–6 remain unapproved
**Owning repo:** `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`
**Planning Bead:** `aerobeat-web-assembly-k72`
**Initial Task 1 chain:** coder `aerobeat-web-assembly-k72.1` → QA `aerobeat-web-assembly-k72.2` → audit `aerobeat-web-assembly-k72.3`
**Task 1 revision chain:** coder `aerobeat-web-assembly-k72.4` → QA `aerobeat-web-assembly-k72.5` → audit `aerobeat-web-assembly-k72.6`
**Supersedes:** closed bloq/platform-conversion PoC `aerobeat-web-assembly-zd0`

## Goal

Replace the discarded block/background conversion direction with jointly authored, rights-clean 3D gameplay models, a perspective-defining track, and one locally owned test environment. Preserve PlayCanvas as the single runtime renderer and keep all assets self-contained.

## Approved visual direction to plan

- **Directional note:** DDR-style 3D arrow with a white outline treatment, shared by Flow and Boxing.
- **Any note:** circular 3D note with the same coherent visual language.
- **Guard:** one canonical shield model/icon reused identically for both hands. A guard beat displays two simultaneous instances—one in each applicable left/right grid cell or lane—so both hands see the same shield at once. “Shared” means shared geometry/icon identity, not a single displayed instance; do not distinguish the two shields with separate geometry.
- **Athlete markers:** replace flat 2D-looking nose and wrist circles with full 3D spheres placed at the truthful nose/wrist world positions. Preserve existing role colors and occlusion/depth behavior.
- **Timing rows and beat tint:** keep the near-athlete grid rows colored red/yellow/green. As an approaching beat enters the success area, tint its 3D model white to communicate timing without replacing its silhouette.
- **Hit/miss feedback:** on threshold resolution, remove the beat quickly and spawn short-lived world-space text at the beat’s crossing position and height. Successful hits show `Great` in white; misses show `Miss` in red with a white outline. Feedback must remain only briefly and must not distract or obscure later beats.
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

**Task 1 independent QA (2026-09-02) — PASS:**

- Verified exact coder commit `b149f28`: scope is limited to this plan, Beads metadata, the specification, manifest, and two PNG review boards. No runtime/model/GLB/environment/release file changed, and fetched `origin/main` exactly matched the clean coder commit before QA metadata.
- Confirmed all six roles are specified and visibly labeled/readable on both boards: directional arrow, any-note circle, exactly one shared shield, complete-interval translucent wall, spiny bomb, and glass track. Shared Flow/Boxing arrow reuse, material-only left/right shield reuse, authoritative full-interval wall scaling/endpoints, and deterministic track segment reuse are explicit.
- Confirmed exact right-handed `+Y`-up/local `−Z`-forward convention and review camera position `[0.05, 1, 5]`, Euler `[0, 0, 0]`, vertical FOV `48°`; per-role dimensions, pivots, materials, depth/transparency/outline behavior, budgets, collision-free bounds, and aggregate limits are complete and coherent.
- Independently decoded both boards as nonempty RGB `1600 × 900` PNGs. SHA-256 reproduced exactly: neutral `f5c5f6879ed18bcf007d5f6b4c721ff65d4f55e528db44e93f3189f054ed42ca`; gameplay context `47eade8a7b160b34fdbffb027b71c067db0d1f97f82e51917cde738d2ddfb1da`. The review directory contains exactly those two PNGs and `manifest.json`.
- Visual QA confirms white/dark rims remain legible on neutral and pale ice-toned fields, arrow/circle/shield silhouettes stay distinct, bomb remains black with a separate red hazard cue, track perspective is immediate, and the translucent wall visibly exposes front/side/full Z span without hiding gameplay objects.
- Rights/provenance and non-runtime disclaimers are explicit; the context artwork is abstract and locally authored, with no imported environment or third-party asset. `git diff --check` passed. This QA does **not** grant Derrick's required visual approval and does not authorize or touch Tasks 2–6.
- QA Bead `aerobeat-web-assembly-k72.2` closed PASS; audit Bead `aerobeat-web-assembly-k72.3` and Derrick visual approval remain pending.

**FINAL AUDIT PASS (2026-09-02):**

- Audited exact coder commit `b149f28b52c8989b0378d785c2a9feb13fac0e01` and QA commit `acec27b999dd9bed5a6eec128eca0471f04daf79`; both are committed in order and the pre-audit checkout matched clean `origin/main` at the QA commit.
- Recomputed both nonempty RGB `1600 × 900` PNGs and reproduced manifest SHA-256 exactly: neutral `f5c5f6879ed18bcf007d5f6b4c721ff65d4f55e528db44e93f3189f054ed42ca`; gameplay context `47eade8a7b160b34fdbffb027b71c067db0d1f97f82e51917cde738d2ddfb1da`. The review directory contains exactly those two PNGs plus `manifest.json`.
- Independently inspected both boards and the complete specification/manifest. All six required roles are present and labeled on both boards: directional arrow, any-note circle, one shared shield, full interval wall, spiny bomb, and glass track. Required reuse, dimensions, pivots, axes, material/depth/outline behavior, budgets, bounds, camera, provenance, and non-runtime constraints are explicit.
- Exact committed scope from the Task 1 chain is limited to plan/Beads metadata, the specification, manifest, and two review PNGs. No runtime/model/GLB/environment/release file or Task 2–6 implementation changed; `git diff --check` passed.
- Task 1 is review-ready only. This audit does **not** approve silhouettes/materials on Derrick's behalf and does not authorize Tasks 2–6. Parent Bead `aerobeat-web-assembly-k72` remains open/in progress pending Derrick's separate visual review and approval.

### Task 2 — Create canonical self-contained model assets

- Generate or model the arrow, circle, shield, and bomb geometry.
- Author red translucent wall and blue glass track materials.
- Normalize transforms and deterministic source/export files.
- Record provenance and rights ownership for every new asset.

### Task 3 — Add renderer-owned 3D asset contract

- Load canonical local assets through the renderer without introducing runtime network dependencies.
- Map Flow and Boxing directional events to the shared arrow, directionless events to the circle, each guard event to two simultaneous instances of the one canonical shield in both applicable cells/lanes, obstacles to interval-sized walls, and bombs to the urchin model.
- Replace flat-looking nose/wrist markers with depth-correct 3D spheres; add success-area white beat tint and threshold-positioned short-lived `Great`/`Miss` world feedback without changing timing/scoring truth.
- Keep fallback behavior explicit and testable during development; remove obsolete production sprite/block paths when landing.

### Task 4 — Correct full-length Flow walls and add the glass track

- Derive wall center and world-Z scale from authoritative `centerTimestampMs → endTimestampMs` interval truth.
- Add a stable blue-glass approach track below the athlete/grid and through the visible timeline depth.
- Preserve red/yellow/green near-athlete row bands while ensuring the white success-area beat tint remains distinct from the white-outlined track and environment.
- Validate sorting, clipping, transparency, perspective, 3D athlete-marker occlusion, and short-lived feedback readability at supported viewports/DPRs.

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

Derrick approved Task 1 only, after the camera-loader successor is ready, and on 2026-09-02 requested a Task 1 revision covering simultaneous dual-shield display, 3D nose/wrist spheres, colored timing rows, white success-area beat tint, and short-lived world-space `Great`/`Miss` feedback. Task 1 may specify and render-review these proposed geometry/material/feedback behaviors but must not create landing-ready runtime assets or integrate them. Tasks 2–6 require separate approval.

## Task 1 revision coder result (2026-09-02)

- Revised `docs/handcrafted-3d-visual-spec-v1.md` so every guard beat displays two simultaneous visible identical instances of one canonical shield model/icon in the applicable left/right cells or lanes. The only distinction is placement; geometry, icon, scale, orientation, material, Y, and beat Z remain identical.
- Added review-only, non-scoring specifications for full 3D nose/left-wrist/right-wrist spheres at truthful role-colored world positions; red/yellow/green near-athlete rows; a `60 ms` white success-area core tint that preserves silhouette; `80 ms` resolved-beat removal; and same-height threshold-positioned `Great`/`Miss` world text with `180 ms` hold plus `170 ms` fade (`350 ms` total).
- Fixed depth/occlusion ordering, per-object bounds, coexistence limits, triangle/texture budgets, and explicit exclusions from judgement thresholds, score, combo, timing truth, event IDs, persistence, public contracts, obstacles, and bombs.
- Regenerated the two existing RGB `1600 × 900` review boards. Both retain and label the original six roles while visibly demonstrating dual identical shields, 3D role-colored athlete spheres, red/yellow/green rows, white success tint with silhouette retained, rapid disappearance, and `Great` / white-outlined `Miss` world feedback.
- Updated `manifest.json` revision, fixed review camera/provenance, board coverage, SHA-256 records, and non-runtime disclaimer. Temporary Pillow generators were removed; no generator, model, mesh, GLB, texture, runtime code, environment, or Tasks 2–6 implementation is retained.
- Coder validation passed: exact directory inventory is two PNGs plus one manifest; both PNGs are nonempty RGB `1600 × 900`; JSON parses; hashes reproduce; repository scope and diff checks pass. Bead `aerobeat-web-assembly-k72.4` is complete; `k72.5`, `k72.6`, and parent `k72` remain open for independent QA/audit and Derrick review.

## Task 1 revision independent QA — FAIL (2026-09-02)

- Mechanical scope, image, manifest, and hash checks passed, but native-resolution visual inspection found clipped/overlapping neutral-board A/C headings and white-tint annotation, plus overlapping or duplicated gameplay-context row, dual-shield, world-text, and white-tint labels.
- Root cause is fixed text placement without measured bounds/exclusive annotation zones; coverage-only validation did not detect presentation collisions. Diagnostic `.plans/debug/2026-09-02-task1-review-board-layout.md` records the full analysis.
- Repair Bead `aerobeat-web-assembly-k72.7` blocks reopened QA `k72.5`. Regenerate only the two review PNGs and manifest using measured/wrapped text, unique callouts, and reserved row/footer zones; specification semantics and all runtime/model/environment files remain untouched.

## Task 1 revision independent re-QA — PASS (2026-09-02)

- Re-QA inspected exact repair commit `f6e4ac3283cdfe8f304ec408f8e5e6e72f61f47e`; before QA metadata, fetched `origin/main` exactly matched the clean repair commit. Its scope is limited to the two review PNGs, `manifest.json`, the layout diagnostic result, and Beads metadata. No specification, runtime, model, mesh, GLB, texture, environment, release, or Tasks 2–6 implementation file changed.
- Independently inspected both complete boards at native `1600 × 900`. Every prior defect is gone: neutral A/C headings and the white-core annotation are fully contained; gameplay RED, GREEN / SUCCESS, dual-shield, world-text, and white-success-tint labels are separated; duplicate callouts are removed; headings, labels, callouts, and footer copy are unique, contained, non-overlapping, and readable.
- Both boards retain visible coverage of all six canonical roles: directional arrow, any-note circle, one canonical shared shield model/icon shown as two simultaneous identical instances, full interval wall, spiny bomb, and glass track. They also visibly retain truthful-depth nose/left-wrist/right-wrist spheres, red/yellow/green timing rows, white success-area core tint with silhouette retained, resolved-beat disappearance in `80 ms`, and same-height `Great` / outlined `Miss` world text with `350 ms` total lifetime.
- Cross-checked the complete specification and manifest: right-handed `+Y`-up/local `−Z`-forward coordinates, fixed review camera, dimensions, pivots, materials, bounds, depth/occlusion, budgets, reuse rules, clarified state semantics, rights/provenance, and exact review-only/non-runtime boundary remain explicit and coherent.
- Independently decoded both boards as nonempty RGB PNGs at exactly `1600 × 900`; the review directory contains exactly those two PNGs plus `manifest.json`. Manifest SHA-256 values reproduce exactly: neutral `3aa318ef432a8678dcb87e59b4df81299537b96081d8e3b9695acff9be7b229f`; gameplay context `e8bf7d79b6ed3a5ef66e1f03f1809677cf2c16c735f017553d8ab34960de63ee`. JSON parsing and `git diff --check` passed.
- QA Bead `aerobeat-web-assembly-k72.5` closed PASS. This re-QA does **not** approve visuals for Derrick, does not authorize or touch Tasks 2–6, and leaves `k72.6` plus the parent visual-review/approval gate open.

## Task 1 revision final independent audit — PASS (2026-09-02)

- Audited the required linear chain at exact commits: requirements `8a8b2d575216f72576a490e62344e742a88fe0b7`, revision `ab150be14e6efc8375d8494ab54b9a7eb780e9ca`, diagnosis `41a9e07979b88c6ab2a579c9bdef05faa90fae16`, repair `f6e4ac3283cdfe8f304ec408f8e5e6e72f61f47e`, and re-QA `e94eceea201748261ced321c89d3b3a785d68aa5`. Before audit metadata, fetched `origin/main` exactly matched the clean re-QA commit.
- Independently inspected the complete specification, both native `1600 × 900` boards, revision-3 manifest, layout diagnostic/repair record, revised Bead chain, and cumulative Git scope. Both boards are readable and collision-free and visibly show one canonical shield model/icon as two simultaneous identical instances, truthful-depth nose/left-wrist/right-wrist 3D spheres, red/yellow/green rows, white success-area core tint with silhouette retained, `80 ms` resolved-beat removal, and threshold-positioned same-height `Great` in white plus `Miss` in red with a white outline and `350 ms` total lifetime.
- Confirmed the six canonical roles remain visible and labeled, all headings/callouts/footer copy are unique, contained, non-overlapping, and readable, and the specification/manifest preserve coordinate, camera, dimensions, pivots, material, bounds, depth/occlusion, budget, provenance, and review-only/non-runtime constraints.
- Independently reproduced the exact three-file review inventory, RGB dimensions, JSON parse, and SHA-256 values: neutral `3aa318ef432a8678dcb87e59b4df81299537b96081d8e3b9695acff9be7b229f`; gameplay context `e8bf7d79b6ed3a5ef66e1f03f1809677cf2c16c735f017553d8ab34960de63ee`. Cumulative `git diff --check` passed.
- The audited chain changes only plan/Beads metadata, the Task 1 specification, two PNG review boards, their manifest, and the layout diagnostic. No runtime, model, mesh, GLB, texture, environment, release, or Tasks 2–6 implementation changed.
- Task 1 is revised-review ready only. This audit does **not** approve the visuals for Derrick and does **not** authorize Tasks 2–6. Audit Bead `aerobeat-web-assembly-k72.6` closes PASS; parent `aerobeat-web-assembly-k72` remains open/in progress pending Derrick's visual approval.

## Derrick Task 1 visual approval — PASS (2026-09-02)

- Derrick explicitly approved the revised Task 1 visual direction after reviewing the collision-free neutral and gameplay-context boards.
- Approved scope includes the six canonical 3D role designs, simultaneous identical dual-shield instances, 3D nose/wrist spheres, red/yellow/green timing rows, white success-area beat tint, and short-lived threshold-positioned `Great`/`Miss` feedback exactly as specified.
- This approval completes Task 1 review only. Work remains stopped at the approval gate: Tasks 2–6, runtime integration, model/GLB/environment creation, release work, publication, and external acquisition remain unapproved.
