# Wall/grid size-contract mismatch diagnosis

## Exact Observed Failure

Derrick's physical review reports that the moving red collider/wall visuals are significantly larger in every dimension than the square grid cells.

The current canonical grid uses world centers `[-1.5,-0.5,0.5,1.5]` by `[2,1,0]`, equal X/Y pitch `1.0`, and visible cell geometry `0.94 × 0.94`. The canonical `wall/red-glass-v1` GLB has measured X/Y dimensions `1.80 × 1.90`. Flow rendering creates one wall instance for each occupied canonical cell, centers each instance on that cell, and keeps X/Y scale at `1` while scaling only Z for interval duration.

Consequently, a one-cell wall is `1.80 / 0.94 = 1.9148936…` times the visible cell width and `1.90 / 0.94 = 2.0212766…` times its height. Relative to semantic pitch it is `1.8×` wide and `1.9×` high. Adjacent per-cell instances overlap by `0.80` world units horizontally or `0.90` vertically.

This diagnosis concerns moving Flow wall volumes. Static red blocked-cell overlays already use the same `0.94 × 0.94` X/Y dimensions as neutral grid cells. The web implementation has no mesh-AABB physics collider: gameplay occupancy is discrete cell IDs, while Flow non-note obstacles are visually represented and recorded rather than judged through GLB overlap. The wall's variable Z dimension is intentionally unlike the thin grid face because it encodes the authoritative time interval; only the X/Y footprint is defective.

## Expected Behavior

A wall instance representing one occupied canonical cell must have the same `0.94 × 0.94` visible X/Y footprint as that grid cell. Multi-cell obstacles must remain the exact set of per-cell instances supplied by the normalized target. Only wall Z length may vary, using the authoritative interval duration. Cell IDs, cell centers, collision/scoring occupancy, timestamps, and red material behavior must remain unchanged.

## Execution Path

1. Assembly derives `blockedCells` for Boxing spatial-grid overlays and separately passes normalized gameplay targets to the renderer.
2. `buildGameplaySceneModel()` defines the canonical `4 × 3` grid and emits neutral/static cell-state quads at `0.94 × 0.94`.
3. For a Flow obstacle, `targetObjects()` expands `target.cells` into one wall object per occupied cell.
4. Each wall object receives the exact canonical cell center and scale `{x:1,y:1,z:depth}`.
5. `AeroPlayCanvasRenderer.updateSceneObjects()` applies that scale directly to a loaded `wall/red-glass-v1` root.
6. The GLB's measured base cross-section is `1.80 × 1.90`; therefore its rendered X/Y footprint is almost twice the corresponding cell.

Relevant contracts are `aerobeat-web-renderer/src/gameplay-scene-model.js` (`GAMEPLAY_CELL_SIZE`, `gameplayWorldGrid`, `addPresentationFloor`, `addCellState`, Flow obstacle expansion), `aerobeat-web-renderer/src/renderer-facade.js` (direct object-scale application), `aerobeat-asset-gameplay/manifests/wall/red-glass-v1.v1.json`, and `aerobeat-web-assembly/docs/handcrafted-3d-visual-spec-v1.md`.

## Most Likely Root Cause

The original visual specification incorrectly defined a per-cell wall's source cross-section as `1.80 × 1.90`, independent of the renderer's canonical cell dimensions. The asset generator, manifests, renderer, tests, and later square-grid remediation faithfully preserved that internally consistent but cross-contract-incompatible value.

This is a design-contract bug. It is not caused by CSS, DPR, camera projection, cell-center mapping, obstacle normalization, or interval scaling.

Evidence:

- canonical visible cell: `0.94 × 0.94`;
- canonical wall source: `1.80 × 1.90 × 1.00`;
- runtime wall X/Y scale: exactly `1 × 1`;
- runtime expands multi-cell obstacles into one instance per occupied cell;
- renderer tests explicitly assert the legacy `1.8 × 1.9` footprint;
- the earlier square-grid plan explicitly retained the wall asset and interval truth rather than checking footprint equivalence.

## Alternative Hypotheses

