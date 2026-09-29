// @ts-check

import { isResolvedEquipmentPose, judgeToPresentationPoint } from "@aerobeat/web-contracts";

/**
 * Private world-space wrist centers for the renderer debug spheres. Prefer the
 * exact frozen poses shared with gameplay; use valid measured input wrists when
 * equipment meshes are unavailable or intentionally hidden.
 * @param {readonly unknown[] | null} poses
 * @param {unknown} input
 * @param {"flow"|"boxing"} mode
 * @returns {Readonly<{left:Readonly<{x:number,y:number,z:number}>|null,right:Readonly<{x:number,y:number,z:number}>|null}>}
 */
export function equipmentColliderAnchors(poses,input,mode){
  const projected={left:null,right:null};
  if(Array.isArray(poses))for(const candidate of poses){
    if(!isResolvedEquipmentPose(candidate)||candidate.mode!==mode)continue;
    const hand=candidate.role==="left_wrist"?"left":"right";
    if(projected[hand]!==null)continue;
    const point=judgeToPresentationPoint(candidate.anchor);
    projected[hand]=Object.freeze({x:point.x,y:point.y,z:candidate.anchor.z});
  }
  const evidence=input?.latestEvidence;
  const measured=evidence?.provenance==="measured"&&Array.isArray(evidence.anchors)?evidence.anchors:null;
  // Frozen evidence is deliberately not mistaken for a new measured wrist.
  const anchors=measured??(Array.isArray(input?.anchors)?input.anchors:[]);
  for(const hand of ["left","right"]){
    if(projected[hand]!==null)continue;
    const wrist=anchors.find((entry)=>entry?.anchor===`${hand}_wrist`);
    if(wrist?.valid!==true||typeof wrist.x!=="number"||!Number.isFinite(wrist.x)||wrist.x<0||wrist.x>1||typeof wrist.y!=="number"||!Number.isFinite(wrist.y)||wrist.y<0||wrist.y>1||typeof wrist.confidence!=="number"||!Number.isFinite(wrist.confidence)||wrist.confidence<.5||wrist.confidence>1)continue;
    const point=judgeToPresentationPoint({x:wrist.x*4-.5,y:2.5-wrist.y*3});
    projected[hand]=Object.freeze({x:point.x,y:point.y,z:0});
  }
  return Object.freeze(projected);
}
