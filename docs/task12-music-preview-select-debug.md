# Task 12 Music Selector and Preview Debug Record

## Exact Observed Failure

Derrick physically tested the current Tailscale build on Android and selected the K-pop Demon Hunters “Soda Pop” map identified in the menu by `bd4eb4e8`. Two controls appeared below the selected song. Tapping either control did not show a chooser. Derrick described the first as apparently displaying the song ID and the second as the difficulty selector.

Derrick also requested one Preview action above the remote song's Version/Difficulty controls. While preview audio is playing, that action must become Stop. The same Preview/Stop behavior must be available for previously downloaded songs in the local library.

Provider inspection resolves the physical selection exactly:

- BeatSaver map ID: `4BE5E`
- map name: `Saja Boys - Soda Pop (From Kpop Demon Hunters)`
- selected version hash: `bd4eb4e885a3b055d7b7eacdd61882946e39e0c4`
- remote preview: `https://cfcdn.beatsaver.com/bd4eb4e885a3b055d7b7eacdd61882946e39e0c4.mp3`
- Standard difficulties: `Hard` only
- provider versions: one

The 8-character value shown to Derrick is a version-hash prefix, not the map ID.

## Expected Behavior

A control must not look like an actionable dropdown when it has no alternative values. Version and Difficulty remain native selects when multiple options exist; a singleton becomes a concise labeled read-only value.

For a selected remote BeatSaver map, Preview appears above Version/Difficulty. Activating it starts the provider preview clip and changes the same action to Stop. For a selected downloaded local package, Preview/Stop appears in the selected package's single compact action area.

Only one preview may exist at a time. Preview playback must remain child-local and independent of gameplay audio, camera, scoring, timeline, and media leases. It must stop and release resources when the target changes, the menu closes, Calibrate/Start begins, the document hides, the component disconnects/reconnects, or the service is destroyed. Raw audio bytes, Blobs, object URLs, frames, pixels, and media objects must never enter snapshots or iframe messages.

## Execution Path

### Remote selection

1. Search dispatches `beatsaver-search` from `AeroBeatSaverBrowser`.
2. Assembly calls the vendor search service and stores normalized maps internally.
3. Selecting a map calls `selectBrowsedMap()`.
4. Assembly filters playable versions and supplies `beatSaverView.versions`, `selectedVersionHash`, `difficulties`, and `selectedDifficulty` to the UI presenter.
5. The presenter currently renders both fields as native `<select>` elements regardless of option count.
6. In compact mode, both visible field labels are clipped.
7. For `4BE5E`, Version has exactly one option and Difficulty has exactly one option.
8. Android receives a native select with no alternative selection and provides no meaningful picker interaction, which appears broken.

### Remote preview capability

1. The normalized selected provider version already contains `previewUrl` internally.
2. `mapSummary()` currently does not expose preview availability/state to the presenter.
3. No preview intent or child-local preview player exists.
4. The exact provider MP3 returned HTTP 200, `audio/mpeg`, 162,912 bytes and loaded in Chromium with a 10.182-second duration and ready state 4.

### Local preview capability

1. A compact library radio selects a persisted authoring summary.
2. Assembly loads the selected package through authoring/content and verifies its audio asset.
3. `content.readAsset(audio.filePath)` returns a defensive child-local byte copy.
4. The exact downloaded Soda Pop source audio is `SODA POP.egg`, 2,770,727 bytes.
5. Chromium loaded those bytes from a child-local `Blob` as `audio/ogg`, duration 154.108 seconds, ready state 4; removing the source and revoking the object URL succeeded.
6. No compact local Preview intent or dedicated preview player exists today.

### Vite worker warning

A prior managed-server log contained a transient `conversion-worker.js` outside-allow-list warning while Vite config was being changed. Current local and Tailscale `/@fs/.../conversion-worker.js` requests both return HTTP 200. This warning is historical and is not a current root cause.

## Most Likely Root Cause

The physical selector symptom is a misleading singleton presentation, not missing metadata or blocked input:

- actual-route Chromium measured each control at 294×42px;
- both are enabled with `pointer-events:auto`;
- each has one label association;
- Soda Pop exposes one Version option and one Difficulty option;
- a comparison map (`47FB6`) exposes four Difficulty options in the same presenter;
- programmatically selecting `Expert` on that multi-option control updates `beatSaverView.selectedDifficulty` correctly.

Compact mode clips the short Version/Difficulty labels, worsening the ambiguity: the user sees only a hash prefix and `Hard`, both styled as dropdowns that cannot choose anything else.

Preview is absent because the UI has no preview intents/state and assembly has no dedicated preview media owner. Provider preview metadata and verified local audio are both available, so this is a missing product path rather than unavailable media.

## Alternative Hypotheses

1. **CSS or overlay blocks native selects** — contradicted by enabled state, pointer events, 42px bounds, labels, and successful multi-option selection in the same presenter.
2. **Difficulty metadata is empty** — contradicted by provider and assembly state showing exactly `Hard`.
3. **The selected hash belongs to a different song** — contradicted by live provider lookup resolving the prefix to map `4BE5E` Soda Pop.
4. **Provider preview CORS prevents playback** — a plain child-local `HTMLAudioElement` loaded metadata successfully. The implementation must not require fetch/WebAudio CORS for the remote URL.
5. **Persisted `.egg` audio is not browser-decodable** — contradicted by successful Chromium Blob decoding as Ogg.
6. **Current Vite worker allow-list prevents import** — current local and Tailscale worker URLs return 200; the warning occurred during an earlier config reload.

