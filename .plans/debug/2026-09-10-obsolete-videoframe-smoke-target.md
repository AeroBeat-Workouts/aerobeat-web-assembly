# Obsolete VideoFrame smoke target diagnosis

## Exact Observed Failure

During `rwfk` validation, direct execution of `scripts/validate-real-mediapipe-videoframe-smoke.mjs` reached its configured default URL but timed out waiting for the legacy `aerobeat-app` performance selector. The child reported this as a pre-policy application-contract failure.

Direct source inspection shows the script defaults `AEROBEAT_SMOKE_URL` to `http://127.0.0.1:5173/`. In the current managed environment, that address serves rejected immutable raw `0.0.48`, not the mutable current checkout. Independently, current assembly `index.html` mounts `<aero-game>`, while the smoke script exclusively queries `<aerobeat-app>`, `.cv-performance-select`, `.inference-state`, `.calibration-entrypoint`, and `.telemetry-copy`. None of those UI selectors exist in current assembly `src/`.

No code was changed during this diagnosis.

## Expected Behavior

A tracked validator that claims real current MediaPipe transferable-VideoFrame correctness must either:

1. start or receive an explicitly verified current-source server and exercise supported `<aero-game>`/graph APIs; or
2. be deleted if its legacy UI behavior is fully superseded by current production profile/benchmark coverage.

It must never silently validate whichever unrelated bytes happen to occupy loopback port 5173, and it must not claim a current-source failure based on selectors absent from the current product contract.

## Execution Path

1. Script launches Playwright and navigates to `AEROBEAT_SMOKE_URL`, defaulting to port 5173.
2. Managed serving currently maps port 5173 to immutable rejected raw `0.0.48`.
3. Script waits for `<aerobeat-app>` and its old CV performance-selector UI.
4. Current assembly mounts `<aero-game>` and has no matching selectors; rejected raw may also lack that obsolete UI contract.
5. `page.waitForFunction` reaches its 30-second timeout before actual VideoFrame telemetry validation.
6. Console-policy hardening cannot make the functional smoke executable because the initiating target/UI contract is stale.

## Most Likely Root Cause

The smoke tool predates the assembly migration from the old `aerobeat-app` UI shell to the current `<aero-game>` composition. It retained an unmanaged external URL default and old selector-based performance-preset flow. Because it is outside main suites, the stale target contract went unnoticed until exhaustive `rwfk` execution.

## Alternative Hypotheses

1. **Current assembly temporarily failed to render its selector.** Contradicted by `index.html` and complete `src/` search: the script's element and selector names are absent by design.
2. **The default port represents current source.** Contradicted by the managed process command: port 5173 serves rejected raw `release/raw/0.0.48`.
3. **Only a longer timeout is needed.** Contradicted by the absent selector contract; waiting cannot create elements current source does not define.
4. **Console policy caused the timeout.** Contradicted by the timeout occurring while waiting for application UI and before diagnostic acceptance determines success.

## Why Previous Fixes Failed

The exact MediaPipe admission repair changed only console classification and correctly left application behavior untouched. It then ran the script against its default URL, assuming the target represented current assembly. That treated the observed selector timeout as unrelated rather than identifying the unmanaged target and obsolete UI contract.

## Unknowns

Coverage inventory resolved the important uncertainty: the stale smoke adds no current product requirement. Assembly `validate-aero-game-assembly.js` exercises production worker construction plus transferable VideoFrame capture/close/exact timestamp and public status; `validate-pose-backend-registry.js` covers worker composition and transferable frame types; `benchmark-mediapipe-worker.mjs` performs a real current-source self-owned Vite/worker/VideoFrame run with execution telemetry; final `profile-camera-abccba.mjs` exercises the production hardware path; web-cv `validate-cv-service.js` deeply covers transferable VideoFrame scheduling, retirement, unsupported fallback, and resize-path truth; vendor-mediapipe `validate-mediapipe-worker-adapter.js` covers adapter transfer messages, telemetry, errors, and lifecycle. The stale smoke's remaining unique surface is only the removed `aerobeat-app` selector/clipboard presentation contract, which is not a current assembly requirement.

## Minimal Reproduction

1. Confirm port 5173 serves immutable raw `0.0.48`.
2. Run `node scripts/validate-real-mediapipe-videoframe-smoke.mjs` without `AEROBEAT_SMOKE_URL`.
3. Observe timeout waiting for the old `aerobeat-app` selector.
4. Search current `index.html`/`src`: current root is `<aero-game>` and legacy selectors are absent.

The failure may differ if an unrelated old UI development server happens to occupy port 5173, which itself demonstrates the validator's target-authority defect.

## Proposed Verification

Inventory current worker/VideoFrame assertions in assembly and vendor packages. Prove whether the smoke has any unique requirement. Then either:

- currentize it with a self-owned current-source Vite lifecycle, `<aero-game>` graph APIs, exact backend/provider/worker/VideoFrame telemetry, and exact warning/error/page/request/HTTP collection; or
- delete it and prove equivalent current-source coverage through named authoritative validators.

In either case, tests must fail if pointed at rejected raw or unrelated bytes and must not depend on a pre-existing port 5173 server.

## Recommended Fix

Treat this as a separate source-audit repair rather than hiding it inside console classification. Delete the obsolete smoke because the completed coverage inventory proves its current worker/VideoFrame responsibilities are already covered by named assembly, web-cv, vendor, benchmark, and final hardware gates; remove the exported `package.json` `test:mediapipe-videoframe-smoke` command and its special tracked-source guard expectation, and prove no current documentation requires it. This intentionally changes the fingerprint because `package.json` is an input while keeping the input count at 214; current dry pack is 133 and contains the smoke, so exact post-deletion dry pack must be 132. Do not restore legacy `aerobeat-app` UI solely to satisfy a stale script.

## Debugging Record

```text
Problem: Tracked real VideoFrame smoke cannot validate current assembly.
Observed symptom: 30-second timeout waiting for legacy aerobeat-app performance selector.
Root cause: unmanaged default port 5173 targets rejected raw, while script uses UI selectors absent from current aero-game assembly.
Evidence: script default URL/selectors; managed server command; current index.html and src search.
Failed approaches: hardening only console admission and running against default port as if it were current source.
Corrective action: inventory coverage, then delete redundant smoke or currentize with self-owned current-source server/graph APIs.
Verification test: deterministic current-source execution with exact diagnostics/transports, or explicit equivalent-coverage proof after deletion.
Related files/components: validate-real-mediapipe-videoframe-smoke.mjs; index.html; profile-camera-abccba.mjs; benchmark-mediapipe-worker.mjs; current CV graph APIs.
Remaining uncertainty: whether the standalone smoke retains unique coverage.
```
