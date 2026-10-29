// @ts-check

/** Test-only sample-and-hold: render ticks continue while measured input waits. */
export function createTestWebcamSampler() {
  let lastTimestampMs = -Infinity;
  let lastKey = "";
  let held = null;
  return {
    reset() { lastTimestampMs = -Infinity; lastKey = ""; held = null; },
    /** @param {number} nowMs @param {number} fps @param {string} key @param {() => unknown} produce */
    sample(nowMs, fps, key, produce) {
      const interval = fps === 0 ? 0 : 1000 / fps;
      if (held === null || key !== lastKey || nowMs < lastTimestampMs || nowMs - lastTimestampMs + 1e-6 >= interval) {
        held = produce(); lastTimestampMs = nowMs; lastKey = key;
      }
      return held;
    }
  };
}

/** @param {unknown} value */
export function normalizeTestWebcamFps(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 60 || (value > 0 && value < 1)) throw new RangeError("Simulated webcam FPS must be 0 (native), or 1–60");
  return value;
}
