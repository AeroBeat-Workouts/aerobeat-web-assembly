# AeroBeat Live MoveNet Inference

**Date:** 2026-08-24
**Status:** In Progress
**Last Updated:** 2026-08-24 14:47 EDT
**Blocked Reason:** Waiting on Derrick's physical Android Chrome verification of `0.0.6` overlay fidelity for `oc-hmt`; automation can verify package wiring, counters, and version proof, but not real phone landmark alignment/latency/readability.
**Agent:** cookie

---

## Goal

Split the web media/rendering layers into their final package shape, then replace the current live camera frame sampler checkpoint with truthful live MoveNet pose inference on the phone-testable AeroBeat web route, including a visible live/video preview with WebGL2 landmark overlays so geometry can be verified visually.

---

## Overview

AeroBeat currently proves that the mobile browser receives a fresh build, can request camera permission, keeps the accepted camera stream alive, and continuously samples live video frames. That checkpoint is useful, but the visible pose values are still sampler-derived proxy data rather than MoveNet inference output.

This plan moves the next slice through final-shape package boundaries instead of hiding media/model/render work inside the assembly app shell. `aerobeat-web-video` should own browser video/camera/replay media lifecycle behind an AeroBeat playback facade, `aerobeat-web-audio` should own Web Audio/song-clock/audio playback foundations, `aerobeat-web-renderer` should own the WebGL2 layer singleton and landmark overlay renderer, `aerobeat-web-vendor-movenet` should own the TensorFlow.js/MoveNet adapter, `aerobeat-web-cv` should own video-frame-to-normalized-pose orchestration, `aerobeat-web-input` should continue consuming normalized frames, `aerobeat-web-ui` should compose the visible preview/debug components, and `aerobeat-web-assembly` should wire those pieces into the visible mobile route with version/cache proof.

The Godot reference split matters here: generic video playback owns media lifecycle and surfaces, camera tracking/CV owns normalized tracking frames and source coordination, and the preview presenter overlays normalized landmarks on the active media surface. The web translation should preserve that separation even though browser-native `HTMLVideoElement`, `MediaStream`, `HTMLAudioElement`, and Web Audio do not require separate vendor repos. Those built-in primitives belong behind AeroBeat-owned `web-video` and `web-audio` packages so a future vendor-backed implementation can swap behind the same facade.

Because AeroBeat gameplay is intended to render through WebGL2, the durable landmark visualization should not be a 2D canvas overlay. A 2D canvas may remain a short-lived test helper, but the final-shape slice should introduce `aerobeat-web-renderer` now and make the preview overlay use its WebGL2 singleton/renderer facade. That keeps camera/video presentation, pose debug landmarks, and future gameplay rendering moving toward the same graphics ownership model.

The first acceptable result is a phone-visible checkpoint where tapping `Begin calibration` starts the live camera, the camera indicator remains active while the page is inferencing, visible frame/inference counters continue changing, the pose-flow source makes clear that frames are coming from live MoveNet inference rather than replay or sampler proxy data, and the user can see the active live camera/video/replay feed with landmark/skeleton overlays. If the model cannot load on device, the UI must show a truthful failure or fallback state, not silently show replay/proxy values as live inference.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Assembly route, current live frame sampler, visible build proof | `src/index.js` |
| `REF-02` | Assembly README describing current sampler checkpoint and validation commands | `README.md` |
| `REF-03` | CV service boundary that owns camera lifecycle and normalized pose production | `../aerobeat-web-cv/src/index.js` |
| `REF-04` | MoveNet vendor adapter boundary that must isolate TensorFlow.js/MoveNet details | `../aerobeat-web-vendor-movenet/src/index.js` |
| `REF-05` | Input routing boundary that consumes normalized pose frames | `../aerobeat-web-input/src/index.js` |
| `REF-06` | Godot video playback split: generic media lifecycle/surfaces behind tool facade | `../aerobeat-tool-video-player/README.md` |
| `REF-07` | Godot camera tracking split: CV service, source coordination, preview presenter, overlays | `../aerobeat-tool-camera-tracking/README.md` |
| `REF-08` | Godot preview presenter: media surface plus pose/hand landmark overlay mapping | `../aerobeat-tool-camera-tracking/src/CameraTrackingPreviewPresenter.gd` |
| `REF-09` | Archived web polyrepo architecture listing planned web audio and live/video/replay expectations | `../.plans/archive/2026-08-23-aerobeat-web-polyrepo-architecture.md` |
| `REF-10` | Public web architecture docs naming Web Audio ownership | `../aerobeat-web-docs/docs/architecture/web-polyrepo-architecture.md` |

