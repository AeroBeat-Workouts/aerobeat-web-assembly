# Combined Successor Assembly Integration Map

**Status:** RESEARCH / MAPPING COMPLETE — NO PRODUCTION EDIT
**Date:** 2026-09-09
**Owning repo:** `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`
**Research Bead:** `aerobeat-web-assembly-dqza`
**Integration Bead:** `aerobeat-web-assembly-2ezt`
**Physical umbrella:** `aerobeat-web-assembly-pver`
**Active plan:** `.plans/2026-09-02-handcrafted-3d-gameplay-visuals-and-environment.md`
**Design authority:** `.plans/design/2026-09-09-flow-colliders-and-physical-feedback.md`

## Scope and fixed boundary

This report maps the exact consumer changes required after the approved renderer (`ac0`), gameplay (`8gf`), content-authoring (`9lv`), and content (`4ly`) package commits are pushed. It does not modify production source, package pins, raw releases, serving, builds, publication, or physical-PASS state. Raw `0.0.48` remains immutable and physically rejected.

The combined successor must preserve stable existing internals while adding one explicitly authored collision ruleset. It must not infer Flow Colliders from old package bytes, expose body geometry, silently alter old score partitions, or bypass the existing lifecycle FIFO.

## Current assembly boundaries

### Service creation and dependency ownership

- `src/service-graph.js:createAeroGameServiceGraph()` constructs authoring, content, input, gameplay, and renderer once per connection. No new public service is needed. The assembly should consume new package exports only after their owning commits are pushed.
- `src/index.js` owns orchestration: the lifecycle FIFO, selected content/variant, private content seams, per-frame input advance, gameplay configuration, render projection, private camera deflection, UI controls, and public filtering.
- `src/gameplay-mode-selection.js` owns the assembly-level ruleset selector and ruleset→renderer-presentation mapping.
- `src/game-setup-coordinator.js` owns trusted-child persisted Game Setup state and migration.
- `src/gameplay-visual-runtime.js` is the correct narrow adapter for strict setup→renderer config and private content/input capabilities.
- `src/session-render-projection.js` owns renderer-only target projection, arrival-group metadata, spawn/indexing, and pending/feedback visibility. It must never become scoring authority.

## Required integration changes by concern

### 1. Visible `Flow` → `Flow Grid`, stable internals

**Stable identities:** retain `mode:"flow"`, `flow_grid_v2`, renderer presentation `"flow"`, existing Flow variant IDs/hashes, commands, fallback, and score partitions.

**Assembly files/functions:**

- `src/gameplay-mode-selection.js`
  - Extend `gameplayRulesetIds` with `flowColliders:"flow_colliders_v1"`; do not rename `flow`.
  - `exactGameplayVariant()` must resolve Flow Grid and Flow Colliders as independent exact variants with `recipeId:null`; it must never synthesize Colliders from a Flow Grid variant.
  - `selectedGameplayProfileId()` needs a stable new UI identity such as `flow-colliders`, while existing Flow Grid remains `flow` unless the UI package formally renames only that presentation ID.
  - `rendererPresentationForVariant()` must return `"flow"` for both Flow rulesets.
- `src/index.js:selectGameplayAxes()` currently treats every non-Flow ruleset as Boxing and requires a conversion recipe. Replace that binary test with an explicit `isBoxingRuleset` branch; Flow Colliders accepts no Boxing recipe and must not mutate `lastBoxingRecipeId`.
- `src/index.js:handleUiIntent()` has Flow-only obstacle-mode and Boxing conversion predicates. The obstacle modifier policy must explicitly say whether it applies to both Flow rulesets; recommended: both, because the presentation and authored hazards are shared, while Colliders still owns bomb/wall scoring when obstacles are enabled. Boxing conversion must exclude both Flow rulesets.
- `src/index.js:selectLibraryPackage()` retention/fallback at lines 1637–1662 currently recognizes only `gameplayRulesetIds.flow`. Retain exact `flow_colliders_v1` only if the newly loaded successor package contains that exact variant; otherwise fall back to Flow Grid. Never map a retained Colliders selection to old package Flow Grid and never auto-select Colliders on reimport.
- `src/index.js:flowReimportReason()` and `FLOW_REIMPORT_MESSAGES` need the content/authoring stable `flow_colliders_reimport_required` code so stale v5 packages clear once and present a bounded reimport message.

