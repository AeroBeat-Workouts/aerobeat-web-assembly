# AeroBeat 0.0.54 — 0.0.53 Playtest Feedback Successor

**Status:** PLANNED (pending Derrick approval to execute)
**Owner:** Derrick (AeroBeat)
**Orchestrator:** Cookie
**Owning repo:** `aerobeat-web-assembly` (plan owner) + polyrepo waves
**Branch:** `main` (all repos)
**Date:** 2026-09-15

## Goal

Land the 0.0.54 successor addressing Derrick's 9-item playtest feedback on the immutable raw 0.0.53:
fix the Start|Test button teal remnant, re-enable the debug camera while paused in Test, anchor the
collider overlays to the beats, remove the drawer note line, make the hit-success aftermath visible
(the 0.0.52 spec was implemented but unreachable in Test mode + drops early), make Boxing mode
selectable (the `boxing_collider_v1` variant is never produced by the content pipeline), suppress
the MediaPipe wasm console noise, and redesign the hazard vignette to pulse *while inside* the
collider with the tuning variables exposed in Game Setup. Culminate in a physical playtest PASS.

## REFERENCES

- Predecessor plan: `.plans/2026-09-14-flow-playtest-feedback-0.0.53-successor.md` (0.0.53 COMPLETE: raw `ffb47ae` built once, source stage `9412b51`, ABCCBA PASS, served local 5173 + tailnet :8443 byte-identical, SHA-256 `eff42e9d…`).
- Hit-success aftermath spec (p5pr, approved 2026-09-13): `.plans/2026-09-02-handcrafted-3d-gameplay-visuals-and-environment.md` §"Hit-success aftermath feedback" (lines 2337–2350).
- Hazard vignette original design (dntq): same file §"Hazard-contact red glow vignette" (lines 2352–2363).
- Boxing Collider design doc: `.plans/design/2026-09-11-boxing-collider-reach-band-mode.md` (lines 110–117: "New imports: `boxing_collider_v1` is the only newly-created boxing variant").
- 0.0.52 aftermath implementation record: 0.0.52 plan lines 2385–2411 (W1-C renderer `bffc340`, W2 assembly `d658a9d`).

## Investigations (parent, read-only — 2026-09-15)

Every item was traced to a concrete root cause in source:

1. **Button teal remnant (item 1).** The 0.0.53 W3-E fix made the button FILL white
   (`.session-actions button{background:linear-gradient(180deg,#ffffff,#eef2f5)}` in
   `aerobeat-web-ui/src/elements/aero-product-presenters.js:527`), but the drawer wrapper
   `aerobeat-web-assembly/src/index.js` carries `.start-action{…background:#00566b;border-color:#00566b;…}` —
   the dark-teal band in the 8px gap and behind the buttons — plus the global presenter border
   `.control, button, input, select{border:1px solid rgba(53,141,175,.5)}` (presenters `sharedStyles`).
   Two surfaces still read green/teal.
2. **Camera disabled while paused (item 2).** `aerobeat-web-assembly/src/index.js:~1310`
   `debugCameraSnapshot()` gates `enabled` on `session?.state === "playing"` ONLY. On pause the
   snapshot flips false → `renderer.setDebugCameraEnabled(false)` → `clearDebugInteractionState` +
   `resetDebugCamera()` (the camera pose is even reset). The sibling
   `testPresentationAuthoringSnapshot()` (index.js:1473) already allows `["playing","paused_manual","completed"]`
   for the beat-authoring controls — the camera snapshot is the outlier.
3. **Overlays not attached to beats (items 3+4).** `aerobeat-web-renderer/src/gameplay-scene-model.js`
   `colliderOverlayObjects()` builds the `collider_square` at `{x:p.x,y:p.y,z:0}`, the `tolerance_cone`
   at `z:0.006`, and the white target-point marker at `z:0.009` — the beat's travel depth `p.z` is
   IGNORED (flats pinned at the Z=0 hit plane) and nothing gives them top-of-beat draw priority.
   Screenshot match: square + cone + cube sit at fixed scene positions instead of riding the beat.
4. **Drawer note (item 5).** `aerobeat-web-assembly/src/index.js:2060` — the exact
   "Timing, collider, and spawn-distance changes apply on next Start/Test. Grid and visibility
   changes apply live." `<p class="game-setup-note">`.
