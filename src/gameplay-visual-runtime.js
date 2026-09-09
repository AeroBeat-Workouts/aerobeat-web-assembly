// @ts-check

import { createGameplayVisualExperimentConfig } from "@aerobeat/web-renderer";

export const canonicalWorldUnitsPerMs=.006;
export const measuredNoseParallaxMaximumAgeMs=150;
export const INTERNAL_CONTENT_SPAWN_TIMING=Symbol.for("aerobeat.web-content.internal-spawn-timing");
export const INTERNAL_INPUT_MEASURED_NOSE_PARALLAX=Symbol.for("aerobeat.web-input.internal-measured-nose-parallax");
const spawnTimingKeys=Object.freeze(["schema","version","algorithm","bpm","noteJumpMovementSpeed","noteJumpStartBeatOffset","maxHalfJumpDistance","startHalfJumpDurationBeats","minimumHalfJumpDurationBeats","halfJumpDurationBeats","reactionTimeMs","jumpDistanceMeters"]);
const noseSampleKeys=Object.freeze(["calibrationId","sourceIdentity","measurementTimestampMs","measuredSourceFrameId","xDeflection","yDeflection"]);

/**
 * Read the generation-bound private timing authority and return only an AeroBeat distance.
 * Raw NJS, offset, and timing records never cross this function.
 * @param {Record<PropertyKey,unknown>} contentService
 * @param {unknown} contentSnapshot
 * @param {import("./game-setup-coordinator.js").AeroGameSetupSnapshot} setup
 * @returns {number|null}
 */
export function selectedNormalSpawnDistanceWorldUnits(contentService,contentSnapshot,setup){
  if(setup.spawnDistanceOverride.enabled)return setup.spawnDistanceOverride.normalSpawnDistanceWorldUnits;
  if(!exactDataRecord(contentSnapshot,["schema","version","serviceId","state","generation","source","packageId","packageHash","song","variants","selectedVariant","resolvedEvents","assets","playback","theme","background","error"],false))return null;
  const state=dataValue(contentSnapshot,"state"),generation=dataValue(contentSnapshot,"generation");
  if(state!=="ready"||!Number.isSafeInteger(generation)||Number(generation)<0)return null;
  const reader=contentService[INTERNAL_CONTENT_SPAWN_TIMING];
  if(typeof reader!=="function")return null;
  let timing;try{timing=reader.call(contentService,generation);}catch{return null;}
  if(!exactDataRecord(timing,spawnTimingKeys,true))return null;
  if(dataValue(timing,"schema")!=="aerobeat/beatsaber_spawn_timing"||dataValue(timing,"version")!==1||dataValue(timing,"algorithm")!=="beatsaber_core_hjd_v1")return null;
  for(const key of spawnTimingKeys.slice(3))if(typeof dataValue(timing,key)!=="number"||!Number.isFinite(dataValue(timing,key)))return null;
  const reactionTimeMs=Number(dataValue(timing,"reactionTimeMs"));
  return reactionTimeMs>0?reactionTimeMs*canonicalWorldUnitsPerMs:null;
}

/** @param {import("./game-setup-coordinator.js").AeroGameSetupSnapshot} setup */
export function rendererGameplayVisualConfig(setup){return createGameplayVisualExperimentConfig(setup.arrivalGroupNumbersEnabled,setup.attentionHaloEnabled,setup.nextUpRibbonEnabled,setup.noseCameraParallaxEnabled,setup.noseCameraRangeXWorldUnits,setup.noseCameraRangeYWorldUnits,.04,120,3,2,180);}

/**
 * Consume one measured-only sample without retaining a mirror and expose only normalized deflections.
 * @param {Record<PropertyKey,unknown>} inputService
 * @param {number} nowMs
 * @param {boolean} lifecycleActive
 * @returns {Readonly<{active:boolean,xDeflection:number,yDeflection:number}>}
 */
export function sanitizedNoseCameraDeflection(inputService,nowMs,lifecycleActive){
  if(!lifecycleActive||!Number.isFinite(nowMs))return inactiveDeflection;
  const reader=inputService[INTERNAL_INPUT_MEASURED_NOSE_PARALLAX];if(typeof reader!=="function")return inactiveDeflection;
  let sample;try{sample=reader.call(inputService);}catch{return inactiveDeflection;}
  if(!exactDataRecord(sample,noseSampleKeys,true))return inactiveDeflection;
  if(!nonEmptyString(dataValue(sample,"calibrationId"))||!nonEmptyString(dataValue(sample,"sourceIdentity"))||!nonEmptyString(dataValue(sample,"measuredSourceFrameId")))return inactiveDeflection;
  const timestamp=Number(dataValue(sample,"measurementTimestampMs")),x=Number(dataValue(sample,"xDeflection")),y=Number(dataValue(sample,"yDeflection")),age=nowMs-timestamp;
  if(!Number.isFinite(timestamp)||timestamp<0||!Number.isFinite(age)||age<0||age>=measuredNoseParallaxMaximumAgeMs||!normalized(x)||!normalized(y))return inactiveDeflection;
  return Object.freeze({active:true,xDeflection:Object.is(x,-0)?0:x,yDeflection:Object.is(y,-0)?0:y});
}

export const inactiveDeflection=Object.freeze({active:false,xDeflection:0,yDeflection:0});
function normalized(value){return Number.isFinite(value)&&value>=-1&&value<=1;}
function nonEmptyString(value){return typeof value==="string"&&value.length>0&&value.length<=256;}
/** @param {unknown} value @param {readonly string[]} keys @param {boolean} exact */
function exactDataRecord(value,keys,exact){try{if(value===null||typeof value!=="object"||Array.isArray(value))return false;const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)return false;const ownKeys=Reflect.ownKeys(value);if(exact&&(ownKeys.length!==keys.length||ownKeys.some((key)=>typeof key!=="string"||!keys.includes(key))))return false;return keys.every((key)=>{const descriptor=Object.getOwnPropertyDescriptor(value,key);return Boolean(descriptor&&descriptor.enumerable&&"value" in descriptor);});}catch{return false;}}
/** @param {unknown} record @param {string} key */
function dataValue(record,key){return record!==null&&typeof record==="object"?Object.getOwnPropertyDescriptor(record,key)?.value:undefined;}
