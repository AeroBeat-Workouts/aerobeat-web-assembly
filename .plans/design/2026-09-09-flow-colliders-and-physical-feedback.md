# Flow Colliders and Raw 0.0.48 Physical Feedback

**Status:** RESEARCH / DESIGN COMPLETE — ALL DERRICK DECISIONS RECORDED; IMPLEMENTATION PLAN AWAITS APPROVAL
**Date:** 2026-09-09
**Owning repo:** `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`
**Physical authority:** immutable raw `0.0.48` (rejected; no PASS)
**Umbrella Bead:** `aerobeat-web-assembly-pver`
**Research Beads:** `fxc0`, `91yl`, `w9t3`, `w75c`, `mo2d`
**Active-plan context:** `.plans/2026-09-02-handcrafted-3d-gameplay-visuals-and-environment.md`

## Goal

Answer Derrick's raw `0.0.48` questions without changing production code, release bytes, serving, or physical-review state. Define an implementation-ready architecture and explicit remaining decision/physical-tuning gates for renaming the existing Flow presentation to **Flow Grid**, adding an experimental **Flow Colliders** ruleset with the same presentation, removing the rejected Arrival group numbers and Attention halo experiments, replacing the current one-line Next-up ribbon, and repairing the unusable Game Setup number-control UX.

## Research boundary

This document is an inspection/design result only. It does not authorize source edits, package or raw builds, serving changes, publication, score migration, or a PASS claim. Raw `0.0.48` remains immutable and physically rejected. `fxc0`, `w9t3`, `w75c`, and `mo2d` remain open for Derrick approval and later implementation. Research-only `91yl` may close because the linger question is conclusively answered below.

## Current architecture and terminology

- The product-facing selector currently labels `flow_grid_v2` as `Flow`, while internal mode, package, chart, fallback, renderer-presentation, tests, and telemetry use stable `flow` / `flow_grid_v2` identities (`src/gameplay-mode-selection.js`; sibling UI `src/elements/aero-product-presenters.js`; gameplay `src/session-coordinator.js`; content `src/package-content.js`).
- Existing Flow is not literal mesh collision. `matchFlow()` selects the authored hand's wrist, requires its calibrated 4 × 3 cell to equal the note placement, and requires a measured cell-entry event; directional notes additionally require that entry's direction (`aerobeat-web-gameplay/src/session-coordinator.js:1124-1159`).
- Existing Flow walls already use measured calibrated **nose** segment collision over their complete time interval, with at most a `150 ms` continuous sample gap. Overlapping walls share one contact episode and one combo-break consequence; final outcomes are `contact`, `avoided`, or `unevaluated_tracking` (`session-coordinator.js:598-687`; `flow-obstacle-collision.js`).
- Flow bombs are currently rendered but ignored by Flow scoring (`session-coordinator.js:696-699`; assembly `src/session-render-projection.js:97-99,170-176`).
- Renderer presentation is selected independently from scoring ruleset (`src/gameplay-mode-selection.js:44-49`), so Flow Grid and Flow Colliders can intentionally share the exact `flow` visual presentation.

## Terminology decision

### Existing mode: rename to Flow Grid

Change **visible product copy only** from `Flow` to `Flow Grid`. Retain internal/package identities `mode:"flow"`, renderer presentation `"flow"`, ruleset `flow_grid_v2`, current package/chart hashes, old commands, and old score partitions. This is a non-destructive clarification, not a schema rename.

### New mode: Flow Colliders

Add a distinct experimental scoring ruleset identity, recommended `flow_colliders_v1`, derived from the same authored Flow chart. It uses the identical notes, colors, GLBs, obstacles, timing rows, track, camera, and renderer `flow` presentation. Only input matching, hazard outcomes, and score identity differ.

Do not silently reinterpret `flow_grid_v2` as collision gameplay. Flow Grid remains the selector/package/ruleset compatibility fallback for old hosts. Scored Flow Grid still requires measured calibrated camera input; only audio-only Visual Test can present synthetic unscored outcomes without camera. Flow Colliders initially remains local-only/unranked until its physical and privacy gates pass.

## Recorded Derrick decisions

Authoritative Bead comments recorded during this research slice settle these points:

