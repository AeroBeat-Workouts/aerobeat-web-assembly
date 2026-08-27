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

The phone benchmark scene starts with one deterministic replay frame through the public `@aerobeat/web-cv` and `@aerobeat/web-input` exports so non-camera secure-loading checks remain deterministic. Its visible surface is intentionally compact: title, build row, a rounded native collapsible `Calibration options` card with one dropdown per row and one `Begin calibration` action, preview, `Timing window N/120` progress, and telemetry copy/download/output. Services, Camera, Media, Inference, Calibration, pose-flow, checkpoint copy, telemetry-ready status, and the reusable calibration screen are still mounted and updated for truthful snapshots but hidden from the benchmark scene. Pressing the one visible `Begin calibration` action requests live camera permission through the public video/CV boundaries by activating the hidden reusable calibration command. When permission is granted, the app keeps the stream attached for the page lifetime and runs latest-frame-wins inference through the selected MoveNet, MediaPipe, or ONNX Runtime adapter. If camera or runtime/model setup is unavailable, deterministic MoveNet replay remains the explicit fallback proof state.

The live phone route independently paces three runtime lanes: CV owns video-frame-aware sampling/inference submission at a 15fps ceiling, the assembly refreshes status/telemetry DOM at up to 4fps, and the WebGL pose overlay renders the latest raw measured pose at up to 30fps. Sampling prefers `HTMLVideoElement.requestVideoFrameCallback()` and uses a tested `requestAnimationFrame()` fallback. Slow inference therefore cannot queue stale work or directly set the native camera preview cadence; latest-frame-wins keeps at most one pending sample. The overlay does not predict or extrapolate between poses, and gameplay/input routing continues to consume raw measured frames.

## Pose Backend Selection

MoveNet remains the default. The visible `Pose backend`, `Pose provider`, and MediaPipe-only `MediaPipe tuning` controls and stable query parameters select an exact comparison path:

- `?poseBackend=movenet&poseProvider=webgl`
- `?poseBackend=mediapipe&poseProvider=cpu-wasm&mediaPipeTuning=standard`
- `?poseBackend=mediapipe&poseProvider=gpu-webgl&mediaPipeTuning=responsive`
- `?poseBackend=onnxruntime&poseProvider=wasm`
- `?poseBackend=onnxruntime&poseProvider=webgpu`

Backend/provider/tuning changes synchronize the URL with `history.replaceState`, terminally dispose the old CV service exactly once, retain latest-selection-wins behavior during rapid switches, and restart an active camera route. MediaPipe `standard` is the unchanged 0.5 detection / 0.5 presence / 0.5 tracking default; `responsive` is the measured experiment at 0.5 / 0.4 / 0.3. The tuning selector is disabled and labeled not applicable on other backends while its URL selection is retained for switching back. Invalid backend/provider/tuning values remain visible as requested values in telemetry while selection falls back to MoveNet, that backend's supported provider, or standard tuning. Experimental worker performance presets are available only for MoveNet and MediaPipe; ONNX Runtime retains direct presets only.

The ONNX model defaults to the same-origin path `${BASE_URL}models/rtmpose-t/end2end.onnx`. A custom `onnxModelUrl` query is accepted only when it resolves to the current origin; cross-origin OpenMMLab URLs are rejected. Prepare the ignored local asset before a real ONNX run:

```bash
npm run model:prepare:onnx
```

That command runs the ONNX vendor package's checksum-verifying acquisition workflow, verifies the extracted model again, and copies the ignored model/provenance into `public/models/rtmpose-t/`. Model weights are never committed or included by default. Run it before `dev`, `dev:tailscale`, or `build:release` when ONNX real-runtime proof is required.

The hidden Inference diagnostic still reports selected preset, MediaPipe tuning/applicability and exact thresholds, actual execution location and detail, runtime/postprocess timing split, actual resize path, inference input dimensions, granted camera size, measured video FPS where available, prep cost, adapter cost, total CV cost, running averages, rolling 120-sample adapter/total p50/p95/max, cadence-budget and incomplete-seven-point counts, actual sampling primitive, effective sample/submission rate, effective pose-output rate, effective status-update rate, effective overlay-render rate, submitted/output/render/status ages, dropped frames, rendered pose frames, the seven-landmark calibration subset count, selected tracking profile, and media-time minus pose-frame timestamp delta. The visible progress pill mirrors only the retained sample count needed to know when a `120/120` benchmark window is ready. The visible overlay remains limited to `nose`, `left_wrist`, `left_elbow`, `left_shoulder`, `right_shoulder`, `right_elbow`, and `right_wrist`, with the nose connected to both shoulders. Camera switching and the default `Fast` tracking profile remain available.

The CV selector defaults to `Direct full (recommended)` and adds `Direct downscale 256`, `Direct downscale 192`, and `Direct downscale 160`. Those four presets all use the main-thread adapter and browser-default camera constraints, isolating only the inference resize. `Experimental worker downscale 256`, `Experimental worker downscale 192`, and `Experimental worker downscale 160` select actual dedicated-worker execution for MoveNet or MediaPipe. MediaPipe uses a classic worker because Tasks Vision 1.0.1's Emscripten loader requires `importScripts`; it does not silently fall back to the main thread. Direct presets remain the production recommendation/default, and no diagnostic preset is claimed to be faster without comparable physical-phone telemetry.

When Android screenshots fail while the live camera is active, use the visible Telemetry controls below the timing progress. `Copy telemetry` captures the current version/build/cache, route URL, secure-context state, browser user agent/platform/language, hardware concurrency/device-memory availability, viewport/screen/pixel ratio/orientation, selected camera, backend/provider, MediaPipe tuning/applicability/thresholds, tracking profile, CV preset, execution location/detail, runtime/postprocess split, resize path, input dimensions, prep/adapter/total CV costs, rolling distribution/budget/incomplete counts, output age, media-pose delta, Camera/Media/Inference/Calibration panel strings, and service summary into the clipboard when browser policy allows it. The same snapshot is always rendered in a selectable text block for mobile share/copy fallback. `Download telemetry` saves a text file from the current snapshot and retains its temporary object URL long enough for Android Chrome's asynchronous download manager before bounded cleanup; app teardown also revokes any retained URLs.

## Secure Context

Camera APIs require a secure context outside `localhost`. See [docs/secure-context.md](docs/secure-context.md) for HTTPS and Tailscale iteration options.

## Release Proof

```bash
npm run version:patch
npm run build-release
npm run submit-release-to-github
```

Run `npm run version:patch` before each phone-testable slice. `build-release` creates a raw, unminified browser artifact under `release/raw/<package-version>/`, requires emitted ONNX Runtime WASM assets and all three backend registry markers, and records the configured base path, runtime JS/WASM files, and ONNX model-presence policy in `aerobeat-release-proof.json`. A build without the ignored model is valid for MoveNet/MediaPipe and selector proof but not a real ONNX inference checkpoint. `submit-release-to-github` writes a dry-run GitHub release submission manifest beside that artifact; it does not contact GitHub yet.

On the phone, reload `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` and confirm the visible `Version`, `Build`, and `Cache` values changed. If they do not change, the device is still seeing an older build.

## Validation

```bash
npm run check
npm test
npm run test:browser
npm run build-release
```

`test:browser` serves the Vite app with Playwright, verifies that version/cache metadata renders, and fails on unexpected browser console warnings or errors.
