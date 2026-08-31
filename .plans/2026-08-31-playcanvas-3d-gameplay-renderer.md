# PlayCanvas 3D Gameplay Renderer Conversion

**Status:** Approved and in progress
**Owner:** assembly orchestrator → renderer/transport coders → independent QA → final auditor
**Umbrella Bead:** `aerobeat-web-assembly-6nt`
**Renderer Bead:** `aerobeat-web-renderer-jzd`
**UI migration Bead:** `aerobeat-web-ui-58j`
**Target release:** deterministic patch after `0.0.27`

## Goal

Replace the legacy custom WebGL2 2D/2.5D gameplay renderer with one source-controlled npm PlayCanvas Engine scene plus stable DOM UI for Flow, Boxing Lanes, and Boxing Grid. Repair terminal Visual Test replay first, preserve authoritative 4×3 gameplay/scoring and all lifecycle/privacy/variant contracts, then release the conversion with independent QA/audit while every new physical observation remains Pending.

## Approved decisions

- PlayCanvas Engine is locked; skip the Three.js/Babylon/custom-WebGL comparison spike.
- Use the npm engine inside the existing Vite/Web Component architecture; do not adopt the hosted PlayCanvas Editor or cloud project workflow.
- Do not retain a production legacy 2D/2.5D gameplay renderer, compatibility route, or fallback renderer.
- One PlayCanvas renderer supports Flow, Boxing Lanes, and Boxing Grid.
- PlayCanvas owns the gameplay canvas/scene, camera, GPU resources, world-space entities, and Test debug-camera input. DOM remains authoritative for drawer, transport, status, countdown/calibration cues, and other accessible shell UI.
- Gameplay/content/audio remain authoritative. PlayCanvas never owns scoring, hit/dodge eligibility, chart truth, or an accumulated gameplay clock.
- The existing `dev:tailscale` process must not be stopped, restarted, or duplicated.
- No gameplay or conversion winner is selected.

## World and timing contract

- World X maps canonical columns `0..3`; world Y maps canonical rows `0..2`; world Z maps time/depth.
- The fixed athlete camera looks down the time axis toward future targets. The exact top-left athlete-space 4×3 orientation remains unchanged.
- Every frame derives object Z directly from the authoritative external session/audio timeline and target timestamp. Frame-delta accumulation must not determine gameplay position.
- A fixed colored floor depth band visualizes the authoritative early/late interaction window. It extends across the lanes and remains visible in perspective.
- Notes are interactable only according to gameplay truth while their timestamps overlap the window; after the late boundary they become an unambiguous spent visual before bounded culling.
- Flow obstacles are translucent 3D volumes. Their Z extent derives from authoritative `centerTimestampMs→endTimestampMs`; overlap with the timing zone visualizes the dodge interval without changing gameplay eligibility.
- Flow and Boxing Grid use the canonical 4×3 interaction gate. Boxing Lanes retain two semantic tracks and their authoritative asymmetric timing window, now rendered in the same perspective scene.
- Existing canonical atlas masks, role colors, directional rotation, feedback timing, gameplay cursors, theme/tuning identities, and omission of unsupported Flow bomb/arc/burst events remain truthful unless this plan explicitly replaces their visual mechanism.
- Timing circles/rings are removed once the floor timing zone and crossing/spent states are proven clear.

## Camera and input contract

- Play/scored sessions and mobile Test use the fixed athlete camera only.
- Visual Test on desktop supports an isolated debug camera: hold right mouse for look/pointer lock, `WASD` movement, `Q` down, `E` up, Shift boost, and a DOM reset-camera action.
- Debug-camera input never reaches gameplay scoring/input, never changes the audio clock, is rejected outside Visual Test, suppresses the context menu only while applicable, and releases pointer lock/listeners on pause, hidden, disconnect, destroy, or session replacement.
- Scrubbing reconstructs the exact scene and renders once while paused regardless of active camera.

## Task 0 — Terminal Visual Test replay repair

**Bead:** `aerobeat-web-assembly-6nt.1`
**Status:** Complete — independent QA/audit PASS; Bead closed

### Result

