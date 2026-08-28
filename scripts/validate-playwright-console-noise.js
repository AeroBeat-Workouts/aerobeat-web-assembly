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
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async writeText(text) {
          window.__aeroClipboardText = text;
        }
      }
    });
    const createObjectUrl = URL.createObjectURL.bind(URL);
    const revokeObjectUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const objectUrl = createObjectUrl(blob);
      window.__aeroCreatedObjectUrls = [
        ...(Array.isArray(window.__aeroCreatedObjectUrls) ? window.__aeroCreatedObjectUrls : []),
        objectUrl
      ];
      return objectUrl;
    };
    URL.revokeObjectURL = (objectUrl) => {
      window.__aeroRevokedObjectUrls = [
        ...(Array.isArray(window.__aeroRevokedObjectUrls) ? window.__aeroRevokedObjectUrls : []),
        objectUrl
      ];
      revokeObjectUrl(objectUrl);
    };
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
    || topbarBounds.left < 0
    || topbarBounds.right > topbarButtonSemantics.viewportWidth
  ) {
    throw new Error("Primary Begin calibration was not visible in the mobile first viewport.");
  }

  const compactUi = await page.locator("aerobeat-app").evaluate((element) => {
    const root = element.shadowRoot;
    const title = root?.querySelector(".title");
    const build = root?.querySelector(".build-row");
    const options = root?.querySelector("details.calibration-options");
    const summary = options?.querySelector("summary");
    const progress = root?.querySelector(".timing-window-progress");
    const controls = Array.from(root?.querySelectorAll(".test-controls aero-select") ?? []);
    const controlRects = controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return { top: rect.top, left: rect.left, right: rect.right };
    });
    const controlOrder = controls.map((control) => Array.from(control.classList).find((name) => name.endsWith("-select")) ?? "");
    const hiddenDiagnostics = [
      'aero-status-panel[heading="Services"]',
      ".inference-state",
      ".media-state",
      "aero-pose-flow-panel",
      ".checkpoint-note",
      ".calibration-state",
      ".camera-permission-state",
      ".telemetry-capture-state",
      "aero-calibration-screen"
    ].map((selector) => root?.querySelector(selector)?.getClientRects().length ?? -1);
    const primaryButton = root?.querySelector("aero-button.calibration-entrypoint")?.shadowRoot?.querySelector("button");
    const duplicateButton = root?.querySelector("aero-calibration-screen")?.shadowRoot?.querySelector("aero-button")?.shadowRoot?.querySelector("button");
    const visibleCalibrationButtons = [primaryButton, duplicateButton]
      .filter((button) => button && button.getClientRects().length > 0)
      .length;
    const titleRect = title?.getBoundingClientRect();
    const buildRect = build?.getBoundingClientRect();
    const optionsRect = options?.getBoundingClientRect();
    const chevronContent = summary ? getComputedStyle(summary, "::after").content : "none";
    summary?.click();
    const collapsed = options instanceof HTMLDetailsElement && !options.open;
    summary?.click();
    const reopened = options instanceof HTMLDetailsElement && options.open;
    return {
      subtitleAbsent: !root?.querySelector(".subtitle"),
      rowOrder: Boolean(titleRect && buildRect && optionsRect && titleRect.bottom <= buildRect.top && buildRect.bottom <= optionsRect.top),
      chevronContent,
      collapsed,
      reopened,
      progress: progress?.textContent ?? "",
      controlRects,
      controlOrder,
      gameplaySource: root?.querySelector(".pose-gameplay-source-select")?.shadowRoot?.querySelector("select")?.value ?? "",
      hiddenDiagnostics,
      visibleCalibrationButtons
    };
  });
  const expectedControlOrder = [
    "pose-backend-select",
    "pose-provider-select",
    "mediapipe-tuning-select",
    "camera-device-select",
    "tracking-speed-select",
    "pose-gameplay-source-select",
    "cv-performance-select"
  ];
  const controlsAreOneColumn = compactUi.controlRects.length === expectedControlOrder.length
    && compactUi.controlOrder.join(",") === expectedControlOrder.join(",")
    && compactUi.controlRects.every((rect, index, rects) => (
      Math.abs(rect.left - rects[0].left) < 2
      && Math.abs(rect.right - rects[0].right) < 2
      && (index === 0 || rect.top > rects[index - 1].top)
    ));
  if (
    !compactUi.subtitleAbsent
    || !compactUi.rowOrder
    || compactUi.chevronContent === "none"
    || !compactUi.collapsed
    || !compactUi.reopened
    || compactUi.progress !== "Timing window 0/120"
    || compactUi.gameplaySource !== "measured"
    || !controlsAreOneColumn
    || compactUi.hiddenDiagnostics.some((rectCount) => rectCount !== 0)
    || compactUi.visibleCalibrationButtons !== 1
  ) {
    throw new Error(`Compact phone benchmark UI contract failed: ${JSON.stringify(compactUi)}`);
  }

  await page.waitForFunction(() => {
    const app = document.querySelector("aerobeat-app");
    const root = app?.shadowRoot;
    const backendSelect = root?.querySelector(".pose-backend-select")?.shadowRoot?.querySelector("select");
    const providerSelect = root?.querySelector(".pose-provider-select")?.shadowRoot?.querySelector("select");
    const tuningSelect = root?.querySelector(".mediapipe-tuning-select")?.shadowRoot?.querySelector("select");
    const cameraSelect = root?.querySelector(".camera-device-select")?.shadowRoot?.querySelector("select");
    const speedSelect = root?.querySelector(".tracking-speed-select")?.shadowRoot?.querySelector("select");
    const performanceSelect = root?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
    return backendSelect?.options.length === 1
      && backendSelect.value === "mediapipe"
      && providerSelect?.options.length === 2
      && providerSelect.value === "gpu-webgl"
      && tuningSelect?.options.length === 2
      && tuningSelect.value === "standard"
      && !tuningSelect.disabled
      && cameraSelect?.options.length === 3
      && speedSelect?.options.length === 2
      && performanceSelect?.options.length === 8;
  });
  const defaultPhoneControls = await page.locator("aerobeat-app").evaluate((element) => {
    const root = element.shadowRoot;
    const tuningElement = root?.querySelector(".mediapipe-tuning-select");
    const tuningSelect = tuningElement?.shadowRoot?.querySelector("select");
    const speedSelect = root?.querySelector(".tracking-speed-select")?.shadowRoot?.querySelector("select");
    const performanceSelect = root?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    return {
      tuning: tuningSelect?.value ?? "",
      tuningDisabled: tuningSelect?.disabled ?? false,
      tuningLabel: tuningElement?.getAttribute("label") ?? "",
      tracking: speedSelect?.value ?? "",
      cvPreset: performanceSelect?.value ?? "",
      cvLabel: performanceSelect?.selectedOptions[0]?.textContent ?? "",
      cvLabels: Array.from(performanceSelect?.options ?? []).map((option) => option.textContent ?? ""),
      inferenceText
    };
  });
  if (
    defaultPhoneControls.tuning !== "standard"
    || defaultPhoneControls.tuningDisabled
    || defaultPhoneControls.tuningLabel !== "MediaPipe tuning"
  ) {
    throw new Error("MediaPipe tuning did not default to enabled Standard thresholds.");
  }
  if (defaultPhoneControls.tracking !== "fast") {
    throw new Error("Phone tracking did not default to the measured Fast profile.");
  }
  if (defaultPhoneControls.cvPreset !== "full") {
    throw new Error("CV performance did not default to the measured direct full path.");
  }
  if (!defaultPhoneControls.cvLabel.includes("Direct full (recommended)")) {
    throw new Error("Default CV option did not expose the recommended direct full label.");
  }
  if (!defaultPhoneControls.cvLabel.includes("main thread") || !defaultPhoneControls.cvLabel.includes("no resize")) {
    throw new Error("Default CV option did not expose execution and resize-path detail.");
  }
  for (const requiredLabel of [
    "Direct downscale 256",
    "Direct downscale 192",
    "Direct downscale 160",
    "Experimental worker downscale 256",
    "Experimental worker downscale 192",
    "Experimental worker downscale 160"
  ]) {
    if (!defaultPhoneControls.cvLabels.some((label) => label.includes(requiredLabel))) {
      throw new Error(`CV options omitted ${requiredLabel}.`);
    }
  }
  if (!defaultPhoneControls.inferenceText.includes("preset Direct full (recommended)")) {
    throw new Error("Inference status did not default to the recommended direct full preset.");
  }
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
    performanceSelect.value = "direct-160";
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
      && cameraText.includes("Camera permission: granted / live inference mediapipe/webgl / source live-camera")
      && cameraText.includes("CV preset Direct downscale 160")
      && inferenceText.includes("CV running")
      && inferenceText.includes("preset Direct downscale 160 (main thread / camera default / 160px canvas resize / no worker transfer)")
      && inferenceText.includes("execution main-thread MediaPipe Tasks Vision GPU delegate via synchronous WebGL")
      && inferenceText.includes("resize main-thread canvas")
      && inferenceText.includes("model ready")
      && inferenceText.includes("source live-camera aero.mediapipe.live")
      && inferenceText.includes("input 160x120")
      && inferenceText.includes("camera 640x480")
      && inferenceText.includes("video fps ")
      && inferenceText.includes("sampling video-frame-callback")
      && /sample target 15fps effective \d+fps/u.test(inferenceText)
      && /pose output \d+fps/u.test(inferenceText)
      && /status updates \d+fps target 4fps/u.test(inferenceText)
      && /overlay renders \d+fps target 30fps/u.test(inferenceText)
      && /prep \d+ms avg \d+ms/u.test(inferenceText)
      && /adapter \d+ms avg \d+ms/u.test(inferenceText)
      && /total \d+ms avg \d+ms/u.test(inferenceText)
      && inferenceText.includes("inference frames ")
      && inferenceText.includes("pose frames ")
      && inferenceText.includes("dropped frames ")
      && inferenceText.includes("worker capture replacements 0 retired transferables 0")
      && inferenceText.includes("sampling callback gap p50 ")
      && inferenceText.includes("worker roundtrip n/a")
      && /submitted age \d+ms/u.test(inferenceText)
      && /output age \d+ms/u.test(inferenceText)
      && /render age \d+ms/u.test(inferenceText)
      && /status age \d+ms/u.test(inferenceText)
      && inferenceText.includes("overlay landmarks ")
      && inferenceText.includes("tracking fast")
      && inferenceText.includes("media-pose delta ")
      && mediaText.includes("Source live-camera aero.mediapipe.live")
      && mediaText.includes("playback playing")
      && mediaText.includes("size 640x480")
      && mediaText.includes("video fps ")
      && runtimePanelText.includes("aero.mediapipe.live")
      && screenPosePanelText.includes("aero.mediapipe.live")
      && !runtimePanelText.includes("aero.movenet.replay.basic-upper-body")
      && !screenPosePanelText.includes("aero.movenet.replay.basic-upper-body")
      && !runtimePanelText.includes("aero.camera.live.frame-sampler")
      && !screenPosePanelText.includes("aero.camera.live.frame-sampler")
      && previewVideo?.srcObject instanceof MediaStream
      && previewVideo.videoWidth > 0
      && previewVideo.videoHeight > 0
      && previewState?.sourceKind === "live-camera"
      && previewState?.sourceId === "aero.mediapipe.live"
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
    throw new Error("Live MediaPipe inference did not process multiple frames.");
  }
  if (secondLiveSample.poseFrameCount <= firstLiveSample.poseFrameCount) {
    throw new Error("Live CV service did not produce multiple pose frames.");
  }
  if (secondLiveSample.timestampMs <= firstLiveSample.timestampMs) {
    throw new Error("Live MediaPipe pose-frame timestamps did not advance.");
  }

  const initialCameraRequest = await page.evaluate(() => window.__aeroCameraRequests?.[0]);
  if (initialCameraRequest?.video?.deviceId?.exact !== "camera-rear") {
    throw new Error("Selected camera deviceId did not reach the initial getUserMedia request.");
  }
  if (initialCameraRequest?.video?.width !== undefined || initialCameraRequest?.video?.height !== undefined) {
    throw new Error("Direct downscale preset changed camera constraints instead of isolating inference resize.");
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
      && cameraText.includes("Camera permission: granted / live inference mediapipe/webgl / source live-camera")
      && cameraText.includes("CV preset Direct downscale 160")
      && inferenceText.includes("tracking fast")
      && /sample target 15fps effective \d+fps/u.test(inferenceText)
      && /pose output \d+fps/u.test(inferenceText)
      && /status updates \d+fps target 4fps/u.test(inferenceText)
      && /overlay renders \d+fps target 30fps/u.test(inferenceText);
  }, undefined, { timeout: 90000 });
  const restartCameraRequest = await page.evaluate(() => window.__aeroCameraRequests?.[1]);
  if (restartCameraRequest?.video?.deviceId?.exact !== "camera-front") {
    throw new Error("Selected camera deviceId did not reach the restarted getUserMedia request.");
  }
  if (restartCameraRequest?.video?.width !== undefined || restartCameraRequest?.video?.height !== undefined) {
    throw new Error("Direct downscale preset changed restarted camera constraints instead of isolating inference resize.");
  }

  const rapidSwitchControlState = await page.locator("aerobeat-app").evaluate((element) => {
    const root = element.shadowRoot;
    const backendSelect = root?.querySelector(".pose-backend-select")?.shadowRoot?.querySelector("select");
    const providerSelect = root?.querySelector(".pose-provider-select")?.shadowRoot?.querySelector("select");
    const tuningElement = root?.querySelector(".mediapipe-tuning-select");
    const tuningSelect = tuningElement?.shadowRoot?.querySelector("select");
    const performanceSelect = root?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
    if (!backendSelect || !providerSelect || !tuningSelect || !performanceSelect) {
      throw new Error("Pose backend/provider/tuning controls were unavailable for rapid-switch validation.");
    }
    const mediaPipeProviders = Array.from(providerSelect.options).map((option) => option.value);
    const mediaPipePresetCount = performanceSelect.options.length;
    const mediaPipeTuningEnabled = !tuningSelect.disabled;
    const mediaPipeTuningLabel = tuningElement?.getAttribute("label") ?? "";
    providerSelect.value = "cpu-wasm";
    providerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    tuningSelect.value = "responsive";
    tuningSelect.dispatchEvent(new Event("change", { bubbles: true }));
    providerSelect.value = "gpu-webgl";
    providerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    return { mediaPipeProviders, mediaPipePresetCount, mediaPipeTuningEnabled, mediaPipeTuningLabel };
  });
  if (
    rapidSwitchControlState.mediaPipePresetCount !== 8
    || rapidSwitchControlState.mediaPipeProviders.join(",") !== "gpu-webgl,cpu-wasm"
    || !rapidSwitchControlState.mediaPipeTuningEnabled
    || rapidSwitchControlState.mediaPipeTuningLabel !== "MediaPipe tuning"
  ) {
    throw new Error("MediaPipe controls did not expose the locked GPU default, CPU diagnostic, tuning, and worker presets.");
  }
  await page.waitForFunction(() => {
    const app = document.querySelector("aerobeat-app");
    const root = app?.shadowRoot;
    const backendValue = root?.querySelector(".pose-backend-select")?.shadowRoot?.querySelector("select")?.value;
    const providerValue = root?.querySelector(".pose-provider-select")?.shadowRoot?.querySelector("select")?.value;
    const tuningValue = root?.querySelector(".mediapipe-tuning-select")?.shadowRoot?.querySelector("select")?.value;
    const tuningDisabled = root?.querySelector(".mediapipe-tuning-select")?.shadowRoot?.querySelector("select")?.disabled;
    const timingProgress = root?.querySelector(".timing-window-progress")?.textContent ?? "";
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const url = new URL(window.location.href);
    return (window.__aeroCameraRequests?.length ?? 0) === 3
      && (window.__aeroStoppedCameraTracks ?? 0) === 2
      && backendValue === "mediapipe"
      && providerValue === "gpu-webgl"
      && tuningValue === "responsive"
      && !tuningDisabled
      && /Timing window [1-9]\d*\/120/u.test(timingProgress)
      && url.searchParams.get("poseBackend") === "mediapipe"
      && url.searchParams.get("poseProvider") === "gpu-webgl"
      && url.searchParams.get("mediaPipeTuning") === "responsive"
      && inferenceText.includes("CV running")
      && inferenceText.includes("backend requested mediapipe selected mediapipe effective mediapipe")
      && inferenceText.includes("provider requested gpu-webgl selected gpu-webgl actual webgl")
      && inferenceText.includes("MediaPipe tuning requested responsive selected responsive detection 0.5 presence 0.4 tracking 0.3")
      && /timing window \d+\/120 budget 67ms over \d+/u.test(inferenceText)
      && /prep p50 \d+ms p95 \d+ms max \d+ms/u.test(inferenceText)
      && /adapter p50 \d+ms p95 \d+ms max \d+ms/u.test(inferenceText)
      && inferenceText.includes("runtime p50 ")
      && inferenceText.includes("worker roundtrip p50 n/a p95 n/a max n/a")
      && /total p50 \d+ms p95 \d+ms max \d+ms/u.test(inferenceText)
      && /status updates \d+fps target 4fps/u.test(inferenceText)
      && /output age \d+ms/u.test(inferenceText);
  }, undefined, { timeout: 90000 });

  const liveStreamState = await page.evaluate(() => ({
    stoppedTracks: window.__aeroStoppedCameraTracks ?? 0,
    trackState: window.__aeroGrantedCameraTrack?.readyState ?? ""
  }));
  if (liveStreamState.stoppedTracks !== 2 || liveStreamState.trackState !== "live") {
    throw new Error("Restarted camera stream was not live before page teardown.");
  }

  await page.locator("aerobeat-app aero-button.telemetry-copy button").click();
  await page.waitForFunction((version) => {
    const app = document.querySelector("aerobeat-app");
    const root = app?.shadowRoot;
    const output = root?.querySelector(".telemetry-output");
    const status = root?.querySelector(".telemetry-capture-state")?.shadowRoot?.textContent ?? "";
    const snapshot = window.__aeroClipboardText ?? "";
    return output?.textContent === snapshot
      && status.includes("Copied telemetry snapshot")
      && snapshot.includes("AeroBeat telemetry snapshot")
      && snapshot.includes(`App version: ${version}`)
      && snapshot.includes("Build stamp:")
      && snapshot.includes("Cache token:")
      && snapshot.includes("Selected camera: Front camera (camera-front)")
      && snapshot.includes("Selected tracking profile: fast")
      && snapshot.includes("Requested pose backend: mediapipe")
      && snapshot.includes("Selected pose backend: mediapipe")
      && snapshot.includes("Effective pose backend: mediapipe")
      && snapshot.includes("Selected/effective vendor: mediapipe / mediapipe")
      && snapshot.includes("Requested/selected/actual provider: gpu-webgl / gpu-webgl / webgl")
      && snapshot.includes("Requested/selected MediaPipe tuning: responsive / responsive (applicable)")
      && snapshot.includes("MediaPipe thresholds detection/presence/tracking: 0.5 / 0.4 / 0.3 (applicable)")
      && snapshot.includes("Selection fallback: none")
      && snapshot.includes("Adapter fallback: false")
      && /Adapter load: \d+ms/u.test(snapshot)
      && /Adapter runtime inference: \d+ms/u.test(snapshot)
      && /Adapter postprocess: \d+ms/u.test(snapshot)
      && snapshot.includes("Selected CV preset: Direct downscale 160")
      && snapshot.includes("Execution location: main-thread")
      && snapshot.includes("Execution detail: MediaPipe Tasks Vision GPU delegate via synchronous WebGL / thresholds detection 0.5 presence 0.4 tracking 0.3")
      && snapshot.includes("Resize path: main-thread canvas")
      && snapshot.includes("Inference input: 160x120")
      && /Prep cost: \d+ms \(avg \d+ms\)/u.test(snapshot)
      && /Adapter cost: \d+ms \(avg \d+ms\)/u.test(snapshot)
      && /Total CV cost: \d+ms \(avg \d+ms\)/u.test(snapshot)
      && /Timing window: \d+\/120 \/ budget 67ms \/ over budget \d+/u.test(snapshot)
      && /Adapter rolling p50\/p95\/max: \d+ms \/ \d+ms \/ \d+ms/u.test(snapshot)
      && /Total CV rolling p50\/p95\/max: \d+ms \/ \d+ms \/ \d+ms/u.test(snapshot)
      && /Incomplete seven-point frames: \d+/u.test(snapshot)
      && snapshot.includes("Sampling mode: video-frame-callback")
      && /Sample\/submission rate: \d+fps \(target max 15fps\)/u.test(snapshot)
      && /Pose-output rate: \d+fps/u.test(snapshot)
      && /Status-update rate: \d+fps \(target max 4fps\)/u.test(snapshot)
      && /Overlay-render rate: \d+fps \(target max 30fps\)/u.test(snapshot)
      && /Submitted sample age: \d+ms/u.test(snapshot)
      && /Output age: \d+ms/u.test(snapshot)
      && /Overlay render age: \d+ms/u.test(snapshot)
      && /Status update age: \d+ms/u.test(snapshot)
      && snapshot.includes("Media-pose delta (measured freshness):")
      && snapshot.includes("Presentation-target delta:")
      && snapshot.includes("Requested/selected/effective pose gameplay source: measured / measured / measured")
      && snapshot.includes("Gameplay route lifecycle epoch/generation/resets:")
      && snapshot.includes("Oracle control joint error p50/p95/max/mean:")
      && snapshot.includes("Oracle treatment joint error p50/p95/max/mean:")
      && snapshot.includes("Oracle treatment-minus-control intent precision/recall/F1/timing/events/matched/FP/FN/false repeats:")
      && snapshot.includes("Oracle decision thresholds:")
      && snapshot.includes("Oracle prediction improves measured-8 control: false")
      && snapshot.includes("Oracle bounded recommendation (gameplay-input readiness only; no point-parity claim): prediction-does-not-improve-control")
      && snapshot.includes("Build panel: Version ")
      && snapshot.includes("Camera panel: Camera permission: granted / live inference mediapipe/webgl / source live-camera")
      && snapshot.includes("Media panel: Source live-camera aero.mediapipe.live / playback playing / size 640x480")
      && snapshot.includes("Inference panel: CV running / backend requested mediapipe selected mediapipe effective mediapipe")
      && snapshot.includes("Calibration panel: Calibration active - align your shoulders in the rhythm field")
      && snapshot.includes("Secure context: ready")
      && snapshot.includes("Timestamp:")
      && snapshot.includes("Route URL:");
  }, expectedVersion);

  const snapshotText = await page.evaluate(() => window.__aeroClipboardText ?? "");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("aerobeat-app aero-button.telemetry-download button").click()
  ]);
  const downloadStream = await download.createReadStream();
  if (!downloadStream) {
    throw new Error("Telemetry download stream was not available.");
  }
  const downloadText = await streamToString(downloadStream);
  if (!snapshotText.includes("AeroBeat telemetry snapshot") || !downloadText.includes("AeroBeat telemetry snapshot")) {
    throw new Error("Telemetry copy/download did not produce snapshot text.");
  }
  for (const requiredLine of [
    `App version: ${expectedVersion}`,
    "Selected camera: Front camera (camera-front)",
    "Selected tracking profile: fast",
    "Requested pose backend: mediapipe",
    "Selected pose backend: mediapipe",
    "Effective pose backend: mediapipe",
    "Selected/effective vendor: mediapipe / mediapipe",
    "Selected model: mediapipe/",
    "Effective model: mediapipe/",
    "Requested/selected/actual provider: gpu-webgl / gpu-webgl / webgl",
    "Requested/selected MediaPipe tuning: responsive / responsive (applicable)",
    "MediaPipe thresholds detection/presence/tracking: 0.5 / 0.4 / 0.3 (applicable)",
    "Selection fallback: none",
    "Adapter fallback: false",
    "Adapter load:",
    "Adapter runtime inference:",
    "Adapter postprocess:",
    "Worker round trip:",
    "Selected CV preset: Direct downscale 160",
    "Execution location: main-thread",
    "Execution detail: MediaPipe Tasks Vision GPU delegate via synchronous WebGL / thresholds detection 0.5 presence 0.4 tracking 0.3",
    "Resize path: main-thread canvas",
    "Transfer frame type: n/a",
    "Inference input: 160x120",
    "Prep cost:",
    "Adapter cost:",
    "Total CV cost:",
    "Timing window:",
    "Prep rolling p50/p95/max:",
    "Adapter rolling p50/p95/max:",
    "Runtime rolling p50/p95/max:",
    "Worker round-trip rolling p50/p95/max:",
    "Total CV rolling p50/p95/max:",
    "Incomplete seven-point frames:",
    "Worker capture replacements / retired transferables:",
    "Sampling callback gap p50/p95/max/window:",
    "Sampling mode: video-frame-callback",
    "Sample/submission rate:",
    "Pose-output rate:",
    "Status-update rate:",
    "Overlay-render rate:",
    "Submitted sample age:",
    "Output age:",
    "Overlay render age:",
    "Status update age:",
    "Media-pose delta (measured freshness):",
    "Presentation-target delta:",
    "Requested/selected/effective pose gameplay source: measured / measured / measured",
    "Gameplay route lifecycle epoch/generation/resets:",
    "Routing suppressions duplicate measurement/superseded measurement/target/stale lifecycle/frozen:",
    "Oracle control draft-intent precision/recall/F1/timing/events/matched/FP/FN/false repeats:",
    "Oracle treatment draft-intent precision/recall/F1/timing/events/matched/FP/FN/false repeats:",
    "Oracle treatment-minus-control intent precision/recall/F1/timing/events/matched/FP/FN/false repeats:",
    "Oracle decision thresholds:",
    "Oracle prediction improves measured-8 control:",
    "Oracle bounded recommendation (gameplay-input readiness only; no point-parity claim):",
    "Camera panel: Camera permission: granted / live inference mediapipe/webgl / source live-camera",
    "Media panel: Source live-camera aero.mediapipe.live / playback playing / size 640x480",
    "Inference panel: CV running / backend requested mediapipe selected mediapipe effective mediapipe",
    "Calibration panel: Calibration active - align your shoulders in the rhythm field",
    "Secure context: ready",
    "Route URL:"
  ]) {
    if (!downloadText.includes(requiredLine)) {
      throw new Error(`Downloaded telemetry snapshot omitted required line: ${requiredLine}`);
    }
  }
  if (!download.suggestedFilename().startsWith("aerobeat-telemetry-")) {
    throw new Error("Telemetry download filename did not use the expected prefix.");
  }

  const immediateObjectUrlState = await page.evaluate(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    return {
      created: window.__aeroCreatedObjectUrls ?? [],
      revoked: window.__aeroRevokedObjectUrls ?? []
    };
  });
  if (immediateObjectUrlState.created.length !== 1 || immediateObjectUrlState.revoked.length !== 0) {
    throw new Error("Telemetry object URL was not retained beyond the immediate task for mobile download handoff.");
  }

  const teardownState = await page.evaluate(() => {
    document.querySelector("aerobeat-app")?.remove();
    return {
      stoppedTracks: window.__aeroStoppedCameraTracks ?? 0,
      trackState: window.__aeroGrantedCameraTrack?.readyState ?? "",
      createdObjectUrls: window.__aeroCreatedObjectUrls ?? [],
      revokedObjectUrls: window.__aeroRevokedObjectUrls ?? []
    };
  });
  if (teardownState.stoppedTracks !== 3 || teardownState.trackState !== "ended") {
    throw new Error("Granted camera stream was not released when the app left the page.");
  }
  if (teardownState.createdObjectUrls.length !== 1 || teardownState.revokedObjectUrls.length !== 1) {
    throw new Error("Retained telemetry object URL was not cleaned up during app teardown.");
  }

  await page.goto(`${url}?poseBackend=mediapipe&poseProvider=gpu-webgl`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const backend = root?.querySelector(".pose-backend-select")?.shadowRoot?.querySelector("select");
    const provider = root?.querySelector(".pose-provider-select")?.shadowRoot?.querySelector("select");
    const performance = root?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    return backend?.value === "mediapipe"
      && provider?.value === "gpu-webgl"
      && provider.options.length === 2
      && performance?.options.length === 8
      && inferenceText.includes("backend requested mediapipe selected mediapipe effective mediapipe")
      && inferenceText.includes("provider requested gpu-webgl selected gpu-webgl actual unknown")
      && inferenceText.includes("selection accepted");
  });

  for (const [historicalBackend, historicalProvider] of [
    ["movenet", "webgl"],
    ["onnxruntime", "webgpu"]
  ]) {
    await page.goto(`${url}?poseBackend=${historicalBackend}&poseProvider=${historicalProvider}`, { waitUntil: "networkidle" });
    await page.waitForFunction(({ requestedBackend, requestedProvider }) => {
      const root = document.querySelector("aerobeat-app")?.shadowRoot;
      const backend = root?.querySelector(".pose-backend-select")?.shadowRoot?.querySelector("select");
      const provider = root?.querySelector(".pose-provider-select")?.shadowRoot?.querySelector("select");
      const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
      return backend?.value === "mediapipe"
        && provider?.value === "gpu-webgl"
        && backend.options.length === 1
        && provider.options.length === 2
        && inferenceText.includes(`backend requested ${requestedBackend} selected mediapipe effective mediapipe`)
        && inferenceText.includes(`provider requested ${requestedProvider} selected gpu-webgl actual unknown`)
        && inferenceText.includes(`unsupported backend ${requestedBackend}; using mediapipe`)
        && inferenceText.includes(`unsupported provider ${requestedProvider} for mediapipe; using gpu-webgl`);
    }, { requestedBackend: historicalBackend, requestedProvider: historicalProvider });
    await page.locator("aerobeat-app aero-button.telemetry-copy button").click();
    const normalizedSnapshot = await page.evaluate(() => window.__aeroClipboardText ?? "");
    for (const requiredLine of [
      `Requested pose backend: ${historicalBackend}`,
      "Selected pose backend: mediapipe",
      "Effective pose backend: mediapipe",
      `Requested/selected/actual provider: ${historicalProvider} / gpu-webgl / unknown`,
      `Selection fallback: unsupported backend ${historicalBackend}; using mediapipe`,
      "Selected CV preset: Direct full (recommended)",
      "Selected tracking profile: fast",
      "Requested/selected/effective pose gameplay source: measured / measured / measured"
    ]) {
      if (!normalizedSnapshot.includes(requiredLine)) {
        throw new Error(`Historical normalization telemetry omitted ${requiredLine}`);
      }
    }
  }

  await page.goto(`${url}?poseBackend=mediapipe&poseProvider=gpu-webgl&mediaPipeTuning=responsive`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const tuning = root?.querySelector(".mediapipe-tuning-select")?.shadowRoot?.querySelector("select");
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    return tuning?.value === "responsive"
      && !tuning.disabled
      && inferenceText.includes("provider requested gpu-webgl selected gpu-webgl actual unknown")
      && inferenceText.includes("MediaPipe tuning requested responsive selected responsive detection 0.5 presence 0.4 tracking 0.3")
      && inferenceText.includes("thresholds detection 0.5 presence 0.4 tracking 0.3");
  });
  await page.locator("aerobeat-app aero-button.telemetry-copy button").click();
  const responsiveSnapshot = await page.evaluate(() => window.__aeroClipboardText ?? "");
  for (const requiredLine of [
    "Requested/selected MediaPipe tuning: responsive / responsive (applicable)",
    "MediaPipe thresholds detection/presence/tracking: 0.5 / 0.4 / 0.3 (applicable)",
    "Execution detail: MediaPipe Tasks Vision GPU delegate via synchronous WebGL / thresholds detection 0.5 presence 0.4 tracking 0.3",
    "Adapter runtime inference: n/a",
    "Adapter postprocess: n/a",
    "Timing window: 0/120 / budget 67ms / over budget 0",
    "Incomplete seven-point frames: 0"
  ]) {
    if (!responsiveSnapshot.includes(requiredLine)) {
      throw new Error(`Responsive MediaPipe telemetry omitted ${requiredLine}`);
    }
  }

  await page.goto(`${url}?poseBackend=mediapipe&poseProvider=gpu-webgl&poseGameplaySource=predicted-8`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const select = root?.querySelector(".pose-gameplay-source-select")?.shadowRoot?.querySelector("select");
    const route = new URL(window.location.href);
    return select?.value === "predicted-8"
      && Array.from(select.options).map((option) => option.value).join(",") === "measured,measured-8,predicted-8"
      && route.searchParams.get("poseGameplaySource") === "predicted-8";
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const select = document.querySelector("aerobeat-app")?.shadowRoot
      ?.querySelector(".pose-gameplay-source-select")?.shadowRoot?.querySelector("select");
    return select?.value === "predicted-8"
      && new URL(window.location.href).searchParams.get("poseGameplaySource") === "predicted-8";
  });

  await page.goto(`${url}?poseBackend=movenet&poseProvider=webgl&poseGameplaySource=predicted-8`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const select = root?.querySelector(".pose-gameplay-source-select")?.shadowRoot?.querySelector("select");
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const route = new URL(window.location.href);
    return select?.value === "predicted-8"
      && select.options.length === 3
      && route.searchParams.get("poseBackend") === "movenet"
      && route.searchParams.get("poseGameplaySource") === "predicted-8"
      && inferenceText.includes("backend requested movenet selected mediapipe effective mediapipe")
      && inferenceText.includes("unsupported backend movenet; using mediapipe");
  });

  await page.goto(`${url}?poseBackend=invalid&poseProvider=webgpu&mediaPipeTuning=reckless`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const backend = root?.querySelector(".pose-backend-select")?.shadowRoot?.querySelector("select");
    const provider = root?.querySelector(".pose-provider-select")?.shadowRoot?.querySelector("select");
    const tuning = root?.querySelector(".mediapipe-tuning-select")?.shadowRoot?.querySelector("select");
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const route = new URL(window.location.href);
    return backend?.value === "mediapipe"
      && provider?.value === "gpu-webgl"
      && tuning?.value === "standard"
      && !tuning.disabled
      && route.searchParams.get("poseBackend") === "invalid"
      && inferenceText.includes("backend requested invalid selected mediapipe effective mediapipe")
      && inferenceText.includes("provider requested webgpu selected gpu-webgl actual unknown")
      && inferenceText.includes("MediaPipe tuning requested reckless selected standard detection 0.5 presence 0.5 tracking 0.5")
      && inferenceText.includes("unsupported backend invalid; using mediapipe")
      && inferenceText.includes("unsupported provider webgpu for mediapipe; using gpu-webgl")
      && inferenceText.includes("unsupported MediaPipe tuning reckless; using standard");
  });

  const noRvfcPage = await browser.newPage();
  await noRvfcPage.addInitScript(() => {
    Object.defineProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback", {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback", {
      configurable: true,
      value: undefined
    });
  });
  await noRvfcPage.goto(`${url}?poseBackend=mediapipe&poseProvider=cpu-wasm`, { waitUntil: "networkidle" });
  await noRvfcPage.waitForFunction(() => {
    const select = document.querySelector("aerobeat-app")?.shadowRoot
      ?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
    return Boolean(select && select.options.length > 0);
  });
  const noRvfcOptions = await noRvfcPage.locator("aerobeat-app").evaluate((element) => {
    const select = element.shadowRoot?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
    return Array.from(select?.options ?? []).map((option) => option.value);
  });
  if (noRvfcOptions.includes("experimental-worker-videoframe")) {
    throw new Error("VideoFrame worker preset remained selectable without rVFC support.");
  }
  await noRvfcPage.close();
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
 * @param {import("node:stream").Readable} stream
 * @returns {Promise<string>}
 */
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

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
  return text === "No available adapters."
    || (text.includes("GL Driver Message")
      && text.includes("GPU stall due to ReadPixels"))
    || (text.includes("gl_context.cc:1119")
      && text.includes("OpenGL error checking is disabled"));
}