---

## Tasks

### Task 1: Scaffold Web Video Facade

**Bead ID:** `oc-msz`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-01`, `REF-02`, `REF-06`, `REF-07`, `REF-09`
**Prompt:** Run as the `coder` role on `primary`. Read the AeroBeat root README and the READMEs for `aerobeat-web-assembly`, `aerobeat-tool-video-player`, and `aerobeat-tool-camera-tracking` before editing. Claim the assigned bead on start with `bd update <id> --status in_progress --json`. Create the new `aerobeat-web-video` repo/package in the AeroBeat workspace using the existing web package conventions. Its public API should own browser-native video/camera/replay media lifecycle, source descriptors, fit/mirroring metadata, stream retention/teardown, and an attachable media surface facade suitable for live camera, loaded video, and replay video. Do not put MoveNet inference or gameplay input routing here. Include README/package/tests/validators consistent with sibling web packages, preserve future vendor-swap wording, and commit/push before handoff unless blocked.

**Folders Created/Deleted/Modified:**
- `../aerobeat-web-video/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `../aerobeat-web-video/README.md`
- `../aerobeat-web-video/package.json`
- `../aerobeat-web-video/src/index.js`
- validator/test files as needed
- `.plans/2026-08-24-live-movenet-inference.md`

**Status:** ✅ Complete

**Results:** `aerobeat-web-video` was scaffolded and pushed as `@aerobeat/web-video`. Parent verification confirmed the package exports live camera, loaded video, and replay video source descriptors plus a browser media facade for permission request, retained stream attach, loaded video attach, play/pause/seek, surface descriptors, fit/mirroring metadata, and stream teardown. Validation passed: `npm run check`, `npm test`, and `npm run test:browser`. Commit: `68aee88` (`Scaffold AeroBeat web video facade`). Bead `oc-msz` was reported closed locally; `bd dolt push` remains blocked by the known no-common-ancestor divergence.

---

### Task 2: Scaffold Web Audio Facade

**Bead ID:** `oc-eqq`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-09`, `REF-10`
**Prompt:** Run as the `coder` role on `primary`. Read the AeroBeat root README, archived web architecture plan, web architecture docs, and sibling web package READMEs before editing. Claim the assigned bead on start with `bd update <id> --status in_progress --json`. Create the new `aerobeat-web-audio` repo/package in the AeroBeat workspace using existing web package conventions. Its public API should establish Web Audio/song playback/clock/timeline foundations and source descriptors without implementing gameplay scoring or CV. Keep it AeroBeat-owned over browser-native primitives with a future vendor-swap seam only where realistic. Include README/package/tests/validators consistent with sibling web packages and commit/push before handoff unless blocked.

**Folders Created/Deleted/Modified:**
- `../aerobeat-web-audio/`

**Files Created/Deleted/Modified:**
- `../aerobeat-web-audio/README.md`
- `../aerobeat-web-audio/package.json`
- `../aerobeat-web-audio/src/index.js`
- validator/test files as needed

**Status:** ✅ Complete

**Results:** `aerobeat-web-audio` was scaffolded and pushed as `@aerobeat/web-audio`. Parent verification confirmed Web Audio lifecycle/status, source descriptors, deterministic playback clock snapshots, basic timeline helpers, and load/play/pause/stop/seek service boundary. Validation passed: `npm run check`, `npm test`, and `npm run test:browser`; unit tests covered unsupported browser state, injected context lifecycle, beat/time conversion, and deterministic clock progress. Commit: `4cf1499` (`Scaffold AeroBeat web audio facade`). Bead `oc-eqq` closure is expected from the coder lane; `bd dolt push` remains blocked by the known no-common-ancestor divergence.

---

### Task 3: Scaffold WebGL2 Renderer Singleton

**Bead ID:** `oc-hd0`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-01`, `REF-07`, `REF-08`, `REF-09`
**Prompt:** After Task 1 passes, run as the `coder` role on `primary`. Read the AeroBeat root README and READMEs for `aerobeat-web-assembly`, `aerobeat-web-ui`, `aerobeat-tool-camera-tracking`, and sibling web packages before editing. Claim the assigned bead on start with `bd update <id> --status in_progress --json`. Create the new `aerobeat-web-renderer` repo/package in the AeroBeat workspace using existing web package conventions. Its public API should expose a WebGL2 renderer singleton/facade that can be shared by AeroBeat web singletons, attach to a canvas, clear/render frames, map normalized landmark points over a fitted/mirrored media content rect, and report truthful unsupported/error states. This package should own the durable landmark overlay rendering path; do not use 2D canvas for the final overlay. Include README/package/tests/browser validation hooks and commit/push before handoff unless blocked.