- Normalized every current non-`paused_manual` Visual Test state, including terminal `completed`, through the generation-bound serialized transport pause before seeking.
- Added exact-end backward replay coverage with coalesced multi-scrub, zero, repeated terminal cycles, exact-duration boundaries, continuous multi-frame advancement, and zero gameplay score/judgement truth while retaining the existing race, reconnect, pause-after-scrub, Play-failure, and scored-Play guards.
- Coder gates passed: `npm test`, focused `node scripts/validate-mobile-gameplay-menu.js`, and `git diff --check`.
- Independent focused QA passed the complete terminal replay/race/score matrix. Its requested full browser run was invalid because assembly consumed the concurrently mutating `file:../aerobeat-web-renderer` checkout; six diagnostic loads produced identical non-empty atlas alpha before Vite failed when the PlayCanvas migration removed a linked legacy module mid-run. No threshold/product workaround was made. Discovered Bead `aerobeat-web-assembly-6nt.5` records the diagnosis. Final QA/audit against immutable clean renderer/UI commits repeatedly passed displayed directional-atlas pixels and the complete browser matrix, closing `6nt.5` as an environment-isolation defect rather than a product race.

### Work

- Reproduce the exact end→seek-back→Play failure against the current `0.0.27` transport.
- Diagnose the gameplay/audio terminal latch before editing.
- Seeking below duration must clear terminal state, seek audio, synchronize the paused gameplay clock, reconstruct/render, and remain paused.
- The next Play must resume continuous external-clock advancement without weakening generation serialization or scored-Play rejection.

### Acceptance

- Browser regressions cover end→seek back→Play, end→multi-scrub→Play, end→zero→Play, repeated terminal cycles, and exact-duration behavior.
- Existing Pause→coalesced Seek, deferred Play→Seek, stale session replacement, reconnect, unscored Test, and scored-Play guards pass.
- Independent QA and audit pass before closure.

## Task 1 — PlayCanvas renderer replacement

**Bead:** `aerobeat-web-renderer-jzd`
**Status:** Complete — final correction QA/audit PASS; renderer Beads closed

### Work

- Add PlayCanvas as the renderer package runtime dependency and replace `AeroWebGl2Renderer`/`aero.renderer.webgl2` with explicit PlayCanvas identities.
- Preserve the per-game instance, exact canvas sizing/DPR, theme/tuning, atlas, diagnostics, context loss/restoration, detach/destroy, and screenshot-free deterministic planning seams where still useful.
- Implement the shared 3D world, fixed athlete camera, lane/grid floor, timing zone, canonical icon entities, translucent obstacle volumes, feedback/spent states, and Test debug camera.
- Render Flow, Boxing Lanes, and Boxing Grid through the same engine and delete custom gameplay shaders/programs/draw paths.
- Keep normalized landmark/debug overlay scope truthful; do not introduce camera/media ownership.

### Acceptance

- No production custom legacy gameplay renderer path/export/service identity remains.
- Deterministic tests prove timestamp→Z, exact 4×3 orientation, timing-zone bounds, obstacle volume interval, far/near ordering, spent/cull boundaries, all three styles, canonical icons, DPR/aspect behavior, camera gating/input cleanup, context recovery, and idempotent teardown.
- Chromium pixel/scene evidence covers direct representative portrait/landscape DPR1/3 cases without screenshot data entering public state.
- Renderer repo is clean/upstream after independent QA/audit, with npm pack determinism recorded externally.

**Research result (2026-08-31):** the existing authoritative frame record and per-instance canvas lifecycle are the correct migration seam. The new public identity is `AeroPlayCanvasRenderer` / `createAeroPlayCanvasRenderer` / `aero.renderer.playcanvas`; `buildGameplaySceneModel` replaces the 2.5D draw plan with screenshot-free world-space truth. PlayCanvas must not start a second RAF, acquire a second context, own song time, or hardware-instance depth-sorted translucent volumes. The implementation must explicitly preserve transparent camera composition, synchronous façade destruction, recreatable assets/context recovery, exact DPR sizing, and bounded target pooling. Research also found a direct renderer consumer in the UI media-pose preview, requiring the following linked migration rather than a compatibility alias.

