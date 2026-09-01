# Visual Test Debug-Camera Blue-Screen Hotfix

**Status:** Complete — final independent audit PASS; deterministic `0.0.29` committed/pushed; physical retest remains Pending
**Owner:** assembly orchestrator → renderer coder → independent QA → final auditor
**Assembly bug:** `aerobeat-web-assembly-ft7`
**Renderer bug:** `aerobeat-web-renderer-b79` (external reference to assembly `ft7`)
**Affected release:** `0.0.28`
**Target release:** deterministic `0.0.29`

## Goal

Repair the physically observed desktop Visual Test regression where active playback shows only the opaque blue PlayCanvas clear while pausing/menu-open reveals the Flow scene. Preserve the approved PlayCanvas-plus-DOM architecture, free-fly controls, exact 4×3/timing/duration/scoring/privacy/lifecycle contracts, retained `dev:tailscale` process, and Pending physical boundary.

## Exact observed failure

Directly observed in Derrick's physical screenshots and report:

- A downloaded DDR song starts in Flow Visual Test and audio advances.
- While Test is playing, the gameplay surface is uniformly blue; the DOM help, Reset camera, menu button, transport, and song time remain visible.
- Pausing midway/menu-open reveals PlayCanvas grid/timing/target geometry behind the drawer.
- Resuming hides the geometry behind the blue render again.

The failure occurs only in the active desktop Visual Test camera state demonstrated by this transition. It is not yet evidence of missing chart data, scoring failure, or a general renderer/context failure.

## Expected behavior

Active desktop Visual Test must begin with the debug camera at the same scene-facing overview as Reset camera, render non-background Flow geometry before any camera input, remain visible across pause/resume, and preserve held-RMB look plus `WASD`, `Q`/`E`, Shift boost, reset, and lifecycle cleanup. Pausing may disable debug input but must not be the condition that makes geometry visible.

## Execution path

1. Assembly starts a desktop `purpose:"visual_test"` session and renders a gameplay frame from authoritative content/session time.
2. `renderPresenters()` calls `syncDebugCameraPresentation()`.
3. `debugCameraSnapshot()` enables the renderer debug camera when the Test session is present, pointer is fine, menu is closed, and lifecycle is connected.
4. `AeroPlayCanvasRenderer.setDebugCameraEnabled(true)` installs input listeners.
5. Every active `renderGameplayFrame()` calls `applyCamera(model)`.
6. Because debug mode is enabled, `applyCamera()` calls `applyDebugPose()` instead of the fixed scene camera.
7. `applyDebugPose()` applies stored Euler pitch/yaw to the PlayCanvas camera before rendering.
8. Opening the menu makes assembly disable debug mode; the renderer resets and subsequent frames use the fixed camera, exposing the scene.

## Most likely root cause — confirmed

The renderer stores an Euler yaw inconsistent with the camera orientation established by Reset:

- `resetDebugCamera()` stores `debugYaw = 0`, `debugPitch = -0.13`, positions the camera at `(0, 3.15, -7.8)`, then uses `lookAt(0, 1.05, 8)` to face the gameplay scene on positive Z.
- On the next active frame, `applyDebugPose()` discards that `lookAt` rotation and calls `setEulerAngles(-7.45°, 0°, 0°)`.
- PlayCanvas cameras look down local negative Z. Yaw `0` therefore faces negative world Z, away from all positive-Z gameplay geometry.
- A direct PlayCanvas math probe confirmed the vectors: pitch `-7.57°`, yaw `0°` gives forward approximately `(0, -0.132, -0.991)`; yaw `180°` gives `(0, -0.132, +0.991)`, matching the scene-facing `lookAt` forward vector `(0, -0.132, +0.991)`.
- Pausing/menu-open disables debug mode and restores the fixed/look-at camera, exactly matching the physical symptom.

This is the causal root, not merely a surface where blue appears.

## Alternative hypotheses

1. **Higher-priority DOM overlay** — unlikely. The visible color matches the canvas/background clear, DOM controls remain independently visible, and switching camera mode reveals scene geometry without changing canvas stacking.
2. **Targets culled because song time advanced** — unlikely. Geometry appears at the same approximate timeline immediately after pause; the chart/session pipeline remains active.
3. **Transparent material/depth ordering** — unlikely. The same objects/materials render when debug mode is disabled, and the whole grid/timing scene disappears together.
4. **Context loss or second render loop** — unlikely. UI remains responsive, pause renders the scene in the same canvas/application, and audited renderer telemetry uses one app/context with manual ticks.

## Why previous verification missed it

