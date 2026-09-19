# 0.0.62 xshm — equipment visual sweep: 0.0.61 BASELINE

**What this is.** A baseline capture of the CURRENT 0.0.61 saber + glove look,
driven through the renderer's real `renderGameplayFrameWithCursorsAndEquipment`
path with synthetic equipment records, in BOTH environment modes (Aero
photosphere + Camera). This is a TRUTH capture — no equipment was "fixed" here.
The purpose is to give Derrick the actual rendered model (all angles/colors,
both environments) before any redesign lane (r2lb saber / 5y0q glove) starts.

The harness is on-demand and NOT in the default gate. It mirrors the structure,
embedding, and pixel-capture conventions of `scripts/sweep-corpse-colors.js`.

## Rerun

```sh
cd /home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly
node scripts/sweep-equipment-visuals.js
```

(stamp override: `AEROBEAT_SWEEP_STAMP=YYYY-MM-DD` — default `2026-09-19`).

The harness:
- starts a Vite dev server on the live `../aerobeat-web-renderer` source
  (same fs.allow roots as the real app),
- loads the app once, quiesces the frame loop (`stopFrameLoop` +
  `setMenuOpen(false)`), and drives the renderer DIRECTLY,
- stages the alpine-river-valley photosphere via the real
  `setEnvironmentAsset` + `setEnvironmentVisible` path (Aero mode) and hides it
  with a transparent solid clear (Camera mode) — never faked,
- captures REAL rendered canvas pixels via `OffscreenCanvas drawImage +
  getImageData` (the cross-origin-safe pattern), baseline-subtracted diff,
- measures per case: diff-bbox screen px, width/height/aspect, centroid,
  mean/edge RGB, maxLuma, meanSat, and the world AABB (via
  `camera.worldToScreen` of the equipment corners).

## Sweep dimensions

| Dimension | Values |
|---|---|
| Wrist position | `center` (0.5,0.5), `left-up` (0.125,0.125), `right-low` (0.875,0.875) — normalized 0..1 vs the cursor grid |
| Saber direction (flow only) | `+X` (1,0), `+Y` (0,1), `45°` (0.707,0.707), `stationary-fallback` (0,0 → facing −Y) |
| Per-hand color pair | `theme-defaults` (#2693FF left / #39C96B right), `song-palette` (#FF7A2F left / #2FE0D0 right) |
| Dim state | `undimmed`, `dimmed` (CURSOR_LOST_DIM_ALPHA 0.45) |
| Both-hands present | `both-sabers`, `both-gloves`, `saber+glove` (left flow / right boxing) |
| Mode | Saber sweep = `flow`; Glove sweep = `boxing` (axis-aligned, no direction) |
| Environment | Aero (photosphere) AND Camera (hidden) — every case in both |

Case counts per environment: **48 saber + 12 glove + 12 both-hands = 72**;
**144 total** across both environments.

## Files

- `2026-09-19-0.0.61-baseline-saber-visual-sweep-combined.png` — saber cases, Aero + Camera columns per case
- `2026-09-19-0.0.61-baseline-glove-visual-sweep-combined.png` — glove cases, Aero + Camera
- `2026-09-19-0.0.61-baseline-both-hands-equipment-sweep-combined.png` — both-hands cases, Aero + Camera
- `2026-09-19-environment-aero-vs-camera.png` — environment-mode baseline (Aero photosphere vs Camera hidden)
- `2026-09-19-equipment-sweep.json` — measured values for every case × both environments (screen px, aspect, centroid, mean/edge RGB, luma, saturation, world AABB, input record)

## Key baseline facts (0.0.61, as captured — NOT fixed)

- **Saber** (flow): additive emissive beam + stacked near-white core. At the
  default 844×390 viewport the beam reads ≈38–49 px wide × ≈42–77 px tall
  (aspect 0.52–1.92 depending on direction), maxLuma 255 (the glow saturates
  to white along the axis). The mean RGB is a pale cyan-ish wash
  (≈rgb(200–255, 250–255, 170–255)) — the "frosted slab" Derrick flagged: the
  additive glow + white core dominate the color so the hand tint reads only
  weakly (low meanSat ≈2–10 on the saturated core pixels; higher sat only at
  the silhouette edge).
- **Glove** (boxing): flat tinted box + white accent. Reads ≈72–90 px wide ×
  60–72 px tall (aspect ≈1.20–1.25), maxLuma ≈126–180, high meanSat
  (≈180–220) — the box is a solid, clearly hand-colored object (the song-palette
  #FF7A2F orange reads cleanly; the #2693FF blue reads as a saturated blue box).
- **Dimmed state (saber): INVISIBLE.** The saber's `dimmed` flag changes the
  material opacity (1.0 → 0.45, verified on the pooled mesh material) but the
  rendered pixels are byte-identical between dimmed and undimmed — the
  additive-blend glow does not dim. This is a real 0.0.61 truth, not a capture
  bug (the glove DOES dim, modestly: luma 161→174 etc.). See Bead xshm / r2lb.
- **Environment modes differ visibly:** Aero meanLuma ≈141 (bright, textured
  photosphere) vs Camera meanLuma ≈22 (flat dark, photosphere hidden). The
  photosphere is staged on a dedicated opaque layer BEFORE the World layer (the
  real `PlayCanvasEnvironmentAssetOwner` path), so equipment renders in front
  of it in Aero and against a transparent clear in Camera.

## How to interpret the contact sheets

Each combined sheet has one row per sweep case and two image columns: **Aero**
(photosphere background) and **Camera** (hidden background). The label under
each crop shows the measured mean RGB, saturation, and maxLuma for that
environment. Use these to judge: does the saber read as a blade over both
backgrounds? Does the glove read as a solid hand? Does dimming register?
