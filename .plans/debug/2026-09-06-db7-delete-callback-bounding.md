# DB7 delete callback validation remains unbounded

**Date:** 2026-09-06

**QA Bead:** `aerobeat-web-assembly-570`

**Blocking bug:** `aerobeat-web-assembly-2q6` (P1)

**Disposition:** Independent QA FAIL. Diagnosis/evidence only; no product/runtime source was edited.

## Exact Observed Failure

A fresh real Chromium context was seeded with a schema-7 database containing one valid package and one collection whose otherwise valid current shape had exactly one hostile extra own key, `unknownField: true`. Current authoring source at commit `99c90350f92a656b94664ee2598a1dda24b6831d` produced:

```json
{
  "listCollections": {
    "code": "storage_record_invalid",
    "message": "Stored collection shape is invalid"
  },
  "getCollection": {
    "code": "storage_record_invalid",
    "message": "Stored collection shape is invalid"
  },
  "deleteCollection": {
    "code": "indexeddb_transaction_aborted",
    "message": "Uncaught exception in event handler."
  },
  "deletePackage": {
    "code": "indexeddb_transaction_failed",
    "message": "Uncaught exception in event handler."
  }
}
```

Chromium emitted two independent page errors:

```text
pageerror:Stored collection shape is invalid
pageerror:Stored collection shape is invalid
```

The standalone oracle then failed its zero-noise assertion with exit code 1. This is directly observed. It is not inferred from coder evidence.

Separately, immutable raw `0.0.40` was served from its exact committed directory by an ephemeral loopback-only Node server. Its proof bytes reproduced SHA-256 `cce82e47d1c00f7f2ef49e095c414c2079cf564254f3d7e1d34267d024e73af3`. A true DB5 package+collection carrying `flowObstacleContract: "source_geometry_v1"` upgraded to DB6 dual-key records and reproduced both original raw failures:

```text
AeroAuthoringStorageError: Stored package record shape is invalid
AeroAuthoringStorageError: Uncaught exception in event handler.
```

The raw record remained DB6 with both contract keys, exact seeded package/shared/inline/source bytes, refs, tokens, timestamps, hashes, and collection membership. The ephemeral server closed normally and did not bind port 5173.

## Expected Behavior

The acceptance contract requires every IndexedDB callback validation failure to be bounded, with no single hostile record causing an uncaught native event-handler exception. Public list/get/export/write/delete operations must either succeed or reject once with the original bounded storage error while the owning transaction completes or aborts atomically. Real Chromium must emit zero `pageerror`, `unhandledrejection`, warning, or error events.

## Execution Path

### `deleteCollection`

1. `adapter.deleteCollection("bad")` calls `deleteIndexedDbCollection`.
2. `collections.get(collectionId)` succeeds inside a native IndexedDB callback.
3. `request.onsuccess` directly calls `copyCollection(request.result)`.
4. `copyCollection` rejects the extra own key with `storage_record_invalid`.
5. No callback guard catches that synchronous throw.
6. Chromium reports a page error, aborts/errors the transaction, and the public promise receives generic `indexeddb_transaction_aborted / Uncaught exception in event handler.` rather than the bounded original error.

### `delete(package)`

1. `adapter.delete("valid")` calls `deleteExisting`.
2. Its package-key request succeeds and calls `removeIndexedDbPackageFromCollections(tx,key)`.
3. That helper's `collections.getAll().onsuccess` loops rows and directly calls `copyCollection(value)`.
4. The same hostile collection synchronously throws from the native callback.
5. Chromium reports a second page error and the public promise receives generic `indexeddb_transaction_failed / Uncaught exception in event handler.`

## Most Likely Root Cause

Confirmed: the DB7 repair guards selected decode callbacks with `guardedIdbCallback`, but it does not guard all callbacks that invoke strict record validators. In current `src/persistence.js`, `listIndexedDbCollections`, `getIndexedDbCollection`, `getIndexedDbPackage`, and garbage collection use the new guard, while `deleteIndexedDbCollection` and `removeIndexedDbPackageFromCollections` still invoke `copyCollection` from raw `onsuccess` handlers. The two remaining direct callbacks exactly match the two observed page errors.

## Alternative Hypotheses

1. **Chromium/Vite noise:** contradicted. The only captured page errors are the two exact validation messages, each aligned with one delete operation.
2. **Malformed package or shared asset:** contradicted. The package row and shared asset are valid current DB7 shapes; list/get collection operations deliberately return the expected bounded collection-shape error.
3. **Migration rollback failure:** contradicted for this reproduction. The database starts at version 7, so no upgrade runs. This isolates callback handling after open from versionchange behavior.
4. **Timeout or unsettled promise:** contradicted. Both delete promises settle inside the 2-second bound, but with generic event-handler transaction errors after leaking page errors.

