# Magnetic rotation must be collision-authoritative (0.0.85, not shipped)

## What Derrick asked
The Flow saber magnetic rotation shipped in 0.0.84 as visual-only. Derrick's point:
collision is decided by the saber's equipment collider touching the beat, so there is
no reason for a separate camera-driven system. The assist must move the collider that
decides hits, not just the mesh.

## Verified architecture (re-derived on 2026-09-30, do not re-investigate)
- Flow hit test: `aerobeat-web-gameplay/src/session-coordinator.js` ~line 1287 calls
  `resolvedSaberCapsuleContactsFlowTarget(event, equipmentPoseForRole(...), songTimeMs, timingWindowMs, colliderVolumeSettings(...))`.
- `equipmentPoseForRole` reads the tracked `equipmentPoses` frame validated in
  `advanceFrame` (~line 356-371) via `validateEquipmentPoseFrame`.
- `resolvedSaberCapsuleContactsFlowTarget` lives in
  `aerobeat-web-gameplay/src/equipment-pose-collision.js`.
- Anchor invariant: the pose anchor must still equal the measured wrist within
  `equipmentPoseAnchorEpsilonWu` (checked ~line 769). Rotation only, never translate.
- 0.0.84 bug root cause: assembly passes magnetic settings ONLY in the render frame
  (`src/index.js` ~line 1774). The gameplay `configureContent` configuration
  (~line 1366) carries `obstaclesEnabled` but no magnetic fields, so gameplay never
  sees them. The blend lived in renderer `magneticSaberOrientation`
  (`aerobeat-web-renderer/src/gameplay-scene-model.js`, commit 265ed9b).

## Current state
- Shipped and live: **0.0.84** (magnetic assist is visual-only there).
- Unfinished work preserved on two branches, NOT merged, NOT pinned, NOT released:
  - gameplay `wip/magnetic-collision-authority` (commit c493551)
  - renderer `wip/magnetic-collision-dedup` (commit 7288a30)
- `main` in both repos is clean and matches `origin/main`, so the release pin for
  gameplay (`cbca22e`) and renderer (`265ed9b`) in
  `aerobeat-web-assembly/scripts/release-fingerprint.js` remains valid.

## Why it is not merged
`scripts/validate-magnetic-collision.js` currently FAILS, so the acceptance criterion
(aiding flips an actual collision verdict) is not met. The renderer also still
re-derives its own blend instead of drawing the authoritative gameplay pose.

## Resume point (exact)
1. On gameplay branch `wip/magnetic-collision-authority`, make
   `node scripts/validate-magnetic-collision.js` pass: the same tracked wrist pose must
   MISS without assist and HIT with assist on, and be unchanged when range is 0.
2. Add an anchor-invariant test: rotation only, anchor unchanged within epsilon.
3. Run gameplay `npm test` — must pass.
4. On renderer branch `wip/magnetic-collision-dedup`, consume the authoritative pose and
   delete the duplicate blend math. Run `npm run check:renderer` — must pass.
   (Full renderer `npm test` is blocked by a PRE-EXISTING unrelated contracts
   TypeScript error `TS2345` at `aerobeat-web-contracts/src/equipment-pose-contracts.js:385`.
   Do not attempt to fix contracts.)
5. Thread magnetic settings through the assembly `configureContent` path using the
   `flowColliderSettings` pattern.
6. Run `node scripts/validate-aero-game-assembly.js`, then preflight gates, bump
   0.0.85, provenance oracle, one-shot raw, switch service.

## Behavior that must be preserved
Same-handiness only. Rotational only, no positional teleport. Proximity-weighted
smooth blend (closer = stronger). Back-face weighting. Four `step="any"` floats:
range 0-2 WU, min strength 0-1, max strength 0-1, back-face bias 0-1. Works in Flow
Play and Test. Range 0 must be behaviorally identical to no assist.
