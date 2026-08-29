# Task 12 Prototype Start and Drawer Taxonomy Debug Record

## Exact Observed Failure

Derrick’s repaired Android physical test reached the prototype drawer, but the workout did not start as expected. The drawer still exposed prototype schema/profile/development information and too much text. Option controls did not read visually as mutually exclusive radio choices.

Directly observed from the operator:

- the workout prototype did not start as expected;
- gameplay choices should show only gameplay types;
- schema/development information should not appear;
- the only product sections should be **Gameplay**, **Visuals**, **Music**, and **Info**;
- option controls should visibly be radio controls;
- every choice category should begin with the known leader selected, or its first option when no leader is known.

Not yet established from physical evidence:

- which exact state/error appeared after Calibrate;
- whether a music package had been imported and selected;
- whether camera permission or calibration began;
- whether the operator expected a specific gameplay or visual leader beyond the current durable defaults.

## Expected Behavior

1. The drawer has exactly four visible section titles: Gameplay, Visuals, Music, and Info.
2. Gameplay shows only human-facing type names: Flow, Semantic Row, Spatial Row, Semantic Cut, and Spatial Cut.
3. Visuals shows only human-facing visual choices. Prototype schemas, hashes, versions, profile classes, scoring/converter experiments, import/export/reset development controls, and recipe/ruleset IDs are absent from the physical-test drawer.
4. Music owns search/latest/local import, selected song/version/difficulty, import progress, and available library choices.
5. Info contains only actionable runtime information/errors and fullscreen; it does not expose development telemetry.
6. Mutually exclusive gameplay, visual, and available-music choices use native or unmistakable radio presentation with exactly one selected choice.
7. Existing durable leaders are selected first. Current profile-registry defaults define `aero.visual.default` as the visual leader. No production Gameplay/Boxing winner is known, so the first gameplay option, Flow, is selected. Music preserves a valid selected package/result; otherwise the first available item is selected. No production Boxing candidate is promoted.
8. Calibrate cannot silently request gameplay start without playable selected content. It must either prepare the selected music/content first or expose one short actionable Music error while retaining camera/calibration safety.

## Execution Path

Current path:

1. Assembly’s drawer mounts one full `aero-prototype-selector`, then BeatSaver/import/library/capability/error/fullscreen presenters.
2. Compact mode hides many headings and hashes, but the prototype selector still renders Gameplay plus all three experimental profile classes and profile-bundle development actions in one component.
3. Gameplay choices are `<button role="radio">` controls, not visually native radio controls.
4. Tuning profile choices are buttons with `aria-pressed`, intermixed with gameplay.
5. Assembly initializes `selectedProfileId` from the selected content variant, falling back to Flow in presentation state.
6. The profile registry initializes durable defaults to `aero.visual.default`, `aero.scoring.locked`, and `aero.converter.canonical`.
7. `startFromMenu()` directly calls `AeroGame.start()`.
8. `start()` acquires the camera/CV lease and catches `gameplay.requestStart()` failure when content or calibration is pending.
9. Therefore a user can press Calibrate with no imported/selected playable Music content; camera/calibration may continue while gameplay cannot start, and the caught request failure does not produce a concise Music prerequisite action.

## Most Likely Root Cause

This is a product-information architecture and prerequisite-state mismatch:

- one development-oriented prototype presenter is being reused as the physical product selector;
- ARIA radio roles provide semantics but not the radio visual model Derrick requested;
- experimental profile lifecycle controls are mixed into end-user Gameplay;
- assembly exposes Calibrate before proving a playable selected Music package/variant exists;
- `requestStart()` intentionally catches pending content/calibration errors, so the primary flow can appear to do nothing when Music is not ready.

This explains both the excess development text and the reported non-start more directly than a camera/CV failure. A camera/backend failure remains possible but was not reported with an error and is not established.

## Alternative Hypotheses

1. Camera permission denial or MediaPipe load failure: possible, but no exact camera error was reported.
2. Selected BeatSaver result was not imported/authored: likely contributor; selecting a result is not the same as producing playable content.
3. Imported package lacked a selected compatible variant: possible; the next test must expose this as a Music error.
4. T-pose was not recognized: possible after camera start, but it does not explain schema/development clutter.

## Why Previous Fixes Were Insufficient

The first repair correctly made the playfield dominant, added a drawer, wired camera start, and hid much metadata. Its tests proved camera/T-pose/menu state transitions by injecting a configured content variant before pressing Calibrate. That bypassed the fresh-user Music prerequisite. UI compact tests also verified accessibility and selected state for the existing mixed development presenter rather than validating the four-section product taxonomy.

## Unknowns

- Exact phone status/error after Calibrate.
- Whether Music had been imported and selected.
- Whether a known gameplay leader exists outside the current plan; no winner is recorded, so Flow must remain the top fallback.
- Whether Visuals should expose only `aero.visual.default` and `aero.visual.compact` or future nonexperimental names. Current durable registry makes Default the leader.

