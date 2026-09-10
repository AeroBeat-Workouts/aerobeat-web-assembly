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

Replace the Default/Compact selector with one bounded numeric **Visual scale (%)**: min 10, max 200, step 1, default 100 (Game Setup v3 field `visualScalePercent`).

- Mapping: `S/100` multiplies **both** `targetSize` and `roleScale` (100% is exactly today's Default; Compact's historical 98%/86% disappears as an asymmetric special case).
- Internal `aero.visual.default`/`aero.visual.compact` profiles remain valid prototype-profile inputs (compat), but the product selector is removed; the percentage applies at session start under the existing tuning-application contract.

## 4. Guidance bands — `er3m`

- **Extent**: bands emit across the whole visible window, not only at in-window beat timestamps. `song_beat_grid` mode renders the beat grid itself; `target_arrivals` keeps bands at target-arrival timestamps but continues the track length with low-alpha (halved) continuation bands so the effect extends the track. *Decision point for Derrick: are continuation bands wanted in target-arrival mode, or extent extension only in song mode?*
- **Alignment**: target-arrival band z already equals beat-center z via shared `timestampToWorldZ`; the observed beat-behind-band offset is a clock/nowMs-source or band-thickness artifact. Fix: band center z and target travel use the identical frame nowMs so beat centers align exactly with bands.
- **Live**: `guidanceBandMode` becomes a per-frame renderer input — switching Off/Song/Target mid-session applies immediately without restart. All other experiment-config keys stay next-Start/Test gated; drawer copy updates accordingly.

## 5. Walls/bombs spawn contract — `q1j3`

Diagnosis Bead first (content projection: do wall/bomb targets carry full spawn-lead travel or are they window-clamped at render?). Contract: every Flow target — notes, bombs, walls — appears in the top row and extends down to the bottom row with the same canonical travel; walls keep continuous full-column geometry while translating.

## 6. Test→Play live switch — `k85i`

Diagnosis Bead first (in-session mode-switch path in session coordinator + assembly action routing). The switch must be the same FIFO controlled fresh restart as cold Play: transport stops, song restarts, calibration starts for the Test→Play case. Add the in-session Test→Play and Play→Test axes to the terminal/action-order oracle.

## 7. Landmark P0 — `uo1y` (pending investigation)

Two read-only subagents are running: PlayCanvas GLTF load-path/material-naming archaeology (+ asset material-name collision audit) and a deterministic headless pixel harness (fixed wrist/nose cursors, per-mesh-instance material readback, canvas pixel samples). **QA policy change either way**: successor QA must assert per-marker material readback and pixel color (tint patch equals expected wrist/nose color in a real rendered frame) — diagnostics-only oracles are no longer acceptable for this surface.

## Execution shape

One combined successor (single-successor policy): source commits → package QA → fingerprint-bound headed hardware ABCCBA (fresh profile run; `bash-219` is never rerun) → final source audit → exactly one immutable build → independent immutable audit → secure-serving switch (collect `bash-230`, new managed loopback job rooted at the new raw, unchanged tailnet route) → Derrick physical review. Coder→QA→auditor per Bead; pixel evidence mandatory for `uo1y`.

## Decision points for Derrick

1. Target-arrival continuation bands: visible at reduced alpha, or full extent only in song-beat-grid mode?
2. Visual scale %: one knob driving both beat size and role/marker size (recommended), or beat size only?
3. Confirm one combined successor `0.0.50` carrying all seven items.
