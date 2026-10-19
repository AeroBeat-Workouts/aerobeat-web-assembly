// @ts-check

import { createFlowColliderSettings, defaultFlowColliderSettings, flowColliderSettingsBounds } from "@aerobeat/web-gameplay";
import { aeroGameSetupHazardVignetteFields, aeroGameSetupIdentity, aeroGuardCountModes, aeroHazardVignetteBounds, aeroRowReachBounds, aeroVisualScaleBounds, defaultGuardCountMode, isVisualScaleSetup, normalizeBoxingColliderSetupFields, normalizeGameSetupHazardVignetteFields, normalizeGameSetupVisibilityFields } from "@aerobeat/web-contracts/gameplay-contracts";
import { gameplayGuidanceBandModes } from "@aerobeat/web-renderer";

export const aeroGameSetupSchema=aeroGameSetupIdentity.schema;
export const aeroGameSetupVersion=aeroGameSetupIdentity.version;
export const aeroGameSetupStorageKey=aeroGameSetupIdentity.key;
export const legacyAeroGameSetupV2StorageKey="aerobeat.game-setup.v2";
export const legacyAeroGameSetupStorageKey="aerobeat.game-setup.v1";
// Both collider modes accept finite nonnegative scale and depth values.
// Flow's rear starts at the hilt; forward 1 reaches the visible blade tip.
// Boxer Scale 1 and forward 1 fit the scored rotated glove cylinder, while
// rear 0 begins at its back face. All three remain finite nonnegative unbounded.
export const defaultFlowColliderVolume=Object.freeze({colliderVisible:false,colliderScale:1,colliderDepthForward:1,colliderDepthBackward:0});
export const defaultBoxingColliderVolume=Object.freeze({colliderVisible:false,colliderScale:1,colliderDepthForward:1,colliderDepthBackward:0});
export const defaultModeColliderVolume=defaultFlowColliderVolume;
export const gameSetupBounds=deepFreeze({normalSpawnDistanceWorldUnits:[3,72],noseCameraRangeXWorldUnits:[0,1.1],noseCameraRangeYWorldUnits:[0,1.2],colliderRadius:[flowColliderSettingsBounds.colliderRadius.minimum,flowColliderSettingsBounds.colliderRadius.maximum],directionToleranceDegrees:[flowColliderSettingsBounds.directionToleranceDegrees.minimum,flowColliderSettingsBounds.directionToleranceDegrees.maximum],timingWindowMs:[flowColliderSettingsBounds.timingWindowMs.minimum,flowColliderSettingsBounds.timingWindowMs.maximum],topRowReachWU:[...aeroRowReachBounds[0].slice(1,3)],bottomRowReachWU:[...aeroRowReachBounds[1].slice(1,3)],noteScalePercent:[10,200],obstacleScalePercent:[10,200],bombScalePercent:[10,200],markerScalePercent:[10,200],guardSpacing:[0,2],noseMarkerScale:[0,2],trackExtensionWorldUnits:[0,20],wristBombColliderScale:[0,2],renderScale:[.25,1]});
// z2tx: the new Game Setup v3 boxing-collider fields and their run-gated defaults.
const defaultBoxingColliderFields=Object.freeze({topRowReachWU:aeroRowReachBounds[0][3],bottomRowReachWU:aeroRowReachBounds[1][3],guardCountMode:defaultGuardCountMode});
const defaultVisualScales=Object.freeze({noteScalePercent:100,obstacleScalePercent:100,bombScalePercent:100,markerScalePercent:100});
// 0.0.54 W0: five hazard-vignette tuning fields (defaults from the contracts bounds table).
const defaultHazardVignetteFields=Object.freeze(Object.fromEntries(aeroHazardVignetteBounds.map(([key,,,defaultValue])=>[key,defaultValue])));
/** @typedef {Readonly<{enabled:boolean,normalSpawnDistanceWorldUnits:number}>} SpawnDistanceOverride */
/** @typedef {"off"|"song_beat_grid"|"target_arrivals"} GuidanceBandMode */
/** @typedef {Readonly<{schema:string,version:number,showGameplayGrid:boolean,obstaclesEnabled:boolean,guidanceBandMode:GuidanceBandMode,noseCameraParallaxEnabled:boolean,spawnDistanceOverride:SpawnDistanceOverride,noseCameraRangeXWorldUnits:number,noseCameraRangeYWorldUnits:number,colliderRadius:number,enforceAuthoredDirection:boolean,directionToleranceDegrees:number,timingWindowMs:number,topRowReachWU:number,bottomRowReachWU:number,guardCountMode:"collision"|"gesture",guardSpacing:number,noseMarkerVisible:boolean,noseMarkerScale:number,trackExtensionWorldUnits:number,uppercutOppositeLane:boolean,anyOppositeLane:boolean,noteScalePercent:number,obstacleScalePercent:number,bombScalePercent:number,markerScalePercent:number,flowColliderVolume:Readonly<{colliderVisible:boolean,colliderScale:number,colliderDepthForward:number,colliderDepthBackward:number}>,boxingColliderVolume:Readonly<{colliderVisible:boolean,colliderScale:number,colliderDepthForward:number,colliderDepthBackward:number}>,visibleToleranceRange:boolean,visibleColliderRadius:boolean,visibleWristObstacleRadius:boolean,wristBombColliderScale:number,renderScale:number,hazardVignetteIntensity:number,hazardVignettePulseHz:number,hazardVignettePulseDepth:number,hazardVignetteRampMs:number,hazardVignetteDecayMs:number}>} AeroGameSetupSnapshot */
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} GameSetupStorage */
/** @typedef {{key?:string|null,newValue?:string|null,storageArea?:unknown}} GameSetupStorageEvent */
/** @typedef {{addEventListener?:(type:string,listener:(event:GameSetupStorageEvent)=>void)=>void,removeEventListener?:(type:string,listener:(event:GameSetupStorageEvent)=>void)=>void}} GameSetupEventTarget */

