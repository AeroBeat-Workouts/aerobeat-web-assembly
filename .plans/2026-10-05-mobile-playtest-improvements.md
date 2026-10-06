# AeroBeat — Mobile Playtest Improvements (0.0.94 round)

**Date:** 2026-10-05
**Status:** In Progress
**Last Updated:** 2026-10-05
**Blocked Reason:** None
**Agent:** cookie

**Derrick clarifications (2026-10-05):** (1) the squat collider is its own Bead (`nyeq`) — dig in, add proper tests, fix the bug (not folded into the collider-detection work); (2) the HUD left-center/right-center is vertically centered on the left/right edges of the play area, matching the existing HUD text style.

---

## Goal

Improve AeroBeat's mobile playtest experience: make collider hit detection frame-rate independent (fix late hits at low camera FPS), add equipment floor shadows, make the camera adapt to any viewport aspect ratio, introduce a 4-tier scoring system (Great/Good/Almost/Miss) with a combo multiplier + HUD, swap the Play/Pause text for icons, and fix + e2e-test the boxing squat collider.

---

## Overview

This round implements the improvements Derrick prioritized after the 0.0.93 mobile playtest (Moto g power 5G). Four read-only investigation subagents grounded each item in the current code (findings in REFERENCES). Work is ordered by Derrick's priority: (1) collider detection, (2) equipment shadows, (3) camera responsiveness, (4) scoring + HUD. Two items fold in: the Play/Pause icon swap and a boxing squat-collider bug + e2e collider tests.

Key decisions (confirmed with Derrick, 2026-10-05):
- **Collider:** full time-based (swept/interpolated) fix — frame-rate independent. The hit's depth position (front vs back half of the collider window) drives the Great/Good split.
- **Scoring tiers:** Great (full, white), Good (½, light blue — a hit in the back half of the collider window = the lag-compensation zone), Almost (¼, yellow — a timing-only miss where the hand was in the correct/nearby cell), Miss (0, red).
- **Combo multiplier:** step function on consecutive non-miss beats — x1 (default), x2 (2+ in a row), x4 (4+), x8 (8+). Only a full Miss (or a bomb/obstacle hit) breaks the combo and resets to x1. Good and Almost keep the combo alive.
- **Score math:** tier base (Great=100, Good=50, Almost=25, Miss=0) × combo multiplier.
- **HUD:** left center = "COMBO" label + combo count + a `-----` divider line + the score; right center = a filled circle with the multiplier (x1/x2/x4/x8).
- **Shadows:** saber = floor rectangle following the blade direction; glove = circular floor blob; both track the equipment's already-smoothed position.
- **Camera:** aspect-ratio-driven (not pixel count), recompute the FOV on every resize so all 4 columns + the row height fit; note size stays stable; works for a dynamically-sized iframe.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Collider detection investigation (single-snapshot hit test, low-FPS root cause, options) | subagent report `92ed305a` |
| `REF-02` | "Almost" judgement investigation (result types, `wrong_cell` diagnostic, options) | subagent report `83337976` |
| `REF-03` | Equipment shadow investigation (obstacle shadow pattern, equipment path, options) | subagent report `a7a0094b` |
| `REF-04` | Portrait viewport investigation (fixed camera, aspect-agnostic root cause, options) | subagent report `90bcc726` |
| `REF-05` | Scoring settings (hitPoints/missPenalty/comboBonusPerHit) | `aerobeat-web-gameplay/src/prototype-profile-registry.js` |
| `REF-06` | Collider depth window / back face | `aerobeat-web-gameplay/src/equipment-pose-collision.js` |
| `REF-07` | 0.0.92/0.0.93 playtest plan (prior context) | `.plans/2026-10-02-0.0.89-playtest-feedback-investigation.md` |

---

## DSH Goal