**Folders Created/Deleted/Modified:**
- `../aerobeat-web-renderer/`

**Files Created/Deleted/Modified:**
- `../aerobeat-web-renderer/README.md`
- `../aerobeat-web-renderer/package.json`
- `../aerobeat-web-renderer/src/index.js`
- validator/test files as needed

**Status:** ✅ Complete

**Results:** `aerobeat-web-renderer` was scaffolded and pushed as `@aerobeat/web-renderer`. Parent verification confirmed the package exports the `aero.renderer.webgl2` service ID, shared WebGL2 singleton/facade, attach/detach/status/clear/render helpers, fitted/mirrored normalized landmark mapping, and WebGL2 point/line landmark overlay rendering. Parent re-ran validation on 2026-08-24 12:31 EDT: `npm run check`, `npm test`, and `npm run test:browser` all passed. Commit: `c046045` (`Scaffold web renderer package`). Bead `oc-hd0` is closed locally; `bd dolt push` remains blocked by the known no-common-ancestor divergence.

---

### Task 4: Implement Live MoveNet Adapter Boundary

**Bead ID:** `oc-s70`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-04`, `REF-03`
**Prompt:** After foundational split tasks pass, run as the `coder` role on `primary`. Read the README for `aerobeat-web-vendor-movenet` and any sibling repos you touch before editing. Claim the assigned bead on start with `bd update <id> --status in_progress --json`. Implement a real browser-safe MoveNet adapter behind the public `@aerobeat/web-vendor-movenet` API without exposing TensorFlow.js model/tensor/provider objects outside the package. Preserve the deterministic replay/mock adapter for tests and fallback. Add focused tests or browser validation hooks for load, inference success, inference failure, and normalized pose output shape. Run the repo's relevant validation and commit/push before handoff unless blocked.

**Folders Created/Deleted/Modified:**
- `../aerobeat-web-vendor-movenet/`

**Files Created/Deleted/Modified:**
- `../aerobeat-web-vendor-movenet/src/index.js`
- `../aerobeat-web-vendor-movenet/package.json`
- `../aerobeat-web-vendor-movenet/README.md`
- Test or validation files as needed

**Status:** ✅ Complete

**Results:** `aerobeat-web-vendor-movenet` now has a real browser-safe MoveNet adapter boundary. Parent verification confirmed the public API exports normalized AeroBeat adapter factories/constants only; TensorFlow.js, pose-detection, detector/model/provider objects, and tensors remain hidden inside the vendor package. Deterministic replay/mock paths remain available. Parent re-ran validation on 2026-08-24 12:39 EDT: `npm run check`, `npm test`, and `npm run test:browser` all passed. Commit: `d4c30db` (`Implement live MoveNet adapter boundary`). Bead `oc-s70` is closed locally; `bd dolt push` remains blocked by the known no-common-ancestor divergence.

---

### Task 5: Promote CV From Sampler Proxy To Live Inference Service

**Bead ID:** `oc-752`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`
**Prompt:** After Task 1 and Task 4 pass, run as the `coder` role on `primary`. Read the READMEs for `aerobeat-web-cv`, `aerobeat-web-video`, `aerobeat-web-vendor-movenet`, `aerobeat-web-input`, `aerobeat-tool-video-player`, and `aerobeat-tool-camera-tracking` before editing. Claim the assigned bead on start with `bd update <id> --status in_progress --json`. Extend the public CV service so an `aerobeat-web-video` live camera/video/replay frame source can produce latest-frame-wins normalized pose frames using the MoveNet adapter. Keep normalized shapes at the public boundary, preserve replay fixture behavior, and make source IDs truthful: live inference must not report replay or sampler proxy IDs. Add focused validation for stream lifecycle, adapter invocation, stopped-state behavior, source metadata, and fallback/error reporting. Run relevant validation and commit/push before handoff unless blocked.

