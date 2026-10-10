// @ts-check
// Synthetic wiring fixture, never a physical calibration or actual-Play proof.
import { createAeroPlayCanvasRenderer } from "@aerobeat/web-renderer";
import { createPhoneTrackingVisuals } from "../../src/phone-performance-visual-input.js";
import { createPhonePerformanceWorkload } from "../../src/phone-performance-workload.js";

const renderer=createAeroPlayCanvasRenderer({contextAttributes:{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true}});
const shadowCamera={schema:"aerobeat/gameplay_camera_pose",version:1,coordinateSystem:{space:"playcanvas_world",handedness:"right_handed",worldUp:"+Y",cameraForward:"local_-Z",timelineFuture:"world_-Z"},position:{x:.05,y:1,z:5},rotationEulerDegrees:{xPitch:-15,yYaw:30,zRoll:0},projection:{verticalFovDegrees:48,nearClip:.1,farClip:80}};
renderer.attach(document.querySelector("#game"));
renderer.resize({widthCssPx:640,heightCssPx:480,devicePixelRatio:1,renderScale:1});
renderer.setBackgroundProjection({kind:"solid",colors:["#071426"],angleDeg:0});
const workload=createPhonePerformanceWorkload();
const visuals=await createPhoneTrackingVisuals();
const names=["nose","left_shoulder","right_shoulder","left_elbow","right_elbow","left_wrist","right_wrist"];
const tPose={nose:[.5,.3],left_shoulder:[.6,.4],right_shoulder:[.4,.4],left_elbow:[.7,.4],right_elbow:[.3,.4],left_wrist:[.8,.4],right_wrist:[.2,.4]};
const released={...tPose,left_elbow:[.61,.52],right_elbow:[.39,.52],left_wrist:[.56,.55],right_wrist:[.44,.55]};
const context={sourceAspectRatio:16/9,sourceChangeId:"synthetic-epoch-a"};
let now=0, suppress=false, lastResult=null;
function pose(at,points=tPose){return {sourceId:"synthetic-camera",timestampMs:at,mirrored:true,landmarks:names.map(name=>({name,x:points[name][0],y:points[name][1],confidence:.95}))};}
function render(){
  const visual=visuals.frame(now);
  const scene=workload.frame(850);
  const options={grid:{x:0,y:0,width:1,height:1},minConfidence:.5,sizeCssPx:32,noseMarkerVisible:true,noseMarkerScale:.25};
  const result=renderer.renderGameplayFrameWithCursorsAndEquipment(scene,suppress?[]:visual.cursors,options,suppress?[]:visual.equipment,{grid:{x:0,y:0,width:1,height:1}});
  const light=renderer.shadowLightEntity?.light;
  lastResult={state:result.status.state,equipmentCount:result.equipmentCount,cursorCount:result.cursorCount,targets:scene.targets.length,calibrationReady:visual.calibrationReady,trackingReady:visual.trackingReady,shadow:{light:Boolean(light),casting:light?.castShadows??false,resolution:light?.shadowResolution??null,type:light?.shadowType??null,receiver:Boolean(renderer.shadowReceiverLayer)}};
  return lastResult;
}
window.__phoneVisualFixture={
  ready:()=>renderer.describe().gameplayAssets.state,
  render,
  hold(){for(let at=0;at<=2250;at+=250)visuals.processPose(pose(at),context);now=2250;return render();},
  release(){now=2500;visuals.processPose(pose(now,released),context);return render();},
  invalidate(){now=2700;visuals.processPose(pose(now,released),{...context,sourceChangeId:"synthetic-epoch-b"});return render();},
  suppressDelivery(value){suppress=Boolean(value);return render();},
  shadowProbe(enabled){renderer.setGameplayCameraPose("flow",shadowCamera);renderer.shadowLightEntity.light.castShadows=enabled;return render();},
  state:()=>lastResult,
  snapshot:()=>visuals.snapshot(),
  destroy(){visuals.destroy();renderer.destroy();return visuals.frame(now);}
};
render();
