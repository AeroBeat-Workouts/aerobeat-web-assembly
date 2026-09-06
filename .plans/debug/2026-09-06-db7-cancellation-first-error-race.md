# DB7 cancellation versus first IndexedDB callback error race

**Date:** 2026-09-06

**Blocking bug:** `aerobeat-web-assembly-8ik` (P1)

**Blocked chain:** `aerobeat-web-assembly-8ik` → `aerobeat-web-assembly-2q6` → `aerobeat-web-assembly-570`

**Related physical bug:** `aerobeat-web-assembly-htd`

**Scope:** Diagnosis and report evidence only. No product, runtime, test, release, raw artifact, serving, publication, or physical-approval change.

**Inspected source:** `@aerobeat/web-content-authoring` commit `9cd5136e26318ed9dd37ea9c6fe2fc5dccfa7ac5`, especially `src/persistence.js` `putIndexedDbCollection`, `garbageCollectIndexedDbAssets`, `guardedIdbCallback`, and `transactionStorageError`.

## Exact Observed Failure

A deterministic fake-IndexedDB probe seeded a current schema-7 database with one package whose otherwise valid exact current shape had one hostile extra own key. It then invoked `putCollection` with a non-aborted `AbortSignal`. The probe instrumented the transaction abort boundary so the signal became aborted after the guarded garbage-collection decoder had already called `tx.abort()`, but before the transaction's `abort` event was delivered.

The public result was:

```json
{
  "outcome": {
    "status": "rejected",
    "name": "AeroAuthoringStorageError",
    "code": "operation_aborted",
    "message": "Persistence operation was cancelled"
  },
  "abortCalls": 2,
  "uncaught": {
    "name": "InvalidStateError",
    "message": "An operation was called on an object on which it is not allowed or at a time when it is not allowed. Also occurs if a request is made on a source object that has been deleted or removed. Use TransactionInactiveError or ReadOnlyError when possible, as they are more specific variations of InvalidStateError."
  },
  "signalAborted": true
}
```

The first causal failure was not cancellation. `garbageCollectIndexedDbAssets` decoded the hostile stored package first, and `copyRecord` produced:

```text
AeroAuthoringStorageError
code: storage_record_invalid
message: Stored package record shape is invalid
```

That first decoder error was recorded in `transactionCallbackErrors` and initiated the first transaction abort. Before `tx.onabort` ran, the signal changed to `aborted`. The public promise therefore reported cancellation instead of the recorded decoder error, and the signal listener attempted a second abort that escaped as `InvalidStateError`.

A first probe without an `uncaughtException` collector exited nonzero at the second abort with the stack rooted at:

```text
InvalidStateError [DOMException]
  at FDBTransaction.abort
  at IDBTransaction.abort
  at AbortSignal.abort (src/persistence.js:153)
  at AbortController.abort
```

Directly observed facts:

- the first guarded decoder error existed before signal cancellation;
- the public rejection lost that first error and became `operation_aborted`;
- `tx.abort()` was invoked twice;
- the second call emitted an uncaught `InvalidStateError` in fake IndexedDB;
- the external public promise still settled once, because native promises ignore later resolve/reject attempts;
- the write transaction remained atomic and did not partially commit the staged package, collection, or shared asset;
- no product/runtime/test file was edited to obtain the result.

Real Chromium has not yet been driven through this exact controlled interleaving. Existing real-Chromium callback coverage passes only when the hostile `putCollection` case has no signal. Browser reproduction and browser-specific event/noise evidence remain required.

## Expected Behavior

The public persistence result must follow the first causal failure, not whichever condition happens to be visible when the asynchronous transaction terminal event is delivered.

Required ordering semantics:

1. **Decoder error first:** if a guarded package, collection, or shared-asset decoder records an `AeroAuthoringStorageError` before user cancellation initiates abort, that exact original error object/code/message is authoritative. Later `signal.aborted` state must not replace it.
2. **User cancellation first:** if cancellation initiates transaction abort before any decoder error is recorded, the operation must reject once with `AeroAuthoringStorageError`, code `operation_aborted`, message `Persistence operation was cancelled`.
3. **No second abort leak:** cancellation and guarded failure may converge on one transaction, but all abort attempts must be idempotent and exception-safe. `InvalidStateError` must not escape an `AbortSignal` listener or native IndexedDB callback.
4. **Atomicity:** either terminal path must expose no partial package, collection, or shared-asset write.
5. **Bounded settlement:** the public operation must settle exactly once within the test deadline.
6. **Completion cleanup:** after transaction completion has become authoritative, the signal listener must be removed before a later cancellation can call `abort()` on a completed transaction. Cancellation after successful completion must not change the fulfilled result or emit noise.
7. **Browser silence:** real Chromium must emit zero `pageerror`, `unhandledrejection`, console warning, or console error events.

## Execution Path

### Decoder error first, then cancellation — observed failing order

1. `adapter.putCollection(batch, { signal })` validates/copies the caller batch and verifies the signal is not already aborted.
2. `putIndexedDbCollection` creates one read/write transaction over `assets`, `packages`, and `collections`.
3. It defines `abort = () => tx.abort()` and registers it as a once-only signal listener.
4. It stages shared assets, package rows, and the collection row.
5. It calls `garbageCollectIndexedDbAssets(tx)` before the transaction can complete.
6. GC starts `packages.getAll()`.
7. The guarded `packageRequest.onsuccess` iterates stored rows and calls `copyRecord`.
8. The hostile current DB7 row fails exact-key validation with `storage_record_invalid / Stored package record shape is invalid`.
9. `guardedIdbCallback` catches that exact error, stores it in `transactionCallbackErrors`, and calls `tx.abort()`.
10. Before the transaction's `abort` event is delivered, the supplied signal becomes aborted.
11. The raw signal listener calls `tx.abort()` again. Since the transaction is already aborting/inactive, fake IndexedDB throws `InvalidStateError`; the listener does not catch it.
12. `tx.onabort` removes the listener and evaluates `signal?.aborted` first.
13. Because the signal is now aborted, it constructs `operation_aborted` instead of calling `transactionStorageError`, even though the WeakMap already contains the earlier exact decoder error.
14. The public promise rejects once with the wrong error; the uncaught second-abort exception is separately observable host noise.

### Cancellation first — intended valid order

1. A non-aborted signal is registered before transaction work settles.
2. User cancellation dispatches the signal event before a guarded decoder error has been recorded.
3. The listener initiates `tx.abort()`.
4. Pending writes roll back; pending request success callbacks should not become authoritative decoder failures.
5. `tx.onabort` should return `operation_aborted` because cancellation was the first recorded cause.

Current code does not explicitly record that cancellation initiated abort. It infers causality later from the signal's current `aborted` property. That inference happens to give the intended result when cancellation is unambiguously first, but it cannot distinguish the observed decoder-first interleaving.

### Cancellation after internal completion but before completion-handler cleanup — risk window

1. IndexedDB internally reaches a completed/committed state.
2. The JavaScript `tx.oncomplete` callback has not yet run, so the signal listener remains registered.
3. The signal aborts during this interval.
4. The listener calls `tx.abort()` on a completed transaction and may throw `InvalidStateError`.

This exact window is not yet reproduced. Once `tx.oncomplete` begins, it removes the listener before resolving, and JavaScript run-to-completion prevents a later signal event from interleaving inside that handler. Cancellation strictly after listener removal is therefore harmless. The uncovered risk is the interval before handler delivery/removal, not ordinary cancellation after the fulfilled promise is already observed.

## Confirmed Root Cause

The root cause is **terminal cause inferred from mutable signal state instead of latched at the moment abort is initiated**, combined with a non-idempotent, exception-unsafe signal listener.

Current code has two independent abort initiators:

```js
const abort = () => tx.abort();
signal?.addEventListener("abort", abort, { once: true });
```

and:

```js
transactionCallbackErrors.set(tx, bounded);
try { tx.abort(); } catch {}
```

The guarded decoder path correctly records the first storage error before aborting. However, `putIndexedDbCollection`'s terminal handler ignores that ordering whenever the signal happens to be aborted by event-delivery time:

```js
reject(signal?.aborted
  ? storageError("operation_aborted", "Persistence operation was cancelled")
  : transactionStorageError(tx, ...));
```

`transactionStorageError` already implements the correct stored-error-first lookup, but it is bypassed by the signal branch. The signal listener also calls `tx.abort()` without a state latch or `try/catch`, unlike the guarded callback's exception-safe abort attempt.

The causal chain is confirmed by the deterministic probe: first storage error, first guarded abort, subsequent signal abort, two total abort calls, masked public error, and uncaught `InvalidStateError`.

## Alternative Hypotheses

1. **The signal cancellation actually happened first. — Contradicted in the probe.** Instrumentation aborts the signal only after the guarded path has entered the first `tx.abort()`. The hostile decoder therefore precedes cancellation.
2. **The hostile input batch fails before opening IndexedDB. — Contradicted.** The caller batch is valid. The hostile row is pre-existing stored DB7 data discovered only by GC's `packages.getAll()` decoder.
3. **`transactionStorageError` loses the first error. — Contradicted.** It checks `transactionCallbackErrors.get(tx)` first. The loss occurs because `tx.onabort` bypasses this helper when `signal.aborted` is true.
4. **The second abort is harmless in all implementations. — Contradicted for fake IndexedDB; unknown for Chromium.** Fake IndexedDB throws `InvalidStateError`, matching IndexedDB's invalid-state behavior. Chromium may throw synchronously, ignore a redundant abort in a narrower state, or differ in terminal event timing; only a real-browser oracle can settle that implementation detail.
5. **Promise exactly-once settlement prevents the bug. — Contradicted.** Promise semantics prevent externally visible double settlement, but they do not restore the correct first error and do not suppress an exception thrown by an event listener.
6. **Atomic rollback failure is the defect. — Not observed.** The transaction rolls back. The confirmed defects are error precedence and uncaught noise. Atomicity must remain covered because a repair changes abort coordination.
7. **This is only test instrumentation and cannot occur naturally. — Not established.** The instrumentation controls an otherwise valid asynchronous ordering: guarded IDB failure starts abort, then an external cancel arrives before terminal-event delivery. Production service cancellation, replacement, and destruction can abort the same signal during persistence. The exact natural frequency is unknown, but correctness cannot depend on task timing.

## Why Prior Fixes and Tests Missed It

Commit `9cd5136` repaired the previously confirmed native IDB callback leaks by guarding decoder-bearing request callbacks and recovering `transactionCallbackErrors` from transaction handlers. That work correctly covered delete, conditional delete, nested legacy lookup, GC, collection cleanup, shared-asset reads, and completion-time asset resolution.

The remaining gap is a composition between that new guarded-error channel and the pre-existing cancellation channel:

- hostile `putCollection` cases in `validate-indexeddb-callback-bounds.js` and `validate-browser-indexeddb-callback-bounds.js` pass no signal;
- cancellation coverage in `validate-persistence-collections-indexeddb.js` aborts the controller before calling `putCollection`, so `assertNotAborted` rejects before a transaction exists;
- service cancellation tests abort conversion/worker phases or use adapters that do not force a hostile GC decoder failure during the same IndexedDB transaction;
- exactly-once helpers count public promise observation, not internal abort attempts or uncaught signal-listener exceptions;
- zero-browser-noise assertions never exercise hostile GC plus concurrent signal cancellation;
- transaction handlers were audited for recovery of `transactionCallbackErrors`, but the `signal.aborted ? ... : transactionStorageError(...)` precedence exception was not treated as a separate first-cause policy.

The previous repair addressed the reported decoder callback inventory. It did not model competing abort initiators or latch their causal order.

## Unknowns