**Folders Created/Deleted/Modified:**
- `../aerobeat-web-cv/`
- `../aerobeat-web-video/`
- `../aerobeat-web-input/` only if public input expectations need documentation or tests

**Files Created/Deleted/Modified:**
- `../aerobeat-web-cv/src/index.js`
- `../aerobeat-web-cv/package.json`
- `../aerobeat-web-cv/README.md`
- Test or validation files as needed

**Status:** ✅ Complete

**Results:** `aerobeat-web-cv` was promoted from sampler/replay-only behavior to a live inference service boundary. The package now exposes a public CV facade with `start`, `stop`, `nextPoseFrame`, `submitFrame`, `getLatestPoseFrame`, and `getStatus`; accepts `aerobeat-web-video`-compatible frame source metadata; reports truthful `sourceKind`, `sourceId`, mirroring, counters, lifecycle, error, and fallback state; schedules latest-frame-wins inference through the public MoveNet adapter boundary only; and preserves deterministic replay behavior. Validation passed in `../aerobeat-web-cv`: `npm run check`, `npm test`, and `npm run test:browser`. Commit: `c7bb9db` (`Promote web CV live inference service`) pushed to `main`. Bead `oc-752` remains locally `in_progress` for QA/auditor workflow closure; `bd dolt push` remains blocked by the known no-common-ancestor divergence.

---

### Task 6: Add Visible Preview And WebGL2 Landmark Overlay Presenter

**Bead ID:** `oc-i2r`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-01`, `REF-03`, `REF-06`, `REF-07`, `REF-08`, `REF-09`
**Prompt:** After Tasks 1, 3, and 5 pass, run as the `coder` role on `primary`. Read the READMEs for `aerobeat-web-ui`, `aerobeat-web-video`, `aerobeat-web-renderer`, `aerobeat-web-cv`, `aerobeat-web-assembly`, `aerobeat-tool-video-player`, and `aerobeat-tool-camera-tracking` before editing. Claim the assigned bead on start with `bd update <id> --status in_progress --json`. Add an `aero-*` web UI presenter that displays the active live camera/video/replay feed via `aerobeat-web-video` and draws normalized pose landmarks/skeleton overlays through `aerobeat-web-renderer` WebGL2 over the same fitted/mirrored content rect. Use the Godot `CameraTrackingPreviewPresenter` split as the reference: media surface belongs in video/media ownership, landmark rendering belongs in renderer ownership, and UI composes them. Do not bury the visible preview inside the CV vendor adapter or fall back to 2D canvas for the durable overlay. Include no one-off assembly-only UI except composition/wiring. Add focused browser validation that landmarks render over the visible feed, respect mirroring/fit mode, and update as pose frames change. Run relevant validation and commit/push before handoff unless blocked.

**Folders Created/Deleted/Modified:**
- `../aerobeat-web-ui/`
- `../aerobeat-web-video/`
- `../aerobeat-web-renderer/`
- `../aerobeat-web-cv/` only if a preview/source descriptor contract is needed
- `.plans/`

**Files Created/Deleted/Modified:**
- `../aerobeat-web-ui/src/elements/aero-media-pose-preview/aero-media-pose-preview.js`
- `../aerobeat-web-ui/src/elements/aero-media-pose-preview/README.md`
- `../aerobeat-web-ui/src/index.js`
- `../aerobeat-web-ui/README.md`
- `../aerobeat-web-ui/package.json`
- `../aerobeat-web-ui/package-lock.json`
- `../aerobeat-web-ui/.testbed/scenes/aero-media-pose-preview.scene.html`
- `../aerobeat-web-ui/.testbed/debug-data/aero-media-pose-preview.debug-data.js`
- `../aerobeat-web-ui/.testbed/demo/media-pose-preview-validation.html`
- `../aerobeat-web-ui/scripts/validate-media-pose-preview-browser.js`
- `.plans/2026-08-24-live-movenet-inference.md`

**Status:** ✅ Complete

**Results:** Added `aero-media-pose-preview` in `aerobeat-web-ui` as the UI-owned presenter for active live camera/video/replay feeds plus WebGL2 pose overlays. The component composes the public `@aerobeat/web-video` facade for media attachment/surface metadata and the public `@aerobeat/web-renderer` facade for durable landmark/skeleton overlay calls over the same fitted/mirrored media viewport. No CV/vendor adapter UI and no 2D durable overlay were added. Package exports, README notes, testbed scene/debug data, and a Playwright/Vite browser validator were added. Validation passed in `../aerobeat-web-ui`: `npm run check`; `npm test`; `npm run test:browser` after `test:browser` was tightened to include the preview browser validator. The focused browser validation confirms visible feed canvas sizing, fit/mirror/source metadata propagation, skeleton connection delegation, and updating landmark overlay calls when pose frames change. Coder handoff leaves bead closure for QA/auditor.

---

### Task 7: Wire Live Inference Into Phone Route

**Bead ID:** `oc-aa1`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`
**Prompt:** After Task 6 passes, run as the `coder` role on `primary`. Read the README for `aerobeat-web-assembly` and touched sibling repos before editing. Claim the assigned bead on start with `bd update <id> --status in_progress --json`. Replace the assembly-local sampler-derived pose proxy with the public CV live inference service, `aerobeat-web-video` media source, `aerobeat-web-renderer` WebGL2 overlay path, and visible UI preview presenter. Keep the visible build proof at the top, run `npm run version:patch` for the phone-testable build, and update UI state so it distinguishes `loading model`, `live inference running`, `inference frames N`, `pose frames N`, active source kind, and explicit fallback/error states. The visible pose-flow source should identify live MoveNet inference when active, and the first-screen runtime should show the active camera/video feed with WebGL2 landmark overlay. Run `npm test`, `npm run build`, `npm run test:browser` if available, and restart the existing Tailscale `:8443` route for device testing. Commit/push before handoff unless blocked.

