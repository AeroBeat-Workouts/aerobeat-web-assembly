// @ts-check

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

const goldenV4Hash = "96e68173fffd6454bfb38740acaf58653da11320";
const v2Hash = "f8ed950c666baf9148a18e5f3b9731b3f2f23cb0";
const v3Hash = "044f279f3d43ef84380b9679b7c02cdb417765c1";
const goldenV4Info = '{"version":"4.0.0","song":{"title":"Provider Hash Golden","subTitle":"","author":"AeroBeat"},"audio":{"songFilename":"Song.egg","audioDataFilename":"AudioData.dat","bpm":120,"previewStartTime":0,"previewDuration":10},"coverImageFilename":"Cover.png","difficultyBeatmaps":[{"characteristic":"Lightshow","difficulty":"Easy","difficultyRank":1,"beatmapDataFilename":"EasyLightshow.dat","lightshowDataFilename":"SharedLightshow.dat","noteJumpMovementSpeed":10,"noteJumpStartBeatOffset":0},{"characteristic":"Standard","difficulty":"ExpertPlus","difficultyRank":9,"beatmapDataFilename":"ExpertPlusStandard.dat","lightshowDataFilename":"SharedLightshow.dat","noteJumpMovementSpeed":18,"noteJumpStartBeatOffset":0}]}';
const archives = Object.freeze({
  v4: storedZip(goldenV4Entries(false)),
  tamperedV4: storedZip(goldenV4Entries(true)),
  unsupportedV5: storedZip(goldenV4Entries(false, "5.0.0")),
  malformedVersion: storedZip(goldenV4Entries(false, "4.0.0junk")),
  versionlessV4: storedZip(goldenV4Entries(false, null)),
  v2: storedZip(syntheticLegacyEntries(2)),
  v3: storedZip(syntheticLegacyEntries(3))
});
const providerMap = syntheticMapPayload(goldenV4Hash, "https://cdn.example.invalid/v4-golden.zip", "V4GOLD", "ExpertPlus");

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", optimizeDeps: { force: true }, server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const pageUrl = vite.resolvedUrls?.local?.[0];
if (!pageUrl) throw new Error("Vite URL unavailable");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const noise = [];
page.on("console", (message) => { const type=message.type(),text=message.text(),location=message.location(); if (["warning", "error"].includes(type) && !isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,pageUrl) && !isExpectedPlaycanvasMeshWarning(type,text)) noise.push(`${type}:${text}:sourceUrl=${JSON.stringify(location.url)}:lineNumber=${location.lineNumber}:columnNumber=${location.columnNumber}`); });
page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
await page.addInitScript(() => {
  globalThis.__v4CameraRequests = 0;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { async getUserMedia() { globalThis.__v4CameraRequests += 1; return new MediaStream(); } } });
});
try {
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  const game = page.locator("aero-game"); await game.waitFor();
  await game.evaluate(async (element, fixture) => {
    const { actualV4GraphFactory } = await import("/scripts/v4-browser-services.js");
    const originalFactory = element.serviceGraphFactory; element.remove();
    globalThis.__v4AssemblyFixture = { archive: Uint8Array.from(fixture.tamperedV4), map: fixture.providerMap, events: [] };
    element.serviceGraphFactory = actualV4GraphFactory(originalFactory);
    element.addEventListener("aero-game-event", (event) => globalThis.__v4AssemblyFixture.events.push(structuredClone(event.detail)));
    document.querySelector("main")?.append(element);
  }, { tamperedV4: [...archives.tamperedV4], providerMap });

  const tamper = await game.evaluate(async (element, expectedHash) => {
    const before = await element.graph.authoring.listPackages();
    try { await element.importBeatSaverById("V4GOLD", expectedHash, { difficulty: "ExpertPlus", sourceId: "V4GOLD" }); return { rejected: false }; }
    catch (error) { const after = await element.graph.authoring.listPackages(); return { rejected: error?.code === "integrity", code: error?.code, message: error?.message, before: before.length, after: after.length }; }
  }, goldenV4Hash);
  assert.deepEqual(tamper, { rejected: true, code: "integrity", message: "BeatSaver map-content hash does not match selected provider version", before: 0, after: 0 });

  await game.evaluate((element, fixture) => { globalThis.__v4AssemblyFixture.archive = Uint8Array.from(fixture.archive); }, { archive: [...archives.v4] });
  const inspectedGolden = await game.evaluate(async (element) => { const acquired = await element.graph.vendor.importLocalArchive(globalThis.__v4AssemblyFixture.archive); return { sourceHash: acquired.sourceHash, hashInputPaths: acquired.source.manifest.hashInputPaths, hashInputs: acquired.source.manifest.hashInputPaths.map((path) => new TextDecoder().decode(acquired.source.readEntry(path))) }; });
  assert.equal(inspectedGolden.sourceHash, goldenV4Hash, `independently hard-coded v4 golden source hash: ${JSON.stringify(inspectedGolden)}`);
  const versionAdmission = await game.evaluate(async (element, fixture) => {
    const inspect = async (bytesValue) => { try { const acquired = await element.graph.vendor.importLocalArchive(Uint8Array.from(bytesValue)); return { accepted: true, major: acquired.source.manifest.infoFormatMajor }; } catch (error) { return { accepted: false, code: error?.code, message: error?.message }; } };
    return { v5: await inspect(fixture.v5), malformed: await inspect(fixture.malformed), versionless: await inspect(fixture.versionless) };
  }, { v5: [...archives.unsupportedV5], malformed: [...archives.malformedVersion], versionless: [...archives.versionlessV4] });
  assert.equal(versionAdmission.v5.accepted, false); assert.equal(versionAdmission.v5.code, "unsupported"); assert.match(versionAdmission.v5.message, /unsupported or malformed/u);
  assert.equal(versionAdmission.malformed.accepted, false); assert.equal(versionAdmission.malformed.code, "unsupported"); assert.match(versionAdmission.malformed.message, /unsupported or malformed/u);
  assert.deepEqual(versionAdmission.versionless, { accepted: true, major: 4 });
  const maps = await game.evaluate((element) => element.browseBeatSaver({ text: "golden" }));
  assert.equal(maps.maps.length, 1); assert.equal(maps.maps[0].mapId, "V4GOLD"); assert.equal(maps.maps[0].versions[0].hash, goldenV4Hash);
  const uiBefore = await game.evaluate((element) => { const presenter = element.shadowRoot.querySelector("aero-beatsaver-browser"); const checked = presenter.shadowRoot.querySelector("input[type='radio']:checked"); const button = presenter.shadowRoot.querySelector("button[data-intent='beatsaver-import']"); return { mapRadios: presenter.shadowRoot.querySelectorAll("input[type='radio']").length, checked: checked?.value, importDisabled: button?.disabled, cameraRequests: globalThis.__v4CameraRequests }; });
  assert.deepEqual(uiBefore, { mapRadios: 1, checked: "V4GOLD", importDisabled: false, cameraRequests: 0 });
  await game.evaluate((element) => element.shadowRoot.querySelector("aero-beatsaver-browser").shadowRoot.querySelector("button[data-intent='beatsaver-import']").click());
  try { await waitFor(page, async () => game.evaluate((element) => element.graph.authoring.getSnapshot().state === "complete" && element.graph.content.getSnapshot().state === "ready"), 15_000); }
  catch (error) { const state = await game.evaluate(async (element) => ({ authoring: element.graph.authoring.getSnapshot(), content: element.graph.content.getSnapshot(), vendor: element.graph.vendor.snapshot(), lastError: element.lastError, packages: (await element.graph.authoring.listPackages()).length, events: globalThis.__v4AssemblyFixture.events })); throw new Error(`${error.message}: ${JSON.stringify(state)}`, { cause: error }); }
  const v4Evidence = await integrationSnapshot(game);
  // 0.0.54 W1-A rebaseline: a fresh v4 import authors exactly two variants —
  // the sole flow_colliders_v1 and the sole no-recipe boxing_collider_v1.
  assert.equal(v4Evidence.cameraRequests, 0); assert.equal(v4Evidence.libraryCount, 1); assert.equal(v4Evidence.selectedSourceVersionHash, goldenV4Hash); assert.equal(v4Evidence.selectedDifficulty, "ExpertPlus"); assert.equal(v4Evidence.variantCount,2);assert.equal(v4Evidence.selectedRulesetId,"flow_colliders_v1");assert.deepEqual(new Set(v4Evidence.variantIdentities),new Set(["flow_colliders_v1|none","boxing_collider_v1|none"]));assert.deepEqual(v4Evidence.collider.map(({ranked,localOnly})=>({ranked,localOnly})),[{ranked:true,localOnly:false}]); assert.equal(v4Evidence.checkedLibraryRadios, 1); assert.equal(v4Evidence.contentReady, true); assert.equal(v4Evidence.rawExposure.length, 0);

  const selectedReimport = await game.evaluate(async (element) => {
    const graph = element.graph;
    const selectedId = element.libraryView.selectedCollectionId;
    const selectedPackageId = element.libraryView.selectedPackageId;
    const originalSource = await graph.vendor.importLocalArchive(globalThis.__v4AssemblyFixture.archive);
    const unrelated = await graph.authoring.convertAllStandardAndPersist(originalSource.source, { sourceProvider: "local", sourceId: "fixture-unrelated", sourceVersionHash: originalSource.sourceHash, includeAudio: true });
    await element.refreshLibrary(element.connectedGeneration, { preferredCollectionId: selectedId, preferredPackageId: selectedPackageId });
    const unrelatedBytes = [...(await graph.authoring.exportPackage(unrelated.defaultPackage.handle)).bytes];
    const authored = await graph.authoring.listCollections();
    const selected = authored.find((row) => row.collectionId === selectedId);
    const originalBytes = await graph.authoring.exportPackage({ key: selected.packages[0].packageKey, packageId: selected.packages[0].packageId });
    const originalConvert = graph.authoring.convertAllStandardAndPersist;
    const authoring = Object.freeze({ ...graph.authoring, async convertAllStandardAndPersist(...args) { if (globalThis.__v4AssemblyFixture.failConversion) throw new Error("Fixture conversion rejected"); return originalConvert(...args); } });
    element.graph = Object.freeze({ ...graph, authoring });
    const fixture = globalThis.__v4AssemblyFixture;
    const originalArchive = fixture.archive;
    const library = element.shadowRoot.querySelector("aero-content-library");
    const button = () => library.shadowRoot.querySelector("button[data-intent='library-reimport']");
    const visible = { label: button()?.textContent.trim(), disabled: button()?.disabled, beside: button()?.nextElementSibling?.textContent.trim(), collectionId: button()?.dataset.value };
    fixture.archive = Uint8Array.from([1, 2, 3]);
    button()?.click();
    await element.lifecycleIntentTail;
    const failed = { original: [...(await graph.authoring.exportPackage({ key: selected.packages[0].packageKey, packageId: selected.packages[0].packageId })).bytes], collectionCount: (await graph.authoring.listCollections()).length, unrelated: [...(await graph.authoring.exportPackage(unrelated.defaultPackage.handle)).bytes], selectedId: element.libraryView.selectedCollectionId, selectedPackageId: element.libraryView.selectedPackageId, error: element.lastError?.message };
    fixture.archive = originalArchive;
    fixture.failConversion = true;
    button()?.click();
    await element.lifecycleIntentTail;
    const conversionFailure = { original: [...(await graph.authoring.exportPackage({ key: selected.packages[0].packageKey, packageId: selected.packages[0].packageId })).bytes], unrelated: [...(await graph.authoring.exportPackage(unrelated.defaultPackage.handle)).bytes], selectedId: element.libraryView.selectedCollectionId, selectedPackageId: element.libraryView.selectedPackageId, count: (await graph.authoring.listCollections()).length, error: element.lastError?.message };
    fixture.failConversion = false;
    button()?.click();
    await element.lifecycleIntentTail;
    element.graph = graph;
    const after = await graph.authoring.listCollections();
    const current = after.find((row) => row.collectionId === selectedId);
    return { visible, before: [...originalBytes.bytes], unrelatedBytes, unrelatedAfter: [...(await graph.authoring.exportPackage(unrelated.defaultPackage.handle)).bytes], failed, conversionFailure, afterCount: after.length, current: Boolean(current), selectedId: element.libraryView.selectedCollectionId, packages: current?.packages.length, authoringState: graph.authoring.getSnapshot().state, selectedPackageId: element.libraryView.selectedPackageId, source: await graph.authoring.getCollectionReimportSource(selectedId) };
  });
  assert.deepEqual(selectedReimport.visible, { label: "Reimport", disabled: false, beside: "Reimport All", collectionId: selectedReimport.source.collectionId });
  assert.deepEqual(selectedReimport.failed.original, selectedReimport.before, "failed acquisition must retain exported package bytes");
  assert.deepEqual(selectedReimport.failed.unrelated, selectedReimport.unrelatedBytes, "failed acquisition must retain unrelated exported bytes");
  assert.deepEqual(selectedReimport.unrelatedAfter, selectedReimport.unrelatedBytes, "successful selected import must retain unrelated exported bytes");
  assert.equal(selectedReimport.failed.collectionCount, 2);
  assert.deepEqual(selectedReimport.conversionFailure.original, selectedReimport.before, "failed conversion must retain original exported bytes");
  assert.deepEqual(selectedReimport.conversionFailure.unrelated, selectedReimport.unrelatedBytes, "failed conversion must retain unrelated exported bytes");
  assert.equal(selectedReimport.conversionFailure.count, 2);
  assert.equal(selectedReimport.conversionFailure.selectedId, selectedReimport.visible.collectionId);
  assert.equal(selectedReimport.conversionFailure.selectedPackageId, v4Evidence.selectedPackageId);
  assert.ok(selectedReimport.conversionFailure.error);
  assert.equal(selectedReimport.failed.selectedId, selectedReimport.visible.collectionId);
  assert.equal(selectedReimport.failed.selectedPackageId, v4Evidence.selectedPackageId);
  assert.ok(selectedReimport.failed.error);
  assert.equal(selectedReimport.afterCount, 2);
  assert.equal(selectedReimport.current, true);
  assert.equal(selectedReimport.selectedId, selectedReimport.visible.collectionId);
  assert.equal(selectedReimport.authoringState, "complete");
  assert.ok(selectedReimport.packages >= 1);
  assert.deepEqual(selectedReimport.source, { collectionId: selectedReimport.visible.collectionId, sourceProvider: "beatsaver", sourceId: "V4GOLD", sourceVersionHash: goldenV4Hash });

  const legacyEvidence = await game.evaluate(async (element, fixture) => {
    const v2 = await element.importLocalZip(Uint8Array.from(fixture.v2), { sourceId: "LOCAL-V2" });
    const v2Loaded = await element.graph.authoring.loadPackage(v2.defaultPackage.handle); const v2Source = v2Loaded.package.source.sourceVersionHash; const v2Version = v2Loaded.package.conversionTrace.boxing[0].sourceBeatmapVersion;
    const v2Audio = element.graph.audio.getStatus(); const v2Content = element.graph.content.getSnapshot();
    const v3 = await element.importLocalZip(Uint8Array.from(fixture.v3), { sourceId: "LOCAL-V3" });
    const v3Loaded = await element.graph.authoring.loadPackage(v3.defaultPackage.handle); const packages = await element.graph.authoring.listPackages(); const content = element.graph.content.getSnapshot(); const v3Audio = element.graph.audio.getStatus();
    return { v2Source, v2Version, v2ContentState: v2Content.state, v2AudioState: v2Audio.state, v2AudioErrorCode: v2Audio.errorCode, v3Source: v3Loaded.package.source.sourceVersionHash, v3Version: v3Loaded.package.conversionTrace.boxing[0].sourceBeatmapVersion, v3ContentState: content.state, v3AudioState: v3Audio.state, v3AudioErrorCode: v3Audio.errorCode, packageCount: packages.length, selectedPackageId: content.packageId, selectedVariantId: content.selectedVariant?.variantId, cameraRequests: globalThis.__v4CameraRequests };
  }, { v2: [...archives.v2], v3: [...archives.v3] });
  assert.equal(legacyEvidence.v2Source, v2Hash); assert.equal(legacyEvidence.v3Source, v3Hash); assert.equal(legacyEvidence.v2Version, "2.6.0"); assert.equal(legacyEvidence.v3Version, "3.3.0");
  // The four-byte OggS placeholders test content compatibility, not playable music.
  assert.equal(legacyEvidence.v2ContentState, "ready"); assert.equal(legacyEvidence.v2AudioState, "error"); assert.equal(legacyEvidence.v2AudioErrorCode, "audio_decode_failed");
  assert.equal(legacyEvidence.v3ContentState, "ready"); assert.equal(legacyEvidence.v3AudioState, "error"); assert.equal(legacyEvidence.v3AudioErrorCode, "audio_decode_failed");
  assert.equal(legacyEvidence.packageCount, 4); assert.ok(legacyEvidence.selectedPackageId); assert.ok(legacyEvidence.selectedVariantId); assert.equal(legacyEvidence.cameraRequests, 0);

  const finalEvidence = await integrationSnapshot(game);
  assert.equal(finalEvidence.libraryCount, 4); assert.equal(finalEvidence.contentReady, true); assert.equal(finalEvidence.rawExposure.length, 0); assert.equal(noProductionWinner(finalEvidence.publicSnapshot), true); assert.deepEqual(noise, []);
  console.log(`Assembly v4 golden/import regression passed: vendor=7b14eec hash=${goldenV4Hash} packages=${finalEvidence.libraryCount} variants=${finalEvidence.variantCount}`);
} finally { await browser.close(); await vite.close(); }

