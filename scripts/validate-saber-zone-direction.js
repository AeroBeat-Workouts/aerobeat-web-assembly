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
const smallestOffset = .5 + Number.EPSILON;
const noDeadZone = squareRadialSaberTarget(smallestOffset,.5,ZONES,RADIUS);
assert(noDeadZone.boundary !== null && noDeadZone.radius > 0 && noDeadZone.influence > 0,"every representable non-center offset has positive influence and no authored dead zone");
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

// The spatial field has no retained role/session history: edge→center is exact
// identity regardless of prior calls or hand-side conventions.
squareRadialSaberTarget(.5,1,ZONES,RADIUS);
quatClose(squareRadialSaberTarget(.5,.5,ZONES,RADIUS).orientation,IDENTITY,0,"center never retains edge history");
squareRadialSaberTarget(0,.5,ZONES,RADIUS);
quatClose(squareRadialSaberTarget(.5,.5,ZONES,RADIUS).orientation,IDENTITY,0,"center is independent of prior side");

// Continuously moving center→edge and center→corner paths must produce the same
// quaternion at shared wall-clock checkpoints after arbitrary 30/60/120 Hz
// interstitial evaluation. This catches sample-rate-dependent temporal lag.
const cadencePath=(hz,ex,ey)=>{
  const checkpoints=[.1,.25,.5,.75,1], result=[];
  let nextFrame=0;
  for(const checkpoint of checkpoints){
    while(nextFrame<checkpoint){squareRadialSaberTarget(.5+(ex-.5)*nextFrame,.5+(ey-.5)*nextFrame,ZONES,RADIUS);nextFrame+=1/hz;}
    result.push(squareRadialSaberTarget(.5+(ex-.5)*checkpoint,.5+(ey-.5)*checkpoint,ZONES,RADIUS).orientation);
  }
  return result;
};
for(const [name,ex,ey] of [["edge",1,.5],["corner",1,1]]){
  const paths=[30,60,120].map((hz)=>cadencePath(hz,ex,ey));
  for(let checkpoint=0;checkpoint<paths[0].length;checkpoint+=1){
    quatClose(paths[0][checkpoint],paths[1][checkpoint],0,`${name} 30/60 moving cadence checkpoint ${checkpoint}`);
    quatClose(paths[1][checkpoint],paths[2][checkpoint],0,`${name} 60/120 moving cadence checkpoint ${checkpoint}`);
  }
}

// Off-center (shoulder) pivot: the field radiates from a body point, not the
// screen center. Wrist at the pivot is neutral; a wrist offset in a direction
// takes that edge's full target; influence scales with distance from the pivot.
const SHOULDER = Object.freeze({ x: 0.3, y: 0.5 });
quatClose(squareRadialSaberTarget(SHOULDER.x, SHOULDER.y, ZONES, RADIUS, SHOULDER).orientation, IDENTITY, 0, "wrist at shoulder is neutral");
assert.equal(squareRadialNeutralInfluence(SHOULDER.x, SHOULDER.y, SHOULDER).radius, 0, "zero radius at the shoulder pivot");
const rightOfShoulder = squareRadialSaberTarget(0.8, SHOULDER.y, ZONES, RADIUS, SHOULDER);
quatClose(rightOfShoulder.orientation, edgeQ("edgeRight"), 1e-8, "wrist right of shoulder takes edgeRight");
assert.equal(rightOfShoulder.influence, 1, "0.5 from the shoulder in the dominant axis is full influence");
const aboveShoulder = squareRadialSaberTarget(SHOULDER.x, 1, ZONES, RADIUS, SHOULDER);
quatClose(aboveShoulder.orientation, edgeQ("edgeTop"), 1e-8, "wrist above shoulder takes edgeTop");
const halfFromShoulder = squareRadialSaberTarget(SHOULDER.x + 0.25, SHOULDER.y, ZONES, RADIUS, SHOULDER);
close(halfFromShoulder.radius, 0.5, 1e-12, "0.25 from the shoulder is radius 0.5");
close(halfFromShoulder.influence, smoothstep(0.5), 1e-12, "influence is smoothstep of the radius");
// Backward compatibility: the default center (0.5, 0.5) is identical to the
// explicit center, so pre-shoulder callers are unchanged.
for (const [x, y] of [[0.5, 0.5], [1, 0.5], [0.2, 0.8], [0, 1]]) {
  const implicit = squareRadialSaberTarget(x, y, ZONES, RADIUS);
  const explicit = squareRadialSaberTarget(x, y, ZONES, RADIUS, { x: 0.5, y: 0.5 });
  quatClose(implicit.orientation, explicit.orientation, 0, `default center matches explicit for ${x},${y}`);
}
assert.throws(() => squareRadialSaberTarget(0.5, 0.5, ZONES, RADIUS, { x: NaN, y: 0.5 }), /center must be a finite/u, "non-finite center rejected");

console.log(`Neutral-center square-radial saber validation passed (4097-sample rays/perimeter/outside; max perimeter step ${maxStep.toFixed(6)} degrees).`);
