# Handcrafted 3D Gameplay Visuals and Environment

**Status:** TASKS 2–6 APPROVED — CROSS-REPO EXECUTION IN PROGRESS
**Owning repo:** `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`
**Planning Bead:** `aerobeat-web-assembly-k72`
**Initial Task 1 chain:** coder `aerobeat-web-assembly-k72.1` → QA `aerobeat-web-assembly-k72.2` → audit `aerobeat-web-assembly-k72.3`
**Task 1 revision chain:** coder `aerobeat-web-assembly-k72.4` → QA `aerobeat-web-assembly-k72.5` → audit `aerobeat-web-assembly-k72.6`
**Task 2 asset chain:** coder `aerobeat-web-assembly-k72.8` → QA `aerobeat-web-assembly-k72.9` → audit `aerobeat-web-assembly-k72.10` → Derrick 3D review gate `aerobeat-web-assembly-k72.18`
**Task 3 renderer chain:** coder `aerobeat-web-assembly-k72.11` → QA `aerobeat-web-assembly-k72.12`
**Tasks 4–5 assembly chain:** coder `aerobeat-web-assembly-k72.13` → matrix QA `aerobeat-web-assembly-k72.14` → final audit `aerobeat-web-assembly-k72.15`
**Task 6 release chain:** release `aerobeat-web-assembly-k72.16` → physical gate `aerobeat-web-assembly-k72.17`
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

## Approved future asset ownership and packaging direction

- Keep the canonical gameplay art in its own cross-engine polyrepo named `aerobeat-asset-gameplay`, following the separation used by the Godot asset lane. Use `aerobeat-web-asset-gameplay` only if the payload later gains web-specific assets or contracts.
- Preserve engine-neutral ownership: editable Blender/source files, provenance, export tooling, validation, individual GLBs, and mix-and-match set manifests belong to the asset polyrepo; PlayCanvas/Godot consumers own only engine integration and rendering behavior.
- Keep every swappable semantic role in a separate editable source directory and separate GLB rather than a combined gameplay GLB. Initial roles are directional arrow, any-note circle, guard shield, bomb, normalized wall, track, and shared athlete-marker sphere.
- Name the initial directional-arrow variation `outline-v1`; do not encode the inspiration source in the asset identifier.
- A set manifest selects one versioned variation independently per role so complete sets and arbitrary combinations can coexist. The shield GLB remains one canonical asset instantiated twice for a guard event.
- `Great`/`Miss` remains renderer-owned world text rather than a GLB. Dynamic interval scaling, timing tint, row colors, instancing, outline passes, and scoring/timing behavior remain consumer/runtime responsibilities.
- Future immutable asset releases should preserve separate GLBs, manifests, per-file hashes, coordinate/pivot/bounds metadata, provenance, and export-tool versions. A consuming assembly pins an exact asset release and copies only its selected assets into that assembly's immutable release.
- This section originally approved architecture and naming only; the later explicit execution approval below now authorizes Tasks 2–6 and creation of the public asset polyrepo while preserving all listed ownership boundaries.

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

- If separately approved, create the cross-engine `aerobeat-asset-gameplay` polyrepo; use `aerobeat-web-asset-gameplay` instead only if concrete web-specific payload becomes necessary.
- Generate or model each role as an independently swappable source/export pair: directional arrow variation `outline-v1`, any-note circle, shield, bomb, normalized wall, track, and shared athlete-marker sphere.
- Keep one separate GLB per role/variation and author mix-and-match set manifests; do not combine all gameplay models into one GLB.
- Author red translucent wall and blue glass track materials while leaving runtime scaling, tint, instancing, outline passes, and world text to engine consumers.
- Normalize transforms and deterministic source/export files; record provenance, rights ownership, per-file hashes, bounds, pivots, and coordinate metadata for every asset.

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

