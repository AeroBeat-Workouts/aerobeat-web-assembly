# Flow saber magnetic rotation

Status: in progress (approved implementation request)
Bead: aerobeat-web-assembly-2mx2

## Goal
Add same-hand, proximity-weighted visual rotation for Flow sabers in Play and Test. Keep original resolved poses untouched for gameplay collision. Expose four persisted continuous Game Setup controls (range, min/max strength, back-face bias).

## Boundaries
Only assembly and renderer need code changes; existing gameplay/contracts resolved-pose contract stays authoritative for collision. No package versions, pushes, or changes to unrelated dirty files. The render root receives a separately computed display quaternion while preserving the wrist anchor.

## Tasks
1. Inspect current setup storage compatibility, target projection and resolved-equipment render staging. [complete]
2. Add four setup fields and controls; pass per-frame visual configuration. Add renderer-owned quaternion attraction and deterministic focused tests. [complete]
3. Run node checks, renderer and gameplay suites, assembly focused tests; inspect diff for scoring isolation. [complete]
4. Commit each touched repo (no push), close Bead and report files, test results, risks. [in progress]

## Results
Renderer attraction is computed only while staging Flow equipment and applied only to its visible pose root. The original resolved equipment record remains untouched and gameplay collision logic is unchanged. A closest/highest weighted same-hand directional target supplies a shortest-path quaternion blend, using X/Y/Z world distance and a negative-blade-axis back-face weight. Flow Play and Visual Test share the same frame seam. Four independent continuous setup controls are exposed and older stored v3 snapshots gain defaults.

Validation: all changed JS passes `node --check`; renderer `npm run check:renderer` including new focused unit proof passes; gameplay `npm test` passes; assembly `node scripts/validate-aero-game-assembly.js`, `node scripts/validate-game-setup-coordinator.js`, and `node scripts/validate-session-render-projection.js` pass; both touched repos pass `git diff --check`. Renderer `npm test` stops on pre-existing external contracts TypeScript error TS2345 at equipment-pose-contracts.js:385 (unknown argument to number), before check:renderer; no change to contracts was necessary. No browser physical playtest performed. Repo versions unchanged; no push per Derrick.
