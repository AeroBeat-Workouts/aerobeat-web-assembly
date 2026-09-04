# Flow obstacle migration and privacy gap diagnosis

## Exact Observed Failure

Independent QA comment `01a06e81-443f-74ce-86eb-6d0f1259b316` on Bead `aerobeat-web-assembly-qfx` reports four gaps:

1. `createMemoryPersistenceAdapter().put`, `createIndexedDbPersistenceAdapter().put`, and `copyCollectionBatch` force `flowObstacleContract: "source_geometry_v1"` onto every accepted record, regardless of the package schema/chart/obstacle payload.
2. Assembly recognizes only `flow_orientation_reimport_required`; a legacy package rejected with `flow_obstacle_reimport_required` falls through the ordinary error path instead of clearing selection and retaining list/export/delete management.
3. Existing gameplay proof covers simultaneous identical overlapping walls, but not staggered overlap/contact outcomes or a paused future-variant swap containing obstacle events.
4. Assembly narrows obstacle outcomes to counts in implementation, but no hostile direct snapshot/event and genuine cross-origin iframe test proves geometry, grid masks, lane coordinates, tracking/nose evidence, and episode/event identities stay private.

Direct inspection confirms the first two implementation gaps at content-authoring `src/persistence.js` public adapter writes and assembly `src/index.js` library selection/error helpers. The latter two are missing focused proof, not an observed source defect.

## Expected Behavior

Only a package that structurally proves the current Flow v2 source-geometry contract may be stored with the internal `source_geometry_v1` label. Unproven and legacy packages must remain recoverable through list/export/delete but fail load/read with `flow_obstacle_reimport_required` until reimport.

Assembly must treat `flow_orientation_reimport_required` and `flow_obstacle_reimport_required` as the same stale-library control flow while preserving their exact bounded error codes/messages. Neither package may become Preview/Test/Play content.

Integration proof must exercise staggered overlapping wall outcomes/consequence aggregation and paused future-content obstacle partition ownership without editing the concurrently owned gameplay repository. Public direct snapshots, direct events, and genuine iframe events may expose only bounded obstacle counts and accessibility status.

## Execution Path

Persistence path: public adapter `put` / `putCollection` → `copyRecord(... forceContract=true)` / `copyCollection(... forceContract=true)` → unconditional `source_geometry_v1` metadata → `get` → `resolveRecordAssets` permits load because it trusts that metadata.

Library path: UI library selection → `requestLibrarySelection` → `selectLibraryPackage` → authoring `loadPackage` or content `selectContent` rejection → orientation-only predicate → either `clearStaleLibrarySelection` or generic `handleError`. The generic path leaves stale selected-library state instead of the exact no-auto-select reimport flow.

Public path: internal gameplay snapshot → `gameplayTelemetry` → `AeroGame.getSnapshot`; `publish("session_changed")` → `snapshotForType` → direct `aero-game-event` and `bridge.sendEvent` → genuine parent `postMessage` event.

## Most Likely Root Cause

The persistence migration added an internal version label but reused the same forced-label arguments for public writes. The label became asserted provenance rather than derived truth. Assembly's stale-package predicate and fixed error assignment predate the new obstacle migration code, so the second bounded reimport reason was not added to the same branch. QA additions focused on the exact 3c9d happy path and simultaneous overlap, leaving adversarial public-boundary and staggered/future-partition cases unexercised.

## Alternative Hypotheses

1. **Full authoring validation always precedes adapter writes.** True for service conversion, but false for exported public persistence adapters, which accept records directly and are tested directly. It cannot justify unconditional stamping.
2. **Content runtime alone prevents legacy play.** It rejects v1, but assembly first loads from authoring and must clear stale selection consistently; generic error handling does not establish the no-reselection behavior.
3. **Contract iframe filtering is sufficient proof.** The bridge validates generic event shape and unsafe media keys, but aggregate-vs-raw obstacle privacy is assembly narrowing policy and needs a hostile end-to-end gate.

## Why Previous Fixes Failed

The source-faithful obstacle implementation correctly validates newly converted packages and migrates DB4 rows to `bounded_mask_v1`, but it assumed all subsequent public adapter writes were current authoring output. That assumption allowed arbitrary/legacy public writes to be upgraded by metadata alone. Assembly updated README/content behavior for obstacle reimport but retained the orientation-specific predicate/message implementation.

## Unknowns

The concurrently owned gameplay working tree contains an active `session-coordinator.js` edit for Bead `stk`. Its final pushed behavior is not yet authoritative. Assembly integration proof will avoid source/test edits there and final validation must wait until that repository is clean/upstream.

## Minimal Reproduction

1. Call a public persistence adapter `put` with a legacy/minimal package record lacking v2 Flow geometry.
2. Inspect the stored row or call `get`: it is stamped `source_geometry_v1` and loads.
3. In assembly, make authoring `loadPackage` throw `{code:"flow_obstacle_reimport_required"}` during a selected downloaded package load: selection is not routed through the stale-selection clear/refresh branch.

## Proposed Verification