Derrick approved Task 1 after the camera-loader successor was ready and approved its revised visual package on 2026-09-02. Derrick then explicitly approved Tasks 2–6 and explicitly authorized creation of the **public** `AeroBeat-Workouts/aerobeat-asset-gameplay` GitHub repository. The asset repository must remain cross-engine; if concrete web-specific payload becomes necessary, use a separately approved `aerobeat-web-asset-gameplay` repo instead. Temporary sudo was offered only if a required local tool installation needs it. This approval does not authorize third-party asset acquisition, Gaussian splats, unrelated feature work, package publication, or GitHub Releases beyond the planned repository/commits.

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
- This approval completed Task 1 review only at that time. The later execution approval below supersedes that stop condition for Tasks 2–6 while third-party acquisition and unrelated publication remain forbidden.

## Derrick Tasks 2–6 execution approval (2026-09-02)

- Derrick explicitly approved the full remaining plan: Task 2 asset creation, Task 3 renderer integration, Tasks 4–5 track/wall/environment integration, and Task 6 QA/audit/release/physical review.
- Derrick explicitly authorized creation of the public GitHub repository `AeroBeat-Workouts/aerobeat-asset-gameplay`. GitHub read-back confirmed it exists with `PUBLIC` visibility at `https://github.com/AeroBeat-Workouts/aerobeat-asset-gameplay`; its local checkout is `/home/derrick/.dsh/projects/aerobeat/aerobeat-asset-gameplay`.
- Execution Bead graph: asset coder `k72.8` → asset QA `k72.9` → asset audit `k72.10` → Derrick 3D asset review `k72.18` → renderer coder `k72.11` → renderer QA `k72.12` → assembly/environment coder `k72.13` → cross-mode matrix QA `k72.14` → final audit `k72.15` → immutable release `k72.16` → Derrick physical gate `k72.17`.
- Local inspection found Blender absent and Ubuntu candidate `4.0.2+dfsg-1ubuntu8`; Derrick explicitly offered temporary sudo for required installation, `sudo -n` succeeded, and managed job `bash-11` installed Blender `4.0.2+dfsg-1ubuntu8` successfully. No third-party art acquisition is authorized.
- Research architect subagent `b26fd796-601f-4120-9477-d134d554fd73` launched and was verified running to recommend the cross-engine source/export/validation pipeline. Asset coder subagent `227815d2-f8d3-49e4-90df-c070d32245c0` then launched and was verified running for `k72.8`. The added Derrick 3D review gate `k72.18` blocks renderer integration `k72.11`, preserving the requirement that real model renders be visually approved before Task 3.
- Owned alien-moon source read-back: GLB SHA-256 `40e38a7bdce9eab4266d8bb19510a95bb4e0410534f3f14a500f36fac2b65077` (`6,149,400` bytes), sibling PNG SHA-256 `7654e9450ddc16ed613bf7c5bbd442c0466d89cad8ea4a59a3d1ff12ef8f513c` (`6,117,570` bytes), and config transform is identity position/rotation/scale. Environment repo is clean at `origin/main`.

## Task 2 candidate asset package (2026-09-02)

- Initial background asset coder produced only the README for multiple observation intervals and was retired together with the nonessential research child. Bounded recovery coder completed the shared checkout; the original coder later independently observed and reported the same completed state, with no conflicting second commit.
- Public `AeroBeat-Workouts/aerobeat-asset-gameplay` is clean on `main == origin/main` at candidate commit `673fc75dec250392b79565dfd186a26261513df4`; GitHub read-back confirms `PUBLIC` visibility and default branch `main`.
- Candidate contains seven independent editable `.blend` / GLB / manifest identities: `directional-arrow/outline-v1`, `any-note/circle-v1`, `guard/shield-v1`, `bomb/urchin-v1`, `wall/red-glass-v1`, `track/blue-glass-v1`, and `athlete-marker/sphere-v1`; no combined GLB, texture, font, external asset, or engine runtime/import metadata exists.
- Immutable asset release `release/raw/0.0.1` contains exactly 17 files. Inventory SHA-256 is `2f448b2efe8a9cb53f32580b94272ab2b08e3d3ba5474ee12bed9a4c8f5aec57`; proof SHA-256 is `6bd6eb5f83cdd4646d22ad1b1de5b6786901eb8a5bd321728f015e2e5dbd7c57`. Two temporary rebuilds reproduced all 17 release bytes exactly. Editable `.blend` container bytes are truthfully excluded from determinism claims; `tools/generate.py` is source authority.
- Nine actual Blender EEVEE RGB `1600 × 900` review renders exist under `review/0.0.1/`. Parent read-back inspected the neutral, gameplay-context, arrow, shield, and bomb renders and separately reran `python3 tools/validate.py --root . --release 0.0.1`, which passed seven asset bounds/budgets, release inventory/hashes/provenance/dependencies/review hashes, and clean Blender imports.
- Candidate Bead `k72.8` remains in progress pending strict independent visual/mechanical QA `k72.9`; no Derrick approval or renderer integration is implied.

