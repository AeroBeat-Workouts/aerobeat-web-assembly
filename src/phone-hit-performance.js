// @ts-check
// Isolated visual Test presentation comparison. No camera, audio, CV or scoring.
import { createAeroPlayCanvasRenderer } from "@aerobeat/web-renderer";
import { defineAeroUiElements } from "@aerobeat/web-ui";
import { createEquipmentConfigIdentity } from "@aerobeat/web-contracts";
import { sha256Hex } from "@aerobeat/web-hash";
import { canonicalEquipmentConfigIdentityInput } from "./equipment-config.js";
import { equipmentConfigDefaults } from "./equipment-config-defaults.js";
import { gameplayEquipmentRecords } from "./gameplay-equipment-records.js";
import { squareRadialSaberTarget } from "./saber-zone-direction.js";
import { testEquipmentInput } from "./test-equipment-authoring.js";
import { createPhoneHitWorkload, phoneHitWorkload } from "./phone-hit-workload.js";
import { createPrivatePerformanceRecorder } from "./private-performance-recorder.js";

defineAeroUiElements();
const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector("#game"));
const stage = /** @type {HTMLElement} */ (document.querySelector(".stage"));
const quality = /** @type {import('@aerobeat/web-ui').AeroSelect} */ (document.querySelector("#quality"));
const fps = /** @type {HTMLElement} */ (document.querySelector("#fps"));
const status = /** @type {HTMLOutputElement} */ (document.querySelector("#status"));
const summary = /** @type {HTMLOutputElement} */ (document.querySelector("#summary"));
const notice = /** @type {HTMLElement} */ (document.querySelector("#notice"));
const qualityOptions = Object.freeze([{value:"1",label:"Full (1.0)"},{value:"0.75",label:"High (0.75)"},{value:"0.5",label:"Medium (0.5)"},{value:"0.25",label:"Low (0.25)"}]);
const previewOnly = new URLSearchParams(location.search).get("preview") === "1";
const warmMs = previewOnly ? 500 : 3000;
const measureMs = previewOnly ? 6500 : 60000;
const EMPTY = Object.freeze([]);
const grid = Object.freeze({x:0,y:0,width:1,height:1});
const cursorOptions = Object.freeze({grid,minConfidence:.5,sizeCssPx:32});
const equipmentOptions = Object.freeze({grid});
quality.setOptions(qualityOptions);
if (previewOnly) notice.textContent = "PREVIEW ONLY: 6.5-second measured windows include the first hit at 4.3 seconds and only 0.5 seconds of steady hits. They are short wiring checks, NOT sustained phone hit/corpse evidence. Remove ?preview=1 for 60-second windows.";
const workload = createPhoneHitWorkload();
const renderer = createAeroPlayCanvasRenderer();
const recorder = createPrivatePerformanceRecorder({capacity:2048});
const firstBurstRecorder = createPrivatePerformanceRecorder({capacity:512});
const steadyRecorder = createPrivatePerformanceRecorder({capacity:2048});
// A separate scalar-only projection timer; the display recorders above time the
// renderer call, never the event/aftermath projection or GPU execution.
const PROJECTION_SAMPLE_CAPACITY = 2048;
const projectionOverall = [];
const projectionFirstBurst = [];
const projectionSteady = [];
function recordProjection(values, durationMs) {
  values.push(Math.round(Math.max(0, durationMs) * 1000) / 1000);
  if (values.length > PROJECTION_SAMPLE_CAPACITY) values.shift();
}
function projectionStatistics(values) {
  if (values.length === 0) return {count:0,p50:null,p95:null,max:null};
  const sorted = [...values].sort((a,b) => a - b);
  return {count:sorted.length,p50:sorted[Math.ceil(sorted.length * .5) - 1],p95:sorted[Math.ceil(sorted.length * .95) - 1],max:sorted[sorted.length - 1]};
}
/** @type {Array<Record<string,unknown>>} */ const runs = [];
/** @type {Array<{mode:string,reason:string}>} */ const failures = [];
let activeMode = "no-hit", renderScale = 1, phase = "loading", phaseStarted = 0, measuredAt = 0, latestStatsAt = 0;
let windowGeometry = "", raf = 0, disposed = false, minimum = Infinity, maximum = 0;
let minPieces = Infinity, maxPieces = 0, maxHitFeedback = 0, hitFeedbackFrames = 0, aftermathFrames = 0;
let firstBurstFrames = 0, firstBurstHitFeedbackFrames = 0, firstBurstAftermathFrames = 0, steadyFrames = 0, steadyAftermathFrames = 0;
/** @type {unknown} */ let configIdentity = null;
/** @type {readonly unknown[]} */ let equipment = EMPTY;

