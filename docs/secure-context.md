# Secure Context Iteration

Browser camera access works on `localhost` and HTTPS origins. Use these paths for AeroBeat phone and remote-device testing.

## Local Host

```bash
npm run dev
```

Open `http://127.0.0.1:5173/` on the development machine. This is a secure context for browser camera APIs because localhost is trusted.

## LAN URL Discovery

```bash
npm run dev:host
npx vite --host 0.0.0.0 --port 5173
```

`dev:host` prints local and LAN URLs. Use the LAN URL only for non-camera smoke checks unless the browser treats the origin as secure.

## Tailscale HTTPS

When Tailscale is available, serve Vite on all interfaces and front it with a Tailscale HTTPS endpoint:

```bash
npx vite --host 0.0.0.0 --port 5173
tailscale serve --https=443 http://127.0.0.1:5173
```

Open the Tailscale HTTPS URL on the phone. That origin should satisfy secure-context requirements for camera validation while keeping traffic on the tailnet.

To stop the route:

```bash
tailscale serve reset
```

## QR

If `qrencode` is installed, print a terminal QR code for the active URL:

```bash
npm run dev:host
qrencode -t ANSIUTF8 "https://<tailscale-hostname>/"
```

Replace the URL with the exact HTTPS endpoint printed by Tailscale.