## Why Previous Fixes Failed

The repair correctly added a `WeakMap` for callback errors and wrapped list/get/GC validation callbacks. It did not enumerate every native IndexedDB callback that can call `copyRecord`, `copyCollection`, or `copySharedAssetRecord`. Existing tests cover hostile DB6 versionchange rollback and guarded list/get paths, but do not inject a hostile current DB7 row and exercise delete/deleteCollection/deleteIfToken across the same strict validators. The fix therefore addressed the original list path but not the full stated callback invariant.

## Unknowns

- `deleteIfToken` uses the same unguarded collection-removal helper and is highly likely to leak identically, but this first blocker reproduction stopped after two independently observed page errors.
- A hostile package row encountered by collection deletion/GC may expose additional unguarded callbacks; the complete public-operation matrix belongs in the blocker repair QA.
- Ordinary non-hostile user data migration remains covered by passing tests; this failure is specifically the hostile-record/no-uncaught-event acceptance case.

## Minimal Reproduction

1. Serve current assembly source through its normal Vite config on an ephemeral loopback port.
2. In a fresh Chromium context, create `aerobeat-web-content-authoring`-compatible stores at version 7.
3. Insert one exact valid current package and one otherwise valid current collection with one extra own key.
4. Construct `createIndexedDbPersistenceAdapter({databaseName})`.
5. Verify `listCollections` and `getCollection` reject with `storage_record_invalid` and emit no page error.
6. Invoke `deleteCollection` and then `delete(package)`.
7. Observe one page error per operation plus generic `Uncaught exception in event handler.` transaction errors.

Conditions that do not reproduce: removing the hostile extra key, or calling only the already-guarded list/get paths.

## Proposed Verification

Add real Chromium coverage that seeds hostile package and collection rows in a current DB7 database and exercises list, get, get-for-export, listCollections, getCollection, put, putCollection, delete, deleteCollection, and deleteIfToken. For every operation, assert exactly one bounded rejection carrying the original code/message, transaction atomicity, and an empty capture for `pageerror`, `unhandledrejection`, console warning, and console error. This distinguishes complete callback guarding from migration-only rollback coverage.

## Recommended Fix

Do not weaken exact-record validation. Wrap every remaining native IndexedDB callback that can synchronously invoke a strict record decoder with the same transaction-bound guard, and have transaction error/abort handlers recover the stored original bounded error. Preserve one-settlement behavior and atomicity. The implementation is explicitly outside this QA role; no product/runtime source change was made.

## Debugging Record

```text
Problem: DB7 repair does not bound every IndexedDB callback validation failure.
Observed symptom: deleteCollection and delete(package) each emit pageerror and reject with generic Uncaught exception in event handler transaction errors for one hostile current DB7 collection row.
Root cause: deleteIndexedDbCollection and removeIndexedDbPackageFromCollections call copyCollection from unguarded native onsuccess callbacks.
Evidence: Fresh real Chromium current-source reproduction; two exact page errors; source inspection at authoring 99c90350.
Failed approaches: The repair/test matrix covered versionchange rollback and guarded list/get/GC paths but did not enumerate delete callbacks.
Corrective action: Guard all remaining decoder callbacks and preserve the original bounded transaction error.
Verification test: Hostile current-DB7 real Chromium public-operation matrix with exact error, atomicity, and zero page/console/unhandled noise assertions.
Related files/components: aerobeat-web-content-authoring/src/persistence.js deleteIndexedDbCollection, deleteExisting, conditionalDelete, removeIndexedDbPackageFromCollections.
Remaining uncertainty: Whether additional hostile package/shared-asset delete paths leak beyond the two confirmed collection-driven cases.
```

## Blocker repair — CODER PASS / independent QA pending (2026-09-06)