**External UI dependency not covered by the four named coders:** visible product copy lives in clean sibling `aerobeat-web-ui/src/elements/aero-product-presenters.js`, especially `gameplayModeOptions` (`Flow`) and legacy prototype labels/HUD copy (`Flow · Grid`, `Flow`). Assembly cannot fulfill “visible Flow → Flow Grid everywhere” solely in its own source. A UI package change/pin is required, or an already-supported label injection API must be added. Current UI has no Colliders option. This is a concrete dependency gap in the approved four-coder launch.

**Tests:** `scripts/validate-gameplay-mode-selection.js`, `scripts/validate-product-shell-matrix.js`, `scripts/validate-mobile-gameplay-menu.js`, `scripts/validate-task11-actual-services.js`, `scripts/validate-v4-assembly-integration.js`, plus UI presenter tests. Replace the five-variant assumption with six variants (Flow Grid, Flow Colliders, four Boxing); assert both Flow modes render `presentation:"flow"`, only Colliders selects its exact authored variant, and all visible copy says `Flow Grid` / `Flow Colliders`.

### 2. `flow_colliders_v1` only for reimported successor packages

The in-flight authoring implementation currently proposes `aerobeat.song-package.v6`, `aerobeat.chart.flow.v5`, and a hash-bound ordered `rulesetVariants:["flow_grid_v2","flow_colliders_v1"]`. Content `4ly` must validate that exact contract and materialize two exact variants over the same Flow chart bytes.

**Assembly assumptions that must be verified after `9lv`/`4ly`:**

1. A v6 content snapshot exposes two distinct public variant records with distinct `variantId`, `rulesetId`, `scoreIdentityHash`, `ranked:false/localOnly:true` for Colliders, and identical renderer-relevant resolved events.
2. v5 and older packages remain list/export/delete-only for this feature and selecting them yields exactly `flow_colliders_reimport_required`; old Flow Grid compatibility remains governed by the already-approved prior-package policy rather than runtime promotion.
3. `@aerobeat/web-contracts.rulesetIds` includes `flow_colliders_v1`. The contracts repo is currently clean and no coder is assigned. Both authoring/content validation and assembly `readGameplayRulesetIntent()` depend on this export, so this is another missing prerequisite unless one owning coder explicitly takes it.
4. Content keeps Flow Grid as default selection. Reimport does not auto-select Colliders.
5. Resolved Colliders events use the selected Colliders `variantId/chartId`; gameplay rejects a Grid-tagged event envelope configured under Colliders.

**Assembly files:** `src/gameplay-mode-selection.js`, `src/index.js:selectGameplayAxes()`, `performSelectVariant()`, `selectLibraryPackage()`, `configureGameplayFromContent()`, `flowReimportReason()`, public variant filtering/telemetry, README compatibility text, and release provenance later (not in this research slice).

**Tests:** extend `validate-gameplay-mode-selection.js`, `validate-standard-batch-library.js`, `validate-stale-indexeddb-browser.js`, `validate-product-shell-matrix.js`, `validate-obstacle-public-privacy.js`, `validate-exact-3c9d-browser-pixels.js`, and `validate-v4-assembly-integration.js` with v5 stale rejection, v6 six-variant selection, no auto-promotion, exact fallback, and export/delete preservation.

### 3. Private measured wrist/nose segment evidence, no public leak

The assembly already passes `graph.input.getSnapshot()` to `graph.gameplay.advance()` in `src/index.js:runDisplayFrame()`. The in-flight gameplay coder reads measured `latestEvidence.anchors` plus input `sourceIdentity`, then retains private previous/current wrist samples internally. Therefore assembly should not copy coordinates into renderer frames, setup, events, snapshots, storage, or telemetry.

**Required integration:**

