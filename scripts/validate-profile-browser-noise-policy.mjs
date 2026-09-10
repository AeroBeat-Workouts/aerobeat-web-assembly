import assert from "node:assert/strict";
import { createProfileBrowserNoiseCollector } from "./profile-browser-noise-policy.mjs";

const path = "/npm/@mediapipe/tasks-vision@1.0.1/wasm/vision_wasm_internal.js";
const prefix = "W0909 23:41:30.520999 2196592 ";
const normRect = `${prefix}landmark_projection_calculator.cc:81] Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI. Provide IMAGE_DIMENSIONS or use PROJECTION_MATRIX.`;
const exactRuntimeDiagnostics = [
  ["error", "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.", path],
  ["warning", "GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels", "unknown"],
  ["warning", `${prefix}gl_context.cc:1119] OpenGL error checking is disabled`, path],
  ["warning", `${prefix}inference_feedback_manager.cc:121] Feedback manager requires a model with a single signature inference. Disabling support for feedback tensors.`, path]
];

function assertClean(entries) {
  const collector = createProfileBrowserNoiseCollector();
  for (const [type, text, sourcePath] of entries) collector.observeConsole(type, text, sourcePath);
  assert.deepEqual(collector.snapshot(), []);
}

function assertFatal(type, text, sourcePath) {
  const collector = createProfileBrowserNoiseCollector();
  collector.observeConsole(type, text, sourcePath);
  assert.deepEqual(collector.snapshot(), [`${type}:${text}:${sourcePath}`]);
}

assertClean([["warning", normRect, path]]);
assertClean(exactRuntimeDiagnostics);

const duplicate = createProfileBrowserNoiseCollector();
duplicate.observeConsole("warning", normRect, path);
duplicate.observeConsole("warning", normRect, path);
assert.deepEqual(duplicate.snapshot(), [`warning:${normRect}:${path}`]);

for (const [type, text, sourcePath] of [
  ["error", normRect, path],
  ["warning", normRect, "/src/application.js"],
  ["warning", normRect, "/npm/@mediapipe/tasks-vision@1.0.2/wasm/vision_wasm_internal.js"],
  ["warning", normRect.replace("cc:81", "cc:82"), path],
  ["warning", normRect.replace("NORM_RECT", "NORM_RECTS"), path],
  ["warning", `${normRect} ignored`, path],
  ["warning", `${normRect} Created TensorFlow Lite`, path],
  ["warning", normRect.replace(prefix.trim(), "application"), path],
  ["warning", "unrelated warning", path],
  ["error", "unrelated error", path],
  ["error", "application failure: Created TensorFlow Lite", "/src/application.js"]
]) assertFatal(type, text, sourcePath);

for (const [type, text, sourcePath] of exactRuntimeDiagnostics) {
  for (const [changedType, changedText, changedPath] of [
    [type === "warning" ? "error" : "warning", text, sourcePath],
    [type, `${text} suffix`, sourcePath],
    [type, text, sourcePath === "unknown" ? "/src/application.js" : "unknown"],
    [type, text, sourcePath === path ? "/npm/@mediapipe/tasks-vision@1.0.2/wasm/vision_wasm_internal.js" : path]
  ]) assertFatal(changedType, changedText, changedPath);
}

const transport = createProfileBrowserNoiseCollector();
transport.observeNoise("http:404:/missing");
transport.observeNoise("requestfailed:/asset:net::ERR_FAILED");
transport.observeNoise("pageerror:boom");
assert.deepEqual(transport.snapshot(), ["http:404:/missing", "requestfailed:/asset:net::ERR_FAILED", "pageerror:boom"]);
assert.throws(() => transport.snapshot().push("mutate"), TypeError);

console.log("Profile browser noise policy adversaries passed: 5 exact tuples admitted; duplicate, cross-family, type/path/version/text/suffix and transport variants rejected.");
