# AeroBeat Flow Icons, Judgement Feedback, and Test Mode

**Date:** 2026-08-30  
**Status:** Approved — In Progress  
**Owner:** `aerobeat-web-assembly`  
**Parent plan:** `.plans/2026-08-28-embeddable-game-calibration-and-boxing-prototypes.md`  
**Release target:** next web assembly release after `0.0.24`  

---

## Goal

Make Flow targets physically sight-readable, make successful and missed timing judgements visually unmistakable, and add an unranked visual-only Test Mode that plays the selected downloaded song without requiring camera input. Implement the behavior as reusable branding, gameplay, renderer, UI, and assembly contracts rather than one-off shell effects.

Do not select or promote a production Boxing winner.

---

## Physical Evidence Being Carried Forward

Derrick physically verified on the current secure phone route:

1. Linkin Park song difficulty selection worked.
2. Preview worked for both a remote/non-downloaded song and a downloaded song.
3. Normal gameplay started after the T-pose and visible `3`, `2`, `1` countdown.
4. Nose and wrist markers appeared during gameplay.
5. Current target symbols were not sight-readable enough for physical play.
6. Hit detection could not be confidently evaluated because successful and missed targets had no clear visible feedback.

Items 1–4 are non-regression requirements. Items 5–6 motivate this plan.

---

## Approved Product Decisions

### Selected Flow assets

The source assets currently live on the tailnet host `glitch` under the Downloads folder `aerobeat-gameplay-icons`:

- Directional Flow master: `arrow-icon-01.svg` (`arrow-icon-01.png` is a design reference).
- Directionless Flow master: `arrow-directionless-icon-12.svg` (`arrow-directionless-icon-12.png` is a design reference).

Use SVG masters for runtime-derived branding assets. Do not ship the large PNG references in the runtime package.

The directional master is right-facing. The renderer rotates this one semantic asset to the exact eight Flow directions. The directionless asset is not rotated.

### Approach appearance

- Targets fade in very quickly, initially targeting `80 ms`.
- Targets are fully role-colored from first visible alpha; remove the grayscale-to-color tween for Flow.
- The icon remains fixed at full readable size after the short fade-in.
- The osu!-style approach ring alone contracts toward the icon.
- The approach ring uses the same current left/right hand role color as the icon.
- Left/right colors remain theme tokens rather than baked asset colors.

### White outline

Render the same alpha-mask icon twice:

1. white backing pass at `1.12×` scale;
2. role-colored icon pass at `1.0×` scale.

Do not maintain a second outline asset. A two-pass mask prevents source drift, works for directional rotation, and is reusable for future gameplay icons. The `1.12×` outline scale must be a bounded renderer visual token so physical testing can adjust it without changing source art.

### Hit feedback

When real gameplay records a hit inside the timing window:

- Start feedback at the exact recorded judgement timeline position.
- Show `GREAT` over the target.
- Briefly pulse/flash the icon fill to white for the initial portion of the feedback.
- Fade icon, outline, and `GREAT` together over an initially targeted `350 ms` total window.
- Scale `GREAT` from `1.0` to `1.25` during that same window.
- Keep the feedback attached to the target location and rotation-independent.

Initial pulse target: `100 ms`, expressed as a bounded renderer token.

`GREAT` is a deterministic vector wordmark/semantic atlas entry, not browser-dependent DOM font rendering. It must not enter accessibility live regions or create repeated spoken announcements.

### Miss feedback

When the timing window expires without a hit:

- Start feedback when gameplay records the miss.
- Fade icon and outline over the same `350 ms` duration as a hit.
- Do not show `GREAT`.
- Do not flash white.
- Do not use a slower desaturation path.

### Test Mode

The top control row becomes:

- `Start` — normal camera/input gameplay; this replaces the label `Calibrate / Start` but retains calibration behavior.
- `Test` — visual-only playback of the selected downloaded song and difficulty.

Test Mode behavior:

- Starts the selected downloaded song immediately from the beginning.
- Does not request camera, perform T-pose calibration, run CV, require input, write score, or emit real gameplay judgements.
- Uses deterministic demonstration outcomes only: first eligible target `GREAT`, second target miss, then alternate for the song.
- Demonstration outcomes are explicitly synthetic/unranked and cannot enter score partitions, public leaderboards, authored content, persistence, or production gameplay history.
- Remote/non-downloaded songs retain Preview only; Test requires an exact selected downloaded package and difficulty.
- Missing playable content uses the same minimal Music prerequisite/focus behavior as Start, with zero camera requests.

### Menu, pause, and switching semantics

- Opening the corner menu pauses both normal Play and Test Mode.
- Closing the menu resumes Test Mode at its paused audio/timeline position without camera or countdown.
- Closing the menu during normal Play retains the existing safety policy: fresh calibration and `3`, `2`, `1` before audio resumes.
- While paused in the menu, Derrick may change song, downloaded difficulty, gameplay presentation, or choose `Start`/`Test`.
- Pressing `Start` or `Test` while another Play/Test session exists is an explicit restart:
  1. invalidate the old run generation;
  2. stop old audio and pending feedback;
  3. select/load the exact desired song/package generation;
  4. reset old active/judged target state;
  5. enter the requested mode from the selected song’s beginning.
- Switching from Test to Start enters the normal camera/T-pose/countdown path.
- Switching from Start/Play to Test releases or pauses gameplay camera/CV ownership according to existing lease contracts and begins visual playback without camera.
- Stale audio, selection, judgement, or renderer completions from the previous run may not publish into the restarted run.

---

## Reusable Architecture and Repository Ownership

### `aerobeat-branding`

Own the visual source truth:

- Import Derrick-authorized SVG masters with recorded provenance.
- Normalize both Flow assets to canonical alpha-mask atlas geometry, preserving aspect ratio and optical centering.
- Add stable semantic IDs such as `flow.directional` and `flow.directionless` to the web gameplay icon manifest.
- Add a deterministic `feedback.great` vector wordmark entry or equivalent approved semantic atlas asset.
- Keep runtime assets monochrome/current-color; hand colors and white effects remain renderer state.
- Validate exact manifest membership, normalized geometry, transparent background, and deterministic bytes.
- Publish the canonical manifest and SVGs as package assets through a small bundler-safe metadata/URL module; branding still does not rasterize, color, or animate them.

### Runtime asset delivery boundary

Current production assembly never calls renderer `uploadIconAtlas()`, so adding semantic IDs alone would continue degrading to fallback shapes. The release must consume the canonical branding package rather than copy SVG source into renderer or assembly:

1. `@aerobeat/branding` exports a bounded canonical gameplay manifest plus bundler-resolvable SVG asset URLs.
2. Assembly imports that module and starts generation-bound atlas preparation during each connection.
3. `@aerobeat/web-renderer` validates the manifest, fetches/rasterizes the currentColor SVGs child-locally, and owns only the resulting private alpha-mask atlas/GPU texture.
4. Late atlas completion after disconnect/reconnect is discarded; atlas failure remains an explicit bounded fallback/error state and never exposes pixels publicly.
5. Deterministic release proof verifies every canonical SVG is shipped once and no PNG design references enter the artifact.

### `aerobeat-web-contracts`

Own cross-package semantics where public records change:

- Add a bounded session purpose/mode contract: normal play versus visual test.
- Extend gameplay judgement truth with the exact timeline position at which the judgement was committed, if the existing timing fields cannot derive it without ambiguity.
- Define synthetic demonstration feedback separately from real judgements, or explicitly keep it renderer-only; it must be impossible to mistake synthetic feedback for score truth.
- Preserve bounded, cloneable, accessor-safe direct/iframe data.

### `aerobeat-web-gameplay`

Own authoritative run and judgement truth:

- Record deterministic hit/miss commitment timeline positions.
- Preserve current timing-window matching and scoring behavior for normal Play.
- Add visual-test session behavior that advances the song timeline but bypasses input matching and score mutation.
- Ensure visual-test runs expose no real hit/miss judgements and no score partitions.
- Pause/resume/restart by generation with exact old-run invalidation.
- Keep normal tracking-loss and calibration safety unchanged.

### `aerobeat-web-renderer`

Own all visual semantics and animation:

- Add semantic Flow icon selection and directional rotation support to draw commands/WebGL icon transforms.
- Draw the fixed-size white backing mask and colored foreground mask.
- Keep approach targets fully saturated and add bounded fast fade-in timing.
- Color the contracting ring by target hand role.
- Consume `pending`/`hit`/`miss` plus bounded feedback progress.
- Add hit whiten/pulse amount, common feedback fade, and GREAT scale/fade commands.
- Keep animation derived from authoritative song timeline rather than independent timers.
- Preserve display-rAF cadence, DPR bounds, context-loss recovery, and alpha-mask fallback behavior.
- Keep tokens in visual profiles/theme contracts; do not put scoring values in renderer tuning.

### `aerobeat-web-ui`

Own visible action semantics:

- Replace compact top action copy `Calibrate / Start` with `Start`.
- Add a true `Test` button beside Start.
- Emit scalar intents only; do not pass package objects or media.
- Expose disabled/prerequisite state truthfully for missing downloaded content.
- Keep exactly four drawer sections: Gameplay, Visuals, Music, Info.
- Do not add schema, hash, debug, profile-management, score, or test-implementation copy.

### `aerobeat-web-assembly`

Own orchestration:

- Map exact gameplay judgements to visible target feedback state and progress.
- Produce alternating synthetic visual outcomes in Test Mode without adding them to gameplay score/judgement truth.
- Bind Start/Test/menu pause/restart to exact selected collection/package generation.
- Stop Preview before either Start or Test.
- Keep remote/downloaded Preview behavior unchanged.
- Coordinate audio, camera/CV lease, hidden state, menu pause, reconnect, teardown, and latest-wins selection.
- Ensure no ZIP/audio/media/Blob/frame data enters snapshots or iframe messages.

---

## Data Flow

### Normal Play

```text
calibrated input evidence
  -> gameplay timing-window match
  -> immutable real hit/miss judgement + committed timeline position
  -> assembly joins judgement to eventId
  -> renderer target { judgement, feedbackProgress }
  -> icon/outline/ring/GREAT WebGL commands
```

### Test Mode

```text
selected downloaded package + audio clock
  -> visual-test session timeline (no camera/input/scoring)
  -> assembly deterministic event-index alternation
  -> explicitly synthetic renderer feedback
  -> same renderer animation path
```

The renderer does not decide whether a real input was a hit. Gameplay does not own pixels, colors, wordmarks, or animation easing.

---

## Approved Execution Tasks

**Umbrella Bead:** `aerobeat-web-assembly-44r`

### Task 1 — Persist feedback and normalize selected branding assets

**Bead:** `aerobeat-branding-vxa`  
**Owners:** assembly handoff + `aerobeat-branding`  
**Work:** record physical pass/fail evidence; import SVG source masters; normalize directional/directionless/wordmark alpha-mask assets; update manifest and provenance.  
**Acceptance:** deterministic branding validation; visual comparison against Derrick’s masters; bundler-safe canonical manifest/SVG exports; no runtime PNG dependency.

### Task 2 — Freeze judgement-time and visual-test contracts

**Beads:** `aerobeat-web-contracts-e0v`, `aerobeat-web-gameplay-y5c`  
**Owners:** `aerobeat-web-contracts`, `aerobeat-web-gameplay`  
**Work:** add bounded session mode and exact judgement commitment time; implement unscored input-free visual-test timeline; generation-safe pause/resume/restart.  
**Acceptance:** normal matching/scoring unchanged; Test produces zero real judgements/scores/camera requirements; hostile payload and lifecycle tests pass.

### Task 3 — Implement reusable icon and feedback renderer

**Bead:** `aerobeat-web-renderer-999`  
**Owner:** `aerobeat-web-renderer`  
**Work:** semantic Flow icons, rotation, two-pass outline, fixed-size/fast-fade approach, role-colored ring, white hit pulse, deterministic GREAT wordmark, equal-duration hit/miss fades.  
**Acceptance:** screenshot-free command-plan tests plus WebGL pixel tests at portrait/landscape DPR 1/3; exact timeline boundary tests; no grayscale tween; no visual timer drift.

### Task 4 — Add Start/Test product controls and orchestration

