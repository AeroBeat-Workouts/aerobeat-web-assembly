# Boxing Scale without arbitrary bounds and Flow-style Show outline

**Status:** Owner implementations pushed clean, source integration GREEN and old signed public 0.0.133 RED for the exact Scale reversion. Signed private 0.0.134 candidate/QA pending; current public0.0.133 unchanged. **Owner:** assembly Bead `aerobeat-web-assembly-26as` claimed. Renderer coder Bead `aerobeat-web-assembly-g974` closed by verified child `2ffedbff-e7a0-4b86-b1a4-a6b6f5d3bbcd`; renderer owner clean/pushed at `054003c60230f1bb56092aa68e3a0d626eab3f57` tree `eaa1b3f5be7740034ad9ec7548eb1146e16f6aa3`, npm test + browser PASS. Contracts clean/pushed `f6cfde401a3d9e50da3b8344aae066c098cfb119` tree `669bb592c04d86ad3abd9d20ee700565c51cc5cb` npm test PASS. Gameplay clean/pushed `b885a87cf250260670a8285363a0c8976188e665` tree `6d97f67c4ddf8eebe4a8b57ae310d6518e1df139` npm test PASS. Assembly native UI/setup changes made but not yet pushed. Real source Boxer scored Play direct 844×390 PASS at Scale `5` (native stored/run-locked input, preview, retained 12-edge charcoal wire post-World, GLBs, on/off framebuffer, Great hit) and Scale `0` (no Show/wire pixels, stored/run-locked zero, GLBs, no scored hit). At Scale 5 the large existing target footprint legitimately fills much of this viewport; it does not resize the glove GLB. Five-context native Boxer scored Play matrix (all previous scenarios + Scale0/5) PASS, scored Flow Play direct/iframe PASS, Flow Test Show direct/iframe PASS. Assembly full `npm run check`, `npm run test:unit`, native mobile menu PASS after version 0.0.134/pin edits. Same native Boxer `scale-unbounded` test on immutable signed public0.0.133 RED with `persisted boxingColliderVolume.colliderScale differs from native input`, not a setup or wire failure. No public service changes. Public signed 0.0.133 at existing HTTPS443 route stays unchanged without separate publication approval; immutable 0.0.132/.131/.130 remain rollback. Source candidate will be 0.0.134. DSH goal round cap: Maximum safe integer.

**Decision:** Boxer Collider Scale accepts finite nonnegative floats including 0, tiny, .5, 5 and 9999999 without arbitrary min/max, preserving .5 default and stored values. Zero means no scored glove contact and no Show cuboid/wire, as Flow zero scale does. Scale changes the existing Boxer target footprint; do **not** reinterpret it as resizing the GLB glove or silently change note targets. Keep both Boxer depth controls finite/nonnegative with existing defaults and preserve Flow gameplay. Boxer Show uses the same thin charcoal polygon wire appearance as the Flow saber Show overlay, tracing the *actual Boxer collider cuboid* without widening the scored geometry; retain the Boxer translucent fill, GLBs and score semantics. The visual geometry follows each valid hand anchor and hides when Show off, zero scale or tracking is lost. No mockup was supplied (`ui_fidelity`: not declared). The source and private signed candidate may be prepared and QAed now; ask Derrick separately before replacing the public 0.0.133 service.

**Next real checks:** First demonstrate old public0.0.133 native Boxer Scale 5 is invalid/reverts and Boxer Show scene entity has only the plain-box fill. Then make owner and assembly unit tests GREEN, run native Boxer scored Play direct and genuine cross-origin iframe for Scale 0/.00001/5, verify saved/reloaded input, run-lock, preview, GPU Show polygon visibility, score changed only as authored, and Flow Show/Play unaffected. Build immutable private signed0.0.134, independently QA that frozen runtime, seek publication permission separately. Prefer existing scored Boxer browser/Flow browser checks; do not weaken strict pixel regression or claim full shell DPR3 cadence gate green. Update owner/assembly READMEs and plan after observed product result.

## Debugging report (before code edits)

### Exact Observed Failure

