# Cursor Restoration, Global Volume Mix, and Gated Theme Authoring

**Status:** Approved and in progress
**Owner:** assembly orchestrator → package coders → independent QA → package auditors → assembly integrator → release auditor → physical gate → local asset PoC
**Assembly epic:** `aerobeat-web-assembly-27n`
**Target release for Milestone 1:** corrected deterministic `0.0.32` (`0.0.31` retained byte-immutable as the physically failed historical candidate)
**Baseline:** assembly `a2d8831d8a5c493df3a4418e7ec64c4d2df024d6`, renderer `fb103de71a3cc2e3b90587616d7f37ca61f9c282`, audio `6a6be4350437359d41ecd3f45e5bead7d5294daa`, UI `3bf327f1b36fb4a9d41be2dc9bb8b61786a4edc1`

## Goal

First, repair the physically observed cursor-release defect and add one persistent global Music/Sound mix exposed through the Visual Test transport, then independently QA/audit and release deterministic `0.0.31`. Second, only after Derrick physically tests that release, build a local-only, uncommitted `.bloq`/`.plat` conversion proof in a new authoring repository and stop for review before any runtime Theme implementation. Third, after that review, add independent Blocks/Arena Theme selection through separately approved runtime slices. Preserve gameplay/scoring truth, all three presentations, privacy/lifecycle, PlayCanvas-only rendering, deterministic releases, and the existing server.

## Locked decisions

### Cursor

- Desktop right-click enters mouse-look capture.
- A second right-click or Escape exits.
- Capture exit is not complete until browser `pointerlockchange` confirms release.
- Cursor style is explicitly restored after confirmed release; fallback capture exits immediately.
- Pause, menu-open, hidden, blur, detach and destroy use the same cleanup path.
- Hardware cursor visibility remains a physical check after automated state/style proof.

### Volume

- One mix applies globally to Visual Test and scored Play.
- Music and future SFX both default to `0.5`, with strict `0..1` bounds.
- Values persist locally across reloads; storage contains only two scalar values and never crosses host/iframe telemetry.
- Sliders use continuous `0.01` input with magnetic snap within `0.04` of `0`, `0.5`, and `1`.
- The Test transport adds a bottom-right volume button beside the timecode. It opens a compact popover with Music left and Sound right, thin vertical tracks, displayed values, accessible 44px interaction surfaces, keyboard operation, outside-click/Escape/button-toggle closure.
- Music immediately drives a real gain bus. Sound drives/reserves an SFX gain bus even though no SFX source exists yet. The button opens/closes only; it does not mute.

### Theme and local asset proof

- Theme setup will eventually expose independent Blocks and Arena selectors.
- Selecting a theme may replace default role colors; a future explicit per-role user override sits above the selected theme.
- Current visual roles are left, right, guard, obstacle, receptor, and safe. Imported notes cover arrows/dots; AeroBeat must author missing guard/obstacle/receptor/safe assets.
- Third-party source bundles and derived binaries remain local and uncommitted regardless of size or Git LFS availability.
- Commit only conversion tooling, schemas, manifests without third-party bytes, deterministic validation, and owned synthetic fixtures.
- Curated offline pipeline only; no browser runtime Unity AssetBundle parser.
- Target close visual behavior: preserve hierarchy/pivots/textures/baked animation, then reauthor Unity/Beat Saber glow, materials, animation state, lights and event response in PlayCanvas.
- Begin blocks with DDR Arrows, then animated Osu Notes, then Bliss Redux (Light). Begin arenas with SimplePlat or Empty Room before SynthWave 2.
- Stop after the local PoC for Derrick's review. Do not begin runtime Theme implementation automatically.

## Repository map

### New in Milestone 2

- `aerobeat-web-theme-authoring`: local/offline inventory, extraction adapters, GLB normalization/validation, deterministic manifests and owned fixtures. No third-party binaries; no remote/public repository action without explicit approval at the PoC gate.

### Modified in Milestone 1

- `aerobeat-web-renderer`: cursor-release state machine and tests.
- `aerobeat-web-audio`: music/SFX gain buses and bounded mix API.
- `aerobeat-web-ui`: volume snapshot/intents, transport button/popover/sliders.
- `aerobeat-web-assembly`: local persistence, cross-package wiring, all-mode/direct/iframe/mobile tests, physical handoff, release.

### Modified only after the PoC review

