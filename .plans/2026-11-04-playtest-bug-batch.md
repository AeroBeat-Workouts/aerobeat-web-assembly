# Squash reported playtest bugs, then update the live game

Status: THREE FIXES VERIFIED AND PUBLISHED as0.0.155. Owner/full assembly suites, signed bug-batch and actual public HTTPS checks pass. Physical-only follow-ups remain explicit.
Owner: Pico. Current live baseline: signed 0.0.154, assembly c0fbed7, gameplay a4ba863, input374de74. Keep authentic .149 comparison unchanged.

## Delivery result

Live main HTTPS is0.0.155, verified99 against exact frozen HTML/entryJS; visibleversion, Download/recordingcontrols and zero pageerrors pass. Authentic149 remains exactoriginalstamp/assets and both managed services active. Finalfullassemblynpmtest98PASS after updatingonlystaleversionoracle153->155. One foreground normal run timedout at60seconds, then managed98 completed; no test assertion was waived. Source normal/browser/real checks and signed96PASS, QA lc4xGO.

Closed newbugs gili/5fgy/cqs7 and QAlc4x. Reconciled already-shipped a3w9/wo5x/73xt with signed141 source/artifact evidence, not new155fixes. Original intermittentphysical music/camera/switched-hand/performance uncertainties remainopen; no claim that every oldphysical report is solved. Nextplaytest useslatest155; savedBoxingcharts need selected Reimport. Download Data remains available if the physical trace is needed. Engineering batch is complete; no further automatic audits/tests are required.

## Original action

Start with the recent deferred reports: gili (Sonic Heroes import when NJS is absent), 5fgy (100% repeated-punch hand switch), and cqs7 (misleading wrong_direction diagnostic). Reproduce each in its owning package, make the smallest correction, then exercise the built assembly. Reconcile older user-reported bugs against current source/tests: many ledger entries still describe already-shipped September/October work. Do not equate an open historical entry with a current regression, or close one without concrete shipped/test evidence.

Derrick explicitly authorizes updating the current live build after these fixes pass. No separate routine publication approval is needed for this batch. No new UI, tuning redesign, CV backend, schema cleanup or speculative hardening is approved. Preserve collision sizes, timing/direction/safety/privacy gates and the existing recording/replay tool.

## Work and acceptance

1. Inventory current user-reported bugs and separate recent actionable defects, already-shipped fixes, and issues genuinely requiring new physical evidence. Record dispositions with Bead IDs.
2. gili: verify the actual Beat Saber fallback by version, reproduce the named Sonic Heroes map through the real provider/import path, correct absent/zero-default handling based on verified source semantics, retain malformed-value rejection and add normal regression coverage.
3. 5fgy: trace the 100% setting through native controls/import conversion. Test hand identities for repeated straight/hook/uppercut sequences; distinguish repeated family from repeated hand. Fix demonstrated behavior without silently changing hand-switch semantics into family-switch semantics.
4. cqs7: distinguish no contact from a proven direction rejection in diagnostic output without changing scoring, geometry, gates or timing. Cover negative and valid-contact cases.
5. Address other current reproducible user-reported defects uncovered by the bounded inventory. Keep unrelated test harness/rare hypothetical/format cleanup out. Existing physical-only uncertainties remain explicitly labeled, not fabricated as fixed.
6. Integrate exact source pins. Run owning normal tests, focused regressions and genuine signed browser checks at import/conversion/scoring boundaries. Run the assembly normal suite and retain recording/replay parity. One focused QA pass where warranted; no audit chain.
7. Update README/owner plans and Beads; commit/push coherent work. Version the next release distinctly, build/sign/freeze it, update only the existing main live service and verify actual HTTPS bytes/version. Preserve .149 and previous release snapshots. Report fixes and any remaining human acceptance.

## Execution tracking

Umbrella: 0a3b (Pico claimed). Initial gili, 5fgy, cqs7. DSH goal goal-a6319326-355e-4f99-a9bc-858ff03d5327; cap Maximum safe integer.

Verified direct coder children: 136269a0-9312-46fe-9f41-dd8d7a65d89f running vendor gili; 736c1fb7-f61a-4888-b38c-018117f0d704 running authoring 5fgy. Each owns only its package, source tests/docs/commit, no push before parent review. Parent owns gameplay cqs7, backlog dispositions, integration and publication.

