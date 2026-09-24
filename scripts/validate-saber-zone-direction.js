// @ts-check
// Pure v4 neutral-center square-radial Flow target and tracker oracle.

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
  squareRadialNeutralInfluence,
  squareRadialSaberTarget
} from "../src/saber-zone-direction.js";

const CFG = equipmentConfigDefaults.flow.saber;
const ZONES = CFG.zones;
const RADIUS = CFG.blendRadius;
const IDENTITY = Object.freeze({ x:0, y:0, z:0, w:1 });
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
const smoothstep = (t) => t*t*(3-2*t);

assert.deepEqual(Object.keys(SABER_ZONE_ANCHORS), ["edgeTop","edgeBottom","edgeLeft","edgeRight"]);
assert.equal(Object.hasOwn(ZONES, "center"), false, "v4 field has no authored center");

// Exact center is the identity spatial adjustment. The per-hand base is composed
// later, so center means exactly the configured hand rotation and no edge target.
const center = squareRadialSaberTarget(.5,.5,ZONES,RADIUS);
quatClose(center.orientation, IDENTITY, 0, "exact center identity");
assert.equal(center.radius, 0); assert.equal(center.influence, 0);
assert.equal(center.boundary, null); assert.deepEqual(center.weights, {edgeTop:0,edgeBottom:0,edgeLeft:0,edgeRight:0});
assert.deepEqual(squareRadialNeutralInfluence(.5,.5), {radius:0,influence:0});
assert.deepEqual(squareRadialNeutralInfluence(1,.75), {radius:1,influence:1});
assert.deepEqual(squareRadialNeutralInfluence(20,-20), {radius:1,influence:1});

// Exact axes are full edge targets; exact corners are adjacent-edge 50/50 targets.
for (const key of Object.keys(SABER_ZONE_ANCHORS)) {
  const point = SABER_ZONE_ANCHORS[key];
  const target = squareRadialSaberTarget(point.x, point.y, ZONES, RADIUS);
  quatClose(target.orientation, edgeQ(key), 1e-8, `${key} full target`);
  close(target.weights[key], 1, 0, `${key} full weight`);
  assert.equal(target.radius,1); assert.equal(target.influence,1);
}
for (const [x,y,a,b] of [[1,1,"edgeRight","edgeTop"],[1,0,"edgeRight","edgeBottom"],[0,0,"edgeLeft","edgeBottom"],[0,1,"edgeLeft","edgeTop"]]) {
  const target = squareRadialSaberTarget(x,y,ZONES,RADIUS);
  close(target.weights[a], .5, 1e-12, `${a} corner weight`);
  close(target.weights[b], .5, 1e-12, `${b} corner weight`);
  quatClose(target.orientation, slerpEquipmentQuaternionShortest(edgeQ(a),edgeQ(b),.5), 1e-8, `${a}/${b} corner blend`);
}

const rays = [
  ["top",.5,1,"edgeTop"], ["bottom",.5,0,"edgeBottom"], ["left",0,.5,"edgeLeft"], ["right",1,.5,"edgeRight"],
  ["top-right",1,1,null], ["bottom-right",1,0,null], ["bottom-left",0,0,null], ["top-left",0,1,null]
];

// 4,097 center-to-perimeter samples on every edge/corner ray follow the exact
// smoothstep identity→perimeter shortest path and increase monotonically.
for (const [name,ex,ey,key] of rays) {
  const endpoint = squareRadialSaberTarget(ex,ey,ZONES,RADIUS).orientation;
  let priorDistance = -1;
  for (let i=0;i<4097;i+=1) {
    const t=i/4096;
    const target=squareRadialSaberTarget(.5+(ex-.5)*t,.5+(ey-.5)*t,ZONES,RADIUS);
    close(target.radius,t,1e-12,`${name} radius ${i}`);
    close(target.influence,smoothstep(t),1e-12,`${name} influence ${i}`);
    quatClose(target.orientation,slerpEquipmentQuaternionShortest(IDENTITY,endpoint,smoothstep(t)),1e-7,`${name} radial path ${i}`);
    const distance=quatDistanceDeg(IDENTITY,target.orientation);
    assert.ok(distance+1e-8>=priorDistance,`${name} distance must be monotonic at ${i}`);
    priorDistance=distance;
  }
  if (key) quatClose(endpoint,edgeQ(key),1e-8,`${name} endpoint`);
}

// Direction can be undefined/discontinuous at exact center, but radial influence
// vanishes quadratically, so crossing between competing edge directions cannot snap.
const epsilon=1e-4;
const centerNeighborhood=[
  squareRadialSaberTarget(.5+epsilon,.5,ZONES,RADIUS).orientation,
  squareRadialSaberTarget(.5-epsilon,.5,ZONES,RADIUS).orientation,
  squareRadialSaberTarget(.5,.5+epsilon,ZONES,RADIUS).orientation,
  squareRadialSaberTarget(.5,.5-epsilon,ZONES,RADIUS).orientation
];
for(const value of centerNeighborhood) assert.ok(quatDistanceDeg(IDENTITY,value)<1e-4,"near-center edge influence must vanish");
for(let i=1;i<centerNeighborhood.length;i+=1) assert.ok(quatDistanceDeg(centerNeighborhood[0],centerNeighborhood[i])<2e-4,"near-center direction changes cannot snap");

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
  if(prior) maxStep=Math.max(maxStep,quatDistanceDeg(prior,target.orientation));
  prior=target.orientation;
}
assert.ok(maxStep<1, `4097-sample perimeter max quaternion step ${maxStep} must be continuous`);

