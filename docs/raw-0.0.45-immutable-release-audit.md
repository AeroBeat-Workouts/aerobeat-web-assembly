# Raw 0.0.45 immutable release audit

**Date:** 2026-09-08

**Builder Bead:** `aerobeat-web-assembly-xa0p`

**Audit Bead:** `aerobeat-web-assembly-cbh4`

**Release commit/tree:** `992d0bb132b69b03ee25d22503b363df2bd5ce3f` / `965f3e968070e352c2f8fd45e2a6077bbd5d3c1c`

**Builder-evidence tip/tree:** `ef4e18cd043eb2b6c55c463a3dac57d53efd580d` / `553735247ebfb249c274eeff6d83641b1370349d`

**Raw subtree:** `7f956672151127aceb748891ac4861f825cdb699`

**Disposition:** PASS; canonical raw `0.0.45` alone is authorized for secure serving. Failed raw `0.0.42` remains permanently incomplete and unservable. Served raw `0.0.44` remains immutable until a separately controlled serving action.

## Scope and boundaries

This was an independent read-back, policy-gate, browser-regression, pack, and exact detached-topology reproduction audit. I read the repository README, active `2026-09-02` plan, real-map trajectory diagnosis, `docs/raw-0.0.45-builder.md`, failed `0.0.42` evidence, prior `0.0.44` release audit, release-pack policy diagnoses, and Beads `xa0p` / `cbh4`. Builder values were treated only as leads and recomputed.

No canonical raw or predecessor byte was changed, removed, rebuilt, or edited. Duplicate rejection and the sole audit rebuild occurred only in a disposable detached 15-repository sibling topology. Only that disposable topology's tracked raw `0.0.45` was removed before one base-`/` rebuild. No version command, canonical `build-release`, serving/process/route change, tag, GitHub Release, npm publication, public route, or physical approval/playability claim occurred.

## Commit, tree, and append-only history

- Release commit/tree independently resolve to `992d0bb132b69b03ee25d22503b363df2bd5ce3f` / `965f3e968070e352c2f8fd45e2a6077bbd5d3c1c`; its sole parent is exact authorized audit authority `8a2de834270eedca29527c860e0ee9943f1981f9`.
- The parent has no `release/raw/0.0.45`; the path has exactly one reachable history touch and no containing tag.
- Raw subtree `7f956672151127aceb748891ac4861f825cdb699` is identical at the release commit and evidence tip; their raw diff is empty.
- The release commit adds exactly the 39 raw files and changes only four version authorities outside raw: `package.json`, the top-level and root-package `package-lock.json` versions, `index.html`, and the `xa0p` / `0.0.45` assertion in `scripts/validate-shared-hash-provenance.js`. Every version changed exactly `0.0.44 → 0.0.45`.

## Canonical raw identity

Independent filesystem enumeration, Git-object reads, proof parsing, SHA-256 aggregation, and mode checks produced:

- regular files: `39`
- total bytes: `28,222,754`
- artifact bytes before proof: `28,219,922`
- proof bytes: `2,832`
- proof SHA-256: `86f5ae56b027452adad0d4d6062560a3d6c0eeb84d44bedf7bf44ba2c56ce57d`
- source fingerprint: `4bab436b79590716668ed50b22c5cf4dc880ce33e2965e92e12fbb4972020150` across `207` inputs
- path-order aggregate: `67a9bb31b3b46f08cd54493616fe3066c8593c0ca459abd8170d312958188fa6`
- globally line-sorted complete-manifest aggregate: `87bd5cd6a86484f553a4fcf6060b92aa258c0210a7abe84f9c7fd5b359bec055`
- relative path/SHA-256 manifest identity used for exact rebuild comparison: `13547ad75f8911264a41b257c97c492096d9fb74c5b7f0aff43a7390c308ae52`
- all Git modes: `100644`; every current filesystem file is non-executable

Category totals:

| Category | Files | Bytes |
|---|---:|---:|
| proof | 1 | 2,832 |
| JavaScript | 3 | 4,414,907 |
| source maps | 2 | 7,380,380 |
| environments | 24 | 16,013,893 |
| gameplay GLBs | 7 | 408,912 |
| CSS | 1 | 1,303 |
| HTML | 1 | 527 |