## Task 2 independent visual QA — FAIL (2026-09-02)

- QA mechanically reproduced strict validation, seven clean Blender source opens, all 17 release files byte-identical across two temporary builds, and the absence of external URIs/textures/fonts/engine metadata/third-party dependencies.
- Native render inspection failed the approved visual contract: arrow, shield, and any-note use predominantly black perimeter silhouettes with white reading only as detached/top highlights; the neutral board is unlabeled and crops wall/arrow/track; the context omits the arrow and all three marker spheres; the individual wall is cropped and track is too narrow/small for useful review.
- Root cause: `tools/generate.py` used nested complete solids with tiny depth offsets rather than explicit front-facing white ring geometry, and hard-coded cameras/placements without projected-bounds fitting. Full diagnosis is in asset-repo `.plans/debug/2026-09-02-initial-asset-visual-qa.md` at commit `2a82327`.
- Finalized `release/raw/0.0.1` must remain byte-immutable. Repair Bead `k72.19` blocks `k72.9` and must create successor `0.0.2` with explicit white rings, bounds-fitted/labeled complete reviews, and projected containment/role-count validation. `k72.8` and `k72.9` remain open/in progress.

## Task 2 visual repair and independent re-QA — PASS (2026-09-02)

- Repair commit `85e55eb50b1fb5f0aa27baa1dc99e8bae602a56d` created immutable successor asset release `0.0.2`; `0.0.1` release/review bytes remain unchanged from diagnostic baseline `2a82327`.
- Arrow/circle/shield now use explicit continuous white front perimeter geometry with charcoal separation and role-color inset. The labeled neutral board contains all seven complete assets; context contains arrow, circle, exactly two canonical shield instances, bomb, scaled wall, track, and three marker spheres; individual wall/track reviews are complete and useful.
- `0.0.2` contains exactly 17 release files. Inventory SHA-256 `1a5b66f543bae940b8bb789e9ab9979d073663b5f6ff12382e08f4ad10c0ff1b`; proof SHA-256 `90dcbe52b35d2ec11a01784a96f195b5cd01ac141000886cb950c74864eec288`.
- Parent and independent re-QA visually inspected all nine RGB `1600 × 900` renders. Re-QA verified local/origin/public Git equality, strict validation, seven source opens and clean GLB imports, exact bounds/pivots/names/budgets/dependencies, absent external URIs/textures/fonts/engine metadata, Python compilation, and two complete reproducibility passes. Generator rejects missing release, finalized `0.0.1`, and unsupported `0.0.3`.
- Repair `k72.19` and QA `k72.9` closed PASS. Asset implementation `k72.8` remains in progress for final asset audit `k72.10`; Derrick 3D approval gate remains pending.

## Task 2 license audit repair and re-QA — PASS (2026-09-02)

- Final audit found that `LICENSE.md` inherited a noncanonical self-defeating CC BY-NC clause from `aerobeat-template-asset`; asset manifest-label validation could not detect the legal-text corruption. Audit created blocker `k72.20` and left `k72.8`/`k72.10` open.
- Debug record `.plans/debug/2026-09-02-license-text-integrity.md` was committed in asset repo at `345f05c`. A separate nonblocking template-lane issue `aerobeat-template-asset` Bead `oc-n2m` tracks the same inherited clause across eight discovered AeroBeat asset/template/environment repos.
- Repair commit `0ed97676a0a816b797b12b9f8d19a9d281b9da03` replaced the file with exact official CC BY-NC 4.0 plain text: SHA-256 `41003d4a74749c0220e33dd415042164b5a1093ed401f36277234f772d22d3d0`, `19,347` bytes, `408` lines. Validation now pins that identity and rejects a one-bit mutation with `license integrity mismatch`.
- Independent re-QA matched official/local/public bytes, reproduced mutation rejection, strict validation, seven source/GLB imports, and release reproducibility. All 70 protected source/manifest/set/release/review files remained byte-identical to pre-license-fix commit `85e55eb`; only `LICENSE.md`, `tools/validate.py`, and `tools/reproducibility.py` changed.
- License repair `k72.20` closed PASS. Final asset audit `k72.10` remains in progress; no Derrick model approval or runtime integration is implied.

