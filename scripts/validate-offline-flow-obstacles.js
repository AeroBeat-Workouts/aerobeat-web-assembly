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
assert.equal(bytes.byteLength, oracle.source.byteLength, "exact committed 3c9d fixture byte count must match its external golden");
assert.equal(createHash("sha256").update(bytes).digest("hex"), oracle.source.sha256, "exact committed 3c9d fixture SHA-256 must match its external golden");
const summary = parseBeatMapDifficulty(new Uint8Array(bytes), "v2");
const audioBytes = new TextEncoder().encode("offline-3c9d-audio");
const audioContentHash = `sha256:${createHash("sha256").update(audioBytes).digest("hex")}`;
const converted = await convertDifficulty(summary, {
  difficulty:"Hard", songToken:"3c9d", songName:"Dance Dance Revolution - DDRMix", bpm:150,
  sourceProvider:"beatsaver", sourceId:"3C9D", sourceVersionHash:oracle.source.versionHash,
  sourceDifficultyPath:oracle.source.path, sourceBeatmapVersion:oracle.source.format,
  sourceDifficultyHash:`sha256:${oracle.source.sha256}`, audioPath:"song.ogg", audioContentHash
});
const content = createAeroContentRuntime();
await content.loadPackage({package:converted.package,assets:[{path:"song.ogg",bytes:audioBytes}]});
const flowVariant = content.getSnapshot().variants.find((entry) => entry.mode === "flow");
assert.ok(flowVariant);
await content.selectVariant(flowVariant.variantId);
const snapshot = content.getSnapshot();
const obstacle = snapshot.resolvedEvents.find((event) => event.authoredBeat.type === "obstacle" && event.authoredBeat.start === oracle.expected.startBeat);
assert.ok(obstacle, JSON.stringify({selected:snapshot.selectedVariant,eventTypes:snapshot.resolvedEvents.map((event)=>event.authoredBeat.type)}));
assert.deepEqual(JSON.parse(JSON.stringify({
  start:obstacle.centerTimestampMs,end:obstacle.intervalEndTimestampMs,
  sourceGeometry:obstacle.authoredBeat.sourceGeometry,gameplayGeometry:obstacle.authoredBeat.gameplayGeometry,
  gridMask:obstacle.authoredBeat.gridMask
})),{
  start:oracle.expected.startTimestampMs,end:oracle.expected.endTimestampMs,
  sourceGeometry:oracle.expected.sourceGeometry,gameplayGeometry:oracle.expected.gameplayGeometry,
  gridMask:oracle.expected.gridMask
});
const gameplay = createAeroGameplaySessionCoordinator({sessionId:"offline-3c9d"});
gameplay.configureContent({packageId:snapshot.packageId,selectedVariant:snapshot.selectedVariant,resolvedEvents:snapshot.resolvedEvents});
const targets = projectSessionTargets([obstacle], gameplay.getSnapshot(), obstacle.centerTimestampMs);
assert.equal(targets.length,1);
const model = buildGameplaySceneModel({presentation:"flow",nowMs:obstacle.centerTimestampMs,targets});
const walls = model.objects.filter((entry) => entry.targetId === obstacle.eventId && entry.kind === "obstacle");
const shadows = model.objects.filter((entry) => entry.targetId === obstacle.eventId && entry.kind === "shadow");
assert.equal(walls.length,1);
assert.equal(shadows.length,1,"exact 3c9d wall owns one renderer-only shadow");
assert.deepEqual({x:walls[0].position.x,y:walls[0].position.y},{x:oracle.expected.renderer.centerX,y:oracle.expected.renderer.centerY});
assert.ok(Math.abs(walls[0].scale.x-1)<1e-12 && Math.abs(walls[0].scale.y-oracle.expected.renderer.visualHeight/oracle.expected.renderer.visualWidth)<1e-12 && Math.abs(walls[0].scale.z-oracle.expected.renderer.depth)<1e-12);
assert.deepEqual({x:shadows[0].position.x,y:shadows[0].position.y},{x:-.5,y:-.702});
assert.deepEqual(shadows[0].scale,{x:.94,y:.012,z:.15});
assert.equal(shadows[0].transparent,true);
assert.equal(gameplay.getJudgements().length,0);
gameplay.destroy();

