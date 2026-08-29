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

## Physical Finding: Gameplay HUD and Drawer Copy Still Too Dense

Derrick's next phone screenshot and direct report establish a stricter product rule:

- while actual gameplay is active and the drawer is closed, the only visible UI above the camera/playfield is the corner pause/hamburger control and its background;
- the drawer still contains too much explanatory/status/development copy; each section should expose its options and true actions, not schema names or development notes.

The attachment inspection service failed to return a visual report, so no additional screenshot detail is inferred here. The operator's explicit description is sufficient to reproduce the code-level issue.

Current code confirms the cause:

1. The closed gameplay shell always mounts visible `aero-calibration-badge`, `aero-tracking-pause`, and `aero-resume-countdown` presenters in `.hud`, regardless of whether their state is currently relevant.
2. A bottom-left `.status` pill is always visible and continuously publishes runtime text.
3. The drawer always renders the `AeroBeat` drawer title and a visible Info runtime status, while nested compact presenters retain some live/error/progress text by design.
4. The first repair hid many metadata fields but optimized each presenter independently; it did not assert the stronger whole-screen invariant of exactly one visible gameplay control or a whole-drawer text allowlist.

Required behavior:

- In steady gameplay, hide every HUD/status element visually; retain only the top-corner menu control and its background.
- Keep runtime announcements available to assistive technology through a visually hidden live region.
- During calibration, tracking recovery, or 3-2-1, show only the minimum transient cue required by the previously approved flow; do not render full cards, headings, calibration IDs, reset controls, or explanatory paragraphs over the playfield.
- Remove the drawer brand/title and nonactionable Info runtime copy.
- In compact product presenters, show option labels and true action labels only. Preserve concise errors, import progress/cancel, device limitations that block play, and the Music prerequisite because these are actionable; hide schema names, IDs, hashes, author/mapping/development notes, storage/quota copy, variant-count copy, and redundant selected-item text.
- Add a closed-playing exact-visibility test and a composed-tree drawer text allowlist for Gameplay, Visuals, Music, and Info.

## Independent QA Failure: Required Embed/Viewport State Matrix Is Not Proven

### Exact Observed Failure

At assembly `dbbbd11`, the suites pass, but one actual transient violation exists and the requested acceptance matrix is absent. During countdown, `AeroGame.rendererFrame()` still returns `gameplay.countdown.value` to the renderer, whose `drawCountdown()` paints the number into the canvas, while the new DOM transient cue renders the same numeric value. Two countdown cues can therefore coexist. `scripts/validate-mobile-gameplay-menu.js` cannot detect the canvas cue because it counts selected DOM overlays only. The script creates one direct page at 390×844, runs the detailed state flow there, then changes that same direct page to 844×390 only for surface/radio checks. It does not create an iframe. `scripts/validate-playwright-console-noise.js` creates a cross-origin iframe at fixed 640×480 and validates protocol/lifecycle/privacy, but does not inspect minimal-shell visibility or text. The mobile visual helper checks a selected list of known overlay nodes rather than recursively enumerating all composed-tree visible elements/text. No assertion samples the `Release` cue, and no assertion proves the three legacy presenter node identities remain stable and explicitly aria-hidden across updates.

### Expected Behavior

One executable acceptance matrix must cover direct and real cross-origin iframe embeds at both 390×844 and 844×390 for configured idle, calibrating, hold, release, countdown, steady play, tracking pause, open-menu pause, close/recovery, and resumed play. It must recursively inspect composed-tree visibility/text and prove the exact steady/transient, legacy-node, clipped-live-status, drawer, Music, focus, lifecycle, privacy, and no-winner invariants.

### Execution Path

1. `npm run test:browser` runs the cross-origin protocol suite and then the direct mobile validator.
2. The protocol suite uses an 1100×760 parent with a 640×480 child iframe and performs no shell DOM assertions.
3. The mobile validator opens the Vite child directly at 390×844 and injects a mocked service graph.
4. Detailed shell state assertions run only before the page is resized.
5. After resize to 844×390, only surface, drawer width, and populated Music radio checks run.
6. The visibility helper counts menu/backdrop/drawer/status/cue plus known `.hud-presenter` nodes, so the claimed exact composed-tree invariant is broader than what is measured.

