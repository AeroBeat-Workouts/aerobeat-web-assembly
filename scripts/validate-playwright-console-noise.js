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
  server: { host: "127.0.0.1", port: 0 }
});
await server.listen();
const url = server.resolvedUrls?.local?.[0];
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
  const desktopPage = await createTestPage(browser, { width: 1280, height: 900 }, consoleNoise, pageErrors);
  await assertOneButtonScene(desktopPage, url, "desktop");
  await desktopPage.close();

  const page = await createTestPage(browser, { width: 390, height: 844 }, consoleNoise, pageErrors);
  await assertOneButtonScene(page, url, "phone");

  await page.goto(`${url}?poseBackend=movenet&poseProvider=webgl&mediaPipeTuning=reckless`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    return inferenceText.includes("backend requested movenet selected mediapipe effective mediapipe")
      && inferenceText.includes("provider requested webgl selected gpu-webgl actual unknown")
      && inferenceText.includes("MediaPipe tuning requested reckless selected standard detection 0.5 presence 0.5 tracking 0.5")
      && inferenceText.includes("unsupported backend movenet; using mediapipe")
      && inferenceText.includes("unsupported provider webgl for mediapipe; using gpu-webgl")
      && inferenceText.includes("unsupported MediaPipe tuning reckless; using standard");
  });
  await assertNoSelectorSurface(page);
  await page.locator("aerobeat-app aero-button.telemetry-copy button").click();
  const normalizedTelemetry = await page.evaluate(() => window.__aeroClipboardText ?? "");
  for (const line of [
    "Requested pose backend: movenet",
    "Selected pose backend: mediapipe",
    "Requested/selected/actual provider: webgl / gpu-webgl / unknown",
    "Requested/selected MediaPipe tuning: reckless / standard (applicable)",
    "Selection fallback: unsupported backend movenet; using mediapipe"
  ]) {
    if (!normalizedTelemetry.includes(line)) {
      throw new Error(`Query normalization telemetry omitted: ${line}`);
    }
  }

  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("aerobeat-app").waitFor({ state: "attached" });
  const buildText = await page.locator("aerobeat-app").evaluate((element) => (
    element.shadowRoot?.querySelector('aero-status-panel[heading="Build"]')?.shadowRoot?.textContent ?? ""
  ));
  if (!buildText.includes(expectedVersion) || !buildText.includes("Build") || !buildText.includes("/")) {
    throw new Error("Visible version/build/cache proof was incomplete.");
  }

  await page.waitForFunction(() => {
    const app = document.querySelector("aerobeat-app");
    const panel = app?.shadowRoot?.querySelector("aero-pose-flow-panel");
    const preview = app?.shadowRoot?.querySelector("aero-media-pose-preview");
    return (panel?.shadowRoot?.textContent ?? "").includes("aero.movenet.replay.basic-upper-body")
      && (preview?.describePreview?.()?.rendererDrawCount ?? 0) > 0;
  });

  await page.locator("aerobeat-app aero-button.calibration-entrypoint button").click();
  await page.waitForFunction(() => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const preview = root?.querySelector("aero-media-pose-preview");
    const video = preview?.shadowRoot?.querySelector("video");
    const previewState = preview?.describePreview?.();
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const cameraText = root?.querySelector(".camera-permission-state")?.shadowRoot?.textContent ?? "";
    const mediaText = root?.querySelector(".media-state")?.shadowRoot?.textContent ?? "";
    const calibrationText = root?.querySelector(".calibration-state")?.shadowRoot?.textContent ?? "";
    const progress = root?.querySelector(".timing-window-progress")?.textContent ?? "";
    const hiddenCommand = root?.querySelector("aero-calibration-screen")?.shadowRoot
      ?.querySelector("aero-button")?.shadowRoot?.querySelector("button");
    return (window.__aeroCameraRequests?.length ?? 0) === 1
      && (window.__aeroStoppedCameraTracks ?? 0) === 0
      && window.__aeroGrantedCameraTrack?.readyState === "live"
      && calibrationText.includes("Calibration active")
      && cameraText.includes("Camera permission: granted / live inference mediapipe/webgl / source live-camera")
      && cameraText.includes("CV preset Direct full (recommended)")
      && mediaText.includes("Source live-camera aero.mediapipe.live / playback playing / size 640x480")
      && inferenceText.includes("CV running")
      && inferenceText.includes("backend requested mediapipe selected mediapipe effective mediapipe")
      && inferenceText.includes("provider requested gpu-webgl selected gpu-webgl actual webgl")
      && inferenceText.includes("MediaPipe tuning requested standard selected standard detection 0.5 presence 0.5 tracking 0.5")
      && inferenceText.includes("preset Direct full (recommended) (main thread / camera default / full input / no resize)")
      && inferenceText.includes("execution main-thread MediaPipe Tasks Vision GPU delegate via synchronous WebGL")
      && inferenceText.includes("resize none")
      && inferenceText.includes("model ready")
      && inferenceText.includes("source live-camera aero.mediapipe.live")
      && inferenceText.includes("input 640x480")
      && inferenceText.includes("tracking fast")
      && /sample target 15fps effective \d+fps/u.test(inferenceText)
      && /Timing window \d+\/120/u.test(progress)
      && video?.srcObject instanceof MediaStream
      && video.videoWidth > 0
      && video.videoHeight > 0
      && previewState?.sourceKind === "live-camera"
      && previewState?.sourceId === "aero.mediapipe.live"
      && previewState?.trackingProfile === "fast"
      && (previewState?.rendererDrawCount ?? 0) > 0
      && hiddenCommand?.getClientRects().length === 0;
  }, undefined, { timeout: 90000 });

  const cameraRequest = await page.evaluate(() => window.__aeroCameraRequests?.[0]);
  if (cameraRequest?.audio !== false || cameraRequest?.video?.facingMode !== "user") {
    throw new Error("One-button startup did not request the default user-facing camera.");
  }
  if (cameraRequest?.video?.deviceId !== undefined || cameraRequest?.video?.width !== undefined || cameraRequest?.video?.height !== undefined) {
    throw new Error("Locked Direct-full startup unexpectedly customized camera device or dimensions.");
  }

  const firstSample = await readLiveInferenceSnapshot(page);
  await page.waitForFunction((previous) => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const panel = root?.querySelector("aero-pose-flow-panel");
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const inferenceFrames = Number.parseInt(/inference frames (?<count>\d+)/u.exec(inferenceText)?.groups?.count ?? "0", 10);
    return inferenceFrames >= 2 && (panel?.state?.poseFrame?.timestampMs ?? 0) > previous;
  }, firstSample.timestampMs, { timeout: 90000 });
  const secondSample = await readLiveInferenceSnapshot(page);
  if (secondSample.inferenceFrameCount <= firstSample.inferenceFrameCount || secondSample.timestampMs <= firstSample.timestampMs) {
    throw new Error("Live MediaPipe CV did not advance after direct button startup.");
  }

  await page.locator("aerobeat-app aero-button.telemetry-copy button").click();
  await page.waitForFunction((version) => {
    const root = document.querySelector("aerobeat-app")?.shadowRoot;
    const output = root?.querySelector(".telemetry-output")?.textContent ?? "";
    const snapshot = window.__aeroClipboardText ?? "";
    return output === snapshot
      && snapshot.includes(`App version: ${version}`)
      && snapshot.includes("Selected camera: Default camera")
      && snapshot.includes("Selected tracking profile: fast")
      && snapshot.includes("Requested pose backend: mediapipe")
      && snapshot.includes("Selected pose backend: mediapipe")
      && snapshot.includes("Requested/selected/actual provider: gpu-webgl / gpu-webgl / webgl")
      && snapshot.includes("Requested/selected MediaPipe tuning: standard / standard (applicable)")
      && snapshot.includes("MediaPipe thresholds detection/presence/tracking: 0.5 / 0.5 / 0.5 (applicable)")
      && snapshot.includes("Selected CV preset: Direct full (recommended)")
      && snapshot.includes("Execution location: main-thread")
      && snapshot.includes("Resize path: none")
      && snapshot.includes("Inference input: 640x480")
      && snapshot.includes("Requested/selected/effective pose gameplay source: measured / measured / measured")
      && snapshot.includes("Camera panel: Camera permission: granted / live inference mediapipe/webgl / source live-camera")
      && snapshot.includes("Calibration panel: Calibration active")
      && snapshot.includes("Timing window:");
  }, expectedVersion, { timeout: 90000 });

  const copiedSnapshot = await page.evaluate(() => window.__aeroClipboardText ?? "");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("aerobeat-app aero-button.telemetry-download button").click()
  ]);
  const downloadStream = await download.createReadStream();
  if (!downloadStream) {
    throw new Error("Telemetry download stream was unavailable.");
  }
  const downloadedSnapshot = await streamToString(downloadStream);
  if (
    !copiedSnapshot.includes("AeroBeat telemetry snapshot")
    || !downloadedSnapshot.includes("AeroBeat telemetry snapshot")
    || !downloadedSnapshot.includes("Selected CV preset: Direct full (recommended)")
    || !downloadedSnapshot.includes("Requested/selected MediaPipe tuning: standard / standard (applicable)")
    || !download.suggestedFilename().startsWith("aerobeat-telemetry-")
  ) {
    throw new Error("Telemetry copy/download output was incomplete.");
  }

  const teardown = await page.evaluate(() => {
    document.querySelector("aerobeat-app")?.remove();
    return {
      stoppedTracks: window.__aeroStoppedCameraTracks ?? 0,
      trackState: window.__aeroGrantedCameraTrack?.readyState ?? ""
    };
  });
  if (teardown.stoppedTracks !== 1 || teardown.trackState !== "ended") {
    throw new Error("Live stream was not released during app teardown.");
  }
  await page.close();
} finally {
  await browser.close();
  await server.close();
}

