# Cross-Input Perspective Camera Controls

**Status:** Complete — final independent audit PASS; deterministic `0.0.30` committed/pushed; physical retest remains Pending
**Owner:** assembly orchestrator → renderer/assembly coders → independent QA → final auditor
**Assembly feature:** `aerobeat-web-assembly-lk4`
**Renderer feature:** `aerobeat-web-renderer-vbw`
**QA:** `aerobeat-web-assembly-3aw`
**Release:** `aerobeat-web-assembly-jiu`
**Final audit:** `aerobeat-web-assembly-95j`
**Baseline release:** `0.0.29`
**Target release:** deterministic `0.0.30`

## Goal

Iterate the now-correct PlayCanvas perspective camera from debug tap movement into a predictable cross-input navigation contract. Desktop uses right-click toggle capture plus smooth mouse look and held camera-relative keyboard movement. Mobile uses a two-finger tap to enter/exit capture, one-finger drag to look while captured, and an accessible top-left control pad. Preserve authoritative gameplay, renderer cadence, privacy/lifecycle, all presentations, and the physical Pending boundary.

## Physical input from Derrick

- `0.0.29` camera direction is physically confirmed correct.
- 3D perspective materially improves sight-reading as beats/obstacles approach the threshold.
- Desktop mouse movement did not physically rotate the perspective camera.
- Left/right movement felt reversed.
- Movement occurred as tap/key-repeat steps rather than gradual held movement.
- Selected mouse contract: right-click toggles capture; a second right-click or Escape exits.
- Mobile contract: two-finger tap toggles capture. While captured, one-finger canvas drag rotates the camera.
- Replace the top-left help prose with GUI controls for Forward, Back, Left, Right, Up, Down, Speed, and Reset. Reset remains available. Speed is a two-state Normal/Boost toggle shared by GUI and keyboard Shift behavior.

## Current graphics architecture

- `buildGameplaySceneModel()` derives immutable camera, timing-zone, target, obstacle and grid records from caller-owned song time and chart events.
- Time maps directly to world Z; PlayCanvas does not accumulate gameplay time or own scoring.
- The renderer currently uses pooled primitive box/sphere entities, mostly unlit/emissive role-color materials, and no authored 3D models, shadows, particles or post-processing.
- Flow SVGs are rasterized into an alpha-mask atlas and applied to world-space target meshes.
- Duration obstacles are translucent boxes whose depth is derived from exact interval timestamps.
- The timing floor uses separate late/active/early box segments.
- Transparent entities retain depth tests, disable depth writes, and render far-to-near.
- One manually ticked PlayCanvas application owns the scene/camera/GPU resources. DOM/CSS owns the environment, accessible controls, drawer, HUD and transport around the transparent canvas.

This iteration changes camera interaction only. Broader graphics/readability work remains a later visual-design slice.

## Control contract

### Desktop

- Right mouse `mousedown` on the canvas toggles capture rather than requiring a hold.
- Entering capture requests pointer lock. A second right click and browser Escape/pointer-lock loss exit capture.
- Mouse movement rotates yaw/pitch only while captured.
- `W/S` move along the camera's planar forward axis; `A/D` move along the camera's planar right axis. The corrected camera faces positive Z, so right at reset is world negative X and left is world positive X.
- `Q/E` move down/up on world Y.
- Held keys update intent only; movement integrates continuously once per assembly-owned gameplay render frame using bounded elapsed time. No autonomous renderer RAF/timer is introduced.
- Opposite inputs cancel and diagonal planar movement is normalized.
- Shift selects Boost while held; releasing Shift returns to the current GUI-selected speed state.

### Mobile and DOM controls

- Visual Test exposes the camera panel on coarse-pointer/mobile as well as desktop; scored Play remains fixed-camera.
- A two-finger tap on the canvas toggles touch capture. Gesture duration/motion/touch-count are bounded so pinch/scroll is not misclassified.
- While touch-captured, one-finger drag rotates yaw/pitch; capture exit, menu-open, pause, visibility loss, detach and destroy cancel active touches.
- Top-left help prose is removed. The panel contains accessible hold buttons: Forward, Back, Left, Right, Up and Down; a Normal/Boost toggle; and Reset.
- Pointer/touch hold starts an intent; release, cancel, lost capture, blur, hidden, menu-open, disable, detach and destroy clear it. Buttons must not leave movement stuck.
- The panel publishes capture and speed state through labels/pressed state without exposing raw input or pixels.

