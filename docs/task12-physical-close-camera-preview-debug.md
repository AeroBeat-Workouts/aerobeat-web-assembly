# Task 12 physical close-control and camera-preview debug report

Date: 2026-08-29  
Baseline: assembly `4c0329f`, UI source implementation `b777bdb`, UI QA closure `fc7e869`  
Scope: diagnosis only; no product source was changed

## Exact Observed Failure

### Directly observed by Derrick

1. On the currently served phone build, the open-menu `×` does not visibly contrast with its button background.
2. The K-pop Demon Hunters map now reaches the 4×3/T-pose calibration view. This confirms the selected-map import/start transaction is no longer the blocker.
3. The athlete cannot see the required clear live mirrored camera preview while framing and holding the T-pose.

The physical observations supersede the prior automated handoff. They do not establish that calibration completed or that gameplay began.

### Reproduced close-control evidence

The existing Tailscale route was sampled without restarting or replacing its managed process. Exact element screenshots were decoded and sampled for direct and real cross-origin iframe embeds at 390×844 and 844×390, at device scale factors 1 and 3.

All eight samples agree:

- button geometry: 48×48 CSS px;
- text: Unicode `×` rendered by `700 24px system-ui`;
- computed glyph color: `rgb(16, 52, 71)` (`#103447`);
- computed opaque background: `rgb(3, 19, 31)` (`#03131f`);
- glyph/background contrast: about **1.436:1**, not 4.5:1;
- at DPR 1, 1,693 of 2,304 pixels are exact button background and 30 pixels are exact glyph color; the sampled center crossing is dark `#103447`/nearby antialias shades;
- the few white/high-luminance pixels span the button corners and are from the translucent border/corner antialiasing, not a white close glyph.

This is not a stale-route difference: direct and iframe pixels match in both orientations and both DPRs, and current source contains the same inheritance path.

### Reproduced camera-layer evidence

Current source and served DOM place:

1. `<aero-background-environment>` at z-index 0;
2. mirrored `<video>` at z-index 1 with `opacity:.58`;
3. WebGL `<canvas>` at z-index 2.

The renderer requests an alpha-capable context, but every `renderGameplayFrame()` clears the entire canvas to the first renderer background color. The default projection is `#071426`/`#153b5d`; `#071426` resolves to alpha 1. Assembly never changes this projection based on calibration or environment selection and renders a gameplay frame every 67 ms in all active states.

A synthetic local green MediaStream, used only inside the child for diagnosis, proves the compositor path without exposing camera pixels through messages:

- after an explicit opaque renderer clear, the composed center pixel is `[7,20,38,255]`;
- after an explicit transparent renderer clear, the composed center pixel is `[5,164,28,255]`, showing the same green stream through the current `.58` video opacity;
- with the environment and renderer hidden and video opacity set to 1 for diagnosis, the center is `[0,255,0,255]`.

A second actual-facade probe found another lifecycle gap: after stream injection followed by `AeroGame.start()`, the video is `readyState:4`, 320×240, but `paused:true`. CV reports running and accepted synthetic frames, but assembly never calls `graph.video.play(videoElement)`. Whether a live MediaStream paints continuously while the element remains paused is browser-dependent and must not be the product preview contract.

## Expected Behavior

- The sole 48×48 open-menu control must display a thick, unmistakable close icon with framebuffer-proven contrast against its own opaque background. Drawer text contrast is unrelated.
- After Calibrate/Start acquires/retains the camera, a clear mirrored live preview must be forced throughout initial uncalibrated/holding/recalibrating T-pose work.
- Tracking loss that requires fresh calibration must force the same preview until fresh calibration becomes ready.
- The preview must hide immediately when fresh calibration reaches ready/countdown/playing unless the athlete explicitly selected **Camera** as the environment.
- When Camera is selected, the live mirrored feed remains the calibrated-play environment while WebGL targets/guides render above it.
- Camera bytes, frames, screenshots, and pixels remain child-local and never enter snapshots or iframe messages. The retained stream, single transient cue, one-menu-control rule, and media lease lifecycle remain intact.

## Execution Path

### Open-menu close control

1. `setMenuOpen(true)` calls `renderInteractionShell()`.
2. `renderInteractionShell()` sets `button.textContent = "×"`.
3. `.menu-button,.start-action` sets `color:inherit`.
4. `.menu-button` sets only its opaque dark background and font size; it does not establish a paired foreground.
5. The `:host` color is `var(--aero-color-ink,#eaf9ff)`.
6. The served product theme supplies `--aero-color-ink:#103447`, so the menu glyph inherits the light-theme dark ink.
7. The locally paired dark text/light surface variables exist only inside `.drawer-surface`; the corner button is its sibling, outside that surface.
8. Chromium paints dark `#103447` glyph pixels over dark `#03131f`, producing the measured 1.436:1 result.

