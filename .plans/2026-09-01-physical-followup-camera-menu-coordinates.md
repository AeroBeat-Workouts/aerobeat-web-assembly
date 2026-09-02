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
**Status:** FINAL AUDIT PASS — `nu0` closed and Dolt-pushed on 2026-09-01

- Claim `nu0`.
- Land physical-timing browser reproducer first.
- Implement idempotent playback publication and narrowly scoped presenter commits.
- Preserve native control identity, focus, and drawer scroll across no-op/playback updates.
- Verify song, difficulty, Gameplay, Conversion, Start/Test after Test and completed Play in direct/iframe, desktop/mobile, portrait/landscape, DPR1/3.
- Coder → independent QA → independent audit; auditor owns closure.

**Coder result (2026-09-01): PASS; pushed for QA/audit.**

- Baseline source failure was captured before repair by `node scripts/validate-mobile-gameplay-menu.js`: completed Visual Test playback churn produced `19` publications and `228` presenter commits during one `140 ms` physical hold; the captured Song B radio was detached before pointerdown (`pointerDown:false`, `pointerUp:false`, `isConnectedAfterHold:false`), no `library-select` intent emitted, and selection stayed `song-a-easy` at drawer `scrollTop:607`. Exact diagnosis and repair contract are recorded in `docs/task18-post-session-menu-stability.md`.
- Content commit `42cfdcd` publishes playback only for exact bounded state/position/set changes and proves equivalent ID sets are order/duplicate independent.
- UI commit `685145e` makes equivalent narrowed presenter snapshots idempotent, including compact-library optimistic state, and proves map/library/Gameplay native identity plus focus remain exact.
- Assembly commit `51b1247` routes only drawer-relevant content changes (`state`, generation, package, selected variant, background) to full presenters; playback/events/assets remain runtime truth. The Chromium regression covers completed Visual Test and completed Play, physical pointerdown/`140 ms` dwell/pointerup/change, multiple truthful playback publications, scroll, identity/`isConnected`, zero pre-change presenter commits, exact bounded intents, and final `song-b-hard` + `boxing_semantic_track_v1` + `cut_family_source_height_v1` truth. No periodic scroll setter, truthful-state suppression, schema expansion, release action, or broad UI rewrite was added.
- Fresh content gates passed: `npm test`, exact `npm run test:browser`, dry-run pack, `npm ls --all`, `git diff --check`.
- Fresh UI gates passed: `npm test`, exact `npm run test:browser`, dry-run pack, `npm ls --all`, `git diff --check`.
- Fresh assembly gates passed twice on final source where applicable: `npm test`, exact `npm run test:browser`, `npm run test:v4-integration`, live Flow obstacles, `npm run build`, `npm ls --all`, static/import/component/console/privacy/forbidden assertions, and `git diff --check`. The shell/cursor matrix covered direct + real cross-origin iframe, portrait/landscape, DPR1/3, fine/coarse paths, all gameplay modes, reconnect/privacy, and zero unexpected console errors.
- Residual scope: the held-pointer transaction itself is one deterministic direct Chromium scenario combined with the existing eight-context direct/iframe viewport/DPR matrix; independent QA should repeat physical mouse/touch hardware timing and scroll behavior. Bead closure remains auditor-owned.

**Final independent audit result (2026-09-01): PASS; `nu0` closed and Dolt-pushed.**

- Independently reproduced the exact causal baseline with detached assembly `6f184cf`, content `2d4a983`, and UI `fbf0bb8`, applying only the repaired physical-timing test as a reproducer. Completed Visual Test Song failed with `17` playback publications, `204` presenter commits before pointerup, original-node disconnection/replacement, no pointerup/change or intent, retained `song-a-easy`, and drawer `scrollTop:607`; this confirms playback publish → full presenter reconstruction → held-node detachment rather than disabled state, stale generation, or iframe transport.
- Repeated completed Test and completed Play for Song, downloaded Difficulty, Gameplay, and Conversion in direct fine mouse (`140 ms`), direct coarse CDP touch (`180 ms`), real cross-origin iframe fine mouse (`140 ms`), and real cross-origin iframe coarse touch (`180 ms`). All `32` transactions kept the same connected native node through pointerdown/up/change, observed `18–20` truthful publications per fine hold and `12–15` per coarse hold, had exactly zero full presenter commits before up/change, retained scroll exactly through change, restored focus to the current control after the necessary truthful commit, emitted the exact scalar intent, and ended at `song-b-hard` / `boxing_semantic_track_v1` / `cut_family_source_height_v1`.
- Verified content no-op and set-equivalent playback suppression retains exact snapshot/listener identity while genuine playback changes publish; UI equivalent BeatSaver/library/Gameplay snapshots preserve exact identity/`isConnected`/focus, genuine changes render, and compact optimistic state survives only equivalent host snapshots; assembly excludes only playback/events/assets from drawer signatures while truthful package/variant/background and lifecycle changes still commit.
- Fresh content gates PASS: `npm test`, `npm run test:browser`, dry pack `23,162 / 94,446`, `npm ls --all`, `git diff --check`. Fresh UI gates PASS: same gates, dry pack `44,019 / 185,409`. Fresh assembly gates PASS: `npm test`, `npm run test:browser`, v4 integration (`7b14eec`, `96e68173fffd6454bfb38740acaf58653da11320`, `3` packages / `5` variants), live Flow (`3C9D`, `16` obstacles / `16` volumes), build (`1299` modules), `npm ls --all`, `git diff --check`, and clean dry pack `399,358 / 1,431,710` with `97` entries.
- Complete assembly static/JSDoc, public-import/MediaPipe-only forbidden, component, actual-graph, adversarial iframe, privacy/scalar-schema, lifecycle/reconnect, console, direct/iframe portrait/landscape DPR1/3, all-mode, cursor/camera-control, v4, live-Flow, and build matrix passed. No `scrollTop` workaround, truthful suppression, schema/privacy expansion, lifecycle/rendering regression, or release/handedness/camera/server/PoC/Theme/asset/publication scope creep was found. No linked P0 was required.

