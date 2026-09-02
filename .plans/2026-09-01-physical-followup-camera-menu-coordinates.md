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

**Dependency:** audited `aue` source repair PASS; physical webcam confirmation remains in `7f9`.
**Status:** FINAL AUDIT PASS — exporter implementation complete at renderer `b1f6627` and assembly `c2d36f4`; `jyg` closed and Dolt-pushed; Derrick artifact authoring/application Pending as a separate physical review gate

- Claim `jyg`.
- Create one strict renderer-owned pose module/default and remove duplicated fixed/debug defaults.
- Add narrow renderer export API; keep pose absent from `describe()` and public contracts.
- Add accessible Test-only `Export camera pose` GUI action beside Reset; clear held movement intent before atomic capture.
- Verify deterministic bytes, lifecycle/reset parity, identical pose across Flow/Lanes/Grid, direct/iframe privacy, pointer/touch/accessibility, and no persistent/public leakage.
- Coder → independent QA → independent audit.
- Produce a new immutable local release/playtest for Derrick. Derrick authors and returns the JSON artifact.
- Stop for explicit artifact review before committing authored default values.

#### Task 3 coder results — 2026-09-02

- Renderer commit `b1f6627` adds one strict private camera-pose module/default for `aerobeat/gameplay_camera_pose` v1. Fixed play, debug initialization, Reset, attach/reconnect, and all projection settings now use the same canonical Euler pose; the approximate `lookAt` target and duplicated position/yaw/pitch defaults are gone. The unchanged migrated default is position `(0,3.15,7.8)`, Euler `(-7.448451,0,0)`, projection `(48,0.1,80)` on `playcanvas_world/right_handed/+Y/local_-Z/world_-Z`.
- Validation rejects hostile prototypes, accessors without invoking them, symbols, extras, non-finite values, every documented bound, nonzero roll, schema/version/convention mismatches, and invalid clip order. Canonicalization rounds to six decimals, normalizes yaw to `[-180,180)`, removes negative zero, freezes nested data/byte arrays, preserves fixed key order/two-space/LF/trailing-newline JSON, reapplies the canonical pose to the PlayCanvas entity before returning, and produces repeated byte-identical exports.
- Assembly commit `c2d36f4` adds the assembly-owned `Export camera pose` action beside Reset. The named button is at least 44px, shares active-playing Visual Test visibility/enabled policy, accepts only a trusted click/keyboard gesture, releases GUI and renderer authoring input, then performs a child-local Blob/object-URL/hidden-anchor download with stable filename/MIME and immediate removal/revocation. No UI package, iframe bridge, storage, event, snapshot, telemetry, release, server, authored default, Theme, PoC, asset, or publication path changed.
- Renderer coder gates PASS: `npm test`; exact `npm run test:browser` including handedness and camera control regressions; two byte-identical `npm pack --dry-run --json` results (`37,765` packed / `128,784` unpacked / `17` files); `npm ls --all`; and `git diff --check`. Browser proof covers unsafe export rejection, canonical entity reapplication, fixed/debug Reset parity, Flow/Lanes/Grid identity, context recovery/reconnect/detach/destroy, and absence from `describe()`.
- Assembly coder gates PASS: `npm test`; exact full `npm run test:browser`; all eight direct/real-iframe portrait/landscape DPR1/3 contexts at fine/coarse pointer policy and each Flow/Lanes/Grid mode; `npm run build`; `npm run test:v4-integration`; live `npm run test:live-flow-obstacles` (`3C9D`, 16 obstacles/16 volumes); `npm ls --all`; component/import/console/privacy/forbidden/static checks; two byte-identical dry packs; and `git diff --check`. Every context/mode produced the same 488-byte artifact SHA-256 `55ea553d68c40fc56e448a9ae21f741bfebbe4f04de48861ac32a5a09238c01a`; tests also prove trusted-gesture rejection for synthetic clicks, Blob MIME/size, hidden connected anchor name, URL revocation, cleared intents, and no pose/artifact bytes in storage, game snapshot, renderer describe/telemetry, or bridge/event-bearing public state.
- Coder boundary: no replacement pose was authored or applied, no runtime import/persistence was added, and no version/release or server replacement was performed. Independent QA/audit and Derrick artifact authoring/review remain required before Task 4.

#### Task 3 final independent audit — 2026-09-02

