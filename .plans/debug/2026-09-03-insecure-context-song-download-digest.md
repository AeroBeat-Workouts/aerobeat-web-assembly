# Insecure-context song download digest failure

## Exact Observed Failure

### Derrick's physical observation

On another Tailscale PC, raw assembly `0.0.36` at `http://100.113.165.57:5173/` fails when downloading DDR and other BeatSaver songs with the exact visible message:

```text
Cannot read properties of undefined (reading 'digest')
```

### Diagnostic reproduction

A fresh headless Chromium page visited that exact non-secure origin and exercised the actual UI path `Latest` → first result → `Download`. The browser reported:

```json
{
  "href": "http://100.113.165.57:5173/",
  "isSecureContext": false,
  "cryptoType": "object",
  "subtleType": "undefined"
}
```

The request succeeded before hashing: BeatSaver vendor telemetry recorded two requests, HTTP `200`, `2,309,957` downloaded bytes, and zero transport failures. The UI then displayed the same exact error. A direct call through the same selected map/version captured this error chain for map `54146`, version `c2d8d916129f14333bd72be297b33eda1c80325a`:

```text
BeatSaverVendorError: Cannot read properties of undefined (reading 'digest')
    at toBeatSaverVendorError (http://100.113.165.57:5173/assets/index.js:105770:37)
    at AeroBeatSaverVendorService.run (http://100.113.165.57:5173/assets/index.js:107380:19)
    at async AeroGame.importBeatSaver (http://100.113.165.57:5173/assets/index.js:109065:15)

Caused by:
TypeError: Cannot read properties of undefined (reading 'digest')
    at sha1Hex (http://100.113.165.57:5173/assets/index.js:106732:37)
    at http://100.113.165.57:5173/assets/index.js:107314:30
    at async AeroBeatSaverVendorService.run (http://100.113.165.57:5173/assets/index.js:107378:11)
    at async AeroGame.importBeatSaver (http://100.113.165.57:5173/assets/index.js:109065:15)
```

Raw `0.0.36`'s checked-in source map resolves those generated positions exactly to:

- `assets/index.js:106732:37` → `aerobeat-web-vendor-beatsaver/src/archive.js:79:37`
- `assets/index.js:107314:30` → `aerobeat-web-vendor-beatsaver/src/service.js:97:32`
- `assets/index.js:105770:37` → `aerobeat-web-vendor-beatsaver/src/errors.js:46:11`
- `assets/index.js:107380:19` → `aerobeat-web-vendor-beatsaver/src/service.js:150:21`
- `assets/index.js:109065:15` → `aerobeat-web-assembly/src/index.js:544:21`

The first failure is therefore the raw archive SHA-1 call `crypto.subtle.digest("SHA-1", copy.buffer)`, after network acquisition and before ZIP inspection, provider map-content hash verification, authoring, persistence, content loading, or audio loading. The vendor wrapper currently misclassifies this non-network failure as code `transport`.

The page has two additional directly observed failures before any song is selected:

- renderer gameplay assets: `state="error"`, `errorMessage="SHA-256 verification is unavailable"`, zero loaded GLBs;
- environment: `state="error"`, `fallback=true`, zero resident photospheres, visible UI text `Environment unavailable. Retry.`

Thus the physical review URL is not merely unable to download songs: its integrity-gated 3D gameplay assets and environment also fail to load on that origin.

The immutable server was not changed or restarted. PID `2459798` remained bound only to `100.113.165.57:5173`, and HTTP readback of `aerobeat-release-proof.json` remained SHA-256 `3d18dd99afe99fcac389bccee760073baf83cc44c66cdec6d0ac5d933d142daf`.

## Expected Behavior

Non-camera song workflows must work on a supported ordinary HTTP origin even when WebCrypto is unavailable:

1. download or read the archive;
2. verify raw/provider SHA-1 exactly;
3. inspect the bounded ZIP;
4. author every supported Standard difficulty with exact SHA-256 identities;
5. atomically persist the collection and shared audio;
6. reload and independently verify package/chart/asset hashes;
7. verify encoded audio before decode/playback;
8. verify all packaged gameplay GLBs and the selected environment JPEG before rendering.

Every mismatch or unavailable internal implementation must remain fail-closed. The repair must not skip hashes, weaken comparisons, trust provider metadata, load a runtime script/URL, add WASM, or acquire code/assets over the network.

