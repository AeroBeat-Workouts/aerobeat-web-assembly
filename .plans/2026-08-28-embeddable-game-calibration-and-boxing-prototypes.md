# AeroBeat Embeddable Game, Calibration, and Boxing Prototypes

**Date:** 2026-08-28
**Status:** In Progress
**Last Updated:** 2026-08-28 17:53 EDT
**Blocked Reason:** None
**Agent:** cookie

---

## Goal

Build and prove a container-responsive `aero-game` Web Component with calibrated athlete-space input, shared 4x3 Flow/Spatial-Boxing presentation, semantic Track Boxing, direct and iframe embedding, browser-native BeatSaver discovery/acquisition/content authoring, and four selectable Boxing prototype combinations generated from arbitrary compatible BeatSaver maps without promoting a production winner before Derrick's physical playtesting.

---

## Overview

This is a cross-repository prototype program coordinated from `aerobeat-web-assembly`. Domain behavior remains in its owning repositories: contracts in `aerobeat-web-contracts` and `aerobeat-content-core`; calibrated pose interpretation in `aerobeat-web-input`; browser media in `aerobeat-web-video`; graphics in `aerobeat-web-renderer`; tokens in `aerobeat-web-style`; visible components in `aerobeat-web-ui`; BeatSaver conversion in `aerobeat-tool-content-authoring`; and new content/gameplay runtime packages where those missing owners must be established.

The plan ports the Godot camera-space/athlete-space contract but deliberately does not copy the Godot proving-scene visuals or ambiguous calibration quirks. The web system uses automatic measured-frame T-pose calibration, a hidden athlete-input grid, a separate full-container screen-space playfield, tracking-loss pause/recalibration, and an assembly-owned `aero-game` root suitable for direct controlled-host embedding and public HTTPS iframe embedding.

Boxing remains experimental through this plan. It produces a 2x2 matrix of playable candidates: Semantic Track versus Spatial Grid, each generated from Row-Family/Balanced-Height versus Cut-Family/Source-Height recipes. Prototype scores remain local/test-only. Production promotion, rejected-branch deletion, and public leaderboard policy require a later plan after Derrick reports physical playtest results.

The same converter is also a product foundation rather than a fixed demo playlist. New `aerobeat-web-vendor-beatsaver` and `aerobeat-web-content-authoring` packages let an athlete search/browse BeatSaver, select a map version and difficulty, download or locally import its ZIP, verify and inspect it safely, convert it to current AeroBeat content and all supported prototype variants, persist generated packages locally, and play them through the same runtime. The approved regression pool remains QA coverage, not a product allowlist.

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

### Browser BeatSaver acquisition and content authoring

- `aerobeat-web-vendor-beatsaver` owns only BeatSaver-specific search/latest/detail/hash request building, transport, normalized provider DTOs, selected-version download, local ZIP intake, archive inspection and source-manifest emission.
- `aerobeat-web-content-authoring` owns browser conversion from inspected source material into canonical AeroBeat packages, recipe/variant generation, provenance, validation, export and local persistence.
- The approved 14-map pool is regression coverage, never an allowlist. Any structurally supported BeatSaver map/version/difficulty may be selected.
- Direct browser access is the default. On 2026-08-28 both `api.beatsaver.com` map detail and the selected `r2cdn.beatsaver.com` ZIP response returned `Access-Control-Allow-Origin: *`; implementation must still expose an injected transport/proxy adapter and local ZIP import because third-party CORS/availability can change.
- Browse/search/detail operations are abortable, bounded, cache-aware and 429/`Retry-After` aware. No BeatSaver credential or private API is required.
- Version selection is explicit and bound to the provider version hash. Downloaded ZIP bytes are hashed and compared with provider metadata before conversion.
- Archive intake rejects absolute/parent paths, duplicate normalized paths, symlinks, unsupported encryption, excessive entry count, excessive per-entry/expanded/compression-ratio sizes, malformed metadata and unsupported map versions with specific diagnostics.
- Parse supported Beat Saber v2/v3/v4 metadata and difficulty data into a provider-neutral source manifest before recipes run. Provider DTOs and raw archive objects never become gameplay contracts.
- Conversion runs in a Worker where available, is abortable, reports bounded progress, and does not require SharedArrayBuffer or cross-origin isolation.
- Generated packages, source/version/recipe/ruleset hashes and optional original ZIP cache are stored locally in IndexedDB behind an AeroBeat-owned persistence facade with quota reporting, eviction/delete and schema migration. Raw downloaded community content is not committed or uploaded by default.
- Audio is decoded from bytes/Object URLs through `aerobeat-web-audio`; `.egg` filename extension does not become a public media contract. Unsupported codecs produce actionable import errors.
- Direct and iframe hosts get commands/events for browse, import, conversion progress, cancellation, package selection and deletion, but raw ZIP/audio bytes do not cross the iframe messaging boundary.
- Godot and web converter implementations consume the same versioned recipe definitions and golden fixtures. Cross-language parity tests require identical event IDs/order, drop/relocation reasons and semantic outputs; package serialization may differ only where canonicalization explicitly permits.

---

## Non-Goals

- Selecting or promoting the production Boxing adapter/recipe.
- Keeping rejected experimental runtime branches after later promotion.
- Public competitive leaderboards or anti-cheat.
- Threaded WASM/SharedArrayBuffer/cross-origin isolation.
- Safari/Firefox production certification; initial browser target is current Chromium desktop and Android.
- A dedicated reduced-motion gameplay mode.
- Raw camera-frame sharing across iframe boundaries.
- Operating a server-side BeatSaver mirror/proxy in this slice; the vendor transport accepts an injected proxy adapter if deployment later requires one.
- Uploading or redistributing downloaded BeatSaver archives/audio by default.
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
| `REF-19` | Canonical candidate gameplay silhouettes | `/home/derrick/.dsh/projects/aerobeat/aerobeat-branding/icons/` |
| `REF-20` | Prior playable runner decisions and physical-playtest gate | `/home/derrick/.dsh/projects/aerobeat/aerobeat-gameplay-runner/.plans/2026-08-02-playable-flow-boxing-testbeds.md` |
| `REF-21` | Approved BeatSaver regression pool | `/home/derrick/.dsh/projects/aerobeat/aerobeat-content-core/fixtures/beatsaver_regression_pool/README.md` |
| `REF-22` | Prior runner-curated BeatSaver subset and limitations | `/home/derrick/.dsh/projects/aerobeat/aerobeat-gameplay-runner/.plans/archive/2026-08-10-testbed-song-environment-assets.md` |
| `REF-23` | Existing Godot BeatSaver vendor boundary and fixtures | `/home/derrick/.dsh/projects/aerobeat/aerobeat-vendor-beatsaver/README.md` |
| `REF-24` | Official BeatSaver API documentation | `https://api.beatsaver.com/docs/` |

---

## DSH Goal

**Goal ID:** `goal-073d9a11-4179-4d60-84af-cf21ec62f551`
**Objective:** Execute this plan from `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly` until linked Beads are implemented, independently verified, committed, pushed, arbitrary compatible BeatSaver maps can be acquired/authored locally, and the four prototype combinations are ready for Derrick's physical playtesting; stop before production promotion.
**Max Goal Rounds:** 50
**Continuation Status:** Active

---

## Execution and Approval Boundaries

- Derrick approved implementation on 2026-08-28 contingent on adding browser-native BeatSaver vendor/content-authoring product foundations; this amendment satisfies that condition.
- Derrick authorized creation/publication of `aerobeat-web-content`, `aerobeat-web-gameplay`, `aerobeat-web-vendor-beatsaver`, and `aerobeat-web-content-authoring` under the existing `AeroBeat-Workouts` GitHub organization on 2026-08-28.
- Derrick confirmed AeroBeat has rights to the existing `aerobeat-branding/icons/` silhouettes and authorized their normalization, adaptation, mirroring, prototype use, and generation of missing SVGs on 2026-08-28. Replacement white SVG masters may arrive incrementally and must remain hot-swappable assets rather than requiring gameplay code changes.
- Every repository stays on its current branch unless Derrick directs otherwise.
- Every coder task gets independent QA and final audit evidence. Browser-visible tasks require desktop Chromium and Android secure-context proof where applicable.
- Any discovered change to an approved contract returns to Derrick before implementation silently widens scope.