- wrists evaluate authored notes and bombs; nose evaluates walls;
- bomb wrist contact and wall nose contact are negative outcomes;
- direction enforcement is a gameplay setting: default **overlap-only**, optional measured authored-direction judgement;
- the neutral 4 × 3 grid defaults hidden in both Flow Grid and Flow Colliders while remaining available;
- implement both full-lane repeated guidance variants for physical comparison: **song beat-grid bands** and **target-arrival bands**, selectable in settings;
- use the recommended swept calibrated 2.5D model footprint;
- one genuine wrist sweep may hit every genuinely intersected exact-same-time chord member; staggered targets require a later contact, and a simultaneous hazard still applies one deduplicated combo break after note scoring;
- require reimport into a successor package contract for Flow Colliders rather than deriving it at runtime from old package bytes;
- preserve the full `180 ms` late-hit window but expose it in bounded settings for both Test and Play; pending notes continue moving while still hittable rather than clamping at the plane;
- force the 4 × 3 grid hidden once during v2 → v3 migration, not merely on fresh/reset setups;
- expose bounded collider radius and optional direction tolerance in both Test and Play while physically tuning, then lock accepted production defaults.

The design below incorporates those decisions rather than asking Derrick to decide them again.

## Flow Colliders design choices

### Choice A — Swept calibrated 2.5D colliders (recommended)

Treat fresh calibrated wrist/nose landmarks as small logical colliders in the canonical athlete-grid XY plane. Treat each approaching note as its canonical target collider crossing the athlete plane over the authoritative timing window. Clip the segment between consecutive measured samples against the target collider to avoid tunneling at the production 15 fps inference ceiling; interpolate the candidate contact song time. Directionless notes require contact only. Directional notes use the selected session-locked setting: default overlap-only also requires contact only; optional authored-direction mode additionally matches the measured wrist vector.

**Advantages:** literal physical contact semantics; sub-cell precision; deterministic under viewport/DPR/camera parallax; reuses the wall segment-clipping model; stationary wrists can still be struck by an approaching directionless note; no screen-space coupling.

**Costs:** requires private continuous wrist sample history and carefully tuned logical radii; new simultaneous-contact matching and tests; directional tolerance needs a physical gate.

### Choice B — Cell-volume collision

Treat the complete authored 4 × 3 cell as the note collider. A hit occurs when the owned wrist occupies or enters that cell during the timing window; optional authored-direction mode additionally retains measured entry-direction matching.

**Advantages:** smallest gameplay change; robust at low camera resolution; close to current Flow Grid behavior.

**Costs:** calling this a collider mode would overpromise—edge proximity and visible mesh overlap do not matter; it cannot distinguish two targets inside one cell and remains discontinuous at cell boundaries. This is better understood as Flow Grid, not the new mode.

### Choice C — Rendered screen-overlap colliders

Use projected marker/mesh overlap in CSS or framebuffer coordinates.

**Advantages:** the screenshot appears to show exactly what is judged.

**Costs:** judgement changes with viewport, DPR, camera parallax, FOV, clipping, and marker apparent-size policy; live-video and canonical-grid registration can diverge; renderer state would leak into scoring. It is harder to make deterministic, private, or portable. **Reject.**

### Recommendation

Choose **A**. Keep collision truth in calibrated canonical XY plus authoritative song time, and project markers/targets through the same camera only for presentation. Never feed screen coordinates, parallax offsets, marker CSS size, or PlayCanvas collision into gameplay.

## Recommended Flow Colliders semantic contract

### Logical geometry and calibration

- The current trusted pose contract supplies calibrated X/Y but no trustworthy athlete depth. V1 must therefore be described as **2.5D swept contact at the athlete plane**: audio time supplies the target's Z/crossing time and measured pose supplies X/Y. Do not claim monocular mesh-to-mesh 3D hand depth.
- Use existing measured-only calibration bounds, athlete mirroring, source identity, and T-pose lifecycle. Do not add a second camera or screen calibration.
- Add private previous/current measured samples for `left_wrist`, `right_wrist`, and `nose`, including only the minimum data needed for segment clipping. Reject duplicate, rollback, source-change, calibration-change, nonfinite, invalid, or stale samples.
- Maximum interpolated segment gap is `150 ms`, matching current wall continuity and the judgement freshness contract. A larger gap starts a new segment and cannot fabricate contact across missing evidence.
- Collider dimensions are logical world/grid values, not the 32 CSS px marker size. Start with an inscribed target collider and a small wrist inflation; expose strict bounded collider radius and optional direction-tolerance settings in both Test and Play for Derrick's physical comparison, then lock accepted production defaults. Do not infer collision from GLB visual bounds.
- Camera parallax remains visual-only. The canonical target and landmark coordinates used by collision never move when the production camera moves.

