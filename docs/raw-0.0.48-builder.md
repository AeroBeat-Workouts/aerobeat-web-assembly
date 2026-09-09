# Raw 0.0.48 immutable builder evidence

**Date:** 2026-09-09
**Bead:** `aerobeat-web-assembly-ancv`
**Authorization audits:** `aerobeat-web-assembly-xtaw`, `aerobeat-web-assembly-ofi1`
**Disposition:** BUILDER PASS; leave `ancv` open for independent audit/serve Bead `aerobeat-web-assembly-ok0v`

## Fail-closed preflight

Before the irreversible command, assembly `HEAD == origin/main == 1ea0d275d43ba93cd672ee6d90f28953996b5779`; its sole dirt was the protected unstaged `.beads/interactions.jsonl` record with exact porcelain bytes `204d202e62656164732f696e746572616374696f6e732e6a736f6e6c00`. Package, lock root, lock package, and HTML authorities were exactly `0.0.47`; `release/raw/0.0.48` was absent. The immutable snapshot validator reproduced all 22 recorded raw releases beginning at `0.0.24`, and the mutation validator rejected disposable one-byte proof mutations through `0.0.47`.

The exact dependency status policy, append-only target policy, and shared-hash provenance gate passed without stash, reset, or clean. The production-source authority was fingerprint `7a097c9b7096b1cc6bab3ea0b2d972d88914566e72461fb5092ebe26869f31a3` over `212` inputs. Exact dependency commit/tree rows were:

- hash `be7249b0bdfffcab568b760c1b582bfe2a0c1e92` / `b423c6742c07f56dde196d9f60f2e23c51ad913c`
- BeatSaver vendor `5866f8e418e4a0ef11362f9e6c80ebc5a2ad3c3a` / `997e8a476ab9ff04f0197cfa203091c58c865772`
- content authoring `bfcd5206e54ac110b8cd44b65986b510abbd6ee1` / `81a3a991e71a292811eb890d43b1051ca6110152`
- content `260eb8051c5cd1abeb821d13519fbad9d876fffd` / `4ed35ad220427920776153734b3f52d67fcdbaa9`
- audio `19fd3a91eb67712806a17e4c82e2631d63f72434` / `9bd3418296d8fbdbfe72669958087f50a3302675`
- renderer `bd8ad9ebfe2107b11ffc5373e1c0f86349167b09` / `18c75a883979c2f76b56a76a9eca54f2dcea4360`
- gameplay `2ba22596398c9ef36a555ef5240b802ea02cc437` / `1970855fa2828ea607bb913760e9a39adc3263fe`
- input `f724672d5a431c455d7061e4f7f07effe25aaa2d` / `29e7a3b6647216275b8eae50fec7585041878041`

## One-shot build

Only `package.json`, `package-lock.json`, and `index.html` advanced from `0.0.47` to `0.0.48`. As expected for these fingerprint inputs, that metadata-only version advance changed the fingerprint to `7cfbf9ccb7da96016fc6cda1a3de736ba2167ef152bf41807902bc27c6511101` while retaining exactly `212` inputs and the audited dependency rows above.

The canonical command `npm run build:release` was invoked exactly once. It exited `0`, transformed `1,324` modules, claimed the absent append-only target, emitted the proof, and reported `28,434,676` artifact bytes before proof. The builder was never rerun. No raw file was edited, deleted, overwritten, or normalized after generation, and no alternate candidate was created.

## Canonical identity and inventory

- release introduction commit: `6b90860bc9363c36b669b9494375eb8af6b5bc29`
- raw tree: `cce1523b5e7ce5584aab4330d9d931daea5e6ffa`
- inventory: `39` regular files, all mode `100644`
- total bytes: `28,437,675`
- artifact bytes before proof: `28,434,676`
- proof bytes: `2,999`
- proof SHA-256: `79ffc77ed0f1ae4cb4428cbb8cab297abe3aab89de16fd9a46e4d07f5076db6e`
- proof/source fingerprint: `7cfbf9ccb7da96016fc6cda1a3de736ba2167ef152bf41807902bc27c6511101` over `212` inputs
- path-order aggregate: `0ff7e3d4d33896b1bb7b941e6a15f0fba735202c767d4c7d54b49e8f496b5e41`
- globally line-sorted complete-manifest aggregate: `fe3a8b1315e9001d381c06a4129262a770682b2e3e69d334286af92b42614184`

The inventory is proof `1`, JavaScript `3`, source maps `2`, environment assets/config/manifests `24`, gameplay GLBs `7`, CSS `1`, and HTML `1`. Gameplay assets are exclusively immutable `0.0.10`; the wall is `2,316` bytes with SHA-256 `6a336116709c2f3c1d92453fe1b3a2821e03d31128dae72d0fc700627fa94cd7`.

Proof read-back confirms version `0.0.48`, raw/unminified artifact kind, base `/`, eight exact dependency rows, three runtime JavaScript assets, two deduplicated source maps, shared hash attribution in `assets/index.js` and `assets/conversion-worker-CKy18nBK.js`, and zero WASM. Filename/runtime guards exclude MoveNet, ONNX/ORT, TensorFlow, pose-detection, predictive, and the other locked forbidden markers.

## Validation and boundaries

After the release introduction commit, `npm test` exited `0`; the immutable snapshot anchor covered 23 releases through exact raw `0.0.48`, disposable proof mutation rejection extended through `0.0.48`, package/environment/gameplay/fingerprint/provenance gates passed, and release target rejection remained append-only. `npm run test:release-pack-policy` exited `0`, including bounded npm process-group behavior, independently derived pinned npm authority, canonical gzip/USTAR, inventory/mode/byte identity, and strict CLI/path policy. Full `npm run test:browser` exited `0`, including direct/genuine-iframe viewport/DPR matrices, photospheres, gameplay `0.0.10`, walls, cursor/grid/visual-correction pixels, exact `3c9d`, trajectories, and the live marker oracle selecting `32` CSS px.

The browser validators do not expose a raw-release-version override or `release/raw` target, so the required full gate validates the exact committed `0.0.48` source/dependency graph rather than claiming a separate raw-serving mode. Exact non-raw `git diff --check` from the authorized base passed. A deliberately broad check reports pre-existing generated shader whitespace inside immutable `assets/index.js`; those raw bytes were preserved rather than altered. No prior raw `0.0.24`–`0.0.47` path differs from the authorized base, and Git records exactly one commit introducing `release/raw/0.0.48`.

No serving switch, private/public route change, package publication, Git tag, GitHub Release, history rewrite, second build, dependency edit, gameplay asset builder, or `tools/build_uniform_wall_release.py` invocation occurred. Derrick physical PASS is not claimed.