The parsed proof independently confirms version `0.0.45`, package `@aerobeat/web-assembly`, raw/unminified/base `/`, zero WASM, three JavaScript assets, two source maps, exact shared-hash ownership by `assets/index.js` and `assets/conversion-worker-C-m--G1i.js`, MediaPipe CPU-WASM Worker / `VideoFrame` / measured gameplay / 15fps posture, and `totalArtifactBytesBeforeManifest = 28,219,922`.

Exact proof provenance rows matched clean local and public `origin/main` authorities:

| Package | Commit | Tree |
|---|---|---|
| `@aerobeat/web-hash` | `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` | `b423c6742c07f56dde196d9f60f2e23c51ad913c` |
| `@aerobeat/web-vendor-beatsaver` | `d5d9afccfed1138b267e6e876a6e6e7f8d813d1a` | `92c3864f010e37d8e2c7c42f8c455c74052820f8` |
| `@aerobeat/web-content-authoring` | `8db847e21369f77ce9e1abf3c08a5474fc4a8af6` | `942ae1b7bbbf5b8ae2834ff452afd207904a8a90` |
| `@aerobeat/web-content` | `cce1ee215d428358863798c00459054c54898ce4` | `cd3808b595397dcc52deaed612fdba1a30a9a74d` |
| `@aerobeat/web-audio` | `19fd3a91eb67712806a17e4c82e2631d63f72434` | `9bd3418296d8fbdbfe72669958087f50a3302675` |
| `@aerobeat/web-renderer` | `cbf91252d9e1b6b76d3b4dad558e5235338b9b63` | `43bd4ab8f464ac1d795366c59c6c5e79b0412ee0` |
| `@aerobeat/web-gameplay` | `2ba22596398c9ef36a555ef5240b802ea02cc437` | `1970855fa2828ea607bb913760e9a39adc3263fe` |

`node scripts/validate-shared-hash-provenance.js` returned the same fingerprint and `207` inputs after checking exact local commit/tree, clean status, SSH origin identity, `origin/main`, and public remote main. `node scripts/validate-production-hash-bundle.js` validated three scripts and two deduplicated maps with exact main/conversion-Worker ownership. `npm ls --all` exited zero with the intended linked local package graph; reported unmet entries are package-manager optional dependencies only.

## Predecessors and served release

- `node scripts/validate-immutable-raw-snapshot.js` passed all `20` committed releases through `0.0.45`, including exact trees, counts, bytes, modes, proof hashes, fingerprints, and aggregates.
- `node scripts/validate-immutable-raw-mutations.js` rejected disposable one-byte proof mutations for `0.0.37`–`0.0.41`, `0.0.43`, `0.0.44`, and `0.0.45`, then cleaned its worktree.
- Permanently failed raw `0.0.42` independently remains exactly `38` files / `28,197,018` bytes, no proof, no executable files, path aggregate `4f5d94e0fc1bdc6af6489cc233462e336909e35948732223f9c14e17caf1ff66`, and complete aggregate `0c8c44c705293923daa0b2ae6c18c381e8bbb4661e5add7b8668c6c1aa1cc687`. Its exact categories remain JavaScript `3 / 4,405,181`, maps `2 / 7,367,202`, environments `24 / 16,013,893`, gameplay GLBs `7 / 408,912`, CSS `1 / 1,303`, HTML `1 / 527`, proof `0 / 0`.
- Served raw `0.0.44` remains subtree `691aca00aae5ec23b5004b6df70c49ac9364fd9e`, `39` files / `28,219,166` bytes. PID `4050453` remains the same `python3 -m http.server` process bound only to `127.0.0.1:5173` with exact directory `release/raw/0.0.44`. HTTP proof SHA-256 remains `26ce02f790178d6604a651f13239b29e428bfb3926523671e96e0676ca3bc01e` and parses as version `0.0.44`, fingerprint `677825e1daa5405ac0418efa496bd8352b1d03822d466fb1e5417e428ab4ec19`, base `/`.

## Duplicate rejection and exact detached reproduction

A disposable exact sibling root contained detached worktrees for assembly plus all 14 linked runtime package repositories. Assembly used release commit `992d0bb132b69b03ee25d22503b363df2bd5ce3f`; the seven proof authorities used their exact pinned commits/trees; the remaining siblings used the exact source identities already included by the `207`-input fingerprint. Complete local dependency installations were copied into the disposable topology without changing tracked source.

