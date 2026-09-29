// @ts-check
import assert from "node:assert/strict";
import { createEquipmentConfigIdentity, createResolvedEquipmentPose, saberCapsuleGeometry } from "@aerobeat/web-contracts";
import { equipmentColliderAnchors } from "../src/equipment-collider-anchors.js";

const wrist=(anchor,x,y,valid=true,confidence=1)=>({anchor,x,y,valid,confidence});
const input={anchors:[wrist("left_wrist",0,0),wrist("right_wrist",1,1)]};
assert.deepEqual(equipmentColliderAnchors([],input,"flow"),{left:{x:-2,y:2.5,z:0},right:{x:2,y:-.5,z:0}},"normalized input uses judge X, then renderer world X, and top-down Y");
assert.deepEqual(equipmentColliderAnchors([], {anchors:[wrist("left_wrist",.5,.5),wrist("right_wrist",.8,.2,false)]},"boxing"),{left:{x:0,y:1,z:0},right:null},"invalid wrist never projects");
for(const invalid of [-.01,1.01,NaN,Infinity])assert.equal(equipmentColliderAnchors([],{anchors:[wrist("left_wrist",invalid,.5)]},"flow").left,null);
assert.equal(equipmentColliderAnchors([],{anchors:[wrist("left_wrist",.5,.5,true,.49)]},"flow").left,null);
const configIdentity=createEquipmentConfigIdentity({schema:"aerobeat/equipment_config_identity",version:1,algorithm:"sha256",value:"a".repeat(64)});
const pose=createResolvedEquipmentPose({role:"left_wrist",mode:"flow",anchor:{x:2.25,y:.75,z:.125},scale:1,orientation:{x:0,y:0,z:0,w:1},geometryIdentity:saberCapsuleGeometry.identity,configIdentity});
assert.deepEqual(equipmentColliderAnchors([pose],input,"flow"),{left:{x:.75,y:.75,z:.125},right:{x:2,y:-.5,z:0}},"exact shared equipment pose takes priority; missing role uses measured input");
assert.deepEqual(equipmentColliderAnchors([],{latestEvidence:{provenance:"measured",anchors:[wrist("left_wrist",.25,.25)]},anchors:input.anchors},"flow"),{left:{x:-1,y:1.75,z:0},right:null},"measured evidence takes priority over stale snapshot anchors");
console.log("Private wrist collider projection handles measured input, exact poses, and missing wrists.");