// Strict v2/v3 inputs remain bounded (X now also accepts the canonical 1.1);
// every accepted setup is canonicalized to fixed eligible-Play travel.
export const fixedNoseCameraRangeWorldUnits=1.1;
export const defaultAeroGameSetupSnapshot=freezeSnapshot({schema:aeroGameSetupSchema,version:aeroGameSetupVersion,showGameplayGrid:false,obstaclesEnabled:true,guidanceBandMode:"off",noseCameraParallaxEnabled:true,spawnDistanceOverride:{enabled:false,normalSpawnDistanceWorldUnits:20},noseCameraRangeXWorldUnits:fixedNoseCameraRangeWorldUnits,noseCameraRangeYWorldUnits:fixedNoseCameraRangeWorldUnits,colliderRadius:defaultFlowColliderSettings.colliderRadius,enforceAuthoredDirection:defaultFlowColliderSettings.enforceAuthoredDirection,directionToleranceDegrees:defaultFlowColliderSettings.directionToleranceDegrees,timingWindowMs:defaultFlowColliderSettings.timingWindowMs,...defaultBoxingColliderFields,guardSpacing:0.25,noseMarkerVisible:true,noseMarkerScale:.25,trackExtensionWorldUnits:2,uppercutOppositeLane:false,anyOppositeLane:false,...defaultVisualScales,flowColliderVolume:defaultFlowColliderVolume,boxingColliderVolume:defaultBoxingColliderVolume,visibleToleranceRange:false,visibleColliderRadius:false,visibleWristObstacleRadius:false,wristBombColliderScale:1,renderScale:1,...defaultHazardVignetteFields});