## Minimal Reproduction

1. Open a fresh Android session with no selected imported package.
2. Observe the drawer’s mixed gameplay/profile/development controls.
3. Select a workout type.
4. Press Calibrate / Start without a playable selected Music package.
5. Camera/calibration can begin, but gameplay cannot enter a playable session because `requestStart()` catches the missing-content condition.

The existing automated mobile test does not reproduce this because it programmatically configures a playable Flow package before activating Calibrate.

## Proposed Verification

- Exact 390/844 browser evidence shows only Gameplay, Visuals, Music, and Info headings.
- Gameplay and Visuals expose native/unmistakable radio controls, one checked per category.
- Default state selects Flow and `aero.visual.default`; a deliberately leaderless fixture selects the first option.
- Music keeps a valid existing selection and otherwise auto-selects the first library/search option when it appears.
- No schema, version, hash, ruleset, recipe, profile-class, scoring/converter, or bundle-management text appears in the drawer.
- Calibrate with no playable Music produces one short Music prerequisite state and does not imply gameplay started.
- Calibrate with a selected/imported Music package configures content, requests camera once, closes/arms through the existing policy, and reaches T-pose/countdown/play.
- Existing direct/iframe, privacy, profile lifecycle, authoring, release, and no-production-winner contracts remain intact.
- Derrick repeats the phone flow.

## Recommended Fix

1. Give `aero-prototype-selector` scoped product views (or dedicated presenters): Gameplay-only and Visuals-only. Keep the full development view available outside the physical drawer for tooling/tests.
2. Render mutually exclusive product options as native radio inputs/labels or an unmistakable tested radio affordance; preserve scalar intent payloads.
3. Compose four assembly sections in fixed order: Gameplay, Visuals, Music, Info.
4. Remove scoring/converter/profile-bundle development controls from the physical drawer, without deleting their public APIs or experimental registry.
5. Use durable active/default state for known leaders; use first-option fallback only when no valid leader exists. Flow remains the gameplay fallback, not a promoted Boxing winner.
6. Add Music selection authority: preserve current package/result, otherwise select the first available item. Gate Calibrate on a playable selected package/variant and show a short Music action instead of swallowing the prerequisite.
7. Extend the mobile test with a fresh no-content case and a real selected/imported Music case.

## Debugging Record

```text
Problem: Phone prototype did not start; drawer still exposed mixed development-oriented controls and text.
Observed symptom: Non-start plus request for only Gameplay/Visuals/Music/Info, less text, radio choices, and deterministic defaults.
Root cause: Development presenter reused as product selector and Calibrate is not gated by playable Music readiness; automated test preconfigured content and bypassed this path.
Evidence: Full selector renders gameplay + three profile classes + bundle actions; startFromMenu calls start directly; start catches requestStart while content/calibration is pending; registry defaults select visual.default while gameplay presentation falls back Flow.
Failed approaches: Compact CSS reduced metadata but preserved mixed taxonomy; mobile state test injected content before Calibrate.
Corrective action: Scoped Gameplay/Visuals radio presenters, four-section assembly, deterministic leader/first defaults, Music selection/readiness gate, concise prerequisite state.
Verification test: Fresh no-content and selected-content mobile browser flows plus exact taxonomy/text/radio/default assertions and physical Android rerun.
Related files/components: web-ui aero-product-presenters; assembly src/index.js and mobile validator; gameplay prototype-profile-registry; content/library presenters.
Remaining uncertainty: Exact phone error/state and whether Music had been imported before Calibrate.
```

## Post-QA Acceptance Gap: Music Choices

The four-section repair correctly added native radios for Gameplay and Visuals, but final parent review found that Music’s mutually exclusive choices still render as ordinary buttons:

- BeatSaver result selection is a `<button data-intent="beatsaver-select-map">` inside a list, even though `selectedMap` already defines exactly one current result.
- Library package selection is a `Play` button, even though assembly now preserves or deterministically chooses exactly one current playable package.
- Version and Difficulty are native `<select>` controls and already communicate mutually exclusive choice; Search, Latest, local ZIP, Import, Export, Delete, and Cancel are actions and must remain buttons.

Therefore the implementation is not yet ready for physical handoff under Derrick’s explicit rule that buttons representing options must be radio controls. The earlier QA assertion of seven radios covered only the empty-Music fixture (five Gameplay plus two Visuals) and did not validate populated BeatSaver/library choice semantics.

Required repair:

1. Render populated BeatSaver map results as a native radio group checked from `selectedMap.mapId`, with first-result fallback.
2. Render populated library package selection as a native radio group checked from a scalar `selectedPackageId`, with first-package fallback; preserve Export/Delete as actions.
3. Keep Version/Difficulty as selects and all true actions as buttons.
4. Extend assembly snapshots/tests so first/current Music choices are visibly checked and continue to drive the existing scalar select intents.
5. Re-run UI/assembly QA and audit before asking for another phone test.

