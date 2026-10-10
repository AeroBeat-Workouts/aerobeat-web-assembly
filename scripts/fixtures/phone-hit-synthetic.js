// @ts-check
// Fixture-only real PlayCanvas pixels. Committed hit presentation, not sword collision.
import { createAeroPlayCanvasRenderer } from "@aerobeat/web-renderer";
import { createEquipmentConfigIdentity } from "@aerobeat/web-contracts";
import { sha256Hex } from "@aerobeat/web-hash";
import { canonicalEquipmentConfigIdentityInput } from "../../src/equipment-config.js";
import { equipmentConfigDefaults } from "../../src/equipment-config-defaults.js";
import { gameplayEquipmentRecords } from "../../src/gameplay-equipment-records.js";
import { squareRadialSaberTarget } from "../../src/saber-zone-direction.js";
import { testEquipmentInput } from "../../src/test-equipment-authoring.js";
import { createPhoneHitWorkload } from "../../src/phone-hit-workload.js";

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector("#game"));
const renderer = createAeroPlayCanvasRenderer({ contextAttributes: { alpha:true, antialias:true, premultipliedAlpha:true, preserveDrawingBuffer:true } });
const workload = createPhoneHitWorkload();
const identity = createEquipmentConfigIdentity({ schema:"aerobeat/equipment_config_identity", version:1, algorithm:"sha256", value:await sha256Hex(canonicalEquipmentConfigIdentityInput(equipmentConfigDefaults)) });
// Exact static Visual Test input and equipment recipe used by the standalone page.
const input=testEquipmentInput("off"),flow=equipmentConfigDefaults.flow.saber,targets={};
for(const hand of ["left","right"]){
  const anchor=input.anchors.find(entry=>entry.anchor===`${hand}_wrist`);
  if(!anchor)throw new Error("Static Test wrist unavailable");
  targets[hand]={orientation:squareRadialSaberTarget(anchor.x,1-anchor.y,flow.zones,flow.blendRadius,{x:.5,y:.5}).orientation};
}
const equipment=gameplayEquipmentRecords(false,{purpose:"visual_test",state:"playing",timestampMs:0},input,"flow",null,targets,equipmentConfigDefaults,identity);
if(equipment.length!==2)throw new Error("Static Test Flow sabers unavailable");
const cursorOptions = { grid:{x:0,y:0,width:1,height:1}, minConfidence:.5, sizeCssPx:32 };
const equipmentOptions = { grid:{x:0,y:0,width:1,height:1} };
const camera = {schema:"aerobeat/gameplay_camera_pose",version:1,coordinateSystem:{space:"playcanvas_world",handedness:"right_handed",worldUp:"+Y",cameraForward:"local_-Z",timelineFuture:"world_-Z"},position:{x:.05,y:1,z:5},rotationEulerDegrees:{xPitch:0,yYaw:0,zRoll:0},projection:{verticalFovDegrees:48,nearClip:.1,farClip:80}};
renderer.attach(canvas);
renderer.resize({widthCssPx:844,heightCssPx:390,devicePixelRatio:1,renderScale:1});
renderer.setBackgroundProjection({kind:"solid",colors:["#071426"],angleDeg:180});
renderer.setEnvironmentVisible(false);
renderer.setGameplayCameraPose("flow",camera);
let suppressed = false;
let last = {timeMs:0,mode:"no-hit"};
function scene(timeMs, mode, withoutAftermathTarget = null) {
  const projected = mode === "hit" ? workload.frameHit(timeMs) : workload.frameNoHit(timeMs);
  // Counterfactual changes ONLY the delivery of corpse entries. Keep the exact
  // committed-hit targets (including Great), sabers, camera and backdrop intact.
  const frame=suppressed?{...projected,aftermath:[]}:projected;
  if (withoutAftermathTarget === null) return frame;
  return {...frame, aftermath:frame.aftermath.filter(e=>e.targetId!==withoutAftermathTarget)};
}
function renderAt(timeMs, mode = "hit", withoutAftermathTarget = null) {
  if(!Number.isFinite(timeMs)||timeMs<0||!["hit","no-hit"].includes(mode))throw new TypeError("Invalid fixture frame");
  last={timeMs,mode};
  const frame=scene(timeMs,mode,withoutAftermathTarget);
  const result=renderer.renderGameplayFrameWithCursorsAndEquipment(frame,[],cursorOptions,equipment,equipmentOptions);
  const light=renderer.shadowLightEntity?.light;
  return {status:result.status.state,frameCount:result.status.frameCount,equipmentCount:result.equipmentCount,cursorCount:result.cursorCount,
    targets:frame.targets.length, hitFeedback:frame.targets.filter(target=>target.judgement==="hit").length,
    aftermathEntries:frame.aftermath.length,halves:result.model.objects.filter(object=>object.kind==="aftermath"&&object.id.startsWith("note-100:aftermath:")).map(object=>({id:object.id,x:object.position.x,y:object.position.y,z:object.position.z,alpha:object.alpha,assetId:object.assetId,sign:object.aftermath?.sliceSign})),
    feedback:result.model.objects.filter(object=>object.kind==="feedback"&&object.targetId==="note-100").map(object=>({id:object.id,text:object.feedback?.text,alpha:object.alpha,x:object.position.x,y:object.position.y,z:object.position.z})),
    iconCount:result.model.objects.filter(object=>object.kind==="icon"&&object.targetId==="note-100").length,
    shadow:{exists:Boolean(light),casting:light?.castShadows??false,resolution:light?.shadowResolution??null,receiver:Boolean(renderer.shadowReceiverLayer)} };
}
function pixels(){const sample=new OffscreenCanvas(canvas.width,canvas.height);const ctx=sample.getContext("2d",{willReadFrequently:true});ctx.drawImage(canvas,0,0);return Array.from(ctx.getImageData(0,0,sample.width,sample.height).data);}
window.__phoneHitFixture={
  ready:()=>renderer.describe().gameplayAssets.state,
  renderAt, pixels,
  suppressDelivery(value){suppressed=Boolean(value);return renderAt(last.timeMs,last.mode);},
  shadowProbe(value){renderer.shadowLightEntity.light.castShadows=Boolean(value);return renderAt(last.timeMs,last.mode);},
  projected(x,y,z){const p=renderer.cameraEntity.camera.worldToScreen({x,y,z});return{x:p.x,y:p.y};},
  destroy(){renderer.destroy();}
};
renderAt(0,"no-hit");
