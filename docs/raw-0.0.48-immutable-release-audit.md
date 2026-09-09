# Raw 0.0.48 immutable release audit

**Date:** 2026-09-09

**Builder Bead:** `aerobeat-web-assembly-ancv`

**Audit/serve Bead:** `aerobeat-web-assembly-ok0v`

**Release introduction commit:** `6b90860bc9363c36b669b9494375eb8af6b5bc29`

**Builder-evidence pushed HEAD before audit:** `7e0b0eed69029c93faccf7f86eaeb0016636aec4`

**Raw subtree:** `cce1523b5e7ce5584aab4330d9d931daea5e6ffa`

**Disposition:** AUDIT PASS; close `ancv`. Leave `ok0v` open/in progress for the parent-owned durable serving switch only.

## Scope and boundaries

This was an independent immutable-release read-back. I read the repository README, active `2026-09-02` plan, `docs/raw-0.0.48-builder.md`, and every comment on Beads `ancv`, `ok0v`, `ofi1`, and `xtaw`, then claimed `ok0v`. Builder statements were treated only as leads.

I never invoked `build-release`, `build:release`, the gameplay asset builder, or `tools/build_uniform_wall_release.py`. I did not edit, rewrite, normalize, delete, replace, or regenerate any byte under `release/raw/0.0.24` through `release/raw/0.0.48`. I did not stop or alter parent managed job `bash-415`, bind port `5173`, alter Tailscale, publish npm, create a tag or GitHub Release, enable Funnel/public access, or claim physical PASS.

The pre-audit checkout satisfied `HEAD == origin/main == remote refs/heads/main == 7e0b0eed69029c93faccf7f86eaeb0016636aec4`. The sole checkout dirt was the protected unstaged `.beads/interactions.jsonl` export; it was preserved and excluded from Git commits.

## Commit, tree, and append-only history

- Introduction commit `6b90860bc9363c36b669b9494375eb8af6b5bc29` has parent `1ea0d275d43ba93cd672ee6d90f28953996b5779`; its commit tree is `66c23d4b89e71ead2aa2022a2388b5cac287cdf0`.
- `release/raw/0.0.48` resolves to exact subtree `cce1523b5e7ce5584aab4330d9d931daea5e6ffa` at the introduction commit and at pre-audit pushed HEAD `7e0b0eed69029c93faccf7f86eaeb0016636aec4`.
- The path is absent at the introduction parent. `git log --all -- release/raw/0.0.48` contains exactly one commit: the introduction commit.
- The raw subtree has no diff from the introduction commit through pushed builder-evidence HEAD.
- Every prior raw path `0.0.24` through `0.0.47` has an empty diff between the authorized pre-build parent and pushed builder-evidence HEAD.
- The introduction commit adds the 39 raw files and changes only version authorities plus immutable-release assertions outside raw: `index.html`, `package.json`, `package-lock.json`, `scripts/validate-immutable-raw-mutations.js`, `scripts/validate-immutable-raw-snapshot.js`, and `scripts/validate-shared-hash-provenance.js`.
- Exact non-raw `git diff --check` from `1ea0d275...` through `7e0b0eed...` passed. Generated shader-string whitespace remains only inside immutable raw bytes and was not changed.

## Canonical identity and complete aggregates

Independent Git-object enumeration and SHA-256 calculation reproduced:

- `39` regular files;
- all Git modes exactly `100644`;
- `28,437,675` total bytes;
- `28,434,676` artifact bytes before proof;
- proof size `2,999` bytes;
- proof SHA-256 `79ffc77ed0f1ae4cb4428cbb8cab297abe3aab89de16fd9a46e4d07f5076db6e`;
- source fingerprint `7cfbf9ccb7da96016fc6cda1a3de736ba2167ef152bf41807902bc27c6511101` over `212` inputs;
- path-order SHA-256-manifest aggregate `0ff7e3d4d33896b1bb7b941e6a15f0fba735202c767d4c7d54b49e8f496b5e41`;
- globally line-sorted complete-manifest aggregate `fe3a8b1315e9001d381c06a4129262a770682b2e3e69d334286af92b42614184`.

