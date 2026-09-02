# AeroBeat Web Assembly

Deployable composition shell for the full-parent, reconnectable `<aero-game>` Web Component.

## Embed

```html
<div style="width: 100%; height: 720px">
  <aero-game></aero-game>
</div>
<script type="module" src="/src/index.js"></script>
```

The component fills exactly its parent (`100%` inline/block size). It does not mutate `body`, history, location, or the URL and does not use `100vh`. Construction creates stable renderer/media/UI surfaces only; each `connectedCallback()` creates a fresh service graph and each disconnect synchronously invalidates its generation and begins complete teardown.

There is no `aerobeat-app` alias.

## Public API

Each connected game exposes serializable `getSnapshot()` state and these direct commands:

- `configure(options)`
- `start()`, `pause(reason?)`, `resume()`, `stop()`, `reset()`
- `selectContent(source)`, `selectVariant(variantId, modifierIds?)`
- `browseBeatSaver(query)`, `importBeatSaver(map, version, options)`
- `importLocalZip(blobOrBytes, options)`, `cancelImport()`, `deletePackage(handle)`

Whole-version imports author every exact `Standard` difficulty sequentially into unchanged one-difficulty v1 packages, then commit one atomic downloaded-song collection with content-addressed shared audio. Compact remote rows own Preview/Stop, Version, and Download only. A downloaded collection owns one song radio plus singleton/static or multi/native Difficulty, selected-difficulty Preview/Stop and Export, and whole-collection Delete. Difficulty changes use a serial generation-bound latest-wins drain; presenter truth follows the desired collection/package, preview waits for that exact package generation, and equivalent Flow/experimental Boxing presentation plus requested runtime modifiers are retained with Flow as the only fallback.

The drawer exposes separate `Start` and unranked `Test` actions only for the exact selected downloaded package. `Start` acquires camera/audio and enters the existing calibration/countdown path. `Test` starts that package at song time zero with audio only—no camera, CV, input, calibration, countdown, judgement records, score partitions, persistence, ranking, or history. Test feedback alternates synthetic hit/miss beginning with GREAT, but remains a renderer projection rather than gameplay truth. Visual Test alone enables the PlayCanvas free-fly camera for fine and coarse pointers: desktop right-click toggles captured mouse look with Escape/second-right-click exit and held `WASD`/`Q`/`E` movement; touch uses a bounded two-finger capture toggle and captured one-finger look. A compact accessible DOM panel provides held Forward/Back/Left/Right/Up/Down controls, Normal/Boost, bounded capture/speed state, Reset, and Test-only `Load camera pose` / `Export camera pose` actions. Load is available only from a trusted child-local activation: a hidden `.json,application/json` picker reads at most 16 KiB with fatal UTF-8 decoding, passes unknown JSON through strict renderer authority, releases capture/movement before apply, and discards stale picker/read/apply results after session or connection changes. Export captures the exact active renderer pose and downloads deterministic `aerobeat-gameplay-camera-pose.v1.json` (`application/json`) through a revoked object URL. Neither path uses storage, snapshots, events, telemetry, bridge payloads, upload, or persistence; a loaded pose changes only the live Visual Test camera and can be fine-tuned and re-exported. Scored Play remains fixed-camera, while menu-open, pause, hidden, detach, and destroy release every camera intent and capture. A bottom safe-area-aware Test-only transport consumes only `{active,playing,currentMs,durationMs,musicVolume,soundVolume}` scalars and provides Play/Pause, live forward/backward scrubbing, and an accessible two-slider Music/Sound popover. One strict origin-local `aerobeat.audio-mix.v1` pair synchronizes connected same-document and same-origin instances, applies Music through the audio gain bus in both Test and scored Play, reserves Sound for the SFX bus, and never enters public game snapshots or iframe events. Its generation-bound queue awaits audio Play, serializes Pause before coalesced Seek, synchronizes the paused gameplay clock, renders immediately, and remains paused after scrubbing; scored Play never accepts its rewind intents. Opening the menu pauses either mode; closing it resumes Test directly, while Play requires fresh calibration/countdown. A new explicit Start or Test invalidates the prior session generation and restarts the current song/difficulty/mode at zero. The downloaded-selection gate is UI-only. Legacy host `start` with `payload:null` remains Play-compatible, and exact host starts use `aerobeat/gameplay_session_start` v1 with `purpose:"play"` or `purpose:"visual_test"` while preserving the externally configured direct-host path.
- `setTheme(theme)`
- `selectPrototypeProfile(profileId)`, `importPrototypeProfiles(bundle)`, `exportPrototypeProfiles()`, `resetPrototypeProfiles()`
- `enterFullscreen()`, `exitFullscreen()`
- `injectCameraStream(stream, options)` for direct embeds only
- `executeCommand(command)` for the versioned host contract
- `destroy()`