- Prefer a gameplay-owned non-enumerable capability if `8gf` lands one. If `8gf` retains the current `advance({input})` shape, pass the input service’s private gameplay snapshot unchanged only at that call boundary; do not create an enumerable assembly mirror.
- Nose wall evidence remains gameplay-owned through the existing measured obstacle path. Wrist segment history must remain inside gameplay. Assembly forwards only public semantic judgement/hazard counts after filtering.
- `src/index.js:gameplayTelemetry()` and `publicScorePartition()` require updates for bounded Colliders identity and aggregate `bombContacts`; do not include `flowColliderSettings`, radii, direction vectors/tolerance, evidence timestamps, coordinates, contact times, frame/source/calibration IDs, hazard arrays, or diagnostics beyond approved semantic codes.
- `src/index.js:snapshotForType()`, iframe forwarding, `safeData`, content playback, renderer diagnostics, and private performance evidence remain leak boundaries. `rendererFrame()` must not contain collision geometry.
- `src/gameplay-visual-runtime.js` should keep the separate nose-parallax capability; do not overload it with collision evidence. Parallax remains sanitized normalized visual input, not scoring evidence.

**Tests:** `scripts/validate-obstacle-public-privacy.js`, `validate-aero-game-assembly.js`, `validate-gameplay-visual-runtime.js`, `validate-product-shell-matrix.js`, `validate-flow-obstacle-outcomes.js`, and new Colliders direct/iframe privacy scans. Deep-scan snapshots, composed events, iframe messages, storage, exports, logs, renderer `describe()`, and performance evidence for wrist/nose coordinates, segments, radii, vectors, confidence, measurement/frame/source/calibration/contact identities.

### 4. Strict Game Setup v3, defaults, and one-time migration

**Exact target record:**

- `schema:"aerobeat/game_setup"`, `version:3`, storage key `aerobeat.game-setup.v3`.
- Keep `showGameplayGrid`, `noseCameraParallaxEnabled`, spawn override, camera X/Y ranges.
- Remove `arrivalGroupNumbersEnabled`, `attentionHaloEnabled`, and `nextUpRibbonEnabled` completely.
- Add `guidanceBandMode:"off"|"song_beat_grid"|"target_arrivals"`.
- Add bounded run settings for `timingWindowMs`, `colliderRadius`, `enforceAuthoredDirection`, and `directionToleranceDegrees`. Direction tolerance remains persisted/bounded even when enforcement is off, but is semantically inactive and should be disabled in UI.
- Fresh/reset default `showGameplayGrid:false`, `guidanceBandMode:"off"`, parallax off, spawn override off, collider algorithm defaults from gameplay, timing `180`.

**Migration:**

- Read v3 first. If absent, read exact current v2 from `aerobeat.game-setup.v2` using a dedicated exact v2 parser—not the v3 normalizer.
- Valid v2 migrates retained spawn/camera/parallax values, maps `nextUpRibbonEnabled:true` to `target_arrivals` and false to `off`, discards arrival/halo regardless of value, and **forces `showGameplayGrid:false` once**. It must persist v3 immediately.
- Never preserve v2 grid true/false during this migration. This supersedes the old v1→v2 behavior.
- If no v2 exists, optionally recognize exact legacy v1 only through the already-approved chain but still land v3 with grid false. Invalid/newer v3 or invalid old records reset atomically and must not fall through to older state.
- Storage-event handling listens to v3 only and normalizes/removes hostile data without invoking accessors.

**Files/functions:** replace constants/type/default/`normalizeGameSetup()`/`migrateLegacyGameSetup()`/`freezeSnapshot()` in `src/game-setup-coordinator.js`; update setup consumers in `src/gameplay-visual-runtime.js`, `src/index.js`, README, and all fixtures.

**Tests:** rewrite `scripts/validate-game-setup-coordinator.js` with exact v2→v3 truth table, forced hidden grid, ribbon mapping, discarded rejected fields, invalid/newer atomic reset/no fallback, null-prototype acceptance, accessor rejection, cross-tab v3 synchronization, in-memory storage failure, and deterministic JSON. Update all browser fixture storage setup and drawer defaults.

### 5. Remove Arrival numbers/Attention halo; guidance mode replaces ribbon boolean