**Folders Created/Deleted/Modified:**
- `.plans/`
- `src/`

**Files Created/Deleted/Modified:**
- `src/index.js`
- `README.md`
- `package.json`
- `package-lock.json` if dependency/version changes require it
- `.plans/2026-08-24-live-movenet-inference.md`

**Status:** ✅ Complete

**Results:** `aerobeat-web-assembly` now wires the phone route through the final-shape live inference split instead of the assembly-local sampler proxy. Parent verification confirmed the repo is clean except this living plan update, `main` is pushed at `a0a104c` (`Wire live MoveNet inference route`), `package.json` is bumped to `0.0.4`, the running Tailscale route serves release-proof meta `0.0.4`, and `src/` references `createAeroCameraCvService`, `createMoveNetPoseAdapter`, and `aero-media-pose-preview` without the old `aero.camera.live.frame-sampler` source. Runtime status now reports media source/playback/size, CV/model/source state, inference frames, pose frames, rendered pose frames, live-camera source kind, and explicit fallback/error text. Coder validation passed: `npm test`, `npm run build`, and `npm run test:browser`. Caveats carried forward for QA: Playwright fake camera cannot prove nonzero human landmarks, and expected Chromium WebGL `ReadPixels` performance warnings are filtered by the browser console validator. Bead `oc-aa1` remains `in_progress` for QA/auditor closure.

---

### Task 8: QA Live Mobile Inference Checkpoint

