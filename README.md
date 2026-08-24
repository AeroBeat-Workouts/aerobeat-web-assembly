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

The app renders the raw proof version `0.0.1`, a build stamp, and a cache-bust token in the first viewport so browser/device refresh state is visible.

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
