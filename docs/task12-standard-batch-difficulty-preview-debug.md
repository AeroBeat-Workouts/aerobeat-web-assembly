# Task 12 Standard Batch, Downloaded Difficulty, and Preview Debug Record

## Exact Observed Failure

Derrick’s Android physical test on assembly `a88460b` reported:

1. The Difficulty selector did not open a dropdown.
2. Remote Preview worked and Stop worked.
3. After downloading Linkin Park – The Catalyst, Preview for the downloaded song did not work.
4. The intended but previously unstated product contract is version-level download of the whole song plus every normal chart, followed by Difficulty selection on the downloaded song. Lightshow and other nonstandard characteristics are irrelevant to gameplay.
5. Gameplay physical testing had not yet resumed when this report was requested.

The exact map is BeatSaver `1AE3A`, version `1348bac90dd94d7299bda388bd101a2b967e28b3`, with exactly two provider-advertised playable entries: Standard Expert and Standard ExpertPlus.

Directly observed physical facts end at the three UI/playback behaviors above. The phone’s preview media error/event and IndexedDB package/content identities were not captured, so this report distinguishes confirmed architectural defects from the still-unobserved exact media failure.

## Expected Behavior

### Remote discovery

- Select a BeatSaver map/version.
- Preview and Stop operate at version level.
- Compact product UI shows Preview, Version, and Download only.
- No remote Difficulty selector appears.

### Download/authoring

- Acquire the selected version archive exactly once.
- Treat the verified archive manifest as authoritative.
- Enumerate unique exact `Standard` difficulties in canonical order: Easy, Normal, Hard, Expert, ExpertPlus.
- Convert every Standard difficulty into its existing one-Flow-plus-four-Boxing v1 package.
- Ignore Lightshow, OneSaber, NoArrows, 90Degree, 360Degree, Lawless, and custom characteristics as playable charts.
- Preserve all source paths required by BeatSaver provider-hash verification, including ignored characteristics/shared v4 lightshow data.
- Atomically persist the complete difficulty batch, one downloaded collection, and one content-addressed audio blob. A failure/cancel/quota error leaves no partial new collection.

### Downloaded library

- Show one radio per downloaded song/version collection.
- The selected downloaded song owns Preview, Difficulty, Export, and Delete actions.
- Difficulty is a native select only for two or more downloaded Standard difficulties; one difficulty is a labeled static value.
- Difficulty changes load the exact package while preserving the equivalent Flow/Boxing presentation and requested runtime modifiers.
- Preview always targets the selected downloaded song’s active difficulty package and shared audio.
- Existing single-difficulty inline-asset records remain usable as singleton collections.

## Execution Path

### Current remote selector/import path

1. Assembly selects the first playable version and derives Standard difficulty names.
2. Compact UI renders Preview, Version, Difficulty, and Import.
3. `compactChoiceFieldMarkup()` intentionally returns a static `<output>` for a singleton and a native `<select>` only for multiple options.
4. Import sends map ID, version hash, and one difficulty ID.
5. Vendor acquisition already downloads/verifies the whole version ZIP once.
6. Assembly passes one selected difficulty to authoring.
7. Authoring `prepareSourceMaterial()` selects one Standard path and reads that chart plus audio.
8. `convertAndPersist()` converts and persists exactly one package.
9. The other Standard charts already present in the downloaded archive are discarded from playable authoring.

### Current downloaded-library path

1. Persistence stores one record per authored difficulty package, including inline audio bytes.
2. `summaryFor()` exposes package ID/hash, song name, one difficulty, timestamp, and counts, but not exact source grouping provenance.
3. Assembly renders one library radio per package.
4. Difficulty is embedded in each package label; there is no downloaded-song Difficulty field.
5. Selecting a package starts an asynchronous load and stores one unversioned `pendingLibrarySelection` promise.
6. `renderPresenters()` can force selected UI truth back to the currently loaded `content.packageId` while a different package is pending.
7. Rapid package selections have no latest-wins generation; an older load can overwrite a newer request.
8. `toggleLibraryPreview()` requires both `libraryView.selectedPackageId === packageId` and loaded `content.packageId === packageId` after awaiting the pending selection.
9. If UI/library/content identities diverge, Preview fails as “Downloaded song is still loading,” and the public error is collapsed to “Preview unavailable. Try again.”
10. Package selection stops any current preview and package loading defaults selected presentation to Flow.

### Current downloaded preview media path

1. Preview requires the selected package to be loaded in content.
2. It reads the selected package’s declared audio asset bytes.
3. It creates a child-local Blob URL and assigns it to the dedicated hidden preview `HTMLAudioElement`.
4. Playback is capped at ten seconds and isolated from gameplay audio.
5. Stop/selection/menu/hidden/reconnect/destroy cleans listeners, timer, source, and Blob URL.

