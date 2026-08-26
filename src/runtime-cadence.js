// @ts-check

/**
 * @typedef {Object} AeroCadenceScheduler
 * @property {(callback: () => void) => number} schedule Schedules a cadence opportunity.
 * @property {(handle: number) => void} cancel Cancels a cadence opportunity.
 */

/**
 * @typedef {Object} AeroCadenceLoopOptions
 * @property {number} targetRateFps Maximum callback rate.
 * @property {() => void} callback Work performed at the paced cadence.
 * @property {AeroCadenceScheduler | undefined} scheduler Optional deterministic scheduler.
 * @property {(() => number) | undefined} now Optional monotonic clock.
 */

/**
 * @typedef {Object} AeroCadenceLoopStatus
 * @property {number} targetRateFps Configured maximum callback rate.
 * @property {number} tickCount Number of callbacks actually performed.
 * @property {number | undefined} effectiveRateFps Effective callback rate since the first tick.
 * @property {number | undefined} latestTickAgeMs Monotonic age since the latest callback.
 */

/**
 * @typedef {Object} AeroCadenceLoop
 * @property {() => void} start Starts the independent cadence loop.
 * @property {() => void} stop Stops the independent cadence loop.
 * @property {() => AeroCadenceLoopStatus} getStatus Reads truthful cadence telemetry.
 */

/**
 * Creates one independently paced browser-runtime lane.
 *
 * @param {AeroCadenceLoopOptions} options
 * @returns {AeroCadenceLoop}
 */
export function createAeroCadenceLoop(options) {
  const targetRateFps = normalizeTargetRate(options.targetRateFps);
  const intervalMs = 1000 / targetRateFps;
  const scheduler = options.scheduler ?? createAnimationFrameScheduler();
  const now = options.now ?? monotonicNow;
  let running = false;
  /** @type {number | undefined} */
  let handle;
  /** @type {number | undefined} */
  let firstTickAtMs;
  /** @type {number | undefined} */
  let latestTickAtMs;
  let tickCount = 0;

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      scheduleNext();
    },
    stop() {
      running = false;
      if (handle !== undefined) {
        scheduler.cancel(handle);
        handle = undefined;
      }
    },
    getStatus() {
      const currentTimeMs = now();
      return {
        targetRateFps,
        tickCount,
        effectiveRateFps: effectiveRateFps(tickCount, firstTickAtMs, latestTickAtMs),
        latestTickAgeMs: latestTickAtMs === undefined
          ? undefined
          : Math.max(0, Math.round((currentTimeMs - latestTickAtMs) * 10) / 10)
      };
    }
  };

  /**
   * @returns {void}
   */
  function scheduleNext() {
    if (!running || handle !== undefined) {
      return;
    }
    handle = scheduler.schedule(() => {
      handle = undefined;
      if (!running) {
        return;
      }
      const currentTimeMs = now();
      if (latestTickAtMs === undefined || currentTimeMs - latestTickAtMs >= intervalMs) {
        firstTickAtMs ??= currentTimeMs;
        latestTickAtMs = currentTimeMs;
        tickCount += 1;
        options.callback();
      }
      scheduleNext();
    });
  }
}

/**
 * @returns {AeroCadenceScheduler}
 */
function createAnimationFrameScheduler() {
  return {
    schedule(callback) {
      if (typeof globalThis.requestAnimationFrame === "function") {
        return globalThis.requestAnimationFrame(callback);
      }
      return globalThis.setTimeout(callback, 16);
    },
    cancel(handle) {
      if (typeof globalThis.cancelAnimationFrame === "function") {
        globalThis.cancelAnimationFrame(handle);
        return;
      }
      globalThis.clearTimeout(handle);
    }
  };
}

/**
 * @param {number} value
 * @returns {number}
 */
function normalizeTargetRate(value) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * @param {number} count
 * @param {number | undefined} firstAtMs
 * @param {number | undefined} latestAtMs
 * @returns {number | undefined}
 */
function effectiveRateFps(count, firstAtMs, latestAtMs) {
  if (count < 2 || firstAtMs === undefined || latestAtMs === undefined || latestAtMs <= firstAtMs) {
    return undefined;
  }
  return Math.round((((count - 1) * 1000) / (latestAtMs - firstAtMs)) * 10) / 10;
}

/**
 * @returns {number}
 */
function monotonicNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}
