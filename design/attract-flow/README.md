# AeroBeat attract / loading flow (prototype)

This is a design prototype of the first thing a player sees: from opening the URL to making their first two-wrist selection. It is about the **flow, timing and interactions**, not the look. The style is a deliberately neutral dark slate so it can be reskinned once a visual direction is chosen (see `DESIGN.md`). It is not product code.

Everything visible is drawn in a PlayCanvas world-space scene (PlayCanvas 2.21.4 from `../style-comps/_shared/`). The only HTML is the page shell and one hidden `<video>` element that feeds the camera texture.

## How to open it

Serve the assembly repo root over HTTP and open `design/attract-flow/index.html`. Either:

```
# from aerobeat-web-assembly/
node_modules/.bin/vite --host 127.0.0.1 --port 5791
#   -> http://127.0.0.1:5791/design/attract-flow/index.html

# or the small production-like static server (gzip + cache headers; use this for timing)
node design/attract-flow/verify/serve.mjs 5792
#   -> http://127.0.0.1:5792/design/attract-flow/index.html
```

The camera only works on `localhost`/`127.0.0.1` or `https://`. Opening it from another machine over plain `http://` shows the "needs a secure page" message (that is one of the tested states).

URL option: `?fresh` clears the cached body-tracker files first, to see a cold download.

## The flow

**Phase 1: first paint, before any click.** A small scene with one big target ("Turn on camera", or "Start" when the camera is already allowed) and two toys that react to mouse and touch: a beat pad that pulses and rings when the pointer enters or taps it, and a cluster of dots that scatter away from the pointer. Right after the first frame is drawn, the body tracker starts downloading in the background. The bar under the scene shows **real progress**: bytes received for the four files (18.0 MB), then three real start-up steps (start the engine, load the model, run one test frame). It only reaches 100% when the tracker has actually produced a result. If the download fails, the line turns amber and says so.

The click on the main target is the session's one real user gesture. In that same handler it plays a soft two-note chime (proves audio is unlocked), requests fullscreen, and asks for the camera.

**Camera problems** are shown in-scene with their own message and the one action that can actually help:

| Situation | How it is detected | Message and action |
|---|---|---|
| Blocked for this site | `NotAllowedError` and permission state `denied` | Explains how to set Camera to Allow from the address bar; says retrying here will not work; offers "Reload page". Also listens for the permission to change and carries on by itself if it does. |
| Prompt dismissed | `NotAllowedError` and permission still `prompt` | "Ask again" (here a retry does work). |
| Blocked by the operating system | `NotAllowedError` but site permission is `granted` | Explains the system privacy setting; "Try again". |
| No camera | `NotFoundError` / `OverconstrainedError` | Plug in a webcam; "Try again". |
| Camera busy | `NotReadableError` / `AbortError` | Close Zoom, Teams, OBS or another tab; "Try again". |
| Insecure page | `!isSecureContext` (checked before any click) | Needs an https:// address; no button. |
| Unsupported browser | no `navigator.mediaDevices.getUserMedia` | Use a current browser; no button. |

**Camera selection.** Once the camera is on, a "Switch camera" target appears top right. It opens an in-scene list of cameras by name (labels are only available after permission). The choice is saved in `localStorage` (`aerobeat.attract.cameraId`) and used first next time; if that camera is gone, any camera is used instead. All of this works with mouse and touch, because wrists are not available yet.

**Phase 2: camera on, tracker still loading.** The athlete's live camera picture appears in a framed "mirror" (mirrored, softened into the palette by a shader on a video texture). If the tracker is still not ready one second after the camera came on, a warm-up prompt fades in: "While we get ready: roll your shoulders, reach up high". Fast loads never see it.

**"Can't see you. Try another camera?"** appears, with a "Switch camera" action, when:
- the picture is black (mean brightness under 12/255 with almost no contrast) for more than 2 s after the camera started;
- the picture is frozen (no pixel change between 4-per-second thumbnails, or the video clock stops, for 2.5 s);
- the tracker is ready but has not found a body for 4 s.
It clears by itself 0.6 s after the problem goes away.

