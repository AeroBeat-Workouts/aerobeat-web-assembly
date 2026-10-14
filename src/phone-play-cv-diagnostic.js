// @ts-check
// Separate private page: opt-in scalar observation of genuine camera-backed Play.
// No pose data, video bytes, chart identity, persistence, or report upload.
import "./index.js";
import { createPhonePlayCvWindow } from "./phone-play-cv-window.js";
import { sha256Hex } from "@aerobeat/web-hash";

const game = document.querySelector("aero-game");
const panel = document.querySelector("#play-cv-recorder");
const state = document.querySelector("#play-cv-state");
const startButton = document.querySelector("#play-cv-start");
const downloadButton = document.querySelector("#play-cv-download");
const summary = document.querySelector("#play-cv-summary");
if (!game || !panel || !state || !startButton || !downloadButton || !summary) throw new Error("Private Play diagnostic controls missing");

const BUILD_STAMP = __AEROBEAT_BUILD_STAMP__;
const PACKAGE_VERSION = __AEROBEAT_PACKAGE_VERSION__;
const PRIVATE_GPU_RESULT = typeof __AEROBEAT_PRIVATE_GAMEPLAY_CV_MODE__ !== "undefined" && __AEROBEAT_PRIVATE_GAMEPLAY_CV_MODE__ === "gpu-after-result";
const BUNDLE_PATH = PRIVATE_GPU_RESULT ? __AEROBEAT_PRIVATE_PLAY_CV_BUNDLE_PATH__ : "/phone-play-cv-bundle-manifest.json";
const BUNDLE_SCHEMA = PRIVATE_GPU_RESULT ? "aerobeat/private_phone_play_cv_gpu_result_bundle" : "aerobeat/private_phone_play_cv_bundle";
if (PRIVATE_GPU_RESULT) panel.querySelector("strong").textContent = "Private full-game GPU-first after-result / fresh CPU fallback";
function executionIdentity() {
  if (!PRIVATE_GPU_RESULT) return null;
  try {
    const cv = game.graph?.cv?.getStatus?.();
    const provider = cv?.providerId === "gpu-webgl" ? "gpu-webgl" : cv?.providerId === "cpu-wasm" ? "cpu-wasm" : null;
    const scheduler = cv?.schedulingMode === "after-result" ? "after-result" : cv?.schedulingMode === "fixed-tick" ? "fixed-tick" : null;
    return { provider, scheduler, executionLocation:cv?.executionLocation === "worker" ? "worker" : null,
      fallback:provider === "cpu-wasm" ? "fresh_cpu_wasm_initialization_fallback" : provider === "gpu-webgl" ? "none" : "unverified" };
  } catch { return { provider:null, scheduler:null, executionLocation:null, fallback:"unverified" }; }
}
// A short QA-only journey can exercise the real graph without pretending to be
// sustained physical evidence; its exported report always says invalid.
const QA_PREVIEW = new URLSearchParams(globalThis.location.search).get("preview") === "1";
const MEASURE_MS = QA_PREVIEW ? 4_000 : 60_000;
const WARMUP_MS = QA_PREVIEW ? 500 : 3_000;
if (QA_PREVIEW) startButton.textContent = "QA preview (not phone evidence)";
let observer = createPhonePlayCvWindow();
let phase = "waiting", warmupTimer = null, measureTimer = null, lastReport = null;
let provenance = null, provenanceFailure = false, noticeUntil = 0, measuredExecution = null;
function setState(message, measuring = false) { state.textContent = message; state.dataset.measuring = String(measuring); }
function ready() {
  try {
    const graph = game.graph, session = graph?.gameplay?.getSnapshot?.()?.session;
    const video = game.videoElement?.(), track = graph?.video?.getRetainedCameraStream?.()?.getVideoTracks?.()[0];
    return !document.hidden && game.menuOpen === false && session?.purpose === "play" && session?.state === "playing" &&
      Boolean(graph?.input?.getSnapshot?.()?.calibration?.calibrationId) && graph?.cv?.getStatus?.()?.running === true &&
      track?.readyState === "live" && video?.readyState >= 2 && typeof video?.requestVideoFrameCallback === "function";
  } catch { return false; }
}
function refresh() {
  const menu = game.menuOpen !== false;
  panel.dataset.gameMenu = String(menu);
  startButton.disabled = phase !== "waiting" || !provenance || !ready();
  if (PRIVATE_GPU_RESULT && phase === "waiting" && ready() && lastReport === null) {
    const identity = executionIdentity();
    summary.textContent = `Scheduler ${identity?.scheduler ?? "unverified"} · actual Worker ${identity?.provider ?? "unverified"}${identity?.provider === "cpu-wasm" ? " (fresh CPU fallback; not GPU evidence)" : ""}`;
  }
  downloadButton.disabled = lastReport === null;
  downloadButton.hidden = lastReport === null;
  if (phase === "waiting" && !provenanceFailure && performance.now() >= noticeUntil) setState(provenance ? (ready() ? "Ready: keep moving in Play, then tap Measure." : "Load a chart, choose Start, finish calibration, then close the menu.") : "Checking private build identity…");
  if (phase === "measuring") {
    const currentExecution = executionIdentity();
    if (PRIVATE_GPU_RESULT && (currentExecution?.provider !== measuredExecution?.provider || currentExecution?.scheduler !== "after-result" || currentExecution?.executionLocation !== "worker")) measuredExecution = { ...measuredExecution, changed:true };
    const window = observer.snapshot();
    if (!window.valid) { finish(); return; }
    const remaining = Math.max(0, Math.ceil((MEASURE_MS - window.durationMs) / 1000));
    setState(`Recording Play · ${remaining}s left`, true);
    summary.textContent = `Scene ${window.ratesFps.scene ?? "—"}/s · camera ${window.ratesFps.cameraUnique ?? "—"}/s · poses ${window.ratesFps.cvPoses ?? "—"}/s`;
  }
}
function finish() {
  if (measureTimer !== null) { clearTimeout(measureTimer); measureTimer = null; }
  if (phase !== "measuring") return;
  const window = observer.stop();
  phase = "waiting";
  // Explicit report allowlist: nothing from the live graph or private samples is spread.
  // Development without a verified bundle can never masquerade as phone evidence.
  const verifiedBundle = typeof provenance?.sha256 === "string" && /^[0-9a-f]{64}$/u.test(provenance.sha256);
  const currentExecution = executionIdentity();
  if (PRIVATE_GPU_RESULT && (currentExecution?.provider !== measuredExecution?.provider || currentExecution?.scheduler !== measuredExecution?.scheduler || currentExecution?.executionLocation !== measuredExecution?.executionLocation)) measuredExecution = { ...measuredExecution, changed:true };
  const identityValid = !PRIVATE_GPU_RESULT || (measuredExecution?.provider === currentExecution?.provider &&
    measuredExecution?.scheduler === "after-result" && currentExecution?.scheduler === "after-result" &&
    measuredExecution?.executionLocation === "worker" && currentExecution?.executionLocation === "worker" && !measuredExecution?.changed);
  const valid = window.valid && !QA_PREVIEW && verifiedBundle && identityValid && (!PRIVATE_GPU_RESULT || measuredExecution.provider === "gpu-webgl");
  const invalidReason = QA_PREVIEW ? "qa_preview_not_phone_evidence" : !verifiedBundle ? "unverified_build" :
    !identityValid ? "worker_execution_identity_changed_or_unverified" : PRIVATE_GPU_RESULT && measuredExecution.provider === "cpu-wasm" ? "cpu_fallback_not_gpu_evidence" :
    PRIVATE_GPU_RESULT && measuredExecution.provider !== "gpu-webgl" ? "worker_provider_unverified" : window.invalidReason;
  lastReport = Object.freeze({schema:PRIVATE_GPU_RESULT ? "aerobeat/private_phone_play_cv_gpu_result_report" : "aerobeat/private_phone_play_cv_report",version:1,purpose:PRIVATE_GPU_RESULT ? "full_game_play_gpu_after_result_candidate" : "play",packageVersion:PACKAGE_VERSION,
    build:{stamp:BUILD_STAMP,bundleManifestSha256:provenance?.sha256 ?? null},
    ...(PRIVATE_GPU_RESULT ? {scheduler:{mode:measuredExecution?.scheduler ?? null,targetFps:15},delegate:{requested:"gpu-webgl",selected:measuredExecution?.provider ?? null,executionLocation:measuredExecution?.executionLocation ?? null,fallback:measuredExecution?.fallback ?? "unverified"}} : {}),
    valid,invalidReason,window});
  noticeUntil = performance.now() + 5000;
  setState(QA_PREVIEW ? "QA preview complete. JSON is not sustained phone evidence." : valid ? (PRIVATE_GPU_RESULT ? "GPU after-result Play window complete. Download your JSON." : "Play window complete. Download your JSON.") : `Window invalid (${invalidReason}). Download the JSON or repeat Play.`);
  summary.textContent = `Scene ${window.ratesFps.scene ?? "—"}/s · camera ${window.ratesFps.cameraUnique ?? "—"}/s · poses ${window.ratesFps.cvPoses ?? "—"}/s · fresh input ${window.ratesFps.freshPoseConsumption ?? "—"}/s`;
  observer.dispose(); observer = createPhonePlayCvWindow();
  refresh();
}
function startWarmup() {
  if (phase !== "waiting" || !provenance || !ready()) return;
  phase = "warmup"; lastReport = null; downloadButton.hidden = true;
  setState(QA_PREVIEW ? "QA warmup · not sustained phone evidence" : "Play warmup · 3 seconds"); refresh();
  warmupTimer = setTimeout(() => {
    warmupTimer = null;
    if (phase !== "warmup") return;
    if (!ready() || !observer.start(game)) {
      const reason = observer.snapshot().invalidReason;
      phase = "waiting"; noticeUntil = performance.now() + 5000;
      setState(`Not recording (${reason || "Play not ready"}). Keep playing and retry.`);
      refresh(); return;
    }
    measuredExecution = executionIdentity();
    phase = "measuring";
    measureTimer = setTimeout(finish, MEASURE_MS);
    refresh();
  }, WARMUP_MS);
}
function cancelWarmup() {
  if (phase !== "warmup") return;
  if (warmupTimer !== null) { clearTimeout(warmupTimer); warmupTimer = null; }
  phase = "waiting"; noticeUntil = performance.now() + 5000;
  setState("Warmup interrupted. Resume Play and retry."); refresh();
}
function onVisibility() {
  if (!document.hidden) return;
  if (phase === "warmup") cancelWarmup();
  if (phase === "measuring") { observer.snapshot(); finish(); }
}
startButton.addEventListener("click", event => { if (event.isTrusted) startWarmup(); });
downloadButton.addEventListener("click", event => {
  if (!event.isTrusted || !lastReport || !provenance) return;
  const json = JSON.stringify(lastReport, null, 2);
  if (json.length > 16384) { setState("Report exceeded the private size bound; no file was saved."); return; }
  const url = URL.createObjectURL(new Blob([json], {type:"application/json"}));
  const link = document.createElement("a"); link.href = url; link.download = "aerobeat-private-play-tracking-v1.json";
  if (PRIVATE_GPU_RESULT) link.download = "aerobeat-private-play-gpu-after-result-v1.json";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener("visibilitychange", onVisibility);
globalThis.addEventListener("pagehide", () => { if (phase === "warmup") cancelWarmup(); else if (phase === "measuring") finish(); observer.dispose(); });
setInterval(() => { if (phase === "warmup" && !ready()) cancelWarmup(); refresh(); }, 500);

(async () => {
  try {
    const response = await fetch(BUNDLE_PATH, {cache:"no-store"});
    if (!response.ok) throw new Error("private bundle manifest unavailable");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 128_000 || bytes.byteLength < 16) throw new Error("private bundle manifest size invalid");
    const manifest = JSON.parse(new TextDecoder("utf-8", {fatal:true}).decode(bytes));
    if (manifest?.schema !== BUNDLE_SCHEMA || manifest.version !== 1 || manifest.buildStamp !== BUILD_STAMP ||
      !Array.isArray(manifest.assets) || manifest.assets.length < 2 ||
      (PRIVATE_GPU_RESULT && (manifest.scheduler?.mode !== "after-result" || manifest.requestedDelegate !== "gpu-webgl"))) throw new Error("private bundle identity mismatch");
    const digest = await sha256Hex(bytes);
    provenance = Object.freeze({sha256:digest});
  } catch {
    // Dev is for fixture discovery only; a served private build without an
    // exact sidecar must not produce a phone report that appears verified.
    if (import.meta.env.DEV) provenance = Object.freeze({sha256:null});
    else { provenanceFailure = true; setState("Private build identity failed. Do not use this page for a phone report."); }
  }
  refresh();
})();
