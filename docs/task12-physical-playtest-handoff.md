# Task 12 Desktop and Android Physical-Playtest Handoff

**Evidence date:** 2026-08-29  
**Assembly implementation target:** `2116b87` (corrected live-v4 integration plus locked eight-way Flow and matching frozen raw release on `main`)
**Bead:** `aerobeat-web-assembly-48w.6` — remains open and operator-pending  
**Scope stop:** evaluate Flow and all four experimental Boxing candidates; do not select or promote a production winner.

## QA verdict

Automated desktop, direct-embed, cross-origin iframe, cross-repo, package, privacy, and release-proof gates pass. A real Logitech BRIO was acquired by headed Playwright Chromium and injected into the direct `<aero-game>` public API at 640×480; the game reported `live-camera`, source `host-camera`, mirrored `true`, aspect ratio `4/3`, and connected lifecycle. This is automated device-path evidence, not a human calibration or physical playtest.

Task 12 cannot close yet. Required external/operator evidence is still missing:

1. a person in frame completing the four-second T-pose, cooldown/release, 3-2-1 countdown, Flow, and all four Boxing candidates on desktop;
2. an Android device on the tailnet, with a camera-capable browser and an operator granting camera/autoplay/fullscreen gestures;
3. physical direct-download and local-ZIP-recovery playthroughs for two current, nonprebundled compatible BeatSaver maps;
4. operator observations for reach, guard comfort, target clarity, timing, and motion comfort. These observations are experimental notes only and must not choose a winner.

## Four-section/start repair ready for retest

The physical drawer now exposes exactly **Gameplay**, **Visuals**, **Music**, and **Info** in that order. Gameplay and Visuals use explicit scoped native radios with Flow and Default selected; Music owns BeatSaver search/latest/local, selected version/difficulty/import, progress, and the local library; Info contains only actionable error/limitation text when present and fullscreen. Development scoring/converter/profile-bundle controls remain available through existing APIs and registry contracts but are absent from this drawer.

On a fresh profile, pressing `Calibrate / Start` before playable imported content shows one short Music prerequisite, focuses Music, and makes zero camera requests. The first search result is selected without being represented as playable until import succeeds. A valid current playable package remains selected; otherwise the first local library package is selected deterministically. With playable package+variant selected, Calibrate configures it before camera start and preserves the existing drawer-close → fresh T-pose → cooldown/release → 3-2-1 → play path and menu-pause recalibration policy.

Automated evidence passes two complete test/browser/build-release rounds, dry-run package/diff comparison, recursive deterministic release comparison, exact four-heading/forbidden-text/radio-default assertions, fresh zero-camera gating, valid-current and first-result/library selection, selected-content camera/T-pose/countdown/play, menu pause, direct/iframe privacy, release lock, and no-winner checks. UI scoped selector dependency is `b075797`.

Populated Music semantics are now complete through UI `5e7ac29` and assembly Bead `aerobeat-web-assembly-3cw`: two-map and two-package fixtures at 390×844 and 844×390 each expose exactly one checked native radio, preserve a valid current choice, check the first fallback, and update assembly selection through scalar radio intents. Search, Latest, local ZIP, Import, Export, Delete, and Cancel remain buttons; Version and Difficulty remain selects. Two stable full release rounds are byte-identical (`83a0c645…`, proof `895b14cc…`, `3966471` pre-manifest bytes).

## Minimal phone shell ready for retest

With the drawer closed in steady play, the only visible UI above the camera/video and renderer canvas is the 48px corner menu/pause control and its own background. The legacy calibration, tracking-pause, and countdown presenter cards remain stable internal nodes but are visually suppressed and aria-hidden; the bottom runtime status remains aria-live but visually clipped. An actual requested start may show at most one plain transient cue: `T-pose`, `Hold T-pose`, `Release`, `Tracking lost`, or the current numeric `3`/`2`/`1`. Opening the drawer suppresses that cue.

