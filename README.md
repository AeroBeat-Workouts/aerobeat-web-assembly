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
- `setTheme(theme)`
- `enterFullscreen()`, `exitFullscreen()`
- `injectCameraStream(stream, options)` for direct embeds only
- `executeCommand(command)` for the versioned host contract
- `destroy()`

Events use the composed `aero-game-event` event and the finalized `aerobeat/game_event` v1 record. Public snapshots contain bounded plain telemetry only—never ZIP/audio bytes, `Blob`, `File`, `MediaStream`, tracks, `VideoFrame`, pixels, frames, or screenshots.

## Per-instance graph

Every connection creates isolated BeatSaver vendor, browser authoring Worker/IndexedDB, content runtime, video, CV, calibrated input, Web Audio clock, gameplay coordinator, WebGL renderer, and UI presenter instances. Stable canvas/video/presenter nodes survive ordinary state updates. A `ResizeObserver` measures the actual component content box and passes CSS width, CSS height, and current DPR to the renderer.

`AeroGameMediaLeaseCoordinator` is the sole process-wide policy object. Exactly one game owns camera/audio activity. Transfer pauses the previous owner before activating the next; resources remain in their domain services and host-owned streams are never stopped by transfer or teardown.

Hidden documents pause gameplay, audio and CV inference while retaining the camera. A visible active lease owner restarts inference through a frozen countdown/calibration gate. Camera source/mirror/aspect generation changes explicitly invalidate session calibration.

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

Assembly has no backend selector and does not route prediction into production gameplay. Release proof rejects MoveNet, TensorFlow pose, ONNX Runtime, and ONNX model assets.

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

```bash
npm run check
npm test
npm run test:browser
npm run build
npm run build-release
```

Chromium validation covers direct embedding, exact parent sizing, stable surfaces, child fullscreen, all five variants, two-instance lease transfer, hidden policy, reconnect/teardown, strict cross-origin handshake/origin/source validation, unsafe payload rejection, and zero unexpected console warnings/errors. A final physical Chromium/Android secure-context camera/calibration/playability handoff remains part of the cross-repo QA task.