**Implementation result (2026-08-31):** renderer commits `a9c5bb0` and first-call presentation correction `eb1ea93` are pushed clean/upstream. PlayCanvas 2.21.4 now owns all three world presentations; the legacy gameplay plan/export/service identity is deleted. Unit and Chromium gates pass with two isolated applications, zero engine RAF, first-call plus portrait/landscape DPR1/3 displayed alpha pixels, timing floor, duration volumes, overlays, Test camera cleanup, context recovery, reconnect/destroy, and zero console noise. Two final dry-pack JSON runs were byte-identical; exact metadata is recorded only in Bead `aerobeat-web-renderer-jzd`. Independent QA then found that Spatial Grid floor/state cells and multi-row Flow obstacle volumes discarded authoritative row Y, collapsing 12 cells to four X positions. Discovered P0 Bead `aerobeat-web-renderer-3vk` owns the repair. Commit `ba9a8b9` restores all 12 X/Y positions, state rows, and row-distinct duration volumes with unit and displayed Chromium proof. Independent correction QA passed the focused geometry and complete renderer matrix. Subsequent UI QA discovered detached pointer-lock telemetry evaluated `null === null`; discovered P0 Bead `aerobeat-web-renderer-9j5` was repaired at `8730e8e` with real RMB lock and disabled/detached/destroyed false-state browser proof. Independent second correction QA passed real owned RMB lock plus disabled/detached/destroyed false states and the complete renderer/linked-UI matrix. Final audit then found RMB-up did not exit lock despite the approved hold-to-look contract; discovered P0 Bead `aerobeat-web-renderer-ckr` was repaired at `7853584` with real mouse-down acquisition, held mouse-look, mouse-up release, and no post-release look proof. Independent final correction QA passed the real held-only pointer-lock/look contract, lifecycle cleanup, complete renderer/linked-UI matrix, and deterministic package. Final audit passed all Task 1 acceptance criteria and closed implementation Bead `aerobeat-web-renderer-jzd` plus discovered defects `3vk`, `9j5`, and `ckr`.

## Task 1.5 — UI media-preview migration

**Bead:** `aerobeat-web-ui-58j`
**Status:** Complete — correction QA/audit PASS; Bead `aerobeat-web-ui-58j` closed

### Work

- Replace the UI package import and lifecycle use of `createAeroWebGl2Renderer` with the new PlayCanvas renderer API.
- Preserve the stable media preview canvas, normalized landmark overlay, exact resize, detach/destroy, accessibility, and zero media/camera ownership.
- Remove every UI reference to the legacy renderer rather than retaining an alias.

### Acceptance

- UI checks/browser tests pass against the pushed renderer package.
- Media-preview pose pixels and lifecycle remain truthful in direct/iframe assembly tests.
- UI repo is independently QA/audited, committed, pushed, and clean/upstream.

**Implementation result (2026-08-31):** UI commit `8300726` is pushed clean/upstream. The stable media preview now owns `createAeroPlayCanvasRenderer`, retains caller-owned normalized landmark rendering and exact DPR sizing, and rejects every old renderer identity. Direct Chromium DPR2 evidence covers displayed partial-alpha landmarks, seven semantic points, stable canvas/facade reconnect, detach/reattach truth, and zero renderer RAF. UI unit/browser checks and two deterministic dry-pack runs pass; exact pack metadata is external in Bead `aerobeat-web-ui-58j`. Independent QA found only the renderer pointer-lock telemetry dependency defect; renderer commit `8730e8e` fixes it and UI commit `3bf327f` adds detached/reconnected false-state regression assertions. Independent correction QA passed the full UI matrix and exact iframe context-loss, detach, reconnect, destroy, and pointer-lock lifecycle probe against renderer `8730e8e`. Independent audit passed all Task 1.5 acceptance criteria, re-ran unit/browser/dependency/diff/deterministic-pack gates, and closed Bead `aerobeat-web-ui-58j`.

## Task 2 — Assembly, DOM, and gameplay integration

**Bead:** `aerobeat-web-assembly-6nt.2`
**Status:** Complete — independent QA/audit PASS; Bead closed

### Work

- Consume the pushed PlayCanvas renderer and remove all assembly assumptions tied to the old renderer name/capabilities/2.5D plan.
- Publish authoritative timing-window scalars and world-ready target intervals without moving score ownership into the renderer.
- Preserve stable canvas plus stable DOM environment/HUD/drawer/transport/status surfaces.
- Route Test-only debug-camera enable/reset and pointer-lock lifecycle without expanding serializable public snapshots beyond bounded scalar identities/telemetry.
- Keep display rendering independent of ≤15 fps CV and driven by authoritative audio/session time.
- Update README, focused handoff, release proof, and direct/iframe test matrix.

### Acceptance

- Flow, Boxing Lanes, and Boxing Grid plus Balanced Height/Source Height conversions all render through PlayCanvas.
- Direct/iframe portrait/landscape DPR1/3, menu pause/resume, hidden recovery, lease transfer, reconnect, teardown, context loss, audio-only Test, scored Play, and privacy/console gates pass.
- Test free-fly works only in Visual Test; fixed athlete camera remains the gameplay/mobile default.
- Legacy renderer references and 2.5D timing circles are absent from production assembly.

### Coder result (2026-08-31)

Assembly now constructs only `createAeroPlayCanvasRenderer`, consumes truthful scene-model/status returns, supplies authoritative timing bounds for all presentations, and publishes exact Flow obstacle start/end intervals. Caller-owned display ticks, external audio/session time, stable surfaces, scoring/input privacy, all five variants, terminal Test replay, and the DOM-owned shell remain authoritative. Visual Test on fine-pointer desktops exposes DOM help and Reset camera while assembly enables the isolated renderer debug camera; Play, menu-open, teardown, destroy, and mobile/fixed-camera states disable it.