function label(mode) { return mode === "real-hit" ? "Committed hits" : "No hits"; }
function updateButtons() { for (const button of document.querySelectorAll("aero-button[data-mode]")) button.setAttribute("aria-pressed", String(button.getAttribute("data-mode") === activeMode)); }
function geometryKey() { return `${stage.clientWidth}:${stage.clientHeight}:${devicePixelRatio}:${renderScale}:${canvas.width}:${canvas.height}`; }
function resize() {
  const bounds = stage.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) return;
  renderer.resize({widthCssPx:bounds.width,heightCssPx:bounds.height,devicePixelRatio:devicePixelRatio || 1,renderScale});
  if ((phase === "warmup" || phase === "measuring") && windowGeometry && geometryKey() !== windowGeometry) invalidate("Canvas size or orientation changed during the window.");
}
function invalidate(reason) {
  if (phase === "invalid" || disposed) return;
  phase = "invalid";
  failures.push({mode:activeMode,reason:reason.slice(0,256)});
  status.textContent = `Window invalid: ${reason} Choose a mode to retry.`;
  summary.textContent = "Invalid and hidden-tab windows are excluded from results.";
  fps.setAttribute("status", "Invalid window");
}
function beginWindow(now) {
  phase = "warmup"; phaseStarted = now; measuredAt = 0; windowGeometry = geometryKey();
  status.textContent = `${label(activeMode)} warming up…`;
  summary.textContent = `Warming for ${warmMs / 1000}s, then ${previewOnly ? "PREVIEW ONLY · " : ""}${measureMs / 1000}s measurement. Static Test sabers are identical in both modes.`;
  fps.setAttribute("status", "Warming up");
}
function measureStart(now) {
  phase = "measuring"; measuredAt = now; windowGeometry = geometryKey();
  minimum = Infinity; maximum = 0; minPieces = Infinity; maxPieces = 0; maxHitFeedback = 0; hitFeedbackFrames = 0; aftermathFrames = 0;
  firstBurstFrames = 0; firstBurstHitFeedbackFrames = 0; firstBurstAftermathFrames = 0; steadyFrames = 0; steadyAftermathFrames = 0;
  recorder.reset("test-hit-display",now);
  firstBurstRecorder.reset("first-hit-burst",now + phoneHitWorkload.firstHitMs);
  steadyRecorder.reset("steady-hits",now + 6000);
  projectionOverall.length = 0; projectionFirstBurst.length = 0; projectionSteady.length = 0;
  status.textContent = `${label(activeMode)} measuring${previewOnly ? " · PREVIEW ONLY" : ""}…`;
}
function sceneCounts(scene) {
  const targets = scene.targets.length;
  const aftermathEntries = scene.aftermath.length;
  const intendedPieces = scene.aftermath.reduce((sum, entry) => sum + (entry.family === "flow" ? 2 : 1), 0);
  const hitFeedback = scene.targets.reduce((sum, target) => sum + (target.judgement === "hit" ? 1 : 0), 0);
  return {targets,aftermathEntries,intendedPieces,hitFeedback};
}
function finish(now) {
  const sample = recorder.snapshot(now), firstBurst = firstBurstRecorder.snapshot(now), steady = steadyRecorder.snapshot(now);
  if (activeMode === "real-hit" && (firstBurstFrames < 1 || steadyFrames < 1 || maxPieces < 2 || maxHitFeedback < 1 || hitFeedbackFrames < 1 || aftermathFrames < 1 || firstBurstHitFeedbackFrames < 1 || firstBurstAftermathFrames < 1 || steadyAftermathFrames < 1)) { invalidate("Missing first-hit feedback/corpses or steady aftermath coverage; this hit window cannot be compared."); return; }
  if (sample.displayFrameCount < 2 || minimum === Infinity || minPieces === Infinity) { invalidate("Insufficient display frames."); return; }
  const run = {
    mode:activeMode,renderScale,backing:{width:canvas.width,height:canvas.height},
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
    workload:phoneHitWorkload.contract,targets:{min:minimum,max:maximum},
    displayFps:sample.displayRateFps,displayIntervals:sample.displayIntervals,missedVsync:sample.missedVsyncCount,
    rendererCallWallMs:sample.rendererCpuMs,projectionWallMs:projectionStatistics(projectionOverall),
    aftermath:{intendedPieceCountMin:minPieces,intendedPieceCountMax:maxPieces,maxHitFeedback,hitFeedbackFrames,aftermathFrames,firstHitBurst:{startMs:4300,endMs:6000,displayFrames:firstBurstFrames,hitFeedbackFrames:firstBurstHitFeedbackFrames,aftermathFrames:firstBurstAftermathFrames,displayIntervals:firstBurst.displayIntervals,missedVsync:firstBurst.missedVsyncCount,rendererCallWallMs:firstBurst.rendererCpuMs,projectionWallMs:projectionStatistics(projectionFirstBurst)},steady:{startMs:6000,displayFrames:steadyFrames,aftermathFrames:steadyAftermathFrames,displayIntervals:steady.displayIntervals,missedVsync:steady.missedVsyncCount,rendererCallWallMs:steady.rendererCpuMs,projectionWallMs:projectionStatistics(projectionSteady)}},
    durationMs:sample.durationMs,previewOnly
  };
  runs.push(run); phase = "done";
  summary.textContent = `${label(activeMode)}: ${run.displayFps} scene FPS, display p95 ${sample.displayIntervals.p95} ms; ${runs.length} completed run(s). ${previewOnly ? "PREVIEW ONLY: 6.5s covers the first-hit burst and just 0.5s of steady hits; NOT sustained phone evidence." : "Compare first-hit burst against steady hits, then reverse mode order."}`;
  status.textContent = `${label(activeMode)} complete — choose a mode to measure again.`;
  fps.setAttribute("heading", `${run.displayFps} scene FPS`); fps.setAttribute("status", "Window complete");
}
function report() { return {
  schema:"aerobeat/phone_test_hit_comparison",version:1,
  source:typeof __AEROBEAT_PHONE_COMMIT__ !== "undefined" ? __AEROBEAT_PHONE_COMMIT__ : "development",
  gameplayCommit:typeof __AEROBEAT_PHONE_GAMEPLAY_COMMIT__ !== "undefined" ? __AEROBEAT_PHONE_GAMEPLAY_COMMIT__ : "development",
  renderer:{commit:typeof __AEROBEAT_PHONE_RENDERER_COMMIT__ !== "undefined" ? __AEROBEAT_PHONE_RENDERER_COMMIT__ : "development",facadeSha256:typeof __AEROBEAT_PHONE_RENDERER_SOURCE_SHA256__ !== "undefined" ? __AEROBEAT_PHONE_RENDERER_SOURCE_SHA256__ : "development",shadowMode:typeof __AEROBEAT_PHONE_SHADOW_MODE__ !== "undefined" ? __AEROBEAT_PHONE_SHADOW_MODE__ : "native"},
  workload:{contract:phoneHitWorkload.contract,firstHitMs:phoneHitWorkload.firstHitMs,noteStride:phoneHitWorkload.noteStride,corpusEvents:workload.events.length,purpose:"visual_test",automaticFeedback:false,equipment:"static canonical Test Flow",slicePosition:"midpoint approximation"},
  browser:navigator.userAgent.slice(0,200),previewOnly,
  statisticsNote:"Display FPS spans each measured window. Display p95 and renderer-call wall-time p95 use bounded recent 2048 samples (first-hit burst at most 512). Projection wall time independently brackets one workload.frame call and retains at most 2048 scalar durations per window/phase; it includes target and aftermath projection, not renderer work. Both wall times measure main-thread elapsed work, NOT GPU time. Intended aftermath pieces are scene projection counts, not observed pool or material counts. No touch collision or camera/CV is sampled.",
  failures,runs
}; }
async function prepareEquipment() {
  const value = await sha256Hex(canonicalEquipmentConfigIdentityInput(equipmentConfigDefaults));
  if (disposed) return;
  configIdentity = createEquipmentConfigIdentity({schema:"aerobeat/equipment_config_identity",version:1,algorithm:"sha256",value});
  const input = testEquipmentInput("off");
  const flow = equipmentConfigDefaults.flow.saber;
  const targets = {};
  for (const hand of ["left", "right"]) {
    const anchor = input.anchors.find((entry) => entry.anchor === `${hand}_wrist`);
    if (!anchor) throw new Error("Static Test wrist unavailable");
    targets[hand] = Object.freeze({orientation:squareRadialSaberTarget(anchor.x,1 - anchor.y,flow.zones,flow.blendRadius,{x:.5,y:.5}).orientation});
  }
  equipment = gameplayEquipmentRecords(false,{purpose:"visual_test",state:"playing",timestampMs:0},input,"flow",null,targets,equipmentConfigDefaults,configIdentity);
  if (equipment.length !== 2) throw new Error("Static Test Flow equipment unavailable");
}
function frame(now) {
  if (disposed) return;
  raf = requestAnimationFrame(frame);
  if (document.hidden || phase === "error" || phase === "invalid") return;
  if (!configIdentity || renderer.describe().gameplayAssets.state !== "ready") return;
  if (phase === "loading") beginWindow(now);
  if (phase === "warmup" && geometryKey() !== windowGeometry) { invalidate("Canvas size or orientation changed during warmup."); return; }
  if (phase === "warmup" && now - phaseStarted >= warmMs) measureStart(now);
  if (phase === "measuring" && geometryKey() !== windowGeometry) { invalidate("Canvas size or orientation changed during the window."); return; }
  const elapsed = Math.max(0, now - (phase === "measuring" ? measuredAt : phaseStarted));
  let scene;
  const projectionStarted = performance.now();
  try { scene = activeMode === "real-hit" ? workload.frameHit(elapsed) : workload.frameNoHit(elapsed); }
  catch (error) { invalidate(`Scene projection failed: ${(error instanceof Error ? error.message : String(error)).slice(0,160)}`); return; }
  const projectionWallMs = performance.now() - projectionStarted;
  const counts = sceneCounts(scene); // One workload projection, never a second frameCounts projection.
  const renderStarted = performance.now();
  let result;
  try { result = renderer.renderGameplayFrameWithCursorsAndEquipment(scene, EMPTY, cursorOptions, equipment, equipmentOptions); }
  catch (error) { invalidate(`Renderer threw: ${(error instanceof Error ? error.message : String(error)).slice(0,160)}`); return; }
  const renderWallMs = performance.now() - renderStarted;
  if (result.status.state !== "running") { invalidate(`Renderer failed: ${result.status.errorMessage ?? result.status.state}`); return; }
  if (phase !== "measuring") return;
  minimum = Math.min(minimum,counts.targets); maximum = Math.max(maximum,counts.targets);
  minPieces = Math.min(minPieces,counts.intendedPieces); maxPieces = Math.max(maxPieces,counts.intendedPieces);
  maxHitFeedback = Math.max(maxHitFeedback,counts.hitFeedback);
  if (counts.hitFeedback > 0) hitFeedbackFrames++;
  if (counts.intendedPieces > 0) aftermathFrames++;
  recorder.record({timestampMs:now,rendererCpuMs:renderWallMs});
  recordProjection(projectionOverall,projectionWallMs);
  if (elapsed >= phoneHitWorkload.firstHitMs && elapsed < 6000) {
    recordProjection(projectionFirstBurst,projectionWallMs);
    firstBurstFrames++;
    if (counts.hitFeedback > 0) firstBurstHitFeedbackFrames++;
    if (counts.intendedPieces > 0) firstBurstAftermathFrames++;
    firstBurstRecorder.record({timestampMs:now,rendererCpuMs:renderWallMs});
  }
  if (elapsed >= 6000) {
    recordProjection(projectionSteady,projectionWallMs);
    steadyFrames++;
    if (counts.intendedPieces > 0) steadyAftermathFrames++;
    steadyRecorder.record({timestampMs:now,rendererCpuMs:renderWallMs});
  }
  if (now - latestStatsAt > 500) {
    latestStatsAt = now;
    const sample = recorder.snapshot(now);
    fps.setAttribute("heading", `${sample.displayRateFps ?? 0} scene FPS`);
    fps.setAttribute("status", `${label(activeMode)}${previewOnly ? " · PREVIEW" : ""}`);
    status.textContent = `${label(activeMode)} · ${Math.ceil(Math.max(0,measureMs - elapsed) / 1000)}s left · ${renderScale}× backing · ${canvas.width}×${canvas.height}px`;
  }
  if (elapsed >= measureMs) finish(now);
}
renderer.attach(canvas);
renderer.setBackgroundProjection({kind:"linear-gradient",colors:["#071426","#153b5d"],angleDeg:180});
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(stage); resize(); updateButtons();
void prepareEquipment().then(() => { if (!disposed) raf = requestAnimationFrame(frame); }).catch((error) => {
  if (disposed) return;
  phase = "error"; status.textContent = `Equipment unavailable: ${(error instanceof Error ? error.message : String(error)).slice(0,160)}`;
});
document.addEventListener("aero-button-activate", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const mode = target.dataset.mode;
  if (mode === "no-hit" || mode === "real-hit") {
    if (document.hidden) { invalidate("Tab hidden before mode selection."); return; }
    activeMode = mode; updateButtons();
    if (configIdentity && renderer.describe().gameplayAssets.state === "ready") beginWindow(performance.now());
    else { phase = "loading"; status.textContent = "Loading gameplay assets…"; }
    return;
  }
  if (target.id === "copy") void navigator.clipboard.writeText(JSON.stringify(report())).then(
    () => { notice.textContent = "Results copied. Paste JSON after both full windows."; },
    () => { notice.textContent = "Clipboard unavailable. Use Download JSON instead."; }
  );
  if (target.id === "download") {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:"application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = "aerobeat-phone-test-hit-comparison.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
});
quality.addEventListener("aero-select-change", (event) => {
  const scale = Number(event.detail?.value);
  if (!qualityOptions.some((option) => Number(option.value) === scale) || scale === renderScale) return;
  const oldPhase = phase;
  if (phase === "warmup" || phase === "measuring") invalidate("Render resolution changed during the window.");
  renderScale = scale; resize();
  if (oldPhase === "done") {
    phase = "invalid";
    fps.setAttribute("heading","— scene FPS"); fps.setAttribute("status","Choose a mode");
    status.textContent = `Resolution changed to ${renderScale}×. Choose a mode to start a fresh window.`;
    summary.textContent = `${runs.length} completed run(s) saved. Changing resolution never restarts a finished window.`;
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !disposed && phase !== "invalid") invalidate("Tab hidden before or during a benchmark window.");
});
window.addEventListener("pagehide", () => {
  disposed = true; cancelAnimationFrame(raf); resizeObserver.disconnect(); renderer.destroy();
});
