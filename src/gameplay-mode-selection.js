// @ts-check

import { conversionRecipeIds, rulesetIds } from "@aerobeat/web-contracts";

/**
 * z2tx: the visible modes are exactly Flow and Boxing. Boxing is THE collider
 * ruleset (boxing_collider_v1); the legacy Lanes/Grid rulesets stay in
 * contracts/persistence for stored-package playback but are hidden from the
 * selector (no recipe — variant resolution matches on rulesetId alone).
 */
export const gameplayRulesetIds = Object.freeze({ flow: "flow_colliders_v1", boxingCollider: "boxing_collider_v1", boxingLanes: "boxing_semantic_track_v1", boxingGrid: "boxing_spatial_grid_v1" });
/** Retained alias so historical telemetry/oracles keep resolving the Flow ruleset by its canonical ID. */
export const flowCollidersGameplayRulesetId = "flow_colliders_v1";
export const flowGameplayRulesetIds = Object.freeze([gameplayRulesetIds.flow]);
/** Visible product Gameplay modes: exactly Flow + Boxing (the collider ruleset). */
export const visibleGameplayRulesetIds = Object.freeze([gameplayRulesetIds.flow, gameplayRulesetIds.boxingCollider]);
/** Hidden-but-still-resolvable legacy boxing rulesets for stored-package playback. */
export const hiddenBoxingGameplayRulesetIds = Object.freeze([gameplayRulesetIds.boxingLanes, gameplayRulesetIds.boxingGrid]);
/** Every resolvable boxing ruleset: the new collider mode plus the hidden legacy pair. */
export const boxingGameplayRulesetIds = Object.freeze([gameplayRulesetIds.boxingCollider, gameplayRulesetIds.boxingLanes, gameplayRulesetIds.boxingGrid]);
export const boxingRecipeIds = Object.freeze({ balancedHeight: conversionRecipeIds[0], sourceHeight: conversionRecipeIds[1] });
export const firstUseBoxingRecipeId = boxingRecipeIds.balancedHeight;

const rulesetValues = Object.freeze(Object.values(gameplayRulesetIds));
const recipeValues = conversionRecipeIds;

/** Read one exact, own, enumerable scalar UI intent without invoking accessors. */
export function readGameplayRulesetIntent(payload) {
  return readExactScalarIntent(payload, "rulesetId", rulesetValues, "Gameplay mode selection intent is invalid");
}

/** Read one exact, own, enumerable scalar UI intent without invoking accessors. */
export function readBoxingRecipeIntent(payload) {
  return readExactScalarIntent(payload, "recipeId", recipeValues, "Boxing conversion selection intent is invalid");
}

/**
 * Resolve only an exact variant already present in the selected package. The new
 * Boxing collider mode resolves by ruleset alone (single-variant packages carry no
 * conversion recipe); the hidden legacy Lanes/Grid modes resolve on ruleset + recipe.
 */
export function exactGameplayVariant(variants, rulesetId, retainedRecipeId) {
  if (!Array.isArray(variants)) return null;
  if (flowGameplayRulesetIds.includes(rulesetId)) {
    return variants.find((variant) => ownValue(variant, "rulesetId") === rulesetId && (ownValue(variant, "recipeId") === null || ownValue(variant, "recipeId") === undefined)) ?? null;
  }
  if (rulesetId === gameplayRulesetIds.boxingCollider) {
    return variants.find((variant) => ownValue(variant, "rulesetId") === rulesetId && (ownValue(variant, "recipeId") === null || ownValue(variant, "recipeId") === undefined)) ?? null;
  }
  if (!recipeValues.includes(retainedRecipeId)) return null;
  return variants.find((variant) => ownValue(variant, "rulesetId") === rulesetId && ownValue(variant, "recipeId") === retainedRecipeId) ?? null;
}

/**
 * z2tx: project the exact product-selector candidate identity. Exactly two visible
 * candidates — `flow` and `boxing` — with the stored-variant playback IDs below
 * for data-intact hidden packages.
 */
export function selectedGameplayProfileId(variant) {
  const rulesetId = ownValue(variant, "rulesetId");
  const recipeId = ownValue(variant, "recipeId");
  if (rulesetId === gameplayRulesetIds.boxingCollider) return "boxing";
  if (rulesetId === gameplayRulesetIds.boxingLanes && recipeId === boxingRecipeIds.balancedHeight) return "semantic-row";
  if (rulesetId === gameplayRulesetIds.boxingGrid && recipeId === boxingRecipeIds.balancedHeight) return "spatial-row";
  if (rulesetId === gameplayRulesetIds.boxingLanes && recipeId === boxingRecipeIds.sourceHeight) return "semantic-cut";
  if (rulesetId === gameplayRulesetIds.boxingGrid && recipeId === boxingRecipeIds.sourceHeight) return "spatial-cut";
  return "flow";
}

/** Map scoring ruleset truth to renderer presentation truth. */
export function rendererPresentationForVariant(variant) {
  const rulesetId = ownValue(variant, "rulesetId");
  if (flowGameplayRulesetIds.includes(rulesetId)) return "flow";
  if (rulesetId === gameplayRulesetIds.boxingCollider) return "boxing_collider";
  if (rulesetId === gameplayRulesetIds.boxingLanes) return "boxing_lanes";
  return "boxing_spatial_grid";
}

function readExactScalarIntent(payload, key, allowed, message) {
  if (!payload || typeof payload !== "object" || Object.getPrototypeOf(payload) !== Object.prototype) throw new TypeError(message);
  const keys = Reflect.ownKeys(payload);
  if (keys.length !== 1 || keys[0] !== key) throw new TypeError(message);
  const descriptor = Object.getOwnPropertyDescriptor(payload, key);
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string" || !allowed.includes(descriptor.value)) throw new TypeError(message);
  return descriptor.value;
}

function ownValue(record, key) {
  if (!record || typeof record !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && "value" in descriptor && descriptor.enumerable ? descriptor.value : undefined;
}