const boxingProof=[];
for(const variant of content.getSnapshot().variants.filter((entry)=>entry.mode==="boxing")) {
  await content.selectVariant(variant.variantId);
  const boxingSnapshot=content.getSnapshot();
  const boxingObstacle=boxingSnapshot.resolvedEvents.find((event)=>event.authoredBeat.sourceEventIds?.includes("obstacle-002"));
  const key=`${variant.recipeId}|${variant.rulesetId}`;
  const expected=oracle.expected.boxing.charts[key];
  assert.ok(boxingObstacle&&expected,`missing exact 3c9d Boxing obstacle ${key}`);
  assert.equal(boxingObstacle.authoredBeat.eventId,expected.eventId);
  const authoredChart=converted.package.charts.find((chart)=>chart.chartId===variant.chartId);
  assert.equal(authoredChart?.prototype?.contentHash,expected.contentHash);
  assert.deepEqual(JSON.parse(JSON.stringify({
    start:boxingObstacle.authoredBeat.start,end:boxingObstacle.authoredBeat.end,type:boxingObstacle.authoredBeat.type,
    sourceGeometry:boxingObstacle.authoredBeat.sourceGeometry,gameplayGeometry:boxingObstacle.authoredBeat.gameplayGeometry,
    gridMask:boxingObstacle.authoredBeat.gridMask,blockedCells:boxingObstacle.authoredBeat.blockedCells,
    noseSafeCells:boxingObstacle.authoredBeat.checkpoint.noseSafeCells
  })),{
    start:oracle.expected.startBeat,end:oracle.expected.endBeat,type:"weave_right",
    sourceGeometry:oracle.expected.sourceGeometry,gameplayGeometry:oracle.expected.gameplayGeometry,
    gridMask:oracle.expected.gridMask,blockedCells:oracle.expected.gridMask,noseSafeCells:oracle.expected.boxing.noseSafeCells
  });

  const boxingGameplay=createAeroGameplaySessionCoordinator({sessionId:`offline-3c9d-${key}`});
  boxingGameplay.configureContent({packageId:boxingSnapshot.packageId,selectedVariant:boxingSnapshot.selectedVariant,resolvedEvents:boxingSnapshot.resolvedEvents});
  const boxingTargets=projectSessionTargets([boxingObstacle],boxingGameplay.getSnapshot(),boxingObstacle.centerTimestampMs);
  const presentation=variant.rulesetId==="boxing_semantic_track_v1"?"boxing_lanes":"boxing_spatial_grid";
  const boxingModel=buildGameplaySceneModel({presentation,nowMs:boxingObstacle.centerTimestampMs,targets:boxingTargets,timingWindowBeforeMs:180,timingWindowAfterMs:180});
  const chartWalls=boxingModel.objects.filter((entry)=>entry.targetId===boxingObstacle.eventId&&entry.kind==="obstacle");
  const chartShadows=boxingModel.objects.filter((entry)=>entry.targetId===boxingObstacle.eventId&&entry.kind==="shadow");
  assert.equal(chartWalls.length,1,`${key} exact weave must render one canonical wall`);
  assert.equal(chartShadows.length,1,`${key} exact weave must render one wall shadow`);
  assert.equal(chartWalls[0].assetId,"wall/red-glass-v1");
  assert.equal(chartWalls[0].intervalStartMs,boxingObstacle.intervalStartTimestampMs);
  assert.equal(chartWalls[0].intervalEndMs,boxingObstacle.intervalEndTimestampMs);

  const semantic=variant.rulesetId==="boxing_semantic_track_v1";
  const primary=scoreExactBoxingObstacle(boxingSnapshot,boxingObstacle,semantic?1:oracle.expected.boxing.noseSafeCells[0],`${key}-primary`);
  assert.equal(primary.result,"hit",semantic?`${key} Semantic action must score despite blocked nose cell`:`${key} Spatial action plus safe cell must score`);
  let blockedResult=null;
  if(!semantic){
    blockedResult=scoreExactBoxingObstacle(boxingSnapshot,boxingObstacle,1,`${key}-blocked`).result;
    assert.equal(blockedResult,"miss",`${key} Spatial action with blocked instantaneous nose cell must miss`);
  }
  boxingProof.push({key,eventId:boxingObstacle.eventId,contentHash:authoredChart.prototype.contentHash,presentation,walls:chartWalls.length,shadows:chartShadows.length,interval:[chartWalls[0].intervalStartMs,chartWalls[0].intervalEndMs],scoring:semantic?"semantic_action_only":"spatial_action_plus_instantaneous_safe_cell",primary:primary.result,blocked:blockedResult});
  boxingGameplay.destroy();
}
assert.equal(boxingProof.length,4,"all exact four Boxing charts must independently render and score");
assert.equal(new Set(boxingProof.map((entry)=>entry.key)).size,4,"all exact recipe/ruleset chart identities must be unique");
content.destroy();
console.log(`ORACLE exact-3c9d-flow-four-boxing-e2e PASS: fixtureBytes=${bytes.byteLength}, fixtureSha256=${oracle.source.sha256}, charts=${boxingProof.length}, proof=${JSON.stringify(boxingProof)}`);