Camera Play is different. `getUserMedia` is intentionally unavailable on a non-loopback HTTP origin; raw `0.0.36` truthfully reports `secureContext:false`, `camera:false`, and limitation `camera_unavailable`. Camera/calibration physical QA still requires localhost or HTTPS. BeatSaver browse/download, local ZIP import, IndexedDB, Worker conversion, Test/audio, and locally packaged renderer/environment loading do not inherently require a secure context and should not be coupled to the camera limitation.

## Execution Path

### Initiating UI path and first failure

```text
Music drawer Download intent
→ AeroGame.handleUiIntent()
  src/index.js:1711
→ AeroGame.importBeatSaverById()
  src/index.js:550-557
→ AeroGame.importBeatSaver()
  src/index.js:539-547
→ AeroBeatSaverVendorService.acquireVersion()
  vendor/service.js:91-106
→ BeatSaverTransport.getBytes(version.downloadUrl)
  network succeeds, 2,309,957 bytes / HTTP 200 in reproduction
→ sha1Hex(downloadedBytes)
  vendor/service.js:97
→ crypto.subtle.digest("SHA-1", ...)
  vendor/archive.js:79
→ TypeError because globalThis.crypto exists but crypto.subtle is undefined
→ service.run() wraps it as BeatSaverVendorError code "transport"
→ assembly handleError() publishes visible error
```

If only that first call were repaired, the next SHA-1 dependency is `computeBeatSaverMapHash()` → `sha1Hex(combined provider hash stream)` at `vendor/archive.js:92-99`. Local ZIP import follows the same two SHA-1 calls at `vendor/service.js:121-124`.

### Downstream authoring dependencies that fail after a vendor-only repair

```text
AeroGame.convertAcquired()
→ authoring.convertAllStandardAndPersist()
→ prepare source material and verify selected difficulty/audio expectations
→ conversion request preparation (main thread)
→ module conversion Worker (same insecure origin)
→ converter/validator/parity/package/export hashes
→ atomic IndexedDB collection commit
```

All authoring SHA-256 operations funnel through `aerobeat-web-content-authoring/src/canonical.js:81-86`. It explicitly reads `globalThis.crypto?.subtle` and throws `SHA-256 is unavailable in this browser context` when absent. Calls include source/audio and selected difficulty hashes, Worker protocol binding, event IDs, recipe/ruleset/content/package hashes, semantic parity, converter-profile identity, collection identity, deterministic export tables, and export inspection. A Blob Worker probe at the exact Tailscale origin independently reported `isSecureContext:false`, `cryptoType:"object"`, `subtleType:"undefined"`; fixing only main-window hashing will not fix conversion-worker hashing.

### Downstream persisted-content and audio dependencies

After authoring, `refreshLibrary()` auto-selects the authored package:

```text
refreshLibrary()
→ requestLibrarySelection()
→ selectLibraryPackage()
→ selectContent({kind:"persistence"})
→ content.loadPersistenceHandle()
→ package/chart/score/asset SHA-256 verification
→ loadSelectedAudio()
→ audio.load(expected SHA-256)
```

`aerobeat-web-content/src/runtime-data.js:120-126` gates all runtime package/chart/composite/asset SHA-256 operations on WebCrypto. The content runtime therefore fails after authoring unless it is repaired too.

`aerobeat-web-assembly/src/index.js:743-749` always passes the authored audio content hash as `expectedHash` when loading selected audio. `aerobeat-web-audio/src/audio-service.js:1116-1124` returns no browser hash adapter without `crypto.subtle`; `audio-service.js:719-733` then correctly fails closed with `audio_hash_unavailable`. Audio must receive the same deterministic hashing capability; omitting `expectedHash` is not acceptable.

### Renderer and environment dependencies independent of download

On graph attachment, the renderer fetches local packaged assets and verifies them before parse/decode:

- `aerobeat-web-renderer/src/gameplay-asset-loader.js:98-100` gates seven GLB SHA-256 checks on WebCrypto;
- `aerobeat-web-renderer/src/environment-asset-owner.js:172-176` gates selected JPEG SHA-256 verification on WebCrypto.

These failures already occur on initial load at the insecure Tailscale origin. Gameplay rendering may later activate its explicit primitive fallback after a render request, but that is a truthful loader-error fallback, not successful loading of the physically reviewed canonical GLBs. Environment immediately shows its gradient fallback. Both must be included in the repair and QA scope.

### Existing pure-JS implementation and dependency inventory

No current production dependency or relevant lockfile contains `@noble/hashes`, `hash.js`, `sha.js`, `js-sha`, or `crypto-js`. Assembly depends on local AeroBeat packages plus Vite/Playwright; BeatSaver's only runtime dependency is `fflate@0.8.2`; authoring has no runtime dependency. `fflate` supplies DEFLATE, not SHA.