## Task 2 final independent asset audit — PASS (2026-09-02)

- Audited the complete public asset-repository chain in exact linear order: initial package `673fc75dec250392b79565dfd186a26261513df4`, visual diagnosis `2a823272e4626ba4ff97b159faeaefc946a7d1d1`, corrected successor `85e55eb50b1fb5f0aa27baa1dc99e8bae602a56d`, license diagnosis `345f05ccb30086bd43204be426a22ac1dc7eaffe`, and license repair `0ed97676a0a816b797b12b9f8d19a9d281b9da03`. GitHub and Git independently resolve public, non-archived `AeroBeat-Workouts/aerobeat-asset-gameplay`, default branch `main`, with local `main == origin/main ==` public `main` at `0ed97676`; the repository has no GitHub Releases.
- Confirmed the exact seven independently swappable identities: `directional-arrow/outline-v1`, `any-note/circle-v1`, `guard/shield-v1`, `bomb/urchin-v1`, `wall/red-glass-v1`, `track/blue-glass-v1`, and `athlete-marker/sphere-v1`. Each has one separate editable `.blend`, root manifest, release manifest, and separate GLB; every GLB contains exactly one identity node and one mesh. `sets/default-v1.json` maps every role independently and requires two instances of the one canonical `guard/shield-v1`; there is no combined GLB.
- Reproduced strict `0.0.2` validation under exact Blender `4.0.2`: schemas, identities, hashes/byte sizes, canonical names, dimensions, measured AABBs, pivots, identity transforms, collision-free bounds, triangle budgets, coordinates, analytic materials, rights/provenance, set constraints, inventories, review hashes/layout, dependency policy, and all seven clean GLB smoke imports passed. Separately factory-opened all seven tracked `.blend` sources and asserted one identity mesh, identity transforms, analytic materials, and no images, fonts, libraries, cameras, or actions. Python compilation and the reviewed whitespace check passed.
- Independently reran reproducibility: primary plus two fresh temporary builds matched all 17 immutable `0.0.2` release files byte-for-byte. Generator negative guards reject omitted `--release`, finalized `0.0.1`, and unsupported `0.0.3`. Both releases contain exactly 17 files: seven GLBs, seven manifests, one set, inventory, and proof only. Original `0.0.1` release/review trees are byte-unchanged from `673fc75`; inventory/proof SHA-256 remain `2f448b2efe8a9cb53f32580b94272ab2b08e3d3ba5474ee12bed9a4c8f5aec57` / `6bd6eb5f83cdd4646d22ad1b1de5b6786901eb8a5bd321728f015e2e5dbd7c57`. Corrected `0.0.2` inventory/proof SHA-256 reproduce as `1a5b66f543bae940b8bb789e9ab9979d073663b5f6ff12382e08f4ad10c0ff1b` / `90dcbe52b35d2ec11a01784a96f195b5cd01ac141000886cb950c74864eec288`. Both release trees remain finalized read-only.
- Natively inspected all nine RGB `1600 × 900` `review/0.0.2` PNGs. Arrow, circle, and shield have continuous visible white front perimeters with charcoal separation; bomb, marker, translucent wall, and full-depth track are complete and readable. The labeled neutral board contains all seven roles without clipping. The context frame visibly contains one arrow, one circle, exactly two identical canonical shields, one bomb, one scaled full-interval wall, one track, and three distinct marker spheres. Recorded hashes and calculated containment/count evidence reproduce. This confirms the visual repair and justifies closure of `k72.19`.
- Fetched the official Creative Commons BY-NC 4.0 plain text and public raw `LICENSE.md` independently. Official, local, and public bytes are identical at exactly `19,347` bytes / `408` lines / SHA-256 `41003d4a74749c0220e33dd415042164b5a1093ed401f36277234f772d22d3d0`. A fresh same-size one-bit mutation failed closed with nonzero status and `license integrity mismatch`. From `85e55eb` to `0ed9767`, `source/`, `manifests/`, `sets/`, `release/`, and `review/` retain identical Git tree IDs; only `LICENSE.md`, `tools/validate.py`, and `tools/reproducibility.py` change in the repair commit. This confirms the rights/provenance repair and justifies closures of `k72.20` and the full-package QA gate `k72.9`.
- Repository scope is cross-engine and self-contained: tracked inventory has no package manifest, JavaScript/TypeScript, engine runtime/integration/import metadata, textures, external images, font files, external GLB URIs, compression dependencies, downloaded or third-party assets. Manifest provenance consistently records locally authored deterministic procedural primitives, no network, no external assets, and no third-party content. No GitHub Release or npm package/publication exists.
- Final disposition: Task 2 implementation `k72.8` and final audit `k72.10` close PASS. Separate template issue `oc-n2m` is nonblocking here because this gameplay repository's official license bytes are repaired and mutation-guarded. Derrick-only model review gate `k72.18` remains open, and renderer integration `k72.11` remains blocked by that gate. This audit does not approve the models for Derrick and does not start integration.

