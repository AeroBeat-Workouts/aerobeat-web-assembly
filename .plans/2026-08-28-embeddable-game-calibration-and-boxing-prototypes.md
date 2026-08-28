# AeroBeat Embeddable Game, Calibration, and Boxing Prototypes

**Date:** 2026-08-28
**Status:** Draft
**Last Updated:** 2026-08-28 17:07 EDT
**Blocked Reason:** None
**Agent:** cookie

---

## Goal

Build and prove a container-responsive `aero-game` Web Component with calibrated athlete-space input, shared 4x3 Flow/Spatial-Boxing presentation, semantic Track Boxing, deterministic prototype map recipes, direct and iframe embedding, and four selectable Boxing prototype combinations without promoting a production winner before Derrick's physical playtesting.

---

## Overview

This is a cross-repository prototype program coordinated from `aerobeat-web-assembly`. Domain behavior remains in its owning repositories: contracts in `aerobeat-web-contracts` and `aerobeat-content-core`; calibrated pose interpretation in `aerobeat-web-input`; browser media in `aerobeat-web-video`; graphics in `aerobeat-web-renderer`; tokens in `aerobeat-web-style`; visible components in `aerobeat-web-ui`; BeatSaver conversion in `aerobeat-tool-content-authoring`; and new content/gameplay runtime packages where those missing owners must be established.

The plan ports the Godot camera-space/athlete-space contract but deliberately does not copy the Godot proving-scene visuals or ambiguous calibration quirks. The web system uses automatic measured-frame T-pose calibration, a hidden athlete-input grid, a separate full-container screen-space playfield, tracking-loss pause/recalibration, and an assembly-owned `aero-game` root suitable for direct controlled-host embedding and public HTTPS iframe embedding.

Boxing remains experimental through this plan. It produces a 2x2 matrix of playable candidates: Semantic Track versus Spatial Grid, each generated from Row-Family/Balanced-Height versus Cut-Family/Source-Height recipes. Prototype scores remain local/test-only. Production promotion, rejected-branch deletion, and public leaderboard policy require a later plan after Derrick reports physical playtest results.

---

## Approved Product and Architecture Decisions

### Coordinate spaces and calibration

- Upstream camera/preview coordinates are normalized top-left; upstream owns preview mirroring.
- Detector geometry may use gameplay-camera bottom-left internally, but the public body-grid contract is athlete-space top-left row-major.
- Camera-facing and athlete-facing columns are explicitly opposed; cell IDs are athlete-space `0..11`.
- The calibrated athlete-input grid is hidden in normal gameplay and visible only for calibration/debug.
- Automatic calibration starts after camera startup; T-pose hold is 4000ms with a 4000ms cooldown.
- Require nose, shoulders, elbows, and wrists individually at confidence `>= 0.5`.
- Use wrist/elbow vertical ratios `<= 0.35` and elbow angle `>= 130deg`.
- Average qualified hold-window samples; no silent bootstrap baseline.
- Require pose release before automatic refire.
- Session-only calibration; invalidate on camera source, mirror, or source-aspect change.
- Keep old geometry until automatic replacement is atomically ready; explicit badge reset invalidates and pauses.
- Out-of-grid anchors retain diagnostics but emit no scoring cell.
- Four cardinal directions only.
- Tracking loss after 500ms invalidates gameplay, dims retained geometry, emits safety state, and requires recalibration.
- Initial start and every pause exit require successful calibration followed by frozen-time `3..2..1..`; tracking loss cancels the countdown.

### Container, embedding, and media

