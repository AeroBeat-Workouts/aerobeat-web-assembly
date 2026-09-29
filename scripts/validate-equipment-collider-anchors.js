// @ts-check
import assert from "node:assert/strict";
import { createEquipmentConfigIdentity, createResolvedEquipmentPose, saberCapsuleGeometry } from "@aerobeat/web-contracts";
import { equipmentColliderAnchors } from "../src/equipment-collider-anchors.js";

const wrist=(anchor,x,y,valid=true,confidence=1)=>({anchor,x,y,valid,confidence});
const tracking={gameplayPaused:false,freshCalibrationRequired:false,allRequiredAnchorsVisible:true,anchorsFrozen:false};
const input={tracking,anchors:[wrist("left_wrist",0,0),wrist("right_wrist",1,1)]};
const measured={...input,latestEvidence:{provenance:"measured",anchors:input.anchors}};
const empty={left:null,right:null};
assert.deepEqual(equipmentColliderAnchors([],input,"flow"),empty,"production never uses bare potentially stale snapshot anchors");
assert.deepEqual(equipmentColliderAnchors([],input,"flow",true),{left:{x:-2,y:2.5,z:0},right:{x:2,y:-.5,z:0}},"Visual Test preview projects judge X to renderer world X and top-down Y");
assert.deepEqual(equipmentColliderAnchors([], {...measured,latestEvidence:{provenance:"measured",anchors:[wrist("left_wrist",.5,.5),wrist("right_wrist",.8,.2,false)]}},"boxing"),{left:{x:0,y:1,z:0},right:null},"invalid measured wrist never projects");
for(const invalid of [-.01,1.01,NaN,Infinity])assert.equal(equipmentColliderAnchors([],{...measured,latestEvidence:{provenance:"measured",anchors:[wrist("left_wrist",invalid,.5)]}},"flow").left,null);
assert.equal(equipmentColliderAnchors([],{...measured,latestEvidence:{provenance:"measured",anchors:[wrist("left_wrist",.5,.5,true,.49)]}},"flow").left,null);
for(const gated of [{...measured,tracking:{...tracking,gameplayPaused:true}},{...measured,tracking:{...tracking,freshCalibrationRequired:true}},{...measured,countdownFrozen:true},{...measured,tracking:{...tracking,allRequiredAnchorsVisible:false}},{...measured,retainedGeometryDimmed:true},{anchors:input.anchors}])assert.deepEqual(equipmentColliderAnchors([],gated,"flow"),empty,"unscorable wrist cannot produce collider center");
const configIdentity=createEquipmentConfigIdentity({schema:"aerobeat/equipment_config_identity",version:1,algorithm:"sha256",value:"a".repeat(64)});
const pose=createResolvedEquipmentPose({role:"left_wrist",mode:"flow",anchor:{x:2.25,y:.75,z:.125},scale:1,orientation:{x:0,y:0,z:0,w:1},geometryIdentity:saberCapsuleGeometry.identity,configIdentity});
assert.deepEqual(equipmentColliderAnchors([pose],{...measured,latestEvidence:{provenance:"measured",anchors:[wrist("left_wrist",.6875,7/12),wrist("right_wrist",1,1)]}},"flow"),{left:{x:.75,y:.75,z:.125},right:{x:2,y:-.5,z:0}},"matching exact pose takes priority and preserves z");
assert.deepEqual(equipmentColliderAnchors([pose],measured,"flow"),{left:{x:-2,y:2.5,z:0},right:{x:2,y:-.5,z:0}},"stale pose cannot override current admitted wrist");
assert.deepEqual(equipmentColliderAnchors([pose],{...measured,latestEvidence:{provenance:"measured",anchors:[wrist("left_wrist",0,0,false)]}},"flow"),empty,"invalid wrist suppresses even an otherwise valid stale pose");
assert.deepEqual(equipmentColliderAnchors([],{...measured,latestEvidence:{provenance:"measured",anchors:[wrist("left_wrist",.25,.25)]}},"flow"),{left:{x:-1,y:1.75,z:0},right:null},"latest evidence takes priority over stale snapshot anchors");
assert.deepEqual(equipmentColliderAnchors([],{...measured,tracking:{...tracking,allRequiredAnchorsVisible:false},latestEvidence:{provenance:"frozen",anchors:[wrist("left_wrist",.25,.25)]}},"flow"),{left:{x:-1,y:1.75,z:0},right:null},"frozen held evidence remains admitted while tracking latches");
assert.deepEqual(equipmentColliderAnchors([],{...measured,latestEvidence:{provenance:"invalid",anchors:input.anchors}},"flow"),empty,"unrecognized evidence cannot fall back to production snapshot anchors");
console.log("Private wrist collider projection honors gameplay tracking gates, evidence priority, and exact world mapping.");
