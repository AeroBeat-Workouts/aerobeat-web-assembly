# AeroBeat 0.0.55 — Flow/Boxing Playtest Bug-Fix + E2E Visual-Proof Successor

**Status:** PLANNED (diagnosis complete by code analysis + unit confirmation; pending Derrick approval to execute)
**Owner:** Derrick (AeroBeat)
**Orchestrator:** Cookie
**Owning repo:** `aerobeat-web-assembly` (plan owner) + polyrepo waves
**Branch:** `main` (all repos)
**Date:** 2026-09-15
**Predecessor:** 0.0.54 (raw `ef079df` served; Boxing confirmed fundamentally working, Start|Test buttons + console noise + red-cube confirmed fixed by Derrick)

## Goal

Land the 0.0.55 successor fixing the 6 playtest bugs from Derrick's 0.0.54 retest, and — per Derrick's core insight (*"code tests != e2e visual proof"*) — **add a real end-to-end visual-proof browser harness** that drives a genuine session headlessly and asserts the visual behaviors actually fire (scene-model objects + rendered pixels), so these integration-shape regressions cannot recur undetected by unit oracles. Culminate in a physical playtest PASS.

## Derrick's 0.0.54 playtest verdict (2026-09-15)

Confirmed FIXED (no action): Boxing fundamentally works / is on its way to being fun; Start|Test buttons; console noise; the center-of-playfield red cube (my W1-C `hazard_glow` skip worked).