Both aggregates were recomputed from Git blobs as `SHA256  full/release/path` lines, first in Git path order and then globally line-sorted. The proof reports exact raw/unminified browser output, version `0.0.48`, base `/`, and `minified: false`.

## Dependency pins and source lineage

Fresh `node scripts/validate-shared-hash-provenance.js` reproduced the release fingerprint and all eight commit/tree authorities:

| Package | Commit | Tree |
|---|---|---|
| `@aerobeat/web-hash` | `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` | `b423c6742c07f56dde196d9f60f2e23c51ad913c` |
| `@aerobeat/web-vendor-beatsaver` | `5866f8e418e4a0ef11362f9e6c80ebc5a2ad3c3a` | `997e8a476ab9ff04f0197cfa203091c58c865772` |
| `@aerobeat/web-content-authoring` | `bfcd5206e54ac110b8cd44b65986b510abbd6ee1` | `81a3a991e71a292811eb890d43b1051ca6110152` |
| `@aerobeat/web-content` | `260eb8051c5cd1abeb821d13519fbad9d876fffd` | `4ed35ad220427920776153734b3f52d67fcdbaa9` |
| `@aerobeat/web-audio` | `19fd3a91eb67712806a17e4c82e2631d63f72434` | `9bd3418296d8fbdbfe72669958087f50a3302675` |
| `@aerobeat/web-renderer` | `bd8ad9ebfe2107b11ffc5373e1c0f86349167b09` | `18c75a883979c2f76b56a76a9eca54f2dcea4360` |
| `@aerobeat/web-gameplay` | `2ba22596398c9ef36a555ef5240b802ea02cc437` | `1970855fa2828ea607bb913760e9a39adc3263fe` |
| `@aerobeat/web-input` | `f724672d5a431c455d7061e4f7f07effe25aaa2d` | `29e7a3b6647216275b8eae50fec7585041878041` |

The hardware candidate was captured at assembly `485ef61...` with renderer `bd8ad9e...`. The intervening assembly scope through `1ea0d275...` changes only plan/provenance validators and no `src`, Vite configuration, package/version, lock, HTML, or assets. The introduction then changes only version-bearing package/lock/HTML authorities plus release assertions outside raw. This preserves the exact production implementation and renderer lineage while truthfully advancing the release fingerprint from pre-version `7a097c9b...` to proof fingerprint `7cfbf9cc...`.

## Bundle, marker, environment, and gameplay audit

Independent raw traversal and the production hash-bundle policy verified:

- proof `1`, JavaScript `3`, source maps `2`, environments `24`, gameplay GLBs `7`, CSS `1`, HTML `1`, WASM `0`;
- exactly three runtime JavaScript assets and two complete deduplicated source maps;
- exact shared `@aerobeat/web-hash` source ownership in `assets/index.js` and `assets/conversion-worker-CKy18nBK.js`;
- hash source retains deterministic SHA-1/SHA-256 fallback and contains no external URL, dynamic import, fetch, or WASM path;
- all required markers are present: `Pose Landmarker Lite float16 /1/`, `mediapipe`, `cpu-wasm`, `VideoFrame`, `standard`, `measured`, and `submissionCadenceTargetFps`;
- all forbidden runtime markers are absent: TensorFlow, ONNX, MoveNet, predictive/predicted-pose, responsive A/B, direct-256, and experimental-worker-videoframe;
- no forbidden filename/path matches MoveNet, ONNX/ORT-WASM, pose-detection, or TensorFlow;
- the owned environment catalog is exactly eight ordered environments / `24` raw files;
- all seven gameplay GLBs are exclusively under immutable `assets/gameplay/0.0.10/`;
- wall `assets/gameplay/0.0.10/wall/red-glass-v1.glb` is exactly `2,316` bytes with SHA-256 `6a336116709c2f3c1d92453fe1b3a2821e03d31128dae72d0fc700627fa94cd7`.

## Fresh validation