export class AeroGameSetupCoordinator{
  /** @param {{storageFactory?:()=>GameSetupStorage|null|undefined,eventTarget?:GameSetupEventTarget|null}} [options] */
  constructor(options={}){this.storageFactory=options.storageFactory??browserStorage;this.eventTarget=options.eventTarget===undefined?browserEventTarget():options.eventTarget;this.storage=this.acquireStorage();this.current=this.readStoredSnapshot();this.subscribers=new Set();this.storageListener=(event)=>this.handleStorageEvent(event);try{this.eventTarget?.addEventListener?.("storage",this.storageListener);}catch{/* optional synchronization */}}
  getSnapshot(){return freezeSnapshot(this.current);}
  /** @param {unknown} value */
  setSnapshot(value){const normalized=normalizeGameSetup(value);if(!normalized)throw new TypeError("Game setup must be an exact v3 plain-data record");if(normalized.flowColliderVolume.colliderDepthBackward===3)try{this.storage?.setItem(flowRearDefaultMigrationKey,"1");}catch{/* best effort */}const unchanged=equalSetup(this.current,normalized);const result=this.applySnapshot(normalized,true);if(unchanged&&!fixedNoseCameraFields(value))this.persistReset(normalized);try{this.storage?.setItem(modeColliderDefaultsMigrationKey,"1");}catch{/* best effort */}return result;}
  /** @param {(snapshot:AeroGameSetupSnapshot)=>void} callback @param {boolean} [emitCurrent] */
  subscribe(callback,emitCurrent=true){if(typeof callback!=="function")throw new TypeError("Game setup subscriber must be a function");this.subscribers.add(callback);if(emitCurrent)try{callback(this.getSnapshot());}catch{/* isolate subscriber */}let active=true;return()=>{if(!active)return;active=false;this.subscribers.delete(callback);};}
  destroy(){try{this.eventTarget?.removeEventListener?.("storage",this.storageListener);}catch{/* best effort */}this.subscribers.clear();}
  acquireStorage(){try{const storage=this.storageFactory();return storage&&typeof storage.getItem==="function"&&typeof storage.setItem==="function"?storage:null;}catch{return null;}}
  readStoredSnapshot(){if(!this.storage)return defaultAeroGameSetupSnapshot;try{const serialized=this.storage.getItem(aeroGameSetupStorageKey);if(serialized!==null){const normalized=normalizeSerializedSetup(serialized);if(normalized){const migrated=migrateModeColliderDefaults(this,migrateFlowRearDefault(this,migrateGuardSpacingDefault(this,normalized)));if(!storedSetupIsCanonical(serialized,migrated))this.persistReset(migrated);return migrated;}this.persistReset(defaultAeroGameSetupSnapshot);return defaultAeroGameSetupSnapshot;}const v2=this.storage.getItem(legacyAeroGameSetupV2StorageKey);if(v2!==null){const migrated=migrateV2GameSetup(v2)??defaultAeroGameSetupSnapshot;this.persistReset(migrated);return migrated;}const v1=this.storage.getItem(legacyAeroGameSetupStorageKey);if(v1===null)return defaultAeroGameSetupSnapshot;const migrated=migrateV1GameSetup(v1)??defaultAeroGameSetupSnapshot;this.persistReset(migrated);return migrated;}catch{return defaultAeroGameSetupSnapshot;}}
  /** @param {AeroGameSetupSnapshot} snapshot */
  persistReset(snapshot){if(this.storage)try{this.storage.setItem(aeroGameSetupStorageKey,JSON.stringify(snapshot));}catch{/* in-memory setup remains authoritative */}}
  /** @param {GameSetupStorageEvent} event */
  handleStorageEvent(event){try{const envelope=storageEventEnvelope(event);if(!envelope||envelope.key!==aeroGameSetupStorageKey)return;if(envelope.storageArea!=null&&this.storage!=null&&envelope.storageArea!==this.storage)return;const normalized=envelope.newValue===null?defaultAeroGameSetupSnapshot:typeof envelope.newValue==="string"?normalizeSerializedSetup(envelope.newValue):null;if(!normalized)return;if(envelope.newValue!==null&&this.storage){const stored=this.storage.getItem(aeroGameSetupStorageKey);if(stored!==null&&stored!==envelope.newValue)return;}this.applySnapshot(normalized,false);if(envelope.newValue!==null&&this.storage&&!storedSetupIsCanonical(envelope.newValue,normalized)&&this.storage.getItem(aeroGameSetupStorageKey)===envelope.newValue)this.persistReset(normalized);}catch{/* hostile or malformed storage event is ignored */}}
  /** @param {AeroGameSetupSnapshot} snapshot @param {boolean} persist */
  applySnapshot(snapshot,persist){const next=freezeSnapshot(snapshot);if(equalSetup(this.current,next))return this.getSnapshot();this.current=next;if(persist)this.persistReset(next);for(const callback of [...this.subscribers])try{callback(this.getSnapshot());}catch{/* isolate subscriber */}return this.getSnapshot();}
}

const v3Keys=Object.freeze(["schema","version","showGameplayGrid","guidanceBandMode","noseCameraParallaxEnabled","spawnDistanceOverride","noseCameraRangeXWorldUnits","noseCameraRangeYWorldUnits","colliderRadius","enforceAuthoredDirection","directionToleranceDegrees","timingWindowMs"]);