- `aerobeat-web-contracts`: versioned Theme manifest and semantic asset slots.
- `aerobeat-web-renderer`: GLB theme loading/pooling/materials/behavior and fallbacks.
- `aerobeat-web-ui`: independent Blocks/Arena selectors.
- `aerobeat-web-style`: palette precedence and shared Theme tokens.
- `aerobeat-branding`: only owned guard/obstacle/receptor/safe and fallback art.

### Not expected to change

Gameplay, content, content-authoring, input, CV, video and vendor repos. Theme/audio/cursor work must not alter chart conversion, timing, scoring, pose, media acquisition or privacy.

## Cursor debugging report

### Exact observed failure

Derrick physically observed that after right-click enters camera rotation, a second right-click exits rotation but does not restore the mouse cursor.

Current renderer `exitDebugCapture(true)` sets `debugCaptureMode="none"` and then conditionally calls `document.exitPointerLock()`. Tests wait for `document.pointerLockElement===null` and prove rotation stops, but do not assert release-event ordering, computed cursor restoration or physical cursor visibility.

### Expected behavior

Second right-click or Escape must release browser pointer lock, restore the cursor, stop look deltas, update bounded capture telemetry to `none`, and allow a later right-click to capture again.

### Execution path

1. Canvas right-button `mousedown` sees capture active.
2. Renderer calls `exitDebugCapture(true)`.
3. Internal capture state becomes `none` immediately.
4. Renderer requests browser pointer-lock exit.
5. Browser asynchronously emits `pointerlockchange`.
6. Existing handler only performs cleanup when state is still `pointer`; because state was already set to `none`, confirmed-release cursor restoration has no explicit transition.

### Most likely root cause

AeroBeat treats the logical exit request as completed before the browser confirms OS-level pointer-lock release and never explicitly owns cursor restoration. This is a state-ordering/evidence gap, not proof that `exitPointerLock()` is never called.

### Alternatives and unknowns

- Browser/Wayland cursor restoration behavior may differ physically from headless Chromium.
- The page has no authored `cursor:none` rule, so stale CSS is not currently evidenced.
- Pointer-lock fallback never hides the OS cursor and should exit synchronously.
- Headless tests cannot truthfully see the hardware cursor; final confirmation is physical.

### Verification before correction

Add a focused real-browser probe that records right-click entry, release request, `pointerlockchange`, pointer-lock null, logical state `none`, restored computed cursor, no post-exit yaw/pitch change, and successful re-entry. Preserve a fallback-mode equivalent.

### Recommended correction

Keep a private release-pending flag/state. If locked, request exit and finalize capture/cursor restoration from `pointerlockchange`; if fallback/touch, finalize immediately. Preserve/restore the pre-capture canvas cursor rather than hard-coding a permanent style. Route every cleanup through one idempotent release function.

### QA-discovered late-acquisition correction

Parent sensitivity against coder commit `d75bb1e` reproduced one unsupported race in the first correction: if legacy `requestPointerLock()` returns `undefined`, fallback can exit synchronously before the browser later grants lock. `handleDebugPointerLockChange()` ignored a locked canvas when logical mode was already `none`, leaving `{exitCalls:0, mode:"none", releasePending:false, lockSurvives:true}`. P0 `aerobeat-web-renderer-d7t` requires stale/late canvas locks to be immediately released and sensitivity-proves the undefined-return path.

Independent audit then found a cross-instance error-isolation race at `e4cee4c`: because `pointerlockerror` is document-global, another instance's failed request could make the owning renderer finalize release or degrade to fallback even while `document.pointerLockElement` remained its canvas. P0 `aerobeat-web-renderer-4w1` requires ownership-aware error handling: held-lock pointer/release state stays truthful until `pointerlockchange`, while absent-lock own failures still finalize/degrade safely.

### Debug record

```text
Problem: Second right-click stops camera rotation but physical cursor remains absent.
Observed symptom: Capture appears exited; OS cursor is not restored.
Root cause: Leading diagnosis is logical state clearing before asynchronous pointer-lock confirmation, with no explicit cursor restoration invariant.
Evidence: exitDebugCapture clears mode before exitPointerLock; pointerlockchange cleanup is gated on mode pointer; tests omit cursor restoration.
Failed approaches: Prior tests proved pointerLockElement null and stopped rotation but not release ordering or visible cursor.
Corrective action: Confirmed-release state machine plus preserved cursor restoration.
Verification test: Real right-click enter/exit/Escape/fallback, pointerlockchange ordering, computed cursor, stopped look, re-entry; physical cursor retest.
Related files: aerobeat-web-renderer src/renderer-facade.js and browser validator; assembly physical-path matrix.
Remaining uncertainty: Hardware cursor behavior on Derrick's browser/Wayland path.
```