if (pageErrors.length > 0 || consoleNoise.length > 0) {
  throw new Error([...pageErrors, ...consoleNoise].join("\n"));
}

console.log(`Playwright one-button camera/CV check passed at ${url}`);

/**
 * @param {import("playwright").Browser} browser
 * @param {{ width: number, height: number }} viewport
 * @param {string[]} consoleNoise
 * @param {string[]} pageErrors
 */
async function createTestPage(browser, viewport, consoleNoise, pageErrors) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(fakeBrowserMedia);
  page.on("console", (message) => {
    if ((message.type() === "warning" || message.type() === "error") && !isExpectedConsoleWarning(message.text())) {
      consoleNoise.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return page;
}

function fakeBrowserMedia() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      async enumerateDevices() {
        return [{ kind: "videoinput", deviceId: "camera-front", label: "Front camera", groupId: "front" }];
      },
      async getUserMedia(constraints) {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Fake camera canvas context unavailable.");
        let frame = 0;
        const draw = () => {
          frame += 1;
          context.fillStyle = `rgb(${(frame * 17) % 255}, ${(frame * 29) % 255}, 180)`;
          context.fillRect(0, 0, canvas.width, canvas.height);
          requestAnimationFrame(draw);
        };
        draw();
        const stream = canvas.captureStream(30);
        const track = stream.getVideoTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => {
          window.__aeroStoppedCameraTracks = (window.__aeroStoppedCameraTracks ?? 0) + 1;
          stop();
        };
        window.__aeroCameraRequests = [...(window.__aeroCameraRequests ?? []), constraints];
        window.__aeroGrantedCameraTrack = track;
        return stream;
      }
    }
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { async writeText(text) { window.__aeroClipboardText = text; } }
  });
}