No hotfix has been attempted yet. The `0.0.28` automated suites proved debug-camera enablement, pointer lock, held mouse look, movement intents, cleanup, context recovery, and representative fixed-camera pixels. They did not assert non-background gameplay pixels after debug mode was enabled and another active frame reapplied the stored Euler pose. Reset was validated behaviorally, but not against the immediately following active render that overwrote `lookAt` with yaw zero.

## Unknowns

- Derrick's exact viewport/browser and whether Reset was pressed are not recorded. Neither is required to explain the deterministic camera-forward mismatch.
- The same physical issue has not yet been reproduced with Boxing presentations; the shared camera path predicts it affects all active desktop Test presentations.
- Physical confirmation of the hotfix remains Pending until Derrick retests the secure route.

## Minimal reproduction

1. Use a desktop fine-pointer browser.
2. Select any downloaded Flow package containing visible upcoming targets.
3. Start `Test` and allow playback to advance with no mouse/keyboard input.
4. Observe an opaque clear with no gameplay geometry while DOM Test controls remain.
5. Open the menu/pause: geometry becomes visible under the fixed camera.
6. Close/resume: debug mode reapplies yaw zero and geometry disappears.

A renderer-only reproduction is smaller: render a positive-Z Flow scene, enable debug mode, render a second frame, and compare the camera forward vector/non-background pixels with the reset/fixed view.

## Proposed verification before correction

Add a targeted renderer browser assertion that distinguishes camera orientation from overlays/materials:

- render representative positive-Z Flow geometry;
- enable debug mode and render at least two frames;
- assert the camera forward vector has positive Z and rendered pixels differ from the configured opaque background;
- call Reset, render again, and assert scene pixels remain;
- disable/re-enable across pause-equivalent transitions and assert the scene remains visible;
- retain real held-RMB look, mouse-up release, movement, disabled/detached/destroyed cleanup, portrait/landscape DPR, and context recovery checks.

Add an assembly browser regression for active desktop Test → pause/menu-open → resume using displayed PlayCanvas pixels, not telemetry alone.

## Recommended fix

Use one coherent stored debug pose. Initialize/reset yaw to `Math.PI` with pitch `-0.13`, and apply that stored pose directly rather than establishing a conflicting transient `lookAt` rotation. This keeps active-frame Euler application facing positive-Z gameplay and lets mouse deltas remain continuous around the correct baseline. Avoid any DOM z-index, clear-color, culling, or camera-disable workaround because those would treat symptoms or remove the approved free-fly feature.

Adjacent regression scope: all three presentations, Reset, pause/resume, real pointer lock and mouse-up release, movement keys, fixed/mobile/scored camera, exact timing/duration projection, lifecycle teardown, context recovery, and deterministic packaging.

## Debugging record

```text
Problem: Active desktop Visual Test shows only the blue PlayCanvas clear.
Observed symptom: Playing hides all gameplay geometry; pause/menu-open reveals it; resume hides it again while DOM/audio remain active.
Root cause: Stored debug yaw 0 points the PlayCanvas camera down negative Z; each active frame overwrites the scene-facing reset/lookAt rotation, while gameplay lives on positive Z.
Evidence: Renderer call path and direct PlayCanvas forward-vector probe; physical visibility changes exactly when assembly toggles debug mode.
Failed approaches: None attempted. Prior tests covered input/telemetry but omitted active debug-camera gameplay pixel continuity.
Corrective action: Make reset/initial stored yaw Math.PI and apply one coherent Euler pose; add renderer and assembly pixel regressions.
Verification test: Positive camera-forward Z plus non-background scene pixels across active two-frame render, Reset, pause/resume, and lifecycle/input matrices.
Related files/components: renderer `src/renderer-facade.js`; renderer Chromium validation; assembly `src/index.js`; assembly product-shell/browser validation.
Remaining uncertainty: Physical retest result and breadth across real downloaded Boxing content remain Pending.
```

## Task 1 — Renderer correction

**Implementation Bead:** `aerobeat-web-renderer-b79`
**QA Bead:** `aerobeat-web-renderer-nf1`
**Audit Bead:** `aerobeat-web-renderer-xui`
**Status:** Complete — implementation/QA/final audit PASS; renderer Beads closed

