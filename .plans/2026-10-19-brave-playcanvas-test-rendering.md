# Restore Brave Test rendering after public 0.0.136

**Status — Cookie NVIDIA driver mismatch diagnosed, no host change made.** After Derrick explicitly asked for SSH report retrieval, the copied Brave GPU report (SHA-256 `42f885c32b77a2cb51ebaacf82857c236f57a832287ffb18b7e5767be5add846`) shows WebGL unavailable, active **llvmpipe software GL**, and WebGL1/WebGL2 blocklisted. Read-only SSH checks confirm Cookie's RTX 3080 is bound to NVIDIA but `nvidia-smi` fails with driver/library mismatch. Cookie's boot kernel log identifies the exact split: loaded NVIDIA kernel module **580.173.02** versus userspace Brave/NVML **580.178.04**. The installed NVIDIA module on disk is 580.178.04; a reboot is the minimal likely remedy to load it, subject to Derrick saving work and initiating or expressly approving the reboot. Verify `nvidia-smi`, Brave GPU WebGL2 status and real public Test **after** reboot; if mismatch persists, diagnose install/kernel boot path before any privileged driver repair. Public signed 0.0.136 and routing are unchanged; signed 0.0.135 remains rollback. Bead `aerobeat-web-assembly-nwc6` remains open until actual Cookie Test rendering passes.

**Goal:** Explain and correct the real public game showing “PlayCanvas rendering is unavailable; try a current browser.” and failing to render Test in Brave 1.92.143. Preserve the 0.0.136 Test timing/defaults/scored cylinder behavior.

**Next affected-device check:** Derrick saves his Cookie work and reboots the machine himself when convenient (or explicitly approves an agent-initiated reboot). After the reboot, read-only `nvidia-smi` must report a working NVIDIA driver with no mismatch; reopen Brave and check WebGL2 availability, then render actual public 0.0.136 Test. If GPU still reports llvmpipe or `nvidia-smi` fails, stop and diagnose the remaining driver/kernel mismatch; do not force-enable Chrome blocklisted GPU flags or change game source to mask the OS failure. Earlier inability to find Cookie through local file tools or Tailscale was **not** lack of access: the configured `ssh cookie` alias worked when Derrick requested it.

**Milestones:**
1. COMPLETED DIAGNOSIS: Cookie Brave error `WebGL not supported` results from a WebGL2 context request returning null; Brave GPU report shows software llvmpipe and blocklisted WebGL, and kernel logs confirm NVIDIA module 580.173.02 versus userspace 580.178.04.
2. AWAITING DERRICK'S SAFE REBOOT: Load the already-installed matching NVIDIA module and test `nvidia-smi`; if still mismatched, investigate driver/kernel packaging rather than changing browser flags or game source.
3. PENDING AFFECTED BOUNDARY: Actual Cookie Brave public 0.0.136 Test renders after GPU recovery; update docs/Bead only after observing the outcome. If a distinct product defect remains then scope the smallest owner-source fix and request separate public-release approval before any switch.

**Boundaries:** The report is not approval to roll back or republish. No public service, Serve/Funnel, browser profile, Cookie system settings, security controls or captured personal data changes without separate Derrick authorization. Existing independent Chromium QA proved signed bytes and direct/iframe gameplay but did not check installed Brave on Cookie. Source-only or headless capability flags cannot establish physical device graphics health.

**Documentation:** Update assembly and renderer README only if their behavior or user remedy changes; keep this plan and Bead accurate. Existing 0.0.136 publication history stays in the previous plan.

## Debugging report — Cookie GPU root cause established; reboot outcome pending

### Exact observed failure

Derrick reports the public signed 0.0.136 page in Cookie's Brave 1.92.143 says “PlayCanvas rendering is unavailable; try a current browser.” and Test does not render. Derrick supplied Cookie renderer error `WebGL not supported`. Cookie's actual GPU report confirms WebGL unavailable and blocklisted; the previous 0.0.135 build under the **newly reinstalled Brave** remains untested, though old releases worked before the driver update. On this host installed Brave reports `Brave Browser 150.1.92.143`; a fresh public tab starts the renderer (`state: running`, `playcanvas: true`, `webgl2: true`, no app error). A fresh Brave tab deliberately launched with WebGL/GPU disabled instead shows the exact Info message, `capabilities().limitations = ["playcanvas_unavailable"]`, renderer state `error`, renderer error `WebGL not supported`.

### Expected behavior

The connected public game should create a PlayCanvas graphics device and render Test on a browser with functioning WebGL. If the browser cannot create a device, the product should not misidentify an unsupported graphics configuration as an outdated browser. No Test visual acceptance is possible while renderer `app` is null.

### Execution path

Public signed HTTPS shell loads `<aero-game>` → `connectedCallback()` creates the service graph → `attachStableSurfaces()` calls `graph.renderer.attach(canvas)` and `clear()` → renderer `attach()` constructs `new pc.Application(canvas,{graphicsDeviceOptions:{...options,alpha:true}})` in a `try` and catches failures with `fail(error)` → `getCapabilities().playcanvas` tests `Boolean(this.app)` → assembly `capabilities()` adds `playcanvas_unavailable` when false → `actionableRuntimeMessage()` selects the exact generic Info text. Test can't render without the graphics device. The 0.0.135→0.0.136 renderer diff changes Boxer cylinder visual geometry but not `attach()`'s PlayCanvas startup path. A read-only Playwright request intercept serves exact immutable 0.0.135 files to a fresh local Brave profile without a second server or public route change: old release works with WebGL enabled and reports the same `WebGL not supported` error/Info limitation with WebGL disabled. Browser-side GPU/device/configuration can still differ on Cookie.

