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

## Repair: Sole DOM Transient and Exact Four-Context Matrix

Assembly now supplies `countdown: null`, `overlay: "none"`, and `calibrationDim: 0` to the WebGL gameplay frame in this product shell. Renderer countdown/overlay capability and its public frame contract remain intact for other consumers, but the assembly-owned DOM transient is the sole product-shell presenter. Calibration cooldown gives `Release` precedence, after which any remaining 3-2-1 value is presented once in DOM.

`scripts/validate-product-shell-matrix.js` runs one state table in direct and real cross-origin iframe contexts at both 390×844 and 844×390. It recursively walks open shadow roots, records only geometrically/computed-visible overlay controls and direct text, and separately inspects renderer frame input. It covers configured idle, calibrating, hold, explicit release, countdown, steady play, tracking pause, menu-open pause, Escape close/recovery, and resumed play after a real start. It also proves stable hidden+aria-hidden legacy identities, clipped polite live status, exact 48×48 opaque menu control, drawer/Music/focus, reconnect, privacy, and explicit no-winner policy.

The fixture initially failed to enter hold because its `Locator.evaluate` callback destructured the located `<aero-game>` first parameter instead of the supplied second payload parameter. Injected timestamps were therefore undefined; assembly correctly skipped the duplicate undefined frame. Increasing delay could not repair malformed input. Correcting the callback to `(_element, { timestampMs, tPose })` restored monotonic samples and the full four-context matrix passes.

```text
Problem: New acceptance matrix never entered calibration hold.
Observed symptom: calibrationState=tracking_lost, cue=T-pose, injected/latest timestamps undefined while frame timer ran.
Root cause: Locator.evaluate callback destructured the DOM element instead of its second payload argument.
Evidence: Playwright callback contract and undefined timestamps despite active frameTimer.
Failed approaches: Increased sample delay; it treated scheduling rather than malformed fixture input.
Corrective action: Accept `(element, payload)` and destructure payload.
Verification test: Exact four-context state matrix twice plus full browser suite.
Related files/components: scripts/validate-product-shell-matrix.js; pushPose; AeroGame.startFrameLoop().
Remaining uncertainty: Physical operator confirmation only; automated direct/iframe portrait/landscape combinations now pass.
```

## Independent Re-QA Failure at `d203193`

### Exact Observed Failure

The sole-DOM transient repair and four-context state matrix pass, but the required exact 48×48 **opaque** corner control does not. Product CSS sets the shared menu/control background to `rgba(3,19,31,.92)`, so the menu remains translucent. The matrix labels this check exact/opaque but only rejects the fully transparent value `rgba(0, 0, 0, 0)`; alpha `0.92` passes.

The matrix also remains narrower than its exactness claim: composed-tree collection records text/controls only after entering known overlay roots, renderer inspection omits `calibrationDim`, iframe dimensions are authored but not measured, and the drawer check is a forbidden-word filter rather than an exact allowed-text set.

### Expected Behavior

The computed menu background must have alpha exactly `1`, and the test must parse/assert that value. Exact shell validation must classify all visible composed-tree elements/text, assert every renderer overlay input including dimming, measure iframe/child bounds, and enforce the allowed drawer vocabulary while retaining start/menu/lifecycle/privacy/no-winner coverage.

### Execution Path

1. `template()` applies `background:rgba(3,19,31,.92)` to `.menu-button`.
2. Chromium exposes that computed color as a partially transparent RGBA value.
3. `shellSnapshot()` records the string as `menuBackground`.
4. `assertSteady()` and `assertTransient()` compare only against fully transparent black.
5. The matrix therefore passes all four contexts despite violating the requested opaque-control invariant.

### Most Likely Root Cause

The repair interpreted “opaque” as “has a visible background” rather than alpha exactly one, then used a nontransparent sentinel test. The broader exactness gaps similarly extend the earlier selected-overlay strategy instead of implementing a complete allowlisted composed-tree inventory.

### Alternative Hypotheses