5. **Hit-success aftermath not visible (item 6) — spec vs implementation comparison (Derrick asked):**
   - **SPEC (p5pr, approved 2026-09-13):** Flow hit → clip-plane halves with seeded separation +
     tumble falling to the floor; Boxing hit → punched away with per-family ballistic
     (straight `(0,+.5,−4.0)`, hook `(±1.2,+.3,−3.0)` toward center, uppercut `(0,+2.2,−2.5)`,
     guard bonk `(0,+.2,−0.5)`), gravity −9.8, floor −0.72, 1–2 damped bounces → settle;
     **cap 7 beats, oldest evicted with ~150 ms fade — settled pieces persist until evicted**;
     **"aftermath shows in Test and Play"**.
   - **IMPLEMENTED in 0.0.52 (verified in source):** renderer closed-form aftermath engine +
     clip-plane slice materials + pixel oracles (0.0.52 plan lines 2385, 2392) and assembly
     `projectAftermathEntries` FIFO (0.0.52 plan line 2411; `src/gameplay-frame-effects.js`).
   - **WHY INVISIBLE — two confirmed defects:**
     a. **Test-mode gap:** `projectAftermathEntries` derives ONLY from real `gameplay.judgements`.
        Test Mode uses synthetic demo outcomes (no real judgements by design —
        `session-render-projection.js:118` `syntheticCommitMs`), so in Test Mode (Derrick's main
        playtest mode) the aftermath list is ALWAYS empty. The projected target record carries
        everything needed (`feedback.judgement==="hit"`, `beatCenterMs`, kind/hand/family,
        cell/spatialTarget) and is already passed into `projectAftermathEntries` as `targets`.
     b. **Retention defect:** line 128 drops any hit after 950 ms (`HAZARD_CONTACT_RETENTION_MS`
        reused) — contradicts the approved "persists until evicted by the 8th hit" design; pieces
        vanish before they settle on the floor.
     c. Play-mode path is code-complete (real judgements carry `eventId` +
        `committedTimelinePositionMs`, `session-coordinator.js:1531,1117`); a harness check in W2
        records 3-part evidence that a real Play hit produces visible slices.
   - **Verdict: the feature WAS implemented (0.0.52) — it is unreachable in Test Mode and drops
     early. This successor makes it reachable + honors the persistence design.**
6. **Boxing unavailable (item 7) — product bug, 3-part proof in source:**
   - `aerobeat-web-assembly/src/index.js:655` throws "Selected gameplay variant is unavailable" when
     `exactGameplayVariant(variants, "boxing_collider_v1", recipeId)` finds no match.
   - The content pipeline NEVER emits a `boxing_collider_v1` variant:
     `aerobeat-web-content-authoring/src/converter.js:58` loops only
     `[semanticTrackRulesetId, spatialGridRulesetId]` (Lanes + Grid); Flow uses
     `flowCollidersRulesetId`. `grep boxing_collider_v1 aerobeat-web-content/src` → **zero matches**.
   - Design doc (lines 110/114): "New imports: `boxing_collider_v1` is the only newly-created boxing
     variant". So EVERY package (new or old) fails the Boxing selection. 0.0.52 shipped this gap.
7. **MoveNet wasm console noise (item 8).** `@mediapipe/tasks-vision@1.0.1` logs
   (OpenGL error checking disabled / XNNPACK delegate / feedback-manager single-signature /
   NORM_RECT without IMAGE_DIMENSIONS) through `vision_wasm_internal.js`. The pinned build has NO
   `setWasmLoggingSeverity` API (verified in bundle + wasm internals). Suppression must be a
   bounded console filter at the vendor wrapper; the NORM_RECT warning can additionally be fixed at
   source by passing `IMAGE_DIMENSIONS` to the MoveNet landmarker options.
