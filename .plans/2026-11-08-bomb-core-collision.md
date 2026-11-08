# Bomb collision matches the circular core

Status: COMPLETE, VERIFIED AND LIVE as0.0.158. Derrick approved correcting bomb targets to the central circular body, excluding spikes and grid-cell corners. Umbrella23yk; native testbyfu; gameplay owner689. All implementation, integration, regression and publication milestones are complete.

## Delivered behavior

Only the existing measured wrist bomb spheres can trigger bombs. Contact now uses circular core radius0.22 world units (WU), scaled by the actual bomb asset size, plus independent wrist radius0.12WU times Wrist Bomb Collider Scale. Zero wrist scale still disables contact. Saber/glove geometry never extends bomb reach. Timing, freshness, coverage, lease, note direction and penalty rules remain unchanged.

The core comes from canonical authoring source `aerobeat-asset-gameplay/tools/generate.py:395-403`: black sphere radius0.22WU, spikes extending to0.39WU. Renderer uniform bomb scale is Bomb Scale percentage divided by100. No assets or UI controls were added. Bomb Scale is an existing hidden stored/API preference; the visible wrist scale remains the existing menu control. Flow binds physical and visible bomb size for a run, with changes applying on next Play/Restart. Other live visual scales remain unchanged. Recorded Test renders the actual captured physical bomb size, not next-run preference edits.

Actual native Boxing rejects bomb events and has no bomb dispatch. Assembly has one gameplay coordinator, not a separate Flow hazard scorer. This repair preserves that admission and penalty contract. Proposal tw8d tracks the separate decision about adding Boxing bombs; it does not block the Flow correction.

## Source and release

- Gameplay pushed clean at8f2f926670bf52d4a2a76ab2970b32713755c271, tree d1681b22dfb211a2fce2a0ceceb3220ce455f16d. Primary source: src/flow-collider-collision.js and src/boxing-collider-collision.js. Only core geometry and strict optional bombScale settings/identity handling changed; no coordinator physics rewrite.
- Assembly signed product source4ac9ba322a0a6a9291f8a8277ff1805d313beb8a. Primary integration: src/gameplay-visual-runtime.js, src/index.js and src/recorded-test-source.js.
- Frozen artifact .tmp/cpu-r158-verified-4ac9ba3; stamp FRIEND-GAME-CPU-0.0.158-11cd43dc63635640d7453ea4.
- Existing main4216 service now serves that frozen artifact. Actual main HTTPS reports158 and matches its exact HTML/entry-script bytes. Authentic149 and its8449route/4212service remain unchanged and active. Prior157 artifact remains available for rollback.

## Verification actually performed

- Gameplay owner normal suite, browser suite, packaging and exact-field/identity regressions PASS. Circle tangency, core center/outside, old cell corner/spike negatives, independent equipment, bomb scales0.1/1/2 and wrist scales0/1/2 are covered. Boxing bomb rejection remains explicit.
- Parent source check3 and41focused recorder/import/player tests4 PASS, including captured bomb size versus next-run preference edits.
- Parent signed native8 PASS: four calibrated Flow runs through real linked input, calibration, coordinator, renderer and canonical asset. Actual outcomes are avoided/contact as expected, never missing-tracking substitutes. Actual rendered bomb scales0.1/1/2 agree with collision settings. Ordinary notes still hit. Paused hidden-preference changes leave current visible/physical core matched. Run with npm run test:bomb-core.
- Parent10 full npmtest and existing signed movement-replay pipeline PASS. Genuine Download Data -> native Test retains real markers/equipment, judgements, seek/restart/lease scope and all captured ticks/observations. Reversal and late-reversal hit; reverse-only and no-contact miss. New optional settings remain replayable.
- Parent11 actual HTTPS verification PASS: main158 and authentic149 bytes/version/controls, no page errors; both existing services active.

Evidence is deterministic browser-fixture execution, not a new physical-phone/full-song playtest. Historical captures containing erroneous old box contacts may legitimately replay different hazards after correction; their original numbers are never rewritten. No private media or human trajectories were uploaded or committed. No counterfactual revert test or extra audit was needed.

## Diagnostic lessons from the actual first build

The product defect was sphere-versus1x1box contact for a bomb whose visible core radius is only0.22WU. Existing saber-independence tests passed because they protected the wrist authority, not the target silhouette.

The first native runner failures were test setup issues, not reasons to weaken product gates:
1. Bomb Scale has no native menu input. Use its existing preference API via a same-origin companion page so a genuine storage event reaches the signed app's module-local coordinator. Keep wrist changes on native UI.
2. Escape closes the menu and recovers camera; the documented component resume API separately resumes manual pause through real lease/media gates.
3. Fixture content has no private generation-bound spawn timing, so targets correctly remain unstaged. Enable the existing native Spawn Distance Override20WU rather than fabricating timing authority or relaxing renderer gating.
4. The old pure settings expectation omitted the newly intended bombScale field. Keep exact object equality, include bombScale1 and assert exact10/100/200percent projection in both validators.

After these bounded runner corrections, signed core behavior passed without further product changes. Verification stops here; next feedback is Derrick's physical playtest after refreshing AeroBeat to158.