- `src/gameplay-visual-runtime.js:rendererGameplayVisualConfig()` must call the renderer’s landed strict v2 constructor with `guidanceBandMode`, not old three booleans.
- `src/index.js:installGameSetupControls()` removes the two rejected checkbox rows and replaces Next-up with a select/radio group for Off / Song beat-grid bands / Target-arrival bands.
- `applyGameSetupControl()` and `renderGameSetupControls()` must handle the exact string mode and no rejected fields.
- `src/session-render-projection.js:createSessionTargetIndex()` should remove `arrivalGroupOrdinal` entirely. Retain only a private stable group key for target-arrival grouping if renderer still requires it. Prefer a per-index opaque numeric/string identity not exposed publicly; simultaneous exact timestamps share it.
- Song beat-grid mode needs actual mapped whole-beat timestamps from the content timing mapper. Extend `createSessionTargetIndex()` to precompute a bounded visible-queryable beat sequence or add a pure helper that derives the current bounded range. `rendererFrame()` supplies only the current bounded timestamp array as `guidanceBeatTimestampsMs`; it must not expose it through public state.
- Target-arrival mode continues to use private target group identity. Hazards/checkpoints never carry it.

**Renderer API assumption:** in-flight `ac0` currently changes `createGameplayVisualExperimentConfig(guidanceBandMode, noseCameraParallax, …)` and `AeroGameplayFrame.guidanceBeatTimestampsMs`. Assembly must wait for the pushed export names/signature. Do not retain compatibility calls to the old boolean constructor.

**Tests:** update `validate-gameplay-visual-runtime.js`, `validate-session-render-projection.js`, product/mobile allowlists, visual-correction, exact-3c9d, and renderer browser matrices. Assert rejected strings/config fields/resources/scene kinds are absent; exclusive modes, caps, tempo changes, seeks, restarts, content generations, and hazards behave deterministically.

### 6. Usable bounded number controls in Test and Play

Current primary defect is exact: `.environment-option input` forces all number inputs to `20×20`; Game Setup commits only on `change`; `renderGameSetupControls()` can overwrite a focused uncommitted draft.

**Controls to expose in the shared Game Setup panel (available before and during both Test and Play):**

1. Spawn distance override value: current `[3,72]`, step `.1` world units.
2. Camera horizontal range: current `[0,.9]`, step `.01`.
3. Camera vertical range: current `[0,.6]`, step `.01`.
4. Timing window: exact gameplay-exported bound/default; proposed UI step `1 ms`.
5. Collider radius: exact gameplay-exported bound/default; proposed UI step `.01` logical units.
6. Direction tolerance: exact gameplay-exported bound/default; proposed UI step `1°`, disabled unless authored-direction enforcement is on.

Do not duplicate authoritative bounds in assembly if `8gf` exports them. Import a frozen bounds/default record and use it to create both setup validation and DOM attributes. If gameplay does not export bounds, `8gf` must add a public scalar contract; assembly must not infer bounds from implementation.

**UX implementation:**

- Restrict CSS to `.environment-option input[type=checkbox]`; add a distinct number-row class with native `appearance:auto`, at least 44 px block size, readable 8–10 character width, visible focus/caret/spinners, and responsive `min-inline-size:0`.
- Maintain per-control dirty draft during `input`; commit `valueAsNumber` only if finite, `validity.valid`, range-valid, and step-valid on `change` or Enter. Empty/invalid blur restores authority and shows static inline error. Presenter refresh must not overwrite a focused dirty draft.
- Spawn value is disabled with an explained dependency while override is off. Collider/timing/direction values remain visible in both modes; controls can be disabled when current selected ruleset is not Colliders only if physical tuning requirements still remain reachable by selecting Colliders before Test/Play.
- Settings are run-locked: changing them during an active run must become an ordered future configuration or explicitly request a controlled fresh restart; gameplay `applyFutureContent()` already intends to reject mid-run Colliders-setting mutation. Recommended UI copy: “applies on next Start/Test,” never mutate current score identity.

**Test presentation interaction:** current Test-only JSON separately owns `normalSpawnDistanceWorldUnits`. Keep that renderer authoring field for visual trajectory experimentation only, but make the selected Game Setup spawn override the runtime lead as today. Document precedence and avoid two controls appearing to mutate one authority. Collider tuning belongs to Game Setup/gameplay configuration, not renderer Test JSON.

