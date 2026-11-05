// @ts-check
// Temporary numeric recordings: bounded admission, native gzip, IndexedDB and OPFS.
export const MOVEMENT_STREAM_FORMAT = "aerobeat-movement-jsonl";
export const MOVEMENT_STREAM_VERSION = 1;
export const MOVEMENT_TABLES = Object.freeze(["inputs", "rawPoses", "models", "configurations", "equipmentHeaders", "equipment", "observations", "ticks", "metadata", "states"]);
export const MOVEMENT_DB_NAME = "aerobeat-movement-temporary-v1";
const ROOT = "aerobeat-movement-temporary-v1";
const encoder = new TextEncoder();
export class MovementStoreError extends Error {
  constructor(code, message, cause) { super(message, { cause }); this.name = "MovementStoreError"; this.code = code; }
}
const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
function transaction(db, stores, fn) {
  return new Promise((resolve, reject) => { const tx = db.transaction(stores, "readwrite"); tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error("Storage transaction aborted")); fn(tx); });
}
function range(run, table) { return IDBKeyRange.bound(table ? [run, table, 0] : [run], table ? [run, table, Infinity] : [run, []]); }
async function openDatabase() {
  const req = indexedDB.open(MOVEMENT_DB_NAME, 1);
  req.onupgradeneeded = () => { req.result.createObjectStore("runs", { keyPath: "id" }); req.result.createObjectStore("chunks", { keyPath: ["run", "table", "start"] }); };
  return request(req);
}
function storageError(error) { return error instanceof MovementStoreError ? error : new MovementStoreError(error?.name === "QuotaExceededError" ? "quota_exceeded" : "storage_failed", error?.message || "Temporary movement storage failed", error); }
function positive(value, fallback) { const n = value ?? fallback; if (!Number.isSafeInteger(n) || n < 1) throw new TypeError("Buffer limits must be positive safe integers"); return n; }
// JSON preserves finite IEEE-754 numbers, including negative zero via a tagged value.
function serialize(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "number") { if (!Number.isFinite(item)) throw new TypeError("Movement numbers must be finite"); if (Object.is(item, -0)) return { $movementNegativeZero: true }; }
    if (item === undefined || typeof item === "bigint" || typeof item === "function" || typeof item === "symbol") throw new TypeError("Movement rows must be JSON data");
    return item;
  });
}
function parse(text) { return JSON.parse(text, (_key, item) => item && item.$movementNegativeZero === true && Object.keys(item).length === 1 ? -0 : item); }
async function gzip(text) { return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).blob(); }
async function decode(blob) { return new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text(); }

/** Synchronous admission returns a zero-based table reference; await ready before sustained capture.
 * Options bound working memory only, never total recording size. storageAdapter is a fault-test seam
 * at the real commit/write boundary: commitChunk(record, commit), writeExport(bytes, write).
 */
