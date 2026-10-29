# 0.0.150 integration: continuous equipment reprojection and Test webcam FPS

Status: spline release 0.0.150 and approved cache-only corrective release 0.0.151 shipped publicly; automated acceptance complete. Derrick's physical-phone Play usability check remains human acceptance. Owner: Pico.
Bead: aerobeat-web-assembly-3xji. Gameplay plan: ../aerobeat-web-gameplay/.plans/2026-10-28-continuous-spline-reprojection.md.

## Corrective 0.0.151 execution

Approved by Derrick: ship the cache-only fix; discuss Noodle Extensions/custom-wall support separately in **aerobeat-web-assembly-igiw**. Do not silently drop walls or claim the reported modded map fully imports.

- Source fix complete and pushed: content-authoring **505faf0**, finite cache entry default 2 MiB -> 8 MiB. Exact real file is 3,874,764 bytes. Existing difficulty/audio/selected-source/archive bounds are unchanged.
- Source checks pass: authoring check (including types), unit suite and security suite. Restored a displaced existing SourceBundle type-guard annotation and corrected two existing test typing/factory mistakes to make those gates runnable; no extra production behavior changed.
- Exact GAS GAS GAS now passes cache preparation but conversion rejects independent custom walls: obstacle_type_unsupported, v2 type must be 0 or 1. Metadata requires Noodle Extensions; 13,898 custom obstacles. This limitation is explicitly accepted for the cache-only release.
- Browser acceptance: valid real Numb archive with Expert JSON padded by whitespace to the exact 3,874,764-byte boundary, then actual import and shipped Reimport button. Verify retained bytes, three difficulties, same collection and no file chooser. Exact GAS archive must report the independent custom-wall error with no partial persistence. Fixture archives stay outside Git.
- Complete: built signed 0.0.151 after the source fix, from clean assembly 79b7b8b / authoring 505faf0. Snapshot .tmp/boxing-r151-79b7b8b, stamp FRIEND-GAME-CPU-0.0.151-c421069ba8ab8d7ba5922440, 59 files, assets/index-CkmApnBi.js.
- Passed: full assembly npm test and signed/public browser cache acceptance. The valid 3,874,764-byte difficulty imports/reimports all three packages in the same collection with no file chooser; the exact GAS archive reports only the independent unsupported-wall rejection, with no partial persistence. Public direct and real cross-origin iframe load ready assets/environment/worker and nonzero framebuffers.
- Public service aerobeat-r151 is enabled on 4214 and the pico funnel targets it. Public/local HTML hashes match: e54b376ad8ae9a8d59974c26d1ec53dace01bd032e2263c8631b97b1ca4dd4b9. Rollback targets still-active aerobeat-r150 on 4213.
- Reproduction inputs stay outside Git. Valid browser fixture: start with BeatSaver78e Numb ZIP, append JSON whitespace to Expert.dat until 3,874,764 bytes, and write that entry ZIP_STORED. Deflating pure padding initially hit the existing compression-ratio protection; the fixture compression was corrected and that guard was not relaxed. Run scripts/validate-cache-limit-browser.js with AEROBEAT_CACHE_VALID_ZIP / AEROBEAT_CACHE_GAS_ZIP and either AEROBEAT_CACHE_SIGNED_DIR or AEROBEAT_CACHE_BASE.
- Release README documents the unsupported modded map explicitly. Close cache-only bead; keep custom-wall discussion igiw open. Intentional docs/source are committed/pushed; unrelated ledger/screenshots preserved.
- Execution source plan: ../aerobeat-web-content-authoring/.plans/2026-10-29-gas-gas-gas-cache-limit.md; goal goal-8d6f4121-8b41-47b3-b2b4-14f6be0e557c.

## Required before the next build

- [x] **Fix the cache-entry limit for BeatSaver "[[Wall Show + Chroma]] GAS GAS GAS | Manuel".** Bead: **aerobeat-web-assembly-ruoi** (P1, open). Derrick reported the exact import failure `cache entry exceeds the byte limit` after the 0.0.150 release and explicitly requires this fix before the next build in this plan.
  - Owner: content-authoring for cache limits; assembly for release integration.
  - Inspect the offending archive entry and raise the appropriate finite cache limit enough for this legitimate map, without changing unrelated archive/storage limits.
  - Add a focused size-boundary regression and verify this real song imports through the affected browser flow; check cached-source reimport remains usable.
  - Commit/push and repin changed dependencies before creating the next build. Verify the resulting build before publishing it.
  - Completed as the approved cache-only 0.0.151 release. Exact GAS custom-wall compatibility remains deferred in igiw by Derrick's explicit choice; the original 0.0.150 result below remains historical truth.

## Approved product behavior

Continuously reconstruct between webcam measurements and score projected equipment along that path using the existing timing, grading and already-hit state. Approximation is accepted without new confidence penalties or a movement requirement. Both Flow and Boxing, in Play and Test, use the same pipeline. A visible decorative trail is not required.

## Integration

