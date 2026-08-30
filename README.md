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

The drawer exposes separate `Start` and unranked `Test` actions only for the exact selected downloaded package. `Start` acquires camera/audio and enters the existing calibration/countdown path. `Test` starts that package at song time zero with audio only—no camera, CV, input, calibration, countdown, judgement records, score partitions, persistence, ranking, or history. Test feedback alternates synthetic hit/miss beginning with GREAT, but remains a renderer projection rather than gameplay truth. Opening the menu pauses either mode; closing it resumes Test directly, while Play requires fresh calibration/countdown. A new explicit Start or Test invalidates the prior session generation and restarts the current song/difficulty/mode at zero. The downloaded-selection gate is UI-only. Legacy host `start` with `payload:null` remains Play-compatible, and exact host starts use `aerobeat/gameplay_session_start` v1 with `purpose:"play"` or `purpose:"visual_test"` while preserving the externally configured direct-host path.
- `setTheme(theme)`
- `selectPrototypeProfile(profileId)`, `importPrototypeProfiles(bundle)`, `exportPrototypeProfiles()`, `resetPrototypeProfiles()`
- `enterFullscreen()`, `exitFullscreen()`
- `injectCameraStream(stream, options)` for direct embeds only
- `executeCommand(command)` for the versioned host contract
- `destroy()`

Events use the composed `aero-game-event` event and the finalized `aerobeat/game_event` v1 record. Public snapshots contain bounded plain telemetry only—never ZIP/audio bytes, `Blob`, `File`, `MediaStream`, tracks, `VideoFrame`, pixels, frames, or screenshots.

## Per-instance graph

Every connection creates isolated BeatSaver vendor, browser authoring Worker/IndexedDB, content runtime, video, CV, calibrated input, Web Audio clock, gameplay coordinator, WebGL renderer, and UI presenter instances. Assembly consumes the canonical static gameplay-icon bundle from `@aerobeat/branding`, delegates private rasterization/atlas ownership to the renderer, and generation-binds fetch/upload so stale connection completions cannot publish. Flow targets use the canonical directional/directionless masks with role color, a white same-mask `1.12×` outline, fixed icon size, and a contracting colored approach ring. Real hit/miss feedback joins only non-shadow gameplay judgements by event ID and begins at each judgement's committed timeline position; GREAT adds the renderer-owned `100 ms` white pulse and `1.0→1.25` scale while both outcomes share the `350 ms` fade. Stable canvas/video/presenter nodes survive ordinary state updates. A `ResizeObserver` measures the actual component content box and passes CSS width, CSS height, and current DPR to the renderer. During countdown and active play, the canvas redraws exactly three current calibrated athlete-space cursors—nose, left wrist, and right wrist—after every gameplay frame. They map through the renderer plan’s 4×3 grid without a second mirror, and disappear on the next clear for invalid confidence, tracking loss, menu pause, source invalidation, or lifecycle teardown; raw camera landmarks and skeleton connections are never used for this overlay.

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

Assembly has no backend selector and does not route prediction into production gameplay. Release proof rejects MoveNet, TensorFlow pose, ONNX Runtime, and ONNX model assets. CV inference remains independently capped at 15fps while gameplay clocks, target interpolation, and WebGL rendering advance on the browser display cadence. Bounded cadence telemetry reports aggregate display/input/presenter counts and rates without exposing pose frames or media.

## Experimental prototype profiles

Each connection owns an isolated public `AeroPrototypeProfileRegistry` with exact `live_visual`, `between_run_ruleset`, and `converter_regeneration` identities. Visual profiles apply live through the renderer. Scoring profiles are locked while playing/counting down and bind only newly configured/future content between runs. Converter selection remains regeneration-required until a newly authored package carries the selected hash in source provenance, the top conversion trace, all four Boxing traces, and all four Boxing chart prototype records.

Profile bundles remain direct-host data. UI controls emit scalar identity intents which the game resolves against its local registry; snapshots and iframe events expose bounded identity/hash telemetry only, never profile bundles, ZIP/audio/media, settings objects, or generated package records. All profiles are experimental and no winner is selected.

## Iframe protocol

Cross-origin embedding uses the immediate parent only. The child derives the exact parent origin from `document.referrer` or accepts an explicit `parent-origin` attribute. It requires an exact `aerobeat/iframe_message` v1 `handshake_request` before commands and validates `event.source`, `event.origin`, `instanceId`, protocol version, exact command/message shape, and a 64 KiB message bound.

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

The current deterministic raw release proof is `0.0.25`. Automated gates do not replace the operator-owned phone checks in `docs/task14-flow-feedback-test-mode-physical-handoff.md`.

```bash
npm run check
npm test
npm run test:browser
npm run test:v4-integration
npm run build
npm run build-release
# Optional, network-dependent current-map proof:
npm run test:live-v4-import
# Optional exact multi-difficulty download/preview proof:
npm run test:live-catalyst
```

Chromium validation covers direct embedding, exact parent sizing, stable surfaces, child fullscreen, all five variants, resource-aware lease transfer, hidden policy, reconnect/teardown, canonical atlas pixels and stale-upload suppression, exact real-judgement feedback boundaries, immediate audio-only unscored Test with alternating synthetic outcomes, Test menu resume, generation-safe cross-song Test→Play restart, legacy/exact host start routing, strict cross-origin handshake/origin/source validation, unsafe payload rejection, and zero unexpected console warnings/errors. The normal network-independent gate also drives an independently hard-coded v4 provider-hash golden through the actual vendor, authoring, persistence, library, and selection path; rejects tampered v4 bytes; and preserves v2/v3 local ZIP imports. The optional live gate fetches exact current map/version `53F26` / `addd9d6f8e7340ad6f5633947136d8475a7a99b5`, persists and selects all five authored variants without requesting camera, verifies bounded public data, then deletes its ephemeral package. A final physical Chromium/Android secure-context camera/calibration/playability handoff remains part of the cross-repo QA task.
