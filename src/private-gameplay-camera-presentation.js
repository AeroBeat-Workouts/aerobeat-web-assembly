// @ts-check

import { createLockedVideoFrameSource } from "./production-cv-service.js";

/**
 * Candidate-only camera source. The monotonically increasing identity comes
 * exclusively from the video element's presentation callback, never a clock.
 * A caller must dispose on every interruption and create a fresh source after
 * restarting the video. Disposed sources cannot become valid again.
 *
 * @param {HTMLVideoElement} video
 * @param {{sourceId?:string,mirrored?:boolean}} surface
 * @returns {{source:ReturnType<typeof createLockedVideoFrameSource> & {getPresentedFrameId:()=>number|null},dispose:()=>void}}
 */
export function createPrivateGameplayCameraPresentation(video, surface) {
  if (!(video instanceof HTMLVideoElement) || typeof video.requestVideoFrameCallback !== "function" || typeof video.cancelVideoFrameCallback !== "function") throw new Error("Candidate gameplay CV requires video presentation callbacks");
  const base = createLockedVideoFrameSource(video, surface);
  let active = true;
  let callbackId = null;
  let presentedFrameId = null;
  let lastPresentedFrameId = -1;
  let failed = false;
  const source = Object.freeze({
    ...base,
    // A failure is intentionally not represented as a recoverable null after a
    // valid ID: the private scheduler treats a regression as terminal.
    getPresentedFrameId: () => {
      if (!active) return null;
      if (failed) throw new Error("Candidate camera presentation identity failed");
      return presentedFrameId;
    },
    // Do not disguise terminal callback failure as a temporary absent frame:
    // the paced service checks availability before asking for the ID.
    isFrameAvailable: () => active && (failed || base.isFrameAvailable())
  });
  function requestNext() {
    if (!active || failed) return;
    try { callbackId = video.requestVideoFrameCallback(onFrame); }
    catch { failed = true; callbackId = null; }
  }
  function onFrame(_now, metadata) {
    callbackId = null;
    if (!active || failed) return;
    const id = metadata?.presentedFrames;
    if (!Number.isSafeInteger(id) || id < 0 || id < lastPresentedFrameId) {
      failed = true;
      return;
    }
    lastPresentedFrameId = id;
    presentedFrameId = id;
    requestNext();
  }
  requestNext();
  if (failed) throw new Error("Candidate camera presentation callback unavailable");
  return Object.freeze({
    source,
    dispose() {
      if (!active) return;
      active = false;
      presentedFrameId = null;
      if (callbackId !== null) video.cancelVideoFrameCallback(callbackId);
      callbackId = null;
    }
  });
}
