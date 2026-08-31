# Task 16 Flow Perspective, Obstacles, and Visual Test Transport Physical Handoff

**Date:** 2026-08-31

**Release:** `@aerobeat/web-assembly` `0.0.27`

**Status:** Automated owner release evidence complete; independent QA, final audit, and every physical-phone observation below are Pending.

**Secure route:** `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/`

## Boundary

This checklist is the operator-owned physical validation for Flow obstacle visibility, the experimental 2.5D Flow approach, crisp canonical icons, and Visual Test Play/Pause/live scrubbing. Automated gates do **not** claim a physical-phone pass. Leave every observation explicitly **Pending** until Derrick records the result from a physical phone.

The release preserves all existing choices: **Flow**, **Boxing Lanes**, and **Boxing Grid**, plus Boxing-only **Balanced Height** and **Source Height** conversion controls. Every gameplay mode and conversion remains experimental. This handoff does not recommend, select, or promote a production winner.

## Prepare

1. Open the secure route on the physical phone and confirm the page loads in a secure context.
2. In **Music**, choose a downloaded song and exact Difficulty. Use **Preview** and **Stop** to confirm the exact selection.
3. If available, use BeatSaver `3C9D`, Standard Easy, for the same Flow reference used by automated evidence.
4. In **Gameplay**, confirm exactly **Flow**, **Boxing Lanes**, and **Boxing Grid** remain available.
5. Select a Boxing mode and confirm exactly **Balanced Height** and **Source Height** appear under the separate Conversion control; return to Flow and confirm Conversion is hidden.
6. Begin with **Test**. It must remain audio-only and must not request camera, CV, calibration, countdown, cursors, score, ranking, persistence, or history.

## Flow Obstacles

1. Select **Flow** and start **Test** on `3C9D` Standard Easy if available.
2. Confirm translucent obstacle planes are visible rather than disappearing or appearing as Boxing punches.
3. Confirm each obstacle occupies the expected 4×3 cell region and remains visible through its short authored interval.
4. Confirm obstacle planes approach the endpoint with the same depth model as Flow cues.
5. Confirm obstacles never show synthetic `GREAT`, miss, pulse, or approach-ring feedback.
6. Confirm Flow bombs, arcs, and bursts are not misprojected as Boxing punches.

## 2.5D Flow Perspective

1. Watch a sequence containing repeated or nearby same-cell cues.
2. Confirm future cues begin smaller near the bounded vanishing point and move/scale toward their exact 4×3 endpoints.
3. Confirm far cues draw behind near cues and remain separately readable instead of stacking at one stationary rectangle.
4. Confirm every cue lands on the same corrected top-left 4×3 endpoint used by the prior release; around beat `21` in `3C9D`, source `(x=3,y=0)` must still land bottom-right.
5. Confirm the procedural timing ring remains fixed on the final endpoint while the icon approaches it.
6. Rotate between portrait and landscape and confirm the 4×3 endpoint geometry remains square and aspect-correct.

## Crisp Flow Icons and Rings

1. Inspect directional and directionless Flow icons near the hit point in portrait and landscape.
2. Confirm arrow edges and the white same-mask outline are crisp at the phone's device pixel ratio without jagged low-resolution enlargement.
3. Confirm role colors remain correct and the white outline does not obscure the mask.
4. Confirm the procedural approach ring remains crisp, centered, and visually distinct from the icon outline.
5. Confirm synthetic Test feedback still alternates beginning with `GREAT`; `GREAT` has the brief white pulse while miss does not, and both fade on the same short lifetime.

## Visual Test Play/Pause and Live Scrubbing