## Milestone 1A — Renderer cursor correction

**Implementation:** `aerobeat-web-renderer-5ue`
**QA:** `aerobeat-web-renderer-aiw`
**Audit:** `aerobeat-web-renderer-kmm`
**Status:** AUDITED PASS — production corrections through `bef3e5d`, QA `508d9c7`, audit/ledger closure `b50bcb5`; Beads `5ue`/`d7t`/`4w1`/`aiw`/`kmm` closed; hardware cursor Physical Pending

Coder diagnoses with the new sensitivity probe, implements one idempotent confirmed-release path, and preserves every existing camera/touch/movement/lifecycle contract. Independent QA and audit must reproduce release ordering and cursor-style sensitivity before assembly consumes the commit.

## Milestone 1B — Web Audio global mix

**Implementation:** `aerobeat-web-audio-nyz`
**QA:** `aerobeat-web-audio-m5v`
**Audit:** `aerobeat-web-audio-18w`
**Status:** AUDITED PASS — coder `c23957e`, QA `c176c35`, ledger/audit closure `aef0b0a`; Beads `nyz`/`m5v`/`18w` closed

Add service-owned Music and future-SFX GainNodes where supported. Music playback connects through Music gain instead of directly to destination. Expose strict bounded scalar mix set/read APIs with defaults `0.5/0.5`; setters accept only exact plain/null-prototype own enumerable data values and never invoke accessors. Public status/capabilities may expose gain support but not the user's values because assembly publishes audio status externally. Preserve injected-context ownership, source recreation, clock authority, lease/visibility semantics and teardown. Unsupported/fake contexts must degrade truthfully and remain testable.

## Milestone 1C — Volume transport UI

**Implementation:** `aerobeat-web-ui-af3`
**QA:** `aerobeat-web-ui-4lr`
**Audit:** `aerobeat-web-ui-8xx`
**Status:** AUDITED PASS — coder `3ac371f`, P0 correction/QA `2186523`, audit/ledger closure `0599172`; Beads `af3`/`osp`/`4lr`/`8xx` closed

Extend the strict Visual Test transport snapshot with only Music/Sound scalar values. Emit exact volume intents after UI-side normalization/snap. Own the popover's ephemeral open state without replacing focused sliders during snapshots. Verify layout/accessibility/direct keyboard/touch/reconnect at phone portrait/landscape and DPR without owning audio or persistence.

QA found one deterministic-normalization defect in `3ac371f`: binary division made exported `snapVisualTestVolume(0.285)` return `0.28` while another half-step `0.725` returned `0.73`. P0 `aerobeat-web-ui-osp` preserves QA sensitivities and requires stable half-up `0.01` normalization without changing magnetic anchors or UI behavior before QA resumes.

## Milestone 1D — Assembly integration, QA and release

**Integration:** `aerobeat-web-assembly-7l3`
**QA:** `aerobeat-web-assembly-9rh`
**Release:** `aerobeat-web-assembly-nl4`
**Final audit:** `aerobeat-web-assembly-es1`
**Status:** CORRECTED `0.0.32` CODER PASS / QA-AUDIT PENDING — exact `0.0.31` candidate `2c0968e` passed prior coder/QA/audit, but Derrick physically found the Music/Sound popover permanently painted while logically closed; UI P0 `aerobeat-web-ui-9bd` AUDITED PASS/closed at `fbf0bb8` (production correction `2abc98c`); assembly/release P0 `aerobeat-web-assembly-2fw` independent QA PASS; final audit restarted after worker failure — subagent `97a19668-f8be-4d7d-a8d0-796bc614c456` resolving exact-candidate pack hashes; Milestone 2 remains blocked

Assembly stores the exact plain-data `{musicVolume,sfxVolume}` pair under origin-local key `aerobeat.audio-mix.v1`, defaults safely to `0.5/0.5`, applies it to every fresh graph before playback through the audio service instance methods `getMixSnapshot()` / `setMix()`, persists UI changes, and keeps values private from snapshots/iframe events. A module-local coordinator owns same-document subscribers; the browser `storage` event synchronizes same-origin iframe/document realms. Storage denial/corruption fails closed to in-memory defaults without blocking playback; disconnect unsubscribes without retaining components. Test actual Music gain continuity across Test/Play, seek, pause, lease transfer, hidden/reconnect and multiple instances; Sound is bounded state only until SFX exists. Integrate audited cursor renderer and prove physical-path exit state/style across Flow/Lanes/Grid. Preserve the complete existing matrix.

