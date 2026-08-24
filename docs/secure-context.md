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

When Tailscale is available, serve Vite locally and front it with a Tailscale HTTPS endpoint. The current AeroBeat checkpoint keeps the existing HTTPS `:443` root route intact for OpenClaw and uses a separate AeroBeat HTTPS port:

```bash
npm run dev:tailscale
tailscale serve --bg --https=8443 --yes http://127.0.0.1:5173
```

Open `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` on the phone. That origin should satisfy secure-context requirements for camera validation while keeping traffic on the tailnet. Preserve the existing `https://derrick-alienware-aurora-r13.tail613fcb.ts.net/` handler for OpenClaw.

For the first mobile integration checkpoint, confirm the phone page loads over the Tailscale HTTPS URL, shows `Secure context: ready`, and shows the runtime pose flow source `aero.movenet.replay.basic-upper-body` with six draft input events. This checkpoint intentionally uses replay data; live `getUserMedia` and MoveNet debugging should be tracked as the next device-specific slice if the secure page loads but camera behavior needs more work.

To stop the route:

```bash
tailscale serve reset
```

To stop only the AeroBeat listener:

```bash
tailscale serve --https=8443 off
```

## QR

If `qrencode` is installed, print a terminal QR code for the active URL:

```bash
npm run dev:host
qrencode -t ANSIUTF8 "https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/"
```

Replace the URL with the exact HTTPS endpoint printed by Tailscale.