The drawer has no AeroBeat brand/title or nonactionable Info runtime copy. Compact UI contract `641fd0a` hides authors, mapper/ID details, storage/quota, variant counts, redundant selected details, schemas/hashes/development/explanatory copy while retaining option/action labels, concise error/progress/cancel/blocking-limitation text, and accessible names. Exact composed-tree tests cover idle, calibration, hold, countdown, playing, tracking pause, open-menu pause, Escape recovery, resumed play, and a whole-drawer allowlist at 390×844, plus 844×390 responsiveness. Two stable full release rounds are byte-identical (`2c9f1985…`, proof `0cac9d59…`, `3969716` pre-manifest bytes). Bead `aerobeat-web-assembly-3h7` intentionally remains open for independent QA and physical confirmation.

### Duplicate countdown repaired; exact matrix ready for QA

The product shell now passes no countdown or other overlay into the WebGL renderer. Renderer capability remains available to other consumers, but this assembly's single DOM transient is the sole visual cue. `Release` is explicitly sampled during calibration cooldown before any remaining numeric 3-2-1 cue.

One automated matrix now runs the full real-start state flow in four independent contexts: direct 390×844, direct 844×390, real cross-origin iframe 390×844, and real cross-origin iframe 844×390. Recursive open-shadow inspection proves exact visible UI/text; renderer-frame inspection proves zero canvas countdown/overlay; every closed state proves an exact 48×48 opaque corner control, either one allowed transient or none, stable hidden+aria-hidden legacy nodes, and a 1×1 clipped polite live status. The matrix retains drawer/Music/focus, zero-camera gate, reconnect/lifecycle, privacy, and explicit no-production-winner rejection. It passed twice independently, full test/browser/build passed, and two release/pack recursive rounds are byte-identical (`2c3a5060…`, proof `a001f212…`, `3968857` pre-manifest bytes).

P0 `aerobeat-web-assembly-9s6`, QA Bead `aerobeat-web-assembly-0n6`, and physical Bead `aerobeat-web-assembly-3h7` remain in progress for independent QA/physical confirmation.

### Alpha-one corner control and exhaustive shell proof ready for QA

The exact 48×48 corner menu now has a truly opaque `#03131f` background; computed alpha is exactly `1` in all four contexts and the raw release contains the same override. The hardened matrix traverses the entire rendered composed tree rather than selected roots, classifies every visible element/text, and rejects anything outside environment/video/canvas/menu plus the one state-authorized transient. Renderer input is exactly `countdown:null`, `overlay:"none"`, and `calibrationDim:0`.

The real cross-origin iframe element, child viewport, main, and game bounds are measured at exact 390×844 and 844×390. Drawer text is compared as an exact normalized visible set for baseline and controlled progress/error/camera-limitation fixtures. Start, menu, recovery, lifecycle, reconnect, recursive privacy, and explicit production-winner rejection are locked. The matrix passes twice, full test/browser/build passes, and two release/pack recursive rounds are byte-identical (`36cd13bd…`, proof `b78f6f0d…`, `3971178` pre-manifest bytes).

P0 `aerobeat-web-assembly-ctp`, `9s6`, QA `0n6`, and physical Bead `3h7` remain open for independent QA/physical confirmation.

### Final re-QA failure at `0180797`

Do not begin the next physical retest from this target. All functional shell acceptance passes, but the checked-in release identity is stale: proof/build/cache stamps claim source `36cd13bd…`, while the exact current source and linked dependency graph computes `4765fe8c…`. Two fresh release and pack rounds are mutually byte-identical, but rebuilding changes tracked release identity files, so exact HEAD does not reproduce cleanly.

Linked P0 `aerobeat-web-assembly-bzw` owns the frozen-dependency release refresh. `ctp`, `9s6`, and `0n6` remain in progress. Physical `3h7` remains open and unchanged.

## Host inventory

