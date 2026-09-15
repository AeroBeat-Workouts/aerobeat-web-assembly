// @ts-check

// t7sv W2b rebaseline — the committed 3C9D Standard Hard legacy v2.0.0 beatmap
// (fixture `flow-obstacle-3c9d-hard-v1.dat`) contains only `_type:1` END-marker
// entries in its `_obstacles` array. After W1-A's t7sv fix (authoring `3a4af13`)
// every `_type:1` entry is an orphaned terminator and is SKIPPED at parse, so
// this fixture now converts with ZERO obstacles (pre-fix it produced six
// full-height column walls). The raw fixture bytes remain pinned so any drift in
// the vendored chart is caught immediately (mirrors the authoring repo's
// `validate-flow-obstacles.js` raw-byte invariant).
//
// Coverage preservation: this oracle's purpose was "an exact 3c9d Flow obstacle
// renders one wall + one shadow at the exact golden position/scale." That
// rendering proof is now anchored on a synthetic two-cell full-height wall
// (sourceGeometry `x:0, y:0, width:2, height:3` — the classic `_width:4` =
// two-cell span, gameplay height 3) built the way this repo's other oracles
// build fixtures, plus the four Boxing charts of the real 3c9d package (which
// now contain no weave/squat beats because the source has no obstacles —
// matching the authoring repo's re-baselined claim).
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { parseBeatMapDifficulty, convertDifficulty } from "@aerobeat/web-content-authoring";
import { createAeroContentRuntime } from "@aerobeat/web-content";
import { createAeroGameplaySessionCoordinator } from "@aerobeat/web-gameplay";
import { buildGameplaySceneModel } from "@aerobeat/web-renderer";
import { projectSessionTargets } from "../src/session-render-projection.js";

