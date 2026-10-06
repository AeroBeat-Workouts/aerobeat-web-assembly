# T4/T5 assembly diagnosis (2026-09-28)

## Exact observed failure
Derrick reports that after finishing Boxing, downloading a different song, choosing Flow and pressing Play, gameplay still uses Boxing rules and the drawer still says Boxing glove collider / Boxing camera while Gameplay visually says Flow. The latter mismatch is directly explained by the current control-mode precedence; the former has not been reproduced against a real downloaded package yet.

## Expected behavior
Gameplay intent must select the Flow content variant, next Start must configure Flow ruleset, and per-mode controls must follow the selected mode between runs and active session during a run. Three converter controls must persist and reach subsequent song conversions.

## Execution path
UI `gameplay-mode-select` → `selectGameplayAxes` → `exactGameplayVariant` → `performSelectVariant` → content `selectVariant` or `swapFutureVariant` → `configureGameplayFromContent` → gameplay `configureContent`/`applyFutureContent`. Start reconfigures content then calls `requestStart`. Rendering calls `cameraControlMode` for camera and collider controls.

## Most likely root cause
For the proven drawer mismatch, `cameraControlMode` always returns `equipmentModeForSession(session)` if the prior session has a ruleset. A completed Boxing session retains Boxing ruleset even after content selection changes to Flow, so the UI renders stale Boxing sections. On a paused prior song, `performSelectVariant` computes `futureOnly` from gameplay session state and package equality, potentially routing a fresh between-song selection through `swapFutureVariant`/`applyFutureContent` instead of a fresh configure; specifically inspect selected package, session package, and states in the physical scenario. The checked-in selector itself does not own the selected variant; current UI may display an intent ahead of async selection. Start does reconfigure from the selected content variant, assuming selection succeeded.

## Alternative hypotheses
1. An unavailable Flow variant in the downloaded package or a rejected content swap means selectedVariant never changed (check content snapshot and `lastError`). 2. A queued selection invalidated by a later import/song selection (inspect lifecycle FIFO and `desiredLibrarySelection`). 3. A swallowed gameplay configure error leaves content Flow and gameplay Boxing (inspect `lastError`). These remain unproven without real-package reproduction.

## Why previous fixes failed
No prior T4 fix documented. Existing UI re-render calls cannot help while camera mode chooses a stale session ruleset before selected content.

## Unknowns / minimal reproduction
Run the user sequence on real downloaded content and record content selected ruleset, gameplay session state/package/ruleset and `lastError` after each intent. Smallest deterministic test: completed Boxing session for package A; load package B; choose Flow; inspect selected variant, controls; Start and inspect fresh session ruleset. Repeat with paused Boxing state and package B.

## Proposed verification
A regression oracle asserts content-selected Flow after settled mode intent and Flow controls before Start; then a new Start binds Flow ruleset and preserves Flow controls. It discriminates stale UI precedence from a failed variant selection.

## Recommended fix
Prefer the selected content ruleset whenever no active run is underway, and compare session package with content package before reusing session mode. Avoid routing a cross-song variant choice through paused-run future-only logic. Keep session truth for an active pause, with next Start reconfiguring selected content. Add assertions for the resolved variant and newly started ruleset.

## T5 observation
Assembly setup snapshot has no `guardSpacing`, `uppercutOppositeLane`, or `anyOppositeLane`. The currently checked-out authoring converter accepts optional `guardSpacing` in `converterProfile.settings` but its strict profile and Worker validators reject the two booleans. The assembly cannot force the two booleans to affect authored packages until the separate content-authoring owner exposes them via a compatible validated profile/options boundary. Adding persisted setup and UI values is possible in assembly, but end-to-end conversion effect must be validated after that dependency lands.

```text
Problem: T4 mode controls stay Boxing; T5 converter controls absent.
Observed symptom: Flow selector with Boxing camera/collider and reportedly Boxing session after Start.
Root cause: Confirmed stale session precedence in cameraControlMode; possible selection/configuration divergence still requires real repro.
Evidence: index.js cameraControlMode, performSelectVariant, startSession; game-setup-coordinator.js lacks fields.
Failed approaches: No documented T4 fixes.
Corrective action: Resolve between-run UI mode from selected content; ensure fresh Start configures selected variant; expose validated persistent converter controls.
Verification test: Complete Boxing A → load B → select Flow → inspect selected content, controls, next session; check setup reload and conversion option boundary.
Related files/components: src/index.js, src/game-setup-coordinator.js, scripts/validate-product-shell-matrix.js, content-authoring converter profile API (separate owner).
Remaining uncertainty: Real content reproducer's selectedVariant/lastError; authoring support for B3.2 options not yet landed.
```