- Public root element is `aero-game`; remove/replace `aerobeat-app` rather than ship parallel roots.
- Root fills the exact parent content box and never assumes `100vh` or browser-history ownership.
- Direct embedding and cross-origin iframe embedding are equal first-class targets.
- Child `aero-game` owns fullscreen requests; iframe parent delegates camera/fullscreen/autoplay.
- Any HTTPS parent may frame and control its own instance after a strict immediate-parent handshake.
- Normalized landmarks and gameplay telemetry may cross the iframe bridge by default; raw camera frames, pixels, screenshots, and media tracks may not.
- Game may request camera itself or accept an injected stream for direct embedding; cross-origin iframe normally requests its own stream.
- Multiple instances may coexist, but one process-level media lease coordinator pauses the current owner before transfer.
- Hidden document/iframe pauses gameplay and inference while retaining camera.
- Element is reconnectable with complete teardown and a fresh runtime graph.
- MediaPipe runtime/model/WASM are self-hosted by default.
- Arbitrary external song assets are allowed; chart/audio require hashes, external audio must satisfy CORS validation, sampled media must satisfy CORS, and cosmetic background failure falls back.

### Presentation and theming

- Render stack: environment, gameplay, HUD, calibration/pause/countdown, optional debug.
- Athlete preference overrides song suggestion, which overrides playlist suggestion, which overrides defaults.
- Themes are versioned serializable tokens with CSS-variable projection and selected direct-embed `::part` hooks; no arbitrary slots.
- Shared `aero-grid-playfield` serves Flow and Spatial Boxing.
- Persistent subtle 4x3 receptors use normalized exact-container layout.
- Arrival vocabulary combines depth scale, grayscale-to-role-color tween, and an osu!-style approach ring closing exactly at beat center.
- Left defaults blue, right green, guard purple, obstacles red with non-color-only hatch; athlete themes may override.
- Punch/Flow targets use shape/icon plus hand color; hit feedback collapses/flashes inward and miss feedback desaturates/dissolves.
- Guard is a connected purple double-cell icon; Crossed Guard has a distinct crossed-hands icon.
- Obstacles are exact red blocked regions, not icons.
- No dedicated reduced-motion mode is in this prototype.
- Visual values are runtime-swappable prototype/theme tokens; scoring values are named between-run profiles; converter values are immutable versioned recipes.

### Flow and Boxing rules

- Flow uses exact 4x3 cells plus expected cardinal directions; Flow obstacles retain their own sustained semantics.
- Semantic Track Boxing uses two bottom-to-top hand lanes, athlete-left on screen-left, semantic action plus timing, and a separate defensive layer.
- Spatial Grid Boxing is grid-only and uses generated locations.
- All Boxing observations are positive evidence; unrequested/false-positive gestures never penalize or suppress requested evidence.
- Offensive and defensive observations may overlap, but authored scheduling forbids guard+punch and punch+punch active windows.
- Guard and Boxing obstacles are instantaneous beat-center state checkpoints; held valid states may satisfy repeated checkpoints.
- Semantic guard samples semantic guard state; spatial guard samples left/right wrists in exact assigned cells from the same fresh measurement.
- Semantic squat/weave samples semantic state; spatial obstacles require a valid nose inside the calibrated grid and outside all blocked cells.
- Fresh checkpoint evidence is at most 150ms old; missing evidence is a miss with `no_input` diagnostics.
- Punch+obstacle and guard+obstacle may coexist when regions are spatially disjoint.
- Guards reserve their full +/-180ms window from punches; punches use a 360ms minimum-center spacing.

### Spatial strike contract

- Standard left straight: column 1, any row; standard right straight: column 2, any row.
- Straight requires frame-level straight qualification plus accepted-subcell occupancy for 100ms; gaps over 150ms break continuity. Timing offset uses the qualification interval start.
- Straight accepts the target base cell plus a centerward half-cell margin represented as explicit 8x6 subcell IDs.
- Standard left hook: target column 2, any row, enter Right from column 1.
- Standard right hook: target column 1, any row, enter Left from column 2.
- Hooks use cell+direction only; semantic hook is shadow telemetry.
- Standard uppercuts: hand-aligned column 1/2, top or middle row, enter Up from the row below.
- Uppercuts use cell+direction only; semantic uppercut is shadow telemetry.
- Outside-to-grid transitions do not score; no synthetic boundary evidence in v1.
- Spatial subrequirement failures are binary misses with detailed diagnostics.

### Guards, obstacles, modifiers, and variants