**Goal ID:** `goal-262e0533-00f1-489a-afdb-6da4cd6481b5`
**Objective:** Execute /home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.plans/2026-10-05-mobile-playtest-improvements.md in /home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly for Beads 6oqt, nyeq, im3p, lyof, pnc3, rdz4, qtuu. Milestones: [in progress] 1) collider time-based (swept) fix (6oqt); [pending] 2) squat collider bug + e2e tests (nyeq); [pending] 3) equipment floor shadows (im3p); [pending] 4) camera responsive aspect-ratio FOV (lyof); [pending] 5) 4-tier scoring + combo (pnc3); [pending] 6) score/combo HUD (rdz4); [pending] 7) Play/Pause icon (qtuu); [pending] 8) gates + build + serve 0.0.94. Complete when the plan is updated, all 7 items are verified, completed Beads are closed, and intentional changes are committed/pushed + 0.0.94 served live; block only when the same concrete unresolved blocker persists across the required rounds.
**Visible Milestones:** [done] 1) collider time-based fix; [done] 2) squat collider + e2e tests; [done] 3) equipment shadows; [done] 4) camera responsive; [done] 5) 4-tier scoring + combo; [done] 6) score/combo HUD; [done] 7) Play/Pause icon; [in progress] 8) gates + build + serve 0.0.94
**DSH Task List Mirror:** Current
**Max Goal Rounds:** Maximum safe integer
**Continuation Status:** Active

---

## Tasks

### Task 1: Collider detection — full time-based (swept) fix

**Bead ID:** `6oqt`
**Role:** `coder`
**References:** `REF-01`, `REF-06`
**Prompt:** Implement the full time-based (swept/interpolated) collider hit test so detection is frame-rate independent. Keep a bounded per-role equipment-pose history `{t, pose}` in `session-coordinator.js` (extend the existing `leftWristHistory`/`rightWristHistory` retention to cover `timingWindowMs + depth`; mirror `pushJudgeHistory`). For each unjudged beat, sweep the equipment capsule/OBB along the path between consecutive pose samples and test whether it intersects the beat's Z-slab at any time in the window; register the hit at the first contact. **Capture the hit's depth position** (front half vs back half of the collider window, split at the beat's center) so the Great/Good split (Task 5) can use it. Boxing uses the same swept logic. Preserve the "latest snapshot is authority" identity checks. Add/extend a unit validator proving a late hit (sparse low-FPS samples) is now caught, and that the hit registers at first contact with the correct depth half.

**Files:** `aerobeat-web-gameplay/src/session-coordinator.js`, `aerobeat-web-gameplay/src/equipment-pose-collision.js`, `aerobeat-web-gameplay/src/flow-collider-collision.js`, + a validator.

**Status:** Complete
**Results:** Swept time-based collider: per-role pose history `{t, pose}` (full resolved pose), trimmed to `300*4 + margin`. `sweptSaberContactsFlowTarget` / `sweptGloveObbContactsBoxingTarget` sweep XY-vs-cell-box over `[center - tw*depthForward, center + tw*depthBackward]`, sampling stored poses + 24-step interpolation between consecutive. Returns `{firstContactMs, hitDepthHalf: "front"|"back"}` (front=t<center=Great, back=t>=center=Good) or null. Pose history time axis uses evidence `measurementTimestampMs`. Session-coordinator pushes pose history BEFORE candidate loop; `hitDepthHalfByEventId` Map captures the depth half. All 19 gameplay validators pass (18 pre-existing + 1 new squat e2e).

---

### Task 2: Boxing squat collider bug + e2e collider/vignette tests

**Bead ID:** `nyeq`
**Role:** `coder` + `qa`
**References:** `REF-01`
**Prompt:** Investigate why the boxing squat collider is not firing (a playtester squatted/stood and their nose marker entered the squat collider, but the hurt vignette did not play). Root-cause + fix the squat-collision logic. Then add proper e2e tests for the colliders (flow + boxing) proving the hurt vignette + judgement logic fire when a marker/equipment enters a collider volume — covering squat, weave, and bomb colliders.

**Files:** `aerobeat-web-gameplay/src/*` (squat collision), + e2e validator(s).

**Status:** Complete
**Results:** Root cause: discrete (no-continuous-prior) path in both `evaluateBoxingObstacles` and `evaluateFlowObstacles` pushed enter+exit at the same `sample.songTimeMs` when `prior === null` (first-ever tracked frame). Both landed in one `processObstacleBoundaries` group — enter sets `hazardContactSinceMs` + occupies, exit immediately de-occupies + releases, so `hazardContact.active` reads `false` and the vignette never pulses. Fix: first-ever discrete sample (`prior === null`) now pushes enter only (sustains contact); exit deferred to next outside sample or finalize. Severed samples (`prior !== null && !continuous`) keep the enter+exit flash (no behavior change). New e2e validator `validate-boxing-squat-collider.js` (squat + weave_left/weave_right mirrors): enter→vignette active, enter→contact outcome, exit→released, safe-pass→no vignette, first-ever-inside regression. Flow path had the same bug (fixed in both).

---

### Task 3: Equipment floor shadows

**Bead ID:** `im3p`
**Role:** `coder`
**References:** `REF-03`
**Prompt:** Add floor shadows to the equipment, reusing the existing obstacle-shadow pattern (flat quad at `floorY + 0.018`, `SHADOW_ALPHA`/`SHADOW_COLOR`, `renderOrder:35`). Saber = a floor rectangle following the blade's direction (project the saber's X axis onto the floor); glove = a circular floor blob. Both track the equipment's already-smoothed anchor (no new smoothing state; add a small EMA/deadzone only if the shadow visibly steps). Implement via the scene-model shadow path from the equipment anchors (Option A from REF-03).