- Pushed authoring commit `9cd5136e26318ed9dd37ea9c6fe2fc5dccfa7ac5` / tree `5932d4b7c8ac470754ac400f16dbf9a6b977564f` implements the smallest callback-boundary repair. `guardedIdbCallback` now preserves the first original `AeroAuthoringStorageError`, refuses to start later guarded callback work after that transaction has recorded an error, deliberately aborts active transactions, and can reject a post-completion readonly resolution callback without leaking an exception.
- Every native request callback that directly calls or can start a helper containing `copyRecord`, `copyCollection`, `copySharedAssetRecord`, or `resolveRecordAssets` was re-enumerated. The repair guards `deleteIndexedDbCollection`, its nested legacy lookup, `removeIndexedDbPackageFromCollections`, `deleteExisting`, `conditionalDelete`, package/shared-asset reads, collection/list reads, and asset GC. Every write transaction that can fail from guarded GC or collection cleanup now recovers the recorded original error through `transactionStorageError`. Upgrade cursors retain their dedicated bounded migration mechanism, preserve the first upgrade error, and skip later cursor work after it is recorded.
- Strict exact-record validators, database/schema version 7, current and historical formats, migration reconstruction, normal key/token delete behavior, and stale management semantics are unchanged. No user database reset/delete, error swallowing, broad quarantine, obsolete-format acceptance, package/collection/asset mutation, or raw-release change was introduced.
- New fake-IDB coverage runs all ten adapter public operations (`list`, `get`, `getForExport`, `listCollections`, `getCollection`, `put`, `putCollection`, `delete`, `deleteCollection`, `deleteIfToken`) in valid current DB7 databases plus 18 hostile package/collection/shared-asset cases. It proves the exact original `storage_record_invalid` message, one settlement, a `1000 ms` bound, complete package+collection+asset rollback, and intentional deletion of a hostile target by exact key/token without decoding it.
- New real Chromium current-DB7 coverage runs the same ten valid operations and 18 hostile cases with a `2000 ms` bound. It proves exact code/message/name, one settlement, package+collection+asset rollback, valid hostile-target delete semantics, and zero `pageerror`, `unhandledrejection`, console warning, or console error noise.
- Authoring gates PASS: `npm test` (static/unit/security/real), `npm run test:browser` (secure/insecure conversion plus current-DB7 callback matrix), and dry pack (`18` files; `55,478` packed / `245,979` unpacked bytes; SHA-1 `cfe26ee3f4e429db63ce6e93d30301201c7434ad`).
- Assembly integration now pins that exact authoring commit/tree and fingerprint `63db87c1e16119a4366beed4fd3a4c2cddc0ed0b1044c0a34e8808878b2e5acf` over `202` inputs. The existing true DB5→faulty DB6→DB7 Chromium oracle remains PASS with exact data preservation, stale export/delete/current reimport/list refresh, and no silent rewrite. Raw `0.0.40` and all predecessors remain byte-immutable; no successor build, serving change, publication, tag, GitHub Release, or physical claim occurred.
- Assembly gates PASS against the clean pin: `npm test`, normal `npm run build`, `npm run test:q7g-oracles`, complete `npm run test:browser`, focused true DB5→faulty DB6→DB7 migration, synthetic download, mobile, obstacle privacy, docs, Vite allowlist, immutable snapshot/mutation, release target/pack policy, and dry pack (`121` files; `16,199,985` packed / `17,241,713` unpacked bytes; SHA-1 `089a228bcffe94dbcfddf40d72e478d3cf6ee7f5`). One isolated mobile run timed out at its recovery wait while multiple heavy Chromium suites ran concurrently; the same shard passed inside the full browser run and passed again alone after contention ended, so no source/test relaxation was made.
- Bead `aerobeat-web-assembly-2q6` remains open for independent QA. Parent QA `570`, P0 `htd`, and audit `n4x` remain open; release authorization remains **NO**.

## Cancellation first-cause follow-up — CODER PASS / fresh QA pending (2026-09-06)

- Linked blocker `8ik` is repaired in pushed authoring `90d91175085ffa59b0c9655c01a0be5c6f89823c` / tree `27439525afc79c97f5f0ee004eb436432a0663cb`. `putIndexedDbCollection` now latches cancellation into the same transaction-local first-error map as decoder errors and coordinates signal/GC abort through one idempotent exception-safe helper.
- Decoder-first retains exact `storage_record_invalid`; cancellation-first retains exact `operation_aborted`; pre-aborted, no-signal, post-completion, repeated/reentrant delivery, rollback, listener cleanup, one settlement/effective abort, and zero Chromium noise are deterministic in fake IDB and real Chromium. Persistence-phase service cancel/replace/destroy also pass in Node and Chromium.
- The prior 10-valid/18-hostile matrix, strict validators, DB5→6→7 data, and delete semantics remain unchanged. Assembly pin/fingerprint and full sequential evidence are recorded in the race report and active plan. `8ik`, `2q6`, `570`, `htd`, and `n4x` stay open; release authorization remains **NO**.