/**
 * @param {import("playwright").Page} page
 * @param {string} url
 * @param {string} viewportName
 */
async function assertOneButtonScene(page, url, viewportName) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("aerobeat-app").waitFor({ state: "attached" });
  const scene = await page.locator("aerobeat-app").evaluate((element) => {
    const root = element.shadowRoot;
    const primary = root?.querySelector("aero-button.calibration-entrypoint")?.shadowRoot?.querySelector("button");
    const reusable = root?.querySelector("aero-calibration-screen")?.shadowRoot
      ?.querySelector("aero-button")?.shadowRoot?.querySelector("button");
    const bounds = primary?.getBoundingClientRect();
    const legacyClasses = [
      ".calibration-options", ".calibration-options-content", ".test-controls",
      ".pose-backend-select", ".pose-provider-select", ".mediapipe-tuning-select",
      ".camera-device-select", ".tracking-speed-select", ".pose-gameplay-source-select",
      ".cv-performance-select"
    ];
    return {
      details: root?.querySelectorAll("details").length ?? -1,
      summaries: root?.querySelectorAll("summary").length ?? -1,
      aeroSelects: root?.querySelectorAll("aero-select").length ?? -1,
      legacyClasses: legacyClasses.filter((selector) => root?.querySelector(selector)),
      primaryLabel: primary?.textContent ?? "",
      primaryType: primary?.getAttribute("type") ?? "",
      primaryVisible: Boolean(primary?.getClientRects().length),
      reusableVisible: Boolean(reusable?.getClientRects().length),
      visibleSetupActions: [primary, reusable].filter((button) => button?.getClientRects().length).length,
      bounds: bounds ? { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left } : undefined,
      viewport: { width: innerWidth, height: innerHeight },
      progress: root?.querySelector(".timing-window-progress")?.textContent ?? "",
      telemetryActions: root?.querySelectorAll(".telemetry-actions aero-button").length ?? -1
    };
  });
  if (
    scene.details !== 0 || scene.summaries !== 0 || scene.aeroSelects !== 0 || scene.legacyClasses.length > 0
    || scene.primaryType !== "button" || !scene.primaryLabel.includes("Begin calibration")
    || !scene.primaryVisible || scene.reusableVisible || scene.visibleSetupActions !== 1
    || scene.progress !== "Timing window 0/120" || scene.telemetryActions !== 2
    || !scene.bounds || scene.bounds.top < 0 || scene.bounds.left < 0
    || scene.bounds.right > scene.viewport.width || scene.bounds.bottom > scene.viewport.height
  ) {
    throw new Error(`${viewportName} one-button first-viewport contract failed: ${JSON.stringify(scene)}`);
  }
}

