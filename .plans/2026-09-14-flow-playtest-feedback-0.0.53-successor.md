# AeroBeat 0.0.53 — Flow Playtest Feedback Successor

**Status:** PLANNED (pending Derrick approval to execute)
**Owner:** Derrick (AeroBeat)
**Orchestrator:** Cookie
**Owning repo:** `aerobeat-web-assembly` (plan owner) + polyrepo waves
**Branch:** `main` (all repos)
**Date:** 2026-09-14

## Goal

Land the 0.0.53 successor that addresses Derrick's Flow playtest feedback on the immutable
raw 0.0.52: fix two product bugs (direction tolerance not enforced by default; obstacle
collision vignette not triggering), add two collider-visibility debug options, remove the
video fit feature, hide a set of Game Setup options, and polish the Start|Test buttons
(version label + background). Culminate in a physical playtest PASS from Derrick.

## Overview

0.0.52 is immutable (exactly-one-build discipline; raw 0.0.52 is the served physical-review
evidence). Derrick playtested Flow and filed 10 items. This plan decomposes them into a
4-wave polyrepo successor (contracts → gameplay → renderer → assembly) + the standard
0.0.53 pipeline (combined QA → source stage → ABCCBA → audits → one build → serving →
physical retest).

Investigations (read-only subagents) confirmed the two bugs:
- **Direction tolerance:** the angle math is correct and enforced, but only when the
  `enforceAuthoredDirection` master switch is ON. That flag defaults to `false` (overlap-only
  mode), and the "Direction tolerance (degrees)" field is disabled in the UI when the flag is
  off. So "notes hit from any direction" is the shipped default, not a math bug.
- **Obstacle collision vignette:** `projectHazardContactEvents` (assembly
  `gameplay-frame-effects.js`) reads obstacle contact from `obstacleOutcomes` and hazard
  contact from `hazardOutcomes` gated on `kind==="bomb"`. But on the active `flow_colliders_v1`
  ruleset the coordinator emits nose–obstacle wall contact into `hazardOutcomes` as
  `kind:"wall"` — which matches NEITHER branch, so `hazardContacts` stays empty and the
  vignette never appears. Bomb touches work (they match `kind:"bomb"`).

## REFERENCES

- Active 0.0.52 plan: `.plans/2026-09-02-handcrafted-3d-gameplay-visuals-and-environment.md`
- Immutable raw 0.0.52: `release/raw/0.0.52/` (served, physical-review evidence)
- Direction tolerance code:
  - `aerobeat-web-gameplay/src/session-coordinator.js:779` (Flow gate)
  - `aerobeat-web-gameplay/src/flow-collider-collision.js:120-130` (`matchesAuthoredDirection`)
  - `aerobeat-web-gameplay/src/flow-collider-collision.js:77-80` (`targetCenterForPlacement`)
  - `aerobeat-web-gameplay/src/flow-collider-collision.js:52,54-58,85,98` (DIRECTIONS, footprint)
  - `aerobeat-web-gameplay/src/boxing-collider-collision.js:284-289` (boxing mirror)
  - `aerobeat-web-assembly/src/index.js:2122,2137` (drawer: "Enforce authored direction" + disabled tolerance field)
  - `aerobeat-web-assembly/src/game-setup-coordinator.js:24` (default `enforceAuthoredDirection:false`)
- Hazard vignette code:
  - `aerobeat-web-assembly/src/gameplay-frame-effects.js:171-202` (`projectHazardContactEvents`)
  - `aerobeat-web-assembly/src/gameplay-frame-effects.js:194` (hazard loop `kind==="bomb"` gate)
  - `aerobeat-web-gameplay/src/session-coordinator.js:743-746` (wall contact → `hazardOutcomes` `kind:"wall"`)
  - `aerobeat-web-renderer/src/gameplay-scene-model.js:113-114,500-503` (hazard envelope + glow object)
  - `aerobeat-web-renderer/src/renderer-facade.js:286,320,330` (vignette quad + `applyHazardGlow`)
- Video fit code (to remove):
  - `aerobeat-web-contracts/src/gameplay-contracts.js:53,86,89,93,100,120` (videoFit field + constants)
  - `aerobeat-web-assembly/src/game-setup-coordinator.js:4,18,19,24,48-50,56,61,73` (state)
  - `aerobeat-web-assembly/src/index.js:51,121,1148,1277-1349,2122,2128,2130-2137` (drawer + `applyVideoFit`)
  - `aerobeat-web-assembly/src/video-fit-solver.js` (the solver module)
