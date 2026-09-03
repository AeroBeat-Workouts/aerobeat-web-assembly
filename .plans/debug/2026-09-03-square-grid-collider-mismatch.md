# Square Grid / Collider Mismatch Diagnosis

**Date:** 2026-09-03  
**Bead:** `aerobeat-web-assembly-k72.24`  
**Assembly baseline:** `672a1e25d54865f3600823daffda5b8a27dad824`  
**Renderer baseline:** `aaebf80739164dcfc65463856a98cddda61f0ad4`  
**Raw baseline:** immutable `release/raw/0.0.35`  
**Status:** diagnosis complete before implementation

## Exact Observed Failure

Derrick's directly observed failure is: the red obstacle/collider geometry looks good, but the visible body-grid cells are rectangular and do not agree visually with that geometry; every visible cell is expected to be square.

Fresh Chromium evidence reproduced the defect in all 16 requested baseline contexts: raw `0.0.35` and linked source, each direct and real cross-origin iframe, portrait `390×844` and landscape `844×390`, requested DPR `1` and `3` (renderer-capped to `2`). Raw and source pixels are byte-identical for corresponding contexts; direct and iframe pixels are also byte-identical. No console or page noise occurred.

Directly measured facts:

- The game and canvas DOM rectangles exactly equal the requested child viewport in all cases.
- The canvas drawing buffer is exact CSS size at DPR1 and exactly 2× CSS size when DPR3 is requested, matching the renderer's documented DPR2 cap.
- Every neutral cell and red blocked-cell overlay is authored at world scale `1.5 × 1.05`, a width/height ratio of `1.428571…`, not a square.
- The measured projected AABB ratio is `1.429046…` for a neutral cell and `1.429238…` for the red blocked overlay in both orientations, both embedding modes, both builds, and both effective DPRs. The approximately `0.03%` deviation from the world ratio is the expected front/back depth perspective from the thin `z=0.025/0.035` boxes.
- The diagnostic wall GLB retains measured world AABB `1.8 × 1.9 × 1.2`; its projected width/height ratio is `0.947368…`, visually near-square and consistent with Derrick's statement that the red collider looks good.
- The grid centers are also anisotropic: columns use `[-2.4,-0.8,0.8,2.4]` (step `1.6`) while rows use `[2.4,1.2,0]` (step `1.2`).
- The calibrated cursor projection repeats the same anisotropy with `x=-3.2+6.4u` and `y=3-3.6v`; a canonical normalized 4×3 space therefore receives `1.6` world units per column but `1.2` per row.

Representative projected CSS AABBs (direct, with identical iframe/source values):

| Viewport | DPR request / applied | neutral cell | red blocked cell | wall collider |
|---|---:|---:|---:|---:|
| `390×844` | `1 / 1` | `285.156×199.543`, ratio `1.429046` | `286.631×200.548`, ratio `1.429238` | `341.218×360.174`, ratio `0.947368` |
| `390×844` | `3 / 2` | `285.156×199.543`, ratio `1.429046` | `286.631×200.548`, ratio `1.429238` | `341.218×360.174`, ratio `0.947368` |
| `844×390` | `1 / 1` | `131.766×92.206`, ratio `1.429047` | `132.448×92.670`, ratio `1.429239` | `157.672×166.431`, ratio `0.947368` |
| `844×390` | `3 / 2` | `131.766×92.206`, ratio `1.429047` | `132.448×92.670`, ratio `1.429239` | `157.672×166.431`, ratio `0.947368` |

The complete raw measurements and the 16 PNGs are under `.plans/debug/evidence/2026-09-03-square-grid-collider-mismatch-before/geometry.json` and sibling images.

## Expected Behavior

- The canonical body grid remains row-major, top-left, four columns by three rows, with cell identities `0..11` unchanged.
- One canonical cell has equal X and Y world-unit pitch and equal rendered width and height under the fixed zero-roll perspective camera, within `1 CSS px` raster/projection tolerance.
- Neutral cells, safe/blocked overlays, targets, walls, and calibrated nose/wrist markers all use the same canonical equal-unit grid transform.
- The otherwise-approved red wall asset keeps its authored `1.8 × 1.9` cross-section, full authoritative Z interval, material, timing, and placement center unless evidence identifies that asset as the cause. It is not the cause here.
- Direct/iframe, portrait/landscape, and DPR must not change world mapping; viewport aspect may change framing only. No event coordinate, scoring, timing, privacy, iframe, snapshot, or host contract changes are allowed.

## Execution Path / Causal Path

