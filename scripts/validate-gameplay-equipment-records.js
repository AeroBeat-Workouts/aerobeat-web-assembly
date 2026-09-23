// @ts-check
import assert from "node:assert/strict";
import { isResolvedEquipmentPose, resolveSaberCapsule } from "@aerobeat/web-contracts";
import { gameplayEquipmentRecords } from "../src/gameplay-equipment-records.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

const identity = Object.freeze({ schema:"aerobeat/equipment_config_identity", version:1, algorithm:"sha256", value:"a".repeat(64) });
const session = (state="playing", purpose="play") => ({ state, purpose, timestampMs:1000 });
const input = (overrides={}) => ({ tracking:{gameplayPaused:false,freshCalibrationRequired:false,allRequiredAnchorsVisible:true,anchorsFrozen:false,degradedAnchors:[],...overrides.tracking},countdownFrozen:false,retainedGeometryDimmed:false,anchors:[{anchor:"nose",valid:true,x:.5,y:.2,confidence:1},{anchor:"left_wrist",valid:true,x:.2,y:.6,confidence:1},{anchor:"right_wrist",valid:true,x:.8,y:.4,confidence:1}],...overrides });
const history={left_wrist:[{t:940,x:0,y:0},{t:980,x:1,y:0}],right_wrist:[{t:940,x:0,y:0},{t:980,x:0,y:0}]};

{
  const poses=gameplayEquipmentRecords(false,session(),input(),"flow",history,null,null,equipmentConfigDefaults,identity);
  assert.equal(poses.length,2); assert.equal(Object.isFrozen(poses),true);
  for(const pose of poses){assert.equal(isResolvedEquipmentPose(pose),true);assert.equal(Object.isFrozen(pose),true);assert.deepEqual(Object.keys(pose),["role","mode","anchor","scale","orientation","geometryIdentity","configIdentity"]);assert.equal("rotationZDeg" in pose,false);assert.equal("direction" in pose,false);assert.equal(pose.scale,2);assert.deepEqual(pose.configIdentity,identity);}
  assert.deepEqual(poses[0].anchor,{x:.2*4-.5,y:2.5-.6*3,z:0},"left normalized wrist maps exactly to judge WU");
  assert.deepEqual(poses[1].anchor,{x:.8*4-.5,y:2.5-.4*3,z:0},"right normalized wrist maps exactly to judge WU");
  const capsule=resolveSaberCapsule(poses[0]); assert.ok(capsule.end.x>capsule.start.x,"motion heading resolves canonical +X capsule");
}

{
  const config=structuredClone(equipmentConfigDefaults); config.flow.perHand.left.scale=3; config.flow.perHand.left.rotationEulerDeg={x:25,y:-20,z:35};
  const zones={left:{x:1,y:0,localRotationEulerDeg:{x:10,y:5,z:-15}},right:{x:0,y:1,localRotationEulerDeg:{x:0,y:0,z:0}}};
  const poses=gameplayEquipmentRecords(false,session("playing","visual_test"),input(),"flow",history,null,zones,config,identity);
  assert.equal(poses[0].scale,3); assert.notDeepEqual(poses[0].orientation,{x:0,y:0,z:0,w:1},"combined XYZ controls affect shared pose");
}

{
  const q=Object.freeze({x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2});
  const poses=gameplayEquipmentRecords(false,session(),input(),"boxing",history,{left:q,right:q},null,equipmentConfigDefaults,identity);
  assert.equal(poses.length,2); assert.equal(poses[0].scale,.75); assert.equal(poses[1].scale,.75); assert.equal(poses.every(isResolvedEquipmentPose),true);
}

for(const [label,menu,state,snapshot] of [
  ["menu",true,"playing",input()],
  ["paused play",false,"paused_manual",input()],
  ["tracking paused",false,"playing",input({tracking:{gameplayPaused:true}})],
  ["countdown frozen",false,"countdown",input({countdownFrozen:true})],
  ["identity unavailable",false,"playing",input()]
]){
  const configIdentity=label==="identity unavailable"?null:identity;
  assert.equal(gameplayEquipmentRecords(menu,session(state,label==="paused play"?"play":"visual_test"),snapshot,"flow",history,null,null,equipmentConfigDefaults,configIdentity).length,0,label);
}
assert.equal(gameplayEquipmentRecords(false,session("paused_manual","visual_test"),input(),"flow",history,null,null,equipmentConfigDefaults,identity).length,2,"paused Visual Test still renders frozen shared poses");

console.log("Canonical frozen equipment pose records, exact judge anchors, XYZ/scale controls, and suppression gates passed.");