- **PASS; `jyg` closed specifically for the complete exporter implementation and Dolt-pushed. Derrick artifact authoring, physical review, and any application of reviewed values remain Pending under Task 4/`7f9`.** Audited both READMEs, approved plan, all coder/QA Bead comments, full diffs, and Git history from renderer `b1f6627` and assembly production `c2d36f4` / audit metadata `887da52`.
- Renderer inspection confirms one private strict v1 pose module/default drives fixed play, debug initialization, Reset, reconnect, Euler transform, and all projection values. No duplicated fixed/debug default, approximate `lookAt`, or package public pose export remains. Hostile prototype/proxy/accessor/symbol/extra/non-finite/schema/version/convention/roll/clip-order inputs reject; an independent `16`-probe test covered both sides of every documented numeric bound. Canonical six-decimal/yaw/negative-zero handling, fixed property order, two-space LF/trailing-newline JSON, deep immutability, round-trip identity, and canonical entity reapplication all passed.
- Independent serialization of the retained default is exactly `488` bytes with SHA-256 `55ea553d68c40fc56e448a9ae21f741bfebbe4f04de48861ac32a5a09238c01a`. Fresh renderer gates passed: `npm test`; exact `npm run test:browser`; public namespace/privacy check; two byte-identical dry packs (`37,765` packed / `128,784` unpacked / `17` files, shasum `2396b1466dbb16b069e6e57320995aea90ff627b`); `npm ls --all` with only expected platform-optional `fsevents`; `git diff --check`; clean/upstream `b1f6627`.
- Assembly Chromium proof covers the accessible named `>=44 px` Test-only active/playing button, trusted keyboard activation and synthetic-click rejection, input/capture clearing, exact filename/MIME/Blob bytes, one hidden connected anchor, immediate removal/revocation, and safe disabled/unattached/unrendered/capture/pending-lock/movement/boost/touch/context-loss/menu/pause/hidden/detach/destroy/reconnect behavior. Flow, Boxing Lanes, and Boxing Grid generated identical bytes through fine/coarse controls in all `8` direct/real-cross-origin-iframe portrait/landscape requested-DPR1/3 contexts (`24` mode/context sessions).
- Fresh assembly gates passed: `npm test`; exact `npm run test:browser`; v4 golden (`vendor=7b14eec`, hash `96e68173fffd6454bfb38740acaf58653da11320`, `3` packages / `5` variants); live Flow `3C9D` hash `5662f64a12c76a3dd11a5f6ee22611608cd06760` (`16` obstacles / `16` volumes); production build (`1300` modules, only known Vite worker-externalization/chunk advisories); two byte-identical dry packs (`405,907` packed / `1,453,351` unpacked / `97` files, shasum `a03759b5c295d4ea96977b91c20612c60f9bdb40`); `npm ls --all` with declared optional absences; and `git diff --check`.
- Static/privacy/scope audit confirms no pose/artifact bytes in renderer `describe()`/telemetry, game snapshots, local/session storage, events, iframe messages, or runtime public exports; the export path calls no publish/event/bridge/storage seam. Menu held-pointer/native identity/scroll and conventional handedness/world-to-screen/framebuffer regressions remain passing. No runtime import/persistence, authored default replacement, version/release/raw artifact, server, PoC, Theme, asset, dependency, or publication change exists. No defect or linked P0 was required.

### Task 3.5 — Deterministic camera-authoring release `0.0.33` (`nme`)

**Status:** PACK-POLICY QA FAIL / P0 `aerobeat-web-assembly-6fc` CODER RETRY IN PROGRESS — standalone subagent `992c180c-4d4c-4191-8abd-a1987c6831f7` after the first child made no workspace/Bead progress; status/monotonic classification repair pending; all release Beads remain open; audit/server blocked