---

## Repository Inventory

### Repositories created

| Repository | Purpose |
| --- | --- |
| `aerobeat-web-content` | Browser song-package loading, hashes, asset/CORS policy, immutable variants, modifiers, lineage, persistence consumption, and paused future-target swaps. |
| `aerobeat-web-gameplay` | Browser gameplay-session coordination, Flow/Boxing judgement, scoring diagnostics, calibration/pause/countdown safety, and local prototype score identity. |
| `aerobeat-web-vendor-beatsaver` | Replaceable browser BeatSaver API/search/detail/version/download/local-ZIP/archive-inspection seam with normalized provider DTOs and source manifests. |
| `aerobeat-web-content-authoring` | Browser Worker-based BeatSaver-to-AeroBeat conversion, recipe variants, validation, provenance, local IndexedDB persistence and package export. |

### Existing repositories modified

| Repository | Planned changes |
| --- | --- |
| `aerobeat-web-assembly` | Replace SPA root with `aero-game`; compose services; direct/iframe APIs; fullscreen; lease coordination; prototype integration and release proof. |
| `aerobeat-web-contracts` | Coordinate/calibration/session/content/theme/embed/message shapes, IDs, names, validators, and decision records. |
| `aerobeat-web-input` | `AeroBodyGridService`, calibrated 4x3/8x6 input, semantic/spatial evidence, tracking-loss safety. |
| `aerobeat-web-video` | Reconnectable media lifecycle, stream injection, visibility behavior, CORS capability truth, teardown and lease participation. |
| `aerobeat-web-audio` | Per-game Web Audio lifecycle, lease participation, external audio failure truth, visibility pause/resume, deterministic clock continuity and teardown. |
| `aerobeat-web-renderer` | Per-game WebGL renderer, shared playfield, Track lanes, role visuals, exact-container/DPR behavior, animation and disposal. |
| `aerobeat-web-style` | Serializable theme defaults and CSS custom properties for playfield, roles, environments and feedback. |
| `aerobeat-web-ui` | Named `aero-*` calibration/gameplay/pause/countdown/selector/fullscreen/status components. |
| `aerobeat-content-core` | Durable Boxing spatial target, variant, recipe, modifier, suggestion, lineage and hash contracts. |
| `aerobeat-tool-content-authoring` | Both BeatSaver recipe implementations, optimizer/reach/relocation, traces and four candidate emissions through `AeroContentAuthoring`. |
| `aerobeat-branding` | After rights confirmation, gameplay icon provenance plus normalized web-ready SVG masters, including connected standard/crossed guards. |

### Reference or fixture sources; no planned production edits

- `aerobeat-input-core`
- `aerobeat-input-camera-tracking`
- `aerobeat-gameplay-runner`
- `aerobeat-web-cv`
- `aerobeat-web-vendor-mediapipe`
- `aerobeat-vendor-beatsaver`
- `aerobeat-environment-community`
- `aerobeat-environment-loader`

If implementation proves that one of these owners lacks a required public contract, the orchestrator must add a plan amendment and Bead rather than make an unrecorded cross-repo edit.

### Godot-to-web ownership mapping

The web architecture intentionally does not create a one-for-one browser repository for every Godot repository. It preserves responsibilities while consolidating boundaries that are smaller in the browser runtime:

| Godot source/reference | Web owner | New web repo required? |
| --- | --- | --- |
| `aerobeat-input-core` | `aerobeat-web-contracts` for shared shapes/names; `aerobeat-web-input` for routing and body-grid interpretation | No; both exist. |
| `aerobeat-input-camera-tracking` | `aerobeat-web-video` for media, `aerobeat-web-cv` for measured pose production, `aerobeat-web-input` for calibration/gesture/grid interpretation | No; these existing browser boundaries already replace the combined Godot lane. |
| `aerobeat-gameplay-runner` | New `aerobeat-web-gameplay` for session lifecycle, clock consumption, dispatch, judgement and results | Yes; included in Task 2. |
| `aerobeat-mode-flow` and `aerobeat-mode-boxing` | Mode modules/rulesets inside `aerobeat-web-gameplay`, sharing one session coordinator and evidence-consumption contract | No separate repos for v1. Split later only if modes need independent publication/version cadence. |
| `aerobeat-content-core` | Remains canonical durable authored-content semantics; `aerobeat-web-contracts` mirrors browser-facing shapes and new `aerobeat-web-content` validates/loads runtime packages | Yes, only `aerobeat-web-content`; do not duplicate the canonical content model into another independent schema owner. |
| `aerobeat-tool-content-authoring` | Remains the Godot/offline authoring implementation; new `aerobeat-web-content-authoring` provides browser conversion using the same recipes/golden fixtures and emits immutable packages for `aerobeat-web-content` | Yes; included in Task 2B. |
| `aerobeat-vendor-beatsaver` | Remains the Godot/staging vendor implementation and donor boundary; new `aerobeat-web-vendor-beatsaver` provides direct browser browse/download/local-ZIP acquisition | Yes; included in Task 2B. |
| `aerobeat-tool-audio-player` | Existing `aerobeat-web-audio` | No; it already exists. |
| `aerobeat-environment-core` / loader / community | `aerobeat-web-content` owns background descriptors and hashes, `aerobeat-web-video` owns video media, `aerobeat-web-renderer` owns drawn layers, and assembly resolves precedence | No `aerobeat-web-environment` for the current 2D image/video/background requirement. Create one later only for independently versioned 3D/GLB/splat/plugin environment lifecycles. |
| Godot runner/testbed UI | `aerobeat-web-ui` named components plus `aerobeat-web-assembly` composition | No; both exist. |

This avoids placeholder repositories and duplicate authorities while retaining a clean extraction point if a domain becomes independently reusable.

---

## Service and Singleton Inventory

### One process-wide singleton

- **New `AeroGameMediaLeaseCoordinator` in `aerobeat-web-assembly`:** arbitrates the single active camera/audio owner across multiple `aero-game` instances. It owns policy only; video/audio services still own their browser resources. Lease transfer pauses the prior owner before activating the next.

### One instance of each service per connected `aero-game`

- **New `AeroBodyGridService`** (`aerobeat-web-input`): calibration, athlete-grid geometry/evidence, tracking safety and immutable snapshots.
- **New `AeroBeatSaverVendorService`** (`aerobeat-web-vendor-beatsaver`): abortable provider browse/detail/version acquisition, archive inspection and normalized source manifests.
- **New `AeroWebContentAuthoringService`** (`aerobeat-web-content-authoring`): Worker conversion jobs, progress/cancellation, recipe/variant generation, validation, local persistence and export.
- **New `AeroContentRuntime`** (`aerobeat-web-content`): loaded package/variant/asset state and immutable content snapshots, including locally authored packages.
- **New `AeroGameplaySessionCoordinator`** (`aerobeat-web-gameplay`): clocked session state, pause/recalibration/countdown, judgement and local prototype telemetry.
- **New `AeroPrototypeProfileRegistry`** (`aerobeat-web-gameplay`): named/versioned ruleset profiles, import/export/reset and regeneration-required metadata; it does not own visual token implementation or converter execution.
- **Existing browser video facade**, instantiated per game and extended by Task 7.
- **Existing CV service/locked MediaPipe adapter**, instantiated per game without changing provider/model defaults.
- **Existing pose input router**, instantiated per game and connected to the new body-grid service.
- **Existing Web Audio service**, instantiated per game and extended by Task 7B.
- **Existing WebGL renderer factory**, instantiated per game and extended by Task 8. The process-global `getAeroWebGl2RendererSingleton()` path is removed rather than used by embeddable games.
- **New per-instance iframe bridge adapter** in assembly only when framed; it is not global and binds to the immediate parent window/origin.
- **New per-instance theme/environment resolver** in assembly; it applies default < playlist < song suggestion < athlete override precedence and delegates drawing/loading to owners.