- If “opaque” were intended only to mean visibly backed, alpha `0.92` would be acceptable; the direct re-QA instruction explicitly says opaque, so QA uses the strict CSS meaning.
- The current source hard-codes zero renderer countdown/overlay/dim values, reducing immediate canvas risk, but acceptance still requires the matrix to lock all of them.

### Why Previous Fixes Failed

The repair correctly removed renderer-owned transient content and added the missing contexts/states. It did not change the existing translucent control token, and its assertion tested presence of background rather than opacity. Its recursive traversal still filters observations through known overlay ancestry, so the earlier exact composed-tree blind spot is reduced but not eliminated.

### Unknowns

- No runtime uncertainty exists about the opacity: source and release both use alpha `0.92`.
- Physical operator confirmation remains separate under `3h7` and cannot cure this deterministic product/test failure.

### Minimal Reproduction

1. Load any direct or iframe matrix context.
2. Read `getComputedStyle(menuButton).backgroundColor`.
3. Observe `rgba(3, 19, 31, 0.92)`.
4. Observe the current test accepts it because it differs from `rgba(0, 0, 0, 0)`.

### Proposed Verification

Set the product menu background to an alpha-one color. Parse computed RGB/RGBA and assert alpha exactly one in every context/state. Enumerate and classify all visible composed-tree elements/text, assert `countdown:null`, `overlay:"none"`, and `calibrationDim:0`, measure iframe and child bounds, and compare drawer text against the exact allowed vocabulary plus narrowly modeled actionable dynamic messages.

### Recommended Fix

Make only the corner menu control fully opaque without unnecessarily changing drawer-close/start styling, then harden the matrix assertions described by P0 `aerobeat-web-assembly-ctp`.

### Debugging Record

```text
Problem: Repaired shell still has a translucent menu and incomplete exactness assertions.
Observed symptom: computed menu background alpha is 0.92 while all matrices pass.
Root cause: shared CSS retained translucent alpha and test checks only nonzero visibility, not opacity.
Evidence: src/index.js template menu CSS; validate-product-shell-matrix.js menuBackground assertions; release bundle CSS.
Failed approaches: Treating any nontransparent background as opaque and selector-scoping the composed-tree inventory.
Corrective action: Set menu alpha to 1 and assert parsed opacity plus exhaustive allowlisted visibility/bounds/renderer inputs.
Verification test: Four-context matrix twice, full gates, stable release/pack, and exact computed/style assertions.
Related files/components: src/index.js; scripts/validate-product-shell-matrix.js; release/raw/0.0.24/.
Remaining uncertainty: Physical play only; deterministic opacity/test failure is established.
```

## Repair: Alpha-One Control and Exhaustive Classifier

The corner menu now overrides the shared translucent control background with `#03131f`; drawer-close and start styling remain unchanged. Chromium computes the menu background as `rgb(3, 19, 31)`, and the matrix parses RGB/RGBA syntax and requires alpha exactly `1` in every closed, transient, and drawer fixture.

The matrix no longer enters a known overlay root before collecting evidence. It starts at the `<aero-game>` host, traverses the complete rendered light/shadow composed tree, and classifies every geometrically visible element and normalized direct text as host, structure, environment, video, canvas, menu, transient, backdrop, drawer, or unexpected. Closed states reject every category beyond environment/play surfaces, menu, and the one allowed transient. Renderer frame inspection locks all three inputs: `countdown:null`, `overlay:"none"`, and `calibrationDim:0`.

Iframe acceptance measures the parent `iframe#game`, child `innerWidth`/`innerHeight`, parent main, and `<aero-game>` bounds at exact 390×844 and 844×390. Drawer acceptance compares exact normalized visible-text sets rather than forbidden words and exercises baseline plus controlled progress, error, and blocking limitation fixtures. Lifecycle proof records old service destruction, fresh graph/generation/state, stable video/canvas/legacy identities, and media-idle reconnect. Privacy recursively rejects forbidden keys and binary/media object types, and an explicit `production-winner` selection must fail as unregistered.

