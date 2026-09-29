// @ts-check
import assert from "node:assert/strict";
import { createAeroWebContentAuthoringService } from "@aerobeat/web-content-authoring";
import { createAeroContentRuntime } from "@aerobeat/web-content";

const map = new TextEncoder().encode(JSON.stringify({ version:"3.3.0", colorNotes:[{b:2,x:1,y:2,c:0,d:0},{b:4,x:2,y:1,c:1,d:8}], bombNotes:[], obstacles:[], sliders:[], burstSliders:[] }));
const entries = new Map([["info.dat",new TextEncoder().encode("{}")],["hard.dat",map],["song.ogg",new Uint8Array([1,2,3])]]);
const source = {
  manifest:{schemaId:"aerobeat.beatsaver-source-manifest.v2",infoFormatMajor:2,infoFormat:"v2",infoVersion:"2.1.0",infoPath:"Info.dat",hashInputPaths:["Hard.dat"],songName:"Live Layout",songSubName:"",songAuthorName:"",levelAuthorName:"",audioPath:"song.ogg",coverPath:"",bpm:120,previewStartSeconds:0,previewDurationSeconds:0,difficulties:[{characteristic:"Standard",difficulty:"Hard",difficultyRank:5,path:"Hard.dat",beatMapFormatMajor:3,beatMapFormat:"v3",beatMapVersion:"3.3.0",notePalette:null,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:0}],entries:[],archiveBytes:0,expandedBytes:0},
  listEntryPaths(){return ["Info.dat","Hard.dat","song.ogg"];},
  readEntry(path){return Uint8Array.from(entries.get(path.toLowerCase()));}
};
const authoring=createAeroWebContentAuthoringService();
const imported=await authoring.convertAndPersist({source},{difficulty:"Hard",sourceId:"live-layout",sourceVersionHash:"v1",includeAudio:true,cacheSourceEntries:true,converterSettings:{uppercutOppositeLane:false,anyOppositeLane:true}});
const runtime=createAeroContentRuntime({persistenceResolver:authoring});
await runtime.loadPersistenceHandle(imported.handle);
const boxing=runtime.getSnapshot().variants.find((item)=>item.mode==="boxing");
assert.ok(boxing);
await runtime.selectVariant(boxing.variantId);
const first=runtime.getSnapshot().resolvedEvents;
const updated=await authoring.reprocessBoxing(imported.handle,{uppercutOppositeLane:true,anyOppositeLane:true});
await runtime.replaceBoxingPackage(updated);
const second=runtime.getSnapshot().resolvedEvents;
const column=(events)=>events.find((event)=>event.authoredBeat.type==="uppercut_left").authoredBeat.spatialTarget.targetCell%4;
assert.equal(column(first),1);
assert.equal(column(second),2);
assert.deepEqual(runtime.readAsset(imported.package.song.audio.filePath),entries.get("song.ogg"));
assert.equal(runtime.getSnapshot().selectedVariant.mode,"boxing");
const restored=await authoring.reprocessBoxing(imported.handle,{uppercutOppositeLane:false,anyOppositeLane:true});
await runtime.replaceBoxingPackage(restored);
assert.equal(column(runtime.getSnapshot().resolvedEvents),1,"repeated flips always derive from original source");
assert.equal(restored.packageHash,`sha256:${imported.handle.packageHash.value}`);
runtime.destroy();authoring.destroy();
console.log("No-fetch cached Boxing reprocess updates runtime resolved events and retains verified audio.");
