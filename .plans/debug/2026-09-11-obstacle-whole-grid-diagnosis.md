# Diagnosis: Top-Row Obstacles "Take Up the Whole 4×3 Grid" (Bead `aerobeat-web-assembly-t7sv`)

Date: 2026-09-11 · Source: relaunched read-only diagnosis subagent (retry of the broken first attempt `1383f391`; retry agent `982ef278-159e-430c-9569-db8943159744`). Symptom (Derrick round-6 playtest, raw 0.0.51): a few bugged obstacles, believed top-row, that took up the whole 4×3 grid instead of their authored column.

## TL;DR

**Could not reproduce a whole-grid wall for any row in either 0.0.50 or 0.0.51.** Single-cell top-row (Y=2) obstacles render as exactly one column of their authored cell, identical to mid/bottom rows, byte-for-byte identical between the pre-sky-entry (0.0.50) and post-sky-entry (0.0.51) scene models. The zcsh sky-entry fix is **not** a geometry/scale bug: it adds only a per-frame Y offset (`wallLiftY`) that is exactly zero after the lane join; x/z/scale are untouched. The strongest residual mechanism that fits Derrick's description is that the "bugged" obstacles are **multi-cell authored hazards** (full-height columns, e.g. `height=3`) — either intended-but-perceived-as-glitch, or a content-normalization mapping top-row taps to `height=3`.

## 1. Reproduction evidence (scene model + screenshots)

Headless Playwright Chromium driving the real `aero-game` renderer via an ephemeral-port Vite dev server (mirrors `validate-live-marker-visibility.js`); no camera; synthetic single-cell Flow obstacles pushed through `renderer.renderGameplayFrame(...)` with real 0.0.11 gameplay assets. Timeline: obstacle interval S=100 000 → E=101 000 ms; defaults `normalSpawnDistanceWorldUnits=50`, `skyMode="prelude"`, `skyPreludeHeightWorldUnits=50`, `skyPreludeDurationMs=1000`; so `normalSpawnMs=91 667`, `skyStartMs=90 667`.

### A. Scene-model wall object (0.0.51, all rows, 5 timeline positions)

| target | pos X/Y/Z @ skyStart | @ near-goal | scale X/Y/Z | footprint |
|---|---|---|---|---|
| top col1 (cell 1, Y=2) | (−0.5, **52**, −59) | (−0.5, 2, −4.8) | **(1, 1, 6)** | 1 cell |
| top col3 (cell 3, Y=2) | (1.5, **52**, −59) | (1.5, 2, −4.8) | (1, 1, 6) | 1 cell |
| mid col1 (cell 5, Y=1) | (−0.5, **51**, −59) | (−0.5, 1, −4.8) | (1, 1, 6) | 1 cell |
| bottom col1 (cell 9, Y=0) | (−0.5, **50**, −59) | (−0.5, 0, −4.8) | (1, 1, 6) | 1 cell |

Every row carries identical `scale = (1, 1, depth)` and per-row base Y (top=2, mid=1, bottom=0). At skyStart the lift is `+50` WU; at mid-prelude `+25`; at post-join/near-goal the lift is **exactly 0** (back on base 2/1/0). Full machine table: `/tmp/ob-diag/out/pixel-0.0.51.json`. **No configuration of a single-cell top-row obstacle produces width>1, height>1, or a multi-column/multi-row footprint.**

### B. Wall asset footprint (ground truth from the GLB)

`assets/gameplay/0.0.11/wall/red-glass-v1.glb` POSITION accessor bounds: `min=[−0.47,−0.47,−0.5]`, `max=[0.47,0.47,0.5]` — a **0.94 × 0.94 × 1.0 box** (one cell wide/tall, 1 WU deep). At scale `(1,1,d)` its world size is `0.94 × 0.94 × d` — exactly one cell.

### C. On-screen screenshots (0.0.51, real renderer, real wall GLB)

