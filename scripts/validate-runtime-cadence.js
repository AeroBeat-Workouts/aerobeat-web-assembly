// @ts-check

import assert from "node:assert/strict";
import { createAeroCadenceLoop } from "../src/runtime-cadence.js";

let currentTimeMs = 0;
const overlayScheduler = createManualScheduler();
const statusScheduler = createManualScheduler();
let overlayTicks = 0;
let statusTicks = 0;

const overlayLoop = createAeroCadenceLoop({
  targetRateFps: 30,
  callback: () => {
    overlayTicks += 1;
  },
  scheduler: overlayScheduler,
  now: () => currentTimeMs
});
const statusLoop = createAeroCadenceLoop({
  targetRateFps: 4,
  callback: () => {
    statusTicks += 1;
  },
  scheduler: statusScheduler,
  now: () => currentTimeMs
});

overlayLoop.start();
statusLoop.start();
for (currentTimeMs = 0; currentTimeMs <= 1000; currentTimeMs += 10) {
  overlayScheduler.fireNext();
  statusScheduler.fireNext();
}

assert.equal(overlayTicks, 26);
assert.equal(statusTicks, 5);
assert.equal(overlayLoop.getStatus().targetRateFps, 30);
assert.equal(statusLoop.getStatus().targetRateFps, 4);
assert.equal(overlayLoop.getStatus().effectiveRateFps, 25);
assert.equal(statusLoop.getStatus().effectiveRateFps, 4);
assert.equal(overlayLoop.getStatus().latestTickAgeMs, 10);
assert.equal(statusLoop.getStatus().latestTickAgeMs, 10);
assert.equal(overlayScheduler.pendingCount(), 1);
assert.equal(statusScheduler.pendingCount(), 1);

overlayLoop.stop();
statusLoop.stop();
assert.equal(overlayScheduler.pendingCount(), 0);
assert.equal(statusScheduler.pendingCount(), 0);

console.log("Independent runtime cadence validation passed.");

/**
 * @returns {import("../src/runtime-cadence.js").AeroCadenceScheduler & {
 *   fireNext: () => void,
 *   pendingCount: () => number
 * }}
 */
function createManualScheduler() {
  /** @type {Map<number, () => void>} */
  const callbacks = new Map();
  let nextHandle = 1;
  return {
    schedule(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel(handle) {
      callbacks.delete(handle);
    },
    fireNext() {
      const next = callbacks.entries().next().value;
      if (!next) {
        throw new Error("No cadence callback was scheduled.");
      }
      const [handle, callback] = next;
      callbacks.delete(handle);
      callback();
    },
    pendingCount() {
      return callbacks.size;
    }
  };
}
