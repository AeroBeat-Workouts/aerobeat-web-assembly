# Boxing Collider — Design Document

**Status:** DESIGN — **ship shape DECIDED by Derrick (2026-09-11)**: the collider ruleset becomes THE boxing option, visible label **`Boxing`**, the **default**; the two existing boxing options are hidden (see §1/§5). Open questions 1–4 remain for Derrick (he is reading this doc now).
**Date:** 2026-09-11 (playtest round 6 direction)
**Owning repo:** `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`
**Bead:** `aerobeat-web-assembly-z2tx` (discovered from `aerobeat-web-assembly-k72.17`)
**Semantics template:** `.plans/design/2026-09-09-flow-colliders-and-physical-feedback.md`
**Direction source (Derrick, 2026-09-11):** "Neither boxing mode is fun yet… the grid version is closer. What would actually be more fun is similar to the way we have 'Flow', we would have the markers actually collide with the beats to 'Count', but the beats still appear on the 4x3 grid, then we would have to adjust how the beats appear so they are always within range of your arms… This new boxing mode would be called 'Boxing Collider', and might end up being the final boxing mode if I playtest it."

## 1. Mode definition

**Boxing Collider** (ruleset identity `boxing_collider_v1`; visible label **`Boxing`**) is the scoring ruleset in which the calibrated wrist markers physically collide with descending beats to Count, exactly like Flow Colliders: beats still spawn on the canonical 4 × 3 grid and travel the canonical track, but their row is mapped into a shoulder-height reach band so every beat lands where a real punch can physically reach — top row ≈ slightly above shoulder, center row ≈ shoulder, bottom row ≈ slightly below shoulder. Scoring is swept 2.5D collider contact (not cell-entry), one Count per punched target, with Flow Colliders' chords, freshness, recovery, and late-window mechanics.

**Ship shape decision (Derrick, 2026-09-11):** "I probably won't be using the two existing boxing solutions, so lets hide the two current options and make the 'Collider' option the default and call it 'Boxing' (so now Flow and Boxing use a collider design for scoring against webcam markers with a 4x3 grid system for placement of beats)." Consequences:
- It is **not** a third selectable option — it **is** the boxing option, default for boxing.
- Boxing Lanes (`boxing_semantic_track_v1`) and Boxing Grid (`boxing_spatial_grid_v1`) are **hidden from the mode selector**.
- Existing Lanes/Grid packages remain **readable and playable** (a hidden option must not orphan charts Derrick already imported); the selector surfaces the stored variant for existing packages. New boxing imports default to `boxing_collider_v1`.
- The product framing is now: **Flow and Boxing are the two modes, both collider-scored against webcam markers, both using the 4×3 grid for beat placement.**

Current-state anchors (all file:line verified):
- Grid geometry: columns x=[-1.5,-0.5,0.5,1.5], rows y=[2,1,0], floor y=-0.72 — `aerobeat-web-renderer/src/gameplay-scene-model.js:31`; cell→world `column=cell%4, row=floor(cell/4)` — `:52-56`.
- Flow Colliders collider truth: wrists as swept 2.5D segments at sx=4x−0.5, sy=2.5−3y; target center (placement%4, 2−floor(placement/4)); inscribed half-extent 0.375 + radius; inclusive timing slab; ≤150ms gap; 150ms freshness; 180ms default window — `aerobeat-web-gameplay/src/flow-collider-collision.js:11-16,78,91-135`; settings {colliderRadius 0.12, enforceAuthoredDirection false, directionToleranceDegrees 45, timingWindowMs 180} at `:18-23`.
- Flow Colliders coordinator path — `aerobeat-web-gameplay/src/session-coordinator.js:736-843`.
- Existing boxing match paths (semantic straight qualification; spatial cell/subcell + cardinal entry; guard pairs; nose-safe checkpoints) — `session-coordinator.js:1291-1361`.
- Calibration envelope: T-pose wrist span × 0.75 centered on the shoulder midpoint — `aerobeat-web-input/src/body-grid-service.js:941-969`. THE key fact: the envelope is already shoulder-anchored; the defect is only that row 0 maps to the envelope TOP (≈0.75 wrist-span above the shoulders).
- Marker↔target consistency invariant: cursor markers (`gridPositionForNormalized`, `aerobeat-web-renderer/src/renderer-facade.js:283`) and the Flow collider (`measuredColliderSample`, `flow-collider-collision.js:90`) map the same normalized body coordinates into the same world plane. Boxing Collider preserves this exactly.

## 2. Reach-band row mapping (the core new mechanic)

### 2.1 Current mapping (what hurts)