In the currently signed public0.0.133 product, Boxer Scale input has `min="0.25" max="4"`. A public-browser probe previously set Boxer Scale to `5` and observed `valid:false`, displayed `0.5`, persisted `0.5` after the UI setup lifecycle. The current renderer scene builder emits a plain Boxer `collider_volume` box (one primitive fill), whereas Flow Show creates a translucent capsule *and a separate charcoal edge mesh*. Derrick reports the Boxer volume is harder to see and explicitly requests the same polygon-shader style. The old browser probe did not measure a Boxer screenshot/contrast metric; that is the next genuine visual check.

### Expected Behavior

The edit should retain arbitrary finite nonnegative Boxer Scale choices rather than snap outside .25..4; zero hides both the visible Boxer Show geometry and scored contact. The Show volume should clearly reveal the current hand's three-dimensional Boxer hitbox using the same contrasting wire treatment as Flow, without altering its volume, shape, target/GLB assets, or score.

### Execution Path

Native `aero-game` Scale number field in `src/index.js:3264` installs .25..4 and a `max=4`; `applyColliderVolumeControl` calls `setGameSetupSnapshot`, and `src/game-setup-coordinator.js:75` rejects a Boxer scale outside `colliderVolumeBounds`. `gameplayBoxingColliderSettings` forwards saved scale into `createBoxingColliderSettings` in gameplay (`boxing-collider-collision.js:89`), which rejects values outside .25..4. Flat Boxer `isColliderSettings` in contracts (`collider-contracts.js:32`) rejects zero even if the prior gates were opened. Scoring's `resolvedGloveObbContactsBoxingTarget` and `sweptGloveObbContactsBoxingTarget` use scale on the Boxer target footprint; unlike Flow, Boxer has no explicit zero-scale skip. The assembly frame forwards Boxer settings to the renderer. Renderer `gameplay-scene-model.js:208-212` creates a plain `collider_volume` box per valid anchor, including zero if allowed; `renderer-facade.js:714-720,739-760` places its fill in the pre-World overlay with no edge, while Flow has an edge mesh in the later outline layer (`renderer-facade.js:685-704,820-829`).

### Most Likely Root Cause

The scale reversion is the intentional but now unwanted *multi-layer* .25..4 policy, not lost storage. The visual contrast difference is the missing Boxer edge plus its earlier compositing layer, not a scoring size change; Flow's charcoal edge already demonstrates an accepted appearance. Evidence: source branch and material creation above, the installed input's native validity and revert, and prior signed Boxer Show/GLB pixel checks that measure a filled box but no stroke.

### Alternative Hypotheses

1. **Async setup sync alone causes Scale reversion (unlikely):** a prior post-release diagnostic rendered Boxer depth too early and transiently displayed stale in-memory settings while storage was correct. Scale `5` is natively invalid *before* event dispatch, and game-setup and gameplay independently reject it; waiting cannot accept it.
2. **GLB pose or color is wrong (possible contributor to low contrast, not root):** the existing Boxer strict pixel oracle sees GLB pixels and scored hit, while renderer Boxer overlay has no outline. Verify with off/on paired framebuffer and real GLB presence.
3. **Boxer scored contact is physically hard to see because scale changes the *note target* not glove (true separate semantic):** retaining current semantics is the smallest approved fix; a product redesign to resize glove instead would need Derrick's distinct approval.

### Why Previous Fixes Failed

The 0.0.133 release deliberately changed *depths only* and explicitly retained Boxer Scale .25..4. It was not an unsuccessful attempt to uncap Scale. The Flow Show contrast fix added an edge only to its capsule and intentionally left the Boxer box in the original layer. Reusing only Flow's input min attribute would leave gameplay and contracts rejecting Scale and would not add the Boxer visual edge.

### Unknowns

Actual Boxer outline contrast over GLBs/track in both direct and embedded viewports is not yet measured. The native Play zero-scale scorer's current degenerate-box behavior requires a focused regression; implement an explicit no-contact guard rather than infer that a zero-area hull cannot hit. Very large finite scale may produce out-of-view or nonrepresentable derived world coordinates; reject truly nonfinite derived geometry instead of introducing a new numeric field cap. Physical-phone Boxer feel remains Derrick's verdict.

