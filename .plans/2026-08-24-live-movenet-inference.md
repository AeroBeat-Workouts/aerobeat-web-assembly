# AeroBeat Live MoveNet Inference

**Date:** 2026-08-24
**Status:** In Progress
**Last Updated:** 2026-08-24 12:58 EDT
**Blocked Reason:** None
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

**Status:** ⏳ Pending

**Results:** Pending.

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

**Status:** ⏳ Pending

**Results:** Pending.

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

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-08-24*
