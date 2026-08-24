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

The app renders the raw proof version `0.0.1`, a build stamp, and a cache-bust token in the first viewport so browser/device refresh state is visible.

The first mobile integration checkpoint also renders `aero-pose-flow-panel` in the app shell and drives it with one deterministic replay frame through the public `@aerobeat/web-cv` and `@aerobeat/web-input` exports. This proves secure serving, cache refresh, and runtime package loading before live phone camera debugging starts.

## Secure Context

Camera APIs require a secure context outside `localhost`. See [docs/secure-context.md](docs/secure-context.md) for HTTPS and Tailscale iteration options.

## Release Proof

```bash
npm run build-release
npm run submit-release-to-github
```

`build-release` creates a raw, unminified `0.0.1` browser artifact under `release/raw/0.0.1/`. `submit-release-to-github` writes a dry-run GitHub release submission manifest beside that artifact; it does not contact GitHub yet.

## Validation

```bash
npm run check
npm test
npm run test:browser
npm run build-release
```

`test:browser` serves the Vite app with Playwright, verifies that version/cache metadata renders, and fails on unexpected browser console warnings or errors.
