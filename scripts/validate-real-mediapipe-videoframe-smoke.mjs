import { chromium } from "playwright";

const baseUrl = process.env.AEROBEAT_SMOKE_URL ?? "http://127.0.0.1:5173/";
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const provider of ["cpu-wasm", "gpu-webgl"]) {
    const page = await browser.newPage({ viewport: { width: 432, height: 865 } });
    const failures = [];
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("Created TensorFlow Lite XNNPACK delegate for CPU")) {
        failures.push(`console: ${message.text()}`);
      }
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          async enumerateDevices() { return []; },
          async getUserMedia() {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const context = canvas.getContext("2d");
            let frame = 0;
            const draw = () => {
              frame += 1;
              context.fillStyle = `rgb(${frame % 255}, ${(frame * 3) % 255}, 120)`;
              context.fillRect(0, 0, canvas.width, canvas.height);
              context.fillStyle = "white";
              context.fillRect(220 + Math.sin(frame / 8) * 80, 80, 140, 320);
              requestAnimationFrame(draw);
            };
            draw();
            return canvas.captureStream(30);
          }
        }
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { async writeText(text) { window.__videoFrameSmokeTelemetry = text; } }
      });
    });
    await page.goto(`${baseUrl}?poseBackend=mediapipe&poseProvider=${provider}`, {
      waitUntil: "networkidle",
      timeout: 120_000
    });
    await page.waitForFunction(() => typeof VideoFrame === "function");
    await page.locator("aerobeat-app").evaluate((element) => {
      const select = element.shadowRoot?.querySelector(".cv-performance-select")?.shadowRoot?.querySelector("select");
      if (!select || !Array.from(select.options).some((option) => option.value === "experimental-worker-videoframe")) {
        throw new Error("MediaPipe VideoFrame preset is unavailable");
      }
      select.value = "experimental-worker-videoframe";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForFunction(() => {
      const root = document.querySelector("aerobeat-app")?.shadowRoot;
      const text = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
      return text.includes("preset Experimental worker transferable VideoFrame");
    }, undefined, { timeout: 30_000 });
    await page.locator("aerobeat-app aero-button.calibration-entrypoint button").click();
    await page.waitForFunction((selectedProvider) => {
      const root = document.querySelector("aerobeat-app")?.shadowRoot;
      const text = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
      const actualProvider = selectedProvider === "cpu-wasm" ? "wasm" : "webgl";
      return text.includes("execution worker")
        && text.includes(`actual ${actualProvider}`)
        && text.includes("transfer VideoFrame")
        && /timing window ([1-9]|[1-9]\\d|1[01]\\d|120)\/120/u.test(text);
    }, provider, { timeout: 240_000 });
    const evidence = await page.locator("aerobeat-app").evaluate((element) => {
      const root = element.shadowRoot;
      const inferenceText = root?.querySelector(".inference-state")?.shadowRoot?.textContent ?? "";
      root?.querySelector(".telemetry-copy")?.shadowRoot?.querySelector("button")?.click();
      return { inferenceText, videoFrameSupported: typeof VideoFrame === "function" };
    });
    await page.waitForTimeout(100);
    const telemetry = await page.evaluate(() => window.__videoFrameSmokeTelemetry ?? "");
    if (!telemetry.includes("Transfer frame type: VideoFrame")) failures.push("telemetry omitted VideoFrame transfer truth");
    if (!telemetry.includes("Resize path: direct HTMLVideoElement to transferable VideoFrame")) failures.push("telemetry omitted direct VideoFrame path");
    if (failures.length) throw new Error(`${provider} smoke failed: ${failures.join(" | ")}`);
    results.push({ provider, ...evidence, telemetry });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