const v3StoredKeys=Object.freeze([...v3Keys,"topRowReachWU","bottomRowReachWU","guardCountMode","noteScalePercent","obstacleScalePercent","bombScalePercent","markerScalePercent"]);
// 0.0.54: current persisted records carry the two debug visibility toggles and
// the five hazard-vignette tuning fields on top of the scale/reach fields.
const currentV3StoredKeys=Object.freeze([...v3StoredKeys,"visibleToleranceRange","visibleColliderRadius",...aeroGameSetupHazardVignetteFields]);
const colliderVolumeStoredKeys=Object.freeze([...currentV3StoredKeys,"flowColliderVolume","boxingColliderVolume"]);
const converterSettingsStoredKeys=Object.freeze([...colliderVolumeStoredKeys,"guardSpacing","uppercutOppositeLane","anyOppositeLane"]);
const markerAndTrackStoredKeys=Object.freeze([...converterSettingsStoredKeys,"noseMarkerVisible","noseMarkerScale","trackExtensionWorldUnits"]);
const wristColliderStoredKeys=Object.freeze([...markerAndTrackStoredKeys,"visibleWristObstacleRadius","wristBombColliderScale"]);
const obstaclesEnabledStoredKeys=Object.freeze([...wristColliderStoredKeys,"obstaclesEnabled"]);
// 0.0.90 (htsg): current persisted records carry the render-quality scale on top of the obstacles field.
const renderScaleStoredKeys=Object.freeze([...obstaclesEnabledStoredKeys,"renderScale"]);
// 0.0.90 (htsg): four removed game-setup fields stay readable on persisted
// v3 records; the forward-compat read tolerates and drops them.
const legacyRemovedSaberStoredKeys=Object.freeze([...obstaclesEnabledStoredKeys,"magn" + "eticAttractionRange","magn" + "eticAttractionMinStrength","magn" + "eticAttractionMaxStrength","magn" + "eticAttractionBackFaceBias"]);
// Existing v3 records migrate these authoring preferences in place; old charts
// remain immutable and take new converter options only when re-downloaded.
const modeColliderVolumeKeys=Object.freeze(["colliderVisible","colliderScale","colliderDepthForward","colliderDepthBackward"]);
function normalizeModeColliderVolume(value){if(!exactDataRecord(value,modeColliderVolumeKeys))return null;const field=(key)=>Object.getOwnPropertyDescriptor(value,key)?.value;if(typeof field("colliderVisible")!=="boolean")return null;for(const key of modeColliderVolumeKeys.slice(1)){const candidate=field(key);if(typeof candidate!=="number"||!Number.isFinite(candidate)||candidate<0)return null;}return Object.freeze({colliderVisible:field("colliderVisible"),colliderScale:field("colliderScale"),colliderDepthForward:field("colliderDepthForward"),colliderDepthBackward:field("colliderDepthBackward")});}
// W3-D: 0.0.51-0.0.53 persisted records carry the two debug visibility toggles
// on top of the scale/reach fields (no hazard-vignette fields).
const previousV3StoredKeys=Object.freeze([...v3StoredKeys,"visibleToleranceRange","visibleColliderRadius"]);
// W3-B: stored v3 records from 0.0.51/0.0.52 carry the same field set as
// previousV3StoredKeys but with the removed videoFit key in place of the two
// visibility toggles (21 keys total). The forward-compat read below tolerates
// the videoFit key and drops it — the W0 contracts document that such records
// read with the key dropped, never rejected.
const legacyVideoFitStoredKeys=Object.freeze([...v3StoredKeys,"videoFit"]);
// z2tx: stored v3 records persisted before the boxing-collider fields landed carry
// exactly these 16 keys (scales, no reach/guard-count, no videoFit); their read
// normalizes the three fields to defaults via normalizeBoxingColliderSetupFields.
const legacyV3StoredKeys=Object.freeze([...v3Keys,"noteScalePercent","obstacleScalePercent","bombScalePercent","markerScalePercent"]);
// W3-B: the 0.0.51/0.0.52 stored records carried a videoFit record that no
// longer exists; reads of such records drop the key (never rejected). The
// visibility toggles below are forward-compat from the W0 contracts.
const v2Keys=Object.freeze(["schema","version","showGameplayGrid","arrivalGroupNumbersEnabled","attentionHaloEnabled","nextUpRibbonEnabled","noseCameraParallaxEnabled","spawnDistanceOverride","noseCameraRangeXWorldUnits","noseCameraRangeYWorldUnits"]);
/** @param {unknown} value @returns {AeroVisualScaleSetup|null} Forward-compatible read: stored records missing the scale fields normalize to 100. */
function normalizeStoredVisualScales(value){if(value===null||typeof value!=="object"||Array.isArray(value))return null;const record=/** @type {Record<string,unknown>} */(value);for(const [key,min,max] of aeroVisualScaleBounds){const raw=record[key];if(raw===undefined)continue;if(!Number.isInteger(raw)||raw<min||raw>max)return null;}const normalized={};for(const [key,,] of aeroVisualScaleBounds)normalized[key]=record[key]===undefined?100:Number(record[key]);if(!isVisualScaleSetup(normalized))return null;return Object.freeze(normalized);}
/** @param {unknown} value @returns {AeroGameSetupSnapshot|null} */
export function normalizeGameSetup(value){try{if(!(exactDataRecord(value,v3Keys)||exactDataRecord(value,legacyV3StoredKeys)||exactDataRecord(value,v3StoredKeys)||exactDataRecord(value,previousV3StoredKeys)||exactDataRecord(value,currentV3StoredKeys)||exactDataRecord(value,colliderVolumeStoredKeys)||exactDataRecord(value,renderScaleStoredKeys)||exactDataRecord(value,converterSettingsStoredKeys)||exactDataRecord(value,markerAndTrackStoredKeys)||exactDataRecord(value,wristColliderStoredKeys)||exactDataRecord(value,obstaclesEnabledStoredKeys)||exactDataRecord(value,legacyRemovedSaberStoredKeys)||exactDataRecord(value,legacyVideoFitStoredKeys)))return null;const data=(key)=>Object.getOwnPropertyDescriptor(value,key)?.value;if(data("schema")!==aeroGameSetupSchema||data("version")!==aeroGameSetupVersion||typeof data("showGameplayGrid")!=="boolean"||(data("obstaclesEnabled")!==undefined&&typeof data("obstaclesEnabled")!=="boolean")||!gameplayGuidanceBandModes.includes(data("guidanceBandMode"))||typeof data("noseCameraParallaxEnabled")!=="boolean"||typeof data("enforceAuthoredDirection")!=="boolean")return null;const override=data("spawnDistanceOverride");if(!exactDataRecord(override,["enabled","normalSpawnDistanceWorldUnits"]))return null;const overrideData=(key)=>Object.getOwnPropertyDescriptor(override,key)?.value;if(typeof overrideData("enabled")!=="boolean"||!boundedNumber(overrideData("normalSpawnDistanceWorldUnits"),gameSetupBounds.normalSpawnDistanceWorldUnits))return null;if(!boundedNumber(data("noseCameraRangeXWorldUnits"),gameSetupBounds.noseCameraRangeXWorldUnits)||!boundedNumber(data("noseCameraRangeYWorldUnits"),gameSetupBounds.noseCameraRangeYWorldUnits)||!boundedNumber(data("colliderRadius"),gameSetupBounds.colliderRadius)||!boundedNumber(data("directionToleranceDegrees"),gameSetupBounds.directionToleranceDegrees)||!boundedNumber(data("timingWindowMs"),gameSetupBounds.timingWindowMs))return null;if((data("noseMarkerVisible")!==undefined&&typeof data("noseMarkerVisible")!=="boolean")||(data("noseMarkerScale")!==undefined&&!boundedNumber(data("noseMarkerScale"),gameSetupBounds.noseMarkerScale))||(data("trackExtensionWorldUnits")!==undefined&&!boundedNumber(data("trackExtensionWorldUnits"),gameSetupBounds.trackExtensionWorldUnits))||(data("visibleWristObstacleRadius")!==undefined&&typeof data("visibleWristObstacleRadius")!=="boolean")||(data("wristBombColliderScale")!==undefined&&!boundedNumber(data("wristBombColliderScale"),gameSetupBounds.wristBombColliderScale)))return null;if((data("guardSpacing")!==undefined&&!boundedNumber(data("guardSpacing"),gameSetupBounds.guardSpacing))||(data("uppercutOppositeLane")!==undefined&&typeof data("uppercutOppositeLane")!=="boolean")||(data("anyOppositeLane")!==undefined&&typeof data("anyOppositeLane")!=="boolean"))return null;
if(data("renderScale")!==undefined&&!boundedNumber(data("renderScale"),gameSetupBounds.renderScale))return null;const colliderSettings=createFlowColliderSettings({schema:defaultFlowColliderSettings.schema,version:defaultFlowColliderSettings.version,algorithm:defaultFlowColliderSettings.algorithm,colliderRadius:data("colliderRadius"),enforceAuthoredDirection:data("enforceAuthoredDirection"),directionToleranceDegrees:data("directionToleranceDegrees"),timingWindowMs:data("timingWindowMs")});const flowColliderVolume=data("flowColliderVolume")===undefined?defaultFlowColliderVolume:normalizeModeColliderVolume(data("flowColliderVolume"));const boxingColliderVolume=data("boxingColliderVolume")===undefined?defaultBoxingColliderVolume:normalizeModeColliderVolume(data("boxingColliderVolume"));if(!flowColliderVolume||!boxingColliderVolume)return null;const scales=normalizeStoredVisualScales(value);if(!scales)return null;const boxingColliderFields=normalizeBoxingColliderSetupFields({topRowReachWU:data("topRowReachWU"),bottomRowReachWU:data("bottomRowReachWU"),guardCountMode:data("guardCountMode")});if(!boxingColliderFields)return null;const visibilityFields=normalizeGameSetupVisibilityFields(value);if(!visibilityFields)return null;const hazardVignetteFields=normalizeGameSetupHazardVignetteFields(value);if(!hazardVignetteFields)return null;return freezeSnapshot({schema:aeroGameSetupSchema,version:aeroGameSetupVersion,showGameplayGrid:data("showGameplayGrid"),obstaclesEnabled:data("obstaclesEnabled")??true,guidanceBandMode:data("guidanceBandMode"),spawnDistanceOverride:{enabled:overrideData("enabled"),normalSpawnDistanceWorldUnits:overrideData("normalSpawnDistanceWorldUnits")},colliderRadius:colliderSettings.colliderRadius,enforceAuthoredDirection:colliderSettings.enforceAuthoredDirection,directionToleranceDegrees:colliderSettings.directionToleranceDegrees,timingWindowMs:colliderSettings.timingWindowMs,...boxingColliderFields,guardSpacing:data("guardSpacing")??0.25,noseMarkerVisible:data("noseMarkerVisible")??true,noseMarkerScale:data("noseMarkerScale")??0.25,trackExtensionWorldUnits:data("trackExtensionWorldUnits")??2,uppercutOppositeLane:data("uppercutOppositeLane")??false,anyOppositeLane:data("anyOppositeLane")??false,...scales,flowColliderVolume,boxingColliderVolume,visibleWristObstacleRadius:data("visibleWristObstacleRadius")??false,wristBombColliderScale:data("wristBombColliderScale")??1,renderScale:data("renderScale")??1,...visibilityFields,...hazardVignetteFields});}catch{return null;}}

