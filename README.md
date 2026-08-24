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

The mobile integration checkpoint renders `aero-pose-flow-panel` in the app shell and starts with one deterministic replay frame through the public `@aerobeat/web-cv` and `@aerobeat/web-input` exports so non-camera secure-loading checks remain deterministic. Pressing `Begin calibration` requests live camera permission through the public video/CV boundaries. When permission is granted, the app keeps the granted stream attached to a live video consumer for the page lifetime, runs latest-frame-wins MoveNet inference through `@aerobeat/web-cv` and `@aerobeat/web-vendor-movenet`, updates the Camera and Inference status panels with live counters, and refreshes the visible pose-flow panels with a truthful `aero.movenet.live` source through the same input route. If camera APIs are unavailable or blocked, the replay checkpoint remains the fallback proof state.

The live phone route now reports WebGL2 preview fidelity in the Inference panel: rendered pose frames, the seven-landmark calibration subset count, and the comparable media-time minus pose-frame timestamp delta. The visible overlay is limited to `nose`, `left_wrist`, `left_elbow`, `left_shoulder`, `right_shoulder`, `right_elbow`, and `right_wrist`.

## Secure Context

Camera APIs require a secure context outside `localhost`. See [docs/secure-context.md](docs/secure-context.md) for HTTPS and Tailscale iteration options.

## Release Proof

```bash
npm run version:patch
npm run build-release
npm run submit-release-to-github
```

Run `npm run version:patch` before each phone-testable slice. `build-release` creates a raw, unminified browser artifact under `release/raw/<package-version>/`. `submit-release-to-github` writes a dry-run GitHub release submission manifest beside that artifact; it does not contact GitHub yet.

On the phone, reload `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` and confirm the visible `Version`, `Build`, and `Cache` values changed. If they do not change, the device is still seeing an older build.

## Validation

```bash
npm run check
npm test
npm run test:browser
npm run build-release
```

`test:browser` serves the Vite app with Playwright, verifies that version/cache metadata renders, and fails on unexpected browser console warnings or errors.