- Preserved raw `0.0.32` and every older release byte-exact. The pre/post aggregate through `0.0.32` is `349` files / `706,996,083` bytes with recursive inventory SHA-256 `9e1ca712a88825a6ab880aeb3b4426c21faf963ee8b591ae8d4f92d777e5bfd8`; `0.0.32` alone remains `13` files / `11,518,186` bytes with inventory hash `5b57e7fac19f406b57ebdc7a05c764d511b15edae3aa999952b5f6feacddef96` and proof hash `0962d46169ce7834033aaacefbcb777cacc7dfea43e8f7fbfa9351e832db47c7`.
- Built raw `0.0.33` twice after explicitly clearing the successor output and compared both complete trees recursively to the tracked tree. All three are exact at `13` files / `11,550,983` bytes, inventory SHA-256 `3a5ed9eb392aef63bd32bef77fd6c90739a141cfb949360f88106d0e1cb2188d`, proof SHA-256 `bc7eed7244988c412ed8b830b4b47d2dc2526ff72b8a4306fc1815b1f215e98a`, source fingerprint `bfe5542ce964a1a79a447cb59816d37340588e326f0cdf8a06fd29290c1be870`, and `11,549,617` pre-manifest bytes.
- Proof identity is exact: `proofVersion`/package/lock/index are `0.0.33`, `artifactKind` remains `raw-unminified-browser-proof`, `minified` remains false, runtime is MediaPipe-only, runtime WASM is empty, and forbidden asset/marker checks pass. The path inventory is identical to `0.0.32`; every icon, branding manifest, CSS, worker, and vendor bundle is byte-identical, with no Theme, asset, dependency, or third-party addition.
- Added an opt-in `AEROBEAT_TEST_ROOT` seam to the existing menu and shell-matrix validators so the same real Chromium behavior proof can target the immutable raw tree without changing default source validation. Raw `0.0.33` passes completed-Test/Play held-pointer/menu-scroll behavior and the direct/real-iframe portrait/landscape DPR1/3 all-mode shell/handedness/camera matrix; repeated Flow/Lanes/Grid downloads are exactly `488` bytes with SHA-256 `55ea553d68c40fc56e448a9ae21f741bfebbe4f04de48861ac32a5a09238c01a` and remain absent from snapshots, renderer descriptions, storage, events, iframe messages, and telemetry.
- Fresh source gates pass: `npm test`; exact full `npm run test:browser`; v4 integration (`vendor=7b14eec`, golden `96e68173fffd6454bfb38740acaf58653da11320`, `3` packages / `5` variants); live Flow `3C9D` / `5662f64a12c76a3dd11a5f6ee22611608cd06760` (`16` obstacles / `16` volumes); production build (`1300` modules); `npm ls --all` with declared platform/feature-optional absences only; static/JSDoc/import/component/console/privacy/forbidden checks; and clean-source diff checks. The exact browser gate covers held menu input, all eight direct/real-iframe viewport/DPR contexts, framebuffer handedness, all modes, deterministic camera bytes, lifecycle/reconnect, scalar privacy, and zero unexpected console noise.
- Exact committed-payload dry/actual pack hashes are intentionally excluded from this packed plan. Two dry packs and two actual packs completed byte-identically from a clean detached worktree at exact candidate `55f4088`; authoritative metadata remains only in external `nme` comment `01a061cc-f539-71da-b55c-b7efa62ffe6e` to avoid packed-plan self-reference ambiguity.
- Independent release QA/audit remains required before any managed local playtest server replacement. No publish, upload, GitHub Release, server, Theme/PoC/assets, authored-pose application/import, or publication action is part of coder scope.

#### Release QA failure — pack identity P0

- Independent QA reproduced both cleared raw builds and tracked raw `0.0.33` exactly, and proved every older release unchanged.
- Two dry and two actual packs from isolated exact candidate `55f4088` agree with each other but not the coder’s claimed authoritative pack identity. QA observed metadata JSON SHA-256 `7866e5ffc719b40a0a37c1037a819ae33d83c0e9373a0e543a70bb0a390d1232`, `408,630` packed bytes, npm shasum `a20a3e1bb5fe60f249bc345b9f6399f70e4aa485`, integrity `sha512-a1Kjtb0KtwGvw2298Z1Pg5s+Gp+GORUw7iM01E6NO+WVHzerV+StMTCimmGExZZCBgOZVxUeA7NR6e0KA6Giaw==`, and archive SHA-256 `21c7585528668bbc4ea5a269a7ee188aa0a9179c69546d2bc300853bc91885f3`; file count `97` and unpacked bytes `1,462,194` match.
- Linked P0 `aerobeat-web-assembly-1wu` confirmed the cause: npm portable tar preserves source permission distinctions Git does not track. Coder packed `71×0600 + 26×0644`; fresh QA packed `97×0600`. All 97 member bytes/paths/order/sizes/mtimes/owners and gzip headers match; only 26 tar mode/checksum headers differ, and mode replay reproduces both identities exactly.
- Corrective policy is Git-index-derived mode normalization in two fresh exact-commit worktrees (`100644→0644`, `100755→0755`) before pack, plus asserted path/mode/size/content manifests and tar/PAX checks. This will supersede both host-specific identities without changing candidate `55f4088` or raw `0.0.33`. QA correctly stopped before claiming remaining release gates.

