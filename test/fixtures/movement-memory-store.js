// @ts-check
// UNIT FIXTURE ONLY. Small bounded tables; never a production storage fallback
// and never evidence of IndexedDB, OPFS, gzip or browser quota behavior.
import { MOVEMENT_TABLES, MOVEMENT_MAX_RECORD_BYTES } from "../../src/movement-chunk-store.js";

export function createUnitMovementStore({ failFlush = false, failAfter = Infinity } = {}) {
  const rows = Object.fromEntries(MOVEMENT_TABLES.map(name => [name, []]));
  let disposed = false, failure = null, appends = 0, logicalBytes = 0, committedBytes = 0;
  function fail(code) { failure = Object.assign(new Error(`unit fixture ${code}`), { code }); throw failure; }
  function check() { if (disposed) throw new Error("unit fixture disposed"); if (failure) throw failure; }
  const store = {
    ready: Promise.resolve(),
    append(table, value) {
      check();
      if (!MOVEMENT_TABLES.includes(table)) throw new TypeError("unit fixture unknown table");
      if (appends >= failAfter) fail("unit_append_failure");
      if (rows[table].length >= 512) throw new Error("small unit fixture row bound");
      const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength + 1;
      if (bytes > MOVEMENT_MAX_RECORD_BYTES) throw new Error("unit fixture record bound");
      rows[table].push(structuredClone(value)); appends++; logicalBytes += bytes;
      return rows[table].length - 1;
    },
    async flush() { check(); if (failFlush) fail("unit_flush_failure"); committedBytes = logicalBytes; },
    async readRows(table, start, count) {
      check();
      if (!MOVEMENT_TABLES.includes(table) || !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(count) || count < 0 || count > 1024) throw new Error("unit fixture read bound");
      return structuredClone(rows[table].slice(start, start + count));
    },
    getCounts() { return Object.fromEntries(MOVEMENT_TABLES.map(name => [name, rows[name].length])); },
    getStatus() { return { state: disposed ? "disposed" : failure ? "error" : "ready", error: failure ? { code: failure.code, message: failure.message } : null, logicalBytes, pendingBytes: logicalBytes - committedBytes, pendingHighWaterBytes: logicalBytes - committedBytes, committedBytes }; },
    async dispose() { disposed = true; for (const table of Object.values(rows)) table.length = 0; }
  };
  return { store, rows };
}