- Any simultaneous left/right BeatSaver note pair is a guard candidate after current same-hand cluster collapse.
- Preserve legal source guard pair; otherwise relocate deterministically among adjacent same-row pairs.
- Guard relocation order: obstacle/reach validity, source row, source midpoint, grid center, lowest cell ID.
- Standard guards normalize natural hand ordering; Crossed Guard preserves and scores reversed assignment.
- Omit and trace guard when no legal pair exists.
- Obstacles reserve cells across their full +/-180ms interaction window and have priority over punch/guard scoring regions and required approach paths.
- Initial executable map modifiers: No Squats, No Weaves, Any Punch (any family from authored hand); Crossed Guard and Cross-body remain explicit advanced variants.
- Variants are immutable, deterministic import/build products with source-event lineage and separate hash/score identity.
- During pause, already-started/judged objects remain; not-yet-reached objects swap immediately to the selected variant. Composite runs are unranked but retain local/workout results.

### Converter prototype matrix

- Recipe A: source row determines family (`top=uppercut`, `middle=straight`, `bottom=hook`); generated row balances workout coverage.
- Recipe B: source Up cut becomes uppercut; any horizontal cut becomes hook; all other cuts become straight. Source row is preferred target height; bottom uppercuts promote to middle.
- Source color determines hand in both recipes.
- Recipe B records source and normalized inward hook directions separately.
- Dense-note optimizer maximizes retained count, then hand alternation, family balance, source order, and stable event-ID tie-break.
- Reach uses an obstacle-aware 8-direction 8x6 graph: orthogonal cost 1, diagonal cost sqrt(2), maximum rate per difficulty, no hard minimum.
- Initial wrist seeds are cells 5 and 6; guards update both wrist histories; nose history is a safe-cell set.
- All four recipe/ruleset combinations are playable and selectable before gameplay and in pause.
- Shadow results are diagnostic only and never user-facing scores.
- Prototype leaderboard state remains local/test-only.

---

## Non-Goals

- Selecting or promoting the production Boxing adapter/recipe.
- Keeping rejected experimental runtime branches after later promotion.
- Public competitive leaderboards or anti-cheat.
- Threaded WASM/SharedArrayBuffer/cross-origin isolation.
- Safari/Firefox production certification; initial browser target is current Chromium desktop and Android.
- A dedicated reduced-motion gameplay mode.
- Raw camera-frame sharing across iframe boundaries.
- Final tuning values for reach rates, animation curves, row-balance weights, or other intentionally swappable prototype parameters.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Godot body-grid public contract | `/home/derrick/.dsh/projects/aerobeat/aerobeat-input-core/src/interfaces/body_cell_input.gd` |
| `REF-02` | Godot calibration, coordinate conversion, grid/subgrid, and gesture reference | `/home/derrick/.dsh/projects/aerobeat/aerobeat-input-camera-tracking/src/detectors/pose_detector_substrate.gd` |
| `REF-03` | Godot calibrated overlay reference | `/home/derrick/.dsh/projects/aerobeat/aerobeat-input-camera-tracking/.testbed/scripts/flow_grid_overlay.gd` |
| `REF-04` | Godot T-pose progress badge reference | `/home/derrick/.dsh/projects/aerobeat/aerobeat-input-camera-tracking/.testbed/scripts/t_pose_calibration_badge.gd` |
| `REF-05` | Web shared contract owner | `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-contracts/README.md` |
| `REF-06` | Current placeholder body-grid/input router | `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-input/src/index.js` |
| `REF-07` | UI ownership and named-component rule | `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-ui/README.md` |
| `REF-08` | Current assembly root and locked MediaPipe route | `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/README.md` |
| `REF-09` | Browser video/media owner | `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-video/README.md` |
| `REF-10` | WebGL2 renderer owner | `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-renderer/README.md` |
| `REF-11` | Theme/token owner | `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-style/README.md` |
| `REF-12` | Browser audio clock owner | `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-audio/README.md` |
| `REF-13` | Canonical content contract owner | `/home/derrick/.dsh/projects/aerobeat/aerobeat-content-core/README.md` |
| `REF-14` | Existing BeatSaver conversion implementation | `/home/derrick/.dsh/projects/aerobeat/aerobeat-tool-content-authoring/src/services/importers/beatsaver_stage_conversion_service.gd` |
| `REF-15` | Fullscreen API behavior | `https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API` |
| `REF-16` | Camera secure-context and iframe behavior | `https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia` |
| `REF-17` | Permissions Policy behavior | `https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy` |
| `REF-18` | Cross-origin iframe messaging | `https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage` |

