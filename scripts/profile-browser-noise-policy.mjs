const tasksVisionWasmPath = "/npm/@mediapipe/tasks-vision@1.0.1/wasm/vision_wasm_internal.js";
const normRectWarning = /^W\d{4} \d{2}:\d{2}:\d{2}\.\d{6} \d+ landmark_projection_calculator\.cc:81\] Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI\. Provide IMAGE_DIMENSIONS or use PROJECTION_MATRIX\.$/u;
const acceptedRuntimeFragments = Object.freeze([
  "Created TensorFlow Lite",
  "GL Driver Message",
  "OpenGL error checking is disabled",
  "Feedback manager requires a model with a single signature inference"
]);

export function createProfileBrowserNoiseCollector() {
  const noise = [];
  let normRectCount = 0;
  return Object.freeze({
    observeConsole(type, text, path) {
      if (!["warning", "error"].includes(type)) return;
      if (acceptedRuntimeFragments.some((fragment) => text.includes(fragment))) return;
      if (type === "warning" && path === tasksVisionWasmPath && normRectWarning.test(text)) {
        normRectCount += 1;
        if (normRectCount === 1) return;
      }
      noise.push(`${type}:${text}:${path}`);
    },
    observeNoise(entry) {
      noise.push(entry);
    },
    snapshot() {
      return Object.freeze([...noise]);
    }
  });
}