### Body-part ownership

| Authored object | Owning collider | Non-owner behavior |
|---|---|---|
| Left note | Left wrist | Right wrist and nose cannot hit it |
| Right note | Right wrist | Left wrist and nose cannot hit it |
| Directionless note | Authored wrist | Contact is sufficient; no motion-direction requirement |
| Directional note | Authored wrist | Default overlap-only contact; optional setting also enforces authored direction |
| Flow wall | Nose | Wrists may pass through without wall consequence |
| Bomb | Either wrist | Nose does not detonate it |
| Arc/burst | Unsupported in this first ruleset | Fail/omit exactly as current source policy; do not invent collision semantics |

Elbows and shoulders remain calibration/safety evidence only and never become gameplay colliders in v1.

### Directional and directionless notes

- A candidate hit must have an interpolated collider contact time inside the inclusive authoritative `center − 180 ms … center + 180 ms` window.
- Directionless notes hit on valid owned-wrist contact. A stationary wrist may hit because the note itself crosses the athlete plane; requiring a wrist cell-entry would incorrectly preserve Flow Grid semantics.
- Directional notes default to the same overlap-only contact rule Derrick selected. An optional **Enforce authored direction** gameplay setting additionally requires the owned wrist's bounded measured motion vector at contact to match the authored eight-way direction. Use the existing athlete coordinate convention and no second mirror. The setting is bound at run configuration (not mutable mid-run), and its direction tolerance/identity participates in the score partition.
- A contact can resolve an event once only. Continued overlap never creates repeated score.
- No valid contact by the end of the late window becomes one miss when the gameplay timeline first advances beyond that boundary. Collision processing never pauses or rewinds transport to wait for a frame.

### Bomb and obstacle behavior

- Walls retain their current continuous nose-contact contract: interval coverage, swept clipping, overlapping contact episode deduplication, one combo break per episode, and `contact` / `avoided` / `unevaluated_tracking` outcomes.
- In Flow Colliders, bombs become instantaneous hazards instead of ignored visuals. Per Derrick's decision, collision by either wrist during the inclusive `center − 180 ms … center + 180 ms` collider window creates one negative `contact` outcome and one combo break. After `+180 ms`, complete fresh evaluated passage without contact is `avoided`; insufficient continuous wrist coverage is `unevaluated_tracking`. Nose does not own bombs. Bombs never award a note hit, consume a guidance cue, or use note hit/miss feedback.
- A hand intentionally passing through a wall remains legal; otherwise ordinary arm motion would make walls unusable. Nose is the v1 proxy for head/body avoidance, preserving the shipped wall contract.
- Hazard outcomes must remain separate from note judgements. Do not emit synthetic `Great`/`Miss` for walls or bombs.

### Simultaneous contacts

- Evaluate one measured frame/segment as an atomic batch. First derive every valid event/contact candidate; then commit deterministic event outcomes and one deduplicated hazard consequence per contact episode. Array iteration order must not change results.
- Left and right wrists may hit simultaneous left/right chord members independently.
- Recommended: one wrist segment may hit every **exact-same-timestamp** authored chord member it genuinely intersects; do not retain Flow Grid's single generic-`note` `consumedActions` rejection for that chord. Outside one exact arrival group, the earliest contact wins for that wrist's continuous contact episode so one long sweep cannot farm staggered notes. Each authored event still resolves only once. Exact duplicate same-cell/same-time events share the same physical contact and preserve authored scoring identity.
- A note hit and bomb/wall contact at the same interpolated timestamp both remain recorded. Recommended score ordering is transactional: award valid note events, record all hazard outcomes, then apply one final combo break for the hazard episode. No outcome disappears because another was processed first.

### Confidence, freshness, and tracking gaps

