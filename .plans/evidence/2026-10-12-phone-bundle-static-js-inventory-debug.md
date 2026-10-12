# Flow v3 bundle writer rejects actual static MediaPipe JavaScript

## Exact observed failure
The first clean-source `npm run build:flow-centerline-phone` from assembly commit `962048b` completed Vite successfully (`✓ built in 2.04s`) and then exited 1 in the sidecar writer: `Flow centerline bundle manifest: built hashed JS asset inventory missing or malformed` (`/tmp/aerobeat-flow-centerline-phone-build.log:71-72`). No sidecar was produced; no preview or private route changed. The normal shell browser gate remains separately RED on its headless Play timing condition.

## Expected behavior
The isolated builder must enumerate/hash **all actual built JavaScript served to the browser**, including Vite-hashed entry/worker chunks **and static MediaPipe JavaScript copied under nested asset paths**. It should require Vite chunk entry names to be hashed and referenced by the built HTML, and protect every JS file with SHA-256, exact bytes, safe relative path, and local/served parity in the browser oracle.

## Execution path
`package.json` `build:flow-centerline-phone` runs Vite with `vite.flow-centerline.config.js`, then `scripts/write-flow-centerline-bundle-manifest.js`. Vite emitted `assets/flow-centerline-test-qY_DOg_h.js`, `assets/mediapipe-worker-BYsdKy_r.js`, `assets/conversion-worker-DA7fpn8i.js`, plus copied static `assets/mediapipe/vision_bundle.js`, `assets/mediapipe/wasm/vision_wasm_internal.js`, `vision_wasm_module_internal.js`, and `vision_wasm_nosimd_internal.js`. The writer recursively finds **all** files in the built output (`assetsUnder`), selects `.js`, then line 81 incorrectly insists every path fits a **flat, hashed** `assets/<chunk>-<hash>.js` regex. Copied static runtime scripts are nested and un-hashed, so the honest all-JS inventory triggers failure. The browser oracle line 76 independently expects only flat `assets/` JS, so it would reject a corrected sidecar until changed coherently.

## Most likely root cause
The writer and browser oracle were designed against Vite-emitted chunks, not the existing MediaPipe vendor static runtime assets. A fully bundled build includes both. The failure is an overstrict **test/build manifest path classifier**, not evidence that Vite failed to build or linked source mismatched. Supporting evidence: Vite completed and the enumerated build output contains three flat hashed chunks plus four nested static MediaPipe JS files; writer's sole immediate throw condition is its `jsPaths.some(!flatHashedRegex)`.

## Alternative hypotheses
1. Malformed hash chunk name: unlikely; emitted chunk names `flow-centerline-test-qY_DOg_h.js`, `mediapipe-worker-BYsdKy_r.js`, `conversion-worker-DA7fpn8i.js` match writer flat-hashed pattern.
2. Dirty source/build guard: unlikely as direct cause; the writer advanced through its source-manifest checks and threw at the inventory line. **However**, the plan was edited after the build began, so once this path check is fixed a later source-change check could rightly reject this particular build; commit the coherent fix/plan and rebuild from clean source, not reuse these artifacts.
3. Sidecar stale or path escape: no sidecar exists, and recursive enumeration yields legitimate static JS paths.

## Why previous attempts failed
Unit/VM oracles test bounded report semantics with mocked sidecar fetch; they do not materialize a real Vite output tree. The dirty-source negative preflight deliberately rejected before bundling, so it could not observe copied MediaPipe runtime files. The first real build exposed this previously untested output inventory.

## Unknowns and minimal reproduction
Minimal sequence: clean commit `962048b`, `npm run build:flow-centerline-phone`; Vite compiles, writer rejects. Uncertain whether other nested `.js` can appear in future linked versions and whether preview origin serves each static path; the browser oracle should independently fetch/hash all paths after the coherent path rule is fixed. No physical phone timings exist.

## Proposed verification
Keep all seven currently emitted built JS files in the sidecar with bytes/SHA. Require HTML-referenced Vite entry to match a flat hashed chunk shape, but permit strictly safe nested static JS paths in the inventory. The browser oracle should verify path safety and fetch/hash each local and served file. Add a build-asset inventory regression oracle or writer test fixture with one flat hashed entry plus a nested un-hashed MediaPipe file, and a negative unsafe `../` path if practical; then rebuild from a fresh clean commit, inspect manifest count and exact SHA/parity in the real candidate browser QA.

## Recommended fix
Narrow the hashed-name invariant to Vite chunk paths and entry scripts; allow safe nested static `.js` asset paths for all-JS inventory, without dropping their byte hashes or relaxing origin/manifest checks. Update the browser oracle's corresponding path regex only for safe nested JS, not all arbitrary strings. Do not exclude the static runtime from the manifest, rename vendor files, disable the clean source guard, or claim a browser pass before actually serving the output.

## Debugging record
Problem: v3 real build sidecar rejects JavaScript asset inventory.
Observed symptom: Vite success then writer exits 1 at `built hashed JS asset inventory missing or malformed`.
Root cause: all-JS recursive inventory mistakenly requires every JS to be a flat Vite hashed chunk, whereas shipped MediaPipe runtime copies nested static scripts.
Evidence: build log lines 63–72, exact seven `.js` paths under ignored `dist-flow-centerline-phone`, writer line81 and browser line76.
Failed approaches: VM sidecar mock and dirty-source negative preflight did not test real Vite output.
Corrective action: secure all-JS inventory paths + separate hashed entry-chunk check; align browser local/served verifier.
Verification test: clean committed rebuilt sidecar records all seven JS and independent browser fetch compares SHA/byte count for each; unsafe paths remain rejected.
Related files/components: `scripts/write-flow-centerline-bundle-manifest.js:78-99`, `scripts/validate-flow-centerline-phone-browser.js:75-83`, `vite.flow-centerline.config.js` static copy behavior.
Remaining uncertainty: subsequent actual preview/browser E2E may reveal other integration failures; high-DPI product-shell gate remains separately red.