- Hide options (all in `aerobeat-web-assembly/src/index.js:2120-2137`):
  - Guidance bands: `:2123` (select), lock to `"target_arrivals"`
  - Spawn distance: `:2122` (checkbox) + `:2128` (number row)
  - Camera range: `:2128` (two number rows)
  - Bomb/Marker scale: `:2128` (two number rows)
  - "Enforce authored direction": `:2122` (checkbox)
- Start|Test buttons (in `aerobeat-web-ui/src/elements/aero-product-presenters.js`):
  - `:517-529` (`AeroSessionActions` + `renderMarkup`)
  - `:27-28` (global button background gradient — the "green/teal" source)
  - Assembly template: `aerobeat-web-assembly/src/index.js:2294` (drawer markup)
  - Version source: `aerobeat-web-assembly/src/release-metadata.js:22,35-41` (`appMetadata.packageVersion`)

## Scope (Derrick's 10 items)

1. **Direction tolerance not enforced** (BUG) → default `enforceAuthoredDirection: true`;
   hide the "Enforce authored direction" option; make the tolerance field always live.
2. **Collision vignette not triggering on obstacle contact** (BUG) → broaden
   `projectHazardContactEvents` to accept `kind:"wall"` (drive `atMs` from
   `committedTimelinePositionMs`).
3. **"Visible tolerance range" boolean option** (NEW) → render the target point + the entry
   cone (sector of half-angle `directionToleranceDegrees` around the authored direction).
4. **Collider radius visibility option** (NEW) → render the collider hit regions.
5. **Remove video fit** (REMOVE) → remove the option + sub-options + all logic.
6. **Hide Guidance bands** (HIDE) → lock to "Target-arrival bands".
7. **Hide Spawn distance + Override spawn distance** (HIDE).
8. **Hide Camera horizontal + vertical range** (HIDE).
9. **Hide Bomb scale + Marker scale** (HIDE).
10. **Hide Song version selector** (HIDE) — CONFIRMED: the `versionField` in
    `compactBeatSaverDetailMarkup` (`aerobeat-web-ui/src/elements/aero-product-presenters.js:902-903`),
    the "Version" dropdown/box between the Preview and Download buttons. Hide it (keep
    Preview + Download).
11. **Hide "Enforce Authored direction"** (HIDE) — now the default (item 1).
12. **Add version number above Start|Test buttons** (POLISH).
13. **Fix green background behind Start|Test buttons** (POLISH).

## Waves

### Wave 0 — Contracts (`aerobeat-web-contracts`)
- W0-A: Add the two new boolean Game Setup fields to `AeroGameSetupSnapshotV3`:
  - `visibleToleranceRange: boolean` (default `false`)
  - `visibleColliderRadius: boolean` (default `false`)
  - Forward-compat reader (missing → defaults), bounds/normalization, type guards, JSDoc.
- W0-B: Remove the videoFit field + constants (`aeroVideoFitReferences`, `aeroVideoFitBounds`,
  `defaultVideoFit`, `isVideoFitSetup`, `normalizeVideoFit`) from the contracts. Update the
  `AeroGameSetupSnapshotV3` typedef + `normalizeGameSetup` forward-compat (stored records with
  the `videoFit` key → drop it, not reject).
- Gate: `npm test` (check:jsdoc/imports/pose-adapter/pose-routing/contract) exit 0.

### Wave 1 — Gameplay (`aerobeat-web-gameplay`)
- W1-A: Default `enforceAuthoredDirection: true` in `defaultFlowColliderSettings` (+ the
  boxing mirror default) so the direction tolerance is enforced by default. Update the
  README (the "overlap-only default" note).
- W1-B: Expose the target point + entry-cone geometry for the "Visible tolerance range"
  feature. Add a pure function (e.g., `authoredDirectionCone(direction, toleranceDegrees)`)
  that returns the target center (`targetCenterForPlacement`) + the sector (start/end angles
  around the authored `DIRECTIONS` unit vector, half-angle `toleranceDegrees`). Unit-test it
  (all 8 directions, 0°/45°/90°, the y-axis flip).
- Gate: `npm test` + `test:browser` exit 0.