There is one existing first-party deterministic pure-JS SHA-256 implementation: exported `sha256PrototypeProfileHex()` in `aerobeat-web-gameplay/src/prototype-profile-registry.js:231-254`. It matches WebCrypto in its tests and works without `crypto.subtle`, but it accepts UTF-8 text only, buffers padded input as a JavaScript number array, has no SHA-1, has no incremental binary API, and is owned by the gameplay profile layer. Depending on gameplay from vendor/content/audio/renderer would invert repository boundaries. It is useful prior art/test evidence, not a complete reusable fix as written.

## Most Likely Root Cause

**Confirmed root cause:** raw `0.0.36` assumes `SubtleCrypto.digest` is available for mandatory integrity checks, but it is served from an untrustworthy non-loopback HTTP origin where Chromium withholds `crypto.subtle`.

The causal evidence is complete:

1. exact origin reports `isSecureContext=false` and `typeof crypto.subtle === "undefined"`;
2. network archive acquisition succeeds with HTTP `200` and expected byte progress;
3. the captured cause stack points to `vendor/archive.js:79` reading `.digest` from that undefined property;
4. a localhost control of the same immutable bytes reports `isSecureContext=true`, `typeof crypto.subtle === "object"`, downloads the same selected version successfully, authors three packages, reaches content `ready`, loads all seven GLBs, and loads the environment;
5. source inspection finds the same insecure-context dependency in every downstream integrity owner;
6. the worker probe proves authoring's browser Worker has the same missing `subtle` capability.

This is not a bad BeatSaver archive, DDR format issue, CDN/CORS failure, ZIP decompression error, IndexedDB failure, or release corruption. Any downloaded map reaches the unconditional archive SHA-1 call, so the symptom is map-independent.

## Alternative Hypotheses ranked

1. **Secure-context gating of WebCrypto — confirmed / dominant.** Direct environment probes, exact cause stack, source-map mapping, localhost success, and independent renderer failures all agree.
2. **BeatSaver CDN/CORS or mixed-content failure — very unlikely.** The HTTP page fetched the HTTPS API/CDN successfully; telemetry shows HTTP `200`, downloaded bytes, and zero transport failures. Failure occurs after body acquisition.
3. **Malformed or unsupported downloaded map/ZIP — very unlikely.** Failure occurs before `inspectBeatSaverArchive()`. The localhost control successfully inspects/authors the same map/version.
4. **Browser-specific absence of global `crypto` rather than `subtle` only — possible variant, not a different root cause.** Chromium exposes `crypto.getRandomValues` but not `subtle`; another supported browser may expose a different shape. Current direct `crypto.subtle` use would fail in either case. Cross-browser insecure-origin QA remains unknown.
5. **Worker-only WebCrypto restriction — contradicted as the first cause but confirmed as an additional downstream failure.** The first stack is on the window vendor path. The Worker also lacks `subtle`, so a main-thread-only repair would be incomplete.
6. **Corrupt raw `0.0.36` or wrong served bytes — contradicted.** Proof readback remains exact, server PID/port are unchanged, and localhost serves the same checked-in bytes successfully.

## Why Previous Fixes Failed

No hashing fix has yet been attempted for `i4u`; this report intentionally stops before implementation.

The previous release QA did not detect the defect because all browser gates used trustworthy loopback origins (`127.0.0.1` or `localhost`). Package browser scripts in BeatSaver, content-authoring, content, renderer, audio, and assembly all start loopback servers. Raw `0.0.36` phase-2 verification also exercised `http://127.0.0.1:5173/`, where HTTP is treated as potentially trustworthy and WebCrypto is present. The server was moved to the Tailscale IP only after release audit, and no equivalent non-loopback HTTP gate was run before physical review.

Earlier renderer/environment fallback work behaved as designed for asset verification failure, but fallback masked that the reviewed canonical assets had never passed integrity verification on the physical URL. Fixing or relabeling the visible BeatSaver error alone would still leave authoring, runtime content, audio, gameplay GLBs, and environment JPEG hashing broken.

## Unknowns