const bytes = fs.readFileSync(new URL("../../aerobeat-web-content-authoring/fixtures/flow-obstacle-3c9d-hard-v1.dat", import.meta.url));
const oracle = JSON.parse(fs.readFileSync(new URL("../../aerobeat-web-content-authoring/fixtures/obstacle-normalization-3c9d-hard-golden-v2.json", import.meta.url), "utf8"));
assert.equal(bytes.byteLength, oracle.source.byteLength, "exact committed 3c9d fixture byte count must match its external golden");
assert.equal(createHash("sha256").update(bytes).digest("hex"), oracle.source.sha256, "exact committed 3c9d fixture SHA-256 must match its external golden");
const rawDocument = JSON.parse(bytes.toString("utf8"));
assert.ok(Array.isArray(rawDocument._obstacles) && rawDocument._obstacles.length > 0, "3c9d Hard fixture must retain a non-empty _obstacles container");
for (const entry of rawDocument._obstacles) assert.equal(entry._type, 1, "3c9d Hard fixture contains only _type:1 (END-marker) obstacles");
const summary = parseBeatMapDifficulty(new Uint8Array(bytes), "v2");
assert.equal(summary.obstacles.length, 0, "all-END-marker legacy v2 map must normalize to zero obstacles after t7sv END-skip");
const audioBytes = new TextEncoder().encode("offline-3c9d-audio");
const audioContentHash = `sha256:${createHash("sha256").update(audioBytes).digest("hex")}`;
const converted = await convertDifficulty(summary, {
  difficulty:"Hard", songToken:"3c9d", songName:"Dance Dance Revolution - DDRMix", bpm:150,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:1,
  sourceProvider:"beatsaver", sourceId:"3C9D", sourceVersionHash:oracle.source.versionHash,
  sourceInfoFormat:"v2",sourceInfoVersion:"2.0.0",sourceInfoHash:`sha256:${"0".repeat(64)}`,sourceDifficultyPath:oracle.source.path,sourceBeatmapFormat:"v2", sourceBeatmapVersion:oracle.source.format,
  sourceDifficultyHash:`sha256:${oracle.source.sha256}`,notePalette:null,spawnTiming:{schema:"aerobeat/beatsaber_spawn_timing",version:1,algorithm:"beatsaber_core_hjd_v1",bpm:150,noteJumpMovementSpeed:10,noteJumpStartBeatOffset:1,maxHalfJumpDistance:17.999,startHalfJumpDurationBeats:4,minimumHalfJumpDurationBeats:.25,halfJumpDurationBeats:5,reactionTimeMs:2000,jumpDistanceMeters:40}, audioPath:"song.ogg", audioContentHash
});
const content = createAeroContentRuntime();
await content.loadPackage({package:converted.package,assets:[{path:"song.ogg",bytes:audioBytes}]});
const flowVariant = content.getSnapshot().variants.find((entry) => entry.mode === "flow");
assert.ok(flowVariant);
await content.selectVariant(flowVariant.variantId);
const snapshot = content.getSnapshot();
assert.equal(snapshot.resolvedEvents.filter((event) => event.authoredBeat.type === "obstacle").length, 0, "3c9d Flow variant must resolve zero obstacles after t7sv END-skip");
// Re-anchored rendering proof: a synthetic two-cell full-height wall (the classic
// `_width:4` two-cell span) exercises the exact same wall+shadow scene-model path
// the old 3c9d obstacle proof did, so obstacle rendering coverage survives.
const sourceGeometry=Object.freeze({schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v2_legacy_obstacle",kind:"v2_type_0",x:0,y:0,width:2,height:3});
const gameplayGeometry=Object.freeze({schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:0,y:0,width:2,height:3});
const obstacleStartMs=40_000;
const syntheticObstacle=Object.freeze({schema:"aerobeat/resolved_content_event",version:3,eventId:"synth-3c9d-wall",centerTimestampMs:obstacleStartMs,intervalStartTimestampMs:obstacleStartMs,intervalEndTimestampMs:obstacleStartMs+1000,authoredBeat:Object.freeze({type:"obstacle",start:66.667,end:68.334,sourceGeometry,gameplayGeometry,gridMask:Object.freeze([0,1,4,5,8,9])})});
const synthVariant=Object.freeze({variantId:"synth-flow",chartId:"synth-chart",mode:"flow",rulesetId:"flow_colliders_v1",recipeId:null,modifierIds:[],ranked:true,localOnly:false,mapHash:Object.freeze({schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:"1".repeat(64)}),scoreIdentityHash:Object.freeze({schema:"aerobeat/content_hash",version:1,algorithm:"sha256",value:"2".repeat(64)})});
const synthesisGameplay=createAeroGameplaySessionCoordinator({sessionId:"offline-3c9d-synth"});
synthesisGameplay.configureContent({packageId:"synth-pkg",selectedVariant:synthVariant,resolvedEvents:[syntheticObstacle]});
const targets=projectSessionTargets([syntheticObstacle],synthesisGameplay.getSnapshot(),obstacleStartMs+500);
assert.equal(targets.length,1,"synthetic wall must project exactly one target mid-interval");
const model=buildGameplaySceneModel({presentation:"flow",nowMs:obstacleStartMs+500,targets});
const walls=model.objects.filter((entry)=>entry.targetId===syntheticObstacle.eventId&&entry.kind==="obstacle");
const shadows=model.objects.filter((entry)=>entry.targetId===syntheticObstacle.eventId&&entry.kind==="shadow");
assert.equal(walls.length,1,"synthetic re-anchored wall must render exactly one wall");
assert.equal(shadows.length,1,"synthetic re-anchored wall owns one renderer-only shadow");
assert.equal(walls[0].assetId,"wall/red-glass-v1");
assert.equal(walls[0].intervalStartMs,obstacleStartMs);
assert.equal(walls[0].intervalEndMs,obstacleStartMs+1000);
assert.deepEqual({x:walls[0].position.x,y:walls[0].position.y},{x:-1,y:1},"two-cell full-height wall centers on columns 0-1 / rows 0-2");
// The scene model renders each axis at (cells - .06) / .94 — a 6% per-axis
// visual gap shrunk out of the cell span. For width=2 x height=3 that is
// ((2-.06)/.94, (3-.06)/.94, depth).
assert.ok(Math.abs(walls[0].scale.x-((2-.06)/.94))<1e-9&&Math.abs(walls[0].scale.y-((3-.06)/.94))<1e-9,"two-cell full-height wall scale must match the scene-model formula");
assert.ok(walls[0].scale.z>0&&Number.isFinite(walls[0].scale.z),"wall depth must be positive and finite");
assert.deepEqual({x:shadows[0].position.x,y:shadows[0].position.y},{x:-1,y:-.702},"wall shadow must project to the wall's floor X at the floor Y");
assert.deepEqual(shadows[0].scale,{x:1.94,y:.012,z:walls[0].scale.z},"shadow footprint must match the wall's cell span");
assert.equal(shadows[0].transparent,true);
assert.equal(synthesisGameplay.getJudgements().length,0,"no judgements before scoring input");
synthesisGameplay.destroy();

// 0.0.54 W1-A rebaseline: convertDifficulty now emits EXACTLY ONE boxing chart
// per difficulty — the sole boxing_collider_v1 variant (no conversion recipe);
// the four-chart Lanes/Grid matrix is retired for new imports. After t7sv it
// contains no weave/squat beats (the source has no obstacles).
const boxingCharts=converted.package.charts.filter((chart)=>chart.mode==="boxing");
assert.equal(boxingCharts.length,1,"new imports carry exactly one Boxing (collider) chart — the Lanes/Grid pair is retired");
assert.equal(boxingCharts[0].prototype.rulesetId,"boxing_collider_v1","the sole boxing chart binds the collider ruleset");
assert.equal(Object.hasOwn(boxingCharts[0].prototype,"recipeId"),false,"the collider chart carries no conversion recipe identity");
assert.equal(converted.package.charts.filter((chart)=>chart.mode==="flow").length,1,"the flow_colliders_v1 chart remains alongside the collider chart");
for(const chart of boxingCharts){
  assert.equal(chart.beats.some((beat)=>String(beat.type??"").startsWith("weave_")||String(beat.type??"")==="squat"),false,`${chart.chartId} Boxing chart must contain no weave/squat beats because there are no source obstacles`);
}
content.destroy();
console.log(`ORACLE exact-3c9d-flow-zero-obstacle-t7sv + synthetic re-anchored wall+shadow PASS: fixtureBytes=${bytes.byteLength}, fixtureSha256=${oracle.source.sha256}, boxingCharts=${boxingCharts.length}`);
