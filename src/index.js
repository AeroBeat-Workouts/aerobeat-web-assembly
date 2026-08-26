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
import { createPoseInputRouter } from "@aerobeat/web-input";
import { createAeroWebGl2Renderer } from "@aerobeat/web-renderer";
import {
  aeroButtonActivateEventName,
  aeroCalibrationEventNames,
  aeroSelectChangeEventName,
  defineAeroUiElements
} from "@aerobeat/web-ui";
import { createBrowserVideoMediaFacade, createLiveCameraSourceDescriptor } from "@aerobeat/web-video";
import {
  createMoveNetMockPoseAdapter,
  createMoveNetPoseAdapter,
  createMoveNetWorkerPoseAdapter,
  moveNetLiveSourceId
} from "@aerobeat/web-vendor-movenet";
import { appMetadata } from "./release-metadata.js";

defineAeroUiElements();

/**
 * @typedef {Object} PoseFlowDraftEventView
 * @property {string} mode Gameplay mode.
 * @property {string} eventName Browser event name.
 * @property {string} summary Short event summary.
 */

/**
 * @typedef {import("@aerobeat/web-cv").AeroCameraCvService} AeroCameraCvService
 * @typedef {import("@aerobeat/web-cv").AeroCvServiceStatus} AeroCvServiceStatus
 * @typedef {import("@aerobeat/web-video").BrowserVideoMediaFacade} BrowserVideoMediaFacade
 * @typedef {import("@aerobeat/web-video").AeroVideoSurfaceDescriptor} AeroVideoSurfaceDescriptor
 * @typedef {import("@aerobeat/web-renderer").AeroWebGl2Renderer} AeroWebGl2Renderer
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

  /** @type {AeroCameraCvService} */
  #cvService = this.#createCvService();

  /** @type {ReturnType<typeof createPoseInputRouter>} */
  #inputRouter = createPoseInputRouter();

  /** @type {AeroWebGl2Renderer} */
  #renderer = createAeroWebGl2Renderer();

  /** @type {number | undefined} */
  #runtimeAnimationFrame;

  /** @type {number} */
  #renderedPoseFrameCount = 0;

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

  /** @type {string} */
  #selectedCameraDeviceId = "";

  /** @type {"smoother" | "fast"} */
  #trackingProfile = "fast";

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
          gap: 18px;
          grid-template-rows: auto 1fr auto;
          min-height: 100vh;
          padding: clamp(16px, 4vw, 40px);
        }

        .topbar,
        .metadata {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          justify-content: space-between;
        }

        .brand {
          display: grid;
          gap: 2px;
        }

        .title {
          font-size: clamp(1.6rem, 4vw, 2.8rem);
          font-weight: 800;
          line-height: 1;
        }

        .subtitle,
        .metadata {
          font-size: 0.86rem;
          font-weight: 650;
        }

        .topbar-actions {
          align-items: flex-end;
          display: grid;
          gap: 10px;
          justify-items: end;
        }

        .test-controls {
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(132px, 180px) minmax(128px, 168px) minmax(142px, 190px);
          inline-size: min(100%, 548px);
        }

        .stage {
          align-items: stretch;
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
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
          display: grid;
          gap: 12px;
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
          .topbar {
            align-items: start;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .topbar-actions {
            max-inline-size: min(48vw, 220px);
          }

          .test-controls {
            grid-template-columns: 1fr;
          }

          .stage {
            grid-template-columns: 1fr;
          }

          .hero {
            min-height: auto;
          }
        }
      </style>
      <main class="shell">
        <header class="topbar">
          <div class="brand">
            <span class="title">AeroBeat</span>
            <span class="subtitle">Browser assembly runtime</span>
          </div>
          <div class="topbar-actions">
            <div class="test-controls" aria-label="Phone test controls">
              <aero-select class="camera-device-select" label="Camera" value=""></aero-select>
              <aero-select class="tracking-speed-select" label="Tracking" value="${this.#trackingProfile}"></aero-select>
              <aero-select class="cv-performance-select" label="CV performance" value="${this.#cvPerformancePresetId}"></aero-select>
            </div>
            <aero-button class="calibration-entrypoint" label="Begin calibration"></aero-button>
            <aero-status-panel heading="Build" status="Version ${appMetadata.displayVersion} / Built ${appMetadata.buildStamp} / Cache ${appMetadata.cacheBust}"></aero-status-panel>
          </div>
        </header>
        <section class="stage" aria-label="AeroBeat app shell">
          <div class="hero">
            <aero-media-pose-preview source-kind="live-camera" source-id="${moveNetLiveSourceId}" fit-mode="cover" mirrored="true"></aero-media-pose-preview>
          </div>
          <div class="runtime">
            <aero-status-panel heading="Services" status="${this.#serviceSummary()}"></aero-status-panel>
            <aero-status-panel class="inference-state" heading="Inference" status="CV idle / preset ${this.#cvPerformancePreset().label} (${this.#cvPerformancePreset().summary}) / execution main-thread direct adapter / resize none / model idle / source none / inference frames 0 / pose frames 0"></aero-status-panel>
            <aero-status-panel class="media-state" heading="Media" status="Source none / playback idle"></aero-status-panel>
            <aero-pose-flow-panel></aero-pose-flow-panel>
            <p class="checkpoint-note">Runtime checkpoint starts with replay CV frames for secure loading checks; calibration switches the visible source to retained live MoveNet inference when camera and model setup succeed.</p>
            <aero-status-panel class="calibration-state" heading="Calibration" status="Idle - press Begin calibration"></aero-status-panel>
            <aero-status-panel class="camera-permission-state" heading="Camera" status="Permission idle"></aero-status-panel>
            <div class="telemetry-capture">
              <div class="telemetry-actions" aria-label="Telemetry capture controls">
                <aero-button class="telemetry-copy" label="Copy telemetry"></aero-button>
                <aero-button class="telemetry-download" label="Download telemetry"></aero-button>
              </div>
              <aero-status-panel class="telemetry-capture-state" heading="Telemetry" status="Capture ready"></aero-status-panel>
              <pre class="telemetry-output" tabindex="0" aria-label="Captured telemetry snapshot">Captured telemetry snapshot will appear here for selection and sharing.</pre>
            </div>
            <aero-calibration-screen></aero-calibration-screen>
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
    root.addEventListener(aeroSelectChangeEventName, (event) => {
      this.#handlePhoneControlChange(event);
    });
    window.requestAnimationFrame(() => {
      this.#configurePhoneTestControls();
      this.#configurePreviewServices();
      this.#runRuntimeCheckpoint();
    });
  }

  /**
   * Releases live camera tracks when the app leaves the page.
   */
  disconnectedCallback() {
    this.#stopLiveInferenceRoute();
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
   * Updates route-owned phone test controls.
   *
   * @param {Event} event
   * @returns {void}
   */
  #handlePhoneControlChange(event) {
    if (!(event instanceof CustomEvent)) {
      return;
    }
    const path = event.composedPath();
    if (path.includes(this.shadowRoot?.querySelector(".tracking-speed-select") ?? this)) {
      this.#trackingProfile = event.detail?.value === "fast" ? "fast" : "smoother";
      this.#getPosePreview().setTrackingProfile(this.#trackingProfile);
      this.#updateInferenceStatus();
      return;
    }
    if (path.includes(this.shadowRoot?.querySelector(".cv-performance-select") ?? this)) {
      this.#cvPerformancePresetId = this.#normalizeCvPresetId(event.detail?.value);
      this.#replaceCvServiceForPresetChange();
      this.#updateInferenceStatus();
      this.#restartLiveCameraIfRunning();
      return;
    }
    if (path.includes(this.shadowRoot?.querySelector(".camera-device-select") ?? this)) {
      this.#selectedCameraDeviceId = typeof event.detail?.value === "string" ? event.detail.value : "";
      this.#restartLiveCameraIfRunning();
    }
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
    this.#setCameraPermissionStatus(`Camera permission: requesting / CV preset ${this.#cvPerformancePreset().label}`);
    this.#cameraPermissionRequest = this.#requestLiveCameraPermission();
  }

  /**
   * @returns {Promise<void>}
   */
  async #requestLiveCameraPermission() {
    const source = createLiveCameraSourceDescriptor({
      sourceId: moveNetLiveSourceId,
      constraints: this.#liveCameraConstraints(),
      fitMode: "cover",
      mirrored: true
    });
    const result = await this.#videoMediaFacade.requestCamera(source);
    if (result.status === "granted") {
      await this.#refreshCameraDeviceOptions();
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
    const blob = new Blob([snapshot], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aerobeat-telemetry-${new Date().toISOString().replace(/[:.]/gu, "-")}.txt`;
    anchor.rel = "noopener";
    this.shadowRoot?.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    this.#setTelemetryCaptureStatus("Downloaded telemetry snapshot");
  }

  /**
   * Builds a selectable diagnostic snapshot from the same strings rendered in the app.
   *
   * @returns {string}
   */
  #captureTelemetrySnapshotText() {
    const cvStatus = this.#cvService.getStatus();
    const previewState = this.#getPosePreview().describePreview();
    const snapshot = [
      "AeroBeat telemetry snapshot",
      `Timestamp: ${new Date().toISOString()}`,
      `Route URL: ${window.location.href}`,
      `Secure context: ${this.#secureContextLabel()}`,
      `App version: ${appMetadata.displayVersion}`,
      `Build stamp: ${appMetadata.buildStamp}`,
      `Cache token: ${appMetadata.cacheBust}`,
      `Selected camera: ${this.#selectedCameraLabel()}`,
      `Selected tracking profile: ${this.#trackingProfile}`,
      `Selected CV preset: ${this.#cvPerformancePreset().label}`,
      `Execution location: ${cvStatus.adapterExecution}`,
      `Execution detail: ${cvStatus.adapterExecutionDetail}`,
      `Resize path: ${cvStatus.resizePath}`,
      `Inference input: ${cvStatus.inferenceInputWidth ?? "full"}x${cvStatus.inferenceInputHeight ?? "full"}`,
      `Prep cost: ${this.#formatCvMs(cvStatus.framePrepMs)} (avg ${this.#formatCvMs(cvStatus.averageFramePrepMs)})`,
      `Adapter cost: ${this.#formatCvMs(cvStatus.adapterInferenceMs)} (avg ${this.#formatCvMs(cvStatus.averageAdapterInferenceMs)})`,
      `Total CV cost: ${this.#formatCvMs(cvStatus.totalCvMs)} (avg ${this.#formatCvMs(cvStatus.averageTotalCvMs)})`,
      `Output age: ${this.#formatCvMs(cvStatus.latestOutputAgeMs)}`,
      `Media-pose delta: ${this.#formatCvMs(previewState.mediaPoseDeltaMs)}`,
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
    const select = this.shadowRoot
      ?.querySelector(".camera-device-select")
      ?.shadowRoot
      ?.querySelector("select");
    if (!(select instanceof HTMLSelectElement)) {
      return this.#selectedCameraDeviceId || "Default camera";
    }
    const label = select.selectedOptions[0]?.textContent?.trim();
    return label ? `${label} (${select.value || "default"})` : (select.value || "Default camera");
  }

  /**
   * Stops live media and CV services during page teardown.
   *
   * @returns {void}
   */
  #stopLiveInferenceRoute() {
    if (this.#runtimeAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.#runtimeAnimationFrame);
      this.#runtimeAnimationFrame = undefined;
    }
    this.#videoMediaFacade.teardownCameraStream();
    this.#cvService.stop();
    this.#cameraPermissionRequest = undefined;
    this.#mediaFrameRateFps = undefined;
    this.#lastMeasuredVideoFrameCount = undefined;
    this.#lastMeasuredVideoFrameTimeMs = undefined;
  }

  /**
   * Restarts the live camera path after a device selector change.
   *
   * @returns {void}
   */
  #restartLiveCameraIfRunning() {
    if (!this.#videoMediaFacade.getRetainedCameraStream() && !this.#cvService.running) {
      return;
    }
    this.#setCameraPermissionStatus("Camera permission: restarting selected input...");
    this.#stopLiveInferenceRoute();
    this.#cameraPermissionRequest = this.#requestLiveCameraPermission();
  }

  /**
   * Attaches the granted stream to the visible preview and starts CV inference.
   *
   * @param {MediaStream | undefined} stream
   * @param {ReturnType<typeof createLiveCameraSourceDescriptor>} source
   * @returns {Promise<void>}
   */
  async #startLiveInferenceRoute(stream, source) {
    this.#configurePreviewServices();
    const preview = this.#getPosePreview();
    preview.setTrackingProfile(this.#trackingProfile);
    this.#activeSurface = preview.attachCameraStream(stream, source);
    this.#updateMediaStatus(this.#activeSurface);
    this.#updateInferenceStatus();
    this.#setCameraPermissionStatus(`Camera permission: granted / loading model / source live-camera / CV preset ${this.#cvPerformancePreset().label}`);

    try {
      const video = this.#getPreviewVideo();
      this.#activeSurface = await this.#videoMediaFacade.play(video);
      preview.setSurfaceDescriptor(this.#activeSurface);
      this.#updateMediaStatus(this.#activeSurface);
      const cvSource = createAeroCvFrameSourceFromVideoSurface(video, this.#activeSurface);
      cvSource.sourceId = moveNetLiveSourceId;
      cvSource.getFrameSource = () => video;
      cvSource.getTimestampMs = () => video.currentTime * 1000;
      cvSource.isFrameAvailable = () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      await this.#cvService.start(cvSource);
      this.#setCameraPermissionStatus(`Camera permission: granted / live inference running / source live-camera / CV preset ${this.#cvPerformancePreset().label}`);
      this.#updateInferenceStatus();
      this.#pumpLiveInferenceRoute();
    } catch (error) {
      this.#setCameraPermissionStatus(`Camera permission: granted / inference error (${this.#errorName(error)}) / CV preset ${this.#cvPerformancePreset().label}`);
      this.#updateInferenceStatus();
    }
  }

  /**
   * @returns {void}
   */
  #pumpLiveInferenceRoute() {
    const status = this.#cvService.getStatus();
    const preview = this.#getPosePreview();
    const video = this.#getPreviewVideo();
    this.#activeSurface = this.#videoMediaFacade.describeSurface(video);
    this.#updateMediaFrameRate(video);
    preview.setSurfaceDescriptor(this.#activeSurface);
    this.#updateMediaStatus(this.#activeSurface);
    this.#updateInferenceStatus(status);

    const poseFrame = this.#cvService.getLatestPoseFrame();
    if (poseFrame) {
      this.#renderedPoseFrameCount += 1;
      const inputEvents = this.#createInputEventViews(poseFrame);
      preview.setPoseFrame(poseFrame);
      this.#lastOverlayLandmarkCount = preview.describePreview().landmarkCount;
      this.#setPoseFlowPanelState(this.shadowRoot?.querySelector("aero-pose-flow-panel"), poseFrame, inputEvents);
      const calibrationScreen = this.shadowRoot?.querySelector("aero-calibration-screen");
      this.#setPoseFlowPanelState(
        calibrationScreen?.shadowRoot?.querySelector("aero-pose-flow-panel"),
        poseFrame,
        inputEvents
      );
      this.#updateInferenceStatus(this.#cvService.getStatus());
    }

    if (this.#cvService.running) {
      this.#runtimeAnimationFrame = window.requestAnimationFrame(() => this.#pumpLiveInferenceRoute());
    }
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
    const error = status.lastError ? ` / error ${status.lastError}` : "";
    this.shadowRoot
      ?.querySelector(".inference-state")
      ?.setAttribute("status", [
        `CV ${status.lifecycleState}`,
        `preset ${status.performancePresetLabel} (${status.performancePresetSummary})`,
        `execution ${status.adapterExecution} ${status.adapterExecutionDetail}`,
        `resize ${status.resizePath}`,
        `model ${status.modelStatus ?? "idle"}`,
        `source ${source}`,
        `input ${status.inferenceInputWidth ?? "full"}x${status.inferenceInputHeight ?? "full"}`,
        `camera ${this.#activeSurface?.intrinsicWidth ?? 0}x${this.#activeSurface?.intrinsicHeight ?? 0}`,
        `video fps ${this.#formatFps(this.#mediaFrameRateFps)}`,
        `prep ${this.#formatCvMs(status.framePrepMs)} avg ${this.#formatCvMs(status.averageFramePrepMs)}`,
        `adapter ${this.#formatCvMs(status.adapterInferenceMs)} avg ${this.#formatCvMs(status.averageAdapterInferenceMs)}`,
        `total ${this.#formatCvMs(status.totalCvMs)} avg ${this.#formatCvMs(status.averageTotalCvMs)}`,
        `inference frames ${status.inferenceCount}`,
        `pose frames ${status.poseFrameCount}`,
        `dropped frames ${status.droppedFrameCount}`,
        `submitted age ${this.#formatCvMs(status.lastSubmittedFrameAgeMs)}`,
        `output age ${this.#formatCvMs(status.latestOutputAgeMs)}`,
        `rendered pose frames ${this.#renderedPoseFrameCount}`,
        `overlay landmarks ${overlayLandmarkCount}`,
        `tracking ${previewState?.trackingProfile ?? this.#trackingProfile}`,
        `media-pose delta ${mediaPoseDelta}`
      ].join(" / ") + error);
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
   * @returns {void}
   */
  #updateMediaStatus(surface) {
    this.shadowRoot
      ?.querySelector(".media-state")
      ?.setAttribute("status", [
        `Source ${surface?.sourceKind ?? "none"} ${surface?.sourceId ?? "none"}`,
        `playback ${surface?.playbackState ?? "idle"}`,
        `size ${surface?.intrinsicWidth ?? 0}x${surface?.intrinsicHeight ?? 0}`,
        `video fps ${this.#formatFps(this.#mediaFrameRateFps)}`,
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
   * Initializes and refreshes the phone testing control widgets.
   *
   * @returns {void}
   */
  #configurePhoneTestControls() {
    const speedSelect = this.shadowRoot?.querySelector(".tracking-speed-select");
    if (speedSelect && "setOptions" in speedSelect) {
      speedSelect.setOptions([
        { value: "smoother", label: "Smoother" },
        { value: "fast", label: "Fast" }
      ]);
      speedSelect.setAttribute("value", this.#trackingProfile);
    }
    const performanceSelect = this.shadowRoot?.querySelector(".cv-performance-select");
    if (performanceSelect && "setOptions" in performanceSelect) {
      performanceSelect.setOptions([
        { value: "full", label: `${aeroCvPerformancePresets.full.label} - ${aeroCvPerformancePresets.full.summary}` },
        { value: "direct-256", label: `${aeroCvPerformancePresets["direct-256"].label} - ${aeroCvPerformancePresets["direct-256"].summary}` },
        { value: "direct-192", label: `${aeroCvPerformancePresets["direct-192"].label} - ${aeroCvPerformancePresets["direct-192"].summary}` },
        { value: "direct-160", label: `${aeroCvPerformancePresets["direct-160"].label} - ${aeroCvPerformancePresets["direct-160"].summary}` },
        { value: "balanced", label: `${aeroCvPerformancePresets.balanced.label} - ${aeroCvPerformancePresets.balanced.summary}` },
        { value: "fast", label: `${aeroCvPerformancePresets.fast.label} - ${aeroCvPerformancePresets.fast.summary}` },
        { value: "rescue", label: `${aeroCvPerformancePresets.rescue.label} - ${aeroCvPerformancePresets.rescue.summary}` }
      ]);
      performanceSelect.setAttribute("value", this.#cvPerformancePresetId);
    }
    this.#refreshCameraDeviceOptions();
  }

  /**
   * Refreshes available camera input choices when the browser permits labels.
   *
   * @returns {Promise<void>}
   */
  async #refreshCameraDeviceOptions() {
    const cameraSelect = this.shadowRoot?.querySelector(".camera-device-select");
    if (!cameraSelect || !("setOptions" in cameraSelect)) {
      return;
    }
    const cameraDevices = await this.#videoMediaFacade.listCameraDevices();
    cameraSelect.setOptions([
      { value: "", label: "Default camera" },
      ...cameraDevices.map((device) => ({
        value: device.deviceId,
        label: device.label
      }))
    ]);
    cameraSelect.setAttribute("value", this.#selectedCameraDeviceId);
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
    if (this.#selectedCameraDeviceId) {
      videoConstraints.deviceId = {
        exact: this.#selectedCameraDeviceId
      };
      return {
        audio: false,
        video: videoConstraints
      };
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
    const adapterOptions = { sourceId: moveNetLiveSourceId, mirrored: true };
    return createAeroCameraCvService({
      poseAdapter: preset.executionPolicy === "worker-experimental"
        ? createMoveNetWorkerPoseAdapter(adapterOptions)
        : createMoveNetPoseAdapter(adapterOptions),
      fallbackPoseAdapter: createMoveNetMockPoseAdapter(),
      performancePreset: preset,
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
   * @returns {void}
   */
  #replaceCvServiceForPresetChange() {
    const wasRunning = this.#cvService.running;
    this.#cvService.stop();
    this.#cvService = this.#createCvService();
    if (!wasRunning) {
      return;
    }
    this.#setCameraPermissionStatus(`Camera permission: restarting ${this.#cvPerformancePreset().label} preset...`);
  }

  /**
   * @param {unknown} value
   * @returns {import("@aerobeat/web-cv").AeroCvPerformancePresetId}
   */
  #normalizeCvPresetId(value) {
    if (
      value === "full"
      || value === "direct-256"
      || value === "direct-192"
      || value === "direct-160"
      || value === "balanced"
      || value === "fast"
      || value === "rescue"
    ) {
      return value;
    }
    return "full";
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
   * @param {import("@aerobeat/web-contracts").NormalizedPoseFrame} poseFrame
   * @returns {readonly PoseFlowDraftEventView[]}
   */
  #createInputEventViews(poseFrame) {
    this.#inputRouter.setMode("boxing");
    const boxingEvents = this.#inputRouter.routePoseFrame(poseFrame);
    this.#inputRouter.setMode("flow");
    const flowEvents = this.#inputRouter.routePoseFrame(poseFrame);
    return [
      ...boxingEvents,
      ...flowEvents
    ].map((event) => ({
      mode: event.mode,
      eventName: event.eventName,
      summary: event.detail.kind ?? event.detail.name
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