1. With disposable tracked raw `0.0.45` present, `AEROBEAT_BASE_PATH=/ npm run build-release` exited `1` with `Raw release target already exists and is immutable` before any Vite transform marker. Its complete relative manifest remained `13547ad75f8911264a41b257c97c492096d9fb74c5b7f0aff43a7390c308ae52`, `39` files, and `28,222,754` bytes before and after.
2. Only disposable `release/raw/0.0.45` was removed.
3. The exact base-`/` release command ran once, transformed `1,319` modules, and exited `0`.
4. `diff -qr`, per-path SHA-256 comparison, and direct proof comparison matched every canonical path and byte. Canonical and rebuild identities were both `39` files / `28,222,754` bytes / relative manifest `13547ad75f8911264a41b257c97c492096d9fb74c5b7f0aff43a7390c308ae52` / proof `86f5ae56b027452adad0d4d6062560a3d6c0eeb84d44bedf7bf44ba2c56ce57d`.
5. All 15 disposable siblings remained Git-clean. The guarded trap removed the complete topology, and independent post-check confirmed both temporary roots and their Git worktree registrations are absent.

## Exact real-map regression

`npm run test:exact-3c9d-browser` exited `0`. It verified fixture `89,424` bytes / SHA-256 `4db5b3393a389c7bcaba6d7a02aec57c10801bcfd74de91523b8e9cdad859b55` through real browser Worker conversion, IndexedDB reload, downloaded selection, trusted Test, controls, and seeks.

- Exact obstacle/pixel/AABB matrix: direct and genuine cross-origin iframe, five variants each (`10` rows).
- Exact trajectory matrix: direct desktop, genuine iframe desktop, direct mobile, genuine iframe mobile (`4` rows).
- Every trajectory row produced default timestamps `[18400,17500,17500]`, extreme timestamps `[16800,8000,0]`, package `ab-songpkg-dance-dance-revolution-ddrmix-5662f64a12c7-hard`, and exact landing `(0.5,0,0)`.

This exercises the real failure class recorded for immutable `0.0.44`, where all trajectory timestamps were null and default/extreme samples were identical.

## Release target and pack policy

`npm run test:release-pack-policy` passed release-target atomic claim/existing/concurrent duplicate rejection and complete bounded pack adversaries: pinned npm process-group liveness, independently derived metadata authority, lifecycle/environment isolation, canonical gzip/USTAR, strict membership/path/CLI grammar, Git/bin modes, exact bytes, and manifest identity.

An independent detached actual pack at the release commit normalized all `782` tracked files to `0644`. Dry and actual npm metadata matched. Strict verification produced:

- package `@aerobeat/web-assembly@0.0.45`
- `124` members, all `0644`, zero PAX
- `16,308,562` packed / `17,762,638` unpacked bytes
- SHA-1 `550a2581cbf366110a9706a13db21420541312b7`
- integrity `sha512-Mu5EJ3iigRPDsEw12nuuq3g5xAHiwPpK3QbpefXBAK2/6Ivwe3rEWSgZZTyC8kqlg1HVBGxIw2ZvvAUwvl/wbA==`
- archive SHA-256 `a840d6ffb48b53e72cf4f56e5df7129d5ece3c6546b697552a1b912b4c092c1b`
- decompressed tar SHA-256 `ab082e749e65c8f675afe727ba891c8a38fa9fc3578afa65310d0f845d42e351`
- internally derived metadata SHA-256 `6d3d28d5422fb86cfa323f4077465f6eb44c0d9d5e5fbe8b582791b203296771`
- manifest SHA-256 `1798d483aea9a08deda9b402681021b43e52c7324e87f6548924ad222759f794`

The detached worktree/output were removed and the canonical checkout remained unchanged except for protected Beads state and these audit documents.

## Final authorization

**PASS.** Close builder `xa0p` first, then auditor `cbh4`, and push Dolt state. Canonical raw `0.0.45` at release commit `992d0bb132b69b03ee25d22503b363df2bd5ce3f`, tree `965f3e968070e352c2f8fd45e2a6077bbd5d3c1c`, raw subtree `7f956672151127aceb748891ac4861f825cdb699`, is authorized for **secure serving only**.

This audit does not perform or authorize canonical rebuild/edit, a tag, GitHub Release, npm publication, public route, or physical approval/playability claim. Failed raw `0.0.42` remains permanently unservable. Currently served raw `0.0.44` and every predecessor remain immutable until a separately controlled serving change occurs.
