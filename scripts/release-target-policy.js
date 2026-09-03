// @ts-check

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Atomically claim one append-only raw release target.
 *
 * The exclusive, non-recursive mkdir is the publication lock: exactly one
 * publisher can claim an absent target. Existing files and directories reject,
 * and callers must intentionally leave a partially built claimed directory in
 * place for review after any later failure.
 *
 * @param {string} target
 * @returns {string}
 */
export function claimAppendOnlyReleaseTarget(target) {
  const absoluteTarget = resolve(target);
  try {
    mkdirSync(absoluteTarget, { recursive: false });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error(`Raw release target already exists and is immutable: ${absoluteTarget}`, { cause: error });
    }
    throw new Error(`Unable to atomically claim raw release target ${absoluteTarget}`, { cause: error });
  }
  return absoluteTarget;
}

/** @param {unknown} error @returns {error is NodeJS.ErrnoException} */
function isNodeError(error) {
  return error instanceof Error && "code" in error;
}
