# New phone bundle writer lacks required JSDoc check header

## Exact observed failure
Full `npm test` stopped immediately in `check:jsdoc`: `scripts/write-flow-centerline-bundle-manifest.js: missing // @ts-check`. No unit test or renderer/browser path had run in that invocation.

## Expected behavior
Every project-owned script covered by `scripts/validate-jsdoc-no-any.js` starts with `// @ts-check` (or after its executable shebang). The new bundle writer should meet the same source policy.

## Execution path
`npm test` → `npm run check` → `npm run check:jsdoc` → `node scripts/validate-jsdoc-no-any.js` scans the new `scripts/write-flow-centerline-bundle-manifest.js`; its first lines are a Node shebang and commentary without the mandated annotation.

## Most likely root cause
The standalone writer coder syntax-tested the script but omitted the repo's existing script header convention; package `npm test` was not run while source remained dirty. The first failure is source-policy lint, not bundle algorithm correctness.

## Alternative hypotheses
An unrelated built output or missing BeatSaver ZIP cannot cause this check: lint fails before integration/unit tests. The writer's `node --check` succeeding proves only JavaScript parsing, not repository source policy.

## Why previous fixes did not resolve it
Earlier source syntax and focused VM checks did not run the normal JSDoc gate; the full assembly unit gate had not yet been rerun since the new writer file appeared.

## Unknowns
Whether another new-file JSDoc/import/pack policy fails next. Rerun the complete gate rather than predicting.

## Minimal reproduction
With the writer lacking the annotation, `npm run check:jsdoc` emits the exact path/error and exits nonzero, regardless of the local ZIP.

## Proposed verification
Add only `// @ts-check` directly after the shebang and rerun unchanged `npm run check:jsdoc`, then full `npm test`. If another error appears, diagnose it separately; do not remove the policy.

## Recommended fix
One annotation line in the new script; no production code or normal validation policy changes.

## Debugging record
Problem: first normal assembly test after new phone source fails source policy.
Observed symptom: `scripts/write-flow-centerline-bundle-manifest.js: missing // @ts-check`.
Root cause: new script omitted mandatory annotation.
Evidence: script header and `check:jsdoc` first failure.
Failed approaches: standalone `node --check` did not cover JSDoc policy.
Corrective action: add annotation after shebang.
Verification test: unchanged JSDoc gate RED→GREEN and full unit gate.
Related files/components: new bundle writer, assembly `scripts/validate-jsdoc-no-any.js`.
Remaining uncertainty: subsequent unrelated normal check outcomes pending.