### Existing Godot singleton modified

- **`AeroContentAuthoring`** remains the single public Godot authoring authority and gains versioned recipe selection/provenance entrypoints that delegate to conversion services. No second converter singleton is introduced.

`aero-game` itself is a reconnectable custom element class with many legal instances, not a singleton. UI components remain presenters, not services.

---

## Prototype Assets and Inputs

### Required BeatSaver sources

- Use the prior gameplay-runner regression pool rather than synthetic-only web charts.
- Fetch/stage full BeatSaver map sources through `aerobeat-vendor-beatsaver`; do not commit raw downloaded audio/map archives unless their license and repository policy explicitly allow it.
- **Primary real playable comparison track:** `4858`, Papercut by Linkin Park, approved Expert baseline. A full local BeatSaver ZIP/manifest, source DATs, audio, cover, conversion report, and prior Boxing/Flow outputs already exist under `aerobeat-vendor-beatsaver/.testbed/.artifacts/`. Reconvert the Expert source through both recipes and both adapters; use ExpertPlus only as an incidental dense-note stress case.
- **Secondary real playable comparison track:** `3d44b` / manifest key `3D44B`, Game Grumps - Forklift Simulator (Sbassbear Remix). A full local ZIP/manifest/source/audio/cover also exists. The archived source does not contain the approved Normal difficulty, so use its Hard source for physical comparison and retain the tiny Normal YAML fixture only for deterministic guard unit tests.
- **Additional acquisition targets from the prior runner subset:** `29be2` ExpertPlus for upper-end Flow/converter stress and `47fb6` Normal for simple/mobile correctness. Their committed fixtures are three-event synthetic slices without audio; fetch full sources before claiming playable proof.
- Keep `226e` Expert as the previous runner-curated mid-level semantic fixture and acquisition fallback, but do not treat its YAML-only copy as playable.
- Preserve the broader approved regression pool for contract/regression coverage: `349f2`, `2b4e6`, `304ea`, `48727`, `48088`, `48792`, `472d3`, `2f3d7`, and `19e5e` in addition to the keys above.
- Minimum physical handoff requires two real audio-backed BeatSaver tracks (`4858` Expert and `3d44b` Hard), with all four Semantic/Spatial x Row/Cut combinations generated from the same source events. YAML-only regression fixtures are accepted for unit/visual determinism only.
- If a source key is removed/unavailable and no approved local archive exists, record the failed acquisition and ask Derrick before substituting a different song.

### Gameplay icon set

The web prototype begins by normalizing AeroBeat's existing authorized branding silhouettes. Derrick confirmed reuse/adaptation rights and authorized generation of missing SVGs. Desired source format is monochrome white or `currentColor` SVG with `viewBox="0 0 64 64"`, no embedded raster/font, no fixed pixel size, and cleanly convertible paths. Replacement white SVGs can be dropped into the same semantic asset IDs later without gameplay/ruleset changes. Left/right forms may be generated by mirroring when the silhouette remains readable, with explicit outputs retained for visual QA.

Needed semantic silhouettes:

1. straight punch;
2. hook;
3. uppercut;
4. standard two-hand guard;
5. crossed guard (distinct from standard guard);
6. squat;
7. weave (mirrored for left/right);
8. T-pose calibration;
9. optional neutral glove/receptor mark.

Canonical authorized references cover straight/hook/uppercut/guard/squat/weave/T-pose/glove under `aerobeat-branding/icons/`; `aerobeat-input-camera-tracking/.testbed/assets/icons/` contains proving copies only. Crossed guard is the known missing custom silhouette and may be generated for the prototype. The canonical SVGs contain hard-coded white fills, editor/generated metadata and inconsistent viewBoxes, so Task 8B normalizes them and records Derrick's rights confirmation in the asset provenance ledger.

For production-ready masters, keep explicit left/right punch files for optical QA even where geometry begins as a mirror. Connected guards use `viewBox="0 0 48 24"`; other semantic silhouettes use `viewBox="0 0 64 64"`. DOM components color inline SVGs through `currentColor`/CSS custom properties. WebGL targets consume the same white silhouettes as alpha-mask atlas entries and apply semantic colors in the fragment shader, so replacing a master changes geometry without changing gameplay or color logic. Do not promote files from `inspiration/`, `.temp/`, installed dependencies, or testbed copies.

### Assets not required from Derrick for prototype execution

- Flow arrows/direction chevrons, approach rings, receptors, cells, guard connectors, obstacle hatching, hit/miss particles, countdown numerals, pause/fullscreen glyphs, and debug grid geometry are generated as CSS/WebGL/inline-component primitives.
- The legally safest default prototype environment is the current CSS gradient. Existing Perfect Hue and environment-community media may be used only for internal/noncommercial proving until per-asset rights are confirmed; `aerobeat-environment-community` is CC BY-NC 4.0 and is not a commercial-release source by default.
- System fonts are sufficient for the prototype; do not fetch a web font. A later bundled font must include its license/attribution.
- Hit/miss/countdown SFX are optional polish; the prototype does not block on them. The current runner `hit_sfx.wav` is explicitly a dummy with undocumented source. If supplied later, prefer original/cleared mono 48kHz WAV masters, 60-120ms for hit transients, plus source/license metadata; package browser derivatives only after approval.

---

## Dependency and Parallelism Order

1. **Contract/root setup:** Task 1 establishes public shapes; Tasks 2 and 2B establish the four authorized missing package owners.
2. **Parallel domain foundations:** Tasks 3, 4, 4B, 7, 7B, 8, 8B, and 9 may proceed after the relevant Task 1 exports and package scaffolds are accepted; Derrick has cleared Task 8B's asset-rights/source gate, and Task 9 consumes accepted vendor/authoring/branding/style/renderer seams rather than sibling internals.
3. **Browser authoring/runtime domains:** Task 4C follows Tasks 4 and 4B for recipe/vendor contracts; Task 5 follows Tasks 2, 2B and 4C; Task 6 follows Task 2 and consumes accepted contract/content/input/audio boundaries.
4. **Assembly integration:** Task 10 begins only after Tasks 3, 4B, 4C, 5, 6, 7, 7B, 8, 8B, and 9 have public validated surfaces.
5. **Prototype proof:** Task 11 follows integrated assembly; Task 12 independently verifies; Task 13 audits and hands off.
6. Any cross-repo contract mismatch discovered downstream returns to the owning contract Bead rather than being patched locally.

---

## Tasks

### Task 1: Freeze Cross-Repo Web Contracts and Decision Records

**Bead ID:** `aerobeat-web-contracts-db9`
**SubAgent:** Coder child `26dd25d2-d862-4624-9de7-5aecd9b53e01`; QA/auditor `9298cc52-0446-44dc-8f8b-b17b072d595b`
**Role:** `coder`
**References:** `REF-01`, `REF-02`, `REF-05`, `REF-15`, `REF-16`, `REF-17`, `REF-18`
**Prompt:** In `aerobeat-web-contracts`, define versioned public camelCase contracts and validators for coordinate spaces, calibration/readiness/session/lifecycle, body-grid descriptors/anchors/cell entries, tracking safety, game/session/countdown, content variants, themes, container capabilities, fullscreen, media/asset policy, direct-host events, and iframe messages. Rename the public root element contract to `aero-game` without keeping `aerobeat-app`. Record accepted decisions under `docs/decisions/`. Preserve measured-versus-predicted truth and do not expose vendor-native objects or raw camera frames.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-contracts/src/`
- `aerobeat-web-contracts/docs/decisions/`
- `aerobeat-web-contracts/scripts/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation after repo inspection.

**Status:** Complete

