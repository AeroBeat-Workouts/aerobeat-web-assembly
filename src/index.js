// @ts-check

import "@aerobeat/web-style/aero-theme.css";
import { elementNames, serviceIds } from "@aerobeat/web-contracts";
import { createReplayPoseFrame, requestLiveCameraPermission } from "@aerobeat/web-cv";
import { createPoseInputDraftEvents } from "@aerobeat/web-input";
import { aeroCalibrationEventNames, defineAeroUiElements } from "@aerobeat/web-ui";
import { appMetadata } from "./release-metadata.js";

defineAeroUiElements();

/**
 * @typedef {Object} PoseFlowDraftEventView
 * @property {string} mode Gameplay mode.
 * @property {string} eventName Browser event name.
 * @property {string} summary Short event summary.
 */

/**
 * @typedef {Object} SampledLiveCameraPose
 * @property {import("@aerobeat/web-contracts").NormalizedPoseFrame} poseFrame Camera-frame sampler pose proxy.
 * @property {number} sampleCount Number of frame samples read from the video stream.
 */

/**
 * Root product shell for the AeroBeat browser app.
 */
class AeroBeatApp extends HTMLElement {
  /** @type {Promise<void> | undefined} */
  #cameraPermissionRequest;

  /** @type {MediaStream | undefined} */
  #liveCameraStream;

  /** @type {HTMLVideoElement | undefined} */
  #liveCameraVideo;

  /** @type {HTMLCanvasElement | undefined} */
  #liveCameraSamplerCanvas;

  /** @type {CanvasRenderingContext2D | undefined} */
  #liveCameraSamplerContext;

  /** @type {number | undefined} */
  #liveCameraAnimationFrame;

  /** @type {number} */
  #liveCameraFrameCount = 0;

  /** @type {number} */
  #liveCameraSampleCount = 0;

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