Patch package/lock/index/proof to `0.0.31`, leave `0.0.30` byte-unchanged, build raw twice, pack twice, independently audit all linked repos and retain one managed server. Every new physical row remains Pending; no gameplay/conversion/theme winner.

### Read-only integration map

Subagent `79831f20-7453-4b53-9b17-73c6f1460b09` confirmed one required atomic compatibility fix: corrected UI accepts only the exact six-field transport snapshot, while assembly still emits the old four fields and therefore currently fails closed to hidden transport. Add internal `src/audio-mix-coordinator.js` with descriptor-safe exact-pair narrowing, denial/corruption fallback, immutable in-memory truth, same-document subscribers, storage-event cross-document apply without writeback, idempotent unsubscribe and no component retention. Keep `service-graph.js` persistence-agnostic.

Wire `src/index.js` immediately after fresh graph creation: subscribe/apply the current pair before any playback, generation-guard graph updates, map `sfxVolume` only to UI `soundVolume`, render locally without `publish()` or public events, and let teardown use the existing unsubscribe list. Intent narrowing must be descriptor-safe and reuse UI snap normalization; coordinator fan-out is the single audio/UI update path. `getSnapshot()` and iframe events remain status-only; do not extend exact game-capabilities v1.

Add focused coordinator and browser integration validators, update the three fake-audio fixtures in console-noise/mobile-menu/product-shell tests rather than adding production compatibility fallbacks, and prove exact storage, hostile accessors, denial/corruption, same-document and same-origin iframe sync, disconnect/reconnect, Test/Play/seek/pause/hidden/lease continuity, all eight direct/iframe layout contexts, and complete outbound privacy. Cross-origin iframes prove privacy only, not storage synchronization.

### Release coder result

`0.0.31` was built through the canonical `version:patch` and `build-release` scripts. Two independent raw builds produced byte-identical 13-file trees with raw-manifest SHA-256 `20114134270da12b7d4bed7ca4a298607c668ede88e80a2b4d8c24e2da4aa804`, proof SHA-256 `25bc04047ab00391f608a65fc1f1711725935f7016be4caebcb166a0771e3983`, source fingerprint `1f221ee94879e629d17efcae70ac58e92aacfd943d660d15824ae47f4ecec0c3`, `11,516,716` pre-proof bytes, and `11,518,082` total bytes. A complete pre/post SHA-256 manifest proved every tracked `0.0.30` byte unchanged.

Fresh `npm test`, exact `npm run test:browser`, `npm run test:v4-integration`, live `3C9D` Flow obstacle validation, production build, `npm ls --all`, version/proof alignment, forbidden/privacy/scope searches, and diff hygiene passed. The exact browser gate passed Flow, Boxing Lanes, and Boxing Grid through all eight direct/iframe portrait/landscape DPR1/3 contexts plus gameplay cursors, cursor capture/release/re-entry, volume persistence/fanout/lifecycle/privacy, and zero unexpected console errors. Static and runtime proof found no mix leakage into the bridge/service graph, capability schema addition, Theme runtime/assets, third-party bytes, or forbidden pose runtime. Exact final npm-pack metadata remains only in release Bead `nl4` because this plan is itself packed. The dedicated Task 17 handoff leaves hardware cursor, physical visual volume, audible Music, and future SFX rows Physical Pending. Release Bead closure remains owned by final auditor `es1`.

### Final independent release audit result

Final audit PASS against exact candidate payload `2c0968ec3fbdda9cb86016673ff8ef83a05e3e75`. The owning checkout was clean/upstream at replacement orchestration record `c56689a`; its only delta from requested audit-start record `b7f94ec` is the plan's worker-status line, so every executable gate and reproduction ran from a detached sibling worktree at exact `2c0968e`. Fresh `npm test`, exact `npm run test:browser`, `npm run test:v4-integration`, live Flow-obstacle proof, production build, canonical-main `npm ls --all` (exit 0), version/proof/fingerprint/inventory validators, forbidden/privacy/scope searches, and `git diff --check` passed. One isolated copied-worktree `npm ls --all` produced `ELSPROBLEMS` because its `node_modules` was a symlink to the owning checkout, causing npm to classify the owning tree's otherwise valid transitive installation as extraneous/missing relative to the copied root; this environment-topology artifact did not affect tests/builds and was disproved by the required canonical-main command exiting 0 against the unchanged candidate package/lock. The browser gate covered Flow, Boxing Lanes, and Boxing Grid in all direct/iframe portrait/landscape DPR1/3 contexts, cursor confirmation/re-entry/cleanup, exact volume persistence/fanout/lifecycle/privacy, Test/scored Play continuity, and zero unexpected console errors.