- `near-nearGoal-top.png` — top-row single-cell wall at near-goal: a **single red square in exactly one grid cell** (col 1, top row). Does NOT span the grid.
- `near-nearGoal-{mid,bottom}.png` — mid/bottom rows: same single-cell footprint, one cell lower.
- `near-skyStart-top.png` — at skyStart the wall is lifted into the sky (the entry Derrick verified "looks great").
- A naive red-channel pixel bbox (~429×207 px) was **contamination from the red late-timing zone and red track surface**, not the wall. Authoritative scene-model corner projection puts the wall at 8×8 px at spawn and ~45×45 px at near-goal — one cell, visually confirmed.

### D. A/B against 0.0.50 (pre-zcsh)

Clean 0.0.50 pin set (renderer `c30845f` = immediate parent of zcsh `b82b8f7`; contracts `c1bc9c3`; assembly worktree at `dc35c61`), identical harness. Post-join single-cell wall geometry: **byte-identical** top/mid/bottom between 0.0.50 and 0.0.51 — `(x, 2/1/0, −50) s(1,1,6)`. After the lane join the zcsh change is a visual no-op for wall placement. Worktrees removed after the run (verified: 0 entries).

## 2. Code trace (file:line, all verified)

- `aerobeat-web-renderer/src/gameplay-scene-model.js`:
  - L31 grid constants: `rowY:[2,1,0]`, `columnX:[-1.5,-0.5,0.5,1.5]`, `floorY:-0.72`, 4×3.
  - Obstacle (flow) branch L155–159: `centerX = geometry.x+(geometry.width-1)/2-1.5`; `centerY = 2-geometry.y-(geometry.height-1)/2`; `scaleX=(geometry.width-.06*obstacleScale)/GAMEPLAY_CELL_SIZE`, `scaleY` same for height; wall object `{x:centerX, y:centerY+wallLiftY, z:center}` scale `(scaleX, scaleY, depth)`.
  - zcsh addition L143: `wallLiftY = ... ? testPresentationSkyOffsetY(now, skyStart, normalSpawn, cfg) : 0` — pure **Y offset**; never touches `centerX`, `scaleX`, `scaleY`, or `z`/`depth`.
  - `test-presentation-config.js:37`: elevated by `skyPreludeHeightWorldUnits` at prelude start, ramps to **exactly 0 at `normalSpawnMs`** (the lane join), 0 outside `[start, join)`.
- `aerobeat-web-assembly/src/session-render-projection.js` L159–169: `flowObstacleTarget` passes `gameplayGeometry`, `cells` (gridMask), `normalSpawnMs`, `skyPreludeStartMs` straight through. No width/height reinterpretation.
- `aerobeat-web-contracts/src/obstacle-contracts.js` L49–54: `isObstacleGameplayGeometry` enforces integer `x∈[0,3]`, `y∈[0,2]`, `width∈[1,4]`, `height∈[1,3]`, `x+width≤4`, `y+height≤3`. Single-cell top-row = `{x, y:0, width:1, height:1}`. A top-row **full-height column** = `{x, y:0, width:1, height:3}` → mask `[x, x+4, x+8]` (e.g. the real DDR 3c9d Hard obstacle cells 1/5/9).

## 3. Hypotheses checked (explicitly)

- **(a) Y-lift at top row pushes the wall above the grid and it "covers all rows" (placement, not scale).** Refuted as drawn: the lift moves the wall *away* from the grid upward during the ≤1 s prelude, lands at exactly Y=2; it never overlaps rows 1/0; during prelude the far wall is sub-degree angular size (invisible). Not a whole-grid cover.
- **(b) Top-row `gameplayGeometry.height` interpreted as full-grid height.** Refuted: `height` is taken verbatim from the authored, contract-clamped value; single-cell ⇒ `height=1` ⇒ `scaleY≈0.94`. No top-row special-casing exists anywhere in the branch.
- **(c) zcsh lift applied to Y but wall authored floor-relative, so lifting misplaces it.** Partially true but harmless to the grid: the wall's vertical extent is authored around Y=0 (±0.47) and placed centered on the cell center — correct by design. The lift moves the whole rigid column uniformly; it changes *where vertically* the wall is, never *how big*.
- **(d) Multi-cell authored obstacles misread (the "few bugged" ones are actually full-height columns).** **Live hypothesis — see §4.** A real DDR Hard obstacle (3c9d) is a full-height column (cells 1, 5, 9) whose *correct* appearance is a wall spanning all three rows in one column. A full-height/wide obstacle is exactly what reads as "taking up the grid," and it is plausible the playtest map contains several such multi-cell hazards that look wrong *by design intent*, not by regression.

