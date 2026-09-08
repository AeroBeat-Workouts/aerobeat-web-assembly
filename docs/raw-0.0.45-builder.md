# Raw 0.0.45 immutable builder evidence

**Date:** 2026-09-08
**Bead:** `aerobeat-web-assembly-xa0p`
**Audit authority:** commit `8a2de834270eedca29527c860e0ee9943f1981f9`, tree `444a506cd9984df54d709b9a0cf51006c0a04d40`
**Release commit:** `992d0bb132b69b03ee25d22503b363df2bd5ce3f`, tree `965f3e968070e352c2f8fd45e2a6077bbd5d3c1c`
**Disposition:** BUILDER PASS; leave `xa0p` open for independent audit `aerobeat-web-assembly-cbh4`

## Boundaries and command counts

The builder claimed `xa0p`, preserved protected `.beads/interactions.jsonl` dirt, and began from exact authorized `HEAD == origin/main` audit authority. `release/raw/0.0.45` was absent before versioning and again immediately before the canonical build. The release assertion advanced from `5yyg` / `0.0.44` to `xa0p` / `0.0.45`.

The canonical version command count was exactly **1**:

```text
npm run version:patch
```

It advanced package, lock top-level, lock root-package, and HTML proof metadata exactly `0.0.44 → 0.0.45`.

The canonical destination build command count was exactly **1**:

```text
AEROBEAT_BASE_PATH=/ npm run build-release
```

It transformed exactly `1,319` modules, exited `0`, and created the target once. The target was never rerun, deleted, rewritten, or edited. No serve, tag, GitHub Release, npm publication, physical approval, physical claim, PID, listener, or route change occurred.

## Preflight and exact authority

Before the destination build, `npm test`, `npm run test:exact-3c9d-browser`, `npm run test:release-pack-policy`, normal `npm run build`, `npm run test:hash-provenance`, `npm ls --all`, immutable predecessor snapshots, and disposable mutation rejection passed. The exact real-`3c9d` gate used fixture `89,424` bytes / SHA-256 `4db5b3393a389c7bcaba6d7a02aec57c10801bcfd74de91523b8e9cdad859b55` and passed all four direct/genuine-iframe desktop/mobile trajectory rows with default timestamps `[18400,17500,17500]`, extreme timestamps `[16800,8000,0]`, and landing `(0.5,0,0)`.

All linked dependency repositories were clean at their pinned commits/trees; provenance additionally verified synchronized public `origin/main` and remote identities. The exact final source fingerprint is `4bab436b79590716668ed50b22c5cf4dc880ce33e2965e92e12fbb4972020150` across `207` inputs.

The proof binds these exact dependency authorities:

- `@aerobeat/web-hash`: `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` / `b423c6742c07f56dde196d9f60f2e23c51ad913c`
- `@aerobeat/web-vendor-beatsaver`: `d5d9afccfed1138b267e6e876a6e6e7f8d813d1a` / `92c3864f010e37d8e2c7c42f8c455c74052820f8`
- `@aerobeat/web-content-authoring`: `8db847e21369f77ce9e1abf3c08a5474fc4a8af6` / `942ae1b7bbbf5b8ae2834ff452afd207904a8a90`
- `@aerobeat/web-content`: `cce1ee215d428358863798c00459054c54898ce4` / `cd3808b595397dcc52deaed612fdba1a30a9a74d`
- `@aerobeat/web-audio`: `19fd3a91eb67712806a17e4c82e2631d63f72434` / `9bd3418296d8fbdbfe72669958087f50a3302675`
- `@aerobeat/web-renderer`: `cbf91252d9e1b6b76d3b4dad558e5235338b9b63` / `43bd4ab8f464ac1d795366c59c6c5e79b0412ee0`
- `@aerobeat/web-gameplay`: `2ba22596398c9ef36a555ef5240b802ea02cc437` / `1970855fa2828ea607bb913760e9a39adc3263fe`

## Canonical raw identity

Raw subtree: `7f956672151127aceb748891ac4861f825cdb699`.

- `39` regular files, all Git mode `100644` and non-executable filesystem mode
- `28,222,754` total bytes; `28,219,922` artifact bytes plus `2,832` proof bytes
- proof SHA-256 `86f5ae56b027452adad0d4d6062560a3d6c0eeb84d44bedf7bf44ba2c56ce57d`
- source fingerprint `4bab436b79590716668ed50b22c5cf4dc880ce33e2965e92e12fbb4972020150` / `207`
- path-order aggregate `67a9bb31b3b46f08cd54493616fe3066c8593c0ca459abd8170d312958188fa6`
- globally line-sorted complete-manifest aggregate `87bd5cd6a86484f553a4fcf6060b92aa258c0210a7abe84f9c7fd5b359bec055`
- categories: proof `1 / 2,832 B`; JavaScript `3 / 4,414,907 B`; source maps `2 / 7,380,380 B`; environments `24 / 16,013,893 B`; gameplay GLBs `7 / 408,912 B`; CSS `1 / 1,303 B`; HTML `1 / 527 B`

Proof read-back confirms raw/unminified/base `/`, zero WASM, three JavaScript assets, two maps, exact shared-hash ownership by main and `conversion-worker-C-m--G1i.js`, MediaPipe CPU-WASM Worker / `VideoFrame` / measured / 15fps posture, and all seven exact provenance rows.

## Pack evidence

A clean detached worktree at release commit `992d0bb132b69b03ee25d22503b363df2bd5ce3f` was normalized from `782` tracked files to mode `0644`. Canonical dry and actual npm metadata matched, and the strict canonical gzip/USTAR verifier passed:

- package `@aerobeat/web-assembly@0.0.45`
- `124` members, all `0644`, zero PAX
- `16,308,562` packed / `17,762,638` unpacked bytes
- SHA-1 `550a2581cbf366110a9706a13db21420541312b7`
- integrity `sha512-Mu5EJ3iigRPDsEw12nuuq3g5xAHiwPpK3QbpefXBAK2/6Ivwe3rEWSgZZTyC8kqlg1HVBGxIw2ZvvAUwvl/wbA==`
- archive SHA-256 `a840d6ffb48b53e72cf4f56e5df7129d5ece3c6546b697552a1b912b4c092c1b`
- decompressed tar SHA-256 `ab082e749e65c8f675afe727ba891c8a38fa9fc3578afa65310d0f845d42e351`
- derived metadata SHA-256 `6d3d28d5422fb86cfa323f4077465f6eb44c0d9d5e5fbe8b582791b203296771`
- manifest SHA-256 `1798d483aea9a08deda9b402681021b43e52c7324e87f6548924ad222759f794`

The disposable pack worktree/output were removed.

## Preservation and immutable guards

All `19` committed predecessor raws through `0.0.44` passed their exact snapshot before and after the build. Permanently failed raw `0.0.42` remains exactly `38` files / `28,197,018` bytes with no proof. Served raw `0.0.44` remains subtree `691aca00aae5ec23b5004b6df70c49ac9364fd9e`, exactly `39` files / `28,219,166` bytes. PID `4050453` remains the same loopback-only `127.0.0.1:5173` process serving only `release/raw/0.0.44`; HTTP proof SHA-256 remains `26ce02f790178d6604a651f13239b29e428bfb3926523671e96e0676ca3bc01e`.

The immutable snapshot now anchors raw `0.0.45` release commit/tree/count/bytes/modes/proof/fingerprint/aggregates while deliberately skipping permanently failed untracked `0.0.42`. Disposable one-byte proof mutation rejection now includes `0.0.45` and preserves all canonical bytes. This builder evidence authorizes no serving or publication; `cbh4` remains the required independent release audit.
