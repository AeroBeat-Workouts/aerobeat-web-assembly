// @ts-check

import { chromium } from "playwright";
import { createServer } from "vite";

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

  if (!visibleMetadata.includes("0.0.1")) {
    throw new Error("Visible release proof version 0.0.1 was not rendered.");
  }
  if (!visibleMetadata.includes("Cache")) {
    throw new Error("Visible cache-bust metadata was not rendered.");
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
