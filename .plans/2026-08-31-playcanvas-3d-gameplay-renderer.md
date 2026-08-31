# PlayCanvas 3D Gameplay Renderer Conversion

**Status:** Approved and in progress
**Owner:** assembly orchestrator → renderer/transport coders → independent QA → final auditor
**Umbrella Bead:** `aerobeat-web-assembly-6nt`
**Renderer Bead:** `aerobeat-web-renderer-jzd`
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
**Status:** Pending coder

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
**Status:** Pending coder

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

## Task 2 — Assembly, DOM, and gameplay integration

**Bead:** `aerobeat-web-assembly-6nt.2`
**Status:** Blocked by Tasks 0–1

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

## Task 3 — Independent QA and deterministic release

**Bead:** `aerobeat-web-assembly-6nt.3`
**Status:** Blocked by Task 2

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
