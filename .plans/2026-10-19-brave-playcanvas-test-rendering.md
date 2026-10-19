# Restore Brave Test rendering after public 0.0.136

**Status:** Derrick supplied affected Cookie Brave renderer error **`WebGL not supported`**. Previous versions rendered there, but Brave was reinstalled this morning after an upgrade warning; old0.0.135 was **not** retested in the new Brave installation. PlayCanvas 2.21.4 throws that exact error specifically when `canvas.getContext("webgl2", options)` returns null. A local Brave launch with **WebGL1 available but WebGL2 disabled** reproduces Cookie's exact renderer error and generic Info text. Derrick says Brave reports WebGL enabled; that does not establish WebGL2 availability. Cookie WebGL2 feature status and the precise browser/driver trigger remain unverified. Next, Derrick checks Brave Settings → System → graphics acceleration and relaunches if toggled; if already on, inspect Brave graphics diagnostics before guessing or changing source. Investigating Derrick's direct Cookie/Brave 1.92.143 report. Public 0.0.136 stays live and routes untouched. Bead `aerobeat-web-assembly-nwc6` claimed. Installed Brave **150.1.92.143** on this host loads public signed 0.0.136 with PlayCanvas ready and WebGL2 available; the same browser with WebGL explicitly disabled reproduces Derrick's exact Info text and the renderer records `WebGL not supported`. These are two local controls, **not** proof Cookie's graphics policy or cause. Read-only Playwright interception of immutable signed 0.0.135 on the same origin (no replacement server/public change) also starts in normal local Brave (`state: running`) and reports `playcanvas_unavailable` / `WebGL not supported` when WebGL is disabled. Rollback would **not** fix an identical browser graphics denial. Late human reply supplied Cookie's actual renderer error and historical successful rendering before the Brave reinstall; no same-install old/new comparison exists. Prior signed 0.0.135 remains the rollback. Do not change public service without Derrick's explicit approval.

**Goal:** Explain and correct the real public game showing “PlayCanvas rendering is unavailable; try a current browser.” and failing to render Test in Brave 1.92.143. Preserve the 0.0.136 Test timing/defaults/scored cylinder behavior.

**Next affected-device check:** Cookie says WebGL is enabled; Derrick opens Brave's internal GPU diagnostics page (address bar: brave colon slash slash gpu) and reports the **Graphics Feature Status** lines for WebGL and **WebGL2**. If WebGL2 is disabled/unavailable, investigate Brave graphics acceleration, GPU blocklist/driver status before changing game code. If WebGL2 is hardware/software accelerated there, check `document.createElement('canvas').getContext('webgl2')` on the failing site and any GPU error log before assuming a product regression. If Cookie inspection itself is needed, ask separate authorization for remote desktop/host access. Do not infer affected hardware behavior from local headless Brave.

**Milestones:**
1. PARTLY DIAGNOSED; awaiting affected-device correction: Cookie's renderer says `WebGL not supported`. Local Brave reproduces exactly when WebGL is denied, and signed 0.0.135/0.0.136 behave the same locally. Check Cookie browser graphics acceleration and WebGL status before any production code edit. The old-version success was before Brave's reinstall, not same-install proof.
2. PENDING: If an in-scope product defect is demonstrated, make the smallest owner-source correction and focused regression. If browser graphics is disabled outside app control, explain a safe user setting/workaround without pretending an app code change fixes it.
3. PENDING: Run relevant owner checks and genuine Brave direct Test visual check, ideally same affected Cookie environment. If source change needed, build a private signed successor and verify before requesting a separate public switch. Review docs, commit/push durable coherent changes and close Bead only after accepted outcome.

**Boundaries:** The report is not approval to roll back or republish. No public service, Serve/Funnel, browser profile, Cookie system settings, security controls or captured personal data changes without separate Derrick authorization. Existing independent Chromium QA proved signed bytes and direct/iframe gameplay but did not check installed Brave on Cookie. Source-only or headless capability flags cannot establish physical device graphics health.

**Documentation:** Update assembly and renderer README only if their behavior or user remedy changes; keep this plan and Bead accurate. Existing 0.0.136 publication history stays in the previous plan.

## Debugging report — diagnosis incomplete pending affected Cookie evidence

### Exact observed failure

Derrick reports the public signed 0.0.136 page in Cookie's Brave 1.92.143 says “PlayCanvas rendering is unavailable; try a current browser.” and Test does not render. Derrick supplied Cookie renderer error `WebGL not supported`. Browser GPU/WebGL feature status and the previous 0.0.135 build in the **newly reinstalled Brave** remain unobserved; historical older builds rendered before that reinstall. On this host installed Brave reports `Brave Browser 150.1.92.143`; a fresh public tab starts the renderer (`state: running`, `playcanvas: true`, `webgl2: true`, no app error). A fresh Brave tab deliberately launched with WebGL/GPU disabled instead shows the exact Info message, `capabilities().limitations = ["playcanvas_unavailable"]`, renderer state `error`, renderer error `WebGL not supported`.

### Expected behavior

The connected public game should create a PlayCanvas graphics device and render Test on a browser with functioning WebGL. If the browser cannot create a device, the product should not misidentify an unsupported graphics configuration as an outdated browser. No Test visual acceptance is possible while renderer `app` is null.

### Execution path

