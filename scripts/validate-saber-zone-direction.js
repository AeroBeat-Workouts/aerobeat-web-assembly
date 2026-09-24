// @ts-check
// Pure v3 square-radial Flow target, complete-quaternion, and tracker oracle.

import assert from "node:assert/strict";
import {
  equipmentEulerDegreesToQuaternion,
  multiplyEquipmentQuaternions,
  slerpEquipmentQuaternionShortest
} from "@aerobeat/web-contracts";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";
import {
  SABER_ZONE_ANCHORS,
  createSquareRadialSaberTargetTracker,
  projectSquareRadialOrientation,
  squareRadialEdgeWeights,
  squareRadialSaberTarget
} from "../src/saber-zone-direction.js";

const CFG = equipmentConfigDefaults.flow.saber;
const ZONES = CFG.zones;
const RADIUS = CFG.blendRadius;
const close = (a, b, tolerance = 1e-9, message = "") => assert.ok(Math.abs(a - b) <= tolerance, `${message}: expected ${b}, got ${a}`);
const dot = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w;
const quatDistanceDeg = (a, b) => {
  const similarity = Math.min(1, Math.abs(dot(a,b)));
  return 1 - similarity <= 1e-14 ? 0 : 2 * Math.acos(similarity) * 180 / Math.PI;
};
const quatClose = (a, b, tolerance = 1e-8, message = "") => assert.ok(quatDistanceDeg(a,b) <= tolerance, `${message}: ${quatDistanceDeg(a,b)} degrees apart`);
const edgeQ = (key, zones = ZONES) => multiplyEquipmentQuaternions(
  equipmentEulerDegreesToQuaternion({ x:0,y:0,z:zones[key].headingDeg }),
  equipmentEulerDegreesToQuaternion(zones[key].localRotationEulerDeg)
);

assert.deepEqual(Object.keys(SABER_ZONE_ANCHORS), ["edgeTop","edgeBottom","edgeLeft","edgeRight"]);
assert.equal(Object.hasOwn(ZONES, "center"), false, "v3 field has no authored center");

// Exact axes are full edge targets; exact corners are adjacent-edge 50/50 targets.
for (const key of Object.keys(SABER_ZONE_ANCHORS)) {
  const point = SABER_ZONE_ANCHORS[key];
  const target = squareRadialSaberTarget(point.x, point.y, ZONES, RADIUS);
  assert(target !== null);
  quatClose(target.orientation, edgeQ(key), 1e-8, `${key} full target`);
  close(target.weights[key], 1, 0, `${key} full weight`);
}
for (const [x,y,a,b] of [[1,1,"edgeRight","edgeTop"],[1,0,"edgeRight","edgeBottom"],[0,0,"edgeLeft","edgeBottom"],[0,1,"edgeLeft","edgeTop"]]) {
  const target = squareRadialSaberTarget(x,y,ZONES,RADIUS);
  assert(target !== null);
  close(target.weights[a], .5, 1e-12, `${a} corner weight`);
  close(target.weights[b], .5, 1e-12, `${b} corner weight`);
  quatClose(target.orientation, slerpEquipmentQuaternionShortest(edgeQ(a),edgeQ(b),.5), 1e-8, `${a}/${b} full-target corner blend`);
}

// 4,097 samples on each center ray: every non-center point reaches the same
// square-boundary target, with no center disk or plateau.
const rays = [
  ["top",.5,1,"edgeTop"], ["bottom",.5,0,"edgeBottom"], ["left",0,.5,"edgeLeft"], ["right",1,.5,"edgeRight"],
  ["top-right",1,1,null], ["bottom-right",1,0,null], ["bottom-left",0,0,null], ["top-left",0,1,null]
];
for (const [name,ex,ey,key] of rays) {
  let previous = null;
  for (let i=0;i<4097;i+=1) {
    const t=(i+1)/4097;
    const target=squareRadialSaberTarget(.5+(ex-.5)*t,.5+(ey-.5)*t,ZONES,RADIUS);
    assert(target !== null, `${name} sample ${i} must resolve`);
    if (previous) quatClose(target.orientation, previous, 1e-7, `${name} radial invariance sample ${i}`);
    previous=target.orientation;
  }
  if (key) quatClose(previous, edgeQ(key), 1e-8, `${name} endpoint`);
}

// 4,097 perimeter samples, including all corners, stay locally continuous.
const perimeterPoint = (t) => {
  const u=(t%1)*4;
  if (u<1) return {x:u,y:1};
  if (u<2) return {x:1,y:2-u};
  if (u<3) return {x:3-u,y:0};
  return {x:0,y:u-3};
};
let prior=null, maxStep=0;
for (let i=0;i<4097;i+=1) {
  const point=perimeterPoint(i/4096);
  const target=squareRadialSaberTarget(point.x,point.y,ZONES,RADIUS);
  assert(target !== null);
  if(prior) maxStep=Math.max(maxStep,quatDistanceDeg(prior,target.orientation));
  prior=target.orientation;
}
assert.ok(maxStep<0.5, `4097-sample perimeter max quaternion step ${maxStep} must be continuous`);

