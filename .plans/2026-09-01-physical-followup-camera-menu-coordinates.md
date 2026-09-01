# AeroBeat Physical Follow-up: Menu Stability, World Handedness, and Camera Pose Authoring

**Status:** APPROVED and in progress — Derrick approved execution on 2026-09-01
**Owner:** `aerobeat-web-assembly`
**Date:** 2026-09-01
**Predecessor:** `.plans/2026-09-01-cursor-volume-theme-authoring.md`
**Physical gate:** `aerobeat-web-assembly-7f9` remains open

## Goal

Repair the two physical regressions discovered on audited release `0.0.32`, normalize renderer world/view handedness to match the athlete-facing presentation, then provide a deterministic Visual Test GUI export for one reviewable camera-pose artifact that Derrick can author and approve as the shared default for Flow, Boxing Lanes, and Boxing Grid.

No asset PoC or Theme runtime work begins until these repairs are audited and Derrick completes the resulting physical gate.

## Confirmed physical evidence

- The `0.0.32` volume popover default-hidden and icon-toggle repair is Physical PASS.
- After Test/completion, reopening the menu leaves song/gameplay controls effectively unselectable and desktop scrolling snaps toward the top.
- With webcam input, horizontal athlete motion is visually reversed: nose motion is opposite expectation and anatomical left/blue and right/green wrist cursors appear on the opposite visual sides.
- Derrick wants a GUI action that exports current camera position/rotation as an artifact for review and later application as one default across all modes.

## REFERENCES

- Existing release/follow-up plan: `.plans/2026-09-01-cursor-volume-theme-authoring.md`
- Physical handoff: `docs/task17-cursor-volume-physical-handoff.md`
- Physical gate: `aerobeat-web-assembly-7f9`
- Menu P0: `aerobeat-web-assembly-nu0`
- Handedness P0: `aerobeat-web-assembly-aue`
- Camera authoring feature: `aerobeat-web-assembly-jyg` (blocked by `aue`)
- Asset PoC: `aerobeat-web-assembly-zd0` (remains blocked)
- Exact audited baseline: release `0.0.32`, payload commit `d03146c26f8330a3a278225be337fe7f04621d45`, audit commit `e322a3df271c6c697c2dec01cd4d710677b782a6`

## Diagnostic record

### A. Post-session menu selection and scroll

**Observed failure:** After a Visual Test or completed song, opening the menu allows scrolling/pointing but physical selection is unreliable or impossible, and desktop scrolling repeatedly resets upward.

**Expected:** The menu remains stable between actual state changes; held pointer input reaches the same native control from pointerdown through change; scroll and focus are not destroyed by playback-only updates.

**Execution path:** The display rAF remains active after Test reaches `completed`. Each display frame calls assembly `syncContentPlayback()`. Content `setPlaybackState()` publishes even when playback state is unchanged. While the menu is open, the content subscriber calls full `renderPresenters()`. Every presenter `setSnapshot()` rebuilds its entire shadow subtree with `innerHTML`, replacing native controls roughly 15 times per second. A physically held control can be detached before pointerup/change, and descendants/scroll anchors are repeatedly destroyed.

**Root cause:** Unconditional no-op playback publications are incorrectly routed into full menu presenter replacement. This is not a disabled gameplay-selector rule or stale generation.

**Verification before repair:** Add an actual held-pointer/browser reproduction that records content publishes, presenter commits, drawer `scrollTop`, input identity/`isConnected` at pointerdown/up, emitted intent, and selected content. A/B suppression of no-op playback publication must stabilize the same DOM node, scroll, and intent.

**Recommended repair:**
1. Make content playback updates idempotent: do not publish unchanged state/position/active IDs.
2. In assembly, do not route playback-only updates to full menu presenters; update only runtime/transport surfaces that actually changed.
3. Make presenter snapshot application idempotent for equal data. Preserve drawer scroll/focus around the smaller set of genuinely necessary commits; avoid a blanket scroll reset workaround.
4. Test real held pointer timing, not only synchronous `.click()`.

### B. Athlete/grid horizontal handedness

**Observed failure:** Nose and wrist movement is visually opposite; left/blue and right/green roles appear on the opposite screen sides.

**Expected:** One selfie mirror boundary; anatomical left/blue appears visually left, right/green visually right, nose follows movement, and scoring/grid targets occupy the matching side.

**Execution path:** MediaPipe anatomical labels and raw X are correct. Video presentation mirrors exactly once. Input converts raw camera X to athlete X exactly once with `1-x`. Assembly forwards athlete X unchanged. Renderer maps logical X monotonically to world X and assigns correct blue/green roles. However, the fixed camera sits at negative world Z and faces world +Z. With PlayCanvas camera-local `-Z` forward, that 180° view makes increasing world X project toward screen-left.

**Root cause:** The renderer chose future timeline depth as world `+Z` and turned the camera around to face it. The semantic pose/input pipeline is coherent; the view basis mirrors its world-X projection.

**Coordinate decision:** Adopt the conventional PlayCanvas scene basis requested by Derrick: camera on positive world Z looking along local/world `-Z`; future events are farther away toward world `-Z` and approach zero as time advances; world `+X` projects screen-right. This is a structural renderer convention correction, not a second mirror or label/color swap. Update all timing-zone, target, floor/lane, culling/sorting, debug-camera movement/default, and projection tests together.