**Phase 3: tracker ready.** The mirror grows to fill the screen and dims slightly. Two wrist markers (left wrist blue, right wrist amber) sit on the athlete's real wrists. A single practice target at the top, "Raise both hands here", teaches the gesture: two dots inside it fill in as each wrist arrives, and the text changes to "Now your other hand" and "Hold it there". Holding both wrists on it for the shared hold time (520 ms) selects it. That ends the prototype on a "Next: calibration (T-pose)" card.

**Returning players** with the camera already allowed and the tracker cached go straight through: the main target says "Start", and phase 2 lasts a few milliseconds because the tracker is ready before they click.

**XR.** If `navigator.xr.isSessionSupported('immersive-vr')` resolves true **and** the user agent looks like a standalone headset (Quest, Pico, Wolvic, visionOS), the main target says "Enter VR" and the copy changes. On a desktop with WebXR support the webcam flow stays and a small "Play in VR" target appears top right. Both just log a stub; there is no VR session.

## How wrists map to the screen here, and how real menus should do it

Here, MediaPipe's normalised wrist landmarks (indices 15 and 16) are mapped straight onto the camera picture as drawn: mirror x, undo the cover-fit crop, then place on the picture's rectangle. The markers land exactly on the athlete's wrists in the picture, which is what this screen needs: it is teaching "these dots are your hands".

Real menus should not do this. A wrist position in the camera image depends on where the athlete stands and how big they are, so targets near the edges become unreachable or need big steps. Real menus should map wrists through the **T-pose calibration grid**: the calibration step measures the athlete's shoulder line and arm span, and the reachable area becomes the screen. That is why this prototype ends at "Next: calibration (T-pose)". The one practice target here is placed overhead and centred so it is reachable without calibration.

## Two-wrist selection

The rule comes from `../style-comps/_shared/hands.mjs`, which is reused unchanged. That module simulates both wrists from one mouse pointer and has no input for two independent tracked wrists yet. `lib/pose-hands.mjs` is that missing input: it reads target rectangles from the shared module (`hands.targetsOnScreen()`) and applies the identical rule with the shared constants (`WRIST_DIAMETER`, `HOLD_MS`). Suggested follow-up: add `hands.setWrists(left, right)` to the shared module and delete `pose-hands.mjs`.

Mouse and touch use the shared module's click path (a click selects the target under it). Hold-to-select from the mouse is switched off on this screen because the mouse pointer is not a pair of wrists.

## Body tracker loading

The real MediaPipe Pose Landmarker Lite the game uses: `@mediapipe/tasks-vision` 1.0.1, CPU delegate (WASM), VIDEO mode, one pose, segmentation off, thresholds 0.5, matching `aerobeat-web-vendor-mediapipe`. The four files are copied into `vendor/mediapipe/` (see `ASSETS.md`). The two JavaScript files have a `.txt` suffix so Vite serves them byte-for-byte instead of transforming them.

`lib/pose-loader.mjs` downloads the files itself so it can count bytes, compiles the WASM once, and hands the compiled module to MediaPipe (`instantiateWasm`) so nothing is fetched twice. The files are stored in the Cache Storage API after the first download, so a returning player reads them from disk.

## Timings

Measured with `verify/timing.mjs` (headless Chromium, SwiftShader software rendering, this machine, fake camera with permission already granted). "Cold" is a new browser profile (empty caches). "Warm" is a reload after a full load (tracker files from Cache Storage, page files from the HTTP cache). Served by `verify/serve.mjs` (gzip, like a CDN). Times are from navigation start.

| Network | Load | First contentful paint | First scene frame | Tracker ready |
|---|---|---|---|---|
| localhost, unthrottled (median of 5) | cold | 456 ms | 253 ms | 1279 ms |
| | warm | 324 ms | 161 ms | 990 ms |
| 50 Mbit/s (median of 2) | cold | 580 ms | 398 ms | 2894 ms |
| | warm | 348 ms | 186 ms | 1003 ms |
| 10 Mbit/s (1 run) | cold | 1016 ms | 838 ms | 8575 ms |
| | warm | 352 ms | 188 ms | 994 ms |

"First scene frame" comes before "first contentful paint" because Chromium only counts the WebGL canvas as contentful a frame or two later.