### Task 2 — Normalize renderer world/view convention (`aue`)

**Repos:** renderer primarily; assembly tests/docs as needed. Input/CV/contracts should not change unless verification disproves the diagnosis.
**Status:** FINAL AUTOMATED AUDIT PASS — renderer `3c8143c`, assembly `f40b83a`; QA/audit completed via orchestrator fallback after five child harness failures, with every fresh renderer/assembly gate rerun; `aue` closed, physical webcam confirmation remains Pending in `7f9`

- Claim `aue`.
- Add staged semantic + `worldToScreen` + framebuffer proof before changing behavior.
- Migrate timeline/floor/targets/timing zones and fixed/debug camera from future `+Z`/camera-facing-`+Z` to future `-Z`/camera-facing-`-Z` atomically.
- Preserve timing, culling, scoring, icon direction, movement controls, and all three gameplay modes.
- Do not swap MediaPipe labels, left/right colors, or add another X mirror.
- Coder → independent QA → independent audit; auditor owns closure.

**Replacement coder result (2026-09-01): PASS; renderer commit `3c8143c` pushed for independent QA/audit.**

- Preserved and inspected every inherited dirty renderer file before editing. The production core was directionally correct: timestamp sign, camera position/target, timing segments, lanes, cell foreground bias, targets/obstacles, ascending far-to-near sort, cursor/landmark overlay bias, debug yaw/position/bounds, and camera-relative movement were coherently mirrored. It was incomplete rather than disposable: the focused proof had a reversed top-origin Y assertion, timing-floor-contaminated centroids, only direct landscape DPR1/Grid coverage, no real iframe or Flow framebuffer orientation, stale main-browser obstacle/debug expectations, exact-impact `-0`, and a contradictory original decision document. The replacement retained the valid production work and repaired those gaps.
- The pre-repair sensitivity proof ran against detached old renderer source `b50bcb5` before further production edits. With unchanged staged raw values `left=.80`, `right=.20`, `nose=.65` and athlete `1-x` values `.20/.80/.35`, the old camera was `[0,3.15,-7.8]` facing `+Z`; world X `-2.4/+2.4` projected to screen X `556.23/287.77`; blue-left/green-right cursor centroids were `531.68/311.34`. The new fixed-camera-basis expectation failed exactly, proving the asymmetric old-source projection defect without swapping labels/colors or adding an X workaround.
- The atomic production correction uses exact-impact positive zero and future `z=-(timestamp-now)*units`, fixed/reset camera on world `+Z` looking local/world `-Z`, mirrored timing/lane/cell/target/volume/overlay depths, ascending world-Z transparent order, debug yaw `0`, `+Z` reset position, asymmetric `[-72,+32]` Z bounds, and Right→world `+X`. MediaPipe labels, the one CSS selfie mirror, input `1-x`, theme blue-left/green-right colors, scoring/timing/culling/icon identities, and assembly contracts are unchanged. No Task 3 pose export/artifact/schema/default work was added.
- Corrected direct landscape DPR1 evidence is world X `287.77/556.23`, Grid blue/green centroids `284.52/558.48`, lane centroids `348.02/495.24`, and blue-left/nose/green-right cursor centroids `311.34/364.64/531.68`. Flow right/diagonal records remain rotations `0/π÷4`; framebuffer second moments distinguish horizontal (`xx 83.85`, `yy 2.78`) from diagonal (`xx 76.52`, `yy 76.53`, `xy 76.40`). Portrait retains ordered symmetric clipping for extreme cell/wrist staging while visible lanes, nose, and Flow icons preserve side/orientation; this is recorded truthfully rather than overstated as physical hardware evidence.
- The focused renderer matrix passed all eight direct/real-cross-origin-iframe portrait/landscape requested-DPR1/3 contexts (DPR3 correctly capped at 2), with top-origin world-to-screen X/Y assertions, Grid cells 0/3, Boxing lane roles, Flow orientation, fixed/debug camera, Right→world `+X`, detach/reconnect, bounded scalar-only evidence, and zero unexpected console noise. The complete renderer Chromium suite retained two isolated applications, fine pointer-lock/fallback and coarse touch capture/look, Normal/Boost held movement, reset, pause/blur/hidden/detach/destroy cleanup, context loss/restoration, atlas recreation, all modes, DPR sizing, cursor/landmark overlays, and zero noise.
- Renderer gates passed on final source: `npm test`; exact `npm run test:browser`; two byte-identical `npm pack --dry-run --json` results (`34,300` packed bytes, `116,242` unpacked bytes, `16` files); `npm ls --all` with only the expected platform-optional `fsevents` absence; and `git diff --check`. Renderer README plus original/new decision docs now state the conventional basis and preserved semantic/privacy boundaries.
- Assembly consumes the linked renderer without an assembly production-source change. Final assembly validation evidence is recorded below/with Bead `aue`; the test/plan assembly commit leaves production source, release/version/raw artifacts, and every server/publication boundary untouched. Human webcam confirmation remains independent QA/physical work, and `aue` intentionally remains `in_progress` for QA/audit closure.