- Whether real Chromium throws `InvalidStateError` for the exact second-abort timing used by fake IndexedDB.
- Whether Chromium reports that listener exception as `pageerror`, console error, both, or another host error surface.
- The precise browser task ordering between a guarded request callback's `tx.abort()`, an external signal event, `tx.onerror`, and `tx.onabort` across supported Chromium versions.
- Whether cancellation in the internally-completed/before-`oncomplete` window can be made deterministic in both fake IDB and Chromium without prototype instrumentation.
- Whether service-level cancellation, job replacement, or `destroy()` naturally reaches this persistence window often enough for an end-to-end reproduction.
- Whether a browser may deliver both `error` and `abort` handlers for a single transaction in a way that increases internal reject attempts; external promise settlement remains once, but tests should observe handler counts if the implementation exposes them.
- The desired tie policy if cancellation and decoder failure occur in the same JavaScript task without an observable strict order. The safest contract is first latched cause; the implementation/test must define where each cause is latched.

Each unknown should be resolved with a focused fake-IDB and real-Chromium transaction-order oracle before accepting a repair.

## Minimal Reproduction

1. Create a fresh schema-7 IndexedDB database with `packages`, `assets`, `collections`, and `meta` stores.
2. Seed one current package row that is valid except for one extra own key, so `copyRecord` fails only when GC scans stored packages.
3. Construct a valid replacement collection batch and an initially non-aborted `AbortController`.
4. Instrument or coordinate the first transaction abort so the controller aborts after `guardedIdbCallback` records the package shape error and initiates `tx.abort()`, but before `tx.onabort` executes.
5. Call `adapter.putCollection(batch, { signal })`.
6. Capture the public rejection, abort-call count, uncaught exceptions, database contents before/after, elapsed time, and settlement count.
7. Observe current behavior: public `operation_aborted`, two abort calls, uncaught `InvalidStateError` in fake IDB, and atomic rollback.

Control cases:

- no signal: the same hostile row returns the exact first `storage_record_invalid` error with atomic rollback;
- already-aborted signal: `assertNotAborted` returns `operation_aborted` before transaction creation;
- cancellation clearly before any decoder error: cancellation should remain `operation_aborted`;
- successful completion followed by cancellation after listener removal: result remains fulfilled and no abort/noise occurs.

## Proposed Verification

Add diagnosis-stage or eventual repair regressions that distinguish cause ordering rather than merely checking that some rejection occurs:

1. **Decoder-first fake IDB:** hostile GC records `storage_record_invalid`; then signal aborts before terminal event. Require the exact original name/code/message, one external settlement, one effective abort, bounded time, complete package/collection/asset rollback, and zero uncaught exception.
2. **Decoder-first real Chromium:** run the same controlled order and assert zero `pageerror`, `unhandledrejection`, console warning, and console error.
3. **Cancellation-first fake and Chromium:** abort the signal while the transaction is active but before hostile decoding becomes authoritative. Require exact `operation_aborted`, rollback, bounded one settlement, and no later decoder replacement.
4. **No-signal hostile control:** retain the current exact `storage_record_invalid` result.
5. **Completion boundary:** cancel immediately before and immediately after completion-listener cleanup. A completed operation must not call `tx.abort()` or emit `InvalidStateError`; an active cancellation must remain atomic.
6. **Repeated/reentrant abort delivery:** prove the signal listener is idempotent and exception-safe even when another abort initiator has already acted.
7. **Service-level integration:** where feasible, cancel/replace/destroy an authoring job during `putCollection` GC and verify the same first-cause policy.
8. Preserve all existing 10-valid/18-hostile public-operation matrices, migration preservation, stale recovery, browser-noise, security, real-map, assembly download, and immutable-release gates.

## Smallest Recommended Fix

Do not change validators, schemas, migration formats, stale-content policy, key/token deletion semantics, or package data.

The smallest complete repair should coordinate the two abort causes inside `putIndexedDbCollection`:

1. Replace the raw signal listener with an idempotent, exception-safe cancellation handler.
2. Latch cancellation as the transaction's abort cause only when cancellation actually initiates abort and no earlier callback error is already recorded.
3. In `tx.onerror` and `tx.onabort`, give an already-recorded `transactionCallbackErrors` entry precedence over later signal state; otherwise use the latched cancellation cause, then the normal IndexedDB fallback.
4. Remove the signal listener on every terminal path, including completion, error, and abort.
5. Treat `InvalidStateError` from an abort attempt after abort/completion as a benign internal race only after cause state has been latched; never let it escape the listener.
6. Preserve exact pre-transaction `assertNotAborted` behavior and genuine cancellation-first `operation_aborted` semantics.

