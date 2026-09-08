# Raw 0.0.44 immutable builder evidence

**Date:** 2026-09-08
**Bead:** `aerobeat-web-assembly-5yyg`
**Audit authority:** commit `258747ff252014fdddba53bcff1ac43248a3ae51`, tree `ea6c7b740ff9d954ee6de7daa49186d42e2a89a7`
**Release commit:** `d581aace7a508057d0351532a01066036bf777c9`, tree `9175556033da7c89c04e001988395ef9299f3c22`
**Disposition:** BUILDER PASS; leave `5yyg` open for independent audit `aerobeat-web-assembly-aloj`

## Boundaries and command counts

The builder claimed `5yyg`, preserved protected `.beads/interactions.jsonl` dirt, and began from exact authorized `HEAD == origin/main` audit authority. `release/raw/0.0.44` was absent before versioning and again immediately before the canonical build. The release assertion advanced from `mjf4` / `0.0.43` to `5yyg` / `0.0.44`.

The canonical version command count was exactly **1**:

```text
npm run version:patch
```

It advanced package, lock top-level, lock root-package, and HTML proof metadata exactly `0.0.43 → 0.0.44`.

The canonical destination build command count was exactly **1**:

```text
AEROBEAT_BASE_PATH=/ npm run build-release
```

It transformed exactly `1,319` modules, exited `0`, and created the target once. The target was never rerun, deleted, rewritten, or edited. No serve, tag, GitHub Release, npm publication, physical approval, physical claim, PID, listener, or route change occurred.

## Preflight and exact authority

Before the destination build, `npm test`, `npm run test:q7g-oracles`, `npm run test:release-pack-policy`, normal `npm run build`, `npm run test:hash-provenance`, `npm ls --all`, immutable predecessor snapshots, and disposable mutation rejection passed. All linked dependency repositories were clean at their pinned commits/trees; provenance additionally verified synchronized public `origin/main` and remote identities. The exact final source fingerprint was `677825e1daa5405ac0418efa496bd8352b1d03822d466fb1e5417e428ab4ec19` across `207` inputs.

The proof binds these exact dependency authorities:

- `@aerobeat/web-hash`: `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` / `b423c6742c07f56dde196d9f60f2e23c51ad913c`
- `@aerobeat/web-vendor-beatsaver`: `d5d9afccfed1138b267e6e876a6e6e7f8d813d1a` / `92c3864f010e37d8e2c7c42f8c455c74052820f8`
- `@aerobeat/web-content-authoring`: `8db847e21369f77ce9e1abf3c08a5474fc4a8af6` / `942ae1b7bbbf5b8ae2834ff452afd207904a8a90`
- `@aerobeat/web-content`: `de4917a3c7630b6666b64eeb7e60c1b98a486cc7` / `313dc33e83ed4711e20c01e01ef6f6b5e4aa4f89`
- `@aerobeat/web-audio`: `19fd3a91eb67712806a17e4c82e2631d63f72434` / `9bd3418296d8fbdbfe72669958087f50a3302675`
- `@aerobeat/web-renderer`: `258c9407213e703318578cf7d474658112c99036` / `1c9703e96507c63bec1a0743aa98843071740a0e`
- `@aerobeat/web-gameplay`: `2ba22596398c9ef36a555ef5240b802ea02cc437` / `1970855fa2828ea607bb913760e9a39adc3263fe`

## Canonical raw identity

Raw subtree: `691aca00aae5ec23b5004b6df70c49ac9364fd9e`.

- `39` regular files, all Git mode `100644` and non-executable filesystem mode
- `28,219,166` total bytes; `28,216,334` artifact bytes plus `2,832` proof bytes
- proof SHA-256 `26ce02f790178d6604a651f13239b29e428bfb3926523671e96e0676ca3bc01e`
- source fingerprint `677825e1daa5405ac0418efa496bd8352b1d03822d466fb1e5417e428ab4ec19` / `207`
- path-order aggregate `d5f2927841711cc90350a54a405423a5a574c4e31abb0d374da0cefe4af841fb`
- globally line-sorted complete-manifest aggregate `b9f6a1055b129af8dddc9d34ca66e3d334cd47d592b04c4e8975cec991b58e5a`
- categories: proof `1 / 2,832 B`; JavaScript `3 / 4,413,413 B`; source maps `2 / 7,378,286 B`; environments `24 / 16,013,893 B`; gameplay GLBs `7 / 408,912 B`; CSS `1 / 1,303 B`; HTML `1 / 527 B`

Proof read-back confirms raw/unminified/base `/`, zero WASM, three JavaScript assets, two maps, exact shared-hash ownership by main and `conversion-worker-C-m--G1i.js`, MediaPipe CPU-WASM Worker / `VideoFrame` / measured / 15fps posture, and all seven exact provenance rows.

## Pack evidence

A clean detached worktree at release commit `d581aace7a508057d0351532a01066036bf777c9` was normalized from `739` tracked files to mode `0644`. Canonical dry and actual npm metadata matched, and the strict canonical gzip/USTAR verifier passed:

- package `@aerobeat/web-assembly@0.0.44`
- `123` members, all `0644`, zero PAX
- `16,301,918` packed / `17,739,088` unpacked bytes
- SHA-1 `813ac325f589b8ee744d4ca63fc415b8ba3158a7`
- integrity `sha512-vpube8sMZqZCH+Vhtahd+XGhZ+EfIT1Dj3fyHqmWcrLrx2QWOo/jFmbVGH4L1Lr3zlbol5rqZw2xZYQPNvYlLA==`
- archive SHA-256 `9bd1f5b016483de517a3350b2bdbb26e6853effd7947aae877f1b9cb36815f9c`
- decompressed tar SHA-256 `df5feb247fee2847314de856ace7ed3facf2c00a55a2525f1b8592642b4f035c`
- derived metadata SHA-256 `30b73e58f4a9bac008f1bc47500b4a0e1fc6d18f6de4fbc4bd70d6f39abd74d7`
- manifest SHA-256 `f82dd5d41aac09f4ff58d39462768ebe2374bc2625bd046dc7264e7fdbaf474e`

The disposable pack worktree/output were removed.

## Preservation and immutable guards

All `18` committed predecessor raws through `0.0.43` passed their exact snapshot before and after the build. Permanently failed raw `0.0.42` remains exactly `38` files / `28,197,018` bytes with no proof. Served raw `0.0.43` remains subtree `62b9475ec079849cd285b3e788357fc88fb52b91`, exactly `39` files / `28,199,850` bytes. PID `2133101` remains the same loopback-only `127.0.0.1:5173` process serving only `release/raw/0.0.43`; `/` still returns that unchanged target.

The immutable snapshot now anchors raw `0.0.44` commit/tree/count/bytes/modes/proof/fingerprint/aggregates while deliberately skipping permanently failed untracked `0.0.42`. Disposable one-byte proof mutation rejection now includes `0.0.44` and preserves all canonical bytes. This builder evidence authorizes no serving or publication; `aloj` remains the required independent release audit.