Returning player (warm, camera allowed): **Start click to practice target on screen: about 300 ms** (median of 5; 268–423 ms across runs). The warm-up message was never shown.

The tracker start-up after the bytes arrive takes about 0.8–1.0 s on this machine with software rendering: compile WASM ~200–400 ms, create the landmarker ~150–270 ms, one test frame ~200–400 ms. On a cold load the download overlaps with the page, so cold tracker-ready time is mostly the transfer: about 8.5 MB gzipped (the model barely compresses).

Through Vite dev, first paint is much slower on throttled links (about 3 s at 50 Mbit/s) because Vite serves `playcanvas.min.mjs` uncompressed with an inline source map (12 MB instead of 0.6 MB gzipped). That is a dev-server artefact, which is why timing uses `serve.mjs`.

## What was verified, and how

All with headless Chromium through Playwright (`verify/capture.mjs`, 18 scenarios, all pass; results in `shots/capture-results.json`). Stills are in `shots/`; `shots/distance/` has the same frames scaled down to roughly what a 15-inch laptop looks like from 2.5 m.

| State | Still | How it was produced |
|---|---|---|
| First visit, "Turn on camera" | `00` | real; permission not yet asked |
| Phase 1 mid-download, real bytes | `01` | real download, throttled to 16 Mbit/s |
| Toys poked with the mouse | `02` | real mouse events |
| Desktop with WebXR, "Play in VR" | `03` | `navigator.xr` stubbed to support immersive-vr |
| Headset, "Enter VR" | `04` | same stub plus a Quest user agent |
| Camera blocked | `05` | **real denial**: Chromium without the fake-UI flag denies the request |
| Prompt dismissed | `06` | `getUserMedia` stubbed to throw `NotAllowedError` with permission `prompt` |
| OS blocks camera | `06b` | stubbed `NotAllowedError` with permission `granted` |
| No camera | `07` | stubbed `NotFoundError` |
| Camera busy | `08` | stubbed `NotReadableError` |
| Insecure page | `09` | **real**: same page over plain http on the LAN address |
| Unsupported browser | `10` | `navigator.mediaDevices` removed |
| Phase 2 with warm-up prompt | `11` | fake camera playing a **recorded athlete**, throttled download |
| Black picture | `12` | fake camera playing a black video |
| Frozen picture | `13` | fake camera playing a one-frame video |
| Can't see you (no body) | `14` | Chromium's built-in fake camera test pattern; real tracker finds nobody |
| Camera chooser and switch, remembered after reload | `15`, `16` | three fake cameras; picked the third; reload reopened the third |
| Wrist markers on the athlete | `17` | recorded athlete; **real MediaPipe tracking** |
| Practice target arming | `18` | recorded athlete raises both hands; real tracking arms the target |
| Done, next: calibration | `19` | selection completed by real tracking from the recording |
| Tracker failed to download | `20`, `21` | model request aborted |
| Touch only, phone landscape | `22`, `23` | touch events only: poked a toy, Start, Switch camera, picked a camera |

Audio unlock is checked by the `AudioContext` state becoming `running` after the click. Fullscreen is checked by the `requestFullscreen` promise resolving.

### Reproduce

```
bash design/attract-flow/verify/make-fixtures.sh /tmp/af        # fake-camera videos (needs ffmpeg)
node design/attract-flow/verify/serve.mjs 5792 &                  # from aerobeat-web-assembly/
LAN_BASE=http://<lan-ip>:5792 node design/attract-flow/verify/capture.mjs http://127.0.0.1:5792 /tmp/af
node design/attract-flow/verify/timing.mjs http://127.0.0.1:5792 5            # unthrottled
node design/attract-flow/verify/timing.mjs http://127.0.0.1:5792 2 6250000    # 50 Mbit/s
```

## Not verified headless