**Assembly completion-coder result (2026-09-01): PASS; ready for independent QA/audit.**

- Inspected the preserved assembly worktree before editing and retained both inherited files. The only internally inconsistent migrated expectation was the combined GUI Forward conjunct in `verifyDebugCameraControls`: its reset baseline, distance formulas, W movement, and renderer contract all use camera `+Z` facing local/world `-Z`, but it still required the second GUI frame to increase Z. Corrected only that comparator so GUI Forward must continue decreasing Z; no assembly production source changed.
- Focused `npm run test:shell-matrix` passed before the broader gates. It exercised all eight direct/real-cross-origin-iframe contexts — portrait `390x844` and landscape `844x390`, requested DPR `1/3` with the renderer's DPR3 request correctly capped at `2` — and all three actual UI Test presentations in every context (`24` mode/context sessions). Every session retained non-background gameplay before input, after Reset, and after pause/resume; setting the legacy yaw to `π` produced exactly zero non-background pixels and full configured-background coverage.
- The same focused/full matrix proved fine mouse/pointer-lock-or-fallback and coarse synthetic touch paths, right-click capture/look/second-click/Escape exit, two-finger capture and one-finger look, all six accessible held controls, Reset visibility/operation, W decreasing Z over successive frames, D increasing X, A decreasing X, GUI Forward decreasing Z over successive deterministic assembly frames, clean release/no drift, Normal distance strictly `0.3–0.4`, Boost strictly `1.1–1.3` and greater than `3x` Normal, and menu/pause/hidden/detach/destroy/reconnect cleanup. Flow, Boxing Lanes, and Boxing Grid all retained distinct truthful scene/pixel signatures.
- Full assembly gates passed against the exact linked renderer `3c8143cec5021821519fe04c10e1aa29aa42c9d2`: `npm test`; exact `npm run test:browser`; `npm run test:v4-integration` (`vendor=7b14eec`, golden `96e68173fffd6454bfb38740acaf58653da11320`, `3` packages / `5` variants); live Flow (`3C9D`, hash `5662f64a12c76a3dd11a5f6ee22611608cd06760`, `16` obstacles / `16` volumes); and `npm run build` (`1299` modules). The exact shell matrix and gameplay-cursor integration each passed all eight contexts; compositor pixels, post-session held controls, actual graph, reconnect, media lease, adversarial iframe, audio mix, preview/library, scalar privacy, and zero unexpected browser console noise also passed.
- Dependency/static/privacy gates passed: `npm ls --all` resolved both direct and UI-transitive renderer links to the sibling renderer; only declared platform/feature-optional absences were reported. Fresh JSDoc/static, MediaPipe-only/public-import/forbidden-runtime, component, console/actual-graph, scalar privacy, root/CV/lease, and `git diff --check` gates passed. Build emitted only the already-known Vite externalized `node:worker_threads` and chunk-size advisory warnings; browser console-noise assertions remained clean.
- Fresh renderer validation on clean pushed commit `3c8143c` passed `npm test`, exact `npm run test:browser`, two byte-identical dry packs, `npm ls --all`, and `git diff --check`. Current dry-pack metadata was `35,075` packed bytes / `118,450` unpacked bytes / `16` files; this fresh committed-source measurement supersedes the earlier preliminary size line above without changing package contents or commit. The handedness matrix again passed all eight contexts with fixed/debug basis, world-to-screen/framebuffer orientation, Flow icon moments, Right→world `+X`, Normal/Boost movement, lifecycle/privacy, and zero unexpected console noise.
- Scope audit found no input/CV/contract/label/color/mirror change, camera artifact/export/default work, release/server/PoC/Theme/assets/publication action, or assembly production change. No actual defect remained and no linked P0 was required. Residual physical uncertainty is deliberately unchanged: deterministic browser staging cannot replace Derrick's real webcam confirmation that nose motion and anatomical blue-left/green-right wrists feel correct on hardware.

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