/** @param {import("playwright").Locator} game */
async function integrationSnapshot(game) { return game.evaluate(async (element) => {
  const content = element.graph.content.getSnapshot(); const packages = await element.graph.authoring.listPackages(); const library = element.shadowRoot.querySelector("aero-content-library"); const publicSnapshot = element.getSnapshot(); const values = [publicSnapshot, ...globalThis.__v4AssemblyFixture.events]; const rawExposure = [];
  const seen = new WeakSet(); const visit = (value, path = "root") => { if (!value || typeof value !== "object" || seen.has(value)) return; seen.add(value); const ctor = value.constructor?.name ?? "Object"; if (["ArrayBuffer", "Uint8Array", "Blob", "File", "MediaStream", "VideoFrame"].includes(ctor)) rawExposure.push(`${path}:${ctor}`); for (const [key, child] of Object.entries(value)) { if (/zipBytes|audioBytes|rawBytes|pixels|screenshots/iu.test(key)) rawExposure.push(`${path}.${key}`); visit(child, `${path}.${key}`); } }; values.forEach((value, index) => visit(value, `value${index}`));
  return { cameraRequests: globalThis.__v4CameraRequests, libraryCount: packages.length, selectedSourceVersionHash: content.lineage?.sourceVersionHash ?? null, selectedDifficulty: content.lineage?.difficulty ?? null, selectedPackageId: content.packageId, selectedVariantId: content.selectedVariant?.variantId,selectedRulesetId:content.selectedVariant?.rulesetId,variantIdentities:content.variants.map((variant)=>`${variant.rulesetId}|${variant.recipeId??"none"}`),collider:content.variants.filter((variant)=>variant.rulesetId==="flow_colliders_v1").map((variant)=>({ranked:variant.ranked,localOnly:variant.localOnly,chartId:variant.chartId,mapHash:variant.mapHash.value})), variantCount: content.variants.length, checkedLibraryRadios: library.shadowRoot.querySelectorAll("input[type='radio']:checked").length, contentReady: Boolean(content.packageId && content.selectedVariant), rawExposure, publicSnapshot };
}); }

