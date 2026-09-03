# Renderer environment proxy rejection gap

## Exact Observed Failure

Independent audit of renderer commit `f88cd654260599468c16900c54944f57ead383d1` supplied transparent proxies to the generic environment normalizers. The observed results were `descriptor: ACCEPTED`, `transform: ACCEPTED`, and `nested-position: ACCEPTED`. The acceptance path is `src/environment-asset-owner.js` through `exactPlainData`; existing tests reject accessors/symbols/extras but do not include proxies.

## Expected Behavior

The approved k72.33 contract requires descriptor and transform records, including nested records, to reject proxies atomically before renderer state mutation.

## Execution Path

1. Assembly or a test passes an environment descriptor/transform to the renderer facade.
2. The facade calls the environment owner's `setDescriptor` or `setTransform`.
3. The owner calls `normalizeEnvironmentDescriptor` or `normalizeEnvironmentTransform`.
4. `exactPlainData` checks prototype, own keys, and own data descriptors.
5. A transparent proxy forwards those reflective operations to its ordinary target and is indistinguishable under those checks.
6. Normalization accepts and freezes copied values; the required proxy-negative boundary is missed.

## Most Likely Root Cause

The validator equated a forwarded plain-object reflection result with proof that the original value was not a proxy. JavaScript proxy transparency means prototype/key/descriptor checks alone do not establish that identity. The fresh adversarial probe and absence of proxy tests directly support this conclusion.

## Alternative Hypotheses

1. **Only nested records are affected** — contradicted by direct descriptor and direct transform proxies both being accepted.
2. **Freezing the normalized copy is sufficient** — contradicted by the acceptance requirement, which is explicitly about rejecting hostile input rather than only preventing retained mutation.
3. **Proxy rejection is impossible in the browser** — arbitrary semantic detection is impossible through reflection alone, but the platform structured-clone algorithm rejects Proxy exotic objects and can be used as a generic graph gate after accessor-safe shape validation.

## Why Previous Fixes Failed

No prior fix attempted proxy detection. Existing hardening covered unknown keys, symbols, prototypes, accessors, finite bounds, and copied/frozen output, but the test matrix omitted proxies and therefore treated reflection parity as sufficient.

## Unknowns

The code currently supports modern environments with `structuredClone`; the minimum supported browser/runtime contract does not separately document older engines lacking it. The safest strict behavior is fail-closed when structured clone is unavailable.

## Minimal Reproduction

Call `normalizeEnvironmentDescriptor(new Proxy(validDescriptor, {}))`, `normalizeEnvironmentTransform(new Proxy(validTransform, {}))`, or wrap `validTransform.position` in a transparent proxy. At `f88cd654...`, all three return normalized values instead of throwing.

## Proposed Verification

Add deterministic negative assertions for direct descriptor, direct transform, nested position, nested rotation, and descriptor tuple-array proxies. Confirm each throws and that owner `describe()` is unchanged after rejected `setDescriptor`/`setTransform`. Rerun renderer `npm test` and bounded browser validation.

## Recommended Fix

After exact accessor-safe recursive shape validation, run a structured-clone eligibility check on the complete supplied graph. Structured clone rejects Proxy exotic objects, including nested proxies, while the earlier descriptor checks ensure accessors are rejected before clone can evaluate application data. Fail closed if structured clone is unavailable. Preserve copied/frozen normalized outputs and all existing bounds.

## Debugging Record

```text
Problem: Generic renderer environment contracts accept transparent proxies.
Observed symptom: Descriptor, transform, and nested-position proxy probes returned accepted normalized data.
Root cause: Prototype/key/data-descriptor reflection is transparently forwarded by Proxy.
Evidence: Independent adversarial probe; exactPlainData implementation; no proxy assertions in validator.
Failed approaches: Existing plain-record/accessor/symbol checks do not identify Proxy exotic objects.
Corrective action: Add post-shape structured-clone graph gate and explicit proxy-negative tests.
Verification test: Proxy matrix plus atomic owner-state check, npm test, bounded browser validation.
Related files/components: src/environment-asset-owner.js; scripts/validate-environment-owner.js.
Remaining uncertainty: Legacy runtimes without structuredClone; strict fail-closed behavior is recommended.
```