---

## DSH Goal

**Goal ID:** None until Derrick approves execution
**Objective:** After approval, execute this plan from `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly` until linked Beads are implemented, independently verified, committed, pushed, and the four prototype combinations are ready for Derrick's physical playtesting; stop before production promotion.
**Max Goal Rounds:** 50
**Continuation Status:** Not Started

---

## Execution and Approval Boundaries

- This plan is not approved for implementation until Derrick reviews it.
- Creating/publishing the currently missing `aerobeat-web-content` and `aerobeat-web-gameplay` repositories is an external GitHub action. Execution must confirm explicit authorization and destination ownership before creating remotes.
- Every repository stays on its current branch unless Derrick directs otherwise.
- Every coder task gets independent QA and final audit evidence. Browser-visible tasks require desktop Chromium and Android secure-context proof where applicable.
- Any discovered change to an approved contract returns to Derrick before implementation silently widens scope.

---

## Dependency and Parallelism Order

1. **Contract/root setup:** Task 1 establishes public shapes; Task 2 establishes the two missing package owners after external-action authorization.
2. **Parallel domain foundations:** Tasks 3, 4, 7, 8, and 9 may proceed in parallel after the relevant Task 1 exports are accepted, with Task 9 consuming accepted style/renderer seams rather than sibling internals.
3. **New runtime domains:** Tasks 5 and 6 follow Task 2 and consume the accepted contract/content/input/audio boundaries.
4. **Assembly integration:** Task 10 begins only after Tasks 3, 5, 6, 7, 8, and 9 have public validated surfaces.
5. **Prototype proof:** Task 11 follows integrated assembly; Task 12 independently verifies; Task 13 audits and hands off.
6. Any cross-repo contract mismatch discovered downstream returns to the owning contract Bead rather than being patched locally.

---

## Tasks

### Task 1: Freeze Cross-Repo Web Contracts and Decision Records

**Bead ID:** `aerobeat-web-contracts-db9`
**SubAgent:** DSH coder subagent, then QA
**Role:** `coder`
**References:** `REF-01`, `REF-02`, `REF-05`, `REF-15`, `REF-16`, `REF-17`, `REF-18`
**Prompt:** In `aerobeat-web-contracts`, define versioned public camelCase contracts and validators for coordinate spaces, calibration/readiness/session/lifecycle, body-grid descriptors/anchors/cell entries, tracking safety, game/session/countdown, content variants, themes, container capabilities, fullscreen, media/asset policy, direct-host events, and iframe messages. Rename the public root element contract to `aero-game` without keeping `aerobeat-app`. Record accepted decisions under `docs/decisions/`. Preserve measured-versus-predicted truth and do not expose vendor-native objects or raw camera frames.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-contracts/src/`
- `aerobeat-web-contracts/docs/decisions/`
- `aerobeat-web-contracts/scripts/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation after repo inspection.

**Status:** Pending

**Acceptance:** Contract checks and browser tests pass; downstream tasks can depend only on public exports; coordinate-space tests lock camera/preview, gameplay-camera, and athlete-space transformations.

---

### Task 2: Establish Missing Web Content and Gameplay Package Owners

