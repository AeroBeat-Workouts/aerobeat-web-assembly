# Task 17 Cursor Restoration and Global Volume Physical Handoff

**Date:** 2026-09-01

**Release:** deterministic `@aerobeat/web-assembly` `0.0.33` local release candidate

**Status:** Every row below is **Physical Pending**. Automated evidence must never convert any row to PASS.

## Boundary

This checklist records operator-owned physical observations only. The release remains local: do not publish npm, create or upload a GitHub Release, create a public repository, or redistribute third-party bytes. This gate does not select a gameplay, conversion, Blocks Theme, or Arena Theme winner, and no Theme runtime or asset proof is part of `0.0.33`. The candidate adds only audited post-session menu stability, conventional world handedness, and deterministic private camera-pose export over the retained `0.0.32` behavior.

## Physical Pending Record

| Physical check | Result | Derrick observation |
|---|---|---|
| Hardware cursor visibly restores after the second desktop right-click exits pointer lock in Flow, Boxing Lanes, and Boxing Grid | Physical Pending | |
| Hardware cursor visibly restores after Escape exits pointer lock in Flow, Boxing Lanes, and Boxing Grid | Physical Pending | |
| Hardware cursor visibly restores after menu-open, pause, hidden, blur, detach, and destroy cleanup | Physical Pending | |
| A later right-click visibly re-enters capture after each confirmed release path | Physical Pending | |
| After completed Test and completed Play, held Song/Difficulty/Gameplay/Conversion selection reaches the same native control and desktop drawer scroll does not snap | Physical Pending | |
| Webcam nose motion follows expected horizontal movement; anatomical left/blue and right/green wrists appear on matching visual sides in Flow, Boxing Lanes, and Boxing Grid | Physical Pending | |
| Visual Test exports `aerobeat-gameplay-camera-pose.v1.json` as the expected 488-byte deterministic artifact and the retained default camera is reviewable in all three modes | Physical Pending | Do not treat export as approval to apply an authored replacement pose. |
| Direct desktop portrait/landscape DPR1/3 volume button and popover are visually correct, physically absent by default/after every closure path, and visible only while open | Physical Pending | `0.0.31` failed because the logically hidden popover remained painted; only this failed row is reset for corrected `0.0.32` retest. |
| Same-origin iframe desktop portrait/landscape DPR1/3 volume button and popover are visually correct | Physical Pending | |
| Direct mobile portrait/landscape DPR1/3 volume button, vertical sliders, values, and 44px targets are visually correct | Physical Pending | |
| Same-origin iframe mobile portrait/landscape DPR1/3 volume button, vertical sliders, values, and 44px targets are visually correct | Physical Pending | |
| Touch, keyboard, focus retention, outside-click, Escape, and button-toggle closure behave physically as specified | Physical Pending | |
| Music volume is audibly applied immediately in Visual Test | Physical Pending | |
| Music volume is audibly retained through Play/Pause, forward/backward seek, and Test menu pause/resume | Physical Pending | |
| Music volume is audibly applied in scored Play without accepting Test rewind intents | Physical Pending | |
| Music volume is audibly retained through Test-to-Play replacement, hidden/visible recovery, lease transfer, reconnect, and two connected instances | Physical Pending | |
| Sound slider physically retains and synchronizes its value while producing no sound because no SFX source exists yet | Physical Pending | |
| Future SFX bus mapping remains reserved; no automated or physical PASS is claimed for audible SFX before an SFX source exists | Physical Pending | |

## Automated Evidence Boundary

Automation may prove pointer-lock event ordering, logical capture state, computed cursor style, stopped look deltas, re-entry, storage/fanout behavior, exact Music/Sound scalar normalization, GainNode topology, direct/iframe layout, privacy, lifecycle, and deterministic artifacts. It cannot observe the hardware cursor, judge physical visual quality, or hear Music/SFX output. Those rows remain **Physical Pending** until Derrick records the observation against this exact candidate.