**Results:** Coder commit `f302b70` implemented coordinate, calibrated-grid, session, gameplay, content, BeatSaver, theme, host/fullscreen and iframe contracts. Adversarial QA commit `2862a45` added case/separator-aware forbidden media/archive/audio bridge keys, exact plain-data narrowing without executing accessors, command/event exactness, signed-zero/corner coverage, canonical grid descriptors, fullscreen snapshots and a narrow package allowlist. Follow-up `20c5d5e` preserves legitimate generic `stream`/`track` telemetry keys while rejecting media-specific aliases and object types. Parent reran check/test/browser/pack; all pass. Bead closure commit: `c6e0da4`.

**Acceptance:** Satisfied; downstream tasks can depend only on public exports and coordinate tests lock preview, gameplay-camera and athlete transformations.

---

### Task 2: Establish Missing Web Content and Gameplay Package Owners

**Bead ID:** `aerobeat-web-assembly-48w.1`
**SubAgent:** Coder children `bf60639b-4e1b-4c2b-b276-802d8052585b`, `0c8adc01-4b36-44ca-b3ed-ef7207903b1b`; auditor `369e88c5-57c6-40db-a2b7-7ea36567a9c7`
**Role:** `coder`
**References:** `REF-05`, `REF-08`, `REF-12`, `REF-13`
**Prompt:** After explicit external-action authorization, establish canonical `aerobeat-web-content` and `aerobeat-web-gameplay` package repositories using existing AeroBeat web package conventions. Give each strict JSDoc/public-import/component/console validation posture, README ownership boundaries, testbed shape, package exports, Beads, and remote/push verification. Do not put content loading or gameplay session logic in assembly as a shortcut.

**Folders Created/Deleted/Modified:**
- `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-content/`
- `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-gameplay/`

**Files Created/Deleted/Modified:**
- New repository scaffolds and validation files.

**Status:** Complete

**Results:** Created public SSH-tracked `aerobeat-web-content` and `aerobeat-web-gameplay` repositories with package boundaries, public exports, strict validation, deterministic testbeds, docs and repo-local Beads. Independent audit ran check/test/browser/pack in both, repaired package allowlists, aligned content to canonical `aero.content.library`, and verified clean pushed `main`. Key commits: content `131eab1`, `2849e5d`, `ad4a73a`, `08430ef`; gameplay `468ff43`, `8309219`. Future implementation Beads are `aerobeat-web-content-gzp` and `aerobeat-web-gameplay-acv`.

**Acceptance:** Satisfied; both repos exist locally/remotely with clean `main...origin/main`, narrow public package exports, passing validation and accepted ownership docs.

---

### Task 2B: Establish Web BeatSaver Vendor and Content-Authoring Package Owners

**Bead ID:** `aerobeat-web-assembly-48w.8`
**SubAgent:** Coder children `6f1ec822-4043-4ecb-8ce5-2057863df357`, recovery `06baa3ca-2019-40f4-9019-85a29d2e7cdc`; auditor `369e88c5-57c6-40db-a2b7-7ea36567a9c7`
**Role:** `coder`
**References:** `REF-05`, `REF-13`, `REF-14`, `REF-23`, `REF-24`
**Prompt:** Create and publish `aerobeat-web-vendor-beatsaver` and `aerobeat-web-content-authoring` under the authorized `AeroBeat-Workouts` organization using existing AeroBeat web package conventions. Give each strict JSDoc/public-import/console validation, README ownership boundaries, fixtures/testbed shape, package exports, Beads, decision docs and clean remote tracking. Vendor owns provider acquisition/inspection only; content-authoring owns provider-neutral conversion/persistence/export only.

**Folders Created/Deleted/Modified:**
- `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-vendor-beatsaver/`
- `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-content-authoring/`

**Files Created/Deleted/Modified:**
- New repository scaffolds and validation files.

**Status:** Complete

**Results:** Created public SSH-tracked `aerobeat-web-vendor-beatsaver` and `aerobeat-web-content-authoring` repositories with explicit provider-versus-conversion boundaries, exports, strict validation, deterministic metadata-only fixtures/testbeds, docs and repo-local Beads. Independent audit ran check/test/browser/pack, repaired authoring package allowlist, verified no community media/provider-native implementation in foundations, and verified pushed foundation snapshots. Key commits: vendor `9eff0ea`; authoring `16277cd`, `a353818`. Successor implementation Beads are `aerobeat-web-vendor-beatsaver-4wk` and `aerobeat-web-content-authoring-pbk`; active Task 4B intentionally owns the vendor worktree after foundation completion.

**Acceptance:** Satisfied against pushed foundation snapshots; both repos exist locally/remotely with correct boundaries, Beads, narrow packages and passing validation. Current vendor dirt belongs to successor Task 4B, not foundation drift.

---

### Task 3: Implement the Calibrated Athlete-Input and Tracking-Safety Service

**Bead ID:** `aerobeat-web-input-esm`
**SubAgent:** Coder child `95cb3414-ce5b-4692-918f-314ad03dd6cc`; QA/auditor `ace00d37-17f4-41a8-a3eb-b675e117698a`
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

**Status:** Complete

**Results:** Coder `2aae8f7` implemented measured-only calibration, exact athlete grids, source invalidation, dim retention, entries, Boxing evidence and tracking safety. Adversarial QA `ff5e094` fixed sparse-gap calibration, rollback/duplicate frames, malformed/duplicate landmarks, invalidation cleanup, listener isolation and cardinal ties; `b1acd7c` covered independent semantic/spatial straight continuity and `5218647` covered multi-instance isolation. Parent check/test/browser/pack pass; closure `9ddeb15`.

**Acceptance:** Satisfied; replay/browser tests cover all calibration gates, geometry/coordinate edges, source changes, prediction isolation, evidence freshness/continuity, 500ms loss, lifecycle and no bootstrap., aspect/padding, mirror/facing transforms, exact corner IDs, out-of-grid behavior, cell/subcell transitions, straight 100ms continuity, guard same-sample evidence, stale samples, tracking-loss pause events, reset/source invalidation, and no bootstrap.

---

### Task 4: Extend Canonical Content and Build Deterministic BeatSaver Prototype Recipes

**Bead ID:** `oc-4up`
**SubAgent:** Coder child `01a89f5d-0509-45bd-9dcc-bafe051705a6`; Godot QA/auditor `c4afeb2e-1b3f-4450-845b-530874ba75f2`
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

**Status:** Complete

**Results:** Coder content-core `f670242` and authoring `3954782` added the optional canonical prototype contract, machine definitions, deterministic four-Boxing-plus-Flow converter, traces and sanitized golden. Audit content-core `476da22` and authoring `96159f1` added external audio/difficulty hash verification, removed zero-time reach allowance, reserved full guard windows before punch optimization, and expanded modifier/composition/provenance parity. Parent reran both full Godot suites successfully; Bead closed. Authoring follow-ups `e593b16` and `59c93de` document the synchronous serialized conversion/save boundary and assert chart modifier identity as the sorted union of requested and emitted modifiers, including generated `crossed_guard`. The CLI still reports the exact pre-existing ten retained resources/ObjectDB warning at exit 0; detached pre-Task4 evidence confirms Task 4 did not introduce it.

**Acceptance:** Satisfied; identical source/recipe yields stable charts/hashes/traces, all four candidates plus Flow validate per difficulty, Flow regressions pass and environment semantics remain optional suggestions. traces record every emitted/dropped/relocated event and normalization; all four candidates validate; Flow regressions pass; source environment semantics are reconciled explicitly.

---

### Task 4B: Implement Browser BeatSaver Vendor Acquisition