## 4. Residual mechanism (most likely root cause)

The "bugged" obstacles are **multi-cell (full-height `height=3` or `width>1`) authored obstacles**, and either (d-i) their intended full-column/full-width footprint is perceived as a bug, or (d-ii) a content/normalization step emits `height=3`/`width=4` where a single cell was authored. Two concrete places to inspect next (out of the read-only diagnosis scope):

1. **Content normalization** (`aerobeat-web-content-authoring`, BeatSaver v2/v3 converter): verify a top-row authored cell isn't being normalized to `height=3` (BeatSaber v2 legacy `_type`/`_width` mapping historically fills remaining height). If a top-row single tap maps to "fill to ceiling," every top-row single tap becomes a 3-tall wall = "whole column." Matches "believed top-row" + "a few of them" perfectly.
2. **Intended-vs-perceived:** confirm with Derrick whether the offending walls span **one column, all rows** (⇒ full-height column, likely d-i/d-ii) or **all four columns** (⇒ width blow-up, which this reproduction says the current code cannot produce for a single cell — that would point at a stale/served artifact, not this source).

Either way, **the zcsh sky-entry commit is exonerated** for a scale/whole-grid geometry defect: it provably changes only a transient, exactly-zero-at-join Y offset and leaves x/z/scale untouched, and the pre/post A/B scene models are identical.

## 5. Why "top row" specifically (secondary observation)

The scene model is row-neutral, but the top row (Y=2) is the only row whose post-join wall sits entirely *above* the camera's horizon line (camera Y=1, looking flat): the top-row wall occupies the upper half of the view while mid/bottom straddle the horizon. Combined with the track converging below, a top-row wall — especially a tall one — visually dominates the frame and reads as "covering the board." Perceptual salience explains why the *top* row draws the complaint even when geometry is correct. Not a defect; relevant to the fix discussion.

## 6. Minimal fix spec

**No line changes in `gameplay-scene-model.js`** — the shipped path has no defect. Per the Derrick-verified constraint (keep the rigid-column travel + sky entry), **do not change `wallLiftY` (L143), `centerX/centerY` (L155), `scaleX/scaleY` (L156), or the rigid `z0/z1/center/depth` (L140–141)**, and do not touch the `test-presentation-config.js:37` sky ramp (the feature Derrick validated).

- **If (d-ii) normalization is confirmed** (top-row taps normalizing to `height=3`): fix the converter's v2 legacy-type mapping so a top-row single cell stays `height=1` unless the author explicitly filled the column. Add a golden-fixture assertion that a top-row single cell normalizes to `height=1`.
- **If the complaint is purely perception** (full-height columns are intentional): no code fix required; optionally cap the *visual* max height or give multi-cell hazards a distinct material/edge treatment so they don't read as glitches.

## 7. Oracle assertions to add

**Scene-model (unit, mirrors `validate-offline-flow-obstacles.js`):**
- Single-cell top-row obstacle at `nowMs ≥ normalSpawnMs`: `wall.scale.x === 1 && wall.scale.y === 1` and `|wall.position.y − 2| < 1e-9` (lift zero at/after join). Currently passes — encode as a guardrail so a future `scaleY` regression fails loudly.
- Row neutrality: for the same `x`, top/mid/bottom walls have identical `scale.x`, `scale.y`, `position.x`; only `position.y` differs (2/1/0).
- Sky-entry endpoints: `wall.position.y` at `skyStart` equals `baseY + skyPreludeHeightWorldUnits`; `|wall.position.y(at join) − baseY| < 1e-9`; scale and `position.x/z` constant across the whole prelude (rigid column).

