# Full browser gate stops at missing local BeatSaver 4858 ZIP

## Exact observed failure
After the corrected halo portrait test, strict console policy, phone performance browser and historical scored phone-hit browser all passed, the next normal-gate command failed before it created a browser: `Error: missing-local-fixture: 4858 exact archive is required for assembly integration`, at `scripts/validate-insecure-hash-integration.js:267` (called at line 21). Full run log: `/tmp/aerobeat-assembly-centerline-browser-halo-fixed.log`, lines 65–82. This is a missing test input, not a scored Flow failure.

## Expected behavior
The local 4858 archive fixture is available at one of the declared paths or via `AEROBEAT_BEATSAVER_4858_ZIP`; the oracle validates its provider map identity `431ffaa53a1e45ffab6c81a895e456f6aad1e038` and tests insecure-context hashing/integration on the original bytes. Do not replace this oracle with a synthetic map or silently skip it.

## Execution path
`npm run test:browser` advances through earlier scored/phone checks, then runs `node scripts/validate-insecure-hash-integration.js`. Module initialization sets three fixture path candidates (one environment override and two vendor `.testbed/.artifacts/4858/...` locations), filters empty paths, calls `firstReadable()`, and throws if all candidates fail `stat().isFile()`. The test never reaches `inspectBeatSaverArchive()` or `build()`; no gameplay, renderer, camera, or phone profiling code participates in this failure.

## Most likely root cause
The exact archive is not present at either hard-coded local path and the environment override is unset. File checks explicitly returned both paths missing; a workspace-path glob found no `4858-431ffaa53a1e.zip` under the AeroBeat project. Content-authoring README states real ZIPs are local noncommitted test inputs and missing ZIP is an intended fail-closed gate condition.

## Alternative hypotheses
- Corrupt ZIP/provider identity: impossible to reach parser or hash check in this failure; missing file occurs earlier.
- Wrong renderer source/Flow regression: the command fails during top-level ZIP path selection before any renderer imports/build.
- Archive present at a different path: possible; workspace-wide `/tmp` recursive scan timed out, and the operator may own a ZIP elsewhere. The full path is unknown.
- Upstream BeatSaver version unavailable: possible; no remote source has yet been verified. An external download must prove exact map identity and must not be silently substituted.

## Why previous fixes did not resolve it
Earlier photosphere/Vite/nose-clock/Boxing-clock/halo fixes addressed distinct failures earlier in the browser sequence. The full gate had not reached this local fixture step in those attempts. None could create or locate a local vendor archive.

## Unknowns
Whether the exact 4858 ZIP exists outside the AeroBeat project or is retrievable from a verified external source. Resolve by a narrow operator-provided file path or verified BeatSaver API metadata/download; compare `computeBeatSaverMapHash()` to the hardcoded version before using it for browser QA.

## Minimal reproduction
Run `node scripts/validate-insecure-hash-integration.js` in assembly with `AEROBEAT_BEATSAVER_4858_ZIP` unset and both listed `.testbed` fixture paths absent; the first top-level await fails with `missing-local-fixture`. With the exact file present, the test proceeds to provider-map identity inspection.

## Proposed verification
Find/restore or explicitly acquire the exact 4858 archive in the expected ignored fixture directory; hash and inspect it against pinned provider map identity; rerun **the unchanged** insecure-context browser command. After that, resume the remainder of the normal browser gate; do not count earlier 14 scripts as a full-suite pass.

## Recommended fix
Restore the missing real local fixture to the declared ignored vendor `.testbed` location from a trusted local copy or a source-verified BeatSaver archive. Keep the fail-closed assertion and pinned identity untouched. If the exact archive cannot be obtained, record the full gate as **not complete**, run unaffected scored source/visual subsets, and ask Derrick for the local fixture rather than weakening the oracle.

## Debugging record
Problem: full browser chain stopped at first required local BeatSaver fixture.
Observed symptom: `missing-local-fixture: 4858 exact archive is required for assembly integration`.
Root cause: both declared fixture paths absent and environment override unset, before any browser/build.
Evidence: explicit `stat` checks and stack at test module line 21, plus content-authoring README's real-ZIP input contract.
Failed approaches: previous unrelated fixes never exercised this later test; they are not implicated.
Corrective action: restore or verify exact real 4858 ZIP outside tracked repo, without changing production code.
Verification test: unchanged `node scripts/validate-insecure-hash-integration.js` succeeds and full `npm run test:browser` advances.
Related files/components: assembly `scripts/validate-insecure-hash-integration.js:15-27,267`; web content-authoring README real fixtures.
Remaining uncertainty: unchanged insecure-context browser oracle and full gate outcomes remain pending.

## Fixture restoration
Queried the project's own vendor API base `https://api.beatsaver.com/maps/id/4858`; its only advertised version has the **exact** pinned provider hash `431ffaa53a1e45ffab6c81a895e456f6aad1e038` and CDN URL `https://r2cdn.beatsaver.com/431ffaa53a1e45ffab6c81a895e456f6aad1e038.zip`. Downloaded that URL into a temporary file, matched the vendor oracle's existing exact archive SHA-256 `4273f0305518aa79ae4a7b58ccb07e86704ba50dbe679d0f0e29c52cb7b6beed`, then moved it to the ignored `aerobeat-web-vendor-beatsaver/.testbed/.artifacts/4858/431ffaa53a1e45ffab6c81a895e456f6aad1e038/4858-431ffaa53a1e.zip`. It is **not** committed. The unchanged integration command is now running; matching download SHA alone is not its browser pass.