Events use the composed `aero-game-event` event and the finalized `aerobeat/game_event` v1 record. Public snapshots contain bounded plain telemetry only—never ZIP/audio bytes, `Blob`, `File`, `MediaStream`, tracks, `VideoFrame`, pixels, frames, or screenshots.

## Per-instance graph

Every connection creates isolated BeatSaver vendor, browser authoring Worker/IndexedDB, content runtime, video, CV, calibrated input, Web Audio clock, gameplay coordinator, PlayCanvas renderer, and UI presenter instances. Assembly consumes the canonical static gameplay-icon bundle from `@aerobeat/branding`, delegates private rasterization/atlas ownership to the renderer, and generation-binds fetch/upload so stale connection completions cannot publish. Flow targets use the canonical directional/directionless masks and role colors as textured 3D scene entities. Their exact top-left 4×3 X/Y endpoints are preserved while world Z derives directly from the external song timeline; the colored early/active/late timing floor replaces timing rings. Flow obstacles route exact canonical cells and authoritative `centerTimestampMs→endTimestampMs` interval truth, remain visible through their exact end, and never receive synthetic GREAT/miss feedback. Flow bomb, arc, and burst events are explicitly omitted—not misprojected as Boxing punches—until a dedicated truthful non-scoring renderer contract is approved. Real hit/miss feedback joins only non-shadow gameplay judgements by event ID and begins at each judgement's committed timeline position; GREAT adds the renderer-owned `100 ms` white pulse and `1.0→1.25` scale while both outcomes share the `350 ms` fade. Stable canvas/video/presenter nodes survive ordinary state updates. A `ResizeObserver` measures the actual component content box and passes CSS width, CSS height, and current DPR to the renderer. During countdown and active play, the canvas redraws exactly three current calibrated athlete-space cursors—nose, left wrist, and right wrist—after every gameplay frame. They map through assembly’s canonical normalized 4×3 projection without a second mirror, and disappear on the next clear for invalid confidence, tracking loss, menu pause, source invalidation, or lifecycle teardown; raw camera landmarks and skeleton connections are never used for this overlay.

`AeroGameMediaLeaseCoordinator` is the sole process-wide policy object. Exactly one game owns the requested resource subset: audio-only for Test or camera+audio for Play. Transfer or same-owner resource changes pause the previous ownership before activating the next; callback context and public lease snapshots preserve the exact canonical subset. Resources remain in their domain services and host-owned streams are never stopped by transfer or teardown.

Hidden documents pause gameplay, audio and CV inference while retaining the camera. A visible active lease owner restarts inference through a frozen countdown/calibration gate. Initial and recovery countdowns use exactly one high-contrast DOM cue in ordered full-dwell `3`, `2`, `1`; the cue takes precedence over calibration-release copy once countdown begins. Recovery cannot enter or advance countdown until asynchronous audio pause and seek have truthfully frozen the audio clock at the coordinator timeline, and audio starts only after gameplay enters `playing`. Camera source/mirror/aspect generation changes explicitly invalidate session calibration.

## Locked production CV

Production startup has one route:

- MediaPipe Pose Landmarker Lite float16 `/1/`
- `@mediapipe/tasks-vision` `1.0.1`
- GPU-WebGL
- detection/presence/tracking thresholds `0.5 / 0.5 / 0.5`
- Fast tracking
- Direct full input, no resize
- measured/current gameplay input
- 15fps inference submission ceiling

Assembly has no backend selector and does not route prediction into production gameplay. Release proof rejects MoveNet, TensorFlow pose, ONNX Runtime, and ONNX model assets. CV inference remains independently capped at 15fps while gameplay clocks, target projection, and caller-owned PlayCanvas rendering advance on the browser display cadence. Bounded cadence telemetry reports aggregate display/input/presenter counts and rates without exposing pose frames or media.

## Experimental prototype profiles

Each connection owns an isolated public `AeroPrototypeProfileRegistry` with exact `live_visual`, `between_run_ruleset`, and `converter_regeneration` identities. Visual profiles apply live through the renderer. Scoring profiles are locked while playing/counting down and bind only newly configured/future content between runs. Converter selection remains regeneration-required until a newly authored package carries the selected hash in source provenance, the top conversion trace, all four Boxing traces, and all four Boxing chart prototype records.

