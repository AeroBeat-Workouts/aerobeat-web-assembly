# AeroBeat 3D Tracking Accessory Research (2026 Current State)

**Bead:** `aerobeat-web-assembly-0wtw` · Research only, no implementation. · Date: 2026-09-11 (playtest round 6 direction)
**Direction (Derrick):** depth-aware camera = the additive "recommended" way to play (keeps camera-gameplay benefits, adds 3D); SteamVR lighthouse = the precision tier (hyper-accurate 3D, rumble if controllers involved); webcam stays the drop-in core.

## 0. AeroBeat's existing input architecture (verified in repos)

The claim that "a new input backend would slot in if the interface is pose-frame-generic" is **true, and the existing contract is exactly pose-frame-generic — with one important catch: the current `NormalizedPoseFrame` is 2D.**

- [`aerobeat-web-contracts/src/pose-adapter.js`] defines the vendor-neutral structural `AeroPoseAdapter` boundary: `load()`, `estimateNormalizedPoseFrame(frameSource?, options?)`, lifecycle statuses, optional `getExecutionTelemetry()` / `capabilities` / `dispose()`. The decision doc (`docs/decisions/pose-adapter-contract.md`) states it explicitly lets the CV service inject "MoveNet, MediaPipe, ONNX Runtime, mock, and replay implementations without importing vendor runtime objects." A SteamVR or depth-camera adapter is structurally just another injected adapter.
- [`aerobeat-web-cv`] confirms: `createAeroCameraCvService()` "injects one generic `AeroPoseAdapter`, plus an optional fallback adapter" and "consumes the vendor-neutral `AeroPoseAdapter` contract … with no runtime dependency on a concrete pose vendor." The `check:imports` rule even *forbids* CV from importing vendor packages — adapters are assembly-injected.
- **The catch — the frame shape is 2D:** [`aerobeat-web-contracts/src/pose-shapes.js`] `NormalizedPoseLandmark` carries only `{name, x, y, confidence}` where x/y are normalized camera/preview coordinates. There is **no z field**. So "pose-frame-generic" is true for *source-agnostic* adapters (a WebSocket-driven adapter is trivially valid), but **not** for depth: true-3D input requires an *additive contract change* (a `z`/depth field, or a parallel `NormalizedPose3DFrame`), which then flows into the body-grid mapping in [`aerobeat-web-input`] (the calibrated 4×3 athlete grid is built from 2D camera coordinates via `cameraPreviewToAthlete`). The gameplay/scoring stack consumes normalized landmarks and is largely downstream-agnostic, but the grid math assumes a camera projection. A depth backend would reuse the routing/evidence/scoring stack and swap the projection step — that's the "new input backend + contract extension" effort class, not a free slot-in.
- Also relevant: the Godot-side [`aerobeat-input-xr`] is already scoped as **"future support only … not part of the current official AeroBeat v1 gameplay-input story. Official v1 gameplay remains camera-driven Boxing and Flow on PC first."** So an accessory input lane is a recognized-but-deferred direction, consistent with a two-product framing.
- CV today: MediaPipe Pose Landmarker Lite, measured ~63 ms p50 total on midrange Android Chrome (`aerobeat-web-cv/docs/telemetry/browser-pose-runtime-research-2026-08-27.md`), with the pose-age measured in the 85–105 ms band per the 0.0.51 playtest telemetry.

## 1. SteamVR Lighthouse + wrist trackers (Derrick's example)