- Retain the input package's required per-landmark confidence threshold (`0.5`) and gameplay freshness/gap ceiling (`150 ms`). Do not expose confidence as a user tuning knob.
- Only measured current-generation evidence may score. Prediction, duplicate frames, rollback, stale evidence, mismatched calibration/source, or invalid bounds cannot collide.
- A transient invalid/stale frame yields no fabricated contact. The audio-authoritative timeline continues until the existing tracking-safety state pauses the run; unresolved notes may therefore miss with bounded semantic diagnostics. Once the existing safety pause engages, audio/gameplay freeze together and the existing recovery calibration/countdown contract applies.
- `unevaluated_tracking` is permitted for hazards whose complete evaluation interval lacked coverage. Notes retain one miss with bounded diagnostics such as `no_input`, `stale_input`, `calibration_mismatch`, `wrong_collider`, or `wrong_direction`; diagnostics must not include coordinates, confidence, frame IDs, or distances.

### Scoring and timing

- Retain `180 ms` as the default Flow timing bound and current scoring arithmetic for normal notes. Expose the late-hit window within strict bounded settings in both Test and Play for physical tuning; bind its value at run start and include it in score identity. Use interpolated contact song time as evidence time/timing offset; use the audio-authoritative gameplay timeline as commit time.
- Hit: normal hit points/combo. Miss: normal miss count/penalty/combo reset. Bomb/wall contact: no hit points, one hazard counter, one combo reset per episode. `avoided` and `unevaluated_tracking` do not award hit points.
- Flow Grid and Flow Colliders require separate score partitions because ruleset identity and matching semantics differ. The collision profile identity (radii, selected overlap-only versus authored-direction mode, direction tolerance, and algorithm version) must participate in local score identity.
- Flow Colliders remains unranked/local-only initially. Promotion to ranked is a separate product decision after target-device QA.

### Continuous transport and visual feedback

- Contact derives from song-time interpolation between consecutive measured samples, not render delta. The display loop continues at browser cadence and the CV ceiling remains 15 fps.
- A target remains pending through the inclusive late window. If it becomes a miss, existing same-ID gray/moving feedback applies; no disappear/reappear or replacement ID is introduced.
- Visual Test has no camera/CV and therefore cannot validate physical collisions. It may keep its explicitly synthetic alternating render outcomes for Flow Colliders presentation, but must label them as unscored visual simulation.

## Why missed beats visibly linger before continuing (`91yl`)

### Exact observed path

1. Gameplay tries a hit inside the authoritative `±180 ms` timing window. It records a miss only when `timelinePositionMs > center + 180 ms` (`aerobeat-web-gameplay/src/session-coordinator.js:690-705`; contracts `prototypeJudgementDefaults`).
2. Assembly keeps an unresolved target visible while `center + timingWindowAfterMs >= nowMs`; synthetic Test commits odd misses at exactly `center + 181 ms` (`src/session-render-projection.js:6-12,102-119`).
3. Renderer deliberately maps every unresolved post-center target to `Z=0`, preserving the authored color through the late window. Once the miss judgement arrives, it starts the same ID gray at `Z=0`, then moves it at `.006 world units/ms` for the existing `350 ms` feedback life (`aerobeat-web-renderer/src/gameplay-scene-model.js:162-185`).
4. README line 48 explicitly confirms the unresolved crossing freeze through the bounded late window. Its current shortened miss sentence says the beat turns gray at that position for `350 ms` and does not clearly state the landed forward movement; the active plan (`1735`, `1765`, `1784`) and renderer tests are the precise motion authority. README wording should be corrected in a later approved documentation/code slice.

### Conclusion

The visible pre-miss linger is **intentional**, not a transport stall: it is the late-hit grace period. Expected duration is about `180 ms` plus at most the next gameplay/display advancement needed to observe `>`; synthetic Test uses `181 ms` exactly. Audio and the gameplay timeline continue throughout. The subsequent gray target movement is separate feedback and lasts at most `350 ms` from commit.

Derrick selected the presentation-only correction: retain the full default `180 ms` late-hit eligibility, expose the late window within strict settings bounds for both Test and Play, and stop visually clamping pending notes at `Z=0`. They continue moving past the plane while still eligible, then gray at miss commit and continue the existing same-ID feedback path. Research question `91yl` is conclusively answered and may close without source changes.

## Why the Game Setup number inputs are unusable (`w9t3`)

### Confirmed primary CSS cause

All six checkbox rows and all three number rows use `.environment-option`. The shadow CSS applies `.environment-option input { block-size:20px; inline-size:20px; margin:0 }` to **every input type**, not only checkboxes (`src/index.js:1980,2137`). Consequently each number field is forced into a 20 × 20 square. Its text and native spinner affordance are clipped into the same tiny box, explaining the square/untypable appearance and unusable hover steppers. This is a high-confidence direct cause.

