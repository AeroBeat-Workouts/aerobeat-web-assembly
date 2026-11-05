// @ts-check
// Browser primitive check; parent owns normal test-command wiring and signed UI integration.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
const vite = await createServer({ configFile: "vite.config.js", logLevel: "error", plugins: [{ name: "store-primitive", configureServer(server) { server.middlewares.use("/store-primitive", (_req, res) => { res.setHeader("content-type", "text/html"); res.end("<!doctype html><title>Movement storage primitive</title>"); }); } }], server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${vite.resolvedUrls.local[0]}store-primitive`);
  // The first real write is intentionally small, before capacity/fault verification.
  console.log("primitive", await page.evaluate(async () => {
    const { createMovementChunkStore, MOVEMENT_TABLES } = await import("/src/movement-chunk-store.js");
    const store = createMovementChunkStore(); await store.ready;
    for (const table of MOVEMENT_TABLES.filter(table => table !== "ticks")) {
      const row = { numeric: [Math.PI, -0, Number.MIN_VALUE], metadata: "exact" };
      if (store.append(table, row) !== 0) throw Error("Table references must start at zero"); row.numeric[0] = 9;
      const read = (await store.readRows(table, 0, 1))[0];
      if (read.numeric[0] !== Math.PI || !Object.is(read.numeric[1], -0)) throw Error("Serialized admission copy");
    }
    store.append("ticks", [Math.PI, Number.MIN_VALUE, Number.MAX_VALUE, -0]);
    await store.flush(); const rows = await store.readRows("ticks", 0, 1);
    if (!Object.is(rows[0][3], -0) || rows[0][0] !== Math.PI) throw Error("Numeric mismatch");
    const result = { indexedDB: !!indexedDB, gzip: !!CompressionStream, gunzip: !!DecompressionStream, opfs: !!navigator.storage.getDirectory, locks: !!navigator.locks, status: store.getStatus() };
    await store.dispose(); return result;
  }));
  const capacity = await page.evaluate(async () => {
    const { createMovementChunkStore, iterateMovementFile, MOVEMENT_DB_NAME } = await import("/src/movement-chunk-store.js");
    const must = (condition, message) => { if (!condition) throw Error(message); };
    const store = createMovementChunkStore({ maxPendingBytes: 2 * 1024 * 1024, chunkBytes: 128 * 1024, chunkRows: 64, maxReadRows: 128 });
    await store.ready;
    function makeRow(i) { return [i, Math.PI, -0, Number.MIN_VALUE, Number.MAX_VALUE, ...Array.from({ length: 256 }, (_, j) => Math.sin(i + j) * (j + 0.1234567890123456))]; }
    let total = 0;
    while (store.getStatus().logicalBytes <= 68 * 1024 * 1024 || total <= 120001) {
      // Small rows after >64 MiB also exercise an unbounded tick count.
      const row = total < 15000 ? makeRow(total) : [total, -0, total / 7];
      const index = store.append("ticks", row); must(index === total, "index"); row[0] = -1; total++;
      if (store.getStatus().pendingBytes > 1024 * 1024) await store.flush();
    }
    await store.flush();
    for (const i of [0, 63, 64, 15000, total - 1, 4321, 9999]) {
      const rows = await store.readRows("ticks", i, 1), expected = i < 15000 ? makeRow(i) : [i, -0, i / 7];
      must(rows[0].length === expected.length && rows[0].every((n, j) => Object.is(n, expected[j])), `exact random read ${i}`);
    }
    const spanning = await store.readRows("ticks", 63, 3);
    must(spanning.length === 3 && spanning.every((row, j) => row.every((n, k) => Object.is(n, makeRow(63 + j)[k]))), "cross-chunk bounded read");
    const exported = await store.exportFile({ schemaVersion: 3, movement: { counts: store.getCounts(), status: "complete" }, test: "synthetic-capacity" });
    must(exported.file instanceof File, "disk backed File");
    let seen = 0, foot = false;
    for await (const event of iterateMovementFile(exported.file)) {
      if (event.type === "row") {
        const expected = seen < 15000 ? makeRow(seen) : [seen, -0, seen / 7];
        must(event.index === seen && event.row.every((n, j) => Object.is(n, expected[j])), `export exact ${seen}`); seen++;
      }
      if (event.type === "footer") foot = event.complete;
    }
    must(seen === total && foot, "export footer");
    const status = store.getStatus(); must(status.pendingHighWaterBytes <= status.maxPendingBytes, "bounded pending");
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(MOVEMENT_DB_NAME);
    await exported.dispose(); await exported.dispose();
    await store.dispose(); await store.dispose();
    let removed = false; try { await root.getDirectoryHandle(status.runId); } catch (e) { removed = e.name === "NotFoundError"; }
    must(removed, "owned directory cleanup");
    return { total, fileBytes: exported.file.size, exactRoundtrip: true, removed, ...status };
  });
  console.log("capacity", capacity); assert(capacity.logicalBytes > 64 * 1024 * 1024); assert(capacity.total > 120000);
  const faults = await page.evaluate(async () => {
    const { createMovementChunkStore, MovementStoreError, MOVEMENT_DB_NAME, iterateMovementFile } = await import("/src/movement-chunk-store.js");
    const must = (condition, message) => { if (!condition) throw Error(message); };
    async function rejects(fn, code) { try { await fn(); } catch (error) { must(error.code === code, `expected ${code}, got ${error.code}: ${error.message}`); return; } throw Error(`missing ${code}`); }
    // Capability-removal injection only: the real browser capabilities were checked above.
    const nativeCompression = globalThis.CompressionStream; globalThis.CompressionStream = undefined;
    const unsupported = createMovementChunkStore(); globalThis.CompressionStream = nativeCompression;
    await rejects(() => unsupported.ready, "unsupported_storage"); await unsupported.dispose();
    let callback = 0;
    const overflow = createMovementChunkStore({ maxPendingBytes: 64, onError: () => callback++ }); await overflow.ready;
    await rejects(() => { for (let i = 0; i < 100; i++) overflow.append("ticks", [i, i, i]); }, "backpressure");
    await rejects(() => overflow.flush(), "backpressure"); must(callback === 1, "one error callback"); await overflow.dispose();
    const quota = createMovementChunkStore({ storageAdapter: { commitChunk: () => { throw new DOMException("Injected at real IDB commit", "QuotaExceededError"); } } });
    await quota.ready; quota.append("ticks", [1]); await rejects(() => quota.flush(), "quota_exceeded"); must(quota.getStatus().state === "error", "quota status"); await quota.dispose();
    const write = createMovementChunkStore({ storageAdapter: { writeExport: () => { throw new Error("Injected at real OPFS write"); } } });
    await write.ready; write.append("ticks", [1]); await rejects(() => write.exportFile({}), "storage_failed"); await write.dispose();
    const inFlight = createMovementChunkStore(); await inFlight.ready; for (let i = 0; i < 1000; i++) inFlight.append("ticks", [i]); await inFlight.dispose();
    must(inFlight.getStatus().pendingBytes === 0, "in-flight dispose drained"); await rejects(() => inFlight.readRows("ticks", 0, 1), "disposed");
    // Actual orphan data, with no live Web Lock, stands for a terminated tab.
    const db = await new Promise((resolve, reject) => { const q = indexedDB.open(MOVEMENT_DB_NAME); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
    const orphan = "injected-orphan-run";
    await new Promise((resolve, reject) => { const tx = db.transaction(["runs", "chunks"], "readwrite"); tx.objectStore("runs").put({ id: orphan }); tx.objectStore("chunks").put({ run: orphan, table: "ticks", start: 0, count: 1, blob: new Blob(["orphan"]) }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(MOVEMENT_DB_NAME); await root.getDirectoryHandle(orphan, { create: true }); db.close();
    const active = createMovementChunkStore(); await active.ready; active.append("ticks", [123]); await active.flush();
    window.activeMovementStore = active;
    const cleaner = createMovementChunkStore(); await cleaner.ready;
    let removed = false; try { await root.getDirectoryHandle(orphan); } catch (error) { removed = error.name === "NotFoundError"; } must(removed, "orphan removed");
    must((await active.readRows("ticks", 0, 1))[0][0] === 123, "active survives cleaner"); await cleaner.dispose();
    const truncated = await new Response(new Blob(['{"type":"header","format":"aerobeat-movement-jsonl","version":1,"header":{}}\n']).stream().pipeThrough(new CompressionStream("gzip"))).blob();
    await rejects(async () => { for await (const _event of iterateMovementFile(truncated)) { /* need footer */ } }, "invalid_stream");
    must(new MovementStoreError("test", "test").code === "test", "typed error");
    return { overflow: true, quota: true, write: true, dispose: true, orphan: removed, activeRun: active.getStatus().runId, malformed: true };
  });
  // A second actual tab must not remove the first tab's data.
  const second = await context.newPage(); await second.goto(`${vite.resolvedUrls.local[0]}store-primitive`);
  const crashedRun = await second.evaluate(async () => {
    const { createMovementChunkStore } = await import("/src/movement-chunk-store.js");
    const store = createMovementChunkStore(); await store.ready; store.append("ticks", [456]); await store.flush();
    window.abruptMovementStore = store; return store.getStatus().runId;
  });
  await second.close(); // Browser releases the per-run lock without any disposal call.
  await page.evaluate(async crashedRun => {
    if ((await window.activeMovementStore.readRows("ticks", 0, 1))[0][0] !== 123) throw Error("active tab deleted");
    const { createMovementChunkStore, MOVEMENT_DB_NAME } = await import("/src/movement-chunk-store.js");
    const cleaner = createMovementChunkStore(); await cleaner.ready;
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(MOVEMENT_DB_NAME);
    let missing = false; try { await root.getDirectoryHandle(crashedRun); } catch (error) { missing = error.name === "NotFoundError"; }
    if (!missing) throw Error("terminated tab orphan retained");
    await cleaner.dispose(); await window.activeMovementStore.dispose();
  }, crashedRun);
  const cancellation = await page.evaluate(async () => {
    const { createMovementChunkStore, MOVEMENT_DB_NAME } = await import("/src/movement-chunk-store.js");
    let unblock, entered;
    const gate = new Promise(resolve => { unblock = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const store = createMovementChunkStore({ storageAdapter: { writeExport: async (_bytes, write) => { entered(); await gate; return write(); } } });
    await store.ready; store.append("ticks", [42]);
    const exportTask = store.exportFile({}).then(() => "resolved", error => error.code);
    await started;
    const cleanup = store.dispose(); unblock(); await cleanup;
    const outcome = await exportTask;
    if (outcome !== "disposed") throw Error(`dispose-during-export: ${outcome}`);
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(MOVEMENT_DB_NAME);
    let removed = false; try { await root.getDirectoryHandle(store.getStatus().runId); } catch (error) { removed = error.name === "NotFoundError"; }
    if (!removed) throw Error("cancelled export remains"); return true;
  });
  console.log("faults", { ...faults, crossTabActive: true, realClosedTabOrphan: true, disposalDuringExport: cancellation });
  console.log("PASS native movement chunk storage >64MiB, >120000 ticks, bounded queue, exact numeric streaming export, faults and cleanup");
} finally { await browser.close(); await vite.close(); }
