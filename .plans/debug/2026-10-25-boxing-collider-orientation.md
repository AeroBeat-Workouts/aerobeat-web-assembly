# Boxing glove/knee collider orientation diagnosis — 2026-10-25

## Exact observed failure
Derrick reports that the scoring cylinders rotate with gloves and knee pads. Current source confirms that the glove cylinder rotates with the equipment pose; it does **not** confirm a rotating knee cylinder. The existing contracts oracle explicitly asserts that a rotated glove pose rotates the cylinder axis, and passes (`node scripts/validate-equipment-contracts.js`, 2026-10-25).

## Expected behavior
Glove and knee-pad art may follow wrist/leg rotation. Scoring cylinders remain aligned to the track axis: the back faces the athlete and the front faces incoming beats. Their centers continue to track measured wrists/knees. The Show volumes and actual hit tests must agree.

## Execution path
Assembly creates measured equipment poses. `@aerobeat/web-contracts` `resolveGloveCylinder` computes scored glove endpoints and axis from `rotateVector(pose.orientation, local +Z)`. Gameplay's `boxingContactAtEligibleTime` resolves that cylinder and intersects its solid with a moving beat. Renderer `gameplay-scene-model` also resolves it for Show, but copies the rotating pose quaternion into the cylinder mesh. Knee gameplay `kneePadContactsBoxingTarget` compares measured knee XY and song-time reach without knee-pad quaternion. Renderer `kneeVisualObjects` rotates the knee-pad asset from leg bends but constructs the Show knee cylinder along world Z with identity quaternion.

## Most likely root cause
The glove cylinder geometry conflates equipment orientation with scoring orientation; renderer repeats that choice. Knee scoring and Show geometry already use a fixed axis; visual rotation belongs only to the knee-pad art.

## Alternative hypotheses
- A camera/world transform may make an axis-aligned Show volume look rotated: less likely because the contract test confirms rotation is encoded in the glove axis before projection. Check a native frame after correction.
- The knee collider may rotate in an uninspected adapter: less likely because both the renderer Show model and gameplay knee collision are orientation independent. Check native rendered scene for both knee poses.

## Why previous fixes failed
The earlier knee alignment release corrected a horizontal coordinate shift only; it did not change cylinder orientation. No orientation fix has been attempted in this task.

## Unknowns
Whether a physical Glitch camera session shows any additional transform problem remains unknown; test on genuine nonpersonal assembled Play, then request user feedback only if necessary. Renderer `renderer-facade` native volume orientation will be checked as part of implementation.

## Minimal reproduction and proposed verification
Existing contracts oracle (`validate-equipment-contracts.js`, lines 284–288) creates a rotated glove pose and currently expects the cylinder axis/start/end to follow local +Z. Replace this expectation with fixed world-Z endpoints and check identical collider contact for multiple pose quaternions at the same wrist anchor. In renderer regression, assert the Show cylinder quaternion is identity for rotated art and verify knee cylinders stay fixed while knee-pad meshes rotate. Run contracts, gameplay, renderer tests and a genuine assembled Play showing aligned Show volumes.

## Recommended fix
Make shared `resolveGloveCylinder` use world-Z axis, preserving configured radius/depth/pose scale and wrist anchor; renderer Show reads the same fixed geometry and uses identity orientation. Leave glove/knee art rotations untouched. Preserve knee gameplay/scoring geometry and add a regression that keeps it fixed.

## Debugging record
Problem: Scoring cylinders follow equipment orientation.
Observed symptom: Glove rotates by current contract; knee symptom user-reported but not confirmed in scoring source.
Root cause: Glove `resolveGloveCylinder` rotates its axis from pose quaternion; renderer copies quaternion to Show mesh.
Evidence: Contracts lines 392–411, renderer scene lines 221–231, gameplay collision lines 123–130, passing contract test lines 284–288; knee renderer lines 601–613 and gameplay knee collision lines 34–47.
Failed approaches: Earlier knee X-alignment fix did not touch rotation.
Corrective action: World-Z glove cylinder for scoring and Show; preserve knee's existing fixed scoring/Show and separate art rotation.
Verification test: Rotated and unrotated equipment produce the same collider geometry at fixed anchor; visible Show cylinder remains track-aligned; knee test asserts unchanged behavior.
Related files/components: `aerobeat-web-contracts/src/equipment-pose-contracts.js`, `aerobeat-web-gameplay/src/equipment-pose-collision.js`, `aerobeat-web-renderer/src/gameplay-scene-model.js`, `aerobeat-web-renderer/src/renderer-facade.js`.
Remaining uncertainty: Exact physical Glitch view unavailable.