**Bead ID:** `oc-1j1`
**SubAgent:** `primary`
**Role:** `qa`
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`
**Prompt:** After coder handoff, run as the `qa` role on `primary`. Read the README for `aerobeat-web-assembly` and touched sibling repos before validating. Claim the assigned QA bead on start with `bd update <id> --status in_progress --json`. Verify the running product at `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` in the highest-fidelity browser validation available. Confirm the visible version/build/cache changed, calibration requests camera permission, the stream remains active while inference runs, live inference counters continue changing, pose-flow source is truthful, the visible camera/video/replay feed is shown with updating WebGL2 landmark overlays, mirroring/fit are coherent, and there are no unexpected console/page errors. If real Android Chrome confirmation by Derrick is still required, report the exact phone-visible strings/visual behavior Derrick should check and leave the bead open or blocked as appropriate.

**Folders Created/Deleted/Modified:**
- None expected

**Files Created/Deleted/Modified:**
- None expected, except plan/bead status if needed

**Status:** ❌ Blocked

**Results:** QA completed on 2026-08-24 13:22 EDT against `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` using Chromium mobile viewport and a canvas `captureStream` fake camera. Validation passed: `npm test`, `npm run build`, and `npm run test:browser`. The live route returned HTTP/2 200 with release-proof meta `0.0.4`; visible build proof showed `Version 0.0.4 / Built 2026-08-24T17:12:13.736Z / Cache mt7huf1l-j1rt01`. Calibration requested `getUserMedia` once with `{ audio: false, video: { facingMode: "user" } }`; the fake camera track stayed live; counters advanced over 2s from inference `7 -> 43`, pose `7 -> 43`, and rendered `6 -> 42`. Source reporting was truthful: `aero.movenet.live`, with no `aero.camera.live.frame-sampler` or replay source after calibration. Preview evidence showed `aero-media-pose-preview` using `sourceKind live-camera`, `sourceId aero.movenet.live`, `fitMode cover`, `mirrored true`, `video 320x240`, and renderer draw count `18 -> 90`. Console/page logs had no unexpected warnings/errors, with only the known Chromium WebGL `ReadPixels` warning filtered. Screenshot evidence is at `/tmp/aerobeat-live-mobile-qa-final.png`.

Derrick then tested on physical Android Chrome on 2026-08-24 14:16 EDT. The camera started and the live preview was visible, so the route is no longer blocked on proving real phone feed startup. The physical test exposed visual correctness issues: landmarks appeared above the video feed with vertical Y-axis misalignment, landmarks lagged behind the video, landmarks jittered, and extra landmarks were visible beyond the architecture-requested set of `nose`, `left_wrist`, `left_elbow`, `left_shoulder`, `right_shoulder`, `right_elbow`, and `right_wrist`. QA remains failed/blocked for overlay geometry, latency, smoothing, and landmark filtering. A separate immediate usability bead `oc-cx5` was created because the `Begin calibration` control sits below the mobile fold.

Coder handoff for `oc-hmt` completed on 2026-08-24 14:47 EDT and the route now serves `0.0.6`. QA is no longer blocked on an implementation slice; it is blocked on a fresh physical Android Chrome check of the seven-landmark overlay alignment, latency/readability, and phone-visible `media-pose delta` after pressing the first-viewport `Begin calibration` control.

---

### Task 10: Move Calibration Control Above Fold

**Bead ID:** `oc-cx5`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-01`, `REF-02`
**Prompt:** Run as the `coder` role on `primary`. Read the AeroBeat root README plus the READMEs for `aerobeat-web-assembly` and `aerobeat-web-ui` before editing. Claim bead `oc-cx5` on start with `bd update oc-cx5 --status in_progress --json`. Move the `Begin calibration` control for the phone testing scene into the top-right/first-viewport area so Android Chrome can start the camera without scrolling below the fold. Preserve the existing `aero-calibration-screen` event contract and visible calibration status behavior. Prefer a small assembly composition change if this is only a route/test-scene placement issue; update `aerobeat-web-ui` only if the reusable component itself needs a placement affordance. Run relevant validation (`npm test`, `npm run build`, `npm run test:browser` in assembly; UI validation if UI changed), bump the patch version for phone verification, restart the `:8443` test route, commit/push, and report the exact version/cache served.

**Folders Created/Deleted/Modified:**
- `src/`
- `.plans/`
- `../aerobeat-web-ui/` only if needed

**Files Created/Deleted/Modified:**
- `src/index.js`
- `README.md` if checkpoint instructions change
- `package.json`
- `package-lock.json`
- `.plans/2026-08-24-live-movenet-inference.md`
- `../aerobeat-web-ui/src/screens/aero-calibration-screen/aero-calibration-screen.js` only if needed

**Status:** ✅ Complete

**Results:** Coder handoff completed on 2026-08-24 14:26 EDT. `aerobeat-web-assembly` now has a top-right first-viewport `Begin calibration` `aero-button` in the assembly topbar. The new button forwards activation through the existing reusable `aero-calibration-screen` control, preserving the `aero:calibration:start`, `aero:calibration:state-change`, and status behavior sourced from the component. The reusable UI component API was not changed.

Validation passed in `aerobeat-web-assembly`: `npm test`, `npm run build`, and `npm run test:browser`. Browser validation now uses a 390x844 mobile viewport, asserts the topbar calibration button is visible in the first viewport/right side without scrolling, verifies native button semantics, clicks it, and confirms the reusable calibration screen reports `Calibration running` plus live camera/CV state. Version/cache proof was bumped to `0.0.5` in `package.json`, `package-lock.json`, and `index.html` release-proof meta. The phone route was restarted with local Vite on `127.0.0.1:5174`; Tailscale `:8443` still proxies to that server; `curl https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` confirms `aerobeat-release-proof` content `0.0.5`. Commit: `991cda8` (`Move calibration control above mobile fold`) pushed to `main`. Bead `oc-cx5` remains locally `in_progress` for QA/auditor closure; `bd dolt push` remains blocked by the known no-common-ancestor divergence.

