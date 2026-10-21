// @ts-check
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { handlerForSnapshot, loadSignedSnapshot } from "./serve-friend-game.js";

const mapId = "54510", hash = "f5c04797fe0831741adec66ce5386971153919d4";
const repetitionMode = process.env.AEROBEAT_REPETITION_TEST === "1";
const kneeMode = process.env.AEROBEAT_KNEE_TEST === "1";
assert.ok(process.env.AEROBEAT_REPETITION_TEST === undefined || repetitionMode, "repetition test mode must be 1 when specified");
assert.ok(process.env.AEROBEAT_KNEE_TEST === undefined || kneeMode, "knee test mode must be 1 when specified");
const archive = await readFile(`/tmp/aerobeat-${mapId}-${hash}.zip`);
assert.equal(createHash("sha256").update(archive).digest("hex"), "0dc3f98537c679cb8e96ffc5d079a1e0cbb9ae59df571f693a67a53c5d051db3");
const signedDirectory = process.env.AEROBEAT_SIGNED_BOXING_DIR;
const vite = signedDirectory ? null : await createViteServer({ logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false } });
let browser, parent, signedServer;
try {
  let url;
  if (signedDirectory) {
    const snapshot = loadSignedSnapshot(path.resolve(signedDirectory));
    assert.ok(["0.0.140", "0.0.141", "0.0.142"].includes(snapshot.manifest.sourceManifest.packageVersion), "selected-song QA requires a signed Boxer baseline or successor");
    signedServer = createHttpServer(handlerForSnapshot(snapshot));
    await new Promise((resolve) => signedServer.listen(0, "127.0.0.1", resolve));
    const signedAddress = signedServer.address(); assert.ok(signedAddress && typeof signedAddress !== "string");
    url = `http://127.0.0.1:${signedAddress.port}/`;
  } else {
    await vite.listen();
    url = vite.resolvedUrls?.local?.[0];
  }
  assert.ok(url);
  parent = createHttpServer((_request, response) => { response.setHeader("content-type", "text/html; charset=utf-8"); response.end(`<!doctype html><iframe allow="camera; autoplay" style="width:390px;height:844px" src="${url}"></iframe>`); });
  await new Promise((resolve) => parent.listen(0, "127.0.0.1", resolve));
  const address = parent.address(); assert.ok(address && typeof address !== "string");
  browser = await chromium.launch();
  for (const embedding of ["direct", "iframe"]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__same_hand_54510.zip", (route) => route.fulfill({ status: 200, contentType: "application/zip", body: archive }));
  await page.goto(embedding === "direct" ? url : `http://localhost:${address.port}/`, { waitUntil: "networkidle" });
  const child = embedding === "direct" ? page : page.frames().find((frame) => frame !== page.mainFrame()); assert.ok(child);
  const game = child.locator("aero-game"); await game.waitFor();
  const result = await game.evaluate(async (element, fixture) => {
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
    const contentHashBeforeSettings = graph.content.getSnapshot().packageHash;
    const input = element.shadowRoot.querySelector("input[data-game-setup-field='sameHandPunchMinGapMs']");
    input.value = "2000"; input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    await element.lifecycleIntentTail;
    if (fixture.repetition) for (const field of ["repeatedPunchSwitchChancePercent", "repeatedGuardReplaceChancePercent"]) {
      const chance = element.shadowRoot.querySelector(`input[data-game-setup-field='${field}']`);
      if (!(chance instanceof HTMLInputElement)) throw new Error(`Missing approved ${field} control`);
      chance.value = "100"; chance.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      await element.lifecycleIntentTail;
    }
    if (fixture.knee) {
      const enabled=element.shadowRoot.querySelector("input[data-game-setup-field='kneeStrikesEnabled']");
      const chance=element.shadowRoot.querySelector("input[data-game-setup-field='kneeStrikeChancePercent']");
      if (!(enabled instanceof HTMLInputElement) || !(chance instanceof HTMLInputElement) || !enabled.checked || chance.value!=="0") throw new Error("Approved knee switch/chance defaults are missing");
      chance.value="100";chance.dispatchEvent(new Event("change",{bubbles:true,composed:true}));await element.lifecycleIntentTail;
      if (element.desiredGameSetup.kneeStrikeChancePercent!==100) throw new Error("Knee chance was not applied to selected-song Reimport");
    }
    const unchangedBeforeReimport = (await graph.authoring.listCollections()).find((entry) => entry.collectionId === initial.collection.collectionId)?.packages.map((entry) => entry.packageId);
    const liveHashBeforeReimport = graph.content.getSnapshot().packageHash;
    const oldPackageIds = initial.packages.map((entry) => entry.packageId);
    const originalGet = graph.vendor.getMapById, originalAcquire = graph.vendor.acquireVersion;
    const calls = [];
    graph.vendor.getMapById = async (id) => { calls.push({ kind: "map", id }); return { mapId: fixture.mapId, versions: [{ hash: fixture.hash, downloadUrl: "https://fixture.invalid/archive.zip" }] }; };
    graph.vendor.acquireVersion = async (map, selectedHash) => { calls.push({ kind: "version", id: map.mapId, hash: selectedHash }); return acquired; };
    try { button()?.click(); await element.lifecycleIntentTail; } finally { graph.vendor.getMapById = originalGet; graph.vendor.acquireVersion = originalAcquire; }
    await new Promise((resolve)=>setTimeout(resolve,0));
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
      const trace = tuned.conversionTrace.boxing[0];
      const changed = (kind) => trace.events.filter((event) => event.action === "emit" && event.kind === "punch" && event.repetition?.kind === kind);
      const kneeChart=tuned.charts.find((chart)=>chart.prototype?.rulesetId==="boxing_collider_knee_v1");
      const kneeBeats=kneeChart?.beats.filter((beat)=>beat.type==="knee_left"||beat.type==="knee_right")??[];
      const noKneeBeats=boxing.beats.filter((beat)=>beat.type==="knee_left"||beat.type==="knee_right");
      return { kneeChartCount:kneeChart?1:0,kneeChartId:kneeChart?.chartId,kneeBeats:kneeBeats.map((beat)=>({type:beat.type,cell:beat.spatialTarget?.targetCell})),noKneeBeatCount:noKneeBeats.length,difficulty: tuned.source.difficulty, minimumLeftMs: minimum("left"), minimumRightMs: minimum("right"), oldPunches: oldPunches.length, punches: punches.length, dropped: trace.events.filter((event) => event.reason === "same_hand_beat_min_gap").length, switched: changed("repeated_punch_switched").length, replaced: changed("repeated_guard_replaced").length, recordedSwitchChance: trace.optimizer.repeatedPunchSwitchChancePercent ?? 0, recordedGuardChance: trace.optimizer.repeatedGuardReplaceChancePercent ?? 0, flowUnchanged: JSON.stringify(flow) === JSON.stringify(oldFlow) };
    });
    const active = graph.content.getSnapshot();
    const activeIndex = selected.packages.findIndex((entry) => entry.packageId === active.packageId);
    if (activeIndex < 0) throw new Error("Connected game selected an unrelated song after Reimport");
    const boxerVariant = active.variants.find((entry) => entry.mode === "boxing");
    if (!boxerVariant) throw new Error("Selected song has no Boxing variant");
    await graph.content.selectVariant(boxerVariant.variantId);
    const liveBoxing = graph.content.getSnapshot();
    const liveIds = new Set(liveBoxing.resolvedEvents.map((entry) => entry.eventId));
    const expectedChanged = after[activeIndex].package.conversionTrace.boxing[0].events.filter((entry) => entry.action === "emit" && entry.kind === "punch" && ["repeated_punch_switched", "repeated_guard_replaced"].includes(entry.repetition?.kind)).map((entry) => entry.eventId);
    const liveChangedIds = expectedChanged.filter((id) => liveIds.has(id));
    let kneeSelection=null;
    if (fixture.knee) {
      await element.selectGameplayAxes("boxing_collider_v1");
      const selectedKnee=graph.content.getSnapshot();
      const kneeTargets=element.rendererFrame().targets.filter((target)=>target.kind==="knee");
      const toggle=element.shadowRoot.querySelector("input[data-game-setup-field='kneeStrikesEnabled']");
      toggle.checked=false;toggle.dispatchEvent(new Event("change",{bubbles:true,composed:true}));await element.lifecycleIntentTail;
      await element.selectGameplayAxes("boxing_collider_v1");
      const noKnee=graph.content.getSnapshot();
      kneeSelection={loadedHash:selectedKnee.packageHash?.value,storedHash:after[activeIndex].handle?.packageHash?.value,onRuleset:selectedKnee.selectedVariant?.rulesetId,offRuleset:noKnee.selectedVariant?.rulesetId,onKneeEvents:selectedKnee.resolvedEvents.filter((entry)=>/^knee_(left|right)$/u.test(entry.authoredBeat?.type)).length,offKneeEvents:noKnee.resolvedEvents.filter((entry)=>/^knee_(left|right)$/u.test(entry.authoredBeat?.type)).length,renderedKneeTargets:kneeTargets.map((target)=>({family:target.family,cell:target.cell})),error:element.lastError?.message??null};
    }
    return { kneeSelection, ui, calls, liveHashStableBeforeReimport: liveHashBeforeReimport === contentHashBeforeSettings, liveBoxingEvents: liveBoxing.resolvedEvents.length, liveUniqueBoxingIds: liveIds.size, changedEventsInLiveBoxing: liveChangedIds.length, expectedChangedInSelectedChart: expectedChanged.length, gap: element.desiredGameSetup.sameHandPunchMinGapMs, switchChance: element.desiredGameSetup.repeatedPunchSwitchChancePercent, guardChance: element.desiredGameSetup.repeatedGuardReplaceChancePercent, previous: oldPackageIds, unchangedBeforeReimport, afterIds: selected.packages.map((entry) => entry.packageId), count: (await graph.authoring.listCollections()).length, selectedId: element.libraryView.selectedCollectionId, otherUnchanged: JSON.stringify(otherBytes) === JSON.stringify([...(await graph.authoring.exportPackage(unrelated.defaultPackage.handle)).bytes]), perDifficulty, error: element.lastError?.message ?? null };
  }, { mapId, hash, repetition: repetitionMode, knee: kneeMode });
  assert.deepEqual(result.ui, { text: "Reimport", disabled: false, collectionId: result.selectedId });
  assert.deepEqual(result.calls, [{ kind: "map", id: mapId }, { kind: "version", id: mapId, hash }]);
  assert.equal(result.gap, 2000);
   assert.equal(result.switchChance, repetitionMode ? 100 : 0);
   assert.equal(result.guardChance, repetitionMode ? 100 : 0);
   if(kneeMode){
     assert.ok(result.kneeSelection?.storedHash,"selected Reimport must persist an authored package hash");
     assert.equal(result.kneeSelection.loadedHash,result.kneeSelection.storedHash,"selected Reimport must load the new dual-Boxer package, not retain the prior chart");
     assert.equal(result.kneeSelection.onRuleset,"boxing_collider_knee_v1","default-on selects the knee chart after selected-song Reimport");
     assert.equal(result.kneeSelection.offRuleset,"boxing_collider_v1","off selects the independently authored no-knee chart");
     assert.equal(result.kneeSelection.offKneeEvents,0);
     assert.ok(result.kneeSelection.onKneeEvents>0,"real 54510 emitted knee beats at 100% chance");
     assert.ok(result.kneeSelection.renderedKneeTargets.every((target)=>target.cell===(target.family==="knee_left"?9:10)),"visible-window knee targets use authored lowest-row cells");
     assert.equal(result.kneeSelection.error,null);
   }
  assert.deepEqual(result.unchangedBeforeReimport, result.previous, "setup edit does not reprocess stored charts");
   assert.equal(result.liveHashStableBeforeReimport, true, "settings do not silently reprocess the loaded chart before Reimport");
   assert.ok(result.liveBoxingEvents > 0, "connected selected song exposes actual Boxing runtime events");
   assert.equal(result.liveUniqueBoxingIds, result.liveBoxingEvents, "a converted guard adds at most one scored timeline event per unique identity");
   if (repetitionMode) { assert.ok(result.perDifficulty.some((row) => row.switched > 0), "real song emits switched punches"); assert.ok(result.perDifficulty.some((row) => row.replaced > 0), "real song emits guard replacements"); assert.ok(result.expectedChangedInSelectedChart > 0); assert.equal(result.changedEventsInLiveBoxing, result.expectedChangedInSelectedChart, "selected Play/Test Boxer timeline retains every B-authored punch after selection reprocess"); }
  assert.equal(result.count, 2, "selected reimport keeps one selected and one unrelated collection");
  assert.equal(result.otherUnchanged, true);
  assert.equal(result.error, null, "selected reimport must leave no runtime error");
  assert.ok(result.perDifficulty.length >= 2, "all Standard difficulties reimport");
  for (const row of result.perDifficulty) {
    assert.ok(row.minimumLeftMs >= 1999.9999 && row.minimumRightMs >= 1999.9999, `real ${row.difficulty} chart honors per-hand song ms gap`);
    assert.ok(row.dropped > 0, `real ${row.difficulty} records gap drops`);
    if (!repetitionMode) assert.ok(row.punches < row.oldPunches, `real ${row.difficulty} removes repeated punches`);
    if (repetitionMode) { assert.equal(row.recordedSwitchChance, 100); assert.equal(row.recordedGuardChance, 100); }
    else { assert.equal(row.recordedSwitchChance, 0); assert.equal(row.recordedGuardChance, 0); }
    assert.equal(row.flowUnchanged, true, `real ${row.difficulty} Flow unchanged`);
    if(kneeMode){assert.equal(row.kneeChartCount,1,`real ${row.difficulty} authors one distinct knee chart`);assert.equal(row.noKneeBeatCount,0,`real ${row.difficulty} no-knee chart retains zero knee events`);assert.ok(row.kneeBeats.every((beat,index)=>beat.type===(index%2===0?"knee_left":"knee_right")&&beat.cell===(index%2===0?9:10)),`real ${row.difficulty} knee beats alternate left/right in authored 9/10 cells`);}
    else assert.equal(row.kneeBeats.length,0,"0% chance preserves old Boxing event families even when knee chart exists");
  }
  assert.deepEqual(errors, []);
  console.log(`${embedding} ${signedDirectory ? "signed " : ""}Real BeatSaver ${mapId} selected ${repetitionMode ? "B100 repetition + " : ""}Reimport Chromium passed: ${result.perDifficulty.map((row) => `${row.difficulty} ${row.oldPunches}->${row.punches} drops=${row.dropped} switched=${row.switched} replaced=${row.replaced} left=${row.minimumLeftMs.toFixed(1)}ms right=${row.minimumRightMs.toFixed(1)}ms`).join(", ")}`);
  await context.close();
  }
} finally { await browser?.close(); await new Promise((resolve) => parent?.close(resolve) ?? resolve()); await new Promise((resolve) => signedServer?.close(resolve) ?? resolve()); await vite?.close(); }
