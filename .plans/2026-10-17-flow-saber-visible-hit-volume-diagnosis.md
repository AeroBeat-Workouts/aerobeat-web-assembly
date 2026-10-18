# Flow saber visible hit-volume diagnosis — public 0.0.128

**Status:** Derrick explicitly directed the Flow scoring-depth behavior and separate rotating-overlay bug fix; bounded implementation authorized, public cutover remains a separate decision. **Bead:** `aerobeat-web-assembly-8pp1` (in progress). **Owner:** Pico / assembly integration, with gameplay, contracts and renderer owning their respective code. **Next acceptance check:** Drive the same resolved hand-up/hand-down pose through actual rendered blade, Flow collider, and judgement at a chosen hit/miss boundary; compare pixels and capsule endpoints before changing behavior. Public signed game remains unchanged. **Dependencies:** Clean owner repos; new signed build and a separate explicit publication decision before replacing the public game. **Goal round cap if approved:** Maximum safe integer.

## Goal and scope

Fix two separate Flow problems in the current CPU release: the editable depth controls must affect the *scoring saber* along its rotating axis, with backward `0` starting at the bottom of the hilt and forward `1` reaching the visible saber tip; **Show collider volume** must represent that oriented scoring volume rather than an unrelated fixed box. First distinguish this from any additional rendered-blade/scoring mismatch that causes missed cuts. Keep existing scored-note timing as a separate concept only if it remains consistent with Derrick's blade-hit intent; never reinterpret his depth controls as merely a timing-window preference. No changes to Boxing scoring, assets, CV provider, or current public process while developing the candidate. Documentation: explain the actual Flow debug volume and scale/depth semantics in owning README/UI text; defer unrelated README cleanup tracked separately.

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

## Second physical report and design decision, 2026-10-17

Derrick also tried Flow **Depth − (backward) = 0**; the UI restored `1` instead. He expects zero rear extent to work. He expects **Depth + (forward)** to originate at the saber's bottom hilt and extend toward the incoming beats while following equipment rotation. This is a material behavior request, not merely a cosmetic correction.

**Confirmed reason zero fails:** Assembly `src/game-setup-coordinator.js:12,74` bounds both depth factors to `[1,4]`, and `src/index.js:3236,3261` gives the inputs minimum `1` and rerenders the previous setting on failed validation. Gameplay `src/flow-collider-collision.js:18–21,60–63` and contracts `src/collider-contracts.js:29–36` also require depth >=1. The contracts `resolveColliderBounds` currently places axis-aligned Z faces around the **wrist plane**, scaling the 180ms × .006 WU/ms timing depth; forward is world −Z, backward is world +Z. Neither depth factor currently defines distance **along the rotating saber**. The visible debug box and Flow beat time/deadline consume this target-region depth; the actual saber capsule uses the resolved pose separately. Therefore simply changing HTML min to zero would not implement the requested design and could silently change late-note scoring or reject persisted settings.

**Derrick's correction resolves the prior question:** The numbers must change **scored collider reach along the visible saber**. With rear `0`, its rear endpoint is the bottom of the hilt; front `1` ends at the visible blade tip. The oriented hit volume and the visible debug volume must agree with this shape, including on hand-up/hand-down rotation. Do not deliver an HTML-min-only patch, a stationary volume relabel, or the earlier recommendation that zero changes only an unrelated non-scoring preview. The prior question about removing the late-hit window was based on a mistaken model; do not ask it again. Check whether the present XY projected-capsule/independent world-Z note window can meet the requested visual=hit behavior; if not, propose the smallest specific collision change before editing that authority. Test front scale around `1`, rear `0` and positive rear control, run-locked setting persistence, renderer agreement, missed/hit judgements, note-time boundaries and Boxing isolation. No code changed; public route unchanged.

## Approved implementation scope (public replacement separately gated)

1. Reproduce old-build stationary overlay and same-frame oriented saber scoring (Bead `8pp1`); measure bottom-hilt and visual-tip points in the actual renderer, and document the exact distinction between blade reach and current target depth/timing.
2. Implement Flow-only scored forward/backward reach (`0` rear at hilt; `1` front at visible tip) and a debug shape that rotates with the same resolved pose. Align shared geometry/validators, persisted setup and run lock; preserve Boxing. Correct only any demonstrated additional render/scorer transform mismatch. Update affected owner READMEs/UI wording.
3. Run focused owner units and assembly genuine signed browser Play/production-judgement assertions: old RED/new GREEN for zero rear and rotated forward tip, positive rear sensitivity, visible debug geometry, hit/miss boundaries, timing and unchanged Boxing; preserve provenance and existing release gates. Commit/push coherent owner changes.
4. Propose a separately approved public cutover if signed candidate passes; if Derrick approves, verify signed bytes on both relays, preserve rollback, and request off-network phone acceptance. Keep Bead open until acceptance, then update/archive plan and close completed work.

## References

- Physical observation: Derrick's 0.0.128 Flow feedback in this session, 2026-10-17.
- Prior active release and pending phone acceptance: `.plans/2026-10-16-public-device-followup-runtime-progress-flow-good.md`.
- Current public signed source: assembly `1ac241b`, gameplay `34028e81`, renderer `5df4220c`, UI `6f0556d`, vendor `86ef896e`; signed manifest SHA `9890a60b39baf8bf41879bed78738f5b51da1512802246868673bf69c6a840c6`.
