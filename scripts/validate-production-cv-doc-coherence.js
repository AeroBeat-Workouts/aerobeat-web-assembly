// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { lockedProductionCvProfile } from "../src/production-cv-profile.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const profile = lockedProductionCvProfile;

assert.deepEqual(profile, {
  backendId: "mediapipe",
  vendorId: "mediapipe-tasks-vision",
  model: "Pose Landmarker Lite float16 /1/",
  runtimeVersion: "1.0.1",
  providerId: "cpu-wasm",
  executionLocation: "worker",
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  trackingProfile: "fast",
  performancePresetId: "full",
  resizePath: "none",
  gameplaySource: "measured",
  submissionCadenceTargetFps: 15
}, "documentation authority must read the exact current locked production profile");

const servicePath = join(root, "src/production-cv-service.js");
const service = readFileSync(servicePath, "utf8");
for (const required of [
  "supportedSources: Object.freeze([\"live-camera\"])",
  "providerId: \"cpu-wasm\"",
  "executionLocation: \"worker\"",
  "gameplaySource: \"measured\"",
  "resizePath: \"none\"",
  "targetFps > 15",
  "execution.fallback !== false",
  "no replay, fallback, backend selector, resize, or prediction route"
]) {
  assert.ok(service.includes(required), `locked production service lost required source truth: ${required}`);
}

const trackedDocs = execFileSync("git", ["ls-files", "--", "README.md", "docs/*.md", "docs/**/*.md"], {
  cwd: root,
  encoding: "utf8"
}).trim().split("\n").filter(Boolean);
assert.ok(trackedDocs.includes("README.md"), "tracked current documentation must include README.md");
assert.ok(trackedDocs.length >= 5, "tracked current documentation inventory is unexpectedly small");

const docs = new Map(trackedDocs.map((path) => [path, readFileSync(join(root, path), "utf8")]));
const violations = [];
const historicalMarker = "Historical frozen-release evidence (superseded; not current production):";
let historicalGpuLines = 0;

for (const [path, text] of docs) {
  for (const [index, line] of text.split("\n").entries()) {
    const location = `${path}:${index + 1}`;
    if (/GPU-WebGL/i.test(line)) {
      if (!line.includes(historicalMarker)) violations.push(`${location}: GPU-WebGL is allowed only in explicitly marked historical frozen-release evidence`);
      else historicalGpuLines += 1;
    }
    if (/(?:CPU-WASM.{0,80}diagnostic|diagnostic.{0,80}CPU-WASM)/i.test(line)) violations.push(`${location}: CPU-WASM cannot be described as diagnostic`);
    if (/(?:selected|selectable|choose|switch).{0,40}(?:backend|provider)/i.test(line) && /(?:production|camera|inference|MediaPipe|CV)/i.test(line) && !/(?:no|non-selectable|does not)/i.test(line)) violations.push(`${location}: current production cannot imply backend/provider selection`);
    if (/(?:CV-owned replay|replay source).{0,100}(?:fallback|blocked camera|model failure|runtime failure)/i.test(line)) violations.push(`${location}: current production cannot claim replay fallback`);
    if (/(?:fallback run|fallback truth).{0,100}(?:provider|inference|telemetry)/i.test(line)) violations.push(`${location}: operator instructions cannot assume a production provider fallback`);
  }
}

assert.equal(historicalGpuLines, 2, "exactly two old Task 13 GPU proof lines must remain explicitly historical");
assert.deepEqual(violations, [], `stale production CV documentation:\n${violations.join("\n")}`);

const requiredCurrentTruth = new Map([
  ["README.md", ["Pose Landmarker Lite float16 `/1/`", "CPU-WASM in the dedicated MediaPipe Worker", "Direct full input, no resize", "measured/current gameplay input", "15fps inference submission ceiling", "no backend/provider selector", "no replay/provider fallback", "tracking-freshness failures fail closed"]],
  ["docs/secure-context.md", ["Pose Landmarker Lite float16 `/1/`", "CPU-WASM in the dedicated MediaPipe Worker", "no resize", "measured-current gameplay only", "no replay or provider fallback", "fail closed", "15 FPS (`<=15.01` only as measurement tolerance)"]],
  ["docs/decisions/0001-aero-game-assembly-and-iframe-boundary.md", ["CPU-WASM in the dedicated MediaPipe Worker", "no resize", "measured-current routing only", "no replay/provider fallback", "fail closed", "15 FPS submission ceiling (`<=15.01` measurement tolerance)"]],
  ["docs/task12-physical-playtest-handoff.md", ["CPU-WASM in the dedicated MediaPipe Worker", "no resize", "measured-current gameplay only", "no selectable provider or replay/provider fallback", "must fail closed", "15 FPS submission ceiling (`<=15.01` measurement tolerance)"]],
  ["docs/task13-final-audit.md", ["CPU-WASM in the dedicated MediaPipe Worker", "no resize", "measured-current gameplay only", "no replay/provider fallback", "fail closed", "15 FPS submission ceiling (`<=15.01` measurement tolerance)"]]
]);

for (const [path, requiredPhrases] of requiredCurrentTruth) {
  const text = docs.get(path);
  assert.ok(text, `required current document is not tracked: ${path}`);
  for (const phrase of requiredPhrases) assert.ok(text.includes(phrase), `${path} lacks current locked production truth: ${phrase}`);
}

const task13 = docs.get("docs/task13-final-audit.md") ?? "";
assert.equal(task13.split(historicalMarker).length - 1, 2, "both retained Task 13 GPU proofs must be explicitly historical and superseded");

console.log(JSON.stringify({
  oracle: "production-cv-documentation-coherence",
  trackedCurrentDocs: trackedDocs.length,
  profile: `${profile.model}; tasks-vision ${profile.runtimeVersion}; ${profile.providerId}; ${profile.executionLocation}; ${profile.gameplaySource}; resize ${profile.resizePath}; <=${profile.submissionCadenceTargetFps}fps`,
  historicalFrozenGpuProofLines: historicalGpuLines,
  service: relative(root, servicePath),
  pass: true
}));
