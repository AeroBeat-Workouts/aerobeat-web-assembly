# Wrist bomb render anchors: assembly integration diagnosis

## Exact Observed Failure
User reports renderer frames lack `equipmentColliderAnchors`; assembly `renderGameplay()` creates the frame before resolving equipment and reading input anchors. Source inspection confirms `rendererFrame()` supplies the settings toggle only inside `colliderSettings` and has no anchor property. Renderer scene model requires top-level `frame.visibleWristObstacleRadius` for sphere creation, and renderer facade overwrites frame anchors with anchors projected solely from the equipment argument. No browser reproduction was run.

## Expected Behavior
A valid measured wrist should place the corresponding debug wrist-bomb sphere at its projected world position, even when equipment meshes are hidden. Invalid/missing wrists should never be represented as measured; existing fixed per-hand fallbacks remain the renderer's own behavior.

## Execution Path
Assembly `renderGameplay()` builds `frame=rendererFrame()`, obtains Visual Test or live input, resolves equipment poses, conditionally replaces the equipment argument with `[]` when Test equipment is hidden, and calls `renderGameplayFrameWithCursorsAndEquipment(frame,...,equipment,...)`. Renderer facade `renderGameplayScene()` clones frame with `equipmentColliderAnchors:projectEquipmentColliderAnchors(equipment,frame.presentation)`. The projector only accepts exact resolved equipment records. Scene model reads top-level visibility for creating sphere objects.

## Most Likely Root Cause
The UI flag is in `colliderSettings`, but the scene model's sphere-creation condition checks top-level `frame.visibleWristObstacleRadius`; assembly doesn't set it. Furthermore, renderer facade overwrites any assembly-supplied anchors using visible equipment, so `equipment=[]` discards measured wrist positions and yields fixed fallbacks.

## Alternative Hypotheses
1. Input anchors are malformed: no direct reproduction yet; existing `gameplayEquipmentRecords()` accepts valid anchors and maps x to `4*x-.5` judge WU and y to `2.5-3*y`.
2. Equipment poses lack world coordinates: contradicted by `projectEquipmentColliderAnchors()` projecting exact pose anchors and renderer's own mesh positioning.

## Why Previous Fixes Failed
Earlier assembly change wired `visibleWristObstacleRadius` in `colliderSettings` and passed wrist scale into Flow gameplay; neither added top-level visibility nor positioned the spheres. Both routes treated configuration as sufficient while omitting the render projection.

## Unknowns
Whether renderer-owner intends to preserve explicit frame anchors on nonempty equipment and whether Visual Test hidden-equipment anchors should come from test preview vs production input. Independent renderer integration cannot be changed in the assembly-only scope.

## Minimal Reproduction
With a valid wrist and Test equipment hidden, enable the wrist-radius toggle and render: frame lacks top-level visibility; renderer receives `equipment=[]` and projected anchors are null. Inspect returned scene model for wrist-bomb objects and positions.

## Proposed Verification
Add a focused assembly oracle asserting top-level flag and world-projected anchors independent of equipment-visibility preference; a renderer-level oracle must assert facade preserves explicit frame anchors when equipment is hidden and sphere positions match them.

## Recommended Fix
In assembly set the frame's top-level visibility and add measured wrist anchor projection during `renderGameplay()` after resolving equipment; prefer exact resolved pose anchors and otherwise valid measured input anchors. In the renderer-owning repo, stop overriding explicit valid frame anchors with the projected empty equipment list. Keep settings and frame data private and avoid changing gameplay identity.

## Debugging Record
Problem: visible wrist-bomb collider spheres lack measured render anchors.
Observed symptom: source frames omit anchors/top-level visibility; renderer overwrites supplied anchors.
Root cause: assembly config-only wiring plus renderer coupling to visible equipment argument.
Evidence: index.js renderGameplay/rendererFrame; renderer-facade.js renderGameplayScene; gameplay-scene-model.js lines 143-166.
Failed approaches: prior settings-only wiring.
Corrective action: assembly anchor/visibility projection; renderer-owning anchor precedence fix.
Verification test: assembly focused projection and renderer hidden-equipment scene test.
Related files/components: src/index.js, src/gameplay-equipment-records.js, renderer facade/scene model.
Remaining uncertainty: renderer owner implementation and direct browser proof.