This media path worked in prior real downloaded-song testing. The physical Catalyst failure therefore occurs before or inside package/audio identity resolution or native media playback, not in the remote preview path.

## Most Likely Root Cause

### Confirmed root cause: nonfunctional/misplaced Difficulty interaction

The current product implements a different contract. Difficulty is selected before import, and authoring persists only that one difficulty. Downloaded content has no Difficulty selector at all. A singleton compact field is deliberately static and cannot open; a multi-option remote field is still conceptually misplaced. The Catalyst archive contains two Standard difficulties, but the current import stores only the selected one, so the intended downloaded dropdown cannot exist.

### Confirmed structural defect: downloaded selection can target stale package content

Assembly has no generation-bound latest-wins package selection. Presenter truth can snap back to old loaded content during a pending selection, while local Preview requires exact equality among UI selection, library selection, and loaded content. This creates a deterministic code path where the visible selected-song Preview targets a package other than the loaded audio package and fails before Blob playback.

### Exact Catalyst native preview failure: not yet conclusively isolated

The physical symptom is authoritative, but no phone media event or package-ID trace was captured. The stale selection defect is the leading code-level cause and the new collection architecture must remove it. A Catalyst-specific codec/native playback failure remains possible until the exact archive audio bytes are played through the repaired selected-collection path on Android.

## Alternative Hypotheses

1. **Stale library/content package identity — highest likelihood.** Supported by source-level selection snapback, unversioned async loads, exact preview equality checks, and generic “still loading” collapse.
2. **Native codec/container incompatibility for Catalyst audio — possible.** Remote provider preview uses a different URL/media encoding. Downloaded preview uses the archive audio Blob. Prior `.egg` downloaded playback succeeded, so this is map/device-specific rather than a general Blob-path defect.
3. **Preview clicked before asynchronous package load settled — possible and adjacent to hypothesis 1.** The method awaits one global pending promise, but that promise is not bound to the exact requested selection generation.
4. **Missing authored audio — lower likelihood.** Product imports pass `includeAudio:true`; current converter declares audio and persistence retains assets. A partial/old package could still expose a missing asset.
5. **Preview cleanup cancels its own start — lower likelihood.** Current token sequencing passed focused and prior physical tests, but selection rerenders can call `stopPreview()` during package changes.
6. **Remote Difficulty select event defect — contradicted for singleton fields.** Singleton compact values are outputs by design. For Catalyst’s two advertised difficulties, the remote field should be a real select before import, but that behavior is obsolete under the clarified contract.

## Why Previous Fixes Failed

- The previous preview repair validated one remote exact map and one downloaded local package. It did not test downloading while another package was already loaded, rapid package selection, or two packages grouped as one song.
- Singleton Version/Difficulty outputs correctly removed false dropdown affordances for one-option remote maps, but the larger product assumption—that Difficulty belongs before import—was wrong.
- Existing library tests model package-per-row selection. They do not model one song/version collection with multiple difficulties.
- Preview tests bind one package identity and therefore cannot expose presenter snapback or stale async selection.
- Assembly refresh after import can retain an older loaded package as selected truth even while loading the new authored result.
- The authoring service is intentionally single-difficulty and persistence stores inline assets, so a naive assembly loop would produce partial batches and duplicate audio.

## Unknowns

- Exact Android `HTMLMediaElement.error` code/message for Catalyst archive audio.
- Exact phone-side selected library package ID versus loaded content package ID at the failed Preview click.
- Catalyst archive audio codec/container details as interpreted by the Android browser.
- Whether Derrick clicked Preview immediately after Download completion or after explicitly changing the library radio.
- Export granularity was not specified. The recommended backward-compatible behavior is Export = current difficulty package; Delete = whole downloaded collection.
- Multiple versions of the same map need concise disambiguation without hashes. Recommended behavior is separate rows with deterministic human numbering when no concise provider version label exists.

## Minimal Reproduction

### Contract mismatch

1. Select Catalyst `1AE3A` / `1348bac90dd94d7299bda388bd101a2b967e28b3`.
2. Observe remote Expert/ExpertPlus choice.
3. Import one.
4. Observe one downloaded package row labeled with one difficulty and no local Difficulty selector.

### Stale preview identity

1. Begin with package A loaded.
2. Import or select package B.
3. While B is pending, render presenters or request another selection.
4. UI selection can reconcile to A while library selection/pending target B differs.
5. Click local Preview and observe exact package equality fail before audio-byte playback.

