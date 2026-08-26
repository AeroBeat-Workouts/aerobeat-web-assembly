// @ts-check

/**
 * @typedef {Object} PoseSwitchContext
 * @property {number} generation Monotonic switch generation.
 * @property {string} reason Latest requested reason.
 * @property {() => boolean} isCurrent Whether this generation is still the latest.
 * @property {() => boolean} consumeRestartRequest Consumes a live-route restart latched across stale generations.
 * @property {(resource: object, dispose: () => Promise<void>) => Promise<boolean>} retireOnce Terminally retires a shared resource at most once across stale generations.
 */

/**
 * Creates a serialized latest-selection-wins switch coordinator. Restart intent is
 * deliberately latched until the winning generation consumes it, even when an
 * older generation already tore down the live route before becoming stale.
 *
 * @param {(context: PoseSwitchContext) => Promise<void>} executeSwitch
 * @returns {{ request: (reason: string, restartRequested: boolean) => Promise<void>, settled: () => Promise<void> }}
 */
export function createSerializedPoseSwitch(executeSwitch) {
  let generation = 0;
  let restartLatched = false;
  let queue = Promise.resolve();
  const retiredResources = new WeakSet();

  return {
    request(reason, restartRequested) {
      const requestedGeneration = ++generation;
      restartLatched ||= restartRequested;
      queue = queue.catch(() => undefined).then(async () => {
        if (requestedGeneration !== generation) {
          return;
        }
        await executeSwitch({
          generation: requestedGeneration,
          reason,
          isCurrent: () => requestedGeneration === generation,
          consumeRestartRequest: () => {
            if (requestedGeneration !== generation) {
              return false;
            }
            const shouldRestart = restartLatched;
            restartLatched = false;
            return shouldRestart;
          },
          retireOnce: async (resource, dispose) => {
            if (retiredResources.has(resource)) {
              return false;
            }
            retiredResources.add(resource);
            try {
              await dispose();
              return true;
            } catch (error) {
              retiredResources.delete(resource);
              throw error;
            }
          }
        });
      });
      return queue;
    },
    settled() {
      return queue.catch(() => undefined);
    }
  };
}