### Most Likely Root Cause

The implementation added a DOM-owned transient cue without removing the renderer-owned numeric countdown, creating the confirmed duplicate. The minimal-shell checks were then added incrementally to the existing direct mobile validator while relying on the pre-existing iframe protocol test as indirect parity evidence. Because the helper observes DOM overlays but not canvas output, it masked the duplicate and never executed the required shell matrix inside the cross-origin child or in both orientations.

### Alternative Hypotheses

- The shared component implementation likely renders the same shell in direct and iframe contexts; source supports this, but source parity does not replace the required runtime proof.
- Existing general iframe sizing/lifecycle/privacy coverage may catch some regressions, but it cannot detect shell visibility/text or transient-cue regressions because it never queries those nodes.

### Why Previous Fixes Failed

The implementation fix correctly suppresses known legacy DOM cards/status, but added a new DOM cue without disabling the renderer countdown. The validation fix checked selected DOM nodes in the direct portrait flow and therefore missed the canvas duplicate, then treated existing generic iframe coverage and one late landscape snapshot as if they covered the exact multi-state matrix. The result addressed the old DOM symptoms but did not enforce one presentation authority or the complete acceptance topology.

### Unknowns

- Whether every required state currently passes inside a real cross-origin iframe at both exact dimensions.
- Whether a recursive composed-tree enumeration would reveal any visible nested presenter text omitted by the selected-node helper.
- Whether the Release cue is observable for the required interval under the real state flow.

### Minimal Reproduction

1. Read `scripts/validate-mobile-gameplay-menu.js`: no iframe is created; detailed state assertions end before the 844×390 resize.
2. Read `scripts/validate-playwright-console-noise.js`: iframe style is 640×480 and no minimal-shell selectors or composed-tree walk appear.
3. Run `npm run test:browser`: it passes despite never executing the required cross-product.

### Proposed Verification

Build a table-driven Playwright matrix over embed mode (`direct`, real cross-origin `iframe`), viewport (`390×844`, `844×390`), and required state. At each state recursively walk open shadow roots, enumerate visible elements/text, and assert exact allowlists. Explicitly sample Release, retain references to the three legacy presenter nodes across transitions, verify `aria-hidden=true`, and verify the clipped status remains `aria-live=polite`.

### Recommended Fix

Refactor the mobile scenario into a reusable child-frame runner, create an ephemeral cross-origin parent using the existing supported browser-test pattern, and execute the full state sequence independently in all four embed/viewport combinations. Replace the selected-overlay counter with a recursive composed-tree visibility/text collector while retaining focused semantic assertions for menu size, drawer taxonomy, Music controls, focus, pause, privacy, and lifecycle.

### Debugging Record

```text
Problem: Countdown has two visible cues and the required exact minimal-shell acceptance matrix is not implemented.
Observed symptom: WebGL and DOM both render countdown; passing suites cover detailed shell states only in direct portrait; iframe is fixed 640×480 protocol-only; landscape is partial.
Root cause: DOM transient cue was added without removing renderer countdown, and incremental direct-shell assertions were combined with generic iframe evidence instead of one cross-product runner.
Evidence: src/index.js lines 624-632 and 656-657; renderer-facade.js lines 182-183 and 259; validate-mobile-gameplay-menu.js lines 13, 151-208, 216-225; validate-playwright-console-noise.js lines 13, 20, 99-125.
Failed approaches: Selected-DOM overlay counting, no canvas presentation assertion, and prose inheritance of generic iframe/privacy coverage.
Corrective action: Choose one countdown presenter and add a table-driven direct/iframe × portrait/landscape full state matrix with recursive composed-tree/canvas-aware inspection.
Verification test: Exactly one countdown cue plus all required states and visibility/text invariants pass in four independent contexts, including Release and stable aria-hidden legacy nodes.
Related files/components: scripts/validate-mobile-gameplay-menu.js; scripts/validate-playwright-console-noise.js; src/index.js.
Remaining uncertainty: Runtime outcome of the missing iframe/landscape state combinations.
```

