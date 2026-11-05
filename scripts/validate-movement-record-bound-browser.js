// @ts-check
// Focused regression: ordinary chart-sized metadata/configurations must fit a bounded record.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
const vite = await createServer({ configFile: "vite.config.js", logLevel: "error", plugins: [{ name: "record-bound", configureServer(server) { server.middlewares.use("/record-bound", (_req, res) => { res.setHeader("content-type", "text/html"); res.end("<!doctype html><title>Movement record bound</title>"); }); } }], server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage(); await page.goto(`${vite.resolvedUrls.local[0]}record-bound`);
  const result = await page.evaluate(async () => {
    const { createMovementChunkStore, iterateMovementFile, MOVEMENT_MAX_RECORD_BYTES, MOVEMENT_MAX_PENDING_BYTES, MOVEMENT_MAX_LINE_BYTES } = await import("/src/movement-chunk-store.js");
    const must = (value, message) => { if (!value) throw Error(message); };
    // Synthetic chart-shaped data, not a private human recording.
    const notes = count => Array.from({ length: count }, (_, i) => ({ id: i, timeMs: i * 123.4567890123456, direction: [0.1234567890123456, 0.9876543210987654, 0.3333333333333333], position: [0.1234567890123456, 0.9876543210987654, 0.3333333333333333], controls: Array.from({ length: 24 }, (_, j) => Math.sin(i + j) * 123.4567890123456) }));
    const config830 = { notes: notes(830) }, config4096 = { notes: notes(4096) };
    const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
    const header = { version: 2, metadata: config830, movement: { schemaVersion: 2, status: "complete", counts: { configurations: 2 } } };
    must(bytes(header) >= 400000 && bytes(config830) >= 400000 && bytes(config4096) >= 2000000, "realistic fixture sizes");
    const store = createMovementChunkStore(); await store.ready;
    must(store.getStatus().maxRowBytes === MOVEMENT_MAX_RECORD_BYTES && store.getStatus().maxPendingBytes === MOVEMENT_MAX_PENDING_BYTES, "shared defaults");
    store.append("configurations", config830); store.append("configurations", config4096); await store.flush();
    const read = await store.readRows("configurations", 0, 2);
    must(JSON.stringify(read) === JSON.stringify([config830, config4096]), "large exact random read");
    const exported = await store.exportFile(header); let seen = 0;
    for await (const event of iterateMovementFile(exported.file)) {
      if (event.type === "header") must(JSON.stringify(event.header) === JSON.stringify(header), "large header roundtrip");
      if (event.type === "row") { must(JSON.stringify(event.row) === JSON.stringify([config830, config4096][seen]), "large config roundtrip"); seen++; }
    }
    must(seen === 2, "config row count"); await exported.dispose();
    // Exercise the exact payload boundary plus header/row JSON event envelopes.
    const emptyHeader = { version: 2, padding: "" };
    const boundaryHeader = { version: 2, padding: "x".repeat(MOVEMENT_MAX_RECORD_BYTES - bytes(emptyHeader)) };
    const boundaryRow = "x".repeat(MOVEMENT_MAX_RECORD_BYTES - 3); // JSON quotes + newline make exactly 8MiB.
    must(bytes(boundaryHeader) === MOVEMENT_MAX_RECORD_BYTES, "exact header boundary");
    store.append("states", boundaryRow); await store.flush();
    const boundary = await store.exportFile(boundaryHeader); let boundedHeader = false, boundedRow = false;
    for await (const event of iterateMovementFile(boundary.file)) {
      if (event.type === "header") boundedHeader = event.header.padding.length === boundaryHeader.padding.length;
      if (event.type === "row" && event.table === "states") boundedRow = event.row === boundaryRow;
    }
    must(boundedHeader && boundedRow, "event envelope allowance");
    const status = store.getStatus(); await boundary.dispose(); await store.dispose();
    const overflow = createMovementChunkStore(); await overflow.ready;
    let tooLarge = false; try { overflow.append("configurations", "x".repeat(MOVEMENT_MAX_RECORD_BYTES)); } catch (error) { tooLarge = error.code === "row_too_large"; }
    must(tooLarge, "record bound still enforced"); await overflow.dispose();
    return { headerBytes: bytes(header), config830Bytes: bytes(config830), config4096Bytes: bytes(config4096), maxRecordBytes: MOVEMENT_MAX_RECORD_BYTES, maxLineBytes: MOVEMENT_MAX_LINE_BYTES, maxPendingBytes: MOVEMENT_MAX_PENDING_BYTES, pendingHighWaterBytes: status.pendingHighWaterBytes, exactEnvelopeBoundary: boundedHeader && boundedRow };
  });
  assert.equal(result.maxRecordBytes, 8 * 1024 * 1024); assert.equal(result.maxPendingBytes, 16 * 1024 * 1024);
  console.log("PASS native Chromium large chart records and bounded JSONL envelopes", result);
  const cancellation = await page.evaluate(async () => {
    const { createMovementChunkStore, iterateMovementFile, MOVEMENT_DB_NAME } = await import("/src/movement-chunk-store.js");
    const must = (value, message) => { if (!value) throw Error(message); };
    const text = JSON.stringify({ type: "header", format: "aerobeat-movement-jsonl", version: 1, header: { version: 2 } }) + "\n" + JSON.stringify({ type: "row", table: "ticks", index: 0, row: [Math.PI, 123] }) + "\n";
    const gzip = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
    let held, admitted, cancelled = false, cancellationReason;
    const holding = new Promise(resolve => { held = resolve; });
    const admission = new Promise(resolve => { admitted = resolve; });
    const source = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(gzip)); },
      pull() { held(); return new Promise(() => {}); }, // Real pending underlying read; no more input ever arrives.
      cancel(reason) { cancelled = true; cancellationReason = reason; }
    });
    const store = createMovementChunkStore(); await store.ready;
    const controller = new AbortController();
    const task = (async () => {
      try {
        for await (const event of iterateMovementFile(source, { signal: controller.signal })) {
          if (event.type === "row") { store.append(event.table, event.row); await store.flush(); admitted(); }
        }
        throw Error("Import unexpectedly completed");
      } catch (error) { must(error === controller.signal.reason, "preserve abort reason"); }
      finally { await store.dispose(); }
    })();
    let timeout;
    try {
      await Promise.race([Promise.all([holding, admission]), new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(Error("held-read fixture did not admit row")), 3000); })]);
    } finally { clearTimeout(timeout); }
    const started = performance.now(); controller.abort();
    try {
      await Promise.race([task, new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(Error("abort stranded pending native read/import")), 3000); })]);
    } finally { clearTimeout(timeout); }
    must(cancelled && cancellationReason === controller.signal.reason, "abort must cancel underlying stream");
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(MOVEMENT_DB_NAME);
    let removed = false; try { await root.getDirectoryHandle(store.getStatus().runId); } catch (error) { removed = error.name === "NotFoundError"; }
    must(removed && store.getStatus().state === "disposed", "cancelled import temporary directory cleanup");
    const db = await new Promise((resolve, reject) => { const req = indexedDB.open(MOVEMENT_DB_NAME); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const remaining = await new Promise((resolve, reject) => { const req = db.transaction("chunks").objectStore("chunks").count(IDBKeyRange.bound([store.getStatus().runId], [store.getStatus().runId, []])); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); db.close();
    must(remaining === 0, "cancelled import temporary IDB chunks cleanup");
    return { heldReadCancelled: cancelled, abortReason: controller.signal.reason.name, disposed: removed, remainingChunks: remaining, elapsedMs: performance.now() - started };
  });
  console.log("PASS native Chromium pending-read abort and imported-store disposal", cancellation);
} finally { await browser.close(); await vite.close(); }