// Orientation saturates outside; projection never changes caller-owned position.
for (const [name,ex,ey] of rays) {
  const edge=squareRadialSaberTarget(ex,ey,ZONES,RADIUS);
  for(let i=1;i<=4097;i+=1){
    const t=1+i/1024;
    const x=.5+(ex-.5)*t, y=.5+(ey-.5)*t;
    const projected=projectSquareRadialOrientation(x,y);
    const target=squareRadialSaberTarget(x,y,ZONES,RADIUS);
    assert(projected!==null,`${name} outside projection resolves`);
    assert.ok(projected.x>=0&&projected.x<=1&&projected.y>=0&&projected.y<=1,"orientation projection is bounded");
    assert.equal(target.radius,1); assert.equal(target.influence,1);
    quatClose(target.orientation,edge.orientation,1e-7,`${name} outside saturation ${i}`);
  }
}
assert.deepEqual(projectSquareRadialOrientation(-20,.5),{x:0,y:.5});
assert.deepEqual(projectSquareRadialOrientation(20,.5),{x:1,y:.5});
assert.equal(projectSquareRadialOrientation(.5,.5),null);
assert.equal(squareRadialEdgeWeights(.5,.5,RADIUS),null);
assert.throws(()=>squareRadialEdgeWeights(.6,.6,0),/blendRadius/u);
assert.throws(()=>squareRadialEdgeWeights(.6,.6,.51),/blendRadius/u);

// Complete local XYZ is composed into each edge before spatial/radial slerp.
const xyzZones=structuredClone(ZONES);
xyzZones.edgeTop={headingDeg:130,localRotationEulerDeg:{x:31,y:-47,z:12}};
xyzZones.edgeRight={headingDeg:-120,localRotationEulerDeg:{x:-22,y:63,z:-19}};
const topExpected=edgeQ("edgeTop",xyzZones), rightExpected=edgeQ("edgeRight",xyzZones);
quatClose(squareRadialSaberTarget(.5,1,xyzZones,RADIUS).orientation,topExpected,1e-8,"top full local XYZ");
quatClose(squareRadialSaberTarget(1,.5,xyzZones,RADIUS).orientation,rightExpected,1e-8,"right full local XYZ");
quatClose(squareRadialSaberTarget(1,1,xyzZones,RADIUS).orientation,slerpEquipmentQuaternionShortest(rightExpected,topExpected,.5),1e-8,"corner blends full local XYZ quaternions");

// ±180 uses the shortest two-degree perimeter arc, never the 358-degree long path.
const branchZones=structuredClone(ZONES);
branchZones.edgeTop={headingDeg:179,localRotationEulerDeg:{x:0,y:0,z:0}};
branchZones.edgeRight={headingDeg:-179,localRotationEulerDeg:{x:0,y:0,z:0}};
const branchCorner=squareRadialSaberTarget(1,1,branchZones,RADIUS);
const rotatedX={x:1-2*branchCorner.orientation.z**2,y:2*branchCorner.orientation.w*branchCorner.orientation.z};
assert.ok(rotatedX.x<-.999,"±180 corner midpoint remains near 180 degrees");

// Tracker center is stateless identity for both roles; reset cannot change it.
const tracker=createSquareRadialSaberTargetTracker();
for(const hand of ["left","right"]){
  const value=tracker.tick(hand,.5,.5,ZONES,RADIUS,0,"linear",100);
  quatClose(value.targetOrientation,IDENTITY,0,`${hand} center identity`);
  assert.equal(value.radius,0); assert.equal(value.influence,0);
  assert.equal(Object.hasOwn(value,"retainedCenter"),false); assert.equal(Object.hasOwn(value,"bootstrapped"),false);
}
tracker.tick("left",.5,1,ZONES,RADIUS,100,"linear",0);
quatClose(tracker.tick("left",.5,.5,ZONES,RADIUS,101,"linear",0).targetOrientation,IDENTITY,0,"center never retains edge history");
tracker.reset();
quatClose(tracker.tick("left",.5,.5,ZONES,RADIUS,200,"linear",0).targetOrientation,IDENTITY,0,"reset center remains identity");

// Fixed temporal endpoints are independent of 30/60/120 Hz evaluation cadence.
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

console.log(`Neutral-center square-radial saber validation passed (4097-sample rays/perimeter/outside; max perimeter step ${maxStep.toFixed(6)} degrees).`);
