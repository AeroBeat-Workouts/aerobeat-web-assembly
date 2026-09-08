# Raw 0.0.44 immutable release audit

**Date:** 2026-09-08

**Builder Bead:** `aerobeat-web-assembly-5yyg`

**Audit Bead:** `aerobeat-web-assembly-aloj`

**Release commit/tree:** `d581aace7a508057d0351532a01066036bf777c9` / `9175556033da7c89c04e001988395ef9299f3c22`

**Builder-evidence tip before audit:** `1bdc680cb0f746772ced68cea8878ae9d3c76e83` / tree `82338f66ab6ca9fa64ff7152d90c0b9520b4454c`

**Raw subtree:** `691aca00aae5ec23b5004b6df70c49ac9364fd9e`

**Disposition:** PASS; canonical raw `0.0.44` alone is authorized for secure serving; failed raw `0.0.42` remains permanently incomplete and unservable; served raw `0.0.43` remains immutable until a separately authorized serving change occurs

## Scope and boundaries

This was an independent read-back and reproduction audit. I read the repository README, the active `2026-09-02` plan, `docs/raw-0.0.44-builder.md`, the release-target, release-pack, fingerprint/provenance, immutable-snapshot, and immutable-mutation policies, and Beads `5yyg` and `aloj`. Builder statements were treated only as leads and all reported release identities were recomputed.

No canonical raw `0.0.44` or predecessor byte was changed, removed, rebuilt, or edited. The only release build ran in a disposable detached sibling topology after removing only that topology's raw `0.0.44`. No version command, canonical release command, tag, GitHub Release, npm publication, server/listener/route change, or physical approval/claim occurred. The documentation correction relocates the builder result from the old `2026-08-28` plan into the active `2026-09-02` plan without changing the section text or the old plan's historical content.

## Commit, tree, and append-only history

- Release commit and tree independently resolve to `d581aace7a508057d0351532a01066036bf777c9` / `9175556033da7c89c04e001988395ef9299f3c22`.
- Its sole parent is the exact authorized source-audit commit `258747ff252014fdddba53bcff1ac43248a3ae51`.
- Raw subtree `release/raw/0.0.44` resolves to `691aca00aae5ec23b5004b6df70c49ac9364fd9e` at both the release commit and evidence tip.
- The raw path is absent at the release parent, has exactly one reachable history touch, and no tag contains the release commit.
- The release commit adds exactly the 39 raw files and changes only the four version authorities outside raw: `package.json`, top-level/root-package records in `package-lock.json`, `index.html`, and the `5yyg` assertion in `scripts/validate-shared-hash-provenance.js`.
- The pre-audit evidence tip is exactly `1bdc680cb0f746772ced68cea8878ae9d3c76e83` / tree `82338f66ab6ca9fa64ff7152d90c0b9520b4454c`; the raw subtree is byte-identical from release commit through that tip.

## Canonical raw 0.0.44 identity

Independent filesystem enumeration, Git-object checks, proof parsing, and SHA-256 aggregation produced:

- regular files: `39`
- total bytes: `28,219,166`
- artifact bytes before proof: `28,216,334`
- proof bytes: `2,832`
- proof SHA-256: `26ce02f790178d6604a651f13239b29e428bfb3926523671e96e0676ca3bc01e`
- source fingerprint: `677825e1daa5405ac0418efa496bd8352b1d03822d466fb1e5417e428ab4ec19` across `207` inputs
- path-order aggregate: `d5f2927841711cc90350a54a405423a5a574c4e31abb0d374da0cefe4af841fb`
- globally line-sorted complete-manifest aggregate: `b9f6a1055b129af8dddc9d34ca66e3d334cd47d592b04c4e8975cec991b58e5a`
- all Git modes: `100644`; all current filesystem files are non-executable (current checkout permission `0600`)

Category totals:

| Category | Files | Bytes |
|---|---:|---:|
| proof | 1 | 2,832 |
| JavaScript | 3 | 4,413,413 |
| source maps | 2 | 7,378,286 |
| environments | 24 | 16,013,893 |
| gameplay GLBs | 7 | 408,912 |
| CSS | 1 | 1,303 |
| HTML | 1 | 527 |

The parsed proof binds raw/unminified output, base `/`, zero WASM, three JavaScript assets, two source maps, exact shared-hash ownership by `assets/index.js` and `assets/conversion-worker-C-m--G1i.js`, and MediaPipe CPU-WASM Worker / `VideoFrame` / measured gameplay / 15fps posture. `totalArtifactBytesBeforeManifest` is exactly `28,216,334`.

Exact proof provenance rows independently matched clean sibling Git identities:

| Package | Commit | Tree |
|---|---|---|
| `@aerobeat/web-hash` | `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` | `b423c6742c07f56dde196d9f60f2e23c51ad913c` |
| `@aerobeat/web-vendor-beatsaver` | `d5d9afccfed1138b267e6e876a6e6e7f8d813d1a` | `92c3864f010e37d8e2c7c42f8c455c74052820f8` |
| `@aerobeat/web-content-authoring` | `8db847e21369f77ce9e1abf3c08a5474fc4a8af6` | `942ae1b7bbbf5b8ae2834ff452afd207904a8a90` |
| `@aerobeat/web-content` | `de4917a3c7630b6666b64eeb7e60c1b98a486cc7` | `313dc33e83ed4711e20c01e01ef6f6b5e4aa4f89` |
| `@aerobeat/web-audio` | `19fd3a91eb67712806a17e4c82e2631d63f72434` | `9bd3418296d8fbdbfe72669958087f50a3302675` |
| `@aerobeat/web-renderer` | `258c9407213e703318578cf7d474658112c99036` | `1c9703e96507c63bec1a0743aa98843071740a0e` |
| `@aerobeat/web-gameplay` | `2ba22596398c9ef36a555ef5240b802ea02cc437` | `1970855fa2828ea607bb913760e9a39adc3263fe` |