### Minimal Reproduction

Choose a Boxer chart, open Game Setup, set Scale to 5 or 0, blur: signed0.0.133 restricts the number field and reverts to .5 (same result in a signed runtime probe selecting Boxer mode). Show collider volume in Play: Boxer emits a plain translucent box, no independent dark wire mesh; Flow Show has both translucent capsule and dark polygon edge. Within-range Boxer .5 is accepted and its scored Play still works.

### Proposed Verification

Make the old signed0.0.133 native Scale 5/0 regression RED for actual input/store reason. Test owner settings + contracts accept 0/.00001/5/9999999 but reject negative/nonfinite; scale0 produces no hit in Boxer scored/contact helper; existing .5/4 identity and defaults unchanged. Test renderer scene missing Boxer object at scale0; at .5/5 Show has same physical box bounds as contract, preserved fill and a contrasting wire edge, off/lost pose hides both. In the actual native Boxer Play, pair off/on GLB framebuffer captures and assert visible stroke pixels on the scored box with existing stricter pixel oracles intact. Signed Flow Show remains unchanged.

### Recommended Fix

Remove only Boxer Scale's .25..4 UI/setup/gameplay policy and accept finite nonnegative flat Boxer settings like Flow, retaining the existing Boxer score-target geometry at positive scale. Add explicit zero-scale no-contact + no-Show branches. Draw a fixed-size, retained line mesh along each Boxer's 12 box edges (optional sparse face diagonals only if visible without clutter), charcoal/emissive alpha .8 like Flow, composited in the Flow outline's post-World layer while the original Boxer fill stays in its original layer. Add cleanup and strict direct/iframe Play visual assertions; do not change GLBs, note event geometry, Flow renderer, unrelated limits or release service before approval.

### Debugging Record

Problem: Boxer Scale reverts outside .25..4; Boxer Show is hard to see.
Observed symptom: public0.0.133 Scale5 input invalid and reverts .5; Boxer scene emits fill only while Flow emits fill plus charcoal wire.
Root cause: multi-layer arbitrary Boxer scale bounds and missing late-layer Boxer wire geometry.
Evidence: assembly index/coordinator, gameplay settings, contracts validator, renderer model/facade; actual installed input probe.
Failed approaches: prior 0.0.133 depth fix intentionally kept Scale bounded; Flow-only edge did not affect Boxer.
Corrective action: finite nonnegative Boxer Scale throughout, explicit zero-off semantics, retained Boxer box wire at scored surface.
Verification test: old signed native Scale5 RED; owner+assembly tests and signed native Boxer Play direct/iframe Show/score GREEN, Flow unaffected.
Related files/components: `src/index.js`, `src/game-setup-coordinator.js`, contracts `collider-contracts.js`, gameplay `boxing-collider-collision.js` and `equipment-pose-collision.js`, renderer `gameplay-scene-model.js` and `renderer-facade.js`, scored Boxer/Flow browser checks.
Remaining uncertainty: contrast quality at phone-density viewport and physical-player preference; enormous derived values may not fit representable scene/Play.

## Executable milestones

1. **Diagnosis complete:** Public0.0.133 Scale limit and missing Boxer polygon wire traced; baseline old RED/visual fill comparison pending. Bead `26as`.
2. **Done:** Owner contracts/gameplay Scale and zero semantics, renderer 12-edge wire Bead `g974`, assembly UI/persistence and new native scenarios integrated. All three owners clean and pushed; scored native Boxer direct/iframe at Scale0 and Scale5 GREEN while unchanged signed public0.0.133 native Scale5 RED for its exact stored-input reversion.
3. **In progress:** Full affected unit, five-context scored Boxer and Flow direct/iframe passed; README candidate note and owner pins updated. Commit/push clean assembly source, freeze distinct signed private0.0.134 and independently QA real Show contrast/Play/Flow.
4. **Pending human publication decision:** Only switch existing public signed0.0.133 after separately approved signed candidate. Verify exact HTML/JS on both relays and installed browser; preserve 0.0.133/.132/.131/.130 rollbacks; close Beads, push docs. If not approved, leave private verified candidate and public0.0.133.
