// @ts-check
// 0.0.63 C5 (bead 376l, final piece of L-C): browser oracle for the Test-mode
// equipment config panel. Plan: .plans/2026-09-21-0.0.63-playtest-feedback-
// 0.0.62-retest-successor.md (L-C design, D2).
//
// The panel is part of the assembly shell `aero-game` — it rides in the same
// Visual Test authoring surface as the environment + test-presentation
// controls and MUST NOT be usable outside a visual_test session with the menu
// closed. This oracle drives a real app boot in headless Chromium (audio-only
// by design — no camera):
//
//   (a) idle (non-test) state — panel present in markup but hidden/disabled;
//       describeEquipmentConfig() === the baked defaults; getSnapshot() omits
//       any equipment-config truth;
//   (b) a REAL Flow visual_test session booted through the public start path
//       (the service-graph factory override mirrors validate-mobile-gameplay-
//       menu.js); once the menu closes, the authoring surface becomes enabled;
//   (c) panel visible/enabled + textarea preloaded with the canonical
//       serialized defaults (byte-for-byte);
//   (d) LIVE validation on input — invalid text surfaces the error without
//       mutating describeEquipmentConfig(); valid text shows the indicator;
//   (e) APPLY commits only when valid — an invalid edit leaves the live
//       config unchanged, a valid edit changes it observably;
//   (f) EXPORT triggers a Playwright download event named
//       aerobeat-equipment-config.yaml whose bytes re-parse as YAML; invalid
//       content refuses to export;
//   (g) RESET restores the baked defaults into state + textarea.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const HARD_TIMEOUT_MS = 90_000;
let closing = false;
let browser;
let vite;
const cleanup = async () => { if (closing) return; closing = true; await Promise.allSettled([browser?.close(), vite?.close()]); };
const hardTimeout = setTimeout(() => { console.error(`Equipment config panel browser validator exceeded ${HARD_TIMEOUT_MS} ms`); void cleanup().finally(() => process.exit(124)); }, HARD_TIMEOUT_MS);

