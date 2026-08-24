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
 * Vite-injected package version from package.json.
 *
 * @type {string}
 */
const packageVersion = __AEROBEAT_PACKAGE_VERSION__;

/**
 * Visible app metadata used for cache-bust and raw release proof.
 *
 * @type {Readonly<{
 *   packageName: "@aerobeat/web-assembly",
 *   packageVersion: string,
 *   displayVersion: string,
 *   buildStamp: string,
 *   cacheBust: string
 * }>}
 */
export const appMetadata = Object.freeze({
  packageName: "@aerobeat/web-assembly",
  packageVersion,
  displayVersion: packageVersion,
  buildStamp,
  cacheBust
});
