# AeroBeat Web Assembly

Deployable browser app shell for AeroBeat Web.

This repo owns the SPA root, service composition, integration validation, release proof artifacts, and local iteration scripts. Domain behavior stays in sibling `@aerobeat/web-*` packages and is imported only through their public package exports.

## Start

```bash
npm install
npm run dev
```

The default Vite server binds to `127.0.0.1` on port `5173` when available.

For visible device URLs:

```bash
npm run dev:host
```

Then start Vite with a host binding when another device needs to reach this machine:

```bash
npx vite --host 0.0.0.0 --port 5173
```

For the Tailscale HTTPS phone checkpoint, use the Tailscale-ready dev script:

```bash
npm run dev:tailscale
```

Then expose it on AeroBeat's separate Tailscale HTTPS port:

```bash
tailscale serve --bg --https=8443 --yes http://127.0.0.1:5173
```

Open `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/`.

The app renders the package patch version, a build stamp, and a cache-bust token in the first viewport so browser/device refresh state is visible.

The phone benchmark scene starts with one deterministic CV-owned replay frame through the public `@aerobeat/web-cv` and `@aerobeat/web-input` exports so non-camera secure-loading checks remain deterministic. Its visible surface is intentionally compact: title, build row, a rounded native collapsible `Calibration options` card with seven ordered dropdown rows and one `Begin calibration` action, preview, `Timing window N/120` progress, and telemetry copy/download/output. Services, Camera, Media, Inference, Calibration, pose-flow, checkpoint copy, telemetry-ready status, and the reusable calibration screen are still mounted and updated for truthful snapshots but hidden from the benchmark scene. Pressing the one visible `Begin calibration` action requests live camera permission through the public video/CV boundaries by activating the hidden reusable calibration command. When permission is granted, the app keeps the stream attached for the page lifetime and runs latest-frame-wins inference through MediaPipe Pose Landmarker Lite. If camera or runtime/model setup is unavailable, the generic CV-owned replay adapter remains the explicit fallback proof state.

The live phone route independently paces three runtime lanes: CV owns video-frame-aware sampling/inference submission at a 15fps default ceiling, the assembly refreshes status/telemetry DOM at up to 4fps, and the WebGL pose overlay renders at up to 30fps. Sampling prefers `HTMLVideoElement.requestVideoFrameCallback()` and uses a tested `requestAnimationFrame()` fallback. Slow inference therefore cannot queue stale work or directly set the native camera preview cadence; latest-frame-wins keeps at most one pending sample. The default measured route and legacy frame router remain unchanged.

## Pose Gameplay Source Experiment

The reload-persistent `poseGameplaySource` route and **Pose gameplay source** dropdown provide `measured`, `measured-8`, and `predicted-8`. Experimental modes are available only for MediaPipe GPU/CPU with the Direct-full main-thread preset; incompatible backend or performance selections visibly reset the route to `measured`. `measured-8` changes only the CV submission ceiling to 8fps. `predicted-8` routes every new real measurement exactly once, then may route bounded predictor results at unique, strictly increasing media timestamps. Unavailable or stale prediction freezes the latest overlay without rerouting or counting gameplay events. Lifecycle epochs invalidate callbacks across routing reset, service replacement, source/mirror/backend/camera/mode changes, stop, and restart.

## Pose Backend Selection

Production assembly ships one concrete pose vendor and locks the no-query path to:

- MediaPipe Pose Landmarker Lite float16 `/1/` through Tasks Vision `1.0.1`;
- GPU-WebGL;
- Standard `0.5 / 0.5 / 0.5` thresholds;
- Fast tracking;
- Direct full, full camera input, no resize;
- measured/current gameplay at the 15fps submission ceiling.

The visible backend control intentionally has one MediaPipe option. The provider control keeps `cpu-wasm` as an explicit same-vendor diagnostic, while `gpu-webgl` is first and default. Responsive thresholds, worker/downscale presets, and predictive gameplay remain explicit non-default diagnostics. Backend/provider/tuning changes synchronize the URL with `history.replaceState`, terminally dispose the old CV service exactly once, retain latest-selection-wins behavior during rapid switches, and restart an active camera route.

Historical `poseBackend=movenet|onnxruntime` and incompatible `poseProvider=webgl|wasm|webgpu` requests remain visible in requested telemetry but normalize to MediaPipe GPU-WebGL with a visible warning. Invalid tuning normalizes to Standard. No MoveNet, TensorFlow pose, ONNX Runtime, or ONNX model runtime is imported or shipped by assembly.

