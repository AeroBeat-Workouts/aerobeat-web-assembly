# Task 12 Mobile Playtest Debug Record

## Exact Observed Failure

Derrick’s Android physical test loaded the product, but the viewport was filled by configuration UI. No usable play area or live webcam feed became visible after selecting a workout prototype and pressing calibration.

Directly observed:

- the HTTPS page loaded;
- the operator saw a screen full of options;
- selecting calibration/prototype controls did not yield a visible camera/gameplay surface.

Not yet established from physical evidence:

- whether `getUserMedia()` was invoked or denied;
- whether a stream existed behind the opaque/dense controls;
- whether calibration inference started;
- the exact product snapshot/error at the moment of failure.

## Expected Behavior

The phone experience must be gameplay-first:

1. the video/renderer playfield occupies the viewport;
2. one hamburger button at the top right opens/closes configuration;
3. the menu contains compact actionable controls, without visible section titles or explanatory labels;
4. the operator selects song and gameplay, then activates Calibrate to request camera permission/start the session;
5. after leaving the menu, a four-second T-pose starts calibration, followed by the frozen 3-2-1 overlay and gameplay;
6. a T-pose during gameplay pauses and requires a fresh T-pose plus 3-2-1 to resume;
7. opening the hamburger during gameplay pauses immediately; closing it leaves the workout paused until a fresh T-pose completes, then 3-2-1 resumes gameplay.

The four Boxing modes remain experimental; this flow must not select a winner.

## Execution Path

Current path:

1. `index.html` fills the viewport with one `<aero-game>`.
2. `AeroGame` constructs stable full-size video and canvas surfaces.
3. `template()` places `.ui` over the entire game as a two-column grid on desktop and a one-column layout on mobile.
4. The `.hud` always contains calibration, tracking, countdown, and the full prototype/profile selector.
5. The `.browser` always contains BeatSaver, import, library, capabilities, and error presenters; on mobile it occupies a visible grid row with a 30vh cap.
6. Each presenter renders card panels, section headings, explanatory text, labels, telemetry, and actions.
7. Camera permission only occurs through `AeroGame.start()`; current presenter intents expose calibration reset but no dedicated start/calibrate intent wired to `start()`.
8. Prototype selection only calls `selectVariant()` and therefore cannot request camera permission.
9. Existing `pause()` stops frame processing/CV/video, so it cannot support a menu pause that remains pose-aware and waits for a T-pose.
10. Input already recognizes a sustained T-pose after calibration as recalibration; gameplay safety converts that loss of readiness into tracking pause and resumes through a fresh calibration/countdown. Assembly does not yet expose this as the explicit menu/pause interaction.

## Most Likely Root Cause

The root cause is a composition/state-machine mismatch, not a camera backend failure:

- The assembly template treats all presenter panels as permanently visible HUD instead of a dismissible configuration layer.
- Mobile CSS stacks those panels over the video/canvas, leaving no clean gameplay view.
- There is no hamburger/menu state.
- There is no UI calibrate/start intent connected to `AeroGame.start()`.
- The existing manual pause operation shuts down pose processing, which conflicts with T-pose-to-resume behavior.

Evidence:

- `src/index.js` template permanently renders full `aero-prototype-selector` in `.hud` and all acquisition/library/capability presenters in `.browser`.
- The mobile media query only changes grid columns and browser height; it never hides the configuration layer.
- `handleUiIntent()` handles `calibration-reset` but has no `calibration-start`/game start intent.
- `start()` is the only path that calls `video.requestCamera()`.
- `pause()` stops frame loop and CV, while the input/gameplay services already support fresh T-pose calibration and tracking-resume countdown when frames continue.

## Alternative Hypotheses

1. **Camera permission/API failure** — possible but secondary. The operator did not report a permission prompt. Automated Android-route delivery and real BRIO injection passed, but no physical phone camera snapshot exists. A direct start intent plus visible error state will distinguish this.
2. **Video exists but is visually obscured** — highly likely. Video opacity is 0.42 and all dense UI is overlaid at higher z-index.
3. **No content configured, so `requestStart()` is rejected** — possible after camera acquisition. Current `start()` catches gameplay start failures while content/calibration may be pending; visible state must distinguish camera/calibration from missing content.
4. **Mobile viewport sizing defect** — less likely. Automated exact-container and responsive evidence passes, but it validated bounds rather than gameplay-first visual priority.

## Why Previous Fixes Failed

