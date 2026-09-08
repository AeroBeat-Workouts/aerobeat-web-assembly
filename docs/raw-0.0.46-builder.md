# Raw 0.0.46 immutable builder evidence

**Date:** 2026-09-08
**Bead:** `aerobeat-web-assembly-lev0`
**Source authorization:** `01a082de-8b79-7b15-be99-ef5e0a9b98ba`
**Build authorization:** `01a082de-d0d9-7d08-8808-5a9994dde928`
**Audit authority:** commit `4052f05bba67a3b1480536bd4d984cd67c35ac1c`, tree `af86c5510e066bc252335d0bab55594a2029e464`
**Disposition:** BUILDER PASS; leave `lev0` open for independent audit `aerobeat-web-assembly-wgr2`

## Fail-closed preflight

Before either irreversible command, `HEAD == origin/main == 4052f05bba67a3b1480536bd4d984cd67c35ac1c`; the only worktree dirt was protected `.beads/interactions.jsonl`; package, lock top-level, lock root-package, and HTML proof metadata were exactly `0.0.45`; `release/raw/0.0.46` was absent. The immutable snapshot validated all 20 committed raws, including exact raw `0.0.35–0.0.45` predecessor identities. Gameplay and environment synchronization passed, and the release-target policy passed without claiming the absent target.

Exact clean pinned provenance was:

- hash `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` / `b423c6742c07f56dde196d9f60f2e23c51ad913c`
- BeatSaver vendor `d5d9afccfed1138b267e6e876a6e6e7f8d813d1a` / `92c3864f010e37d8e2c7c42f8c455c74052820f8`
- content authoring `8db847e21369f77ce9e1abf3c08a5474fc4a8af6` / `942ae1b7bbbf5b8ae2834ff452afd207904a8a90`
- content `cef38e6bf9ae4591a8f106c48a65ad346febb3f5` / `91de549f95f9c7e7b4c6da3de405a2d7fc9c40f3`
- audio `19fd3a91eb67712806a17e4c82e2631d63f72434` / `9bd3418296d8fbdbfe72669958087f50a3302675`
- renderer `2b2d71bebf4bc3575385058d553c9e30f8782201` / `e11cde7a10e9d048846e7e12241b64f1928aa860`
- gameplay runtime `2ba22596398c9ef36a555ef5240b802ea02cc437` / `1970855fa2828ea607bb913760e9a39adc3263fe`

Pre-version source fingerprint was `86e3c71ba87f7354c3c3d9c0aeb5d78f2e80506d68b7cb184751f2229b44e138` over `208` inputs. Gameplay package verification bound renderer `2b2d71b` and immutable gameplay release raw tree `0209faccacbd7a3157d32d198ac753e861731d41`, exactly 17 package files.

## One-shot command consumption

`npm run version:patch` was invoked exactly once and exited `0`. Exact stdout was:

```text
> @aerobeat/web-assembly@0.0.45 version:patch
> node scripts/bump-patch-version.js

AeroBeat web assembly version bumped to 0.0.46
```

Post-bump validation proved only `index.html`, `package.json`, and `package-lock.json` changed, all four metadata authorities became `0.0.46`, and the target remained absent.

`npm run build:release` was invoked exactly once and exited `0`. It called the package alias and then `node scripts/build-release.js`, transformed exactly `1,320` modules, built in `1.36s`, and ended with:

```text
Raw 0.0.46 MediaPipe-only release proof created at /home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/release/raw/0.0.46
Artifact bytes before manifest: 28245079
```

The only stderr was the existing three Vite browser-externalization warnings for PlayCanvas imports of `node:worker_threads` from Draco, gsplat, and unified-gsplat worker sources. The command was not rerun. Generated raw bytes were never edited, deleted, overwritten, or rebuilt.

## Canonical raw identity and inventory

- raw tree: `90d6b0640087dba82b787c4111fdb024a85b253b`
- complete inventory: `39` regular files, all non-executable / Git mode `100644`
- total bytes: `28,247,911`
- artifact bytes before proof: `28,245,079`
- proof bytes: `2,832`
- proof SHA-256: `083df3fb347abdb9eaa68d188621225c6c99e821cfa071a0639f0f7a654c633d`
- source fingerprint: `3b17f29ccb8e0870d50004b9757f50ecc346d926650eab3ff6716f7f9e497e25` over `208` inputs
- path-order aggregate: `70a0222c3ee494449cd86ff789fbd009d198d2dfdedbfb57790516499546d872`
- globally line-sorted complete-manifest aggregate: `9f882267f68f99f8fc66a238c07c7183c97db74991e3a992b9e580621ab02489`

The complete inventory consists of proof `1`, JavaScript `3`, source maps `2`, environment assets/config/manifests `24`, gameplay GLBs `7`, CSS `1`, and HTML `1`. The seven gameplay files are exclusively under `assets/gameplay/0.0.10/`: outlined circle, marker sphere, urchin bomb, rounded outlined arrow, outlined shield, blue-glass track, and red-glass wall. The wall is exactly `2,316` bytes / SHA-256 `6a336116709c2f3c1d92453fe1b3a2821e03d31128dae72d0fc700627fa94cd7`.

Proof read-back confirms version `0.0.46`, raw/unminified artifact kind, base `/`, exact seven provenance rows, three runtime JavaScript assets, two source maps, shared hash source in both main and conversion Worker, and zero runtime WASM. Filename and assembled-runtime guards found no MoveNet, ONNX/ORT, TensorFlow, pose-detection, predictive, or other forbidden vendor marker.

## Validation and anchors

The immutable snapshot anchor is extended append-only from release commit `992d0bb132b69b03ee25d22503b363df2bd5ce3f` for raw `0.0.45` to the exact raw `0.0.46` tree/count/bytes/proof/fingerprint/aggregates above. The predecessor list and every existing exact assertion remain intact. Disposable mutation rejection is extended to include `0.0.46` while retaining every predecessor probe.

The first post-build `npm test` stopped at the intended release-anchor maintenance point: `validate-shared-hash-provenance.js` still required predecessor builder `xa0p` / version `0.0.45`. That assertion alone was advanced to `lev0` / `0.0.46`; no production or generated raw byte changed. The unchanged complete rerun then passed. `npm run test:release-pack-policy`, the 21-release immutable snapshot, and disposable mutation rejection through `0.0.46` also passed. The expected existing-target rejection in release-target policy is validation only and does not invoke the npm `build:release` script. No gameplay asset builder, serve, route switch, tag, publication, GitHub Release, or physical-PASS action is authorized or performed.