`node scripts/validate-shared-hash-provenance.js` independently returned the same fingerprint and 207-input count. `node scripts/validate-production-hash-bundle.js` validated three scripts/two deduplicated maps with exact main and conversion-Worker ownership.

## Predecessor and serving preservation

`node scripts/validate-immutable-raw-snapshot.js` validated all 19 committed raw releases and exact working bytes/modes against their anchored Git objects. `node scripts/validate-immutable-raw-mutations.js` rejected one-byte proof mutations for `0.0.37` through `0.0.41`, `0.0.43`, and `0.0.44` in disposable worktrees and cleaned them.

The permanently failed raw `0.0.42` was read independently and remains exactly `38` files / `28,197,018` bytes with no proof. Its path-order aggregate is `4f5d94e0fc1bdc6af6489cc233462e336909e35948732223f9c14e17caf1ff66`; its complete-manifest aggregate is `0c8c44c705293923daa0b2ae6c18c381e8bbb4661e5add7b8668c6c1aa1cc687`; every file remains non-executable (`0600`). It remains incomplete, invalid, immutable, and unservable.

Served raw `0.0.43` remains exact subtree `62b9475ec079849cd285b3e788357fc88fb52b91`, `39` files / `28,199,850` bytes, path aggregate `8fbacabca35041000ec2bbd8b14fb3acc2c38731469d8cdc91575df5980ec90d`, and complete aggregate `bbbbb7a3e631bde42fba21b01fd1ba045bbdabf88d468c3c37a74e6fd111431b`. PID `2133101` remains the same loopback-only `python3 -m http.server` bound to `127.0.0.1:5173` with exact directory `release/raw/0.0.43`; HTTP proof read-back still reports `0.0.43`, fingerprint `152671d9af8a564e4f79666f2214913b45f25f9a52a9e455f9aae11dcb4a92f8`, and base `/`.

## Duplicate-target rejection and exact reproduction

A disposable sibling root contained clean detached clones of assembly plus all 14 local package siblings. Assembly was detached at the exact release commit; all seven proof-pinned repositories matched their exact commit/tree; complete local dependency installations were copied into the disposable topology without changing tracked source.

1. With disposable tracked raw `0.0.44` present, `AEROBEAT_BASE_PATH=/ npm run build-release` exited `1` with `Raw release target already exists and is immutable` before any Vite build marker. Its complete relative path/byte manifest remained `69bd26df23e9fb80a5b108da3a335a5d0cd16fd4e14dbd13308be64ac99a961b`, `39` files, and `28,219,166` bytes before and after.
2. Only disposable `release/raw/0.0.44` was removed.
3. The exact command `AEROBEAT_BASE_PATH=/ npm run build-release` ran once. Vite transformed `1,319` modules, exited `0`, and reported artifact bytes `28,216,334`.
4. `diff -qr` and a complete path-sorted SHA-256 manifest compared every reproduced path and byte with canonical. Both were exactly `69bd26df23e9fb80a5b108da3a335a5d0cd16fd4e14dbd13308be64ac99a961b`, `39` files, and `28,219,166` bytes. The proof and all aggregate/category identities therefore match canonical exactly.
5. Every disposable sibling remained Git-clean. The complete disposable root was removed by the guarded cleanup trap.

## Release and pack policy

- `node scripts/validate-release-target-policy.js` passed atomic absent-target claiming, existing-target and concurrent duplicate rejection, claim-before-build ordering, no target deletion APIs, and canonical byte preservation.
- `npm run test:release-pack-policy` passed the bounded npm-process, internal metadata authority, lifecycle/environment isolation, canonical gzip/USTAR, strict membership/path/CLI grammar, Git/bin mode, exact-byte, and manifest policy matrix.
- An independent detached actual pack at the release commit normalized all `739` tracked files to `0644`. Strict verification passed `123` USTAR members, all `0644`, with zero PAX.
- npm identity: `@aerobeat/web-assembly@0.0.44`; packed `16,301,918`; unpacked `17,739,088`; SHA-1 `813ac325f589b8ee744d4ca63fc415b8ba3158a7`; integrity `sha512-vpube8sMZqZCH+Vhtahd+XGhZ+EfIT1Dj3fyHqmWcrLrx2QWOo/jFmbVGH4L1Lr3zlbol5rqZw2xZYQPNvYlLA==`.
- Archive SHA-256 `9bd1f5b016483de517a3350b2bdbb26e6853effd7947aae877f1b9cb36815f9c`; decompressed tar SHA-256 `df5feb247fee2847314de856ace7ed3facf2c00a55a2525f1b8592642b4f035c`; internally derived metadata SHA-256 `30b73e58f4a9bac008f1bc47500b4a0e1fc6d18f6de4fbc4bd70d6f39abd74d7`; manifest SHA-256 `f82dd5d41aac09f4ff58d39462768ebe2374bc2625bd046dc7264e7fdbaf474e`.
- The detached pack worktree and output were removed by the guarded cleanup trap.

## Final authorization

**PASS.** Close builder `5yyg` first, then auditor `aloj`, and push Dolt state. Canonical `release/raw/0.0.44` at release commit `d581aace7a508057d0351532a01066036bf777c9`, raw subtree `691aca00aae5ec23b5004b6df70c49ac9364fd9e`, is authorized for **secure serving only**. This is not authorization to modify or rebuild the canonical raw, create a tag or GitHub Release, publish to npm, alter a server/process/route within this audit, or claim physical approval/playability. Failed raw `0.0.42` remains permanently unservable; currently served raw `0.0.43` and every older raw remain immutable under their existing dispositions until a separately authorized serving action occurs.
