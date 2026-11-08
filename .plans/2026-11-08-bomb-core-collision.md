# Bomb collision matches the circular core

Status: IMPLEMENTED; signed bomb-core check PASS. Umbrella23yk; native regressionbyfu; gameplay owner689 closed. Public remains157 until final checks and publication.

Current checkpoint: gameplay8f2f926 is pushed; assembly product4ac9ba3 has signed158 artifact in dist-friend-game, stamp FRIEND-GAME-CPU-0.0.158-11cd43dc63635640d7453ea4. Parent source check3 and41focusedtests4 PASS. Actual signed browser8 PASS on four Flow runs: original empty-cell corners and spike-only overlaps avoided, inside core contacts, outside does not, wristscale0 disables contact, actual rendered canonical asset scales match .1/1/2, ordinary notes still hit. Paused hidden preference change does not move current physical/visible core. Source owner normal/browser suites PASS. This is measured browser-fixture evidence, not a new physical playtest.

Next: normal npmtest and existing signed movement-replay pipeline. Then freeze the verified artifact, update existing4216service to158, verify real mainHTTPS and149unchanged, close Beads, push docs/source and archive plan. No further bomb matrices or audits needed.

## Decision and next passing check

A bomb may be hit only by the existing measured wrist bomb sphere against its circular central body, never spikes or grid-cell corners and never note equipment. Read current authoring source: asset-gameplay/tools/generate.py395-403 builds black UV sphere radius0.22WU, spikes outto0.39WU, decorative ring0.225+0.012. Renderer gameplay-scene-model.js392 scales bomb mesh uniformly by bombScalePercent/100. Therefore use0.22WU circular core times that actual bomb size, and add independent wrist radius0.12WU*wristBombColliderScale. Keep existing timing/freshness/coverage/frozen/lease gates and note scoring unchanged. No asset/model regeneration or new UI.

Next check: deterministic real coordinator yields no contact at old cell corner or spike-only overlap, exact core tangency contacts, core intersection contacts; changing saber/glove size cannot change a bomb outcome. Test Flow and Boxing plus wrist scale0/1/2 and bomb visual size10/100/200. Matching current visual bomb size changes this bomb target only; note/wall visual-scale semantics stay untouched. This is directly within Derrick's request to match the visible core, not a general visual-settings redesign.

## Diagnosis

Observed live-source function wristBombSphereContactsFlowTarget clamps wrist distance against a1x1box, then adds wrist sphere radius. Thus points in empty square corners or spikes' reach count as contact although core is onlyradius0.22. Existing saber-independence regressions pass but test only the box, not target silhouette. Actual source paths/owner currentcb028 and renderer pinnedcanonicalbombhash63d61fe... are known. No physical contact from Derrick's latest recording has been inspected; the geometry defect is independently clear and explicitly approved for correction.

## Execution

1. Gameplay scoped coder replaces box target with circularcore, adds smallest optional settings field to carry actual bomb scale if needed (default1; bounded menu10..200percent). Preserve legacy settings admission and identities for default values as current conventions require; don'tadd a new provenance layer. Trace both modes' bomb dispatch. Update focused tests and gameplayREADME, commit/push owning source. No other CV/physics changes.
2. Parent assembly passes the existing Bomb Scale into collision configuration, repins exact gameplaycommit/tree, versions158, and adds an actual signed browser test: configure real bomb content/real input/actual coordinator via existing measured fixture in Flow and Boxing, inspect rendered core scaling, prove spike-only/corner negatives and core contact plus wrist-menu scale. Keep native recorded Test authority and accepted collision regressions. One focused review only if a demonstrated integration issue warrants it.
3. Run relevant owner checks and assembly normal/signed regressions. Update affected docs. Freeze verified158, commit/push, publish through existing main4216service only, verify actualHTTPSbytes/version and149unchanged. Stop after checks pass; no broad new audit or test matrix.

## Gates / non-goals

Retain all current safety and source/provenance gates. Change only the explicitly incorrect bomb target shape/size contract. Do not change wrist radius default/menu, equipment geometry, authored direction/timing, score penalties, calibration or recording format. Legacy recordings that include old erroneous bomb contacts may legitimately replay different hazards after this correction; never rewrite their original data. Keep human trajectories local/uncommitted.

## Integration decisions from actual source

Boxing currently rejects bomb events (`event_type_invalid`) and has no bomb hazard dispatch; assembly uses one coordinator, not a hidden Flow hazard scorer. Preserve that admission and penalty contract. Verify existing Boxing notes/settings compatibility, but do not claim positive Boxing bomb contacts or add a new hazard feature as part of this Flow defect. Gameplay owner689 tracks implementation underassembly23yk.

Bomb Scale was cosmetic/live, while gameplay collision settings are run-locked. Now that it defines the physical bomb core, bind its visual size and hit size together for each run, like the existing wrist bomb scale. Leave note/wall/marker live scaling alone. Bomb Scale itself is an existing hidden stored/API preference, not a visible menu control; keep it hidden and document next-Play/Restart application. The independent wrist scale remains the existing menu control; no new UI. Native check will change next-run Bomb Scale while paused and prove current geometry/recording stays matched. Recorded Test must use active bomb size, not a next-run presentation edit. This avoids mutable scoring identities or a new runtime tuning API for one hazard.

## First signed-run diagnosis

Signed158 build4ac9ba3 succeeds. Native test5 reaches its optional paused-size-edit section, then fails `release/countdown did not enter scored Play`, with sessionpaused_manual, camera running, audio paused, menu closed and no producterror. Runner assumed Escape both closes menu and resumes the manually paused run. Actual assembly public resume() separately reacquires lease/media and invokes guarded gameplay.resume; closing menu only recovers camera. Correct test to invoke the documented component resume API after Escape, not call gameplay directly or change production lifecycle. Same actual geometry assertions remain. This is the next minimal signed check; no product collision change is justified by this runner-state failure.

Next native diagnostic6/7: component resume resolves the paused state. New failure is `Real staged canonical bomb ... undefined`; actual objects=[]/targets=[] at4800ms, hazards=[] before the window. Source gameplay-visual-runtime.js27-39 requires private generation-bound spawn timing unless the existing UI override is enabled. Fixture content deliberately has no such reader; createSessionTargetIndex then has null normalSpawnMs and does not render targets. Use the existing native Spawn Distance Override20WU via harness controls; do not fabricate timing authority, weaken renderer gating, or alter production. This is a fixture completeness correction. Same core collision/scale assertions remain strict.

## Validation record

Pending owner/new-core regression, signed affected-boundary check, normal regressions and publication. Completed plan will archive here. Primary output modules and exact build stamp will be recorded on completion.