Source/unit/browser/build/raw-release/dependency/static-search gates pass. The browser suite covers direct/iframe portrait and landscape at DPR1/3, displayed PlayCanvas pixels, exact current-input cursor projection, all shell/lifecycle/privacy paths, and the Task 0 terminal replay matrix. Bug Bead `aerobeat-web-assembly-pke` diagnosed and closed the finite-pose shell fixture defect with a fixture-owned monotonic ≤15 fps source: direct DPR3 passed twice, iframe DPR3 passed twice, and the complete eight-context shell matrix passed without a production tracking workaround. Repeated raw release proof output matched; unreleased `0.0.27` generated artifacts were restored because Task 3 owns the next patch release. Exact dry-pack metadata remains external in Bead evidence.

### Independent QA result (2026-08-31)

QA Bead `aerobeat-web-assembly-0qp` independently passed commit `2626f33bfeb981c621c469b77ea4c31534b45c4f` against clean pinned renderer `78535847eee4869c211f1300842a73d48eec03f5` and UI `3bf327f1b36fb4a9d41be2dc9bb8b61786a4edc1`. `npm test`, the complete `npm run test:browser` chain, `npm run build`, `npm ls --all`, `npm run test:live-flow-obstacles`, and `git diff --check` all exited successfully. Browser output explicitly passed all eight direct/iframe portrait/landscape DPR1/3 shell contexts and cursor contexts, compositor pixels, console/privacy/lifecycle checks, Visual Test camera help/reset and PlayCanvas identity, tracking-loss cursor clearing, and the immutable terminal end→multi-scrub/zero/exact-end→Play replay matrix with zero scoring truth. Static inspection found no forbidden legacy renderer identity under production `src/` or validation `scripts/`; assembly constructs only `createAeroPlayCanvasRenderer`, publishes authoritative timing windows and exact obstacle intervals, and disables the debug camera before renderer teardown. Live map `3C9D` Easy produced 16 obstacles and 16 truthful volumes. Build emitted only PlayCanvas/Vite externalization and chunk-size warnings; `npm ls --all` emitted expected optional-platform/peer notices while exiting zero. No old `0.0.27` release artifact changed, physical phone checks remain Pending, no winner is selected, both dependency repos remain clean/upstream, and retained `dev:tailscale` PID `2972964` remained healthy.

### Independent audit result (2026-08-31)

Audit Bead `aerobeat-web-assembly-shx` independently reviewed terminal replay commit `b43c6b2`, PlayCanvas integration commit `2626f33`, QA evidence commit `631ad01`, implementation/QA Beads, and the complete production/test diff. The auditor re-ran `npm test`, `npm run test:browser`, `npm run build`, `npm ls --all`, and `git diff --check`; every process exited successfully. Exact browser output again passed all eight direct/iframe portrait/landscape DPR1/3 product-shell and cursor contexts plus compositor pixels. Source/static inspection confirmed the exact 4×3 top-left projection, all Flow/Boxing/conversion choices, authoritative external-time timing bounds and duration intervals, Visual Test-only hold-RMB/WASD/Q/E/Shift/reset/help gating with teardown cleanup, DOM/privacy ownership, zero production legacy renderer identities, and no gameplay/conversion winner. Recorded repeated pack and raw-release hashes were inspected without regenerating the shipped `0.0.27` artifacts. Renderer `7853584` and UI `3bf327f` remained clean/upstream, `release/raw/0.0.27` remained unchanged, and retained `dev:tailscale` PID `2972964` returned HTTP 200 without restart. Only expected PlayCanvas optional worker externalization/chunk-size and npm optional-platform notices remain; physical phone checks are still explicitly Pending.

## Task 3 — Independent QA and deterministic release

**Bead:** `aerobeat-web-assembly-6nt.3`
**Status:** Independent release QA PASS — `0.0.28` awaiting final audit; physical checks remain Pending

### Work

- Run fresh unit, complete browser, exact live 3C9D Flow, build, diff, raw-release, and dry-pack validation.
- Add explicit browser proof for terminal replay, timestamp-driven 3D motion, timing-zone crossing/spent states, duration-aware obstacles, all three presentation modes, fixed/debug cameras, input cleanup, and DOM accessibility.
- Patch from `0.0.27` using the established deterministic workflow.
- Create a focused phone checklist whose observations are all Pending for Derrick.
- Keep exact final pack metadata only in external Beads; do not self-reference a packed plan/README/docs payload.