- Firefox, Safari/WebKit, Android Chrome, and the exact remote PC browser may expose insecure-context `crypto` differently. Resolve with the new non-loopback HTTP browser matrix; implementation must not rely on Chromium's partial object shape.
- Pure-JS throughput and memory cost on the slowest supported phone for the 128 MiB archive / 64 MiB entry / 512 MiB expanded policy bounds is not measured. Resolve with chunk-boundary and representative/max-policy benchmarks; use incremental hashing to avoid additional full-size concatenation/copy pressure.
- Whether the product officially promises all non-camera flows on arbitrary HTTP origins is not currently stated as explicitly as camera HTTPS guidance. Derrick's Tailscale HTTP review request and current capability UI imply this requirement for song/asset review; product documentation should make the boundary explicit after acceptance.
- Cross-origin iframe behavior with an insecure child and either insecure or secure parent has not yet been reproduced for this bug. It should be an explicit QA row because the hash capability belongs to the child global/Worker.
- The exact shared package/repository name for a reusable hash primitive is not established by current repo policy. Creating a new public repo requires owner approval. A package-local temporary duplication would avoid repo creation but is architecturally inferior and risks divergent integrity behavior.

## Minimal Reproduction

### Failing production-like path

1. Open `http://100.113.165.57:5173/` in Chromium without insecure-origin override flags.
2. Evaluate `({isSecureContext, crypto: typeof globalThis.crypto, subtle: typeof globalThis.crypto?.subtle})`; observe `{false, "object", "undefined"}`.
3. Open Music, select `Latest` (or search DDR), select any playable version, and press `Download`.
4. The archive fetch reaches HTTP `200`; then the UI reports `Cannot read properties of undefined (reading 'digest')`.
5. Inspect renderer diagnostics before any download: gameplay assets are already `error` with `SHA-256 verification is unavailable`; environment is `error`/fallback.

### Passing control

Serve the exact same immutable `release/raw/0.0.36` bytes on loopback and open the loopback URL. The diagnostic used temporary `http://localhost:5174/`, then stopped that temporary server. It observed:

```json
{
  "isSecureContext": true,
  "cryptoType": "object",
  "subtleType": "object",
  "result": "success",
  "mapId": "54146",
  "versionHash": "c2d8d916129f14333bd72be297b33eda1c80325a",
  "packageCount": 3,
  "contentState": "ready",
  "contentPackageId": "ab-songpkg-raya-c2d8d916129f-easy",
  "gameplayAssets": "ready",
  "environment": "ready"
}
```

No product/release file was changed, and the parent-managed Tailscale server was not touched.

## Proposed Verification

Before accepting an implementation:

1. Add shared SHA-1 and SHA-256 known-answer tests: empty, `abc`, NIST/FIPS multi-block vectors, one million `a`, binary `00/80/ff`, every padding boundary around 55/56/63/64 bytes, sliced typed arrays with nonzero offsets, and chunk partitions. Cross-check against Node `createHash` and secure-context WebCrypto in tests only.
2. Prove native and bundled pure-JS paths return identical lowercase hex for all vectors and representative BeatSaver/provider streams, authored package strings, audio bytes, GLBs, and JPEGs.
3. Run browser/Worker tests on a genuinely non-loopback HTTP origin where assertions first require `isSecureContext === false` and `crypto?.subtle === undefined`; do not simulate success by injecting a fake `subtle` object.
4. Exercise actual UI `Latest/Search → Download` and local ZIP import through vendor SHA-1, main/Worker authoring SHA-256, atomic IndexedDB persistence, reload/select, content package/chart/audio verification, and Test playback.
5. Exercise renderer attach/context-restore and all eight environment selections on the same origin; require seven canonical GLBs ready, selected JPEG ready, no fallback, and exact asset hashes.
6. Repeat direct and genuine iframe paths on insecure HTTP and secure localhost/HTTPS controls. Assert camera is unavailable only in insecure rows while song/Test/asset workflows pass.
7. Mutate one byte independently at every boundary (archive/provider stream, source difficulty, authored package, persisted audio, AEROPKG1, GLB, JPEG). Every case must still fail closed with the correct domain error; no fallback may be represented as successful canonical verification.
8. Benchmark representative and policy-bound chunking on desktop/mobile. Confirm no additional unbounded full-input copies and no UI/Worker watchdog regression.
9. Re-run every owner package gate and assembly unit/browser/build/package/release-policy gates. Scan built JavaScript and source maps for remaining production `crypto.subtle.digest` call sites outside the shared adapter.
10. Keep raw `0.0.36` byte-identical. Only after source implementation, independent QA, and final audit PASS may the release lane run the repository's checked `version:patch` policy. With current version `0.0.36`, that policy mechanically yields expected successor `0.0.37`; it is not created or reserved by this diagnosis.

## Recommended Fix

