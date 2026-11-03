// @ts-check
import assert from "node:assert/strict";
import { createResolvedEquipmentPose, equipmentEulerDegreesToQuaternion, multiplyEquipmentQuaternions, saberCapsuleGeometry, gloveObbGeometry } from "@aerobeat/web-contracts";
import { validateEquipmentConfig } from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";
import { gameplayEquipmentRecords } from "../src/gameplay-equipment-records.js";
import { squareRadialSaberTarget } from "../src/saber-zone-direction.js";
import { createFrameSplineEquipmentProjector, reprojectSplineEquipmentPose } from "../src/spline-equipment-projection.js";
import { createTestWebcamSampler, normalizeTestWebcamFps } from "../src/test-webcam-sampler.js";

const config = validateEquipmentConfig(equipmentConfigDefaults);
const identity = Object.freeze({schema:"aerobeat/equipment_config_identity",version:1,algorithm:"sha256",value:"a".repeat(64)});
for (const point of [{x:0,y:0},{x:.5,y:.5},{x:.7,y:.2},{x:1,y:1}]) {
  for (const center of [{x:.5,y:.5},{x:.2,y:.3}]) {
    const base = equipmentEulerDegreesToQuaternion(config.flow.perHand.right.rotationEulerDeg);
    const target = squareRadialSaberTarget(point.x, 1-point.y, config.flow.saber.zones, config.flow.saber.blendRadius, {x:center.x,y:1-center.y}, base);
    const seed = createResolvedEquipmentPose({role:"right_wrist", mode:"flow",anchor:{x:4*point.x-.5,y:2.5-3*point.y,z:0},scale:config.flow.perHand.right.scale,orientation:{x:0,y:0,z:0,w:1},geometryIdentity:saberCapsuleGeometry.identity,configIdentity:identity});
    const projected = reprojectSplineEquipmentPose(seed,config,{left:center,right:center});
    const expected=multiplyEquipmentQuaternions(base,target.orientation);
    for(const axis of ["x","y","z","w"]) assert.ok(Math.abs(projected.orientation[axis]-expected[axis])<1e-12,"spline nodes use the live position-dependent rotation field (grid/WU round-trip tolerance)");
    const input={tracking:{allRequiredAnchorsVisible:true},anchors:[{anchor:"right_wrist",valid:true,confidence:1,...point}]};
    const live=gameplayEquipmentRecords(false,{state:"playing"},input,"flow",null,{left:target,right:target},config,identity)[0];
    assert.deepEqual(projected.anchor,live.anchor);
    assert.equal(projected.scale,live.scale);
    for(const axis of ["x","y","z","w"]) assert.ok(Math.abs(projected.orientation[axis]-live.orientation[axis])<1e-12,"reconstructed equipment matches production projection at the same grid position");
  }
}
const boxing=createResolvedEquipmentPose({role:"right_wrist",mode:"boxing",anchor:{x:1,y:1,z:0},scale:1,orientation:{x:0,y:0,z:0,w:1},geometryIdentity:gloveObbGeometry.identity,configIdentity:identity});
assert.equal(reprojectSplineEquipmentPose(boxing,config,{left:null,right:null}),boxing,"Boxing keeps its resolved action-driven animation; scored cylinder follows the reconstructed anchor");

// A frame cache may reuse orientation, never the rest of an equipment pose.
const changedConfig = structuredClone(equipmentConfigDefaults);
changedConfig.flow.perHand.left.rotationEulerDeg.z = 17;
changedConfig.flow.perHand.right.rotationEulerDeg.z = -23;
const asymmetric = validateEquipmentConfig(changedConfig);
const pivots = { left: { x:.3, y:.4 }, right: { x:.7, y:.45 } };
const cached = createFrameSplineEquipmentProjector(asymmetric, pivots);
for (const role of ["left_wrist", "right_wrist"]) {
  for (const x of [-.5, 0, 1.5, 3.5]) for (const y of [-.5, 1, 2.5]) {
    for (const scale of [.5, 2]) for (const z of [-.25, .75]) {
      const pose = createResolvedEquipmentPose({ role, mode:"flow", anchor:{x,y,z}, scale,
        orientation:equipmentEulerDegreesToQuaternion({x:11,y:23,z:37}),
        geometryIdentity:saberCapsuleGeometry.identity, configIdentity:z<0?identity:{...identity,value:"b".repeat(64)} });
      assert.deepEqual(cached(pose), reprojectSplineEquipmentPose(pose, asymmetric, pivots),
        "cached projection preserves every returned pose field across repeated x/y, hands, z and scale");
    }
  }
}
assert.equal(cached(boxing), boxing, "cached projector leaves Boxing identity untouched");
const seed = createResolvedEquipmentPose({role:"left_wrist", mode:"flow",anchor:{x:0,y:1,z:0},scale:1,orientation:{x:0,y:0,z:0,w:1},geometryIdentity:saberCapsuleGeometry.identity,configIdentity:identity});
cached(seed);
assert.throws(()=>cached({...seed,scale:NaN}), "a cache hit must still validate the complete return pose");
const nextPivots = { left: {x:.6,y:.25}, right:null };
const nextFrame = createFrameSplineEquipmentProjector(config, nextPivots);
assert.deepEqual(nextFrame(seed), reprojectSplineEquipmentPose(seed,config,nextPivots), "new frame uses changed config/pivot");
assert.notDeepEqual(nextFrame(seed).orientation, cached(seed).orientation, "frame reset case must actually change orientation");
const copiedPivots = {left:{x:.3,y:.4},right:null};
const captured = createFrameSplineEquipmentProjector(config,copiedPivots);
copiedPivots.left.x = .9;
assert.deepEqual(captured(seed),reprojectSplineEquipmentPose(seed,config,{left:{x:.3,y:.4},right:null}),"frame captures scalar pivot values");
console.log("Frame-local orientation reuse has exact full-pose parity, fresh-frame config/pivots, Boxing identity and cached-return validation.");

const sampler=createTestWebcamSampler();
let sequence=0;
const produce=()=>({sequence:++sequence});
const first=sampler.sample(1000,5,"run1",produce);
for(let t=1010;t<1200;t+=10) assert.equal(sampler.sample(t,5,"run1",produce),first,"render ticks hold one webcam measurement");
assert.equal(sequence,1);
assert.equal(sampler.sample(1200,5,"run1",produce).sequence,2);
assert.equal(sampler.sample(1201,5,"run2",produce).sequence,3,"new session/interaction resets sampling");
assert.equal(sampler.sample(1202,0,"run2",produce).sequence,4,"native cadence emits at every render tick");
assert.equal(sampler.sample(1203,0,"run2",produce).sequence,5);
sampler.reset();
assert.equal(sampler.sample(0,1,"run2",produce).sequence,6);
assert.equal(sampler.sample(999,1,"run2",produce).sequence,6);
assert.equal(sampler.sample(1000,1,"run2",produce).sequence,7);
for(const value of [0,1,5,15,60]) assert.equal(normalizeTestWebcamFps(value),value);
for(const value of [-1,.5,61,NaN,Infinity,"5"]) assert.throws(()=>normalizeTestWebcamFps(value),RangeError);
console.log("Spline equipment uses production projection; Test webcam sample-and-hold leaves render cadence independent.");