## Renderer design

- Track a bounded set of active movement intents and capture/touch state.
- Expose narrow methods for DOM movement intent and GUI speed selection; reject unknown controls and no-op when disabled/destroyed.
- Integrate movement at the start of `renderGameplayFrame()` using a monotonic timestamp and clamped delta. Reset the timestamp on enable/disable so pause cannot cause a jump.
- Derive planar basis from yaw for PlayCanvas's local-negative-Z camera: forward `(-sin(yaw), -cos(yaw))`, right `(cos(yaw), -sin(yaw))` in X/Z. At reset yaw π, forward is +Z and right is -X.
- Apply mouse/touch look deltas to the existing bounded yaw/pitch pose.
- Keep telemetry scalar and bounded: capture mode, GUI boost, active movement count; no event histories.

## Task 1 — Renderer controls

**Implementation Bead:** `aerobeat-web-renderer-vbw`
**QA Bead:** `aerobeat-web-renderer-jb1`
**Audit Bead:** `aerobeat-web-renderer-3ik`
**Status:** Complete — implementation/independent QA/final audit PASS; renderer Beads closed

Renderer commit `adda00e3a79554bbfee206e478ea1b127c62e4fd` adds strict `setDebugCameraMovementIntent()` and `setDebugCameraSpeedMode()` APIs, bounded scalar capture/speed/intent telemetry, right-click toggle pointer capture with fallback, two-finger touch toggle plus captured one-finger look, and continuous caller-frame movement. Normal/Boost are `3.5`/`12` units per second with a `100 ms` delta cap. At reset yaw π, W moves +Z and D moves −X; rotated bases, normalization, opposite cancellation, vertical motion, first-frame/pause safety, and all cleanup paths are covered. Independent QA `11278d3` and final audit `fb103de` reproduced real pointer-lock/fallback/touch yaw changes, gradual frame-rate-independent movement, camera-relative axes, speed states, gesture rejection, full cleanup, existing scene/camera regressions, complete unit/Chromium gates, and deterministic packages. Renderer `vbw`, `jb1`, and `3ik` are closed; final renderer commit `fb103de71a3cc2e3b90587616d7f37ca61f9c282` is clean/upstream and exact pack metadata remains external.

## Task 2 — Assembly control panel and policy

**Bead:** `aerobeat-web-assembly-lk4`
**Status:** Complete — coder and independent assembly QA `3aw` PASS

Assembly replaces the former help prose with one compact, safe-area-aware GUI containing six accessible 44 px minimum hold controls, Normal/Boost, Reset, and bounded capture/speed/active-intent state. Visual Test enables the audited renderer camera on fine and coarse input; scored Play remains fixed. Pointer down/capture and every up/cancel/lost-capture/departure, menu, transport pause, hidden, disconnect/reconnect and destroy path clear DOM and renderer intents. Right-click toggle/Escape/fallback and two-finger toggle/captured one-finger look remain renderer-owned.

Coder validation passed `npm test`, the complete browser chain, all eight direct/real-iframe portrait/landscape DPR1/3 shell and cursor contexts, live `3C9D` Flow (`16` obstacles/`16` volumes), production build, dependency/static/diff checks, linked-repo checks, server checks and `0.0.29` immutability. UI proof requires exactly Forward/Back/Up/Speed/Left/Right/Down/Reset labels, no help paragraph/prose, 44 px minimum controls, no menu/transport overlap, camera-relative held W/A/D, DOM pointer capture/release, `0.35` normal and `1.2` boost movement per 100 ms, real pointer/fallback yaw change and exit, touch capture/look plus invalid-gesture rejection, and complete lifecycle cleanup. Strict renderer-boundary canvas proof remains valid in every context: old yaw is exactly zero non-background/all opaque Aero background while corrected states remain substantial. The physical handoff records `0.0.29` direction PASS and mouse/A-D/step observations Failed/superseded; every `0.0.30` row is Pending with no winner.