/** @param {string} serialized @returns {AeroGameSetupSnapshot|null} */
function migrateV2GameSetup(serialized){try{const value=JSON.parse(serialized);if(!exactDataRecord(value,v2Keys))return null;const data=(key)=>Object.getOwnPropertyDescriptor(value,key)?.value;if(data("schema")!==aeroGameSetupSchema||data("version")!==2)return null;for(const key of["showGameplayGrid","arrivalGroupNumbersEnabled","attentionHaloEnabled","nextUpRibbonEnabled","noseCameraParallaxEnabled"])if(typeof data(key)!=="boolean")return null;const override=data("spawnDistanceOverride");if(!exactDataRecord(override,["enabled","normalSpawnDistanceWorldUnits"]))return null;const overrideData=(key)=>Object.getOwnPropertyDescriptor(override,key)?.value;if(typeof overrideData("enabled")!=="boolean"||!boundedNumber(overrideData("normalSpawnDistanceWorldUnits"),gameSetupBounds.normalSpawnDistanceWorldUnits)||!boundedNumber(data("noseCameraRangeXWorldUnits"),gameSetupBounds.noseCameraRangeXWorldUnits)||!boundedNumber(data("noseCameraRangeYWorldUnits"),gameSetupBounds.noseCameraRangeYWorldUnits))return null;return freezeSnapshot({...defaultAeroGameSetupSnapshot,showGameplayGrid:false,guidanceBandMode:data("nextUpRibbonEnabled")?"target_arrivals":"off",spawnDistanceOverride:{enabled:overrideData("enabled"),normalSpawnDistanceWorldUnits:overrideData("normalSpawnDistanceWorldUnits")}});}catch{return null;}}
/** @param {string} serialized @returns {AeroGameSetupSnapshot|null} */
function migrateV1GameSetup(serialized){try{const value=JSON.parse(serialized);if(!exactDataRecord(value,["showGameplayGrid"])||typeof Object.getOwnPropertyDescriptor(value,"showGameplayGrid")?.value!=="boolean")return null;return freezeSnapshot({...defaultAeroGameSetupSnapshot,showGameplayGrid:false});}catch{return null;}}
function normalizeSerializedSetup(serialized){try{return normalizeGameSetup(JSON.parse(serialized));}catch{return null;}}
/** Compare validated stored data by values, not JSON property ordering. */
function storedSetupIsCanonical(serialized,snapshot){try{const stored=JSON.parse(serialized);return Object.keys(snapshot).length===Object.keys(stored).length&&Object.keys(snapshot).every(key=>JSON.stringify(stored[key])===JSON.stringify(snapshot[key]));}catch{return false;}}
function fixedNoseCameraFields(value){return value.noseCameraParallaxEnabled===true&&value.noseCameraRangeXWorldUnits===fixedNoseCameraRangeWorldUnits&&value.noseCameraRangeYWorldUnits===fixedNoseCameraRangeWorldUnits;}
/** @param {unknown} value @param {readonly string[]} keys */
function exactDataRecord(value,keys){if(value===null||typeof value!=="object"||Array.isArray(value))return false;const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)return false;const ownKeys=Reflect.ownKeys(value);if(ownKeys.length!==keys.length||ownKeys.some((key)=>typeof key!=="string"||!keys.includes(key)))return false;return keys.every((key)=>{const descriptor=Object.getOwnPropertyDescriptor(value,key);return Boolean(descriptor&&descriptor.enumerable&&"value" in descriptor);});}
/** @param {unknown} value @param {readonly number[]} bounds */
function boundedNumber(value,bounds){return typeof value==="number"&&Number.isFinite(value)&&value>=Number(bounds[0])&&value<=Number(bounds[1]);}
/** @param {AeroGameSetupSnapshot|Record<string,unknown>} value @returns {AeroGameSetupSnapshot} */
function freezeSnapshot(value){const override=/** @type {Record<string,unknown>} */(value.spawnDistanceOverride);const visibilityFields=normalizeGameSetupVisibilityFields(value)??Object.freeze({visibleToleranceRange:false,visibleColliderRadius:false});return Object.freeze({schema:String(value.schema),version:Number(value.version),showGameplayGrid:Boolean(value.showGameplayGrid),obstaclesEnabled:Boolean(value.obstaclesEnabled??true),guidanceBandMode:/** @type {GuidanceBandMode} */(value.guidanceBandMode),noseCameraParallaxEnabled:true,spawnDistanceOverride:Object.freeze({enabled:Boolean(override.enabled),normalSpawnDistanceWorldUnits:Number(override.normalSpawnDistanceWorldUnits)}),noseCameraRangeXWorldUnits:fixedNoseCameraRangeWorldUnits,noseCameraRangeYWorldUnits:fixedNoseCameraRangeWorldUnits,colliderRadius:Number(value.colliderRadius),enforceAuthoredDirection:Boolean(value.enforceAuthoredDirection),directionToleranceDegrees:Number(value.directionToleranceDegrees),timingWindowMs:Number(value.timingWindowMs),topRowReachWU:Number(value.topRowReachWU??aeroRowReachBounds[0][3]),bottomRowReachWU:Number(value.bottomRowReachWU??aeroRowReachBounds[1][3]),guardCountMode:value.guardCountMode===undefined?defaultGuardCountMode:String(value.guardCountMode),guardSpacing:Number(value.guardSpacing??0.25),noseMarkerVisible:Boolean(value.noseMarkerVisible??true),noseMarkerScale:Number(value.noseMarkerScale??0.25),trackExtensionWorldUnits:Number(value.trackExtensionWorldUnits??2),uppercutOppositeLane:Boolean(value.uppercutOppositeLane??false),anyOppositeLane:Boolean(value.anyOppositeLane??false),noteScalePercent:Number(value.noteScalePercent??100),obstacleScalePercent:Number(value.obstacleScalePercent??100),bombScalePercent:Number(value.bombScalePercent??100),markerScalePercent:Number(value.markerScalePercent??100),flowColliderVolume:Object.freeze({...(value.flowColliderVolume??defaultFlowColliderVolume)}),boxingColliderVolume:Object.freeze({...(value.boxingColliderVolume??defaultBoxingColliderVolume)}),visibleWristObstacleRadius:Boolean(value.visibleWristObstacleRadius??false),wristBombColliderScale:Number(value.wristBombColliderScale??1),renderScale:Number(value.renderScale??1),...visibilityFields,...normalizeGameSetupHazardVignetteFields(value)});}
/** @param {AeroGameSetupSnapshot} left @param {AeroGameSetupSnapshot} right */
function equalSetup(left,right){return JSON.stringify(left)===JSON.stringify(right);}
function deepFreeze(value){if(value&&typeof value==="object")for(const child of Object.values(value))deepFreeze(child);return Object.freeze(value);}
/** Parse exact data fixtures or a genuine native StorageEvent without consulting forged prototype properties. @param {unknown} event */
function storageEventEnvelope(event){if(event===null||typeof event!=="object"||Array.isArray(event))return null;const NativeStorageEvent=globalThis.StorageEvent;if(typeof NativeStorageEvent==="function"&&event instanceof NativeStorageEvent){const prototype=NativeStorageEvent.prototype,read=(key)=>{const descriptor=Object.getOwnPropertyDescriptor(prototype,key);if(!descriptor||typeof descriptor.get!=="function")throw new TypeError("Native StorageEvent descriptor is unavailable");return Reflect.apply(descriptor.get,event,[]);};return Object.freeze({key:read("key"),newValue:read("newValue"),storageArea:read("storageArea")});}if(!exactDataRecord(event,["key","newValue","storageArea"]))return null;const read=(key)=>Object.getOwnPropertyDescriptor(event,key)?.value;return Object.freeze({key:read("key"),newValue:read("newValue"),storageArea:read("storageArea")});}
/**
 * 0.0.86: guard spacing's default moved from 1 to 0.25. A setup persisted under the
 * old default still carries 1, which silently overrode the new default forever.
 * Rewrite exactly that legacy sentinel once, preserving every other stored
 * preference. The marker makes it a genuine one-shot: a later deliberate 1.0 sticks.
 */
