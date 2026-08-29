# `aero-game` assembly and iframe boundary

## Status

Accepted for Task 10.

## Decision

`aero-game` is the only public root. It fills its parent and owns no page navigation, history, body sizing, or URL state. Its constructor creates DOM surfaces only. Connection creates one new isolated service graph; disconnect terminally invalidates that graph and destroys all owned services. Reconnection creates a fresh graph rather than reconnecting terminal service objects.

The renderer canvas, media video, and named UI presenters are stable across state updates. Assembly observes the actual component content box and DPR. Domain packages retain acquisition, authoring, content validation, media, CV, input, audio clock, gameplay, rendering, and presenter ownership.

One process-wide `AeroGameMediaLeaseCoordinator` serializes active camera/audio ownership across instances. Transfer pauses the previous participant before activating the next. The coordinator never owns streams, audio contexts, tracks, or DOM surfaces; video/audio services determine resource cleanup, including never stopping host-owned injected streams.

The production CV composition is immutable MediaPipe Pose Landmarker Lite float16 `/1/`, Tasks Vision 1.0.1, GPU-WebGL, standard 0.5 thresholds, Fast tracking, full/no-resize input, measured/current routing and a 15fps submission ceiling. Historical selectors/predictive routing remain outside the production root.

Iframe delivery is a per-instance adapter bound to `window.parent`, one exact origin and one instance ID. It requires the finalized v1 handshake and exact contracts before accepting commands. Messages are bounded to 64 KiB plain data. Raw frames, media objects, ZIP/audio bytes, files, pixels, screenshots and transferables are forbidden. Child-local acquisition/conversion/persistence keeps raw bundles inside the iframe.

The child owns fullscreen requests. Hidden documents pause gameplay/audio/inference but retain camera. Source identity changes invalidate calibration. Teardown invalidates async generations before destroying graph resources so late work cannot resurrect state.

## Consequences

- Direct and iframe hosts use the same command/event contracts.
- Multiple game elements can coexist, but only one actively consumes camera/audio.
- Hosts size containers instead of the game reading the viewport.
- Cross-origin local ZIP import must happen inside the child UI; a parent cannot send archive bytes.
- Physical camera, permission, calibration and Android secure-context proof remains a release/QA handoff rather than a deterministic CI claim.
