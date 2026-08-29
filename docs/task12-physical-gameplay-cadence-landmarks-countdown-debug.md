# Task 12 Physical Gameplay Cadence, Landmarks, and Countdown Debug Record

## Exact Observed Failure

Derrick’s Android physical test on final assembly `2bfb24b` established:

- Preview for an already downloaded song worked.
- The game entered the T-pose flow.
- No visible 3-2-1 countdown was perceived.
- Gameplay beats appeared.
- No nose, left-wrist, or right-wrist landmarks were visible over the gameplay grid.
- Beat motion rendered at a frame rate too poor for a meaningful physical gameplay test.

These are operator observations. The exact physical session/pause reason and phone-side CV inference latency were not captured, so this report does not assign a cause to any possible later stop/pause.

## Expected Behavior

After a four-second T-pose and release/cooldown:

1. one minimal cue visibly presents 3, 2, and 1 for approximately one second each while gameplay audio/timeline remain frozen;
2. audio and gameplay begin together after countdown completion;
3. targets move at display cadence rather than pose-inference cadence;
4. calibrated nose and wrist cursors remain clearly visible over the judged 4×3 gameplay grid;
5. the CV submission ceiling remains 15fps and each fresh pose is consumed once;
6. stale/low-confidence pose data immediately removes cursors and preserves tracking-loss safety;
7. no raw media, frame, pixel, or unbounded pose data enters public snapshots or iframe messages.

## Execution Path

### Start and countdown

1. `startFromMenu()` ensures playable content, invokes `start()`, then closes the drawer.
2. `start()` acquires the media lease/camera, explicitly plays retained video, starts CV, sets `sessionStartRequested`, attempts `gameplay.requestStart()`, and starts the assembly frame loop.
3. Initial start remains in calibration until the input snapshot is freshly ready.
4. On a later assembly tick, `gameplay.advance()` consumes fresh input. If safety is ready, assembly retries `requestStart()`.
5. Gameplay `beginCountdown()` records value 3 and a wall-clock start. `advanceCountdown()` exposes 3, 2, and 1 across successive 1000ms intervals, freezes audio/timeline, and is the only path into `playing` after at least 3000ms.
6. Assembly intentionally removes countdown from the WebGL renderer frame. The only product countdown is the DOM transient cue derived from `gameplay.countdown.value`.

### Runtime cadence

1. Production CV owns an independent `setInterval(..., ceil(1000/15))` submission lane.
2. Assembly separately owns one monolithic `setInterval(..., 67)`.
3. That ~14.93fps interval performs all fresh-pose consumption, input time advancement, gameplay advancement, request-start retry, audio synchronization, camera presentation, WebGL gameplay rendering, and full presenter/cue updates.
4. Renderer target interpolation uses the gameplay/audio timeline supplied by this same assembly loop.
5. The repo contains an animation-frame cadence helper, but production assembly imports and uses it nowhere.

### Pose and landmark rendering

1. MediaPipe normalization produces seven bounded named points: nose, shoulders, elbows, and wrists as `{name,x,y,confidence}`.
2. Assembly reads each fresh pose and passes it to body-grid input.
3. Input mirrors raw camera X into athlete space, applies calibration bounds, and publishes calibrated bounded anchors.
4. Gameplay consumes those anchors for judging.
5. Assembly calls only `renderer.renderGameplayFrame()`.
6. Assembly never calls `renderer.renderLandmarkOverlay()` and never includes pose/anchors in the gameplay renderer frame.
7. `renderGameplayFrame()` clears the complete color buffer every tick, so no landmark could persist from another lifecycle stage.

## Most Likely Root Cause

### Confirmed: poor gameplay frame rate

The 15fps CV ceiling was incorrectly conflated with the entire game/display cadence. A no-edit measurement of the unchanged managed route over 2011.4ms produced:

- renderer frames: 30
- renderer cadence: 14.915fps
- browser animation-frame callbacks: 122
- display animation cadence: 60.654fps
- CV target: 15fps

Target motion can update only when assembly renders, so beats visibly jump in ~67ms steps even when the display supplies ~60fps.

The loop also calls full presenter rendering every tick. Input subscriptions can trigger additional presenter work at pose cadence. This creates unnecessary DOM/shadow-root reconstruction in the same main-thread path as gameplay.

### Confirmed: missing nose/wrist landmarks

This is an unconditional assembly integration omission. CV and input possess the points, but assembly never invokes the renderer overlay. Every gameplay draw clears the canvas. Successful T-pose calibration directly contradicts the idea that all pose data was absent.