### Event/state contributors

- Game Setup listens to both `input` and `change`, but explicitly applies Game Setup values only when `event.type === "change"` (`src/index.js:860-868,1860-1865`). Typing therefore has no live commit/validation feedback until blur/Enter; spinner interaction depends on a usable native control and eventual change.
- The spawn-distance number is intentionally disabled until **Override spawn distance** is checked (`src/index.js:1982`). That explains a truly noninteractive Spawn field when override is off, but does not explain the enabled camera fields.
- The commit path uses `Number(input.value)`, so clearing becomes `0`: spawn distance rejects it because its minimum is `3`, but both camera ranges accept `0` because their minimum is `0`. Other invalid/out-of-range commits reject and immediately rerender stored authority (`src/index.js:1981`; `src/game-setup-coordinator.js:35-45`). With the value clipped or asynchronously overwritten, this can feel as if typing never worked.
- `renderPresenters()` also synchronizes authoritative values back into the stable controls during unrelated async presenter refreshes. Because edits do not commit until `change`, such a refresh can overwrite a focused, not-yet-committed draft. The nodes are not reconstructed and pointer/keyboard delegation does not suppress their defaults, so those are not primary causes.

### Recommended implementation scope

- Restrict 20 × 20 sizing to `.environment-option input[type=checkbox]`.
- Give number rows a distinct class/layout; use a native number control with at least 44 px block target and approximately 8–10 character inline width, visible text/caret/spinners, `min-inline-size:0`, and visible focus.
- Preserve browser-native number behavior (`appearance:auto`) and label the disabled Spawn field with its dependency on the override checkbox.
- Keep a local draft during `input`; commit only `valueAsNumber` when `validity.valid`, finite, in-range, and step-valid on `change`/Enter. Invalid blur restores the stored value with a static inline error rather than treating empty text as zero or fighting intermediate edits. Unrelated presenter refreshes must not overwrite a focused dirty draft.
- Browser tests must use actual keyboard fill/select-all, Tab/Enter commit, native stepUp/stepDown or spinner pointer interaction, invalid/empty recovery, focus visibility, direct/iframe, desktop/touch, and the disabled/enabled Spawn transition. Programmatic `.value=` alone is not an adequate oracle.

## Complete removal of Arrival numbers and Attention halo (`w75c`)

Do not merely hide the controls. Remove both experiments end-to-end in the next source successor:

1. **Persisted setup:** create strict Game Setup v3 without `arrivalGroupNumbersEnabled` or `attentionHaloEnabled`. Replace `nextUpRibbonEnabled` with `guidanceBandMode:"off"|"song_beat_grid"|"target_arrivals"`; valid v2 `true` migrates to `target_arrivals` (closest current semantics), `false` to `off`. The two rejected booleans are discarded regardless of value. Invalid/newer records reset atomically. Fresh v3 defaults `showGameplayGrid:false`.
2. **UI:** remove both labels, checkboxes, intent handling, allowlists, accessibility copy, and presenter/browser fixtures.
3. **Assembly projection:** retain only the private stable group identity/time needed by Next-up. Remove absolute arrival ordinals if no other feature consumes them; never export group/member identity.
4. **Renderer config:** replace the strict experiment schema with a successor that has neither boolean. Remove halo and number config/parser fields, scene kinds, draw-order layers, entity pools/materials, glyph text/resources, diagnostics, and associated tests. Do not keep a dormant legacy renderer path.
5. **Documentation/telemetry:** remove claims and inventories for both visuals. Raw `0.0.48` and older immutable releases remain untouched historical evidence.

### Grid migration decision

Fresh installs/default resets use hidden 4 × 3 grid (`showGameplayGrid:false`). Valid stored v2 records also force the grid hidden once during v3 migration while discarding the rejected cue fields. Users may explicitly re-enable the grid afterward.

## Next-up ribbon redesign (`mo2d`)

### Current limitation

The current renderer creates one thin neutral transverse strip at the earliest unresolved group's authoritative Z across the lane span (`aerobeat-web-renderer/src/gameplay-scene-model.js:190-212`). It marks only one target-arrival plane near the goal and leaves the rest of the approach lane without rhythmic context.

### Derrick-selected comparative variants