- Session: active X11 desktop, `DISPLAY=:1`.
- Camera: `/dev/video0` through `/dev/video3`, all Logitech BRIO nodes. V4L2 advertised YUYV and MJPEG from 160×120 through 1920×1080. No image or video was retained.
- Browser: no system Chromium/Chrome command; Playwright Chromium is `/home/derrick/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`.
- Android: `adb` is not installed; no Android USB/MTP device is connected.
- Tailscale: online at `derrick-alienware-aurora-r13.tail613fcb.ts.net`; HTTPS `:8443` is configured to proxy `127.0.0.1:5173`.
- The approved existing `npm run dev:tailscale` Vite process remains running on `127.0.0.1:5173`; the local route returns HTTP 200. Do not stop or replace it without Derrick's instruction.

## Launch commands and URLs

From `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`:

### Desktop direct embed

```bash
npm run dev
```

Open `http://127.0.0.1:5173/`. Localhost is a secure context for camera access.

### Android secure context

The `:8443` Tailscale handler is already configured. During active development and Derrick-owned physical testing, keep the existing Vite target running continuously; stop it only when Derrick explicitly asks. Start only this target:

```bash
npm run dev:tailscale
```

Open `https://derrick-alienware-aurora-r13.tail613fcb.ts.net:8443/` from an Android browser on the same tailnet. If `tailscale serve status --json` no longer shows `:8443 -> http://127.0.0.1:5173`, stop and have the operator restore the documented route; do not reset other Tailscale handlers.

### Cross-origin iframe

Automated cross-origin acceptance is the supported no-operator path:

```bash
npm run test:browser
```

It creates an ephemeral parent origin, an independent Vite child origin, and `iframe#game` with `allow="camera; fullscreen; autoplay"`; it verifies exact source/origin/instance/version handshake, payload limits, profile identity parity, teardown, and zero unexpected product console errors. There is no persistent manual iframe server checked into this repo. Starting a separate manual parent server requires explicit operator approval.

## Exact selectors

Playwright pierces the open component shadow roots.

- Direct root: `page.locator("aero-game")`
- Hamburger: `page.locator("aero-game").getByRole("button", { name: /configuration menu/ })`
- Configuration drawer: `page.locator("aero-game").getByRole("dialog", { name: "Game configuration" })`
- Camera permission/start: `page.locator("aero-game").getByRole("button", { name: "Calibrate / Start" })`
- Direct BeatSaver presenter (inside the drawer): `page.locator("aero-game").locator("aero-beatsaver-browser")`
- BeatSaver map choices: `page.locator("aero-game").locator("aero-beatsaver-browser").getByRole("radio")`
- Local library choices: `page.locator("aero-game").locator("aero-content-library").getByRole("radio")`
- Search field: `getByLabel("Search maps")`
- Latest button: `getByRole("button", { name: "Latest" })`
- Local fallback: `getByRole("button", { name: "Choose local ZIP" })`
- Selected-map version/difficulty controls: `getByLabel("Version")`, `getByLabel("Difficulty")`
- Import: `getByRole("button", { name: "Import selected map" })`
- Gameplay radios: `page.locator("aero-game").locator('aero-prototype-selector[scope="gameplay"]')`
- Visual radios: `page.locator("aero-game").locator('aero-prototype-selector[scope="visuals"]')`
- Calibration status: `page.locator("aero-game").locator("aero-calibration-badge")`
- Fullscreen: `page.locator("aero-game").locator("aero-fullscreen-button")`
- Automated iframe: `page.locator("iframe#game")`
- Iframe child root: `page.frameLocator("iframe#game").locator("aero-game")`

Gameplay labels:

1. `Flow`
2. `Semantic Row`
3. `Spatial Row`
4. `Semantic Cut`
5. `Spatial Cut`

The physical drawer exposes visual choices only under Visuals. Experimental scoring/converter/profile-bundle controls remain direct-host API/registry contracts and are intentionally absent from this product drawer.

## Current nonprebundled BeatSaver candidates

These IDs were queried from the live public BeatSaver API through `AeroBeatSaverVendorService` on 2026-08-29 and do not appear in tracked AeroBeat source. They are handoff candidates, not an allowlist; if either disappears, query two new compatible Standard maps.