- A real webcam and a real person standing 2–3 m back. Tracking was only checked against a recorded clip played through Chromium's fake camera (a person about 2 m from the camera, in an office).
- Real fullscreen: headless Chromium resolves the request, but nothing visible changes.
- Hearing the chime: only the `AudioContext` state is checked.
- The real browser permission prompt and the real site-settings page.
- A real camera busy in another app, a real OS privacy block, a real lens cover: these were simulated with stubbed errors or prepared videos.
- Real WebXR hardware (Quest, Pico, Vision Pro); only the detection logic, with stubs.
- Firefox and Safari. Both lack `navigator.permissions.query({ name: 'camera' })` in some versions; the code falls back to treating a denial as "blocked", which may be wrong when the prompt was only dismissed.
- Frame rate and tracker speed on real GPUs and phones. All numbers here are software rendering on this machine.

## Weakest points

- The style is a placeholder. Text drawn into canvas textures is crisp at 1600×1000 but should be checked on a 4K TV; small body copy (34–36 px) is the first thing to go at distance.
- `detectForVideo` runs on the main thread (as the decision record warns), about 30 ms per frame here. It can stutter the scene; the game moves it to a worker.
- The "no body" check waits 4 s. In a dark room the tracker may lose the athlete for a moment and flash the message; it may need a longer window or hysteresis.
- The black/frozen thresholds are guesses tuned on fake videos. A very dark room could read as "black".
- The first paint depends on the 0.6 MB (gzipped) PlayCanvas module. A product build should tree-shake it or paint a static frame first.
- Saving tracker files in Cache Storage duplicates what the HTTP cache already does; it was chosen so the byte count stays honest on warm loads, but a product build could rely on a service worker instead.
- Wrists in the camera picture are not the right input space for real menus (see above); this is only correct for this one teaching screen.

## Files

- `index.html`: page shell.
- `lib/app.mjs`: the flow, scene and states.
- `lib/kit.mjs`: neutral tokens, orthographic layout in design pixels, panel/text/camera-feed shaders.
- `lib/pose-loader.mjs`: MediaPipe loading with real progress and caching.
- `lib/camera.mjs`: camera access, error classification, device list, feed health (black/frozen).
- `lib/pose-hands.mjs`: two independent wrists into the shared two-wrist rule.
- `lib/xr.mjs`: WebXR routing and the VR stub.
- `verify/`: capture, timing, fixture and static-server scripts.
- `shots/`: captured stills and `capture-results.json`.
- `DESIGN.md`: the neutral style plan. `ASSETS.md`: sources and licences.

## Capture and critique log

**Round 1** (first full capture, Vite dev server). Everything reachable; problems found:
- The practice target sat over the athlete's face, and "Raise both hands here" was covered by the raised wrists. Moved it overhead (y 160) and moved its text to the lower half, with the per-wrist dots on top where the wrists arrive.
- A separate guidance pill at the bottom competed with the target. Folded the guidance ("Now your other hand", "Hold it there") into the target itself.
- The "Using camera" message landed on top of the practice target. Moved messages to the bottom edge.
- After switching cameras, the black-feed check fired on the new camera's first dark frames. Feed checks now pause while switching.
- The warm-up prompt bled through under a problem card. It now hides while a problem is shown.
- The prompt-dismissed case was unreachable in the test because Chromium's permission state stayed `denied`; and a site-allowed-but-OS-blocked case was missing. Added both.

**Round 2** (static server, all 18 scenarios pass). Looked at every still at full size and at simulated 2.5 m:
- Headset mode said "Your camera is already allowed" under "Enter VR". Fixed.
- The progress label (30 px) and 14 px bar were hard to read from the room. Raised to 34 px and 20 px.
- The blocked-camera text was three long lines. Cut to two sentences with the action first.
- Problem body text raised from 32 to 36 px.

**Round 3** (distance check on `shots/distance/`). Headlines, buttons, wrist markers and the arming ring read clearly at simulated 2.5 m. Body copy is legible but is the weakest text; it is the first thing to grow in a reskin.

## Vendored tracker files are not in git

`vendor/mediapipe/` binaries (model, wasm, bundle) are git-ignored: the model's redistribution terms are not yet reviewed. They exist only in this local checkout. To restore them elsewhere, copy `@mediapipe/tasks-vision@1.0.1` files from `aerobeat-web-vendor-mediapipe/node_modules` and the Pose Landmarker Lite float16 v1 model (SHA-256 above in ASSETS.md); `tasks-vision-package.json` is kept in git for provenance.