**Verification before repair:** Inject asymmetric raw landmarks, prove vendor and athlete values, use `camera.worldToScreen` plus framebuffer color centroids for world ±X, all three cursor colors, lane/grid sides, and Flow horizontal/diagonal icons. Scoring truth must remain unchanged.

### C. Camera pose artifact

Renderer owns the PlayCanvas camera and mutable Visual Test free-fly pose; assembly owns the existing Test-only GUI. Current fixed/default camera values are duplicated between scene-model `position/target` and debug-camera `position/yaw/pitch` and are only approximately equivalent.

After the world-basis repair, introduce one renderer-owned camera-pose schema/default used by both fixed gameplay and Reset. Add a Test-only accessible assembly GUI button that exports the currently rendered pose as deterministic JSON. The artifact remains private/local: no localStorage, game snapshot, event, telemetry, iframe message, runtime import, or automatic default mutation.

Proposed artifact:

```json
{
  "schema": "aerobeat/gameplay_camera_pose",
  "version": 1,
  "coordinateSystem": {
    "space": "playcanvas_world",
    "handedness": "right_handed",
    "worldUp": "+Y",
    "cameraForward": "local_-Z",
    "timelineFuture": "world_-Z"
  },
  "position": { "x": 0, "y": 3.15, "z": 7.8 },
  "rotationEulerDegrees": { "xPitch": -7.448451, "yYaw": 0, "zRoll": 0 },
  "projection": { "verticalFovDegrees": 48, "nearClip": 0.1, "farClip": 80 }
}
```

Exact values above are illustrative until authored. Canonicalize finite bounded values to six decimal places, normalize `-0`, reapply canonical values before serialization, use fixed property order/two-space JSON/LF/trailing newline, MIME `application/json`, and filename `aerobeat-gameplay-camera-pose.v1.json`. Repeated exports of one pose must be byte-identical.

Derrick will physically author and provide the artifact. Applying its reviewed values as the committed shared default is a separate explicit second slice and review gate.

## Execution plan

### Task 1 — Reproduce and repair menu churn (`nu0`)

**Repos:** content runtime, UI presenter, assembly.

- Claim `nu0`.
- Land physical-timing browser reproducer first.
- Implement idempotent playback publication and narrowly scoped presenter commits.
- Preserve native control identity, focus, and drawer scroll across no-op/playback updates.
- Verify song, difficulty, Gameplay, Conversion, Start/Test after Test and completed Play in direct/iframe, desktop/mobile, portrait/landscape, DPR1/3.
- Coder → independent QA → independent audit; auditor owns closure.

### Task 2 — Normalize renderer world/view convention (`aue`)

**Repos:** renderer primarily; assembly tests/docs as needed. Input/CV/contracts should not change unless verification disproves the diagnosis.

- Claim `aue`.
- Add staged semantic + `worldToScreen` + framebuffer proof before changing behavior.
- Migrate timeline/floor/targets/timing zones and fixed/debug camera from future `+Z`/camera-facing-`+Z` to future `-Z`/camera-facing-`-Z` atomically.
- Preserve timing, culling, scoring, icon direction, movement controls, and all three gameplay modes.
- Do not swap MediaPipe labels, left/right colors, or add another X mirror.
- Coder → independent QA → independent audit; auditor owns closure.

### Task 3 — Export deterministic camera pose (`jyg`)

**Dependency:** starts only after audited `aue` PASS.

- Claim `jyg`.
- Create one strict renderer-owned pose module/default and remove duplicated fixed/debug defaults.
- Add narrow renderer export API; keep pose absent from `describe()` and public contracts.
- Add accessible Test-only `Export camera pose` GUI action beside Reset; clear held movement intent before atomic capture.
- Verify deterministic bytes, lifecycle/reset parity, identical pose across Flow/Lanes/Grid, direct/iframe privacy, pointer/touch/accessibility, and no persistent/public leakage.
- Coder → independent QA → independent audit.
- Produce a new immutable local release/playtest for Derrick. Derrick authors and returns the JSON artifact.
- Stop for explicit artifact review before committing authored default values.

### Task 4 — Apply reviewed camera default and physical retest

- After Derrick supplies/approves the artifact, replace the single renderer-owned default with those exact reviewed values.
- Re-run renderer/assembly QA and audit, then build an immutable successor candidate.
- Derrick physically verifies menu selection/scroll, handedness, cursor roles, one shared camera pose, and remaining audio/cursor rows.
- Close physical gate `7f9` only on Derrick PASS.
- Keep asset PoC `zd0` blocked until that closure.

## Required validation

- Every changed package: `npm test`, exact browser gate, dependency integrity, `git diff --check`.
- Assembly: exact `npm run test:browser`, v4 integration, live Flow obstacles, production build, version/proof/privacy/forbidden checks.
- Real Chromium held-pointer and scroll tests after Test and completed Play.
- Asymmetric physical-equivalent pose staging with semantic logs, `worldToScreen`, and framebuffer color-side assertions.
- Flow/Lanes/Grid direct + same-origin iframe, portrait/landscape, DPR1/3.
- Two cleared raw builds and two exact committed-payload packs for any release candidate; older releases byte-unchanged.

## Approval and safety boundaries

- This plan requires Derrick approval before implementation.
- Internal source edits, tests, commits, pushes, local immutable build artifacts, and one managed local playtest server are authorized only after approval.
- No npm publish, GitHub Release/repository creation, upload, public publication, third-party acquisition/redistribution, asset PoC, or Theme runtime work without separate approval.
- Stop after exporting the candidate camera artifact for Derrick review; do not silently apply an authored pose.