Tracked raw candidate plus two freshly cleared `build-release` rounds were recursively byte-identical: 13 files, `11,516,716` pre-proof bytes, `11,518,082` total bytes, raw-manifest SHA-256 `20114134270da12b7d4bed7ca4a298607c668ede88e80a2b4d8c24e2da4aa804`, proof SHA-256 `25bc04047ab00391f608a65fc1f1711725935f7016be4caebcb166a0771e3983`, and source fingerprint `1f221ee94879e629d17efcae70ac58e92aacfd943d660d15824ae47f4ecec0c3`. Two auditor dry packs and two actual-pack JSON records were pairwise identical at SHA-256 `ec215805cb241670c02218a444da87d457ed56309a54f4fbd2961a616400e209`; two actual archives were byte-identical at SHA-256 `7c9f996af27fbada91f2f82140f6d3cf3117677bd55683ee8f19471c8c09d606`, with `383,536` packed bytes, `1,376,159` unpacked bytes, 95 files, shasum `c1e47ed2d117225ca49584edbc50c1a88580d960`, and integrity `sha512-SLIuJcmUeOaCz//6EpKFxMkLxoMfv/ehIwmnasVpPe7bdgUgDU6sZmiK6iTX4VSQgfgzzRz/Su94lXY4SR2f5Q==`. Every tracked `0.0.30` byte matches release commit `2523777`, historical manifest SHA-256 `7e450afe15cc3f032031db71880a2f8d0669cd942793a6dc1cf5ac404e840895`, and no older release changed.

Linked clean/upstream audited heads are renderer `b50bcb5208938a77369d644536951ed8d9ef555d`, audio `aef0b0a9cd51926b7c2e3b9dbff58911e2cfbbb0`, and UI `05991721249a0edfaaafe0a6448f34e574a07aa6`. Independent code/lineage review verified confirmed-release cursor ownership, strict persistent exact pair and generation-bound fanout, Music/future-SFX gain buses, exact six-field UI snapshot plus normalization/snap/accessibility, and no mix leakage into snapshots, events, iframe bridge, service graph, capability schema, or telemetry. Release inventory remains MediaPipe-only with zero WASM/forbidden markers, zero Theme runtime or legacy compatibility additions, and zero AssetBundle/`.bloq`/`.plat`/GLB/Unity or other third-party Theme bytes. `docs/task17-cursor-volume-physical-handoff.md` remains byte-exact to `2c0968e` and every row remains Physical Pending. No source defect was found; no P0 was created; no public/publish/upload/Theme action occurred.

### Corrected `0.0.32` release coder result

Assembly began clean/upstream at `026f1343779b24fdd0452555c212a7f6871ae5e6`; linked UI was clean/upstream at audited head `fbf0bb89cfdc5c3fcee332cbc5c69cfdd44d303f`, containing the minimal production correction `2abc98c`. `node_modules/@aerobeat/web-ui` resolves directly to that local checkout; no assembly compatibility fallback was added. The physical root cause is the author cascade: raw `0.0.31` has logical `hidden=true` but `.volume-popover { display:grid }` overrides the user-agent hidden rule. Actual Chromium against tracked raw `0.0.31` reproduced both default and repeated-button closed states as computed `display:grid` with geometry `[140,189,1]`; open was the same nonzero grid. Prior automation failed because it asserted hidden/ARIA truth without computed rendering or geometry.

The strengthened assembly browser sensitivity now exercises all eight direct/iframe × portrait/landscape × DPR1/3 contexts. In every context default, repeated-button, outside-pointer, outside-click, Escape, inactive, reactivated, detach, and reconnect states are logically closed and have zero geometry; connected closed paths compute `display:none` (detached content truthfully has empty computed display while outside the document). Every open transition computes `display:grid`, has nonzero width/height/client rects, preserves exact `0.29/0.73` values, and remains integrated with the existing persistence, fanout, privacy, and lifecycle proof. The same validator intentionally serves immutable raw `0.0.31` and requires the historical always-painted defect to reproduce, making the test sensitive to both the defect and correction.