A minimal shape is a transaction-local first-cause latch plus one safe abort helper, rather than broad error swallowing. The implementation must still rely on the existing transaction rollback and `transactionStorageError` mechanism for decoder failures.

Regression risks:

- incorrectly making every signaled transaction report storage failure even when cancellation truly occurred first;
- swallowing unrelated exceptions instead of only bounding redundant/late transaction abort;
- retaining the signal listener after terminal settlement;
- changing atomicity, quota mapping, or cancellation messages;
- introducing multiple competing terminal handlers or hidden partial commits.

## Debugging Record

```text
Problem: putIndexedDbCollection does not preserve first-cause error ordering when guarded DB decoding and user cancellation race.
Observed symptom: Decoder-first hostile GC plus later signal abort rejects operation_aborted instead of storage_record_invalid, calls tx.abort twice, and leaks uncaught InvalidStateError in fake IndexedDB.
Root cause: tx.onabort infers cause from mutable signal.aborted state and bypasses transactionStorageError; the raw signal listener calls tx.abort without an idempotent latch or exception guard.
Evidence: Current 9cd5136 source inspection and deterministic fake-IDB output showing operation_aborted, abortCalls=2, uncaught InvalidStateError, signalAborted=true after a first recorded package-shape error.
Failed approaches: Existing hostile matrices omit signals; existing cancellation test aborts before transaction creation; callback audit did not compose decoder and cancellation abort initiators.
Corrective action: Use one transaction-local first-cause latch and safe idempotent abort helper; preserve recorded decoder error over later signal state and preserve genuine cancellation-first semantics.
Verification test: Fake-IDB and real-Chromium decoder-first, cancellation-first, no-signal, and completion-boundary matrices with exact errors, one effective abort/settlement, rollback, bounded time, and zero host/browser noise.
Related files/components: aerobeat-web-content-authoring/src/persistence.js putIndexedDbCollection, garbageCollectIndexedDbAssets, guardedIdbCallback, transactionStorageError; authoring service cancel/replace/destroy paths.
Remaining uncertainty: Exact Chromium second-abort/error-event behavior and deterministic natural service-level timing remain to be measured.
```

## First-cause repair — CODER PASS / fresh QA pending (2026-09-06)

- Pushed authoring commit `90d91175085ffa59b0c9655c01a0be5c6f89823c` / tree `27439525afc79c97f5f0ee004eb436432a0663cb` implements the minimal repair in `putIndexedDbCollection`. Cancellation now stores its exact `operation_aborted / Persistence operation was cancelled` object in the same transaction-local WeakMap latch used by guarded decoder failures, but only if no earlier cause exists. Decoder-first therefore keeps the exact original stored-record error; cancellation-first remains exact cancellation.
- The collection transaction owns one idempotent `safeAbort` coordinator. Guarded package GC receives and uses that coordinator, the signal path uses the same coordinator, and redundant/reentrant requests become inert. A late native `InvalidStateError` is caught at this private coordination boundary rather than escaping an AbortSignal callback. Terminal complete/error/abort handlers all remove the signal listener, and terminal error selection always reads the first transaction-local cause.
- Pre-aborted signals still reject before transaction creation. Post-completion signals are inert after listener cleanup. Exact validators, schema 7, DB5/DB6→DB7 reconstruction, package/collection/shared-asset data, delete/key/token semantics, stale management behavior, and the prior 10-valid/18-hostile matrix are unchanged.
- Deterministic fake-IDB and real Chromium matrices now add decoder-first, cancellation-first, pre-aborted, post-completion, repeated/reentrant signal delivery, exactly one observable transaction abort where applicable, exactly one promise settlement, bounded completion, complete package+collection+asset rollback, terminal-listener cleanup, and zero Chromium page/unhandled/warning/error noise. The prior no-signal hostile matrix remains in both environments.
- Service-level persistence-phase `cancel`, replacement, and `destroy` are covered in Node and real Chromium. The superseded operation rejects once with exact `operation_aborted`, initiates one abort, and leaves all three stores empty; replacement then commits one exact two-package/one-collection/one-shared-asset result.
- Authoring full sequential gates PASS: `npm test`, uncapped ordered `npm run test:browser`, and dry pack (`18` files; `55,679` packed / `246,601` unpacked bytes; SHA-1 `848052d940b30b4952964b429651899d035d207d`).
- Assembly pins the new commit/tree and fingerprint `80ef365cb8c811ed01f3da9df76ff92d4203d627d4c5d87840885a481a5136e6` over `202` inputs. Sequential PASS: full `npm test`, normal build, q7g, uncapped full browser, focused migration/download/mobile/privacy/immutable/release gates, and dry pack (`121` files; `16,199,993` packed / `17,241,729` unpacked bytes; SHA-1 `0d11202a5d17db822ab1988616cf5d3061be388b`). One first q7g attempt ended in Playwright `locator.evaluate: Resulting promise was garbage collected` at terminal fixture installation; no product/browser noise or leaked process was present, and the exact command passed alone without edits before the full browser and remaining gates passed sequentially.
- This is coder evidence only. `8ik`, `2q6`, parent QA `570`, P0 `htd`, and audit `n4x` remain open for fresh independent QA/audit. No raw `0.0.41`, serving, publication, tag, GitHub Release, or physical claim is authorized or produced.

