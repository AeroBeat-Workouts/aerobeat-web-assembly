// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAeroWebContentAuthoringService } from "@aerobeat/web-content-authoring";
import { createAeroContentRuntime } from "@aerobeat/web-content";
import { buildGameplaySceneModel } from "@aerobeat/web-renderer";

// The visual_test option changes gameplay session purpose, not the content chart.
// Exercise the same import/reprocess/runtime path both session purposes consume.
const assembly = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
assert.match(assembly, /prior\.guardSpacing!==setup\.guardSpacing\|\|prior\.uppercutOppositeLane!==setup\.uppercutOppositeLane\|\|prior\.anyOppositeLane!==setup\.anyOppositeLane/u);
assert.match(assembly, /await graph\.content\.replaceBoxingPackage\(replacement\)/u);
assert.match(assembly, /const resolvedEvents = futureOnly \? content\.resolvedEvents\.filter\([\s\S]*? : content\.resolvedEvents/u);
assert.match(assembly, /const events = Array\.isArray\(projected\)\?projected:Array\.isArray\(content\.resolvedEvents\) \? content\.resolvedEvents : \[\]/u);
assert.match(assembly, /purpose === "visual_test" \? VISUAL_TEST_CONTENT_OPTIONS : undefined/u);
assert.match(assembly, /graph\.renderer\.renderGameplayFrameWithCursorsAndEquipment\(frame, cursors, cursorOptions, equipment/u);

const bytes = (value) => new TextEncoder().encode(value);
const sourceMap = bytes(JSON.stringify({ version:"3.3.0", colorNotes:[
  {b:2,x:1,y:2,c:0,d:0}, {b:2,x:2,y:2,c:1,d:0},
  {b:4,x:1,y:2,c:0,d:0}, {b:6,x:2,y:1,c:1,d:8},
  {b:8,x:1,y:1,c:0,d:0}, {b:10,x:2,y:1,c:1,d:8}
], bombNotes:[], obstacles:[], sliders:[], burstSliders:[] }));
const entries = new Map([["info.dat",bytes("{}")],["hard.dat",sourceMap],["song.ogg",new Uint8Array([1,2,3])]]);
const source = {
  manifest:{schemaId:"aerobeat.beatsaver-source-manifest.v2",infoFormatMajor:2,infoFormat:"v2",infoVersion:"2.1.0",infoPath:"Info.dat",hashInputPaths:["Hard.dat"],songName:"Test Play Parity",songSubName:"",songAuthorName:"",levelAuthorName:"",audioPath:"song.ogg",coverPath:"",bpm:120,previewStartSeconds:0,previewDurationSeconds:0,difficulties:[{characteristic:"Standard",difficulty:"Hard",difficultyRank:5,path:"Hard.dat",beatMapFormatMajor:3,beatMapFormat:"v3",beatMapVersion:"3.3.0",notePalette:null,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:0}],entries:[],archiveBytes:0,expandedBytes:0},
  listEntryPaths(){return ["Info.dat","Hard.dat","song.ogg"];},
  readEntry(path){return Uint8Array.from(entries.get(path.toLowerCase()));}
};
const authoring=createAeroWebContentAuthoringService();
const imported=await authoring.convertAndPersist({source},{difficulty:"Hard",sourceId:"test-play-parity",sourceVersionHash:"v1",includeAudio:true,cacheSourceEntries:true,modifiers:["any_punch"],converterSettings:{guardSpacing:1,uppercutOppositeLane:false,anyOppositeLane:true}});
const content=createAeroContentRuntime({persistenceResolver:authoring});
await content.loadPersistenceHandle(imported.handle);
const boxing=content.getSnapshot().variants.find((variant)=>variant.mode==="boxing");
assert.ok(boxing,"import must author a Boxing variant");
await content.selectVariant(boxing.variantId,{modifierIds:["any_punch"]});
const chart=()=>content.getSnapshot().resolvedEvents;
const guard=()=>chart().find((event)=>event.authoredBeat.type==="guard");
const uppercut=()=>chart().find((event)=>event.authoredBeat.type==="uppercut_left");
const anyPunch=()=>chart().find((event)=>event.authoredBeat.type==="straight_left"&&event.authoredBeat.modifier==="any_punch");
const targetColumn=(event)=>event?.authoredBeat.spatialTarget.targetCell%4;
const initialGuard=guard()?.authoredBeat.guardTarget;
assert.ok(initialGuard,"fixture must produce a guard pair");
assert.ok(uppercut(),"fixture must produce a left uppercut");
assert.ok(anyPunch(),"fixture must produce a left any-punch straight");
const initial={guardCells:[initialGuard.leftCell,initialGuard.rightCell],uppercutColumn:targetColumn(uppercut()),anyColumn:targetColumn(anyPunch())};
const replacement=await authoring.reprocessBoxing(imported.handle,{guardSpacing:2,uppercutOppositeLane:true,anyOppositeLane:false});
await content.replaceBoxingPackage(replacement);
const updatedGuard=guard()?.authoredBeat.guardTarget;
assert.ok(updatedGuard);
assert.equal(updatedGuard.spacing,2);
assert.notDeepEqual([updatedGuard.leftCell,updatedGuard.rightCell],initial.guardCells,"spacing must change authored guard cells");
assert.notEqual(targetColumn(uppercut()),initial.uppercutColumn,"uppercut opposite-lane must change chart");
assert.notEqual(targetColumn(anyPunch()),initial.anyColumn,"any-punch opposite-lane must change chart");
assert.deepEqual(content.getSnapshot().selectedVariant.modifierIds,["any_punch"],"replacement retains modifier selection");

// Play and Visual Test consume the same runtime chart and renderer frame/model.
for(const purpose of ["play","visual_test"]){
  const selected=content.getSnapshot();
  const playable=selected.resolvedEvents;
  assert.strictEqual(playable,chart(),`${purpose} must consume the authoritative runtime chart`);
  const beat=guard();
  const cells=[beat.authoredBeat.guardTarget.leftCell,beat.authoredBeat.guardTarget.rightCell];
  for(const presentation of ["boxing_lanes","boxing_collider"]){
    const target={id:`${purpose}-guard`,kind:"guard",hand:"both",family:"guard",cell:null,cells,lane:null,beatCenterMs:beat.centerTimestampMs,judgement:"pending"};
    const frame={presentation,nowMs:beat.centerTimestampMs,targets:[target],timingWindowBeforeMs:180,timingWindowAfterMs:180,trackExtensionWorldUnits:2};
    const model=buildGameplaySceneModel(frame);
    const icons=model.objects.filter((object)=>object.targetId===target.id&&object.kind==="icon");
    assert.deepEqual(icons.map((icon)=>icon.position.x).sort((a,b)=>a-b),cells.map((cell)=>cell%4-1.5).sort((a,b)=>a-b),`${purpose}/${presentation} draws authored guard spacing`);
    const tracks=model.objects.filter((object)=>object.kind==="track").sort((a,b)=>a.position.z-b.position.z);
    assert.equal(tracks.length,3);
    const trackLength=(track)=>track.id==="track-0"?26:24;
    for(let i=1;i<tracks.length;i++)assert.ok(Math.abs((tracks[i-1].position.z+trackLength(tracks[i-1])/2)-(tracks[i].position.z-trackLength(tracks[i])/2))<1e-9,`${purpose}/${presentation} track is continuous`);
  }
}
content.destroy();authoring.destroy();
console.log("Test/Play share the reprocessed guard and opposite-lane chart and continuous track.");
