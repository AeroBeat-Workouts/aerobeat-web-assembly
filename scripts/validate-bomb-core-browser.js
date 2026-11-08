// @ts-check
// Signed Flow Play: fixtures replace camera/audio/content only. Measured input,
// calibration, equipment, coordinator and renderer are the actual linked services.
// Boxing rejects bombs; this deliberately makes no Boxing bomb-contact claim.
// Canonical asset authoring generates a .22 WU core (spikes reach .39 WU);
// renderer gameplay-scene-model scales the whole bomb uniformly by bombScaleFactor.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { loadSignedSnapshot, handlerForSnapshot } from "./serve-friend-game.js";

assert(process.env.AEROBEAT_BOMB_SIGNED_DIR, "AEROBEAT_BOMB_SIGNED_DIR must identify the actual signed game (new bomb settings required)");
const snapshot = loadSignedSnapshot(path.resolve(process.env.AEROBEAT_BOMB_SIGNED_DIR));
if (process.env.AEROBEAT_EXPECT_GAMEPLAY_COMMIT) assert.equal(snapshot.manifest.sourceManifest.sources["@aerobeat/web-gameplay"].commit, process.env.AEROBEAT_EXPECT_GAMEPLAY_COMMIT);
// Four bombs per run; no exact floating-point tangent (covered by owner units).
const profiles = [
  { name: "default", bomb: 100, wrist: 1, offsets: [[.45, .45], [.48, 0], [.33, 0], [.35, 0]], contacts: [false, false, true, false] },
  { name: "small", bomb: 10, wrist: 1, offsets: [[.45, .45], [.48, 0], [.13, 0], [.15, 0]], contacts: [false, false, true, false] },
  { name: "large", bomb: 200, wrist: 2, offsets: [[.8, .8], [1.04, 0], [.67, 0], [.69, 0]], contacts: [false, false, true, false] },
  { name: "disabled", bomb: 100, wrist: 0, offsets: [[.45, .45], [.48, 0], [0, 0], [.35, 0]], contacts: [false, false, false, false] }
];
const directory = mkdtempSync(path.join(tmpdir(), "aerobeat-bomb-core-"));
let server, browser;
try {
  await build({ configFile: "vite.config.js", logLevel: "error", build: { outDir: directory, emptyOutDir: true, lib: { entry: "scripts/fixtures/scored-play-browser-harness.js", formats: ["es"], fileName: () => "scored-play-browser-harness.js" } } });
  const fixtures = new Map(readdirSync(directory).filter(name => name.endsWith(".js")).map(name => ["/scripts/fixtures/" + name, readFileSync(path.join(directory, name))]));
  const handler = handlerForSnapshot(snapshot);
  server = createServer((req, res) => {
    const bytes = fixtures.get(new URL(req.url ?? "/", "http://fixture.invalid").pathname);
    if (bytes) { res.setHeader("content-type", "text/javascript"); res.end(bytes); }
    else handler(req, res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const url = `http://127.0.0.1:${server.address().port}/`;
  // Bomb Scale is a hidden stored/API preference, not a menu control. The
  // bundled fixture has its own module instance: write via its canonical API in
  // a same-origin companion tab so the game's real coordinator receives the
  // browser's native storage event. Never inject an event or scorer settings.
  const seedHiddenBombScale = async (game, bombScalePercent) => {
    const settingsPage = await context.newPage();
    try {
      await settingsPage.goto(url, { waitUntil: "networkidle" });
      await settingsPage.evaluate(async bombScalePercent => {
        const { getGameSetupSnapshot, setGameSetupSnapshot } = await import("/scripts/fixtures/scored-play-browser-harness.js");
        setGameSetupSnapshot({ ...getGameSetupSnapshot(), bombScalePercent });
      }, bombScalePercent);
      await game.page().waitForFunction(value => document.querySelector("aero-game")?.desiredGameSetup.bombScalePercent === value, bombScalePercent);
      await game.evaluate(async element => { await element.lifecycleIntentTail; });
    } finally { await settingsPage.close(); }
  };
  for (const profile of profiles) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
    const game = page.locator("aero-game");
    await game.evaluate(async (element, profile) => {
      const { installScoredPlayHarness } = await import("/scripts/fixtures/scored-play-browser-harness.js");
      const events = profile.offsets.map((_, index) => ({ schema: "aerobeat/resolved_content_event", version: 3, eventId: `bomb-${index}`, centerTimestampMs: 5000 + index * 1000, sourceEventIds: [`source-bomb-${index}`], authoredBeat: { type: "bomb", placement: 5 } }));
      // Retain an ordinary note in the same real chart; its independent equipment
      // scoring path must not be replaced to exercise the bomb hazard path.
      events.push({ schema: "aerobeat/resolved_content_event", version: 3, eventId: "ordinary-note", centerTimestampMs: 9000, sourceEventIds: ["source-note"], authoredBeat: { type: "note", hand: "left", placement: 5, requiresDirection: false } });
      const harness = await installScoredPlayHarness(element, { events, mode: "flow", songDurationMs: 12000 });
      element.__bombHarness = harness;
      await harness.waitForAssets(); await harness.selectChart();
      if (element.shadowRoot.querySelector("[data-game-setup-field='bombScalePercent']")) throw Error("Bomb Scale must remain a hidden stored/API preference, with no new menu control");
    }, profile);
    await seedHiddenBombScale(game, profile.bomb);
    await game.evaluate(async (element, profile) => {
      const harness = element.__bombHarness;
      // Unlike hidden Bomb Scale, wrist scale remains native menu-control proof.
      // Fixture content has no private generation-bound spawn-timing reader.
      // Use the existing native override, not fabricated content timing or a
      // relaxed renderer gate, so real canonical targets are actually staged.
      await harness.setSetup({ spawnDistanceOverrideEnabled: true, spawnDistanceOverrideWorldUnits: 20, wristBombColliderScale: profile.wrist });
      await harness.startPlay(); await harness.calibrate();
      if (element.activeGameplayConfiguration?.flowColliderSettings?.bombScale !== profile.bomb / 100) throw Error("Active Flow collision settings must carry actual bomb size");
      if (element.activeGameplayConfiguration.flowColliderSettings.wristBombColliderScale !== profile.wrist) throw Error("Active measured wrist scale missing");
    }, profile);

    if (profile.name === "default") {
      await game.evaluate(async element => {
        element.__bombConfigurationBeforeEdit = element.activeGameplayConfiguration;
        element.setMenuOpen(true); element.renderPresenters();
        await element.menuPauseTail;
        if (!element.menuOpen || element.graph.gameplay.getSnapshot().session.state !== "paused_manual") throw Error("Native menu must pause the actual run before editing hidden next-run bomb size");
      });
      await seedHiddenBombScale(game, 200);
      await game.evaluate(element => {
        const before = element.__bombConfigurationBeforeEdit;
        if (element.desiredGameSetup.bombScalePercent !== 200 || element.activeSessionSetup.bombScalePercent !== 100 || element.activeGameplayConfiguration !== before || before.flowColliderSettings.bombScale !== 1 || element.graph.renderer.tuning.bombScaleFactor !== 1) throw Error("Paused hidden API preference edit changed active physical/rendered bomb size");
        if (element.shadowRoot.querySelector("[data-game-setup-field='bombScalePercent']")) throw Error("Hidden Bomb Scale must not acquire a menu control");
        delete element.__bombConfigurationBeforeEdit;
      });
      // Escape closes the menu and recovers camera. The documented component
      // transport separately resumes manual pause with real lease/media gates.
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => { const e = document.querySelector("aero-game"); return e && !e.menuOpen && e.graph.cv.getStatus().running; });
      await game.evaluate(async element => {
        await element.lifecycleIntentTail;
        await element.resume();
        element.stopFrameLoop();
        await element.__bombHarness.calibrate();
      });
    }

    const result = await game.evaluate(async (element, profile) => {
      const harness = element.__bombHarness;
      const bounds = harness.graph.input.getSnapshot().calibration.bounds;
      if (!bounds) throw Error("Real calibration bounds missing");
      const raw = (sx, sy) => ({ x: 1 - (bounds.left + ((sx + .5) / 4) * (bounds.right - bounds.left)), y: bounds.top + ((2.5 - sy) / 3) * (bounds.bottom - bounds.top) });
      const rendered = [];
      const feed = async (t, x, y) => {
        await harness.seekSong(t, { leftWrist: raw(x, y), rightWrist: raw(3, 2) });
        for (const [role, sx, sy] of [["left_wrist", x, y], ["right_wrist", 3, 2]]) {
          const pose = element.currentEquipmentPoses.find(p => p.role === role);
          if (!pose || Math.abs(pose.anchor.x - sx) > 1e-6 || Math.abs(pose.anchor.y - sy) > 1e-6) throw Error(`Measured ${role} did not reach judge coordinate: ${JSON.stringify({ t, expected: { x: sx, y: sy }, actual: pose?.anchor })}`);
        }
        if (element.lastError) throw Error(element.lastError.message);
        if (element.activeGameplayConfiguration.flowColliderSettings.bombScale !== profile.bomb / 100 || harness.graph.renderer.tuning.bombScaleFactor !== profile.bomb / 100) throw Error("Active visual/collision bomb scales diverged during real Play");
      };
      for (let index = 0; index < profile.offsets.length; index++) {
        const center = 5000 + index * 1000;
        const [dx, dy] = profile.offsets[index];
        // Seed before the inclusive window; every 50ms through both edges keeps
        // genuine bilateral measurement coverage/freshness, not just a point hit.
        for (let t = center - 250; t <= center + 250; t += 50) {
          await feed(t, 1 + dx, 1 + dy);
          if (t === center - 200) {
            const renderer = harness.graph.renderer;
            const icon = renderer.lastModel?.objects.find(o => o.targetId === `bomb-${index}` && o.kind === "icon");
            if (!icon || icon.assetId !== "bomb/urchin-v1" || ![icon.scale.x, icon.scale.y, icon.scale.z].every(n => Math.abs(n - profile.bomb / 100) < 1e-12)) throw Error(`Real staged canonical bomb must have uniform active scale: ${JSON.stringify({ icon, time: t, objects: renderer.lastModel?.objects.filter(o => o.kind === "icon").map(o => ({ id: o.id, targetId: o.targetId, assetId: o.assetId, scale: o.scale })), targets: element.rendererFrame().targets, hazards: harness.graph.gameplay.getSnapshot().hazardOutcomes })}`);
            const scene = renderer.describe();
            if (scene.state !== "running" || scene.gameplayAssets?.state !== "ready" || scene.errorMessage) throw Error("Canonical bomb asset/actual renderer unavailable");
            rendered.push({ eventId: `bomb-${index}`, assetId: icon.assetId, scale: icon.scale });
          }
        }
      }
      for (let t = 8500; t <= 10300; t += 50) await feed(t, 1, 1);
      const gameplay = harness.graph.gameplay.getSnapshot();
      const output = { profile: profile.name, hazards: gameplay.hazardOutcomes, judgements: gameplay.judgements, rendered, bombScale: element.activeGameplayConfiguration.flowColliderSettings.bombScale, wristScale: element.activeGameplayConfiguration.flowColliderSettings.wristBombColliderScale };
      harness.dispose(); delete element.__bombHarness;
      return output;
    }, profile);
    assert.deepEqual(errors, []);
    assert.equal(result.hazards.length, 4, `${profile.name}: exactly four actual hazard outcomes`);
    assert.equal(new Set(result.hazards.map(h => h.eventId)).size, 4, "each bomb must finalize exactly once");
    for (let index = 0; index < 4; index++) {
      const actual = result.hazards.find(h => h.eventId === `bomb-${index}`);
      assert.equal(actual?.kind, "bomb");
      assert.equal(actual.result, profile.contacts[index] ? "contact" : "avoided", `${profile.name}/bomb-${index}: no missing-coverage substitute for avoidance`);
      assert.equal(actual.consequenceApplied, profile.contacts[index], "contact consequence exactly matches the actual outcome");
    }
    assert.equal(result.judgements.length, 1, "bombs must remain hazards, not ordinary note judgements");
    assert.equal(result.judgements[0].eventId, "ordinary-note");
    assert.equal(result.judgements[0].result, "hit", "normal equipment note scoring stays active");
    console.log(JSON.stringify(result));
    await page.close();
  }
  console.log(`PASS signed bomb-core Flow Play ${snapshot.manifest.buildStamp}: corner/spike negatives, inside/outside, small/large/disabled wrist, staged uniform scale and paused hidden-API next-run size lock (no Bomb Scale UI control). Fixture movement, not physical-phone acceptance; Boxing bomb admission unchanged.`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(directory, { recursive: true, force: true });
}
