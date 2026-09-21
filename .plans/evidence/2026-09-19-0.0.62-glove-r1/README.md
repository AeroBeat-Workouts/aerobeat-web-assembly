# 0.0.62 glove r1 — boxing-glove-v1 review renders (bead 5y0q, lane L-D)

Derrick's visual sign-off round for the custom low-poly tintable boxing glove.
Generated 2026-09-21 by `aerobeat-web-renderer` `scripts/blender/render-boxing-glove-review.py`
(headless Blender 4.0.2, single pass, no glow pass) from
`assets/gameplay/0.0.11/boxing-glove/boxing-glove-v1.glb` (388 tris, 290 verts,
single material `mat/glove_body`, baked COLOR_0 vertex AO).

## Renders

| file | tint | camera (elev/azim) | notes |
|---|---|---|---|
| `glove-theme-blue-angle1.png` | theme-blue `#2693ff` | 35 / 30 | primary in-engine view (cuff side) |
| `glove-theme-green-angle1.png` | theme-green `#39c96b` | 35 / 30 | |
| `glove-song-blue-angle1.png` | song-blue `#2468ac` | 35 / 30 | representative song-palette tint |
| `glove-song-orange-angle1.png` | song-orange `#ff7a2f` | 35 / 30 | representative song-palette tint |
| `glove-theme-blue-angle2.png` | theme-blue `#2693ff` | 40 / -35 | thumb side, high |
| `glove-theme-blue-angle2b.png` | theme-blue `#2693ff` | 20 / 70 | thumb + wrist cuff band, low |
| `glove-dimmed-theme-blue.png` | theme-blue @ alpha 0.45 | 35 / 30 | in-engine cursor-lost dim |

## What these show (and don't)

- Tints are the **RAW file colors** (unlit emission, modulated by the baked vertex AO).
  In-engine the glove material is diffuse + 0.4× emissive of the same tint
  (≈1.4×, hard-clipped — brighter than these renders). That gain is a separate knob,
  measured/tuned in the sweep + r2b step, deliberately not baked into r1 sign-off renders.
- Camera hemisphere matches the **in-engine athlete view**: cuff side facing the viewer,
  knuckle face up on screen, thumb off to one side (clearest in angle2 / angle2b).
  The render script rotates the import 180° about Z to align the camera orbit with that view.
- In-engine the **right hand mirrors** the authored model (scale.x = -1, CULLFACE_NONE);
  these renders show the authored (left-hand) model.
- Model frame: +X thumb, knuckle face up, cuff/wrist toward the athlete. Extents
  0.550 × 0.460 × 0.460 WU — inside the 0.68 × 0.56 × 0.68 detection box
  (what-you-see-is-what-hits).

## In-engine sweep (real-pixel, 2026-09-21, `scripts/sweep-equipment-visuals.js`)

Real-rendered equipment pixels at 844×390 (production test surface), live renderer source
at `7a11ddb` through Vite + Playwright. AERO (photosphere) + CAMERA (transparent) modes,
72 cases each (saber 48 / glove 12 / both-hands 12).

Files: `2026-09-19-0.0.61-baseline-{saber,glove,both-hands}-equipment...` contact sheets
(`-saber-visual-sweep-combined.png`, `-glove-visual-sweep-combined.png`,
`-both-hands-equipment-sweep-combined.png`), `2026-09-19-environment-aero-vs-camera.png`,
`2026-09-19-equipment-sweep.json` (measured values per case).

Glove rows: consistent 54–57 × 45–46 screen-px bounding box at all three wrist positions;
tint tracks the per-hand palette (theme-defaults ≈ rgb(35,135,247); song-palette ≈
rgb(225,113,49)); dimmed (alpha 0.45) visible in AERO mode. GLB-vs-primitive staging is
proven by the renderer browser suite (`mat/glove_body` material + `glbEntity` + mirror
scale assertions, green at `7a11ddb`); the sweep harness does not emit an assetMode field.

Note: one pre-existing harness quirk (also present in the 0.0.61 baseline) — the
`saber_center_stationary-fallback...dimmed` CAMERA case fell below the visibility pixel
threshold (37 px); not a regression.

Rerun: `AEROBEAT_SWEEP_DIR=.plans/evidence/2026-09-19-0.0.62-glove-r1 node scripts/sweep-equipment-visuals.js`

## Iteration history

- r1 pass 1 (superseded, not kept): lit material — area lights saturated the base color,
  all four tints read near-white (the "colors look identical" defect class). Fixed by
  driving appearance from emission × vertex AO with black base color + Standard view
  transform; emission at raw tint (1.0 × alpha), not the in-engine 1.4× gain.
