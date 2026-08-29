# Task 12 Physical Menu, Music, and Start Failure Diagnosis

**Diagnosis target:** assembly source/release baseline `a58e9c6`, current diagnosis HEAD descended through `bb47ddc`; UI closure `6bcdc95`

**Method:** debug-first inspection and browser reproduction only; no product source edit

**Visual evidence boundary:** attachment inspection returned no report. Derrick's explicit phone observations below are authoritative. This report does not infer unseen pixels.

## Exact Observed Failure

Derrick reports on the physical phone:

- menu items lack contrast against the dark-blue environment;
- all menu items must sit inside one parent contrast surface;
- the open menu shows two menu buttons;
- previously downloaded songs are not presented as useful quick local-library choices;
- selected BeatSaver songs expose empty Version/Difficulty selects;
- two sets of Play/Export/Delete appear;
- `Calibrate / Start` has never successfully begun testing.

These are physical observations. The unavailable attachment cannot add any pixel, layout, package-name, select-option, or camera-state evidence.

Source/runtime reproduction confirms the following concrete failures in direct and real cross-origin iframe contexts at both 390×844 and 844×390:

1. Open menu renders both `☰` and `×`; both accessible names are `Close configuration menu`.
2. Computed drawer text is `rgb(16, 52, 71)` on `rgba(4, 17, 29, 0.97)`, approximately **1.454:1** contrast. Compact presenter panels are transparent.
3. A selected map whose first version has no `Standard` characteristic renders two Version options but **zero Difficulty options** even when a later version is playable.
4. Clicking `Calibrate / Start` with that selected, unimported map requests zero cameras and displays `Import selected song to start.`
5. Two stored package records render two repeated action rows. The long-running server renders `Play / Export / Delete` twice; a forced-fresh Vite graph renders two library radios plus `Export / Delete` twice.
6. Current BeatSaver latest data includes unsupported maps (`53E57`, `53E55`) with only `OneSaber`/`Lightshow`; current first result `53F29` is playable. Unsupported results are not removed from selection.

The exact physical claim that the Version select itself is empty was **not** reproduced from current source: the unsupported fixture retained two Version options while Difficulty was empty. It remains a real phone observation whose exact DOM cause is unknown.

## Expected Behavior

- One open-menu control model: the open drawer must not show two equivalent close buttons.
- All four product sections and their controls must be contained by one explicit, opaque, high-contrast parent surface independent of environment/theme ink leakage.
- Previously downloaded local songs must appear immediately as concise, identifiable quick choices. Reimports/version/difficulty records must not create indistinguishable repeated action sets.
- BeatSaver result/version selection must expose only versions that contain at least one supported playable `Standard` difficulty; a selected playable version must always produce a nonempty Difficulty select.
- `Calibrate / Start` must resolve the selected Music choice end to end: use a ready local package, or import the selected compatible BeatSaver map/version/difficulty, then request camera and enter the existing calibration flow. An unimported selected map must not dead-end behind a separate implicit action.
- Compact library controls must have one clear selected-song action model. Export/delete actions must not repeat as visually indistinguishable sets, and every rendered action must be wired.
- Direct and real iframe behavior must match at portrait and landscape phone sizes.

## Execution Path

### Menu controls and contrast

1. `template()` in assembly `src/index.js` always mounts top-level `[data-role="menu-button"]` (`☰`) and drawer-local `[data-action="menu-close"]` (`×`).
2. `renderInteractionShell()` toggles only drawer/backdrop `hidden`; it updates the top button's label/expanded state but never hides it while open.
3. `.menu-button` uses `z-index:60`; `.drawer` uses `z-index:50`, so the top button remains above the open drawer.
4. Assembly host color resolves through `--aero-color-ink`; the physical/runtime theme resolves it to dark `#103447`.
5. `.drawer` supplies a nearly opaque dark background but no paired local foreground. UI `sharedStyles` also uses `--aero-color-ink`, and compact mode makes `.panel` transparent.
6. The result is dark theme ink over the dark drawer instead of one isolated contrast surface.

### BeatSaver map → version → difficulty