| row | grid Y (world) | athlete Y (collider/marker plane) | body anchor today |
|---|---|---|---|
| 0 (top) | 2 | 2.5 (envelope top) | shoulder midpoint + 0.75 × wrist span |
| 1 (middle) | 1 | 1.5 | shoulder midpoint + 0.375 × wrist span |
| 2 (bottom) | 0 | 0.5 (envelope bottom) | shoulder midpoint − 0.375 × wrist span |

Both consumers derive athlete Y from the same normalized anchor y (0=envelope top, 1=envelope bottom): `gridPositionForNormalized` → 2.5−3y (`renderer-facade.js:34-35,283`); Flow collider → sy=2.5−3y (`flow-collider-collision.js:90`). The envelope is baseWidth=wrist span, baseHeight=baseWidth×aspect×3/4, centered on the shoulder midpoint (`body-grid-service.js:955-967`). The current full-grid mapping spans 1.125 × the T-pose wrist span in real height, with the top row about 3/4 of a T-pose arm span above the shoulders — exactly the reported pain.

### 2.2 Proposed band (Boxing Collider only)

Three rows remap onto a shoulder-height band centered on the calibration shoulder anchor, expressed as a fraction b of the current full row height:
- **Recommended b = 1/3.** Each band row ≈ 0.375 × wrist span of real height (roughly a compact uppercut/hook reach). Top row = shoulder + 0.25 × wrist span ("slightly above"), bottom = shoulder − 0.25 × wrist span ("slightly below"), matching Derrick's words exactly.
- Expose `reachBandRowFraction` ∈ [0.10, 0.50], default 1/3, as a bounded run-gated setting (run-locked, in score identity) so Derrick tunes it physically, then lock — same pattern as collider radius/window.

Formulas (R = 1.0 full row height in both planes):
| row | world Y | athlete Y (b=1/3) |
|---|---|---|
| 0 top | 1 + band (1.333) | 1.5 + band (1.833) |
| 1 center | 1 | 1.5 (= exact shoulder, unchanged) |
| 2 bottom | 1 − band (0.667) | 1.5 − band (1.167) |

World and athlete Y move by the same constant offset, so the marker/collider alignment invariant is preserved exactly.

### 2.3 Single point of truth (critical)