The correction initializes and resets stored debug yaw to `Math.PI` and applies that stored pose directly, eliminating the reset `lookAt`/next-frame Euler contradiction. Unit math proves forward Z `>0.99` with downward floor pitch. Chromium renders a positive-Z Flow scene over opaque blue and proves active second-frame, Reset-next-frame, and disable/re-enable pause/resume gameplay pixels while retaining held-RMB, movement, cleanup, presentations, DPR, transparency, reconnect, destroy, and context recovery. Independent QA measured roughly 81.9k non-background pixels in every corrected state and proved baseline yaw zero produced negative forward Z. Final audit added the decisive sensitivity probe: forced old yaw zero rendered 0 gameplay pixels while corrected `Math.PI` rendered 81,940. `npm test`, complete `npm run test:browser`, dependency/static/diff checks, and deterministic dry packs passed independently. Renderer implementation `7447d30`, QA ledger `2bc146d`, and final audit `3cfbbe4` are pushed clean/upstream; `b79`, `nf1`, and `xui` are closed, with exact pack metadata external.

## Task 2 — Assembly physical-path regression

**Implementation Bead:** `aerobeat-web-assembly-ft7`
**QA Bead:** `aerobeat-web-assembly-614`
**QA correction Bead:** `aerobeat-web-assembly-656`
**Status:** Complete — independent correction QA PASS; `614`, `656`, and `f3v` closed; Task 3 ready

Consume immutable audited renderer commit `3cfbbe431ba5907831ceac15c26b0fdc7e2ceac2` and add active Test displayed-pixel proof across start, pause/menu-open, resume, Reset, all presentations, direct/iframe portrait/landscape DPR1/3, and existing terminal replay/lifecycle/privacy matrices.

### Coder result (2026-08-31)

The existing eight-context product-shell matrix now starts representative downloaded Flow through the actual `<aero-game>` `session-test` UI on a fine-pointer browser, waits for multiple active debug-enabled display frames, and samples the WebGL canvas synchronously into a test-private `OffscreenCanvas` against opaque Aero blue. Every direct/real-iframe portrait/landscape DPR1/3 context proves non-background gameplay pixels before input, after DOM Reset plus an active frame, and after actual menu pause/resume plus re-enabled active frames. A test-private old-yaw-zero negative control produces exactly zero non-background pixels in all eight contexts, while corrected states produce `76,029–690,182` pixels before input, `76,072–684,872` after Reset, and `76,153–679,030` after resume in the final complete browser run. Only scalar counts/sizes leave the browser evaluation; pixels and screenshots remain private.

`npm test`, complete `npm run test:browser`, exact live `3C9D` Easy Flow (`16` obstacles/`16` volumes), `npm run build`, `npm ls --all`, forbidden legacy-identity search, `git diff --check`, and focused/full matrix runs pass. Terminal replay, five presentation/conversion choices, exact 4×3/timing/duration/cursors, scored/mobile fixed camera, debug cleanup, privacy/lifecycle/context recovery, and all pre-existing eight-context shell/cursor checks remain intact. The tracked `0.0.28` raw tree and package/lock/index version surfaces are byte-unchanged; no `0.0.29` version or release artifact was built. The physical handoff records Derrick's `0.0.28` desktop Flow blue-screen as Failed/superseded and keeps every `0.0.29` retest row Pending without selecting a winner. Renderer `3cfbbe431ba5907831ceac15c26b0fdc7e2ceac2` was not modified; retained server PID `2972964` was not restarted.

### QA evidence correction (2026-08-31)

Independent QA correctly rejected the initial negative-control evidence because a late `drawImage` read from `preserveDrawingBuffer:false` could return an invalid transparent buffer that also counted as zero gameplay pixels. P0 Bead `aerobeat-web-assembly-656` owns the test-only repair. Diagnosis established the valid sampling boundary immediately after `renderGameplayFrame`, before the cursor tick; the renderer canvas is intentionally transparent for the DOM-owned gradient, so test-private raw RGBA is manually source-over composited onto `#071426`. Capture is demand-only to avoid DPR3 cadence/tracking perturbation, and dimensions derive from the renderer's DPR2 cap.

The corrected scalar validator requires renderer/canvas/sample dimensions and DPR agreement, complete pixel partitioning, full opaque composite output, positive exact-background pixels, an opaque `[7,20,38,255]` corner, and old-yaw-zero exactly all background. A startup self-test deliberately supplies a transparent invalidated sample and proves rejection. Two standalone eight-context matrices plus the matrix inside the complete browser chain passed: every old-yaw sample was exactly zero non-background with all pixels opaque background, while every corrected before-input/Reset/resume state retained substantial gameplay pixels. Fresh `npm test`, complete browser, live Flow, build, dependency, static, and diff gates passed; only expected PlayCanvas worker externalization/chunk warnings remained. No production, dependency, version, release, or server behavior changed.

