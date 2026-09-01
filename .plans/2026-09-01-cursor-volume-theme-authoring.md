# Cursor Restoration, Global Volume Mix, and Gated Theme Authoring

**Status:** Approved and in progress
**Owner:** assembly orchestrator → package coders → independent QA → package auditors → assembly integrator → release auditor → physical gate → local asset PoC
**Assembly epic:** `aerobeat-web-assembly-27n`
**Target release for Milestone 1:** deterministic `0.0.31`
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
**Status:** Audit FAIL at `e4cee4c`; P0 `aerobeat-web-renderer-4w1` cross-instance pointer-error correction in progress with coder `b9943984-1412-4b67-bc44-7506b7d277cc`; audit `0424a0c6-dd84-4e07-b83f-7fdd2e03944c` paused

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
**Status:** Coder `3ac371f` QA FAIL; P0 correction PASS `2186523`; independent QA resumed — subagent `c4d91c7a-3d6f-4757-9530-be5389cf6712`

Extend the strict Visual Test transport snapshot with only Music/Sound scalar values. Emit exact volume intents after UI-side normalization/snap. Own the popover's ephemeral open state without replacing focused sliders during snapshots. Verify layout/accessibility/direct keyboard/touch/reconnect at phone portrait/landscape and DPR without owning audio or persistence.

QA found one deterministic-normalization defect in `3ac371f`: binary division made exported `snapVisualTestVolume(0.285)` return `0.28` while another half-step `0.725` returned `0.73`. P0 `aerobeat-web-ui-osp` preserves QA sensitivities and requires stable half-up `0.01` normalization without changing magnetic anchors or UI behavior before QA resumes.

## Milestone 1D — Assembly integration, QA and release

**Integration:** `aerobeat-web-assembly-7l3`
**QA:** `aerobeat-web-assembly-9rh`
**Release:** `aerobeat-web-assembly-nl4`
**Final audit:** `aerobeat-web-assembly-es1`
**Status:** Read-only integration mapping in progress — subagent `79831f20-7453-4b53-9b17-73c6f1460b09`; implementation remains blocked by renderer/UI audits

Assembly stores the exact plain-data `{musicVolume,sfxVolume}` pair under origin-local key `aerobeat.audio-mix.v1`, defaults safely to `0.5/0.5`, applies it to every fresh graph before playback, persists UI changes, and keeps values private from snapshots/iframe events. A module-local coordinator owns same-document subscribers; the browser `storage` event synchronizes same-origin iframe/document realms. Storage denial/corruption fails closed to in-memory defaults without blocking playback; disconnect unsubscribes without retaining components. Test actual Music gain continuity across Test/Play, seek, pause, lease transfer, hidden/reconnect and multiple instances; Sound is bounded state only until SFX exists. Integrate audited cursor renderer and prove physical-path exit state/style across Flow/Lanes/Grid. Preserve the complete existing matrix.

Patch package/lock/index/proof to `0.0.31`, leave `0.0.30` byte-unchanged, build raw twice, pack twice, independently audit all linked repos and retain one managed server. Every new physical row remains Pending; no gameplay/conversion/theme winner.

## Milestone 1 physical gate

Derrick must physically confirm cursor restoration and volume behavior in `0.0.31` before Milestone 2 is claimed. A failed observation creates a P0 and blocks the PoC. Pending is not PASS.

## Milestone 2 — Local-only `.bloq`/`.plat` conversion PoC

**Assembly tracking Bead:** `aerobeat-web-assembly-zd0`
**Deferred visual Bead:** `aerobeat-web-assembly-ubg`
**Status:** Blocked by `0.0.31` physical gate

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
- Keep current `dev:tailscale` server tree unless it disappears; do not duplicate it.
