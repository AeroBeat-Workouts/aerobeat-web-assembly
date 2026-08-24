// @ts-check

import { chromium } from "playwright";
import { readFileSync, rmSync } from "node:fs";
import { createServer } from "vite";

rmSync("node_modules/.vite", { recursive: true, force: true });

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const expectedVersion = packageJson.version;

const server = await createServer({
  appType: "spa",
  configFile: "vite.config.js",
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 0
  }
});

await server.listen();

const urls = server.resolvedUrls?.local ?? [];
const url = urls[0];
if (!url) {
  await server.close();
  throw new Error("Vite did not expose a local validation URL.");
}

/** @type {string[]} */
const consoleNoise = [];
/** @type {string[]} */
const pageErrors = [];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const grantedTrack = {
      kind: "video",
      readyState: "live",
      stop() {
        this.readyState = "ended";
        window.__aeroStoppedCameraTracks = (window.__aeroStoppedCameraTracks ?? 0) + 1;
      }
    };
    const grantedStream = {
      getTracks() {
        return [grantedTrack];
      }
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        async getUserMedia(constraints) {
          window.__aeroCameraRequests = [
            ...(Array.isArray(window.__aeroCameraRequests) ? window.__aeroCameraRequests : []),
            constraints
          ];
          window.__aeroGrantedCameraTrack = grantedTrack;
          return grantedStream;
        }
      }
    });
  });
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      consoleNoise.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("aerobeat-app").waitFor({ state: "attached" });
  const visibleMetadata = await page.locator("aerobeat-app").evaluate((element) => {
    const root = element.shadowRoot;
    return root?.textContent ?? "";
  });

  const buildPanel = await page.locator("aerobeat-app").evaluate((element) => {
    const panel = element.shadowRoot?.querySelector('aero-status-panel[heading="Build"]');
    return panel?.shadowRoot?.textContent ?? "";
  });

  if (!buildPanel.includes(expectedVersion)) {
    throw new Error(`Visible release proof version ${expectedVersion} was not rendered.`);
  }
  if (!buildPanel.includes("Build")) {
    throw new Error("Visible build proof panel was not rendered.");
  }
  if (!buildPanel.includes("/")) {
    throw new Error("Visible cache-bust metadata was not rendered.");
  }
  if (visibleMetadata.includes("Version ") || visibleMetadata.includes("Cache ")) {
    throw new Error("Duplicate lower version/cache metadata was rendered outside the top Build panel.");
  }

  await page.waitForFunction(() => {
    const app = document.querySelector("aerobeat-app");
    const panel = app?.shadowRoot?.querySelector("aero-pose-flow-panel");
    const panelText = panel?.shadowRoot?.textContent ?? "";
    return panelText.includes("aero.movenet.replay.basic-upper-body") && panelText.includes("6");
  });

  const buttonSemantics = await page.locator("aerobeat-app").evaluate((element) => {
    const screen = element.shadowRoot?.querySelector("aero-calibration-screen");
    const command = screen?.shadowRoot?.querySelector("aero-button");
    const nativeButton = command?.shadowRoot?.querySelector("button");
    return {
      tagName: nativeButton?.tagName ?? "",
      type: nativeButton?.getAttribute("type") ?? "",
      label: nativeButton?.textContent ?? ""
    };
  });
  if (buttonSemantics.tagName !== "BUTTON" || buttonSemantics.type !== "button") {
    throw new Error("Begin calibration does not render with native button semantics.");
  }
  if (!buttonSemantics.label.includes("Begin calibration")) {
    throw new Error("Begin calibration command label was not visible before activation.");
  }

  await page.locator("aerobeat-app aero-calibration-screen aero-button button").click();
  await page.waitForFunction(() => {
    const app = document.querySelector("aerobeat-app");
    const root = app?.shadowRoot;
    const runtimePanel = root?.querySelector("aero-pose-flow-panel");
    const screen = root?.querySelector("aero-calibration-screen");
    const screenPosePanel = screen?.shadowRoot?.querySelector("aero-pose-flow-panel");
    const screenStatus = screen?.shadowRoot?.querySelector("aero-status-panel");
    const screenButton = screen?.shadowRoot?.querySelector("aero-button");
    const runtimePanelText = runtimePanel?.shadowRoot?.textContent ?? "";
    const screenPosePanelText = screenPosePanel?.shadowRoot?.textContent ?? "";
    const screenStatusText = screenStatus?.shadowRoot?.textContent ?? "";
    const screenButtonText = screenButton?.shadowRoot?.textContent ?? "";
    const assemblyText = root?.querySelector(".calibration-state")?.shadowRoot?.textContent ?? "";
    const cameraText = root?.querySelector(".camera-permission-state")?.shadowRoot?.textContent ?? "";
    const cameraRequests = Array.isArray(window.__aeroCameraRequests) ? window.__aeroCameraRequests.length : 0;
    const stoppedTracks = window.__aeroStoppedCameraTracks ?? 0;
    const trackState = window.__aeroGrantedCameraTrack?.readyState ?? "";
    return screenStatusText.includes("Calibration active")
      && screenButtonText.includes("Calibration running")
      && assemblyText.includes("Calibration active")
      && cameraText.includes("Camera permission: granted - live stream running")
      && runtimePanelText.includes("aero.camera.live.permission-stream")
      && screenPosePanelText.includes("aero.camera.live.permission-stream")
      && !runtimePanelText.includes("aero.movenet.replay.basic-upper-body")
      && !screenPosePanelText.includes("aero.movenet.replay.basic-upper-body")
      && cameraRequests === 1
      && stoppedTracks === 0
      && trackState === "live";
  });

  const liveStreamState = await page.evaluate(() => ({
    stoppedTracks: window.__aeroStoppedCameraTracks ?? 0,
    trackState: window.__aeroGrantedCameraTrack?.readyState ?? ""
  }));
  if (liveStreamState.stoppedTracks !== 0 || liveStreamState.trackState !== "live") {
    throw new Error("Granted camera stream was stopped before page teardown.");
  }

  const teardownState = await page.evaluate(() => {
    document.querySelector("aerobeat-app")?.remove();
    return {
      stoppedTracks: window.__aeroStoppedCameraTracks ?? 0,
      trackState: window.__aeroGrantedCameraTrack?.readyState ?? ""
    };
  });
  if (teardownState.stoppedTracks !== 1 || teardownState.trackState !== "ended") {
    throw new Error("Granted camera stream was not released when the app left the page.");
  }
} finally {
  await browser.close();
  await server.close();
}

if (pageErrors.length > 0 || consoleNoise.length > 0) {
  console.error([...pageErrors, ...consoleNoise].join("\n"));
  process.exit(1);
}

console.log(`Playwright console-noise check passed at ${url}`);