### 1.1 Availability, 2026
- **Valve stopped manufacturing the Valve Index on Nov 12, 2025** (announced with the Steam Frame reveal; Valve designer Lawrence Yang told The Verge the Index is "no longer manufacturing"; Jeremy Selan confirmed on Tested that Valve will **support the device long-term**). Valve stated it is **not** bringing lighthouse support to the Steam Frame — the new headset is inside-out. ([The Verge](https://www.theverge.com/news/817967/valve-index-vr-headset-stopped-manufacturing-frame), [heise](https://www.heise.de/en/news/Valve-confirms-No-new-Half-Life-Alyx-and-end-of-the-Valve-Index-VR-headset-11077163.html))
- **Base Station 2.0 (Valve):** $149 on [Steam](https://store.steampowered.com/app/1059570/Valve_Index_Base_Station/) is **out of stock**, with no announced restock. That is the *only* lighthouse hardware Valve currently lists.
- **HTC still sells new lighthouse hardware** — this is the practical 2026 supply path:
  - **SteamVR Base Station 2.0** (HTC's clone of Valve's 2.0): **$229, in stock** at the [VIVE Store](https://shop-us.vive.com/products/2104005), supports up to 4 base stations / 10 m × 10 m.
  - **VIVE Tracker 3.0** (lighthouse wrist/foot tracker): **$149** (Knoxlabs $124.99 new; Newegg $148.99; [VIVE Store](https://shop-us.vive.com/products/vive-tracker-3-0-full-body-tracking); Micro Center in stock). 75 g, USB-C, 1/4″ mount.
- **Secondary market:** Valve Index controllers and older trackers trade on [Swappa](https://swappa.com/prices/valve-index-controllers); Base Station 2.0 used listings typically land near the $149 MSRP with stock-dependent premiums.
- **Headset-less operation is a known working config:** SteamVR runs base stations + trackers with **no HMD** using the null driver / `requireHmd: false` — documented step-by-step in [SteamVRNoHeadset](https://github.com/username223/SteamVRNoHeadset) and confirmed in [openvr issue #1403](https://github.com/ValveSoftware/openvr/issues/1403) (a Valve engineer confirms `requireHmd: false` suffices). A [community write-up](https://satoshiinblack.medium.com/running-steamvr-without-a-headset-attached-using-the-null-driver-bd538123e095) ran two Lighthouse 2.0 stations + ten Vive Tracker 3.0 units headset-free on Windows 11.
- **Concrete portability cost:** 2× base stations (~$458), placed on tripods/monitors at opposite corners of the play area, each with a power cable and ~10 m × 10 m coverage. 2× wrist trackers ($298). Total **~$756** of new hardware, plus physical station setup, plus a PC with SteamVR running. It does not drop in.

### 1.2 Tracking quality / latency / precision
- **Precision:** peer-reviewed multi-station study on SteamVR Tracking 2.0 ([Sensors 2023, DOI 10.3390/s23020725](https://doi.org/10.3390/s23020725), UR10 robot arm as ground truth, VIVE Tracker 3.0) found **sub-millimeter static precision with 2 base stations** (mid sub-mm; low sub-mm with 4), and **sub-millimeter dynamic precision at slow velocities, degrading with speed**. An independent HTC Vive Pro study ([Sensors 2021, DOI 10.3390/s21051622](https://doi.org/10.3390/s21051622)) found reproducible millimeter-level precision but **centimeter-level systematic error** without careful calibration — i.e., *precision* is sub-mm, *absolute accuracy* needs a calibration session.
- **Latency:** Oliver Kreylos's OpenVR-level analysis ([Game Developer](https://www.gamedeveloper.com/design/an-expert-look-inside-the-htc-vive-s-positional-tracking-system)): base stations sweep at **120 Hz (8.333 ms cycle)**; worst-case latency at the OpenVR interface **~1 ms for heads, ~2.7 ms for controllers**, ~4 ms through vrserver. A mocap-fusion wiki puts 2.0-station pose reconstruction worst-case at **~20 ms** + 5–8 ms wireless transfer. Peer-reviewed motion-to-photon measurements measure 21–42 ms before motion prediction reduces it to 2–13 ms.
- **Bottom line:** the "10–20 ms, sub-mm class" expectation is **verified** — an order of magnitude better than webcam on both axes.

### 1.3 THE critical architecture question: data path into a WEB app
OpenVR is a native SDK (C++/Rust bindings) with **no browser API**. The bridge is a small native helper that owns a SteamVR driver and streams pose frames out. **Working open-source precedents:**

| Project | What it is | Relevance |
|---|---|---|
| [v0xie/OpenVR-Tracker-Websocket-Driver](https://github.com/v0xie/OpenVR-Tracker-Websocket-Driver) (MIT) + active fork [John-Dean](https://github.com/John-Dean/OpenVR-Tracker-Websocket-Driver) | SteamVR **driver** hosting a WebSocket server at `ws://127.0.0.1:12100` that **echoes the pose of all active devices** as JSON; also spawns virtual trackers. | **Closest off-the-shelf fit** — explicitly built for web apps. |
| [BOLL7708/OpenVR2WS](https://github.com/BOLL7708/OpenVR2WS) | WebSocket server with SteamVR I/O as JSON on `ws://localhost:7708`, NPM types package + example client. | Proves the JSON-WebSocket contract is stable. |
| [kr15h/tundra-stylus](https://github.com/kr15h/tundra-stylus) | OpenVR proxy middleware extracting tracker poses into a **three.js Web UI over WebSocket** (`ws://localhost:8080`), reusable `TundraStylus` JS class. | Direct proof of a tracker-driven **browser** app. |
| [Lighthouse Stylus (ACM TEI '26)](https://dl.acm.org/doi/10.1145/3731459.3779348) | Peer-reviewed: Lighthouse tracker → SteamVR (null driver, no HMD) → **Python middleware → WebSocket → browser JS app**, <1 mm accuracy claimed. | Published, replicable, open source — the exact no-headset lighthouse → web app data path. |
| [personalrobotics/openvr_ros_bridge](https://github.com/personalrobotics/openvr_ros_bridge) | Publishes all OpenVR device poses to ROS / **generic JSON WebSocket** without ROS. | A second, more general bridge. |
| [kfarr/fun-with-tracker](https://github.com/kfarr/fun-with-tracker) | A-Frame + Vive Tracker playground, browser-driven. | Historical proof of concept. |

**Note on WebXR:** Chrome 81+ exposes SteamVR lighthouse headsets to WebXR via SteamVR's OpenXR runtime — but that delivers **headset + controllers** to an immersive-vr session (the full-VR lane) and has **not** historically exposed **body trackers** (the [webxr-input-profiles issue #47](https://github.com/immersive-web/webxr-input-profiles/issues/47) documents that tracker roles like "Left Hand"/"Right Wrist" are not passed through). For *wrist trackers* driving a *non-immersive* web game, the **WebSocket-bridge lane is the real answer**, and it's well-trodden.

**Effort class of the bridge:** **small.** A SteamVR driver or proxy middleware (C++/Rust) polling `vr::TrackedDevicePose_t` at 90–120 Hz and writing a JSON pose frame to a localhost WebSocket; the browser side is a ~100-line adapter into `NormalizedPoseFrame`/`NormalizedPose3DFrame`. The hard part is (a) the native build/ship story (user runs a Windows helper with SteamVR) and (b) the 2D→3D contract extension above.

## 2. Quest 3 / PSVR2 repurposing

**Verdict: not a webcam replacement. Controllers alone track nothing externally. Using the headset is "it's just VR then."**

- **Quest 3 / 3S Touch Plus controllers do NOT self-track.** No onboard cameras, no tracking rings; tracked by the **headset's inside-out cameras** seeing IR LEDs on the controller faceplate, fused with a ~240 Hz controller IMU. Meta's official help: they **can only be used with a Quest 3/3S**. The only self-tracking Meta controllers are the Quest Pro **Touch Pro** (onboard cameras) — niche, pricier, still headset-pipeline dependent. 2026: Horizon OS v2.7 "Gamepad Mode" emulates an Xbox gamepad over Steam Link — a *gamepad* input, not 3D tracking.
- **PSVR2 Sense controllers:** same inside-out dependence. Community 2026 progress on building blocks: [psvr2-controller-ir-lights-enable](https://github.com/odin30814-cmyk/psvr2-controller-ir-lights-enable) reverse-engineered HID activation of the controller IR LEDs without the headset (93.75 Hz, verified optically) + an OpenCV PnP scaffold, but "LED activation and 2D blob detection, **not full 6DoF pose tracking** yet." [PSVR2_Outside-In_Tracking](https://github.com/Kinetic1717/PSVR2_Outside-In_Tracking) (archived) confirmed LEDs visible to external IR cameras but the constellation map is undocumented. **Research-grade, not a product.**
- **The boundary framing:** Quest 3 on-head + PC game = full VR, a different product than AeroBeat web v1 (per `aerobeat-input-xr` scope). Controllers alone, no headset → infeasible. No "Quest-as-webcam-replacement" lane exists today.
- **Worth one line:** the **VIVE Ultimate Tracker** ($229, in stock) — *inside-out* self-tracking (two onboard cameras), **no base stations**, headset-free, SteamVR-compatible via dongle. Precision **~4.98 mm ± 4 mm**, degrading with lighting/speed/distance ([arXiv 2409.01947](https://arxiv.org/html/2409.01947)). The "lighthouse precision, no base stations" middle option — same OpenVR/WebSocket bridge as Section 1.

## 3. Depth cameras as the non-VR middle ground (surfaced, not named by Derrick)

### 3.1 Kinect v2
- **2026 availability/price:** discontinued by Microsoft; used Xbox One Kinect (model 1520) **~$10–40**, NOS ~$80, Kinect for Windows dev version (1656) **~$120–180**; needs the proprietary Kinect-for-PC adapter for the Windows version. ([BigGo price tracker](https://biggo.com/s/Kinect%20V2), [Accio](https://www.accio.com/plp/microsoft-kinect-v2-sensor))
- **Sensing:** IR time-of-flight depth, **512×424 @ 30 fps** millimeter depth, **global shutter** (no motion blur in the depth channel), USB 3.0. ([libfreenect2](https://github.com/openkinect/libfreenect2), [Rodriguez et al. 2015](https://www.ais.uni-bonn.de/~rodriguez/publications/2015_kinect2.pdf))
- **True 3D positions:** depth + intrinsics → per-pixel 3D; skeleton via the Microsoft Kinect v2 SDK (25 joints, Windows-only) or NiTE2 (closed). [libfreenect2 #706](https://github.com/OpenKinect/libfreenect2/issues/706): the driver doesn't do skeleton — pair with the MS SDK/NiTE or run your own joint estimation.
- **Latency:** MS spec minimum **20–60 ms**; over-budget frames drop rather than queue ([libfreenect2 #721](https://github.com/OpenKinect/libfreenect2/issues/721)); realistically **~30–50 ms end-to-end**.
- **Precision:** robotic-arm study: depth-position accuracy within **~10–12 mm** over multi-meter ranges ([MDPI Appl. Sci. 2021](https://doi.org/10.3390/app11125756)); clinical study vs Vicon found moderate-to-excellent landmark agreement ([PLOS ONE](https://doi.org/10.1371/journal.pone.0166532)). **cm-class true 3D.**
- **Open-source stack:** [libfreenect2](https://github.com/openkinect/libfreenect2) (C++/OpenCL/CUDA, OpenNI2 driver, Python bindings). **Browser bridge:** identical pattern to Section 1 (native helper → WebSocket JSON of 3D joint positions). Effort: **small-to-medium.**

### 3.2 Intel RealSense D435 / D455
- **Status — correction to the "discontinued" assumption:** RealSense spun out as a standalone company **July 11, 2025** ($50 M Series A, Intel Capital + MediaTek), and the **D400 stereo line remains in production** ([Reuters](https://www.reuters.com/business/realsense-spins-out-intel-secures-50-million-drive-ai-vision-robotics-2025-07-11/), [TechCrunch](https://techcrunch.com/2025/07/11/realsense-spins-out-of-intel-to-scale-its-stereoscopic-imaging-technology/), [2025 datasheet](https://realsenseai.com/wp-content/uploads/dlm_uploads/2025/08/Intel-RealSense-D400-Series-Datasheet-August-2025.pdf)).
- **Sensing:** stereo IR active depth, up to 1280×800 @ 90 fps depth, point cloud, USB 3.0. Mature [librealsense](https://github.com/IntelRealSense/librealsense) stack.
- **Latency (Intel's own team, [librealsense #1242](https://github.com/IntelRealSense/librealsense/issues/1242)):** **~60–70 ms** depth/IR, ~100–140 ms RGB; ~60 ms is the practical USB floor; Linux lower than Windows.
- **Why it fits AeroBeat:** true 3D, IR robust to room lighting, no motion blur in the depth channel, no headset, single USB plug. Caveat vs Kinect: stereo (not ToF); RGB rolling-shutter during fast motion — but the *depth* channel drives the game.

### 3.3 Why depth cameras specifically address Derrick's three pains
- **#2 missing depth → solved:** true per-joint 3D (cm-class), no parallax guessing. Straight punches land where they are.
- **#1 mid-song tracking loss → largely solved:** IR depth is lighting-robust, global/active shutter — the RGB failure modes (motion blur, lighting change, occlusion) are far rarer.
- **#3 perceived delay → solved:** ~30–60 ms end-to-end vs measured 85–105 ms pose age.

### 3.4 Orbbec Persee 2 (Derrick's addition, 2026-09-11) — all-in-one depth camera + onboard computer

[Orbbec Persee 2](https://store.orbbec.com/products/persee-2) (researched 2026-09-11):

- **Form factor:** all-in-one active-stereo-IR depth camera **with an embedded computer** — Amlogic A311D hexa-core (A73×4 + A53×2) + NPU (~5 TOPS), 4 GB RAM, 32 GB eMMC, Orbbec depth ASIC. Runs **Android 9 or Ubuntu 18.04 onboard**; ships with the **Orbbec SDK + Orbbec Pose SDK (skeleton tracking on-device)** — i.e. it can emit pose frames itself, not just depth.
- **Sensing:** active stereo IR 850 nm, depth accuracy ≤2% @ 2 m, range 0.2–10 m, depth up to 1280×800 @ 30 fps / 640×400 @ 60 fps, FOV H91°×V66°, RGB up to 1280×800@30, built-in IMU, hardware depth-to-color alignment. 180×45×76.5 mm, 352 g, 12 V/2 A.
- **Connectivity:** **Gigabit Ethernet (RJ45)**, USB-C, HDMI 2.0, Wi-Fi, BT 5.0, 4-mic array — a networked device, not a USB plug-in; a small WebSocket/HTTP helper on (or beside) it streaming pose/depth JSON into `AeroPoseAdapter` is the natural bridge (same pattern as the Kinect/RealSense helpers, with the extra option of running the helper *on* the camera's own OS).
- **Price (flag):** street found **€689.95 incl. VAT (MyBotshop DE)** / ~$700+ USD — **above** Derrick's sub-$500 figure; verify the US store price at [store.orbbec.com](https://store.orbbec.com/products/persee-2). The wider Orbbec stereo line (Femto / Gemini class) is the cheaper USB-3 "depth camera" path if the onboard-compute box isn't needed.
- **Why it may be the best Tier-1 ship candidate:** on-device skeleton tracking removes the host-CPU pose-estimation step entirely (no MediaPipe-class inference on the PC/browser); IR active stereo is lighting-robust (attacks the #1 pain); the networked all-in-one box is an **arcade-oriented** deployment (Derrick's own framing, §8) — one box, one cable, no base stations, no headset.
- **Effort class:** small bridge (WebSocket pose JSON → `AeroPoseAdapter` + the additive 3D contract of §7). Uncertainty to verify in the prototype: on-device Pose SDK joint set vs the 7 anchors AeroBeat needs (nose/shoulders/elbows/wrists), update rate, and pose age over the network path.

## 4. IMU-only wristbands / other
- **Why IMU-only lacks absolute position:** double integration accumulates sensor bias/noise quadratically — a 0.01 m/s² bias → **~9 m error after 30 s** ([Queen's University Belfast study](https://pureadmin.qub.ac.uk/ws/portalfiles/portal/538642477/sensors_23_00360.pdf)); usable ~1–2 s before correction; no external room anchor at all. ML dead-reckoning "exhibit noticeable drift after prolonged movement, inherent limitation" ([TechRxiv](https://doi.org/10.36227/techrxiv.175492124.47988269/v1)).
- **Where IMU-only fits:** direction enforcement only (already implemented as a *semantic* straight-continuity check in `aerobeat-web-input`), or a bridging sensor through brief occlusions.

### 4.1 SlimeVR full-body IMU trackers (Derrick's addition, 2026-09-11) — the cheap reset-gesture tracker tier

[SlimeVR](https://slimevr.dev/) (researched 2026-09-11):

- **Price:** v1.2 sets — Lower-Body (5 trackers) **$219**, Core (6) **$259**, Enhanced Core (6+2) **$325**, Full-Body (8+2) **$415**; newer **Butterfly** dongle-based trackers from **$279**. Head + both wrists fit in the $259 Core set — squarely in Derrick's sub-$500 band.
- **Hardware (v1.2):** TDK ICM-45686 IMU + QMC6309 magnetometer with **on-microcontroller sensor fusion**; trackers connect over **local Wi-Fi** (or the driverless Butterfly dongle) to a PC, smartphone, or headset.
- **Drift:** yaw drift is inherent — typically noticeable after **20–60 minutes** of activity; **enabling the magnetometer (in a good magnetic environment) eliminates it almost entirely**. Derrick's framing: the drift is acceptable **because the reset gesture works like the webcam T-Pose** — "needs a reset gesture (similar to webcams needing to T-Pose between songs)."
- **Reset gesture:** default = look forward + **double-tap the chest tracker**; configurable (keyboard/controller/other-tracker double-taps). This maps 1:1 onto AeroBeat's existing T-pose re-entry UX, including the inter-song reset.
- **Software / web path:** the SlimeVR Server is **open-source** (5+ years, 50+ contributors) and outputs to **SteamVR, OSC, VMC, BVH, OpenXR** — so an `AeroPoseAdapter` fed by SlimeVR's OSC/WebSocket stream is a real, established lane (same bridge shape as §1.3, no native build required — the server is the helper).
- **Positioning:** not a precision tier — it's the **cheapest "trackers on wrists" entry** and validates the reset-gesture interaction Derrick likes; drift + no absolute room anchor means it slots *below* depth cameras and lighthouse in accuracy, and needs a calibration/reset ritual per session (exactly the T-pose pattern). Candidate Tier 1.5 (cheap tracker tier) or a user-chosen alternative to the depth camera.

## 5. Latency & accuracy comparison table

| | **Webcam + MediaPipe (today)** | **Lighthouse + wrist trackers** | **Kinect v2** | **RealSense D435/D455** | **VIVE Ultimate Tracker** | **IMU-only band** |
|---|---|---|---|---|---|---|
| **Position type** | 2D normalized + confidence | **True 3D (pos+quat)** | **True 3D depth (mm)** | **True 3D point cloud** | **True 3D (self-tracking)** | **None (drift)** |
| **Precision** | ~cm-class w/ parallax error | **sub-mm static; ~mm dynamic** | **~10–12 mm** | cm-class, distance-dependent | **~5 mm** | n/a |
| **End-to-end latency** | **85–105 ms pose age (measured)** | **~4 ms driver / ~20 ms worst-case pose / 120 Hz** | **~30–50 ms** | **~60–70 ms depth** | ~30–60 ms | n/a |
| **Lighting robustness** | Poor (RGB, motion blur) | Excellent (IR laser) | Excellent (IR ToF) | Excellent (active stereo IR) | Moderate | Immune (no position) |
| **Tracking-loss resilience** | **Poor — Derrick's #1 pain** | Excellent | Good | Good | Moderate | n/a |

## 6. The tradeoff matrix

| Criterion | **Webcam (today)** | **Lighthouse + trackers** | **Kinect v2** | **RealSense** | **VIVE Ultimate** | **IMU-only** |
|---|---|---|---|---|---|---|
| 3D accuracy | ✗ 2D only | ★★★ sub-mm | ★★ cm | ★★ cm | ★★ ~5mm | ✗ |
| End-to-end latency | ✗ 85–105ms | ★★★ ~4–20ms | ★★ 30–50ms | ★★ ~60ms | ★★ ~30–60ms | ✗ |
| Lighting robustness | ✗ | ★★★ | ★★★ | ★★★ | ★★ | n/a |
| **Tracking-loss resilience (#1 pain)** | ✗ | ★★★ | ★★ | ★★ | ★★ | n/a |
| Accessory cost | $0 | **~$756** | **~$40–180** + adapter | **~$300–400** | **~$458+** | ~$30–100 |
| Setup friction | **Drop-in** | Stations + tripods + SteamVR + helper | One USB plug + adapter | One USB plug | Wrists + dongle + calibration | Wrist strap |
| Portability | **★★★ best** | ★ worst | ★★ | ★★ | ★★ | ★★ |
| **Browser-integration effort** | none | **Small bridge** | **Small-medium bridge** | **Small bridge** | Small bridge | none (no position) |
| Fit with AeroBeat identity | **★★★ core** | ★★ accessory mode | ★★★ **best middle ground** | ★★★ **best middle ground** | ★★ accessory mode | ✗ out of scope |

## 7. Recommendation (opinionated)

**The honest answer is a two-product strategy, and the prototype to build next is a depth camera, not lighthouse.**

**Tier 0 — fix the webcam product first (separate bead, do this regardless of hardware):** the mid-song tracking loss → repeated T-pose re-entry is a **webcam-product defect, not a hardware gap**. A grace + auto-recovery lane (bounded tracking-loss window, auto-reacquire without full recalibration, pose-prediction bridge during the gap — the repo already has bounded prediction via `AeroPoseRoutingSample`) is the highest-leverage single change and benefits *every* input option. (This is exactly the `tm4m` diagnosis's recommendations A+B+C+D.)

**Tier 1 — PROTOTYPE NEXT: Depth camera (Kinect v2 for cost, RealSense D455 for longevity) as an optional "precision input" backend.**
- Attacks **#2 (depth) and #3 (latency) directly** and mostly fixes **#1**, with true 3D — the actual gap named.
- **Lowest cost** of the 3D options and **best portability** (one USB plug, no stations, no headset) — preserves the drop-in identity.
- **Small-to-medium bridge**, and the **entire gameplay/scoring/input-routing stack is reused** behind the existing `AeroPoseAdapter` injection point.
- Kinect first for the experiment (cheaper, mature joints path); RealSense as the "ship it" candidate (still in production post-spinout).
- **The one contract change required:** additive `z`/depth field (or parallel `NormalizedPose3DFrame`) in `pose-shapes.js` + the body-grid projection swap from camera-projection to direct-3D for depth/VR backends. Small but non-trivial — budget it explicitly.

**Tier 2 — SteamVR lighthouse, as the "hyper-accurate" accessory mode, only after Tier 1 proves the depth contract.**
- Objectively the best tracking (sub-mm, ~4–20 ms); the data path is a **well-trodden open-source small bridge**.
- Most expensive (~$756) and least portable — Derrick's own called-out tradeoff. Valve ended Index manufacturing; base stations OOS (HTC's $229 clone is the real supply) — **supply-chain risk** for a player-recommended product.
- Consumes the *same* depth contract + bridge pattern as Tier 1, so Tier 2 becomes "another adapter + the same helper shape." Right "max accuracy" tier to add later, not to prototype first.

**Explicitly out of scope (the "it's just VR then" boundary):** Quest 3 / PSVR2 controllers alone (infeasible); Quest 3 on-head + PC game (full VR, different product); IMU-only (no absolute position).

**Net recommendation:**
1. **Bead A (separate, high-leverage):** webcam mid-song tracking-loss grace + auto-recovery (the `tm4m` recs A+B+C+D). Do regardless.
2. **Bead B (the prototype):** depth-camera precision-input backend — Kinect v2 for the experiment, RealSense D455 as the ship candidate — reusing the whole gameplay/scoring stack behind `AeroPoseAdapter`, with the additive 3D pose contract as the enabling change. **Prototype this next.**
3. **Bead C (later, if B is a hit):** SteamVR lighthouse adapter reusing B's contract + bridge — the optional "hyper-accurate, full-setup" accessory tier.

**The two-product framing, stated plainly:** AeroBeat stays **webcam-only as the drop-in product**. A depth camera (and later, lighthouse) becomes an **optional "precision input" accessory mode** reusing the whole gameplay/scoring/input stack behind the common pose-input interface — the accessory is a *better input to the same game*, not a second game. That is the honest architecture, and exactly what the existing `AeroPoseAdapter` injection point was designed for.

## 8. Owner additions + positioning (Derrick, 2026-09-11)

Derrick's own research added two candidates and set the product positioning:

- **SlimeVR trackers** (https://slimevr.dev/) — IMU-based, drifts, needs a reset gesture; "similar to webcams needing to T-Pose between songs" ⇒ the drift is a **UX-accepted** tradeoff for a sub-$500 tracker option. → §4.1.
- **Orbbec cameras**, e.g. the **Orbbec Persee 2** (https://store.orbbec.com/products/persee-2) — depth-camera tracking **with built-in compute**; "Orbbec also has other cameras available as well we could explore, the option I linked to has its own compute." → §3.4.
- **Lighthouse** remains "a well-worn path"; **RealSense** remains "also an option."
- **Positioning (verbatim framing):** both sub-$500 solutions are "**fine for an arcade setup but not for a casual player**." The two-product split sharpens: **webcam = drop-in casual core (no purchase, no setup)**; **accessory tiers = recommended arcade deployments** — Orbbec Persee 2 class (onboard-compute depth, strongest ship candidate), RealSense/Kinect v2 (USB depth), SlimeVR (cheap IMU trackers with the familiar reset gesture), and lighthouse (hyper-accuracy) — all feeding the **same** `AeroPoseAdapter` + additive 3D pose contract.
- **Price flag:** the Persee 2 street price found in research is ~€690/$700 (DE, incl. VAT) — verify the US store price before quoting Derrick's sub-$500 figure as confirmed.

## Source index (primary)
- Valve Index EOL: [The Verge](https://www.theverge.com/news/817967/valve-index-vr-headset-stopped-manufacturing-frame), [heise](https://www.heise.de/en/news/Valve-confirms-No-new-Half-Life-Alyx-and-end-of-the-Valve-Index-VR-headset-11077163.html)
- Base stations: [Steam](https://store.steampowered.com/app/1059570/Valve_Index_Base_Station/), [VIVE Store](https://shop-us.vive.com/products/2104005)
- VIVE Tracker 3.0: [VIVE Store](https://shop-us.vive.com/products/vive-tracker-3-0-full-body-tracking), [Micro Center](https://www.microcenter.com/product/657156/htc-vive-tracker-30)
- Lighthouse precision: [Sensors 2023](https://doi.org/10.3390/s23020725), [Sensors 2021](https://doi.org/10.3390/s21051622); latency: [Kreylos](https://www.gamedeveloper.com/design/an-expert-look-inside-the-htc-vive-s-positional-tracking-system), [mocap-fusion wiki](https://mocap-fusion-wiki.notion.site/SteamVR-How-Lighthouse-Base-Station-Tracking-Works-16fc956d336a80218983d21ec0583b71)
- SteamVR→Web bridges: [v0xie driver](https://github.com/v0xie/OpenVR-Tracker-Websocket-Driver), [OpenVR2WS](https://github.com/BOLL7708/OpenVR2WS), [tundra-stylus](https://github.com/kr15h/tundra-stylus), [Lighthouse Stylus ACM TEI '26](https://dl.acm.org/doi/10.1145/3731459.3779348), [openvr_ros_bridge](https://github.com/personalrobotics/openvr_ros_bridge), [WebXR tracker-roles #47](https://github.com/immersive-web/webxr-input-profiles/issues/47)
- Headset-less SteamVR: [SteamVRNoHeadset](https://github.com/username223/SteamVRNoHeadset), [openvr #1403](https://github.com/ValveSoftware/openvr/issues/1403)
- Quest: [Meta help](https://www.meta.com/), [GReverse](https://greverse.com/metaverse-vr/touch-plus-ai-tracking-quest/), [Road to VR](https://roadtovr.com/); PSVR2: [ir-lights-enable](https://github.com/odin30814-cmyk/psvr2-controller-ir-lights-enable), [PSVR2_Outside-In](https://github.com/Kinetic1717/PSVR2_Outside-In_Tracking)
- VIVE Ultimate: [arXiv 2409.01947](https://arxiv.org/html/2409.01947), [VIVE Store](https://www.vive.com/us/store/)
- Kinect v2: [libfreenect2](https://github.com/openkinect/libfreenect2), [#706](https://github.com/OpenKinect/libfreenect2/issues/706), [#721](https://github.com/OpenKinect/libfreenect2/issues/721), [MDPI 2021](https://doi.org/10.3390/app11125756), [PLOS ONE](https://doi.org/10.1371/journal.pone.0166532), [Rodriguez 2015](https://www.ais.uni-bonn.de/~rodriguez/publications/2015_kinect2.pdf), [BigGo](https://biggo.com/s/Kinect%20V2)
- RealSense: [Reuters](https://www.reuters.com/business/realsense-spins-out-intel-secures-50-million-drive-ai-vision-robotics-2025-07-11/), [TechCrunch](https://techcrunch.com/2025/07/11/realsense-spins-out-of-intel-to-scale-its-stereoscopic-imaging-technology/), [datasheet](https://realsenseai.com/wp-content/uploads/dlm_uploads/2025/08/Intel-RealSense-D400-Series-Datasheet-August-2025.pdf), [latency #1242](https://github.com/IntelRealSense/librealsense/issues/1242)
- IMU drift: [QUB](https://pureadmin.qub.ac.uk/ws/portalfiles/portal/538642477/sensors_23_00360.pdf), [TechRxiv](https://doi.org/10.36227/techrxiv.175492124.47988269/v1)
- Orbbec Persee 2: [ORBBEC product page](https://www.orbbec.com/products/camera-computer/persee-2/), [datasheet PDF](https://d1cd332k3pgc17.cloudfront.net/wp-content/uploads/2024/01/ORBBEC_Datasheet_Persee-2.pdf), [store listing](https://store.orbbec.com/products/persee-2), [MyBotshop price](https://www.mybotshop.de/ORBBEC-Persee-2_3)
- SlimeVR: [slimevr.dev](https://slimevr.dev/), [Crowd Supply — Butterfly trackers](https://www.crowdsupply.com/slimevr/slimevr-butterfly-trackers), [Crowd Supply — Full-Body Tracker](https://www.crowdsupply.com/slimevr/slimevr-full-body-tracker)
- Webcam baseline (repo): `aerobeat-web-cv/docs/telemetry/browser-pose-runtime-research-2026-08-27.md`
