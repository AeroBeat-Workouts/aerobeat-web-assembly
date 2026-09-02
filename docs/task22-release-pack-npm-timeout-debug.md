# Internal npm derivation timeout diagnosis

## Exact Observed Failure

Independent QA against source `4947733f` replaced the pinned npm CLI in a disposable policy copy with an exact-realpath fake. The fake emitted clean `10.9.8` for the version check and then hung during internal dry-pack derivation. The verifier produced no output and remained blocked until an external `timeout 3s` killed it with exit `124`; stdout and stderr were empty.

## Expected Behavior

Both internal npm subprocesses—the version check and dry-pack derivation—must have documented finite deadlines. Deadline expiry must fail closed with a distinct error, terminate the child process group without leftovers, preserve the detached target, and allow the existing `finally` block to remove only the owned isolated temporary root.

## Execution Path

1. `verifyArchive()` calls `deriveNpmPackMetadata()`.
2. The function creates and validates an isolated temporary runtime.
3. It calls `runPinnedNpm()` for `--version`, then again for `npm pack --dry-run --json`.
4. `runPinnedNpm()` uses `spawnSync(process.execPath, ...)` with output bounds but no `timeout` or external watchdog.
5. A child that never exits prevents control from returning to result checks or the temporary-root cleanup `finally` block.

## Most Likely Root Cause

The subprocess boundary was hardened for executable identity, environment, output, status, and noise but omitted liveness. Synchronous waiting has no independent deadline, so all later fail-closed checks are unreachable when npm hangs.

## Alternative Hypotheses

- **npm output buffering:** disproven; the fake emits no dry-pack output and still hangs.
- **cleanup deadlock:** disproven; execution never returns from `spawnSync()` to the `finally` block.
- **target lock or filesystem delay:** unnecessary to reproduce; the fake CLI loops without accessing the target.

## Why Previous Fixes Failed

The metadata-authority repair focused on provenance and environmental isolation. Its tests covered command failure and output corruption but assumed subprocess completion. No hanging-child regression or outer watchdog existed.

## Unknowns

The exact production deadline values are policy choices. They should be generous enough for the current 97-file package while remaining finite. The pinned npm path runs with lifecycle scripts disabled, so it should not create independent descendant process groups.

## Minimal Reproduction

Use a fake pinned CLI that prints `10.9.8` for `--version` and otherwise waits forever. Invoke `verify`. Source `4947733f` does not return without an external kill.

## Proposed Verification

Add separate fake-CLI hangs for version and dry-pack. Each verifier invocation must terminate under its own larger outer watchdog, report the correct operation-specific timeout, leave no fake CLI or ordinary descendant process, leave the target clean and mode-stable, remove the owned temp root, and leave unrelated similarly named paths untouched. Retain non-timeout command failure/noise tests and the full two-worktree package proof.

## Recommended Fix

Wrap each pinned npm invocation with a fixed absolute GNU `timeout` process-group watchdog using operation-specific finite limits, TERM followed by bounded KILL escalation. Preserve the existing sanitized environment and output limit. Map watchdog timeout statuses/signals to explicit version-check or dry-pack timeout errors before generic exit handling. Validate the watchdog executable identity at startup. Keep `finally` cleanup guarded by the existing owned-root checks.

This addresses liveness at the subprocess boundary rather than adding a caller-side test timeout. Adjacent regressions are normal success, nonzero exit, signal, max-buffer failure, TERM-resistant child, ordinary descendant cleanup, target invariants, and isolated-root cleanup.

## Coder repair result

`runPinnedNpm()` now invokes `process.execPath + PINNED_NPM_CLI` through validated absolute GNU coreutils `timeout` at `/usr/bin/timeout` (`9.4`). The npm version check has a fixed `15 s` production deadline, internal dry-pack derivation has `120 s`, and both receive process-group `TERM` followed by `KILL` after a `2 s` grace period. A slightly larger built-in `spawnSync` deadline is retained only as a watchdog-of-last-resort if the validated wrapper itself fails to return. GNU timeout diagnostics are detected before generic signal/exit handling so each operation reports a distinct timeout error and the caller reaches guarded owned-temp cleanup.

Adversarial source-copy tests inject short constants without any production environment override. They cover version and dry-pack hangs, an ordinary descendant, TERM-resistant direct/descendant processes, bounded outer watchdog return, PID disappearance, target cleanliness/mode preservation, owned temporary-root removal, unrelated lookalike preservation, timeout executable missing/identity/failure, npm nonzero/signal/max-buffer/noise/output failures, and every prior archive/target protection.

## Debugging Record

```text
Problem: Internal npm derivation can block forever.
Observed symptom: Fake npm hangs in dry-pack; verifier only ends when externally killed with exit 124.
Root cause: runPinnedNpm uses spawnSync without any finite timeout/watchdog.
Evidence: Source lines 185-197 contain no timeout; cleanup is unreachable while spawnSync waits.
Failed approaches: Provenance/environment hardening assumed subprocess completion and lacked hang tests.
Corrective action: Absolute process-group timeout wrapper with finite operation deadlines and TERM/KILL escalation.
Verification test: Version and dry-pack hangs self-terminate, emit distinct errors, leave no child/temp/target changes, then full gates pass.
Related files/components: scripts/release-pack-policy.js; scripts/validate-release-pack-policy.js; r39/nji/qmc/cf1/1wu/nme.
Remaining uncertainty: Exact generous deadline values are policy choices.
```
