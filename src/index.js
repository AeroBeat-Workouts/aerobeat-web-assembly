// @ts-check

import "@aerobeat/web-style/aero-theme.css";
import { elementNames, serviceIds } from "@aerobeat/web-contracts";
import { createReplayPoseFrame } from "@aerobeat/web-cv";
import { createPoseInputDraftEvents } from "@aerobeat/web-input";
import { defineAeroUiElements } from "@aerobeat/web-ui";
import { appMetadata } from "./release-metadata.js";

defineAeroUiElements();

/**
 * Root product shell for the AeroBeat browser app.
 */
class AeroBeatApp extends HTMLElement {
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
            <p class="checkpoint-note">Runtime checkpoint uses replay CV frames for secure phone loading checks; live camera starts after device-specific permission debugging.</p>
            <aero-calibration-screen></aero-calibration-screen>
          </div>
        </section>
        <footer class="metadata">
          <span>Secure context: ${this.#secureContextLabel()}</span>
          <span>Element: <code>${elementNames.app}</code></span>
        </footer>
      </main>
    `;
    this.#runRuntimeCheckpoint();
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
    const inputEvents = [
      ...createPoseInputDraftEvents(poseFrame, "boxing"),
      ...createPoseInputDraftEvents(poseFrame, "flow")
    ].map((event) => ({
      mode: event.mode,
      eventName: event.eventName,
      summary: event.detail.kind ?? event.detail.name
    }));

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
