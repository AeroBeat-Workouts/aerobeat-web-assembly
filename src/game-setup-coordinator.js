// @ts-check

/** @typedef {Readonly<{showGameplayGrid:boolean}>} AeroGameSetupSnapshot */
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} GameSetupStorage */
/** @typedef {{key?:string|null,newValue?:string|null,storageArea?:unknown}} GameSetupStorageEvent */
/** @typedef {{addEventListener?:(type:string,listener:(event:GameSetupStorageEvent)=>void)=>void,removeEventListener?:(type:string,listener:(event:GameSetupStorageEvent)=>void)=>void}} GameSetupEventTarget */

export const aeroGameSetupStorageKey="aerobeat.game-setup.v1";
export const defaultAeroGameSetupSnapshot=Object.freeze({showGameplayGrid:true});

export class AeroGameSetupCoordinator{
  /** @param {{storageFactory?:()=>GameSetupStorage|null|undefined,eventTarget?:GameSetupEventTarget|null}} [options] */
  constructor(options={}){this.storageFactory=options.storageFactory??browserStorage;this.eventTarget=options.eventTarget===undefined?browserEventTarget():options.eventTarget;this.storage=this.acquireStorage();this.current=this.readStoredSnapshot();this.subscribers=new Set();this.storageListener=(event)=>this.handleStorageEvent(event);try{this.eventTarget?.addEventListener?.("storage",this.storageListener);}catch{/* optional synchronization */}}
  getSnapshot(){return freezeSnapshot(this.current.showGameplayGrid);}
  /** @param {unknown} value */
  setSnapshot(value){const normalized=normalizeGameSetup(value);if(!normalized)throw new TypeError("Game setup must be an exact plain-data record");return this.applySnapshot(normalized,true);}
  /** @param {(snapshot:AeroGameSetupSnapshot)=>void} callback @param {boolean} [emitCurrent] */
  subscribe(callback,emitCurrent=true){if(typeof callback!=="function")throw new TypeError("Game setup subscriber must be a function");this.subscribers.add(callback);if(emitCurrent)try{callback(this.getSnapshot());}catch{/* isolate subscriber */}let active=true;return()=>{if(!active)return;active=false;this.subscribers.delete(callback);};}
  destroy(){try{this.eventTarget?.removeEventListener?.("storage",this.storageListener);}catch{/* best effort */}this.subscribers.clear();}
  acquireStorage(){try{const storage=this.storageFactory();return storage&&typeof storage.getItem==="function"&&typeof storage.setItem==="function"?storage:null;}catch{return null;}}
  readStoredSnapshot(){if(!this.storage)return defaultAeroGameSetupSnapshot;try{const serialized=this.storage.getItem(aeroGameSetupStorageKey);return serialized===null?defaultAeroGameSetupSnapshot:normalizeSerializedSetup(serialized)??defaultAeroGameSetupSnapshot;}catch{return defaultAeroGameSetupSnapshot;}}
  /** @param {GameSetupStorageEvent} event */
  handleStorageEvent(event){if(!event||event.key!==aeroGameSetupStorageKey)return;if(event.storageArea!=null&&this.storage!=null&&event.storageArea!==this.storage)return;const normalized=event.newValue===null?defaultAeroGameSetupSnapshot:normalizeSerializedSetup(event.newValue);this.applySnapshot(normalized??defaultAeroGameSetupSnapshot,false);}
  /** @param {AeroGameSetupSnapshot} snapshot @param {boolean} persist */
  applySnapshot(snapshot,persist){if(this.current.showGameplayGrid===snapshot.showGameplayGrid)return this.getSnapshot();this.current=freezeSnapshot(snapshot.showGameplayGrid);if(persist&&this.storage)try{this.storage.setItem(aeroGameSetupStorageKey,JSON.stringify(this.current));}catch{/* in-memory setup remains authoritative */}for(const callback of [...this.subscribers])try{callback(this.getSnapshot());}catch{/* isolate subscriber */}return this.getSnapshot();}
}

/** @param {unknown} value @returns {AeroGameSetupSnapshot|null} */
export function normalizeGameSetup(value){if(value===null||typeof value!=="object"||Array.isArray(value))return null;const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)return null;const keys=Reflect.ownKeys(value);if(keys.length!==1||keys[0]!=="showGameplayGrid")return null;const descriptor=Object.getOwnPropertyDescriptor(value,"showGameplayGrid");if(!descriptor||!descriptor.enumerable||!("value" in descriptor)||typeof descriptor.value!=="boolean")return null;return freezeSnapshot(descriptor.value);}
function normalizeSerializedSetup(serialized){try{return normalizeGameSetup(JSON.parse(serialized));}catch{return null;}}
function freezeSnapshot(showGameplayGrid){return Object.freeze({showGameplayGrid});}
function browserStorage(){return typeof globalThis.localStorage==="undefined"?null:globalThis.localStorage;}
function browserEventTarget(){return typeof globalThis.addEventListener==="function"?globalThis:null;}

export const aeroGameSetupCoordinator=new AeroGameSetupCoordinator();
export const getGameSetupSnapshot=()=>aeroGameSetupCoordinator.getSnapshot();
/** @param {unknown} value */
export const setGameSetupSnapshot=(value)=>aeroGameSetupCoordinator.setSnapshot(value);
/** @param {(snapshot:AeroGameSetupSnapshot)=>void} callback @param {boolean} [emitCurrent] */
export const subscribeGameSetup=(callback,emitCurrent)=>aeroGameSetupCoordinator.subscribe(callback,emitCurrent);