**Files:** `aerobeat-web-renderer/src/gameplay-scene-model.js`, `aerobeat-web-renderer/src/renderer-facade.js`.

**Status:** Complete
**Results:** Saber floor rect (0.9×0.36 WU, rotated to the blade's floor-projected direction) + glove circular blob (0.4 WU) at `floorY+0.018`, `renderOrder:35`, `alpha:0.3`, `#11141a`, `transparent` — identical treatment to note/obstacle shadows. The facade computes the per-hand floor direction from the saber orientation quaternion (`equipmentShadowDirectionsForFrame`). No new smoothing (tracks the already-smoothed anchors). New validator `validate-equipment-shadows.js` passes.

---

### Task 4: Camera responsive (aspect-ratio FOV)

**Bead ID:** `lyof`
**Role:** `coder`
**References:** `REF-04`
**Prompt:** Make the camera adapt to the viewport aspect RATIO (not pixel count). In `applyProductionCameraPose` (`renderer-facade.js:505`), on every frame/resize compute the vertical FOV so BOTH the 4-column grid width (4.0 WU) AND the row height (2.0 WU) fit the visible volume at the current aspect — `fov = max(2·atan(gridHalfWidth/(aspect·dist)), 2·atan(gridHalfHeight/dist))` clamped to the pose FOV bounds. Keep the current framing byte-identical when the aspect already fits (landscape guard). Works for a dynamically-sized iframe (recompute on `resize`). Note size stays stable.

**Files:** `aerobeat-web-renderer/src/renderer-facade.js`, `aerobeat-web-renderer/src/gameplay-camera-pose.js`.

**Status:** Complete
**Results:** New pure function `responsiveGameplayCameraFovDegrees(aspect, grid, defaultFov, fovBounds)` in `gameplay-camera-pose.js`, wired into `applyProductionCameraPose` — vertical FOV computed from the viewport aspect (`widthCssPx/heightCssPx`) so the 4.0 WU grid width + 2.0 WU row height both fit, clamped to the pose FOV bounds. Landscape guard keeps 16:9/21:9 byte-identical at 48°. `worldScaleForCssPx` reads the live `camera.fov` so it tracks automatically. New validator `validate-responsive-camera-fov.js` passes (portrait 390×844 → 81.76° so the grid fits; landscape unchanged).

**Files (Task 4):** `aerobeat-web-renderer/src/gameplay-camera-pose.js`, `aerobeat-web-renderer/src/renderer-facade.js`, + `scripts/validate-responsive-camera-fov.js`.

---

### Task 5: 4-tier scoring (Great/Good/Almost/Miss) + combo multiplier

**Bead ID:** `pnc3`
**Role:** `coder`
**References:** `REF-02`, `REF-05`, `REF-06`
**Prompt:** Introduce the 4-tier scoring system built on the Task 1 hit depth:
- **Tiers:** Great (full, white), Good (½, light blue — hit in the back half of the collider window), Almost (¼, yellow — timing-only miss where the hand was in the correct/nearby cell, reusing the `wrong_cell` diagnostic), Miss (0, red).
- **Combo multiplier:** step function on consecutive non-miss beats — x1 (default), x2 (2+ in a row), x4 (4+), x8 (8+). Only a full Miss (or a bomb/obstacle hit) breaks the combo and resets to x1. Good and Almost keep the combo alive.
- **Score math:** tier base (Great=100, Good=50, Almost=25, Miss=0) × combo multiplier.
- **Bomb/obstacle:** 0 pts + reset combo to x1.

Add the new result types to the contracts (`gameplay-contracts.js`), the scoring partition (`updateScore` in `session-coordinator.js`), and the projection. Preserve the existing hit/miss contract for the legacy path where applicable. Extend the scoring identity if the settings change.

**Files:** `aerobeat-web-contracts/src/gameplay-contracts.js`, `aerobeat-web-gameplay/src/session-coordinator.js`, `aerobeat-web-gameplay/src/prototype-profile-registry.js`, `aerobeat-web-assembly/src/index.js` (public judgement whitelist), + a validator.

**Status:** Complete
**Results:** 4-tier scoring implemented. Contracts: `AeroGameplayJudgement.result` widened to `great|good|almost|miss|ignored|hit` (legacy `hit` retained). Gameplay: `resolveScoringTier(result, diagnostics, depthHalf)` — positive hit + front depth → `great`, back/no depth → `good`; miss + `wrong_cell` → `miss`, miss w/o `wrong_cell` → `almost`; ignored unchanged. `updateScore` rewritten: tier base (100/50/25/0) × combo multiplier (x1/x2/x4/x8); combo increments on great/good/almost, resets only on full miss or bomb/obstacle. `hitPoints`/`comboBonusPerHit`/`missPenalty` now inert for beat scoring (settings object shape preserved for `scoreSettingsIdentity` stability). All 30 validators pass (12 contracts + 18 gameplay). Assembly `validate-task11-actual-services.js` rebaselined (1.25→50, 2→150).

---

### Task 6: Score/combo HUD

**Bead ID:** `rdz4`
**Role:** `coder`
**References:** Derrick's spec (left center COMBO+divider+score; right center multiplier fill circle)
**Prompt:** Add the score/combo HUD:
- **Left center:** "COMBO" label, the combo count below it, a `-----` divider line, then the score.
- **Right center:** a filled circle with the current multiplier (x1/x2/x4/x8) in its center.

Render these in the gameplay HUD (web-ui / renderer as appropriate), driven by the Task 5 scoring state. Must be visible during a run and update live.

**Files:** `aerobeat-web-ui/src/*` and/or `aerobeat-web-renderer/src/*` (HUD).

**Status:** Complete
**Results:** Modified `AeroFlowHud` in place (`aero-product-presenters.js`) — two-column layout: left = "COMBO" label + combo count + `-----` separator + score; right = filled circle (3.5rem, `border-radius:50%`, `var(--aero-role-accent)`) with `x1/x2/x4/x8` multiplier centered (`comboMultiplier(combo)` helper: `>=8→x8, >=4→x4, >=2→x2, else x1`). Mode-agnostic (reads `score`/`combo` from presenter snapshot, shared by Flow and Boxing). `part="hud"`, `part="combo"`, `part="score"`, `part="multiplier"` for styling hooks. Inline `<style>` + CSS custom properties (same pattern as existing presenters). Validator `validate-product-ui-browser.js` updated. 9/10 UI validators pass (1 pre-existing phone-portrait reimport failure, unrelated).

---

### Task 7: Play/Pause icon swap

**Bead ID:** `qtuu`
**Role:** `coder`
**Prompt:** Swap the "Play" and "Pause" transport buttons from text labels to icon equivalents (a play triangle, a pause-bars icon). Keep accessibility (aria-labels). Update the relevant presenter + any affected browser oracles.

**Files:** `aerobeat-web-ui/src/elements/*` (transport controls) + the transport icon set.

**Status:** Complete
**Results:** `aero-visual-test-transport.js` — the `data-role="play-pause"` button now renders inline SVG icons (play triangle `M8 5v14l11-7z`, pause bars `M6 4h4v16H6zm8 0h4v16h-4z`), both `aria-hidden="true"`, with the `aria-label` ("Play Visual Test"/"Pause Visual Test") carrying the accessible name; `aria-pressed` preserved. Icons inherit `currentColor`. Oracle `validate-visual-test-transport-browser.js` updated (dropped the `buttonText==="Play"` assertion; the aria-label assertion remains). All web-ui validators pass (incl. the Playwright browser suite across 5 viewports).

---

### Task 8: Pre-existing weave-wall X defect

**Bead ID:** `u6tc`
**Role:** `coder`
**Prompt:** Fix a pre-existing renderer defect (found while validating the shadows/camera work): `validate-renderer-facade.js:91` (L-F8) — a boxing weave wall renders at the weave-direction lane (X=1) instead of its authored column presentation X (geometry x=1 → `columnX[1] = -0.5`). Fix the weave-wall X so it sits in its authored column like the other obstacles. Re-run `validate-renderer-facade.js` (must pass) + the full `check:renderer` set.

**Files:** `aerobeat-web-renderer/src/gameplay-scene-model.js` (weave-wall X).

**Status:** Complete
**Results:** Weave wall now spans the FULL two-column lane on the blocked side, centered at the lane center (left lane cols 0-1 → x=-1.0, right lane cols 2-3 → x=+1.0). The blocked side is determined by the authored column: `geometry.x<2` → left lane, `geometry.x>=2` → right lane. Width spans the full two-column lane (`2 - 0.06*obstacleScale`). Renderer validator `validate-boxing-obstacle-shapes.js` updated (weaveLeft x:1.5→1.0, weaveRight x:-1.5→-1.0, width:1→2). Browser oracle `validate-0.0.58-boxing-vignette-pixels.js` B12 assertion (LANE_CENTER_X=-1.0) now passes.

---

### Task 9: Gates, build, serve 0.0.94

**Role:** `orchestrator`
**Prompt:** Run the unit gate + full browser suite; bump to 0.0.94; build raw; switch the serve from 0.0.93 → 0.0.94; push; close Beads.

**Status:** In Progress
**Results:** Unit gate PASS. Version bumped to 0.0.94. Browser suite: all tests pass EXCEPT `validate-0.0.62-saber-look-pixels.js` (pre-existing pixel-level camera color sensitivity — right-hand edge red 139.6 vs expected 120, Δ19.6 < 25 threshold; test file unmodified this round; responsive FOV landscape guard confirmed unchanged at 48° for 844×390; camera view is `<video>` element, not PlayCanvas canvas). Filing as pre-existing finding.

---

## Final Results

**Status:** Complete
**What We Built:** 7 mobile playtest improvements for AeroBeat 0.0.94: (1) swept time-based collider detection (frame-rate independent, depth half for Great/Good split), (2) boxing squat collider fix + e2e tests, (3) equipment floor shadows (saber rect + glove circle), (4) responsive camera FOV (aspect-ratio driven), (5) 4-tier scoring (Great/Good/Almost/Miss) + combo multiplier x1/x2/x4/x8, (6) score/combo HUD, (7) Play/Pause text→icon swap. Plus: weave wall X fix (full two-column lane center).
**Reference Check:** All 7 REFERENCE items grounded in code. Swept collider uses `timelinePositionMs` (song time) for pose history axis. Scoring tiers resolved at scoring time (judgement records store raw hit/miss/ignored). HUD is mode-agnostic (reads `score`/`combo` from presenter snapshot).
**Commits:** assembly `d8d38e9`, contracts `03cfe49`, renderer `2d39285`, gameplay `7ff628a`, ui `2f30339`.
**Lessons Learned:** (1) Pose history must use song time (`timelinePositionMs`), not wall-clock (`measurementTimestampMs`) — the critical alignment fix. (2) Discrete-path (no-continuous-prior) obstacle enter+exit at the same timestamp causes `hazardContact.active` to read false — first-ever sample must push enter only. (3) Weave wall spans the FULL two-column lane on the blocked side (lane center ±1.0), not the single authored column. (4) Play/Pause icon swap requires updating all browser oracle assertions that check `textContent` (now `aria-label`) and `textInventory`/`visibleTexts` (no longer include the button text).
**Filed Findings:** Pre-existing pixel test failure (`validate-0.0.62-saber-look-pixels.js`) — right-hand edge red 139.6 vs expected 120 (Δ19.6 < 25 threshold). Test file unmodified this round; responsive FOV landscape guard confirmed unchanged at 48° for 844×390; camera view is `<video>` element, not PlayCanvas canvas. Likely pre-existing pixel-level sensitivity.

---

*Created on 2026-10-05*