Independent correction QA repeated both standalone matrices and the entire gate chain at `29ce631`. Every DPR1 sample contained exactly `329,160` opaque composite pixels; DPR3 correctly honored the renderer DPR2 cap with exactly `1,316,640`. Every old-yaw sample was exactly all background, corrected before-input counts ranged `76,029–690,182`, Reset-next-frame `76,056–686,835`, and resume `76,153–670,374`, and the deliberate invalid sample was rejected. P0 correction `656` is closed. During final boundary verification QA discovered that required retained `dev:tailscale` PID `2972964` had exited: no local `:5173` process accepted connections and the unchanged Tailscale `:8443` proxy returned HTTP `502`. Operational P0 `aerobeat-web-assembly-f3v` recorded that boundary without treating it as a product defect.

Independent closure verification found no remaining QA blocker. The original PID and its parent had vanished externally and no exit/OOM record remained, so exact PID continuity could not be preserved. After confirming no duplicate process, `f3v` restored exactly one approved managed process tree (`npm` PID `3901811` → shell PID `3901822` → Vite PID `3901823`) on the unchanged Tailscale proxy. Exactly one listener owns `127.0.0.1:5173`; both local `:5173` and tailnet `:8443` return HTTP `200`. Assembly QA evidence remains clean/upstream at `df3b29e`, renderer `3cfbbe4` and UI `3bf327f` remain clean/upstream, all `0.0.28` package/lock/index/proof and raw artifacts remain unchanged, the historic `0.0.28` physical result remains Failed/superseded, and every `0.0.29` physical retest remains Pending with no winner. QA Bead `614` is closed PASS and release Bead `235` is ready.

## Task 3 — Deterministic hotfix release

**Bead:** `aerobeat-web-assembly-235`
**Status:** Complete — release coder and final independent audit PASS; Bead closed

Package/lock/index/README/proof surfaces agree on `0.0.29`; the intentional raw browser proof is generated under `release/raw/0.0.29` while every tracked `0.0.28` byte remains unchanged. Fresh unit, complete browser, strict eight-context debug-camera canvas evidence, exact live `3C9D` Flow, build, dependency, forbidden-identity, and diff gates pass. Repeated raw constructions compare recursively byte-for-byte with the committed tree. Exact raw/proof/source/size and final committed-payload pack metadata remain only in external Bead evidence, avoiding self-reference in this packed plan. The focused handoff retains Derrick's `0.0.28` desktop Flow failure as superseded and every `0.0.29` retest as Pending, with no winner.

## Task 4 — Independent QA/audit and closure

**Bead:** `aerobeat-web-assembly-lym`
**Status:** Complete — final independent audit PASS; Bead and implementation bug closed

The final auditor independently reviewed Derrick's physical symptom, the renderer and assembly diffs, commits, tests, Beads, release proof, physical boundary, server recovery, and all linked repositories. Fresh assembly `npm test`, complete `npm run test:browser`, exact live Flow, build, dependency and diff gates passed. All eight direct/real-iframe portrait/landscape DPR1/3 contexts produced valid fully opaque composite samples with exact Aero-background corners and complete pixel partitions; forced yaw zero was exactly all background in every context, while corrected before-input, Reset-next-frame, and resumed states retained substantial gameplay pixels. The transparent-invalid-sample self-test rejected the original evidence false-positive path. Fresh renderer unit/browser/dependency/diff gates passed at audited commit `3cfbbe4`, confirming the coherent `Math.PI` stored/reset pose without a camera-disable, DOM, clear-color, culling, or fixed-camera workaround. Terminal replay, free-fly input/cleanup, all presentations/conversions, exact 4×3/timing/duration/scoring/privacy/lifecycle/context contracts remain intact.

The auditor rebuilt raw `0.0.29` twice; both rounds were byte-identical to each other and the committed 13-file tree, while raw `0.0.28` remained unchanged. Package/lock/source/raw proof surfaces all resolve to `0.0.29`; PlayCanvas remains `2.21.4`; forbidden legacy renderer identities remain absent. Every linked repo is clean/upstream. The original required server PID `2972964` had vanished externally before final QA and could not truthfully be retained; operational Bead `f3v` restored exactly one approved managed tree (`npm` PID `3901811` → shell `3901822` → Vite `3901823`) behind the unchanged Tailscale proxy. Local and tailnet routes return HTTP `200`, with no duplicate listener. Final pack metadata is recorded externally after the closure commit with no later packed-file edit. Historic `0.0.28` remains Failed/superseded; every `0.0.29` physical retest remains Pending and no gameplay or conversion winner is selected.
