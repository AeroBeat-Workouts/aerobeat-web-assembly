# Bead dependency direction repair

## Exact Observed Failure

Renderer QA `k72.12` passed but `bd close` required `--force`. Its close reason reported that open downstream assembly task `k72.13` was blocking prerequisite QA. `bd dep list` then showed every execution-chain task listing its successor as a `blocks` dependency, for example `k72.12` depended on `k72.13`, `k72.13` depended on `k72.14`, through `k72.16` depending on physical review `k72.17`.

## Expected Behavior

Each later task must depend on its prerequisite: asset QA on asset implementation, asset audit on QA, assembly on renderer QA, cross-mode QA on assembly, final audit on QA, release on audit, and physical review on release. A prerequisite that passes must close without force because of an unstarted downstream successor.

## Execution Path

1. Initial Beads were created with `--deps "blocks:<predecessor>"`.
2. In `bd create`, that syntax means the newly created issue blocks the named issue.
3. The intended reading was the inverse: that the new issue depends on the named predecessor.
4. This produced a reverse execution chain.
5. Renderer QA exposed the error when its downstream assembly successor prevented normal closure.
6. `bd dep list` and `bd dep --help` confirmed the direction: `bd dep add <blocked> <blocker>` means the first issue depends on the second.

## Most Likely Root Cause

The root cause was misuse of Beads dependency syntax during initial graph creation, not a Beads runtime defect. The causal evidence is the CLI help, explicit `bd dep remove` messages saying each prerequisite “no longer depends on” its successor, and successful re-addition messages stating each successor now depends on its prerequisite.

## Alternative Hypotheses

1. **QA closure bug** — contradicted by the complete reversed chain visible in dependency listings.
2. **Parent-child links blocking closure** — contradicted because the reported blocker was the downstream `blocks` edge, not the umbrella relation.
3. **Only one bad edge** — contradicted by identical reversal across Tasks 2–6 and renderer subtasks.

## Why Previous Fixes Failed

No earlier correction was attempted. Successful task execution masked the graph error because agents were assigned explicitly. The forced QA close treated the immediate symptom and provided the evidence needed to diagnose the graph-wide cause.

## Unknowns

None remain for this plan's execution graph. Discovered-from and parent-child links were not reversed and were intentionally preserved.

## Minimal Reproduction

Create `A` then create downstream `B` with `--deps "blocks:A"`. `bd dep list A` shows `B`, and closing `A` while `B` remains open is blocked. The correct relation is `bd dep add B A`.

## Proposed Verification

Remove each reversed edge, add each successor-to-predecessor dependency with `bd dep add <successor> <predecessor>`, run `bd dep cycles --json`, inspect ready/blocked state, and close the completed renderer parent without force.

## Recommended Fix

Reverse only the erroneous `blocks` edges. Preserve parent-child and discovered-from links. Record the corrected chain in the active plan and use explicit `bd dep add <blocked> <blocker>` syntax for future tasks.

## Debugging Record

Problem: Tasks 2–6 Bead execution dependencies were reversed.
Observed symptom: Passed renderer QA required forced closure because future assembly work blocked it.
Root cause: Misread `bd create --deps blocks:<id>` semantics.
Evidence: CLI help, dependency listings, and removal/addition messages.
Failed approaches: Forced closure bypassed one symptom but did not repair graph ordering.
Corrective action: Reversed every erroneous execution edge and preserved valid relation types.
Verification test: `bd dep cycles --json` returns `[]`; each successor depends on its predecessor.
Related files/components: Central `.beads` ledger, Tasks `k72.8`–`k72.17`, renderer subtasks `k72.11.1/.2`.
Remaining uncertainty: None for this graph.