**Tests:** real keyboard select-all/type/Tab/Enter, native `stepUp/stepDown`, pointer spinner where available, invalid/empty/under/over/step mismatch, focus preservation under presenter refresh, enable/disable dependencies, direct/iframe, desktop/mobile, Test/Play and reconnect. Update `validate-mobile-gameplay-menu.js`, `validate-product-shell-matrix.js`, `validate-real-3c9d-trajectory-controls.js`, `validate-environment-controls-browser.js`, and add a focused Game Setup native-control browser oracle.

### 7. Continuous pending-note projection

Current assembly keeps pending targets through `center + timingWindowAfterMs` but renderer previously clamped unresolved post-center Z. The approved change requires pending notes to keep moving past the plane while still eligible.

- `src/session-render-projection.js:projectSessionTargets()` already accepts a late-window argument and should receive the run-bound setting, not `prototypeJudgementDefaults.timingWindowAfterMs` unconditionally.
- `src/index.js:rendererFrame()` must use the same immutable run configuration supplied to gameplay. Do not read a newly edited setup value mid-run, or renderer eligibility will diverge from scoring. Store a private session-bound presentation settings snapshot when `configureGameplayFromContent()` commits.
- Synthetic Test miss commit cannot remain hard-coded `181`; derive `timingWindowMs + smallest deterministic commit quantum` (currently 1 ms) so Test remains coherent when tuning the window.
- Pending visibility continues through the inclusive boundary; a miss appears atomically on the next strictly-greater timeline sample with the same ID. Projection must not decide a scored miss.

**Tests:** expand `validate-session-render-projection.js` and `validate-real-3c9d-trajectory-controls.js` for `-window`, `0`, `+window`, `+window+1`, same ID, nonzero post-plane Z, gray continuation, setting lock, Test synthetic parity, seek, and renderer direct/iframe pixels. Update stale frozen-at-zero assertions.

### 8. Controlled fresh restart; FIFO/generation

The current restart foundation is already correct and must be extended, not replaced:

- `src/index.js:enqueueLifecycleIntent()` is the single FIFO for content, selection, import/delete, Start, and Test.
- `startSession()` allocates the fresh `sessionGeneration` **inside** its FIFO turn, awaits prior transport/audio/menu/terminal tails, stops stale media, seeks zero, configures selected content, reacquires the exact purpose resources, requests gameplay start, awaits initial audio, and generation-checks every continuation.
- `startFromMenu()` closes only for its exact action ordinal.
- `invalidatePendingSessionStart()`, disconnect teardown, `rollbackUncommittedMediaAction()`, and lease generation prevent stale cleanup from touching a newer run.

**Integration requirement:** Game Setup and gameplay-mode changes must enter this same FIFO. Current Game Setup subscription applies renderer state immediately outside the FIFO; for run-locked collider/timing settings, split persisted desired setup from active session setup. `configureGameplayFromContent()` captures desired settings only within the ordered Start/Test/content configuration turn. UI changes during play update desired state/presentation for the next run but must not mutate active gameplay/renderer timing/collider identity.

`configureGameplayFromContent()` must add `flowColliderSettings` only when `selectedVariant.rulesetId === flow_colliders_v1`; Grid/Boxing configurations omit it. Start/Test always invokes the gameplay configuration before `requestStart`, even when the prior run has the same content/ruleset/settings.

**Tests:** retain all existing product-shell ownership/rejection/same-action rows and add setup-change→Start ordering, mode-change→Test ordering, Test→Test, Play→Play, Test→Play, Play→Test, rejected prior selection, delayed lease/audio/stop, disconnect/reconnect, terminal replay, and stale rollback. Each accepted action yields one fresh assembly/gameplay generation, zero seek, exact package/ruleset/settings, and one matching resource subset.

### 9. Renderer/camera configuration creation

Keep three separate authorities:

1. **Test presentation config** (`createTestPresentationConfig`) for private renderer trajectory/environment authoring.
2. **Gameplay visual config** (`createGameplayVisualExperimentConfig`) for guidance mode and parallax camera constants/ranges.
3. **Gameplay collider settings** (gameplay package constructor/normalizer) for timing, radius, direction enforcement/tolerance and score identity.

