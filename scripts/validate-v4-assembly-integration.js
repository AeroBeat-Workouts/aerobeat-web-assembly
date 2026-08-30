// @ts-check

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const goldenV4Hash = "96e68173fffd6454bfb38740acaf58653da11320";
const v2Hash = "f8ed950c666baf9148a18e5f3b9731b3f2f23cb0";
const v3Hash = "f40cee1a11222c29ccdabb3193c83b9d25a837a4";
const goldenV4Info = '{"version":"4.0.0","song":{"title":"Provider Hash Golden","subTitle":"","author":"AeroBeat"},"audio":{"songFilename":"Song.egg","audioDataFilename":"AudioData.dat","bpm":120,"previewStartTime":0,"previewDuration":10},"coverImageFilename":"Cover.png","difficultyBeatmaps":[{"characteristic":"Lightshow","difficulty":"Easy","difficultyRank":1,"beatmapDataFilename":"EasyLightshow.dat","lightshowDataFilename":"SharedLightshow.dat","noteJumpMovementSpeed":10,"noteJumpStartBeatOffset":0},{"characteristic":"Standard","difficulty":"ExpertPlus","difficultyRank":9,"beatmapDataFilename":"ExpertPlusStandard.dat","lightshowDataFilename":"SharedLightshow.dat","noteJumpMovementSpeed":18,"noteJumpStartBeatOffset":0}]}';
const archives = Object.freeze({
  v4: storedZip(goldenV4Entries(false)),
  tamperedV4: storedZip(goldenV4Entries(true)),
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
page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
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
  const maps = await game.evaluate((element) => element.browseBeatSaver({ text: "golden" }));
  assert.equal(maps.maps.length, 1); assert.equal(maps.maps[0].mapId, "V4GOLD"); assert.equal(maps.maps[0].versions[0].hash, goldenV4Hash);
  const uiBefore = await game.evaluate((element) => { const presenter = element.shadowRoot.querySelector("aero-beatsaver-browser"); const checked = presenter.shadowRoot.querySelector("input[type='radio']:checked"); const button = presenter.shadowRoot.querySelector("button[data-intent='beatsaver-import']"); return { mapRadios: presenter.shadowRoot.querySelectorAll("input[type='radio']").length, checked: checked?.value, importDisabled: button?.disabled, cameraRequests: globalThis.__v4CameraRequests }; });
  assert.deepEqual(uiBefore, { mapRadios: 1, checked: "V4GOLD", importDisabled: false, cameraRequests: 0 });
  await game.evaluate((element) => element.shadowRoot.querySelector("aero-beatsaver-browser").shadowRoot.querySelector("button[data-intent='beatsaver-import']").click());
  try { await waitFor(page, async () => game.evaluate((element) => element.graph.authoring.getSnapshot().state === "complete" && element.graph.content.getSnapshot().state === "ready"), 15_000); }
  catch (error) { const state = await game.evaluate(async (element) => ({ authoring: element.graph.authoring.getSnapshot(), content: element.graph.content.getSnapshot(), vendor: element.graph.vendor.snapshot(), lastError: element.lastError, packages: (await element.graph.authoring.listPackages()).length, events: globalThis.__v4AssemblyFixture.events })); throw new Error(`${error.message}: ${JSON.stringify(state)}`, { cause: error }); }
  const v4Evidence = await integrationSnapshot(game);
  assert.equal(v4Evidence.cameraRequests, 0); assert.equal(v4Evidence.libraryCount, 1); assert.equal(v4Evidence.selectedSourceVersionHash, goldenV4Hash); assert.equal(v4Evidence.selectedDifficulty, "ExpertPlus"); assert.ok(v4Evidence.variantCount >= 5); assert.equal(v4Evidence.checkedLibraryRadios, 1); assert.equal(v4Evidence.musicReady, true); assert.equal(v4Evidence.rawExposure.length, 0);

  const legacyEvidence = await game.evaluate(async (element, fixture) => {
    const v2 = await element.importLocalZip(Uint8Array.from(fixture.v2), { sourceId: "LOCAL-V2" });
    const v2Loaded = await element.graph.authoring.loadPackage(v2.defaultPackage.handle); const v2Source = v2Loaded.package.source.sourceVersionHash; const v2Major = v2Loaded.package.conversionTrace.boxing[0].sourceBeatmapVersion;
    const v3 = await element.importLocalZip(Uint8Array.from(fixture.v3), { sourceId: "LOCAL-V3" });
    const v3Loaded = await element.graph.authoring.loadPackage(v3.defaultPackage.handle); const packages = await element.graph.authoring.listPackages(); const content = element.graph.content.getSnapshot();
    return { v2Source, v2Major, v3Source: v3Loaded.package.source.sourceVersionHash, v3Major: v3Loaded.package.conversionTrace.boxing[0].sourceBeatmapVersion, packageCount: packages.length, selectedPackageId: content.packageId, selectedVariantId: content.selectedVariant?.variantId, cameraRequests: globalThis.__v4CameraRequests };
  }, { v2: [...archives.v2], v3: [...archives.v3] });
  assert.equal(legacyEvidence.v2Source, v2Hash); assert.equal(legacyEvidence.v3Source, v3Hash); assert.equal(legacyEvidence.v2Major, "v2"); assert.equal(legacyEvidence.v3Major, "v3"); assert.equal(legacyEvidence.packageCount, 3); assert.ok(legacyEvidence.selectedPackageId); assert.ok(legacyEvidence.selectedVariantId); assert.equal(legacyEvidence.cameraRequests, 0);

  const finalEvidence = await integrationSnapshot(game);
  assert.equal(finalEvidence.libraryCount, 3); assert.equal(finalEvidence.musicReady, true); assert.equal(finalEvidence.rawExposure.length, 0); assert.equal(noProductionWinner(finalEvidence.publicSnapshot), true); assert.deepEqual(noise, []);
  console.log(`Assembly v4 golden/import regression passed: vendor=7b14eec hash=${goldenV4Hash} packages=${finalEvidence.libraryCount} variants=${finalEvidence.variantCount}`);
} finally { await browser.close(); await vite.close(); }

/** @param {import("playwright").Locator} game */
async function integrationSnapshot(game) { return game.evaluate(async (element) => {
  const content = element.graph.content.getSnapshot(); const packages = await element.graph.authoring.listPackages(); const library = element.shadowRoot.querySelector("aero-content-library"); const publicSnapshot = element.getSnapshot(); const values = [publicSnapshot, ...globalThis.__v4AssemblyFixture.events]; const rawExposure = [];
  const seen = new WeakSet(); const visit = (value, path = "root") => { if (!value || typeof value !== "object" || seen.has(value)) return; seen.add(value); const ctor = value.constructor?.name ?? "Object"; if (["ArrayBuffer", "Uint8Array", "Blob", "File", "MediaStream", "VideoFrame"].includes(ctor)) rawExposure.push(`${path}:${ctor}`); for (const [key, child] of Object.entries(value)) { if (/zipBytes|audioBytes|rawBytes|pixels|screenshots/iu.test(key)) rawExposure.push(`${path}.${key}`); visit(child, `${path}.${key}`); } }; values.forEach((value, index) => visit(value, `value${index}`));
  return { cameraRequests: globalThis.__v4CameraRequests, libraryCount: packages.length, selectedSourceVersionHash: content.lineage?.sourceVersionHash ?? null, selectedDifficulty: content.lineage?.difficulty ?? null, selectedPackageId: content.packageId, selectedVariantId: content.selectedVariant?.variantId, variantCount: content.variants.length, checkedLibraryRadios: library.shadowRoot.querySelectorAll("input[type='radio']:checked").length, musicReady: Boolean(content.packageId && content.selectedVariant), rawExposure, publicSnapshot };
}); }

function noProductionWinner(snapshot) { const text = JSON.stringify(snapshot); return !/production.?winner/iu.test(text) && !/"winner"\s*:/iu.test(text); }
async function waitFor(page, predicate, timeoutMs) { const started = Date.now(); while (Date.now() - started < timeoutMs) { if (await predicate()) return; await page.waitForTimeout(50); } throw new Error("Timed out waiting for v4 assembly import"); }

function goldenV4Entries(tampered) { return Object.freeze({
  "Info.dat": bytes(goldenV4Info), "Song.egg": Uint8Array.of(71,79,76,68,69,78),
  "AudioData.dat": bytes(tampered ? '{"version":"4.0.0","songChecksum":"tampered"}' : '{"version":"4.0.0","songChecksum":"golden"}'),
  "Cover.png": Uint8Array.of(137,80,78,71), "EasyLightshow.dat": bytes('{"version":"4.0.0","basicBeatmapEvents":[]}'),
  "SharedLightshow.dat": bytes('{"version":"4.0.0","lightColorEventBoxGroups":[{"b":1}]}'),
  "ExpertPlusStandard.dat": bytes('{"version":"4.0.0","colorNotesData":[{"x":1,"y":1,"c":0,"d":1}],"colorNotes":[{"b":1,"i":0}]}')
}); }
function syntheticLegacyEntries(major) { const info = major === 3 ? { version:"3.0.0",songName:"Synthetic Three",songAuthorName:"AeroBeat",levelAuthorName:"Fixture",songFilename:"Audio/Song.egg",coverImageFilename:"Cover.PNG",beatsPerMinute:128,difficultyBeatmapSets:[{beatmapCharacteristicName:"Standard",difficultyBeatmaps:[{difficulty:"Expert",difficultyRank:7,beatmapFilename:"Maps/Expert.dat",noteJumpMovementSpeed:14,noteJumpStartBeatOffset:0}]}] } : { _version:"2.1.0",_songName:"Synthetic Two",_songAuthorName:"AeroBeat",_levelAuthorName:"Fixture",_songFilename:"Audio/Song.egg",_coverImageFilename:"Cover.PNG",_beatsPerMinute:128,_difficultyBeatmapSets:[{_beatmapCharacteristicName:"Standard",_difficultyBeatmaps:[{_difficulty:"Expert",_difficultyRank:7,_beatmapFilename:"Maps/Expert.dat",_noteJumpMovementSpeed:14,_noteJumpStartBeatOffset:0}]}] }; const difficulty = major === 3 ? {version:"3.3.0",colorNotes:[{b:1,x:0,y:1,c:0,d:1},{b:2,x:3,y:1,c:1,d:0}],obstacles:[{b:3,d:1,x:1,y:0,w:2,h:3}]} : {_version:"2.6.0",_notes:[{_time:1,_lineIndex:0,_lineLayer:1,_type:0,_cutDirection:1},{_time:2,_lineIndex:3,_lineLayer:1,_type:1,_cutDirection:0}],_obstacles:[{_time:3,_duration:1,_lineIndex:1,_type:0,_width:2}]}; return Object.freeze({"Info.dat":bytes(JSON.stringify(info)),"Audio/Song.egg":Uint8Array.of(79,103,103,83),"Cover.PNG":Uint8Array.of(137,80,78,71),"Maps/Expert.dat":bytes(JSON.stringify(difficulty))}); }
function syntheticMapPayload(hash, downloadUrl, mapId, difficulty) { return { id:mapId,name:"Provider Hash Golden",description:"Deterministic assembly fixture",tags:["balanced"],metadata:{songName:"Provider Hash Golden",songSubName:"",songAuthorName:"AeroBeat",levelAuthorName:"Fixture",bpm:120,duration:60},uploader:{id:1,name:"Fixture",avatar:"https://cdn.example.invalid/avatar.png"},stats:{downloads:10,plays:5,upvotes:4,downvotes:1,score:.8},versions:[{hash,key:mapId,state:"Published",createdAt:"2026-01-01T00:00:00Z",downloadURL:downloadUrl,coverURL:"https://cdn.example.invalid/cover.png",previewURL:"https://cdn.example.invalid/preview.ogg",diffs:[{characteristic:"Standard",difficulty,notes:20,bombs:0,obstacles:0,njs:18,nps:2,seconds:60}]}],createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",uploaded:"2026-01-01T00:00:00Z",ranked:false,qualified:false,automapper:false,declaredAi:false }; }
function bytes(value) { return new TextEncoder().encode(value); }
function storedZip(entries) { const local=[]; const central=[]; let offset=0; for(const [name,value] of Object.entries(entries)){const nameBytes=bytes(name),crc=crc32(value),header=new Uint8Array(30+nameBytes.length);write32(header,0,0x04034b50);write16(header,4,20);write16(header,6,0x800);write16(header,8,0);write16(header,10,0);write16(header,12,0x21);write32(header,14,crc);write32(header,18,value.length);write32(header,22,value.length);write16(header,26,nameBytes.length);header.set(nameBytes,30);local.push(header,value);const record=new Uint8Array(46+nameBytes.length);write32(record,0,0x02014b50);write16(record,4,20);write16(record,6,20);write16(record,8,0x800);write16(record,10,0);write16(record,12,0);write16(record,14,0x21);write32(record,16,crc);write32(record,20,value.length);write32(record,24,value.length);write16(record,28,nameBytes.length);write32(record,38,0x20);write32(record,42,offset);record.set(nameBytes,46);central.push(record);offset+=header.length+value.length;}const centralOffset=offset,centralSize=central.reduce((sum,value)=>sum+value.length,0),end=new Uint8Array(22);write32(end,0,0x06054b50);write16(end,8,central.length);write16(end,10,central.length);write32(end,12,centralSize);write32(end,16,centralOffset);return concat([...local,...central,end]); }
function concat(parts){const length=parts.reduce((sum,value)=>sum+value.length,0),result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
function write16(bytesValue,offset,value){new DataView(bytesValue.buffer).setUint16(offset,value,true);}function write32(bytesValue,offset,value){new DataView(bytesValue.buffer).setUint32(offset,value>>>0,true);}function crc32(bytesValue){let crc=0xffffffff;for(const byte of bytesValue){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
