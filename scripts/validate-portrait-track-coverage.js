// @ts-check

import assert from "node:assert/strict";
import { effectivePortraitTrackExtensionWorldUnits } from "../src/portrait-track-coverage.js";

// Canonical production camera: world (0,1,5), glass near-top Y=-.8. The
// renderer's worldToScreen returns CSS pixels even when DPR is 3; do not
// multiply these projected coordinates by devicePixelRatio.
const cameraZ=5, nearClip=.1, marginCssPx=12;
const portraitFovRadians=100.029*Math.PI/180;
const portrait=Object.freeze({widthCssPx:393,heightCssPx:852,cameraZ,nearClip,marginCssPx,
  projectNearEdgeY:(z)=>852/2*(1+1.8/((cameraZ-z)*Math.tan(portraitFovRadians/2)))});
const landscape=Object.freeze({widthCssPx:852,heightCssPx:393,cameraZ,nearClip,marginCssPx,
  projectNearEdgeY:(z)=>393/2*(1+1.8/((cameraZ-z)*Math.tan(48*Math.PI/360)))});
const ext=(configured,viewport)=>effectivePortraitTrackExtensionWorldUnits(configured,viewport);
assert(Math.abs(portrait.projectNearEdgeY(2)-640.36)<.15,"portrait fixture must reproduce measured original glass edge in CSS pixels");
assert(portrait.projectNearEdgeY(2)<portrait.heightCssPx-200,"configured extension 2 must reproduce a substantial uncovered lower viewport");
for(const configured of [0,2]){
  const actual=ext(configured,portrait);
  assert(Number.isFinite(actual)&&actual>=configured&&actual<=20,`portrait ${configured} effective extension must remain bounded: ${actual}`);
  assert(portrait.projectNearEdgeY(actual)>=portrait.heightCssPx+12,`portrait ${configured} projected near edge must reach 12 CSS px beyond viewport: ${portrait.projectNearEdgeY(actual)}`);
  assert.equal(ext(configured,landscape),configured,`landscape configured ${configured} must be unchanged`);
}
assert(ext(2,portrait)>2&&ext(2,portrait)<5,"portrait default must grow only as needed and stop before the camera near clip");
assert.equal(ext(20,portrait),20,"authored maximum stays bounded even if near-clip limits projection");
assert.equal(ext(20,landscape),20,"landscape authored maximum stays unchanged");
for(const invalid of [NaN,Infinity,-Infinity,-100,100,null,undefined])
  assert.throws(()=>ext(invalid,portrait),TypeError,`invalid configured extension must fail closed: ${String(invalid)}`);
for(const invalidViewport of [
  {...portrait,widthCssPx:0},
  {...portrait,heightCssPx:Infinity},
  {...portrait,cameraZ:NaN},
  {...portrait,nearClip:0},
  {...portrait,projectNearEdgeY:null},
  {...portrait,marginCssPx:-1},
]) assert.throws(()=>ext(2,invalidViewport),TypeError,"invalid viewport or camera must fail closed");
const extreme={...portrait,widthCssPx:1,heightCssPx:100000,projectNearEdgeY:()=>-1e10};
assert.equal(ext(2,extreme),2,"unreachable projection retains bounded original extension");
assert.equal(ext(2,{...portrait,projectNearEdgeY:()=>NaN}),2,"nonfinite projection cannot escape authored bounds");
console.log("Canonical portrait track near-edge CSS coverage, landscape stability and invalid-input bounds passed.");
