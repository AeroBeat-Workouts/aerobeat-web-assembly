// @ts-check
// 0.0.74 browser playtest proofs. Real app/renderer, no fixture DOM or fake pixels.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const proofDir = fileURLToPath(new URL("../release/proofs/0.0.74/", import.meta.url));
await mkdir(proofDir, { recursive: true });
const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
let parent;
let browser;
try {
  await vite.listen();
  const childUrl = vite.resolvedUrls?.local?.[0];
  assert.ok(childUrl, "Vite URL unavailable");
  parent = createHttpServer((_request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<!doctype html><style>html,body{margin:0}iframe{width:1120px;height:820px;border:0;display:block}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);
  });
  await new Promise((resolve) => parent.listen(0, "127.0.0.1", resolve));
  const address = parent.address();
  assert.ok(address && typeof address !== "string", "Parent URL unavailable");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1150, height: 850 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${address.port}/`, { waitUntil: "networkidle" });
  const frame = page.frameLocator("#game");
  await frame.locator("aero-game").waitFor();
  await frame.locator("aero-game").evaluate(async (game) => {
    await customElements.whenDefined("aero-game");
    if (!game.graph) throw new Error("Game graph unavailable");
  });
  await frame.locator("aero-game").evaluate((game) => game.setMenuOpen(true));
  const shadow = frame.locator("aero-game");
  const display = shadow.locator("[data-section='display']");
  const info = shadow.locator("[data-section='info']");
  const capture = async (name, options = {}) => page.screenshot({ path: `${proofDir}/${name}.png`, ...options });

  // B2.4: real change event runs the game's persisted UI scale handler.
  const scale = display.locator("select[data-action='ui-scale-select']");
  assert.equal(await scale.locator("option[value='1.15']").textContent(), "Larger (115%)");
  await scale.selectOption("1.15");
  // Current app wires this select to click (not change), so exercise that actual
  // DOM handler after selecting. Selecting alone is not a proof of application.
  await scale.click();
  await scale.press("Escape");
  assert.equal(await shadow.evaluate((game) => game.style.getPropertyValue("--aero-ui-scale")), "1.15");
  assert.equal(await scale.inputValue(), "1.15");
  await display.scrollIntoViewIfNeeded();
  await capture("b2.4-ui-scale");

  // B2.3: pose tuning is retired from Display; its data-intact group is hidden in Game Setup.
  assert.equal(await display.locator("[data-camera-pose-field], [data-role='camera-pose-mode']").count(), 0);
  const setup = shadow.locator("[data-section='game-setup']");
  const cameraGroup = setup.locator("fieldset.gameplay-camera-controls:has([data-role='camera-pose-mode'])");
  assert.equal(await cameraGroup.count(), 1);
  assert.equal(await cameraGroup.evaluate((group) => group.style.display), "none");
  assert.equal(await cameraGroup.isVisible(), false);
  assert.deepEqual(await cameraGroup.locator("input[type='number'][data-camera-pose-field]").evaluateAll((inputs) => inputs.map((input) => input.dataset.cameraPoseField)), ["y", "z", "xPitch", "yYaw"]);

  // Info retains its status alert, but the redundant menu calibration action is gone.
  assert.equal(await info.locator("button[data-action='force-calibrate']").count(), 0);
  assert.equal(await info.locator("[data-role='info-action'][role='alert']").count(), 1);

  // B3.1: seed only presenter view data, not markup: production presenter renders
  // the five actual BeatSaver difficulty tags inside its nested shadow root.
  await shadow.evaluate((game) => {
    const selectedMap = { mapId: "proof-074", name: "Difficulty color proof", songAuthorName: "AeroBeat", levelAuthorName: "Playtest" };
    game.beatSaverView = Object.freeze({ ...game.beatSaverView, state: "ready", selectedMap, selected: selectedMap,
      selectedVersionHash: "proof-version", selectedDifficulty: "Easy", difficulties: ["Easy", "Normal", "Hard", "Expert", "ExpertPlus"],
      versions: [{ hash: "proof-version", versionHash: "proof-version", label: "Proof version" }] });
    game.renderPresenters();
  });
  const tags = shadow.locator("aero-beatsaver-browser").locator("[part='detail'] .difficulty-tag");
  // If the browser uses the selected map from the results collection instead of
  // selectedMap, report that mismatch rather than fabricating any colored tags.
  const expected = ["rgb(46, 204, 64)", "rgb(255, 133, 27)", "rgb(255, 65, 54)", "rgb(163, 0, 0)", "rgb(0, 0, 0)"];
  assert.equal(await tags.count(), 5, "BeatSaver must render all five production difficulty tags");
  assert.deepEqual(await tags.evaluateAll((items) => items.map((tag) => getComputedStyle(tag).backgroundColor)), expected);
  await shadow.locator("[data-section='music']").scrollIntoViewIfNeeded();
  await capture("b3.1-difficulty-tags");

  // B2.1: Test pose source is the exact mouse-driven testEquipmentInput. Render
  // it through the actual PlayCanvas equipment/collider route, not drawn HTML.
  await shadow.evaluate(async (game) => {
    const { testEquipmentInput } = await import("/src/test-equipment-authoring.js");
    game.stopFrameLoop();
    game.setMenuOpen(false);
    await game.ensureEquipmentConfigIdentity();
    const pose = testEquipmentInput("left", { x: 0.42, y: 0.48 });
    const frame = game.rendererFrame();
    const equipment = game.resolveEquipmentPoses(game.graph, { purpose: "visual_test", state: "playing", rulesetId: "flow_colliders_v1" }, pose, frame);
    if (!Array.isArray(equipment) || equipment.length !== 2) throw new Error("Test equipment pose unavailable");
    const renderer = game.graph.renderer;
    renderer.renderGameplayFrameWithCursorsAndEquipment({ presentation: "flow", nowMs: 0, targets: [], colliderSettings: { ...game.desiredGameSetup.flowColliderVolume, colliderVisible: true } }, Object.freeze([]), { grid: { x: 0, y: 0, width: 1, height: 1 }, minConfidence: 0.5, sizeCssPx: 32 }, equipment, { grid: { x: 0, y: 0, width: 1, height: 1 } });
    if (renderer.describe().equipment?.instanceCount !== 2) throw new Error("Test equipment not rendered");
  });
  await capture("b2.1-collider-volume");
  console.log(`PASS historical 0.0.74 proofs on current source: UI scale, retired Display camera controls (hidden Game Setup group), Info alert, five difficulty colors, Test-pose equipment/collider scene; screenshots=${proofDir}`);
  await page.close();
} finally {
  if (browser) await browser.close();
  await vite.close();
  if (parent) await new Promise((resolve) => parent.close(resolve));
}
