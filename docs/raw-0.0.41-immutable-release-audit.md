# Immutable raw 0.0.41 independent release audit

**Date:** 2026-09-06  
**Bead:** `aerobeat-web-assembly-4bd`  
**Verdict:** PASS  
**Authorization:** Only the exact raw tree/proof bytes identified below are authorized for secure tailnet physical review. This is not publication, tag, GitHub Release, npm publication, physical-device approval, or Bug-profile PASS.

## Authority and boundaries

The audit read the repository README, the complete 1,219-line active plan, all three DB7 debug reports, release/target/pack/fingerprint/immutable policies, prior raw 0.0.40 audit evidence, Beads `4bd`, `0of`, and `k72.17`, and the release commit itself. Builder summaries were treated as leads only. No product/runtime source, immutable raw release, persistent server, Tailscale/Funnel route, port 5173, port 8444, tag, publication, Release, or physical/Bug claim was changed.

## Exact Git and raw-byte identity

Release commit `d895b40776dcd5b8d1b67ab2e5cf5621013e5c7d` has parent `b0b8becf1aae8c705fab915f4206babc8df1e8b9`, commit tree `d1a3ee3f9afe550eedcc62b36beebcd51fa09735`, and raw subtree `0b5f7841ef65779d84f028a544724a6d76cd06a1`. `release/raw/0.0.41` is absent at the parent. Full-history path inspection returns only the release commit as a touch. The three reachable commits containing the path resolve the same subtree; no alternate reachable 0.0.41 bytes exist. The release commit adds the 39 raw files and changes only the four expected version/provenance authorities outside raw.

Independent Git-object/filesystem enumeration produced:

- 39 regular files; all Git mode `100644`; every current filesystem file is non-executable (this checkout materializes them as `0600`, while detached pack normalization correctly derives `0644` from Git)
- 27,517,598 total bytes; 27,514,766 artifact bytes plus the 2,832-byte proof
- proof SHA-256 `8640745a387bf510c762a3d62e80b1e3a095386d3857f24c7e561f8614f9c76c`
- source fingerprint `7223e39d36699bed09fa91bb85b2486d9a402e53196912beb872e27081d45142` across exactly 202 inputs
- path-order aggregate `c195eb31cc98def1b89f0e32d2fc82271690d34b9f4eea3d9cbc0cca9a6533fc`
- globally sorted complete-manifest aggregate `ca12f99cdac2332d81891a0856755dcffe351bc3c46f618b55c7e5e4dc24fdfc`
- categories: proof 1/2,832 B; JS 3/4,284,343 B; maps 2/7,182,372 B; environments 24/16,013,893 B; gameplay GLBs 7/32,328 B; CSS 1/1,303 B; HTML 1/527 B

The proof coherently binds raw/unminified/base `/`, zero WASM, three JS assets, two complete maps, MediaPipe CPU-WASM Worker/VideoFrame/measured/15fps production posture, forbidden-runtime checks, and all seven exact clean dependency commit/tree pins. `npm ls --all` reported no problems. Independent fingerprint recomputation matched the proof.

`node scripts/validate-immutable-raw-snapshot.js` passed all 17 locked releases. Raw 0.0.35–0.0.40 matched exact pinned tree/count/byte/proof identities before, at, and after the release commit. `node scripts/validate-immutable-raw-mutations.js` independently rejected a one-byte proof mutation for each of 0.0.37–0.0.41 in a disposable worktree and restored/removed it.

Live read-only checks found no local/remote 0.0.41 tag, no GitHub Release, and npm returned 404 for `@aerobeat/web-assembly@0.0.41`. Port 5173 remained offline. The existing tailnet-only 8443 proxy-to-5173 and 8444 DSH route/listener were observed but untouched; Funnel status showed no public route.

## Independent reproduction and pack

A disposable full 15-repository sibling topology was created at `/tmp/aerobeat-4bd-topology-MV4Sa4`; assembly alone was detached at exact release commit `d895b40`, every sibling was detached at the exact clean release input identity, and every repository received an offline lifecycle-disabled install. Only the disposable clone's tracked `release/raw/0.0.41` directory was removed. `AEROBEAT_BASE_PATH=/ npm run build-release` then transformed 1,314 modules and recreated 27,514,766 pre-proof bytes. All 39 paths and every byte, including the proof, matched canonical raw exactly.

The canonical pack policy normalized the detached target from 647 Git `100644` entries to filesystem `0644`. Two independent dry/actual npm packs were produced and verified. The archives and manifests byte-matched each other and had:

- archive SHA-256 `054c12625ee88bf08ecb96c43fa41522d167824c6258fe6e5038b7b598a385fa`
- decompressed tar SHA-256 `4d6c14d9922b80b355752211dd74cba86c590378dea152ff3c5e7469290973d7`
- internally derived metadata SHA-256 `7e305a55ee019f9cab34236d1155708f4ebf2e4581f154e3dc72fc7c85de5ad7`
- manifest SHA-256 `06419b1d89b7fdd389c40036f664c3562a9728d4362d033d290d40357b3849dc`
- 121 ordered regular USTAR members, all mode `0644`, zero PAX
- 16,199,896 packed / 17,241,729 unpacked bytes
- SHA-1 `1bdb8eb13aa9fd308807c6ccec5accf9e86cd12d`
- integrity `sha512-ZQPRqHBJIpAStWNEjUYJBc+CvdS9oIjmPlocFLu6Oj2f7NxwxHsmUO4NOaVlz/vX9Au6Zdi7+gW0MBSQn+J6ZQ==`

