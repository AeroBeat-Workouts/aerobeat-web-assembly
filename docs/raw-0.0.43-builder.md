# Raw 0.0.43 immutable builder evidence

**Date:** 2026-09-07
**Bead:** `aerobeat-web-assembly-mjf4`
**Audit authority:** commit `1ec9a7db295c9701ab8bdba7628bda19ab7bc273`, tree `53c1c836a2f8de03edb31d45e02bb2a6d33f86ec`
**Release commit:** `2454719e7210536b394071def4a327342288af38`, tree `f32dfb394fb02e6ec5e4fb022d54bcf678f0203e`
**Disposition:** BUILDER PASS; leave `mjf4` open for independent audit `aerobeat-web-assembly-zoct`

## Boundaries and command counts

The builder claimed `mjf4`, preserved `.beads/interactions.jsonl`, and began from exact authorized `HEAD == origin/main` audit authority. `release/raw/0.0.43` was absent immediately before versioning and immediately before the canonical build. The release assertion advanced from `1uze` / `0.0.42` to `mjf4` / `0.0.43`.

The canonical version command count is exactly **1**:

```text
npm run version:patch
```

It advanced package, lock top-level, lock root-package, and HTML proof metadata exactly `0.0.42 → 0.0.43`.

The canonical destination build command count is exactly **1**:

```text
AEROBEAT_BASE_PATH=/ npm run build-release
```

It exited `0`. The created target was never rerun, deleted, rewritten, or edited. No serve, tag, GitHub Release, npm publication, or physical approval/claim occurred.

## Preflight and provenance

Before the destination build, full `npm test`, `npm run test:q7g-oracles`, `npm run test:release-pack-policy`, normal `npm run build`, dry pack, `npm run test:hash-provenance`, `npm ls --all`, immutable snapshot, and mutation rejection passed. The exact source fingerprint was `152671d9af8a564e4f79666f2214913b45f25f9a52a9e455f9aae11dcb4a92f8` across `207` inputs.

The proof binds exact dependency authorities:

- `@aerobeat/web-hash`: `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` / `b423c6742c07f56dde196d9f60f2e23c51ad913c`
- `@aerobeat/web-vendor-beatsaver`: `d5d9afccfed1138b267e6e876a6e6e7f8d813d1a` / `92c3864f010e37d8e2c7c42f8c455c74052820f8`
- `@aerobeat/web-content-authoring`: `8db847e21369f77ce9e1abf3c08a5474fc4a8af6` / `942ae1b7bbbf5b8ae2834ff452afd207904a8a90`
- `@aerobeat/web-content`: `de4917a3c7630b6666b64eeb7e60c1b98a486cc7` / `313dc33e83ed4711e20c01e01ef6f6b5e4aa4f89`
- `@aerobeat/web-audio`: `19fd3a91eb67712806a17e4c82e2631d63f72434` / `9bd3418296d8fbdbfe72669958087f50a3302675`
- `@aerobeat/web-renderer`: `6f554cd45c15cfda868196cd46e6147e72cb86e1` / `625a717235d7196dd99965cd87aca7d63fb39b18`
- `@aerobeat/web-gameplay`: `2ba22596398c9ef36a555ef5240b802ea02cc437` / `1970855fa2828ea607bb913760e9a39adc3263fe`

## Raw identity

Raw subtree: `62b9475ec079849cd285b3e788357fc88fb52b91`.

- `39` regular files, all Git mode `100644` and non-executable filesystem mode
- `28,199,850` total bytes; `28,197,018` artifact bytes plus `2,832` proof bytes
- proof SHA-256 `cb362e103db705ab0c3b7e9fc6666cafe8255a2d093acfd7a9a2dd5bc9b5f1c0`
- source fingerprint `152671d9af8a564e4f79666f2214913b45f25f9a52a9e455f9aae11dcb4a92f8` / `207`
- path-order aggregate `8fbacabca35041000ec2bbd8b14fb3acc2c38731469d8cdc91575df5980ec90d`
- globally line-sorted complete-manifest aggregate `bbbbb7a3e631bde42fba21b01fd1ba045bbdabf88d468c3c37a74e6fd111431b`
- categories: proof `1 / 2,832 B`; JavaScript `3 / 4,405,181 B`; source maps `2 / 7,367,202 B`; environments `24 / 16,013,893 B`; gameplay GLBs `7 / 408,912 B`; CSS `1 / 1,303 B`; HTML `1 / 527 B`

Proof read-back confirms raw/unminified/base `/`, zero WASM, three JavaScript assets, two maps, exact shared-hash ownership by main and `conversion-worker-C-m--G1i.js`, MediaPipe CPU-WASM Worker / VideoFrame / measured / 15fps posture, and all seven provenance rows.

## Preservation and immutable guards

All `17` committed predecessor raws through `0.0.41` passed their exact snapshot before and after the build. The intentionally ignored failed raw `0.0.42` matched its complete pre-build per-path size/SHA-256/mode snapshot after the build: `38` files / `28,197,018` bytes / no proof. Its documented path aggregate `4f5d94e0fc1bdc6af6489cc233462e336909e35948732223f9c14e17caf1ff66`, complete-manifest aggregate `0c8c44c705293923daa0b2ae6c18c381e8bbb4661e5add7b8668c6c1aa1cc687`, and category totals remain authoritative and unchanged.

The immutable snapshot now anchors raw `0.0.43` commit/tree/count/bytes/modes/proof/fingerprint/aggregates while deliberately skipping permanently failed untracked `0.0.42`. Disposable one-byte proof mutation rejection now includes `0.0.43` and preserves all canonical bytes.

## Pack evidence

A clean detached worktree at release commit `2454719e7210536b394071def4a327342288af38` was normalized from `694` tracked files to mode `0644`. Canonical dry and actual npm metadata matched; the strict canonical gzip/USTAR verifier passed:

- package `@aerobeat/web-assembly@0.0.43`
- `121` members, all `0644`, zero PAX
- `16,297,956` packed / `17,723,213` unpacked bytes
- SHA-1 `d6fff255988163b18194c2a68e8e3e5166a0ecbb`
- integrity `sha512-cTBy3omcOVIgYHbi0rCOWXfrSnJgWoWTtZC8SdHbA448W4/yZcQcQqQr5CRd2KrVyYb3TkVgBaL6CylpcstdQQ==`
- archive SHA-256 `74d358cbd4fca97704d759e7b662ad0bcb57040d6d1a3b42d861681d7f7151f8`
- decompressed tar SHA-256 `eba2ebae7f67f5a62dcbaaece608481c7df026d4781b2c9a361277c9cbe1319e`
- derived metadata SHA-256 `1e9c2713181f3e75484bf1c4222149a835dd44540c79d0415106bef8678c01f2`
- manifest SHA-256 `001cd61fafc0fc63868a19c64269a31c638eac1e0ac2808a6019117c5d8e01cb`

The disposable pack worktree and output were removed. This builder evidence authorizes no serving or publication; `zoct` remains the required independent release audit.