function noProductionWinner(snapshot) { const text = JSON.stringify(snapshot); return !/production.?winner/iu.test(text) && !/"winner"\s*:/iu.test(text); }
async function waitFor(page, predicate, timeoutMs) { const started = Date.now(); while (Date.now() - started < timeoutMs) { if (await predicate()) return; await page.waitForTimeout(50); } throw new Error("Timed out waiting for v4 assembly import"); }

function goldenV4Entries(tampered, declaredVersion = "4.0.0") { const info = JSON.parse(goldenV4Info); if (declaredVersion === null) delete info.version; else info.version = declaredVersion; return Object.freeze({
  "Info.dat": bytes(JSON.stringify(info)), "Song.egg": Uint8Array.of(71,79,76,68,69,78),
  "AudioData.dat": bytes(tampered ? '{"version":"4.0.0","songChecksum":"tampered"}' : '{"version":"4.0.0","songChecksum":"golden"}'),
  "Cover.png": Uint8Array.of(137,80,78,71), "EasyLightshow.dat": bytes('{"version":"4.0.0","basicBeatmapEvents":[]}'),
  "SharedLightshow.dat": bytes('{"version":"4.0.0","lightColorEventBoxGroups":[{"b":1}]}'),
  "ExpertPlusStandard.dat": bytes('{"version":"4.0.0","colorNotesData":[{"x":1,"y":1,"c":0,"d":1}],"colorNotes":[{"b":1,"i":0}]}')
}); }
function syntheticLegacyEntries(major) { const info = { _version:"2.1.0",_songName:major===3?"Synthetic Three":"Synthetic Two",_songAuthorName:"AeroBeat",_levelAuthorName:"Fixture",_songFilename:"Audio/Song.egg",_coverImageFilename:"Cover.PNG",_beatsPerMinute:128,_difficultyBeatmapSets:[{_beatmapCharacteristicName:"Standard",_difficultyBeatmaps:[{_difficulty:"Expert",_difficultyRank:7,_beatmapFilename:"Maps/Expert.dat",_noteJumpMovementSpeed:14,_noteJumpStartBeatOffset:0}]}] }; const difficulty = major === 3 ? {version:"3.3.0",colorNotes:[{b:1,x:0,y:1,c:0,d:1},{b:2,x:3,y:1,c:1,d:0}],obstacles:[{b:3,d:1,x:1,y:0,w:2,h:3}]} : {_version:"2.6.0",_notes:[{_time:1,_lineIndex:0,_lineLayer:1,_type:0,_cutDirection:1},{_time:2,_lineIndex:3,_lineLayer:1,_type:1,_cutDirection:0}],_obstacles:[{_time:3,_duration:1,_lineIndex:1,_type:0,_width:2}]}; return Object.freeze({"Info.dat":bytes(JSON.stringify(info)),"Audio/Song.egg":Uint8Array.of(79,103,103,83),"Cover.PNG":Uint8Array.of(137,80,78,71),"Maps/Expert.dat":bytes(JSON.stringify(difficulty))}); }
function syntheticMapPayload(hash, downloadUrl, mapId, difficulty) { return { id:mapId,name:"Provider Hash Golden",description:"Deterministic assembly fixture",tags:["balanced"],metadata:{songName:"Provider Hash Golden",songSubName:"",songAuthorName:"AeroBeat",levelAuthorName:"Fixture",bpm:120,duration:60},uploader:{id:1,name:"Fixture",avatar:"https://cdn.example.invalid/avatar.png"},stats:{downloads:10,plays:5,upvotes:4,downvotes:1,score:.8},versions:[{hash,key:mapId,state:"Published",createdAt:"2026-01-01T00:00:00Z",downloadURL:downloadUrl,coverURL:"https://cdn.example.invalid/cover.png",previewURL:"https://cdn.example.invalid/preview.ogg",diffs:[{characteristic:"Standard",difficulty,notes:20,bombs:0,obstacles:0,njs:18,nps:2,seconds:60}]}],createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",uploaded:"2026-01-01T00:00:00Z",ranked:false,qualified:false,automapper:false,declaredAi:false }; }
function bytes(value) { return new TextEncoder().encode(value); }
function storedZip(entries) { const local=[]; const central=[]; let offset=0; for(const [name,value] of Object.entries(entries)){const nameBytes=bytes(name),crc=crc32(value),header=new Uint8Array(30+nameBytes.length);write32(header,0,0x04034b50);write16(header,4,20);write16(header,6,0x800);write16(header,8,0);write16(header,10,0);write16(header,12,0x21);write32(header,14,crc);write32(header,18,value.length);write32(header,22,value.length);write16(header,26,nameBytes.length);header.set(nameBytes,30);local.push(header,value);const record=new Uint8Array(46+nameBytes.length);write32(record,0,0x02014b50);write16(record,4,20);write16(record,6,20);write16(record,8,0x800);write16(record,10,0);write16(record,12,0);write16(record,14,0x21);write32(record,16,crc);write32(record,20,value.length);write32(record,24,value.length);write16(record,28,nameBytes.length);write32(record,38,0x20);write32(record,42,offset);record.set(nameBytes,46);central.push(record);offset+=header.length+value.length;}const centralOffset=offset,centralSize=central.reduce((sum,value)=>sum+value.length,0),end=new Uint8Array(22);write32(end,0,0x06054b50);write16(end,8,central.length);write16(end,10,central.length);write32(end,12,centralSize);write32(end,16,centralOffset);return concat([...local,...central,end]); }
function concat(parts){const length=parts.reduce((sum,value)=>sum+value.length,0),result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
function write16(bytesValue,offset,value){new DataView(bytesValue.buffer).setUint16(offset,value,true);}function write32(bytesValue,offset,value){new DataView(bytesValue.buffer).setUint32(offset,value>>>0,true);}function crc32(bytesValue){let crc=0xffffffff;for(const byte of bytesValue){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
