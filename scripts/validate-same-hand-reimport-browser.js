// @ts-check
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const mapId = "54510", hash = "f5c04797fe0831741adec66ce5386971153919d4";
const archive = await readFile(`/tmp/aerobeat-${mapId}-${hash}.zip`);
assert.equal(createHash("sha256").update(archive).digest("hex"), "0dc3f98537c679cb8e96ffc5d079a1e0cbb9ae59df571f693a67a53c5d051db3");
const vite = await createViteServer({ appType: "spa", configFile: false, logLevel: "error", define: { __AEROBEAT_BUILD_STAMP__: JSON.stringify("isolated-a2-real-song"), __AEROBEAT_CACHE_BUST__: JSON.stringify("isolated-a2-real-song"), __AEROBEAT_PACKAGE_VERSION__: JSON.stringify("0.0.138") }, server: { host: "127.0.0.1", port: 0, hmr: false, fs: { allow: [new URL("../../", import.meta.url).pathname] } } });
let browser;
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local?.[0]; assert.ok(url);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__same_hand_54510.zip", (route) => route.fulfill({ status: 200, contentType: "application/zip", body: archive }));
  await page.goto(url, { waitUntil: "networkidle" });
  const game = page.locator("aero-game"); await game.waitFor();
  const result = await game.evaluate(async (element, fixture) => {
    const setup = await import("/src/game-setup-coordinator.js");
    const graph = element.graph;
    const sourceBytes = new Uint8Array(await (await fetch("/__same_hand_54510.zip")).arrayBuffer());
    const acquired = await graph.vendor.importLocalArchive(sourceBytes);
    if (acquired.sourceHash !== fixture.hash) throw new Error("Pinned source hash mismatch");
    const initial = await graph.authoring.convertAllStandardAndPersist(acquired.source, { sourceProvider: "beatsaver", sourceId: fixture.mapId, sourceVersionHash: fixture.hash, includeAudio: true, cacheSourceEntries: true });
    const unrelated = await graph.authoring.convertAllStandardAndPersist(acquired.source, { sourceProvider: "local", sourceId: "isolated-other", sourceVersionHash: fixture.hash, includeAudio: true });
    const otherBytes = [...(await graph.authoring.exportPackage(unrelated.defaultPackage.handle)).bytes];
    await element.refreshLibrary(element.connectedGeneration, { preferredCollectionId: initial.collection.collectionId, preferredPackageId: initial.defaultPackage.packageId });
    const library = element.shadowRoot.querySelector("aero-content-library");
    const button = () => library.shadowRoot.querySelector("button[data-intent='library-reimport']");
    const ui = { text: button()?.textContent?.trim(), disabled: button()?.disabled, collectionId: button()?.dataset.value };
    const before = await Promise.all(initial.packages.map((row) => graph.authoring.loadPackage(row.handle)));
    const input = element.shadowRoot.querySelector("input[data-game-setup-field='sameHandPunchMinGapMs']");
    input.value = "2000"; input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    await element.lifecycleIntentTail;
    const unchangedBeforeReimport = (await graph.authoring.listCollections()).find((entry) => entry.collectionId === initial.collection.collectionId)?.packages.map((entry) => entry.packageId);
    const oldPackageIds = initial.packages.map((entry) => entry.packageId);
    const originalGet = graph.vendor.getMapById, originalAcquire = graph.vendor.acquireVersion;
    const calls = [];
    graph.vendor.getMapById = async (id) => { calls.push({ kind: "map", id }); return { mapId: fixture.mapId, versions: [{ hash: fixture.hash, downloadUrl: "https://fixture.invalid/archive.zip" }] }; };
    graph.vendor.acquireVersion = async (map, selectedHash) => { calls.push({ kind: "version", id: map.mapId, hash: selectedHash }); return acquired; };
    try { button()?.click(); await element.lifecycleIntentTail; } finally { graph.vendor.getMapById = originalGet; graph.vendor.acquireVersion = originalAcquire; }
    const selected = (await graph.authoring.listCollections()).find((entry) => entry.collectionId === initial.collection.collectionId);
    const after = await Promise.all(selected.packages.map((row) => graph.authoring.loadPackage({ key: row.packageKey, packageId: row.packageId })));
    const perDifficulty = before.map((item, index) => {
      const earlier = item.package, tuned = after[index].package;
      const boxing = tuned.charts.find((chart) => chart.mode === "boxing");
      const oldBoxing = earlier.charts.find((chart) => chart.mode === "boxing");
      const oldFlow = earlier.charts.find((chart) => chart.mode === "flow");
      const flow = tuned.charts.find((chart) => chart.mode === "flow");
      const bpm = tuned.song.timing.tempoSegments[0].bpm;
      const punches = boxing.beats.filter((beat) => /^(straight|hook|uppercut)_(left|right)$/u.test(beat.type));
      const oldPunches = oldBoxing.beats.filter((beat) => /^(straight|hook|uppercut)_(left|right)$/u.test(beat.type));
      const ms = (beat) => beat.start * 60000 / bpm;
      const minimum = (hand) => punches.filter((beat) => beat.type.endsWith(`_${hand}`)).reduce((state, beat) => { const delta = ms(beat) - state.last; return { last: ms(beat), min: Math.min(state.min, delta) }; }, { last: -1e9, min: Infinity }).min;
      return { difficulty: tuned.source.difficulty, minimumLeftMs: minimum("left"), minimumRightMs: minimum("right"), oldPunches: oldPunches.length, punches: punches.length, dropped: tuned.conversionTrace.boxing[0].events.filter((event) => event.reason === "same_hand_punch_min_gap").length, flowUnchanged: JSON.stringify(flow) === JSON.stringify(oldFlow), oldIds: oldPunches.map((beat) => beat.eventId), newIds: punches.map((beat) => beat.eventId), oldPunchData: oldPunches.map((beat) => ({ id: beat.eventId, type: beat.type, ms: ms(beat) })), newPunchData: punches.map((beat) => ({ id: beat.eventId, type: beat.type, ms: ms(beat) })) };
    });
    return { ui, calls, gap: setup.getGameSetupSnapshot().sameHandPunchMinGapMs, previous: oldPackageIds, unchangedBeforeReimport, afterIds: selected.packages.map((entry) => entry.packageId), count: (await graph.authoring.listCollections()).length, selectedId: element.libraryView.selectedCollectionId, otherUnchanged: JSON.stringify(otherBytes) === JSON.stringify([...(await graph.authoring.exportPackage(unrelated.defaultPackage.handle)).bytes]), perDifficulty, error: element.lastError?.message ?? null };
  }, { mapId, hash });
  assert.deepEqual(result.ui, { text: "Reimport", disabled: false, collectionId: result.selectedId });
  assert.deepEqual(result.calls, [{ kind: "map", id: mapId }, { kind: "version", id: mapId, hash }]);
  assert.equal(result.gap, 2000);
  assert.deepEqual(result.unchangedBeforeReimport, result.previous, "setup edit does not reprocess stored charts");
  assert.equal(result.count, 2, "selected reimport keeps one selected and one unrelated collection");
  assert.equal(result.otherUnchanged, true);
  assert.equal(result.error, null, "selected reimport must leave no runtime error");
  assert.ok(result.perDifficulty.length >= 2, "all Standard difficulties reimport");
  for (const row of result.perDifficulty) {
    assert.ok(row.minimumLeftMs >= 1999.9999 && row.minimumRightMs >= 1999.9999, `real ${row.difficulty} chart honors per-hand song ms gap`);
    assert.ok(row.dropped > 0, `real ${row.difficulty} records gap drops`);
    assert.ok(row.punches < row.oldPunches, `real ${row.difficulty} removes repeated punches`);
    assert.equal(row.flowUnchanged, true, `real ${row.difficulty} Flow unchanged`);
    for (const old of row.oldPunchData) if (!row.newIds.includes(old.id)) assert.ok(row.newPunchData.some((beat) => beat.type.endsWith(old.type.endsWith("_left") ? "_left" : "_right") && old.ms - beat.ms >= -0.0001 && old.ms - beat.ms < 2000), `removed ${old.type} must follow same-hand emitted punch within gap`);
  }
  assert.deepEqual(errors, []);
  console.log(`Real BeatSaver ${mapId} selected Reimport Chromium passed: ${result.perDifficulty.map((row) => `${row.difficulty} ${row.oldPunches}->${row.punches} drops=${row.dropped} left=${row.minimumLeftMs.toFixed(1)}ms right=${row.minimumRightMs.toFixed(1)}ms`).join(", ")}`);
  await context.close();
} finally { await browser?.close(); await vite.close(); }