Replace the boolean ribbon with one settings choice: **Off / Song beat-grid bands / Target-arrival bands**. Only one guidance grammar renders at a time, preventing stacked clutter while allowing Derrick's requested physical comparison.

#### Song beat-grid bands

- Use the canonical beat-to-timeline mapper to place a thin full-lane band at each exact whole-song-beat boundary throughout the visible normal-spawn lead. Tempo changes/stops must map through existing timeline authority; do not estimate constant BPM in the renderer.
- Do not assume a 4/4 downbeat or invent measure accents unless source time-signature authority is added later. Every whole beat has the same neutral treatment.
- Bound the visible inventory (recommended maximum 16 bands), cull from farthest first if necessary, and coalesce only when two projected bands would be visually indistinguishable at the active camera—not by changing timing truth.

#### Target-arrival bands

- Place one thin full-lane band at each upcoming unresolved actionable arrival-group timestamp throughout the visible lead, preserving exact simultaneous chord grouping. Bombs, walls, squats, weaves, resolved groups, and synthetic feedback never create bands.
- Bound the visible inventory (recommended maximum 12 bands), prioritize nearest upcoming groups, and never add numbers, member glyphs, or next-three halos. A group remains represented until every member is terminal.

#### Shared visual contract

- Bands use a neutral pale-cyan/white, low alpha, no song-color replacement, text, numbers, halo, shadows, pulse, bounce, or flash. Actual targets retain full color/shape/depth priority.
- Render on/just above the track, depth-test on, depth-write off, behind live targets and outside feedback. Fade or suppress bands within the red/yellow/green active timing core so goal-area readability stays clear.
- Placement is a pure function of authoritative timeline, camera, and visible lead, so reduced-motion rendering is unchanged. Seek, pause/resume, restart, content/mode generation, and spawn-lead changes rederive bands atomically.
- Bands are renderer-only, non-colliding, non-scoring, non-persistent, and absent from snapshots/events/messages. Diagnostics may expose bounded `{mode, visibleBandCount, culledBandCount}` only—never timestamps, event/group IDs, or coordinates.

This implements repeated whole-beat guidance across the full lane in two intentionally comparable forms without simultaneously drawing both or reviving the rejected numbers/halo.

## Compatibility and migration contract

- Visible selector/HUD/copy: `Flow` → `Flow Grid` everywhere user-facing. Internal `flow_grid_v2` and renderer `flow` remain stable.
- Add `flow_colliders_v1` to contracts, gameplay validation, UI selection, host command validation, tests, and bounded public ruleset identity. Keep it distinct from `flow_grid_v2`.
- Flow Colliders requires reimport into a successor package contract with a distinct ruleset and score identity. Existing Flow packages remain valid Flow Grid packages but are not silently promoted or reinterpreted as Flow Colliders.
- Flow Grid remains first selector/package fallback for old hosts, unsupported content, and malformed/newer local setup. This is not a no-camera scoring claim: scored Flow Grid and Flow Colliders both require measured calibrated camera input; audio-only Visual Test remains synthetic/unscored. Do not auto-select Colliders for an existing session.
- Game Setup v3 migrates valid v2 retained spawn override, camera ranges, and parallax; it forcibly writes `showGameplayGrid:false` once during migration. `nextUpRibbonEnabled:true` becomes `guidanceBandMode:"target_arrivals"`, false becomes `off`; rejected number/halo fields are discarded. Fresh defaults: grid hidden in Flow Grid and Flow Colliders, guidance off, parallax off, spawn override off.
- Do not migrate or merge score/history between Flow Grid and Flow Colliders. The new mode begins a new local-only partition.
- Existing raw releases remain byte-immutable; all compatibility work belongs to a separately approved source successor.

## Privacy contract

Collision evaluation stays inside the connection-owned input → gameplay graph. Never expose or persist:

- landmark coordinates, collider centers/radii, trajectories, segment endpoints, distances, velocity vectors, confidence values, raw/body-grid bounds, calibration IDs, frame/source IDs, or per-contact episodes;
- generated per-band group/member/event IDs, mapped beat timestamps, individual band coordinates, or retained per-band renderer instances/history.
- any of the above in public snapshots, `aero-game-event`, iframe messages, localStorage, package identity, renderer `describe()`, logs, network, history, or performance evidence.