- `npm test` exited `0`. It reproduced all `23` immutable snapshots through `0.0.48`, exact mutation rejection through `0.0.48`, append-only target rejection, environment/gameplay provenance, source fingerprint, bundle ownership, unit/integration policies, and the exact offline `3c9d` fixture.
- `npm run test:release-pack-policy` exited `0`, including append-only target policy, bounded npm process-group behavior, internally derived Node/npm authority, lifecycle/environment isolation, canonical gzip/USTAR, Git/bin modes, exact bytes, inventory, path, CLI grammar, and manifest identity.
- Recorded builder full `npm run test:browser` PASS was reviewed in both the builder document and active plan. It covers direct/genuine iframe viewport/DPR matrices, photospheres, gameplay `0.0.10`, walls, cursor/grid/visual-correction pixels, exact `3c9d`, trajectories, live marker `32` CSS px, and zero unexpected browser noise. The full gate was not rerun because the requested audit was to review its durable record and separately exercise the committed raw.
- Fresh `npm run test:exact-3c9d-browser` exited `0`: exact fixture `89,424` bytes / SHA-256 `4db5b3393a389c7bcaba6d7a02aec57c10801bcfd74de91523b8e9cdad859b55`; direct/genuine-iframe pixel parity across five variants; exact wall asset/AABB evidence; and direct/genuine-iframe desktop/mobile trajectory controls. This oracle exercises the exact committed source/dependency graph. Its fixture imports are not exposed by the self-contained raw bundle, so it is not misrepresented as a raw-target override.

## Exact committed-raw browser exercise

A modification-free inline Node/Playwright oracle served only `release/raw/0.0.48` from temporary child origin `127.0.0.1:33137` and a minimal cross-origin parent wrapper from temporary origin `127.0.0.1:34167`. It exercised:

- direct desktop `1280×720` at DPR `1`;
- direct mobile `390×844` with touch/mobile context at DPR `3`;
- genuine cross-origin iframe desktop `1280×720` at DPR `1`;
- genuine cross-origin iframe mobile `390×844` with touch/mobile context at DPR `3`.

Every context reached environment and gameplay-asset `ready`, filled the exact child viewport, read proof `0.0.48` / fingerprint `7cfbf9cc...`, and fetched all `39` committed raw paths successfully. Request routing allowed only the exact temporary child origin (plus the wrapper origin for iframe navigation); no request escaped, no unknown raw path was requested, no HTTP `>=400`, request failure, console warning/error, or page error occurred. Both temporary servers and Chromium contexts were closed in `finally`; post-run listener inspection confirmed neither temporary port remained. Parent port `5173` and job `bash-415` were untouched.

## Candidate hardware evidence

The preserved candidate file remains exactly `17,411` bytes with SHA-256 `2038b400607bc5aebd32af3263e7aab530769d4c7cc2072addd7419435f520e3`. Fresh locked validation passed:

- headed-X11 hardware WebGL2/debug identity on NVIDIA RTX 3080;
- `25` backend checks with no drift;
- exact A/B/C/C/B/A order and historical `6,000 × 43 ms`, default `2500 ms` workload;
- target samples equal display frames with `59..64` projected targets;
- staged minimum `59.669 FPS`, B/A approximately `1.0000`, C/B approximately `0.9999`;
- CV maximum `14.982 FPS`, staged B/C pose age maximum `106.6 ms`;
- exact camera `640×480@30`, all privacy flags false, and empty browser noise.

The hardware adversary matrix accepted the baseline and rejected all `12` software/headless/missing/drift mutations. This evidence remains valid for the exact production implementation/renderer lineage described above. It is candidate hardware evidence only and does not claim Derrick physical PASS.

## Final authorization

**AUDIT PASS.** Builder Bead `ancv` may close. Audit/serve Bead `ok0v` remains open/in progress because persistent serving is deliberately parent-owned.

**Exact parent serving authorization:** the parent orchestrator may now replace parent-managed `bash-415` (currently serving immutable raw `0.0.47`) with one parent-managed durable loopback process bound to unchanged `127.0.0.1:5173` and rooted at exact committed `release/raw/0.0.48` subtree `cce1523b5e7ce5584aab4330d9d931daea5e6ffa`. The existing private Tailscale HTTPS proxy may remain unchanged and may be read back against all 39 paths. The parent must verify the new managed job remains registered/running after this auditor exits and must close `ok0v` only after local and private HTTPS byte/proof read-back succeeds. This authorization does not permit changing the Tailscale topology, enabling public Funnel, rebuilding or mutating raw, publication/tag/GitHub Release, or claiming physical PASS.
