// @ts-check

/**
 * Extend only the visual glass/catcher toward a portrait camera; scoring and
 * calibrated target positions continue to use the caller's original setup.
 * `projectNearEdgeY` returns CSS pixels in the current PlayCanvas camera.
 * @param {number} configured
 * @param {{widthCssPx:number,heightCssPx:number,cameraZ:number,nearClip:number,projectNearEdgeY:(z:number)=>number,marginCssPx?:number}} viewport
 */
export function effectivePortraitTrackExtensionWorldUnits(configured,viewport){
  const {widthCssPx,heightCssPx,cameraZ,nearClip,projectNearEdgeY,marginCssPx=12}=viewport;
  if(!Number.isFinite(configured)||configured<0||configured>20||![widthCssPx,heightCssPx,cameraZ,nearClip,marginCssPx].every(Number.isFinite)||widthCssPx<=0||heightCssPx<=0||nearClip<=0||marginCssPx<0||typeof projectNearEdgeY!=="function")throw new TypeError("Portrait visual track projection is invalid");
  if(widthCssPx>=heightCssPx)return configured;
  const maxForwardZ=Math.min(20,cameraZ-Math.max(.15,nearClip+.05));
  if(configured>=maxForwardZ)return configured;
  const goalY=heightCssPx+marginCssPx,initialY=projectNearEdgeY(configured);
  if(!Number.isFinite(initialY)||initialY>=goalY)return configured;
  const upperY=projectNearEdgeY(maxForwardZ);
  if(!Number.isFinite(upperY)||upperY<goalY)return configured;
  let low=configured,high=maxForwardZ;
  for(let iteration=0;iteration<18;iteration++){
    const mid=(low+high)/2,y=projectNearEdgeY(mid);
    if(!Number.isFinite(y))return configured;
    if(y<goalY)low=mid;else high=mid;
  }
  return Math.min(20,Math.max(configured,Math.ceil(high*1000)/1000));
}
