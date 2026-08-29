# Task 13 Independent Final Audit

**Audit date:** 2026-08-29  
**Assembly target:** `fda6d23ea3c67dbb3a35064987640802f1fd04ee` (`main == origin/main`)  
**Task 13 Bead:** `aerobeat-web-assembly-48w.7` — remains in progress  
**Verdict:** deterministic implementation and physical-playtest handoff are ready; Task 12 physical execution, Task 13 closure, and the umbrella remain operator-pending.

## Scope and repository state

The audit covered assembly, contracts, BeatSaver vendor, browser authoring, content runtime, gameplay, calibrated input, video, audio, renderer, UI, style, CV, and MediaPipe vendor repositories. Every audited repository is on `main`, synchronized with its SSH `origin` under `AeroBeat-Workouts`, and clean.

Final verified heads for the implementation-owning Task 11 repositories:

- assembly handoff: `fda6d23`
- contracts: `ae436ee`
- BeatSaver vendor: `416e926`
- browser authoring: `0b099b3`
- content runtime: `f766a75`
- gameplay: `157b3c1`
- calibrated input: `9ddeb15`
- video: `bc9fd59`
- audio: `6a6be43`
- renderer: `6e13427`
- UI: `a00c53d`

All implementation, P0, and deterministic QA Beads through Task 11 are closed. Task 12 `.6` and Task 13 `.7` remain in progress; umbrella `48w` remains open.

## Architecture and contract audit

- `aero-game` is the only public root. It fills its parent content box and does not own body, history, location, or `100vh`.
- Assembly composes public sibling package APIs through explicit `file:` dependencies; domain conversion, persistence, scoring, input, media, rendering, and UI behavior remain in their owning repositories.
- Each connection receives a fresh service graph; renderer/video/UI surfaces remain stable; generation guards prevent late publication after reconnect or destroy.
- The process-wide camera/audio lease is serialized and transactional, including rollback, unregister, callback reentry, and recovery failure cases.
- The immediate-parent iframe bridge enforces exact source, origin, instance, version, IDs, descriptor-safe structure, and the inclusive 64 KiB limit. Only bounded plain identity/progress/gameplay telemetry crosses it. ZIP/audio bytes, `Blob`, `File`, streams, tracks, `VideoFrame`, pixels, frames, and screenshots do not.
- Browser BeatSaver acquisition remains provider-neutral and arbitrary compatible maps are not gated by an allowlist. Direct and local ZIP paths converge through authenticated source manifests.
- Converter profiles bind exact source, top trace, four Boxing traces, and four Boxing charts. Legacy packages omit the optional profile semantic key; profile-authored packages include it in initial and modifier hashes.

## Experimental posture

The available candidates remain:

1. Semantic Track · Row Family
2. Spatial Grid · Row Family
3. Semantic Track · Cut Family
4. Spatial Grid · Cut Family

All four remain explicitly experimental. No production winner, promotion, survey, prototype preference, public leaderboard, or branch removal was introduced. Scores remain local/test-only; shadow results do not affect live score. The handoff requests comfort/clarity observations without ranking or promotion.

## Production CV and release

Production has one route: MediaPipe Pose Landmarker Lite float16 `/1/`, `@mediapipe/tasks-vision` `1.0.1`, GPU-WebGL, `0.5/0.5/0.5`, Fast tracking, direct full input, measured/current gameplay, and a 15 fps submission ceiling. Experimental prediction fixtures remain outside the production graph and release.

Fresh final audit gates passed:

- `npm test`
- `npm run build-release`
- `npm pack --dry-run --json`
- `git diff --check`
- clean/synchronized Git verification

Release evidence:

- source fingerprint: `17aa9a9e592b3ee8be531365850510b209bc4d008cbc3a20244d14ecf4fa2ea3`
- proof JSON SHA-256: `6ef286f7425e56320066da1aa1d6ea8db1d5e979ff87c5d28253b65fd98363dd`
- `assets/index.js`: `5fc5f6ce7108ea8fd9f89bdb5eeb00c0c00b34a827955751fcccf0dcd1df3668`
- `assets/index.js.map`: `57681aad2535a8d04aa91c755eb5de2498b8ed08bac0e1e8389b30e43c767157`
- pre-manifest bytes: `3908241`

The proof declares only the MediaPipe concrete pose vendor/backend and records scans for MoveNet, TensorFlow, ONNX, predictive, and superseded experiment markers. No forbidden runtime marker or asset is shipped.

## Physical-playtest handoff audit

`docs/task12-physical-playtest-handoff.md` is complete and actionable. It names:

- desktop and Tailscale HTTPS launch commands and URLs;
- direct and iframe selectors;
- current nonprebundled BeatSaver candidates `53EFD` and `51D2F`;
- direct-download and local-ZIP recovery paths;
- T-pose, cooldown, countdown, grid/subcell, Flow, and four-Boxing steps;
- visual/scoring/converter profile controls and expected state transitions;
- lease, fullscreen, reconnect, hidden, privacy, and failure checks;
- a physical evidence table that is still truthfully pending.

Automated device-path evidence acquired a real Logitech BRIO and injected it into the public direct API, but this is not human calibration or play. There is no Android device, `adb`, or human physical-play evidence. The configured Tailscale HTTPS route requires the operator to start the existing Vite target and use a camera-capable Android browser on the tailnet.

## Closure decision

Task 12 `.6` cannot close until a human completes desktop calibration/gameplay, Android HTTPS calibration/gameplay, and two current-map direct/local-ZIP physical runs. Task 13 `.7` is blocked by `.6` and its acceptance requires the umbrella to be ready to close; therefore `.7` cannot close yet. The umbrella `48w` and the active plan must remain open/operator-pending.