| Map ID | Name | Version SHA-1 | Standard difficulty |
| --- | --- | --- | --- |
| `53EFD` | New To This | `4b378ac94101d421c49b110564900365555f4bf6` | ExpertPlus |
| `51D2F` | SANDS OF TIME (2020 version) | `9940edb4a5ef36895c4b797e229c8b38307139a1` | ExpertPlus |

For each map, exercise both paths:

1. normal provider selection and direct archive acquisition;
2. a separately downloaded local ZIP selected with `Choose local ZIP` after simulating or observing a CORS/direct-download failure.

Do not commit the ZIP, audio, cover, screenshots, or exported package.

## Operator script

Repeat on desktop direct embed and Android HTTPS. Run iframe behavior through the automated cross-origin command above; if a manual iframe host is separately approved, repeat the same game script there.

### 1. Permissions and source truth

1. Load the exact target and confirm there is one `<aero-game>` and no `<aerobeat-app>`. First run opens the compact configuration drawer over a viewport-filling camera/renderer surface.
2. Choose content/gameplay in the drawer and press `Calibrate / Start`. Grant camera permission. The drawer remains open deterministically so configuration cannot accidentally complete a hidden T-pose; close it with ×, the backdrop, hamburger, or Escape to arm calibration.
3. In steady closed play, confirm only the stable playfield and top-right menu/pause control remain. During calibration, recovery, or countdown, allow only one plain T-pose/release/tracking/numeric cue—never a card, heading, ID, reset button, or bottom status pill. Audio and fullscreen must begin only after explicit gestures.
4. Confirm the visible/source telemetry identifies MediaPipe Pose Landmarker Lite float16 `/1/`, tasks-vision `1.0.1`, GPU-WebGL, thresholds `0.5/0.5/0.5`, Fast tracking, direct full input, measured/current gameplay, and a 15fps submission ceiling.
5. Confirm mirror/source/aspect changes invalidate calibration.
6. Confirm the preview is top-left coordinates, gameplay camera is bottom-left, and the athlete public grid is horizontally opposed.

### 2. Calibration

1. Stand fully in frame with shoulders, elbows, wrists, hips, knees, and ankles visible at confidence at least 0.5.
2. Hold a T-pose continuously for four seconds. Expected wrist/elbow Y ratio is 0.35 and minimum elbow angle is 130 degrees.
3. Complete the four-second cooldown and release.
4. Observe the frozen 3-2-1 countdown: gameplay and audio remain frozen until playing.
5. Move through the calibrated 4×3 grid and verify no clamping; verify 8×6 subcell target placement for Boxing.
6. During play, hold a fresh four-second T-pose. It must enter the same tracking/calibration pause, cooldown/release, frozen 3-2-1, and resume path rather than continuing to score.
7. During play, open the hamburger. Gameplay/audio pause immediately while camera, CV, and frame processing remain active. Close the drawer: it must stay paused, never auto-resume, and require a fresh four-second T-pose plus cooldown and 3-2-1.
8. Hide the page or cover/leave frame for at least 500ms. Gameplay, audio, and inference must pause immediately while camera retention follows policy; return requires a fresh calibration ID/countdown.

### 3. Content acquisition and persistence

For both map IDs:

1. Search by ID, open details, select the exact version and Standard difficulty, and import.
2. Observe progress, cancellation, and retry once; no partial package may become selectable.
3. Verify the generated library entry survives a reload/reconnect, can be selected, and can be deleted.
4. Exercise direct download, then local ZIP fallback. Confirm malformed/wrong-hash archives fail without partial persistence.
5. Observe offline/404/429/CORS/codec messaging where safely reproducible; errors must be bounded and must not expose bytes or stack internals.

### 4. Flow and four Boxing candidates

Run the same compatible chart through all five labels. Do not rank them.

- Flow: verify authored notes, bursts, bombs, obstacles, and arcs align with audio and the calibrated grid.
- Semantic Track · Row Family
- Spatial Grid · Row Family
- Semantic Track · Cut Family
- Spatial Grid · Cut Family

For each Boxing run:

1. Verify inclusive ±180ms hit windows, measured evidence freshness at most 150ms, straight qualification 100ms, and 360ms punch spacing.
2. Confirm positive-only, one-action consumption.
3. Verify guard/punch exclusivity only for overlapping windows and obstacle+punch concurrency when disjoint.
4. Verify left/right direction and athlete-facing horizontal opposition.
5. Pause and switch a scoring profile only between runs. Confirm preserved old events retain old generation truth and distinct future events with the same variant ID use the new profile.
6. Switch visual profiles during a run and confirm stable canvas/video/UI nodes.
7. Select a converter profile: it remains pending until regeneration; after regeneration and package reload it reports applied provenance.
8. Confirm shadow results never change live judgement or score.

### 5. Lifecycle, fullscreen, lease, and privacy

1. Enter/exit fullscreen from the child control only.
2. With two direct instances, transfer the media lease and verify exactly one camera/audio owner.
3. Disconnect/reconnect the same element: stable surfaces remain, but a fresh graph/generation is created and late old work stays silent.
4. In iframe automation, send wrong-origin/source, duplicate-ID, oversized, deep, accessor, hidden, symbol, cycle, and class payloads; all must reject without getter execution or state mutation.
5. Inspect snapshots/events/network messages. They may contain bounded identities, hashes, normalized landmarks, progress, handles, and gameplay telemetry. They must never contain ZIP/audio bytes, Blob/File, MediaStream/tracks, VideoFrame, pixels, frames, or screenshots.

## Expected telemetry checkpoints

- `getSnapshot().lifecycle === "connected"` while attached.
- Container CSS width/height equals the actual host content box and carries current DPR.
- Five content variants are available after conversion.
- Gameplay and content selected variant IDs agree.
- Calibration/countdown audio state is not playing; playing state is either playing or truthfully autoplay-blocked.
- Hidden/tracking-loss state is paused immediately.
- Public profile telemetry contains identity/version/hash/class and regeneration state only, never settings or bundles in iframe mode.
- Converter applied state is false only after regenerated package provenance matches the selected hash everywhere required.

## Corrected live-v4 import ready for eight-way physical QA

Vendor `l3h` implementation `7b14eec` and independent `u02` closure `b9d19a6` correct the current v4 provider hash contract without an integrity bypass. Assembly `kdf` adds a network-independent actual-service golden that authors/selects through the Music UI, rejects tampered v4 bytes, and preserves v2/v3 local ZIP. Optional `npm run test:live-v4-import` fetched exact `53F26` version `addd9d6f8e7340ad6f5633947136d8475a7a99b5`, authored and persisted a package, selected Flow plus four Boxing variants, exposed no raw bytes, requested no camera, and removed the ephemeral package afterward. Live source also exposed valid diagonal cuts crossing gameplay's cardinal-only acceptance. The attempted authoring normalization was the wrong owner and is forward-reverted at `fa824fc`; gameplay P0 `aerobeat-web-gameplay-uau` at `2326ccb` owns eight-way Flow validation/matching while authoring preserves exact Beat Saber direction semantics and Boxing remains unchanged. Assembly `02a1671` maps source `0..7` to exact eight-way renderer directions rather than the legacy rotated cardinal map.

The cross-repo automated boundary is now complete: contracts eight-way QA closure `c1e14f9` plus directionless entry closure `0c8fba8`, gameplay eight-way closure `e0f194f`, input rolling/directionless evidence `f23b372`, renderer visible cues `3cd09ce`/`a59d930`, and assembly mapping `02a1671` are clean and synchronized. Automation proves acquisition, integrity, conversion, persistence, selection, Music readiness, exact eight-way data flow, privacy, and no-winner posture. It does **not** prove camera calibration or physical play; operator phone evidence for `kdf` remains pending.

The frozen release fingerprint is `6c913fcd1b17aa115e2112c0dd76ff0b327fcf0089fd45267d17ccdeec28fa97`; proof SHA-256 is `dfdae0d909ee47b48f9c886e8210a0b133d5711a552b083bb5b4867bca165e31`; pre-manifest bytes are `4004042`. Proof, embedded build/cache stamps, two release rounds, recursive manifests, and final dry-run packs match. `bzw` remains open for independent QA.