Create or designate one low-level, browser-and-Worker-safe hash owner (recommended responsibility: a narrowly scoped first-party `@aerobeat/web-hash` package, subject to repository-creation approval) with:

- exact `SHA-1` and `SHA-256` incremental byte hashing;
- lowercase hex convenience functions accepting strings/typed-array slices without offset mistakes;
- a WebCrypto fast path when available and a bundled deterministic pure-JS fallback when it is not;
- no network fetch, dynamic external import, WASM, Node runtime dependency, silent bypass, or weakened mismatch behavior;
- bounded cleanup and chunking suitable for existing archive/asset limits;
- authoritative known-answer, parity, chunking, adversarial, and browser/Worker tests.

The existing gameplay profile SHA-256 implementation is useful source/test prior art but should be moved or replaced through the shared owner rather than imported upward from gameplay. SHA-1 must be added and both algorithms must support binary/incremental use.

Correct consumer ownership:

- `aerobeat-web-vendor-beatsaver`: provider/raw archive SHA-1 and correct integrity-domain error mapping;
- `aerobeat-web-content-authoring`: all main-thread and conversion-Worker SHA-256 identities, persistence, and export;
- `aerobeat-web-content`: package/chart/composite/asset SHA-256 validation;
- `aerobeat-web-audio`: encoded-byte SHA-256 adapter/default while preserving `audio_hash_unavailable`/mismatch fail-closed semantics;
- `aerobeat-web-renderer`: gameplay GLB and environment JPEG SHA-256 verification;
- `aerobeat-web-gameplay`: consume the shared primitive for profile hashes to eliminate duplicate algorithm ownership;
- `aerobeat-web-assembly`: dependency wiring, end-to-end insecure/secure direct/iframe QA, capability copy, immutable successor build/audit; assembly should not implement the algorithm.

If a new package/repository is not approved, each current owner can embed audited package-local pure-JS fallbacks as a less desirable interim architecture, but no owner may skip its check. A vendored, pinned, build-time dependency could also satisfy the no-runtime-network constraint, but the current dependency graph contains no such library and adding one would require dependency/license/provenance review.

Safety implications: SHA-1 remains required only for BeatSaver/SongCore compatibility and equality against the provider's exact 40-hex content identity; it is not introduced for new security design. SHA-256 remains mandatory for AeroBeat package/assets. Pure-JS hashing increases CPU/energy exposure on untrusted large inputs, so existing byte limits must execute before or during hashing and the implementation must be incremental. Camera availability must not be spoofed or polyfilled on insecure origins.

## Debugging Record

```text
Problem: Mandatory browser integrity hashing is coupled to secure-context WebCrypto.
Observed symptom: Exact Tailscale HTTP UI error "Cannot read properties of undefined (reading 'digest')"; canonical GLBs and photosphere also fail verification/loading.
Root cause: On http://100.113.165.57:5173/, isSecureContext is false and globalThis.crypto.subtle is undefined; raw 0.0.36 directly calls subtle.digest for SHA-1/SHA-256 across vendor, authoring, content, audio, and renderer owners.
Evidence: Exact UI reproduction; HTTP 200/2,309,957-byte acquisition; cause stack and checked source-map mapping to vendor archive.js:79; Worker probe; renderer diagnostics; same immutable bytes pass localhost with three authored packages/content ready/seven GLBs/environment ready.
Failed approaches: No i4u code fix attempted. Prior QA used only trustworthy loopback origins and therefore never exercised missing SubtleCrypto; a vendor-only fix or hash skipping would leave downstream failures/integrity gaps.
Corrective action: Add one audited browser/Worker-safe SHA-1/SHA-256 primitive with WebCrypto fast path plus deterministic bundled pure-JS fallback; migrate every owner and preserve exact fail-closed comparisons.
Verification test: Genuine non-loopback HTTP direct+iframe UI download/local import/persist/reload/content/audio/renderer/eight-environment matrix with subtle absent, secure controls, vectors/parity/chunking/limits, and one-byte tamper rejection at every boundary.
Related files/components: web-vendor-beatsaver archive.js/service.js; web-content-authoring canonical.js and all callers/Worker; web-content runtime-data.js/assets/package-content; web-audio audio-service.js; web-renderer gameplay-asset-loader.js/environment-asset-owner.js; web-gameplay prototype-profile-registry.js; assembly index.js/service graph/tests/release policy.
Remaining uncertainty: Supported-browser insecure-global shapes, mobile pure-JS throughput, exact shared package/repo approval/name, and insecure-child iframe matrix.
```