No product defect was found in this audit, so no repair Bead was filed. After the physical evidence table is completed, rerun the final Git/release checks, close `.6`, then close `.7` and the umbrella without selecting a winner.

## Post-repair addendum — 2026-08-29

Audit Bead `aerobeat-web-assembly-b9v` passed against assembly `54b18304e723ccf1448b0eeff5c2cd2a6ab40ea2` and UI `3c070003d93dd664a974c32329733b33c3393ee1` (product code `b075797adeddd1f46fa2b858540da1718f9847b6`). Exact diffs confirm UI `b075797..3c07000` and assembly `b02bf68..54b1830` add only QA/Bead/plan/handoff records after their implementation commits; both repositories were clean, synchronized with `origin/main`, and `git diff --check` clean. Assembly resolves the file dependency to the audited UI worktree.

The landing and coder→QA evidence agree: the drawer has exactly Gameplay, Visuals, Music, and Info; scoped native radios deterministically select Flow and `aero.visual.default`; product scopes omit development/scoring/converter/bundle text; missing playable Music focuses one concise prerequisite and makes zero camera requests; playable content is selected/configured before camera, T-pose, countdown, and play. The targeted mobile validator passed once. Lifecycle/reconnect, direct/iframe privacy, profile APIs, and no-production-Boxing-winner coverage remain represented by the unchanged accepted suites. Release proof remains locked to MediaPipe Lite float16 `/1/`, tasks-vision `1.0.1`, GPU-WebGL, measured input, 15 fps, with proof SHA-256 `88807550b23fae13dbd26f420c68ca20b679b3d8ca45225bd2e0e392b3fca3fd` and source fingerprint `e15922ff6eb9e09f244d7e9a6443424206f992ee2c14b2c05b83695057e65817`.

Both `http://127.0.0.1:5173/` and the documented Android HTTPS route returned HTTP 200 during this audit. The plan and physical handoff remain accurate: `c36`, Task 12 `.6`, Task 13 `.7`, and umbrella `48w` stay open for Derrick’s physical desktop/Android play and two-map direct/local-ZIP evidence. Only `b9v` is eligible to close.

## Final product-radio audit addendum — 2026-08-29

Audit Bead `aerobeat-web-assembly-qbt` passed against exact assembly HEAD `f6ccf119224d1f18dbc765ea9a36e2795644d08f` and exact UI HEAD `5ca7e14c3f35a6e81d5d89e684eaf39c46984ee7`, whose product implementation is exact commit `5e7ac29d87c57283319a4f619d8312922bb81a97`. Both `main` branches matched `origin/main`, both worktrees and current `git diff --check` were clean, the assembly file dependency resolved directly to the audited UI worktree, and the exact implementation diffs `5e7ac29^..5e7ac29` and `24c8dfc^..24c8dfc` were whitespace-clean. Post-code ranges contained only the recorded QA/Bead/plan/handoff evidence described below.

The product drawer has exactly four ordered sections—Gameplay, Visuals, Music, and Info. Gameplay and Visuals use native radios and choose the valid durable leader or deterministic first fallback (Flow and `aero.visual.default` in the current state). Populated BeatSaver maps and local packages also use native 42px radios, preserve a valid current selection, and otherwise check the first option. Search, Latest, local ZIP, Import, Export, Delete, confirmation/cancellation, and import cancellation remain buttons; Version and Difficulty remain native selects. Scoped product views contain no schema, ruleset, recipe, hash, profile-class, scoring, converter, bundle-management, or other development information.

The exact coder→QA chain is internally consistent: UI `24a` implemented at `5e7ac29` and QA `1u9` closed at UI HEAD `5ca7e14`; assembly `3cw` implemented at `24c8dfc`, QA `v51` closed, and HEAD `f6ccf11` records that evidence. Audit of source, tests, Bead closure reasons, plan, diagnosis, handoff, and release proof confirms that fresh/no-content Calibrate focuses one concise Music prerequisite and performs zero camera requests, while selected playable content is configured before the one camera request and existing T-pose/cooldown/countdown/play flow. The unchanged accepted direct/iframe handshake, lifecycle/reconnect, privacy/no-raw-media bridge, profile API, and no-production-winner suites remain applicable because the exact code diffs are limited to presenter option semantics, selected-package presentation, their validators, and generated release output.

The targeted mobile validator was run exactly once for this audit and passed its 390×844 and 844×390 four-section, populated current/first radio, action/select typing, zero-camera gate, playable camera/T-pose/countdown/play, menu-pause, reconnect, and console-noise assertions. The committed release proof remains locked to MediaPipe Pose Landmarker Lite float16 `/1/`, tasks-vision `1.0.1`, GPU-WebGL, measured gameplay input, and 15 fps; its source fingerprint is `83a0c64515fd9e2e80922f0f47875889ff383441c0078c78523dbe4c5582ea9d`, proof SHA-256 is `895b14ccfb0213da7f36d9234f05d8313a1cccfceccef6ed6430a8eccf9568d6`, and pre-manifest size is `3966471` bytes. Local direct and documented Android HTTPS routes both returned HTTP 200.

No product defect was found, so no linked P0 was filed. Close only `qbt`. Keep `c36`, `3cw`, Task 12 `.6`, Task 13 `.7`, and umbrella `48w` open for Derrick’s physical desktop/Android camera and gameplay retest plus two-map direct/local-ZIP evidence. The active plan and physical handoff state this operator-only boundary truthfully and do not select a Boxing winner.
