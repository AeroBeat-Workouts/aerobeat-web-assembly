# Renderer README stale-default diagnostic — 2026-09-02

## Exact Observed Failure
Independent QA reported that renderer README line 31 still states default position `(0,3.15,7.8)` and Euler `(-7.448451,0,0)`, while the committed implementation and README line 18 use the reviewed replacement.

## Expected Behavior
Documentation must identify the authorized canonical default `{x:0.05,y:1,z:5}`, zero Euler, and projection `{48,0.1,80}`.

## Execution Path
A reader follows the README's world/camera contract to line 31 and receives stale values that contradict `src/gameplay-camera-pose.js` and the newly documented authoring API.

## Most Likely Root Cause
The implementation update added the new API/default summary at line 18 but missed the older detailed default sentence in the world-contract section.

## Alternative Hypotheses
None supported: the reviewed artifact, source constant, serializer hash, and tests all agree on the new values.

## Why Previous Fixes Failed
The first documentation edit targeted only the authoring-seam paragraph and did not search every occurrence of the old numeric default.

## Unknowns
None material; a repository search after correction will confirm no stale renderer value remains.

## Minimal Reproduction
Read renderer README line 31 and compare it with `defaultGameplayCameraPose`.

## Proposed Verification
Replace only the stale sentence, search for the old values, rerun renderer camera checks, and require clean diff validation.

## Recommended Fix
State that Derrick's reviewed artifact replaced the old default and list the exact new position, Euler, and projection.

## Debugging Record

```text
Problem: Renderer README contradicts the committed camera default.
Observed symptom: Line 31 names old position and pitch.
Root cause: Earlier doc edit missed a second default-value occurrence.
Evidence: Source, reviewed artifact, line 18, and serializer hash all agree.
Failed approaches: Updating only the authoring API paragraph.
Corrective action: Replace the stale world-contract sentence.
Verification test: Search old values; run check:renderer and diff-check.
Related files/components: renderer README.md; gameplay-camera-pose.js.
Remaining uncertainty: none.
```