### Exact physical failure

On Android HTTPS, remotely preview Catalyst, Stop, Download, then use the downloaded song’s Preview. Remote succeeds; current downloaded preview fails. Capture selected library package, loaded content package, audio path/byte count/MIME, preview state transition, and native media error locally without exposing raw bytes.

## Proposed Verification

1. Add deterministic deferred A→B and A→B→C loads. Assert latest request wins and stale completions cannot overwrite selected content/actions.
2. Bind preview wait/token to the exact collection/package selection generation. Assert it reads only that package’s audio.
3. Reproduce Catalyst with exact version hash in direct and real iframe phone contexts; prove remote preview, one archive acquisition, atomic Expert+ExpertPlus authoring, one shared audio blob, downloaded Preview/Stop, and no gameplay-audio mutation.
4. Use a mixed-characteristic v4 fixture with Standard Easy/Hard/Expert plus Lightshow/OneSaber. Assert only the three Standard packages are playable while provider hash inputs remain valid.
5. Simulate conversion failure, cancellation, and quota failure at every batch step. Assert zero partial packages/collections/assets.
6. Reload offline from IndexedDB; one collection row and local Difficulty select remain functional.
7. Switch Expert↔ExpertPlus and preserve selected Flow/Boxing presentation and runtime modifiers while package/map/score identities change.
8. Verify shared audio quota counts bytes once, package read/export resolves a copy, and collection deletion garbage-collects only unreferenced blobs.
9. Verify legacy inline single-difficulty packages load, preview, export/delete, and render a static Difficulty.
10. Recursively inspect public snapshots/events/iframe messages: no archive/audio bytes, Blob/object URLs, raw provider DTOs, source hashes, or hidden grouping provenance.

## Recommended Fix

### Authoring/persistence

- Add all-Standard source preparation with canonical ordering and duplicate rejection.
- Reuse the existing one-difficulty worker sequentially; never send audio into the Worker.
- Add a batch service that converts and validates every result before persistence.
- Upgrade persistence with collections and a content-addressed audio store. Atomically write N existing v1 packages, one collection, and one audio blob.
- Keep v2 inline records readable as singleton collections; make migration lazy/non-destructive.
- Extend bounded package summaries with exact safe grouping metadata or collection summaries.

### UI

- Compact remote detail becomes Preview, Version, Download; remove remote Difficulty and its product intent.
- Compact local library becomes one radio per collection. Selected collection owns Preview, Difficulty, Export, Delete.
- Use a native Difficulty select for two or more stored Standard packages and a labeled static output for one.
- Preserve default/development presenter compatibility separately where required.

### Assembly

- Use version-only batch authoring for remote Download and Calibrate/Start fallback.
- Group/select by collection identity, not song name.
- Make package selection generation-bound/latest-wins and keep presenter truth on the pending exact target.
- Bind Preview to the selected collection’s active package and wait for that exact load.
- Preserve equivalent profile presentation and requested modifiers across difficulty switches.
- Delete a collection atomically; export the currently selected difficulty package in the existing format.

## Debugging Record

```text
Problem: Difficulty is selected before import and downloaded Catalyst Preview fails; intended contract is whole-version Standard batch plus local Difficulty selection.
Observed symptom: Difficulty does not open; remote Catalyst Preview/Stop works; downloaded Catalyst Preview does not.
Root cause: Confirmed product-contract mismatch stores only one selected difficulty and has no local selector. Confirmed unversioned package selection/presenter snapback can make local Preview target content from another package. Exact Catalyst native media failure remains unobserved.
Evidence: Catalyst 1AE3A has one version with Standard Expert/ExpertPlus; assembly passes one difficulty; authoring prepares/persists one package; local UI is package-per-row; Preview requires selected and loaded package IDs to match.
Failed approaches: Prior singleton-output and one-package preview tests validated the old pre-download-difficulty model and did not exercise multi-package grouping or stale selection.
Corrective action: Atomically author all verified Standard difficulties into grouped v1 packages with one shared audio blob; move Difficulty to downloaded collection; make selection/preview latest-wins and exact-target-bound.
Verification test: Exact Catalyst one-fetch/two-package/one-audio/one-row Expert↔ExpertPlus local Preview plus mixed-characteristic exclusion, rollback, offline reload, legacy, privacy, direct/iframe phone matrices.
Related files/components: vendor archive/service; content-authoring source-material/service/worker/persistence; assembly import/library/preview; UI product presenters; content runtime; gameplay package reconfiguration.
Remaining uncertainty: Catalyst Android native media error and exact failed phone package identities; export/version-label product details.
```
