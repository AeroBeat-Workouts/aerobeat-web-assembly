# Task 17 Cursor Restoration and Global Volume Physical Handoff

**Date:** 2026-09-01

**Release:** deterministic `@aerobeat/web-assembly` `0.0.31` local release candidate

**Status:** Every row below is **Physical Pending**. Automated evidence must never convert any row to PASS.

## Boundary

This checklist records operator-owned physical observations only. The release remains local: do not publish npm, create or upload a GitHub Release, create a public repository, or redistribute third-party bytes. This gate does not select a gameplay, conversion, Blocks Theme, or Arena Theme winner, and no Theme runtime or asset proof is part of `0.0.31`.

## Physical Pending Record

| Physical check | Result | Derrick observation |
|---|---|---|
| Hardware cursor visibly restores after the second desktop right-click exits pointer lock in Flow, Boxing Lanes, and Boxing Grid | Physical Pending | |
| Hardware cursor visibly restores after Escape exits pointer lock in Flow, Boxing Lanes, and Boxing Grid | Physical Pending | |
| Hardware cursor visibly restores after menu-open, pause, hidden, blur, detach, and destroy cleanup | Physical Pending | |
| A later right-click visibly re-enters capture after each confirmed release path | Physical Pending | |
| Direct desktop portrait/landscape DPR1/3 volume button and popover are visually correct | Physical Pending | |
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