1. **Perspective makes an accurate wall look larger.** Contradicted: the world-space X/Y dimensions already differ by approximately `1.91×` and `2.02×` at equal Z.
2. **The grid is still anisotropic.** Contradicted: current centers have equal `1.0` pitch and both neutral and blocked cell geometry are square `0.94 × 0.94`; direct/iframe framebuffer tests previously proved square projection.
3. **Obstacle width/height metadata is being applied twice.** Contradicted: normalized occupied cells are expanded once and each instance retains X/Y scale `1`; the oversized base mesh alone explains the result.
4. **The red object is a physics collider distinct from its visual.** Contradicted for this web renderer: collision/scoring authority is the normalized cell list and timing interval; the GLB is a visual wall volume.

## Why Previous Fixes Failed

The square-grid correction repaired legacy anisotropic grid transforms but treated the wall's `1.80 × 1.90` dimensions as an approved invariant. Its tests intentionally asserted those dimensions remained unchanged. Asset releases `0.0.2` through `0.0.4` likewise preserved the wall GLB byte-for-byte. These checks proved consistency within each subsystem but did not assert the missing cross-system invariant: one-cell wall X/Y footprint equals one canonical visible cell.

## Unknowns

No material causal unknown remains. Physical review must still confirm that `0.94 × 0.94` is the preferred visible footprint after implementation. Automated verification must also confirm exact pixel/world alignment at impact and no seams or overlaps beyond the intentional `0.06` pitch gap.

## Minimal Reproduction

Render one Flow obstacle with `cells:[0]` at impact Z beside the spatial grid. Inspect the scene model and loaded GLB world AABB:

- cell center: `(-1.5,2)`;
- visible cell footprint: `0.94 × 0.94`;
- wall scale: `(1,1,authoritativeDepth)`;
- wall footprint: `1.80 × 1.90`.

A static Boxing blocked-cell overlay does not reproduce the defect because it uses `0.94 × 0.94` directly.

## Proposed Verification

Before accepting a release:

1. Assert the successor wall manifest and measured GLB X/Y dimensions are exactly `0.94 × 0.94`.
2. Render a one-cell wall at impact and prove its world AABB X/Y equals its corresponding neutral/blocked cell within numeric tolerance.
3. Render adjacent two-cell and multi-row obstacles and prove each cell center remains exact, footprints do not overlap, and the `0.06` pitch gap is retained.
4. Assert runtime wall X/Y scale remains `1`; only Z varies from the authoritative interval.
5. Re-run square-grid direct/iframe portrait/landscape DPR matrix, obstacle interval tests, asset integrity/reproducibility tests, and physical review.
6. Confirm all other one-cell gameplay assets remain within the `0.94 × 0.94` cell footprint; current manifest dimensions show only the wall is an outlier.

## Recommended Fix

Update the owning visual specification and source asset so `wall/red-glass-v1` has a `0.94 × 0.94 × 1.00` unit-source extent, retaining its centered pivot, materials, analytic construction, depth behavior, and Z-only authoritative interval reuse. Publish it as a new immutable gameplay asset successor; do not modify raw `0.0.4` or older releases. Synchronize that successor into the renderer and replace tests that preserve `1.80 × 1.90` with explicit wall-to-cell footprint equality/non-overlap assertions.

Do not hide the defect with an undocumented renderer-only X/Y scale. Source, manifest, review evidence, runtime contract, and tests must agree.

## Debugging Record

```text
Problem: Moving red Flow walls are much larger than canonical grid cells.
Observed symptom: One-cell wall visibly overlaps neighboring cells in both X and Y.
Root cause: The original visual spec and wall asset define a 1.80 × 1.90 face while runtime maps one unit-scale wall instance to each 0.94 × 0.94 visible cell.
Evidence: Equal 1.0 grid pitch; 0.94 square cell geometry; 1.80 × 1.90 wall GLB; runtime X/Y scale 1; per-cell obstacle expansion.
Failed approaches: Earlier square-grid repair preserved and tested legacy wall dimensions instead of asserting cross-contract footprint equality.
Corrective action: New immutable wall asset successor at 0.94 × 0.94 × 1.00, synchronized source-first; preserve Z-only interval scale and cell/timing semantics.
Verification test: Manifest/GLB dimensions, impact AABB equality, adjacent-cell non-overlap, square-grid browser matrix, interval truth, reproducibility, and physical review.
Related files/components: handcrafted 3D visual spec; gameplay asset generator/manifests/release; renderer gameplay scene model, asset sync, and browser/unit tests.
Remaining uncertainty: Derrick physical acceptance of the corrected visual footprint.
```