// 4,097 samples from center through every edge/corner and far outside remain
// finite and continuous. Only orientation input clamps; projection never changes
// the supplied truthful point.
for (const [name,ex,ey] of rays) {
  let previous=null;
  for(let i=0;i<4097;i+=1){
    const t=(i+1)/1024; // reaches roughly four square radii outside
    const x=.5+(ex-.5)*t, y=.5+(ey-.5)*t;
    const projected=projectSquareRadialOrientation(x,y);
    const target=squareRadialSaberTarget(x,y,ZONES,RADIUS);
    assert(projected!==null&&target!==null,`${name} outside sample resolves`);
    assert.ok(projected.x>=0&&projected.x<=1&&projected.y>=0&&projected.y<=1,"orientation projection is bounded");
    if(previous) maxStep=Math.max(maxStep,quatDistanceDeg(previous,target.orientation));
    previous=target.orientation;
  }
}
assert.deepEqual(projectSquareRadialOrientation(-20,.5),{x:0,y:.5});
assert.deepEqual(projectSquareRadialOrientation(20,.5),{x:1,y:.5});
assert.equal(projectSquareRadialOrientation(.5,.5),null);
assert.equal(squareRadialEdgeWeights(.5,.5,RADIUS),null);
assert.throws(()=>squareRadialEdgeWeights(.6,.6,0),/blendRadius/u);
assert.throws(()=>squareRadialEdgeWeights(.6,.6,.51),/blendRadius/u);

// Complete local XYZ is composed into each edge before spatial slerp.
const xyzZones=structuredClone(ZONES);
xyzZones.edgeTop={headingDeg:130,localRotationEulerDeg:{x:31,y:-47,z:12}};
xyzZones.edgeRight={headingDeg:-120,localRotationEulerDeg:{x:-22,y:63,z:-19}};
const topExpected=edgeQ("edgeTop",xyzZones), rightExpected=edgeQ("edgeRight",xyzZones);
quatClose(squareRadialSaberTarget(.5,1,xyzZones,RADIUS).orientation,topExpected,1e-8,"top full local XYZ");
quatClose(squareRadialSaberTarget(1,.5,xyzZones,RADIUS).orientation,rightExpected,1e-8,"right full local XYZ");
quatClose(squareRadialSaberTarget(1,1,xyzZones,RADIUS).orientation,slerpEquipmentQuaternionShortest(rightExpected,topExpected,.5),1e-8,"corner blends full local XYZ quaternions");

// ±180 uses the shortest two-degree arc, never the 358-degree long path.
const branchZones=structuredClone(ZONES);
branchZones.edgeTop={headingDeg:179,localRotationEulerDeg:{x:0,y:0,z:0}};
branchZones.edgeRight={headingDeg:-179,localRotationEulerDeg:{x:0,y:0,z:0}};
const branchCorner=squareRadialSaberTarget(1,1,branchZones,RADIUS);
assert(branchCorner!==null);
const rotatedX={x:1-2*branchCorner.orientation.z**2,y:2*branchCorner.orientation.w*branchCorner.orientation.z};
assert.ok(rotatedX.x<-.999,"±180 corner midpoint remains near 180 degrees");

// Exact center retains each hand's last stable target; no-history bootstrap is
// deterministic and role-side.
const tracker=createSquareRadialSaberTargetTracker();
const leftBootstrap=tracker.tick("left",.5,.5,ZONES,RADIUS,0,"linear",100);
const rightBootstrap=tracker.tick("right",.5,.5,ZONES,RADIUS,0,"linear",100);
assert.equal(leftBootstrap.bootstrapped,true); assert.equal(rightBootstrap.bootstrapped,true);
quatClose(leftBootstrap.targetOrientation,edgeQ("edgeLeft"),1e-8,"left center bootstrap");
quatClose(rightBootstrap.targetOrientation,edgeQ("edgeRight"),1e-8,"right center bootstrap");
tracker.tick("left",.5,1,ZONES,RADIUS,100,"linear",0);
const retained=tracker.tick("left",.5,.5,ZONES,RADIUS,101,"linear",0);
assert.equal(retained.retainedCenter,true);
quatClose(retained.targetOrientation,edgeQ("edgeTop"),1e-8,"exact center retains last non-center target");
tracker.reset();
assert.equal(tracker.tick("left",.5,.5,ZONES,RADIUS,200,"linear",0).bootstrapped,true,"reset removes center history");

// Fixed endpoints are independent of 30/60/120 Hz evaluation cadence.
const cadenceResult=(hz)=>{
  const candidate=createSquareRadialSaberTargetTracker();
  candidate.tick("right",.5,1,ZONES,RADIUS,-100,"linear",100);
  candidate.tick("right",1,.5,ZONES,RADIUS,0,"linear",100);
  const step=1000/hz;
  for(let now=step;now<50;now+=step)candidate.tick("right",1,.5,ZONES,RADIUS,now,"linear",100);
  return candidate.tick("right",1,.5,ZONES,RADIUS,50,"linear",100).orientation;
};
const q30=cadenceResult(30),q60=cadenceResult(60),q120=cadenceResult(120);
quatClose(q30,q60,1e-8,"30/60 cadence parity"); quatClose(q60,q120,1e-8,"60/120 cadence parity");
quatClose(q30,slerpEquipmentQuaternionShortest(edgeQ("edgeTop"),edgeQ("edgeRight"),.5),1e-8,"cadence midpoint is fixed-endpoint midpoint");


console.log(`Square-radial saber validation passed (4097-sample rays/perimeter/outside; max perimeter step ${maxStep.toFixed(6)} degrees).`);