- Service graph passes a trusted equipment reprojection callback to the production coordinator.
- Flow intermediate anchors use squareRadialSaberTarget with the same configured base rotation and shoulder pivot as ordinary equipment; Test uses screen centre. Boxing's scored cylinder follows the reconstructed wrist anchor and keeps its existing action-driven orientation behavior.
- Test adds Simulated webcam FPS, 0 = native and 1–60 for bounded sampling. The input measurement id/timestamp and preview anchors are held between updates; render and audio clocks continue independently. The value is Test-only and is not persisted as Play settings.
- Spline sampling/evaluation belongs to gameplay, not another assembly scorer.

## Checks and release

1. Complete: production projection parity and Test sample-and-hold regression passes in the normal unit gate.
2. Complete: connected directional Flow/Boxing Test at 1/2 FPS, plus final assembly npm test and gameplay npm test/browser smoke. The unrelated full legacy equipment-panel camera expectation remains tracked separately (see below).
3. Complete: assembly 724ee303ce30da535c54ec0b1b3ea9b341d6cd89 pins gameplay 4a89afd5c7315135d8a9198cc6f293f3ba078fd6. Built from the clean private candidate checkout and froze .tmp/boxing-r150-724ee30.
4. Complete: all four sparse Test cases pass against that actual signed bundle, including >750ms held input and independent render ticks. Existing signed calibrated Boxing knee Play passes direct/cross-origin iframe. Published through aerobeat-r150 (4213); public HTTPS direct and cross-origin iframe report 0.0.150, ready conversion/render assets and environment, cpu-wasm, FPS control present and nonzero framebuffers. Local/public HTML SHA-256 identical: f7088bbb2d770c0e8778ff708fafe2249c98a322c6858fc43067aca192824a75.
5. Complete: gameplay README/source plan and assembly README/release plan document behavior and limits. Close implementation bead with automated evidence; physical phone usability remains Derrick's human check, not claimed by automation. Intentional docs are committed/pushed without staging unrelated ledger/screenshots.

Release stamp: FRIEND-GAME-CPU-0.0.150-c942956c9e3a0505c8e8acbe, 59 signed files, entry assets/index-DfOjj6JW.js. Service is enabled and persistent. The public pico funnel points at 4213. Rollback: repoint it to http://127.0.0.1:4212, then stop aerobeat-r150. aerobeat-r149 remains active.

## Known integration findings

The equipment panel browser validator was stale relative to current assets (0.0.13 with 11 assets including knees), knee controls and public boolean calibration-checklist joint flags. Updated those exact fixture expectations without permitting private wrist geometry. Its grouped controls, new FPS control, DPR3 touch, real Flow/Boxing judgement and measured Play checks passed; the later camera-input ownership expectation fails independently. Follow-up aerobeat-web-assembly-nnm6 records actual/expected state. Do not claim the full equipment panel script passed.

Slow input handling now preserves the real measurement bracket through stale duplicate and frozen display ticks (gameplay 2237264, both-mode coordinator regressions). Do not substitute measured-only simulation for real frozen Play recovery.

Connected browser results: Flow crosses correctly at 1 and 2 FPS with independently advancing renderer. Boxing hook geometry crossed but produced no hit: default authored-direction enforcement still calls the existing direction predicate on original webcam endpoints, whose >150ms gap fails its continuity check. This is a demonstrated in-scope blocker, not a reason to disable direction enforcement. Resolved in gameplay 4a89afd: the unchanged direction predicate receives private local spline samples clipped to contact ±75ms, with the same maximum gap, tolerances and minimum travel. Reverse-direction coordinator regressions still fail the authored-right event without consuming valid same-frame controls. The connected browser fixture now passes directional Flow and hooks at both 1 and 2 FPS under default enforcement, including >750ms held-input ticks, automatic feedback ON preview sampling without scoring, independent rendering and exactly-once outcomes. Final assembly npm test also passes against the clean 4a89afd release pin; signed browser acceptance passes on that same implementation.

Focused host-only cost sample: 10,000 Flow node reprojections took about 250ms after warmup (~0.025ms/node) in Node on this host. This is not phone performance evidence.

## Delegation

- Beads repair: a3bc8fbf-2917-4c4c-a418-8e653a61bd62 verified and completed; official compatible CLI installed and reads/claim verified without schema override.
- Gameplay coder: eb19a375-fdfe-4fa0-ac31-a09da47fb992 delivered/pushed 4a89afd with full gameplay npm test, browser smoke and focused regressions passing. Parent verified clean upstream state and connected four-case browser matrix. After delivery, parent stopped further queued turns to freeze this tested release pin; no partial changes remained.
- Focused read-only QA: 4d6584c8-120f-463f-9ec1-99b31bae9907 completed. Its default-auto sampling finding was fixed and source-verified, then exercised by the browser matrix. Parent also fixed rejected-value display and fractional FPS step consistency. Parent owns signed browser proof and public cutover.

## Safety and retained state

Keep all existing release/provenance/lifecycle gates. Preserve unrelated modified .beads/interactions.jsonl and calibration screenshot directories. Default Beads was repaired to the already-approved AOM fleet pin 1.3.1 with the documented npm global install command. Normal bd show/list now work against schema 66 without overrides. No fleet policy or database migration was needed. An isolated 1.3.2 binary is retained but is not needed for ordinary commands. Spark-center belongs to Chip and is untouched.
