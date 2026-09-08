# Gameplay asset 0.0.9 runtime integration

**Date:** 2026-09-08

**Bead:** `aerobeat-web-assembly-s661`

**Status:** CODER + independent `gk0x` QA PASS; pending `5qzs` audit

## Authorities

- Gameplay asset release commit/tree: `6c8f9e09037e880de55af265212533b64e5800ca` / `15b66a5916cc9b3bd441eff1d0063913aa6eb124`
- Gameplay asset final audit: `2f93b563e1363cf61e27d5e0b893b428b76dc569` / `f3d72488311e05f1070d1a78749cc8cd721e369e`
- Immutable gameplay raw 0.0.9 tree: `541b693eabc11c716adca84931015213055ebfe8`
- Inventory / proof: `95ec22c1657d4931e42327e0544b86f782075288a3330a4d23b0fed07dce65fa` / `e1726ca2bc3a0980cc86ba6184bf7da57079f7ee1e42e24094c47196a3dbace9`
- Renderer integration commit/tree: `258c9407213e703318578cf7d474658112c99036` / `1c9703e96507c63bec1a0743aa98843071740a0e`
- Runtime repair predecessor: `67bd21ee53b6e21e8525ae77cfc212db44613e45` / `89aad8422d324d69e44d32fd3a2bfae19caf96fb`

## Integration result

Renderer packages only the exact 17-file raw 0.0.9 payload and pins the audited release identity. Assembly copies that payload byte-for-byte from the exact renderer commit, emits only the seven GLBs under `assets/gameplay/0.0.9`, and rejects wrong renderer commits, dirty sources, drifted bytes, stale 0.0.8 membership, and unlisted payloads before package mutation. Mutable packaged 0.0.8 was removed from renderer and assembly; immutable gameplay-asset repository 0.0.8 and every web raw remain unchanged.

The asset-only change composes with the already audited presentation work: useful near-camera bounce, strict far-distance/sky trajectory JSON, full-height Boxing Lanes walls, configurable lane separation, song colors, fixed non-note colors, markers, lifecycle, privacy, and scoring contracts remain unchanged. Browser pixels report `assetRelease:"0.0.9"` in Flow, Boxing Lanes, and Boxing Grid across direct/genuine-iframe portrait/landscape DPR 1/3.

## Coder validation

- Renderer `npm test` and complete `npm run test:browser`: PASS.
- Renderer exact package: 40 files including 17 gameplay members.
- Assembly `npm test`: PASS, including exact sync/provenance and 18 immutable web release snapshots.
- Assembly `npm run build`: PASS, 1,319 modules and exact 0.0.9 seven-GLB output.
- Assembly release-target/pack policy: PASS.
- Assembly dry pack: 123 files, 16,302,038 packed / 17,739,088 unpacked bytes, SHA-1 `5117a547b20e439a11637f421319df230b2481f6`.
- Direct/genuine-iframe visual-correction, exact 3c9d AABB/pixels, product-shell, all-presentation Test pixels, environment, camera, cursor, privacy, lifecycle, and runtime trajectory gates: PASS.
- Exact packaged asset comparison: assembly 0.0.9 equals renderer tree `541b693eabc11c716adca84931015213055ebfe8` byte-for-byte.

## Orchestration incident

The first standalone integration child committed and pushed the renderer authority, then its run failed while assembly had only five partial pin/Vite edits. One permitted idempotent fallback advanced assembly to the exact 0.0.9 payload and sync scripts, then its run also failed without a report or process. Parent reconciliation found no active test/build process, preserved all safe partial work, independently completed the validation above, and did not retry either child again.

No immutable web build, version change, release mutation, serving change, tag, publication, or physical PASS is authorized by this coder evidence. Raw 0.0.43 remains the securely served immutable comparison target pending independent QA/audit and a later explicit successor authorization.

## Independent QA — PASS (`gk0x`, 2026-09-08)