**Bead ID:** `aerobeat-web-assembly-48w.9`; repo Bead `aerobeat-web-vendor-beatsaver-4wk`
**SubAgent:** Coder child `22b38c9c-65b8-4e65-b500-ae250056c323`; security auditor `d0aefeb8-87d6-4bde-9888-4f462e7a258a`
**Role:** `coder`
**References:** `REF-05`, `REF-23`, `REF-24`
**Prompt:** In `aerobeat-web-vendor-beatsaver`, implement an injected-transport facade for search/latest/detail-by-id/detail-by-hash, explicit version/difficulty discovery, selected-version download, local `File`/ZIP intake, SHA-1 verification, safe archive inspection and normalized source-material manifests. Support direct CORS, configured proxy transport and fake fixtures; AbortSignal, progress, bounded retries, 429/Retry-After, timeouts and truthful errors. Defend against traversal, duplicates, symlinks, encrypted entries and archive bombs. Keep provider DTOs/raw bytes private and do not own conversion, persistence policy, UI or gameplay.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-vendor-beatsaver/src/`
- `aerobeat-web-vendor-beatsaver/fixtures/`
- `aerobeat-web-vendor-beatsaver/scripts/`
- `aerobeat-web-vendor-beatsaver/docs/decisions/`
- `aerobeat-web-vendor-beatsaver/.testbed/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Complete

**Results:** Coder `938c6f5` implemented search/latest/detail-by-ID/hash, explicit version/difficulty selection, direct/injected/proxy transport, local intake, BeatSaver content SHA-1, normalized v2/v3/v4 bundles and initial ZIP defenses. Security audit `05afbb4` added package-owned timeout races, credential-free HTTPS/final-redirect validation, strict runtime narrowing, central/local ZIP equivalence, descriptor/range/CRC checks, Unicode/control/backslash aliases, special-mode rejection and bounded per-entry streaming inflate before exposure. Parent check/test/browser/pack pass. Real uncommitted `4858` and `3d44b` archives match provider hashes/difficulties and live API/CDN CORS remains `*`. Closure commits: vendor `68de60b`, assembly `23bc56d`.

**Acceptance:** Satisfied; arbitrary compatible maps are supported without an allowlist and provider DTOs, raw ZIPs and unbounded archive objects do not escape the vendor seam.

---

### Task 4C: Implement Browser BeatSaver Content Authoring and Persistence

**Bead ID:** `aerobeat-web-assembly-48w.10`
**SubAgent:** Coder child `bb9852c4-5402-4365-90e9-4af076d910f0`; failed audit `df37ae9a-a642-4fe4-bda1-118d34c5eb49`; recovery security QA `e4837ef7-9ab8-4a86-8b06-aab6d802c43f`
**Role:** `coder`
**References:** `REF-05`, `REF-13`, `REF-14`, `REF-21`, `REF-23`
**Prompt:** In `aerobeat-web-content-authoring`, consume normalized source manifests/entries and implement Worker-based, abortable conversion into canonical Flow plus four Boxing prototype variants. Parse supported Beat Saber v2/v3/v4 difficulty data; run the same versioned recipes, optimizer, reach, guard relocation, obstacle policy, modifiers and provenance as the Godot implementation; validate before persistence/export; generate stable IDs/hashes/traces; decode-support diagnostics; and store/list/load/delete/migrate packages in IndexedDB with quota and optional source-cache controls. Add golden cross-language parity fixtures. Do not own BeatSaver transport, product UI, playback, scoring or runtime package selection.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-content-authoring/src/`
- `aerobeat-web-content-authoring/fixtures/`
- `aerobeat-web-content-authoring/scripts/`
- `aerobeat-web-content-authoring/docs/decisions/`
- `aerobeat-web-content-authoring/.testbed/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Complete

**Results:** Coder `1833c6e` implemented provider-neutral v2/v3/v4 Worker conversion, five charts, validation, semantic parity, export and IndexedDB persistence. Recovery audit `d134255` preserved the failed auditor's work and completed final Godot reach/guard/hash/modifier parity, bounded descriptor-safe source/Worker/result seams, exact settlement/source binding, atomic token-aware persistence/migrations/quota, verified deterministic AEROPKG1 export and byte-free snapshots. Parent check/unit/security/real/browser/pack pass; real uncommitted `4858` Expert and `3D44B` Hard each produce five deterministic charts. Closures: authoring `9504f71`, assembly `532bc43`.

**Acceptance:** Satisfied; synthetic v2/v3/v4 plus real maps, deterministic five-variant conversion, final Godot semantic parity, cancellation, persistence/migration/quota/delete/export and no allowlist are covered. and `3d44b` Hard sources plus synthetic v2/v3/v4 fixtures; all four variants validate; repeated conversion is deterministic; golden semantic outputs match Godot; cancellation leaves no partial package; IndexedDB migration/quota/delete/export works; arbitrary compatible map IDs are not gated by a playlist.

---

### Task 5: Implement Web Content Loading, Asset Policy, and Variant Resolution

**Bead ID:** `aerobeat-web-assembly-48w.2`
**SubAgent:** Coder child `6137d37d-e34e-411a-9230-bd82a718d80a`; security/behavior QA `17e8db25-eb2a-4b51-9444-59c161cf6198`
**Role:** `coder`
**References:** `REF-05`, `REF-09`, `REF-12`, `REF-13`, `REF-23`
**Prompt:** In the new `aerobeat-web-content`, validate/load packaged, externally hosted and locally authored song packages; resolve IndexedDB package handles without importing authoring internals; enforce chart/audio hashes, recipe/ruleset capabilities, theme suggestions, external asset descriptors, CORS/readability policy, fallback backgrounds, map lineage, modifier combinations, and pause-time future-target variant swaps. Preserve past/judged event truth and expose immutable snapshots. Do not own acquisition, conversion, persistence implementation, playback, scoring, rendering, or camera logic.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-content/src/`
- `aerobeat-web-content/scripts/`
- `aerobeat-web-content/fixtures/`
- `aerobeat-web-content/docs/decisions/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Complete

**Results:** Coder `1211827` implemented per-game direct/external/authored loading, AEROPKG1 verification, critical/cosmetic policy, five variants, modifier provenance and paused future swaps. Security audit `995f52d` added descriptor-safe boundaries, canonical hashes, bounded timeout/CORS transport, exact safe AEROPKG1 parsing, emitted-modifier/lineage validation, code-point ordering and adversarial swap/lifecycle coverage. Parent check/test/browser/pack and actual current authoring export integration pass; repo closure `ed4a2d6`, assembly closure `532bc43`.

**Acceptance:** Satisfied; hashes, arbitrary URLs, CORS, fallback, authored handles, deletion, modifiers, lineage and identity-preserving paused future swaps are covered.

---

### Task 6: Implement Gameplay Session, Rulesets, Scoring, Pause, and Prototype Telemetry

**Bead ID:** `aerobeat-web-assembly-48w.3`
**SubAgent:** Failed coder `023ead05-e71f-41f1-b465-06bc04d35bf2`; failed recovery `7d25a7bb-d1bf-4361-b11f-6fbcd4b225d5`; completion recovery `08b6b8b0-9503-4d20-b557-8a58f6769db9`; QA/auditor `284a36bf-aecf-4ef7-8215-29ac0713e579`
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

**Status:** Complete

**Results:** Recovery `b937435` implemented the coordinator and locked timing/safety/five-candidate matrix. Independent QA `68da7d5` fixed current audio/input envelope compatibility, transactional configure/advance/swap state, unsafe timeline freezing, overlap-aware guard/punch evidence, strict identity/duplicate/qualification checks, immediate lease/lifecycle gates, complete score partition identity and per-event old/new variant truth across paused swaps. Follow-up `dac3098` makes ordinary manual-pause frames timeline-immutable and adds a transactional stopped-clock-only `synchronizePausedClock` seek seam. Actual public audio/content/input integration and parent check/unit/integration/browser/pack pass; Beads closed.

**Acceptance:** Satisfied; deterministic and public-integration tests cover all four Boxing candidates plus Flow, ±180ms, 150ms, 100ms straight qualification, cardinal entries, checkpoints, overlap exclusivity, disjoint concurrency, consumption, tracking/countdown, swaps, local scoring and isolated shadows.

---

### Task 7: Harden Media Lifecycle, External Sources, and Instance Leasing

