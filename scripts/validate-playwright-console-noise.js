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
  const page = await browser.newPage({
    viewport: {
      width: 390,
      height: 844
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        async enumerateDevices() {
          return [
            { kind: "audioinput", deviceId: "mic-1", label: "Mic", groupId: "audio" },
            { kind: "videoinput", deviceId: "camera-front", label: "Front camera", groupId: "front" },
            { kind: "videoinput", deviceId: "camera-rear", label: "Rear camera", groupId: "rear" }
          ];
        },
        async getUserMedia(constraints) {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Fake camera canvas context unavailable.");
          }
          let fakeFrameCount = 0;
          const drawFrame = () => {
            fakeFrameCount += 1;
            window.__aeroFakeCameraFrames = fakeFrameCount;
            context.fillStyle = `rgb(${(fakeFrameCount * 17) % 255}, ${(fakeFrameCount * 29) % 255}, 180)`;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = `rgb(240, ${(fakeFrameCount * 41) % 255}, ${(fakeFrameCount * 7) % 255})`;
            context.fillRect((fakeFrameCount * 3) % canvas.width, 20, 22, 22);
            window.requestAnimationFrame(drawFrame);
          };
          drawFrame();
          const grantedStream = canvas.captureStream(30);
          const grantedTrack = grantedStream.getVideoTracks()[0];
          const stopTrack = grantedTrack.stop.bind(grantedTrack);
          grantedTrack.stop = () => {
            window.__aeroStoppedCameraTracks = (window.__aeroStoppedCameraTracks ?? 0) + 1;
            stopTrack();
          };
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
    if ((message.type() === "warning" || message.type() === "error") && !isExpectedConsoleWarning(message.text())) {
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
    const preview = app?.shadowRoot?.querySelector("aero-media-pose-preview");
    const panelText = panel?.shadowRoot?.textContent ?? "";
    const previewState = preview?.describePreview?.();
    return panelText.includes("aero.movenet.replay.basic-upper-body")
      && panelText.includes("6")
      && previewState?.rendererDrawCount > 0;
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

  const topbarButtonSemantics = await page.locator("aerobeat-app").evaluate((element) => {
    const command = element.shadowRoot?.querySelector("aero-button.calibration-entrypoint");
    const nativeButton = command?.shadowRoot?.querySelector("button");
    const bounds = nativeButton?.getBoundingClientRect();
    return {
      tagName: nativeButton?.tagName ?? "",
      type: nativeButton?.getAttribute("type") ?? "",
      label: nativeButton?.textContent ?? "",
      bounds: bounds
        ? {
            top: bounds.top,
            right: bounds.right,
            bottom: bounds.bottom,
            left: bounds.left
          }
        : undefined,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });
  if (topbarButtonSemantics.tagName !== "BUTTON" || topbarButtonSemantics.type !== "button") {
    throw new Error("Topbar Begin calibration does not render with native button semantics.");
  }
  if (!topbarButtonSemantics.label.includes("Begin calibration")) {
    throw new Error("Topbar Begin calibration command label was not visible before activation.");
  }
  const topbarBounds = topbarButtonSemantics.bounds;
  if (
    !topbarBounds
    || topbarBounds.top < 0
    || topbarBounds.bottom > topbarButtonSemantics.viewportHeight
    || topbarBounds.left < topbarButtonSemantics.viewportWidth * 0.42
  ) {
    throw new Error("Topbar Begin calibration was not visible in the mobile first viewport.");
  }

  await page.waitForFunction(() => {
    const app = document.querySelector("aerobeat-app");
    const root = app?.shadowRoot;
    const cameraSelect = root?.querySelector(".camera-device-select")?.shadowRoot?.querySelector("select");
    const speedSelect = root?.querySelector(".tracking-speed-select")?.shadowRoot?.querySelector("select");
    const performanceSelect = root?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
    return cameraSelect?.options.length === 3
      && speedSelect?.options.length === 2
      && performanceSelect?.options.length === 4;
  });
  await page.locator("aerobeat-app").evaluate((element) => {
    const root = element.shadowRoot;
    const cameraSelect = root?.querySelector(".camera-device-select")?.shadowRoot?.querySelector("select");
    const speedSelect = root?.querySelector(".tracking-speed-select")?.shadowRoot?.querySelector("select");
    const performanceSelect = root?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
    if (!cameraSelect || !speedSelect || !performanceSelect) {
      throw new Error("Phone test controls were not rendered.");
    }
    cameraSelect.value = "camera-rear";
    cameraSelect.dispatchEvent(new Event("change", { bubbles: true }));
    speedSelect.value = "fast";
    speedSelect.dispatchEvent(new Event("change", { bubbles: true }));
    performanceSelect.value = "rescue";
    performanceSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await page.locator("aerobeat-app aero-button.calibration-entrypoint button").click();
  await page.waitForFunction(() => {
    const app = document.querySelector("aerobeat-app");
    const root = app?.shadowRoot;
    const runtimePanel = root?.querySelector("aero-pose-flow-panel");
    const screen = root?.querySelector("aero-calibration-screen");
    const screenPosePanel = screen?.shadowRoot?.querySelector("aero-pose-flow-panel");
    const screenStatus = screen?.shadowRoot?.querySelector("aero-status-panel");
    const screenButton = screen?.shadowRoot?.querySelector("aero-button");
    const preview = root?.querySelector("aero-media-pose-preview");
    const previewVideo = preview?.shadowRoot?.querySelector("video");
    const previewState = preview?.describePreview?.();
    const runtimePanelText = runtimePanel?.shadowRoot?.textContent ?? "";
    const screenPosePanelText = screenPosePanel?.shadowRoot?.textContent ?? "";
    const screenStatusText = screenStatus?.shadowRoot?.textContent ?? "";
    const screenButtonText = screenButton?.shadowRoot?.textContent ?? "";
    const topbarButtonText = root
      ?.querySelector("aero-button.calibration-entrypoint")
      ?.shadowRoot
      ?.textContent ?? "";
    const assemblyText = root?.querySelector(".calibration-state")?.shadowRoot?.textContent ?? "";
    const cameraText = root?.querySelector(".camera-permission-state")?.shadowRoot?.textContent ?? "";
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const mediaText = root?.querySelector(".media-state")?.shadowRoot?.textContent ?? "";
    const cameraRequests = Array.isArray(window.__aeroCameraRequests) ? window.__aeroCameraRequests.length : 0;
    const stoppedTracks = window.__aeroStoppedCameraTracks ?? 0;
    const trackState = window.__aeroGrantedCameraTrack?.readyState ?? "";
    return screenStatusText.includes("Calibration active")
      && screenButtonText.includes("Calibration running")
      && topbarButtonText.includes("Calibration running")
      && assemblyText.includes("Calibration active")
      && cameraText.includes("Camera permission: granted / live inference running / source live-camera")
      && cameraText.includes("CV preset Low-end rescue")
      && inferenceText.includes("CV running")
      && inferenceText.includes("preset Low-end rescue (360p camera / 160px CV)")
      && (inferenceText.includes("execution worker") || inferenceText.includes("execution main-thread"))
      && inferenceText.includes("model ready")
      && inferenceText.includes("source live-camera aero.movenet.live")
      && inferenceText.includes("input 160x120")
      && inferenceText.includes("inference frames ")
      && inferenceText.includes("pose frames ")
      && inferenceText.includes("overlay landmarks ")
      && inferenceText.includes("tracking fast")
      && inferenceText.includes("media-pose delta ")
      && mediaText.includes("Source live-camera aero.movenet.live")
      && mediaText.includes("playback playing")
      && runtimePanelText.includes("aero.movenet.live")
      && screenPosePanelText.includes("aero.movenet.live")
      && !runtimePanelText.includes("aero.movenet.replay.basic-upper-body")
      && !screenPosePanelText.includes("aero.movenet.replay.basic-upper-body")
      && !runtimePanelText.includes("aero.camera.live.frame-sampler")
      && !screenPosePanelText.includes("aero.camera.live.frame-sampler")
      && previewVideo?.srcObject instanceof MediaStream
      && previewVideo.videoWidth > 0
      && previewVideo.videoHeight > 0
      && previewState?.sourceKind === "live-camera"
      && previewState?.sourceId === "aero.movenet.live"
      && typeof previewState?.landmarkCount === "number"
      && previewState?.trackingProfile === "fast"
      && previewState?.rendererDrawCount > 0
      && cameraRequests === 1
      && stoppedTracks === 0
      && trackState === "live";
  }, undefined, { timeout: 90000 });

  const firstLiveSample = await readLiveInferenceSnapshot(page);
  await page.waitForFunction((previousTimestamp) => {
    const app = document.querySelector("aerobeat-app");
    const panel = app?.shadowRoot?.querySelector("aero-pose-flow-panel");
    const inferenceText = app?.shadowRoot?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const timestampMs = panel?.state?.poseFrame?.timestampMs ?? 0;
    const inferenceMatch = /inference frames (?<inference>\d+)/u.exec(inferenceText);
    const poseMatch = /pose frames (?<pose>\d+)/u.exec(inferenceText);
    const inferenceFrames = Number.parseInt(inferenceMatch?.groups?.inference ?? "0", 10);
    const poseFrames = Number.parseInt(poseMatch?.groups?.pose ?? "0", 10);
    return inferenceFrames >= 2 && poseFrames >= 2 && timestampMs > previousTimestamp;
  }, firstLiveSample.timestampMs);
  const secondLiveSample = await readLiveInferenceSnapshot(page);
  if (secondLiveSample.inferenceFrameCount <= firstLiveSample.inferenceFrameCount) {
    throw new Error("Live MoveNet inference did not process multiple frames.");
  }
  if (secondLiveSample.poseFrameCount <= firstLiveSample.poseFrameCount) {
    throw new Error("Live CV service did not produce multiple pose frames.");
  }
  if (secondLiveSample.timestampMs <= firstLiveSample.timestampMs) {
    throw new Error("Live MoveNet pose-frame timestamps did not advance.");
  }

  const initialCameraRequest = await page.evaluate(() => window.__aeroCameraRequests?.[0]);
  if (initialCameraRequest?.video?.deviceId?.exact !== "camera-rear") {
    throw new Error("Selected camera deviceId did not reach the initial getUserMedia request.");
  }
  if (initialCameraRequest?.video?.width?.ideal !== 480 || initialCameraRequest?.video?.height?.ideal !== 360) {
    throw new Error("Selected CV performance preset did not reduce initial camera constraints.");
  }

  await page.locator("aerobeat-app").evaluate((element) => {
    const cameraSelect = element.shadowRoot?.querySelector(".camera-device-select")?.shadowRoot?.querySelector("select");
    if (!cameraSelect) {
      throw new Error("Camera selector was not available for live restart.");
    }
    cameraSelect.value = "camera-front";
    cameraSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const app = document.querySelector("aerobeat-app");
    const cameraText = app?.shadowRoot?.querySelector(".camera-permission-state")?.shadowRoot?.textContent ?? "";
    const inferenceText = app?.shadowRoot?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const cameraRequests = Array.isArray(window.__aeroCameraRequests) ? window.__aeroCameraRequests.length : 0;
    return cameraRequests === 2
      && (window.__aeroStoppedCameraTracks ?? 0) === 1
      && cameraText.includes("Camera permission: granted / live inference running / source live-camera")
      && cameraText.includes("CV preset Low-end rescue")
      && inferenceText.includes("tracking fast");
  }, undefined, { timeout: 90000 });
  const restartCameraRequest = await page.evaluate(() => window.__aeroCameraRequests?.[1]);
  if (restartCameraRequest?.video?.deviceId?.exact !== "camera-front") {
    throw new Error("Selected camera deviceId did not reach the restarted getUserMedia request.");
  }
  if (restartCameraRequest?.video?.width?.ideal !== 480 || restartCameraRequest?.video?.height?.ideal !== 360) {
    throw new Error("Selected CV performance preset did not reduce restarted camera constraints.");
  }

  const liveStreamState = await page.evaluate(() => ({
    stoppedTracks: window.__aeroStoppedCameraTracks ?? 0,
    trackState: window.__aeroGrantedCameraTrack?.readyState ?? ""
  }));
  if (liveStreamState.stoppedTracks !== 1 || liveStreamState.trackState !== "live") {
    throw new Error("Restarted camera stream was not live before page teardown.");
  }

  const teardownState = await page.evaluate(() => {
    document.querySelector("aerobeat-app")?.remove();
    return {
      stoppedTracks: window.__aeroStoppedCameraTracks ?? 0,
      trackState: window.__aeroGrantedCameraTrack?.readyState ?? ""
    };
  });
  if (teardownState.stoppedTracks !== 2 || teardownState.trackState !== "ended") {
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

/**
 * @param {import("playwright").Page} page
 * @returns {Promise<{
 *   sampleCount: number,
 *   timestampMs: number,
 *   landmarkSignature: string
 * }>}
 */
async function readLiveInferenceSnapshot(page) {
  return page.evaluate(() => {
    const app = document.querySelector("aerobeat-app");
    const root = app?.shadowRoot;
    const panel = root?.querySelector("aero-pose-flow-panel");
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const inferenceMatch = /inference frames (?<inference>\d+)/u.exec(inferenceText);
    const poseMatch = /pose frames (?<pose>\d+)/u.exec(inferenceText);
    const poseFrame = panel?.state?.poseFrame;
    return {
      inferenceFrameCount: Number.parseInt(inferenceMatch?.groups?.inference ?? "0", 10),
      poseFrameCount: Number.parseInt(poseMatch?.groups?.pose ?? "0", 10),
      timestampMs: poseFrame?.timestampMs ?? 0,
      landmarkSignature: JSON.stringify(poseFrame?.landmarks ?? [])
    };
  });
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isExpectedConsoleWarning(text) {
  return text.includes("GL Driver Message")
    && text.includes("GPU stall due to ReadPixels");
}