#### Pack-mode repair coder result — 2026-09-02

- **CODER PASS; independent QA/audit pending.** Release-tooling-only commit `7470b7c` adds an explicit detached-target normalizer/assertion/verifier plus self-test and README procedure. It refuses the canonical checkout and attached worktrees, requires a clean exact commit, derives every tracked mode from the Git index, verifies npm member bytes/modes, rejects PAX/unsupported members, and emits archive/tar/path-mode-size-content manifests. It does not rebuild, version, or alter raw `0.0.33`; exact candidate remains immutable `55f408806e256b12029e42779685bcb2e23624f2`.
- Two newly materialized detached exact-`55f4088` worktrees independently normalized all `214` tracked files to Git-derived `0644` (`0×0755` in this candidate). Each ran two asserted dry packs and two asserted actual packs under Node `v22.22.3` / npm `10.9.8`, with every output outside the package tree. All eight JSON outputs are byte-identical at SHA-256 `cbbdb639a9a091b946b2764988e3c34daf57c882fa511919a93c295fc99da65c`: `97` files, `408,631` packed bytes, `1,462,194` unpacked bytes, npm shasum `d8692a83e9af2373e37e049328bf683f28da5a3c`, integrity `sha512-jEbmQm9SzRLS6UlewMVs9vvnC15AC4sHFmyF/mkY+0gf9bQ5TTrGxu+TNLfKUDZV419ovOIQyqkkE/GVsPzCnA==`.
- All four actual archives are byte-identical at SHA-256 `e2746b16168c03b056e628e66e33ea687bd3ad6db8b45b505c43069ebbc7dcf6`; all decompressed tar streams are SHA-256 `939693741365c836abd9e7f1279c9888f4bf03c9e809347094da69d3b44e7c97`. Every one of the `97` npm file members matches the exact candidate source bytes and expected mode (`97×0644`, `0×0755`), with zero PAX. All four canonical `path/mode/size/content-SHA256` manifests are byte-identical at SHA-256 `ca299ccaaceb12edfc00c1811cf86c89a77b96c46a30c849b4ee5a952d94b957`.
- This normalized identity is the sole new authoritative exact-candidate pack identity. It explicitly supersedes both unnormalized host-specific identities: mixed-mode coder JSON/archive `eb05080d…` / `c7c13734…` (`71×0600 + 26×0644`) and all-`0600` QA JSON/archive `7866e5ff…` / `21c75855…` (`97×0600`). Neither prior identity is valid release evidence after this policy.
- Validation PASS: `npm run test:release-pack-policy` (including attached-target refusal, normalization, index-mode/member-byte manifest checks, and PAX rejection); `npm test`; `npm ls --all` with declared optional absences only; Node syntax checks; `git diff --check`; exact candidate worktrees clean/detached; no diff under `release/raw/0.0.33`. QA should reproduce from two fresh exact-candidate worktrees using the documented tool, leave `1wu`/`nme` in_progress until QA/audit, and perform no server/publish/upload/Release/authored-pose/PoC/Theme/asset action.

#### Pack-policy QA failure — archive verifier P0

- Independent adversarial QA found `release-pack-policy.js` failed open for four malformed inputs: tar truncated before the required end-of-archive zero blocks; traversal directory `../escape/`; a duplicate member appended after end markers; and unknown accessor-like CLI option `--__proto__`.
- Existing positive controls correctly reject canonical/attached/wrong/dirty/untracked targets, symlink/FIFO/unmerged/bad-mode entries, bad checksums/content truncation, duplicate-before-end, PAX, unsupported members, and file traversal. The normalized archive identity itself did not change.
- Linked P0 `aerobeat-web-assembly-cf1` entered coder repair under subagent `dc1334a5-8a0a-4fce-a987-179cb670f482`. QA/audit and server replacement remain blocked until strict termination, all-member path safety, trailing-data scanning, and exact CLI option validation independently pass.

#### Pack-policy fail-open repair coder result — 2026-09-02