### Root cause confirmed on Cookie

Cookie's renderer reports `WebGL not supported`. Pinned PlayCanvas throws this when `options.gl ?? canvas.getContext("webgl2", options)` is falsy; the game passes no `options.gl`. Cookie Brave's actual GPU report says `WebGL: Unavailable`, `GL_RENDERER: ANGLE (Mesa, llvmpipe ...)`, software-only Canvas/Compositing, and `WebGL has been disabled via blocklist or the command line`; its GPU log includes `WebGL2 blocklisted`. Crucially, read-only `nvidia-smi` fails with `Driver/library version mismatch`, and Cookie kernel boot messages state Brave/NVML userspace **580.178.04** but the *currently loaded* NVIDIA kernel module **580.173.02**. PCI still binds RTX3080 to NVIDIA; on-disk module `modinfo` is **580.178.04**. That mismatch prevents functioning NVIDIA GPU access and drives the software/blocked context. Brave reinstall happened the same morning but is not itself proven to cause the driver split. A safe reboot by Derrick is the minimal likely correction because it can load the already-installed matching kernel module; verify after reboot. `Boolean(this.app)` currently collapses missing device and browser/driver failures into a generic old-browser Info text.

### Alternative hypotheses (ranked)

1. Loaded kernel/userspace NVIDIA version mismatch: **observed** on Cookie in both `nvidia-smi` and kernel logs; top causal explanation for llvmpipe fallback and WebGL blocklist. Verify remedy only after Derrick-approved/scheduled reboot and `nvidia-smi` read-back.
2. Brave/ANGLE Wayland GPU blocklist or process flags independent of driver mismatch: possible **if** matching driver reload leaves WebGL unavailable; report's `--render-node-override` targets the actual NVIDIA DRM node and command line does not show an explicit `--disable-webgl` flag.
3. A 0.0.136-specific PlayCanvas startup regression: unlikely while OS WebGL2 is blocked; renderer `attach()` unchanged, both signed builds behave identically under local denial. Only revisit if Cookie WebGL2 is healthy and new version still fails.
4. Stale cache/network/unsigned asset failure: contradicted by loaded UI plus OS GPU logs; only revisit if device diagnostics recover but browser still fails.

### Why previous fixes did not prevent this

Prior 0.0.136 changed Test MISS timing, control defaults and Boxer scored/render shape. Its release smoke only checked a connected Chromium page/version and browser fixture rendering on this host; it never verified Cookie's Brave GPU/graphics configuration. No WebGL-startup fix was attempted. Replacing signed bytes or rolling back without confirming old-version behavior could leave Cookie unable to render just the same.

### Unknowns and minimal reproduction

Cookie renderer error is confirmed `WebGL not supported`. Known: Cookie browser report says WebGL unavailable, active Mesa llvmpipe and WebGL2 blocklisted; loaded NVIDIA kernel module version differs from userland. Unknown: whether a controlled reboot loads the installed 580.178.04 module and restores Brave WebGL2/Test, or whether another driver/kernel repair would be needed. Earlier versions rendered **before** the driver discrepancy; no same-condition old/new comparison. Minimum local repro: installed Brave with WebGL2 disabled returns Cookie's exact Info error even while WebGL1 remains available. Cookie's actual repro: public page in current Brave, Test blank, renderer error `WebGL not supported`, Brave GPU report software-only.

### Proposed distinguishing verification and recommended remedy

The actual Cookie GPU report and kernel logs distinguish the OS driver mismatch from a mere disabled WebGL setting. Ask Derrick to save active Cookie work, initiate a controlled reboot himself and report when back. Then run read-only `nvidia-smi` and refresh the Brave GPU report: require NVIDIA 580.178.04 available, WebGL2 not blocklisted/available, and visibly rendered public Test. If mismatch remains, stop before root-changing driver repair and seek explicit authorization for the exact corrective action. No game source change or rollback is indicated by the proven OS driver failure; the generic Info text could be clarified in a separately scoped future issue, not as a substitute for restoring WebGL2.

```text
Problem: Public0.0.136 Brave Test not rendering on Cookie.
Observed symptom: Generic PlayCanvas-unavailable Info; normal same-version local Brave works, deliberate WebGL-disabled local Brave reproduces exact text.
Root cause: Loaded NVIDIA kernel module580.173.02 conflicts with userland580.178.04; Cookie falls back to llvmpipe and Brave blocklists WebGL/WebGL2, so PlayCanvas WebGL2 context creation returns null.
Evidence: Cookie Brave GPU report SHA-256 42f885... (WebGL unavailable, llvmpipe, WebGL2 blocklisted); Cookie nvidia-smi NVML mismatch; kernel NVRM log explicit loaded580.173.02 vs client580.178.04; installed module580.178.04; assembly/renderer/PlayCanvas source and local signed-old/new Brave controls.
Failed approaches: Previous release smoke did not exercise Cookie Brave; no repair attempted.
Corrective action: Derrick saves work and reboots Cookie on his schedule to load installed NVIDIA module 580.178.04; verify nvidia-smi and WebGL2/actual Test afterward.
Verification test: Genuine Test renders in affected Brave with PlayCanvas ready and visible world, plus scoped source/signed checks if code changes.
Related files/components: assembly src/index.js, renderer src/renderer-facade.js, PlayCanvas graphics-device init, Brave GPU/WebGL settings.
Remaining uncertainty: Whether reboot loads matching installed driver and restores actual Cookie Brave Test; no game defect established while WebGL2 is blocklisted.
```
