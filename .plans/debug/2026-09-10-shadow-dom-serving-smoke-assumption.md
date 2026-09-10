# Secure Serving Smoke False Negative: Shadow-DOM Text Assumption

## Exact Observed Failure

The first parent secure-serving smoke exited non-zero at its inline assertion:

```text
Error: missing Flow Grid
```

A follow-up use of `getByLabel('Show 4×3 grid').isChecked()` timed out after 30 seconds.

Directly observed: both loopback and tailnet HTTPS returned the same 527-byte immutable `0.0.49` index, the `<aero-game>` custom element was defined, and its nested shadow trees were populated. The failure was in the parent smoke assertions, not the served application.

## Expected Behavior

A serving smoke must validate the immutable app through its component shadow roots, use the runtime's exact visible spacing (`Show 4 × 3 grid`), and apply the established browser-noise/optional-resource policy rather than treating light-DOM body text as the product surface.

## Execution Path

1. Playwright loaded the tailnet HTTPS root.
2. Immutable `index.html` created `<aero-game>`.
3. The compiled module defined and populated `aero-game` and nested web-component shadow roots.
4. The smoke read `document.body.innerText`.
5. Light-DOM `body.innerText` did not include nested shadow-root labels.
6. The smoke falsely concluded that `Flow Grid` was absent.
7. The second smoke also used the non-authoritative no-space label spelling, so its label lookup timed out.

## Most Likely Root Cause

The smoke encoded two incorrect DOM-query assumptions: that light-DOM `body.innerText` includes shadow-root text and that the visible grid label omits spaces around the multiplication sign. Nested-shadow inspection proves the app is initialized and the gameplay-mode radio values include `flow_grid_v2` and `flow_colliders_v1`; the independent immutable audit already proved the exact visible controls through a shadow-aware runtime oracle.

## Alternative Hypotheses

1. **Release failed to initialize** — contradicted by `customElements.get('aero-game')`, populated shadow roots, initialized controls, and renderer ReadPixels activity.
2. **Tailnet proxy served different bytes** — contradicted by identical loopback/HTTPS index hashes and identical proof bytes.
3. **Immutable release omitted the controls** — contradicted by nested `AERO-PROTOTYPE-SELECTOR` radios for both Flow modes and the independent audit.
4. **Security/certificate failure** — contradicted by HTTP/2 200 over the tailnet HTTPS URL.

## Why Previous Fixes Failed

No product fix was attempted. The second diagnostic improved inspection but retained a stale label spelling and called `isChecked()` on an empty locator, converting the same oracle defect into a timeout.

## Unknowns

No product-state unknown remains. A browser may request an optional favicon and receive 404; the established collector must identify the exact request URL before classifying it rather than using a blanket `>=400` assertion.

## Minimal Reproduction

Load either loopback or tailnet immutable root, wait for initialization, and read `document.body.innerText`: it is empty although `<aero-game>` owns a populated shadow tree. Querying the exact product surface recursively through open shadow roots exposes the controls.

## Proposed Verification

Compare loopback and HTTPS immutable index/proof bytes, then recursively traverse open shadow roots and assert:

- `Flow Grid` and `Flow Colliders` visible text;
- selected `flow_grid_v2` and unselected `flow_colliders_v1` radio values;
- exact `Show 4 × 3 grid` label bound to an unchecked checkbox;
- parallax control present;
- no non-optional HTTP/request/page errors.

## Recommended Fix

Replace the ad hoc light-DOM smoke with a shadow-aware read-only assertion. Do not change source or immutable raw bytes. Preserve the existing exact console/noise policy and classify optional favicon traffic by exact URL if observed.

## Debugging Record

```text
Problem: Parent secure-serving smoke falsely rejected audited immutable UI.
Observed symptom: "Error: missing Flow Grid" followed by a grid-label timeout.
Root cause: Light-DOM body text does not traverse nested shadow roots; second probe also used stale no-space label spelling.
Evidence: Identical local/HTTPS bytes; defined aero-game; populated nested shadows; Flow mode radio values present; independent raw-runtime audit PASS.
Failed approaches: body.innerText assertion; non-authoritative getByLabel('Show 4×3 grid').
Corrective action: Use recursive open-shadow inspection and exact visible label spacing; do not edit product/raw bytes.
Verification test: Shadow-aware HTTPS smoke with exact mode values, grid state, parallax, and request/error policy.
Related files/components: Immutable index.html, aero-game and nested UI shadow roots, serving smoke only.
Remaining uncertainty: Optional favicon request classification, resolvable by exact response URL capture.
```