Parent review completed on 2026-08-24 14:30 EDT. The parent re-checked the committed source, confirmed `main` is clean and pushed, confirmed the live `:8443` route serves `aerobeat-release-proof` content `0.0.5`, and re-ran `npm test`, `npm run build`, and `npm run test:browser` successfully. QA was spawned for an independent mobile-viewport verification pass against `oc-cx5`; the bead remains open until QA/auditor evidence closes it.

QA passed on 2026-08-24 14:40 EDT against `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` in a Chromium Android-like `390x844` viewport. The route returned HTTP 200 and visible build proof `Version 0.0.5 / Built 2026-08-24T18:23:16.819Z / Cache mt7kdsgj-bbvaz0`. Initial `scrollY` was `0`; the topbar `Begin calibration` control was visible/tappable in the first viewport at `top 16`, `right 374`, `bottom 52`, `left 216.78`, `width 157.22`, `height 36`; both the topbar control and reusable `aero-calibration-screen` control exposed native `BUTTON type="button"` semantics via `aero-button`. Clicking the topbar control changed the topbar label to `Calibration running`, the reusable screen status to `Calibration active - align your shoulders in the rhythm field`, and started the existing camera/CV flow with fake camera evidence: camera granted/live, `CV running / model ready / source live-camera aero.movenet.live`, media playback playing, and inference/pose/rendered counters advancing from `7/7/7` to `43/43/43` over about two seconds. QA validation commands: `npm test` passed, `npm run build` passed, and `npm run test:browser` passed on rerun after an initial timeout caused by a parallel duplicate browser check. QA left `oc-cx5` open for auditor closure. Existing physical overlay geometry/latency/filtering issues remain scoped to `oc-hmt`, not this button placement bead.

Audit passed on 2026-08-24 14:40 EDT. The auditor checked Task 10, bead notes, QA evidence, commit `991cda8`, current `HEAD`, `src/index.js`, and the reusable `aerobeat-web-ui` calibration screen contract. Audit confirmed the assembly topbar button forwards activation into the existing `aero-calibration-screen` button, while the reusable screen still owns `aero:calibration:start` and `aero:calibration:state-change`; assembly does not synthesize those events directly. The auditor closed `oc-cx5` with reason: `Top-right first-viewport calibration control verified by coder, QA, and audit`. Dirty worktree caveat remains from separate `oc-hmt` overlay-fidelity work and does not invalidate this completed button placement slice.

---

### Task 11: Tune Mobile Landmark Overlay Fidelity

**Bead ID:** `oc-hmt`
**SubAgent:** `primary`
**Role:** `coder`
**References:** `REF-03`, `REF-04`, `REF-07`, `REF-08`
**Prompt:** Run as the `coder` role on `primary` after Task 10. Read the AeroBeat root README plus the READMEs for `aerobeat-web-assembly`, `aerobeat-web-ui`, `aerobeat-web-renderer`, `aerobeat-web-cv`, and `aerobeat-web-vendor-movenet` before editing. Claim bead `oc-hmt` on start with `bd update oc-hmt --status in_progress --json`. Use Derrick's physical Android Chrome observations as required evidence: live preview appears, but landmarks are vertically misaligned above the video feed, overlay lags behind video, landmarks jitter, and extra landmarks are visible beyond the architecture-requested subset of `nose`, `left_wrist`, `left_elbow`, `left_shoulder`, `right_shoulder`, `right_elbow`, and `right_wrist`. Fix or instrument the WebGL2 preview pipeline so the overlay is mapped to the same live video content rect, latency is reduced or truthfully measured, jitter is smoothed enough for calibration readability, and only the requested landmark set is visible in the testing scene. Run relevant validation, bump version proof for phone verification, commit/push, and report physical-test instructions.

**Folders Created/Deleted/Modified:**
- `src/`
- `../aerobeat-web-ui/`
- `../aerobeat-web-renderer/`
- `../aerobeat-web-cv/` if needed
- `../aerobeat-web-vendor-movenet/` if needed
- `.plans/`