### Initial camera/start/calibration

1. `startFromMenu()` ensures playable content, then calls `AeroGame.start()`.
2. `start()` obtains the media lease, requests or reuses a retained mirrored live-camera stream, and calls `attachRetainedCamera()`.
3. `attachRetainedCamera()` assigns the retained stream to the stable video element and creates the locked CV frame source.
4. `start()` starts CV and the 67 ms frame loop, but does not call the video facade's `play()` method.
5. Configuring content places gameplay in `calibrating`; `requestStart()` remains rejected until safety is ready and a calibration ID exists.
6. Input progresses `uncalibrated` → `holding`/`recalibrating` → `cooldown` with readiness `countdown`, then `calibrated` after release.
7. Each frame calls `renderer.renderGameplayFrame(rendererFrame())` regardless of calibration state.
8. Renderer clears the z-index-2 canvas with alpha-one `#071426` before drawing the 4×3 grid/targets. That full-surface clear hides the z-index-1 video even though the video element exists and is mirrored.
9. When input readiness becomes safe, gameplay enters `countdown`, then `playing`. No code changes video visibility or renderer background at any transition.

### Tracking-loss recalibration

1. Input tracking loss invalidates calibration and sets `freshCalibrationRequired`/`paused_tracking`.
2. Gameplay enters `paused_tracking` and remains there while input is tracking-lost/recalibrating.
3. A new calibration ID plus safe readiness automatically starts a tracking-resume countdown.
4. The current compositor is unchanged throughout, so no live preview is forced during recovery and no default hide transition exists afterward.

## Most Likely Root Cause

There are two confirmed root causes.

### Close icon

The button's foreground is unpaired inheritance. The prior repair paired foreground/background only for `.drawer-surface`, while the sole corner control remained `color:inherit`. The product theme resolves that inheritance to dark `#103447`; framebuffer samples prove the resulting 1.436:1 glyph/background contrast. Unicode font weight/thinness worsens recognition, but it is not the primary contrast cause.

### Camera preview

The product has no camera-preview visibility/compositing state. The video is always behind the canvas, and the renderer always clears that canvas to an opaque background. Therefore the video cannot be the calibration preview. A second confirmed gap is that `start()` attaches but never explicitly plays the video, leaving the media element `paused:true` in the actual facade probe.

## Alternative Hypotheses

Ranked by likelihood:

1. **Confirmed: inherited dark glyph color.** Source cascade, computed style, and framebuffer pixels agree.
2. **Contributing: font-dependent Unicode `×` is too thin/ambiguous.** Even with corrected color, a text glyph can vary by Android font rasterizer. A CSS/SVG geometric icon avoids that dependency. It does not explain the measured dark pixels by itself.
3. **Rejected: stale served transform causes the close failure.** The existing Tailscale route matches current `4c0329f` source in all direct/iframe/orientation/DPR samples.
4. **Contributing adjacency: dark button sits in the dark top gutter outside the light drawer surface.** This makes the button perimeter less distinct, but the decisive failure is its dark glyph. The opaque button/background contract can still work with a strong border and explicit white geometry.
5. **Confirmed: opaque WebGL clear occludes the video.** Source layer order plus opaque-versus-transparent compositor samples distinguish this from missing stream data.
6. **Contributing: video playback is not explicit.** The element remains paused after start. This can yield a static or implementation-dependent preview even after canvas transparency is fixed.
7. **Rejected as primary: environment component alone covers video.** It is z-index 0, below the z-index-1 video. Hiding only the renderer reveals the video blend.
8. **Rejected: gameplay `live_visual` profile should decide camera visibility.** That contract accepts only `motionIntensity` and `roleScale` and controls renderer tuning identity, not media/environment ownership.

## Why Previous Fixes Failed

- The h8z contrast assertion sampled a drawer heading against `.drawer-surface`; it never sampled the corner glyph against the corner button framebuffer.
- The h8z button assertion proved only 48×48 geometry, alpha-one background, one control, and `×` text. It did not assert computed foreground, glyph pixels, stroke mass, or glyph/background contrast.
- Reusing `color:inherit` assumed the host's ink token was a dark-environment foreground. In the served product it is the light-theme dark ink token.
- Existing calibration tests use pose/state mocks and inspect overlay counts. They do not verify that a live video frame is visibly composited beneath transparent WebGL guides.
- Browser media mocks often implement attachment/play behavior themselves, masking the production path's missing explicit `graph.video.play()` call.
- The renderer's alpha-capable context was mistaken for transparent composition, but its per-frame alpha-one clear makes the effective canvas opaque.

## Unknowns