8. **Vignette fires on exit + red cube (item 9).**
   - `aerobeat-web-gameplay/src/session-coordinator.js` `finalizeObstacles()`: the wall outcome
     (`kind:"wall", result:"contact"`, `committedTimelinePositionMs`) is pushed only when
     `timelinePositionMs >= obstacle.intervalEndTimestampMs` — i.e. at interval END (exit). The
     0.0.52 vignette envelope (150 ms ramp / 600 ms decay, event-time based) therefore flashes
     AFTER the nose leaves the obstacle. The coordinator already tracks continuous inside-state
     (`occupiedObstacleIds`, per-obstacle `contact` intervals, `firstContactTimelinePositionMs`) —
     it is just not exposed.
   - **Red test cube:** `aerobeat-web-renderer/src/renderer-facade.js` `updateSceneObjects()` loop
     has no branch for `kind==="hazard_glow"` (only feedback/aftermath/collider overlays); the
     `hazard_glow` scene object (`gameplay-scene-model.js:522` — position `(0,0,0)`, scale 1,
     alpha = vignette intensity, role "obstacle") falls into the generic path → a 1×1×1
     obstacle-colored (red) primitive cube at the world origin ("center of the play timeline"),
     visible exactly while the vignette is active. `applyHazardGlow` (line 241) was the intended
     sole consumer.

## Scope (Derrick's 9 items)

1. **Button teal remnant (BUG/POLISH)** → neutralize `.start-action` background (assembly) +
   neutral border on `.session-actions button` (ui presenter). No teal/green anywhere around
   Start|Test (fill, border, gap).
2. **Camera while paused (BUG)** → `debugCameraSnapshot()` allows `["playing","paused_manual","completed"]`;
   no pose reset on pause; movement intents, keyboard, and mouse-look all work while paused in Test.
3. **Collider overlays ride the beat (BUG)** → `collider_square` + `tolerance_cone` + target-point
   marker anchored at the target's CURRENT position including travel depth (p.x,p.y,p.z + small
   camera-side offset), rendered on top of the beat (depth-test off / high render order on the
   existing overlay layer). White cube = collider CENTER at the beat's exact center.
4. **Same fix covers item 4** (the collider square must travel with the beat and encompass the
   arrow glyph — half-extent = target half-extent + colliderRadius, unchanged).
5. **Remove drawer note (POLISH)** → delete the `game-setup-note` line at index.js:2060 (+ its
   wrapper if empty).
6. **Hit-success aftermath visible (BUG vs spec)** → derive aftermath from synthetic Test-mode hit
   targets in addition to real Play judgements; live-7 cap is the ONLY cleanup (persist until
   evicted; evicted fade 150 ms); Play-path 3-part evidence recorded.
7. **Boxing selectable (BUG)** → converter emits `boxing_collider_v1` for NEW imports (single
   collider variant, no recipe — per design doc line 110/114: the ONLY newly-created boxing
   variant; new imports stop emitting the Lanes/Grid pair, legacy stored packages keep their
   stored variants readable). EXISTING packages (no collider variant): bounded **"reimport
   required" gate** — the design-doc `flow_grid_reimport_required` precedent; the assembly maps
   "Boxing selected + package lacks collider variant" to a new `boxing_collider_reimport_required`
   reimport message (info box, clear stale selection — same pattern as
   `FLOW_REIMPORT_MESSAGES`/`flowReimportReason`, index.js:67-69,2338) instead of the generic
   "Selected gameplay variant is unavailable" throw. New partition local-only/unranked.
8. **Wasm console noise (POLISH)** → bounded console filter in the vendor-mediapipe wrapper
   (drops the known MediaPipe internal signatures; everything else untouched) + pass
   `IMAGE_DIMENSIONS` to the MoveNet landmarker options so the NORM_RECT warning is fixed at source.
9. **Vignette while inside + tunable + red cube (BUG/FEATURE)** →
   a. coordinator exposes a bounded presentation state `hazardContact:{active:boolean,sinceMs:number|null}`
      (nose inside any obstacle collider; `sinceMs` = first contact of the current episode;
      presentation-only, no coordinates in public snapshots);
   b. assembly pushes `frame.hazardContactActive` alongside `frame.hazardContacts` (bomb flashes
      stay one-shot events);
   c. renderer wall-vignette = state-driven: ramp-in over rampMs, then SINUSOIDAL PULSE
      (1−depth → 1) at pulseHz while active, masterIntensity-scaled; decay over decayMs on
      release; existing fullscreen quad, MAX-blend with bomb flashes;
   d. **five new Game Setup fields (live per-frame, presentation-only)** — exposed in the drawer
      for Derrick's tuning (lock-in + hide follows the 931s pattern in a LATER release, after his
      physical tuning): `hazardVignetteIntensity` (0–1, def 0.6), `hazardVignettePulseHz`
      (0–5, def 2), `hazardVignettePulseDepth` (0–1, def 0.35), `hazardVignetteRampMs`
      (0–1000, def 150), `hazardVignetteDecayMs` (0–3000, def 400);
   e. red cube eliminated (facade loop skips `hazard_glow`).

