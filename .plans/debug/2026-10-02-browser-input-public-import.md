# Browser regression crosses input owner's private source path

## Exact observed failure
`npm test` exits at `npm run check:imports`: `scripts/validate-force-calibration-recovery.js: imports a sibling repo source path`. Earlier focused recovery browser proof passes, so this is an import-boundary failure, not a physical camera or run-continuity failure.

## Expected behavior and execution path
Assembly browser regressions must import public owner packages, never absolute filesystem source of linked sibling repos. `scripts/validate-force-calibration-recovery.js:289–315` runs a measured accidental-loss cue case in Playwright's `game.evaluate` and dynamically imports `"/@fs/<machine-local-path>/aerobeat-web-input/src/index.js"` at line 293 to instantiate fresh input. The `npm test → check → check:imports → scripts/validate-public-imports.js` gate scans source module specifiers and rejects any matching `aerobeat-web-*/src/` (`validate-public-imports.js:75–90`).

## Root cause, alternatives, previous attempt
The browser fixture introduced a hardcoded input-owner source URL to avoid a bare package import inside untransformed `page.evaluate`; that explicit private URL is both nonportable and prohibited by the existing source gate. The failure was masked by passing focused browser runs, which do not run `check:imports`. A newly broken input public package is less likely: assembly production imports `createAeroBodyGridService` from `@aerobeat/web-input` in `src/service-graph.js:7`, and input owner is clean at `cc07bfa`. A temporary `fs.allow` Vite allowance in the test is not itself the flagged import; do not weaken the guard or disable loss-cue assertions. This is the first diagnostic pass for this exact gate failure; no attempted repair yet.

## Unknowns and verification
Determine which Vite-served public package URL can be imported from browser-evaluated code (for example Vite's public package module path) without referencing linked owner source or unstable absolute cache files. Alternatively use a fresh input instance via the production graph/public adapter without altering gameplay truth. Prove the replacement resolves in the browser and keeps the exact measured loss reason, fresh requirement, gameplay pause, visible Tracking lost cue; then rerun `npm run check:imports`, focused browser proof and `npm test`. Check whether a now-unused `fs.allow` override can be removed without changing fixture behavior.

```text
Problem: Assembly browser regression imports linked input source privately.
Observed symptom: scripts/validate-force-calibration-recovery.js: imports a sibling repo source path.
Root cause: absolute /@fs/.../aerobeat-web-input/src/index.js fixture import.
Evidence: regression line293, public import gate lines75–90, production service graph line7.
Failed approaches: focused browser passed but did not exercise npm import-boundary gate; no repair tried.
Corrective action: use a Vite-served public @aerobeat/web-input export or production input instance.
Verification test: npm run check:imports; exact focused recovery and npm test.
Related files/components: scripts/validate-force-calibration-recovery.js, src/service-graph.js, scripts/validate-public-imports.js.
Remaining uncertainty: browser-resolvable public module URL and unused fs.allow override.
```
