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
assert.deepEqual(JSON.parse(JSON.stringify({ start:obstacle.centerTimestampMs,end:obstacle.intervalEndTimestampMs,geometry:obstacle.authoredBeat.geometry,gridMask:obstacle.authoredBeat.gridMask })), { start:37039.99938964844,end:37064.99938964844,geometry:{schema:"aerobeat/flow_obstacle_geometry",version:1,coordinateSpace:"beatsaber_lane_layer",x:1,y:2,width:1,height:3},gridMask:[1] });
const gameplay = createAeroGameplaySessionCoordinator({sessionId:"offline-3c9d"});
gameplay.configureContent({packageId:snapshot.packageId,selectedVariant:snapshot.selectedVariant,resolvedEvents:snapshot.resolvedEvents});
const targets = projectSessionTargets([obstacle], gameplay.getSnapshot(), obstacle.centerTimestampMs);
assert.equal(targets.length,1);
const model = buildGameplaySceneModel({presentation:"flow",nowMs:obstacle.centerTimestampMs,targets});
const walls = model.objects.filter((entry) => entry.targetId === obstacle.eventId);
assert.equal(walls.length,1);
assert.deepEqual({x:walls[0].position.x,y:walls[0].position.y},{x:-.5,y:3});
assert.ok(Math.abs(walls[0].scale.x-1)<1e-12 && Math.abs(walls[0].scale.y-2.94/.94)<1e-12 && Math.abs(walls[0].scale.z-.15)<1e-12);
assert.equal(gameplay.getJudgements().length,0);
gameplay.destroy();content.destroy();
console.log("Offline exact 3c9d Hard package→content→gameplay→assembly→renderer obstacle gate passed.");