const guardSpacingDefaultMigrationKey="aerobeat.game-setup.guard-spacing-default-v2";
const legacyGuardSpacingDefault=1;
function migrateGuardSpacingDefault(coordinator,snapshot){
  const storage=coordinator.storage;
  if(!storage)return snapshot;
  let done=false;
  try{done=storage.getItem(guardSpacingDefaultMigrationKey)==="1";}catch{return snapshot;}
  if(done)return snapshot;
  if(Number(snapshot.guardSpacing)!==legacyGuardSpacingDefault)return snapshot;
  const migrated=freezeSnapshot({...snapshot,guardSpacing:defaultAeroGameSetupSnapshot.guardSpacing});
  coordinator.persistReset(migrated);
  try{storage.setItem(guardSpacingDefaultMigrationKey,"1");}catch{/* best effort */}
  return migrated;
}

// The old Flow default rear=3 was saved into ordinary phone setup. Convert
// that indistinguishable old default once, then leave later intentional 3 alone.
const flowRearDefaultMigrationKey="aerobeat.game-setup.flow-rear-default-v1";
function migrateFlowRearDefault(coordinator,snapshot){
  const storage=coordinator.storage;
  if(!storage)return snapshot;
  try{if(storage.getItem(flowRearDefaultMigrationKey)==="1")return snapshot;}catch{return snapshot;}
  const migrated=snapshot.flowColliderVolume.colliderDepthBackward===3
    ? freezeSnapshot({...snapshot,flowColliderVolume:{...snapshot.flowColliderVolume,colliderDepthBackward:0}})
    : snapshot;
  if(migrated!==snapshot)coordinator.persistReset(migrated);
  try{storage.setItem(flowRearDefaultMigrationKey,"1");}catch{/* best effort */}
  return migrated;
}

