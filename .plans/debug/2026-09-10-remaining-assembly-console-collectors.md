# Remaining assembly browser-console collector diagnosis

## Exact Observed Failure

A repository-wide source search after assembly commit `6f9a63099a343c04c0ce8007597df2eec5736633` found **18 active broad suppression expressions across 16 files** under `aerobeat-web-assembly/scripts/`:

```js
["warning", "error"].includes(message.type()) &&
!message.text().includes("GL Driver Message")
```

The affected files are:

- `validate-environment-controls-browser.js`
- `validate-stale-indexeddb-browser.js`
- `validate-audio-mix-integration.js` (three collectors)
- `validate-gameplay-cursors.js`
- `validate-mobile-gameplay-menu.js`
- `validate-live-v4-import.js`
- `validate-playwright-console-noise.js`
- `validate-exact-3c9d-browser-pixels.js`
- `validate-v4-assembly-integration.js`
- `validate-visual-correction-integration.js`
- `validate-live-catalyst-batch.js`
- `validate-square-grid-alignment.js`
- `validate-music-preview.js`
- `validate-real-3c9d-trajectory-controls.js`
- `validate-standard-batch-library.js`
- `validate-product-shell-matrix.js`

Directly observed: each expression discards both `warning` and `error` diagnostics whenever arbitrary text contains `GL Driver Message`, without checking the exact Chromium grammar, expected page URL, or `lineNumber=0` / `columnNumber=0` sentinel. Most of these scripts participate in `npm run test:browser`; `validate-v4-assembly-integration.js` also participates in `npm test`; other named scripts remain callable validation gates.

No code was changed during this diagnosis.

## Expected Behavior

Every browser-console collector that permits Chromium's established ReadPixels diagnostic must use the same exact assembly policy introduced in `scripts/readpixels-console-policy.js`:

- type exactly `warning`;
- message anchored as `[.WebGL-0x<nonempty lowercase hex>]` plus the exact Chrome for Testing 151.0.7922.34 ReadPixels body;
- only the exact optional ` (this message will no longer repeat)` suffix;
- source URL exactly equal to the complete expected validation page URL supplied by that collector;
- `lineNumber === 0` and `columnNumber === 0`;
- duplicate exact warnings allowed;
- every application lookalike, error type, URL mutation, grammar mutation, sentinel mutation, and unrelated diagnostic remains fatal.

## Execution Path

1. A validation script creates a Playwright page and registers `page.on("console", callback)`.
2. Chromium or application code emits a `warning` or `error`.
3. The callback tests only whether the text contains `GL Driver Message`.
4. A matching diagnostic is omitted from the script's `noise` array regardless of type, source URL, line/column, or complete message grammar.
5. The validator later asserts that `noise` is empty.
6. An application-origin error or composed lookalike therefore produces a false PASS.

In `validate-playwright-console-noise.js`, the new pure classifier oracle runs correctly, but the file's actual browser `collectNoise` function still uses the legacy broad predicate. The oracle tests the helper in isolation and does not prove that this collector calls it.

## Most Likely Root Cause

The prior repair scope was based on two newly noticed assembly sites (`validate-live-marker-visibility.js` and `validate-insecure-hash-integration.js`) rather than an exhaustive search for every broader `GL Driver Message` suppression. Searching only for `ReadPixels`-specific forms missed generic legacy fragments. The implementation added a correct shared helper but routed only those two collectors; duplicated older callbacks remained.

Evidence:

- exact source search returns 18 broad expressions in the current authoritative assembly checkout;
- each expression lacks a helper import and ignores location data;
- the helper and hostile oracle exist and pass, demonstrating that the missing step is collector routing and exhaustive coverage rather than uncertain Chromium grammar;
- full browser tests pass because normal browser execution emits the legitimate warning, not hostile application lookalikes.

## Alternative Hypotheses

1. **Some matches validate historical raw releases and intentionally use legacy policy.** Possible for the raw `0.0.31` row inside `validate-audio-mix-integration.js`, but the collector still controls whether the current validator reports a false PASS. Historical payload immutability does not require retaining a fail-open harness callback.
2. **Some scripts are obsolete or outside required gates.** A few are not in the main `test:browser` command, but they are tracked callable validators and claim browser correctness. This may narrow execution priority but does not make broad error suppression safe.
3. **The broad phrase is needed for Chromium variants.** Contradicted by measured Chrome for Testing 151.0.7922.34 behavior and passing exact helpers in assembly, renderer, and UI.
4. **Only `ReadPixels` text is security relevant.** Contradicted: `includes("GL Driver Message")` is broader and can hide arbitrary application text containing that phrase.

## Why Previous Fixes Failed