## Derrick Task 2 canonical 3D asset approval — PASS (2026-09-02)

- Derrick reviewed the linked actual Blender-rendered `0.0.2` neutral board, gameplay context, and individual asset directory, then explicitly selected **Approve 3D assets**.
- Immutable cross-engine asset release `0.0.2` is therefore approved as the pinned source for Tasks 3–5. Approval covers the seven separate role assets and their current silhouettes/materials; it does not waive renderer/assembly QA, final audit, immutable web release proof, or physical review.
- Gate `k72.18` closes PASS and renderer implementation `k72.11` becomes eligible to start.

## Task 3 renderer implementation candidate (2026-09-03)

- Initial broad renderer child claimed `k72.11` but produced no files across bounded observation, so it was retired. The task was decomposed into loader `k72.11.1` and visual behavior `k72.11.2` to reduce execution risk.
- Loader commit `0a9e9a5a790f79567f5ec9d0738c3475f7a881a3` copied/verifies the exact approved 17-file asset release `0.0.2`, packages only runtime assets, and added generation/abort/context-safe PlayCanvas container preload with explicit fallback diagnostics. Parent independently reran `npm test` and full `npm run test:browser`; both passed. `k72.11.1` closed PASS.
- Visual commit `8e67860ecb33f288ac1e4b25507f0fe0acf6583f` instantiates canonical GLBs for arrows/circles/bombs/full-Z walls/track, identical two-instance guard pairs, and truthful marker spheres; preserves red/yellow/green rows; implements white success tint, exact `80 ms` removal, and bounded stationary `Great`/`Miss` feedback (`180 + 170 = 350 ms`). It removes normal-path legacy target blocks/icons while retaining only explicit loader/context fallback.
- Coder validation passed unit/browser matrices, direct/real-iframe portrait/landscape DPR1/3, GLB parsing/material cloning, fallback/context/reconnect/destroy, no RAF/console noise, exact 37-file npm pack containing the 17 pinned asset files, and no source/review/old-release/tool payload. Candidate renderer is clean at `main == origin/main`; `k72.11.2` closed and parent `k72.11` remains open for independent QA `k72.12`.
- Current assembly still intentionally omits bomb/arc/burst projection; that consumer mapping remains in approved assembly Task `k72.13` rather than being invented inside renderer semantics.

## Task 3 renderer loader slice (2026-09-02)