Six bugs to fix (Derrick's words, mapped):

| # | Bug (Derrick's words) | Root cause (parent-confirmed by code) |
|---|---|---|
| 6 | **Vignette fires only on exit, not during collision** | `normalizedHazardContactState` (assembly `src/index.js`) requires `undefined` for absent fields, but the gameplay snapshot emits `null` → returns `null` for every real shape → `frame.hazardContactActive` **always omitted** → the during-collision state-driven vignette never fires; only the event-based (exit) `hazardContacts` vignette fires. **CONFIRMED by unit repro** (all three real shapes → `null`). No unit test covered this function. |
| 5 | **Aftermath (Flow slice / Boxing bounce) does not fire, in Test or Play** | Test-mode aftermath derives from ephemeral projected `targets` (only present during the 350 ms feedback window) → a stateless re-derivation can't persist the 7-beat FIFO. Play-mode uses persistent `gameplay.judgements` (data path should work — needs e2e confirmation). |
| 1–4 | **Tolerance triangle + point + collider don't follow the note** (disconnected from the point; don't move with the bounce up/down; triangle "shoots forward / re-aligns" on a miss; don't follow the sky-prelude note until it "snaps" into position on landing) | The overlay (`colliderOverlayObjects`) anchors at base `targetPositions` (no bounce/sky Y offset) + `targetZForOverlay`, while the note icon renders at base + `totalOffset` (bounce+sky Y) with state-dependent Z. The overlay must anchor at the **icon's actual rendered position**. |

Derrick: *"Let's look into these bug reports and figure out what's going on, you likely need new 'real' tests for some of these visual things otherwise you can't prove they're firing off (code tests != e2e visual proof)."*

## Diagnosis evidence (parent, read-only — 2026-09-15)

- **Vignette:** unit repro of `normalizedHazardContactState` with the three real snapshot shapes (`{active:true,sinceMs:1200,releasedAtMs:null}`, `{active:false,sinceMs:null,releasedAtMs:3400}`, `{active:false,sinceMs:null,releasedAtMs:null}`) returns `null, null, null`. The renderer (`gameplay-scene-model.js:148`) computes `stateGlow = hazardWallContactIntensity(nowMs, frame.hazardContactActive, …)` only when the field is present; omitted → 0. The event path (`bombGlow` from `frame.hazardContacts`, line 144) still fires on wall **exit** — matching the observed exit-only vignette.
- **Aftermath (Test):** `rendererFrame()` (`index.js:1259,1262`) passes `targets = projectSessionTargets(…)` (visible-only: `pendingVisible || feedbackActive`, `FEEDBACK_DURATION_MS=350`) to `projectAftermathEntries`. A synthetic hit target is in `targets` only 350 ms after commit, then is culled → the stateless aftermath FIFO loses it. Play path (`gameplay.judgements`, persistent, `session-coordinator.js:1067`) is data-complete but unverified end-to-end.
- **Overlay:** `colliderOverlayObjects` (`gameplay-scene-model.js`) anchors at `targetPositions` (base X/Y, no offset) + `targetZForOverlay` (state Z). The icon (`:254-256,264,275`) renders at Y = base + `totalOffset` (bounce+sky) and state Z. Mismatch = the overlay lags the note's vertical bounce/sky motion.

## Scope (0.0.55)

1. **E2E visual-proof harness (NEW, the key deliverable):** a Playwright browser oracle (modelled on `scripts/validate-real-3c9d-trajectory-controls.js`) that drives a **real** session headlessly against the real 3C9D Flow fixture + a real Boxing collider package, seeks to exact timeline positions, and asserts the visual behaviors **actually fire** by reading (a) the live `rendererFrame()` fields (`aftermath`, `hazardContactActive`, `targets`), (b) the scene-model `objects` (`aftermath`/`hazard_glow`/`tolerance_cone`/`collider_square` presence + positions), and (c) rendered canvas **pixels**. This becomes a standing `test:browser` oracle so integration-shape regressions are caught by real rendering, not unit oracles alone.
2. **Fix vignette (bug 6):** make `normalizedHazardContactState` accept `null` (and `undefined`) as "absent" in both branches (active: `sinceMs` finite ≥0, `releasedAtMs` null/undefined; inactive: `sinceMs` null/undefined, `releasedAtMs` null or finite ≥0). Add a unit test covering the three real snapshot shapes. Prove via the e2e harness that the during-collision vignette fires (state-driven) and the exit decay is continuous.
3. **Fix aftermath persistence (bug 5):** make the aftermath FIFO persistent across frames so settled pieces persist until evicted by the 8th hit (7-live cap) — for **both** Play (real judgements) and Test (synthetic hits). Add a persistent assembly-owned aftermath buffer (cleared on session restart/seek/song change) fed by real hit judgements (Play) and synthetic hit commits (Test). Prove via the e2e harness that aftermath objects persist across frames after a hit in Test mode (and the pixel proof).
4. **Fix overlay tracking (bugs 1–4):** anchor the tolerance cone + target point + collider square at the **note icon's actual rendered position** (base + bounce/sky Y offset + state Z), so they ride the note through bounce, sky prelude, and miss. Prove via the e2e harness that overlay positions match icon positions at bounce apex, sky-prelude, and miss moments.

## Waves (coder→QA→auditor; parallel only on disjoint repos)

- **W0 — E2E visual-proof harness (`aerobeat-web-assembly`, test-only):** build `scripts/validate-0.0.55-visual-proof.js` (Playwright, real 3C9D Flow + real Boxing collider package, seek-driven, asserts `rendererFrame()` fields + scene-model objects + canvas pixels). Wire into `test:browser`. This oracle is written against the **correct** expected behavior (so it fails on the current buggy code and passes after the fixes). Test-only: no product code changes.
- **W1 — Vignette fix (`aerobeat-web-assembly`, product):** `normalizedHazardContactState` null-tolerance + unit test. Disjoint from W2/W3 (different functions/files).
- **W2 — Aftermath persistence (`aerobeat-web-assembly`, product):** persistent aftermath buffer (Play real-judgement + Test synthetic-feed), cleared on restart/seek/song-change. Disjoint from W1/W3.
- **W3 — Overlay tracking (`aerobeat-web-renderer`, product):** anchor overlay at the icon's rendered position (bounce/sky Y + state Z) — shared position source with the icon. Disjoint repo from W1/W2.
- **W4 — Integrate + prove:** re-run the W0 e2e harness (must now pass on all three fixes), full per-repo gates, re-pin the renderer commit into the assembly, combined package QA, source stage (0.0.54→0.0.55), fingerprint-bound ABCCBA, exactly-one build, serving switch, physical retest.

(Sequencing note: W1/W2 (assembly) and W3 (renderer) are disjoint repos and can run in parallel; W0 (assembly test-only) is also disjoint from W1/W2 product code but shares the assembly repo, so sequence W0 first or run it in a separate worktree. W4 integrates.)

## Standing constraints

- Raw 0.0.24–0.0.54 remain immutable. Exactly-one-build discipline. Tailnet-only serving (hostname SNI, no Funnel). **E2E harness is test-only — no product-code changes for test-harness fixes.** Product-bug claims require 3-part proof. The goal stays open until Derrick's explicit physical PASS.

## Open questions for Derrick (before W4 build)

- (Resolved by design) The e2e harness asserts the **correct** behavior; the three fixes are the product changes. No product behavior is changed beyond the three bug fixes.

## Results

- **W1 Vignette fix (assembly `2e9cce1`)** — `normalizedHazardContactState` null-tolerance: accepts `null` and `undefined` as absent in both branches; the during-collision state-driven vignette now fires. Bead `n92b` closed.
- **W2 Aftermath persistence (assembly `2e9cce1`)** — `projectAftermathEntries` derives Test-mode committed hits from the render event index (deterministic, session-scoped, NOT the ephemeral projection), so a committed hit persists across frames; live-7 cap is the only cleanup. Bead `jf4z` closed.
- **W3 Overlay tracking (renderer `85d7a8d`)** — new `iconRenderPosition` shared helper anchors the icon AND the tolerance cone / collider square / target-point overlays at the note's rendered position (base X/Y + bounce/sky Y + state Z); overlays ride the note through bounce, sky prelude, miss. Bead `6my4` closed.
- **W0 E2E visual-proof harness (assembly `6bcd622`)** — NEW `scripts/validate-0.0.55-visual-proof.js` (Playwright, real 3C9D Flow session, seek-driven) asserts the 3 fixes' visual behaviors actually fire (rendererFrame fields + scene-model objects + canvas pixels). Wired into `test:browser`. **This harness caught 2 integration-shape bugs the unit oracles missed** (Derrick's insight: "code tests ≠ e2e visual proof"):
  - **Bug 1a (assembly `b9b173d`):** the W1 null-tolerance fix emitted the fully-idle shape `{active:false, sinceMs:null, releasedAtMs:null}`, which the renderer's `isValidHazardContactActive` rejects → ALL browser tests that render the live frame threw. Fixed: `rendererFrame()` now omits `hazardContactActive` when the state is fully idle. (Renderer validator confirmed correct as-is — no renderer change needed.)
  - **Bug 2 (assembly `b9b173d`):** `aftermathMappingForEvent` checked `event.type`, but real resolved events only carry `authoredBeat.type` (no top-level `type`) → ZERO Test-mode aftermath on any real session. Fixed: fall back to `event.authoredBeat?.type`.
  - **W2 follow-up regression (renderer `ae4a67a`, assembly re-pin `5f6b98f`):** the W2 aftermath-persistence fix put the hit target in `frame.aftermath` from commit time, which the renderer's `aftermathHandoff` logic used to hide the hit icon at commit (breaking `validate-visual-correction-integration.js` "hit remains visible through exact 79 ms"). Fixed: gate the hit-state handoff on `removal.progress >= 1` so the icon stays visible through its 80 ms removal fade, then hands off to the aftermath pieces.
- **Combined package QA (parent, 2026-09-15)** — all 8 repos green: assembly (test:unit 0, check 0, test:browser 0 incl. visual-correction + 0.0.55-visual-proof e2e harness), renderer (check 0, test:browser 0), contracts/gameplay/content/content-authoring/ui/vendor-mediapipe (npm test 0 each). Bead `mzwt` (W4) in progress.
- **W4 Pipeline (in progress):** source stage 0.0.54→0.0.55 → fingerprint-bound ABCCBA → exactly-one build → serving switch. (pending)
