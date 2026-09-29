// @ts-check

import { isResolvedEquipmentPose, judgeToPresentationPoint } from "@aerobeat/web-contracts";

/** @typedef {Readonly<{anchor:string,valid:boolean,x:number,y:number,confidence:number}>} WristAnchor */
/** @typedef {Readonly<{gameplayPaused?:boolean,freshCalibrationRequired?:boolean,allRequiredAnchorsVisible?:boolean,anchorsFrozen?:boolean}>} WristTracking */
/** @typedef {Readonly<{tracking?:WristTracking,countdownFrozen?:boolean,retainedGeometryDimmed?:boolean,latestEvidence?:Readonly<{provenance?:string,anchors?:readonly WristAnchor[]}>,anchors?:readonly WristAnchor[]}>} WristInput */

/**
 * Private world-space wrist centers for the renderer debug spheres. Production
 * accepts current or held gameplay evidence; only Test's local preview may use
 * bare input anchors. A pose is admitted only for its matching valid wrist.
 * @param {readonly unknown[] | null} poses
 * @param {WristInput | null} input
 * @param {"flow"|"boxing"} mode
 * @param {boolean} [visualTestPreview]
 * @returns {Readonly<{left:Readonly<{x:number,y:number,z:number}>|null,right:Readonly<{x:number,y:number,z:number}>|null}>}
 */
export function equipmentColliderAnchors(poses,input,mode,visualTestPreview=false){
  const projected={left:null,right:null};
  const tracking=input?.tracking;
  if(!tracking||tracking.gameplayPaused===true||tracking.freshCalibrationRequired===true||input?.countdownFrozen===true)return Object.freeze(projected);
  const frozen=tracking.anchorsFrozen===true||input?.latestEvidence?.provenance==="frozen";
  if(!frozen&&(tracking.allRequiredAnchorsVisible!==true||input?.retainedGeometryDimmed===true))return Object.freeze(projected);
  const evidence=input?.latestEvidence;
  const evidenceAnchors=(evidence?.provenance==="measured"||evidence?.provenance==="frozen")&&Array.isArray(evidence.anchors)?evidence.anchors:null;
  const anchors=evidenceAnchors??(visualTestPreview&&Array.isArray(input?.anchors)?input.anchors:[]);
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
