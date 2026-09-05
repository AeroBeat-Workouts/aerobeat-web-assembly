// @ts-check

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
assert.equal(bytes.byteLength, 89424);
const summary = parseBeatMapDifficulty(new Uint8Array(bytes), "v2");
const audioBytes = new TextEncoder().encode("offline-3c9d-audio"); const audioContentHash = `sha256:${createHash("sha256").update(audioBytes).digest("hex")}`;
const converted = await convertDifficulty(summary, { difficulty:"Hard", songToken:"3c9d", songName:"Dance Dance Revolution - DDRMix", bpm:150, sourceProvider:"offline_fixture", sourceId:"3C9D", sourceVersionHash:"5662f64a12c76a3dd11a5f6ee22611608cd06760", sourceDifficultyPath:"Hard.dat", sourceBeatmapVersion:"2.2.0", audioPath:"song.ogg", audioContentHash });
const content = createAeroContentRuntime();
await content.loadPackage({package:converted.package,assets:[{path:"song.ogg",bytes:audioBytes}]});
const flowVariant = content.getSnapshot().variants.find((entry) => entry.mode === "flow"); assert.ok(flowVariant); await content.selectVariant(flowVariant.variantId);
const snapshot = content.getSnapshot();
const obstacle = snapshot.resolvedEvents.find((event) => event.authoredBeat.type === "obstacle" && event.authoredBeat.start === 92.5999984741211);
assert.ok(obstacle, JSON.stringify({selected:snapshot.selectedVariant,eventTypes:snapshot.resolvedEvents.map((event)=>event.authoredBeat.type)}));
assert.deepEqual(JSON.parse(JSON.stringify({start:obstacle.centerTimestampMs,end:obstacle.intervalEndTimestampMs,sourceGeometry:obstacle.authoredBeat.sourceGeometry,gameplayGeometry:obstacle.authoredBeat.gameplayGeometry,gridMask:obstacle.authoredBeat.gridMask})),{start:37039.99938964844,end:37064.99938964844,sourceGeometry:{schema:"aerobeat/obstacle_source_geometry",version:1,coordinateSpace:"beatsaber_v2_legacy_obstacle",kind:"v2_type_1",x:1,y:2,width:1,height:3},gameplayGeometry:{schema:"aerobeat/obstacle_gameplay_geometry",version:1,coordinateSpace:"aerobeat_top_left_grid",x:1,y:0,width:1,height:3},gridMask:[1,5,9]});
const gameplay = createAeroGameplaySessionCoordinator({sessionId:"offline-3c9d"});
gameplay.configureContent({packageId:snapshot.packageId,selectedVariant:snapshot.selectedVariant,resolvedEvents:snapshot.resolvedEvents});
const targets = projectSessionTargets([obstacle], gameplay.getSnapshot(), obstacle.centerTimestampMs);
assert.equal(targets.length,1);
const model = buildGameplaySceneModel({presentation:"flow",nowMs:obstacle.centerTimestampMs,targets});
const walls = model.objects.filter((entry) => entry.targetId === obstacle.eventId && entry.kind === "obstacle");
const shadows = model.objects.filter((entry) => entry.targetId === obstacle.eventId && entry.kind === "shadow");
assert.equal(walls.length,1); assert.equal(shadows.length,1,"exact 3c9d wall owns one renderer-only shadow");
assert.deepEqual({x:walls[0].position.x,y:walls[0].position.y},{x:-.5,y:1});
assert.ok(Math.abs(walls[0].scale.x-1)<1e-12 && Math.abs(walls[0].scale.y-2.94/.94)<1e-12 && Math.abs(walls[0].scale.z-.15)<1e-12);
assert.deepEqual({x:shadows[0].position.x,y:shadows[0].position.y},{x:-.5,y:-.702}); assert.deepEqual(shadows[0].scale,{x:.94,y:.012,z:.15}); assert.equal(shadows[0].transparent,true);
assert.equal(gameplay.getJudgements().length,0);
gameplay.destroy();
const boxingProof=[];
for(const variant of content.getSnapshot().variants.filter((entry)=>entry.mode==="boxing")){await content.selectVariant(variant.variantId);const boxingSnapshot=content.getSnapshot(),boxingObstacle=boxingSnapshot.resolvedEvents.find((event)=>event.authoredBeat.sourceEventIds?.includes("obstacle-002")),key=`${variant.recipeId}|${variant.rulesetId}`,expected=oracle.expected.boxing.charts[key];assert.ok(boxingObstacle&&expected,`missing exact 3c9d Boxing obstacle ${key}`);assert.equal(boxingObstacle.authoredBeat.eventId,expected.eventId);const authoredChart=converted.package.charts.find((chart)=>chart.chartId===variant.chartId);assert.equal(authoredChart?.prototype?.contentHash,expected.contentHash);assert.deepEqual(JSON.parse(JSON.stringify({start:boxingObstacle.authoredBeat.start,end:boxingObstacle.authoredBeat.end,type:boxingObstacle.authoredBeat.type,sourceGeometry:boxingObstacle.authoredBeat.sourceGeometry,gameplayGeometry:boxingObstacle.authoredBeat.gameplayGeometry,gridMask:boxingObstacle.authoredBeat.gridMask,blockedCells:boxingObstacle.authoredBeat.blockedCells,noseSafeCells:boxingObstacle.authoredBeat.checkpoint.noseSafeCells})),{start:oracle.expected.startBeat,end:oracle.expected.endBeat,type:"weave_right",sourceGeometry:oracle.expected.sourceGeometry,gameplayGeometry:oracle.expected.gameplayGeometry,gridMask:[1,5,9],blockedCells:[1,5,9],noseSafeCells:oracle.expected.boxing.noseSafeCells});const boxingGameplay=createAeroGameplaySessionCoordinator({sessionId:`offline-3c9d-${key}`});boxingGameplay.configureContent({packageId:boxingSnapshot.packageId,selectedVariant:boxingSnapshot.selectedVariant,resolvedEvents:boxingSnapshot.resolvedEvents});const boxingTargets=projectSessionTargets([boxingObstacle],boxingGameplay.getSnapshot(),boxingObstacle.centerTimestampMs),presentation=variant.rulesetId==="boxing_semantic_track_v1"?"boxing_lanes":"boxing_spatial_grid",boxingModel=buildGameplaySceneModel({presentation,nowMs:boxingObstacle.centerTimestampMs,targets:boxingTargets,timingWindowBeforeMs:180,timingWindowAfterMs:180}),boxingWalls=boxingModel.objects.filter((entry)=>entry.targetId===boxingObstacle.eventId&&entry.kind==="obstacle"),boxingShadows=boxingModel.objects.filter((entry)=>entry.targetId===boxingObstacle.eventId&&entry.kind==="shadow");assert.equal(boxingTargets[0].judgement,undefined);assert.equal(boxingGameplay.getObstacleOutcomes().length,0,"Boxing must not acquire Flow obstacle outcomes");assert.equal(boxingWalls.length,1);assert.equal(boxingShadows.length,1);assert.equal(boxingWalls[0].assetId,"wall/red-glass-v1");assert.deepEqual({start:boxingWalls[0].intervalStartMs,end:boxingWalls[0].intervalEndMs},{start:boxingObstacle.centerTimestampMs,end:boxingObstacle.intervalEndTimestampMs});if(presentation==="boxing_lanes"){assert.deepEqual(boxingWalls[0].position,{x:1.35,y:1.1,z:-.075});assert.ok(Math.abs(boxingWalls[0].scale.x-1.7/.94)<1e-12&&boxingWalls[0].scale.y===1);}else{assert.deepEqual({x:boxingWalls[0].position.x,y:boxingWalls[0].position.y},{x:-.5,y:1});assert.ok(Math.abs(boxingWalls[0].scale.x-1)<1e-12&&Math.abs(boxingWalls[0].scale.y-2.94/.94)<1e-12);}boxingProof.push({key,eventId:boxingObstacle.eventId,assetId:boxingWalls[0].assetId,walls:boxingWalls.length,shadows:boxingShadows.length});boxingGameplay.destroy();}
assert.equal(boxingProof.length,4);
content.destroy();
console.log(`Offline exact 3c9d Hard Flow plus four Boxing package→content→gameplay→assembly→renderer obstacle gate passed: ${JSON.stringify(boxingProof)}`);