Independent QA at candidate `5d171be10682b2b25030f8f988363e17c89a9851` inspected the full `3dbf483..5d171be` diff and ran two standalone shell matrices plus the matrix inside the complete browser chain. All eight direct/real-iframe portrait/landscape DPR1/3 contexts passed exact GUI inventory, minimum size, safe-area/no-overlap, real pointer capture/fallback look and exit, gradual held keyboard and DOM movement, camera-relative A/D, Normal/Boost rate, touch toggle/look/rejection, menu/pause/hidden/reconnect/destroy cleanup, scored isolation, privacy and lifecycle checks. Final complete canvas evidence measured `76,042–690,182` corrected pixels before input, `76,088–688,365` after Reset and `76,170–680,178` after resume; every forced old-yaw sample was exactly zero non-background with a fully opaque Aero background and `[7,20,38,255]` corner. Fresh unit/static, complete browser, live Flow, build, dependency, forbidden-identity and diff gates passed. Package/lock/index/raw `0.0.29` remained unchanged; all linked repos and the retained server were clean/healthy.

## Task 3 — Independent QA and deterministic release

**QA Bead:** `aerobeat-web-assembly-3aw`
**Release Bead:** `aerobeat-web-assembly-jiu`
**Status:** Complete — deterministic `0.0.30` release and independent final audit PASS

Independent QA passed before release. Package, lock, source index, raw HTML and proof surfaces now agree on `0.0.30`; README and the physical handoff describe the cross-input control iteration while retaining `0.0.29` direction PASS/superseded control failures, all `0.0.30` physical rows Pending and no winner. Two raw builds were byte-identical: `13` files, `11,452,934` total bytes, `11,451,568` bytes before the proof, raw-list SHA-256 `51fd57980db14edccb1881dd863c385f3b3e724a71867bde625b892ad1bdcc6f`, proof SHA-256 `3c2ae0a698bf6f57c732259a1c1362bc3d1f97398ab9740ca7419c4faaf9d0a4`, and source fingerprint `b3746ad0042348a64142674d8b9bde669247f88a57e67d774d55804dcfab244b`. Every tracked `0.0.29` byte remained unchanged.

Fresh `npm test`, the exact complete browser chain, all eight direct/real-iframe portrait/landscape DPR1/3 control/canvas contexts, live `3C9D` Flow (`16` obstacles/`16` volumes), production build, dependency, forbidden-production-identity and diff checks passed. Final external dry-pack determinism and exact archive metadata are recorded only on release Bead `jiu` after the committed payload. All linked repos are clean/upstream; the single retained managed server tree and unchanged Tailscale route remain healthy. No npm publish, GitHub Release or public action occurred.

## Task 4 — Final audit and closure

**Bead:** `aerobeat-web-assembly-95j`
**Status:** Complete — independent final audit PASS; `jiu`, `lk4`, and `95j` closed

The final auditor inspected the complete renderer and assembly decision/diff chain and reproduced the exact user contract. Fresh renderer unit/Chromium gates measured real pointer-lock/fallback and touch yaw changes, caller-frame gradual movement, reset-camera D at negative world X, Normal/Boost rates, gesture rejection and complete capture/intent cleanup. Fresh assembly unit, complete browser, live Flow, build, dependency, forbidden-identity and diff gates passed. All eight direct/real-iframe portrait/landscape DPR1/3 contexts retained the exact no-prose accessible GUI, 44 px minimum controls, safe layout, desktop/mobile capture and movement, scored isolation, lifecycle cleanup, and strict canvas validity. In the final matrix every old-yaw sample was exactly zero non-background/all opaque Aero background with corner `[7,20,38,255]`; corrected states measured `76,029–690,115` before input, `76,104–687,262` after Reset and `76,170–677,236` after resume.

The auditor rebuilt raw `0.0.30` twice; both rounds were byte-identical to each other and the committed 13-file tree: `11,452,934` total bytes, `11,451,568` pre-proof bytes, proof SHA-256 `3c2ae0a698bf6f57c732259a1c1362bc3d1f97398ab9740ca7419c4faaf9d0a4`, source fingerprint `b3746ad0042348a64142674d8b9bde669247f88a57e67d774d55804dcfab244b`, and auditor SHA-list hash `7e450afe15cc3f032031db71880a2f8d0669cd942793a6dc1cf5ac404e840895`. Every tracked `0.0.29` byte remained unchanged. Package, lock, source index, raw index and proof all agree on `0.0.30`; all 14 linked repos are clean/upstream at their audited commits. Exactly one retained managed server tree (`npm` PID `3901811` → shell `3901822` → Vite `3901823`) serves local and unchanged Tailscale routes with HTTP `200`. Final pack metadata is recorded externally after the closure commit, with no later packed-file edit. No npm publish, GitHub Release or public action occurred. Derrick's `0.0.29` observations remain truthful, every `0.0.30` physical row remains Pending, and no gameplay/conversion winner or broad visual redesign is inferred.