### Physical countdown nonvisibility: leading cause, not yet fully proven

The deterministic coordinator cannot reach `playing` without traversing at least three seconds of countdown. Existing synthetic direct/iframe tests observe a numeric cue. Therefore this is a physical presentation/observability failure, not a proven skipped coordinator state.

The leading explanation is main-thread starvation/coalesced DOM painting: countdown exists only as one DOM mutation inside the same monolithic low-cadence path that performs gameplay, renderer, CV-adjacent, and presenter work. If a slow phone is blocked across one or more countdown boundaries, state can advance while intermediate text never receives a useful physical paint. Other possibilities—cue gating or physical stacking—require state-edge/pixel evidence.

## Alternative Hypotheses

1. **Main-thread MediaPipe latency additionally stalls display work — likely.** Production uses the direct MediaPipe adapter while timer opportunities are dropped during in-flight estimates. Device latency is not yet captured.
2. **Cue gating is false — possible.** `menuOpen` or `sessionStartRequested` can suppress the transient cue, but the normal closed-menu start path contradicts this absent a physical edge trace.
3. **Countdown CSS/stacking is physically unreadable — possible but lower likelihood.** The cue is white, high-weight, z25 inside HUD z10 above renderer z2, and synthetic visibility checks pass. Phone pixels were not captured during countdown.
4. **Audio clock skips countdown — contradicted.** Audio must remain frozen until `playing`; otherwise gameplay pauses with `countdown_audio_not_frozen`.
5. **MediaPipe produces no landmarks — contradicted.** The same seven points enabled successful four-second T-pose calibration.
6. **Landmarks are drawn but too small or cleared — contradicted for current assembly.** There is no overlay call at all. Size/contrast become adjacent risks after integration.
7. **Raw camera landmarks can be drawn directly — unsafe.** Raw CV uses camera coordinates and confidence names; renderer mapping/mirroring plus the CSS `cover` camera fit can double-mirror or misalign. Gameplay should use calibrated athlete-space anchors.

## Why Previous Fixes and Tests Failed

- Camera compositor repairs made the video visible but did not add pose drawing.
- Shell matrices inject realistic poses and validate state/DOM/privacy, but they do not inspect nose/wrist framebuffer pixels.
- Renderer tests exercise gameplay cues and the overlay API independently; they do not prove assembly invokes overlay after gameplay.
- The standalone UI media-pose preview has a seven-point overlay path, but assembly does not instantiate it.
- Existing countdown tests sample one numeric cue under fast synthetic conditions. They do not assert physical paint duration for 3, 2, and 1 under production CV load.
- `validate-runtime-cadence.js` proves an isolated rAF helper, but production assembly still uses the fixed 67ms interval.
- No final product test compares renderer cadence with display rAF cadence.
- Presenter rebuilding frequency is not measured.

## Unknowns

- Exact Android MediaPipe estimate-duration distribution and latest-successful-frame age.
- Whether Derrick’s wording about gameplay stopping referred to an intentional stop, tracking pause, manual pause, or completion.
- Phone-side countdown state/value, cue text/hidden/computed bounds, and paint timestamps.
- Whether high-confidence out-of-grid cursors should disappear or clamp/dim at the edge.
- Final cursor role colors/shapes and minimum physical size; Derrick must validate legibility.
- Whether a full seven-point calibration skeleton is desired. It is not required to repair steady gameplay and would add clutter.

## Minimal Reproduction

### Cadence

On the unchanged managed route, start the assembly frame loop and compare renderer `frameCount` against `requestAnimationFrame` callbacks for about two seconds. Current production yields approximately 15 renderer frames per second on a ~60Hz display.

### Missing cursors

Complete T-pose and enter gameplay in either Aero or Camera environment. Move nose/wrists while targets render. Input/calibration can react, but no corresponding canvas marker appears because the omission is unconditional.

### Countdown

The synthetic shell path reliably reaches calibration release and observes a numeric cue. The missing reproduction is the same transition under real Android MediaPipe load with cue/state/rAF timing capture.

## Proposed Verification

