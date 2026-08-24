// @ts-check

/**
 * Vite-injected build stamp.
 *
 * @type {string}
 */
const buildStamp = __AEROBEAT_BUILD_STAMP__;

/**
 * Vite-injected cache-bust token.
 *
 * @type {string}
 */
const cacheBust = __AEROBEAT_CACHE_BUST__;

/**
 * Visible app metadata used for cache-bust and raw release proof.
 *
 * @type {Readonly<{
 *   packageName: "@aerobeat/web-assembly",
 *   packageVersion: "0.0.0",
 *   displayVersion: "0.0.1",
 *   buildStamp: string,
 *   cacheBust: string
 * }>}
 */
export const appMetadata = Object.freeze({
  packageName: "@aerobeat/web-assembly",
  packageVersion: "0.0.0",
  displayVersion: "0.0.1",
  buildStamp,
  cacheBust
});
