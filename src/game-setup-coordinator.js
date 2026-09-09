// @ts-check

export const aeroGameSetupSchema="aerobeat/game_setup";
export const aeroGameSetupVersion=2;
export const aeroGameSetupStorageKey="aerobeat.game-setup.v2";
export const legacyAeroGameSetupStorageKey="aerobeat.game-setup.v1";
export const gameSetupBounds=deepFreeze({normalSpawnDistanceWorldUnits:[3,72],noseCameraRangeXWorldUnits:[0,.9],noseCameraRangeYWorldUnits:[0,.6]});
/** @typedef {Readonly<{enabled:boolean,normalSpawnDistanceWorldUnits:number}>} SpawnDistanceOverride */
/** @typedef {Readonly<{schema:string,version:number,showGameplayGrid:boolean,arrivalGroupNumbersEnabled:boolean,attentionHaloEnabled:boolean,nextUpRibbonEnabled:boolean,noseCameraParallaxEnabled:boolean,spawnDistanceOverride:SpawnDistanceOverride,noseCameraRangeXWorldUnits:number,noseCameraRangeYWorldUnits:number}>} AeroGameSetupSnapshot */
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} GameSetupStorage */
/** @typedef {{key?:string|null,newValue?:string|null,storageArea?:unknown}} GameSetupStorageEvent */
/** @typedef {{addEventListener?:(type:string,listener:(event:GameSetupStorageEvent)=>void)=>void,removeEventListener?:(type:string,listener:(event:GameSetupStorageEvent)=>void)=>void}} GameSetupEventTarget */

export const defaultAeroGameSetupSnapshot=freezeSnapshot({schema:aeroGameSetupSchema,version:aeroGameSetupVersion,showGameplayGrid:true,arrivalGroupNumbersEnabled:false,attentionHaloEnabled:false,nextUpRibbonEnabled:false,noseCameraParallaxEnabled:false,spawnDistanceOverride:{enabled:false,normalSpawnDistanceWorldUnits:50},noseCameraRangeXWorldUnits:.55,noseCameraRangeYWorldUnits:.35});

export class AeroGameSetupCoordinator{
  /** @param {{storageFactory?:()=>GameSetupStorage|null|undefined,eventTarget?:GameSetupEventTarget|null}} [options] */
  constructor(options={}){this.storageFactory=options.storageFactory??browserStorage;this.eventTarget=options.eventTarget===undefined?browserEventTarget():options.eventTarget;this.storage=this.acquireStorage();this.current=this.readStoredSnapshot();this.subscribers=new Set();this.storageListener=(event)=>this.handleStorageEvent(event);try{this.eventTarget?.addEventListener?.("storage",this.storageListener);}catch{/* optional synchronization */}}
  getSnapshot(){return freezeSnapshot(this.current);}
  /** @param {unknown} value */
  setSnapshot(value){const normalized=normalizeGameSetup(value);if(!normalized)throw new TypeError("Game setup must be an exact v2 plain-data record");return this.applySnapshot(normalized,true);}
  /** @param {(snapshot:AeroGameSetupSnapshot)=>void} callback @param {boolean} [emitCurrent] */
  subscribe(callback,emitCurrent=true){if(typeof callback!=="function")throw new TypeError("Game setup subscriber must be a function");this.subscribers.add(callback);if(emitCurrent)try{callback(this.getSnapshot());}catch{/* isolate subscriber */}let active=true;return()=>{if(!active)return;active=false;this.subscribers.delete(callback);};}
  destroy(){try{this.eventTarget?.removeEventListener?.("storage",this.storageListener);}catch{/* best effort */}this.subscribers.clear();}
  acquireStorage(){try{const storage=this.storageFactory();return storage&&typeof storage.getItem==="function"&&typeof storage.setItem==="function"?storage:null;}catch{return null;}}
  readStoredSnapshot(){if(!this.storage)return defaultAeroGameSetupSnapshot;try{const serialized=this.storage.getItem(aeroGameSetupStorageKey);if(serialized!==null){const normalized=normalizeSerializedSetup(serialized);if(normalized)return normalized;this.persistReset(defaultAeroGameSetupSnapshot);return defaultAeroGameSetupSnapshot;}const legacy=this.storage.getItem(legacyAeroGameSetupStorageKey);if(legacy===null)return defaultAeroGameSetupSnapshot;const migrated=migrateLegacyGameSetup(legacy);const next=migrated??defaultAeroGameSetupSnapshot;this.persistReset(next);return next;}catch{return defaultAeroGameSetupSnapshot;}}
  /** @param {AeroGameSetupSnapshot} snapshot */
  persistReset(snapshot){if(this.storage)try{this.storage.setItem(aeroGameSetupStorageKey,JSON.stringify(snapshot));}catch{/* in-memory setup remains authoritative */}}
  /** @param {GameSetupStorageEvent} event */
  handleStorageEvent(event){if(!event||event.key!==aeroGameSetupStorageKey)return;if(event.storageArea!=null&&this.storage!=null&&event.storageArea!==this.storage)return;const normalized=event.newValue===null?defaultAeroGameSetupSnapshot:normalizeSerializedSetup(event.newValue);this.applySnapshot(normalized??defaultAeroGameSetupSnapshot,false);}
  /** @param {AeroGameSetupSnapshot} snapshot @param {boolean} persist */
  applySnapshot(snapshot,persist){const next=freezeSnapshot(snapshot);if(equalSetup(this.current,next))return this.getSnapshot();this.current=next;if(persist)this.persistReset(next);for(const callback of [...this.subscribers])try{callback(this.getSnapshot());}catch{/* isolate subscriber */}return this.getSnapshot();}
}

