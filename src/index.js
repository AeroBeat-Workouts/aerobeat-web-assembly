// @ts-check

import "@aerobeat/web-style/aero-theme.css";
import { elementNames, serviceIds } from "@aerobeat/web-contracts";
import {
  aeroCvPerformancePresets,
  createAeroCameraCvService,
  createAeroCvFrameSourceFromVideoSurface,
  createReplayPoseFrame,
  getAeroCvPerformancePreset
} from "@aerobeat/web-cv";
import {
  createMeasuredPoseRoutingSample,
  createPoseInputRouter,
  evaluateHeldOutPoseTrace
} from "@aerobeat/web-input";
import { createAeroWebGl2Renderer } from "@aerobeat/web-renderer";
import {
  aeroButtonActivateEventName,
  aeroCalibrationEventNames,
  defineAeroUiElements
} from "@aerobeat/web-ui";
import { createBrowserVideoMediaFacade, createLiveCameraSourceDescriptor } from "@aerobeat/web-video";
import { appMetadata } from "./release-metadata.js";
import {
  measuredSubmissionCadenceFps,
  resolvePoseGameplaySource,
  updatePoseGameplaySourceSearch
} from "./pose-gameplay-source.js";
import { createPredictivePoseOracleTrace } from "./predictive-pose-oracle-fixture.js";
import { createPredictivePoseRoutingCoordinator } from "./predictive-pose-routing-coordinator.js";
import { createAeroCadenceLoop } from "./runtime-cadence.js";
import {
  createPoseBackendComposition,
  getMediaPipeTuningDefinition,
  getPoseSourceId,
  resolvePoseSelection
} from "./pose-backend-registry.js";

defineAeroUiElements();

/**
 * @typedef {Object} PoseFlowDraftEventView
 * @property {string} mode Gameplay mode.
 * @property {string} eventName Browser event name.
 * @property {string} summary Short event summary.
 * @property {import("@aerobeat/web-contracts").AeroPoseSampleProvenance} provenance Measured or predicted source.
 * @property {number} measurementTimestampMs Latest real measurement timestamp.
 * @property {number} predictionHorizonMs Prediction horizon.
 */

/**
 * @typedef {import("@aerobeat/web-cv").AeroCameraCvService} AeroCameraCvService
 * @typedef {import("@aerobeat/web-cv").AeroCvServiceStatus} AeroCvServiceStatus
 * @typedef {import("@aerobeat/web-video").BrowserVideoMediaFacade} BrowserVideoMediaFacade
 * @typedef {import("@aerobeat/web-video").AeroVideoSurfaceDescriptor} AeroVideoSurfaceDescriptor
 * @typedef {import("@aerobeat/web-renderer").AeroWebGl2Renderer} AeroWebGl2Renderer
 * @typedef {import("./runtime-cadence.js").AeroCadenceLoop} AeroCadenceLoop
 */

/**
 * Root product shell for the AeroBeat browser app.
 */
class AeroBeatApp extends HTMLElement {
  /** @type {Promise<void> | undefined} */
  #cameraPermissionRequest;

  /** @type {BrowserVideoMediaFacade} */
  #videoMediaFacade = createBrowserVideoMediaFacade();

  /** @type {import("@aerobeat/web-cv").AeroCvPerformancePresetId} */
  #cvPerformancePresetId = "full";

  /** @type {ReturnType<typeof resolvePoseSelection>} */
  #poseSelection = resolvePoseSelection();