**Bead ID:** `aerobeat-web-assembly-48w.1`
**SubAgent:** DSH coder subagent, then auditor
**Role:** `coder`
**References:** `REF-05`, `REF-08`, `REF-12`, `REF-13`
**Prompt:** After explicit external-action authorization, establish canonical `aerobeat-web-content` and `aerobeat-web-gameplay` package repositories using existing AeroBeat web package conventions. Give each strict JSDoc/public-import/component/console validation posture, README ownership boundaries, testbed shape, package exports, Beads, and remote/push verification. Do not put content loading or gameplay session logic in assembly as a shortcut.

**Folders Created/Deleted/Modified:**
- `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-content/`
- `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-gameplay/`

**Files Created/Deleted/Modified:**
- New repository scaffolds and validation files.

**Status:** Pending

**Acceptance:** Both repos exist locally and remotely with clean `main...origin/main`, public package exports, passing scaffold validation, and accepted ownership docs.

---

### Task 3: Implement the Calibrated Athlete-Input and Tracking-Safety Service

**Bead ID:** `aerobeat-web-input-esm`
**SubAgent:** DSH coder subagent, then QA
**Role:** `coder`
**References:** `REF-01`, `REF-02`, `REF-06`
**Prompt:** In `aerobeat-web-input`, replace viewport bucketing with one `AeroBodyGridService` app-singleton boundary. Consume measured frames; implement approved T-pose qualification/averaging/hold/cooldown/release, calibrated geometry, camera-to-athlete conversion, 4x3 and 8x6 mapping, out-of-grid invalidity, hysteresis, four-cardinal entries, semantic and spatial Boxing evidence, checkpoint freshness, straight qualification continuity, transition history, calibration IDs, subscriptions/snapshots, and 500ms tracking-safety state. Preserve separate predicted sample truth and do not let predictions calibrate or satisfy measured prototype evidence.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-input/src/`
- `aerobeat-web-input/scripts/`
- `aerobeat-web-input/fixtures/`
- `aerobeat-web-input/docs/decisions/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Unit/replay tests cover T-pose gates, averaging, release/refire, aspect/padding, mirror/facing transforms, exact corner IDs, out-of-grid behavior, cell/subcell transitions, straight 100ms continuity, guard same-sample evidence, stale samples, tracking-loss pause events, reset/source invalidation, and no bootstrap.

---

### Task 4: Extend Canonical Content and Build Deterministic BeatSaver Prototype Recipes

**Bead ID:** `oc-4up`
**SubAgent:** DSH coder subagent, then Godot QA
**Role:** `coder`
**References:** `REF-13`, `REF-14`
**Prompt:** In `aerobeat-content-core` and `aerobeat-tool-content-authoring`, add durable chart/variant/event lineage, recipe/ruleset/hash/provenance, instantaneous Boxing guard/avoidance checkpoint, spatial strike/guard/blocked-cell contracts, modifier metadata, theme/environment suggestion metadata that does not reintroduce mandatory package-owned environments, and deterministic conversion traces. Implement Recipe A and Recipe B, paired Semantic/Spatial projections, 360ms optimizer, guard relocation, obstacle priority/coexistence, 8x6 reach graph, safe-cell nose history, map modifiers, external chart/audio hash validation, and all four prototype outputs. Preserve Flow contracts and source artifacts.