- **CODER PASS; independent QA/audit pending.** Root-first diagnosis is recorded in `docs/task19-release-pack-policy-fail-open-debug.md`. `parseTar()` now requires exact 512-byte framing, complete member padding, exactly the two terminal zero blocks evidenced by canonical npm output, and exact EOF; it rejects absent/one-block/truncated terminators, extra zero padding, and every nonzero byte or member after the terminator.
- Canonical NUL-terminated fatal-UTF-8 name/prefix parsing plus one `package/` descendant validator runs before mode/type handling for every member. It rejects absolute/backslash/control/empty/dot/dotdot/traversal/drive/root/ambiguous paths and malformed fields across files, directories, PAX, and unsupported types. Safe directory mode remains exactly `0755`; tracked file mode/content equality is unchanged.
- CLI parsing now uses exact command schemas: `normalize`/`assert` require only `--target` and `--commit`; `verify` additionally requires `--archive` and alone permits optional `--manifest`. Unknown/prototype-ish, duplicate, attached, missing, odd, empty, option-valued, positional, and malformed command inputs reject before target access.
- The self-test begins with a positive real npm tar and covers all four QA reproductions plus absent/one/partial/extra terminator boundaries, nonzero/member trailing data, safe and unsafe every-type paths, malformed name/prefix encodings, wrong directory/file modes, checksum, member/content/padding truncation, duplicate-before-end, PAX, unsupported type, exact content, and the strict CLI matrix.
- Fresh validation PASS: `npm run test:release-pack-policy`; `npm test`; `npm ls --all` with declared optional absences only; both Node syntax checks; and `git diff --check`.
- One fresh normalized detached exact-`55f4088` pack and strict verification reproduce authoritative SHA-256 identities unchanged: JSON `cbbdb639a9a091b946b2764988e3c34daf57c882fa511919a93c295fc99da65c`; tgz `e2746b16168c03b056e628e66e33ea687bd3ad6db8b45b505c43069ebbc7dcf6`; decompressed tar `939693741365c836abd9e7f1279c9888f4bf03c9e809347094da69d3b44e7c97`; manifest `ca299ccaaceb12edfc00c1811cf86c89a77b96c46a30c849b4ee5a952d94b957`. The strict verifier reports `97×0644`, zero PAX, exactly two terminal zero blocks, and no trailing bytes. The candidate worktree remained clean/detached, and `git diff 55f4088..HEAD -- release/raw/0.0.33` remained empty.
- No release rebuild/version/server/publish/upload/GitHub Release/pose/PoC/Theme/asset action occurred. Keep `cf1`, `1wu`, and `nme` in_progress for independent QA/audit.

#### Numeric-field QA failure and full-grammar diagnosis — P0 `qmc`

- QA proved four malformed mode/size/checksum fields pass because `readTarNumber()` truncates at NUL and uses partial `Number.parseInt(..., 8)`. Broader read-only diagnosis confirmed that recomputed-checksum mutations of base-256 numbers and every ignored header field also pass, as do noncanonical type/path splits, empty/subset/reordered packages, and altered/concatenated/trailing gzip wrappers.
- Root cause is broader than numeric parsing: the custom verifier checks selected decoded semantics instead of one complete raw npm `10.9.8` archive grammar. The synthetic checksum fixture is also reversed (`NUL+SPACE`) relative to npm’s canonical `SPACE+NUL`, which prior permissive parsing masked.
- Repair contract: derive the complete expected npm regular-file membership/order from required npm metadata; canonicalize Git/npm modes; reject base-256/PAX/non-file entries; construct and byte-compare every full 512-byte USTAR header including fixed portable metadata, canonical path split, pinned mtime, checksum, padding and terminator; require archive size/shasum/integrity and one canonical gzip member/EOF. Use BigInt and re-encoding for any numeric helper. Add one-byte-per-field, numeric, membership/order, and gzip-wrapper mutation matrices before rerunning the two-worktree proof.

#### Complete-grammar repair coder result — 2026-09-02

