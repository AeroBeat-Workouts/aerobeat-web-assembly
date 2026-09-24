// @ts-check

import assert from "node:assert/strict";
import { isGameplayEvidenceSnapshot } from "@aerobeat/web-contracts";
import { testEquipmentInput, testEquipmentMouseHands, visualTestProductionInput } from "../src/test-equipment-authoring.js";

assert.deepEqual(testEquipmentMouseHands, ["off", "left", "right"]);

const positions = (input) => input.anchors.map(({ anchor, x, y }) => ({ anchor, x, y }));
assert.deepEqual(positions(testEquipmentInput()), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: 1, y: 0.5 }], "Off defaults to deterministic anchors");
assert.deepEqual(positions(testEquipmentInput("left", { x: 0.2, y: 0.8 })), [{ anchor: "left_wrist", x: 0.2, y: 0.8 }, { anchor: "right_wrist", x: 1, y: 0.5 }], "left overrides only left wrist");
assert.deepEqual(positions(testEquipmentInput("right", { x: 0.2, y: 0.8 })), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: 0.2, y: 0.8 }], "right overrides only right wrist");
assert.deepEqual(positions(testEquipmentInput("right", { x: -3, y: 4 })), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: -3, y: 4 }], "finite off-grid points remain exact and unbounded");
assert.deepEqual(positions(testEquipmentInput("left", { x: NaN, y: 0.2 })), positions(testEquipmentInput()), "non-finite points cannot override deterministic anchors");
assert.deepEqual(positions(testEquipmentInput("hostile", { x: 0.2, y: 0.8 })), positions(testEquipmentInput()), "unknown hand modes fail closed to Off");
assert(Object.isFrozen(testEquipmentInput("left", { x: 0.2, y: 0.8 }).anchors), "synthetic evidence stays immutable");
const first=visualTestProductionInput("left",{x:.2,y:.8},{frameSequence:1,timestampMs:10,sourceIdentity:"source:1",calibrationId:"calibration:1"});
const second=visualTestProductionInput("left",{x:.4,y:.6},{frameSequence:2,timestampMs:11,sourceIdentity:"source:1",calibrationId:"calibration:1"});
assert.equal(isGameplayEvidenceSnapshot(first.latestEvidence),true);assert.equal(isGameplayEvidenceSnapshot(second.latestEvidence),true);
assert.notEqual(first.latestEvidence.measuredSourceFrameId,second.latestEvidence.measuredSourceFrameId,"frame identities are unique and monotonic");
assert.equal(first.sourceIdentity,"source:1");assert.equal(first.calibration.calibrationId,"calibration:1");
assert.equal(first.latestEvidence.anchors.length,2,"both visible wrists remain valid production evidence");
const offGrid=visualTestProductionInput("right",{x:1.25,y:-.5},{frameSequence:3,timestampMs:12,sourceIdentity:"source:1",calibrationId:"calibration:1"}).latestEvidence.anchors.find(({anchor})=>anchor==="right_wrist");
assert.deepEqual({x:offGrid.x,y:offGrid.y,rawX:offGrid.rawX,rawY:offGrid.rawY,cell:offGrid.cell,subcell:offGrid.subcell},{x:1.25,y:-.5,rawX:1.25,rawY:-.5,cell:null,subcell:null},"off-grid evidence preserves exact coordinates with null grid identities");
for (const [x,y,label] of [[-.25,.5,"left"],[1.25,.5,"right"],[.5,-.25,"top"],[.5,1.25,"bottom"],[-.25,-.25,"top-left"],[1.25,-.25,"top-right"],[-.25,1.25,"bottom-left"],[1.25,1.25,"bottom-right"]]) {
  const anchor=visualTestProductionInput("left",{x,y},{frameSequence:4,timestampMs:13,sourceIdentity:"source:1",calibrationId:"calibration:1"}).latestEvidence.anchors[0];
  assert.deepEqual({x:anchor.x,y:anchor.y,rawX:anchor.rawX,rawY:anchor.rawY,cell:anchor.cell,subcell:anchor.subcell},{x,y,rawX:x,rawY:y,cell:null,subcell:null},`${label} off-grid evidence remains exact`);
}
assert.deepEqual(Object.keys(first),["sourceIdentity","calibration","tracking","countdownFrozen","latestEvidence","straightQualifications"],"production input uses only strict gameplay fields");
assert.throws(()=>visualTestProductionInput("left",null,{frameSequence:0,timestampMs:0,sourceIdentity:"s",calibrationId:"c"}),/identity/u);

console.log("Test equipment authoring pure oracle PASS.");
