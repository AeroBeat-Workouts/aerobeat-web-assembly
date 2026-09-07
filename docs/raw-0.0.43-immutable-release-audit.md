# Raw 0.0.43 immutable release audit

**Date:** 2026-09-07

**Builder Bead:** `aerobeat-web-assembly-mjf4`

**Audit Bead:** `aerobeat-web-assembly-zoct`

**Release commit/tree:** `2454719e7210536b394071def4a327342288af38` / `f32dfb394fb02e6ec5e4fb022d54bcf678f0203e`

**Builder-evidence tip before audit:** `1c28b0b5fd539e80ea2d7dcb5e19dd5449cca41f` / tree `437e378ef94d76e55b2a722947dd3ae8fdb56035`
**Disposition:** PASS; canonical raw `0.0.43` alone is authorized for secure serving; raw `0.0.42` remains permanently failed and unservable

## Scope and boundaries

This was an independent read-back and reproduction audit. I read the repository README, the complete active plan through its raw `0.0.43` builder result, `docs/raw-0.0.42-builder-failure.md`, `docs/raw-0.0.43-builder.md`, the release-target, release-pack, fingerprint/provenance, immutable-snapshot, and immutable-mutation policies, and Beads `mjf4` and `zoct`. Builder statements were treated as leads and recomputed.

No canonical raw `0.0.42` or `0.0.43` byte was changed or rebuilt. No version command, canonical release command, tag, GitHub Release, npm publication, server/listener/Tailscale change, or physical approval/claim occurred. Only this audit document and the active plan are intended for the audit commit; the pre-existing `.beads/interactions.jsonl` modification remains preserved and excluded.

## Commit, tree, and append-only history

- Release commit and tree independently resolve exactly to `2454719e7210536b394071def4a327342288af38` / `f32dfb394fb02e6ec5e4fb022d54bcf678f0203e`.
- Its parent is the exact authorized audit commit `1ec9a7db295c9701ab8bdba7628bda19ab7bc273`.
- Raw subtree `release/raw/0.0.43` resolves to `62b9475ec079849cd285b3e788357fc88fb52b91`.
- The path is absent at the release parent, has exactly one reachable history touch, and no tag contains the release commit.
- The release commit adds the 39 raw files and changes only `package.json`, top-level/root-package `package-lock.json`, `index.html`, and the `mjf4` version assertion in `scripts/validate-shared-hash-provenance.js` outside raw. Because failed `0.0.42` version state was intentionally uncommitted, the Git parent-to-release diff reads `0.0.41 → 0.0.43`; direct builder evidence records the worktree command transition `0.0.42 → 0.0.43`.
- The evidence tip changes only the active plan, builder evidence, and the immutable snapshot/mutation guards.

## Canonical raw 0.0.43 identity

Independent filesystem bytes, Git objects, proof parsing, and manifest hashing produced:

- tree: `62b9475ec079849cd285b3e788357fc88fb52b91`
- regular files: `39`
- total bytes: `28,199,850`
- artifact bytes before proof: `28,197,018`
- proof bytes: `2,832`
- proof SHA-256: `cb362e103db705ab0c3b7e9fc6666cafe8255a2d093acfd7a9a2dd5bc9b5f1c0`
- source fingerprint: `152671d9af8a564e4f79666f2214913b45f25f9a52a9e455f9aae11dcb4a92f8` across `207` inputs
- path-order aggregate: `8fbacabca35041000ec2bbd8b14fb3acc2c38731469d8cdc91575df5980ec90d`
- globally line-sorted complete-manifest aggregate: `bbbbb7a3e631bde42fba21b01fd1ba045bbdabf88d468c3c37a74e6fd111431b`
- all Git modes: `100644`; all current filesystem files are non-executable (current checkout permission `0600`)

Category totals:

| Category | Files | Bytes |
|---|---:|---:|
| proof | 1 | 2,832 |
| JavaScript | 3 | 4,405,181 |
| source maps | 2 | 7,367,202 |
| environments | 24 | 16,013,893 |
| gameplay GLBs | 7 | 408,912 |
| CSS | 1 | 1,303 |
| HTML | 1 | 527 |

The parsed proof binds raw/unminified output, base `/`, no WASM, three JavaScript assets, two source maps, exact shared-hash ownership by `assets/index.js` and `assets/conversion-worker-C-m--G1i.js`, and MediaPipe CPU-WASM Worker / `VideoFrame` / measured gameplay / 15fps posture.

Exact proof provenance rows reproduced:

| Package | Commit | Tree |
|---|---|---|
| `@aerobeat/web-hash` | `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` | `b423c6742c07f56dde196d9f60f2e23c51ad913c` |
| `@aerobeat/web-vendor-beatsaver` | `d5d9afccfed1138b267e6e876a6e6e7f8d813d1a` | `92c3864f010e37d8e2c7c42f8c455c74052820f8` |
| `@aerobeat/web-content-authoring` | `8db847e21369f77ce9e1abf3c08a5474fc4a8af6` | `942ae1b7bbbf5b8ae2834ff452afd207904a8a90` |
| `@aerobeat/web-content` | `de4917a3c7630b6666b64eeb7e60c1b98a486cc7` | `313dc33e83ed4711e20c01e01ef6f6b5e4aa4f89` |
| `@aerobeat/web-audio` | `19fd3a91eb67712806a17e4c82e2631d63f72434` | `9bd3418296d8fbdbfe72669958087f50a3302675` |
| `@aerobeat/web-renderer` | `6f554cd45c15cfda868196cd46e6147e72cb86e1` | `625a717235d7196dd99965cd87aca7d63fb39b18` |
| `@aerobeat/web-gameplay` | `2ba22596398c9ef36a555ef5240b802ea02cc437` | `1970855fa2828ea607bb913760e9a39adc3263fe` |

`npm run test:hash-provenance` independently returned the same fingerprint and 207-input count, then validated three scripts/two maps with exact main and conversion-Worker ownership.

## Predecessor preservation

`node scripts/validate-immutable-raw-snapshot.js` validated all 18 committed raw releases. The requested locked range remains:

| Raw | Tree | Files | Bytes | Proof SHA-256 | Source fingerprint | Path aggregate | Complete aggregate |
|---|---|---:|---:|---|---|---|---|
| 0.0.35 | `bd69d3bd309660125d1a5ac3da6d07896c49bb96` | 20 | 13,878,153 | `22c41e8bf0630bb6b50523a96ab0e886b399a93c74a7d1e97bb2afe47a43c4ea` | `5f1c0f0efe8eb897b77c5cb694995552cfdf1e463b4b0c24db0f128b4ccc9884` | `2813c92008df8a05f0854a1781fb6233bbfba9b3f843dc1652a07343c46c6df2` | `a111efba87a4b46502b04a34c3ff0ca102815f090a20fba7cf4ccf29d2d21951` |
| 0.0.36 | `ce125ba4a596f7d6cad84c9e3bf983c5ccf0ed77` | 41 | 27,760,611 | `3d18dd99afe99fcac389bccee760073baf83cc44c66cdec6d0ac5d933d142daf` | `34e0e2b1365d8a37303df622250dd005f3a149b1a78b35ce13a42974f58ca261` | `7ae94c2c1a2bd9191e43657b413ad403b5bbff550d35923e80fd73be17f14401` | `575fb3515aeca10f5a88ea06db4b2c2003b4506d2c70e520e6f8533a9ea97595` |
| 0.0.37 | `6d2b8c4e39d3677f28e48ad076bc6259abcd47b9` | 41 | 27,820,403 | `9415f1ee7f9ddc687b4756be84e5a2bec9dfa9521eb5ec8f6c6ddc5b9ee286f9` | `c09983b7420cae205eb72c61af2eeba005b1a51b5a9492e5a9e08e7cf4bb5698` | `6d76f01ce5cb2d39e967289421ec4b52e8589c87d2b43100a828d76dae422985` | `5994c06810b832fb8987e66269cb199a434a8bd5a4f575212ee6d33d4ff7bd50` |
| 0.0.38 | `9c4225c83b8697a6404190bddcbfcbee0a5d60f3` | 41 | 27,834,715 | `86f08597e4c17d0191d1ba7fb70225c8188c21c0cbc7ffa21b32cb2cef2b6041` | `03288323640ec1c52105dd26f9c20dd51c723c454a9ef5481603dc93d53893c3` | `f633b5a75641511c8d889ce7146086872c5d968a81af9788ca060f10844673f8` | `87698cb3fee11308b45904fde4726c04ebed06863296c64151d03d89fc7e75aa` |
| 0.0.39 | `799c9b346f1e1bffc96bf8e0cd01d8edd5e33928` | 41 | 27,979,912 | `a7687d39d0447b65f786c4de947d2c645a010e078cd976690cc2f8998415417d` | `84cbbaa7445a24095dccc21af2c5f504840d136891798577739696101e1a879a` | `6d117d6d5c8185c9e694d5e5ef3ffbc88efa382cfe75f2c49a0ded16a9821059` | `d700c4d055c2a5d11e52c6fb59e1cb7b270bec8cb4b1f4a949821ea912dab59d` |
| 0.0.40 | `7e73b56e512ff877f17dc44a0bc8a19fd2104987` | 39 | 27,494,704 | `cce82e47d1c00f7f2ef49e095c414c2079cf564254f3d7e1d34267d024e73af3` | `8c54e22f7371f4708f53903ec31aaf65deda2211c7388bef149d11054b356da0` | `7e4335f1939995efc80d2f851b76117ff52dae7840cee94c6cfcfc49a1219412` | `16084c9fa23645b6fff7392b35198602b093790de46b1967f2f9cb50860a5db3` |
| 0.0.41 | `0b5f7841ef65779d84f028a544724a6d76cd06a1` | 39 | 27,517,598 | `8640745a387bf510c762a3d62e80b1e3a095386d3857f24c7e561f8614f9c76c` | `7223e39d36699bed09fa91bb85b2486d9a402e53196912beb872e27081d45142` | `c195eb31cc98def1b89f0e32d2fc82271690d34b9f4eea3d9cbc0cca9a6533fc` | `ca12f99cdac2332d81891a0856755dcffe351bc3c46f618b55c7e5e4dc24fdfc` |

