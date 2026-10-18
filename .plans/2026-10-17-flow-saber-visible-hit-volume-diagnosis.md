# Flow saber visible hit-volume diagnosis — public 0.0.128

**Status:** Diagnosis drafted; implementation and public replacement require Derrick's approval. **Bead:** `aerobeat-web-assembly-8pp1` (in progress). **Owner:** Pico / assembly integration, with gameplay and renderer owning their respective code. **Next acceptance check:** Drive the same resolved hand-up/hand-down pose through actual renderer blade, Flow collider, and judgement at a deliberately chosen hit/miss boundary; compare rendered blade pixels and capsule endpoints rather than relying on the existing box overlay. Public signed game remains unchanged. **Dependencies:** Derrick's phone observation and existing clean owner repos; new signed build and explicit publication decision before replacing the public game. **Goal round cap if approved:** Maximum safe integer.

## Goal and scope

Distinguish a misleading debug overlay from a real visible-saber/scoring mismatch in the current CPU Flow release. If an actual scoring/render divergence is reproduced, make the smallest owning-source correction and verify it in a genuine signed browser build before considering publication. No changes to Boxer scoring, thresholds, assets, CV provider, or current public process while diagnosis is pending. Documentation: explain the actual Flow debug volume in relevant owning README/UI text once the behavior is settled; defer unrelated README cleanup tracked separately.

## Debug diagnosis (read-only, 2026-10-17)

### Exact observed failure

Derrick reports from physical 0.0.128 Flow Play that raising a hand rotates the visible saber upward, but the enabled **Show collider volume** overlay does not rotate. Some apparent visible saber/beat crossings miss. The stationary overlay is a direct physical observation; whether it is the authoritative saber collision shape, and what caused each Miss, are not yet measured.

### Expected behavior

The actual Flow blade hit capsule and the visible saber should be resolved from the same wrist anchor, scale and orientation, subject to documented GLB local-axis corrections. If a debug control purports to show the equipment hit volume, it should portray that volume accurately or explicitly label the different region it shows. Judgements additionally require the note's active XY/Z/time/direction and valid measured input.

### Execution path and most likely root cause

Assembly `src/index.js:1905–1915` resolves per-frame equipment poses and passes them to gameplay. `:2288–2300` supplies the resolved poses to the renderer and only **anchors** to its debug scene. `src/gameplay-equipment-records.js:49–67` composes base hand rotation and animated Flow quaternion into the common resolved pose. Gameplay `aerobeat-web-gameplay/src/equipment-pose-collision.js:61–71` computes the oriented contract saber capsule from that pose. Renderer `aerobeat-web-renderer/src/gameplay-scene-model.js:180–186` builds a separate axis-aligned, wrist-centered **collider_volume** box using `resolveColliderBounds`; it never reads the pose orientation. This explains the unrotated debug box. It does **not** by itself explain the reported misses, since that box is not the actual saber capsule.

### Alternative hypotheses, ranked

1. The visual blade and true capsule disagree because the GLB's child-local axis/offset or the capsule contract transform is wrong for some orientations. Shared pose alone cannot disprove this; need pixel/endpoints evidence.
2. Valid saber geometry intersects the projected note on screen but not the canonical XY note box, active depth/timing window, or authored-direction cone. Need frame-specific position/time/judgement evidence.
3. Real phone tracking supplies delayed/frozen/invalid wrist poses or sparse pose history while the visible animation continues. Need synchronized measured-source timestamps, not a source-only inference.
4. The unrotated box only misleads the operator; actual scoring may be correct for the tested note. Requires same-frame controlled reproduction to distinguish.

### Why previous fixes failed / unknowns

No fix to this physical report has been attempted. Existing source comments/tests assert shared resolved pose, but a common pose is not proof that projected GLB pixels and capsule endpoints coincide on device. Unknown: exact hand, note cell/direction, equipment config, timing, whether the visible crossing was at the note's depth, and whether physical pose was fresh. Derrick need not provide raw camera data; a short description or screenshot with collider overlay and note would help.

### Minimal reproduction and proposed verification

In current Flow Play, enable **Show collider volume**, hold one wrist down, then up, and compare the debug box to the saber. The axis-aligned box should remain so under present code; that observation proves only overlay mismatch. Independently drive a deterministic hand-up resolved pose and a note at an explicit timing/XY/Z boundary through existing equipment/collision tests and a signed rendered Play or production-judgement browser check: capture blade pixels, actual contract capsule endpoints, note box, and resulting hit/miss on the *same* pose/frame. Repeat a down/control pose and prove visibility toggle cannot change scoring. Physical phone retest remains final acceptance for the original complaint.

### Recommended fix (conditional)

If the only demonstrated discrepancy is the debug view, replace or explicitly relabel the axis-aligned preview so **Show collider volume** does not claim it represents the saber capsule. If the genuine rendered blade and contract capsule differ, fix the owning geometry/transform and test both orientations; do not widen collision thresholds to conceal it. Do not publish either change without a newly signed candidate and Derrick's public-cutover decision.

### Debugging record

Problem: Flow saber overlay does not rotate and physical slices appear to miss.
Observed symptom: Hand-up visible blade rotates; Show collider volume box does not; some phone Misses.
Root cause: Confirmed for overlay only: separate axis-aligned wrist-centered debug box ignores saber pose orientation. Actual Miss root cause unknown.
Evidence: Assembly shared-pose calls; gameplay oriented capsule resolution; renderer scene-model box construction.
Failed approaches: None for this report.
Corrective action: Same-frame boundary reproduction, then minimal owning-source geometry or truthful debug-UI correction if warranted.
Verification test: Existing relevant owner units plus one signed direct/iframe real-game boundary check; later physical phone retest.
Related files/components: assembly `src/index.js`, `src/gameplay-equipment-records.js`; gameplay `src/equipment-pose-collision.js`; renderer `src/gameplay-scene-model.js` and equipment staging.
Remaining uncertainty: Whether screen-visible blade and authoritative capsule diverge in actual Play, or whether timing/depth/freshness explains Misses.

## Proposed work, pending approval

1. Reproduce overlay discrepancy and same-frame actual-hit boundary; record old-build failure and exact cause (Bead `8pp1`).
2. Implement only the demonstrated fix in owning repo(s); clarify debug label/README when needed.
3. Run relevant owner unit tests and assembly signed browser Play/production-judgement check, preserving provenance and existing release gates. Ask Derrick before any public service swap.
4. With a public release decision, verify signed bytes on both public relays, preserve rollback, and request phone acceptance. Close Bead, update plan, commit/push intentional durable changes only after agreed checks.

## References

- Physical observation: Derrick's 0.0.128 Flow feedback in this session, 2026-10-17.
- Prior active release and pending phone acceptance: `.plans/2026-10-16-public-device-followup-runtime-progress-flow-good.md`.
- Current public signed source: assembly `1ac241b`, gameplay `34028e81`, renderer `5df4220c`, UI `6f0556d`, vendor `86ef896e`; signed manifest SHA `9890a60b39baf8bf41879bed78738f5b51da1512802246868673bf69c6a840c6`.