- Initial renderer coder `88a60316-4dca-41cb-80b1-d267fc2cbcb2` claimed `k72.11` but produced no observable file/test activity over the bounded startup window and was retired cleanly. The parent task was decomposed into loader `k72.11.1` → visual behavior `k72.11.2`.
- Recovery loader commit `0a9e9a5a790f79567f5ec9d0738c3475f7a881a3` copies and verifies the exact 17-file approved asset release under renderer `assets/gameplay/0.0.2`, exposes immutable identities/package-relative URLs, and preloads all seven local GLB containers with byte/hash verification, abort/stale-generation rejection, context-loss fallback/reload, independent renderer ownership, and deterministic disposal.
- Packaging includes only renderer source/docs and the 17 runtime asset files; `.blend`, review, old `0.0.1`, and asset tools are excluded. PlayCanvas 2.21.4 successfully parsed all seven containers and synthesizes omitted GLB normals.
- Parent independently reran `npm test` and `npm run test:browser`; asset sync/identity/hash/lifecycle/pack checks and the existing Chromium direct/iframe portrait/landscape DPR matrix passed. Loader Bead `k72.11.1` closed; parent `k72.11` and visual behavior `k72.11.2` remain in progress/open.

## Task 3 independent renderer QA — PASS (2026-09-03)

- Independently audited the exact clean renderer chain `0a9e9a5a790f79567f5ec9d0738c3475f7a881a3` → `8e67860ecb33f288ac1e4b25507f0fe0acf6583f`; fetched local `main`, `origin/main`, and `HEAD` all matched `8e67860` before and after QA. Reviewed renderer README, accepted decisions, complete source, loader/visual diffs, and unit/browser validation code. QA made no renderer, assembly-runtime, environment, or asset-source edit.
- Reproduced the exact approved immutable gameplay payload: 17 packaged `0.0.2` files, seven separate GLBs, source commit `0ed97676a0a816b797b12b9f8d19a9d281b9da03`, inventory SHA-256 `1a5b66f543bae940b8bb789e9ab9979d073663b5f6ff12382e08f4ad10c0ff1b`, proof SHA-256 `90dcbe52b35d2ec11a01784a96f195b5cd01ac141000886cb950c74864eec288`, and all seven exact GLB SHA-256/byte identities. `npm test` passed the full type/JSDoc/import/component/console, sync/hash/inventory, loader stale/error/context/disposal/independence, camera, semantic mapping, hostile bounds, timing, and cap suite.
- Full `npm run test:browser` passed. Actual PlayCanvas 2.21.4 container resources parsed for all seven GLBs in two independent applications; normal ready rendering instantiated canonical roots with per-instance cloned materials while canonical source materials remained unchanged. Loading rendered no target substitute, and primitive target/marker fallback appeared only after explicit preload error or context-loss state. Context restore created a fresh generation; stale/aborted work could not commit. Detach/reconnect, idempotent destroy, independent multi-instance resources, pointer/camera cleanup, and atlas/container/material/texture/entity release all passed with zero engine RAF and no unexpected console, page, or WebGL noise.
- Actual render entities and pixels confirmed Flow and Boxing Grid/Lanes directional arrow versus directionless circle roles, bomb support, and exactly two independently instantiated but byte-equivalent non-mirrored shield roots per guard. Shield geometry/source, scale, orientation, material appearance, Y, and Z matched; X was the only placement difference. Three canonical marker spheres occupied distinct truthful projected world coordinates with normal depth testing/writes and retained nose/left-wrist/right-wrist role colors. Existing camera and right-handed `+Y`/future `−Z` projection remained unchanged.
- Verified red/yellow/green timing rows; core-only 60 ms white success tint with structural white/charcoal rim materials preserved; exact 80 ms resolved-target removal at crossing Z; stationary same-height world feedback at exact crossing coordinates; `Great` white face/dark separation and `Miss` red face/white separation glyph pixels; 180 ms hold plus 170 ms fade with exact 350 ms absence; newest-four cap; and obstacle/bomb exclusions. Diagnostics expose only bounded aggregates and timings, not target IDs, judgement labels, score, pixels, or media.
- Verified normalized Flow walls preserve authoritative interval center and complete Z length with X/Y scale exactly `1`; three canonical glass-track roots remain unscaled at centers `−12/−36/−60`, covering Z `0…−72` without stretching lane lines. Opaque assets/markers depth-write; deterministic ordering is opaque assets → timing/grid surfaces → track body/edges → wall body/edges → depth-tested/write-off world feedback, with authored transparent bodies and edge cages preserved.
- Independently captured and read eight fresh actual-pixel renders across direct and real cross-origin iframe embedding, portrait `390×844` and landscape `844×390`, requested DPR `1` and `3` (renderer cap applied DPR `2`). Every case reported ready seven-asset generation, zero fallback instances, two shield instances, three marker spheres, three track segments, one full wall, two feedback glyphs, non-background pixels, and no console/page noise; direct and iframe pixels were visually equivalent. This is renderer QA evidence only, not Derrick physical review.
- `npm pack --dry-run --json` passed with exactly 37 files, 62,267 packed bytes / 207,790 unpacked bytes, SHA-1 `1cdc4e9f027dbf4fddc3cff3243bcfc8b5677bed`, exactly the 17 pinned runtime asset files, and no `.blend`, review, `0.0.1`, source-asset tool, or unrelated payload. Public exports/service identity, caller-owned cadence, camera contract, timing/scoring/event IDs, and assembly-facing contracts were not changed by the audited commits.
- QA disposition: `k72.12` closes PASS. Parent implementation `k72.11` intentionally remains `in_progress` for the later final audit/coordination lane; assembly/environment integration and Derrick physical review remain untouched.

