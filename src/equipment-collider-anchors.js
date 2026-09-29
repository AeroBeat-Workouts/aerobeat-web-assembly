// @ts-check

import { isResolvedEquipmentPose, judgeToPresentationPoint } from "@aerobeat/web-contracts";

/**
 * Private world-space wrist centers for the renderer debug spheres. Follow the
 * same tracking admission and evidence preference as gameplayEquipmentRecords:
 * a stale pose alone cannot put a sphere where gameplay has no valid wrist.
 * @param {readonly unknown[] | null} poses
 * @param {unknown} input
 * @param {"flow"|"boxing"} mode
 * @returns {Readonly<{left:Readonly<{x:number,y:number,z:number}>|null,right:Readonly<{x:number,y:number,z:number}>|null}>}
 */
export function equipmentColliderAnchors(poses,input,mode){
  const projected={left:null,right:null};
  const tracking=input?.tracking;
  if(!tracking||tracking.gameplayPaused===true||tracking.freshCalibrationRequired===true||input?.countdownFrozen===true)return Object.freeze(projected);
  const frozen=tracking.anchorsFrozen===true||input?.latestEvidence?.provenance==="frozen";
  if(!frozen&&(tracking.allRequiredAnchorsVisible!==true||input?.retainedGeometryDimmed===true))return Object.freeze(projected);
  const anchors=Array.isArray(input?.latestEvidence?.anchors)?input.latestEvidence.anchors:Array.isArray(input?.anchors)?input.anchors:[];
  for(const hand of ["left","right"]){
    const wrist=anchors.find((entry)=>entry?.anchor===`${hand}_wrist`);
    if(wrist?.valid!==true||typeof wrist.x!=="number"||!Number.isFinite(wrist.x)||wrist.x<0||wrist.x>1||typeof wrist.y!=="number"||!Number.isFinite(wrist.y)||wrist.y<0||wrist.y>1||typeof wrist.confidence!=="number"||!Number.isFinite(wrist.confidence)||wrist.confidence<.5||wrist.confidence>1)continue;
    const pose=Array.isArray(poses)?poses.find((entry)=>isResolvedEquipmentPose(entry)&&entry.mode===mode&&entry.role===`${hand}_wrist`):null;
    // A resolved pose may be held from a previous frame; reuse it only when it
    // matches this admitted wrist's current judge-space coordinates.
    const judgeX=wrist.x*4-.5,judgeY=2.5-wrist.y*3;
    const matching=pose&&Math.abs(pose.anchor.x-judgeX)<=1e-9&&Math.abs(pose.anchor.y-judgeY)<=1e-9;
    const anchor=matching?pose.anchor:{x:judgeX,y:judgeY,z:0};
    const point=judgeToPresentationPoint(anchor);
    projected[hand]=Object.freeze({x:point.x,y:point.y,z:anchor.z});
  }
  return Object.freeze(projected);
}
