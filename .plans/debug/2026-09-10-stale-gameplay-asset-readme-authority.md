# Stale gameplay-asset README authority

## Exact Observed Failure

Final source audit `aerobeat-web-assembly-0x4y` found that present-tense `README.md:52`, under `Owned photosphere runtime catalog`, says Assembly is pinned to renderer `bd8ad9ebfe2107b11ffc5373e1c0f86349167b09`, gameplay `b775a8790bb86ea8ad16394ee57d0731c5bbf7d8`, and immutable gameplay asset `0.0.9` / tree `541b693eabc11c716adca84931015213055ebfe8`.

Directly observed contradictory current authorities are:

- `README.md:120`: renderer `df9d440a46cae9fc894dd185f6876210e1d7e81f` / tree `7cf111ae7f816119c6fc20a7ba372eab5b95c205`.
- `README.md:121`: gameplay `7fc290fd66fc2deb1aca62c5f2448d316e30a9e7` / tree `b3e2a3875fcb2fa6302a73f27a47dcde1ceb2282`.
- `scripts/release-fingerprint.js`: the same current renderer/gameplay pins.
- `scripts/sync-gameplay-assets.js` and `scripts/validate-environment-assembly.js`: renderer `df9d440…`, gameplay asset release `0.0.10`, release tree `0209faccacbd7a3157d32d198ac753e861731d41`.
- The audited gameplay asset source authority recorded by the source audit is commit `49f77ff7f41e83531e302f7cd06600277defed88`.

No runtime failure was observed. This is a release/source-authority documentation contradiction.

## Expected Behavior

README must expose one unambiguous present-tense current authority matching executable provenance pins and asset validators. The environment catalog authority `c8fedde5a940c93b6e4d9fa35d5eba43ca3e6e23` must remain unchanged. Historical `0.0.9` lineage may remain only if explicitly labeled historical and scoped so it cannot be read as current.

## Execution Path

1. A source or release auditor reads `README.md` as the human authority.
2. The `Owned photosphere runtime catalog` section presents the environment source and then an unqualified `Assembly is pinned to …` sentence.
3. That sentence directs the auditor to old renderer/gameplay/gameplay-asset identities.
4. The later provenance table and executable validators direct the auditor to the newer identities.
5. The same source checkout therefore provides mutually exclusive current authority claims, so final source authorization must fail closed.

## Most Likely Root Cause

The photosphere section accumulated a renderer/gameplay/asset snapshot when gameplay raw `0.0.9` was current. Later renderer, gameplay, and immutable gameplay-asset `0.0.10` landings updated executable pins, validators, and the README provenance table but did not update this narrative sentence. The sentence mixes the still-current environment commit with unrelated gameplay authorities, making the stale portion easy to miss during scoped pin refreshes.

Evidence: the environment commit in the sentence still agrees with the current catalog, while every gameplay-related identity in that same sentence disagrees with the current executable authorities.

## Alternative Hypotheses

1. **The sentence is intentionally historical.** Rejected as the leading explanation: it uses unqualified present tense (`Assembly is pinned`) and sits in the current runtime description; the independent auditor confirmed it is not intentionally historical.
2. **The newer table is premature.** Contradicted by executable `releaseDependencyPins`, gameplay-asset synchronizer constants, validators, clean linked package HEADs, passing package QA, and final fingerprint-bound hardware evidence.
3. **Environment payload also drifted.** Not supported: `c8fedde5…` remains the intended exact environment authority and must be preserved.

## Why Previous Fixes Failed

`kfl1` corrected the stale final source fingerprint, renderer/UI provenance table entries, plan header, and executable renderer pins. That repair assumed the current-authority surface was concentrated in the provenance table, fingerprint sentence, and validators. It did not exhaustively search every present-tense README narrative for older renderer/gameplay/raw identifiers. Thus it fixed machine authority and the obvious table while leaving a contradictory prose snapshot.

## Unknowns

No behavioral unknown blocks the repair. The only editorial choice is whether to preserve the old identities as explicitly historical or replace them. Replacing them is smaller and yields a single current authority without expanding historical prose.

## Minimal Reproduction

1. Open current `README.md`.
2. Read line 52 and record `bd8ad9e` / `b775a87` / gameplay `0.0.9` as the claimed current pins.
3. Read lines 120–121 and the three executable provenance/asset scripts.
4. Observe the contradictory `df9d440` / `7fc290f` / gameplay `0.0.10` authorities in the same checkout.

The contradiction does not occur if line 52 is updated to the current renderer/gameplay/gameplay-asset authorities while retaining the environment catalog identity.

## Proposed Verification

Before repair, an exact search must find the stale identifiers in the current-tense sentence. After repair:

- README current authority agrees with the provenance table and executable pins.
- `c8fedde5…` environment authority is byte-preserved.
- stale identifiers occur only in explicitly historical/audit records, not current README prose.
- release fingerprint remains `510faed6a6a1c221c7c53d49191a94e082ebc2722ca07d4bd3e54ecb5d8d3a65` over 214 inputs.
- environment/gameplay asset verification, release-target policy, immutable history, and raw `0.0.49` absence pass.

## Recommended Fix

Replace only the stale renderer/gameplay/gameplay-asset portion of `README.md:52` with the exact current authorities. Preserve the exact environment commit and description. Do not change source behavior, immutable raw trees, evidence, plan, or serving. Independently QA the one-line semantic diff, then resume `0x4y` final source audit.

## Debugging Record

```text
Problem: Current README contains two contradictory renderer/gameplay/gameplay-asset authorities.
Observed symptom: README:52 says bd8ad9e/b775a87/gameplay 0.0.9 while current table and executable pins say df9d440/7fc290f/gameplay 0.0.10.
Root cause: The photosphere narrative retained a mixed environment-plus-gameplay authority snapshot after later gameplay source and asset landings.
Evidence: Environment c8fedde5 remains current; every gameplay-related identity in the sentence disagrees with releaseDependencyPins and asset validators.
Failed approaches: kfl1 refreshed the table/fingerprint/executable pins but did not exhaustively search current-tense README narrative.
Corrective action: Replace only the stale gameplay-related identities in README:52; preserve environment authority.
Verification test: Exact prose/pin consistency search; environment/gameplay asset gates; fingerprint 510faed6…/214; release-target, immutability, raw-absence checks; independent QA; resumed source audit.
Related files/components: README.md; scripts/release-fingerprint.js; scripts/sync-gameplay-assets.js; scripts/validate-environment-assembly.js.
Remaining uncertainty: None blocking; replacing stale identities is preferred over adding historical qualification.
```