**Files Created/Deleted/Modified:**
- `src/index.js`
- `README.md`
- `index.html`
- `package.json`
- `package-lock.json`
- `scripts/validate-playwright-console-noise.js`
- `../aerobeat-web-ui/src/elements/aero-media-pose-preview/aero-media-pose-preview.js`
- `../aerobeat-web-ui/src/elements/aero-media-pose-preview/README.md`
- `../aerobeat-web-ui/.testbed/debug-data/aero-media-pose-preview.debug-data.js`
- `../aerobeat-web-ui/.testbed/demo/media-pose-preview-validation.html`
- `../aerobeat-web-ui/scripts/validate-media-pose-preview-browser.js`
- `../aerobeat-web-vendor-movenet/src/movenet-adapter.js`
- `../aerobeat-web-vendor-movenet/scripts/validate-movenet-adapter.js`
- `../aerobeat-web-vendor-movenet/README.md`

**Status:** ✅ Complete

**Results:** Coder handoff completed on 2026-08-24 14:42 EDT. Derrick's physical Android Chrome observations were treated as required evidence: live preview appears, landmarks were vertically high relative to the feed, overlay lag was visible, landmarks jittered, and extra landmarks rendered beyond the architecture-requested upper-body subset.

Implemented changes preserve the package split. `aerobeat-web-ui` now limits the visible `aero-media-pose-preview` WebGL2 overlay to `nose`, `left_wrist`, `left_elbow`, `left_shoulder`, `right_shoulder`, `right_elbow`, and `right_wrist`; maps those names to stable MoveNet IDs for the skeleton; applies light exponential smoothing; resets smoothing when the source changes so replay does not bleed into live camera; measures the actual DOM video content rect and passes it explicitly to `aerobeat-web-renderer`; and exposes comparable media-time minus pose-frame timestamp delta for latency proof. `aerobeat-web-vendor-movenet` no longer flips detector coordinates by default when output `mirrored` metadata is true, avoiding a detector/UI double-mirror path. `aerobeat-web-assembly` surfaces `overlay landmarks 7` and `media-pose delta ...` in the phone-visible Inference panel and bumped release proof to `0.0.6`.

Validation passed: in `../aerobeat-web-ui`, `npm test` and `npm run test:browser`; in `../aerobeat-web-vendor-movenet`, `npm test` and `npm run test:browser`; in `aerobeat-web-assembly`, `npm test`, `npm run build`, and `npm run test:browser`. One assembly `npm run test:browser` attempt timed out during fake-camera/model startup after the version bump; the immediate rerun passed, so this is recorded as a Playwright/fake-camera startup flake rather than an accepted product caveat. Tailscale `:8443` still proxies to local Vite on `127.0.0.1:5174`, and `curl https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` confirms `aerobeat-release-proof` content `0.0.6`.

Remaining caveat for QA: this coder pass cannot physically inspect Derrick's Android Chrome camera view. QA should reload `0.0.6`, press the first-viewport `Begin calibration`, and verify the overlay sits on the same live video rect, displays only the seven requested landmarks, is readable with smoothing, and reports the phone-visible `media-pose delta` value while inference counters advance. This is now the current plan blocker.

---

### Task 9: Independent Audit And Closure

**Bead ID:** `oc-0dr`
**SubAgent:** `primary`
**Role:** `auditor`
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`
**Prompt:** After QA handoff, run as the `auditor` role on `primary`. Read the plan, bead details, diffs, validation output, and READMEs for touched repos. Claim the assigned audit bead on start with `bd update <id> --status in_progress --json`. Independently verify that `aerobeat-web-video`, `aerobeat-web-audio`, and `aerobeat-web-renderer` exist in the intended final-shape layer split, and that live MoveNet inference, not replay or sampler proxy data, drives the visible pose/input panels after camera permission. Confirm the visual preview/WebGL2 landmark overlay proves the same active source geometry that CV is inferencing from, not a disconnected decorative visualization. Confirm validation commands passed, the build version was bumped for the phone-testable slice, Git commits are pushed, plan results are updated, and Beads closure is justified. Close the relevant beads only if the evidence satisfies the plan; otherwise report the gap for retry.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-08-24-live-movenet-inference.md`

**Status:** ⏸️ Blocked

**Results:** Blocked behind `oc-hmt` overlay fidelity and the downstream QA pass. Auditor should not close the live inference checkpoint until the real phone feed proves aligned, low-lag, readable landmark overlay behavior limited to the requested landmark set, or Derrick explicitly grants a narrower acceptance exception.

---

## Final Results

**Status:** ⚠️ Blocked

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-08-24*