## Why Previous Fixes Failed

The prior repair correctly filtered maps/versions to Standard difficulties and guaranteed nonempty selector data. Its tests asserted option counts, field geometry, and programmatic state changes. They did not physically model the usability of a native select with exactly one option and compact-hidden labels.

The prior local-library repair intentionally reduced repeated Play/Export/Delete rows but did not include preview semantics. Existing audio tests cover gameplay playback, not a separate menu preview lifecycle.

## Unknowns

- Android vendor UI details for a one-option native select vary by browser/OS. This does not change the core requirement: no false chooser affordance when no choice exists.
- Local authored packages do not preserve BeatSaver preview start/duration metadata. The deterministic first local clip should therefore be bounded to 10 seconds unless future schema work adds provider preview timing.
- Some local source codecs may be unsupported by a given browser. Preview errors must remain concise and must not corrupt the selected playable package or gameplay audio.

## Minimal Reproduction

### Singleton

1. Open the existing Tailscale route on Android.
2. Search `kpop demon hunters soda pop song`.
3. Select map `4BE5E` / hash prefix `bd4eb4e8`.
4. Observe two unlabeled select-shaped controls.
5. Tap either; there are no alternative options.

### Multi-option control

1. Select map `47FB6`.
2. Difficulty contains Normal, Hard, Expert, and ExpertPlus.
3. Selecting Expert updates assembly state.

### Remote preview proof

Load the exact provider MP3 in a child-local audio element; Chromium reports duration 10.182 seconds and ready state 4.

### Local preview proof

Load the verified `SODA POP.egg` bytes into a child-local `Blob` with `audio/ogg`; Chromium reports duration 154.108 seconds and ready state 4; then clear the source and revoke the URL.

## Proposed Verification

1. UI presenter fixtures for zero, one, and multiple versions/difficulties.
2. Singleton fields render labeled static values and no select/false chevron.
3. Multi-option fields remain native 42px selects and commit through `change`.
4. Remote Preview is above the fields and toggles Preview→Stop→Preview on play/stop/ended/error.
5. Local selected package has one Preview/Stop action alongside its one Export/Delete area.
6. A single child-local audio element owns all preview playback.
7. Remote preview uses internal selected-version URL; intent payload contains IDs only.
8. Local preview loads exact selected package, obtains verified bytes locally, creates a bounded Blob URL, plays at most 10 seconds, then revokes it.
9. Switching target/version/difficulty/package stops the old preview before updating state.
10. Menu close, Calibrate/Start, hidden document, disconnect, graph replacement, and destroy stop playback and release URLs/timers/listeners.
11. Preview never changes gameplay audio status/clock/source, camera request count, gameplay session state, selected content, or media lease.
12. Direct and real cross-origin iframe tests at 390×844 and 844×390 recursively reject raw audio/media/Blob/object URL keys and types in snapshots/messages.
13. Exact live `4BE5E` remote preview and imported local preview both play/stop on the existing managed route.

## Recommended Fix

### UI-owned presentation

- Add bounded preview state to `AeroBeatSaverBrowser` and `AeroContentLibrary` presenter snapshots.
- Add `beatsaver-preview-toggle` above selected-map Version/Difficulty.
- Add `library-preview-toggle` only in the selected compact package action area.
- The same button reads Preview when idle/error/ended and Stop while loading/playing.
- Render a concise labeled static value when a field has one option; retain native select only for two or more options.
- Keep noncompact development behavior compatible unless preview is intentionally added there with the same public intent contract.

### Assembly-owned playback

- Own exactly one hidden dedicated `HTMLAudioElement`, timer, target identity, generation, and optional object URL.
- Remote intent resolves preview URL from assembly's private normalized map/version store; never trust or echo a URL from UI intent.
- Local intent resolves the exact selected package, loads it if needed, reads verified audio bytes child-locally, maps the extension to a bounded audio MIME type, creates a Blob URL, and starts from zero for at most 10 seconds.
- Stop is idempotent and clears listeners/timer/source/object URL before publishing presenter state.
- Stop preview before any target/selection/menu/lifecycle/start transition.
- Preview playback must not use `graph.audio` and must not participate in gameplay audio synchronization.

## Debugging Record

```text
Problem: Soda Pop Version/Difficulty controls appear inert; Preview/Stop is missing for remote and local songs.
Observed symptom: Android tapping both controls opens no useful chooser; exact map has one version and Hard only.
Root cause: singleton native selects with clipped labels create a false dropdown affordance; preview path is unimplemented despite available remote URL and verified local bytes.
Evidence: exact 4BE5E provider metadata; enabled 294x42 pointer-auto controls with one option each; multi-difficulty 47FB6 selection works; remote MP3 and local .egg Blob both decode in Chromium.
Failed approaches: prior tests proved nonempty data/programmatic selection but did not test singleton physical affordance; prior library simplification omitted preview lifecycle.
Corrective action: static labeled singleton values, native selects only for real choices, UI preview intents/state, one assembly-owned child-local preview element.
Verification test: live 4BE5E remote preview plus imported local preview, lifecycle teardown, gameplay-audio isolation, direct/iframe privacy and phone matrices.
Related files/components: web-ui aero-product-presenters.js/tests; assembly index.js/mobile/product-shell tests/template; plan/handoff/release.
Remaining uncertainty: browser codec availability for arbitrary local packages; use concise non-destructive errors.
```
