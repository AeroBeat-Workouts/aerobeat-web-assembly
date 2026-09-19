# 0.0.62 L-C (r2lb) r1 — saber v1 sweep evidence

**What this is.** A sweep capture of the NEW 0.0.62 saber visual (custom Blender
energy blade GLB, `flow-saber/flow-saber-v1`), driven through the renderer's real
`renderGameplayFrameWithCursorsAndEquipment` path with synthetic equipment
records, in BOTH environment modes (Aero photosphere + Camera). This is the
ITERATION REVIEW artifact for Derrick's visual sign-off (GATE 1: no locked-look
oracle yet).

The harness is `scripts/sweep-equipment-visuals.js` (same as the 0.0.61 baseline
capture). The evidence dir is CLI-overridable via `AEROBEAT_SWEEP_DIR`.

## Rerun

```sh
cd /home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly
AEROBEAT_SWEEP_DIR=.plans/evidence/2026-09-19-0.0.62-saber-v1 \
  node scripts/sweep-equipment-visuals.js
```

## Asset facts

- **GLB**: `assets/gameplay/0.0.11/flow-saber/flow-saber-v1.glb` (6996 bytes,
  sha256 `a9a2faee…`)
- **Build script**: `scripts/blender/build-flow-saber-v1.py` (renderer repo;
  parametric: length, base/tip radius, sides, core ratio, colors).
- **Triangles**: 144 total (84 shell + 60 core) — < 200 target.
- **Materials**: 2 slots.
  - `mat/saber_core` — bright emissive inner blade, runtime TINTABLE per hand
    (carries the song-palette color). OPAQUE normal blend, depthWrite ON,
    useLighting=false.
  - `mat/saber_shell` — dark outer body (near `#161c24`) with a subtle
    low-gain emissive edge tint. OPAQUE normal blend, depthWrite ON,
    useLighting=false.
- **Geometry**: 6-sided tapered blade, 0.75 WU end-to-end (== detection capsule
  length), base radius 0.065 WU → tip 0.015 WU. Extends along LOCAL +Y from
  the wrist.

## Files

- `2026-09-19-0.0.61-baseline-saber-visual-sweep-combined.png` — saber cases
  (Aero + Camera columns per case)
- `2026-09-19-0.0.61-baseline-glove-visual-sweep-combined.png` — glove cases
- `2026-09-19-0.0.61-baseline-both-hands-equipment-sweep-combined.png` —
  both-hands cases
- `2026-09-19-environment-aero-vs-camera.png` — environment-mode comparison
- `2026-09-19-equipment-sweep.json` — measured values per case × both
  environments (screen px, aspect, centroid, mean/edge RGB, luma, saturation,
  world AABB, input record, **dimmedVsUndimmed delta**)

## Dimmed-vs-undimmed saber delta (the 0.0.61 defect fix)

The 0.0.61 baseline had **byte-identical** dimmed/undimmed saber pixels
(additive glow did not dim — recorded on bead r2lb). The new saber MUST
visibly dim.

| Environment | Paired cases | meanLumaΔ range | meanLumaΔ avg | non-zero lumaΔ | diffPxΔ avg |
|---|---|---|---|---|---|
| Aero (photosphere) | 24 | 0.6 – 41.7 | **22.1** | 24/24 | -6 |
| Camera (hidden) | 24 | 0.3 – 0.7 | 0.5 | 12/24 | 0 |

- **Aero**: the saber dims strongly (avg mean-luma drop of 22.1 across the
  saber's diff pixels). The bright photosphere background (luma ~141) makes
  the dimming highly visible.
- **Camera**: the saber dims weakly (avg mean-luma drop of 0.5). The dark
  background (luma ~22) means the saber's alpha-0.45 compositing against
  near-black produces a very small pixel change. The maxLuma does drop
  (Δ -6.8 to -17.2) but the mean over the saber's diff pixels barely moves
  because the saber is a small, bright object against a dark field.

**Verdict**: the saber now dims measurably in Aero (the primary play-mode
background). In Camera the dimming is physically correct but visually subtle
against the near-black background — acceptable for r1, flagged for Derrick's
review.

## Aero vs Camera character (saber)

- **Aero**: the saber reads as a thin, crisp, hand-colored energy blade over
  the bright photosphere. The dark shell edge provides contrast against the
  bright background; the bright emissive core carries the song-palette color.
  The blade tapers to a point and is clearly a "blade" shape, not a frosted
  slab.
- **Camera**: the saber reads as a thin, dark blade with a bright hand-colored
  core against the near-black background. The dark shell is nearly invisible
  (blends into the dark background), but the bright core carries the color.
  The blade shape is clear but the "dark edge" character is lost in the dark
  field.

## What a human sees vs 0.0.61 baseline

- **Before (0.0.61)**: a frosted white-cyan slab (additive glow + white core
  dominated the color; the hand tint read only weakly). Dimming was
  byte-identical (invisible).
- **After (0.0.62 v1)**: a thin, crisp, hand-colored energy blade with a dark
  shell edge and a bright emissive core. The song-palette color reads
  clearly. Dimming is measurable (Aero: avg luma drop 22.1). The blade
  tapers to a point and reads as a "blade", not a slab.

## Case count

72 per environment (48 saber + 12 glove + 12 both-hands) × 2 = **144 total**.