### Wave 2 — Renderer (`aerobeat-web-renderer`)
- W2-A: "Visible tolerance range" rendering — when `frame.visibleToleranceRange` is on, draw,
  at each directional target, the target point + the entry cone (a sector of half-angle
  `directionToleranceDegrees` around the target's `direction`, inflated by `colliderRadius`).
  A dedicated transparent layer (above targets, below product-UI), unlit, bounded alpha.
  Idle/off → nothing drawn (zero cost).
- W2-B: "Collider radius visibility" rendering — when `frame.visibleColliderRadius` is on,
  draw the collider hit regions (the inflated target squares) as a debug overlay.
- Both driven by new per-frame fields (`frame.visibleToleranceRange`,
  `frame.visibleColliderRadius`, `frame.colliderRadius`, `frame.directionToleranceDegrees`).
- Gate: `npm test` + `test:browser` + a new pixel oracle (the cone + collider overlay render
  only when the flags are on; idle/off → nothing).

### Wave 3 — Assembly (`aerobeat-web-assembly`)
- W3-A (BUG): Fix the hazard vignette — broaden `projectHazardContactEvents` to accept
  `kind:"wall"` (drive `atMs` from `committedTimelinePositionMs`). Regression test: a
  nose–obstacle wall contact on `flow_colliders_v1` produces a `hazardContact` (the vignette
  triggers).
- W3-B (REMOVE): Remove the video fit — the drawer rows, `applyVideoFit`, the frame-loop
  call, the import, the constructor field, the `video-fit-solver.js` module, the
  game-setup-coordinator state, the contracts field (W0-B). Update the drawer note text.
- W3-C (HIDE): Hide the Game Setup options — Guidance bands (lock to "Target-arrival bands"),
  Spawn distance + Override spawn distance, Camera horizontal + vertical range, Bomb scale +
  Marker scale, "Enforce authored direction". Make the "Direction tolerance (degrees)" field
  always live (no longer disabled). Keep the fields in the snapshot (data-intact) but not
  displayed.
- W3-D (WIRE): Wire the two new boolean fields (`visibleToleranceRange`, `visibleColliderRadius`)
  into the drawer (two checkboxes) + the per-frame `rendererFrame()` (push them to the
  renderer). Lock Guidance bands to `"target_arrivals"` (the frame always pushes it).
- W3-E (POLISH): Add the version number above the Start|Test buttons (from
  `appMetadata.packageVersion`). Fix the green/teal background behind the Start|Test buttons
  (explicit `.session-actions button` background in the embedded `<style>`).
- Gate: `npm run check` + `test:unit` + `test:browser` exit 0.

### Wave 4 — 0.0.53 pipeline
- W4-A: Independent combined package QA (all 7 repos green + gate sweep).
- W4-B: Source stage (exact-once `version:patch` 0.0.52→0.0.53 + provenance-oracle repair).
- W4-C: Fingerprint-bound hardware ABCCBA (real RTX 3080, headed, real webcam).
- W4-D: Final source audit + exactly one immutable `build-release` 0.0.53 + independent
  immutable audit.
- W4-E: Serving switch (collect current 5173 job, serve raw 0.0.53) + shadow-aware smoke +
  hand link to Derrick.

## Decisions (Derrick, 2026-09-14) — CONFIRMED

- **Direction tolerance:** "yes enforce does work when enabled, you were correct. Let's
  enable it by default and leave it at 45." → default `enforceAuthoredDirection: true`
  (enforce by default), keep the tolerance at 45°. Hide the toggle; tolerance field always live.
  (Gameplay change: notes must be hit in the authored direction within the 45° sector.)
- **Song version selector:** "It's an input/dropdown/label box between 'Preview' and
  'Download', title in the box is 'Version', and it lists a version number." → the
  `versionField` in `compactBeatSaverDetailMarkup` (`aerobeat-web-ui/src/elements/
  aero-product-presenters.js:902-903`), between the Preview and Download buttons. HIDE it.
  (Keep the Preview + Download buttons; only the Version dropdown/box is hidden.)
- **Visible tolerance range + collider radius:** "Default off, debug overlays (Recommended)."
  → Two new checkboxes in Game Setup, default OFF, render debug overlays (entry cone /
  collider hit regions) only when toggled on. For editing playtests.

## Standing constraints

- Raw 0.0.24–0.0.52 remain immutable. Exactly-one-build discipline. Tailnet-only serving
  (no Funnel). No product-code changes for test-harness fixes. Product-bug claims require
  3-part proof (repro fails on baseline + fix makes pass + regression test fails without
  fix). The goal stays open until Derrick's explicit physical PASS.

## Results

- **W0 Contracts COMPLETE (parent-verified, `1944a61`):** `aerobeat-web-contracts` — added `visibleToleranceRange` + `visibleColliderRadius` to `AeroGameSetupSnapshotV3` (bool, default `false`) with `aeroGameSetupVisibilityFields` / `isGameSetupVisibilityFields` / `normalizeGameSetupVisibilityFields` (missing→`false`, non-boolean→reject, legacy keys incl. `videoFit` dropped not rejected); removed all videoFit types/constants/normalizer. `scripts/validate-game-contracts.js` updated (videoFit tests → visibility-field tests incl. a forward-compat case proving old `videoFit` records normalize with the key dropped). `npm test` exit 0 (parent re-ran).
- **W1 Gameplay COMPLETE (parent-verified, `fe2830f`):** `aerobeat-web-gameplay` — `defaultFlowColliderSettings.enforceAuthoredDirection` `false`→`true` (tolerance stays 45°); boxing mirror flips automatically (`defaultBoxingColliderSettings` spreads the flow default). New pure export `authoredDirectionCone(direction, toleranceDegrees)` (frozen `{center, direction, toleranceDegrees}`; `null` for invalid direction; sector = ±tolerance around the authored vector). README updated. Existing tests that encoded the old overlap-only default updated (boxing stationary-hook `wrong_direction`, reach-scrub hits now pass `enforceAuthoredDirection:false` to stay direction-neutral). `npm test` + `test:browser` exit 0 (parent re-ran).
- **W2 Renderer COMPLETE (parent-verified, `2c34c71`):** `aerobeat-web-renderer` — two debug-visibility overlays driven by new optional per-frame fields (`visibleToleranceRange`, `visibleColliderRadius`, `colliderRadius`, `directionToleranceDegrees`), both OFF by default (absent→false/0.12/45, backward compatible, zero cost when off). `tolerance_cone` (a triangle fan spanning the entry arc 2×tolerance around the authored direction, inflated by the footprint) + `collider_square` (the inflated target square) scene objects, a dedicated transparent layer, `normalizeColliderOverlay` + `colliderOverlayObjects` + `colliderOverlayVisual` pure functions, new `scripts/validate-w053-collider-overlays.js` pixel oracle (overlays render only when the flags are on; idle/off→nothing). `npm test` + `test:browser` exit 0 (parent re-ran).
- **W3 Assembly COMPLETE (parent-verified, `8eca9e5` + `2be19ff`):** `aerobeat-web-assembly` — W3-A hazard vignette fix (`gameplay-frame-effects.js` hazard loop now accepts `kind==="bomb" || kind==="wall"`, so flow_colliders_v1 nose–obstacle wall contact triggers the vignette; regression test added); W3-B remove the video fit entirely (drawer rows/select, `applyVideoFit`, frame-loop call, imports, `src/video-fit-solver.js` + its oracle deleted, `game-setup-coordinator.js` videoFit state removed with a forward-compat reader that drops legacy `videoFit` keys); W3-C hide the Game Setup options (Override spawn distance, Enforce authored direction, Guidance bands [locked to `target_arrivals`], Spawn distance, Camera H/V range, Bomb/Marker scale; Direction tolerance now always live); W3-D wire the two new boolean fields (drawer checkboxes + `rendererFrame()` pushes the four per-frame fields + `game-setup-coordinator.js` snapshot carries both booleans via W0's `normalizeGameSetupVisibilityFields`); W3-E version label above the Start|Test buttons (`data-role="app-version"` = `appMetadata.packageVersion`). Re-pinned the assembly to W0/W1/W2/W3-ui commits. Shell-matrix + mobile-gameplay-menu + game-setup-coordinator + 3c9d-trajectory + visual-correction oracles updated for the new drawer. `npm run check` + `test:unit` + `test:browser` exit 0 (parent re-ran). (W3 coder introduced an `async`-callback syntax error in `validate-real-3c9d-trajectory-controls.js:57` — parent fixed in `2be19ff`.)
- **W3-E web-ui button fix COMPLETE (parent-verified, `5a0a672`):** `aerobeat-web-ui` — added `.session-actions button { background: linear-gradient(180deg,#ffffff,#eef2f5); }` to the embedded `<style>` (neutral white→light-gray, overriding the inherited `#fff→#bcecff` green/teal gradient); the active-state blue gradient is unchanged. Browser-verified (default neutral, active blue). `npm test` exit 0 (parent re-ran).
- **NEXT: W4 Pipeline** — independent combined package QA (all 7 repos green + gate sweep) → source stage (exact-once `version:patch` 0.0.52→0.0.53 + provenance-oracle repair) → fingerprint-bound hardware ABCCBA → final source audit → exactly one immutable `build-release` 0.0.53 → independent immutable audit → serving switch (collect current 5173 job, serve raw 0.0.53) → shadow-aware smoke → hand link to Derrick for the physical retest.
