// @ts-check

import assert from "node:assert/strict";
import { AeroGameSetupCoordinator, aeroGameSetupStorageKey, defaultAeroGameSetupSnapshot, normalizeGameSetup } from "../src/game-setup-coordinator.js";

assert.deepEqual(defaultAeroGameSetupSnapshot,{showGameplayGrid:true});
assert.equal(Object.isFrozen(defaultAeroGameSetupSnapshot),true);
for(const invalid of[null,[],{},Object.create({showGameplayGrid:false}),new(class Setup{constructor(){this.showGameplayGrid=false;}})(),{showGameplayGrid:1},{showGameplayGrid:true,extra:true}])assert.equal(normalizeGameSetup(invalid),null);
const nullPrototype=Object.assign(Object.create(null),{showGameplayGrid:false}),normalized=normalizeGameSetup(nullPrototype);
assert.deepEqual(normalized,{showGameplayGrid:false});assert.equal(Object.getPrototypeOf(normalized),Object.prototype);assert.equal(Object.isFrozen(normalized),true);
let getterCalls=0;const hostile=Object.create(null,{showGameplayGrid:{enumerable:true,get(){getterCalls+=1;return false;}}});assert.equal(normalizeGameSetup(hostile),null);assert.equal(getterCalls,0);
const symbolRecord={showGameplayGrid:true};Object.defineProperty(symbolRecord,Symbol("extra"),{enumerable:true,value:true});assert.equal(normalizeGameSetup(symbolRecord),null);
const storage=createStorage(),events=createEventTarget(),coordinator=new AeroGameSetupCoordinator({storageFactory:()=>storage,eventTarget:events});
assert.deepEqual(coordinator.getSnapshot(),{showGameplayGrid:true});assert.equal(events.listenerCount(),1);
const notifications=[];const unsubscribe=coordinator.subscribe(snapshot=>notifications.push(snapshot.showGameplayGrid));
assert.deepEqual(notifications,[true]);assert.deepEqual(coordinator.setSnapshot({showGameplayGrid:false}),{showGameplayGrid:false});assert.deepEqual(notifications,[true,false]);assert.deepEqual(storage.setCalls,[[aeroGameSetupStorageKey,'{"showGameplayGrid":false}']]);
coordinator.setSnapshot({showGameplayGrid:false});assert.equal(storage.setCalls.length,1);assert.throws(()=>coordinator.setSnapshot(hostile),TypeError);assert.equal(getterCalls,0);
events.dispatch({key:aeroGameSetupStorageKey,newValue:'{"showGameplayGrid":true}',storageArea:storage});assert.deepEqual(coordinator.getSnapshot(),{showGameplayGrid:true});events.dispatch({key:aeroGameSetupStorageKey,newValue:'corrupt',storageArea:storage});assert.deepEqual(coordinator.getSnapshot(),{showGameplayGrid:true});
unsubscribe();coordinator.destroy();assert.equal(events.listenerCount(),0);
const restored=new AeroGameSetupCoordinator({storageFactory:()=>createStorage([[aeroGameSetupStorageKey,'{"showGameplayGrid":false}']]),eventTarget:null});assert.deepEqual(restored.getSnapshot(),{showGameplayGrid:false});restored.destroy();
for(const serialized of['{','null','[]','{"showGameplayGrid":1}','{"showGameplayGrid":true,"extra":1}']){const fallback=new AeroGameSetupCoordinator({storageFactory:()=>createStorage([[aeroGameSetupStorageKey,serialized]]),eventTarget:null});assert.deepEqual(fallback.getSnapshot(),{showGameplayGrid:true});fallback.destroy();}
const denied=new AeroGameSetupCoordinator({storageFactory:()=>{throw new Error("denied");},eventTarget:null});assert.deepEqual(denied.setSnapshot({showGameplayGrid:false}),{showGameplayGrid:false});denied.destroy();
console.log("Game setup coordinator validation passed.");

function createStorage(entries=[]){const values=new Map(entries),setCalls=[];return{values,setCalls,getItem(key){return values.get(key)??null;},setItem(key,value){setCalls.push([key,value]);values.set(key,value);}};}
function createEventTarget(){const listeners=new Set();return{addEventListener(type,listener){if(type==="storage")listeners.add(listener);},removeEventListener(type,listener){if(type==="storage")listeners.delete(listener);},dispatch(event){for(const listener of [...listeners])listener(event);},listenerCount(){return listeners.size;}};}