1. Search/latest calls `browseBeatSaver()` and stores every returned map in `browsedMaps`; there is no playable-Standard filter.
2. `mapSummary()` exposes every version.
3. Deterministic selection chooses the first returned map, not the first compatible map.
4. `selectBrowsedMap()` unconditionally chooses `map.versions[0]`.
5. `standardDifficulties(version)` filters only that one version to characteristic `Standard`.
6. If version zero is unsupported, `selectedVersionHash` is populated but `difficulties=[]` and `selectedDifficulty=""`; UI renders an empty Difficulty select and disables Import.
7. `selectBrowsedVersion()` can recover only if the athlete manually chooses a later compatible version. No UI/source filter tells the athlete which version is playable.

### Local persistence → library UI

1. `connectedCallback()` invokes `refreshLibrary()`.
2. Authoring `listPackages()` returns persistence summaries sorted by storage key. Real summaries expose `key`, `packageId`, `packageHash`, `songName`, `difficulty`, and timestamps; they do not expose UI test-fixture fields `name` or `variantCount`.
3. Assembly forwards summaries directly to UI without adapting `songName → name`, deriving variant count, grouping by song/version/difficulty, or sorting by recent use.
4. UI therefore falls back to `Untitled package`/zero variants for real records. Tests use synthetic `{name, variantCount}` records and miss this contract mismatch.
5. Persistence keys are package ID plus package hash. Exact same output overwrites, but different version/difficulty outputs legitimately produce multiple records that the UI presents as indistinguishable repeated cards.
6. The current UI closure renders package selection radios and an Export/Delete row per package. Assembly handles `library-select` and `library-delete`, but has no `library-export` branch, so Export is rendered but unwired.

### `Calibrate / Start`

1. Click dispatches to `startFromMenu()`.
2. It waits only for an already-running fallback library selection.
3. `ensurePlayableMusicSelection()` accepts current playable content or selects a variant from already-loaded ready content.
4. It never imports `beatSaverView.selectedMap`, `selectedVersionHash`, or `selectedDifficulty`.
5. For selected-but-unimported BeatSaver content, it returns false, leaves the drawer open, focuses Music, displays `Import selected song to start.`, and never calls `start()`.
6. Camera request/calibration is therefore unreachable from the physical sequence Derrick attempted unless a compatible package was already loaded and selected.

### Served runtime drift

1. Disk UI at `6bcdc95` renders local package radios and no Play button.
2. The required existing `npm run dev:tailscale` process was started before that linked UI closure.
3. Its live transformed UI module still contains the previous per-card `Play / Export / Delete` markup.
4. A disposable Vite server with `optimizeDeps.force:true` serves current disk source: radios plus Export/Delete, no Play.
5. The phone's observed Play duplication therefore matches the long-running server's stale linked UI module, while the remaining contrast/control/version/start defects also reproduce from fresh source.

## Most Likely Root Cause

This is a **coupled assembly/UI product-boundary failure**, amplified by a stale long-running development transform:

1. Assembly owns no single theme-isolated contrast container and simultaneously renders two close controls.
2. Assembly treats BeatSaver browse selection and import as separate required athlete steps; Start does not complete the selected-song transaction.
3. Assembly does not normalize/filter BeatSaver maps and versions to playable Standard difficulties before deterministic selection.
4. Assembly forwards persistence summaries directly across a mismatched UI snapshot shape and has no product grouping/recent-choice policy.
5. UI repeats full destructive/action rows per package in compact mode, and assembly does not implement the exported `library-export` intent.
6. The existing server serves pre-`6bcdc95` UI markup, explaining the exact repeated Play buttons that are absent from current disk source.

These causes explain why isolated automated checks passed: fixtures use already-compatible first versions, synthetic `{name,variantCount}` library objects, preloaded ready content before Start, and assertions that explicitly accepted both `☰` and `×` plus repeated per-package actions.

## Alternative Hypotheses

1. **Phone browser cache alone** — medium likelihood for the exact Play duplication, contradicted as the complete explanation because the existing server itself returns stale markup and fresh source still reproduces contrast, two controls, empty Difficulty, repeated action rows, and Start dead-end.
2. **IndexedDB contains exact duplicate records** — low/medium. Exact package key+hash writes replace, but different version/difficulty hashes create multiple legitimate records. The actual phone records were not inspectable.
3. **BeatSaver returned a map with no versions** — low for normal provider data and not reproduced. It could explain an empty Version select, but current latest inspection returned versions for all examined maps.
4. **Camera permission/device failure** — low as the first causal failure. In reproduction camera request count remains zero because Start exits before media. A later camera problem remains possible after the Music gate is repaired.
5. **Iframe-only state loss** — low. Direct and real cross-origin iframe reproductions are identical at both phone sizes.