1. Measure display rAF and renderer/gameplay cadence for at least two seconds. Under a ~60Hz display, require at least 45 visual frames/second while CV submissions remain at or below 15fps.
2. Prove each pose timestamp is processed by input no more than once while gameplay/render may run multiple times between poses.
3. Add a state-edge and MutationObserver trace for calibration, countdown state/value, cue text/hidden/bounds, audio clock, and session. Require 3, 2, and 1 each physically eligible for paint for at least 800ms, audio frozen until `playing`, and audio start only afterward.
4. Simulate slow inference opportunities and ensure display/gameplay cadence remains independent. Preserve the 500ms tracking-loss safety contract until actual inference age proves a separate policy issue.
5. After each gameplay draw, spy that assembly invokes overlay for exactly calibrated nose/left-wrist/right-wrist anchors.
6. Framebuffer-test portrait/landscape, DPR1/3, direct/real iframe, Aero/Camera with asymmetric anchors. Prove three high-contrast marker regions at expected grid coordinates and topmost ordering.
7. Verify a camera point at x=.1 maps through input to athlete x=.9 and appears on the correct grid side without a second mirror.
8. Low confidence, tracking loss, menu pause, source change, disconnect, and reconnect must remove markers on the next cleared frame.
9. Recursively reject raw pose history, media, frames, pixels, screenshots, and object URLs in snapshots/messages.
10. Repeat on Derrick’s Android phone with a short screen recording and capture final session/pause reason if play stops.

## Recommended Fix

### Display/gameplay cadence

- Replace assembly’s monolithic 67ms interval with a cancelable display-driven animation-frame lane.
- Keep production CV’s independent 15fps submission lane unchanged.
- Consume/process a pose only when its timestamp changes; advance gameplay and render from the current authoritative audio clock on every display opportunity.
- Do not reconstruct all presenter shadow DOM every display frame. Update the one transient cue only when its state signature changes; keep drawer/status presenters event-driven or on a slower independent lane.
- Add truthful private bounded cadence telemetry for physical diagnosis: display/render count/rate, pose consumption count, and latest pose age. Do not expose raw media.

### Gameplay cursors

- Immediately after every `renderGameplayFrame()`, derive only nose, left wrist, and right wrist from the input snapshot’s calibrated athlete-space anchors.
- Adapt `confidence` to renderer visibility and use no skeleton connections.
- Map these athlete-space coordinates into the exact playfield grid/content rect returned by the gameplay render plan with `mirrored:false`.
- Draw DPR-aware high-contrast outlined markers, then role-colored centers, topmost over targets. Aim for approximately 12–16 CSS pixels after DPR scaling.
- Do not retain stale marker state; if current anchors are invalid, the cleared gameplay frame remains marker-free.

### Countdown

- First add edge/presentation timing assertions and phone telemetry.
- Drive the single DOM cue from countdown state on the display lane and publish only on state/value changes.
- Do not reintroduce duplicate renderer/HUD countdowns.
- If state edges are correct but phone paints remain starved, ensure each countdown value receives a rendered display opportunity before advancing to the next visible step while retaining frozen audio and deterministic order.

## Debugging Record

```text
Problem: Android gameplay has no visible 3-2-1, no nose/wrist cursors, and unusably low beat frame rate.
Observed symptom: Preview and T-pose work; beats appear; countdown not perceived; markers absent; target motion is very slow/choppy.
Root cause: Confirmed monolithic assembly setInterval(...,67) throttles the full game to ~14.9fps; confirmed assembly never calls renderLandmarkOverlay and gameplay clears the canvas every frame. Exact countdown paint failure still requires physical edge telemetry, with main-thread starvation the leading cause.
Evidence: Managed route measured 30 renderer frames vs 122 rAF callbacks over 2.011s; code path index.js:615-632; zero assembly overlay call sites; CV/input successfully calibrate; gameplay coordinator can enter playing only after >=3s countdown.
Failed approaches: Synthetic cue/state matrices, isolated cadence-helper tests, camera compositor tests, and renderer-only overlay tests did not verify final product display cadence or marker pixels under phone CV load.
Corrective action: Separate display-rAF gameplay/render from independent 15fps CV, stop per-frame full presenter rebuilds, render three calibrated athlete-space cursors after gameplay, add countdown/cadence/CV-age diagnostics.
Verification test: >=45 renderer fps on ~60Hz with <=15fps CV; 3/2/1 each visible >=800ms with frozen audio; DPR1/3 direct/iframe framebuffer cursor proof; mirror/stale/privacy/physical Android checks.
Related files/components: assembly src/index.js, production-cv-service.js, runtime-cadence.js; renderer renderer-facade.js/gameplay-plan.js/landmark-mapping.js; gameplay session-coordinator.js; input body-grid-service.js; mobile/shell/camera validators.
Remaining uncertainty: Exact physical countdown paint failure, phone CV latency, stop/pause reason, cursor edge/style choice, optional calibration skeleton.
```
