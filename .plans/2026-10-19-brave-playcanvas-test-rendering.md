# Restore Brave Test rendering after public 0.0.136

**Status:** Awaiting one diagnostic from the affected Cookie browser; no further safe code or service action is justified by local evidence alone. Three consecutive autonomous goal rounds had no Cookie renderer error or prior-version confirmation. Investigating Derrick's direct Cookie/Brave 1.92.143 report. Public 0.0.136 stays live and routes untouched. Bead `aerobeat-web-assembly-nwc6` claimed. Installed Brave **150.1.92.143** on this host loads public signed 0.0.136 with PlayCanvas ready and WebGL2 available; the same browser with WebGL explicitly disabled reproduces Derrick's exact Info text and the renderer records `WebGL not supported`. These are two local controls, **not** proof Cookie's graphics policy or cause. Read-only Playwright interception of immutable signed 0.0.135 on the same origin (no replacement server/public change) also starts in normal local Brave (`state: running`) and reports `playcanvas_unavailable` / `WebGL not supported` when WebGL is disabled. Rollback would **not** fix an identical browser graphics denial. Requested Cookie's actual renderer error and whether signed 0.0.135 previously rendered on that same browser; question timed out pending a later human reply. Prior signed 0.0.135 remains the rollback. Do not change public service without Derrick's explicit approval.

**Goal:** Explain and correct the real public game showing “PlayCanvas rendering is unavailable; try a current browser.” and failing to render Test in Brave 1.92.143. Preserve the 0.0.136 Test timing/defaults/scored cylinder behavior.

**Next product check on Derrick reply:** Obtain the one-line `document.querySelector('aero-game')?.graph?.renderer?.describe()?.errorMessage` from the failing Cookie tab and whether 0.0.135 rendered Test in the same Cookie Brave profile. If `WebGL not supported`, check Cookie's Brave Settings → System graphics acceleration and actual WebGL availability before any source change; if it reports another exception, reproduce that owner path. If Cookie inspection itself is needed, ask separate authorization for remote desktop/host access. Do not infer affected hardware behavior from local headless Brave.

**Milestones:**
1. BLOCKED on affected Cookie evidence: Local Brave reproduces exact message only when WebGL is denied; signed 0.0.135 and 0.0.136 behave the same under that local condition. The report below traces path and hypotheses but cannot establish Cookie root cause without its renderer error or native browser WebGL status. No production code edit until root cause is distinguished.
2. PENDING: If an in-scope product defect is demonstrated, make the smallest owner-source correction and focused regression. If browser graphics is disabled outside app control, explain a safe user setting/workaround without pretending an app code change fixes it.
3. PENDING: Run relevant owner checks and genuine Brave direct Test visual check, ideally same affected Cookie environment. If source change needed, build a private signed successor and verify before requesting a separate public switch. Review docs, commit/push durable coherent changes and close Bead only after accepted outcome.

**Boundaries:** The report is not approval to roll back or republish. No public service, Serve/Funnel, browser profile, Cookie system settings, security controls or captured personal data changes without separate Derrick authorization. Existing independent Chromium QA proved signed bytes and direct/iframe gameplay but did not check installed Brave on Cookie. Source-only or headless capability flags cannot establish physical device graphics health.

**Documentation:** Update assembly and renderer README only if their behavior or user remedy changes; keep this plan and Bead accurate. Existing 0.0.136 publication history stays in the previous plan.

## Debugging report — diagnosis incomplete pending affected Cookie evidence

### Exact observed failure

Derrick reports the public signed 0.0.136 page in Cookie's Brave 1.92.143 says “PlayCanvas rendering is unavailable; try a current browser.” and Test does not render. We have **not** observed Cookie's runtime error code, graphics-device status or previous 0.0.135 behavior. On this host installed Brave reports `Brave Browser 150.1.92.143`; a fresh public tab starts the renderer (`state: running`, `playcanvas: true`, `webgl2: true`, no app error). A fresh Brave tab deliberately launched with WebGL/GPU disabled instead shows the exact Info message, `capabilities().limitations = ["playcanvas_unavailable"]`, renderer state `error`, renderer error `WebGL not supported`.

### Expected behavior

The connected public game should create a PlayCanvas graphics device and render Test on a browser with functioning WebGL. If the browser cannot create a device, the product should not misidentify an unsupported graphics configuration as an outdated browser. No Test visual acceptance is possible while renderer `app` is null.

### Execution path