try {
  // Canonical serialized defaults — computed in node exactly like the app at
  // build time so the expected string is byte-stable across runs.
  const [configModule, defaultsModule] = await Promise.all([import("../src/equipment-config.js"), import("../src/equipment-config-defaults.js")]);
  const expectedDefaultsYaml = configModule.serializeEquipmentConfigYaml(configModule.validateEquipmentConfig(defaultsModule.equipmentConfigDefaults));
  const expectedDefaultsJson = JSON.stringify(configModule.validateEquipmentConfig(defaultsModule.equipmentConfigDefaults));

  vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
  await vite.listen();
  const childUrl = vite.resolvedUrls?.local?.[0];
  assert.ok(childUrl, "Vite URL unavailable");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  context.setDefaultTimeout(10_000);
  const page = await context.newPage();
  const noise = [];
  page.on("console", (message) => { const type = message.type(), text = message.text(), location = message.location(); if (["warning", "error"].includes(type) && !isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, childUrl) && !isExpectedPlaycanvasMeshWarning(type, text)) noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:line=${location.lineNumber}:col=${location.columnNumber}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));

  await page.goto(childUrl, { waitUntil: "networkidle" });
  const game = page.locator("aero-game");
  await game.waitFor();

  // ---------- (a) idle: panel hidden + disabled; accessor + snapshot clean ----------
  const idleEvidence = await game.evaluate((element, defaultsJson) => {
    const root = element.shadowRoot;
    const panel = root.querySelector("aside[data-role='debug-camera-controls']");
    const section = root.querySelector(".equipment-authoring");
    const textarea = root.querySelector("[data-equipment-config-field='yaml']");
    const buttons = [...root.querySelectorAll("button[data-equipment-config-action]")].map((b) => ({ action: b.dataset.action, disabled: b.disabled }));
    const snapshotJson = JSON.stringify(element.getSnapshot());
    return {
      panelHidden: panel instanceof HTMLElement && panel.hidden === true,
      panelAriaHidden: panel?.getAttribute("aria-hidden") === "true",
      sectionLabel: section?.querySelector("legend")?.textContent ?? null,
      textareaValue: textarea instanceof HTMLTextAreaElement ? textarea.value : null,
      buttons,
      snapshotLeak: /equipmentConfig|equipment_config|rotationZDeg|upcomingBeatWindowMs/u.test(snapshotJson),
      describeEqualsDefaults: JSON.stringify(element.describeEquipmentConfig()) === defaultsJson,
    };
  }, expectedDefaultsJson);
  assert.equal(idleEvidence.panelHidden, true, "authoring panel must be hidden outside Visual Test");
  assert.equal(idleEvidence.panelAriaHidden, true, "panel must be aria-hidden outside Visual Test");
  assert.equal(idleEvidence.sectionLabel, "Equipment config", "section legend correct even while hidden");
  assert.equal(idleEvidence.textareaValue, "", "textarea empty until first enabled render");
  assert.deepEqual(idleEvidence.buttons.map((b) => b.action), ["equipment-config-apply", "equipment-config-reset", "equipment-config-export"]);
  assert.deepEqual(idleEvidence.buttons.map((b) => b.disabled), [true, true, true], "buttons disabled while gated off");
  assert.equal(idleEvidence.snapshotLeak, false, "public snapshot must not leak equipment config truth");
  assert.equal(idleEvidence.describeEqualsDefaults, true, "describeEquipmentConfig must equal frozen build defaults at idle");
  console.log("PASS: (a) idle — panel hidden/disabled, accessor === defaults, snapshot clean");

  // ---------- (b) boot a REAL Flow visual_test session ----------
  await game.evaluate((element) => {
    const originalFactory = element.serviceGraphFactory;
    element.remove();
    element.serviceGraphFactory = (options) => {
      const original = originalFactory(options);
      const hash = "a".repeat(64);
      const variant = { variantId: "c5-panel-flow", chartId: "c5-panel-flow-chart", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: false, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, provenance: { baseVariantId: "c5-panel-flow" } };
      const readyContent = () => ({ state: "ready", packageId: "c5-panel", selectedVariant: variant, variants: [variant], resolvedEvents: [], song: { name: "c5-panel", durationSec: 60 }, background: null, lineage: null });
      const state = globalThis.__c5State = { contentSnapshot: readyContent(), listeners: new Set() };
      const content = {
        getSnapshot: () => state.contentSnapshot,
        loadPersistenceHandle: async () => { state.contentSnapshot = readyContent(); },
        selectVariant: async () => {},
        swapFutureVariant: async () => {},
        subscribe(listener) { state.listeners.add(listener); listener(state.contentSnapshot); return () => state.listeners.delete(listener); },
        setPlaybackState(playback) { state.contentSnapshot = { ...state.contentSnapshot, playback: structuredClone(playback) }; },
        readAsset: () => new Uint8Array(),
        destroy: () => { state.listeners.clear(); },
      };
      const vendor = { snapshot: () => original.vendor.snapshot(), searchMaps: async () => ({ maps: [] }), listLatestMaps: async () => ({ maps: [] }) };
      const video = {
        getRetainedCameraStream: () => null,
        requestCamera: async () => { throw new Error("camera must not activate in visual_test"); },
        attachCameraStream: () => ({ sourceKind: "none", sourceId: "none", mirrored: false, currentTimeSeconds: 0, intrinsicWidth: 1, intrinsicHeight: 1, sourceAspectRatio: 1, sourceChangeId: 1 }),
        injectCameraStream: () => {}, play: async () => {}, pause: () => {},
        activateLease: () => {}, pauseForLease: () => {}, releaseLease: () => {},
        describeStatus: () => ({ state: "idle", sourceChangeId: 1 }),
        describeSurface: () => ({ sourceId: "none", mirrored: false, sourceChangeId: 1, sourceAspectRatio: 1 }),
        setDocumentHidden: () => {}, destroy: () => {},
      };
      const cv = { start: async () => { throw new Error("cv must not start in visual_test"); }, stop: async () => {}, dispose: async () => {}, getLatestPoseFrame: () => null, getStatus: () => ({ lifecycleState: "idle" }) };
      const audio = {
        getMixSnapshot: () => Object.freeze({ musicVolume: 0.5, sfxVolume: 0.5 }),
        setMix: function () { return this.getMixSnapshot(); },
        activateLease: async () => {}, releaseLease: async () => {}, pauseForLease: async () => {},
        play: async () => {}, pause: async () => {}, seek: async () => {}, stop: async () => {},
        setDocumentHidden: async () => {}, destroy: async () => {},
        getStatus: () => ({ state: "playing", autoplayState: "allowed", durationSeconds: 60 }),
        getClockSnapshot: () => ({ contextTimeSeconds: performance.now() / 1000, positionSeconds: 0, durationSeconds: 60, progress: 0, playing: true }),
      };
      const gameplay = Object.create(original.gameplay);
      const input = Object.create(original.input);
      return Object.freeze({ ...original, vendor, authoring: original.authoring, content, video, cv, audio, gameplay, input });
    };
    document.querySelector("main")?.append(element);
  });
  await page.waitForFunction(() => document.querySelector("aero-game")?.graph !== undefined, { timeout: 15_000 });
  await page.waitForTimeout(30);

  // Start the visual_test session through the public API.
  await game.evaluate(async (element) => {
    await element.startSession("visual_test", { requireDownloaded: false });
  });
  await page.waitForFunction(() => {
    const g = document.querySelector("aero-game");
    const session = g?.graph?.gameplay?.getSnapshot?.()?.session;
    return session?.purpose === "visual_test" && session?.state === "playing";
  }, { timeout: 15_000 });

  // Close the menu so the authoring surface flips enabled, then force one sync.
  await game.evaluate(async (element) => {
    element.setMenuOpen(false);
    await element.menuPauseTail;
    element.syncDebugCameraPresentation();
  });

  // Inject the compare baseline inside the page for later evaluate calls.
  await page.evaluate((value) => { globalThis.__expectedDefaultsJson = value; }, expectedDefaultsJson);

  // ---------- (c) panel visible + enabled; textarea preloaded byte-exact ----------
  const testEvidence = await game.evaluate((element, defaultsJson) => {
    const root = element.shadowRoot;
    const panel = root.querySelector("aside[data-role='debug-camera-controls']");
    const section = root.querySelector(".equipment-authoring");
    const textarea = root.querySelector("[data-equipment-config-field='yaml']");
    const applyButton = root.querySelector("button[data-action='equipment-config-apply']");
    const resetButton = root.querySelector("button[data-action='equipment-config-reset']");
    const exportButton = root.querySelector("button[data-action='equipment-config-export']");
    const status = root.querySelector("[data-role='equipment-config-status']");
    return {
      panelVisible: panel instanceof HTMLElement && panel.hidden === false,
      panelAriaHidden: panel?.getAttribute("aria-hidden") === "false",
      sectionLabel: section?.querySelector("legend")?.textContent,
      textareaValue: textarea instanceof HTMLTextAreaElement ? textarea.value : null,
      applyEnabled: applyButton instanceof HTMLButtonElement && applyButton.disabled === false,
      resetEnabled: resetButton instanceof HTMLButtonElement && resetButton.disabled === false,
      exportEnabled: exportButton instanceof HTMLButtonElement && exportButton.disabled === false,
      statusRole: status?.getAttribute("role"),
      statusLive: status?.getAttribute("aria-live"),
      describeEqualsDefaults: JSON.stringify(element.describeEquipmentConfig()) === defaultsJson,
    };
  }, expectedDefaultsJson);
  assert.equal(testEvidence.panelVisible, true, "authoring panel VISIBLE during visual_test");
  assert.equal(testEvidence.panelAriaHidden, true, "panel aria-hidden=false during visual_test");
  assert.equal(testEvidence.sectionLabel, "Equipment config");
  assert.equal(testEvidence.applyEnabled, true, "Apply button enabled in visual_test");
  assert.equal(testEvidence.resetEnabled, true, "Reset button enabled in visual_test");
  assert.equal(testEvidence.exportEnabled, true, "Export button enabled in visual_test");
  assert.equal(testEvidence.statusRole, "status");
  assert.equal(testEvidence.statusLive, "polite");
  assert.equal(testEvidence.describeEqualsDefaults, true, "live config still equals defaults before any edit");
  assert.equal(testEvidence.textareaValue, expectedDefaultsYaml, "textarea preloaded with serialized defaults BYTE-FOR-BYTE");
  console.log("PASS: (c) visual_test — panel visible/enabled, textarea === serialized defaults");

  // ---------- (d) LIVE validation on input ----------
  const invalidText = `${expectedDefaultsYaml}bogus: 1\n`;
  await game.locator("[data-equipment-config-field='yaml']").fill(invalidText);
  const liveInvalidBaseline = await game.evaluate((element) => ({
    statusValue: element.shadowRoot.querySelector("[data-role='equipment-config-status']").value,
    describeUnchanged: JSON.stringify(element.describeEquipmentConfig()) === globalThis.__expectedDefaultsJson,
  }));
  assert.match(liveInvalidBaseline.statusValue, /unknown top-level key "bogus"/u, "invalid input surfaces the error message");
  assert.equal(liveInvalidBaseline.describeUnchanged, true, "live validation does NOT mutate the live config");
  const validEdited = expectedDefaultsYaml.replace("scale: 1", "scale: 2");
  await game.locator("[data-equipment-config-field='yaml']").fill(validEdited);
  const liveValid = await game.evaluate((element) => ({
    statusValue: element.shadowRoot.querySelector("[data-role='equipment-config-status']").value,
    describeUnchanged: JSON.stringify(element.describeEquipmentConfig()) === globalThis.__expectedDefaultsJson,
  }));
  assert.match(liveValid.statusValue, /Valid/u, "valid input shows the valid indicator");
  assert.equal(liveValid.describeUnchanged, true, "draft validation alone does not commit");
  console.log("PASS: (d) live validation — error without applying; valid indicator shown");

  // ---------- (e) APPLY semantics ----------
  await game.locator("[data-equipment-config-field='yaml']").fill(invalidText);
  const beforeInvalidApply = await game.evaluate((element) => JSON.stringify(element.describeEquipmentConfig()));
  await game.locator("button[data-action='equipment-config-apply']").click();
  const afterInvalidApply = await game.evaluate((element) => ({
    describe: JSON.stringify(element.describeEquipmentConfig()),
    status: element.shadowRoot.querySelector("[data-role='equipment-config-status']").value,
  }));
  assert.equal(afterInvalidApply.describe, beforeInvalidApply, "invalid APPLY leaves the live config unchanged");
  assert.match(afterInvalidApply.status, /unknown top-level key/u, "invalid APPLY keeps the error on screen");

  await game.locator("[data-equipment-config-field='yaml']").fill(validEdited);
  const applied = await game.evaluate(() => document.querySelector("aero-game").applyEquipmentConfig());
  assert.equal(applied, true, "valid APPLY returns true");
  const afterValidApply = await game.evaluate((element) => ({
    scale: element.describeEquipmentConfig().flow.perHand.left.scale,
    status: element.shadowRoot.querySelector("[data-role='equipment-config-status']").value,
  }));
  assert.equal(afterValidApply.scale, 2, "VALID APPLY committed the edited leaf");
  assert.match(afterValidApply.status, /applied/iu, "success status projected after apply");
  console.log("PASS: (e) APPLY — invalid refused (state untouched); valid commits observably");

  // ---------- (f) EXPORT via Playwright download event ----------
  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
  await game.locator("button[data-action='equipment-config-export']").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "aerobeat-equipment-config.yaml", "download named aerobeat-equipment-config.yaml");
  const savedPath = await download.path();
  assert.ok(savedPath, "download materialized on disk");
  const downloadedBytes = await readFile(savedPath, "utf8");
  assert.equal(downloadedBytes, validEdited, "downloaded bytes equal the exported textarea contents");
  configModule.parseEquipmentConfigYaml(downloadedBytes); // downloadable YAML re-parses cleanly
  await game.locator("[data-equipment-config-field='yaml']").fill(invalidText);
  let secondDownloadFired = false;
  page.once("download", () => { secondDownloadFired = true; });
  await game.locator("button[data-action='equipment-config-export']").click();
  await page.waitForTimeout(250);
  assert.equal(secondDownloadFired, false, "invalid content must NOT trigger a second download");
  console.log("PASS: (f) EXPORT — Playwright download fired, filename + bytes correct, invalid refuses");

  // ---------- (g) RESET restores baked defaults ----------
  await game.locator("[data-equipment-config-field='yaml']").fill(validEdited);
  await game.evaluate(() => document.querySelector("aero-game").applyEquipmentConfig());
  await game.locator("button[data-action='equipment-config-reset']").click();
  const afterReset = await game.evaluate((element) => ({
    describeEqualsDefaults: JSON.stringify(element.describeEquipmentConfig()) === globalThis.__expectedDefaultsJson,
    textareaValue: element.shadowRoot.querySelector("[data-equipment-config-field='yaml']").value,
  }));
  assert.equal(afterReset.describeEqualsDefaults, true, "RESET restored the baked defaults into the live state");
  assert.equal(afterReset.textareaValue, expectedDefaultsYaml, "RESET refreshed the textarea to serialized defaults");
  console.log("PASS: (g) RESET — baked defaults restored to state and textarea");

  // No stray console noise across the whole run.
  assert.deepEqual(noise, [], `unexpected console/page noise: ${JSON.stringify(noise)}`);

  clearTimeout(hardTimeout);
  console.log("Equipment config panel browser oracle PASS.");
} finally {
  clearTimeout(hardTimeout);
  await cleanup();
}