`src/gameplay-visual-runtime.js` should expose pure constructor adapters for (2) and (3), importing landed package factories/bounds rather than constructing loose records. `src/index.js:applyGameSetup()` sets only desired visual config while no active run is sensitive; `configureGameplayFromContent()` binds collider settings. `rendererFrame()` uses active run timing plus desired visual guidance/camera only under approved lifecycle rules.

Camera creation remains renderer-owned. Assembly passes only sanitized `{active,xDeflection,yDeflection}` plus a trusted renderer config. It must never pass nose baseline, coordinates, calibration/source/frame identity, collision radii, or screen-space targets. `stopFrameLoop()`, pause/menu/hidden/terminal/disconnect/context loss continue to recenter/reset.

## In-flight contradictions and required reconciliations

### Renderer `ac0` (dirty, uncommitted)

- New scene model/config uses `guidance_band` and strict config v2, but `renderer-facade.js` still contains old `guidance_halo`, `guidance_number_glyph`, `guidance_ribbon`, pools, texture generators, layer routing, cleanup, and diagnostics. The approved requirement is complete removal, not dormant compatibility. `ac0` must delete every old resource/path/string/test before push.
- Assembly currently calls the old boolean constructor. It must not integrate until `ac0` pushes the exact new signature/export.
- Marker parity changes must update assembly’s old `.68` oracle in `validate-real-3c9d-trajectory-controls.js`; wrist expected fill becomes exact song color, nose exact fixed role color.
- Renderer guidance accepts `guidanceBeatTimestampsMs`, but assembly currently never produces it.

### Gameplay `8gf` (dirty, uncommitted)

- Current in-flight file references `normalizeFlowColliderSettings`, `flowColliderSettingsIdentity`, and `flowColliderSettingsForEvent` without definitions in the inspected file; it is not yet an integrable API.
- `evaluateFlowColliderNotesAndBombs()` requires both wrists to be valid before evaluating either. That contradicts independent authored-hand ownership: one fresh valid wrist must be able to hit its notes/bombs even if the other wrist is temporarily invalid. Coverage/outcomes should remain per wrist.
- Sample freshness accepts `ageMs > 150` as stale, making exactly `150` valid, while the existing parallax contract uses strict age `<150`. The design text says maximum gap 150 and separately fresh `<150`; coder/assembly tests must explicitly settle point-age versus segment-gap boundaries and use one documented rule.
- `measuredColliderSample()` converts normalized anchors with hard-coded grid math inside gameplay. This assumes input anchor X/Y are already calibrated canonical normalized coordinates and not screen/provider coordinates. `8gf` must cite/validate that input contract or consume an input-owned private canonical sample seam.
- Direction Y vectors must match the input/Flow authored convention. The in-flight mapping uses `up:[0,1]`; existing source semantics must confirm no double inversion.
- Public contracts currently exclude `flow_colliders_v1`; gameplay JSDoc/casts and validators depend on contracts update.
- Assembly needs exported strict settings constructor, defaults, and bounds. In-flight gameplay currently exports defaults only from an untracked module indirectly (not yet verified through package `src/index.js`).

### Content-authoring `9lv` (dirty, uncommitted)

- It advances package v5→v6 and chart flow v4→v5. This is consistent with reimport-only selection, but content `4ly`, contracts, persistence DB behavior, assembly stale-code mapping, fixtures, and provenance must advance atomically.
- Current `flowContentIdentity()` binds one chart with `rulesetVariants`; content must materialize two variants without duplicating/diverging beat bytes.
- Authoring marks v5 as `flow_colliders_reimport_required`; verify v5 remains export/delete/listable and ordinary Flow Grid behavior matches the project’s global stale-package policy.
- The authoring worktree is still dirty and includes broad fixture/schema edits; assembly must consume only a pushed audited commit/tree.

### Content `4ly` (open, not started)