Profile bundles remain direct-host data. UI controls emit scalar identity intents which the game resolves against its local registry; snapshots and iframe events expose bounded identity/hash telemetry only, never profile bundles, ZIP/audio/media, settings objects, or generated package records. Gameplay independently resolves Flow, Boxing Lanes, or Boxing Grid plus the retained Boxing Conversion to one exact existing variant. Flow never changes the retained conversion; Balanced Height is only the first-use experimental default. Both Boxing conversions use scrolling lanes for the semantic ruleset and the 4×3 grid for the spatial ruleset. All profiles are experimental and no winner is selected.

Legacy downloaded packages with inverted Flow orientation remain listed, exportable, and deletable, but cannot be selected for Preview, Test, or Play. Selection clears once with `flow_orientation_reimport_required` and does not auto-select the stale package again; reimporting corrected content restores normal exact selection.

## Iframe protocol

Cross-origin embedding uses the immediate parent only. The iframe permission policy should use `allow="camera; fullscreen; autoplay; xr-spatial-tracking"`; the XR token only permits PlayCanvas feature detection and AeroBeat never starts an XR session. The child derives the exact parent origin from `document.referrer` or accepts an explicit `parent-origin` attribute. It requires an exact `aerobeat/iframe_message` v1 `handshake_request` before commands and validates `event.source`, `event.origin`, `instanceId`, protocol version, exact command/message shape, and a 64 KiB message bound.

```js
iframe.contentWindow.postMessage({
  schema: "aerobeat/iframe_message",
  version: 1,
  kind: "handshake_request",
  messageId: "host-1",
  instanceId: "aero-game-1",
  payload: { protocolVersion: 1 }
}, childOrigin);
```

The child owns fullscreen and requests it only from a child UI gesture. Parent policy must delegate `camera; fullscreen; autoplay`. Local ZIP/audio data never crosses the bridge; local imports and raw source bundles remain child-side. Browse/import progress, package handles, normalized gameplay/CV telemetry, and events cross only as bounded plain data.

## Lifecycle

Disconnect/destroy aborts current work, unregisters listeners/observers/bridge, releases the media lease, cancels Worker/fetch/CV generations, destroys input/gameplay/content/renderer services, and tears down audio/video ownership. Late completions cannot publish through the invalidated connection generation. Reconnecting the same element creates a new graph.

## Validation

### Reproducible npm pack modes

Release QA must pack only from an explicitly supplied clean detached worktree. Before packing, normalize tracked files from the Git index (`100644→0644`, `100755→0755`) and assert the result; never run the normalizer against the canonical checkout:

```bash
node scripts/release-pack-policy.js normalize --target /absolute/detached/worktree --commit <exact-commit>
npm pack --dry-run --json --ignore-scripts --pack-destination /absolute/output # run inside that detached worktree
npm pack --json --ignore-scripts --pack-destination /absolute/output > /absolute/output/package.pack.json # run inside that detached worktree
node /path/to/main/scripts/release-pack-policy.js verify \
  --target /absolute/detached/worktree --commit <exact-commit> \
  --archive /absolute/output/package.tgz \
  --manifest /absolute/output/package.manifest.tsv
npm run test:release-pack-policy
```

The verifier accepts no caller-supplied metadata authority. It requires exact Node `22.22.3`, invokes npm `10.9.8` directly through its pinned CLI with lifecycle scripts disabled, and derives the sole package inventory/hash record from the already-normalized clean detached target inside fresh isolated cache/temp/home/output directories outside both checkouts under a sanitized locale/environment. Both npm subprocesses run under validated absolute GNU coreutils `timeout`: the version check has a `15 s` deadline, dry-pack derivation has a `120 s` deadline, and either receives process-group `TERM` followed by `KILL` after a `2 s` grace period. Timeout failures are operation-specific, use GNU `--preserve-status` plus monotonic deadline consumption rather than child-controlled stderr text, return control to guarded owned-root cleanup, and expose no environment override for these source-policy limits. It then binds the caller archive to that independent package identity, exact metadata schema/inventory, byte length, SHA-1, and SHA-512 integrity; requires one canonical gzip member with its fixed header, complete deflate boundary, CRC32/ISIZE trailer, and exact EOF; and byte-compares every complete npm USTAR regular-file header against the detached target, Git/bin-derived mode, canonical ASCII path split, size, portable zero ownership/name/link fields, pinned mtime, checksum, and reserved bytes. Content and padding must match exactly; self-authored empty/partial/reordered/extended packages reject under the internally derived authority; PAX/directories/links/base-256/noncanonical fields reject; and the tar ends with exactly two zero blocks. All archive/manifest/temp/cache locations are constrained outside protected checkouts, and the CLI accepts only each documented command's exact option schema. This release tooling does not rebuild or version raw output.