  /** @type {ReturnType<typeof resolvePoseGameplaySource>} */
  #poseGameplaySelection = resolvePoseGameplaySource({
    backendId: this.#poseSelection.selectedBackendId,
    performancePresetId: this.#cvPerformancePresetId
  });

  /** @type {AeroCameraCvService} */
  #cvService = this.#createCvService();

  /** @type {ReturnType<typeof createPoseInputRouter>} */
  #inputRouter = createPoseInputRouter();

  /** @type {ReturnType<typeof createPredictivePoseRoutingCoordinator>} */
  #predictiveRouting = createPredictivePoseRoutingCoordinator();

  /** @type {ReturnType<typeof evaluateHeldOutPoseTrace>} */
  #poseOracle = evaluateHeldOutPoseTrace(createPredictivePoseOracleTrace());

  /** @type {import("@aerobeat/web-contracts").AeroPoseRoutingSample | undefined} */
  #latestGameplayPoseSample;

  /** @type {number | undefined} */
  #gameplayRoutingStartedAtMs;

  /** @type {AeroWebGl2Renderer} */
  #renderer = createAeroWebGl2Renderer();

  /** @type {AeroCadenceLoop | undefined} */
  #overlayCadence;

  /** @type {AeroCadenceLoop | undefined} */
  #statusCadence;

  /** @type {number} */
  #renderedPoseFrameCount = 0;

  /** @type {string} */
  #lastRoutedPoseFrameKey = "";

  /** @type {readonly PoseFlowDraftEventView[]} */
  #latestInputEvents = [];

  /** @type {number} */
  #legacyMeasuredSampleCount = 0;

  /** @type {number} */
  #legacyMeasuredEventCount = 0;

  /** @type {Record<string, number>} */
  #legacyEventCountByIntent = {};

  /** @type {number} */
  #lastOverlayLandmarkCount = 0;

  /** @type {AeroVideoSurfaceDescriptor | undefined} */
  #activeSurface;

  /** @type {number | undefined} */
  #mediaFrameRateFps;

  /** @type {number | undefined} */
  #lastMeasuredVideoFrameCount;

  /** @type {number | undefined} */
  #lastMeasuredVideoFrameTimeMs;

  /** @type {"smoother" | "fast"} */
  #trackingProfile = "fast";

  /** @type {Set<string>} */
  #telemetryDownloadUrls = new Set();

  /**
   * Creates the app shadow DOM.
   */
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          background:
            radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.92), transparent 22rem),
            linear-gradient(135deg, #f9fdff 0%, #cfedf8 42%, #d7f6e8 100%);
          color: var(--aero-color-ink, #103447);
          display: block;
          font-family: var(--aero-font-family, system-ui, sans-serif);
          min-height: 100vh;
        }

        .shell {
          box-sizing: border-box;
          display: grid;
          gap: 14px;
          grid-template-rows: auto auto auto 1fr auto;
          min-height: 100vh;
          padding: clamp(12px, 3vw, 32px);
        }

        .title-row,
        .build-row,
        .metadata {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          justify-content: space-between;
        }

        .build-row aero-status-panel {
          inline-size: 100%;
        }

        .title {
          font-size: clamp(1.6rem, 4vw, 2.8rem);
          font-weight: 800;
          line-height: 1;
        }

        .metadata {
          font-size: 0.86rem;
          font-weight: 650;
        }

        .calibration-entrypoint {
          display: block;
          inline-size: min(100%, 34rem);
          justify-self: center;
        }

        .stage {
          align-items: stretch;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 2fr) minmax(280px, 0.55fr);
        }

        .status-grid {
          align-content: center;
          display: grid;
          gap: 12px;
        }

        .hero {
          align-content: center;
          display: grid;
          gap: 18px;
          min-height: 420px;
        }

        aero-media-pose-preview {
          max-inline-size: none;
          min-block-size: 320px;
        }

        .runtime {
          align-content: start;
          display: grid;
          gap: 12px;
        }

        .diagnostics-hidden {
          display: none !important;
        }

        .timing-window-progress {
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(53, 141, 175, 0.38);
          border-radius: 999px;
          font-size: 0.95rem;
          font-weight: 800;
          margin: 0;
          padding: 10px 14px;
          text-align: center;
        }

        .telemetry-capture {
          display: grid;
          gap: 8px;
        }

        .telemetry-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .telemetry-output {
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(53, 141, 175, 0.32);
          border-radius: 8px;
          box-sizing: border-box;
          color: inherit;
          display: block;
          font: 600 0.78rem/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          inline-size: 100%;
          min-block-size: 108px;
          margin: 0;
          overflow: auto;
          padding: 10px;
          user-select: text;
          white-space: pre-wrap;
        }

        .checkpoint-note {
          font-size: 0.86rem;
          font-weight: 650;
          line-height: 1.35;
        }

        code {
          background: rgba(255, 255, 255, 0.62);
          border: 1px solid rgba(53, 141, 175, 0.24);
          border-radius: 6px;
          padding: 2px 6px;
        }

        .checkpoint-note {
          margin: 0;
        }

        @media (max-width: 780px) {
          .stage {
            grid-template-columns: 1fr;
          }

          .hero {
            min-height: auto;
          }
        }
      </style>
      <main class="shell">
        <header class="title-row">
          <span class="title">AeroBeat</span>
        </header>
        <div class="build-row">
          <aero-status-panel heading="Build" status="Version ${appMetadata.displayVersion} / Built ${appMetadata.buildStamp} / Cache ${appMetadata.cacheBust}"></aero-status-panel>
        </div>
        <aero-button class="calibration-entrypoint" label="Begin calibration"></aero-button>
        <section class="stage" aria-label="AeroBeat app shell">
          <div class="hero">
            <aero-media-pose-preview source-kind="live-camera" source-id="${this.#poseSourceId()}" fit-mode="cover" mirrored="true"></aero-media-pose-preview>
          </div>
          <div class="runtime">
            <p class="timing-window-progress" role="status" aria-live="polite">Timing window 0/120</p>
            <div class="telemetry-capture">
              <div class="telemetry-actions" aria-label="Telemetry capture controls">
                <aero-button class="telemetry-copy" label="Copy telemetry"></aero-button>
                <aero-button class="telemetry-download" label="Download telemetry"></aero-button>
              </div>
              <aero-status-panel class="telemetry-capture-state diagnostics-hidden" heading="Telemetry" status="Capture ready"></aero-status-panel>
              <pre class="telemetry-output" tabindex="0" aria-label="Captured telemetry snapshot">Captured telemetry snapshot will appear here for selection and sharing.</pre>
            </div>
            <div class="diagnostics-hidden" aria-hidden="true">
              <aero-status-panel heading="Services" status="${this.#serviceSummary()}"></aero-status-panel>
              <aero-status-panel class="inference-state" heading="Inference" status="CV idle / preset ${this.#cvPerformancePreset().label} (${this.#cvPerformancePreset().summary}) / execution main-thread direct adapter / resize none / model idle / source none / inference frames 0 / pose frames 0"></aero-status-panel>
              <aero-status-panel class="media-state" heading="Media" status="Source none / playback idle"></aero-status-panel>
              <aero-pose-flow-panel></aero-pose-flow-panel>
              <p class="checkpoint-note">Runtime checkpoint starts with CV-owned replay frames for secure loading checks; calibration switches to the locked MediaPipe Pose Landmarker Lite backend when camera and runtime setup succeed.</p>
              <aero-status-panel class="calibration-state" heading="Calibration" status="Idle - press Begin calibration"></aero-status-panel>
              <aero-status-panel class="camera-permission-state" heading="Camera" status="Permission idle"></aero-status-panel>
              <aero-calibration-screen></aero-calibration-screen>
            </div>
          </div>
        </section>
        <footer class="metadata">
          <span>Secure context: ${this.#secureContextLabel()}</span>
          <span>Element: <code>${elementNames.app}</code></span>
        </footer>
      </main>
    `;
    root.addEventListener(aeroCalibrationEventNames.stateChange, (event) => {
      this.#handleCalibrationStateChange(event);
    });
    root.addEventListener(aeroButtonActivateEventName, (event) => {
      this.#handleTopbarCalibrationStart(event);
      this.#handleTelemetryCaptureAction(event);
    });
    window.requestAnimationFrame(() => {
      this.#normalizePoseGameplaySelection(true);
      this.#configurePreviewServices();
      this.#updateInferenceStatus();
      this.#runRuntimeCheckpoint();
    });
  }

  /**
   * Releases live camera tracks when the app leaves the page.
   */
  disconnectedCallback() {
    this.#stopLiveInferenceRoute(false);
    void this.#cvService.dispose();
    this.#revokeTelemetryDownloadUrls();
  }

  /**
   * @returns {string}
   */
  #secureContextLabel() {
    return window.isSecureContext ? "ready" : "use HTTPS or localhost for camera checks";
  }

  /**
   * @returns {string}
   */
  #serviceSummary() {
    return [
      "aero.video.media",
      serviceIds.cvPose,
      "aero.renderer.webgl2",
      serviceIds.inputRouter,
      serviceIds.uiRouter
    ].join(" / ");
  }

  /**
   * Reflects public calibration state events in the assembly shell.
   *
   * @param {Event} event
   * @returns {void}
   */
  #handleCalibrationStateChange(event) {
    if (!(event instanceof CustomEvent)) {
      return;
    }
    const status = event.detail?.status;
    const panel = this.shadowRoot?.querySelector(".calibration-state");
    if (typeof status === "string") {
      panel?.setAttribute("status", status);
    }
    if (event.detail?.state === "active") {
      this.shadowRoot
        ?.querySelector(".calibration-entrypoint")
        ?.setAttribute("label", "Calibration running");
      this.#startLiveCameraPermissionRequest();
    }
  }

  /**
   * Routes the first-viewport command through the reusable calibration screen.
   *
   * @param {Event} event
   * @returns {void}
   */
  #handleTopbarCalibrationStart(event) {
    if (!event.composedPath().includes(this.shadowRoot?.querySelector(".calibration-entrypoint") ?? this)) {
      return;
    }
    event.stopPropagation();
    this.shadowRoot
      ?.querySelector("aero-calibration-screen")
      ?.shadowRoot
      ?.querySelector("aero-button")
      ?.shadowRoot
      ?.querySelector("button")
      ?.click();
  }

  /**
   * Starts the live camera permission checkpoint once per app instance.
   *
   * @returns {void}
   */
  #startLiveCameraPermissionRequest() {
    if (this.#cameraPermissionRequest) {
      return;
    }
    this.#setCameraPermissionStatus(`Camera permission: requesting / pose ${this.#poseSelection.selectedBackendId}/${this.#poseSelection.selectedProviderId} / CV preset ${this.#cvPerformancePreset().label}`);
    this.#cameraPermissionRequest = this.#requestLiveCameraPermission();
  }

  /**
   * @returns {Promise<void>}
   */
  async #requestLiveCameraPermission() {
    const source = createLiveCameraSourceDescriptor({
      sourceId: this.#poseSourceId(),
      constraints: this.#liveCameraConstraints(),
      fitMode: "cover",
      mirrored: true
    });
    const result = await this.#videoMediaFacade.requestCamera(source);
    if (result.status === "granted") {
      await this.#startLiveInferenceRoute(result.stream, result.source);
      return;
    }
    if (result.status === "unsupported") {
      this.#setCameraPermissionStatus("Camera permission: unsupported");
      return;
    }
    this.#setCameraPermissionStatus(`Camera permission: blocked (${result.errorName ?? "unknown"})`);
  }

  /**
   * @param {string} status
   * @returns {void}
   */
  #setCameraPermissionStatus(status) {
    this.shadowRoot
      ?.querySelector(".camera-permission-state")
      ?.setAttribute("status", status);
  }

  /**
   * Captures copy/download actions from the phone-friendly telemetry controls.
   *
   * @param {Event} event
   * @returns {void}
   */
  #handleTelemetryCaptureAction(event) {
    if (!(event instanceof CustomEvent)) {
      return;
    }
    const path = event.composedPath();
    if (path.includes(this.shadowRoot?.querySelector(".telemetry-copy") ?? this)) {
      event.stopPropagation();
      this.#copyTelemetrySnapshot();
      return;
    }
    if (path.includes(this.shadowRoot?.querySelector(".telemetry-download") ?? this)) {
      event.stopPropagation();
      this.#downloadTelemetrySnapshot();
    }
  }

  /**
   * Copies the current runtime diagnostic snapshot when the browser allows it.
   *
   * @returns {void}
   */
  #copyTelemetrySnapshot() {
    const snapshot = this.#captureTelemetrySnapshotText();
    const clipboard = navigator.clipboard;
    if (window.isSecureContext && clipboard && typeof clipboard.writeText === "function") {
      clipboard.writeText(snapshot)
        .then(() => {
          this.#setTelemetryCaptureStatus("Copied telemetry snapshot to clipboard");
        })
        .catch(() => {
          this.#selectTelemetrySnapshot();
          this.#setTelemetryCaptureStatus("Clipboard blocked - snapshot selected below");
        });
      return;
    }
    this.#selectTelemetrySnapshot();
    this.#setTelemetryCaptureStatus("Clipboard unavailable - snapshot selected below");
  }

  /**
   * Downloads the current runtime diagnostic snapshot as a text file.
   *
   * @returns {void}
   */
  #downloadTelemetrySnapshot() {
    const snapshot = this.#captureTelemetrySnapshotText();
    if (typeof URL.createObjectURL !== "function") {
      this.#selectTelemetrySnapshot();
      this.#setTelemetryCaptureStatus("Download unavailable - snapshot selected below");
      return;
    }

    let url = "";
    try {
      const blob = new Blob([snapshot], { type: "text/plain;charset=utf-8" });
      url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `aerobeat-telemetry-${new Date().toISOString().replace(/[:.]/gu, "-")}.txt`;
      anchor.rel = "noopener";
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      this.#telemetryDownloadUrls.add(url);
      window.setTimeout(() => {
        this.#revokeTelemetryDownloadUrl(url);
      }, 60_000);
      this.#setTelemetryCaptureStatus("Telemetry download started - snapshot available below");
    } catch {
      if (url) {
        URL.revokeObjectURL(url);
      }
      this.#selectTelemetrySnapshot();
      this.#setTelemetryCaptureStatus("Download failed - snapshot selected below");
    }
  }

  /**
   * Revokes one retained telemetry object URL after the mobile download manager has time to consume it.
   *
   * @param {string} url
   * @returns {void}
   */
  #revokeTelemetryDownloadUrl(url) {
    if (!this.#telemetryDownloadUrls.delete(url)) {
      return;
    }
    URL.revokeObjectURL(url);
  }

  /**
   * Revokes retained telemetry object URLs when the app leaves the page.
   *
   * @returns {void}
   */
  #revokeTelemetryDownloadUrls() {
    for (const url of this.#telemetryDownloadUrls) {
      URL.revokeObjectURL(url);
    }
    this.#telemetryDownloadUrls.clear();
  }

  /**
   * Builds a selectable diagnostic snapshot from the same strings rendered in the app.
   *
   * @returns {string}
   */
  #captureTelemetrySnapshotText() {
    const cvStatus = this.#cvService.getStatus();
    const previewState = this.#getPosePreview().describePreview();
    const overlayCadence = this.#overlayCadence?.getStatus();
    const statusCadence = this.#statusCadence?.getStatus();
    const tuning = getMediaPipeTuningDefinition(this.#poseSelection.selectedMediaPipeTuningId);
    const tuningApplicability = this.#poseSelection.mediaPipeTuningApplicable ? "applicable" : "not applicable";
    const routingStatus = this.#predictiveRouting.getStatus();
    const predictorStatus = routingStatus.predictor;
    const predictedTreatmentActive = this.#poseGameplaySelection.effectiveId === "predicted-8";
    const activeInputStatus = predictedTreatmentActive
      ? routingStatus.input
      : {
        measuredEventCount: this.#legacyMeasuredEventCount,
        predictedEventCount: 0,
        emittedEventCount: this.#legacyMeasuredEventCount,
        suppressedRepeatedEventCount: 0,
        eventCountByIntent: this.#legacyEventCountByIntent
      };
    const routingElapsedSeconds = this.#gameplayRoutingStartedAtMs === undefined
      ? undefined
      : Math.max(0.001, (performance.now() - this.#gameplayRoutingStartedAtMs) / 1000);
    const measuredRoutingCount = predictedTreatmentActive
      ? routingStatus.measuredRoutedSampleCount
      : this.#legacyMeasuredSampleCount;
    const predictedRoutingCount = predictedTreatmentActive ? routingStatus.predictedRoutedSampleCount : 0;
    const measuredRoutingRate = routingElapsedSeconds === undefined ? undefined : measuredRoutingCount / routingElapsedSeconds;
    const predictedRoutingRate = routingElapsedSeconds === undefined ? undefined : predictedRoutingCount / routingElapsedSeconds;
    const estimatedInferenceOccupancyMsPerSecond = cvStatus.averageAdapterInferenceMs === undefined
      || cvStatus.effectiveSubmissionRateFps === undefined
      ? undefined
      : cvStatus.averageAdapterInferenceMs * cvStatus.effectiveSubmissionRateFps;
    const snapshot = [
      "AeroBeat telemetry snapshot",
      `Timestamp: ${new Date().toISOString()}`,
      `Route URL: ${window.location.href}`,
      `Secure context: ${this.#secureContextLabel()}`,
      `Browser user agent: ${navigator.userAgent}`,
      `Navigator platform: ${navigator.platform || "unavailable"}`,
      `Navigator language: ${navigator.language || "unavailable"}`,
      `Hardware concurrency: ${navigator.hardwareConcurrency || "unavailable"}`,
      `Device memory: ${this.#deviceMemoryLabel()}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight}`,
      `Screen: ${window.screen.width}x${window.screen.height}`,
      `Device pixel ratio: ${window.devicePixelRatio}`,
      `Screen orientation: ${window.screen.orientation?.type ?? "unavailable"}`,
      `App version: ${appMetadata.displayVersion}`,
      `Build stamp: ${appMetadata.buildStamp}`,
      `Cache token: ${appMetadata.cacheBust}`,
      `Selected camera: ${this.#selectedCameraLabel()}`,
      `Selected tracking profile: ${this.#trackingProfile}`,
      `Requested/selected/effective pose gameplay source: ${this.#poseGameplaySelection.requestedId} / ${this.#poseGameplaySelection.selectedId} / ${this.#poseGameplaySelection.effectiveId}`,
      `Pose gameplay source fallback: ${this.#poseGameplaySelection.warning ?? "none"}`,
      `Latest gameplay provenance: ${this.#latestGameplayPoseSample?.provenance ?? "none"}`,
      `Latest measurement/target/horizon: ${this.#formatCvMs(this.#latestGameplayPoseSample?.measurementTimestampMs)} / ${this.#formatCvMs(this.#latestGameplayPoseSample?.targetTimestampMs)} / ${this.#formatCvMs(this.#latestGameplayPoseSample?.predictionHorizonMs)}`,
      `Measured/predicted gameplay rates: ${this.#formatFps(measuredRoutingRate)} / ${this.#formatFps(predictedRoutingRate)}`,
      `Gameplay route lifecycle epoch/generation/resets: ${routingStatus.lifecycleEpoch} / ${routingStatus.lifecycleGeneration} / ${routingStatus.lifecycleResetCount}`,
      `Gameplay route reset reasons: ${JSON.stringify(routingStatus.lifecycleResetCountByReason)}`,
      `Measured/predicted gameplay samples: ${measuredRoutingCount} / ${predictedRoutingCount}`,
      `Gameplay events measured/predicted/total: ${activeInputStatus.measuredEventCount} / ${activeInputStatus.predictedEventCount} / ${activeInputStatus.emittedEventCount}`,
      `Gameplay events deduplicated: ${activeInputStatus.suppressedRepeatedEventCount}`,
      `Gameplay event counts by intent: ${JSON.stringify(activeInputStatus.eventCountByIntent)}`,
      `Measured gameplay events by intent: ${JSON.stringify(predictedTreatmentActive ? routingStatus.measuredEventCountByIntent : this.#legacyEventCountByIntent)}`,
      `Predicted gameplay events by intent: ${JSON.stringify(predictedTreatmentActive ? routingStatus.predictedEventCountByIntent : {})}`,
      `Routing suppressions duplicate measurement/superseded measurement/target/stale lifecycle/frozen: ${routingStatus.duplicateMeasurementSuppressionCount} / ${routingStatus.supersededMeasurementUpdateCount} / ${routingStatus.duplicateTargetSuppressionCount} / ${routingStatus.staleLifecycleSuppressionCount} / ${routingStatus.frozenPredictionCount}`,
      `Prediction horizon p50/p95/max: ${this.#formatCvMs(predictorStatus.predictionHorizonP50Ms)} / ${this.#formatCvMs(predictorStatus.predictionHorizonP95Ms)} / ${this.#formatCvMs(predictorStatus.predictionHorizonMaxMs)}`,
      `Prediction correction mean/p95/max: ${this.#formatRatio(predictorStatus.correctionMeanError)} / ${this.#formatRatio(predictorStatus.correctionP95Error)} / ${this.#formatRatio(predictorStatus.correctionMaxError)}`,
      `Prediction route epoch/generation/resets: ${predictorStatus.routeEpoch} / ${predictorStatus.routeGeneration} / ${predictorStatus.resetCount}`,
      `Prediction measured/predicted samples: ${predictorStatus.measuredSampleCount} / ${predictorStatus.predictedSampleCount}`,
      `Prediction resets source/discontinuity/reversal/incomplete: ${predictorStatus.sourceResetCount} / ${predictorStatus.discontinuityCount} / ${predictorStatus.reversalResetCount} / ${predictorStatus.incompleteMeasurementCount}`,
      `Prediction suppressions insufficient/invalid horizon/visibility/stale: ${predictorStatus.insufficientHistorySuppressionCount} / ${predictorStatus.invalidHorizonSuppressionCount} / ${predictorStatus.lowVisibilitySuppressionCount} / ${predictorStatus.staleSuppressionCount}`,
      `Prediction clamps coordinate/displacement: ${predictorStatus.coordinateClampCount} / ${predictorStatus.displacementClampCount}`,
      `Estimated inference occupancy: ${this.#formatCvMs(estimatedInferenceOccupancyMsPerSecond)} per second`,
      `Oracle trace measured/held-out/predicted/suppressed: ${this.#poseOracle.measuredFrameCount} / ${this.#poseOracle.heldOutFrameCount} / ${this.#poseOracle.heldOutPredictionCount} / ${this.#poseOracle.suppressedPredictionCount}`,
      `Oracle treatment prediction coverage: ${this.#formatRatio(this.#poseOracle.treatmentPredictionCoverage)}`,
      `Oracle control joint error p50/p95/max/mean: ${this.#formatRatio(this.#poseOracle.control.landmarkErrorP50)} / ${this.#formatRatio(this.#poseOracle.control.landmarkErrorP95)} / ${this.#formatRatio(this.#poseOracle.control.landmarkErrorMax)} / ${this.#formatRatio(this.#poseOracle.control.landmarkErrorMean)}`,
      `Oracle treatment joint error p50/p95/max/mean: ${this.#formatRatio(this.#poseOracle.treatment.landmarkErrorP50)} / ${this.#formatRatio(this.#poseOracle.treatment.landmarkErrorP95)} / ${this.#formatRatio(this.#poseOracle.treatment.landmarkErrorMax)} / ${this.#formatRatio(this.#poseOracle.treatment.landmarkErrorMean)}`,
      `Oracle treatment-minus-control joint improvement p50/p95/max/mean/mean ratio: ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.landmarkErrorP50)} / ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.landmarkErrorP95)} / ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.landmarkErrorMax)} / ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.landmarkErrorMean)} / ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.landmarkMeanErrorReductionRatio)}`,
      `Oracle control grid agreement wrist+nose/all: ${this.#formatRatio(this.#poseOracle.control.wristNoseCellAgreement)} / ${this.#formatRatio(this.#poseOracle.control.bodyGridCellAgreement)}`,
      `Oracle treatment grid agreement wrist+nose/all: ${this.#formatRatio(this.#poseOracle.treatment.wristNoseCellAgreement)} / ${this.#formatRatio(this.#poseOracle.treatment.bodyGridCellAgreement)}`,
      `Oracle treatment-minus-control grid agreement wrist+nose/all: ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.wristNoseCellAgreement)} / ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.bodyGridCellAgreement)}`,
      `Oracle control draft-intent precision/recall/F1/timing/events/matched/FP/FN/false repeats: ${this.#formatRatio(this.#poseOracle.control.intentPrecision)} / ${this.#formatRatio(this.#poseOracle.control.intentRecall)} / ${this.#formatRatio(this.#poseOracle.control.intentF1)} / ${this.#formatCvMs(this.#poseOracle.control.transitionTimingMeanErrorMs)} / ${this.#poseOracle.control.emittedEventCount} / ${this.#poseOracle.control.matchedEventCount} / ${this.#poseOracle.control.falsePositiveEventCount} / ${this.#poseOracle.control.falseNegativeEventCount} / ${this.#poseOracle.control.falseRepeatedEventCount}`,
      `Oracle treatment draft-intent precision/recall/F1/timing/events/matched/FP/FN/false repeats: ${this.#formatRatio(this.#poseOracle.treatment.intentPrecision)} / ${this.#formatRatio(this.#poseOracle.treatment.intentRecall)} / ${this.#formatRatio(this.#poseOracle.treatment.intentF1)} / ${this.#formatCvMs(this.#poseOracle.treatment.transitionTimingMeanErrorMs)} / ${this.#poseOracle.treatment.emittedEventCount} / ${this.#poseOracle.treatment.matchedEventCount} / ${this.#poseOracle.treatment.falsePositiveEventCount} / ${this.#poseOracle.treatment.falseNegativeEventCount} / ${this.#poseOracle.treatment.falseRepeatedEventCount}`,
      `Oracle treatment-minus-control intent precision/recall/F1/timing/events/matched/FP/FN/false repeats: ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.intentPrecision)} / ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.intentRecall)} / ${this.#formatRatio(this.#poseOracle.treatmentMinusControl.intentF1)} / ${this.#formatCvMs(this.#poseOracle.treatmentMinusControl.transitionTimingMeanErrorMs)} / ${this.#poseOracle.treatmentMinusControl.emittedEventCount} / ${this.#poseOracle.treatmentMinusControl.matchedEventCount} / ${this.#poseOracle.treatmentMinusControl.falsePositiveEventCount} / ${this.#poseOracle.treatmentMinusControl.falseNegativeEventCount} / ${this.#poseOracle.treatmentMinusControl.falseRepeatedEventCount}`,
      `Oracle decision thresholds: ${JSON.stringify(this.#poseOracle.thresholds)}`,
      `Oracle prediction improves measured-8 control: ${this.#poseOracle.predictionImprovesControl}`,
      `Oracle bounded recommendation (gameplay-input readiness only; no point-parity claim): ${this.#poseOracle.recommendation}`,
      `Requested pose backend: ${cvStatus.requestedBackendId}`,
      `Selected pose backend: ${cvStatus.selectedBackendId}`,
      `Effective pose backend: ${cvStatus.effectiveBackendId}`,
      `Selected/effective vendor: ${cvStatus.selectedVendorId} / ${cvStatus.effectiveVendorId}`,
      `Selected model: ${this.#formatPoseModel(cvStatus.selectedModel)}`,
      `Effective model: ${this.#formatPoseModel(cvStatus.effectiveModel)}`,
      `Requested/selected/actual provider: ${this.#poseSelection.requestedProviderId} / ${this.#poseSelection.selectedProviderId} / ${cvStatus.adapterExecutionProvider ?? "unknown"}`,
      `Requested/selected MediaPipe tuning: ${this.#poseSelection.requestedMediaPipeTuningId} / ${this.#poseSelection.selectedMediaPipeTuningId} (${tuningApplicability})`,
      `MediaPipe thresholds detection/presence/tracking: ${tuning.minPoseDetectionConfidence} / ${tuning.minPosePresenceConfidence} / ${tuning.minTrackingConfidence} (${tuningApplicability})`,
      `Selection fallback: ${this.#poseSelection.warning ?? "none"}`,
      `Adapter fallback: ${cvStatus.adapterExecutionFallback}`,
      `Adapter load: ${this.#formatCvMs(cvStatus.adapterLoadDurationMs)}`,
      `Adapter runtime inference: ${this.#formatCvMs(cvStatus.adapterRuntimeInferenceDurationMs)}`,
      `Adapter postprocess: ${this.#formatCvMs(cvStatus.adapterPostprocessDurationMs)}`,
      `Worker round trip: ${this.#formatCvMs(cvStatus.adapterTelemetry.workerRoundTripDurationMs)}`,
      `Selected CV preset: ${this.#cvPerformancePreset().label}`,
      `Execution location: ${cvStatus.adapterExecutionLocation}`,
      `Execution detail: ${cvStatus.adapterExecutionDetail}`,
      `Resize path: ${cvStatus.resizePath}`,
      `Transfer frame type: ${cvStatus.adapterTransferFrameType ?? "n/a"}`,
      `Inference input: ${cvStatus.inferenceInputWidth ?? "full"}x${cvStatus.inferenceInputHeight ?? "full"}`,
      `Prep cost: ${this.#formatCvMs(cvStatus.framePrepMs)} (avg ${this.#formatCvMs(cvStatus.averageFramePrepMs)})`,
      `Adapter cost: ${this.#formatCvMs(cvStatus.adapterInferenceMs)} (avg ${this.#formatCvMs(cvStatus.averageAdapterInferenceMs)})`,
      `Total CV cost: ${this.#formatCvMs(cvStatus.totalCvMs)} (avg ${this.#formatCvMs(cvStatus.averageTotalCvMs)})`,
      `Timing window: ${cvStatus.timingWindowSampleCount}/${cvStatus.timingWindowCapacity} / budget ${this.#formatCvMs(cvStatus.timingBudgetMs)} / over budget ${cvStatus.timingWindowOverBudgetCount}`,
      `Prep rolling p50/p95/max: ${this.#formatCvMs(cvStatus.rollingFramePrepP50Ms)} / ${this.#formatCvMs(cvStatus.rollingFramePrepP95Ms)} / ${this.#formatCvMs(cvStatus.rollingFramePrepMaxMs)}`,
      `Adapter rolling p50/p95/max: ${this.#formatCvMs(cvStatus.rollingAdapterInferenceP50Ms)} / ${this.#formatCvMs(cvStatus.rollingAdapterInferenceP95Ms)} / ${this.#formatCvMs(cvStatus.rollingAdapterInferenceMaxMs)}`,
      `Runtime rolling p50/p95/max: ${this.#formatCvMs(cvStatus.rollingRuntimeInferenceP50Ms)} / ${this.#formatCvMs(cvStatus.rollingRuntimeInferenceP95Ms)} / ${this.#formatCvMs(cvStatus.rollingRuntimeInferenceMaxMs)}`,
      `Worker round-trip rolling p50/p95/max: ${this.#formatCvMs(cvStatus.rollingWorkerRoundTripP50Ms)} / ${this.#formatCvMs(cvStatus.rollingWorkerRoundTripP95Ms)} / ${this.#formatCvMs(cvStatus.rollingWorkerRoundTripMaxMs)}`,
      `Total CV rolling p50/p95/max: ${this.#formatCvMs(cvStatus.rollingTotalCvP50Ms)} / ${this.#formatCvMs(cvStatus.rollingTotalCvP95Ms)} / ${this.#formatCvMs(cvStatus.rollingTotalCvMaxMs)}`,
      `Incomplete seven-point frames: ${cvStatus.timingWindowIncompletePoseCount}`,
      `Worker capture replacements / retired transferables: ${cvStatus.workerCaptureReplacementCount} / ${cvStatus.retiredTransferableFrameCount}`,
      `Sampling callback gap p50/p95/max/window: ${this.#formatCvMs(cvStatus.samplingCallbackGapP50Ms)} / ${this.#formatCvMs(cvStatus.samplingCallbackGapP95Ms)} / ${this.#formatCvMs(cvStatus.samplingCallbackGapMaxMs)} / ${cvStatus.samplingCallbackGapWindowSampleCount}`,
      `Sampling mode: ${cvStatus.samplingMode}`,
      `Sample/submission rate: ${this.#formatFps(cvStatus.effectiveSubmissionRateFps)} (target max ${this.#formatFps(cvStatus.submissionCadenceTargetFps)})`,
      `Pose-output rate: ${this.#formatFps(cvStatus.effectivePoseOutputRateFps)}`,
      `Status-update rate: ${this.#formatFps(statusCadence?.effectiveRateFps)} (target max ${this.#formatFps(statusCadence?.targetRateFps)})`,
      `Overlay-render rate: ${this.#formatFps(overlayCadence?.effectiveRateFps)} (target max ${this.#formatFps(overlayCadence?.targetRateFps)})`,
      `Submitted sample age: ${this.#formatCvMs(cvStatus.lastSubmittedFrameAgeMs)}`,
      `Output age: ${this.#formatCvMs(cvStatus.latestOutputAgeMs)}`,
      `Overlay render age: ${this.#formatCvMs(overlayCadence?.latestTickAgeMs)}`,
      `Status update age: ${this.#formatCvMs(statusCadence?.latestTickAgeMs)}`,
      `Media-pose delta (measured freshness): ${this.#formatCvMs(previewState.mediaPoseDeltaMs)}`,
      `Presentation-target delta: ${this.#formatCvMs(previewState.presentationTargetDeltaMs)}`,
      `Build panel: ${this.#statusPanelText('aero-status-panel[heading="Build"]')}`,
      `Camera panel: ${this.#statusPanelText(".camera-permission-state")}`,
      `Media panel: ${this.#statusPanelText(".media-state")}`,
      `Inference panel: ${this.#statusPanelText(".inference-state")}`,
      `Calibration panel: ${this.#statusPanelText(".calibration-state")}`,
      `Services panel: ${this.#statusPanelText('aero-status-panel[heading="Services"]')}`
    ].join("\n");
    const output = this.#telemetryOutput();
    if (output) {
      output.textContent = snapshot;
    }
    this.#setTelemetryCaptureStatus("Captured telemetry snapshot");
    return snapshot;
  }

  /**
   * @returns {void}
   */
  #selectTelemetrySnapshot() {
    const output = this.#telemetryOutput();
    if (!output) {
      return;
    }
    output.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(output);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  /**
   * @param {string} status
   * @returns {void}
   */
  #setTelemetryCaptureStatus(status) {
    this.shadowRoot
      ?.querySelector(".telemetry-capture-state")
      ?.setAttribute("status", status);
  }

  /**
   * @returns {HTMLElement | undefined}
   */
  #telemetryOutput() {
    const output = this.shadowRoot?.querySelector(".telemetry-output");
    return output instanceof HTMLElement ? output : undefined;
  }

  /**
   * @param {string} selector
   * @returns {string}
   */
  #statusPanelText(selector) {
    const panel = this.shadowRoot?.querySelector(selector);
    return panel?.getAttribute("status") ?? panel?.shadowRoot?.textContent?.trim() ?? "Unavailable";
  }

  /**
   * @returns {string}
   */
  #selectedCameraLabel() {
    return "Default camera";
  }

  /**
   * Stops live media and optionally the CV service. App teardown skips the
   * separate stop call so terminal dispose owns service cleanup.
   *
   * @param {boolean} [stopCvService]
   * @returns {void}
   */
  #stopLiveInferenceRoute(stopCvService = true) {
    this.#overlayCadence?.stop();
    this.#statusCadence?.stop();
    this.#overlayCadence = undefined;
    this.#statusCadence = undefined;
    this.#lastRoutedPoseFrameKey = "";
    this.#latestInputEvents = [];
    this.#renderedPoseFrameCount = 0;
    this.#lastOverlayLandmarkCount = 0;
    this.#resetGameplayRouting("stop");
    this.#videoMediaFacade.teardownCameraStream();
    if (stopCvService) {
      void this.#cvService.stop();
    }
    this.#cameraPermissionRequest = undefined;
    this.#mediaFrameRateFps = undefined;
    this.#lastMeasuredVideoFrameCount = undefined;
    this.#lastMeasuredVideoFrameTimeMs = undefined;
  }

  /**
   * Attaches the granted stream to the visible preview and starts CV inference.
   *
   * @param {MediaStream | undefined} stream
   * @param {ReturnType<typeof createLiveCameraSourceDescriptor>} source
   * @returns {Promise<void>}
   */
  async #startLiveInferenceRoute(stream, source) {
    this.#resetGameplayRouting("restart");
    this.#configurePreviewServices();
    const preview = this.#getPosePreview();
    preview.setTrackingProfile(this.#trackingProfile);
    this.#activeSurface = preview.attachCameraStream(stream, source);
    this.#updateMediaStatus(this.#activeSurface);
    this.#updateInferenceStatus();
    this.#setCameraPermissionStatus(`Camera permission: granted / loading ${this.#poseSelection.selectedBackendId}/${this.#poseSelection.selectedProviderId} / source live-camera / CV preset ${this.#cvPerformancePreset().label}`);

    try {
      const video = this.#getPreviewVideo();
      this.#activeSurface = await this.#videoMediaFacade.play(video);
      preview.setSurfaceDescriptor(this.#activeSurface);
      this.#updateMediaStatus(this.#activeSurface);
      const cvSource = createAeroCvFrameSourceFromVideoSurface(video, this.#activeSurface);
      cvSource.sourceId = this.#poseSourceId();
      cvSource.getFrameSource = () => video;
      cvSource.getTimestampMs = () => video.currentTime * 1000;
      cvSource.isFrameAvailable = () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      await this.#cvService.start(cvSource);
      const status = this.#cvService.getStatus();
      this.#updateCameraRuntimeStatus(status);
      this.#updateMediaStatus(this.#activeSurface, status);
      this.#updateInferenceStatus(status);
      this.#startLiveRuntimeCadences();
    } catch (error) {
      this.#setCameraPermissionStatus(`Camera permission: granted / ${this.#poseSelection.selectedBackendId}/${this.#poseSelection.selectedProviderId} inference error (${this.#errorName(error)}) / CV preset ${this.#cvPerformancePreset().label}`);
      this.#updateInferenceStatus();
    }
  }

  /**
   * Starts independently paced overlay and status lanes. Video sampling remains
   * owned by the CV service's video-frame-aware latest-frame-wins scheduler.
   *
   * @returns {void}
   */
  #startLiveRuntimeCadences() {
    this.#overlayCadence?.stop();
    this.#statusCadence?.stop();
    const lifecycleEpoch = this.#predictiveRouting.getLifecycleEpoch();
    this.#overlayCadence = createAeroCadenceLoop({
      targetRateFps: 30,
      callback: () => this.#renderLatestPoseOverlay(lifecycleEpoch),
      scheduler: undefined,
      now: undefined
    });
    this.#statusCadence = createAeroCadenceLoop({
      targetRateFps: 4,
      callback: () => this.#refreshRuntimeStatus(lifecycleEpoch),
      scheduler: undefined,
      now: undefined
    });
    this.#overlayCadence.start();
    this.#statusCadence.start();
  }

  /**
   * Draws and routes the explicitly selected gameplay source. Both measured
   * modes retain the legacy frame router; measured-8 differs only in CV
   * submission cadence. Predicted mode routes each real frame once and routes
   * only successful predictions between measurements. Failed prediction ticks
   * leave the latest overlay frozen without replaying gameplay input.
   *
   * @param {string} lifecycleEpoch
   * @returns {void}
   */
  #renderLatestPoseOverlay(lifecycleEpoch) {
    if (
      !this.#cvService.running
      || lifecycleEpoch !== this.#predictiveRouting.getLifecycleEpoch()
    ) {
      return;
    }
    const preview = this.#getPosePreview();
    const video = this.#getPreviewVideo();
    this.#activeSurface = this.#videoMediaFacade.describeSurface(video);
    preview.setSurfaceDescriptor(this.#activeSurface, { render: false });
    const poseFrame = this.#cvService.getLatestPoseFrame();
    if (poseFrame) {
      const frameKey = `${poseFrame.sourceId}:${poseFrame.timestampMs}`;
      if (this.#poseGameplaySelection.effectiveId === "predicted-8") {
        const measuredResult = this.#predictiveRouting.routeMeasuredFrame(poseFrame);
        if (measuredResult.sample) {
          this.#acceptPredictedRoutingResult(measuredResult, preview);
          this.#gameplayRoutingStartedAtMs ??= performance.now();
        } else {
          const predictedResult = this.#predictiveRouting.routePrediction(video.currentTime * 1000, lifecycleEpoch);
          if (predictedResult.sample) {
            this.#acceptPredictedRoutingResult(predictedResult, preview);
          }
        }
      } else {
        preview.setPoseFrame(poseFrame, { render: false });
        if (frameKey !== this.#lastRoutedPoseFrameKey) {
          this.#lastRoutedPoseFrameKey = frameKey;
          this.#gameplayRoutingStartedAtMs ??= performance.now();
          this.#latestGameplayPoseSample = createMeasuredPoseRoutingSample(poseFrame, {
            routeEpoch: this.#predictiveRouting.getLifecycleEpoch()
          });
          this.#latestInputEvents = this.#routeLegacyGameplayFrame(poseFrame);
        }
      }
    }
    const previewState = preview.renderPreview();
    this.#renderedPoseFrameCount += 1;
    this.#lastOverlayLandmarkCount = previewState.landmarkCount;
  }

  /**
   * @param {{ sample: import("@aerobeat/web-contracts").AeroPoseRoutingSample | undefined, events: readonly import("@aerobeat/web-input").PoseInputDraftEvent[] }} result
   * @param {import("@aerobeat/web-ui").AeroMediaPosePreview} preview
   * @returns {void}
   */
  #acceptPredictedRoutingResult(result, preview) {
    if (!result.sample) {
      return;
    }
    this.#latestGameplayPoseSample = result.sample;
    this.#latestInputEvents = this.#inputEventViews(result.events);
    preview.setPoseRoutingSample(result.sample, { render: false });
  }

  /**
   * @param {import("@aerobeat/web-contracts").NormalizedPoseFrame} poseFrame
   * @returns {readonly PoseFlowDraftEventView[]}
   */
  #routeLegacyGameplayFrame(poseFrame) {
    const views = this.#createInputEventViews(poseFrame, this.#inputRouter);
    this.#legacyMeasuredSampleCount += 1;
    this.#legacyMeasuredEventCount += views.length;
    for (const event of views) {
      this.#legacyEventCountByIntent[event.summary] = (this.#legacyEventCountByIntent[event.summary] ?? 0) + 1;
    }
    return views;
  }

  /**
   * Updates visible DOM diagnostics independently from video sampling and WebGL.
   *
   * @param {string} lifecycleEpoch
   * @returns {void}
   */
  #refreshRuntimeStatus(lifecycleEpoch) {
    if (
      !this.#cvService.running
      || lifecycleEpoch !== this.#predictiveRouting.getLifecycleEpoch()
    ) {
      return;
    }
    const video = this.#getPreviewVideo();
    this.#activeSurface = this.#videoMediaFacade.describeSurface(video);
    this.#updateMediaFrameRate(video);
    const status = this.#cvService.getStatus();
    this.#updateMediaStatus(this.#activeSurface, status);
    this.#updateCameraRuntimeStatus(status);
    const poseFrame = this.#cvService.getLatestPoseFrame();
    if (poseFrame) {
      const presentedFrame = this.#poseGameplaySelection.effectiveId === "predicted-8" && this.#latestGameplayPoseSample
        ? {
          sourceId: this.#latestGameplayPoseSample.sourceId,
          timestampMs: this.#latestGameplayPoseSample.targetTimestampMs,
          landmarks: this.#latestGameplayPoseSample.landmarks,
          mirrored: this.#latestGameplayPoseSample.mirrored
        }
        : poseFrame;
      this.#setPoseFlowPanelState(this.shadowRoot?.querySelector("aero-pose-flow-panel"), presentedFrame, this.#latestInputEvents);
      const calibrationScreen = this.shadowRoot?.querySelector("aero-calibration-screen");
      this.#setPoseFlowPanelState(
        calibrationScreen?.shadowRoot?.querySelector("aero-pose-flow-panel"),
        presentedFrame,
        this.#latestInputEvents
      );
    }
    this.#updateInferenceStatus(status);
  }

  /**
   * @param {AeroCvServiceStatus} [status]
   *
   * @returns {void}
   */
  #updateInferenceStatus(status = this.#cvService.getStatus()) {
    const source = status.fallbackActive
      ? `fallback ${status.fallbackSourceId ?? "unknown"}`
      : `${status.sourceKind ?? "none"} ${status.sourceId ?? "none"}`;
    const preview = this.shadowRoot?.querySelector("aero-media-pose-preview");
    const previewState = preview && "describePreview" in preview ? preview.describePreview() : undefined;
    const overlayLandmarkCount = Math.max(previewState?.landmarkCount ?? 0, this.#lastOverlayLandmarkCount);
    const mediaPoseDelta = typeof previewState?.mediaPoseDeltaMs === "number"
      ? `${previewState.mediaPoseDeltaMs}ms`
      : "n/a";
    const presentationTargetDelta = typeof previewState?.presentationTargetDeltaMs === "number"
      ? `${previewState.presentationTargetDeltaMs}ms`
      : "n/a";
    const routingStatus = this.#predictiveRouting.getStatus();
    const overlayCadence = this.#overlayCadence?.getStatus();
    const statusCadence = this.#statusCadence?.getStatus();
    const tuning = getMediaPipeTuningDefinition(this.#poseSelection.selectedMediaPipeTuningId);
    const tuningState = this.#poseSelection.mediaPipeTuningApplicable
      ? `${tuning.id} detection ${tuning.minPoseDetectionConfidence} presence ${tuning.minPosePresenceConfidence} tracking ${tuning.minTrackingConfidence}`
      : `${tuning.id} not applicable`;
    const timingProgress = this.shadowRoot?.querySelector(".timing-window-progress");
    if (timingProgress) {
      timingProgress.textContent = `Timing window ${status.timingWindowSampleCount}/${status.timingWindowCapacity}`;
    }
    const error = status.lastError ? ` / error ${status.lastError}` : "";
    this.shadowRoot
      ?.querySelector(".inference-state")
      ?.setAttribute("status", [
        `CV ${status.lifecycleState}`,
        `backend requested ${status.requestedBackendId} selected ${status.selectedBackendId} effective ${status.effectiveBackendId}`,
        `vendor selected ${status.selectedVendorId} effective ${status.effectiveVendorId}`,
        `model selected ${this.#formatPoseModel(status.selectedModel)} effective ${this.#formatPoseModel(status.effectiveModel)}`,
        `provider requested ${this.#poseSelection.requestedProviderId} selected ${this.#poseSelection.selectedProviderId} actual ${status.adapterExecutionProvider ?? "unknown"}`,
        `MediaPipe tuning requested ${this.#poseSelection.requestedMediaPipeTuningId} selected ${tuningState}`,
        `selection ${this.#poseSelection.warning ?? "accepted"}`,
        `gameplay source requested ${this.#poseGameplaySelection.requestedId} selected ${this.#poseGameplaySelection.selectedId} effective ${this.#poseGameplaySelection.effectiveId} fallback ${this.#poseGameplaySelection.warning ?? "none"}`,
        `gameplay provenance ${this.#latestGameplayPoseSample?.provenance ?? "none"} measurement ${this.#formatCvMs(this.#latestGameplayPoseSample?.measurementTimestampMs)} target ${this.#formatCvMs(this.#latestGameplayPoseSample?.targetTimestampMs)} horizon ${this.#formatCvMs(this.#latestGameplayPoseSample?.predictionHorizonMs)}`,
        `gameplay lifecycle ${routingStatus.lifecycleEpoch} resets ${routingStatus.lifecycleResetCount} duplicate measurement ${routingStatus.duplicateMeasurementSuppressionCount} superseded measurement ${routingStatus.supersededMeasurementUpdateCount} duplicate target ${routingStatus.duplicateTargetSuppressionCount} stale callback ${routingStatus.staleLifecycleSuppressionCount} frozen ${routingStatus.frozenPredictionCount}`,
        `gameplay routed measured ${this.#poseGameplaySelection.effectiveId === "predicted-8" ? routingStatus.measuredRoutedSampleCount : this.#legacyMeasuredSampleCount} predicted ${routingStatus.predictedRoutedSampleCount} deduplicated events ${routingStatus.input.suppressedRepeatedEventCount}`,
        `gameplay event intents measured ${JSON.stringify(routingStatus.measuredEventCountByIntent)} predicted ${JSON.stringify(routingStatus.predictedEventCountByIntent)}`,
        `predictor epoch ${routingStatus.predictor.routeEpoch} generation ${routingStatus.predictor.routeGeneration} resets ${routingStatus.predictor.resetCount} history ${routingStatus.predictor.insufficientHistorySuppressionCount} invalid horizon ${routingStatus.predictor.invalidHorizonSuppressionCount} visibility ${routingStatus.predictor.lowVisibilitySuppressionCount} stale ${routingStatus.predictor.staleSuppressionCount}`,
        `preset ${status.performancePresetLabel} (${status.performancePresetSummary})`,
        `execution ${status.adapterExecutionLocation} ${status.adapterExecutionDetail} fallback ${status.adapterExecutionFallback}`,
        `load ${this.#formatCvMs(status.adapterLoadDurationMs)} estimate ${this.#formatCvMs(status.adapterEstimateDurationMs)} runtime ${this.#formatCvMs(status.adapterRuntimeInferenceDurationMs)} postprocess ${this.#formatCvMs(status.adapterPostprocessDurationMs)} worker roundtrip ${this.#formatCvMs(status.adapterTelemetry.workerRoundTripDurationMs)}`,
        `resize ${status.resizePath} transfer ${status.adapterTransferFrameType ?? "n/a"}`,
        `model ${status.modelStatus ?? "idle"}`,
        `source ${source}`,
        `input ${status.inferenceInputWidth ?? "full"}x${status.inferenceInputHeight ?? "full"}`,
        `camera ${this.#activeSurface?.intrinsicWidth ?? 0}x${this.#activeSurface?.intrinsicHeight ?? 0}`,
        `video fps ${this.#formatFps(this.#mediaFrameRateFps)}`,
        `sampling ${status.samplingMode}`,
        `sample target ${this.#formatFps(status.submissionCadenceTargetFps)} effective ${this.#formatFps(status.effectiveSubmissionRateFps)}`,
        `pose output ${this.#formatFps(status.effectivePoseOutputRateFps)}`,
        `status updates ${this.#formatFps(statusCadence?.effectiveRateFps)} target ${this.#formatFps(statusCadence?.targetRateFps)}`,
        `overlay renders ${this.#formatFps(overlayCadence?.effectiveRateFps)} target ${this.#formatFps(overlayCadence?.targetRateFps)}`,
        `prep ${this.#formatCvMs(status.framePrepMs)} avg ${this.#formatCvMs(status.averageFramePrepMs)}`,
        `adapter ${this.#formatCvMs(status.adapterInferenceMs)} avg ${this.#formatCvMs(status.averageAdapterInferenceMs)}`,
        `total ${this.#formatCvMs(status.totalCvMs)} avg ${this.#formatCvMs(status.averageTotalCvMs)}`,
        `timing window ${status.timingWindowSampleCount}/${status.timingWindowCapacity} budget ${this.#formatCvMs(status.timingBudgetMs)} over ${status.timingWindowOverBudgetCount}`,
        `prep p50 ${this.#formatCvMs(status.rollingFramePrepP50Ms)} p95 ${this.#formatCvMs(status.rollingFramePrepP95Ms)} max ${this.#formatCvMs(status.rollingFramePrepMaxMs)}`,
        `adapter p50 ${this.#formatCvMs(status.rollingAdapterInferenceP50Ms)} p95 ${this.#formatCvMs(status.rollingAdapterInferenceP95Ms)} max ${this.#formatCvMs(status.rollingAdapterInferenceMaxMs)}`,
        `runtime p50 ${this.#formatCvMs(status.rollingRuntimeInferenceP50Ms)} p95 ${this.#formatCvMs(status.rollingRuntimeInferenceP95Ms)} max ${this.#formatCvMs(status.rollingRuntimeInferenceMaxMs)}`,
        `worker roundtrip p50 ${this.#formatCvMs(status.rollingWorkerRoundTripP50Ms)} p95 ${this.#formatCvMs(status.rollingWorkerRoundTripP95Ms)} max ${this.#formatCvMs(status.rollingWorkerRoundTripMaxMs)}`,
        `total p50 ${this.#formatCvMs(status.rollingTotalCvP50Ms)} p95 ${this.#formatCvMs(status.rollingTotalCvP95Ms)} max ${this.#formatCvMs(status.rollingTotalCvMaxMs)}`,
        `incomplete seven-point frames ${status.timingWindowIncompletePoseCount}`,
        `inference frames ${status.inferenceCount}`,
        `pose frames ${status.poseFrameCount}`,
        `dropped frames ${status.droppedFrameCount}`,
        `worker capture replacements ${status.workerCaptureReplacementCount} retired transferables ${status.retiredTransferableFrameCount}`,
        `sampling callback gap p50 ${this.#formatCvMs(status.samplingCallbackGapP50Ms)} p95 ${this.#formatCvMs(status.samplingCallbackGapP95Ms)} max ${this.#formatCvMs(status.samplingCallbackGapMaxMs)} window ${status.samplingCallbackGapWindowSampleCount}`,
        `submitted age ${this.#formatCvMs(status.lastSubmittedFrameAgeMs)}`,
        `output age ${this.#formatCvMs(status.latestOutputAgeMs)}`,
        `render age ${this.#formatCvMs(overlayCadence?.latestTickAgeMs)}`,
        `status age ${this.#formatCvMs(statusCadence?.latestTickAgeMs)}`,
        `rendered pose frames ${this.#renderedPoseFrameCount}`,
        `overlay landmarks ${overlayLandmarkCount}`,
        `tracking ${previewState?.trackingProfile ?? this.#trackingProfile}`,
        `media-pose delta ${mediaPoseDelta}`,
        `presentation-target delta ${presentationTargetDelta}`
      ].join(" / ") + error);
  }

  /**
   * @param {import("@aerobeat/web-contracts/pose-adapter").AeroPoseModelIdentity | undefined} model
   * @returns {string}
   */
  #formatPoseModel(model) {
    if (!model) {
      return "unknown";
    }
    const version = model.modelVersion ? `@${model.modelVersion}` : "";
    const runtime = model.runtimeId ? ` via ${model.runtimeId}${model.runtimeVersion ? `@${model.runtimeVersion}` : ""}` : "";
    return `${model.vendorId}/${model.modelId}${version}${runtime}`;
  }

  /**
   * @returns {string}
   */
  #deviceMemoryLabel() {
    const deviceMemory = /** @type {Navigator & { deviceMemory?: number }} */ (navigator).deviceMemory;
    return typeof deviceMemory === "number" && Number.isFinite(deviceMemory)
      ? `${deviceMemory} GiB`
      : "unavailable";
  }

  /**
   * @param {number | undefined} value
   * @returns {string}
   */
  #formatCvMs(value) {
    return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}ms` : "n/a";
  }

  /**
   * @param {number | undefined} value
   * @returns {string}
   */
  #formatFps(value) {
    return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}fps` : "n/a";
  }

  /**
   * @param {number | undefined} value
   * @returns {string}
   */
  #formatRatio(value) {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "n/a";
  }

  /**
   * @param {HTMLVideoElement} video
   * @returns {void}
   */
  #updateMediaFrameRate(video) {
    const quality = typeof video.getVideoPlaybackQuality === "function" ? video.getVideoPlaybackQuality() : undefined;
    const frameCount = quality?.totalVideoFrames;
    if (typeof frameCount !== "number") {
      return;
    }
    const currentTimeMs = performance.now();
    if (this.#lastMeasuredVideoFrameCount === undefined || this.#lastMeasuredVideoFrameTimeMs === undefined) {
      this.#lastMeasuredVideoFrameCount = frameCount;
      this.#lastMeasuredVideoFrameTimeMs = currentTimeMs;
      return;
    }
    const elapsedMs = currentTimeMs - this.#lastMeasuredVideoFrameTimeMs;
    if (elapsedMs < 500) {
      return;
    }
    this.#mediaFrameRateFps = ((frameCount - this.#lastMeasuredVideoFrameCount) * 1000) / elapsedMs;
    this.#lastMeasuredVideoFrameCount = frameCount;
    this.#lastMeasuredVideoFrameTimeMs = currentTimeMs;
  }

  /**
   * @param {AeroVideoSurfaceDescriptor | undefined} surface
   * @param {AeroCvServiceStatus} [status]
   * @returns {void}
   */
  #updateMediaStatus(surface, status = this.#cvService.getStatus()) {
    const effectiveRoute = `${status.effectiveBackendId}/${status.adapterExecutionProvider ?? "unknown"}`;
    const poseSource = status.fallbackActive
      ? `fallback ${status.fallbackSourceId ?? "unknown"}`
      : `${status.sourceKind ?? "none"} ${status.sourceId ?? "none"}`;
    const poseStatus = status.fallbackActive
      ? `pose selected ${this.#poseSelection.selectedBackendId}/${this.#poseSelection.selectedProviderId} effective ${effectiveRoute} source ${poseSource} fallback true`
      : `pose ${effectiveRoute} source ${poseSource} fallback false`;
    this.shadowRoot
      ?.querySelector(".media-state")
      ?.setAttribute("status", [
        `Source ${surface?.sourceKind ?? "none"} ${surface?.sourceId ?? "none"}`,
        `playback ${surface?.playbackState ?? "idle"}`,
        `size ${surface?.intrinsicWidth ?? 0}x${surface?.intrinsicHeight ?? 0}`,
        `video fps ${this.#formatFps(this.#mediaFrameRateFps)}`,
        poseStatus,
        `CV preset ${this.#cvPerformancePreset().label}`
      ].join(" / "));
  }

  /**
   * Reports selected and effective pose routes without calling replay fallback live inference.
   *
   * @param {AeroCvServiceStatus} status
   * @returns {void}
   */
  #updateCameraRuntimeStatus(status) {
    const effectiveRoute = `${status.effectiveBackendId}/${status.adapterExecutionProvider ?? "unknown"}`;
    const poseSource = status.fallbackActive
      ? `fallback ${status.fallbackSourceId ?? "unknown"}`
      : `${status.sourceKind ?? "none"} ${status.sourceId ?? "none"}`;
    if (status.fallbackActive) {
      this.#setCameraPermissionStatus([
        "Camera permission: granted",
        `selected ${this.#poseSelection.selectedBackendId}/${this.#poseSelection.selectedProviderId}`,
        `effective fallback ${effectiveRoute}`,
        `pose source ${poseSource}`,
        `CV preset ${this.#cvPerformancePreset().label}`
      ].join(" / "));
      return;
    }
    this.#setCameraPermissionStatus([
      "Camera permission: granted",
      `live inference ${effectiveRoute}`,
      `source ${poseSource}`,
      `selected ${this.#poseSelection.selectedBackendId}/${this.#poseSelection.selectedProviderId}`,
      `CV preset ${this.#cvPerformancePreset().label}`
    ].join(" / "));
  }

  /**
   * @returns {void}
   */
  #configurePreviewServices() {
    const preview = this.#getPosePreview();
    preview.setVideoMediaFacade(this.#videoMediaFacade);
    preview.setRenderer(this.#renderer);
    preview.setTrackingProfile(this.#trackingProfile);
  }

  /**
   * @returns {MediaStreamConstraints}
   */
  #liveCameraConstraints() {
    const preset = this.#cvPerformancePreset();
    /** @type {MediaTrackConstraints} */
    const videoConstraints = {};
    if (preset.cameraWidth && preset.cameraHeight) {
      videoConstraints.width = { ideal: preset.cameraWidth };
      videoConstraints.height = { ideal: preset.cameraHeight };
    }
    videoConstraints.facingMode = "user";
    return {
      audio: false,
      video: videoConstraints
    };
  }

  /**
   * @returns {AeroCameraCvService}
   */
  #createCvService() {
    const preset = this.#cvPerformancePreset();
    const composition = createPoseBackendComposition(this.#poseSelection, preset);
    return createAeroCameraCvService({
      poseAdapter: composition.poseAdapter,
      fallbackPoseAdapter: composition.fallbackPoseAdapter,
      requestedBackendId: this.#poseSelection.requestedBackendId,
      selectedBackendId: this.#poseSelection.selectedBackendId,
      performancePreset: preset,
      submissionCadenceTargetFps: measuredSubmissionCadenceFps(this.#poseGameplaySelection.effectiveId),
      useFallbackOnError: true
    });
  }

  /**
   * @returns {import("@aerobeat/web-cv").AeroCvPerformancePreset}
   */
  #cvPerformancePreset() {
    return getAeroCvPerformancePreset(this.#cvPerformancePresetId);
  }

  /**
   * @returns {string}
   */
  #poseSourceId() {
    return getPoseSourceId(this.#poseSelection.selectedBackendId);
  }

  /**
   * Resets an incompatible experimental route to the truthful measured default.
   *
   * @param {boolean} rewriteRoute
   * @returns {void}
   */
  #normalizePoseGameplaySelection(rewriteRoute) {
    const resolved = resolvePoseGameplaySource({
      search: window.location.search,
      backendId: this.#poseSelection.selectedBackendId,
      performancePresetId: this.#cvPerformancePresetId
    });
    this.#poseGameplaySelection = resolved;
    if (resolved.selectedId === "measured" && resolved.requestedId !== "measured" && rewriteRoute) {
      const search = updatePoseGameplaySourceSearch(window.location.search, "measured");
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
      this.#poseGameplaySelection = resolvePoseGameplaySource({
        search,
        backendId: this.#poseSelection.selectedBackendId,
        performancePresetId: this.#cvPerformancePresetId
      });
    }
    this.#resetGameplayRouting("selection");
  }

  /**
   * @param {string} reason
   * @returns {void}
   */
  #resetGameplayRouting(reason) {
    this.#predictiveRouting.reset(reason);
    this.#inputRouter = createPoseInputRouter();
    this.#latestGameplayPoseSample = undefined;
    this.#lastRoutedPoseFrameKey = "";
    this.#latestInputEvents = [];
    this.#legacyMeasuredSampleCount = 0;
    this.#legacyMeasuredEventCount = 0;
    this.#legacyEventCountByIntent = {};
    this.#gameplayRoutingStartedAtMs = undefined;
    const preview = this.shadowRoot?.querySelector("aero-media-pose-preview");
    if (preview && "setPoseRoutingSample" in preview) {
      preview.setPoseRoutingSample(undefined, { render: false });
    }
  }

  /**
   * @returns {import("@aerobeat/web-ui").AeroMediaPosePreview}
   */
  #getPosePreview() {
    const preview = this.shadowRoot?.querySelector("aero-media-pose-preview");
    if (!preview || !("attachCameraStream" in preview) || !("setRenderer" in preview)) {
      throw new Error("Aero media pose preview was not rendered.");
    }
    return preview;
  }

  /**
   * @returns {HTMLVideoElement}
   */
  #getPreviewVideo() {
    const video = this.#getPosePreview().shadowRoot?.querySelector("video");
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Aero media pose preview video element was not rendered.");
    }
    return video;
  }

  /**
   * @param {unknown} error
   * @returns {string}
   */
  #errorName(error) {
    return error instanceof DOMException || error instanceof Error ? error.name : "VideoPlaybackError";
  }

  /**
   * Drives the first replay-based integration checkpoint through public package APIs.
   *
   * @returns {Promise<void>}
   */
  async #runRuntimeCheckpoint() {
    const panel = this.shadowRoot?.querySelector("aero-pose-flow-panel");
    if (!panel || !("setProvingState" in panel)) {
      return;
    }

    const poseFrame = await createReplayPoseFrame();
    const inputEvents = this.#createInputEventViews(poseFrame);

    this.#setPoseFlowPanelState(panel, poseFrame, inputEvents);
    this.#getPosePreview().setPoseFrame(poseFrame);
  }

  /**
   * @param {import("@aerobeat/web-contracts").NormalizedPoseFrame | import("@aerobeat/web-contracts").AeroPoseRoutingSample} pose
   * @param {ReturnType<typeof createPoseInputRouter>} [router]
   * @returns {readonly PoseFlowDraftEventView[]}
   */
  #createInputEventViews(pose, router = this.#inputRouter) {
    if ("schema" in pose && pose.schema === "aerobeat/pose_routing_sample") {
      return this.#inputEventViews(router.routePoseSampleBatch(pose));
    }
    router.setMode("boxing");
    const boxingEvents = router.routePoseFrame(pose);
    router.setMode("flow");
    const flowEvents = router.routePoseFrame(pose);
    return this.#inputEventViews([...boxingEvents, ...flowEvents]);
  }

  /**
   * @param {readonly import("@aerobeat/web-input").PoseInputDraftEvent[]} events
   * @returns {readonly PoseFlowDraftEventView[]}
   */
  #inputEventViews(events) {
    return events.map((event) => ({
      mode: event.mode,
      eventName: event.eventName,
      summary: event.detail.kind ?? event.detail.name,
      provenance: event.detail.provenance ?? "measured",
      measurementTimestampMs: event.detail.measurementTimestampMs ?? event.detail.timestampMs,
      predictionHorizonMs: event.detail.predictionHorizonMs ?? 0
    }));
  }

  /**
   * @param {Element | null | undefined} panel
   * @param {import("@aerobeat/web-contracts").NormalizedPoseFrame} poseFrame
   * @param {readonly PoseFlowDraftEventView[]} inputEvents
   * @returns {void}
   */
  #setPoseFlowPanelState(panel, poseFrame, inputEvents) {
    if (!panel || !("setProvingState" in panel)) {
      return;
    }

    panel.setProvingState({
      poseFrame,
      inputEvents
    });
  }
}

if (!customElements.get(elementNames.app)) {
  customElements.define(elementNames.app, AeroBeatApp);
}

/**
 * Public assembly metadata for smoke tests and integration probes.
 *
 * @type {typeof appMetadata}
 */
export const aerobeatAssemblyMetadata = appMetadata;