One shared pure mapping function (e.g. in `aerobeat-web-contracts`: `boxingColliderRowY(row, band) -> {worldY, athleteY}`) consumed by all three row-Y consumers: (1) judgement/coordinator target Y (today `targetCenterForPlacement`, `flow-collider-collision.js:91-94`), (2) presentation `worldPositionForCell`/obstacle centerY (`gameplay-scene-model.js:52-56,155`), (3) cursor markers `gridPositionForNormalized` (`renderer-facade.js:283`). Flow/Lanes/Grid pinned to band=1 (today's behavior, byte-identical). Band value is run config bound at run start, in the score partition identity; mid-run change rejected like `flow_collider_settings_locked` (`session-coordinator.js:396`).

### 2.4 Implications
- Beats no longer use the full grid height; all targets occupy y ∈ [1−band, 1+band]; grid cells (when enabled) render only the three banded rows.
- Goal plane (Z=0 crossing by song time), travel speed 0.006 WU/ms (`gameplay-scene-model.js:35`), and lead are unchanged.
- Vertical resolution compresses to 0.667 WU row spacing at b=1/3 — intentional (physical reach constraint). Collider half-extent 0.375+0.12 exceeds banded row spacing, so adjacent-row contacts at slab boundaries are possible (see open question 1).
- Obstacles (squat/weave) keep authored grid cells but render/judge at banded Y; charts stay mode-agnostic.
- The 4 × 3 cells remain the authored placement unit; nothing in charts/packages/body grid changes — render/judge-time remap only.

## 3. Collision semantics (mirror Flow Colliders)

### 3.1 Body-part ownership
| Authored object | Owning collider | Non-owner |
|---|---|---|
| straight/hook/uppercut_left | left wrist | right wrist cannot Count |
| straight/hook/uppercut_right | right wrist | left wrist cannot Count |
| guard / crossed_guard | v1: presentational window OR both wrists (open q3) | nose cannot guard |
| squat / weave_left / weave_right | nose (Flow-wall role: body avoidance) | wrists pass through |

Punches are already hand-attributed by action ID (`session-coordinator.js:1296-1300`). Punch-family direction mapping for optional enforcement: uppercut=up, hook=horizontal toward center (mirrors `spatialTarget` at `aerobeat-web-content-authoring/src/converter.js:309`), straight=down (recommend NOT enforcing for punches — open q2). Elbows/shoulders stay calibration/safety evidence only.

### 3.2 Swept 2.5D collider reuse
Reuse the shipped sweep verbatim (`clipWristSegmentToTarget`, `flow-collider-collision.js:113-135`): segment clip vs target footprint + timing slab, interpolated contact song time, stationary wrist Counted by arriving beat, no tunneling at 15 fps. Target footprint = banded cell footprint (same 0.375 half-extent + radius, same 0.12 default / 0–0.5 bounds). Game Setup v3 collider fields carry over AS-IS (already mode-neutral, `game-setup-coordinator.js:12-22`); add only `reachBandRowFraction`. Band + collider profile both participate in the Boxing Collider score identity (mirror `flowColliderSettingsIdentity`, `session-coordinator.js:1388`).

### 3.3 Chords
Direct transfer of the Flow Colliders simultaneous-contact contract: one frame/segment is an atomic batch; both wrists Count simultaneous left/right targets independently; one wrist segment may hit every exact-same-timestamp target it genuinely intersects; outside one exact arrival group the earliest contact wins per wrist episode (no staggered farming); each target resolves once. The converter already emits paired patterns (`converter.js:306`).

### 3.4 Freshness, continuity, recovery
Direct transfer: confidence 0.5, freshness <150ms, continuity ≤150ms (`flow-collider-collision.js:11-12`); the shipped independent left/right/nose recovery baselines (24m/jt5/uig chain: history severed on invalidating transitions, seed-only first frame, second-frame arming) apply unchanged. No fabricated contact across gaps; tracking-loss pause/resume unchanged; diagnostics limited to existing semantic codes (`no_input`, `stale_input`, `calibration_mismatch`, `wrong_collider`, `wrong_direction` — `session-coordinator.js:817-823`), no coordinates/confidence/frame IDs.

### 3.5 Bomb/hazard equivalents
Boxing charts have NO bombs (only punch + checkpoint actions, `session-coordinator.js:1134-1136`). Hazard equivalents = squat/weave obstacles: nose-evaluated, interval-based, contact/avoided/unevaluated_tracking, one deduplicated combo break per episode (Flow wall contract, `flow-obstacle-collision.js`; `session-coordinator.js:598-687`). Squat/weave remain nose hazards, not Counts. Guards: presentational in v1 (open q3).

### 3.6 Scoring and windows
- Count = normal hit per punched target; miss = normal miss when the timeline first passes center+window.
- Late window: reuse `timingWindowMs` (default 180ms, bounds 50–300); inclusive center±window; pending targets keep moving (no plane clamp, round-5 decision), gray at miss commit with the existing same-ID 350ms path (`session-render-projection.js:7`).
- Early side: no separate window — contact before center−window is simply not yet eligible (same as Flow Colliders).
- Score partition: own local-only, unranked partition; key includes collider profile + band identity.
- Straight 100ms hold (`prototypeJudgementDefaults.straightQualificationMs=100`, `gameplay-contracts.js:392-398`): RECOMMEND DROP in Boxing Collider (the sweep supersedes it; open q4).
- Punch min-spacing 360ms (`definitions.js:15`) is chart-side, unaffected.

## 4. Presentation
- Travel: identical to Flow (spawn distance, 0.006 WU/ms, Z=0 crossing at center). Sky prelude applies to punches (rec: YES — 0.0.51 zcsh made sky entry "common to all beats"; existing `skyPreludeStartMs` plumbing, `session-render-projection.js:34-40`). Only the Y span compresses.
- Track/tiles/floor are horizontal (Z) features at floorY−0.08 — unaffected.
- Targets render at banded row Y; GLB/icon assets unchanged; only Y position changes. Obstacles at banded geometry Y.
- Feedback: existing Great / gray-miss same-ID path (`gameplay-scene-model.js:175-202`).
- Grid visibility: `showGameplayGrid` (default false, `game-setup-coordinator.js:22`) unchanged — when on, tiles render at banded positions so Derrick sees exactly the three reach rows.
- Markers: exact same mapping (banded/full by mode) — wrist dot always sits where a Count lands. MUST be pixel-oracled: marker dot and target coincide at the same cell for every band value.
- Optional light HUD presenter mirroring `AeroBoxingTrackHud`/`AeroBoxingSpatialHud` (`aero-product-presenters.js:438-454`).

## 5. Relationship to existing modes
**DECIDED (Derrick, 2026-09-11):** the collider ruleset takes the `Boxing` label and is the default boxing option; Lanes and Grid are **hidden from the selector** (not deleted — the Flow Grid deletion precedent `8tz4` showed the cost, and legacy packages must stay playable). The mode selector (`aero-prototype-selector[scope='gameplay']`; `gameplayModeOptions` at `aero-product-presenters.js:564-568`) shows exactly **Flow** and **Boxing** for the v1 product surface; the hidden rulesets remain in contracts/persistence for stored-package playback (same mechanics as the hidden Note/Obstacle scale fields in `931s`: UI-hidden, data-intact). New boxing imports: `boxing_collider_v1` is the only newly-created boxing variant (reimport gates for the hidden legacy variants follow the `flow_grid_reimport_required` precedent if/when a package lacks the collider variant).

## 6. Package / chart / identity impact
- New ruleset `boxing_collider_v1` into `rulesetIds` (`gameplay-contracts.js:318-322`) + `AeroRulesetId` typedef (`:13`); `gameplayRulesetIds.boxingCollider` (`gameplay-mode-selection.js:6`); `rendererPresentationForVariant` → NEW presentation `boxing_collider` carrying the band parameter (`gameplay-scene-model.js:10,297`).
- New imports: 2 recipes × 3 rulesets = 6 boxing variants; old 4-variant packages readable (management) but playback requires reimport — new `boxing_collider_reimport_required`-style gate (precedents: `flow_colliders_reimport_required` `package-content.js:36`; `flow_grid_reimport_required` `aerobeat-web-content-authoring/src/persistence.js:293`).
- Charts mode-agnostic: band applied at render/judge time only — chart bytes, row balancing, converter (`converter.js:180-181`) untouched. Authoring note: uppercut/straight/hook row placement (row-family top=uppercut/middle=straight/bottom=hook, `converter.js:348`) stays as-is for v1 — the band changes where a row is, not which row a punch lands in (top row = "slightly above shoulder" is physically plausible for uppercuts anyway).
- Game Setup v3: adds `reachBandRowFraction` (default 1/3, [0.10,0.50], run-gated, live in Test/Play per the 4bj9 pattern); existing collider fields untouched.
- Migration/defaults: new imports default to Boxing Lanes (current first boxing option); NO auto-select of the experimental mode (Flow Colliders precedent). No score migration; new partition local-only, unranked initially.

## 7. Calibration impact
No calibration change. The T-pose calibration already captures the shoulder midpoint (envelope vertical center, `body-grid-service.js:961`) and wrist span (width scale). The band is a pure derivation at render/judge time from existing `calibration.bounds` (`AeroCalibrationSnapshot.bounds`, `body-grid-contracts.js:90`). No new pose/landmarks/hold. (The band must be a fraction of the existing row pitch, not an absolute world height, so it scales per-player calibration.)

## 8. Test plan (mirrors Flow Colliders shape)
**Unit / deterministic gameplay:** banded row Y exact at b ∈ {0.10, 1/3, 0.50} (center row = shoulder anchor exactly; b=1 equals today byte-for-byte); collision counting per punch kind at each banded row (tangent/outside/inside, stationary wrist + arriving beat, swept crossing, 149/150/>150ms gaps, 149/150ms freshness); timing −181/−180/0/+180/+181ms, one event/one Count, no dwell repeats, miss only past late boundary; chords (simultaneous L+R from one batch, staggered needs later contact, deterministic permutations); hazards (nose interval contact/coverage, one break per episode, wrist pass-through legal, avoided/unevaluated_tracking); recovery (the 16-case adversarial matrix); mode isolation (Flow/Lanes/Grid byte-compatible, no regression; band mid-run change rejected); diagnostics (approved semantic codes only).
**Renderer / browser:** reach-band pixel oracle (top row above center by exactly band; wrist marker at shoulder anchor projects onto the center-row line; Aero + Camera env, 18px+32px); presentation compression (Y span = 2·band, grid tiles only banded rows, track/tiles/floor unchanged, sky prelude applies to punches); mode selection UI (third option exact label, variant load, restore on switch); Game Setup (exact bounds/defaults, live, run-gated negative control); real-map browser (all three modes, identical timing, only Y/presentation differ, zero console noise).
**Privacy / telemetry:** deep-scan snapshots/events/iframe/storage/logs for forbidden coordinate/collider/calibration/frame fields; bounded public counts; exact partitioning; instance isolation.
**Physical (Derrick, post-build):** all three boxing modes; band reachability at normal stance; top-row uppercut "slightly above" natural; bottom-row hook comfortable; tuning pass on `reachBandRowFraction` + `colliderRadius` for the lock-in successor.

## 9. Open questions for Derrick (recs)
1. **Exact band width** — rec b=1/3 (±0.25 wrist-span), tunable [0.10,0.50]. Too tight/too tall? (wider = more separation risk at 0.375 half-extent.)
2. **Direction enforcement on punches** — rec default OFF (overlap-only); a real straight has no clean in-plane direction. Keep the optional toggle for punches, or punches always overlap-only?
3. **Guards collide or presentational?** — rec presentational v1 (zero new collision code); squat/weave already nose hazards either way.
4. **Keep or drop the 100ms straight hold?** — rec drop (sweep supersedes).
5. **~~Third mode now vs replacement~~ — ANSWERED (2026-09-11):** not a third option — collider becomes the default `Boxing` option; Lanes/Grid hidden (see §1/§5).