Public signed HTTPS shell loads `<aero-game>` → `connectedCallback()` creates the service graph → `attachStableSurfaces()` calls `graph.renderer.attach(canvas)` and `clear()` → renderer `attach()` constructs `new pc.Application(canvas,{graphicsDeviceOptions:{...options,alpha:true}})` in a `try` and catches failures with `fail(error)` → `getCapabilities().playcanvas` tests `Boolean(this.app)` → assembly `capabilities()` adds `playcanvas_unavailable` when false → `actionableRuntimeMessage()` selects the exact generic Info text. Test can't render without the graphics device. The 0.0.135→0.0.136 renderer diff changes Boxer cylinder visual geometry but not `attach()`'s PlayCanvas startup path. A read-only Playwright request intercept serves exact immutable 0.0.135 files to a fresh local Brave profile without a second server or public route change: old release works with WebGL enabled and reports the same `WebGL not supported` error/Info limitation with WebGL disabled. Browser-side GPU/device/configuration can still differ on Cookie.

### Most likely root cause (hypothesis, not yet confirmed on Cookie)

A WebGL graphics device is unavailable in Cookie's Brave session (disabled, blocked, or failed). Local forced-WebGL-denial uniquely reproduces the exact app message and renderer error; local normal Brave works. This does **not** identify whether Cookie's cause is Brave site settings/Shields, system graphics acceleration, GPU process failure, unsupported virtual display, a lost context, or an unexpected app/device startup exception. `Boolean(this.app)` collapses these causes into one generic message.

### Alternative hypotheses (ranked)

1. Cookie WebGL disabled/unavailable despite browser version matching ours: supported by exact local forced-denial repro, but Cookie's error remains unknown.
2. Brave profile/site Shields or remote X11/GPU configuration denies a graphics context: possible; needs actual Cookie graphics/error evidence.
3. A 0.0.136 PlayCanvas startup regression: lower likelihood because renderer `attach()` is unchanged and public 0.0.136 starts in installed same-version Brave here; cannot exclude Cookie-specific GL option/device interaction without Cookie error or 0.0.135 comparison.
4. Stale cache/network/unsigned asset failure: lower likelihood because UI loads and reports a specific native renderer capability; inspect Cookie's actual network/console only if error points there.

### Why previous fixes did not prevent this

Prior 0.0.136 changed Test MISS timing, control defaults and Boxer scored/render shape. Its release smoke only checked a connected Chromium page/version and browser fixture rendering on this host; it never verified Cookie's Brave GPU/graphics configuration. No WebGL-startup fix was attempted. Replacing signed bytes or rolling back without confirming old-version behavior could leave Cookie unable to render just the same.

### Unknowns and minimal reproduction

Unknown: actual `graph.renderer.describe().errorMessage` in Derrick's failing Cookie tab; whether signed 0.0.135 rendered there in that browser/profile; Cookie browser graphics acceleration/WebGL status and whether Shields or GPU process differ. Requested the error text and previous-version fact from Derrick; no answer yet. Minimum known repro here: launch installed Brave with WebGL explicitly disabled, visit the public HTTPS root, connect game and read Info. Normal installed Brave with WebGL enabled does not repro here. Derrick's independent minimal repro: click public link on Cookie in his current Brave profile, start Test and observe blank rendering with Info text.

### Proposed distinguishing verification and recommended remedy

Read Cookie's actual renderer error first (and ideally whether native `canvas.getContext('webgl2')` is available), compare a same-session old signed snapshot **without changing the public route**, and check Brave graphics acceleration/WebGL diagnostics. If it says `WebGL not supported` in both builds, restore device/browser WebGL as a user-controlled setting or provide an honest on-screen graphics-disabled instruction; don't ship a source change that cannot create missing WebGL. If 0.0.135 works and 0.0.136 fails on the same Cookie graphics session, capture the failing PlayCanvas exception, isolate the changed startup dependency or option, make the smallest owner-source correction and verify real Brave Test before signing a private successor. No code changes or public switch until the cause is distinguished.

```text
Problem: Public0.0.136 Brave Test not rendering on Cookie.
Observed symptom: Generic PlayCanvas-unavailable Info; normal same-version local Brave works, deliberate WebGL-disabled local Brave reproduces exact text.
Root cause: Cookie-specific underlying cause not yet known; renderer app absence is established proximate cause of generic message.
Evidence: assembly capabilities/actionableRuntimeMessage; renderer attach/fail; installed Brave controls; old signed0.0.135 intercept runs in normal local Brave and fails identically when WebGL is disabled; unchanged owner attach between signed versions.
Failed approaches: Previous release smoke did not exercise Cookie Brave; no repair attempted.
Corrective action: Await actual Cookie renderer error; choose browser graphics remedy or minimal owner-source fix based on evidence.
Verification test: Genuine Test renders in affected Brave with PlayCanvas ready and visible world, plus scoped source/signed checks if code changes.
Related files/components: assembly src/index.js, renderer src/renderer-facade.js, PlayCanvas graphics-device init, Brave GPU/WebGL settings.
Remaining uncertainty: Cookie error, old-version same-profile behavior, Cookie WebGL status.
```