The hidden Inference diagnostic still reports selected preset, MediaPipe tuning/applicability and exact thresholds, actual execution location and detail, runtime/postprocess timing split, actual resize path, inference input dimensions, granted camera size, measured video FPS where available, prep cost, adapter cost, total CV cost, running averages, rolling 120-sample prep/adapter/runtime/worker-round-trip/total p50/p95/max, cadence-budget and incomplete-seven-point counts, actual sampling primitive, effective sample/submission rate, effective pose-output rate, effective status-update rate, effective overlay-render rate, submitted/output/render/status ages, dropped frames, rendered pose frames, the seven-landmark calibration subset count, selected tracking profile, measured media-pose freshness, and separate presentation-target delta. Experimental diagnostics additionally expose route lifecycle, measured/predicted samples and events, deduplication and freeze/suppression counts, prediction horizon/error/reset/clamp telemetry, inference occupancy estimate, and held-out landmark/grid/draft-intent oracle metrics. The oracle does not claim point parity because no web scorer exists. The visible progress pill mirrors only the retained sample count needed to know when a `120/120` benchmark window is ready. The visible overlay remains limited to `nose`, `left_wrist`, `left_elbow`, `left_shoulder`, `right_shoulder`, `right_elbow`, and `right_wrist`, with the nose connected to both shoulders. Camera switching and the default `Fast` tracking profile remain available.

The CV selector defaults to `Direct full (recommended)` and adds `Direct downscale 256`, `Direct downscale 192`, and `Direct downscale 160`. Those four presets all use the main-thread MediaPipe adapter and browser-default camera constraints, isolating only the inference resize. `Experimental worker downscale 256`, `Experimental worker downscale 192`, and `Experimental worker downscale 160` select actual dedicated-worker MediaPipe execution. `Experimental worker transferable VideoFrame` requires actual global `VideoFrame` plus exact rVFC media time and provides no canvas/ImageBitmap fallback. MediaPipe uses the supported plain-JavaScript IIFE in a classic worker and does not silently fall back to the main thread. Tasks Vision 1.0.1 can also run in a module worker when its resolver's `useModule` flag is explicitly true; the classic choice is not an unsupported-module workaround. Direct full remains the production recommendation/default, and no diagnostic preset is claimed to be faster without comparable physical-phone telemetry.

When Android screenshots fail while the live camera is active, use the visible Telemetry controls below the timing progress. `Copy telemetry` captures the current version/build/cache, route URL, secure-context state, browser user agent/platform/language, hardware concurrency/device-memory availability, viewport/screen/pixel ratio/orientation, selected camera, backend/provider, MediaPipe tuning/applicability/thresholds, tracking profile, CV preset, execution location/detail, runtime/postprocess split, resize path, input dimensions, prep/adapter/total CV costs, rolling distribution/budget/incomplete counts, output age, media-pose delta, Camera/Media/Inference/Calibration panel strings, and service summary into the clipboard when browser policy allows it. The same snapshot is always rendered in a selectable text block for mobile share/copy fallback. `Download telemetry` saves a text file from the current snapshot and retains its temporary object URL long enough for Android Chrome's asynchronous download manager before bounded cleanup; app teardown also revokes any retained URLs.

## Secure Context

Camera APIs require a secure context outside `localhost`. See [docs/secure-context.md](docs/secure-context.md) for HTTPS and Tailscale iteration options.

## Release Proof

```bash
npm run version:patch
npm run build-release
npm run submit-release-to-github
```

Run `npm run version:patch` before each phone-testable slice. `build-release` creates a raw, unminified browser artifact under `release/raw/<package-version>/`, verifies locked MediaPipe markers, rejects emitted MoveNet/TensorFlow pose/ONNX Runtime asset signatures, and records the configured production pose defaults, concrete vendor list, runtime JS/WASM inventory, and artifact bytes in `aerobeat-release-proof.json`. `submit-release-to-github` writes a dry-run GitHub release submission manifest beside that artifact; it does not contact GitHub yet.

On the phone, reload `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` and confirm the visible `Version`, `Build`, and `Cache` values changed. If they do not change, the device is still seeing an older build.

## Validation

```bash
npm run check
npm test
npm run test:browser
npm run build-release
```

`test:browser` serves the Vite app with Playwright, verifies that version/cache metadata renders, and fails on unexpected browser console warnings or errors.
