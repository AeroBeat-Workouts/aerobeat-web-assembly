// WebXR routing for the attract screen.
//
//   'headset' — immersive-vr is supported AND the browser identifies as a standalone headset
//               (Quest / Pico / Wolvic / visionOS). Phase 1's main action becomes "Enter VR".
//   'desktop' — immersive-vr is supported on an ordinary computer (for example a PC with a
//               tethered headset). Keep the webcam flow and add a small "Play in VR" target.
//   'none'    — no WebXR, or immersive-vr not supported.
//
// visionOS Safari reports a Macintosh user agent; it is told apart from a Mac by touch
// support plus navigator.xr, which macOS Safari does not expose.

const HEADSET_UA = /OculusBrowser|Quest|Pico|Wolvic|visionOS|AppleVisionPro/i;

export function looksLikeHeadset(ua = navigator.userAgent) {
  if (HEADSET_UA.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && 'xr' in navigator;
}

/** @returns {Promise<'headset'|'desktop'|'none'>} */
export async function detectXR() {
  if (!navigator.xr?.isSessionSupported) return 'none';
  let supported = false;
  try { supported = await navigator.xr.isSessionSupported('immersive-vr'); } catch { supported = false; }
  if (!supported) return 'none';
  return looksLikeHeadset() ? 'headset' : 'desktop';
}

/** Stub: the real game would call navigator.xr.requestSession('immersive-vr') here. */
export function enterVRStub() {
  console.info('[attract] VR stub: would call navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "hand-tracking"] })');
}