export function createMovementChunkStore(options = {}) {
  const maxPendingBytes = positive(options.maxPendingBytes, 4 * 1024 * 1024);
  const chunkBytes = positive(options.chunkBytes, 256 * 1024);
  const chunkRows = positive(options.chunkRows, 256);
  const maxReadRows = positive(options.maxReadRows, 1024);
  const maxRowBytes = positive(options.maxRowBytes, 256 * 1024);
  const run = crypto.randomUUID(), counts = Object.fromEntries(MOVEMENT_TABLES.map(t => [t, 0]));
  let db, root, directory, releaseLock, lockTask, failure = null, disposed = false, disposing = false, initialized = false;
  let pendingBytes = 0, pendingHighWaterBytes = 0, logicalBytes = 0, committedBytes = 0, commits = 0;
  let buffers = new Map(), tail = Promise.resolve(), disposeTask;
  const exports = new Set();
  const fail = error => { if (!failure) { failure = storageError(error); try { options.onError?.(failure); } catch { /* reporting must not affect gameplay */ } } return failure; };
  function check() { if (disposed || disposing) throw new MovementStoreError("disposed", "Movement store is disposed"); if (failure) throw failure; }
  async function removeRun(id) {
    // Keep the run record until both stores are gone, so interrupted cleanup is retryable.
    try { await root.removeEntry(id, { recursive: true }); } catch (error) { if (error.name !== "NotFoundError") throw error; }
    await transaction(db, ["chunks", "runs"], tx => { tx.objectStore("chunks").delete(range(id)); tx.objectStore("runs").delete(id); });
  }
  const ready = (async () => {
    if (!globalThis.indexedDB || !globalThis.CompressionStream || !globalThis.DecompressionStream || !navigator.storage?.getDirectory || !navigator.locks) throw new MovementStoreError("unsupported_storage", "Recording needs IndexedDB, gzip streams, OPFS and Web Locks");
    // Acquire before publishing the run. Orphan cleanup can never remove an active tab's run.
    await new Promise((resolve, reject) => {
      lockTask = navigator.locks.request(`${ROOT}:${run}`, async () => { resolve(); await new Promise(done => { releaseLock = done; }); });
      lockTask.catch(reject);
    });
    root = await (await navigator.storage.getDirectory()).getDirectoryHandle(ROOT, { create: true });
    db = await openDatabase();
    // Cursor, not getAll: retained run metadata is not a growing JS array.
    let after;
    for (;;) {
      const cursor = await request(db.transaction("runs").objectStore("runs").openCursor(after ? IDBKeyRange.lowerBound(after, true) : undefined));
      if (!cursor) break;
      const id = cursor.key; after = id;
      await navigator.locks.request(`${ROOT}:${id}`, { ifAvailable: true }, async lock => { if (lock) await removeRun(id); });
    }
    await transaction(db, ["runs"], tx => tx.objectStore("runs").put({ id: run }));
    directory = await root.getDirectoryHandle(run, { create: true });
    initialized = true;
  })().catch(error => { throw fail(error); });
  // Avoid an unhandled rejection if a caller only observes append/status before ready settles.
  ready.catch(() => {});
  function seal(table) {
    const buffer = buffers.get(table); if (!buffer?.rows.length) return;
    buffers.delete(table);
    tail = tail.then(async () => {
      try {
        await ready; if (failure) throw failure;
        const blob = await gzip(buffer.rows.join("\n"));
        const record = { run, table, start: buffer.start, count: buffer.rows.length, blob };
        const commit = () => transaction(db, ["chunks"], tx => tx.objectStore("chunks").put(record));
        if (options.storageAdapter?.commitChunk) await options.storageAdapter.commitChunk(record, commit); else await commit();
        committedBytes += blob.size; commits++;
      } catch (error) { fail(error); }
      finally { pendingBytes -= buffer.bytes; }
    });
  }
  function sealAll() { for (const table of buffers.keys()) seal(table); }
  function append(table, row) {
    check(); if (!MOVEMENT_TABLES.includes(table)) throw new TypeError(`Unknown movement table: ${table}`);
    let text; try { text = serialize(row); } catch (error) { throw fail(new MovementStoreError("invalid_row", error.message, error)); }
    const bytes = encoder.encode(text).byteLength + 1;
    if (bytes > maxRowBytes) throw fail(new MovementStoreError("row_too_large", "Movement row exceeds bounded record size"));
    if (pendingBytes + bytes > maxPendingBytes) throw fail(new MovementStoreError("backpressure", "Movement storage cannot keep up with capture"));
    let buffer = buffers.get(table);
    if (buffer && buffer.bytes + bytes > chunkBytes) { seal(table); buffer = null; }
    const index = counts[table]++;
    if (!buffer) { buffer = { start: index, rows: [], bytes: 0 }; buffers.set(table, buffer); }
    buffer.rows.push(text); buffer.bytes += bytes; pendingBytes += bytes; logicalBytes += bytes;
    pendingHighWaterBytes = Math.max(pendingHighWaterBytes, pendingBytes);
    if (buffer.rows.length >= chunkRows || buffer.bytes >= chunkBytes) seal(table);
    return index;
  }
  async function flush() {
    if (disposed || disposing) throw new MovementStoreError("disposed", "Movement store is disposed");
    sealAll();
    try { await ready; } finally { await tail; }
    check();
  }
  async function readRows(table, start, count) {
    check();
    if (!MOVEMENT_TABLES.includes(table) || !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(count) || count < 0 || count > maxReadRows) throw new RangeError("Invalid bounded movement read");
    await flush(); const end = Math.min(start + count, counts[table]), rows = [];
    let at = start;
    while (at < end) {
      const cursor = await request(db.transaction("chunks").objectStore("chunks").openCursor(IDBKeyRange.bound([run, table, 0], [run, table, at]), "prev"));
      const chunk = cursor?.value;
      if (!chunk || at >= chunk.start + chunk.count) throw fail(new MovementStoreError("missing_chunk", "Movement chunk is missing"));
      const decoded = (await decode(chunk.blob)).split("\n");
      const take = Math.min(end, chunk.start + chunk.count);
      for (; at < take; at++) rows.push(parse(decoded[at - chunk.start]));
    }
    return rows;
  }
  function getStatus() { return { state: disposed ? "disposed" : disposing ? "disposing" : failure ? "error" : initialized ? "ready" : "opening", error: failure ? { code: failure.code, message: failure.message } : null, runId: run, pendingBytes, pendingHighWaterBytes, logicalBytes, committedBytes, commits, maxPendingBytes, chunkBytes, chunkRows, maxReadRows, maxRowBytes }; }
  function exportFile(header) {
    const task = performExport(header).catch(error => { throw fail(error); });
    exports.add(task);
    task.then(() => exports.delete(task), () => exports.delete(task));
    return task;
  }
  async function performExport(header) {
    await flush();
    const snapshot = { ...counts }, copiedHeader = parse(serialize(header));
    const name = `movement-${crypto.randomUUID()}.jsonl.gz`;
    const handle = await directory.getFileHandle(name, { create: true });
    let writable;
    try { writable = await handle.createWritable(); }
    catch (error) { await directory.removeEntry(name); throw error; }
    const stream = new ReadableStream({
      async start(controller) {
        // start() only initializes an iterator; pull() applies native backpressure.
        this.iterator = events();
      },
      async pull(controller) { try { const next = await this.iterator.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(serialize(next.value) + "\n")); } catch (error) { controller.error(error); } },
      async cancel() { await this.iterator.return(); }
    });
    async function* events() {
      yield { type: "header", format: MOVEMENT_STREAM_FORMAT, version: MOVEMENT_STREAM_VERSION, header: copiedHeader };
      for (const table of MOVEMENT_TABLES) for (let start = 0; start < snapshot[table];) {
        const rows = await readRows(table, start, Math.min(maxReadRows, snapshot[table] - start));
        for (const row of rows) { check(); yield { type: "row", table, index: start++, row }; }
      }
      yield { type: "footer", counts: snapshot, complete: true };
    }
    let removed = false;
    const remove = async () => { if (removed) return; try { await directory.removeEntry(name); removed = true; } catch (error) { if (error.name !== "NotFoundError") throw error; removed = true; } };
    try {
      await stream.pipeThrough(new CompressionStream("gzip")).pipeTo(new WritableStream({
        write: bytes => options.storageAdapter?.writeExport ? options.storageAdapter.writeExport(bytes, () => writable.write(bytes)) : writable.write(bytes),
        close: () => writable.close(), abort: reason => writable.abort(reason)
      }));
      check(); return { file: await handle.getFile(), dispose: remove };
    } catch (error) { try { await writable.abort(); } catch { /* already closed */ } await remove(); throw fail(error); }
  }
  function dispose() {
    if (disposeTask) return disposeTask;
    disposing = true;
    disposeTask = (async () => {
      // Discard uncommitted buffers; admitted commit tasks settle before deleting owned data.
      for (const buffer of buffers.values()) pendingBytes -= buffer.bytes;
      buffers.clear();
      let cleanupError;
      try {
        try { await ready; } catch { /* initialization failure is already reported; still clean partial data */ }
        await tail;
        await Promise.allSettled([...exports]);
        if (db && root) await removeRun(run);
      } catch (error) { cleanupError = error; }
      finally { db?.close(); releaseLock?.(); try { await lockTask; } catch { /* failed lock acquisition owns no lock */ } disposed = true; disposing = false; }
      if (cleanupError) throw storageError(cleanupError);
    })();
    return disposeTask;
  }
  return { ready, append, flush, readRows, getCounts: () => ({ ...counts }), getStatus, exportFile, dispose };
}