- Direct memory and IndexedDB tests store forged stamped/legacy packages and require a stored `bounded_mask_v1` label plus load/read rejection while list/export/delete remain available.
- Current structurally valid Flow v2 packages written through both public paths must receive `source_geometry_v1` and load.
- Browser library test runs both exact reimport codes and asserts one load, one refresh, cleared selection, no auto-selection, bounded matching error, retained export/delete, and corrected reimport recovery.
- Assembly integration test drives staggered overlapping walls and a paused future obstacle swap through gameplay's public API and asserts exact outcome/consequence/partition ownership and unchanged note scoring.
- A focused browser test injects hostile internal obstacle records and proves direct snapshot, direct event, and genuine cross-origin iframe event carry only capped counts and accessibility mode.

## Recommended Fix

Derive the persistence obstacle-contract label from descriptor-safe structural proof of package v2 + Flow chart v2 + exact valid obstacle geometry/grid masks; otherwise label the row legacy. Derive a collection's label only when every contained package proves current geometry. Generalize assembly's reimport predicate/clear path to preserve the exact one of two approved codes and a bounded code-specific message. Add only assembly/content-authoring tests; do not edit gameplay.

## Debugging Record

Problem: Public persistence could assert current Flow geometry without proof; assembly did not uniformly handle the new reimport reason; required edge/privacy proof was absent.
Observed symptom: Arbitrary writes were force-labeled `source_geometry_v1`; obstacle-reimport errors bypassed stale selection clearing.
Root cause: Forced metadata was used as provenance, and assembly stale handling remained orientation-specific.
Evidence: `src/persistence.js` forced-label arguments on all three write paths; `src/index.js` orientation-only predicate and fixed code; qfx comment `01a06e81-443f-74ce-86eb-6d0f1259b316`.
Failed approaches: Relying on service prevalidation/content rejection and happy-path privacy narrowing without adversarial end-to-end gates.
Corrective action: Derive labels from structural package proof, unify both reimport codes, and add assembly integration/privacy gates.
Verification test: Public adapter hostile writes, dual-code browser selection, staggered/future gameplay integration, and direct/event/genuine-iframe privacy tests.
Related files/components: content-authoring `src/persistence.js`; assembly `src/index.js` and focused scripts.
Remaining uncertainty: Final `stk` gameplay behavior until its concurrently owned working tree is committed and clean.

## Hostile privacy validator syntax failure

### Exact Observed Failure

`node scripts/validate-obstacle-public-privacy.js` fails before executing the browser gate with `SyntaxError: missing ) after argument list` on line 16. The outcome and stale-library validators pass first.

### Expected Behavior

The direct `locator.evaluate` callback must parse, install hostile private gameplay state, publish a session event, and return narrowed snapshot/event values for privacy assertions.

### Execution Path

Node parses the module → reaches the line-16 `directGame.evaluate((element)=>{...})` expression → the callback-local `installHostileGameplay` function closes → the callback closes → the `evaluate(` call has no closing `);` → module compilation aborts before Chromium launches.

### Most Likely Root Cause

Line 16 ends in `;}}`: one brace closes `installHostileGameplay` and one closes the evaluate callback, but the `evaluate(` call itself is not closed. The source therefore requires `;}});`. `node --check` reproduces the same compile-time location, and a regex inspection confirms the line ends with two braces only.

### Alternative Hypotheses

1. An unmatched object brace inside the hostile fixture is less likely: the parser reaches the expression end and specifically requests a closing parenthesis.
2. Optional chaining or template literals are not causal: Node 22 supports both and reports no token-specific error.
3. Vite/Playwright setup is not causal: parsing fails before either runtime is entered.

### Why Previous Fixes Failed

No prior syntax repair was attempted. The interrupted delegated implementation created a minified single-line browser gate but did not run or complete this new script before handoff.

### Unknowns

After syntax repair, runtime assertions may reveal independent fixture or privacy-contract defects; only executing the gate can resolve that.

### Minimal Reproduction

Run `node --check scripts/validate-obstacle-public-privacy.js`; it fails deterministically at line 16 without starting a browser.

### Proposed Verification

Change only the expression terminator from `;}}` to `;}});`, rerun `node --check`, then execute the validator. This distinguishes the missing-call-terminator cause from an internal brace or browser-runtime problem.

### Recommended Fix

Add the missing `);` to the line-16 `directGame.evaluate` call. Then run syntax, direct/event/genuine-iframe privacy, full assembly tests, and build gates.

### Debugging Record

Problem: Hostile obstacle privacy validator cannot compile.
Observed symptom: `SyntaxError: missing ) after argument list` on line 16.
Root cause: `directGame.evaluate(` closes its nested function and callback with `}}` but omits the call terminator `);`.
Evidence: Exact line ending `;}}`; deterministic `node --check` failure before browser startup.
Failed approaches: None; delegated work was interrupted before this script was validated.
Corrective action: Replace the line ending with `;}});`.
Verification test: `node --check` followed by the hostile direct/event/cross-origin iframe gate.
Related files/components: `scripts/validate-obstacle-public-privacy.js`.
Remaining uncertainty: Runtime privacy assertions after compilation.
