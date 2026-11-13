# Corner Pause check: replaying real play

Question: if a Pause target sat in a screen corner during play, would normal gameplay movement trigger it by accident?

## Data

One real full-song recording: Derrick playing *Undefeatable (feat. Kellin Quinn)*, Expert, Flow, build 0.0.155, captured 2026-11-04. 2,661 calibrated playing frames over 178 seconds. The other recordings in `~/Downloads` (0.0.149, 0.0.153) contain judgements only, no movement, so they cannot be used.

## Method

`corner-check.mjs` replays each frame's calibrated wrist positions (athlete space, where the calibration box fills the screen) against square corner targets on a 1600×1000 screen, 24 px from the edges. It applies the menu rule: a wrist is on a target when its 56 px disc overlaps it; both wrists on the same target continuously for the hold time is an accidental selection. Only frames in the `playing` state count.

## Result

**Zero accidental selections in every corner, at 120 px and 180 px, with 520 ms and 1,000 ms holds.** Both wrists were never inside a corner target together, not even for one frame.

A single wrist entered a 180 px corner target for 0.6–2.0% of frames, which is harmless: one wrist only hovers.

Headroom, found by growing a corner target until something happened (520 ms hold):

| Corner | Both wrists first overlap together | First accidental selection |
|---|---|---|
| Top-left | 480 px target | 760 px target |
| Top-right | 480 px | 760 px |
| Bottom-left | 400 px | 620 px |
| Bottom-right | 500 px | 760 px |

A planned Pause target of 120–180 px is 2–4× smaller than the smallest size where both wrists ever met in a corner.

## Limits

- One song, one athlete, one difficulty, Flow only. No Boxing recording with movement exists yet.
- Assumes the calibration box maps to the full screen. A different cursor mapping would shift the numbers, though not likely by 2–4×.
- This is evidence, not a playtest. A playtest still makes the final call, as agreed.

## Recommendation

Top-right is safe on this evidence and fits the design language (it is where More sits on menu screens). A normal 520 ms hold is enough; a longer pause-only hold is not needed. Re-run this script on a Boxing recording and on a couple of other songs once they exist:

```
node design/corner-check/corner-check.mjs <recording.json> [more...]
```