/** Iterate a gzip JSONL File/Blob/ReadableStream without materializing the file.
 * Per-line bound only. The consumer validates table schemas/references and header identity.
 * This iterator validates framing, sequential indexes, counts, and final completeness.
 */
export async function* iterateMovementFile(file, { maxLineBytes = 1024 * 1024 } = {}) {
  positive(maxLineBytes, 1024 * 1024);
  const source = typeof file.stream === "function" ? file.stream() : file;
  const reader = source.pipeThrough(new DecompressionStream("gzip")).pipeThrough(new TextDecoderStream("utf-8", { fatal: true })).getReader();
  const counts = Object.fromEntries(MOVEMENT_TABLES.map(t => [t, 0]));
  let buffer = "", header = false, footer = false;
  function event(line) {
    if (encoder.encode(line).byteLength > maxLineBytes) throw new MovementStoreError("invalid_stream", "Movement line exceeds bounded record size");
    const value = parse(line);
    if (!header) { if (value.type !== "header" || value.format !== MOVEMENT_STREAM_FORMAT || value.version !== MOVEMENT_STREAM_VERSION) throw new MovementStoreError("invalid_stream", "Unsupported movement stream header"); header = true; }
    else if (footer) throw new MovementStoreError("invalid_stream", "Data follows movement footer");
    else if (value.type === "row") { if (!MOVEMENT_TABLES.includes(value.table) || value.index !== counts[value.table]++) throw new MovementStoreError("invalid_stream", "Invalid movement row index"); }
    else if (value.type === "footer") { if (value.complete !== true || MOVEMENT_TABLES.some(t => value.counts?.[t] !== counts[t])) throw new MovementStoreError("invalid_stream", "Incomplete movement footer"); footer = true; }
    else throw new MovementStoreError("invalid_stream", "Unexpected movement event");
    return value;
  }
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += value;
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) { const line = buffer.slice(0, end); buffer = buffer.slice(end + 1); yield event(line); }
      if (encoder.encode(buffer).byteLength > maxLineBytes) throw new MovementStoreError("invalid_stream", "Movement line exceeds bounded record size");
    }
    if (buffer) yield event(buffer);
    if (!header || !footer) throw new MovementStoreError("invalid_stream", "Movement stream is incomplete");
  } finally { await reader.cancel(); reader.releaseLock(); }
}
