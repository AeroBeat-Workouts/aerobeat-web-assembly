// @ts-check
import assert from 'node:assert/strict';
import { AeroGameSetupCoordinator, defaultAeroGameSetupSnapshot } from '../src/game-setup-coordinator.js';
import { gameplayFlowColliderSettings, gameplayBoxingColliderSettings } from '../src/gameplay-visual-runtime.js';
import { createSessionTargetIndex, projectSessionTargets } from '../src/session-render-projection.js';

const memory = new Map();
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
const setup = new AeroGameSetupCoordinator({storageFactory:()=>storage,eventTarget:null});
const customized = setup.setSnapshot({...defaultAeroGameSetupSnapshot,
  flowColliderVolume:{colliderVisible:true,colliderScale:1.5,colliderDepthForward:2,colliderDepthBackward:3},
  boxingColliderVolume:{colliderVisible:false,colliderScale:.75,colliderDepthForward:1,colliderDepthBackward:2}});
assert.equal(setup.getSnapshot().flowColliderVolume.colliderDepthForward,2);
const reloaded = new AeroGameSetupCoordinator({storageFactory:()=>storage,eventTarget:null});
assert.deepEqual(reloaded.getSnapshot().flowColliderVolume,customized.flowColliderVolume);
assert.deepEqual(reloaded.getSnapshot().boxingColliderVolume,customized.boxingColliderVolume);
assert.deepEqual(Object.fromEntries(['colliderScale','colliderDepthForward','colliderDepthBackward'].map(key=>[key,gameplayFlowColliderSettings(customized)[key]])),{colliderScale:1.5,colliderDepthForward:2,colliderDepthBackward:3});
assert.deepEqual(Object.fromEntries(['colliderScale','colliderDepthForward','colliderDepthBackward'].map(key=>[key,gameplayBoxingColliderSettings(customized)[key]])),{colliderScale:.75,colliderDepthForward:1,colliderDepthBackward:2});
for(const field of ['colliderScale','colliderDepthForward','colliderDepthBackward'])for(const value of [0,.00001,9999999]){
  const changed=setup.setSnapshot({...customized,flowColliderVolume:{...customized.flowColliderVolume,[field]:value}});
  assert.equal(gameplayFlowColliderSettings(changed)[field],value,`Flow ${field}=${value} reaches the actual gameplay settings without limits`);
  assert.deepEqual(Object.fromEntries(['colliderScale','colliderDepthForward','colliderDepthBackward'].map(key=>[key,gameplayBoxingColliderSettings(changed)[key]])),{colliderScale:.75,colliderDepthForward:1,colliderDepthBackward:2},'Flow edits never relax Boxing settings');
}
for(const field of ['colliderScale','colliderDepthForward','colliderDepthBackward'])for(const value of [0,.00001,.5,5,9999999]){
  const changed=setup.setSnapshot({...customized,boxingColliderVolume:{...customized.boxingColliderVolume,[field]:value}});
  assert.equal(gameplayBoxingColliderSettings(changed)[field],value,`Boxing ${field}=${value} reaches scored gameplay without arbitrary scale/depth bounds`);
  assert.equal(gameplayFlowColliderSettings(changed).colliderDepthForward,2,'Boxing scale/depth edits never alter Flow reach');
}
const events=[{eventId:'left',centerTimestampMs:1000,authoredBeat:{type:'note',hand:'left',placement:4}}];
const game={session:{purpose:'play'},judgements:[]};
const index=createSessionTargetIndex(events,{normalSpawnLeadMs:2500});
assert.equal(projectSessionTargets(events,game,1450,index,180,false,3)[0]?.id,'left','pending note remains visible inside tripled back depth');
assert.equal(projectSessionTargets(events,game,1541,index,180,false,3)[0]?.id,'left','scored Play stays pending past configured back face while the mesh is still in view');
assert.equal(projectSessionTargets(events,game,2000,index,180,false,3)[0]?.id,'left','scored Play remains pending through the full canonical note clearance deadline');
assert.equal(projectSessionTargets(events,game,2001,index,180,false,3).length,0,'scored Play note expires strictly after the full canonical clearance deadline');
setup.destroy();reloaded.destroy();
console.log('Per-mode collider volume persisted and projected through run settings and back-face visibility.');