- The first source audit reported renderer/UI collectors but did not exhaustively enumerate assembly collectors.
- The `789t` follow-up repaired the two exact files discovered by a `ReadPixels`-focused search.
- The new hostile oracle verifies the helper but does not statically or dynamically assert that all assembly collectors route through it.
- Successful real-browser suites established compatibility with genuine diagnostics but did not inject hostile lookalikes at every callback.

The previous attempts fixed valid instances but treated the enumerated sites as complete; the actual root problem is duplicated browser-console policy across the whole assembly validation surface.

## Unknowns

- The exact expected page URL expression for every affected direct/iframe/historical-row collector must be mapped before editing.
- Some scripts may observe console events from multiple pages or frames and require a bounded set of exact expected URLs rather than one URL.
- It remains to be verified whether every affected script naturally emits ReadPixels on current Chromium; collectors that do not need an exception should reject all warnings/errors instead of importing the helper.
- `benchmark-mediapipe-worker.mjs` also contained broad legacy fragments, including `GL Driver Message`, and `validate-real-mediapipe-videoframe-smoke.mjs` suppressed any `error` containing `Created TensorFlow Lite XNNPACK delegate for CPU`. Both are tracked executable browser evidence tools even though they are outside the main browser suite, so `rwfk` includes exact-policy repair and validation for them. Follow-up inspection after exact-fragment routing found a second fail-open dimension: the VideoFrame smoke callback still ignored every `warning`, and both MJS tools omitted HTTP >=400 and request-failure collection. `profile-camera-abccba.mjs` already routes through the exact profile collector and collects transport failures, making it the correct contrast. The final MJS repair must observe all warning/error diagnostics, preserve only empirically established exact tuples, and make page/request/HTTP failures fatal.

## Minimal Reproduction

For any affected callback, provide a console record equivalent to:

```text
type: error
text: application failure: GL Driver Message
url: <application script URL>
lineNumber: 12
columnNumber: 4
```

The current predicate omits it from `noise`. The exact helper rejects it. The defect does not reproduce in the two already-routed collectors or when the diagnostic text lacks `GL Driver Message`.

## Proposed Verification

Before implementation, enumerate every `page.on("console")` in assembly and classify it as:

1. reject all warning/error diagnostics; or
2. admit only the exact helper tuple for an explicitly supplied expected page URL.

Add a static/adversarial oracle that fails if any tracked assembly script contains broad known GL/ReadPixels/MediaPipe fragment admission, imports an exact helper without calling it, or leaves an affected evidence-tool collector warning-silent. For each routed collector, test exact admission and hostile type, message, URL/path, line, column, duplicate/count, HTTP, request-failure, and page-error variants. Then run every affected browser script, full `npm test`, full `npm run test:browser`, build, pack, release-target, fingerprint, immutable snapshot, and diff checks.

This distinguishes the leading duplicated-policy hypothesis from URL-shape or obsolete-script alternatives.

## Recommended Fix

Use `scripts/readpixels-console-policy.js` as the sole ReadPixels admission helper across all active assembly browser validators, and the exact pinned profile policy for empirically established MediaPipe runtime diagnostics. Route every collector that genuinely needs an exception through the relevant helper with its exact expected page URL or WASM path; remove exceptions from collectors that do not observe the legitimate diagnostic. Every evidence tool must collect both warning and error console records plus page errors, HTTP >=400, and request failures. Extend the central oracle/source guard so future broad fragments, warning-silent evidence collectors, and transport omissions fail `npm test`.

Do not modify historical raw release bytes. Test-only validator changes should not change the 214-input release fingerprint, but recompute it after repair. Re-run all direct/iframe, current/historical, viewport/DPR, page/request/HTTP, and privacy gates because URL binding errors can cause legitimate browser warnings to fail closed.

## Debugging Record

```text
Problem: Assembly browser validators still contain duplicated broad GL-driver suppression after the two-site 789t repair.
Observed symptom: 18 active expressions across 16 scripts discard any warning/error containing GL Driver Message.
Root cause: ReadPixels-focused site enumeration and helper-only oracle did not exhaustively route or guard all assembly collectors.
Evidence: current source search, package test wiring, and validate-playwright-console-noise's exact helper oracle coexisting with its broad integration collector.
Failed approaches: renderer/UI-only repair; two-site assembly repair; real-browser PASS without hostile collector injection; no exhaustive source guard.
Corrective action: map all collector URLs, route every necessary exception through the exact helper, reject all others, and add a no-broad-fragment source oracle.
Verification test: hostile tuple matrix plus all affected scripts, full unit/browser/build/pack/release/fingerprint/immutability gates.
Related files/components: 16 assembly validation scripts, readpixels-console-policy.js, validate-playwright-console-noise.js, package.json test wiring.
Remaining uncertainty: exact expected URL/multi-page shape per collector and whether the experimental benchmark belongs in the same repair scope.
```