**Folders Created/Deleted/Modified:**
- `aerobeat-content-core/data_types/`
- `aerobeat-content-core/validators/`
- `aerobeat-content-core/tests/`
- `aerobeat-tool-content-authoring/src/services/importers/`
- `aerobeat-tool-content-authoring/src/docs/`
- `aerobeat-tool-content-authoring/.testbed/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Godot contract/tool suites pass; identical source+recipe produces byte-identical charts and hashes; traces record every emitted/dropped/relocated event and normalization; all four candidates validate; Flow regressions pass; source environment semantics are reconciled explicitly.

---

### Task 5: Implement Web Content Loading, Asset Policy, and Variant Resolution

**Bead ID:** `aerobeat-web-assembly-48w.2`
**SubAgent:** DSH coder subagent, then QA
**Role:** `coder`
**References:** `REF-05`, `REF-09`, `REF-12`, `REF-13`
**Prompt:** In the new `aerobeat-web-content`, validate/load song packages, chart hashes, recipe/ruleset capabilities, theme suggestions, external asset descriptors, CORS/readability policy, fallback backgrounds, map lineage, modifier combinations, and pause-time future-target variant swaps. Preserve past/judged event truth and expose immutable snapshots. Do not own playback, scoring, rendering, or camera logic.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-content/src/`
- `aerobeat-web-content/scripts/`
- `aerobeat-web-content/fixtures/`
- `aerobeat-web-content/docs/decisions/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Tests cover hashes, arbitrary URLs, external-audio CORS rejection, cosmetic fallback, modifier composition, stable lineage, immediate paused-position future swaps, active-event preservation, and unranked composite provenance.

---

### Task 6: Implement Gameplay Session, Rulesets, Scoring, Pause, and Prototype Telemetry

**Bead ID:** `aerobeat-web-assembly-48w.3`
**SubAgent:** DSH coder subagent, then QA
**Role:** `coder`
**References:** `REF-01`, `REF-05`, `REF-06`, `REF-12`, `REF-13`
**Prompt:** In the new `aerobeat-web-gameplay`, implement the minimal gameplay-session coordinator, audio-clock consumption, initial/pause recalibration gates, frozen 3..2..1 countdown, tracking-safety pause, media lease integration contract, positive-only evidence matching, one-action consumption, Flow cell/direction rules, Semantic Track Boxing, Spatial Grid Boxing, checkpoint sampling, straight qualification, binary diagnostics, simultaneous disjoint obstacle+punch handling, local prototype score partitions, recipe/ruleset provenance, and diagnostic shadow evaluation. No public leaderboards.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-gameplay/src/`
- `aerobeat-web-gameplay/scripts/`
- `aerobeat-web-gameplay/fixtures/`
- `aerobeat-web-gameplay/docs/decisions/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Deterministic clock tests cover all four candidates, +/-180ms windows, 150ms freshness, no-input misses, 100ms straight qualification, cardinal entries, checkpoint states, guard/punch exclusivity, disjoint concurrency, action consumption, tracking pause/countdown cancellation, variant swaps, local-only score identity, and diagnostic-only shadows.

---

### Task 7: Harden Media Lifecycle, External Sources, and Instance Leasing

**Bead ID:** `aerobeat-web-video-335`
**SubAgent:** DSH coder subagent, then browser QA
**Role:** `coder`
**References:** `REF-09`, `REF-16`, `REF-17`
**Prompt:** In `aerobeat-web-video`, provide reconnectable per-instance media lifecycle, injected-stream support for direct embeds, late-permission generation/abort cleanup, CORS-aware external media descriptors, background-only versus sampled-media capability truth, synchronous teardown, hidden-page pause support, and the public media-lease seam needed for one active camera/audio owner. Do not move CV or assembly policy into video.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-video/src/`
- `aerobeat-web-video/scripts/`
- `aerobeat-web-video/docs/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Unit/browser tests cover request/injection, transfer, disconnect/reconnect, late permission resolution, track stopping, hidden visibility, external CORS capabilities, fallback behavior, and no retained streams after destroy.

---

### Task 8: Build the Shared Full-Container Gameplay Renderer and Tuning Surface

**Bead ID:** `aerobeat-web-renderer-mm2`
**SubAgent:** DSH coder subagent, then visual QA
**Role:** `coder`
**References:** `REF-03`, `REF-10`, `REF-11`
**Prompt:** In `aerobeat-web-renderer` and `aerobeat-web-style`, implement per-instance full-container/DPR-aware render surfaces, shared 4x3 playfield primitives, Flow and Spatial Boxing targets, connected/crossed guards, obstacle regions, Track Boxing lanes, role icons/patterns, approach scale/color/ring animation, hit/miss feedback, exact normalized layout, theme-token ingestion, and live visual tuning presets. Keep gameplay judgement outside the renderer and keep theme defaults/overrides versioned.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-renderer/src/`
- `aerobeat-web-renderer/scripts/`
- `aerobeat-web-style/src/`
- `aerobeat-web-style/scripts/`
- Both repos' testbeds and decisions docs.

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Browser tests cover arbitrary container aspect/size, DPR caps, resize/fullscreen redraw, exact 4x3 placement, role/icon/pattern distinction, beat-center animation convergence, theme precedence/defaults, live tuning swaps, no camera-space coupling, and clean WebGL disposal.

