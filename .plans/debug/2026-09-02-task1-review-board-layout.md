# Task 1 revision review-board layout QA failure

## Exact Observed Failure

Independent QA of revision `ab150be` found presentation defects in both committed `1600 × 900` boards.

Neutral board:

- subsection A heading overruns/clips at its right boundary and leaves stray text near panel B;
- subsection C heading overruns toward panel D;
- `WHITE CORE • SILHOUETTE STAYS` clips at the C-panel edge.

Gameplay-context board:

- `RED` overlaps the dual-shield annotation;
- `IDENTICAL DUAL SHIELDS` is unintentionally duplicated;
- `GREEN SUCCESS` is obscured by `3D NOSE / WRISTS`;
- `WORLD TEXT • SAME HEIGHT` is duplicated and underlying text overlaps/runs off-panel;
- `WHITE SUCCESS TINT` is duplicated and its lower copy clips against the footer.

The PNG dimensions, RGB mode, hashes, manifest, review-directory inventory, and non-runtime diff scope all passed.

## Expected Behavior

Every review annotation must be unique, fully visible, non-overlapping, and contained within its assigned panel or callout region at the fixed `1600 × 900` board size. The boards must communicate Derrick's clarified states without ambiguity.

## Execution Path

1. The Task 1 revision specification defines the clarified visual states.
2. A temporary local Pillow generator rasterizes fixed geometry, headings, callouts, labels, and footer into two PNGs.
3. The temporary generator is removed; only the PNGs and manifest are committed.
4. Mechanical validation checks image dimensions/mode/hash but does not test text extents or annotation collisions.
5. Independent visual QA opens the final PNGs and observes clipped, overlapping, and duplicate labels.

## Most Likely Root Cause

The temporary generator used fixed text origins and panel/callout widths without measuring rendered text bounds, wrapping long headings, or assigning exclusive annotation zones. Several semantic labels were drawn both as scene text and as callout text, causing duplicates. Mechanical image validation could not detect these semantic layout defects.

Evidence: every failure is localized to long or multiply represented labels while geometry, dimensions, mode, hashes, and manifest remain valid. The defects are visible in the final raster rather than arising from file corruption.

## Alternative Hypotheses

1. **Unexpected font substitution** — possible but less likely. The manifest records local DejaVu rendering and all clipping is consistent with insufficient reserved width rather than missing glyphs.
2. **Image viewer scaling** — contradicted by direct inspection of the native `1600 × 900` raster and by text actually crossing panel boundaries.
3. **Manifest/image mismatch** — contradicted by reproduced hashes and dimensions.

## Why Previous Fixes Failed

The revision focused on adding every requested state and validated only file-level invariants. It did not include a native-resolution text-bound/collision review before commit. Adding all callouts without removing redundant scene labels treated coverage as the only acceptance criterion and allowed presentation quality to regress.

## Unknowns

The removed temporary generator is unavailable, so its exact coordinates and text-measurement logic cannot be inspected. A fresh temporary generator must reconstruct the boards with explicit layout zones. Pixel-level OCR is unnecessary because the defects are directly visible.

## Minimal Reproduction

Open either committed revision board at native resolution. On the neutral board, inspect A/C headings and the C white-tint annotation. On the gameplay board, inspect the colored-row labels, dual-shield callout, world-text callout, white-tint callout, and footer boundary.

## Proposed Verification

Regenerate both boards with measured/wrapped headings and one exclusive annotation source per concept. Inspect at native resolution and verify:

- no text bounding box intersects another text bounding box;
- every heading/callout bounding box remains inside its assigned panel with at least 12 px padding;
- each semantic callout appears exactly once;
- the footer has a reserved exclusion zone;
- all clarified states remain visible.

Then recompute manifest hashes and rerun mechanical validation.

## Recommended Fix

Create a fresh temporary Pillow generator that uses text measurement, shorter wrapped headings, explicit non-overlapping panels, and a callout registry preventing duplicate semantic labels. Reserve dedicated margins for row labels and footer, and use leader lines instead of placing annotations over gameplay bands. Regenerate only the two review PNGs and manifest; do not alter runtime or model assets.

## Debugging Record

Problem: Revised Task 1 boards are semantically complete but visually cluttered.
Observed symptom: Clipped A/C headings and white-tint annotation; overlapping or duplicate row, shield, world-text, and tint labels.
Root cause: Fixed text placement without measured bounds/exclusive annotation zones; duplicate concepts rendered in multiple layers.
Evidence: Native raster inspection; mechanical file/hash checks pass.
Failed approaches: Coverage-only board regeneration plus dimension/hash validation.
Corrective action: Regenerate with measured text, wrapped headings, exclusive callout registry, and reserved layout zones.
Verification test: Native-resolution visual QA plus text-bound containment, uniqueness, and manifest/hash checks.
Related files/components: `.plans/review/2026-09-02-handcrafted-3d-task1/neutral-board.png`, `.plans/review/2026-09-02-handcrafted-3d-task1/gameplay-context-board.png`, `manifest.json`.
Remaining uncertainty: Exact coordinates in the removed temporary generator are unavailable and will be reconstructed.

## Repair Result — 2026-09-02

Status: complete for Bead `aerobeat-web-assembly-k72.7`.

- Regenerated only `neutral-board.png` and `gameplay-context-board.png` with a temporary Pillow script outside the repository, then removed the generator.
- Added measured/wrapped text placement with at least 12 px padding, exclusive unique callout regions, dedicated timing-row label space, and a reserved footer exclusion zone.
- Neutral board: wrapped the A heading, contained the C heading, and moved the white-core annotation fully inside C.
- Gameplay board: separated RED from shields, rendered one dual-shield callout, separated GREEN / SUCCESS from athlete labels, rendered one bounded world-text callout, and rendered one white-success-tint callout above the footer.
- Retained all six canonical roles and every clarified visual-review state without changing runtime, model, environment, scoring, timing truth, persistence, or public contracts.
- Native inspection and mechanical validation passed: both files are RGB `1600 × 900`; JSON parses; manifest hashes reproduce; exact review inventory remains two PNGs plus `manifest.json`; scoped Git diff contains only review evidence and metadata.

Validated SHA-256:

- `neutral-board.png`: `3aa318ef432a8678dcb87e59b4df81299537b96081d8e3b9695acff9be7b229f`
- `gameplay-context-board.png`: `e8bf7d79b6ed3a5ef66e1f03f1809677cf2c16c735f017553d8ab34960de63ee`