- **CODER PASS; independent QA/audit pending.** `scripts/release-pack-policy.js` now requires the matching trusted `npm pack --json` file and validates its exact one-record schema, package identity/filename, nonempty exact entry count, pinned npm locale ordering, tracked path/size/mode inventory, unpacked byte sum, empty bundled set, archive byte length, SHA-1, and SHA-512 integrity.
- The wrapper validator accepts only npm 10.9.8's exact one-member gzip form (`1f8b08000000000002ff`), consumes the complete raw-deflate stream, and verifies CRC32, ISIZE, and EOF. Concatenated gzip members, flags/mtime/XFL/OS changes, trailer corruption, and trailing bytes reject.
- Every npm member must be one metadata-listed tracked regular file. The verifier reconstructs and byte-compares the entire canonical 512-byte USTAR header: ASCII name/prefix split, Git/npm-bin mode, zero portable uid/gid/uname/gname/link fields, exact source size, mtime `499162500`, canonical checksum, type `0`, `ustar\0`/`00`, zero device/reserved fields, exact content/zero padding, and exact two-block terminator. Alternate numeric/NUL/space/base-256 fields, PAX/directories/links, unsafe paths, subsets/extras/reordering under trusted hashes, and all earlier `cf1` failures reject.
- Real npm fixture tests cover `0644`, bin-forced `0755`, empty/nonempty, nested, exact 100-byte path, longest supported prefix, one-byte mutations across every header region, mode/size/checksum/uid/gid/mtime/dev numeric matrices, metadata schema/inventory/hash mutations, gzip mutations, and prior target/CLI safety. Root-cause report is `docs/task20-release-pack-complete-grammar-debug.md`.
- Fresh gates PASS: `npm run test:release-pack-policy`; `npm test`; `npm ls --all` with declared optional absences; both Node syntax checks; `git diff --check`. Two fresh differently-moded exact-`55f4088` worktrees normalized to `214×0644`; all eight dry/actual JSON files remain SHA-256 `cbbdb639a9a091b946b2764988e3c34daf57c882fa511919a93c295fc99da65c`, all four tgz files remain `e2746b16168c03b056e628e66e33ea687bd3ad6db8b45b505c43069ebbc7dcf6`, decompressed tar remains `939693741365c836abd9e7f1279c9888f4bf03c9e809347094da69d3b44e7c97`, and all manifests remain `ca299ccaaceb12edfc00c1811cf86c89a77b96c46a30c849b4ee5a952d94b957` with `97×0644`, zero PAX. Raw `0.0.33` and candidate `55f4088` are unchanged.

#### Metadata trust-boundary QA failure — P0 `nji`

- Complete-grammar QA proved source `127addc5` still accepts a canonical one-file subset plus matching caller-authored npm-shaped metadata. The archive uses exact tracked bytes and valid hashes, so all representation checks pass while completeness remains circularly defined by the caller.
- Root cause is recorded in `docs/task21-release-pack-metadata-trust-debug.md`: `--metadata` is labeled trusted but has no independent provenance; it is the sole inventory/hash authority.
- Repair contract: internally derive the exact dry-pack record from the normalized detached target using pinned npm `10.9.8`, scripts disabled, sanitized deterministic environment, and external isolated temp/cache/output locations. Caller metadata must be removed as authority or only compared byte-exactly with the internally derived record. Regress empty/subset/extra/reordered and jointly authored archive+metadata pairs before full proof rerun.

#### Metadata trust-boundary repair coder result — 2026-09-02

- **CODER PASS; independent QA/audit pending.** `verify` no longer accepts caller metadata. It requires Node `v22.22.3`, invokes the exact real npm `10.9.8` CLI directly rather than through caller `PATH`, and internally runs noise-free `npm pack --dry-run --json` against the already-normalized clean detached target with lifecycle scripts disabled, offline deterministic `C.UTF-8`/UTC environment, empty isolated npm configs, and fresh mode-restricted cache/temp/home/output directories outside both protected checkouts.
- The internally derived one-record metadata is now the sole package inventory and size/SHA-1/SHA-512 authority. The target is rechecked clean and mode-exact after derivation; the dry run may not write an archive. Caller `--metadata` rejects as an unknown option. Archive/manifest paths resolve outside target/canonical aliases, and cleanup requires the exact owned temporary root.
- Regressions reject the exact canonical one-file subset plus matching self-authored metadata, empty/reordered joint pairs, `PATH` npm substitution, hostile `TMPDIR`/npm config, lifecycle attempts, Node/npm version mismatch, npm command failure, stdout/stderr noise, empty/extra malformed JSON, and protected archive/manifest aliases. Complete canonical gzip/USTAR, mode/bin, target, CLI, and prior P0 protections remain.
- Fresh gates PASS: `npm run test:release-pack-policy`; `npm test`; `npm ls --all` with only declared optional absences; both Node syntax checks; `git diff --check`. Two fresh differently-moded detached exact-`55f4088` worktrees normalized to `214×0644`; all eight dry/actual JSON files remain `cbbdb639a9a091b946b2764988e3c34daf57c882fa511919a93c295fc99da65c`, all four tgz files remain `e2746b16168c03b056e628e66e33ea687bd3ad6db8b45b505c43069ebbc7dcf6`, tar remains `939693741365c836abd9e7f1279c9888f4bf03c9e809347094da69d3b44e7c97`, and manifests remain `ca299ccaaceb12edfc00c1811cf86c89a77b96c46a30c849b4ee5a952d94b957` with `97×0644`, zero PAX. Raw/candidate bytes are unchanged.

