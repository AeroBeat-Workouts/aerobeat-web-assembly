# Second physical-feedback runtime repair

**Date:** 2026-09-08

**Beads:** `yhie`, `orz4`

**Status:** CODER PASS; pending wall asset `0.0.10` and consolidated `ypdm`/`wari`

## Physical observations reproduced

Raw `0.0.45` used Derrick's promoted beat appearance distance only for hittable targets. Obstacles remained fixed at 2,500 ms / 15 world units. Visual Test misses ended pending visibility at the beat center but committed the synthetic miss at `+181 ms`; production misses committed only after the `+180 ms` late window, creating a deterministic disappear/reappear gap. Wrist assets already accepted renderer theme colors, but assembly never installed the selected package's validated effective palette. Flow and Boxing Grid always emitted all twelve neutral grid faces and had no setup preference.

## Repair

- The exact validated values from `/home/derrick/Downloads/aerobeat-test-presentation-config.v1.json` are now renderer defaults: lead `2`, height `.4`, apex `.4`, `out_quad` / `in_quad`, normal distance `50`, sky `prelude`, sky height `24`, duration `1000`, `in_out_sine`, Lanes separation `2.7`.
- Sky height remains default `24` but its accepted upper bound is now `50`.
- Test UI visible copy is `Beats`, `Reset beats`, `Load beats JSON`, and `Save beats JSON`; strict v1 filename/schema and `bounce*` keys are unchanged.
- Content exposes the current ready generation's already-validated frozen effective left/right palette through one non-enumerable private Symbol seam. Assembly applies it to renderer marker truth without adding palette data to snapshots, events, iframe messages, telemetry, storage, scoring, or packages. Nose remains fixed yellow; wrists match the song's dynamic left/right colors.
- Game Setup owns one strict default-on `Show 4 × 3 grid` checkbox. It persists only `{showGameplayGrid:boolean}` under the versioned setup key. Flow and Boxing Grid omit the twelve neutral grid faces when disabled; Boxing Lanes surfaces, gameplay targets, and nose/wrist markers remain independent and visible.
- Flow, Boxing Grid, and Boxing Lanes obstacles derive a timeline-clamped `normalSpawnMs` from the same configured distance/world-speed contract as beats. Renderer honors that explicit obstacle boundary beyond its generic 2,500 ms future cull. Obstacles never receive sky or bounce.
- Pending notes remain continuously at the exact crossing through the late window. A miss atomically changes that same object identity to gray at the crossing, remains for the bounded 350 ms feedback lifetime, and then expires once. Hit removal and scoring remain unchanged.

## Exact real-map evidence

The `89,424`-byte exact `3c9d` Hard fixture traverses browser Worker conversion, IndexedDB reload, downloaded selection, trusted Test, actual setup/Test input events, direct/genuine iframe, and desktop/mobile.

- Promoted default trajectory timestamps: `[19200,11666.666666666666,10666.666666666666]`.
- Maximum probe: sky height `50`, distance `72`, timestamps `[16800,8000,0]`, exact sky join, bounce apex and landing.
- Exact obstacle starts at its configured boundary with leading face `Z=-71.99999633789062` for distance `72`.
- Grid disabled: zero neutral grid faces, three nose/wrist markers remain.
- Both wrist marker fill materials match the private selected-song palette.
- Miss samples `+1`, `+180`, `+181 ms` retain one target at `Z=0`: pending dynamic color, pending dynamic color, then gray miss.

Content authority is `cef38e6bf9ae4591a8f106c48a65ad346febb3f5` / tree `91de549f95f9c7e7b4c6da3de405a2d7fc9c40f3`. Renderer authorities are `7d3696d8be92339fda45ef256488879ecf235f5c` for defaults/grid/palette and follow-up commits `579a237907c4d921016ceb35de2ca98cb6d1b28b` plus `f705737c17d8e12652490b5bb3e64609c3dc29c3` / final tree `33ca0a460c683f1ceca81c25b7319bfa552328d1` for continuous misses and distant obstacles.

Content `npm test`, renderer `npm test` and complete browser suite, assembly `npm test`, mutable build, mobile drawer/setup oracle, session projection, and four-row real-map browser oracle pass. All 20 immutable web raw snapshots and raw `0.0.45` remain unchanged.

## Orchestration record

Background runtime child `9213204b-9bd0-45db-8e24-e3afb3d24563` remained running across four continuation rounds without repo or process effects and was interrupted. Its one foreground idempotent fallback committed/pushed content and the initial renderer work, then failed while assembly held only partial unstaged edits. Parent reconciliation preserved those safe commits, found no active process or immutable effect, completed the renderer miss/obstacle corrections, assembly tests/evidence, and did not launch another fallback.

No immutable web build, asset release, serving change, tag, publication, or physical PASS is authorized by this coder result.
