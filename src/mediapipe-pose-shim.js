// @ts-check

/**
 * Minimal MediaPipe Pose export shim for TensorFlow pose-detection bundles.
 *
 * AeroBeat's browser route only creates MoveNet detectors. The upstream
 * pose-detection ESM bundle still imports this optional BlazePose symbol at
 * module scope, and the installed MediaPipe package exposes it as a script
 * global rather than an ESM named export.
 */
export class Pose {
  /**
   * @param {unknown} _options
   */
  constructor(_options = undefined) {
    throw new Error("MediaPipe BlazePose runtime is not wired in AeroBeat web assembly.");
  }
}