- The exact Android browser/font rasterizer and device DPR used in Derrick's physical run are not captured. This does not change the confirmed inherited color defect; physical post-fix pixel and visual confirmation remains required.
- Derrick reported reaching the T-pose view, not whether measured pose calibration completed. The current evidence does not claim physical calibration success.
- It is not yet verified whether Android continuously paints a live MediaStream while `video.paused === true`; implementation must explicitly play rather than depend on that behavior.
- The preferred user-facing name for the non-camera environment (`Aero`, `Studio`, or another concise label) needs product confirmation. The semantic owner does not depend on that copy choice.
- Persistence duration for the environment choice (session-only versus local preference) has not been specified.

## Minimal Reproduction

### Close icon

1. Open the existing Tailscale route at 390×844 or 844×390, directly or in the real cross-origin iframe.
2. Open the drawer.
3. Inspect the sole 48×48 button.
4. Computed foreground is `rgb(16,52,71)` over `rgb(3,19,31)` and framebuffer contrast is about 1.436:1.

The failure does not occur for drawer headings because `.drawer-surface` establishes its own light background and dark paired ink.

### Camera occlusion

1. Attach any readable mirrored MediaStream to the stable video element.
2. Close the menu and allow a normal gameplay frame to render.
3. The video is at z-index 1; the canvas is at z-index 2 and cleared alpha 1, so the composed result is the renderer background.
4. Clear the same canvas to transparent without changing the stream; the video immediately appears underneath.

## Proposed Verification

Before accepting an implementation:

1. Sample the actual sole button framebuffer on the existing phone route and fresh direct/iframe 390×844/844×390 at DPR 1 and 3.
2. Require an explicit non-font close geometry, at least 3 CSS px stroke width at DPR 1, an interior connected X-shaped high-luminance mask, and >=4.5:1 (preferably >=7:1) foreground/background pixel contrast. Exclude border pixels from the glyph metric.
3. Inject a child-local synthetic moving checker/color stream and drive exact input/session snapshots through initial uncalibrated, holding, cooldown/ready, countdown, playing, tracking lost, recalibrating, and tracking-resume countdown states.
4. At calibration/recalibration states, prove multiple time-separated composed samples change with the stream, are mirrored, and remain visible under transparent WebGL 4×3 guides.
5. At ready/countdown/playing with default environment, prove video is hidden immediately and renderer/environment remain opaque.
6. Select Camera through its native radio, repeat countdown/playing, and prove moving mirrored frames remain visible under WebGL targets.
7. Assert `video.paused === false` after start/resume and that pause/visibility/lease teardown still pause without releasing the retained stream.
8. Inspect all direct/iframe snapshots and messages to prove only bounded scalar environment state crosses boundaries; no media, frame, pixel, screenshot, Blob, or byte data is serialized.
9. Preserve exactly one transient cue and one menu control in every state.

## Recommended Fix

### Close control

Keep one native button and its current accessible label/toggle behavior, but stop using a font glyph as the visible icon. Render two explicit rounded bars (CSS pseudo-elements or a fixed child) with an explicit white fill, about 24×4 CSS px, rotated ±45 degrees. Give the button a paired explicit background/border and test the interior framebuffer mask, not only computed CSS.

### Camera preview lifecycle

Assembly owns a bounded `environmentMode` such as `"aero" | "camera"` plus a derived preview predicate. It should explicitly call and await `graph.video.play(videoElement)` after attaching the retained stream and before relying on CV/preview.

Use the following lifecycle:

- `forcedPreview = sessionStartRequested && (session.state === "calibrating" || session.state === "paused_tracking" || input.tracking.freshCalibrationRequired === true)` while calibration is not yet safe;
- stop forcing as soon as input has a fresh non-null calibration ID and readiness/safety reaches ready/countdown, which is the same frame gameplay enters countdown;
- `previewVisible = forcedPreview || environmentMode === "camera"`;
- while visible: video opacity 1, mirrored, playing; renderer background projection transparent while retaining WebGL guides/targets;
- while hidden: hide the video and restore the opaque Aero/content projection immediately; retain the stream and keep CV/lease behavior unchanged.

Tracking-loss `paused_tracking` forces preview until a fresh calibration becomes safe; the automatic tracking-resume countdown then hides it unless Camera is selected.

### Owning boundary for Camera under Visuals

This is **assembly-owned environment/compositor state**, not a gameplay `live_visual` profile:

- `live_visual` is an experimental renderer-tuning identity with an exact settings allowlist of `motionIntensity` and `roleScale`;
- content background suggestions describe authored/host visual assets, not the athlete's live-camera privacy choice;
- assembly owns the stable video/canvas/environment layers, media lease, start/resume state, and menu sections.

The smallest owner-correct UI is an assembly-native fieldset/radiogroup under Visuals with a concise environment legend and two native radios, for example `Aero` and `Camera`. It should be independent of the existing Default/Compact renderer-profile radio group. Selection remains a bounded scalar; raw camera data stays child-local. No gameplay or content contract expansion is justified by current requirements.