Early 5fgy reproduction: source L,L,L independently flips later source repeats to final L,R,R at100. README does not specify original-only matching. Parent directs a bounded fix against previous emitted same-family hand, preserving family and validating final optimizer output; the old test expecting L,R,R is a bug-codifying expectation, not an explicit human contract.

## Current source results / exact continuation

- cqs7: parent gameplay cb028da (tree6175a75c06165e7aa2ec0f0e7da4c3e2983732ad), clean/ahead1, not pushed. Actual no-contact regression RED wrong_direction, then GREEN wrong_collider; rejected geometry remains wrong_direction; qualifying reversal timing unchanged. Focused spline/contact and full gameplay npm test PASS (bash90). Optional rejection callback is observation-only; diagnostic state clears with existing continuity/run state.
- 5fgy: authoring dcb0138 after diagnostic527ad9e, clean/ahead2, not pushed. Final emitted100% hands now alternate in straight/hook/uppercut and both variants; family unchanged. Source/browser/security tests pass. Full unit/real suites require missing local54510 and3D44B archive fixtures; do not claim complete green until parent restores exact public test inputs or records the gap.
- gili: actual named map is2fa8c/hashfb09ccd3edeb747ee3735a01824234d5c31fb9a1, Info2.0 Easy explicitly0, not absent. Parent corrected scope to documented zero sentinel. Child cross-checked pinned ChroMapper V2/V4 shared10/10/10/12/16 resolver, bsmap and SongCore defaulting; no proprietary game binary execution claimed. Actual service import now PASS Easy10 with explicitExpert16/ExpertPlus18 unchanged; normal45 value/version rows and browser tests pass. Commit/report is finishing.
- Next: source review/push complete (vendor ea715b2/treef9230128d85c0e6bb7da11577bca314fa76a3b05; authoring dcb0138/tree4c1d84f54a838504e0855705842549d35e74f04d; gameplay cb028da/tree6175a75c06165e7aa2ec0f0e7da4c3e2983732ad). Authoring exact public archive fixtures restored from pinned CDN versions, then full npm test and test:real PASS (bash94), no waived gates. Assembly pins updated and version0.0.155 staged. Exercise real named map +100% native import/reimport + signed diagnostic controls in the built game; run normal assembly/replay, then publish next version under the direct authorization.

## Final gate diagnosis

The first monolithic assembly run97 stopped at shared-hash-provenance.js:52: actual version0.0.155 versus hardcoded expected0.0.153. The oracle explicitly checks the published candidate patch version; the planned release bump made that literal stale. This is not a dependency/provenance/runtime failure. Update only the expected patch to0.0.155, retaining every dirty-worktree/hash/closure assertion, then rerun the full normal gate. No product or collision change is justified.

Signed build d30c9c8 already passes the complete bug-batch command96: real Sonic Heroes zero-NJS archive direct+iframe import; real54510 native100% settings/Reimport direct+iframe; full recorded-input/marker/control/currentlease/scoring replay including exact reversal/late hit and strict negative diagnostic reasons. Frozen59-file candidate `.tmp/cpu-r155-verified-d30c9c8`, stamp FRIEND-GAME-CPU-0.0.155-5517f32d47835b236e10dddf. Live still.154 until final gate passes. QA lc4x is GO, no likely new blocker or required complexity cleanup.

## Initial backlog disposition

Recent actionable reports are the three above. Older public corrections already documented in current README include0.141 same-hand spacing/glovefront-back/trailingwalls/completedReimport silence,0.143 completed-song autoplay correction and0.149 localZIP reimport. Reconcile their ledger entries against actual normal/built checks instead of silently redoing them. Phone-specific inference/corpse-hit/Brave unknowns are not proven fixed by host tests; keep explicit physical-evidence follow-ups. Test-harness/rare hypothetical and data-compaction tasks are not user-playtest fixes in this batch.

## Scope notes

The backlog also contains physical-throughput investigations and obsolete release tasks. Recent nrrv source correction/publication is done; physical hit-rate acceptance remains Derrick's. Reuse existing evidence rather than launching a whole-project audit. Memory search is healthy local-vector but returned old Godot-era facts, which do not supersede this Web ledger or the current request.

No mockup is declared for this repair batch; no developer UI addition is planned.