1. Assembly `src/index.js::measureContainer()` measures the exact component content box and calls renderer `resize({widthCssPx,heightCssPx,devicePixelRatio})`.
2. Renderer `src/renderer-facade.js::applySize()` creates the exact CSS/drawing-buffer canvas. PlayCanvas computes an aspect-correct perspective projection; it does not stretch X independently from Y.
3. Assembly `src/index.js::rendererFrame()` preserves canonical event cells and passes them unchanged to `renderGameplayFrame()`.
4. Renderer `src/gameplay-scene-model.js::worldPositionForCell()` maps row-major cell identity through `gameplayWorldGrid.columnX/rowY`.
5. `addPresentationFloor()` and `addCellState()` author visible cell boxes at `scale {x:1.5,y:1.05}`. That is the direct source of the rectangular rendered cells.
6. `targetPositions()` uses the same anisotropic center map for Flow/Boxing targets and obstacle centers.
7. `renderer-facade.js::renderGameplayCursors()` separately maps normalized calibrated markers with `6.4` world X span and `3.6` world Y span. These spans encode the same `1.6`-versus-`1.2` per-cell mismatch, so changing only the floor rectangles would leave marker/calibration truth visually inconsistent.
8. The wall GLB is instantiated at the cell center with unit X/Y scale and only authoritative interval Z scaling. Its approved asset geometry is independent of the rectangular floor primitive.

## Most Likely Root Cause

The root cause is an old 16:9-shaped renderer world mapping retained underneath the newer canonical square-cell visual specification. The renderer uses a `6.4 × 3.6` athlete projection and `1.6 × 1.2` cell pitch, then draws `1.5 × 1.05` floor/blocked rectangles. These are internally consistent with a stretched 16:9 body plane but violate the approved statement that a gameplay cell is `1.00 × 1.00` in X/Y.

This is a renderer world-mapping defect **and** a matching calibration/cursor aspect-transform defect. It is not a CSS sizing defect and not a PlayCanvas viewport-projection defect. Evidence:

- The mismatch exists numerically before rendering (`1.5 / 1.05 = 1.428571…`).
- Its projected ratio is invariant across portrait/landscape, direct/iframe, raw/source, and DPR, which would not hold for an accidental CSS canvas stretch.
- Canvas DOM and drawing-buffer dimensions are exact, and PlayCanvas camera aspect follows the viewport.
- Cursor mapping independently encodes the same anisotropic `6.4 × 3.6` transform.
- The wall AABB is near-square and remains stable, contradicting the hypothesis that the collider asset is the source.

## Alternative Hypotheses

1. **CSS/body-grid overlay stretch — contradicted, very unlikely.** There is no DOM body-grid overlay. The grid is PlayCanvas box geometry inside the sole renderer canvas. The canvas CSS box and drawing-buffer ratio are correct in every case.
2. **PlayCanvas camera/aspect projection stretch — contradicted, unlikely.** A perspective camera scales X and Y uniformly at one Z plane. The same `1.429` ratio in opposite viewport aspects and DPRs proves the source geometry, not aspect projection, controls the mismatch.
3. **Wall/collider asset has the wrong shape — contradicted as primary cause.** The approved wall measures `1.8 × 1.9`, projects near-square, and is not used to construct the 12 visible cells. Changing it would not make the neutral/blocked cell primitives square.
4. **Only floor primitive dimensions are wrong — partially true but incomplete.** Setting only `1.5 × 1.5` or `1.05 × 1.05` would make each painted rectangle square, but centers, targets, and calibrated markers would remain under an anisotropic transform, so visual alignment and truthful mapping would still fail.
5. **DPR rounding — contradicted.** The defect is approximately 43%, while DPR1 and effective DPR2 ratios match to the recorded precision.

## Why Previous Behavior/Fixes Failed

No prior square-grid repair was attempted in this lane. Existing automated tests asserted exact canvas sizing, canonical cell IDs, target centers, and screenshot non-emptiness, but did not assert equal cell X/Y pitch, equal cell geometry dimensions, projected bounding boxes, or cell-edge pixel alignment. Consequently the old rectangular mapping passed all earlier matrices.

The previous integration preserved old renderer coordinates deliberately while replacing target assets and adding the track/walls. That preserved event/scoring truth but also preserved the obsolete 16:9 presentation transform. The release QA's pixel checks proved assets existed and differed, not that canonical cells were square.

## Unknowns

