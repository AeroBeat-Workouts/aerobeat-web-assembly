# Boxing glove depth polarity — signed 0.0.140 diagnosis

## Exact observed failure
Derrick reports that `Depth + (forward)` grows the glove collider behind the gloves and `Depth − (backward)` grows it toward incoming beats. Signed connected Play QA with default glove rotation confirms scored and Show endpoints (world Z): +1/−0 `[-0.2175,+0.2925]`, +4/−0 `[-0.2175,+1.8225]`, +1/−4 `[-2.2575,+0.2925]`. The Show overlay has native GLB and nonblank framebuffer pixels. Increasing + extends only positive world Z; increasing − extends only negative world Z. Signed fresh measured scored Play at t=5860ms for an authored center t=6000ms (target z=−0.84) gave default NO HIT, +4/−0 NO HIT, +1/−4 HIT; all three hit at center t=6000ms. No product fix has yet been applied. QA Bead `aerobeat-web-assembly-a3w9` and script `scripts/validate-signed-glove-depth-axis-browser.js` track measured signed evidence.

## Expected behavior
The approved visible labels remain unchanged. Increasing Depth + must enlarge the scored glove cylinder and Show outline toward approaching targets; increasing Depth − must enlarge them behind the athlete. At the default +1/−0, preserve the existing collider endpoints and hits. Do not alter Flow or the immutable signed release.

## Execution path
`src/index.js` wires the `Depth +` input to `boxingColliderVolume.colliderDepthForward` and `Depth −` to `colliderDepthBackward`. Setup is run-locked by `src/gameplay-visual-runtime.js`; gameplay `equipment-pose-collision.js` and renderer native Show volume both call contracts `resolveGloveCylinder`. Its current `startZ=backZ-length*depthBackward` and `endZ=backZ+length*depthForward` use the glove pose's local +Z axis. The signed default resolved pose axis is world `(0,0,+1)`. The renderer's `timestampToWorldZ` maps an incoming future beat to NEGATIVE Z and a spent beat to POSITIVE Z. The scorer uses the same sign: `(songTimeMs-centerTimestampMs)*0.006`.

## Most likely root cause
The cylinder's authoring code assumes local/world +Z means forward into incoming beats. It is actually rearward in this game. Both scorer and Show agree on the inverted cylinder; the UI control-to-setting mapping itself is correct.

## Alternative hypotheses
1. UI fields swapped at dispatch: contradicted by signed saved → run-locked → renderer field identity.
2. Only the visible Show overlay is flipped: contradicted by shared contract endpoint equality and signed scored geometry.
3. A customized glove rotation causes the reversal: contradicted by signed *default* pose axis +Z and matching signed silhouette. Custom rotations may change an individual glove's facing; test them after the base fix.
4. Timing eligibility alone causes the discrepancy: geometry already proves side inversion; eligibility also needs a focused early/late scored test.

## Why previous fixes failed
No depth-direction source fix has been attempted. The existing signed cylinder tests checked total depth, endpoint equality between scorer and Show, and centered hits, but not WHICH SIDE each named control extends. The earlier parent inspection incorrectly assumed future beats travel in positive Z; renderer and signed native measurements falsify that assumption.

## Unknowns and minimal reproduction
Signed QA confirmed explicit early scored contacts; custom 180° pose in scored Play is unavailable and not required to prove the default defect. Minimal native reproduction: in isolated signed Play with default glove pose, set Show on; compare +4/−0 versus +1/−4 and inspect world endpoints relative to a target 100 ms before its center (Z −0.6) and 100 ms after (Z +0.6). No song download is required for the field-axis mismatch. This does not establish the separate physical switched-hand report.

## Proposed verification and recommended fix
With the same signed fixture, prove early contact is reached by − rather than +, and late contact by + rather than −. In the owning contracts, keep the existing default shape by anchoring at the current positive-Z cap `gloveCylinderGeometry.frontZ`: start = cap − length × depthForward; end = cap + length × depthBackward. This makes + face incoming negative Z, − face rear positive Z, without renaming stored settings or changing default +1/−0. Update the contracts assertion to verify default and asymmetric ± endpoints plus rotated-pose projection, then rebuild/re-pin contracts into Assembly and rerun genuine connected scored early/late Play, native Show, and Flow regression before any signed cutover.

## Debugging record
Problem: Boxer Depth +/− control polarity reversed. Observed symptom: +4 extends to Z +1.8225 behind; −4 extends to Z −2.2575 toward incoming beat. Root cause: positive local/world Z assumed forward, but incoming beats are at negative Z. Evidence: signed native saved/run-locked/Show cylinder plus renderer and scoring world-time mapping. Failed approaches: none applied; total-depth-only tests missed polarity. Corrective action: swap physical expansion directions inside shared cylinder construction while preserving default +1/−0 geometry. Verification test: early/late signed scored hits and native overlay, default continuity, direct/iframe; Flow unchanged. Related files/components: contracts `src/equipment-pose-contracts.js`, `scripts/validate-equipment-contracts.js`, Assembly scored-volume browser QA and glove settings. Remaining uncertainty: exact effect of arbitrary customized glove rotations and whether signed scored hit timing has any separate confound; pending QA.