## Why Previous Fixes Failed

- The four-section/start repair separated imported content from selected search content and intentionally asserted that selected unimported BeatSaver maps must not start. That preserved integrity but encoded an extra athlete step contrary to the physical product flow.
- Music radio QA used synthetic package summaries with `name`/`variantCount`, masking the real authoring summary keys `songName`/`difficulty`.
- Shell QA asserted the top menu button remained visible while the drawer was open and included `×` in the allowed drawer text, institutionalizing two close controls.
- UI QA explicitly required Export/Delete buttons for every package and did not test product-level action deduplication or assembly handling of `library-export`.
- BeatSaver fixtures always put a playable Standard difficulty in the first version, so map/version compatibility filtering was never exercised.
- Prior stale-Vite diagnosis forced fresh dependencies only in disposable acceptance servers. It did not update the already-running Tailscale development process, so the physical route continued serving old linked UI markup.

## Unknowns

- The attachment contains no usable inspection report; exact unseen layout/pixel details are unknown.
- The exact phone DOM state that made **Version** appear empty is unknown. Capture selected map ID, option count/value/text, and served module URL during the next phone run.
- The phone's actual IndexedDB package keys, song names, versions, difficulties, creation times, and selected handle are unknown. A bounded metadata-only diagnostic is needed; no raw bytes.
- Whether camera permission/calibration fails after a correctly imported/selected package is unknown because the reproduced current flow exits before requesting camera.
- Whether the phone loaded the exact existing Tailscale URL without an additional browser/service-worker cache layer is unknown.

## Minimal Reproduction

### Current source defects

1. Start a disposable fresh Vite graph with current linked packages.
2. Open direct or real cross-origin iframe at 390×844 or 844×390.
3. Observe open menu: `☰` and `×` are both visible; computed dark-on-dark ratio is ~1.454:1.
4. Supply two persistence summaries for the same human song; observe two selection records and two Export/Delete rows.
5. Select a map where version zero is OneSaber/Lightshow and a later version has Standard; observe Version populated, Difficulty empty, Import disabled.
6. Click `Calibrate / Start`; observe `Import selected song to start.` and camera request count zero.

### Existing physical-route drift

1. Keep the required existing Tailscale/Vite process running.
2. Load its direct or iframe shell.
3. Supply/view two stored package summaries.
4. Observe stale `Play / Export / Delete` per package. Fetching its transformed UI module confirms old Play markup, while disk `6bcdc95` contains radios.

The failure does not occur in old automated Start fixtures when a compatible local package is preloaded and selected before clicking Start.

## Proposed Verification

Before product code changes, add failing acceptance coverage that distinguishes each cause:

1. **Served-source identity:** current local/Tailscale route must render the same compact library control type as disk UI closure; no stale Play markup.
2. **Single parent surface:** direct/iframe portrait/landscape must enumerate exactly one visible menu close control and measure every menu text/control against one opaque parent surface at WCAG AA contrast or stronger.
3. **Real summary contract:** feed exact authoring `listPackages()` summary shape, not test-only fields; assert song/difficulty labels and deterministic recent/first selection.
4. **Duplicate/group policy:** two records for one song/version family produce concise quick choices and only one selected action row; Export/Delete are not repeated ambiguously.
5. **Compatibility matrix:** playable-first, unsupported-first/playable-later, and no-Standard latest maps. Every selectable map/version has nonempty Standard difficulty; unsupported maps/versions are disabled or omitted with one concise reason.
6. **Transactional Start:** selected unimported compatible BeatSaver map → import progress → persistence → selected playable variant → exactly one camera request → T-pose. Unsupported selection must request neither import nor camera and show one actionable message.
7. **Export wiring:** every rendered Export action must call authoring export and trigger a bounded download path; otherwise it must not render.
8. Repeat direct and real iframe at 390×844 and 844×390, preserving privacy/no-winner/lifecycle gates.

## Recommended Fix

After this report and owner Beads are accepted:

- **Assembly owner:** make the drawer one explicit high-contrast parent surface with a locally paired foreground/background; expose one close control; adapt real persistence summaries into product quick-choice view models; group/sort choices deterministically; filter BeatSaver maps/versions to supported Standard difficulties; make `Calibrate / Start` transactionally import the selected compatible BeatSaver choice before starting camera; implement or remove unwired export handling; add served-runtime freshness proof without stopping the current server during diagnosis.
- **UI owner:** define a compact Music snapshot that consumes real summary fields, renders concise quick local choices, and places Export/Delete only for the selected choice (or behind one selected-choice action area), with no repeated Play/action rows and no test-only shape assumptions.
- Keep authoring integrity, local ZIP, v2/v3/v4, privacy, iframe scalar boundaries, and no-production-winner policy unchanged.
- Do not treat a cache refresh alone as the fix; it removes stale Play markup but not the fresh-source product defects.

Regression risk is concentrated in keyboard/radio semantics, delete confirmation, local export, deterministic library fallback, BeatSaver provider compatibility, start/camera gesture timing, iframe intent bounds, and release determinism.

## Debugging Record

```text
Problem: Physical phone cannot reliably read/use Music or begin calibration; menu shows duplicate controls/actions.
Observed symptom: Dark-on-dark menu, one ☰ plus one ×, missing useful downloaded-song choices, empty selected Version/Difficulty, repeated Play/Export/Delete, and Calibrate/Start never reaching test.
Root cause: Assembly lacks a single isolated contrast/close/action surface, selects unfiltered BeatSaver versions, does not import selected search content from Start, forwards mismatched persistence summaries, and leaves export unwired; compact UI repeats actions per package; existing server also serves stale pre-6bcdc95 Play markup.
Evidence: Source paths above; direct+real-iframe 390×844/844×390 reproduction; ~1.454:1 computed contrast; zero Difficulty for unsupported first version; zero camera request with selected unimported map; existing transformed module contains Play while disk/fresh Vite uses radios; actual latest includes unsupported 53E57/53E55.
Failed approaches: Synthetic compatible-first fixtures, preloaded-content Start tests, test-only library fields, QA that explicitly allowed two controls/repeated actions, and disposable-only forced Vite refresh.
Corrective action: Assembly transactional compatible import/start + one parent surface/control + real library adaptation/grouping/export; UI selected-choice compact action model; served-source freshness acceptance.
Verification test: Four phone embed contexts, real summary shape/duplicates, playable and unsupported latest maps, selected import-to-camera/T-pose, exact one control/surface, no repeated actions, current served UI, privacy/no-winner/release gates.
Related files/components: assembly src/index.js template/renderInteractionShell/browse/select/refreshLibrary/startFromMenu/handleUiIntent; UI aero-product-presenters sharedStyles/BeatSaver/library; authoring persistence summary/service; existing dev:tailscale Vite transform.
Remaining uncertainty: Unseen attachment pixels, exact phone Version DOM/options, real IndexedDB metadata, and post-Music-gate camera/calibration behavior.
```

## Implemented Repair — QA Pending

The UI-owned compact quick-choice contract landed and closed QA at `b777bdb`. Assembly P0 `h8z` now implements the diagnosed owning boundary:

- one opaque `#f3f8fa` drawer surface contains Calibrate/Start and all four sections; computed heading contrast is about 15.65:1;
- the sole 48×48 corner control changes `☰` to `×`; the second drawer-close button no longer exists, while backdrop, Escape, deep focus cycling, and focus restoration remain;
- real `songName`/`difficulty` authoring summaries sort deterministically, preserve the selected package, and feed the UI's concise radios plus one selected Export/Delete area; `library-export` now downloads child-local bytes without snapshot or iframe transport;
- browse results and Version options retain only versions with at least one Standard difficulty, and the first playable version always supplies a Difficulty option;
- Calibrate/Start serializes repeat taps, awaits a pending local selection or imports the selected BeatSaver map, verifies playable content, requests camera exactly once, and closes directly into the fresh T-pose gate; failed import leaves the drawer open and camera untouched;
- Vite resolves `@aerobeat/web-ui` to its linked source with symlink following and an explicit local workspace allow-list. The existing managed `:5173` process auto-reloaded its config without being stopped or replaced; its actual browser DOM now proves no Play button, one local radio, one Export/Delete area, one menu control, and `×` while open.

Direct and real cross-origin iframe matrices at 390×844 and 844×390 now assert the one surface/control, AA contrast, exact drawer text/actions, unsupported-version filtering, failed-import zero-camera behavior, successful selected-map import then one camera request/menu close/T-pose, local quick selection, lifecycle/privacy/no-winner, and renderer overlay invariants. Automated evidence does not replace Derrick's pending phone camera/calibration/play observation.
