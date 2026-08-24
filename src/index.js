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
 * Root product shell for the AeroBeat browser app.
 */
class AeroBeatApp extends HTMLElement {
  /** @type {Promise<void> | undefined} */
  #cameraPermissionRequest;

  /** @type {MediaStream | undefined} */
  #liveCameraStream;

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
          <aero-status-panel heading="Build" status="${appMetadata.displayVersion} / ${appMetadata.buildStamp}"></aero-status-panel>
        </header>
        <section class="stage" aria-label="AeroBeat app shell">
          <div class="hero">
            <div class="pulse-field" aria-label="AeroBeat rhythm field">
              <div class="beat-ring"></div>
            </div>
            <div class="metadata">
              <span>Version <code>${appMetadata.displayVersion}</code></span>
              <span>Cache <code>${appMetadata.cacheBust}</code></span>
            </div>
          </div>
          <div class="runtime">
            <aero-status-panel heading="Services" status="${this.#serviceSummary()}"></aero-status-panel>
            <aero-pose-flow-panel></aero-pose-flow-panel>
            <p class="checkpoint-note">Runtime checkpoint starts with replay CV frames for secure loading checks; calibration switches the visible source to the retained live camera stream after permission is granted.</p>
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
      this.#setCameraPermissionStatus(this.#liveCameraStatus());
      await this.#runLiveCameraCheckpoint();
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
    return `Camera permission: granted - live stream running (${runningTracks.length} ${trackLabel})`;
  }

  /**
   * Stops the retained live stream during page teardown.
   *
   * @returns {void}
   */
  #stopLiveCameraStream() {
    for (const track of this.#liveCameraStream?.getTracks() ?? []) {
      track.stop();
    }
    this.#liveCameraStream = undefined;
  }

  /**
   * Drives visible proving panels with the retained live-camera source.
   *
   * @returns {Promise<void>}
   */
  async #runLiveCameraCheckpoint() {
    const replayFrame = await createReplayPoseFrame({ sourceKind: "live-camera" });
    const poseFrame = {
      ...replayFrame,
      sourceId: "aero.camera.live.permission-stream",
      timestampMs: Math.round(performance.now())
    };
    const inputEvents = this.#createInputEventViews(poseFrame);

    this.#setPoseFlowPanelState(this.shadowRoot?.querySelector("aero-pose-flow-panel"), poseFrame, inputEvents);
    const calibrationScreen = this.shadowRoot?.querySelector("aero-calibration-screen");
    this.#setPoseFlowPanelState(
      calibrationScreen?.shadowRoot?.querySelector("aero-pose-flow-panel"),
      poseFrame,
      inputEvents
    );
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