Canonical `version:patch` produced package/lock/index `0.0.32`. Two clean `build-release` rounds were recursively identical: 13 files, `11,516,820` pre-proof bytes, `11,518,186` total bytes, canonical SHA-256 manifest `87b0f5419ffd0b6fc88b1314f7480c0510037d7a1bad7cc80507761701428a25`, and source fingerprint `fd46c1fa3991b1486b8ef576779b77f74ec82365f2bbec669d2193347c44703e`. Every tracked `0.0.31` and older byte remains unchanged. Fresh `npm test`, exact `npm run test:browser`, v4 integration, live `3C9D` Flow-obstacle validation, production build, `npm ls --all`, version/proof/privacy/forbidden checks, and `git diff --check` passed. Two dry packs and two actual packs were pairwise exact; final pack/archive hashes and npm metadata are recorded only in P0 `aerobeat-web-assembly-2fw` because this plan is itself packed. No publish, GitHub Release, upload, server replacement, PoC, Theme, asset, or third-party redistribution action occurred.

## Milestone 1 physical gate

**Physical gate:** `aerobeat-web-assembly-7f9`
**Physical repair:** `aerobeat-web-assembly-2fw` consuming UI P0 `aerobeat-web-ui-9bd`
**Status:** Physical Pending for exact corrected `0.0.32`; the failed popover row alone is reset for Derrick retest, every other untested row remains Pending, and `aerobeat-web-assembly-zd0` stays blocked

Derrick found that the `0.0.31` volume panel was physically painted before the icon was pressed and remained painted after logical close. Diagnosis: author `.volume-popover { display: grid }` overrides the browser’s user-agent `[hidden] { display: none }`; prior automation asserted only `hidden`/ARIA state and missed computed rendering. Audited UI source adds the author-level hidden rule, assembly sensitivity proves computed style/geometry through every closure path, and deterministic `0.0.32` is the corrected handoff candidate. The failed popover row is Physical Pending rather than PASS until Derrick retests this exact candidate. A failed observation creates a linked P0 and blocks the PoC. Pending is not PASS.

## Milestone 2 — Local-only `.bloq`/`.plat` conversion PoC

**Assembly tracking Bead:** `aerobeat-web-assembly-zd0`
**Deferred visual Bead:** `aerobeat-web-assembly-ubg`
**Status:** Blocked by corrected `0.0.32` physical gate

Create local `aerobeat-web-theme-authoring`, with ignored `local/sources`, `local/work`, and `local/generated`. Commit no third-party binaries. Establish owned synthetic AssetBundle/GLB fixtures where practical, deterministic inventory/manifest/validation, and tool adapters. After explicit local-only acquisition, inspect one block and one simple platform without executing scripts. Record hashes/provenance privately, extract to GLB, reauthor a minimal PlayCanvas material comparison, measure size/load/CPU/GPU/mobile behavior, and stop for Derrick's review.

## Milestone 2 review gate

Present exact extraction fidelity, missing shaders/animations/behaviors, performance budgets, local file sizes, and screenshots only through approved private evidence. Derrick chooses whether to proceed, change tools, seek permissions, or clean-room the assets. No runtime Theme implementation begins without approval.

## Milestone 3 — Theme runtime (future approved continuation only)

After the PoC review, create package-specific Beads for Theme manifest contracts, renderer GLB lifecycle, UI selectors, palette precedence, owned missing art and assembly/release integration. Independent coder/QA/audit applies to each repo. Third-party binaries remain uncommitted until rights and distribution strategy change.

## Global validation and boundaries

- No public npm/GitHub Release or third-party asset redistribution without separate explicit approval.
- Preserve direct/real iframe, portrait/landscape, DPR1/3, fine/coarse pointer, all three presentations, terminal replay, exact 4×3 timing/duration/scoring/privacy/lifecycle/context recovery.
- Store no raw media, pixels, screenshots, pointer histories or asset bytes in public snapshots/events.
- All linked repositories clean/upstream at each gate; package dry-pack metadata external when packed docs would perturb it.
- The previously retained `dev:tailscale` PID tree (`3901811`/`3901822`/`3901823`) disappeared before assembly integration; local `5173` and tailnet `8443` both returned connection failure on 2026-09-01. Do not duplicate it. Start exactly one managed replacement only when assembly implementation/browser validation needs it, then verify both exact URLs.