## Bead dependency-direction diagnosis and repair (2026-09-03)

- `k72.12` initially required forced closure because the initial graph used `bd create --deps blocks:<predecessor>` as though it meant “depends on predecessor”; it actually made each newly created task block its predecessor. This reversed the execution chain and masked readiness because agents were assigned explicitly.
- Full diagnosis is preserved in `.plans/debug/2026-09-03-bead-dependency-direction.md`. Every erroneous `blocks` edge was removed and re-added with explicit `bd dep add <successor> <predecessor>` syntax. Parent-child and discovered-from links were preserved.
- `bd dep cycles --json` returns `[]`; `k72.13` is now the sole ready execution task, while `k72.14` → `k72.15` → `k72.16` → `k72.17` are correctly blocked in order. Renderer parent `k72.11` then closed normally without force because its implementation, visual, and QA prerequisites are complete.

## Tasks 4–5 candidate foundation and provenance blocker (2026-09-03)

- Assembly candidate commit `2e84f8818a798d5751c51744afc2919ec4427844` added exact local moon GLB/config copies and strict validation, truthful non-scoring Flow bomb projection, and removed obsolete branding-atlas initialization/dependency. Its unit/browser/build/package checks passed, but `k72.13.1` was reopened after later provenance inspection.
- Embedded GLB `asset.extras` identifies author **Luis Vidal**, title **Icescape 1 Alien Moon Skybox**, source Sketchfab model `bfc9a041814f4112b016904edfaad0c5`, and license **CC BY 4.0**. This contradicts the candidate manifest’s `owned-local-source`/`externalPayloadCopied:false` claims and the approved plan’s no-third-party redistribution boundary. Both source and assembly GitHub repositories are public; no separate ownership-transfer record was found.
- Full diagnosis is preserved in `.plans/debug/2026-09-03-alien-moon-provenance-conflict.md`. Blocking bug `k72.13.4` now gates reopened payload `k72.13.1` and final wiring `k72.13.3`. Renderer environment child was retired with uncommitted partial work preserved in the renderer checkout; no further environment code or release work may proceed until Derrick chooses the rights/scope path.
- Technically, the self-contained GLB is a radius-30 inward-facing unlit sky sphere whose embedded PNG renders correctly from the approved camera. If CC BY use is explicitly approved, compliant author/title/source/license notices and per-asset license handling must replace the inaccurate ownership claim and survive built/released output. Otherwise the copied payload must be removed or replaced with AeroBeat-authored art. Bomb projection and atlas removal remain independently valid.

## Derrick environment replacement direction (2026-09-03)