The strict local Game Setup may persist only the selected scalar `guidanceBandMode`. Private renderer diagnostics may retain only the already-bounded `{mode, visibleBandCount, culledBandCount}` aggregate described above; these exceptions contain no per-band identity, timestamp, coordinate, or history. Public surfaces may retain bounded existing mode/ruleset identity, standard hit/miss totals/latest semantic result, score partitions, aggregate wall/bomb contact/avoided/unevaluated counts, and accessibility mode. New public diagnostics, if any, are bounded semantic codes only. A local profile-only performance recorder may count aggregate collision candidates/checks and CPU duration, but not event/body identities or geometry.

## Test and telemetry contracts

### Unit / deterministic gameplay

- Tangent/outside/inside wrist-to-note collision; stationary wrist plus approaching note; swept crossing between 15 fps samples; exact `149/150/>150 ms` segment gaps.
- Timing boundaries `−181/−180/0/+180/+181 ms`; interpolated contact time and timing offset; one event/one judgement; no dwell repeats.
- Default overlap-only accepts owned-wrist contact regardless of arrow; optional authored-direction mode covers all eight vectors, tolerance/minimum-travel edges, wrong direction, run-locking and distinct score identity; also test wrong/opposite hand, directionless contact, mirror convention, duplicate/rollback/future/stale/calibration/source invalidation.
- Simultaneous left/right chord, same-wrist multi-target geometry, duplicate same-cell events, note plus bomb, note plus overlapping walls, deterministic event-order permutations.
- Wall interval contact/coverage/outcomes and one consequence per overlapping episode. Bomb contact/avoidance/unevaluated policy. Arcs/bursts fail/omit as specified.
- Flow Grid behavior and score identities remain byte/behavior compatible; Flow Colliders partition remains distinct and unranked.

### Renderer / browser / physical

- Flow Grid and Flow Colliders produce identical canonical targets, colors, GLBs, timing rows, track, camera behavior, shadows, misses, and grid toggle; only ruleset/scoring differs.
- Fresh default grid hidden; valid-v2 migration behavior exact. Arrival numbers and Attention halo absent from DOM, renderer config, scene diagnostics, resources, draw order, storage, and strings.
- Both exclusive guidance modes: tempo-map whole-beat bands and exact actionable target-arrival bands; deterministic full-lead placement, caps/culling, no unsupported measure accents or hazards, active-zone suppression, depth order, reduced-motion parity, and seek/restart/generation/spawn-lead cleanup.
- Actual keyboard and pointer number-control tests as specified above.
- Direct and genuine cross-origin iframe; desktop/mobile portrait/landscape; DPR 1/3; all eight environments and camera background; dense real-map fixtures; zero unexpected console/page/WebGL noise.
- Actual camera target-device tests at low/high motion, edge cells, diagonals, chords, walls/bombs, tracking loss/recovery, and nose parallax extremes. Preserve the existing ABCCBA performance authority; add bounded aggregate collision CPU/candidate thresholds without pose capture.

### Privacy / telemetry assertions

- Deep-scan direct snapshots, events, iframe payloads, local/session storage, package/export bytes, logs, renderer descriptions, and profile evidence for forbidden coordinate/confidence/collider/calibration/frame/group fields.
- Assert public counts are bounded and mode/ruleset partitioning is exact. Assert contact diagnostics contain only approved semantic codes.
- Two instances, disconnect/reconnect, context loss/restore, content swap, restart, terminal replay, and stale async work must not share collision history, guidance-band state, or calibration evidence.

## Derrick decisions resolved

1. **Collider footprint:** swept analytic model-footprint 2.5D collision is approved; screen overlap and full-cell collision are rejected.
2. **Simultaneous scoring:** one genuine sweep hits every genuinely intersected exact-same-time chord member; staggered contacts require a later contact, and one deduplicated hazard combo break follows note scoring.
3. **Package compatibility:** Flow Colliders requires reimport into a successor package contract.
4. **Migration/tuning:** v2 → v3 forces the grid hidden once; collider radius, optional direction tolerance, and the `180 ms` late window remain bounded settings in Test and Play for physical tuning before accepted defaults are locked.

Implementation must be decomposed into separate contract/input/gameplay/content/UI/renderer coder Beads followed by independent QA, source audit, immutable successor authorization, and Derrick physical review. Keep `fxc0`, `w9t3`, `w75c`, and `mo2d` open until that approval/implementation chain completes.
