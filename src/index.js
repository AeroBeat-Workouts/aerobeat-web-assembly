// @ts-check

import "@aerobeat/web-style/aero-theme.css";
import { elementNames, serviceIds } from "@aerobeat/web-contracts";
import {
  createAeroCameraCvService,
  createAeroCvFrameSourceFromVideoSurface,
  createReplayPoseFrame
} from "@aerobeat/web-cv";
import { createPoseInputRouter } from "@aerobeat/web-input";
import { createAeroWebGl2Renderer } from "@aerobeat/web-renderer";
import { aeroButtonActivateEventName, aeroCalibrationEventNames, defineAeroUiElements } from "@aerobeat/web-ui";
import { createBrowserVideoMediaFacade, createLiveCameraSourceDescriptor } from "@aerobeat/web-video";
import {
  createMoveNetMockPoseAdapter,
  createMoveNetPoseAdapter,
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

  /** @type {AeroCameraCvService} */
  #cvService = createAeroCameraCvService({
    poseAdapter: createMoveNetPoseAdapter({ sourceId: moveNetLiveSourceId, mirrored: true }),
    fallbackPoseAdapter: createMoveNetMockPoseAdapter(),
    useFallbackOnError: true
  });

  /** @type {ReturnType<typeof createPoseInputRouter>} */
  #inputRouter = createPoseInputRouter();

  /** @type {AeroWebGl2Renderer} */
  #renderer = createAeroWebGl2Renderer();

  /** @type {number | undefined} */
  #runtimeAnimationFrame;

  /** @type {number} */
  #renderedPoseFrameCount = 0;

  /** @type {AeroVideoSurfaceDescriptor | undefined} */
  #activeSurface;

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
            <aero-status-panel class="inference-state" heading="Inference" status="CV idle / model idle / source none / inference frames 0 / pose frames 0"></aero-status-panel>
            <aero-status-panel class="media-state" heading="Media" status="Source none / playback idle"></aero-status-panel>
            <aero-pose-flow-panel></aero-pose-flow-panel>
            <p class="checkpoint-note">Runtime checkpoint starts with replay CV frames for secure loading checks; calibration switches the visible source to retained live MoveNet inference when camera and model setup succeed.</p>
            <aero-status-panel class="calibration-state" heading="Calibration" status="Idle - press Begin calibration"></aero-status-panel>
            <aero-status-panel class="camera-permission-state" heading="Camera" status="Permission idle"></aero-status-panel>
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
    });
    window.requestAnimationFrame(() => {
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
   * Starts the live camera permission checkpoint once per app instance.
   *
   * @returns {void}
   */
  #startLiveCameraPermissionRequest() {
    if (this.#cameraPermissionRequest) {
      return;
    }
    this.#setCameraPermissionStatus("Camera permission: requesting...");
    this.#cameraPermissionRequest = this.#requestLiveCameraPermission();
  }

  /**
   * @returns {Promise<void>}
   */
  async #requestLiveCameraPermission() {
    const source = createLiveCameraSourceDescriptor({
      sourceId: moveNetLiveSourceId,
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
    this.#activeSurface = preview.attachCameraStream(stream, source);
    this.#updateMediaStatus(this.#activeSurface);
    this.#updateInferenceStatus();
    this.#setCameraPermissionStatus("Camera permission: granted / loading model / source live-camera");

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
      this.#setCameraPermissionStatus("Camera permission: granted / live inference running / source live-camera");
      this.#updateInferenceStatus();
      this.#pumpLiveInferenceRoute();
    } catch (error) {
      this.#setCameraPermissionStatus(`Camera permission: granted / inference error (${this.#errorName(error)})`);
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
    preview.setSurfaceDescriptor(this.#activeSurface);
    this.#updateMediaStatus(this.#activeSurface);
    this.#updateInferenceStatus(status);

    const poseFrame = this.#cvService.getLatestPoseFrame();
    if (poseFrame) {
      this.#renderedPoseFrameCount += 1;
      const inputEvents = this.#createInputEventViews(poseFrame);
      preview.setPoseFrame(poseFrame);
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
    const mediaPoseDelta = typeof previewState?.mediaPoseDeltaMs === "number"
      ? `${previewState.mediaPoseDeltaMs}ms`
      : "n/a";
    const error = status.lastError ? ` / error ${status.lastError}` : "";
    this.shadowRoot
      ?.querySelector(".inference-state")
      ?.setAttribute("status", [
        `CV ${status.lifecycleState}`,
        `model ${status.modelStatus ?? "idle"}`,
        `source ${source}`,
        `inference frames ${status.inferenceCount}`,
        `pose frames ${status.poseFrameCount}`,
        `rendered pose frames ${this.#renderedPoseFrameCount}`,
        `overlay landmarks ${previewState?.landmarkCount ?? 0}`,
        `media-pose delta ${mediaPoseDelta}`
      ].join(" / ") + error);
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
        `size ${surface?.intrinsicWidth ?? 0}x${surface?.intrinsicHeight ?? 0}`
      ].join(" / "));
  }

  /**
   * @returns {void}
   */
  #configurePreviewServices() {
    const preview = this.#getPosePreview();
    preview.setVideoMediaFacade(this.#videoMediaFacade);
    preview.setRenderer(this.#renderer);
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