        .stage {
          align-items: stretch;
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
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

        .pulse-field {
          aspect-ratio: 16 / 9;
          background:
            linear-gradient(90deg, rgba(0, 126, 184, 0.18) 1px, transparent 1px),
            linear-gradient(180deg, rgba(0, 126, 184, 0.18) 1px, transparent 1px),
            linear-gradient(135deg, rgba(255, 255, 255, 0.86), rgba(130, 220, 191, 0.58));
          background-size: 40px 40px, 40px 40px, auto;
          border: 1px solid rgba(39, 129, 164, 0.28);
          border-radius: 8px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
          display: grid;
          overflow: hidden;
          place-items: center;
          position: relative;
        }

        .beat-ring {
          aspect-ratio: 1;
          border: 2px solid rgba(9, 119, 177, 0.72);
          border-radius: 50%;
          box-shadow: 0 0 0 24px rgba(255, 255, 255, 0.36), 0 0 54px rgba(20, 151, 201, 0.42);
          inline-size: min(44%, 220px);
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

        .camera-video {
          block-size: 1px;
          inline-size: 1px;
          opacity: 0.01;
          pointer-events: none;
          position: fixed;
          right: 0;
          top: 0;
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
        <header class="topbar">
          <div class="brand">
            <span class="title">AeroBeat</span>
            <span class="subtitle">Browser assembly runtime</span>
          </div>
          <aero-status-panel heading="Build" status="Version ${appMetadata.displayVersion} / Built ${appMetadata.buildStamp} / Cache ${appMetadata.cacheBust}"></aero-status-panel>
        </header>
        <section class="stage" aria-label="AeroBeat app shell">
          <div class="hero">
            <div class="pulse-field" aria-label="AeroBeat rhythm field">
              <div class="beat-ring"></div>
            </div>
          </div>
          <div class="runtime">
            <aero-status-panel heading="Services" status="${this.#serviceSummary()}"></aero-status-panel>
            <aero-pose-flow-panel></aero-pose-flow-panel>
            <p class="checkpoint-note">Runtime checkpoint starts with replay CV frames for secure loading checks; calibration switches the visible source to a retained live camera frame sampler after permission is granted.</p>
            <aero-status-panel class="calibration-state" heading="Calibration" status="Idle - press Begin calibration"></aero-status-panel>
            <aero-status-panel class="camera-permission-state" heading="Camera" status="Permission idle"></aero-status-panel>
            <video class="camera-video" aria-hidden="true" autoplay muted playsinline></video>
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
    this.#runRuntimeCheckpoint();
  }

  /**
   * Releases live camera tracks when the app leaves the page.
   */
  disconnectedCallback() {
    this.#stopLiveCameraStream();
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
      serviceIds.cvPose,
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
      this.#startLiveCameraPermissionRequest();
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
    this.#setCameraPermissionStatus("Camera permission: requesting...");
    this.#cameraPermissionRequest = this.#requestLiveCameraPermission();
  }

  /**
   * @returns {Promise<void>}
   */
  async #requestLiveCameraPermission() {
    const result = await requestLiveCameraPermission();
    if (result.status === "granted") {
      this.#liveCameraStream = result.stream;
      await this.#startLiveCameraFrameSampler(result.stream);
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
   * @returns {string}
   */
  #liveCameraStatus() {
    const tracks = this.#liveCameraStream?.getTracks() ?? [];
    const runningTracks = tracks.filter((track) => track.readyState !== "ended");
    const trackLabel = runningTracks.length === 1 ? "track" : "tracks";
    return [
      `Camera permission: granted - live camera frame sampler running (${runningTracks.length} ${trackLabel})`,
      `frames ${this.#liveCameraFrameCount}`,
      `samples ${this.#liveCameraSampleCount}`
    ].join(" / ");
  }

  /**
   * Stops the retained live stream during page teardown.
   *
   * @returns {void}
   */
  #stopLiveCameraStream() {
    if (this.#liveCameraAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.#liveCameraAnimationFrame);
      this.#liveCameraAnimationFrame = undefined;
    }
    if (this.#liveCameraVideo) {
      this.#liveCameraVideo.pause();
      this.#liveCameraVideo.srcObject = null;
    }
    for (const track of this.#liveCameraStream?.getTracks() ?? []) {
      track.stop();
    }
    this.#liveCameraStream = undefined;
  }

  /**
   * Attaches the granted stream to video and starts recurring frame sampling.
   *
   * @param {MediaStream} stream
   * @returns {Promise<void>}
   */
  async #startLiveCameraFrameSampler(stream) {
    const video = this.#getLiveCameraVideo();
    video.srcObject = stream;
    this.#liveCameraFrameCount = 0;
    this.#liveCameraSampleCount = 0;
    this.#setCameraPermissionStatus(this.#liveCameraStatus());

    try {
      await video.play();
    } catch (error) {
      this.#setCameraPermissionStatus(`Camera permission: granted - video play blocked (${this.#errorName(error)})`);
      return;
    }

    this.#sampleLiveCameraFrame();
  }