During hardening, exhaustive output exposed two test-model assumptions: the corner button intentionally remains visible as a close control while the drawer is open, and clipped compact labels/options are not visible text. A later reconnect assertion incorrectly expected the frame timer to restart without media; reconnect correctly creates a fresh connected, media-idle graph with timer zero. The final classifier models those documented behaviors without weakening closed-shell acceptance.

## Final Re-QA Failure at `0180797`: Stale Release Identity

### Exact Observed Failure

All functional shell acceptance and runtime gates pass, but the checked-in release does not reproduce from the exact current source/dependency graph. `release/raw/0.0.24/aerobeat-release-proof.json` and the embedded `buildStamp`/`cacheBust` claim source fingerprint `36cd13bd277b6c78210ba12ed63228ffadaf6ddd24f44417707ea897cd169cc6`. The repository's own `computeReleaseFingerprint()` returns `4765fe8c98ff9d6a82d46ea8287fe559053f4a17623792ef10111df5da9e5db0`.

Two fresh `build-release` rounds and two dry-run packs are mutually byte-identical, but rebuilding changes the tracked proof fingerprint and `assets/index.js` build/cache stamps from `36cd13bd…` to `4765fe8c…`. QA restored the generated probe output after recording the difference, leaving exact HEAD clean.

### Expected Behavior

The checked-in proof fingerprint and embedded build/cache stamps must equal the fingerprint computed from the frozen current source and recursively linked local package graph. Fresh deterministic rebuilds must produce no tracked release diff.

### Execution Path

1. `build-release.js` computes the source fingerprint through `scripts/release-fingerprint.js`.
2. The fingerprint covers assembly entry/config/package inputs and recursively linked local runtime package metadata/source.
3. Vite injects that value into `buildStamp` and `cacheBust`.
4. The proof records the same value.
5. At current HEAD/dependencies, the computed value differs from the checked-in release, so rebuilding changes two tracked files even though artifact byte count remains `3971178`.

### Most Likely Root Cause

A fingerprint input in the assembly or recursively linked file-dependency graph changed after the release at `f2858f9` was generated, without refreshing and committing the release proof/build stamps. The aggregate proof does not identify which historical input changed.

### Alternative Hypotheses

- Nondeterministic release output is contradicted by two identical fresh release rounds and identical dry-run packs.
- Functional source drift is unlikely: mapped source content and all shell tests pass; the observed tracked bundle delta is limited to fingerprint/cache stamp strings and proof identity.

### Why Previous Fixes Failed

The opacity/exhaustive-shell repair validated and documented a deterministic release snapshot, but did not freeze or re-check the linked dependency graph immediately before final handoff. Later local package input drift invalidated the aggregate source identity without changing this repo's functional shell source.

### Unknowns

The exact linked input responsible for the fingerprint delta is not recoverable from the aggregate proof alone. This does not prevent repair: freeze current dependencies, rebuild, compare twice, and commit the matching release.

### Minimal Reproduction

1. On clean exact HEAD `0180797`, run `computeReleaseFingerprint()` and observe `4765fe8c…`.
2. Read the checked-in proof and observe `36cd13bd…`.
3. Run `npm run build-release`; observe tracked proof and `assets/index.js` stamp changes.
4. Run it again; observe byte-identical fresh output.

### Proposed Verification

Freeze the current linked package heads, regenerate the raw release twice, compare recursive file hashes and dry-run packs, verify proof/build/cache source identities all equal the current computed fingerprint, commit the refreshed release, and verify a third rebuild leaves Git clean.

### Recommended Fix

Refresh only the generated raw release identity from the frozen current dependency graph, then repeat final QA before closing `ctp`, `9s6`, and `0n6`.

### Debugging Record