Regression risk is concentrated in WebGL alpha restoration, target contrast over arbitrary camera scenes, explicit media playback and pause/resume, tracking-loss transition timing, first-run menu gating, fullscreen/iframe playback policy, and privacy snapshots.

## Debugging Record

```text
Problem: Physical open-menu close icon is unreadable and live mirrored camera is absent during T-pose/recalibration.
Observed symptom: Derrick sees a low-contrast ×; K-pop Demon Hunters reaches 4×3/T-pose but no clear live athlete preview.
Root cause: Corner button inherits dark #103447 ink over #03131f (1.436:1); video is below a canvas that is cleared opaque every frame, with no state-driven preview policy; start also does not explicitly play the video.
Evidence: Existing Tailscale direct/iframe 390×844/844×390 DPR1/3 framebuffer samples; source cascade/layer trace; opaque clear [7,20,38,255] versus transparent clear revealing synthetic stream [5,164,28,255]; actual facade video remains paused after start.
Failed approaches: Drawer-heading contrast as proxy for button glyph, geometry/background-only menu tests, inherited foreground assumption, pose-only calibration tests, and treating alpha-capable WebGL as transparent composition.
Corrective action: Explicit thick white geometric close icon with framebuffer mask checks; assembly-owned Aero/Camera environment state; explicit video play; transparent renderer background only for forced calibration/recalibration or selected Camera; default hide at fresh ready/countdown/playing.
Verification test: Existing phone route plus fresh four-context DPR1/3 glyph sampling; moving synthetic stream across exact calibration/countdown/play/tracking-loss states; mirror/play/alpha/privacy/one-cue assertions.
Related files/components: assembly src/index.js renderInteractionShell/template/start/startFrameLoop/renderPresenters; renderer renderer-facade.js/visual-profiles.js; input body-grid-service.js; gameplay session-coordinator.js; video browser-video-facade.js; mobile/shell browser matrices.
Remaining uncertainty: Exact Android rasterizer/DPR, whether Derrick completed physical calibration, Android paused-MediaStream paint behavior, environment label, and preference persistence duration.
```

## Implemented Repair — Independent QA and Physical Retest Pending

P0 `aerobeat-web-assembly-p4p` implements the diagnosed assembly boundary without changing gameplay `live_visual`, content background contracts, or iframe commands:

- the sole button contains no visible text glyph; one CSS icon renders three explicit 24×4 white bars while closed and exactly two rotated 24×4 white bars while open, with explicit `#fff` paint over opaque `#03131f`;
- Visuals now contains a separate native `Environment` radio group with 42px `Aero` and `Camera` choices; Aero is the reconnect/default choice and selection remains child-local rather than entering snapshots, profile settings, or iframe messages;
- video is hidden/opaque-Aero by default, explicitly played after retained-stream attachment and on resume/document restoration, and never reacquired for environment switching;
- initial `calibrating` while safety is not ready, `paused_tracking`, and fresh-calibration-required recovery force an opacity-one mirrored preview with renderer background projection `#00000000`; the alpha-capable WebGL canvas still renders guides/targets above it;
- fresh safe calibration transitions to countdown and immediately restores `#071426`/Aero with video hidden unless Camera is selected; Camera keeps the retained playing preview and transparent renderer during calibrated countdown/play;
- menu opening does not expose Aero camera; Camera remains the explicitly selected environment; pause/lease/document-hidden paths pause and resume/replay the same retained stream; teardown hides the stable video surface and reconnect resets Aero.

New browser acceptance includes a moving child-local red/green then blue/yellow stream. Composed samples prove mirrored green/red then yellow/blue updates beneath transparent WebGL, default countdown hides it, Camera reveals the same retained stream, Aero restores opacity without reacquisition, and pause/resume/document hidden restore live playback. Direct and real iframe close-button framebuffer checks run at 390×844 and 844×390 with DPR 1 and 3. Every context measures explicit 24×4 white pseudo-element paint and an interior connected X mask: 150 high-luminance pixels at DPR 1 and 1,500 at DPR 3, with center fill, all four quadrants, and >=3 CSS px center stroke. The actual unchanged Tailscale process serves the same eight results. Full unit/browser/live/build gates pass. Two release rounds match at source fingerprint `01b535c6eab264203e88c343e6f46e1093c628559924838da07553864ba4de0e`, proof SHA-256 `9d1801b4c5fe2bc805b58b10ffc6f7e7e8b7f0330dc4cffccc3755cb2eaccb8c`, and pre-manifest bytes `3286234`; two dry packs match. Independent QA `9y6` and Derrick's physical camera/play retest remain required.