**Pixel (browser, mirrors `validate-square-grid-alignment.js`):**
- Render a single-cell top-row wall at near-goal with `showGameplayGrid:true`; assert the wall's red-dominant pixel bbox ≤ 1.15× one grid-column width and ≤ 1.15× one grid-row height (one cell, not the whole 4×3). Suppress the red track + timing zones so the measurement isolates the wall (a naive red bbox false-positives — see §1C).
- Regression discriminator: the oracle must **fail** if a full-height (`height=3`) or full-width (`width=4`) obstacle is fed a single-cell expectation — i.e. it catches the (d) normalization case.

## 8. Unknowns / what resolves them

1. **Which map + which cells were "bugged"?** RESOLVED (2026-09-13): Derrick identified **Backstreet Boys - Incomplete, Normal** (BeatSaver map **561f**, version hash `793560ce306bc4769f1433fe2836286bfb80c6aa`, "a full collider that spawns and blocks the complete play area" around ~12 s) and provided a screenshot (see §10).
2. **Was the served 0.0.51 bundle actually built from `fb29fb0`?** No longer relevant — the real chart reproduces the exact symptom through the canonical converter path.
3. **"Whole grid" = all columns or all rows?** RESOLVED: **both** — the offending walls are `width=4, height=3` = the complete 4×3 grid (`gridMask` = all 12 cells).

## 10. CONFIRMED root cause — real-chart reproduction (2026-09-13, parent-executed)