## Waves (coder→QA→auditor; parallel only on disjoint repos)

### Wave 0 — Contracts (`aerobeat-web-contracts`)
- W0: add the five `hazardVignette*` fields to `AeroGameSetupSnapshotV3` (bounds, defaults,
  normalizer, type guards, forward-compat missing→defaults, legacy unknown keys dropped not
  rejected) + `npm test` green.

### Wave 1 — parallel, disjoint repos
- **W1-A — Boxing collider variant + reimport gate (`aerobeat-web-content-authoring`,
  `aerobeat-web-content`, gate surface in `aerobeat-web-assembly` W2):**
  converter emits `boxing_collider_v1` (single variant, recipeId null, beats = the boxing
  conversion with `spatialTarget` — same beat set the Lanes/Grid conversions carry) for NEW
  imports and STOPS emitting the Lanes/Grid pair for new imports (design doc line 110: the only
  newly-created boxing variant). Existing packages keep their stored Lanes/Grid variants readable;
  when Boxing is selected on a package lacking a collider variant the assembly surfaces a bounded
  `boxing_collider_reimport_required` reimport gate (info box + clear stale selection — the
  `FLOW_REIMPORT_MESSAGES`/`flowReimportReason` precedent, index.js:67-69,2338) instead of the
  generic throw. Oracles: new-import variant list contains exactly one boxing variant
  (`boxing_collider_v1`, recipeId null) and no Lanes/Grid; a legacy (pre-collider) package's
  stored Lanes/Grid variants still play; selecting Boxing on a legacy package raises the
  reimport gate, not a generic error; fresh score partition local-only/unranked.
- **W1-B — Hazard contact state (`aerobeat-web-gameplay`):** bounded `hazardContact` snapshot
  field `{active:boolean, sinceMs:number|null, releasedAtMs:number|null}` from the existing
  `occupiedObstacleIds`/contact-interval tracking (flow_colliders_v1; presentation-only, no new
  public coordinates). `sinceMs` = first contact of the current episode while active;
  `releasedAtMs` = timeline ms of the most recent exit (so the renderer can compute a
  STATELESS decay: the release-moment pulse phase is a pure function of (sinceMs, releasedAtMs,
  params)); cleared on pause/reset/seek. Cover the boxing squat/weave nose-tracking path too if
  it shares the same occupied-id tracking (verify in code; otherwise flow-only + note).
  Coordinator unit oracles: enter/exit transitions, sinceMs = first contact, multi-obstacle,
  pause/reset clear, releasedAtMs monotone across episodes.
- **W1-C — Renderer (`aerobeat-web-renderer`):**
  (1) `colliderOverlayObjects` anchors at the target's current `(x,y,z)` (+ small camera-side
  offset; depth-test off, existing overlay layer + high render order) for square, cone, and
  target-point cube;
  (2) `updateSceneObjects` skips `hazard_glow` (no red cube);
  (3) state-driven pulsing vignette: `frame.hazardContactActive {active,sinceMs,releasedAtMs}` →
  intensity as a PURE function of (nowMs, sinceMs, releasedAtMs, params): active →
  `I0 · rampIn(min(elapsed/rampMs,1)) · (1 − depth·(1+sin(2π·Hz·(elapsed−rampMs)))/2)` (pulse
  phase only after the ramp); recently released → `I0 · rampIn·pulse(at releasedAtMs) ·
  max(0,1−(now−releasedAtMs)/decayMs)` (the release-moment pulse phase is recomputable from
  sinceMs+releasedAtMs — no retained state); MAX-blend with the `hazardContacts` bomb-flash
  envelope on the existing quad; tuning-block constants for the five parameters (frame-absent →
  defaults, backward compatible).
  Oracles: overlay tracks the beat across sampled z (pixel + unit), red-cube-absent oracle
  (scene center baseline while vignette active), pulse bounds/decay/idle oracles.
