# Round-4 Flow successor design — 2026-09-10 (PROPOSAL — implementation pending Derrick approval)

Single combined successor (raw `0.0.50`, append-only; `0.0.49` stays immutable/served) covering the seven raw-0.0.49 physical-feedback items. Six are independent of the P0 landmark investigation (`uo1y`, in progress); the landmark fix joins the same successor once the investigation verdict lands.

## 1. Flow identity — P0 `8tz4`

- **Keep canonical ruleset id `flow_colliders_v1`** as the sole Flow ruleset. No id rename: no chart-storage churn beyond variant reduction.
- **Package**: variants reduce to `["flow_colliders_v1"]`. Existing two-variant v6 packages become reimport-required for playback (same precedent as `flow_colliders_reimport_required`); list/export/delete remain management-only, mirroring the v5-history handling.
- **Chart v5**: authoring stops emitting the `flow_grid_v2` block; the parser keeps accepting legacy grid blocks for historical reads only. No chart schema bump (avoids a second migration wave).
- **UI**: the only visible Flow label is exactly `Flow` (backed by `flow_colliders_v1`). Flow Grid labels, radios, and copy deleted everywhere (shell matrix, mobile drawer, product-UI oracles).
- **Defaults**: import/reimport/cross-package selection defaults to the Flow (colliders) ruleset, no modifiers — replacing the Flow Grid default.
- **Verified scope map**: contracts `gameplay-contracts.js`; authoring `flow-contract.js`/`converter.js`/`validator.js` + fixture; content `package-content.js` + fixtures; gameplay `session-coordinator.js`; UI `aero-product-presenters.js` + `validate-product-ui-browser.js`/`validate-product-ui-contract.js`; assembly `gameplay-mode-selection.js`/`index.js` + 11 validator scripts; READMEs/decision docs.

## 2. Obstacle options — `id8w`

Exactly two options: `Enabled` (`default`) and `Disabled` (`no_obstacles`). `Visual Only` (`obstacle_visual_only`) deleted from the presenter, Game Setup v3 mappings, and all oracles; the runtime visual-only path is removed with it.

## 3. Visuals percentage — `tenl`

Derrick Q&A decision (2026-09-10): expose scale options **per class** rather than one global knob — find the right sizes once, then lock the chosen values in as the new shipped defaults and stop touching them.

Terminology (for the record): a **marker** is a 3D wrist/nose sphere that tracks the player; **role-layer** items are everything attached to the player instead of the track (the markers plus the Great/Miss feedback glyphs). A **beat** in scale terms = every cue that travels down the track: notes (directional arrows + any-direction circles), guards, obstacle walls, bombs.

Code facts that shaped this: all track cues are currently sized by one internal `roleScale` factor (`gameplay-scene-model.js:180` icon scale); the `targetSize` tuning key is **vestigial** (carried but never consumed — verified by grep); markers use a separate CSS-pixel size path (`stageGameplayCursors` → `worldScaleForCssPx`). Per-class controls are the only honest shape.

- Replace the Default/Compact selector with **four** bounded numeric controls, each 10–200, step 1, default 100, persisted in Game Setup v3:
  - `noteScalePercent` — notes: directional arrows, any-direction circles, guards
  - `obstacleScalePercent` — obstacle walls
  - `bombScalePercent` — bombs
  - `markerScalePercent` — wrist/nose markers + Great/Miss feedback glyphs
- Implementation: new bounded renderer tuning keys; the scene model applies the per-kind factor at icon scale (target-kind guards already exist); the marker/feedback path applies `markerScalePercent` to its size path. Internal `aero.visual.default`/`aero.visual.compact` profiles remain valid prototype-profile inputs (compat); the product selector is removed. 100% on all four is exactly today's behavior.
- Follow-up: after Derrick tunes, his chosen values are baked in as the new shipped defaults in a follow-up successor (controls remain).

## 4. Guidance bands — `er3m`

- **Extent (Derrick decision 2026-09-10: reduced-alpha continuation in both modes)**: bands emit across the whole visible window, not only at in-window beat timestamps. `song_beat_grid` mode renders the beat grid itself; `target_arrivals` keeps full-alpha bands at target-arrival timestamps and continues the track length with reduced-alpha (halved) continuation bands so arrivals stay distinct.
- **Alignment**: target-arrival band z already equals beat-center z via shared `timestampToWorldZ`; the observed beat-behind-band offset is a clock/nowMs-source or band-thickness artifact. Fix: band center z and target travel use the identical frame nowMs so beat centers align exactly with bands.
- **Live**: `guidanceBandMode` becomes a per-frame renderer input — switching Off/Song/Target mid-session applies immediately without restart. All other experiment-config keys stay next-Start/Test gated; drawer copy updates accordingly.

## 5. Walls/bombs spawn contract — `q1j3`

Diagnosis Bead first (content projection: do wall/bomb targets carry full spawn-lead travel or are they window-clamped at render?). Contract: every Flow target — notes, bombs, walls — appears in the top row and extends down to the bottom row with the same canonical travel; walls keep continuous full-column geometry while translating.

## 6. Test→Play live switch — `k85i`

Diagnosis Bead first (in-session mode-switch path in session coordinator + assembly action routing). The switch must be the same FIFO controlled fresh restart as cold Play: transport stops, song restarts, calibration starts for the Test→Play case. Add the in-session Test→Play and Play→Test axes to the terminal/action-order oracle.

## 7. Landmark P0 — `uo1y` (root cause VERIFIED)

Investigation verdict (both read-only subagents; pixel-harness evidence + PlayCanvas 2.21.4 engine forensics):

- **Material application is provably correct** — exact authored material names, correct role mapping, exact tints (nose `#F4C20D`, wrists song `#2693FF`/`#39C96B`), opacity 1, no blending. Name-collision and primitive-mismatch theories falsified with engine file:line evidence.
- **Root cause: authored asset composition.** The marker's exact geometric center sits on structural `mat/white` triangles; the front face is ~52% white / 45% tint / 3% charcoal, and the white patch is forced to unlit pale `(0.88,0.92,0.98)`. Against the bright alpine sky the white center is effectively invisible → the "transparent circular cutout" Derrick sees, and the wrists never read as song-colored. The 0.0.49 `1.0×` tint fix (B1) never touched the white-dominant geometry, so the symptom persisted since 0.0.38; prior oracles (patch presence, aggregate contrast) could never catch it.

**Fix (recommended): B2** — new immutable asset release `0.0.11` with the role color as the dominant face (tint-dominant sphere, thin white/charcoal keyline retained), pinned into `0.0.50`. Verification: deterministic pixel harness asserts marker-center pixel equals the wrist/nose role color and tint ≥ 80% of projected front area, plus a live-session palette-equality check (wrists = exact song left/right, never theme fallback; `assembly/src/index.js:968-974` boundary). Renderer-only fallback if asset authoring stalls: extend the marker tint to the `marker_structure_white` patch under the same verification.

## Execution shape

One combined successor (single-successor policy): source commits → package QA → fingerprint-bound headed hardware ABCCBA (fresh profile run; `bash-219` is never rerun) → final source audit → exactly one immutable build → independent immutable audit → secure-serving switch (collect `bash-230`, new managed loopback job rooted at the new raw, unchanged tailnet route) → Derrick physical review. Coder→QA→auditor per Bead; pixel evidence mandatory for `uo1y`.

## Decision points for Derrick

1. Target-arrival continuation bands: visible at reduced alpha, or full extent only in song-beat-grid mode?
2. Visual scale %: one knob driving both beat size and role/marker size (recommended), or beat size only?
3. Confirm one combined successor `0.0.50` carrying all seven items.
