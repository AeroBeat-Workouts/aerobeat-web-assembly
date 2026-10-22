// @ts-check
// Connected Test: default simulated Right glove cannot block explicit camera
// buttons or pose files; canvas capture/keys remain reserved for Mouse hand Off.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { handlerForSnapshot, loadSignedSnapshot } from "./serve-friend-game.js";

const signedDirectory = process.env.AEROBEAT_CAMERA_SIGNED_DIR;
const archive = signedDirectory ? await readFile("/tmp/aerobeat-diagnostic-5e-44cb8963.zip") : null;
if (archive) assert.equal(createHash("sha256").update(archive).digest("hex"), "c00ad62b155b7919f96fc3c8545e5451b9122ccf1f81daeee5ded1691b0c5037");
// Source runs configured Vite; signed mode serves immutable bytes plus a
// Playwright-intercepted ZIP. Neither mode touches Derrick's personal library.
const vite = signedDirectory ? null : await createViteServer({ logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false } });
let parent, browser, gameServer;
try {
  let url;
  if (vite) { await vite.listen(); url = vite.resolvedUrls?.local?.[0]; }
  else {
    const snapshot = loadSignedSnapshot(path.resolve(signedDirectory));
    gameServer = createHttpServer(handlerForSnapshot(snapshot));
    await new Promise(resolve => gameServer.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${gameServer.address().port}/`;
  }
  assert.ok(url);
  parent = createHttpServer((_request, response) => { response.setHeader("content-type", "text/html; charset=utf-8"); response.end(`<!doctype html><iframe allow="camera; autoplay" style="width:844px;height:390px" src="${url}"></iframe>`); });
  await new Promise(resolve => parent.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch();
  for (const embedding of ["direct", "iframe"]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, acceptDownloads: true });
    try {
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      if (archive) await page.route("**/__pinned_song.zip", route => route.fulfill({ status: 200, contentType: "application/zip", body: archive }));
      await page.goto(embedding === "direct" ? url : `http://localhost:${parent.address().port}/`, { waitUntil: "networkidle" });
      const frame = embedding === "direct" ? page : page.frames().find(item => item !== page.mainFrame()); assert.ok(frame);
      const game = frame.locator("aero-game"); await game.waitFor();
      if (archive) {
        await game.evaluate(async element => {
          const bytes = new Uint8Array(await (await fetch("/__pinned_song.zip")).arrayBuffer());
          await element.importLocalZip(bytes);
          await element.selectGameplayAxes("boxing_collider_v1");
          if (!element.graph.content.getSnapshot().selectedVariant?.rulesetId?.startsWith("boxing_collider")) throw Error("Pinned song Boxer variant unavailable");
        });
        await game.locator("aero-session-actions").locator("button[data-intent='session-test']").click();
      } else await game.evaluate(async element => {
        const { installScoredPlayHarness } = await import("/scripts/fixtures/scored-play-browser-harness.js");
        const events = [{ schema: "aerobeat/resolved_content_event", version: 3, eventId: "camera-boxing-punch", centerTimestampMs: 4000, sourceEventIds: ["source-camera-boxing-punch"], authoredBeat: { type: "straight_right", spatialTarget: { targetCell: 6, acceptedSubcells: [24, 25, 26, 27] }, timingWindowMs: 180, evidenceFreshnessMs: 150 } }];
        const harness = await installScoredPlayHarness(element, { mode: "boxing", events });
        await harness.waitForAssets(); await harness.selectChart();
        const test = element.shadowRoot.querySelector("aero-session-actions")?.shadowRoot?.querySelector("button[data-intent='session-test']");
        if (!(test instanceof HTMLButtonElement) || test.disabled) throw Error("Boxing Test unavailable");
        test.click();
      });
      try {
        await frame.waitForFunction(() => { const element = document.querySelector("aero-game"); return element?.graph?.gameplay?.getSnapshot()?.session?.state === "playing" && element.graph.renderer.describe().debugCameraEnabled; }, null, { timeout: 12000 });
      } catch (error) {
        const diagnostics = await game.evaluate(element => ({ session: element.graph.gameplay.getSnapshot().session, renderer: element.graph.renderer.describe(), lastError: element.lastError?.message ?? null, menuOpen: element.menuOpen, startRequested: element.sessionStartRequested }));
        throw new Error(`${embedding}: Boxing Test did not reach playing: ${JSON.stringify(diagnostics)}`, { cause: error });
      }
      const state = () => game.evaluate(element => {
        const renderer = element.graph.renderer, pose = renderer.cameraEntity?.getPosition(), controls = [...element.shadowRoot.querySelectorAll("button[data-debug-camera-intent],button[data-action='debug-camera-speed'],button[data-action='debug-camera-reset'],button[data-action='debug-camera-load'],button[data-action='debug-camera-export']")];
        return { hand: element.testEquipmentMouseHand, canvasInput: renderer.debugCameraAuthoringInputEnabled, buttonsEnabled: controls.length >= 10 && controls.every(control => !control.disabled), z: pose?.z, intents: renderer.describe().debugActiveIntentCount, status: element.shadowRoot.querySelector("[data-role='debug-camera-pose-status']")?.textContent, error: element.lastError?.message ?? null };
      });
      const before = await state();
      assert.equal(before.hand, "right"); assert.equal(before.canvasInput, false);
      assert.equal(before.buttonsEnabled, true, `${embedding}: right-hand Test must expose camera buttons and files`);
      const forward = game.locator("button[data-debug-camera-intent='forward']");
      await forward.hover(); await page.mouse.down(); await page.waitForTimeout(260);
      const held = await state(); await page.mouse.up(); await page.waitForTimeout(100);
      const released = await state();
      assert.ok(held.z < before.z - .15, `${embedding}: real held Forward button must move camera with Right glove`);
      assert.equal(released.intents, 0);
      const exportButton = game.locator("button[data-action='debug-camera-export']");
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 }); await exportButton.focus(); await page.keyboard.press("Enter");
      const download = await downloadPromise, chunks = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      const saved = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      assert.ok(Math.abs(saved.position.z - released.z) < .02, `${embedding}: trusted Export must save moved camera`);
      const replacement = { ...saved, position: { x: 1.25, y: 2, z: 6 }, rotationEulerDegrees: { xPitch: 10, yYaw: 20, zRoll: 0 }, projection: { verticalFovDegrees: 55, nearClip: .2, farClip: 90 } };
      const chooserPromise = page.waitForEvent("filechooser", { timeout: 5000 });
      const loadButton = game.locator("button[data-action='debug-camera-load']"); await loadButton.focus(); await page.keyboard.press("Enter");
      const chooser = await chooserPromise; await chooser.setFiles({ name: "camera-test.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(replacement)) });
      await frame.waitForFunction(() => document.querySelector("aero-game")?.shadowRoot?.querySelector("[data-role='debug-camera-pose-status']")?.textContent === "Camera pose loaded.", null, { timeout: 5000 });
      const loaded = await game.evaluate(element => { const renderer = element.graph.renderer, position = renderer.cameraEntity.getPosition(); return { z: position.z, pitch: renderer.debugPitch * 180 / Math.PI, yaw: renderer.debugYaw * 180 / Math.PI, canvasInput: renderer.debugCameraAuthoringInputEnabled, hand: element.testEquipmentMouseHand }; });
      assert.ok(Math.abs(loaded.z - 6) < .01 && Math.abs(loaded.pitch - 10) < .01 && Math.abs(loaded.yaw - 20) < .01, `${embedding}: trusted Load must apply saved pose and rotation`);
      assert.equal(loaded.hand, "right"); assert.equal(loaded.canvasInput, false);
      assert.deepEqual(errors, []);
      console.log(`${embedding}: Right-glove Boxing Test camera movement, trusted Export/Load, mouse isolation: PASS`);
    } finally { await context.close(); }
  }
} finally {
  await browser?.close(); await new Promise(resolve => parent?.close(resolve) ?? resolve());
  await new Promise(resolve => gameServer?.close(resolve) ?? resolve()); await vite?.close();
}