#### Internal npm liveness QA failure — P0 `r39`

- QA supplied an exact-version fake pinned npm CLI that hangs during dry-pack. `runPinnedNpm()` has no finite timeout, so verification remained blocked until an external three-second watchdog killed it with exit `124`; cleanup and later fail-closed checks were unreachable.
- Root cause and the completed debug-skill analysis are recorded in `docs/task22-release-pack-npm-timeout-debug.md`.
- Repair contract: both version and dry-pack calls use documented finite operation-specific process-group deadlines with TERM/KILL escalation and distinct timeout errors; tests must prove no child/descendant leftovers, target invariants, owned-temp cleanup, and preservation of all earlier trust/grammar protections and authoritative package identity.

#### Internal npm liveness repair coder result — 2026-09-02

- **CODER PASS; independent QA/audit pending.** The policy validates absolute GNU coreutils `timeout` `/usr/bin/timeout` version `9.4`, then wraps exact Node+npm process groups with fixed source-policy deadlines: `15 s` for npm version, `120 s` for dry-pack, `TERM` then `KILL` after `2 s`. A larger built-in watchdog fails distinctly if the wrapper itself does not return. Timeout diagnostics are handled before generic signal/exit errors so both operations report exact timeout failures and guarded owned-root cleanup runs.
- Test-only disposable source copies inject `0.25 s` deadlines and `0.2 s` escalation without any runtime environment override. Version hang, dry-pack hang, ordinary descendants, TERM-resistant direct/descendant processes, outer watchdog, PID disappearance, target cleanliness/modes, owned temp cleanup, unrelated lookalike preservation, timeout executable missing/identity/failure, npm nonzero/signal/max-buffer/noise/output, and every prior policy regression pass.
- Two fresh exact-`55f4088` worktrees created under differing umasks normalized to `214×0644`, remained clean, and each ran two dry plus two actual packs. All eight metadata JSON files remain `cbbdb639a9a091b946b2764988e3c34daf57c882fa511919a93c295fc99da65c`; all four archives remain `e2746b16168c03b056e628e66e33ea687bd3ad6db8b45b505c43069ebbc7dcf6`; tar remains `939693741365c836abd9e7f1279c9888f4bf03c9e809347094da69d3b44e7c97`; manifests remain `ca299ccaaceb12edfc00c1811cf86c89a77b96c46a30c849b4ee5a952d94b957`; `97×0644`, zero PAX. Raw/candidate bytes are unchanged.
- Fresh gates PASS: policy self-test, full `npm test`, `npm ls --all`, both Node syntax checks, and `git diff --check`. No release rebuild/version/server/publication/pose/PoC/Theme/asset action occurred.

#### Timeout diagnostic spoof QA failure — P0 `6fc`

- QA proved `runPinnedNpm()` classifies timeout solely by searching merged, untrusted child stderr for GNU timeout's verbose TERM/KILL text. A fake npm child printed that text and exited `7` immediately; the verifier falsely reported a 120-second timeout.
- Root cause and debug-skill analysis are recorded in `docs/task23-release-pack-timeout-classification-debug.md`.
- Repair contract: remove stderr text as authority; use GNU `--preserve-status`, monotonic deadline consumption, and result status to classify genuine TERM/KILL deadlines after outer-watchdog errors. Regress spoof text with exits `0`, `7`, `124`, and signals while preserving bounded genuine timeout, descendant cleanup, target/temp invariants, all prior policy protections, and the exact package identity.

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