The current deterministic raw release proof is `0.0.33`; every `0.0.32` and older release byte remains immutable. It contains the audited post-session menu stability repair, conventional camera-on-`+Z`/future-`-Z` world basis, and private deterministic Visual Test camera-pose export; the retained default artifact is exactly 488 bytes with SHA-256 `55ea553d68c40fc56e448a9ae21f741bfebbe4f04de48861ac32a5a09238c01a`. The tracked raw `0.0.31` still physically reproduces its defect with `hidden=true`, computed `display:grid`, and nonzero popover geometry, while linked audited UI source corrects closed rendering to computed `display:none` and zero geometry. This cursor/volume iteration preserves PlayCanvas plus DOM as the sole gameplay presentation path for Flow, Boxing Lanes, and Boxing Grid, retains both Balanced Height and Source Height conversions, and keeps the corrected scene-facing perspective camera. Desktop Visual Test restores the authored cursor only after confirmed pointer-lock release while preserving right-click/Escape exit, re-entry, smooth captured mouse look, and gradual held camera-relative `WASD`/`Q`/`E` movement; touch Visual Test retains its bounded capture/look and accessible movement panel. A private origin-local `0.5/0.5` Music/Sound mix now synchronizes connected same-document and same-origin instances, persists only two bounded scalars, drives actual Music gain in Test and scored Play, and reserves Sound for the future SFX bus without extending public snapshots, iframe events, or capability schemas. Strict direct/iframe portrait/landscape DPR1/3 evidence proves that the popover is physically absent by default and after button, outside-pointer, outside-click, Escape, inactive, detach, and reconnect closure paths; every open state is a nonzero grid, and the complete GUI/capture/movement/volume lifecycle and privacy boundaries remain exact. The timestamp-driven 3D timing floor, duration-aware Flow obstacle volumes, Play/Pause/live scrubbing, exact 4×3 scoring/input, lifecycle, and scoring truth remain unchanged. Owner release gates and repeated raw/pack construction establish semantic byte-for-byte determinism; exact final npm-pack metadata is kept only in the external release Bead because this README is itself packed. Hardware cursor visibility, corrected physical volume appearance/interaction, and audible Music/SFX behavior remain explicitly Physical Pending, and no gameplay, conversion, or Theme winner is selected.

```bash
npm run check
npm test
npm run test:browser
npm run test:v4-integration
npm run test:live-flow-obstacles
npm run build
npm run build-release
# Optional, network-dependent current-map proof:
npm run test:live-v4-import
# Optional exact multi-difficulty download/preview proof:
npm run test:live-catalyst
```

Chromium validation covers direct embedding, exact parent sizing, stable surfaces, child fullscreen, all five variants, resource-aware lease transfer, hidden policy, reconnect/teardown, canonical atlas pixels and stale-upload suppression, exact real-judgement feedback boundaries, immediate audio-only unscored Test with alternating synthetic outcomes, Test menu resume, generation-safe cross-song Test→Play restart, legacy/exact host start routing, strict cross-origin handshake/origin/source validation, unsafe payload rejection, and zero unexpected console warnings/errors. Completed Visual Test and completed Play additionally drive held physical pointerdown/dwell/pointerup/change timing while playback truth continues publishing: song, downloaded Difficulty, Gameplay, and Conversion intents must reach the same connected native control, retain drawer scroll through the hold, and commit the exact selected package/ruleset/recipe without playback-only full-menu reconstruction. The normal network-independent gate also drives an independently hard-coded v4 provider-hash golden through the actual vendor, authoring, persistence, library, and selection path; rejects tampered v4 bytes; and preserves v2/v3 local ZIP imports. The optional live gate fetches exact current map/version `53F26` / `addd9d6f8e7340ad6f5633947136d8475a7a99b5`, persists and selects all five authored variants without requesting camera, verifies bounded public data, then deletes its ephemeral package. A final physical Chromium/Android secure-context camera/calibration/playability handoff remains part of the cross-repo QA task.
