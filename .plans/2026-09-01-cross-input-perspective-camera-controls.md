# Cross-Input Perspective Camera Controls

**Status:** Approved and in progress
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
**Status:** Ready — renderer Task 1 audit PASS

Enable Visual Test debug camera on coarse pointers; replace prose with accessible hold controls and capture/speed state; wire pointer/touch cancellation to renderer intent APIs. Add direct/real-iframe desktop/mobile portrait/landscape DPR coverage without changing scored Play or gameplay truth. Record `0.0.29` camera direction PASS and the remaining control observations accurately; keep `0.0.30` retest Pending.

## Task 3 — Independent QA and deterministic release

**QA Bead:** `aerobeat-web-assembly-3aw`
**Release Bead:** `aerobeat-web-assembly-jiu`
**Status:** Blocked by Task 2

Independently verify real capture/look and held movement, UI accessibility, touch gestures, lifecycle cleanup, presentations and regression matrices. Patch to deterministic `0.0.30`, keep `0.0.29` and earlier releases unchanged, compare two raw builds and two final packs byte-for-byte, retain the one managed Tailscale server tree, and keep physical observations Pending.

## Task 4 — Final audit and closure

**Bead:** `aerobeat-web-assembly-95j`
**Status:** Blocked by Task 3

Audit user decisions, renderer/assembly diffs, physical truth, tests, release metadata, Beads, Git, linked repos and server. Close only on complete PASS. No gameplay/conversion winner or broad visual redesign is part of this iteration.
