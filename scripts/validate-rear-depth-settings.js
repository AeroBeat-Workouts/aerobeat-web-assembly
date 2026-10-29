// @ts-check
import assert from 'node:assert/strict';
import {AeroGameSetupCoordinator,defaultAeroGameSetupSnapshot,normalizeGameSetup} from '../src/game-setup-coordinator.js';
import {gameplayFlowColliderSettings,gameplayBoxingColliderSettings} from '../src/gameplay-visual-runtime.js';
import {flowColliderSettingsIdentity,boxingColliderSettingsIdentity} from '@aerobeat/web-gameplay';
const field='colliderDepthBackwardAthleteFacing';
const defaults=defaultAeroGameSetupSnapshot;
assert.equal(defaults.flowColliderVolume[field],false);
assert.equal(defaults.boxingColliderVolume[field],true);
assert.equal(Object.hasOwn(defaults.kneeColliderVolume,field),false,'no unsolicited knee setting');
const legacy=structuredClone(defaults);
delete legacy.flowColliderVolume[field];delete legacy.boxingColliderVolume[field];
legacy.flowColliderVolume.colliderDepthBackward=2.2;legacy.boxingColliderVolume.colliderDepthBackward=1.25;
const migrated=normalizeGameSetup(legacy);
assert(migrated);assert.equal(migrated.flowColliderVolume[field],false);assert.equal(migrated.boxingColliderVolume[field],true);
assert.equal(migrated.flowColliderVolume.colliderDepthBackward,2.2);assert.equal(migrated.boxingColliderVolume.colliderDepthBackward,1.25);
for(const key of ['flowColliderVolume','boxingColliderVolume']){
 for(const bad of [undefined,null,0,1,'true',[],{}])assert.equal(normalizeGameSetup({...defaults,[key]:{...defaults[key],[field]:bad}}),null,`${key}: strict boolean required`);
 let reads=0;const accessor={...defaults[key]};Object.defineProperty(accessor,field,{enumerable:true,get(){reads++;return true;}});
 assert.equal(normalizeGameSetup({...defaults,[key]:accessor}),null);assert.equal(reads,0,'invalid accessor is not executed');
}
assert.equal(normalizeGameSetup({...defaults,kneeColliderVolume:{...defaults.kneeColliderVolume,[field]:true}}),null);
const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
const first=new AeroGameSetupCoordinator({storageFactory:()=>storage,eventTarget:null});
const selected=first.setSnapshot({...defaults,flowColliderVolume:{...defaults.flowColliderVolume,[field]:true},boxingColliderVolume:{...defaults.boxingColliderVolume,[field]:false}});
assert.equal(selected.flowColliderVolume.colliderVisible,false);assert.equal(selected.boxingColliderVolume.colliderVisible,false,'direction is independent of Show volume');
const second=new AeroGameSetupCoordinator({storageFactory:()=>storage,eventTarget:null});
assert.equal(second.getSnapshot().flowColliderVolume[field],true);assert.equal(second.getSnapshot().boxingColliderVolume[field],false);
assert.equal(gameplayFlowColliderSettings(selected)[field],true);assert.equal(gameplayBoxingColliderSettings(selected)[field],false,'requested settings reach the run-locked scorer');
assert.notEqual(flowColliderSettingsIdentity(gameplayFlowColliderSettings(selected)),flowColliderSettingsIdentity(gameplayFlowColliderSettings(defaults)));
assert.notEqual(boxingColliderSettingsIdentity(gameplayBoxingColliderSettings(selected)),boxingColliderSettingsIdentity(gameplayBoxingColliderSettings(defaults)));
first.destroy();second.destroy();
console.log('Rear-depth per-mode defaults, legacy storage normalization, strict boolean, persistence and scorer identity passed');
