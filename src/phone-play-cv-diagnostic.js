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
const BUNDLE_PATH = "/phone-play-cv-bundle-manifest.json";
// A short QA-only journey can exercise the real graph without pretending to be
// sustained physical evidence; its exported report always says invalid.
const QA_PREVIEW = new URLSearchParams(globalThis.location.search).get("preview") === "1";
const MEASURE_MS = QA_PREVIEW ? 4_000 : 60_000;
const WARMUP_MS = QA_PREVIEW ? 500 : 3_000;
if (QA_PREVIEW) startButton.textContent = "QA preview (not phone evidence)";
let observer = createPhonePlayCvWindow();
let phase = "waiting", warmupTimer = null, measureTimer = null, lastReport = null;
let provenance = null, provenanceFailure = false, noticeUntil = 0;
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
  downloadButton.disabled = lastReport === null;
  downloadButton.hidden = lastReport === null;
  if (phase === "waiting" && !provenanceFailure && performance.now() >= noticeUntil) setState(provenance ? (ready() ? "Ready: keep moving in Play, then tap Measure." : "Load a chart, choose Start, finish calibration, then close the menu.") : "Checking private build identity…");
  if (phase === "measuring") {
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
  lastReport = Object.freeze({schema:"aerobeat/private_phone_play_cv_report",version:1,purpose:"play",packageVersion:PACKAGE_VERSION,
    build:{stamp:BUILD_STAMP,bundleManifestSha256:provenance?.sha256 ?? null},valid:window.valid && !QA_PREVIEW,
    invalidReason:QA_PREVIEW ? "qa_preview_not_phone_evidence" : window.invalidReason,window});
  noticeUntil = performance.now() + 5000;
  setState(QA_PREVIEW ? "QA preview complete. JSON is not sustained phone evidence." : window.valid ? "Play window complete. Download your JSON." : `Window invalid (${window.invalidReason}). Download the JSON or repeat Play.`);
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
    if (manifest?.schema !== "aerobeat/private_phone_play_cv_bundle" || manifest.version !== 1 || manifest.buildStamp !== BUILD_STAMP ||
      !Array.isArray(manifest.assets) || manifest.assets.length < 2) throw new Error("private bundle identity mismatch");
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
