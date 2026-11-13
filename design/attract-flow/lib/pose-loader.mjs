// Loads the real MediaPipe Pose Landmarker Lite (tasks-vision 1.0.1, CPU/WASM) with
// honest progress.
//
// Stages, in order, each reported only when it actually happens:
//   download  — byte counts from the response streams of four files (17.9 MB total)
//   compile   — WebAssembly.compile() of the downloaded engine
//   create    — PoseLandmarker.createFromOptions() (instantiates the engine, parses the model)
//   test      — one detectForVideo() on a blank frame, so the first real frame is not slow
//   ready
//
// Files are kept in the Cache Storage API ("aerobeat-attract-v1") after the first
// download, so a returning player reads them from disk. Progress still counts bytes
// read from the cache, it just goes fast.
//
// The JS files are stored with a .txt suffix so Vite serves them byte-for-byte instead
// of transforming them; they are loaded from blob: URLs.

// (import.meta.url via a variable: Vite rewrites the literal new URL(..., import.meta.url) form and drops the trailing slash.)
const HERE = import.meta.url;
const BASE = new URL('../vendor/mediapipe/', HERE);
const CACHE = 'aerobeat-attract-v1';

export const FILES = Object.freeze([
  { key: 'runtime', file: 'vision_bundle.mjs.txt', bytes: 155439, type: 'text/javascript' },
  { key: 'loader', file: 'vision_wasm_internal.js.txt', bytes: 323377, type: 'text/javascript' },
  { key: 'wasm', file: 'vision_wasm_internal.wasm', bytes: 11756954, type: 'application/wasm' },
  { key: 'model', file: 'pose_landmarker_lite.task', bytes: 5777746, type: 'application/octet-stream' },
]);

export const STAGES = Object.freeze(['download', 'compile', 'create', 'test', 'ready']);

/**
 * @param {{ onProgress?: (p: ReturnType<typeof snapshot>) => void, fresh?: boolean }} opts
 */
export function createPoseLoader({ onProgress, fresh = false } = {}) {
  const t0 = performance.now();
  const state = {
    stage: 'idle',
    loaded: 0,
    total: FILES.reduce((s, f) => s + f.bytes, 0),
    fromCache: 0,       // number of files served from Cache Storage
    error: null,
    timings: {},        // ms since loader start for each stage boundary
    landmarker: null,
  };
  const perFile = new Map(FILES.map((f) => [f.key, 0]));

  function snapshot() {
    return {
      stage: state.stage, loaded: state.loaded, total: state.total, fromCache: state.fromCache,
      error: state.error, timings: { ...state.timings },
    };
  }
  function emit() { onProgress?.(snapshot()); }
  function enter(stage) {
    state.stage = stage;
    state.timings[stage] = Math.round(performance.now() - t0);
    performance.mark(`af-pose-${stage}`);
    emit();
  }

  async function fetchFile(f) {
    const url = new URL(f.file, BASE).href;
    let cache = null;
    try { cache = 'caches' in self ? await caches.open(CACHE) : null; } catch { cache = null; }
    let response = cache && !fresh ? await cache.match(url) : null;
    const cached = !!response;
    if (cached) state.fromCache += 1;
    if (!response) {
      response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${f.file}: HTTP ${response.status}`);
    }
    // The totals are the known decoded sizes of these pinned files. Content-Length is only
    // used when the response is not compressed (a compressed length would not match the
    // decoded bytes the stream delivers) and disagrees, so the bar can still reach 100%.
    const declared = Number(response.headers.get('content-length')) || 0;
    if (declared && !response.headers.get('content-encoding') && declared !== f.bytes) {
      state.total += declared - f.bytes;
      f = { ...f, bytes: declared };
    }
    const reader = response.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.byteLength;
      state.loaded = Math.min(state.total, state.loaded + value.byteLength);
      perFile.set(f.key, got);
      emit();
    }
    const blob = new Blob(chunks, { type: f.type });
    if (cache && !cached) {
      try { await cache.put(url, new Response(blob, { headers: { 'content-type': f.type, 'content-length': String(blob.size) } })); } catch { /* quota or private mode: fine */ }
    }
    return blob;
  }

  async function load() {
    try {
      if (fresh && 'caches' in self) await caches.delete(CACHE).catch(() => {});
      enter('download');
      const blobs = Object.fromEntries(await Promise.all(FILES.map(async (f) => [f.key, await fetchFile(f)])));
      // All bytes are in; snap any rounding so the bar is exactly full for this stage.
      state.loaded = state.total;

      enter('compile');
      const wasmModule = await WebAssembly.compile(await blobs.wasm.arrayBuffer());

      enter('create');
      const runtimeUrl = URL.createObjectURL(blobs.runtime);
      const loaderUrl = URL.createObjectURL(blobs.loader);
      const vision = await import(/* @vite-ignore */ runtimeUrl);
      // tasks-vision loads the Emscripten loader script, then calls ModuleFactory(self.Module).
      // Handing it instantiateWasm reuses the module compiled above instead of fetching again.
      self.Module = {
        instantiateWasm(imports, done) {
          WebAssembly.instantiate(wasmModule, imports).then((instance) => done(instance, wasmModule));
          return {};
        },
      };
      const fileset = { wasmLoaderPath: loaderUrl, wasmBinaryPath: 'unused-instantiateWasm.wasm' };
      const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: new Uint8Array(await blobs.model.arrayBuffer()), delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        outputSegmentationMasks: false,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      enter('test');
      const blank = document.createElement('canvas');
      blank.width = 256; blank.height = 144;
      blank.getContext('2d').fillRect(0, 0, 256, 144);
      landmarker.detectForVideo(blank, performance.now());

      state.landmarker = landmarker;
      enter('ready');
      return landmarker;
    } catch (error) {
      state.error = String(error?.message ?? error);
      state.stage = 'failed';
      console.warn('[attract] pose loader failed', error);
      emit();
      throw error;
    }
  }

  return { load, snapshot, get landmarker() { return state.landmarker; } };
}

/**
 * Overall progress in [0,1] for drawing, plus a human label. Downloads fill the
 * first 88% by bytes; the three start-up steps fill the last 12% in equal, real
 * steps. The bar never sits at 99%: the last step only completes when tracking works.
 */
export function describeProgress(p) {
  const mb = (n) => (n / 1e6).toFixed(1);
  const DL = 0.88;
  switch (p.stage) {
    case 'idle': return { value: 0, label: 'Getting the body tracker', step: 0 };
    case 'download': {
      const v = DL * (p.total ? p.loaded / p.total : 0);
      return { value: v, label: `Downloading the body tracker: ${mb(p.loaded)} of ${mb(p.total)} MB`, step: 0 };
    }
    case 'compile': return { value: DL, label: 'Starting the body tracker', step: 1 };
    case 'create': return { value: DL + 0.04, label: 'Loading the body model', step: 2 };
    case 'test': return { value: DL + 0.08, label: 'Testing the body tracker', step: 3 };
    case 'ready': return { value: 1, label: 'Body tracker ready', step: 4 };
    case 'failed': return { value: 0, label: 'The body tracker failed to load', step: -1 };
    default: return { value: 0, label: '', step: 0 };
  }
}