`node scripts/validate-immutable-raw-mutations.js` rejected one-byte proof mutations for `0.0.37`–`0.0.41` and `0.0.43` in a disposable worktree and cleaned it.

## Permanently failed raw 0.0.42

Independent hashing reproduced exactly `38` files / `28,197,018` bytes, no proof, path-order aggregate `4f5d94e0fc1bdc6af6489cc233462e336909e35948732223f9c14e17caf1ff66`, and complete-manifest aggregate `0c8c44c705293923daa0b2ae6c18c381e8bbb4661e5add7b8668c6c1aa1cc687`. All files are non-executable. Categories remain JavaScript `3 / 4,405,181 B`; maps `2 / 7,367,202 B`; environments `24 / 16,013,893 B`; gameplay GLBs `7 / 408,912 B`; CSS `1 / 1,303 B`; HTML `1 / 527 B`; proof `0 / 0 B`.

This directory was read only. It remains incomplete, invalid, immutable, and unservable; it must not be deleted, completed, rebuilt, edited, tagged, published, or served.

## Duplicate-target rejection and exact reproduction

A disposable sibling root contained clean detached clones of assembly plus all 14 local package siblings, with every pinned release dependency at its exact commit/tree and all nested package installs completed offline under Node `v22.22.3` / npm `10.9.8`.

1. With disposable tracked `release/raw/0.0.43` present, `AEROBEAT_BASE_PATH=/ npm run build-release` exited `1` with `Raw release target already exists and is immutable`. No Vite transform marker appeared, and the complete target manifest SHA-256 remained `f728e1dd1828eb86aaea8d149961b41131f7e22601c5d244533000ded3568089` before/after. This proves duplicate rejection occurs before build.
2. Only the disposable tracked raw `0.0.43` directory was removed.
3. The exact command `AEROBEAT_BASE_PATH=/ npm run build-release` was run once in that qualifying topology. Vite transformed 1,319 modules, exited `0`, and reported artifact bytes `28,197,018`.
4. A complete path-sorted SHA-256 manifest and `diff -qr` compared every reproduced path and byte to canonical. Result: exact match, `39` files / `28,199,850` bytes, proof SHA-256 `cb362e103db705ab0c3b7e9fc6666cafe8255a2d093acfd7a9a2dd5bc9b5f1c0`, complete path/byte manifest SHA-256 `f728e1dd1828eb86aaea8d149961b41131f7e22601c5d244533000ded3568089`.
5. Every sibling remained Git-clean and exact. The disposable root was removed and verified absent.

An earlier disposable harness setup was also removed and verified absent after exposing a setup defect: nested sibling package installs had not been materialized, so Vite stopped after 112 modules while resolving `@aerobeat/web-contracts/note-palette-contracts`. It produced no qualifying release and never touched canonical state. The corrected full topology above is the single successful qualifying reproduction.

## Release and pack policy

- `npm run test:release-pack-policy` passed release-target append-only behavior and the complete bounded npm-process, internal metadata authority, lifecycle/environment isolation, canonical gzip/USTAR, strict membership/path/CLI grammar, Git/bin mode, exact-byte, and manifest policy matrix.
- An independent detached actual pack at the release commit normalized all `694` tracked files to `0644`; strict verification passed `121` USTAR members, all `0644`, zero PAX.
- npm identity: `@aerobeat/web-assembly@0.0.43`; packed `16,297,956`; unpacked `17,723,213`; SHA-1 `d6fff255988163b18194c2a68e8e3e5166a0ecbb`; integrity `sha512-cTBy3omcOVIgYHbi0rCOWXfrSnJgWoWTtZC8SdHbA448W4/yZcQcQqQr5CRd2KrVyYb3TkVgBaL6CylpcstdQQ==`.
- Archive SHA-256 `74d358cbd4fca97704d759e7b662ad0bcb57040d6d1a3b42d861681d7f7151f8`; decompressed tar SHA-256 `eba2ebae7f67f5a62dcbaaece608481c7df026d4781b2c9a361277c9cbe1319e`; derived metadata SHA-256 `1e9c2713181f3e75484bf1c4222149a835dd44540c79d0415106bef8678c01f2`; manifest SHA-256 `001cd61fafc0fc63868a19c64269a31c638eac1e0ac2808a6019117c5d8e01cb`.
- Pack worktree/output were removed and verified absent.

## Final authorization

**PASS.** Close builder `mjf4` first, then auditor `zoct`, and push Dolt state. Canonical `release/raw/0.0.43` at release commit `2454719e7210536b394071def4a327342288af38` is authorized for **secure serving only**. This is not authorization to modify the canonical raw, rebuild it, tag it, publish it to npm, create a GitHub Release, alter any server, or claim physical approval. Raw `0.0.42` remains permanently failed and unservable, and every older raw remains immutable comparison evidence under its existing disposition.
