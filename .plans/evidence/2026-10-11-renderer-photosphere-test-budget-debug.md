# Renderer photosphere triangle-count browser-gate diagnosis

## Exact observed failure
After restoring missing renderer test dependencies, `npm test` is GREEN, but `npm run test:browser` stops in `scripts/validate-browser-renderer.js:16`: `AssertionError: photosphere triangle budget must remain exact; 960 !== 1024`. The actual browser mesh index count divided by three is 960; the assertion requires 1024. This test has no Flow corpse in its subject.

## Expected behavior
The authored `SphereGeometry({latitudeBands:16,longitudeBands:32})` should render as before, and its expected triangle count should reflect the pinned PlayCanvas engine's generated mesh; a real change in mesh parameters or output should still fail the test.

## Execution path
The renderer environment owner creates the sphere at `src/environment-asset-owner.js:160-172`. The browser test attaches an environment, reads `owner.record.mesh.primitive[0].count / 3`, and compares it to a literal 1024. The owner also has a diagnostic `ENVIRONMENT_TRIANGLES=16*32*2`; unlike the actual mesh indices, this formula counts both poles as full bands.

## Most likely root cause
The oracle and diagnostic constant assume 16 complete longitudinal strips. PlayCanvas 2.21.4's `SphereGeometry` generates `2880` indices with `latitudeBands=16` and `longitudeBands=32`, i.e. `960` triangles (`(16-1)*32*2`). Both the literal test expectation and the owner formula already existed at renderer `a2afa12`, before Flow corpse `c8e9b88`; this is an unchanged baseline discrepancy exposed when previously missing renderer fixtures were restored.

## Alternative hypotheses
1. Different browser CPU/GPU geometry generation: unlikely because direct installed ESM PlayCanvas `SphereGeometry` returns the same 2,880 indices and 960 triangles.
2. A new corpse change altered the environment geometry: contradicted by `git show a2afa12` retaining the same environment constants and browser test; the Flow commit did not change either file.
3. The design wanted *exactly 1024* triangle faces: unknown, but would require changing latitude band geometry from 16 to 17, a visible unrelated production change. Prefer preserving authored geometry and correcting diagnostic/test truth.

## Why previous fixes failed
The first normal-gate run stopped before this test on absent asset/branding/environment siblings. Restoring clean current dependency checkouts fixed those setup errors but revealed this distinct pre-existing oracle mismatch; no prior triangle-count code fix has been attempted.

## Unknowns and minimal reproduction
Unknown whether the historical intended value was an upper bound rather than exact generated count; no visual defect is observed from the 16×32 sphere. Minimal reproduction: instantiate the pinned engine `SphereGeometry({radius:30,latitudeBands:16,longitudeBands:32,calculateTangents:false})` and divide `indices.length` by 3; it returns 960. The failing browser assertion reproduces on the full environment state without a Flow corpse.

## Proposed verification and recommended fix
Keep sphere parameters and rendered pixels unchanged. Change only the owner diagnostic constant to the engine's `(latitudeBands-1)*longitudeBands*2` and the project-owned browser oracle to `960` (or an exported exact constant if appropriate). Run the same browser test RED with only the old assertion, GREEN with corrected assertion, then continue the full normal browser gate. Protect orientation, alpha, resource lifecycle, and shade tests already in the script. Risk: coupling to future PlayCanvas geometry updates is intentional—new generated counts should fail and force review.

## Debugging record
Problem: renderer browser normal gate cannot reach subsequent visual states.
Observed symptom: `960 !== 1024` photosphere triangle budget assertion.
Root cause: outdated full-band formula, while pinned PlayCanvas omits one pole strip.
Evidence: unchanged renderer `a2afa12` code and direct pinned engine output (2,880 indices).
Failed approaches: none to code; dependency restoration revealed failure.
Corrective action: correct diagnostic and test budget, not mesh geometry.
Verification test: browser environment pixel/mesh test RED old assertion, GREEN corrected, then full browser gate.
Related files/components: renderer environment owner; renderer `validate-browser-renderer.js`.
Remaining uncertainty: historical exact-1024 aesthetic intent not documented; no evidence of visual defect.
