# Boxing "full-screen" obstacles — ROOT CAUSE (measured on the real map)

Derrick: 'Larger than Life' Backstreet Boys, ExpertPlus, boxing — "three instances
of the entire row and columns being taken up by colliders (unavoidable). My
assumption is that this is supposed to be a top row only obstacle (squat) that is
rendering at every row and column instead of just the first row every column."

## The real map (fetched via the BeatSaver search API downloadURL)

Map `952e`, `_version: 2.0.0` — **a v2 map**, 837 notes, 26 obstacle entries.

    _type distribution:      {"0": 12,  "1": 14}
    _width distribution:     {"1": 21, "2": 1, "4": 4}
    _lineIndex distribution: {"0": 15, "3": 11}

The 14 `_type:1` entries are END markers and are correctly skipped
(`beatmap.js` ~58). The 12 `_type:0` entries are the real obstacles.

## What the converter authors for those 12

Mirroring the v2 remap (`_width` 2->1, 4->2; `x = _lineIndex`; height forced to 3)
and `obstacleType()`'s column balance:

    authored obstacle kinds: {"weave_left": 6, "weave_right": 6}

**Zero squats.** Every one of them is a full-height lean (weave), six left and six
right. Derrick's "should be a top row only squat" is not what this map contains.

## Why it looks unavoidable

Rendering is CORRECT per the current design:
`gameplay-scene-model.js` ~300 gives a squat TWO lanes (`boxingLanes`) and a weave
ONE lane at `x = geometry.x + (geometry.width-1)/2 - 1.5`, with vertical extent
`BOXING_LANE_HEIGHT`. A lean is therefore a full-lane-height wall at one authored
column — correct for a v2 wall, which genuinely spans all rows.

The problem is density, not the mapping: several of these full-height 1-2 cell
walls spawn close together, and two or three overlapping lean walls cover most of
the grid with no safe lane. That matches the screenshot.

## Conclusion

This is a MAPPING/DENSITY design question, not a rendering bug. The earlier v2
hypothesis (that `gameplayHeight = 3` is a bug) is REFUTED: in the v2 format a
`_type:0` obstacle really is a full-height wall, and `beatmap.js:220` is correct.

Options for Derrick — do NOT change unilaterally, it affects every v2 map:
1. Accept it: v2 walls are leans, and clustered leans are dense. Tune collision so
   overlapping leans still leave a reachable safe lane.
2. Remap full-height, single-cell v2 walls to `squat` so you duck under them
   instead, matching Derrick's original expectation.
3. Merge simultaneous same-column walls into one obstacle.

Option 1 is the smallest change and preserves Beat Saber semantics. Option 2 is what
Derrick expected visually, at the cost of changing what a v2 wall means.