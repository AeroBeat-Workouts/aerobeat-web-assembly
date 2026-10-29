# 0.0.150 integration: continuous equipment reprojection and Test webcam FPS

Status: implementation and connected low-FPS browser checks pass; signed build and public release verification in progress. Owner: Pico.
Bead: aerobeat-web-assembly-3xji. Gameplay plan: ../aerobeat-web-gameplay/.plans/2026-10-28-continuous-spline-reprojection.md.

## Approved product behavior

Continuously reconstruct between webcam measurements and score projected equipment along that path using the existing timing, grading and already-hit state. Approximation is accepted without new confidence penalties or a movement requirement. Both Flow and Boxing, in Play and Test, use the same pipeline. A visible decorative trail is not required.

## Integration

- Service graph passes a trusted equipment reprojection callback to the production coordinator.
- Flow intermediate anchors use squareRadialSaberTarget with the same configured base rotation and shoulder pivot as ordinary equipment; Test uses screen centre. Boxing's scored cylinder follows the reconstructed wrist anchor and keeps its existing action-driven orientation behavior.
- Test adds Simulated webcam FPS, 0 = native and 1–60 for bounded sampling. The input measurement id/timestamp and preview anchors are held between updates; render and audio clocks continue independently. The value is Test-only and is not persisted as Play settings.
- Spline sampling/evaluation belongs to gameplay, not another assembly scorer.

## Checks and release

1. Implement and test production projection parity and Test sample-and-hold (source helper regression passes).
2. Run connected Test control/Flow/Boxing regression and the existing relevant suites.
3. Commit/push and pin final gameplay source; build signed 0.0.150 from clean candidate source.
4. Run connected sparse-input Flow/Boxing scenarios against that actual signed build; verify public direct and cross-origin iframe serving, then publish with 0.0.149 rollback. Preflight confirms aerobeat-r149 active on 4212, pico public funnel points to 4212, and next release port 4213 is free.
5. Update release README, gameplay documentation and plans, close implemented bead and verify pushed state. Derrick phone Play remains final human usability acceptance, not an automated claim.

## Known integration findings

The equipment panel browser validator was stale relative to current assets (0.0.13 with 11 assets including knees), knee controls and public boolean calibration-checklist joint flags. Updated those exact fixture expectations without permitting private wrist geometry. Its grouped controls, new FPS control, DPR3 touch, real Flow/Boxing judgement and measured Play checks passed; the later camera-input ownership expectation fails independently. Follow-up aerobeat-web-assembly-nnm6 records actual/expected state. Do not claim the full equipment panel script passed.

Slow input handling now preserves the real measurement bracket through stale duplicate and frozen display ticks (gameplay 2237264, both-mode coordinator regressions). Do not substitute measured-only simulation for real frozen Play recovery.

Connected browser results: Flow crosses correctly at 1 and 2 FPS with independently advancing renderer. Boxing hook geometry crossed but produced no hit: default authored-direction enforcement still calls the existing direction predicate on original webcam endpoints, whose >150ms gap fails its continuity check. This is a demonstrated in-scope blocker, not a reason to disable direction enforcement. Resolved in gameplay 4a89afd: the unchanged direction predicate receives private local spline samples clipped to contact ±75ms, with the same maximum gap, tolerances and minimum travel. Reverse-direction coordinator regressions still fail the authored-right event without consuming valid same-frame controls. The connected browser fixture now passes directional Flow and hooks at both 1 and 2 FPS under default enforcement, including >750ms held-input ticks, automatic feedback ON preview sampling without scoring, independent rendering and exactly-once outcomes. The full assembly npm test passed with the prior clean 2237264 pin; the final pin is rerun before publication.

Focused host-only cost sample: 10,000 Flow node reprojections took about 250ms after warmup (~0.025ms/node) in Node on this host. This is not phone performance evidence.

## Delegation

- Beads repair: a3bc8fbf-2917-4c4c-a418-8e653a61bd62 verified and completed; official compatible CLI installed and reads/claim verified without schema override.
- Gameplay coder: eb19a375-fdfe-4fa0-ac31-a09da47fb992 delivered/pushed 4a89afd with full gameplay npm test, browser smoke and focused regressions passing. Parent verified clean upstream state and connected four-case browser matrix. After delivery, parent stopped further queued turns to freeze this tested release pin; no partial changes remained.
- Focused read-only QA: 4d6584c8-120f-463f-9ec1-99b31bae9907 completed. Its default-auto sampling finding was fixed and source-verified, then exercised by the browser matrix. Parent also fixed rejected-value display and fractional FPS step consistency. Parent owns signed browser proof and public cutover.

## Safety and retained state

Keep all existing release/provenance/lifecycle gates. Preserve unrelated modified .beads/interactions.jsonl and calibration screenshot directories. Default Beads was repaired to the already-approved AOM fleet pin 1.3.1 with the documented npm global install command. Normal bd show/list now work against schema 66 without overrides. No fleet policy or database migration was needed. An isolated 1.3.2 binary is retained but is not needed for ordinary commands. Spark-center belongs to Chip and is untouched.
