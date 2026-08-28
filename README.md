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

The phone benchmark scene starts with one deterministic CV-owned replay frame through the public `@aerobeat/web-cv` and `@aerobeat/web-input` exports so non-camera secure-loading checks remain deterministic. Its visible surface is intentionally compact: title, build row, one prominent `Begin calibration` action, preview, `Timing window N/120` progress, and telemetry copy/download/output. There is no details/summary/chevron surface and no visible selection dropdown. Services, Camera, Media, Inference, Calibration, pose-flow, checkpoint copy, telemetry-ready status, and the reusable calibration screen remain mounted and updated for truthful snapshots but hidden from the benchmark scene. Pressing the sole visible setup action activates that hidden reusable calibration command, requests live camera permission through the public video/CV boundaries, attaches the granted stream, and starts the locked MediaPipe Pose Landmarker Lite route. If camera or runtime/model setup is unavailable, the generic CV-owned replay adapter remains the explicit fallback proof state.

The live phone route independently paces three runtime lanes: CV owns video-frame-aware sampling/inference submission at a 15fps default ceiling, the assembly refreshes status/telemetry DOM at up to 4fps, and the WebGL pose overlay renders at up to 30fps. Sampling prefers `HTMLVideoElement.requestVideoFrameCallback()` and uses a tested `requestAnimationFrame()` fallback. Slow inference therefore cannot queue stale work or directly set the native camera preview cadence; latest-frame-wins keeps at most one pending sample. The default measured route and legacy frame router remain unchanged.

## Locked Pose Route

Production assembly ships one concrete pose vendor and locks the no-query startup path to:

- MediaPipe Pose Landmarker Lite float16 `/1/` through Tasks Vision `1.0.1`;
- GPU-WebGL;
- Standard `0.5 / 0.5 / 0.5` thresholds;
- Fast tracking;
- Direct full, full camera input, no resize;
- measured/current gameplay at the 15fps submission ceiling.

There are no visible backend, provider, tuning, camera, tracking, gameplay-source, or CV-performance selectors. Historical backend/provider/tuning and experimental gameplay-source query parameters remain normalized by the internal registries for compatibility, deterministic unit coverage, and truthful hidden telemetry; they are diagnostics, not setup UI. No MoveNet, TensorFlow pose, ONNX Runtime, or ONNX model runtime is imported or shipped by assembly.

The hidden Inference diagnostic still reports selected preset, MediaPipe tuning/applicability and exact thresholds, actual execution location and detail, runtime/postprocess timing split, actual resize path, inference input dimensions, granted camera size, measured video FPS where available, prep cost, adapter cost, total CV cost, running averages, rolling 120-sample prep/adapter/runtime/worker-round-trip/total p50/p95/max, cadence-budget and incomplete-seven-point counts, actual sampling primitive, effective sample/submission rate, effective pose-output rate, effective status-update rate, effective overlay-render rate, submitted/output/render/status ages, dropped frames, rendered pose frames, the seven-landmark calibration subset count, selected tracking profile, measured media-pose freshness, and separate presentation-target delta. Experimental diagnostics additionally expose route lifecycle, measured/predicted samples and events, deduplication and freeze/suppression counts, prediction horizon/error/reset/clamp telemetry, inference occupancy estimate, and held-out landmark/grid/draft-intent oracle metrics. The oracle does not claim point parity because no web scorer exists. The visible progress pill mirrors only the retained sample count needed to know when a `120/120` benchmark window is ready. The visible overlay remains limited to `nose`, `left_wrist`, `left_elbow`, `left_shoulder`, `right_shoulder`, `right_elbow`, and `right_wrist`, with the nose connected to both shoulders. The one-button path uses the browser's default user-facing camera and the locked `Fast` tracking profile.

The visible one-button route always uses `Direct full (recommended)` with browser-default camera constraints and no inference resize. Downscale and worker preset definitions remain covered by the CV package and registry unit tests for diagnostic compatibility, but assembly does not expose them as setup controls. Direct full remains the production recommendation/default.

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