- Physical devices may crop different portions of the fixed world grid because viewport aspect changes framing. This is separate from geometric squareness; the requested matrix will determine whether explicit framing/letterboxing is also needed after equal-unit mapping.
- Transparent authored wall edges do not exactly coincide with a single cell because the approved wall is intentionally `1.8 × 1.9` while one canonical cell is `1 × 1`. The fix must preserve its center on the canonical cell and its interval truth; tests should distinguish center/grid alignment from a false requirement to resize approved wall geometry to one cell.
- Anti-aliasing may move a detected outermost pixel by one pixel. Projected geometry should be exact; pixel acceptance should therefore use `<=1 CSS px` edge tolerance.

## Minimal Reproduction

1. Serve immutable raw `0.0.35` or source at assembly `672a1e25` with renderer `aaebf80`.
2. Open a direct page or real cross-origin iframe at `390×844` or `844×390`, DPR1 or requested DPR3.
3. Wait for gameplay assets/environment to become ready.
4. Render a Flow frame with the 12-cell presentation floor, red blocked cell 5, and one wall centered on cell 5.
5. Inspect `lastModel.objects` and the actual PlayCanvas mesh AABBs.
6. Observe cell scale `1.5 × 1.05` and projected ratio about `1.429`; wall ratio is about `0.947`.

The failure does not depend on embed mode, source versus raw, orientation, or DPR. Boxing Lanes omits the 4×3 floor and therefore does not display this particular defect.

## Proposed Verification

Before changing code, the leading hypothesis is confirmed if changing one canonical renderer transform makes all of the following true while leaving camera projection and DOM sizing untouched:

1. `columnX` and `rowY` have the same adjacent pitch.
2. Every neutral/safe/blocked cell has equal X/Y scale.
3. Calibrated cursor normalized X/Y map through the same 4×3 equal-unit bounds.
4. Projected cell width and height differ by at most `1 CSS px` in all direct/iframe portrait/landscape DPR1/3 contexts.
5. Direct/iframe and DPR-equivalent screenshots remain byte-equivalent; raw `0.0.35` remains unchanged and continues reproducing the baseline.
6. Wall world AABB/material/Z interval remain unchanged and its center equals the corrected canonical cell center.
7. Existing event-coordinate, scoring, timing, lifecycle, no-noise, privacy, build, pack, fingerprint, predecessor, and release-target guards pass.

This distinguishes the leading hypothesis from CSS or camera-aspect alternatives: neither CSS dimensions nor camera aspect/FOV should require modification to correct the ratio.

## Recommended Fix

Make the renderer's canonical 4×3 presentation transform equal-unit and singular:

- Define one canonical square-cell grid with `1` world-unit pitch, column centers `[-1.5,-0.5,0.5,1.5]`, row centers `[2,1,0]`, and equal inset visible cell dimensions.
- Derive neutral/safe/blocked floor boxes from that one square-cell constant rather than independent X/Y literals.
- Derive normalized calibrated cursor mapping from the same grid outer bounds (`4 × 3` world units), eliminating the parallel `6.4 × 3.6` aspect transform.
- Keep cell IDs, row-major order, target records, judgement/scoring/timing, Z mapping, wall asset scale/material/interval, camera pose/FOV, canvas CSS sizing, media policy, snapshots, and public APIs unchanged.
- Add assembly-owned unit/source guards plus actual Chromium projected-AABB and pixel-edge assertions across direct/real-iframe portrait/landscape requested-DPR1/3. If portrait framing proves unacceptable after the equal-unit change, add an explicit centered framing rule as a separately evidenced adjustment; do not hide geometric distortion with nonuniform scaling.

The root implementation belongs in the renderer sibling because the grid objects and cursor world projection are renderer-owned. Assembly owns integration evidence and regression guards. No asset or environment repository change is needed.

## Debugging Record

```text
Problem: Visible canonical 4×3 grid cells are rectangular and visually disagree with near-square red obstacle/collider geometry.
Observed symptom: Neutral/red blocked cells measure world 1.5×1.05 and project at ~1.429 width/height in all 16 raw/source embedding/orientation/DPR cases; wall projects at ~0.947.
Root cause: Renderer retained an anisotropic 16:9 world/calibration transform (1.6 X units per column, 1.2 Y units per row; cursor span 6.4×3.6) after the square-cell specification.
Evidence: Exact model constants, mesh AABBs, invariant projected ratios, exact DOM/buffer sizing, raw/source and direct/iframe pixel equivalence, zero noise.
Failed approaches: No prior repair; prior tests checked existence/nonempty pixels and IDs but not cell aspect or edge alignment. A floor-only resize would be incomplete.
Corrective action: Replace parallel anisotropic literals with one equal-unit 4×3 renderer grid and derive visible cell and calibrated cursor mapping from it; preserve wall and gameplay truth.
Verification test: Unit/world invariants plus actual projected/pixel cell boxes <=1 CSS px across direct/real-iframe portrait/landscape DPR1/3, with wall center/Z and all existing guards unchanged.
Related files/components: renderer src/gameplay-scene-model.js, renderer src/renderer-facade.js, renderer browser/unit tests, assembly integration/browser validators, this debug evidence directory.
Remaining uncertainty: Whether physical-review framing needs an additional explicit centered viewport rule after distortion is removed; this must be decided from post-fix matrix evidence, not guessed.
```

