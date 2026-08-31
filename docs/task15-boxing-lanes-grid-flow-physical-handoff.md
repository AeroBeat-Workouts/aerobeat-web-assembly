# Task 15 Boxing Lanes, Boxing Grid, and Corrected Flow Physical Handoff

**Date:** 2026-08-31

**Release:** `@aerobeat/web-assembly` `0.0.26`

**Status:** Automated owner evidence complete; independent QA/audit and Derrick phone validation pending.

**Secure route:** `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/`

## Boundary

This checklist asks Derrick to compare the corrected Flow layout and all four experimental Boxing recipe×gameplay combinations. Automated QA does **not** claim a human physical phone pass. It does **not** recommend, select, or promote a production Boxing gameplay or conversion winner.

Keep one downloaded song and Difficulty selected across comparisons where possible. BeatSaver `3C9D`, Standard Easy, is the external Flow-orientation reference used by automated proof.

## Prepare

1. Open the secure route on the phone and confirm the page loads in a secure context.
2. In **Music**, choose the downloaded song and exact Difficulty. Use **Preview** and **Stop** to confirm the exact selection.
3. Open **Gameplay** and confirm exactly three choices: **Flow**, **Boxing Lanes**, and **Boxing Grid**.
4. Select either Boxing mode and confirm a separate **Conversion** group appears with exactly **Balanced Height** and **Source Height**. Return to Flow and confirm Conversion is hidden.
5. Use **Test** for repeatable audio-only visual comparisons. It must not request camera, calibration, countdown, CV, or cursors.

## Flow — Corrected 4×3 Orientation

1. Select **Flow** and use `3C9D` Standard Easy if available.
2. Confirm notes scroll/render in the 4×3 grid, not lanes.
3. Around beat `21`, confirm the source `(x=3,y=0)` note appears in the bottom-right cell, not the top-right cell.
4. Confirm Flow directional and directionless icons remain distinct and Flow approach rings remain visible.
5. Confirm the first synthetic Test outcome shows `GREAT` plus the brief white pulse, the next is a miss without either, and both use the same short feedback lifetime.

## Boxing Lanes — Balanced Height

1. Select **Boxing Lanes**, then **Balanced Height**, and start Test.
2. Confirm every cue moves continuously bottom-to-top through two lanes.
3. Confirm one semi-transparent timing band spans both lane backgrounds and the gap in the upper quarter.
4. Confirm there are no receptor lines or approach rings.
5. Confirm punch and directional weave cues use the appropriate lane.
6. Confirm guard and squat display one aspect-preserving icon in each lane.
7. Confirm icons remain recognizable and moving hit/miss feedback stays attached to the moving cue for the common `350 ms` lifetime.

## Boxing Lanes — Source Height

1. Keep **Boxing Lanes**, change Conversion to **Source Height**, and restart Test from zero.
2. Repeat the motion, shared-band, no-ring, canonical-icon, duplication, and moving-feedback checks above.
3. Note any comfort, density, or sight-readability difference from Balanced Height without naming a preferred production winner.

## Boxing Grid — Balanced Height

1. Select **Boxing Grid**, then **Balanced Height**, and restart Test.
2. Confirm the layout is the 4×3 spatial athlete grid, not scrolling lanes.
3. Confirm grid targets retain blocked-cell guidance and approach rings where expected.
4. Confirm canonical Boxing icons and the common hit/miss feedback are readable at phone distance.

## Boxing Grid — Source Height

1. Keep **Boxing Grid**, change Conversion to **Source Height**, and restart Test.
2. Confirm it remains 4×3 and does not inherit lane backgrounds or the shared lane timing band.
3. Repeat the grid guidance, ring, icon, and feedback checks.

## Optional Normal Start

For any mode, use **Start** only after the visual Test comparison. Confirm camera/T-pose/release/ordered `3`,`2`,`1`/nose-and-wrist cursors return, while menu pause requires fresh calibration/countdown. Do not infer scoring correctness solely from synthetic Test feedback.

## Derrick Observation Record

| Check | Pass / Fail | Derrick observation |
|---|---|---|
| Secure route and exact Preview/Stop selection | Pending | |
| Exactly Flow / Boxing Lanes / Boxing Grid | Pending | |
| Boxing-only Balanced Height / Source Height Conversion | Pending | |
| `3C9D` beat 21 renders bottom-right in Flow | Pending | |
| Flow remains 4×3 with readable icons/rings | Pending | |
| Boxing Lanes + Balanced Height motion/band/no-rings/icons | Pending | |
| Boxing Lanes + Source Height motion/band/no-rings/icons | Pending | |
| Guard/squat duplicate once per lane without stretching | Pending | |
| Moving GREAT/miss feedback remains attached and readable | Pending | |
| Boxing Grid + Balanced Height remains 4×3 | Pending | |
| Boxing Grid + Source Height remains 4×3 | Pending | |
| Grid blocked-cell guidance and rings remain readable | Pending | |
| Optional Start camera/calibration/countdown/cursors | Pending | |
| Comfort/readability notes for later tuning | Pending | |

## Automated Evidence Bound to `0.0.26`

- The release runtime source is unchanged from the independently QA/audited Task 3 implementation; only canonical version/release metadata and documentation changed before the release build.
- Two independent raw release builds were byte-identical. Source fingerprint: `cacac1e520eb1f619a3c694a01e7d7b6d1a51516bd05c1b1bf0556e387bafbc9`; recursive file-manifest SHA-256: `831f513a19a63b10a4ab2d3194fa06a51895533c9f95ea912636b7c434239647`; proof SHA-256: `69969cd8b0ca8e3a5e99b26c6eeb93643c90fe59af05ea7b62aab8f717f54a85`; artifact bytes before proof: `3,669,249`.
- Two independent pre-ledger owner dry-pack manifests were byte-identical. Manifest SHA-256: `c0e99f62caed6a940cf5bf2edad6f18ac1eea54b67d5a0fb3134cfb68c5d5ae3`; 83 files; 304,171 packed bytes; 1,080,908 unpacked bytes; tar SHA-1 `9da73612f2b972780db53ab5518b841f6f77ce8d`. A final pair is compared after the packed plan/docs/Bead ledger are frozen and reported with the owner handoff.
- Owner `check`, unit, browser, production build, release, stale-data, direct/iframe portrait/landscape DPR1/3, privacy, cadence, countdown, Preview, compositor, and cursor gates passed.
- Exact online Task 3 evidence downloaded/persisted BeatSaver `3C9D` version `5662f64a12c76a3dd11a5f6ee22611608cd06760`, selected Standard Easy Flow, proved beat `21` `(x=3,y=0)` → cell `11` and first twelve placements `[11,8,10,9,11,8,11,8,10,9,11,8]`, then deleted the ephemeral collection. Runtime sources are byte-identical in this release.

## Completion Boundary

Leave every observation Pending until Derrick performs it on a physical phone. A later tuning choice may adjust readability or comfort while keeping both Boxing gameplay modes and both conversion recipes experimental; it must not be recorded as a production winner without a separate explicit product decision.