**Bead ID:** `aerobeat-web-video-335`
**SubAgent:** Coder child `7c04d987-0449-467f-b39f-c7d8b32287d0` failed after pushing `f96ab57`; QA/recovery `2b165325-ec53-47e1-ad65-96f101e911be`
**Role:** `coder`
**References:** `REF-09`, `REF-16`, `REF-17`
**Prompt:** In `aerobeat-web-video`, provide reconnectable per-instance media lifecycle, injected-stream support for direct embeds, late-permission generation/abort cleanup, CORS-aware external media descriptors, background-only versus sampled-media capability truth, synchronous teardown, hidden-page pause support, and the public media-lease seam needed for one active camera/audio owner. Do not move CV or assembly policy into video.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-video/src/`
- `aerobeat-web-video/scripts/`
- `aerobeat-web-video/docs/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Complete

**Results:** Coder commit `f96ab57` added the reconnectable facade; adversarial QA commit `0883ec9` fixed cross-kind/element cleanup and pending-play races. Blob-to-camera revokes owned URLs, owned-camera-to-video stops exactly once, host-owned tracks are never stopped, old elements clear sources/listeners, and pause/hidden/lease/source replacement defeat late play. Direct fake-device Chromium getUserMedia and captureStream paths pass with zero console noise. Parent reran check/test/browser/pack; closure commit `bc9fd59`.

**Acceptance:** Satisfied; request/injection/transfer/reconnect, late async work, visibility/lease, CORS/readability, source identity, track stopping and deterministic teardown are covered with no retained streams after destroy.

---

### Task 7B: Harden Audio Lifecycle and Lease Participation

**Bead ID:** `aerobeat-web-audio-4ao`
**SubAgent:** Coder child `f2285ded-dbb7-46f9-aa6a-e8a03fbb6fde`; QA/auditor `0147be7c-46a8-404b-937a-59cfffdb47e0`
**Role:** `coder`
**References:** `REF-12`, `REF-16`, `REF-17`
**Prompt:** In `aerobeat-web-audio`, provide reconnectable per-game Web Audio lifecycle, external audio fetch/decode failure truth, hash/CORS handoff support, hidden-page pause/resume without clock drift, lease pause/transfer/release hooks, deterministic gameplay-clock continuity, autoplay capability/error snapshots, and complete teardown. Audio owns browser audio resources; assembly owns cross-instance arbitration and gameplay owns judgement.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-audio/src/`
- `aerobeat-web-audio/scripts/`
- `aerobeat-web-audio/docs/decisions/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Complete

**Results:** Coder `bcf39ef` implemented per-game `aero.audio.clock` sources, clock, visibility/lease and teardown. Adversarial QA `302b595` separated load generation/AbortSignal from playback-operation ordering, enforced decoded readiness, exact-once node retirement and stale suspend recovery. Follow-up `8fb5410` completed create/connect/start failure cleanup and late resume/hash/decode/source-replacement races. Parent check, 25 unit tests, Chromium and pack pass; public snapshots contain metadata only. Closure commit `6a6be43`.

**Acceptance:** Satisfied; load/play/pause/seek, clock continuity, visibility/lease, autoplay/CORS/hash/decode failure, reconnect and zero retained owned context/nodes after destroy are covered., lease transfer, autoplay rejection, CORS/decode/hash-related load failures, deterministic clock snapshots, disconnect/reconnect and no retained AudioContext/source nodes after destroy.

---

### Task 8: Build the Shared Full-Container Gameplay Renderer and Tuning Surface

**Bead ID:** `aerobeat-web-renderer-mm2`
**SubAgent:** Coder child `55a84241-26e6-48c1-8226-0665899d2163`; visual QA/auditor `584e80e5-8fc4-4341-a6cf-2a821b5e3d0a`
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

**Status:** Complete

**Results:** Renderer `51af7e2` removed the singleton and added per-game Flow/Track/Spatial WebGL2 plans, exact-container/DPR, branding atlas, theme/tuning, recovery and teardown; style `5688b35` added generic role tokens. Visual audit `ca32a95` fixed atlas inversion, physical 4:3/square-cell fitting, Track icon aspect, easing, strict theme/atlas/tuning validation, regeneration/live truth, terminal guards and abortable rasterization. Parent check/test/browser/pack pass and inspected desktop, 390px, landscape and Flow evidence. Closure `42e79fa`.

**Acceptance:** Satisfied; arbitrary containers/DPR, exact 4×3 placement, role/icon/pattern distinction, beat-center animation convergence, theme precedence/defaults, live tuning swaps, no camera-space coupling, and clean WebGL disposal are covered.

---

### Task 8B: Normalize and Document Gameplay Icon Masters

**Bead ID:** `aerobeat-branding-0qw`
**SubAgent:** Coder child `0f660234-bfe2-4f36-a0ed-31f988f2a0bb`; auditor `c8ba67f3-7df4-4977-b724-2b59952b72e8`
**Role:** `coder`
**References:** `REF-19`
**Prompt:** Derrick has confirmed ownership/reuse rights and authorized generated prototype SVGs. Update `aerobeat-branding` with an asset provenance ledger and normalized web masters. Produce explicit left/right straight, hook and uppercut SVGs at `0 0 64 64`; T-pose/squat/weave/optional glove masters at `0 0 64 64`; and connected standard/crossed guards at `0 0 48 24`. Accept white source silhouettes, normalize DOM exports to `currentColor`, and produce deterministic alpha-mask atlas inputs for WebGL shader coloring. Preserve stable semantic asset IDs so Derrick can replace masters without gameplay changes. Use optical safe areas and no raster/font/external refs/editor namespaces/generated IDs. Do not promote inspiration, testbed, generated-cache or third-party dependency art.

**Folders Created/Deleted/Modified:**
- `aerobeat-branding/icons/`
- `aerobeat-branding/docs/`
- `aerobeat-branding/scripts/`

**Files Created/Deleted/Modified:**
- Exact files determined after the rights/source decision.

**Status:** Complete

**Results:** Added 13 authorized normalized masters under `aerobeat-branding/icons/web-gameplay/` with stable semantic manifest, `currentColor` DOM and alpha-mask-atlas WebGL contracts, explicit left/right punch families, squat/weaves/T-pose/glove, and connected standard/crossed guards. Provenance records Derrick's authorization, sources, derivative author and license. Independent Chromium contact-sheet audit found and fixed uppercut/hook distinction and provenance requirements in `a659ec6`; validator and npm check/test pass. Commits: `6b881fc`, `a659ec6`, Bead closure `95b3852`.

**Acceptance:** Satisfied; all assets validate, remain distinct in monochrome, original sources are untouched, and stable IDs support later white-SVG replacement.

---

### Task 9: Build Named Calibration, Grid, Gameplay, Pause, Countdown, and Prototype UI Components