## Fresh independent QA certification (2026-09-06)

- PASS. A new deterministic fake-IDB run against `9cd5136` independently reproduced the decoder-first/later-signal defect and exited nonzero with exact uncaught `InvalidStateError` from the second `FDBTransaction.abort`, rooted through `AbortSignal.abort` at old `src/persistence.js:153`; this confirms the first-cause masking/double-abort failure independently of coder evidence.
- Current `90d9117` passed the same fake-IDB oracle: all 10 valid + 18 hostile paths, decoder-first `storage_record_invalid / Stored package record shape is invalid`, cancellation-first and pre-aborted `operation_aborted / Persistence operation was cancelled`, no-signal success/hostile behavior, repeated/reentrant dispatch, post-completion inertness, exact one settlement, one effective abort where observable, 1,000 ms bound, complete package+collection+asset rollback, and listener cleanup. No uncaught error remained.
- Current real Chromium repeated the matrix at a 2,000 ms bound with `{validOperations:10, hostileOperations:18, raceOperations:4, serviceOperations:3}` and zero pageerror, unhandledrejection, warning, or error noise. An additional isolated no-source-edit fake-IDB and Chromium probe injected cancellation after the native transaction committed but immediately before the product `oncomplete` callback: both fulfilled once, preserved exact committed data, tolerated one exception-safe inactive abort attempt, removed the listener, ignored later/reentrant delivery, and emitted no noise; the Chromium result expanded to five race rows. Persistence-phase service cancel/replacement/destroy settled once; cancel/destroy left all stores empty and replacement atomically committed two packages, one collection, and one shared asset.
- Full authoring `npm test`, browser, security/real, and 18-file dry pack passed. Assembly `npm test`, normal build, q7g, uncapped full browser, focused migration/library/mobile/privacy/docs/Vite/immutable/release gates, and 121-file dry pack passed sequentially. Exact pins remain authoring `90d91175085ffa59b0c9655c01a0be5c6f89823c` / tree `27439525afc79c97f5f0ee004eb436432a0663cb`, assembly pre-evidence `5d078642a6781c5fa3545a35c296237d04ae4b23`, and fingerprint `80ef365cb8c811ed01f3da9df76ff92d4203d627d4c5d87840885a481a5136e6` over 202 inputs.
- Raw `0.0.35–0.0.40` remained exact; raw/tag `0.0.41` remained absent; port 5173 stayed offline; 8444 was observed but untouched; all 15 relevant repos were clean and aligned with `origin/main`. QA closes `8ik`, then `2q6`, then `570`; `htd` remains open for `n4x`. Release authorization remains **NO**.