## Exact raw browser migration

An ephemeral loopback-only HTTP server served canonical raw 0.0.40 and then canonical raw 0.0.41 at one unchanged origin; it was stopped in `finally` after Chromium closed. Before raw 0.0.40 loaded, the browser was seeded with an exact DB5 package/collection shape carrying `flowObstacleContract: source_geometry_v1`, package data/hash, inline bytes, source-cache bytes, one shared asset and hash/ref, stable tokens/timestamps, and collection membership.

Raw 0.0.40 performed its real DB5→DB6 transition and produced exact poisoned dual-key package and collection rows with `source_geometry_v1` plus `prior_obstacle_contract`. It emitted the expected historical `pageerror: Stored package record shape is invalid` and `pageerror: Uncaught exception in event handler.` After switching the server root, navigation to exact raw 0.0.41 automatically upgraded the same-origin database to DB7. The obsolete alias was absent from both row types, `obstacleContract` was `prior_obstacle_contract`, and exact package object/hash, inline/source/shared bytes, asset hash, ref, write token, timestamp, and membership were preserved. Library listing and deterministic export returned 589 bytes. Stale selection produced only `flow_obstacle_reimport_required`; no camera/CV acquisition or retry loop occurred. Collection deletion succeeded.

A current synthetic BeatSaver-style V4GOLD provider result was then fetched through the real raw vendor/download/Worker/authoring path, persisted one package/collection, exported 19,251 bytes, and survived a fresh connected service graph/reload with one package. Raw 0.0.41 captured zero warning/error console messages, page errors, unhandled rejections, `Stored package record shape is invalid`, or `Uncaught exception in event handler`.

## Built-byte and sourcemap binding

The raw main map has 800/800 non-null `sourcesContent`; the conversion-worker map has 12/12. Ninety-seven relevant first-party/assembly embedded sources byte-match the exact pinned Git blobs with zero mismatch. Raw `assets/index.js` is 4,155,526 bytes / SHA-256 `afc9eec5665dfc91ce92fff5c7afec90e5249cfe7b87dc1a8451ecaf97438b9c`; its map is 6,982,223 bytes / `f1299109149d448d153516cf73024baba39b2ead9b57719f182a51b6eed2a127`.

The emitted code and byte-identical mapped source bind DB7 allowlisted reconstruction/alias omission, guarded decoder callbacks, first-error latching, idempotent exception-safe abort, terminal listener cleanup, decoder-first versus cancellation-first ordering, stale-selection clearing, and exact reimport-required UI behavior. The same binding covers continuous source-faithful walls/full vertical occupancy, all Flow/Boxing Lanes/Boxing Grid presentations, exact 32 CSS-pixel markers, terminal completion recovery, aggregate-only performance recording, and public obstacle privacy. The 3c9d fixture itself is intentionally an oracle input rather than a runtime member; its 89,424 bytes / SHA-256 `4db5b3393a389c7bcaba6d7a02aec57c10801bcfd74de91523b8e9cdad859b55` exercised the exact byte-matched parser/converter/content/gameplay/projection/renderer sources.

## Validation

Fresh sequential assembly validation passed `npm test`, normal `npm run build`, `npm run test:q7g-oracles`, the complete uncapped `npm run test:browser` through live marker, DB5→6→7, callback bounds, direct/real-iframe portrait/landscape DPR 1/3 environment/control/pixel matrices, all three modes, exact 3c9d pixels, 32px live-marker visibility, terminal recovery, performance evidence, privacy, docs, Vite allowlist, immutable/release/pack policy, and dry pack. Exact 3c9d reported 10 browser variant rows across direct and genuine iframe; terminal reported 36 rows across 3 modes × 2 backgrounds × 3 viewports × 2 embeddings; performance explicitly reported `bugPhysicalThresholdClaim=false`.

One redundant standalone terminal invocation after q7g and the already-passing complete browser suite hit Playwright's host/harness error `locator.evaluate: Resulting promise was garbage collected` during fixture installation. The unchanged immediate standalone retry passed all 36 rows; the same gate had already passed within q7g, and no page/product error or leaked process was observed. No source/test relaxation was made.

Fresh authoring `npm test`, `npm run test:browser`, and correct-directory dry pack passed. Callback evidence was exactly 10 valid, 18 hostile, 4 race, and 3 service operations at schema 7, exactly-once settlement, 2,000ms bounds, package+collection+asset rollback, first-cause retention, listener cleanup, and zero browser noise. The authoring package remained 18 files / 55,679 packed / 246,601 unpacked / SHA-1 `848052d940b30b4952964b429651899d035d207d`.

All 15 release-topology repositories were fetched and ended clean with `HEAD == origin/main`. No audit process, Chromium, Vite validator, raw loopback server, or port 5173 listener remained. The existing two-address 8444 listener remained unchanged.

## Disposition

PASS. Close `aerobeat-web-assembly-4bd`. Exact raw `0.0.41` subtree `0b5f7841ef65779d84f028a544724a6d76cd06a1` with proof SHA-256 `8640745a387bf510c762a3d62e80b1e3a095386d3857f24c7e561f8614f9c76c` is authorized to serve through the existing loopback-backed secure tailnet review route only. `aerobeat-web-assembly-k72.17` remains in progress for Derrick's physical Flow/Boxing and Bug-profile review; this audit claims neither physical approval nor Bug PASS.
