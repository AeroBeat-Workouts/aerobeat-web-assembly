# Task 14 Flow Feedback and Test Mode Physical Handoff

**Date:** 2026-08-30  
**Release:** `@aerobeat/web-assembly` `0.0.25`  
**Status:** Automated implementation, QA, audit, and deterministic release evidence complete; Derrick phone validation pending.  
**Secure route:** `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/`

## Purpose

This pass is for physical sight-readability and feedback validation. Flow remains the leaderless fallback and all four Boxing options remain experimental. **No production Boxing winner is selected or promoted.**

Automated evidence is not a human phone pass. Record only what Derrick actually sees, hears, and feels in the observation table.

## Before You Start

1. Open the secure route above on the phone.
2. In **Music**, select an already downloaded song and its exact downloaded Difficulty.
3. Tap **Preview**, confirm the selected song/difficulty plays, then tap **Stop**.
4. Keep the same song/difficulty selected for the Test and Start comparisons.

## Test Mode — No Camera

1. Tap **Test**.
2. Confirm audio begins immediately at song time zero.
3. Confirm there is no camera prompt, live preview, T-pose, calibration cue, `3`,`2`,`1`, nose/wrist cursor, or tracking-loss interruption.
4. Confirm directional Flow targets are readable at phone distance and point in clearly distinguishable directions. Confirm directionless targets use the distinct directionless symbol.
5. Watch the first targets: the first synthetic outcome must be a hit showing `GREAT` plus a brief white icon pulse; the second must be a miss with no `GREAT` and no white pulse. Outcomes then alternate hit/miss.
6. Confirm hit and miss targets use the same short fade duration, while only the hit has `GREAT`/white pulse.
7. Open the corner menu during Test. Confirm audio/timeline/animation pause. Close it and confirm Test resumes directly without camera, calibration, or countdown.
8. Tap **Test** again and confirm the exact selected song/difficulty restarts from zero.

## Test to Normal Start

1. While or after Test, tap **Start**.
2. Confirm Test stops and Start requests/uses the camera.
3. Confirm the live mirrored athlete preview appears for T-pose calibration.
4. Hold the T-pose, release, and confirm one ordered visible `3`,`2`,`1` before normal play.
5. Confirm nose/left-wrist/right-wrist cursors and smooth display-cadence targets return during normal play.
6. Make several clear in-window contacts and deliberate misses. Confirm real hits show `GREAT` plus the brief white pulse and real misses show neither; both use the same common fade.
7. Open the menu during Play, then close it. Confirm Play requires fresh calibration/countdown rather than direct Test-style resume.

## Exact Selection and Generation Restart

1. Return to **Music**, choose a different downloaded song or Difficulty, and use Preview/Stop to confirm the new exact selection.
2. Tap **Test** and confirm the newly selected content starts at zero with no stale targets/audio from the old run.
3. Change song or Difficulty again and tap **Start**. Confirm the newly selected content—not the prior run—owns camera calibration, countdown, and play.

## Physical Observation Record

| Check | Pass / Fail | Derrick observation |
|---|---|---|
| Exact downloaded Preview/Stop | Pending | |
| Test starts at zero with immediate audio and no camera/T-pose/countdown | Pending | |
| Directional targets are sight-readable | Pending | |
| Directionless targets are distinct and sight-readable | Pending | |
| First Test outcome is GREAT + brief white pulse | Pending | |
| Second Test outcome is miss with no GREAT/pulse | Pending | |
| Hit and miss share the same fade duration | Pending | |
| Test menu pause and direct resume | Pending | |
| Repeated Test restarts exact selection at zero | Pending | |
| Test → Start restores camera/T-pose/3-2-1/cursors | Pending | |
| Real hits and misses show the intended distinct feedback | Pending | |
| Song/Difficulty changes invalidate the old generation | Pending | |
| Any comfort/readability tuning needed | Pending | |

## Automated Evidence Carried Into the Phone Pass

- Independent owner and assembly test/browser/live suites passed at implementation head `33c90c6` before the release-only version/docs change.
- Real hit/miss projection is pending before exact judgement commit, begins at the committed timeline position, remains through `+350 ms`, and is removed the next millisecond.
- Visual Test outcomes are stable timeline-sorted, begin hit-first, and never enter gameplay judgements, score partitions, persistence, ranking, or history.
- Direct and real cross-origin iframe matrices cover portrait/landscape at requested DPR 1/3, exact four drawer sections, privacy, cadence, cursors, countdown, Preview, menu/restart, lease, and atlas lifecycle.
- The deterministic raw `0.0.25` proof carries source fingerprint `9bcb735cd5d80717c04e4d4dd56efa7668459a405519ac6b817731b58efed736`, proof SHA-256 `fa2bfdb08f901cae162d9768f0b521136ae589a8b26e3e1a1e05d4d3a4383fff`, recursive manifest SHA-256 `ef229b5e26bc9f6e39ee02f113a8f0def504ee75b5fd834aa67e30f51bba286b`, and `3,629,906` artifact bytes before its proof manifest.
- Release assets contain exactly `flow-directional.svg` and `flow-directionless.svg` for Flow and contain no PNG files or PNG references.

## Completion Boundary

Do not mark this physical handoff complete from automated evidence. Derrick's phone observations decide whether the `1.12×` outline, icon scale, `80 ms` approach fade, `100 ms` white pulse, `350 ms` common feedback fade, and `GREAT` scale are physically readable or need a later tuning slice. A tuning decision does not select a production Boxing winner.
