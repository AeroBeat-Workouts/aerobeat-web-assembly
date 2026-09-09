import assert from "node:assert/strict";
import { createProfileBrowserNoiseCollector } from "./profile-browser-noise-policy.mjs";

const path = "/npm/@mediapipe/tasks-vision@1.0.1/wasm/vision_wasm_internal.js";
const warning = "W0909 23:41:30.520999 2196592 landmark_projection_calculator.cc:81] Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI. Provide IMAGE_DIMENSIONS or use PROJECTION_MATRIX.";

const singleton = createProfileBrowserNoiseCollector();
singleton.observeConsole("warning", warning, path);
assert.deepEqual(singleton.snapshot(), []);

const duplicate = createProfileBrowserNoiseCollector();
duplicate.observeConsole("warning", warning, path);
duplicate.observeConsole("warning", warning, path);
assert.deepEqual(duplicate.snapshot(), [`warning:${warning}:${path}`]);

const adversaries = [
  ["error", warning, path],
  ["warning", warning, "/src/application.js"],
  ["warning", warning, "/npm/@mediapipe/tasks-vision@1.0.2/wasm/vision_wasm_internal.js"],
  ["warning", warning.replace("cc:81", "cc:82"), path],
  ["warning", warning.replace("NORM_RECT", "NORM_RECTS"), path],
  ["warning", `${warning} ignored`, path],
  ["warning", warning.replace("W0909 23:41:30.520999 2196592", "application"), path],
  ["warning", "unrelated warning", path],
  ["error", "unrelated error", path]
];
for (const [type, text, sourcePath] of adversaries) {
  const collector = createProfileBrowserNoiseCollector();
  collector.observeConsole(type, text, sourcePath);
  assert.deepEqual(collector.snapshot(), [`${type}:${text}:${sourcePath}`]);
}

for (const [type, text] of [
  ["error", "INFO: Created TensorFlow Lite XNNPACK delegate for CPU."],
  ["warning", "W0000 gl_context.cc] OpenGL error checking is disabled"],
  ["warning", "GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): test"],
  ["warning", "Feedback manager requires a model with a single signature inference. Disabling support for feedback tensors."]
]) {
  const collector = createProfileBrowserNoiseCollector();
  collector.observeConsole(type, text, path);
  assert.deepEqual(collector.snapshot(), []);
}

const transport = createProfileBrowserNoiseCollector();
transport.observeNoise("http:404:/missing");
transport.observeNoise("requestfailed:/asset:net::ERR_FAILED");
transport.observeNoise("pageerror:boom");
assert.deepEqual(transport.snapshot(), ["http:404:/missing", "requestfailed:/asset:net::ERR_FAILED", "pageerror:boom"]);
assert.throws(() => transport.snapshot().push("mutate"), TypeError);

console.log("Profile browser noise policy adversaries passed: exact singleton admitted; duplicate and 9 console plus transport variants rejected.");
