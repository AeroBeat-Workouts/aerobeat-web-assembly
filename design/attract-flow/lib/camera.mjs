// Camera access, error classification, device choice and feed health.

const STORAGE_KEY = 'aerobeat.attract.cameraId';

/** Problems the scene shows, each with its own message. */
export const CAMERA_PROBLEMS = Object.freeze({
  unsupported: 'unsupported',   // no getUserMedia (old browser or insecure context)
  insecure: 'insecure',         // page not on https / localhost
  denied: 'denied',             // NotAllowedError / SecurityError (blocked or dismissed)
  notFound: 'notFound',         // NotFoundError / OverconstrainedError with no fallback
  busy: 'busy',                 // NotReadableError / AbortError (another app holds it)
  unknown: 'unknown',
});

export function preflight() {
  if (!window.isSecureContext) return CAMERA_PROBLEMS.insecure;
  if (!navigator.mediaDevices?.getUserMedia) return CAMERA_PROBLEMS.unsupported;
  return null;
}

export function classify(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError': return CAMERA_PROBLEMS.denied;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError': return CAMERA_PROBLEMS.notFound;
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError': return CAMERA_PROBLEMS.busy;
    default: return CAMERA_PROBLEMS.unknown;
  }
}

/** 'granted' | 'denied' | 'prompt' | 'unknown' (Firefox/Safari may not support the query). */
export async function permissionState() {
  try {
    const status = await navigator.permissions.query({ name: 'camera' });
    return status.state;
  } catch { return 'unknown'; }
}

export function rememberedCameraId() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
export function rememberCamera(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private mode */ }
}

export async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput').map((d, i) => ({
    id: d.deviceId,
    // Labels are empty until permission is granted; fall back to a numbered name.
    label: d.label || `Camera ${i + 1}`,
  }));
}

/**
 * Open a camera. Tries the remembered device first; if that device is gone, falls back
 * to any camera rather than failing.
 * @returns {Promise<{ stream: MediaStream, deviceId: string, label: string }>}
 */
export async function openCamera(deviceId = rememberedCameraId()) {
  const video = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
  let stream;
  if (deviceId) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { ...video, deviceId: { exact: deviceId } }, audio: false });
    } catch (error) {
      if (error?.name !== 'OverconstrainedError' && error?.name !== 'NotFoundError') throw error;
    }
  }
  if (!stream) stream = await navigator.mediaDevices.getUserMedia({ video: { ...video, facingMode: 'user' }, audio: false });
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  return { stream, deviceId: settings.deviceId ?? deviceId ?? '', label: track.label || 'Camera' };
}

export function stopStream(stream) {
  for (const t of stream?.getTracks() ?? []) t.stop();
}

/**
 * Feed health: samples a 32x18 thumbnail a few times a second and reports whether
 * the picture is black (very low mean luminance and almost no spatial contrast) or
 * frozen (no pixel change between samples over a window), or ok.
 */
export function createFeedHealth(video) {
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 18;
  const g = cv.getContext('2d', { willReadFrequently: true });
  let prev = null;
  let lastChangeAt = performance.now();
  let lastVideoTime = -1;
  let lastTimeChangeAt = performance.now();
  const report = { mean: 0, spread: 0, delta: 0, black: false, frozen: false, sampledAt: 0 };

  function sample(now = performance.now()) {
    if (video.readyState < 2) return report;
    g.drawImage(video, 0, 0, 32, 18);
    const { data } = g.getImageData(0, 0, 32, 18);
    const n = 32 * 18;
    const lum = new Float32Array(n);
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      sum += lum[i];
    }
    const mean = sum / n;
    let varSum = 0, delta = 0;
    for (let i = 0; i < n; i += 1) {
      varSum += (lum[i] - mean) ** 2;
      if (prev) delta += Math.abs(lum[i] - prev[i]);
    }
    delta = prev ? delta / n : 0;
    prev = lum;
    // A real camera always has a little sensor noise, so tiny deltas still count as change.
    if (delta > 0.15) lastChangeAt = now;
    if (video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; lastTimeChangeAt = now; }
    report.mean = mean;
    report.spread = Math.sqrt(varSum / n);
    report.delta = delta;
    report.black = mean < 12 && report.spread < 6;
    report.frozen = now - lastChangeAt > 2500 || now - lastTimeChangeAt > 2500;
    report.sampledAt = now;
    return report;
  }
  function reset() { prev = null; lastChangeAt = lastTimeChangeAt = performance.now(); }
  return { sample, reset, report };
}