- Derrick rejected continued use of the discovered Luis Vidal/Sketchfab skybox and directed an AeroBeat-controlled replacement: identify a visually similar local Gaussian splat from the generated-and-purchased splat catalog, capture an equirectangular 360 view, and use that owned image on a lightweight photosphere.
- Derrick explicitly confirmed AeroBeat purchased the candidate splats after generation and may use them commercially without attribution. This confirmation applies to the eventual selected splat/photosphere only; it does not reauthorize the third-party GLB already diagnosed above.
- Candidate-selection gate `k72.13.5` now blocks provenance repair `k72.13.4`. The next action is to inventory and render comparable icy candidates for Derrick selection. After selection, new implementation Beads will own 360 capture/photosphere generation, replacement of the third-party assembly payload/history-forward manifest, and resumed renderer/assembly integration.
- The technically validated but uncommitted renderer environment-owner candidate remains preserved and quarantined at renderer baseline `8e67860` pending adaptation to the selected owned photosphere descriptor. No old moon payload may enter the immutable successor release.

## Owned icy splat candidate review — awaiting Derrick selection (2026-09-03)

- Inventoried and hash-pinned eight nearby purchased candidates from `aerobeat-environment-community` commit `d46ad5b254df4f718fa935490be3b51dc3dffeae`: `luminious-ice-cave`, `icebergs-on-sea-shore`, `snow-mountain-with-lake`, `iceland-waterfall`, `igloo-toon`, `salt-lake`, `salt-lake-2`, and `alpine-river-valley`. Each compressed PLY contains `2,200,000` points and is recorded byte-for-byte in the review manifest.
- Existing Godot/GDGS GPU pipeline rendered all eight from the same `[0,0,4] → [0,0,0]` camera at RGB `960×540` on Vulkan Forward+ / RTX 3080. The review package contains exactly eight individual PNGs, one labeled `1920×648` contact sheet, and one bounded manifest; no PLY or absolute local path was copied into assembly review evidence.
- Contact sheet SHA-256 is `71550a30e8c8abd77052530f979a4b9ff96a8fb5bb08e7e8e10dbaf10e7561ad`. Parent visually inspected it: candidate 1 is a saturated blue crystalline alien ice cave, candidates 2/3 are realistic shore/glacier ice, candidate 5 is a bright stylized ice world, and the remaining candidates are less icy comparators.
- Headless preview capture was rejected after timing out awaiting a draw event; visible Vulkan capture succeeded. A first background batch saved its image but failed to exit and was retired as managed job `bash-48`; subsequent visible one-shot captures completed normally. This affects review automation only, not splat content.
- Gate `k72.13.5` remains in progress until Derrick identifies the source candidate and any preferred 360 camera/view direction.

## Derrick splat selection and owned photosphere generation — PASS (2026-09-03)

- Derrick explicitly selected candidate 1, `luminious-ice-cave`, from the eight-image contact sheet. Selection gate `k72.13.5` closed PASS. The pinned source is `55,619,663` bytes / `2,200,000` points / SHA-256 `a5732239888a0c6967d85693b504248733dbd48e7981cf39a348c32badc3c56a`.
- Environment commit `2a3072ff21236ee3d47c3ff3eb813d85eb1ef6c2` added reusable visible-Vulkan Godot/GDGS six-face capture tooling and deterministic Pillow cubemap-to-equirect stitching. One splat load at viewpoint `[0,0,4]`, with selected preview direction `−Z` centered, produced an RGB `4096×2048` JPEG of `2,210,289` bytes and SHA-256 `ff142b3ce3d3509ab3cfafcfc6a8cc2d3b0ff737852072d3a7aea8075478eed5`.
- Parent inspected the downscaled equirect panorama and cubemap cross: all six directions contain coherent saturated blue crystalline ice-cave content; forward view retains the selected corridor; up/down faces provide ceiling/floor coverage. Validation passes seam mean `3.4544`, seam p95 `12.6667`, top pole spread `1.9617`, and bottom pole spread `1.4678`, all within pinned thresholds.
- The per-asset manifest records Derrick’s commercial-control/no-attribution statement, expressly excludes this derivative from the defective root CC BY-NC text, and does not claim broader public sublicensing. It also records the truthful reproducibility limit: fixed face bytes stitch deterministically, but fresh GPU splat captures are not claimed byte-deterministic and full-resolution intermediate faces are not retained.
- Photosphere Bead `k72.13.6` closed PASS at clean public environment `main == origin/main == 2a3072f`. Reopened assembly payload `k72.13.1` and preserved renderer lifecycle `k72.13.2` are now eligible to replace the rejected third-party GLB with this owned JPEG/photosphere contract.