**Bead ID:** `aerobeat-web-ui-dpu`
**SubAgent:** Coder child `3ffc875c-2096-4730-b693-4c79a3fe0211`; accessibility/browser QA `cff9bcda-22c0-49d2-87c8-24603dacd5b4`
**Role:** `coder`
**References:** `REF-04`, `REF-07`, `REF-11`
**Prompt:** In `aerobeat-web-ui`, build named `aero-*` presenters for BeatSaver search/browse/map detail/version+difficulty selection, local ZIP import, conversion progress/cancel, locally authored library/storage management, import errors, the T-pose badge, calibration composition, shared grid playfield host, semantic Track HUD, Spatial Grid HUD, tracking pause overlay, resume countdown, background environment, fullscreen control, errors/capabilities, and four-way prototype/tuning selector. Components accept public snapshots and emit intent only. Add accessible state announcements, keyboard/touch behavior, narrow layouts, selected `::part` surfaces, virtualized/bounded result rendering, and standalone testbed states. Do not put transport, archive parsing, conversion, persistence, camera, calibration math, scoring, or assembly traversal in UI.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-ui/src/elements/`
- `aerobeat-web-ui/src/screens/`
- `aerobeat-web-ui/.testbed/`
- `aerobeat-web-ui/scripts/`
- `aerobeat-web-ui/docs/decisions/`

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** Complete

**Results:** Coder `694e145` added 15 named reconnect-safe presenters and scalar-only intents. Accessibility/browser audit `63e4f6b` added roving profile radio keys, confirmed deletion, enter/exit fullscreen and exact import IDs, tracking dialog focus restore, stable preview/render nodes, deep bounded snapshot narrowing, safe storage telemetry, AA Track colors and portrait/landscape wrapping. Parent check/test/browser/pack pass; closure `e4b3571`.

**Acceptance:** Satisfied; named components, desktop/390px/landscape layouts, accessibility, browse/detail/version/import/conversion/library/quota states, calibration/loss/pause/countdown, Flow, all four Boxing selectors, fullscreen, theme overrides, and no shadow-root integration dependency are covered.

---

### Task 10: Replace the SPA Shell with Reconnectable `aero-game` and Iframe Delivery

**Bead IDs:** `aerobeat-web-assembly-48w.4`; production CV race repair `aerobeat-web-assembly-cyt`; iframe/audio integration gates `aerobeat-web-assembly-6ey`
**SubAgent:** Coder child `a091b4d7-dfa6-458e-b2fa-a18a5f2f3bf4`; integration/security QA `e959854b-b954-472e-9429-5cd60ae88b70`
**Role:** `coder`
**References:** `REF-05`, `REF-08`, `REF-15`, `REF-16`, `REF-17`, `REF-18`
**Prompt:** In `aerobeat-web-assembly`, replace `aerobeat-app` with `aero-game`; remove `100vh`, history/location ownership, constructor startup, shadow-root traversal, and terminal reconnect bugs. Compose one service graph per instance, including BeatSaver vendor, content-authoring Worker/persistence, content runtime, exact-container ResizeObserver/DPR coordination, media lease, measured CV/input/gameplay/audio/renderer/UI flow, environment priority, public browse/import/convert/library/game commands/snapshots/events, child-owned fullscreen, strict iframe wrapper/handshake, public capability/storage diagnostics, hidden-page policy, cancellation and complete teardown. Preserve the locked MediaPipe Lite production route and do not reintroduce removed backend selectors or predictive production routing. Raw ZIP/audio bytes stay child-local in iframe mode.

**Folders Created/Deleted/Modified:**
- `aerobeat-web-assembly/src/`
- `aerobeat-web-assembly/scripts/`
- `aerobeat-web-assembly/docs/`
- `aerobeat-web-assembly/.testbed/`
- `aerobeat-web-assembly/release/` only through existing generated release flow.

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** In Progress

**Results:** Coder `29696c5` implements the reconnectable full-parent `aero-game`, per-connection service graph, process-wide lease coordinator, direct/iframe APIs, locked MediaPipe route, stable surfaces, lifecycle teardown and tracked 0.0.24 release proof. Parent baseline gates pass, but integration QA reproduced non-deterministic tracked release bytes; leaked historical MoveNet/tuning markers; duplicate/stuck lease transfers; missing real content playback/future-swap/paused-clock/lease synchronization; incomplete iframe ready/import/destroy parity; source mirror/aspect and content-box errors; stale async commits; empty UI browse/library state; and permissive array/message boundaries. QA is correcting these root composition and security defects with actual public-service and expanded cross-origin Chromium coverage. Focused parent review filed P0 `aerobeat-web-assembly-cyt`: the draft production CV service must serialize load/estimate/dispose, await a fresh current-generation frame, isolate stale `finally`, transition bounded load errors, prevent prior-source frame leakage and block late resurrection; deferred-promise/max-concurrency tests are required. Focused Chromium review filed P0 `aerobeat-web-assembly-6ey` for exact 64 KiB/depth/item/string/descriptor iframe bounds, post-destroy non-resurrection plus fresh reconnect, body/history/location non-ownership, and actual-service audio frozen through calibration/countdown with playing-only start and immediate safety/hidden pause. The first audit turn reports two functional gate rounds passing, but its final release hashes were invalid because concurrent authoring dependency edits changed the conversion Worker/module graph between builds; final reproducibility proof must rerun only after the authoring P0 commits a stable tree, and the two parent P0 audit follow-ups remain required. Coordination note: auditor-staged Task 10 files were unintentionally included with a parent plan commit and pushed as intermediate `9cf4c3f`; it is not accepted closure, conversion-worker deletions remain unstaged, and the auditor must finish all queued P0 repairs/rebuilds in a corrective final commit without rewriting history.

**Acceptance:** Direct and cross-origin iframe modes pass; arbitrary compatible BeatSaver search/import/convert/library selection runs through public APIs; parent container controls dimensions; camera permissions and injected stream work where applicable; raw frames/ZIP/audio never cross bridge; normalized landmarks and bounded import/game telemetry do; fullscreen is user-gesture safe; multiple instances transfer lease; reconnect works; hidden pauses and cancels/retains work according to documented lifecycle; all four prototypes and Flow run through public APIs.

---

### Task 11: Build Deterministic Prototype Fixtures and Integration Harnesses

**Bead IDs:** `aerobeat-web-assembly-48w.5`; gameplay `aerobeat-web-gameplay-e2d` with closed import/identity P0 `aerobeat-web-gameplay-g2p` and independent QA `aerobeat-web-gameplay-3m9`; contracts converter-identity P0 `aerobeat-web-contracts-n3j`; vendor `aerobeat-web-vendor-beatsaver-5i6` with determinism bug `aerobeat-web-vendor-beatsaver-dy7` and QA `aerobeat-web-vendor-beatsaver-v3m`; authoring `aerobeat-web-content-authoring-ptc` with converter-provenance P0 `aerobeat-web-content-authoring-rkd`; renderer `aerobeat-web-renderer-mnm`; UI `aerobeat-web-ui-5hw`
**SubAgent:** Research blueprint `4f1feb39-050f-4a4a-9705-a72d4aab06e3`; profile registry/replay coder `7d293126-e97b-462e-ae4f-6c8cd3726ce1`; vendor convergence coder `7b724ab3-6a58-41d1-82a1-8924e08cdbf2` and QA `1fbd8808-aff5-4131-b2ba-f45b849de991`; authoring matrix/provenance coder `6ff50703-8a43-42a3-ba20-8d79f071816a`; renderer profile coder `edbeee1c-be3c-4d55-b60d-dba5e49b7042`; gameplay profile/replay QA `8c6f06a3-8857-41fd-b9f4-df7ee5ca656d`; contracts identity coder `9b452904-f1f2-4231-870a-02f143392e2f`; remaining coders/QA pending
**Role:** `coder`
**References:** `REF-06`, `REF-08`, `REF-12`, `REF-14`
**Prompt:** Build small deterministic paired fixtures, malicious/archive-limit fixtures, and replay traces that exercise arbitrary BeatSaver ID browse/import, local ZIP import, v2/v3/v4 conversion, persistence/reload/delete, all four Boxing candidates, Flow grid behavior, guards, Crossed Guard, straight tolerance, hook/uppercut directions, obstacle coexistence, modifiers, tracking loss, recalibration, theme/background fallback, and iframe commands. Include full local-source regression for `4858` Expert and `3d44b` Hard without committing third-party audio/archive bytes. Expose manual selectors before gameplay and in pause. Include named visual/scoring/converter tuning presets with import/export/reset and active version/hash telemetry. Do not build a survey or durable notes feature.

**Folders Created/Deleted/Modified:**
- Owning repos' `fixtures/`, `.testbed/`, and validation scripts.

**Files Created/Deleted/Modified:**
- Exact files determined during implementation.

**Status:** In Progress

**Blueprint:** Research found the named `AeroPrototypeProfileRegistry` is still missing: renderer has visual tuning round-trip, but gameplay has identity metadata only, authoring lacks converter-profile provenance, and assembly lacks profile UI adapters. After Task 10 closes, implement parallel profile-registry, provider-neutral v2/v3/v4 source-matrix and replay-fixture slices; then renderer/UI adapters and actual-service assembly harness. Use three content-hashed synthetic fixtures (source matrix, gameplay replay, profile bundle), programmatic malicious ZIPs, and local-only real `4858`/`3D44B` audio-backed gates. Converter profiles remain regeneration-required until regenerated package provenance carries the selected hash; no winner, survey or durable notes. The gameplay import hardening, content-hashed authoring converter provenance and renderer live-visual profile adapter are active while the assembly end-to-end harness remains blocked on Task 10. Vendor online/local v2/v3/v4 convergence landed in `017e024`; stable synthetic source SHA-1 evidence is v2 `f8ed950c666baf9148a18e5f3b9731b3f2f23cb0`, v3 `f40cee1a11222c29ccdabb3193c83b9d25a837a4`, and v4 `543164f2a680ea96bc45cf9e9d8b5aad8ba05f7f`. Independent QA passed all functional/security/browser/pack gates but rejected the advertised archive hashes: `fflate.zipSync` encoded wall-clock entry mtimes, so independent invocations changed archive bytes. QA filed blocking `aerobeat-web-vendor-beatsaver-dy7`; repair `7316c13` now fixes exact DOS metadata/order and passes parent 2.2-second byte-identity reproduction with locked archive SHA-1 v2 `c3f76b20a55d917595c4b741519fb8e274001f83`, v3 `1b8f83e061f3c7138c25a4bc5733a845cad6884d`, v4 `90a80f500bc63892657d3dd0609b05f3148026df`; independent QA rerun passed with exact metadata, archive sizes, source/archive/entry hashes, 24 attack cases, browser and narrow-pack boundaries; QA/bug closures landed in `3815118`, parent implementation closure in `416e926`, and the vendor slice is clean/synchronized. Authoring matrix/audio gates landed in `55c7b90` with fixture `sha256:4ccd13b1ff28381b118259b26b817ebd29ca85f0c2ba5f00c46fb74f36284cba`, baseline v2/v3/v4 semantic hashes `sha256:3c0a538741df1df1d52fbe792d87f8414ef43903ace7f5368cfe4f1f568ac3eb` / `sha256:5228b016943c7ecfa64f609863b008b84a9b663b40f6f062485e443d6efa48a6` / `sha256:3df7b31386e60defea3483bc82abab4e0af801695e3d223f45ca275516404dea`, and real audio-backed 4858/3D44B deterministic package/export evidence; all authoring gates pass. Parent review rejected deferring the converter-profile contract because canonical versus prototype-reach settings are material Task 11 conversion controls; P0 `aerobeat-web-content-authoring-rkd` requires exact request→Worker→trace/package provenance binding before QA. Locked semantics: `guardRelocationRadius` is maximum independent per-hand Manhattan subcell displacement from the source guard pair (0..8, existing deterministic tie-break), and `reachAllowanceSubcells` is a bounded additive extension to existing reach subcells per beat (0..8); no-profile conversion alone preserves legacy behavior. Gameplay profile/replay implementation landed in `b153f09` with bundle `sha256:81df0fa01910c08bac660c036be23a1ac1bf3f0e8f62ad3355b9e8362b20ae37` and replay `sha256:b19da85991effb0e51f90d6a70b10ef12610b8a01fe1091c61fecf89b2fb21eb`; coder check/test/integration/browser/pack/diff gates and parent targeted validators pass. Follow-up `f028cfa` fixes inner/outer converter regeneration truth, explicit bundle-version adoption/reset, immutable settings-complete score partitions and Node/WebCrypto hash parity; all coder gates pass. P0 `aerobeat-web-gameplay-g2p` is fixed/closed by implementation `91fec1e` and closure `876b532`: internal default materialization is split from strict public import, exact fields/version compatibility/descriptors/depth/count/string/class/bytes and Node/WebCrypto vectors pass; parent omission regressions and all coder gates pass. Independent gameplay QA remains required. That truthful dynamic converter identity also exposed active contracts P0 `aerobeat-web-contracts-n3j`: coder `9b452904-f1f2-4231-870a-02f143392e2f` is repairing the current public predicate that incorrectly hardcodes every converter identity to regenerationRequired=true while preserving false-only visual/scoring semantics. Authoring commit `3e2dd81` binds exact requested profile identity through independent Worker verification, material reach conversion, chart/trace/package provenance, validation and final main-thread equality; fixture `sha256:211990882cbf18ed36f9563c1175cee805643627ad8e1ba5a87c92a9f4871377` locks 42 semantic hashes and all coder gates including real 4858/3D44B audio-backed legacy parity pass. Authoring P0 stays active for the queued locked guard correction because the landed code still compares 4×3 cell distance rather than per-hand 8×6 subcell Manhattan distance and tests only reach materiality.

**Acceptance:** Fixtures are deterministic and content-hashed; arbitrary compatible maps are not allowlisted; online and local-ZIP acquisition converge on the same source manifest; real local `4858`/`3d44b` conversions prove audio-backed package generation without committed third-party payloads; selectors identify adapter+recipe clearly; all tuning classes distinguish live, between-run, and regeneration-required changes; shadow metrics are hidden from user score and available in diagnostics.

---

### Task 12: Cross-Repo Desktop, Android, Direct-Embed, and Iframe QA

**Bead ID:** `aerobeat-web-assembly-48w.6`
**SubAgent:** DSH QA subagents
**Role:** `qa`
**References:** `REF-01` through `REF-18`
**Prompt:** Independently run every repo-local check/test/browser suite, then verify the highest-fidelity direct and iframe game on current Chromium desktop and Android secure context. Validate arbitrary BeatSaver search/detail/version selection, direct download, local ZIP fallback, hash/archive defenses, conversion progress/cancel, v2/v3/v4 support, IndexedDB persistence/quota/delete, camera permission, calibration geometry, facing/mirroring, exact container sizing, background switching/fallback, theme precedence, Flow, four Boxing candidates, pause/recalibration/countdown, modifier switching, media lease transfer, fullscreen, reconnect, hidden-page behavior, offline/404/429/CORS/codec failures, teardown, telemetry privacy, console noise, and release proof vendor lock. Capture exact evidence and file follow-up Beads for every failure.

**Folders Created/Deleted/Modified:**
- QA artifacts only in approved testbed/release-proof locations.

**Files Created/Deleted/Modified:**
- Plan and Bead evidence updates; code only through follow-up repair Beads.

**Status:** Pending

**Preflight:** Tailscale is healthy with HTTPS capability and certificate domain `derrick-alienware-aurora-r13.tail613fcb.ts.net`, suitable for Android secure-context delivery. No `adb` or system Chromium executable is currently visible in PATH; Playwright Chromium remains available. Physical-device access must be confirmed at execution time. A parent cross-repo run passes unit and browser suites for contracts, BeatSaver vendor, content-authoring (including real `4858`/`3D44B`), content, gameplay public integration, input, video, audio, renderer and UI. Canonical Godot content-core and authoring suites also pass; authoring retains the documented pre-existing 10-resource exit warning with exit code 0. Dry-run package audits, diff checks and clean synchronized worktree checks pass for all ten completed web packages. Assembly remains under Task 10 repair.

**Acceptance:** All required suites pass; desktop and Android evidence covers at least two non-prebundled BeatSaver selections and local ZIP recovery; no allowlist gate exists; no unexpected console warnings/errors; no raw-frame/ZIP/audio bridge payload; release proof still ships only locked MediaPipe CV vendor/runtime assets and declared web BeatSaver/content-authoring dependencies.

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
| Web BeatSaver Vendor | API fixture/browser CORS, hash/version selection, local ZIP, cancellation/retry and malicious-archive tests |
| Web Content Authoring | Worker v2/v3/v4 conversion, Godot golden parity, deterministic hashes/traces, IndexedDB migration/quota/delete/export tests |
| Input | Unit/replay tests for calibration, coordinate transforms, anchor/cell/subcell evidence, tracking lifecycle |
| Content | Package/hash/CORS/variant/lineage tests |
| Gameplay | Deterministic clock/scoring/pause/countdown/ruleset tests |
| Video | Browser media lifecycle, stream injection/teardown, CORS capability tests |
| Audio | Web Audio lifecycle, autoplay/CORS/decode failure, clock continuity, visibility, lease and teardown tests |
| Branding | SVG normalization/currentColor, semantic/monochrome visual distinction, provenance/license audit |
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