  /**
   * @returns {HTMLVideoElement}
   */
  #getLiveCameraVideo() {
    if (!this.#liveCameraVideo) {
      this.#liveCameraVideo = this.shadowRoot?.querySelector(".camera-video") ?? undefined;
    }
    if (!this.#liveCameraVideo) {
      throw new Error("Live camera video element was not rendered.");
    }
    return this.#liveCameraVideo;
  }

  /**
   * Samples a frame from the live video stream and schedules the next sample.
   *
   * @returns {void}
   */
  #sampleLiveCameraFrame() {
    if (!this.#liveCameraStream || !this.#liveCameraVideo || this.#liveCameraVideo.paused) {
      return;
    }

    this.#liveCameraFrameCount += 1;
    const sample = this.#createLiveCameraPoseSample(this.#liveCameraVideo);
    this.#liveCameraSampleCount = sample.sampleCount;
    const inputEvents = this.#createInputEventViews(sample.poseFrame);

    this.#setCameraPermissionStatus(this.#liveCameraStatus());
    this.#setPoseFlowPanelState(this.shadowRoot?.querySelector("aero-pose-flow-panel"), sample.poseFrame, inputEvents);
    const calibrationScreen = this.shadowRoot?.querySelector("aero-calibration-screen");
    this.#setPoseFlowPanelState(
      calibrationScreen?.shadowRoot?.querySelector("aero-pose-flow-panel"),
      sample.poseFrame,
      inputEvents
    );

    this.#liveCameraAnimationFrame = window.requestAnimationFrame(() => this.#sampleLiveCameraFrame());
  }

  /**
   * @param {HTMLVideoElement} video
   * @returns {SampledLiveCameraPose}
   */
  #createLiveCameraPoseSample(video) {
    const canvas = this.#getLiveCameraSamplerCanvas();
    const context = this.#getLiveCameraSamplerContext(canvas);
    const width = Math.max(1, video.videoWidth || 64);
    const height = Math.max(1, video.videoHeight || 48);
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    this.#liveCameraSampleCount += 1;
    const sampleCount = this.#liveCameraSampleCount;
    const nose = this.#sampleCameraLandmark(context, width, height, sampleCount, "nose", 0.5, 0.28);
    const leftWrist = this.#sampleCameraLandmark(context, width, height, sampleCount + 7, "left_wrist", 0.28, 0.64);
    const rightWrist = this.#sampleCameraLandmark(context, width, height, sampleCount + 13, "right_wrist", 0.72, 0.64);

    return {
      sampleCount,
      poseFrame: {
        sourceId: "aero.camera.live.frame-sampler",
        timestampMs: Math.round(performance.now()),
        mirrored: true,
        landmarks: [nose, leftWrist, rightWrist]
      }
    };
  }

  /**
   * @returns {HTMLCanvasElement}
   */
  #getLiveCameraSamplerCanvas() {
    this.#liveCameraSamplerCanvas ??= document.createElement("canvas");
    return this.#liveCameraSamplerCanvas;
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @returns {CanvasRenderingContext2D}
   */
  #getLiveCameraSamplerContext(canvas) {
    this.#liveCameraSamplerContext ??= canvas.getContext("2d", { willReadFrequently: true }) ?? undefined;
    if (!this.#liveCameraSamplerContext) {
      throw new Error("Live camera frame sampler could not create a 2D canvas context.");
    }
    return this.#liveCameraSamplerContext;
  }

  /**
   * @param {CanvasRenderingContext2D} context
   * @param {number} width
   * @param {number} height
   * @param {number} sampleIndex
   * @param {import("@aerobeat/web-contracts").BodyGridAnchorName} name
   * @param {number} baseX
   * @param {number} baseY
   * @returns {import("@aerobeat/web-contracts").NormalizedPoseLandmark}
   */
  #sampleCameraLandmark(context, width, height, sampleIndex, name, baseX, baseY) {
    const pixelX = Math.min(width - 1, Math.max(0, Math.round(baseX * (width - 1))));
    const pixelY = Math.min(height - 1, Math.max(0, Math.round(baseY * (height - 1))));
    const [red, green, blue] = context.getImageData(pixelX, pixelY, 1, 1).data;
    const luma = (red + green + blue) / (255 * 3);
    const phase = sampleIndex * 0.19;
    return {
      name,
      x: this.#clamp01(baseX + (red / 255 - 0.5) * 0.22 + Math.sin(phase) * 0.04),
      y: this.#clamp01(baseY + (green / 255 - 0.5) * 0.18 + Math.cos(phase) * 0.04),
      confidence: this.#clamp01(0.58 + luma * 0.34)
    };
  }

  /**
   * @param {unknown} error
   * @returns {string}
   */
  #errorName(error) {
    return error instanceof DOMException || error instanceof Error ? error.name : "VideoPlaybackError";
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  #clamp01(value) {
    return Math.min(1, Math.max(0, value));
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
  }

  /**
   * @param {import("@aerobeat/web-contracts").NormalizedPoseFrame} poseFrame
   * @returns {readonly PoseFlowDraftEventView[]}
   */
  #createInputEventViews(poseFrame) {
    return [
      ...createPoseInputDraftEvents(poseFrame, "boxing"),
      ...createPoseInputDraftEvents(poseFrame, "flow")
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
