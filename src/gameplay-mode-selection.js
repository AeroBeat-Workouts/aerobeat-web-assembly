// @ts-check

import { conversionRecipeIds, rulesetIds } from "@aerobeat/web-contracts";

export const gameplayRulesetIds = Object.freeze({ flow: rulesetIds[0], boxingLanes: rulesetIds[1], boxingGrid: rulesetIds[2] });
export const boxingRecipeIds = Object.freeze({ balancedHeight: conversionRecipeIds[0], sourceHeight: conversionRecipeIds[1] });
export const firstUseBoxingRecipeId = boxingRecipeIds.balancedHeight;

const rulesetValues = rulesetIds;
const recipeValues = conversionRecipeIds;

/** Read one exact, own, enumerable scalar UI intent without invoking accessors. */
export function readGameplayRulesetIntent(payload) {
  return readExactScalarIntent(payload, "rulesetId", rulesetValues, "Gameplay mode selection intent is invalid");
}

/** Read one exact, own, enumerable scalar UI intent without invoking accessors. */
export function readBoxingRecipeIntent(payload) {
  return readExactScalarIntent(payload, "recipeId", recipeValues, "Boxing conversion selection intent is invalid");
}

/** Resolve only an exact variant already present in the selected package. */
export function exactGameplayVariant(variants, rulesetId, retainedRecipeId) {
  if (!Array.isArray(variants)) return null;
  if (rulesetId === gameplayRulesetIds.flow) {
    return variants.find((variant) => ownValue(variant, "rulesetId") === gameplayRulesetIds.flow && (ownValue(variant, "recipeId") === null || ownValue(variant, "recipeId") === undefined)) ?? null;
  }
  if (!recipeValues.includes(retainedRecipeId)) return null;
  return variants.find((variant) => ownValue(variant, "rulesetId") === rulesetId && ownValue(variant, "recipeId") === retainedRecipeId) ?? null;
}

/** Project the exact existing five-candidate identity expected by the product UI. */
export function selectedGameplayProfileId(variant) {
  const rulesetId = ownValue(variant, "rulesetId");
  if (rulesetId === gameplayRulesetIds.flow) return "flow";
  const recipeId = ownValue(variant, "recipeId");
  if (rulesetId === gameplayRulesetIds.boxingLanes && recipeId === boxingRecipeIds.balancedHeight) return "semantic-row";
  if (rulesetId === gameplayRulesetIds.boxingGrid && recipeId === boxingRecipeIds.balancedHeight) return "spatial-row";
  if (rulesetId === gameplayRulesetIds.boxingLanes && recipeId === boxingRecipeIds.sourceHeight) return "semantic-cut";
  if (rulesetId === gameplayRulesetIds.boxingGrid && recipeId === boxingRecipeIds.sourceHeight) return "spatial-cut";
  return "flow";
}

/** Map scoring ruleset truth to renderer presentation truth. */
export function rendererPresentationForVariant(variant) {
  const rulesetId = ownValue(variant, "rulesetId");
  if (rulesetId === gameplayRulesetIds.flow) return "flow";
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
