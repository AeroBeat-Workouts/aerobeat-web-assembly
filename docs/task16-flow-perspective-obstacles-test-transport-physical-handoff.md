# Task 16 PlayCanvas Gameplay and Visual Test Physical Handoff

**Date:** 2026-08-31

**Release:** `@aerobeat/web-assembly` `0.0.28`

**Status:** Owner release automation and independent release QA/final audit are complete; every physical-phone observation below remains Pending.

**Secure route:** `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/`

## Boundary

This checklist is the operator-owned physical validation for the PlayCanvas-plus-DOM gameplay release. Automated gates do **not** claim a physical-phone pass. Leave every observation explicitly **Pending** until Derrick records the result from a physical phone.

The release preserves **Flow**, **Boxing Lanes**, and **Boxing Grid**, plus Boxing-only **Balanced Height** and **Source Height** conversions. Every presentation and conversion remains experimental. This handoff does not recommend, select, or promote a gameplay or conversion winner.

## Prepare

1. Open the secure route on the physical phone and confirm it loads in a secure context.
2. In **Music**, choose a downloaded song and exact Difficulty. Use **Preview** and **Stop** to confirm the exact selection.
3. If available, use BeatSaver `3C9D`, Standard Easy, for the Flow reference used by automated evidence.
4. In **Gameplay**, confirm exactly **Flow**, **Boxing Lanes**, and **Boxing Grid** remain available.
5. Select a Boxing presentation and confirm exactly **Balanced Height** and **Source Height** appear under Conversion; return to Flow and confirm Conversion is hidden.
6. Begin with **Test**. It must remain audio-only and must not request camera tracking, CV, calibration, countdown, cursors, score, ranking, persistence, or history.

## PlayCanvas Flow World

1. Start **Flow** Test on `3C9D` Standard Easy if available.
2. Confirm future cues approach through depth and arrive on the corrected top-left 4×3 endpoints without row collapse.
3. Confirm repeated or nearby same-cell cues remain separately readable from far to near.
4. Confirm around beat `21` in `3C9D`, source `(x=3,y=0)` still lands at the expected bottom-right endpoint.
5. Rotate between portrait and landscape and confirm the 4×3 endpoint geometry remains square and aspect-correct.
6. Confirm directional and directionless masks, role colors, and white outlines remain crisp at the phone device-pixel ratio.
7. Confirm Flow bombs, arcs, and bursts are omitted rather than misprojected as Boxing punches.

## 3D Timing Floor and Feedback

1. Watch a cue cross the colored timing floor and confirm the early, active, and late zones remain legible in depth.
2. Confirm the floor state follows authoritative song time through upcoming, active, and spent states rather than a frame-count animation.
3. Pause Test and confirm the timing floor and cue depth freeze with audio.
4. Scrub backward and forward and confirm timing-floor state reconstructs immediately from the selected timestamp.
5. Confirm there are no legacy timing circles or destination rings.
6. Confirm synthetic Test feedback alternates beginning with `GREAT`; `GREAT` has the brief white pulse while miss does not, and both fade on the same short lifetime.

## Duration-Aware Flow Obstacles

1. Confirm translucent obstacle volumes are visible rather than disappearing or appearing as Boxing punches.
2. Confirm each obstacle occupies the expected 4×3 cell region and has visible depth for its authored start-to-end interval.
3. Confirm each obstacle remains visible through its exact authored end, then disappears.
4. Pause and scrub across an obstacle interval; confirm its depth and visibility reconstruct from authoritative song time.
5. Confirm obstacles never show synthetic `GREAT`, miss, pulse, or timing-floor feedback.

## Visual Test Transport and Cameras