### Acceptance

- Two raw releases and two final committed-payload dry packs compare byte-for-byte.
- Package/lock/index/proof version surfaces agree.
- All relevant repos are clean/upstream and the existing secure server remains healthy and unchanged.
- Automated evidence claims no physical phone pass and no gameplay/conversion winner.

### Release coder result (2026-08-31)

Release ownership patched all package/lock/index/proof surfaces from `0.0.27` to `0.0.28`, generated the intentional raw unminified browser proof under `release/raw/0.0.28`, and left every tracked `0.0.27` artifact byte-unchanged. `npm test`, the complete eight-context `npm run test:browser` chain, exact live `3C9D` Easy Flow obstacle projection, `npm run build`, `npm ls --all`, forbidden legacy-identity search, and `git diff --check` pass. Two raw release constructions produced the same recursive byte manifest (`e2fb7a38a293260c5b6a41a1d5b39db44f76828c84b0f4d4e38087c6a71bd822`); the proof records source fingerprint `b1bf3a8c2f631e6058be8493cba3a44a8c3742d0b9b1dc12569bd42851814a77` and `11404580` artifact bytes before the manifest. Final committed-payload dry-pack evidence and exact metadata are recorded only in external Bead `aerobeat-web-assembly-6nt.3`, not in this packed plan or other packed docs. The focused `0.0.28` phone checklist covers PlayCanvas Flow/Boxing, 3D timing-floor states, duration intervals, fixed/debug camera boundaries, transport, input cleanup, scoring/privacy, and keeps every observation explicitly Pending without selecting a gameplay or conversion winner. Renderer `7853584` and UI `3bf327f` remain pinned clean/upstream; the retained `dev:tailscale` PID `2972964` returns HTTP 200 without restart.

### Independent release QA result (2026-08-31)

Independent QA reproduced the complete unit and browser suites to exact process exit, including terminal replay, all eight direct/iframe portrait/landscape DPR1/3 shell and cursor contexts, compositor pixels, PlayCanvas presentation/timing/duration/camera/input cleanup, DOM accessibility, lifecycle, privacy, and no-winner coverage. Exact live `3C9D` Easy remained 16 obstacles/16 volumes; production build, dependency tree, diff/static checks, linked renderer unit/browser gates, and package/lock/index/proof agreement passed. Two fresh raw constructions were byte-identical to each other and the committed `0.0.28` tree, while tracked `0.0.27` stayed unchanged; two committed-payload dry-pack JSON outputs were byte-identical and matched the coder metadata recorded only in external QA Bead `aerobeat-web-assembly-2dl`. Renderer `7853584` and UI `3bf327f` remained clean/upstream, and retained server PID `2972964` returned HTTP 200 without restart. Every phone observation remains Pending and no gameplay or conversion winner was selected.

## Task 4 — Final audit and closure

**Bead:** `aerobeat-web-assembly-6nt.4`
**Status:** Blocked by Task 3

### Work

- Independently audit the user decisions, complete cross-repo diffs, transport diagnosis, renderer deletion/replacement, timing/camera contracts, tests, release, Beads, Git, server, and physical boundary.
- Reproduce focused high-value gates and final deterministic artifact metadata.
- Record exact final archive evidence externally and make no later packed-file edit.

### Acceptance

- Every plan requirement has independent evidence.
- Implementation/release Beads close only on PASS.
- Umbrella closes only after orchestrator verifies the auditor, clean/upstream repos, healthy retained server, and Pending handoff.

## Required regression matrix

- Exact BeatSaver `3C9D` Easy Flow chart still produces 16 obstacles/16 truthful volumes and preserves canonical top-left 4×3 orientation.
- Unsupported Flow bomb/arc/burst events remain omitted rather than reinterpreted.
- Gameplay scoring and feedback remain authoritative and camera-independent.
- Flow, Boxing Lanes, Boxing Grid, Balanced Height, and Source Height remain available; no winner is selected.
- Visual Test remains audio-only, camera-free for athlete tracking, unscored, non-persistent, and live-scrubbable; desktop debug-camera controls do not change that resource/privacy boundary.
- Scored Play remains non-scrubbable and requires its existing camera/calibration/countdown path.
- Existing MediaPipe Lite production lock and ≤15 fps inference submission ceiling remain unchanged.

## Execution workflow

For each implementation slice: coder implements and pushes → independent QA reproduces highest-fidelity behavior → auditor reviews diff/evidence and closes only on PASS. Beads/Dolt, this plan, and Git are durable state. The existing secure server is observed but never restarted as part of this conversion.
