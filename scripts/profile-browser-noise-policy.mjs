const tasksVisionWasmPath = "/npm/@mediapipe/tasks-vision@1.0.1/wasm/vision_wasm_internal.js";
const wasmWarningPrefix = "W\\d{4} \\d{2}:\\d{2}:\\d{2}\\.\\d{6} \\d+ ";
const acceptedRuntimeDiagnostics = Object.freeze([
  Object.freeze({
    type: "error",
    path: tasksVisionWasmPath,
    pattern: /^INFO: Created TensorFlow Lite XNNPACK delegate for CPU\.$/u
  }),
  Object.freeze({
    type: "warning",
    path: "unknown",
    pattern: /^GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels$/u
  }),
  Object.freeze({
    type: "warning",
    path: tasksVisionWasmPath,
    pattern: new RegExp(`^${wasmWarningPrefix}gl_context\\.cc:\\d+\\] OpenGL error checking is disabled$`, "u")
  }),
  Object.freeze({
    type: "warning",
    path: tasksVisionWasmPath,
    pattern: new RegExp(`^${wasmWarningPrefix}inference_feedback_manager\\.cc:121\\] Feedback manager requires a model with a single signature inference\\. Disabling support for feedback tensors\\.$`, "u")
  })
]);
const normRectWarning = new RegExp(`^${wasmWarningPrefix}landmark_projection_calculator\\.cc:81\\] Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI\\. Provide IMAGE_DIMENSIONS or use PROJECTION_MATRIX\\.$`, "u");

export function isExpectedMediaPipeRuntimeDiagnostic(type, text, path) {
  return acceptedRuntimeDiagnostics.some((diagnostic) => diagnostic.path !== "unknown" && diagnostic.type === type && diagnostic.path === path && diagnostic.pattern.test(text));
}

export function createProfileBrowserNoiseCollector() {
  const noise = [];
  let normRectCount = 0;
  return Object.freeze({
    observeConsole(type, text, path) {
      if (!["warning", "error"].includes(type)) return;
      if (type === "warning" && path === tasksVisionWasmPath && normRectWarning.test(text)) {
        normRectCount += 1;
        if (normRectCount === 1) return;
      } else if (isExpectedMediaPipeRuntimeDiagnostic(type, text, path) || acceptedRuntimeDiagnostics.some((diagnostic) => diagnostic.path === "unknown" && diagnostic.type === type && diagnostic.path === path && diagnostic.pattern.test(text))) {
        return;
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
