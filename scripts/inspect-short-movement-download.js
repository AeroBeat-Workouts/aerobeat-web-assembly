// @ts-check
// TEST ONLY: materialize short native browser fixtures for numeric assertions.
// This is not the production reader or a capacity/large-file acceptance path.
// Native file choosers must receive the original gzip download, never this view.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const maxFixtureBytes = 16 * 1024 * 1024;
const tables = ["inputs", "rawPoses", "models", "configurations", "equipmentHeaders", "equipment", "observations", "ticks", "metadata", "states"];

export function inspectShortMovementDownload(filePath) {
  assert(statSync(filePath).size <= maxFixtureBytes, "Inspection helper is only for short fixtures");
  const compressed = readFileSync(filePath);
  assert.equal(compressed[0], 0x1f, "Native download must be gzip, regardless of temporary filename");
  assert.equal(compressed[1], 0x8b);
  const text = gunzipSync(compressed, { maxOutputLength: maxFixtureBytes }).toString("utf8");
  const events = text.trimEnd().split("\n").map(line => JSON.parse(line, (_key, value) => value && value.$movementNegativeZero === true && Object.keys(value).length === 1 ? -0 : value));
  const header = events.shift(), footer = events.pop();
  assert.equal(header?.type, "header");
  assert.equal(header.format, "aerobeat-movement-jsonl");
  assert.equal(header.version, 1);
  const capture = header.header;
  assert.equal(capture.schema, "aerobeat/ab_judgement_capture");
  assert.equal(capture.version, 2);
  assert.equal(capture.movement?.schema, "aerobeat/play_movement_recording");
  assert.equal(capture.movement.version, 2);
  assert.equal(capture.movement.complete, true);
  assert.equal(capture.movement.status, "completed");
  const rows = Object.fromEntries(tables.map(table => [table, []]));
  for (const event of events) {
    assert.equal(event.type, "row");
    assert(tables.includes(event.table), "Unknown fixture table");
    assert.equal(event.index, rows[event.table].length, "Every row index must remain sequential");
    rows[event.table].push(event.row);
  }
  assert.equal(footer?.type, "footer");
  assert.equal(footer.complete, true);
  const counts = Object.fromEntries(tables.map(table => [table, rows[table].length]));
  assert.deepEqual(footer.counts, counts);
  assert.deepEqual(capture.movement.counts, counts);
  assert.equal(capture.movement.tickCount, counts.ticks);
  assert.equal(capture.movement.measuredFrames, counts.rawPoses);
  // Metadata/states live in the descriptor, not the materialized numeric tables.
  if (counts.metadata) assert.deepEqual(rows.metadata, [capture.movement.metadata]);
  if (counts.states) assert.deepEqual(rows.states, capture.movement.states);
  for (const table of tables.slice(0, 8)) {
    assert.equal(Object.hasOwn(capture.movement, table), false, "Portable header must not contain table arrays");
    capture.movement[table] = rows[table];
  }
  return capture;
}