/** @param {import("playwright").Page} page */
async function assertNoSelectorSurface(page) {
  const deadSurface = await page.locator("aerobeat-app").evaluate((element) => {
    const root = element.shadowRoot;
    return root?.querySelector("details, summary, aero-select, .calibration-options, .test-controls, [class$='-select']")?.outerHTML ?? "";
  });
  if (deadSurface) throw new Error(`Dead selector UI resurfaced: ${deadSurface}`);
}

/** @param {import("playwright").Page} page */
async function readLiveInferenceSnapshot(page) {
  return page.locator("aerobeat-app").evaluate((element) => {
    const root = element.shadowRoot;
    const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
    const frame = root?.querySelector("aero-pose-flow-panel")?.state?.poseFrame;
    return {
      inferenceFrameCount: Number.parseInt(/inference frames (?<count>\d+)/u.exec(inferenceText)?.groups?.count ?? "0", 10),
      timestampMs: frame?.timestampMs ?? 0
    };
  });
}

/** @param {import("node:stream").Readable} stream */
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

/** @param {string} text */
function isExpectedConsoleWarning(text) {
  return text.includes("TensorFlow Lite XNNPACK delegate for CPU")
    || text.includes("GL version: 2.0")
    || text.includes("Created TensorFlow Lite XNNPACK delegate")
    || text.includes("Graph successfully started running")
    || text.includes("GPU stall due to ReadPixels")
    || text.includes("OpenGL error checking is disabled");
}
