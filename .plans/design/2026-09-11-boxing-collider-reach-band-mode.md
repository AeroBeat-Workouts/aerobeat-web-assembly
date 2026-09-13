# Boxing Collider — Design Document

**Status:** DESIGN — **FULLY SPECIFIED (Derrick, 2026-09-11)**. Ship shape: the collider ruleset becomes THE boxing option, visible label **`Boxing`**, the **default**; the two existing boxing options are hidden (see §1/§5). All five open questions ANSWERED (see §9); implementation-ready pending 0.0.52 wave approval.
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

### 2.2 Reach sliders (DECIDED — Derrick, 2026-09-11)

Two independent sliders spread the outer rows from the center row; the center row stays pinned at the shoulder anchor:
- **Top-row reach** `topRowReachWU` ∈ [0, 1] — how far the top row sits ABOVE the shoulder, in world space. 0 = level with the shoulder; 1.0 = one world unit above (= exactly today's full-grid top-row offset).
- **Bottom-row reach** `bottomRowReachWU` ∈ [0, 1] — same, downward from the shoulder.
- **Defaults: 0.25 / 0.25** ("slightly above / slightly below shoulder"). Both are live run-gated settings (same pattern as the scale controls, `4bj9`); after Derrick finds the values physically they are locked in as the shipped defaults and the sliders are hidden (`931s` lock-in pattern).

Formulas (the world and athlete planes are 1:1 row-pitch, so the same offset applies to both):
| row | world Y | athlete Y |
|---|---|---|
| 0 top | 1 + `topRowReachWU` | 1.5 + `topRowReachWU` |
| 1 center | 1 | 1.5 (= exact shoulder, unchanged) |
| 2 bottom | 1 − `bottomRowReachWU` | 1.5 − `bottomRowReachWU` |

World and athlete Y move by the same constant offset, so the marker/collider alignment invariant is preserved exactly. At 1.0/1.0 the mapping degenerates to today's full-grid behavior (byte-identical); at 0/0 all three rows sit at shoulder height (degenerate, allowed by bounds).

### 2.3 Single point of truth (critical)

One shared pure mapping function (e.g. in `aerobeat-web-contracts`: `boxingColliderRowY(row, {topRowReachWU, bottomRowReachWU}) -> {worldY, athleteY}`) consumed by all three row-Y consumers: (1) judgement/coordinator target Y (today `targetCenterForPlacement`, `flow-collider-collision.js:91-94`), (2) presentation `worldPositionForCell`/obstacle centerY (`gameplay-scene-model.js:52-56,155`), (3) cursor markers `gridPositionForNormalized` (`renderer-facade.js:283`). Flow/Lanes/Grid pinned to `topRowReachWU = bottomRowReachWU = 1` (today's behavior, byte-identical). The two reach values are run config bound at run start, in the score partition identity; mid-run change rejected like `flow_collider_settings_locked` (`session-coordinator.js:396`).

### 2.4 Implications
- Beats no longer use the full grid height; all targets occupy y ∈ [1−bottomRowReachWU, 1+topRowReachWU]; grid cells (when enabled) render only the three reach rows.
- Goal plane (Z=0 crossing by song time), travel speed 0.006 WU/ms (`gameplay-scene-model.js:35`), and lead are unchanged.
- Vertical spacing is now asymmetric and player-tuned: top spacing = `topRowReachWU`, bottom spacing = `bottomRowReachWU`, center pinned. At the 0.25/0.25 default the adjacent-row spacing (0.25 WU) is below the collider half-extent (0.375+0.12), so adjacent-row contacts at slab boundaries are possible — by design; the simultaneous-contact (chord) contract resolves same-timestamp pairs deterministically.
- Obstacles (squat/weave) keep authored grid cells but render/judge at reach-row Y; charts stay mode-agnostic.
- The 4 × 3 cells remain the authored placement unit; nothing in charts/packages/body grid changes — render/judge-time remap only.
- **Reachability constraint (Derrick, 2026-09-11):** no punch or guard beat may appear outside the center columns (columns 1–2) — see §11 for the verification + the guard-pair restriction.

## 3. Collision semantics (mirror Flow Colliders)

### 3.1 Body-part ownership
| Authored object | Owning collider | Non-owner |
|---|---|---|
| straight/hook/uppercut_left | left wrist | right wrist cannot Count |
| straight/hook/uppercut_right | right wrist | left wrist cannot Count |
| guard / crossed_guard | **DECIDED — two modes via toggle**: **collision** (default): left wrist must contact the LEFT authored guard cell AND right wrist the RIGHT authored guard cell (side-ownership per authored cell, crossed_guard honored); both wrists required for the guard to Count. **gesture**: the Godot guard-gesture port (§10). | nose cannot guard |
| squat / weave_left / weave_right | nose (Flow-wall role: body avoidance) | wrists pass through |

Punches are already hand-attributed by action ID (`session-coordinator.js:1296-1300`). **Direction enforcement (DECIDED):** the existing `enforceAuthoredDirection` toggle + `directionToleranceDegrees` (default 45°, same as Flow) applies to **uppercut (up) and hook (horizontal toward center) only** — mirroring `spatialTarget` at `aerobeat-web-content-authoring/src/converter.js:309`. **Straight is ALWAYS overlap-only** (no forward-velocity detection from a webcam); a future "touch + straight-gesture-active" mode is noted for later testing but explicitly NOT built now. Elbows/shoulders stay calibration/safety evidence only (gesture mode consumes wrist/elbow/nose positions per §10).

### 3.2 Swept 2.5D collider reuse
Reuse the shipped sweep verbatim (`clipWristSegmentToTarget`, `flow-collider-collision.js:113-135`): segment clip vs target footprint + timing slab, interpolated contact song time, stationary wrist Counted by arriving beat, no tunneling at 15 fps. Target footprint = reach-row cell footprint (same 0.375 half-extent + radius, same 0.12 default / 0–0.5 bounds). Game Setup v3 collider fields carry over AS-IS (already mode-neutral, `game-setup-coordinator.js:12-22`); add the two reach sliders + the guard-count-mode toggle (§6). Reach values + guard mode + collider profile all participate in the Boxing Collider score identity (mirror `flowColliderSettingsIdentity`, `session-coordinator.js:1388`).

### 3.3 Chords
Direct transfer of the Flow Colliders simultaneous-contact contract: one frame/segment is an atomic batch; both wrists Count simultaneous left/right targets independently; one wrist segment may hit every exact-same-timestamp target it genuinely intersects; outside one exact arrival group the earliest contact wins per wrist episode (no staggered farming); each target resolves once. The converter already emits paired patterns (`converter.js:306`).

### 3.4 Freshness, continuity, recovery
Direct transfer: confidence 0.5, freshness <150ms, continuity ≤150ms (`flow-collider-collision.js:11-12`); the shipped independent left/right/nose recovery baselines (24m/jt5/uig chain: history severed on invalidating transitions, seed-only first frame, second-frame arming) apply unchanged. No fabricated contact across gaps; tracking-loss pause/resume unchanged; diagnostics limited to existing semantic codes (`no_input`, `stale_input`, `calibration_mismatch`, `wrong_collider`, `wrong_direction` — `session-coordinator.js:817-823`), no coordinates/confidence/frame IDs.

### 3.5 Bomb/hazard equivalents
Boxing charts have NO bombs (only punch + checkpoint actions, `session-coordinator.js:1134-1136`). Hazard equivalents = squat/weave obstacles: nose-evaluated, interval-based, contact/avoided/unevaluated_tracking, one deduplicated combo break per episode (Flow wall contract, `flow-obstacle-collision.js`; `session-coordinator.js:598-687`). Squat/weave remain nose hazards, not Counts. Guards: two-mode toggle (collision default / gesture), §3.1 + §10.

### 3.6 Scoring and windows
- Count = normal hit per punched target; miss = normal miss when the timeline first passes center+window.
- Late window: reuse `timingWindowMs` (default 180ms, bounds 50–300); inclusive center±window; pending targets keep moving (no plane clamp, round-5 decision), gray at miss commit with the existing same-ID 350ms path (`session-render-projection.js:7`).
- Early side: no separate window — contact before center−window is simply not yet eligible (same as Flow Colliders).
- Score partition: own local-only, unranked partition; key includes collider profile + reach identity + guard mode.
- Straight 100ms hold (`prototypeJudgementDefaults.straightQualificationMs=100`, `gameplay-contracts.js:392-398`): **DROP in `boxing_collider_v1` (DECIDED — Derrick, 2026-09-11: "collision is what matters")** — `straightQualificationMs`/`semanticQualification` do not apply; swept contact supersedes.
- Punch min-spacing 360ms (`definitions.js:15`) is chart-side, unaffected.

## 4. Presentation
- Travel: identical to Flow (spawn distance, 0.006 WU/ms, Z=0 crossing at center). Sky prelude applies to punches (rec: YES — 0.0.51 zcsh made sky entry "common to all beats"; existing `skyPreludeStartMs` plumbing, `session-render-projection.js:34-40`). Only the Y span compresses.
- Track/tiles/floor are horizontal (Z) features at floorY−0.08 — unaffected.
- Targets render at reach-row Y; GLB/icon assets unchanged; only Y position changes. Obstacles at reach-row geometry Y.
- Feedback: existing Great / gray-miss same-ID path (`gameplay-scene-model.js:175-202`).
- Grid visibility: `showGameplayGrid` (default false, `game-setup-coordinator.js:22`) unchanged — when on, tiles render at reach-row positions so Derrick sees exactly the three reach rows.
- Markers: exact same mapping (reach/full by mode) — wrist dot always sits where a Count lands. MUST be pixel-oracled: marker dot and target coincide at the same cell for every reach-slider value.
- Optional light HUD presenter mirroring `AeroBoxingTrackHud`/`AeroBoxingSpatialHud` (`aero-product-presenters.js:438-454`).

## 5. Relationship to existing modes
**DECIDED (Derrick, 2026-09-11):** the collider ruleset takes the `Boxing` label and is the default boxing option; Lanes and Grid are **hidden from the selector** (not deleted — the Flow Grid deletion precedent `8tz4` showed the cost, and legacy packages must stay playable). The mode selector (`aero-prototype-selector[scope='gameplay']`; `gameplayModeOptions` at `aero-product-presenters.js:564-568`) shows exactly **Flow** and **Boxing** for the v1 product surface; the hidden rulesets remain in contracts/persistence for stored-package playback (same mechanics as the hidden Note/Obstacle scale fields in `931s`: UI-hidden, data-intact). New boxing imports: `boxing_collider_v1` is the only newly-created boxing variant (reimport gates for the hidden legacy variants follow the `flow_grid_reimport_required` precedent if/when a package lacks the collider variant).

## 6. Package / chart / identity impact
- New ruleset `boxing_collider_v1` into `rulesetIds` (`gameplay-contracts.js:318-322`) + `AeroRulesetId` typedef (`:13`); `gameplayRulesetIds.boxing` (`gameplay-mode-selection.js:6`); `rendererPresentationForVariant` → NEW presentation `boxing_collider` carrying the two reach values (`gameplay-scene-model.js:10,297`).
- New imports: `boxing_collider_v1` is the only newly-created boxing variant (the hidden Lanes/Grid rulesets remain readable for existing packages; reimport gates follow the `flow_grid_reimport_required` precedent if/when an old package is opened without a collider variant).
- Charts mode-agnostic: reach mapping applied at render/judge time only — chart bytes, row balancing untouched. Authoring note: uppercut/straight/hook row placement (row-family top=uppercut/middle=straight/bottom=hook, `converter.js:348`) stays as-is for v1 — the reach sliders change where a row is, not which row a punch lands in (top row = "slightly above shoulder" is physically plausible for uppercuts anyway). The one converter change is the guard-pair restriction (§11).
- Game Setup v3: adds `topRowReachWU` + `bottomRowReachWU` (default 0.25, bounds [0,1], run-gated, live in Test/Play per the 4bj9 pattern) and `guardCountMode` (`collision` | `gesture`, default `collision`, run-gated); existing collider fields (incl. `enforceAuthoredDirection` + `directionToleranceDegrees`) untouched — they now scope to uppercut/hook per §3.1.
- Migration/defaults: new imports default to `boxing_collider_v1` (it IS the boxing option); existing Lanes/Grid packages keep their stored variant. No score migration; new partition local-only, unranked initially.

## 7. Calibration impact
No calibration change. The T-pose calibration already captures the shoulder midpoint (envelope vertical center, `body-grid-service.js:961`) and wrist span (width scale). The reach mapping is a pure derivation at render/judge time from existing `calibration.bounds` (`AeroCalibrationSnapshot.bounds`, `body-grid-contracts.js:90`). No new pose/landmarks/hold. (The 1 WU slider end equals the existing full row pitch, so the mapping scales per-player calibration exactly like today's full-grid mapping.) Gesture mode consumes live wrist/elbow/nose landmarks already delivered by the pose adapter — no new input.

## 8. Test plan (mirrors Flow Colliders shape)
**Unit / deterministic gameplay:** reach row Y exact at top/bottom ∈ {0, 0.25, 0.5, 1.0} (center row = shoulder anchor exactly; 1.0/1.0 equals today byte-for-byte; 0/0 = shoulder level); collision counting per punch kind at each reach row (tangent/outside/inside, stationary wrist + arriving beat, swept crossing, 149/150/>150ms gaps, 149/150ms freshness); timing −181/−180/0/+180/+181ms, one event/one Count, no dwell repeats, miss only past late boundary; **direction per family (toggle ON): uppercut requires entry direction up within 45°, hook requires horizontal-toward-center within 45°, wrong direction = `wrong_direction` miss; STRAIGHT counts on pure overlap in BOTH toggle states**; **guard collision mode: left/right side-ownership per authored cell (crossed_guard honored), both wrists required, one Count per guard, miss only past late boundary; guard gesture mode: the five-condition Godot port with fixture poses exactly at/beyond each threshold (0.20/0.12/0.15), wrist-above-elbow convention verified against web y-down coords, missing landmark = no gesture**; chords (simultaneous L+R from one batch, staggered needs later contact, deterministic permutations); hazards (nose interval contact/coverage, one break per episode, wrist pass-through legal, avoided/unevaluated_tracking); recovery (the 16-case adversarial matrix); **center columns: no emitted punch or guard target cell in column 0 or 3, incl. a hostile chart that forces the old edge-pair fallback (must drop via `guard_no_legal_pair`)**; mode isolation (Flow/Lanes/Grid byte-compatible, no regression; reach/guard-mode mid-run change rejected); diagnostics (approved semantic codes only).
**Renderer / browser:** reach pixel oracle (top row above center by exactly `topRowReachWU`, bottom below by exactly `bottomRowReachWU`; wrist marker at shoulder anchor projects onto the center-row line; Aero + Camera env, 18px+32px); presentation (target Y span = top+bottom reach, grid tiles only the three reach rows, track/tiles/floor unchanged, sky prelude applies to punches); mode selection UI (selector shows exactly the Flow + Boxing labels; hidden Lanes/Grid absent from the selector but existing packages still play their stored variant); Game Setup (exact bounds/defaults for the two reach sliders + guard mode, live, run-gated negative control); real-map browser (Boxing vs Flow, identical timing, only Y/presentation differ, zero console noise).
**Privacy / telemetry:** deep-scan snapshots/events/iframe/storage/logs for forbidden coordinate/collider/calibration/frame fields (gesture mode emits no landmark coordinates — semantic only); bounded public counts; exact partitioning; instance isolation.
**Physical (Derrick, post-build):** Boxing (collider) vs Flow on the same songs; reach-slider tuning pass (`topRowReachWU`/`bottomRowReachWU`) at normal stance until top-row uppercut and bottom-row hook feel right; guard feel in both modes (collision vs gesture); direction-toggle feel on uppercut/hook; values then locked + sliders hidden for the follow-up successor.

## 9. Open questions — ALL ANSWERED (Derrick, 2026-09-11)
1. **Band width** — DECIDED: two independent sliders (top row X above shoulder, bottom row X below), each 0 = level with shoulder / 100% = 1 world unit; defaults 0.25/0.25; live, then lock + hide after his tuning. PLUS: punches/guards must not appear outside the center columns (§11). (§2.2)
2. **Direction enforcement** — DECIDED: the existing toggle + 45° tolerance applies to uppercuts and hooks; straights are always touch-only (future "touch + straight gesture" noted, not built). (§3.1)
3. **Guards** — DECIDED: guards still count; two-mode toggle: **collision** (default — both wrists contact their authored guard cells) / **gesture** (Godot guard-gesture port, §10 — NOT implemented in the web version yet; port is part of this lane).
4. **100ms straight hold** — DECIDED: drop. (§3.6)
5. **Shipping shape** — DECIDED: collider is the default `Boxing` option; Lanes/Grid hidden. (§1/§5)

## 10. Guard gesture port — Godot source FOUND (verified 2026-09-11)

The Godot guard gesture exists and is well-formed in `aerobeat-input-camera-tracking/src/detectors/pose_detector_substrate.gd`: `_process_guard` at line 2644, constants at lines 65–67, config via `_get_guard_config()` (profile-configurable: `enabled`, `max_wrist_separation_x`, `max_wrist_separation_y`, `max_wrist_nose_distance`). It is **not** implemented in the web version yet — the port is part of the z2tx lane.

Exact Godot condition (candidate = ALL of the following; requires all seven anchors present — nose, both shoulders, both elbows, both wrists):
- `|leftWrist.x − rightWrist.x| ≤ max_wrist_separation_x` — default **0.20**
- `|leftWrist.y − rightWrist.y| ≤ max_wrist_separation_y` — default **0.12**
- `distance2D(leftWrist, nose) ≤ max_wrist_nose_distance` — default **0.15**
- `distance2D(rightWrist, nose) ≤ max_wrist_nose_distance` — default **0.15**
- each wrist **above its own elbow** (Godot as written: `wrist.y ≥ elbow.y` in its normalized frame)

Note: there is **no elbow-straightness/angle check** — the arm condition is "wrists above elbows" (folded arms, fists up), which IS the guard posture. (Derrick's recollection of "straight enough" is close; the actual test is relative wrist/elbow position.)

Web port (gesture mode): evaluate the same five conditions on the web's normalized camera/preview landmarks (MediaPipe, y-down) per measured frame; flip the wrist-vs-elbow comparison to the web y-down convention and verify with a pose fixture. The guard COUNTS when the gesture state is true at any time within the beat's instantaneous-checkpoint window (guard beats already carry `checkpoint {kind:"instantaneous", freshnessMs, timingWindowMs}`, `converter.js:300`). Thresholds ride in the guard profile config (port the three constants + `enabled`); no new calibration. Diagnostics: semantic codes only.

## 11. Column reachability (Derrick: "punch or guard beats shouldn't appear outside the center columns")

Verified 2026-09-11 against `aerobeat-web-content-authoring`:
- **Punches: ALREADY center-only.** `spatialTarget` (`converter.js:309`) assigns the column by hand: left hand → column 1, right hand → column 2 (the two center columns); hooks cross to the opposite center column (left hook → column 2, right hook → column 1); uppercuts additionally clamp to rows 0–1. Columns 0 and 3 are never punch targets.
- **Guards: center-preferred, but the fallback list touches the edge columns.** `chooseGuardPair` (`converter.js:306`) sorts candidates by distance to the center pair (pairMid → 5.5 = cells 5/6), but the candidate list `guardPairs` (`definitions.js:16`) is all nine adjacent pairs: `[[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[8,9],[9,10],[10,11]]` — including `[0,1]`, `[2,3]`, `[8,9]`, `[10,11]`, which place one guard cell in an outer column when the center pairs are blocked or unreachable.
- **Fix (part of the z2tx lane):** restrict the guard candidate pairs to the three fully-center pairs — **`[1,2]`** (top row), **`[5,6]`** (center row), **`[9,10]`** (bottom row). If none is legal the guard drops with the existing `guard_no_legal_pair` trace (already the fallback at `converter.js:298`) — slightly more drops, every chart stays playable. Golden fixture: no emitted punch or guard target cell in column 0 or 3, including a hostile chart that forces the old edge-pair fallback.
