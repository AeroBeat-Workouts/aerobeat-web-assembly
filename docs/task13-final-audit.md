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
