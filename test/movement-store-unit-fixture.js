// @ts-check
// UNIT FIXTURE ONLY. Bounded small in-memory tables, not browser-storage proof.
import { MOVEMENT_TABLES } from "../src/movement-chunk-store.js";
export { createUnitMovementStore } from "./fixtures/movement-memory-store.js";
export async function streamUnitFile(capture, { mutate = value => value, ticks = null, padding = 0 } = {}) {
  const original = capture.movement, counts = Object.fromEntries(MOVEMENT_TABLES.map(name => [name, name === "states" || name === "metadata" ? 0 : name === "ticks" && ticks !== null ? ticks : original[name].length]));
  const { inputs, rawPoses, models, configurations, equipmentHeaders, equipment, observations, ticks: ignoredTicks, maxBytes, ...metadata } = original;
  const header = { ...capture, movement: { ...metadata, version: 2, tickCount: counts.ticks, pendingBytes: 0, pendingHighWaterBytes: 0, storedBytes: 1024, counts } };
  function* events() {
    yield { type: "header", format: "aerobeat-movement-jsonl", version: 1, header };
    for (const table of MOVEMENT_TABLES) for (let index = 0; index < counts[table]; index++) {
      const row = table === "ticks" && ticks !== null ? [index, ...original.ticks[0].slice(1)] : original[table][index];
      yield { type: "row", table, index, row };
    }
    yield { type: "footer", counts, complete: true };
  }
  const iterator = events(), encoder = new TextEncoder(); let logicalBytes = 0;
  const stream = new ReadableStream({ pull(controller) { for (;;) { const next = iterator.next(); if (next.done) { controller.close(); return; } const event = mutate(structuredClone(next.value)); if (event === null) continue; const bytes = encoder.encode(JSON.stringify(event, (_key, value) => Object.is(value, -0) ? { $movementNegativeZero: true } : value) + " ".repeat(padding) + "\n"); logicalBytes += bytes.byteLength; controller.enqueue(bytes); return; } } });
  const file = await new Response(stream.pipeThrough(new CompressionStream("gzip"))).blob();
  Object.defineProperty(file, "text", { value() { throw new Error("stream import must not use File.text"); } });
  return { file, logicalBytes };
}

// Preserve complete legacy-input regression fixtures after the production writer
// switches to v2 disk storage. This is not a second production recording path.
export function legacyUnitMovement(recorder, fixture) {
  const m = recorder.snapshot();
  return { schema: m.schema, version: 1, coordinateSpaces: m.coordinateSpaces, tickFields: m.tickFields, observationFields: m.observationFields, equipmentValueFields: m.equipmentValueFields, status: "completed", reason: null, complete: true, finalSessionState: "completed", tickCount: fixture.rows.ticks.length, measuredFrames: fixture.rows.rawPoses.length, estimatedBytes: 2048, maxBytes: 48 * 1024 * 1024, metadata: m.metadata, states: m.states, ...Object.fromEntries(Object.entries(fixture.rows).filter(([name]) => name !== "metadata" && name !== "states")) };
}