Prior work optimized exact sizing, responsive containment, accessibility, profile state, and no-clipping evidence. Those checks proved that panels fit or were fully capturable; they did not test whether the play surface remained visually dominant on a real phone. The evidence therefore validated the existing panel-heavy composition instead of the intended gameplay interaction.

Camera lifecycle tests exercised public `start()` and injected streams, but no product control invoked `start()` from the visible calibration UI. This left the primary physical path unreachable even though the underlying service path passed.

## Unknowns

- Exact Android browser/version and whether camera permission was previously denied.
- Whether any error/status text changed after the operator pressed controls.
- Whether a phone stream was acquired behind the menu.
- Whether selected content was fully authored/loaded before calibration.

Resolve these with a new physical run that records bounded snapshots/status text before and after Calibrate, without retaining camera frames.

## Minimal Reproduction

1. Open the Android HTTPS route.
2. Observe the initial `<aero-game>` screen.
3. Select a workout prototype.
4. Activate the existing calibration control.
5. Observe that configuration panels remain dominant and no clear camera/gameplay surface or camera prompt appears.

Automated direct `game.start()` and injected-camera paths do not reproduce the missing-control problem because they bypass the visible presenter interaction.

## Proposed Verification

Before accepting a fix, add browser tests that:

- start at an exact 390px portrait viewport and assert only the full playfield plus one top-right menu button are visible when the menu is closed;
- open the menu and assert compact action controls are visible while headings/explanatory labels are not visually rendered;
- invoke Calibrate and assert exactly one `getUserMedia()` request path, menu close behavior, visible video, calibration waiting state, and stable canvas/video nodes;
- simulate T-pose input to prove initial calibration → cooldown → 3-2-1 → playing;
- simulate T-pose during play to prove pause → fresh calibration → 3-2-1 → resume;
- open menu during play to prove immediate audio/gameplay pause while camera/CV remain available, close menu without auto-resume, then T-pose → countdown → resume;
- preserve hidden/tracking-loss safety, lease ownership, reconnect, iframe privacy, and desktop accessibility.

Physical verification must repeat the flow on Derrick’s phone and record only state/results, never frames.

## Recommended Fix

Implement the smallest coherent product flow across assembly and UI:

1. Add assembly-owned `menuOpen` and pose-aware `menuPaused` state.
2. Render a stable accessible hamburger button at the top right and a dismissible configuration drawer; default to a clean playfield on reconnect, with a first-run affordance that opens configuration only when needed.
3. Add compact presenter mode that visually suppresses headings/explanatory labels while retaining accessible names and action button text.
4. Add a dedicated Calibrate action that calls `AeroGame.start()` and surfaces permission/errors.
5. Add a pose-aware menu pause operation: pause gameplay/audio and invalidate calibration, but retain camera/CV/frame processing. Closing the drawer never directly resumes; fresh T-pose causes the existing tracking-resume countdown.
6. Treat a sustained T-pose during play as the same fresh-calibration pause/resume cycle, using existing input/gameplay safety rather than a second timing implementation.
7. Keep direct/iframe APIs, media lease, hidden-page policy, and teardown behavior unchanged.

Adjacent regressions: keyboard focus trapping/restore, touch target size, multiple instances, menu state on reconnect, iframe commands, autoplay, fullscreen, tracking loss, and accidental T-pose during ordinary punches.

## Debugging Record

```text
Problem: Android physical play loaded panel-heavy UI but exposed no usable camera/gameplay view.
Observed symptom: Full screen of options; calibration/prototype presses produced no visible live feed/play area.
Root cause: Permanent overlay composition plus missing UI start intent and a manual pause path that disables pose processing.
Evidence: Assembly template always renders all panels; mobile CSS only stacks them; `handleUiIntent` has no start/calibrate intent; only `start()` requests camera; `pause()` stops CV/frame loop.
Failed approaches: Responsive/no-clipping and service-level camera tests validated containment/backend paths but bypassed gameplay-first product interaction.
Corrective action: Hamburger drawer, compact presenters, dedicated Calibrate→start, pose-aware menu pause with calibration invalidation and T-pose/countdown resume.
Verification test: Exact 390px browser state transitions plus simulated T-pose/menu pause and physical Android rerun.
Related files/components: assembly `src/index.js`; UI product presenters; input body-grid service; gameplay session coordinator; assembly browser validators.
Remaining uncertainty: Phone permission state, content-loaded state, and whether a stream existed behind the overlay.
```