## Implemented Correction and Post-fix Verification

Renderer commit `e5130e01edd511911e39e27126e856c67ae56ece` implements the recommended single equal-unit transform. Canonical centers are now X `[-1.5,-0.5,0.5,1.5]`, Y `[2,1,0]`; every visible neutral/safe/blocked face is world `0.94×0.94` with an equal `0.06` gap inside the `1×1` pitch. Calibrated cursor and debug-landmark transforms now derive the same outer bounds X `[-2,2]`, Y `[2.5,-0.5]`. Cell IDs/order and event records are unchanged. The wall remains world `1.8×1.9`, unit X/Y instance scale, full authoritative Z scale, centered on its canonical cell.

Fresh source post-fix evidence passed all eight direct/real-iframe portrait/landscape DPR1/3 rows with zero console/page noise:

| Viewport | DPR request / applied | neutral projected CSS | blocked projected CSS | absolute W−H |
|---|---:|---:|---:|---:|
| `390×844` | `1 / 1` | `178.714×178.638` | `179.645×179.538` | `0.076 / 0.107 px` |
| `390×844` | `3 / 2` | `178.714×178.638` | `179.645×179.538` | `0.076 / 0.107 px` |
| `844×390` | `1 / 1` | `82.581×82.546` | `83.011×82.962` | `0.035 / 0.049 px` |
| `844×390` | `3 / 2` | `82.581×82.546` | `83.011×82.962` | `0.035 / 0.049 px` |

The assembly's actual rendered-pixel validator independently measures the red blocked cell after framebuffer readback. Portrait is `180×180 CSS px` at both effective DPRs; landscape is `83×84 CSS px` at DPR1 (the one-pixel antialias/raster boundary tolerance) and `83×83 CSS px` at effective DPR2. Every detected edge is within `1 CSS px` of the projected mesh AABB. Direct and iframe framebuffer SHA-256 values match pairwise.

The approved wall's measured world AABB remains `1.7999999523×1.8999999762`, and its center exactly equals cell 5 at `(-0.5,1)` in every row. Camera position `(0.05,1,5)`, FOV `48`, canvas/DOM sizing, and DPR cap are unchanged; no framing/letterbox change was required to remove the distortion.

Evidence identities:

- Before geometry JSON SHA-256: `3af8651beff5f798a355ccc2a13754f2dafe3715161f15a6a22785645a80afc7`.
- After geometry JSON SHA-256: `e1abee5f232ae98ebf2d422b41147bcbfdcb2ab20a4ea75c3f2573551d3643fc`.
- Before screenshots, shared across raw/source and direct/iframe: portrait DPR1 `a0b7d193af0ca8631a630c2b3485eb30312cb5e2c38245b8b3481194b093eb4d`; portrait requested-DPR3/applied-DPR2 `8886d60b9d7d6cc14753377dcff3c52ab688db84ab8f7c6cb301b5df111b2d75`; landscape DPR1 `2fb36b18931c376492a80465782c808dfc1f05692f43df648c23de1bc0a20817`; landscape requested-DPR3/applied-DPR2 `88557f52def0ccdc70637b6bf57187ac147ad148e0c87d66fe9566805c1a136e`.
- After screenshots, shared across direct/iframe: portrait DPR1 `b5aa6ac6acb96f453908cfe3e2b92ae24f3ca35c5ef34a19aab9a3fb9906ae40`; portrait requested-DPR3/applied-DPR2 `a881deeb6d5f07b8175c339f7398dd3f73d48606a0defde37140830466640c56`; landscape DPR1 `4c14ae93698233d04ee3daa135d5503bcd4cbc80a2c45e2951c1c47a28c0c804`; landscape requested-DPR3/applied-DPR2 `d9cae02884fce367ab09de9910dc96bdb657ffc4514ab9de2f184274cecc27fc`.