**Chart facts (map 561f Normal, legacy `_version: "2.0.0"` JSON):** 237 notes (133 taps + 104 legacy hold-starts, zero hold-ends), 0 bombs, and **11 entries in the separate legacy `_obstacles` array** (legacy obstacles live in `_obstacles`, NOT `_notes` — which is why the first diagnosis's `_notes` type scan found nothing). Of the 11 entries: only **3 are `_type:0` start entries** (beats 15/100/472, single-column, legitimate); the other **8 are `_type:1` END-marker entries, 5 of them with `_width:4`** (full width), including an orphaned end at beat 32 (14.33 s) with near-zero duration. The 2019 mapping tool that authored this chart wrote end markers without matching starts (orphaned terminators).

**Converter reproduction (real `parseBeatMapDifficulty(bytes,"v2")` + `convertDifficulty`, no mocks):** the Flow chart emits 11 obstacle beats, of which **5 are whole-grid walls** (`gameplayGeometry {x:0, y:0, width:4, height:3}`, `gridMask` = all 12 cells) at **14.33 s, 21.04 s, 40.30 s, 48.36 s, 65.37 s** — every one derived from a legacy `_type:1` END entry. The ~12 s sighting is the 14.33 s wall: with the (Derrick-verified) sky prelude it descends from the sky and becomes visible ~2 s before its interval, i.e. ≈12.3 s — exactly "around ~12 seconds", and as a 3.8×3.8 WU slab covering the whole 4×3 grid it matches the screenshot.

**Exact defect chain:**
1. `normalizeV2Obstacle` (`aerobeat-web-content-authoring/src/beatmap.js:116-131`) treats **every** legacy `_obstacles` entry — including `_type:1` END markers — as an independent obstacle using the entry's `_time` as start and `_duration` as length.
2. The fixture-defined legacy conversion (`obstacleRecord`, `beatmap.js:184-187`) expands every legacy obstacle to **full height** (`gameplayY=0, gameplayHeight=3`) — correct for the legacy format (legacy obstacles always span both layers).
3. The chart's `_width:4` passes through as 4 cells → **whole 4×3 grid**.
4. The renderer renders it faithfully (t7sv's scene-model A/B stands: no renderer defect).

**Why in-game BeatSaber doesn't show this:** legacy obstacle semantics pair START→END per lane/width; the START entry's `_duration` is authoritative and the END entry is a redundant terminator — an orphaned end marker renders nothing. Our parser must match that.

**Fix spec (for the t7sv lane):**
- In `normalizeV2` (`beatmap.js`), **skip legacy `_obstacles` entries with `_type:1` (END markers)** instead of parsing them as independent obstacles. The start entry's duration remains authoritative; orphaned ends drop (matching in-game behavior). Update/replace the legacy obstacle fixtures that currently pin the type-1→independent-obstacle behavior (the "fixture-defined" conversion comment at `:184` covers the y/height mapping, which is UNCHANGED).
- **Golden fixture: this exact chart** (map 561f, version hash above; re-fetchable from `https://r2cdn.beatsaver.com/793560ce306bc4769f1433fe2836286bfb80c6aa.zip`). Assert the converted Flow obstacle timeline is exactly the 3 legitimate single-column walls — 6.72–8.51 s (x=3), 44.78–47.46 s (x=0), 211.34–227.01 s (x=3) — all full-height, and that **no width-4 obstacle exists** (the 5 whole-grid walls are gone). Do not commit the 3rd-party chart bytes to the repo; re-fetch by hash.
- **Secondary audit (same lane, lower priority):** legacy `_width` pass-through — the classic legacy editor wrote `_width:2` (1 cell) / `4` (2 cells); the parser passes the value through as-is (`beatmap.js:129`), so a classic `_width:2` chart would render 2 cells wide where BeatSaber renders 1. Chart 561f uses non-standard 1/4 values and is unaffected, but the lane should audit the fixture set and record an explicit decision (remap classic 2→1 or keep pass-through with a documented rationale).
- No renderer change, no sky-entry change, no contracts change. The whole-grid *geometry itself* stays legal (a width-4 authoring is expressible); only the orphaned-END misparse is removed.

## 9. Debugging record

```text
Problem:        Top-row (Y=2) Flow obstacles reported to render across the whole 4x3 grid in 0.0.51.
Observed sym:   None reproducible. Single-cell top/mid/bottom walls all render as exactly one
                cell, scale (1,1,depth), in both 0.0.50 (pre-zcsh) and 0.0.51 (zcsh).
Root cause:     NOT in the shipped scene-model/projection path. Most likely the "bugged"
                obstacles are multi-cell (full-height column / width>1) authored hazards — either
                intended-but-perceived-as-glitch, or a content-normalization mapping top-row taps
                to height=3. The zcsh sky-entry is exonerated (Y-only, zero-at-join, no scale change).
Evidence:       Scene-model table (0.0.51 all rows × 5 phases) + wall GLB bounds (0.94x0.94x1)
                + A/B 0.0.50==0.0.51 post-join identity + near-goal screenshots showing one cell.
Failed appr:    None (read-only diagnosis). Ruled out: lift-placement-overlap, height-misread,
                floor-relative misplacement, single-cell width/height/depth blow-up.
Corrective act: Do NOT change zcsh lift/center/scale. Investigate beatsaver normalization for
                top-row→height=3 mapping; confirm intended vs. perceived for multi-cell hazards.
Verification:   Add scene-model guardrails (scale==1, row-neutrality, rigid-Z, zero-lift-at-join)
                and a one-cell pixel-footprint oracle with track/timing suppressed.
Related files:  aerobeat-web-renderer/src/gameplay-scene-model.js L140-159,
                src/test-presentation-config.js L37; aerobeat-web-assembly/src/session-render-projection.js L159-169;
                aerobeat-web-contracts/src/obstacle-contracts.js L49-76;
                assets/gameplay/0.0.11/wall/red-glass-v1.glb.
Remaining uncertainty: which real chart/cells triggered it; whether the served 0.0.51 bundle == fb29fb0;
                whether "whole grid" meant all-columns vs all-rows.
```

## Cleanup verification (subagent-attested, parent spot-check pending)

- Scratch git worktrees (`/tmp/ob-050*`) removed; `git worktree list` showed 0 ob-050 entries in all three repos.
- All harness Vite/Chromium/node processes exited; only transient ports 5611/5612/5620 used, all closed.
- **Managed `127.0.0.1:5173` untouched** (still serving raw 0.0.51).
- No repo edits, commits, Beads writes, `.plans/` edits, or builds performed. Scratch artifacts retained under `/tmp/ob-diag/`.