---

### Task 9: Build Named Calibration, Grid, Gameplay, Pause, Countdown, and Prototype UI Components

**Bead ID:** `aerobeat-web-ui-dpu`
**SubAgent:** DSH coder subagent, then accessibility/browser QA
**Role:** `coder`
**References:** `REF-04`, `REF-07`, `REF-11`
**Prompt:** In `aerobeat-web-ui`, build named `aero-*` presenters for the T-pose badge, calibration composition, shared grid playfield host, semantic Track HUD, Spatial Grid HUD, tracking pause overlay, resume countdown, background environment, fullscreen control, errors/capabilities, and four-way prototype/tuning selector. Components accept public snapshots and emit intent only. Add accessible state announcements, keyboard/touch behavior, narrow layouts, selected `::part` surfaces, and standalone testbed states. Do not put camera, calibration math, scoring, or assembly traversal in UI.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-ui/src/elements/`
- `aerobeat-web-ui/src/screens/`
- `aerobeat-web-ui/.testbed/`
- `aerobeat-web-ui/scripts/`
- `aerobeat-web-ui/docs/decisions/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Named-component rules pass; desktop/390px states cover waiting/holding/cooldown/success/error, dim lost grid, pause/recalibration/countdown, Flow, all four Boxing selectors, fullscreen availability, theme overrides, and no shadow-root integration dependency.

---

### Task 10: Replace the SPA Shell with Reconnectable `aero-game` and Iframe Delivery