- Current content accepts only package v5/flow chart v4 and emits only `flow_grid_v2`. Assembly cannot add the selector until `4ly` lands v6 validation/materialization and the private render/timing seams remain generation-bound.
- `4ly` must define whether both variants share `chartId` or use distinct chart IDs. Gameplay event-envelope matching and score identity tests must follow the landed answer.

### Missing owners

- `aerobeat-web-contracts` is clean and lacks `flow_colliders_v1`; an explicit contracts owner is required before authoring/content/gameplay can converge.
- `aerobeat-web-ui` is clean and owns visible Flow labels/options; an explicit UI owner is required for the visible rename and new selector.
- Input may need an owner if gameplay cannot truthfully consume canonical calibrated wrist samples from the existing snapshot without expanding public input state. Do not solve this by leaking coordinates through assembly.

## Deterministic integration order

1. **Freeze external API contracts:** resolve contracts ownership; land `flow_colliders_v1`, strict settings defaults/bounds/constructor, hazard/count public types, and exact privacy shape. No assembly edits before names/shapes are pushed.
2. **Finish authoring `9lv`:** push v6/flow-v5 reimport contract and persistence/migration codes with tests.
3. **Finish content `4ly`:** consume exact authoring schema; materialize exact Grid+Colliders variants, preserve default Grid, private projection/timing seams, stale rejection, and push.
4. **Finish gameplay `8gf`:** consume contracts/content event shape; correct independent-wrist evaluation and boundary semantics; export strict settings API; complete unit/integration/privacy tests; push.
5. **Finish renderer `ac0`:** remove all rejected cue resources/paths, finalize config-v2/guidance frame API and marker colors, validate camera reset/performance, push.
6. **Land UI package change:** visible Flow Grid copy plus Flow Colliders option, with scalar intent only; push. If UI intentionally remains outside the package chain, document and approve an assembly label-injection API first.
7. **Assembly provenance preflight:** all sibling `HEAD==origin/main`, only allowed protected ledger dirt, exact package exports import successfully. Record commit/tree authorities; do not update release pins until all external commits are final.
8. **Assembly pure modules:** update `gameplay-mode-selection.js`, `game-setup-coordinator.js`, `gameplay-visual-runtime.js`, and `session-render-projection.js` plus focused node validators. This establishes strict shape/migration/projection before lifecycle wiring.
9. **Assembly orchestration:** update `index.js` ruleset selection/retention/reimport mapping, desired-vs-active setup binding, gameplay configuration, private frame guidance, sanitized telemetry, controls, and CSS while preserving the existing lifecycle FIFO/restart algorithm.
10. **Assembly browser fixtures:** update six-variant matrices, labels, native numeric controls, stale package/reimport behavior, continuous pending motion, guidance modes, marker exact-color oracle, direct/iframe privacy, restarts, and lifecycle cleanup.
11. **Only after full source QA:** update exact dependency commit/tree pins, README/current source fingerprint inputs, run the approved full unit/browser/hardware/privacy gates, independent audit, and only then authorize the single append-only successor. This report does not perform or authorize those actions.

## Minimum assembly acceptance matrix

- Visible copy is exactly Flow Grid/Flow Colliders; stable Grid internal identity and old partitions remain unchanged.
- Only exact successor packages expose Colliders; old packages never gain it at runtime and produce one bounded reimport reason.
- Grid defaults hidden fresh and is forced hidden exactly once on valid v2→v3 migration.
- Arrival-number and halo fields, DOM, strings, renderer objects/resources, diagnostics, and tests are absent.
- Guidance modes are exclusive and private; song-beat and target-arrival bands are bounded and generation-safe.
- All six numeric controls are readable, keyboard/pointer usable, bounded, draft-safe, and available for Test/Play tuning.
- Run-bound timing/radius/direction settings match renderer eligibility and score identity; edits cannot mutate an active run.
- Pending notes continuously travel through the inclusive late window and transition same-ID to moving gray miss feedback.
- Every accepted Start/Test is an ordered fresh generation after all earlier content/setup/mode intents.
- Wrist/nose geometry and segment evidence remain private; public surfaces expose only approved mode identity and bounded semantic aggregates.
- Renderer/camera config is created only by trusted package constructors; camera deflection stays sanitized and visual-only.