Public signed HTTPS shell loads `<aero-game>` → `connectedCallback()` creates the service graph → `attachStableSurfaces()` calls `graph.renderer.attach(canvas)` and `clear()` → renderer `attach()` constructs `new pc.Application(canvas,{graphicsDeviceOptions:{...options,alpha:true}})` in a `try` and catches failures with `fail(error)` → `getCapabilities().playcanvas` tests `Boolean(this.app)` → assembly `capabilities()` adds `playcanvas_unavailable` when false → `actionableRuntimeMessage()` selects the exact generic Info text. Test can't render without the graphics device. The 0.0.135→0.0.136 renderer diff changes Boxer cylinder visual geometry but not `attach()`'s PlayCanvas startup path. A read-only Playwright request intercept serves exact immutable 0.0.135 files to a fresh local Brave profile without a second server or public route change: old release works with WebGL enabled and reports the same `WebGL not supported` error/Info limitation with WebGL disabled. Browser-side GPU/device/configuration can still differ on Cookie.

### Root cause of renderer failure; browser trigger remains unverified

Cookie's renderer explicitly reports `WebGL not supported`. The pinned PlayCanvas `WebglGraphicsDevice` source throws that exact string only when `options.gl ?? canvas.getContext("webgl2", options)` is falsy; the game passes no `options.gl`. The required **WebGL2** context cannot be created in Cookie's browser session even if the setting reports WebGL enabled. Local forced-WebGL2-denial (with WebGL1 still available) reproduces the exact app message and renderer error; normal installed same-version Brave works. Derrick reinstalled Brave this morning after an update warning, and older builds worked before that change; a changed browser graphics setting is the leading trigger, not yet confirmed. This does **not** identify whether Cookie has graphics acceleration off, a disabled WebGL feature, GPU process failure, site policy, unsupported virtual display, or a different device problem. `Boolean(this.app)` collapses these causes into one generic message.

### Alternative hypotheses (ranked)

1. Browser-level acceleration/WebGL disabled or unavailable after Brave reinstall: leading hypothesis, supported by actual Cookie `WebGL not supported` and same-version local forced-denial repro; exact browser flag/status still unknown.
2. Brave profile/site policy, remote X11/GPU configuration or failed graphics process denies context: possible, requires Cookie graphics diagnostics if acceleration is on.
3. A 0.0.136-specific PlayCanvas startup regression: lower likelihood because renderer `attach()` is unchanged and both signed builds have identical success/failure under local Brave WebGL controls; no same-new-install Cookie 0.0.135 comparison.
4. Stale cache/network/unsigned asset failure: unlikely as loaded UI reaches native renderer with explicit `WebGL not supported`; only investigate if browser graphics appears healthy.

### Why previous fixes did not prevent this

Prior 0.0.136 changed Test MISS timing, control defaults and Boxer scored/render shape. Its release smoke only checked a connected Chromium page/version and browser fixture rendering on this host; it never verified Cookie's Brave GPU/graphics configuration. No WebGL-startup fix was attempted. Replacing signed bytes or rolling back without confirming old-version behavior could leave Cookie unable to render just the same.

### Unknowns and minimal reproduction

Cookie renderer error is confirmed `WebGL not supported`. Known: Cookie renderer fails specifically at PlayCanvas's WebGL2 context creation. Derrick says WebGL is enabled, but has not yet reported the WebGL2 feature status. Unknown: Cookie WebGL2 availability, browser graphics acceleration/feature flags, actual GPU process/configuration, and whether signed 0.0.135 would render under this morning's **new Brave install**. Earlier versions rendered before the reinstall, which is not a same-condition control. Minimum known repro here: launch installed Brave with WebGL explicitly disabled, visit public HTTPS root, connect game and read Info. Normal installed Brave with WebGL enabled does not repro. Derrick's independent repro: click public link on Cookie in current Brave profile, start Test and observe blank world and Info text.

### Proposed distinguishing verification and recommended remedy

Because Cookie actually reports `WebGL not supported`, first check Brave Settings → System graphics acceleration. If off, enable and fully relaunch; verify public Test world and renderer capability. If already on, inspect Brave's graphics diagnostics for WebGL/WebGL2 availability before considering Shields, a blocked GPU process, or driver/device configuration. A same-new-install 0.0.135 comparison may be useful only if WebGL appears healthy; do not roll back the public service just to test it. A source tweak to the generic Info text could help explain unavailable WebGL but cannot restore a missing graphics device. No code changes or public switch until the actual trigger is determined.

```text
Problem: Public0.0.136 Brave Test not rendering on Cookie.
Observed symptom: Generic PlayCanvas-unavailable Info; normal same-version local Brave works, deliberate WebGL-disabled local Brave reproduces exact text.
Root cause: Cookie PlayCanvas `canvas.getContext("webgl2", options)` returns null (`WebGL not supported`); WebGL1 enabled does not satisfy this requirement. Browser/system trigger unconfirmed after Brave reinstall.
Evidence: assembly capabilities/actionableRuntimeMessage; renderer attach/fail; installed Brave controls; old signed0.0.135 intercept runs in normal local Brave and fails identically when WebGL is disabled; unchanged owner attach between signed versions.
Failed approaches: Previous release smoke did not exercise Cookie Brave; no repair attempted.
Corrective action: Have Derrick inspect Cookie Brave graphics acceleration; if disabled, enable and relaunch; if enabled, inspect Brave WebGL feature status before choosing a remedy.
Verification test: Genuine Test renders in affected Brave with PlayCanvas ready and visible world, plus scoped source/signed checks if code changes.
Related files/components: assembly src/index.js, renderer src/renderer-facade.js, PlayCanvas graphics-device init, Brave GPU/WebGL settings.
Remaining uncertainty: Cookie Brave graphics acceleration/WebGL feature status, old-version behavior after this morning's reinstall, and whether enabling graphics restores visible Test.
```