**Bead ID:** `aerobeat-web-assembly-48w.4`
**SubAgent:** DSH coder subagent, then integration QA
**Role:** `coder`
**References:** `REF-05`, `REF-08`, `REF-15`, `REF-16`, `REF-17`, `REF-18`
**Prompt:** In `aerobeat-web-assembly`, replace `aerobeat-app` with `aero-game`; remove `100vh`, history/location ownership, constructor startup, shadow-root traversal, and terminal reconnect bugs. Compose one service graph per instance, exact-container ResizeObserver/DPR coordination, media lease, measured CV/input/gameplay/content/audio/renderer/UI flow, environment priority, public configure/commands/snapshots/events, child-owned fullscreen, strict iframe wrapper/handshake, public capability diagnostics, hidden-page policy, and complete teardown. Preserve the locked MediaPipe Lite production route and do not reintroduce removed backend selectors or predictive production routing.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-assembly/src/`
- `aerobeat-web-assembly/scripts/`
- `aerobeat-web-assembly/docs/`
- `aerobeat-web-assembly/.testbed/`
- `aerobeat-web-assembly/release/` only through existing generated release flow.

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Direct and cross-origin iframe modes pass; parent container controls dimensions; camera permissions and injected stream work where applicable; raw frames never cross bridge; landmarks do; fullscreen is user-gesture safe; multiple instances transfer lease; reconnect works; hidden pauses; all four prototypes and Flow run through public APIs.

---

### Task 11: Build Deterministic Prototype Fixtures and Integration Harnesses

**Bead ID:** `aerobeat-web-assembly-48w.5`
**SubAgent:** DSH coder subagent, then QA
**Role:** `coder`
**References:** `REF-06`, `REF-08`, `REF-12`, `REF-14`
**Prompt:** Build small deterministic paired fixtures and replay traces that exercise all four Boxing candidates, Flow grid behavior, guards, Crossed Guard, straight tolerance, hook/uppercut directions, obstacle coexistence, modifiers, tracking loss, recalibration, theme/background fallback, and iframe commands. Expose manual selectors before gameplay and in pause. Include named visual/scoring/converter tuning presets with import/export/reset and active version/hash telemetry. Do not build a survey or durable notes feature.

**Folders Created/Deleted/Modified:**
- Owning repos' `fixtures/`, `.testbed/`, and validation scripts.

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Pending

**Acceptance:** Fixtures are deterministic and content-hashed; selectors identify adapter+recipe clearly; all tuning classes distinguish live, between-run, and regeneration-required changes; shadow metrics are hidden from user score and available in diagnostics.

---

### Task 12: Cross-Repo Desktop, Android, Direct-Embed, and Iframe QA

**Bead ID:** `aerobeat-web-assembly-48w.6`
**SubAgent:** DSH QA subagents
**Role:** `qa`
**References:** `REF-01` through `REF-18`
**Prompt:** Independently run every repo-local check/test/browser suite, then verify the highest-fidelity direct and iframe game on current Chromium desktop and Android secure context. Validate camera permission, calibration geometry, facing/mirroring, exact container sizing, background switching/fallback, theme precedence, Flow, four Boxing candidates, pause/recalibration/countdown, modifier switching, media lease transfer, fullscreen, reconnect, hidden-page behavior, CORS failures, teardown, telemetry privacy, console noise, and release proof vendor lock. Capture exact evidence and file follow-up Beads for every failure.

**Folders Created/Deleted/Modified:**
- QA artifacts only in approved testbed/release-proof locations.

**Files Created/Deleted/Modified:**
- Plan and Bead evidence updates; code only through follow-up repair Beads.

**Status:** Pending

**Acceptance:** All required suites pass; desktop and Android evidence is recorded; no unexpected console warnings/errors; no raw-frame bridge payload; release proof still ships only locked MediaPipe vendor/runtime assets.

---

### Task 13: Independent Final Audit and Prototype Handoff

**Bead ID:** `aerobeat-web-assembly-48w.7`
**SubAgent:** DSH auditor subagent
**Role:** `auditor`
**References:** `REF-01` through `REF-18`
**Prompt:** Audit contract ownership, dependency direction, plan/Bead state, test evidence, generated artifacts, package/repo remotes, commits, pushes, and clean worktrees across every touched repo. Confirm the four candidates remain explicitly experimental, no production winner was selected, prototype scores remain local-only, rejected branches were not prematurely removed, and all accepted decisions are represented in code/tests/docs. Close completed Beads only after verification and leave Derrick a physical-playtest handoff naming URLs, selectors, tuning controls, known limits, and how to request durable notes.

**Folders Created/Deleted/Modified:**
- Plan, Bead, and handoff/audit records only.

**Files Created/Deleted/Modified:**
- Exact audit records determined during execution.

**Status:** Pending

**Acceptance:** Every intended change is committed and pushed, all worktrees are clean or explicitly explained, linked Beads are closed appropriately, and the plan is updated to Complete with prototype—not production-promotion—results.

---

## Validation Matrix

| Layer | Required validation |
| --- | --- |
| Contracts | Strict JSDoc/no-any, runtime narrowing/validators, schema/version snapshots, import boundaries |
| Content Core/Authoring | Godot headless contract/tool suites, deterministic regeneration/hash comparison, conversion trace snapshots |
| Input | Unit/replay tests for calibration, coordinate transforms, anchor/cell/subcell evidence, tracking lifecycle |
| Content | Package/hash/CORS/variant/lineage tests |
| Gameplay | Deterministic clock/scoring/pause/countdown/ruleset tests |
| Video | Browser media lifecycle, stream injection/teardown, CORS capability tests |
| Renderer/Style | Browser visual geometry, DPR/resize, animation clock, theme/token tests |
| UI | Named-component, accessibility, narrow-layout, representative-state browser tests |
| Assembly | Unit, Playwright direct embed, Playwright cross-origin iframe, release proof |
| Physical | Desktop Chromium webcam and Android secure-context calibration/gameplay proof |
| Final | Cross-repo audit, clean status, commits/pushes, no production promotion |

---

## Final Results

**Status:** Pending

**What We Built:** Pending implementation approval and execution.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.