- **W1-D — Wasm console suppression (`aerobeat-web-vendor-mediapipe`):** bounded console filter
  installed around/for the MoveNet landmarker (drops the exact MediaPipe internal signatures —
  OpenGL error checking disabled, XNNPACK delegate, feedback-manager single-signature, NORM_RECT —
  via a frozen signature list, all other console output untouched, single global install) +
  `IMAGE_DIMENSIONS` passed to the landmarker options (kills NORM_RECT at source). Oracle:
  browser harness logs zero non-filtered vision_wasm lines during a real inference run.
- **W1-E — Button border (`aerobeat-web-ui`):** `.session-actions button` neutral border
  (e.g. `rgba(16,52,71,.28)`) in the embedded presenter style so no teal border remains.

### Wave 2 — Assembly (`aerobeat-web-assembly`, after W1)
- W2-A (item 2): `debugCameraSnapshot()` state allowlist → `["playing","paused_manual","completed"]`
  (no reset on pause). Oracle: paused visual-test frame still accepts movement intents + pose
  unchanged across pause/resume.
- W2-B (item 6): `projectAftermathEntries` — synthesize Test-mode hit entries from projected
  `targets` where `feedback.judgement==="hit"` (commit = `beatCenterMs`; dedupe against real
  judgements) + remove the 950 ms time-drop for the live-7 (persist until evicted; evicted fade
  tail retained). Oracles: synthetic-hit Test frame → slice entries; Play real-hit frame →
  entries (3-part evidence); eviction-at-8 with persistence before eviction.
- W2-C (item 9): wire `frame.hazardContactActive` from the W1-B snapshot; push the five vignette
  parameters from Game Setup (live per-frame, via `rendererFrame()`); drawer: five new number
  fields in the Game Setup section (live, bounded, defaults per scope item 9d);
  `game-setup-coordinator` snapshot carries the fields via W0.
- W2-D (items 1+5): remove `.start-action` teal background (transparent/inherit on the
  `#f3f8fa` drawer surface) + delete the `game-setup-note` line (index.js:2060).
- W2-E: re-pin W0/W1 commits; update version-literal oracles (`0.0.54`), shell-matrix,
  game-setup-coordinator, real-3c9d-trajectory, product-shell, mobile-gameplay-menu oracles for
  the drawer changes; re-pin + run the full assembly gate sweep.
- Gate: `npm run check` + `test:unit` + `test:browser` exit 0.

### Wave 3 — 0.0.54 pipeline
- W3-A: independent combined package QA (all touched repos green + gate sweep).
- W3-B: source stage (exact-once `version:patch` 0.0.53→0.0.54 + provenance-oracle repair).
- W3-C: fingerprint-bound hardware ABCCBA (real RTX 3080, headed, real webcam).
- W3-D: final source audit + exactly one immutable `build-release` 0.0.54 + independent
  immutable audit.
- W3-E: serving switch (collect current 5173 job, serve raw 0.0.54) + shadow-aware smoke +
  hand link to Derrick.

## Decisions (Derrick, 2026-09-15 — CONFIRMED)