- Independently verified exact pushed authorities: asset release `6c8f9e09037e880de55af265212533b64e5800ca` / `15b66a5916cc9b3bd441eff1d0063913aa6eb124`, asset final audit `2f93b563e1363cf61e27d5e0b893b428b76dc569` / `f3d72488311e05f1070d1a78749cc8cd721e369e`, renderer `258c9407213e703318578cf7d474658112c99036` / `1c9703e96507c63bec1a0743aa98843071740a0e`, and assembly product `dff830fb0c5d2cc0d61ed405eb30005ade8a9d3a` / `e3bdbd2353cb4aeaaad298f4b4da21b74239d908`. Release→audit, repaired-renderer→renderer-integration, and repaired-assembly→assembly-integration ancestry passed in their owning repositories.
- Recomputed the exact asset, renderer, and assembly gameplay subtree as `541b693eabc11c716adca84931015213055ebfe8`; all `17` paths compare byte-for-byte across all three repositories. Inventory/proof reproduce as `95ec22c1657d4931e42327e0544b86f782075288a3330a4d23b0fed07dce65fa` / `e1726ca2bc3a0980cc86ba6184bf7da57079f7ee1e42e24094c47196a3dbace9`, and renderer/assembly contain only mutable gameplay `0.0.9` with no stale `0.0.8` payload. The other six GLBs are byte-identical to immutable asset `0.0.8`; only the directional arrow differs.
- Pin/sync/provenance inspection and execution passed. Renderer accepts only the exact clean audit authority descending from the release and checks source/current raw trees, inventory, proof, set, material contracts, exact membership and bytes. Assembly checks the exact linked renderer commit/tree, clean source, symlink identity, raw tree, hashes, membership and bytes before atomic promotion. Maintained provenance fixtures reject non-authority/non-descendant and dirty sources; additional disposable probes reject packaged-byte drift and stale-`0.0.8`-only membership. No canonical payload was mutated by hostile testing.
- Renderer `npm test`, complete browser matrix, actual pixels, and dry pack passed. Direct and genuine cross-origin iframe portrait/landscape DPR `1/3` rows loaded seven canonical GLBs with `assetRelease:"0.0.9"`, zero normal fallback, correct direction rotations, opaque charcoal/white/fill band contrast, private song-color fill tint with structural whites unchanged, fixed non-note colors, context/lifecycle recovery, and no browser/WebGL noise. Bounce pixels remained useful near camera at `(Z,Y,count) = (-12,2,300), (-7.2,2.9,597), (-3,2.59375,1384), (0,2,3764)` with static shadow `Y=-0.702`. Dry pack contained `40` files including exactly `17` gameplay members, `158,787` packed / `652,920` unpacked bytes, SHA-1 `8a715409633f2e99463174eec5d3ee269351e932`.
- Strict presentation JSON independently round-tripped both exact defaults (`4/.9/.4`, normal distance `15`, sky off, separation `2.7`) and maximum accepted values (`8/1.5/.85`, distance `72`, prelude `24/10000`, separation `4`); maximum apex is exactly `1.5`, hit offset exactly zero, and sky offset joins from `24` to exactly zero. Hostile objects/accessors/Proxies/clones/cross-realm values reject without inspection. Runtime source implementing bounce/sky/distance/separation did not change in this asset-only integration.
- Assembly `npm test`, mutable `npm run build` (`1,319` modules), release-target/pack policy, and dry pack passed. The build emitted only seven gameplay GLBs under `dist/assets/gameplay/0.0.9`. Dry pack exactly matched `123` files, `16,302,038` packed / `17,739,088` unpacked bytes, SHA-1 `5117a547b20e439a11637f421319df230b2481f6`.
- Focused direct/genuine-iframe authoring, mobile, product-shell, all-presentation Visual Test, visual-correction, exact-`3c9d`, hostile privacy, terminal lifecycle, session trajectory and offline obstacle gates all exited zero. Exact `3c9d` direct/iframe Boxing Lanes walls retain one body plus one shadow, no static duplicates, separation-consistent placement, and AABB min `(0.5000000153,-0.4699999891,-0.1500000060)`, max `(2.2000000324,2.4699999891,0)`, size `(1.7000000171,2.9399999782,0.1500000060)` for both row and cut families. Lane width, intervals, scoring, privacy, song tint and all non-note exclusions remain exact.
- Immutable gameplay `0.0.8` remains raw/review trees `e26ec4e8278860c60568bd2a89983cd09555ee75` / `df080ea57c99bb50697f14e891edad7f53dbda2a`. Assembly's immutable-snapshot gate reproduced all `18` web raw authorities, including raw `0.0.43` subtree `62b9475ec079849cd285b3e788357fc88fb52b91`. PID `2133101` remains the same loopback-only `127.0.0.1:5173` process serving exactly `release/raw/0.0.43`; `/` still returns `0.0.43`. Pre-existing `.beads/interactions.jsonl` dirt remains preserved.
- Disposition: independent integration QA PASS. No source fix, `build-release`, version, immutable release/raw, tag, publication, or serving/process/route change occurred. Close only `gk0x`; leave `s661` open for final `5qzs` audit and the later explicit release decision. Derrick's physical default-tuning authority remains reserved.