// Prior public defaults were Flow +1.5 and Boxer Scale .5 / rear 3.
// Saved records contain those values even when their owner never touched the
// fields. Migrate only these exact old-default sentinels once; any later
// deliberate choice of the same number remains untouched.
const modeColliderDefaultsMigrationKey="aerobeat.game-setup.mode-collider-defaults-v1";
function migrateModeColliderDefaults(coordinator,snapshot){
  const storage=coordinator.storage;
  if(!storage)return snapshot;
  try{if(storage.getItem(modeColliderDefaultsMigrationKey)==="1")return snapshot;}catch{return snapshot;}
  const flow=snapshot.flowColliderVolume,boxing=snapshot.boxingColliderVolume;
  const nextFlow=flow.colliderScale===1&&flow.colliderDepthForward===1.5&&flow.colliderDepthBackward===0?{...flow,colliderDepthForward:1}:flow;
  const nextBoxing=boxing.colliderScale===.5&&boxing.colliderDepthForward===1&&boxing.colliderDepthBackward===3?{...boxing,colliderScale:1,colliderDepthBackward:0}:boxing;
  const migrated=nextFlow===flow&&nextBoxing===boxing?snapshot:freezeSnapshot({...snapshot,flowColliderVolume:nextFlow,boxingColliderVolume:nextBoxing});
  if(migrated!==snapshot)coordinator.persistReset(migrated);
  try{storage.setItem(modeColliderDefaultsMigrationKey,"1");}catch{/* best effort */}
  return migrated;
}

function browserStorage(){return typeof globalThis.localStorage==="undefined"?null:globalThis.localStorage;}
function browserEventTarget(){return typeof globalThis.addEventListener==="function"?globalThis:null;}

export const aeroGameSetupCoordinator=new AeroGameSetupCoordinator();
export const getGameSetupSnapshot=()=>aeroGameSetupCoordinator.getSnapshot();
/** @param {unknown} value */
export const setGameSetupSnapshot=(value)=>aeroGameSetupCoordinator.setSnapshot(value);
/** @param {(snapshot:AeroGameSetupSnapshot)=>void} callback @param {boolean} [emitCurrent] */
export const subscribeGameSetup=(callback,emitCurrent)=>aeroGameSetupCoordinator.subscribe(callback,emitCurrent);