1. **Boxing on existing packages: REIMPORT GATE.** New imports emit the `boxing_collider_v1`
   variant (the only newly-created boxing variant; Lanes/Grid pair stops for new imports).
   Existing packages that lack a collider variant surface a bounded
   `boxing_collider_reimport_required` gate when Boxing is selected (info box + clear stale
   selection, the `flowReimportReason` precedent) — the user reimports to get the collider
   variant. No chart synthesis. (Derrick's choice over the synthesis recommendation.)
2. **Vignette: AS SPECCED.** Pulse while inside; five variables EXPOSED live in Game Setup
   (defaults: intensity 0.6, pulse 2 Hz, pulse depth 0.35, ramp 150 ms, decay 400 ms); lock-in +
   hide in a later release (931s pattern).
3. **Aftermath in Test Mode: YES, full aftermath.** Synthetic GREAT outcomes produce the same
   slice/punch aftermath as real Play hits (design already said "aftermath shows in Test and
   Play").

## Standing constraints

- Raw 0.0.24–0.0.53 remain immutable. Exactly-one-build discipline. Tailnet-only serving
  (hostname SNI, no Funnel). No product-code changes for test-harness fixes. Product-bug claims
  require 3-part proof. The goal stays open until Derrick's explicit physical PASS.

## Results

- **W1-B Gameplay COMPLETE (parent-verified, `425358d`):** `aerobeat-web-gameplay` — `hazardContact: {active, sinceMs, releasedAtMs}` frozen in the session snapshot (`session-coordinator.js:1125`), gated `flow_colliders_v1` + play purpose; `sinceMs` set ONLY on a true empty→occupied transition (episode start — parent verified the guard at `processObstacleBoundaries`: `occupiedObstacleIds.size === 0 && entrants.length > 0`, so continuous occupation across obstacle replacement does NOT restart the pulse), `releasedAtMs` on empty transitions at BOTH the boundary processor and the `finalizeObstacles` interval-end safety net; cleared on lease-loss/reset/stop/destroy. Two real latent bugs found+fixed in-lane: stale `sinceMs` after interval-end removal, and `stop()` missing the collision-history clear. Boxing squat/weave is a separate instantaneous checkpoint path (never touches `occupiedObstacleIds`) → FLOW-ONLY, documented in README. 7 new unit oracles (enter/exit exact ms, replacement continuity, pause clear, non-flow + visual_test inactive, stop clear, hostile evidence). `npm test` + `test:browser` exit 0 (parent re-ran). Bead `q7e6` closed.
- **W1-D vendor-mediapipe COMPLETE (parent-verified, `1ecc4b8`):** `aerobeat-web-vendor-mediapipe` only (both `detectForVideo` sites live in this repo: `mediapipe-adapter.js` main-thread + `mediapipe-worker.js` classic worker). New `src/wasm-console-filter.js` — idempotent global install wrapping console.log/info/warn/error, drops EXACTLY the 4 frozen MediaPipe signatures (OpenGL error checking / XNNPACK delegate / feedback-manager single-signature / NORM_RECT), everything else passes with identical args; self-contained mirror installed at worker top-level (no ESM imports in classic workers). `IMAGE_DIMENSIONS {height,width}` passed to `detectForVideo` when frame dims are readable (call shape byte-identical otherwise). **Documented technical finding (parent accepted):** pinned `tasks-vision@1.0.1`'s `ImageProcessingOptions` types only `regionOfInterest`+`rotationDegrees` and the runtime (`Qu()` pipeline) does not surface `IMAGE_DIMENSIONS` to the wasm graph — so the filter is the effective backstop for all four lines (the plan's defense-in-depth framing); the annotation becomes a real fix automatically if a later pin types the key. Zero-lines-on-real-inference proof is deferred to the W3-C hardware ABCCBA (browser smoke is mock-only by README design). `npm run check` + `npm test` + `npm run test:browser` exit 0 (parent re-ran). Bead `zm6a` closed.
- **W0 Contracts COMPLETE (parent-verified, `57b1196`):** `aerobeat-web-contracts` — `aeroGameSetupHazardVignetteFields` (frozen 5-key list) + `aeroHazardVignetteBounds` (exact bounds/defaults table 0–1/0.6, 0–5/2, 0–1/0.35, 0–1000/150, 0–3000/400) + `isGameSetupHazardVignetteFields` (exact-own-keys guard) + `normalizeGameSetupHazardVignetteFields` (missing→defaults, out-of-bounds/non-number→reject, unknown legacy keys dropped, null-proto safe, frozen) + `AeroHazardVignetteSetup` typedef + `AeroGameSetupSnapshotV3` typedef updated. Full oracle set in `validate-game-contracts.js`. Legitimate deviation (parent confirmed): no whole-snapshot `normalizeGameSetup` exists in this repo — the 0.0.53 per-field normalizer pattern was followed; the assembly `game-setup-coordinator` consumes the exported normalizer in W2-C. `npm test` exit 0 (parent re-ran). Bead `f8c0` closed.
- **W1-E web-ui COMPLETE (parent-verified, `5eba64b`):** `aerobeat-web-ui` — `.session-actions button` embedded style now carries `border:1px solid rgba(16,52,71,.28)` (neutral ink-gray, overrides the global teal `rgba(53,141,175,.5)`); active-state blue rule + `sharedStyles` untouched (parent re-ran the diff check). `npm test` exit 0 (parent re-ran). Bead `2rze` closed. The `.start-action{background:#00566b}` gap-band lands in W2-D (assembly).