function scoreExactBoxingObstacle(boxingSnapshot,boxingObstacle,noseCell,label){
  const coordinator=createAeroGameplaySessionCoordinator({sessionId:`score-${label}`,countdownStepMs:1});
  coordinator.configureContent({packageId:boxingSnapshot.packageId,selectedVariant:boxingSnapshot.selectedVariant,resolvedEvents:boxingSnapshot.resolvedEvents});
  coordinator.advance({timestampMs:0,clock:clock(0,false),input:input(0,null,1)});
  assert.equal(coordinator.requestStart(0).accepted,true);
  coordinator.advance({timestampMs:1,clock:clock(0,false)});
  coordinator.advance({timestampMs:2,clock:clock(0,false)});
  coordinator.advance({timestampMs:3,clock:clock(0,false)});
  assert.equal(coordinator.getSnapshot().session.state,"playing");
  const measured=40000;
  coordinator.advance({timestampMs:measured,clock:clock(boxingObstacle.centerTimestampMs,true),input:input(measured,evidence(`${label}-frame`,measured,[boxingObstacle.authoredBeat.type],noseCell),noseCell)});
  if(coordinator.getJudgements().find((entry)=>entry.eventId===boxingObstacle.eventId)===undefined){
    coordinator.advance({timestampMs:measured+181,clock:clock(boxingObstacle.centerTimestampMs+181,true),input:input(measured+181,evidence(`${label}-expiry`,measured+181,[boxingObstacle.authoredBeat.type],noseCell),noseCell)});
  }
  const judgement=coordinator.getJudgements().find((entry)=>entry.eventId===boxingObstacle.eventId);
  assert.ok(judgement,`${label} must independently resolve the exact obstacle judgement`);
  const partition=coordinator.getScorePartitions().find((entry)=>entry.variantId===boxingSnapshot.selectedVariant.variantId);
  assert.ok(partition,`${label} must update its exact chart score partition`);
  assert.equal(partition.variantId,boxingSnapshot.selectedVariant.variantId);
  assert.equal(partition.chartId,boxingSnapshot.selectedVariant.chartId);
  const result={result:judgement.result,diagnostics:judgement.diagnostics,hits:partition.hits,misses:partition.misses};
  coordinator.destroy();
  return result;
}

function clock(positionMs,playing){return {contextTimeSeconds:positionMs/1000,positionSeconds:positionMs/1000,playing};}
function input(measured,latestEvidence,noseCell){return {calibration:{calibrationId:"cal-1",readiness:"countdown"},tracking:{gameplayPaused:false,freshCalibrationRequired:false},countdownFrozen:false,latestEvidence,straightQualifications:[],noseCell};}
function evidence(frameId,measured,actions,noseCell){
  const cells={nose:noseCell,left_shoulder:4,right_shoulder:7,left_elbow:4,right_elbow:7,left_wrist:5,right_wrist:6};
  const anchors=Object.entries(cells).map(([anchor,cell],index)=>({schema:"aerobeat/body_grid_anchor_snapshot",version:1,anchor,calibrationId:"cal-1",measurementTimestampMs:measured,valid:true,confidence:1,rawX:.5,rawY:.5,x:.5,y:.5,cell,subcell:Math.max(0,cell*4+(index%4))}));
  return {schema:"aerobeat/gameplay_evidence_snapshot",version:1,calibrationId:"cal-1",measuredSourceFrameId:frameId,measurementTimestampMs:measured,provenance:"measured",activeBoxingActions:actions,anchors,entries:[]};
}