**Beads:** `aerobeat-web-ui-3od`, `aerobeat-web-assembly-vf5`  
**Owners:** `aerobeat-web-ui`, `aerobeat-web-assembly`  
**Work:** top Start/Test controls, compact copy, exact selected-package Test, menu pause, safe normal resume, immediate Test resume, generation-bound cross-song/mode restart, Preview stop coordination, real judgement projection, synthetic alternation, and generation-safe canonical branding atlas initialization.  
**Acceptance:** direct and real cross-origin iframe behavior match; canonical SVGs load into the actual production renderer rather than fallback shapes; remote Preview unchanged; downloaded Preview unchanged; Start retains T-pose/countdown/cursors; Test requests zero camera and alternates visible GREAT/miss outcomes.

### Task 5 — Independent QA, audit, release, and physical handoff

**Bead:** `aerobeat-web-assembly-9if`  
**Owner:** assembly coordination  
**Work:** coder → independent QA → auditor loop for every owner; deterministic release/pack; bump next release; update parent plan and physical handoff; keep server running.  
**Acceptance:** all owner tests; assembly check/unit/browser/build; direct/iframe mobile matrix; live Catalyst downloaded difficulty proof; deterministic release; no public media; no Boxing winner; Derrick can physically test both normal Play and Test Mode.

---

## Required Validation Matrix

### Timing and visual plan

- Directional master rotates correctly for all eight Flow directions.
- Directionless source events use only the directionless asset.
- Left/right icon and ring colors follow current theme tokens.
- Outline remains white and optically centered at `1.12×`.
- Target reaches full visible alpha in the configured short fade window and never desaturates.
- Hit inside early/center/late timing boundaries emits one GREAT sequence.
- GREAT and target reach alpha zero together at the common feedback duration.
- GREAT reaches exactly `1.25×` at the end of its visible animation.
- White pulse is brief and cannot persist after feedback completion.
- Miss uses the same fade duration with no GREAT or white pulse.
- Judged targets are removed only after feedback completes.

### Test Mode

- Requires exact selected downloaded song/package/difficulty.
- Starts from song time zero without camera, T-pose, CV, or countdown.
- First target demonstrates GREAT, second demonstrates miss, then alternates deterministically.
- Synthetic outcomes never appear in real judgements, score partitions, persistence, or ranking telemetry.
- Menu pauses audio/timeline/animation exactly.
- Closing menu resumes the same Test timeline.
- Selecting another song/difficulty and pressing Start/Test invalidates the old run and starts the exact desired generation at zero.
- Start during/after Test uses normal camera/T-pose/`3`,`2`,`1` safety.
- Test during paused Play stops the old run and releases unnecessary camera/CV activity.

### Non-regression

- Exactly Gameplay, Visuals, Music, Info drawer sections.
- Existing native radio/default semantics.
- Remote and downloaded Preview/Stop.
- Downloaded Difficulty switching.
- Nose/wrist cursors.
- Display-rAF gameplay cadence and independently capped CV.
- Tracking/menu recovery.
- Direct/iframe reconnect and lease isolation.
- Child-local media and bounded public snapshots/messages.
- No production Boxing winner.

---

## Risks and Mitigations

- **Crowded mobile targets:** use `1.12×` outline rather than `1.25×`; keep it tunable and cover adjacent-cell pixel tests.
- **Synthetic Test outcomes mistaken for scoring:** keep them out of gameplay judgement/score records and mark the session unranked visual-test.
- **Browser-font variance:** use a deterministic vector GREAT wordmark/atlas semantic.
- **Animation drift:** derive every phase from authoritative audio/gameplay timeline.
- **Stale run state after switching:** use the existing generation-bound latest-wins model for session restart as well as content selection.
- **Directional asset distortion:** normalize from SVG, preserve aspect ratio, rotate in shader/command space, and compare all eight outputs.
- **Privacy regression:** Test Mode must not start camera/CV and must not serialize media or asset bytes.

---

## Approval Record

Derrick approved execution on 2026-08-30 after selecting alternating synthetic GREAT/miss Test outcomes, a `1.12×` two-pass white outline, fixed full-size approach icons, immediate no-camera Test startup, and top-level Start/Test controls with the corner menu pausing either mode. Implementation proceeds through the linked Beads and coder → QA → auditor workflow.