## Automated evidence collected

- Assembly `check`, `test`, browser, two `build` + `build-release` rounds, pack, and diff pass. Recursive release manifests are byte-identical.
- `scripts/validate-mobile-gameplay-menu.js` runs exact Chromium 390×844 portrait and 844×390 landscape coverage with mocked `getUserMedia` and injected measured pose frames. It proves composed-tree exact visibility/text for idle, calibration, hold, countdown, playing, tracking pause, open-menu pause, Escape recovery, and resumed play; one-control steady play; one-cue transient states; clipped aria-live status; hidden legacy HUD cards; drawer text allowlist; stable viewport-filling video/canvas; >=44px corner control; populated current/fallback Music radios and scalar intents; zero-camera missing-content gating; full permission/start/T-pose/countdown/play; retained camera/CV menu pause; audio gates; reconnect isolation; and zero unexpected console noise.
- `scripts/validate-product-shell-matrix.js` is the strict product acceptance matrix. It repeats the full real-start flow in direct and real cross-origin iframe embeds at both 390×844 and 844×390, exhaustively classifies every rendered element/direct text across the complete open-shadow composed tree, and inspects all renderer overlay inputs. It samples Release explicitly and proves exact 48×48 alpha-one menu geometry, one DOM transient or none, zero canvas countdown/overlay/dim, measured iframe/child/game bounds, stable hidden+aria-hidden legacy identities, clipped polite status, exact baseline/progress/error/limitation drawer sets, Music/focus, service destruction/media-idle reconnect, recursive privacy, and explicit production-winner rejection.
- Task 11 nine-path v2/v3/v4 × online/direct/local matrix reproduces all package hashes and loads Flow plus four Boxing variants.
- Cross-origin Chromium verifies exact parent sizing, direct/iframe parity, fullscreen gesture path, reconnect/destructor silence, lease transfer, hidden/safety/audio policy, hostile payload limits, profile atomicity, and no raw-byte bridge leakage.
- Vendor, authoring, contracts, gameplay, input, renderer, and assembly corrected owners are clean and synchronized; `kdf`/`bzw` and physical QA remain open without production promotion.
- Godot content-core contract suite passes.
- Godot authoring suite passes with exit code 0 and retains the pre-existing shutdown diagnostics: `WARNING: ObjectDB instances leaked at exit` and `ERROR: 10 resources still in use at exit`.
- Release proof ships only the locked MediaPipe concrete pose vendor/backend, no runtime WASM assets, and records forbidden MoveNet/ONNX/TensorFlow/predictive marker scans.

## Physical evidence record

Fill this section during operator play. Do not infer results from automation.

| Check | Desktop direct | Android HTTPS | Notes |
| --- | --- | --- | --- |
| Gameplay-first playfield, corner control, minimal drawer | pending | retest pending | Initial Android loads exposed dense-overlay/no-start/copy P0s. Gameplay-first `5c95ae8`, scoped UI `b075797`, four-section/start `b02bf68`, compact copy `641fd0a`, and minimal shell Bead `3h7` pass coder gates; independent QA and operator confirmation remain required. |
| Camera prompt and live BRIO/phone camera | pending | pending | |
| Four-second T-pose + cooldown/release | pending | pending | |
| 4×3 grid and 8×6 subcells | pending | pending | |
| Flow physical play | pending | pending | |
| Semantic Row physical play | pending | pending | |
| Spatial Row physical play | pending | pending | |
| Semantic Cut physical play | pending | pending | |
| Spatial Cut physical play | pending | pending | |
| Two current maps direct acquisition | pending | pending | |
| Two current maps local ZIP fallback | pending | pending | |
| Fullscreen/autoplay gestures | pending | pending | |
| Tracking loss/recalibration/hidden | pending | pending | |
| Comfort/clarity observations | pending | pending | Experimental notes only; no winner. |

Task 12 may close only after the required physical rows are truthfully completed and any failures have linked repair Beads.
