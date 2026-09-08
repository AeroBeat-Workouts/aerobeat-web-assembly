# Gameplay asset 0.0.9 runtime integration

**Date:** 2026-09-08

**Bead:** `aerobeat-web-assembly-s661`

**Status:** CODER PASS; pending independent `gk0x` QA and `5qzs` audit

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
