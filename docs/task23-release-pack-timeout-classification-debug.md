# Internal npm timeout classification diagnosis

## Exact Observed Failure

Independent QA against policy source `04c4fccd` used a disposable exact-realpath fake npm CLI. It returned clean `10.9.8` for the version check, then immediately wrote `/usr/bin/timeout: sending signal TERM to command` plus `ordinary npm failure` to stderr and exited `7`. GNU timeout never fired, but the verifier reported `internal npm dry-pack derivation timed out after 120s`.

## Expected Behavior

Timeout classification must come from an authoritative watchdog outcome and elapsed deadline, never from untrusted child output. Spoof text combined with child exits `0`, `7`, `124`, or an immediate signal must retain its real success/failure classification. Genuine TERM and TERM-resistant KILL deadlines must remain bounded and distinct.

## Execution Path

1. `runPinnedNpm()` invokes GNU timeout with `--verbose` around Node/npm.
2. GNU timeout and the child share captured stderr.
3. After `spawnSync()` returns, code searches the merged stderr for timeout's human-readable TERM/KILL strings.
4. That substring check runs before `result.error`, `result.signal`, and `result.status` handling.
5. Any child can print the same string, causing a false timeout regardless of its immediate real exit status.

## Most Likely Root Cause

The implementation treats an unauthenticated human-readable message on a shared output channel as watchdog state. The message has no provenance because GNU timeout and npm inherit the same stderr pipe.

## Alternative Hypotheses

- **GNU timeout actually fired:** disproven by immediate completion and child exit `7`.
- **The child was signaled:** disproven by `result.signal === null` and the ordinary exit status.
- **Locale changed the diagnostic:** possible for real watchdog messages, but it reinforces that diagnostic text is not an authority.

## Why Previous Fixes Failed

The liveness repair correctly added a process-group watchdog and finite outer bound, but it needed to distinguish watchdog expiry from ordinary failures. It selected `--verbose` text matching instead of an outcome/timing contract, leaving the classification channel spoofable.

## Unknowns

None for the pinned host. GNU timeout's `--preserve-status` is available in coreutils 9.4 and provides TERM/KILL statuses while monotonic elapsed time independently proves that the configured deadline was consumed.

## Minimal Reproduction

Print the exact GNU timeout TERM diagnostic to stderr from the fake npm child and exit `7` immediately. Source `04c4fccd` reports a 120-second timeout despite returning immediately.

## Proposed Verification

Test spoof strings with immediate child outcomes `0`, `7`, `124`, SIGTERM, and SIGKILL; none may classify as a timeout. Test genuine normal TERM expiry and TERM-resistant KILL escalation under short source-copy deadlines; both must consume the expected monotonic deadline window, report distinct timeout outcomes, remove direct/ordinary descendant processes, preserve target state, and clean only the owned temp root.

## Recommended Fix

Remove verbose-diagnostic substring classification. Invoke GNU timeout with `--preserve-status`, measure monotonic elapsed wall time around `spawnSync()`, and classify deadline expiry only when the configured wall-clock budget was actually consumed (with a small scheduler tolerance), using resulting status to distinguish TERM (`143`) and KILL (`137`) where available. A process that consumes the full deadline is operationally timed out even if it exits during the boundary; an immediate status `124` remains an ordinary child failure, eliminating GNU timeout's default `124` ambiguity.

Handle the outer `spawnSync` ETIMEDOUT first, then deadline-consumed outcomes, then ordinary error/signal/status and output checks. Keep timeout stderr as ordinary child/wrapper output subject to existing noise policy; do not parse it for authority.

## Debugging Record

```text
Problem: Child stderr can spoof watchdog timeout state.
Observed symptom: Immediate fake npm exit 7 with forged TERM text is reported as a 120-second timeout.
Root cause: Timeout classification uses an untrusted merged-stderr substring before status handling.
Evidence: runPinnedNpm lines 242-247; immediate QA reproduction with no signal and real status 7.
Failed approaches: GNU --verbose added observability but not provenance because wrapper and child share stderr.
Corrective action: --preserve-status plus monotonic deadline consumption and status-backed TERM/KILL classification; no stderr authority.
Verification test: Spoof text across 0/7/124/signals remains real outcome; genuine TERM/KILL deadlines stay bounded and distinct.
Related files/components: scripts/release-pack-policy.js; scripts/validate-release-pack-policy.js; 6fc/r39/nji/qmc/cf1/1wu/nme.
Remaining uncertainty: None for pinned GNU coreutils 9.4.
```