1. Confirm the bottom safe-area-aware Test transport is visible with Play/Pause, seek range, and right-side `mm:ss` current time.
2. Tap **Pause** and confirm audio, cues, timing floor, obstacles, and feedback freeze together.
3. Drag forward and backward while paused; confirm the selected timeline state renders live and Test remains paused after release.
4. Press **Play** and confirm audio and visuals continue from the selected time.
5. Open and close the menu during Test and confirm direct Test resume behavior remains intact.
6. Start another song/difficulty/presentation and confirm the previous Test transport cannot revive stale audio or state.
7. Confirm the phone uses the fixed athlete camera and does not expose desktop free-fly help, Reset camera, pointer lock, or mouse/keyboard controls.
8. On an optional desktop follow-up, confirm Test alone exposes hold-right-mouse look, `WASD`, `Q`/`E`, Shift boost, and Reset camera; releasing right mouse, opening the menu, entering Play, detaching, or destroying the game must release/disable debug input.

## Preserved Boxing Presentations and Conversions

1. Run short Tests in **Boxing Lanes + Balanced Height** and **Boxing Lanes + Source Height**; confirm two scrolling lanes and the shared timing band.
2. Run short Tests in **Boxing Grid + Balanced Height** and **Boxing Grid + Source Height**; confirm all twelve 4×3 spatial cells remain row-distinct.
3. Confirm Flow never changes the retained Boxing conversion selection.
4. Record comfort/readability differences only as observations; do not name a winner.

## Optional Scored Start

After visual inspection, use **Start** in any presentation. Confirm camera acquisition, T-pose/release, ordered `3`, `2`, `1`, nose/left-wrist/right-wrist cursors, pause/recovery, and scoring remain available. Confirm the Test scrubber and desktop debug camera are unavailable and synthetic Test feedback is not scoring evidence.

## Derrick Physical-Phone Observation Record

| Physical-phone check | Result | Derrick observation |
|---|---|---|
| Secure route loads and exact Preview/Stop selection works | Pending | |
| Flow / Boxing Lanes / Boxing Grid choices are preserved | Pending | |
| Boxing-only Balanced Height / Source Height conversions are preserved | Pending | |
| Flow cues retain exact row-distinct 4×3 endpoints | Pending | |
| `3C9D` beat `21` source `(3,0)` lands bottom-right | Pending | |
| Portrait/landscape endpoint geometry remains square and aspect-correct | Pending | |
| Directional/directionless masks and outlines remain crisp | Pending | |
| Early/active/late 3D timing-floor zones are readable | Pending | |
| Timing-floor upcoming/active/spent state follows song time | Pending | |
| No legacy timing circles or destination rings appear | Pending | |
| Duration obstacles occupy exact cells and authored depth intervals | Pending | |
| Obstacles remain visible through exact end and then disappear | Pending | |
| Obstacles have no GREAT/miss/pulse/timing-floor feedback | Pending | |
| Bomb/arc/burst events are not misprojected as Boxing punches | Pending | |
| Test transport is safe-area-aware with Play/Pause, range, and `mm:ss` | Pending | |
| Pause freezes audio and every PlayCanvas timeline surface together | Pending | |
| Forward/backward scrubbing live-renders authoritative state | Pending | |
| Scrub release remains paused until explicit Play | Pending | |
| Replacement session cannot revive stale Test audio/state | Pending | |
| Phone stays on fixed camera with no free-fly controls | Pending | |
| Boxing Lanes variants/conversions remain unchanged | Pending | |
| Boxing Grid retains all twelve row-distinct cells | Pending | |
| Optional Start camera/calibration/countdown/cursors/scoring works | Pending | |
| Scored Start hides scrubber and disables debug camera | Pending | |
| Comfort/readability notes recorded without selecting a winner | Pending | |

## Automated Evidence Boundary

Owner release gates cover unit and browser suites, exact live Flow obstacle projection, production build, deterministic raw release construction, deterministic final committed-payload dry packing, and diff hygiene. Repeated artifacts must compare byte-for-byte. Exact final npm-pack metadata belongs only in the external release Bead because this document is included in the npm payload. Raw release evidence may be recorded externally; the raw browser artifact contains no `.plans/` or `docs/` files and therefore cannot self-reference this checklist.

## Completion Boundary

Keep every physical-phone row **Pending** until Derrick performs the observation. Independent release QA and the final auditor own release acceptance and Bead closure; the release coder must not close `aerobeat-web-assembly-6nt.3` or infer a phone pass from automation.