/** @param {unknown} value @returns {AeroGameSetupSnapshot|null} */
export function normalizeGameSetup(value){try{if(!exactDataRecord(value,["schema","version","showGameplayGrid","arrivalGroupNumbersEnabled","attentionHaloEnabled","nextUpRibbonEnabled","noseCameraParallaxEnabled","spawnDistanceOverride","noseCameraRangeXWorldUnits","noseCameraRangeYWorldUnits"]))return null;const data=(key)=>Object.getOwnPropertyDescriptor(value,key)?.value;if(data("schema")!==aeroGameSetupSchema||data("version")!==aeroGameSetupVersion)return null;for(const key of["showGameplayGrid","arrivalGroupNumbersEnabled","attentionHaloEnabled","nextUpRibbonEnabled","noseCameraParallaxEnabled"])if(typeof data(key)!=="boolean")return null;const override=data("spawnDistanceOverride");if(!exactDataRecord(override,["enabled","normalSpawnDistanceWorldUnits"]))return null;const overrideData=(key)=>Object.getOwnPropertyDescriptor(override,key)?.value;if(typeof overrideData("enabled")!=="boolean"||!boundedNumber(overrideData("normalSpawnDistanceWorldUnits"),gameSetupBounds.normalSpawnDistanceWorldUnits))return null;if(!boundedNumber(data("noseCameraRangeXWorldUnits"),gameSetupBounds.noseCameraRangeXWorldUnits)||!boundedNumber(data("noseCameraRangeYWorldUnits"),gameSetupBounds.noseCameraRangeYWorldUnits))return null;return freezeSnapshot({schema:aeroGameSetupSchema,version:aeroGameSetupVersion,showGameplayGrid:data("showGameplayGrid"),arrivalGroupNumbersEnabled:data("arrivalGroupNumbersEnabled"),attentionHaloEnabled:data("attentionHaloEnabled"),nextUpRibbonEnabled:data("nextUpRibbonEnabled"),noseCameraParallaxEnabled:data("noseCameraParallaxEnabled"),spawnDistanceOverride:{enabled:overrideData("enabled"),normalSpawnDistanceWorldUnits:overrideData("normalSpawnDistanceWorldUnits")},noseCameraRangeXWorldUnits:data("noseCameraRangeXWorldUnits"),noseCameraRangeYWorldUnits:data("noseCameraRangeYWorldUnits")});}catch{return null;}}
/** @param {string} serialized @returns {AeroGameSetupSnapshot|null} */
function migrateLegacyGameSetup(serialized){try{const value=JSON.parse(serialized);if(!exactDataRecord(value,["showGameplayGrid"]))return null;const show=Object.getOwnPropertyDescriptor(value,"showGameplayGrid")?.value;if(typeof show!=="boolean")return null;return freezeSnapshot({...defaultAeroGameSetupSnapshot,showGameplayGrid:show});}catch{return null;}}
function normalizeSerializedSetup(serialized){try{return normalizeGameSetup(JSON.parse(serialized));}catch{return null;}}
/** @param {unknown} value @param {readonly string[]} keys */
function exactDataRecord(value,keys){if(value===null||typeof value!=="object"||Array.isArray(value)){return false;}const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)return false;const ownKeys=Reflect.ownKeys(value);if(ownKeys.length!==keys.length||ownKeys.some((key)=>typeof key!=="string"||!keys.includes(key)))return false;return keys.every((key)=>{const descriptor=Object.getOwnPropertyDescriptor(value,key);return Boolean(descriptor&&descriptor.enumerable&&"value" in descriptor);});}
/** @param {unknown} value @param {readonly number[]} bounds */
function boundedNumber(value,bounds){return typeof value==="number"&&Number.isFinite(value)&&value>=Number(bounds[0])&&value<=Number(bounds[1]);}
/** @param {AeroGameSetupSnapshot|Record<string,unknown>} value @returns {AeroGameSetupSnapshot} */
function freezeSnapshot(value){const override=/** @type {Record<string,unknown>} */(value.spawnDistanceOverride);return Object.freeze({schema:String(value.schema),version:Number(value.version),showGameplayGrid:Boolean(value.showGameplayGrid),arrivalGroupNumbersEnabled:Boolean(value.arrivalGroupNumbersEnabled),attentionHaloEnabled:Boolean(value.attentionHaloEnabled),nextUpRibbonEnabled:Boolean(value.nextUpRibbonEnabled),noseCameraParallaxEnabled:Boolean(value.noseCameraParallaxEnabled),spawnDistanceOverride:Object.freeze({enabled:Boolean(override.enabled),normalSpawnDistanceWorldUnits:Number(override.normalSpawnDistanceWorldUnits)}),noseCameraRangeXWorldUnits:Number(value.noseCameraRangeXWorldUnits),noseCameraRangeYWorldUnits:Number(value.noseCameraRangeYWorldUnits)});}
/** @param {AeroGameSetupSnapshot} left @param {AeroGameSetupSnapshot} right */
function equalSetup(left,right){return JSON.stringify(left)===JSON.stringify(right);}
function deepFreeze(value){if(value&&typeof value==="object")for(const child of Object.values(value))deepFreeze(child);return Object.freeze(value);}
function browserStorage(){return typeof globalThis.localStorage==="undefined"?null:globalThis.localStorage;}
function browserEventTarget(){return typeof globalThis.addEventListener==="function"?globalThis:null;}

export const aeroGameSetupCoordinator=new AeroGameSetupCoordinator();
export const getGameSetupSnapshot=()=>aeroGameSetupCoordinator.getSnapshot();
/** @param {unknown} value */
export const setGameSetupSnapshot=(value)=>aeroGameSetupCoordinator.setSnapshot(value);
/** @param {(snapshot:AeroGameSetupSnapshot)=>void} callback @param {boolean} [emitCurrent] */
export const subscribeGameSetup=(callback,emitCurrent)=>aeroGameSetupCoordinator.subscribe(callback,emitCurrent);
