# Shell-matrix cadence diagnostic — 2026-09-02

## Exact Observed Failure

Directly observed while verifying the in-progress camera-load implementation with `npm run test:shell-matrix`:

```text
Error: direct:390x844@3 gameplay renderer must follow sustained display cadence
```

The assertion failed at `scripts/validate-product-shell-matrix.js:149`. The captured evidence reported 69 renderer calls and a `displayFrameCount` increase of 69 during the 2.1-second sample, but `displayRateFps` was `29.8`, below the test's exact `>= 30` threshold. The same evidence reported `timelineDeltaP90Ms: 46.875`; if line 149 had passed, line 150's `< 40` threshold would also have failed.

No camera-load assertion failed in this run.

## Expected Behavior

The shell matrix should establish sustained display rendering independently of the slower pose-production cadence. Over the sample it expects at least 60 new display frames, at least 60 renderer calls, a reported display rate of at least 30 fps, at least 60 distinct rounded timeline values, and a timeline-delta p90 below 40 ms.

## Execution Path

1. `npm run test:shell-matrix` starts `scripts/validate-product-shell-matrix.js`.
2. `runContext()` enters direct embedding at portrait `390x844` with requested DPR 3.
3. The fixture enables continuous pose production and clears render evidence arrays.
4. It records `element.cadenceSnapshot()` as `cadenceBefore`.
5. Playwright waits 2.1 seconds of wall time.
6. It reads runtime cadence plus fixture render/timeline arrays as `cadenceProof`.
7. Line 149 compares frame-count delta, reported display rate, and render count to fixed thresholds.
8. Frame-count delta and render count passed (`69` each), but the rounded/reported `displayRateFps` was `29.8`, so the conjunction failed.

## Most Likely Root Cause

The leading diagnosis is a pre-existing timing-sensitive browser-test miss caused by host scheduling/load rather than the camera-loader code. The runtime produced 68–69 distinct render calls in each sample—well above the minimum count—while its recent-rate window sat at the strict 30 fps boundary. A p90 interval of exactly 46.875 ms repeated across runs, consistent with Chromium scheduling/clock quantization at this high-DPR context. The camera change does not alter the cadence loop, and the failure occurred before the new local-file camera-load exercise. Most decisively, a detached clean worktree at baseline commit `3c7a558` reproduced the same line-150 failure with `displayRateFps: 30.1`, `renderCount: 69`, and `timelineDeltaP90Ms: 46.875`.

## Alternative Hypotheses

1. **Pre-existing cadence regression in production code (lower likelihood).** This would explain the rate, but the camera patch does not touch cadence code and the same run produced 69 frames in 2.1 seconds.
2. **Camera default increases render cost at DPR 3 (low likelihood).** The new pose changes view geometry, but renderer calls remained numerous and the failure is a narrow timing threshold, not a rendering exception.
3. **Loader test edits disturbed fixture timing before the cadence sample (low likelihood).** New load tests execute later in the flow; the failure happened before that path.

## Why Previous Fixes Failed

No code fix has been attempted for this observation. A previous renderer browser run initially failed because a stale pitch assertion expected the old tilted default; the coder independently replaced that assertion with the authorized zero-pitch default and the full renderer browser suite subsequently passed. That unrelated intermediate failure does not explain this assembly cadence miss.

## Unknowns

- The host CPU/GPU scheduling state during the repeated 2.1-second windows.
- Whether the strict p90 threshold remains reliable on other machines.

The quiet rerun and detached-baseline reproduction distinguish this from a camera-loader regression. Any threshold or cadence change should be handled separately rather than folded into Bead `2c6`.

## Minimal Reproduction

From the assembly repo, run:

```text
npm run test:shell-matrix
```

The observed failure occurred in the direct, portrait `390x844`, requested-DPR-3 context during the sustained-cadence sample. It did not require opening or loading a camera-pose file.

## Proposed Verification

The unchanged quiet rerun reproduced the exact `46.875` ms p90 failure. A detached clean worktree at baseline commit `3c7a558` then reproduced it again. This confirms the camera patch is not causal. To validate the new loader path without masking this evidence, run a temporary out-of-tree copy of the matrix with only the two pre-existing cadence timing thresholds bypassed; do not alter the tracked test.

## Recommended Fix

Do not change production code or tracked thresholds as part of Bead `2c6`. Create a separate cadence-test reliability Bead if this gate must be made robust on this host. For `2c6`, preserve the official failures as known baseline evidence and separately exercise the later camera-loader assertions with an explicitly temporary out-of-tree diagnostic copy.

## Debugging Record

```text
Problem: Assembly shell matrix missed strict sustained-cadence thresholds during camera-loader verification.
Observed symptom: direct:390x844@3 had 69 new frames/render calls but displayRateFps 29.8; timelineDeltaP90Ms 46.875.
Root cause: Pre-existing shell-matrix timing sensitivity on this host, independent of the camera-loader patch.
Evidence: Dirty tree, quiet rerun, and clean detached baseline all reached 68–69 renders yet reported a repeated 46.875 ms p90; failure occurs before loader checks.
Failed approaches: An unchanged quiet rerun still failed; no code fix was attempted.
Corrective action: Keep tracked code unchanged; track cadence reliability separately and use a temporary out-of-tree bypass only to reach loader assertions.
Verification test: Clean detached baseline at 3c7a558 reproduced the same line-150 failure.
Related files/components: scripts/validate-product-shell-matrix.js; runtime cadence sampling.
Remaining uncertainty: Cross-machine reliability of the strict p90 threshold.
```