1. While Test is active, confirm the bottom safe-area-aware transport is visible with Play/Pause, seek range, and right-side `mm:ss` current time.
2. Tap **Pause** and confirm audio and the visual timeline freeze together.
3. Drag the seek control forward while paused. Confirm cues and synthetic feedback update live during the drag, not only after release.
4. Drag backward across previously displayed cues/outcomes. Confirm future cues and synthetic feedback disappear and the selected earlier frame is reconstructed.
5. Scrub through beginning, middle, and end; confirm the thumb and timecode remain clamped to the authoritative duration.
6. Release after scrubbing and confirm Test remains paused until **Play** is explicitly pressed.
7. Press **Play** and confirm audio and visuals continue from the selected time.
8. Open and close the menu during Test and confirm direct Test resume behavior remains intact.
9. Start a different song/difficulty/mode and confirm the previous Test transport cannot restart stale audio or clear the new session's synchronization.
10. Enter scored **Start** and confirm the Test scrubber is hidden and arbitrary rewind is unavailable.

## Preserved Variants and Conversions

1. Run a short Test in **Boxing Lanes + Balanced Height** and **Boxing Lanes + Source Height**; confirm two scrolling lanes, the shared timing band, and no Flow perspective/rings.
2. Run a short Test in **Boxing Grid + Balanced Height** and **Boxing Grid + Source Height**; confirm the 4×3 spatial grid and no lane backgrounds/band.
3. Confirm switching Flow never changes the retained Boxing conversion selection.
4. Record comfort/readability differences only as observations; do not name a production winner.

## Optional Scored Start

After visual inspection, use **Start** in any mode. Confirm camera acquisition, T-pose/release, ordered `3`, `2`, `1`, nose/left-wrist/right-wrist cursors, pause/recovery, and scoring remain available. Synthetic Test feedback is not scoring evidence.

## Derrick Physical-Phone Observation Record

| Physical-phone check | Result | Derrick observation |
|---|---|---|
| Secure route loads and exact Preview/Stop selection works | Pending | |
| Flow / Boxing Lanes / Boxing Grid choices are preserved | Pending | |
| Boxing-only Balanced Height / Source Height conversions are preserved | Pending | |
| Flow obstacles are visible in their exact occupied cells/intervals | Pending | |
| Flow obstacles have no ring/GREAT/miss feedback | Pending | |
| Bomb/arc/burst events are not misprojected as Boxing punches | Pending | |
| Same-cell Flow cues remain separated far-to-near in 2.5D | Pending | |
| Corrected 4×3 endpoints remain exact, including `3C9D` beat `21` bottom-right | Pending | |
| Portrait/landscape endpoint geometry remains square and aspect-correct | Pending | |
| Directional/directionless icons and white outlines are crisp | Pending | |
| Procedural approach rings remain crisp and destination-centered | Pending | |
| Test transport is safe-area-aware with Play/Pause, range, and `mm:ss` | Pending | |
| Pause freezes audio and visuals together | Pending | |
| Forward scrubbing live-renders selected timeline state | Pending | |
| Backward scrubbing removes future cues/feedback | Pending | |
| Scrub release remains paused until explicit Play | Pending | |
| Replacement session cannot revive stale Test audio | Pending | |
| Scored Start hides/disables arbitrary scrubbing | Pending | |
| Boxing Lanes variants remain unchanged | Pending | |
| Boxing Grid variants remain unchanged | Pending | |
| Optional Start camera/calibration/countdown/cursors/scoring | Pending | |
| Comfort/readability notes without selecting a winner | Pending | |

## Automated Evidence Boundary

Owner release gates cover the full unit and browser suites, exact live Flow obstacle projection, production build, deterministic raw release construction, deterministic final committed-payload dry packing, and diff hygiene. Repeated artifacts must compare byte-for-byte. Exact final npm-pack metadata belongs only in the external release Bead because this document is included in the npm payload. Raw release evidence may be recorded externally; the raw browser artifact contains no `.plans/` or `docs/` files and therefore cannot contain or self-reference this checklist.

## Completion Boundary

Keep every physical-phone row **Pending** until Derrick performs the observation. Independent QA and the final auditor own release acceptance and Bead closure; the release coder must not close their Beads or infer a phone pass from automation.