```text
Problem: Checked-in raw release source identity is stale at final QA HEAD.
Observed symptom: proof/build stamps claim 36cd13bd…, current fingerprint is 4765fe8c…; rebuild changes tracked release.
Root cause: a fingerprint input changed after release generation without refreshing committed proof/stamps.
Evidence: computeReleaseFingerprint output; build-release diff in proof and assets/index.js; two identical fresh rounds.
Failed approaches: Treating a previously deterministic release snapshot as valid after linked dependency drift.
Corrective action: Freeze dependency graph, regenerate and commit matching release identity, verify clean rebuild.
Verification test: proof/build/cache stamps equal computed fingerprint; repeated release/pack hashes match; Git remains clean.
Related files/components: scripts/release-fingerprint.js; scripts/build-release.js; release/raw/0.0.24/aerobeat-release-proof.json; release/raw/0.0.24/assets/index.js.
Remaining uncertainty: Which historical linked input caused the aggregate hash delta.
```

## Resolution: Corrected V4 Source, Eight-Way Flow, and Frozen Release

Vendor implementation `7b14eec` for `l3h` adds v4 `AudioData.dat` and preserves repeated metadata-ordered lightshow references; independent `u02` closure `b9d19a6` verifies the hard-coded golden, tamper classes, unchanged v2/v3 hashes, and live `53F26`. Assembly's first deterministic browser attempt still produced the old hash because Vite reused a stale optimized dependency prebundle even though the installed linked source contained the correction. Setting `optimizeDeps.force: true` for the disposable acceptance server proved the current source rather than cached optimizer output.

The exact live assembly path then found a second issue after successful acquisition and persistence: current `53F26` contains valid diagonal Beat Saber cuts `4..7`, locked Flow authoring correctly preserves them, but gameplay accepted only cardinal `0..3`. A first authoring-side normalization at `13cc663` made the live map select but violated Flow preservation ownership. It was forward-reverted at `fa824fc`; authoring's full check/unit/security/real/browser gates pass with exact direction preservation restored. Gameplay P0 `aerobeat-web-gameplay-uau` instead extends only Flow validation/evidence matching to all eight Beat Saber directions while keeping dot `8` direction-free and Boxing cardinal semantics unchanged. The exact live package then selects five variants without camera.

Assembly's normal gate now locks actual-service hard-coded v4 acquisition/UI authoring/persistence/selection, strict tamper rejection, v2/v3 local ZIP regression, bounded public data, and no winner. The optional network gate locks exact live `53F26` / `addd9d6f8e7340ad6f5633947136d8475a7a99b5`. Two releases, packs, and recursive manifests from the frozen graph match exactly; fingerprint/proof/build/cache identity is `ee2ae9ceab288c58f76d0415665fd432c68358cde739129f9474ed55e0c2eaf1`, proof SHA-256 `3594dd3a471e28d51b561722550de4dc7914ffc571bdd9374202eadac6b75207`, and pre-manifest bytes `3995977`.

```text
Problem: Corrected vendor source was hidden by stale Vite optimization, then live v4 Flow selection rejected valid diagonal source cuts.
Observed symptom: Old hash-input sequence under the test server; after forcing fresh source, live select failed with “Flow note direction is unsupported”.
Root cause: Reused dependency prebundle plus gameplay Flow validation/evidence matching lagging the locked eight-way authored direction contract.
Evidence: Hard-coded hash-input path dump omitted AudioData/duplicate before forced optimization; exact live stack ended in gameplay direction validation for a valid diagonal; contracts and authoring preserve eight directions.
Failed approaches: Fixing browse result shape and increasing async waits did not address dependency cache; authoring-side cardinalization made selection pass but changed the wrong owner's semantics and was reverted.
Corrective action: Force fresh disposable test optimization, extend gameplay Flow-only validation/matching to eight directions, preserve authoring output, and lock deterministic/live assembly paths.
Verification test: Hard-coded v4 golden/tamper/v2/v3 normal gate; exact optional live 53F26; full gameplay, authoring, and assembly gates; stable release/pack/manifest rounds.
Related files/components: assembly v4 validators/package scripts; web-vendor-beatsaver 7b14eec; web-gameplay uau; web-content-authoring fa824fc; release proof.
Remaining uncertainty: Physical Android camera/play rerun remains operator-owned; automated import did not request camera.
```

